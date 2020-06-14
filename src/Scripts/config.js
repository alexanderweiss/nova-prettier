const path = require('path')

// Resolve config using "normal" Prettier and log it.
;(async () => {
	const [, , modulePath, ignorePath, filePath] = process.argv
	const prettier = require(path.join(modulePath))
	const config = await prettier.resolveConfig(filePath)
	const info = await prettier.getFileInfo(filePath, {
		ignorePath,
		withNodeModules: false,
	})

	console.log(JSON.stringify({ config, info }, null, null))
})()
