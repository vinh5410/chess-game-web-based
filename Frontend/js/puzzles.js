// Frontend/js/puzzles.js

class ChessPuzzleGame {
    constructor() {
        
        this.canvas = document.getElementById('puzzleCanvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.canvasSize = 440; // Match multiplayer size (will be overridden by renderer)
        this.squareSize = 55;  // 440 / 8 (will be overridden by renderer)
        this.lastParentWidth = 0; // Track width to prevent resize on scroll (kept for compatibility)

        // Renderer dùng chung cho việc vẽ bàn cờ và quân cờ
        this.board = null;

        // Màu sắc bổ sung cho overlay (last move, hint ...)
        this.colors = {
            light: '#f0d9b5',
            dark: '#b58863',
            highlight: 'rgba(255, 255, 0, 0.4)',
            move: 'rgba(0, 150, 0, 0.6)',
            selected: 'rgba(255, 200, 0, 0.6)'
        };

        
        this.game = new Chess();
        this.currentPuzzle = null;
        this.moveIndex = 0;
        this.isSolving = false;
        this.isUserTurn = false;
        this.isFlipped = false; // Lật bàn cờ nếu người chơi cầm quân Đen

        
        this.isDragging = false;
        this.dragPiece = null;
        this.dragStartSquare = null;
        this.selectedSquare = null;
        this.mousePos = { x: 0, y: 0 };
        this.legalMoves = [];
        this.hintSquares = null;

        
        this.sound = window.Sound;

        
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

        // 1. Khởi tạo renderer dùng chung cho việc vẽ bàn cờ
        if (typeof ChessBoardRenderer === 'function') {
            this.board = new ChessBoardRenderer('puzzleCanvas', { isFlipped: this.isFlipped });

            // Renderer dùng game nội bộ của ChessPuzzleGame
            this.board.game = this.game;

            // 1.1. Load hình ảnh quân cờ qua renderer
            await this.board.loadPieceImages();

            // Không dùng event listener mặc định của renderer, vì puzzle có logic riêng
            // nên ta chỉ tận dụng phần vẽ bàn cờ.
        } else {
            console.warn('ChessBoardRenderer not found, fallback to legacy drawing');
        }

        // 2. Gắn sự kiện chuột / touch và các nút điều khiển
        this.setupEventListeners();

        // 3. Resize ban đầu & load thông tin
        this.handleResize();
        await this.loadUserStats();
        await this.loadNewPuzzle();
    }

    draw() {
        if (!this.board) return;

        // Đồng bộ trạng thái game và tương tác sang renderer
        this.board.game = this.game;
        this.board.isFlipped = this.isFlipped;
        this.board.selectedSquare = this.selectedSquare;
        this.board.legalMoves = this.legalMoves;
        this.board.isDragging = this.isDragging;
        this.board.dragPiece = this.dragPiece;
        this.board.dragStartSquare = this.dragStartSquare;
        this.board.mousePos = this.mousePos;

        // Vẽ phần cơ bản (bàn cờ, quân cờ, selection, legal moves ...)
        this.board.draw();

        // Vẽ thêm overlay riêng cho puzzle (last move, hint ...)
        this.drawPuzzleOverlays();
    }

    // Vẽ các overlay riêng cho chế độ puzzle (nước đi cuối, gợi ý)
    drawPuzzleOverlays() {
        if (!this.board || !this.board.ctx) return;
        const ctx = this.board.ctx;
        const squareSize = this.board.squareSize;

        // Highlight nước đi cuối cùng
        const history = this.game.history({ verbose: true });
        if (history.length > 0) {
            const last = history[history.length - 1];
            [last.from, last.to].forEach(sq => {
                const pos = this.squareToCanvas(sq);
                ctx.fillStyle = 'rgba(155, 199, 0, 0.41)';
                ctx.fillRect(pos.x, pos.y, squareSize, squareSize);
            });
        }

        // Highlight gợi ý (hint)
        if (this.hintSquares) {
            const fromPos = this.squareToCanvas(this.hintSquares.from);
            const toPos = this.squareToCanvas(this.hintSquares.to);

            ctx.lineWidth = 4;
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
            ctx.strokeRect(fromPos.x, fromPos.y, squareSize, squareSize);
            ctx.strokeRect(toPos.x, toPos.y, squareSize, squareSize);
            ctx.lineWidth = 1;
        }
    }

    // 2. LOGIC PUZZLE & API (Phần code cũ được tích hợp lại)

// ... code cũ ...

    async loadNewPuzzle() {
        try {
            this.stopTimer();
            this.hideFeedback();
            this.hintSquares = null;
            document.getElementById('moves-container').innerHTML = '';

            const rating = document.getElementById('puzzle-rating').innerText || 1200;
            const token = localStorage.getItem('token');
            
            // using absolute API URL
            const res = await fetch(`https://chess-game-web-based.onrender.com/api/puzzles/random?userRating=${rating}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.success) {
                this.currentPuzzle = data.puzzle;
                
                // 1. Load FEN gốc
                this.game.load(this.currentPuzzle.fen);
                this.isSolving = true;

                // Kiểm tra xem Server có gửi initialMove không
                if (this.currentPuzzle.initialMove) {
                    
                    this.game.load(this.currentPuzzle.fen);
                    this.isSolving = true;

                    // Initially assume user not to move until we determine after potential opponent blunder
                    this.moveIndex = 0;
                    this.isUserTurn = false;

                    // Ensure visuals and assets settled, start timer so user sees elapsed while waiting
                    this.draw();
                    this.startTimer();

                    // If server provided an initial opponent move, wait briefly then apply it
                    if (this.currentPuzzle.initialMove) {
                        const delay = (ms) => new Promise(res => setTimeout(res, ms));
                        const initialDelayMs = 1000; // 1 second pause before opponent's first move

                        // Wait so player sees the starting position first
                        await delay(initialDelayMs);

                        // Perform opponent move now
                        const move = this.makeMoveInternal(this.currentPuzzle.initialMove);
                        if (move) {
                            this.addMoveToHistory(move.san);
                            // User's next expected move index is 1 (opponent move consumed)
                            this.moveIndex = 1;
                        } else {
                            // If move couldn't be applied (data mismatch), keep index at 0
                            this.moveIndex = 0;
                        }

                        // After opponent move, it's user's turn
                        this.isUserTurn = true;
                        // Redraw to reflect the move
                        this.draw();
                    } else {
                        // No initial opponent move — user moves from the FEN directly
                        this.moveIndex = 0;
                        this.isUserTurn = true;
                        this.draw();
                    }
                } else {
                    // Fallback cho dữ liệu cũ
                    this.moveIndex = 0;
                }
                

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
              console.log('Cannot get hint - isSolving:', this.isSolving, 'isUserTurn:', this.isUserTurn);
            return;
        }
        
        if (!this.currentPuzzle || !this.currentPuzzle.puzzleId) {
              console.log('No puzzle loaded');
            return;
        }

        const token = localStorage.getItem('token');
        try {
            // Gọi API lấy gợi ý (Backend đã có route này)
            // using absolute API URL
            const url = `https://chess-game-web-based.onrender.com/api/puzzles/${this.currentPuzzle.puzzleId}/hint?moveIndex=${this.moveIndex}`;
            console.log('Fetching hint:', url);
            
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
                this.showFeedback('incorrect', '💡 Hint revealed! Try to move.'); // Dùng style incorrect để cảnh báo
            }
        } catch (error) {
            console.error('Hint error:', error);
        }
    }

    async showSolution() {
        console.log('showSolution called, puzzle:', this.currentPuzzle?.puzzleId);

        if (!this.currentPuzzle || !this.currentPuzzle.puzzleId) {
                console.log('No puzzle loaded');
            return;
        }

        // Mark failed once and stop user interaction
        this.submitResult(false);
        this.isSolving = false;
        this.stopTimer();
        this.isUserTurn = false;

        const token = localStorage.getItem('token');
        const fromIndex = Math.max(0, this.moveIndex || 0);
        // using absolute API URL
        const solutionUrl = `https://chess-game-web-based.onrender.com/api/puzzles/${this.currentPuzzle.puzzleId}/solution?fromIndex=${fromIndex}`;

        // Disable buttons while replaying
        const solutionBtn = document.getElementById('solution-btn');
        const hintBtn = document.getElementById('hint-btn');
        if (solutionBtn) solutionBtn.disabled = true;
        if (hintBtn) hintBtn.disabled = true;

        try {
            const res = await fetch(solutionUrl, { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            if (!data.success || !Array.isArray(data.moves) || data.moves.length === 0) {
                this.showFeedback('incorrect', '❌ Solution not available.');
                return;
            }

            const delay = (ms) => new Promise(r => setTimeout(r, ms));
            const initialPause = 1000;    // ms before first move (let UI update)
            const perMoveDelay = 700;    // ms between moves — tăng/giảm tuỳ thích
            this.draw();
            // short initial pause so board and UI settle
            await delay(initialPause);

            // Apply every move object sequentially
            for (let i = 0; i < data.moves.length; i++) {
                const m = data.moves[i];
                const moveObj = this.game.move({
                    from: m.from,
                    to: m.to,
                    promotion: m.promotion || 'q'
                });
                if (moveObj) {
                    if (this.sound) this.sound.playMove(moveObj, this.game);
                    this.addMoveToHistory(moveObj.san);
                    this.draw();
                }
                // pause so user can watch the move
                await delay(perMoveDelay);
            }

            // advance local moveIndex to end-of-solution
            this.moveIndex = fromIndex + data.moves.length;

            this.showFeedback('incorrect', '❌ Solution shown. You failed this puzzle.');
        } catch (err) {
            console.error('Show solution error:', err);
            this.showFeedback('incorrect', '❌ Error showing solution.');
        } finally {
            if (solutionBtn) solutionBtn.disabled = false;
            if (hintBtn) hintBtn.disabled = false;
            this.isUserTurn = false;
            this.isSolving = false;
            this.draw();
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
            // using absolute API URL
            const res = await fetch(`https://chess-game-web-based.onrender.com/api/puzzles/verify`, {
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
                this.showFeedback('incorrect', '❌ Wrong move! Try again.');
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
        this.showFeedback('correct', '✅ Puzzle Solved!');
        this.submitResult(true);
    }

    async submitResult(solved) {
        // Chỉ submit 1 lần
        if (!solved && this.failed) return;
        if (!solved) this.failed = true;

        const timeTaken = Math.floor((Date.now() - this.startTime) / 1000);
        const token = localStorage.getItem('token');

        // using absolute API URL
        await fetch(`https://chess-game-web-based.onrender.com/api/puzzles/submit`, {
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

    // 3. UTILS & EVENT HANDLING (Hỗ trợ Timer, Resize, Click)

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
        if (this.board) {
            // Dùng mapping đã được chuẩn hóa của ChessBoardRenderer
            this.board.isFlipped = this.isFlipped;
            return this.board.canvasToSquare(x, y);
        }

        // Fallback cũ nếu renderer không có
        const c = Math.floor(x / this.squareSize);
        const r = Math.floor(y / this.squareSize);
        const file = this.isFlipped ? (7 - c) : c;
        const rank = this.isFlipped ? r : (7 - r);
        if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
        return String.fromCharCode(97 + file) + (rank + 1);
    }

    squareToCanvas(square) {
        if (this.board) {
            this.board.isFlipped = this.isFlipped;
            return this.board.squareToCanvas(square);
        }

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
        if (this.board) {
            this.board.handleResize(force);
            // Đồng bộ lại kích thước cho các hàm fallback nếu cần
            this.canvasSize = this.board.canvasSize;
            this.squareSize = this.board.squareSize;
        } else if (this.canvas && this.ctx) {
            // Fallback logic cũ nếu ChessBoardRenderer không tồn tại
            const boardSquare = this.canvas.parentElement;
            if (!boardSquare) return;

            const rect = boardSquare.getBoundingClientRect();
            const containerSize = Math.min(rect.width, rect.height);
            if (containerSize < 50) {
                setTimeout(() => this.handleResize(true), 100);
                return;
            }

            const sizeDiff = Math.abs(containerSize - this.lastParentWidth);
            if (!force && sizeDiff < 20) return;
            this.lastParentWidth = containerSize;

            const dpr = window.devicePixelRatio || 1;
            const size = Math.floor(containerSize);
            this.canvas.style.width = size + 'px';
            this.canvas.style.height = size + 'px';
            this.canvas.width = size * dpr;
            this.canvas.height = size * dpr;
            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            this.canvasSize = size;
            this.squareSize = size / 8;
        }

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
        // using absolute API URL
        const res = await fetch(`https://chess-game-web-based.onrender.com/api/puzzles/stats`, { headers: { 'Authorization': `Bearer ${token}` }});
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