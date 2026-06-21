const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const { version } = require('../../package.json');

class Logger {
  constructor(options = {}) {
    this.silent = options.silent || false;
    this.verbose = options.verbose || false;
    this.logFile = options.logFile || null;
  }

  /** Single canonical timestamp ("YYYY-MM-DD HH:MM:SS") for console and file. */
  _timestamp() {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
  }

  async _writeToFile(message) {
    if (this.logFile) {
      await fs.appendFile(this.logFile, `[${this._timestamp()}] ${message}\n`);
    }
  }

  formatMessage(level, icon, color, message, ...args) {
    const timestamp = this._timestamp();
    const formattedMessage =
      args.length > 0
        ? `${message} ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ')}`
        : message;
    return `${chalk.gray(`[${timestamp}]`)} ${color(`[${level}]`)} ${icon} ${formattedMessage}`;
  }

  async info(message, ...args) {
    if (this.silent) return;
    const formatted = this.formatMessage('INFO', 'ℹ', chalk.blue, message, ...args);
    console.log(formatted);
    await this._writeToFile(`[INFO] ${message}`);
  }

  async success(message, ...args) {
    if (this.silent) return;
    const formatted = this.formatMessage('SUCCESS', '✓', chalk.green, message, ...args);
    console.log(formatted);
    await this._writeToFile(`[SUCCESS] ${message}`);
  }

  async warn(message, ...args) {
    if (this.silent) return;
    const formatted = this.formatMessage('WARN', '⚠', chalk.yellow, message, ...args);
    console.warn(formatted);
    await this._writeToFile(`[WARN] ${message}`);
  }

  async error(message, ...args) {
    const formatted = this.formatMessage('ERROR', '✗', chalk.red, message, ...args);
    console.error(formatted);
    await this._writeToFile(`[ERROR] ${message}`);
  }

  async debug(message, ...args) {
    if (!this.verbose) return;
    const formatted = this.formatMessage('DEBUG', '◆', chalk.magenta, message, ...args);
    console.log(formatted);
    await this._writeToFile(`[DEBUG] ${message}`);
  }

  async logMove(filePath, destPath) {
    if (this.silent) {
      await this._writeToFile(`[MOVED] ${filePath} -> ${destPath}`);
      return;
    }
    const fileName = path.basename(filePath);
    const destDir = path.basename(path.dirname(destPath));
    const formatted = this.formatMessage('MOVED', '→', chalk.cyan, `${fileName} → ${destDir}/`);
    console.log(formatted);
    await this._writeToFile(`[MOVED] ${filePath} -> ${destPath}`);
  }

  /**
   * Print an end-of-run summary.
   * @param {{processed:number, moved:number, failed:number, skipped?:number,
   *          dryRun?:boolean, byFolder?: Record<string, number>}} stats
   */
  summary(stats) {
    if (this.silent) return;
    const title = stats.dryRun ? 'Dry-run summary (no files changed)' : 'Summary';
    console.log('\n' + chalk.bold(title));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(`${chalk.cyan('Processed:')} ${stats.processed}`);
    console.log(`${chalk.green(stats.dryRun ? 'Would move:' : 'Moved:')} ${stats.moved}`);
    if (stats.skipped) {
      console.log(`${chalk.yellow('Skipped:')}   ${stats.skipped}`);
    }
    if (stats.failed) {
      console.log(`${chalk.red('Failed:')}    ${stats.failed}`);
    }
    if (stats.byFolder && Object.keys(stats.byFolder).length > 0) {
      console.log(chalk.gray('─'.repeat(40)));
      for (const [folder, count] of Object.entries(stats.byFolder).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${chalk.cyan(folder)}: ${count}`);
      }
    }
    console.log(chalk.gray('─'.repeat(40)));
  }

  async watchStart(watchDir, rulesCount) {
    await this.info(`Watching: ${chalk.bold(watchDir)}`);
    await this.info(`Loaded ${chalk.cyan(rulesCount)} sorting rules`);
    await this.info('Press Ctrl+C to stop...');
  }

  banner() {
    console.log(`
${chalk.cyan('╔═══════════════════════════════════════════════╗')}
${chalk.cyan('║')}  ${chalk.bold.white('AutoSort')} ${chalk.gray('v' + version)} ${chalk.cyan('                      ║')}
${chalk.cyan('║')}  ${chalk.white('Smart Downloads Organizer')}              ${chalk.cyan('║')}
${chalk.cyan('╚═══════════════════════════════════════════════╝')}
    `);
  }
}

module.exports = Logger;
