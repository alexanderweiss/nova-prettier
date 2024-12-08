class ProcessError extends Error {
	constructor(status, message) {
		super(message)
		this.status = status
	}
}

function showError(id, title, body) {
	let request = new NotificationRequest(id)

	request.title = nova.localize(title)
	request.body = nova.localize(body)
	request.actions = [nova.localize('OK')]

	nova.notifications.add(request).catch((err) => console.error(err, err.stack))
}

function showActionableError(id, title, body, actions, callback) {
	let request = new NotificationRequest(id)

	request.title = nova.localize(title)
	request.body = nova.localize(body)
	request.actions = actions.map((action) => nova.localize(action))

	nova.notifications
		.add(request)
		.then((response) => callback(response.actionIdx))
		.catch((err) => console.error(err, err.stack))
}

function getConfigWithWorkspaceOverride(name) {
	const workspaceConfig = getWorkspaceConfig(name)
	const extensionConfig = nova.config.get(name)

	return workspaceConfig === null ? extensionConfig : workspaceConfig
}

function observeConfigWithWorkspaceOverride(name, fn) {
	let ignored = false
	function wrapped(...args) {
		if (!ignored) {
			ignored = true
			return
		}
		fn.apply(this, args)
	}
	nova.workspace.config.observe(name, wrapped)
	nova.config.observe(name, wrapped)
}

function getWorkspaceConfig(name) {
	const value = nova.workspace.config.get(name)
	switch (value) {
		case 'Enabled':
		case 'Ignored':
			return true
		case 'Disabled':
		case 'Format on Save':
			return false
		case 'Global Setting':
			return null
		default:
			return value
	}
}

function handleProcessResult(process, reject, resolve) {
	const errors = []
	process.onStderr((err) => {
		errors.push(err)
	})

	process.onDidExit((status) => {
		if (status === 0) {
			if (resolve) resolve()
			return
		}

		reject(new ProcessError(status, errors.join('\n')))
	})
}

const log = Object.fromEntries(
	['log', 'info', 'warn'].map((fn) => [
		fn,
		(...args) => {
			if (
				!nova.inDevMode() &&
				!getConfigWithWorkspaceOverride('prettier.debug.logging')
			) {
				return
			}
			console[fn](...args)
		},
	]),
)

module.exports = {
	showError,
	showActionableError,
	log,
	getConfigWithWorkspaceOverride,
	observeConfigWithWorkspaceOverride,
	ProcessError,
	handleProcessResult,
}
