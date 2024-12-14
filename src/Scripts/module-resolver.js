const { handleProcessResult, log } = require('./helpers.js')

function findPathRecursively(directory, subPath, callback) {
	while (true) {
		const path = nova.path.join(directory, subPath)
		const stats = nova.fs.stat(path)
		if (stats) {
			const result = callback(path, stats)
			if (result) return { directory, path }
		}

		if (directory === '/') break
		directory = nova.path.dirname(directory)
	}

	return null
}

function findModuleWithFileSystem(directory, module) {
	// Find the first parent folder with package.json that contains prettier
	const packageResult = findPathRecursively(
		directory,
		'package.json',
		(path, stats) => {
			if (!stats.isFile()) return false

			const file = nova.fs.open(path, 'r')
			try {
				const json = JSON.parse(file.read())
				if (
					(json.dependencies && json.dependencies[module]) ||
					(json.devDependencies && json.devDependencies[module])
				) {
					return true
				}
			} catch {}
		},
	)
	if (!packageResult) return null

	// In that folder, or a parent, find node_modules/[module]
	const moduleResult = findPathRecursively(
		packageResult.directory,
		nova.path.join('node_modules', module),
		(path, stats) => stats.isDirectory() || stats.isSymbolicLink(),
	)

	return moduleResult ? moduleResult.path : null
}

async function findModuleWithNPM(directory, module) {
	let resolve, reject
	const promise = new Promise((_resolve, _reject) => {
		resolve = _resolve
		reject = _reject
	})

	const process = new Process('/usr/bin/env', {
		args: ['npm', 'ls', module, '--parseable', '--long', '--depth', '0'],
		cwd: directory,
	})

	process.onStdout((result) => {
		if (!result || !result.trim()) return

		const [path, name, status, extra] = result.trim().split(':')
		if (!name || !name.startsWith(`${module}@`)) return resolve(null)
		if (path === nova.workspace.path) {
			log.info(
				`You seem to be working on ${module}! The extension doesn't work without ${module} built, so using the built-in ${module} instead.`,
			)
			return resolve(null)
		}

		resolve({
			path,
			correctVersion: status !== 'INVALID' && extra !== 'MAXDEPTH',
		})
	})

	handleProcessResult(process, reject, resolve)
	process.start()

	return promise
}

async function installPackages(directory) {
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
	if (nova.workspace.path) {
		// Try finding purely through file system first
		try {
			const fsResult = findModuleWithFileSystem(nova.workspace.path, 'prettier')
			if (fsResult) {
				log.info(`Loading project prettier (fs) at ${fsResult}`)
				return fsResult
			}
		} catch (err) {
			log.warn(
				'Error trying to find workspace Prettier using file system',
				err,
				err.stack,
			)
		}

		// Try npm as an alternative
		try {
			const npmResult = await findModuleWithNPM(nova.workspace.path, 'prettier')
			if (npmResult) {
				log.info(`Loading project prettier (npm) at ${npmResult.path}`)
				return npmResult.path
			}
		} catch (err) {
			if (err.status === 127) throw err
			log.warn(
				'Error trying to find workspace Prettier using npm',
				err,
				err.stack,
			)
		}
	}

	// Install / update bundled version
	try {
		const path = nova.path.join(nova.extension.path, 'node_modules', 'prettier')

		const resolved = await findModuleWithNPM(nova.extension.path, 'prettier')

		if (!resolved || !resolved.correctVersion) {
			log.info(`Installing / updating bundled Prettier at ${path}`)
			await installPackages(nova.extension.path)
		}

		log.info(`Loading bundled prettier at ${path}`)
		return path
	} catch (err) {
		if (err.status === 127) throw err
		log.warn('Error trying to find or install bundled Prettier', err)
	}
}
