const ensureInstalled = require('./install.js')

class FormattingService {
	constructor(modulePath, prettier, parsers) {
		this.modulePath = modulePath
		this.prettier = prettier
		this.parsers = parsers

		this.didAddTextEditor = this.didAddTextEditor.bind(this)
		this.toggleFormatOnSave = this.toggleFormatOnSave.bind(this)
		this.prettierServiceDidExit = this.prettierServiceDidExit.bind(this)
		this.format = this.format.bind(this)

		this.saveListeners = new Map()
		this.issueCollection = new IssueCollection()
		this.configs = new Map()

		this.setupConfiguration()
		nova.workspace.onDidAddTextEditor(this.didAddTextEditor)
	}

	setupConfiguration() {
		nova.workspace.config.observe(
			'prettier.format-on-save',
			this.toggleFormatOnSave
		)
		nova.config.observe('prettier.format-on-save', this.toggleFormatOnSave)
		nova.config.observe('prettier.experimental.prettier-service', (enabled) => {
			if (enabled) {
				this.startPrettierService()
			} else {
				this.stopPrettierService()
			}
		})
	}

	startPrettierService() {
		if (this.prettierService) return

		console.log('Starting separate Prettier service')

		this.prettierService = new Process('/usr/bin/env', {
			args: [
				'node',
				nova.path.join(nova.extension.path, 'Scripts', 'prettier-service.js'),
				this.modulePath,
			],
			stdio: 'jsonrpc',
		})
		this.prettierService.onDidExit(this.prettierServiceDidExit)
		this.prettierService.start()
	}

	stopPrettierService() {
		if (!this.prettierService) return

		console.log('Stopping separate Prettier service')

		this.prettierService.terminate()
		this.prettierService = null
	}

	prettierServiceDidExit(exitCode) {
		if (exitCode === 0) return

		this.prettierService = null

		if (this.prettierServiceCrashedRecently) {
			showActionableError(
				'prettier-service-frequent-crashes-error',
				'Prettier stopped working twice',
				'There may be a problem. To try restarting it again, choose Restart. If the problem persist, check the Extension Console for more info or report an issue through the Extension Library.',
				'Restart',
				(r) => r && this.startPrettierService()
			)
			return
		}

		this.prettierServiceCrashedRecently = true
		setTimeout(() => (this.prettierServiceCrashedRecently = false), 5000)

		this.startPrettierService()
	}

	getFormatOnSaveWorkspaceConfig() {
		switch (nova.workspace.config.get('prettier.format-on-save')) {
			case 'Enable':
				return true
			case 'Disable':
				return false
			// Upgrade old format
			case true:
				nova.workspace.config.set(
					'prettier.format-on-save',
					nova.config.get('prettier.format-on-save') === true
						? 'Global Default'
						: 'Enable'
				)
				return true
			case false:
				nova.workspace.config.set(
					'prettier.format-on-save',
					nova.config.get('prettier.format-on-save') === false
						? 'Global Default'
						: 'Disable'
				)
				return false
			// No preference -> "Global default"
			default:
				return null
		}
	}

	toggleFormatOnSave() {
		this.enabled =
			this.getFormatOnSaveWorkspaceConfig() ??
			nova.config.get('prettier.format-on-save') ??
			true

		if (this.enabled) {
			nova.workspace.textEditors.forEach(this.didAddTextEditor)
		} else {
			this.saveListeners.forEach((listener) => listener.dispose())
			this.saveListeners.clear()
		}
	}

	didAddTextEditor(editor) {
		if (!this.enabled) return

		if (this.saveListeners.has(editor)) return
		this.saveListeners.set(editor, editor.onWillSave(this.format))
	}

	async format(editor) {
		const { document } = editor

		const documentRange = new Range(0, document.length)
		const text = editor.getTextInRange(documentRange)

		const params = {
			text,
			pathForConfig: document.path || nova.workspace.path,
			ignorePath: this.getIgnorePath(document.path),
			syntax: document.syntax,
			options: {
				...(document.path
					? { filepath: document.path }
					: { parser: this.parserForSyntax(syntax) }),
				cursorOffset: editor.selectedRange.end,
			},
		}

		this.issueCollection.set(document.uri, [])

		// Resolve config if we know a path to check
		let result
		let error
		try {
			result = this.prettierService
				? await this.prettierService.request('format', params)
				: await this.formatLegacy(params)
			if (result.error) error = result.error
		} catch (err) {
			error = err
		}

		if (!result) return

		if (error) {
			const name = error.name || error.constructor.name
			if (name === 'UndefinedParserError') return

			// See if it's a proper syntax error.
			const lineData = error.message.match(/\((\d+):(\d+)\)\n/m)
			if (!lineData) {
				console.error(error, error.stack, error.errorCode)
				return
			}

			const issue = new Issue()
			issue.message = error.message
			issue.severity = IssueSeverity.Error
			issue.line = lineData[1]
			issue.column = lineData[2]

			this.issueCollection.set(document.uri, [issue])
			return
		}

		const { formatted, cursorOffset } = result

		editor
			.edit((e) => {
				e.replace(documentRange, formatted)
				editor.selectedRanges = [new Range(cursorOffset, cursorOffset)]
			})
			.catch((err) => console.error(err, err.stack))
	}

	async formatLegacy({ text, syntax, pathForConfig, options }) {
		let config = {}
		let info = {}

		if (pathForConfig) {
			try {
				;({ config, info } = await this.getConfigForPath(pathForConfig))
			} catch (err) {
				console.warn(
					`Unable to get config for ${document.path}: ${err}`,
					err.stack
				)
				this.showConfigResolutionError(pathForConfig)
			}
		}

		if (options.filepath && info.ignored === true) return null

		return this.prettier.formatWithCursor(text, {
			...config,
			...options,
			// Force HTML parser for PHP syntax because Nova considers PHP a
			// sub-syntax of HTML and enables the command.
			...(syntax === 'php' ? { parser: 'html' } : {}),
			plugins: this.parsers,
		})
	}

	getIgnorePath(path) {
		const expectedIgnoreDir = nova.workspace.path || nova.path.dirname(path)
		return nova.path.join(expectedIgnoreDir, '.prettierignore')
	}

	async getConfigForPath(path) {
		// TODO: Invalidate cache at some point?
		if (this.configs.has(path)) return this.configs.get(path)

		const config = await this.resolveConfigForPath(path)
		this.configs.set(path, config)

		return config
	}

	async resolveConfigForPath(path) {
		let resolve, reject
		const promise = new Promise((_resolve, _reject) => {
			resolve = _resolve
			reject = _reject
		})

		const process = new Process('/usr/bin/env', {
			args: [
				'node',
				nova.path.join(nova.extension.path, 'Scripts', 'config.js'),
				this.modulePath,
				getIgnorePath(path),
				path,
			],
		})

		const errors = []

		process.onStdout((result) => {
			try {
				resolve(JSON.parse(result))
			} catch (err) {
				reject(err)
			}
		})
		process.onStderr((err) => {
			errors.push(err)
		})
		process.onDidExit((status) => {
			if (status === '0') return
			reject(errors.join('\n'))
		})
		process.start()

		return promise
	}

	showConfigResolutionError(path) {
		showError(
			'prettier-config-resolution-error',
			'Failed to resolve Prettier configuration',
			`File to be formatted: ${path}`
		)
	}

	parserForSyntax(syntax) {
		switch (syntax) {
			case 'javascript':
			case 'jsx':
				return 'babel'
			case 'flow':
				return 'babel-flow'
			default:
				return syntax
		}
	}
}

function showError(id, title, body) {
	let request = new NotificationRequest(id)

	request.title = nova.localize(title)
	request.body = nova.localize(body)
	request.actions = [nova.localize('OK')]

	nova.notifications.add(request).catch((err) => console.error(err, err.stack))
}

function showActionableError(id, title, body, action, callback) {
	let request = new NotificationRequest(id)

	request.title = nova.localize(title)
	request.body = nova.localize(body)
	request.actions = [nova.localize('Ignore'), nova.localize(action)]

	nova.notifications
		.add(request)
		.then((response) => callback(response.actionIdx === 1))
		.catch((err) => console.error(err, err.stack))
}

exports.activate = async function () {
	try {
		await ensureInstalled()
		const { modulePath, prettier, parsers } = await require('./prettier.js')()

		const formattingService = new FormattingService(
			modulePath,
			prettier,
			parsers
		)
		nova.commands.register('prettier.format', formattingService.format)
	} catch (err) {
		console.error('Unable to set up prettier service', err, err.stack)

		if (err.status === 127) {
			return showError(
				'prettier-resolution-error',
				`Can't find npm and Prettier`,
				`Prettier couldn't be found because npm isn't available. Please make sure you have Node installed. If you've only installed Node through NVM, you'll need to change your shell configuration to work with Nova. See https://library.panic.com/nova/environment-variables/`
			)
		}

		return showError(
			'prettier-resolution-error',
			`Unable to start Prettier`,
			`Please check the extension console for additional logs.`
		)
	}
}

exports.deactivate = function () {
	// Clean up state before the extension is deactivated
}
