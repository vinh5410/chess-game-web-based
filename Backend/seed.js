const mongoose = require('mongoose');
const User = require('./models/User'); // Đảm bảo đường dẫn đúng tới User.js

// URL MongoDB (Dùng giống hệt trong server.js)
const MONGO_URI = 'mongodb://127.0.0.1:27017/chess-game';

const seedData = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // 1. Xóa sạch dữ liệu cũ (để tránh trùng lặp khi chạy nhiều lần)
        await User.deleteMany({});
        console.log('🧹 Cleaned old data');

        // 2. Tạo 2 user mẫu
        const users = [
            { 
                username: "PlayerOne", 
                password: "123", // Password chưa hash (vì mình test logic ELO thôi)
                rating: 1200,
                gamesPlayed: 0, gamesWon: 0, gamesLost: 0 
            },
            { 
                username: "PlayerTwo", 
                password: "123", 
                rating: 1200,
                gamesPlayed: 0, gamesWon: 0, gamesLost: 0 
            }
        ];

        // 3. Lưu vào DB
        await User.insertMany(users);
        console.log('🎉 Added 2 dummy users: PlayerOne & PlayerTwo');

        process.exit();
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

seedData();