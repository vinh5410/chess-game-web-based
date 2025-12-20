// Frontend/js/promotion-ui.js

class PromotionUI {
    constructor(game, pieceImages, isFlipped = false) {
        this.game = game;
        this.pieceImages = pieceImages;
        this.isFlipped = isFlipped;
        this.promotionCallback = null;
        this.promotionSquare = null;
        this.promotionColor = null;
        this.canvasRect = null;
        this.squareSize = 80;
        
        this.createPromotionDialog();
    }
    
    createPromotionDialog() {
        // Remove existing dialog if exists
        const existing = document.getElementById('promotionDialog');
        if (existing) existing.remove();
        
        const dialog = document.createElement('div');
        dialog.id = 'promotionDialog';
        dialog.className = 'promotion-dialog hidden';
        
        dialog.innerHTML = `
            <div class="promotion-overlay"></div>
            <div class="promotion-container">
                <div class="promotion-piece" data-piece="q">
                    <img src="./assets/pieces/wQ.png" alt="Queen" class="piece-img">
                </div>
                <div class="promotion-piece" data-piece="r">
                    <img src="./assets/pieces/wR.png" alt="Rook" class="piece-img">
                </div>
                <div class="promotion-piece" data-piece="b">
                    <img src="./assets/pieces/wB.png" alt="Bishop" class="piece-img">
                </div>
                <div class="promotion-piece" data-piece="n">
                    <img src="./assets/pieces/wN.png" alt="Knight" class="piece-img">
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // Add click handlers
        const pieces = dialog.querySelectorAll('.promotion-piece');
        pieces.forEach(piece => {
            piece.addEventListener('click', (e) => {
                const selectedPiece = e.currentTarget.getAttribute('data-piece');
                this.selectPromotion(selectedPiece);
            });
        });
        
        // Clicking overlay cancels (selects queen by default)
        const overlay = dialog.querySelector('.promotion-overlay');
        overlay.addEventListener('click', (e) => {
            e.stopPropagation();
            // Select queen as default
            this.selectPromotion('q');
        });
    }
    
    showPromotionDialog(from, to, color, callback, canvas = null, isFlipped = false) {
        const dialog = document.getElementById('promotionDialog');
        if (!dialog) return;
        
        this.promotionCallback = callback;
        this.promotionSquare = { from, to };
        this.promotionColor = color;
        this.isFlipped = isFlipped; // Update from parameter
        
        // Update piece images based on color
        const pieces = dialog.querySelectorAll('.promotion-piece');
        const colorPrefix = color === 'w' ? 'w' : 'b';
        
        pieces.forEach(piece => {
            const pieceType = piece.getAttribute('data-piece');
            const img = piece.querySelector('.piece-img');
            img.src = `./assets/pieces/${colorPrefix}${pieceType.toUpperCase()}.png`;
        });
        
        // Position the container at the promotion square
        const container = dialog.querySelector('.promotion-container');
        
        if (canvas) {
            // getBoundingClientRect returns position relative to viewport
            const rect = canvas.getBoundingClientRect();
            const squareSize = rect.width / 8;
            
            // Get file from target square (e.g., "e8" -> file e = 4)
            const file = to.charCodeAt(0) - 97; // 'a' = 0, 'h' = 7
            const rank = parseInt(to[1]) - 1; // 1-8 -> 0-7
            
            // Match the game's squareToCanvas logic exactly:
            // x = file * squareSize (NO flip on x)
            // y = isFlipped ? rank * squareSize : (7 - rank) * squareSize
            const visualX = file * squareSize;
            const visualY = this.isFlipped ? rank * squareSize : (7 - rank) * squareSize;
            
            const x = rect.left + visualX;
            const y = rect.top + visualY;
            
            console.log('Promotion UI position:', { to, file, rank, isFlipped: this.isFlipped, visualX, visualY, x, y });
            
            // Set piece size to match board
            pieces.forEach(piece => {
                piece.style.width = squareSize + 'px';
                piece.style.height = squareSize + 'px';
            });
            
            // Determine if promotion square is at top or bottom of screen
            const isAtTop = visualY < (squareSize * 4);
            
            container.style.position = 'fixed';
            container.style.left = Math.round(x) + 'px';
            
            if (isAtTop) {
                // Promotion at top - dropdown goes down
                container.style.top = Math.round(y) + 'px';
                container.classList.remove('from-bottom');
            } else {
                // Promotion at bottom - dropdown goes up
                const containerHeight = squareSize * 4;
                container.style.top = Math.round(y - containerHeight + squareSize) + 'px';
                container.classList.add('from-bottom');
            }
        }
        
        dialog.classList.remove('hidden');
        
        // Add keyboard support
        this.keyboardHandler = (e) => {
            const keyMap = { 
                'q': 'q', 'Q': 'q', '1': 'q',
                'r': 'r', 'R': 'r', '2': 'r',
                'b': 'b', 'B': 'b', '3': 'b',
                'n': 'n', 'N': 'n', '4': 'n',
                'Escape': 'q' // Default to queen on escape
            };
            if (keyMap[e.key]) {
                this.selectPromotion(keyMap[e.key]);
            }
        };
        document.addEventListener('keydown', this.keyboardHandler);
    }
    
    setFlipped(isFlipped) {
        this.isFlipped = isFlipped;
    }
    
    selectPromotion(piece) {
        const dialog = document.getElementById('promotionDialog');
        if (!dialog) return;
        
        dialog.classList.add('hidden');
        
        // Remove keyboard handler
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler);
            this.keyboardHandler = null;
        }
        
        // Execute callback with selected piece
        if (this.promotionCallback) {
            this.promotionCallback(piece);
            this.promotionCallback = null;
        }
        
        this.promotionSquare = null;
        this.promotionColor = null;
    }
    
    hide() {
        const dialog = document.getElementById('promotionDialog');
        if (dialog) {
            dialog.classList.add('hidden');
        }
        
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler);
            this.keyboardHandler = null;
        }
        
        this.promotionCallback = null;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PromotionUI;
}