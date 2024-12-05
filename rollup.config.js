import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import terser from '@rollup/plugin-terser'
import fs from 'fs'

// Load configurations
const commonConfig = JSON.parse(
	fs.readFileSync('./src/configCommon.json', 'utf8'),
)
const specificConfig = JSON.parse(
	fs.readFileSync('./src/configSpecific.json', 'utf8'),
)
const workspaceSpecificConfig = JSON.parse(
	fs.readFileSync('./src/configWorkspaceSpecific.json', 'utf8'),
)

// Default properties for ignored syntaxes
const ignoredSyntaxDefaultsForConfig = {
	type: 'boolean',
	default: false,
}

const ignoredSyntaxDefaultsForWorkspace = {
	type: 'enum',
	radio: false,
	values: ['Global Setting', 'Enabled', 'Disabled'],
	default: 'Global Setting',
}

// Function to merge configurations and apply defaults
const mergeConfigSections = (
	commonSections,
	specificSections,
	defaults = {},
) => {
	const specificSectionMap = Object.fromEntries(
		specificSections.map((section) => [section.key, section]),
	)

	return commonSections.map((commonSection) => {
		const specificSection = specificSectionMap[commonSection.key] || {}

		// Merge common and specific sections
		const mergedSection = {
			...commonSection,
			...specificSection,
		}

		// Apply defaults to `ignored-syntaxes` keys
		if (
			mergedSection.key.startsWith('prettier.format-on-save.ignored-syntaxes.')
		) {
			for (const [key, value] of Object.entries(defaults)) {
				if (mergedSection[key] === undefined) {
					mergedSection[key] = value
				}
			}
		}

		// Recursively process children if present
		if (commonSection.children || specificSection.children) {
			mergedSection.children = mergeConfigSections(
				commonSection.children || [],
				specificSection.children || [],
				defaults,
			)
		}

		return mergedSection
	})
}

// Generate configurations
const generateConfig = (commonConfig, specificConfig, defaults) =>
	mergeConfigSections(commonConfig, specificConfig, defaults)

const generateWorkspaceConfig = (commonConfig, workspaceConfig, defaults) =>
	mergeConfigSections(commonConfig, workspaceConfig, defaults)

// Create final configurations
const finalConfig = generateConfig(
	commonConfig,
	specificConfig,
	ignoredSyntaxDefaultsForConfig,
)
const finalWorkspaceConfig = generateWorkspaceConfig(
	commonConfig,
	workspaceSpecificConfig,
	ignoredSyntaxDefaultsForWorkspace,
)

// Write the configurations to files
fs.writeFileSync(
	'./prettier.novaextension/config.json',
	JSON.stringify(finalConfig, null, 2),
)
fs.writeFileSync(
	'./prettier.novaextension/configWorkspace.json',
	JSON.stringify(finalWorkspaceConfig, null, 2),
)

// Minify JSON files
const flattenAndMinifyFile = (filePath) => {
	const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) // Read and parse JSON
	const minified = JSON.stringify(data) // Minify the JSON
	fs.writeFileSync(filePath, minified) // Write back the minified JSON
}

// Minify the output files
flattenAndMinifyFile('./prettier.novaextension/config.json')
flattenAndMinifyFile('./prettier.novaextension/configWorkspace.json')

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
