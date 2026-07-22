(() => {
    const DEFAULT_CHECKOUT_URL = 'https://eloguard-billing.eloguard.workers.dev/checkout';
    const DEFAULT_PORTAL_URL = 'https://eloguard-billing.eloguard.workers.dev/portal';
    const DEFAULT_ENTITLEMENT_URL = 'https://eloguard-billing.eloguard.workers.dev/api/entitlement';
    const DEFAULT_CANCEL_RENEWAL_URL = 'https://eloguard-billing.eloguard.workers.dev/api/cancel-renewal';
    const DEFAULT_RESTORE_URL = 'https://eloguard-billing.eloguard.workers.dev/restore';
    const DEFAULT_RESTORE_VERIFY_URL = 'https://eloguard-billing.eloguard.workers.dev/restore/verify';
    const INSTALL_ID_KEY = 'eloGuardInstallId';
    const ENTITLEMENT_KEY = 'eloGuardEntitlement';
    const BILLING_CONFIG_KEY = 'eloGuardBillingConfig';
    const USAGE_PREFIX = 'eloGuardUsage';
    const DEV_PRO_KEY = 'eloGuardDevPro';
    const DEV_PRO_OVERRIDE_ENABLED = false;
    const OWNER_PRO_FILE = 'owner-pro.local';
    const ENTITLEMENT_REFRESH_MS = 60 * 1000;
    const PRO_REVALIDATE_MS = 24 * 60 * 60 * 1000;
    const FETCH_TIMEOUT_MS = 10000;
    const RESTORE_TIMEOUT_MS = 15000;
    // 'past_due' is Pro during the server-side dunning grace window; the server
    // only reports it while Stripe is still retrying, and bounds it via accessUntil.
    const PRO_STATUSES = new Set(['active', 'trialing', 'past_due', 'lifetime']);
    const DAILY_LIMITS = {
        riskProfile: 3,
        matchup: 3,
        gameReview: 3
    };

    function storageGet(area, keys) {
        return new Promise((resolve) => {
            try {
                chrome.storage[area].get(keys, (result) => resolve(result || {}));
            } catch (_) {
                resolve({});
            }
        });
    }

    function storageSet(area, values) {
        return new Promise((resolve) => {
            try {
                chrome.storage[area].set(values, () => resolve());
            } catch (_) {
                resolve();
            }
        });
    }

    function storageRemove(area, keys) {
        return new Promise((resolve) => {
            try {
                chrome.storage[area].remove(keys, () => resolve());
            } catch (_) {
                resolve();
            }
        });
    }

    function todayKey() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function randomId() {
        if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
        return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    async function getInstallId() {
        const data = await storageGet('local', [INSTALL_ID_KEY]);
        if (data[INSTALL_ID_KEY]) return data[INSTALL_ID_KEY];
        const id = randomId();
        await storageSet('local', { [INSTALL_ID_KEY]: id });
        return id;
    }

    async function getBillingConfig() {
        const data = await storageGet('sync', [BILLING_CONFIG_KEY]);
        return {
            checkoutUrl: data[BILLING_CONFIG_KEY]?.checkoutUrl || DEFAULT_CHECKOUT_URL,
            portalUrl: data[BILLING_CONFIG_KEY]?.portalUrl || DEFAULT_PORTAL_URL,
            entitlementUrl: data[BILLING_CONFIG_KEY]?.entitlementUrl || DEFAULT_ENTITLEMENT_URL,
            cancelRenewalUrl: data[BILLING_CONFIG_KEY]?.cancelRenewalUrl || DEFAULT_CANCEL_RENEWAL_URL,
            restoreUrl: data[BILLING_CONFIG_KEY]?.restoreUrl || DEFAULT_RESTORE_URL,
            restoreVerifyUrl: data[BILLING_CONFIG_KEY]?.restoreVerifyUrl || DEFAULT_RESTORE_VERIFY_URL
        };
    }

    function proEntitlement(source, status = 'active') {
        return {
            plan: 'pro',
            status,
            source: source || 'dev',
            customerEmail: '',
            currentPeriodEnd: '',
            accessUntil: '',
            cancelAtPeriodEnd: false,
            cancelAt: '',
            refreshedAt: Date.now(),
            lastSynced: Date.now()
        };
    }

    // Local owner builds can opt into permanent Pro with an ignored marker file.
    // The release packager uses an explicit allowlist and never ships this file,
    // so public Chrome Web Store builds continue to rely on billing entitlements.
    let ownerProPromise = null;
    function hasOwnerProMarker() {
        if (ownerProPromise) return ownerProPromise;
        if (!chrome?.runtime || typeof chrome.runtime.getURL !== 'function') {
            return Promise.resolve(false);
        }
        ownerProPromise = fetch(chrome.runtime.getURL(OWNER_PRO_FILE), { cache: 'no-store' })
            .then((response) => response.ok ? response.json() : null)
            .then((config) => config?.ownerPro === true)
            .catch(() => false);
        return ownerProPromise;
    }

    function normalizeEntitlement(raw) {
        const ent = raw && typeof raw === 'object' ? raw : {};
        return {
            plan: ent.plan || 'free',
            status: ent.status || 'free',
            source: ent.source || 'local',
            customerEmail: ent.customerEmail || '',
            currentPeriodEnd: ent.currentPeriodEnd || '',
            accessUntil: ent.accessUntil || '',
            cancelAtPeriodEnd: ent.cancelAtPeriodEnd === true,
            cancelAt: ent.cancelAt || '',
            refreshedAt: ent.refreshedAt || 0,
            lastSynced: ent.lastSynced || 0
        };
    }

    function shouldAutoRefreshEntitlement(entitlement) {
        if (entitlement.source === 'owner') return false;
        // A trial that has been cancelled at period end is especially likely to
        // change again during testing (or via an immediate admin cancellation).
        // Never let the normal 24-hour Pro cache pin that stale trial locally.
        if (entitlement.status === 'trialing' && entitlement.cancelAtPeriodEnd) return true;
        // Throttle repeated attempts (including retries after a failed refresh,
        // which stamps refreshedAt) so we never fetch on every call.
        const attemptDue = !entitlement.refreshedAt || Date.now() - entitlement.refreshedAt > ENTITLEMENT_REFRESH_MS;
        if (isProEntitlement(entitlement)) {
            // Pro is revalidated so a server-side revocation propagates: refresh
            // once the last successful sync is older than 24h. On failure/non-200
            // the cached entitlement is kept (see getEntitlement/refreshEntitlement).
            const syncDue = !entitlement.lastSynced || Date.now() - entitlement.lastSynced > PRO_REVALIDATE_MS;
            return syncDue && attemptDue;
        }
        return attemptDue;
    }

    async function getEntitlement(options = {}) {
        if (await hasOwnerProMarker()) {
            const ownerEntitlement = proEntitlement('owner', 'lifetime');
            await storageSet('local', { [ENTITLEMENT_KEY]: ownerEntitlement });
            return ownerEntitlement;
        }

        const [localData, syncData] = await Promise.all([
            storageGet('local', [ENTITLEMENT_KEY, DEV_PRO_KEY]),
            storageGet('sync', [DEV_PRO_KEY])
        ]);

        if (DEV_PRO_OVERRIDE_ENABLED && (localData[DEV_PRO_KEY] === true || syncData[DEV_PRO_KEY] === true)) {
            return proEntitlement('dev');
        }

        let entitlement = normalizeEntitlement(localData[ENTITLEMENT_KEY]);
        // The owner marker writes a cached 'owner' entitlement that never
        // auto-refreshes (see shouldAutoRefreshEntitlement). When the marker is
        // removed/disabled, that stale record would otherwise pin Pro forever, so
        // drop it and re-derive from billing.
        if (entitlement.source === 'owner') {
            await storageRemove('local', [ENTITLEMENT_KEY]);
            entitlement = normalizeEntitlement(null);
        }
        if (options.refresh || shouldAutoRefreshEntitlement(entitlement)) {
            try {
                return await refreshEntitlement();
            } catch (_) {
                entitlement.refreshedAt = Date.now();
                await storageSet('local', { [ENTITLEMENT_KEY]: entitlement });
            }
        }
        return entitlement;
    }

    function isProEntitlement(entitlement) {
        if (!entitlement) return false;
        if (entitlement.plan !== 'pro') return false;
        if (!PRO_STATUSES.has(entitlement.status)) return false;
        // Prefer accessUntil (server-computed hard cutoff; for past_due it
        // includes the dunning grace). Fall back to currentPeriodEnd for older
        // cached records, then to "no expiry".
        const until = entitlement.accessUntil || entitlement.currentPeriodEnd;
        if (!until) return true;
        const end = Date.parse(until);
        // Fail closed: a non-empty but unparseable date is treated as expired
        // rather than granting Pro indefinitely.
        if (Number.isNaN(end)) return false;
        return end > Date.now();
    }

    function usageKey(featureKey) {
        return `${USAGE_PREFIX}:${featureKey}:${todayKey()}`;
    }

    async function getUsage(featureKey) {
        const key = usageKey(featureKey);
        const data = await storageGet('local', [key]);
        const value = data[key] && typeof data[key] === 'object' ? data[key] : {};
        return {
            key,
            count: Number.isFinite(value.count) ? value.count : 0,
            ids: Array.isArray(value.ids) ? value.ids : []
        };
    }

    // An empty-string id must not collapse into a shared dedup bucket, so treat
    // '' the same as a missing id. Kept identical between the check and the
    // consume path so a re-view stays "already granted".
    function normalizeUsageId(usageId) {
        if (usageId === undefined || usageId === null) return null;
        const str = String(usageId);
        return str === '' ? null : str;
    }

    // Per-featureKey promise chain so concurrent consumeFeature() calls in this
    // context serialize instead of racing on the read-modify-write below.
    const consumeQueues = new Map();

    // Non-consuming check. Pass usageId to treat an id that was already consumed
    // today as still allowed (so re-viewing the same opponent/game doesn't hit a
    // paywall). Callers gate on this, then consumeFeature() only on success.
    async function getFeatureAccess(featureKey, usageId) {
        const entitlement = await getEntitlement();
        const isPro = isProEntitlement(entitlement);
        const limit = DAILY_LIMITS[featureKey] || 0;
        if (isPro || limit <= 0) {
            return {
                allowed: isPro,
                isPro,
                limit,
                used: 0,
                remaining: isPro ? Infinity : 0,
                alreadyGranted: false,
                entitlement
            };
        }

        const usage = await getUsage(featureKey);
        const id = normalizeUsageId(usageId);
        const alreadyGranted = id !== null && usage.ids.includes(id);
        return {
            allowed: alreadyGranted || usage.count < limit,
            isPro: false,
            limit,
            used: usage.count,
            remaining: Math.max(0, limit - usage.count),
            alreadyGranted,
            entitlement
        };
    }

    function consumeFeature(featureKey, usageId) {
        // Serialize per feature: chain onto the previous call's tail so same-context
        // concurrency can't read the same pre-increment count and clobber writes.
        const prev = consumeQueues.get(featureKey) || Promise.resolve();
        const run = prev.then(
            () => consumeFeatureLocked(featureKey, usageId),
            () => consumeFeatureLocked(featureKey, usageId)
        );
        consumeQueues.set(featureKey, run.catch(() => {}));
        return run;
    }

    async function consumeFeatureLocked(featureKey, usageId) {
        const entitlement = await getEntitlement();
        if (isProEntitlement(entitlement)) {
            return {
                allowed: true,
                isPro: true,
                limit: DAILY_LIMITS[featureKey] || 0,
                used: 0,
                remaining: Infinity,
                entitlement
            };
        }

        const limit = DAILY_LIMITS[featureKey] || 0;
        if (limit <= 0) {
            return {
                allowed: false,
                isPro: false,
                limit,
                used: 0,
                remaining: 0,
                entitlement
            };
        }

        // A missing/empty id gets a unique synthetic marker so it counts against
        // the quota (never dedups against another action) yet still serves as the
        // write-verification marker for the cross-context retry loop below.
        const normalized = normalizeUsageId(usageId);
        const id = normalized !== null
            ? normalized
            : `auto:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;

        const MAX_ATTEMPTS = 4;
        let lastResult = null;
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
            const usage = await getUsage(featureKey);
            if (usage.ids.includes(id)) {
                return {
                    allowed: true,
                    isPro: false,
                    limit,
                    used: usage.count,
                    remaining: Math.max(0, limit - usage.count),
                    entitlement
                };
            }

            if (usage.count >= limit) {
                return {
                    allowed: false,
                    isPro: false,
                    limit,
                    used: usage.count,
                    remaining: 0,
                    entitlement
                };
            }

            const next = {
                count: usage.count + 1,
                ids: [...usage.ids, id].slice(-25)
            };
            await storageSet('local', { [usage.key]: next });

            // Confirm the write stuck; another context may have clobbered it.
            const verify = await getUsage(featureKey);
            if (verify.ids.includes(id)) {
                return {
                    allowed: true,
                    isPro: false,
                    limit,
                    used: verify.count,
                    remaining: Math.max(0, limit - verify.count),
                    entitlement
                };
            }
            // Clobbered: redo the whole cycle against fresh merged state.
            lastResult = {
                allowed: true,
                isPro: false,
                limit,
                used: next.count,
                remaining: Math.max(0, limit - next.count),
                entitlement
            };
        }
        // Never verified after MAX_ATTEMPTS; the write was attempted, so return
        // the last computed result rather than throwing.
        return lastResult;
    }

    async function buildBillingUrl(kind = 'checkout', params = {}) {
        const installId = await getInstallId();
        const config = await getBillingConfig();
        const base = kind === 'portal' ? config.portalUrl : config.checkoutUrl;
        const url = new URL(base);
        url.searchParams.set('installId', installId);
        url.searchParams.set('source', 'extension');
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                url.searchParams.set(key, String(value));
            }
        });
        return url.toString();
    }

    async function openBilling(kind = 'checkout', params = {}) {
        let tab = null;
        try {
            tab = window.open('about:blank', '_blank');
        } catch (_) {
            tab = null;
        }
        const url = await buildBillingUrl(kind, params);
        if (tab && !tab.closed) {
            tab.location.href = url;
            return url;
        }
        let opened = null;
        try {
            opened = window.open(url, '_blank', 'noopener');
        } catch (_) {
            opened = null;
        }
        if (opened) return url;
        // Popup blocked in both attempts: in the extension popup context we can
        // still open a tab directly.
        if (typeof chrome !== 'undefined' && chrome.tabs && typeof chrome.tabs.create === 'function') {
            try {
                chrome.tabs.create({ url });
                return url;
            } catch (_) { /* nothing opened */ }
        }
        return null;
    }

    async function refreshEntitlement() {
        const config = await getBillingConfig();
        const installId = await getInstallId();
        const url = new URL(config.entitlementUrl);
        url.searchParams.set('installId', installId);

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
        });
        if (!response.ok) throw new Error(`Entitlement check failed (${response.status})`);

        const entitlement = normalizeEntitlement(await response.json());
        entitlement.refreshedAt = Date.now();
        entitlement.lastSynced = Date.now();
        await storageSet('local', { [ENTITLEMENT_KEY]: entitlement });
        return entitlement;
    }

    async function cancelRenewal() {
        const config = await getBillingConfig();
        const installId = await getInstallId();
        const response = await fetch(config.cancelRenewalUrl, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            cache: 'no-store',
            body: JSON.stringify({ installId }),
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.error) {
            throw new Error(data.error || `Cancel renewal failed (${response.status})`);
        }
        const entitlement = normalizeEntitlement(data);
        entitlement.refreshedAt = Date.now();
        entitlement.lastSynced = Date.now();
        await storageSet('local', { [ENTITLEMENT_KEY]: entitlement });
        return { entitlement, message: data.message || '' };
    }

    // Restore is a two-step, email-verified flow: /restore emails a one-time
    // code to the address on file, /restore/verify exchanges that code for the
    // entitlement. Known error codes from the server pass through as Error
    // messages; anything else collapses to 'network'.
    const RESTORE_ERROR_CODES = new Set([
        'not_found', 'rate_limited', 'restore_unavailable', 'send_failed',
        'invalid_code', 'code_expired', 'too_many_attempts'
    ]);

    async function postRestoreEndpoint(url, payload) {
        let response;
        try {
            response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                cache: 'no-store',
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(RESTORE_TIMEOUT_MS)
            });
        } catch (_) {
            // Timeout/abort/offline all surface as a generic network failure.
            throw new Error('network');
        }
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok !== true) {
            throw new Error(RESTORE_ERROR_CODES.has(data.error) ? data.error : 'network');
        }
        return data;
    }

    async function restoreRequestCode(email) {
        const config = await getBillingConfig();
        const installId = await getInstallId();
        const data = await postRestoreEndpoint(config.restoreUrl, { email, installId });
        if (data.status !== 'code_sent') throw new Error('network');
        return { expiresInSeconds: data.expiresInSeconds || 600 };
    }

    async function restoreVerifyCode(email, code) {
        const config = await getBillingConfig();
        const installId = await getInstallId();
        const data = await postRestoreEndpoint(config.restoreVerifyUrl, { email, installId, code });
        if (!data.entitlement) throw new Error('network');
        const entitlement = normalizeEntitlement(data.entitlement);
        entitlement.refreshedAt = Date.now();
        entitlement.lastSynced = Date.now();
        await storageSet('local', { [ENTITLEMENT_KEY]: entitlement });
        return entitlement;
    }

    async function setDevPro(enabled) {
        if (!DEV_PRO_OVERRIDE_ENABLED) {
            await Promise.all([
                storageRemove('local', [DEV_PRO_KEY]),
                storageRemove('sync', [DEV_PRO_KEY])
            ]);
            return false;
        }
        await storageSet('local', { [DEV_PRO_KEY]: !!enabled });
        if (!enabled) await storageRemove('sync', [DEV_PRO_KEY]);
        return true;
    }

    window.EloGuardEntitlements = {
        DAILY_LIMITS,
        getInstallId,
        getBillingConfig,
        getEntitlement,
        isProEntitlement,
        getFeatureAccess,
        consumeFeature,
        buildBillingUrl,
        openBilling,
        refreshEntitlement,
        cancelRenewal,
        restoreRequestCode,
        restoreVerifyCode,
        setDevPro
    };
})();
