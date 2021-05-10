const JsonRpcService = require('./json-rpc.js')

class PrettierService {
	constructor() {
		this.format = this.format.bind(this)
		this.hasConfig = this.hasConfig.bind(this)

		this.jsonRpc = new JsonRpcService(process.stdin, process.stdout)

		const [, , prettierPath] = process.argv
		try {
			this.prettier = require(prettierPath)
		} catch (err) {
			this.jsonRpc.notify('startDidFail', { reason: 'moduleNotLoaded' })
		}

		if (!this.prettier.getFileInfo || !this.prettier.format || !this.prettier.resolveConfig) {
			this.jsonRpc.notify('startDidFail', { reason: 'moduleNotPrettier' })
		}

		this.jsonRpc.onRequest('format', this.format)
		this.jsonRpc.onRequest('hasConfig', this.hasConfig)
		this.jsonRpc.notify('didStart')
	}

	async format({ original, pathForConfig, ignorePath, options }) {
		try {
			const { ignored, parser, config } = await this.getConfig({
				pathForConfig,
				ignorePath,
				options,
			})

			if (ignored) return { ignored: true }
			if (!parser) return { missingParser: true }

			const formatted = this.prettier.format(original, config)

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

		// Some plugins don't return error objects but strings.
		if (typeof err === 'string') return { error: { message: err } }

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
