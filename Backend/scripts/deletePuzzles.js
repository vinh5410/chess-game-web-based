// Backend/scripts/deletePuzzles.js
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const Puzzle = require('../models/Puzzle');

// Kết nối MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err);
        process.exit(1);
    });

async function clearDatabase() {
    try {
        console.log('⏳ Checking database...');
        
        // Đếm số lượng hiện có
        const count = await Puzzle.countDocuments();
        console.log(`📊 Found ${count.toLocaleString()} puzzles in database.`);

        if (count === 0) {
            console.log('✅ Database is already empty.');
            process.exit(0);
        }

        console.log('🚀 Deleting all puzzles... This may take a moment.');

        // LỆNH XÓA TOÀN BỘ
        // Cách 1: deleteMany (Giữ lại Indexes, chỉ xóa dữ liệu) - Khuyên dùng nếu bạn định import lại
        const result = await Puzzle.deleteMany({});
        
        // Cách 2: collection.drop() (Xóa cả Collection và Indexes - Sạch sẽ nhất để giải phóng dung lượng ngay lập tức)
        // await mongoose.connection.db.dropCollection('puzzles'); 

        console.log('✅ Delete complete!');
        console.log(`🗑️  Deleted count: ${result.deletedCount.toLocaleString()}`);

    } catch (error) {
        console.error('❌ Error deleting puzzles:', error);
    } finally {
        mongoose.connection.close();
        console.log('👋 Database connection closed.');
        process.exit(0);
    }
}

clearDatabase();