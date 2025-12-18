class PuzzleRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.squareSize = this.canvas.width / 8; // Dynamic based on canvas size
        this.boardFlipped = false;
        this.selectedSquare = null;
        this.legalMoves = [];
        this.lastMove = null;
        
        // Colors - use GameConfig if available
        const colors = window.GameConfig?.colors || {};
        this.lightSquareColor = colors.lightSquare || '#F0D9B5';
        this.darkSquareColor = colors.darkSquare || '#B58863';
        this.highlightColor = colors.highlight || 'rgba(255, 255, 0, 0.4)';
        
        // Piece Unicode symbols
        this.pieces = {
            'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
            'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
        };
        
        this.pieceColors = {
            white: '#FFFFFF',
            black: '#000000'
        };
    }
    
    drawBoard(chess) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw squares
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const x = col * this.squareSize;
                const y = row * this.squareSize;
                
                // Alternate colors
                const isLight = (row + col) % 2 === 0;
                this.ctx.fillStyle = isLight ? this.lightSquareColor : this.darkSquareColor;
                this.ctx.fillRect(x, y, this.squareSize, this.squareSize);
                
                // Highlight last move
                if (this.lastMove) {
                    const square = this.getSquareFromCoords(col, row);
                    if (square === this.lastMove.from || square === this.lastMove.to) {
                        this.ctx.fillStyle = this.highlightColor;
                        this.ctx.fillRect(x, y, this.squareSize, this.squareSize);
                    }
                }
                
                // Highlight selected square
                if (this.selectedSquare === this.getSquareFromCoords(col, row)) {
                    this.ctx.fillStyle = 'rgba(0, 255, 0, 0.4)';
                    this.ctx.fillRect(x, y, this.squareSize, this.squareSize);
                }
            }
        }
        
        // Draw legal move indicators
        this.legalMoves.forEach(move => {
            const { col, row } = this.getCoordinatesFromSquare(move.to);
            const x = col * this.squareSize + this.squareSize / 2;
            const y = row * this.squareSize + this.squareSize / 2;
            
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            this.ctx.beginPath();
            this.ctx.arc(x, y, this.squareSize / 6, 0, 2 * Math.PI);
            this.ctx.fill();
        });
        
        // Draw pieces
        const board = chess.board();
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = board[row][col];
                if (piece) {
                    this.drawPiece(piece, col, row);
                }
            }
        }
        
        // Draw coordinates
        this.drawCoordinates();
    }
    
    drawPiece(piece, col, row) {
        const x = col * this.squareSize;
        const y = row * this.squareSize;
        
        this.ctx.font = `${this.squareSize * 0.7}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // Shadow for better visibility
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        this.ctx.shadowBlur = 3;
        this.ctx.shadowOffsetX = 1;
        this.ctx.shadowOffsetY = 1;
        
        // Draw piece
        const symbol = this.pieces[piece.type.toUpperCase()];
        const coloredSymbol = piece.color === 'w' ? symbol : symbol;
        
        this.ctx.fillStyle = piece.color === 'w' ? this.pieceColors.white : this.pieceColors.black;
        this.ctx.strokeStyle = piece.color === 'w' ? '#000' : '#fff';
        this.ctx.lineWidth = 1;
        
        this.ctx.fillText(coloredSymbol, x + this.squareSize / 2, y + this.squareSize / 2);
        this.ctx.strokeText(coloredSymbol, x + this.squareSize / 2, y + this.squareSize / 2);
        
        // Reset shadow
        this.ctx.shadowColor = 'transparent';
    }
    
    drawCoordinates() {
        this.ctx.font = '12px Arial';
        this.ctx.fillStyle = '#333';
        
        // Files (a-h)
        for (let col = 0; col < 8; col++) {
            const file = String.fromCharCode(97 + (this.boardFlipped ? 7 - col : col));
            this.ctx.fillText(file, col * this.squareSize + 5, this.canvas.height - 5);
        }
        
        // Ranks (1-8)
        for (let row = 0; row < 8; row++) {
            const rank = this.boardFlipped ? row + 1 : 8 - row;
            this.ctx.fillText(rank, this.canvas.width - 15, row * this.squareSize + 15);
        }
    }
    
    getSquareFromCoords(col, row) {
        if (this.boardFlipped) {
            col = 7 - col;
            row = 7 - row;
        }
        const file = String.fromCharCode(97 + col);
        const rank = 8 - row;
        return file + rank;
    }
    
    getCoordinatesFromSquare(square) {
        let col = square.charCodeAt(0) - 97;
        let row = 8 - parseInt(square[1]);
        
        if (this.boardFlipped) {
            col = 7 - col;
            row = 7 - row;
        }
        
        return { col, row };
    }
    
    getSquareFromClick(x, y) {
        const col = Math.floor(x / this.squareSize);
        const row = Math.floor(y / this.squareSize);
        return this.getSquareFromCoords(col, row);
    }
    
    highlightLegalMoves(chess, square) {
        this.selectedSquare = square;
        this.legalMoves = chess.moves({ square, verbose: true });
    }
    
    clearHighlights() {
        this.selectedSquare = null;
        this.legalMoves = [];
    }
    
    setLastMove(from, to) {
        this.lastMove = { from, to };
    }
    
    flipBoard() {
        this.boardFlipped = !this.boardFlipped;
    }
}