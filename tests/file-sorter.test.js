/**
 * Unit tests for AutoSort FileSorter module
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const FileSorter = require('../src/sorter/file-sorter');

const createMockLogger = () => ({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
});

describe('FileSorter', () => {
  const mockLogger = createMockLogger();
  const rules = {
    '.pdf': 'Documents/PDFs',
    '.jpg': 'Images/Photos',
    '.mp4': 'Videos',
    '.zip': 'Archives/ZIP'
  };

  test('should detect file extension correctly', () => {
    const sorter = new FileSorter(rules, mockLogger);
    
    assert.strictEqual(sorter.getExtension('/path/to/document.pdf'), '.pdf');
    assert.strictEqual(sorter.getExtension('/path/to/image.JPG'), '.jpg');
    assert.strictEqual(sorter.getExtension('/path/to/file.MP4'), '.mp4');
  });

  test('should match rules correctly', () => {
    const sorter = new FileSorter(rules, mockLogger);
    
    const result1 = sorter.matchRule('.pdf');
    assert.strictEqual(result1.matched, true);
    assert.strictEqual(result1.targetFolder, 'Documents/PDFs');
    
    const result2 = sorter.matchRule('.PDF');
    assert.strictEqual(result2.matched, true);
    assert.strictEqual(result2.targetFolder, 'Documents/PDFs');
    
    const result3 = sorter.matchRule('.unknown');
    assert.strictEqual(result3.matched, false);
    assert.strictEqual(result3.targetFolder, 'Unsorted');
  });

  test('should sort files correctly', () => {
    const sorter = new FileSorter(rules, mockLogger);
    
    const result = sorter.sort('/downloads/report.pdf');
    assert.strictEqual(result.extension, '.pdf');
    assert.strictEqual(result.matched, true);
    assert.strictEqual(result.targetFolder, 'Documents/PDFs');
    assert.strictEqual(result.fileName, 'report');
  });

  test('should handle files without extension', () => {
    const sorter = new FileSorter(rules, mockLogger);
    
    const result = sorter.sort('/downloads/README');
    assert.strictEqual(result.extension, '');
    assert.strictEqual(result.matched, false);
    assert.strictEqual(result.targetFolder, 'Unsorted');
    assert.strictEqual(result.fileName, 'README');
  });

  test('should add new rules dynamically', () => {
    const sorter = new FileSorter(rules, mockLogger);
    
    sorter.addRule('.json', 'Data/JSON');
    
    const result = sorter.matchRule('.json');
    assert.strictEqual(result.matched, true);
    assert.strictEqual(result.targetFolder, 'Data/JSON');
  });

  test('should remove rules dynamically', () => {
    const sorter = new FileSorter(rules, mockLogger);
    
    sorter.removeRule('.pdf');
    
    const result = sorter.matchRule('.pdf');
    assert.strictEqual(result.matched, false);
  });

  test('should organize rules by category', () => {
    const testRules = {
      '.pdf': 'Documents/PDFs',
      '.jpg': 'Images/Photos',
      '.mp4': 'Videos',
      '.zip': 'Archives/ZIP'
    };
    const sorter = new FileSorter(testRules, mockLogger);
    
    const categories = sorter.getRulesByCategory();
    
    assert.ok(categories['Documents']);
    assert.ok(categories['Images']);
    assert.ok(categories['Videos']);
    assert.ok(categories['Archives']);
    
    assert.strictEqual(categories['Documents'].length, 1);
    assert.strictEqual(categories['Documents'][0].extension, '.pdf');
  });

  test('should list rules sorted alphabetically', () => {
    const sorter = new FileSorter(rules, mockLogger);
    
    const list = sorter.listRules();
    
    assert.strictEqual(list.length, 4);
    assert.strictEqual(list[0].extension, '.jpg');
    assert.strictEqual(list[3].extension, '.zip');
  });

  test('should handle case insensitive matching by default', () => {
    const customRules = { '.pdf': 'Documents/PDFs' };
    const sorter = new FileSorter(customRules, mockLogger);
    
    const result = sorter.matchRule('.PDF');
    assert.strictEqual(result.matched, true);
    assert.strictEqual(result.targetFolder, 'Documents/PDFs');
  });

  test('should change unsorted folder', () => {
    const sorter = new FileSorter(rules, mockLogger, { unsortedFolder: 'Other' });
    
    sorter.setUnsortedFolder('Unclassified');
    
    const result = sorter.matchRule('.xyz');
    assert.strictEqual(result.targetFolder, 'Unclassified');
  });

  test('should return a copy of rules', () => {
    const sorter = new FileSorter(rules, mockLogger);
    const rulesCopy = sorter.getRules();
    
    assert.deepStrictEqual(rulesCopy, rules);
    assert.notStrictEqual(rulesCopy, rules);
  });
});

describe('FileSorter Edge Cases', () => {
  const mockLogger = createMockLogger();
  
  test('should handle files with multiple dots', () => {
    const sorter = new FileSorter({ '.tar.gz': 'Archives/TGZ' }, mockLogger);
    
    const result = sorter.sort('/downloads/archive.tar.gz');
    assert.strictEqual(result.extension, '.gz');
    assert.strictEqual(result.matched, false);
  });

  test('should handle hidden files', () => {
    const sorter = new FileSorter({}, mockLogger);
    
    const result = sorter.sort('/downloads/.hidden');
    assert.strictEqual(result.extension, '');
  });

  test('should handle files with special characters', () => {
    const rules = { '.pdf': 'Documents' };
    const sorter = new FileSorter(rules, mockLogger);
    
    const result = sorter.sort('/downloads/report (copy) [2].pdf');
    assert.strictEqual(result.fileName, 'report (copy) [2]');
    assert.strictEqual(result.extension, '.pdf');
  });

  test('should handle unicode filenames', () => {
    const rules = { '.pdf': 'Documents' };
    const sorter = new FileSorter(rules, mockLogger);
    
    const result = sorter.sort('/downloads/文档.pdf');
    assert.strictEqual(result.fileName, '文档');
    assert.strictEqual(result.extension, '.pdf');
  });

  test('should use default unsorted folder', () => {
    const sorter = new FileSorter({}, mockLogger);
    
    const result = sorter.matchRule('.unknown');
    assert.strictEqual(result.targetFolder, 'Unsorted');
  });
});
