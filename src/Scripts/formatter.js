const diff = require('fast-diff')
const {
	showActionableError,
	log,
	getConfigWithWorkspaceOverride,
} = require('./helpers.js')

const POSSIBLE_CURSORS = String.fromCharCode(
	0xfffd,
	0xffff,
	0x1f094,
	0x1f08d,
	0xe004,
	0x1f08d
).split('')

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

		this.formattedText = new Map()
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

	async formatEditor(editor, shouldSave) {
		const { document } = editor

		if (
			shouldSave &&
			nova.config.get(
				`prettier.format-on-save.ignored-syntaxes.${document.syntax}`
			) === true
		) {
			log.info(
				`Not formatting (${document.syntax}) syntax ignored) ${document.path}`
			)
			return []
		}

		log.info(`Formatting ${document.path}`)

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
		const selectionStart = editor.selectedRange.start
		const selectionEnd = editor.selectedRange.end
		const options = {
			...(document.path
				? { filepath: document.path }
				: { parser: this.parserForSyntax(syntax) }),
			cursorOffset: selectionEnd,
		}

		// Don't format-on-save remote documents if they're ignored.
		if (
			shouldSave &&
			document.isRemote &&
			getConfigWithWorkspaceOverride('prettier.format-on-save.ignore-remote')
		) {
			return []
		}

		let result
		try {
			result = await this.runPrettier(
				text,
				pathForConfig,
				syntax,
				shouldSave,
				document.isRemote,
				options
			)
		} catch (err) {
			return this.issuesFromPrettierError(err)
		}

		if (!result) {
			// TODO: Show warning when formatting using command.
			log.info(`No result (ignored or no parser) for ${document.path}`)
			return []
		}

		const { formatted } = result
		if (formatted === text) {
			log.info(`No changes for ${document.path}`)
			return []
		}

		log.info(`Applying formatted changes to ${document.path}`)
		await this.applyResult(editor, result, {
			text,
			selectionStart,
			selectionEnd,
		})
	}

	issuesFromPrettierError(error) {
		// If the error doesn't have a message just ignore it.
		if (typeof error.message !== 'string') return []

		const name = error.name || error.constructor.name
		if (name === 'UndefinedParserError') throw error

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

	async runPrettier(
		text,
		pathForConfig,
		syntax,
		shouldSave,
		isRemote,
		options
	) {
		delete options.cursorOffset

		let hasConfig = false

		if (!isRemote) {
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

		if (!hasConfig) {
			options = { ...options, ...this.defaultConfig }
		}

		const result = await this.prettierService.request('format', {
			text,
			pathForConfig,
			ignorePath: shouldSave && this.ignorePath(pathForConfig),
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

	async applyResult(editor, result, options) {
		const { formatted } = result
		const { text, selectionStart, selectionEnd } = options

		// TODO: Multi-cursor support.

		// Find a cursor that does not occur in this document
		const cursor = POSSIBLE_CURSORS.find(
			(cursor) => !text.includes(cursor) && !formatted.includes(cursor)
		)
		// Fall back to not knowing the cursor position.
		if (!cursor) return super.applyResultWithoutDiff(editor, result, options)

		// Insert the cursors
		const textWithCursor =
			text.slice(0, selectionStart) +
			cursor +
			text.slice(selectionStart, selectionEnd) +
			cursor +
			text.slice(selectionEnd)

		// Diff
		const edits = diff(textWithCursor, formatted)

		if (text !== editor.getTextInRange(new Range(0, editor.document.length))) {
			log.info(`Document ${editor.document.path} was changed while formatting`)
			return
		}

		let newSelectionStart
		let newSelectionEnd
		const editPromise = editor.edit((e) => {
			let offset = 0
			let toRemove = 0

			// Add an extra empty edit so any trailing delete is actually run.
			edits.push([diff.EQUAL, ''])

			for (const [edit, str] of edits) {
				if (edit === diff.DELETE) {
					toRemove += str.length

					// Check if the cursors are in here
					let cursorIndex = -1
					while (true) {
						cursorIndex = str.indexOf(cursor, cursorIndex + 1)
						if (cursorIndex === -1) break
						newSelectionStart
							? (newSelectionEnd = offset)
							: (newSelectionStart = offset)
						toRemove -= cursor.length
					}

					continue
				}

				if (edit === diff.EQUAL && toRemove) {
					e.replace(new Range(offset, offset + toRemove), '')
				} else if (edit === diff.INSERT) {
					e.replace(new Range(offset, offset + toRemove), str)
				}

				toRemove = 0
				offset += str.length
			}
		})

		editPromise
			.then(() => {
				editor.selectedRanges = [new Range(newSelectionStart, newSelectionEnd)]
			})
			.catch((err) => console.error(err))
		return editPromise
	}

	async applyResultWithoutDiff(editor, { formatted, cursorOffset }) {
		const { document } = editor
		const documentRange = new Range(0, document.length)

		const editPromise = editor.edit((e) => {
			e.replace(documentRange, formatted)
		})

		editPromise.then(() => {
			editor.selectedRanges = [new Range(cursorOffset, cursorOffset)]
		})

		return editPromise
	}
}

module.exports = {
	Formatter,
}
