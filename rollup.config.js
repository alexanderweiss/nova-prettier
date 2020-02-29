const commonjs = require('@rollup/plugin-commonjs')
const resolve = require('@rollup/plugin-node-resolve')

export default [
	{
		input: 'src/Scripts/main.js',
		output: {
			file: 'prettier.novaextension/Scripts/main.js',
			format: 'cjs'
		},
		external: id => id.match(/.*?prettier\.js$/m),
		plugins: [commonjs(), resolve({ preferBuiltins: true })]
	},
	{
		input: 'src/Scripts/config.js',
		output: { file: 'prettier.novaextension/Scripts/config.js', format: 'cjs' }
	},
	{
		input: 'src/Scripts/prettier.js',
		output: {
			file: 'prettier.novaextension/Scripts/prettier.js',
			format: 'cjs'
		}
	}
]
