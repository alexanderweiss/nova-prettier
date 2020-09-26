const JsonRpcService = require('./json-rpc.js')
const fs = require('fs')

class PrettierService {
	constructor() {
		const [, , prettierPath] = process.argv
		this.prettier = require(prettierPath)

		this.jsonRpc = new JsonRpcService(process.stdin, process.stdout)

		this.jsonRpc.onRequest('format', this.format)
	}

	format = async ({ text, pathForConfig, syntax, options }) => {
		try {
			const config = await this.prettier.resolveConfig(pathForConfig)
			const info = await this.prettier.getFileInfo(pathForConfig)
			return this.prettier.formatWithCursor(text, {
				...config,
				...options,
			})
		} catch (error) {
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
