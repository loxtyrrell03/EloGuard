(() => {
    if (window.__ELOGUARD_CONTENT_LOADED__) return;
    window.__ELOGUARD_CONTENT_LOADED__ = true;

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

    let consecutiveLosses = 0;
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
    `;
    document.head.appendChild(style);

    function loadSettings() {
        chrome.storage.sync.get(null, (data) => {
            if (data.username) {
                USERNAME = data.username;
                ZEN_MODE = data.hideRatings || false;
                GAME_MODE = data.gameMode || "blitz";
                GUARD_ACTIVE = data.guardActive || false;
                COOLDOWN_ACTIVE = data.cooldownActive || false;
                COOLDOWN_SECONDS = parseInt(data.cooldownSeconds) || 0;
                RANDOM_STRING_UNLOCK = data.randomStringUnlock || false;
                RANDOM_STRING_LENGTH = parseInt(data.randomStringLength) || 10;

                const stopKey = `stopLoss_${GAME_MODE}`;
                const targetKey = `targetRating_${GAME_MODE}`;
                const streakKey = `lossStreak_${GAME_MODE}`;
                STOP_LOSS = parseInt(data[stopKey]) || 0;
                TARGET_RATING = parseInt(data[targetKey]) || 0;
                STOP_LOSS_STREAK = parseInt(data[streakKey]) || 0;

                loadLossTrackingFromStorage(() => {

                    console.log(`🛡️ EloGuard Loaded: ${USERNAME} | Mode: ${GAME_MODE}`);
                    applyZenMode();

                    if (GUARD_ACTIVE) {
                        resumeCooldownFromStorage();
                        checkRating(); 
                    } else {
                        activeLockState = null;
                        clearCooldownState();
                        unlockButton();
                    }
                });
            }
        });
    }
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
                activeLockState = { type: "stop", rating: currentRating };
                lockOut(currentRating, "stop");
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
        const titleText = isWin ? "🏆 GOAL" : "🛑 STOP";
        const fullTitle = isWin ? `🏆 GOAL HIT (${rating})` : `🛑 STOP`;
        const subText = isWin ? "Target Hit" : "Stop Loss Hit";
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

        if (RANDOM_STRING_UNLOCK && lockType !== "cooldown") {
            btn.style.pointerEvents = "auto";
            btn.style.cursor = "pointer";

            const clickHandler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                createUnlockModal(() => {
                    activeLockState = null;
                    clearCooldownState();
                    unlockButton();
                });
            };

            btn.removeEventListener('click', btn.__eloGuardClickHandler);
            btn.__eloGuardClickHandler = clickHandler;
            btn.addEventListener('click', clickHandler);
        } else {
            btn.style.pointerEvents = "none";
        }
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
                                <span style="font-size: 10px; color: #ccc;">${sub}</span>
                            </div>
                        </div>`;

                    if (RANDOM_STRING_UNLOCK) {
                        parent.style.pointerEvents = "auto";
                        parent.style.cursor = "pointer";

                        const clickHandler = (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            createUnlockModal(() => {
                                activeLockState = null;
                                clearCooldownState();
                                unlockButton();
                            });
                        };

                        parent.removeEventListener('click', parent.__eloGuardClickHandler);
                        parent.__eloGuardClickHandler = clickHandler;
                        parent.addEventListener('click', clickHandler);
                    } else {
                        parent.style.pointerEvents = "none";
                    }
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
                resetLossTracking();
                unlockButton();
            } else {
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
