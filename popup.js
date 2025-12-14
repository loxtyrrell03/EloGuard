document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const mainView = document.getElementById('mainView');
    const settingsView = document.getElementById('settingsView');
    const settingsBtn = document.getElementById('settingsBtn');
    const backBtn = document.getElementById('backBtn');
    const saveBtn = document.getElementById('saveSettingsBtn');
    const activateBtn = document.getElementById('activateBtn');
    const zenToggle = document.getElementById('hideRatings');
    
    // Cooldown UI
    const cooldownToggle = document.getElementById('cooldownActive');
    const cooldownInput = document.getElementById('cooldownSeconds');

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
        if (data.guardActive) setGuardActiveUI(true);
        if (data.gameMode) activeMode = data.gameMode;
        
        // Cooldown State
        if (data.cooldownActive) cooldownToggle.checked = data.cooldownActive;
        if (data.cooldownSeconds) cooldownInput.value = data.cooldownSeconds;
        
        if (data.maskPopupRating) {
            isRatingHidden = true;
            updateRatingVisibility();
        }

        // Set Initial Mode UI
        gameModeSelect.value = activeMode;
        updateModeUI(activeMode);
        
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
        
        // Update UI logic (Calculates Smart Bracket if needed)
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

        // 2. Handle Inputs (Smart Bracket vs Saved)
        const smartRange = parseInt(smartRangeInput.value);
        
        if (smartRange && smartRange > 0) {
            const cachedText = statsRefs[mode].innerText;
            const cachedRating = parseInt(cachedText);

            if (!isNaN(cachedRating)) {
                stopLossInput.value = cachedRating - smartRange;
                targetRatingInput.value = cachedRating + smartRange;
            } else {
                loadSavedValuesForMode(mode);
            }
        } else {
            loadSavedValuesForMode(mode);
        }
        
        // NEW: Update the display under the rating
        updateMainViewStats();
    }

    function loadSavedValuesForMode(mode) {
        const savedStop = currentState[`stopLoss_${mode}`] || "";
        const savedTarget = currentState[`targetRating_${mode}`] || "";
        stopLossInput.value = savedStop;
        targetRatingInput.value = savedTarget;
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
        const newState = !isCurrentlyActive;
        setGuardActiveUI(newState);
        chrome.storage.sync.set({ guardActive: newState });
    });

    zenToggle.addEventListener('change', () => {
        chrome.storage.sync.set({ hideRatings: zenToggle.checked });
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
        const cdActive = cooldownToggle.checked;
        const cdSeconds = cooldownInput.value;
        
        let updateData = { 
            username, 
            gameMode: activeMode,
            cooldownActive: cdActive,
            cooldownSeconds: cdSeconds
        };
        
        updateData[`stopLoss_${activeMode}`] = stopLoss;
        updateData[`targetRating_${activeMode}`] = targetRating;

        currentState = { ...currentState, ...updateData };

        chrome.storage.sync.set(updateData, () => {
            updateMainViewStats(); // Update display on save
            
            saveBtn.innerText = "✅ Saved!";
            setTimeout(() => saveBtn.innerText = "Save Settings", 1500);
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
            
            const smartRange = parseInt(smartRangeInput.value);
            if (smartRange > 0 && settingsView.classList.contains('hidden') === false) {
                 updateModeUI(activeMode); 
            }
            
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
});