# EloGuard Billing Server

Tiny Stripe entitlement service for EloGuard v2.

## What It Does

- `/checkout?installId=...` lets the user choose a card-required seven-day
  Monthly trial or lifetime Pro.
- `/webhook` receives Stripe subscription/payment events and stores Pro entitlement.
- `/api/entitlement?installId=...` tells the extension whether that install is Pro.
- `/portal?installId=...` opens Stripe Billing Portal for paid users.

This MVP keys entitlement to the browser extension install id. That is fast to ship and avoids login, but users who reinstall Chrome or switch devices can lose the link unless you add email restore or sign-in later.

## Local Setup

1. Create a Stripe account and product named `EloGuard Pro`.
2. Add two prices:
   - `$2.99/month` recurring.
   - `$15` one-time lifetime purchase.
3. Copy `.env.example` to `.env` and fill in:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_MONTHLY_PRICE_ID`
   - `STRIPE_LIFETIME_PRICE_ID`
   - `STRIPE_WEBHOOK_SECRET`
   - Keep `STRIPE_TRIAL_DAYS=7` so the Monthly checkout collects a card, charges
     $0 today, and starts billing after the free week unless cancelled.
4. Install dependencies and run:

```bash
npm install
npm run dev
```

5. In another terminal, forward Stripe webhooks:

```bash
stripe listen --forward-to localhost:4242/webhook
```

## What It Also Handles

- `past_due` subscriptions keep Pro for `STRIPE_GRACE_DAYS` (default 14) so a
  failed renewal doesn't instantly lock out a paying user while Stripe retries.
- Lifetime purchases are stored with `status: "lifetime"` and no client-side
  expiry.
- Writes are serialized and atomic, so simultaneous Stripe webhooks can't clobber
  each other (lost update) or truncate the store on a crash.
- `/checkout`, `/portal`, and `/api/entitlement` are rate limited per IP.
- `/api/entitlement` never returns the customer email (installId is an
  unauthenticated key — no PII on it).
- `/privacy` and `/terms` serve placeholder legal pages — replace the copy.

## Tests

`npm test` (Node's built-in test runner, no extra deps) covers the entitlement
store's concurrency/atomicity and the `past_due`/grace derivation logic.

## Production Notes

- For the free always-on production path, use `../billing-worker` on
  Cloudflare Workers + D1. Keep this Express server for local Stripe sandbox
  testing.
- Set `APP_BASE_URL` to the deployed origin.
- The JSON store is now safe against concurrent-webhook lost updates on a single
  instance, but it lives on local disk. Put `ENTITLEMENT_STORE_PATH` on a
  **persistent volume** (ephemeral hosts wipe it on deploy and drop all Pro
  users), and move to Postgres/SQLite-on-a-disk before running multiple instances.
- In the extension, update `lib/entitlements.js` defaults or set `eloGuardBillingConfig` in `chrome.storage.sync` to point at the production URLs.
- Configure the Stripe Customer Portal before using `/portal` for monthly
  subscribers.
- In Stripe Billing email settings, enable the free-trial ending reminder and
  set the cancellation URL to the deployed `/portal` flow.
