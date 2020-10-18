const ensureInstalled = require('./install.js')
const {
	showError,
	showActionableError,
	log,
	getConfigWithWorkspaceOverride,
} = require('./helpers.js')
const { SubprocessFormatter, RuntimeFormatter } = require('./formatter.js')

class PrettierExtension {
	constructor(modulePath, prettier, parsers) {
		this.modulePath = modulePath
		this.prettier = prettier
		this.parsers = parsers

		this.didAddTextEditor = this.didAddTextEditor.bind(this)
		this.toggleFormatOnSave = this.toggleFormatOnSave.bind(this)
		this.editorWillSave = this.editorWillSave.bind(this)
		this.didInvokeFormatCommand = this.didInvokeFormatCommand.bind(this)
		this.toggleFormatter = this.toggleFormatter.bind(this)

		this.saveListeners = new Map()
		this.issueCollection = new IssueCollection()

		this.setupConfiguration()
		nova.workspace.onDidAddTextEditor(this.didAddTextEditor)
		nova.commands.register('prettier.format', this.didInvokeFormatCommand)
	}

	setupConfiguration() {
		nova.workspace.config.observe(
			'prettier.format-on-save',
			this.toggleFormatOnSave
		)
		nova.config.observe('prettier.format-on-save', this.toggleFormatOnSave)
		nova.config.observe('prettier.use-compatibility-mode', this.toggleFormatter)
	}

	toggleFormatter(useCompatibilityMode) {
		if (this.formatter) this.formatter.stop()
		this.formatter = useCompatibilityMode
			? new RuntimeFormatter(this.modulePath, this.prettier, this.parsers)
			: new SubprocessFormatter(this.modulePath)
		this.formatter.start()
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

	didAddTextEditor(editor) {
		if (!this.enabled) return

		if (this.saveListeners.has(editor)) return
		this.saveListeners.set(editor, editor.onWillSave(this.editorWillSave))
	}

	async editorWillSave(editor) {
		this.formatEditor(editor, true)
	}

	async didInvokeFormatCommand(editor) {
		this.formatEditor(editor, false)
	}

	async formatEditor(editor, isSaving) {
		try {
			const ready = await this.formatter.isReady
			if (!ready) return

			const issues = await this.formatter.formatEditor(editor, isSaving)
			this.issueCollection.set(editor.document.uri, issues)
		} catch (err) {
			console.error(err, err.stack)
			showError(
				'prettier-format-error',
				`Error while formatting`,
				`"${err.message}" occurred while formatting ${editor.document.path}. See the extension console for more info.`
			)
		}
	}
}

exports.activate = async function () {
	try {
		await ensureInstalled()
		const { modulePath, prettier, parsers } = await require('./prettier.js')()

		const extension = new PrettierExtension(modulePath, prettier, parsers)

		if (nova.config.get('prettier.use-compatibility-mode')) {
			showActionableError(
				'prettier-compatibility-mode-warning',
				`Compatibility mode will soon disappear`,
				`Please create an issue on Github with information about what version of macOS and Node you're using so we can make sure Prettier keeps working for you.`,
				['Create issue'],
				(action) => {
					if (!action) return
					nova.openURL(
						'https://github.com/alexanderweiss/nova-prettier/issues/new'
					)
				}
			)
		}
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
