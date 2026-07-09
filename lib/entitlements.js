(() => {
    const DEFAULT_CHECKOUT_URL = 'https://eloguard-billing.eloguard.workers.dev/checkout';
    const DEFAULT_PORTAL_URL = 'https://eloguard-billing.eloguard.workers.dev/portal';
    const DEFAULT_ENTITLEMENT_URL = 'https://eloguard-billing.eloguard.workers.dev/api/entitlement';
    const DEFAULT_CANCEL_RENEWAL_URL = 'https://eloguard-billing.eloguard.workers.dev/api/cancel-renewal';
    const INSTALL_ID_KEY = 'eloGuardInstallId';
    const ENTITLEMENT_KEY = 'eloGuardEntitlement';
    const BILLING_CONFIG_KEY = 'eloGuardBillingConfig';
    const USAGE_PREFIX = 'eloGuardUsage';
    const DEV_PRO_KEY = 'eloGuardDevPro';
    const DEV_PRO_OVERRIDE_ENABLED = false;
    const ENTITLEMENT_REFRESH_MS = 60 * 1000;
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
            cancelRenewalUrl: data[BILLING_CONFIG_KEY]?.cancelRenewalUrl || DEFAULT_CANCEL_RENEWAL_URL
        };
    }

    function proEntitlement(source) {
        return {
            plan: 'pro',
            status: 'active',
            source: source || 'dev',
            customerEmail: '',
            currentPeriodEnd: '',
            accessUntil: '',
            cancelAtPeriodEnd: false,
            cancelAt: '',
            refreshedAt: Date.now()
        };
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
            refreshedAt: ent.refreshedAt || 0
        };
    }

    function shouldAutoRefreshEntitlement(entitlement) {
        if (isProEntitlement(entitlement)) return false;
        return !entitlement.refreshedAt || Date.now() - entitlement.refreshedAt > ENTITLEMENT_REFRESH_MS;
    }

    async function getEntitlement(options = {}) {
        const [localData, syncData] = await Promise.all([
            storageGet('local', [ENTITLEMENT_KEY, DEV_PRO_KEY]),
            storageGet('sync', [DEV_PRO_KEY])
        ]);

        if (DEV_PRO_OVERRIDE_ENABLED && (localData[DEV_PRO_KEY] === true || syncData[DEV_PRO_KEY] === true)) {
            return proEntitlement('dev');
        }

        const entitlement = normalizeEntitlement(localData[ENTITLEMENT_KEY]);
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
        return Number.isNaN(end) || end > Date.now();
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
        const id = usageId !== undefined && usageId !== null ? String(usageId) : null;
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

    async function consumeFeature(featureKey, usageId) {
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

        const usage = await getUsage(featureKey);
        const id = String(usageId || 'default');
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
        return {
            allowed: true,
            isPro: false,
            limit,
            used: next.count,
            remaining: Math.max(0, limit - next.count),
            entitlement
        };
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
        if (tab && !tab.closed) tab.location.href = url;
        else window.open(url, '_blank', 'noopener');
        return url;
    }

    async function refreshEntitlement() {
        const config = await getBillingConfig();
        const installId = await getInstallId();
        const url = new URL(config.entitlementUrl);
        url.searchParams.set('installId', installId);

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store'
        });
        if (!response.ok) throw new Error(`Entitlement check failed (${response.status})`);

        const entitlement = normalizeEntitlement(await response.json());
        entitlement.refreshedAt = Date.now();
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
            body: JSON.stringify({ installId })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.error) {
            throw new Error(data.error || `Cancel renewal failed (${response.status})`);
        }
        const entitlement = normalizeEntitlement(data);
        entitlement.refreshedAt = Date.now();
        await storageSet('local', { [ENTITLEMENT_KEY]: entitlement });
        return { entitlement, message: data.message || '' };
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
        setDevPro
    };
})();
