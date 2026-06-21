const os = require('os');
const path = require('path');

/**
 * Best-effort path to the user's OS Downloads folder, used as the zero-config
 * default watch directory. Falls back to the current working directory.
 *
 * @returns {string}
 */
function defaultWatchDir() {
  const home = os.homedir();
  if (!home) {
    return process.cwd();
  }
  return path.join(home, 'Downloads');
}

module.exports = { defaultWatchDir };
