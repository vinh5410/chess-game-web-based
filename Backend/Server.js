const express = require('express');
const cors = require('cors');
const path = require('path');
const { Chess } = require('chess.js');
const http = require('http');           // [MỚI] Thêm module http
const socketIo = require('socket.io');  // [MỚI] Thêm module socket.io

const app = express();
const server = http.createServer(app);  // [MỚI] Tạo server bọc express
const io = socketIo(server, {           // [MỚI] Cấu hình Socket.io
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, '../Frontend'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.css')) res.setHeader('Content-Type', 'text/css');
        if (path.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript');
    }
}));

// --- [PHẦN MỚI] API AUTH CHO LOBBY (Để qua được màn hình login) ---
app.get('/auth', (req, res) => {
    // Fake login thành công trả về user ảo
    res.json({
        status: 200,
        message: 'Authenticated',
        user: { 
            username: 'Player_' + Math.floor(Math.random() * 1000) 
        }
    });
});

// --- API CŨ (HEALTH CHECK) ---
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Chess API is running' });
});

// --- API CŨ (STOCKFISH BOT) ---
app.post('/api/stockfish/move', async (req, res) => {
    try {
        const { fen, depth = 5 } = req.body;
        console.log(`🤖 Bot thinking (depth ${depth})...`);
        const game = new Chess(fen);
        const moves = game.moves();
        
        if (moves.length === 0) return res.json({ error: 'No legal moves' });
        
        let bestMove = moves[Math.floor(Math.random() * moves.length)];
        // Logic Bot đơn giản (như cũ)
        if (depth > 2) {
             const captures = moves.filter(move => move.includes('x'));
             if (captures.length > 0) bestMove = captures[Math.floor(Math.random() * captures.length)];
        }

        setTimeout(() => {
            res.json({ 
                bestMove: bestMove,
                evaluation: (Math.random() - 0.5) * 3,
                depth: depth
            });
        }, 500);
        
    } catch (error) {
        console.error('❌ Stockfish API error:', error);
        res.status(400).json({ error: error.message });
    }
});

// --- [PHẦN MỚI] XỬ LÝ SOCKET.IO (ROOM) ---
io.on('connection', (socket) => {
    console.log('🔌 User connected:', socket.id);

    // Khi client gọi socket.emit('join_room', roomId)
    socket.on('join_room', (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room: ${roomId}`);
        
        // Gửi thông báo cho client biết đã vào phòng
        socket.emit('joined_room_success', roomId);
    });

    socket.on('disconnect', () => {
        console.log('❌ User disconnected:', socket.id);
    });
});

// --- ROUTES TRẢ VỀ HTML ---
app.get('/play-vs-bot', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend', 'play-vs-bot.html'));
});

// Route cho Lobby
app.get('/lobby', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend', 'lobby.html'));
});

// Route catch-all (Phải để cuối cùng)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend', 'index.html'));
});

// [QUAN TRỌNG] Dùng server.listen thay vì app.listen
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🎮 Lobby: http://localhost:${PORT}/lobby.html`);
});