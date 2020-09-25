const ensureInstalled = require('./install.js')

class FormattingService {
	constructor(modulePath, prettier, parsers) {
		this.modulePath = modulePath
		this.prettier = prettier
		this.parsers = parsers

		this.didAddTextEditor = this.didAddTextEditor.bind(this)
		this.toggleFormatOnSave = this.toggleFormatOnSave.bind(this)
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

		let config = {}
		let info = {}
		// Resolve config if we know a path to check
		const pathForConfig = document.path || nova.workspace.path
		if (pathForConfig) {
			try {
				;({ config, info } = await this.getConfigForPath(pathForConfig))
			} catch (err) {
				console.warn(
					`Unable to get config for ${document.path}: ${err}`,
					err.stack
				)
				this.showConfigResolutionError(document.path)
			}
		}

		if (document.path && info.ignored === true) return

		const documentRange = new Range(0, document.length)
		this.issueCollection.set(document.uri, [])

		await editor.edit((e) => {
			const text = editor.getTextInRange(documentRange)

			try {
				const { formatted, cursorOffset } = this.prettier.formatWithCursor(
					text,
					{
						...config,
						...(document.path
							? { filepath: document.path }
							: { parser: this.parserForSyntax(document.syntax) }),
						// Force HTML parser for PHP syntax because Nova considers PHP a
						// sub-syntax of HTML and enables the command.
						...(document.syntax === 'php' ? { parser: 'html' } : {}),
						cursorOffset: editor.selectedRange.end,
						plugins: this.parsers,
					}
				)

				if (formatted === text) return
				e.replace(documentRange, formatted)
				editor.selectedRanges = [new Range(cursorOffset, cursorOffset)]
			} catch (err) {
				if (err.constructor.name === 'UndefinedParserError') return

				// See if it's a proper syntax error.
				const lineData = err.message.match(/\((\d+):(\d+)\)\n/m)
				if (!lineData) {
					console.error(err, err.stack)
					return
				}

				const issue = new Issue()
				issue.message = err.message
				issue.severity = IssueSeverity.Error
				issue.line = lineData[1]
				issue.column = lineData[2]

				this.issueCollection.set(document.uri, [issue])
			}
		})
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

		const expectedIgnoreDir = nova.workspace.path || nova.path.dirname(path)
		const process = new Process('/usr/bin/env', {
			args: [
				'node',
				nova.path.join(nova.extension.path, 'Scripts', 'config.js'),
				this.modulePath,
				nova.path.join(expectedIgnoreDir, '.prettierignore'),
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
