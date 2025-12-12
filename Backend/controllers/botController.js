// Backend/controllers/botController.js
const { Chess } = require('chess.js');

exports.getBestMove = async (req, res) => {
    try {
        const { fen, depth = 5 } = req.body;
        
        console.log(`🤖 Bot thinking (depth ${depth})...`);
        
        const game = new Chess(fen);
        const moves = game.moves();
        
        if (moves.length === 0) {
            return res.json({ error: 'No legal moves' });
        }
        
        let bestMove;
        
        // --- LOGIC XỊN LẤY TỪ SERVER.JS ---
        if (depth <= 2) {
            bestMove = moves[Math.floor(Math.random() * moves.length)];
        } else if (depth <= 5) {
            const captures = moves.filter(move => move.includes('x'));
            bestMove = captures.length > 0 ? 
                captures[Math.floor(Math.random() * captures.length)] :
                moves[Math.floor(Math.random() * moves.length)];
        } else {
            const captures = moves.filter(move => move.includes('x'));
            const checks = moves.filter(move => move.includes('+'));
            const castling = moves.filter(move => move.includes('O'));
            
            if (captures.length > 0) {
                bestMove = captures[Math.floor(Math.random() * captures.length)];
            } else if (checks.length > 0) {
                bestMove = checks[Math.floor(Math.random() * checks.length)];
            } else if (castling.length > 0 && Math.random() < 0.3) {
                bestMove = castling[0];
            } else {
                bestMove = moves[Math.floor(Math.random() * moves.length)];
            }
        }
        // ----------------------------------
        
        const thinkingTime = Math.min(depth * 200, 2000);
        
        setTimeout(() => {
            const evaluation = (Math.random() - 0.5) * 3;
            console.log(`🎯 Bot chose: ${bestMove}`);
            
            res.json({ 
                bestMove: bestMove,
                evaluation: evaluation,
                depth: depth
            });
        }, thinkingTime);
        
    } catch (error) {
        console.error('❌ Stockfish API error:', error);
        res.status(400).json({ error: error.message });
    }
};