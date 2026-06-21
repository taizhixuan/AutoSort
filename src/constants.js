const path = require('path');

/** Default filename AutoSort looks for / writes when none is given. */
const DEFAULT_CONFIG_FILENAME = 'autosort.config.json';

/** Folder (inside the watch dir) where AutoSort keeps its history/state. */
const STATE_DIR_NAME = '.autosort';

/** Absolute path to the default config file in the current working directory. */
function defaultConfigPath() {
  return path.join(process.cwd(), DEFAULT_CONFIG_FILENAME);
}

module.exports = {
  DEFAULT_CONFIG_FILENAME,
  STATE_DIR_NAME,
  defaultConfigPath
};
