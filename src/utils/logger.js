const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

class Logger {
  constructor(options = {}) {
    this.silent = options.silent || false;
    this.verbose = options.verbose || false;
    this.logFile = options.logFile || null;
  }

  async _writeToFile(message) {
    if (this.logFile) {
      const timestamp = new Date().toISOString();
      await fs.appendFile(this.logFile, `[${timestamp}] ${message}\n`);
    }
  }

  formatMessage(level, icon, color, message, ...args) {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const formattedMessage = args.length > 0 
      ? `${message} ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`
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
    const fileName = path.basename(filePath);
    const destDir = path.basename(path.dirname(destPath));
    const formatted = this.formatMessage('MOVED', '→', chalk.cyan, `${fileName} → ${destDir}/`);
    console.log(formatted);
    await this._writeToFile(`[MOVED] ${filePath} -> ${destPath}`);
  }

  async watchStart(watchDir, rulesCount) {
    await this.info(`Watching: ${chalk.bold(watchDir)}`);
    await this.info(`Loaded ${chalk.cyan(rulesCount)} sorting rules`);
    await this.info('Press Ctrl+C to stop...');
  }

  banner() {
    console.log(`
${chalk.cyan('╔═══════════════════════════════════════════════╗')}
${chalk.cyan('║')}  ${chalk.bold.white('AutoSort')} ${chalk.gray('v1.0.0')} ${chalk.cyan('                      ║')}
${chalk.cyan('║')}  ${chalk.white('Smart Downloads Organizer')}              ${chalk.cyan('║')}
${chalk.cyan('╚═══════════════════════════════════════════════╝')}
    `);
  }
}

module.exports = Logger;
