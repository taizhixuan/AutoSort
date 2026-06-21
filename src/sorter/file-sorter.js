const path = require('path');
const { normalizeExtension } = require('../utils/extension');
const { matchPattern } = require('../utils/pattern');

class FileSorter {
  constructor(rules, logger, options = {}) {
    this.rules = rules;
    this.logger = logger;
    this.unsortedFolder = options.unsortedFolder || 'Unsorted';
    this.caseSensitive = options.caseSensitive || false;
    // Smarter rules (all optional, evaluated before extension rules).
    this.patternRules = options.patternRules || [];
    this.sizeRules = options.sizeRules || [];
    this.dateRules = options.dateRules || [];
  }

  getExtension(filePath) {
    return normalizeExtension(path.extname(filePath), this.caseSensitive);
  }

  matchRule(extension) {
    const normalizedExt = this.caseSensitive ? extension : extension.toLowerCase();

    if (this.rules[normalizedExt]) {
      return {
        matched: true,
        rule: normalizedExt,
        targetFolder: this.rules[normalizedExt]
      };
    }

    if (!this.caseSensitive) {
      const upperExt = normalizedExt.toUpperCase();
      if (this.rules[upperExt]) {
        return {
          matched: true,
          rule: upperExt,
          targetFolder: this.rules[upperExt]
        };
      }
    }

    return {
      matched: false,
      rule: normalizedExt,
      targetFolder: this.unsortedFolder
    };
  }

  /** Match by filename pattern (glob/regex). Returns folder or null. */
  matchPatternRule(fileName) {
    for (const rule of this.patternRules) {
      if (rule && rule.match && rule.folder && matchPattern(fileName, rule.match, rule.type)) {
        return rule.folder;
      }
    }
    return null;
  }

  /** Match by file size. `fileInfo.size` is in bytes. Returns folder or null. */
  matchSizeRule(size) {
    if (typeof size !== 'number') {
      return null;
    }
    for (const rule of this.sizeRules) {
      if (!rule || !rule.folder) continue;
      const minBytes = (rule.minSizeMB || 0) * 1024 * 1024;
      if (size >= minBytes) {
        return rule.folder;
      }
    }
    return null;
  }

  /** Match by modified-age. `mtime` is a Date or epoch ms. Returns folder or null. */
  matchDateRule(mtime, now = Date.now()) {
    if (mtime == null) {
      return null;
    }
    const mtimeMs = mtime instanceof Date ? mtime.getTime() : mtime;
    const ageDays = (now - mtimeMs) / (1000 * 60 * 60 * 24);
    for (const rule of this.dateRules) {
      if (!rule || !rule.folder) continue;
      if (typeof rule.olderThanDays === 'number' && ageDays >= rule.olderThanDays) {
        return rule.folder;
      }
    }
    return null;
  }

  /**
   * Decide where a file should go.
   *
   * Precedence: filename pattern rules > extension rules > size rules >
   * date rules > unsorted folder. Size/date rules only apply when `fileInfo`
   * (with `size` / `mtime`) is supplied, so extension-only callers are unaffected.
   *
   * @param {string} filePath
   * @param {{size?: number, mtime?: Date|number}} [fileInfo]
   */
  sort(filePath, fileInfo = null) {
    const extension = this.getExtension(filePath);
    const baseName = path.basename(filePath);
    const fileName = path.basename(filePath, extension);

    this.logger.debug(`Sorting: ${fileName} (ext: ${extension || 'none'})`);

    // 1. Filename pattern rules win (most specific user intent).
    const patternFolder = this.matchPatternRule(baseName);
    if (patternFolder) {
      return { fileName, extension, matched: true, rule: 'pattern', targetFolder: patternFolder };
    }

    // 2. Extension rules.
    if (extension) {
      const matchResult = this.matchRule(extension);
      if (matchResult.matched) {
        return {
          fileName,
          extension,
          matched: true,
          rule: matchResult.rule,
          targetFolder: matchResult.targetFolder
        };
      }
    }

    // 3. Size / date rules (only when stats are available).
    if (fileInfo) {
      const sizeFolder = this.matchSizeRule(fileInfo.size);
      if (sizeFolder) {
        return { fileName, extension, matched: true, rule: 'size', targetFolder: sizeFolder };
      }
      const dateFolder = this.matchDateRule(fileInfo.mtime);
      if (dateFolder) {
        return { fileName, extension, matched: true, rule: 'date', targetFolder: dateFolder };
      }
    }

    // 4. Fallback.
    if (!extension) {
      this.logger.debug(`No extension found for: ${fileName}, using unsorted folder`);
    }
    return {
      fileName,
      extension,
      matched: false,
      rule: extension || '',
      targetFolder: this.unsortedFolder
    };
  }

  setUnsortedFolder(folder) {
    this.unsortedFolder = folder;
  }

  addRule(extension, targetFolder) {
    const ext = normalizeExtension(extension, this.caseSensitive);
    this.rules[ext] = targetFolder;
    this.logger.debug(`Added rule: ${ext} -> ${targetFolder}`);
  }

  removeRule(extension) {
    const ext = normalizeExtension(extension, this.caseSensitive);
    delete this.rules[ext];
    this.logger.debug(`Removed rule for: ${ext}`);
  }

  getRules() {
    return { ...this.rules };
  }

  /** Group rules by top-level category (e.g. "Documents/PDFs" -> "Documents"). */
  getRulesByCategory() {
    const categories = {};

    for (const [ext, folder] of Object.entries(this.rules)) {
      const category = folder.split('/')[0];
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push({ extension: ext, folder });
    }

    return categories;
  }

  /** Group rules by full target folder (used by the CLI rules listing). */
  getRulesByFolder() {
    const folders = {};
    const sorted = Object.entries(this.rules).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [ext, folder] of sorted) {
      if (!folders[folder]) {
        folders[folder] = [];
      }
      folders[folder].push(ext);
    }
    return folders;
  }

  listRules() {
    const ruleList = [];
    for (const [ext, folder] of Object.entries(this.rules)) {
      ruleList.push({ extension: ext, folder });
    }
    return ruleList.sort((a, b) => a.extension.localeCompare(b.extension));
  }
}

module.exports = FileSorter;
