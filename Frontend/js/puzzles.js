// Frontend/js/puzzles.js

class ChessPuzzleGame {
    constructor() {
        // --- CẤU HÌNH CANVAS ---
        this.canvas = document.getElementById('puzzleCanvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.canvasSize = 440; // Match multiplayer size
        this.squareSize = 55;  // 440 / 8
        this.lastParentWidth = 0; // Track width to prevent resize on scroll
        
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

        // --- TƯƠNG TÁC CHUỘT ---
        this.isDragging = false;
        this.dragPiece = null;
        this.dragStartSquare = null;
        this.selectedSquare = null;
        this.mousePos = { x: 0, y: 0 };
        this.legalMoves = [];
        this.hintSquares = null;
        // --- HÌNH ẢNH ---
        this.pieceImages = {};
        this.imagesLoaded = false;

        // --- ÂM THANH ---
        this.sound = window.Sound;

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
        const fontSize = Math.max(12, Math.floor(this.squareSize / 5));
        this.ctx.font = `bold ${fontSize}px Arial`;
        this.ctx.textBaseline = 'bottom';
        
        // Draw letters (a-h)
        for (let file = 0; file < 8; file++) {
            const letter = this.isFlipped 
                ? String.fromCharCode(104 - file)
                : String.fromCharCode(97 + file);
            const x = file * this.squareSize + 2;
            const y = 8 * this.squareSize - 2;
            const isDark = (file + 7) % 2 === 0;
            this.ctx.fillStyle = isDark ? this.colors.dark : this.colors.light;
            this.ctx.fillText(letter, x, y);
        }
        
        // Draw numbers (1-8)
        this.ctx.textBaseline = 'top';
        for (let rank = 0; rank < 8; rank++) {
            const num = this.isFlipped ? (rank + 1) : (8 - rank);
            const x = this.canvas.width - fontSize + 2;
            const y = rank * this.squareSize + 2;
            const isDark = (7 + rank) % 2 === 0;
            this.ctx.fillStyle = isDark ? this.colors.dark : this.colors.light;
            this.ctx.fillText(num, x, y);
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
                // Lưu ý: Canvas vẽ từ trên xuống (rank 0 visual là rank 8 chess nếu không flip)
                // Ta vẽ theo grid r, c của vòng lặp
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
    // 2. LOGIC PUZZLE & API (Phần code cũ được tích hợp lại)
    // ============================================================

// ... code cũ ...

    async loadNewPuzzle() {
        try {
            this.stopTimer();
            this.hideFeedback();
            this.hintSquares = null;
            document.getElementById('moves-container').innerHTML = '';

            const rating = document.getElementById('puzzle-rating').innerText || 1200;
            const token = localStorage.getItem('token');
            
            const res = await fetch(`/api/puzzles/random?userRating=${rating}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.success) {
                this.currentPuzzle = data.puzzle;
                
                // 1. Load FEN gốc
                this.game.load(this.currentPuzzle.fen);
                this.isSolving = true;

                // --- SỬA LẠI LOGIC NÀY ---
                // Kiểm tra xem Server có gửi initialMove không
                if (this.currentPuzzle.initialMove) {
                    console.log("Opponent blunder:", this.currentPuzzle.initialMove);
                    
                    // Thực hiện nước đi của đối thủ
                    const move = this.makeMoveInternal(this.currentPuzzle.initialMove);
                    
                    if (move) {
                        this.addMoveToHistory(move.san);
                        // QUAN TRỌNG: User bắt đầu giải từ index 1
                        this.moveIndex = 1; 
                    } else {
                        // Phòng trường hợp FEN đã bao gồm nước đi này rồi (dữ liệu không đồng nhất)
                        this.moveIndex = 0;
                    }
                } else {
                    // Fallback cho dữ liệu cũ
                    this.moveIndex = 0;
                }
                // --------------------------

                this.isUserTurn = true;

                // Update UI Info
                document.getElementById('puzzle-difficulty').textContent = (this.currentPuzzle.difficulty || 'Normal').toUpperCase();
                document.getElementById('puzzle-puzzle-rating').textContent = this.currentPuzzle.rating;
                
                // Update themes
                const themesEl = document.getElementById('puzzle-themes');
                if (themesEl && this.currentPuzzle.themes) {
                    themesEl.textContent = Array.isArray(this.currentPuzzle.themes) 
                        ? this.currentPuzzle.themes.join(', ') 
                        : this.currentPuzzle.themes;
                }
                
                // Hiển thị lượt đi
                const turn = this.game.turn() === 'w' ? 'White' : 'Black';
                const toMoveEl = document.getElementById('to-move');
                if (toMoveEl) {
                    toMoveEl.innerHTML = `<i class="fa-solid fa-chess-${turn === 'White' ? 'king' : 'queen'}"></i> ${turn} to move`;
                }

                // Lật bàn cờ theo phe User (người chơi luôn cầm quân vừa đến lượt)
                this.isFlipped = (this.game.turn() === 'b');

                this.startTimer();
                this.draw();
            }
        } catch (e) {
            console.error("Error loading puzzle:", e);
        }
    }


    // ... code cũ ...

    // Hàm thực hiện nước đi nội bộ (dùng cho nước đi đầu tiên của máy)
    makeMoveInternal(uci) {
        if (!uci) return null;
        const from = uci.substring(0, 2);
        const to = uci.substring(2, 4);
        const promotion = uci.length > 4 ? uci.substring(4, 5) : undefined;
        return this.game.move({ from, to, promotion });
    }

    async getHint() {
        console.log('🔍 getHint called, isSolving:', this.isSolving, 'isUserTurn:', this.isUserTurn, 'puzzle:', this.currentPuzzle?.puzzleId);
        
        if (!this.isSolving || !this.isUserTurn) {
            console.log('❌ Cannot get hint - isSolving:', this.isSolving, 'isUserTurn:', this.isUserTurn);
            return;
        }
        
        if (!this.currentPuzzle || !this.currentPuzzle.puzzleId) {
            console.log('❌ No puzzle loaded');
            return;
        }

        const token = localStorage.getItem('token');
        try {
            // Gọi API lấy gợi ý (Backend đã có route này)
            const url = `/api/puzzles/${this.currentPuzzle.puzzleId}/hint?moveIndex=${this.moveIndex}`;
            console.log('📡 Fetching hint:', url);
            
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            console.log('📡 Hint response:', data);

            if (data.success && data.hint) {
                // Lưu tọa độ gợi ý vào biến state
                this.hintSquares = {
                    from: data.hint.from,
                    to: data.hint.to
                };
                
                // Vẽ lại bàn cờ để hiện highlight
                this.draw();
                
                // Trừ điểm hoặc ghi nhận đã dùng hint (tuỳ logic game của bạn)
                this.showFeedback('incorrect', 'Hint revealed! Try to move.'); // Dùng style incorrect để cảnh báo
            }
        } catch (error) {
            console.error('Hint error:', error);
        }
    }

    async showSolution() {
        console.log('🔍 showSolution called, isSolving:', this.isSolving, 'puzzle:', this.currentPuzzle?.puzzleId);
        
        if (!this.isSolving) {
            console.log('❌ Cannot show solution - not solving');
            return;
        }
        
        if (!this.currentPuzzle || !this.currentPuzzle.puzzleId) {
            console.log('❌ No puzzle loaded');
            return;
        }

        // 1. Xác nhận thua cuộc
        this.submitResult(false); // Gửi kết quả thua lên server
        this.isSolving = false;   // Dừng game
        this.stopTimer();
        
        // 2. Lấy nước đi đúng (Hack: Gọi API hint để lấy nước đi tiếp theo)
        const token = localStorage.getItem('token');
        try {
            const url = `/api/puzzles/${this.currentPuzzle.puzzleId}/hint?moveIndex=${this.moveIndex}`;
            console.log('📡 Fetching solution:', url);
            
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            console.log('📡 Solution response:', data);

            if (data.success && data.hint) {
                // 3. Thực hiện nước đi trên bàn cờ cho người xem
                const move = this.game.move({
                    from: data.hint.from,
                    to: data.hint.to,
                    promotion: 'q'
                });

                if (move) {
                    this.addMoveToHistory(move.san);
                    this.hintSquares = null; // Xóa hint cũ nếu có
                    this.draw();
                }
                
                this.showFeedback('incorrect', 'Solution shown. You failed this puzzle.');
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

        // 2. Phát âm thanh
        if (this.sound) this.sound.playMove(move, this.game);

        // 3. Cập nhật UI ngay lập tức
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
                if (data.isComplete) {
                    this.puzzleSolved();
                } else if (data.nextMove) {
                    // Máy đi tiếp
                    setTimeout(() => {
                        this.makeMove(data.nextMove);
                        this.moveIndex++;
                        this.isUserTurn = true;
                        this.draw();
                    }, 500);
                }
            } else {
                // SAI
                this.showFeedback('incorrect', 'Wrong move! Try again.');
                this.submitResult(false);
                setTimeout(() => {
                    this.game.undo(); // Undo nước đi sai
                    this.removeLastHistory();
                    this.isUserTurn = true;
                    this.draw();
                }, 1000);
            }
        } catch (e) {
            console.error(e);
            this.game.undo();
            this.isUserTurn = true;
            this.draw();
        }
    }

    makeMove(uci) {
        const from = uci.substring(0, 2);
        const to = uci.substring(2, 4);
        const promotion = uci.length > 4 ? uci.substring(4, 5) : undefined;
        const move = this.game.move({ from, to, promotion });
        if(move) {
            if (this.sound) this.sound.playMove(move, this.game);
            this.addMoveToHistory(move.san);
        }
    }

    puzzleSolved() {
        this.isSolving = false;
        this.stopTimer();
        this.showFeedback('correct', 'Puzzle Solved!');
        this.submitResult(true);
    }

    async submitResult(solved) {
        // Chỉ submit 1 lần
        if (!solved && this.failed) return;
        if (!solved) this.failed = true;

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
                if(solved) this.loadUserStats(); // Reload stats đầy đủ
            }
        });
    }

    // ============================================================
    // 3. UTILS & EVENT HANDLING (Hỗ trợ Timer, Resize, Click)
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

    // Chuyển đổi tọa độ Canvas <-> Ô cờ (quan trọng cho Drag/Drop)
    canvasToSquare(x, y) {
        const c = Math.floor(x / this.squareSize);
        const r = Math.floor(y / this.squareSize);
        
        // Nếu lật bàn cờ thì tính lại
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
        // Mouse events (desktop)
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        
        // Touch events (mobile)
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });

        // Nút bấm
        const newPuzzleBtn = document.getElementById('new-puzzle-btn');
        const hintBtn = document.getElementById('hint-btn');
        const solutionBtn = document.getElementById('solution-btn');
        
        if (newPuzzleBtn) newPuzzleBtn.addEventListener('click', () => this.loadNewPuzzle());
        if (hintBtn) hintBtn.addEventListener('click', () => { console.log('Hint btn clicked'); this.getHint(); });
        if (solutionBtn) solutionBtn.addEventListener('click', () => { console.log('Solution btn clicked'); this.showSolution(); });
        
        console.log('✅ Buttons found:', { newPuzzleBtn: !!newPuzzleBtn, hintBtn: !!hintBtn, solutionBtn: !!solutionBtn });
                
        // Resize - only on orientationchange for mobile, resize for desktop
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.handleResize(true), 100);
        });
        
        // Debounced resize handler
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.handleResize(true);
            }, 100);
        });
        
        // Initial resize with delay (like PvP)
        setTimeout(() => this.handleResize(true), 50);
    }
    
    // Touch handlers for mobile
    handleTouchStart(e) {
        e.preventDefault();
        if (!this.isUserTurn || e.touches.length !== 1) return;
        
        const touch = e.touches[0];
        this.touchStartPos = { x: touch.clientX, y: touch.clientY };
        this.touchMoved = false;
    }
    
    handleTouchMove(e) {
        e.preventDefault();
        if (e.touches.length !== 1) return;
        
        const touch = e.touches[0];
        
        if (this.touchStartPos) {
            const dx = touch.clientX - this.touchStartPos.x;
            const dy = touch.clientY - this.touchStartPos.y;
            if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                // Start dragging if not already
                if (!this.touchMoved) {
                    this.touchMoved = true;
                    const rect = this.canvas.getBoundingClientRect();
                    const x = this.touchStartPos.x - rect.left;
                    const y = this.touchStartPos.y - rect.top;
                    const sq = this.canvasToSquare(x, y);
                    
                    if (sq) {
                        const piece = this.game.get(sq);
                        if (piece && piece.color === this.game.turn()) {
                            this.isDragging = true;
                            this.dragStartSquare = sq;
                            this.dragPiece = piece;
                            this.selectedSquare = sq;
                            this.legalMoves = this.game.moves({ square: sq, verbose: true });
                            this.mousePos = { x, y };
                        }
                    }
                }
                
                if (this.isDragging) {
                    const rect = this.canvas.getBoundingClientRect();
                    this.mousePos = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
                    this.draw();
                }
            }
        }
    }
    
    handleTouchEnd(e) {
        e.preventDefault();
        const touch = e.changedTouches[0];
        
        if (this.touchMoved && this.isDragging) {
            // Was dragging - complete the move
            const rect = this.canvas.getBoundingClientRect();
            const sq = this.canvasToSquare(touch.clientX - rect.left, touch.clientY - rect.top);
            
            if (sq && sq !== this.dragStartSquare) {
                this.onDropPiece(this.dragStartSquare, sq);
            }
            
            this.isDragging = false;
            this.dragPiece = null;
            this.dragStartSquare = null;
            this.legalMoves = [];
            this.draw();
        } else {
            // Tap - treat as click for selection
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            const sq = this.canvasToSquare(x, y);
            
            if (sq && this.isUserTurn) {
                // If already selected a piece and tapping a legal move target
                if (this.selectedSquare && this.legalMoves.some(m => m.to === sq)) {
                    this.onDropPiece(this.selectedSquare, sq);
                    this.selectedSquare = null;
                    this.legalMoves = [];
                    this.draw();
                } else {
                    // Select a piece
                    const piece = this.game.get(sq);
                    if (piece && piece.color === this.game.turn()) {
                        this.selectedSquare = sq;
                        this.legalMoves = this.game.moves({ square: sq, verbose: true });
                        this.draw();
                    } else if (this.selectedSquare) {
                        // Deselect if tapping elsewhere
                        this.selectedSquare = null;
                        this.legalMoves = [];
                        this.draw();
                    }
                }
            }
        }
        
        this.touchStartPos = null;
        this.touchMoved = false;
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
            
            // Nếu thả vào ô khác ô bắt đầu -> Di chuyển
            if (sq && sq !== this.dragStartSquare) {
                this.onDropPiece(this.dragStartSquare, sq);
            }
            
            this.isDragging = false;
            this.dragPiece = null;
            this.dragStartSquare = null;
            this.legalMoves = []; // Xóa gợi ý sau khi thả
            this.draw();
        }
    }

    handleResize(force = false) {
        const boardSquare = this.canvas.parentElement;
        if (!boardSquare) return;
        
        // Use getBoundingClientRect for accurate size (like PvP)
        const rect = boardSquare.getBoundingClientRect();
        const containerSize = Math.min(rect.width, rect.height);
        
        // If element not visible, retry later
        if (containerSize < 50) {
            setTimeout(() => this.handleResize(true), 100);
            return;
        }
        
        // Only resize if size changed significantly or forced
        const sizeDiff = Math.abs(containerSize - this.lastParentWidth);
        if (!force && sizeDiff < 20) return;
        this.lastParentWidth = containerSize;
        
        // DPR-aware canvas sizing (like PvP)
        const dpr = window.devicePixelRatio || 1;
        const size = Math.floor(containerSize);
        
        // Set display size
        this.canvas.style.width = size + 'px';
        this.canvas.style.height = size + 'px';
        
        // Set actual canvas resolution
        this.canvas.width = size * dpr;
        this.canvas.height = size * dpr;
        
        // Scale context for DPR
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        
        // Update internal sizes
        this.canvasSize = size;
        this.squareSize = size / 8;
        
        this.draw();
    }

    // Helper UI
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
    }

    hideFeedback() {
        document.getElementById('feedback').classList.add('hidden');
    }

    async loadUserStats() {
        // Code cũ để lấy stats
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