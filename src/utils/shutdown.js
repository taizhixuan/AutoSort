/**
 * Register a graceful-shutdown handler for SIGINT and SIGTERM.
 *
 * Runs `cleanup()` (awaited) exactly once on the first signal, then exits. This
 * replaces the SIGINT/SIGTERM blocks that were copy-pasted across entry points.
 *
 * @param {() => (void | Promise<void>)} cleanup
 * @param {number} [exitCode=0]
 */
function onShutdown(cleanup, exitCode = 0) {
  let shuttingDown = false;

  const handler = async () => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    try {
      await cleanup();
    } finally {
      process.exit(exitCode);
    }
  };

  process.on('SIGINT', handler);
  process.on('SIGTERM', handler);
}

module.exports = { onShutdown };
