const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: true, 
        unique: true 
    },
    password: { 
        type: String, 
        required: true 
    }, 
    // Quan trọng: Trường lưu điểm ELO (Khớp với logic server.js)
    rating: { 
        type: Number, 
        default: 1200 
    }, 
    // Các trường thống kê trận đấu
    gamesPlayed: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    gamesLost: { type: Number, default: 0 },
    gamesDraw: { type: Number, default: 0 }
});

module.exports = mongoose.model('User', userSchema);