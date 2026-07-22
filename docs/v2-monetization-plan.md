# EloGuard v2 Monetization Plan

Last updated: 2026-07-08

## Read This First

The extension has real latent demand: 464 installs over the last year from almost no promotion. Ship v2 quickly, but do not surprise-lock the features people already installed for.

The repo history gives us the clean product boundary:

- Free tier should preserve the December 2025 guard foundation: stop-loss floor, target ceiling, cooldown, loss-streak lock, random-string unlock, Zen mode, and basic profile/privacy controls.
- Pro tier should monetize the May 2026 and v2 value: cheat-risk profile, matchup recommendation, local Game Review, Strength Profile, and batch review/history.
- Analyze on Lichess stays free. It is a great goodwill feature and a low-cost bridge into the paid review flow.

## Tiering

### Free

- Core tilt guard: activate guard, floor, ceiling.
- Stop after X losses.
- Analysis cooldown.
- Random string unlock.
- Lockout duration.
- Zen mode.
- Anonymize opponent.
- Hide my profile.
- Enhanced focus mode.
- Analyze on Lichess.
- 3 risk profile and matchup checks per day.
- 3 local Game Reviews per day.

### Pro

- Unlimited risk profile checks.
- Unlimited matchup recommendations.
- Unlimited Game Reviews.
- Smart Bracket auto-set.
- Strength Profile / My Stats.
- Batch analysis of recent games.
- Review history.
- Future: opening leak detector, tilt session report, opponent notes, cloud sync.

## Recommended Pricing

Launch with one simple plan:

- EloGuard Pro: `$2.99/month` after a seven-day free trial. Checkout requires a
  card up front and charges `$0` until the trial ends.
- Optional launch coupon: `FOUNDERS50` for 50% off first 3 months.
- Add annual later only after conversion data exists. Suggested annual: `$39/year`.

Why this price: the buyer is not buying engine analysis alone; they are buying tilt protection, safer matchmaking decisions, and a post-game ritual. Keep it impulse-affordable.

## Current Implementation

The repo now includes:

- Shared entitlement helper: `lib/entitlements.js`.
- Extension popup Pro status, Upgrade, and Refresh buttons.
- Free daily limits:
  - `riskProfile`: 3/day.
  - `gameReview`: 3/day.
- Paywalled features:
  - Cheat-risk badge and matchup advice.
  - Game Review after the daily free review is used.
  - Smart Bracket auto-set.
  - Strength Profile as Pro-only.
- Free features left alone:
  - Analyze on Lichess.
  - Existing tilt guard settings and focus/privacy features.
- Billing server: `billing-server/` — Stripe Checkout + webhooks, an
  atomic/serialized entitlement store, `past_due` dunning grace, per-IP rate
  limiting, and legal page stubs. Free daily checks are spent only on a
  *successful* result, so a failed risk lookup or cancelled game review no
  longer wastes the check. Monthly Checkout grants seven days of `trialing` Pro,
  requires a saved card, then starts the subscription automatically unless the
  user cancels. `npm test` covers the store and dunning logic.

## Stripe Setup

1. Create a Stripe account.
2. Create product: `EloGuard Pro`.
3. Create recurring price: `$2.99/month`.
4. Copy the price id into `billing-server/.env` as `STRIPE_PRICE_ID`.
5. Keep `STRIPE_TRIAL_DAYS=7`, enable Stripe Customer Portal, turn on Stripe's
   trial-ending reminder email, and include the hosted subscription-management
   link.
6. Start the billing server locally:

```bash
cd billing-server
npm install
npm run dev
```

7. In another terminal:

```bash
stripe listen --forward-to localhost:4242/webhook
```

8. Copy the webhook signing secret into `.env` as `STRIPE_WEBHOOK_SECRET`.
9. Test checkout from:

```text
http://localhost:4242/checkout?installId=test-install-123
```

## Deployment

Fastest path:

1. Buy `eloguard.app` or use a temporary Render/Railway/Fly domain.
2. Deploy `billing-server`.
3. Set environment variables:
   - `APP_BASE_URL=https://your-domain`
   - `STRIPE_SECRET_KEY=...`
   - `STRIPE_PRICE_ID=...`
   - `STRIPE_WEBHOOK_SECRET=...`
   - `STRIPE_TRIAL_DAYS=7`
4. In Stripe Dashboard, set webhook endpoint:

```text
https://your-domain/webhook
```

5. Update `lib/entitlements.js` default URLs if not using `https://eloguard.app`.
6. If using a different domain, update `manifest.json` host permissions.

## Chrome Web Store v2 Checklist

1. Package a clean build with `scripts/package-extension.ps1`. Do not include tests, backtests, raw audio experiments, `.mcp.json`, or calibration data unless required.
2. Update version to `2.0.0`.
3. Update listing copy:
   - Lead with tilt protection.
   - Add "new in v2": local game review, risk profile, matchup advice.
   - Clearly mark Pro features.
4. Add a privacy policy URL before submitting paid functionality.
5. In the Privacy tab, disclose:
   - Chess.com username is stored for the extension to fetch public Chess.com stats.
   - Public Chess.com game/account data is fetched for risk and matchup estimates.
   - Stripe handles payment data; EloGuard does not store card details.
   - Extension install id is sent to EloGuard billing server for Pro entitlement.
6. In test instructions, include:
   - How to toggle dev Pro for reviewers, or provide a test Stripe card flow.
   - A Chess.com test account/page where the risk badge appears.
   - How to run one Game Review after a game.
7. Submit as an update first. Do not do a giant website launch until the extension is approved.

## Website MVP

You do not need a full website to start charging. You need:

- `/checkout` handled by billing server.
- `/success` page saying "Return to extension and press Refresh."
- `/privacy` page.
- `/terms` page.
- A minimal landing page can come after v2 approval.

Landing page headline:

> EloGuard: stop rage-queuing and review the game before the next one.

Sections:

- Tilt guard: stop-loss, cooldown, lockout.
- Pro: risk profile, matchup advice, local Game Review.
- Privacy: public chess data only; engine runs locally; Stripe handles cards.
- CTA: Install free, upgrade when you need unlimited analysis.

## Launch Sequence

### Day 0: Stabilize

- Finish paywall QA.
- Test a normal free user: one risk check, one game review, Lichess export still works.
- Test a Pro user with `EloGuardEntitlements.setDevPro(true)` from the extension console.
- Create the Stripe product and deploy billing server.

### Day 1: Submit v2

- Package v2.
- Update Chrome Web Store listing and screenshots.
- Submit.
- Prepare Reddit post and Discord/forum copy while waiting.

### Approval Day

- Post a concise update:
  - "I made EloGuard free months ago. It quietly reached 464 installs. v2 adds local game review, risk profile, and matchup advice."
  - Be transparent: old features remain free; Pro funds continued work.
- Reply to every comment for 48 hours.
- Ask existing users for reviews, not just installs.

### Week 1 Metrics

Track:

- Store listing impressions -> installs.
- Popup Upgrade clicks.
- Checkout starts.
- Paid conversions.
- Refund/cancel reasons.
- Free daily limit hits.

If people hit limits but do not buy, test:

- More generous free limit: 5 risk checks/day but 3 game reviews/day.
- Lower founder price: `$2.99/month` for first 500 users.
- Stronger in-product copy explaining local/private analysis.

## Risk Notes

- Client-side paywalls are not piracy-proof. For this product stage, that is okay. Revenue will come from normal users, not people editing extension files.
- The billing server's JSON store now serializes writes and writes atomically, so it is safe against concurrent-webhook lost updates on a single instance. It still lives on local disk: deploy it on a **persistent volume** (ephemeral hosts wipe it on every deploy and drop all Pro users), and move to Postgres before running multiple instances.
- Install-id entitlement is fast but not perfect. Add email restore or sign-in once revenue proves the funnel.

## Source Notes

- Chrome Web Store payments are deprecated; use an external payment processor and your own license tracking.
- Stripe Checkout can host subscription checkout and webhook events should provision/revoke access.
- Chrome Web Store privacy and listing requirements must match what the extension actually collects and sends.
