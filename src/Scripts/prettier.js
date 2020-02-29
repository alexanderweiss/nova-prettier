let loaded

module.exports = () => {
	if (!loaded) {
		loaded = {
			prettier: require('../node_modules/prettier/standalone.js'),
			parsers: {
				angularParser: require('../node_modules/prettier/parser-angular.js'),
				babylonParser: require('../node_modules/prettier/parser-babylon.js'),
				flowParser: require('../node_modules/prettier/parser-flow.js'),
				glimmerParser: require('../node_modules/prettier/parser-glimmer.js'),
				graphqlParser: require('../node_modules/prettier/parser-graphql.js'),
				htmlParser: require('../node_modules/prettier/parser-html.js'),
				markdownParser: require('../node_modules/prettier/parser-markdown.js'),
				postcssParser: require('../node_modules/prettier/parser-postcss.js'),
				typescriptParser: require('../node_modules/prettier/parser-typescript.js'),
				yamlParser: require('../node_modules/prettier/parser-yaml.js'),
			}
		}
	}
	return loaded
}