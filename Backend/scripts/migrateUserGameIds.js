const mongoose = require('mongoose');
const User = require('../models/User');
const GameHistory = require('../models/GameHistory');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://hoangcongvinh2022_db_user:hvpJkBZDsgJPeLv6@cluster0.bsci7oq.mongodb.net/chess-game?retryWrites=true&w=majority';

async function migrate() {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const games = await GameHistory.find({});
    let count = 0;

    for (const game of games) {
        const gameId = game._id;
        const whiteId = game.whitePlayer?.userId;
        const blackId = game.blackPlayer?.userId;

        // Push gameId vào user trắng
        if (whiteId) {
            await User.updateOne(
                { _id: whiteId },
                { $addToSet: { gameIds: gameId } } // $addToSet để tránh trùng lặp
            );
        }
        // Push gameId vào user đen
        if (blackId) {
            await User.updateOne(
                { _id: blackId },
                { $addToSet: { gameIds: gameId } }
            );
        }
        count++;
    }

    console.log(`Migrated ${count} games to user.gameIds`);
    await mongoose.disconnect();
}

migrate().catch(err => {
    console.error('Migration error:', err);
    process.exit(1);
});