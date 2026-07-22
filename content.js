(() => {
    const CONTENT_VERSION = '2.1.5-pro-session-bracket-focus-button-v3';
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
    let SMART_TRAILING = true;
    let SMART_TRAILING_DIST = 0;
    let GOAL_EXTENSION_USED = false;
    let GOAL_EXTENSION_STATE_READY = false;
    let goalChoiceDismissed = false;
    let ANONYMIZE_OPPONENT = false;
    let ANONYMIZE_SELF = false;
    let ENHANCED_FOCUS_MODE = false;
    // CHEAT RISK DETECTION — DISABLED (feature turned off; code kept for reactivation).
    // Forced false so the opponent cheat-risk pill never renders. See loadSettings()
    // where the storage-driven assignment is commented out. Was: true
    let SHOW_RISK_PROFILE_PILL = false;
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
    const ENHANCED_FOCUS_MATERIAL_SLOT_CLASS = 'elo-guard-enhanced-focus-material-slot';
    const ENHANCED_FOCUS_TOP_MATERIAL_SLOT_CLASS = 'elo-guard-enhanced-focus-material-top-slot';
    const ENHANCED_FOCUS_BOTTOM_MATERIAL_SLOT_CLASS = 'elo-guard-enhanced-focus-material-bottom-slot';
    const ENHANCED_FOCUS_MATERIAL_CLASS = 'elo-guard-enhanced-focus-material';
    const ENHANCED_FOCUS_CLOCK_MIRROR_CLASS = 'elo-guard-focus-clock-mirror';
    const ENHANCED_FOCUS_NATIVE_CLOCK_CLASS = 'elo-guard-enhanced-focus-native-clock';
    const ENHANCED_FOCUS_TIMEBOX_CLASS = 'elo-guard-focus-timebox';
    const ENHANCED_FOCUS_TIMEBOX_ICON_CLASS = 'elo-guard-focus-timebox-icon';
    const ENHANCED_FOCUS_TIMEBOX_TEXT_CLASS = 'elo-guard-focus-timebox-text';
    const ENHANCED_FOCUS_TOGGLE_ID = 'elo-guard-enhanced-focus-toggle';
    const ENHANCED_FOCUS_FLIP_BUTTON_ID = 'elo-guard-enhanced-focus-flip';
    const ENHANCED_FOCUS_VISUAL_FLIPPED_CLASS = 'elo-guard-enhanced-focus-visual-flipped';
    const ENHANCED_FOCUS_ORIGINAL_PLACEMENTS = new WeakMap();
    let ENHANCED_FOCUS_MOVED_ELEMENTS = [];
    let ENHANCED_FOCUS_VISUAL_FLIPPED = false;
    let ENHANCED_FOCUS_OBSERVER = null;
    const ENHANCED_FOCUS_CLOCK_STATE = {
        topText: '',
        bottomText: '',
        activePosition: '',
        boardSignature: '',
        lastBoardFlipAt: 0
    };

    // Enhanced-focus toggle button: always pinned to the top-right.
    const ENHANCED_FOCUS_TOGGLE_LABEL_CLASS = 'elo-guard-focus-toggle-label';
    const ENHANCED_FOCUS_TOGGLE_CONTROL_VERSION = '3';

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
    const SESSION_ACTIVE_GAME_SEEN_KEY = 'eloGuardActiveGameSeenAt';
    const ACTIVE_GAME_SEEN_WINDOW_MS = 2 * 60 * 60 * 1000;
    let ELOGUARD_INSTANCE_ID = null;
    const LOSS_STREAK_KEY_PREFIX = 'eloGuardLossStreak';
    const LAST_RATING_KEY_PREFIX = 'eloGuardLastRating';
    const MATCHUP_FEEDBACK_KEY_PREFIX = 'eloGuardMatchupFeedback';
    const SESSION_PEAK_KEY_PREFIX = 'eloGuardSessionPeak';
    const GOAL_EXTENSION_KEY_PREFIX = 'smartGoalExtension';
    const SESSION_PEAK_MAX_AGE_MS = 12 * 60 * 60 * 1000;
    const GOAL_EXTENSION_PAUSE_SECONDS = 10;
    const GOAL_CHOICE_ID = 'elo-guard-goal-choice';
    const MATCHUP_FEEDBACK_MAX_ENTRIES = 250;
    const MATCHUP_FEEDBACK_RECENT_GAME_WINDOW_SECONDS = 45 * 60;
    const LOCKOUT_END_KEY = 'eloGuardLockoutEndTime';
    const LEGITIMACY_BADGE_ID = 'elo-guard-legitimacy-badge';
    const LEGITIMACY_TOOLTIP_ID = 'elo-guard-legitimacy-tooltip';
    const LEGITIMACY_CACHE_TTL_MS = 30 * 60 * 1000;
    const LEGITIMACY_FETCH_TIMEOUT_MS = 12000;
    const LEGITIMACY_MAX_ARCHIVES = 3;
    const LEGITIMACY_MAX_RECENT_GAMES = 60;
    const LEGITIMACY_PERFORMANCE_WINDOW_DAYS = 30;
    const LEGITIMACY_HOT_ACCURACY_WINDOW_HOURS = 24;
    const MATCHUP_ACTIVITY_WINDOW_DAYS = 7;
    const MATCHUP_FORM_WINDOW_DAYS = 3;
    const LEGITIMACY_CACHE = new Map();
    let LEGITIMACY_LAST_USERNAME = "";
    let LEGITIMACY_PENDING_USERNAME = "";
    let LEGITIMACY_REQUEST_ID = 0;
    let LEGITIMACY_LAST_RESULT = null;
    const LEGITIMACY_GRANTED_KEYS = new Set();
    const PRO_FEATURE_RISK_PROFILE = 'riskProfile';
    const PRO_FEATURE_GAME_REVIEW = 'gameReview';

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
        .elo-shield-zen .elo-guard-zen-hidden,
        .elo-shield-zen .elo-guard-zen-rating-text { display: none !important; }
        /* Hide the rating numbers shown next to players on the board and in the
           game review / analysis views (e.g. chess.com/game/live/...).
           The old [class*="rating"][class*="analysis"] rules never matched: chess.com's
           rating element (user-tagline-rating / cc-user-rating-*) contains "rating" but
           not "analysis"/"review", so a single-element compound selector can't hit it.
           Scope to chess.com's player + review containers so we only touch its ratings,
           never EloGuard's own UI (which uses elo-guard-/egr- class names, no "rating"). */
        .elo-shield-zen #board-layout-player-top [class*="rating"],
        .elo-shield-zen #board-layout-player-bottom [class*="rating"],
        .elo-shield-zen [class*="board-layout-player"] [class*="rating"],
        .elo-shield-zen [class*="board-player"] [class*="rating"],
        .elo-shield-zen [class*="player-top"] [class*="rating"],
        .elo-shield-zen [class*="player-bottom"] [class*="rating"],
        .elo-shield-zen [class*="user-tagline"] [class*="rating"],
        .elo-shield-zen [class*="player-tagline"] [class*="rating"],
        .elo-shield-zen [class*="review"] [class*="rating"],
        .elo-shield-zen [class*="analysis"] [class*="rating"],
        .elo-shield-zen [class*="game-review"] [class*="rating"],
        .elo-shield-zen [class*="analysis-sidebar"] [class*="rating"],
        .elo-shield-zen [data-cy*="review"] [class*="rating"],
        .elo-shield-zen [data-cy*="analysis"] [class*="rating"],
        .elo-shield-zen [class*="review"] [data-cy*="rating"],
        .elo-shield-zen [class*="analysis"] [data-cy*="rating"],
        .elo-shield-zen [class*="cc-user-rating"],
        .elo-shield-zen #board-layout-player-top [data-cy*="rating"],
        .elo-shield-zen #board-layout-player-bottom [data-cy*="rating"],
        .elo-shield-zen #board-layout-player-top [data-test-element*="rating"],
        .elo-shield-zen #board-layout-player-bottom [data-test-element*="rating"] { display: none !important; }
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
        #elo-guard-enhanced-focus-toggle .elo-guard-focus-toggle-label {
            display: inline-block !important;
            white-space: nowrap !important;
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
            // ===== CHEAT RISK DETECTION — DISABLED (feature turned off; code kept for reactivation) =====
            // The opponent "cheat risk" pill is disabled. SHOW_RISK_PROFILE_PILL is forced false here
            // so processOpponentLegitimacyDetector() early-returns and the badge never renders. All of
            // the detection code (processOpponentLegitimacyDetector, evaluate/calculateOpponentLegitimacy,
            // the render/position helpers, and the getCalibratedLegitimacyScore pipeline) is left intact.
            // TO RE-ENABLE: restore the storage-driven line below, flip the `let SHOW_RISK_PROFILE_PILL`
            // default back to true, and restore the popup toggle (#showRiskProfilePill) plus the Pro rows
            // in popup.html and the billing checkout pages. Search "CHEAT RISK DETECTION — DISABLED".
            // SHOW_RISK_PROFILE_PILL = data.showRiskProfilePill !== false;
            SHOW_RISK_PROFILE_PILL = false;

            const stopKey = `stopLoss_${GAME_MODE}`;
            const targetKey = `targetRating_${GAME_MODE}`;
            const streakKey = `lossStreak_${GAME_MODE}`;
            STOP_LOSS = parseInt(data[stopKey]) || 0;
            TARGET_RATING = parseInt(data[targetKey]) || 0;
            STOP_LOSS_STREAK = parseInt(data[streakKey]) || 0;
            SMART_TRAILING = data.smartTrailing !== false;
            SMART_TRAILING_DIST = parseInt(data['smartTrailingDist_' + GAME_MODE]) || 0;
            loadGoalExtensionState();

            applyZenMode();
            applyOpponentAnonymization();
            applySelfAnonymization();
            applyEnhancedFocusMode();
            applyRiskProfilePillVisibility();
            ensureEnhancedFocusToggle();
            processOpponentLegitimacyDetector();

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
            lockOut(activeLockState.rating, activeLockState.type, activeLockState);
        }
    }, 200);

    setInterval(checkForGameOver, 100);

    // Zen tagging tick. Two idle guards, both safe because a re-enable re-runs a full pass:
    //  - Skip while the tab is hidden (purely cosmetic hide/wrap — nothing to see).
    //  - Skip entirely when Zen (hide-ratings) is OFF. This drops the old "always wrap so
    //    toggling is instant" behaviour, but applyZenMode() already fires an immediate
    //    processChatForZen()/hideBoardRatingsForZen() pass the moment the setting flips on,
    //    and this tick resumes on the very next interval — so correctness is preserved.
    setInterval(() => {
        if (document.hidden || !ZEN_MODE) return;
        processChatForZen();
        hideBoardRatingsForZen();
    }, 500);
    setInterval(processOpponentLegitimacyDetector, 2000);
    // Cosmetic badge placement — skip while the tab is hidden.
    setInterval(() => { if (document.hidden) return; positionOpponentLegitimacyBadge(); }, 500);
    setInterval(() => {
        if (document.hidden) return; // cosmetic masks/toggle; nothing to render while hidden
        if (ENHANCED_FOCUS_MODE) {
            applyEnhancedFocusMode();
        } else {
            if (ANONYMIZE_OPPONENT) applyEnhancerStyleOpponentMask();
            if (ANONYMIZE_SELF) applyEnhancerStyleSelfMask();
        }
        ensureEnhancedFocusToggle();
    }, 1000);
    setInterval(() => {
        if (document.hidden) return;
        if (ENHANCED_FOCUS_MODE) syncEnhancedFocusCustomClocks();
    }, 250);

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

        if (hasActiveGameControls()) {
            rememberActiveGameSeen();
        }

        const isGameOver = document.querySelector('[data-cy="game-over-modal-new-game-button"]')
            || document.querySelector('[data-cy="sidebar-rematch-button"]')
            || document.querySelector('[data-cy="sidebar-game-over-rematch-button"]')
            || document.querySelector('.game-over-controls');

        if (isChessComReviewOrAnalysisRoute() && !activeGameWasSeenRecently()) {
            gameOverDetected = false;
            return;
        }

        if (isGameOver) {
            if (!gameOverDetected) {
                console.log("🛡️ EloGuard: Game Over Detected.");
                gameOverDetected = true;

                if (activeLockState) return;

                // Check if game was aborted BEFORE freezing controls
                const isAborted = document.querySelector('.header-title-component')?.innerText?.includes('Game Aborted');

                if (isAborted) {
                    clearActiveGameSeen();
                    console.log("🛡️ EloGuard: Game Aborted - skipping cooldown.");
                    return;
                }

                freezeControls();
                const status = await checkRating(true);

                if (status === 'safe') {
                    if (COOLDOWN_ACTIVE && COOLDOWN_SECONDS > 0) {
                        startCooldown();
                    } else {
                        clearActiveGameSeen();
                        unfreezeControls();
                    }
                } else if (status === 'error') {
                    unfreezeControls();
                    notifyRatingCheckFailed();
                }
            }
        } else {
            gameOverDetected = false;
        }
    }

    // Non-intrusive indication that we couldn't verify the rating (timeout / network /
    // stats missing). We fail OPEN — controls are already unfrozen above — so the user is
    // never stuck; this just tells them limits weren't enforced for this game. No new
    // notification framework: a console.warn, tooltips on the affected controls, and one
    // self-removing inline text badge.
    function notifyRatingCheckFailed() {
        console.warn("🛡️ EloGuard: couldn't verify your rating (chess.com stats unavailable) — controls unlocked, limits not enforced this game.");

        const message = "EloGuard couldn't verify your rating — limits not enforced this game.";
        const selectors = getGameStartLockSelectors("cooldown");
        const seen = new Set();
        selectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(candidate => {
                const el = normalizeLockTarget(candidate);
                if (!el || seen.has(el)) return;
                if (!shouldLockGameStartControl(el, "cooldown")) return;
                seen.add(el);
                el.setAttribute('title', message);
            });
        });

        try {
            if (!document.body) return;
            let notice = document.getElementById('elo-guard-rating-notice');
            if (!notice) {
                notice = document.createElement('div');
                notice.id = 'elo-guard-rating-notice';
                notice.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:999999;'
                    + 'max-width:280px;padding:10px 14px;border-radius:8px;'
                    + 'background:#262626;color:#fff;border:1px solid #ff9800;'
                    + 'font:13px/1.4 Arial,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,0.4);';
                document.body.appendChild(notice);
            }
            notice.textContent = '🛡️ ' + message;
            clearTimeout(notice._eloTimer);
            notice._eloTimer = setTimeout(() => notice.remove(), 6000);
        } catch (e) { /* DOM not available */ }
    }

    async function checkRating(preventUnlock = false) {
        if (!USERNAME || !GUARD_ACTIVE) return 'error';

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        try {
            const response = await fetch(`https://api.chess.com/pub/player/${USERNAME}/stats`, { signal: controller.signal });
            if (!response.ok) throw new Error('Network err');
            const data = await response.json();

            const modeData = data[`chess_${GAME_MODE}`];
            const currentRating = modeData?.last?.rating;

            if (!Number.isFinite(currentRating)) return 'error';

            const previousRating = lastKnownRating;
            const ratingDiff = updateLossTracking(currentRating);
            if (preventUnlock) {
                // MATCHUP ADVICE — DISABLED (chess.com TOS review pending). See the
                // banner above getMatchupMetric() for the full explanation. This
                // recorder only logged how the (now hidden) matchup recommendation
                // played out, so it's turned off with the feature. Re-enable together
                // with the matchup feature.
                // recordPostGameMatchupFeedback({
                //     previousRating,
                //     currentRating,
                //     ratingDiff
                // });
            }

            if (STOP_LOSS_STREAK > 0 && consecutiveLosses >= STOP_LOSS_STREAK) {
                activeLockState = { type: "streak", rating: currentRating };
                lockOut(currentRating, "streak");
                return 'locked';
            }

            // Trailing stop-loss (Pro). SMART_TRAILING_DIST is only ever written by
            // the popup's Pro-gated path, so its presence implies Pro — no entitlement
            // check needed here. It raises the effective floor toward the session peak
            // so given-back gains lock the board.
            let effectiveStop = STOP_LOSS;
            let trailingPeak = null;
            if (SMART_TRAILING && SMART_TRAILING_DIST > 0) {
                const peak = await readSessionPeak(currentRating);
                const trailingStop = peak - SMART_TRAILING_DIST;
                if (trailingStop > effectiveStop) effectiveStop = trailingStop;
                if (trailingStop > STOP_LOSS && currentRating <= trailingStop) trailingPeak = peak;
            }

            if (effectiveStop > 0 && currentRating <= effectiveStop) {
                activeLockState = trailingPeak !== null
                    ? { type: "stop", rating: currentRating, trailing: true, peak: trailingPeak }
                    : { type: "stop", rating: currentRating };
                lockOut(currentRating, "stop", activeLockState);
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
        } finally {
            clearTimeout(timeoutId);
        }
    }

    function removeGoalChoice() {
        const modal = document.getElementById(GOAL_CHOICE_ID);
        if (!modal) return;
        if (modal._eloCountdown) clearInterval(modal._eloCountdown);
        modal.remove();
    }

    function continueAfterGoal(rating) {
        if (!activeLockState || activeLockState.type !== 'win' || GOAL_EXTENSION_USED) return;
        const engine = window.EloGuardSessionBracket;
        if (!engine || typeof engine.computeGoalExtension !== 'function') return;

        const effectiveFloor = SMART_TRAILING_DIST > 0
            ? Math.max(STOP_LOSS, rating - SMART_TRAILING_DIST)
            : STOP_LOSS;
        const plan = engine.computeGoalExtension({
            rating,
            currentFloor: effectiveFloor,
            currentCeiling: TARGET_RATING,
            trailingDistance: SMART_TRAILING_DIST
        });
        const key = getGoalExtensionKey();

        GOAL_EXTENSION_USED = true;
        GOAL_EXTENSION_STATE_READY = true;
        STOP_LOSS = plan.floor;
        TARGET_RATING = plan.ceiling;
        SMART_TRAILING_DIST = plan.trailingDistance;
        activeLockState = null;
        goalChoiceDismissed = false;
        removeGoalChoice();

        if (key) {
            chrome.storage.local.set({
                [key]: {
                    used: true,
                    floor: plan.floor,
                    ceiling: plan.ceiling,
                    extendedAt: Date.now()
                }
            });
        }
        chrome.storage.sync.set({
            [`stopLoss_${GAME_MODE}`]: String(plan.floor),
            [`targetRating_${GAME_MODE}`]: String(plan.ceiling),
            [`smartTrailingDist_${GAME_MODE}`]: plan.trailingDistance
        });
        unlockButton();
    }

    function showGoalChoice(rating) {
        // The extension belongs only to a Smart Bracket target. Floor/streak locks
        // never call this path, and a second target hit is final for the session.
        const engine = window.EloGuardSessionBracket;
        if (!engine || typeof engine.shouldOfferGoalExtension !== 'function') return;
        if (!engine.shouldOfferGoalExtension({
            lockType: activeLockState?.type,
            trailingDistance: SMART_TRAILING_DIST,
            stateReady: GOAL_EXTENSION_STATE_READY,
            used: GOAL_EXTENSION_USED,
            dismissed: goalChoiceDismissed
        })) return;
        if (document.getElementById(GOAL_CHOICE_ID)) return;

        const modal = document.createElement('section');
        modal.id = GOAL_CHOICE_ID;
        modal.className = 'elo-guard-goal-choice';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'elo-guard-goal-choice-title');

        const card = document.createElement('div');
        card.className = 'elo-guard-goal-choice-card';
        const eyebrow = document.createElement('div');
        eyebrow.className = 'elo-guard-goal-choice-eyebrow';
        eyebrow.textContent = 'TARGET REACHED';
        const title = document.createElement('h2');
        title.id = 'elo-guard-goal-choice-title';
        title.textContent = `You banked the win at ${rating}`;
        const copy = document.createElement('p');
        copy.textContent = 'Ending here is the default. If you deliberately keep going, you get one smaller stretch target and a tighter floor.';
        const actions = document.createElement('div');
        actions.className = 'elo-guard-goal-choice-actions';
        const done = document.createElement('button');
        done.type = 'button';
        done.className = 'elo-guard-goal-choice-done';
        done.textContent = 'Done for now';
        done.addEventListener('click', () => {
            goalChoiceDismissed = true;
            removeGoalChoice();
        });
        const extend = document.createElement('button');
        extend.type = 'button';
        extend.className = 'elo-guard-goal-choice-extend';
        extend.disabled = true;

        let remaining = GOAL_EXTENSION_PAUSE_SECONDS;
        const renderCountdown = () => {
            extend.textContent = remaining > 0 ? `Continue once (${remaining}s)` : 'Continue once';
            extend.disabled = remaining > 0;
        };
        renderCountdown();
        modal._eloCountdown = setInterval(() => {
            remaining -= 1;
            renderCountdown();
            if (remaining <= 0) {
                clearInterval(modal._eloCountdown);
                modal._eloCountdown = null;
            }
        }, 1000);
        extend.addEventListener('click', () => continueAfterGoal(rating));

        actions.appendChild(done);
        actions.appendChild(extend);
        card.appendChild(eyebrow);
        card.appendChild(title);
        card.appendChild(copy);
        card.appendChild(actions);
        modal.appendChild(card);
        document.body.appendChild(modal);
    }

    // --- LOCKING VISUALS ---

    function lockOut(rating, type, lockState) {
        if (!GUARD_ACTIVE) return;

        const isWin = type === "win";
        const isStreak = type === "streak";
        const isTrailing = type === "stop" && lockState && lockState.trailing && Number.isFinite(lockState.peak);
        const titleText = isWin ? "🏆 GOAL" : "🛑 STOP";
        const fullTitle = isWin ? `🏆 GOAL HIT (${rating})` : `🛑 STOP`;

        // Build subtext with optional timer
        let subText;
        if (isWin) {
            subText = "Target Hit";
        } else if (isStreak) {
            subText = `${consecutiveLosses} losses in a row, take a break`;
        } else if (isTrailing) {
            const givenBack = Math.max(0, lockState.peak - rating);
            subText = `You peaked at ${lockState.peak} this session and you've given back ${givenBack} points since. EloGuard is locking in the rest, come back fresh.`;
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

        if (isWin) showGoalChoice(rating);
        else removeGoalChoice();

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

    function isChessComReviewOrAnalysisRoute() {
        const path = String(location.pathname || '').toLowerCase();
        const search = String(location.search || '').toLowerCase();
        return path.includes('/analysis')
            || /[?&](tab|view|mode)=(game-)?review\b/.test(search)
            || /[?&](tab|view|mode)=analysis\b/.test(search);
    }

    function rememberActiveGameSeen() {
        try { sessionStorage.setItem(SESSION_ACTIVE_GAME_SEEN_KEY, String(Date.now())); } catch (e) {}
    }

    function activeGameWasSeenRecently() {
        try {
            const seenAt = parseInt(sessionStorage.getItem(SESSION_ACTIVE_GAME_SEEN_KEY), 10);
            return Number.isFinite(seenAt) && (Date.now() - seenAt) <= ACTIVE_GAME_SEEN_WINDOW_MS;
        } catch (e) {
            return false;
        }
    }

    function clearActiveGameSeen() {
        try { sessionStorage.removeItem(SESSION_ACTIVE_GAME_SEEN_KEY); } catch (e) {}
    }

    function getGameStartLockSelectors(lockType = "generic") {
        const selectors = [
            '[data-cy="new-game-index-play"]',
            '[data-cy="game-over-modal-new-game-button"]',
            '[data-cy*="new-game"]',
            '[data-cy*="quick-play"]',
            '[data-cy*="play-online"]',
            'a[href*="/play/online"]',
            'a[href*="/play/live"]',
            '.cc-button-primary.cc-button-x-large',
            'a.play-quick-links-link'
        ];

        if (lockType !== "cooldown") {
            selectors.push(
                '[data-cy="sidebar-rematch-button"]',
                '[data-cy="sidebar-game-over-rematch-button"]',
                '[data-cy="game-over-modal-rematch-button"]',
                '[data-cy*="rematch"]'
            );
        }

        return selectors;
    }

    function normalizeLockTarget(el) {
        if (!el) return null;
        let target = el;
        const isActionTarget = (node) => {
            if (!node) return false;
            const tag = node.tagName;
            return tag === "BUTTON"
                || tag === "A"
                || tag === "DIV"
                || node.getAttribute?.('role') === 'button'
                || node.classList?.contains('play-quick-links-link');
        };

        if (!isActionTarget(target)) {
            target = target.closest?.('button,a,[role="button"],div') || target;
        }

        if (target.tagName !== "BUTTON"
            && target.tagName !== "A"
            && target.getAttribute?.('role') !== 'button'
            && !target.classList?.contains('play-quick-links-link')) {
            const innerBtn = target.querySelector?.('button,a,[role="button"]');
            if (innerBtn) target = innerBtn;
        }

        return target;
    }

    function getLockControlDescriptor(el) {
        if (!el) return '';
        return [
            el.getAttribute?.('data-cy'),
            el.getAttribute?.('data-test-element'),
            el.getAttribute?.('aria-label'),
            el.getAttribute?.('title'),
            el.className,
            el.textContent
        ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    }

    function isRematchControl(el) {
        const descriptor = getLockControlDescriptor(el);
        const href = String(el?.getAttribute?.('href') || '');
        return /\brematch\b/i.test(descriptor) || /rematch/i.test(href);
    }

    function isDisallowedGameStartTarget(el) {
        const descriptor = getLockControlDescriptor(el);
        const href = String(el?.getAttribute?.('href') || '').toLowerCase();
        return /\b(computer|bot|friend|lesson|puzzle|analysis|analyze|review|lichess|report|share|profile|settings)\b/i.test(descriptor)
            || href.includes('/play/computer')
            || href.includes('/play/friend')
            || href.includes('/analysis')
            || href.includes('/lessons')
            || href.includes('/puzzles');
    }

    function isNewOpponentGameControl(el) {
        if (!el || isRematchControl(el) || isDisallowedGameStartTarget(el)) return false;

        const descriptor = getLockControlDescriptor(el);
        const href = String(el.getAttribute?.('href') || '').toLowerCase();

        if (el.classList?.contains('play-quick-links-link')) return true;
        if (/\/play\/(online|live)(?:[/?#]|$)/i.test(href)) return true;
        if (/\b(new-game|newgame|quick-play|play-online|new-game-index-play|game-over-modal-new-game-button)\b/i.test(descriptor)) return true;
        if (/\b(new game|play online|quick game|start game|find match)\b/i.test(descriptor)) return true;
        if (/\bplay\s+\d+\s*(?:min|minute|m)\b/i.test(descriptor)) return true;
        if (/^\s*play\s*$/i.test(el.textContent || '') && /cc-button-primary|play/i.test(descriptor)) return true;

        return false;
    }

    function shouldLockGameStartControl(el, lockType = "generic") {
        if (!el) return false;
        if (isRematchControl(el)) return lockType !== "cooldown";
        return isNewOpponentGameControl(el);
    }

    function restoreLockedControl(btn, fallbackText = "Play") {
        if (!btn) return;
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
        else if (fallbackText) btn.innerText = fallbackText;
    }

    function releaseCooldownRematchControls() {
        document.querySelectorAll('[data-cy*="rematch"], [data-elo-guard-lock="cooldown"]').forEach(el => {
            const btn = normalizeLockTarget(el);
            if (!btn || !isRematchControl(btn)) return;
            if (btn.getAttribute('data-elo-guard-lock') === "cooldown") {
                restoreLockedControl(btn, "Rematch");
            }
            btn.style.pointerEvents = "";
            btn.style.opacity = "";
        });
    }

    let lockSelectorRegressionWarned = false;

    function lockButtonGeneric(title, sub, bgColor, lockType = "generic") {
        if (!GUARD_ACTIVE) return;

        const selectors = getGameStartLockSelectors(lockType);
        let lockableFound = 0;

        selectors.forEach(sel => {
            const els = document.querySelectorAll(sel);
            els.forEach(el => {
                const btn = normalizeLockTarget(el);
                if (!shouldLockGameStartControl(btn, lockType)) return;
                lockableFound++;

                if (btn.classList.contains('play-quick-links-link')) {
                    if (btn.classList.contains('elo-guard-home-locked')) return;
                }

                if (btn.getAttribute('data-elo-guard-lock') !== lockType || lockType === "cooldown") {
                    applyLockStyle(btn, title, sub, bgColor, lockType);
                }
            });
        });

        const plusIcons = document.querySelectorAll('[data-glyph="mark-plus"]');
        plusIcons.forEach(icon => {
            const btn = icon.closest('button');
            if (btn
                && !isRematchControl(btn)
                && !isDisallowedGameStartTarget(btn)) {
                lockableFound++;
                if (btn.getAttribute('data-elo-guard-lock') !== lockType || lockType === "cooldown") {
                    applyLockStyle(btn, title, sub, bgColor, lockType);
                }
            }
        });

        // Regression canary: if a lock is active and the page is showing game-over /
        // new-game UI (where lock targets are expected) yet nothing matched, chess.com
        // likely changed its markup and our selectors are stale. Warn once per page load.
        if (!lockableFound && !lockSelectorRegressionWarned && lockTargetsExpected()) {
            lockSelectorRegressionWarned = true;
            console.warn("🛡️ EloGuard: lock is active but found no lockable game-start controls — chess.com's markup may have changed and the lock selectors may be outdated.");
        }
    }

    function lockTargetsExpected() {
        return !!(document.querySelector('[data-cy="game-over-modal-new-game-button"]')
            || document.querySelector('[data-cy="sidebar-rematch-button"]')
            || document.querySelector('[data-cy="sidebar-game-over-rematch-button"]')
            || document.querySelector('.game-over-controls')
            || document.querySelector('[data-cy="new-game-index-play"]'));
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
        const selectors = getGameStartLockSelectors("cooldown");
        selectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(candidate => {
                const el = normalizeLockTarget(candidate);
                if (!shouldLockGameStartControl(el, "cooldown")) return;
                el.style.pointerEvents = "none";
                el.style.opacity = "0.5";
            });
        });
        releaseCooldownRematchControls();
    }

    function unfreezeControls() {
        if (activeLockState) return;
        unlockButton();
    }

    function unlockButton() {
        const lockedBtns = document.querySelectorAll('.elo-guard-locked, [data-elo-guard-lock]');
        lockedBtns.forEach(btn => {
            if (btn.classList.contains('elo-guard-locked')) {
                restoreLockedControl(btn);
            }
        });
        
        document.querySelectorAll('.elo-guard-home-locked').forEach(el => {
            el.classList.remove('elo-guard-home-locked');
            el.style.pointerEvents = "";
             const original = el.getAttribute('data-original-html');
             if (original) el.innerHTML = original;
        });

        const frozen = document.querySelectorAll('[data-cy="new-game-index-play"], [data-cy="game-over-modal-new-game-button"], [data-cy*="rematch"], a.play-quick-links-link');
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
        if (!GUARD_ACTIVE || !COOLDOWN_ACTIVE) return;

        const now = Date.now();
        const effectiveEndTime = existingEndTime || cooldownEndTime || getSessionCooldownEndTime();
        
        if (effectiveEndTime && effectiveEndTime > now) cooldownEndTime = effectiveEndTime;
        else {
            const duration = parseInt(seconds, 10) || 0;
            if (duration <= 0) return;
            cooldownEndTime = now + duration * 1000;
        }

        isCooldownRunning = true;
        chrome.storage.local.set({ [COOLDOWN_STORAGE_KEY]: cooldownEndTime });
        setSessionCooldownEndTime(cooldownEndTime);
        clearActiveGameSeen();

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
        releaseCooldownRematchControls();
        lockButtonGeneric("🧊 COOL DOWN", `Analyze.<br>${seconds}s`, "#2196F3", "cooldown");
        const existing = document.querySelectorAll('[data-elo-guard-lock="cooldown"]');
        existing.forEach(btn => {
            applyLockStyle(btn, "🧊 COOL DOWN", `Analyze.<br>${seconds}s`, "#2196F3", "cooldown");
        });
        releaseCooldownRematchControls();
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
                resetSessionPeak();
                resetGoalExtensionState();
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
                resetSessionPeak();
                resetGoalExtensionState();
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

    function getSessionPeakKey() {
        if (!USERNAME) return null;
        return `${SESSION_PEAK_KEY_PREFIX}:${USERNAME}:${GAME_MODE}`;
    }

    function getGoalExtensionKey() {
        if (!USERNAME) return null;
        return `${GOAL_EXTENSION_KEY_PREFIX}:${USERNAME}:${GAME_MODE}`;
    }

    function loadGoalExtensionState() {
        const key = getGoalExtensionKey();
        GOAL_EXTENSION_STATE_READY = false;
        if (!key) {
            GOAL_EXTENSION_USED = false;
            GOAL_EXTENSION_STATE_READY = true;
            return;
        }
        chrome.storage.local.get(key, (res) => {
            GOAL_EXTENSION_USED = !!res[key]?.used;
            GOAL_EXTENSION_STATE_READY = true;
        });
    }

    function resetGoalExtensionState() {
        const key = getGoalExtensionKey();
        GOAL_EXTENSION_USED = false;
        GOAL_EXTENSION_STATE_READY = true;
        goalChoiceDismissed = false;
        removeGoalChoice();
        if (key) chrome.storage.local.remove(key);
    }

    // Session-peak store for the trailing stop-loss. Returns the running peak
    // (max of the stored peak and the current rating) and persists it when it
    // changes. A stored peak older than 12h is treated as a fresh session.
    function readSessionPeak(currentRating) {
        return new Promise((resolve) => {
            const key = getSessionPeakKey();
            if (!key) { resolve(currentRating); return; }
            chrome.storage.local.get(key, (res) => {
                const stored = res[key];
                const now = Date.now();
                const valid = stored
                    && Number.isFinite(stored.peak)
                    && Number.isFinite(stored.ts)
                    && (now - stored.ts) <= SESSION_PEAK_MAX_AGE_MS;
                let peak;
                let persist;
                if (valid) {
                    peak = Math.max(stored.peak, currentRating);
                    persist = peak !== stored.peak;
                } else {
                    peak = currentRating;
                    persist = true;
                }
                if (persist) chrome.storage.local.set({ [key]: { peak, ts: now } });
                resolve(peak);
            });
        });
    }

    function resetSessionPeak() {
        const key = getSessionPeakKey();
        if (key) chrome.storage.local.remove(key);
    }

    function getMatchupFeedbackKey() {
        if (!USERNAME) return null;
        return `${MATCHUP_FEEDBACK_KEY_PREFIX}:${USERNAME}:${GAME_MODE}`;
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

    // MATCHUP ADVICE — DISABLED (see banner above getMatchupMetric): retained but no
    // longer called (its call site in checkRating() is commented out), and it
    // early-returns anyway because the result never carries `.matchup` now.
    async function recordPostGameMatchupFeedback(ratingInfo = {}, attempt = 0) {
        const feedbackKey = getMatchupFeedbackKey();
        if (!feedbackKey || !USERNAME || !LEGITIMACY_LAST_RESULT?.matchup) return;

        try {
            const games = await fetchRecentOpponentGames(encodeURIComponent(USERNAME));
            const latestRatedModeGame = games.find(game => (
                game?.rules === 'chess'
                && game.rated === true
                && game.time_class === GAME_MODE
                && Number.isFinite(game.end_time)
                && (Math.floor(Date.now() / 1000) - game.end_time) <= MATCHUP_FEEDBACK_RECENT_GAME_WINDOW_SECONDS
            ));

            if (!latestRatedModeGame) {
                if (attempt < 3) {
                    setTimeout(() => recordPostGameMatchupFeedback(ratingInfo, attempt + 1), 15000);
                }
                return;
            }

            const selfSide = getPlayerGameSide(latestRatedModeGame, normalizeIdentity(USERNAME));
            if (!selfSide) return;

            const opponentUsername = selfSide.opponent?.username || '';
            const expectedOpponent = LEGITIMACY_LAST_RESULT.username || '';
            if (expectedOpponent && normalizeIdentity(opponentUsername) !== normalizeIdentity(expectedOpponent)) {
                if (attempt < 3) {
                    setTimeout(() => recordPostGameMatchupFeedback(ratingInfo, attempt + 1), 15000);
                }
                return;
            }

            const entry = {
                id: latestRatedModeGame.url || `${latestRatedModeGame.end_time}:${normalizeIdentity(opponentUsername)}`,
                savedAt: Date.now(),
                mode: GAME_MODE,
                rated: true,
                gameUrl: latestRatedModeGame.url || '',
                endedAt: latestRatedModeGame.end_time,
                opponent: opponentUsername,
                result: normalizeGameResult(selfSide.player?.result),
                score: getResultScore(normalizeGameResult(selfSide.player?.result)),
                selfRating: parseInt(selfSide.player?.rating, 10) || null,
                opponentRating: parseInt(selfSide.opponent?.rating, 10) || null,
                previousRating: Number.isFinite(ratingInfo.previousRating) ? ratingInfo.previousRating : null,
                currentRating: Number.isFinite(ratingInfo.currentRating) ? ratingInfo.currentRating : null,
                ratingDiff: Number.isFinite(ratingInfo.ratingDiff) ? ratingInfo.ratingDiff : null,
                recommendation: LEGITIMACY_LAST_RESULT.matchup.verdict,
                matchupScore: LEGITIMACY_LAST_RESULT.matchup.score,
                riskScore: LEGITIMACY_LAST_RESULT.score,
                visibleVerdict: LEGITIMACY_LAST_RESULT.verdict,
                adjustedExpectedScore: LEGITIMACY_LAST_RESULT.matchup.odds?.adjustedExpectedScore ?? null,
                baseExpectedScore: LEGITIMACY_LAST_RESULT.matchup.odds?.baseExpectedScore ?? null,
                ratingEv: LEGITIMACY_LAST_RESULT.matchup.odds?.ratingDelta?.expected ?? null,
                accountRiskPenalty: LEGITIMACY_LAST_RESULT.matchup.riskPenalty?.points ?? null,
                poolTrap: LEGITIMACY_LAST_RESULT.matchup.poolTrap?.points ?? null,
                selfContext: LEGITIMACY_LAST_RESULT.matchup.self?.points ?? null,
                reasons: LEGITIMACY_LAST_RESULT.matchup.reasons || []
            };

            chrome.storage.local.get(feedbackKey, result => {
                const existing = Array.isArray(result?.[feedbackKey]) ? result[feedbackKey] : [];
                if (existing.some(item => item.id === entry.id)) return;
                const next = [entry, ...existing].slice(0, MATCHUP_FEEDBACK_MAX_ENTRIES);
                chrome.storage.local.set({ [feedbackKey]: next });
            });
        } catch (error) {
            console.warn('EloGuard: could not save matchup feedback', error);
        }
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

    // Tag the rating numbers next to both board players so Zen Mode can hide them.
    // Reuses the same player-root getters as the game-review feature (getTopOpponentRoot /
    // getBottomPlayerRoot resolve #board-layout-player-top/-bottom on live AND review pages),
    // so it stays in sync with where ratings actually render. Non-destructive: we only add a
    // class (never rewrite chess.com's live board HTML). The CSS above gates on .elo-shield-zen,
    // so tagging while Zen is off is inert and makes toggling it on instant.
    function hideBoardRatingsForZen() {
        [getTopOpponentRoot(), getBottomPlayerRoot()].forEach(root => {
            if (!root || !root.querySelectorAll) return;
            root.querySelectorAll('[class*="rating"], [data-cy*="rating"], [data-test-element*="rating"]')
                .forEach(el => el.classList.add('elo-guard-zen-hidden'));
        });
        tagPlainTextRatingsForZen();
    }

    function tagPlainTextRatingsForZen() {
        const roots = [
            getTopOpponentRoot(),
            getBottomPlayerRoot(),
            ...document.querySelectorAll([
                '[class*="game-review"]',
                '[data-cy*="game-review"]',
                '[class*="analysis-sidebar"]',
                '[class*="review"] [class*="player"]',
                '[class*="review"] [class*="user"]',
                '[class*="analysis"] [class*="player"]',
                '[class*="analysis"] [class*="user"]'
            ].join(','))
        ].filter(Boolean);
        [...new Set(roots)].forEach((root) => {
            if (root.closest?.('#elo-guard-review-panel')) return;
            root.querySelectorAll('span, div, strong, em, a, p').forEach((el) => {
                if (el.closest('#elo-guard-review-panel, #elo-guard-legitimacy-badge')) return;
                if (el.classList.contains('elo-guard-zen-hidden')) return;
                if (el.querySelector('[class*="username"], [class*="user-name"], [data-cy*="username"], [data-cy*="user-name"]')) return;
                const childElements = Array.from(el.children || [])
                    .filter((child) => !child.classList?.contains('elo-guard-zen-hidden'));
                if (childElements.length > 1) return;
                const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
                if (isZenRatingText(text) && hasZenPlayerContext(el)) {
                    el.classList.add('elo-guard-zen-rating-text');
                }
            });
        });
    }

    function isZenRatingText(text) {
        if (!text || text.length > 18) return false;
        const normalized = text.replace(/[()]/g, '').replace(/[,\u00a0]/g, '').trim();
        if (/^\d{3,4}$/.test(normalized)) {
            const value = parseInt(normalized, 10);
            return value >= 100 && value <= 3500;
        }
        return /^[+-]\d{1,3}$/.test(normalized);
    }

    function hasZenPlayerContext(el) {
        let cur = el;
        for (let i = 0; cur && i < 5; i++, cur = cur.parentElement) {
            const descriptor = [
                cur.id,
                cur.className,
                cur.getAttribute?.('data-cy'),
                cur.getAttribute?.('data-test-element'),
                cur.getAttribute?.('aria-label')
            ].join(' ');
            if (/elo-guard|egr-/i.test(descriptor)) return false;
            if (/\b(board-layout-player|board-player|game-review|analysis-sidebar|post-game|player|user|tagline|profile|rating)\b/i.test(descriptor)) {
                return true;
            }
        }
        return false;
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
        // Replace the opponent name with the 'Hidden game' sentinel (not a blank): both the
        // re-capture guard above and getOpponentNameCandidates() key off that exact string to
        // recognise an already-anonymised title. Blanking it would let this idempotent tick
        // overwrite LAST_RAW_DOCUMENT_TITLE with the stripped title and lose the real one.
        opponentNames.forEach(name => {
            nextTitle = nextTitle.replace(new RegExp(escapeRegExp(name), 'gi'), 'Hidden game');
        });
        nextTitle = nextTitle.replace(/\s+-\s*\d+\b/g, '');
        nextTitle = nextTitle.replace(/\s+vs\s+/i, ' vs ').replace(/Chess:\s*vs\s*/i, 'Chess: ');
        if (!nextTitle.includes('Hidden game')) nextTitle = 'Hidden game';
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
        anonymizeDocumentTitle(getOpponentNameCandidates());
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

    async function processOpponentLegitimacyDetector() {
        if (!document.body) return;

        if (!SHOW_RISK_PROFILE_PILL) {
            hideOpponentLegitimacyBadge();
            return;
        }

        const root = getTopOpponentRoot();
        const username = getCurrentOpponentUsername(root);
        if (!root || !username) {
            hideOpponentLegitimacyBadge();
            LEGITIMACY_LAST_USERNAME = "";
            LEGITIMACY_LAST_RESULT = null;
            return;
        }

        const normalizedUsername = normalizeIdentity(username);
        if (!normalizedUsername) {
            hideOpponentLegitimacyBadge();
            return;
        }
        const cacheKey = getLegitimacyCacheKey(normalizedUsername);

        const badge = ensureOpponentLegitimacyBadge();
        badge.dataset.cacheKey = cacheKey;
        badge.hidden = false;
        positionOpponentLegitimacyBadge();

        const cached = LEGITIMACY_CACHE.get(cacheKey);
        const hasFreshCachedResult = cached && Date.now() - cached.createdAt < LEGITIMACY_CACHE_TTL_MS;
        if (hasFreshCachedResult && LEGITIMACY_GRANTED_KEYS.has(cacheKey)) {
            renderOpponentLegitimacyResult(badge, cached.result);
            return;
        }

        // Non-consuming gate. We only spend the free daily check once we have an
        // actual result to show (see the .then below), so an opponent whose data
        // fails to load — or one you never look at — never wastes the check, and
        // an opponent already checked today stays viewable.
        const access = await getPremiumFeatureAccess(PRO_FEATURE_RISK_PROFILE, cacheKey);
        if (!isCurrentLegitimacyTarget(cacheKey, normalizedUsername)) return;
        if (!access.allowed) {
            if (hasFreshCachedResult && badge.dataset.state === 'ready' && badge.dataset.cacheKey === cacheKey) {
                return;
            }
            if (access.unavailable) {
                if (badge.dataset.state !== 'ready') renderOpponentLegitimacyLoading(badge, username);
                positionOpponentLegitimacyBadge();
                return;
            }
            renderOpponentLegitimacyPaywall(badge, username, access);
            positionOpponentLegitimacyBadge();
            return;
        }

        if (hasFreshCachedResult) {
            LEGITIMACY_GRANTED_KEYS.add(cacheKey);
            renderOpponentLegitimacyResult(badge, cached.result);
            return;
        }

        if (LEGITIMACY_LAST_USERNAME !== cacheKey) {
            LEGITIMACY_LAST_USERNAME = cacheKey;
            renderOpponentLegitimacyLoading(badge, username);
        }

        if (LEGITIMACY_PENDING_USERNAME === cacheKey) return;

        LEGITIMACY_PENDING_USERNAME = cacheKey;
        const requestId = ++LEGITIMACY_REQUEST_ID;

        evaluateOpponentLegitimacy(username)
            .then(async result => {
                LEGITIMACY_CACHE.set(cacheKey, {
                    createdAt: Date.now(),
                    result
                });

                if (requestId !== LEGITIMACY_REQUEST_ID) return;
                if (!SHOW_RISK_PROFILE_PILL) {
                    hideOpponentLegitimacyBadge();
                    return;
                }
                const currentRoot = getTopOpponentRoot();
                if (!currentRoot || normalizeIdentity(getCurrentOpponentUsername(currentRoot)) !== normalizedUsername) return;

                // Spend the free daily check now that we have a result. Idempotent
                // per opponent (cacheKey); a Pro user is never charged. If a race
                // (e.g. two tabs) exhausted the limit meanwhile, show the paywall
                // instead of a second free result.
                const grant = await consumePremiumFeature(PRO_FEATURE_RISK_PROFILE, cacheKey);
                const currentBadge = ensureOpponentLegitimacyBadge();
                if (!grant.allowed) {
                    if (currentBadge.dataset.state === 'ready' && currentBadge.dataset.cacheKey === cacheKey) {
                        return;
                    }
                    if (grant.unavailable) {
                        renderOpponentLegitimacyLoading(currentBadge, username);
                        positionOpponentLegitimacyBadge();
                        return;
                    }
                    renderOpponentLegitimacyPaywall(currentBadge, username, grant);
                    positionOpponentLegitimacyBadge();
                    return;
                }
                currentBadge.dataset.cacheKey = cacheKey;
                LEGITIMACY_GRANTED_KEYS.add(cacheKey);
                renderOpponentLegitimacyResult(currentBadge, result);
                positionOpponentLegitimacyBadge();
            })
            .catch(() => {
                if (requestId !== LEGITIMACY_REQUEST_ID) return;
                if (!SHOW_RISK_PROFILE_PILL) {
                    hideOpponentLegitimacyBadge();
                    return;
                }
                const currentRoot = getTopOpponentRoot();
                if (!currentRoot || normalizeIdentity(getCurrentOpponentUsername(currentRoot)) !== normalizedUsername) return;
                const currentBadge = ensureOpponentLegitimacyBadge();
                renderOpponentLegitimacyError(currentBadge, username);
                positionOpponentLegitimacyBadge();
            })
            .finally(() => {
                if (LEGITIMACY_PENDING_USERNAME === cacheKey) {
                    LEGITIMACY_PENDING_USERNAME = "";
                }
            });
    }

    function getLegitimacyCacheKey(normalizedOpponentUsername) {
        const selfKey = normalizeIdentity(USERNAME) || 'self-unknown';
        const modeKey = GAME_MODE || 'mode-unknown';
        return `${selfKey}:${modeKey}:${normalizedOpponentUsername}`;
    }

    function isCurrentLegitimacyTarget(cacheKey, normalizedUsername) {
        const currentRoot = getTopOpponentRoot();
        if (!currentRoot) return false;
        if (normalizeIdentity(getCurrentOpponentUsername(currentRoot)) !== normalizedUsername) return false;
        return getLegitimacyCacheKey(normalizedUsername) === cacheKey;
    }

    function ensureOpponentLegitimacyBadge() {
        let badge = document.getElementById(LEGITIMACY_BADGE_ID);
        if (badge) {
            // MATCHUP ADVICE — DISABLED (see banner above getMatchupMetric): the
            // matchup-text pill segment is no longer created. Re-enable by restoring this.
            // if (!badge.querySelector('.elo-guard-matchup-text')) {
            //     const matchupText = document.createElement('span');
            //     matchupText.className = 'elo-guard-matchup-text';
            //     badge.appendChild(matchupText);
            // }
            ensureOpponentLegitimacyTooltip(badge);
            return badge;
        }

        badge = document.createElement('div');
        badge.id = LEGITIMACY_BADGE_ID;
        badge.setAttribute('role', 'status');
        badge.setAttribute('aria-live', 'polite');
        badge.tabIndex = 0;

        const dot = document.createElement('span');
        dot.className = 'elo-guard-legitimacy-dot';

        const text = document.createElement('span');
        text.className = 'elo-guard-legitimacy-text';

        // MATCHUP ADVICE — DISABLED (see banner above getMatchupMetric): matchup-text
        // pill segment removed; badge now shows only dot + cheat-risk text.
        // const matchupText = document.createElement('span');
        // matchupText.className = 'elo-guard-matchup-text';

        badge.append(dot, text);
        ensureOpponentLegitimacyTooltip(badge);
        document.body.appendChild(badge);
        return badge;
    }

    function ensureOpponentLegitimacyTooltip(badge) {
        let tooltip = badge.querySelector('.elo-guard-legitimacy-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('pre');
            tooltip.id = LEGITIMACY_TOOLTIP_ID;
            tooltip.className = 'elo-guard-legitimacy-tooltip';
            tooltip.setAttribute('role', 'tooltip');
            badge.appendChild(tooltip);
        }

        badge.setAttribute('aria-describedby', LEGITIMACY_TOOLTIP_ID);
        if (!badge.hasAttribute('tabindex')) badge.tabIndex = 0;
        return tooltip;
    }

    function setOpponentLegitimacyTooltip(badge, text) {
        const tooltip = ensureOpponentLegitimacyTooltip(badge);
        tooltip.textContent = text || '';
        badge.removeAttribute('title');
    }

    function hideOpponentLegitimacyBadge() {
        const badge = document.getElementById(LEGITIMACY_BADGE_ID);
        if (badge) badge.hidden = true;
    }

    function renderOpponentLegitimacyLoading(badge, username) {
        clearOpponentLegitimacyPaywall(badge);
        badge.dataset.state = 'loading';
        badge.style.setProperty('--elo-guard-legitimacy-color', '#9b9b9b');
        // MATCHUP ADVICE — DISABLED (see banner above getMatchupMetric): no matchup pill segment.
        // badge.style.setProperty('--elo-guard-matchup-color', '#9b9b9b');
        badge.querySelector('.elo-guard-legitimacy-text').textContent = 'Risk ...';
        // badge.querySelector('.elo-guard-matchup-text').textContent = '';
        setOpponentLegitimacyTooltip(badge, `Checking public Chess.com account data for ${username}...`);
        badge.setAttribute('aria-label', `Checking cheat risk estimate for ${username}`);
    }

    function renderOpponentLegitimacyError(badge, username) {
        clearOpponentLegitimacyPaywall(badge);
        badge.dataset.state = 'error';
        badge.style.setProperty('--elo-guard-legitimacy-color', '#9b9b9b');
        // MATCHUP ADVICE — DISABLED (see banner above getMatchupMetric): no matchup pill segment.
        // badge.style.setProperty('--elo-guard-matchup-color', '#9b9b9b');
        badge.querySelector('.elo-guard-legitimacy-text').textContent = 'No data';
        // badge.querySelector('.elo-guard-matchup-text').textContent = '';
        setOpponentLegitimacyTooltip(badge, `Could not load enough public data for ${username}.`);
        badge.setAttribute('aria-label', `Cheat risk estimate unavailable for ${username}`);
    }

    function renderOpponentLegitimacyResult(badge, result) {
        clearOpponentLegitimacyPaywall(badge);
        badge.dataset.state = 'ready';
        LEGITIMACY_LAST_RESULT = {
            ...result,
            capturedAt: Date.now()
        };
        badge.style.setProperty('--elo-guard-legitimacy-color', result.color);
        // MATCHUP ADVICE — DISABLED (see banner above getMatchupMetric): the matchup
        // pill segment (colour + verdict text) and its aria-label clause are dropped.
        // badge.style.setProperty('--elo-guard-matchup-color', result.matchup.color);
        badge.querySelector('.elo-guard-legitimacy-text').textContent = `${result.verdict} ${result.score}/100`;
        // badge.querySelector('.elo-guard-matchup-text').textContent = result.matchup.displayText;
        setOpponentLegitimacyTooltip(badge, result.title);
        badge.setAttribute(
            'aria-label',
            `EloGuard cheat risk estimate for ${result.username}: ${result.verdict}, ${result.score} out of 100.`
        );
    }

    function renderOpponentLegitimacyPaywall(badge, username, access) {
        badge.dataset.state = 'pro-lock';
        badge.style.setProperty('--elo-guard-legitimacy-color', '#d6a13d');
        // MATCHUP ADVICE — DISABLED (see banner above getMatchupMetric): no matchup pill segment.
        // badge.style.setProperty('--elo-guard-matchup-color', '#d6a13d');
        badge.querySelector('.elo-guard-legitimacy-text').textContent = 'Upgrade';
        // badge.querySelector('.elo-guard-matchup-text').textContent = 'Upgrade';
        const limit = access?.limit || 1;
        setOpponentLegitimacyTooltip(
            badge,
            // MATCHUP ADVICE — DISABLED: reworded to drop "matchup"; this is now purely cheat risk detection.
            `Free includes ${limit} cheat risk detection check per day. Upgrade to EloGuard Pro for unlimited cheat-risk estimates and game reviews.`
        );
        badge.setAttribute('aria-label', `EloGuard Pro required for more risk profile checks for ${username}`);
        badge.onclick = () => openPremiumUpgrade(PRO_FEATURE_RISK_PROFILE);
        badge.style.cursor = 'pointer';
    }

    function clearOpponentLegitimacyPaywall(badge) {
        if (!badge) return;
        badge.onclick = null;
        badge.style.cursor = '';
    }

    function positionOpponentLegitimacyBadge() {
        const badge = document.getElementById(LEGITIMACY_BADGE_ID);
        if (!badge || badge.hidden) return;

        const root = getTopOpponentRoot();
        const usernameEl = getTopOpponentUsernameElement();
        if (usernameEl && (!root || root.contains(usernameEl))) {
            attachOpponentLegitimacyBadgeInline(badge, usernameEl);
            const badgeRect = getUsableRect(badge);
            if (!badgeRect) {
                badge.hidden = true;
                return;
            }
            positionOpponentLegitimacyTooltip(badge, badgeRect);
            return;
        }

        attachOpponentLegitimacyBadgeFixed(badge);
        const anchor = findOpponentAvatarAnchor(root) || root;
        const rect = getUsableRect(anchor);
        if (!rect) {
            badge.hidden = true;
            return;
        }

        const badgeRect = badge.getBoundingClientRect();
        const badgeWidth = badgeRect.width || 72;
        const badgeHeight = badgeRect.height || 22;
        let left = rect.right + 8;
        let top = rect.top + ((rect.height - badgeHeight) / 2);

        left = clamp(left, 6, Math.max(6, window.innerWidth - badgeWidth - 6));
        top = clamp(top, 6, Math.max(6, window.innerHeight - badgeHeight - 6));

        badge.style.left = `${Math.round(left)}px`;
        badge.style.top = `${Math.round(top)}px`;
        positionOpponentLegitimacyTooltip(badge, { left, top, width: badgeWidth, height: badgeHeight });
    }

    function attachOpponentLegitimacyBadgeInline(badge, usernameEl) {
        if (badge.parentElement !== usernameEl.parentElement || badge.previousElementSibling !== usernameEl) {
            usernameEl.insertAdjacentElement('afterend', badge);
        }

        badge.classList.add('elo-guard-legitimacy-inline');
        badge.style.removeProperty('left');
        badge.style.removeProperty('top');
    }

    function attachOpponentLegitimacyBadgeFixed(badge) {
        if (badge.parentElement !== document.body) {
            document.body.appendChild(badge);
        }

        badge.classList.remove('elo-guard-legitimacy-inline');
    }

    function positionOpponentLegitimacyTooltip(badge, badgeRect) {
        const left = badgeRect.left;
        const top = badgeRect.top;
        const badgeHeight = badgeRect.height || 22;
        const tooltipWidth = Math.min(560, Math.max(260, window.innerWidth - 16));
        const tooltipLeft = clamp(left, 8, Math.max(8, window.innerWidth - tooltipWidth - 8));
        let tooltipTop = top + badgeHeight + 8;
        let tooltipMaxHeight = window.innerHeight - tooltipTop - 8;
        if (tooltipMaxHeight < 180) {
            tooltipMaxHeight = Math.min(560, Math.max(180, top - 16));
            tooltipTop = Math.max(8, top - tooltipMaxHeight - 8);
        }

        badge.style.setProperty('--elo-guard-tooltip-left', `${Math.round(tooltipLeft)}px`);
        badge.style.setProperty('--elo-guard-tooltip-top', `${Math.round(tooltipTop)}px`);
        badge.style.setProperty('--elo-guard-tooltip-width', `${Math.round(tooltipWidth)}px`);
        badge.style.setProperty('--elo-guard-tooltip-max-height', `${Math.round(Math.max(160, tooltipMaxHeight))}px`);
    }

    function findOpponentAvatarAnchor(root) {
        if (!root || !root.querySelectorAll) return null;

        const selectors = [
            '.player-avatar-component',
            '.player-avatar',
            '.cc-avatar-img',
            '[data-cy*="avatar"]',
            'img[alt^="Avatar"]',
            '[class*="avatar"]',
            '[class*="profile-picture"]',
            '[class*="profile-image"]',
            '[class*="user-image"]',
            'img'
        ];

        const candidates = [];
        selectors.forEach(selector => {
            root.querySelectorAll(selector).forEach(el => candidates.push(el));
        });

        return [...new Set(candidates)]
            .map(el => {
                const parent = el.parentElement && /avatar|profile|user/i.test(el.parentElement.className || '')
                    ? el.parentElement
                    : el;
                const rect = getUsableRect(parent) || getUsableRect(el);
                return rect ? { el: parent, area: rect.width * rect.height } : null;
            })
            .filter(Boolean)
            .sort((a, b) => b.area - a.area)[0]?.el || null;
    }

    function getUsableRect(el) {
        if (!el?.getBoundingClientRect) return null;
        const rect = el.getBoundingClientRect();
        if (rect.width < 4 || rect.height < 4) return null;
        if (rect.bottom < 0 || rect.right < 0 || rect.top > window.innerHeight || rect.left > window.innerWidth) return null;
        return rect;
    }

    function getCurrentOpponentUsername(root = getTopOpponentRoot()) {
        const candidates = [];
        const usernameEl = getTopOpponentUsernameElement();

        if (usernameEl && (!root || root.contains(usernameEl))) {
            candidates.push(...getIdentityStrings(usernameEl));
        }

        if (root?.querySelectorAll) {
            root.querySelectorAll(OPPONENT_IDENTITY_SELECTOR).forEach(el => {
                candidates.push(...getIdentityStrings(el));
            });

            root.querySelectorAll('img[alt^="Avatar of "]').forEach(img => {
                const name = (img.getAttribute('alt') || '').replace(/^Avatar of\s+/i, '').trim();
                if (name) candidates.push(name);
            });
        }

        candidates.push(...getOpponentNameCandidates());

        return candidates.find(isLikelyOpponentUsername) || '';
    }

    function isLikelyOpponentUsername(value) {
        const normalized = normalizeIdentity(value);
        if (!normalized || normalized.length < 2) return false;
        if (/^\d+$/.test(normalized)) return false;
        if (/^(opponent|player|you|guest|anonymous|hidden)$/i.test(normalized)) return false;
        return !identityMatchesCurrentUser(value);
    }

    async function evaluateOpponentLegitimacy(username) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), LEGITIMACY_FETCH_TIMEOUT_MS);
        const encodedUsername = encodeURIComponent(username);

        try {
            const profilePromise = fetchChessComJson(`https://api.chess.com/pub/player/${encodedUsername}`, controller.signal);
            const statsPromise = fetchChessComJson(`https://api.chess.com/pub/player/${encodedUsername}/stats`, controller.signal)
                .catch(() => null);
            const gamesPromise = fetchRecentOpponentGames(encodedUsername, controller.signal)
                .catch(() => []);
            const selfStatsPromise = USERNAME
                ? fetchChessComJson(`https://api.chess.com/pub/player/${encodeURIComponent(USERNAME)}/stats`, controller.signal).catch(() => null)
                : Promise.resolve(null);
            const selfGamesPromise = USERNAME
                ? fetchRecentOpponentGames(encodeURIComponent(USERNAME), controller.signal).catch(() => [])
                : Promise.resolve([]);

            const [profile, stats, games, selfStats, selfGames] = await Promise.all([profilePromise, statsPromise, gamesPromise, selfStatsPromise, selfGamesPromise]);
            return calculateOpponentLegitimacy(username, profile, stats, games, selfStats, selfGames);
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async function fetchRecentOpponentGames(encodedUsername, signal) {
        const archivesData = await fetchChessComJson(
            `https://api.chess.com/pub/player/${encodedUsername}/games/archives`,
            signal
        );
        const archiveUrls = Array.isArray(archivesData.archives)
            ? archivesData.archives.slice(-LEGITIMACY_MAX_ARCHIVES).reverse()
            : [];

        const archives = await Promise.all(archiveUrls.map(url => (
            fetchChessComJson(url, signal).catch(() => ({ games: [] }))
        )));

        return archives
            .flatMap(archive => Array.isArray(archive.games) ? archive.games : [])
            .sort((a, b) => (b.end_time || 0) - (a.end_time || 0));
    }

    async function fetchChessComJson(url, signal) {
        const response = await fetch(url, { signal });
        if (!response.ok) throw new Error(`Chess.com API returned ${response.status}`);
        return response.json();
    }

    function calculateOpponentLegitimacy(username, profile, stats, games, selfStats = null, selfGames = []) {
        const resolvedUsername = profile?.username || username;
        const samples = buildOpponentGameSamples(resolvedUsername, games);
        const selfSamples = USERNAME ? buildOpponentGameSamples(USERNAME, selfGames) : null;
        const accountAge = getAccountAgeMetric(profile?.joined);
        const totalGames = getTotalRatedGames(stats, GAME_MODE);
        const currentRating = getCurrentModeRating(stats);
        const selfRating = getCurrentModeRating(selfStats);
        const peak = getPeakRatingMetric(stats, currentRating, accountAge.days, totalGames);
        const selfFormPerformance = selfSamples
            ? getPerformanceRatingMetric(selfSamples.formRated, selfRating, MATCHUP_FORM_WINDOW_DAYS)
            : null;
        const selfContext = getSelfMatchupContext(selfSamples, selfFormPerformance);
        const winRate = getWinRateMetric(samples);
        const accuracy = getAccuracyMetric(samples.recentRated, currentRating);
        const performance = getPerformanceRatingMetric(samples.monthRated, currentRating);
        const matchupPerformance = getPerformanceRatingMetric(samples.formRated, currentRating, MATCHUP_FORM_WINDOW_DAYS);
        const surge = getRatingSurgeMetric(samples.recentRated, accountAge.days);
        const volume = getVolumeMetric(totalGames, accountAge.days);
        const trajectory = getRatingTrajectoryMetric(samples.recentRated, accountAge.days);
        const smurf = getSmurfMetric(accountAge, winRate, surge, trajectory, volume, totalGames);

        const riskScore = getCalibratedLegitimacyScore({
            accountAge,
            winRate,
            accuracy,
            performance,
            peak,
            surge,
            volume,
            trajectory,
            smurf,
            totalGames,
            formGames: samples.formGames
        });
        const score = riskScore.score;
        const color = getLegitimacyColor(score);
        const primaryConcern = getPrimaryLegitimacyConcern(accountAge, winRate, accuracy, performance, surge, trajectory, smurf);
        const confidence = getLegitimacyConfidence(accountAge, samples, accuracy, trajectory, performance, peak);
        // ===== MATCHUP ADVICE — DISABLED (chess.com TOS review pending) =====
        // The opponent Play / Avoid recommendation is commented out (not deleted). See
        // the full explanation + re-enable checklist in the banner above
        // getMatchupMetric(). With this call commented out, the returned result has no
        // `.matchup`, and every consumer below is commented/guarded to match.
        // NOTE: matchupPerformance / selfContext (computed above) are now only used by
        // this disabled feature; they're left in place so re-enabling is a clean uncomment.
        // const matchup = getMatchupMetric(samples, matchupPerformance, score, primaryConcern, selfRating, currentRating, selfContext, {
        //     accountAge,
        //     winRate,
        //     accuracy,
        //     performance,
        //     peak,
        //     surge,
        //     volume,
        //     trajectory,
        //     smurf,
        //     totalGames
        // });

        return {
            username: resolvedUsername,
            score,
            color,
            verdict: getVisibleLegitimacyVerdict(score, primaryConcern, smurf, accuracy),
            // MATCHUP ADVICE — DISABLED (see banner above getMatchupMetric): omitted from result.
            // matchup,
            title: buildLegitimacyTitle({
                username: resolvedUsername,
                score,
                confidence,
                accountAge,
                winRate,
                accuracy,
                performance,
                peak,
                surge,
                volume,
                trajectory,
                smurf,
                // MATCHUP ADVICE — DISABLED (see banner above getMatchupMetric):
                // matchup,
                primaryConcern,
                totalGames,
                currentRating,
                selfRating,
                selfContext,
                mode: GAME_MODE
            })
        };
    }

    function getVisibleLegitimacyVerdict(score, primaryConcern, smurf, accuracy) {
        if (primaryConcern === 'Engine-accuracy spike') {
            return accuracy.playingWellToday ? 'Hot 24h' : 'Accuracy spike';
        }

        if (primaryConcern === 'Performance spike') return 'Perf spike';

        if (primaryConcern === 'Smurf-like new account' || smurf.likely) {
            return 'Smurf?';
        }

        if (primaryConcern === 'Consistent rating climb') return 'Steady climb';

        if (score >= 75) return 'High risk';
        if (score >= 55) return 'Suspicious';
        if (score >= 42) return 'Watch';
        return 'Likely clean';
    }

    function getCalibratedLegitimacyScore(metrics) {
        const {
            accountAge,
            winRate,
            accuracy,
            performance,
            peak,
            surge,
            volume,
            trajectory,
            smurf,
            totalGames,
            formGames
        } = metrics;
        const shortForm = getLegitimacyShortFormSignal(formGames);
        const newAccount = accountAge.days !== null && accountAge.days < 90;
        const veryNewAccount = accountAge.days !== null && accountAge.days < 30;
        const lowFormatInvestment = Number.isFinite(totalGames) && totalGames < 150;
        const veryLowFormatInvestment = Number.isFinite(totalGames) && totalGames < 75;
        const strongSmurf = smurf.risk >= 18;
        const mediumSmurf = smurf.risk >= 10;
        const strongPerformance = Number.isFinite(performance.gap)
            && performance.count >= 4
            && performance.gap >= 180
            && performance.outperformance >= 0.10;
        const mildPerformance = Number.isFinite(performance.gap)
            && performance.count >= 4
            && performance.gap >= 95
            && performance.outperformance >= 0.06;
        const engineLikeAccuracy = accuracy.count >= 3 && (
            accuracy.risk >= 30
            || accuracy.playingWellRecently
            || accuracy.playingWellToday
        );

        let score = 0;
        score += compressRisk(accountAge.risk, 10, 42, 10);
        score += compressRisk(winRate.risk, 10, 32, 12);
        score += compressRisk(accuracy.risk, 8, 45, 22);
        score += compressRisk(performance.risk, 4, 24, 20);
        score += Math.min(0, peak.risk);
        score += compressRisk(surge.risk, 4, 10, 7);
        score += compressRisk(trajectory.risk, 6, 22, 13);
        score += compressRisk(smurf.risk, 7, 28, 22);
        score += volume.risk < 0 ? volume.risk * 0.55 : compressRisk(volume.risk, 8, 26, 8);

        if (shortForm.scoreRate >= 0.66 && shortForm.count >= 4) score += 8;
        else if (shortForm.scoreRate >= 0.58 && shortForm.count >= 4) score += 4;

        if (mediumSmurf && newAccount) score += 8;
        if (strongSmurf && veryNewAccount) score += 12;
        if (strongSmurf && veryLowFormatInvestment) score += 10;
        else if (mediumSmurf && lowFormatInvestment) score += 5;
        if (mediumSmurf && shortForm.scoreRate >= 0.66) score += 9;
        if (strongSmurf && shortForm.scoreRate >= 0.75) score += 8;
        if (mildPerformance && shortForm.scoreRate >= 0.66) score += 7;
        if (strongPerformance) score += 14;
        if (strongPerformance && newAccount) score += 9;
        if (engineLikeAccuracy) score += 12;
        if (engineLikeAccuracy && (newAccount || strongPerformance || strongSmurf)) score += 10;
        if (winRate.winRate >= 0.78 && winRate.games >= 8 && newAccount) score += 7;
        if (trajectory.risk >= 14 && surge.risk >= 5 && newAccount) score += 7;

        if (!newAccount && !mediumSmurf && !engineLikeAccuracy && !strongPerformance && volume.risk < 0) {
            score -= 8;
        }

        let scoreFloor = 0;
        if (engineLikeAccuracy && accuracy.playingWellToday) scoreFloor = Math.max(scoreFloor, 62);
        else if (engineLikeAccuracy && accuracy.risk >= 34) scoreFloor = Math.max(scoreFloor, 56);
        if (engineLikeAccuracy && (newAccount || strongPerformance || strongSmurf)) scoreFloor = Math.max(scoreFloor, 68);
        if (strongPerformance) scoreFloor = Math.max(scoreFloor, newAccount ? 60 : 52);
        if (strongSmurf && (veryNewAccount || veryLowFormatInvestment || shortForm.scoreRate >= 0.75)) scoreFloor = Math.max(scoreFloor, 58);
        if (trajectory.risk >= 14 && surge.risk >= 5 && newAccount) scoreFloor = Math.max(scoreFloor, 50);

        score = Math.max(score, scoreFloor);

        return {
            score: clamp(Math.round(score), 0, 100),
            shortForm,
            engineLikeAccuracy,
            strongSmurf,
            strongPerformance,
            scoreFloor
        };
    }

    function compressRisk(value, floor, ceiling, weight) {
        const risk = Number.isFinite(value) ? value : 0;
        return clamp((risk - floor) / Math.max(1, ceiling - floor), 0, 1) * weight;
    }

    function getLegitimacyShortFormSignal(formGames) {
        const games = Array.isArray(formGames) ? formGames : [];
        const count = games.length;
        if (!count) return { count: 0, scoreRate: null };

        const points = games.reduce((sum, game) => sum + getResultScore(game.result), 0);
        return {
            count,
            scoreRate: points / count
        };
    }

    function buildOpponentGameSamples(username, games) {
        const normalizedUsername = normalizeIdentity(username);
        const modeGames = [];
        const modeRated = [];

        (Array.isArray(games) ? games : []).forEach(game => {
            if (!game || game.rules !== 'chess') return;
            if (GAME_MODE && game.time_class !== GAME_MODE) return;

            const side = getPlayerGameSide(game, normalizedUsername);
            if (!side) return;

            const sample = {
                game,
                side: side.side,
                playerRating: parseInt(side.player?.rating, 10),
                opponentRating: parseInt(side.opponent?.rating, 10),
                result: normalizeGameResult(side.player?.result),
                accuracy: getPlayerAccuracy(game, side.side),
                endTime: game.end_time || 0,
                timeClass: game.time_class || '',
                rated: Boolean(game.rated)
            };

            modeGames.push(sample);
            if (sample.rated) modeRated.push(sample);
        });

        const recentRated = modeRated
            .sort((a, b) => b.endTime - a.endTime)
            .slice(0, LEGITIMACY_MAX_RECENT_GAMES);
        const monthStart = Math.floor(Date.now() / 1000) - (LEGITIMACY_PERFORMANCE_WINDOW_DAYS * 86400);
        const monthRated = modeRated
            .filter(sample => (sample.endTime || 0) >= monthStart)
            .sort((a, b) => b.endTime - a.endTime);
        const activityStart = Math.floor(Date.now() / 1000) - (MATCHUP_ACTIVITY_WINDOW_DAYS * 86400);
        const weekGames = modeGames
            .filter(sample => (sample.endTime || 0) >= activityStart)
            .sort((a, b) => b.endTime - a.endTime);
        const formStart = Math.floor(Date.now() / 1000) - (MATCHUP_FORM_WINDOW_DAYS * 86400);
        const formGames = modeGames
            .filter(sample => (sample.endTime || 0) >= formStart)
            .sort((a, b) => b.endTime - a.endTime);
        const formRated = modeRated
            .filter(sample => (sample.endTime || 0) >= formStart)
            .sort((a, b) => b.endTime - a.endTime);

        const similarRated = recentRated.filter(sample => ratingsAreSimilar(sample.playerRating, sample.opponentRating));

        return {
            modeGames,
            modeRated,
            recentRated,
            monthRated,
            weekGames,
            formGames,
            formRated,
            similarRated,
            modeRatedCount: modeRated.length,
            modeGameCount: modeGames.length
        };
    }

    function getPlayerGameSide(game, normalizedUsername) {
        const whiteName = normalizeIdentity(game.white?.username);
        const blackName = normalizeIdentity(game.black?.username);

        if (whiteName === normalizedUsername) {
            return { side: 'white', player: game.white, opponent: game.black };
        }
        if (blackName === normalizedUsername) {
            return { side: 'black', player: game.black, opponent: game.white };
        }
        return null;
    }

    function normalizeGameResult(result) {
        const value = String(result || '').toLowerCase();
        const drawResults = new Set([
            'agreed',
            'repetition',
            'stalemate',
            'insufficient',
            'timevsinsufficient',
            'fiftymove',
            '50move',
            'threefold'
        ]);

        if (value === 'win') return 'win';
        if (drawResults.has(value)) return 'draw';
        return 'loss';
    }

    function getPlayerAccuracy(game, side) {
        const accuracy = game?.accuracies?.[side];
        const value = typeof accuracy === 'number' ? accuracy : parseFloat(accuracy);
        return Number.isFinite(value) ? value : null;
    }

    function ratingsAreSimilar(playerRating, opponentRating) {
        if (!Number.isFinite(playerRating) || !Number.isFinite(opponentRating)) return false;
        const windowSize = Math.max(150, Math.min(300, playerRating * 0.12));
        return Math.abs(playerRating - opponentRating) <= windowSize;
    }

    function getAccountAgeMetric(joinedTimestamp) {
        const joinedMs = Number(joinedTimestamp) * 1000;
        const days = Number.isFinite(joinedMs) && joinedMs > 0
            ? Math.max(0, Math.floor((Date.now() - joinedMs) / 86400000))
            : null;

        let risk = 12;
        if (days === null) risk = 8;
        else if (days < 14) risk = 42;
        else if (days < 30) risk = 38;
        else if (days < 90) risk = 31;
        else if (days < 180) risk = 23;
        else if (days < 365) risk = 14;
        else if (days < 730) risk = 7;
        else if (days < 1825) risk = 2;
        else risk = 0;

        return { days, risk };
    }

    function getWinRateMetric(samples) {
        const similarEnough = samples.similarRated.length >= 6;
        const sample = similarEnough
            ? samples.similarRated
            : samples.recentRated.filter(game => Number.isFinite(game.playerRating) && Number.isFinite(game.opponentRating));

        const wins = sample.filter(game => game.result === 'win').length;
        const draws = sample.filter(game => game.result === 'draw').length;
        const games = sample.length;
        const winRate = games ? wins / games : null;
        const scoreRate = games ? (wins + (draws * 0.5)) / games : null;
        const maxRisk = similarEnough ? 36 : 22;

        let risk = 0;
        if (games >= 5 && winRate !== null) {
            risk = clamp((winRate - 0.62) / 0.3, 0, 1) * maxRisk;
            if (scoreRate !== null && scoreRate > 0.82) risk += clamp((scoreRate - 0.82) / 0.16, 0, 1) * 5;
            if (games < 10) risk *= 0.75;
        }

        const streak = getRecentWinStreak(samples.recentRated);
        if (streak >= 10) risk += 7;
        else if (streak >= 7) risk += 4;

        return {
            risk: clamp(risk, 0, similarEnough ? 42 : 28),
            games,
            wins,
            draws,
            winRate,
            scoreRate,
            similarEnough,
            streak
        };
    }

    function getRecentWinStreak(recentRated) {
        let streak = 0;
        for (const game of recentRated) {
            if (game.result !== 'win') break;
            streak += 1;
        }
        return streak;
    }

    function getPerformanceRatingMetric(monthRated, currentRating, windowDays = LEGITIMACY_PERFORMANCE_WINDOW_DAYS) {
        const games = monthRated.filter(game => (
            Number.isFinite(game.playerRating)
            && Number.isFinite(game.opponentRating)
            && game.opponentRating > 0
        ));
        const count = games.length;

        if (count < 4) {
            return {
                risk: 0,
                count,
                label: 'Not enough games',
                performanceRating: null,
                baselineRating: Number.isFinite(currentRating) ? currentRating : null,
                gap: null,
                actualScoreRate: null,
                expectedScoreRate: null,
                outperformance: null,
                confidence: 0,
                windowDays
            };
        }

        const actualPoints = games.reduce((sum, game) => sum + getResultScore(game.result), 0);
        const expectedPoints = games.reduce((sum, game) => (
            sum + getEloExpectedScore(game.playerRating, game.opponentRating)
        ), 0);
        const actualScoreRate = actualPoints / count;
        const expectedScoreRate = expectedPoints / count;
        const opponentRatings = games.map(game => game.opponentRating);
        const averagePlayerRating = games.reduce((sum, game) => sum + game.playerRating, 0) / count;
        const baselineRating = Number.isFinite(currentRating) ? currentRating : averagePlayerRating;
        const performanceRating = solvePerformanceRating(opponentRatings, actualScoreRate);
        const gap = performanceRating - baselineRating;
        const outperformance = actualScoreRate - expectedScoreRate;
        const confidence = clamp((count - 3) / 27, 0.12, 1);

        let risk = (
            clamp((outperformance - 0.08) / 0.22, 0, 1) * 13
            + clamp((gap - 120) / 260, 0, 1) * 12
        ) * confidence;

        if (count >= 20 && outperformance >= 0.18 && gap >= 180) risk += 4;
        if (count >= 35 && outperformance >= 0.14 && gap >= 150) risk += 3;

        const label = gap >= 250 && outperformance >= 0.18
            ? 'Huge performance overrating'
            : gap >= 150 && outperformance >= 0.10
                ? 'Strong performance overrating'
                : gap >= 80 && outperformance >= 0.06
                    ? 'Mild performance overrating'
                    : Math.abs(outperformance) <= 0.06
                        ? 'Near expected score'
                        : outperformance < -0.06
                            ? 'Below expected score'
                            : 'Slightly above expected score';

        return {
            risk: clamp(risk, 0, 26),
            count,
            label,
            performanceRating,
            baselineRating,
            gap,
            actualScoreRate,
            expectedScoreRate,
            outperformance,
            confidence,
            windowDays
        };
    }

    function getSelfMatchupContext(selfSamples, selfPerformance) {
        if (!selfSamples) {
            return {
                points: 0,
                edge: 0,
                label: 'Self form unavailable',
                activity: { points: 0, count: 0, label: 'No self activity sample' },
                form: { points: 0, count: 0, label: 'No self form sample', scoreRate: null },
                performance: { points: 0, gap: null, count: 0, label: 'No self PR sample' },
                session: { points: 0, count: 0, label: 'No active session sample', scoreRate: null }
            };
        }

        const activity = getSelfActivityMetric(selfSamples.weekGames);
        const form = getSelfFormMetric(selfSamples.formGames);
        const performance = getSelfPerformanceMetric(selfPerformance);
        const session = getSelfSessionMetric(selfSamples.modeGames || []);
        const points = clamp(activity.points + form.points + performance.points + session.points, -30, 30);
        const edge = clamp(points / 520, -0.045, 0.045);
        const label = points >= 12
            ? 'You look in form'
            : points >= 4
                ? 'Small self-form boost'
                : points <= -12
                    ? 'You look cold'
                    : points <= -4
                        ? 'Small self-form drag'
                        : 'Neutral self form';

        return {
            points,
            edge,
            label,
            activity,
            form,
            performance,
            session
        };
    }

    function getSelfActivityMetric(weekGames) {
        const count = Array.isArray(weekGames) ? weekGames.length : 0;

        if (count <= 1) return { points: -4, count, label: 'Very little recent activity' };
        if (count <= 4) return { points: -2, count, label: 'Light recent activity' };
        if (count <= 30) return { points: 2, count, label: 'Recently active' };
        if (count <= 70) return { points: 1, count, label: 'Very active recently' };
        return { points: -2, count, label: 'Extremely active / possible fatigue' };
    }

    function getSelfFormMetric(formGames) {
        const count = Array.isArray(formGames) ? formGames.length : 0;
        if (count < 3) {
            return {
                points: 0,
                count,
                label: 'Not enough self short-term form',
                scoreRate: null,
                winRate: null,
                lossStreak: getRecentResultStreak(formGames || [], 'loss'),
                winStreak: getRecentResultStreak(formGames || [], 'win')
            };
        }

        const wins = formGames.filter(game => game.result === 'win').length;
        const draws = formGames.filter(game => game.result === 'draw').length;
        const losses = formGames.filter(game => game.result === 'loss').length;
        const scoreRate = (wins + (draws * 0.5)) / count;
        const winRate = wins / count;
        const confidence = clamp((count - 2) / 9, 0.25, 1);
        const lossStreak = getRecentResultStreak(formGames, 'loss');
        const winStreak = getRecentResultStreak(formGames, 'win');
        let points = 0;

        if (scoreRate >= 0.70) points += (9 + (Math.min((scoreRate - 0.70) / 0.20, 1) * 5)) * confidence;
        else if (scoreRate >= 0.60) points += (4 + (((scoreRate - 0.60) / 0.10) * 5)) * confidence;
        else if (scoreRate <= 0.30) points -= (9 + (Math.min((0.30 - scoreRate) / 0.20, 1) * 5)) * confidence;
        else if (scoreRate <= 0.42) points -= (4 + (((0.42 - scoreRate) / 0.12) * 5)) * confidence;

        if (winStreak >= 4) points += 5;
        else if (winStreak >= 2) points += 2;
        if (lossStreak >= 3) points -= 6;
        else if (lossStreak >= 2) points -= 3;

        const label = scoreRate >= 0.70
            ? 'Strong self recent form'
            : scoreRate >= 0.60
                ? 'Good self recent form'
                : scoreRate <= 0.30
                    ? 'Poor self recent form'
                    : scoreRate <= 0.42
                        ? 'Below-average self recent form'
                        : 'Neutral self recent form';

        return {
            points: clamp(points, -16, 16),
            count,
            wins,
            draws,
            losses,
            label,
            scoreRate,
            winRate,
            lossStreak,
            winStreak
        };
    }

    function getSelfPerformanceMetric(performance) {
        if (!performance || performance.performanceRating === null || !Number.isFinite(performance.gap)) {
            return {
                points: 0,
                label: 'No reliable self PR signal',
                gap: null,
                count: performance?.count || 0,
                performanceRating: null,
                confidence: 0,
                windowDays: performance?.windowDays || MATCHUP_FORM_WINDOW_DAYS
            };
        }

        const confidence = Number.isFinite(performance.confidence) ? performance.confidence : 0;
        let points = 0;

        if (performance.gap >= 160) {
            points += (8 + (Math.min((performance.gap - 160) / 180, 1) * 6)) * confidence;
        } else if (performance.gap >= 90) {
            points += (3 + (((performance.gap - 90) / 70) * 5)) * confidence;
        } else if (performance.gap <= -160) {
            points -= (8 + (Math.min((-performance.gap - 160) / 180, 1) * 6)) * confidence;
        } else if (performance.gap <= -90) {
            points -= (3 + (((-performance.gap - 90) / 70) * 5)) * confidence;
        }

        if (performance.outperformance >= 0.14) points += 3 * confidence;
        if (performance.outperformance <= -0.16) points -= 3 * confidence;

        const label = performance.gap >= 160
            ? 'Self PR above rating'
            : performance.gap >= 90
                ? 'Self PR slightly above rating'
                : performance.gap <= -160
                    ? 'Self PR below rating'
                    : performance.gap <= -90
                        ? 'Self PR slightly below rating'
                        : 'Self PR near rating';

        return {
            points: clamp(points, -16, 16),
            label,
            gap: performance.gap,
            count: performance.count,
            performanceRating: performance.performanceRating,
            actualScoreRate: performance.actualScoreRate,
            expectedScoreRate: performance.expectedScoreRate,
            confidence,
            windowDays: performance.windowDays || MATCHUP_FORM_WINDOW_DAYS
        };
    }

    function getSelfSessionMetric(modeGames) {
        const games = Array.isArray(modeGames)
            ? modeGames.filter(game => game?.endTime).sort((a, b) => b.endTime - a.endTime)
            : [];
        const now = Math.floor(Date.now() / 1000);
        const session = [];
        let previousEnd = null;

        for (const game of games) {
            if (!previousEnd) {
                if (now - game.endTime > 3 * 3600) break;
            } else if (previousEnd - game.endTime > 90 * 60) {
                break;
            }

            session.push(game);
            previousEnd = game.endTime;
            if (session.length >= 20) break;
        }

        if (!session.length) {
            return {
                points: 0,
                count: 0,
                label: 'No active session sample',
                scoreRate: null,
                lossStreak: 0,
                winStreak: 0
            };
        }

        const wins = session.filter(game => game.result === 'win').length;
        const draws = session.filter(game => game.result === 'draw').length;
        const scoreRate = (wins + (draws * 0.5)) / session.length;
        const lossStreak = getRecentResultStreak(session, 'loss');
        const winStreak = getRecentResultStreak(session, 'win');
        let points = 0;

        if (session.length === 1) points -= 1;
        if (session.length >= 3 && scoreRate >= 0.70) points += 4;
        else if (session.length >= 3 && scoreRate <= 0.35) points -= 5;
        if (winStreak >= 3) points += 3;
        else if (winStreak >= 2) points += 1;
        if (lossStreak >= 3) points -= 5;
        else if (lossStreak >= 2) points -= 3;
        if (session.length >= 12) points -= 3;
        else if (session.length >= 8) points -= 1;

        const label = lossStreak >= 2
            ? 'Session loss streak'
            : winStreak >= 2
                ? 'Session win streak'
                : session.length >= 12
                    ? 'Long session / fatigue risk'
                    : scoreRate >= 0.70 && session.length >= 3
                        ? 'Strong current session'
                        : scoreRate <= 0.35 && session.length >= 3
                            ? 'Cold current session'
                            : 'Neutral current session';

        return {
            points: clamp(points, -9, 7),
            count: session.length,
            label,
            scoreRate,
            lossStreak,
            winStreak
        };
    }

    /* ===========================================================================
       MATCHUP ADVICE — DISABLED (2026-07-08, chess.com TOS review pending)
       ---------------------------------------------------------------------------
       WHAT THIS IS: the "matchup advice" feature — the opponent
       Play / Playable / Lean-avoid / Avoid recommendation, plus its win-odds,
       rating-EV, form and pool-trap math. It used to render as a second segment on
       the risk pill and as a block of lines in the pill's hover report.

       WHY IT'S OFF: we're not yet sure whether surfacing "should I play this
       opponent" advice violates the Chess.com Terms of Service. Until that's
       confirmed we ship ONLY the cheat / smurf risk detection, which is unaffected.

       WHAT CHANGED: the code is COMMENTED OUT, not deleted. The helper functions
       below (getMatchupMetric and the other getMatchup* / odds / pool-trap helpers)
       are left intact but nothing calls them — the call site in
       calculateOpponentLegitimacy() is commented out, so the result has no
       `.matchup` and every consumer is commented/guarded to match.

       TO RE-ENABLE: search this file (plus popup.html / styles.css / billing-server)
       for "MATCHUP ADVICE" and reverse each marked block:
         1. calculateOpponentLegitimacy(): the getMatchupMetric() call, the `matchup`
            result field, and the `matchup` arg passed to buildLegitimacyTitle().
         2. ensureOpponentLegitimacyBadge(): the .elo-guard-matchup-text span.
         3. renderOpponentLegitimacy{Result,Loading,Error,Paywall}(): the matchup
            pill text / colour lines.
         4. buildLegitimacyTitle(): the matchup const block + the matchup array lines.
         5. checkRating(): the recordPostGameMatchupFeedback() call site.
         6. popup.html Pro row, styles.css .elo-guard-matchup-text, and the marketing
            copy that mentioned "matchup".
       =========================================================================== */
    function getMatchupMetric(samples, performance, riskScore, primaryConcern, selfRating, opponentRating, selfContext = null, riskMetrics = {}) {
        const activity = getMatchupActivityMetric(samples.weekGames);
        const form = getMatchupFormMetric(samples.formGames);
        const performanceMatchup = getMatchupPerformanceMetric(performance);
        const riskPenalty = getMatchupRiskPenalty(riskScore, primaryConcern, riskMetrics);
        const self = selfContext || getSelfMatchupContext(null, null);
        const formDifferential = getFormDifferentialMetric(self.form, form);
        const peak = getPeakRatingMatchupMetric(riskMetrics.peak);
        const formCap = getMatchupFormRecommendationCap(form);
        const odds = getMatchupOddsMetric(selfRating, opponentRating, activity, form, performanceMatchup, riskPenalty, self, formDifferential, peak);
        const poolTrap = getOpponentPoolTrapMetric(selfRating, opponentRating, riskScore, form, odds);
        const rawScore = activity.points + form.points + performanceMatchup.points + peak.points + odds.points + riskPenalty.points + self.points + formDifferential.points + poolTrap.points;
        const matchupScore = clamp(Math.round(50 + rawScore), 0, 100);

        let verdict = 'Playable';
        let color = '#b7b95a';

        const lowAccountRisk = riskScore < 35;
        const moderateAccountRisk = riskScore < 58;
        const ratingEvEdge = Number.isFinite(odds.edge) ? odds.edge : 0;
        const estimatedRatingEv = Number.isFinite(odds.ratingDelta?.expected)
            ? odds.ratingDelta.expected
            : ratingEvEdge * getEstimatedRatingKFactor(selfRating);
        const positiveRatingEv = estimatedRatingEv >= 0.12;
        const strongRatingEv = estimatedRatingEv >= 0.40;
        const negativeRatingEv = estimatedRatingEv <= -0.28;
        const strongNegativeRatingEv = estimatedRatingEv <= -0.70;
        const strongPerformanceDrop = Number.isFinite(performanceMatchup.gap)
            && performanceMatchup.gap <= -130
            && (performanceMatchup.confidence || 0) >= 0.35;
        const engineLikeRisk = riskMetrics.accuracy?.count >= 3 && (
            riskMetrics.accuracy.risk >= 30
            || riskMetrics.accuracy.playingWellRecently
            || riskMetrics.accuracy.playingWellToday
        );
        const smurfTrap = riskMetrics.smurf?.risk >= 18
            && riskMetrics.accountAge?.days !== null
            && riskMetrics.accountAge?.days < 180
            && odds.adjustedExpectedScore < 0.60;

        const leanAvoid = (
            riskPenalty.points <= -16
            || riskScore >= 58
            || poolTrap.points <= -8
            || negativeRatingEv
            || rawScore < -3
            || (
                odds.adjustedExpectedScore < 0.42
                && !positiveRatingEv
                && !strongPerformanceDrop
            )
        );

        if (
            riskPenalty.hardAvoid
            || engineLikeRisk
            || (odds.adjustedExpectedScore < 0.435 && !positiveRatingEv)
            || strongNegativeRatingEv
            || rawScore <= -19
            || formCap.maxVerdict === 'Avoid'
            || smurfTrap
        ) {
            verdict = 'Avoid';
            color = '#e05a47';
        } else if (
            (
                odds.adjustedExpectedScore >= 0.585
                && rawScore >= 14
                && moderateAccountRisk
            )
            || (
                strongRatingEv
                && rawScore >= 10
                && lowAccountRisk
            )
        ) {
            verdict = 'Play';
            color = '#81b64c';
        } else if (leanAvoid) {
            verdict = 'Lean avoid';
            color = '#d8943d';
        } else if (
            odds.adjustedExpectedScore >= 0.535
            && rawScore >= 3
            && lowAccountRisk
            && positiveRatingEv
        ) {
            verdict = 'Playable';
            color = '#9fc65a';
        }

        const capped = applyMatchupRecommendationCap(verdict, formCap);
        if (capped !== verdict) {
            verdict = capped;
            color = getMatchupVerdictColor(verdict);
        }

        return {
            verdict,
            displayText: verdict,
            color,
            score: matchupScore,
            rawScore,
            odds,
            activity,
            form,
            formCap,
            performance: performanceMatchup,
            peak,
            riskPenalty,
            self,
            formDifferential,
            poolTrap,
            reasons: getMatchupReasons({ odds, form, performance: performanceMatchup, peak, riskPenalty, self, formDifferential, poolTrap, activity })
        };
    }

    function getMatchupFormRecommendationCap(form) {
        if (!Number.isFinite(form?.scoreRate) || !Number.isFinite(form?.count) || form.count < 4) {
            return {
                maxVerdict: null,
                label: 'No recent-form cap',
                scoreRate: form?.scoreRate ?? null,
                count: form?.count || 0
            };
        }

        if (form.count >= 8 && form.scoreRate >= 0.72) {
            return {
                maxVerdict: 'Avoid',
                label: 'Sustained very hot opponent form',
                scoreRate: form.scoreRate,
                count: form.count
            };
        }

        if (form.count >= 5 && form.scoreRate >= 0.66) {
            return {
                maxVerdict: 'Lean avoid',
                label: 'Hot opponent form caps recommendation',
                scoreRate: form.scoreRate,
                count: form.count
            };
        }

        if (form.scoreRate >= 0.58) {
            return {
                maxVerdict: 'Playable',
                label: 'Good opponent form blocks Play',
                scoreRate: form.scoreRate,
                count: form.count
            };
        }

        return {
            maxVerdict: null,
            label: 'No recent-form cap',
            scoreRate: form.scoreRate,
            count: form.count
        };
    }

    function applyMatchupRecommendationCap(verdict, cap) {
        if (!cap?.maxVerdict) return verdict;
        const currentRank = getMatchupVerdictRank(verdict);
        const capRank = getMatchupVerdictRank(cap.maxVerdict);
        return currentRank > capRank ? cap.maxVerdict : verdict;
    }

    function getMatchupVerdictRank(verdict) {
        if (verdict === 'Play') return 3;
        if (verdict === 'Playable') return 2;
        if (verdict === 'Lean avoid') return 1;
        return 0;
    }

    function getMatchupVerdictColor(verdict) {
        if (verdict === 'Play') return '#81b64c';
        if (verdict === 'Playable') return '#9fc65a';
        if (verdict === 'Lean avoid') return '#d8943d';
        return '#e05a47';
    }

    function getPeakRatingMatchupMetric(peak) {
        if (!peak || peak.rating === null || !Number.isFinite(peak.gap)) {
            return {
                points: 0,
                edge: 0,
                label: 'No peak-rating matchup signal',
                rating: null,
                gap: null,
                effectiveGap: 0,
                daysSince: null
            };
        }

        const effectiveGap = Number.isFinite(peak.effectiveGap)
            ? peak.effectiveGap
            : Math.max(0, peak.gap);
        let points = 0;
        let label = 'Current rating close to peak';

        if (effectiveGap >= 240) {
            points = -14;
            label = 'Danger: recent peak far above current';
        } else if (effectiveGap >= 150) {
            points = -9;
            label = 'Peak suggests underrated opponent';
        } else if (effectiveGap >= 80) {
            points = -4;
            label = 'Peak slightly above current';
        } else if (peak.gap <= 35) {
            points = -2;
            label = 'Opponent near all-time high';
        }

        if (peak.daysSince !== null && peak.daysSince > 365 && points < 0) {
            points *= 0.65;
            label = 'Old peak above current';
        }

        return {
            points: clamp(points, -14, 0),
            edge: clamp(points / 360, -0.04, 0),
            label,
            rating: peak.rating,
            gap: peak.gap,
            effectiveGap,
            daysSince: peak.daysSince
        };
    }

    function getFormDifferentialMetric(selfForm, opponentForm) {
        if (!Number.isFinite(selfForm?.scoreRate) || !Number.isFinite(opponentForm?.scoreRate)) {
            return {
                points: 0,
                edge: 0,
                label: 'No reliable form differential',
                differential: null
            };
        }

        const sampleConfidence = Math.min(
            clamp((selfForm.count - 2) / 8, 0.25, 1),
            clamp((opponentForm.count - 2) / 8, 0.25, 1)
        );
        const differential = selfForm.scoreRate - opponentForm.scoreRate;
        let points = 0;

        if (differential >= 0.30) points += 12 * sampleConfidence;
        else if (differential >= 0.18) points += (6 + (((differential - 0.18) / 0.12) * 6)) * sampleConfidence;
        else if (differential >= 0.10) points += 3 * sampleConfidence;
        else if (differential <= -0.30) points -= 16 * sampleConfidence;
        else if (differential <= -0.18) points -= (8 + (((-differential - 0.18) / 0.12) * 8)) * sampleConfidence;
        else if (differential <= -0.10) points -= 4 * sampleConfidence;

        const edge = clamp(points / 620, -0.035, 0.025);
        const label = differential >= 0.18
            ? 'Your form is better'
            : differential <= -0.18
                ? 'Opponent form is better'
                : 'Similar recent form';

        return {
            points: clamp(points, -16, 12),
            edge,
            label,
            differential,
            sampleConfidence
        };
    }

    function getOpponentPoolTrapMetric(selfRating, opponentRating, riskScore, form, odds) {
        if (!Number.isFinite(selfRating) || !Number.isFinite(opponentRating)) {
            return { points: 0, label: 'No rating-value trap signal', ratingGap: null };
        }

        const ratingGap = selfRating - opponentRating;
        const ratingEv = odds?.ratingDelta?.expected;
        let points = 0;
        let label = 'No rating-value trap signal';

        if (ratingGap >= 700) {
            points -= 16;
            label = 'Very low-rated opponent / bad rating value';
        } else if (ratingGap >= 400) {
            points -= 10;
            label = 'Low-rated opponent / poor rating value';
        } else if (ratingGap >= 220 && Number.isFinite(ratingEv) && ratingEv <= 0.10) {
            points -= 5;
            label = 'Slightly poor rating value';
        }

        if (riskScore >= 45 && ratingGap >= 150) {
            points -= 6;
            label = 'Risky underrated pool trap';
        }

        if (form.count >= 4 && Number.isFinite(form.scoreRate) && form.scoreRate >= 0.66 && ratingGap >= 100) {
            points -= 5;
            label = 'Hot lower-rated opponent';
        }

        return {
            points: clamp(points, -22, 0),
            label,
            ratingGap
        };
    }

    function getMatchupReasons(parts) {
        const reasons = [];
        addReason(reasons, 'Rating value', parts.odds?.ratingDelta?.expected, value => (
            `Estimated rating EV ${formatSignedDecimal(value)}`
        ));
        addReason(reasons, 'Opponent form', -parts.form.points, () => parts.form.label);
        addReason(reasons, 'Opponent PR', -parts.performance.points, () => parts.performance.label);
        addReason(reasons, 'Peak rating', parts.peak.points, () => parts.peak.label);
        addReason(reasons, 'Your form', parts.self.points, () => parts.self.label);
        addReason(reasons, 'Form differential', parts.formDifferential.points, () => parts.formDifferential.label);
        addReason(reasons, 'Account safety', parts.riskPenalty.points, () => parts.riskPenalty.label);
        addReason(reasons, 'Pool trap', parts.poolTrap.points, () => parts.poolTrap.label);
        addReason(reasons, 'Opponent activity', parts.activity.points, () => parts.activity.label);

        return reasons
            .filter(reason => Math.abs(reason.impact) >= 2)
            .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
            .slice(0, 4);
    }

    function addReason(reasons, label, impact, describe) {
        if (!Number.isFinite(impact)) return;
        reasons.push({
            label,
            impact,
            text: describe(impact)
        });
    }

    function getMatchupActivityMetric(weekGames) {
        const count = weekGames.length;

        if (count <= 2) {
            return { points: 10, count, label: 'Very low activity / possibly rusty' };
        }
        if (count <= 6) {
            return { points: 6, count, label: 'Low activity / likely not fully warm' };
        }
        if (count <= 12) {
            return { points: 2, count, label: 'Light activity' };
        }
        if (count <= 25) {
            return { points: 0, count, label: 'Normal activity' };
        }
        if (count <= 60) {
            return { points: -1, count, label: 'Active recently' };
        }
        return { points: -3, count, label: 'Very active / likely warmed up' };
    }

    function getMatchupOddsMetric(selfRating, opponentRating, activity, form, performance, riskPenalty, selfContext = null, formDifferential = null, peak = null) {
        const hasRatings = Number.isFinite(selfRating) && Number.isFinite(opponentRating);
        const baseExpectedScore = hasRatings
            ? getEloExpectedScore(selfRating, opponentRating)
            : null;

        if (baseExpectedScore === null) {
            return {
                points: 0,
                label: 'No self/opponent rating odds',
                baseExpectedScore: null,
                adjustedExpectedScore: 0.5,
                winProbability: null,
                drawProbability: null,
                lossProbability: null,
                edge: 0,
                peakEdge: 0,
                selfRating,
                opponentRating
            };
        }

        const activityEdge = clamp(activity.points / 650, -0.01, 0.025);
        const formSampleConfidence = Number.isFinite(form.count)
            ? clamp((form.count - 2) / 8, 0.25, 1)
            : 0;
        const formEdge = Number.isFinite(form.scoreRate)
            ? form.scoreRate >= 0.58
                ? clamp((0.55 - form.scoreRate) * 0.34 * formSampleConfidence, -0.12, -0.006)
                : clamp((0.50 - form.scoreRate) * 0.13 * formSampleConfidence, 0, 0.035)
            : 0;
        const performanceEdge = Number.isFinite(performance.gap)
            ? performance.gap <= -100
                ? clamp(((-performance.gap - 100) / 520) * (performance.confidence || 0), 0, 0.045)
                : performance.gap >= 95
                    ? clamp(-((performance.gap - 95) / 520) * (performance.confidence || 0), -0.05, 0)
                    : 0
            : 0;
        const riskDrag = riskPenalty.hardAvoid
            ? -0.18
            : clamp(riskPenalty.points / 500, -0.05, 0.004);
        const selfEdge = selfContext && Number.isFinite(selfContext.edge)
            ? selfContext.edge
            : 0;
        const formDifferentialEdge = formDifferential && Number.isFinite(formDifferential.edge)
            ? formDifferential.edge
            : 0;
        const peakEdge = peak && Number.isFinite(peak.edge)
            ? peak.edge
            : 0;
        const adjustedExpectedScore = clamp(
            baseExpectedScore + activityEdge + formEdge + performanceEdge + riskDrag + selfEdge + formDifferentialEdge + peakEdge,
            0.05,
            0.95
        );
        const drawProbability = getEstimatedDrawRate(form);
        const winProbability = clamp(adjustedExpectedScore - (drawProbability * 0.5), 0, 1 - drawProbability);
        const lossProbability = clamp(1 - drawProbability - winProbability, 0, 1);
        const edge = adjustedExpectedScore - baseExpectedScore;
        const ratingDelta = estimateRatingDeltaValue(selfRating, opponentRating, winProbability, drawProbability, lossProbability);
        const ratingSpread = opponentRating - selfRating;
        const rewardMultiplier = clamp(1 + (ratingSpread / 800), 0.65, 1.45);
        const downsideMultiplier = clamp(1 - (ratingSpread / 800), 0.65, 1.45);
        const casinoValue = (
            (winProbability * rewardMultiplier)
            - (lossProbability * downsideMultiplier)
            + (drawProbability * (ratingSpread / 1200))
        );
        const points = clamp((edge * 105) + (casinoValue * 16), -22, 22);

        const label = adjustedExpectedScore >= 0.60
            ? 'Favourable odds'
            : adjustedExpectedScore >= 0.52
                ? 'Small positive edge'
                : adjustedExpectedScore >= 0.47
                    ? 'Coin-flip odds'
                    : 'Negative edge';

        return {
            points,
            label,
            baseExpectedScore,
            adjustedExpectedScore,
            winProbability,
            drawProbability,
            lossProbability,
            edge,
            ratingDelta,
            casinoValue,
            selfRating,
            opponentRating,
            activityEdge,
            formEdge,
            performanceEdge,
            riskDrag,
            selfEdge,
            formDifferentialEdge,
            peakEdge
        };
    }

    function getEstimatedDrawRate(form) {
        if (form.count >= 5 && Number.isFinite(form.draws)) {
            return clamp(form.draws / form.count, 0.03, 0.25);
        }

        if (GAME_MODE === 'rapid') return 0.12;
        if (GAME_MODE === 'blitz') return 0.08;
        return 0.05;
    }

    function estimateRatingDeltaValue(selfRating, opponentRating, winProbability, drawProbability, lossProbability) {
        if (![selfRating, opponentRating, winProbability, drawProbability, lossProbability].every(Number.isFinite)) {
            return {
                expected: null,
                win: null,
                draw: null,
                loss: null,
                kFactor: null
            };
        }

        const kFactor = getEstimatedRatingKFactor(selfRating);
        const baseExpected = getEloExpectedScore(selfRating, opponentRating);
        const win = kFactor * (1 - baseExpected);
        const draw = kFactor * (0.5 - baseExpected);
        const loss = kFactor * (0 - baseExpected);
        const expected = (winProbability * win) + (drawProbability * draw) + (lossProbability * loss);

        return {
            expected,
            win,
            draw,
            loss,
            kFactor
        };
    }

    function getEstimatedRatingKFactor(rating) {
        if (!Number.isFinite(rating)) return 16;
        if (rating < 1200) return 32;
        if (rating < 1800) return 24;
        return 16;
    }

    function getMatchupFormMetric(formGames) {
        const count = formGames.length;
        if (count < 3) {
            return {
                points: 0,
                count,
                label: 'Not enough short-term form',
                winRate: null,
                scoreRate: null,
                lossStreak: getRecentResultStreak(formGames, 'loss'),
                winStreak: getRecentResultStreak(formGames, 'win')
            };
        }

        const wins = formGames.filter(game => game.result === 'win').length;
        const draws = formGames.filter(game => game.result === 'draw').length;
        const losses = formGames.filter(game => game.result === 'loss').length;
        const scoreRate = (wins + (draws * 0.5)) / count;
        const winRate = wins / count;
        const confidence = clamp((count - 2) / 9, 0.25, 1);
        const lossStreak = getRecentResultStreak(formGames, 'loss');
        const winStreak = getRecentResultStreak(formGames, 'win');
        let points = 0;

        if (scoreRate <= 0.30) {
            points += 22 * confidence;
        } else if (scoreRate <= 0.43) {
            points += (9 + (((0.43 - scoreRate) / 0.13) * 9)) * confidence;
        } else if (scoreRate < 0.52) {
            points += (((0.52 - scoreRate) / 0.09) * 4) * confidence;
        } else if (scoreRate >= 0.68) {
            points -= (22 + (Math.min((scoreRate - 0.68) / 0.22, 1) * 12)) * confidence;
        } else if (scoreRate >= 0.58) {
            points -= (10 + (((scoreRate - 0.58) / 0.10) * 12)) * confidence;
        } else if (scoreRate >= 0.53) {
            points -= (((scoreRate - 0.53) / 0.05) * 6) * confidence;
        }

        if (lossStreak >= 3) points += 5;
        else if (lossStreak >= 2) points += 2;
        if (winStreak >= 4) points -= 10;
        else if (winStreak >= 2) points -= 5;

        const label = scoreRate <= 0.30
            ? 'Poor recent form / possible tilt'
            : scoreRate <= 0.43
                ? 'Below-average recent form'
                : scoreRate >= 0.68
                    ? 'Strong recent form'
                    : scoreRate >= 0.58
                        ? 'Slightly good recent form'
                        : 'Neutral recent form';

        return {
            points: clamp(points, -34, 22),
            count,
            wins,
            draws,
            losses,
            label,
            winRate,
            scoreRate,
            lossStreak,
            winStreak
        };
    }

    function getMatchupPerformanceMetric(performance) {
        if (performance.performanceRating === null || !Number.isFinite(performance.gap)) {
            return {
                points: 0,
                label: 'No reliable performance signal',
                gap: null,
                count: performance.count || 0
            };
        }

        const confidence = Number.isFinite(performance.confidence) ? performance.confidence : 0;
        let points = 0;

        if (performance.gap <= -160) {
            points += (14 + (Math.min((-performance.gap - 160) / 180, 1) * 10)) * confidence;
        } else if (performance.gap <= -100) {
            points += (6 + (((-performance.gap - 100) / 60) * 8)) * confidence;
        } else if (performance.gap <= -75) {
            points += 2 * confidence;
        } else if (performance.gap >= 180) {
            points -= (14 + (Math.min((performance.gap - 180) / 180, 1) * 8)) * confidence;
        } else if (performance.gap >= 95) {
            points -= (6 + (((performance.gap - 95) / 85) * 8)) * confidence;
        }

        if (performance.outperformance <= -0.16) points += 4 * confidence;
        if (performance.outperformance >= 0.14) points -= 5 * confidence;

        const label = performance.gap <= -160
            ? 'Bad current-window performance'
            : performance.gap <= -100
                ? 'Underperforming rating'
                : performance.gap >= 180
                    ? 'Overperforming rating'
                    : performance.gap >= 95
                        ? 'Playing above rating'
                        : 'Near rating expectation';

        return {
            points: clamp(points, -24, 24),
            label,
            gap: performance.gap,
            count: performance.count,
            performanceRating: performance.performanceRating,
            actualScoreRate: performance.actualScoreRate,
            expectedScoreRate: performance.expectedScoreRate,
            confidence,
            windowDays: performance.windowDays || MATCHUP_FORM_WINDOW_DAYS
        };
    }

    function getMatchupRiskPenalty(riskScore, primaryConcern, riskMetrics = {}) {
        const accuracy = riskMetrics.accuracy || {};
        const accountAge = riskMetrics.accountAge || {};
        const smurf = riskMetrics.smurf || {};
        const performance = riskMetrics.performance || {};
        const volume = riskMetrics.volume || {};
        const winRate = riskMetrics.winRate || {};
        const totalGames = riskMetrics.totalGames;
        const engineLikeRisk = accuracy.count >= 3 && (
            accuracy.risk >= 30
            || accuracy.playingWellRecently
            || accuracy.playingWellToday
        );
        const strongSmurfRisk = smurf.risk >= 18 && accountAge.days !== null && accountAge.days < 180;
        const lowFormatInvestment = Number.isFinite(totalGames) && totalGames < 75;
        const strongPerformanceSpike = performance.count >= 8
            && performance.gap >= 180
            && performance.outperformance >= 0.10;

        if (engineLikeRisk && riskScore >= 48) {
            return {
                points: -42,
                hardAvoid: true,
                label: 'Avoid: accuracy risk is too high'
            };
        }

        if ((strongSmurfRisk && lowFormatInvestment && riskScore >= 58) || (strongPerformanceSpike && riskScore >= 62)) {
            return {
                points: -30,
                hardAvoid: false,
                label: 'Heavy caution: smurf/performance risk'
            };
        }

        if (riskScore >= 76) {
            return {
                points: -28,
                hardAvoid: false,
                label: 'Heavy caution: account risk'
            };
        }

        if (riskScore >= 60 || primaryConcern === 'Performance spike') {
            return {
                points: -16,
                hardAvoid: false,
                label: 'Caution: account risk offsets matchup value'
            };
        }

        if (riskScore >= 45 || smurf.likely || winRate.risk >= 20) {
            return {
                points: -7,
                hardAvoid: false,
                label: 'Small caution from account risk'
            };
        }

        if (volume.risk < 0 && accountAge.risk <= 2 && riskScore < 30) {
            return {
                points: 2,
                hardAvoid: false,
                label: 'Established account history helps safety'
            };
        }

        return {
            points: 0,
            hardAvoid: false,
            label: 'No account-risk penalty'
        };
    }

    function getRecentResultStreak(games, result) {
        let streak = 0;
        for (const game of games) {
            if (game.result !== result) break;
            streak += 1;
        }
        return streak;
    }

    function getResultScore(result) {
        if (result === 'win') return 1;
        if (result === 'draw') return 0.5;
        return 0;
    }

    function getEloExpectedScore(playerRating, opponentRating) {
        return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
    }

    function solvePerformanceRating(opponentRatings, actualScoreRate) {
        const ratings = opponentRatings.filter(Number.isFinite);
        if (!ratings.length) return null;

        const minOpponent = Math.min(...ratings);
        const maxOpponent = Math.max(...ratings);

        if (actualScoreRate >= 0.995) return maxOpponent + 800;
        if (actualScoreRate <= 0.005) return minOpponent - 800;

        let low = minOpponent - 1000;
        let high = maxOpponent + 1000;

        for (let i = 0; i < 50; i += 1) {
            const mid = (low + high) / 2;
            const expected = ratings.reduce((sum, opponentRating) => (
                sum + getEloExpectedScore(mid, opponentRating)
            ), 0) / ratings.length;

            if (expected < actualScoreRate) low = mid;
            else high = mid;
        }

        return Math.round((low + high) / 2);
    }

    function getAccuracyMetric(recentRated, currentRating) {
        const accuracyGames = recentRated
            .filter(game => Number.isFinite(game.accuracy))
            .slice(0, 24);
        const count = accuracyGames.length;

        if (!count) {
            return {
                risk: 0,
                count: 0,
                average: null,
                threshold: null,
                veryHighCount: 0,
                recentCount: 0,
                recentAverage: null,
                todayCount: 0,
                todayAverage: null,
                todayHighCount: 0,
                hotWindowHours: LEGITIMACY_HOT_ACCURACY_WINDOW_HOURS,
                playingWellToday: false,
                playingWellRecently: false
            };
        }

        const average = accuracyGames.reduce((sum, game) => sum + game.accuracy, 0) / count;
        const rating = Number.isFinite(currentRating) ? currentRating : null;
        let threshold = 90;
        if (rating !== null && rating < 1400) threshold = 88;
        else if (rating !== null && rating < 1800) threshold = 90;
        else if (rating !== null && rating < 2200) threshold = 92;
        else if (rating !== null) threshold = 94;

        const recentWindow = accuracyGames.slice(0, 6);
        const recentAverage = getAverageAccuracy(recentWindow);
        const hotWindowStart = getRollingWindowStartUnixSeconds(LEGITIMACY_HOT_ACCURACY_WINDOW_HOURS);
        const hotWindowGames = accuracyGames.filter(game => (game.endTime || 0) >= hotWindowStart);
        const hotWindowAverage = getAverageAccuracy(hotWindowGames);
        const veryHighCount = accuracyGames.filter(game => game.accuracy >= threshold + 4).length;
        const recentHighCount = recentWindow.filter(game => game.accuracy >= threshold + 3).length;
        const hotWindowHighCount = hotWindowGames.filter(game => game.accuracy >= threshold + 3).length;
        const playingWellToday = hotWindowGames.length >= 2 && (
            hotWindowAverage >= threshold + 1.5
            || hotWindowHighCount >= 2
        );
        const playingWellRecently = recentWindow.length >= 3 && (
            recentAverage >= threshold + 1
            || recentHighCount >= 3
        );

        let risk = clamp((average - (threshold - 5)) / 11, 0, 1) * 34;
        if (veryHighCount >= 4) risk += 10;
        else if (veryHighCount >= 2) risk += 6;
        if (playingWellRecently) risk += 7;
        if (playingWellToday) risk += 11;
        if (count < 4) risk *= 0.78;

        return {
            risk: clamp(risk, 0, 52),
            count,
            average,
            threshold,
            veryHighCount,
            recentCount: recentWindow.length,
            recentAverage,
            todayCount: hotWindowGames.length,
            todayAverage: hotWindowAverage,
            todayHighCount: hotWindowHighCount,
            hotWindowHours: LEGITIMACY_HOT_ACCURACY_WINDOW_HOURS,
            playingWellToday,
            playingWellRecently
        };
    }

    function getAverageAccuracy(games) {
        if (!games.length) return null;
        return games.reduce((sum, game) => sum + game.accuracy, 0) / games.length;
    }

    function getRollingWindowStartUnixSeconds(hours) {
        return Math.floor(Date.now() / 1000) - (hours * 3600);
    }

    function getRatingSurgeMetric(recentRated, accountAgeDays) {
        const ratedWithRatings = recentRated.filter(game => Number.isFinite(game.playerRating));
        if (ratedWithRatings.length < 8) {
            return { risk: 0, gain: null, games: ratedWithRatings.length };
        }

        const newest = ratedWithRatings[0].playerRating;
        const oldest = ratedWithRatings[ratedWithRatings.length - 1].playerRating;
        const gain = newest - oldest;
        let risk = clamp((gain - 80) / 220, 0, 1) * 8;
        if (risk > 0 && accountAgeDays !== null && accountAgeDays < 180) risk += 2;

        return {
            risk: clamp(risk, 0, 10),
            gain,
            games: ratedWithRatings.length
        };
    }

    function getRatingTrajectoryMetric(recentRated, accountAgeDays) {
        const ratedWithRatings = recentRated
            .filter(game => Number.isFinite(game.playerRating))
            .slice(0, 50)
            .sort((a, b) => a.endTime - b.endTime);

        if (ratedWithRatings.length < 10) {
            return {
                risk: 0,
                label: 'Not enough rating history',
                games: ratedWithRatings.length,
                gain: null,
                positiveRate: null,
                flipRate: null,
                efficiency: null
            };
        }

        const deltas = [];
        for (let i = 1; i < ratedWithRatings.length; i += 1) {
            deltas.push(ratedWithRatings[i].playerRating - ratedWithRatings[i - 1].playerRating);
        }

        const meaningfulDeltas = deltas.filter(delta => delta !== 0);
        const positives = meaningfulDeltas.filter(delta => delta > 0).length;
        const negatives = meaningfulDeltas.filter(delta => delta < 0).length;
        const positiveRate = meaningfulDeltas.length ? positives / meaningfulDeltas.length : 0;
        const negativeRate = meaningfulDeltas.length ? negatives / meaningfulDeltas.length : 0;
        const gain = ratedWithRatings[ratedWithRatings.length - 1].playerRating - ratedWithRatings[0].playerRating;
        const absoluteMovement = meaningfulDeltas.reduce((sum, delta) => sum + Math.abs(delta), 0);
        const efficiency = absoluteMovement ? clamp(gain / absoluteMovement, -1, 1) : 0;
        const signFlips = getRatingDirectionFlipCount(meaningfulDeltas);
        const flipRate = meaningfulDeltas.length > 1 ? signFlips / (meaningfulDeltas.length - 1) : 0;
        const trendStrength = clamp((gain - 45) / 170, 0, 1);
        const consistencyScore = (
            clamp((positiveRate - 0.58) / 0.34, 0, 1) * 0.45
            + clamp((efficiency - 0.22) / 0.58, 0, 1) * 0.45
            + clamp((0.62 - flipRate) / 0.62, 0, 1) * 0.10
        );

        let risk = trendStrength * consistencyScore * 20;
        if (gain >= 120 && positiveRate >= 0.68 && efficiency >= 0.35) risk += 4;
        if (risk > 0 && accountAgeDays !== null && accountAgeDays < 180) risk += 3;

        const plateauing = Math.abs(gain) <= 35 && flipRate >= 0.42;
        const steadyClimb = gain >= 80 && positiveRate >= 0.64 && efficiency >= 0.30;
        const label = plateauing
            ? 'Plateau / up-down pattern'
            : steadyClimb
                ? 'Consistent climb'
                : gain >= 50
                    ? 'Uneven climb'
                    : gain <= -35
                        ? 'Losing rating'
                        : 'Mostly flat';

        return {
            risk: plateauing ? 0 : clamp(risk, 0, 24),
            label,
            games: ratedWithRatings.length,
            gain,
            positiveRate,
            negativeRate,
            flipRate,
            efficiency,
            signFlips
        };
    }

    function getRatingDirectionFlipCount(deltas) {
        let flips = 0;
        let lastSign = 0;

        deltas.forEach(delta => {
            const sign = Math.sign(delta);
            if (!sign) return;
            if (lastSign && sign !== lastSign) flips += 1;
            lastSign = sign;
        });

        return flips;
    }

    function getVolumeMetric(totalGames, accountAgeDays) {
        if (!Number.isFinite(totalGames)) {
            return {
                risk: 0,
                label: 'Rated game count unavailable'
            };
        }

        let risk = 0;
        let label = 'Moderate rated history';

        if (totalGames < 10) {
            risk = 22;
            label = 'Very low rated history';
        } else if (totalGames < 25) {
            risk = 17;
            label = 'Low rated history';
        } else if (totalGames < 75) {
            risk = 10;
            label = 'Limited rated history';
        } else if (totalGames < 150) {
            risk = 5;
            label = 'Some rated history';
        } else if (totalGames >= 2000) {
            risk = -18;
            label = 'Very deep rated history';
        } else if (totalGames >= 800) {
            risk = -12;
            label = 'Deep rated history';
        } else if (totalGames >= 300) {
            risk = -7;
            label = 'Established rated history';
        } else if (totalGames >= 150) {
            risk = -3;
            label = 'Solid rated history';
        }

        if (accountAgeDays !== null && accountAgeDays < 90 && totalGames < 75) {
            risk += 4;
            label = `${label} on a new account`;
        }

        return {
            risk: clamp(risk, -18, 26),
            label
        };
    }

    function getPeakRatingMetric(stats, currentRating, accountAgeDays, totalGames) {
        const modeStats = stats?.[`chess_${GAME_MODE}`];
        const rawPeak = parseInt(modeStats?.best?.rating, 10);
        const peakRating = Number.isFinite(rawPeak) ? rawPeak : null;
        const rawDate = parseInt(modeStats?.best?.date, 10);
        const peakDate = Number.isFinite(rawDate) && rawDate > 0 ? rawDate : null;
        const daysSince = peakDate === null
            ? null
            : Math.max(0, Math.floor((Math.floor(Date.now() / 1000) - peakDate) / 86400));
        const gap = peakRating !== null && Number.isFinite(currentRating)
            ? peakRating - currentRating
            : null;

        const recencyWeight = daysSince === null
            ? 0.55
            : daysSince <= 30
                ? 1
                : daysSince <= 90
                    ? 0.82
                    : daysSince <= 180
                        ? 0.65
                        : daysSince <= 365
                            ? 0.45
                            : daysSince <= 1095
                                ? 0.25
                                : 0.12;
        const effectiveGap = Number.isFinite(gap) && gap > 0
            ? gap * recencyWeight
            : 0;

        let risk = 0;
        let label = 'Peak rating unavailable';

        if (peakRating === null) {
            return {
                risk,
                label,
                rating: null,
                gap: null,
                daysSince,
                recencyWeight,
                effectiveGap: 0
            };
        }

        const establishedHistory = accountAgeDays !== null
            && accountAgeDays >= 365
            && Number.isFinite(totalGames)
            && totalGames >= 300;

        if (Number.isFinite(gap) && gap >= 300) {
            risk -= 8;
            label = 'Well below all-time peak';
        } else if (Number.isFinite(gap) && gap >= 180) {
            risk -= 5;
            label = 'Below all-time peak';
        } else if (Number.isFinite(gap) && gap >= 100) {
            risk -= 2;
            label = 'Slightly below all-time peak';
        } else if (Number.isFinite(gap) && gap <= 35) {
            label = 'Current rating near all-time peak';
        } else {
            label = 'Known peak rating history';
        }

        if (establishedHistory && daysSince !== null && daysSince > 365) {
            risk -= 2;
            label = 'Old established peak history';
        } else if (establishedHistory && Number.isFinite(gap) && gap < 120) {
            risk -= 1;
            label = 'Established peak history';
        }

        return {
            risk: clamp(risk, -10, 0),
            label,
            rating: peakRating,
            gap,
            daysSince,
            recencyWeight,
            effectiveGap
        };
    }

    function getSmurfMetric(accountAge, winRate, surge, trajectory, volume, totalGames) {
        const days = accountAge.days;
        if (days === null || days >= 365) {
            return { risk: 0, likely: false, label: 'No strong smurf signal' };
        }

        let risk = 0;
        if (days < 30) risk += 8;
        else if (days < 90) risk += 5;

        if (winRate.games >= 6 && winRate.winRate !== null) {
            if (winRate.winRate >= 0.82) risk += 12;
            else if (winRate.winRate >= 0.72) risk += 8;
        }

        if (surge.gain !== null) {
            if (surge.gain >= 220) risk += 9;
            else if (surge.gain >= 140) risk += 6;
        }

        if (trajectory.risk >= 14) risk += 6;
        else if (trajectory.risk >= 8) risk += 3;

        if (Number.isFinite(totalGames) && totalGames < 75) risk += 5;
        else risk += volume.risk * 0.5;

        risk = clamp(risk, 0, 28);

        return {
            risk,
            likely: risk >= 14,
            label: risk >= 18 ? 'Strong smurf-like signal' : risk >= 10 ? 'Possible smurf-like signal' : 'No strong smurf signal'
        };
    }

    function getTotalRatedGames(stats, mode) {
        if (!stats) return null;
        const record = stats[`chess_${mode}`]?.record;
        if (!record) return null;

        return (parseInt(record.win, 10) || 0)
            + (parseInt(record.loss, 10) || 0)
            + (parseInt(record.draw, 10) || 0);
    }

    function getCurrentModeRating(stats) {
        const value = stats?.[`chess_${GAME_MODE}`]?.last?.rating;
        const rating = parseInt(value, 10);
        return Number.isFinite(rating) ? rating : null;
    }

    function getPrimaryLegitimacyConcern(accountAge, winRate, accuracy, performance, surge, trajectory, smurf) {
        if (accuracy.risk >= 34 || accuracy.playingWellToday) {
            return 'Engine-accuracy spike';
        }

        if (performance.risk >= 16) return 'Performance spike';

        if (smurf.likely && trajectory.risk >= 12) {
            return 'Smurf-like steady climb';
        }

        if (smurf.likely && accountAge.risk >= 23 && (winRate.risk >= 12 || surge.risk >= 5)) {
            return 'Smurf-like new account';
        }

        if (trajectory.risk >= 15) return 'Consistent rating climb';
        if (winRate.risk >= 22) return 'Unusual win rate';
        if (accountAge.risk >= 31) return 'Very new account';
        return 'No single strong signal';
    }

    function getLegitimacyConfidence(accountAge, samples, accuracy, trajectory, performance, peak) {
        let points = 0;
        if (accountAge.days !== null) points += 1;
        if (Number.isFinite(peak?.rating)) points += 1;
        if (samples.recentRated.length >= 12) points += 1;
        if (samples.similarRated.length >= 6) points += 1;
        if (accuracy.count >= 3) points += 1;
        if (accuracy.todayCount >= 2) points += 1;
        if (trajectory.games >= 12) points += 1;
        if (performance.count >= 12) points += 1;

        if (points >= 3) return 'medium';
        if (points >= 2) return 'low-medium';
        return 'low';
    }

    function buildLegitimacyTitle(data) {
        const ageText = data.accountAge.days === null ? 'unknown' : formatAgeDays(data.accountAge.days);
        const winRateText = data.winRate.winRate === null ? 'not enough data' : `${Math.round(data.winRate.winRate * 100)}%`;
        const sampleType = data.winRate.similarEnough ? 'similar-rating rated' : 'selected-mode rated';
        const accuracyText = data.accuracy.count
            ? `${data.accuracy.average.toFixed(1)}% over ${data.accuracy.count} analysed game${data.accuracy.count === 1 ? '' : 's'}`
            : 'no public analysed games found';
        const hotWindowHours = data.accuracy.hotWindowHours || LEGITIMACY_HOT_ACCURACY_WINDOW_HOURS;
        const hotWindowLabel = `last ${hotWindowHours}h`;
        const hotWindowAccuracyText = data.accuracy.todayCount
            ? `${data.accuracy.todayAverage.toFixed(1)}% over ${data.accuracy.todayCount} analysed game${data.accuracy.todayCount === 1 ? '' : 's'} in the ${hotWindowLabel}`
            : `no analysed games in the ${hotWindowLabel}`;
        const recentAccuracyText = data.accuracy.recentCount
            ? `${data.accuracy.recentAverage.toFixed(1)}% over latest ${data.accuracy.recentCount} analysed game${data.accuracy.recentCount === 1 ? '' : 's'}`
            : 'not enough analysed games';
        const formText = data.accuracy.playingWellToday
            ? `Yes: high-accuracy games in the ${hotWindowLabel} (${hotWindowAccuracyText})`
            : data.accuracy.playingWellRecently
                ? `Recently hot: ${recentAccuracyText}`
                : `No clear high-accuracy spike (${hotWindowAccuracyText})`;
        const trajectoryText = data.trajectory.gain === null
            ? `${data.trajectory.label} (${data.trajectory.games} games)`
            : `${data.trajectory.label}: ${data.trajectory.gain >= 0 ? '+' : ''}${data.trajectory.gain} over ${data.trajectory.games} games; ${Math.round(data.trajectory.positiveRate * 100)}% gains; ${Math.round(data.trajectory.flipRate * 100)}% direction flips; ${Math.round(data.trajectory.efficiency * 100)}% climb efficiency`;
        const performanceText = data.performance.performanceRating === null
            ? `${data.performance.label} (${data.performance.count} ${data.mode} games in ${LEGITIMACY_PERFORMANCE_WINDOW_DAYS} days)`
            : `${data.performance.label}: PR ${data.performance.performanceRating}; rated ${data.mode} only; last ${LEGITIMACY_PERFORMANCE_WINDOW_DAYS} days; baseline ${Math.round(data.performance.baselineRating)}; gap ${formatSignedNumber(data.performance.gap)}; actual ${formatPercent(data.performance.actualScoreRate)} vs expected ${formatPercent(data.performance.expectedScoreRate)} over ${data.performance.count} games; sample confidence ${formatPercent(data.performance.confidence)}`;
        /* ===== MATCHUP ADVICE — DISABLED (chess.com TOS review pending) =====
           The hover-report strings below describe the matchup recommendation and are
           commented out (not deleted). data.matchup is no longer populated (see the
           banner above getMatchupMetric). To re-enable, delete this opening marker and
           the closing one just before surgeText, then uncomment the matching
           "Matchup ..." entries in the returned array further down.

        const matchupActivityText = `${data.matchup.activity.label}; ${data.matchup.activity.count} ${data.mode} game${data.matchup.activity.count === 1 ? '' : 's'} in ${MATCHUP_ACTIVITY_WINDOW_DAYS} days, unrated included (${formatSignedNumber(data.matchup.activity.points)})`;
        const matchupFormText = data.matchup.form.scoreRate === null
            ? `${data.matchup.form.label}; ${data.matchup.form.count} game${data.matchup.form.count === 1 ? '' : 's'} in ${MATCHUP_FORM_WINDOW_DAYS} days (${formatSignedNumber(data.matchup.form.points)})`
            : `${data.matchup.form.label}; score ${formatPercent(data.matchup.form.scoreRate)}, win ${formatPercent(data.matchup.form.winRate)}, ${data.matchup.form.wins}-${data.matchup.form.losses}-${data.matchup.form.draws} W-L-D in ${MATCHUP_FORM_WINDOW_DAYS} days (${formatSignedNumber(data.matchup.form.points)})`;
        const matchupFormCapText = data.matchup.formCap?.maxVerdict
            ? `${data.matchup.formCap.label}; max recommendation ${data.matchup.formCap.maxVerdict}; score ${formatPercent(data.matchup.formCap.scoreRate)} over ${data.matchup.formCap.count} game${data.matchup.formCap.count === 1 ? '' : 's'}`
            : `${data.matchup.formCap?.label || 'No recent-form cap'}; recommendation uncapped`;
        const matchupPerformanceText = data.matchup.performance.gap === null
            ? `${data.matchup.performance.label} (${formatSignedNumber(data.matchup.performance.points)})`
            : `${data.matchup.performance.label}; mathematical PR ${data.matchup.performance.performanceRating}; rated ${data.mode} only; last ${data.matchup.performance.windowDays || MATCHUP_FORM_WINDOW_DAYS} days; PR gap ${formatSignedNumber(data.matchup.performance.gap)} over ${data.matchup.performance.count} games (${formatSignedNumber(data.matchup.performance.points)})`;
        const matchupPeakText = data.matchup.peak.rating === null
            ? `${data.matchup.peak.label} (${formatSignedNumber(data.matchup.peak.points)})`
            : `${data.matchup.peak.label}; all-time best ${data.matchup.peak.rating}; peak gap ${formatSignedNumber(data.matchup.peak.gap)}; effective gap ${Math.round(data.matchup.peak.effectiveGap)}; EV edge ${formatSignedPercent(data.matchup.odds.peakEdge)} (${formatSignedNumber(data.matchup.peak.points)})`;
        const selfFormText = data.matchup.self.form.scoreRate === null
            ? `${data.matchup.self.form.label}; ${data.matchup.self.form.count} game${data.matchup.self.form.count === 1 ? '' : 's'} in ${MATCHUP_FORM_WINDOW_DAYS} days`
            : `${data.matchup.self.form.label}; score ${formatPercent(data.matchup.self.form.scoreRate)}, win ${formatPercent(data.matchup.self.form.winRate)}, ${data.matchup.self.form.wins}-${data.matchup.self.form.losses}-${data.matchup.self.form.draws} W-L-D in ${MATCHUP_FORM_WINDOW_DAYS} days`;
        const selfPerformanceText = data.matchup.self.performance.gap === null
            ? `${data.matchup.self.performance.label}`
            : `${data.matchup.self.performance.label}; PR ${data.matchup.self.performance.performanceRating}; last ${data.matchup.self.performance.windowDays || MATCHUP_FORM_WINDOW_DAYS} days; gap ${formatSignedNumber(data.matchup.self.performance.gap)} over ${data.matchup.self.performance.count} games`;
        const selfSessionText = data.matchup.self.session.scoreRate === null
            ? `${data.matchup.self.session.label}; ${data.matchup.self.session.count} session game${data.matchup.self.session.count === 1 ? '' : 's'}`
            : `${data.matchup.self.session.label}; session score ${formatPercent(data.matchup.self.session.scoreRate)} over ${data.matchup.self.session.count} game${data.matchup.self.session.count === 1 ? '' : 's'}`;
        const selfContextText = `${data.matchup.self.label}; ${selfFormText}; ${selfPerformanceText}; ${selfSessionText}; self EV edge ${formatSignedPercent(data.matchup.odds.selfEdge)} (${formatSignedNumber(data.matchup.self.points)})`;
        const formDifferentialText = data.matchup.formDifferential.differential === null
            ? `${data.matchup.formDifferential.label} (${formatSignedNumber(data.matchup.formDifferential.points)})`
            : `${data.matchup.formDifferential.label}; differential ${formatSignedPercent(data.matchup.formDifferential.differential)}; EV edge ${formatSignedPercent(data.matchup.odds.formDifferentialEdge)} (${formatSignedNumber(data.matchup.formDifferential.points)})`;
        const ratingDelta = data.matchup.odds.ratingDelta || {};
        const ratingDeltaText = Number.isFinite(ratingDelta.expected)
            ? `rating EV ${formatSignedDecimal(ratingDelta.expected)}; W/D/L rating ${formatSignedDecimal(ratingDelta.win)}/${formatSignedDecimal(ratingDelta.draw)}/${formatSignedDecimal(ratingDelta.loss)}`
            : 'rating EV unknown';
        const poolTrapText = `${data.matchup.poolTrap.label} (${formatSignedNumber(data.matchup.poolTrap.points)})`;
        const reasonsText = data.matchup.reasons?.length
            ? data.matchup.reasons.map(reason => `${reason.label}: ${reason.text}`).join('; ')
            : 'No dominant factors';
        const matchupOddsText = data.matchup.odds.baseExpectedScore === null
            ? data.matchup.odds.label
            : `${data.matchup.odds.label}; your rating ${Math.round(data.matchup.odds.selfRating)}, opponent ${Math.round(data.matchup.odds.opponentRating)}; base expected ${formatPercent(data.matchup.odds.baseExpectedScore)}, adjusted ${formatPercent(data.matchup.odds.adjustedExpectedScore)}; rating EV edge ${formatSignedPercent(data.matchup.odds.edge)}; ${ratingDeltaText}; W/D/L ${formatPercent(data.matchup.odds.winProbability)}/${formatPercent(data.matchup.odds.drawProbability)}/${formatPercent(data.matchup.odds.lossProbability)} (${formatSignedNumber(data.matchup.odds.points)})`;
        /* ===== end MATCHUP ADVICE — DISABLED ===== */
        const surgeText = data.surge.gain === null ? 'not enough games' : `${data.surge.gain >= 0 ? '+' : ''}${data.surge.gain} over ${data.surge.games} games`;
        const totalGamesText = Number.isFinite(data.totalGames) ? data.totalGames : 'unknown';
        const ratingText = Number.isFinite(data.currentRating) ? data.currentRating : 'unknown';
        const volumeImpactText = formatRiskImpact(data.volume.risk);
        const peakAgeText = data.peak.daysSince === null ? 'unknown age' : `${formatAgeDays(data.peak.daysSince)} ago`;
        const peakText = data.peak.rating === null
            ? `not available for ${data.mode}`
            : `best ${data.peak.rating}; peak gap ${formatSignedNumber(data.peak.gap)} vs current; reached ${peakAgeText}; legitimacy impact ${formatRiskImpact(data.peak.risk)}`;

        return [
            `EloGuard cheat-risk estimate for ${data.username}: ${data.score}/100`,
            // MATCHUP ADVICE — DISABLED (see banner above getMatchupMetric):
            // `Matchup recommendation: ${data.matchup.verdict} (${data.matchup.score}/100)`,
            `Account age: ${ageText} (+${Math.round(data.accountAge.risk)})`,
            `Rated ${data.mode} history: ${data.volume.label}; ${totalGamesText} rated games; current rating: ${ratingText} (${volumeImpactText})`,
            `All-time best ${data.mode} rating: ${peakText}`,
            `Smurf signal: ${data.smurf.label} (+${Math.round(data.smurf.risk)})`,
            `Engine accuracy: ${accuracyText} (+${Math.round(data.accuracy.risk)})`,
            `Recent accuracy: ${recentAccuracyText}`,
            `Accuracy hot window: ${formText}`,
            `Recent win rate: ${winRateText} in ${data.winRate.games} ${sampleType} ${data.mode} game${data.winRate.games === 1 ? '' : 's'} (+${Math.round(data.winRate.risk)})`,
            `Current streak: ${data.winRate.streak} win${data.winRate.streak === 1 ? '' : 's'}`,
            `30-day performance rating: ${performanceText} (+${Math.round(data.performance.risk)})`,
            `Rating trajectory: ${trajectoryText} (+${Math.round(data.trajectory.risk)})`,
            `Rating surge: ${surgeText} (+${Math.round(data.surge.risk)})`,
            // ===== MATCHUP ADVICE — DISABLED (chess.com TOS review pending) =====
            // The matchup recommendation lines below are commented out (not deleted).
            // Re-enable with the matchup const block above and the getMatchupMetric()
            // call site in calculateOpponentLegitimacy().
            // `Matchup activity: ${matchupActivityText}`,
            // `Matchup form: ${matchupFormText}`,
            // `Recent-form recommendation cap: ${matchupFormCapText}`,
            // `Matchup performance: ${matchupPerformanceText}`,
            // `Peak rating matchup: ${matchupPeakText}`,
            // `Your form context: ${selfContextText}`,
            // `Form differential: ${formDifferentialText}`,
            // `Matchup odds desk: ${matchupOddsText}`,
            // `Rating-value trap: ${poolTrapText}`,
            // `Top matchup reasons: ${reasonsText}`,
            // `Matchup safety: ${data.matchup.riskPenalty.label} (${formatSignedNumber(data.matchup.riskPenalty.points)})`,
            `Primary concern: ${data.primaryConcern}`,
            `Confidence: ${data.confidence}`,
            `Visible score calibration: mild standalone risk is compressed; strong smurf/performance/accuracy combinations can set minimum score floors`,
            'Heuristic only; report through Chess.com if you have serious concerns.'
        ].join('\n');
    }

    function formatRiskImpact(value) {
        const rounded = Math.round(value || 0);
        if (rounded > 0) return `+${rounded}`;
        return String(rounded);
    }

    function formatSignedNumber(value) {
        const rounded = Math.round(value || 0);
        return rounded >= 0 ? `+${rounded}` : String(rounded);
    }

    function formatPercent(value) {
        if (!Number.isFinite(value)) return 'unknown';
        return `${Math.round(value * 100)}%`;
    }

    function formatSignedPercent(value) {
        if (!Number.isFinite(value)) return 'unknown';
        const percentage = value * 100;
        const rounded = Math.round(percentage * 10) / 10;
        return `${rounded >= 0 ? '+' : ''}${rounded}pp`;
    }

    function formatSignedDecimal(value) {
        if (!Number.isFinite(value)) return 'unknown';
        const rounded = Math.round(value * 10) / 10;
        return `${rounded >= 0 ? '+' : ''}${rounded}`;
    }

    function formatAgeDays(days) {
        if (days < 31) return `${days} day${days === 1 ? '' : 's'}`;
        if (days < 365) {
            const months = Math.floor(days / 30);
            return `${months} month${months === 1 ? '' : 's'}`;
        }
        const years = days / 365;
        return `${years.toFixed(years < 10 ? 1 : 0)} years`;
    }

    function getLegitimacyColor(score) {
        const hue = 120 - (clamp(score, 0, 100) * 1.2);
        return `hsl(${hue}, 72%, 46%)`;
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
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

        refreshEnhancedFocusBoardSignature();
        startEnhancedFocusObserver();
        restoreLegacyEnhancedFocusStageClocks();
        clearEnhancedFocusClockMarks();
        syncEnhancedFocusCustomClocks(stage);
        moveEnhancedFocusMaterial(stage.topMaterialSlot, stage.bottomMaterialSlot);
        ensureEnhancedFocusFlipButton(stage.stage);
        syncEnhancedFocusVisualFlip();
        document.body.classList.add(ENHANCED_FOCUS_READY_CLASS);
    }

    function clearEnhancedFocusLayout() {
        document.body?.classList.remove(ENHANCED_FOCUS_READY_CLASS);
        document.body?.classList.remove(ENHANCED_FOCUS_VISUAL_FLIPPED_CLASS);
        stopEnhancedFocusObserver();
        clearEnhancedFocusClockMarks();
        resetEnhancedFocusClockState();

        const toggle = document.getElementById(ENHANCED_FOCUS_TOGGLE_ID);
        if (toggle && toggle.parentNode !== document.body) document.body.appendChild(toggle);

        document.getElementById(ENHANCED_FOCUS_FLIP_BUTTON_ID)?.remove();
        ENHANCED_FOCUS_VISUAL_FLIPPED = false;
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

            const topMaterialSlot = document.createElement('div');
            topMaterialSlot.className = `${ENHANCED_FOCUS_MATERIAL_SLOT_CLASS} ${ENHANCED_FOCUS_TOP_MATERIAL_SLOT_CLASS}`;

            const bottomMaterialSlot = document.createElement('div');
            bottomMaterialSlot.className = `${ENHANCED_FOCUS_MATERIAL_SLOT_CLASS} ${ENHANCED_FOCUS_BOTTOM_MATERIAL_SLOT_CLASS}`;

            stage.append(topSlot, topMaterialSlot, boardSlot, bottomSlot, bottomMaterialSlot);
            document.body.appendChild(stage);
        } else {
            if (!stage.querySelector(`.${ENHANCED_FOCUS_TOP_MATERIAL_SLOT_CLASS}`)) {
                const topMaterialSlot = document.createElement('div');
                topMaterialSlot.className = `${ENHANCED_FOCUS_MATERIAL_SLOT_CLASS} ${ENHANCED_FOCUS_TOP_MATERIAL_SLOT_CLASS}`;
                stage.appendChild(topMaterialSlot);
            }
            if (!stage.querySelector(`.${ENHANCED_FOCUS_BOTTOM_MATERIAL_SLOT_CLASS}`)) {
                const bottomMaterialSlot = document.createElement('div');
                bottomMaterialSlot.className = `${ENHANCED_FOCUS_MATERIAL_SLOT_CLASS} ${ENHANCED_FOCUS_BOTTOM_MATERIAL_SLOT_CLASS}`;
                stage.appendChild(bottomMaterialSlot);
            }
        }

        return {
            stage,
            topSlot: stage.querySelector(`.${ENHANCED_FOCUS_TOP_SLOT_CLASS}`),
            boardSlot: stage.querySelector(`.${ENHANCED_FOCUS_BOARD_SLOT_CLASS}`),
            bottomSlot: stage.querySelector(`.${ENHANCED_FOCUS_BOTTOM_SLOT_CLASS}`),
            topMaterialSlot: stage.querySelector(`.${ENHANCED_FOCUS_TOP_MATERIAL_SLOT_CLASS}`),
            bottomMaterialSlot: stage.querySelector(`.${ENHANCED_FOCUS_BOTTOM_MATERIAL_SLOT_CLASS}`)
        };
    }

    function ensureEnhancedFocusToggle() {
        if (!document.body || window.__ELOGUARD_CONTENT_VERSION__ !== CONTENT_VERSION) return null;

        let toggle = document.getElementById(ENHANCED_FOCUS_TOGGLE_ID);
        if (toggle?.dataset.eloGuardControlVersion !== ENHANCED_FOCUS_TOGGLE_CONTROL_VERSION) {
            // Rebuild controls created by older content-script generations so stale
            // drag and click listeners cannot keep affecting the current button.
            toggle.remove();
            toggle = null;
        }
        if (!toggle) {
            toggle = document.createElement('button');
            toggle.id = ENHANCED_FOCUS_TOGGLE_ID;
            toggle.type = 'button';
            toggle.dataset.eloGuardControlVersion = ENHANCED_FOCUS_TOGGLE_CONTROL_VERSION;

            const label = document.createElement('span');
            label.className = ENHANCED_FOCUS_TOGGLE_LABEL_CLASS;

            toggle.append(label);
            toggle.addEventListener('click', handleEnhancedFocusToggleClick);
        }

        // Clear positions left by versions that allowed dragging. The stylesheet is
        // now the single source of truth and keeps this control at the top-right.
        toggle.style.removeProperty('left');
        toggle.style.removeProperty('top');
        toggle.style.removeProperty('right');
        toggle.style.removeProperty('bottom');

        renderEnhancedFocusToggle(toggle);

        if (toggle.parentNode !== document.body) document.body.appendChild(toggle);

        return toggle;
    }

    function handleEnhancedFocusToggleClick() {
        if (window.__ELOGUARD_CONTENT_VERSION__ !== CONTENT_VERSION) return;
        ENHANCED_FOCUS_MODE = !ENHANCED_FOCUS_MODE;
        chrome.storage.sync.set({ enhancedFocusMode: ENHANCED_FOCUS_MODE });
        applyEnhancedFocusMode();
    }

    function renderEnhancedFocusToggle(toggle) {
        if (!toggle || window.__ELOGUARD_CONTENT_VERSION__ !== CONTENT_VERSION) return;
        const label = toggle.querySelector(`.${ENHANCED_FOCUS_TOGGLE_LABEL_CLASS}`);
        if (label) label.textContent = ENHANCED_FOCUS_MODE ? 'Exit focus' : 'Enhanced focus';
        toggle.setAttribute('aria-pressed', ENHANCED_FOCUS_MODE ? 'true' : 'false');
        toggle.setAttribute('aria-label', ENHANCED_FOCUS_MODE
            ? 'Exit enhanced focus mode'
            : 'Enter enhanced focus mode');
        toggle.title = ENHANCED_FOCUS_MODE ? 'Exit enhanced focus mode' : 'Enter enhanced focus mode';
    }

    function ensureEnhancedFocusFlipButton(parent = document.getElementById(ENHANCED_FOCUS_STAGE_ID)) {
        if (!document.body || !parent) return null;

        let button = document.getElementById(ENHANCED_FOCUS_FLIP_BUTTON_ID);
        if (!button) {
            button = document.createElement('button');
            button.id = ENHANCED_FOCUS_FLIP_BUTTON_ID;
            button.type = 'button';
            button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                flipEnhancedFocusBoard();
            });
        }

        button.textContent = 'Flip';
        button.title = 'Flip chessboard orientation';
        button.setAttribute('aria-label', 'Flip chessboard orientation');
        button.hidden = !ENHANCED_FOCUS_MODE;

        if (button.parentNode !== parent) parent.appendChild(button);
        return button;
    }

    function flipEnhancedFocusBoard() {
        const flippedNatively = clickNativeBoardFlipControl() || flipBoardWithKnownApi(findEnhancedFocusBoardElement());

        if (flippedNatively) {
            ENHANCED_FOCUS_VISUAL_FLIPPED = false;
        } else {
            ENHANCED_FOCUS_VISUAL_FLIPPED = !ENHANCED_FOCUS_VISUAL_FLIPPED;
        }

        syncEnhancedFocusVisualFlip();
        requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    }

    function syncEnhancedFocusVisualFlip() {
        if (!document.body) return;
        document.body.classList.toggle(
            ENHANCED_FOCUS_VISUAL_FLIPPED_CLASS,
            Boolean(ENHANCED_FOCUS_MODE && ENHANCED_FOCUS_VISUAL_FLIPPED)
        );
    }

    function clickNativeBoardFlipControl() {
        const stage = document.getElementById(ENHANCED_FOCUS_STAGE_ID);
        const candidates = Array.from(document.querySelectorAll([
            'button',
            '[role="button"]',
            '[aria-label]',
            '[title]',
            '[data-cy]',
            '[data-test-element]',
            '[class*="flip"]',
            '[class*="rotate"]'
        ].join(',')));

        for (const candidate of candidates) {
            if (!(candidate instanceof HTMLElement)) continue;
            if (candidate.id === ENHANCED_FOCUS_FLIP_BUTTON_ID || candidate.id === ENHANCED_FOCUS_TOGGLE_ID) continue;
            if (stage?.contains(candidate)) continue;
            if (candidate.disabled || candidate.getAttribute('aria-disabled') === 'true') continue;

            const descriptor = getBoardFlipDescriptor(candidate);
            if (!/\b(flip|rotate)\b/i.test(descriptor)) continue;

            const hasBoardContext = /\b(board|orientation)\b/i.test(descriptor)
                || Boolean(candidate.closest('[class*="board"], [id*="board"], [data-cy*="board"], [class*="game-controls"], [class*="game-buttons"]'));
            if (!hasBoardContext) continue;

            try {
                candidate.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
                candidate.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
                candidate.click();
                return true;
            } catch (e) {
                return false;
            }
        }

        return false;
    }

    function getBoardFlipDescriptor(el) {
        return [
            el.textContent,
            el.getAttribute('aria-label'),
            el.getAttribute('title'),
            el.getAttribute('data-cy'),
            el.getAttribute('data-test-element'),
            el.getAttribute('data-tooltip'),
            el.getAttribute('class')
        ]
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function flipBoardWithKnownApi(boardEl) {
        const targets = [
            boardEl,
            boardEl?.parentElement,
            boardEl?.closest?.('wc-chess-board, chess-board, cg-board, [class*="chess-board"], [class*="board-layout-chessboard"], [class*="board-layout-board"]')
        ].filter((target, index, all) => target && all.indexOf(target) === index);

        for (const target of targets) {
            for (const method of ['flip', 'flipBoard', 'toggleOrientation', 'toggleBoardOrientation', 'togglePerspective']) {
                if (typeof target[method] !== 'function') continue;
                try {
                    target[method]();
                    return true;
                } catch (e) {
                    // Try the next known board hook.
                }
            }
        }

        for (const target of targets) {
            const currentOrientation = getBoardOrientationState(target);
            if (!currentOrientation) continue;
            if (setBoardOrientationState(target, currentOrientation === 'black' ? 'white' : 'black')) return true;
        }

        return false;
    }

    function getBoardOrientationState(el) {
        if (!el) return '';

        for (const prop of ['orientation', 'boardOrientation', 'perspective']) {
            const value = normalizeBoardOrientationValue(el[prop]);
            if (value) return value;
        }

        for (const attr of ['orientation', 'data-orientation', 'data-board-orientation', 'perspective']) {
            const value = normalizeBoardOrientationValue(el.getAttribute?.(attr));
            if (value) return value;
        }

        for (const prop of ['flipped', 'isFlipped']) {
            if (typeof el[prop] === 'boolean') return el[prop] ? 'black' : 'white';
        }

        const classText = el.getAttribute?.('class') || '';
        if (/\borientation-black\b|\bblack-bottom\b|\bflipped\b/i.test(classText)) return 'black';
        if (/\borientation-white\b|\bwhite-bottom\b/i.test(classText)) return 'white';
        return '';
    }

    function normalizeBoardOrientationValue(value) {
        const normalized = String(value || '').toLowerCase();
        if (/\bblack\b|flipped/.test(normalized)) return 'black';
        if (/\bwhite\b|normal/.test(normalized)) return 'white';
        return '';
    }

    function setBoardOrientationState(el, orientation) {
        if (!el) return false;
        const flipped = orientation === 'black';
        let changed = false;

        for (const prop of ['orientation', 'boardOrientation', 'perspective']) {
            if (!(prop in el)) continue;
            try {
                el[prop] = orientation;
                changed = true;
            } catch (e) {
                // Some custom element properties are read-only.
            }
        }

        for (const prop of ['flipped', 'isFlipped']) {
            if (!(prop in el)) continue;
            try {
                el[prop] = flipped;
                changed = true;
            } catch (e) {
                // Some custom element properties are read-only.
            }
        }

        for (const attr of ['orientation', 'data-orientation', 'data-board-orientation', 'perspective']) {
            if (!el.hasAttribute?.(attr)) continue;
            el.setAttribute(attr, orientation);
            changed = true;
        }

        if (el.hasAttribute?.('flipped')) {
            if (flipped) el.setAttribute('flipped', '');
            else el.removeAttribute('flipped');
            changed = true;
        }

        if (el.classList?.contains('orientation-white') || el.classList?.contains('orientation-black')) {
            el.classList.toggle('orientation-white', !flipped);
            el.classList.toggle('orientation-black', flipped);
            changed = true;
        }

        if (el.classList?.contains('white-bottom') || el.classList?.contains('black-bottom')) {
            el.classList.toggle('white-bottom', !flipped);
            el.classList.toggle('black-bottom', flipped);
            changed = true;
        }

        if (el.classList?.contains('flipped')) {
            el.classList.toggle('flipped', flipped);
            changed = true;
        }

        if (!changed) return false;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new CustomEvent('orientationchange', { bubbles: true, detail: { orientation } }));
        el.dispatchEvent(new CustomEvent('boardorientationchange', { bubbles: true, detail: { orientation } }));
        return true;
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

        const moved = el.parentNode !== slot;
        const managedClasses = [
            ENHANCED_FOCUS_BOARD_CLASS,
            ENHANCED_FOCUS_TOP_CLOCK_CLASS,
            ENHANCED_FOCUS_BOTTOM_CLOCK_CLASS,
            ENHANCED_FOCUS_NATIVE_CLOCK_CLASS,
            ENHANCED_FOCUS_MATERIAL_CLASS
        ];

        // The focus layout is reconciled on a timer. Re-appending an element that is
        // already in the right slot still emits child-list mutations; on chess.com that
        // makes terminal board decorations (checkmate/winner highlights) get recreated
        // every tick. Only mutate the class list or DOM when something actually changed.
        managedClasses.forEach(managedClass => {
            if (managedClass !== className && el.classList.contains(managedClass)) {
                el.classList.remove(managedClass);
            }
        });
        if (!el.classList.contains(className)) el.classList.add(className);
        if (!moved) return;

        slot.appendChild(el);
        requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    }

    function restoreEnhancedFocusElement(el) {
        if (!el) return;

        el.classList.remove(
            ENHANCED_FOCUS_BOARD_CLASS,
            ENHANCED_FOCUS_TOP_CLOCK_CLASS,
            ENHANCED_FOCUS_BOTTOM_CLOCK_CLASS,
            ENHANCED_FOCUS_NATIVE_CLOCK_CLASS,
            ENHANCED_FOCUS_MATERIAL_CLASS
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
            || el?.classList?.contains(ENHANCED_FOCUS_BOTTOM_SLOT_CLASS)
            || el?.classList?.contains(ENHANCED_FOCUS_MATERIAL_SLOT_CLASS)
            || el?.classList?.contains(ENHANCED_FOCUS_TOP_MATERIAL_SLOT_CLASS)
            || el?.classList?.contains(ENHANCED_FOCUS_BOTTOM_MATERIAL_SLOT_CLASS);
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

    function isEloGuardBoardChrome(el) {
        if (!el) return false;
        const ownedSelector = [
            '#elo-guard-review-panel',
            '#elo-guard-review-board-overlay',
            '#elo-guard-review-board-toggle',
            '#elo-guard-postgame-floating',
            '.elo-guard-postgame-buttons',
            '#elo-guard-legitimacy-badge',
            '#elo-guard-enhanced-focus-toggle',
            '#elo-guard-enhanced-focus-flip'
        ].join(',');
        return Boolean(el.matches?.(ownedSelector) || el.closest?.(ownedSelector));
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

    function startEnhancedFocusObserver() {
        if (ENHANCED_FOCUS_OBSERVER || !document.body) return;

        ENHANCED_FOCUS_OBSERVER = new MutationObserver((mutations) => {
            if (!ENHANCED_FOCUS_MODE) return;
            if (!mutations.some(isEnhancedFocusRealtimeMutation)) return;
            syncEnhancedFocusRealtime();
        });

        ENHANCED_FOCUS_OBSERVER.observe(document.body, {
            subtree: true,
            childList: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'aria-label', 'title', 'data-cy', 'data-test-element']
        });
    }

    function stopEnhancedFocusObserver() {
        if (!ENHANCED_FOCUS_OBSERVER) return;
        ENHANCED_FOCUS_OBSERVER.disconnect();
        ENHANCED_FOCUS_OBSERVER = null;
    }

    function isEnhancedFocusRealtimeMutation(mutation) {
        const target = mutation.target?.nodeType === Node.ELEMENT_NODE
            ? mutation.target
            : mutation.target?.parentElement;
        if (!target || elementIsInsideEnhancedFocusStage(target)) return false;

        const targetText = [
            target.id,
            target.getAttribute?.('class'),
            target.getAttribute?.('data-cy'),
            target.getAttribute?.('data-test-element'),
            target.tagName
        ].filter(Boolean).join(' ');

        if (/\b(clock|player|captured|piece|board|move|time)\b/i.test(targetText)) return true;
        if (target.closest?.('.clock-component, [class*="clock-component"], [data-cy*="clock"], wc-captured-pieces, .player-pieces, [class*="captured-pieces"], #board-layout-player-top, #board-layout-player-bottom, .board-layout-player-top, .board-layout-player-bottom, [class*="player-top"], [class*="player-bottom"], [class*="move-list"], [class*="board"]')) return true;

        return Array.from(mutation.addedNodes || []).some(node => {
            if (node.nodeType !== Node.ELEMENT_NODE) return false;
            const text = `${node.id || ''} ${node.getAttribute?.('class') || ''} ${node.tagName || ''}`;
            return /\b(clock|player|captured|piece|board|move|time)\b/i.test(text);
        });
    }

    function syncEnhancedFocusRealtime() {
        const parts = getEnhancedFocusStageParts();
        if (!parts) return;
        const boardChanged = refreshEnhancedFocusBoardSignature();
        syncEnhancedFocusCustomClocks(parts, { boardChanged });
        moveEnhancedFocusMaterial(parts.topMaterialSlot, parts.bottomMaterialSlot);
    }

    function syncEnhancedFocusCustomClocks(stageParts = null, options = {}) {
        if (!ENHANCED_FOCUS_MODE) return;

        const parts = stageParts || getEnhancedFocusStageParts();
        if (!parts?.topSlot || !parts?.bottomSlot) return;

        const topBox = ensureEnhancedFocusClockMirror(parts.topSlot, 'top');
        const bottomBox = ensureEnhancedFocusClockMirror(parts.bottomSlot, 'bottom');
        const stagedTopClock = getEnhancedFocusClockFromMirror(topBox);
        const stagedBottomClock = getEnhancedFocusClockFromMirror(bottomBox);
        const clocks = getEnhancedFocusClockElements();
        const topNativeClock = clocks[0] || stagedTopClock || null;
        const bottomNativeClock = clocks.length > 1 ? clocks[clocks.length - 1] : stagedBottomClock || null;

        const previousTopText = ENHANCED_FOCUS_CLOCK_STATE.topText;
        const previousBottomText = ENHANCED_FOCUS_CLOCK_STATE.bottomText;
        const topText = getEnhancedFocusClockText(topNativeClock) || previousTopText || '--:--';
        const bottomText = getEnhancedFocusClockText(bottomNativeClock) || previousBottomText || '--:--';
        updateEnhancedFocusClockMirror(topBox, topNativeClock, topText);
        updateEnhancedFocusClockMirror(bottomBox, bottomNativeClock, bottomText);

        ENHANCED_FOCUS_CLOCK_STATE.topText = topText;
        ENHANCED_FOCUS_CLOCK_STATE.bottomText = bottomText;

        const previousActivePosition = ENHANCED_FOCUS_CLOCK_STATE.activePosition;
        const directActivePosition = getEnhancedFocusActiveClockPosition(topNativeClock, bottomNativeClock);
        const tickActivePosition = inferEnhancedFocusActiveClockFromTick(previousTopText, topText, previousBottomText, bottomText);
        let activePosition = directActivePosition || tickActivePosition || previousActivePosition;

        if (options.boardChanged && previousActivePosition && !tickActivePosition) {
            activePosition = directActivePosition && directActivePosition !== previousActivePosition
                ? directActivePosition
                : getOppositeEnhancedFocusClockPosition(previousActivePosition);
        }

        if (activePosition) {
            ENHANCED_FOCUS_CLOCK_STATE.activePosition = activePosition;
        }

        topBox.dataset.active = activePosition === 'top' ? 'true' : 'false';
        bottomBox.dataset.active = activePosition === 'bottom' ? 'true' : 'false';
        topBox.querySelector(`.${ENHANCED_FOCUS_TIMEBOX_CLASS}`)?.setAttribute('data-active', topBox.dataset.active);
        bottomBox.querySelector(`.${ENHANCED_FOCUS_TIMEBOX_CLASS}`)?.setAttribute('data-active', bottomBox.dataset.active);
    }

    function getEnhancedFocusStageParts() {
        const stage = document.getElementById(ENHANCED_FOCUS_STAGE_ID);
        if (!stage) return null;
        return {
            stage,
            topSlot: stage.querySelector(`.${ENHANCED_FOCUS_TOP_SLOT_CLASS}`),
            bottomSlot: stage.querySelector(`.${ENHANCED_FOCUS_BOTTOM_SLOT_CLASS}`),
            topMaterialSlot: stage.querySelector(`.${ENHANCED_FOCUS_TOP_MATERIAL_SLOT_CLASS}`),
            bottomMaterialSlot: stage.querySelector(`.${ENHANCED_FOCUS_BOTTOM_MATERIAL_SLOT_CLASS}`)
        };
    }

    function ensureEnhancedFocusClockMirror(slot, position) {
        let box = slot.querySelector(`.${ENHANCED_FOCUS_CLOCK_MIRROR_CLASS}[data-position="${position}"]`);
        if (!box) {
            box = document.createElement('div');
            box.className = ENHANCED_FOCUS_CLOCK_MIRROR_CLASS;
            box.dataset.position = position;
            box.dataset.active = 'false';
            slot.appendChild(box);
        }
        return box;
    }

    function updateEnhancedFocusClockMirror(box, nativeClock, fallbackText) {
        if (!box) return;

        if (nativeClock) {
            removeEnhancedFocusClockMirrorChildren(box, nativeClock);
            moveEnhancedFocusElement(box, nativeClock, ENHANCED_FOCUS_NATIVE_CLOCK_CLASS);
            box.dataset.clockSignature = 'native';
            return;
        }

        if (getEnhancedFocusClockFromMirror(box)) return;

        const fallback = box.querySelector(`.${ENHANCED_FOCUS_TIMEBOX_CLASS}`) || createEnhancedFocusFallbackClock(fallbackText);
        fallback.querySelector(`.${ENHANCED_FOCUS_TIMEBOX_TEXT_CLASS}`).textContent = fallbackText || '--:--';
        if (fallback.parentNode !== box) {
            removeEnhancedFocusClockMirrorChildren(box, fallback);
            box.appendChild(fallback);
        }
        box.dataset.clockSignature = `fallback:${fallbackText}`;
    }

    function getEnhancedFocusClockFromMirror(box) {
        if (!box) return null;
        return Array.from(box.children)
            .map(child => child.matches?.(`.${ENHANCED_FOCUS_NATIVE_CLOCK_CLASS}, .clock-component, [class*="clock-component"], [data-cy*="clock"]`)
                ? child
                : child.querySelector?.(`.${ENHANCED_FOCUS_NATIVE_CLOCK_CLASS}, .clock-component, [class*="clock-component"], [data-cy*="clock"]`))
            .find(clock => clock && !clock.classList?.contains(ENHANCED_FOCUS_TIMEBOX_CLASS)) || null;
    }

    function removeEnhancedFocusClockMirrorChildren(box, keep) {
        Array.from(box.children).forEach(child => {
            if (child === keep || child.contains?.(keep)) return;
            if (ENHANCED_FOCUS_ORIGINAL_PLACEMENTS.has(child)) {
                restoreEnhancedFocusElement(child);
            } else {
                child.remove();
            }
        });
    }

    function sanitizeEnhancedFocusClockClone(clone) {
        clone.removeAttribute?.('id');
        clone.setAttribute?.('aria-hidden', 'true');
        clone.querySelectorAll?.('[id]').forEach(el => el.removeAttribute('id'));
        clone.querySelectorAll?.('button, a, [role="button"], input, select, textarea').forEach(el => {
            el.setAttribute('tabindex', '-1');
            el.setAttribute('aria-hidden', 'true');
        });
    }

    function createEnhancedFocusFallbackClock(text) {
        const clock = document.createElement('div');
        clock.className = ENHANCED_FOCUS_TIMEBOX_CLASS;

        const icon = document.createElement('span');
        icon.className = ENHANCED_FOCUS_TIMEBOX_ICON_CLASS;
        icon.setAttribute('aria-hidden', 'true');

        const time = document.createElement('span');
        time.className = ENHANCED_FOCUS_TIMEBOX_TEXT_CLASS;
        time.textContent = text || '--:--';

        clock.append(icon, time);
        return clock;
    }

    function resetEnhancedFocusClockState() {
        ENHANCED_FOCUS_CLOCK_STATE.topText = '';
        ENHANCED_FOCUS_CLOCK_STATE.bottomText = '';
        ENHANCED_FOCUS_CLOCK_STATE.activePosition = '';
        ENHANCED_FOCUS_CLOCK_STATE.boardSignature = '';
        ENHANCED_FOCUS_CLOCK_STATE.lastBoardFlipAt = 0;
    }

    function getEnhancedFocusClockText(clockEl) {
        if (!clockEl) return '';
        const source = [
            clockEl.getAttribute?.('aria-label'),
            clockEl.getAttribute?.('title'),
            clockEl.textContent
        ].filter(Boolean).join(' ');
        const match = source.match(/\b\d{1,2}\s*:\s*\d{2}(?:\.\d)?\b/);
        return match ? match[0].replace(/\s+/g, '') : '';
    }

    function getEnhancedFocusActiveClockPosition(topClock, bottomClock) {
        const topActive = isEnhancedFocusNativeClockActive(topClock);
        const bottomActive = isEnhancedFocusNativeClockActive(bottomClock);

        if (topActive && !bottomActive) return 'top';
        if (bottomActive && !topActive) return 'bottom';
        return '';
    }

    function inferEnhancedFocusActiveClockFromTick(previousTopText, topText, previousBottomText, bottomText) {
        const previousTop = parseEnhancedFocusClockSeconds(previousTopText);
        const top = parseEnhancedFocusClockSeconds(topText);
        const previousBottom = parseEnhancedFocusClockSeconds(previousBottomText);
        const bottom = parseEnhancedFocusClockSeconds(bottomText);

        const topTicked = Number.isFinite(previousTop) && Number.isFinite(top) && top < previousTop;
        const bottomTicked = Number.isFinite(previousBottom) && Number.isFinite(bottom) && bottom < previousBottom;

        if (topTicked && !bottomTicked) return 'top';
        if (bottomTicked && !topTicked) return 'bottom';
        return '';
    }

    function getOppositeEnhancedFocusClockPosition(position) {
        if (position === 'top') return 'bottom';
        if (position === 'bottom') return 'top';
        return '';
    }

    function refreshEnhancedFocusBoardSignature() {
        const signature = getEnhancedFocusBoardSignature();
        if (!signature) return false;

        const previousSignature = ENHANCED_FOCUS_CLOCK_STATE.boardSignature;
        ENHANCED_FOCUS_CLOCK_STATE.boardSignature = signature;
        if (!previousSignature || previousSignature === signature) return false;

        const now = performance.now();
        if (now - ENHANCED_FOCUS_CLOCK_STATE.lastBoardFlipAt < 300) return false;
        ENHANCED_FOCUS_CLOCK_STATE.lastBoardFlipAt = now;
        return true;
    }

    function getEnhancedFocusBoardSignature() {
        const board = findEnhancedFocusBoardElement();
        if (!board) return '';

        const pieces = Array.from(board.querySelectorAll('piece, .piece'))
            .map(piece => [
                piece.getAttribute?.('class') || '',
                piece.getAttribute?.('style') || '',
                piece.getAttribute?.('data-square') || '',
                piece.getAttribute?.('square') || ''
            ].join('|'))
            .filter(Boolean)
            .sort();

        if (pieces.length) return pieces.join(';');

        return [
            board.getAttribute?.('fen') || '',
            board.getAttribute?.('position') || '',
            board.getAttribute?.('style') || '',
            board.textContent || ''
        ].join('|').trim();
    }

    function parseEnhancedFocusClockSeconds(text) {
        const match = String(text || '').match(/^(\d{1,2}):(\d{2})(?:\.(\d))?$/);
        if (!match) return NaN;
        return (Number(match[1]) * 60) + Number(match[2]) + (match[3] ? Number(`0.${match[3]}`) : 0);
    }

    function isEnhancedFocusNativeClockActive(clockEl) {
        if (!clockEl) return false;

        const descriptor = [
            getEnhancedFocusAncestorClassText(clockEl, 6),
            clockEl.getAttribute?.('aria-label'),
            clockEl.getAttribute?.('title'),
            clockEl.getAttribute?.('data-cy'),
            clockEl.getAttribute?.('data-test-element')
        ].filter(Boolean).join(' ');

        if (/\b(active|current|running|turn|player-turn|clock-player-turn|highlight)\b/i.test(descriptor)
            && !/\b(inactive|paused|disabled)\b/i.test(descriptor)) {
            return true;
        }

        return getEnhancedFocusClockVisualBrightness(clockEl) >= 205;
    }

    function getEnhancedFocusAncestorClassText(el, limit = 6) {
        const classes = [];
        let current = el;
        while (current && classes.length < limit && !elementIsInsideEnhancedFocusStage(current)) {
            classes.push(current.className, current.getAttribute?.('class'));
            current = current.parentElement;
        }
        return classes.filter(Boolean).join(' ');
    }

    function getEnhancedFocusClockVisualBrightness(clockEl) {
        const parents = [];
        let parent = clockEl.parentElement;
        while (parent && parents.length < 3 && !elementIsInsideEnhancedFocusStage(parent)) {
            parents.push(parent);
            parent = parent.parentElement;
        }

        const targets = [clockEl, ...parents, ...Array.from(clockEl.querySelectorAll?.('*') || []).slice(0, 12)];
        let brightest = 0;

        for (const target of targets) {
            const style = window.getComputedStyle(target);
            const bg = parseEnhancedFocusRgb(style.backgroundColor);
            if (!bg || bg.alpha < 0.5) continue;
            const brightness = ((bg.red * 299) + (bg.green * 587) + (bg.blue * 114)) / 1000;
            brightest = Math.max(brightest, brightness);
        }

        return brightest;
    }

    function parseEnhancedFocusRgb(color) {
        const match = String(color || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
        if (!match) return null;
        return {
            red: Number(match[1]),
            green: Number(match[2]),
            blue: Number(match[3]),
            alpha: match[4] === undefined ? 1 : Number(match[4])
        };
    }

    function moveEnhancedFocusMaterial(topSlot, bottomSlot) {
        if (!topSlot && !bottomSlot) return;

        const materialRows = getEnhancedFocusMaterialElementsWithPosition();
        moveEnhancedFocusMaterialRowForPosition(topSlot, materialRows, 'top');
        moveEnhancedFocusMaterialRowForPosition(bottomSlot, materialRows, 'bottom');
        if (topSlot) topSlot.hidden = !topSlot.querySelector(`.${ENHANCED_FOCUS_MATERIAL_CLASS}`);
        if (bottomSlot) bottomSlot.hidden = !bottomSlot.querySelector(`.${ENHANCED_FOCUS_MATERIAL_CLASS}`);
    }

    function moveEnhancedFocusMaterialRowForPosition(slot, materialRows, position) {
        if (!slot) return;
        const rows = materialRows.filter(item => item.position === position).map(item => item.row);
        const sourceRow = rows.find(row => !elementIsInsideEnhancedFocusStage(row));
        const row = sourceRow || rows[0] || null;
        removeEnhancedFocusMaterialSlotChildren(slot, row);
        if (!row) return;
        prepareEnhancedFocusMaterialRow(row, position);
        moveEnhancedFocusElement(slot, row, ENHANCED_FOCUS_MATERIAL_CLASS);
    }

    function removeEnhancedFocusMaterialSlotChildren(slot, keep) {
        Array.from(slot.children).forEach(child => {
            if (child === keep || child.contains?.(keep)) return;
            if (ENHANCED_FOCUS_ORIGINAL_PLACEMENTS.has(child)) {
                restoreEnhancedFocusElement(child);
            } else {
                child.remove();
            }
        });
    }

    function prepareEnhancedFocusMaterialRow(row, position) {
        if (!row) return;
        row.dataset.eloGuardMaterialPosition = position || '';
        if (row.matches?.('wc-captured-pieces')) {
            row.setAttribute('vertical-layout', 'false');
        }
        row.querySelectorAll?.('wc-captured-pieces').forEach(pieceRow => {
            pieceRow.setAttribute('vertical-layout', 'false');
        });
    }

    function getEnhancedFocusMaterialElementsWithPosition() {
        return getEnhancedFocusMaterialElements()
            .map(row => ({ row, position: getEnhancedFocusMaterialPosition(row) }))
            .filter(item => item.position === 'top' || item.position === 'bottom')
            .sort((a, b) => (a.position === 'top' ? 0 : 1) - (b.position === 'top' ? 0 : 1));
    }

    function getEnhancedFocusMaterialElements() {
        const candidates = Array.from(document.querySelectorAll('wc-captured-pieces.player-pieces, wc-captured-pieces, .player-pieces, .elo-guard-enhanced-focus-material'))
            .filter(el => {
                if (!el) return false;
                if (elementIsInsideEnhancedFocusStage(el)) {
                    return el.classList?.contains(ENHANCED_FOCUS_MATERIAL_CLASS);
                }
                if (el.closest('[class*="sidebar"], [class*="move-list"], [class*="analysis-sidebar"]')) return false;
                return Boolean(el.closest('#board-layout-player-top, #board-layout-player-bottom, .board-layout-player-top, .board-layout-player-bottom, [class*="player-top"], [class*="player-bottom"]'));
            })
            .filter((el, index, all) => !all.some((other, otherIndex) => otherIndex !== index && other.contains(el)))
            .sort((a, b) => getEnhancedFocusMaterialSortKey(a) - getEnhancedFocusMaterialSortKey(b));

        return [...new Set(candidates)];
    }

    function getEnhancedFocusMaterialPosition(el) {
        if (el.dataset?.eloGuardMaterialPosition) return el.dataset.eloGuardMaterialPosition;
        const host = el.closest('#board-layout-player-top, #board-layout-player-bottom, .board-layout-player-top, .board-layout-player-bottom, [class*="player-top"], [class*="player-bottom"]');
        const classText = `${host?.id || ''} ${host?.getAttribute?.('class') || ''}`;
        if (/\btop\b/i.test(classText)) return 'top';
        if (/\bbottom\b/i.test(classText)) return 'bottom';
        return '';
    }

    function getEnhancedFocusMaterialSortKey(el) {
        const position = getEnhancedFocusMaterialPosition(el);
        if (position === 'top') return 0;
        if (position === 'bottom') return 1;
        return getEnhancedFocusSortRect(el).top;
    }

    function findEnhancedFocusBoardElement() {
        clearStaleEnhancedFocusClasses();

        const directSelectors = [
            `.${ENHANCED_FOCUS_BOARD_CLASS}`,
            '#board-single',
            'wc-chess-board',
            'chess-board',
            'cg-board',
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
        if (isEloGuardBoardChrome(el)) return false;
        if (el.closest('#board-layout-player-top, #board-layout-player-bottom, [class*="player-top"], [class*="player-bottom"], [class*="sidebar"]')) return false;

        const rect = el.getBoundingClientRect();
        if (rect.width < 240 || rect.height < 240) return false;

        const ratio = rect.width / rect.height;
        return ratio > 0.75 && ratio < 1.25;
    }

    function getEnhancedFocusClockElements() {
        const playerHosts = [
            document.querySelector('#board-layout-player-top, .board-layout-player-top, [class*="player-top"]'),
            document.querySelector('#board-layout-player-bottom, .board-layout-player-bottom, [class*="player-bottom"]')
        ].filter(Boolean);

        const hostedClocks = playerHosts
            .map(getEnhancedFocusClockFromHost)
            .filter(Boolean);

        if (hostedClocks.length >= 2) {
            return [...new Set(hostedClocks)].sort((a, b) => getEnhancedFocusSortRect(a).top - getEnhancedFocusSortRect(b).top);
        }

        const clocks = Array.from(document.querySelectorAll('.clock-component, [class*="clock-component"], [data-cy*="clock"]'))
            .map(normalizeEnhancedFocusClockElement)
            .filter(isEnhancedFocusClockCandidate)
            .filter((el, index, all) => all.indexOf(el) === index)
            .filter((el, index, all) => !all.some((other, otherIndex) => otherIndex !== index && other.contains(el)));

        return [...new Set(clocks)].sort((a, b) => getEnhancedFocusSortRect(a).top - getEnhancedFocusSortRect(b).top);
    }

    function getEnhancedFocusClockFromHost(host) {
        return Array.from(host.querySelectorAll('.clock-component, [class*="clock-component"], [data-cy*="clock"]'))
            .map(normalizeEnhancedFocusClockElement)
            .filter(isEnhancedFocusClockCandidate)
            .filter((el, index, all) => all.indexOf(el) === index)
            .find(Boolean) || null;
    }

    function normalizeEnhancedFocusClockElement(el) {
        return el?.closest?.('.clock-component, [class*="clock-component"]') || el;
    }

    function isEnhancedFocusClockCandidate(el) {
        if (!el || elementIsInsideEnhancedFocusStage(el)) return false;
        if (el.id === ENHANCED_FOCUS_TOGGLE_ID || el.id === ENHANCED_FOCUS_FLIP_BUTTON_ID) return false;
        if (el.closest(`#${ENHANCED_FOCUS_STAGE_ID}, #${ENHANCED_FOCUS_TOGGLE_ID}, #${ENHANCED_FOCUS_FLIP_BUTTON_ID}`)) return false;
        const rect = el.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 20) return false;
        const text = `${el.textContent || ''} ${el.getAttribute('aria-label') || ''}`.trim();
        return /\b\d{1,2}\s*:\s*\d{2}(?:\.\d)?\b/.test(text);
    }

    function applyEnhancedFocusMode() {
        if (!document.body || window.__ELOGUARD_CONTENT_VERSION__ !== CONTENT_VERSION) return;

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
        hideBoardRatingsForZen();
    }

    function applyRiskProfilePillVisibility() {
        if (!document.body) return;

        document.body.classList.toggle('elo-guard-hide-risk-profile-pill', !SHOW_RISK_PROFILE_PILL);
        if (!SHOW_RISK_PROFILE_PILL) hideOpponentLegitimacyBadge();
    }

    // Entitlement reads swallow chrome.storage errors and default to "free", so
    // an orphaned content script (extension reloaded/updated while this tab was
    // open) would silently demote a Pro user to the upsell. Detect that state
    // up front and mark the result so callers show "reload this page" instead.
    function premiumCheckFailedAccess(error) {
        return {
            allowed: false, isPro: false, limit: 0, remaining: 0, alreadyGranted: false,
            unavailable: true,
            contextInvalidated: isExtensionContextInvalidated(error)
        };
    }

    async function consumePremiumFeature(featureKey, usageId) {
        const api = window.EloGuardEntitlements;
        if (isExtensionContextInvalidated(null) || !api || typeof api.consumeFeature !== 'function') {
            return premiumCheckFailedAccess(null);
        }

        try {
            return await api.consumeFeature(featureKey, usageId);
        } catch (e) {
            return premiumCheckFailedAccess(e);
        }
    }

    async function getPremiumFeatureAccess(featureKey, usageId) {
        const api = window.EloGuardEntitlements;
        if (isExtensionContextInvalidated(null) || !api || typeof api.getFeatureAccess !== 'function') {
            return premiumCheckFailedAccess(null);
        }

        try {
            return await api.getFeatureAccess(featureKey, usageId);
        } catch (e) {
            return premiumCheckFailedAccess(e);
        }
    }

    function dailyLeftSuffix(access) {
        if (!access || access.isPro || access.unavailable || !Number.isFinite(access.remaining)) return '';
        return ` (${Math.max(0, access.remaining)} left)`;
    }

    async function updateDailyLeftButton(button, baseText, featureKey, usageId) {
        if (!button) return null;
        try {
            const access = await getPremiumFeatureAccess(featureKey, usageId);
            if (!button.isConnected) return access;
            button.textContent = `${baseText}${dailyLeftSuffix(access)}`;
            if (!access.isPro && !access.unavailable && Number.isFinite(access.remaining)) {
                const limit = Number.isFinite(access.limit) ? access.limit : 0;
                button.title = `${Math.max(0, access.remaining)} of ${limit} free uses left today`;
            } else {
                button.title = '';
            }
            return access;
        } catch (_) {
            return null;
        }
    }

    function openPremiumUpgrade(featureKey) {
        const api = window.EloGuardEntitlements;
        if (api && typeof api.openBilling === 'function') {
            api.openBilling('checkout', { feature: featureKey });
            return;
        }
        window.open(`https://eloguard.app/checkout?feature=${encodeURIComponent(featureKey)}`, '_blank', 'noopener');
    }

    chrome.storage.onChanged.addListener((changes) => {
        if (changes.guardActive) {
            GUARD_ACTIVE = changes.guardActive.newValue;
            if (!GUARD_ACTIVE) {
                activeLockState = null;
                clearCooldownState();
                pauseLockoutTimer();
                removeGoalChoice();
                unlockButton();
            } else {
                resetSessionPeak();
                resetGoalExtensionState();
                resumeLockoutFromStorage();
                checkRating();
            }
        }

        loadSettings();
    });

    // =====================================================================
    // --- POST-GAME ANALYSIS (Lichess export + EloGuard Game Review) ---
    // =====================================================================

    const POSTGAME_CONTAINER_CLASS = 'elo-guard-postgame-buttons';
    const POSTGAME_FLOATING_ID = 'elo-guard-postgame-floating';
    const REVIEW_PANEL_ID = 'elo-guard-review-panel';
    const REVIEW_ENGINE_FRAME_ID = 'elo-guard-engine-frame';
    const REVIEW_ENGINE_LABEL = 'Stockfish 18';
    const REVIEW_DEPTH_MIN = 6;
    const REVIEW_DEPTH_MAX = 18;
    const REVIEW_DEPTH_DEFAULT = 10;
    const REVIEW_GLYPHS = {
        brilliant: {
            sym: '!!',
            label: 'Brilliant',
            chessCom: 'brilliant',
            effect: 'brilliant',
            analysisClass: 'analysis-brilliant',
            icon: 'https://images.chesscomfiles.com/uploads/v1/images_users/tiny_mce/PedroPinhata/phpQcwe5E.png'
        },
        great: {
            sym: '!',
            label: 'Great Move',
            chessCom: 'greatFind',
            effect: 'greatfind',
            analysisClass: 'analysis-greatFind',
            icon: 'https://images.chesscomfiles.com/uploads/v1/images_users/tiny_mce/PedroPinhata/phpmDwOPG.png'
        },
        best: {
            sym: '*',
            label: 'Best Move',
            chessCom: 'bestMove',
            effect: 'bestmove',
            analysisClass: 'analysis-bestMove',
            icon: 'https://images.chesscomfiles.com/uploads/v1/images_users/tiny_mce/PedroPinhata/phpE0gpKi.png'
        },
        excellent: {
            sym: '!',
            label: 'Excellent',
            chessCom: 'excellent',
            effect: 'excellent',
            analysisClass: 'analysis-excellent',
            icon: 'https://images.chesscomfiles.com/uploads/v1/images_users/tiny_mce/PedroPinhata/php12KLQL.png'
        },
        good: {
            sym: '!',
            label: 'Good',
            chessCom: 'good',
            effect: 'good',
            analysisClass: 'analysis-good',
            icon: 'https://images.chesscomfiles.com/uploads/v1/images_users/tiny_mce/PedroPinhata/phpbFKLz5.png'
        },
        book: {
            sym: 'book',
            label: 'Book',
            chessCom: 'book',
            effect: 'book',
            analysisClass: 'analysis-book',
            icon: 'https://images.chesscomfiles.com/uploads/v1/images_users/tiny_mce/PedroPinhata/phpdFgJU0.png'
        },
        forced: {
            sym: '->',
            label: 'Forced',
            chessCom: 'forced',
            effect: 'forced',
            analysisClass: 'analysis-forced'
        },
        inaccuracy: {
            sym: '?!',
            label: 'Inaccuracy',
            chessCom: 'inaccuracy',
            effect: 'inaccuracy',
            analysisClass: 'analysis-inaccuracy',
            icon: 'https://images.chesscomfiles.com/uploads/v1/images_users/tiny_mce/PedroPinhata/phpStQeGp.png'
        },
        miss: {
            sym: 'x',
            label: 'Miss',
            chessCom: 'miss',
            effect: 'miss',
            analysisClass: 'analysis-miss',
            icon: 'https://images.chesscomfiles.com/uploads/v1/images_users/tiny_mce/PedroPinhata/phprSK0EW.png'
        },
        mistake: {
            sym: '?',
            label: 'Mistake',
            chessCom: 'mistake',
            effect: 'mistake',
            analysisClass: 'analysis-mistake',
            icon: 'https://images.chesscomfiles.com/uploads/v1/images_users/tiny_mce/PedroPinhata/phpJ6F97j.png'
        },
        blunder: {
            sym: '??',
            label: 'Blunder',
            chessCom: 'blunder',
            effect: 'blunder',
            analysisClass: 'analysis-blunder',
            icon: 'https://images.chesscomfiles.com/uploads/v1/images_users/tiny_mce/PedroPinhata/phprZy2C4.png'
        }
    };
    const REVIEW_BOARD_TOGGLE_ID = 'elo-guard-review-board-toggle';
    const REVIEW_BOARD_OVERLAY_ID = 'elo-guard-review-board-overlay';
    const REVIEW_BOARD_ANALYSIS_STORAGE_KEY = 'eloGuardReviewBoardAnalysisEnabled';
    // Common chess.com live time controls, as {base, inc} in seconds.
    const REVIEW_TC_OPTIONS = [
        { base: 60, inc: 0 }, { base: 60, inc: 1 }, { base: 120, inc: 1 },
        { base: 180, inc: 0 }, { base: 180, inc: 2 }, { base: 300, inc: 0 },
        { base: 300, inc: 2 }, { base: 300, inc: 5 },
        { base: 600, inc: 0 }, { base: 600, inc: 5 }, { base: 900, inc: 10 },
        { base: 1800, inc: 0 }, { base: 86400, inc: 0, label: 'Daily' }
    ];

    function timeControlLabel(tc) {
        if (tc.label) return tc.label;
        if (tc.base >= 86400) return 'Daily';
        if (tc.base < 60) return `${tc.base}s+${tc.inc || 0}`;
        return `${Math.round(tc.base / 60)}+${tc.inc || 0}`;
    }
    const REVIEW_CACHE = new Map(); // movesKey:depth -> { review, record, depth }
    const REVIEW_CACHE_MAX = 4;

    // Chess.com replaces the game-over modal/sidebar asynchronously. During that
    // replacement the buttons can remain clickable while the move-list nodes are
    // temporarily (or permanently) detached. Keep the most complete record seen
    // for the current page so post-game actions never depend on that volatile DOM.
    let POSTGAME_RECORD_SNAPSHOT = null;
    let POSTGAME_RECORD_LOCATION = '';

    function postGameLocationKey() {
        return `${location.pathname}${location.search}`;
    }

    function rememberPostGameRecord(record) {
        if (!record) return null;
        const key = postGameLocationKey();
        if (POSTGAME_RECORD_LOCATION !== key
            || !POSTGAME_RECORD_SNAPSHOT
            || record.sans.length >= POSTGAME_RECORD_SNAPSHOT.sans.length) {
            POSTGAME_RECORD_LOCATION = key;
            POSTGAME_RECORD_SNAPSHOT = record;
        }
        return POSTGAME_RECORD_SNAPSHOT;
    }

    function getPostGameRecord(fallback) {
        const current = extractGameRecord();
        if (current) return rememberPostGameRecord(current);
        if (fallback) return rememberPostGameRecord(fallback);
        return POSTGAME_RECORD_LOCATION === postGameLocationKey() ? POSTGAME_RECORD_SNAPSHOT : null;
    }

    let REVIEW_ENGINE_FRAME = null;
    let REVIEW_ENGINE_READY = false;
    let REVIEW_ENGINE_ERROR = null;
    let REVIEW_ENGINE_PING_TIMER = null;
    let REVIEW_JOB_COUNTER = 0;
    const REVIEW_JOBS = new Map();
    const REVIEW_EXT_ORIGIN = new URL(chrome.runtime.getURL('')).origin;
    let REVIEW_SELECTED_DEPTH = REVIEW_DEPTH_DEFAULT;
    // Each of these holds a caller-owned handle object; analyzeMovesWithEngine stamps the
    // live jobId onto it once the engine starts, so a cancel closure elsewhere can target
    // exactly that invocation without disturbing the other channel.
    let REVIEW_SINGLE_JOB = null;
    let REVIEW_BATCH_JOB = null;
    let REVIEW_LAST_RANGE_MONTHS_FAILED = 0;
    let REVIEW_BOARD_ANALYSIS_ENABLED = true;
    let REVIEW_BOARD_ANALYSIS_USER_SET = false;
    let REVIEW_BOARD_STATE = null; // { record, review, depth, ply, locationKey }
    let REVIEW_BOARD_SYNC_TIMER = null;

    try {
        chrome.storage.local.get({ [REVIEW_BOARD_ANALYSIS_STORAGE_KEY]: true }, (items) => {
            if (REVIEW_BOARD_ANALYSIS_USER_SET) return;
            REVIEW_BOARD_ANALYSIS_ENABLED = items[REVIEW_BOARD_ANALYSIS_STORAGE_KEY] !== false;
            syncReviewBoardAnalysis();
        });
    } catch (e) {
        REVIEW_BOARD_ANALYSIS_ENABLED = true;
    }

    function clampReviewDepth(value) {
        const depth = parseInt(value, 10);
        if (Number.isNaN(depth)) return REVIEW_DEPTH_DEFAULT;
        return Math.max(REVIEW_DEPTH_MIN, Math.min(REVIEW_DEPTH_MAX, depth));
    }

    function reviewCacheKey(movesKey, depth) {
        return `${movesKey}:d${clampReviewDepth(depth)}`;
    }

    function reviewPositionsToAnalyze(prepared) {
        const indexes = new Set();
        const moves = prepared?.moves || [];
        const bookPlies = prepared?.bookPlies || 0;
        const legalCounts = prepared?.legalCounts || [];
        for (let i = 0; i < moves.length; i++) {
            if (i < bookPlies || legalCounts[i] === 1) continue;
            indexes.add(i);
            if (!(prepared.terminal && i + 1 === moves.length)) indexes.add(i + 1);
        }
        // The final position (index moves.length) must be evaluated when the game has no
        // terminal result — otherwise downstream code fabricates a 0.00 eval for it. It's
        // normally queued as the i+1 of the last analyzed move, but if the last move is
        // book/forced (skipped above) that i+1 is missing, so backfill it here. Also covers
        // the zero-positions case (all moves book/forced).
        if (moves.length && !prepared.terminal && !indexes.has(moves.length)) indexes.add(moves.length);
        return [...indexes].sort((a, b) => a - b);
    }

    // --- game record extraction ---

    function sanFromMoveNode(node) {
        const target = node.querySelector('.node-highlight-content') || node;
        let out = '';
        const walk = (el) => {
            for (const child of el.childNodes) {
                if (child.nodeType === Node.TEXT_NODE) {
                    out += child.textContent;
                } else if (child.nodeType === Node.ELEMENT_NODE) {
                    const fig = child.getAttribute && child.getAttribute('data-figurine');
                    if (fig) out += fig;
                    else if (!/icon|clock|time|glyph|eval|annotation/i.test(String(child.className || ''))) walk(child);
                }
            }
        };
        walk(target);
        out = out.replace(/[\s ]+/g, '').replace(/[!?]+$/, '');
        if (!out) return '';
        if (/^(1-0|0-1|½-½|1\/2-1\/2|\*)$/.test(out)) return '';
        out = out.replace(/^0-0-0/, 'O-O-O').replace(/^0-0/, 'O-O');
        if (/^(O-O(-O)?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=?[QRBN])?)[+#]?$/.test(out)) return out;
        return null;
    }

    function getMoveListSans() {
        const containers = [
            document.querySelector('wc-simple-move-list'),
            document.querySelector('wc-vertical-move-list'),
            document.querySelector('wc-move-list'),
            ...document.querySelectorAll('[class*="move-list"], [id*="move-list"]')
        ].filter(Boolean);
        for (const container of containers) {
            // Prefer explicitly main-line nodes — archive/analysis views can add
            // engine-suggestion or header rows that aren't part of the game.
            const nodeSets = [
                container.querySelectorAll('.main-line-row .node, .node.main-line-ply'),
                container.querySelectorAll('.node')
            ];
            for (const nodes of nodeSets) {
                if (!nodes.length) continue;
                const sans = [];
                const seen = new Set();
                for (const node of nodes) {
                    if (seen.has(node)) continue;
                    node.querySelectorAll('.node').forEach((inner) => seen.add(inner));
                    if (node.closest('[class*="variation"]')) continue;
                    const san = sanFromMoveNode(node);
                    // Tolerate non-move rows; prepareGame's legality replay catches
                    // any genuine corruption this could introduce.
                    if (!san) continue;
                    sans.push(san);
                }
                if (sans.length) return sans;
            }
        }
        return null;
    }

    function getNativeReviewMoveNodes() {
        const containers = [
            document.querySelector('wc-simple-move-list'),
            document.querySelector('wc-vertical-move-list'),
            document.querySelector('wc-move-list'),
            ...document.querySelectorAll('[class*="move-list"], [id*="move-list"]')
        ].filter(Boolean);
        for (const container of containers) {
            if (container.closest?.('#' + REVIEW_PANEL_ID)) continue;
            const nodeSets = [
                container.querySelectorAll('.main-line-row .node, .node.main-line-ply'),
                container.querySelectorAll('.node')
            ];
            for (const nodes of nodeSets) {
                if (!nodes.length) continue;
                const moveNodes = [];
                const seen = new Set();
                for (const node of nodes) {
                    if (seen.has(node)) continue;
                    node.querySelectorAll('.node').forEach((inner) => seen.add(inner));
                    if (node.closest('[class*="variation"]')) continue;
                    if (!sanFromMoveNode(node)) continue;
                    moveNodes.push(node);
                }
                if (moveNodes.length) return moveNodes;
            }
        }
        return [];
    }

    function hasMoveListMoves() {
        return document.querySelectorAll(
            'wc-simple-move-list .node, wc-vertical-move-list .node, [class*="move-list"] .node'
        ).length >= 2;
    }

    function getBoardFlippedState() {
        const board = document.querySelector('wc-chess-board, chess-board, #board-single');
        return !!(board && board.classList.contains('flipped'));
    }

    function getPlayerNameFromRoot(root) {
        if (!root) return '';
        const el = root.querySelector('[data-test-element="user-tagline-username"]')
            || root.querySelector('.user-tagline-compact-username')
            || root.querySelector('[class*="user-username"]')
            || root.querySelector('[class*="username"]');
        return (el?.textContent || '').trim();
    }

    function getPlayerRatingFromRoot(root) {
        if (!root) return null;
        const el = root.querySelector('[class*="rating"]');
        let m = el ? (el.textContent || '').match(/(\d{3,4})/) : null;
        if (!m) m = (root.textContent || '').match(/\((\d{3,4})\)/);
        if (!m) return null;
        const v = +m[1];
        return v >= 100 && v <= 3500 ? v : null;
    }

    function detectReviewTimeClass() {
        const icon = document.querySelector(
            '.icon-font-chess.bullet, .icon-font-chess.blitz, .icon-font-chess.rapid, .icon-font-chess.rapid-game, .icon-font-chess.daily'
        );
        if (icon) {
            const cl = String(icon.className || '');
            if (/bullet/i.test(cl)) return 'bullet';
            if (/blitz/i.test(cl)) return 'blitz';
            if (/rapid/i.test(cl)) return 'rapid';
            if (/daily/i.test(cl)) return 'classical';
        }
        if (/bullet/i.test(GAME_MODE)) return 'bullet';
        if (/rapid/i.test(GAME_MODE)) return 'rapid';
        if (/daily|classical/i.test(GAME_MODE)) return 'classical';
        return 'blitz';
    }

    // Exact "10 min" / "3 | 2" spec from the page; null when not found.
    function detectTimeControlSpec() {
        const scopes = document.querySelectorAll(
            '[class*="time-control"], [data-cy*="time-control"], [class*="game-time"], .game-details, .header-title-component, [class*="live-game-start-time"]'
        );
        for (const scope of scopes) {
            const text = (scope.textContent || '').slice(0, 200);
            let m = text.match(/(\d{1,3})\s*\|\s*(\d{1,3})/);
            if (m) return { base: +m[1] * 60, inc: +m[2] };
            m = text.match(/(\d{1,3})\s*min\b/i);
            if (m) return { base: +m[1] * 60, inc: 0 };
            m = text.match(/(\d{1,3})\s*sec\b/i);
            if (m) return { base: +m[1], inc: 0 };
        }
        return null;
    }

    function detectTimeControl() {
        const spec = detectTimeControlSpec();
        if (spec) return spec;
        const byClass = { bullet: { base: 60, inc: 0 }, blitz: { base: 180, inc: 0 }, rapid: { base: 600, inc: 0 }, classical: { base: 86400, inc: 0 } };
        return byClass[detectReviewTimeClass()] || byClass.blitz;
    }

    function detectGameResult(prepared, userColor) {
        if (prepared.terminal === 'checkmate') {
            return prepared.moves[prepared.moves.length - 1].color === 'w' ? '1-0' : '0-1';
        }
        if (prepared.terminal === 'stalemate' || prepared.terminal === 'draw') return '1/2-1/2';
        const scopes = document.querySelectorAll('.game-over-modal-content, [class*="game-over"], .board-modal-container');
        for (const scope of scopes) {
            const text = scope.textContent || '';
            if (/\b1\s*-\s*0\b/.test(text)) return '1-0';
            if (/\b0\s*-\s*1\b/.test(text)) return '0-1';
            if (/(½\s*-\s*½|1\/2\s*-\s*1\/2|\bdraw\b|stalemate|repetition|agreement|insufficient)/i.test(text)) return '1/2-1/2';
            if (/\byou\s+won\b/i.test(text)) return userColor === 'w' ? '1-0' : '0-1';
            if (/\bwhite\s+w[oi]n/i.test(text)) return '1-0';
            if (/\bblack\s+w[oi]n/i.test(text)) return '0-1';
        }
        return '*';
    }

    // Chess.com's /review route initially renders without a move list, but the
    // server-provided analysis bootstrap still contains the complete PGN. Read
    // that inert script text so our post-game actions work while Game Review is
    // loading (and on review layouts that never mount the regular move list).
    function decodeAnalysisString(body) {
        return String(body || '').replace(/\\(?:u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|([\\'"\/bfnrtv0]))/g,
            (match, codePoint, unicode, hex, simple) => {
                if (codePoint) return String.fromCodePoint(parseInt(codePoint, 16));
                if (unicode) return String.fromCharCode(parseInt(unicode, 16));
                if (hex) return String.fromCharCode(parseInt(hex, 16));
                return ({ '\\': '\\', "'": "'", '"': '"', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v', 0: '\0' })[simple] ?? simple;
            });
    }

    function getEmbeddedAnalysisPgn() {
        for (const script of document.scripts) {
            const text = script.textContent || '';
            if (!text.includes('window.chesscom.analysis') || !text.includes('pgn:')) continue;
            const match = text.match(/\bpgn:\s*'((?:\\.|[^'\\])*)'/);
            if (match) return decodeAnalysisString(match[1]);
        }
        return null;
    }

    function parsePgnHeaders(pgn) {
        const headers = {};
        const re = /^\[([A-Za-z0-9_]+)\s+"((?:\\.|[^"])*)"\]\s*$/gm;
        let match;
        while ((match = re.exec(pgn))) {
            headers[match[1]] = match[2].replace(/\\([\\"])/g, '$1');
        }
        return headers;
    }

    function gameRecordFromPgn(pgn) {
        const parsed = parsePgnGame(pgn);
        if (!parsed || parsed.sans.length < 2) return null;
        const prepared = EloGuardReviewCore.prepareGame(parsed.sans);
        if (prepared.error) return null;

        const headers = parsePgnHeaders(pgn);
        const whiteName = headers.White || 'White';
        const blackName = headers.Black || 'Black';
        const ownName = (USERNAME || '').trim().toLowerCase();
        const bottomName = (getPlayerNameFromRoot(getBottomPlayerRoot()) || '').trim().toLowerCase();
        let userColor;
        if (ownName && whiteName.toLowerCase() === ownName) userColor = 'w';
        else if (ownName && blackName.toLowerCase() === ownName) userColor = 'b';
        else if (bottomName && whiteName.toLowerCase() === bottomName) userColor = 'w';
        else if (bottomName && blackName.toLowerCase() === bottomName) userColor = 'b';
        else userColor = getBoardFlippedState() ? 'b' : 'w';

        const record = {
            prepared,
            sans: prepared.moves.map((move) => move.san),
            userColor,
            whiteName,
            blackName,
            whiteRating: /^\d{3,4}$/.test(headers.WhiteElo || '') ? +headers.WhiteElo : null,
            blackRating: /^\d{3,4}$/.test(headers.BlackElo || '') ? +headers.BlackElo : null,
            timeControl: parseChessComTimeControl(headers.TimeControl) || detectTimeControl(),
            result: /^(1-0|0-1|1\/2-1\/2|\*)$/.test(headers.Result || '') ? headers.Result : '*'
        };
        record.movesKey = record.sans.join(' ');
        return record;
    }

    function extractEmbeddedGameRecord() {
        const pgn = getEmbeddedAnalysisPgn();
        return pgn ? gameRecordFromPgn(pgn) : null;
    }

    function extractGameRecord() {
        if (typeof EloGuardReviewCore === 'undefined' || typeof Chess === 'undefined') return null;
        const sans = getMoveListSans();
        if (!sans || sans.length < 2) return extractEmbeddedGameRecord();
        const prepared = EloGuardReviewCore.prepareGame(sans);
        if (prepared.error) {
            console.warn('🛡️ EloGuard Review: ' + prepared.error);
            return extractEmbeddedGameRecord();
        }
        const flipped = getBoardFlippedState();
        const userColor = flipped ? 'b' : 'w';
        const bottomName = getPlayerNameFromRoot(getBottomPlayerRoot()) || USERNAME || 'Me';
        const topName = getPlayerNameFromRoot(getTopOpponentRoot()) || getCurrentOpponentUsername() || 'Opponent';
        const record = {
            prepared,
            sans: prepared.moves.map((m) => m.san),
            userColor,
            whiteName: flipped ? topName : bottomName,
            blackName: flipped ? bottomName : topName,
            timeControl: detectTimeControl()
        };
        // Baselines for the "played like" view: page-displayed ratings, with the
        // user's own side falling back to their cached account rating.
        const bottomRating = getPlayerRatingFromRoot(getBottomPlayerRoot());
        const topRating = getPlayerRatingFromRoot(getTopOpponentRoot());
        record.whiteRating = flipped ? topRating : bottomRating;
        record.blackRating = flipped ? bottomRating : topRating;
        const pool = EloGuardReviewCore.timeClassOf(record.timeControl);
        const own = REVIEW_USER_RATINGS ? REVIEW_USER_RATINGS[pool] : null;
        if (typeof own === 'number') {
            if (userColor === 'w' && typeof record.whiteRating !== 'number') record.whiteRating = own;
            if (userColor === 'b' && typeof record.blackRating !== 'number') record.blackRating = own;
        }
        record.result = detectGameResult(prepared, userColor);
        record.movesKey = record.sans.join(' ');
        return record;
    }

    function buildMovetext(record) {
        const parts = [];
        for (let i = 0; i < record.sans.length; i++) {
            if (i % 2 === 0) parts.push(`${i / 2 + 1}.`);
            parts.push(record.sans[i]);
        }
        return parts.join(' ');
    }

    function buildPgn(record) {
        const now = new Date();
        const pad = (v) => String(v).padStart(2, '0');
        const headers = [
            ['Event', 'Live Chess'],
            ['Site', 'Chess.com'],
            ['Date', `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}`],
            ['White', record.whiteName],
            ['Black', record.blackName],
            ['Result', record.result]
        ];
        const tc = record.timeControl;
        if (tc && tc.base < 86400) {
            headers.push(['TimeControl', tc.inc > 0 ? `${tc.base}+${tc.inc}` : `${tc.base}`]);
        }
        return headers.map(([k, v]) => `[${k} "${String(v).replace(/["\\]/g, '')}"]`).join('\n')
            + '\n\n' + buildMovetext(record) + ' ' + record.result;
    }

    // --- lichess export ---

    async function openOnLichess(button, retainedRecord) {
        const record = getPostGameRecord(retainedRecord);
        if (!record) {
            flashButtonText(button, 'No moves found');
            return;
        }
        const pgn = buildPgn(record);
        // Fallback carries movetext only — bracketed headers don't belong in a URL path.
        const fallbackUrl = 'https://lichess.org/analysis/pgn/' + encodeURIComponent(buildMovetext(record))
            + (record.userColor === 'b' ? '?color=black' : '');
        // Open the tab synchronously so the popup blocker sees a user gesture,
        // then point it at the imported game once the import call resolves.
        const tab = window.open('about:blank', '_blank');
        const originalText = button.textContent;
        button.textContent = 'Importing…';
        button.disabled = true;
        let target = fallbackUrl;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            const resp = await fetch('https://lichess.org/api/import', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: 'pgn=' + encodeURIComponent(pgn),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (resp.ok) {
                const data = await resp.json();
                if (data && data.url) {
                    target = data.url + (record.userColor === 'b' ? '/black' : '');
                }
            }
        } catch (e) { /* fall back to the analysis-board URL */ }
        button.textContent = originalText;
        button.disabled = false;
        if (tab && !tab.closed) tab.location.href = target;
        else window.open(target, '_blank');
    }

    function flashButtonText(button, text) {
        const original = button.textContent;
        button.textContent = text;
        setTimeout(() => { button.textContent = original; }, 1800);
    }

    // --- post-game button injection ---

    function buildPostGameButtons(variant) {
        const retainedRecord = getPostGameRecord();
        const container = document.createElement('div');
        container.className = `${POSTGAME_CONTAINER_CLASS} elo-guard-postgame-${variant}`;
        const lichessBtn = document.createElement('button');
        lichessBtn.type = 'button';
        lichessBtn.className = 'elo-guard-postgame-btn elo-guard-lichess-btn';
        lichessBtn.textContent = '♞ Analyze on Lichess';
        lichessBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openOnLichess(lichessBtn, retainedRecord);
        });
        const reviewBtn = document.createElement('button');
        reviewBtn.type = 'button';
        reviewBtn.className = 'elo-guard-postgame-btn elo-guard-review-btn';
        reviewBtn.textContent = '★ Game Review';
        updateDailyLeftButton(reviewBtn, 'Game Review', PRO_FEATURE_GAME_REVIEW, retainedRecord?.movesKey);
        reviewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openReviewPanel(retainedRecord);
        });
        container.appendChild(lichessBtn);
        container.appendChild(reviewBtn);
        return container;
    }

    function isVisibleElement(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        if (!rect.width && !rect.height) return false;
        const style = getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    }

    function hasActiveGameControls() {
        const selectors = [
            '[data-cy*="resign"]',
            '[data-cy*="draw"]',
            '[data-cy*="submit"]',
            '[aria-label*="resign" i]',
            '[aria-label*="draw" i]',
            '[aria-label*="submit" i]',
            'button',
            'a',
            '[role="button"]'
        ].join(',');

        for (const el of document.querySelectorAll(selectors)) {
            if (el.classList?.contains('elo-guard-postgame-btn')) continue;
            if (el.closest('#' + REVIEW_PANEL_ID)) continue;
            if (el.closest('.' + POSTGAME_CONTAINER_CLASS)) continue;
            if (el.disabled || el.getAttribute?.('aria-disabled') === 'true') continue;
            if (!isVisibleElement(el)) continue;

            const label = [
                el.getAttribute?.('data-cy'),
                el.getAttribute?.('aria-label'),
                el.getAttribute?.('title'),
                el.textContent
            ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

            if (/\b(resign|draw|offer draw|submit move|submit)\b/i.test(label)) return true;
        }

        return false;
    }

    function isGameOverUiPresent() {
        return !!(document.querySelector('[data-cy="game-over-modal-new-game-button"]')
            || document.querySelector('[data-cy="sidebar-rematch-button"]')
            || document.querySelector('[data-cy="sidebar-game-over-rematch-button"]')
            || document.querySelector('.game-over-controls')
            || document.querySelector('.game-over-modal-content'));
    }

    function hasVisibleFinishedGameStatusText() {
        const selectors = [
            '.game-over-message-component',
            '.header-title-component',
            '[class*="game-over"]',
            '[class*="post-game"]',
            '[class*="game-result"]',
            '[class*="game-status"]',
            '[data-cy*="game-over"]',
            '[data-cy*="game-result"]',
            '[data-cy*="game-review"]'
        ].join(',');
        for (const el of document.querySelectorAll(selectors)) {
            if (el.closest('#' + REVIEW_PANEL_ID)) continue;
            const rect = el.getBoundingClientRect();
            if (!rect.width || !rect.height) continue;
            const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
            if (/\b(1\s*-\s*0|0\s*-\s*1|1\/2\s*-\s*1\/2|you won|you lost|white won|black won|game over|checkmate|resigned|abandoned|timeout|won on time|draw by|stalemate|repetition|agreement|insufficient)\b/i.test(text)) {
                return true;
            }
        }
        return false;
    }

    // Viewing a finished game from the archive. chess.com can also serve active
    // games at /game/<id>, so URL shape alone is not a finished-game signal.
    function isArchivedGamePage(nativeReviewBtn) {
        if (/\/analysis\/game\//.test(location.pathname)) return true;
        if (!/\/game\/(live\/|daily\/)?\d+/.test(location.pathname)) return false;
        return !!nativeReviewBtn || hasVisibleFinishedGameStatusText();
    }

    function isChessComGameReviewPage() {
        return /^\/analysis\/game\/(?:live|daily)\/\d+\/review\/?$/i.test(location.pathname);
    }

    // chess.com's own "Game Review" button in the archived-game sidebar — the most
    // natural place to attach our buttons. Located by label since its classes churn.
    function findNativeGameReviewAnchor() {
        for (const el of document.querySelectorAll('button, a')) {
            if (el.classList.contains('elo-guard-postgame-btn')) continue;
            if (el.closest('#' + REVIEW_PANEL_ID)) continue;
            const label = [el.textContent, el.getAttribute('aria-label'), el.getAttribute('title')]
                .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
            if (label.includes('game review')) return el;
        }
        if (isChessComGameReviewPage()) {
            for (const heading of document.querySelectorAll('h1, h2')) {
                if ((heading.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase() !== 'game review') continue;
                return heading.closest('.cc-sidebar-header-component') || heading.parentElement || heading;
            }
        }
        return null;
    }

    function ensurePostGameButtons() {
        // A native "Game Review" button is a finished-game signal in its own
        // right — chess.com's game-page URL formats keep shifting under us.
        const nativeReviewBtn = findNativeGameReviewAnchor();
        const activeGame = hasActiveGameControls();
        const reviewPage = isChessComGameReviewPage();
        const over = !activeGame
            && (isGameOverUiPresent() || isArchivedGamePage(nativeReviewBtn) || !!nativeReviewBtn)
            && (hasMoveListMoves() || reviewPage);
        const floating = document.getElementById(POSTGAME_FLOATING_ID);
        if (!over) {
            document.querySelectorAll('.' + POSTGAME_CONTAINER_CLASS).forEach((el) => el.remove());
            return;
        }

        const modal = document.querySelector('.game-over-modal-content');
        if (modal && !modal.querySelector('.' + POSTGAME_CONTAINER_CLASS)) {
            modal.appendChild(buildPostGameButtons('modal'));
        }

        const sidebarBtn = document.querySelector('[data-cy="sidebar-rematch-button"], [data-cy="sidebar-game-over-rematch-button"]');
        const sidebarAnchor = sidebarBtn?.closest('.game-over-modal-content') ? null : sidebarBtn?.parentElement;
        if (sidebarAnchor && !sidebarAnchor.querySelector('.' + POSTGAME_CONTAINER_CLASS)) {
            sidebarAnchor.appendChild(buildPostGameButtons('sidebar'));
        }

        const hasAnchored = !!document.querySelector('.' + POSTGAME_CONTAINER_CLASS + ':not(#' + POSTGAME_FLOATING_ID + ')');
        if (nativeReviewBtn && !hasAnchored) {
            nativeReviewBtn.insertAdjacentElement('afterend', buildPostGameButtons('archive'));
        }

        // Guarantee visibility: if neither anchored copy is actually rendered, float one.
        const anyVisible = [...document.querySelectorAll('.' + POSTGAME_CONTAINER_CLASS)]
            .some((el) => el.id !== POSTGAME_FLOATING_ID && el.offsetParent !== null);
        if (!anyVisible) {
            if (!floating) {
                const float = buildPostGameButtons('floating');
                float.id = POSTGAME_FLOATING_ID;
                document.body.appendChild(float);
            }
        } else if (floating) {
            floating.remove();
        }
    }

    // --- engine iframe client ---

    // True once this content script has been orphaned by an extension reload/update:
    // chrome.runtime.id goes undefined and every chrome.* call throws
    // "Extension context invalidated". Only a page reload recovers it.
    function isExtensionContextInvalidated(e) {
        if (e && typeof e.message === 'string' && /Extension context invalidated/i.test(e.message)) {
            return true;
        }
        try {
            return !chrome.runtime || !chrome.runtime.id;
        } catch (_) {
            return true;
        }
    }

    function ensureEngineFrame() {
        if (REVIEW_ENGINE_FRAME && REVIEW_ENGINE_FRAME.isConnected) return;
        REVIEW_ENGINE_READY = false;
        REVIEW_ENGINE_ERROR = null;
        const frame = document.createElement('iframe');
        frame.id = REVIEW_ENGINE_FRAME_ID;
        frame.src = chrome.runtime.getURL('engine/engine.html');
        frame.setAttribute('aria-hidden', 'true');
        // Stockfish runs on this iframe's main thread. A literal display:none
        // iframe can be timer/CPU throttled by Chromium mid-analysis, which makes
        // depth searches appear to "randomly" freeze. Keep it visually invisible
        // but layout-alive so the browser schedules the engine consistently.
        frame.style.cssText = [
            'display:block !important',
            'position:fixed !important',
            'left:0 !important',
            'top:0 !important',
            'width:1px !important',
            'height:1px !important',
            'border:0 !important',
            'opacity:0 !important',
            'pointer-events:none !important',
            'z-index:-1 !important'
        ].join(';');
        (document.body || document.documentElement).appendChild(frame);
        REVIEW_ENGINE_FRAME = frame;
        if (REVIEW_ENGINE_PING_TIMER) clearInterval(REVIEW_ENGINE_PING_TIMER);
        REVIEW_ENGINE_PING_TIMER = setInterval(() => {
            if (REVIEW_ENGINE_READY || REVIEW_ENGINE_ERROR || !REVIEW_ENGINE_FRAME?.isConnected) {
                clearInterval(REVIEW_ENGINE_PING_TIMER);
                REVIEW_ENGINE_PING_TIMER = null;
                return;
            }
            try {
                REVIEW_ENGINE_FRAME.contentWindow?.postMessage({ type: 'eg-ping' }, REVIEW_EXT_ORIGIN);
            } catch (e) { /* frame not ready yet */ }
        }, 400);
    }

    window.addEventListener('message', (event) => {
        if (event.origin !== REVIEW_EXT_ORIGIN) return;
        const msg = event.data;
        if (!msg || typeof msg.type !== 'string') return;
        if (msg.type === 'eg-ready') REVIEW_ENGINE_READY = true;
        if (msg.type === 'eg-engine-error' && !msg.jobId) REVIEW_ENGINE_ERROR = msg.error || 'Engine failed';
        if (!msg.jobId) return;
        const job = REVIEW_JOBS.get(msg.jobId);
        if (!job) return;
        if (msg.type === 'eg-progress') {
            job.onProgress && job.onProgress(msg.done, msg.total);
        } else if (msg.type === 'eg-result') {
            REVIEW_JOBS.delete(msg.jobId);
            job.resolve(msg.positions);
        } else if (msg.type === 'eg-engine-error') {
            REVIEW_JOBS.delete(msg.jobId);
            job.reject(new Error(msg.error || 'Engine failed'));
        }
    });

    function waitForEngineReady(timeoutMs = 30000) {
        ensureEngineFrame();
        return new Promise((resolve, reject) => {
            const startedAt = Date.now();
            const tick = () => {
                if (REVIEW_ENGINE_READY) return resolve();
                if (REVIEW_ENGINE_ERROR) return reject(new Error(REVIEW_ENGINE_ERROR));
                if (Date.now() - startedAt > timeoutMs) return reject(new Error('Engine took too long to start'));
                setTimeout(tick, 120);
            };
            tick();
        });
    }

    // `handle` (optional) is a caller-owned object; we stamp the freshly minted jobId onto
    // it so the caller's cancel UI can target THIS invocation specifically. Single-game
    // review and batch analysis each pass their own handle, so cancelling one never touches
    // the other's job.
    function analyzeMovesWithEngine(moves, depth, skipLast, onProgress, positionIndexes, handle) {
        return waitForEngineReady().then(() => new Promise((resolve, reject) => {
            const jobId = 'egjob' + (++REVIEW_JOB_COUNTER);
            if (handle) handle.jobId = jobId;
            REVIEW_JOBS.set(jobId, { resolve, reject, onProgress });
            REVIEW_ENGINE_FRAME.contentWindow.postMessage(
                { type: 'eg-analyze', jobId, moves, depth, skipLast, positionIndexes },
                REVIEW_EXT_ORIGIN
            );
        }));
    }

    // Cancel one specific job (by id). Rejecting its promise with 'cancelled' routes through
    // each caller's existing cancelled-handling path.
    function cancelReviewJob(jobId) {
        if (!jobId) return;
        const job = REVIEW_JOBS.get(jobId);
        try {
            REVIEW_ENGINE_FRAME?.contentWindow?.postMessage(
                { type: 'eg-cancel', jobId },
                REVIEW_EXT_ORIGIN
            );
        } catch (e) { /* frame already gone */ }
        REVIEW_JOBS.delete(jobId);
        if (job) job.reject(new Error('cancelled'));
    }

    // Cancel every review job (single + batch). Used when tearing the panel down.
    function cancelAllReviewJobs() {
        cancelReviewJob(REVIEW_SINGLE_JOB?.jobId);
        REVIEW_SINGLE_JOB = null;
        cancelReviewJob(REVIEW_BATCH_JOB?.jobId);
        REVIEW_BATCH_JOB = null;
    }

    // The wasm engine holds a sizeable heap — release it when the panel closes.
    function teardownEngineFrame() {
        if (REVIEW_ENGINE_PING_TIMER) {
            clearInterval(REVIEW_ENGINE_PING_TIMER);
            REVIEW_ENGINE_PING_TIMER = null;
        }
        REVIEW_ENGINE_FRAME?.remove();
        REVIEW_ENGINE_FRAME = null;
        REVIEW_ENGINE_READY = false;
        REVIEW_ENGINE_ERROR = null;
    }

    // --- review history (fuels the Strength Profile) ---

    const REVIEW_HISTORY_KEY = 'eloGuardReviewHistory';
    const REVIEW_HISTORY_MAX = 300;
    const REVIEW_PROFILE_LOAD_TIMEOUT_MS = 5000;
    const REVIEW_PROFILE_RATINGS_TIMEOUT_MS = 4500;

    function reviewHistoryHash(movesKey) {
        let h = 5381;
        for (let i = 0; i < movesKey.length; i++) h = ((h << 5) + h + movesKey.charCodeAt(i)) | 0;
        return 'g' + (h >>> 0).toString(36);
    }

    // Persist the user's side of a completed review. Only games the user played
    // (when we can tell) — reviewing other people's games shouldn't pollute the
    // profile. `gameTs` (ms) lets batch imports keep the game's real date.
    function saveReviewToHistory(record, review, gameTs) {
        const userName = record.userColor === 'w' ? record.whiteName : record.blackName;
        if (USERNAME && userName && !identityMatchesCurrentUser(userName)) return;
        const p = review.players[record.userColor];
        if (!p || p.accuracy === null || p.scoredCount < 6) return;
        const entry = {
            v: 2,
            ts: gameTs || Date.now(),
            key: reviewHistoryHash(record.movesKey),
            timeControl: review.timeControl,
            color: record.userColor,
            opponent: record.userColor === 'w' ? record.blackName : record.whiteName,
            plies: record.sans.length,
            stats: {
                accuracy: p.accuracy,
                acpl: p.acpl,
                scoredCount: p.scoredCount,
                complexity: p.complexity,
                bookMoves: p.bookMoves,
                blunderRate: p.blunderRate,
                fastRate: typeof p.fastRate === 'number' ? p.fastRate : null,
                scramble: typeof p.scramble === 'number' ? p.scramble : null,
                analysisDepth: typeof p.analysisDepth === 'number' ? p.analysisDepth : null
            },
            phases: p.phases || null
        };
        try {
            chrome.storage.local.get([REVIEW_HISTORY_KEY], (data) => {
                try {
                    if (chrome.runtime.lastError) return;
                    data = data || {};
                    let list = Array.isArray(data[REVIEW_HISTORY_KEY]) ? data[REVIEW_HISTORY_KEY] : [];
                    list = list.filter((e) => e && e.key !== entry.key);
                    list.push(entry);
                    if (list.length > REVIEW_HISTORY_MAX) list = list.slice(list.length - REVIEW_HISTORY_MAX);
                    chrome.storage.local.set({ [REVIEW_HISTORY_KEY]: list });
                } catch (e) {
                    console.warn('EloGuard Review: could not save profile history', e);
                }
            });
        } catch (e) {
            console.warn('EloGuard Review: could not save profile history', e);
        }
    }

    // --- batch analysis (My Stats: analyze last X games or a period) ---

    const REVIEW_BATCH_RANGES = [
        { key: 'all', label: 'All reviewed' },
        { key: 'last10', label: 'Last 10 games', count: 10 },
        { key: 'last25', label: 'Last 25 games', count: 25 },
        { key: 'last50', label: 'Last 50 games', count: 50 },
        { key: '7d', label: 'Last week', days: 7 },
        { key: '14d', label: 'Last 2 weeks', days: 14 },
        { key: '30d', label: 'Last month', days: 30 },
        { key: '90d', label: 'Last 3 months', days: 90 }
    ];
    const REVIEW_BATCH_MAX_GAMES = 50;
    const REVIEW_BATCH_DEPTH = 12;
    let REVIEW_PROFILE_RANGE = 'all';
    let REVIEW_BATCH_ACTIVE = false;
    let REVIEW_BATCH_CANCEL = false;

    function getBatchRange(key) {
        return REVIEW_BATCH_RANGES.find((r) => r.key === key) || REVIEW_BATCH_RANGES[0];
    }

    function parseChessComTimeControl(str) {
        if (!str || String(str).includes('/')) return null; // daily
        const m = String(str).match(/^(\d+)(?:\+(\d+))?$/);
        return m ? { base: +m[1], inc: +(m[2] || 0) } : null;
    }

    // PGN movetext -> { sans, clocks } (remaining clock after each move, when
    // the PGN carries [%clk] comments — chess.com's do).
    function parsePgnGame(pgn) {
        const idx = pgn.indexOf('\n\n');
        const text = (idx > -1 ? pgn.slice(idx + 2) : pgn).replace(/\$\d+/g, ' ');
        const sans = [];
        const clocks = [];
        const re = /\{([^}]*)\}|(\S+)/g;
        let m;
        while ((m = re.exec(text))) {
            if (m[1] !== undefined) {
                const cm = m[1].match(/\[%clk\s+([^\]\s]+)/);
                if (cm && sans.length && clocks.length < sans.length) {
                    const parts = cm[1].split(':').map(parseFloat);
                    let sec = 0;
                    for (const p of parts) sec = sec * 60 + p;
                    while (clocks.length < sans.length - 1) clocks.push(null);
                    clocks.push(Number.isNaN(sec) ? null : sec);
                }
                continue;
            }
            const tok = m[2];
            if (!tok || /^\d+\.+$/.test(tok) || /^(1-0|0-1|1\/2-1\/2|\*)$/.test(tok)) continue;
            const clean = tok.replace(/^\d+\.+/, '').replace(/[!?]+$/, '');
            if (!clean) continue;
            if (!/^(O-O(-O)?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?)[+#]?$/.test(clean)) return null;
            sans.push(clean);
        }
        while (clocks.length < sans.length) clocks.push(null);
        return sans.length ? { sans, clocks } : null;
    }

    // Time-management features for one side (mirrors the calibration pipeline).
    function clockFeaturesForSide(sans, clocks, tc, bookPlies, color) {
        const threshold = Math.max(0.8, tc.base * 0.015);
        const offset = color === 'w' ? 0 : 1;
        let prev = tc.base;
        let considered = 0, fast = 0, scramble = 0;
        for (let i = offset; i < sans.length; i += 2) {
            const clk = clocks[i];
            if (clk === null || clk === undefined) { prev = null; continue; }
            if (prev !== null && i >= bookPlies) {
                considered++;
                if (prev - clk + tc.inc <= threshold) fast++;
                if (clk < tc.base * 0.12) scramble++;
            }
            prev = clk;
        }
        return considered >= 8
            ? { fastRate: fast / considered, scramble: scramble / considered }
            : { fastRate: null, scramble: null };
    }

    function filterEntriesForRange(entries, rangeKey, nowTs) {
        const range = getBatchRange(rangeKey);
        let list = entries.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
        if (range.days) list = list.filter((e) => (e.ts || 0) >= nowTs - range.days * 86400000);
        else if (range.count) list = list.slice(0, range.count);
        return list;
    }

    async function fetchUserGamesForRange(rangeKey) {
        if (!USERNAME) throw new Error('Set your chess.com username in the EloGuard popup first.');
        const range = getBatchRange(rangeKey);
        const cutoff = range.days ? Date.now() - range.days * 86400000 : 0;
        const target = Math.min(range.count || REVIEW_BATCH_MAX_GAMES, REVIEW_BATCH_MAX_GAMES);
        const uname = USERNAME.toLowerCase();
        const archResp = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(uname)}/games/archives`);
        if (!archResp.ok) throw new Error('Could not fetch your archives (HTTP ' + archResp.status + ')');
        const months = (await archResp.json()).archives || [];
        const games = [];
        REVIEW_LAST_RANGE_MONTHS_FAILED = 0;
        for (let mi = months.length - 1; mi >= 0 && games.length < target; mi--) {
            let resp;
            try {
                resp = await fetch(months[mi]);
            } catch (e) {
                REVIEW_LAST_RANGE_MONTHS_FAILED++;
                continue;
            }
            if (!resp.ok) { REVIEW_LAST_RANGE_MONTHS_FAILED++; continue; }
            const month = (await resp.json()).games || [];
            if (cutoff && month.length && (month[month.length - 1].end_time || 0) * 1000 < cutoff) break;
            for (let gi = month.length - 1; gi >= 0 && games.length < target; gi--) {
                const g = month[gi];
                const endMs = (g.end_time || 0) * 1000;
                if (cutoff && endMs < cutoff) continue;
                if (g.rules !== 'chess' || !g.rated || !g.pgn) continue;
                if (!['bullet', 'blitz', 'rapid'].includes(g.time_class)) continue;
                const tc = parseChessComTimeControl(g.time_control);
                if (!tc) continue;
                const wName = g.white?.username || '', bName = g.black?.username || '';
                let userColor = null;
                if (wName.toLowerCase() === uname) userColor = 'w';
                else if (bName.toLowerCase() === uname) userColor = 'b';
                else continue;
                const parsed = parsePgnGame(g.pgn);
                if (!parsed || parsed.sans.length < 20 || parsed.sans.length > 160) continue;
                games.push({
                    sans: parsed.sans, clocks: parsed.clocks, timeControl: tc,
                    userColor, whiteName: wName, blackName: bName, endTimeMs: endMs
                });
            }
            if (!cutoff && !range.count) break; // 'all' range: don't crawl history
        }
        return games;
    }

    function getReviewHistory() {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.local.get([REVIEW_HISTORY_KEY], (data) => {
                    try {
                        const err = chrome.runtime.lastError;
                        if (err) {
                            reject(new Error(err.message || 'Could not load review history'));
                            return;
                        }
                        data = data || {};
                        resolve(Array.isArray(data[REVIEW_HISTORY_KEY]) ? data[REVIEW_HISTORY_KEY] : []);
                    } catch (e) {
                        reject(e);
                    }
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    function withReviewTimeout(promise, timeoutMs, message) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
            Promise.resolve(promise).then((value) => {
                clearTimeout(timer);
                resolve(value);
            }, (error) => {
                clearTimeout(timer);
                reject(error);
            });
        });
    }

    async function loadReviewHistoryWithTimeout() {
        return withReviewTimeout(
            getReviewHistory(),
            REVIEW_PROFILE_LOAD_TIMEOUT_MS,
            'Review history took too long to load'
        );
    }

    async function loadUserRatingsForProfile() {
        return withReviewTimeout(
            fetchUserRatings(),
            REVIEW_PROFILE_RATINGS_TIMEOUT_MS,
            'Rating lookup took too long'
        ).catch(() => null);
    }

    // The user's current pool ratings — the Bayesian baseline for the anchored
    // strength view. Cached for 10 minutes.
    let REVIEW_USER_RATINGS = null;

    async function fetchUserRatings() {
        if (!USERNAME) return null;
        if (REVIEW_USER_RATINGS && Date.now() - REVIEW_USER_RATINGS.fetchedAt < 600000) return REVIEW_USER_RATINGS;
        try {
            const resp = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(USERNAME.toLowerCase())}/stats`);
            if (!resp.ok) return null;
            const data = await resp.json();
            REVIEW_USER_RATINGS = {
                bullet: data.chess_bullet?.last?.rating ?? null,
                blitz: data.chess_blitz?.last?.rating ?? null,
                rapid: data.chess_rapid?.last?.rating ?? null,
                classical: data.chess_rapid?.last?.rating ?? null,
                fetchedAt: Date.now()
            };
            return REVIEW_USER_RATINGS;
        } catch (e) {
            return null;
        }
    }

    async function startBatchAnalysis(rangeKey) {
        if (REVIEW_BATCH_ACTIVE) return;
        // The engine runs one job at a time; if a single-game review is mid-flight, cancel it
        // cleanly through its own path rather than letting the two clobber a shared handle.
        cancelReviewJob(REVIEW_SINGLE_JOB?.jobId);
        REVIEW_SINGLE_JOB = null;
        REVIEW_BATCH_ACTIVE = true;
        REVIEW_BATCH_CANCEL = false;
        const setStatus = (text) => {
            const el = getReviewBody()?.querySelector('.egr-batch-status');
            if (el) el.textContent = text;
        };
        const setProgress = (frac) => {
            const fill = getReviewBody()?.querySelector('.egr-batch-progress-fill');
            if (!fill) return;
            fill.parentElement.style.display = 'block';
            fill.style.width = `${Math.min(100, Math.round(frac * 100))}%`;
        };
        try {
            setStatus('Fetching your games from chess.com…');
            const games = await fetchUserGamesForRange(rangeKey);
            const monthsFailed = REVIEW_LAST_RANGE_MONTHS_FAILED;
            const monthsFailedSuffix = monthsFailed > 0
                ? ` (${monthsFailed} month${monthsFailed === 1 ? '' : 's'} failed to load)`
                : '';
            const existing = new Set((await getReviewHistory()).map((e) => e.key));
            const todo = [];
            for (const g of games) {
                const prepared = EloGuardReviewCore.prepareGame(g.sans);
                if (prepared.error) continue;
                const movesKey = prepared.moves.map((m) => m.san).join(' ');
                if (existing.has(reviewHistoryHash(movesKey))) continue;
                todo.push({ ...g, prepared, movesKey });
            }
            if (!todo.length) {
                setStatus((games.length
                    ? `All ${games.length} games in this range are already reviewed.`
                    : 'No games found in this range.') + monthsFailedSuffix);
            } else {
                let done = 0, failed = 0;
                const t0 = Date.now();
                for (const g of todo) {
                    if (REVIEW_BATCH_CANCEL) break;
                    try {
                        const batchHandle = {};
                        REVIEW_BATCH_JOB = batchHandle;
                        const positions = await analyzeMovesWithEngine(
                            g.prepared.moves.map((m) => m.uci), REVIEW_BATCH_DEPTH, !!g.prepared.terminal,
                            (p, total) => {
                                const perGame = done > 0 ? (Date.now() - t0) / 1000 / done : null;
                                const eta = perGame ? ` · about ${Math.max(1, Math.ceil(perGame * (todo.length - done) / 60))} min left` : '';
                                setStatus(`Reviewing game ${done + 1} of ${todo.length}${eta}`);
                                setProgress((done + p / total) / todo.length);
                            },
                            reviewPositionsToAnalyze(g.prepared),
                            batchHandle
                        );
                        REVIEW_BATCH_JOB = null;
                        const review = EloGuardReviewCore.buildReview(g.prepared, positions,
                            { timeControl: g.timeControl, depth: REVIEW_BATCH_DEPTH });
                        const clk = clockFeaturesForSide(g.sans, g.clocks, g.timeControl, g.prepared.bookPlies, g.userColor);
                        review.players[g.userColor].fastRate = clk.fastRate;
                        review.players[g.userColor].scramble = clk.scramble;
                        const record = {
                            prepared: g.prepared,
                            sans: g.prepared.moves.map((m) => m.san),
                            userColor: g.userColor,
                            whiteName: g.whiteName,
                            blackName: g.blackName,
                            timeControl: g.timeControl,
                            movesKey: g.movesKey
                        };
                        saveReviewToHistory(record, review, g.endTimeMs);
                        done++;
                    } catch (e) {
                        if (e && e.message === 'cancelled') break;
                        failed++;
                    }
                }
                setStatus(`Reviewed ${done} game${done === 1 ? '' : 's'}${failed ? ` (${failed} failed)` : ''}${REVIEW_BATCH_CANCEL ? ' — cancelled' : ''}.${monthsFailedSuffix}`);
            }
        } catch (e) {
            setStatus('Batch failed: ' + (e?.message || 'unknown error'));
        }
        REVIEW_BATCH_ACTIVE = false;
        REVIEW_BATCH_CANCEL = false;
        REVIEW_BATCH_JOB = null;
        const list = await getReviewHistory().catch(() => []);
        if (getReviewPanel()) renderReviewProfile(list);
    }

    // --- review panel UI ---

    // Board pieces: chess.com's own CDN sprites when reachable, Unicode otherwise.
    const REVIEW_PIECE_URL = 'https://www.chess.com/chess-themes/pieces/neo/150/';
    const REVIEW_UNICODE_PIECES = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
    let REVIEW_PIECE_MODE = 'text'; // upgraded to 'img' once a sprite loads
    let REVIEW_NAV = null; // { record, review, ply } while results are on screen
    let REVIEW_PROFILE_LOAD_ID = 0;

    function probePieceImages() {
        if (REVIEW_PIECE_MODE === 'img') return;
        const img = new Image();
        img.onload = () => {
            REVIEW_PIECE_MODE = 'img';
            if (REVIEW_NAV) renderReviewBoardPosition();
        };
        img.src = REVIEW_PIECE_URL + 'wn.png';
    }

    function getReviewGlyph(cls) {
        return REVIEW_GLYPHS[cls] || REVIEW_GLYPHS.good;
    }

    function reviewGlyphClassName(cls, extraClass = '') {
        const glyph = getReviewGlyph(cls);
        return [
            'egr-glyph',
            'egr-native-glyph',
            glyph.icon ? 'egr-native-glyph-img-wrap' : 'egr-native-glyph-fallback',
            `egr-glyph-${cls}`,
            glyph.analysisClass,
            extraClass
        ].filter(Boolean).join(' ');
    }

    function reviewGlyphHtml(cls, extraClass = '') {
        const glyph = getReviewGlyph(cls);
        const classes = reviewGlyphClassName(cls, extraClass);
        const attrs = `class="${classes}" title="${escapeHtml(glyph.label)}" data-classification="${escapeHtml(glyph.chessCom || cls)}"`;
        if (glyph.icon) {
            return `<span ${attrs}><img class="egr-native-glyph-img" alt="" draggable="false" src="${escapeHtml(glyph.icon)}"></span>`;
        }
        return `<span ${attrs}><span class="egr-native-glyph-text">${escapeHtml(glyph.sym)}</span></span>`;
    }

    function createReviewGlyphElement(cls, extraClass = '') {
        const glyph = getReviewGlyph(cls);
        const el = document.createElement('span');
        el.className = reviewGlyphClassName(cls, extraClass);
        el.title = glyph.label;
        el.dataset.classification = glyph.chessCom || cls;
        if (glyph.icon) {
            const img = document.createElement('img');
            img.className = 'egr-native-glyph-img';
            img.alt = '';
            img.draggable = false;
            img.src = glyph.icon;
            el.appendChild(img);
        } else {
            const text = document.createElement('span');
            text.className = 'egr-native-glyph-text';
            text.textContent = glyph.sym;
            el.appendChild(text);
        }
        return el;
    }

    function setReviewBoardAnalysisState(record, review, depth, ply = 0) {
        REVIEW_BOARD_STATE = {
            record,
            review,
            depth,
            ply: clampReviewPlyFor(record, ply),
            syncedNativePly: null,
            locationKey: getReviewBoardLocationKey()
        };
        ensureReviewBoardAnalysisToggle();
        startReviewBoardAnalysisSync();
        syncReviewBoardAnalysis();
    }

    function updateReviewBoardAnalysisPly(ply) {
        if (!REVIEW_BOARD_STATE || !REVIEW_NAV) return;
        if (REVIEW_BOARD_STATE.record.movesKey !== REVIEW_NAV.record.movesKey) return;
        REVIEW_BOARD_STATE.ply = clampReviewPlyFor(REVIEW_NAV.record, ply);
        syncChessComBoardToReviewPly(REVIEW_BOARD_STATE.ply);
        syncReviewBoardAnalysis();
    }

    function syncChessComBoardToReviewPly(ply) {
        if (!REVIEW_BOARD_ANALYSIS_ENABLED || !REVIEW_BOARD_STATE || ply <= 0) return;
        if (REVIEW_BOARD_STATE.syncedNativePly === ply) return;
        const node = getNativeReviewMoveNodes()[ply - 1];
        if (!node) return;
        REVIEW_BOARD_STATE.syncedNativePly = ply;
        try {
            node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
            node.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
            node.click();
        } catch (e) {
            // Board glyphs still render if the native move list refuses the click.
        }
    }

    function clearReviewBoardAnalysisState() {
        REVIEW_BOARD_STATE = null;
        stopReviewBoardAnalysisSync();
        document.getElementById(REVIEW_BOARD_OVERLAY_ID)?.remove();
        document.getElementById(REVIEW_BOARD_TOGGLE_ID)?.remove();
    }

    function clampReviewPlyFor(record, ply) {
        const max = Math.max(0, (record?.prepared?.fens?.length || 1) - 1);
        return Math.max(0, Math.min(max, Number.isFinite(ply) ? ply : max));
    }

    function startReviewBoardAnalysisSync() {
        if (REVIEW_BOARD_SYNC_TIMER) return;
        REVIEW_BOARD_SYNC_TIMER = setInterval(syncReviewBoardAnalysis, 350);
        window.addEventListener('resize', syncReviewBoardAnalysis, { passive: true });
        window.addEventListener('scroll', syncReviewBoardAnalysis, { passive: true });
    }

    function stopReviewBoardAnalysisSync() {
        if (REVIEW_BOARD_SYNC_TIMER) {
            clearInterval(REVIEW_BOARD_SYNC_TIMER);
            REVIEW_BOARD_SYNC_TIMER = null;
        }
        window.removeEventListener('resize', syncReviewBoardAnalysis);
        window.removeEventListener('scroll', syncReviewBoardAnalysis);
    }

    function ensureReviewBoardAnalysisToggle() {
        if (!document.body || !REVIEW_BOARD_STATE) return null;
        let button = document.getElementById(REVIEW_BOARD_TOGGLE_ID);
        if (!button) {
            button = document.createElement('button');
            button.id = REVIEW_BOARD_TOGGLE_ID;
            button.type = 'button';
            button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                REVIEW_BOARD_ANALYSIS_USER_SET = true;
                REVIEW_BOARD_ANALYSIS_ENABLED = !REVIEW_BOARD_ANALYSIS_ENABLED;
                try {
                    chrome.storage.local.set({ [REVIEW_BOARD_ANALYSIS_STORAGE_KEY]: REVIEW_BOARD_ANALYSIS_ENABLED });
                } catch (e) {
                    // The current page state still updates if storage is unavailable.
                }
                if (REVIEW_BOARD_ANALYSIS_ENABLED && REVIEW_BOARD_STATE) {
                    REVIEW_BOARD_STATE.syncedNativePly = null;
                    syncChessComBoardToReviewPly(REVIEW_BOARD_STATE.ply);
                }
                syncReviewBoardAnalysis();
            });
            document.body.appendChild(button);
        }
        button.textContent = REVIEW_BOARD_ANALYSIS_ENABLED ? 'Analysis on' : 'Analysis off';
        button.title = REVIEW_BOARD_ANALYSIS_ENABLED ? 'Hide EloGuard analysis on the chess.com board' : 'Show EloGuard analysis on the chess.com board';
        button.setAttribute('aria-pressed', REVIEW_BOARD_ANALYSIS_ENABLED ? 'true' : 'false');
        return button;
    }

    function ensureReviewBoardOverlay() {
        if (!document.body) return null;
        let overlay = document.getElementById(REVIEW_BOARD_OVERLAY_ID);
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = REVIEW_BOARD_OVERLAY_ID;
            overlay.setAttribute('aria-hidden', 'true');
            document.body.appendChild(overlay);
        }
        return overlay;
    }

    function syncReviewBoardAnalysis() {
        if (!REVIEW_BOARD_STATE) return;
        if (REVIEW_BOARD_STATE.locationKey !== getReviewBoardLocationKey()) {
            clearReviewBoardAnalysisState();
            return;
        }

        const button = ensureReviewBoardAnalysisToggle();
        const board = findReviewBoardElement();
        const overlay = ensureReviewBoardOverlay();
        if (!overlay) return;

        if (!board) {
            overlay.hidden = true;
            if (button) button.hidden = true;
            return;
        }

        positionReviewBoardToggle(button, board);

        const mv = REVIEW_BOARD_STATE.ply > 0
            ? REVIEW_BOARD_STATE.review.moves[REVIEW_BOARD_STATE.ply - 1]
            : null;
        if (!REVIEW_BOARD_ANALYSIS_ENABLED || !mv) {
            overlay.hidden = true;
            return;
        }

        const boardRect = board.getBoundingClientRect();
        if (boardRect.width < 120 || boardRect.height < 120) {
            overlay.hidden = true;
            return;
        }

        const toSq = mv.to || mv.uci?.slice(2, 4);
        if (!toSq) {
            overlay.hidden = true;
            return;
        }

        overlay.hidden = false;
        overlay.style.left = `${boardRect.left}px`;
        overlay.style.top = `${boardRect.top}px`;
        overlay.style.width = `${boardRect.width}px`;
        overlay.style.height = `${boardRect.height}px`;
        overlay.innerHTML = '';

        const toMarker = createReviewBoardSquareMarker(toSq, 'to', board, mv.cls);
        toMarker.appendChild(createReviewGlyphElement(mv.cls, 'egr-live-glyph'));
        overlay.appendChild(toMarker);
    }

    function findReviewBoardElement() {
        return findEnhancedFocusBoardElement();
    }

    function getReviewBoardLocationKey() {
        return `${location.origin}${location.pathname}`;
    }

    function positionReviewBoardToggle(button, board) {
        if (!button) return;
        const rect = board.getBoundingClientRect();
        if (rect.width < 120 || rect.height < 120) {
            button.hidden = true;
            return;
        }

        button.hidden = false;
        const buttonWidth = button.offsetWidth || 116;
        const left = Math.max(12, Math.min(window.innerWidth - buttonWidth - 12, rect.right - buttonWidth));
        const aboveTop = rect.top - 42;
        const top = aboveTop >= 12 ? aboveTop : Math.min(window.innerHeight - 44, rect.top + 8);
        button.style.left = `${left}px`;
        button.style.top = `${Math.max(12, top)}px`;
    }

    function createReviewBoardSquareMarker(square, role, board, cls = '') {
        const marker = document.createElement('div');
        marker.className = [
            'egr-live-square',
            `egr-live-square-${role}`,
            cls ? `egr-live-square-${cls}` : ''
        ].filter(Boolean).join(' ');
        const pos = getReviewBoardSquarePosition(square, board);
        marker.style.left = `${pos.col * 12.5}%`;
        marker.style.top = `${pos.row * 12.5}%`;
        marker.style.width = '12.5%';
        marker.style.height = '12.5%';
        marker.dataset.square = square;
        return marker;
    }

    function getReviewBoardSquarePosition(square, board) {
        const file = 'abcdefgh'.indexOf(String(square || '')[0]);
        const rank = Number(String(square || '')[1]);
        const safeFile = file >= 0 ? file : 0;
        const safeRank = rank >= 1 && rank <= 8 ? rank : 1;
        const flipped = isReviewBoardFlipped(board);
        return flipped
            ? { col: 7 - safeFile, row: safeRank - 1 }
            : { col: safeFile, row: 8 - safeRank };
    }

    function isReviewBoardFlipped(board) {
        const candidates = [
            board,
            board?.parentElement,
            board?.closest?.('wc-chess-board, chess-board, cg-board, [class*="chess-board"], [class*="board-layout-chessboard"], [class*="board-layout-board"]')
        ].filter(Boolean);
        for (const candidate of candidates) {
            const orientation = getBoardOrientationState(candidate);
            if (orientation) return orientation === 'black';
        }
        return getBoardFlippedState() || Boolean(ENHANCED_FOCUS_MODE && ENHANCED_FOCUS_VISUAL_FLIPPED);
    }

    // FEN piece-placement field -> 8x8 grid, [0][0] = a8.
    function fenToGrid(fen) {
        const grid = [];
        for (const row of fen.split(' ')[0].split('/')) {
            const cells = [];
            for (const ch of row) {
                if (/\d/.test(ch)) for (let i = 0; i < +ch; i++) cells.push(null);
                else cells.push(ch);
            }
            grid.push(cells);
        }
        return grid;
    }

    // The board lives in a fixed bar between the header and the scrolling body,
    // so it never overlaps or steals space from the results while scrolling.
    function setReviewBoardBar(active) {
        const panel = getReviewPanel();
        if (!panel) return null;
        panel.querySelector('.egr-boardbar')?.remove();
        if (!active) return null;
        const bar = document.createElement('div');
        bar.className = 'egr-boardbar';
        bar.innerHTML = `
            <div class="egr-board"></div>
            <div class="egr-nav">
                <button type="button" class="egr-nav-btn" data-nav="first" title="Start (Home)">⏮</button>
                <button type="button" class="egr-nav-btn" data-nav="prev" title="Previous (←)">◀</button>
                <div class="egr-nav-status">Start</div>
                <button type="button" class="egr-nav-btn" data-nav="next" title="Next (→)">▶</button>
                <button type="button" class="egr-nav-btn" data-nav="last" title="End (End)">⏭</button>
            </div>`;
        panel.querySelector('.egr-header').insertAdjacentElement('afterend', bar);
        bar.querySelectorAll('.egr-nav-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                if (!REVIEW_NAV) return;
                const action = btn.dataset.nav;
                if (action === 'first') goToReviewPly(0);
                else if (action === 'prev') goToReviewPly(REVIEW_NAV.ply - 1);
                else if (action === 'next') goToReviewPly(REVIEW_NAV.ply + 1);
                else if (action === 'last') goToReviewPly(Infinity);
            });
        });
        return bar;
    }

    function renderReviewBoardPosition() {
        const panel = getReviewPanel();
        if (!panel || !REVIEW_NAV) return;
        const { record, review, ply } = REVIEW_NAV;
        const boardEl = panel.querySelector('.egr-board');
        if (!boardEl) return;
        const grid = fenToGrid(record.prepared.fens[ply]);
        const mv = ply > 0 ? (review.moves[ply - 1] || null) : null;
        const fromSq = mv ? (mv.from || mv.uci.slice(0, 2)) : null;
        const toSq = mv ? (mv.to || mv.uci.slice(2, 4)) : null;
        const flipped = record.userColor === 'b';
        let html = '';
        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                const rr = flipped ? 7 - r : r;
                const ff = flipped ? 7 - f : f;
                const piece = grid[rr][ff];
                const sq = 'abcdefgh'[ff] + (8 - rr);
                const isLight = (rr + ff) % 2 === 0;
                const hl = mv && (fromSq === sq || toSq === sq);
                let inner = '';
                if (piece) {
                    const color = piece === piece.toUpperCase() ? 'w' : 'b';
                    const type = piece.toLowerCase();
                    inner = REVIEW_PIECE_MODE === 'img'
                        ? `<img class="egr-piece-img" alt="" draggable="false" src="${REVIEW_PIECE_URL}${color}${type}.png">`
                        : `<span class="egr-piece-txt egr-piece-${color}">${REVIEW_UNICODE_PIECES[type]}</span>`;
                }
                const glyph = mv && toSq === sq ? reviewGlyphHtml(mv.cls, 'egr-sq-glyph') : '';
                html += `<div class="egr-sq ${isLight ? 'egr-sq-light' : 'egr-sq-dark'}${hl ? ' egr-sq-hl' : ''}">${inner}${glyph}</div>`;
            }
        }
        boardEl.innerHTML = html;

        const status = panel.querySelector('.egr-nav-status');
        if (status) {
            if (!mv) {
                status.textContent = 'Start';
            } else {
                const moveNo = Math.ceil(mv.ply / 2) + (mv.color === 'w' ? '.' : '…');
                status.textContent = `${moveNo} ${mv.san} · ${mv.evalDisplay}`;
            }
        }

        panel.querySelectorAll('.egr-move-cell').forEach((c) => c.classList.remove('egr-move-selected'));
        if (mv) {
            const cell = panel.querySelector(`.egr-move-cell[data-ply="${mv.ply}"]`);
            if (cell) {
                cell.classList.add('egr-move-selected');
                cell.scrollIntoView({ block: 'nearest' });
            }
        }
        showMoveDetail(mv);
        updateReviewBoardAnalysisPly(ply);
    }

    function goToReviewPly(ply) {
        if (!REVIEW_NAV) return;
        const max = REVIEW_NAV.record.prepared.fens.length - 1;
        REVIEW_NAV.ply = Math.max(0, Math.min(max, ply));
        renderReviewBoardPosition();
    }

    function showMoveDetail(mv) {
        const detail = getReviewBody()?.querySelector('.egr-detail');
        if (!detail) return;
        if (!mv) {
            detail.textContent = 'Step through with ◀ ▶ (or arrow keys), or click a move.';
            return;
        }
        const glyph = REVIEW_GLYPHS[mv.cls];
        const moveNo = Math.ceil(mv.ply / 2) + (mv.color === 'w' ? '.' : '…');
        let text = `<b>${moveNo} ${escapeHtml(mv.san)}</b> — <span class="egr-detail-${mv.cls}">${glyph.label}</span>. Eval: ${escapeHtml(mv.evalDisplay)}.`;
        if (mv.accuracy !== null) text += ` Move accuracy ${mv.accuracy.toFixed(0)}%.`;
        if (mv.bestSan && mv.bestSan !== mv.san && mv.cls !== 'book' && mv.cls !== 'forced') {
            text += ` Best was <b>${escapeHtml(mv.bestSan)}</b>.`;
        }
        detail.innerHTML = text;
    }

    window.addEventListener('keydown', (e) => {
        if (!REVIEW_NAV || !getReviewPanel()) return;
        if (e.key === 'ArrowLeft') goToReviewPly(REVIEW_NAV.ply - 1);
        else if (e.key === 'ArrowRight') goToReviewPly(REVIEW_NAV.ply + 1);
        else if (e.key === 'Home') goToReviewPly(0);
        else if (e.key === 'End') goToReviewPly(Infinity);
        else if (e.key === 'Escape') closeReviewPanel();
        else return;
        e.preventDefault();
        e.stopPropagation();
    }, true);

    function getReviewPanel() {
        return document.getElementById(REVIEW_PANEL_ID);
    }

    function closeReviewPanel() {
        REVIEW_PROFILE_LOAD_ID++;
        cancelAllReviewJobs();
        teardownEngineFrame();
        REVIEW_NAV = null;
        getReviewPanel()?.remove();
    }

    function openReviewPanel(retainedRecord) {
        REVIEW_PROFILE_LOAD_ID++;
        let panel = getReviewPanel();
        if (panel) panel.remove();
        REVIEW_NAV = null;
        probePieceImages();
        fetchUserRatings(); // warm the baseline cache for the "played like" view
        panel = document.createElement('div');
        panel.id = REVIEW_PANEL_ID;
        panel.innerHTML = `
            <div class="egr-card">
                <div class="egr-header">
                    <div>
                        <div class="egr-title">Game Review</div>
                        <div class="egr-subtitle">${REVIEW_ENGINE_LABEL} · EloGuard</div>
                    </div>
                    <div class="egr-header-actions">
                        <button type="button" class="egr-back" title="Back to game review" style="display:none">← Back</button>
                        <button type="button" class="egr-how-btn" title="How Game Review works">?</button>
                        <button type="button" class="egr-profile-btn" title="Stats (all reviewed games)">${reviewGlyphHtml('best', 'egr-profile-icon')}<span>My Stats</span></button>
                        <button type="button" class="egr-close" title="Close">✕</button>
                    </div>
                </div>
                <div class="egr-body"></div>
            </div>`;
        panel.querySelector('.egr-close').addEventListener('click', closeReviewPanel);
        panel.querySelector('.egr-back').addEventListener('click', () => openReviewPanel());
        panel.querySelector('.egr-profile-btn').addEventListener('click', openReviewStats);
        panel.querySelector('.egr-how-btn').addEventListener('click', openReviewHow);
        panel.addEventListener('click', (e) => { if (e.target === panel) closeReviewPanel(); });
        document.body.appendChild(panel);

        const record = getPostGameRecord(retainedRecord);
        if (!record) {
            clearReviewBoardAnalysisState();
            renderReviewMessage('Could not read the moves of this game from the page.');
            return;
        }
        panel.dataset.movesKey = record.movesKey;
        const cached = REVIEW_CACHE.get(reviewCacheKey(record.movesKey, REVIEW_SELECTED_DEPTH));
        if (cached) {
            renderReviewResults(cached.record, cached.review, cached.depth);
        } else {
            renderReviewSetup(record);
        }
    }

    // Opens the Strength Profile (My Stats) view inside an already-open review
    // panel, or its paywall for free users. Shared by the header "My Stats"
    // button and the popup's stats shortcut.
    async function openReviewStats() {
        if (!getReviewPanel()) return;
        const access = await getPremiumFeatureAccess(PRO_FEATURE_GAME_REVIEW);
        if (!access.isPro) {
            renderReviewPaywall('Stats', PRO_FEATURE_GAME_REVIEW, access, true);
            return;
        }
        openReviewProfile();
    }

    // Swaps the header between the game-review view ([?] [Best Move My Stats]) and a
    // sub-view ([← Back]) — 'stats' or 'how'. Inline display is used so the
    // toggle survives whatever button styling chess.com's own CSS might impose.
    function setReviewHeaderMode(mode) {
        const panel = getReviewPanel();
        if (!panel) return;
        const inSubView = mode === 'stats' || mode === 'how';
        const back = panel.querySelector('.egr-back');
        const profileBtn = panel.querySelector('.egr-profile-btn');
        const howBtn = panel.querySelector('.egr-how-btn');
        if (back) back.style.display = inSubView ? '' : 'none';
        if (profileBtn) profileBtn.style.display = inSubView ? 'none' : '';
        if (howBtn) howBtn.style.display = inSubView ? 'none' : '';
    }

    // "How it works" sub-view: plain-English explanation of the review math,
    // sourced from lib/review-core.js. Same navigation contract as the stats
    // sub-view — header shows ← Back, which rebuilds the review panel.
    function openReviewHow() {
        const body = getReviewBody();
        if (!body) return;
        REVIEW_PROFILE_LOAD_ID++;
        REVIEW_NAV = null;
        setReviewBoardBar(false);
        setReviewHeaderMode('how');
        body.innerHTML = `
            <div class="egr-how">
                <div class="egr-how-section">
                    <div class="egr-how-h">What it does</div>
                    <div class="egr-how-p">Game Review runs Stockfish locally in your browser and analyzes every move of the game. Nothing is uploaded, and your games never leave your machine. Higher depth means a stronger engine and a longer wait.</div>
                </div>
                <div class="egr-how-section">
                    <div class="egr-how-h">Win chance, not just eval</div>
                    <div class="egr-how-p">Engine evals are converted into a win chance, using the model published by lichess. That's why the same eval swing counts more in a balanced position than in one that was already completely winning or lost.</div>
                </div>
                <div class="egr-how-section">
                    <div class="egr-how-h">Accuracy</div>
                    <div class="egr-how-p">Each move's accuracy comes from how much win chance it gave up. Your game accuracy blends an average that weighs the sharpest stretches of the game most, with a second average where a few big blunders can't hide behind quiet moves.</div>
                </div>
                <div class="egr-how-section">
                    <div class="egr-how-h">Move labels</div>
                    <div class="egr-how-p">Moves are labeled brilliant through blunder following chess.com's taxonomy, so the labels here read the same as the ones you're used to.</div>
                </div>
                <div class="egr-how-section">
                    <div class="egr-how-h">Estimated rating</div>
                    <div class="egr-how-p">The "played like" number compares this one game's accuracy and centipawn loss against how players of each rating typically perform. It's a single-game estimate, swingy by design, and it never looks at anyone's actual rating. The steadier multi-game estimate lives in My Stats.</div>
                </div>
                <button type="button" class="egr-again-btn egr-how-back">Back to review</button>
            </div>`;
        body.querySelector('.egr-how-back')?.addEventListener('click', () => openReviewPanel());
    }

    // Entry point for the extension popup's "My Stats" button. The popup calls
    // this via chrome.scripting.executeScript (ISOLATED world, shared with this
    // content script) on the active tab. Set once on first load; the version
    // guard at the top of this IIFE makes re-injection a no-op, so the hook
    // survives the popup re-injecting content.js.
    window.__eloGuardOpenStats = () => {
        openReviewPanel();
        openReviewStats();
    };

    function getReviewBody() {
        return getReviewPanel()?.querySelector('.egr-body') || null;
    }

    function renderReviewMessage(text) {
        setReviewBoardBar(false);
        const body = getReviewBody();
        if (body) body.innerHTML = `<div class="egr-message">${escapeHtml(text)}</div>`;
    }

    function reviewProfileLoadIsCurrent(loadId) {
        return loadId === REVIEW_PROFILE_LOAD_ID && !!getReviewPanel();
    }

    function renderReviewProfileLoadError(error) {
        const body = getReviewBody();
        if (!body) return;
        REVIEW_NAV = null;
        clearReviewBoardAnalysisState();
        setReviewBoardBar(false);
        setReviewHeaderMode('stats');
        const message = error?.message || 'unknown error';
        const needsReload = isExtensionContextInvalidated(error) || /review tools unavailable/i.test(message);
        const title = needsReload
            ? 'Reload this page to reopen My Stats.'
            : 'Could not load your stats.';
        const detail = needsReload
            ? 'EloGuard needs a fresh content script on this tab.'
            : message;
        body.innerHTML = `
            <div class="egr-results">
                <div class="egr-profile-head">Stats</div>
                <div class="egr-message">${escapeHtml(title)}<br>${escapeHtml(detail)}</div>
                <div class="egr-footer">
                    <button type="button" class="egr-again-btn egr-profile-back">Back to review</button>
                    <button type="button" class="egr-again-btn ${needsReload ? 'egr-profile-reload' : 'egr-profile-retry'}">${needsReload ? 'Reload page' : 'Try again'}</button>
                </div>
            </div>`;
        body.querySelector('.egr-profile-back')?.addEventListener('click', () => openReviewPanel());
        body.querySelector('.egr-profile-retry')?.addEventListener('click', openReviewProfile);
        body.querySelector('.egr-profile-reload')?.addEventListener('click', () => location.reload());
    }

    function renderReviewPaywall(title, featureKey, access, proOnly = false) {
        const body = getReviewBody();
        if (!body) return;
        REVIEW_NAV = null;
        clearReviewBoardAnalysisState();
        setReviewBoardBar(false);
        // The Strength Profile paywall (proOnly) is a stats sub-view — offer a
        // way back to the game review; the game-review paywall is top-level.
        setReviewHeaderMode(proOnly ? 'stats' : 'review');
        // The plan check failing is not the same as the user being out of free
        // reviews — never upsell on failure, especially to a Pro user whose
        // orphaned tab can no longer read the entitlement cache.
        if (access?.unavailable) {
            const copy = access.contextInvalidated
                ? `EloGuard was updated. Reload this page to re-enable ${title}.`
                : 'EloGuard could not check your plan on this tab. Reload the page and try again.';
            body.innerHTML = `
                <div class="egr-message">${escapeHtml(copy)}</div>
                <div class="egr-footer">
                    <button type="button" class="egr-again-btn egr-reload-page">Reload page</button>
                </div>`;
            body.querySelector('.egr-reload-page').addEventListener('click', () => location.reload());
            return;
        }
        const limit = access?.limit || 1;
        const remaining = access && Number.isFinite(access.remaining) ? access.remaining : 0;
        // MATCHUP ADVICE — DISABLED (chess.com TOS review pending): the upsell copy
        // below no longer mentions "matchup advice". Restore the phrase when re-enabling.
        const freeLine = proOnly
            ? 'Included with EloGuard Pro.'
            : `${remaining} of ${limit} free reviews left today.`;
        body.innerHTML = `
            <div class="egr-pro-lock">
                <div class="egr-pro-eyebrow">EloGuard Pro</div>
                <div class="egr-pro-title">${escapeHtml(title)}</div>
                <div class="egr-pro-copy">${escapeHtml(freeLine)} Pro unlocks unlimited game reviews and Stats.</div>
                <button type="button" class="egr-start-btn egr-upgrade-btn">Upgrade to Pro</button>
            </div>`;
        body.querySelector('.egr-upgrade-btn')?.addEventListener('click', () => openPremiumUpgrade(featureKey));
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function renderReviewSetup(record) {
        const body = getReviewBody();
        if (!body) return;
        REVIEW_NAV = null;
        clearReviewBoardAnalysisState();
        setReviewBoardBar(false);
        const plies = record.sans.length;
        const depth = clampReviewDepth(REVIEW_SELECTED_DEPTH);
        REVIEW_SELECTED_DEPTH = depth;
        body.innerHTML = `
            <div class="egr-setup">
                <div class="egr-setup-line">
                    <div class="egr-setup-players">${escapeHtml(record.whiteName)} vs ${escapeHtml(record.blackName)}</div>
                    <div class="egr-setup-moves">${Math.ceil(plies / 2)} moves</div>
                </div>
                <div class="egr-depth-control">
                    <div class="egr-depth-head">
                        <label for="egr-depth-slider">Depth</label>
                        <output class="egr-depth-value" for="egr-depth-slider">${depth}</output>
                    </div>
                    <input id="egr-depth-slider" class="egr-depth-slider" type="range" min="${REVIEW_DEPTH_MIN}" max="${REVIEW_DEPTH_MAX}" step="1" value="${depth}" aria-label="Analysis depth">
                    <div class="egr-depth-scale"><span>Fast</span><span>Stronger</span></div>
                </div>
                <button type="button" class="egr-start-btn">Analyze Game</button>
            </div>`;
        const slider = body.querySelector('.egr-depth-slider');
        const value = body.querySelector('.egr-depth-value');
        slider?.addEventListener('input', () => {
            REVIEW_SELECTED_DEPTH = clampReviewDepth(slider.value);
            if (value) value.textContent = `${REVIEW_SELECTED_DEPTH}`;
        });
        const startBtn = body.querySelector('.egr-start-btn');
        updateDailyLeftButton(startBtn, 'Analyze Game', PRO_FEATURE_GAME_REVIEW, record.movesKey);
        startBtn?.addEventListener('click', () => startGameReview(record));
    }

    async function startGameReview(record) {
        const selectedDepth = clampReviewDepth(REVIEW_SELECTED_DEPTH);
        const body = getReviewBody();
        if (!body) return;
        // Single engine: if a batch is running, cancel it cleanly via its own path so the two
        // don't fight over the engine or clobber each other's handle.
        if (REVIEW_BATCH_ACTIVE) {
            REVIEW_BATCH_CANCEL = true;
            cancelReviewJob(REVIEW_BATCH_JOB?.jobId);
            REVIEW_BATCH_JOB = null;
        }
        // Non-consuming gate; a failed/cancelled analysis must not burn the free
        // daily review. We spend it only after buildReview succeeds (below).
        const access = await getPremiumFeatureAccess(PRO_FEATURE_GAME_REVIEW, record.movesKey);
        if (!access.allowed) {
            renderReviewPaywall('Game Review', PRO_FEATURE_GAME_REVIEW, access);
            return;
        }
        setReviewBoardBar(false);
        body.innerHTML = `
            <div class="egr-progress">
                <div class="egr-progress-label">Starting engine…</div>
                <div class="egr-progress-track"><div class="egr-progress-fill"></div></div>
                <button type="button" class="egr-cancel-btn">Cancel</button>
            </div>`;
        const singleHandle = {};
        REVIEW_SINGLE_JOB = singleHandle;
        body.querySelector('.egr-cancel-btn').addEventListener('click', () => {
            cancelReviewJob(singleHandle.jobId);
            if (REVIEW_SINGLE_JOB === singleHandle) REVIEW_SINGLE_JOB = null;
            renderReviewSetup(record);
        });
        const startedAt = Date.now();
        const onProgress = (done, totalPositions) => {
            const label = getReviewBody()?.querySelector('.egr-progress-label');
            const fill = getReviewBody()?.querySelector('.egr-progress-fill');
            if (!label || !fill) return;
            const pct = Math.round((done / totalPositions) * 100);
            const elapsed = (Date.now() - startedAt) / 1000;
            const eta = done > 2 ? Math.max(0, Math.round((elapsed / done) * (totalPositions - done))) : null;
            label.textContent = `Analyzing position ${done}/${totalPositions} (${pct}%)${eta !== null ? ` · ~${eta}s left` : ''}`;
            fill.style.width = pct + '%';
        };
        try {
            const uciMoves = record.prepared.moves.map((m) => m.uci);
            const positions = await analyzeMovesWithEngine(
                uciMoves,
                selectedDepth,
                !!record.prepared.terminal,
                onProgress,
                reviewPositionsToAnalyze(record.prepared),
                singleHandle
            );
            REVIEW_SINGLE_JOB = null;
            // Panel may have been closed / reopened for a different game meanwhile.
            const panel = getReviewPanel();
            if (!panel || panel.dataset.movesKey !== record.movesKey) return;
            const review = EloGuardReviewCore.buildReview(record.prepared, positions,
                { timeControl: record.timeControl, depth: selectedDepth });
            REVIEW_CACHE.set(reviewCacheKey(record.movesKey, selectedDepth), { review, record, depth: selectedDepth });
            if (REVIEW_CACHE.size > REVIEW_CACHE_MAX) {
                REVIEW_CACHE.delete(REVIEW_CACHE.keys().next().value);
            }
            // Spend the free daily review only now that analysis succeeded.
            // Idempotent per game (movesKey); a Pro user is never charged.
            await consumePremiumFeature(PRO_FEATURE_GAME_REVIEW, record.movesKey);
            saveReviewToHistory(record, review);
            renderReviewResults(record, review, selectedDepth);
        } catch (e) {
            REVIEW_SINGLE_JOB = null;
            if (e && e.message === 'cancelled') return;
            teardownEngineFrame(); // a retry gets a fresh engine
            // When the extension is reloaded/updated, this already-loaded content
            // script is orphaned and every chrome.* call throws "Extension context
            // invalidated". A retry can't recover it — only a page reload can.
            if (isExtensionContextInvalidated(e)) {
                renderReviewMessage('EloGuard was updated. Reload this page to re-enable Game Review.');
                const reloadBody = getReviewBody();
                if (reloadBody) {
                    const reload = document.createElement('button');
                    reload.type = 'button';
                    reload.className = 'egr-start-btn';
                    reload.textContent = 'Reload page';
                    reload.addEventListener('click', () => location.reload());
                    reloadBody.appendChild(reload);
                }
                return;
            }
            renderReviewMessage('Analysis failed: ' + (e?.message || 'unknown error'));
            const failBody = getReviewBody();
            if (failBody) {
                const retry = document.createElement('button');
                retry.type = 'button';
                retry.className = 'egr-start-btn';
                retry.textContent = 'Try again';
                retry.addEventListener('click', () => renderReviewSetup(record));
                failBody.appendChild(retry);
            }
        }
    }

    function formatEstimate(est) {
        if (!est) return '—';
        return `~${est.rating} <span class="egr-est-unc">±${est.uncertainty}</span>`;
    }

    // --- strength profile (aggregated over all reviewed games) ---

    async function openReviewProfile() {
        const body = getReviewBody();
        if (!body) return;
        const loadId = ++REVIEW_PROFILE_LOAD_ID;
        REVIEW_NAV = null;
        setReviewBoardBar(false);
        setReviewHeaderMode('stats');
        body.innerHTML = '<div class="egr-message">Loading profile…</div>';
        if (typeof EloGuardReviewCore === 'undefined') {
            renderReviewProfileLoadError(new Error('Review tools unavailable'));
            return;
        }
        try {
            const ratingsPromise = loadUserRatingsForProfile();
            const list = await loadReviewHistoryWithTimeout();
            if (!reviewProfileLoadIsCurrent(loadId)) return;
            renderReviewProfile(list);
            ratingsPromise.then((ratings) => {
                if (!ratings || !reviewProfileLoadIsCurrent(loadId)) return;
                try {
                    renderReviewProfile(list);
                } catch (e) {
                    if (reviewProfileLoadIsCurrent(loadId)) renderReviewProfileLoadError(e);
                }
            });
        } catch (e) {
            if (reviewProfileLoadIsCurrent(loadId)) renderReviewProfileLoadError(e);
        }
    }

    function renderReviewProfile(entries) {
        const body = getReviewBody();
        if (!body) return;
        const now = Date.now();
        const filtered = filterEntriesForRange(entries, REVIEW_PROFILE_RANGE, now);
        const profile = EloGuardReviewCore.aggregateProfile(filtered, now, { noDecay: REVIEW_PROFILE_RANGE !== 'all' });
        const rangeOptions = REVIEW_BATCH_RANGES.map((r) =>
            `<option value="${r.key}"${r.key === REVIEW_PROFILE_RANGE ? ' selected' : ''}>${r.label}</option>`
        ).join('');
        const controls = `
            <div class="egr-batch-row">
                <select class="egr-tc-select egr-range-select">${rangeOptions}</select>
                <button type="button" class="egr-again-btn egr-batch-btn">${REVIEW_BATCH_ACTIVE ? 'Cancel' : 'Analyze range'}</button>
            </div>
            <div class="egr-batch-status">${REVIEW_BATCH_ACTIVE ? 'Working…' : ''}</div>
            <div class="egr-batch-progress"><div class="egr-batch-progress-fill"></div></div>`;

        if (!profile) {
            body.innerHTML = `
                <div class="egr-results">
                    <div class="egr-profile-head">Stats</div>
                    ${controls}
                    <div class="egr-message">No reviewed games in this range. Use "Analyze range" to review your recent games.</div>
                    <div class="egr-footer">
                        <button type="button" class="egr-again-btn egr-profile-back">Back to review</button>
                    </div>
                </div>`;
            wireProfileControls(body);
            return;
        }

        // Anchored view: the user's chess.com rating pins the level and the engine
        // measures the deviation from it. Falls back to the rating-free estimate
        // when no baseline rating is known for the pool.
        const baselines = REVIEW_USER_RATINGS || {};
        const anchoringOn = ['bullet', 'blitz', 'rapid', 'classical']
            .some((pool) => profile.pools[pool] && typeof baselines[pool] === 'number');
        const fmtDelta = (d) => (d >= 0 ? '+' : '') + d;

        const gamesLabel = (n) => `${n} game${n === 1 ? '' : 's'}`;
        const deltaDir = (d) => (d > 0 ? 'up' : d < 0 ? 'down' : 'flat');
        const accBar = (acc) =>
            `<div class="egr-accbar"><div class="egr-accbar-fill" style="width:${Math.max(2, Math.min(100, acc)).toFixed(1)}%"></div></div>`;
        const poolCards = ['bullet', 'blitz', 'rapid', 'classical']
            .filter((pool) => profile.pools[pool])
            .map((pool) => {
                const p = profile.pools[pool];
                const anchor = anchoringOn && typeof baselines[pool] === 'number'
                    ? EloGuardReviewCore.anchoredPerformance(
                        typeof p.performanceFeature === 'number' ? p.performanceFeature : p.feature,
                        typeof p.performanceEffMoves === 'number' ? p.performanceEffMoves : p.effMoves,
                        pool,
                        baselines[pool]
                    )
                    : null;
                const strength = anchor ? anchor.strength : p.rating;
                const unc = anchor ? anchor.uncertainty : p.uncertainty;
                const delta = anchor
                    ? `<div class="egr-pool-delta" data-dir="${deltaDir(anchor.delta)}">${fmtDelta(anchor.delta)} vs your ${anchor.baseline}</div>`
                    : '';
                return `
                    <div class="egr-pool-card" data-pool="${pool}">
                        <div class="egr-pool-top">
                            <span class="egr-pool-name">${pool}</span>
                            <span class="egr-pool-games">${gamesLabel(p.games)}</span>
                        </div>
                        <div class="egr-pool-strength">~${strength}<span class="egr-pool-unc">±${unc}</span></div>
                        ${delta}
                        <div class="egr-pool-acc"><span class="egr-pool-acclabel">Accuracy</span>${accBar(p.accuracy)}<span class="egr-pool-accnum">${p.accuracy.toFixed(1)}%</span></div>
                    </div>`;
            }).join('');

        const phaseLabels = { opening: 'Opening', middlegame: 'Middlegame', endgame: 'Endgame' };
        const primaryBaseline = anchoringOn && typeof baselines[profile.primaryPool] === 'number'
            ? baselines[profile.primaryPool] : null;
        const phaseRows = EloGuardReviewCore.PHASES
            .filter((ph) => profile.phases[ph])
            .map((ph) => {
                const p = profile.phases[ph];
                const anchor = primaryBaseline !== null
                    ? EloGuardReviewCore.anchoredStrength(p.feature, p.effMoves, profile.primaryPool, primaryBaseline, p.phaseOffset)
                    : null;
                const chip = anchor
                    ? `<span class="egr-phase-delta" data-dir="${deltaDir(anchor.delta)}">${fmtDelta(anchor.delta)}</span>`
                    : `<span class="egr-phase-delta" data-dir="flat">~${p.rating} ±${p.uncertainty}</span>`;
                return `
                    <div class="egr-phase-row">
                        <div class="egr-phase-line">
                            <span class="egr-phase-name">${phaseLabels[ph]}</span>
                            ${chip}
                            <span class="egr-phase-moves">${p.moves} moves</span>
                            <span class="egr-phase-accnum">${p.accuracy.toFixed(1)}%</span>
                        </div>
                        ${accBar(p.accuracy)}
                    </div>`;
            }).join('');

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const recentRows = profile.recent.map((r) => {
            const d = new Date(r.ts);
            const date = `${monthNames[d.getMonth()]} ${d.getDate()}`;
            const baseline = baselines[r.pool];
            // Show the SAME per-game number the single-game Game Review card
            // shows ("played like ~X" vs your level) so the two views agree.
            // Falls back to the rating-free estimate when no baseline rating is
            // known for the pool.
            let est = r.rating;
            if (anchoringOn && typeof baseline === 'number' && r.stats && r.timeControl) {
                const perf = EloGuardReviewCore.gamePerformance(r.stats, r.timeControl, baseline);
                if (perf) est = perf.perf;
            }
            return `
                <div class="egr-recent-row">
                    <span class="egr-recent-date">${date}</span>
                    <span class="egr-recent-pool" data-pool="${r.pool}">${r.pool}</span>
                    <span class="egr-recent-acc">${r.accuracy.toFixed(1)}%</span>
                    <span class="egr-recent-est">~${est}</span>
                </div>`;
        }).join('');

        body.innerHTML = `
            <div class="egr-results">
                <div class="egr-profile-head">Stats
                    <span class="egr-profile-sub">${gamesLabel(profile.totalGames)} reviewed</span>
                </div>
                ${controls}
                <div class="egr-profile-section">Accuracy performance rating</div>
                <div class="egr-profile-pools">${poolCards}</div>
                <div class="egr-profile-section">By phase</div>
                <div class="egr-phase-list">${phaseRows || '<div class="egr-message">Not enough phase data yet.</div>'}</div>
                <div class="egr-profile-section">Recent games</div>
                <div class="egr-recent-list">${recentRows}</div>
                <div class="egr-footer">
                    <button type="button" class="egr-again-btn egr-profile-back">Back to review</button>
                    <button type="button" class="egr-again-btn egr-profile-clear">Clear history</button>
                </div>
            </div>`;
        wireProfileControls(body);
        body.querySelector('.egr-profile-clear').addEventListener('click', (e) => {
            const btn = e.target;
            if (btn.dataset.confirm) {
                chrome.storage.local.set({ [REVIEW_HISTORY_KEY]: [] }, () => renderReviewProfile([]));
            } else {
                btn.dataset.confirm = '1';
                btn.textContent = 'Really clear?';
                setTimeout(() => { delete btn.dataset.confirm; btn.textContent = 'Clear history'; }, 2500);
            }
        });
    }

    function wireProfileControls(body) {
        body.querySelector('.egr-profile-back')?.addEventListener('click', () => openReviewPanel());
        body.querySelector('.egr-range-select')?.addEventListener('change', async (e) => {
            REVIEW_PROFILE_RANGE = e.target.value;
            try {
                renderReviewProfile(await loadReviewHistoryWithTimeout());
            } catch (error) {
                renderReviewProfileLoadError(error);
            }
        });
        body.querySelector('.egr-batch-btn')?.addEventListener('click', () => {
            if (REVIEW_BATCH_ACTIVE) {
                REVIEW_BATCH_CANCEL = true;
                cancelReviewJob(REVIEW_BATCH_JOB?.jobId);
                REVIEW_BATCH_JOB = null;
                return;
            }
            const btn = body.querySelector('.egr-batch-btn');
            if (btn) btn.textContent = 'Cancel';
            startBatchAnalysis(REVIEW_PROFILE_RANGE);
        });
    }

    function renderReviewResults(record, review, depth) {
        const body = getReviewBody();
        if (!body) return;
        const names = { w: record.whiteName, b: record.blackName };
        const userMark = record.userColor;

        const ratingOf = { w: record.whiteRating, b: record.blackRating };
        const perfHtml = (color) => {
            const p = review.players[color];
            const perf = typeof ratingOf[color] === 'number'
                ? EloGuardReviewCore.gamePerformance(p, review.timeControl, ratingOf[color])
                : null;
            if (perf) {
                return {
                    est: `~${perf.perf}`,
                    label: `played like · ${perf.delta >= 0 ? '+' : ''}${perf.delta} vs their ${perf.baseline}`
                };
            }
            return {
                est: formatEstimate(p.estimate),
                label: `This game (${review.timeClass} scale)`
            };
        };
        const playerCard = (color) => {
            const p = review.players[color];
            const acc = p.accuracy !== null ? p.accuracy.toFixed(1) : '—';
            const acpl = p.acpl !== null ? Math.round(p.acpl) : '—';
            const perf = perfHtml(color);
            return `
                <div class="egr-player egr-player-${color}${userMark === color ? ' egr-player-me' : ''}">
                    <div class="egr-player-name"><span class="egr-color-dot egr-dot-${color}"></span>${escapeHtml(names[color])}${userMark === color ? ' <span class="egr-me-tag">you</span>' : ''}</div>
                    <div class="egr-accuracy">${acc}</div>
                    <div class="egr-accuracy-label">Accuracy</div>
                    <div class="egr-est" data-color="${color}">${perf.est}</div>
                    <div class="egr-est-label" data-color="${color}" title="Full-credit single-game performance vs the player's rating (swingy by design). The shrunk multi-game strength estimate lives in My Stats.">${perf.label}</div>
                    <div class="egr-acpl">ACPL ${acpl}</div>
                </div>`;
        };

        const countRows = EloGuardReviewCore.CLASS_ORDER
            .filter((cls) => review.players.w.counts[cls] || review.players.b.counts[cls])
            .map((cls) => {
                const glyph = REVIEW_GLYPHS[cls];
                return `
                    <div class="egr-count-row">
                        <span class="egr-count-white">${review.players.w.counts[cls] || 0}</span>
                        <span class="egr-count-label">${reviewGlyphHtml(cls)}${glyph.label}</span>
                        <span class="egr-count-black">${review.players.b.counts[cls] || 0}</span>
                    </div>`;
            }).join('');

        const phaseLabels = { opening: 'Opening', middlegame: 'Middlegame', endgame: 'Endgame' };
        const phaseAcc = (p) => (p && p.accuracy !== null && p.scoredCount >= 2 ? p.accuracy.toFixed(0) + '%' : '—');
        const phaseRows = EloGuardReviewCore.PHASES
            .filter((ph) => (review.players.w.phases?.[ph]?.scoredCount || 0) + (review.players.b.phases?.[ph]?.scoredCount || 0) > 0)
            .map((ph) => `
                <div class="egr-count-row">
                    <span class="egr-count-white">${phaseAcc(review.players.w.phases?.[ph])}</span>
                    <span class="egr-count-label">${phaseLabels[ph]}</span>
                    <span class="egr-count-black">${phaseAcc(review.players.b.phases?.[ph])}</span>
                </div>`).join('');

        const tcKey = (t) => `${t.base}|${t.inc || 0}`;
        const currentTc = (review.timeControl && typeof review.timeControl === 'object')
            ? review.timeControl
            : (record.timeControl || { base: 600, inc: 0 });
        const tcChoices = REVIEW_TC_OPTIONS.slice();
        if (!tcChoices.some((t) => tcKey(t) === tcKey(currentTc))) tcChoices.unshift(currentTc);
        const tcOptions = tcChoices.map((t) =>
            `<option value="${tcKey(t)}"${tcKey(t) === tcKey(currentTc) ? ' selected' : ''}>${timeControlLabel(t)} · ${EloGuardReviewCore.timeClassOf(t)}</option>`
        ).join('');

        let movesHtml = '';
        for (let i = 0; i < review.moves.length; i += 2) {
            const white = review.moves[i];
            const black = review.moves[i + 1] || null;
            const cell = (mv) => {
                if (!mv) return '<span class="egr-move-cell egr-move-empty"></span>';
                const glyph = REVIEW_GLYPHS[mv.cls];
                return `<span class="egr-move-cell egr-move-${mv.cls}" data-ply="${mv.ply}" title="${glyph.label}">
                    <span class="egr-move-san">${escapeHtml(mv.san)}</span>
                    ${reviewGlyphHtml(mv.cls)}
                </span>`;
            };
            movesHtml += `<div class="egr-move-row"><span class="egr-move-num">${i / 2 + 1}.</span>${cell(white)}${cell(black)}</div>`;
        }

        body.innerHTML = `
            <div class="egr-results">
                <div class="egr-players">${playerCard('w')}${playerCard('b')}</div>
                ${review.opening ? `<div class="egr-opening" title="${escapeHtml(review.opening.eco)}">${escapeHtml(review.opening.name)}</div>` : ''}
                <div class="egr-time-row">
                    <span class="egr-time-label">Time control</span>
                    <select class="egr-tc-select">${tcOptions}</select>
                </div>
                <div class="egr-counts">${countRows}</div>
                ${phaseRows ? `<div class="egr-counts"><div class="egr-profile-section">Accuracy by phase</div>${phaseRows}</div>` : ''}
                <div class="egr-moves">${movesHtml}</div>
                <div class="egr-detail">Step through with ◀ ▶ (or arrow keys), or click a move.</div>
                <div class="egr-footer">
                    <span>depth ${depth}</span>
                    <button type="button" class="egr-again-btn">Re-analyze</button>
                </div>
            </div>`;

        REVIEW_NAV = { record, review, ply: 0 };
        setReviewBoardAnalysisState(record, review, depth, 0);
        setReviewBoardBar(true);

        body.querySelector('.egr-tc-select').addEventListener('change', (e) => {
            const [base, inc] = e.target.value.split('|').map(Number);
            const tc = { base, inc };
            review.timeControl = tc;
            review.timeClass = EloGuardReviewCore.timeClassOf(tc);
            for (const color of ['w', 'b']) {
                review.players[color].estimate = EloGuardReviewCore.estimateRating(review.players[color], tc);
                const perf = perfHtml(color);
                const el = body.querySelector(`.egr-est[data-color="${color}"]`);
                if (el) el.innerHTML = perf.est;
                const lbl = body.querySelector(`.egr-est-label[data-color="${color}"]`);
                if (lbl) lbl.textContent = perf.label;
            }
            saveReviewToHistory(record, review); // keep the profile's time control in sync
        });

        body.querySelectorAll('.egr-move-cell[data-ply]').forEach((cell) => {
            cell.addEventListener('click', () => goToReviewPly(parseInt(cell.dataset.ply, 10)));
        });

        body.querySelector('.egr-again-btn').addEventListener('click', () => {
            REVIEW_CACHE.delete(reviewCacheKey(record.movesKey, depth));
            renderReviewSetup(record);
        });

        renderReviewBoardPosition();
    }

    setInterval(ensurePostGameButtons, 1000);

    (function hookSpa() {
        const wrap = (fn) => {
            const original = history[fn];
            history[fn] = function (...args) {
                const res = original.apply(this, args);
                if (GUARD_ACTIVE && activeLockState) {
                    setTimeout(() => lockOut(activeLockState.rating, activeLockState.type, activeLockState), 50);
                }
                return res;
            };
        };
        wrap('pushState');
        wrap('replaceState');
    })();
})();
