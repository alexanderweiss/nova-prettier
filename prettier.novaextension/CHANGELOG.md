## 1.6.0 - 2020-10-05

### Added

- Added global setting to disable `Format on save` for specific syntaxes.
- Included PHP plugin with bundled Prettier (requires enabling `Run Prettier in a separate process (experimental)`).
- More events are logged to the extension console.

### Changed

- Plugin support is now enabled by default, but can be disabled when errors occur.
- Selected text now remains selected after formatting (doesn't support multiple selections / cursors).
- Folded code will now remain folded unless formatting changes it.
- Improved formatting speed.
- The `Format with Prettier` command is now available for all syntaxes, so it works with plugins.
- Show syntax errors from PHP plugin inline.
- Don't show error when trying to format a file that has no parser available.

### Fixed

- Fixes an error trying to log errors occurring while looking up configuration

## 1.5.2 - 2020-10-03

### Changed

- Show notification about any unhandled errors during formatting.

### Fixed

- Fixes syntax errors preventing formatting no longer getting reported.
- Fixes issues on older macOS releases.

## 1.5.1 - 2020-09-27

### Changed

- When formatting on save, automatically save the file again if Nova thought formatting took too long and saved the unformatted version.

### Fixed

- Fixes unnecessary document updates when it's already properly formatted.

## 1.5.0 - 2020-09-26

### Added

- Support for Prettier plugins (requires enabling `Run Prettier in a separate process (experimental)`).

### Changed

- Improved performance when formatting large files (requires enabling `Run Prettier in a separate process (experimental)`).
- Stop formatting PHP, unless the PHP plugin is used.

## 1.4.0 - 2020-09-25

### Added

- Set a default keyboard shortcut for `Format with Prettier` command: ⌥⇧F.
- Added a global `Format on save` preference that can be overridden by project preferences.
- Support formatting of HTML in PHP files.

### Changed

- Fall back to bundled Prettier when loading the project's Prettier installation fails.

### Fixed

- Fixes files opened after disabling formatting on save getting formatted on save.

## 1.3.0 - 2020-09-21

### Added

- Support formatting of files in non-project windows.
- Support working on the Prettier repository.
- Automatically update the bundled installation of Prettier if the extension includes a new version.

### Changed

- **(Breaking)** Updated bundle Prettier to 2.1.2.

## 1.2.1 - 2020-09-17

### Added

- Support formatting of new files that have never been saved.
- Include CSS in supported syntaxes.

### Changed

- Don't require editor focus for the `Format with Prettier` to be available.
- Log non-syntax errors from Prettier to the extension console properly.
- Include stack trace with errors logged in the extension console.

## 1.2.0 - 2020-08-17

### Added

- Added a warning with help when Prettier (and NPM) can't be found.

## 1.1.0 - 2020-06-15

### Added

- Use Prettier installed in the project's node_modules. If none is available the extension falls back to the bundled Prettier.
- Automatically find and load parsers provided by Prettier.

## 1.0.0 - 2020-06-12

### Added

- Use .prettierignore to determine which files to format (.prettierignore needs to be in the project root).
- Added a warning when an error occurs while looking up the Prettier configuration for a file.

### Changed

- **(Breaking)** Updated to Prettier 2.0.5.

## 0.2.0 - 2020-02-29

### Added

- Don't include prettier in extension, but install when activating.

## 0.1.0 - 2020-01-31

### Added

- Initial release.
