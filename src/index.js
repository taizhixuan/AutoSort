const path = require('path');
const Logger = require('./utils/logger');
const ConfigLoader = require('./config/config-loader');
const FileWatcher = require('./watcher/file-watcher');
const FileSorter = require('./sorter/file-sorter');
const FileMover = require('./mover/file-mover');

class AutoSort {
  constructor(options = {}) {
    this.logger = new Logger(options);
    this.configLoader = new ConfigLoader(this.logger);
    this.watcher = null;
    this.sorter = null;
    this.mover = null;
    this.isRunning = false;
    this.stats = {
      startedAt: null,
      filesProcessed: 0,
      filesMoved: 0,
      filesFailed: 0,
      lastProcessed: null
    };
  }

  async initialize(configPath = null) {
    this.logger.banner();
    
    if (configPath) {
      await this.configLoader.load(configPath);
    }
    
    const config = this.configLoader.getConfig();
    const rules = this.configLoader.getRules();
    
    this.sorter = new FileSorter(rules, this.logger, {
      unsortedFolder: config.unsortedFolder
    });
    
    this.mover = new FileMover(this.logger, {
      retryAttempts: config.retryAttempts,
      retryDelay: config.retryDelay
    });
    
    await this.configLoader.validate();
    
    this.watcher = new FileWatcher(this.logger, {
      watchDir: config.watchDir,
      ignorePatterns: config.ignorePatterns,
      onFileAdded: (filePath) => this.handleNewFile(filePath)
    });
    
    return this;
  }

  async handleNewFile(filePath) {
    try {
      this.logger.debug(`Processing: ${path.basename(filePath)}`);
      
      const sortResult = this.sorter.sort(filePath);
      const targetDir = path.join(
        path.dirname(filePath),
        sortResult.targetFolder
      );
      
      if (!sortResult.matched) {
        this.logger.debug(`No rule for ${sortResult.extension}, moving to ${sortResult.targetFolder}`);
      }
      
      await this.mover.move(filePath, targetDir);
      
      this.stats.filesProcessed++;
      this.stats.filesMoved++;
      this.stats.lastProcessed = new Date().toISOString();
      
    } catch (error) {
      this.stats.filesFailed++;
      await this.logger.error(`Failed to process ${path.basename(filePath)}:`, error.message);
    }
  }

  async start(configPath = null) {
    if (this.isRunning) {
      await this.logger.warn('AutoSort is already running');
      return;
    }

    await this.initialize(configPath);
    
    const config = this.configLoader.getConfig();
    
    await this.watcher.start();
    this.isRunning = true;
    this.stats.startedAt = new Date().toISOString();
    
    await this.logger.info(`Watching: ${config.watchDir}`);
    await this.logger.info(`Loaded ${this.configLoader.getRuleCount()} sorting rules`);
    await this.logger.info('Press Ctrl+C to stop...');
  }

  async stop() {
    if (!this.isRunning) {
      return;
    }

    await this.watcher.stop();
    this.isRunning = false;
    
    await this.logger.info('AutoSort stopped');
    await this.printStats();
  }

  async printStats() {
    const stats = this.getStats();
    await this.logger.info('Statistics:');
    await this.logger.info(`  Files processed: ${stats.filesProcessed}`);
    await this.logger.info(`  Files moved: ${stats.filesMoved}`);
    await this.logger.info(`  Files failed: ${stats.filesFailed}`);
    if (stats.lastProcessed) {
      await this.logger.info(`  Last processed: ${stats.lastProcessed}`);
    }
  }

  getStats() {
    return { ...this.stats };
  }

  getStatus() {
    return {
      running: this.isRunning,
      watching: this.watcher?.isWatching() || false,
      watchDir: this.watcher?.getWatchDir() || null,
      stats: this.getStats()
    };
  }
}

module.exports = AutoSort;
