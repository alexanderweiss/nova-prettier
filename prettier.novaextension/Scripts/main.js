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

var install = async () => {
	try {
		const prettier = new NPMExecutable('prettier');
		if (!prettier.isInstalled) {
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
		this.format = this.format.bind(this);

		this.saveListeners = new Map();
		this.issueCollection = new IssueCollection();
		this.configs = new Map();

		nova.workspace.config.observe(
			'prettier.format-on-save',
			this.toggleFormatOnSave
		);
		this.toggleFormatOnSave(
			nova.workspace.config.get('prettier.format-on-save')
		);
	}

	toggleFormatOnSave(enabled) {
		if (enabled) {
			nova.workspace.textEditors.forEach(this.didAddTextEditor);
			this.onDidAddTextEditorListener = nova.workspace.onDidAddTextEditor(
				this.didAddTextEditor
			);
		} else {
			if (this.onDidAddTextEditorListener)
				this.onDidAddTextEditorListener.dispose();
			this.saveListeners.forEach((listener) => listener.dispose());
			this.saveListeners.clear();
		}
	}

	didAddTextEditor(editor) {
		if (this.saveListeners.has(editor)) return
		this.saveListeners.set(editor, editor.onWillSave(this.format));
	}

	async format(editor) {
		const { document } = editor;

		let config, info;
		try {
			;({ config, info } = await this.getConfigForPath(
				document.path || nova.workspace.path
			));
		} catch (err) {
			console.warn(`Unable to get config for ${document.path}: ${err}`);
			this.showConfigResolutionError(document.path);
		}

		if (document.path && info.ignored === true) return

		const documentRange = new Range(0, document.length);
		this.issueCollection.set(document.uri, []);

		await editor.edit((e) => {
			const text = editor.getTextInRange(documentRange);

			try {
				const { formatted, cursorOffset } = this.prettier.formatWithCursor(
					text,
					{
						...config,
						...(document.path
							? { filepath: document.path }
							: { parser: this.parserForSyntax(document.syntax) }),
						cursorOffset: editor.selectedRange.end,
						plugins: this.parsers,
					}
				);

				if (formatted === text) return
				e.replace(documentRange, formatted);
				editor.selectedRanges = [new Range(cursorOffset, cursorOffset)];
			} catch (err) {
				if (err.constructor.name === 'UndefinedParserError') return
				
				// See if it's a proper syntax error.
				const lineData = err.message.match(/\((\d+):(\d+)\)\n/m);
				if (!lineData) {
					console.error(err, err.stack);
					return
				}
				
				const issue = new Issue();
				issue.message = err.message;
				issue.severity = IssueSeverity.Error;
				issue.line = lineData[1];
				issue.column = lineData[2];

				this.issueCollection.set(document.uri, [issue]);
			}
		});
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
				nova.path.join(nova.workspace.path, '.prettierignore'),
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

var activate = async function () {
	try {
		await install();
		const { modulePath, prettier: prettier$1, parsers } = await prettier();

		const formattingService = new FormattingService(
			modulePath,
			prettier$1,
			parsers
		);
		nova.commands.register('prettier.format', formattingService.format);
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
