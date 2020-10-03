const ensureInstalled = require('./install.js')
const { showError } = require('./helpers.js')
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
		nova.config.observe(
			'prettier.experimental.prettier-service',
			this.toggleFormatter
		)
	}

	toggleFormatter(useSubprocess) {
		if (this.formatter) this.formatter.stop()
		this.formatter = useSubprocess
			? new SubprocessFormatter(this.modulePath)
			: new RuntimeFormatter(this.modulePath, this.prettier, this.parsers)
		this.formatter.start()
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
		const workspaceConfig = this.getFormatOnSaveWorkspaceConfig()
		const extensionConfig = nova.config.get('prettier.format-on-save')
		if (workspaceConfig !== null) {
			this.enabled = workspaceConfig
		} else if (extensionConfig !== null) {
			this.enabled = extensionConfig
		} else {
			this.enabled = true
		}

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
