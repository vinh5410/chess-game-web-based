// Backend/config/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const options = {
            serverSelectionTimeoutMS: 10000, // 10 seconds timeout
            socketTimeoutMS: 45000, // 45 seconds socket timeout
        };

        // Logic lấy tên DB để log ra console (giữ nguyên logic cũ của bạn)
        console.log('🔌 Connecting to MongoDB Atlas...');
        console.log('📄 Using database:', process.env.MONGODB_URI ? 
            process.env.MONGODB_URI.split('@')[1]?.split('/')[1]?.split('?')[0] : 'NOT FOUND');
        
        const conn = await mongoose.connect(process.env.MONGODB_URI, options);
        
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        console.log(`📁 Database: ${conn.connection.name}`);
        
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        console.log('\n⚠️  Possible issues:');
        console.log('   1. Check MONGODB_URI in .env file');
        console.log('   2. Ensure IP is whitelisted in MongoDB Atlas (0.0.0.0/0)');
        console.log('   3. Verify username/password are correct');
        console.log('   4. Check internet connection');
        console.log('\n⚠️  Server will continue WITHOUT database');
        console.log('⚠️  Auth features (login/register) will NOT work\n');
    }
};

// Các sự kiện lắng nghe trạng thái kết nối
mongoose.connection.on('connected', () => {
    console.log('✅ Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.error('❌ Mongoose connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
    console.log('⚠️  Mongoose disconnected from MongoDB');
});

module.exports = connectDB;