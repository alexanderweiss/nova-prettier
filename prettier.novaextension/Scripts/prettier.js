'use strict';

let loaded;

async function findPrettier() {
	let resolve, reject;
	const promise = new Promise((_resolve, _reject) => {
		resolve = _resolve;
		reject = _reject;
	});

	const process = new Process('/usr/bin/env', {
		args: ['npm', 'll', 'prettier', '--parseable'],
		cwd: nova.workspace.path,
	});

	process.onStdout((result) => {
		if (!result) resolve(null);

		const [path, name] = result.split(':');
		if (!name.startsWith('prettier@')) resolve(null);

		resolve(path);
	});

	const errors = [];
	process.onStderr((err) => {
		errors.push(err);
	});

	process.onDidExit((status) => {
		if (status === '0') return
		reject(errors.join('\n'));
	});

	process.start();

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

	let workspaceModulePath;
	try {
		workspaceModulePath = await findPrettier();
	} catch (err) {
		console.warn('Error trying to find workspace Prettier', err);
	}

	const modulePath =
		workspaceModulePath ||
		nova.path.join(nova.extension.path, 'node_modules', 'prettier');

	console.log(
		`Using prettier from ${modulePath} (extension located at: ${nova.extension.path})`
	);

	loaded = {
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
	};

	return loaded
};
