// Cache only the fork backend; provider and terminal processes inherit no cache
// environment variable. The cache is disposable and contains no credentials.
const { enableCompileCache, flushCompileCache } = require("node:module");
const { join } = require("node:path");
try {
  if (process.env.T3CODE_HOME) {
    enableCompileCache(join(process.env.T3CODE_HOME, "runtimes", "backend-compile-cache"));
    // Windows can terminate the backend without an exit hook. Persist the
    // startup modules once while it is running; do not keep a timer alive.
    setTimeout(() => {
      try {
        flushCompileCache();
      } catch {
        /* Optional optimization. */
      }
    }, 10_000).unref();
  }
} catch {
  // A missing or unwritable cache must never prevent startup.
}
