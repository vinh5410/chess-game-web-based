// 📁 Frontend/js/play-multiplayer.js - Refactored với utilities

class MultiplayerChess extends ChessBoardRenderer {
    constructor() {
        super('chessCanvas');
        
        // Multiplayer-specific state
        this.playerColor = null;
        this.opponentName = '';
        this.isMyTurn = false;
        this.gameStarted = false;
        this.gameOver = false;
        this.lastMove = null;
        
        // Timer
        this.playerTime = 300;
        this.opponentTime = 300;
        this.timerInterval = null;
        
        // Socket client & UI Manager
        this.socket = window.socketClient;
        this.ui = window.uiManager;
        
        this.lastMoveColor = 'rgba(255, 255, 0, 0.3)';
    }
    
    async init() {
        console.log('🎮 Initializing Multiplayer Chess...');
        
        // Reset flags on init
        this.socket.isInMatchmaking = false;
        
        if (typeof window.Chess !== 'function') {
            console.error('❌ Chess.js not available');
            return false;
        }
        await this.loadPieceImages();
        this.setupEventListeners();
        
        console.log('🔌 Connecting to socket...');
        this.socket.connect();
        
        // Wait for socket connection
        await new Promise((resolve) => {
            const checkConnection = () => {
                if (this.socket.isConnected() && this.socket.socket) {
                    console.log('✅ Socket connected:', this.socket.socket.id);
                    resolve();
                } else {
                    setTimeout(checkConnection, 100);
                }
            };
            checkConnection();
        });
        
        console.log('🔌 Setting up socket listeners...');
        this.setupSocketListeners();
        
        console.log('✅ Multiplayer Chess initialized');
        return true;
    }
    
    // ==================== EVENT LISTENERS ====================
    
    setupEventListeners() {
        super.setupEventListeners();
        
        // Chat input enter key
        const chatInput = GameUtils.getElement('chatInput');
        if (chatInput) {
            window.eventManager.on(chatInput, 'keypress', (e) => {
                if (e.key === 'Enter') sendMessage();
            });
        }
        
        // Username input enter key
        const usernameInput = GameUtils.getElement('usernameInput');
        if (usernameInput) {
            window.eventManager.on(usernameInput, 'keypress', (e) => {
                if (e.key === 'Enter') login();
            });
        }
    }
    
    // ==================== OVERRIDE TEMPLATE METHODS ====================
    
    canInteract() {
        return this.gameStarted && !this.gameOver && this.isMyTurn;
    }
    
    getPlayerColor() {
        return this.playerColor.charAt(0);
    }
    
    afterMove(move) {
        // Called after successful move from base class
        this.lastMove = { from: move.from, to: move.to };
        this.isMyTurn = false;
        
        this.socket.makeMove(move.san);
        
        this.draw(); // Redraw to show lastMove
        this.ui.updateGameStatus('Opponent\'s turn');
        
        this.checkGameOver();
    }
    
    // ==================== DRAWING ====================
    
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawBoard();
        this.drawCoordinates();
        this.drawLastMove();
        this.drawHighlights();
        this.drawPieces();
        this.drawDragPiece();
    }
    
    drawLastMove() {
        if (!this.lastMove) return;
        
        const fromPos = this.squareToCanvas(this.lastMove.from);
        const toPos = this.squareToCanvas(this.lastMove.to);
        
        this.ctx.fillStyle = this.lastMoveColor;
        this.ctx.fillRect(fromPos.x, fromPos.y, this.squareSize, this.squareSize);
        this.ctx.fillRect(toPos.x, toPos.y, this.squareSize, this.squareSize);
    }
    
    // ==================== SOCKET LISTENERS ====================
    
    setupSocketListeners() {
        const io = this.socket.socket;
        
        if (!io) {
            console.error('❌ Socket.IO instance not found!');
            return;
        }
        
        console.log('✅ Socket.IO instance found:', io.id);
        io.removeAllListeners();
        
        io.on('user:login_success', (data) => this.onLoginSuccess(data));
        io.on('user:login_error', (data) => {
            console.error('❌ Login error:', data);
            GameUtils.showAlert(data.message || 'Login failed');
        });
        io.on('users:update', (data) => this.updateOnlineUsers(data.users));
        
        // ==================== MATCHMAKING LISTENERS ====================
        
        io.on('matchmaking:match_found', (data) => {
            console.log('🎉 Match found!', data);
            this.socket.isInMatchmaking = false;
            
            const searchBtn = GameUtils.getElement('searchBtn');
            if (searchBtn) {
                searchBtn.disabled = false;
                searchBtn.textContent = '🔍 Find Match';
            }
            
            this.onMatchFound(data);
        });
        
        io.on('matchmaking:waiting', (data) => {
            console.log('⏳ Waiting for match...', data);
            this.ui.updateSearchStatus(`Searching... (${data.queue} players in queue)`);
        });
        
        io.on('matchmaking:left', () => {
            console.log('✅ Left matchmaking queue');
            this.socket.isInMatchmaking = false;
            
            const searchBtn = GameUtils.getElement('searchBtn');
            if (searchBtn) {
                searchBtn.disabled = false;
                searchBtn.textContent = '🔍 Find Match';
            }
        });
        
        io.on('matchmaking:error', (data) => {
            console.error('❌ Matchmaking error:', data);
            GameUtils.showAlert(data.message);
            this.socket.isInMatchmaking = false;
            
            const searchBtn = GameUtils.getElement('searchBtn');
            if (searchBtn) {
                searchBtn.disabled = false;
                searchBtn.textContent = '🔍 Find Match';
            }
        });
        
        io.on('matchmaking:opponent_disconnected', (data) => {
            console.log('⚠️ Opponent disconnected, continuing search...');
            this.ui.updateSearchStatus('Opponent disconnected, searching again...');
        });
        
        // ==================== ROOM LISTENERS ====================
        
        io.on('room:created', (data) => {
            if (typeof resetCreateRoomFlag === 'function') {
                resetCreateRoomFlag();
            }
            this.onRoomCreated(data);
        });
        
        io.on('room:joined', (data) => this.onRoomJoined(data));
        io.on('room:error', (data) => {
            if (typeof resetCreateRoomFlag === 'function') {
                resetCreateRoomFlag();
            }
            console.error('❌ Room error:', data);
            GameUtils.showAlert(data.message || 'Room error');
        });
        
        io.on('room:opponent_joined', (data) => this.onOpponentJoined(data));
        io.on('room:opponent_left', (data) => this.onOpponentLeft(data));
        
        io.on('game:start', (data) => this.onGameStart(data));
        io.on('game:move', (data) => this.onOpponentMove(data));
        io.on('game:invalid_move', (data) => {
            console.error('❌ Invalid move:', data);
            GameUtils.showAlert('Invalid move!');
        });
        io.on('game:over', (data) => this.onGameOver(data));
        io.on('game:draw_offer', (data) => this.onDrawOffer(data));
        io.on('game:draw_accepted', (data) => this.onDrawAccepted(data));
        io.on('game:draw_declined', () => GameUtils.showAlert('Draw offer declined'));
        io.on('chat:message', (data) => this.onChatMessage(data));
        
        console.log('✅ All socket listeners registered');
    }
    
    // ==================== SOCKET EVENT HANDLERS ====================
    
    onLoginSuccess(data) {
        console.log('✅ Login success:', data);
        this.ui.showScreen('lobbyScreen');
        this.ui.updateGameStatus(`Welcome, ${data.username}!`);
    }
    
    updateOnlineUsers(users) {
        console.log('📊 Updating online users:', users.length);
        
        this.ui.updateOnlineCount(users.length);
        
        this.ui.renderOnlineUsers(users, this.socket.getUserId(), (userId) => {
            GameUtils.showAlert('Direct invitation feature coming soon!');
        });
    }
    
    onMatchFound(data) {
        console.log('🎉 Match found:', data.opponent);
        this.socket.setCurrentRoom(data.roomId);
        
        this.ui.hideGameOver();
        this.ui.showScreen('gameScreen');
        this.ui.updateGameStatus('Match found! Starting game...');
    }
    
    onRoomCreated(data) {
        console.log('✅ Room created:', data);
        this.socket.setCurrentRoom(data.roomId);
        
        this.ui.showScreen('inviteFriendScreen');
        GameUtils.hide('privateRoomTimeSelector');
        this.ui.showRoomCode(data.roomCode);
        this.ui.updateGameStatus(`Room created! Share code: ${data.roomCode}`);
    }
    
    onRoomJoined(data) {
        console.log('🔗 Joined room:', data.roomId);
        this.socket.setCurrentRoom(data.roomId);
        this.ui.showScreen('gameScreen');
    }
    
    onOpponentJoined(data) {
        console.log('👥 Opponent joined:', data.opponent);
        this.opponentName = data.opponent.username;
        
        this.ui.showScreen('gameScreen');
        this.ui.hideGameOver();
        this.ui.updateGameStatus('Opponent joined! Game starting...');
    }
    
    onOpponentLeft(data) {
        console.log('👋 Opponent left');
        GameUtils.showAlert('Opponent left the game');
        this.gameOver = true;
        this.ui.updateGameStatus('Opponent left the game');
    }
    
    onGameStart(data) {
        console.log('🎮 Game started!', data);
        
        this.playerColor = data.color;
        this.opponentName = data.opponent.username;
        this.isMyTurn = (data.color === 'white');
        this.gameStarted = true;
        this.gameOver = false;
        this.isFlipped = (this.playerColor === 'black');
        
        if (data.timeControl) {
            this.playerTime = data.timeControl.initial;
            this.opponentTime = data.timeControl.initial;
            console.log(`⏱️ Timer set to: ${data.timeControl.initial}s`);
        } else {
            this.playerTime = 300;
            this.opponentTime = 300;
        }
        
        this.ui.hideGameOver();
        
        GameUtils.setTextContent('playerName', this.socket.getUsername() || 'You');
        GameUtils.setTextContent('opponentName', this.opponentName);
        
        const playerColorIcon = this.playerColor === 'white' ? '♔ White' : '♚ Black';
        const opponentColorIcon = this.playerColor === 'white' ? '♚ Black' : '♔ White';
        GameUtils.setTextContent('playerColor', playerColorIcon);
        GameUtils.setTextContent('opponentColor', opponentColorIcon);
        
        this.game = new window.Chess();
        this.selectedSquare = null;
        this.legalMoves = [];
        this.lastMove = null;
        
        this.updateTimerDisplay();
        this.startTimer();
        this.draw();
        
        this.ui.updateGameStatus(this.isMyTurn ? 'Your turn!' : 'Opponent\'s turn');
    }
    
    onOpponentMove(data) {
        console.log('♟️ Opponent move:', data.move);
        
        try {
            const move = this.game.move(data.move);
            if (move) {
                this.lastMove = { from: move.from, to: move.to };
                this.isMyTurn = true;
                this.draw();
                this.ui.updateGameStatus('Your turn!');
                
                this.checkGameOver();
            }
        } catch (error) {
            console.error('Error applying opponent move:', error);
        }
    }
    
    onGameOver(data) {
        console.log('🏁 Game over:', data);
        this.gameOver = true;
        this.gameStarted = false;
        this.stopTimer();
        
        let result = '';
        if (data.reason === 'checkmate') {
            result = data.winner === this.playerColor ? 'You win by checkmate! 👑' : 'You lost by checkmate';
        } else if (data.reason === 'resignation') {
            result = data.winner === this.playerColor ? 'Opponent resigned. You win! 👑' : 'You resigned';
        } else if (data.reason === 'draw') {
            result = 'Game drawn! 🤝';
        } else if (data.reason === 'timeout') {
            result = data.winner === this.playerColor ? 'Opponent ran out of time. You win! ⏰' : 'Time out. You lost ⏰';
        }
        
        this.ui.showGameOver(result);
    }
    
    onDrawOffer(data) {
        const accept = GameUtils.showConfirm(`${data.from} offers a draw. Accept?`);
        this.socket.respondDraw(accept);
    }
    
    onDrawAccepted(data) {
        this.gameOver = true;
        this.gameStarted = false;
        this.stopTimer();
        this.ui.showGameOver('Game drawn by agreement! 🤝');
    }
    
    onChatMessage(data) {
        const isSelf = data.sender === this.socket.getUserId();
        this.ui.addChatMessage(data.username, data.message, isSelf);
    }
    
    // ==================== GAME CONTROL ====================
    
    checkGameOver() {
        if (this.game.isGameOver()) {
            this.gameOver = true;
            this.gameStarted = false;
            return true;
        }
        return false;
    }
    
    // ==================== TIMER ====================
    
    startTimer() {
        this.stopTimer();
        
        this.timerInterval = setInterval(() => {
            if (this.isMyTurn) {
                this.playerTime--;
                if (this.playerTime <= 0) {
                    this.playerTime = 0;
                    this.stopTimer();
                }
            } else {
                this.opponentTime--;
                if (this.opponentTime <= 0) {
                    this.opponentTime = 0;
                    this.stopTimer();
                }
            }
            this.updateTimerDisplay();
        }, 1000);
    }
    
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
    
    updateTimerDisplay() {
        this.ui.updateTimer('playerTimer', this.playerTime);
        this.ui.updateTimer('opponentTimer', this.opponentTime);
    }
}

// ==================== UI FUNCTIONS (Simplified) ====================

let gameInstance = null;

function updateGameStatus(message) {
    if (window.uiManager) {
        window.uiManager.updateGameStatus(message);
    } else {
        console.warn('UIManager not ready');
    }
}

function hideAllScreens() {
    if (window.uiManager) {
        window.uiManager.hideAllScreens();
    } else {
        console.warn('UIManager not ready');
    }
}

function login() {
    console.log('🔐 Login button clicked');
    
    const user = getCurrentUser();
    const username = user ? user.username : GameUtils.getValue('usernameInput').trim();
    
    const validation = GameUtils.validateUsername(username);
    if (!validation.valid) {
        GameUtils.showAlert(validation.error);
        return;
    }
    
    console.log('👤 Attempting to login as:', username);
    window.socketClient.login(username);
}

function logout() {
    window.socketClient.logout();
    window.uiManager.showScreen('loginScreen');
    updateGameStatus('Logged out');
}

function showRandomMatch() {
    console.log('🎲 showRandomMatch called');
    console.log('   UIManager available:', !!window.uiManager);
    console.log('   renderTimeSelector available:', typeof renderTimeSelector);
    
    window.uiManager.showScreen('randomMatchScreen');
    
    console.log('   Calling renderTimeSelector...');
    renderTimeSelector('randomMatchTimeSelector');
    
    console.log('   Updating game status...');
    updateGameStatus('Select time control and click Find Match');
    
    console.log('✅ showRandomMatch completed');
}

function startRandomSearch() {
    console.log('🔍 START RANDOM SEARCH FUNCTION CALLED');
    
    if (!window.socketClient || !window.uiManager) {
        alert('Game not ready. Please refresh the page.');
        return;
    }
    
    const timeControl = getSelectedTimeControl();
    console.log('🎲 Requested time control:', timeControl);
    
    // If already searching, cancel first
    if (window.socketClient.isInMatchmaking) {
        console.log('⚠️ Already in queue, cancelling first...');
        window.socketClient.cancelRandomMatch();
        // Don't reset flag here - let backend event handler do it
    }
    
    // Start search immediately (backend will handle if still in queue)
    startActualSearch(timeControl);
}

function startActualSearch(timeControl) {
    console.log('🚀 Starting search with:', timeControl);
    
    window.uiManager.updateSearchStatus('Searching for opponent...');
    
    const searchBtn = GameUtils.getElement('searchBtn');
    if (searchBtn) {
        searchBtn.disabled = true;
        searchBtn.textContent = '⏳ Searching...';
    }
    
    window.socketClient.findRandomMatch(timeControl);
    console.log('✅ Search started');
}

function cancelSearch() {
    console.log('❌ CANCEL SEARCH FUNCTION CALLED');
    
    // Reset flag immediately
    window.socketClient.isInMatchmaking = false;
    
    // Reset button state immediately
    const searchBtn = GameUtils.getElement('searchBtn');
    if (searchBtn) {
        searchBtn.disabled = false;
        searchBtn.textContent = '🔍 Find Match';
    }
    
    // Re-enable time control buttons
    const timeButtons = document.querySelectorAll('.time-btn');
    timeButtons.forEach(btn => btn.disabled = false);
    
    // EMIT CANCEL EVENT FIRST
    console.log('📤 Emitting matchmaking:leave to backend...');
    window.socketClient.cancelRandomMatch();
    
    // Wait a bit for socket to emit before navigating
    setTimeout(() => {
        console.log('🏠 Returning to lobby...');
        backToLobby();
        console.log('❌ CANCEL SEARCH COMPLETED');
    }, 100);
}

function showInviteFriend() {
    window.uiManager.showScreen('inviteFriendScreen');
    window.uiManager.hideRoomCode();
    
    GameUtils.show('privateRoomTimeSelector');
    GameUtils.setHTML('privateRoomTimeSelector', '');
    
    renderTimeSelector('privateRoomTimeSelector');
    updateGameStatus('Select time control to create room');
}

function cancelInvite() {
    window.socketClient.leaveRoom();
    window.uiManager.hideRoomCode();
    GameUtils.show('privateRoomTimeSelector');
    GameUtils.setHTML('privateRoomTimeSelector', '');
    backToLobby();
}

function copyRoomCode() {
    window.uiManager.copyRoomCode();
}

function showJoinRoom() {
    window.uiManager.showScreen('joinRoomScreen');
}

function joinRoom() {
    const roomCode = GameUtils.getValue('roomCodeInput').trim().toUpperCase();
    
    const validation = GameUtils.validateRoomCode(roomCode);
    if (!validation.valid) {
        GameUtils.showAlert(validation.error);
        return;
    }
    
    window.socketClient.joinPrivateRoom(roomCode);
}
function backToLobby() {
    window.socketClient.isInMatchmaking = false;
    
    const searchBtn = GameUtils.getElement('searchBtn');
    if (searchBtn) {
        searchBtn.disabled = false;
        searchBtn.textContent = '🔍 Find Match';
    }
    
    // Re-enable time control buttons
    const timeButtons = document.querySelectorAll('.time-btn');
    timeButtons.forEach(btn => btn.disabled = false);
    
    // Only call leaveRoom if in a room (check property directly)
    if (window.socketClient.currentRoom) {
        window.socketClient.leaveRoom();
    }
    
    window.uiManager.updateSearchStatus('Click button to start searching');
    window.uiManager.showScreen('lobbyScreen');
    updateGameStatus('Choose game mode');
}
function offerDraw() {
    if (GameUtils.showConfirm('Offer draw to opponent?')) {
        window.socketClient.offerDraw();
    }
}

function resign() {
    if (GameUtils.showConfirm('Are you sure you want to resign?')) {
        window.socketClient.resign();
    }
}

function flipBoard() {
    if (gameInstance) {
        gameInstance.flipBoard();
    }
}

function sendMessage() {
    const message = GameUtils.getValue('chatInput').trim();
    
    const validation = GameUtils.validateMessage(message);
    if (!validation.valid) {
        if (message.length > 0) {
            GameUtils.showAlert(validation.error);
        }
        return;
    }
    
    window.socketClient.sendChatMessage(message);
    window.uiManager.clearChatInput();
}

function inviteUser(userId) {
    GameUtils.showAlert('Direct invitation feature coming soon!');
}

// ==================== INITIALIZATION (ONLY ONE) ====================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Initializing Multiplayer Chess...');
    console.log('📦 Checking dependencies...');
    
    // Check if utilities are loaded
    if (typeof GameUtils === 'undefined') {
        console.error('❌ GameUtils not loaded!');
        alert('Game utilities not loaded. Please refresh the page.');
        return;
    }
    console.log('✅ GameUtils loaded');
    
    if (typeof window.uiManager === 'undefined') {
        console.error('❌ UIManager not loaded!');
        alert('UI Manager not loaded. Please refresh the page.');
        return;
    }
    console.log('✅ UIManager loaded');
    
    if (typeof window.socketClient === 'undefined') {
        console.error('❌ SocketClient not loaded!');
        alert('Socket client not loaded. Please refresh the page.');
        return;
    }
    console.log('✅ SocketClient loaded');
    
    // Initialize game instance
    console.log('⏳ Creating game instance...');
    gameInstance = new MultiplayerChess();
    
    console.log('⏳ Initializing game...');
    await gameInstance.init();
    console.log('✅ Game initialized');
    
    // AUTO-LOGIN if user exists
    const user = getCurrentUser();
    if (user && user.username) {
        console.log('✅ Auto-login as:', user.username);
        
        window.uiManager.showScreen('lobbyScreen');
        updateGameStatus(`Logging in as ${user.username}...`);
        
        window.socketClient.login(user.username);
        await GameUtils.wait(500);
        
        console.log('✅ Login request sent');
    } else {
        window.uiManager.showScreen('loginScreen');
        updateGameStatus('Please enter your name');
    }
    
    console.log('✅ Client ready!');
});