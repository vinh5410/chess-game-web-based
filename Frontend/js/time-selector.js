// Frontend/js/time-selector.js

let selectedTimeControl = TIME_CONTROLS.BLITZ_5.seconds;
let currentContainerId = null;

function renderTimeSelector(containerId = 'timeOptionsContainer') {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('Container not found:', containerId);
        return;
    }
    
    currentContainerId = containerId;
    const isPrivateRoom = containerId === 'privateRoomTimeSelector';
    
    container.innerHTML = `
        <div class="time-selector-container">
            <h3>⏱️ Select Time Control</h3>
            <div class="time-options">
                ${Object.keys(TIME_CONTROLS).map(key => {
                    const tc = TIME_CONTROLS[key];
                    const isDefault = tc.seconds === DEFAULT_TIME_CONTROL.seconds;
                    
                    return `
                        <button 
                            class="time-option-btn ${isDefault ? 'active' : ''}" 
                            data-seconds="${tc.seconds}"
                            onclick="${isPrivateRoom ? `selectTimeAndCreateRoom(${tc.seconds})` : `selectTimeControl(${tc.seconds})`}">
                            <div class="time-icon">${tc.icon}</div>
                            <div class="time-label">${tc.name}</div>
                            <div class="time-desc">${tc.description}</div>
                        </button>
                    `;
                }).join('')}
            </div>
        </div>
    `;
    
    console.log('Time selector rendered in:', containerId);
}

function selectTimeControl(seconds) {
    selectedTimeControl = seconds;
    
    // Update UI
    document.querySelectorAll('.time-option-btn').forEach(btn => {
        btn.classList.remove('active');
        if (parseInt(btn.dataset.seconds) === seconds) {
            btn.classList.add('active');
        }
    });
    
    const tc = Object.values(TIME_CONTROLS).find(t => t.seconds === seconds);
    console.log(`⏱️ Time control selected: ${tc.name}`);
}

function selectTimeAndCreateRoom(seconds) {
    selectedTimeControl = seconds;
    const tc = Object.values(TIME_CONTROLS).find(t => t.seconds === seconds);
    console.log(`⏱️ Creating private room with: ${tc.name} (${seconds}s)`);
    
    // Show loading state
    const container = document.getElementById(currentContainerId || 'privateRoomTimeSelector');
    if (container) {
        container.innerHTML = `
            <div class="loading-state">
                <p>⏳ Creating room...</p>
            </div>
        `;
    }
    
    // Create room with selected time
    window.socketClient.createPrivateRoom(seconds);
}

function getSelectedTimeControl() {
    return selectedTimeControl;
}