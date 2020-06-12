'use strict';

const prettier = require('../node_modules/prettier')

// Resolve config using "normal" Prettier and log it.
;(async () => {
	const [, , ignorePath, filePath] = process.argv;
	const config = await prettier.resolveConfig(filePath);
	const info = await prettier.getFileInfo(filePath, {
		ignorePath,
		withNodeModules: false,
	});

	console.log(JSON.stringify({ config, info }, null, null));
})();
