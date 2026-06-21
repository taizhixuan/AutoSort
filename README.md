# AutoSort - Smart Downloads Organizer

<div align="center">

![AutoSort Banner](https://img.shields.io/badge/AutoSort-v1.0.1-cyan?style=for-the-badge)
![npm](https://img.shields.io/npm/v/@taizhixuan/autosort?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)

**A powerful, production-ready file organization tool that automatically sorts your downloads.**

</div>

## Overview

AutoSort is a digital housekeeper for your file system. It works two ways: run `organize` to sort the files **already** sitting in a folder (like your `Downloads`) in one shot, or run `start` to **watch** the folder and sort new files the moment they arrive. Either way it identifies each file by extension (or filename pattern, size, or age), matches it against configurable rules, and moves it to an organized target folder — with a `--dry-run` preview and `undo` for safety.

### Key Features

- **Organize Existing Files** - One-shot `organize` command sorts the files already in a folder, not just new ones
- **Live Watching** - `start` sorts files the moment they appear
- **Dry-Run Preview** - `--dry-run` shows exactly what would move, changing nothing
- **Undo** - Revert the last organize run with a single command
- **Smarter Rules** - Match by filename pattern (glob/regex), file size, or age — not just extension
- **Interactive Setup** - `init` walks you through configuration; zero-config defaults to your Downloads folder
- **60+ Built-in Rules** - Documents, images, videos, code, and more
- **Smart Conflict Resolution** - Automatically renames files to avoid overwrites
- **Retry & Cross-Device Moves** - Handles locked files and moves across drives
- **Cross-Platform** - Works on Windows, macOS, and Linux
- **Comprehensive Logging** - Track all file operations

## Installation

### Prerequisites

- Node.js 18.0.0 or higher
- npm (comes with Node.js)

### Install from npm (recommended)

```bash
# Install globally — gives you the `autosort` command everywhere
npm install -g @taizhixuan/autosort

# Or run it once without installing
npx @taizhixuan/autosort organize --dry-run
```

### Install from source

```bash
# Clone the project
git clone https://github.com/taizhixuan/AutoSort.git
cd AutoSort

# Install dependencies
npm install

# (Optional) link the `autosort` command globally
npm link

# Initialize configuration (interactive)
node src/cli.js init
```

### Using PM2 for Production (Optional)

For production deployments, use PM2 to run AutoSort as a background service:

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2 (note the `--` before the subcommand)
pm2 start src/cli.js --name autosort -- start

# Save process list
pm2 save

# Setup startup script
pm2 startup
```

## Quick Start

### 1. Initialize Configuration

```bash
# Interactive setup wizard (recommended)
autosort init

# Or non-interactively, pointing at a folder
autosort init --watch ~/Downloads
```

### 2. Organize What's Already There

```bash
# Preview first — nothing is moved
autosort organize --dry-run

# Do it for real
autosort organize

# Changed your mind?
autosort undo
```

### 3. Keep It Tidy Automatically

```bash
# Watch and auto-sort new files as they arrive
npm start

# Or with verbose logging
npm start -- --verbose
```

That's it! Any new file in your watched folder will automatically be organized.

## Usage

### CLI Commands

```bash
# Organize files already in a folder (one-shot)
autosort organize                 # sort now
autosort organize --dry-run       # preview only, change nothing
autosort organize --recursive     # include subfolders
autosort sort                     # alias for organize

# Undo the most recent organize run
autosort undo

# Start the watcher (auto-sort new files)
autosort start
autosort start --watch ~/Downloads
autosort start --dry-run          # preview moves while watching

# Initialize configuration
autosort init                     # interactive wizard
autosort init --watch ~/Downloads --output ./config.json

# Manage rules
autosort rules --list
autosort rules --add .custom:Custom/Folder
autosort rules --remove .old
autosort rules --export ./rules.json
autosort rules --import ./rules.json

# Show config + recent activity
autosort status
```

### Programmatic Usage

```javascript
const AutoSort = require('./src/index');

const sorter = new AutoSort({
  verbose: true,
  silent: false
});

async function main() {
  await sorter.start('./autosort.config.json');
  
  // Run for a while...
  setTimeout(async () => {
    await sorter.stop();
  }, 60000);
}

main();
```

## Configuration

Create `autosort.config.json` in your project directory:

```json
{
  "watchDir": "C:/Users/YourName/Downloads",
  "rules": {
    ".pdf": "Documents/PDFs",
    ".jpg": "Images/Photos",
    ".custom": "MyCustom/Folder"
  },
  "unsortedFolder": "Unsorted",
  "recursive": false,
  "ignorePatterns": ["*.tmp", "*.crdownload", ".DS_Store"],
  "patternRules": [
    { "match": "Invoice*", "type": "glob", "folder": "Finance/Invoices" }
  ],
  "sizeRules": [{ "minSizeMB": 1024, "folder": "Large Files" }],
  "dateRules": [{ "olderThanDays": 365, "folder": "Archive" }],
  "retryAttempts": 3,
  "retryDelay": 1000,
  "logFile": "./autosort.log",
  "verbose": false
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `watchDir` | string | OS Downloads | Directory to organize / watch |
| `rules` | object | {} | Extension → folder rules (merged with defaults) |
| `unsortedFolder` | string | "Unsorted" | Folder for unrecognized file types |
| `recursive` | boolean | false | Include subfolders when organizing |
| `ignorePatterns` | array | [] | Glob patterns to ignore (e.g. `*.tmp`) |
| `patternRules` | array | [] | Filename rules: `{ match, type: "glob"\|"regex", folder }` |
| `sizeRules` | array | [] | Size rules: `{ minSizeMB, folder }` |
| `dateRules` | array | [] | Age rules: `{ olderThanDays, folder }` |
| `retryAttempts` | number | 3 | Max retry attempts for locked files |
| `retryDelay` | number | 1000 | Delay between retries (ms) |
| `logFile` | string | null | Optional log file path |
| `verbose` | boolean | false | Enable verbose logging |

**Rule precedence:** filename pattern rules → extension rules → size rules → date rules → unsorted folder.

## Default File Organization

AutoSort organizes files into these categories by default:

```
Downloads/
├── Documents/
│   ├── PDFs/
│   ├── Word/
│   ├── Excel/
│   ├── PowerPoint/
│   ├── Text/
│   └── Notes/
├── Images/
│   ├── Photos/
│   ├── GIFs/
│   ├── WebP/
│   ├── Vectors/
│   └── Icons/
├── Videos/
├── Audio/
│   └── Music/
├── Archives/
│   ├── ZIP/
│   ├── RAR/
│   ├── 7z/
│   ├── TAR/
│   └── GZ/
├── Programs/
│   ├── Executables/
│   ├── Installers/
│   ├── macOS/
│   ├── Linux/
│   ├── Android/
│   └── iOS/
├── Design/
│   ├── Photoshop/
│   ├── Illustrator/
│   ├── Sketch/
│   ├── Figma/
│   └── AdobeXD/
├── Code/
│   ├── JavaScript/
│   ├── TypeScript/
│   ├── Python/
│   ├── Java/
│   └── ... (30+ languages)
├── Data/
│   ├── CSV/
│   ├── JSON/
│   ├── XML/
│   └── YAML/
├── Torrents/
├── Subtitles/
└── Unsorted/
```

## API Reference

### AutoSort Class

```javascript
const AutoSort = require('./src/index');

const sorter = new AutoSort(options);
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `silent` | boolean | false | Suppress console output |
| `verbose` | boolean | false | Enable debug logging |
| `logFile` | string | null | Optional log file path |

#### Methods

##### `await sorter.start(configPath?, { dryRun }?)`

Start watching for new files.

##### `await sorter.organize(configPath?, { dryRun, recursive }?)`

Sort the files already present in the watch directory. Returns a summary
`{ processed, moved, failed, dryRun, byFolder }`.

##### `await sorter.undo(configPath?)`

Revert the most recent organize run. Returns `{ reverted, failed, total }`.

##### `await sorter.stop()`

Stop watching and print statistics.

##### `sorter.getStatus()`

Get current status and statistics.

##### `sorter.getStats()`

Get processing statistics.

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage
```

---

## Architecture

```
autosort/
├── src/
│   ├── index.js          # Main AutoSort class (watch / organize / undo)
│   ├── cli.js            # CLI interface (single entry point)
│   ├── constants.js      # Shared constants (config filename, state dir)
│   ├── config/
│   │   └── config-loader.js    # Configuration management
│   ├── scanner/
│   │   └── directory-scanner.js # Lists files to organize (skips managed dirs)
│   ├── history/
│   │   └── history-store.js     # Move history for undo
│   ├── wizard/
│   │   └── init-wizard.js       # Interactive setup
│   ├── utils/
│   │   ├── logger.js            # Logging utility
│   │   ├── extension.js         # Extension normalization
│   │   ├── pattern.js           # Glob/regex filename matching
│   │   ├── config-path.js       # Config path resolution
│   │   ├── paths.js             # OS Downloads default
│   │   └── shutdown.js          # Graceful SIGINT/SIGTERM
│   ├── watcher/
│   │   └── file-watcher.js     # Chokidar wrapper
│   ├── sorter/
│   │   └── file-sorter.js      # Extension / pattern / size / date matching
│   └── mover/
│       └── file-mover.js       # File operations (with dry-run)
├── tests/
│   ├── file-sorter.test.js
│   ├── file-mover.test.js
│   ├── config-loader.test.js
│   └── new-features.test.js
├── docs/
│   └── usage-guide.md
├── autosort.config.example.json
├── package.json
└── README.md
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Chokidar](https://github.com/paulmillr/chokidar) for reliable file watching
- CLI powered by [Commander.js](https://github.com/tj/commander.js)
- Styled output with [Chalk](https://github.com/chalk/chalk)

