const {
	showError,
	showActionableError,
	log,
	getConfigWithWorkspaceOverride,
} = require('./helpers.js')

const PRETTIER_OPTIONS = [
	'arrowParens',
	'bracketSpacing',
	'endOfLine',
	'htmlWhitespaceSensitivity',
	'insertPragma',
	'jsxBracketSameLine',
	'jsxSingleQuote',
	'printWidth',
	'proseWrap',
	'quoteProps',
	'requirePragma',
	'semi',
	'singleQuote',
	'tabWidth',
	'trailingComma',
	'useTabs',
	'vueIndentScriptAndStyle',
]

class Formatter {
	constructor() {
		this.prettierServiceDidExit = this.prettierServiceDidExit.bind(this)

		this.emitter = new Emitter()

		this.setupIsReadyPromise()
	}

	get defaultConfig() {
		return Object.fromEntries(
			PRETTIER_OPTIONS.map((option) => [
				option,
				getConfigWithWorkspaceOverride(`prettier.default-config.${option}`),
			])
		)
	}

	get isReady() {
		if (!this._isReadyPromise) {
			this.showServiceNotRunningError()
			return false
		}

		return this._isReadyPromise
	}

	async start(modulePath) {
		if (modulePath) this.modulePath = modulePath
		if (this.prettierService) return

		log.info('Starting Prettier service')

		if (!this._isReadyPromise) this.setupIsReadyPromise()

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
		nova.notifications.cancel('prettier-not-running')
		if (!this._isReadyPromise) return

		log.info('Stopping Prettier service')

		this.prettierService.terminate()
		if (this._resolveIsReadyPromise) this._resolveIsReadyPromise(false)
		this._isReadyPromise = null
		this.prettierService = null
	}

	setupIsReadyPromise() {
		this._isReadyPromise = new Promise((resolve) => {
			this._resolveIsReadyPromise = resolve
		})
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
			`Please report report an issue though Extension Library if this problem persits.`,
			['Restart Prettier'],
			(r) => {
				switch (r) {
					case 0:
						this.start()
						break
				}
			}
		)
	}

	async formatEditor(editor, saving, selectionOnly) {
		const { document } = editor

		nova.notifications.cancel('prettier-unsupported-syntax')

		const pathForConfig = document.path || nova.workspace.path

		const shouldApplyDefaultConfig = await this.shouldApplyDefaultConfig(
			document,
			saving,
			pathForConfig
		)

		if (shouldApplyDefaultConfig === null) return []

		log.info(`Formatting ${document.path}`)

		const documentRange = new Range(0, document.length)
		const original = editor.getTextInRange(documentRange)
		const options = {
			...(document.path
				? { filepath: document.path }
				: { parser: this.getParserForSyntax(document.syntax) }),
			...(shouldApplyDefaultConfig ? this.defaultConfig : {}),
			...(selectionOnly
				? {
						rangeStart: editor.selectedRange.start,
						rangeEnd: editor.selectedRange.end,
				  }
				: {}),
		}

		const result = await this.prettierService.request('format', {
			original,
			pathForConfig,
			ignorePath: saving && this.getIgnorePath(pathForConfig),
			options,
		})

		const { formatted, error, ignored, missingParser } = result

		if (error) {
			return this.issuesFromPrettierError(error)
		}

		if (ignored) {
			log.info(`Prettier is configured to ignore ${document.path}`)
			return []
		}

		if (missingParser) {
			if (!saving) {
				showError(
					'prettier-unsupported-syntax',
					`Syntax not supported`,
					`Prettier doesn't include a Parser for this file and no plugin is installed that does.`
				)
			}
			log.info(`No parser for ${document.path}`)
			return []
		}

		if (formatted === original) {
			log.info(`No changes for ${document.path}`)
			return []
		}

		await this.applyResult(editor, original, formatted)
	}

	async shouldApplyDefaultConfig(document, saving, pathForConfig) {
		// Don't format-on-save ignore syntaxes.
		if (
			saving &&
			nova.config.get(
				`prettier.format-on-save.ignored-syntaxes.${document.syntax}`
			) === true
		) {
			log.info(
				`Not formatting (${document.syntax} syntax ignored) ${document.path}`
			)
			return null
		}

		let hasConfig = false

		if (document.isRemote) {
			// Don't format-on-save remote documents if they're ignored.
			if (
				saving &&
				getConfigWithWorkspaceOverride('prettier.format-on-save.ignore-remote')
			) {
				return null
			}
		} else {
			// Try to resolve configuration using Prettier for non-remote documents.
			hasConfig = await this.prettierService.request('hasConfig', {
				pathForConfig,
			})

			if (
				!hasConfig &&
				getConfigWithWorkspaceOverride(
					'prettier.format-on-save.ignore-without-config'
				)
			) {
				return null
			}
		}

		return !hasConfig
	}

	getIgnorePath(path) {
		const expectedIgnoreDir = nova.workspace.path || nova.path.dirname(path)
		return nova.path.join(expectedIgnoreDir, '.prettierignore')
	}

	getParserForSyntax(syntax) {
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

	async applyResult(editor, original, formatted) {
		const documentRange = new Range(0, editor.document.length)

		if (original !== editor.getTextInRange(documentRange)) {
			log.info(`Document ${editor.document.path} was changed while formatting`)
			return
		}

		log.info(`Applying formatted changes to ${editor.document.path}`)

		await editor.edit((e) => {
			e.replace(documentRange, formatted)
		})
	}

	issuesFromPrettierError(error) {
		// If the error doesn't have a message just ignore it.
		if (typeof error.message !== 'string') return []

		if (error.name === 'UndefinedParserError') throw error

		// See if it's a simple error
		let lineData = error.message.match(/\((\d+):(\d+)\)\n/m)
		// See if it's a visual error
		if (!lineData) {
			lineData = error.message.match(/^>\s*?(\d+)\s\|\s/m)
			if (lineData) {
				const columnData = error.message.match(/^\s+\|(\s+)\^+($|\n)/im)
				lineData[2] = columnData ? columnData[1].length + 1 : 0
			}
		}

		if (!lineData) {
			throw error
		}

		const issue = new Issue()
		issue.message = error.stack
			? error.message
			: error.message.split(/\n\s*?at\s+/i)[0] // When error is only a message it probably has the stack trace appended. Remove it.
		issue.severity = IssueSeverity.Error
		issue.line = lineData[1]
		issue.column = lineData[2]

		return [issue]
	}
}

module.exports = {
	Formatter,
}
