class ChessBoardRenderer {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            throw new Error(`Canvas element '${canvasId}' not found`);
        }
        
        this.ctx = this.canvas.getContext('2d');
        this.game = new window.Chess();
        
        
        if (options.fixedSize) {
            this.canvasSize = options.fixedSize;
            this.squareSize = this.canvasSize / 8;
        } else {
            this.calculateResponsiveSize();
        }
        this.canvas.width = this.canvasSize;
        this.canvas.height = this.canvasSize;
        
        
        const colors = window.GameConfig?.colors || {};
        this.lightSquareColor = colors.lightSquare || '#f0d9b5';
        this.darkSquareColor = colors.darkSquare || '#b58863';
        this.highlightColor = colors.highlight || 'rgba(255, 255, 0, 0.4)';
        this.legalMoveColor = colors.legalMove || 'rgba(0, 150, 0, 0.6)';
        this.captureColor = colors.capture || 'rgba(200, 0, 0, 0.6)';
        this.selectedColor = colors.selected || 'rgba(255, 200, 0, 0.6)';
        
        
        this.selectedSquare = null;
        this.legalMoves = [];
        this.isFlipped = !!options.isFlipped;
        
        
        this.isDragging = false;
        this.dragPiece = null;
        this.dragStartSquare = null;
        this.mousePos = { x: 0, y: 0 };
        
        
        this.isTouchDevice = 'ontouchstart' in window;
        this.lastTouchTime = 0;
        
        
        this.pieceImages = {};
        this.imagesLoaded = false;
    }
    
    
    
    calculateResponsiveSize() {
        const parent = this.canvas.parentElement;
        if (parent) {
            // Get available width
            const parentWidth = parent.clientWidth;
            const padding = window.innerWidth <= 480 ? 20 : 40;
            
            // Max 640px, min 280px for very small screens
            const maxSize = 640;
            const minSize = 280;
            const availableSize = parentWidth - padding;
            
            this.canvasSize = Math.max(minSize, Math.min(maxSize, availableSize));
            this.squareSize = this.canvasSize / 8;
            
            console.log(`📱 Canvas size calculated: ${this.canvasSize}px (parent: ${parentWidth}px)`);
        } else {
            // Fallback
            this.canvasSize = 640;
            this.squareSize = 80;
        }
    }
    
    handleResize() {
        const oldSize = this.canvasSize;
        this.calculateResponsiveSize();
        
        if (oldSize !== this.canvasSize) {
            this.canvas.width = this.canvasSize;
            this.canvas.height = this.canvasSize;
            console.log(`🔄 Canvas resized: ${oldSize}px → ${this.canvasSize}px`);
            this.draw();
        }
    }
    
    
    
    async loadPieceImages() {
        console.log('Loading piece images...');
        const pieces = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'];
        const loadPromises = [];
        
        for (const piece of pieces) {
            const img = new Image();
            const promise = new Promise((resolve) => {
                img.onload = () => resolve();
                img.onerror = () => {
                    console.warn(`Failed to load ${piece}.png, using fallback`);
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
        console.log('Piece images loaded');
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
    
    
    
    canvasToSquare(x, y) {
        // file index (0..7) — flip horizontally when board is flipped
        let fileIdx = Math.floor(x / this.squareSize);
        if (this.isFlipped) fileIdx = 7 - fileIdx;

        // rank index (0..7) — when not flipped top y is rank 8, when flipped top y is rank 1
        const yIdx = Math.floor(y / this.squareSize);
        const rankIdx = this.isFlipped ? yIdx : 7 - yIdx;

        if (fileIdx < 0 || fileIdx > 7 || rankIdx < 0 || rankIdx > 7) return null;
        return String.fromCharCode(97 + fileIdx) + (rankIdx + 1);
    }
    squareToCanvas(square) {
        const file = square.charCodeAt(0) - 97; // 0..7
        const rank = parseInt(square[1], 10) - 1; // 0..7

        // x: flip horizontally if board flipped
        const x = this.isFlipped ? (7 - file) * this.squareSize : file * this.squareSize;
        // y: flip vertically if not flipped
        const y = this.isFlipped ? rank * this.squareSize : (7 - rank) * this.squareSize;

        return { x, y };
    }
        
    
    draw() {
        console.log('Renderer:', this.canvas.id, 'FEN=', this.game.fen(), 'isFlipped=', this.isFlipped);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawBoard();
        this.drawCoordinates();
        this.drawHighlights();
        this.drawPieces();
        this.drawDragPiece();
    }
    
    drawBoard() {
        // Draw squares in visual order (left→right, top→bottom)
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                // get a sample point inside this visual square and map to logical square
                const sampleX = c * this.squareSize + this.squareSize * 0.5;
                const sampleY = r * this.squareSize + this.squareSize * 0.5;
                const sq = this.canvasToSquare(sampleX, sampleY);
                // If mapping failed, fall back to checkerboard pattern
                let isLight;
                if (sq) {
                    const file = sq.charCodeAt(0) - 97;
                    const rank = parseInt(sq[1], 10) - 1;
                    isLight = ((file + rank) % 2 === 0);
                } else {
                    isLight = ((r + c) % 2 === 0);
                }

                this.ctx.fillStyle = isLight ? this.lightSquareColor : this.darkSquareColor;
                const x = c * this.squareSize;
                const y = r * this.squareSize;
                this.ctx.fillRect(x, y, this.squareSize, this.squareSize);
            }
        }
    }
    
    drawCoordinates() {
        const fontSize = Math.max(10, this.squareSize * 0.15);
        this.ctx.font = `bold ${fontSize}px Arial`;
        
        // Files (a-h) - draw at bottom of each square
        for (let file = 0; file < 8; file++) {
            const actualFile = this.isFlipped ? 7 - file : file;
            const letter = String.fromCharCode(97 + actualFile);
            const x = file * this.squareSize + 3;
            const y = this.canvasSize - 3;
            
            // Color based on square color
            const isLightSquare = (7 + file) % 2 === 0;
            this.ctx.fillStyle = isLightSquare ? this.darkSquareColor : this.lightSquareColor;
            this.ctx.fillText(letter, x, y);
        }
        
        // Ranks (1-8) - draw at right side of each square
        for (let rank = 0; rank < 8; rank++) {
            const actualRank = this.isFlipped ? rank + 1 : 8 - rank;
            const x = this.canvasSize - fontSize + 2;
            const y = rank * this.squareSize + fontSize;
            
            // Color based on square color
            const isLightSquare = (rank + 7) % 2 === 0;
            this.ctx.fillStyle = isLightSquare ? this.darkSquareColor : this.lightSquareColor;
            this.ctx.fillText(actualRank, x, y);
        }
    }
    
    drawHighlights() {
        // Highlight selected square
        if (this.selectedSquare && !this.isDragging) {
            const pos = this.squareToCanvas(this.selectedSquare);
            this.ctx.fillStyle = this.selectedColor;
            this.ctx.fillRect(pos.x, pos.y, this.squareSize, this.squareSize);
        }
        
        // Highlight legal moves
        this.legalMoves.forEach(move => {
            const pos = this.squareToCanvas(move.to);
            const centerX = pos.x + this.squareSize / 2;
            const centerY = pos.y + this.squareSize / 2;
            const radius = this.squareSize * 0.15;
            
            this.ctx.fillStyle = move.captured ? this.captureColor : this.legalMoveColor;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }
    
    drawPieces() {
        const board = this.game.board();

        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const piece = board[rank][file];
                if (!piece) continue;

                // board[0] = rank 8, board[7] = rank 1 in Chess.js
                const actualRank = 7 - rank;
                const square = String.fromCharCode(97 + file) + (actualRank + 1);

                // Skip dragged piece
                if (this.isDragging && square === this.dragStartSquare) continue;

                const pos = this.squareToCanvas(square);
                this.drawPiece(piece, pos.x, pos.y);
            }
        }
    }

    drawPiece(piece, x, y) {
        const pieceKey = piece.color + piece.type.toUpperCase();
        const img = this.pieceImages[pieceKey];
        
        if (this.imagesLoaded && img && img.complete) {
            const padding = this.squareSize * 0.1;
            this.ctx.drawImage(
                img,
                x + padding,
                y + padding,
                this.squareSize - padding * 2,
                this.squareSize - padding * 2
            );
        } else {
            this.drawTextPiece(piece, x, y);
        }
    }
    
    drawTextPiece(piece, x, y) {
        const symbols = {
            'k': '♔', 'q': '♕', 'r': '♖', 'b': '♗', 'n': '♘', 'p': '♙',
            'K': '♚', 'Q': '♛', 'R': '♜', 'B': '♝', 'N': '♞', 'P': '♟'
        };
        
        const symbol = piece.color === 'w' ? symbols[piece.type] : symbols[piece.type.toUpperCase()];
        this.ctx.font = `${this.squareSize * 0.7}px Arial`;
        this.ctx.fillStyle = piece.color === 'w' ? '#fff' : '#000';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(symbol, x + this.squareSize / 2, y + this.squareSize / 2);
        this.ctx.textAlign = 'start';
        this.ctx.textBaseline = 'alphabetic';
    }
    
    drawDragPiece() {
        if (!this.isDragging || !this.dragPiece) return;
        
        const x = this.mousePos.x - this.squareSize / 2;
        const y = this.mousePos.y - this.squareSize / 2;
        
        this.drawPiece(this.dragPiece, x, y);
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
        this.canvas.addEventListener('touchcancel', this.onTouchEnd.bind(this), { passive: false });
        
        // Resize handler
        window.addEventListener('resize', this.handleResize.bind(this));
        
        console.log('Event listeners setup (Mouse + Touch)');
    }
    
    
    
    canInteract() {
        return false;
    }
    
    getPlayerColor() {
        return 'w';
    }
    
    afterMove(move) {
        // Override in subclass
    }
    
    
    
    onMouseDown(e) {
        if (!this.canInteract()) return;
        
        const { square } = this.getMousePosition(e);
        if (!square) return;
        
        const piece = this.game.get(square);
        if (piece && piece.color === this.getPlayerColor()) {
            this.startDrag(square, piece);
        }
    }
    
    getMousePosition(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const square = this.canvasToSquare(x, y);
        return { x, y, square };
    }
    
    startDrag(square, piece) {
        this.isDragging = true;
        this.dragStartSquare = square;
        this.dragPiece = piece;
        this.selectedSquare = square;
        this.legalMoves = this.game.moves({ square, verbose: true });
        this.draw();
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
        if (this.isDragging || !this.canInteract()) return;
        
        const { square } = this.getMousePosition(e);
        if (!square) return;
        
        if (this.selectedSquare === square) {
            this.clearSelection();
            return;
        }
        
        if (this.selectedSquare && this.isLegalMove(square)) {
            this.executeMoveFromClick(this.selectedSquare, square);
            return;
        }
        
        const piece = this.game.get(square);
        if (piece && piece.color === this.getPlayerColor()) {
            this.selectSquare(square);
        }
    }
    
    
    
    onTouchStart(e) {
        e.preventDefault(); // Prevent scrolling
        
        if (!this.canInteract() || e.touches.length !== 1) return;
        
        const touch = e.touches[0];
        this.touchStartPos = { x: touch.clientX, y: touch.clientY };
        this.touchMoved = false;
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
                    const { square, x, y } = this.getTouchPosition({ clientX: this.touchStartPos.x, clientY: this.touchStartPos.y });
                    if (square) {
                        const piece = this.game.get(square);
                        if (piece && piece.color === this.getPlayerColor()) {
                            this.mousePos = { x, y };
                            this.startDrag(square, piece);
                        }
                    }
                }
                
                if (this.isDragging) {
                    const { x, y } = this.getTouchPosition(touch);
                    this.mousePos = { x, y };
                    this.draw();
                }
            }
        }
    }
    
    onTouchEnd(e) {
        e.preventDefault();
        
        const touch = e.changedTouches[0];
        
        if (this.touchMoved && this.isDragging) {
            // Was dragging - complete the move
            const { square: targetSquare } = this.getTouchPosition(touch);
            
            if (targetSquare && targetSquare !== this.dragStartSquare) {
                this.tryMove(this.dragStartSquare, targetSquare);
            }
            
            this.isDragging = false;
            this.dragPiece = null;
            this.dragStartSquare = null;
            this.selectedSquare = null;
            this.legalMoves = [];
            this.draw();
        } else {
            // Tap - treat as click
            this.onClick({ clientX: touch.clientX, clientY: touch.clientY });
        }
        
        this.touchStartPos = null;
        this.touchMoved = false;
    }
    
    getTouchPosition(touch) {
        const rect = this.canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        const square = this.canvasToSquare(x, y);
        return { x, y, square };
    }
    
    
    
    clearSelection() {
        this.selectedSquare = null;
        this.legalMoves = [];
        this.draw();
    }
    
    isLegalMove(to) {
        return this.legalMoves.some(move => move.to === to);
    }
    
    selectSquare(square) {
        this.selectedSquare = square;
        this.legalMoves = this.game.moves({ square, verbose: true });
        this.draw();
    }
    
    executeMoveFromClick(from, to) {
        this.tryMove(from, to);
        this.clearSelection();
    }
    
    tryMove(from, to) {
        try {
            const moves = this.game.moves({ square: from, verbose: true });
            const move = moves.find(m => m.to === to);
            
            if (!move) {
                console.log('Illegal move');
                return;
            }
            
            // Handle promotion
            if (move.flags.includes('p')) {
                move.promotion = 'q';
            }
            
            const result = this.game.move({
                from: from,
                to: to,
                promotion: move.promotion || 'q'
            });
            
            if (result) {
                console.log('Move executed:', result.san);
                this.draw();
                this.afterMove(result);
            }
        } catch (error) {
            console.error('Move error:', error);
        }
    }
    
    loadPosition(fen) {
        this.game.load(fen);
        this.clearSelection();
        this.draw();
    }
    
    flipBoard() {
        this.isFlipped = !this.isFlipped;
        this.draw();
    }
    
    reset() {
        this.game.reset();
        this.clearSelection();
        this.draw();
    }
}