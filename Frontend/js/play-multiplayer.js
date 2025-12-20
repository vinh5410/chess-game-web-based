class MultiplayerChess {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.game = null;
        
        // Canvas settings
        this.canvasSize = 440;
        this.squareSize = 55;
        this.lastParentWidth = 0;
        
        // Colors
        this.lightSquareColor = '#f0d9b5';
        this.darkSquareColor = '#b58863';
        this.highlightColor = 'rgba(255, 255, 0, 0.4)';
        this.legalMoveColor = 'rgba(0, 150, 0, 0.6)';
        this.captureColor = 'rgba(200, 0, 0, 0.6)';
        this.selectedColor = 'rgba(255, 200, 0, 0.6)';
        this.lastMoveColor = 'rgba(255, 255, 0, 0.3)';
        
        // Game state
        this.playerColor = null;
        this.opponentName = '';
        this.playerElo = 1200;
        this.opponentElo = 1200;
        this.playerAvatar = 'https://ui-avatars.com/api/?name=Y&background=d4af37&color=0f172a';
        this.opponentAvatar = 'https://ui-avatars.com/api/?name=O&background=d4af37&color=0f172a';
        this.isMyTurn = false;
        this.gameStarted = false;
        this.gameOver = false;
        this.selectedSquare = null;
        this.legalMoves = [];
        this.lastMove = null;
        this.isFlipped = false;
        this.isInfoSwapped = false; // Track if info bars are swapped from initial state
        
        // Mouse interaction
        this.isDragging = false;
        this.dragPiece = null;
        this.dragStartSquare = null;
        this.mousePos = { x: 0, y: 0 };
        
        // Piece images
        this.pieceImages = {};
        this.imagesLoaded = false;
        
        // Timer
        this.playerTime = 300;
        this.opponentTime = 300;
        this.timerInterval = null;
        
        // Player info DOM refs
        this.playerTopInfoEl = null;
        this.playerBottomInfoEl = null;
        this.chessboardContainerEl = null;
        
        // Socket client
        this.socket = window.socketClient;
        this.replayMode = false;
        this.replayIndex = 0;
        this.replayHistory = []; // Lưu lịch sử các trạng thái bàn cờ 
        this.viewStep = 0; // Số bước đang xem lại (0 = bàn cờ ban đầu) 
        this.fullMoveHistory = [];     
    }
    
    async init() {
        console.log('🎮 Initializing Multiplayer Chess...');
        
        if (typeof window.Chess !== 'function') {
            console.error('❌ Chess.js not available');
            return false;
        }
        
        this.canvas = document.getElementById('chessCanvas');
        if (!this.canvas) {
            console.error('❌ Canvas element not found');
            return false;
        }
        
        this.ctx = this.canvas.getContext('2d');
        this.game = new window.Chess();
        
        // Cache player info DOM elements (updated class names)
        this.chessboardContainerEl = document.getElementById('chessboardContainer');
        if (this.chessboardContainerEl) {
            this.playerTopInfoEl = this.chessboardContainerEl.querySelector('.player-info.player-top');
            this.playerBottomInfoEl = this.chessboardContainerEl.querySelector('.player-info.player-bottom');
        }
        
        await this.loadPieceImages();
        this.promotionUI = new PromotionUI(this.game, this.pieceImages, this.isFlipped);
        this.sound = window.Sound;
        this.setupEventListeners();
        
        // Initial resize - delay to ensure CSS layout is fully computed
        setTimeout(() => {
            this.handleResize(true);
        }, 50);
        
        // Connect socket
        console.log('🔌 Connecting to socket...');
        this.socket.connect();
        
        // Đợi socket connect
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
        
        // Setup socket listeners SAU KHI connect
        console.log('🔌 Setting up socket listeners...');
        this.setupSocketListeners();
        
        console.log('✅ Multiplayer Chess initialized');
        return true;
    }
    
    async loadPieceImages() {
        console.log('🎨 Loading piece images...');
        const pieces = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'];
        const loadPromises = [];
        
        for (const piece of pieces) {
            const img = new Image();
            const promise = new Promise((resolve) => {
                img.onload = () => resolve();
                img.onerror = () => {
                    console.warn(`⚠️ Failed to load ${piece}.png, using fallback`);
                    const cdnUrl = `https://upload.wikimedia.org/wikipedia/commons/${this.getWikipediaPath(piece)}`;
                    img.src = cdnUrl;
                    img.onload = () => resolve();
                    img.onerror = () => resolve();
                };
            });
            
            img.src = `./assets/pieces/${piece}.png`;
            this.pieceImages[piece] = img;
            loadPromises.push(promise);
        }
        
        await Promise.all(loadPromises);
        this.imagesLoaded = true;
        console.log('✅ Piece images loaded');
    }
    
    getWikipediaPath(piece) {
        const paths = {
            'wK': '4/42/Chess_klt45.svg', 'wQ': '1/15/Chess_qlt45.svg',
            'wR': '7/72/Chess_rlt45.svg', 'wB': 'b/b1/Chess_blt45.svg',
            'wN': '7/70/Chess_nlt45.svg', 'wP': '4/45/Chess_plt45.svg',
            'bK': 'f/f0/Chess_kdt45.svg', 'bQ': '4/47/Chess_qdt45.svg',
            'bR': 'f/ff/Chess_rdt45.svg', 'bB': '9/98/Chess_bdt45.svg',
            'bN': 'e/ef/Chess_ndt45.svg', 'bP': 'c/c7/Chess_pdt45.svg'
        };
        return paths[piece] || '';
    }
    
    setupEventListeners() {
        // Mouse events (desktop)
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('click', this.onClick.bind(this));
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
        
        // Touch events (mobile)
        this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
        this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
        this.canvas.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
        
        // Resize event (simple, based on container width)
        window.addEventListener('resize', this.handleResize.bind(this));
        
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Tab bị ẩn, tạm dừng timer
                this.stopTimer();
                this._hiddenAt = Date.now();
            } else {
                // Tab hiện lại, yêu cầu backend gửi lại thời gian thực tế
                if (this.gameStarted && !this.gameOver) {
                    this.socket.socket.emit('game:request_time_sync', {
                        roomId: this.socket.getCurrentRoom()
                    });
                }
            }
        });        
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') sendMessage();
            });
        }
        
        const usernameInput = document.getElementById('usernameInput');
        if (usernameInput) {
            usernameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') login();
            });
        }
    }
    
    
    setupSocketListeners() {
        console.log('🔌 Setting up socket listeners...');
        
        // Get socket.io instance
        const io = this.socket.socket;
        
        if (!io) {
            console.error('❌ Socket.IO instance not found! Connection may not be ready.');
            return;
        }
        
        console.log('✅ Socket.IO instance found:', io.id);
        
        // Clear any existing listeners first
        io.removeAllListeners();
        
        io.on('user:login_success', (data) => {
            console.log('✅ Login success:', data);
            this.onLoginSuccess(data);
        });
        
        io.on('user:login_error', (data) => {
            console.error('❌ Login error:', data);
            alert(data.message || 'Login failed');
        });
        
        io.on('users:update', (data) => {
            console.log('👥 Users update received:', data);
            console.log('📊 Number of users:', data.users.length);
            this.updateOnlineUsers(data.users);
        });
        
        io.on('matchmaking:match_found', (data) => {
            console.log('🎉 Match found!', data);
            this.onMatchFound(data);
        });
        io.on('game:timer_update', (data) => {
            // data.timers: { socketId: secondsLeft }
            // data.currentTurnSocketId: socketId of player whose turn it is
            try {
                const myId = this.socket.getUserId();
                // Map timers -> player/opponent based on my socket id
                if (data && data.timers) {
                    if (myId && data.timers[myId] !== undefined) {
                        this.playerTime = data.timers[myId];
                        // find opponent id
                        const opponentId = Object.keys(data.timers).find(id => id !== myId);
                        if (opponentId) this.opponentTime = data.timers[opponentId];
                    } else {
                        // fallback: try to map by player colors if timers keyed by socketId not present
                        // leave current values unchanged
                    }
                }
                // Update turn status based on currentTurnSocketId
                if (data && data.currentTurnSocketId) {
                    const yourColor = this.playerColor;
                    // set isMyTurn by checking socket id equality
                    this.isMyTurn = (data.currentTurnSocketId === this.socket.getUserId());
                }
                this.updateTimerDisplay();
                // keep UI refresh running (doesn't decrement times, just redraw)
                this.startTimer();
            } catch (err) {
                console.warn('Timer update error', err);
            }
        });        
        io.on('matchmaking:waiting', (data) => {
            console.log('⏳ Waiting for match...', data);
            const statusEl = document.getElementById('searchStatus');
            if (statusEl) {
                statusEl.textContent = `Searching... (${data.queue} players in queue)`;
            }
        });
        
        io.on('room:created', (data) => {
            console.log('🔐 Room created:', data);
            this.onRoomCreated(data);
        });
        
        io.on('room:joined', (data) => {
            console.log('🔗 Room joined:', data);
            this.onRoomJoined(data);
        });
        
        io.on('room:error', (data) => {
            console.error('❌ Room error:', data);
            alert(data.message || 'Room error');
        });
        
        io.on('room:opponent_joined', (data) => {
            console.log('👥 Opponent joined:', data);
            this.onOpponentJoined(data);
        });
        
        io.on('room:opponent_left', (data) => {
            console.log('👋 Opponent left:', data);
            this.onOpponentLeft(data);
        });
        
        io.on('game:start', (data) => {
            console.log('🎮 Game starting:', data);
            this.onGameStart(data);
        });
        
        io.on('game:move', (data) => {
            // Ignore moves emitted by ourselves (defensive)
            try {
                if (data && data.by && data.by === this.socket.getUserId()) {
                    console.log('♟️ Ignoring own move broadcast (by):', data.move);
                    return;
                }
            } catch (e) {
                // continue if any error reading id
            }
            console.log('♟️ Move received:', data);
            this.onOpponentMove(data);
        });
        
        // Listen for move confirmation from server (for the player who made the move)
        io.on('game:move_applied', (data) => {
            console.log('✅ Move applied by server:', data);
            // Update timers from server
            if (data.timers) {
                const myId = this.socket.getUserId();
                if (myId && data.timers[myId] !== undefined) {
                    this.playerTime = data.timers[myId];
                    const opponentId = Object.keys(data.timers).find(id => id !== myId);
                    if (opponentId) this.opponentTime = data.timers[opponentId];
                }
            }
            this.updateTimerDisplay();
            this.updateGameInfo();
        });
        
        io.on('game:sync_time', (data) => {
            if (data.playerTime !== undefined) this.playerTime = data.playerTime;
            if (data.opponentTime !== undefined) this.opponentTime = data.opponentTime;
            this.updateTimerDisplay();
            this.startTimer();
        });        
        io.on('game:invalid_move', (data) => {
            console.error('❌ Invalid move:', data);
            alert('Invalid move!');
        });
        
        io.on('game:over', (data) => {
            console.log('🏁 Game over:', data);
            this.onGameOver(data);
        });
        
        io.on('game:draw_offer', (data) => {
            console.log('🤝 Draw offer received');
            this.onDrawOffer(data);
        });
        
        io.on('game:draw_accepted', (data) => {
            console.log('🤝 Draw accepted');
            this.onDrawAccepted(data);
        });
        
        io.on('game:draw_declined', (data) => {
            console.log('❌ Draw declined');
            // Show notification on web instead of alert
            this.showDrawDeclinedNotification();
        });
        
        io.on('chat:message', (data) => {
            console.log('💬 Chat message:', data);
            this.onChatMessage(data);
        });
        
        console.log('✅ All socket listeners registered on:', io.id);
    }
    
    onLoginSuccess(data) {
        hideAllScreens();
        document.getElementById('lobbyScreen').classList.remove('hidden');
        updateGameStatus(`Welcome, ${data.username}!`);
    }
    
    updateOnlineUsers(users) {
        console.log('📊 Updating online users count:', users.length);
        
        const onlineCount = document.getElementById('onlineUsers');
        if (onlineCount) {
            onlineCount.textContent = `👥 Online: ${users.length}`;
            console.log('✅ Online count updated:', users.length);
        } else {
            console.error('❌ onlineUsers element not found!');
        }
        
        const usersContainer = document.getElementById('usersContainer');
        if (usersContainer) {
            usersContainer.innerHTML = '';
            users.forEach(user => {
                if (user.id !== this.socket.getUserId()) {
                    const userDiv = document.createElement('div');
                    userDiv.className = 'user-item';
                    userDiv.innerHTML = `
                        <span class="user-name">${user.username}</span>
                        <button class="invite-btn" onclick="inviteUser('${user.id}')">Invite</button>
                    `;
                    usersContainer.appendChild(userDiv);
                }
            });
        }
    }
    
    onMatchFound(data) {
        console.log('🎉 Match found with:', data.opponent);
        this.socket.setCurrentRoom(data.roomId);
        
        // Capture ELO if provided
        if (data.opponent && data.opponent.elo) {
            this.opponentElo = data.opponent.elo;
        }
        
        // Hide game over overlay nếu còn
        const gameOverOverlay = document.getElementById('gameOverOverlay');
        if (gameOverOverlay) {
            gameOverOverlay.classList.add('hidden');
        }
        
        showGameScreen();
        updateGameStatus('Match found! Starting game...');
    }
    onRoomCreated(data) {
        console.log('✅ Room created:', data);
        this.socket.setCurrentRoom(data.roomId);
        
        // Show invite friend screen if not visible
        hideAllScreens();
        document.getElementById('inviteFriendScreen').classList.remove('hidden');
        
        // Hide time selector
        const timeSelectorContainer = document.getElementById('privateRoomTimeSelector');
        if (timeSelectorContainer) {
            timeSelectorContainer.style.display = 'none';
        }
        
        // Show room code section
        const roomCodeSection = document.getElementById('roomCodeSection');
        if (roomCodeSection) {
            roomCodeSection.classList.remove('hidden');
            document.getElementById('roomCodeDisplay').textContent = data.roomCode;
            updateGameStatus(`Room created! Share code: ${data.roomCode}`);
        }
    }
    
    onRoomJoined(data) {
        console.log('🔗 Joined room:', data.roomId);
        this.socket.setCurrentRoom(data.roomId);
        showGameScreen();
    }
    
    onOpponentJoined(data) {
        console.log('👥 Opponent joined:', data.opponent);
        this.opponentName = data.opponent.username;
        
        // Capture ELO if provided
        if (data.opponent && data.opponent.elo) {
            this.opponentElo = data.opponent.elo;
        }
        
        // Chuyển người tạo room sang game screen
        showGameScreen();
        
        // Hide game over overlay nếu còn
        const gameOverOverlay = document.getElementById('gameOverOverlay');
        if (gameOverOverlay) {
            gameOverOverlay.classList.add('hidden');
        }
        
        updateGameStatus('Opponent joined! Game starting...');
    }
    
    onOpponentLeft(data) {
        console.log('👋 Opponent left');
        
        // Only show alert if game hasn't ended normally (checkmate, resign, draw, timeout)
        // If gameOver is already true from normal game end, don't show disconnect alert
        if (!this.gameOver) {
            // Opponent disconnected unexpectedly during the game
            document.getElementById('winnerText').textContent = 'Opponent disconnected. You win! 🏆';
            document.getElementById('gameOverOverlay').classList.remove('hidden');
            this.gameOver = true;
            this.gameStarted = false;
            this.stopTimer();
        }
        // If game already over normally, just log it silently
        updateGameStatus('Opponent left the game');
    }
    
    onGameStart(data) {
        console.log('🎮 Game started!', data);

        this.playerColor = data.color;
        this.opponentName = data.opponent.username;
        this.isMyTurn = (data.color === 'white');
        this.gameStarted = true;
        this.gameOver = false;
        this.isFlipped = (this.playerColor === 'black');
        this.isInfoSwapped = false; // Reset swap state on new game

        // Capture ELO if provided
        if (data.opponent && data.opponent.elo) {
            this.opponentElo = data.opponent.elo;
        }
        if (data.playerElo) {
            this.playerElo = data.playerElo;
        }

        // Capture avatars if provided
        if (data.opponent && data.opponent.avatar) {
            this.opponentAvatar = data.opponent.avatar;
        }
        if (data.playerAvatar) {
            this.playerAvatar = data.playerAvatar;
        }

        // Reset timer từ timeControl
        if (data.timeControl) {
            this.playerTime = data.timeControl.initial;
            this.opponentTime = data.timeControl.initial;
            console.log(`⏱️ Timer set to: ${data.timeControl.initial}s`);
        } else {
            this.playerTime = 300;
            this.opponentTime = 300;
        }

        // Hide game over overlay
        const gameOverOverlay = document.getElementById('gameOverOverlay');
        if (gameOverOverlay) {
            gameOverOverlay.classList.add('hidden');
        }

// ensure player/opponent info bars in container are correct
        this.updatePlayerInfoPosition();

        // Update player info display based on flipped state
        this.updatePlayerInfoDisplay();

        // Update left sidebar info
        const opponentNameDisplay = document.getElementById('opponentNameDisplay');
        if (opponentNameDisplay) opponentNameDisplay.textContent = this.opponentName;

        const yourColorDisplay = document.getElementById('yourColorDisplay');
        if (yourColorDisplay) {
            yourColorDisplay.textContent = this.playerColor === 'white' ? 'White' : 'Black';
        }
        const playerColorIcon = this.playerColor === 'w' ? '♔ White' : '♚ Black';
        const opponentColorIcon = this.playerColor === 'w' ? '♚ Black' : '♔ White';
        GameUtils.setTextContent('playerColor', playerColorIcon);
        GameUtils.setTextContent('opponentColor', opponentColorIcon);

        this.game = new window.Chess();
        this.selectedSquare = null;
        this.legalMoves = [];
        this.lastMove = null;

        this.updateTimerDisplay();
        this.updateGameInfo();
        this.startTimer();
        this.draw();

        updateGameStatus(this.isMyTurn ? '👤 Your turn!' : '⏳ Opponent\'s turn', this.game);
    }
    
    updateGameInfo() {
        // Update current turn display with chess piece icon
        const currentTurnEl = document.getElementById('currentTurn');
        if (currentTurnEl) {
            const turnColor = this.game.turn();
            const isWhiteTurn = turnColor === 'w';
            const turnText = isWhiteTurn ? 'White' : 'Black';
            const turnIcon = isWhiteTurn ? '♔' : '♚';
            
            currentTurnEl.innerHTML = `<span style="margin-right: 4px;">${turnIcon}</span>${turnText}`;
            currentTurnEl.style.color = this.isMyTurn ? '#4ade80' : '#f8fafc';
        }
        
        // Update move count
        const moveCountEl = document.getElementById('moveCount');
        if (moveCountEl) {
            const moveNumber = Math.floor(this.game.history().length / 2) + 1;
            moveCountEl.textContent = moveNumber;
        }
        
        // Update turn status with icon
        const turnStatusEl = document.getElementById('turnStatus');
        if (turnStatusEl) {
            if (this.gameOver) {
                turnStatusEl.innerHTML = '<i class="fa-solid fa-flag-checkered"></i> Game Over';
                turnStatusEl.style.color = '#f8fafc';
            } else if (this.isMyTurn) {
                const myIcon = this.playerColor === 'white' ? '♔' : '♚';
                let statusText = `${myIcon} Your turn to move!`;
                // Add check warning
                if (this.game.inCheck()) {
                    statusText = `${myIcon} ⚠️ You are in Check!`;
                    turnStatusEl.style.color = '#ef4444';
                } else {
                    turnStatusEl.style.color = '#4ade80';
                }
                turnStatusEl.innerHTML = statusText;
            } else {
                const oppIcon = this.playerColor === 'white' ? '♚' : '♔';
                let statusText = `${oppIcon} Waiting for opponent...`;
                // Check if opponent is in check
                if (this.game.inCheck()) {
                    statusText = `${oppIcon} ⚠️ Opponent in Check!`;
                    turnStatusEl.style.color = '#fbbf24';
                } else {
                    turnStatusEl.style.color = '#94a3b8';
                }
                turnStatusEl.innerHTML = statusText;
            }
        }
    }
    
    onOpponentMove(data) {
        console.log('♟️ Opponent move:', data.move);
        if (data.timers) {
            try {
                const myId = this.socket.getUserId();
                if (myId && data.timers[myId] !== undefined) {
                    this.playerTime = data.timers[myId];
                    const opponentId = Object.keys(data.timers).find(id => id !== myId);
                    if (opponentId) this.opponentTime = data.timers[opponentId];
                }
                if (data.currentTurnSocketId) {
                    this.isMyTurn = (data.currentTurnSocketId === this.socket.getUserId());
                }
                this.updateTimerDisplay();
            } catch (err) {
                console.warn('Error applying timers from move', err);
            }
        }        
        try {
            const move = this.game.move(data.move);
            if (move) {
                if (this.sound) this.sound.playMove(move, this.game);
                this.fullMoveHistory = this.game.history({ verbose: true });
                this.viewStep = this.fullMoveHistory.length;
                this.updateBoardView();              
                this.lastMove = { from: move.from, to: move.to };
                this.isMyTurn = true;
                
                // Sync time if server provides it
                if (data.playerTime !== undefined) {
                    this.playerTime = data.playerTime;
                }
                if (data.opponentTime !== undefined) {
                    this.opponentTime = data.opponentTime;
                }
                
                this.draw();
                this.updateTimerDisplay();
                this.updateGameInfo();
                updateGameStatus('👤 Your turn!', this.game);
                
                if (this.checkGameOver()) {
                    return;
                }
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
        
        document.getElementById('winnerText').textContent = result;
        document.getElementById('gameOverOverlay').classList.remove('hidden');
    }
    
    onDrawOffer(data) {
        // Show draw request modal instead of browser confirm
        document.getElementById('drawOfferText').textContent = `${data.from} offers a draw. Accept?`;
        document.getElementById('drawRequestModal').classList.remove('hidden');
    }
    
    onDrawAccepted(data) {
        this.gameOver = true;
        this.gameStarted = false;
        this.stopTimer();
        document.getElementById('winnerText').textContent = 'Game drawn by agreement! 🤝';
        document.getElementById('gameOverOverlay').classList.remove('hidden');
    }
    
    showDrawDeclinedNotification() {
        // Show temporary notification that draw was declined
        const notification = document.createElement('div');
        notification.className = 'draw-declined-notification';
        notification.innerHTML = '<i class="fa-solid fa-xmark"></i> Draw offer declined';
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    onChatMessage(data) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        // Skip own messages (already displayed via optimistic update)
        const isOwn = data.sender === this.socket.getUserId();
        if (isOwn) return;
        
        // Remove welcome message if exists
        const welcomeMsg = chatMessages.querySelector('.chat-welcome');
        if (welcomeMsg) welcomeMsg.remove();
        
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message opponent';
        messageDiv.innerHTML = `
            <span class="message-sender">${data.username}</span>
            <span class="message-text">${this.escapeHtml(data.message)}</span>
            <span class="message-time">${timeStr}</span>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    addSystemMessage(text) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message system';
        messageDiv.textContent = text;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    onMouseDown(e) {
        if (!this.gameStarted || this.gameOver || !this.isMyTurn) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const square = this.canvasToSquare(x, y);
        if (!square) return;
        
        const piece = this.game.get(square);
        if (piece && piece.color === this.playerColor.charAt(0)) {
            this.isDragging = true;
            this.dragStartSquare = square;
            this.dragPiece = piece;
            this.selectedSquare = square;
            this.legalMoves = this.game.moves({ square, verbose: true });
            this.draw();
        }
    }
    
    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mousePos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        
        if (this.isDragging) {
            this.draw();
        }
    }
    
    onMouseUp(e) {
        if (!this.isDragging || !this.dragStartSquare) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const targetSquare = this.canvasToSquare(x, y);
        
        this.isDragging = false;
        this.dragPiece = null;
        
        if (targetSquare && targetSquare !== this.dragStartSquare) {
            this.tryMove(this.dragStartSquare, targetSquare);
        } else {
            // Dropped on same square or invalid - just redraw
            this.selectedSquare = null;
            this.legalMoves = [];
            this.draw();
        }
        
        this.dragStartSquare = null;
    }
    
    // Touch handlers for mobile
    onTouchStart(e) {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('Touch start on canvas', e.touches[0].clientX, e.touches[0].clientY);
        
        if (!this.gameStarted || this.gameOver || !this.isMyTurn || e.touches.length !== 1) {
            console.log('Touch blocked:', {gameStarted: this.gameStarted, gameOver: this.gameOver, isMyTurn: this.isMyTurn});
            return;
        }
        
        const touch = e.touches[0];
        this.touchStartPos = { x: touch.clientX, y: touch.clientY };
        this.touchMoved = false;
    }
    
    onTouchMove(e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.touches.length !== 1) return;
        
        const touch = e.touches[0];
        
        if (this.touchStartPos) {
            const dx = touch.clientX - this.touchStartPos.x;
            const dy = touch.clientY - this.touchStartPos.y;
            if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                // Start dragging if not already
                if (!this.touchMoved) {
                    this.touchMoved = true;
                    const rect = this.canvas.getBoundingClientRect();
                    const scaleX = this.canvas.width / rect.width;
                    const scaleY = this.canvas.height / rect.height;
                    const x = (this.touchStartPos.x - rect.left) * scaleX;
                    const y = (this.touchStartPos.y - rect.top) * scaleY;
                    const sq = this.canvasToSquare(x, y);
                    
                    if (sq) {
                        const piece = this.game.get(sq);
                        if (piece && piece.color === this.playerColor.charAt(0)) {
                            this.isDragging = true;
                            this.dragStartSquare = sq;
                            this.dragPiece = piece;
                            this.selectedSquare = sq;
                            this.legalMoves = this.game.moves({ square: sq, verbose: true });
                            this.mousePos = { x, y };
                        }
                    }
                }
                
                if (this.isDragging) {
                    const rect = this.canvas.getBoundingClientRect();
                    const scaleX = this.canvas.width / rect.width;
                    const scaleY = this.canvas.height / rect.height;
                    this.mousePos = { 
                        x: (touch.clientX - rect.left) * scaleX, 
                        y: (touch.clientY - rect.top) * scaleY 
                    };
                    this.draw();
                }
            }
        }
    }
    
    onTouchEnd(e) {
        e.preventDefault();
        e.stopPropagation();
        const touch = e.changedTouches[0];
        
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (touch.clientX - rect.left) * scaleX;
        const y = (touch.clientY - rect.top) * scaleY;
        
        console.log('Touch end - rect:', rect.top, rect.left, rect.width, rect.height);
        console.log('Touch end - calculated:', x, y, 'scale:', scaleX, scaleY);
        
        if (this.touchMoved && this.isDragging) {
            // Was dragging - complete the move
            const targetSquare = this.canvasToSquare(x, y);
            
            this.isDragging = false;
            this.dragPiece = null;
            
            if (targetSquare && targetSquare !== this.dragStartSquare) {
                this.tryMove(this.dragStartSquare, targetSquare);
            } else {
                this.selectedSquare = null;
                this.legalMoves = [];
                this.draw();
            }
            
            this.dragStartSquare = null;
        } else {
            // Tap - treat as click with scaled coordinates
            this.onClickScaled(x, y);
        }
        
        this.touchStartPos = null;
        this.touchMoved = false;
    }
    
    onClickScaled(x, y) {
        if (this.isDragging || !this.gameStarted || this.gameOver || !this.isMyTurn) return;
        
        const square = this.canvasToSquare(x, y);
        console.log('Click scaled - square:', square, 'x:', x, 'y:', y);
        if (!square) return;
        
        if (this.selectedSquare === square) {
            this.selectedSquare = null;
            this.legalMoves = [];
            this.draw();
            return;
        }
        
        if (this.selectedSquare && this.legalMoves.find(m => m.to === square)) {
            this.tryMove(this.selectedSquare, square);
            return;
        }
        
        const piece = this.game.get(square);
        if (piece && piece.color === this.playerColor.charAt(0)) {
            this.selectedSquare = square;
            this.legalMoves = this.game.moves({ square, verbose: true });
            this.draw();
        }
    }
    
    onClick(e) {
        if (this.isDragging || !this.gameStarted || this.gameOver || !this.isMyTurn) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const square = this.canvasToSquare(x, y);
        if (!square) return;
        
        if (this.selectedSquare === square) {
            this.selectedSquare = null;
            this.legalMoves = [];
            this.draw();
            return;
        }
        
        if (this.selectedSquare && this.legalMoves.find(m => m.to === square)) {
            this.tryMove(this.selectedSquare, square);
            return;
        }
        
        const piece = this.game.get(square);
        if (piece && piece.color === this.playerColor.charAt(0)) {
            this.selectedSquare = square;
            this.legalMoves = this.game.moves({ square, verbose: true });
            this.draw();
        }
    }
    
    tryMove(from, to) {
        // Kiểm tra nếu là nước phong cấp
        const moves = this.game.moves({ square: from, verbose: true });
        const promotionMove = moves.find(m => m.to === to && m.promotion);

        if (promotionMove) {
            // Clear selection highlights before showing promotion UI
            this.selectedSquare = null;
            this.legalMoves = [];
            this.draw();
            
            // Hiển thị UI chọn quân phong cấp
            const color = this.playerColor === 'white' ? 'w' : 'b';
            this.promotionUI.showPromotionDialog(from, to, color, (selectedPiece) => {
                const moveObj = this.game.move({
                    from,
                    to,
                    promotion: selectedPiece
                });
                if (moveObj) {
                    if (this.sound) this.sound.playMove(moveObj, this.game);
                    this.fullMoveHistory = this.game.history({ verbose: true });
                    this.viewStep = this.fullMoveHistory.length;
                    this.updateBoardView();
                    this.lastMove = { from: moveObj.from, to: moveObj.to };
                    this.selectedSquare = null;
                    this.legalMoves = [];
                    this.isMyTurn = false;
                    this.socket.makeMove(moveObj.san);
                    this.draw();
                    this.updateGameInfo();
                    updateGameStatus('⏳ Opponent\'s turn', this.game);
                    if (this.checkGameOver()) return true;
                }
            }, this.canvas, this.isFlipped);
            return true; // Đợi callback, không thực hiện tiếp
        }

        // Xử lý nước đi bình thường (không phong cấp)
        try {
            const moveObj = this.game.move({
                from,
                to
            });
            if (moveObj) {
                if (this.sound) this.sound.playMove(moveObj, this.game);
                this.fullMoveHistory = this.game.history({ verbose: true });
                this.viewStep = this.fullMoveHistory.length;
                this.updateBoardView();
                this.lastMove = { from: moveObj.from, to: moveObj.to };
                this.isMyTurn = false;
                this.socket.makeMove(moveObj.san);
                this.draw();
                this.updateGameInfo();
                updateGameStatus('⏳ Opponent\'s turn', this.game);
                if (this.checkGameOver()) return true;
            }
        } catch (error) {
            console.log('❌ Invalid move');
        }
        
        // Clear selection on invalid move too
        this.selectedSquare = null;
        this.legalMoves = [];
        this.draw();
        
        return false;
    }
    
    checkGameOver() {
        if (this.game.isGameOver()) {
            this.gameOver = true;
            this.gameStarted = false;
            return true;
        }
        return false;
    }
    
    canvasToSquare(x, y) {
        const file = Math.floor(x / this.squareSize);
        const rank = this.isFlipped ? Math.floor(y / this.squareSize) : 7 - Math.floor(y / this.squareSize);
        
        if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
        
        return String.fromCharCode(97 + file) + (rank + 1);
    }
    
    squareToCanvas(square) {
        const file = square.charCodeAt(0) - 97;
        const rank = parseInt(square[1]) - 1;
        
        const x = file * this.squareSize;
        const y = this.isFlipped ? rank * this.squareSize : (7 - rank) * this.squareSize;
        
        return { x, y };
    }
    
    handleResize(force = false) {
        const boardSquare = this.canvas.parentElement;
        if (!boardSquare) return;
        
        // Get computed size - use getBoundingClientRect for accurate measurement
        const rect = boardSquare.getBoundingClientRect();
        const parentWidth = rect.width;
        
        // Skip if element is not visible yet - retry later
        if (parentWidth < 50) {
            setTimeout(() => this.handleResize(true), 100);
            return;
        }
        
        // Only resize if width changed significantly or forced
        if (!force && Math.abs(parentWidth - this.lastParentWidth) < 5) return;
        this.lastParentWidth = parentWidth;
        
        // Use CSS pixel size for canvas
        const cssSize = parentWidth;
        
        // DPR-aware sizing for crisp rendering
        const dpr = window.devicePixelRatio || 1;
        const backingSize = Math.round(cssSize * dpr);
        
        this.canvas.width = backingSize;
        this.canvas.height = backingSize;
        this.canvas.style.width = cssSize + 'px';
        this.canvas.style.height = cssSize + 'px';
        
        this.canvasSize = cssSize;
        this.squareSize = cssSize / 8;
        
        // Scale context for DPR
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        
        this.draw();
    }
    
    draw() {
        // Clear using CSS pixel size (context is already scaled by DPR)
        this.ctx.clearRect(0, 0, this.canvasSize, this.canvasSize);
        
        this.drawBoard();
        this.drawCoordinates();
        this.drawLastMove();
        this.drawHighlights();
        this.drawPieces();
        this.drawDragPiece();
    }
    
    drawBoard() {
        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const isLight = (rank + file) % 2 === 0;
                const color = isLight ? this.lightSquareColor : this.darkSquareColor;
                
                const x = file * this.squareSize;
                const y = rank * this.squareSize;
                
                this.ctx.fillStyle = color;
                this.ctx.fillRect(x, y, this.squareSize, this.squareSize);
            }
        }
    }
    
    drawCoordinates() {
        const fontSize = Math.max(12, Math.floor(this.squareSize / 5));
        this.ctx.font = `bold ${fontSize}px Arial`;
        this.ctx.textBaseline = 'bottom';
        
        // Draw letters (a-h) at bottom of each file
        for (let file = 0; file < 8; file++) {
            const letter = this.isFlipped 
                ? String.fromCharCode(104 - file)  // h to a when flipped
                : String.fromCharCode(97 + file);  // a to h normally
            const x = file * this.squareSize + 2;
            const y = this.canvasSize - 2; // Use CSS size
            // Bottom row: when not flipped, rank 1 (index 7), a1 is light (file+rank=0+0=even)
            const isDark = (file + 7) % 2 === 0;
            this.ctx.fillStyle = isDark ? this.darkSquareColor : this.lightSquareColor;
            this.ctx.fillText(letter, x, y);
        }
        
        // Draw numbers (1-8) at right of each rank
        this.ctx.textBaseline = 'top';
        for (let rank = 0; rank < 8; rank++) {
            const number = this.isFlipped ? rank + 1 : 8 - rank;
            const x = this.canvasSize - fontSize + 2; // Use CSS size
            const y = rank * this.squareSize + 2;
            const isDark = (7 + rank) % 2 === 0;
            this.ctx.fillStyle = isDark ? this.darkSquareColor : this.lightSquareColor;
            this.ctx.fillText(number, x, y);
        }
    }
    
    drawLastMove() {
        if (!this.lastMove) return;
        
        const fromPos = this.squareToCanvas(this.lastMove.from);
        const toPos = this.squareToCanvas(this.lastMove.to);
        
        this.ctx.fillStyle = this.lastMoveColor;
        this.ctx.fillRect(fromPos.x, fromPos.y, this.squareSize, this.squareSize);
        this.ctx.fillRect(toPos.x, toPos.y, this.squareSize, this.squareSize);
    }
    
    drawHighlights() {
        if (this.selectedSquare && !this.isDragging) {
            const pos = this.squareToCanvas(this.selectedSquare);
            this.ctx.fillStyle = this.selectedColor;
            this.ctx.fillRect(pos.x, pos.y, this.squareSize, this.squareSize);
        }
        
        for (const move of this.legalMoves) {
            const pos = this.squareToCanvas(move.to);
            
            if (move.captured) {
                this.ctx.strokeStyle = this.captureColor;
                this.ctx.lineWidth = 4;
                this.ctx.beginPath();
                this.ctx.arc(
                    pos.x + this.squareSize / 2,
                    pos.y + this.squareSize / 2,
                    this.squareSize / 2 - 6,
                    0,
                    2 * Math.PI
                );
                this.ctx.stroke();
            } else {
                this.ctx.fillStyle = this.legalMoveColor;
                this.ctx.beginPath();
                this.ctx.arc(
                    pos.x + this.squareSize / 2,
                    pos.y + this.squareSize / 2,
                    12,
                    0,
                    2 * Math.PI
                );
                this.ctx.fill();
            }
        }
    }
    
    drawPieces() {
        const board = this.game.board();
        
        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const boardRank = this.isFlipped ? 7 - rank : rank;
                const piece = board[boardRank][file];
                if (!piece) continue;
                
                const squareRank = this.isFlipped ? rank + 1 : 8 - rank;
                const square = String.fromCharCode(97 + file) + squareRank;
                
                if (this.isDragging && this.dragStartSquare === square) continue;
                
                this.drawPiece(piece, file * this.squareSize, rank * this.squareSize);
            }
        }
    }
    
    drawPiece(piece, x, y) {
        const pieceKey = piece.color + piece.type.toUpperCase();
        
        if (this.imagesLoaded && this.pieceImages[pieceKey] && this.pieceImages[pieceKey].complete) {
            this.ctx.drawImage(
                this.pieceImages[pieceKey],
                x + 4, y + 4,
                this.squareSize - 8,
                this.squareSize - 8
            );
        } else {
            this.drawTextPiece(piece, x, y);
        }
    }
    
    drawTextPiece(piece, x, y) {
        const pieceSymbols = {
            'wK': '♔', 'wQ': '♕', 'wR': '♖', 'wB': '♗', 'wN': '♘', 'wP': '♙',
            'bK': '♚', 'bQ': '♛', 'bR': '♜', 'bB': '♝', 'bN': '♞', 'bP': '♟'
        };
        
        const pieceKey = piece.color + piece.type.toUpperCase();
        const symbol = pieceSymbols[pieceKey];
        
        if (symbol) {
            this.ctx.font = `bold ${this.squareSize * 0.7}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            this.ctx.shadowColor = 'rgba(0,0,0,0.5)';
            this.ctx.shadowBlur = 3;
            this.ctx.shadowOffsetX = 2;
            this.ctx.shadowOffsetY = 2;
            
            this.ctx.fillStyle = piece.color === 'w' ? '#fff' : '#000';
            this.ctx.fillText(symbol, x + this.squareSize / 2, y + this.squareSize / 2);
            
            if (piece.color === 'w') {
                this.ctx.strokeStyle = '#333';
                this.ctx.lineWidth = 2;
                this.ctx.strokeText(symbol, x + this.squareSize / 2, y + this.squareSize / 2);
            }
            
            this.ctx.shadowColor = 'transparent';
            this.ctx.shadowBlur = 0;
            this.ctx.shadowOffsetX = 0;
            this.ctx.shadowOffsetY = 0;
            
            this.ctx.textAlign = 'start';
            this.ctx.textBaseline = 'alphabetic';
        }
    }
    
    drawDragPiece() {
        if (!this.isDragging || !this.dragPiece) return;
        
        const x = this.mousePos.x - this.squareSize / 2;
        const y = this.mousePos.y - this.squareSize / 2;
        
        this.drawPiece(this.dragPiece, x, y);
    }
    
    startTimer() {
        // UI refresh only; times are server authoritative
        this.stopTimer();
        this.timerInterval = setInterval(() => {
            if (!this.gameStarted || this.gameOver) {
                this.stopTimer();
                return;
            }
            // simply refresh display; don't mutate times here
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
        const formatTime = (seconds) => {
            const mins = Math.floor(seconds / 60);
            const secs = Math.max(0, seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        const topTimer = document.querySelector('.player-info.player-top .player-timer');
        const bottomTimer = document.querySelector('.player-info.player-bottom .player-timer');

        // When info is NOT swapped: player at bottom, opponent at top
        // When info is swapped: opponent at bottom, player at top
        const bottomTime = this.isInfoSwapped ? this.opponentTime : this.playerTime;
        const topTime = this.isInfoSwapped ? this.playerTime : this.opponentTime;

        if (bottomTimer) {
            bottomTimer.textContent = formatTime(bottomTime || 0);
            bottomTimer.classList.toggle('low-time', (bottomTime || 0) <= 30);
        }
        if (topTimer) {
            topTimer.textContent = formatTime(topTime || 0);
            topTimer.classList.toggle('low-time', (topTime || 0) <= 30);
        }
    }
        
    // Update player info bar positions based on isFlipped state
    updatePlayerInfoPosition() {
        // Ensure cached refs exist and are current
        this.chessboardContainerEl = this.chessboardContainerEl || document.getElementById('chessboardContainer');
        if (!this.chessboardContainerEl) {
            console.warn('⚠️ chessboard container not found');
            return;
        }

        // Re-find info bars in container to avoid stale references
        const infoBars = Array.from(this.chessboardContainerEl.querySelectorAll('.player-info'));
        if (infoBars.length < 2) {
            console.warn('⚠️ Not enough player-info elements found');
            return;
        }

        // Identify bottom (player) and top (opponent) elements reliably:
        let bottomEl = this.chessboardContainerEl.querySelector('.player-info.player-bottom');
        let topEl = this.chessboardContainerEl.querySelector('.player-info.player-top');

        // If not found, fallback to first/second
        if (!bottomEl || !topEl) {
            bottomEl = infoBars[1];
            topEl = infoBars[0];
        }

        const boardSquare = this.chessboardContainerEl.querySelector('.board-square');

        // Ensure topEl is before board-square and bottomEl is after board-square
        try {
            // remove class markers then reassign
            infoBars.forEach(el => {
                el.classList.remove('player-bottom');
                el.classList.remove('player-top');
            });

            if (topEl && boardSquare) {
                this.chessboardContainerEl.insertBefore(topEl, boardSquare);
                topEl.classList.add('player-top');
            }
            if (bottomEl) {
                this.chessboardContainerEl.appendChild(bottomEl);
                bottomEl.classList.add('player-bottom');
            }
        } catch (err) {
            console.warn('⚠️ updatePlayerInfoPosition failed:', err);
        }
    }
    flipBoard() {
        this.isFlipped = !this.isFlipped;
        this.isInfoSwapped = !this.isInfoSwapped; // Toggle swap state
        this.draw();
        this.swapPlayerInfoBars();
        console.log('🔄 Board flipped:', this.isFlipped ? 'Flipped' : 'Normal');
    }

    // Swap player info bars content when user manually flips board
    swapPlayerInfoBars() {
        const container = document.getElementById('chessboardContainer');
        if (!container) return;

        const topBar = container.querySelector('.player-info.player-top');
        const bottomBar = container.querySelector('.player-info.player-bottom');

        if (!topBar || !bottomBar) return;

        // Get references to elements
        const topName = topBar.querySelector('.player-name');
        const topRating = topBar.querySelector('.player-rating');
        const topTimer = topBar.querySelector('.player-timer');

        const bottomName = bottomBar.querySelector('.player-name');
        const bottomRating = bottomBar.querySelector('.player-rating');
        const bottomTimer = bottomBar.querySelector('.player-timer');

        // Swap name
        if (topName && bottomName) {
            const temp = topName.textContent;
            topName.textContent = bottomName.textContent;
            bottomName.textContent = temp;
        }

        // Swap rating
        if (topRating && bottomRating) {
            const temp = topRating.textContent;
            topRating.textContent = bottomRating.textContent;
            bottomRating.textContent = temp;
        }

        // Swap timer
        if (topTimer && bottomTimer) {
            const tempTime = topTimer.textContent;
            const tempLowTime = topTimer.classList.contains('low-time');

            topTimer.textContent = bottomTimer.textContent;
            topTimer.classList.toggle('low-time', bottomTimer.classList.contains('low-time'));

            bottomTimer.textContent = tempTime;
            bottomTimer.classList.toggle('low-time', tempLowTime);
        }
    }

    // Update player info bars display - always player at bottom, opponent at top
    updatePlayerInfoDisplay() {
        const container = document.getElementById('chessboardContainer');
        if (!container) return;

        const topBar = container.querySelector('.player-info.player-top');
        const bottomBar = container.querySelector('.player-info.player-bottom');

        if (!topBar || !bottomBar) return;

        // Get references to elements
        const topName = topBar.querySelector('.player-name');
        const topRating = topBar.querySelector('.player-rating');
        const topTimer = topBar.querySelector('.player-timer');
        const topAvatar = topBar.querySelector('.player-avatar');

        const bottomName = bottomBar.querySelector('.player-name');
        const bottomRating = bottomBar.querySelector('.player-rating');
        const bottomTimer = bottomBar.querySelector('.player-timer');
        const bottomAvatar = bottomBar.querySelector('.player-avatar');

        const myName = this.socket.getUsername() || 'You';
        const myElo = `ELO: ${this.playerElo}`;
        const oppName = this.opponentName;
        const oppElo = `ELO: ${this.opponentElo}`;

        const formatTime = (seconds) => {
            const mins = Math.floor(seconds / 60);
            const secs = Math.max(0, seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        // Always: player at bottom, opponent at top
        if (bottomName) bottomName.textContent = myName;
        if (bottomRating) bottomRating.textContent = myElo;
        if (bottomAvatar) bottomAvatar.src = this.playerAvatar;
        if (bottomTimer) {
            bottomTimer.textContent = formatTime(this.playerTime || 0);
            bottomTimer.classList.toggle('low-time', (this.playerTime || 0) <= 30);
        }

        if (topName) topName.textContent = oppName;
        if (topRating) topRating.textContent = oppElo;
        if (topAvatar) topAvatar.src = this.opponentAvatar;
        if (topTimer) {
            topTimer.textContent = formatTime(this.opponentTime || 0);
            topTimer.classList.toggle('low-time', (this.opponentTime || 0) <= 30);
        }
    }
    enterReplayMode() {
        this.replayMode = true;
        this.replayHistory = this.game.history({ verbose: true });
        this.replayIndex = 0;
        document.getElementById('replayControls').style.display = '';
        document.getElementById('enterReplayBtn').style.display = 'none';
        this.showReplayStep(0);
    }

    exitReplayMode() {
        this.replayMode = false;
        document.getElementById('replayControls').style.display = 'none';
        document.getElementById('enterReplayBtn').style.display = '';
        // Khôi phục trạng thái hiện tại
        this.game.reset();
        for (const move of this.replayHistory) {
            this.game.move(move);
        }
        this.draw();
    }
    showReplayStep(index) {
    if (!this.replayMode) return;
    if (index < 0) index = 0;
    if (index > this.replayHistory.length) index = this.replayHistory.length;
    this.game.reset();
    for (let i = 0; i < index; i++) {
        this.game.move(this.replayHistory[i]);
    }
    this.replayIndex = index;
    this.draw();
    const info = document.getElementById('stepInfo');
    if (info) {
        info.textContent = `${index}/${this.replayHistory.length}`;
    }
}
    updateBoardView() {
        const history = this.fullMoveHistory;
        this.game.reset();
        for (let i = 0; i < this.viewStep; i++) {
            this.game.move(history[i]);
        }
        this.draw();
        // Cập nhật thông tin bước
        const info = document.getElementById('stepInfo');
        if (info) {
            info.textContent = `${this.viewStep}/${history.length}`;
        }
    }
}

// Global instance
let gameInstance = null;

// UI Functions
function updateGameStatus(message, game = null) {
    const statusEl = document.getElementById('gameStatus');
    if (!statusEl) return;
    
    // Check for special game states if game instance provided
    if (game) {
        try {
            if (game.isCheckmate()) {
                const loser = game.turn() === 'w' ? 'White' : 'Black';
                statusEl.textContent = `♚ Checkmate! ${loser} loses!`;
                return;
            }
            
            if (game.isStalemate()) {
                statusEl.textContent = '🤝 Stalemate! Draw!';
                return;
            }
            
            if (game.isDraw()) {
                statusEl.textContent = '🤝 Draw!';
                return;
            }
            
            // Add check warning
            if (game.inCheck()) {
                message += ' ⚠️ Check!';
            }
        } catch (error) {
            // Ignore
        }
    }
    
    statusEl.textContent = message;
}

function hideAllScreens() {
    document.getElementById('lobbyScreen').classList.add('hidden');
    document.getElementById('randomMatchScreen').classList.add('hidden');
    document.getElementById('inviteFriendScreen').classList.add('hidden');
    document.getElementById('joinRoomScreen').classList.add('hidden');
    document.getElementById('gameScreen').classList.add('hidden');
    
    // Show main header when not in game
    const mainHeader = document.getElementById('mainHeader');
    if (mainHeader) mainHeader.classList.remove('hidden');
}

function showGameScreen() {
    hideAllScreens();
    document.getElementById('gameScreen').classList.remove('hidden');
    
    // Hide main header when in game (because game has its own header in sidebar)
    const mainHeader = document.getElementById('mainHeader');
    if (mainHeader) mainHeader.classList.add('hidden');
    
    // Trigger resize after game screen becomes visible
    setTimeout(() => {
        if (window.multiplayerGame) {
            window.multiplayerGame.handleResize(true);
        }
    }, 50);
}

function login() {
    const user = getCurrentUser();
    if (!user || !user.username) {
        alert('Please login first');
        window.location.href = '/login.html';
        return;
    }
    
    window.socketClient.login(user.username);
}

function logout() {
    window.socketClient.logout();
    // Redirect to login page
    window.location.href = '/login.html';
}

function showRandomMatch() {
    hideAllScreens();
    document.getElementById('randomMatchScreen').classList.remove('hidden');
    
    // Render time selector
    renderTimeSelector('randomMatchTimeSelector');
    
    updateGameStatus('Select time control and click Find Match');
}

function startRandomSearch() {
    const timeControl = getSelectedTimeControl();
    document.getElementById('searchStatus').textContent = 'Searching for opponent...';
    window.socketClient.findRandomMatch(timeControl);
}

function cancelSearch() {
    window.socketClient.cancelRandomMatch();
    backToLobby();
}

function showInviteFriend() {
    hideAllScreens();
    document.getElementById('inviteFriendScreen').classList.remove('hidden');
    
    // Reset UI: Hide room code section
    const roomCodeSection = document.getElementById('roomCodeSection');
    if (roomCodeSection) {
        roomCodeSection.classList.add('hidden');
    }
    
    // Show and render time selector
    const timeSelectorContainer = document.getElementById('privateRoomTimeSelector');
    if (timeSelectorContainer) {
        timeSelectorContainer.style.display = 'block';
        // Clear previous content before rendering
        timeSelectorContainer.innerHTML = '';
    }
    
    renderTimeSelector('privateRoomTimeSelector');
    
    updateGameStatus('Select time control to create room');
}
function cancelInvite() {
    window.socketClient.leaveRoom();
    
    // Reset UI state
    const roomCodeSection = document.getElementById('roomCodeSection');
    if (roomCodeSection) {
        roomCodeSection.classList.add('hidden');
    }
    
    const timeSelectorContainer = document.getElementById('privateRoomTimeSelector');
    if (timeSelectorContainer) {
        timeSelectorContainer.style.display = 'block';
        timeSelectorContainer.innerHTML = '';
    }
    
    backToLobby();
}

function copyRoomCode() {
    const roomCode = document.getElementById('roomCodeDisplay').textContent;
    navigator.clipboard.writeText(roomCode).then(() => {
        const copyBtn = document.querySelector('.copy-btn');
        const originalHTML = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        copyBtn.classList.add('copied');
        setTimeout(() => {
            copyBtn.innerHTML = originalHTML;
            copyBtn.classList.remove('copied');
        }, 2000);
    });
}

function showJoinRoom() {
    hideAllScreens();
    document.getElementById('joinRoomScreen').classList.remove('hidden');
}

function joinRoom() {
    const roomCodeInput = document.getElementById('roomCodeInput');
    const roomCode = roomCodeInput.value.trim().toUpperCase();
    
    if (!roomCode) {
        alert('Please enter room code');
        return;
    }
    
    if (roomCode.length !== 6) {
        alert('Room code must be 6 characters');
        return;
    }
    
    window.socketClient.joinPrivateRoom(roomCode);
}

function backToLobby() {
    window.socketClient.leaveRoom();
    
    // Reset search status
    const searchStatus = document.getElementById('searchStatus');
    if (searchStatus) {
        searchStatus.textContent = 'Click button to start searching';
    }
    
    hideAllScreens();
    document.getElementById('lobbyScreen').classList.remove('hidden');
    updateGameStatus('Choose game mode');
}

function offerDraw() {
    // Show custom draw offer modal
    document.getElementById('drawOfferModal').classList.remove('hidden');
}

function confirmDrawOffer() {
    document.getElementById('drawOfferModal').classList.add('hidden');
    window.socketClient.offerDraw();
}

function cancelDrawOffer() {
    document.getElementById('drawOfferModal').classList.add('hidden');
}

function acceptDraw() {
    document.getElementById('drawRequestModal').classList.add('hidden');
    if (gameInstance && gameInstance.socket) {
        gameInstance.socket.respondDraw(true);
    }
}

function declineDraw() {
    document.getElementById('drawRequestModal').classList.add('hidden');
    if (gameInstance && gameInstance.socket) {
        gameInstance.socket.respondDraw(false);
    }
}

function resign() {
    // Show custom resign confirmation modal
    document.getElementById('resignModal').classList.remove('hidden');
}

function confirmResign() {
    document.getElementById('resignModal').classList.add('hidden');
    window.socketClient.resign();
}

function cancelResign() {
    document.getElementById('resignModal').classList.add('hidden');
}

function flipBoard() {
    if (gameInstance) {
        gameInstance.flipBoard();
    }
}

function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();
    
    if (!message) return;
    
    if (message.length > 200) {
        alert('Message too long (max 200 characters)');
        return;
    }
    
    // Optimistic update - show message immediately
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        // Remove welcome message if exists
        const welcomeMsg = chatMessages.querySelector('.chat-welcome');
        if (welcomeMsg) welcomeMsg.remove();
        
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message own';
        messageDiv.innerHTML = `
            <span class="message-sender">You</span>
            <span class="message-text">${escapeHtml(message)}</span>
            <span class="message-time">${timeStr}</span>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    window.socketClient.sendChatMessage(message);
    chatInput.value = '';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function inviteUser(userId) {
    alert('Direct invitation feature coming soon!');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Initializing Multiplayer Chess...');
    
    // Initialize game instance
    gameInstance = new MultiplayerChess();
    
    // Đợi init hoàn thành
    console.log('⏳ Initializing game...');
    await gameInstance.init();
    console.log('✅ Game initialized');
    // AUTO-LOGIN nếu đã có user
    document.getElementById('firstStepBtn').onclick = () => {
        gameInstance.viewStep = 0;
        gameInstance.updateBoardView();
        if (window.Sound) window.Sound.play('move');
    };
    document.getElementById('prevStepBtn').onclick = () => {
        if (gameInstance.viewStep > 0) {
            gameInstance.viewStep--;
            gameInstance.updateBoardView();
            // Play sound for the move at this step
            const history = gameInstance.fullMoveHistory;
            if (gameInstance.viewStep > 0 && history[gameInstance.viewStep - 1]) {
                if (window.Sound) window.Sound.playMove(history[gameInstance.viewStep - 1]);
            } else {
                if (window.Sound) window.Sound.play('move');
            }
        }
    };
    document.getElementById('nextStepBtn').onclick = () => {
        const maxStep = gameInstance.fullMoveHistory.length;
        if (gameInstance.viewStep < maxStep) {
            gameInstance.viewStep++;
            gameInstance.updateBoardView();
            // Play sound for the move at this step
            const history = gameInstance.fullMoveHistory;
            if (history[gameInstance.viewStep - 1]) {
                if (window.Sound) window.Sound.playMove(history[gameInstance.viewStep - 1]);
            }
        }
    };
    document.getElementById('lastStepBtn').onclick = () => {
        gameInstance.viewStep = gameInstance.fullMoveHistory.length;
        gameInstance.updateBoardView();
        // Play sound for the last move
        const history = gameInstance.fullMoveHistory;
        if (history.length > 0) {
            if (window.Sound) window.Sound.playMove(history[history.length - 1]);
        }
    };   
    // Ẩn ngay loginScreen để tránh nhấp nháy
    const loginScreen = document.getElementById('loginScreen');
    if (loginScreen) loginScreen.classList.add('hidden');
    
    // Auto-login hoặc tạo tên tạm thời
    hideAllScreens();
    const user = getCurrentUser();
    if (user && user.username) {
        console.log('✅ Auto-login as:', user.username);
        
        // Hiện lobby
        hideAllScreens();
        document.getElementById('lobbyScreen').classList.remove('hidden');
        updateGameStatus(`Logging in as ${user.username}...`);
        
        // Gọi socket login
        window.socketClient.login(user.username);
        
        // Đợi một chút cho backend xử lý
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('✅ Login request sent');
    } else {
        // Nếu chưa login, redirect về trang login
        console.log('❌ User not logged in, redirecting to login page');
        window.location.href = '/login.html';
        return;
    }
    
    console.log('✅ Client ready!');
});