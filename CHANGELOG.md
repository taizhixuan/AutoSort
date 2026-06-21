# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.3] - 2026-06-21

### Fixed
- `autosort start` no longer crashes when `ignorePatterns` contains glob patterns
  such as `*.tmp`. The watcher previously compiled each pattern with `new RegExp()`,
  which throws on glob syntax.

### Changed
- The watcher now matches `ignorePatterns` as **globs against the file basename**,
  consistent with `organize` (the directory scanner). Both paths share the same
  matcher (`utils/pattern.js`), and invalid patterns are ignored safely instead of
  throwing.

## [1.0.2] - 2026-06-21

### Changed
- Rewrote the README to be concise: removed the badge wall and marketing copy, kept
  a short description, install, usage, config, and library sections. Added tasteful
  npm-version and license badges. Republished so the npm page reflects it.

## [1.0.1] - 2026-06-21

### Added
- README: install-from-npm instructions and version/license badges.

### Changed
- The CLI `--version` and the startup banner now read the version from
  `package.json` (single source of truth) instead of hardcoded strings, so a single
  `npm version` bump updates everything.

## [1.0.0] - 2026-06-21

Initial public release on npm as `@taizhixuan/autosort`.

### Added
- **Organize existing files** — `organize` (alias `sort`) sorts the files already in
  a folder in one shot, not just newly-added ones.
- **Dry-run preview** — `--dry-run` on `organize` and `start` shows what would move
  without changing anything.
- **Undo** — revert the most recent organize run; move history is stored in
  `.autosort/history.json` inside the watched folder.
- **Smarter rules** — match by filename pattern (glob/regex), file size, or age, in
  addition to file extension. Precedence: pattern → extension → size → age →
  unsorted folder.
- **Interactive setup** — `init` runs a wizard when no flags are given; zero-config
  defaults to the OS Downloads folder.
- **Live watching** — `start` watches a folder (via chokidar) and sorts new files as
  they arrive, waiting for writes to finish first.
- **Rules management** — `rules --list/--add/--remove/--import/--export`.
- **Status** — `status` shows configuration and recent activity.
- 60+ built-in extension rules; conflict resolution (`name(1).ext`); retry with
  backoff for locked files; cross-device (copy + delete) move fallback.

### Internal
- Codebase refactored to remove duplication and fix latent bugs (including a
  `start --watch` crash caused by an incorrect import) and covered by a test suite.

[1.0.3]: https://github.com/taizhixuan/AutoSort/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/taizhixuan/AutoSort/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/taizhixuan/AutoSort/releases/tag/v1.0.1
[1.0.0]: https://www.npmjs.com/package/@taizhixuan/autosort/v/1.0.0
