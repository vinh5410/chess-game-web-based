const { Chess } = require('chess.js');

exports.getBestMove = (req, res) => {
    try {
        const { fen, depth = 5 } = req.body;
        const game = new Chess(fen);
        const moves = game.moves();
        
        if (moves.length === 0) return res.json({ error: 'No legal moves' });
        
        const bestMove = moves[Math.floor(Math.random() * moves.length)];
        
        setTimeout(() => {
            res.json({ bestMove, evaluation: 0.5, depth });
        }, 500);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};