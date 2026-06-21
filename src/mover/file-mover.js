const fs = require('fs').promises;
const path = require('path');

class FileMover {
  constructor(logger, options = {}) {
    this.logger = logger;
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
  }

  async ensureDirectory(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  async exists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getUniqueFileName(destPath) {
    const dir = path.dirname(destPath);
    const ext = path.extname(destPath);
    const baseName = path.basename(destPath, ext);

    // Read the directory once instead of an fs.access syscall per conflict.
    let existing;
    try {
      existing = new Set(await fs.readdir(dir));
    } catch {
      // Directory missing/unreadable => no conflicts possible.
      return destPath;
    }

    if (!existing.has(path.basename(destPath))) {
      return destPath;
    }

    let counter = 1;
    let candidate = `${baseName}(${counter})${ext}`;
    while (existing.has(candidate)) {
      counter++;
      candidate = `${baseName}(${counter})${ext}`;
    }

    return path.join(dir, candidate);
  }

  async moveWithRetry(sourcePath, destPath, attempt = 1) {
    try {
      await fs.rename(sourcePath, destPath);
      return { success: true, moved: true };
    } catch (error) {
      if (error.code === 'EBUSY' || error.code === 'ENOENT' || error.code === 'EPERM') {
        if (attempt < this.retryAttempts) {
          this.logger.debug(
            `Retry ${attempt}/${this.retryAttempts} for ${path.basename(sourcePath)}`
          );
          await this._delay(this.retryDelay * attempt);
          return this.moveWithRetry(sourcePath, destPath, attempt + 1);
        }
      }

      if (error.code === 'EXDEV') {
        return this._crossDeviceMove(sourcePath, destPath);
      }

      throw error;
    }
  }

  async _crossDeviceMove(sourcePath, destPath) {
    try {
      await this._copyFile(sourcePath, destPath);
      await fs.unlink(sourcePath);
      return { success: true, moved: true, crossDevice: true };
    } catch (error) {
      throw new Error(`Cross-device move failed: ${error.message}`);
    }
  }

  async _copyFile(source, dest) {
    const readStream = await fs.open(source, 'r');
    const writeStream = await fs.open(dest, 'w');

    try {
      const { createReadStream, createWriteStream } = require('fs');

      return new Promise((resolve, reject) => {
        const reader = createReadStream(source);
        const writer = createWriteStream(dest);

        reader.on('error', reject);
        writer.on('error', reject);
        writer.on('finish', resolve);

        reader.pipe(writer);
      });
    } finally {
      await readStream.close();
      await writeStream.close();
    }
  }

  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async move(sourcePath, destDir, options = {}) {
    const resolveConflicts = options.resolveConflicts !== false;
    const dryRun = options.dryRun === true;

    const fileName = path.basename(sourcePath);
    let destPath = path.join(destDir, fileName);

    this.logger.debug(`${dryRun ? 'Would move' : 'Moving'}: ${fileName} -> ${destDir}`);

    if (!(await this.exists(sourcePath))) {
      throw new Error(`Source file does not exist: ${sourcePath}`);
    }

    if (resolveConflicts && (await this.exists(destPath))) {
      destPath = await this.getUniqueFileName(destPath);
      this.logger.debug(`Conflict detected, using: ${path.basename(destPath)}`);
    }

    // Dry-run: compute the plan (incl. conflict-resolved name) but touch nothing.
    if (dryRun) {
      return {
        success: true,
        sourcePath,
        destPath,
        fileName: path.basename(destPath),
        moved: false,
        dryRun: true
      };
    }

    if (!(await this.exists(destDir))) {
      await this.ensureDirectory(destDir);
    }

    const result = await this.moveWithRetry(sourcePath, destPath);

    if (result.success) {
      await this.logger.logMove(sourcePath, destPath);
    }

    return {
      success: result.success,
      sourcePath,
      destPath,
      fileName: path.basename(destPath),
      moved: result.moved,
      dryRun: false
    };
  }

  async getFileInfo(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return {
        path: filePath,
        name: path.basename(filePath),
        extension: path.extname(filePath),
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory()
      };
    } catch (error) {
      return null;
    }
  }
}

module.exports = FileMover;
