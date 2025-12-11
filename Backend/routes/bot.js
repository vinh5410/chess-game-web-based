const express = require('express');
const router = express.Router();
const botController = require('../controllers/botController');

// Đảm bảo đường dẫn khớp với FE cũ: /api/stockfish/move
router.post('/move', botController.getBestMove);

module.exports = router;