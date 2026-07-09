import assert from 'node:assert/strict';
import test from 'node:test';
import worker, { deriveEntitlement, hmacSha256Hex, verifyStripeSignature } from '../src/worker.js';

function createMemoryDb() {
  const installations = new Map();
  const customers = new Map();
  const subscriptions = new Map();

  return {
    data: { installations, customers, subscriptions },
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      return {
        bind(...args) {
          return {
            async first() {
              if (normalized.startsWith('SELECT * FROM installations')) {
                return installations.get(args[0]) || null;
              }
              if (normalized.startsWith('SELECT install_id FROM subscription_installations')) {
                const installId = subscriptions.get(args[0]);
                return installId ? { install_id: installId } : null;
              }
              if (normalized.startsWith('SELECT install_id FROM customer_installations')) {
                const installId = customers.get(args[0]);
                return installId ? { install_id: installId } : null;
              }
              throw new Error(`Unhandled first SQL: ${normalized}`);
            },
            async run() {
              if (normalized.startsWith('INSERT INTO installations') && normalized.includes("'lifetime'")) {
                const [installId, customerId, paymentIntentId, customerEmail, updatedAt] = args;
                const existing = installations.get(installId) || {};
                installations.set(installId, {
                  ...existing,
                  install_id: installId,
                  plan: 'pro',
                  status: 'lifetime',
                  stripe_customer_id: customerId || existing.stripe_customer_id || '',
                  stripe_subscription_id: existing.stripe_subscription_id || '',
                  stripe_payment_intent_id: paymentIntentId || existing.stripe_payment_intent_id || '',
                  customer_email: customerEmail || existing.customer_email || '',
                  current_period_end: '',
                  access_until: '',
                  cancel_at_period_end: 0,
                  cancel_at: '',
                  updated_at: updatedAt
                });
                return { success: true };
              }
              if (normalized.startsWith('INSERT INTO installations')) {
                const [installId, plan, status, customerId, subscriptionId, customerEmail, currentPeriodEnd, accessUntil, cancelAtPeriodEnd, cancelAt, updatedAt] = args;
                const existing = installations.get(installId) || {};
                installations.set(installId, {
                  ...existing,
                  install_id: installId,
                  plan,
                  status,
                  stripe_customer_id: customerId || existing.stripe_customer_id || '',
                  stripe_subscription_id: subscriptionId || existing.stripe_subscription_id || '',
                  stripe_payment_intent_id: existing.stripe_payment_intent_id || '',
                  customer_email: customerEmail || existing.customer_email || '',
                  current_period_end: currentPeriodEnd || existing.current_period_end || '',
                  access_until: accessUntil,
                  cancel_at_period_end: cancelAtPeriodEnd || 0,
                  cancel_at: cancelAt || '',
                  updated_at: updatedAt
                });
                return { success: true };
              }
              if (normalized.startsWith('INSERT OR REPLACE INTO customer_installations')) {
                customers.set(args[0], args[1]);
                return { success: true };
              }
              if (normalized.startsWith('INSERT OR REPLACE INTO subscription_installations')) {
                subscriptions.set(args[0], args[1]);
                return { success: true };
              }
              throw new Error(`Unhandled run SQL: ${normalized}`);
            }
          };
        }
      };
    }
  };
}

function env(overrides = {}) {
  return {
    DB: createMemoryDb(),
    APP_BASE_URL: 'https://eloguard.app',
    STRIPE_SECRET_KEY: 'sk_test_fake',
    STRIPE_WEBHOOK_SECRET: 'whsec_fake',
    STRIPE_MONTHLY_PRICE_ID: 'price_monthly',
    STRIPE_LIFETIME_PRICE_ID: 'price_lifetime',
    STRIPE_AUTOMATIC_TAX: 'false',
    STRIPE_TRIAL_DAYS: '0',
    STRIPE_GRACE_DAYS: '14',
    ...overrides
  };
}

test('active subscription derives pro with period end', () => {
  const result = deriveEntitlement({
    status: 'active',
    currentPeriodEndSeconds: 1783544851,
    graceDays: 14
  });
  assert.equal(result.plan, 'pro');
  assert.equal(result.currentPeriodEnd, '2026-07-08T21:07:31.000Z');
  assert.equal(result.accessUntil, '2026-07-08T21:07:31.000Z');
});

test('terminal subscription derives free', () => {
  const result = deriveEntitlement({
    status: 'canceled',
    currentPeriodEndSeconds: 1783544851,
    graceDays: 14
  });
  assert.equal(result.plan, 'free');
  assert.equal(result.accessUntil, '');
});

test('stripe signature verification accepts valid signatures', async () => {
  const body = JSON.stringify({ id: 'evt_test' });
  const timestamp = 1783544851;
  const digest = await hmacSha256Hex('whsec_fake', `${timestamp}.${body}`);
  const header = `t=${timestamp},v1=${digest}`;
  assert.equal(await verifyStripeSignature(body, header, 'whsec_fake', timestamp * 1000), true);
  assert.equal(await verifyStripeSignature(body, header, 'whsec_fake\n', timestamp * 1000), true);
  assert.equal(await verifyStripeSignature(body, header, 'whsec_wrong', timestamp * 1000), false);
});

test('checkout creates a Stripe session and redirects', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init, body: init.body.toString() });
    return new Response(JSON.stringify({ url: 'https://checkout.stripe.test/session' }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };
  try {
    const response = await worker.fetch(
      new Request('https://eloguard.app/checkout?installId=test-install-123456&plan=monthly&feature=gameReview'),
      env()
    );
    assert.equal(response.status, 303);
    assert.equal(response.headers.get('location'), 'https://checkout.stripe.test/session');
    assert.match(calls[0].body, /mode=subscription/);
    assert.match(calls[0].body, /client_reference_id=test-install-123456/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('success provisions lifetime entitlement immediately', async () => {
  const testEnv = env();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    id: 'cs_test_lifetime',
    mode: 'payment',
    payment_status: 'paid',
    client_reference_id: 'test-lifetime-123456',
    customer: { id: 'cus_test', email: 'buyer@example.com' },
    payment_intent: { id: 'pi_test' },
    customer_details: { email: 'buyer@example.com' }
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
  try {
    const success = await worker.fetch(
      new Request('https://eloguard.app/success?installId=test-lifetime-123456&session_id=cs_test_lifetime'),
      testEnv
    );
    assert.equal(success.status, 200);

    const entitlement = await worker.fetch(
      new Request('https://eloguard.app/api/entitlement?installId=test-lifetime-123456'),
      testEnv
    );
    assert.deepEqual(await entitlement.json(), {
      plan: 'pro',
      status: 'lifetime',
      source: 'stripe',
      currentPeriodEnd: '',
      accessUntil: '',
      cancelAtPeriodEnd: false,
      cancelAt: ''
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('success provisions active subscription entitlement immediately', async () => {
  const testEnv = env();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    id: 'cs_test_monthly',
    mode: 'subscription',
    payment_status: 'paid',
    client_reference_id: 'test-monthly-123456',
    customer: { id: 'cus_test', email: 'buyer@example.com' },
    subscription: {
      id: 'sub_test',
      status: 'active',
      current_period_end: 1893456000
    },
    customer_details: { email: 'buyer@example.com' }
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
  try {
    const success = await worker.fetch(
      new Request('https://eloguard.app/success?installId=test-monthly-123456&session_id=cs_test_monthly'),
      testEnv
    );
    assert.equal(success.status, 200);

    const entitlement = await worker.fetch(
      new Request('https://eloguard.app/api/entitlement?installId=test-monthly-123456'),
      testEnv
    );
    assert.deepEqual(await entitlement.json(), {
      plan: 'pro',
      status: 'active',
      source: 'stripe',
      currentPeriodEnd: '2030-01-01T00:00:00.000Z',
      accessUntil: '2030-01-01T00:00:00.000Z',
      cancelAtPeriodEnd: false,
      cancelAt: ''
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('success does not provision unpaid checkout sessions', async () => {
  const testEnv = env();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    id: 'cs_test_unpaid',
    mode: 'payment',
    payment_status: 'unpaid',
    client_reference_id: 'test-unpaid-123456',
    customer: { id: 'cus_test', email: 'buyer@example.com' },
    customer_details: { email: 'buyer@example.com' }
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
  try {
    const success = await worker.fetch(
      new Request('https://eloguard.app/success?installId=test-unpaid-123456&session_id=cs_test_unpaid'),
      testEnv
    );
    assert.equal(success.status, 200);
    assert.match(await success.text(), /Payment not verified yet/);

    const entitlement = await worker.fetch(
      new Request('https://eloguard.app/api/entitlement?installId=test-unpaid-123456'),
      testEnv
    );
    assert.deepEqual(await entitlement.json(), {
      plan: 'free',
      status: 'free',
      source: 'billing-worker',
      currentPeriodEnd: '',
      accessUntil: '',
      cancelAtPeriodEnd: false,
      cancelAt: ''
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('cancel renewal schedules Stripe subscription cancellation at period end', async () => {
  const testEnv = env();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const href = String(url);
    if (href.includes('/checkout/sessions/')) {
      return new Response(JSON.stringify({
        id: 'cs_test_monthly',
        mode: 'subscription',
        payment_status: 'paid',
        client_reference_id: 'test-cancel-123456',
        customer: { id: 'cus_test', email: 'buyer@example.com' },
        subscription: {
          id: 'sub_cancel',
          status: 'active',
          current_period_end: 1893456000
        },
        customer_details: { email: 'buyer@example.com' }
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }
    if (href.includes('/subscriptions/sub_cancel')) {
      assert.equal(init.method, 'POST');
      assert.match(init.body.toString(), /cancel_at_period_end=true/);
      return new Response(JSON.stringify({
        id: 'sub_cancel',
        customer: 'cus_test',
        status: 'active',
        current_period_end: 1893456000,
        cancel_at_period_end: true,
        cancel_at: 1893456000
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }
    if (href.includes('/customers/cus_test')) {
      return new Response(JSON.stringify({ id: 'cus_test', email: 'buyer@example.com' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }
    throw new Error(`Unexpected Stripe call: ${href}`);
  };

  try {
    const success = await worker.fetch(
      new Request('https://eloguard.app/success?installId=test-cancel-123456&session_id=cs_test_monthly'),
      testEnv
    );
    assert.equal(success.status, 200);

    const cancel = await worker.fetch(
      new Request('https://eloguard.app/api/cancel-renewal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ installId: 'test-cancel-123456' })
      }),
      testEnv
    );
    assert.equal(cancel.status, 200);
    const body = await cancel.json();
    assert.equal(body.ok, true);
    assert.equal(body.plan, 'pro');
    assert.equal(body.status, 'active');
    assert.equal(body.cancelAtPeriodEnd, true);
    assert.equal(body.cancelAt, '2030-01-01T00:00:00.000Z');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('cancel renewal returns a friendly error (not a 1101) when Stripe fails', async () => {
  const testEnv = env();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const href = String(url);
    if (href.includes('/checkout/sessions/')) {
      return new Response(JSON.stringify({
        id: 'cs_test_monthly',
        mode: 'subscription',
        payment_status: 'paid',
        client_reference_id: 'test-cancel-fail-123456',
        customer: { id: 'cus_test', email: 'buyer@example.com' },
        subscription: {
          id: 'sub_fail',
          status: 'active',
          current_period_end: 1893456000
        },
        customer_details: { email: 'buyer@example.com' }
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }
    if (href.includes('/subscriptions/sub_fail')) {
      // Stripe rejects the cancel (e.g. the subscription id belongs to another mode).
      return new Response(JSON.stringify({ error: { message: 'No such subscription: sub_fail' } }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }
    if (href.includes('/customers/cus_test')) {
      return new Response(JSON.stringify({ id: 'cus_test', email: 'buyer@example.com' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }
    throw new Error(`Unexpected Stripe call: ${href}`);
  };

  try {
    const success = await worker.fetch(
      new Request('https://eloguard.app/success?installId=test-cancel-fail-123456&session_id=cs_test_monthly'),
      testEnv
    );
    assert.equal(success.status, 200);

    const cancel = await worker.fetch(
      new Request('https://eloguard.app/api/cancel-renewal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ installId: 'test-cancel-fail-123456' })
      }),
      testEnv
    );
    // Caught and returned as JSON, not thrown (which would be a Cloudflare 1101).
    assert.equal(cancel.status, 500);
    const body = await cancel.json();
    assert.ok(body.error);
    // The raw Stripe error text must not leak to the client.
    assert.doesNotMatch(body.error, /No such subscription/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
