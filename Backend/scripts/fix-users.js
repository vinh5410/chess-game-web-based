const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const User = require('../models/User');

const fixOldUsers = async () => {
    try {
        console.log('⏳ Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB Connected');

        console.log('⏳ Updating old users...');

        // Tìm tất cả user mà isVerified là false HOẶC không có trường isVerified
        const result = await User.updateMany(
            { 
                $or: [
                    { isVerified: false },
                    { isVerified: { $exists: false } }
                ]
            },
            { 
                $set: { 
                    isVerified: true,
                    verificationToken: undefined // Xóa token cũ nếu có
                } 
            }
        );

        console.log(`✅ Success! Updated ${result.modifiedCount} users.`);
        console.log('🎉 All old accounts can now login.');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        mongoose.connection.close();
        process.exit();
    }
};

fixOldUsers();