const JsonRpcService = require('./json-rpc.js')
const fs = require('fs')

class PrettierService {
	constructor() {
		const [, , prettierPath] = process.argv
		this.prettier = require(prettierPath)

		this.jsonRpc = new JsonRpcService(process.stdin, process.stdout)
		this.jsonRpc.onRequest('format', this.format)
	}

	format = async ({ text, pathForConfig, ignorePath, syntax, options }) => {
		try {
			// Don't format if this file is ignored
			const info = await this.prettier.getFileInfo(pathForConfig, {
				ignorePath,
				withNodeModules: false,
			})
			if (info.ignored) return null

			const config = await this.prettier.resolveConfig(pathForConfig)

			return this.prettier.formatWithCursor(text, {
				...config,
				...options,
			})
		} catch (error) {
			// Return error as object; JSON-RPC errors don't work well.
			return {
				error: {
					name: error.constructor.name,
					message: error.message,
					stack: error.stack,
				},
			}
		}
	}
}

const server = new PrettierService()
