const express = require('express');
const cors = require('cors');
const path = require('path');
const { Chess } = require('chess.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files từ Frontend với proper headers
app.use(express.static(path.join(__dirname, '../Frontend'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

// API Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Chess API is running' });
});

// Stockfish API endpoint
app.post('/api/stockfish/move', async (req, res) => {
    try {
        const { fen, depth = 5 } = req.body;
        
        console.log(`🤖 Bot thinking (depth ${depth})...`);
        
        const game = new Chess(fen);
        const moves = game.moves();
        
        if (moves.length === 0) {
            return res.json({ error: 'No legal moves' });
        }
        
        // AI logic based on difficulty
        let bestMove;
        
        if (depth <= 2) {
            // Easy: Random moves
            bestMove = moves[Math.floor(Math.random() * moves.length)];
        } else if (depth <= 5) {
            // Medium: Prefer captures
            const captures = moves.filter(move => move.includes('x'));
            bestMove = captures.length > 0 ? 
                captures[Math.floor(Math.random() * captures.length)] :
                moves[Math.floor(Math.random() * moves.length)];
        } else {
            // Hard: Smart strategy
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
        
        // Thinking time based on difficulty
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
});

// Handle missing assets gracefully
app.get('/assets/*', (req, res) => {
    console.log(`⚠️ Missing asset: ${req.path}`);
    res.status(404).send('Asset not found');
});

// Specific routes for different pages
app.get('/play-vs-bot', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend', 'play-vs-bot.html'));
});

app.get('/play-vs-bot.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend', 'play-vs-bot.html'));
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Chess server running on http://localhost:${PORT}`);
    console.log(`📁 Serving frontend from: ${path.join(__dirname, '../Frontend')}`);
    console.log(`🏠 Home: http://localhost:${PORT}`);
    console.log(`🎮 Play vs Bot: http://localhost:${PORT}/play-vs-bot.html`);
    console.log(`💊 Health Check: http://localhost:${PORT}/api/health`);
});