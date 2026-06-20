#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs').promises;
const AutoSort = require('./index');

const program = new Command();

program
  .name('autosort')
  .description('Smart Downloads Organizer - Automatically organize your files')
  .version('1.0.0');

program
  .command('start')
  .description('Start the AutoSort watcher')
  .option('-w, --watch <directory>', 'Directory to watch for new files')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('-s, --silent', 'Suppress all console output')
  .action(async (options) => {
    const autoSort = new AutoSort({
      verbose: options.verbose,
      silent: options.silent
    });

    try {
      let configPath = options.config;
      
      if (!configPath) {
        const defaultConfig = path.join(process.cwd(), 'autosort.config.json');
        try {
          await fs.access(defaultConfig);
          configPath = defaultConfig;
        } catch {
          configPath = null;
        }
      }

      if (options.watch) {
        const { ConfigLoader } = require('./config/config-loader');
        const logger = new (require('./utils/logger'))({ verbose: options.verbose, silent: options.silent });
        const configLoader = new ConfigLoader(logger);
        configLoader.setWatchDir(options.watch);
        await fs.writeFile(
          path.join(process.cwd(), 'autosort.config.json'),
          JSON.stringify({ watchDir: options.watch }, null, 2)
        );
        configPath = path.join(process.cwd(), 'autosort.config.json');
      }

      await autoSort.start(configPath);

      process.on('SIGINT', async () => {
        console.log('\n');
        await autoSort.stop();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        await autoSort.stop();
        process.exit(0);
      });

    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize a new configuration file')
  .option('-w, --watch <directory>', 'Directory to watch')
  .option('-o, --output <path>', 'Output path for config file')
  .action(async (options) => {
    const outputPath = options.output || path.join(process.cwd(), 'autosort.config.json');
    const watchDir = options.watch || process.cwd();

    try {
      const configContent = {
        watchDir: path.resolve(watchDir),
        rules: {},
        unsortedFolder: 'Unsorted',
        ignorePatterns: [],
        retryAttempts: 3,
        retryDelay: 1000
      };

      await fs.writeFile(outputPath, JSON.stringify(configContent, null, 2));
      console.log(chalk.green('✓'), `Configuration created at: ${outputPath}`);
      console.log(chalk.gray('Edit the file to customize your sorting rules.'));
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('rules')
  .description('Manage sorting rules')
  .option('-l, --list', 'List all current rules')
  .option('-a, --add <extension:folder>', 'Add a new rule (e.g., .pdf:Documents/PDFs)')
  .option('-r, --remove <extension>', 'Remove a rule')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-e, --export <path>', 'Export rules to a file')
  .option('-i, --import <path>', 'Import rules from a file')
  .action(async (options) => {
    const Logger = require('./utils/logger');
    const ConfigLoader = require('./config/config-loader');
    
    const logger = new Logger({ silent: true });
    const configLoader = new ConfigLoader(logger);

    try {
      if (options.config) {
        await configLoader.load(options.config);
      }

      if (options.add) {
        const [ext, folder] = options.add.split(':');
        if (!ext || !folder) {
          console.error(chalk.red('Error:'), 'Invalid format. Use: extension:folder (e.g., .pdf:Documents/PDFs)');
          process.exit(1);
        }
        configLoader.addRule(ext, folder);
        
        const configPath = options.config || path.join(process.cwd(), 'autosort.config.json');
        await configLoader.save(configPath);
        console.log(chalk.green('✓'), `Added rule: ${ext} -> ${folder}`);
      }

      if (options.remove) {
        configLoader.removeRule(options.remove);
        
        const configPath = options.config || path.join(process.cwd(), 'autosort.config.json');
        await configLoader.save(configPath);
        console.log(chalk.green('✓'), `Removed rule: ${options.remove}`);
      }

      if (options.export) {
        await configLoader.exportRules(options.export);
      }

      if (options.import) {
        await configLoader.importRules(options.import);
      }

      if (options.list) {
        const rules = configLoader.getRules();
        const sorted = Object.entries(rules).sort((a, b) => a[0].localeCompare(b[0]));
        
        console.log(chalk.bold('\nSorting Rules:\n'));
        
        const categories = {};
        for (const [ext, folder] of sorted) {
          if (!categories[folder]) {
            categories[folder] = [];
          }
          categories[folder].push(ext);
        }
        
        for (const [folder, extensions] of Object.entries(categories)) {
          console.log(chalk.cyan(folder) + ':');
          console.log('  ' + extensions.join(', '));
          console.log('');
        }
        
        console.log(chalk.gray(`Total: ${sorted.length} rules`));
      }

      if (!options.list && !options.add && !options.remove && !options.export && !options.import) {
        console.log(chalk.yellow('No action specified. Use --help to see available options.'));
      }

    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Check AutoSort status')
  .option('-c, --config <path>', 'Path to configuration file')
  .action(async (options) => {
    const configPath = options.config || path.join(process.cwd(), 'autosort.config.json');
    
    try {
      const config = require(path.resolve(configPath));
      const Logger = require('./utils/logger');
      const ConfigLoader = require('./config/config-loader');
      
      const logger = new Logger({ silent: true });
      const configLoader = new ConfigLoader(logger);
      await configLoader.load(configPath);
      
      console.log(chalk.bold('\nAutoSort Configuration\n'));
      console.log(chalk.gray('─'.repeat(40)));
      console.log(chalk.cyan('Watch Directory:'), config.watchDir || chalk.yellow('Not set'));
      console.log(chalk.cyan('Unsorted Folder:'), config.unsortedFolder || 'Unsorted');
      console.log(chalk.cyan('Total Rules:'), configLoader.getRuleCount());
      console.log(chalk.cyan('Retry Attempts:'), config.retryAttempts || 3);
      console.log(chalk.cyan('Retry Delay:'), `${config.retryDelay || 1000}ms`);
      console.log(chalk.gray('─'.repeat(40)));
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(chalk.yellow('⚠ No configuration file found.'));
        console.log(chalk.gray('Run "autosort init" to create one.'));
      } else {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    }
  });

program
  .command('test')
  .description('Test configuration without actually moving files')
  .option('-w, --watch <directory>', 'Directory to watch')
  .option('-c, --config <path>', 'Path to configuration file')
  .action(async (options) => {
    const Logger = require('./utils/logger');
    const ConfigLoader = require('./config/config-loader');
    const FileSorter = require('./sorter/file-sorter');
    const FileWatcher = require('./watcher/file-watcher');
    
    const logger = new Logger({ verbose: true });
    const configLoader = new ConfigLoader(logger);
    
    try {
      if (options.config) {
        await configLoader.load(options.config);
      }
      
      if (options.watch) {
        configLoader.setWatchDir(options.watch);
      }
      
      await configLoader.validate();
      
      const config = configLoader.getConfig();
      const rules = configLoader.getRules();
      const sorter = new FileSorter(rules, logger, { unsortedFolder: config.unsortedFolder });
      
      console.log(chalk.bold('\nAutoSort Test Mode\n'));
      console.log(chalk.cyan('Watch Directory:'), config.watchDir);
      console.log(chalk.cyan('Rules Loaded:'), configLoader.getRuleCount());
      console.log(chalk.gray('─'.repeat(40)));
      console.log(chalk.green('✓ Configuration is valid!'));
      console.log(chalk.gray('\nMonitoring for files (Ctrl+C to exit)...\n'));
      
      const watcher = new FileWatcher(logger, {
        watchDir: config.watchDir,
        onFileAdded: async (filePath) => {
          const result = sorter.sort(filePath);
          console.log(chalk.gray('→'), chalk.white(path.basename(filePath)), 
            chalk.gray('→'), chalk.cyan(result.targetFolder));
        }
      });
      
      await watcher.start();
      
      process.on('SIGINT', async () => {
        await watcher.stop();
        console.log(chalk.yellow('\nTest stopped.'));
        process.exit(0);
      });
      
    } catch (error) {
      console.error(chalk.red('✗ Error:'), error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
