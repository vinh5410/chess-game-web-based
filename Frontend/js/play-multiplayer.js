// Auto-fill username if logged in
document.addEventListener('DOMContentLoaded', () => {
    const user = getCurrentUser();
    if (user) {
        const usernameInput = document.getElementById('usernameInput');
        if (usernameInput) {
            usernameInput.value = user.username;
            usernameInput.disabled = true;
        }
    }
});

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
        this.playerColor = null;
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
        this.playerTime = 300;
        this.opponentTime = 300;
        this.timerInterval = null;
        
        // Socket client
        this.socket = window.socketClient;
        
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
        
        await this.loadPieceImages();
        this.setupEventListeners();
        // Make canvas responsive to viewport
        this.resizeCanvas();
        
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

    resizeCanvas() {
        if (!this.canvas) return;

        const container = this.canvas.closest('.chessboard-container') || this.canvas.parentElement;
        if (!container) return;

        // Choose size based on container width and viewport height to keep board visible
        const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
        const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);

        // prefer container width but don't exceed 80% of viewport height
        const containerWidth = container.clientWidth;
        const maxByHeight = Math.floor(vh * 0.72);
        const size = Math.max(200, Math.min(containerWidth, maxByHeight));

        const dpr = window.devicePixelRatio || 1;

        // set CSS size (logical pixels)
        this.canvas.style.width = size + 'px';
        this.canvas.style.height = size + 'px';

        // set actual pixel buffer for crispness
        this.canvas.width = Math.floor(size * dpr);
        this.canvas.height = Math.floor(size * dpr);

        // scale drawing operations to account for DPR
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // update internal sizes used for drawing
        this.canvasSize = size;
        this.squareSize = size / 8;

        // redraw
        if (this.imagesLoaded) this.draw();
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
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('click', this.onClick.bind(this));
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
        
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

        // Handle window resize to keep canvas responsive
        window.addEventListener('resize', () => {
            // debounce a little
            clearTimeout(this._resizeTimeout);
            this._resizeTimeout = setTimeout(() => this.resizeCanvas(), 120);
        });
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
            console.log('♟️ Move received:', data);
            this.onOpponentMove(data);
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
            alert('Draw offer declined');
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
        
        // Hide game over overlay nếu còn
        const gameOverOverlay = document.getElementById('gameOverOverlay');
        if (gameOverOverlay) {
            gameOverOverlay.classList.add('hidden');
        }
        
        hideAllScreens();
        document.getElementById('gameScreen').classList.remove('hidden');
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
            document.getElementById('roomCodeDisplay').value = data.roomCode;
            updateGameStatus(`Room created! Share code: ${data.roomCode}`);
        }
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
        
        // Chuyển người tạo room sang game screen
        hideAllScreens();
        document.getElementById('gameScreen').classList.remove('hidden');
        
        // Hide game over overlay nếu còn
        const gameOverOverlay = document.getElementById('gameOverOverlay');
        if (gameOverOverlay) {
            gameOverOverlay.classList.add('hidden');
        }
        
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
        
        this.playerColor = data.color;
        this.opponentName = data.opponent.username;
        this.isMyTurn = (data.color === 'white');
        this.gameStarted = true;
        this.gameOver = false;
        this.isFlipped = (this.playerColor === 'black');
        
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
        
        document.getElementById('playerName').textContent = this.socket.getUsername() || 'You';
        document.getElementById('opponentName').textContent = this.opponentName;
        
        const playerColorIcon = this.playerColor === 'white' ? '♔ White' : '♚ Black';
        const opponentColorIcon = this.playerColor === 'white' ? '♚ Black' : '♔ White';
        document.getElementById('playerColor').textContent = playerColorIcon;
        document.getElementById('opponentColor').textContent = opponentColorIcon;
        
        this.game = new window.Chess();
        this.selectedSquare = null;
        this.legalMoves = [];
        this.lastMove = null;
        
        this.updateTimerDisplay();
        this.startTimer();
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
                
                this.socket.makeMove(moveObj.san);
                
                this.draw();
                updateGameStatus('Opponent\'s turn');
                
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
    
    startTimer() {
        this.stopTimer();
        
        this.timerInterval = setInterval(() => {
            if (this.isMyTurn) {
                this.playerTime--;
                if (this.playerTime <= 0) {
                    this.playerTime = 0;
                    this.stopTimer();
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
    // re-enable find button
    const findBtn = document.getElementById('findMatchBtn');
    if (findBtn) findBtn.disabled = false;
}

function login() {
    const user = getCurrentUser();
    let username;
    
    if (user) {
        username = user.username;
    } else {
        username = document.getElementById('usernameInput').value.trim();
    }
    
    if (!username) {
        alert('Please enter your name');
        return;
    }
    
    if (username.length < 3) {
        alert('Username must be at least 3 characters');
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
    
    // Render time selector
    renderTimeSelector('randomMatchTimeSelector');
    
    updateGameStatus('Select time control and click Find Match');
}

function startRandomSearch() {
    const timeControl = getSelectedTimeControl();
    document.getElementById('searchStatus').textContent = 'Searching for opponent...';
    window.socketClient.findRandomMatch(timeControl);
    // disable find button to prevent double-clicks
    const findBtn = document.getElementById('findMatchBtn');
    if (findBtn) findBtn.disabled = true;
}

function cancelSearch() {
    window.socketClient.cancelRandomMatch();
    backToLobby();
    // re-enable find button
    const findBtn = document.getElementById('findMatchBtn');
    if (findBtn) findBtn.disabled = false;
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
    
    // Ẩn ngay loginScreen để tránh nhấp nháy
    const loginScreen = document.getElementById('loginScreen');
    if (loginScreen) loginScreen.classList.add('hidden');
    
    // Auto-login hoặc tạo tên tạm thời
    hideAllScreens();
    const user = getCurrentUser();
    const username = user ? user.username : `Player_${Math.random().toString(36).substr(2, 9)}`;
    
    document.getElementById('lobbyScreen').classList.remove('hidden');
    updateGameStatus(`Welcome, ${username}!`);
    
    // Gọi socket login
    window.socketClient.login(username);
    
    console.log('✅ Client ready!');
});