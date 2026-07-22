import assert from 'node:assert/strict';
import test from 'node:test';
import worker, { deriveEntitlement, hmacSha256Hex, verifyStripeSignature } from '../src/worker.js';

function createMemoryDb() {
  const installations = new Map();
  const customers = new Map();
  const subscriptions = new Map();
  const restoreCodes = new Map();
  const restoreKey = (email, installId) => `${email} ${installId}`;

  return {
    data: { installations, customers, subscriptions, restoreCodes },
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      return {
        bind(...args) {
          return {
            async first() {
              if (normalized.startsWith('SELECT * FROM restore_codes')) {
                return restoreCodes.get(restoreKey(args[0], args[1])) || null;
              }
              if (normalized.startsWith('SELECT * FROM installations')) {
                return installations.get(args[0]) || null;
              }
              if (normalized.startsWith('SELECT install_id FROM subscription_installations')) {
                const installId = subscriptions.get(args[0]);
                return installId ? { install_id: installId } : null;
              }
              if (normalized.startsWith('SELECT install_id FROM installations WHERE stripe_payment_intent_id')) {
                const row = [...installations.values()].find((entry) => entry.stripe_payment_intent_id === args[0]);
                return row ? { install_id: row.install_id } : null;
              }
              if (normalized.startsWith('SELECT install_id FROM customer_installations')) {
                const installId = customers.get(args[0]);
                return installId ? { install_id: installId } : null;
              }
              throw new Error(`Unhandled first SQL: ${normalized}`);
            },
            async run() {
              if (normalized.startsWith('INSERT OR REPLACE INTO restore_codes')) {
                const [email, installId, codeHash, expiresAt, createdAt] = args;
                restoreCodes.set(restoreKey(email, installId), {
                  email,
                  install_id: installId,
                  code_hash: codeHash,
                  expires_at: expiresAt,
                  attempts: 0,
                  created_at: createdAt
                });
                return { success: true };
              }
              if (normalized.startsWith('UPDATE restore_codes SET attempts = attempts + 1')) {
                const row = restoreCodes.get(restoreKey(args[0], args[1]));
                if (row) row.attempts += 1;
                return { success: true };
              }
              if (normalized.startsWith('DELETE FROM restore_codes')) {
                restoreCodes.delete(restoreKey(args[0], args[1]));
                return { success: true };
              }
              if (normalized.startsWith('UPDATE installations SET plan = \'free\'')) {
                const [updatedAt, installId] = args;
                const existing = installations.get(installId);
                if (existing) {
                  installations.set(installId, {
                    ...existing,
                    plan: 'free',
                    status: 'none',
                    current_period_end: '',
                    access_until: '',
                    cancel_at_period_end: 0,
                    cancel_at: '',
                    updated_at: updatedAt
                  });
                }
                return { success: true };
              }
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
    STRIPE_TRIAL_DAYS: '7',
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

async function signedWebhook(event, testEnv) {
  const body = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const digest = await hmacSha256Hex(testEnv.STRIPE_WEBHOOK_SECRET, `${timestamp}.${body}`);
  return worker.fetch(new Request('https://eloguard.app/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': `t=${timestamp},v1=${digest}`
    },
    body
  }), testEnv);
}

function seedLifetimeEntitlement(testEnv, installId, paymentIntentId) {
  testEnv.DB.data.installations.set(installId, {
    install_id: installId,
    plan: 'pro',
    status: 'lifetime',
    stripe_customer_id: 'cus_test',
    stripe_subscription_id: '',
    stripe_payment_intent_id: paymentIntentId,
    customer_email: 'buyer@example.com',
    current_period_end: '',
    access_until: '',
    cancel_at_period_end: 0,
    cancel_at: '',
    updated_at: new Date().toISOString()
  });
}

test('full charge refund revokes a lifetime entitlement', async () => {
  const testEnv = env();
  seedLifetimeEntitlement(testEnv, 'refund-install-123456', 'pi_refund');

  const response = await signedWebhook({
    id: 'evt_full_refund',
    type: 'charge.refunded',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        refunded: true,
        amount: 1500,
        amount_refunded: 1500,
        payment_intent: 'pi_refund',
        customer: 'cus_test'
      }
    }
  }, testEnv);

  assert.equal(response.status, 200);
  assert.equal(testEnv.DB.data.installations.get('refund-install-123456').plan, 'free');
  assert.equal(testEnv.DB.data.installations.get('refund-install-123456').status, 'none');
});

test('partial charge refund keeps the entitlement active', async () => {
  const testEnv = env();
  seedLifetimeEntitlement(testEnv, 'partial-refund-install-123456', 'pi_partial_refund');

  const response = await signedWebhook({
    id: 'evt_partial_refund',
    type: 'charge.refunded',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        refunded: false,
        amount: 1500,
        amount_refunded: 500,
        payment_intent: 'pi_partial_refund',
        customer: 'cus_test'
      }
    }
  }, testEnv);

  assert.equal(response.status, 200);
  assert.equal(testEnv.DB.data.installations.get('partial-refund-install-123456').plan, 'pro');
  assert.equal(testEnv.DB.data.installations.get('partial-refund-install-123456').status, 'lifetime');
});

test('charge dispute revokes the affected entitlement', async () => {
  const testEnv = env();
  seedLifetimeEntitlement(testEnv, 'dispute-install-123456', 'pi_dispute');

  const response = await signedWebhook({
    id: 'evt_dispute',
    type: 'charge.dispute.created',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        payment_intent: 'pi_dispute',
        charge: 'ch_dispute'
      }
    }
  }, testEnv);

  assert.equal(response.status, 200);
  assert.equal(testEnv.DB.data.installations.get('dispute-install-123456').plan, 'free');
  assert.equal(testEnv.DB.data.installations.get('dispute-install-123456').status, 'none');
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
    const params = new URLSearchParams(calls[0].body);
    assert.equal(params.get('mode'), 'subscription');
    assert.equal(params.get('client_reference_id'), 'test-install-123456');
    assert.equal(params.get('payment_method_collection'), 'always');
    assert.equal(params.get('subscription_data[trial_period_days]'), '7');
    assert.equal(params.get('subscription_data[trial_settings][end_behavior][missing_payment_method]'), 'cancel');
    assert.match(params.get('custom_text[submit][message]'), /card is required/i);
    assert.match(params.get('custom_text[submit][message]'), /\$2\.99\/month/);
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

test('success provisions a trialing subscription without an initial charge', async () => {
  const testEnv = env();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    id: 'cs_test_trial',
    mode: 'subscription',
    payment_status: 'no_payment_required',
    client_reference_id: 'test-trial-123456',
    customer: { id: 'cus_trial', email: 'trial@example.com' },
    subscription: {
      id: 'sub_trial',
      status: 'trialing',
      current_period_end: 1893456000
    },
    customer_details: { email: 'trial@example.com' }
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
  try {
    const success = await worker.fetch(
      new Request('https://eloguard.app/success?installId=test-trial-123456&session_id=cs_test_trial'),
      testEnv
    );
    assert.equal(success.status, 200);
    assert.match(await success.text(), /trial is active/i);

    const entitlement = await worker.fetch(
      new Request('https://eloguard.app/api/entitlement?installId=test-trial-123456'),
      testEnv
    );
    const body = await entitlement.json();
    assert.equal(body.plan, 'pro');
    assert.equal(body.status, 'trialing');
    assert.equal(body.currentPeriodEnd, '2030-01-01T00:00:00.000Z');
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
    assert.match(await success.text(), /Checkout not verified yet/);

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

// -----------------------------------------------------------------------------
// Two-step email-verified restore (/restore + /restore/verify)
// -----------------------------------------------------------------------------

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

// Mocks Stripe customer/subscription lookups plus the Resend send endpoint.
// `subsByCustomer` maps a customer id to its subscription list. `onSend`
// receives the parsed Resend payload (used to capture the emailed code).
function restoreFetchMock({ customers = [], subsByCustomer = {}, resendStatus = 200, onSend } = {}) {
  return async (url, init = {}) => {
    const href = String(url);
    if (href.startsWith('https://api.resend.com/emails')) {
      if (onSend) onSend(JSON.parse(init.body));
      return jsonResponse({ id: 'email_test' }, resendStatus);
    }
    if (href.includes('/v1/customers')) {
      return jsonResponse({ data: customers });
    }
    if (href.includes('/v1/subscriptions')) {
      const customerId = new URL(href).searchParams.get('customer');
      return jsonResponse({ data: subsByCustomer[customerId] || [] });
    }
    throw new Error(`Unexpected Stripe call: ${href}`);
  };
}

function restorePost(path, body, testEnv) {
  return worker.fetch(
    new Request(`https://eloguard.app${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    }),
    testEnv
  );
}

const RESTORE_EMAIL = 'buyer@example.com';
const RESTORE_INSTALL = 'restore-install-123456';
const activeSubCustomer = [{ id: 'cus_active', email: RESTORE_EMAIL }];
const activeSub = { subsByCustomer: { cus_active: [{ id: 'sub_active', status: 'active', current_period_end: 1893456000 }] } };

test('restore sends a code and grants nothing', async () => {
  const testEnv = env({ RESEND_API_KEY: 're_test', RESTORE_EMAIL_FROM: 'EloGuard <noreply@eloguard.app>' });
  const originalFetch = globalThis.fetch;
  let sent = null;
  globalThis.fetch = restoreFetchMock({ customers: activeSubCustomer, ...activeSub, onSend: (p) => { sent = p; } });
  try {
    const res = await restorePost('/restore', { email: RESTORE_EMAIL, installId: RESTORE_INSTALL }, testEnv);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, status: 'code_sent', expiresInSeconds: 600 });

    // A code was emailed...
    assert.match(sent.text, /\d{6}/);
    assert.deepEqual(sent.to, [RESTORE_EMAIL]);
    // ...but nothing was granted and no routing table was written.
    const ent = await worker.fetch(new Request(`https://eloguard.app/api/entitlement?installId=${RESTORE_INSTALL}`), testEnv);
    assert.equal((await ent.json()).plan, 'free');
    assert.equal(testEnv.DB.data.installations.size, 0);
    assert.equal(testEnv.DB.data.customers.size, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('restore without RESEND_API_KEY returns 503 and grants nothing', async () => {
  const testEnv = env();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = restoreFetchMock({ customers: activeSubCustomer, ...activeSub });
  try {
    const res = await restorePost('/restore', { email: RESTORE_EMAIL, installId: RESTORE_INSTALL }, testEnv);
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { ok: false, error: 'restore_unavailable' });
    assert.equal(testEnv.DB.data.installations.size, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('restore returns not_found when no restorable entitlement exists', async () => {
  const testEnv = env({ RESEND_API_KEY: 're_test', RESTORE_EMAIL_FROM: 'x' });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = restoreFetchMock({ customers: [], subsByCustomer: {} });
  try {
    const res = await restorePost('/restore', { email: RESTORE_EMAIL, installId: RESTORE_INSTALL }, testEnv);
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { ok: false, error: 'not_found' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('restore verify with the correct code grants the entitlement', async () => {
  const testEnv = env({ RESEND_API_KEY: 're_test', RESTORE_EMAIL_FROM: 'x' });
  const originalFetch = globalThis.fetch;
  let code = null;
  globalThis.fetch = restoreFetchMock({
    customers: activeSubCustomer,
    ...activeSub,
    onSend: (p) => { code = p.text.match(/\d{6}/)[0]; }
  });
  try {
    const send = await restorePost('/restore', { email: RESTORE_EMAIL, installId: RESTORE_INSTALL }, testEnv);
    assert.equal(send.status, 200);

    const verify = await restorePost('/restore/verify', { email: RESTORE_EMAIL, installId: RESTORE_INSTALL, code }, testEnv);
    assert.equal(verify.status, 200);
    const body = await verify.json();
    assert.equal(body.ok, true);
    assert.equal(body.entitlement.plan, 'pro');
    assert.equal(body.entitlement.status, 'active');
    // The code row is consumed.
    assert.equal(testEnv.DB.data.restoreCodes.size, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('restore verify rejects a wrong code without granting', async () => {
  const testEnv = env({ RESEND_API_KEY: 're_test', RESTORE_EMAIL_FROM: 'x' });
  const originalFetch = globalThis.fetch;
  let code = null;
  globalThis.fetch = restoreFetchMock({
    customers: activeSubCustomer,
    ...activeSub,
    onSend: (p) => { code = p.text.match(/\d{6}/)[0]; }
  });
  try {
    await restorePost('/restore', { email: RESTORE_EMAIL, installId: RESTORE_INSTALL }, testEnv);
    const wrong = code === '000000' ? '111111' : '000000';
    const verify = await restorePost('/restore/verify', { email: RESTORE_EMAIL, installId: RESTORE_INSTALL, code: wrong }, testEnv);
    assert.equal(verify.status, 400);
    assert.deepEqual(await verify.json(), { ok: false, error: 'invalid_code' });
    assert.equal(testEnv.DB.data.installations.size, 0);
    // Attempt was counted; the row survives for a retry.
    assert.equal(testEnv.DB.data.restoreCodes.get(`${RESTORE_EMAIL} ${RESTORE_INSTALL}`).attempts, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('restore verify rejects an expired code', async () => {
  const testEnv = env({ RESEND_API_KEY: 're_test', RESTORE_EMAIL_FROM: 'x' });
  const originalFetch = globalThis.fetch;
  let code = null;
  globalThis.fetch = restoreFetchMock({
    customers: activeSubCustomer,
    ...activeSub,
    onSend: (p) => { code = p.text.match(/\d{6}/)[0]; }
  });
  try {
    await restorePost('/restore', { email: RESTORE_EMAIL, installId: RESTORE_INSTALL }, testEnv);
    // Force the stored code past its expiry.
    testEnv.DB.data.restoreCodes.get(`${RESTORE_EMAIL} ${RESTORE_INSTALL}`).expires_at = Date.now() - 1000;

    const verify = await restorePost('/restore/verify', { email: RESTORE_EMAIL, installId: RESTORE_INSTALL, code }, testEnv);
    assert.equal(verify.status, 400);
    assert.deepEqual(await verify.json(), { ok: false, error: 'code_expired' });
    assert.equal(testEnv.DB.data.installations.size, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('restore restores a past_due subscription', async () => {
  const testEnv = env({ RESEND_API_KEY: 're_test', RESTORE_EMAIL_FROM: 'x' });
  const originalFetch = globalThis.fetch;
  let code = null;
  globalThis.fetch = restoreFetchMock({
    customers: [{ id: 'cus_pastdue', email: RESTORE_EMAIL }],
    subsByCustomer: { cus_pastdue: [{ id: 'sub_pastdue', status: 'past_due', current_period_end: 1893456000 }] },
    onSend: (p) => { code = p.text.match(/\d{6}/)[0]; }
  });
  try {
    const send = await restorePost('/restore', { email: RESTORE_EMAIL, installId: RESTORE_INSTALL }, testEnv);
    // past_due is restorable (dunning grace window), so a code is sent.
    assert.equal(send.status, 200);

    const verify = await restorePost('/restore/verify', { email: RESTORE_EMAIL, installId: RESTORE_INSTALL, code }, testEnv);
    assert.equal(verify.status, 200);
    const body = await verify.json();
    assert.equal(body.entitlement.plan, 'pro');
    assert.equal(body.entitlement.status, 'past_due');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
