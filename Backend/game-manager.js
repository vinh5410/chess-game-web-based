const { Chess } = require('chess.js');
const { v4: uuidv4 } = require('uuid');
const GameHistory = require('./models/GameHistory');
const User = require('./models/User');
const { calculateElo } = require('./services/elo/eloCalculator');

// --- GameRoom with server-side timers ---
class GameRoom {
    constructor(id, type = 'private', timeControl = null) {
        this.id = id;
        this.type = type; // 'private' or 'matchmaking'
        this.code = this.generateRoomCode();
        this.players = []; // [{ socketId, userId }]
        this.playerColors = {}; // socketId -> 'white' | 'black'
        this.game = new Chess();
        this.status = 'waiting'; // 'waiting', 'playing', 'finished'
        this.currentTurn = 'white';
        this.createdAt = Date.now();
        this.startedAt = null;
        this.finishedAt = null;
        this.winner = null;
        this.moves = [];
        this.chatHistory = [];
        this.timeControl = timeControl; // { initial, increment }
        
        // Timer related (server-side)
        // timers: socketId -> secondsLeft
        this.timers = {};
        this.lastUpdate = null; // timestamp ms
        this.timerInterval = null; // Node interval reference
    }
    
    generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }
    
    addPlayer(socketId, userId) {
        if (this.players.length >= 2) return false;
        this.players.push({ socketId, userId });
        
        // Assign colors
        if (this.players.length === 1) {
            this.playerColors[socketId] = Math.random() < 0.5 ? 'white' : 'black';
        } else {
            const firstPlayerColor = this.playerColors[this.players[0].socketId];
            this.playerColors[socketId] = firstPlayerColor === 'white' ? 'black' : 'white';
        }
        
        return true;
    }
    
    removePlayer(socketId) {
        const index = this.players.findIndex(p => p.socketId === socketId);
        if (index > -1) {
            this.players.splice(index, 1);
            delete this.playerColors[socketId];
            delete this.timers[socketId];
        }
    }
    
    isFull() {
        return this.players.length === 2;
    }
    
    hasPlayer(socketId) {
        return this.players.some(p => p.socketId === socketId);
    }
    getPlayerColor(socketId) {
        return this.playerColors[socketId];
    }
    
    getOpponent(socketId) {
        const opponent = this.players.find(p => p.socketId !== socketId);
        return opponent ? opponent.socketId : null;
    }
    
    isPlayerTurn(socketId) {
        const color = this.playerColors[socketId];
        return color === this.currentTurn;
    }
    
    // Initialize timers when the game starts
    initTimers() {
        const initial = (this.timeControl && this.timeControl.initial) ? this.timeControl.initial : 300;
        for (const p of this.players) {
            this.timers[p.socketId] = initial;
        }
        this.lastUpdate = Date.now();
    }
    
    // Start server tick for this room
    startTimers(io) {
        // guard
        if (this.timerInterval) return;
        this.lastUpdate = Date.now();
        this.timerInterval = setInterval(() => {
            const now = Date.now();
            const elapsedSec = Math.floor((now - this.lastUpdate) / 1000);
            if (elapsedSec <= 0) return;
            this.lastUpdate = now;
            // determine current player socketId
            const currentPlayer = this.players.find(p => this.playerColors[p.socketId] === this.currentTurn);
            if (!currentPlayer) return;
            const curId = currentPlayer.socketId;
            this.timers[curId] = Math.max(0, (this.timers[curId] || 0) - elapsedSec);
            // emit timer snapshot to room
            io.to(this.id).emit('game:timer_update', {
                timers: { ...this.timers },
                currentTurnSocketId: curId
            });
            // handle timeout
            if (this.timers[curId] <= 0) {
                // current player lost by timeout
                clearInterval(this.timerInterval);
                this.timerInterval = null;
                // determine winner socketId
                const winner = this.getOpponent(curId);
                // emit game over to room
                io.to(this.id).emit('game:over', {
                    winner: this.playerColors[winner] || null,
                    reason: 'timeout',
                    fen: this.game.fen()
                });
                // mark finished
                this.status = 'finished';
                this.finishedAt = Date.now();
                this.winner = winner;
            }
        }, 1000);
    }
    
    stopTimers() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
    
    // Called before applying a move, subtract elapsed seconds from current player
    applyElapsedBeforeMove() {
        if (!this.lastUpdate) this.lastUpdate = Date.now();
        const now = Date.now();
        const elapsed = Math.floor((now - this.lastUpdate) / 1000);
        if (elapsed <= 0) return;
        const currentPlayer = this.players.find(p => this.playerColors[p.socketId] === this.currentTurn);
        if (!currentPlayer) return;
        const curId = currentPlayer.socketId;
        this.timers[curId] = Math.max(0, (this.timers[curId] || 0) - elapsed);
        this.lastUpdate = now;
    }
    
    makeMove(socketId, move) {
        // Before doing move, deduct elapsed seconds from the player who had the turn
        this.applyElapsedBeforeMove();
        
        if (!this.isPlayerTurn(socketId)) {
            return {
                success: false,
                message: 'Not your turn'
            };
        }
        
        try {
            const moveResult = this.game.move(move);
            
            if (moveResult) {
                // apply increment (if any) to player who moved
                const increment = (this.timeControl && this.timeControl.increment) ? this.timeControl.increment : 0;
                if (increment > 0) {
                    this.timers[socketId] = (this.timers[socketId] || 0) + increment;
                }
                
                this.moves.push({
                    player: socketId,
                    san: moveResult.san,
                    from: moveResult.from,
                    to: moveResult.to,
                    piece: moveResult.piece,
                    captured: moveResult.captured,
                    promotion: moveResult.promotion,
                    flags: moveResult.flags,
                    timestamp: Date.now()
                });
                
                this.currentTurn = this.game.turn() === 'w' ? 'white' : 'black';
                
                const result = {
                    success: true,
                    move: moveResult.san,
                    fen: this.game.fen(),
                    gameOver: this.game.isGameOver()
                };
                
                if (result.gameOver) {
                    this.status = 'finished';
                    this.finishedAt = Date.now();
                    
                    if (this.game.isCheckmate()) {
                        result.winner = this.playerColors[socketId];
                        result.reason = 'checkmate';
                        this.winner = socketId;
                    } else if (this.game.isDraw()) {
                        result.winner = null;
                        result.reason = 'draw';
                    } else if (this.game.isStalemate()) {
                        result.winner = null;
                        result.reason = 'stalemate';
                    } else if (this.game.isThreefoldRepetition()) {
                        result.winner = null;
                        result.reason = 'repetition';
                    } else if (this.game.isInsufficientMaterial()) {
                        result.winner = null;
                        result.reason = 'insufficient_material';
                    }
                }
                
                return result;
            } else {
                return {
                    success: false,
                    message: 'Invalid move'
                };
            }
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }
    
    start() {
        this.status = 'playing';
        this.startedAt = Date.now();
    }
    
    end(winner = null, reason = 'unknown') {
        this.status = 'finished';
        this.finishedAt = Date.now();
        this.winner = winner;
        // stop timers if running
        this.stopTimers();
    }
}

class GameManager {
    constructor(io, userManager) {
        this.io = io;
        this.userManager = userManager;
        this.rooms = new Map(); // roomId -> GameRoom
        this.roomCodes = new Map(); // roomCode -> roomId
        this.matchmakingQueue = []; // [socketId]
    }
    
    // Matchmaking
    async addToMatchmaking(socketId, userId, timeControl = 300) {
        // Check if already in queue
        const existingIndex = this.matchmakingQueue.findIndex(entry => 
            (entry.socketId === socketId) || (entry === socketId)
        );
        if (existingIndex !== -1) {
            const oldTime = this.matchmakingQueue[existingIndex].timeControl;
            console.log(`⚠️ Player ${socketId} already in queue, updating time: ${oldTime}s → ${timeControl}s`);
            this.matchmakingQueue.splice(existingIndex, 1);
        }
        
        // Add to queue with timeControl
        this.matchmakingQueue.push({ socketId, timeControl });
        
        console.log(`🎲 Added to queue: ${socketId} with ${timeControl}s. Queue size: ${this.matchmakingQueue.length}`);
        
        // Try to find match with SAME timeControl
        for (let i = 0; i < this.matchmakingQueue.length; i++) {
            const entry1 = this.matchmakingQueue[i];
            
            // Skip if it's the same player we just added
            if (entry1.socketId === socketId) continue;
            
            // Check if same time control
            if (entry1.timeControl === timeControl) {
                // Found a match!
                const entry2 = this.matchmakingQueue[this.matchmakingQueue.length - 1]; // The player we just added
                
                const player1Id = entry1.socketId;
                const player2Id = entry2.socketId;
                
                console.log(`🎉 Potential match: ${player1Id} vs ${player2Id} with ${timeControl}s`);
                
                // Remove both from queue
                this.matchmakingQueue = this.matchmakingQueue.filter(e => 
                    e.socketId !== player1Id && e.socketId !== player2Id
                );
                
                const player1 = this.userManager.getUser(player1Id);
                const player2 = this.userManager.getUser(player2Id);
                if (!player1 || !player2) {
                    console.log(`❌ One player disconnected: player1=${!!player1}, player2=${!!player2}`);
                    return { matched: false };
                }
                
                // Create game room with timeControl
                const roomId = uuidv4();
                const room = new GameRoom(roomId, 'matchmaking', {
                    initial: timeControl,
                    increment: 0
                });
                
                const player1Db = await User.findOne({ username: player1.username });
                const player2Db = await User.findOne({ username: player2.username });
                room.addPlayer(player1Id, player1Db ? player1Db._id : undefined);
                room.addPlayer(player2Id, player2Db ? player2Db._id : undefined);
                
                this.rooms.set(roomId, room);
                
                // Update user status
                this.userManager.setUserInGame(player1Id, true, roomId);
                this.userManager.setUserInGame(player2Id, true, roomId);
                
                console.log(`✅ Match created! Room: ${roomId}`);
                console.log(`   Player 1: ${player1.username} (${player1Id})`);
                console.log(`   Player 2: ${player2.username} (${player2Id})`);
                console.log(`   Time Control: ${timeControl}s`);
                
                // Notify both players
                const player1Socket = this.io.sockets.sockets.get(player1Id);
                const player2Socket = this.io.sockets.sockets.get(player2Id);
                
                if (player1Socket) {
                    player1Socket.join(roomId);
                    player1Socket.emit('matchmaking:match_found', {
                        roomId: roomId,
                        opponent: { id: player2Id, username: player2.username }
                    });
                    console.log(`   ✉️ Sent match_found to ${player1.username}`);
                }
                
                if (player2Socket) {
                    player2Socket.join(roomId);
                    player2Socket.emit('matchmaking:match_found', {
                        roomId: roomId,
                        opponent: { id: player1Id, username: player1.username }
                    });
                    console.log(`   ✉️ Sent match_found to ${player2.username}`);
                }
                
                // Start game after short delay
                setTimeout(() => {
                    console.log(`🎮 Starting game in room ${roomId}...`);
                    this.startGame(roomId);
                }, 200);
                
                return {
                    matched: true,
                    roomId: roomId,
                    player1: player1,
                    player2: player2
                };
            }
        }
        
        console.log(`⏳ No match found yet. Waiting in queue...`);
        return { matched: false };
    }
    
    removeFromMatchmaking(socketId) {
        const index = this.matchmakingQueue.findIndex(entry => 
            entry.socketId === socketId || entry === socketId
        );
        if (index > -1) {
            this.matchmakingQueue.splice(index, 1);
            console.log(`✅ Removed ${socketId} from matchmaking queue`);
            return true; // RETURN SUCCESS
        }
        return false; // NOT IN QUEUE
    }
    
    getMatchmakingQueueSize() {
        return this.matchmakingQueue.length;
    }
    
    // Private rooms
    createPrivateRoom(socketId, userId, timeControl = 300) { 
        const roomId = uuidv4();
        const room = new GameRoom(roomId, 'private', {  
            initial: timeControl,
            increment: 0
        });
        
        room.addPlayer(socketId,userId);
        this.rooms.set(roomId, room);
        this.roomCodes.set(room.code, roomId);
        
        this.userManager.setUserInGame(socketId, true, roomId);
        
        return room;
    }
    
    joinPrivateRoom(socketId, userId, roomCode) {
        const roomId = this.roomCodes.get(roomCode.toUpperCase());
       
        if (!roomId) {
            return {
                success: false,
                message: 'Room not found'
            };
        }
       
        const room = this.rooms.get(roomId);
       
        if (!room) {
            return {
                success: false,
                message: 'Room not found'
            };
        }
       
        // ✅ FIX: Kiểm tra xem user đã ở trong room chưa
        if (room.hasPlayer(socketId)) {
            return {
                success: false,
                message: 'You are already in this room'
            };
        }
       
        if (room.isFull()) {
            return {
                success: false,
                message: 'Room is full'
            };
        }
       
        if (room.status !== 'waiting') {
            return {
                success: false,
                message: 'Game already started'
            };
        }
        
        room.addPlayer(socketId, userId);
        this.userManager.setUserInGame(socketId, true, roomId);
       
        return {
            success: true,
            room: room
        };
    }
       
    async startGame(roomId) {
        const room = this.rooms.get(roomId);
        
        if (!room || !room.isFull()) {
            console.log(`❌ Cannot start game: room=${!!room}, full=${room?.isFull()}`);
            return false;
        }
        
        room.start();
        room.initTimers();

        // Lấy thông tin 2 người chơi để log
        const p1Obj = room.players[0];
        const p2Obj = room.players[1];
        const p1 = this.userManager.getUser(p1Obj.socketId);
        const p2 = this.userManager.getUser(p2Obj.socketId);

        // Lấy Elo hiện tại
        const elo1 = await this.userManager.getUserRating(p1Obj.socketId);
        const elo2 = await this.userManager.getUserRating(p2Obj.socketId);

        // --- LOG YÊU CẦU: HIỆN ELO LÚC VÀO TRẬN ---
        console.log('\n⚔️  ================ MATCH START ================');
        console.log(`⚔️  Room: ${roomId}`);
        console.log(`⚔️  ${p1 ? p1.username : 'Unknown'} (${elo1})  VS  ${p2 ? p2.username : 'Unknown'} (${elo2})`);
        console.log('⚔️  =============================================\n');

        // Determine which socketId has the current turn
        const currentPlayerObj = room.players.find(p => room.playerColors[p.socketId] === room.currentTurn);
        const currentTurnSocketId = currentPlayerObj ? currentPlayerObj.socketId : null;
        // Emit initial timer snapshot
        this.io.to(roomId).emit('game:timer_update', {
            timers: { ...room.timers },
            currentTurnSocketId
        });
        // Start server-side tick for countdown
        room.startTimers(this.io);        
        console.log(`🎮 Starting game in room ${roomId} with timeControl:`, room.timeControl);
        
        // Notify both players
        room.players.forEach(playerObj => {
            const playerId = playerObj.socketId;
            const player = this.userManager.getUser(playerId);
            const opponentObj = room.players.find(p => p.socketId !== playerId);
            const opponent = this.userManager.getUser(opponentObj?.socketId);

            // Gửi kèm Elo của đối thủ xuống client luôn
            const opponentElo = (opponentObj.socketId === p1Obj.socketId) ? elo1 : elo2;
            const myElo = (playerId === p1Obj.socketId) ? elo1 : elo2;

            const socket = this.io.sockets.sockets.get(playerId);
            if (socket) {
                socket.emit('game:start', {
                    roomId: roomId,
                    color: room.getPlayerColor(playerId),
                    opponent: {
                        id: opponent?.id,
                        username: opponent?.username,
                        color: room.getPlayerColor(opponentObj?.socketId),
                        elo: opponentElo // Gửi Elo xuống FE
                    },
                    playerElo: myElo, // Gửi Elo của chính mình
                    timeControl: room.timeControl,
                    fen: room.game.fen()
                });
            }
        });
        
        console.log(`✅ Game started in room ${roomId}`);
        return true;
    }
    
    makeMove(roomId, socketId, move) {
        const room = this.rooms.get(roomId);
        
        if (!room) {
            return {
                success: false,
                message: 'Room not found'
            };
        }
        
        if (room.status !== 'playing') {
            return {
                success: false,
                message: 'Game not started'
            };
        }
        
        if (!room.hasPlayer(socketId)) {
            return {
                success: false,
                message: 'You are not in this game'
            };
        }
        
        return room.makeMove(socketId, move);
    }
    
    async endGame(roomId, winnerId = null, reason = 'unknown') {
        console.log(`🏁 END GAME: Room ${roomId}, Winner: ${winnerId}, Reason: ${reason}`);
        
        const room = this.rooms.get(roomId);

        if (room) {
            room.end(winnerId, reason);
            
            // Update ratings if it's a matchmaking game or private
            if (room.type === 'matchmaking' || room.type === 'private') {
                const [p1Obj, p2Obj] = room.players; // p1Obj = { socketId, userId }
                
                if (p1Obj && p2Obj) {
                    const p1SocketId = p1Obj.socketId;
                    const p2SocketId = p2Obj.socketId;

                    try {
                        // 1. Lấy Elo CŨ
                        const oldR1 = await this.userManager.getUserRating(p1SocketId);
                        const oldR2 = await this.userManager.getUserRating(p2SocketId);
                        
                        // Lấy username để log cho đẹp
                        const name1 = this.userManager.getUser(p1SocketId)?.username || 'P1';
                        const name2 = this.userManager.getUser(p2SocketId)?.username || 'P2';

                        let newR1 = oldR1;
                        let newR2 = oldR2;

                        const isDraw = ['draw', 'stalemate', 'repetition', 'insufficient_material'].includes(reason);

                        // 2. Tính toán Elo MỚI
                        if (isDraw) {
                            newR1 = calculateElo(oldR1, oldR2, 0.5);
                            newR2 = calculateElo(oldR2, oldR1, 0.5);
                        } else if (winnerId) {
                            // Xác định ai thắng
                            const isP1Winner = (winnerId === p1SocketId);
                            
                            // Tính toán
                            if (isP1Winner) {
                                newR1 = calculateElo(oldR1, oldR2, 1); // P1 thắng
                                newR2 = calculateElo(oldR2, oldR1, 0); // P2 thua
                            } else {
                                newR1 = calculateElo(oldR1, oldR2, 0); // P1 thua
                                newR2 = calculateElo(oldR2, oldR1, 1); // P2 thắng
                            }
                        }

                        // 3. Cập nhật vào DB & Memory
                        await this.userManager.updateUserRating(p1SocketId, newR1);
                        await this.userManager.updateUserRating(p2SocketId, newR2);

                        // 4. LOG CHI TIẾT SỰ THAY ĐỔI (YÊU CẦU CỦA BẠN)
                        const diff1 = newR1 - oldR1;
                        const diff2 = newR2 - oldR2;
                        const sign1 = diff1 >= 0 ? '+' : '';
                        const sign2 = diff2 >= 0 ? '+' : '';

                        console.log('\n📊 ================ ELO UPDATE ================');
                        console.log(`👤 ${name1}: ${oldR1} -> ${newR1} (${sign1}${diff1})`);
                        console.log(`👤 ${name2}: ${oldR2} -> ${newR2} (${sign2}${diff2})`);
                        console.log('📊 ============================================\n');

                    } catch (err) {
                        console.error("❌ Elo Error:", err);
                    }
                }
            }
            
            // Update user status (Clear status)
            room.players.forEach(playerObj => {
                this.userManager.setUserInGame(playerObj.socketId, false, null);
            });

            // Lưu lịch sử ván cờ vào DB
            try {
                // Lấy user info
                const playerIds = room.players;
                const white = room.players.find(p => room.playerColors[p.socketId] === 'white');
                const black = room.players.find(p => room.playerColors[p.socketId] === 'black');
                const whiteUser = await User.findById(white?.userId) || {};
                const blackUser = await User.findById(black?.userId) || {};

                // Chuyển moves sang dạng moveSchema
                let moves = [];
                let moveNumber = 1;
                for (let i = 0; i < room.moves.length; i += 2) {
                    const whiteMove = room.moves[i] || {};
                    const blackMove = room.moves[i + 1] || {};
                    moves.push({
                        moveNumber,
                        white: whiteMove.san ? {
                            san: whiteMove.san,
                            from: whiteMove.from,
                            to: whiteMove.to,
                            piece: whiteMove.piece,
                            captured: whiteMove.captured,
                            promotion: whiteMove.promotion,
                            flags: whiteMove.flags,
                            timestamp: new Date(whiteMove.timestamp)
                        } : undefined,
                        black: blackMove.san ? {
                            san: blackMove.san,
                            from: blackMove.from,
                            to: blackMove.to,
                            piece: blackMove.piece,
                            captured: blackMove.captured,
                            promotion: blackMove.promotion,
                            flags: blackMove.flags,
                            timestamp: new Date(blackMove.timestamp)
                        } : undefined
                    });
                    moveNumber++;
                }

                // Xác định kết quả
                let result = 'ongoing';
                let winner = null;
                let terminationReason = reason;

                if (room.status === 'finished') {
                    if (reason === 'checkmate' || reason === 'resignation' || reason === 'timeout') {
                        winner = room.playerColors[winnerId];
                        result = winner === 'white' ? 'white-win' : 'black-win';
                    } else if (reason === 'draw' || reason === 'stalemate' || reason === 'insufficient_material' || reason === 'repetition') {
                        winner = null;
                        result = 'draw';
                        
                        // Map internal reasons to Schema enum
                        if (reason === 'draw') terminationReason = 'draw-agreement';
                        if (reason === 'repetition') terminationReason = 'threefold-repetition';
                        if (reason === 'insufficient_material') terminationReason = 'insufficient-material';
                    }
                }

                // Tạo bản ghi lịch sử
                const gameHistory = new GameHistory({
                    gameType: 'pvp',
                    whitePlayer: {
                        userId: white ? white.userId : undefined,
                        username: white ? (this.userManager.getUser(white.socketId)?.username || 'White') : 'White',
                        rating: whiteUser.rating,
                        isBot: false
                    },
                    blackPlayer: {
                        userId: black ? black.userId : undefined,
                        username: black ? (this.userManager.getUser(black.socketId)?.username || 'Black') : 'Black',
                        rating: blackUser.rating,
                        isBot: false
                    },
                    result,
                    winner,
                    terminationReason: terminationReason,
                    moves,
                    fen: {
                        initial: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                        final: room.game.fen()
                    },
                    timeControl: room.timeControl,
                    startedAt: new Date(room.startedAt || room.createdAt),
                    endedAt: new Date(room.finishedAt || Date.now()),
                    roomId,
                    rated: true
                });

                await gameHistory.save();
                console.log('✅ Game history saved:', gameHistory._id);

                // Cập nhật gameIds, gamesPlayed và thống kê thắng/thua/hòa cho 2 người chơi
                if (white && white.userId) {
                    const whiteStats = { gamesPlayed: 1 };
                    if (result === 'white-win') {
                        whiteStats.gamesWon = 1;
                    } else if (result === 'black-win') {
                        whiteStats.gamesLost = 1;
                    } else if (result === 'draw') {
                        whiteStats.gamesDraw = 1;
                    }
                    await User.updateOne(
                        { _id: white.userId },
                        { $push: { gameIds: gameHistory._id }, $inc: whiteStats }
                    );
                }
                if (black && black.userId) {
                    const blackStats = { gamesPlayed: 1 };
                    if (result === 'black-win') {
                        blackStats.gamesWon = 1;
                    } else if (result === 'white-win') {
                        blackStats.gamesLost = 1;
                    } else if (result === 'draw') {
                        blackStats.gamesDraw = 1;
                    }
                    await User.updateOne(
                        { _id: black.userId },
                        { $push: { gameIds: gameHistory._id }, $inc: blackStats }
                    );
                }
            } catch (err) {
                console.error('❌ Failed to save game history or update users:', err);
            }
        }
    }

    // --- CÁC HÀM XỬ LÝ CẦU HÒA MỚI ---
    offerDraw(roomId, socketId) {
        const room = this.rooms.get(roomId);
        if (!room || room.status !== 'playing') return;

        const opponentId = room.getOpponent(socketId);
        if (opponentId) {
            // Gửi thông báo cho đối thủ
            this.io.to(opponentId).emit('game:draw_offered', {
                offeredBy: socketId
            });
        }
    }

    acceptDraw(roomId, socketId) {
        const room = this.rooms.get(roomId);
        if (!room || room.status !== 'playing') return;

        // Nếu chấp nhận hòa, kết thúc game với lý do 'draw'
        this.endGame(roomId, null, 'draw');
        
        // Thông báo cho cả phòng
        this.io.to(roomId).emit('game:draw_accepted');
    }

    declineDraw(roomId, socketId) {
        const room = this.rooms.get(roomId);
        if (!room || room.status !== 'playing') return;

        const opponentId = room.getOpponent(socketId);
        if (opponentId) {
            // Thông báo cho người gửi yêu cầu là đã bị từ chối
            this.io.to(opponentId).emit('game:draw_declined');
        }
    }
    
    getRoom(roomId) {
        return this.rooms.get(roomId);
    }
    
    removeRoom(roomId) {
        const room = this.rooms.get(roomId);
        
        if (room) {
            this.roomCodes.delete(room.code);
            
            // Update user status
            room.players.forEach(playerObj => {
                this.userManager.setUserInGame(playerObj.socketId, false, null);
            });
            
            this.rooms.delete(roomId);
        }
    }
    
    getUserRooms(socketId) {
        const rooms = [];
        
        for (const [roomId, room] of this.rooms.entries()) {
            if (room.hasPlayer(socketId)) {
                rooms.push(roomId);
            }
        }
        
        return rooms;
    }
    
    getActiveGamesCount() {
        let count = 0;
        for (const room of this.rooms.values()) {
            if (room.status === 'playing') {
                count++;
            }
        }
        return count;
    }
}

module.exports = GameManager;