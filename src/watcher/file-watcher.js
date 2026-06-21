const chokidar = require('chokidar');
const path = require('path');
const { matchPattern } = require('../utils/pattern');

class FileWatcher {
  constructor(logger, options = {}) {
    this.logger = logger;
    this.watcher = null;
    this.watchDir = options.watchDir || '';
    this.ignorePatterns = options.ignorePatterns || [];
    this.onFileAdded = options.onFileAdded || (() => {});
    this.onError = options.onError || (() => {});
    this.isReady = false;
    this.pendingFiles = new Set();
    this.debounceTimers = new Map();
    this.debounceDelay = options.debounceDelay || 500;
  }

  /**
   * Decide whether chokidar should ignore a path. User patterns are matched as
   * GLOBS against the file's basename — the same semantics as DirectoryScanner,
   * via the shared utils/pattern matcher. (Previously these were fed to
   * `new RegExp(p)`, which crashed on glob patterns like `*.tmp`.)
   *
   * @param {string} filePath
   * @returns {boolean}
   */
  _isIgnored(filePath) {
    const base = path.basename(filePath);

    // Hidden files and in-progress download/temp files are always ignored.
    if (base.startsWith('.')) return true;
    if (/\.(part|crdownload|download|tmp)$/i.test(base) || base.endsWith('~')) return true;

    // User-supplied glob patterns (safe: matchPattern never throws).
    return this.ignorePatterns.some((p) => matchPattern(base, p, 'glob'));
  }

  async start(watchDir) {
    if (watchDir) {
      this.watchDir = watchDir;
    }

    if (!this.watchDir) {
      throw new Error('Watch directory is required');
    }

    this.logger.debug(`Starting watcher on: ${this.watchDir}`);
    this.logger.debug(`Ignore patterns: ${this.ignorePatterns.length} user pattern(s)`);

    this.watcher = chokidar.watch(this.watchDir, {
      persistent: true,
      ignoreInitial: false,
      depth: 0,
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 100
      },
      ignored: (filePath) => this._isIgnored(filePath),
      usePolling: process.platform === 'win32',
      interval: 100,
      binaryInterval: 300
    });

    this._setupEventHandlers();

    await new Promise((resolve, reject) => {
      this.watcher.on('ready', () => {
        this.isReady = true;
        this.logger.debug('Watcher is ready and scanning');
        resolve();
      });

      this.watcher.on('error', (error) => {
        this.logger.error('Watcher error:', error);
        reject(error);
      });
    });

    return this;
  }

  _setupEventHandlers() {
    this.watcher
      .on('add', (filePath) => this._handleAdd(filePath))
      .on('error', (error) => this._handleError(error))
      .on('raw', (event, filePath, details) => {
        this.logger.debug(`Raw event: ${event}`, { filePath, details });
      });
  }

  _handleAdd(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    this.logger.debug(`File detected: ${path.basename(filePath)} (${ext || 'no extension'})`);

    if (this.debounceTimers.has(filePath)) {
      clearTimeout(this.debounceTimers.get(filePath));
    }

    const timer = setTimeout(async () => {
      this.debounceTimers.delete(filePath);
      this.pendingFiles.add(filePath);

      try {
        await this.onFileAdded(filePath);
      } catch (error) {
        await this._handleError(error);
      } finally {
        this.pendingFiles.delete(filePath);
      }
    }, this.debounceDelay);

    this.debounceTimers.set(filePath, timer);
  }

  async _handleError(error) {
    await this.logger.error('Watcher error:', error.message);
    this.onError(error);
  }

  async stop() {
    if (this.watcher) {
      this.logger.debug('Stopping watcher...');

      for (const timer of this.debounceTimers.values()) {
        clearTimeout(timer);
      }
      this.debounceTimers.clear();
      this.pendingFiles.clear();

      await this.watcher.close();
      this.watcher = null;
      this.isReady = false;
      await this.logger.debug('Watcher stopped');
    }
  }

  isWatching() {
    return this.watcher !== null && this.isReady;
  }

  getWatchDir() {
    return this.watchDir;
  }

  async getWatchedFiles() {
    if (!this.watcher) return [];
    return await this.watcher.watched();
  }
}

module.exports = FileWatcher;
