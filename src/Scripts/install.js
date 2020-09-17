const { NPMExecutable } = require('nova-npm-executable')

module.exports = async () => {
	try {
		const prettier = new NPMExecutable('prettier')
		if (!prettier.isInstalled) {
			await prettier.install()
		}
	} catch (err) {
		console.error('Unable to find or install prettier', err, err.stack)
	}
}
