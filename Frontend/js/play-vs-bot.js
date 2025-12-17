class ChessCanvasVsBot {
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
        
        // Game state
        this.selectedSquare = null;
        this.legalMoves = [];
        this.isFlipped = false;
        this.gameStarted = false;
        this.gameOver = false;
        this.isPlayerTurn = true;
        this.isThinking = false;
        this.botDifficulty = 5;
        this.winner = null;
        
        // Mouse interaction
        this.isDragging = false;
        this.dragPiece = null;
        this.dragStartSquare = null;
        this.mousePos = { x: 0, y: 0 };
        
        // Piece images
        this.pieceImages = {};
        this.imagesLoaded = false;
        this.playerColor = 'white'; // 'white' or 'black'
        this.selectedPlayerColor = null; // Chosen color before game starts
        
        // Promotion UI
        this.promotionUI = null;
        
        // API Cache
        this.apiCache = new Map();
        this.maxCacheSize = 100;

        // Player info DOM refs
        this.playerTopInfoEl = null;
        this.playerBottomInfoEl = null;
        this.chessboardContainerEl = null;
        
        // Render optimization
        this.needsRender = false;
        this.renderScheduled = false;
        
        this.viewStep = 0;
        this.initPromise = this.init();
    }
    
    async init() {
        console.log('🎯 Initializing Canvas Chess Game...');
        
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
        
        // Cache player info DOM elements
        this.chessboardContainerEl = document.getElementById('chessboardContainer') || this.canvas.parentNode;
        if (this.chessboardContainerEl) {
            this.playerTopInfoEl = this.chessboardContainerEl.querySelector('.player-info.player-top');
            this.playerBottomInfoEl = this.chessboardContainerEl.querySelector('.player-info.player-bottom');
        }

        // Initialize Promotion UI
        if (typeof PromotionUI !== 'undefined') {
            this.promotionUI = new PromotionUI(this.game, this.pieceImages, this.isFlipped);
        }

        // Setup event listeners
        this.setupEventListeners();
        
        // Initial draw
        this.draw();
        
        console.log('✅ Canvas Chess Game initialized');
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
                    console.warn(`❌ Failed to load ${piece}.png`);
                    resolve();
                };
            });
            
            // Try local first
            img.src = `./assets/pieces/${piece}.png`;
            
            // Fallback to CDN
            img.onerror = () => {
                img.src = `https://upload.wikimedia.org/wikipedia/commons/${this.getWikipediaPath(piece)}`;
            };
            
            this.pieceImages[piece] = img;
            loadPromises.push(promise);
        }
        
        await Promise.all(loadPromises);
        this.imagesLoaded = true;
        console.log('✅ Piece images loaded');
    }
    
    getWikipediaPath(piece) {
        const paths = {
            'wK': '4/42/Chess_klt45.svg',
            'wQ': '1/15/Chess_qlt45.svg',
            'wR': '7/72/Chess_rlt45.svg',
            'wB': 'b/b1/Chess_blt45.svg',
            'wN': '7/70/Chess_nlt45.svg',
            'wP': '4/45/Chess_plt45.svg',
            'bK': 'f/f0/Chess_kdt45.svg',
            'bQ': '4/47/Chess_qdt45.svg',
            'bR': 'f/ff/Chess_rdt45.svg',
            'bB': '9/98/Chess_bdt45.svg',
            'bN': 'e/ef/Chess_ndt45.svg',
            'bP': 'c/c7/Chess_pdt45.svg'
        };
        return paths[piece] || '';
    }
    
    setupEventListeners() {
        // Mouse events (desktop only)
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('click', this.onClick.bind(this));
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
        
        // Touch events for mobile
        this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
        this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
        this.canvas.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
        
        window.addEventListener('resize', this.handleResize.bind(this));
    }
    
    // Touch event handlers
    onTouchStart(e) {
        e.preventDefault();
        if (e.touches.length !== 1) return;
        
        const touch = e.touches[0];
        this.touchStartPos = { x: touch.clientX, y: touch.clientY };
        this.touchMoved = false;
        this.touchStartTime = Date.now();
    }
    
    onTouchMove(e) {
        e.preventDefault();
        if (e.touches.length !== 1) return;
        
        const touch = e.touches[0];
        
        // Check if finger moved significantly
        if (this.touchStartPos) {
            const dx = touch.clientX - this.touchStartPos.x;
            const dy = touch.clientY - this.touchStartPos.y;
            if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                // Start dragging if not already
                if (!this.touchMoved) {
                    this.touchMoved = true;
                    this.onMouseDown({ clientX: this.touchStartPos.x, clientY: this.touchStartPos.y });
                }
                this.onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
            }
        }
    }
    
    onTouchEnd(e) {
        e.preventDefault();
        const touch = e.changedTouches[0];
        
        if (this.touchMoved && this.isDragging) {
            // Was dragging - complete the move
            this.onMouseUp({ clientX: touch.clientX, clientY: touch.clientY });
        } else {
            // Tap - treat as click
            this.onClick({ clientX: touch.clientX, clientY: touch.clientY });
        }
        
        this.touchStartPos = null;
        this.touchMoved = false;
    }
    
    handleResize() {
        const container = this.canvas.parentElement;
        const maxSize = Math.min(container.clientWidth - 40, 640);
        
        if (maxSize !== this.canvasSize) {
            this.canvasSize = maxSize;
            this.squareSize = maxSize / 8;
            this.canvas.width = maxSize;
            this.canvas.height = maxSize;
            this.draw();
        }
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
    
    // Mouse event handlers
    onMouseDown(e) {
        console.log('isPlayerTurn:', this.isPlayerTurn, 'gameStarted:', this.gameStarted, 'gameOver:', this.gameOver);
        if (!this.gameStarted || this.gameOver || !this.isPlayerTurn || this.isThinking) return;
        
        const rect = this.canvas.getBoundingClientRect();
        // Scale coordinates based on actual canvas size vs displayed size
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        
        const square = this.canvasToSquare(x, y);
        if (!square) return;
        
        const piece = this.game.get(square);
        // FIX: Allow dragging pieces of player's color
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
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        this.mousePos = {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
        
        if (this.isDragging) {
            this.draw();
        }
    }
    
    onMouseUp(e) {
        if (!this.isDragging || !this.dragStartSquare) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        
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
        if (this.viewStep !== this.game.history({ verbose: true }).length) return;
        if (this.isDragging) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        
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
            this.draw();
            return;
        }
        
        const piece = this.game.get(square);
        // FIX: Allow selecting pieces of player's color
        if (piece && piece.color === this.playerColor.charAt(0) && this.isPlayerTurn && !this.isThinking) {
            this.selectedSquare = square;
            this.legalMoves = this.game.moves({ square, verbose: true });
            this.draw();
        }
    }
    
    tryMove(from, to) {
        if (this.viewStep !== this.game.history({ verbose: true }).length) return false;
        
        // Check if this is a promotion move
        const moves = this.game.moves({ square: from, verbose: true });
        const promotionMove = moves.find(m => m.to === to && m.promotion);
        
        if (promotionMove && this.promotionUI) {
            // Clear selection highlights before showing promotion UI
            this.selectedSquare = null;
            this.legalMoves = [];
            this.draw();
            
            // Show promotion UI
            const color = this.playerColor === 'white' ? 'w' : 'b';
            this.promotionUI.showPromotionDialog(from, to, color, (selectedPiece) => {
                try {
                    const move = this.game.move({
                        from,
                        to,
                        promotion: selectedPiece
                    });
                    
                    if (move) {
                        console.log('✅ Player move:', move.san);
                        this.selectedSquare = null;
                        this.legalMoves = [];
                        this.onMove(move);
                    }
                } catch (error) {
                    console.log('❌ Invalid promotion move');
                }
            }, this.canvas, this.isFlipped);
            return true;
        }
        
        try {
            const move = this.game.move({
                from,
                to,
                promotion: 'q' // Default promotion if UI not available
            });
            
            if (move) {
                console.log('✅ Player move:', move.san);
                this.onMove(move);
                return true;
            }
        } catch (error) {
            console.log('❌ Invalid move:', from, 'to', to);
        }
        return false;
    }
    
    onMove(move) {
        this.draw();
        this.updateGameStatus('🤖 Bot is thinking...');
        this.viewStep = this.game.history({ verbose: true }).length;
        updateMoveHistoryUI();
        if (this.checkGameOver()) {
            return;
        }
        
        this.isPlayerTurn = false;
        setTimeout(() => this.makeBotMove(), 750);
    }
    
    // Drawing methods - use requestAnimationFrame to prevent flickering
    draw() {
        if (this.renderScheduled) return;
        this.renderScheduled = true;
        
        requestAnimationFrame(() => {
            this.renderScheduled = false;
            this._doDraw();
        });
    }
    
    _doDraw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawBoard();
        this.drawCoordinates();
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
            const y = 8 * this.squareSize - 2;
            // Bottom row: when not flipped, rank 1 (index 7), a1 is light (file+rank=0+0=even)
            const isDark = (file + 7) % 2 === 0;
            this.ctx.fillStyle = isDark ? this.darkSquareColor : this.lightSquareColor;
            this.ctx.fillText(letter, x, y);
        }
        
        // Draw numbers (1-8) at right of each rank
        this.ctx.textBaseline = 'top';
        for (let rank = 0; rank < 8; rank++) {
            const number = this.isFlipped ? rank + 1 : 8 - rank;
            const x = this.canvas.width - fontSize + 2;
            const y = rank * this.squareSize + 2;
            const isDark = (7 + rank) % 2 === 0;
            this.ctx.fillStyle = isDark ? this.darkSquareColor : this.lightSquareColor;
            this.ctx.fillText(number, x, y);
        }
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
                // Capture indicator - hollow circle
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
                // Move dot
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
                // FIX: Đảo ngược rank để rank 8 ở trên, rank 1 ở dưới
                const boardRank = this.isFlipped ? 7 - rank : rank;
                const piece = board[boardRank][file];
                if (!piece) continue;
                
                // FIX: Tính toán square đúng
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
            this.ctx.font = `${this.squareSize * 0.6}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            this.ctx.fillStyle = piece.color === 'w' ? '#fff' : '#000';
            this.ctx.strokeStyle = piece.color === 'w' ? '#000' : '#fff';
            this.ctx.lineWidth = 1;
            
            const centerX = x + this.squareSize / 2;
            const centerY = y + this.squareSize / 2;
            
            this.ctx.fillText(symbol, centerX, centerY);
            this.ctx.strokeText(symbol, centerX, centerY);
            
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
    
    // Bot logic với Lichess API
    async makeBotMove() {
        if (this.gameOver || !this.gameStarted) return;
        
        console.log('🤖 Bot is thinking...');
        this.isThinking = true;
        this.updateGameStatus('🤖 Bot is thinking...');
        
        try {
            const moves = this.game.moves();
            if (moves.length === 0) return;
            
            let selectedMove = await this.selectBotMove(moves);
            const thinkTime = Math.max(500, this.botDifficulty * 100 + Math.random() * 1000);
            await new Promise(resolve => setTimeout(resolve, thinkTime));
            
            const move = this.game.move(selectedMove);
            console.log('🤖 Bot move:', move.san);
            
            this.draw();
            this.updateGameStatus();
            this.viewStep = this.game.history({ verbose: true }).length;
            updateMoveHistoryUI();
            
            if (this.checkGameOver()) {
                return;
            }
            
            this.isPlayerTurn = true;
            this.isThinking = false;
            this.updateGameStatus('👤 Your turn');
            
        } catch (error) {
            console.error('❌ Bot move error:', error);
            this.isPlayerTurn = true;
            this.isThinking = false;
            this.updateGameStatus('Your turn');
        }
    }
    
    async selectBotMove(moves) {
        try {
            console.log(`🎯 Selecting move for difficulty level ${this.botDifficulty}`);
            
            if (this.botDifficulty === 1) {
                return this.getRandomMove(moves);
            }
            
            if (this.botDifficulty === 3) {
                return this.getRuleBasedBotMove(moves);
            }
            
            if (this.botDifficulty >= 5) {
                const apiMove = await this.getLichessMove();
                if (apiMove) {
                    const errorRate = this.getErrorRate(this.botDifficulty);
                    if (Math.random() < errorRate) {
                        console.log(`🎲 Bot making intentional mistake (${errorRate * 100}% chance)`);
                        return this.getRuleBasedBotMove(moves);
                    }
                    return apiMove;
                }
            }
            
            return this.getRuleBasedBotMove(moves);
            
        } catch (error) {
            console.error('Bot move selection error:', error);
            return this.getRandomMove(moves);
        }
    }
    
    async getLichessMove() {
        const fen = this.game.fen();
        const cacheKey = `${fen}_${this.botDifficulty}`;
        
        if (this.apiCache.has(cacheKey)) {
            console.log('📦 Using cached API response');
            return this.apiCache.get(cacheKey);
        }
        
        try {
            console.log('🌐 Calling Lichess API...');
            
            const response = await fetch(`https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=3`, {
                method: 'GET',
                headers: { 
                    'Accept': 'application/json',
                    'User-Agent': 'ChessGame/1.0'
                },
                signal: AbortSignal.timeout(5000)
            });

            if (!response.ok) {
                throw new Error(`Lichess API error: ${response.status}`);
            }

            const data = await response.json();
            console.log('📡 Lichess API response:', data);
            
            if (data.pvs && data.pvs.length > 0) {
                const selectedPV = this.selectPVByDifficulty(data.pvs, this.botDifficulty);
                
                if (selectedPV && selectedPV.moves) {
                    const bestMoveUCI = selectedPV.moves.split(' ')[0];
                    console.log('🎯 Selected UCI move:', bestMoveUCI);
                    
                    const sanMove = this.uciToSan(bestMoveUCI);
                    if (sanMove) {
                        this.cacheAPIResponse(cacheKey, sanMove);
                        return sanMove;
                    }
                }
            }
            
            return null;
            
        } catch (error) {
            console.error('❌ Lichess API error:', error.message);
            return null;
        }
    }
    
    uciToSan(uciMove) {
        try {
            const testGame = new window.Chess(this.game.fen());
            const move = testGame.move({
                from: uciMove.substring(0, 2),
                to: uciMove.substring(2, 4),
                promotion: uciMove.length > 4 ? uciMove.substring(4, 5) : undefined
            });
            
            if (move) {
                console.log(`🔄 Converted ${uciMove} to ${move.san}`);
                return move.san;
            }
            return null;
        } catch (error) {
            console.error('❌ UCI to SAN conversion error:', error);
            return null;
        }
    }
    
    selectPVByDifficulty(pvs, difficulty) {
        if (pvs.length === 0) return null;
        
        if (difficulty >= 15) return pvs[0];
        if (difficulty >= 10) return Math.random() < 0.9 ? pvs[0] : (pvs[1] || pvs[0]);
        if (difficulty >= 8) {
            if (Math.random() < 0.8) return pvs[0];
            const topMoves = pvs.slice(0, 2);
            return topMoves[Math.floor(Math.random() * topMoves.length)];
        }
        
        const topMoves = pvs.slice(0, 3);
        return Math.random() < 0.7 ? pvs[0] : topMoves[Math.floor(Math.random() * topMoves.length)];
    }
    
    getErrorRate(difficulty) {
        const errorRates = { 5: 0.25, 8: 0.15, 10: 0.08, 15: 0.02 };
        return errorRates[difficulty] || 0.1;
    }
    
    cacheAPIResponse(key, value) {
        if (this.apiCache.size >= this.maxCacheSize) {
            const firstKey = this.apiCache.keys().next().value;
            this.apiCache.delete(firstKey);
        }
        this.apiCache.set(key, value);
    }
    
    getRandomMove(moves) {
        const randomMove = moves[Math.floor(Math.random() * moves.length)];
        console.log('🎲 Selected random move:', randomMove);
        return randomMove;
    }
    
    getRuleBasedBotMove(moves) {
        let selectedMove = moves[Math.floor(Math.random() * moves.length)];
        
        try {
            if (this.botDifficulty >= 3) {
                const captures = moves.filter(move => {
                    const testGame = new window.Chess(this.game.fen());
                    const moveObj = testGame.move(move);
                    return moveObj && moveObj.captured;
                });
                
                if (captures.length > 0 && Math.random() < 0.7) {
                    selectedMove = captures[Math.floor(Math.random() * captures.length)];
                    console.log('🎯 Rule-based: Preferred capture');
                }
            }
            
            if (this.botDifficulty >= 5) {
                const checks = moves.filter(move => {
                    const testGame = new window.Chess(this.game.fen());
                    testGame.move(move);
                    return testGame.inCheck();
                });
                
                if (checks.length > 0 && Math.random() < 0.5) {
                    selectedMove = checks[Math.floor(Math.random() * checks.length)];
                    console.log('🎯 Rule-based: Preferred check');
                }
            }
        } catch (error) {
            console.error('Rule-based move selection error:', error);
        }
        
        return selectedMove;
    }
    
    // Game control methods
    async startGame(difficulty, playerColor = 'white') {
        console.log(`🎮 Starting canvas game - Difficulty: ${difficulty}, Player Color: ${playerColor}`);
        
        if (!await this.initPromise) {
            alert('Game not ready. Please refresh the page.');
            return;
        }
        
        this.botDifficulty = difficulty;
        this.playerColor = playerColor;
        this.game = new window.Chess();
        this.gameStarted = true;
        this.gameOver = false;
        this.winner = null;
        this.selectedSquare = null;
        this.legalMoves = [];
        this.apiCache.clear();
        this.viewStep = 0;
        // FIX: Flip khi player chọn BLACK (để quân đen xuống dưới)
        // Không flip khi player chọn WHITE (quân trắng đã ở dưới mặc định)
        this.isFlipped = (playerColor === 'black');
        
        // Determine first turn
        if (playerColor === 'white') {
            this.isPlayerTurn = true;
            this.isThinking = false;
        } else {
            this.isPlayerTurn = false;
            this.isThinking = false;
        }
        
        this.draw();
        
        // Initialize move history UI
        updateMoveHistoryUI();
        
        // Swap player info bars if flipped (when playing black)
        this.updatePlayerInfoPosition();;
        
        // Update UI - Bot Info
        const botNameTop = document.getElementById('botNameTop');
        const botRatingTop = document.getElementById('botRatingTop');
        if (botNameTop) {
            botNameTop.textContent = 'Chess Bot';
        }
        if (botRatingTop) {
            botRatingTop.textContent = `LV ${difficulty}`;
        }
        
        // Update UI - Player Info (Get ELO from ranking)
        const playerNameBottom = document.getElementById('playerNameBottom');
        const playerRatingBottom = document.getElementById('playerRatingBottom');
        
        // Get player username from localStorage
        let username = 'Guest';
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                username = user.username || user.name || 'Guest';
            } catch (e) {
                console.log('Error parsing user data');
            }
        }
        
        if (playerNameBottom) {
            playerNameBottom.textContent = username;
        }
        
        // Fetch player ELO from ranking API
        if (playerRatingBottom) {
            try {
                const response = await fetch(`/api/user/${username}/stats`);
                if (response.ok) {
                    const data = await response.json();
                    playerRatingBottom.textContent = `ELO: ${data.elo || 1200}`;
                } else {
                    playerRatingBottom.textContent = 'ELO: 1200';
                }
            } catch (error) {
                console.log('Using default ELO:', error);
                playerRatingBottom.textContent = 'ELO: 1200';
            }
        }
        
        // Update panel title and subtitle (new UI matching multiplayer)
        const botLevelInfo = document.getElementById('botLevelInfo');
        if (botLevelInfo) {
            botLevelInfo.textContent = `Bot Lv.${difficulty} ${this.getDifficultyEmoji(difficulty)}`;
        }
        
        const playerColorInfo = document.getElementById('playerColorInfo');
        if (playerColorInfo) {
            const colorName = playerColor.charAt(0).toUpperCase() + playerColor.slice(1);
            playerColorInfo.textContent = colorName;
        }
        
        if (playerColor === 'white') {
            this.updateGameStatus('Your turn - Click a piece to move!');
        } else {
            this.updateGameStatus('Bot starts first...');
            // Bot makes first move
            setTimeout(() => this.makeBotMove(), 1000);
        }
        
        console.log('🏁 Canvas game setup complete - isFlipped:', this.isFlipped);
    }
    checkGameOver() {
        try {
            if (this.game.isGameOver()) {
                this.gameOver = true;
                this.gameStarted = false;
                this.isThinking = false;
                
                if (this.game.isCheckmate()) {
                    // Winner is opposite of current turn
                    const winnerColor = this.game.turn() === 'w' ? 'black' : 'white';
                    this.winner = (winnerColor === this.playerColor) ? 'player' : 'bot';
                } else {
                    this.winner = 'draw';
                }
                
                this.showGameOver();
                return true;
            }
        } catch (error) {
            console.error('Game over check error:', error);
        }
        return false;
    }
    
    showGameOver() {
        const overlay = document.getElementById('gameOverOverlay');
        const winnerText = document.getElementById('winnerText');
        
        if (!overlay || !winnerText) return;

        let result = '';
        if (this.winner === 'draw') {
            result = 'Game is a draw! 🤝';
        } else if (this.winner === 'player') {
            result = 'You win! 👑';
        } else {
            result = 'Bot wins! 🤖';
        }
        
        winnerText.textContent = result;
        overlay.classList.remove('hidden');
        
        console.log('🏁 Game over:', result);
    }
    
    updateGameStatus(customMessage) {
        const gameStatus = document.getElementById('gameStatus');
        if (!gameStatus) return;

        if (this.gameOver) return;
        
        let status = '';
        
        // Check for special game states first
        try {
            if (this.game.isCheckmate()) {
                const loser = this.game.turn() === 'w' ? 'White' : 'Black';
                status = `♚ Checkmate! ${loser} loses!`;
                gameStatus.textContent = status;
                return;
            }
            
            if (this.game.isStalemate()) {
                status = '🤝 Stalemate! Draw!';
                gameStatus.textContent = status;
                return;
            }
            
            if (this.game.isDraw()) {
                status = '🤝 Draw!';
                gameStatus.textContent = status;
                return;
            }
        } catch (error) {
            // Ignore
        }

        if (customMessage) {
            // Add check warning to custom message if in check
            try {
                if (this.game.inCheck()) {
                    customMessage += ' ⚠️ Check!';
                }
            } catch (error) {}
            gameStatus.textContent = customMessage;
            return;
        }
        
        if (this.isThinking) {
            status = '🤖 Bot is thinking...';
        } else if (this.isPlayerTurn) {
            status = '👤 Your turn';
        } else {
            status = '🤖 Bot\'s turn';
        }
        
        try {
            if (this.game.inCheck()) {
                status += ' ⚠️ Check!';
            }
        } catch (error) {
            // Ignore
        }
        
        gameStatus.textContent = status;
        
        // Update last move
        this.updateLastMove();
        
        // Update move counter
        this.updateMoveCount();
    }
    
    updateLastMove() {
        const lastMoveEl = document.getElementById('lastMove');
        if (!lastMoveEl) return;
        
        const history = this.game.history({ verbose: true });
        if (history.length === 0) {
            lastMoveEl.textContent = '-';
            return;
        }
        
        const lastMove = history[history.length - 1];
        const moveStr = `${lastMove.san}`;
        lastMoveEl.textContent = moveStr;
    }
    
    updateMoveCount() {
        const moveCountEl = document.getElementById('moveCount');
        if (!moveCountEl) return;
        
        const history = this.game.history();
        const moveNumber = Math.ceil(history.length / 2);
        moveCountEl.textContent = moveNumber;
        
        // Update current turn
        const turnEl = document.getElementById('currentTurn');
        if (turnEl) {
            const currentTurn = this.game.turn() === 'w' ? 'White' : 'Black';
            turnEl.textContent = currentTurn;
        }
    }
    
    // Update player info bar positions based on isFlipped state
    updatePlayerInfoPosition() {
        const topEl = this.playerTopInfoEl;
        const bottomEl = this.playerBottomInfoEl;
        const container = this.chessboardContainerEl || (this.canvas && this.canvas.parentNode);
        const canvas = this.canvas;

        if (topEl && bottomEl && container && canvas) {
            if (this.isFlipped) {
                // Show player's info on top (when playing black)
                container.insertBefore(bottomEl, canvas);
                bottomEl.classList.remove('player-bottom');
                bottomEl.classList.add('player-top');

                container.appendChild(topEl);
                topEl.classList.remove('player-top');
                topEl.classList.add('player-bottom');
            } else {
                // Restore bot on top, player at bottom (when playing white)
                container.insertBefore(topEl, canvas);
                topEl.classList.remove('player-bottom');
                topEl.classList.add('player-top');

                container.appendChild(bottomEl);
                bottomEl.classList.remove('player-top');
                bottomEl.classList.add('player-bottom');
            }
        }
    }
    
    flipBoard() {
        this.isFlipped = !this.isFlipped;
        this.draw();
        this.updatePlayerInfoPosition();
        console.log('🔄 Board flipped:', this.isFlipped ? 'Black perspective' : 'White perspective');
    }
    
    getDifficultyEmoji(level) {
        const emojis = {
            1: '😊', 3: '🙂', 5: '🤔', 
            8: '😤', 10: '🔥', 15: '🔥'
        };
        return emojis[level] || '🤔';
    }
}

// Global game instance
// Global game instance
let gameInstance = null;
let selectedColor = null; // Store selected color

// UI Functions
function showDifficultyMenu() {
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('colorMenu').classList.remove('hidden');
}

function selectColor(color) {
    console.log(`Selected color: ${color}`);
    
    if (color === 'random') {
        selectedColor = Math.random() < 0.5 ? 'white' : 'black';
        console.log(`Random color selected: ${selectedColor}`);
    } else {
        selectedColor = color;
    }
    
    document.getElementById('colorMenu').classList.add('hidden');
    document.getElementById('difficultyMenu').classList.remove('hidden');
}

function backToDifficultyMenu() {
    document.getElementById('difficultyMenu').classList.add('hidden');
    document.getElementById('colorMenu').classList.remove('hidden');
}

function backToMenu() {
    // Remove game-active class from body
    document.body.classList.remove('game-active');
    
    // Hide game elements
    const sidebar = document.getElementById('gameSidebarLeft');
    const sidebarRight = document.getElementById('gameSidebarRight');
    const gameCenter = document.getElementById('gameCenter');
    if (sidebar) sidebar.style.display = 'none';
    if (sidebarRight) sidebarRight.style.display = 'none';
    if (gameCenter) gameCenter.style.display = 'none';
    
    document.getElementById('mainMenu').classList.add('hidden');      // Thay đổi: Luôn ẩn Main Menu
    document.getElementById('colorMenu').classList.remove('hidden');  // Thay đổi: Hiện Color Menu
    document.getElementById('difficultyMenu').classList.add('hidden');
    document.getElementById('gameOverOverlay').classList.add('hidden');
    
    document.getElementById('gameStatus').textContent = 'Choose game mode to start';
    
    selectedColor = null;
    
    if (gameInstance) {
        gameInstance.gameStarted = false;
        gameInstance.gameOver = false;
        gameInstance.isThinking = false;
    }
}

async function startBotGame(difficulty) {
    console.log(`Starting canvas bot game with difficulty: ${difficulty}, color: ${selectedColor}`);
    
    if (!gameInstance) {
        alert('Game not ready yet. Please wait a moment and try again.');
        return;
    }
    
    if (!selectedColor) {
        alert('Please select your color first!');
        backToDifficultyMenu();
        return;
    }
    
    // Hide menu
    document.getElementById('difficultyMenu').classList.add('hidden');
    
    // Add class to body for layout switching
    document.body.classList.add('game-active');
    
    // Show game screen (sidebar + board + right sidebar)
    const sidebar = document.getElementById('gameSidebarLeft');
    const sidebarRight = document.getElementById('gameSidebarRight');
    const gameCenter = document.getElementById('gameCenter');
    if (sidebar) sidebar.style.display = 'flex';
    if (sidebarRight) sidebarRight.style.display = 'flex';
    if (gameCenter) gameCenter.style.display = 'flex';
    
    await gameInstance.startGame(difficulty, selectedColor);
}

function restartGame() {
    if (gameInstance && gameInstance.botDifficulty) {
        gameInstance.startGame(gameInstance.botDifficulty, gameInstance.playerColor);
        document.getElementById('gameOverOverlay').classList.add('hidden');
    }
}

function flipBoard() {
    if (gameInstance) {
        gameInstance.flipBoard();
    }
}

// Move History Navigation Functions
function goToFirstMove() {
    if (!gameInstance || !gameInstance.gameStarted && !gameInstance.gameOver) return;
    gameInstance.viewStep = 0;
    drawBoardAtStep(0);
    updateMoveHistoryUI();
}

function goToPrevMove() {
    if (!gameInstance || !gameInstance.gameStarted && !gameInstance.gameOver) return;
    if (gameInstance.viewStep > 0) {
        gameInstance.viewStep--;
        drawBoardAtStep(gameInstance.viewStep);
        updateMoveHistoryUI();
    }
}

function goToNextMove() {
    if (!gameInstance || !gameInstance.gameStarted && !gameInstance.gameOver) return;
    const history = gameInstance.game.history({ verbose: true });
    if (gameInstance.viewStep < history.length) {
        gameInstance.viewStep++;
        drawBoardAtStep(gameInstance.viewStep);
        updateMoveHistoryUI();
    }
}

function goToLastMove() {
    if (!gameInstance || !gameInstance.gameStarted && !gameInstance.gameOver) return;
    const history = gameInstance.game.history({ verbose: true });
    gameInstance.viewStep = history.length;
    drawBoardAtStep(gameInstance.viewStep);
    updateMoveHistoryUI();
}

function goToMove(step) {
    if (!gameInstance || !gameInstance.gameStarted && !gameInstance.gameOver) return;
    const history = gameInstance.game.history({ verbose: true });
    if (step >= 0 && step <= history.length) {
        gameInstance.viewStep = step;
        drawBoardAtStep(step);
        updateMoveHistoryUI();
    }
}

function drawBoardAtStep(step) {
    if (!gameInstance) return;
    
    const history = gameInstance.game.history({ verbose: true });
    
    // Create a new game to replay to the desired step
    const tempGame = new window.Chess();
    for (let i = 0; i < step; i++) {
        if (history[i]) {
            tempGame.move(history[i].san);
        }
    }
    
    // Draw the board at this state
    const ctx = gameInstance.ctx;
    const squareSize = gameInstance.squareSize;
    const isFlipped = gameInstance.isFlipped;
    
    // Clear and draw board
    ctx.clearRect(0, 0, gameInstance.canvas.width, gameInstance.canvas.height);
    
    // Draw board squares
    for (let rank = 0; rank < 8; rank++) {
        for (let file = 0; file < 8; file++) {
            const isLight = (rank + file) % 2 === 0;
            const color = isLight ? gameInstance.lightSquareColor : gameInstance.darkSquareColor;
            ctx.fillStyle = color;
            ctx.fillRect(file * squareSize, rank * squareSize, squareSize, squareSize);
        }
    }
    
    // Highlight last move if viewing a step > 0
    if (step > 0 && history[step - 1]) {
        const lastMove = history[step - 1];
        ctx.fillStyle = 'rgba(255, 255, 0, 0.4)';
        
        // Highlight from square
        const fromFile = lastMove.from.charCodeAt(0) - 97;
        const fromRank = parseInt(lastMove.from[1]) - 1;
        const fromX = fromFile * squareSize;
        const fromY = isFlipped ? fromRank * squareSize : (7 - fromRank) * squareSize;
        ctx.fillRect(fromX, fromY, squareSize, squareSize);
        
        // Highlight to square
        const toFile = lastMove.to.charCodeAt(0) - 97;
        const toRank = parseInt(lastMove.to[1]) - 1;
        const toX = toFile * squareSize;
        const toY = isFlipped ? toRank * squareSize : (7 - toRank) * squareSize;
        ctx.fillRect(toX, toY, squareSize, squareSize);
    }
    
    // Draw coordinates
    ctx.font = '12px Arial';
    for (let file = 0; file < 8; file++) {
        const letter = String.fromCharCode(97 + file);
        const x = file * squareSize + 5;
        const y = 8 * squareSize - 5;
        const isDark = file % 2 === 0;
        ctx.fillStyle = isDark ? gameInstance.darkSquareColor : gameInstance.lightSquareColor;
        ctx.fillText(letter, x, y);
    }
    for (let rank = 0; rank < 8; rank++) {
        const number = isFlipped ? rank + 1 : 8 - rank;
        const x = 8 * squareSize - 15;
        const y = rank * squareSize + 15;
        const isDark = rank % 2 === 1;
        ctx.fillStyle = isDark ? gameInstance.darkSquareColor : gameInstance.lightSquareColor;
        ctx.fillText(number, x, y);
    }
    
    // Draw pieces from temp game state
    const board = tempGame.board();
    for (let rank = 0; rank < 8; rank++) {
        for (let file = 0; file < 8; file++) {
            const boardRank = isFlipped ? 7 - rank : rank;
            const piece = board[boardRank][file];
            if (!piece) continue;
            
            const x = file * squareSize;
            const y = rank * squareSize;
            const pieceKey = piece.color + piece.type.toUpperCase();
            
            if (gameInstance.imagesLoaded && gameInstance.pieceImages[pieceKey] && gameInstance.pieceImages[pieceKey].complete) {
                ctx.drawImage(
                    gameInstance.pieceImages[pieceKey],
                    x + 4, y + 4,
                    squareSize - 8,
                    squareSize - 8
                );
            }
        }
    }
}

function updateMoveHistoryUI() {
    if (!gameInstance) return;
    
    const history = gameInstance.game.history({ verbose: true });
    const currentStep = gameInstance.viewStep;
    
    // Update position display
    const positionEl = document.getElementById('historyPosition');
    if (positionEl) {
        positionEl.textContent = `${currentStep}/${history.length}`;
    }
    
    // Update move list
    const listEl = document.getElementById('moveHistoryList');
    if (!listEl) return;
    
    if (history.length === 0) {
        listEl.innerHTML = '<p class="no-moves-msg">No moves yet</p>';
        return;
    }
    
    let html = '';
    for (let i = 0; i < history.length; i += 2) {
        const moveNum = Math.floor(i / 2) + 1;
        const whiteMove = history[i];
        const blackMove = history[i + 1];
        
        const whiteClass = (i + 1 === currentStep) ? 'current' : '';
        const blackClass = (i + 2 === currentStep) ? 'current' : '';
        
        html += `<div class="move-row ${(i + 1 === currentStep || i + 2 === currentStep) ? 'active' : ''}">`;
        html += `<span class="move-number">${moveNum}.</span>`;
        html += `<span class="move-white ${whiteClass}" onclick="goToMove(${i + 1})">${whiteMove.san}</span>`;
        if (blackMove) {
            html += `<span class="move-black ${blackClass}" onclick="goToMove(${i + 2})">${blackMove.san}</span>`;
        } else {
            html += `<span class="move-black"></span>`;
        }
        html += '</div>';
    }
    
    listEl.innerHTML = html;
    
    // Scroll to bottom to show latest moves
    listEl.scrollTop = listEl.scrollHeight;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 DOM loaded, initializing Canvas Chess...');
    
    setTimeout(async () => {
        if (typeof window.Chess !== 'function') {
            console.error('❌ Chess.js not available');
            document.getElementById('gameStatus').textContent = '❌ Chess library failed to load';
            return;
        }
        
        gameInstance = new ChessCanvasVsBot();
        const initialized = await gameInstance.initPromise;
        
        if (initialized) {
            console.log('✅ Canvas Chess ready to play!');
            document.getElementById('gameStatus').textContent = 'Choose game mode to start';
        } else {
            console.error('❌ Failed to initialize canvas chess');
            document.getElementById('gameStatus').textContent = '❌ Failed to initialize game';
        }
    }, 500);
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const overlay = document.getElementById('gameOverOverlay');
        if (overlay && !overlay.classList.contains('hidden')) {
            restartGame();
        }
    }
    
    if (e.key === 'Escape') {
        backToMenu();
    }
    
    if (e.key === 'f' || e.key === 'F') {
        flipBoard();
    }
    
    // Move history navigation with arrow keys
    if (e.key === 'ArrowLeft') {
        goToPrevMove();
    }
    
    if (e.key === 'ArrowRight') {
        goToNextMove();
    }
    
    if (e.key === 'ArrowUp' || e.key === 'Home') {
        goToFirstMove();
    }
    
    if (e.key === 'ArrowDown' || e.key === 'End') {
        goToLastMove();
    }
});