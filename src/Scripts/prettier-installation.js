const { handleProcessResult, log } = require('./helpers.js')

async function findPrettier(directory) {
	let resolve, reject
	const promise = new Promise((_resolve, _reject) => {
		resolve = _resolve
		reject = _reject
	})

	const process = new Process('/usr/bin/env', {
		args: ['npm', 'll', 'prettier', '--parseable', '--depth', '0'],
		cwd: directory,
	})

	process.onStdout((result) => {
		if (!result) return resolve(null)

		const [path, name, status, extra] = result.trim().split(':')
		if (!name || !name.startsWith('prettier@')) return resolve(null)
		if (path === nova.workspace.path) {
			log.info(
				`You seem to be working on Prettier! The extension doesn't work without Prettier built, so using the built-in Prettier instead.`
			)
			return resolve(null)
		}

		resolve({
			path,
			correctVersion: status !== 'INVALID' && extra !== 'MAXDEPTH',
		})
	})

	handleProcessResult(process, reject)
	process.start()

	return promise
}

async function installPrettier(directory) {
	let resolve, reject
	const promise = new Promise((_resolve, _reject) => {
		resolve = _resolve
		reject = _reject
	})

	const process = new Process('/usr/bin/env', {
		args: ['npm', 'install', '--only-prod'],
		cwd: directory,
	})

	handleProcessResult(process, reject, resolve)
	process.start()

	return promise
}

module.exports = async function () {
	// Try finding in the workspace
	try {
		const resolved = await findPrettier(nova.workspace.path)
		if (resolved) {
			log.info(`Loading project prettier at ${resolved.path}`)
			return resolved.path
		}
	} catch (err) {
		if (err.status === 127) throw err
		log.warn('Error trying to find workspace Prettier', err)
	}

	// Install / update bundled version
	try {
		const path = nova.path.join(nova.extension.path, 'node_modules', 'prettier')

		const resolved = await findPrettier(nova.extension.path)

		if (!resolved || !resolved.correctVersion) {
			log.info(`Installing / updating bundled Prettier at ${path}`)
			await installPrettier(nova.extension.path)
		}

		log.info(`Loading bundled prettier at ${path}`)
		return path
	} catch (err) {
		if (err.status === 127) throw err
		log.warn('Error trying to find or install bundled Prettier', err)
	}
}
