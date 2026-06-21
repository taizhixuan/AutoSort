const readline = require('readline/promises');
const { stdin, stdout } = require('process');
const path = require('path');
const chalk = require('chalk');
const { defaultWatchDir } = require('../utils/paths');

/**
 * Interactive `init` wizard. Prompts the user for the essentials and returns a
 * config object (the caller writes it to disk). Uses the built-in readline —
 * no extra dependency.
 *
 * @param {object} [defaults]
 * @returns {Promise<object>} config content
 */
async function runInitWizard(defaults = {}) {
  const rl = readline.createInterface({ input: stdin, output: stdout });

  const ask = async (question, fallback) => {
    const suffix = fallback ? chalk.gray(` (${fallback})`) : '';
    const answer = (await rl.question(`${question}${suffix}: `)).trim();
    return answer || fallback;
  };

  const askYesNo = async (question, fallback = false) => {
    const hint = fallback ? 'Y/n' : 'y/N';
    const answer = (await rl.question(`${question} ${chalk.gray(`(${hint})`)}: `))
      .trim()
      .toLowerCase();
    if (!answer) return fallback;
    return answer === 'y' || answer === 'yes';
  };

  try {
    console.log(chalk.bold('\nAutoSort setup\n'));
    console.log(chalk.gray('Press Enter to accept the default shown in parentheses.\n'));

    const watchDir = path.resolve(
      await ask('Folder to organize', defaults.watchDir || defaultWatchDir())
    );
    const unsortedFolder = await ask(
      'Folder name for unmatched files',
      defaults.unsortedFolder || 'Unsorted'
    );
    const recursive = await askYesNo(
      'Also organize files in subfolders?',
      defaults.recursive || false
    );

    return {
      watchDir,
      rules: {},
      unsortedFolder,
      ignorePatterns: [],
      recursive,
      retryAttempts: 3,
      retryDelay: 1000,
      patternRules: [],
      sizeRules: [],
      dateRules: []
    };
  } finally {
    rl.close();
  }
}

module.exports = { runInitWizard };
