const prettier = require('../node_modules/prettier/standalone.js')
const angularParser = require('../node_modules/prettier/parser-angular.js')
const babylonParser = require('../node_modules/prettier/parser-babylon.js')
const flowParser = require('../node_modules/prettier/parser-flow.js')
const glimmerParser = require('../node_modules/prettier/parser-glimmer.js')
const graphqlParser = require('../node_modules/prettier/parser-graphql.js')
const htmlParser = require('../node_modules/prettier/parser-html.js')
const markdownParser = require('../node_modules/prettier/parser-markdown.js')
const postcssParser = require('../node_modules/prettier/parser-postcss.js')
const typescriptParser = require('../node_modules/prettier/parser-typescript.js')
const yamlParser = require('../node_modules/prettier/parser-yaml.js')

const parsers = [
	angularParser,
	babylonParser,
	flowParser,
	glimmerParser,
	graphqlParser,
	htmlParser,
	markdownParser,
	postcssParser,
	typescriptParser,
	yamlParser
]

class FormattingService {
	constructor() {
		this.didAddTextEditor = this.didAddTextEditor.bind(this)
		this.toggleFormatOnSave = this.toggleFormatOnSave.bind(this)
		this.format = this.format.bind(this)

		this.saveListeners = new Map()
		this.issueCollection = new IssueCollection()
		this.configs = new Map()

		nova.workspace.config.observe(
			'prettier.format-on-save',
			this.toggleFormatOnSave
		)
		this.toggleFormatOnSave(
			nova.workspace.config.get('prettier.format-on-save')
		)
	}

	toggleFormatOnSave(enabled) {
		if (enabled) {
			nova.workspace.textEditors.forEach(this.didAddTextEditor)
			this.onDidAddTextEditorListener = nova.workspace.onDidAddTextEditor(
				this.didAddTextEditor
			)
		} else {
			if (this.onDidAddTextEditorListener)
				this.onDidAddTextEditorListener.dispose()
			this.saveListeners.forEach(listener => listener.dispose())
			this.saveListeners.clear()
		}
	}

	didAddTextEditor(editor) {
		if (this.saveListeners.has(editor)) return
		this.saveListeners.set(editor, editor.onWillSave(this.format))
	}

	async format(editor) {
		const { document } = editor
		const documentRange = new Range(0, document.length)

		this.issueCollection.set(document.path, [])

		let config
		try {
			config = await this.getConfigForPath(document.path)
		} catch (err) {
			console.log(`Unable to get config for ${document.path}: ${err}`)
		}

		let newCursorOffset
		await editor.edit(e => {
			const text = editor.getTextInRange(documentRange)

			try {
				const { formatted, cursorOffset } = prettier.formatWithCursor(text, {
					...config,
					cursorOffset: editor.selectedRange.end,
					filepath: document.path,
					plugins: parsers
				})

				if (formatted === text) return
				e.replace(documentRange, formatted)
				newCursorOffset = cursorOffset
			} catch (err) {
				if (err.constructor.name === 'UndefinedParserError') return
				const issue = new Issue()
				const lineData = err.message.match(/\((\d+):(\d+)\)\n/m)

				issue.message = err.message
				issue.severity = IssueSeverity.Error
				issue.line = lineData[1]
				issue.column = lineData[2]

				this.issueCollection.set(document.path, [issue])
			}
		})

		if (newCursorOffset !== undefined) {
			editor.selectedRanges = [new Range(newCursorOffset, newCursorOffset)]
			editor.scrollToCursorPosition()
		}
	}

	async getConfigForPath(path) {
		// TODO: Invalidate cache at some point?
		if (this.configs.has(path)) return this.configs.get(path)

		const config = await this.resolveConfigForPath(path)
		this.configs.set(path, config)

		return config
	}

	async resolveConfigForPath(path) {
		let resolve
		const promise = new Promise(_resolve => (resolve = _resolve))

		const process = new Process('/usr/bin/env', {
			args: [
				'node',
				nova.path.join(nova.extension.path, 'Scripts', 'config.js'),
				path
			]
		})

		process.onStdout(result => {
			resolve(JSON.parse(result))
		})
		process.start()

		return promise
	}
}

new Promise(resolve => `Returning: ${err}`).catch(console.error)

exports.activate = function() {
	const formattingService = new FormattingService()
	nova.commands.register('prettier.format', formattingService.format)
}

exports.deactivate = function() {
	// Clean up state before the extension is deactivated
}
