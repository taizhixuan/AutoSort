const path = require('path');
const Logger = require('./utils/logger');
const ConfigLoader = require('./config/config-loader');
const FileWatcher = require('./watcher/file-watcher');
const FileSorter = require('./sorter/file-sorter');
const FileMover = require('./mover/file-mover');
const HistoryStore = require('./history/history-store');
const { scan, managedFoldersFrom } = require('./scanner/directory-scanner');

class AutoSort {
  constructor(options = {}) {
    this.logger = new Logger(options);
    this.configLoader = new ConfigLoader(this.logger);
    this.watcher = null;
    this.sorter = null;
    this.mover = null;
    this.history = null;
    this.isRunning = false;
    this.initialized = false;
    this.dryRun = false;
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
      unsortedFolder: config.unsortedFolder,
      patternRules: config.patternRules,
      sizeRules: config.sizeRules,
      dateRules: config.dateRules
    });

    this.mover = new FileMover(this.logger, {
      retryAttempts: config.retryAttempts,
      retryDelay: config.retryDelay
    });

    await this.configLoader.validate();

    this.history = new HistoryStore(config.watchDir);

    this.watcher = new FileWatcher(this.logger, {
      watchDir: config.watchDir,
      ignorePatterns: config.ignorePatterns,
      onFileAdded: (filePath) => this.handleNewFile(filePath)
    });

    this.initialized = true;
    return this;
  }

  /** True when size/date rules are configured and a stat is worth doing. */
  _needsStat() {
    return this.sorter.sizeRules.length + this.sorter.dateRules.length > 0;
  }

  /**
   * Sort and (unless dryRun) move a single file. The shared pipeline used by the
   * watcher and by `organize`.
   *
   * @param {string} filePath
   * @param {object} [opts]
   * @param {boolean} [opts.dryRun=false]
   * @param {string} [opts.baseDir] base for the target folder (default: file's dir)
   * @param {Array} [opts.moves] collector for {from,to} of real moves (for history)
   * @returns {Promise<object>} result describing the (planned) move
   */
  async processFile(filePath, opts = {}) {
    const dryRun = opts.dryRun === true;
    const baseDir = opts.baseDir || path.dirname(filePath);

    let fileInfo = null;
    if (this._needsStat()) {
      const info = await this.mover.getFileInfo(filePath);
      if (info) {
        fileInfo = { size: info.size, mtime: info.modified };
      }
    }

    const sortResult = this.sorter.sort(filePath, fileInfo);
    const targetDir = path.join(baseDir, sortResult.targetFolder);

    if (!sortResult.matched) {
      this.logger.debug(`No rule for ${path.basename(filePath)}, using ${sortResult.targetFolder}`);
    }

    const moveResult = await this.mover.move(filePath, targetDir, { dryRun });

    this.stats.filesProcessed++;
    if (moveResult.moved) {
      this.stats.filesMoved++;
      this.stats.lastProcessed = new Date().toISOString();
      if (opts.moves) {
        opts.moves.push({ from: filePath, to: moveResult.destPath });
      }
    }

    return {
      file: filePath,
      fileName: path.basename(filePath),
      matched: sortResult.matched,
      targetFolder: sortResult.targetFolder,
      destPath: moveResult.destPath,
      moved: moveResult.moved,
      dryRun
    };
  }

  async handleNewFile(filePath) {
    try {
      this.logger.debug(`Processing: ${path.basename(filePath)}`);
      const moves = [];
      await this.processFile(filePath, { dryRun: this.dryRun, moves });
      if (!this.dryRun && moves.length > 0) {
        await this.history.record(moves);
      }
    } catch (error) {
      this.stats.filesFailed++;
      await this.logger.error(`Failed to process ${path.basename(filePath)}:`, error.message);
    }
  }

  /**
   * Organize the files already present in the watch directory.
   *
   * @param {string|null} configPath
   * @param {object} [opts]
   * @param {boolean} [opts.dryRun=false]
   * @param {boolean} [opts.recursive]
   * @returns {Promise<object>} summary { processed, moved, failed, dryRun, byFolder, results }
   */
  async organize(configPath = null, opts = {}) {
    if (!this.initialized) {
      await this.initialize(configPath);
    }
    const config = this.configLoader.getConfig();
    const dryRun = opts.dryRun === true;
    const recursive = opts.recursive !== undefined ? opts.recursive : config.recursive;

    const managed = managedFoldersFrom(this.configLoader.getRules(), {
      unsortedFolder: config.unsortedFolder,
      patternRules: config.patternRules,
      sizeRules: config.sizeRules,
      dateRules: config.dateRules
    });

    const files = await scan(config.watchDir, {
      recursive,
      ignorePatterns: config.ignorePatterns,
      managedFolders: managed
    });

    const summary = { processed: 0, moved: 0, failed: 0, dryRun, byFolder: {}, results: [] };
    const moves = [];

    for (const file of files) {
      try {
        const result = await this.processFile(file, { dryRun, baseDir: config.watchDir, moves });
        summary.processed++;
        if (result.moved || dryRun) {
          summary.moved++;
          summary.byFolder[result.targetFolder] = (summary.byFolder[result.targetFolder] || 0) + 1;
        }
        summary.results.push(result);
      } catch (error) {
        summary.failed++;
        this.stats.filesFailed++;
        await this.logger.error(`Failed: ${path.basename(file)}:`, error.message);
      }
    }

    if (!dryRun && moves.length > 0) {
      await this.history.record(moves);
    }

    this.logger.summary(summary);
    return summary;
  }

  /**
   * Revert the most recent organize run.
   * @returns {Promise<object>} { reverted, failed, total }
   */
  async undo(configPath = null) {
    if (!this.initialized) {
      await this.initialize(configPath);
    }
    const run = await this.history.getLastRun();
    if (!run || run.moves.length === 0) {
      await this.logger.warn('Nothing to undo.');
      return { reverted: 0, failed: 0, total: 0 };
    }

    let reverted = 0;
    let failed = 0;
    // Reverse order so conflict-resolved names unwind cleanly.
    for (const move of [...run.moves].reverse()) {
      try {
        const result = await this.mover.move(move.to, path.dirname(move.from));
        if (result.moved) reverted++;
      } catch (error) {
        failed++;
        await this.logger.error(`Could not restore ${path.basename(move.to)}:`, error.message);
      }
    }

    await this.history.clearLastRun();
    await this.logger.info(
      `Undo complete: restored ${reverted} file(s)${failed ? `, ${failed} failed` : ''}.`
    );
    return { reverted, failed, total: run.moves.length };
  }

  async start(configPath = null, opts = {}) {
    if (this.isRunning) {
      await this.logger.warn('AutoSort is already running');
      return;
    }

    this.dryRun = opts.dryRun === true;
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
