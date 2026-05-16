document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const mainView = document.getElementById('mainView');
    const settingsView = document.getElementById('settingsView');
    const settingsBtn = document.getElementById('settingsBtn');
    const backBtn = document.getElementById('backBtn');
    const saveBtn = document.getElementById('saveSettingsBtn');
    const activateBtn = document.getElementById('activateBtn');
    const zenToggle = document.getElementById('hideRatings');
    const anonymizeOpponentToggle = document.getElementById('anonymizeOpponent');
    const anonymizeSelfToggle = document.getElementById('anonymizeSelf');
    const enhancedFocusToggle = document.getElementById('enhancedFocusMode');
    
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

    // 1. LOAD SAVED STATE
    chrome.storage.sync.get(null, (data) => {
        currentState = data;
        
        if (data.username) usernameInput.value = data.username;
        if (data.hideRatings) zenToggle.checked = data.hideRatings;
        if (data.anonymizeOpponent) anonymizeOpponentToggle.checked = data.anonymizeOpponent;
        if (data.anonymizeSelf) anonymizeSelfToggle.checked = data.anonymizeSelf;
        if (data.enhancedFocusMode) enhancedFocusToggle.checked = data.enhancedFocusMode;
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
    applySmartBtn.addEventListener('click', () => {
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
                args: [anonymizeOpponentToggle.checked, anonymizeSelfToggle.checked, enhancedFocusToggle.checked]
            }, () => {
                if (chrome.runtime.lastError) {
                    console.warn('EloGuard direct anonymizer failed:', chrome.runtime.lastError.message);
                }
            });

            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            }, () => {
                if (chrome.runtime.lastError) {
                    console.warn('EloGuard content refresh failed:', chrome.runtime.lastError.message);
                }
            });
        });
    }

    function applyDirectOpponentAnonymizer(opponentEnabled, selfEnabled, enhancedFocusEnabled) {
        const styleId = 'elo-guard-direct-anonymizer-style';
        let style = document.getElementById(styleId);

        if (!style) {
            style = document.createElement('style');
            style.id = styleId;
            document.head.appendChild(style);
        }

        style.textContent = `
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

        document.body.classList.toggle('elo-guard-enhanced-focus', Boolean(enhancedFocusEnabled));
        document.body.classList.toggle('elo-shield-anon-opponent', Boolean(opponentEnabled || enhancedFocusEnabled));
        document.body.classList.toggle('elo-shield-anon-self', Boolean(selfEnabled || enhancedFocusEnabled));
    }
});
