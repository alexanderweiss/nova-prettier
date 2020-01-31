const prettier = require('../node_modules/prettier')

// Resolve config using "normal" Prettier and log it.
;(async () => {
	const path = process.argv[2]
	const config = await prettier.resolveConfig(path)

	console.log(JSON.stringify(config))
})()

