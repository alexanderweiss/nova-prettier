import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'

export default [
	{
		input: 'src/Scripts/main.js',
		output: {
			file: 'prettier.novaextension/Scripts/main.js',
			format: 'cjs',
		},
		plugins: [commonjs(), resolve({ preferBuiltins: true })],
	},
	{
		input: 'src/Scripts/prettier-service/prettier-service.js',
		output: {
			file:
				'prettier.novaextension/Scripts/prettier-service/prettier-service.js',
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
]
