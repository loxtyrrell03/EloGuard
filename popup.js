document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const mainView = document.getElementById('mainView');
    const settingsView = document.getElementById('settingsView');
    const settingsBtn = document.getElementById('settingsBtn');
    const statsBtn = document.getElementById('statsBtn');
    const backBtn = document.getElementById('backBtn');
    const saveBtn = document.getElementById('saveSettingsBtn');
    const activateBtn = document.getElementById('activateBtn');
    const zenToggle = document.getElementById('hideRatings');
    const anonymizeOpponentToggle = document.getElementById('anonymizeOpponent');
    const anonymizeSelfToggle = document.getElementById('anonymizeSelf');
    const enhancedFocusToggle = document.getElementById('enhancedFocusMode');
    const showRiskProfilePillToggle = document.getElementById('showRiskProfilePill');
    const upgradeBtn = document.getElementById('upgradeBtn');
    const refreshProBtn = document.getElementById('refreshProBtn');
    const proSection = document.getElementById('proSection');
    const proSectionTitle = document.getElementById('proSectionTitle');
    const proUsageHint = document.getElementById('proUsageHint');
    const billingPlanLabel = document.getElementById('billingPlanLabel');
    const billingStatusLabel = document.getElementById('billingStatusLabel');
    const billingManageBtn = document.getElementById('billingManageBtn');
    const billingCancelBtn = document.getElementById('billingCancelBtn');
    const billingRefreshBtn = document.getElementById('billingRefreshBtn');
    const billingMessage = document.getElementById('billingMessage');
    const proFeatureBtns = document.querySelectorAll('.pro-feature');
    const SMART_BRACKET_FEATURE = 'smartBracket';
    const PRO_FEATURE_LABELS = {
        riskProfile: { free: 'Cheat risk detection', pro: 'Unlimited cheat risk detection' },
        gameReview: { free: 'Game review', pro: 'Full game reviews' },
        smartBracket: { free: 'Smart bracket auto-set', pro: 'Smart bracket auto-set' }
    };
    const devProRow = document.getElementById('devProRow');
    const devProToggle = document.getElementById('devProToggle');
    const DEV_PRO_STORAGE_KEY = 'eloGuardDevPro';
    const DEV_PRO_VISIBILITY_KEY = 'eloGuardShowDevProToggle';
    const ENABLE_DEV_PRO_TESTER = false;
    
    // Cooldown UI
    const cooldownToggle = document.getElementById('cooldownActive');
    const cooldownInput = document.getElementById('cooldownSeconds');

    // Random String Unlock UI
    const randomStringToggle = document.getElementById('randomStringUnlock');
    const randomStringLengthInput = document.getElementById('randomStringLength');

    // Unlock UI Elements
    const unlockUI = document.getElementById('unlockUI');
    const unlockStringDisplay = document.getElementById('unlockStringDisplay');
    const unlockInput = document.getElementById('unlockInput');
    const unlockEnterBtn = document.getElementById('unlockEnterBtn');
    const unlockError = document.getElementById('unlockError');

    let currentUnlockString = '';
    let randomStringUnlockEnabled = false;
    let randomStringLength = 10;

    // Visiblity & Mode
    const ratingVisBtn = document.getElementById('toggleRatingVisBtn');
    const ratingContainer = document.getElementById('ratingContainer'); 
    const liveRatingEl = document.getElementById('liveRating');
    const gameModeSelect = document.getElementById('gameMode'); 
    
    // NEW: Stats Display Elements
    const dispStop = document.getElementById('dispStop');
    const dispTarget = document.getElementById('dispTarget');
    
    // Inputs
    const usernameInput = document.getElementById('username');
    const connectBtn = document.getElementById('connectBtn'); // <--- NEW
    const stopLossInput = document.getElementById('stopLoss');
    const targetRatingInput = document.getElementById('targetRating');
    const lossStreakInput = document.getElementById('lossStreakLimit');
    const lockoutDurationInput = document.getElementById('lockoutDuration');
    const applySmartBtn = document.getElementById('applySmartBtn');
    const smartRangeInput = document.getElementById('smartRange');
    const smartBracketGroup = document.querySelector('.smart-bracket-group');

    // Stat Boxes
    const statBoxes = document.querySelectorAll('.stat-box');
    const statsRefs = {
        rapid: document.getElementById('statRapid'),
        blitz: document.getElementById('statBlitz'),
        bullet: document.getElementById('statBullet')
    };
    
    // State
    let currentState = {};
    let currentFetchedRating = null; 
    let isRatingHidden = false;
    let activeMode = "blitz"; // Default
    let currentEntitlement = null;

    // 1. LOAD SAVED STATE
    chrome.storage.sync.get(null, (data) => {
        currentState = data;
        
        if (data.username) usernameInput.value = data.username;
        if (data.hideRatings) zenToggle.checked = data.hideRatings;
        if (data.anonymizeOpponent) anonymizeOpponentToggle.checked = data.anonymizeOpponent;
        if (data.anonymizeSelf) anonymizeSelfToggle.checked = data.anonymizeSelf;
        if (data.enhancedFocusMode) enhancedFocusToggle.checked = data.enhancedFocusMode;
        showRiskProfilePillToggle.checked = data.showRiskProfilePill !== false;
        if (data.guardActive) setGuardActiveUI(true);
        if (data.gameMode) activeMode = data.gameMode;
        
        // Cooldown State
        if (data.cooldownActive) cooldownToggle.checked = data.cooldownActive;
        if (data.cooldownSeconds) cooldownInput.value = data.cooldownSeconds;

        // Random String Unlock State
        if (data.randomStringUnlock) {
            randomStringToggle.checked = data.randomStringUnlock;
            randomStringUnlockEnabled = data.randomStringUnlock;
        }
        if (data.randomStringLength) {
            randomStringLengthInput.value = data.randomStringLength;
            randomStringLength = parseInt(data.randomStringLength) || 10;
        }

        // Lockout Duration
        if (data.lockoutDuration) lockoutDurationInput.value = data.lockoutDuration;
        
        if (data.maskPopupRating) {
            isRatingHidden = true;
            updateRatingVisibility();
        }

        // Set Initial Mode UI
        gameModeSelect.value = activeMode;
        updateModeUI(activeMode);
        refreshEntitlementUi(false);
        refreshActiveChessTab();
        
        if (data.username) checkConnection();
    });

    // 2. USERNAME INPUT LOGIC (NEW)
    // Trigger on "Enter" key
    usernameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            checkConnection();
        }
    });

    // Trigger on "Connect" button click
    connectBtn.addEventListener('click', () => {
        checkConnection();
    });

    // 3. MODE SWITCHING
    gameModeSelect.addEventListener('change', () => {
        changeMode(gameModeSelect.value);
    });

    statBoxes.forEach(box => {
        box.addEventListener('click', () => {
            const mode = box.getAttribute('data-mode');
            changeMode(mode);
        });
    });

    function changeMode(newMode) {
        activeMode = newMode;
        gameModeSelect.value = newMode;
        
        // Save Mode immediately
        chrome.storage.sync.set({ gameMode: newMode });
        
        // Update UI logic for the selected mode
        updateModeUI(newMode);
        
        // Refresh connection to get new rating
        checkConnection();
    }

    function updateModeUI(mode) {
        // 1. Highlight Box
        statBoxes.forEach(box => {
            if (box.getAttribute('data-mode') === mode) {
                box.classList.add('selected');
            } else {
                box.classList.remove('selected');
            }
        });

        // 2. Load saved values for the selected mode (no auto smart bracket)
        loadSavedValuesForMode(mode);
        
        // NEW: Update the display under the rating
        updateMainViewStats();
    }

    function loadSavedValuesForMode(mode) {
        const savedStop = currentState[`stopLoss_${mode}`] || "";
        const savedTarget = currentState[`targetRating_${mode}`] || "";
        const savedLossStreak = currentState[`lossStreak_${mode}`] || "";
        stopLossInput.value = savedStop;
        targetRatingInput.value = savedTarget;
        lossStreakInput.value = savedLossStreak;
    }
    
    // Helper to update the Floor/Ceiling display on main card
    function updateMainViewStats() {
        const s = stopLossInput.value;
        const t = targetRatingInput.value;
        
        dispStop.innerText = s ? s : "---";
        dispTarget.innerText = t ? t : "---";
    }

    // 4. MAIN BUTTONS
    activateBtn.addEventListener('click', () => {
        const isCurrentlyActive = activateBtn.classList.contains('active-green');

        if (isCurrentlyActive && randomStringUnlockEnabled) {
            // Show unlock UI when trying to deactivate with random string enabled
            showUnlockUI();
        } else {
            // Toggle normally
            const newState = !isCurrentlyActive;
            setGuardActiveUI(newState);
            chrome.storage.sync.set({ guardActive: newState });
        }
    });

    // Unlock Enter Button Click
    unlockEnterBtn.addEventListener('click', () => {
        attemptUnlock();
    });

    // Unlock Input Enter Key
    unlockInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            attemptUnlock();
        }
    });

    function generateRandomString(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
        let result = '';
        const array = new Uint32Array(length);
        crypto.getRandomValues(array);
        for (let i = 0; i < length; i++) {
            result += chars[array[i] % chars.length];
        }
        return result;
    }

    function showUnlockUI() {
        currentUnlockString = generateRandomString(randomStringLength);
        unlockStringDisplay.innerText = currentUnlockString;
        unlockInput.value = '';
        unlockError.classList.add('hidden');
        unlockUI.classList.remove('hidden');
        activateBtn.style.display = 'none';
        setTimeout(() => unlockInput.focus(), 100);
    }

    function hideUnlockUI() {
        unlockUI.classList.add('hidden');
        activateBtn.style.display = 'block';
        unlockInput.value = '';
        unlockError.classList.add('hidden');
        currentUnlockString = '';
    }

    function attemptUnlock() {
        if (unlockInput.value === currentUnlockString) {
            // Success - deactivate guard
            hideUnlockUI();
            setGuardActiveUI(false);
            chrome.storage.sync.set({ guardActive: false });
        } else {
            // Failed - shake and show error
            unlockError.classList.remove('hidden');
            unlockInput.classList.add('shake');
            setTimeout(() => {
                unlockInput.classList.remove('shake');
            }, 500);
        }
    }

    zenToggle.addEventListener('change', () => {
        chrome.storage.sync.set({ hideRatings: zenToggle.checked }, refreshActiveChessTab);
    });

    anonymizeOpponentToggle.addEventListener('change', () => {
        chrome.storage.sync.set({ anonymizeOpponent: anonymizeOpponentToggle.checked }, refreshActiveChessTab);
    });

    anonymizeSelfToggle.addEventListener('change', () => {
        chrome.storage.sync.set({ anonymizeSelf: anonymizeSelfToggle.checked }, refreshActiveChessTab);
    });

    enhancedFocusToggle.addEventListener('change', () => {
        chrome.storage.sync.set({ enhancedFocusMode: enhancedFocusToggle.checked }, refreshActiveChessTab);
    });

    showRiskProfilePillToggle.addEventListener('change', () => {
        chrome.storage.sync.set({ showRiskProfilePill: showRiskProfilePillToggle.checked }, refreshActiveChessTab);
    });

    upgradeBtn?.addEventListener('click', async () => {
        await openBillingForFeature('popup');
    });

    refreshProBtn?.addEventListener('click', () => {
        refreshEntitlementUi(true);
    });

    billingRefreshBtn?.addEventListener('click', () => {
        setBillingMessage('');
        refreshEntitlementUi(true);
    });

    billingManageBtn?.addEventListener('click', async () => {
        setBillingMessage('');
        await openBillingForFeature('settings');
    });

    billingCancelBtn?.addEventListener('click', async () => {
        const api = window.EloGuardEntitlements;
        if (!api || !currentEntitlement) return;
        if (currentEntitlement.status === 'lifetime') {
            setBillingMessage('Lifetime access has no renewal to cancel.');
            return;
        }
        if (currentEntitlement.cancelAtPeriodEnd) {
            setBillingMessage('Renewal is already cancelled.');
            return;
        }

        const dateText = currentEntitlement.currentPeriodEnd
            ? ` You will keep Pro until ${new Date(currentEntitlement.currentPeriodEnd).toLocaleDateString()}.`
            : '';
        const ok = window.confirm(`Cancel EloGuard Pro renewal?${dateText}`);
        if (!ok) return;

        billingCancelBtn.disabled = true;
        billingCancelBtn.textContent = 'Cancelling...';
        setBillingMessage('');
        try {
            const result = await api.cancelRenewal();
            currentEntitlement = result.entitlement;
            applyEntitlementState(api.isProEntitlement(currentEntitlement), billingHintForEntitlement(currentEntitlement));
            setBillingMessage(result.message || 'Renewal cancelled. You keep Pro until the period ends.');
            await refreshEntitlementUi(true);
        } catch (e) {
            setBillingMessage(e instanceof Error ? e.message : 'Could not cancel renewal. Try Manage subscription.', true);
            updateBillingCard(currentEntitlement);
        }
    });

    if (ENABLE_DEV_PRO_TESTER && devProToggle) {
        chrome.storage.local.get([DEV_PRO_STORAGE_KEY, DEV_PRO_VISIBILITY_KEY], (data) => {
            const stored = data ? data[DEV_PRO_STORAGE_KEY] : undefined;
            const showDevToggle = data && (data[DEV_PRO_VISIBILITY_KEY] === true || stored !== undefined);
            devProToggle.checked = stored === true;
            if (showDevToggle) devProRow?.classList.remove('hidden');
        });
        devProToggle.addEventListener('change', async () => {
            const api = window.EloGuardEntitlements;
            if (api && typeof api.setDevPro === 'function') {
                await api.setDevPro(devProToggle.checked);
            }
            await refreshEntitlementUi(false);
            refreshActiveChessTab();
        });
    }

    // Pro feature rows are a display-only showcase (no per-row links);
    // the upgrade path is the header button.

    // 5. VISIBILITY
    ratingVisBtn.addEventListener('click', () => {
        isRatingHidden = !isRatingHidden;
        updateRatingVisibility();
        chrome.storage.sync.set({ maskPopupRating: isRatingHidden });
    });

    function updateRatingVisibility() {
        // Now toggles the entire container which includes rating AND stats
        if (isRatingHidden) {
            ratingContainer.style.display = 'none';
            ratingVisBtn.innerText = "Show";
        } else {
            ratingContainer.style.display = 'flex'; 
            ratingVisBtn.innerText = "Hide";
            if (currentFetchedRating) liveRatingEl.innerText = currentFetchedRating;
        }
    }

    // 6. SMART BRACKET APPLY BTN
    applySmartBtn.addEventListener('click', async () => {
        if (!isProActive()) {
            await openBillingForFeature(SMART_BRACKET_FEATURE);
            setSmartBracketUi(false);
            return;
        }

        const range = parseInt(smartRangeInput.value);
        if (!currentFetchedRating || isNaN(currentFetchedRating)) {
            applySmartBtn.innerText = "❌ No Rating";
            setTimeout(() => applySmartBtn.innerText = "Apply", 1500);
            return;
        }
        if (!range || range <= 0) {
            applySmartBtn.innerText = "❌ Invalid";
            setTimeout(() => applySmartBtn.innerText = "Apply", 1500);
            return;
        }

        const floor = currentFetchedRating - range;
        const ceiling = currentFetchedRating + range;

        stopLossInput.value = floor;
        targetRatingInput.value = ceiling;
        
        // Update display immediately
        updateMainViewStats();

        applySmartBtn.innerText = "✅ Set!";
        setTimeout(() => applySmartBtn.innerText = "Apply", 1500);
    });

    // 7. NAVIGATION
    settingsBtn.addEventListener('click', () => {
        mainView.classList.add('hidden');
        settingsView.classList.remove('hidden');
        fetchAllStats();
    });

    // My Stats opens the in-page Strength Profile overlay (all the review data
    // lives in the content script). Reach into the active chess.com tab, make
    // sure content.js is loaded, trigger the stats view, then close the popup
    // so the overlay is visible.
    const STATS_BTN_LABEL = '📊';
    statsBtn?.addEventListener('click', () => {
        if (!chrome.tabs || !chrome.scripting) return;
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs && tabs[0];
            if (!tab?.id || !/^https?:\/\/([^/]+\.)?chess\.com\//i.test(tab.url || '')) {
                flashStatsUnavailable();
                return;
            }
            chrome.scripting.insertCSS({
                target: { tabId: tab.id },
                files: ['styles.css']
            }, () => {
                if (chrome.runtime.lastError) {
                    console.warn('EloGuard stats CSS failed:', chrome.runtime.lastError.message);
                }
            });
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['lib/chess.js', 'lib/book.js', 'lib/review-core.js', 'lib/entitlements.js', 'content.js']
            }, () => {
                if (chrome.runtime.lastError) {
                    console.warn('EloGuard stats inject failed:', chrome.runtime.lastError.message);
                    return;
                }
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => {
                        if (typeof window.__eloGuardOpenStats === 'function') {
                            window.__eloGuardOpenStats();
                            return true;
                        }
                        return false;
                    }
                }, (results) => {
                    if (chrome.runtime.lastError) {
                        console.warn('EloGuard stats open failed:', chrome.runtime.lastError.message);
                        flashStatsUnavailable('Reload the chess.com page, then try again');
                        return;
                    }
                    const opened = Array.isArray(results) && results[0] && results[0].result;
                    if (opened) {
                        window.close();
                    } else {
                        // content.js loaded but the hook wasn't ready (rare) — a
                        // page reload guarantees the current content script.
                        flashStatsUnavailable('Reload the chess.com page, then try again');
                    }
                });
            });
        });
    });

    function flashStatsUnavailable(msg) {
        if (!statsBtn) return;
        statsBtn.textContent = '⚠';
        statsBtn.title = msg || 'Open a chess.com tab to view your stats';
        setTimeout(() => {
            statsBtn.textContent = STATS_BTN_LABEL;
            statsBtn.title = 'My Stats — Strength Profile';
        }, 2200);
    }

    backBtn.addEventListener('click', () => {
        settingsView.classList.add('hidden');
        mainView.classList.remove('hidden');
        checkConnection(); 
    });

    // 8. SAVE
    saveBtn.addEventListener('click', () => {
        const username = usernameInput.value.trim();
        const stopLoss = stopLossInput.value;
        const targetRating = targetRatingInput.value;
        const lossStreakLimit = lossStreakInput.value;
        const cdActive = cooldownToggle.checked;
        const cdSeconds = cooldownInput.value;
        const rsUnlock = randomStringToggle.checked;
        const rsLength = randomStringLengthInput.value;
        const lockoutDuration = lockoutDurationInput.value;

        let updateData = {
            username,
            gameMode: activeMode,
            cooldownActive: cdActive,
            cooldownSeconds: cdSeconds,
            randomStringUnlock: rsUnlock,
            randomStringLength: rsLength,
            lockoutDuration: lockoutDuration
        };

        updateData[`stopLoss_${activeMode}`] = stopLoss;
        updateData[`targetRating_${activeMode}`] = targetRating;
        updateData[`lossStreak_${activeMode}`] = lossStreakLimit;

        currentState = { ...currentState, ...updateData };

        chrome.storage.sync.set(updateData, () => {
            updateMainViewStats(); // Update display on save

            // Update local state for random string unlock
            randomStringUnlockEnabled = rsUnlock;
            randomStringLength = parseInt(rsLength) || 10;

            saveBtn.innerText = "✅ Saved!";
            setTimeout(() => saveBtn.innerText = "Save Settings", 1500);
            settingsView.classList.add('hidden');
            mainView.classList.remove('hidden');
            checkConnection();
        });
    });

    // --- HELPERS ---
    
    function setGuardActiveUI(isActive) {
        if (isActive) {
            activateBtn.innerText = "🛡️ GUARD ACTIVE";
            activateBtn.classList.add('active-green');
            checkConnection();
        } else {
            activateBtn.innerText = "ACTIVATE GUARD";
            activateBtn.classList.remove('active-green');
        }
    }

    async function checkConnection() {
        const username = usernameInput.value.trim();
        const statusText = document.getElementById('connectionStatus');

        if (!username) return;
        
        // Visual feedback on the Connect button (optional, but nice)
        connectBtn.innerText = "⌛";
        statusText.innerText = "Connecting...";

        try {
            const response = await fetch(`https://api.chess.com/pub/player/${username}/stats`);
            if (!response.ok) throw new Error();
            const data = await response.json();
            
            const statsObj = data[`chess_${activeMode}`];
            const rating = statsObj?.last?.rating;

            // Update Panel Refs
            if(data.chess_rapid) statsRefs.rapid.innerText = data.chess_rapid.last?.rating || "-";
            if(data.chess_blitz) statsRefs.blitz.innerText = data.chess_blitz.last?.rating || "-";
            if(data.chess_bullet) statsRefs.bullet.innerText = data.chess_bullet.last?.rating || "-";

            if (!rating) throw new Error("No rating found");

            currentFetchedRating = rating;

            statusText.innerHTML = `✅ Connected: <b>${username}</b>`;
            statusText.style.color = "#81b64c";
            
            liveRatingEl.innerText = rating;

            connectBtn.innerText = "✅";
            setTimeout(() => connectBtn.innerText = "Connect", 1500);

        } catch (e) {
            statusText.innerText = "❌ User/Mode not found";
            statusText.style.color = "#ff4d4d";
            liveRatingEl.innerText = "---";
            currentFetchedRating = null;
            
            connectBtn.innerText = "❌";
            setTimeout(() => connectBtn.innerText = "Connect", 1500);
        }
    }

    async function fetchAllStats() {
        checkConnection();
    }

    // Reflect Pro/free status across the header button and the locked feature
    // list: subscribed unlocks every row (🔒 → ✓), free keeps them locked with
    // the upgrade path.
    function leftLabel(access) {
        if (!access || access.isPro || !Number.isFinite(access.remaining)) return '';
        return ` (${Math.max(0, access.remaining)} left)`;
    }

    function setProFeatureLabels(isPro, usage = {}) {
        proFeatureBtns.forEach((btn) => {
            const feature = btn.getAttribute('data-feature');
            const label = btn.querySelector('.pro-feature-label');
            const labels = PRO_FEATURE_LABELS[feature];
            if (!label || !labels) return;

            if (isPro) {
                label.textContent = labels.pro;
            } else if (feature === SMART_BRACKET_FEATURE) {
                label.textContent = `${labels.free} (Pro)`;
            } else {
                label.textContent = `${labels.free}${leftLabel(usage[feature])}`;
            }
        });
    }

    function applyEntitlementState(isPro, hintText, usage = {}) {
        if (upgradeBtn) {
            upgradeBtn.innerText = isPro ? 'PRO' : 'Upgrade';
            upgradeBtn.classList.toggle('pro', isPro);
            upgradeBtn.title = isPro ? 'Manage your subscription' : 'Upgrade to EloGuard Pro';
        }
        if (proSection) proSection.classList.toggle('is-pro', isPro);
        if (proSectionTitle) proSectionTitle.textContent = isPro ? 'Pro active' : 'Pro features';
        proFeatureBtns.forEach((btn) => {
            const lock = btn.querySelector('.pro-feature-lock');
            if (lock) lock.textContent = isPro ? '✓' : '🔒';
        });
        setProFeatureLabels(isPro, usage);
        if (proUsageHint) proUsageHint.textContent = hintText;
        setSmartBracketUi(isPro);
        updateBillingCard(currentEntitlement);
    }

    function isProActive() {
        const api = window.EloGuardEntitlements;
        return !!(api && api.isProEntitlement(currentEntitlement));
    }

    async function openBillingForFeature(featureKey) {
        const api = window.EloGuardEntitlements;
        if (!api) return;
        await api.openBilling(isProActive() ? 'portal' : 'checkout', { feature: featureKey });
    }

    function formatBillingDate(value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function billingHintForEntitlement(entitlement) {
        if (!entitlement) return 'Free tier active.';
        if (entitlement.status === 'lifetime') return 'Lifetime access. No recurring subscription.';
        if (entitlement.cancelAtPeriodEnd) {
            return `Renewal cancelled. Pro ends ${formatBillingDate(entitlement.cancelAt || entitlement.currentPeriodEnd) || 'at the end of the paid period'}.`;
        }
        if (entitlement.status === 'past_due') return 'Payment failed. Update your card to keep Pro active.';
        if (isProActive()) {
            return entitlement.currentPeriodEnd
                ? `Renews ${formatBillingDate(entitlement.currentPeriodEnd)}.`
                : 'Pro subscription active.';
        }
        return 'Free tier active. Upgrade for unlimited reviews and cheat-risk checks.';
    }

    function setBillingMessage(message, isError = false) {
        if (!billingMessage) return;
        billingMessage.textContent = message || '';
        billingMessage.classList.toggle('error', Boolean(isError));
    }

    function updateBillingCard(entitlement) {
        const api = window.EloGuardEntitlements;
        const isPro = !!(api && api.isProEntitlement(entitlement));
        const isLifetime = entitlement?.status === 'lifetime';
        const isScheduledCancel = entitlement?.cancelAtPeriodEnd === true;

        if (billingPlanLabel) {
            billingPlanLabel.textContent = isLifetime
                ? 'EloGuard Pro Lifetime'
                : isPro
                    ? 'EloGuard Pro Monthly'
                    : 'Free plan';
        }
        if (billingStatusLabel) billingStatusLabel.textContent = billingHintForEntitlement(entitlement);

        if (billingManageBtn) {
            billingManageBtn.textContent = isPro ? 'Manage subscription' : 'Upgrade to Pro';
            billingManageBtn.classList.toggle('is-upgrade', !isPro);
        }
        if (billingCancelBtn) {
            billingCancelBtn.disabled = !isPro || isLifetime || isScheduledCancel;
            billingCancelBtn.textContent = isScheduledCancel
                ? 'Renewal cancelled'
                : isLifetime
                    ? 'No renewal'
                    : 'Cancel renewal';
            billingCancelBtn.title = !isPro
                ? 'No subscription to cancel'
                : isLifetime
                    ? 'Lifetime access has no renewal'
                    : isScheduledCancel
                        ? 'Renewal is already cancelled'
                        : 'Cancel monthly renewal at the end of your current paid period';
        }
    }

    function setSmartBracketUi(isPro) {
        if (smartBracketGroup) smartBracketGroup.classList.toggle('is-pro-locked', !isPro);
        if (smartRangeInput) {
            smartRangeInput.disabled = !isPro;
            smartRangeInput.title = isPro ? '' : 'Upgrade to EloGuard Pro to use Smart Bracket auto-set';
        }
        if (applySmartBtn) {
            applySmartBtn.innerText = isPro ? 'Apply' : 'Pro';
            applySmartBtn.title = isPro ? '' : 'Upgrade to EloGuard Pro';
        }
    }

    async function refreshEntitlementUi(syncRemote) {
        const api = window.EloGuardEntitlements;
        if (!api || !upgradeBtn) return;

        try {
            if (syncRemote && refreshProBtn) {
                refreshProBtn.classList.add('spinning');
                refreshProBtn.disabled = true;
            }
            if (syncRemote && billingRefreshBtn) {
                billingRefreshBtn.classList.add('spinning');
                billingRefreshBtn.disabled = true;
            }

            let entitlement = await api.getEntitlement();
            if (syncRemote && entitlement.source !== 'dev') entitlement = await api.refreshEntitlement();
            currentEntitlement = entitlement;

            const isPro = api.isProEntitlement(entitlement);
            if (isPro) {
                const until = entitlement.status === 'past_due'
                    ? 'Payment failed — update your card to keep Pro'
                    : (entitlement.currentPeriodEnd
                        ? `Unlimited · renews ${new Date(entitlement.currentPeriodEnd).toLocaleDateString()}`
                        : 'Unlimited access');
                applyEntitlementState(true, until);
            } else {
                const [risk, matchup, review] = await Promise.all([
                    api.getFeatureAccess('riskProfile'),
                    api.getFeatureAccess('matchup'),
                    api.getFeatureAccess('gameReview')
                ]);
                applyEntitlementState(false,
                    `Free today: ${risk.remaining}/${risk.limit} risk | ${matchup.remaining}/${matchup.limit} matchup | ${review.remaining}/${review.limit} review`,
                    { riskProfile: risk, matchup, gameReview: review });
            }

            if (refreshProBtn) {
                refreshProBtn.classList.remove('spinning');
                refreshProBtn.disabled = false;
            }
            if (billingRefreshBtn) {
                billingRefreshBtn.classList.remove('spinning');
                billingRefreshBtn.disabled = false;
            }
            refreshActiveChessTab();
        } catch (e) {
            const entitlement = await api.getEntitlement();
            currentEntitlement = entitlement;
            const isPro = api.isProEntitlement(entitlement);
            applyEntitlementState(isPro, isPro
                ? 'Unlimited access'
                : (syncRemote ? 'Could not reach billing — try again' : 'Upgrade for unlimited access'));
            if (refreshProBtn) {
                refreshProBtn.classList.remove('spinning');
                refreshProBtn.disabled = false;
            }
            if (billingRefreshBtn) {
                billingRefreshBtn.classList.remove('spinning');
                billingRefreshBtn.disabled = false;
            }
        }
    }

    function refreshActiveChessTab() {
        if (!chrome.tabs || !chrome.scripting) return;

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs && tabs[0];
            if (!tab?.id || !/^https?:\/\/([^/]+\.)?chess\.com\//i.test(tab.url || '')) return;

            chrome.scripting.insertCSS({
                target: { tabId: tab.id },
                files: ['styles.css']
            }, () => {
                if (chrome.runtime.lastError) {
                    console.warn('EloGuard CSS refresh failed:', chrome.runtime.lastError.message);
                }
            });

            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: applyDirectOpponentAnonymizer,
                args: [
                    anonymizeOpponentToggle.checked,
                    anonymizeSelfToggle.checked,
                    enhancedFocusToggle.checked,
                    showRiskProfilePillToggle.checked
                ]
            }, () => {
                if (chrome.runtime.lastError) {
                    console.warn('EloGuard direct anonymizer failed:', chrome.runtime.lastError.message);
                }
            });

            // Re-inject the entitlements library before content.js so an
            // already-open tab picks up the current Pro/free logic without a
            // full page reload.
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['lib/entitlements.js', 'content.js']
            }, () => {
                if (chrome.runtime.lastError) {
                    console.warn('EloGuard content refresh failed:', chrome.runtime.lastError.message);
                }
            });
        });
    }

    function applyDirectOpponentAnonymizer(opponentEnabled, selfEnabled, enhancedFocusEnabled, showRiskProfilePillEnabled) {
        const styleId = 'elo-guard-direct-anonymizer-style';
        let style = document.getElementById(styleId);

        if (!style) {
            style = document.createElement('style');
            style.id = styleId;
            document.head.appendChild(style);
        }

        style.textContent = `
            body.elo-guard-hide-risk-profile-pill #elo-guard-legitimacy-badge {
                display: none !important;
            }

            .elo-shield-anon-opponent #board-layout-player-top .player-playerContent,
            .elo-shield-anon-opponent .board-layout-player-top .player-playerContent,
            .elo-shield-anon-opponent [class*="player-top"] .player-playerContent,
            .elo-shield-anon-self #board-layout-player-bottom .player-playerContent,
            .elo-shield-anon-self .board-layout-player-bottom .player-playerContent,
            .elo-shield-anon-self [class*="player-bottom"] .player-playerContent {
                min-width: 40px !important;
                min-height: 40px !important;
                pointer-events: none !important;
            }

            .elo-shield-anon-opponent #board-layout-player-top .player-playerContent > *,
            .elo-shield-anon-opponent .board-layout-player-top .player-playerContent > *,
            .elo-shield-anon-opponent [class*="player-top"] .player-playerContent > *,
            .elo-shield-anon-self #board-layout-player-bottom .player-playerContent > *,
            .elo-shield-anon-self .board-layout-player-bottom .player-playerContent > *,
            .elo-shield-anon-self [class*="player-bottom"] .player-playerContent > * {
                visibility: hidden !important;
            }

            .elo-shield-anon-opponent .elo-guard-opponent-name::after,
            .elo-shield-anon-opponent #board-layout-player-top .player-playerContent::after,
            .elo-shield-anon-opponent .board-layout-player-top .player-playerContent::after,
            .elo-shield-anon-opponent [class*="player-top"] .player-playerContent::after,
            .elo-shield-anon-opponent [class*="player-top"] [class*="username"]::after,
            .elo-shield-anon-opponent [class*="player-top"] [class*="user-name"]::after,
            .elo-shield-anon-opponent [class*="player-top"] [class*="player-name"]::after {
                content: "" !important;
                display: none !important;
                visibility: hidden !important;
            }

            .elo-shield-anon-opponent #board-layout-player-top .cc-user-block-component,
            .elo-shield-anon-opponent #board-layout-player-top .user-tagline-compact-theatre,
            .elo-shield-anon-opponent [class*="player-top"] .cc-user-block-component,
            .elo-shield-anon-opponent [class*="player-top"] .user-tagline-compact-theatre,
            .elo-shield-anon-self #board-layout-player-bottom .cc-user-block-component,
            .elo-shield-anon-self #board-layout-player-bottom .user-tagline-compact-theatre,
            .elo-shield-anon-self [class*="player-bottom"] .cc-user-block-component,
            .elo-shield-anon-self [class*="player-bottom"] .user-tagline-compact-theatre,
            .elo-shield-anon-opponent #board-layout-player-top [class*="country"],
            .elo-shield-anon-opponent [class*="player-top"] [class*="country"],
            .elo-shield-anon-opponent #board-layout-player-top [class*="flag"],
            .elo-shield-anon-opponent [class*="player-top"] [class*="flag"],
            .elo-shield-anon-opponent #board-layout-player-top [class*="flair"],
            .elo-shield-anon-opponent [class*="player-top"] [class*="flair"],
            .elo-shield-anon-opponent #board-layout-player-top [class*="rating"],
            .elo-shield-anon-opponent [class*="player-top"] [class*="rating"],
            .elo-shield-anon-self #board-layout-player-bottom [class*="country"],
            .elo-shield-anon-self [class*="player-bottom"] [class*="country"],
            .elo-shield-anon-self #board-layout-player-bottom [class*="flag"],
            .elo-shield-anon-self [class*="player-bottom"] [class*="flag"],
            .elo-shield-anon-self #board-layout-player-bottom [class*="flair"],
            .elo-shield-anon-self [class*="player-bottom"] [class*="flair"],
            .elo-shield-anon-self #board-layout-player-bottom [class*="rating"],
            .elo-shield-anon-self [class*="player-bottom"] [class*="rating"] {
                display: none !important;
            }

            body.elo-guard-enhanced-focus {
                --elo-guard-clock-column-width: 190px;
                --elo-guard-material-row-height: 24px;
                --elo-guard-material-gap: 8px;
                --elo-guard-material-edge-gap: 8px;
                --elo-guard-board-size: min(calc(100vw - var(--elo-guard-clock-column-width) - var(--elo-guard-clock-column-width) - 64px), calc(100vh - 112px));
                background: #302E2B !important;
                overflow: hidden !important;
            }

            #elo-guard-enhanced-focus-toggle {
                position: fixed !important;
                top: 16px !important;
                right: 16px !important;
                z-index: 2147483647 !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 8px !important;
                min-height: 34px !important;
                padding: 0 12px !important;
                border: 1px solid rgba(255, 255, 255, 0.16) !important;
                border-radius: 999px !important;
                background: rgba(38, 37, 34, 0.9) !important;
                color: #f5f5f5 !important;
                font: 700 13px/1 Arial, sans-serif !important;
                letter-spacing: 0 !important;
                box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28) !important;
                cursor: pointer !important;
                pointer-events: auto !important;
                visibility: visible !important;
                opacity: 1 !important;
            }

            #elo-guard-enhanced-focus-toggle::before {
                content: "" !important;
                width: 9px !important;
                height: 9px !important;
                border-radius: 999px !important;
                background: #8b8b8b !important;
            }

            body.elo-guard-enhanced-focus #elo-guard-enhanced-focus-toggle::before {
                background: #81b64c !important;
            }

            body.elo-guard-enhanced-focus #elo-guard-enhanced-focus-flip {
                position: fixed !important;
                left: calc((100vw + var(--elo-guard-board-size)) / 2 + 12px) !important;
                top: calc((100vh - var(--elo-guard-board-size)) / 2) !important;
                right: auto !important;
                z-index: 2147483647 !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                min-width: 58px !important;
                min-height: 34px !important;
                padding: 0 12px !important;
                border: 1px solid rgba(255, 255, 255, 0.18) !important;
                border-radius: 999px !important;
                background: rgba(38, 37, 34, 0.92) !important;
                color: #f5f5f5 !important;
                font: 700 13px/1 Arial, sans-serif !important;
                letter-spacing: 0 !important;
                box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28) !important;
                cursor: pointer !important;
                pointer-events: auto !important;
                visibility: visible !important;
                opacity: 1 !important;
                user-select: none !important;
            }

            #elo-guard-enhanced-focus-flip[hidden] {
                display: none !important;
            }

            #elo-guard-enhanced-focus-toggle:focus-visible,
            #elo-guard-enhanced-focus-flip:focus-visible {
                outline: 2px solid #81b64c !important;
                outline-offset: 2px !important;
            }

            body.elo-guard-enhanced-focus header,
            body.elo-guard-enhanced-focus .site-header,
            body.elo-guard-enhanced-focus .navigation-component,
            body.elo-guard-enhanced-focus [class*="navigation"],
            body.elo-guard-enhanced-focus .nav-component,
            body.elo-guard-enhanced-focus .nav-menu,
            body.elo-guard-enhanced-focus .left-nav,
            body.elo-guard-enhanced-focus [class*="left-nav"],
            body.elo-guard-enhanced-focus [class*="leftNav"],
            body.elo-guard-enhanced-focus [class*="nav-sidebar"],
            body.elo-guard-enhanced-focus [data-cy*="navigation"],
            body.elo-guard-enhanced-focus .sidebar-component,
            body.elo-guard-enhanced-focus #board-layout-sidebar,
            body.elo-guard-enhanced-focus .board-layout-sidebar,
            body.elo-guard-enhanced-focus .game-controls,
            body.elo-guard-enhanced-focus [class*="game-controls"],
            body.elo-guard-enhanced-focus [class*="move-list"],
            body.elo-guard-enhanced-focus [class*="moves-list"],
            body.elo-guard-enhanced-focus [class*="analysis-sidebar"],
            body.elo-guard-enhanced-focus [class*="game-review"],
            body.elo-guard-enhanced-focus [data-cy*="game-review"],
            body.elo-guard-enhanced-focus [class*="board-controls"],
            body.elo-guard-enhanced-focus [class*="board-buttons"],
            body.elo-guard-enhanced-focus [class*="game-buttons"],
            body.elo-guard-enhanced-focus [class*="share"],
            body.elo-guard-enhanced-focus [class*="social"],
            body.elo-guard-enhanced-focus [class*="tabs"],
            body.elo-guard-enhanced-focus [class*="ad-"],
            body.elo-guard-enhanced-focus [class*="-ad"],
            body.elo-guard-enhanced-focus [id*="ad-"],
            body.elo-guard-enhanced-focus [id*="-ad"],
            body.elo-guard-enhanced-focus [class*="coordinate"] {
                display: none !important;
            }

            body.elo-guard-enhanced-focus #board-layout-main,
            body.elo-guard-enhanced-focus .board-layout-main {
                position: fixed !important;
                inset: 24px !important;
                width: auto !important;
                height: auto !important;
                max-width: none !important;
                max-height: none !important;
                margin: 0 !important;
                padding: 0 !important;
                display: grid !important;
                grid-template-columns: minmax(0, 1fr) !important;
                grid-template-rows: minmax(32px, auto) var(--elo-guard-board-size) minmax(32px, auto) !important;
                align-content: center !important;
                align-items: center !important;
                justify-items: center !important;
                gap: 8px !important;
                z-index: 2147483000 !important;
                background: #302E2B !important;
            }

            body.elo-guard-enhanced-focus #board-layout-player-top,
            body.elo-guard-enhanced-focus .board-layout-player-top,
            body.elo-guard-enhanced-focus #board-layout-player-bottom,
            body.elo-guard-enhanced-focus .board-layout-player-bottom {
                width: var(--elo-guard-clock-column-width) !important;
                max-width: var(--elo-guard-clock-column-width) !important;
                min-height: 32px !important;
                height: auto !important;
                margin: 0 !important;
                padding: 0 !important;
                position: relative !important;
                inset: auto !important;
                transform: none !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                visibility: visible !important;
                opacity: 1 !important;
                z-index: 2147483602 !important;
                background: transparent !important;
                border: 0 !important;
                box-shadow: none !important;
                overflow: visible !important;
                pointer-events: none !important;
            }

            body.elo-guard-enhanced-focus #board-layout-player-top,
            body.elo-guard-enhanced-focus .board-layout-player-top {
                grid-row: 1 !important;
            }

            body.elo-guard-enhanced-focus #board-layout-player-bottom,
            body.elo-guard-enhanced-focus .board-layout-player-bottom {
                grid-row: 3 !important;
            }

            body.elo-guard-enhanced-focus #board-layout-chessboard,
            body.elo-guard-enhanced-focus .board-layout-chessboard,
            body.elo-guard-enhanced-focus [class*="board-layout-chessboard"],
            body.elo-guard-enhanced-focus [class*="board-layout-board"],
            body.elo-guard-enhanced-focus .elo-guard-enhanced-focus-board,
            body.elo-guard-enhanced-focus #board-single,
            body.elo-guard-enhanced-focus wc-chess-board,
            body.elo-guard-enhanced-focus chess-board,
            body.elo-guard-enhanced-focus cg-board {
                grid-row: 2 !important;
                width: var(--elo-guard-board-size) !important;
                height: var(--elo-guard-board-size) !important;
                max-width: calc(100vw - 72px) !important;
                max-height: calc(100vh - 32px) !important;
                aspect-ratio: 1 / 1 !important;
                margin: 0 !important;
                justify-self: center !important;
                align-self: center !important;
            }

            body.elo-guard-enhanced-focus #board-layout-player-top .player-playerContent,
            body.elo-guard-enhanced-focus .board-layout-player-top .player-playerContent,
            body.elo-guard-enhanced-focus #board-layout-player-bottom .player-playerContent,
            body.elo-guard-enhanced-focus .board-layout-player-bottom .player-playerContent {
                width: 0 !important;
                min-width: 0 !important;
                max-width: 0 !important;
                min-height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: hidden !important;
            }

            body.elo-guard-enhanced-focus #board-layout-player-top .player-avatar,
            body.elo-guard-enhanced-focus .board-layout-player-top .player-avatar,
            body.elo-guard-enhanced-focus #board-layout-player-top .player-avatar-component,
            body.elo-guard-enhanced-focus .board-layout-player-top .player-avatar-component,
            body.elo-guard-enhanced-focus #board-layout-player-top .cc-avatar-component,
            body.elo-guard-enhanced-focus .board-layout-player-top .cc-avatar-component,
            body.elo-guard-enhanced-focus #board-layout-player-top .cc-avatar-img,
            body.elo-guard-enhanced-focus .board-layout-player-top .cc-avatar-img,
            body.elo-guard-enhanced-focus #board-layout-player-top [data-cy*="avatar"],
            body.elo-guard-enhanced-focus .board-layout-player-top [data-cy*="avatar"],
            body.elo-guard-enhanced-focus #board-layout-player-top [class*="avatar"],
            body.elo-guard-enhanced-focus .board-layout-player-top [class*="avatar"],
            body.elo-guard-enhanced-focus #board-layout-player-top img,
            body.elo-guard-enhanced-focus .board-layout-player-top img,
            body.elo-guard-enhanced-focus #board-layout-player-bottom .player-avatar,
            body.elo-guard-enhanced-focus .board-layout-player-bottom .player-avatar,
            body.elo-guard-enhanced-focus #board-layout-player-bottom .player-avatar-component,
            body.elo-guard-enhanced-focus .board-layout-player-bottom .player-avatar-component,
            body.elo-guard-enhanced-focus #board-layout-player-bottom .cc-avatar-component,
            body.elo-guard-enhanced-focus .board-layout-player-bottom .cc-avatar-component,
            body.elo-guard-enhanced-focus #board-layout-player-bottom .cc-avatar-img,
            body.elo-guard-enhanced-focus .board-layout-player-bottom .cc-avatar-img,
            body.elo-guard-enhanced-focus #board-layout-player-bottom [data-cy*="avatar"],
            body.elo-guard-enhanced-focus .board-layout-player-bottom [data-cy*="avatar"],
            body.elo-guard-enhanced-focus #board-layout-player-bottom [class*="avatar"],
            body.elo-guard-enhanced-focus .board-layout-player-bottom [class*="avatar"],
            body.elo-guard-enhanced-focus #board-layout-player-top [class*="profile"],
            body.elo-guard-enhanced-focus .board-layout-player-top [class*="profile"],
            body.elo-guard-enhanced-focus #board-layout-player-top [class*="user-image"],
            body.elo-guard-enhanced-focus .board-layout-player-top [class*="user-image"],
            body.elo-guard-enhanced-focus #board-layout-player-bottom [class*="profile"],
            body.elo-guard-enhanced-focus .board-layout-player-bottom [class*="profile"],
            body.elo-guard-enhanced-focus #board-layout-player-bottom [class*="user-image"],
            body.elo-guard-enhanced-focus .board-layout-player-bottom [class*="user-image"],
            body.elo-guard-enhanced-focus #board-layout-player-bottom img,
            body.elo-guard-enhanced-focus .board-layout-player-bottom img {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
            }

            body.elo-guard-enhanced-focus .clock-component,
            body.elo-guard-enhanced-focus [class*="clock-component"],
            body.elo-guard-enhanced-focus [data-cy*="clock"] {
                visibility: hidden !important;
                opacity: 0 !important;
                z-index: 2147483200 !important;
                pointer-events: none !important;
            }

            body.elo-guard-enhanced-focus #board-layout-chessboard,
            body.elo-guard-enhanced-focus .board-layout-chessboard,
            body.elo-guard-enhanced-focus [class*="board-layout-chessboard"],
            body.elo-guard-enhanced-focus [class*="board-layout-board"],
            body.elo-guard-enhanced-focus .elo-guard-enhanced-focus-board,
            body.elo-guard-enhanced-focus #board-single,
            body.elo-guard-enhanced-focus wc-chess-board,
            body.elo-guard-enhanced-focus chess-board,
            body.elo-guard-enhanced-focus cg-board {
                position: fixed !important;
                left: 50% !important;
                top: 50% !important;
                transform: translate(-50%, -50%) !important;
                z-index: 2147483050 !important;
            }

            body.elo-guard-enhanced-focus .elo-guard-enhanced-focus-clock-top,
            body.elo-guard-enhanced-focus .elo-guard-enhanced-focus-clock-bottom {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
            }

            body.elo-guard-enhanced-focus .elo-guard-enhanced-focus-clock-top {
                top: calc((100vh - var(--elo-guard-board-size)) / 2) !important;
                bottom: auto !important;
            }

            body.elo-guard-enhanced-focus .elo-guard-enhanced-focus-clock-bottom {
                top: auto !important;
                bottom: calc((100vh - var(--elo-guard-board-size)) / 2) !important;
            }

            body.elo-guard-enhanced-focus #board-layout-player-top,
            body.elo-guard-enhanced-focus .board-layout-player-top {
                position: fixed !important;
                left: calc((100vw - var(--elo-guard-board-size)) / 2 - var(--elo-guard-clock-column-width) - 12px) !important;
                top: calc((100vh - var(--elo-guard-board-size)) / 2) !important;
                width: var(--elo-guard-clock-column-width) !important;
                bottom: auto !important;
                transform: none !important;
            }

            body.elo-guard-enhanced-focus #board-layout-player-bottom,
            body.elo-guard-enhanced-focus .board-layout-player-bottom {
                position: fixed !important;
                left: calc((100vw - var(--elo-guard-board-size)) / 2 - var(--elo-guard-clock-column-width) - 12px) !important;
                width: var(--elo-guard-clock-column-width) !important;
                top: auto !important;
                bottom: calc((100vh - var(--elo-guard-board-size)) / 2) !important;
                transform: none !important;
                border: 0 !important;
                background: transparent !important;
                box-shadow: none !important;
                overflow: visible !important;
            }

            body.elo-guard-enhanced-focus.elo-guard-enhanced-focus-ready > *:not(#elo-guard-enhanced-focus-stage):not(script):not(style):not(link) {
                visibility: hidden !important;
                pointer-events: none !important;
            }

            body.elo-guard-enhanced-focus #elo-guard-enhanced-focus-stage {
                position: fixed !important;
                inset: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                z-index: 2147482500 !important;
                display: grid !important;
                grid-template-columns: var(--elo-guard-board-size) !important;
                grid-template-rows: var(--elo-guard-board-size) !important;
                align-content: center !important;
                justify-content: center !important;
                justify-items: stretch !important;
                align-items: center !important;
                column-gap: 12px !important;
                row-gap: 0 !important;
                background: #302E2B !important;
                visibility: visible !important;
                pointer-events: none !important;
            }

            body.elo-guard-enhanced-focus .elo-guard-enhanced-focus-top-slot,
            body.elo-guard-enhanced-focus .elo-guard-enhanced-focus-bottom-slot {
                position: fixed !important;
                left: calc((100vw - var(--elo-guard-board-size)) / 2 - var(--elo-guard-clock-column-width) - 12px) !important;
                width: var(--elo-guard-clock-column-width) !important;
                min-width: var(--elo-guard-clock-column-width) !important;
                max-width: var(--elo-guard-clock-column-width) !important;
                height: 56px !important;
                min-height: 56px !important;
                max-height: 56px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                visibility: visible !important;
                opacity: 1 !important;
                pointer-events: none !important;
                z-index: 2147483603 !important;
            }

            body.elo-guard-enhanced-focus .elo-guard-enhanced-focus-top-slot {
                top: calc((100vh - var(--elo-guard-board-size)) / 2) !important;
                bottom: auto !important;
            }

            body.elo-guard-enhanced-focus .elo-guard-enhanced-focus-bottom-slot {
                top: auto !important;
                bottom: calc((100vh - var(--elo-guard-board-size)) / 2) !important;
            }

            body.elo-guard-enhanced-focus .elo-guard-focus-timebox {
                width: var(--elo-guard-clock-column-width) !important;
                min-width: var(--elo-guard-clock-column-width) !important;
                max-width: var(--elo-guard-clock-column-width) !important;
                height: 56px !important;
                min-height: 56px !important;
                max-height: 56px !important;
                box-sizing: border-box !important;
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 12px !important;
                padding: 0 16px !important;
                border: 2px solid rgba(255, 255, 255, 0.64) !important;
                border-radius: 6px !important;
                background: #262522 !important;
                color: #f7f7f7 !important;
                box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.88), 0 8px 18px rgba(0, 0, 0, 0.34) !important;
                font-family: Arial, sans-serif !important;
                font-size: 30px !important;
                font-weight: 700 !important;
                line-height: 1 !important;
                letter-spacing: 0 !important;
                font-variant-numeric: tabular-nums !important;
                visibility: visible !important;
                opacity: 1 !important;
                pointer-events: none !important;
                overflow: hidden !important;
                transition: none !important;
                animation: none !important;
            }

            body.elo-guard-enhanced-focus .elo-guard-focus-timebox[data-active="true"] {
                background: #f7f7f7 !important;
                color: #262522 !important;
                border-color: #ffffff !important;
                box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.88), 0 8px 18px rgba(0, 0, 0, 0.36) !important;
            }

            body.elo-guard-enhanced-focus .elo-guard-focus-timebox-icon {
                position: relative !important;
                flex: 0 0 22px !important;
                width: 22px !important;
                height: 22px !important;
                box-sizing: border-box !important;
                border: 3px solid currentColor !important;
                border-radius: 999px !important;
                opacity: 0.96 !important;
            }

            body.elo-guard-enhanced-focus .elo-guard-focus-timebox-icon::before {
                content: "" !important;
                position: absolute !important;
                left: 8px !important;
                top: 4px !important;
                width: 3px !important;
                height: 8px !important;
                background: currentColor !important;
                border-radius: 999px !important;
            }

            body.elo-guard-enhanced-focus .elo-guard-focus-timebox-icon::after {
                content: "" !important;
                position: absolute !important;
                left: 9px !important;
                top: 9px !important;
                width: 7px !important;
                height: 3px !important;
                background: currentColor !important;
                border-radius: 999px !important;
            }

            body.elo-guard-enhanced-focus .elo-guard-focus-timebox-text {
                display: block !important;
                flex: 1 1 auto !important;
                min-width: 0 !important;
                text-align: right !important;
                white-space: nowrap !important;
                overflow: hidden !important;
                text-overflow: clip !important;
            }

            body.elo-guard-enhanced-focus .elo-guard-focus-clock-mirror {
                width: var(--elo-guard-clock-column-width) !important;
                min-width: var(--elo-guard-clock-column-width) !important;
                max-width: var(--elo-guard-clock-column-width) !important;
                height: 56px !important;
                min-height: 56px !important;
                max-height: 56px !important;
                box-sizing: border-box !important;
                display: flex !important;
                align-items: stretch !important;
                justify-content: stretch !important;
                visibility: visible !important;
                opacity: 1 !important;
                overflow: hidden !important;
                pointer-events: none !important;
            }

            body.elo-guard-enhanced-focus .elo-guard-focus-clock-mirror > * {
                position: relative !important;
                inset: auto !important;
                transform: none !important;
                display: flex !important;
                visibility: visible !important;
                opacity: 1 !important;
                width: 100% !important;
                min-width: 100% !important;
                max-width: 100% !important;
                height: 56px !important;
                min-height: 56px !important;
                max-height: 56px !important;
                margin: 0 !important;
                box-sizing: border-box !important;
            }

            body.elo-guard-enhanced-focus #elo-guard-enhanced-focus-stage .elo-guard-focus-clock-mirror .clock-component,
            body.elo-guard-enhanced-focus #elo-guard-enhanced-focus-stage .elo-guard-focus-clock-mirror [class*="clock-component"],
            body.elo-guard-enhanced-focus #elo-guard-enhanced-focus-stage .elo-guard-focus-clock-mirror [data-cy*="clock"] {
                visibility: visible !important;
                opacity: 1 !important;
                pointer-events: none !important;
            }

            body.elo-guard-enhanced-focus .elo-guard-enhanced-focus-material-slot {
                position: fixed !important;
                left: 50% !important;
                width: var(--elo-guard-board-size) !important;
                min-height: var(--elo-guard-material-row-height) !important;
                height: auto !important;
                max-height: none !important;
                transform: translateX(-50%) !important;
                display: flex !important;
                align-items: flex-start !important;
                justify-content: flex-start !important;
                gap: 0 !important;
                visibility: visible !important;
                opacity: 1 !important;
                overflow: visible !important;
                contain: none !important;
                pointer-events: none !important;
                z-index: 2147483646 !important;
            }

            body.elo-guard-enhanced-focus .elo-guard-enhanced-focus-material-slot[hidden] {
                display: none !important;
            }

            body.elo-guard-enhanced-focus .elo-guard-enhanced-focus-material-top-slot {
                top: max(var(--elo-guard-material-edge-gap), calc((100vh - var(--elo-guard-board-size)) / 2 - var(--elo-guard-material-row-height) - var(--elo-guard-material-gap))) !important;
            }

            body.elo-guard-enhanced-focus .elo-guard-enhanced-focus-material-bottom-slot {
                top: auto !important;
                bottom: max(var(--elo-guard-material-edge-gap), calc((100vh - var(--elo-guard-board-size)) / 2 - var(--elo-guard-material-row-height) - var(--elo-guard-material-gap))) !important;
            }

            body.elo-guard-enhanced-focus .elo-guard-enhanced-focus-material {
                display: inline-flex !important;
                align-items: center !important;
                justify-content: flex-start !important;
                visibility: visible !important;
                opacity: 1 !important;
                width: auto !important;
                min-width: 0 !important;
                max-width: none !important;
                height: auto !important;
                min-height: var(--elo-guard-material-row-height) !important;
                max-height: none !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: visible !important;
                contain: none !important;
                white-space: nowrap !important;
                flex-wrap: nowrap !important;
                letter-spacing: 0 !important;
            }

            body.elo-guard-enhanced-focus .elo-guard-enhanced-focus-material *,
            body.elo-guard-enhanced-focus .elo-guard-enhanced-focus-material::before,
            body.elo-guard-enhanced-focus .elo-guard-enhanced-focus-material::after {
                visibility: visible !important;
                opacity: 1 !important;
                overflow: visible !important;
                max-width: none !important;
                max-height: none !important;
                clip: auto !important;
                clip-path: none !important;
                mask-image: none !important;
                -webkit-mask-image: none !important;
            }

            body.elo-guard-enhanced-focus .elo-guard-enhanced-focus-board-slot {
                grid-column: 1 !important;
                grid-row: 1 !important;
                width: var(--elo-guard-board-size) !important;
                height: var(--elo-guard-board-size) !important;
                display: block !important;
                visibility: visible !important;
                pointer-events: auto !important;
            }

            body.elo-guard-enhanced-focus #elo-guard-enhanced-focus-stage .elo-guard-enhanced-focus-board {
                position: relative !important;
                inset: auto !important;
                left: auto !important;
                top: auto !important;
                right: auto !important;
                bottom: auto !important;
                transform: none !important;
                width: 100% !important;
                height: 100% !important;
                max-width: none !important;
                max-height: none !important;
                aspect-ratio: 1 / 1 !important;
                margin: 0 !important;
                display: block !important;
                visibility: visible !important;
            }

            body.elo-guard-enhanced-focus.elo-guard-enhanced-focus-visual-flipped #elo-guard-enhanced-focus-stage .elo-guard-enhanced-focus-board {
                rotate: 180deg !important;
            }

            body.elo-guard-enhanced-focus.elo-guard-enhanced-focus-visual-flipped #elo-guard-enhanced-focus-stage .elo-guard-enhanced-focus-board piece,
            body.elo-guard-enhanced-focus.elo-guard-enhanced-focus-visual-flipped #elo-guard-enhanced-focus-stage .elo-guard-enhanced-focus-board .piece,
            body.elo-guard-enhanced-focus.elo-guard-enhanced-focus-visual-flipped #elo-guard-enhanced-focus-stage .elo-guard-enhanced-focus-board [class*="piece"] {
                rotate: 180deg !important;
            }

        `;

        document.body.classList.toggle('elo-guard-enhanced-focus', Boolean(enhancedFocusEnabled));
        document.body.classList.toggle('elo-shield-anon-opponent', Boolean(opponentEnabled || enhancedFocusEnabled));
        document.body.classList.toggle('elo-shield-anon-self', Boolean(selfEnabled || enhancedFocusEnabled));
        document.body.classList.toggle('elo-guard-hide-risk-profile-pill', !showRiskProfilePillEnabled);

        const riskProfilePill = document.getElementById('elo-guard-legitimacy-badge');
        if (riskProfilePill && !showRiskProfilePillEnabled) riskProfilePill.hidden = true;
    }
});
