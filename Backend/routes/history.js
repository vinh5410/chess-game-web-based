const express = require('express');
const router = express.Router();
const historyController = require('../controllers/historyController');

router.get('/user/:userId', historyController.getUserHistory);
router.get('/game/:gameId', historyController.getGameDetail);

module.exports = router;