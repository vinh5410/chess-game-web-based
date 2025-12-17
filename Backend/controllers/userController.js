const User = require('../models/User');

// @desc    Get user profile
// @route   GET /api/users/profile/:userId
// @access  Public
exports.getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.params.userId)
            .select('-password');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        res.status(200).json({
            success: true,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                avatar: user.avatar,
                rating: user.rating,
                gamesPlayed: user.gamesPlayed,
                gamesWon: user.gamesWon,
                gamesLost: user.gamesLost,
                gamesDraw: user.gamesDraw,
                winRate: user.winRate,
                isOnline: user.isOnline,
                lastSeen: user.lastSeen,
                createdAt: user.createdAt
            }
        });
        
    } catch (error) {
        console.error('❌ Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
exports.updateProfile = async (req, res) => {
    try {
        const { username, avatar } = req.body;
        
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Check if username is taken (if changed)
        if (username && username !== user.username) {
            const existingUser = await User.findOne({ username });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Username already taken'
                });
            }
            user.username = username;
        }
        
        if (avatar) {
            user.avatar = avatar;
        }
        
        await user.save();
        
        console.log(`✅ Profile updated: ${user.username}`);
        
        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                avatar: user.avatar,
                rating: user.rating
            }
        });
        
    } catch (error) {
        console.error('❌ Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Get user stats
// @route   GET /api/users/stats/:userId
// @access  Public
exports.getUserStats = async (req, res) => {
    try {
        const user = await User.findById(req.params.userId)
            .select('username rating gamesPlayed gamesWon gamesLost gamesDraw');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        res.status(200).json({
            success: true,
            stats: {
                username: user.username,
                rating: user.rating,
                gamesPlayed: user.gamesPlayed,
                gamesWon: user.gamesWon,
                gamesLost: user.gamesLost,
                gamesDraw: user.gamesDraw,
                winRate: user.winRate
            }
        });
        
    } catch (error) {
        console.error('❌ Get stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Get leaderboard
// @route   GET /api/users/leaderboard
// @access  Public
exports.getLeaderboard = async (req, res) => {
    try {
        const users = await User.find()
            .sort({ rating: -1 })
            .limit(50)
            .select('_id username rating avatar gamesPlayed gamesWon gamesLost gamesDraw');

        res.status(200).json({
            success: true,
            leaderboard: users
        });
    } catch (error) {
        console.error('❌ Get leaderboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};