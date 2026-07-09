import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveEntitlement, PRO_STATUSES } from '../entitlement.js';

const DAY = 24 * 60 * 60 * 1000;
const FUTURE = 2_000_000_000; // unix seconds, year 2033

test('active subscription is pro until the period end', () => {
  const e = deriveEntitlement({ status: 'active', currentPeriodEndSeconds: FUTURE });
  assert.equal(e.plan, 'pro');
  assert.equal(e.accessUntil, new Date(FUTURE * 1000).toISOString());
  assert.equal(e.currentPeriodEnd, new Date(FUTURE * 1000).toISOString());
});

test('trialing subscription is pro', () => {
  const e = deriveEntitlement({ status: 'trialing', currentPeriodEndSeconds: FUTURE });
  assert.equal(e.plan, 'pro');
  assert.equal(e.accessUntil, new Date(FUTURE * 1000).toISOString());
});

test('past_due keeps pro for a grace window past the failed period end', () => {
  const endSec = 1_700_000_000;
  const e = deriveEntitlement({ status: 'past_due', currentPeriodEndSeconds: endSec, graceDays: 14 });
  assert.equal(e.plan, 'pro');
  assert.equal(e.accessUntil, new Date(endSec * 1000 + 14 * DAY).toISOString());
});

test('past_due with no period end falls back to now + grace', () => {
  const nowMs = 1_700_000_000_000;
  const e = deriveEntitlement({ status: 'past_due', currentPeriodEndSeconds: 0, graceDays: 14, nowMs });
  assert.equal(e.plan, 'pro');
  assert.equal(e.accessUntil, new Date(nowMs + 14 * DAY).toISOString());
});

test('terminal / non-paying statuses are free with no access', () => {
  for (const status of ['canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused', undefined]) {
    const e = deriveEntitlement({ status, currentPeriodEndSeconds: FUTURE });
    assert.equal(e.plan, 'free', `expected ${status} to be free`);
    assert.equal(e.accessUntil, '', `expected ${status} to grant no access`);
  }
});

test('PRO_STATUSES is exactly the three paying/dunning states', () => {
  assert.deepEqual([...PRO_STATUSES].sort(), ['active', 'past_due', 'trialing']);
});
