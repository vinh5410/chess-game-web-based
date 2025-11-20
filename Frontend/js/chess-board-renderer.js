class ChessBoardRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            throw new Error(`Canvas element '${canvasId}' not found`);
        }
        
        this.ctx = this.canvas.getContext('2d');
        this.game = new window.Chess();
        
        // Canvas settings - RESPONSIVE
        this.calculateResponsiveSize();
        this.canvas.width = this.canvasSize;
        this.canvas.height = this.canvasSize;
        
        // Colors (có thể override)
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
        
        // Mouse/Touch interaction
        this.isDragging = false;
        this.dragPiece = null;
        this.dragStartSquare = null;
        this.mousePos = { x: 0, y: 0 };
        
        // Touch support
        this.isTouchDevice = 'ontouchstart' in window;
        this.lastTouchTime = 0;
        
        // Piece images
        this.pieceImages = {};
        this.imagesLoaded = false;
    }
    
    // ==================== RESPONSIVE SIZING ====================
    
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
    
    // ==================== PIECE LOADING ====================
    
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
    
    // ==================== COORDINATE CONVERSION ====================
    
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
    
    // ==================== DRAWING METHODS ====================
    
    draw() {
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
                this.ctx.fillStyle = isLight ? this.lightSquareColor : this.darkSquareColor;
                
                const x = file * this.squareSize;
                const y = rank * this.squareSize;
                
                this.ctx.fillRect(x, y, this.squareSize, this.squareSize);
            }
        }
    }
    
    drawCoordinates() {
        this.ctx.font = `${Math.max(10, this.squareSize * 0.15)}px Arial`;
        this.ctx.fillStyle = '#333';
        
        // Files (a-h)
        for (let file = 0; file < 8; file++) {
            const letter = String.fromCharCode(97 + file);
            const x = file * this.squareSize + 5;
            const y = 8 * this.squareSize - 5;
            this.ctx.fillText(letter, x, y);
        }
        
        // Ranks (1-8)
        for (let rank = 0; rank < 8; rank++) {
            const number = this.isFlipped ? (rank + 1) : (8 - rank);
            const x = 8 * this.squareSize - 15;
            const y = rank * this.squareSize + 15;
            this.ctx.fillText(number, x, y);
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
    
    // ==================== EVENT LISTENERS ====================
    
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
        
        console.log('✅ Event listeners setup (Mouse + Touch)');
    }
    
    // ==================== TEMPLATE METHOD PATTERN ====================
    
    canInteract() {
        return false;
    }
    
    getPlayerColor() {
        return 'w';
    }
    
    afterMove(move) {
        // Override in subclass
    }
    
    // ==================== MOUSE HANDLERS ====================
    
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
    
    // ==================== TOUCH HANDLERS (MOBILE) ====================
    
    onTouchStart(e) {
        e.preventDefault(); // Prevent scrolling
        
        if (!this.canInteract() || e.touches.length !== 1) return;
        
        const touch = e.touches[0];
        const { square, x, y } = this.getTouchPosition(touch);
        
        if (!square) return;
        
        const piece = this.game.get(square);
        if (piece && piece.color === this.getPlayerColor()) {
            this.mousePos = { x, y };
            this.startDrag(square, piece);
            console.log('📱 Touch drag started:', square);
        }
    }
    
    onTouchMove(e) {
        e.preventDefault();
        
        if (!this.isDragging || e.touches.length !== 1) return;
        
        const touch = e.touches[0];
        const { x, y } = this.getTouchPosition(touch);
        
        this.mousePos = { x, y };
        this.draw();
    }
    
    onTouchEnd(e) {
        e.preventDefault();
        
        if (!this.isDragging || !this.dragStartSquare) return;
        
        // Get final position from last touch or changedTouches
        const touch = e.changedTouches[0];
        const { square: targetSquare } = this.getTouchPosition(touch);
        
        console.log('📱 Touch drag ended:', this.dragStartSquare, '→', targetSquare);
        
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
    
    getTouchPosition(touch) {
        const rect = this.canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        const square = this.canvasToSquare(x, y);
        return { x, y, square };
    }
    
    // ==================== MOVE EXECUTION ====================
    
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
                console.log('❌ Illegal move');
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
                console.log('✅ Move executed:', result.san);
                this.draw();
                this.afterMove(result);
            }
        } catch (error) {
            console.error('❌ Move error:', error);
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