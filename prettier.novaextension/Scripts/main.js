'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var prettier = _interopDefault(require('./prettier.js'));

/** Class for managing external NPM module executables in Nova extensions */
var NPMExecutable_1 = class NPMExecutable
{
	/**
	 * @param {string} binName - The name of the executable found in `node_modules/.bin`
	 */
	constructor( binName )
	{
		this.binName = binName;
		this.PATH = null;
	}

	/**
	 * Install NPM dependencies inside the extension bundle.
	 *
	 * @return {Promise}
	 */
	install()
	{
		let pathPackage = nova.path.join( nova.extension.path, "package.json" );
		if( !nova.fs.access( pathPackage, nova.fs.F_OK ) )
		{
			return Promise.reject( `No such file "${pathPackage}"` );
		}

		return new Promise( (resolve, reject) =>
		{
			let options = {
				args: ["npm", "install", "--only=prod"],
				cwd: nova.extension.path,
			};

			let npm = new Process( "/usr/bin/env", options );
			let errorLines = [];
			npm.onStderr( line => errorLines.push( line.trimRight() ) );
			npm.onDidExit( status =>
			{
				status === 0 ? resolve() : reject( new Error( errorLines.join( "\n" ) ) );
			});

			npm.start();
		})
	}

	/**
	 * Whether the module has been installed inside the extension bundle.
	 *
	 * NOTE: This is unrelated to whether the module has been installed globally
	 * or locally to a given project.
	 *
	 * @return {Boolean}
	 */
	get isInstalled()
	{
		let pathBin = nova.path.join( nova.extension.path, "node_modules/.bin/", this.binName );
		return nova.fs.access( pathBin, nova.fs.F_OK );
	}

	/**
	 * Helper function for instantiating Process object with options needed to
	 * run the module executable using `npx`.
	 *
	 * @param {Object} processOptions
	 * @param {[string]} [processOptions.args]
	 * @param {string} [processOptions.cwd]
	 * @param {Object} [processOptions.env]
	 * @param {string|boolean} [processOptions.shell]
	 * @param {[string]} [processOptions.stdio]
	 * @see {@link https://novadocs.panic.com/api-reference/process}
	 * @return {Promise<Process>}
	 */
	async process( { args=[], cwd, env={}, shell=true, stdio } )
	{
		let options = {
			args: ["npx", this.binName].concat( args ),
			cwd: cwd || nova.extension.path,
			env: env,
			shell: shell,
		};

		if( stdio )
		{
			options.stdio = stdio;
		}

		if( this.PATH === null )
		{
			// Environment.environment added in 1.0b8
			if( nova.environment && nova.environment.PATH )
			{
				this.PATH = nova.environment.PATH;
			}
			else
			{
				this.PATH = await getEnv( "PATH" );
			}
		}

		/* The current workspace path (if any) and the extension's path are
		 * added to the user's $PATH, creating a preferential cascade of
		 * possible executable locations:
		 *
		 *   Current Workspace > Global Installation > Extension Fallback
		 */
		let paths = [];
		if( nova.workspace.path )
		{
			paths.push( nova.workspace.path );
		}
		paths.push( this.PATH );
		paths.push( nova.extension.path );

		options.env.PATH = paths.join( ":" );

		return new Process( "/usr/bin/env", options );
	}
};

/**
 * Helper function for fetching variables from the user's environment
 *
 * @param {string} key
 * @return {Promise<string>}
 */
function getEnv( key )
{
	return new Promise( resolve =>
	{
		let env = new Process( "/usr/bin/env", { shell: true } );

		env.onStdout( line =>
		{
			if( line.indexOf( key ) === 0 )
			{
				resolve( line.trimRight().split( "=" )[1] );
			}
		});

		env.onDidExit( () => resolve() );

		env.start();
	});
}

var npmExecutable = {
	NPMExecutable: NPMExecutable_1
};

const { NPMExecutable } = npmExecutable;

// TODO: Duplicate code in ./prettier.js (except onStdout handler)
async function checkPrettierVersion() {
	let resolve, reject;
	const promise = new Promise((_resolve, _reject) => {
		resolve = _resolve;
		reject = _reject;
	});

	const process = new Process('/usr/bin/env', {
		args: ['npm', 'll', 'prettier', '--parseable'],
		cwd: nova.extension.path,
	});

	process.onStdout((result) => {
		if (!result) return resolve(null)

		const [_, name, status] = result.split(':');
		if (!name.startsWith('prettier@')) return resolve(false)
		if (status === 'INVALID') return resolve(false)
		resolve(true);
	});

	const errors = [];
	process.onStderr((err) => {
		errors.push(err);
	});

	process.onDidExit((status) => {
		if (status === '0') return
		reject(errors.join('\n'));
	});

	process.start();

	return promise
}

var install = async () => {
	try {
		const prettier = new NPMExecutable('prettier');
		if (!prettier.isInstalled) {
			console.log('Extension prettier not installed, installing');
			await prettier.install();
		} else if (!(await checkPrettierVersion())) {
			console.log('Extension prettier out of date, updating/installing');
			await prettier.install();
		}
	} catch (err) {
		console.error('Unable to find or install prettier', err, err.stack);
	}
};

class FormattingService {
	constructor(modulePath, prettier, parsers) {
		this.modulePath = modulePath;
		this.prettier = prettier;
		this.parsers = parsers;

		this.didAddTextEditor = this.didAddTextEditor.bind(this);
		this.toggleFormatOnSave = this.toggleFormatOnSave.bind(this);
		this.prettierServiceDidExit = this.prettierServiceDidExit.bind(this);
		this.editorWillSave = this.editorWillSave.bind(this);
		this.didInvokeFormatCommand = this.didInvokeFormatCommand.bind(this);

		this.saveListeners = new Map();
		this.issueCollection = new IssueCollection();
		this.configs = new Map();
		this.formattedText = new Map();

		this.setupConfiguration();
		nova.workspace.onDidAddTextEditor(this.didAddTextEditor);
	}

	setupConfiguration() {
		nova.workspace.config.observe(
			'prettier.format-on-save',
			this.toggleFormatOnSave
		);
		nova.config.observe('prettier.format-on-save', this.toggleFormatOnSave);
		nova.config.observe('prettier.experimental.prettier-service', (enabled) => {
			if (enabled) {
				this.startPrettierService();
			} else {
				this.stopPrettierService();
			}
		});
	}

	startPrettierService() {
		if (this.prettierService) return

		console.log('Starting Prettier service');

		this.prettierService = new Process('/usr/bin/env', {
			args: [
				'node',
				nova.path.join(nova.extension.path, 'Scripts', 'prettier-service.js'),
				this.modulePath,
			],
			stdio: 'jsonrpc',
		});
		this.prettierService.onDidExit(this.prettierServiceDidExit);
		this.prettierService.start();
	}

	stopPrettierService() {
		if (!this.prettierService) return

		console.log('Stopping Prettier service');

		this.prettierService.terminate();
		this.prettierService = null;
	}

	prettierServiceDidExit(exitCode) {
		if (!this.prettierService) return

		console.error(`Prettier service exited with code ${exitCode}`);

		this.prettierService = null;

		if (this.prettierServiceCrashedRecently) {
			showActionableError(
				'prettier-service-frequent-crashes-error',
				'Prettier stopped working twice',
				'There may be a problem. To try restarting it again, choose Restart. If the problem persist, check the Extension Console for more info or report an issue through the Extension Library.',
				'Restart',
				(r) => r && this.startPrettierService()
			);
			return
		}

		this.prettierServiceCrashedRecently = true;
		setTimeout(() => (this.prettierServiceCrashedRecently = false), 5000);

		this.startPrettierService();
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
				);
				return true
			case false:
				nova.workspace.config.set(
					'prettier.format-on-save',
					nova.config.get('prettier.format-on-save') === false
						? 'Global Default'
						: 'Disable'
				);
				return false
			// No preference -> "Global default"
			default:
				return null
		}
	}

	toggleFormatOnSave() {
		const workspaceConfig = this.getFormatOnSaveWorkspaceConfig();
		const extensionConfig = nova.config.get('prettier.format-on-save');
		if (workspaceConfig !== null) {
			this.enabled = workspaceConfig;
		} else if (extensionConfig !== null) {
			this.enabled = extensionConfig;
		} else {
			this.enabled = true;
		}

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
		this.format(editor, true);
	}

	async didInvokeFormatCommand(editor) {
		this.format(editor);
	}

	async format(editor, saving) {
		const { document } = editor;

		const documentRange = new Range(0, document.length);
		const text = editor.getTextInRange(documentRange);

		// Skip formatting if the current text matches a saved formatted version
		const previouslyFormattedText = this.formattedText.get(editor);
		if (previouslyFormattedText) {
			this.formattedText.delete(editor);
			if (previouslyFormattedText === text) return
		}

		const params = {
			text,
			pathForConfig: document.path || nova.workspace.path,
			ignorePath: this.getIgnorePath(document.path),
			syntax: document.syntax,
			options: {
				...(document.path
					? { filepath: document.path }
					: { parser: this.parserForSyntax(syntax) }),
				cursorOffset: editor.selectedRange.end,
			},
		};

		this.issueCollection.set(document.uri, []);

		// Resolve config if we know a path to check
		let result;
		let error;
		try {
			// TODO: Add a timeout
			result = this.prettierService
				? await this.prettierService.request('format', params)
				: await this.formatLegacy(params);
			if (result.error) error = result.error;
		} catch (err) {
			error = err;
		}

		if (!result) return

		if (error) {
			const name = error.name || error.constructor.name;
			if (name === 'UndefinedParserError') return

			// See if it's a proper syntax error.
			const lineData = error.message.match(/\((\d+):(\d+)\)\n/m);
			if (!lineData) {
				console.error(error, error.stack);
				return
			}

			const issue = new Issue();
			issue.message = error.message;
			issue.severity = IssueSeverity.Error;
			issue.line = lineData[1];
			issue.column = lineData[2];

			this.issueCollection.set(document.uri, [issue]);
			return
		}

		const { formatted, cursorOffset } = result;
		if (formatted === text) return

		editor
			.edit((e) => {
				e.replace(documentRange, formatted);
				editor.selectedRanges = [new Range(cursorOffset, cursorOffset)];
			})
			.then(() => {
				// Nothing to do if the doc isn't getting saved.
				if (!saving) return

				if (!document.isDirty) return
				if (document.isClosed) return
				if (document.isUntitled) return

				const documentRange = new Range(0, document.length);
				const text = editor.getTextInRange(documentRange);
				if (formatted !== text) return

				// Our changes weren't included in the save because it took too
				// long. Save it once more but skip formatting for that save.
				this.formattedText.set(editor, formatted);
				editor.save();
			})
			.catch((err) => console.error(err, err.stack));
	}

	async formatLegacy({ text, syntax, pathForConfig, options }) {
		let config = {};
		let info = {};

		// Don't handle PHP syntax. Required because Nova considers PHP a
		// sub-syntax of HTML and enables the command.
		if (syntax === 'php') return null

		if (pathForConfig) {
			try {
				;({ config, info } = await this.getConfigForPath(pathForConfig));
			} catch (err) {
				console.warn(
					`Unable to get config for ${document.path}: ${err}`,
					err.stack
				);
				this.showConfigResolutionError(pathForConfig);
			}
		}

		if (options.filepath && info.ignored === true) return null

		return this.prettier.formatWithCursor(text, {
			...config,
			...options,
			plugins: this.parsers,
		})
	}

	getIgnorePath(path) {
		const expectedIgnoreDir = nova.workspace.path || nova.path.dirname(path);
		return nova.path.join(expectedIgnoreDir, '.prettierignore')
	}

	async getConfigForPath(path) {
		// TODO: Invalidate cache at some point?
		if (this.configs.has(path)) return this.configs.get(path)

		const config = await this.resolveConfigForPath(path);
		this.configs.set(path, config);

		return config
	}

	async resolveConfigForPath(path) {
		let resolve, reject;
		const promise = new Promise((_resolve, _reject) => {
			resolve = _resolve;
			reject = _reject;
		});

		const process = new Process('/usr/bin/env', {
			args: [
				'node',
				nova.path.join(nova.extension.path, 'Scripts', 'config.js'),
				this.modulePath,
				this.getIgnorePath(path),
				path,
			],
		});

		const errors = [];

		process.onStdout((result) => {
			try {
				resolve(JSON.parse(result));
			} catch (err) {
				reject(err);
			}
		});
		process.onStderr((err) => {
			errors.push(err);
		});
		process.onDidExit((status) => {
			if (status === '0') return
			reject(errors.join('\n'));
		});
		process.start();

		return promise
	}

	showConfigResolutionError(path) {
		showError(
			'prettier-config-resolution-error',
			'Failed to resolve Prettier configuration',
			`File to be formatted: ${path}`
		);
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

function showError(id, title, body) {
	let request = new NotificationRequest(id);

	request.title = nova.localize(title);
	request.body = nova.localize(body);
	request.actions = [nova.localize('OK')];

	nova.notifications.add(request).catch((err) => console.error(err, err.stack));
}

function showActionableError(id, title, body, action, callback) {
	let request = new NotificationRequest(id);

	request.title = nova.localize(title);
	request.body = nova.localize(body);
	request.actions = [nova.localize('Ignore'), nova.localize(action)];

	nova.notifications
		.add(request)
		.then((response) => callback(response.actionIdx === 1))
		.catch((err) => console.error(err, err.stack));
}

var activate = async function () {
	try {
		await install();
		const { modulePath, prettier: prettier$1, parsers } = await prettier();

		const formattingService = new FormattingService(
			modulePath,
			prettier$1,
			parsers
		);
		nova.commands.register(
			'prettier.format',
			formattingService.didInvokeFormatCommand
		);
	} catch (err) {
		console.error('Unable to set up prettier service', err, err.stack);

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
