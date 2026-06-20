#!/usr/bin/env node

const path = require('path');
const AutoSort = require('./index');
const Logger = require('./utils/logger');
const ConfigLoader = require('./config/config-loader');

async function main() {
  const logger = new Logger({});
  const configLoader = new ConfigLoader(logger);
  
  // Default config path
  const configPath = path.join(process.cwd(), 'autosort.config.json');
  
  try {
    await configLoader.load(configPath);
    const config = configLoader.getConfig();
    
    const autoSort = new AutoSort({});
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('\nShutting down...');
      await autoSort.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.info('\nShutting down...');
      await autoSort.stop();
      process.exit(0);
    });
    
    await autoSort.start(configPath);
    
  } catch (error) {
    logger.error('Failed to start AutoSort:', error.message);
    process.exit(1);
  }
}

main();
