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

function loadEntitlements({ remoteEntitlement, ownerPro = false, now = '2026-07-09T10:00:00' } = {}) {
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
      runtime: {
        getURL: (file) => `chrome-extension://test/${file}`
      },
      storage: {
        local: createStorageArea(local),
        sync: createStorageArea(sync)
      }
    },
    fetch: async (url) => {
      if (String(url).startsWith('chrome-extension://test/')) {
        return {
          ok: ownerPro,
          json: async () => ({ ownerPro })
        };
      }
      return {
        ok: true,
        json: async () => remoteEntitlement || {
          plan: 'free',
          status: 'free',
          source: 'billing-worker',
          currentPeriodEnd: '',
          accessUntil: ''
        }
      };
    },
    AbortSignal: { timeout: () => undefined },
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

test('ignored owner marker grants permanent lifetime Pro locally', async () => {
  const { api, local } = loadEntitlements({ ownerPro: true });

  const entitlement = await api.getEntitlement({ refresh: true });

  assert.equal(entitlement.plan, 'pro');
  assert.equal(entitlement.status, 'lifetime');
  assert.equal(entitlement.source, 'owner');
  assert.equal(api.isProEntitlement(entitlement), true);
  assert.equal(local.eloGuardEntitlement.status, 'lifetime');
  assert.equal(local.eloGuardEntitlement.source, 'owner');
});

test('a cancelled cached trial is revalidated immediately', async () => {
  const { api, local } = loadEntitlements({
    remoteEntitlement: {
      plan: 'free',
      status: 'free',
      source: 'billing-worker',
      currentPeriodEnd: '',
      accessUntil: '',
      cancelAtPeriodEnd: false,
      cancelAt: ''
    }
  });
  local.eloGuardEntitlement = {
    plan: 'pro',
    status: 'trialing',
    source: 'stripe',
    currentPeriodEnd: '2026-07-17T19:10:01.000Z',
    accessUntil: '2026-07-17T19:10:01.000Z',
    cancelAtPeriodEnd: true,
    cancelAt: '2026-07-17T19:10:01.000Z',
    refreshedAt: new Date('2026-07-09T09:59:00').getTime(),
    lastSynced: new Date('2026-07-09T09:59:00').getTime()
  };

  const entitlement = await api.getEntitlement();

  assert.equal(entitlement.plan, 'free');
  assert.equal(entitlement.status, 'free');
  assert.equal(api.isProEntitlement(entitlement), false);
  assert.equal(local.eloGuardEntitlement.status, 'free');
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

test('concurrent consumption with distinct ids never exceeds the cap', async () => {
  const { api, local } = loadEntitlements();

  const results = await Promise.all(
    Array.from({ length: 5 }, (_, index) =>
      api.consumeFeature('gameReview', `concurrent-game-${index}`))
  );

  const allowed = results.filter((result) => result.allowed);
  assert.equal(allowed.length, 3);

  const usage = local['eloGuardUsage:gameReview:2026-07-09'];
  assert.equal(usage.count, 3);
  assert.equal(usage.ids.length, 3);
});

test('empty-string usageIds each count instead of sharing a dedup bucket', async () => {
  const { api, local } = loadEntitlements();

  const first = await api.consumeFeature('gameReview', '');
  const second = await api.consumeFeature('gameReview', '');

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(second.used, 2);

  const usage = local['eloGuardUsage:gameReview:2026-07-09'];
  assert.equal(usage.count, 2);
});

test('the same non-empty usageId consumed twice only counts once', async () => {
  const { api, local } = loadEntitlements();

  const first = await api.consumeFeature('gameReview', 'same-game');
  const second = await api.consumeFeature('gameReview', 'same-game');

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(second.used, 1);

  const usage = local['eloGuardUsage:gameReview:2026-07-09'];
  assert.equal(usage.count, 1);
  assert.equal(usage.ids.length, 1);
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
