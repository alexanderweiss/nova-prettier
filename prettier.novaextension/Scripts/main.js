'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

class ProcessError extends Error {
	constructor(status, message) {
		super(message);
		this.status = status;
	}
}

function showError(id, title, body) {
	let request = new NotificationRequest(id);

	request.title = nova.localize(title);
	request.body = nova.localize(body);
	request.actions = [nova.localize('OK')];

	nova.notifications.add(request).catch((err) => console.error(err, err.stack));
}

function showActionableError(id, title, body, actions, callback) {
	let request = new NotificationRequest(id);

	request.title = nova.localize(title);
	request.body = nova.localize(body);
	request.actions = actions.map((action) => nova.localize(action));

	nova.notifications
		.add(request)
		.then((response) => callback(response.actionIdx))
		.catch((err) => console.error(err, err.stack));
}

function getConfigWithWorkspaceOverride(name) {
	const workspaceConfig = getWorkspaceConfig(name);
	const extensionConfig = nova.config.get(name);

	return workspaceConfig === null ? extensionConfig : workspaceConfig
}

function getWorkspaceConfig(name) {
	const value = nova.workspace.config.get(name);
	switch (value) {
		case 'Enable':
			return true
		case 'Disable':
			return false
		case 'Global Default':
			return null
		default:
			return value
	}
}

function handleProcessResult(process, reject, resolve) {
	const errors = [];
	process.onStderr((err) => {
		errors.push(err);
	});

	process.onDidExit((status) => {
		if (status === 0) {
			if (resolve) resolve();
			return
		}

		reject(new ProcessError(status, errors.join('\n')));
	});
}

const log = Object.fromEntries(
	['log', 'info', 'warn'].map((fn) => [
		fn,
		(...args) => {
			if (!nova.inDevMode() && !nova.config.get('prettier.debug.logging')) {
				return
			}
			console[fn](...args);
		},
	])
);

var helpers = {
	showError,
	showActionableError,
	log,
	getConfigWithWorkspaceOverride,
	ProcessError,
	handleProcessResult,
};

const { handleProcessResult: handleProcessResult$1, log: log$1 } = helpers;

async function findPrettier(directory) {
	let resolve, reject;
	const promise = new Promise((_resolve, _reject) => {
		resolve = _resolve;
		reject = _reject;
	});

	const process = new Process('/usr/bin/env', {
		args: ['npm', 'ls', 'prettier', '--parseable', '--long', '--depth', '0'],
		cwd: directory,
	});

	process.onStdout((result) => {
		if (!result || !result.trim()) return

		const [path, name, status, extra] = result.trim().split(':');
		if (!name || !name.startsWith('prettier@')) return resolve(null)
		if (path === nova.workspace.path) {
			log$1.info(
				`You seem to be working on Prettier! The extension doesn't work without Prettier built, so using the built-in Prettier instead.`
			);
			return resolve(null)
		}

		resolve({
			path,
			correctVersion: status !== 'INVALID' && extra !== 'MAXDEPTH',
		});
	});

	handleProcessResult$1(process, reject, resolve);
	process.start();

	return promise
}

async function installPrettier(directory) {
	let resolve, reject;
	const promise = new Promise((_resolve, _reject) => {
		resolve = _resolve;
		reject = _reject;
	});

	const process = new Process('/usr/bin/env', {
		args: ['npm', 'install', '--only-prod'],
		cwd: directory,
	});

	handleProcessResult$1(process, reject, resolve);
	process.start();

	return promise
}

var prettierInstallation = async function () {
	// Try finding in the workspace
	try {
		if (nova.workspace.path) {
			const resolved = await findPrettier(nova.workspace.path);
			if (resolved) {
				log$1.info(`Loading project prettier at ${resolved.path}`);
				return resolved.path
			}
		}
	} catch (err) {
		if (err.status === 127) throw err
		log$1.warn('Error trying to find workspace Prettier', err);
	}

	// Install / update bundled version
	try {
		const path = nova.path.join(nova.extension.path, 'node_modules', 'prettier');

		const resolved = await findPrettier(nova.extension.path);

		if (!resolved || !resolved.correctVersion) {
			log$1.info(`Installing / updating bundled Prettier at ${path}`);
			await installPrettier(nova.extension.path);
		}

		log$1.info(`Loading bundled prettier at ${path}`);
		return path
	} catch (err) {
		if (err.status === 127) throw err
		log$1.warn('Error trying to find or install bundled Prettier', err);
	}
};

const {
	showError: showError$1,
	showActionableError: showActionableError$1,
	log: log$2,
	getConfigWithWorkspaceOverride: getConfigWithWorkspaceOverride$1,
} = helpers;

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
];

class Formatter {
	constructor() {
		this.prettierServiceDidExit = this.prettierServiceDidExit.bind(this);

		this.emitter = new Emitter();

		this.setupIsReadyPromise();
	}

	get defaultConfig() {
		return Object.fromEntries(
			PRETTIER_OPTIONS.map((option) => [
				option,
				getConfigWithWorkspaceOverride$1(`prettier.default-config.${option}`),
			])
		)
	}

	get isReady() {
		if (!this._isReadyPromise) {
			this.showServiceNotRunningError();
			return false
		}

		return this._isReadyPromise
	}

	async start(modulePath) {
		if (modulePath) this.modulePath = modulePath;
		if (this.prettierService) return

		log$2.info('Starting Prettier service');

		if (!this._isReadyPromise) this.setupIsReadyPromise();

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
		});
		this.prettierService.onDidExit(this.prettierServiceDidExit);
		this.prettierService.onNotify('didStart', () => {
			this._resolveIsReadyPromise(true);
		});
		this.prettierService.start();
	}

	stop() {
		nova.notifications.cancel('prettier-not-running');
		if (!this._isReadyPromise) return

		log$2.info('Stopping Prettier service');

		this.prettierService.terminate();
		if (this._resolveIsReadyPromise) this._resolveIsReadyPromise(false);
		this._isReadyPromise = null;
		this.prettierService = null;
	}

	setupIsReadyPromise() {
		this._isReadyPromise = new Promise((resolve) => {
			this._resolveIsReadyPromise = resolve;
		});
	}

	prettierServiceDidExit(exitCode) {
		if (!this.prettierService) return

		console.error(`Prettier service exited with code ${exitCode}`);

		if (this._resolveIsReadyPromise) this._resolveIsReadyPromise(false);
		this._isReadyPromise = null;
		this.prettierService = null;

		if (this.prettierServiceCrashedRecently) {
			return this.showServiceNotRunningError()
		}

		this.prettierServiceCrashedRecently = true;
		setTimeout(() => (this.prettierServiceCrashedRecently = false), 5000);

		this.start();
	}

	showServiceNotRunningError() {
		showActionableError$1(
			'prettier-not-running',
			'Prettier stopped running',
			`Please report report an issue though Extension Library if this problem persits.`,
			['Restart Prettier'],
			(r) => {
				switch (r) {
					case 0:
						this.start();
						break
				}
			}
		);
	}

	async formatEditor(editor, saving, selectionOnly) {
		const { document } = editor;

		nova.notifications.cancel('prettier-unsupported-syntax');

		const pathForConfig = document.path || nova.workspace.path;

		const shouldApplyDefaultConfig = await this.shouldApplyDefaultConfig(
			document,
			saving,
			pathForConfig
		);

		if (shouldApplyDefaultConfig === null) return []

		log$2.info(`Formatting ${document.path}`);

		const documentRange = new Range(0, document.length);
		const original = editor.getTextInRange(documentRange);
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
		};

		const result = await this.prettierService.request('format', {
			original,
			pathForConfig,
			ignorePath: saving && this.getIgnorePath(pathForConfig),
			options,
		});

		const { formatted, error, ignored, missingParser } = result;

		if (error) {
			return this.issuesFromPrettierError(error)
		}

		if (ignored) {
			log$2.info(`Prettier is configured to ignore ${document.path}`);
			return []
		}

		if (missingParser) {
			if (!saving) {
				showError$1(
					'prettier-unsupported-syntax',
					`Syntax not supported`,
					`Prettier doesn't include a Parser for this file and no plugin is installed that does.`
				);
			}
			log$2.info(`No parser for ${document.path}`);
			return []
		}

		if (formatted === original) {
			log$2.info(`No changes for ${document.path}`);
			return []
		}

		await this.applyResult(editor, original, formatted);
	}

	async shouldApplyDefaultConfig(document, saving, pathForConfig) {
		// Don't format-on-save ignore syntaxes.
		if (
			saving &&
			nova.config.get(
				`prettier.format-on-save.ignored-syntaxes.${document.syntax}`
			) === true
		) {
			log$2.info(
				`Not formatting (${document.syntax} syntax ignored) ${document.path}`
			);
			return null
		}

		let hasConfig = false;

		if (document.isRemote) {
			// Don't format-on-save remote documents if they're ignored.
			if (
				saving &&
				getConfigWithWorkspaceOverride$1('prettier.format-on-save.ignore-remote')
			) {
				return null
			}
		} else {
			// Try to resolve configuration using Prettier for non-remote documents.
			hasConfig = await this.prettierService.request('hasConfig', {
				pathForConfig,
			});

			if (
				!hasConfig &&
				getConfigWithWorkspaceOverride$1(
					'prettier.format-on-save.ignore-without-config'
				)
			) {
				return null
			}
		}

		return !hasConfig
	}

	getIgnorePath(path) {
		const expectedIgnoreDir = nova.workspace.path || nova.path.dirname(path);
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
		const documentRange = new Range(0, editor.document.length);

		if (original !== editor.getTextInRange(documentRange)) {
			log$2.info(`Document ${editor.document.path} was changed while formatting`);
			return
		}

		log$2.info(`Applying formatted changes to ${editor.document.path}`);

		await editor.edit((e) => {
			e.replace(documentRange, formatted);
		});
	}

	issuesFromPrettierError(error) {
		// If the error doesn't have a message just ignore it.
		if (typeof error.message !== 'string') return []

		if (error.name === 'UndefinedParserError') throw error

		// See if it's a simple error
		let lineData = error.message.match(/\((\d+):(\d+)\)\n/m);
		// See if it's a visual error
		if (!lineData) {
			lineData = error.message.match(/^>\s*?(\d+)\s\|\s/m);
			if (lineData) {
				const columnData = error.message.match(/^\s+\|(\s+)\^+($|\n)/im);
				lineData[2] = columnData ? columnData[1].length + 1 : 0;
			}
		}

		if (!lineData) {
			throw error
		}

		const issue = new Issue();
		issue.message = error.stack
			? error.message
			: error.message.split(/\n\s*?at\s+/i)[0]; // When error is only a message it probably has the stack trace appended. Remove it.
		issue.severity = IssueSeverity.Error;
		issue.line = lineData[1];
		issue.column = lineData[2];

		return [issue]
	}
}

var formatter = {
	Formatter,
};

const { showError: showError$2, getConfigWithWorkspaceOverride: getConfigWithWorkspaceOverride$2 } = helpers;
const { Formatter: Formatter$1 } = formatter;

class PrettierExtension {
	constructor(modulePath, prettier, parsers) {
		this.didAddTextEditor = this.didAddTextEditor.bind(this);
		this.toggleFormatOnSave = this.toggleFormatOnSave.bind(this);
		this.editorWillSave = this.editorWillSave.bind(this);
		this.didInvokeFormatCommand = this.didInvokeFormatCommand.bind(this);
		this.didInvokeFormatSelectionCommand = this.didInvokeFormatSelectionCommand.bind(
			this
		);
		this.didInvokeSaveWithoutFormattingCommand = this.didInvokeSaveWithoutFormattingCommand.bind(
			this
		);

		this.modulePath = modulePath;
		this.prettier = prettier;
		this.parsers = parsers;

		this.saveListeners = new Map();
		this.ignoredEditors = new Set();
		this.issueCollection = new IssueCollection();
	}

	setupConfiguration() {
		nova.config.remove('prettier.use-compatibility-mode');

		nova.workspace.config.observe(
			'prettier.format-on-save',
			this.toggleFormatOnSave
		);
		nova.config.observe('prettier.format-on-save', this.toggleFormatOnSave);
	}

	async start() {
		this.setupConfiguration();
		nova.workspace.onDidAddTextEditor(this.didAddTextEditor);
		nova.commands.register('prettier.format', this.didInvokeFormatCommand);
		nova.commands.register(
			'prettier.format-selection',
			this.didInvokeFormatSelectionCommand
		);
		nova.commands.register(
			'prettier.save-without-formatting',
			this.didInvokeSaveWithoutFormattingCommand
		);

		this.formatter = new Formatter$1(this.modulePath);

		try {
			await this.startFormatter().catch(() =>
				new Promise((resolve) => setTimeout(resolve, 1000)).then(() =>
					this.startFormatter()
				)
			);
		} catch (err) {
			if (err.status !== 127) throw err

			return showError$2(
				'prettier-resolution-error',
				`Can't find npm and Prettier`,
				`Prettier couldn't be found because npm isn't available. Please make sure you have Node installed. If you've only installed Node through NVM, you'll need to change your shell configuration to work with Nova. See https://library.panic.com/nova/environment-variables/`
			)
		}
	}

	async startFormatter(e) {
		const path = await prettierInstallation();
		this.formatter.start(path);
	}

	toggleFormatOnSave() {
		this.enabled = getConfigWithWorkspaceOverride$2('prettier.format-on-save');

		if (this.enabled) {
			nova.workspace.textEditors.forEach(this.didAddTextEditor);
		} else {
			this.saveListeners.forEach((listener) => listener.dispose());
			this.saveListeners.clear();
		}
	}

	didAddTextEditor(editor) {
		if (!this.enabled) return

		if (this.saveListeners.has(editor)) return
		this.saveListeners.set(editor, editor.onWillSave(this.editorWillSave));
	}

	async editorWillSave(editor) {
		await this.formatEditor(editor, true, false);
	}

	async didInvokeFormatCommand(editor) {
		await this.formatEditor(editor, false, false);
	}

	async didInvokeFormatSelectionCommand(editor) {
		await this.formatEditor(editor, false, true);
	}

	async didInvokeSaveWithoutFormattingCommand(editor) {
		this.ignoredEditors.add(editor);
		editor.save().finally(() => this.ignoredEditors.delete(editor));
	}

	async formatEditor(editor, isSaving, selectionOnly) {
		if (this.ignoredEditors.has(editor)) return

		try {
			const ready = await this.formatter.isReady;
			if (!ready) return

			const issues = await this.formatter.formatEditor(
				editor,
				isSaving,
				selectionOnly
			);
			this.issueCollection.set(editor.document.uri, issues);
		} catch (err) {
			console.error(err, err.stack);
			showError$2(
				'prettier-format-error',
				`Error while formatting`,
				`"${err.message}" occurred while formatting ${editor.document.path}. See the extension console for more info.`
			);
		}
	}
}

var activate = async function () {
	try {
		const extension = new PrettierExtension();
		await extension.start();
	} catch (err) {
		console.error('Unable to set up prettier service', err, err.stack);

		return showError$2(
			'prettier-resolution-error',
			`Unable to start Prettier`,
			`Please check the extension console for additional logs.`
		)
	}
};

var deactivate = function () {
	// Clean up state before the extension is deactivated
};

var main = {
	activate: activate,
	deactivate: deactivate
};

exports.activate = activate;
exports.deactivate = deactivate;
exports.default = main;
