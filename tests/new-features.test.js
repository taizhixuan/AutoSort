/**
 * Tests for the de-duplication helpers and the new organize/dry-run/undo
 * /smarter-rules features.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');

const { normalizeExtension } = require('../src/utils/extension');
const { matchPattern } = require('../src/utils/pattern');
const { scan, managedFoldersFrom } = require('../src/scanner/directory-scanner');
const HistoryStore = require('../src/history/history-store');
const FileSorter = require('../src/sorter/file-sorter');
const FileMover = require('../src/mover/file-mover');
const FileWatcher = require('../src/watcher/file-watcher');
const AutoSort = require('../src/index');

const mockLogger = () => ({
  debug() {},
  info() {},
  warn() {},
  error() {},
  success() {},
  logMove() {},
  summary() {},
  banner() {}
});

const mkTmp = () => fs.mkdtemp(path.join(os.tmpdir(), 'autosort-test-'));

describe('normalizeExtension', () => {
  test('adds leading dot and lowercases by default', () => {
    assert.strictEqual(normalizeExtension('PDF'), '.pdf');
    assert.strictEqual(normalizeExtension('.JPG'), '.jpg');
    assert.strictEqual(normalizeExtension('.png'), '.png');
  });

  test('respects caseSensitive', () => {
    assert.strictEqual(normalizeExtension('.JPG', true), '.JPG');
  });

  test('handles empty input', () => {
    assert.strictEqual(normalizeExtension(''), '');
    assert.strictEqual(normalizeExtension(undefined), '');
  });
});

describe('matchPattern', () => {
  test('glob matching is case-insensitive', () => {
    assert.ok(matchPattern('Invoice-2024.pdf', 'Invoice*', 'glob'));
    assert.ok(matchPattern('invoice-2024.pdf', 'Invoice*', 'glob'));
    assert.ok(!matchPattern('receipt.pdf', 'Invoice*', 'glob'));
  });

  test('single-char glob', () => {
    assert.ok(matchPattern('a.txt', '?.txt', 'glob'));
    assert.ok(!matchPattern('ab.txt', '?.txt', 'glob'));
  });

  test('regex matching', () => {
    assert.ok(matchPattern('IMG_1234.jpg', '^IMG_\\d+', 'regex'));
    assert.ok(!matchPattern('photo.jpg', '^IMG_\\d+', 'regex'));
  });

  test('invalid regex never throws', () => {
    assert.strictEqual(matchPattern('x', '(', 'regex'), false);
  });
});

describe('FileSorter smarter rules', () => {
  test('pattern rule wins over extension rule', () => {
    const sorter = new FileSorter({ '.pdf': 'Documents/PDFs' }, mockLogger(), {
      patternRules: [{ match: 'Invoice*', type: 'glob', folder: 'Finance' }]
    });
    const result = sorter.sort('/dl/Invoice-99.pdf');
    assert.strictEqual(result.targetFolder, 'Finance');
    assert.strictEqual(result.rule, 'pattern');
  });

  test('size rule applies when stats supplied', () => {
    const sorter = new FileSorter({}, mockLogger(), {
      sizeRules: [{ minSizeMB: 1, folder: 'Large' }]
    });
    const big = sorter.sort('/dl/movie.bin', { size: 5 * 1024 * 1024 });
    assert.strictEqual(big.targetFolder, 'Large');
    const small = sorter.sort('/dl/movie.bin', { size: 100 });
    assert.strictEqual(small.targetFolder, 'Unsorted');
  });

  test('date rule applies for old files', () => {
    const sorter = new FileSorter({}, mockLogger(), {
      dateRules: [{ olderThanDays: 30, folder: 'Archive' }]
    });
    const oldMs = Date.now() - 40 * 24 * 60 * 60 * 1000;
    const result = sorter.sort('/dl/notes.xyz', { mtime: oldMs });
    assert.strictEqual(result.targetFolder, 'Archive');
  });

  test('getRulesByFolder groups by full folder, sorted', () => {
    const sorter = new FileSorter({ '.png': 'Images', '.jpg': 'Images' }, mockLogger());
    const grouped = sorter.getRulesByFolder();
    assert.deepStrictEqual(grouped['Images'], ['.jpg', '.png']);
  });
});

describe('directory-scanner', () => {
  test('managedFoldersFrom derives top-level folders', () => {
    const managed = managedFoldersFrom(
      { '.pdf': 'Documents/PDFs', '.jpg': 'Images/Photos' },
      { unsortedFolder: 'Unsorted', patternRules: [{ folder: 'Finance/X' }] }
    );
    assert.ok(managed.has('Documents'));
    assert.ok(managed.has('Images'));
    assert.ok(managed.has('Unsorted'));
    assert.ok(managed.has('Finance'));
  });

  test('skips managed folders, ignore patterns; honors recursive', async () => {
    const dir = await mkTmp();
    try {
      await fs.writeFile(path.join(dir, 'a.pdf'), 'x');
      await fs.writeFile(path.join(dir, 'skip.tmp'), 'x');
      await fs.mkdir(path.join(dir, 'Documents'));
      await fs.writeFile(path.join(dir, 'Documents', 'already.pdf'), 'x');
      await fs.mkdir(path.join(dir, 'sub'));
      await fs.writeFile(path.join(dir, 'sub', 'c.txt'), 'x');

      const flat = await scan(dir, {
        ignorePatterns: ['*.tmp'],
        managedFolders: new Set(['Documents'])
      });
      assert.deepStrictEqual(flat.map((f) => path.basename(f)).sort(), ['a.pdf']);

      const deep = await scan(dir, {
        recursive: true,
        ignorePatterns: ['*.tmp'],
        managedFolders: new Set(['Documents'])
      });
      assert.deepStrictEqual(deep.map((f) => path.basename(f)).sort(), ['a.pdf', 'c.txt']);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});

describe('HistoryStore', () => {
  test('record / getLastRun / clearLastRun', async () => {
    const dir = await mkTmp();
    try {
      const store = new HistoryStore(dir);
      assert.strictEqual(await store.getLastRun(), null);
      assert.strictEqual(await store.record([]), null); // empty => no-op

      await store.record([{ from: '/a/x.pdf', to: '/a/Documents/x.pdf' }], 123);
      const run = await store.getLastRun();
      assert.strictEqual(run.id, 123);
      assert.strictEqual(run.moves.length, 1);

      await store.clearLastRun();
      assert.strictEqual(await store.getLastRun(), null);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});

describe('FileMover dry-run', () => {
  test('computes plan without touching the filesystem', async () => {
    const dir = await mkTmp();
    try {
      const src = path.join(dir, 'doc.pdf');
      await fs.writeFile(src, 'x');
      const destDir = path.join(dir, 'Documents');

      const mover = new FileMover(mockLogger());
      const result = await mover.move(src, destDir, { dryRun: true });

      assert.strictEqual(result.moved, false);
      assert.strictEqual(result.dryRun, true);
      assert.strictEqual(path.basename(result.destPath), 'doc.pdf');
      // Nothing changed:
      await fs.access(src); // still there
      await assert.rejects(fs.access(destDir)); // not created
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});

describe('FileWatcher ignore patterns', () => {
  test('matches user patterns as globs against the basename', () => {
    const w = new FileWatcher(mockLogger(), { ignorePatterns: ['*.tmp', 'draft-*'] });

    assert.strictEqual(w._isIgnored('/dl/a.tmp'), true); // glob *.tmp
    assert.strictEqual(w._isIgnored('/dl/draft-1.txt'), true); // glob draft-*
    assert.strictEqual(w._isIgnored('/dl/report.pdf'), false); // not ignored
  });

  test('always ignores hidden and in-progress files', () => {
    const w = new FileWatcher(mockLogger(), { ignorePatterns: [] });

    assert.strictEqual(w._isIgnored('/dl/.DS_Store'), true);
    assert.strictEqual(w._isIgnored('/dl/movie.crdownload'), true);
    assert.strictEqual(w._isIgnored('/dl/file.part'), true);
    assert.strictEqual(w._isIgnored('/dl/backup~'), true);
    assert.strictEqual(w._isIgnored('/dl/photo.jpg'), false);
  });

  test('glob patterns do not crash (regression: new RegExp("*.tmp") threw)', () => {
    const w = new FileWatcher(mockLogger(), { ignorePatterns: ['*.tmp', '*.crdownload'] });
    assert.doesNotThrow(() => w._isIgnored('/dl/whatever.txt'));
  });
});

describe('AutoSort organize + undo', () => {
  test('organize moves files; undo restores them', async () => {
    const dir = await mkTmp();
    try {
      await fs.writeFile(path.join(dir, 'report.pdf'), 'x');
      await fs.writeFile(path.join(dir, 'photo.jpg'), 'x');

      const autoSort = new AutoSort({ silent: true });
      autoSort.logger.banner = () => {};
      autoSort.configLoader.setWatchDir(dir);

      // Dry-run first: nothing should move.
      const preview = await autoSort.organize(null, { dryRun: true });
      assert.strictEqual(preview.moved, 2);
      await fs.access(path.join(dir, 'report.pdf')); // still in root

      // Real run.
      const summary = await autoSort.organize(null, {});
      assert.strictEqual(summary.moved, 2);
      await assert.rejects(fs.access(path.join(dir, 'report.pdf'))); // moved away

      // Undo restores originals.
      const undo = await autoSort.undo(null);
      assert.strictEqual(undo.reverted, 2);
      await fs.access(path.join(dir, 'report.pdf'));
      await fs.access(path.join(dir, 'photo.jpg'));
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
