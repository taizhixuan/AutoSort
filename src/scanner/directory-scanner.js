const fs = require('fs').promises;
const path = require('path');
const { matchPattern } = require('../utils/pattern');
const { STATE_DIR_NAME, DEFAULT_CONFIG_FILENAME } = require('../constants');

/**
 * Scan a directory for files to organize.
 *
 * Skips:
 *  - directories AutoSort manages (its rule targets + unsorted folder), so a
 *    re-run never re-sorts files it already placed;
 *  - the `.autosort` state directory;
 *  - anything matching `ignorePatterns` (glob, matched against the basename).
 *
 * @param {string} dir
 * @param {object} [options]
 * @param {boolean} [options.recursive=false]
 * @param {string[]} [options.ignorePatterns=[]]
 * @param {Set<string>|string[]} [options.managedFolders=[]] top-level folder names to skip
 * @returns {Promise<string[]>} absolute file paths
 */
async function scan(dir, options = {}) {
  const recursive = options.recursive === true;
  const ignorePatterns = options.ignorePatterns || [];
  const managed = new Set(options.managedFolders || []);

  const isIgnored = (name) => ignorePatterns.some((p) => matchPattern(name, p, 'glob'));

  const results = [];

  async function walk(current, depth) {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const name = entry.name;
      const full = path.join(current, name);

      if (entry.isDirectory()) {
        if (name === STATE_DIR_NAME) continue;
        // Only treat top-level (depth 0) directories as "managed" targets.
        if (depth === 0 && managed.has(name)) continue;
        if (isIgnored(name)) continue;
        if (recursive) {
          await walk(full, depth + 1);
        }
        continue;
      }

      if (entry.isFile() && name !== DEFAULT_CONFIG_FILENAME && !isIgnored(name)) {
        results.push(full);
      }
    }
  }

  await walk(dir, 0);
  return results;
}

/**
 * Derive the set of top-level folder names AutoSort manages, from the rules and
 * any pattern/size/date rule targets plus the unsorted folder.
 */
function managedFoldersFrom(rules = {}, extras = {}) {
  const folders = new Set();
  const add = (folder) => {
    if (folder) folders.add(String(folder).split('/')[0].split('\\')[0]);
  };
  Object.values(rules).forEach(add);
  if (extras.unsortedFolder) add(extras.unsortedFolder);
  (extras.patternRules || []).forEach((r) => r && add(r.folder));
  (extras.sizeRules || []).forEach((r) => r && add(r.folder));
  (extras.dateRules || []).forEach((r) => r && add(r.folder));
  return folders;
}

module.exports = { scan, managedFoldersFrom };
