import fs from 'node:fs/promises';
import path from 'node:path';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A tiny persistent JSON store with two guarantees the previous inline
// readStore/writeStore lacked:
//   1. All read-modify-write mutations are serialized through a promise chain,
//      so concurrent Stripe webhooks (checkout.session.completed +
//      customer.subscription.created fire near-simultaneously) can't clobber
//      each other with a lost update.
//   2. Writes are atomic (temp file + rename) so a crash mid-write can't
//      truncate the entitlement file and lose every paying customer.
//
// This is correct for a SINGLE server instance. If you run multiple instances,
// a shared file can't be locked this way — move to Postgres/Redis.
export function createStore(storePath) {
  const resolved = path.resolve(storePath);
  let chain = Promise.resolve();

  const empty = () => ({ installations: {}, customers: {}, subscriptions: {} });

  async function read() {
    try {
      const parsed = JSON.parse(await fs.readFile(resolved, 'utf8'));
      return {
        installations: parsed.installations || {},
        customers: parsed.customers || {},
        subscriptions: parsed.subscriptions || {}
      };
    } catch (_) {
      return empty();
    }
  }

  // Windows can transiently fail a replace-rename with EPERM/EBUSY if a reader
  // has the destination open for the instant of the swap; retry a few times.
  async function renameWithRetry(from, to, attempts = 6) {
    for (let i = 0; i < attempts; i += 1) {
      try {
        await fs.rename(from, to);
        return;
      } catch (err) {
        const transient = err && ['EPERM', 'EACCES', 'EBUSY'].includes(err.code);
        if (!transient || i === attempts - 1) throw err;
        await delay(15 * (i + 1));
      }
    }
  }

  async function writeAtomic(data) {
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    const tmp = `${resolved}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2));
    await renameWithRetry(tmp, resolved);
  }

  // Serialize mutations. `fn(store)` may mutate `store` in place and/or return
  // a value; the (possibly) mutated store is written atomically afterwards.
  function mutate(fn) {
    const run = chain.then(async () => {
      const state = await read();
      const result = await fn(state);
      await writeAtomic(state);
      return result;
    });
    // Keep the chain alive even if one mutation rejects.
    chain = run.then(() => {}, () => {});
    return run;
  }

  return { read, mutate };
}
