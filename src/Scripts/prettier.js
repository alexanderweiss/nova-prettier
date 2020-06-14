let loaded

async function findPrettier() {
	let resolve, reject
	const promise = new Promise((_resolve, _reject) => {
		resolve = _resolve
		reject = _reject
	})

	const process = new Process('/usr/bin/env', {
		args: ['npm', 'll', 'prettier', '--parseable'],
		cwd: nova.workspace.path,
	})

	process.onStdout((result) => {
		if (!result) resolve(null)

		const [path, name] = result.split(':')
		if (!name.startsWith('prettier@')) resolve(null)

		resolve(path)
	})
	
	const errors = []
	process.onStderr((err) => {
		errors.push(err)
	})
	
	process.onDidExit((status) => {
		if (status === '0') return
		reject(errors.join('\n'))
	})
	
	process.start()

	return promise
}

function relativePath(path) {
	if (!path) return
	return nova.path.join(
		...nova.path.split(nova.extension.path).map(() => '..'),
		path
	)
}

module.exports = async function () {
	if (loaded) return loaded

	let workspaceModulePath
	try {
		workspaceModulePath = await findPrettier()
	} catch (err) {
		console.warn('Error trying to find workspace Prettier', err)
	}

	const modulePath = workspaceModulePath
		? relativePath(workspaceModulePath)
		: '../node_modules/prettier'

	console.log(
		`Using prettier from ${modulePath} (extension located at: ${nova.extension.path})`
	)

	loaded = {
		modulePath,
		prettier: require(nova.path.join(modulePath, 'standalone.js')),
		parsers: {
			angularParser: require(nova.path.join(modulePath, 'parser-angular.js')),
			babelParser: require(nova.path.join(modulePath, 'parser-babel.js')),
			flowParser: require(nova.path.join(modulePath, 'parser-flow.js')),
			glimmerParser: require(nova.path.join(modulePath, 'parser-glimmer.js')),
			graphqlParser: require(nova.path.join(modulePath, 'parser-graphql.js')),
			htmlParser: require(nova.path.join(modulePath, 'parser-html.js')),
			markdownParser: require(nova.path.join(modulePath, 'parser-markdown.js')),
			postcssParser: require(nova.path.join(modulePath, 'parser-postcss.js')),
			typescriptParser: require(nova.path.join(
				modulePath,
				'parser-typescript.js'
			)),
			yamlParser: require(nova.path.join(modulePath, 'parser-yaml.js')),
		},
	}

	return loaded
}
