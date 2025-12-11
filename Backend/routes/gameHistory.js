// Backend/routes/gameHistory.js
const express = require('express');
const router = express.Router();
const {
    saveGame,
    getUserGameHistory,
    getGameById,
    getRecentGames,
    getUserStats
} = require('../controllers/gameHistoryController');
const { protect } = require('../middleware/auth');

// Public routes
router.get('/recent', getRecentGames);
router.get('/stats/:userId', getUserStats);
router.get('/:gameId', getGameById);

// Protected routes
router.post('/', protect, saveGame);
router.get('/user/:userId', protect, getUserGameHistory);

module.exports = router;