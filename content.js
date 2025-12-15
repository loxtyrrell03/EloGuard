(() => {
    if (window.__ELOGUARD_CONTENT_LOADED__) return;
    window.__ELOGUARD_CONTENT_LOADED__ = true;

    // --- CONFIG & STATE ---
    let STOP_LOSS = 0;
    let TARGET_RATING = 0;
    let USERNAME = "";
    let ZEN_MODE = false;
    let GAME_MODE = "blitz";
    let GUARD_ACTIVE = false;
    let COOLDOWN_ACTIVE = false;
    let COOLDOWN_SECONDS = 0;

    let activeLockState = null; 

    let gameOverDetected = false;
    let isCooldownRunning = false;
    let cooldownTimerId = null;
    let cooldownEndTime = 0;
    const INSTANCE_ID_KEY = 'eloGuardInstanceId';
    const SESSION_COOLDOWN_END_KEY = 'eloGuardCooldownEndTime';
    let ELOGUARD_INSTANCE_ID = null;

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

    function loadSettings() {
        chrome.storage.sync.get(null, (data) => {
            if (data.username) {
                USERNAME = data.username;
                ZEN_MODE = data.hideRatings || false;
                GAME_MODE = data.gameMode || "blitz";
                GUARD_ACTIVE = data.guardActive || false;
                COOLDOWN_ACTIVE = data.cooldownActive || false;
                COOLDOWN_SECONDS = parseInt(data.cooldownSeconds) || 0;

                const stopKey = `stopLoss_${GAME_MODE}`;
                const targetKey = `targetRating_${GAME_MODE}`;
                STOP_LOSS = parseInt(data[stopKey]) || 0;
                TARGET_RATING = parseInt(data[targetKey]) || 0;

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
            }
        });
    }
    loadSettings();

    // --- TIMERS ---
    setInterval(() => { if (GUARD_ACTIVE) checkRating(); }, 30000); // Slow Poll

    // Fast Poll to enforce locks
    setInterval(() => {
        if (GUARD_ACTIVE && activeLockState) {
            lockOut(activeLockState.rating, activeLockState.type);
        }
    }, 200);

    setInterval(checkForGameOver, 100);
    setInterval(scrubChat, 500);

    // --- LOGIC ---

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
            'a.play-quick-links-link' // The Catch-All
        ];

        selectors.forEach(sel => {
            const els = document.querySelectorAll(sel);
            els.forEach(btn => {
                // --- EXCLUSION LOGIC START ---
                // We check the text and href to see if this is a "Bot" or "Friend" button
                const text = (btn.innerText || "").toLowerCase();
                const href = (btn.getAttribute('href') || "").toLowerCase();
                
                // If it mentions Computer, Bot, or Friend, skip it entirely.
                if (text.includes("computer") || text.includes("bot") || text.includes("friend")) return;
                if (href.includes("/play/computer") || href.includes("/play/friend")) return;
                // --- EXCLUSION LOGIC END ---

                // If it's a home screen tile that is already handled by lockHomeScreen, skip generic lock
                if (btn.classList.contains('play-quick-links-link')) {
                    if (btn.classList.contains('elo-guard-home-locked')) return;
                }

                if (btn.tagName !== "BUTTON" && btn.tagName !== "A" && btn.tagName !== "DIV") return;

                if (btn.tagName !== "BUTTON" && !btn.classList.contains('play-quick-links-link')) {
                     const innerBtn = btn.querySelector('button');
                     if (innerBtn) btn = innerBtn;
                }
                
                if (btn.getAttribute('data-elo-guard-lock') !== lockType) {
                    applyLockStyle(btn, title, sub, bgColor, lockType);
                }
            });
        });

        const plusIcons = document.querySelectorAll('[data-glyph="mark-plus"]');
        plusIcons.forEach(icon => {
            const btn = icon.closest('button');
            if (btn && btn.getAttribute('data-elo-guard-lock') !== lockType) {
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
                    parent.style.pointerEvents = "none";
                }
            }
        });
    }

    // --- ZEN & HELPERS ---
    function scrubChat() {
        if (!ZEN_MODE) return;
        const chatMsgs = document.querySelectorAll('.game-start-message-component, .game-over-message-component');
        chatMsgs.forEach(msg => {
            if(msg.innerText.includes('(')) msg.innerHTML = msg.innerHTML.replace(/\(\s*[+-]?\d+\s*\)/g, '');
        });
    }

    function applyZenMode() {
        if (ZEN_MODE) document.body.classList.add('elo-shield-zen');
        else document.body.classList.remove('elo-shield-zen');
        if (ZEN_MODE) scrubChat();
    }

    chrome.storage.onChanged.addListener((changes) => {
        if (changes.guardActive) {
            GUARD_ACTIVE = changes.guardActive.newValue;
            if (!GUARD_ACTIVE) {
                activeLockState = null;
                clearCooldownState();
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