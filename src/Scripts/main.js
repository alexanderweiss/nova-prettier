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
			this.saveListeners.forEach((listener) => listener.dispose())
			this.saveListeners.clear()
		}
	}

	didAddTextEditor(editor) {
		if (this.saveListeners.has(editor)) return
		this.saveListeners.set(editor, editor.onWillSave(this.format))
	}

	async format(editor) {
		const { document } = editor

		let config, info
		try {
			;({ config, info } = await this.getConfigForPath(document.path))
		} catch (err) {
			console.warn(`Unable to get config for ${document.path}: ${err}`)
			this.showConfigResolutionError(document.path)
		}

		if (info.ignored === true) return

		const documentRange = new Range(0, document.length)
		this.issueCollection.set(document.path, [])

		await editor.edit((e) => {
			const text = editor.getTextInRange(documentRange)

			try {
				const { formatted, cursorOffset } = this.prettier.formatWithCursor(
					text,
					{
						...config,
						cursorOffset: editor.selectedRange.end,
						filepath: document.path,
						plugins: this.parsers,
					}
				)

				if (formatted === text) return
				e.replace(documentRange, formatted)
				editor.selectedRanges = [new Range(cursorOffset, cursorOffset)]
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
				nova.path.join(nova.workspace.path, '.prettierignore'),
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
		let request = new NotificationRequest('prettier-config-resolution-error')

		request.title = nova.localize('Failed to resolve Prettier configuration')
		request.body = nova.localize(`File to be formatted: ${path}`)
		request.actions = [nova.localize('OK')]

		nova.notifications.add(request).catch((err) => console.error(err))
	}
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
		console.error('Unable to set up prettier service', err)
	}
}

exports.deactivate = function () {
	// Clean up state before the extension is deactivated
}
