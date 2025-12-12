// 📁 Frontend/js/play-vs-bot.js - Refactored version
class ChessCanvasVsBot extends ChessBoardRenderer {
    constructor() {
        super('chessCanvas');
        
        // Bot-specific state
        this.gameStarted = false;
        this.gameOver = false;
        this.isPlayerTurn = true;
        this.isThinking = false;
        this.botDifficulty = 5;
        this.winner = null;
        this.playerColor = 'white';
        
        // API Cache
        this.apiCache = new Map();
        this.maxCacheSize = 100;
        
        // UI Manager
        this.ui = window.uiManager;
        
        this.initPromise = this.init();
    }
    
    async init() {
        console.log('🎯 Initializing Canvas Chess Game...');
        
        if (typeof window.Chess !== 'function') {
            console.error('❌ Chess.js not available');
            return false;
        }
        
        await this.loadPieceImages();
        this.setupEventListeners();
        this.draw();
        
        console.log('✅ Canvas Chess Game initialized');
        return true;
    }
    
    // ==================== OVERRIDE TEMPLATE METHODS ====================
    
    canInteract() {
        return this.gameStarted && !this.gameOver && this.isPlayerTurn && !this.isThinking;
    }
    
    getPlayerColor() {
        return this.playerColor.charAt(0);
    }
    
    afterMove(move) {
        // Called after successful move from base class
        this.updateGameStatus();
        
        if (this.checkGameOver()) return;
        
        this.isPlayerTurn = false;
        setTimeout(() => this.makeBotMove(), 750);
    }
    
    // ==================== BOT LOGIC (unchanged, just better organized) ====================
    
    async makeBotMove() {
        if (this.gameOver || !this.gameStarted) return;
        
        console.log('🤖 Bot is thinking...');
        this.isThinking = true;
        this.updateGameStatus('🤖 Bot is thinking...');
        
        try {
            const moves = this.game.moves();
            if (moves.length === 0) return;
            
            let selectedMove = await this.selectBotMove(moves);
            const thinkTime = Math.max(500, this.botDifficulty * 100 + Math.random() * 1000);
            await GameUtils.wait(thinkTime);
            
            const move = this.game.move(selectedMove);
            console.log('🤖 Bot move:', move.san);
            
            this.draw();
            this.updateGameStatus();
            
            if (this.checkGameOver()) return;
            
            this.isPlayerTurn = true;
            this.isThinking = false;
            
        } catch (error) {
            console.error('❌ Bot move error:', error);
            this.isPlayerTurn = true;
            this.isThinking = false;
            this.updateGameStatus('Your turn');
        }
    }
    
    async selectBotMove(moves) {
        try {
            console.log(`🎯 Selecting move for difficulty level ${this.botDifficulty}`);
            
            if (this.botDifficulty === 1) return this.getRandomMove(moves);
            if (this.botDifficulty === 3) return this.getRuleBasedBotMove(moves);
            
            if (this.botDifficulty >= 5) {
                const apiMove = await this.getLichessMove();
                if (apiMove) {
                    const errorRate = this.getErrorRate(this.botDifficulty);
                    if (Math.random() < errorRate) {
                        console.log(`🎲 Bot making intentional mistake (${errorRate * 100}% chance)`);
                        return this.getRuleBasedBotMove(moves);
                    }
                    return apiMove;
                }
            }
            
            return this.getRuleBasedBotMove(moves);
            
        } catch (error) {
            console.error('Bot move selection error:', error);
            return this.getRandomMove(moves);
        }
    }
    
    async getLichessMove() {
        const fen = this.game.fen();
        const cacheKey = `${fen}_${this.botDifficulty}`;
        
        if (this.apiCache.has(cacheKey)) {
            console.log('📦 Using cached API response');
            return this.apiCache.get(cacheKey);
        }
        
        try {
            console.log('🌐 Calling Lichess API...');
            
            const response = await fetch(`https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=3`, {
                method: 'GET',
                headers: { 
                    'Accept': 'application/json',
                    'User-Agent': 'ChessGame/1.0'
                },
                signal: AbortSignal.timeout(5000)
            });

            if (!response.ok) throw new Error(`Lichess API error: ${response.status}`);

            const data = await response.json();
            console.log('📡 Lichess API response:', data);
            
            if (data.pvs && data.pvs.length > 0) {
                const selectedPV = this.selectPVByDifficulty(data.pvs, this.botDifficulty);
                
                if (selectedPV && selectedPV.moves) {
                    const bestMoveUCI = selectedPV.moves.split(' ')[0];
                    console.log('🎯 Selected UCI move:', bestMoveUCI);
                    
                    const sanMove = this.uciToSan(bestMoveUCI);
                    if (sanMove) {
                        this.cacheAPIResponse(cacheKey, sanMove);
                        return sanMove;
                    }
                }
            }
            
            return null;
            
        } catch (error) {
            console.error('❌ Lichess API error:', error.message);
            return null;
        }
    }
    
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
    
    selectPVByDifficulty(pvs, difficulty) {
        if (pvs.length === 0) return null;
        
        if (difficulty >= 15) return pvs[0];
        if (difficulty >= 10) return Math.random() < 0.9 ? pvs[0] : (pvs[1] || pvs[0]);
        if (difficulty >= 8) {
            if (Math.random() < 0.8) return pvs[0];
            const topMoves = pvs.slice(0, 2);
            return GameUtils.randomElement(topMoves);
        }
        
        const topMoves = pvs.slice(0, 3);
        return Math.random() < 0.7 ? pvs[0] : GameUtils.randomElement(topMoves);
    }
    
    getErrorRate(difficulty) {
        const errorRates = { 5: 0.25, 8: 0.15, 10: 0.08, 15: 0.02 };
        return errorRates[difficulty] || 0.1;
    }
    
    cacheAPIResponse(key, value) {
        if (this.apiCache.size >= this.maxCacheSize) {
            const firstKey = this.apiCache.keys().next().value;
            this.apiCache.delete(firstKey);
        }
        this.apiCache.set(key, value);
    }
    
    getRandomMove(moves) {
        const randomMove = GameUtils.randomElement(moves);
        console.log('🎲 Selected random move:', randomMove);
        return randomMove;
    }
    
    getRuleBasedBotMove(moves) {
        let selectedMove = GameUtils.randomElement(moves);
        
        try {
            if (this.botDifficulty >= 3) {
                const captures = moves.filter(move => {
                    const testGame = new window.Chess(this.game.fen());
                    const moveObj = testGame.move(move);
                    return moveObj && moveObj.captured;
                });
                
                if (captures.length > 0 && Math.random() < 0.7) {
                    selectedMove = GameUtils.randomElement(captures);
                    console.log('🎯 Rule-based: Preferred capture');
                }
            }
            
            if (this.botDifficulty >= 5) {
                const checks = moves.filter(move => {
                    const testGame = new window.Chess(this.game.fen());
                    testGame.move(move);
                    return testGame.inCheck();
                });
                
                if (checks.length > 0 && Math.random() < 0.5) {
                    selectedMove = GameUtils.randomElement(checks);
                    console.log('🎯 Rule-based: Preferred check');
                }
            }
        } catch (error) {
            console.error('Rule-based move selection error:', error);
        }
        
        return selectedMove;
    }
    
    // ==================== GAME CONTROL ====================
    
    async startGame(difficulty, playerColor = 'white') {
        console.log(`🎮 Starting game - Difficulty: ${difficulty}, Color: ${playerColor}`);
        
        if (!await this.initPromise) {
            GameUtils.showAlert('Game not ready. Please refresh the page.');
            return;
        }
        
        this.botDifficulty = difficulty;
        this.playerColor = playerColor;
        this.game = new window.Chess();
        this.gameStarted = true;
        this.gameOver = false;
        this.winner = null;
        this.selectedSquare = null;
        this.legalMoves = [];
        this.apiCache.clear();
        
        this.isFlipped = (playerColor === 'black');
        this.isPlayerTurn = (playerColor === 'white');
        this.isThinking = false;
        
        this.draw();
        
        // Update UI using UIManager
        this.ui.updateBotLevel(difficulty, this.getDifficultyEmoji(difficulty));
        this.ui.updatePlayerColor(playerColor);
        
        if (playerColor === 'white') {
            this.updateGameStatus('Your turn - Click a piece to move!');
        } else {
            this.updateGameStatus('Bot starts first...');
            setTimeout(() => this.makeBotMove(), 1000);
        }
        
        console.log('🏁 Game setup complete');
    }
    
    checkGameOver() {
        try {
            if (this.game.isGameOver()) {
                this.gameOver = true;
                this.gameStarted = false;
                this.isThinking = false;
                
                if (this.game.isCheckmate()) {
                    const winnerColor = this.game.turn() === 'w' ? 'black' : 'white';
                    this.winner = (winnerColor === this.playerColor) ? 'player' : 'bot';
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
        let result = '';
        if (this.winner === 'draw') {
            result = 'Game is a draw! 🤝';
        } else if (this.winner === 'player') {
            result = 'You win! 👑';
        } else {
            result = 'Bot wins! 🤖';
        }
        
        this.ui.showGameOver(result);
        console.log('🏁 Game over:', result);
    }
    
    updateGameStatus(customMessage) {
        if (customMessage) {
            this.ui.updateGameStatus(customMessage);
            return;
        }

        if (this.gameOver) return;
        
        let status = '';
        
        if (this.isThinking) {
            status = '🤖 Bot is thinking...';
            if (this.botDifficulty >= 5) {
                status += ' (Using Lichess API)';
            } else {
                status += ' (Rule-based)';
            }
        } else if (this.isPlayerTurn) {
            status = '👤 Your turn - Click to move';
        } else {
            status = '🤖 Bot\'s turn';
        }
        
        try {
            if (this.game.inCheck()) {
                const turn = this.game.turn() === 'w' ? 'White' : 'Black';
                status += ` - ${turn} is in check! ⚠️`;
            }
        } catch (error) {
            // Ignore
        }
        
        this.ui.updateGameStatus(status);
    }
    
    getDifficultyEmoji(level) {
        const emojis = { 1: '😊', 3: '🙂', 5: '🤔', 8: '😤', 10: '🔥', 15: '🔥' };
        return emojis[level] || '🤔';
    }
}

// ==================== UI FUNCTIONS (Simplified with utilities) ====================

let gameInstance = null;
let selectedColor = null;

function showDifficultyMenu() {
    GameUtils.hide('mainMenu');
    GameUtils.show('colorMenu');
}

function selectColor(color) {
    console.log(`Selected color: ${color}`);
    
    selectedColor = color === 'random' 
        ? (Math.random() < 0.5 ? 'white' : 'black')
        : color;
    
    console.log(`Final color: ${selectedColor}`);
    
    GameUtils.hide('colorMenu');
    GameUtils.show('difficultyMenu');
}

function backToDifficultyMenu() {
    GameUtils.hide('difficultyMenu');
    GameUtils.show('colorMenu');
}

function backToMenu() {
    window.uiManager.hideAllScreens('bot');
    GameUtils.show('mainMenu');
    GameUtils.hide('gameControls');
    GameUtils.hide('chessboardContainer');
    window.uiManager.hideGameOver();
    
    window.uiManager.updateGameStatus('Choose game mode to start');
    
    selectedColor = null;
    
    if (gameInstance) {
        gameInstance.gameStarted = false;
        gameInstance.gameOver = false;
        gameInstance.isThinking = false;
    }
}

async function startBotGame(difficulty) {
    console.log(`Starting bot game: difficulty ${difficulty}, color ${selectedColor}`);
    
    if (!gameInstance) {
        GameUtils.showAlert('Game not ready yet. Please wait a moment and try again.');
        return;
    }
    
    if (!selectedColor) {
        GameUtils.showAlert('Please select your color first!');
        backToDifficultyMenu();
        return;
    }
    
    GameUtils.hide('difficultyMenu');
    window.uiManager.showBotControls();
    
    await gameInstance.startGame(difficulty, selectedColor);
}

function restartGame() {
    if (gameInstance && gameInstance.botDifficulty) {
        gameInstance.startGame(gameInstance.botDifficulty, gameInstance.playerColor);
        window.uiManager.hideGameOver();
    }
}

function flipBoard() {
    if (gameInstance) {
        gameInstance.flipBoard();
    }
}

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 DOM loaded, initializing Canvas Chess...');
    
    await GameUtils.wait(500);
    
    if (typeof window.Chess !== 'function') {
        console.error('❌ Chess.js not available');
        window.uiManager.updateGameStatus('❌ Chess library failed to load');
        return;
    }
    
    gameInstance = new ChessCanvasVsBot();
    const initialized = await gameInstance.initPromise;
    
    if (initialized) {
        console.log('✅ Canvas Chess ready to play!');
        window.uiManager.updateGameStatus('Choose game mode to start');
    } else {
        console.error('❌ Failed to initialize canvas chess');
        window.uiManager.updateGameStatus('❌ Failed to initialize game');
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        if (!GameUtils.hasClass('gameOverOverlay', 'hidden')) {
            restartGame();
        }
    }
    
    if (e.key === 'Escape') {
        backToMenu();
    }
    
    if (e.key === 'f' || e.key === 'F') {
        flipBoard();
    }
});