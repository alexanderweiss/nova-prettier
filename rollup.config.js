import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import terser from '@rollup/plugin-terser'

export default [
	{
		input: 'src/Scripts/main.js',
		output: {
			file: 'prettier.novaextension/Scripts/main.js',
			format: 'cjs',
			exports: 'named',
		},
		plugins: [commonjs(), resolve({ preferBuiltins: true }), terser()],
	},
	{
		input: 'src/Scripts/prettier-service/prettier-service.js',
		output: {
			file: 'prettier.novaextension/Scripts/prettier-service/prettier-service.js',
			format: 'cjs',
			exports: 'named',
		},
		plugins: [terser()],
	},
	{
		input: 'src/Scripts/prettier-service/json-rpc.js',
		output: {
			file: 'prettier.novaextension/Scripts/prettier-service/json-rpc.js',
			format: 'cjs',
			exports: 'named',
		},
		plugins: [terser()],
	},
]
