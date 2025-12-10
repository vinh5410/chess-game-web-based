// Frontend/js/puzzles.js

class ChessPuzzleGame {
    constructor() {
        // --- CẤU HÌNH CANVAS (Lấy từ play-vs-bot) ---
        this.canvas = document.getElementById('puzzleCanvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.canvasSize = 640;
        this.squareSize = 80;
        
        // Màu sắc bàn cờ
        this.colors = {
            light: '#f0d9b5',
            dark: '#b58863',
            highlight: 'rgba(255, 255, 0, 0.4)',
            move: 'rgba(0, 150, 0, 0.6)',
            selected: 'rgba(255, 200, 0, 0.6)'
        };

        // --- TRẠNG THÁI GAME ---
        this.game = new Chess();
        this.currentPuzzle = null;
        this.moveIndex = 0;
        this.isSolving = false;
        this.isUserTurn = false;
        this.isFlipped = false; // Lật bàn cờ nếu người chơi cầm quân Đen
        this.hasSubmittedResult = false; // Ngăn submit nhiều lần

        // --- TƯƠNG TÁC CHUỘT ---
        this.isDragging = false;
        this.dragPiece = null;
        this.dragStartSquare = null;
        this.selectedSquare = null;
        this.mousePos = { x: 0, y: 0 };
        this.legalMoves = [];
        this.hintSquares = null;
        // Audio Manager
        this.audioManager = null;
        // --- HÌNH ẢNH ---
        this.pieceImages = {};
        this.imagesLoaded = false;

        // --- TIMER ---
        this.timerInterval = null;
        this.startTime = null;

        // Bắt đầu
        this.init();
    }

    async init() {
        if (!this.canvas) {
            console.error("Canvas not found!");
            return;
        }

        // 1. Load Hình ảnh quân cờ (Quan trọng để hiển thị)
        await this.loadPieceImages();
        
        // 2. Gắn sự kiện chuột
        this.setupEventListeners();
        // Initialize Audio Manager
        if (window.audioManager) {
            this.audioManager = window.audioManager;
        }        
        // 3. Load thông tin người dùng và Puzzle đầu tiên
        this.handleResize();
        await this.loadUserStats();
        await this.loadNewPuzzle();
    }

    // ============================================================
    // 1. PHẦN RENDERING & ASSETS (Dùng lại của play-vs-bot)
    // ============================================================
    
    async loadPieceImages() {
        const pieces = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'];
        const promises = pieces.map(p => new Promise(resolve => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => {
                // Fallback nếu ảnh lỗi (dùng Wikimedia)
                const map = {'wP':'4/45/Chess_plt45.svg','wN':'7/70/Chess_nlt45.svg','wB':'b/b1/Chess_blt45.svg','wR':'7/72/Chess_rlt45.svg','wQ':'1/15/Chess_qlt45.svg','wK':'4/42/Chess_klt45.svg','bP':'c/c7/Chess_pdt45.svg','bN':'e/ef/Chess_ndt45.svg','bB':'9/98/Chess_bdt45.svg','bR':'f/ff/Chess_rdt45.svg','bQ':'4/47/Chess_qdt45.svg','bK':'f/f0/Chess_kdt45.svg'};
                img.src = `https://upload.wikimedia.org/wikipedia/commons/${map[p]}`;
                resolve();
            };
            img.src = `./assets/pieces/${p}.png`;
            this.pieceImages[p] = img;
        }));
        await Promise.all(promises);
        this.imagesLoaded = true;
        this.draw();
    }

    draw() {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawBoard();
        this.drawCoordinates();
        this.drawHighlights();
        this.drawPieces(); // Vẽ quân cờ đang đứng yên
        this.drawDragPiece(); // Vẽ quân cờ đang bị kéo (nếu có)
    }

    drawBoard() {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const isLight = (r + c) % 2 === 0;
                this.ctx.fillStyle = isLight ? this.colors.light : this.colors.dark;
                this.ctx.fillRect(c * this.squareSize, r * this.squareSize, this.squareSize, this.squareSize);
            }
        }
    }

    drawCoordinates() {
        this.ctx.font = "14px Arial";
        for (let i = 0; i < 8; i++) {
            // Vẽ chữ (a-h)
            const letter = String.fromCharCode(97 + i);
            this.ctx.fillStyle = (i % 2 === 1) ? this.colors.light : this.colors.dark;
            this.ctx.fillText(letter, i * this.squareSize + 5, this.canvas.height - 5);
            
            // Vẽ số (1-8)
            const num = this.isFlipped ? (i + 1) : (8 - i);
            this.ctx.fillStyle = (i % 2 === 0) ? this.colors.light : this.colors.dark;
            this.ctx.fillText(num, this.canvas.width - 15, i * this.squareSize + 15);
        }
    }

    drawHighlights() {
        // Highlight nước đi vừa đi (Last Move)
        const history = this.game.history({ verbose: true });
        if (history.length > 0) {
            const last = history[history.length - 1];
            [last.from, last.to].forEach(sq => {
                const pos = this.squareToCanvas(sq);
                this.ctx.fillStyle = "rgba(155, 199, 0, 0.41)";
                this.ctx.fillRect(pos.x, pos.y, this.squareSize, this.squareSize);
            });
        }

        // Highlight ô đang chọn
        if (this.selectedSquare) {
            const pos = this.squareToCanvas(this.selectedSquare);
            this.ctx.fillStyle = this.colors.selected;
            this.ctx.fillRect(pos.x, pos.y, this.squareSize, this.squareSize);
        }

        // Highlight các nước đi hợp lệ (Gợi ý chấm tròn)
        this.legalMoves.forEach(m => {
            const pos = this.squareToCanvas(m.to);
            this.ctx.fillStyle = this.colors.move;
            this.ctx.beginPath();
            this.ctx.arc(pos.x + this.squareSize/2, pos.y + this.squareSize/2, 12, 0, 2*Math.PI);
            this.ctx.fill();
        });
        
        if (this.hintSquares) {
            const fromPos = this.squareToCanvas(this.hintSquares.from);
            const toPos = this.squareToCanvas(this.hintSquares.to);

            // Vẽ viền xanh lá đậm quanh ô đi và ô đến
            this.ctx.lineWidth = 4;
            this.ctx.strokeStyle = "rgba(0, 255, 0, 0.8)"; 
            
            this.ctx.strokeRect(fromPos.x, fromPos.y, this.squareSize, this.squareSize);
            this.ctx.strokeRect(toPos.x, toPos.y, this.squareSize, this.squareSize);
            
            // Reset line width
            this.ctx.lineWidth = 1; 
        }        
    }

    drawPieces() {
        const board = this.game.board();
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                // Logic vẽ đảo ngược nếu bàn cờ bị lật (isFlipped)
                const rankIdx = this.isFlipped ? (7 - r) : r;
                const fileIdx = this.isFlipped ? (7 - c) : c;
                
                const piece = board[rankIdx][fileIdx]; // Lấy quân cờ từ dữ liệu
                if (!piece) continue;

                // Tính toán tọa độ vẽ
                const squareStr = this.canvasToSquare(c * this.squareSize, r * this.squareSize);

                // Không vẽ quân đang bị kéo (để vẽ nó ở vị trí chuột)
                if (this.isDragging && this.dragStartSquare === squareStr) continue;

                this.drawSinglePiece(piece, c * this.squareSize, r * this.squareSize);
            }
        }
    }

    drawSinglePiece(piece, x, y) {
        const key = piece.color + piece.type.toUpperCase(); // vd: 'wK', 'bP'
        if (this.imagesLoaded && this.pieceImages[key]) {
            this.ctx.drawImage(this.pieceImages[key], x + 5, y + 5, this.squareSize - 10, this.squareSize - 10);
        }
    }

    drawDragPiece() {
        if (this.isDragging && this.dragPiece) {
            // Vẽ quân cờ ngay tại vị trí chuột
            this.drawSinglePiece(this.dragPiece, this.mousePos.x - this.squareSize/2, this.mousePos.y - this.squareSize/2);
        }
    }

    // ============================================================
    // 2. LOGIC PUZZLE & API (Cải thiện theo yêu cầu)
    // ============================================================

    async loadNewPuzzle() {
        try {
            this.stopTimer();
            this.hideFeedback();
            this.hintSquares = null;
            this.hasSubmittedResult = false;
            document.getElementById('moves-container').innerHTML = '';

            const rating = document.getElementById('puzzle-rating').innerText || 1200;
            const token = localStorage.getItem('token');
            
            const res = await fetch(`/api/puzzles/random?userRating=${rating}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.success) {
                this.currentPuzzle = data.puzzle;
                
                // 1. Load FEN GỐC (Trước khi đối thủ đi)
                this.game.load(this.currentPuzzle.fen);
                this.isSolving = true;
                this.isUserTurn = false; // Chưa cho user đi
                this.moveIndex = 0;

                // Update UI Info
                document.getElementById('puzzle-difficulty').textContent = (this.currentPuzzle.difficulty || 'Normal').toUpperCase();
                document.getElementById('puzzle-puzzle-rating').textContent = this.currentPuzzle.rating;
                
                // 2. Vẽ bàn cờ ban đầu
                this.isFlipped = false; // Tạm thời chưa lật
                this.draw();

                // Hiển thị turn hiện tại
                this.updateTurnIndicator();

                // 3. Delay 1 giây rồi máy đi nước đầu tiên
                await new Promise(resolve => setTimeout(resolve, 1000));

                if (this.currentPuzzle.initialMove) {
                    console.log("Opponent plays:", this.currentPuzzle.initialMove);
                    
                    const move = this.makeMoveInternal(this.currentPuzzle.initialMove);
                    
                    if (move) {
                        this.addMoveToHistory(move.san);
                        this.moveIndex = 1; // Bắt đầu từ index 1
                        this.draw();
                    }
                }

                // 4. Giờ đến lượt USER
                this.isUserTurn = true;

                // Lật bàn cờ theo phe User (người chơi luôn ở dưới)
                this.isFlipped = (this.game.turn() === 'b');
                this.draw();

                // Update turn indicator
                this.updateTurnIndicator();

                this.startTimer();
            }
        } catch (e) {
            console.error("Error loading puzzle:", e);
        }
    }

    updateTurnIndicator() {
        const turn = this.game.turn() === 'w' ? 'White' : 'Black';
        document.getElementById('to-move').textContent = `${turn === 'White' ? '⚪' : '⚫'} ${turn} to move`;
    }

    // Hàm thực hiện nước đi nội bộ (dùng cho nước đi đầu tiên của máy)
    makeMoveInternal(uci) {
        if (!uci) return null;
        const from = uci.substring(0, 2);
        const to = uci.substring(2, 4);
        const promotion = uci.length > 4 ? uci.substring(4, 5) : undefined;
        const move = this.game.move({ from, to, promotion });
        
        // Phát âm thanh
        if (move && this.audioManager) {
            this.audioManager.playMove(move, this.game);
        }
        
        return move;
    }

    async getHint() {
        if (!this.isSolving || !this.isUserTurn) return;

        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/puzzles/${this.currentPuzzle.puzzleId}/hint?moveIndex=${this.moveIndex}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
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
            console.error('Hint error:', error);
        }
    }

    async showSolution() {
        if (!this.isSolving) return;

        // 1. Đánh dấu thua cuộc
        this.submitResult(false);
        this.isSolving = false;
        this.stopTimer();
        
        // 2. Lấy nước đi đúng
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/puzzles/${this.currentPuzzle.puzzleId}/hint?moveIndex=${this.moveIndex}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
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
                
                this.showFeedback('incorrect', '👁️ Solution shown. You failed this puzzle.');
            }
        } catch (error) {
            console.error('Show solution error:', error);
        }
    }

    async onDropPiece(from, to) {
        if (!this.isUserTurn || !this.isSolving) return;

        // 1. Kiểm tra nước đi hợp lệ với chess.js
        const move = this.game.move({ from, to, promotion: 'q' });
        if (!move) {
            this.draw(); // Reset vị trí nếu đi lỗi
            return; 
        }
        // Phát âm thanh
        if (this.audioManager) {
            this.audioManager.playMove(move, this.game);
        }
        // 2. Cập nhật UI ngay lập tức
        this.addMoveToHistory(move.san);
        this.draw();
        this.isUserTurn = false; // Khóa bàn cờ chờ server

        // 3. Gửi lên Server verify
        const uci = move.from + move.to + (move.promotion || '');
        
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/puzzles/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    puzzleId: this.currentPuzzle.puzzleId,
                    move: uci,
                    moveNumber: this.moveIndex
                })
            });
            const data = await res.json();

            if (data.success && data.isCorrect) {
                // ĐÚNG
                this.moveIndex++;
                this.hintSquares = null; // Xóa hint nếu có
                
                if (data.isComplete) {
                    this.puzzleSolved();
                } else if (data.nextMove) {
                    // Máy đi tiếp
                    await new Promise(resolve => setTimeout(resolve, 500));
                    this.makeMove(data.nextMove);
                    this.moveIndex++;
                    this.isUserTurn = true;
                    this.updateTurnIndicator();
                    this.draw();
                }
            } else {
                // SAI - Hiển thị thông báo với 2 nút
                this.showFeedbackWithActions(
                    'incorrect', 
                    '❌ Wrong move! Try again or skip to next puzzle.',
                    [
                        {
                            text: '🔄 Try Again',
                            onclick: () => {
                                this.game.undo();
                                this.removeLastHistory();
                                this.isUserTurn = true;
                                this.hideFeedback();
                                this.draw();
                            }
                        },
                        {
                            text: '⏭️ Next Puzzle',
                            onclick: () => {
                                this.submitResult(false);
                                this.loadNewPuzzle();
                            }
                        }
                    ]
                );
            }
        } catch (e) {
            console.error(e);
            this.game.undo();
            this.removeLastHistory();
            this.isUserTurn = true;
            this.draw();
        }
    }

    makeMove(uci) {
        const from = uci.substring(0, 2);
        const to = uci.substring(2, 4);
        const promotion = uci.length > 4 ? uci.substring(4, 5) : undefined;
        const move = this.game.move({ from, to, promotion });
        
        if (move) {
            this.addMoveToHistory(move.san);
            
            // Phát âm thanh
            if (this.audioManager) {
                this.audioManager.playMove(move, this.game);
            }
        }
    }

    puzzleSolved() {
        this.isSolving = false;
        this.stopTimer();
        this.showFeedback('correct', '✅ Puzzle Solved! Great job!');
        this.submitResult(true);
    }

    async submitResult(solved) {
        // Chỉ submit 1 lần
        if (this.hasSubmittedResult) return;
        this.hasSubmittedResult = true;

        const timeTaken = Math.floor((Date.now() - this.startTime) / 1000);
        const token = localStorage.getItem('token');

        await fetch('/api/puzzles/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                puzzleId: this.currentPuzzle.puzzleId,
                solved,
                timeTaken,
                hintsUsed: false,
                attempts: 1
            })
        }).then(res => res.json()).then(data => {
            if (data.success) {
                document.getElementById('puzzle-rating').innerText = data.newRating;
                if(solved) this.loadUserStats();
            }
        });
    }

    // ============================================================
    // 3. UTILS & EVENT HANDLING
    // ============================================================

    startTimer() {
        this.stopTimer();
        this.startTime = Date.now();
        this.timerInterval = setInterval(() => {
            const now = Math.floor((Date.now() - this.startTime) / 1000);
            const m = Math.floor(now / 60);
            const s = now % 60;
            document.getElementById('timer').innerText = `${m}:${s.toString().padStart(2, '0')}`;
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
    }

    canvasToSquare(x, y) {
        const c = Math.floor(x / this.squareSize);
        const r = Math.floor(y / this.squareSize);
        
        const file = this.isFlipped ? (7 - c) : c;
        const rank = this.isFlipped ? r : (7 - r);

        if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
        return String.fromCharCode(97 + file) + (rank + 1);
    }

    squareToCanvas(square) {
        const file = square.charCodeAt(0) - 97;
        const rank = parseInt(square[1]) - 1;

        const c = this.isFlipped ? (7 - file) : file;
        const r = this.isFlipped ? rank : (7 - rank);

        return { x: c * this.squareSize, y: r * this.squareSize };
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));

        document.getElementById('new-puzzle-btn').addEventListener('click', () => this.loadNewPuzzle());
        document.getElementById('hint-btn').addEventListener('click', () => this.getHint());
        document.getElementById('solution-btn').addEventListener('click', () => this.showSolution());        
        
        window.addEventListener('resize', () => this.handleResize());
    }

    handleMouseDown(e) {
        if (!this.isUserTurn) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const sq = this.canvasToSquare(x, y);

        if (sq) {
            const piece = this.game.get(sq);
            if (piece && piece.color === this.game.turn()) {
                this.isDragging = true;
                this.dragStartSquare = sq;
                this.dragPiece = piece;
                this.selectedSquare = sq;
                this.legalMoves = this.game.moves({ square: sq, verbose: true });
                this.mousePos = {x, y};
                this.draw();
            }
        }
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        if (this.isDragging) this.draw();
    }

    handleMouseUp(e) {
        if (this.isDragging) {
            const rect = this.canvas.getBoundingClientRect();
            const sq = this.canvasToSquare(e.clientX - rect.left, e.clientY - rect.top);
            
            if (sq && sq !== this.dragStartSquare) {
                this.onDropPiece(this.dragStartSquare, sq);
            }
            
            this.isDragging = false;
            this.dragPiece = null;
            this.dragStartSquare = null;
            this.legalMoves = [];
            this.draw();
        }
    }

    handleResize() {
        const parent = this.canvas.parentElement;
        if (parent) {
            const size = Math.min(parent.clientWidth - 40, 640);
            this.canvas.width = size;
            this.canvas.height = size;
            this.canvasSize = size;
            this.squareSize = size / 8;
            this.draw();
        }
    }

    addMoveToHistory(san) {
        const div = document.createElement('div');
        div.className = 'move-item';
        div.innerText = san;
        document.getElementById('moves-container').appendChild(div);
        document.getElementById('moves-container').scrollTop = 9999;
    }
    
    removeLastHistory() {
        const list = document.getElementById('moves-container');
        if(list.lastChild) list.removeChild(list.lastChild);
    }

    showFeedback(type, msg) {
        const fb = document.getElementById('feedback');
        fb.classList.remove('hidden', 'correct', 'incorrect');
        fb.classList.add(type);
        document.getElementById('feedback-message').innerText = msg;
        
        // Xóa các nút cũ nếu có
        const existingActions = fb.querySelector('.feedback-actions');
        if (existingActions) existingActions.remove();
    }

    showFeedbackWithActions(type, msg, actions) {
        this.showFeedback(type, msg);
        
        const fb = document.getElementById('feedback');
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'feedback-actions';
        actionsDiv.style.marginTop = '15px';
        actionsDiv.style.display = 'flex';
        actionsDiv.style.gap = '10px';
        actionsDiv.style.justifyContent = 'center';
        
        actions.forEach(action => {
            const btn = document.createElement('button');
            btn.textContent = action.text;
            btn.className = 'control-btn';
            btn.style.fontSize = '14px';
            btn.style.padding = '8px 16px';
            btn.onclick = action.onclick;
            actionsDiv.appendChild(btn);
        });
        
        fb.appendChild(actionsDiv);
    }

    hideFeedback() {
        document.getElementById('feedback').classList.add('hidden');
    }

    async loadUserStats() {
        const token = localStorage.getItem('token');
        if(!token) return;
        const res = await fetch('/api/puzzles/stats', { headers: { 'Authorization': `Bearer ${token}` }});
        const data = await res.json();
        if(data.success) {
            document.getElementById('puzzles-solved').innerText = data.stats.puzzlesSolved;
            document.getElementById('puzzle-rating').innerText = data.stats.puzzleRating;
            document.getElementById('current-streak').innerText = data.stats.streak.current;
            document.getElementById('success-rate').innerText = data.stats.successRate + '%';
        }
    }
}

// Khởi tạo
document.addEventListener('DOMContentLoaded', () => {
    window.puzzleGame = new ChessPuzzleGame();
});