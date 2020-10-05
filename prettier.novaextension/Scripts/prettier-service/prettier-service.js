'use strict';

const JsonRpcService = require('./json-rpc.js');

class PrettierService {
	constructor() {
		this.format = this.format.bind(this);

		const [, , prettierPath] = process.argv;
		this.prettier = require(prettierPath);

		this.jsonRpc = new JsonRpcService(process.stdin, process.stdout);
		this.jsonRpc.onRequest('format', this.format);
		this.jsonRpc.notify('didStart');
	}

	async format({ text, pathForConfig, ignorePath, options }) {
		try {
			// Don't format if this file is ignored
			const info = await this.prettier.getFileInfo(pathForConfig, {
				ignorePath,
				withNodeModules: false,
			});
			if (info.ignored) return null

			const config = await this.prettier.resolveConfig(pathForConfig);

			if (!options.parser && !info.inferredParser) return null

			const formatted = this.prettier.format(text, {
				...config,
				...options,
			});

			return { formatted }
		} catch (error) {
			// Return error as object; JSON-RPC errors don't work well.
			return {
				error: {
					name: error.name,
					message: error.message,
					stack: error.stack,
				},
			}
		}
	}
}

const server = new PrettierService();
