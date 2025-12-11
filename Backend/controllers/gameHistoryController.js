// Backend/controllers/gameHistoryController.js
const GameHistory = require('../models/GameHistory');
const User = require('../models/User');

// @desc    Save game history
// @route   POST /api/game-history
// @access  Private
exports.saveGame = async (req, res) => {
    try {
        const {
            gameType,
            whitePlayer,
            blackPlayer,
            result,
            winner,
            terminationReason,
            moves,
            fen,
            timeControl,
            timeUsed,
            startedAt,
            endedAt,
            roomId
        } = req.body;
        
        const gameHistory = await GameHistory.create({
            gameType,
            whitePlayer,
            blackPlayer,
            result,
            winner,
            terminationReason,
            moves,
            fen,
            timeControl,
            timeUsed,
            startedAt,
            endedAt,
            roomId,
            rated: false
        });
        
        // Update user statistics
        if (whitePlayer.userId && !whitePlayer.isBot) {
            await updateUserStats(whitePlayer.userId, result === 'white-win', result === 'draw');
        }
        
        if (blackPlayer.userId && !blackPlayer.isBot) {
            await updateUserStats(blackPlayer.userId, result === 'black-win', result === 'draw');
        }
        
        res.status(201).json({
            success: true,
            data: gameHistory
        });
        
    } catch (error) {
        console.error('Error saving game:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save game history',
            error: error.message
        });
    }
};

// @desc    Get user's game history
// @route   GET /api/game-history/user/:userId
// @access  Private
exports.getUserGameHistory = async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 10, gameType } = req.query;
        
        const query = {
            $or: [
                { 'whitePlayer.userId': userId },
                { 'blackPlayer.userId': userId }
            ]
        };
        
        if (gameType) {
            query.gameType = gameType;
        }
        
        const games = await GameHistory.find(query)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .lean();
        
        const count = await GameHistory.countDocuments(query);
        
        res.json({
            success: true,
            data: games,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            total: count
        });
        
    } catch (error) {
        console.error('Error fetching game history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch game history',
            error: error.message
        });
    }
};

// @desc    Get single game by ID
// @route   GET /api/game-history/:gameId
// @access  Public
exports.getGameById = async (req, res) => {
    try {
        const game = await GameHistory.findById(req.params.gameId)
            .populate('whitePlayer.userId', 'username avatar rating')
            .populate('blackPlayer.userId', 'username avatar rating');
        
        if (!game) {
            return res.status(404).json({
                success: false,
                message: 'Game not found'
            });
        }
        
        res.json({
            success: true,
            data: game
        });
        
    } catch (error) {
        console.error('Error fetching game:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch game',
            error: error.message
        });
    }
};

// @desc    Get recent games (public leaderboard)
// @route   GET /api/game-history/recent
// @access  Public
exports.getRecentGames = async (req, res) => {
    try {
        const { limit = 20, gameType } = req.query;
        
        const query = { result: { $ne: 'ongoing' } };
        
        if (gameType) {
            query.gameType = gameType;
        }
        
        const games = await GameHistory.find(query)
            .sort({ endedAt: -1 })
            .limit(parseInt(limit))
            .select('-moves') // Exclude moves for performance
            .lean();
        
        res.json({
            success: true,
            data: games
        });
        
    } catch (error) {
        console.error('Error fetching recent games:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch recent games',
            error: error.message
        });
    }
};

// @desc    Get game statistics for user
// @route   GET /api/game-history/stats/:userId
// @access  Public
exports.getUserStats = async (req, res) => {
    try {
        const { userId } = req.params;
        
        const stats = await GameHistory.aggregate([
            {
                $match: {
                    $or: [
                        { 'whitePlayer.userId': mongoose.Types.ObjectId(userId) },
                        { 'blackPlayer.userId': mongoose.Types.ObjectId(userId) }
                    ],
                    result: { $ne: 'ongoing' }
                }
            },
            {
                $group: {
                    _id: null,
                    totalGames: { $sum: 1 },
                    wins: {
                        $sum: {
                            $cond: [
                                {
                                    $or: [
                                        {
                                            $and: [
                                                { $eq: ['$whitePlayer.userId', mongoose.Types.ObjectId(userId)] },
                                                { $eq: ['$result', 'white-win'] }
                                            ]
                                        },
                                        {
                                            $and: [
                                                { $eq: ['$blackPlayer.userId', mongoose.Types.ObjectId(userId)] },
                                                { $eq: ['$result', 'black-win'] }
                                            ]
                                        }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    },
                    draws: {
                        $sum: {
                            $cond: [{ $eq: ['$result', 'draw'] }, 1, 0]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalGames: 1,
                    wins: 1,
                    draws: 1,
                    losses: { $subtract: ['$totalGames', { $add: ['$wins', '$draws'] }] },
                    winRate: {
                        $multiply: [
                            { $divide: ['$wins', '$totalGames'] },
                            100
                        ]
                    }
                }
            }
        ]);
        
        res.json({
            success: true,
            data: stats[0] || {
                totalGames: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                winRate: 0
            }
        });
        
    } catch (error) {
        console.error('Error fetching user stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user stats',
            error: error.message
        });
    }
};

// Helper function to update user statistics
async function updateUserStats(userId, isWin, isDraw) {
    try {
        const update = {
            $inc: { gamesPlayed: 1 }
        };
        
        if (isWin) {
            update.$inc.gamesWon = 1;
        } else if (isDraw) {
            update.$inc.gamesDraw = 1;
        } else {
            update.$inc.gamesLost = 1;
        }
        
        await User.findByIdAndUpdate(userId, update);
    } catch (error) {
        console.error('Error updating user stats:', error);
    }
}

module.exports = exports;