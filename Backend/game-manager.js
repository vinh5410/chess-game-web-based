const { Chess } = require('chess.js');
const { v4: uuidv4 } = require('uuid');
const { calculateElo } = require('./services/elo/eloCalculator');

class GameRoom {
    constructor(id, type = 'private', timeControl = null) {
        this.id = id;
        this.type = type; // 'private' or 'matchmaking'
        this.code = this.generateRoomCode();
        this.players = []; // [socketId1, socketId2]
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
        this.timeControl = timeControl;
    }
    
    generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }
    
    addPlayer(socketId) {
        if (this.players.length >= 2) {
            return false;
        }
        
        this.players.push(socketId);
        
        // Assign colors
        if (this.players.length === 1) {
            this.playerColors[socketId] = Math.random() < 0.5 ? 'white' : 'black';
        } else {
            const firstPlayerColor = this.playerColors[this.players[0]];
            this.playerColors[socketId] = firstPlayerColor === 'white' ? 'black' : 'white';
        }
        
        return true;
    }
    
    removePlayer(socketId) {
        const index = this.players.indexOf(socketId);
        if (index > -1) {
            this.players.splice(index, 1);
            delete this.playerColors[socketId];
        }
    }
    
    isFull() {
        return this.players.length === 2;
    }
    
    hasPlayer(socketId) {
        return this.players.includes(socketId);
    }
    
    getPlayerColor(socketId) {
        return this.playerColors[socketId];
    }
    
    getOpponent(socketId) {
        return this.players.find(p => p !== socketId);
    }
    
    isPlayerTurn(socketId) {
        return this.playerColors[socketId] === this.currentTurn;
    }
    
    makeMove(socketId, move) {
        if (!this.isPlayerTurn(socketId)) {
            return {
                success: false,
                message: 'Not your turn'
            };
        }
        
        try {
            const moveResult = this.game.move(move);
            
            if (moveResult) {
                this.moves.push({
                    player: socketId,
                    move: move,
                    san: moveResult.san,
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
                        // Winner is player who just moved
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
    addToMatchmaking(socketId, timeControl = 300) {
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
                
                room.addPlayer(player1Id);
                room.addPlayer(player2Id);
                
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
    createPrivateRoom(socketId, timeControl = 300) { 
        const roomId = uuidv4();
        const room = new GameRoom(roomId, 'private', {  
            initial: timeControl,
            increment: 0
        });
        
        room.addPlayer(socketId);
        this.rooms.set(roomId, room);
        this.roomCodes.set(room.code, roomId);
        
        this.userManager.setUserInGame(socketId, true, roomId);
        
        return room;
    }
    
    joinPrivateRoom(socketId, roomCode) {
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
       
        room.addPlayer(socketId);
        this.userManager.setUserInGame(socketId, true, roomId);
       
        return {
            success: true,
            room: room
        };
    }
       
    
    startGame(roomId) {
        const room = this.rooms.get(roomId);
        
        if (!room || !room.isFull()) {
            console.log(`❌ Cannot start game: room=${!!room}, full=${room?.isFull()}`);
            return false;
        }
        
        room.start();
        
        console.log(`🎮 Starting game in room ${roomId} with timeControl:`, room.timeControl);
        
        // Notify both players
        room.players.forEach(playerId => {
            const player = this.userManager.getUser(playerId);
            const opponent = this.userManager.getUser(room.getOpponent(playerId));
            
            const socket = this.io.sockets.sockets.get(playerId);
            if (socket) {
                socket.emit('game:start', {
                    roomId: roomId,
                    color: room.getPlayerColor(playerId),
                    opponent: {
                        id: opponent.id,
                        username: opponent.username,
                        color: room.getPlayerColor(opponent.id)
                    },
                    timeControl: room.timeControl,  // ✅ THÊM DÒNG NÀY
                    fen: room.game.fen()
                });
                console.log(`   ✉️ Sent game:start to ${player.username} (${room.getPlayerColor(playerId)})`);
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
            const [p1, p2] = room.players;

            // Tính Elo nếu đủ 2 người
            if (p1 && p2) {
                try {
                    // Lấy Elo hiện tại từ DB
                    const r1 = await this.userManager.getUserRating(p1);
                    const r2 = await this.userManager.getUserRating(p2);

                    const isDraw = ['draw', 'stalemate', 'repetition', 'insufficient_material'].includes(reason);

                    if (isDraw) {
                        const newR1 = calculateElo(r1, r2, 0.5);
                        const newR2 = calculateElo(r2, r1, 0.5);
                        await this.userManager.updateUserRating(p1, newR1);
                        await this.userManager.updateUserRating(p2, newR2);
                        console.log(`✅ Draw Elo: ${r1}->${newR1}, ${r2}->${newR2}`);
                    } else if (winnerId) {
                        const isP1Winner = (winnerId === p1);
                        const winnerRating = isP1Winner ? r1 : r2;
                        const loserRating = isP1Winner ? r2 : r1;
                        const loserId = isP1Winner ? p2 : p1;

                        const newWinnerR = calculateElo(winnerRating, loserRating, 1);
                        const newLoserR = calculateElo(loserRating, winnerRating, 0);

                        await this.userManager.updateUserRating(winnerId, newWinnerR);
                        await this.userManager.updateUserRating(loserId, newLoserR);
                        console.log(`✅ Win/Loss Elo: Winner(${newWinnerR}), Loser(${newLoserR})`);
                    }
                } catch (err) {
                    console.error("❌ Elo Error:", err);
                }
            }
            
            // Clear status
            room.players.forEach(pid => this.userManager.setUserInGame(pid, false, null));
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
            room.players.forEach(playerId => {
                this.userManager.setUserInGame(playerId, false, null);
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