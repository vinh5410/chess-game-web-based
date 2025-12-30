class UIManager {
    constructor() {
        // Screen IDs for multiplayer
        this.multiplayerScreens = [
            'loginScreen',
            'lobbyScreen', 
            'randomMatchScreen',
            'inviteFriendScreen',
            'joinRoomScreen',
            'gameScreen'
        ];
        
        // Screen IDs for bot game
        this.botScreens = [
            'mainMenu',
            'colorMenu',
            'difficultyMenu'
        ];
        
        // Cached elements (will be populated on demand)
        this.elementCache = new Map();
    }
    
    
    
    getElement(id) {
        if (!this.elementCache.has(id)) {
            const el = document.getElementById(id);
            if (el) {
                this.elementCache.set(id, el);
            }
        }
        return this.elementCache.get(id);
    }
    
    clearCache() {
        this.elementCache.clear();
    }
    
    
    
    hideAllScreens(type = 'multiplayer') {
        const screens = type === 'multiplayer' ? this.multiplayerScreens : this.botScreens;
        screens.forEach(screenId => {
            GameUtils.addClass(screenId, 'hidden');
        });
    }
    
    showScreen(screenId, type = 'multiplayer') {
        this.hideAllScreens(type);
        GameUtils.removeClass(screenId, 'hidden');
    }
    
    toggleScreen(screenId) {
        GameUtils.toggleClass(screenId, 'hidden');
    }
    
    
    
    updateGameStatus(message) {
        GameUtils.setTextContent('gameStatus', message);
    }
    
    clearGameStatus() {
        this.updateGameStatus('');
    }
    
    
    
    updateOnlineCount(count) {
        GameUtils.setTextContent('onlineUsers', `👥 Online: ${count}`);
    }
    
    renderOnlineUsers(users, currentUserId, onInviteClick) {
        const container = this.getElement('usersContainer');
        if (!container) return;
        
        container.innerHTML = '';
        
        users.forEach(user => {
            if (user.id !== currentUserId) {
                const userDiv = document.createElement('div');
                userDiv.className = 'user-item';
                userDiv.innerHTML = `
                    <span class="user-name">${GameUtils.escapeHtml(user.username)}</span>
                    <button class="invite-btn" data-user-id="${user.id}">Invite</button>
                `;
                
                const inviteBtn = userDiv.querySelector('.invite-btn');
                inviteBtn.addEventListener('click', () => onInviteClick(user.id));
                
                container.appendChild(userDiv);
            }
        });
    }
    
    
    
    showGameOver(message) {
        GameUtils.setTextContent('winnerText', message);
        GameUtils.removeClass('gameOverOverlay', 'hidden');
    }
    
    hideGameOver() {
        GameUtils.addClass('gameOverOverlay', 'hidden');
    }
    
    
    
    showLoading(containerId, message = 'Loading...') {
        GameUtils.setHTML(containerId, `
            <div class="loading-state">
                <p>⏳ ${GameUtils.escapeHtml(message)}</p>
            </div>
        `);
    }
    
    clearLoading(containerId) {
        GameUtils.setHTML(containerId, '');
    }
    
    
    
    updateTimer(elementId, seconds) {
        GameUtils.setTextContent(elementId, GameUtils.formatTime(seconds));
    }
    
    
    
    updatePlayerInfo(elementId, name, color) {
        GameUtils.setTextContent(elementId, name);
        const colorIcon = color === 'white' ? '♔ White' : '♚ Black';
        GameUtils.setTextContent(`${elementId.replace('Name', 'Color')}`, colorIcon);
    }
    
    
    
    updateBotLevel(level, emoji) {
        GameUtils.setTextContent('botLevelInfo', `Playing vs Bot Level ${level} ${emoji}`);
    }
    
    updatePlayerColor(color) {
        const colorIcon = color === 'white' ? '♔' : '♚';
        const colorName = GameUtils.capitalize(color);
        GameUtils.setTextContent('playerColorInfo', `You are ${colorName} ${colorIcon}`);
    }
    
    showBotControls() {
        GameUtils.removeClass('gameControls', 'hidden');
        GameUtils.removeClass('chessboardContainer', 'hidden');
    }
    
    hideBotControls() {
        GameUtils.addClass('gameControls', 'hidden');
        GameUtils.addClass('chessboardContainer', 'hidden');
    }
    
    
    
    showRoomCode(code) {
        GameUtils.setValue('roomCodeDisplay', code);
        GameUtils.removeClass('roomCodeSection', 'hidden');
    }
    
    hideRoomCode() {
        GameUtils.addClass('roomCodeSection', 'hidden');
    }
    
    async copyRoomCode() {
        const code = GameUtils.getValue('roomCodeDisplay');
        const success = await GameUtils.copyToClipboard(code);
        
        if (success) {
            const copyBtn = document.querySelector('.copy-btn');
            if (copyBtn) {
                const originalText = copyBtn.textContent;
                copyBtn.textContent = '✅ Copied!';
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                }, 2000);
            }
        } else {
            GameUtils.showAlert('Failed to copy room code');
        }
    }
    
    
    
    updateSearchStatus(message) {
        GameUtils.setTextContent('searchStatus', message);
    }
    
    
    
    addChatMessage(username, message, isSelf = false) {
        const chatMessages = this.getElement('chatMessages');
        if (!chatMessages) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${isSelf ? 'own' : 'other'}`;
        messageDiv.innerHTML = `
            <div class="sender">${GameUtils.escapeHtml(username)}</div>
            <div class="text">${GameUtils.escapeHtml(message)}</div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    clearChatInput() {
        GameUtils.setValue('chatInput', '');
    }
}

// Create global instance
window.uiManager = new UIManager();
console.log('UIManager loaded');