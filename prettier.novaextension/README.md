# Prettier for Nova

Code formatting using Prettier, right in Nova.

- Formats on save (can be changed per project), or using `Editor > Format with Prettier` (**⌥⇧F**).
- Supports all languages supported by Prettier: `json`, `html`, `javascript`, `jsx`, `flow`, `typescript`, `vue`, `angular`, `css`, `less`, `scss`, `graphql`, `markdown`, `yaml`.
- Supports [standard Prettier configuration](https://prettier.io/docs/en/configuration.html), and [.prettierignore](https://prettier.io/docs/en/ignore.html) files.
- Uses the Prettier installed in your project (or built-in Prettier if you don't have any).

## Using plugins

If you want to use Prettier plugins just enable the `Run Prettier in a separate process (experimental)` option in the extension's preferences in the Extension Library. Please [report any issues](https://github.com/alexanderweiss/nova-prettier/issues) you have with this option enabled.

## Ignoring files

You can use Prettier's [built-in exclusion](https://prettier.io/docs/en/ignore.html#ignoring-files) feature by adding a `.prettierignore` file to the root of your project. _Note: adding it anywhere else won't work._

## Using a different version of Prettier

Just install the Prettier version you want (1.15.0 or higher) in the root folder of your project. If you already have it open in Nova you'll need to reopen your project after installing or updating Prettier for the extension to start the new one.
