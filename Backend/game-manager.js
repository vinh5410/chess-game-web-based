const { Chess } = require('chess.js');

class GameManager {
    constructor() {
        this.rooms = new Map(); // Map: roomId -> { game: Chess, players: [id1, id2], colors: {} }
    }

    createRoom(roomId) {
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, {
                game: new Chess(),
                players: [],
                colors: {} // socketId -> 'w' or 'b'
            });
        }
    }

    joinRoom(roomId, socketId) {
        this.createRoom(roomId);
        const room = this.rooms.get(roomId);
        if (room.players.length < 2 && !room.players.includes(socketId)) {
            room.players.push(socketId);
            // Người đầu tiên là Trắng, người thứ 2 là Đen
            room.colors[socketId] = room.players.length === 1 ? 'w' : 'b';
            return true;
        }
        return false;
    }

    makeMove(roomId, move) {
        const room = this.rooms.get(roomId);
        if (!room) return null;
        try {
            const result = room.game.move(move); // Move logic chess.js
            return {
                fen: room.game.fen(),
                gameOver: room.game.isGameOver(),
                winner: room.game.isCheckmate() ? (room.game.turn() === 'w' ? 'black' : 'white') : null,
                reason: room.game.isCheckmate() ? 'checkmate' : (room.game.isDraw() ? 'draw' : null)
            };
        } catch (e) { return null; }
    }

    getRoom(roomId) { return this.rooms.get(roomId); }
    
    getPlayerColor(roomId, socketId) {
        const room = this.rooms.get(roomId);
        return room ? room.colors[socketId] : null;
    }
}

module.exports = GameManager;