const JsonRpcService = require('./json-rpc.js')
const fs = require('fs')

class PrettierService {
	constructor() {
		const [, , prettierPath] = process.argv
		this.prettier = require(prettierPath)
		this.process = this.process.bind(this)
		this.jsonRpc = new JsonRpcService(
			process.stdin,
			process.stdout,
			this.process
		)
	}

	async process(method, { text, pathForConfig, syntax, options }) {
		const config = await this.prettier.resolveConfig(pathForConfig)
		const info = await this.prettier.getFileInfo(pathForConfig)
		return this.prettier.formatWithCursor(text, {
			...config,
			...options,
		})
	}
}

const server = new PrettierService()
