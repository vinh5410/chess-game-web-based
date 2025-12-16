// Backend/models/GameHistory.js
const mongoose = require('mongoose');

const moveSchema = new mongoose.Schema({
    moveNumber: {
        type: Number,
        required: true
    },
    white: {
        san: String,  // Standard Algebraic Notation (e4, Nf3, etc)
        from: String,
        to: String,
        piece: String,
        captured: String,
        promotion: String,
        flags: String,
        timestamp: Date
    },
    black: {
        san: String,
        from: String,
        to: String,
        piece: String,
        captured: String,
        promotion: String,
        flags: String,
        timestamp: Date
    }
}, { _id: false });

const gameHistorySchema = new mongoose.Schema({
    // Game Type
    gameType: {
        type: String,
        enum: ['pvp', 'vs-bot'],
        required: true
    },
    
    // Players
    whitePlayer: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        username: {
            type: String,
            required: true
        },
        rating: Number,
        ratingChange: Number,
        isBot: {
            type: Boolean,
            default: false
        }
    },
    
    blackPlayer: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        username: {
            type: String,
            required: true
        },
        rating: Number,
        ratingChange: Number,
        isBot: {
            type: Boolean,
            default: false
        }
    },
    
    // Game Result
    result: {
        type: String,
        enum: ['white-win', 'black-win', 'draw', 'ongoing'],
        default: 'ongoing'
    },
    
    winner: {
        type: String,
        enum: ['white', 'black', 'draw', null],
        default: null
    },
    
    terminationReason: {
        type: String,
        enum: ['checkmate', 'resignation', 'timeout', 'draw-agreement', 'stalemate', 'insufficient-material', 'threefold-repetition', 'fifty-move-rule', null],
        default: null
    },
    
    // Game Data
    moves: [moveSchema],
    
    pgn: {
        type: String,
        default: ''
    },
    
    fen: {
        initial: {
            type: String,
            default: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
        },
        final: String
    },
    
    // Time Control
    timeControl: {
        initial: {
            type: Number,
            default: 300  // 5 minutes in seconds
        },
        increment: {
            type: Number,
            default: 0
        }
    },
    
    timeUsed: {
        white: Number,
        black: Number
    },
    
    // Timestamps
    startedAt: {
        type: Date,
        required: true
    },
    
    endedAt: {
        type: Date
    },
    
    duration: {
        type: Number  // in seconds
    },
    
    // Metadata
    roomId: String,
    
    rated: {
        type: Boolean,
        default: false
    }
    
}, {
    timestamps: true
});

// Indexes for efficient queries
gameHistorySchema.index({ 'whitePlayer.userId': 1, createdAt: -1 });
gameHistorySchema.index({ 'blackPlayer.userId': 1, createdAt: -1 });
gameHistorySchema.index({ gameType: 1, createdAt: -1 });
gameHistorySchema.index({ result: 1 });

// Virtual for total moves
gameHistorySchema.virtual('totalMoves').get(function() {
    return this.moves.length;
});

// Method to generate PGN
gameHistorySchema.methods.generatePGN = function() {
    let pgn = '';
    
    // PGN Headers
    pgn += `[Event "${this.gameType === 'pvp' ? 'Casual Game' : 'vs Computer'}"]\n`;
    pgn += `[Site "Chess Game Web"]\n`;
    pgn += `[Date "${this.startedAt.toISOString().split('T')[0]}"]\n`;
    pgn += `[White "${this.whitePlayer.username}"]\n`;
    pgn += `[Black "${this.blackPlayer.username}"]\n`;
    pgn += `[Result "${this.getResultString()}"]\n`;
    
    if (this.whitePlayer.rating) {
        pgn += `[WhiteElo "${this.whitePlayer.rating}"]\n`;
    }
    if (this.blackPlayer.rating) {
        pgn += `[BlackElo "${this.blackPlayer.rating}"]\n`;
    }
    
    pgn += `[TimeControl "${this.timeControl.initial}+${this.timeControl.increment}"]\n`;
    pgn += `[Termination "${this.terminationReason || 'Normal'}"]\n\n`;
    
    // Moves
    let moveText = '';
    this.moves.forEach((move, index) => {
        if (move.white && move.white.san) {
            moveText += `${move.moveNumber}. ${move.white.san} `;
        }
        if (move.black && move.black.san) {
            moveText += `${move.black.san} `;
        }
    });
    
    pgn += moveText.trim() + ' ' + this.getResultString();
    
    return pgn;
};

gameHistorySchema.methods.getResultString = function() {
    if (this.result === 'white-win') return '1-0';
    if (this.result === 'black-win') return '0-1';
    if (this.result === 'draw') return '1/2-1/2';
    return '*';
};

// Update PGN before saving
gameHistorySchema.pre('save', function() {
    if (this.isModified('moves') || this.isModified('result')) {
        this.pgn = this.generatePGN();
    }
    if (this.endedAt && this.startedAt) {
        this.duration = Math.floor((this.endedAt - this.startedAt) / 1000);
    }
});

module.exports = mongoose.model('GameHistory', gameHistorySchema);