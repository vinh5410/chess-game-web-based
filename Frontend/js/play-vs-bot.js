class ChessVsBot {
    constructor() {
        this.initPromise = this.waitForLibraries();
        // Cache API responses để tránh spam requests
        this.apiCache = new Map();
        this.maxCacheSize = 100;
    }

    async waitForLibraries() {
        console.log('🔄 Waiting for libraries to load...');
        
        // Đợi Chess.js từ CommonJS
        let attempts = 0;
        const maxAttempts = 50; // 5 giây
        
        while (typeof window.Chess !== 'function' && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
            
            if (attempts % 10 === 0) {
                console.log(`🔄 Still waiting for Chess.js... (${attempts}/${maxAttempts})`);
            }
        }
        
        if (typeof window.Chess !== 'function') {
            console.error('❌ Chess.js failed to load after 5 seconds');
            return false;
        }

        // Test Chess.js constructor
        try {
            const testGame = new window.Chess();
            console.log('✅ Chess.js constructor works:', testGame.fen());
            console.log('✅ Test moves:', testGame.moves().length);
        } catch (error) {
            console.error('❌ Chess.js constructor failed:', error);
            return false;
        }

        // Đợi Chessboard.js
        attempts = 0;
        while (typeof window.Chessboard === 'undefined' && attempts < 30) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (typeof window.Chessboard === 'undefined') {
            console.error('❌ Chessboard.js failed to load');
            return false;
        }

        console.log('✅ All libraries loaded successfully');
        
        // Initialize game variables
        try {
            this.game = new window.Chess();
            console.log('✅ Initial Chess game created successfully');
        } catch (error) {
            console.error('❌ Failed to create initial Chess game:', error);
            return false;
        }
        
        this.board = null;
        this.botDifficulty = 5;
        this.isPlayerTurn = true;
        this.gameStarted = false;
        this.gameOver = false;
        this.isThinking = false;
        this.winner = null;
        
        return true;
    }

    async init() {
        const loaded = await this.initPromise;
        if (!loaded) {
            console.error('❌ Libraries not available');
            return false;
        }

        console.log('🎯 Initializing Chessboard...');
        
        if (typeof window.Chess !== 'function') {
            console.error('❌ Chess.js not available during init');
            return false;
        }
        
        try {
            const boardElement = document.getElementById('board');
            if (!boardElement) {
                console.error('❌ Board element not found');
                return false;
            }
            
            const config = {
                draggable: true,
                position: 'start',
                onDragStart: this.onDragStart.bind(this),
                onDrop: this.onDrop.bind(this),
                onSnapEnd: this.onSnapEnd.bind(this),
                pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
            };

            this.board = window.Chessboard('board', config);
            console.log('✅ Chessboard initialized successfully');
            
            setTimeout(() => {
                if (this.board) {
                    this.board.position('start');
                    console.log('✅ Board position set to start');
                }
            }, 500);
            
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Chessboard:', error);
            return false;
        }
    }

    onDragStart(source, piece, position, orientation) {
        if (this.gameOver) {
            console.log('Game is over, no moves allowed');
            return false;
        }

        if (!this.isPlayerTurn || this.isThinking) {
            console.log('Not player turn or bot is thinking');
            return false;
        }

        if (piece.search(/^b/) !== -1) {
            console.log('Cannot move black pieces');
            return false;
        }

        if (this.game.turn() !== 'w') {
            console.log('Not white\'s turn');
            return false;
        }

        console.log('Drag start allowed for:', piece, 'from', source);
        return true;
    }

    onDrop(source, target) {
        console.log('Drop attempt:', source, 'to', target);
        
        try {
            const move = this.game.move({
                from: source,
                to: target,
                promotion: 'q'
            });

            if (move === null) {
                console.log('Invalid move');
                return 'snapback';
            }

            console.log('✅ Player move:', move.san);
            this.updateGameStatus();
            
            if (this.checkGameOver()) {
                return;
            }

            this.isPlayerTurn = false;
            setTimeout(() => this.makeBotMove(), 750);
            return true;
        } catch (error) {
            console.error('❌ Move error:', error);
            return 'snapback';
        }
    }

    onSnapEnd() {
        this.board.position(this.game.fen());
    }

    async startGame(difficulty) {
        console.log(`🎮 Starting game with difficulty: ${difficulty}`);
        
        if (typeof window.Chess !== 'function') {
            console.error('❌ Chess.js not available');
            alert('Chess library not loaded. Please refresh the page.');
            return;
        }
        
        if (!this.board) {
            console.error('❌ Chessboard not initialized');
            alert('Game board not ready. Please refresh the page.');
            return;
        }
        
        try {
            this.botDifficulty = difficulty;
            this.game = new window.Chess();
            console.log('✅ New Chess game created for difficulty', difficulty);
            
            this.board.start();
            this.isPlayerTurn = true;
            this.gameStarted = true;
            this.gameOver = false;
            this.isThinking = false;
            this.winner = null;
            
            // Clear cache for new game
            this.apiCache.clear();
            
            this.updateGameStatus('Your turn - Move a piece!');
            
            const botLevelInfo = document.getElementById('botLevelInfo');
            if (botLevelInfo) {
                botLevelInfo.innerHTML = `Playing vs Bot Level ${difficulty} ${this.getDifficultyEmoji(difficulty)}`;
            }
            
            document.getElementById('gameControls').classList.remove('hidden');
            document.getElementById('chessboardContainer').classList.remove('hidden');
            
            const gameOverOverlay = document.getElementById('gameOverOverlay');
            if (gameOverOverlay) {
                gameOverOverlay.classList.add('hidden');
            }
            
            console.log('🏁 Game setup complete');
        } catch (error) {
            console.error('❌ Failed to start game:', error);
            alert('Failed to start game: ' + error.message);
        }
    }

    async makeBotMove() {
        if (this.gameOver || !this.gameStarted) {
            console.log('Game over or not started, bot cannot move');
            return;
        }

        console.log('🤖 Bot is thinking...');
        this.isThinking = true;
        this.updateGameStatus('🤖 Bot is thinking...');

        try {
            const moves = this.game.moves();
            if (moves.length === 0) {
                console.log('No moves available for bot');
                return;
            }
            
            let selectedMove = await this.selectBotMove(moves);
            const thinkTime = Math.max(500, this.botDifficulty * 100 + Math.random() * 1000);
            await new Promise(resolve => setTimeout(resolve, thinkTime));
            
            const move = this.game.move(selectedMove);
            console.log('🤖 Bot move:', move.san);
            
            this.board.position(this.game.fen());
            this.updateGameStatus();
            
            if (this.checkGameOver()) {
                return;
            }
            
            this.isPlayerTurn = true;
            this.isThinking = false;
            
        } catch (error) {
            console.error('❌ Bot move error:', error);
            this.isPlayerTurn = true;
            this.isThinking = false;
            this.updateGameStatus('Your turn');
        }
    }

    /**
     * LOGIC PHÂN CHIA ĐỘ KHÓ:
     * Level 1: Random moves (không dùng API)
     * Level 3: Rule-based (ăn quân, avoid blunders)
     * Level 5: Lichess API với depth thấp + thỉnh thoảng sai lầm
     * Level 8: Lichess API với depth trung bình + ít sai lầm
     * Level 10: Lichess API với depth cao + rất ít sai lầm
     * Level 15: Lichess API với depth max + không sai lầm
     */
    async selectBotMove(moves) {
        try {
            console.log(`🎯 Selecting move for difficulty level ${this.botDifficulty}`);
            
            // Level 1: Pure random (không dùng API)
            if (this.botDifficulty === 1) {
                return this.getRandomMove(moves);
            }
            
            // Level 3: Rule-based only
            if (this.botDifficulty === 3) {
                return this.getRuleBasedBotMove(moves);
            }
            
            // Level 5+: Sử dụng Lichess API
            if (this.botDifficulty >= 5) {
                const apiMove = await this.getLichessMove();
                if (apiMove) {
                    // Thêm sai lầm ngẫu nhiên dựa trên difficulty
                    const errorRate = this.getErrorRate(this.botDifficulty);
                    if (Math.random() < errorRate) {
                        console.log(`🎲 Bot making intentional mistake (${errorRate * 100}% chance)`);
                        return this.getRuleBasedBotMove(moves);
                    }
                    return apiMove;
                }
            }
            
            // Fallback to rule-based
            console.log('📋 Using rule-based fallback');
            return this.getRuleBasedBotMove(moves);
            
        } catch (error) {
            console.error('Bot move selection error:', error);
            return this.getRandomMove(moves);
        }
    }

    /**
     * LICHESS API INTEGRATION
     * Sử dụng Lichess Cloud Evaluation API
     * Free, không cần API key, trả về nước đi tốt nhất
     */
    async getLichessMove() {
        const fen = this.game.fen();
        const cacheKey = `${fen}_${this.botDifficulty}`;
        
        // Kiểm tra cache trước
        if (this.apiCache.has(cacheKey)) {
            console.log('📦 Using cached API response');
            return this.apiCache.get(cacheKey);
        }
        
        try {
            console.log('🌐 Calling Lichess API...');
            
            // Tính depth dựa trên difficulty
            const depth = this.getDepthForDifficulty(this.botDifficulty);
            
            // Call Lichess Cloud Eval API
            const response = await fetch(`https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=1`, {
                method: 'GET',
                headers: { 
                    'Accept': 'application/json',
                    'User-Agent': 'ChessGame/1.0'
                },
                // Timeout after 5 seconds
                signal: AbortSignal.timeout(5000)
            });

            if (!response.ok) {
                throw new Error(`Lichess API error: ${response.status}`);
            }

            const data = await response.json();
            console.log('📡 Lichess API response:', data);
            
            if (data.pvs && data.pvs.length > 0) {
                // Chọn nước đi dựa trên difficulty
                const selectedPV = this.selectPVByDifficulty(data.pvs, this.botDifficulty);
                
                if (selectedPV && selectedPV.moves) {
                    const bestMoveUCI = selectedPV.moves.split(' ')[0];
                    console.log('🎯 Selected UCI move:', bestMoveUCI);
                    
                    // Convert UCI to SAN notation
                    const sanMove = this.uciToSan(bestMoveUCI);
                    if (sanMove) {
                        // Cache result
                        this.cacheAPIResponse(cacheKey, sanMove);
                        return sanMove;
                    }
                }
            }
            
            console.warn('⚠️ No valid moves from Lichess API');
            return null;
            
        } catch (error) {
            console.error('❌ Lichess API error:', error.message);
            return null;
        }
    }

    /**
     * Chuyển đổi UCI notation (e2e4) thành SAN notation (e4)
     */
    uciToSan(uciMove) {
        try {
            const testGame = new window.Chess(this.game.fen());
            
            const move = testGame.move({
                from: uciMove.substring(0, 2),
                to: uciMove.substring(2, 4),
                promotion: uciMove.length > 4 ? uciMove.substring(4, 5) : undefined
            });
            
            if (move) {
                console.log(`🔄 Converted ${uciMove} to ${move.san}`);
                return move.san;
            }
            
            return null;
        } catch (error) {
            console.error('❌ UCI to SAN conversion error:', error);
            return null;
        }
    }

    /**
     * Tính depth cho Lichess API dựa trên difficulty
     */
    getDepthForDifficulty(difficulty) {
        const depthMap = {
            5: 8,   // Medium depth
            8: 12,  // High depth  
            10: 16, // Very high depth
            15: 20  // Maximum depth
        };
        return depthMap[difficulty] || 10;
    }

    /**
     * Chọn PV (Principal Variation) dựa trên difficulty
     */
    selectPVByDifficulty(pvs, difficulty) {
        if (pvs.length === 0) return null;
        
        // Level 15: Luôn chọn nước đi tốt nhất
        if (difficulty >= 15) {
            return pvs[0];
        }
        
        // Level 10: 90% tốt nhất, 10% tốt thứ 2
        if (difficulty >= 10) {
            return Math.random() < 0.9 ? pvs[0] : (pvs[1] || pvs[0]);
        }
        
        // Level 8: 80% tốt nhất, 20% random trong top 2
        if (difficulty >= 8) {
            if (Math.random() < 0.8) {
                return pvs[0];
            } else {
                const topMoves = pvs.slice(0, 2);
                return topMoves[Math.floor(Math.random() * topMoves.length)];
            }
        }
        
        // Level 5: 70% tốt nhất, 30% random trong top 3
        const topMoves = pvs.slice(0, 3);
        if (Math.random() < 0.7) {
            return pvs[0];
        } else {
            return topMoves[Math.floor(Math.random() * topMoves.length)];
        }
    }

    /**
     * Tính tỷ lệ sai lầm dựa trên difficulty
     */
    getErrorRate(difficulty) {
        const errorRates = {
            5: 0.25,   // 25% sai lầm
            8: 0.15,   // 15% sai lầm
            10: 0.08,  // 8% sai lầm
            15: 0.02   // 2% sai lầm
        };
        return errorRates[difficulty] || 0.1;
    }

    /**
     * Cache API response để tránh spam
     */
    cacheAPIResponse(key, value) {
        if (this.apiCache.size >= this.maxCacheSize) {
            // Remove oldest entry
            const firstKey = this.apiCache.keys().next().value;
            this.apiCache.delete(firstKey);
        }
        this.apiCache.set(key, value);
        console.log(`📦 Cached API response for ${key}`);
    }

    /**
     * Random move cho level 1
     */
    getRandomMove(moves) {
        const randomMove = moves[Math.floor(Math.random() * moves.length)];
        console.log('🎲 Selected random move:', randomMove);
        return randomMove;
    }

    /**
     * Rule-based bot logic (giữ nguyên từ code cũ)
     */
    getRuleBasedBotMove(moves) {
        let selectedMove = moves[Math.floor(Math.random() * moves.length)];
        
        try {
            if (this.botDifficulty >= 3) {
                // Prefer captures
                const captures = moves.filter(move => {
                    const testGame = new window.Chess(this.game.fen());
                    const moveObj = testGame.move(move);
                    return moveObj && moveObj.captured;
                });
                
                if (captures.length > 0 && Math.random() < 0.7) {
                    selectedMove = captures[Math.floor(Math.random() * captures.length)];
                    console.log('🎯 Rule-based: Preferred capture');
                }
            }
            
            if (this.botDifficulty >= 5) {
                // Prefer checks
                const checks = moves.filter(move => {
                    const testGame = new window.Chess(this.game.fen());
                    testGame.move(move);
                    return testGame.inCheck();
                });
                
                if (checks.length > 0 && Math.random() < 0.5) {
                    selectedMove = checks[Math.floor(Math.random() * checks.length)];
                    console.log('🎯 Rule-based: Preferred check');
                }
            }
        } catch (error) {
            console.error('Rule-based move selection error:', error);
        }
        
        console.log('📋 Rule-based selected move:', selectedMove);
        return selectedMove;
    }

    checkGameOver() {
        try {
            if (this.game.isGameOver()) {
                this.gameOver = true;
                this.gameStarted = false;
                this.isThinking = false;
                
                if (this.game.isCheckmate()) {
                    this.winner = this.game.turn() === 'w' ? 'black' : 'white';
                } else {
                    this.winner = 'draw';
                }
                
                this.showGameOver();
                return true;
            }
        } catch (error) {
            console.error('Game over check error:', error);
        }
        
        return false;
    }

    showGameOver() {
        const overlay = document.getElementById('gameOverOverlay');
        const winnerText = document.getElementById('winnerText');
        
        if (!overlay || !winnerText) {
            console.error('Game over elements not found');
            return;
        }

        let result = '';
        if (this.winner === 'draw') {
            result = 'Game is a draw! 🤝';
        } else if (this.winner === 'white') {
            result = 'You win! 👑';
        } else {
            result = 'Bot wins! 🤖';
        }
        
        winnerText.textContent = result;
        overlay.classList.remove('hidden');
        
        console.log('🏁 Game over:', result);
    }

    updateGameStatus(customMessage) {
        const gameStatus = document.getElementById('gameStatus');
        if (!gameStatus) return;

        if (customMessage) {
            gameStatus.textContent = customMessage;
            return;
        }

        if (this.gameOver) return;
        
        let status = '';
        
        if (this.isThinking) {
            status = '🤖 Bot is thinking...';
            // Hiển thị loại bot đang sử dụng
            if (this.botDifficulty >= 5) {
                status += ' (Using Lichess API)';
            } else {
                status += ' (Rule-based)';
            }
        } else if (this.isPlayerTurn) {
            status = '👤 Your turn - Make a move';
        } else {
            status = '🤖 Bot\'s turn';
        }
        
        try {
            if (this.game.inCheck()) {
                const turn = this.game.turn() === 'w' ? 'White' : 'Black';
                status += ` - ${turn} is in check! ⚠️`;
            }
        } catch (error) {
            // Ignore check detection errors
        }
        
        gameStatus.textContent = status;
    }

    getDifficultyEmoji(level) {
        const emojis = {
            1: '😊', 3: '🙂', 5: '🤔', 
            8: '😤', 10: '🔥', 15: '🔥'
        };
        return emojis[level] || '🤔';
    }

    /**
     * Lấy mô tả chi tiết về độ khó
     */
    getDifficultyDescription(level) {
        const descriptions = {
            1: 'Beginner - Random moves',
            3: 'Easy - Basic tactics (captures, checks)',
            5: 'Medium - Lichess API + 25% mistakes',
            8: 'Hard - Lichess API + 15% mistakes', 
            10: 'Expert - Lichess API + 8% mistakes',
            15: 'Master - Lichess API + 2% mistakes'
        };
        return descriptions[level] || 'Unknown difficulty';
    }
}

// Global game instance
let gameInstance = null;

// UI Functions
function showDifficultyMenu() {
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('difficultyMenu').classList.remove('hidden');
}

function backToMenu() {
    document.getElementById('mainMenu').classList.remove('hidden');
    document.getElementById('difficultyMenu').classList.add('hidden');
    document.getElementById('gameControls').classList.add('hidden');
    document.getElementById('chessboardContainer').classList.add('hidden');
    document.getElementById('gameOverOverlay').classList.add('hidden');
    
    document.getElementById('gameStatus').textContent = 'Choose game mode to start';
    
    if (gameInstance) {
        gameInstance.gameStarted = false;
        gameInstance.gameOver = false;
        gameInstance.isThinking = false;
    }
}

async function startBotGame(difficulty) {
    console.log(`Starting bot game with difficulty: ${difficulty}`);
    
    if (!gameInstance) {
        alert('Game not ready yet. Please wait a moment and try again.');
        return;
    }
    
    if (typeof window.Chess !== 'function') {
        alert('Chess library not loaded yet. Please wait and try again.');
        return;
    }
    
    document.getElementById('difficultyMenu').classList.add('hidden');
    await gameInstance.startGame(difficulty);
}

function restartGame() {
    if (gameInstance && gameInstance.botDifficulty) {
        gameInstance.startGame(gameInstance.botDifficulty);
        document.getElementById('gameOverOverlay').classList.add('hidden');
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 DOM loaded, waiting for Chess.js...');
    
    setTimeout(async () => {
        console.log('📦 Creating game instance...');
        
        if (typeof window.Chess !== 'function') {
            console.error('❌ Chess.js still not available');
            document.getElementById('gameStatus').textContent = '❌ Chess library failed to load';
            return;
        }
        
        gameInstance = new ChessVsBot();
        const initialized = await gameInstance.init();
        
        if (initialized) {
            console.log('✅ Game ready to play!');
            document.getElementById('gameStatus').textContent = 'Choose game mode to start';
        } else {
            console.error('❌ Failed to initialize game');
            document.getElementById('gameStatus').textContent = '❌ Failed to initialize game';
        }
    }, 1000);
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const overlay = document.getElementById('gameOverOverlay');
        if (overlay && !overlay.classList.contains('hidden')) {
            restartGame();
        }
    }
    
    if (e.key === 'Escape') {
        backToMenu();
    }
});

// Handle window resize for responsive board
window.addEventListener('resize', () => {
    if (gameInstance && gameInstance.board) {
        gameInstance.board.resize();
    }
});