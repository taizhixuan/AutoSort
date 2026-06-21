const fs = require('fs').promises;
const { defaultConfigPath } = require('../constants');

/**
 * Resolve which config file to use.
 *
 * - If an explicit path is provided, it is returned as-is.
 * - Otherwise the default `autosort.config.json` in the cwd is returned only if
 *   it exists; if it does not, `null` is returned so callers can fall back to
 *   built-in defaults.
 *
 * @param {string} [explicitPath]
 * @returns {Promise<string|null>}
 */
async function resolveConfigPath(explicitPath) {
  if (explicitPath) {
    return explicitPath;
  }

  const fallback = defaultConfigPath();
  try {
    await fs.access(fallback);
    return fallback;
  } catch {
    return null;
  }
}

module.exports = { resolveConfigPath };
