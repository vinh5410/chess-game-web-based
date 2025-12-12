class ChessBoardRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            throw new Error(`Canvas element '${canvasId}' not found`);
        }
        
        this.ctx = this.canvas.getContext('2d');
        this.game = new window.Chess();
        
        // Canvas settings
        this.canvasSize = 640;
        this.squareSize = 80;
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
        
        // Mouse interaction
        this.isDragging = false;
        this.dragPiece = null;
        this.dragStartSquare = null;
        this.mousePos = { x: 0, y: 0 };
        
        // Piece images
        this.pieceImages = {};
        this.imagesLoaded = false;
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
        
        // Files (a-h)
        for (let file = 0; file < 8; file++) {
            const letter = String.fromCharCode(97 + file);
            const x = file * this.squareSize + 5;
            const y = 8 * this.squareSize - 5;
            const isDark = file % 2 === 0;
            this.ctx.fillStyle = isDark ? this.darkSquareColor : this.lightSquareColor;
            this.ctx.fillText(letter, x, y);
        }
        
        // Ranks (1-8)
        for (let rank = 0; rank < 8; rank++) {
            const number = this.isFlipped ? rank + 1 : 8 - rank;
            const x = 8 * this.squareSize - 15;
            const y = rank * this.squareSize + 15;
            const isDark = rank % 2 === 1;
            this.ctx.fillStyle = isDark ? this.darkSquareColor : this.lightSquareColor;
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
        
        // Draw legal move indicators
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
                const boardRank = this.isFlipped ? 7 - rank : rank;
                const piece = board[boardRank][file];
                if (!piece) continue;
                
                const squareRank = this.isFlipped ? rank + 1 : 8 - rank;
                const square = String.fromCharCode(97 + file) + squareRank;
                
                // Skip piece being dragged
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
            
            // Add shadow for better visibility
            this.ctx.shadowColor = 'rgba(0,0,0,0.5)';
            this.ctx.shadowBlur = 3;
            this.ctx.shadowOffsetX = 2;
            this.ctx.shadowOffsetY = 2;
            
            this.ctx.fillStyle = piece.color === 'w' ? '#fff' : '#000';
            this.ctx.fillText(symbol, x + this.squareSize / 2, y + this.squareSize / 2);
            
            // Stroke for white pieces
            if (piece.color === 'w') {
                this.ctx.strokeStyle = '#333';
                this.ctx.lineWidth = 2;
                this.ctx.strokeText(symbol, x + this.squareSize / 2, y + this.squareSize / 2);
            }
            
            // Reset shadow
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
    
    // ==================== EVENT LISTENERS ====================
    
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('click', this.onClick.bind(this));
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
        
        window.addEventListener('resize', this.handleResize.bind(this));
    }
    
    // ==================== TEMPLATE METHOD PATTERN ====================
    // These methods should be overridden by subclasses
    
    canInteract() {
        // Override in subclass
        return false;
    }
    
    getPlayerColor() {
        // Override in subclass
        return 'w';
    }
    
    afterMove(move) {
        // Override in subclass - called after successful move
    }
    
    // Common mouse down handler with template method
    onMouseDown(e) {
        if (!this.canInteract()) return;
        
        const { square } = this.getMousePosition(e);
        if (!square) return;
        
        const piece = this.game.get(square);
        if (piece && piece.color === this.getPlayerColor()) {
            this.startDrag(square, piece);
        }
    }
    
    // Helper methods
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
        
        // Deselect if clicking same square
        if (this.selectedSquare === square) {
            this.clearSelection();
            return;
        }
        
        // Try to move if a square is selected and target is legal
        if (this.selectedSquare && this.isLegalMove(square)) {
            this.executeMoveFromClick(this.selectedSquare, square);
            return;
        }
        
        // Select piece if it's player's piece
        const piece = this.game.get(square);
        if (piece && piece.color === this.getPlayerColor()) {
            this.selectSquare(square);
        }
    }
    
    clearSelection() {
        this.selectedSquare = null;
        this.legalMoves = [];
        this.draw();
    }
    
    isLegalMove(to) {
        return this.legalMoves.some(m => m.to === to);
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
    
    // Common move execution with hook
    tryMove(from, to) {
        try {
            const move = this.game.move({ from, to, promotion: 'q' });
            
            if (move) {
                console.log('✅ Valid move:', move.san);
                this.draw();
                this.afterMove(move); // Hook for subclass
                return true;
            }
        } catch (error) {
            console.log('❌ Invalid move:', from, 'to', to);
        }
        return false;
    }
    
    // ==================== UTILITY METHODS ====================
    
    flipBoard() {
        this.isFlipped = !this.isFlipped;
        this.draw();
        console.log('🔄 Board flipped:', this.isFlipped ? 'Black perspective' : 'White perspective');
    }
    
    handleResize() {
        const container = this.canvas.parentElement;
        if (!container) return;
        
        const maxSize = Math.min(container.clientWidth - 40, 640);
        
        if (maxSize !== this.canvasSize) {
            this.canvasSize = maxSize;
            this.squareSize = maxSize / 8;
            this.canvas.width = maxSize;
            this.canvas.height = maxSize;
            this.draw();
        }
    }
    
    // Helper to check if move is valid
    isValidMove(from, to) {
        const moves = this.game.moves({ square: from, verbose: true });
        return moves.some(move => move.to === to);
    }
}
