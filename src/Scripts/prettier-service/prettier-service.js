const JsonRpcService = require('./json-rpc.js')

class FormattingService {
	constructor(jsonRpc) {
		this.format = this.format.bind(this)
		this.hasConfig = this.hasConfig.bind(this)

		this.jsonRpc = jsonRpc

		this.jsonRpc.onRequest('format', this.format)
		this.jsonRpc.onRequest('hasConfig', this.hasConfig)
		this.jsonRpc.notify('didStart')
	}

	async format({ original, pathForConfig, ignorePath, options }) {
		throw new Error('Implementation missing')
	}

	async hasConfig({ pathForConfig }) {
		throw new Error('Implementation missing')
	}
}

class PrettierService extends FormattingService {
	static isCorrectModule(module) {
		return (
			typeof module.format === 'function' &&
			typeof module.getFileInfo === 'function' &&
			typeof module.resolveConfig === 'function'
		)
	}

	constructor(jsonRpc, prettier) {
		super(jsonRpc)

		this.prettier = prettier
	}

	resolvePluginPaths = (plugins, workspacePath) => {
		const nodeModulesDirectory = `${workspacePath}/node_modules`
		const resolved = plugins.map(
			(plugin) => `${nodeModulesDirectory}/${plugin}`
		)
		return resolved
	}

	async format({
		original,
		pathForConfig,
		ignorePath,
		options,
		workspacePath,
	}) {
		const { ignored, parser, config } = await this.getConfig({
			pathForConfig,
			ignorePath,
			options,
		})

		if (ignored) return { ignored: true }
		if (!parser) return { missingParser: true }

		if (Object.keys(config).includes('plugins')) {
			const plugins = this.resolvePluginPaths(config.plugins, workspacePath)
			//clone config and delete plugins
			const configClone = { ...config }
			delete configClone.plugins
			const resolvedConfig = { ...configClone, plugins }
			const formatted = this.prettier.format(original, resolvedConfig)
			return { formatted }
		}

		const formatted = this.prettier.format(original, config)

		return { formatted }
	}

	async hasConfig({ pathForConfig }) {
		const config = await this.prettier.resolveConfig(pathForConfig)
		return config !== null
	}

	async getConfig({ pathForConfig, ignorePath, options }) {
		let info = {}
		if (options.filepath) {
			info = await this.prettier.getFileInfo(options.filepath, {
				ignorePath,
				withNodeModules: false,
			})

			// Don't format if this file is ignored
			if (info.ignored) return { ignored: true }
		}

		const inferredConfig = await this.prettier.resolveConfig(pathForConfig, {
			editorconfig: true,
		})
		const config = { ...options, ...inferredConfig }

		return {
			ignored: false,
			parser: config.parser || info.inferredParser,
			config,
		}
	}
}

class PrettierEslintService extends FormattingService {
	static isCorrectModule(module) {
		return typeof module === 'function'
	}

	constructor(jsonRpc, format) {
		super(jsonRpc)

		this.format = format
	}

	async format({ original, pathForConfig, ignorePath, options }) {
		const formatted = this.format({
			text: original,
			fallbackPrettierOptions: options,
		})
		return { formatted }
	}

	async hasConfig({ pathForConfig }) {
		return false
	}
}

const jsonRpcService = new JsonRpcService(process.stdin, process.stdout)
const [, , modulePath] = process.argv

try {
	const module = require(modulePath)
	if (
		modulePath.includes('prettier-eslint') &&
		PrettierEslintService.isCorrectModule(module)
	) {
		new PrettierEslintService(jsonRpcService, module)
	} else if (PrettierService.isCorrectModule(module)) {
		new PrettierService(jsonRpcService, module)
	} else {
		throw new Error(
			`Module at ${modulePath} does not appear to be prettier or prettier-eslint`
		)
	}
} catch (err) {
	jsonRpcService.notify('startDidFail', {
		name: err.name,
		message: err.message,
		stack: err.stack,
	})
	process.exit()
}
