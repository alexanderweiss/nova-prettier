const { NPMExecutable } = require('nova-npm-executable')

// TODO: Duplicate code in ./prettier.js (except onStdout handler)
async function checkPrettierVersion() {
	let resolve, reject
	const promise = new Promise((_resolve, _reject) => {
		resolve = _resolve
		reject = _reject
	})

	const process = new Process('/usr/bin/env', {
		args: ['npm', 'll', 'prettier', '--parseable', '--depth', '0'],
		cwd: nova.extension.path,
	})

	process.onStdout((result) => {
		if (!result) return resolve(null)

		const [_, name, status] = result.split(':')
		if (!name.startsWith('prettier@')) return resolve(false)
		if (status === 'INVALID') return resolve(false)
		resolve(true)
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

module.exports = async () => {
	try {
		const prettier = new NPMExecutable('prettier')
		if (!prettier.isInstalled) {
			console.log('Extension prettier not installed, installing')
			await prettier.install()
		} else if (!(await checkPrettierVersion())) {
			console.log('Extension prettier out of date, updating/installing')
			await prettier.install()
		}
	} catch (err) {
		console.error('Unable to find or install prettier', err, err.stack)
	}
}
