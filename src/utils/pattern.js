/**
 * Filename pattern matching for "smarter rules".
 *
 * Supports two pattern types with zero dependencies:
 *  - "glob":  `*` (any run of chars) and `?` (single char), case-insensitive.
 *  - "regex": a JavaScript regular expression source string, case-insensitive.
 */

/** Escape regex metacharacters except the glob wildcards we handle ourselves. */
function escapeForGlob(str) {
  return str.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

/** Convert a glob pattern into a RegExp anchored to the whole string. */
function globToRegExp(glob) {
  const escaped = escapeForGlob(glob).replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

/**
 * Test whether a filename matches a pattern.
 *
 * @param {string} name       the file name (basename) to test
 * @param {string} pattern    the pattern source
 * @param {"glob"|"regex"} [type="glob"]
 * @returns {boolean}
 */
function matchPattern(name, pattern, type = 'glob') {
  if (!name || !pattern) {
    return false;
  }
  try {
    const re = type === 'regex' ? new RegExp(pattern, 'i') : globToRegExp(pattern);
    return re.test(name);
  } catch {
    // An invalid regex/glob should never crash sorting — treat as no match.
    return false;
  }
}

module.exports = { matchPattern, globToRegExp };
