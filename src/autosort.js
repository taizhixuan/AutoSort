/**
 * AutoSort - Smart Downloads Organizer
 * 
 * @module autosort
 * @version 1.0.0
 */

// Core classes
const AutoSort = require('./index');
const Logger = require('./utils/logger');
const ConfigLoader = require('./config/config-loader');
const FileWatcher = require('./watcher/file-watcher');
const FileSorter = require('./sorter/file-sorter');
const FileMover = require('./mover/file-mover');

module.exports = {
  // Main class
  AutoSort,
  
  // Components
  Logger,
  ConfigLoader,
  FileWatcher,
  FileSorter,
  FileMover,
  
  // Version info
  VERSION: '1.0.0'
};
