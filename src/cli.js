#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs').promises;

const AutoSort = require('./index');
const Logger = require('./utils/logger');
const ConfigLoader = require('./config/config-loader');
const FileSorter = require('./sorter/file-sorter');
const HistoryStore = require('./history/history-store');
const { defaultConfigPath } = require('./constants');
const { resolveConfigPath } = require('./utils/config-path');
const { onShutdown } = require('./utils/shutdown');
const { defaultWatchDir } = require('./utils/paths');
const { runInitWizard } = require('./wizard/init-wizard');

const program = new Command();

/** Friendly error printer; exits the process. */
function fail(error) {
  console.error(chalk.red('Error:'), error.message);
  if (/watch directory/i.test(error.message)) {
    console.log(chalk.gray('Tip: run "autosort init" to set up a folder to organize.'));
  }
  process.exit(1);
}

/**
 * Load config into an AutoSort instance and apply the watch-dir precedence:
 * --watch flag > config file > OS Downloads (zero-config default).
 */
async function prepare(autoSort, options) {
  const configPath = await resolveConfigPath(options.config);
  if (configPath) {
    await autoSort.configLoader.load(configPath);
  }
  if (options.watch) {
    autoSort.configLoader.setWatchDir(options.watch);
  } else if (!autoSort.configLoader.getConfig().watchDir) {
    autoSort.configLoader.setWatchDir(defaultWatchDir());
  }
}

program
  .name('autosort')
  .description('Smart Downloads Organizer - Automatically organize your files')
  .version('1.0.0');

program
  .command('start')
  .description('Watch a folder and sort new files as they arrive')
  .option('-w, --watch <directory>', 'Directory to watch for new files')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('-s, --silent', 'Suppress all console output')
  .option('--dry-run', 'Preview moves without changing anything')
  .action(async (options) => {
    const autoSort = new AutoSort({ verbose: options.verbose, silent: options.silent });
    try {
      await prepare(autoSort, options);
      await autoSort.start(null, { dryRun: options.dryRun });
      onShutdown(() => autoSort.stop());
    } catch (error) {
      fail(error);
    }
  });

program
  .command('organize')
  .alias('sort')
  .description('Sort the files already in a folder (one-shot)')
  .option('-w, --watch <directory>', 'Directory to organize')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-r, --recursive', 'Also organize files in subfolders')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('-s, --silent', 'Suppress all console output')
  .option('--dry-run', 'Preview moves without changing anything')
  .action(async (options) => {
    const autoSort = new AutoSort({ verbose: options.verbose, silent: options.silent });
    try {
      await prepare(autoSort, options);
      await autoSort.organize(null, { dryRun: options.dryRun, recursive: options.recursive });
    } catch (error) {
      fail(error);
    }
  });

program
  .command('undo')
  .description('Revert the most recent organize run')
  .option('-w, --watch <directory>', 'Directory whose history to undo')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (options) => {
    const autoSort = new AutoSort({ verbose: options.verbose });
    try {
      await prepare(autoSort, options);
      await autoSort.undo(null);
    } catch (error) {
      fail(error);
    }
  });

program
  .command('init')
  .description('Create a configuration file (interactive unless --watch is given)')
  .option('-w, --watch <directory>', 'Directory to watch (skips the wizard)')
  .option('-o, --output <path>', 'Output path for config file')
  .action(async (options) => {
    const outputPath = options.output || defaultConfigPath();
    try {
      let configContent;
      if (options.watch) {
        configContent = {
          watchDir: path.resolve(options.watch),
          rules: {},
          unsortedFolder: 'Unsorted',
          ignorePatterns: [],
          recursive: false,
          retryAttempts: 3,
          retryDelay: 1000,
          patternRules: [],
          sizeRules: [],
          dateRules: []
        };
      } else {
        configContent = await runInitWizard();
      }

      await fs.writeFile(outputPath, JSON.stringify(configContent, null, 2));
      console.log(chalk.green('✓'), `Configuration created at: ${outputPath}`);
      console.log(chalk.gray('Edit the file or use "autosort rules" to customize sorting.'));
    } catch (error) {
      fail(error);
    }
  });

program
  .command('rules')
  .description('Manage sorting rules')
  .option('-l, --list', 'List all current rules')
  .option('-a, --add <extension:folder>', 'Add a rule (e.g., .pdf:Documents/PDFs)')
  .option('-r, --remove <extension>', 'Remove a rule')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-e, --export <path>', 'Export rules to a file')
  .option('-i, --import <path>', 'Import rules from a file')
  .action(async (options) => {
    const logger = new Logger({ silent: true });
    const configLoader = new ConfigLoader(logger);

    try {
      const configPath = await resolveConfigPath(options.config);
      if (configPath) {
        await configLoader.load(configPath);
      }

      const savePath = options.config || defaultConfigPath();

      if (options.add) {
        const [ext, folder] = options.add.split(':');
        if (!ext || !folder) {
          throw new Error('Invalid format. Use: extension:folder (e.g., .pdf:Documents/PDFs)');
        }
        configLoader.addRule(ext, folder);
        await configLoader.save(savePath);
        console.log(chalk.green('✓'), `Added rule: ${ext} -> ${folder}`);
      }

      if (options.remove) {
        configLoader.removeRule(options.remove);
        await configLoader.save(savePath);
        console.log(chalk.green('✓'), `Removed rule: ${options.remove}`);
      }

      if (options.export) {
        await configLoader.exportRules(options.export);
      }

      if (options.import) {
        await configLoader.importRules(options.import);
      }

      if (options.list) {
        const sorter = new FileSorter(configLoader.getRules(), logger);
        const byFolder = sorter.getRulesByFolder();

        console.log(chalk.bold('\nSorting Rules:\n'));
        for (const [folder, extensions] of Object.entries(byFolder)) {
          console.log(chalk.cyan(folder) + ':');
          console.log('  ' + extensions.join(', '));
          console.log('');
        }
        console.log(chalk.gray(`Total: ${configLoader.getRuleCount()} rules`));
      }

      if (!options.list && !options.add && !options.remove && !options.export && !options.import) {
        console.log(chalk.yellow('No action specified. Use --help to see available options.'));
      }
    } catch (error) {
      fail(error);
    }
  });

program
  .command('status')
  .description('Show configuration and recent activity')
  .option('-c, --config <path>', 'Path to configuration file')
  .action(async (options) => {
    const logger = new Logger({ silent: true });
    const configLoader = new ConfigLoader(logger);

    try {
      const configPath = await resolveConfigPath(options.config);
      if (!configPath) {
        console.log(chalk.yellow('⚠ No configuration file found.'));
        console.log(chalk.gray('Run "autosort init" to create one.'));
        return;
      }

      await configLoader.load(configPath);
      const config = configLoader.getConfig();

      console.log(chalk.bold('\nAutoSort Configuration\n'));
      console.log(chalk.gray('─'.repeat(40)));
      console.log(chalk.cyan('Watch Directory:'), config.watchDir || chalk.yellow('Not set'));
      console.log(chalk.cyan('Unsorted Folder:'), config.unsortedFolder);
      console.log(chalk.cyan('Recursive:'), config.recursive ? 'yes' : 'no');
      console.log(chalk.cyan('Total Rules:'), configLoader.getRuleCount());
      console.log(chalk.cyan('Pattern Rules:'), (config.patternRules || []).length);
      console.log(chalk.cyan('Retry Attempts:'), config.retryAttempts);
      console.log(chalk.cyan('Retry Delay:'), `${config.retryDelay}ms`);

      if (config.watchDir) {
        const run = await new HistoryStore(config.watchDir).getLastRun();
        console.log(chalk.gray('─'.repeat(40)));
        if (run) {
          console.log(chalk.cyan('Last Organize:'), `${run.at} (${run.moves.length} files moved)`);
          console.log(chalk.gray('Run "autosort undo" to revert it.'));
        } else {
          console.log(chalk.gray('No organize runs recorded yet.'));
        }
      }
      console.log(chalk.gray('─'.repeat(40)));
    } catch (error) {
      fail(error);
    }
  });

program.addHelpText(
  'after',
  `
Examples:
  $ autosort init                       Interactive setup
  $ autosort organize --dry-run         Preview sorting the current folder
  $ autosort organize                   Sort the files in your folder now
  $ autosort undo                       Revert the last organize
  $ autosort start                      Watch and auto-sort new files
  $ autosort rules --add .pdf:Documents/PDFs
  $ autosort status                     Show config and recent activity
`
);

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
