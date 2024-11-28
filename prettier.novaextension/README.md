# Prettier for Nova

Code formatting using Prettier, right in Nova.

- Formats on save (can be changed per project), or using `Editor > Prettier > Format` (**⌥⇧F**).
- Supports all languages supported by Prettier: `angular`, `css`, `flow`, `graphql`, `html`, `javascript`, `json`, `jsx`, `less`, `markdown`, `scss`, `sql`, `typescript`, `vue`, `xml`, `yaml`, and plugins.
- Supports [standard Prettier configuration](https://prettier.io/docs/en/configuration.html), and [.prettierignore](https://prettier.io/docs/en/ignore.html) files.
- Uses the Prettier and any plugins installed in your project (or built-in Prettier if you don't have any).

## Using plugins

If you want to use Prettier plugins just install them, as well as Prettier, in your project.

## Ignoring files

You can disable format on save for remote documents, documents without Prettier configuration file, or specific syntaxes in the extension preferences.
You can also use Prettier's [built-in exclusion](https://prettier.io/docs/en/ignore.html#ignoring-files) feature by adding a `.prettierignore` file to the root of your project. _Note: adding it anywhere else won't work._

## Using a different version of Prettier

Just install the Prettier version you want (1.15.0 or higher) in the root folder of your project. If you already have it open in Nova you'll need to reopen your project after installing or updating Prettier for the extension to start the new one.

You can also explicitly pick an installation of Prettier (or [`prettier-eslint`](https://github.com/prettier/prettier-eslint)) by setting the `Prettier module` path in either the extension or project settings.

## Using Prettier forks or prettier-eslint

You should be able to use any fork of Prettier that uses the same API, as well as [`prettier-eslint`](https://github.com/prettier/prettier-eslint) by explicitly setting the `Prettier module` path in either the extension or project settings.

## Working with remote files

Most features are supported for remote files. However [Prettier configuration](https://prettier.io/docs/en/configuration.html) and [.prettierignore](https://prettier.io/docs/en/ignore.html) files are not. The default configuration set in the extension or project preferences will be used instead.
