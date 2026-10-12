const chains = new Map();

/**
 * Serializes async operations that share a key.
 *
 * SQLite has a single-writer model and does not support `SELECT ... FOR UPDATE`
 * row locks, so concurrent writers to the same embed file fail with
 * SQLITE_BUSY. MySQL relies on database-level row locks instead and never uses
 * this helper. Callers gate on the active dialect.
 */
export const withLock = (key, fn) => {
  const previous = chains.get(key) || Promise.resolve();
  const run = previous.then(fn, fn);
  const settled = run.then(
    () => {},
    () => {},
  );

  chains.set(key, settled);
  settled.then(() => {
    if (chains.get(key) === settled) chains.delete(key);
  });

  return run;
};

export default withLock;
