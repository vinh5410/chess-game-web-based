// Frontend/js/puzzles.js - Refactored to extend ChessBoardRenderer

class ChessPuzzleGame extends ChessBoardRenderer {
    constructor() {
        super('puzzleCanvas'); // Call base class with canvas ID
        
        // --- PUZZLE-SPECIFIC STATE ---
        this.currentPuzzle = null;
        this.moveIndex = 0;
        this.isSolving = false;
        this.isUserTurn = false;
        this.hintSquares = null;
        this.failed = false;
        
        // --- TIMER ---
        this.timerInterval = null;
        this.startTime = null;
        
        // Initialize puzzle
        this.initPuzzle();
    }
    
    async initPuzzle() {
        console.log('🧩 Initializing Puzzle Game...');
        
        await this.loadPieceImages();
        this.setupEventListeners();
        this.handleResize();
        
        await this.loadUserStats();
        await this.loadNewPuzzle();
        
        console.log('✅ Puzzle Game initialized');
    }
    
    // ==================== OVERRIDE TEMPLATE METHODS ====================
    
    canInteract() {
        return this.isSolving && this.isUserTurn;
    }
    
    getPlayerColor() {
        return this.game.turn(); // User plays whoever's turn it is
    }
    
    afterMove(move) {
        // Called after successful move from base class
        this.addMoveToHistory(move.san);
        this.isUserTurn = false; // Lock board while verifying
        this.hintSquares = null; // Clear hints
        
        // Verify move with server
        this.verifyMove(move);
    }
    
    // ==================== CUSTOM DRAWING (Override for puzzle highlights) ====================
    
    drawHighlights() {
        // Draw last move highlight
        const history = this.game.history({ verbose: true });
        if (history.length > 0) {
            const last = history[history.length - 1];
            const fromPos = this.squareToCanvas(last.from);
            const toPos = this.squareToCanvas(last.to);
            
            this.ctx.fillStyle = 'rgba(155, 199, 0, 0.41)';
            this.ctx.fillRect(fromPos.x, fromPos.y, this.squareSize, this.squareSize);
            this.ctx.fillRect(toPos.x, toPos.y, this.squareSize, this.squareSize);
        }
        
        // Draw selected square
        if (this.selectedSquare && !this.isDragging) {
            const pos = this.squareToCanvas(this.selectedSquare);
            this.ctx.fillStyle = this.selectedColor;
            this.ctx.fillRect(pos.x, pos.y, this.squareSize, this.squareSize);
        }
        
        // Draw legal move indicators
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
        
        // Draw hint squares (puzzle-specific)
        if (this.hintSquares) {
            const fromPos = this.squareToCanvas(this.hintSquares.from);
            const toPos = this.squareToCanvas(this.hintSquares.to);
            
            this.ctx.lineWidth = 4;
            this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
            this.ctx.strokeRect(fromPos.x, fromPos.y, this.squareSize, this.squareSize);
            this.ctx.strokeRect(toPos.x, toPos.y, this.squareSize, this.squareSize);
            this.ctx.lineWidth = 1;
        }
    }
    
    // ==================== PUZZLE LOGIC ====================
    
    async loadNewPuzzle() {
        try {
            this.stopTimer();
            this.hideFeedback();
            this.hintSquares = null;
            this.failed = false;
            document.getElementById('moves-container').innerHTML = '';
            
            const rating = document.getElementById('puzzle-rating').innerText || 1200;
            const token = localStorage.getItem('token');
            
            const res = await fetch(`/api/puzzles/random?userRating=${rating}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (data.success) {
                this.currentPuzzle = data.puzzle;
                
                // Load initial position
                this.game.load(this.currentPuzzle.fen);
                this.isSolving = true;
                
                // Make opponent's blunder move if provided
                if (this.currentPuzzle.initialMove) {
                    console.log('🔴 Opponent blunder:', this.currentPuzzle.initialMove);
                    const move = this.makeMoveInternal(this.currentPuzzle.initialMove);
                    if (move) {
                        this.addMoveToHistory(move.san);
                        this.moveIndex = 1;
                    } else {
                        this.moveIndex = 0;
                    }
                } else {
                    this.moveIndex = 0;
                }
                
                this.isUserTurn = true;
                
                // Update UI
                const difficulty = this.currentPuzzle.difficulty || 'Normal';
                document.getElementById('puzzle-difficulty').textContent = difficulty.toUpperCase();
                document.getElementById('puzzle-puzzle-rating').textContent = this.currentPuzzle.rating;
                
                const turn = this.game.turn() === 'w' ? 'White' : 'Black';
                const emoji = turn === 'White' ? '⚪' : '⚫';
                document.getElementById('to-move').textContent = `${emoji} ${turn} to move`;
                
                // Flip board if playing as black
                this.isFlipped = (this.game.turn() === 'b');
                
                this.startTimer();
                this.draw();
                
                console.log('✅ Puzzle loaded:', this.currentPuzzle.puzzleId);
            }
        } catch (error) {
            console.error('❌ Error loading puzzle:', error);
        }
    }
    
    makeMoveInternal(uci) {
        if (!uci) return null;
        const from = uci.substring(0, 2);
        const to = uci.substring(2, 4);
        const promotion = uci.length > 4 ? uci.substring(4, 5) : undefined;
        return this.game.move({ from, to, promotion });
    }
    
    async verifyMove(move) {
        const uci = move.from + move.to + (move.promotion || '');
        
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/puzzles/verify', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({
                    puzzleId: this.currentPuzzle.puzzleId,
                    move: uci,
                    moveNumber: this.moveIndex
                })
            });
            const data = await res.json();
            
            if (data.success && data.isCorrect) {
                console.log('✅ Correct move!');
                this.moveIndex++;
                
                if (data.isComplete) {
                    this.puzzleSolved();
                } else if (data.nextMove) {
                    // Opponent's response
                    setTimeout(() => {
                        const responseMove = this.makeMoveInternal(data.nextMove);
                        if (responseMove) {
                            this.addMoveToHistory(responseMove.san);
                        }
                        this.moveIndex++;
                        this.isUserTurn = true;
                        this.draw();
                    }, 500);
                } else {
                    this.isUserTurn = true;
                }
            } else {
                console.log('❌ Wrong move!');
                this.showFeedback('incorrect', '❌ Wrong move! Try again.');
                this.submitResult(false);
                
                setTimeout(() => {
                    this.game.undo();
                    this.removeLastHistory();
                    this.isUserTurn = true;
                    this.draw();
                }, 1000);
            }
        } catch (error) {
            console.error('❌ Verify error:', error);
            this.game.undo();
            this.removeLastHistory();
            this.isUserTurn = true;
            this.draw();
        }
    }
    
    puzzleSolved() {
        this.isSolving = false;
        this.isUserTurn = false;
        this.stopTimer();
        this.showFeedback('correct', '✅ Puzzle Solved!');
        this.submitResult(true);
    }
    
    async submitResult(solved) {
        if (!solved && this.failed) return;
        if (!solved) this.failed = true;
        
        const timeTaken = Math.floor((Date.now() - this.startTime) / 1000);
        const token = localStorage.getItem('token');
        
        try {
            const res = await fetch('/api/puzzles/submit', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({
                    puzzleId: this.currentPuzzle.puzzleId,
                    solved,
                    timeTaken,
                    hintsUsed: this.hintSquares !== null,
                    attempts: 1
                })
            });
            const data = await res.json();
            
            if (data.success) {
                document.getElementById('puzzle-rating').innerText = data.newRating;
                if (solved) this.loadUserStats();
            }
        } catch (error) {
            console.error('❌ Submit error:', error);
        }
    }
    
    async getHint() {
        if (!this.isSolving || !this.isUserTurn) return;
        
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(
                `/api/puzzles/${this.currentPuzzle.puzzleId}/hint?moveIndex=${this.moveIndex}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            const data = await res.json();
            
            if (data.success && data.hint) {
                this.hintSquares = {
                    from: data.hint.from,
                    to: data.hint.to
                };
                this.draw();
                this.showFeedback('incorrect', '💡 Hint revealed! Try to move.');
            }
        } catch (error) {
            console.error('❌ Hint error:', error);
        }
    }
    
    async showSolution() {
        if (!this.isSolving) return;
        
        this.submitResult(false);
        this.isSolving = false;
        this.stopTimer();
        
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(
                `/api/puzzles/${this.currentPuzzle.puzzleId}/hint?moveIndex=${this.moveIndex}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            const data = await res.json();
            
            if (data.success && data.hint) {
                const move = this.game.move({
                    from: data.hint.from,
                    to: data.hint.to,
                    promotion: 'q'
                });
                
                if (move) {
                    this.addMoveToHistory(move.san);
                    this.hintSquares = null;
                    this.draw();
                }
                
                this.showFeedback('incorrect', '📖 Solution shown. You failed this puzzle.');
            }
        } catch (error) {
            console.error('❌ Solution error:', error);
        }
    }
    
    // ==================== TIMER ====================
    
    startTimer() {
        this.stopTimer();
        this.startTime = Date.now();
        this.timerInterval = setInterval(() => {
            const seconds = Math.floor((Date.now() - this.startTime) / 1000);
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            document.getElementById('timer').innerText = 
                `${minutes}:${secs.toString().padStart(2, '0')}`;
        }, 1000);
    }
    
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
    
    // ==================== UI HELPERS ====================
    
    addMoveToHistory(san) {
        const div = document.createElement('div');
        div.className = 'move-item';
        div.innerText = san;
        const container = document.getElementById('moves-container');
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }
    
    removeLastHistory() {
        const container = document.getElementById('moves-container');
        if (container.lastChild) {
            container.removeChild(container.lastChild);
        }
    }
    
    showFeedback(type, msg) {
        const feedback = document.getElementById('feedback');
        feedback.classList.remove('hidden', 'correct', 'incorrect');
        feedback.classList.add(type);
        document.getElementById('feedback-message').innerText = msg;
    }
    
    hideFeedback() {
        document.getElementById('feedback').classList.add('hidden');
    }
    
    async loadUserStats() {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        try {
            const res = await fetch('/api/puzzles/stats', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (data.success) {
                document.getElementById('puzzles-solved').innerText = data.stats.puzzlesSolved;
                document.getElementById('puzzle-rating').innerText = data.stats.puzzleRating;
                document.getElementById('current-streak').innerText = data.stats.streak.current;
                document.getElementById('success-rate').innerText = data.stats.successRate + '%';
            }
        } catch (error) {
            console.error('❌ Load stats error:', error);
        }
    }
    
    // ==================== SETUP EVENT LISTENERS (Override to add puzzle buttons) ====================
    
    setupEventListeners() {
        // Call base class to setup canvas events (mouse + touch + resize)
        super.setupEventListeners();
        
        // Puzzle-specific buttons
        document.getElementById('new-puzzle-btn')
            .addEventListener('click', () => this.loadNewPuzzle());
        document.getElementById('hint-btn')
            .addEventListener('click', () => this.getHint());
        document.getElementById('solution-btn')
            .addEventListener('click', () => this.showSolution());
        
        console.log('✅ Puzzle buttons setup');
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.puzzleGame = new ChessPuzzleGame();
});