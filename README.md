# AutoSort

A small command-line tool that sorts files into folders by type (or by name, size, or age). Run it once to clean up a messy folder, or leave it running to sort new files as they arrive.

## Install

```bash
npm install -g @taizhixuan/autosort
```

Or run without installing:

```bash
npx @taizhixuan/autosort organize --dry-run
```

Requires Node.js 18+.

## Usage

```bash
autosort init                 # set up a config (asks for the folder)
autosort organize --dry-run   # preview what would move
autosort organize             # sort the folder now
autosort undo                 # undo the last organize
autosort start                # watch the folder and sort new files
```

Without a config, it defaults to your Downloads folder. Add `-w <dir>` to any command to point at a different folder, or `--recursive` to include subfolders.

Other commands: `autosort rules --list` / `--add .ext:Folder`, and `autosort status`.

## Configuration

`autosort init` writes `autosort.config.json`. Example:

```json
{
  "watchDir": "C:/Users/me/Downloads",
  "rules": { ".pdf": "Documents", ".jpg": "Images" },
  "unsortedFolder": "Unsorted",
  "ignorePatterns": ["*.tmp", "*.crdownload"],
  "patternRules": [
    { "match": "Invoice*", "type": "glob", "folder": "Finance" }
  ],
  "sizeRules": [{ "minSizeMB": 1024, "folder": "Large Files" }],
  "dateRules": [{ "olderThanDays": 365, "folder": "Archive" }]
}
```

`rules` is merged with 60+ built-in extension rules. Matching order: filename pattern → extension → size → age → `unsortedFolder`. Name conflicts are resolved by appending `(1)`, `(2)`, etc.

## Library use

```js
const AutoSort = require('@taizhixuan/autosort');

const sorter = new AutoSort({ verbose: true });
await sorter.organize('./autosort.config.json', { dryRun: true });
```

Main methods: `organize(configPath?, opts?)`, `undo(configPath?)`, `start(configPath?, opts?)`, `stop()`.

## Development

```bash
git clone https://github.com/taizhixuan/AutoSort.git
cd AutoSort
npm install
npm test
```

## License

MIT
