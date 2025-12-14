(() => {
    if (window.__ELOGUARD_CONTENT_LOADED__) return;
    window.__ELOGUARD_CONTENT_LOADED__ = true;

let STOP_LOSS = 0;
let TARGET_RATING = 0;
let USERNAME = "";
let ZEN_MODE = false;
let GAME_MODE = "blitz"; 
let GUARD_ACTIVE = false; 
let COOLDOWN_ACTIVE = false;
let COOLDOWN_SECONDS = 0;

let gameOverDetected = false; 
let isCooldownRunning = false;
let cooldownTimerId = null;
let cooldownEndTime = 0;
const INSTANCE_ID_KEY = 'eloGuardInstanceId';
const SESSION_COOLDOWN_END_KEY = 'eloGuardCooldownEndTime';
let ELOGUARD_INSTANCE_ID = null;
try {
    ELOGUARD_INSTANCE_ID = sessionStorage.getItem(INSTANCE_ID_KEY);
    if (!ELOGUARD_INSTANCE_ID) {
        ELOGUARD_INSTANCE_ID = (crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`);
        sessionStorage.setItem(INSTANCE_ID_KEY, ELOGUARD_INSTANCE_ID);
    }
} catch (e) {
    ELOGUARD_INSTANCE_ID = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

// Per-tab cooldown key (prevents multiple Chess.com tabs from overwriting each other)
const COOLDOWN_STORAGE_KEY = `eloGuardCooldownEnd:${ELOGUARD_INSTANCE_ID}`;

function getSessionCooldownEndTime() {
    try {
        const v = parseInt(sessionStorage.getItem(SESSION_COOLDOWN_END_KEY), 10);
        return Number.isFinite(v) ? v : 0;
    } catch (e) {
        return 0;
    }
}

function setSessionCooldownEndTime(endTime) {
    try {
        if (endTime) sessionStorage.setItem(SESSION_COOLDOWN_END_KEY, String(endTime));
        else sessionStorage.removeItem(SESSION_COOLDOWN_END_KEY);
    } catch (e) {}
}

// 1. Initialize
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

            console.log(`🛡️ EloGuard: ${USERNAME} | Mode: ${GAME_MODE}`);
            
            applyZenMode();
            
            if (GUARD_ACTIVE) {
                resumeCooldownFromStorage();
                checkRating(); 
            } else {
                clearCooldownState();
                unlockButton();
            }
        }
    });
}
loadSettings();

// If the tab was background-throttled, resync the cooldown UI instantly when it becomes visible.
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && GUARD_ACTIVE) {
        resumeCooldownFromStorage();
    }
});

// Chess.com is an SPA; on route changes, resync cooldown so newly-rendered buttons get re-locked immediately.
(function hookSpaNavigation() {
    if (window.__ELOGUARD_SPA_HOOKED__) return;
    window.__ELOGUARD_SPA_HOOKED__ = true;

    const resync = () => {
        if (GUARD_ACTIVE) resumeCooldownFromStorage();
    };

    const wrap = (fnName) => {
        const original = history[fnName];
        history[fnName] = function (...args) {
            const ret = original.apply(this, args);
            setTimeout(resync, 50);
            return ret;
        };
    };

    wrap('pushState');
    wrap('replaceState');
    window.addEventListener('popstate', () => setTimeout(resync, 50));
})();

// --- TIMERS ---
setInterval(() => {
    if (GUARD_ACTIVE) checkRating();
}, 30000); // 30s Slow Poll

setInterval(scrubChat, 500);

// Ultra-Fast Poll for Game Over (100ms)
setInterval(checkForGameOver, 100);

// Poll for Home Screen Buttons to Lock/Replace if needed
setInterval(() => {
    if (GUARD_ACTIVE && isPermanentLockActive()) {
        const lock = document.querySelector('.elo-guard-locked');
        if (lock) {
            const isWin = lock.innerText.includes("GOAL");
            const ratingMatch = lock.innerText.match(/\d{3,4}/);
            const rating = (isWin && ratingMatch) ? ratingMatch[0] : null;
            
            if (isWin) lockOut(rating, "win", true);
            else lockOut(null, "stop", true);
        }
    }
}, 1000);


// --- LOGIC ---

async function checkForGameOver() {
    if (!GUARD_ACTIVE) return;

    // Detect if Game Over Modal or Sidebar buttons are present
    const isGameOver = document.querySelector('[data-cy="game-over-modal-new-game-button"]') 
                    || document.querySelector('[data-cy="sidebar-rematch-button"]')
                    || document.querySelector('[data-cy="sidebar-game-over-rematch-button"]') 
                    || document.querySelector('.game-over-controls');

    if (isGameOver) {
        if (!gameOverDetected) {
            console.log("🛡️ EloGuard: Game Over Detected.");
            gameOverDetected = true; 

            if (isPermanentLockActive()) return;

            freezeControls();

            const status = await checkRating(true); 

            if (status === 'safe') {
                if (COOLDOWN_ACTIVE && COOLDOWN_SECONDS > 0) {
                    startCooldown();
                } else {
                    unfreezeControls(); 
                }
            } else if (status === 'error') {
                console.log("🛡️ EloGuard: Fetch failed, unfreezing.");
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
            lockOut(currentRating, "stop");
            return 'locked';
        } 
        else if (TARGET_RATING > 0 && currentRating >= TARGET_RATING) {
            lockOut(currentRating, "win");
            return 'locked';
        }
        else {
            if (!preventUnlock && !isCooldownRunning) {
                unlockButton(); 
            }
            return 'safe';
        }
    } catch (e) {
        return 'error';
    }
}

// --- FREEZE UTILS ---
function freezeControls() {
    const selectors = [
        '[data-cy="new-game-index-play"]', 
        '[data-cy="game-over-modal-new-game-button"]',
        '[data-cy="sidebar-rematch-button"]',
        '[data-cy="game-over-modal-rematch-button"]',
        '[data-cy="sidebar-game-over-rematch-button"]' 
    ];
    selectors.forEach(sel => {
        const els = document.querySelectorAll(sel);
        els.forEach(el => {
            el.style.pointerEvents = "none"; 
            el.style.opacity = "0.8"; 
        });
    });

    // Freeze Plus Buttons 
    const plusIcons = document.querySelectorAll('[data-glyph="mark-plus"]');
    plusIcons.forEach(icon => {
        const btn = icon.closest('button');
        if (btn) {
            btn.style.pointerEvents = "none";
            btn.style.opacity = "0.8";
        }
    });

    const homeLinks = document.querySelectorAll('.play-quick-links-title');
    homeLinks.forEach(span => {
        const text = span.innerText.trim();
        if (text === "New Game" || /^Play \d+ min$/i.test(text)) {
            const parent = span.closest('a') || span.parentElement;
            if (parent) {
                parent.style.pointerEvents = "none";
                parent.style.opacity = "0.5";
            }
        }
    });
}

function unfreezeControls() {
    if (isPermanentLockActive()) return;
    
    // We call unlockButton because it now handles the "Raw" style reset too
    unlockButton();
}

// --- COOLDOWN & LOCKS ---

function startCooldown() {
    startCooldownWithDuration(COOLDOWN_SECONDS);
}

function startCooldownWithDuration(seconds, existingEndTime) {
    if (isPermanentLockActive()) return;
    if (isCooldownRunning) return;
    if (!GUARD_ACTIVE) return;
    if (!COOLDOWN_ACTIVE || seconds <= 0) return;

    const now = Date.now();

    // If we already have an active cooldown end time (e.g., page reload), reuse it.
    const sessionEnd = getSessionCooldownEndTime();
    const effectiveEndTime = existingEndTime || cooldownEndTime || sessionEnd;
    if (effectiveEndTime && effectiveEndTime > now) {
        cooldownEndTime = effectiveEndTime;
    } else {
        cooldownEndTime = now + seconds * 1000;
    }
    const initialRemaining = Math.max(0, Math.ceil((cooldownEndTime - now) / 1000));

    isCooldownRunning = true;
    chrome.storage.local.set({ [COOLDOWN_STORAGE_KEY]: cooldownEndTime });
    setSessionCooldownEndTime(cooldownEndTime);
    applyCooldownLock(initialRemaining);

    cooldownTimerId = setInterval(() => {
        const remainingMs = cooldownEndTime - Date.now();
        const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));

        if (isPermanentLockActive()) {
            clearCooldownState();
            return;
        }

        if (remainingSeconds <= 0) {
            clearCooldownState(true);
            unfreezeControls(); 
        } else {
            applyCooldownLock(remainingSeconds);
        }
    }, 1000);
}

function isPermanentLockActive() {
    const btn = document.querySelector('.elo-guard-locked');
    if (!btn) return false;
    const text = btn.innerText || "";
    return text.includes("STOP") || text.includes("GOAL");
}

function applyCooldownLock(seconds) {
    lockButtonGeneric("🧊 COOL DOWN", `Analyze.<br>${seconds}s`, "#2196F3", "cooldown");

    // Ensure any already-locked cooldown buttons keep updating even if their original selectors disappear
    // (e.g., plus-icon buttons after innerHTML replacement).
    const existingCooldownBtns = document.querySelectorAll('[data-elo-guard-lock="cooldown"]');
    existingCooldownBtns.forEach((btn) => {
        applyLockStyle(btn, "🧊 COOL DOWN", `Analyze.<br>${seconds}s`, "#2196F3", "cooldown");
    });
}

function resumeCooldownFromStorage() {
    if (!COOLDOWN_ACTIVE || !GUARD_ACTIVE) {
        clearCooldownState();
        return;
    }

    // Prefer synchronous sessionStorage on SPA navigation/reload.
    const sessionEnd = getSessionCooldownEndTime();
    if (sessionEnd && sessionEnd > Date.now()) {
        const remaining = Math.max(0, Math.ceil((sessionEnd - Date.now()) / 1000));
        cooldownEndTime = sessionEnd;
        if (isCooldownRunning) applyCooldownLock(remaining);
        else startCooldownWithDuration(remaining, sessionEnd);
        return;
    } else if (sessionEnd && sessionEnd <= Date.now()) {
        setSessionCooldownEndTime(0);
    }

    chrome.storage.local.get(COOLDOWN_STORAGE_KEY, (result) => {
        const storedEnd = parseInt(result[COOLDOWN_STORAGE_KEY], 10);
        if (storedEnd && storedEnd > Date.now()) {
            const remaining = Math.max(0, Math.ceil((storedEnd - Date.now()) / 1000));
            cooldownEndTime = storedEnd;
            setSessionCooldownEndTime(storedEnd);
            if (isCooldownRunning) {
                applyCooldownLock(remaining);
            } else {
                startCooldownWithDuration(remaining, storedEnd);
            }
        } else if (storedEnd) {
            chrome.storage.local.remove(COOLDOWN_STORAGE_KEY);
            if (!isPermanentLockActive()) {
                clearCooldownState(false);
                unfreezeControls();
            }
        }
    });
}

function clearCooldownState(clearStorage = true) {
    if (cooldownTimerId) {
        clearInterval(cooldownTimerId);
        cooldownTimerId = null;
    }
    isCooldownRunning = false;
    cooldownEndTime = 0;
    setSessionCooldownEndTime(0);
    if (clearStorage) chrome.storage.local.remove(COOLDOWN_STORAGE_KEY);
}

function lockOut(rating, type, fromPoll = false) {
    if (!GUARD_ACTIVE) return; 

    const isWin = type === "win";
    let titleText, fullTitle, subText;

    if (isWin) {
        titleText = `🏆 GOAL`;
        fullTitle = `🏆 GOAL HIT (${rating})`;
        subText = `Target Hit`;
    } else {
        titleText = `🛑 STOP`;
        fullTitle = `🛑 STOP`; 
        subText = `Stop Loss Hit`;
    }
    
    const color = isWin ? "#4CAF50" : "#ff4d4d"; 
    const bgColor = "#262626";

    lockButtonGeneric(fullTitle, subText, bgColor, type); 
    lockHomeScreen(titleText, subText, bgColor, color);

    const locks = document.querySelectorAll('.elo-guard-locked');
    locks.forEach(btn => {
        btn.style.color = color;
        btn.style.borderColor = color;
        btn.style.backgroundColor = bgColor;
        
        const titleEl = btn.querySelector('.elo-shield-title');
        if (titleEl) titleEl.style.color = color;
    });
}

function lockHomeScreen(title, sub, bgColor, color) {
    const homeLinks = document.querySelectorAll('.play-quick-links-title');
    homeLinks.forEach(span => {
        const text = span.innerText.trim();
        if (text === "New Game" || /^Play \d+ min$/i.test(text)) {
            const parent = span.closest('a') || span.parentElement;
            
            if (parent) {
                if (!parent.classList.contains('elo-guard-home-locked')) {
                    parent.classList.add('elo-guard-home-locked');
                    if (!parent.getAttribute('data-original-html')) {
                        parent.setAttribute('data-original-html', parent.innerHTML);
                    }
                }

                parent.innerHTML = `
                    <div class="elo-guard-locked" style="
                        background-color: ${bgColor} !important; 
                        border: 3px solid ${color} !important;
                        box-sizing: border-box !important;
                        color: ${color} !important;
                        width: 100% !important; 
                        height: 100% !important;
                        min-height: 0 !important;
                        padding: 0 !important;
                        display: flex !important;
                        flex-direction: column !important;
                        align-items: center !important;
                        justify-content: center !important;
                        border-radius: 4px !important;
                    ">
                        <div style="text-align:center; line-height: 1.1;">
                            <span style="font-size: 16px; font-weight: 900; display:block; margin-bottom: 2px;">${title}</span>
                            <span style="font-size: 10px; color: #ccc; display:block;">${sub}</span>
                        </div>
                    </div>
                `;
                
                parent.style.pointerEvents = "none";
                parent.style.textDecoration = "none";
            }
        }
    });
}

// --- CORE LOCKING LOGIC ---
function lockButtonGeneric(title, sub, bgColor, lockType = "generic") {
    if (!GUARD_ACTIVE) return;

    // 1. Updated Selector List to include Modal Buttons
    const standardSelectors = [
        '[data-cy="new-game-index-play"]', 
        '[data-cy="sidebar-rematch-button"]',
        '[data-cy="sidebar-game-over-rematch-button"]',
        '[data-cy="game-over-modal-new-game-button"]', // Added
        '[data-cy="game-over-modal-rematch-button"]'   // Added
    ];

    standardSelectors.forEach(sel => {
        const els = document.querySelectorAll(sel);
        els.forEach(btn => {
            if (btn.tagName !== "BUTTON") {
                const innerBtn = btn.querySelector('button');
                if (innerBtn) btn = innerBtn; else return;
            }
            applyLockStyle(btn, title, sub, bgColor, lockType);
        });
    });

    // 2. Handle Plus Icon Buttons
    const plusIcons = document.querySelectorAll('[data-glyph="mark-plus"]');
    plusIcons.forEach(icon => {
        const btn = icon.closest('button');
        if (btn) {
            applyLockStyle(btn, title, sub, bgColor, lockType);
        }
    });

    // Removed the "3. Handle Unified/Game Over Buttons" block entirely.
    // By adding the selectors to list #1, they are handled non-destructively.
}

function applyLockStyle(btn, title, sub, bgColor, lockType = "generic") {
    if (!btn || btn.tagName !== "BUTTON") return;
    if (!btn.classList.contains('elo-guard-locked')) {
        btn.classList.add('elo-guard-locked');
        
        // --- CRITICAL FIX: Save the HTML, not just text ---
        if (!btn.getAttribute('data-original-html')) {
            btn.setAttribute('data-original-html', btn.innerHTML);
        }
    }
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
    btn.style.color = "white";
    btn.style.borderColor = bgColor;
    btn.style.pointerEvents = "none";
}

function unlockButton() {
    // 1. Force Clear "Frozen" Styles (Raw Selectors)
    const rawSelectors = [
        '[data-cy="new-game-index-play"]', 
        '[data-cy="game-over-modal-new-game-button"]',
        '[data-cy="sidebar-rematch-button"]',
        '[data-cy="game-over-modal-rematch-button"]',
        '[data-cy="sidebar-game-over-rematch-button"]' 
    ];
    rawSelectors.forEach(sel => {
        const els = document.querySelectorAll(sel);
        els.forEach(el => {
            el.style.pointerEvents = "auto";
            el.style.opacity = "";
        });
    });

    // 2. Unlock Standard Locked Buttons (Includes Plus & Rematch)
    const lockedBtns = document.querySelectorAll('.elo-guard-locked:not(.elo-guard-unified-btn)');
    lockedBtns.forEach(btn => {
        if(btn.closest('.elo-guard-home-locked')) return; 

        btn.classList.remove('elo-guard-locked');
        btn.classList.remove('elo-guard-cooldown');
        btn.removeAttribute('data-elo-guard-lock');
        btn.style.pointerEvents = "auto";
        
        // --- CRITICAL FIX: Restore HTML ---
        const originalHtml = btn.getAttribute('data-original-html');
        if (originalHtml) {
            btn.innerHTML = originalHtml;
        } else {
            // Fallback just in case
            btn.innerHTML = "Play"; 
        }
        
        // Reset styles
        btn.style.color = ""; 
        btn.style.borderColor = ""; 
        btn.style.backgroundColor = ""; 
    });

    // 3. Unlock Unified Container (Legacy cleanup, keeps safe if old locks exist)
    const unifiedContainers = document.querySelectorAll('.elo-guard-unified-locked');
    unifiedContainers.forEach(container => {
        container.classList.remove('elo-guard-unified-locked');
        const originalHtml = container.getAttribute('data-original-html');
        if (originalHtml) {
            container.innerHTML = originalHtml;
        }
    });

    // 4. Unlock Home Screen Links
    const homeLocked = document.querySelectorAll('.elo-guard-home-locked');
    homeLocked.forEach(el => {
        el.classList.remove('elo-guard-home-locked');
        el.style.pointerEvents = "auto";
        const originalHtml = el.getAttribute('data-original-html');
        if (originalHtml) {
            el.innerHTML = originalHtml;
        }
    });
    
    // 5. Raw Reset for Home Screen
    const homeLinks = document.querySelectorAll('.play-quick-links-title');
    homeLinks.forEach(span => {
        const parent = span.closest('a') || span.parentElement;
        if (parent) {
            parent.style.pointerEvents = "auto";
            parent.style.opacity = "";
        }
    });

    // 6. Reset Plus Buttons specifically
    const plusIcons = document.querySelectorAll('[data-glyph="mark-plus"]');
    plusIcons.forEach(icon => {
        const btn = icon.closest('button');
        if (btn) {
            btn.style.pointerEvents = "auto";
            btn.style.opacity = "";
        }
    });
}

function scrubChat() {
    if (!ZEN_MODE) return;
    const chatMsgs = document.querySelectorAll('.game-start-message-component, .game-over-message-component');
    chatMsgs.forEach(msg => {
        msg.childNodes.forEach(node => {
            if (node.nodeType === 3) { 
                let text = node.nodeValue;
                const projectionRegex = /win\s*[+-]\d+\s*\/\s*draw\s*[+-]\d+\s*\/\s*lose\s*[+-]\d+/i;
                if (projectionRegex.test(text)) text = text.replace(projectionRegex, '');
                const ratingChangeRegex = /\(\s*[+-]?\d+\s*\)/g;
                if (ratingChangeRegex.test(text)) text = text.replace(ratingChangeRegex, '');
                node.nodeValue = text;
            }
            if (node.nodeType === 1 && node.tagName === "STRONG") {
                const val = node.innerText.trim();
                if (/^\d{3,4}$/.test(val)) node.innerText = "---";
            }
        });
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
             clearCooldownState();
             unlockButton(); // This will now fully reset everything
             gameOverDetected = false;
        }
        else checkRating();
    }
    loadSettings();
});

})();
