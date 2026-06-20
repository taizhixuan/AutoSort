# AutoSort - Smart Downloads Organizer

<div align="center">

![AutoSort Banner](https://img.shields.io/badge/AutoSort-v1.0.0-cyan?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)

**A powerful, production-ready file organization tool that automatically sorts your downloads.**

</div>

## Overview

AutoSort is a background Node.js service that acts as a digital housekeeper for your file system. It continuously monitors a designated directory (like your `Downloads` folder) for new files. Upon detecting a new file, AutoSort identifies its file extension, matches it against configurable rules, and automatically moves the file to an organized target directory.

### Key Features

- **Automatic Organization** - Files are sorted the moment they appear
- **60+ Built-in Rules** - Support for documents, images, videos, code, and more
- **Smart Conflict Resolution** - Automatically renames files to avoid overwrites
- **Retry Logic** - Handles temporary file locks with configurable retries
- **Extensible Rules** - Add custom rules for any file type
- **Cross-Platform** - Works on Windows, macOS, and Linux
- **CLI Interface** - Easy to use command-line tools
- **Comprehensive Logging** - Track all file operations
- **Test Mode** - Dry-run to preview what would happen

## Installation

### Prerequisites

- Node.js 18.0.0 or higher
- npm (comes with Node.js)

### Quick Install

```bash
# Clone or download the project
cd autosort

# Install dependencies
npm install

# Initialize configuration
npm run init -- --watch ~/Downloads
```

### Using PM2 for Production (Optional)

For production deployments, use PM2 to run AutoSort as a background service:

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start src/index.js --name autosort

# Save process list
pm2 save

# Setup startup script
pm2 startup
```

## Quick Start

### 1. Initialize Configuration

```bash
# Create configuration with your downloads folder
autosort init --watch ~/Downloads

# Or use the CLI interactively
npm run cli -- init
```

### 2. Start AutoSort

```bash
# Start watching for new files
npm start

# Or with verbose logging
npm start -- --verbose

# Or use PM2 for background running
pm2 start src/index.js --name autosort
```

### 3. Watch It Work

That's it! Any new file in your Downloads folder will automatically be organized.

## Usage

### CLI Commands

```bash
# Start the watcher
autosort start
autosort start --watch ~/Downloads
autosort start --verbose

# Initialize configuration
autosort init
autosort init --watch ~/Downloads --output ./config.json

# Manage rules
autosort rules --list
autosort rules --add .custom:Custom/Folder
autosort rules --remove .old
autosort rules --export ./rules.json
autosort rules --import ./rules.json

# Check status
autosort status

# Test configuration (dry run)
autosort test
autosort test --watch ~/Downloads
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
  "ignorePatterns": [
    "^\\.DS_Store$",
    "^Thumbs\\.db$"
  ],
  "retryAttempts": 3,
  "retryDelay": 1000,
  "logFile": "./autosort.log",
  "verbose": false
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `watchDir` | string | required | Directory to watch for new files |
| `rules` | object | {} | Custom sorting rules (merged with defaults) |
| `unsortedFolder` | string | "Unsorted" | Folder for unrecognized file types |
| `ignorePatterns` | array | [] | Regex patterns to ignore |
| `retryAttempts` | number | 3 | Max retry attempts for locked files |
| `retryDelay` | number | 1000 | Delay between retries (ms) |
| `logFile` | string | null | Optional log file path |
| `verbose` | boolean | false | Enable verbose logging |

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

##### `await sorter.start(configPath?)`

Start watching for new files.

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
│   ├── index.js          # Main AutoSort class
│   ├── cli.js            # CLI interface
│   ├── config/
│   │   └── config-loader.js    # Configuration management
│   ├── utils/
│   │   └── logger.js           # Logging utility
│   ├── watcher/
│   │   └── file-watcher.js     # Chokidar wrapper
│   ├── sorter/
│   │   └── file-sorter.js      # Extension matching
│   └── mover/
│       └── file-mover.js       # File operations
├── tests/
│   ├── file-sorter.test.js
│   ├── file-mover.test.js
│   └── config-loader.test.js
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

