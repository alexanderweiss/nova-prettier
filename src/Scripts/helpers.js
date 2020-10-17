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

const log = Object.fromEntries(
	['log', 'info'].map((fn) => [
		fn,
		(...args) => {
			if (!nova.inDevMode() && !nova.config.get('prettier.debug.logging')) {
				return
			}
			console[fn](...args)
		},
	])
)

module.exports = {
	showError,
	showActionableError,
	log,
}
