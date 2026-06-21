/**
 * Normalize a file extension to a canonical form.
 *
 * Ensures a single leading dot and (unless caseSensitive) lowercases it, so
 * `JPG`, `.JPG` and `.jpg` all collapse to `.jpg`. This is the single source of
 * truth shared by ConfigLoader and FileSorter.
 *
 * @param {string} extension       raw extension, with or without a leading dot
 * @param {boolean} [caseSensitive=false]
 * @returns {string} normalized extension (e.g. ".jpg"), or "" for empty input
 */
function normalizeExtension(extension, caseSensitive = false) {
  if (!extension) {
    return '';
  }

  const withDot = extension.startsWith('.') ? extension : `.${extension}`;
  return caseSensitive ? withDot : withDot.toLowerCase();
}

module.exports = { normalizeExtension };
