const mongoose = require('mongoose');

const userPuzzleSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    puzzleRating: {
        type: Number,
        default: 1200
    },
    puzzlesSolved: {
        type: Number,
        default: 0
    },
    puzzlesAttempted: {
        type: Number,
        default: 0
    },
    streak: {
        current: { type: Number, default: 0 },
        longest: { type: Number, default: 0 },
        lastDate: Date
    },
    solvedPuzzles: [{
        puzzleId: String,
        attempts: Number,
        solved: Boolean,
        timeTaken: Number, // seconds
        hintsUsed: { type: Number, default: 0 },
        solvedAt: Date
    }],
    statistics: {
        byDifficulty: {
            beginner: { solved: { type: Number, default: 0 }, attempted: { type: Number, default: 0 } },
            intermediate: { solved: { type: Number, default: 0 }, attempted: { type: Number, default: 0 } },
            advanced: { solved: { type: Number, default: 0 }, attempted: { type: Number, default: 0 } },
            expert: { solved: { type: Number, default: 0 }, attempted: { type: Number, default: 0 } }
        },
        byTheme: {
            type: Map,
            of: { solved: Number, attempted: Number },
            default: {}
        }
    },
    lastSolved: Date,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

userPuzzleSchema.index({ userId: 1 });
userPuzzleSchema.index({ puzzleRating: -1 });

module.exports = mongoose.model('UserPuzzle', userPuzzleSchema);