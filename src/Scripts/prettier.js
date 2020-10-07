let loaded

class ProcessError extends Error {
	constructor(status, message) {
		super(message)
		this.status = status
	}
}

async function findPrettier() {
	let resolve, reject
	const promise = new Promise((_resolve, _reject) => {
		resolve = _resolve
		reject = _reject
	})

	const process = new Process('/usr/bin/env', {
		args: ['npm', 'll', 'prettier', '--parseable', '--depth', '0'],
		cwd: nova.workspace.path,
	})

	process.onStdout((result) => {
		if (!result) return resolve(null)

		const [path, name] = result.split(':')
		if (!name.startsWith('prettier@')) return resolve(null)
		if (path === nova.workspace.path) {
			console.log(
				`You seem to be working on Prettier! The extension doesn't work without Prettier built, so using the built-in Prettier instead.`
			)
			return resolve(null)
		}

		resolve(path)
	})

	const errors = []
	process.onStderr((err) => {
		errors.push(err)
	})

	process.onDidExit((status) => {
		if (status === '0') return
		reject(new ProcessError(status, errors.join('\n')))
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

function load(modulePath) {
	return {
		modulePath,
		prettier: require(relativePath(
			nova.path.join(modulePath, 'standalone.js')
		)),
		parsers: [
			...nova.fs
				.listdir(modulePath)
				.filter((p) => p.match(/^parser-.*?\.js$/))
				.map((p) => require(relativePath(nova.path.join(modulePath, p)))),
		],
	}
}

module.exports = async function () {
	if (loaded) return loaded

	let workspaceModulePath
	try {
		workspaceModulePath = await findPrettier()
	} catch (err) {
		if (err.status === 127) throw err
		console.warn('Error trying to find workspace Prettier', err)
	}

	if (workspaceModulePath) {
		try {
			console.log(`Loading project prettier at ${workspaceModulePath}`)
			loaded = load(workspaceModulePath)
		} catch (err) {
			console.warn(`Couldn't load project prettier: ${err}`, err.stack)
		}
	}

	if (!loaded) {
		const extensionModulePath = nova.path.join(
			nova.extension.path,
			'node_modules',
			'prettier'
		)
		console.log(`Loading bundled prettier at ${extensionModulePath}`)
		loaded = load(extensionModulePath)
	}

	return loaded
}
