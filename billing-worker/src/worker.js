const PRO_STATUSES = new Set(['active', 'trialing', 'past_due']);
const PUBLIC_PRO_STATUSES = new Set(['active', 'trialing', 'past_due', 'lifetime']);

function envNumber(env, key, fallback) {
  const value = Number(env[key]);
  return Number.isFinite(value) ? value : fallback;
}

function appBaseUrl(env) {
  return (env.APP_BASE_URL || 'https://eloguard.app').replace(/\/$/, '');
}

function isValidInstallId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_.:-]{12,128}$/.test(value);
}

function normalizePlan(value) {
  return value === 'monthly' || value === 'lifetime' ? value : '';
}

function deriveEntitlement({ status, currentPeriodEndSeconds, graceDays = 14, nowMs = Date.now() }) {
  const periodEndMs = Number.isFinite(currentPeriodEndSeconds) && currentPeriodEndSeconds > 0
    ? currentPeriodEndSeconds * 1000
    : 0;
  const graceMs = Math.max(0, graceDays) * 24 * 60 * 60 * 1000;
  const plan = PRO_STATUSES.has(status) ? 'pro' : 'free';

  let accessUntilMs = 0;
  if (status === 'active' || status === 'trialing') accessUntilMs = periodEndMs;
  if (status === 'past_due') accessUntilMs = (periodEndMs || nowMs) + graceMs;

  return {
    plan,
    currentPeriodEnd: periodEndMs ? new Date(periodEndMs).toISOString() : '',
    accessUntil: accessUntilMs ? new Date(accessUntilMs).toISOString() : ''
  };
}

function publicEntitlement(record) {
  if (!record) {
    return { plan: 'free', status: 'free', source: 'billing-worker', currentPeriodEnd: '', accessUntil: '', cancelAtPeriodEnd: false, cancelAt: '' };
  }

  const plan = record.plan || 'free';
  const status = plan === 'pro' && PUBLIC_PRO_STATUSES.has(record.status) ? record.status : 'free';
  return {
    plan,
    status,
    source: 'stripe',
    currentPeriodEnd: record.current_period_end || '',
    accessUntil: record.access_until || '',
    cancelAtPeriodEnd: Boolean(record.cancel_at_period_end),
    cancelAt: record.cancel_at || ''
  };
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      ...headers
    }
  });
}

function html(body, status = 200) {
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><title>EloGuard</title></head><body>${body}</body></html>`, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' }
  });
}

function redirect(url, status = 303) {
  return new Response(null, { status, headers: { location: url } });
}

function formBody(params) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') body.append(key, String(value));
  }
  return body;
}

async function stripeRequest(env, path, { method = 'GET', params = {}, expand = [] } = {}) {
  if (!env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not configured');

  let url = `https://api.stripe.com/v1${path}`;
  const init = {
    method,
    headers: {
      authorization: `Basic ${btoa(`${env.STRIPE_SECRET_KEY}:`)}`,
      'stripe-version': '2024-06-20'
    }
  };

  const query = new URLSearchParams();
  for (const item of expand) query.append('expand[]', item);

  if (method === 'GET') {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') query.append(key, String(value));
    }
  } else {
    init.headers['content-type'] = 'application/x-www-form-urlencoded';
    init.body = formBody(params);
  }

  if ([...query].length) url = `${url}?${query}`;
  const response = await fetch(url, init);
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(data?.error?.message || `Stripe request failed (${response.status})`);
  }
  return data;
}

async function getInstallation(env, installId) {
  return env.DB.prepare('SELECT * FROM installations WHERE install_id = ?').bind(installId).first();
}

async function saveSubscriptionEntitlement(env, { installId, customerId = '', subscriptionId = '', status = 'unknown', currentPeriodEndSeconds = 0, customerEmail = '', cancelAtPeriodEnd = false, cancelAtSeconds = 0 }) {
  if (!isValidInstallId(installId)) return;

  const derived = deriveEntitlement({
    status,
    currentPeriodEndSeconds,
    graceDays: envNumber(env, 'STRIPE_GRACE_DAYS', 14),
    nowMs: Date.now()
  });

  await env.DB.prepare(`
    INSERT INTO installations (
      install_id, plan, status, stripe_customer_id, stripe_subscription_id,
      stripe_payment_intent_id, customer_email, current_period_end, access_until,
      cancel_at_period_end, cancel_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?)
    ON CONFLICT(install_id) DO UPDATE SET
      plan = excluded.plan,
      status = excluded.status,
      stripe_customer_id = COALESCE(NULLIF(excluded.stripe_customer_id, ''), installations.stripe_customer_id),
      stripe_subscription_id = COALESCE(NULLIF(excluded.stripe_subscription_id, ''), installations.stripe_subscription_id),
      customer_email = COALESCE(NULLIF(excluded.customer_email, ''), installations.customer_email),
      current_period_end = COALESCE(NULLIF(excluded.current_period_end, ''), installations.current_period_end),
      access_until = excluded.access_until,
      cancel_at_period_end = excluded.cancel_at_period_end,
      cancel_at = excluded.cancel_at,
      updated_at = excluded.updated_at
  `).bind(
    installId,
    derived.plan,
    status || 'unknown',
    customerId,
    subscriptionId,
    customerEmail,
    derived.currentPeriodEnd,
    derived.accessUntil,
    cancelAtPeriodEnd ? 1 : 0,
    cancelAtSeconds ? new Date(cancelAtSeconds * 1000).toISOString() : '',
    new Date().toISOString()
  ).run();

  if (customerId) {
    await env.DB.prepare('INSERT OR REPLACE INTO customer_installations (customer_id, install_id) VALUES (?, ?)')
      .bind(customerId, installId)
      .run();
  }
  if (subscriptionId) {
    await env.DB.prepare('INSERT OR REPLACE INTO subscription_installations (subscription_id, install_id) VALUES (?, ?)')
      .bind(subscriptionId, installId)
      .run();
  }
}

async function saveLifetimeEntitlement(env, { installId, customerId = '', paymentIntentId = '', customerEmail = '' }) {
  if (!isValidInstallId(installId)) return;

  await env.DB.prepare(`
    INSERT INTO installations (
      install_id, plan, status, stripe_customer_id, stripe_subscription_id,
      stripe_payment_intent_id, customer_email, current_period_end, access_until,
      cancel_at_period_end, cancel_at, updated_at
    )
    VALUES (?, 'pro', 'lifetime', ?, '', ?, ?, '', '', 0, '', ?)
    ON CONFLICT(install_id) DO UPDATE SET
      plan = 'pro',
      status = 'lifetime',
      stripe_customer_id = COALESCE(NULLIF(excluded.stripe_customer_id, ''), installations.stripe_customer_id),
      stripe_payment_intent_id = COALESCE(NULLIF(excluded.stripe_payment_intent_id, ''), installations.stripe_payment_intent_id),
      customer_email = COALESCE(NULLIF(excluded.customer_email, ''), installations.customer_email),
      current_period_end = '',
      access_until = '',
      cancel_at_period_end = 0,
      cancel_at = '',
      updated_at = excluded.updated_at
  `).bind(
    installId,
    customerId,
    paymentIntentId,
    customerEmail,
    new Date().toISOString()
  ).run();

  if (customerId) {
    await env.DB.prepare('INSERT OR REPLACE INTO customer_installations (customer_id, install_id) VALUES (?, ?)')
      .bind(customerId, installId)
      .run();
  }
}

async function installIdForSubscription(env, subscription) {
  const direct = subscription?.metadata?.installId;
  if (isValidInstallId(direct)) return direct;

  if (subscription?.id) {
    const row = await env.DB.prepare('SELECT install_id FROM subscription_installations WHERE subscription_id = ?')
      .bind(subscription.id)
      .first();
    if (row?.install_id) return row.install_id;
  }

  if (subscription?.customer) {
    const row = await env.DB.prepare('SELECT install_id FROM customer_installations WHERE customer_id = ?')
      .bind(subscription.customer)
      .first();
    if (row?.install_id) return row.install_id;
  }
  return '';
}

async function customerEmail(env, customerId) {
  if (!customerId) return '';
  try {
    const customer = await stripeRequest(env, `/customers/${encodeURIComponent(customerId)}`);
    return customer && !customer.deleted ? customer.email || '' : '';
  } catch (_) {
    return '';
  }
}

async function provisionFromCheckoutSession(env, sessionId, expectedInstallId = '') {
  if (!sessionId) return false;

  const session = await stripeRequest(env, `/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    expand: ['subscription', 'customer', 'payment_intent']
  });

  const installId = session.client_reference_id || session.metadata?.installId || expectedInstallId || '';
  if (!isValidInstallId(installId)) return false;

  const customer = session.customer && typeof session.customer === 'object' ? session.customer : null;
  const customerId = typeof session.customer === 'string' ? session.customer : customer?.id || '';

  if (session.mode === 'payment' && session.payment_status === 'paid') {
    const paymentIntentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id || '';
    await saveLifetimeEntitlement(env, {
      installId,
      customerId,
      paymentIntentId,
      customerEmail: session.customer_details?.email || customer?.email || await customerEmail(env, customerId)
    });
    return true;
  }

  if (session.mode !== 'subscription') return false;

  let subscription = session.subscription && typeof session.subscription === 'object'
    ? session.subscription
    : null;
  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : subscription?.id || '';
  if (!subscription && subscriptionId) {
    subscription = await stripeRequest(env, `/subscriptions/${encodeURIComponent(subscriptionId)}`);
  }

  const status = subscription?.status || '';
  if (!subscriptionId || !PRO_STATUSES.has(status)) return false;

  await saveSubscriptionEntitlement(env, {
    installId,
    customerId,
    subscriptionId,
    status,
    currentPeriodEndSeconds: subscription?.current_period_end,
    customerEmail: session.customer_details?.email || customer?.email || await customerEmail(env, customerId),
    cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
    cancelAtSeconds: subscription?.cancel_at || (subscription?.cancel_at_period_end ? subscription?.current_period_end : 0)
  });
  return true;
}

// Full, self-contained plan-chooser page. Matches the EloGuard success page
// design system (chess.com dark theme, green/gold/blue, board texture). Two
// long cards — Free and Pro — with the monthly/lifetime purchase links inside
// the Pro card, preserving the existing Stripe redirect flow. `feature` is only
// ever used to build the links (never echoed into HTML), keeping the page
// injection-safe.
function renderCheckoutPage(installId, feature) {
  const enc = encodeURIComponent(installId);
  const featureParam = feature ? `&feature=${encodeURIComponent(feature)}` : '';
  const monthlyHref = `/checkout?installId=${enc}${featureParam}&plan=monthly`;
  const lifetimeHref = `/checkout?installId=${enc}${featureParam}&plan=lifetime`;
  return checkoutPageHtml({ monthlyHref, lifetimeHref });
}

function checkoutPageHtml({ monthlyHref, lifetimeHref }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Upgrade to EloGuard Pro</title>
<style>
  :root{
    --bg:#262522; --card:#2a2926;
    --green:#81b64c; --green-bright:#4CAF50; --green-text:#9ed17a; --green-text-2:#a6da84;
    --blue-text:#7fb0f5; --gold:#f6c453; --gold-soft:#ffe08a; --amber:#e0a93b;
    --t-primary:#ffffff; --t-soft:#e9edf4; --t-muted:#aaaaaa; --t-dim:#8a93a3;
    --border:rgba(255,255,255,0.07);
    --border-blue:rgba(96,165,250,0.32); --border-green:rgba(129,182,76,0.34);
    --border-gold:rgba(246,196,83,0.40);
    --shadow:0 8px 24px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.07);
    --font:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{min-height:100%}
  body{
    font-family:var(--font); color:var(--t-primary);
    background:
      radial-gradient(120% 80% at 50% -10%, rgba(59,130,246,0.10), rgba(59,130,246,0) 55%),
      radial-gradient(90% 60% at 50% 110%, rgba(129,182,76,0.08), rgba(129,182,76,0) 60%),
      var(--bg);
    min-height:100vh; display:flex; align-items:center; justify-content:center;
    padding:36px 18px 44px; overflow-x:hidden; position:relative;
    -webkit-font-smoothing:antialiased;
  }
  .board-texture{
    position:fixed; inset:0; z-index:0; pointer-events:none;
    background-image:
      linear-gradient(45deg, rgba(255,255,255,0.014) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.014) 75%),
      linear-gradient(45deg, rgba(255,255,255,0.014) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.014) 75%);
    background-size:104px 104px; background-position:0 0, 52px 52px;
    -webkit-mask-image:radial-gradient(120% 90% at 50% 20%, #000 0%, transparent 82%);
    mask-image:radial-gradient(120% 90% at 50% 20%, #000 0%, transparent 82%);
    opacity:.7;
  }
  .stage{position:relative; z-index:10; width:100%; max-width:660px;}

  .wordmark{
    display:flex; align-items:center; justify-content:center; gap:11px;
    margin-bottom:26px; letter-spacing:.2px;
    animation:riseIn .5s cubic-bezier(.2,.7,.3,1) both;
  }
  .wordmark .shield{font-size:24px; filter:drop-shadow(0 1px 3px rgba(0,0,0,.5))}
  .wordmark .name{font-size:19px; font-weight:800; color:var(--t-soft)}
  .wordmark .name b{color:var(--green-text-2)}
  .wordmark .sep{width:1px; height:17px; background:var(--border);}
  .wordmark .tag{font-size:11px; color:var(--t-dim); font-weight:600; text-transform:uppercase; letter-spacing:1.4px}

  .compare{display:grid; grid-template-columns:1fr 1.05fr; gap:16px; align-items:stretch;}
  .col{
    position:relative; overflow:hidden; border-radius:16px; padding:22px 20px;
    display:flex; flex-direction:column; box-shadow:var(--shadow);
    animation:riseIn .5s cubic-bezier(.2,.7,.3,1) both;
  }
  .col.free{border:1px solid var(--border); background:linear-gradient(157deg,#2b2a27 0%, #262521 100%); animation-delay:.06s}
  .col.pro{
    border:1px solid var(--border-gold); animation-delay:.12s;
    background:
      radial-gradient(135% 80% at 100% 0%, rgba(246,196,83,0.16), rgba(246,196,83,0) 58%),
      linear-gradient(157deg,#31302a 0%, #2a2823 52%, #24221d 100%);
    box-shadow:var(--shadow), 0 20px 55px rgba(0,0,0,0.45), 0 0 0 1px rgba(246,196,83,0.06);
  }
  .col.pro .sheen{
    position:absolute; top:-60%; left:-45%; width:45%; height:220%;
    background:linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.09) 50%, rgba(255,255,255,0) 100%);
    transform:rotate(8deg); pointer-events:none; z-index:1;
    animation:sheen 6s ease-in-out infinite; animation-delay:1s;
  }
  .col-head{display:flex; align-items:center; gap:8px; position:relative; z-index:2; margin-bottom:3px}
  .col-head .tier{font-size:14px; font-weight:800; letter-spacing:.5px; text-transform:uppercase}
  .col.free .tier{color:var(--t-dim)}
  .col.pro .tier{
    background:linear-gradient(135deg,#ffe08a,#f6c453 60%,#e0a93b);
    -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; color:transparent;
  }
  .col.pro .crown{font-size:15px; filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))}
  .col .price-tag{position:relative; z-index:2; font-size:11.5px; color:var(--t-dim); margin-bottom:15px}
  .col.pro .price-tag b{color:var(--gold-soft); font-weight:700}

  ul.flist{list-style:none; display:flex; flex-direction:column; gap:12px; position:relative; z-index:2}
  .flist li{display:flex; align-items:flex-start; gap:11px; font-size:13px; line-height:1.4}
  .flist .mk{flex:0 0 auto; width:18px; height:18px; margin-top:.5px; display:flex; align-items:center; justify-content:center}
  .flist .mk svg{width:18px; height:18px}
  .flist .lt{color:var(--t-soft)}
  .flist .cap{color:var(--t-muted)}
  .flist .cap .n{font-size:10px; color:var(--amber); font-weight:700; text-transform:uppercase; letter-spacing:.4px; margin-left:2px; white-space:nowrap}
  .col.pro .flist .lt{color:var(--t-primary); font-weight:600}
  .col.pro .flist .lt .win{display:block; font-size:11px; font-weight:500; color:var(--t-dim); margin-top:1px;}
  .pill-un{
    display:inline-block; font-size:9.5px; font-weight:800; letter-spacing:.5px; text-transform:uppercase;
    color:#2a2107; background:linear-gradient(135deg,#ffe08a,#f6c453); border-radius:5px;
    padding:1px 6px; margin-left:6px; vertical-align:1px; box-shadow:0 1px 3px rgba(246,196,83,.3);
  }
  .col.pro .everything{
    display:flex; align-items:center; gap:8px; margin-bottom:14px; padding-bottom:13px;
    border-bottom:1px dashed rgba(246,196,83,0.22);
    font-size:12.5px; font-weight:700; color:var(--green-text-2); position:relative; z-index:2;
  }
  .col.pro .everything svg{width:15px;height:15px;flex:0 0 auto}

  /* footers pinned to bottom so both long cards align */
  .free-foot{
    margin-top:auto; padding-top:18px; display:flex; align-items:baseline; gap:9px;
    position:relative; z-index:2;
  }
  .free-foot .fp{font-size:26px; font-weight:800; color:var(--t-soft); letter-spacing:-.5px}
  .free-foot .fn{font-size:12px; color:var(--t-dim)}

  .pro-buy{margin-top:auto; padding-top:18px; display:flex; flex-direction:column; gap:11px; position:relative; z-index:2}
  .buy{
    position:relative; display:flex; flex-direction:column; align-items:center; text-align:center;
    text-decoration:none; border-radius:11px; padding:12px 14px;
    transition:transform .16s ease, box-shadow .16s ease, border-color .16s ease;
  }
  .buy .bm{font-size:14.5px; font-weight:800; letter-spacing:.2px}
  .buy .bs{font-size:11.5px; margin-top:3px; font-weight:600}
  .buy.monthly{
    color:var(--t-soft);
    background:linear-gradient(135deg, rgba(43,155,244,0.20), rgba(43,155,244,0.08));
    border:1px solid var(--border-blue);
  }
  .buy.monthly .bs{color:var(--t-dim)}
  .buy.monthly:hover{transform:translateY(-2px); border-color:var(--blue-text); box-shadow:0 12px 26px rgba(43,155,244,0.20)}
  .buy.lifetime{
    color:#22190a;
    background:linear-gradient(135deg,#ffe08a 0%,#f6c453 55%,#e6b23f 100%);
    box-shadow:0 8px 22px rgba(246,196,83,.34), inset 0 1px 0 rgba(255,255,255,.5);
  }
  .buy.lifetime .bs{color:#5a4410}
  .buy.lifetime:hover{transform:translateY(-2px); box-shadow:0 14px 34px rgba(246,196,83,.5), inset 0 1px 0 rgba(255,255,255,.5)}
  .buy .bv{
    position:absolute; top:-10px; right:12px;
    font-size:9px; font-weight:800; letter-spacing:.8px; text-transform:uppercase;
    color:var(--gold-soft); background:#231a08; border:1px solid rgba(246,196,83,.5);
    padding:3px 8px; border-radius:999px; box-shadow:0 3px 8px rgba(0,0,0,.4);
  }

  footer{margin-top:22px; text-align:center; animation:riseIn .5s ease both; animation-delay:.2s}
  .trust{
    display:flex; align-items:center; justify-content:center; gap:8px; flex-wrap:wrap;
    font-size:12px; color:var(--t-dim); margin-bottom:9px;
  }
  .trust svg{width:13px; height:13px; opacity:.9; vertical-align:-2px}
  .trust .dot{width:3px; height:3px; border-radius:50%; background:var(--t-dim); opacity:.5}
  .legal{font-size:11.5px; color:var(--t-dim); opacity:.8}
  .legal a{color:var(--blue-text); text-decoration:none}
  .legal a:hover{text-decoration:underline}

  @keyframes sheen{0%{left:-45%;opacity:0}42%{opacity:1}60%{left:125%;opacity:0}100%{left:125%;opacity:0}}
  @keyframes riseIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}

  @media (max-width:560px){
    .compare{grid-template-columns:1fr; gap:14px}
    .col.pro{order:-1}
    .wordmark .tag{display:none}
  }
  @media (max-width:360px){ body{padding:24px 12px 34px} }
  @media (prefers-reduced-motion: reduce){
    *,*::before,*::after{animation:none !important; transition:none !important}
    .buy:hover{transform:none}
  }
</style>
</head>
<body>
  <div class="board-texture" aria-hidden="true"></div>
  <main class="stage">
    <div class="wordmark">
      <span class="shield">🛡️</span>
      <span class="name">Elo<b>Guard</b></span>
      <span class="sep"></span>
      <span class="tag">Tilt Protection</span>
    </div>

    <div class="compare">
      <!-- FREE -->
      <section class="col free">
        <div class="col-head"><span class="tier">Free</span></div>
        <div class="price-tag">What you have now</div>
        <ul class="flist">
          <li><span class="mk"><svg viewBox="0 0 24 24"><path d="M5 12.5 L10 17.5 L19 7" fill="none" stroke="#81b64c" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="lt">Stop-loss, ceiling &amp; loss-streak locks</span></li>
          <li><span class="mk"><svg viewBox="0 0 24 24"><path d="M5 12.5 L10 17.5 L19 7" fill="none" stroke="#81b64c" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="lt">Timed lockouts &amp; random-string unlock</span></li>
          <li><span class="mk"><svg viewBox="0 0 24 24"><path d="M5 12.5 L10 17.5 L19 7" fill="none" stroke="#81b64c" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="lt">Zen mode &mdash; hide Elo on site</span></li>
          <li><span class="mk"><svg viewBox="0 0 24 24"><path d="M5 12.5 L10 17.5 L19 7" fill="none" stroke="#81b64c" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="lt">Opponent &amp; self anonymizer</span></li>
          <li><span class="mk"><svg viewBox="0 0 24 24"><path d="M5 12.5 L10 17.5 L19 7" fill="none" stroke="#81b64c" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="lt">Enhanced focus mode &amp; cooldown</span></li>
          <li><span class="mk"><svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="9.5" rx="2" fill="none" stroke="#8a93a3" stroke-width="1.9"/><path d="M8 10.5 V8 a4 4 0 0 1 8 0 v2.5" fill="none" stroke="#8a93a3" stroke-width="1.9"/></svg></span><span class="cap">Cheat-risk detection<span class="n">3&nbsp;/&nbsp;day</span></span></li>
          <li><span class="mk"><svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="9.5" rx="2" fill="none" stroke="#8a93a3" stroke-width="1.9"/><path d="M8 10.5 V8 a4 4 0 0 1 8 0 v2.5" fill="none" stroke="#8a93a3" stroke-width="1.9"/></svg></span><span class="cap">Full game reviews<span class="n">3&nbsp;/&nbsp;day</span></span></li>
        </ul>
        <div class="free-foot">
          <span class="fp">$0</span>
          <span class="fn">You're on Free right now</span>
        </div>
      </section>

      <!-- PRO -->
      <section class="col pro">
        <div class="sheen" aria-hidden="true"></div>
        <div class="col-head"><span class="crown">👑</span><span class="tier">Pro</span></div>
        <div class="price-tag">Everything unlocked &mdash; from <b>$2.99</b></div>
        <div class="everything">
          <svg viewBox="0 0 24 24"><path d="M5 12.5 L10 17.5 L19 7" fill="none" stroke="#a6da84" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Everything in Free &mdash; with no limits
        </div>
        <ul class="flist">
          <li><span class="mk"><svg viewBox="0 0 24 24"><path d="M5 12.5 L10 17.5 L19 7" fill="none" stroke="#f6c453" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="lt">Unlimited cheat-risk detection<span class="pill-un">Unlimited</span><span class="win">Screen every opponent &mdash; no 3-a-day cap.</span></span></li>
          <li><span class="mk"><svg viewBox="0 0 24 24"><path d="M5 12.5 L10 17.5 L19 7" fill="none" stroke="#f6c453" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="lt">Unlimited game reviews<span class="pill-un">Unlimited</span><span class="win">On-device Stockfish. Nothing leaves your browser.</span></span></li>
          <li><span class="mk"><svg viewBox="0 0 24 24"><path d="M5 12.5 L10 17.5 L19 7" fill="none" stroke="#f6c453" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="lt">Smart Bracket auto-set<span class="pill-un">Pro only</span><span class="win">Auto stop-loss &amp; target from your live rating.</span></span></li>
        </ul>
        <div class="pro-buy">
          <a class="buy monthly" href="${monthlyHref}">
            <span class="bm">Start Monthly</span>
            <span class="bs">$2.99 / month &middot; cancel anytime</span>
          </a>
          <a class="buy lifetime" href="${lifetimeHref}">
            <span class="bv">Best value</span>
            <span class="bm">Get Lifetime</span>
            <span class="bs">$15 once &middot; yours forever</span>
          </a>
        </div>
      </section>
    </div>

    <footer>
      <div class="trust">
        <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 L19 6 L19 11 C19 16 16 19.5 12 21 C8 19.5 5 16 5 11 L5 6 Z" fill="none" stroke="#9ed17a" stroke-width="1.7" stroke-linejoin="round"/><path d="M9 12 L11 14 L15 9.5" fill="none" stroke="#9ed17a" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg> Secure checkout by Stripe</span>
        <span class="dot"></span>
        <span>We never see your card</span>
        <span class="dot"></span>
        <span>Cancel monthly anytime</span>
      </div>
      <div class="legal">
        Prices in USD. By upgrading you agree to our <a href="/terms">Terms</a> &amp; <a href="/privacy">Privacy Policy</a>.
      </div>
    </footer>
  </main>
</body>
</html>
`;
}

async function handleCheckout(request, env, url) {
  const installId = url.searchParams.get('installId') || '';
  const feature = url.searchParams.get('feature') || '';
  const plan = normalizePlan(url.searchParams.get('plan'));
  if (!isValidInstallId(installId)) return html('<h1>Missing or invalid installId</h1>', 400);

  if (!plan) {
    return new Response(renderCheckoutPage(installId, feature), {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' }
    });
  }

  const priceId = plan === 'lifetime' ? env.STRIPE_LIFETIME_PRICE_ID : env.STRIPE_MONTHLY_PRICE_ID;
  if (!priceId) {
    return html(`<h1>${plan === 'lifetime' ? 'STRIPE_LIFETIME_PRICE_ID' : 'STRIPE_MONTHLY_PRICE_ID'} is not configured</h1>`, 500);
  }

  const base = appBaseUrl(env);
  const params = {
    mode: plan === 'lifetime' ? 'payment' : 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': 1,
    client_reference_id: installId,
    'metadata[installId]': installId,
    'metadata[feature]': feature,
    'metadata[plan]': plan,
    success_url: `${base}/success?installId=${encodeURIComponent(installId)}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/cancel?installId=${encodeURIComponent(installId)}`,
    allow_promotion_codes: true,
    'automatic_tax[enabled]': env.STRIPE_AUTOMATIC_TAX === 'true'
  };

  if (plan === 'monthly') {
    params['subscription_data[metadata][installId]'] = installId;
    params['subscription_data[metadata][plan]'] = plan;
    const trialDays = envNumber(env, 'STRIPE_TRIAL_DAYS', 0);
    if (trialDays > 0) params['subscription_data[trial_period_days]'] = trialDays;
  } else {
    params.customer_creation = 'always';
  }

  const session = await stripeRequest(env, '/checkout/sessions', { method: 'POST', params });
  return redirect(session.url);
}

async function handlePortal(env, url) {
  const installId = url.searchParams.get('installId') || '';
  if (!isValidInstallId(installId)) return html('<h1>Missing or invalid installId</h1>', 400);

  const entitlement = await getInstallation(env, installId);
  if (!entitlement?.stripe_customer_id) {
    return redirect(`${appBaseUrl(env)}/checkout?installId=${encodeURIComponent(installId)}`);
  }

  const session = await stripeRequest(env, '/billing_portal/sessions', {
    method: 'POST',
    params: {
      customer: entitlement.stripe_customer_id,
      return_url: `${appBaseUrl(env)}/success?installId=${encodeURIComponent(installId)}`
    }
  });
  return redirect(session.url);
}

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch (_) {
    return {};
  }
}

async function handleCancelRenewal(request, env, url) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const body = await readJsonBody(request);
  const installId = body.installId || url.searchParams.get('installId') || '';
  if (!isValidInstallId(installId)) return json({ error: 'Missing or invalid installId' }, 400);

  const entitlement = await getInstallation(env, installId);
  if (!entitlement) return json({ error: 'No billing record found for this install' }, 404);
  if (entitlement.status === 'lifetime') {
    return json({
      ok: false,
      error: 'Lifetime purchases do not renew.',
      ...publicEntitlement(entitlement)
    }, 409);
  }
  if (!entitlement.stripe_subscription_id) {
    return json({ error: 'No active subscription was found for this install' }, 404);
  }

  const subscription = await stripeRequest(
    env,
    `/subscriptions/${encodeURIComponent(entitlement.stripe_subscription_id)}`,
    {
      method: 'POST',
      params: { cancel_at_period_end: 'true' }
    }
  );

  await saveSubscriptionEntitlement(env, {
    installId,
    customerId: subscription.customer || entitlement.stripe_customer_id || '',
    subscriptionId: subscription.id || entitlement.stripe_subscription_id || '',
    status: subscription.status || entitlement.status || 'unknown',
    currentPeriodEndSeconds: subscription.current_period_end,
    customerEmail: entitlement.customer_email || await customerEmail(env, subscription.customer),
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    cancelAtSeconds: subscription.cancel_at || (subscription.cancel_at_period_end ? subscription.current_period_end : 0)
  });

  const updated = await getInstallation(env, installId);
  return json({
    ok: true,
    message: 'Renewal cancelled. Pro remains active until the end of the paid period.',
    ...publicEntitlement(updated)
  });
}

async function handleSuccess(env, url) {
  let provisioned = false;
  if (url.searchParams.get('session_id')) {
    provisioned = await provisionFromCheckoutSession(
      env,
      url.searchParams.get('session_id'),
      url.searchParams.get('installId') || ''
    );
  }
  return html(`
    <h1>${provisioned ? 'EloGuard Pro is active' : 'Payment not verified yet'}</h1>
    <p>${provisioned ? 'Your purchase was verified.' : 'If you just paid, return to the extension popup and press Refresh in a few seconds.'}</p>
    <p>Return to the extension popup and press Refresh.</p>
  `);
}

async function handleEntitlement(env, url) {
  const installId = url.searchParams.get('installId') || '';
  if (!isValidInstallId(installId)) return json({ error: 'Missing or invalid installId' }, 400);
  return json(publicEntitlement(await getInstallation(env, installId)));
}

function parseStripeSignature(header) {
  const parsed = { t: '', v1: [] };
  for (const part of (header || '').split(',')) {
    const [key, value] = part.split('=');
    if (key === 't') parsed.t = value || '';
    if (key === 'v1' && value) parsed.v1.push(value);
  }
  return parsed;
}

function timingSafeEqualHex(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

async function hmacSha256Hex(secret, payload) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function verifyStripeSignature(rawBody, header, secret, nowMs = Date.now()) {
  const cleanSecret = String(secret || '').trim();
  if (!cleanSecret) return false;
  const parsed = parseStripeSignature(header);
  const timestamp = Number(parsed.t);
  if (!timestamp || Math.abs(nowMs / 1000 - timestamp) > 300) return false;
  const expected = await hmacSha256Hex(cleanSecret, `${parsed.t}.${rawBody}`);
  return parsed.v1.some((candidate) => timingSafeEqualHex(candidate, expected));
}

async function handleWebhook(request, env) {
  const rawBody = await request.text();
  const ok = await verifyStripeSignature(rawBody, request.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET);
  if (!ok) return json({ error: 'Invalid Stripe signature' }, 400);

  const event = JSON.parse(rawBody);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const installId = session.client_reference_id || session.metadata?.installId || '';

    if (session.mode === 'payment' && session.payment_status === 'paid') {
      await saveLifetimeEntitlement(env, {
        installId,
        customerId: session.customer || '',
        paymentIntentId: session.payment_intent || '',
        customerEmail: session.customer_details?.email || await customerEmail(env, session.customer)
      });
      return json({ received: true });
    }

    const subscription = session.subscription
      ? await stripeRequest(env, `/subscriptions/${encodeURIComponent(session.subscription)}`)
      : null;
    await saveSubscriptionEntitlement(env, {
      installId,
      customerId: session.customer || '',
      subscriptionId: session.subscription || '',
      status: subscription?.status || session.payment_status,
      currentPeriodEndSeconds: subscription?.current_period_end,
      customerEmail: session.customer_details?.email || await customerEmail(env, session.customer),
      cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
      cancelAtSeconds: subscription?.cancel_at || (subscription?.cancel_at_period_end ? subscription?.current_period_end : 0)
    });
  }

  if (event.type === 'customer.subscription.created'
    || event.type === 'customer.subscription.updated'
    || event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const installId = await installIdForSubscription(env, subscription);
    await saveSubscriptionEntitlement(env, {
      installId,
      customerId: subscription.customer || '',
      subscriptionId: subscription.id || '',
      status: subscription.status || 'unknown',
      currentPeriodEndSeconds: subscription.current_period_end,
      customerEmail: await customerEmail(env, subscription.customer),
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      cancelAtSeconds: subscription.cancel_at || (subscription.cancel_at_period_end ? subscription.current_period_end : 0)
    });
  }

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object;
    if (invoice.subscription) {
      const subscription = await stripeRequest(env, `/subscriptions/${encodeURIComponent(invoice.subscription)}`);
      const installId = await installIdForSubscription(env, subscription);
      await saveSubscriptionEntitlement(env, {
        installId,
        customerId: subscription.customer || invoice.customer || '',
        subscriptionId: subscription.id || '',
        status: subscription.status || 'past_due',
        currentPeriodEndSeconds: subscription.current_period_end,
        customerEmail: invoice.customer_email || await customerEmail(env, subscription.customer),
        cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
        cancelAtSeconds: subscription.cancel_at || (subscription.cancel_at_period_end ? subscription.current_period_end : 0)
      });
    }
  }

  return json({ received: true });
}

// -----------------------------------------------------------------------------
// Legal pages (/privacy and /terms). Real, product-accurate policies grounded in
// what EloGuard actually does. Governed by the laws of England & Wales; operator
// referred to as "EloGuard". Styled to match the EloGuard success/checkout pages.
// NOTE: this is a good-faith draft written from the extension's behaviour, not
// legal advice — have it reviewed before relying on it in a dispute.
// -----------------------------------------------------------------------------
const LEGAL_UPDATED = '9 July 2026';
const LEGAL_CONTACT = 'loxtyrrell03@gmail.com';
const LEGAL_HOME = 'https://eloguard.app';

function legalDoc({ title, slug, description, intro, tocHtml, bodyHtml }) {
  const privActive = slug === 'privacy' ? ' active' : '';
  const termsActive = slug === 'terms' ? ' active' : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} &middot; EloGuard</title>
<meta name="description" content="${description}">
<style>
  :root{
    --bg:#262522; --card:#2a2926;
    --green:#81b64c; --green-text:#9ed17a; --green-text-2:#a6da84;
    --blue-text:#7fb0f5; --gold:#f6c453; --gold-soft:#ffe08a;
    --t-primary:#ffffff; --t-soft:#e9edf4; --t-muted:#b9bec7; --t-dim:#8a93a3;
    --border:rgba(255,255,255,0.08);
    --border-gold:rgba(246,196,83,0.40);
    --shadow:0 8px 24px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.06);
    --font:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth}
  body{
    font-family:var(--font); color:var(--t-primary);
    background:
      radial-gradient(120% 70% at 50% -10%, rgba(59,130,246,0.08), rgba(59,130,246,0) 55%),
      radial-gradient(90% 60% at 50% 110%, rgba(129,182,76,0.06), rgba(129,182,76,0) 60%),
      var(--bg);
    min-height:100vh; padding:40px 18px 60px; position:relative; overflow-x:hidden;
    -webkit-font-smoothing:antialiased;
  }
  .board-texture{
    position:fixed; inset:0; z-index:0; pointer-events:none;
    background-image:
      linear-gradient(45deg, rgba(255,255,255,0.013) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.013) 75%),
      linear-gradient(45deg, rgba(255,255,255,0.013) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.013) 75%);
    background-size:104px 104px; background-position:0 0, 52px 52px;
    -webkit-mask-image:radial-gradient(120% 80% at 50% 12%, #000 0%, transparent 82%);
    mask-image:radial-gradient(120% 80% at 50% 12%, #000 0%, transparent 82%);
    opacity:.7;
  }
  .stage{position:relative; z-index:10; max-width:820px; margin:0 auto}
  .wordmark{
    display:flex; align-items:center; justify-content:center; gap:11px; margin-bottom:18px;
  }
  .wordmark .shield{font-size:22px; filter:drop-shadow(0 1px 3px rgba(0,0,0,.5))}
  .wordmark .name{font-size:18px; font-weight:800; color:var(--t-soft)}
  .wordmark .name b{color:var(--green-text-2)}
  .wordmark .sep{width:1px; height:16px; background:var(--border)}
  .wordmark .tag{font-size:11px; color:var(--t-dim); font-weight:600; text-transform:uppercase; letter-spacing:1.4px}
  .lnav{display:flex; justify-content:center; gap:8px; margin-bottom:24px}
  .lnav a{
    font-size:12.5px; font-weight:700; letter-spacing:.2px; text-decoration:none;
    color:var(--t-dim); padding:7px 15px; border-radius:999px;
    border:1px solid var(--border); background:rgba(255,255,255,0.02);
    transition:color .15s ease, border-color .15s ease;
  }
  .lnav a:not(.active):hover{color:var(--t-soft); border-color:var(--border-gold)}
  .lnav a.active{
    color:#22190a; border-color:transparent;
    background:linear-gradient(135deg,#ffe08a,#f6c453 60%,#e6b23f);
    box-shadow:0 4px 12px rgba(246,196,83,.28);
  }

  article.doc{
    border:1px solid var(--border); border-radius:16px;
    background:linear-gradient(157deg,#2b2a27 0%, #242320 100%);
    box-shadow:var(--shadow); padding:38px 36px 30px;
    animation:riseIn .5s cubic-bezier(.2,.7,.3,1) both;
  }
  .doc h1{font-size:27px; font-weight:800; letter-spacing:-.5px}
  .doc .updated{margin-top:7px; font-size:12.5px; color:var(--t-dim)}
  .doc .updated b{color:var(--green-text)}
  .doc .intro{margin-top:15px; font-size:14.5px; line-height:1.65; color:var(--t-muted)}

  .toc{margin-top:24px; padding:17px 19px; border:1px solid var(--border); border-radius:12px; background:rgba(255,255,255,0.02)}
  .toc .toc-h{font-size:11px; text-transform:uppercase; letter-spacing:1.3px; color:var(--t-dim); font-weight:700; margin-bottom:12px}
  .toc ol{list-style:none; counter-reset:s; display:grid; grid-template-columns:1fr 1fr; gap:8px 22px}
  .toc li{counter-increment:s; font-size:13px; line-height:1.4}
  .toc a{color:var(--blue-text); text-decoration:none}
  .toc a:hover{text-decoration:underline}
  .toc a::before{content:counter(s) ". "; color:var(--t-dim); font-variant-numeric:tabular-nums}

  .doc section{margin-top:28px; scroll-margin-top:16px}
  .doc h2{font-size:16.5px; font-weight:800; color:var(--t-soft); display:flex; gap:10px; align-items:baseline; letter-spacing:-.2px}
  .doc h2 .num{color:var(--gold); font-size:13px; font-weight:800; font-variant-numeric:tabular-nums}
  .doc p{margin-top:11px; font-size:14px; line-height:1.68; color:var(--t-muted)}
  .doc strong{color:var(--t-soft); font-weight:700}
  .doc a{color:var(--blue-text)}
  .doc ul{margin-top:11px; list-style:none; display:flex; flex-direction:column; gap:9px}
  .doc ul li{position:relative; padding-left:19px; font-size:14px; line-height:1.62; color:var(--t-muted)}
  .doc ul li::before{content:""; position:absolute; left:2px; top:9px; width:6px; height:6px; border-radius:50%; background:var(--green); box-shadow:0 0 0 3px rgba(129,182,76,.12)}
  .doc ul li b{color:var(--t-soft)}

  .callout{
    margin-top:14px; padding:15px 17px; border:1px solid var(--border-gold); border-radius:12px;
    background:radial-gradient(120% 140% at 0% 0%, rgba(246,196,83,0.10), rgba(246,196,83,0.03) 60%);
    font-size:13.5px; line-height:1.62; color:var(--t-soft);
  }
  .callout b{color:var(--gold-soft)}

  .doc-foot{
    margin-top:30px; padding-top:20px; border-top:1px solid var(--border);
    display:flex; flex-wrap:wrap; gap:8px 16px; justify-content:space-between; align-items:center;
    font-size:12.5px; color:var(--t-dim);
  }
  .doc-foot a{color:var(--blue-text); text-decoration:none}
  .doc-foot a:hover{text-decoration:underline}
  .doc-foot .contact b{color:var(--t-soft)}

  footer.page{margin-top:20px; text-align:center; font-size:11.5px; color:var(--t-dim); opacity:.85; line-height:1.6}

  @keyframes riseIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  @media (max-width:600px){
    .toc ol{grid-template-columns:1fr}
    article.doc{padding:28px 20px 24px}
    .doc h1{font-size:23px}
    .wordmark .tag{display:none}
  }
  @media (prefers-reduced-motion: reduce){ *,*::before,*::after{animation:none !important; scroll-behavior:auto} }
</style>
</head>
<body>
  <div class="board-texture" aria-hidden="true"></div>
  <main class="stage">
    <div class="wordmark">
      <span class="shield">🛡️</span>
      <span class="name">Elo<b>Guard</b></span>
      <span class="sep"></span>
      <span class="tag">Tilt Protection</span>
    </div>
    <nav class="lnav">
      <a class="l-priv${privActive}" href="/privacy">Privacy Policy</a>
      <a class="l-terms${termsActive}" href="/terms">Terms of Service</a>
    </nav>

    <article class="doc">
      <h1>${title}</h1>
      <div class="updated">Last updated: <b>${LEGAL_UPDATED}</b></div>
      <p class="intro">${intro}</p>

      <div class="toc">
        <div class="toc-h">Contents</div>
        <ol>${tocHtml}</ol>
      </div>

      ${bodyHtml}

      <div class="doc-foot">
        <span class="contact">Questions? <b>${LEGAL_CONTACT}</b></span>
        <span><a href="${slug === 'privacy' ? '/terms' : '/privacy'}">${slug === 'privacy' ? 'Terms of Service' : 'Privacy Policy'}</a> &middot; <a href="${LEGAL_HOME}">eloguard.app</a></span>
      </div>
    </article>

    <footer class="page">
      &copy; 2026 EloGuard. EloGuard is an independent tool and is not affiliated with, endorsed by, or sponsored by Chess.com or Stripe.
    </footer>
  </main>
</body>
</html>`;
}

function tocItem(id, label) {
  return `<li><a href="#${id}">${label}</a></li>`;
}

function privacyDoc() {
  const toc = [
    tocItem('summary', 'The short version'),
    tocItem('scope', 'Who we are &amp; scope'),
    tocItem('on-device', 'Data stored on your device'),
    tocItem('chesscom', 'Public Chess.com data we fetch'),
    tocItem('local-analysis', 'Game analysis stays local'),
    tocItem('billing', 'Data used for EloGuard Pro'),
    tocItem('opponents', "Opponents' public data"),
    tocItem('never', 'What EloGuard never does'),
    tocItem('permissions', 'Browser permissions we use'),
    tocItem('retention', 'Retention &amp; your controls'),
    tocItem('rights', 'Your privacy rights'),
    tocItem('children', "Children's privacy"),
    tocItem('changes', 'Changes &amp; contact')
  ].join('');

  const body = `
      <section id="summary">
        <h2><span class="num">1</span> The short version</h2>
        <ul>
          <li>EloGuard is built to keep your data <b>on your own device</b>. Your Chess.com username, settings, usage counts and game-review history live in your browser.</li>
          <li>Cheat-risk checks and game reviews use <b>public Chess.com data</b> fetched directly by your browser, and <b>Stockfish analysis runs locally</b> &mdash; your games are never uploaded to us.</li>
          <li>The only thing sent to EloGuard is a <b>random install ID</b> used to check whether your copy is Pro.</li>
          <li>Payments are handled by <b>Stripe</b>. EloGuard never sees or stores your card details.</li>
          <li>We do <b>not</b> sell your data, show ads, or use third-party tracking or analytics.</li>
        </ul>
      </section>

      <section id="scope">
        <h2><span class="num">2</span> Who we are &amp; what this covers</h2>
        <p>EloGuard (&ldquo;EloGuard&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is a browser extension that helps you play calmer sessions on Chess.com &mdash; with cheat-risk checks, local game reviews, and rating stop-loss / target locks. For the purposes of UK data-protection law, EloGuard is the data controller for the limited personal data described in this policy. This policy covers the EloGuard extension and the EloGuard billing service that powers EloGuard Pro. It does not cover Chess.com or Stripe, who handle your data under their own policies.</p>
      </section>

      <section id="on-device">
        <h2><span class="num">3</span> Data stored on your device</h2>
        <p>Most of what EloGuard remembers is stored locally in your browser&rsquo;s extension storage (and, if you have Chrome sync switched on, it may sync across your own signed-in browsers). This includes:</p>
        <ul>
          <li>The <b>Chess.com username</b> you enter, so EloGuard can read your public rating and stats.</li>
          <li>Your <b>settings and preferences</b> &mdash; stop-loss / target values, loss-streak and lockout rules, cooldown, Zen / focus / anonymize toggles, and Smart Bracket range.</li>
          <li><b>Feature-usage counters</b> (for example, how many free cheat-risk checks or reviews you have used today) so daily limits can be applied.</li>
          <li>Your <b>game-review history</b> and strength-profile data generated from your own games.</li>
          <li>A <b>random install ID</b> and a cached copy of your Pro status.</li>
        </ul>
        <p>This information stays on your device. You can view or clear it at any time (see &ldquo;Retention &amp; your controls&rdquo;), and removing the extension deletes it.</p>
      </section>

      <section id="chesscom">
        <h2><span class="num">4</span> Public Chess.com data we fetch</h2>
        <p>To show your rating, apply the right Bullet / Blitz / Rapid limits, estimate cheat-risk, and build reviews, your browser requests <b>public</b> data from Chess.com&rsquo;s public API &mdash; using your username and, for risk checks, your opponent&rsquo;s username. This can include public account details (such as account age), rated-game volume, recent results and win rate, rating movement, accuracy signals, streaks, performance spikes, and public game archives.</p>
        <p>These requests go directly from your browser to Chess.com. EloGuard does not route this data through, or store it on, our servers. Your use of Chess.com remains subject to Chess.com&rsquo;s own terms and privacy policy.</p>
      </section>

      <section id="local-analysis">
        <h2><span class="num">5</span> Game analysis stays on your device</h2>
        <p>EloGuard&rsquo;s Game Review runs the Stockfish engine <b>locally in your browser</b>. Your games and moves are analysed on your own machine and are <b>not uploaded</b> to EloGuard for review. The resulting review and strength-profile history is stored locally on your device.</p>
      </section>

      <section id="billing">
        <h2><span class="num">6</span> Data used for EloGuard Pro</h2>
        <p>If you upgrade to Pro, a small amount of data is needed to sell and unlock it:</p>
        <ul>
          <li><b>Entitlement checks.</b> To know whether your copy is Pro, your browser sends your <b>random install ID</b> to the EloGuard billing service (hosted on Cloudflare). This ID is generated at random and is not derived from your identity or your Chess.com account.</li>
          <li><b>Payments via Stripe.</b> Checkout and payments are handled by <a href="https://stripe.com" rel="noopener">Stripe</a>. Your card details are entered on Stripe&rsquo;s systems and go directly to Stripe &mdash; <b>EloGuard never receives or stores your card number</b>.</li>
          <li><b>What the billing service stores.</b> When a purchase completes, we store a billing record linking your install ID to your plan and status, the Stripe customer, subscription and payment identifiers, the billing email Stripe provides, and renewal / access timestamps. We use this only to verify and manage your Pro access.</li>
        </ul>
        <p>Stripe processes your payment data as an independent controller under <a href="https://stripe.com/privacy" rel="noopener">Stripe&rsquo;s Privacy Policy</a>. Our billing service and its database are hosted by Cloudflare.</p>
      </section>

      <section id="opponents">
        <h2><span class="num">7</span> Opponents&rsquo; public data</h2>
        <p>The cheat-risk feature looks at your opponent&rsquo;s <b>public</b> Chess.com profile and game data to produce a risk estimate. This is fetched and processed <b>locally in your browser</b>; EloGuard does not store opponents&rsquo; data on our servers or share it with anyone. A risk estimate is a heuristic guess based on public signals &mdash; it is not proof of cheating and should not be treated as an accusation.</p>
      </section>

      <section id="never">
        <h2><span class="num">8</span> What EloGuard never does</h2>
        <ul>
          <li>We do <b>not</b> sell, rent, or trade your personal data.</li>
          <li>We do <b>not</b> serve advertising or build advertising profiles.</li>
          <li>We do <b>not</b> embed third-party analytics or tracking SDKs in the extension.</li>
          <li>We do <b>not</b> upload your games, moves, or review history.</li>
        </ul>
      </section>

      <section id="permissions">
        <h2><span class="num">9</span> Browser permissions we use</h2>
        <p>EloGuard requests only the permissions it needs to work:</p>
        <ul>
          <li><b>Storage</b> &mdash; to save your settings, usage counts, and review history on your device.</li>
          <li><b>Active tab &amp; scripting</b> &mdash; to add EloGuard&rsquo;s controls, badges, and review tools to Chess.com pages you are viewing.</li>
          <li><b>Site access</b> to <b>chess.com</b> (to run on the site), and to the EloGuard billing and app domains (to check and activate Pro).</li>
        </ul>
      </section>

      <section id="retention">
        <h2><span class="num">10</span> Retention &amp; your controls</h2>
        <p>On-device data is kept until you delete it. You can clear your username, history, and settings from the extension, clear the extension&rsquo;s storage in your browser, or uninstall EloGuard to remove it entirely. Billing records are kept while your Pro entitlement is active and for as long as we reasonably need them to provide the service and to meet legal, tax, and accounting obligations, after which they are deleted or anonymised.</p>
      </section>

      <section id="rights">
        <h2><span class="num">11</span> Your privacy rights</h2>
        <p>Subject to UK data-protection law, you have the right to access, correct, delete, restrict, or object to our processing of your personal data, and to data portability. Because most data lives on your own device, you can exercise many of these rights directly by editing or clearing it. For billing records held by us, email <b>${LEGAL_CONTACT}</b> and we will respond as required by law. You also have the right to complain to the UK Information Commissioner&rsquo;s Office (ICO). Some of our processors, including Stripe and Cloudflare, may process data outside the UK; where they do, they rely on appropriate safeguards for international transfers.</p>
      </section>

      <section id="children">
        <h2><span class="num">12</span> Children&rsquo;s privacy</h2>
        <p>EloGuard is not directed to children under 13, and we do not knowingly collect personal data from them. If you are under 13, please do not use EloGuard. Use of Chess.com is also subject to Chess.com&rsquo;s own age requirements.</p>
      </section>

      <section id="changes">
        <h2><span class="num">13</span> Changes &amp; how to contact us</h2>
        <p>We may update this policy from time to time; when we do, we will change the &ldquo;last updated&rdquo; date above, and we will flag material changes where practical. For any privacy question or request, contact <b>${LEGAL_CONTACT}</b>.</p>
      </section>`;

  return legalDoc({
    title: 'Privacy Policy',
    slug: 'privacy',
    description: 'How EloGuard handles your data. Most of it stays on your device; payments are handled by Stripe.',
    intro: 'EloGuard is designed to be private by default: your Chess.com data and game analysis stay on your own device, and only a random install ID is used to unlock Pro. This policy explains, in plain terms, what data EloGuard handles and the choices you have.',
    tocHtml: toc,
    bodyHtml: body
  });
}

function termsDoc() {
  const toc = [
    tocItem('agreement', 'Agreement to these Terms'),
    tocItem('what', 'What EloGuard is'),
    tocItem('eligibility', 'Eligibility'),
    tocItem('independent', 'Not affiliated with Chess.com'),
    tocItem('estimates', 'Cheat-risk estimates'),
    tocItem('licence', 'Your licence to use EloGuard'),
    tocItem('acceptable', 'Acceptable use'),
    tocItem('pro', 'Pro plans, pricing &amp; billing'),
    tocItem('lifetime', 'What &ldquo;Lifetime&rdquo; means'),
    tocItem('refunds', 'Cancellation &amp; refunds'),
    tocItem('availability', 'Availability &amp; changes'),
    tocItem('disclaimer', 'Disclaimers'),
    tocItem('liability', 'Limitation of liability'),
    tocItem('termination', 'Termination'),
    tocItem('law', 'Governing law &amp; your rights'),
    tocItem('updates', 'Changes &amp; contact')
  ].join('');

  const body = `
      <section id="agreement">
        <h2><span class="num">1</span> Agreement to these Terms</h2>
        <p>These Terms of Service (&ldquo;Terms&rdquo;) are a legal agreement between you and EloGuard (&ldquo;EloGuard&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) governing your use of the EloGuard browser extension and related services, including EloGuard Pro (together, the &ldquo;Service&rdquo;). By installing or using EloGuard, you agree to these Terms and to our <a href="/privacy">Privacy Policy</a>. If you do not agree, please do not use EloGuard.</p>
      </section>

      <section id="what">
        <h2><span class="num">2</span> What EloGuard is</h2>
        <p>EloGuard is a self-control and information tool for Chess.com. It offers rating stop-loss and target locks, loss-streak and lockout rules, cooldowns, Zen / focus / anonymizing tools, heuristic cheat-risk estimates, and local (on-device) game review. A free tier includes the core anti-tilt tools plus a limited number of cheat-risk checks and game reviews per day; EloGuard Pro removes those daily limits and unlocks additional tools such as Smart Bracket auto-set and the strength profile.</p>
      </section>

      <section id="eligibility">
        <h2><span class="num">3</span> Eligibility</h2>
        <p>You must be at least 13 years old and able to form a binding contract to use EloGuard. If you are under the age of majority where you live, you may use EloGuard only with the involvement of a parent or guardian. You are responsible for complying with Chess.com&rsquo;s own terms of service when you use EloGuard alongside it.</p>
      </section>

      <section id="independent">
        <h2><span class="num">4</span> Not affiliated with Chess.com or Stripe</h2>
        <div class="callout"><b>EloGuard is an independent product.</b> It is not affiliated with, endorsed by, sponsored by, or connected to Chess.com or Stripe. &ldquo;Chess.com&rdquo; and &ldquo;Stripe&rdquo; are trademarks of their respective owners, used here only to describe how EloGuard works. Your use of Chess.com and Stripe is governed by their own terms and policies, and you are responsible for following them.</div>
      </section>

      <section id="estimates">
        <h2><span class="num">5</span> Cheat-risk estimates are informational</h2>
        <div class="callout">EloGuard&rsquo;s cheat-risk score is an <b>automated estimate</b> based on public signals. It can be wrong, in either direction, and it is <b>not proof that anyone is cheating</b> and <b>not an accusation</b>. It is provided for your personal information only. You agree not to use it to harass, defame, publicly accuse, or otherwise harm other players, and you are solely responsible for any action you take based on it.</div>
      </section>

      <section id="licence">
        <h2><span class="num">6</span> Your licence to use EloGuard</h2>
        <p>Subject to these Terms, EloGuard grants you a personal, limited, non-exclusive, non-transferable, revocable licence to install and use the Service for your own personal, non-commercial use. We retain all rights, title, and interest in the Service, including its software, design, and content, that are not expressly granted to you.</p>
      </section>

      <section id="acceptable">
        <h2><span class="num">7</span> Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>resell, sublicense, rent, or redistribute the Service, or share paid access with others;</li>
          <li>copy, modify, reverse engineer, or attempt to extract source code, except to the limited extent this restriction is prohibited by applicable law;</li>
          <li>circumvent, disable, or tamper with EloGuard Pro licensing or usage limits;</li>
          <li>use EloGuard to break the law or to violate Chess.com&rsquo;s terms or the rights of others; or</li>
          <li>interfere with, overload, or disrupt the Service or the EloGuard billing infrastructure.</li>
        </ul>
      </section>

      <section id="pro">
        <h2><span class="num">8</span> EloGuard Pro: plans, pricing &amp; billing</h2>
        <p>EloGuard Pro is offered as a <b>Monthly</b> subscription of $2.99 per month, or a one-time <b>Lifetime</b> purchase of $15. Prices are in US dollars and exclude any taxes; taxes, currency conversion, or card fees may be added at checkout or by your payment provider. All payments are processed by Stripe.</p>
        <ul>
          <li>The Monthly plan <b>renews automatically</b> at the then-current price until you cancel.</li>
          <li>You can <b>cancel at any time</b> from the Stripe billing portal. When you cancel, you will not be charged again and your Pro access continues until the end of the period you have already paid for.</li>
          <li>If a renewal payment fails, we may allow a short grace period (up to 14 days) during which Pro stays active while payment is retried, after which Pro access ends.</li>
          <li>We may change Pro pricing or the make-up of the free and Pro tiers in the future; changes will not affect a subscription period you have already paid for.</li>
        </ul>
      </section>

      <section id="lifetime">
        <h2><span class="num">9</span> What &ldquo;Lifetime&rdquo; means</h2>
        <p>A Lifetime purchase is a one-time payment that grants Pro access for the lifetime of the EloGuard product as it is generally made available, tied to your installation. It does not guarantee that EloGuard, any specific feature, or the third-party services it relies on (such as Chess.com) will remain available forever, and it is not transferable. If EloGuard is discontinued, we will make reasonable efforts to give notice.</p>
      </section>

      <section id="refunds">
        <h2><span class="num">10</span> Cancellation &amp; refunds</h2>
        <p>If you are a consumer in the UK or EU, you may have a statutory right to cancel a purchase of digital content within 14 days. Because Pro is delivered digitally and unlocks immediately, by starting to use Pro you ask us to begin supplying it right away and acknowledge that you may lose this 14-day cancellation right for content already supplied.</p>
        <p>Beyond your statutory rights: you can cancel the Monthly plan at any time to stop future charges, as described above. For a Lifetime purchase, if you are not satisfied, contact us at <b>${LEGAL_CONTACT}</b> within 14 days of purchase and we will consider a refund in good faith. Nothing in these Terms removes or limits any refund or cancellation rights you have that cannot be waived under applicable law.</p>
      </section>

      <section id="availability">
        <h2><span class="num">11</span> Availability &amp; changes to the Service</h2>
        <p>We provide the Service on a reasonable-efforts basis and may update, add, change, suspend, or discontinue features from time to time. Because EloGuard depends on Chess.com&rsquo;s website and public data, changes on Chess.com&rsquo;s side may affect how EloGuard works. We do not guarantee uninterrupted or error-free operation.</p>
      </section>

      <section id="disclaimer">
        <h2><span class="num">12</span> Disclaimers</h2>
        <p>To the fullest extent permitted by law, the Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, whether express or implied. In particular, we do not warrant that cheat-risk estimates or game analysis are accurate or complete, or that using EloGuard will improve your rating, prevent losses, or stop tilt. EloGuard&rsquo;s locks are optional aids that you can turn off yourself, and you remain responsible for your own play and for your Chess.com account. This section does not exclude any warranty or right that cannot be excluded under applicable law.</p>
      </section>

      <section id="liability">
        <h2><span class="num">13</span> Limitation of liability</h2>
        <p>Nothing in these Terms limits or excludes our liability for death or personal injury caused by negligence, for fraud, or for any other liability that cannot be limited or excluded by law &mdash; and if you are a consumer, your mandatory statutory rights are not affected. Subject to that, to the fullest extent permitted by law we will not be liable for any indirect, incidental, special, or consequential loss, or for loss of rating, ranking, opportunity, or data, or for any action taken against your account by Chess.com. To the extent we are liable, our total liability arising out of or relating to the Service is limited to the greater of the amount you paid us for Pro in the 12 months before the claim, or 15 US dollars.</p>
      </section>

      <section id="termination">
        <h2><span class="num">14</span> Termination</h2>
        <p>You can stop using EloGuard at any time by uninstalling the extension. We may suspend or terminate your access to the Service (including Pro) if you materially breach these Terms or use the Service unlawfully. On termination, the licence granted to you ends; sections that by their nature should survive (such as disclaimers, limitation of liability, and governing law) will continue to apply.</p>
      </section>

      <section id="law">
        <h2><span class="num">15</span> Governing law &amp; your rights</h2>
        <p>These Terms and any dispute arising out of them or the Service are governed by the laws of <b>England &amp; Wales</b>, and the courts of England &amp; Wales will have jurisdiction. If you are a consumer resident elsewhere in the UK or in the EU, you benefit from any mandatory consumer-protection provisions of the law where you live, and you may be able to bring proceedings in your local courts.</p>
      </section>

      <section id="updates">
        <h2><span class="num">16</span> Changes to these Terms &amp; contact</h2>
        <p>We may update these Terms from time to time. When we do, we will change the &ldquo;last updated&rdquo; date above, and material changes will be highlighted where practical. Your continued use of EloGuard after an update means you accept the revised Terms. Questions about these Terms? Contact <b>${LEGAL_CONTACT}</b>.</p>
      </section>`;

  return legalDoc({
    title: 'Terms of Service',
    slug: 'terms',
    description: 'The terms for using EloGuard and EloGuard Pro. Governed by the laws of England & Wales.',
    intro: 'These Terms explain the rules for using EloGuard and EloGuard Pro &mdash; including how billing works, what our estimates do and do not mean, and the usual legal disclaimers. Please read them alongside our Privacy Policy.',
    tocHtml: toc,
    bodyHtml: body
  });
}

function legalPageHtml(kind) {
  return kind === 'privacy' ? privacyDoc() : termsDoc();
}

function legalPage(kind) {
  return new Response(legalPageHtml(kind), {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' }
  });
}

// Any thrown error (almost always a Stripe upstream failure) is caught in
// fetchHandler and routed here, so the Worker never surfaces a raw Cloudflare
// 1101 exception page to someone who clicked "Manage subscription" or "Cancel".
// API and webhook callers get JSON; browser-facing pages get a friendly HTML
// page. The real error is logged for `wrangler tail`, never shown to the user.
function errorResponse(url, err) {
  console.error('EloGuard billing worker error', url.pathname, err && err.stack ? err.stack : err);
  if (url.pathname.startsWith('/api/') || url.pathname === '/webhook') {
    return json({ error: 'Billing is temporarily unavailable. Please try again in a moment.' }, 500);
  }
  return html(`
    <h1>Something went wrong</h1>
    <p>We could not complete that request right now. Please close this tab and try again from the EloGuard popup in a few moments.</p>
    <p>If it keeps happening, email <b>${LEGAL_CONTACT}</b>.</p>
  `, 500);
}

async function routeRequest(request, env, url) {
  if (url.pathname === '/health') return json({ ok: true });
  if (url.pathname === '/api/entitlement') return handleEntitlement(env, url);
  if (url.pathname === '/api/cancel-renewal') return handleCancelRenewal(request, env, url);
  if (url.pathname === '/checkout') return handleCheckout(request, env, url);
  if (url.pathname === '/portal') return handlePortal(env, url);
  if (url.pathname === '/success') return handleSuccess(env, url);
  if (url.pathname === '/cancel') return html('<h1>Checkout cancelled</h1><p>No charge was made. You can return to EloGuard whenever you are ready.</p>');
  if (url.pathname === '/privacy') return legalPage('privacy');
  if (url.pathname === '/terms') return legalPage('terms');
  if (url.pathname === '/webhook' && request.method === 'POST') return handleWebhook(request, env);

  return html('<h1>Not found</h1>', 404);
}

async function fetchHandler(request, env) {
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'content-type'
      }
    });
  }

  try {
    return await routeRequest(request, env, url);
  } catch (err) {
    return errorResponse(url, err);
  }
}

export {
  PUBLIC_PRO_STATUSES,
  deriveEntitlement,
  fetchHandler,
  hmacSha256Hex,
  isValidInstallId,
  publicEntitlement,
  verifyStripeSignature
};

export default {
  fetch: fetchHandler
};
