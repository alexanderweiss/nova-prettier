const JsonRpcService = require('./json-rpc.js')

class PrettierService {
	constructor() {
		this.format = this.format.bind(this)
		this.hasConfig = this.hasConfig.bind(this)

		const [, , prettierPath] = process.argv
		this.prettier = require(prettierPath)

		this.jsonRpc = new JsonRpcService(process.stdin, process.stdout)
		this.jsonRpc.onRequest('format', this.format)
		this.jsonRpc.onRequest('hasConfig', this.hasConfig)
		this.jsonRpc.notify('didStart')
	}

	async format({ text, pathForConfig, ignorePath, options }) {
		try {
			const { ignored, parser, config } = await this.getConfig({
				pathForConfig,
				ignorePath,
				options,
			})

			if (ignored || !parser) return null

			const formatted = this.prettier.format(text, config)

			return { formatted }
		} catch (err) {
			return this.buildErrorResult(err)
		}
	}

	async hasConfig({ pathForConfig }) {
		try {
			const config = await this.prettier.resolveConfig(pathForConfig)
			return config !== null
		} catch (err) {
			return this.buildErrorResult(err)
		}
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

	buildErrorResult(err) {
		// Return error as object; JSON-RPC errors don't work well.
		return {
			error: {
				name: err.name,
				message: err.message,
				stack: err.stack,
			},
		}
	}
}

const server = new PrettierService()
