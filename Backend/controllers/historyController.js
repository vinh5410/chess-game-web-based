const User = require('../models/User');
const GameHistory = require('../models/GameHistory');
const mongoose = require('mongoose');

exports.getUserHistory = async (req, res) => {
    try {
        const userId = req.params.userId;
        console.log('[HISTORY] userId param:', userId);

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            console.log('[HISTORY] userId is not valid ObjectId');
            return res.json({ success: true, games: [] });
        }

        const user = await User.findById(userId).populate({
            path: 'gameIds',
            model: 'GameHistory',
            options: { sort: { createdAt: -1 } },
            select: 'whitePlayer blackPlayer result winner startedAt endedAt roomId'
        });

        console.log('[HISTORY] user found:', !!user);
        if (user) {
            console.log('[HISTORY] user.gameIds:', user.gameIds);
            if (user.gameIds && user.gameIds.length > 0) {
                user.gameIds.forEach((g, i) => {
                    console.log(`[HISTORY] gameIds[${i}]:`, g && g._id ? g._id.toString() : g);
                });
            }
        }

        if (!user) {
            console.log('[HISTORY] user not found');
            return res.json({ success: true, games: [] });
        }
        res.json({ success: true, games: user.gameIds });
    } catch (err) {
        console.error('[HISTORY] Server error:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

// Lấy chi tiết 1 ván cờ (bao gồm moves, pgn, ...)
exports.getGameDetail = async (req, res) => {
    try {
        const gameId = req.params.gameId;
        console.log('[HISTORY] getGameDetail gameId:', gameId);
        const game = await GameHistory.findById(gameId);
        console.log('[HISTORY] getGameDetail found:', !!game);
        if (!game) return res.status(404).json({ success: false, error: 'Not found' });
        res.json({ success: true, game });
    } catch (err) {
        console.error('[HISTORY] getGameDetail Server error:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};