# Prettier for Nova

Experience seamless code formatting with Prettier directly in Nova.

- **Format on save:** Automatically format your code on save (this setting can be customized per project), or manually format using `Editor > Prettier > Format Document` (**⌥⇧F**).
- **Language Support:** Includes all languages supported by Prettier, such as `Angular`, `CSS`, `Flow`, `GraphQL`, `HTML`, `JavaScript`, `JSON`, `JSX`, `Less`, `Markdown`, `PHP`, `SCSS`, `SQL`, `TypeScript`, `Vue`, `XML`, `YAML`, and additional plugins.
- **Configuration Support:** Compatible with [standard Prettier configuration](https://prettier.io/docs/en/configuration.html), and [.prettierignore](https://prettier.io/docs/en/ignore.html) files.
- **Plugin Usage:** Utilizes Prettier and any plugins installed in your project, or defaults to the built-in Prettier and plugins if none are installed.

## Bundled plugins

- ✅ **[@prettier/plugin-php](https://github.com/prettier/plugin-php")**
- ✅ **[@prettier/plugin-xml](https://github.com/prettier/plugin-xml)**
- ✅ **[prettier-plugin-sql](https://github.com/un-ts/prettier/tree/master/packages/sql)**
- ⚠️ **[prettier-plugin-nginx](https://github.com/jxddk/prettier-plugin-nginx)**

✅ Enabled by default

⚠️ Please install the [NGINX for Nova](https://extensions.panic.com/extensions/joncoole/joncoole.nginx) extension before enabling this plugin.

## Using external plugins in your project

To use external Prettier plugins, simply install them along with Prettier in your project.

## Ignoring files

You can disable format on save for remote documents, documents without a Prettier configuration file, or specific syntaxes in the extension and project preferences.
Additionally you can use Prettier's [built-in exclusion](https://prettier.io/docs/en/ignore.html#ignoring-files) feature by adding a `.prettierignore` file to the root of your project. _Note: adding it anywhere else won't work._

## Using a different version of Prettier

Simply install the desired version of Prettier (1.15.0 or higher) in the root folder of your project. If you already have the project open in Nova, you'll need to reopen it after installing or updating Prettier for the extension to recognize and start using the new version.

You can also explicitly select an installation of Prettier (or [`prettier-eslint`](https://github.com/prettier/prettier-eslint)) by setting the `Prettier module` path in the extension or project settings.

## Using Prettier forks or prettier-eslint

You should be able to use any fork of Prettier that utilizes the same API, as well as [`prettier-eslint`](https://github.com/prettier/prettier-eslint), by explicitly setting the `Prettier module` path in the extension or project settings.

## Working with remote files

Most features are supported for remote files; however, [Prettier configuration](https://prettier.io/docs/en/configuration.html) and [.prettierignore](https://prettier.io/docs/en/ignore.html) files are not. The default configuration set in the extension or project preferences will be used instead.
