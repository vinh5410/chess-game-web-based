// Frontend/js/promotion-ui.js

class PromotionUI {
    constructor(game, pieceImages, isFlipped = false) {
        this.game = game;
        this.pieceImages = pieceImages;
        this.isFlipped = isFlipped;
        this.promotionCallback = null;
        this.promotionSquare = null;
        this.promotionColor = null;
        
        this.createPromotionDialog();
    }
    
    createPromotionDialog() {
        // Kiểm tra nếu đã tồn tại
        if (document.getElementById('promotionDialog')) return;
        
        const dialog = document.createElement('div');
        dialog.id = 'promotionDialog';
        dialog.className = 'promotion-dialog hidden';
        
        dialog.innerHTML = `
            <div class="promotion-overlay"></div>
            <div class="promotion-content">
                <div class="promotion-title">Choose Promotion</div>
                <div class="promotion-pieces">
                    <div class="promotion-piece" data-piece="q">
                        <img src="./assets/pieces/wQ.png" alt="Queen" class="piece-img">
                        <span class="piece-label">Queen</span>
                    </div>
                    <div class="promotion-piece" data-piece="r">
                        <img src="./assets/pieces/wR.png" alt="Rook" class="piece-img">
                        <span class="piece-label">Rook</span>
                    </div>
                    <div class="promotion-piece" data-piece="b">
                        <img src="./assets/pieces/wB.png" alt="Bishop" class="piece-img">
                        <span class="piece-label">Bishop</span>
                    </div>
                    <div class="promotion-piece" data-piece="n">
                        <img src="./assets/pieces/wN.png" alt="Knight" class="piece-img">
                        <span class="piece-label">Knight</span>
                    </div>
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
        
        // Prevent clicking overlay from closing (force selection)
        const overlay = dialog.querySelector('.promotion-overlay');
        overlay.addEventListener('click', (e) => {
            e.stopPropagation();
            // Optionally shake the dialog
            dialog.querySelector('.promotion-content').classList.add('shake');
            setTimeout(() => {
                dialog.querySelector('.promotion-content').classList.remove('shake');
            }, 500);
        });
    }
    
    showPromotionDialog(from, to, color, callback) {
        const dialog = document.getElementById('promotionDialog');
        if (!dialog) return;
        
        this.promotionCallback = callback;
        this.promotionSquare = { from, to };
        this.promotionColor = color;
        
        // Update piece images based on color
        const pieces = dialog.querySelectorAll('.promotion-piece');
        pieces.forEach(piece => {
            const pieceType = piece.getAttribute('data-piece');
            const img = piece.querySelector('.piece-img');
            const colorPrefix = color === 'w' ? 'w' : 'b';
            img.src = `./assets/pieces/${colorPrefix}${pieceType.toUpperCase()}.png`;
        });
        
        dialog.classList.remove('hidden');
        
        // Add keyboard support
        this.keyboardHandler = (e) => {
            const keyMap = { '1': 'q', '2': 'r', '3': 'b', '4': 'n' };
            if (keyMap[e.key]) {
                this.selectPromotion(keyMap[e.key]);
            }
        };
        document.addEventListener('keydown', this.keyboardHandler);
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