const { Chess } = require('chess.js');
const { v4: uuidv4 } = require('uuid');

class GameRoom {
    constructor(id, type = 'private') {
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
    addToMatchmaking(socketId) {
        if (this.matchmakingQueue.includes(socketId)) {
            return { matched: false };
        }
        
        this.matchmakingQueue.push(socketId);
        
        // Try to match
        if (this.matchmakingQueue.length >= 2) {
            const player1Id = this.matchmakingQueue.shift();
            const player2Id = this.matchmakingQueue.shift();
            
            const player1 = this.userManager.getUser(player1Id);
            const player2 = this.userManager.getUser(player2Id);
            
            if (!player1 || !player2) {
                // One player disconnected, put the other back in queue
                if (player1) this.matchmakingQueue.unshift(player1Id);
                if (player2) this.matchmakingQueue.unshift(player2Id);
                return { matched: false };
            }
            
            // Create game room
            const roomId = uuidv4();
            const room = new GameRoom(roomId, 'matchmaking');
            
            room.addPlayer(player1Id);
            room.addPlayer(player2Id);
            
            this.rooms.set(roomId, room);
            
            // Update user status
            this.userManager.setUserInGame(player1Id, true, roomId);
            this.userManager.setUserInGame(player2Id, true, roomId);
            
            // Notify both players
            const player1Socket = this.io.sockets.sockets.get(player1Id);
            const player2Socket = this.io.sockets.sockets.get(player2Id);
            
            if (player1Socket) {
                player1Socket.join(roomId);
                player1Socket.emit('matchmaking:match_found', {
                    roomId: roomId,
                    opponent: { id: player2Id, username: player2.username }
                });
            }
            
            if (player2Socket) {
                player2Socket.join(roomId);
                player2Socket.emit('matchmaking:match_found', {
                    roomId: roomId,
                    opponent: { id: player1Id, username: player1.username }
                });
            }
            
            // Start game
            this.startGame(roomId);
            
            return {
                matched: true,
                roomId: roomId,
                player1: player1,
                player2: player2
            };
        }
        
        return { matched: false };
    }
    
    removeFromMatchmaking(socketId) {
        const index = this.matchmakingQueue.indexOf(socketId);
        if (index > -1) {
            this.matchmakingQueue.splice(index, 1);
        }
    }
    
    getMatchmakingQueueSize() {
        return this.matchmakingQueue.length;
    }
    
    // Private rooms
    createPrivateRoom(socketId) {
        const roomId = uuidv4();
        const room = new GameRoom(roomId, 'private');
        
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
    
    // Game management
    startGame(roomId) {
        const room = this.rooms.get(roomId);
        
        if (!room || !room.isFull()) {
            return false;
        }
        
        room.start();
        
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
                    fen: room.game.fen()
                });
            }
        });
        
        console.log(`🎮 Game started in room ${roomId}`);
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
    
    endGame(roomId, winnerId = null, reason = 'unknown') {
        const room = this.rooms.get(roomId);
        
        if (room) {
            room.end(winnerId, reason);
            
            // Update user status
            room.players.forEach(playerId => {
                this.userManager.setUserInGame(playerId, false, null);
            });
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