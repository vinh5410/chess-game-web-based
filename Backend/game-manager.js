const { Chess } = require('chess.js');
const { v4: uuidv4 } = require('uuid');
const GameHistory = require('./models/GameHistory');
const User = require('./models/User');
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
        
        const result = room.makeMove(socketId, move);
        
        if (result.success) {
            // Broadcast move to opponent
            const opponentId = room.getOpponent(socketId);
            const opponentSocket = this.io.sockets.sockets.get(opponentId);
            
            if (opponentSocket) {
                opponentSocket.emit('game:move', {
                    move: result.move,
                    fen: result.fen
                });
            }
            
            // Check if game is over
            if (result.gameOver) {
                this.endGame(roomId, result.reason, result.winner ? socketId : null);
            }
        }
        
        return result;
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
    async saveGameHistory(userManager) {
        try {
            const whitePlayerId = this.players.find(p => this.playerColors[p] === 'white');
            const blackPlayerId = this.players.find(p => this.playerColors[p] === 'black');
            
            const whiteUser = userManager.getUser(whitePlayerId);
            const blackUser = userManager.getUser(blackPlayerId);
            
            if (!whiteUser || !blackUser) {
                console.error('Cannot save game - player info missing');
                return null;
            }
            
            // Convert moves to proper format
            const formattedMoves = [];
            let moveNumber = 1;
            
            for (let i = 0; i < this.moves.length; i++) {
                const move = this.moves[i];
                const isWhite = this.playerColors[move.player] === 'white';
                
                if (isWhite) {
                    formattedMoves.push({
                        moveNumber: moveNumber,
                        white: {
                            san: move.san,
                            timestamp: new Date(move.timestamp)
                        }
                    });
                } else {
                    // Find the last move and add black's move
                    if (formattedMoves.length > 0 && formattedMoves[formattedMoves.length - 1].moveNumber === moveNumber) {
                        formattedMoves[formattedMoves.length - 1].black = {
                            san: move.san,
                            timestamp: new Date(move.timestamp)
                        };
                        moveNumber++;
                    } else {
                        formattedMoves.push({
                            moveNumber: moveNumber,
                            black: {
                                san: move.san,
                                timestamp: new Date(move.timestamp)
                            }
                        });
                        moveNumber++;
                    }
                }
            }
            
            // Determine result
            let result = 'ongoing';
            let winner = null;
            let terminationReason = null;
            
            if (this.status === 'finished') {
                if (this.winner) {
                    const winnerColor = this.playerColors[this.winner];
                    result = winnerColor === 'white' ? 'white-win' : 'black-win';
                    winner = winnerColor;
                } else {
                    result = 'draw';
                }
                
                // Get termination reason from last move result
                if (this.moves.length > 0) {
                    const lastMove = this.moves[this.moves.length - 1];
                    if (this.game.isCheckmate()) {
                        terminationReason = 'checkmate';
                    } else if (this.game.isStalemate()) {
                        terminationReason = 'stalemate';
                    } else if (this.game.isThreefoldRepetition()) {
                        terminationReason = 'threefold-repetition';
                    } else if (this.game.isInsufficientMaterial()) {
                        terminationReason = 'insufficient-material';
                    }
                }
            }
            
            // Fetch user IDs from database
            const whiteUserDoc = await User.findOne({ username: whiteUser.username });
            const blackUserDoc = await User.findOne({ username: blackUser.username });
            
            const gameHistory = await GameHistory.create({
                gameType: 'pvp',
                whitePlayer: {
                    userId: whiteUserDoc?._id,
                    username: whiteUser.username,
                    rating: whiteUserDoc?.rating || 1200,
                    isBot: false
                },
                blackPlayer: {
                    userId: blackUserDoc?._id,
                    username: blackUser.username,
                    rating: blackUserDoc?.rating || 1200,
                    isBot: false
                },
                result,
                winner,
                terminationReason,
                moves: formattedMoves,
                fen: {
                    initial: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                    final: this.game.fen()
                },
                timeControl: {
                    initial: 300,
                    increment: 0
                },
                startedAt: new Date(this.startedAt),
                endedAt: this.finishedAt ? new Date(this.finishedAt) : new Date(),
                roomId: this.id
            });
            
            console.log(`✅ Game history saved: ${gameHistory._id}`);
            return gameHistory;
            
        } catch (error) {
            console.error('Error saving game history:', error);
            return null;
        }
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
// Thêm vào class GameManager
    async handleResignation(roomId, socketId) {
        const room = this.rooms.get(roomId);
        
        if (!room || room.status !== 'playing') {
            return false;
        }
        
        const resigningColor = room.playerColors[socketId];
        const winnerColor = resigningColor === 'white' ? 'black' : 'white';
        const winnerId = room.players.find(p => room.playerColors[p] === winnerColor);
        
        room.winner = winnerId;
        room.status = 'finished';
        room.finishedAt = Date.now();
        
        await this.endGame(roomId, 'resignation', winnerId);
        
        return true;
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
            console.log('❌ Cannot start game - room not ready');
            return false;
        }
        
        room.start();
        
        console.log(`🎮 Starting game in room ${roomId}`);
        console.log(`👥 Players:`, room.players);
        
        // Notify both players
        room.players.forEach(playerId => {
            const player = this.userManager.getUser(playerId);
            const opponent = this.userManager.getUser(room.getOpponent(playerId));
            
            console.log(`📤 Sending game:start to player ${playerId} (${player?.username})`);
            
            const socket = this.io.sockets.sockets.get(playerId);
            if (socket) {
                console.log(`✅ Socket found for ${playerId}, emitting game:start`);
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
                console.log(`✅ Emitted game:start to ${player.username}`);
            } else {
                console.error(`❌ Socket NOT found for player ${playerId}!`);
                console.log(`🔍 Available sockets:`, Array.from(this.io.sockets.sockets.keys()));
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
    
    async endGame(roomId, reason, winner = null) {
        const room = this.rooms.get(roomId);
        
        if (!room) {
            return false;
        }
        
        room.end(winner, reason);
        
        // Save game history
        await room.saveGameHistory(this.userManager);
        
        // Notify players
        room.players.forEach(playerId => {
            const socket = this.io.sockets.sockets.get(playerId);
            if (socket) {
                socket.emit('game:over', {
                    reason: reason,
                    winner: winner ? room.playerColors[winner] : null
                });
            }
        });
        
        // Update user status
        room.players.forEach(playerId => {
            this.userManager.setUserInGame(playerId, false, null);
        });
        
        console.log(`🏁 Game ended in room ${roomId} - Reason: ${reason}`);
        
        // Clean up room after delay
        setTimeout(() => {
            this.rooms.delete(roomId);
            console.log(`🧹 Room ${roomId} cleaned up`);
        }, 60000); // 1 minute
        
        return true;
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