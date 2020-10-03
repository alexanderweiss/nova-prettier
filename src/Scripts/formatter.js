const { showError, showActionableError } = require('./helpers.js')

class Formatter {
	constructor() {
		this.formattedText = new Map()
		this.emitter = new Emitter()
	}

	get isReady() {
		return true
	}

	start() {}
	stop() {}

	onFatalError(callback) {
		this.emitter.on('fatalError', callback)
	}

	// runPrettier() {}
	// applyResult() {}

	async formatEditor(editor, shouldSave) {
		const { document } = editor

		console.log(`Formatting ${document.path}`)

		const documentRange = new Range(0, document.length)
		const text = editor.getTextInRange(documentRange)

		// Skip formatting if the current text matches a saved formatted version
		const previouslyFormattedText = this.formattedText.get(editor)
		if (previouslyFormattedText) {
			this.formattedText.delete(editor)
			if (previouslyFormattedText === text) return
		}

		const pathForConfig = document.path || nova.workspace.path
		const syntax = document.syntax
		const options = {
			...(document.path
				? { filepath: document.path }
				: { parser: this.parserForSyntax(syntax) }),
			cursorOffset: editor.selectedRange.end,
		}

		let result
		try {
			result = await this.runPrettier(text, pathForConfig, syntax, options)
		} catch (err) {
			return this.handlePrettierError(editor, err)
		}

		if (!result) return []

		const { formatted } = result
		if (formatted === text) return []

		let editPromise = this.applyResult(editor, result)
		if (shouldSave) {
			editPromise = editPromise.then(() => {
				this.ensureSaved(editor, formatted)
			})
		}
		editPromise.catch((err) => console.error(err, err.stack))
	}

	handlePrettierError(editor, error) {
		const name = error.name || error.constructor.name
		if (name === 'UndefinedParserError') throw error

		// See if it's a proper syntax error.
		const lineData = error.message.match(/\((\d+):(\d+)\)\n/m)
		if (!lineData) {
			throw error
		}

		const issue = new Issue()
		issue.message = error.message
		issue.severity = IssueSeverity.Error
		issue.line = lineData[1]
		issue.column = lineData[2]

		return [issue]
	}

	ensureSaved(editor, formatted) {
		const { document } = editor

		if (!document.isDirty) return
		if (document.isClosed) return
		if (document.isUntitled) return

		const documentRange = new Range(0, document.length)
		const text = editor.getTextInRange(documentRange)
		if (formatted !== text) return

		// Our changes weren't included in the save because it took too
		// long. Save it once more but skip formatting for that save.
		this.formattedText.set(editor, formatted)
		editor.save()
	}

	ignorePath(path) {
		const expectedIgnoreDir = nova.workspace.path || nova.path.dirname(path)
		return nova.path.join(expectedIgnoreDir, '.prettierignore')
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

class SubprocessFormatter extends Formatter {
	constructor(modulePath) {
		super()
		this.modulePath = modulePath

		this.prettierServiceDidExit = this.prettierServiceDidExit.bind(this)
	}

	get isReady() {
		if (!this._isReadyPromise) {
			this.showServiceNotRunningError()
			return false
		}

		return this._isReadyPromise
	}

	async start() {
		if (this._isReadyPromise) return

		console.log('Starting Prettier service')

		this._isReadyPromise = new Promise((resolve) => {
			this._resolveIsReadyPromise = resolve
		})

		this.prettierService = new Process('/usr/bin/env', {
			args: [
				'node',
				nova.path.join(
					nova.extension.path,
					'Scripts',
					'prettier-service',
					'prettier-service.js'
				),
				this.modulePath,
			],
			stdio: 'jsonrpc',
		})
		this.prettierService.onDidExit(this.prettierServiceDidExit)
		this.prettierService.onNotify('didStart', () => {
			this._resolveIsReadyPromise(true)
		})
		this.prettierService.start()
	}

	stop() {
		if (!this._isReadyPromise) return

		console.log('Stopping Prettier service')

		this.prettierService.terminate()
		if (this._resolveIsReadyPromise) this._resolveIsReadyPromise(false)
		this._isReadyPromise = null
		this.prettierService = null
	}

	prettierServiceDidExit(exitCode) {
		if (!this.prettierService) return

		console.error(`Prettier service exited with code ${exitCode}`)

		if (this._resolveIsReadyPromise) this._resolveIsReadyPromise(false)
		this._isReadyPromise = null
		this.prettierService = null

		if (this.prettierServiceCrashedRecently) {
			return this.showServiceNotRunningError()
		}

		this.prettierServiceCrashedRecently = true
		setTimeout(() => (this.prettierServiceCrashedRecently = false), 5000)

		this.start()
	}

	showServiceNotRunningError() {
		showActionableError(
			'prettier-not-running',
			'Prettier stopped running',
			`Try restarting, or run in legacy mode instead (also available in settings). If you do, please check the Extension Console for log output and report an issue though Extension Library.`,
			['Use legacy mode', 'Restart'],
			(r) => {
				switch (r) {
					case 1:
						this.start()
						break
					case 0:
						nova.config.set('prettier.experimental.prettier-service', false)
						break
				}
			}
		)
	}

	async runPrettier(text, pathForConfig, syntax, options) {
		const result = await this.prettierService.request('format', {
			text,
			pathForConfig,
			ignorePath: this.ignorePath(pathForConfig),
			syntax,
			options,
		})

		if (!result || !result.error) return result

		const error = new Error()
		error.name = result.error.name
		error.message = result.error.message
		error.stack = result.error.stack

		throw error
	}

	async applyResult(editor, { formatted, cursorOffset }) {
		const { document } = editor
		const documentRange = new Range(0, document.length)

		return editor.edit((e) => {
			e.replace(documentRange, formatted)
			editor.selectedRanges = [new Range(cursorOffset, cursorOffset)]
		})
	}
}

class RuntimeFormatter extends Formatter {
	constructor(modulePath, prettier, parsers) {
		super()

		this.modulePath = modulePath
		this.prettier = prettier
		this.parsers = parsers

		this.configs = new Map()
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
				this.ignorePath(path),
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

	async runPrettier(text, pathForConfig, syntax, options) {
		let config = {}
		let info = {}

		// Don't handle PHP syntax. Required because Nova considers PHP a
		// sub-syntax of HTML and enables the command.
		if (syntax === 'php') return null

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
			plugins: this.parsers,
		})
	}

	async applyResult(editor, { formatted, cursorOffset }) {
		const { document } = editor
		const documentRange = new Range(0, document.length)

		return editor.edit((e) => {
			e.replace(documentRange, formatted)
			editor.selectedRanges = [new Range(cursorOffset, cursorOffset)]
		})
	}
}

module.exports = {
	SubprocessFormatter,
	RuntimeFormatter,
}
