const express = require('express');
const router = express.Router();
const {
    getRandomPuzzle,
    verifyMove,
    submitPuzzle,
    getUserStats,
    getLeaderboard,
    getHint,
    getSolution
} = require('../controllers/puzzleController');
const { protect } = require('../middleware/auth');

// Public routes
router.get('/random', getRandomPuzzle);
router.get('/leaderboard', getLeaderboard);

// Protected routes
router.post('/verify', protect, verifyMove);
router.post('/submit', protect, submitPuzzle);
router.get('/stats', protect, getUserStats);
router.get('/:puzzleId/hint', protect, getHint);
router.get('/:puzzleId/solution', protect, getSolution);
module.exports = router;