# EloGuard Billing Worker Deployment

The local Express server at `http://localhost:4242` is only for sandbox testing.
Production should run on Cloudflare Workers + D1 so it does not depend on your
laptop being on.

Cloudflare free-tier fit:

- Workers Free includes 100,000 requests per day.
- D1 Free includes enough database capacity for this MVP.
- There is no sleeping server process to keep warm.

If EloGuard grows past the free limits, upgrade Workers later. The code does
not need a rewrite for that.

## One-Time Cloudflare Setup

From `billing-worker`:

```bash
npm install
npx wrangler login
npx wrangler d1 create eloguard-billing
```

Copy the returned D1 `database_id` into `wrangler.toml`.

Apply the database schema:

```bash
npm run d1:migrate:remote
```

Set test or production secrets:

```bash
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put STRIPE_MONTHLY_PRICE_ID
npx wrangler secret put STRIPE_LIFETIME_PRICE_ID
```

Use the existing Stripe test values while testing the hosted Worker. Use live
Stripe values for production:

- `STRIPE_SECRET_KEY`: `sk_live_...`
- `STRIPE_WEBHOOK_SECRET`: live webhook signing secret
- `STRIPE_MONTHLY_PRICE_ID`: live $2.99/month price
- `STRIPE_LIFETIME_PRICE_ID`: live $15 one-time price

## Deploy

```bash
npm run deploy
```

The current free hosted URL is:

```text
https://eloguard-billing.eloguard.workers.dev
```

The extension defaults currently point at that `workers.dev` URL. Later, once
`eloguard.app` is active in Cloudflare DNS, change `APP_BASE_URL`,
`lib/entitlements.js`, and `manifest.json` back to `https://eloguard.app`.

## Current Live Stripe IDs

Configured on 2026-07-09:

- Product: `prod_Uqks3ERH10DNtH`
- Monthly Pro price: `price_1Tr3N6I3Axv6AyRSlZeEpxwH` ($2.99/month)
- Lifetime Pro price: `price_1Tr3N6I3Axv6AyRSfx3iE4vr` ($15 one-time)
- Webhook endpoint: `we_1Tr3VbI3Axv6AyRShbZ1RQ3V`
- Customer Portal configuration: `bpc_1Tr3OdI3Axv6AyRSQnOLPCAI`

The live secret key and webhook signing secret are stored only in Cloudflare
Worker secrets.

## Stripe Webhook

Create a live webhook endpoint:

```text
https://eloguard-billing.eloguard.workers.dev/webhook
```

Subscribe it to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.

## Production Smoke Test

```bash
curl https://eloguard-billing.eloguard.workers.dev/health
curl "https://eloguard-billing.eloguard.workers.dev/api/entitlement?installId=live-smoke-test-123"
```

Expected before payment:

```json
{"plan":"free","status":"free","source":"billing-worker","currentPeriodEnd":"","accessUntil":""}
```

Then open:

```text
https://eloguard-billing.eloguard.workers.dev/checkout?installId=live-smoke-test-123
```

Pay once in live mode, then check:

```bash
curl "https://eloguard-billing.eloguard.workers.dev/api/entitlement?installId=live-smoke-test-123"
```

Expected after payment:

```json
{"plan":"pro","status":"active",...}
```

Cancel/refund the smoke-test customer in Stripe if needed.
