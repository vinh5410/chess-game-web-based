const express = require('express');
const router = express.Router();
const {
    getUserProfile,
    updateProfile,
    getUserStats
} = require('../controllers/userController');
const { getLeaderboard } = require('../controllers/leaderboardController');
const { protect } = require('../middleware/auth');

// Public routes
router.get('/profile/:userId', getUserProfile);
router.get('/stats/:userId', getUserStats);
router.get('/leaderboard', getLeaderboard);

// Protected routes
router.put('/profile', protect, updateProfile);

module.exports = router;