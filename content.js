(() => {
    const CONTENT_VERSION = '1.6.5-enhanced-focus-stable-clocks';
    if (window.__ELOGUARD_CONTENT_VERSION__ === CONTENT_VERSION) {
        window.dispatchEvent(new CustomEvent('eloGuard:reloadSettings'));
        return;
    }
    window.__ELOGUARD_CONTENT_LOADED__ = true;
    window.__ELOGUARD_CONTENT_VERSION__ = CONTENT_VERSION;

    // --- CONFIG & STATE ---
    let STOP_LOSS = 0;
    let TARGET_RATING = 0;
    let STOP_LOSS_STREAK = 0;
    let USERNAME = "";
    let ZEN_MODE = false;
    let GAME_MODE = "blitz";
    let GUARD_ACTIVE = false;
    let COOLDOWN_ACTIVE = false;
    let COOLDOWN_SECONDS = 0;
    let RANDOM_STRING_UNLOCK = false;
    let RANDOM_STRING_LENGTH = 10;
    let LOCKOUT_DURATION = 0;
    let ANONYMIZE_OPPONENT = false;
    let ANONYMIZE_SELF = false;
    let ENHANCED_FOCUS_MODE = false;
    let LAST_ANONYMIZE_USERNAME = "";
    let LAST_RAW_DOCUMENT_TITLE = "";
    const ANONYMIZE_STYLE_ID = 'elo-guard-anonymize-opponent-style';
    const ANONYMOUS_BUTTON_ID = 'elo-guard-anonymous-opponent-button';
    const ENHANCED_FOCUS_BOARD_CLASS = 'elo-guard-enhanced-focus-board';
    const ENHANCED_FOCUS_TOP_CLOCK_CLASS = 'elo-guard-enhanced-focus-clock-top';
    const ENHANCED_FOCUS_BOTTOM_CLOCK_CLASS = 'elo-guard-enhanced-focus-clock-bottom';
    const ENHANCED_FOCUS_READY_CLASS = 'elo-guard-enhanced-focus-ready';
    const ENHANCED_FOCUS_STAGE_ID = 'elo-guard-enhanced-focus-stage';
    const ENHANCED_FOCUS_TOP_SLOT_CLASS = 'elo-guard-enhanced-focus-top-slot';
    const ENHANCED_FOCUS_BOARD_SLOT_CLASS = 'elo-guard-enhanced-focus-board-slot';
    const ENHANCED_FOCUS_BOTTOM_SLOT_CLASS = 'elo-guard-enhanced-focus-bottom-slot';
    const ENHANCED_FOCUS_TOGGLE_ID = 'elo-guard-enhanced-focus-toggle';
    const ENHANCED_FOCUS_ORIGINAL_PLACEMENTS = new WeakMap();
    let ENHANCED_FOCUS_MOVED_ELEMENTS = [];

    let consecutiveLosses = 0;
    let lockoutTimerId = null;
    let lockoutEndTime = 0;
    let lastKnownRating = null;
    let activeLockState = null; 

    let gameOverDetected = false;
    let isCooldownRunning = false;
    let cooldownTimerId = null;
    let cooldownEndTime = 0;
    const INSTANCE_ID_KEY = 'eloGuardInstanceId';
    const SESSION_COOLDOWN_END_KEY = 'eloGuardCooldownEndTime';
    let ELOGUARD_INSTANCE_ID = null;
    const LOSS_STREAK_KEY_PREFIX = 'eloGuardLossStreak';
    const LAST_RATING_KEY_PREFIX = 'eloGuardLastRating';
    const LOCKOUT_END_KEY = 'eloGuardLockoutEndTime';

    // --- INITIALIZATION ---
    try {
        ELOGUARD_INSTANCE_ID = sessionStorage.getItem(INSTANCE_ID_KEY);
        if (!ELOGUARD_INSTANCE_ID) {
            ELOGUARD_INSTANCE_ID = (crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`);
            sessionStorage.setItem(INSTANCE_ID_KEY, ELOGUARD_INSTANCE_ID);
        }
    } catch (e) {
        ELOGUARD_INSTANCE_ID = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    }

    const COOLDOWN_STORAGE_KEY = `eloGuardCooldownEnd:${ELOGUARD_INSTANCE_ID}`;

    // --- INJECT DYNAMIC CSS ---
    // This allows us to toggle visibility instantly without deleting text
    const style = document.createElement('style');
    style.innerHTML = `
        .elo-shield-zen .elo-guard-zen-hidden { display: none !important; }
        .elo-shield-zen [class*="rating"][class*="analysis"] { display: none !important; }
        .elo-shield-zen [class*="rating"][class*="review"] { display: none !important; }
        .elo-shield-anon-opponent .elo-guard-opponent-name {
            color: transparent !important;
            font-size: 0 !important;
            text-shadow: none !important;
            pointer-events: none !important;
        }
        .elo-shield-anon-opponent .elo-guard-opponent-name * {
            color: transparent !important;
            font-size: 0 !important;
            text-shadow: none !important;
        }
        .elo-shield-anon-opponent .elo-guard-opponent-rating,
        .elo-shield-anon-opponent .elo-guard-opponent-title,
        .elo-shield-anon-opponent .elo-guard-opponent-country,
        .elo-shield-anon-opponent .elo-guard-opponent-detail {
            display: none !important;
        }
        .elo-shield-anon-opponent .elo-guard-opponent-avatar {
            visibility: hidden !important;
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
        body.elo-guard-enhanced-focus {
            --elo-guard-clock-column-width: 190px;
            --elo-guard-board-size: min(calc(100vw - var(--elo-guard-clock-column-width) - var(--elo-guard-clock-column-width) - 64px), calc(100vh - 32px));
            background: #262522 !important;
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
        body.elo-guard-enhanced-focus wc-captured-pieces,
        body.elo-guard-enhanced-focus [class*="captured-pieces"],
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
            background: #262522 !important;
        }
        body.elo-guard-enhanced-focus #board-layout-player-top,
        body.elo-guard-enhanced-focus .board-layout-player-top,
        body.elo-guard-enhanced-focus #board-layout-player-bottom,
        body.elo-guard-enhanced-focus .board-layout-player-bottom {
            width: var(--elo-guard-board-size) !important;
            max-width: calc(100vw - 48px) !important;
            min-height: 32px !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            position: relative !important;
            inset: auto !important;
            transform: none !important;
            display: flex !important;
            align-items: center !important;
            justify-content: flex-end !important;
            visibility: visible !important;
            opacity: 1 !important;
            z-index: 2147483100 !important;
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
        body.elo-guard-enhanced-focus .clock-component,
        body.elo-guard-enhanced-focus [class*="clock"],
        body.elo-guard-enhanced-focus [data-cy*="clock"] {
            display: flex !important;
            visibility: visible !important;
            opacity: 1 !important;
            z-index: 2147483200 !important;
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
            position: fixed !important;
            left: max(16px, calc((100vw - var(--elo-guard-board-size)) / 2 - var(--elo-guard-clock-column-width) - 12px)) !important;
            right: auto !important;
            width: var(--elo-guard-clock-column-width) !important;
            min-width: 144px !important;
            min-height: 52px !important;
            box-sizing: border-box !important;
            align-items: center !important;
            justify-content: center !important;
            transform: none !important;
            visibility: visible !important;
            opacity: 1 !important;
            display: flex !important;
            outline: 2px solid rgba(255, 255, 255, 0.42) !important;
            box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.72), 0 10px 24px rgba(0, 0, 0, 0.42) !important;
            z-index: 2147483602 !important;
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
            left: calc((100vw - var(--elo-guard-board-size)) / 2) !important;
            top: max(16px, calc((100vh - var(--elo-guard-board-size)) / 2 - 48px)) !important;
            bottom: auto !important;
            transform: none !important;
        }
        body.elo-guard-enhanced-focus #board-layout-player-bottom,
        body.elo-guard-enhanced-focus .board-layout-player-bottom {
            position: fixed !important;
            left: calc((100vw - var(--elo-guard-board-size)) / 2) !important;
            top: auto !important;
            bottom: max(16px, calc((100vh - var(--elo-guard-board-size)) / 2 - 48px)) !important;
            transform: none !important;
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
            background: #262522 !important;
            visibility: visible !important;
            pointer-events: none !important;
        }
        body.elo-guard-enhanced-focus .elo-guard-enhanced-focus-top-slot,
        body.elo-guard-enhanced-focus .elo-guard-enhanced-focus-bottom-slot {
            grid-column: 1 !important;
            grid-row: 1 !important;
            width: var(--elo-guard-clock-column-width) !important;
            min-height: 48px !important;
            display: none !important;
            align-items: center !important;
            justify-content: flex-end !important;
            visibility: visible !important;
            pointer-events: none !important;
        }
        body.elo-guard-enhanced-focus .elo-guard-enhanced-focus-top-slot {
            align-self: start !important;
        }
        body.elo-guard-enhanced-focus .elo-guard-enhanced-focus-bottom-slot {
            align-self: end !important;
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
        body.elo-guard-enhanced-focus #elo-guard-enhanced-focus-stage .elo-guard-enhanced-focus-clock-top,
        body.elo-guard-enhanced-focus #elo-guard-enhanced-focus-stage .elo-guard-enhanced-focus-clock-bottom {
            position: relative !important;
            inset: auto !important;
            left: auto !important;
            top: auto !important;
            right: auto !important;
            bottom: auto !important;
            transform: none !important;
            display: flex !important;
            visibility: visible !important;
            opacity: 1 !important;
            margin: 0 !important;
            min-width: 144px !important;
            min-height: 52px !important;
            padding: 0 14px !important;
            align-items: center !important;
            justify-content: center !important;
            border: 2px solid rgba(255, 255, 255, 0.42) !important;
            border-radius: 6px !important;
            box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.72), 0 10px 24px rgba(0, 0, 0, 0.42) !important;
            z-index: 2147483601 !important;
        }
    `;
    document.head.appendChild(style);

    function loadSettings() {
        chrome.storage.sync.get(null, (data) => {
            USERNAME = data.username || "";
            ZEN_MODE = data.hideRatings || false;
            GAME_MODE = data.gameMode || "blitz";
            GUARD_ACTIVE = data.guardActive || false;
            COOLDOWN_ACTIVE = data.cooldownActive || false;
            COOLDOWN_SECONDS = parseInt(data.cooldownSeconds) || 0;
            RANDOM_STRING_UNLOCK = data.randomStringUnlock || false;
            RANDOM_STRING_LENGTH = parseInt(data.randomStringLength) || 10;
            LOCKOUT_DURATION = parseInt(data.lockoutDuration) || 0;
            ANONYMIZE_OPPONENT = data.anonymizeOpponent || false;
            ANONYMIZE_SELF = data.anonymizeSelf || false;
            ENHANCED_FOCUS_MODE = data.enhancedFocusMode || false;

            const stopKey = `stopLoss_${GAME_MODE}`;
            const targetKey = `targetRating_${GAME_MODE}`;
            const streakKey = `lossStreak_${GAME_MODE}`;
            STOP_LOSS = parseInt(data[stopKey]) || 0;
            TARGET_RATING = parseInt(data[targetKey]) || 0;
            STOP_LOSS_STREAK = parseInt(data[streakKey]) || 0;

            applyZenMode();
            applyOpponentAnonymization();
            applySelfAnonymization();
            applyEnhancedFocusMode();
            ensureEnhancedFocusToggle();

            if (!USERNAME) return;

            loadLossTrackingFromStorage(() => {

                console.log(`🛡️ EloGuard Loaded: ${USERNAME} | Mode: ${GAME_MODE}`);

                if (GUARD_ACTIVE) {
                    resumeCooldownFromStorage();
                    resumeLockoutFromStorage();
                    checkRating();
                } else {
                    activeLockState = null;
                    clearCooldownState();
                    unlockButton();
                }
            });
        });
    }
    window.addEventListener('eloGuard:reloadSettings', loadSettings);
    loadSettings();

    // --- TIMERS ---
    setInterval(() => { if (GUARD_ACTIVE) checkRating(); }, 30000); 

    // Fast Poll to enforce locks
    setInterval(() => {
        if (GUARD_ACTIVE && activeLockState) {
            lockOut(activeLockState.rating, activeLockState.type);
        }
    }, 200);

    setInterval(checkForGameOver, 100);
    
    // Process chat constantly so we wrap text even if Zen Mode is off initially.
    // This ensures that if you turn Zen Mode ON later, the text is already wrapped and ready to hide.
    setInterval(processChatForZen, 500);
    setInterval(() => {
        if (ENHANCED_FOCUS_MODE) {
            applyEnhancedFocusMode();
        } else {
            if (ANONYMIZE_OPPONENT) applyEnhancerStyleOpponentMask();
            if (ANONYMIZE_SELF) applyEnhancerStyleSelfMask();
        }
        ensureEnhancedFocusToggle();
    }, 1000);

    // --- LOGIC ---

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

    function createUnlockModal(onUnlock) {
        const existingModal = document.getElementById('elo-guard-unlock-modal');
        if (existingModal) existingModal.remove();

        const randomString = generateRandomString(RANDOM_STRING_LENGTH);

        const modal = document.createElement('div');
        modal.id = 'elo-guard-unlock-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999999;
            font-family: Arial, sans-serif;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: #2c2c2c;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
            max-width: 500px;
            width: 90%;
            text-align: center;
        `;

        const title = document.createElement('h2');
        title.innerText = '🔐 Unlock Required';
        title.style.cssText = 'color: #fff; margin: 0 0 10px 0; font-size: 24px;';

        const instruction = document.createElement('p');
        instruction.innerText = 'Type the following string exactly to unlock:';
        instruction.style.cssText = 'color: #ccc; margin: 10px 0; font-size: 14px;';

        const stringDisplay = document.createElement('div');
        stringDisplay.innerText = randomString;
        stringDisplay.style.cssText = `
            background: #1a1a1a;
            color: #4CAF50;
            padding: 15px;
            border-radius: 8px;
            font-family: 'Courier New', monospace;
            font-size: 18px;
            font-weight: bold;
            margin: 15px 0;
            letter-spacing: 2px;
            user-select: all;
            word-break: break-all;
        `;

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Type the string here...';
        input.style.cssText = `
            width: 100%;
            padding: 12px;
            border: 2px solid #555;
            border-radius: 8px;
            background: #1a1a1a;
            color: #fff;
            font-size: 16px;
            font-family: 'Courier New', monospace;
            box-sizing: border-box;
            margin: 10px 0;
        `;

        const unlockBtn = document.createElement('button');
        unlockBtn.innerText = 'Unlock';
        unlockBtn.disabled = true;
        unlockBtn.style.cssText = `
            width: 100%;
            padding: 12px;
            border: none;
            border-radius: 8px;
            background: #555;
            color: #999;
            font-size: 16px;
            font-weight: bold;
            cursor: not-allowed;
            margin-top: 10px;
            transition: all 0.3s ease;
        `;

        const matchIndicator = document.createElement('div');
        matchIndicator.style.cssText = `
            margin-top: 10px;
            font-size: 14px;
            height: 20px;
        `;

        input.addEventListener('input', () => {
            const matches = input.value === randomString;

            if (matches) {
                unlockBtn.disabled = false;
                unlockBtn.style.background = '#4CAF50';
                unlockBtn.style.color = '#fff';
                unlockBtn.style.cursor = 'pointer';
                matchIndicator.innerText = '✅ Match!';
                matchIndicator.style.color = '#4CAF50';
                input.style.borderColor = '#4CAF50';
            } else {
                unlockBtn.disabled = true;
                unlockBtn.style.background = '#555';
                unlockBtn.style.color = '#999';
                unlockBtn.style.cursor = 'not-allowed';
                matchIndicator.innerText = input.value ? '❌ No match' : '';
                matchIndicator.style.color = '#ff4d4d';
                input.style.borderColor = input.value ? '#ff4d4d' : '#555';
            }
        });

        unlockBtn.addEventListener('click', () => {
            if (input.value === randomString) {
                modal.remove();
                if (onUnlock) onUnlock();
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && input.value === randomString) {
                modal.remove();
                if (onUnlock) onUnlock();
            }
        });

        content.appendChild(title);
        content.appendChild(instruction);
        content.appendChild(stringDisplay);
        content.appendChild(input);
        content.appendChild(matchIndicator);
        content.appendChild(unlockBtn);
        modal.appendChild(content);
        document.body.appendChild(modal);

        setTimeout(() => input.focus(), 100);

        return modal;
    }

    async function checkForGameOver() {
        if (!GUARD_ACTIVE) return;

        const isGameOver = document.querySelector('[data-cy="game-over-modal-new-game-button"]')
            || document.querySelector('[data-cy="sidebar-rematch-button"]')
            || document.querySelector('[data-cy="sidebar-game-over-rematch-button"]')
            || document.querySelector('.game-over-controls');

        if (isGameOver) {
            if (!gameOverDetected) {
                console.log("🛡️ EloGuard: Game Over Detected.");
                gameOverDetected = true;

                if (activeLockState) return;

                // Check if game was aborted BEFORE freezing controls
                const isAborted = document.querySelector('.header-title-component')?.innerText?.includes('Game Aborted');

                if (isAborted) {
                    console.log("🛡️ EloGuard: Game Aborted - skipping cooldown.");
                    return;
                }

                freezeControls();
                const status = await checkRating(true);

                if (status === 'safe') {
                    if (COOLDOWN_ACTIVE && COOLDOWN_SECONDS > 0) {
                        startCooldown();
                    } else {
                        unfreezeControls();
                    }
                } else if (status === 'error') {
                    unfreezeControls();
                }
            }
        } else {
            gameOverDetected = false;
        }
    }

    async function checkRating(preventUnlock = false) {
        if (!USERNAME || !GUARD_ACTIVE) return 'error';

        try {
            const response = await fetch(`https://api.chess.com/pub/player/${USERNAME}/stats`);
            if (!response.ok) throw new Error('Network err');
            const data = await response.json();

            const modeData = data[`chess_${GAME_MODE}`];
            const currentRating = modeData?.last?.rating;

            if (!currentRating) return 'error';

            updateLossTracking(currentRating);

            if (STOP_LOSS_STREAK > 0 && consecutiveLosses >= STOP_LOSS_STREAK) {
                activeLockState = { type: "streak", rating: currentRating };
                lockOut(currentRating, "streak");
                return 'locked';
            }

            if (STOP_LOSS > 0 && currentRating <= STOP_LOSS) {
                activeLockState = { type: "stop", rating: currentRating };
                lockOut(currentRating, "stop");
                return 'locked';
            }
            else if (TARGET_RATING > 0 && currentRating >= TARGET_RATING) {
                activeLockState = { type: "win", rating: currentRating };
                lockOut(currentRating, "win");
                return 'locked';
            }
            else {
                activeLockState = null;
                if (!preventUnlock && !isCooldownRunning) {
                    unlockButton();
                }
                return 'safe';
            }
        } catch (e) {
            return 'error';
        }
    }

    // --- LOCKING VISUALS ---

    function lockOut(rating, type) {
        if (!GUARD_ACTIVE) return;

        const isWin = type === "win";
        const isStreak = type === "streak";
        const titleText = isWin ? "🏆 GOAL" : "🛑 STOP";
        const fullTitle = isWin ? `🏆 GOAL HIT (${rating})` : `🛑 STOP`;

        // Build subtext with optional timer
        let subText;
        if (isWin) {
            subText = "Target Hit";
        } else if (isStreak) {
            subText = `${consecutiveLosses} losses in a row, take a break`;
        } else {
            subText = "Stop Loss Hit";
        }

        // Start lockout timer for stop/streak types
        if (!isWin && LOCKOUT_DURATION > 0) {
            startLockoutTimer();
        }

        const color = isWin ? "#4CAF50" : "#ff4d4d";
        const bgColor = "#262626";

        lockButtonGeneric(fullTitle, subText, bgColor, type);
        lockHomeScreen(titleText, subText, bgColor, color);

        const locks = document.querySelectorAll('.elo-guard-locked');
        locks.forEach(btn => {
            btn.style.setProperty('background-color', bgColor, 'important');
            btn.style.setProperty('color', 'white', 'important');
            btn.style.setProperty('border-color', color, 'important');
            btn.style.setProperty('pointer-events', 'none', 'important');
            
            const titleEl = btn.querySelector('.elo-shield-title');
            if (titleEl) titleEl.style.color = color;
        });
    }

    function lockButtonGeneric(title, sub, bgColor, lockType = "generic") {
        if (!GUARD_ACTIVE) return;

        const selectors = [
            '[data-cy="new-game-index-play"]',           
            '[data-cy="game-over-modal-new-game-button"]', 
            '[data-cy="sidebar-rematch-button"]',        
            '[data-cy="sidebar-game-over-rematch-button"]',
            '[data-cy="game-over-modal-rematch-button"]',
            '.cc-button-primary.cc-button-x-large',
            'a.play-quick-links-link' 
        ];

        selectors.forEach(sel => {
            const els = document.querySelectorAll(sel);
            els.forEach(btn => {
                const text = (btn.innerText || "").toLowerCase();
                const href = (btn.getAttribute('href') || "").toLowerCase();
                
                if (text.includes("computer") || text.includes("bot") || text.includes("friend")) return;
                if (href.includes("/play/computer") || href.includes("/play/friend")) return;

                if (btn.classList.contains('play-quick-links-link')) {
                    if (btn.classList.contains('elo-guard-home-locked')) return;
                }

                if (btn.tagName !== "BUTTON" && btn.tagName !== "A" && btn.tagName !== "DIV") return;

                if (btn.tagName !== "BUTTON" && !btn.classList.contains('play-quick-links-link')) {
                     const innerBtn = btn.querySelector('button');
                     if (innerBtn) btn = innerBtn;
                }
                
                if (btn.getAttribute('data-elo-guard-lock') !== lockType || lockType === "cooldown") {
                    applyLockStyle(btn, title, sub, bgColor, lockType);
                }
            });
        });

        const plusIcons = document.querySelectorAll('[data-glyph="mark-plus"]');
        plusIcons.forEach(icon => {
            const btn = icon.closest('button');
            if (btn && (btn.getAttribute('data-elo-guard-lock') !== lockType || lockType === "cooldown")) {
                applyLockStyle(btn, title, sub, bgColor, lockType);
            }
        });
    }

    function applyLockStyle(btn, title, sub, bgColor, lockType = "generic") {
        if (!btn) return;
        if (!btn.getAttribute('data-original-html')) {
            btn.setAttribute('data-original-html', btn.innerHTML);
        }
        btn.classList.add('elo-guard-locked');
        btn.setAttribute('data-elo-guard-lock', lockType);

        if (lockType === "cooldown") btn.classList.add('elo-guard-cooldown');
        else btn.classList.remove('elo-guard-cooldown');

        btn.innerHTML = `
            <div class="elo-shield-content">
                <span class="elo-shield-title">${title}</span>
                <span class="elo-shield-subtitle">${sub}</span>
            </div>
        `;

        btn.style.backgroundColor = bgColor;
        btn.style.borderColor = bgColor;
        btn.style.color = "white";

        btn.style.pointerEvents = "none";
    }

    function freezeControls() {
        const selectors = [
            '[data-cy="new-game-index-play"]',
            '[data-cy="game-over-modal-new-game-button"]',
            '[data-cy="sidebar-rematch-button"]'
        ];
        selectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                el.style.pointerEvents = "none";
                el.style.opacity = "0.5";
            });
        });
    }

    function unfreezeControls() {
        if (activeLockState) return;
        unlockButton();
    }

    function unlockButton() {
        const lockedBtns = document.querySelectorAll('.elo-guard-locked, [data-elo-guard-lock]');
        lockedBtns.forEach(btn => {
            if (btn.classList.contains('elo-guard-locked')) {
                btn.classList.remove('elo-guard-locked');
                btn.classList.remove('elo-guard-cooldown');
                btn.removeAttribute('data-elo-guard-lock');
                
                btn.style.pointerEvents = "";
                btn.style.backgroundColor = "";
                btn.style.color = "";
                btn.style.borderColor = "";
                btn.style.opacity = "";

                const original = btn.getAttribute('data-original-html');
                if (original) btn.innerHTML = original;
                else btn.innerText = "Play"; 
            }
        });
        
        document.querySelectorAll('.elo-guard-home-locked').forEach(el => {
            el.classList.remove('elo-guard-home-locked');
            el.style.pointerEvents = "";
             const original = el.getAttribute('data-original-html');
             if (original) el.innerHTML = original;
        });

        const frozen = document.querySelectorAll('[data-cy="new-game-index-play"]');
        frozen.forEach(el => {
            el.style.pointerEvents = "";
            el.style.opacity = "";
        });
    }

    function startCooldown() {
        startCooldownWithDuration(COOLDOWN_SECONDS);
    }

    function startCooldownWithDuration(seconds, existingEndTime) {
        if (activeLockState) return;
        if (isCooldownRunning) return;
        if (!GUARD_ACTIVE || !COOLDOWN_ACTIVE || seconds <= 0) return;

        const now = Date.now();
        const effectiveEndTime = existingEndTime || cooldownEndTime || getSessionCooldownEndTime();
        
        if (effectiveEndTime && effectiveEndTime > now) cooldownEndTime = effectiveEndTime;
        else cooldownEndTime = now + seconds * 1000;

        isCooldownRunning = true;
        chrome.storage.local.set({ [COOLDOWN_STORAGE_KEY]: cooldownEndTime });
        setSessionCooldownEndTime(cooldownEndTime);

        const initialRemaining = Math.max(0, Math.ceil((cooldownEndTime - now) / 1000));
        applyCooldownLock(initialRemaining);

        cooldownTimerId = setInterval(() => {
            const remaining = Math.ceil((cooldownEndTime - Date.now()) / 1000);
            if (activeLockState) {
                clearCooldownState();
                return;
            }
            if (remaining <= 0) {
                clearCooldownState(true);
                unfreezeControls();
            } else {
                applyCooldownLock(remaining);
            }
        }, 1000);
    }

    function applyCooldownLock(seconds) {
        lockButtonGeneric("🧊 COOL DOWN", `Analyze.<br>${seconds}s`, "#2196F3", "cooldown");
        const existing = document.querySelectorAll('[data-elo-guard-lock="cooldown"]');
        existing.forEach(btn => {
            applyLockStyle(btn, "🧊 COOL DOWN", `Analyze.<br>${seconds}s`, "#2196F3", "cooldown");
        });
    }

    function resumeCooldownFromStorage() {
        if (!COOLDOWN_ACTIVE || !GUARD_ACTIVE) return;
        chrome.storage.local.get(COOLDOWN_STORAGE_KEY, (result) => {
            const storedEnd = parseInt(result[COOLDOWN_STORAGE_KEY], 10);
            if (storedEnd && storedEnd > Date.now()) {
                startCooldownWithDuration(0, storedEnd);
            }
        });
    }

    function clearCooldownState(clearStorage = true) {
        if (cooldownTimerId) clearInterval(cooldownTimerId);
        cooldownTimerId = null;
        isCooldownRunning = false;
        cooldownEndTime = 0;
        setSessionCooldownEndTime(0);
        if (clearStorage) chrome.storage.local.remove(COOLDOWN_STORAGE_KEY);
    }

    function getSessionCooldownEndTime() {
        try { return parseInt(sessionStorage.getItem(SESSION_COOLDOWN_END_KEY), 10) || 0; } catch(e){return 0;}
    }
    function setSessionCooldownEndTime(t) {
        try { sessionStorage.setItem(SESSION_COOLDOWN_END_KEY, String(t)); } catch(e){}
    }

    // --- LOCKOUT DURATION TIMER ---
    function formatTimeRemaining(ms) {
        const totalSeconds = Math.ceil(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) {
            return `${hours}h ${minutes}m ${seconds}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    }

    function formatUnlockTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function updateLockoutDisplay() {
        if (!lockoutEndTime || !activeLockState) return;

        const remaining = lockoutEndTime - Date.now();
        if (remaining <= 0) return;

        const isStreak = activeLockState.type === "streak";
        const baseText = isStreak
            ? `${consecutiveLosses} losses in a row, take a break`
            : "Stop Loss Hit";
        const countdownText = `${baseText}<br>${formatTimeRemaining(remaining)} · unlocks ${formatUnlockTime(lockoutEndTime)}`;

        // Update all locked buttons
        document.querySelectorAll('.elo-guard-locked .elo-shield-subtitle').forEach(el => {
            el.innerHTML = countdownText;
        });
        document.querySelectorAll('.elo-guard-home-locked .elo-home-sub').forEach(el => {
            el.innerHTML = countdownText;
        });
    }

    function startLockoutTimer() {
        if (LOCKOUT_DURATION <= 0) return;
        if (lockoutTimerId) return;

        const now = Date.now();
        if (!lockoutEndTime || lockoutEndTime <= now) {
            lockoutEndTime = now + LOCKOUT_DURATION * 60 * 1000;
        }

        chrome.storage.local.set({ [LOCKOUT_END_KEY]: lockoutEndTime });

        // Update display immediately
        updateLockoutDisplay();

        lockoutTimerId = setInterval(() => {
            const remaining = lockoutEndTime - Date.now();
            if (remaining <= 0) {
                clearLockoutTimer();
                activeLockState = null;
                resetLossStreak();
                unlockButton();
            } else {
                updateLockoutDisplay();
            }
        }, 1000);
    }

    function resumeLockoutFromStorage() {
        chrome.storage.local.get(LOCKOUT_END_KEY, (result) => {
            const storedEnd = parseInt(result[LOCKOUT_END_KEY], 10);
            if (!storedEnd) return;

            const now = Date.now();
            if (storedEnd > now) {
                // Lockout still active, resume timer
                lockoutEndTime = storedEnd;
                startLockoutTimer();
            } else {
                // Lockout expired while Chrome was closed - unlock
                clearLockoutTimer();
                activeLockState = null;
                resetLossStreak();
                unlockButton();
            }
        });
    }

    function pauseLockoutTimer() {
        if (lockoutTimerId) clearInterval(lockoutTimerId);
        lockoutTimerId = null;
        // Keep lockoutEndTime and storage intact so it can resume
    }

    function clearLockoutTimer() {
        if (lockoutTimerId) clearInterval(lockoutTimerId);
        lockoutTimerId = null;
        lockoutEndTime = 0;
        chrome.storage.local.remove(LOCKOUT_END_KEY);
    }

    function getLossStreakKey() {
        if (!USERNAME) return null;
        return `${LOSS_STREAK_KEY_PREFIX}:${USERNAME}:${GAME_MODE}`;
    }

    function getLastRatingKey() {
        if (!USERNAME) return null;
        return `${LAST_RATING_KEY_PREFIX}:${USERNAME}:${GAME_MODE}`;
    }

    function loadLossTrackingFromStorage(onLoaded) {
        const streakKey = getLossStreakKey();
        const ratingKey = getLastRatingKey();
        if (!streakKey || !ratingKey) {
            consecutiveLosses = 0;
            lastKnownRating = null;
            if (typeof onLoaded === 'function') onLoaded();
            return;
        }

        chrome.storage.local.get([streakKey, ratingKey], (res) => {
            const storedStreak = parseInt(res[streakKey], 10);
            const storedRating = parseInt(res[ratingKey], 10);

            consecutiveLosses = Number.isFinite(storedStreak) ? storedStreak : 0;
            lastKnownRating = Number.isFinite(storedRating) ? storedRating : null;
            if (typeof onLoaded === 'function') onLoaded();
        });
    }

    function persistLossTracking() {
        const streakKey = getLossStreakKey();
        const ratingKey = getLastRatingKey();
        if (!streakKey || !ratingKey) return;

        const payload = {};
        payload[streakKey] = consecutiveLosses;
        payload[ratingKey] = lastKnownRating;
        chrome.storage.local.set(payload);
    }

    function resetLossTracking() {
        const streakKey = getLossStreakKey();
        const ratingKey = getLastRatingKey();

        consecutiveLosses = 0;
        lastKnownRating = null;

        if (!streakKey || !ratingKey) return;
        chrome.storage.local.remove([streakKey, ratingKey]);
    }

    function updateLossTracking(currentRating) {
        if (currentRating === undefined || currentRating === null) return 0;

        let diff = 0;
        if (lastKnownRating !== null && lastKnownRating !== undefined) {
            diff = currentRating - lastKnownRating;

            if (diff < 0) {
                consecutiveLosses += 1;
            } else if (diff > 0) {
                consecutiveLosses = 0;
            }
        }

        lastKnownRating = currentRating;
        persistLossTracking();
        return diff;
    }

    function lockHomeScreen(title, sub, bgColor, color) {
        const homeLinks = document.querySelectorAll('.play-quick-links-title');
        homeLinks.forEach(span => {
            const text = span.innerText.trim();
            if (text === "New Game" || /^Play \d+\s*min/i.test(text)) {
                const parent = span.closest('a') || span.parentElement;
                if (parent && !parent.classList.contains('elo-guard-home-locked')) {
                    if (!parent.getAttribute('data-original-html')) parent.setAttribute('data-original-html', parent.innerHTML);
                    parent.classList.add('elo-guard-home-locked');
                    parent.innerHTML = `
                        <div class="elo-guard-locked" style="background-color: ${bgColor} !important; border: 3px solid ${color} !important; width: 100%; height: 100%;">
                             <div style="text-align:center;">
                                <span style="font-size: 16px; font-weight: 900; display:block; color:${color};">${title}</span>
                                <span class="elo-home-sub" style="font-size: 10px; color: #ccc;">${sub}</span>
                            </div>
                        </div>`;

                    parent.style.pointerEvents = "none";
                }
            }
        });
    }

    // --- ZEN & HELPERS (NEW "WRAP & HIDE" STRATEGY) ---
    
    function processChatForZen() {
        // We do NOT check for ZEN_MODE here. 
        // We ALWAYS wrap the patterns. The CSS (.elo-shield-zen) decides if they are visible or not.
        
        const chatMsgs = document.querySelectorAll('.game-start-message-component, .game-over-message-component');
        
        chatMsgs.forEach(msg => {
            // Optimization: Don't process the same block twice if we've already scrubbed it completely
            // But patterns appear dynamically, so we mostly rely on replacement non-matching.
            if (msg.dataset.eloProcessed === "true") return;

            let html = msg.innerHTML;
            let changed = false;

            // 1. Wrap ( +12 )
            // Regex matches: ( +12 ) but ignores if it's already inside our hidden span
            const ratingChangeRegex = /(\(\s*[+-]?\d+\s*\))/g;
            if (html.match(ratingChangeRegex)) {
                // Verify it's not already wrapped
                if (!html.includes('elo-guard-zen-hidden')) {
                     html = html.replace(ratingChangeRegex, '<span class="elo-guard-zen-hidden">$1</span>');
                     changed = true;
                }
            }

            // 2. Wrap "win +10 / draw +0 / lose -10"
            const projectionRegex = /(win\s*[+-]?\d+\s*\/\s*draw\s*[+-]?\d+\s*\/\s*lose\s*[+-]?\d+)/gi;
            if (html.match(projectionRegex)) {
                 if (!html.includes('elo-guard-zen-hidden') || !html.match(new RegExp(`<span[^>]*>${projectionRegex.source}`))) {
                    html = html.replace(projectionRegex, '<span class="elo-guard-zen-hidden">$1</span>');
                    changed = true;
                }
            }

            // 3. Wrap "Your new Blitz rating is 1829."
            // Matches: "Your new [Word] rating is [<strong>Number</strong>] ."
            const newRatingRegex = /(Your new \w+ rating is\s*<strong[^>]*>.*?<\/strong>\s*\.?)/gi;
            if (html.match(newRatingRegex)) {
                 // Check if already wrapped to avoid infinite loops
                 // (Simple check: if the specific phrase is found OUTSIDE of a span class='elo-guard')
                 // Easier: just do the replace, if it works, great.
                 // We use a temporary placeholder check to ensure we don't double wrap.
                 if (!html.includes('<span class="elo-guard-zen-hidden">Your new')) {
                    html = html.replace(newRatingRegex, '<span class="elo-guard-zen-hidden">$1</span>');
                    changed = true;
                 }
            }

            if (changed) {
                msg.innerHTML = html;
                msg.dataset.eloProcessed = "true";
            }
        });
    }

    // --- OPPONENT ANONYMIZER ---

    const OPPONENT_IDENTITY_SELECTOR = [
        'a[href*="/member/"]',
        'a[href*="/players/"]',
        '[data-username]',
        '[data-user-name]',
        '[data-user-username]',
        '[data-player-username]',
        '[data-player-name]',
        '[data-cy*="username"]',
        '[data-cy*="user-name"]',
        '[data-cy*="player-name"]',
        '[class*="username"]',
        '[class*="user-name"]',
        '[class*="player-name"]',
        '[class*="playerName"]'
    ].join(',');

    const OPPONENT_DETAIL_SELECTOR = [
        '[class*="rating"]',
        '[data-cy*="rating"]',
        '[data-test*="rating"]',
        '.user-chess-title',
        '.user-tagline-title',
        '[class*="chess-title"]',
        '[class*="fide-title"]',
        '[data-cy*="title"]',
        '[class*="country"]',
        '[class*="flag"]',
        '[data-cy*="country"]',
        '[data-cy*="flag"]',
        '[class*="badge"]',
        '[class*="flair"]',
        '[class*="league"]',
        '[class*="membership"]',
        '[class*="online"]',
        '[class*="status"]',
        '[data-cy*="badge"]',
        '[data-cy*="flair"]',
        'img',
        '[class*="avatar"]',
        '[class*="profile-picture"]',
        '[class*="profile-image"]',
        '[class*="user-image"]'
    ].join(',');

    const OPPONENT_CONTAINER_SELECTORS = [
        '.player-playerContent',
        '.player-player-content',
        '[class*="playerContent"]',
        '[class*="player-content"]',
        '.board-player-component',
        '.board-player',
        '[class*="board-player"]',
        '.user-tagline-component',
        '.user-tagline',
        '[class*="user-tagline"]',
        '.player-tagline-component',
        '.player-tagline',
        '[class*="player-tagline"]',
        '.player-info-component',
        '.player-info',
        '[class*="player-info"]',
        '.player-name-component',
        '.player-row-component',
        '.player-row',
        '[class*="player-row"]',
        '.player-component',
        '[class*="player-component"]',
        '.board-layout-player',
        '[class*="board-layout-player"]',
        '.game-over-player-component',
        '.game-over-player',
        '[class*="game-over-player"]',
        '.live-game-start-component',
        '[class*="live-game-start"]',
        '.post-game-modal-header-player',
        '[class*="post-game-player"]',
        '.profile-card',
        '[class*="profile-card"]',
        '.user-popover',
        '[class*="user-popover"]'
    ];

    const BOARD_TOP_PLAYER_SELECTORS = [
        '.board-layout-player-top',
        '[class*="board-layout-player-top"]',
        '[data-cy*="board-layout-player-top"]',
        '.board-player-top',
        '[class*="board-player-top"]',
        '[class*="player-top"]',
        '[class*="top-player"]'
    ];

    const BOARD_BOTTOM_PLAYER_SELECTORS = [
        '.board-layout-player-bottom',
        '[class*="board-layout-player-bottom"]',
        '[data-cy*="board-layout-player-bottom"]',
        '.board-player-bottom',
        '[class*="board-player-bottom"]',
        '[class*="player-bottom"]',
        '[class*="bottom-player"]'
    ];

    const OPPONENT_MARK_CLASSES = [
        'elo-guard-opponent',
        'elo-guard-opponent-name',
        'elo-guard-opponent-rating',
        'elo-guard-opponent-title',
        'elo-guard-opponent-country',
        'elo-guard-opponent-avatar',
        'elo-guard-opponent-detail'
    ];

    const PRIVATE_ATTRIBUTE_STORE = {
        title: { had: 'eloGuardHadTitle', original: 'eloGuardOriginalTitle' },
        'aria-label': { had: 'eloGuardHadAriaLabel', original: 'eloGuardOriginalAriaLabel' },
        alt: { had: 'eloGuardHadAlt', original: 'eloGuardOriginalAlt' }
    };

    function normalizeIdentity(value) {
        return String(value || '').trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_-]/g, '');
    }

    function getUsernameFromHref(href) {
        if (!href) return '';

        try {
            const url = new URL(href, window.location.origin);
            const parts = url.pathname.split('/').filter(Boolean);
            const profileIndex = parts.findIndex(part => /^(member|members|player|players)$/i.test(part));
            if (profileIndex >= 0 && parts[profileIndex + 1]) {
                return decodeURIComponent(parts[profileIndex + 1]);
            }
        } catch (e) {
            const match = String(href).match(/\/(?:member|members|player|players)\/([^/?#]+)/i);
            if (match) return decodeURIComponent(match[1]);
        }

        return '';
    }

    function getIdentityTokensFromText(text) {
        const titleTokens = new Set(['GM', 'IM', 'FM', 'CM', 'NM', 'WGM', 'WIM', 'WFM', 'WCM']);
        return String(text || '')
            .replace(/\([^)]*\)/g, ' ')
            .replace(/[^\w-]+/g, ' ')
            .split(/\s+/)
            .map(token => token.trim())
            .filter(token => token && !titleTokens.has(token.toUpperCase()));
    }

    function getIdentityStrings(el) {
        if (!el || el.nodeType !== Node.ELEMENT_NODE) return [];

        const values = [];
        [
            'data-username',
            'data-user-name',
            'data-user-username',
            'data-player-username',
            'data-player-name',
            'username'
        ].forEach(attr => {
            const value = el.getAttribute(attr);
            if (value) values.push(value);
        });

        if (el.dataset) {
            Object.keys(el.dataset).forEach(key => {
                if (/username/i.test(key) && el.dataset[key]) values.push(el.dataset[key]);
            });
        }

        const hrefUsername = getUsernameFromHref(el.getAttribute('href'));
        if (hrefUsername) values.push(hrefUsername);

        const shouldReadText = el.matches(
            'a[href*="/member/"], a[href*="/players/"], [data-cy*="username"], [data-cy*="user-name"], [data-cy*="player-name"], [class*="username"], [class*="user-name"], [class*="player-name"], [class*="playerName"]'
        );
        if (shouldReadText) values.push(...getIdentityTokensFromText(el.textContent));

        return values.filter(Boolean);
    }

    function identityMatchesCurrentUser(value) {
        const own = normalizeIdentity(USERNAME);
        const candidate = normalizeIdentity(value);
        return Boolean(own && candidate && candidate === own);
    }

    function escapeRegExp(value) {
        return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function getOpponentNameCandidates() {
        const names = new Set();
        const rawTitle = document.title && !document.title.includes('Hidden game')
            ? document.title
            : LAST_RAW_DOCUMENT_TITLE;

        if (rawTitle) {
            const titleMatch = rawTitle.match(/Chess:\s*(.*?)\s+vs\s+(.*?)(?:\s+-\s+\d+)?$/i);
            if (titleMatch) {
                [titleMatch[1], titleMatch[2]].forEach(name => {
                    const trimmed = name.trim();
                    if (trimmed && !identityMatchesCurrentUser(trimmed)) names.add(trimmed);
                });
            }
        }

        document.querySelectorAll('img[alt^="Avatar of "]').forEach(img => {
            const name = (img.getAttribute('alt') || '').replace(/^Avatar of\s+/i, '').trim();
            if (name && !identityMatchesCurrentUser(name) && !/^opponent$/i.test(name) && !/^player$/i.test(name)) {
                names.add(name);
            }
        });

        return Array.from(names);
    }

    function anonymizeDocumentTitle(opponentNames) {
        if (!LAST_RAW_DOCUMENT_TITLE || !document.title.includes('Hidden game')) {
            LAST_RAW_DOCUMENT_TITLE = document.title;
        }

        if (!opponentNames.length) return;

        let nextTitle = LAST_RAW_DOCUMENT_TITLE || document.title;
        opponentNames.forEach(name => {
            nextTitle = nextTitle.replace(new RegExp(escapeRegExp(name), 'gi'), '');
        });
        nextTitle = nextTitle.replace(/\s+-\s*\d+\b/g, '');
        nextTitle = nextTitle.replace(/\s+vs\s+/i, ' vs ').replace(/Chess:\s*vs\s*/i, 'Chess: ');
        document.title = nextTitle;
    }

    function restoreDocumentTitle() {
        if (LAST_RAW_DOCUMENT_TITLE) {
            document.title = LAST_RAW_DOCUMENT_TITLE;
        }
    }

    function markElementsContainingOpponentNames(opponentNames) {
        if (!opponentNames.length) return;

        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                const text = node.nodeValue || '';
                if (!text.trim()) return NodeFilter.FILTER_REJECT;
                if (!opponentNames.some(name => text.toLowerCase().includes(name.toLowerCase()))) {
                    return NodeFilter.FILTER_REJECT;
                }

                const parent = node.parentElement;
                if (!parent || parent.closest('script, style, textarea, input')) return NodeFilter.FILTER_REJECT;
                if (elementContainsCurrentUser(parent)) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });

        const matches = [];
        while (walker.nextNode()) matches.push(walker.currentNode.parentElement);

        matches.forEach(el => {
            const container = findOpponentContainer(el);
            if (container && container !== document.body && container !== document.documentElement) {
                markOpponentDetails(container);
            }
            markOpponentName(el);
        });
    }

    function getTopOpponentRoot() {
        return document.querySelector('#board-layout-player-top')
            || document.querySelector('[class*="player-top"]')
            || document.querySelector('[class*="top-player"]');
    }

    function getBottomPlayerRoot() {
        return document.querySelector('#board-layout-player-bottom')
            || document.querySelector('[class*="player-bottom"]')
            || document.querySelector('[class*="bottom-player"]');
    }

    function getTopOpponentUsernameElement() {
        const root = getTopOpponentRoot();
        if (!root) return null;

        return root.querySelector('[data-test-element="user-tagline-username"]')
            || root.querySelector('.user-tagline-compact-username')
            || root.querySelector('[class*="user-username"]')
            || root.querySelector('[class*="username"]');
    }

    function applyEnhancerStyleOpponentMask() {
        if (!document.body) return;

        document.body.classList.add('elo-shield-anon-opponent');
        injectEnhancerStyleAnonymizerCss();
        removeEnhancerStyleOpponentMask();
        const opponentRoot = getTopOpponentRoot();
        if (opponentRoot) maskPrivateAttributes(opponentRoot);
    }

    function removeEnhancerStyleOpponentMask() {
        document.getElementById(ANONYMOUS_BUTTON_ID)?.remove();
    }

    function applyEnhancerStyleSelfMask() {
        if (!document.body) return;

        document.body.classList.add('elo-shield-anon-self');
        injectEnhancerStyleAnonymizerCss();
        const selfRoot = getBottomPlayerRoot();
        if (selfRoot) maskPrivateAttributes(selfRoot);
    }

    function removeEnhancerStyleSelfMask() {
        document.body.classList.remove('elo-shield-anon-self');
    }

    function placeAnonymousOpponentButton() {
        const root = getTopOpponentRoot();
        const usernameEl = getTopOpponentUsernameElement();
        if (!root || !usernameEl) return;

        let button = document.getElementById(ANONYMOUS_BUTTON_ID);
        if (!button) {
            button = document.createElement('button');
            button.id = ANONYMOUS_BUTTON_ID;
            button.type = 'button';
            button.textContent = '';
            button.title = '';
            button.addEventListener('click', () => {
                ANONYMIZE_OPPONENT = false;
                applyOpponentAnonymization();
                chrome.storage.sync.set({ anonymizeOpponent: false });
            });
            document.body.appendChild(button);
        }

        const rect = usernameEl.getBoundingClientRect();
        if (!rect.width && !rect.height) return;

        button.style.left = `${Math.round(rect.left + window.scrollX)}px`;
        button.style.top = `${Math.round(rect.top + window.scrollY)}px`;
        button.style.height = `${Math.max(18, Math.round(rect.height))}px`;
    }

    function injectEnhancerStyleAnonymizerCss() {
        let anonymizeStyle = document.getElementById(ANONYMIZE_STYLE_ID);
        if (!anonymizeStyle) {
            anonymizeStyle = document.createElement('style');
            anonymizeStyle.id = ANONYMIZE_STYLE_ID;
            document.head.appendChild(anonymizeStyle);
        }

        anonymizeStyle.textContent = `
            .elo-shield-anon-opponent #board-layout-player-top .player-playerContent,
            .elo-shield-anon-opponent .board-layout-player-top .player-playerContent,
            .elo-shield-anon-opponent [class*="player-top"] .player-playerContent {
                min-width: 40px !important;
                min-height: 40px !important;
                pointer-events: none !important;
            }

            .elo-shield-anon-opponent #board-layout-player-top .player-playerContent > *,
            .elo-shield-anon-opponent .board-layout-player-top .player-playerContent > *,
            .elo-shield-anon-opponent [class*="player-top"] .player-playerContent > * {
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
            .elo-shield-anon-opponent [class*="player-top"] .user-tagline-compact-theatre {
                opacity: 0 !important;
                pointer-events: none !important;
            }

            .elo-shield-anon-opponent #board-layout-player-top .player-avatar,
            .elo-shield-anon-opponent [class*="player-top"] .player-avatar,
            .elo-shield-anon-opponent #board-layout-player-top .player-avatar-component,
            .elo-shield-anon-opponent [class*="player-top"] .player-avatar-component {
                background-image: url("https://www.chess.com/bundles/web/images/black_400.png") !important;
                background-size: cover !important;
                background-position: center !important;
            }

            .elo-shield-anon-opponent #board-layout-player-top .player-avatar img,
            .elo-shield-anon-opponent [class*="player-top"] .player-avatar img,
            .elo-shield-anon-opponent #board-layout-player-top img[data-cy="avatar"],
            .elo-shield-anon-opponent [class*="player-top"] img[data-cy="avatar"],
            .elo-shield-anon-opponent #board-layout-player-top .cc-avatar-img,
            .elo-shield-anon-opponent [class*="player-top"] .cc-avatar-img {
                display: none !important;
            }

            .elo-shield-anon-opponent #board-layout-player-top .rating-score-component,
            .elo-shield-anon-opponent [class*="player-top"] .rating-score-component,
            .elo-shield-anon-opponent #board-layout-player-top [data-cy*="rating"],
            .elo-shield-anon-opponent [class*="player-top"] [data-cy*="rating"],
            .elo-shield-anon-opponent #board-layout-player-top [data-test-element*="rating"],
            .elo-shield-anon-opponent [class*="player-top"] [data-test-element*="rating"],
            .elo-shield-anon-opponent #board-layout-player-top [class*="rating"],
            .elo-shield-anon-opponent [class*="player-top"] [class*="rating"],
            .elo-shield-anon-opponent #board-layout-player-top [class*="country"],
            .elo-shield-anon-opponent [class*="player-top"] [class*="country"],
            .elo-shield-anon-opponent #board-layout-player-top [class*="flag"],
            .elo-shield-anon-opponent [class*="player-top"] [class*="flag"],
            .elo-shield-anon-opponent #board-layout-player-top [class*="flair"],
            .elo-shield-anon-opponent [class*="player-top"] [class*="flair"],
            .elo-shield-anon-opponent #board-layout-player-top .cc-country-flag-component,
            .elo-shield-anon-opponent [class*="player-top"] .cc-country-flag-component,
            .elo-shield-anon-opponent #board-layout-player-top .flair-rpc-component,
            .elo-shield-anon-opponent [class*="player-top"] .flair-rpc-component {
                display: none !important;
            }

            .elo-shield-anon-self #board-layout-player-bottom .player-playerContent,
            .elo-shield-anon-self .board-layout-player-bottom .player-playerContent,
            .elo-shield-anon-self [class*="player-bottom"] .player-playerContent {
                min-width: 40px !important;
                min-height: 40px !important;
                pointer-events: none !important;
            }

            .elo-shield-anon-self #board-layout-player-bottom .player-playerContent > *,
            .elo-shield-anon-self .board-layout-player-bottom .player-playerContent > *,
            .elo-shield-anon-self [class*="player-bottom"] .player-playerContent > * {
                visibility: hidden !important;
            }

            .elo-shield-anon-self #board-layout-player-bottom .cc-user-block-component,
            .elo-shield-anon-self #board-layout-player-bottom .user-tagline-compact-theatre,
            .elo-shield-anon-self [class*="player-bottom"] .cc-user-block-component,
            .elo-shield-anon-self [class*="player-bottom"] .user-tagline-compact-theatre,
            .elo-shield-anon-self #board-layout-player-bottom [data-cy*="rating"],
            .elo-shield-anon-self [class*="player-bottom"] [data-cy*="rating"],
            .elo-shield-anon-self #board-layout-player-bottom [data-test-element*="rating"],
            .elo-shield-anon-self [class*="player-bottom"] [data-test-element*="rating"],
            .elo-shield-anon-self #board-layout-player-bottom [class*="rating"],
            .elo-shield-anon-self [class*="player-bottom"] [class*="rating"],
            .elo-shield-anon-self #board-layout-player-bottom [class*="country"],
            .elo-shield-anon-self [class*="player-bottom"] [class*="country"],
            .elo-shield-anon-self #board-layout-player-bottom [class*="flag"],
            .elo-shield-anon-self [class*="player-bottom"] [class*="flag"],
            .elo-shield-anon-self #board-layout-player-bottom [class*="flair"],
            .elo-shield-anon-self [class*="player-bottom"] [class*="flair"],
            .elo-shield-anon-self #board-layout-player-bottom .cc-country-flag-component,
            .elo-shield-anon-self [class*="player-bottom"] .cc-country-flag-component,
            .elo-shield-anon-self #board-layout-player-bottom .flair-rpc-component,
            .elo-shield-anon-self [class*="player-bottom"] .flair-rpc-component {
                display: none !important;
            }

            .elo-shield-anon-opponent .game-vs-animation-player-top .player-avatar-component {
                background-image: url("https://www.chess.com/bundles/web/images/black_400.png") !important;
                background-size: cover !important;
            }

            .elo-shield-anon-opponent .game-vs-animation-player-top .player-avatar-component > *,
            .elo-shield-anon-opponent .game-vs-animation-player-top > *:not(.player-avatar-component, .game-board-animation-player-middle) {
                visibility: hidden !important;
            }

            .elo-shield-anon-opponent .game-vs-animation-player-top .game-board-animation-player-username {
                color: transparent !important;
                position: relative !important;
            }

            .elo-shield-anon-opponent .game-vs-animation-player-top .game-board-animation-player-username::after {
                content: "";
                color: white !important;
                position: absolute !important;
                left: 0 !important;
                mix-blend-mode: difference !important;
            }

            body.elo-guard-enhanced-focus {
                --elo-guard-clock-column-width: 190px;
                --elo-guard-board-size: min(calc(100vw - var(--elo-guard-clock-column-width) - var(--elo-guard-clock-column-width) - 64px), calc(100vh - 32px));
                background: #262522 !important;
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
            body.elo-guard-enhanced-focus wc-captured-pieces,
            body.elo-guard-enhanced-focus [class*="captured-pieces"],
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
                background: #262522 !important;
            }

            body.elo-guard-enhanced-focus #board-layout-player-top,
            body.elo-guard-enhanced-focus .board-layout-player-top,
            body.elo-guard-enhanced-focus #board-layout-player-bottom,
            body.elo-guard-enhanced-focus .board-layout-player-bottom {
                width: var(--elo-guard-board-size) !important;
                max-width: calc(100vw - 48px) !important;
                min-height: 32px !important;
                height: auto !important;
                margin: 0 !important;
                padding: 0 !important;
                position: relative !important;
                inset: auto !important;
                transform: none !important;
                display: flex !important;
                align-items: center !important;
                justify-content: flex-end !important;
                visibility: visible !important;
                opacity: 1 !important;
                z-index: 2147483100 !important;
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

            body.elo-guard-enhanced-focus .clock-component,
            body.elo-guard-enhanced-focus [class*="clock"],
            body.elo-guard-enhanced-focus [data-cy*="clock"] {
                display: flex !important;
                visibility: visible !important;
                opacity: 1 !important;
                z-index: 2147483200 !important;
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
                position: fixed !important;
                left: max(16px, calc((100vw - var(--elo-guard-board-size)) / 2 - var(--elo-guard-clock-column-width) - 12px)) !important;
                right: auto !important;
                width: var(--elo-guard-clock-column-width) !important;
                min-width: 144px !important;
                min-height: 52px !important;
                box-sizing: border-box !important;
                align-items: center !important;
                justify-content: center !important;
                transform: none !important;
                visibility: visible !important;
                opacity: 1 !important;
                display: flex !important;
                outline: 2px solid rgba(255, 255, 255, 0.42) !important;
                box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.72), 0 10px 24px rgba(0, 0, 0, 0.42) !important;
                z-index: 2147483602 !important;
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
                left: calc((100vw - var(--elo-guard-board-size)) / 2) !important;
                top: max(16px, calc((100vh - var(--elo-guard-board-size)) / 2 - 48px)) !important;
                bottom: auto !important;
                transform: none !important;
            }

            body.elo-guard-enhanced-focus #board-layout-player-bottom,
            body.elo-guard-enhanced-focus .board-layout-player-bottom {
                position: fixed !important;
                left: calc((100vw - var(--elo-guard-board-size)) / 2) !important;
                top: auto !important;
                bottom: max(16px, calc((100vh - var(--elo-guard-board-size)) / 2 - 48px)) !important;
                transform: none !important;
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
                background: #262522 !important;
                visibility: visible !important;
                pointer-events: none !important;
            }

            body.elo-guard-enhanced-focus .elo-guard-enhanced-focus-top-slot,
            body.elo-guard-enhanced-focus .elo-guard-enhanced-focus-bottom-slot {
                grid-column: 1 !important;
                grid-row: 1 !important;
                width: var(--elo-guard-clock-column-width) !important;
                min-height: 48px !important;
                display: none !important;
                align-items: center !important;
                justify-content: flex-end !important;
                visibility: visible !important;
                pointer-events: none !important;
            }

            body.elo-guard-enhanced-focus .elo-guard-enhanced-focus-top-slot {
                align-self: start !important;
            }

            body.elo-guard-enhanced-focus .elo-guard-enhanced-focus-bottom-slot {
                align-self: end !important;
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

            body.elo-guard-enhanced-focus #elo-guard-enhanced-focus-stage .elo-guard-enhanced-focus-clock-top,
            body.elo-guard-enhanced-focus #elo-guard-enhanced-focus-stage .elo-guard-enhanced-focus-clock-bottom {
                position: relative !important;
                inset: auto !important;
                left: auto !important;
                top: auto !important;
                right: auto !important;
                bottom: auto !important;
                transform: none !important;
                display: flex !important;
                visibility: visible !important;
                opacity: 1 !important;
                margin: 0 !important;
                min-width: 144px !important;
                min-height: 52px !important;
                padding: 0 14px !important;
                align-items: center !important;
                justify-content: center !important;
                border: 2px solid rgba(255, 255, 255, 0.42) !important;
                border-radius: 6px !important;
                box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.72), 0 10px 24px rgba(0, 0, 0, 0.42) !important;
                z-index: 2147483601 !important;
            }

            #${ANONYMOUS_BUTTON_ID} {
                position: absolute !important;
                z-index: 2147483647 !important;
                border: 0 !important;
                padding: 0 6px !important;
                margin: 0 !important;
                background: transparent !important;
                color: #fff !important;
                font: inherit !important;
                font-weight: 700 !important;
                line-height: 1 !important;
                cursor: default !important;
                pointer-events: auto !important;
            }

            #${ANONYMOUS_BUTTON_ID}:hover {
                cursor: pointer !important;
            }
        `;
    }

    function elementIsCurrentUser(el) {
        return getIdentityStrings(el).some(identityMatchesCurrentUser);
    }

    function elementContainsCurrentUser(el) {
        if (!USERNAME || !el || el.nodeType !== Node.ELEMENT_NODE) return false;

        const identityElements = [];
        if (el.matches(OPPONENT_IDENTITY_SELECTOR)) identityElements.push(el);
        el.querySelectorAll(OPPONENT_IDENTITY_SELECTOR).forEach(child => identityElements.push(child));

        return identityElements.some(elementIsCurrentUser);
    }

    function findOpponentContainer(identityEl) {
        for (const selector of OPPONENT_CONTAINER_SELECTORS) {
            const container = identityEl.closest(selector);
            if (!container || container === document.body || container === document.documentElement) continue;
            if (!elementContainsCurrentUser(container)) return container;
        }

        return findNearestOpponentScope(identityEl);
    }

    function findNearestOpponentScope(identityEl) {
        let playerScope = identityEl;
        let node = identityEl.parentElement;
        let depth = 0;

        while (node && node !== document.body && node !== document.documentElement && depth < 8) {
            if (elementContainsCurrentUser(node)) break;
            if (isLikelyPlayerScope(node)) playerScope = node;

            if (node.querySelector(OPPONENT_DETAIL_SELECTOR)) {
                return node;
            }

            node = node.parentElement;
            depth += 1;
        }

        return playerScope;
    }

    function isLikelyPlayerScope(el) {
        if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;

        const descriptor = [
            el.id,
            el.getAttribute('class'),
            el.getAttribute('data-cy'),
            el.getAttribute('data-test'),
            el.getAttribute('role')
        ].filter(Boolean).join(' ');

        return /board|game|opponent|player|tagline|user/i.test(descriptor);
    }

    function dataAttributeName(datasetKey) {
        return `data-${datasetKey.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)}`;
    }

    function storeAndMaskAttribute(el, attr, value) {
        const store = PRIVATE_ATTRIBUTE_STORE[attr];
        if (!store || !el || el.nodeType !== Node.ELEMENT_NODE) return;

        if (!(store.had in el.dataset)) {
            const hadAttribute = el.hasAttribute(attr);
            el.dataset[store.had] = hadAttribute ? '1' : '0';
            if (hadAttribute) el.dataset[store.original] = el.getAttribute(attr) || '';
        }

        el.setAttribute(attr, value);
    }

    function maskPrivateAttributes(el) {
        storeAndMaskAttribute(el, 'title', '');
        storeAndMaskAttribute(el, 'aria-label', '');
        if (el.tagName === 'IMG') storeAndMaskAttribute(el, 'alt', '');
    }

    function restoreOpponentAttributes() {
        Object.entries(PRIVATE_ATTRIBUTE_STORE).forEach(([attr, store]) => {
            document.querySelectorAll(`[${dataAttributeName(store.had)}]`).forEach(el => {
                if (el.dataset[store.had] === '1') {
                    el.setAttribute(attr, el.dataset[store.original] || '');
                } else {
                    el.removeAttribute(attr);
                }
                delete el.dataset[store.had];
                delete el.dataset[store.original];
            });
        });
    }

    function addClassToMatches(root, selector, className) {
        const matches = [];
        if (root.matches && root.matches(selector)) matches.push(root);
        if (root.querySelectorAll) root.querySelectorAll(selector).forEach(el => matches.push(el));

        matches.forEach(el => {
            el.classList.add(className);
            maskPrivateAttributes(el);
        });
    }

    function markIdentityMatches(root) {
        const matches = [];
        if (root.matches && root.matches(OPPONENT_IDENTITY_SELECTOR)) matches.push(root);
        if (root.querySelectorAll) root.querySelectorAll(OPPONENT_IDENTITY_SELECTOR).forEach(el => matches.push(el));

        matches
            .filter(el => !matches.some(other => other !== el && other.contains(el)))
            .forEach(markOpponentName);
    }

    function getUniqueElements(selectors) {
        return [...new Set(selectors.flatMap(selector => Array.from(document.querySelectorAll(selector))))];
    }

    function markBoardOpponentRegions() {
        const topRegions = getUniqueElements(BOARD_TOP_PLAYER_SELECTORS)
            .filter(el => !elementContainsCurrentUser(el));
        const bottomRegions = getUniqueElements(BOARD_BOTTOM_PLAYER_SELECTORS)
            .filter(el => !elementContainsCurrentUser(el));

        const anyTopIsUser = USERNAME && getUniqueElements(BOARD_TOP_PLAYER_SELECTORS).some(elementContainsCurrentUser);
        const anyBottomIsUser = USERNAME && getUniqueElements(BOARD_BOTTOM_PLAYER_SELECTORS).some(elementContainsCurrentUser);

        if (anyTopIsUser && !anyBottomIsUser) {
            bottomRegions.forEach(markOpponentDetails);
            return;
        }

        if (anyBottomIsUser && !anyTopIsUser) {
            topRegions.forEach(markOpponentDetails);
            return;
        }

        topRegions.forEach(markOpponentDetails);
    }

    function markOpponentDetails(container) {
        container.classList.add('elo-guard-opponent');
        maskPrivateAttributes(container);

        markIdentityMatches(container);
        addClassToMatches(container, '[class*="rating"], [data-cy*="rating"], [data-test*="rating"]', 'elo-guard-opponent-rating');
        addClassToMatches(container, '.user-chess-title, .user-tagline-title, [class*="chess-title"], [class*="fide-title"], [data-cy*="title"]', 'elo-guard-opponent-title');
        addClassToMatches(container, '[class*="country"], [class*="flag"], [data-cy*="country"], [data-cy*="flag"]', 'elo-guard-opponent-country');
        addClassToMatches(container, 'img, [class*="avatar"], [class*="profile-picture"], [class*="profile-image"], [class*="user-image"]', 'elo-guard-opponent-avatar');
        addClassToMatches(container, '[class*="badge"], [class*="flair"], [class*="league"], [class*="membership"], [class*="online"], [class*="status"], [data-cy*="badge"], [data-cy*="flair"]', 'elo-guard-opponent-detail');
    }

    function markOpponentName(identityEl) {
        if (identityEl.closest('.elo-guard-opponent-name') && !identityEl.classList.contains('elo-guard-opponent-name')) {
            return;
        }

        const wasAlreadyMarked = identityEl.classList.contains('elo-guard-opponent-name');
        identityEl.classList.add('elo-guard-opponent-name');
        if (!wasAlreadyMarked) {
            const fontSize = window.getComputedStyle(identityEl).fontSize;
            if (fontSize) identityEl.style.setProperty('--elo-guard-opponent-name-size', fontSize);
        }
        maskPrivateAttributes(identityEl);
    }

    function clearOpponentMarks() {
        restoreOpponentAttributes();
        document.querySelectorAll(OPPONENT_MARK_CLASSES.map(className => `.${className}`).join(',')).forEach(el => {
            el.classList.remove(...OPPONENT_MARK_CLASSES);
        });
    }

    function processOpponentAnonymization() {
        if (!ANONYMIZE_OPPONENT || !document.body) return;

        applyEnhancerStyleOpponentMask();
    }

    function processSelfAnonymization() {
        if (!ANONYMIZE_SELF || !document.body) return;
        applyEnhancerStyleSelfMask();
    }

    function applyOpponentAnonymization() {
        if (!document.body) return;

        const normalizedUsername = normalizeIdentity(USERNAME);
        if (LAST_ANONYMIZE_USERNAME && LAST_ANONYMIZE_USERNAME !== normalizedUsername) {
            clearOpponentMarks();
        }
        LAST_ANONYMIZE_USERNAME = normalizedUsername;

        if (ANONYMIZE_OPPONENT) {
            document.body.classList.add('elo-shield-anon-opponent');
            applyEnhancerStyleOpponentMask();
        } else {
            document.body.classList.remove('elo-shield-anon-opponent');
            clearOpponentMarks();
            removeEnhancerStyleOpponentMask();
            restoreDocumentTitle();
        }
    }

    function applySelfAnonymization() {
        if (!document.body) return;

        if (ANONYMIZE_SELF) {
            applyEnhancerStyleSelfMask();
        } else {
            removeEnhancerStyleSelfMask();
        }
    }

    function applyEnhancedFocusLayout() {
        const stage = ensureEnhancedFocusStage();
        const boardEl = findEnhancedFocusBoardElement();

        if (boardEl) {
            moveEnhancedFocusElement(stage.boardSlot, boardEl, ENHANCED_FOCUS_BOARD_CLASS);
        }

        restoreLegacyEnhancedFocusStageClocks();
        markEnhancedFocusClocks();
        document.body.classList.add(ENHANCED_FOCUS_READY_CLASS);
    }

    function clearEnhancedFocusLayout() {
        document.body?.classList.remove(ENHANCED_FOCUS_READY_CLASS);
        clearEnhancedFocusClockMarks();

        const toggle = document.getElementById(ENHANCED_FOCUS_TOGGLE_ID);
        if (toggle && toggle.parentNode !== document.body) document.body.appendChild(toggle);

        ENHANCED_FOCUS_MOVED_ELEMENTS.forEach(restoreEnhancedFocusElement);
        ENHANCED_FOCUS_MOVED_ELEMENTS = [];

        document.getElementById(ENHANCED_FOCUS_STAGE_ID)?.remove();
    }

    function ensureEnhancedFocusStage() {
        let stage = document.getElementById(ENHANCED_FOCUS_STAGE_ID);

        if (!stage) {
            stage = document.createElement('div');
            stage.id = ENHANCED_FOCUS_STAGE_ID;

            const topSlot = document.createElement('div');
            topSlot.className = ENHANCED_FOCUS_TOP_SLOT_CLASS;

            const boardSlot = document.createElement('div');
            boardSlot.className = ENHANCED_FOCUS_BOARD_SLOT_CLASS;

            const bottomSlot = document.createElement('div');
            bottomSlot.className = ENHANCED_FOCUS_BOTTOM_SLOT_CLASS;

            stage.append(topSlot, boardSlot, bottomSlot);
            document.body.appendChild(stage);
        }

        return {
            stage,
            topSlot: stage.querySelector(`.${ENHANCED_FOCUS_TOP_SLOT_CLASS}`),
            boardSlot: stage.querySelector(`.${ENHANCED_FOCUS_BOARD_SLOT_CLASS}`),
            bottomSlot: stage.querySelector(`.${ENHANCED_FOCUS_BOTTOM_SLOT_CLASS}`)
        };
    }

    function ensureEnhancedFocusToggle() {
        if (!document.body) return null;

        let toggle = document.getElementById(ENHANCED_FOCUS_TOGGLE_ID);
        if (!toggle) {
            toggle = document.createElement('button');
            toggle.id = ENHANCED_FOCUS_TOGGLE_ID;
            toggle.type = 'button';
            toggle.addEventListener('click', () => {
                ENHANCED_FOCUS_MODE = !ENHANCED_FOCUS_MODE;
                chrome.storage.sync.set({ enhancedFocusMode: ENHANCED_FOCUS_MODE });
                applyEnhancedFocusMode();
            });
        }

        toggle.textContent = ENHANCED_FOCUS_MODE ? 'Exit focus' : 'Enhanced focus';
        toggle.title = ENHANCED_FOCUS_MODE ? 'Exit enhanced focus mode' : 'Enter enhanced focus mode';
        toggle.setAttribute('aria-pressed', ENHANCED_FOCUS_MODE ? 'true' : 'false');

        const stage = document.getElementById(ENHANCED_FOCUS_STAGE_ID);
        const parent = ENHANCED_FOCUS_MODE && stage ? stage : document.body;
        if (toggle.parentNode !== parent) parent.appendChild(toggle);

        return toggle;
    }

    function moveEnhancedFocusElement(slot, el, className) {
        if (!slot || !el) return;

        if (!ENHANCED_FOCUS_ORIGINAL_PLACEMENTS.has(el)) {
            ENHANCED_FOCUS_ORIGINAL_PLACEMENTS.set(el, {
                parent: el.parentNode,
                nextSibling: el.nextSibling,
                rect: el.getBoundingClientRect()
            });
            ENHANCED_FOCUS_MOVED_ELEMENTS.push(el);
        }

        el.classList.remove(
            ENHANCED_FOCUS_BOARD_CLASS,
            ENHANCED_FOCUS_TOP_CLOCK_CLASS,
            ENHANCED_FOCUS_BOTTOM_CLOCK_CLASS
        );
        el.classList.add(className);
        const moved = el.parentNode !== slot;
        slot.appendChild(el);
        if (moved) {
            requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
        }
    }

    function restoreEnhancedFocusElement(el) {
        if (!el) return;

        el.classList.remove(
            ENHANCED_FOCUS_BOARD_CLASS,
            ENHANCED_FOCUS_TOP_CLOCK_CLASS,
            ENHANCED_FOCUS_BOTTOM_CLOCK_CLASS
        );

        const original = ENHANCED_FOCUS_ORIGINAL_PLACEMENTS.get(el);
        if (!original?.parent) return;

        if (original.nextSibling && original.nextSibling.parentNode === original.parent) {
            original.parent.insertBefore(el, original.nextSibling);
        } else {
            original.parent.appendChild(el);
        }
        ENHANCED_FOCUS_ORIGINAL_PLACEMENTS.delete(el);
    }

    function elementIsInsideEnhancedFocusStage(el) {
        return Boolean(el?.closest?.(`#${ENHANCED_FOCUS_STAGE_ID}`));
    }

    function elementIsEnhancedFocusStageChrome(el) {
        return el?.id === ENHANCED_FOCUS_STAGE_ID
            || el?.classList?.contains(ENHANCED_FOCUS_TOP_SLOT_CLASS)
            || el?.classList?.contains(ENHANCED_FOCUS_BOARD_SLOT_CLASS)
            || el?.classList?.contains(ENHANCED_FOCUS_BOTTOM_SLOT_CLASS);
    }

    function getEnhancedFocusSortRect(el) {
        return ENHANCED_FOCUS_ORIGINAL_PLACEMENTS.get(el)?.rect || el.getBoundingClientRect();
    }

    function getDirectSelectorMatch(selector) {
        return Array.from(document.querySelectorAll(selector))
            .find(isEnhancedFocusBoardCandidate);
    }

    function getFallbackBoardCandidates() {
        return Array.from(document.querySelectorAll('[id*="board"], [class*="board"]'))
            .filter(isEnhancedFocusBoardCandidate)
            .sort((a, b) => {
                const aRect = a.getBoundingClientRect();
                const bRect = b.getBoundingClientRect();
                return (bRect.width * bRect.height) - (aRect.width * aRect.height);
            });
    }

    function clearStaleEnhancedFocusClasses() {
        document.querySelectorAll(`.${ENHANCED_FOCUS_BOARD_CLASS}`).forEach(el => {
            if (!elementIsInsideEnhancedFocusStage(el)) {
                el.classList.remove(ENHANCED_FOCUS_BOARD_CLASS);
            }
        });
    }

    function clearEnhancedFocusClockMarks() {
        document.querySelectorAll(`.${ENHANCED_FOCUS_TOP_CLOCK_CLASS}, .${ENHANCED_FOCUS_BOTTOM_CLOCK_CLASS}`).forEach(el => {
            el.classList.remove(ENHANCED_FOCUS_TOP_CLOCK_CLASS, ENHANCED_FOCUS_BOTTOM_CLOCK_CLASS);
        });
    }

    function markEnhancedFocusClocks() {
        const clocks = getEnhancedFocusClockElements();
        const topClock = clocks[0] || null;
        const bottomClock = clocks.length > 1 ? clocks[clocks.length - 1] : null;

        document.querySelectorAll(`.${ENHANCED_FOCUS_TOP_CLOCK_CLASS}, .${ENHANCED_FOCUS_BOTTOM_CLOCK_CLASS}`).forEach(el => {
            const shouldBeTop = el === topClock;
            const shouldBeBottom = Boolean(bottomClock && bottomClock !== topClock && el === bottomClock);
            el.classList.toggle(ENHANCED_FOCUS_TOP_CLOCK_CLASS, shouldBeTop);
            el.classList.toggle(ENHANCED_FOCUS_BOTTOM_CLOCK_CLASS, shouldBeBottom);
        });

        if (topClock) {
            topClock.classList.add(ENHANCED_FOCUS_TOP_CLOCK_CLASS);
            topClock.classList.remove(ENHANCED_FOCUS_BOTTOM_CLOCK_CLASS);
        }
        if (bottomClock && bottomClock !== topClock) {
            bottomClock.classList.add(ENHANCED_FOCUS_BOTTOM_CLOCK_CLASS);
            bottomClock.classList.remove(ENHANCED_FOCUS_TOP_CLOCK_CLASS);
        }
    }

    function restoreLegacyEnhancedFocusStageClocks() {
        const stage = document.getElementById(ENHANCED_FOCUS_STAGE_ID);
        if (!stage) return;

        const legacyTopClock = stage.querySelector(`.${ENHANCED_FOCUS_TOP_CLOCK_CLASS}`);
        const legacyBottomClock = stage.querySelector(`.${ENHANCED_FOCUS_BOTTOM_CLOCK_CLASS}`);
        const topHost = document.querySelector('#board-layout-player-top, .board-layout-player-top, [class*="player-top"]');
        const bottomHost = document.querySelector('#board-layout-player-bottom, .board-layout-player-bottom, [class*="player-bottom"]');

        if (legacyTopClock && topHost && !topHost.contains(legacyTopClock)) {
            legacyTopClock.classList.remove(ENHANCED_FOCUS_TOP_CLOCK_CLASS);
            topHost.appendChild(legacyTopClock);
        }

        if (legacyBottomClock && bottomHost && !bottomHost.contains(legacyBottomClock)) {
            legacyBottomClock.classList.remove(ENHANCED_FOCUS_BOTTOM_CLOCK_CLASS);
            bottomHost.appendChild(legacyBottomClock);
        }
    }

    function findEnhancedFocusBoardElement() {
        clearStaleEnhancedFocusClasses();

        const directSelectors = [
            `.${ENHANCED_FOCUS_BOARD_CLASS}`,
            '#board-single',
            'wc-chess-board',
            'chess-board',
            '#board-layout-chessboard',
            '.board-layout-chessboard',
            '[class*="board-layout-chessboard"]',
            '[class*="board-layout-board"]',
            '[class*="chess-board"]'
        ];

        for (const selector of directSelectors) {
            const match = getDirectSelectorMatch(selector);
            if (match) return match;
        }

        return getFallbackBoardCandidates()[0] || null;
    }

    function isEnhancedFocusBoardCandidate(el) {
        if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
        if (elementIsEnhancedFocusStageChrome(el)) return false;
        if (el.closest('#board-layout-player-top, #board-layout-player-bottom, [class*="player-top"], [class*="player-bottom"], [class*="sidebar"]')) return false;

        const rect = el.getBoundingClientRect();
        if (rect.width < 240 || rect.height < 240) return false;

        const ratio = rect.width / rect.height;
        return ratio > 0.75 && ratio < 1.25;
    }

    function getEnhancedFocusClockElements() {
        const clocks = Array.from(document.querySelectorAll('.clock-component, [data-cy*="clock"], [class*="clock-component"], [class*="clock-"]'))
            .filter(el => {
                if (elementIsInsideEnhancedFocusStage(el)) return false;
                const rect = el.getBoundingClientRect();
                if (rect.width < 40 || rect.height < 20) return false;
                const text = `${el.textContent || ''} ${el.getAttribute('aria-label') || ''}`.trim();
                return /\d+\s*:\s*\d+/.test(text) || /\bclock\b/i.test(text);
            })
            .filter((el, index, all) => !all.some((other, otherIndex) => otherIndex !== index && other.contains(el)));

        return [...new Set(clocks)].sort((a, b) => getEnhancedFocusSortRect(a).top - getEnhancedFocusSortRect(b).top);
    }

    function applyEnhancedFocusMode() {
        if (!document.body) return;

        if (ENHANCED_FOCUS_MODE) {
            document.body.classList.add('elo-guard-enhanced-focus');
            document.body.classList.add('elo-shield-anon-opponent');
            document.body.classList.add('elo-shield-anon-self');
            injectEnhancerStyleAnonymizerCss();
            const opponentRoot = getTopOpponentRoot();
            const selfRoot = getBottomPlayerRoot();
            if (opponentRoot) maskPrivateAttributes(opponentRoot);
            if (selfRoot) maskPrivateAttributes(selfRoot);
            removeEnhancerStyleOpponentMask();
            applyEnhancedFocusLayout();
            ensureEnhancedFocusToggle();
        } else {
            document.body.classList.remove('elo-guard-enhanced-focus');
            clearEnhancedFocusLayout();
            ensureEnhancedFocusToggle();
            if (!ANONYMIZE_OPPONENT) document.body.classList.remove('elo-shield-anon-opponent');
            if (!ANONYMIZE_SELF) document.body.classList.remove('elo-shield-anon-self');
        }
    }

    function applyZenMode() {
        // Just toggles the global class. The CSS rules do the rest.
        if (ZEN_MODE) document.body.classList.add('elo-shield-zen');
        else document.body.classList.remove('elo-shield-zen');
        
        // Trigger a process pass immediately to catch anything currently on screen
        processChatForZen(); 
    }

    chrome.storage.onChanged.addListener((changes) => {
        if (changes.guardActive) {
            GUARD_ACTIVE = changes.guardActive.newValue;
            if (!GUARD_ACTIVE) {
                activeLockState = null;
                clearCooldownState();
                pauseLockoutTimer();
                unlockButton();
            } else {
                resumeLockoutFromStorage();
                checkRating();
            }
        }
        loadSettings();
    });

    (function hookSpa() {
        const wrap = (fn) => {
            const original = history[fn];
            history[fn] = function (...args) {
                const res = original.apply(this, args);
                if (GUARD_ACTIVE && activeLockState) {
                    setTimeout(() => lockOut(activeLockState.rating, activeLockState.type), 50);
                }
                return res;
            };
        };
        wrap('pushState');
        wrap('replaceState');
    })();
})();
