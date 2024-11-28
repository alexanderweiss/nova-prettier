const findPrettier = require('./module-resolver.js')
const {
	showError,
	getConfigWithWorkspaceOverride,
	observeConfigWithWorkspaceOverride,
	log,
} = require('./helpers.js')
const { Formatter } = require('./formatter.js')

class PrettierExtension {
	constructor() {
		this.didAddTextEditor = this.didAddTextEditor.bind(this)
		this.toggleFormatOnSave = this.toggleFormatOnSave.bind(this)
		this.modulePathDidChange = this.modulePathDidChange.bind(this)
		this.prettierConfigFileDidChange =
			this.prettierConfigFileDidChange.bind(this)
		this.editorWillSave = this.editorWillSave.bind(this)
		this.didInvokeFormatCommand = this.didInvokeFormatCommand.bind(this)
		this.didInvokeFormatSelectionCommand =
			this.didInvokeFormatSelectionCommand.bind(this)
		this.didInvokeSaveWithoutFormattingCommand =
			this.didInvokeSaveWithoutFormattingCommand.bind(this)

		this.saveListeners = new Map()
		this.ignoredEditors = new Set()
		this.issueCollection = new IssueCollection()

		this.formatter = new Formatter()
	}

	setupConfiguration() {
		nova.config.remove('prettier.use-compatibility-mode')

		observeConfigWithWorkspaceOverride(
			'prettier.format-on-save',
			this.toggleFormatOnSave,
		)
		observeConfigWithWorkspaceOverride(
			'prettier.module.path',
			this.modulePathDidChange,
		)
	}

	start() {
		this.setupConfiguration()
		if (nova.workspace.path) {
			nova.fs.watch('**/.prettierrc*', this.prettierConfigFileDidChange)
			nova.fs.watch('**/package.json', this.prettierConfigFileDidChange)
		}
		nova.workspace.onDidAddTextEditor(this.didAddTextEditor)
		nova.commands.register('prettier.format', this.didInvokeFormatCommand)
		nova.commands.register(
			'prettier.format-selection',
			this.didInvokeFormatSelectionCommand,
		)
		nova.commands.register(
			'prettier.save-without-formatting',
			this.didInvokeSaveWithoutFormattingCommand,
		)
	}

	async startFormatter() {
		const path =
			getConfigWithWorkspaceOverride('prettier.module.path') ||
			(await findPrettier())

		log.info(`Loading prettier at ${path}`)
		await this.formatter
			.start(path)
			.catch(() =>
				new Promise((resolve) => setTimeout(resolve, 1000)).then(() =>
					this.formatter.start(path),
				),
			)
	}

	toggleFormatOnSave() {
		this.enabled = getConfigWithWorkspaceOverride('prettier.format-on-save')

		if (this.enabled) {
			nova.workspace.textEditors.forEach(this.didAddTextEditor)
		} else {
			this.saveListeners.forEach((listener) => listener.dispose())
			this.saveListeners.clear()
		}
	}

	async prettierConfigFileDidChange() {
		await this.formatter.stop()
		await this.formatter.start()
	}

	async modulePathDidChange() {
		try {
			await this.formatter.stop()
			await this.startFormatter()
		} catch (err) {
			if (err.status === 127) {
				return showError(
					'prettier-resolution-error',
					`Can't find npm and Prettier`,
					`Prettier couldn't be found because npm isn't available. Please make sure you have Node installed. If you've only installed Node through NVM, you'll need to change your shell configuration to work with Nova. See https://library.panic.com/nova/environment-variables/`,
				)
			}

			console.error('Unable to start prettier service', err, err.stack)

			return showError(
				'prettier-resolution-error',
				`Unable to start Prettier`,
				`Please check the extension console for additional logs.`,
			)
		}
	}

	didAddTextEditor(editor) {
		if (!this.enabled) return

		if (this.saveListeners.has(editor)) return
		this.saveListeners.set(editor, editor.onWillSave(this.editorWillSave))
	}

	async editorWillSave(editor) {
		await this.formatEditor(editor, true, false)
	}

	async didInvokeFormatCommand(editor) {
		await this.formatEditor(editor, false, false)
	}

	async didInvokeFormatSelectionCommand(editor) {
		await this.formatEditor(editor, false, true)
	}

	async didInvokeSaveWithoutFormattingCommand(editor) {
		this.ignoredEditors.add(editor)
		editor.save().finally(() => this.ignoredEditors.delete(editor))
	}

	async formatEditor(editor, isSaving, selectionOnly) {
		if (this.ignoredEditors.has(editor)) return

		try {
			const ready = await this.formatter.isReady
			if (!ready) return

			const issues = await this.formatter.formatEditor(
				editor,
				isSaving,
				selectionOnly,
			)
			this.issueCollection.set(editor.document.uri, issues)
		} catch (err) {
			console.error(err, err.stack)
			showError(
				'prettier-format-error',
				`Error while formatting`,
				`"${err.message}" occurred while formatting ${editor.document.path}. See the extension console for more info.`,
			)
		}
	}
}

exports.activate = async function () {
	try {
		const extension = new PrettierExtension()
		extension.start()
	} catch (err) {
		console.error('Unable to set up prettier service', err, err.stack)

		return showError(
			'prettier-resolution-error',
			`Unable to start Prettier`,
			`Please check the extension console for additional logs.`,
		)
	}
}

exports.deactivate = function () {
	// Clean up state before the extension is deactivated
}
