// Frontend/js/time-selector.js - Add extensive logging

let selectedTimeControl = TIME_CONTROLS.BLITZ_5.seconds;
let currentContainerId = null;
let isCreatingRoom = false;

function renderTimeSelector(containerId = 'timeOptionsContainer') {
    console.log('📋 renderTimeSelector called with:', containerId);
    
    const container = GameUtils.getElement(containerId);
    if (!container) {
        console.error('❌ Container not found:', containerId);
        return;
    }
    
    currentContainerId = containerId;
    const isPrivateRoom = containerId === 'privateRoomTimeSelector';
    
    console.log('📋 Is private room:', isPrivateRoom);
    
    container.innerHTML = `
        <div class="time-selector-container">
            <h3>⏱️ Select Time Control</h3>
            <div class="time-options" id="${containerId}-options">
                ${Object.keys(TIME_CONTROLS).map(key => {
                    const tc = TIME_CONTROLS[key];
                    const isDefault = tc.seconds === DEFAULT_TIME_CONTROL.seconds;
                    
                    return `
                        <button 
                            class="time-option-btn ${isDefault ? 'active' : ''}" 
                            data-seconds="${tc.seconds}"
                            data-mode="${isPrivateRoom ? 'private' : 'random'}">
                            <div class="time-icon">${tc.icon}</div>
                            <div class="time-label">${tc.name}</div>
                            <div class="time-desc">${tc.description}</div>
                        </button>
                    `;
                }).join('')}
            </div>
        </div>
    `;
    
    // Add proper event listeners (NOT inline onclick)
    const optionsContainer = GameUtils.getElement(`${containerId}-options`);
    if (optionsContainer) {
        console.log('📋 Adding click listener to options container');
        
        optionsContainer.addEventListener('click', (e) => {
            console.log('🖱️ Time option container clicked', e.target);
            
            const btn = e.target.closest('.time-option-btn');
            if (!btn) {
                console.log('⚠️ Click not on button, ignoring');
                return;
            }
            
            const seconds = parseInt(btn.dataset.seconds);
            const mode = btn.dataset.mode;
            
            console.log(`🖱️ Time control button clicked: ${seconds}s, mode: ${mode}`);
            
            if (mode === 'private') {
                console.log('→ Calling selectTimeAndCreateRoom');
                selectTimeAndCreateRoom(seconds);
            } else {
                console.log('→ Calling selectTimeControl');
                selectTimeControl(seconds);
            }
        });
    } else {
        console.error('❌ Options container not found!');
    }
    
    console.log('✅ Time selector rendered in:', containerId);
}

function selectTimeControl(seconds) {
    console.log('⏱️ selectTimeControl called with:', seconds);
    
    // Just update selection, DON'T join matchmaking yet
    selectedTimeControl = seconds;
    
    // Update UI
    document.querySelectorAll('.time-option-btn').forEach(btn => {
        btn.classList.remove('active');
        if (parseInt(btn.dataset.seconds) === seconds) {
            btn.classList.add('active');
        }
    });
    
    const tc = Object.values(TIME_CONTROLS).find(t => t.seconds === seconds);
    console.log(`✅ Time control selected: ${tc.name} (${seconds}s)`);
    
    // Update status message
    if (window.uiManager) {
        window.uiManager.updateSearchStatus(`Selected ${tc.name}. Click "Find Match" to start.`);
    } else {
        console.warn('⚠️ UIManager not available');
    }
}

function selectTimeAndCreateRoom(seconds) {
    console.log('🔐 selectTimeAndCreateRoom called with:', seconds);
    
    // Prevent double-click
    if (isCreatingRoom) {
        console.warn('⚠️ Already creating room, please wait...');
        return;
    }
    
    isCreatingRoom = true;
    selectedTimeControl = seconds;
    
    const tc = Object.values(TIME_CONTROLS).find(t => t.seconds === seconds);
    console.log(`⏱️ Creating private room with: ${tc.name} (${seconds}s)`);
    
    // Show loading state
    if (window.uiManager) {
        window.uiManager.showLoading(currentContainerId || 'privateRoomTimeSelector', 'Creating room...');
    }
    
    // Create room with selected time
    window.socketClient.createPrivateRoom(seconds);
    
    // Reset flag after timeout (safety)
    setTimeout(() => {
        console.log('🔓 Reset isCreatingRoom flag');
        isCreatingRoom = false;
    }, 5000);
}

function getSelectedTimeControl() {
    console.log('📊 getSelectedTimeControl called, returning:', selectedTimeControl);
    return selectedTimeControl;
}

function resetCreateRoomFlag() {
    console.log('🔄 resetCreateRoomFlag called');
    isCreatingRoom = false;
}

// Export for external use
if (typeof window !== 'undefined') {
    window.resetCreateRoomFlag = resetCreateRoomFlag;
}