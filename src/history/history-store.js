const fs = require('fs').promises;
const path = require('path');
const { STATE_DIR_NAME } = require('../constants');

/**
 * Append-only history of organize runs, persisted as JSON under
 * `<baseDir>/.autosort/history.json`. Powers `autosort undo`.
 *
 * Shape: { runs: [ { id, at, moves: [ { from, to } ] } ] }
 */
class HistoryStore {
  constructor(baseDir) {
    this.dir = path.join(baseDir, STATE_DIR_NAME);
    this.file = path.join(this.dir, 'history.json');
  }

  async _read() {
    try {
      const content = await fs.readFile(this.file, 'utf-8');
      const data = JSON.parse(content);
      return Array.isArray(data.runs) ? data : { runs: [] };
    } catch {
      return { runs: [] };
    }
  }

  async _write(data) {
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Record a completed run.
   * @param {Array<{from:string,to:string}>} moves
   * @param {number} [runId] defaults to current timestamp
   * @returns {Promise<object|null>} the stored run, or null if no moves
   */
  async record(moves, runId = Date.now()) {
    const real = (moves || []).filter((m) => m && m.from && m.to);
    if (real.length === 0) {
      return null;
    }
    const data = await this._read();
    const run = { id: runId, at: new Date().toISOString(), moves: real };
    data.runs.push(run);
    await this._write(data);
    return run;
  }

  /** @returns {Promise<object|null>} the most recent run, or null. */
  async getLastRun() {
    const data = await this._read();
    return data.runs.length > 0 ? data.runs[data.runs.length - 1] : null;
  }

  /** Remove the most recent run from history. */
  async clearLastRun() {
    const data = await this._read();
    if (data.runs.length > 0) {
      data.runs.pop();
      await this._write(data);
    }
  }
}

module.exports = HistoryStore;
