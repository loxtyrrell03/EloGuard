const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function createStorageArea(backing) {
  return {
    get(keys, callback) {
      const result = {};
      const list = Array.isArray(keys) ? keys : [keys];
      for (const key of list) {
        if (Object.prototype.hasOwnProperty.call(backing, key)) result[key] = backing[key];
      }
      callback(result);
    },
    set(values, callback) {
      Object.assign(backing, values);
      callback?.();
    },
    remove(keys, callback) {
      const list = Array.isArray(keys) ? keys : [keys];
      for (const key of list) delete backing[key];
      callback?.();
    }
  };
}

function loadEntitlements({ remoteEntitlement, now = '2026-07-09T10:00:00' } = {}) {
  const local = {};
  const sync = {};
  let currentNow = now;
  class MockDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [currentNow]));
    }

    static now() {
      return new Date(currentNow).getTime();
    }
  }
  const context = {
    window: {},
    crypto: { randomUUID: () => 'test-install-id-123456' },
    Date: MockDate,
    chrome: {
      storage: {
        local: createStorageArea(local),
        sync: createStorageArea(sync)
      }
    },
    fetch: async () => ({
      ok: true,
      json: async () => remoteEntitlement || {
        plan: 'free',
        status: 'free',
        source: 'billing-worker',
        currentPeriodEnd: '',
        accessUntil: ''
      }
    }),
    URL
  };
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, '..', 'lib', 'entitlements.js'), 'utf8');
  vm.runInContext(source, context);
  return {
    api: context.window.EloGuardEntitlements,
    local,
    sync,
    setNow: (nextNow) => { currentNow = nextNow; }
  };
}

test('fresh install is free, not dev Pro', async () => {
  const { api, local } = loadEntitlements();
  const entitlement = await api.getEntitlement({ refresh: true });

  assert.equal(api.isProEntitlement(entitlement), false);
  assert.equal(entitlement.plan, 'free');
  assert.equal(local.eloGuardDevPro, undefined);
});

test('dev Pro override is disabled in public launch builds', async () => {
  const { api, local } = loadEntitlements();

  const changed = await api.setDevPro(true);
  const entitlement = await api.getEntitlement();

  assert.equal(changed, false);
  assert.equal(local.eloGuardDevPro, undefined);
  assert.equal(api.isProEntitlement(entitlement), false);
  assert.equal(entitlement.plan, 'free');
});

test('free premium features are capped at three daily uses', async () => {
  const { api } = loadEntitlements();

  for (let index = 0; index < 3; index += 1) {
    const result = await api.consumeFeature('gameReview', `game-${index}`);
    assert.equal(result.allowed, true);
    assert.equal(result.remaining, 2 - index);
  }

  const blocked = await api.consumeFeature('gameReview', 'game-3');
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
});

test('free game review allowance resets to three on the next local day', async () => {
  const { api, setNow } = loadEntitlements({ now: '2026-07-09T23:30:00' });

  for (let index = 0; index < 3; index += 1) {
    const result = await api.consumeFeature('gameReview', `today-game-${index}`);
    assert.equal(result.allowed, true);
  }

  const blockedToday = await api.getFeatureAccess('gameReview', 'today-game-3');
  assert.equal(blockedToday.allowed, false);
  assert.equal(blockedToday.remaining, 0);

  setNow('2026-07-10T00:01:00');

  const resetTomorrow = await api.getFeatureAccess('gameReview', 'tomorrow-game-0');
  assert.equal(resetTomorrow.allowed, true);
  assert.equal(resetTomorrow.limit, 3);
  assert.equal(resetTomorrow.used, 0);
  assert.equal(resetTomorrow.remaining, 3);
});
