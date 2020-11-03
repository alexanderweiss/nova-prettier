const diff = require('fast-diff')
const {
	showError,
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

	async formatEditor(editor, saving) {
		const { document } = editor

		nova.notifications.cancel('prettier-unsupported-syntax')

		// Don't format-on-save ignore syntaxes.
		if (
			saving &&
			nova.config.get(
				`prettier.format-on-save.ignored-syntaxes.${document.syntax}`
			) === true
		) {
			log.info(
				`Not formatting (${document.syntax}) syntax ignored) ${document.path}`
			)
			return []
		}

		const pathForConfig = document.path || nova.workspace.path
		let hasConfig = false

		if (document.isRemote) {
			// Don't format-on-save remote documents if they're ignored.
			if (
				saving &&
				getConfigWithWorkspaceOverride('prettier.format-on-save.ignore-remote')
			) {
				return []
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
				return []
			}
		}

		log.info(`Formatting ${document.path}`)

		const options = {
			...(document.path
				? { filepath: document.path }
				: { parser: this.parserForSyntax(document.syntax) }),
			...(!hasConfig ? this.defaultConfig : {}),
		}

		const documentRange = new Range(0, document.length)
		const original = editor.getTextInRange(documentRange)

		const result = await this.prettierService.request('format', {
			text: original,
			pathForConfig,
			ignorePath: saving && this.ignorePath(pathForConfig),
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

	async applyResult(editor, original, formatted) {
		log.info(`Applying formatted changes to ${editor.document.path}`)

		const [cursor, edits] = this.diff(
			original,
			formatted,
			editor.selectedRanges
		)

		if (
			original !== editor.getTextInRange(new Range(0, editor.document.length))
		) {
			log.info(`Document ${editor.document.path} was changed while formatting`)
			return
		}

		if (edits) {
			return this.applyDiff(editor, cursor, edits)
		}

		return this.replace(editor, formatted)
	}

	diff(original, formatted, selectedRanges) {
		// Find a cursor that does not occur in this document
		const cursor = POSSIBLE_CURSORS.find(
			(cursor) => !original.includes(cursor) && !formatted.includes(cursor)
		)
		// Fall back to not knowing the cursor position.
		if (!cursor) return null

		let originalWithCursors = ''
		let lastEnd = 0

		for (const selection of selectedRanges) {
			originalWithCursors +=
				original.slice(lastEnd, selection.start) +
				cursor +
				original.slice(selection.start, selection.end) +
				cursor
			lastEnd = selection.end
		}

		originalWithCursors += original.slice(lastEnd)

		// Diff
		return [cursor, diff(originalWithCursors, formatted)]
	}

	async applyDiff(editor, cursor, edits) {
		const selections = []
		await editor.edit((e) => {
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

						const lastSelection = selections[selections.length - 1]
						if (!lastSelection || lastSelection[1]) {
							selections[selections.length] = [offset]
						} else {
							lastSelection[1] = offset
						}
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

		editor.selectedRanges = selections.map((s) => new Range(s[0], s[1]))
	}

	async replace(editor, formatted) {
		const { document } = editor

		const cursorPosition = editor.selectedRange.end
		const documentRange = new Range(0, document.length)

		await editor.edit((e) => {
			e.replace(documentRange, formatted)
		})

		editor.selectedRanges = [new Range(cursorPosition, cursorPosition)]
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
