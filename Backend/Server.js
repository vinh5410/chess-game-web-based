// Backend/Server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');
const dotenv = require('dotenv');

// Import các phần đã tách
const connectDB = require('./config/db');
const socketHandler = require('./socket');
const UserManager = require('./user-manager');
const GameManager = require('./game-manager');

// Import Routes
const botRoutes = require('./routes/bot');
const authRoutes = require('./routes/auth'); // Các route cũ của bạn
const userRoutes = require('./routes/user');
// const puzzleRoutes = require('./routes/puzzle'); // Uncomment nếu có file này

dotenv.config();
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 3000;

// 1. Kết nối DB
connectDB();

// 2. Init Managers
const userManager = new UserManager();
const gameManager = new GameManager(io, userManager);

// 3. Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../Frontend')));

// 4. Routes
// QUAN TRỌNG: Giữ nguyên đường dẫn '/api/stockfish' để FE không bị lỗi
app.use('/api/stockfish', botRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
// app.use('/api/puzzles', puzzleRoutes);

// Route Auth giả lập (giữ lại để test lobby)
app.get('/auth', (req, res) => {
    res.json({ status: 200, message: 'Authenticated', user: { username: 'Player_Dev' } });
});

// 5. Kích hoạt Socket (Logic nằm trong file socket/index.js)
socketHandler(io, userManager, gameManager);

// 6. Serve Frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend', 'index.html'));
});

server.listen(PORT, () => {
    console.log(`🚀 Server Cleaned & Running on http://localhost:${PORT}`);
});