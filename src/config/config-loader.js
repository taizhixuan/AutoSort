const fs = require('fs').promises;
const path = require('path');

const DEFAULT_CONFIG = {
  watchDir: '',
  rules: {},
  unsortedFolder: 'Unsorted',
  ignorePatterns: [],
  retryAttempts: 3,
  retryDelay: 1000,
  logFile: null,
  verbose: false
};

const DEFAULT_RULES = {
  '.pdf': 'Documents/PDFs',
  '.doc': 'Documents/Word',
  '.docx': 'Documents/Word',
  '.xls': 'Documents/Excel',
  '.xlsx': 'Documents/Excel',
  '.ppt': 'Documents/PowerPoint',
  '.pptx': 'Documents/PowerPoint',
  '.txt': 'Documents/Text',
  '.md': 'Documents/Notes',
  '.jpg': 'Images/Photos',
  '.jpeg': 'Images/Photos',
  '.png': 'Images/Photos',
  '.gif': 'Images/GIFs',
  '.webp': 'Images/WebP',
  '.svg': 'Images/Vectors',
  '.ico': 'Images/Icons',
  '.mp4': 'Videos',
  '.mkv': 'Videos',
  '.avi': 'Videos',
  '.mov': 'Videos',
  '.webm': 'Videos',
  '.mp3': 'Audio/Music',
  '.wav': 'Audio',
  '.flac': 'Audio',
  '.ogg': 'Audio',
  '.zip': 'Archives/ZIP',
  '.rar': 'Archives/RAR',
  '.7z': 'Archives/7z',
  '.tar': 'Archives/TAR',
  '.gz': 'Archives/GZ',
  '.exe': 'Programs/Executables',
  '.msi': 'Programs/Installers',
  '.dmg': 'Programs/macOS',
  '.deb': 'Programs/Linux',
  '.rpm': 'Programs/Linux',
  '.apk': 'Programs/Android',
  '.ipa': 'Programs/iOS',
  '.csv': 'Data/CSV',
  '.json': 'Data/JSON',
  '.xml': 'Data/XML',
  '.yaml': 'Data/YAML',
  '.yml': 'Data/YAML',
  '.css': 'Code/CSS',
  '.html': 'Code/HTML',
  '.js': 'Code/JavaScript',
  '.ts': 'Code/TypeScript',
  '.py': 'Code/Python',
  '.java': 'Code/Java',
  '.cpp': 'Code/C++',
  '.c': 'Code/C',
  '.h': 'Code/C-Headers',
  '.cs': 'Code/CSharp',
  '.go': 'Code/Go',
  '.rs': 'Code/Rust',
  '.php': 'Code/PHP',
  '.rb': 'Code/Ruby',
  '.swift': 'Code/Swift',
  '.kt': 'Code/Kotlin',
  '.psd': 'Design/Photoshop',
  '.ai': 'Design/Illustrator',
  '.sketch': 'Design/Sketch',
  '.fig': 'Design/Figma',
  '.xd': 'Design/AdobeXD',
  '.torrent': 'Torrents',
  '.srt': 'Subtitles',
  '.vtt': 'Subtitles'
};

class ConfigLoader {
  constructor(logger) {
    this.logger = logger;
    this.config = { ...DEFAULT_CONFIG };
    this.rules = { ...DEFAULT_RULES };
  }

  async load(configPath) {
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const loadedConfig = JSON.parse(content);
      
      if (loadedConfig.watchDir) {
        this.config.watchDir = path.resolve(loadedConfig.watchDir);
      }
      
      if (loadedConfig.rules) {
        this.rules = { ...DEFAULT_RULES, ...loadedConfig.rules };
      }
      
      if (loadedConfig.unsortedFolder) {
        this.config.unsortedFolder = loadedConfig.unsortedFolder;
      }
      
      if (loadedConfig.ignorePatterns) {
        this.config.ignorePatterns = loadedConfig.ignorePatterns;
      }
      
      if (loadedConfig.retryAttempts !== undefined) {
        this.config.retryAttempts = loadedConfig.retryAttempts;
      }
      
      if (loadedConfig.retryDelay !== undefined) {
        this.config.retryDelay = loadedConfig.retryDelay;
      }
      
      if (loadedConfig.logFile) {
        this.config.logFile = path.resolve(loadedConfig.logFile);
      }
      
      if (loadedConfig.verbose !== undefined) {
        this.config.verbose = loadedConfig.verbose;
      }
      
      await this.logger.debug('Configuration loaded from', configPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await this.logger.warn(`Config file not found at ${configPath}, using defaults`);
      } else {
        throw new Error(`Failed to load config: ${error.message}`);
      }
    }
  }

  async save(configPath) {
    const configContent = {
      watchDir: this.config.watchDir || '',
      rules: this.rules,
      unsortedFolder: this.config.unsortedFolder,
      ignorePatterns: this.config.ignorePatterns,
      retryAttempts: this.config.retryAttempts,
      retryDelay: this.config.retryDelay,
      logFile: this.config.logFile || null,
      verbose: this.config.verbose || false
    };

    await fs.writeFile(configPath, JSON.stringify(configContent, null, 2), 'utf-8');
    await this.logger.success('Configuration saved to', configPath);
  }

  async validate() {
    if (!this.config.watchDir) {
      throw new Error('Watch directory is not configured. Use --watch <directory> or set "watchDir" in config.');
    }

    try {
      const stats = await fs.stat(this.config.watchDir);
      if (!stats.isDirectory()) {
        throw new Error(`Watch path is not a directory: ${this.config.watchDir}`);
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Watch directory does not exist: ${this.config.watchDir}`);
      }
      throw error;
    }

    return true;
  }

  getConfig() {
    return { ...this.config };
  }

  getRules() {
    return { ...this.rules };
  }

  setWatchDir(dir) {
    this.config.watchDir = path.resolve(dir);
  }

  addRule(extension, targetFolder) {
    const ext = extension.startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
    this.rules[ext] = targetFolder;
  }

  removeRule(extension) {
    const ext = extension.startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
    delete this.rules[ext];
  }

  getRuleCount() {
    return Object.keys(this.rules).length;
  }

  async exportRules(outputPath) {
    await fs.writeFile(outputPath, JSON.stringify(this.rules, null, 2), 'utf-8');
    await this.logger.success('Rules exported to', outputPath);
  }

  async importRules(inputPath) {
    try {
      const content = await fs.readFile(inputPath, 'utf-8');
      const importedRules = JSON.parse(content);
      this.rules = { ...DEFAULT_RULES, ...importedRules };
      await this.logger.success(`Imported ${Object.keys(importedRules).length} rules from`, inputPath);
    } catch (error) {
      throw new Error(`Failed to import rules: ${error.message}`);
    }
  }
}

module.exports = ConfigLoader;
