let STOP_LOSS = 0;
let TARGET_RATING = 0;
let USERNAME = "";
let ZEN_MODE = false;
let GAME_MODE = "blitz"; 
let GUARD_ACTIVE = false; // Renamed
let hasSpoken = false;

// 1. Initialize
function loadSettings() {
    chrome.storage.sync.get(null, (data) => {
        if (data.username) {
            USERNAME = data.username;
            ZEN_MODE = data.hideRatings || false;
            GAME_MODE = data.gameMode || "blitz";
            GUARD_ACTIVE = data.guardActive || false; 

            const stopKey = `stopLoss_${GAME_MODE}`;
            const targetKey = `targetRating_${GAME_MODE}`;

            STOP_LOSS = parseInt(data[stopKey]) || 0;
            TARGET_RATING = parseInt(data[targetKey]) || 0;

            console.log(`🛡️ EloGuard: ${USERNAME} | Mode: ${GAME_MODE} | Active: ${GUARD_ACTIVE}`);
            
            applyZenMode();
            
            if (!GUARD_ACTIVE) {
                unlockButton();
            } else {
                checkRating();
            }
        }
    });
}
loadSettings();

// Polling
setInterval(() => {
    if (GUARD_ACTIVE) checkRating();
}, 2000); 
setInterval(scrubChat, 500);

// 2. Check Rating
async function checkRating() {
    if (!USERNAME || !GUARD_ACTIVE) return; 

    try {
        const response = await fetch(`https://api.chess.com/pub/player/${USERNAME}/stats`);
        const data = await response.json();
        
        const modeData = data[`chess_${GAME_MODE}`];
        const currentRating = modeData?.last?.rating;

        if (!currentRating) return;

        if (STOP_LOSS > 0 && currentRating <= STOP_LOSS) {
            lockOut(currentRating, "stop");
        } 
        else if (TARGET_RATING > 0 && currentRating >= TARGET_RATING) {
            lockOut(currentRating, "win");
        }
        else {
            hasSpoken = false;
            unlockButton(); 
        }
    } catch (e) {
        // Silent fail
    }
}

// 3. The Lockout
function lockOut(rating, type) {
    if (!GUARD_ACTIVE) return; 

    const selectors = [
        '[data-cy="new-game-index-play"]', 
        '[data-cy="game-over-modal-new-game-button"]',
        '[data-cy="game-over-modal-rematch-button"]',
        '[data-cy="sidebar-rematch-button"]' 
    ];

    const isWin = type === "win";
    const titleText = isWin ? `🏆 GOAL HIT (${rating})` : `🛑 STOP (${rating})`;
    const subText = isWin 
        ? `Target of ${TARGET_RATING} reached! (${GAME_MODE})`
        : `Stop Loss Hit. Walk away. (${GAME_MODE})`;
    const color = isWin ? "#4CAF50" : "#ff4d4d"; 

    let foundBtn = false;

    selectors.forEach(sel => {
        const els = document.querySelectorAll(sel);
        els.forEach(btn => {
            if (btn.tagName !== "BUTTON") {
                const innerBtn = btn.querySelector('button');
                if (innerBtn) btn = innerBtn;
                else return;
            }

            // Updated class name to elo-guard-locked
            if (!btn.classList.contains('elo-guard-locked')) {
                foundBtn = true;
                btn.classList.add('elo-guard-locked');
                
                if (!btn.getAttribute('data-original-text')) {
                    btn.setAttribute('data-original-text', btn.innerText);
                }

                btn.innerHTML = `
                    <div class="elo-shield-content">
                        <span class="elo-shield-title">${titleText}</span>
                        <span class="elo-shield-subtitle">${subText}</span>
                    </div>
                `;

                btn.style.backgroundColor = "#262626"; 
                btn.style.color = color;
                btn.style.borderColor = color;
                btn.style.pointerEvents = "none"; 
                
                const newBtn = btn.cloneNode(true);
                if (btn.parentNode) btn.parentNode.replaceChild(newBtn, btn);
            }
        });
    });

    if (foundBtn && !hasSpoken) {
        speak(isWin ? "Target hit. Well done." : "Stop loss hit. Walk away.");
        hasSpoken = true;
    }
}

// 4. Chat Scrubber
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

// 5. Unlocker
function unlockButton() {
    const lockedBtns = document.querySelectorAll('.elo-guard-locked');
    if (lockedBtns.length > 0) {
        lockedBtns.forEach(btn => {
            btn.classList.remove('elo-guard-locked');
            btn.style.pointerEvents = "auto";
            
            const originalText = btn.getAttribute('data-original-text');
            if (originalText) {
                btn.innerText = originalText;
            } else {
                btn.innerHTML = "Play"; 
            }
            
            btn.style.color = ""; 
            btn.style.borderColor = "";
            btn.style.backgroundColor = ""; 
            
            const newBtn = btn.cloneNode(true);
            if (btn.parentNode) btn.parentNode.replaceChild(newBtn, btn);
        });
    }
}

// 6. Utilities
function applyZenMode() {
    if (ZEN_MODE) document.body.classList.add('elo-shield-zen');
    else document.body.classList.remove('elo-shield-zen');
    if (ZEN_MODE) scrubChat();
}

function speak(text) {
    if (!window.speechSynthesis) return;
    const msg = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(msg);
}

// 7. Watch for Changes
chrome.storage.onChanged.addListener((changes) => {
    if (changes.guardActive) {
        GUARD_ACTIVE = changes.guardActive.newValue;
        if (!GUARD_ACTIVE) unlockButton();
        else checkRating();
    }
    loadSettings();
});