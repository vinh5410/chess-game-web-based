class MultiplayerChess {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.game = null;
        
        // Canvas settings
        this.canvasSize = 640;
        this.squareSize = 80;
        
        // Colors
        this.lightSquareColor = '#f0d9b5';
        this.darkSquareColor = '#b58863';
        this.highlightColor = 'rgba(255, 255, 0, 0.4)';
        this.legalMoveColor = 'rgba(0, 150, 0, 0.6)';
        this.captureColor = 'rgba(200, 0, 0, 0.6)';
        this.selectedColor = 'rgba(255, 200, 0, 0.6)';
        this.lastMoveColor = 'rgba(255, 255, 0, 0.3)';
        
        // Game state
        this.playerColor = null; // 'white' or 'black'
        this.opponentName = '';
        this.isMyTurn = false;
        this.gameStarted = false;
        this.gameOver = false;
        this.selectedSquare = null;
        this.legalMoves = [];
        this.lastMove = null;
        this.isFlipped = false;
        
        // Mouse interaction
        this.isDragging = false;
        this.dragPiece = null;
        this.dragStartSquare = null;
        this.mousePos = { x: 0, y: 0 };
        
        // Piece images
        this.pieceImages = {};
        this.imagesLoaded = false;
        
        // Timer
        this.playerTime = 300; // 5 minutes in seconds
        this.opponentTime = 300;
        this.timerInterval = null;
        
        // Socket client
        this.socket = window.socketClient;
        
        this.init();
    }
    
    async init() {
        console.log('🎮 Initializing Multiplayer Chess...');
        
        // Check Chess.js
        if (typeof window.Chess !== 'function') {
            console.error('❌ Chess.js not available');
            return false;
        }
        
        // Initialize canvas
        this.canvas = document.getElementById('chessCanvas');
        if (!this.canvas) {
            console.error('❌ Canvas element not found');
            return false;
        }
        
        this.ctx = this.canvas.getContext('2d');
        this.game = new window.Chess();
        
        // Load piece images
        await this.loadPieceImages();
        
        // Setup event listeners
        this.setupEventListeners();
        this.setupSocketListeners();
        
        // Connect to server
        this.socket.connect();
        
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
                    // Fallback to Wikipedia CDN
                    const cdnUrl = `https://upload.wikimedia.org/wikipedia/commons/${this.getWikipediaPath(piece)}`;
                    img.src = cdnUrl;
                    img.onload = () => resolve();
                    img.onerror = () => resolve(); // Continue anyway
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
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('click', this.onClick.bind(this));
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
        
        // Enter key for chat
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    sendMessage();
                }
            });
        }
        
        // Username input enter
        const usernameInput = document.getElementById('usernameInput');
        if (usernameInput) {
            usernameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    login();
                }
            });
        }
    }
    
    setupSocketListeners() {
        console.log('🔌 Setting up socket listeners...');
        
        // Connection events
        this.socket.on('connection_success', () => {
            console.log('✅ Socket connected');
            updateGameStatus('Connected! Please login.');
        });
        
        this.socket.on('connection_error', (error) => {
            console.error('❌ Connection error:', error);
            updateGameStatus('⚠️ Connection error. Please refresh.');
        });
        
        this.socket.on('disconnected', (reason) => {
            console.log('❌ Disconnected:', reason);
            updateGameStatus('⚠️ Disconnected from server.');
        });
        
        // User events
        this.socket.on('user:login_success', (data) => {
            console.log('✅ Login success:', data);
            this.onLoginSuccess(data);
        });
        
        this.socket.on('user:login_error', (data) => {
            console.error('❌ Login error:', data);
            alert(data.message || 'Login failed');
        });
        
        this.socket.on('users:update', (data) => {
            console.log('👥 Users update:', data);
            this.updateOnlineUsers(data.users);
        });
        
        // Matchmaking events
        this.socket.on('matchmaking:match_found', (data) => {
            console.log('🎉 Match found!', data);
            this.onMatchFound(data);
        });
        
        this.socket.on('matchmaking:waiting', (data) => {
            console.log('⏳ Waiting for match...', data);
            document.getElementById('searchStatus').textContent = `Searching... (${data.queue} players in queue)`;
        });
        
        // Room events
        this.socket.on('room:created', (data) => {
            console.log('🔐 Room created:', data);
            this.onRoomCreated(data);
        });
        
        this.socket.on('room:joined', (data) => {
            console.log('🔗 Room joined:', data);
            this.onRoomJoined(data);
        });
        
        this.socket.on('room:error', (data) => {
            console.error('❌ Room error:', data);
            alert(data.message || 'Room error');
        });
        
        this.socket.on('room:opponent_joined', (data) => {
            console.log('👥 Opponent joined:', data);
            this.onOpponentJoined(data);
        });
        
        this.socket.on('room:opponent_left', (data) => {
            console.log('👋 Opponent left:', data);
            this.onOpponentLeft(data);
        });
        
        // Game events
        this.socket.on('game:start', (data) => {
            console.log('🎮 Game starting:', data);
            this.onGameStart(data);
        });
        
        this.socket.on('game:move', (data) => {
            console.log('♟️ Move received:', data);
            this.onOpponentMove(data);
        });
        
        this.socket.on('game:invalid_move', (data) => {
            console.error('❌ Invalid move:', data);
            alert('Invalid move!');
        });
        
        this.socket.on('game:over', (data) => {
            console.log('🏁 Game over:', data);
            this.onGameOver(data);
        });
        
        this.socket.on('game:draw_offer', (data) => {
            console.log('🤝 Draw offer received');
            this.onDrawOffer(data);
        });
        
        this.socket.on('game:draw_accepted', (data) => {
            console.log('🤝 Draw accepted');
            this.onDrawAccepted(data);
        });
        
        this.socket.on('game:draw_declined', (data) => {
            console.log('❌ Draw declined');
            alert('Draw offer declined');
        });
        
        // Chat events
        this.socket.on('chat:message', (data) => {
            console.log('💬 Chat message:', data);
            this.onChatMessage(data);
        });
    }
    
    // Socket event handlers
    onLoginSuccess(data) {
        hideAllScreens();
        document.getElementById('lobbyScreen').classList.remove('hidden');
        updateGameStatus(`Welcome, ${data.username}!`);
    }
    
    updateOnlineUsers(users) {
        const onlineCount = document.getElementById('onlineUsers');
        if (onlineCount) {
            onlineCount.textContent = `👥 Online: ${users.length}`;
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
        hideAllScreens();
        document.getElementById('gameScreen').classList.remove('hidden');
    }
    
    onRoomCreated(data) {
        console.log('🔐 Private room created:', data.roomCode);
        this.socket.setCurrentRoom(data.roomId);
        hideAllScreens();
        document.getElementById('inviteFriendScreen').classList.remove('hidden');
        document.getElementById('roomCodeDisplay').value = data.roomCode;
        updateGameStatus('Waiting for opponent...');
    }
    
    onRoomJoined(data) {
        console.log('🔗 Joined room:', data.roomId);
        this.socket.setCurrentRoom(data.roomId);
        hideAllScreens();
        document.getElementById('gameScreen').classList.remove('hidden');
    }
    
    onOpponentJoined(data) {
        console.log('👥 Opponent joined:', data.opponent);
        this.opponentName = data.opponent.username;
        updateGameStatus('Opponent joined! Game starting...');
    }
    
    onOpponentLeft(data) {
        console.log('👋 Opponent left');
        alert('Opponent left the game');
        this.gameOver = true;
        updateGameStatus('Opponent left the game');
    }
    
    onGameStart(data) {
        console.log('🎮 Game started!', data);
        
        // Set player color
        this.playerColor = data.color;
        this.opponentName = data.opponent.username;
        this.isMyTurn = (data.color === 'white');
        this.gameStarted = true;
        this.gameOver = false;
        
        // Auto flip board if playing as black
        this.isFlipped = (this.playerColor === 'black');
        
        // Update UI
        document.getElementById('playerName').textContent = this.socket.getUsername() || 'You';
        document.getElementById('opponentName').textContent = this.opponentName;
        
        const playerColorIcon = this.playerColor === 'white' ? '♔ White' : '♚ Black';
        const opponentColorIcon = this.playerColor === 'white' ? '♚ Black' : '♔ White';
        document.getElementById('playerColor').textContent = playerColorIcon;
        document.getElementById('opponentColor').textContent = opponentColorIcon;
        
        // Reset game
        this.game = new window.Chess();
        this.selectedSquare = null;
        this.legalMoves = [];
        this.lastMove = null;
        
        // Start timer
        this.startTimer();
        
        // Draw board
        this.draw();
        
        updateGameStatus(this.isMyTurn ? 'Your turn!' : 'Opponent\'s turn');
    }
    
    onOpponentMove(data) {
        console.log('♟️ Opponent move:', data.move);
        
        try {
            const move = this.game.move(data.move);
            if (move) {
                this.lastMove = { from: move.from, to: move.to };
                this.isMyTurn = true;
                this.draw();
                updateGameStatus('Your turn!');
                
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
        const accept = confirm(`${data.from} offers a draw. Accept?`);
        this.socket.respondDraw(accept);
    }
    
    onDrawAccepted(data) {
        this.gameOver = true;
        this.gameStarted = false;
        this.stopTimer();
        document.getElementById('winnerText').textContent = 'Game drawn by agreement! 🤝';
        document.getElementById('gameOverOverlay').classList.remove('hidden');
    }
    
    onChatMessage(data) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${data.sender === this.socket.getUserId() ? 'own' : 'other'}`;
        messageDiv.innerHTML = `
            <div class="sender">${data.username}</div>
            <div class="text">${this.escapeHtml(data.message)}</div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Mouse handlers
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
        
        if (targetSquare && targetSquare !== this.dragStartSquare) {
            this.tryMove(this.dragStartSquare, targetSquare);
        }
        
        this.isDragging = false;
        this.dragPiece = null;
        this.dragStartSquare = null;
        this.selectedSquare = null;
        this.legalMoves = [];
        this.draw();
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
            this.selectedSquare = null;
            this.legalMoves = [];
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
        try {
            const moveObj = this.game.move({
                from,
                to,
                promotion: 'q'
            });
            
            if (moveObj) {
                console.log('✅ Valid move:', moveObj.san);
                this.lastMove = { from: moveObj.from, to: moveObj.to };
                this.isMyTurn = false;
                
                // Send move to server
                this.socket.makeMove(moveObj.san);
                
                this.draw();
                updateGameStatus('Opponent\'s turn');
                
                // Check for game over locally
                if (this.checkGameOver()) {
                    return true;
                }
            }
        } catch (error) {
            console.log('❌ Invalid move');
        }
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
    
    // Coordinate conversion
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
    
    // Drawing methods
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
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
        this.ctx.font = '12px Arial';
        
        for (let file = 0; file < 8; file++) {
            const letter = String.fromCharCode(97 + file);
            const x = file * this.squareSize + 5;
            const y = 8 * this.squareSize - 5;
            const isDark = file % 2 === 0;
            this.ctx.fillStyle = isDark ? this.darkSquareColor : this.lightSquareColor;
            this.ctx.fillText(letter, x, y);
        }
        
        for (let rank = 0; rank < 8; rank++) {
            const number = this.isFlipped ? rank + 1 : 8 - rank;
            const x = 8 * this.squareSize - 15;
            const y = rank * this.squareSize + 15;
            const isDark = rank % 2 === 1;
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
    
    // Timer
    startTimer() {
        this.stopTimer();
        
        this.timerInterval = setInterval(() => {
            if (this.isMyTurn) {
                this.playerTime--;
                if (this.playerTime <= 0) {
                    this.playerTime = 0;
                    this.stopTimer();
                    // Time out - will be handled by server
                }
                this.updateTimerDisplay();
            } else {
                this.opponentTime--;
                if (this.opponentTime <= 0) {
                    this.opponentTime = 0;
                    this.stopTimer();
                }
                this.updateTimerDisplay();
            }
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
            const secs = seconds % 60;
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };
        
        const playerTimer = document.getElementById('playerTimer');
        const opponentTimer = document.getElementById('opponentTimer');
        
        if (playerTimer) playerTimer.textContent = formatTime(this.playerTime);
        if (opponentTimer) opponentTimer.textContent = formatTime(this.opponentTime);
    }
    
    flipBoard() {
        this.isFlipped = !this.isFlipped;
        this.draw();
    }
}

// Global instance
let gameInstance = null;

// UI Functions
function updateGameStatus(message) {
    const statusEl = document.getElementById('gameStatus');
    if (statusEl) {
        statusEl.textContent = message;
    }
}

function hideAllScreens() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('lobbyScreen').classList.add('hidden');
    document.getElementById('randomMatchScreen').classList.add('hidden');
    document.getElementById('inviteFriendScreen').classList.add('hidden');
    document.getElementById('joinRoomScreen').classList.add('hidden');
    document.getElementById('gameScreen').classList.add('hidden');
}

function login() {
    const usernameInput = document.getElementById('usernameInput');
    const username = usernameInput.value.trim();
    
    if (!username) {
        alert('Please enter your name');
        return;
    }
    
    if (username.length < 2) {
        alert('Name must be at least 2 characters');
        return;
    }
    
    window.socketClient.login(username);
}

function logout() {
    window.socketClient.logout();
    hideAllScreens();
    document.getElementById('loginScreen').classList.remove('hidden');
    updateGameStatus('Logged out');
}

function showRandomMatch() {
    hideAllScreens();
    document.getElementById('randomMatchScreen').classList.remove('hidden');
    window.socketClient.findRandomMatch();
}

function cancelSearch() {
    window.socketClient.cancelRandomMatch();
    backToLobby();
}

function showInviteFriend() {
    window.socketClient.createPrivateRoom();
}

function cancelInvite() {
    window.socketClient.leaveRoom();
    backToLobby();
}

function copyRoomCode() {
    const roomCodeInput = document.getElementById('roomCodeDisplay');
    roomCodeInput.select();
    document.execCommand('copy');
    
    const copyBtn = document.querySelector('.copy-btn');
    const originalText = copyBtn.textContent;
    copyBtn.textContent = '✅ Copied!';
    setTimeout(() => {
        copyBtn.textContent = originalText;
    }, 2000);
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
    hideAllScreens();
    document.getElementById('lobbyScreen').classList.remove('hidden');
    updateGameStatus('Choose game mode');
}

function offerDraw() {
    if (confirm('Offer draw to opponent?')) {
        window.socketClient.offerDraw();
    }
}

function resign() {
    if (confirm('Are you sure you want to resign?')) {
        window.socketClient.resign();
    }
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
    
    window.socketClient.sendChatMessage(message);
    chatInput.value = '';
}

function inviteUser(userId) {
    // TODO: Implement direct invitation
    alert('Direct invitation feature coming soon!');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Initializing Multiplayer Chess...');
    
    gameInstance = new MultiplayerChess();
    
    console.log('✅ Client ready!');
});