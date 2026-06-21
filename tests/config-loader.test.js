/**
 * Unit tests for AutoSort ConfigLoader module
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const ConfigLoader = require('../src/config/config-loader');

const createMockLogger = () => ({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  success: () => {}
});

test('ConfigLoader should create instance with defaults', () => {
  const mockLogger = createMockLogger();
  const configLoader = new ConfigLoader(mockLogger);

  assert.ok(configLoader instanceof ConfigLoader);

  const config = configLoader.getConfig();
  assert.strictEqual(config.unsortedFolder, 'Unsorted');
  assert.strictEqual(config.retryAttempts, 3);
  assert.strictEqual(config.retryDelay, 1000);
  assert.deepStrictEqual(config.ignorePatterns, []);
});

test('ConfigLoader should return default rules', () => {
  const mockLogger = createMockLogger();
  const configLoader = new ConfigLoader(mockLogger);

  const rules = configLoader.getRules();

  assert.ok(rules['.pdf']);
  assert.ok(rules['.jpg']);
  assert.ok(rules['.mp4']);
  assert.ok(rules['.zip']);
  assert.strictEqual(rules['.pdf'], 'Documents/PDFs');
});

test('ConfigLoader should set watch directory', () => {
  const mockLogger = createMockLogger();
  const configLoader = new ConfigLoader(mockLogger);

  configLoader.setWatchDir('C:/Downloads');

  const config = configLoader.getConfig();
  assert.strictEqual(config.watchDir, path.resolve('C:/Downloads'));
});

test('ConfigLoader should add rules', () => {
  const mockLogger = createMockLogger();
  const configLoader = new ConfigLoader(mockLogger);

  configLoader.addRule('.foo', 'Custom/Foo');

  const rules = configLoader.getRules();
  assert.strictEqual(rules['.foo'], 'Custom/Foo');
});

test('ConfigLoader should add rules without dot prefix', () => {
  const mockLogger = createMockLogger();
  const configLoader = new ConfigLoader(mockLogger);

  configLoader.addRule('bar', 'Custom/Bar');

  const rules = configLoader.getRules();
  assert.strictEqual(rules['.bar'], 'Custom/Bar');
});

test('ConfigLoader should normalize extension to lowercase', () => {
  const mockLogger = createMockLogger();
  const configLoader = new ConfigLoader(mockLogger);

  configLoader.addRule('.PDF', 'Documents');
  configLoader.addRule('.JPG', 'Images');

  const rules = configLoader.getRules();
  assert.strictEqual(rules['.pdf'], 'Documents');
  assert.strictEqual(rules['.jpg'], 'Images');
});

test('ConfigLoader should remove rules', () => {
  const mockLogger = createMockLogger();
  const configLoader = new ConfigLoader(mockLogger);

  configLoader.addRule('.temp', 'Temp');
  configLoader.removeRule('.temp');

  const rules = configLoader.getRules();
  assert.strictEqual(rules['.temp'], undefined);
});

test('ConfigLoader should get rule count', () => {
  const mockLogger = createMockLogger();
  const configLoader = new ConfigLoader(mockLogger);

  const initialCount = configLoader.getRuleCount();

  configLoader.addRule('.new1', 'Folder1');
  configLoader.addRule('.new2', 'Folder2');

  const newCount = configLoader.getRuleCount();
  assert.strictEqual(newCount, initialCount + 2);
});

test('ConfigLoader should preserve default rules when adding custom rules', () => {
  const mockLogger = createMockLogger();
  const configLoader = new ConfigLoader(mockLogger);

  configLoader.addRule('.custom', 'Custom');

  const rules = configLoader.getRules();
  assert.ok(rules['.pdf']);
  assert.ok(rules['.jpg']);
  assert.ok(rules['.custom']);
});

test('ConfigLoader should throw error when watchDir is not set', async () => {
  const mockLogger = createMockLogger();
  const configLoader = new ConfigLoader(mockLogger);

  try {
    await configLoader.validate();
    assert.fail('Should have thrown an error');
  } catch (error) {
    assert.ok(error.message.includes('Watch directory'));
  }
});

test('ConfigLoader should have default retry settings', () => {
  const mockLogger = createMockLogger();
  const configLoader = new ConfigLoader(mockLogger);

  const config = configLoader.getConfig();
  assert.strictEqual(config.retryAttempts, 3);
  assert.strictEqual(config.retryDelay, 1000);
});
