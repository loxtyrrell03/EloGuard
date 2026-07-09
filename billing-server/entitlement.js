// Pure, Node-testable helpers that turn a Stripe subscription status into the
// entitlement fields we persist. Kept dependency-free so the money-critical
// logic can be unit-tested directly (see test/entitlement.test.js).

// Statuses that grant Pro. `past_due` is intentionally included: when a renewal
// payment fails, Stripe flips the subscription to `past_due` and RETRIES for
// ~2 weeks before giving up. Revoking Pro on the first failed charge would lock
// out a paying user over a temporary card decline, so we keep access during a
// grace window and only drop to free on `unpaid`/`canceled`.
export const PRO_STATUSES = new Set(['active', 'trialing', 'past_due']);
export const DEFAULT_GRACE_DAYS = 14;

// Given a Stripe subscription status + current_period_end (unix seconds),
// derive { plan, accessUntil, currentPeriodEnd }.
//   - active/trialing: access until the period end (this also handles
//     cancel-at-period-end — Stripe keeps status active until the date passes).
//   - past_due: access until (period end + grace), so retries have room.
//   - anything else: free, no access.
// `accessUntil === ''` means "no client-side expiry" (server keeps it fresh).
export function deriveEntitlement({ status, currentPeriodEndSeconds, graceDays = DEFAULT_GRACE_DAYS, nowMs = 0 }) {
  const periodEndMs = Number.isFinite(currentPeriodEndSeconds) && currentPeriodEndSeconds > 0
    ? currentPeriodEndSeconds * 1000
    : 0;
  const graceMs = Math.max(0, graceDays) * 24 * 60 * 60 * 1000;

  const plan = PRO_STATUSES.has(status) ? 'pro' : 'free';

  let accessUntilMs = 0;
  if (status === 'active' || status === 'trialing') {
    accessUntilMs = periodEndMs;
  } else if (status === 'past_due') {
    accessUntilMs = (periodEndMs || nowMs) + graceMs;
  }

  return {
    plan,
    accessUntil: accessUntilMs ? new Date(accessUntilMs).toISOString() : '',
    currentPeriodEnd: periodEndMs ? new Date(periodEndMs).toISOString() : ''
  };
}
