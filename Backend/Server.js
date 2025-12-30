const express = require('express');
const cors = require('cors');
const path = require('path');
const { Chess } = require('chess.js');
const http = require('http');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const botController = require('./controllers/botController');
const historyRoutes = require('./routes/history');
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET', 'SESSION_SECRET'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
    console.error('Missing required environment variables:');
    missingEnvVars.forEach(envVar => console.error(`   - ${envVar}`));
    console.error('\n Please create .env file in Backend folder with:');
    console.error('   MONGODB_URI=your_mongodb_uri');
    console.error('   JWT_SECRET=your_jwt_secret');
    console.error('   SESSION_SECRET=your_session_secret\n');
    process.exit(1);
}

console.log(' Environment variables loaded');

const UserManager = require('./user-manager');
const GameManager = require('./game-manager');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const puzzleRoutes = require('./routes/puzzle');
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: '*',
        credentials: true,
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 3000;

const userManager = new UserManager();
const gameManager = new GameManager(io, userManager);

app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(cookieParser());

connectDB();

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

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Chess API is running',
        database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
        users: userManager.getOnlineCount(),
        games: gameManager.getActiveGamesCount()
    });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/puzzles', puzzleRoutes);
app.use('/api/history', historyRoutes);
app.post('/api/bot/best-move', botController.getBestMove);

require('./socket/index')(io, userManager, gameManager);

app.get(/^\/assets\/.*$/, (req, res) => {
    console.log(`Missing asset: ${req.path}`);
    res.status(404).send('Asset not found');
});
app.get('/history', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend', 'history.html'));
});
app.get('/history.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend', 'history.html'));
});
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend', 'register.html'));
});

app.get('/register.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend', 'register.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend', 'login.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend', 'login.html'));
});

app.get('/play-vs-bot', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend', 'play-vs-bot.html'));
});

app.get('/play-vs-bot.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend', 'play-vs-bot.html'));
});

app.get('/play-multiplayer', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend', 'play-multiplayer.html'));
});

app.get('/play-multiplayer.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend', 'play-multiplayer.html'));
});
app.get('/puzzles', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend', 'puzzles.html'));
});

app.get('/puzzles.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend', 'puzzles.html'));
});
app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend', 'profile.html'));
});

app.get('/profile.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend', 'profile.html'));
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend', 'index.html'));
});

server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║         CHESS GAME SERVER STARTED                         ║
╠══════════════════════════════════════════════════════════╣
║   Server: http://localhost:${PORT}                        ║
║  Frontend: ${path.join(__dirname, '../Frontend')}     
║                                                          ║
║  Routes:                                              ║
║     • Home:           http://localhost:${PORT}/           ║
║     • Register:       http://localhost:${PORT}/register.html
║     • Login:          http://localhost:${PORT}/login.html 
║     • Play vs Bot:    http://localhost:${PORT}/play-vs-bot.html
║     • Multiplayer:    http://localhost:${PORT}/play-multiplayer.html
║     • Health Check:   http://localhost:${PORT}/api/health ║
║                                                          ║
║  WebSocket: Socket.IO enabled for multiplayer             ║
╚══════════════════════════════════════════════════════════╝
    `);
});

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Promise Rejection:', err);
    server.close(() => process.exit(1));
});