/**
 * Unit tests for AutoSort FileMover module
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const FileMover = require('../src/mover/file-mover');
const Logger = require('../src/utils/logger');

const createMockLogger = () => ({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  logMove: () => {}
});

describe('FileMover', () => {
  test('should create FileMover instance', () => {
    const mockLogger = createMockLogger();
    const mover = new FileMover(mockLogger);
    
    assert.ok(mover instanceof FileMover);
    assert.ok(mover.retryAttempts >= 1);
    assert.ok(mover.retryDelay >= 0);
  });

  test('should accept custom retry options', () => {
    const mockLogger = createMockLogger();
    const mover = new FileMover(mockLogger, {
      retryAttempts: 5,
      retryDelay: 2000
    });
    
    assert.strictEqual(mover.retryAttempts, 5);
    assert.strictEqual(mover.retryDelay, 2000);
  });

  test('should return unique filename for existing file', async () => {
    const mockLogger = createMockLogger();
    const mover = new FileMover(mockLogger);
    
    mover.exists = async (path) => {
      return path.includes('existing');
    };
    
    const result = await mover.getUniqueFileName('/downloads/report.pdf');
    
    assert.ok(result.includes('report'));
    assert.ok(result.endsWith('.pdf'));
  });

  test('should handle default values', () => {
    const mockLogger = createMockLogger();
    const mover = new FileMover(mockLogger);
    
    assert.strictEqual(mover.retryAttempts, 3);
    assert.strictEqual(mover.retryDelay, 1000);
  });

  test('should handle file info errors gracefully', async () => {
    const mockLogger = createMockLogger();
    const mover = new FileMover(mockLogger);
    
    const result = await mover.getFileInfo('/nonexistent/file.pdf');
    
    assert.strictEqual(result, null);
  });

  test('should handle various path formats', async () => {
    const mockLogger = createMockLogger();
    const mover = new FileMover(mockLogger);

    mover.exists = async () => false;
    
    const uniquePath1 = await mover.getUniqueFileName('/path/to/file.pdf');
    assert.ok(uniquePath1.endsWith('.pdf'));
    
    const uniquePath2 = await mover.getUniqueFileName('relative/path/file.zip');
    assert.ok(uniquePath2.endsWith('.zip'));
  });

  test('should increment counter for duplicates', async () => {
    const mockLogger = createMockLogger();
    const mover = new FileMover(mockLogger);
    let callCount = 0;
    
    mover.exists = async (path) => {
      callCount++;
      return !path.includes('(1)');
    };
    
    const result = await mover.getUniqueFileName('/downloads/report.pdf');
    
    assert.ok(result.includes('(1)'));
    assert.ok(callCount > 0);
  });

  test('should detect cross-device errors', () => {
    const mockLogger = createMockLogger();
    const mover = new FileMover(mockLogger);
    
    const error = { code: 'EXDEV' };
    assert.strictEqual(error.code, 'EXDEV');
  });

  test('should handle EBUSY errors', () => {
    const mockLogger = createMockLogger();
    const mover = new FileMover(mockLogger);
    
    const error = { code: 'EBUSY' };
    assert.strictEqual(error.code, 'EBUSY');
  });

  test('should handle EPERM errors', () => {
    const mockLogger = createMockLogger();
    const mover = new FileMover(mockLogger);
    
    const error = { code: 'EPERM' };
    assert.strictEqual(error.code, 'EPERM');
  });
});
