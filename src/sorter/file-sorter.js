const path = require('path');

class FileSorter {
  constructor(rules, logger, options = {}) {
    this.rules = rules;
    this.logger = logger;
    this.unsortedFolder = options.unsortedFolder || 'Unsorted';
    this.caseSensitive = options.caseSensitive || false;
  }

  getExtension(filePath) {
    const ext = path.extname(filePath);
    if (this.caseSensitive) {
      return ext;
    }
    return ext.toLowerCase();
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

  sort(filePath) {
    const extension = this.getExtension(filePath);
    const fileName = path.basename(filePath, extension);
    
    this.logger.debug(`Sorting: ${fileName} (ext: ${extension || 'none'})`);

    if (!extension) {
      this.logger.debug(`No extension found for: ${fileName}, using unsorted folder`);
      return {
        fileName,
        extension: '',
        matched: false,
        targetFolder: this.unsortedFolder
      };
    }

    const matchResult = this.matchRule(extension);

    return {
      fileName,
      extension,
      matched: matchResult.matched,
      rule: matchResult.rule,
      targetFolder: matchResult.targetFolder
    };
  }

  setUnsortedFolder(folder) {
    this.unsortedFolder = folder;
  }

  addRule(extension, targetFolder) {
    const ext = this.caseSensitive ? extension : extension.toLowerCase();
    this.rules[ext] = targetFolder;
    this.logger.debug(`Added rule: ${ext} -> ${targetFolder}`);
  }

  removeRule(extension) {
    const ext = this.caseSensitive ? extension : extension.toLowerCase();
    delete this.rules[ext];
    this.logger.debug(`Removed rule for: ${ext}`);
  }

  getRules() {
    return { ...this.rules };
  }

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

  listRules() {
    const ruleList = [];
    for (const [ext, folder] of Object.entries(this.rules)) {
      ruleList.push({ extension: ext, folder });
    }
    return ruleList.sort((a, b) => a.extension.localeCompare(b.extension));
  }
}

module.exports = FileSorter;
