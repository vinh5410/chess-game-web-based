const mongoose = require('mongoose');

const puzzleSchema = new mongoose.Schema({
    puzzleId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    fen: {
        type: String,
        required: true
    },
    moves: {
        type: [String], // ['e7e6', 'h6h7', 'h8g8']
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 500,
        max: 3500,
        index: true
    },
    ratingDeviation: {
        type: Number,
        default: 0
    },
    themes: {
        type: [String], // ['mate', 'fork', 'pin']
        default: [],
        index: true
    },
    difficulty: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced', 'expert'],
        required: true,
        index: true
    },
    popularity: {
        type: Number,
        default: 0
    },
    nbPlays: {
        type: Number,
        default: 0
    },
    gameUrl: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Compound index for efficient queries
puzzleSchema.index({ difficulty: 1, rating: 1 });
puzzleSchema.index({ themes: 1, rating: 1 });

module.exports = mongoose.model('Puzzle', puzzleSchema);