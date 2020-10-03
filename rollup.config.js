import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'

export default [
	{
		input: 'src/Scripts/main.js',
		output: {
			file: 'prettier.novaextension/Scripts/main.js',
			format: 'cjs',
		},
		external: (id) => id.match(/.*?prettier\.js$/m),
		plugins: [commonjs(), resolve({ preferBuiltins: true })],
	},
	{
		input: 'src/Scripts/config.js',
		output: { file: 'prettier.novaextension/Scripts/config.js', format: 'cjs' },
	},
	{
		input: 'src/Scripts/prettier-service/prettier-service.js',
		output: {
			file: 'prettier.novaextension/Scripts/prettier-service/prettier-service.js',
			format: 'cjs',
		},
	},
	{
		input: 'src/Scripts/prettier-service/json-rpc.js',
		output: {
			file: 'prettier.novaextension/Scripts/prettier-service/json-rpc.js',
			format: 'cjs',
		},
	},
	{
		input: 'src/Scripts/prettier.js',
		output: {
			file: 'prettier.novaextension/Scripts/prettier.js',
			format: 'cjs',
		},
	},
]
