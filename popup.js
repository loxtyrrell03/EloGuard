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
    // CHEAT RISK DETECTION — DISABLED: the #showRiskProfilePill toggle is commented out in
    // popup.html, so this element ref (and every use of it below) is disabled. Restore to re-enable.
    // const showRiskProfilePillToggle = document.getElementById('showRiskProfilePill');
    const upgradeBtn = document.getElementById('upgradeBtn');
    const refreshProBtn = document.getElementById('refreshProBtn');
    const proSection = document.getElementById('proSection');
    const proUsageHint = document.getElementById('proUsageHint');
    const billingCard = document.getElementById('billingCard');
    const billingPlanLabel = document.getElementById('billingPlanLabel');
    const billingStatusLabel = document.getElementById('billingStatusLabel');
    const billingManageBtn = document.getElementById('billingManageBtn');
    const billingCancelBtn = document.getElementById('billingCancelBtn');
    const billingRefreshBtn = document.getElementById('billingRefreshBtn');
    const billingMessage = document.getElementById('billingMessage');
    const billingRestoreToggle = document.getElementById('billingRestoreToggle');
    const billingRestoreRow = document.getElementById('billingRestoreRow');
    const billingRestoreEmail = document.getElementById('billingRestoreEmail');
    const billingRestoreBtn = document.getElementById('billingRestoreBtn');
    const billingRestoreCodeRow = document.getElementById('billingRestoreCodeRow');
    const billingRestoreCode = document.getElementById('billingRestoreCode');
    const billingRestoreVerifyBtn = document.getElementById('billingRestoreVerifyBtn');
    const proFeatureBtns = document.querySelectorAll('.pro-feature');
    const SMART_BRACKET_FEATURE = 'smartBracket';
    const STATS_FEATURE = 'stats';
    const PRO_FEATURE_LABELS = {
        // CHEAT RISK DETECTION — DISABLED: label kept for reactivation. The riskProfile Pro row is
        // commented out in popup.html, so this entry is currently unused. Restore to re-enable.
        // riskProfile: { free: 'Cheat risk detection', pro: 'Unlimited cheat risk detection' },
        gameReview: { free: 'Unlimited game reviews', pro: 'Unlimited game reviews' },
        stats: { free: 'Stats & rating trends', pro: 'Stats & rating trends' },
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
    const homeConnectionForm = document.getElementById('homeConnectionForm');
    const homeUsernameInput = document.getElementById('homeUsername');
    const homeConnectBtn = document.getElementById('homeConnectBtn');
    const homeUsernameEditBtn = document.getElementById('homeUsernameEditBtn');
    const stopLossInput = document.getElementById('stopLoss');
    const targetRatingInput = document.getElementById('targetRating');
    const lossStreakInput = document.getElementById('lossStreakLimit');
    const lockoutDurationInput = document.getElementById('lockoutDuration');
    const smartBracketGroup = document.querySelector('.smart-bracket-group');

    // Smart bracket settings entry + two-step setup flow
    const smartSetupBtn = document.getElementById('smartSetupBtn');
    const smartBracketSettingsToggle = document.getElementById('smartBracketSettingsToggle');
    const smartSetupView = document.getElementById('smartSetupView');
    const sbStep1 = document.getElementById('sbStep1');
    const sbStep2 = document.getElementById('sbStep2');
    const sbFlowBackBtn = document.getElementById('sbFlowBackBtn');
    const sbStepLabel = document.getElementById('sbStepLabel');
    const sbGoalInput = document.getElementById('sbGoalInput');
    const sbGoalClearBtn = document.getElementById('sbGoalClearBtn');
    const sbGoalLabel = document.getElementById('sbGoalLabel');
    const sbTrailingToggle = document.getElementById('sbTrailingToggle');
    const sbFallbackRange = document.getElementById('sbFallbackRange');
    const sbPreviewBtn = document.getElementById('sbPreviewBtn');
    const sbApplyBtn = document.getElementById('sbApplyBtn');
    const sbAdjustBtn = document.getElementById('sbAdjustBtn');
    const sbPreviewLoading = document.getElementById('sbPreviewLoading');
    const sbPreviewResult = document.getElementById('sbPreviewResult');
    const sbPreviewError = document.getElementById('sbPreviewError');
    const sbPreviewActions = document.getElementById('sbPreviewActions');
    const sbPreviewTitle = document.getElementById('sbPreviewTitle');
    const sbDotPrev = document.getElementById('sbDotPrev');
    const sbYouPrev = document.getElementById('sbYouPrev');
    const sbFloorValPrev = document.getElementById('sbFloorValPrev');
    const sbCeilValPrev = document.getElementById('sbCeilValPrev');
    const sbLongTermGoalPrev = document.getElementById('sbLongTermGoalPrev');
    const sbPerformancePrev = document.getElementById('sbPerformancePrev');
    const sbPerformanceValPrev = document.getElementById('sbPerformanceValPrev');
    const sbPerformanceDeltaPrev = document.getElementById('sbPerformanceDeltaPrev');
    const sbReasonsPrev = document.getElementById('sbReasonsPrev');
    const sbSaveBtn = document.getElementById('sbSaveBtn');
    const sbHowBtn = document.getElementById('sbHowBtn');
    const sbHowView = document.getElementById('sbHowView');
    const sbHowBackBtn = document.getElementById('sbHowBackBtn');

    // Home-view smart bracket insight card
    const smartBracketCard = document.getElementById('smartBracketCard');
    const smartBracketToggle = document.getElementById('smartBracketToggle');
    const sbOffNote = document.getElementById('sbOffNote');
    const sbRefreshBtn = document.getElementById('sbRefreshBtn');
    const sbDot = document.getElementById('sbDot');
    const sbYou = document.getElementById('sbYou');
    const sbFloorVal = document.getElementById('sbFloorVal');
    const sbCeilVal = document.getElementById('sbCeilVal');
    const sbLongTermGoal = document.getElementById('sbLongTermGoal');
    const sbPerformance = document.getElementById('sbPerformance');
    const sbPerformanceVal = document.getElementById('sbPerformanceVal');
    const sbPerformanceDelta = document.getElementById('sbPerformanceDelta');
    const sbReasons = document.getElementById('sbReasons');
    const sbProOverlay = document.getElementById('sbProOverlay');
    const sbUpgradeBtn = document.getElementById('sbUpgradeBtn');
    const SMART_CACHE_TTL_MS = 30 * 60 * 1000;

    // Stats view (in-popup SWB-TPR performance)
    const statsView = document.getElementById('statsView');
    const stxProOverlay = document.getElementById('stxProOverlay');
    const stxUpgradeBtn = document.getElementById('stxUpgradeBtn');
    const stxBackBtn = document.getElementById('stxBackBtn');
    const stxMode = document.getElementById('stxMode');
    const stxRated = document.getElementById('stxRated');
    const stxPeriod = document.getElementById('stxPeriod');
    const stxStatus = document.getElementById('stxStatus');
    const stxStatusText = document.getElementById('stxStatusText');
    const stxRetryBtn = document.getElementById('stxRetryBtn');
    const stxBody = document.getElementById('stxBody');
    const stxPerfHero = document.getElementById('stxPerfHero');
    const stxPerfChart = document.getElementById('stxPerfChart');
    const stxPerfRange = document.getElementById('stxPerfRange');
    const stxPerfEmpty = document.getElementById('stxPerfEmpty');
    const stxPerfDelta = document.getElementById('stxPerfDelta');
    const stxRatingHero = document.getElementById('stxRatingHero');
    const stxRatingChart = document.getElementById('stxRatingChart');
    const stxRatingNote = document.getElementById('stxRatingNote');
    const stxRatingDelta = document.getElementById('stxRatingDelta');
    const stxWins = document.getElementById('stxWins');
    const stxDraws = document.getElementById('stxDraws');
    const stxLosses = document.getElementById('stxLosses');
    const stxGames = document.getElementById('stxGames');

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
    let fetchedRatings = {};
    let isRatingHidden = false;
    let activeMode = "blitz"; // Default
    let currentEntitlement = null;

    // Smart bracket setup-flow preview state
    let previewState = null;   // 'loading' | 'ready' | 'error'
    let previewResult = null;
    let previewMode = null;
    // Set when the settings toggle was flipped on for a mode with no bracket yet:
    // the setup flow opens, and only Apply arms the feature (back-out reverts).
    let pendingAutoEnable = false;

    // 1. LOAD SAVED STATE
    chrome.storage.sync.get(null, (data) => {
        currentState = data;
        
        if (data.username) {
            usernameInput.value = data.username;
            homeUsernameInput.value = data.username;
        }
        if (data.hideRatings) zenToggle.checked = data.hideRatings;
        if (data.anonymizeOpponent) anonymizeOpponentToggle.checked = data.anonymizeOpponent;
        if (data.anonymizeSelf) anonymizeSelfToggle.checked = data.anonymizeSelf;
        if (data.enhancedFocusMode) enhancedFocusToggle.checked = data.enhancedFocusMode;
        // Smart bracket master toggle: undefined means on (back-compat for existing Pro users).
        if (smartBracketToggle) smartBracketToggle.checked = data.smartBracketEnabled !== false;
        // CHEAT RISK DETECTION — DISABLED: toggle removed from popup.html.
        // showRiskProfilePillToggle.checked = data.showRiskProfilePill !== false;
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
            randomStringLength = clampRandomStringLength(data.randomStringLength);
            randomStringLengthInput.value = randomStringLength;
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
        
        if (data.username) {
            checkConnection();
        } else {
            const statusText = document.getElementById('connectionStatus');
            if (statusText) {
                statusText.innerText = 'Connect your Chess.com username';
                statusText.style.color = '';
            }
            showHomeConnectionForm();
        }
    });

    // 2. USERNAME INPUT LOGIC (NEW)
    // Trigger on "Enter" key
    usernameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            checkConnection({ triggerBtn: connectBtn });
        }
    });

    // Trigger on "Connect" button click
    connectBtn.addEventListener('click', () => {
        checkConnection({ triggerBtn: connectBtn });
    });

    homeUsernameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') connectUsernameFromHome();
    });

    homeConnectBtn.addEventListener('click', connectUsernameFromHome);

    homeUsernameEditBtn.addEventListener('click', () => {
        showHomeConnectionForm({ focus: true });
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
        // Stash any unsaved edits under the outgoing mode's keys (in-memory
        // only — they persist on Save) so peeking at another mode's stats
        // doesn't silently discard what the user typed.
        currentState[`stopLoss_${activeMode}`] = stopLossInput.value;
        currentState[`targetRating_${activeMode}`] = targetRatingInput.value;
        currentState[`lossStreak_${activeMode}`] = lossStreakInput.value;

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
        refreshEntryUi();
        if (smartSetupView && !smartSetupView.classList.contains('hidden')) {
            loadStep1ForMode(mode);
            showSmartStep(1);
        }

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
    activateBtn.addEventListener('click', async () => {
        const isCurrentlyActive = activateBtn.classList.contains('active-green');

        if (isCurrentlyActive && randomStringUnlockEnabled) {
            // Show unlock UI when trying to deactivate with random string enabled
            showUnlockUI();
        } else {
            const newState = !isCurrentlyActive;
            if (newState) {
                // Guard activation starts a new session. Refresh the Smart Bracket now,
                // then freeze that target for the lifetime of the active session.
                activateBtn.disabled = true;
                activateBtn.innerText = 'PREPARING BRACKET...';
                try {
                    await prepareSmartBracketForSession();
                } finally {
                    clearGoalExtensionForMode(activeMode);
                    activateBtn.disabled = false;
                }
            }
            currentState.guardActive = newState;
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

    // Clamp to the input's min/max — a typed negative or huge value would
    // otherwise crash generateRandomString (new Uint32Array(-5) throws).
    function clampRandomStringLength(value) {
        const parsed = parseInt(value);
        if (!parsed || Number.isNaN(parsed)) return 10;
        return Math.min(100, Math.max(5, parsed));
    }

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
        currentUnlockString = generateRandomString(clampRandomStringLength(randomStringLength));
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
            currentState.guardActive = false;
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

    // CHEAT RISK DETECTION — DISABLED: toggle removed from popup.html; change listener disabled.

    // Smart bracket master on/off. Off stops all recomputation but leaves the saved
    // floor/ceiling untouched. Does not gate content.js, so no tab refresh needed.
    // The home-card switch and the settings-row switch mirror the same state.
    smartBracketToggle?.addEventListener('change', () => {
        setSmartBracketEnabled(smartBracketToggle.checked);
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
        const isTrial = currentEntitlement.status === 'trialing';
        if (currentEntitlement.cancelAtPeriodEnd) {
            setBillingMessage(isTrial ? 'Trial is already cancelled.' : 'Renewal is already cancelled.');
            return;
        }

        const dateText = currentEntitlement.currentPeriodEnd
            ? ` You will keep Pro until ${new Date(currentEntitlement.currentPeriodEnd).toLocaleDateString()}.`
            : '';
        const ok = window.confirm(`${isTrial ? 'Cancel EloGuard Pro trial?' : 'Cancel EloGuard Pro renewal?'}${dateText}`);
        if (!ok) return;

        billingCancelBtn.disabled = true;
        billingCancelBtn.textContent = 'Cancelling...';
        setBillingMessage('');
        try {
            const result = await api.cancelRenewal();
            currentEntitlement = result.entitlement;
            applyEntitlementState(api.isProEntitlement(currentEntitlement), billingHintForEntitlement(currentEntitlement));
            setBillingMessage(result.message || (isTrial
                ? 'Trial cancelled. You keep Pro until the trial ends and will not be charged.'
                : 'Renewal cancelled. You keep Pro until the period ends.'));
            await refreshEntitlementUi(true);
        } catch (e) {
            setBillingMessage(e instanceof Error ? e.message : 'Could not cancel renewal. Try Manage subscription.', true);
            updateBillingCard(currentEntitlement);
        }
    });

    // Restore is two-step: "Send code" emails a one-time code to the checkout
    // address, "Verify" exchanges it for the entitlement. The email row stays
    // visible after sending so the user can fix a typo or resend.
    function hideRestoreRows() {
        if (billingRestoreRow) billingRestoreRow.hidden = true;
        if (billingRestoreCodeRow) billingRestoreCodeRow.hidden = true;
        billingRestoreToggle?.setAttribute('aria-expanded', 'false');
        if (billingRestoreCode) billingRestoreCode.value = '';
        if (billingRestoreBtn) billingRestoreBtn.textContent = 'Send code';
    }

    function restoreErrorMessage(reason) {
        switch (reason) {
            case 'not_found':
                return 'No Pro purchase found for that email. Check for typos, or contact support.';
            case 'rate_limited':
                return 'Too many attempts — wait a little while, then try again.';
            case 'restore_unavailable':
            case 'send_failed':
                return 'Could not send the code right now. Try again later or contact support.';
            case 'invalid_code':
                return "That code doesn't match. Check the email and try again.";
            case 'code_expired':
                return 'That code expired. Press Send code to get a new one.';
            case 'too_many_attempts':
                return 'Too many wrong codes. Press Send code to get a new one.';
            default:
                return 'Could not reach billing — check your connection and try again.';
        }
    }

    billingRestoreToggle?.addEventListener('click', () => {
        if (!billingRestoreRow) return;
        if (billingRestoreRow.hidden) {
            billingRestoreRow.hidden = false;
            billingRestoreToggle.setAttribute('aria-expanded', 'true');
            billingRestoreEmail?.focus();
        } else {
            hideRestoreRows();
        }
    });

    billingRestoreEmail?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') billingRestoreBtn?.click();
    });

    billingRestoreCode?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') billingRestoreVerifyBtn?.click();
    });

    billingRestoreBtn?.addEventListener('click', async () => {
        const api = window.EloGuardEntitlements;
        if (!api || typeof api.restoreRequestCode !== 'function') return;

        const email = (billingRestoreEmail?.value || '').trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setBillingMessage('Enter the email you used at checkout.', true);
            billingRestoreEmail?.focus();
            return;
        }

        billingRestoreBtn.disabled = true;
        billingRestoreBtn.textContent = 'Sending...';
        setBillingMessage('');
        try {
            await api.restoreRequestCode(email);
            setBillingMessage(`Code sent to ${email} — enter it below. It expires in 10 minutes.`);
            if (billingRestoreCodeRow) billingRestoreCodeRow.hidden = false;
            if (billingRestoreCode) billingRestoreCode.value = '';
            billingRestoreCode?.focus();
            billingRestoreBtn.textContent = 'Resend';
        } catch (e) {
            const reason = e instanceof Error ? e.message : 'network';
            setBillingMessage(restoreErrorMessage(reason), true);
            billingRestoreBtn.textContent = 'Send code';
        } finally {
            billingRestoreBtn.disabled = false;
        }
    });

    billingRestoreVerifyBtn?.addEventListener('click', async () => {
        const api = window.EloGuardEntitlements;
        if (!api || typeof api.restoreVerifyCode !== 'function') return;

        const email = (billingRestoreEmail?.value || '').trim();
        const code = (billingRestoreCode?.value || '').trim();
        if (!/^\d{6}$/.test(code)) {
            setBillingMessage('Enter the 6-digit code from your email.', true);
            billingRestoreCode?.focus();
            return;
        }

        billingRestoreVerifyBtn.disabled = true;
        billingRestoreVerifyBtn.textContent = 'Verifying...';
        setBillingMessage('');
        try {
            await api.restoreVerifyCode(email, code);
            setBillingMessage('Pro restored on this device. Welcome back!');
            hideRestoreRows();
            await refreshEntitlementUi(false);
            refreshActiveChessTab();
        } catch (e) {
            const reason = e instanceof Error ? e.message : 'network';
            setBillingMessage(restoreErrorMessage(reason), true);
            billingRestoreCode?.focus();
        } finally {
            billingRestoreVerifyBtn.disabled = false;
            billingRestoreVerifyBtn.textContent = 'Verify';
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

    // 6. SMART BRACKET (performance-aware auto-set) — home card ↻ + two-step setup flow
    // The home card's ↻ recomputes and applies; the settings entry opens the setup flow.
    sbRefreshBtn?.addEventListener('click', () => {
        runSmartBracket({ trigger: 'refresh' });
    });

    // Free-tier sample overlay CTA on the home card.
    sbUpgradeBtn?.addEventListener('click', () => {
        openBillingForFeature(SMART_BRACKET_FEATURE);
    });

    // Settings entry row gear → open the setup flow (free users hit the paywall).
    smartSetupBtn?.addEventListener('click', () => {
        if (!isProActive()) {
            openBillingForFeature(SMART_BRACKET_FEATURE);
            return;
        }
        openSmartSetup();
    });

    // Settings entry row switch. ON with a bracket already set up re-arms and refreshes;
    // ON with nothing set up opens the flow, and only Apply arms it. OFF just disarms.
    smartBracketSettingsToggle?.addEventListener('change', () => {
        if (!isProActive()) {
            smartBracketSettingsToggle.checked = false;
            openBillingForFeature(SMART_BRACKET_FEATURE);
            return;
        }
        if (!smartBracketSettingsToggle.checked) {
            pendingAutoEnable = false;
            setSmartBracketEnabled(false);
            return;
        }
        isModeConfigured(activeMode, (configured) => {
            if (configured) {
                setSmartBracketEnabled(true);
            } else {
                pendingAutoEnable = true;
                openSmartSetup();
            }
        });
    });

    sbFlowBackBtn?.addEventListener('click', () => {
        if (sbStep2 && !sbStep2.classList.contains('hidden')) {
            showSmartStep(1);
        } else {
            closeSmartSetup();
        }
    });

    // Step 1 preferences persist immediately.
    sbGoalInput?.addEventListener('change', () => {
        saveGoalForMode(activeMode, sbGoalInput.value);
        updateGoalClearVisibility();
        refreshEntryUi();
    });

    sbGoalClearBtn?.addEventListener('click', () => {
        const key = `eloGoal_${activeMode}`;
        chrome.storage.sync.remove(key);
        delete currentState[key];
        invalidateSmartBracketCache(activeMode);
        if (sbGoalInput) sbGoalInput.value = '';
        updateGoalClearVisibility();
        refreshEntryUi();
    });

    sbTrailingToggle?.addEventListener('change', () => {
        currentState.smartTrailing = sbTrailingToggle.checked;
        chrome.storage.sync.set({ smartTrailing: sbTrailingToggle.checked }, refreshActiveChessTab);
        refreshEntryUi();
    });

    sbFallbackRange?.addEventListener('change', () => {
        let range = parseInt(sbFallbackRange.value);
        if (!range || isNaN(range) || range <= 0) range = 25;
        sbFallbackRange.value = range;
        currentState.smartRange = String(range);
        chrome.storage.sync.set({ smartRange: String(range) });
        refreshEntryUi();
    });

    sbPreviewBtn?.addEventListener('click', () => {
        runPreview();
    });

    // Explicit save: flushes the current input values (covers values typed but
    // not yet blurred, which the change listeners above never see), confirms,
    // and returns to settings.
    sbSaveBtn?.addEventListener('click', () => {
        saveGoalForMode(activeMode, sbGoalInput ? sbGoalInput.value : '');
        updateGoalClearVisibility();
        let range = sbFallbackRange ? parseInt(sbFallbackRange.value) : NaN;
        if (!range || isNaN(range) || range <= 0) range = 25;
        if (sbFallbackRange) sbFallbackRange.value = range;
        currentState.smartRange = String(range);
        const trailing = sbTrailingToggle ? sbTrailingToggle.checked : true;
        currentState.smartTrailing = trailing;
        chrome.storage.sync.set({ smartRange: String(range), smartTrailing: trailing }, refreshActiveChessTab);
        refreshEntryUi();
        sbSaveBtn.textContent = '✅ Saved';
        sbSaveBtn.disabled = true;
        setTimeout(() => {
            sbSaveBtn.disabled = false;
            sbSaveBtn.textContent = 'Save';
            closeSmartSetup();
        }, 900);
    });

    sbHowBtn?.addEventListener('click', () => {
        smartSetupView?.classList.add('hidden');
        sbHowView?.classList.remove('hidden');
    });

    sbHowBackBtn?.addEventListener('click', () => {
        sbHowView?.classList.add('hidden');
        smartSetupView?.classList.remove('hidden');
    });

    // Step 2 primary button: Apply when ready, Retry when the preview errored.
    sbApplyBtn?.addEventListener('click', () => {
        if (previewState === 'error') {
            runPreview();
            return;
        }
        if (previewState !== 'ready' || !previewResult) return;
        const mode = previewMode || activeMode;
        applySmartResult(previewResult, mode);
        pendingAutoEnable = false;
        refreshEntryUi();
        sbApplyBtn.textContent = '✅ Applied';
        sbApplyBtn.disabled = true;
        const applied = previewResult;
        setTimeout(() => {
            sbApplyBtn.disabled = false;
            sbApplyBtn.textContent = 'Apply bracket';
            closeSmartSetup({ toMain: true });
            // Applying turned the feature on; reflect that on the home card.
            if (smartBracketToggle) smartBracketToggle.checked = true;
            applySmartBracketEnabledState(true);
            renderSmartBracketCard({ kind: 'ready', result: applied });
        }, 900);
    });

    sbAdjustBtn?.addEventListener('click', () => {
        showSmartStep(1);
    });

    // 7. NAVIGATION
    settingsBtn.addEventListener('click', () => {
        mainView.classList.add('hidden');
        settingsView.classList.remove('hidden');
        fetchAllStats();
    });

    // Stats button opens the in-popup performance view. The in-page Strength Profile
    // overlay (content.js) is untouched and still reachable from the review panel.
    const statsCache = {};
    let statsReqId = 0;
    const STATS_BASE_HISTORY_DAYS = 90;
    const STATS_MAX_GAMES = 50000;
    // The standard fetch covers every range through 3 months. Selecting 6 months or
    // 1 year expands that mode/filter cache once, on demand.

    statsBtn?.addEventListener('click', () => {
        openStatsView();
    });

    stxBackBtn?.addEventListener('click', () => {
        if (statsView) statsView.classList.add('hidden');
        mainView.classList.remove('hidden');
    });

    stxMode?.addEventListener('change', () => loadStats());
    stxRated?.addEventListener('change', () => loadStats());
    stxPeriod?.addEventListener('change', () => loadStats());
    stxRetryBtn?.addEventListener('click', () => loadStats({ force: true }));

    // Free-tier sample overlay CTA on the Stats view.
    stxUpgradeBtn?.addEventListener('click', () => {
        openBillingForFeature(STATS_FEATURE);
    });

    function openStatsView() {
        mainView.classList.add('hidden');
        if (statsView) statsView.classList.remove('hidden');
        if (stxMode) stxMode.value = activeMode;
        loadStats();
    }

    function showStatsStatus(text, showRetry) {
        if (stxStatus) stxStatus.classList.remove('hidden');
        if (stxStatusText) stxStatusText.textContent = text;
        if (stxRetryBtn) stxRetryBtn.classList.toggle('hidden', !showRetry);
        if (stxBody) stxBody.classList.add('hidden');
    }

    function showStatsBody() {
        if (stxStatus) stxStatus.classList.add('hidden');
        if (stxRetryBtn) stxRetryBtn.classList.add('hidden');
        if (stxBody) stxBody.classList.remove('hidden');
    }

    function getStatsPeriodValue() {
        return stxPeriod ? stxPeriod.value : '30';
    }

    function getStatsPeriodCoverageDays(period) {
        const days = parseInt(period, 10);
        return Number.isFinite(days) && days > 0 ? days : 1;
    }

    function getStatsPeriodCutoff(nowSec, period) {
        if (period === 'hour') return nowSec - 3600;
        if (period === 'today') {
            const now = new Date(nowSec * 1000);
            return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;
        }
        return nowSec - getStatsPeriodCoverageDays(period) * 86400;
    }

    // Free tier: deterministic sample games (win/draw/loss walk over ~24 days) fed
    // through the real render + SWB-TPR series pipeline, so the sample charts look
    // exactly like live output. No network, no username needed.
    function buildSampleStatsGames(nowSec) {
        const results = [
            'loss', 'win', 'win', 'loss', 'draw', 'win', 'loss', 'win', 'win', 'loss',
            'win', 'draw', 'loss', 'win', 'loss', 'win', 'win', 'loss', 'win', 'draw',
            'loss', 'win', 'win', 'loss', 'win', 'draw', 'win', 'loss', 'win', 'win'
        ];
        const oppOffsets = [-38, 24, -12, 41, 8, -27, 33, -5, 19, -44];
        let rating = 1172;
        return results.map((result, i) => {
            rating += result === 'win' ? 8 : (result === 'loss' ? -8 : 1);
            return {
                end: nowSec - (results.length - 1 - i) * 70000,
                rated: true,
                rating,
                opp: rating + oppOffsets[i % oppOffsets.length],
                result
            };
        });
    }

    function renderStatsSample() {
        if (!statsView) return;
        statsView.classList.add('stx-sample');
        if (stxProOverlay) stxProOverlay.classList.remove('hidden');
        // Pin the controls to values the sample data actually covers.
        if (stxPeriod) stxPeriod.value = '30';
        if (stxRated) stxRated.value = 'both';
        const nowSec = Math.floor(Date.now() / 1000);
        const games = buildSampleStatsGames(nowSec);
        const engine = window.EloGuardSmartBracket;
        let series = [];
        if (engine && typeof engine.computePerformanceSeries === 'function') {
            try { series = engine.computePerformanceSeries(games, { windowSize: 20 }); } catch (e) { series = []; }
        }
        renderStats({ games, series, nowSec }, stxMode ? stxMode.value : activeMode, 'both');
    }

    // No username -> connect prompt; cached selection -> instant re-render; otherwise
    // fetch. A request token guards a slow fetch from rendering after the user has
    // already switched mode/filter.
    function loadStats(opts = {}) {
        // Free tier: every entry point (open, control changes, retry) lands on the
        // dimmed sample + upgrade overlay instead of live data.
        if (!isProActive()) { renderStatsSample(); return; }
        if (statsView) statsView.classList.remove('stx-sample');
        if (stxProOverlay) stxProOverlay.classList.add('hidden');
        const username = usernameInput.value.trim();
        if (!username) { showStatsStatus('Connect your username first.', false); return; }
        const mode = stxMode ? stxMode.value : activeMode;
        const filter = stxRated ? stxRated.value : 'both';
        const key = `${username}|${mode}|${filter}`;
        const requestedDays = Math.max(STATS_BASE_HISTORY_DAYS, getStatsPeriodCoverageDays(getStatsPeriodValue()));
        const cached = statsCache[key];
        if (!opts.force && cached && cached.historyDays >= requestedDays) {
            renderStats(cached, mode, filter);
            return;
        }

        const engine = window.EloGuardSmartBracket;
        if (!engine || typeof engine.fetchRecentGames !== 'function') {
            showStatsStatus("Couldn't load games.", true);
            return;
        }
        showStatsStatus('Loading…', false);
        const reqId = ++statsReqId;
        engine.fetchRecentGames({
            username,
            timeClass: mode,
            ratedFilter: filter,
            maxGames: STATS_MAX_GAMES,
            maxDays: requestedDays,
            monthsCap: Math.ceil(requestedDays / 28) + 1
        })
            .then((games) => {
                const list = Array.isArray(games) ? games : [];
                // Compute the rolling series once per fetched coverage window. Switching
                // inside that window only filters this cache and never recomputes it.
                const nowSec = Math.floor(Date.now() / 1000);
                let series = [];
                if (engine && typeof engine.computePerformanceSeries === 'function') {
                    try {
                        const raw = engine.computePerformanceSeries(list, { windowSize: 20 });
                        if (Array.isArray(raw)) {
                            series = raw
                                .filter((pt) => pt && Number.isFinite(pt.end) && Number.isFinite(pt.perf))
                                .map((pt) => ({ end: pt.end, perf: pt.perf }));
                        }
                    } catch (e) { series = []; }
                }
                const entry = { games: list, series, nowSec, historyDays: requestedDays };
                const existing = statsCache[key];
                if (!existing || existing.historyDays <= entry.historyDays) statsCache[key] = entry;
                if (reqId !== statsReqId) return;
                renderStats(statsCache[key], mode, filter);
            })
            .catch(() => {
                if (reqId !== statsReqId) return;
                showStatsStatus("Couldn't load games.", true);
            });
    }

    // Signed change chip (K3): ASCII +/-, tabular. null/non-finite -> no chip.
    // The ASCII '-' here is intentional DATA formatting, not sentence copy.
    function setStxDelta(el, value) {
        if (!el) return;
        if (value == null || !Number.isFinite(value)) {
            el.textContent = '';
            el.classList.add('hidden');
            return;
        }
        const n = Math.round(value);
        el.textContent = n > 0 ? `+${n}` : String(n);
        let color = 'var(--eg-text-3)';
        if (n > 0) color = 'var(--eg-green-bright)';
        else if (n < 0) color = 'var(--eg-red)';
        el.style.color = color;
        el.classList.remove('hidden');
    }

    // Renders a cached entry ({ games, series, nowSec }) under the active period.
    // nowSec is the fetch-time value so the period boundary is stable across renders.
    function renderStats(entry, mode, filter) {
        showStatsBody();
        const allGames = (entry && Array.isArray(entry.games)) ? entry.games : [];
        const fullSeries = (entry && Array.isArray(entry.series)) ? entry.series : [];
        const nowSec = (entry && Number.isFinite(entry.nowSec)) ? entry.nowSec : Math.floor(Date.now() / 1000);
        const engine = window.EloGuardSmartBracket;

        // Period window (K2): keep games/series points whose end is within the selection.
        // The full-fetch series is filtered by point.end — windows still looked back past
        // the period start, so early points stay accurate.
        const cutoff = getStatsPeriodCutoff(nowSec, getStatsPeriodValue());
        const list = allGames.filter((g) => g && Number.isFinite(g.end) && g.end >= cutoff);
        const periodSeries = fullSeries.filter((pt) => pt.end >= cutoff);

        // Current rating: last rated game's post-game rating in period. If the period
        // is empty, carry forward the live rating (active mode) or the newest rated
        // game in the wider cache so the Rating card can render an unchanged baseline.
        const ratedGames = list.filter((g) => g && g.rated);
        let currentRating = ratedGames.length ? ratedGames[ratedGames.length - 1].rating : null;
        if (!Number.isFinite(currentRating)) {
            const fetchedModeRatingRaw = mode === activeMode ? currentFetchedRating : fetchedRatings[mode];
            const fetchedModeRating = fetchedModeRatingRaw == null ? NaN : Number(fetchedModeRatingRaw);
            if (Number.isFinite(fetchedModeRating)) currentRating = fetchedModeRating;
        }
        if (!Number.isFinite(currentRating)) {
            const lastKnownRating = allGames
                .filter((g) => g && g.rated && Number.isFinite(g.rating) && Number.isFinite(g.end))
                .at(-1);
            if (lastKnownRating) currentRating = lastKnownRating.rating;
        }

        // --- Performance card --- (hero recomputed on the period subset per K2)
        let performance = null;
        if (engine && typeof engine.computePerformance === 'function') {
            try {
                performance = engine.computePerformance(list, {
                    currentRating: currentRating != null ? currentRating : undefined,
                    nowSec
                });
            } catch (e) { performance = null; }
        }

        if (performance && Number.isFinite(performance.perf)) {
            if (stxPerfHero) {
                stxPerfHero.textContent = performance.perf;
                let color = 'var(--eg-text)';
                if (currentRating != null) {
                    if (performance.perf >= currentRating + 15) color = 'var(--eg-green-bright)';
                    else if (performance.perf <= currentRating - 15) color = 'var(--eg-red)';
                }
                stxPerfHero.style.color = color;
            }
            if (stxPerfRange) {
                const ci = Array.isArray(performance.ci68) ? performance.ci68 : null;
                const rangeText = (ci && ci.length === 2) ? `Likely range ${ci[0]} to ${ci[1]}` : '';
                const gameCount = Number.isFinite(performance.gamesWithOpp) ? performance.gamesWithOpp : null;
                const sampleText = gameCount == null ? '' : `${gameCount} game${gameCount === 1 ? '' : 's'}`;
                stxPerfRange.textContent = [rangeText, sampleText].filter(Boolean).join(' · ');
                stxPerfRange.classList.remove('hidden');
            }
            if (stxPerfEmpty) stxPerfEmpty.classList.add('hidden');
            if (stxPerfChart) stxPerfChart.classList.remove('hidden');
            renderStxChart(stxPerfChart, periodSeries.map((pt) => ({ t: pt.end, v: pt.perf })), {
                stroke: 'var(--eg-green-bright)',
                extendTo: nowSec
            });
        } else {
            if (stxPerfHero) { stxPerfHero.textContent = ''; stxPerfHero.style.color = 'var(--eg-text)'; }
            if (stxPerfRange) { stxPerfRange.textContent = ''; stxPerfRange.classList.add('hidden'); }
            if (stxPerfChart) stxPerfChart.classList.add('hidden');
            if (stxPerfEmpty) stxPerfEmpty.classList.remove('hidden');
            renderStxChart(stxPerfChart, [], {});
        }

        // Performance delta: last minus first perf-series point in period (>= 2 points).
        // Only when the hero shows a value; a chip beside an empty hero reads as broken.
        const heroShown = !!(performance && Number.isFinite(performance.perf));
        setStxDelta(stxPerfDelta, (heroShown && periodSeries.length >= 2)
            ? (periodSeries[periodSeries.length - 1].perf - periodSeries[0].perf)
            : null);

        // --- Rating card ---
        if (stxRatingHero) stxRatingHero.textContent = currentRating != null ? currentRating : '';
        if (filter === 'unrated') {
            if (stxRatingChart) stxRatingChart.classList.add('hidden');
            if (stxRatingNote) stxRatingNote.classList.remove('hidden');
            renderStxChart(stxRatingChart, [], {});
        } else {
            if (stxRatingNote) stxRatingNote.classList.add('hidden');
            if (stxRatingChart) stxRatingChart.classList.remove('hidden');
            const ratingPts = ratedGames
                .filter((g) => Number.isFinite(g.rating) && Number.isFinite(g.end))
                .map((g) => ({ t: g.end, v: g.rating }));
            const noGamesInPeriod = ratingPts.length === 0 && Number.isFinite(currentRating);
            if (noGamesInPeriod) {
                ratingPts.push(
                    { t: cutoff, v: currentRating },
                    { t: nowSec, v: currentRating }
                );
            }
            renderStxChart(stxRatingChart, ratingPts, {
                stroke: 'var(--eg-blue)',
                fill: !noGamesInPeriod,
                extendTo: nowSec
            });
        }

        // Rating delta: last minus first rated game's rating in period (>= 2 games).
        const ratingSeq = ratedGames.filter((g) => Number.isFinite(g.rating));
        setStxDelta(stxRatingDelta, (ratingSeq.length >= 2)
            ? (ratingSeq[ratingSeq.length - 1].rating - ratingSeq[0].rating)
            : null);

        // --- Record row --- (period counts per K2)
        let wins = 0, draws = 0, losses = 0;
        list.forEach((g) => {
            if (!g) return;
            if (g.result === 'win') wins++;
            else if (g.result === 'draw') draws++;
            else if (g.result === 'loss') losses++;
        });
        if (stxWins) stxWins.textContent = wins;
        if (stxDraws) stxDraws.textContent = draws;
        if (stxLosses) stxLosses.textContent = losses;
        if (stxGames) stxGames.textContent = list.length;
    }

    // Hand-rolled inline SVG line chart (no libraries). points = [{ t: epochSec, v }].
    // viewBox 0 0 264 96, padded y-domain (flat series padded +/-10). When extendTo
    // is later than the newest observation, the last value is carried forward so
    // the chart communicates the current state through today.
    const STX_SVG_NS = 'http://www.w3.org/2000/svg';
    const STX_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    function stxDateLabel(epochSec) {
        const d = new Date(epochSec * 1000);
        return `${STX_MONTHS[d.getMonth()]} ${d.getDate()}`;
    }

    function stxMakeText(str, x, y, anchor, size) {
        const el = document.createElementNS(STX_SVG_NS, 'text');
        el.setAttribute('x', String(x));
        el.setAttribute('y', String(y));
        el.setAttribute('text-anchor', anchor);
        el.setAttribute('font-size', String(size));
        el.style.fill = 'var(--eg-text-3)';
        el.style.fontVariantNumeric = 'tabular-nums';
        el.textContent = str;
        return el;
    }

    // Long ranges can contain thousands of games. Keep the first/last point plus
    // each bucket's local high and low so SVG stays light without flattening swings.
    function stxReduceChartPoints(points, maxPoints = 260) {
        if (points.length <= maxPoints) return points;
        const reduced = [points[0]];
        const lastIndex = points.length - 1;
        const bucketCount = Math.max(1, Math.floor((maxPoints - 2) / 2));
        const bucketSize = Math.ceil((points.length - 2) / bucketCount);

        for (let start = 1; start < lastIndex; start += bucketSize) {
            const end = Math.min(lastIndex, start + bucketSize);
            let minIndex = start;
            let maxIndex = start;
            for (let i = start + 1; i < end; i += 1) {
                if (points[i].v < points[minIndex].v) minIndex = i;
                if (points[i].v > points[maxIndex].v) maxIndex = i;
            }
            if (minIndex === maxIndex) reduced.push(points[minIndex]);
            else if (minIndex < maxIndex) reduced.push(points[minIndex], points[maxIndex]);
            else reduced.push(points[maxIndex], points[minIndex]);
        }

        reduced.push(points[lastIndex]);
        return reduced;
    }

    function renderStxChart(svgEl, points, options) {
        if (!svgEl) return;
        while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);
        // Reset hover listeners every render: assignment replaces (never stacks), and
        // clearing here means an empty series leaves no stale closure pointing at the
        // now-removed elements. Non-empty renders reassign below.
        svgEl.onpointermove = null;
        svgEl.onpointerleave = null;
        const allPts = Array.isArray(points) ? points : [];
        if (allPts.length === 0) return;
        const extendTo = options && Number.isFinite(options.extendTo) ? options.extendTo : null;
        const newestPoint = allPts.reduce((latest, point) => point.t > latest.t ? point : latest, allPts[0]);
        const chartPts = (extendTo != null && extendTo > newestPoint.t)
            ? allPts.concat({ t: extendTo, v: newestPoint.v })
            : allPts;
        const pts = stxReduceChartPoints(chartPts);

        const stroke = (options && options.stroke) || 'var(--eg-text-2)';
        const W = 264, H = 96, pad = 6;
        const x0 = pad, x1 = W - pad;
        const y0 = pad, y1 = H - pad;

        const vals = allPts.map((p) => p.v);
        const vMin = Math.min(...vals);
        const vMax = Math.max(...vals);
        const padAmt = (vMax === vMin) ? 10 : (vMax - vMin) * 0.08;
        const vLo = vMin - padAmt;
        const vHi = vMax + padAmt;
        const vSpan = (vHi - vLo) || 1;

        const ts = chartPts.map((p) => p.t);
        const tMin = Math.min(...ts);
        const tMax = Math.max(...ts);
        const tSpan = tMax - tMin;

        // Single point (or all same time): center on the x-axis, no division by zero.
        const xFor = (t) => (tSpan === 0 ? (x0 + x1) / 2 : x0 + ((t - tMin) / tSpan) * (x1 - x0));
        const yFor = (v) => y1 - ((v - vLo) / vSpan) * (y1 - y0);

        const coords = pts.map((p) => `${xFor(p.t).toFixed(2)},${yFor(p.v).toFixed(2)}`);

        // Full-size transparent hit area so pointer events fire across the whole chart,
        // not only where the line/fill happens to be painted.
        const hit = document.createElementNS(STX_SVG_NS, 'rect');
        hit.setAttribute('x', '0');
        hit.setAttribute('y', '0');
        hit.setAttribute('width', String(W));
        hit.setAttribute('height', String(H));
        hit.setAttribute('fill', 'transparent');
        hit.style.pointerEvents = 'all';
        svgEl.appendChild(hit);

        // Area fill under real series. Empty-period baselines disable it so a flat
        // reference line cannot be mistaken for observed rating movement.
        if (!options || options.fill !== false) {
            const firstX = xFor(pts[0].t).toFixed(2);
            const lastX = xFor(pts[pts.length - 1].t).toFixed(2);
            const area = document.createElementNS(STX_SVG_NS, 'path');
            area.setAttribute('d', `M${firstX},${y1.toFixed(2)} L${coords.join(' L')} L${lastX},${y1.toFixed(2)} Z`);
            area.style.fill = stroke;
            area.style.fillOpacity = '0.10';
            area.setAttribute('stroke', 'none');
            svgEl.appendChild(area);
        }

        const line = document.createElementNS(STX_SVG_NS, 'polyline');
        line.setAttribute('points', coords.join(' '));
        line.setAttribute('fill', 'none');
        line.style.stroke = stroke;
        line.setAttribute('stroke-width', '2');
        line.setAttribute('stroke-linejoin', 'round');
        line.setAttribute('stroke-linecap', 'round');
        svgEl.appendChild(line);

        // y range + x date labels. A flat series gets one value label beside the line
        // instead of showing the same value at both the top and bottom of the chart.
        if (vMax === vMin) {
            svgEl.appendChild(stxMakeText(String(Math.round(vMax)), x0 + 2, yFor(vMax) - 5, 'start', 10));
        } else {
            svgEl.appendChild(stxMakeText(String(Math.round(vMax)), x0 + 2, y0 + 8, 'start', 10));
            svgEl.appendChild(stxMakeText(String(Math.round(vMin)), x0 + 2, y1 - 12, 'start', 10));
        }
        svgEl.appendChild(stxMakeText(stxDateLabel(pts[0].t), x0 + 2, y1 - 1, 'start', 9));
        if (pts.length > 1) {
            svgEl.appendChild(stxMakeText(stxDateLabel(pts[pts.length - 1].t), x1 - 2, y1 - 1, 'end', 9));
        }

        // --- Hover crosshair (Part L) ---
        // Scaled coords + formatted value/date for each drawn vertex, computed once.
        const hoverPts = pts.map((p) => ({
            x: xFor(p.t),
            y: yFor(p.v),
            val: String(Math.round(p.v)),
            date: stxDateLabel(p.t)
        }));

        // Build the crosshair group once (hidden); pointer moves only mutate attributes,
        // never create DOM. Group is non-interactive so it never eats its own events.
        const chair = document.createElementNS(STX_SVG_NS, 'g');
        chair.style.display = 'none';
        chair.style.pointerEvents = 'none';

        const guide = document.createElementNS(STX_SVG_NS, 'line');
        guide.setAttribute('y1', String(y0));
        guide.setAttribute('y2', String(y1));
        guide.setAttribute('stroke', 'rgba(255,255,255,0.18)');
        guide.setAttribute('stroke-width', '1');
        chair.appendChild(guide);

        const dot = document.createElementNS(STX_SVG_NS, 'circle');
        dot.setAttribute('r', '3.5');
        dot.setAttribute('fill', 'var(--eg-bg-deep)');
        dot.setAttribute('stroke', stroke);
        dot.setAttribute('stroke-width', '2');
        chair.appendChild(dot);

        const box = document.createElementNS(STX_SVG_NS, 'rect');
        box.setAttribute('rx', '6');
        box.setAttribute('fill', '#14130f');
        box.setAttribute('stroke', 'var(--eg-line-2)');
        box.setAttribute('stroke-width', '1');
        chair.appendChild(box);

        const valText = document.createElementNS(STX_SVG_NS, 'text');
        valText.setAttribute('text-anchor', 'middle');
        valText.setAttribute('font-size', '11');
        valText.setAttribute('font-weight', '700');
        valText.style.fill = 'var(--eg-text)';
        valText.style.fontVariantNumeric = 'tabular-nums';
        chair.appendChild(valText);

        const dateText = document.createElementNS(STX_SVG_NS, 'text');
        dateText.setAttribute('text-anchor', 'middle');
        dateText.setAttribute('font-size', '9');
        dateText.style.fill = 'var(--eg-text-3)';
        dateText.style.fontVariantNumeric = 'tabular-nums';
        chair.appendChild(dateText);

        svgEl.appendChild(chair);

        // Over-estimate glyph width (bold digits ~0.64em, date ~0.6em) so the rect never
        // clips its text, incl. 4-digit values. Estimate keeps the math DOM-independent.
        const estW = (s, size, factor) => s.length * size * factor;
        const PAD_X = 6, GAP = 8, RECT_H = 30, MARGIN = 1;

        svgEl.onpointermove = (ev) => {
            const rect = svgEl.getBoundingClientRect();
            if (!rect.width) return;
            // Map pointer x into viewBox units (handles the SVG being scaled in layout).
            const vbX = ((ev.clientX - rect.left) / rect.width) * W;
            // Snap to nearest drawn vertex by x (linear scan; series is small).
            let best = 0, bestD = Infinity;
            for (let i = 0; i < hoverPts.length; i++) {
                const d = Math.abs(hoverPts[i].x - vbX);
                if (d < bestD) { bestD = d; best = i; }
            }
            const hp = hoverPts[best];

            guide.setAttribute('x1', hp.x.toFixed(2));
            guide.setAttribute('x2', hp.x.toFixed(2));
            dot.setAttribute('cx', hp.x.toFixed(2));
            dot.setAttribute('cy', hp.y.toFixed(2));
            valText.textContent = hp.val;
            dateText.textContent = hp.date;

            const contentW = Math.max(estW(hp.val, 11, 0.64), estW(hp.date, 9, 0.6));
            const rectW = contentW + PAD_X * 2;

            // Anchor above the dot; flip below when the top would clip, then clamp.
            let rectY = hp.y - GAP - RECT_H;
            if (rectY < MARGIN) rectY = hp.y + GAP;
            if (rectY + RECT_H > H - MARGIN) rectY = H - MARGIN - RECT_H;
            if (rectY < MARGIN) rectY = MARGIN;

            // Centered on the point; clamp inside the viewBox (this is the edge-side flip:
            // near the left/right edge the box shifts to the dot's inward side).
            let rectX = hp.x - rectW / 2;
            if (rectX < MARGIN) rectX = MARGIN;
            if (rectX + rectW > W - MARGIN) rectX = W - MARGIN - rectW;

            box.setAttribute('x', rectX.toFixed(2));
            box.setAttribute('y', rectY.toFixed(2));
            box.setAttribute('width', rectW.toFixed(2));
            box.setAttribute('height', String(RECT_H));
            const cx = (rectX + rectW / 2).toFixed(2);
            valText.setAttribute('x', cx);
            valText.setAttribute('y', (rectY + 13).toFixed(2));
            dateText.setAttribute('x', cx);
            dateText.setAttribute('y', (rectY + 24).toFixed(2));

            chair.style.display = '';
        };
        svgEl.onpointerleave = () => { chair.style.display = 'none'; };
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
        const rsLength = clampRandomStringLength(randomStringLengthInput.value);
        randomStringLengthInput.value = rsLength;
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
            randomStringLength = rsLength;

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

    function showHomeConnectionForm({ focus = false } = {}) {
        homeConnectionForm.classList.remove('hidden');
        homeUsernameEditBtn.classList.add('hidden');
        if (focus) {
            requestAnimationFrame(() => {
                homeUsernameInput.focus();
                homeUsernameInput.select();
            });
        }
    }

    function showConnectedHomeState() {
        homeConnectionForm.classList.add('hidden');
        homeUsernameEditBtn.classList.remove('hidden');
    }

    function connectUsernameFromHome() {
        const username = homeUsernameInput.value.trim();
        checkConnection({ username, triggerBtn: homeConnectBtn, persistOnSuccess: true });
    }

    function setConnectionButtonState(button, label, { reset = false } = {}) {
        if (!button) return;
        button.disabled = label === 'Connecting...';
        button.innerText = label;
        if (reset) {
            setTimeout(() => {
                button.disabled = false;
                button.innerText = 'Connect';
            }, 1500);
        }
    }

    async function checkConnection({
        username = usernameInput.value.trim(),
        triggerBtn = null,
        persistOnSuccess = false
    } = {}) {
        const statusText = document.getElementById('connectionStatus');

        if (!username) {
            statusText.innerText = 'Connect your Chess.com username';
            statusText.style.color = '';
            liveRatingEl.innerText = '---';
            currentFetchedRating = null;
            fetchedRatings = {};
            showHomeConnectionForm();
            renderSmartBracketCard({ kind: 'hidden' });
            return false;
        }

        setConnectionButtonState(triggerBtn, 'Connecting...');
        statusText.innerText = "Connecting...";
        statusText.style.color = '';

        try {
            const response = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(username)}/stats`);
            if (!response.ok) throw new Error();
            const data = await response.json();
            
            const statsObj = data[`chess_${activeMode}`];
            const rating = statsObj?.last?.rating;
            fetchedRatings = ['rapid', 'blitz', 'bullet'].reduce((ratings, mode) => {
                const modeRating = Number(data[`chess_${mode}`]?.last?.rating);
                if (Number.isFinite(modeRating)) ratings[mode] = modeRating;
                return ratings;
            }, {});

            // Update Panel Refs
            if(data.chess_rapid) statsRefs.rapid.innerText = data.chess_rapid.last?.rating || "-";
            if(data.chess_blitz) statsRefs.blitz.innerText = data.chess_blitz.last?.rating || "-";
            if(data.chess_bullet) statsRefs.bullet.innerText = data.chess_bullet.last?.rating || "-";

            if (!rating) throw new Error("No rating found");

            currentFetchedRating = rating;
            usernameInput.value = username;
            homeUsernameInput.value = username;

            statusText.textContent = '✅ Connected: ';
            const nameEl = document.createElement('b');
            nameEl.textContent = username;
            statusText.appendChild(nameEl);
            statusText.style.color = "#81b64c";
            
            liveRatingEl.innerText = rating;

            if (persistOnSuccess) {
                currentState.username = username;
                chrome.storage.sync.set({ username }, refreshActiveChessTab);
            }

            showConnectedHomeState();
            setConnectionButtonState(triggerBtn, 'Connected', { reset: true });

            updateSmartBracketCardForMode(activeMode, { allowRecompute: true });
            return true;

        } catch (e) {
            statusText.innerText = "Couldn't find that user for this mode";
            statusText.style.color = "#ff4d4d";
            liveRatingEl.innerText = "---";
            currentFetchedRating = null;
            fetchedRatings = {};

            showHomeConnectionForm();
            setConnectionButtonState(triggerBtn, 'Try again', { reset: true });
            renderSmartBracketCard({ kind: 'hidden' });
            return false;
        }
    }

    async function fetchAllStats() {
        checkConnection();
    }

    // Reflect Pro/free status across the header button and feature list. The
    // upgrade card is useful only on the free tier, so paid users do not see it.
    // Daily remaining counts live in the usage hint below the list.
    function setProFeatureLabels(isPro) {
        proFeatureBtns.forEach((btn) => {
            const feature = btn.getAttribute('data-feature');
            const label = btn.querySelector('.pro-feature-label');
            const labels = PRO_FEATURE_LABELS[feature];
            if (!label || !labels) return;

            if (isPro) {
                label.textContent = labels.pro;
            } else {
                label.textContent = `${labels.free} (Pro)`;
            }
        });
    }

    function applyEntitlementState(isPro, hintText) {
        if (upgradeBtn) {
            upgradeBtn.innerText = isPro ? 'PRO' : 'Upgrade';
            upgradeBtn.classList.toggle('pro', isPro);
            upgradeBtn.title = isPro ? 'Manage your subscription' : 'Upgrade to EloGuard Pro';
        }
        if (proSection) proSection.classList.toggle('hidden', isPro);
        proFeatureBtns.forEach((btn) => {
            const lock = btn.querySelector('.pro-feature-lock');
            if (lock) lock.textContent = isPro ? '✓' : '🔒';
        });
        setProFeatureLabels(isPro);
        if (proUsageHint) proUsageHint.textContent = hintText;
        setSmartBracketUi(isPro);
        updateSmartBracketCardForMode(activeMode, { allowRecompute: false });
        // If the Stats view is open when the entitlement changes, swap it live
        // between sample and real data.
        if (statsView && !statsView.classList.contains('hidden')) loadStats();
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
            const end = formatBillingDate(entitlement.cancelAt || entitlement.currentPeriodEnd);
            return entitlement.status === 'trialing'
                ? `Trial cancelled. You will not be charged. Pro ends ${end || 'when the trial finishes'}.`
                : `Renewal cancelled. Pro ends ${end || 'at the end of the paid period'}.`;
        }
        if (entitlement.status === 'past_due') return 'Payment failed. Update your card to keep Pro active.';
        if (entitlement.status === 'trialing') {
            const end = formatBillingDate(entitlement.currentPeriodEnd);
            return end
                ? `Free trial ends ${end}. Then $2.99/month unless cancelled.`
                : 'Free trial active. Then $2.99/month unless cancelled.';
        }
        if (isProActive()) {
            return entitlement.currentPeriodEnd
                ? `Renews ${formatBillingDate(entitlement.currentPeriodEnd)}.`
                : 'Pro subscription active.';
        }
        // CHEAT RISK DETECTION — DISABLED: dropped "and cheat-risk checks" from the upsell copy.
        return 'Free tier active. Upgrade for unlimited game reviews, Stats, and Smart Bracket.';
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
        const isTrial = entitlement?.status === 'trialing';
        // A recurring subscription only exists on a paid, non-lifetime plan.
        const isSubscribed = isPro && !isLifetime;

        // Lifetime buyers have no subscription to manage or cancel — drop the
        // whole card instead of showing dead controls.
        if (billingCard) billingCard.hidden = isLifetime;
        if (isLifetime) return;

        if (billingPlanLabel) {
            billingPlanLabel.textContent = isTrial ? 'EloGuard Pro Trial' : isPro ? 'EloGuard Pro Monthly' : 'Free plan';
        }
        if (billingStatusLabel) billingStatusLabel.textContent = billingHintForEntitlement(entitlement);

        if (billingManageBtn) {
            billingManageBtn.textContent = isPro ? 'Manage subscription' : 'Upgrade to Pro';
            billingManageBtn.classList.toggle('is-upgrade', !isPro);
        }
        // Restore purchase only matters when this install isn't entitled.
        if (billingRestoreToggle) billingRestoreToggle.hidden = isPro;
        if (isPro) hideRestoreRows();

        if (billingCancelBtn) {
            // Only surface Cancel renewal to active subscribers.
            billingCancelBtn.hidden = !isSubscribed;
            billingCancelBtn.disabled = !isSubscribed || isScheduledCancel;
            billingCancelBtn.textContent = isTrial
                ? (isScheduledCancel ? 'Trial cancelled' : 'Cancel trial')
                : (isScheduledCancel ? 'Renewal cancelled' : 'Cancel renewal');
            billingCancelBtn.title = isScheduledCancel
                ? (isTrial ? 'Trial is already cancelled' : 'Renewal is already cancelled')
                : (isTrial ? 'Cancel before the trial ends so you are not charged' : 'Cancel monthly renewal at the end of your current paid period');
        }
    }

    function setSmartBracketUi(isPro) {
        if (smartBracketGroup) smartBracketGroup.classList.toggle('is-pro-locked', !isPro);
        refreshEntryUi();
    }

    function capitalize(str) {
        return (typeof str === 'string' && str.length) ? str[0].toUpperCase() + str.slice(1) : str;
    }

    function getGoalTarget(mode) {
        const raw = currentState[`eloGoal_${mode}`];
        if (!raw) return null;
        try {
            const g = JSON.parse(raw);
            if (g && Number.isFinite(g.target)) return g.target;
        } catch (e) { /* ignore malformed */ }
        return null;
    }

    function invalidateSmartBracketCache(mode) {
        const username = usernameInput.value.trim();
        if (!username) return;
        chrome.storage.local.remove(`smartBracketLast:${username}:${mode}`);
    }

    // A mode counts as configured once a bracket was applied for it: a version-valid
    // render cache for the active username, or a persisted trailing distance.
    function isModeConfigured(mode, cb) {
        const appliedBracket = currentState[`smartTrailingDist_${mode}`] != null;
        const username = usernameInput.value.trim();
        if (appliedBracket || !username) { cb(appliedBracket); return; }
        const cacheKey = `smartBracketLast:${username}:${mode}`;
        chrome.storage.local.get(cacheKey, (res) => {
            cb(!!cachedResultIfCurrent(res[cacheKey], mode));
        });
    }

    function isModeConfiguredAsync(mode) {
        return new Promise((resolve) => isModeConfigured(mode, resolve));
    }

    function goalExtensionKey(mode) {
        const username = usernameInput.value.trim();
        return username ? `smartGoalExtension:${username}:${mode}` : null;
    }

    function clearGoalExtensionForMode(mode) {
        const key = goalExtensionKey(mode);
        if (key) chrome.storage.local.remove(key);
    }

    async function prepareSmartBracketForSession() {
        if (currentState.smartBracketEnabled === false || !isProActive()) return;
        if (currentFetchedRating == null || isNaN(currentFetchedRating)) return;
        if (!(await isModeConfiguredAsync(activeMode))) return;
        await runSmartBracket({ trigger: 'session-start' });
    }

    // Single write path for the master on/off. Keeps both switches (home card +
    // settings row) and the card in sync.
    function setSmartBracketEnabled(enabled) {
        currentState.smartBracketEnabled = enabled;
        chrome.storage.sync.set({ smartBracketEnabled: enabled });
        if (smartBracketToggle) smartBracketToggle.checked = enabled;
        applySmartBracketEnabledState(enabled);
        updateSmartBracketCardForMode(activeMode, { allowRecompute: enabled });
        refreshEntryUi();
    }

    // Settings entry row: the switch reflects "on and set up for the active mode";
    // a pending first-time setup keeps it visually on while the flow is open.
    function refreshEntryUi() {
        if (!smartBracketSettingsToggle) return;
        const isPro = isProActive();
        smartBracketSettingsToggle.disabled = !isPro;
        if (smartSetupBtn) smartSetupBtn.title = isPro ? 'Smart Bracket settings' : 'Upgrade to EloGuard Pro';
        if (!isPro) { smartBracketSettingsToggle.checked = false; return; }
        if (pendingAutoEnable) { smartBracketSettingsToggle.checked = true; return; }
        if (currentState.smartBracketEnabled === false) { smartBracketSettingsToggle.checked = false; return; }
        isModeConfigured(activeMode, (configured) => {
            smartBracketSettingsToggle.checked = configured;
        });
    }

    // --- Smart bracket setup flow (two-step view) ---

    function openSmartSetup() {
        mainView.classList.add('hidden');
        settingsView.classList.add('hidden');
        if (smartSetupView) smartSetupView.classList.remove('hidden');
        loadStep1ForMode(activeMode);
        showSmartStep(1);
    }

    function closeSmartSetup(opts = {}) {
        if (smartSetupView) smartSetupView.classList.add('hidden');
        // Backing out of a first-time setup without applying leaves the feature off.
        if (pendingAutoEnable) {
            pendingAutoEnable = false;
            refreshEntryUi();
        }
        if (opts.toMain) {
            settingsView.classList.add('hidden');
            mainView.classList.remove('hidden');
        } else {
            settingsView.classList.remove('hidden');
        }
    }

    function showSmartStep(step) {
        if (sbStep1) sbStep1.classList.toggle('hidden', step !== 1);
        if (sbStep2) sbStep2.classList.toggle('hidden', step !== 2);
        if (sbStepLabel) sbStepLabel.textContent = `Step ${step} of 2`;
    }

    function updateGoalClearVisibility() {
        if (!sbGoalClearBtn) return;
        sbGoalClearBtn.classList.toggle('hidden', getGoalTarget(activeMode) == null);
    }

    // Load the active mode's saved preferences into step 1.
    function loadStep1ForMode(mode) {
        const goalTarget = getGoalTarget(mode);
        if (sbGoalInput) sbGoalInput.value = goalTarget != null ? goalTarget : '';
        updateGoalClearVisibility();
        if (sbTrailingToggle) sbTrailingToggle.checked = currentState.smartTrailing !== false;
        if (sbFallbackRange) sbFallbackRange.value = parseInt(currentState.smartRange) || 25;
        if (sbGoalLabel) sbGoalLabel.textContent = `🎯 Long-term Elo goal — ${capitalize(mode)}`;
    }

    // Step 2 preview: compute WITHOUT applying, then render loading/ready/error.
    async function runPreview() {
        showSmartStep(2);
        setPreviewState('loading');
        const mode = activeMode;
        try {
            const result = await computeBracketForMode(mode);
            previewResult = result;
            previewMode = mode;
            renderPreview(result, mode);
            setPreviewState('ready');
        } catch (e) {
            previewResult = null;
            setPreviewState('error');
        }
    }

    function setPreviewState(state) {
        previewState = state;
        if (sbPreviewLoading) sbPreviewLoading.classList.toggle('hidden', state !== 'loading');
        if (sbPreviewResult) sbPreviewResult.classList.toggle('hidden', state !== 'ready');
        if (sbPreviewError) sbPreviewError.classList.toggle('hidden', state !== 'error');
        if (sbPreviewActions) sbPreviewActions.classList.toggle('hidden', state === 'loading');
        if (sbApplyBtn) sbApplyBtn.textContent = state === 'error' ? 'Retry' : 'Apply bracket';
    }

    function renderPreview(result, mode) {
        if (sbPreviewTitle) sbPreviewTitle.textContent = `Your bracket — ${capitalize(mode)}`;
        setPrevRail(result.floor, currentFetchedRating, result.ceiling);
        renderLongTermGoal(sbLongTermGoalPrev, result, currentFetchedRating);
        renderRecentPerformance(sbPerformancePrev, sbPerformanceValPrev, sbPerformanceDeltaPrev, result);
        if (!sbReasonsPrev) return;
        sbReasonsPrev.textContent = '';
        const reasons = Array.isArray(result.reasons) ? result.reasons : [];
        reasons.forEach((r) => {
            const li = document.createElement('li');
            if (r && r.tone) li.setAttribute('data-tone', r.tone);
            li.textContent = (r && r.text) || '';
            sbReasonsPrev.appendChild(li);
        });
    }

    function setPrevRail(floor, current, ceiling) {
        if (sbFloorValPrev) sbFloorValPrev.textContent = floor;
        if (sbCeilValPrev) sbCeilValPrev.textContent = ceiling;
        if (sbYouPrev) sbYouPrev.textContent = current != null ? `You · ${current}` : 'You';
        if (Number.isFinite(floor) && Number.isFinite(ceiling) && ceiling > floor && current != null) {
            const pct = ((current - floor) / (ceiling - floor)) * 100;
            if (sbDotPrev) sbDotPrev.style.left = Math.max(3, Math.min(97, pct)) + '%';
            if (sbYouPrev) sbYouPrev.style.left = Math.max(12, Math.min(88, pct)) + '%';
        }
    }

    function renderRecentPerformance(container, valueEl, deltaEl, result) {
        if (!container || !valueEl || !deltaEl) return;
        container.classList.remove('hidden');
        container.removeAttribute('data-tone');

        const performance = result?.stats?.performance;
        if (result?.stats?.recentPerformanceGameCount === 0) {
            container.setAttribute('data-tone', 'empty');
            valueEl.textContent = 'No recent games';
            deltaEl.textContent = '';
            return;
        }
        if (!performance || !Number.isFinite(performance.perf)) {
            container.setAttribute('data-tone', 'pending');
            valueEl.textContent = 'Building sample';
            deltaEl.textContent = '';
            return;
        }

        const performanceRating = Math.round(performance.perf);
        valueEl.textContent = performanceRating;
        if (currentFetchedRating == null || !Number.isFinite(Number(currentFetchedRating))) {
            deltaEl.textContent = '';
            return;
        }

        const delta = performanceRating - Number(currentFetchedRating);
        if (delta === 0) {
            deltaEl.textContent = 'even';
            return;
        }
        container.setAttribute('data-tone', delta > 0 ? 'good' : 'warn');
        deltaEl.textContent = `${delta > 0 ? '+' : ''}${delta} vs rating`;
    }

    function renderLongTermGoal(element, result, currentRating) {
        if (!element) return;
        const target = result?.goal?.target;
        if (!Number.isFinite(target)) {
            element.textContent = '';
            element.classList.add('hidden');
            return;
        }

        let detail = '';
        if (result.goal.reached) {
            detail = 'reached';
        } else if (Number.isFinite(Number(currentRating))) {
            const remaining = Math.max(0, target - Number(currentRating));
            detail = `${remaining} ${remaining === 1 ? 'point' : 'points'} away`;
        }
        element.textContent = `Long-term goal ${target}${detail ? ` · ${detail}` : ''}`;
        element.classList.remove('hidden');
    }

    // Fetch recent games + read goal/fallback + compute — no side effects.
    async function computeBracketForMode(mode) {
        const username = usernameInput.value.trim();
        if (!username || currentFetchedRating == null || isNaN(currentFetchedRating)) {
            throw new Error('no-rating');
        }
        const engine = window.EloGuardSmartBracket;
        if (!engine || typeof engine.fetchRecentGames !== 'function' || typeof engine.computeSmartBracket !== 'function') {
            throw new Error('no-engine');
        }
        const nowSec = Math.floor(Date.now() / 1000);
        const allGames = await engine.fetchRecentGames({
            username,
            timeClass: mode,
            ratedFilter: 'both',
            maxGames: 50000
        });
        const games = allGames.filter((game) => game && game.rated).slice(-60);
        let goal = null;
        const rawGoal = currentState[`eloGoal_${mode}`];
        if (rawGoal) { try { goal = JSON.parse(rawGoal); } catch (e) { goal = null; } }
        const manualRange = parseInt(currentState.smartRange) || 25;
        return engine.computeSmartBracket({
            games,
            performanceGames: allGames,
            currentRating: currentFetchedRating,
            mode,
            goal,
            manualRange,
            nowSec
        });
    }

    // Persist a per-mode Elo goal. Keep the original startRating/setAt when a goal
    // already exists so changing the target doesn't reset progress; an empty/invalid
    // value clears the goal.
    function saveGoalForMode(mode, targetRaw) {
        const key = `eloGoal_${mode}`;
        const previousTarget = getGoalTarget(mode);
        const target = parseInt(targetRaw);
        if (!target || isNaN(target) || target <= 0) {
            chrome.storage.sync.remove(key);
            delete currentState[key];
            if (previousTarget != null) invalidateSmartBracketCache(mode);
            return;
        }
        let startRating = (currentFetchedRating != null && !isNaN(currentFetchedRating)) ? currentFetchedRating : null;
        let setAt = Math.floor(Date.now() / 1000);
        const existing = currentState[key];
        if (existing) {
            try {
                const g = JSON.parse(existing);
                if (g && typeof g === 'object') {
                    if ('startRating' in g) startRating = g.startRating;
                    if (Number.isFinite(g.setAt)) setAt = g.setAt;
                }
            } catch (e) { /* ignore malformed */ }
        }
        const payload = JSON.stringify({ target, startRating, setAt });
        currentState[key] = payload;
        chrome.storage.sync.set({ [key]: payload });
        if (previousTarget !== target) invalidateSmartBracketCache(mode);
    }

    // Home-card path: compute + apply for the active mode. trigger: 'refresh' (↻ button —
    // paywalls free users, spins the icon), 'session-start' (guard activation), or
    // 'auto' while the guard is inactive. Degrades gracefully if the engine is missing.
    async function runSmartBracket({ trigger }) {
        const isRefresh = trigger === 'refresh';

        // Master toggle off: never auto-run or refresh the home card.
        if (currentState.smartBracketEnabled === false) return null;

        if (!isProActive()) {
            if (isRefresh) {
                await openBillingForFeature(SMART_BRACKET_FEATURE);
                setSmartBracketUi(false);
            }
            return null;
        }

        const username = usernameInput.value.trim();
        if (!username || currentFetchedRating == null || isNaN(currentFetchedRating)) {
            return null;
        }

        const engine = window.EloGuardSmartBracket;
        if (!engine || typeof engine.fetchRecentGames !== 'function' || typeof engine.computeSmartBracket !== 'function') {
            renderSmartBracketCard({ kind: 'error' });
            return null;
        }

        const mode = activeMode;
        renderSmartBracketCard({ kind: 'loading' });
        if (isRefresh && sbRefreshBtn) sbRefreshBtn.classList.add('spinning');

        try {
            const result = await computeBracketForMode(mode);
            applySmartResult(result, mode);
            renderSmartBracketCard({ kind: 'ready', result });
            return result;
        } catch (e) {
            renderSmartBracketCard({ kind: 'error' });
            return null;
        } finally {
            if (isRefresh && sbRefreshBtn) sbRefreshBtn.classList.remove('spinning');
        }
    }

    // Persist a computed bracket to the live inputs, per-mode sync keys and the local
    // render cache. Applying always arms the feature (smartBracketEnabled = true).
    function applySmartResult(result, mode) {
        stopLossInput.value = result.floor;
        targetRatingInput.value = result.ceiling;
        updateMainViewStats();

        const trailingDist = Number.isFinite(result.trailingDistance)
            ? result.trailingDistance
            : (currentFetchedRating - result.floor);

        const update = {};
        update[`stopLoss_${mode}`] = String(result.floor);
        update[`targetRating_${mode}`] = String(result.ceiling);
        update[`smartTrailingDist_${mode}`] = trailingDist;
        // Applying a bracket implies the feature is on (covers the wizard Apply path).
        update.smartBracketEnabled = true;
        currentState = { ...currentState, ...update };
        chrome.storage.sync.set(update, refreshActiveChessTab);

        const username = usernameInput.value.trim();
        if (username) {
            const cacheKey = `smartBracketLast:${username}:${mode}`;
            chrome.storage.local.set({ [cacheKey]: { result, rating: currentFetchedRating, computedAt: Date.now() } });
        }
        if (smartBracketToggle) smartBracketToggle.checked = true;
        applySmartBracketEnabledState(true);
        refreshEntryUi();
    }

    // Toggle the card's off-state chrome: hide the body + ↻ and show the muted note.
    function applySmartBracketEnabledState(enabled) {
        if (!smartBracketCard) return;
        smartBracketCard.classList.toggle('sb-off', !enabled);
        if (sbOffNote) sbOffNote.classList.toggle('hidden', enabled);
    }

    // A render cache is only valid if it carries the engine's current copy version;
    // a mismatched result would render outdated reason strings, so treat it as absent
    // (the caller then hides or recomputes instead of showing stale copy).
    function cachedResultIfCurrent(cached, mode) {
        const engine = window.EloGuardSmartBracket;
        const version = engine ? engine.COPY_VERSION : undefined;
        if (!cached || !cached.result || cached.result.copyVersion !== version) return null;

        // Goal changes affect the separate long-term progress line. A cache computed for
        // another goal must never render while fresh progress metadata is being analyzed.
        const cachedGoal = cached.result.goal && Number.isFinite(cached.result.goal.target)
            ? cached.result.goal.target
            : null;
        if (mode && cachedGoal !== getGoalTarget(mode)) return null;
        return cached.result;
    }

    // Render the active mode's card from cache, or hide it. When allowRecompute and the
    // mode has a bracket set up, silently recompute if the cache is stale or for another
    // rating (enabled-off is handled above; undefined means on, per the master toggle).
    function updateSmartBracketCardForMode(mode, { allowRecompute }) {
        if (!smartBracketCard) return;
        if (!isProActive()) { renderSmartBracketSample(); return; }
        const username = usernameInput.value.trim();
        if (!username) { renderSmartBracketCard({ kind: 'hidden' }); return; }

        // Master toggle off: keep the card discoverable (header + note), no recompute.
        if (currentState.smartBracketEnabled === false) {
            smartBracketCard.classList.remove('hidden');
            applySmartBracketEnabledState(false);
            return;
        }
        applySmartBracketEnabledState(true);

        const cacheKey = `smartBracketLast:${username}:${mode}`;
        chrome.storage.local.get(cacheKey, (res) => {
            const cached = res[cacheKey];
            // Stale-copy caches are ignored so a version bump never renders old strings.
            const result = cachedResultIfCurrent(cached, mode);
            const hasResult = !!result;
            const sameRating = hasResult && currentFetchedRating != null && cached.rating === currentFetchedRating;
            const fresh = hasResult && sameRating && (Date.now() - cached.computedAt) < SMART_CACHE_TTL_MS;

            const configured = hasResult || currentState[`smartTrailingDist_${mode}`] != null;
            if (hasResult) {
                renderSmartBracketCard({ kind: 'ready', result });
            } else {
                renderSmartBracketCard({ kind: 'hidden' });
            }
            // Keep an active session's target fixed. Opening EloGuard must not move the
            // goalposts; activation of the next session or an explicit refresh can.
            const sessionEngine = window.EloGuardSessionBracket;
            const shouldAutoRecompute = sessionEngine && typeof sessionEngine.shouldAutoRecompute === 'function'
                ? sessionEngine.shouldAutoRecompute({
                    fresh,
                    configured,
                    allowRecompute,
                    hasRating: currentFetchedRating != null,
                    guardActive: currentState.guardActive
                })
                : (!fresh && configured && allowRecompute && currentFetchedRating != null && currentState.guardActive !== true);
            if (shouldAutoRecompute) {
                runSmartBracket({ trigger: 'auto' });
            }
        });
    }

    function setSmartRail(floor, current, ceiling) {
        if (sbFloorVal) sbFloorVal.textContent = floor;
        if (sbCeilVal) sbCeilVal.textContent = ceiling;
        if (sbYou) sbYou.textContent = current != null ? `You · ${current}` : 'You';
        if (Number.isFinite(floor) && Number.isFinite(ceiling) && ceiling > floor && current != null) {
            const pct = ((current - floor) / (ceiling - floor)) * 100;
            if (sbDot) sbDot.style.left = Math.max(3, Math.min(97, pct)) + '%';
            if (sbYou) sbYou.style.left = Math.max(12, Math.min(88, pct)) + '%';
        }
    }

    // Free tier: keep the card on the home view as a dimmed, non-interactive
    // sample with an upgrade overlay, instead of hiding the feature entirely.
    function renderSmartBracketSample() {
        if (!smartBracketCard) return;
        smartBracketCard.classList.remove('hidden', 'sb-off', 'sb-no-rail');
        smartBracketCard.classList.add('sb-sample');
        if (sbOffNote) sbOffNote.classList.add('hidden');
        setSmartRail(1150, 1210, 1290);
        if (sbLongTermGoal) sbLongTermGoal.classList.add('hidden');
        if (sbPerformance) {
            sbPerformance.classList.remove('hidden');
            sbPerformance.setAttribute('data-tone', 'good');
        }
        if (sbPerformanceVal) sbPerformanceVal.textContent = '1272';
        if (sbPerformanceDelta) sbPerformanceDelta.textContent = '+62 vs rating';
        if (sbReasons) {
            sbReasons.textContent = '';
            [
                { text: 'Strong recent form — target nudged above your rating.', tone: 'good' },
                { text: 'Floor set just under your recent dips.', tone: null }
            ].forEach((r) => {
                const li = document.createElement('li');
                if (r.tone) li.setAttribute('data-tone', r.tone);
                li.textContent = r.text;
                sbReasons.appendChild(li);
            });
        }
        if (sbProOverlay) sbProOverlay.classList.remove('hidden');
    }

    function renderSmartBracketCard(state) {
        if (!smartBracketCard) return;
        // Leaving sample mode (e.g. entitlement flipped to Pro): restore the live card.
        smartBracketCard.classList.remove('sb-sample');
        if (sbProOverlay) sbProOverlay.classList.add('hidden');
        const kind = state.kind;

        if (kind === 'hidden') {
            smartBracketCard.classList.add('hidden');
            return;
        }
        smartBracketCard.classList.remove('hidden');
        if (sbReasons) sbReasons.textContent = '';

        if (kind === 'loading') {
            smartBracketCard.classList.add('sb-no-rail');
            const li = document.createElement('li');
            li.className = 'sb-loading';
            li.textContent = 'Analyzing your recent games…';
            sbReasons?.appendChild(li);
            return;
        }

        if (kind === 'error') {
            smartBracketCard.classList.add('sb-no-rail');
            const li = document.createElement('li');
            li.setAttribute('data-tone', 'warn');
            li.textContent = 'Couldn’t fetch game history — tap ↻ to retry.';
            sbReasons?.appendChild(li);
            return;
        }

        // ready
        const result = state.result;
        if (!result) { smartBracketCard.classList.add('hidden'); return; }
        smartBracketCard.classList.remove('sb-no-rail');
        setSmartRail(result.floor, currentFetchedRating, result.ceiling);
        renderLongTermGoal(sbLongTermGoal, result, currentFetchedRating);
        renderRecentPerformance(sbPerformance, sbPerformanceVal, sbPerformanceDelta, result);
        const reasons = Array.isArray(result.reasons) ? result.reasons.slice(0, 2) : [];
        reasons.forEach((r) => {
            const li = document.createElement('li');
            if (r && r.tone) li.setAttribute('data-tone', r.tone);
            li.textContent = (r && r.text) || '';
            sbReasons?.appendChild(li);
        });
    }

    async function refreshEntitlementUi(syncRemote) {
        const api = window.EloGuardEntitlements;
        if (!api || !upgradeBtn) return;

        if (syncRemote && refreshProBtn) {
            refreshProBtn.classList.add('spinning');
            refreshProBtn.disabled = true;
        }
        if (syncRemote && billingRefreshBtn) {
            billingRefreshBtn.classList.add('spinning');
            billingRefreshBtn.disabled = true;
        }

        try {
            let entitlement = await api.getEntitlement();
            if (syncRemote && !['dev', 'owner'].includes(entitlement.source)) entitlement = await api.refreshEntitlement();
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
                // CHEAT RISK DETECTION — DISABLED: the riskProfile access fetch and its "risk" usage
                // segment are commented out (kept for reactivation). Restore the riskProfile fetch,
                // the array destructuring, the "risk" string segment, and the usage key to re-enable.
                // MATCHUP ADVICE — DISABLED: the matchup fetch and its usage segment are commented
                // out while the feature is off in content.js (pending ToS review).
                const [review] = await Promise.all([
                    // api.getFeatureAccess('riskProfile'),
                    // api.getFeatureAccess('matchup'),
                    api.getFeatureAccess('gameReview')
                ]);
                applyEntitlementState(false,
                    `Free today: ${review.remaining}/${review.limit} game reviews`);
            }
            refreshActiveChessTab();
        } catch (e) {
            let entitlement = null;
            try {
                entitlement = await api.getEntitlement();
            } catch (inner) {
                console.warn('EloGuard entitlement read failed:', inner);
            }
            currentEntitlement = entitlement;
            const isPro = !!(entitlement && api.isProEntitlement(entitlement));
            applyEntitlementState(isPro, isPro
                ? 'Unlimited access'
                : (syncRemote ? 'Could not reach billing — try again' : 'Upgrade for unlimited access'));
        } finally {
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
                    // CHEAT RISK DETECTION — DISABLED: pass false so the pill stays hidden (toggle
                    // removed). Was: showRiskProfilePillToggle.checked
                    false
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

    // Global tooltip: one shared, JS-positioned element replaces the old
    // .tooltip:hover::after (which mis-rendered inside the scrollable settings view).
    // Delegated listeners are attached once — no per-hover element or listener churn.
    const egTooltip = document.createElement('div');
    egTooltip.id = 'egTooltip';
    egTooltip.style.cssText = [
        'position:fixed', 'left:14px', 'right:14px', 'z-index:10000',
        'background:#14130f', 'border:1px solid var(--eg-line-2)',
        'border-radius:var(--eg-r-1)', 'font-size:11px', 'line-height:1.45',
        'padding:10px 12px', 'color:var(--eg-text)', 'box-shadow:var(--eg-sh-3)',
        'pointer-events:none', 'display:none'
    ].join(';');
    document.body.appendChild(egTooltip);

    function positionEgTooltip(anchor) {
        const rect = anchor.getBoundingClientRect();
        const th = egTooltip.offsetHeight;
        let top = (rect.bottom + th + 16 > window.innerHeight)
            ? rect.top - th - 8
            : rect.bottom + 8;
        top = Math.max(8, Math.min(top, window.innerHeight - th - 8));
        egTooltip.style.top = top + 'px';
    }

    document.addEventListener('mouseover', (e) => {
        const anchor = e.target.closest ? e.target.closest('.tooltip[data-text]') : null;
        if (!anchor) return;
        egTooltip.textContent = anchor.getAttribute('data-text');
        egTooltip.style.display = 'block';
        positionEgTooltip(anchor);
    });

    document.addEventListener('mouseout', (e) => {
        const anchor = e.target.closest ? e.target.closest('.tooltip[data-text]') : null;
        if (anchor) egTooltip.style.display = 'none';
    });

    document.addEventListener('scroll', () => { egTooltip.style.display = 'none'; }, true);

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

            body.elo-guard-enhanced-focus.elo-guard-enhanced-focus-ready > *:not(#elo-guard-enhanced-focus-stage):not(#elo-guard-enhanced-focus-toggle):not(script):not(style):not(link) {
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
