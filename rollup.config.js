import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import terser from '@rollup/plugin-terser'
import fs from 'fs'

// Load unified configuration
const unifiedConfig = JSON.parse(
	fs.readFileSync('./src/unifiedConfig.json', 'utf8'),
)

// Function to extract specific configurations
const extractConfig = (unifiedConfig, type) => {
	const extract = (item) => {
		const extracted = { ...item }
		delete extracted.config
		delete extracted.configWorkspace

		if (type === 'config' && item.config) {
			Object.assign(extracted, item.config)
		} else if (type === 'configWorkspace' && item.configWorkspace) {
			Object.assign(extracted, item.configWorkspace)
		}

		if (item.children) {
			extracted.children = item.children.map(extract)
		}

		return extracted
	}

	return unifiedConfig.map(extract)
}

// Generate configurations
const globalConfig = extractConfig(unifiedConfig, 'config')
const workspaceConfig = extractConfig(unifiedConfig, 'configWorkspace')

// Write the configurations to files
fs.writeFileSync(
	'./prettier.novaextension/config.json',
	JSON.stringify(globalConfig, null, 2),
)
fs.writeFileSync(
	'./prettier.novaextension/configWorkspace.json',
	JSON.stringify(workspaceConfig, null, 2),
)

// Minify JSON files
const minifyConfigFile = (filePath) => {
	const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) // Read and parse JSON
	const minified = JSON.stringify(data) // Minify the JSON
	fs.writeFileSync(filePath, minified) // Write back the minified JSON
}

// Minify the output files
minifyConfigFile('./prettier.novaextension/config.json')
minifyConfigFile('./prettier.novaextension/configWorkspace.json')

export default [
	{
		input: './src/Scripts/main.js',
		output: {
			file: './prettier.novaextension/Scripts/main.js',
			format: 'cjs',
			exports: 'named',
		},
		plugins: [commonjs(), resolve({ preferBuiltins: true }), terser()],
	},
	{
		input: './src/Scripts/prettier-service/prettier-service.js',
		output: {
			file: './prettier.novaextension/Scripts/prettier-service/prettier-service.js',
			format: 'cjs',
			exports: 'named',
		},
		plugins: [terser()],
	},
	{
		input: './src/Scripts/prettier-service/json-rpc.js',
		output: {
			file: './prettier.novaextension/Scripts/prettier-service/json-rpc.js',
			format: 'cjs',
			exports: 'named',
		},
		plugins: [terser()],
	},
]
