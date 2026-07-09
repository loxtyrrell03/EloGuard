import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createStore } from '../store.js';

async function tmpFile(name = 'entitlements.json') {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'eg-store-'));
  return { dir, file: path.join(dir, name) };
}

test('concurrent mutations do not lose writes (the lost-update fix)', async () => {
  const { dir, file } = await tmpFile();
  const store = createStore(file);

  const N = 50;
  // Fire all mutations at once. With the old readStore/writeStore this would
  // interleave read-modify-write and keep only a handful of records.
  await Promise.all(Array.from({ length: N }, (_, i) =>
    store.mutate((state) => { state.installations[`install-${i}`] = { plan: 'pro', n: i }; })
  ));

  const finalState = await store.read();
  assert.equal(Object.keys(finalState.installations).length, N);
  for (let i = 0; i < N; i += 1) {
    assert.equal(finalState.installations[`install-${i}`].n, i);
  }

  await fs.rm(dir, { recursive: true, force: true });
});

test('read returns a well-formed empty store when the file is missing', async () => {
  const { dir, file } = await tmpFile('missing.json');
  const store = createStore(file);
  const state = await store.read();
  assert.deepEqual(state, { installations: {}, customers: {}, subscriptions: {} });
  await fs.rm(dir, { recursive: true, force: true });
});

test('written file is always valid JSON (atomic write leaves no partial file)', async () => {
  const { dir, file } = await tmpFile();
  const store = createStore(file);
  await store.mutate((state) => { state.customers['cus_1'] = 'install-1'; });
  const raw = await fs.readFile(file, 'utf8');
  assert.doesNotThrow(() => JSON.parse(raw));
  await fs.rm(dir, { recursive: true, force: true });
});

test('a rejecting mutation does not wedge the chain', async () => {
  const { dir, file } = await tmpFile();
  const store = createStore(file);

  await assert.rejects(store.mutate(() => { throw new Error('boom'); }));
  // The next mutation must still run and persist.
  await store.mutate((state) => { state.installations['ok'] = { plan: 'pro' }; });
  const state = await store.read();
  assert.equal(state.installations['ok'].plan, 'pro');

  await fs.rm(dir, { recursive: true, force: true });
});
