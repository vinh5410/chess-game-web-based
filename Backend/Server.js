const express = require('express');
const cors = require('cors');
const path = require('path');
const { Chess } = require('chess.js');
const http = require('http');
const socketIO = require('socket.io');

const UserManager = require('./user-manager');
const GameManager = require('./game-manager');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 3000;

// Initialize managers
const userManager = new UserManager();
const gameManager = new GameManager(io, userManager);

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
    res.json({ 
        status: 'OK', 
        message: 'Chess API is running',
        users: userManager.getOnlineCount(),
        games: gameManager.getActiveGamesCount()
    });
});

// Stockfish API endpoint (existing)
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

// Socket.IO Connection Handler
io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);
    
    // User authentication
    socket.on('user:login', ({ username }) => {
        console.log(`👤 User login attempt: ${username} (${socket.id})`);
        
        const result = userManager.addUser(socket.id, username);
        
        if (result.success) {
            socket.emit('user:login_success', {
                userId: socket.id,
                username: result.user.username
            });
            
            // Broadcast updated user list
            io.emit('users:update', {
                users: userManager.getAllUsers()
            });
            
            console.log(`✅ User logged in: ${username}`);
        } else {
            socket.emit('user:login_error', {
                message: result.message
            });
        }
    });
    
    socket.on('user:logout', () => {
        const user = userManager.getUser(socket.id);
        if (user) {
            console.log(`👋 User logout: ${user.username}`);
            userManager.removeUser(socket.id);
            
            // Broadcast updated user list
            io.emit('users:update', {
                users: userManager.getAllUsers()
            });
        }
    });
    
    // Matchmaking
    socket.on('matchmaking:join', () => {
        const user = userManager.getUser(socket.id);
        if (!user) {
            socket.emit('room:error', { message: 'Please login first' });
            return;
        }
        
        console.log(`🎲 ${user.username} joining matchmaking...`);
        
        const result = gameManager.addToMatchmaking(socket.id);
        
        if (result.matched) {
            console.log(`🎉 Match found: ${result.player1.username} vs ${result.player2.username}`);
            // Match notifications sent by gameManager
        } else {
            socket.emit('matchmaking:waiting', {
                queue: gameManager.getMatchmakingQueueSize()
            });
        }
    });
    
    socket.on('matchmaking:leave', () => {
        gameManager.removeFromMatchmaking(socket.id);
        console.log(`❌ User left matchmaking: ${socket.id}`);
    });
    
    // Private rooms
    socket.on('room:create', () => {
        const user = userManager.getUser(socket.id);
        if (!user) {
            socket.emit('room:error', { message: 'Please login first' });
            return;
        }
        
        const room = gameManager.createPrivateRoom(socket.id);
        socket.join(room.id);
        
        socket.emit('room:created', {
            roomId: room.id,
            roomCode: room.code
        });
        
        console.log(`🔐 Private room created: ${room.code} by ${user.username}`);
    });
    
    socket.on('room:join', ({ roomCode }) => {
        const user = userManager.getUser(socket.id);
        if (!user) {
            socket.emit('room:error', { message: 'Please login first' });
            return;
        }
        
        const result = gameManager.joinPrivateRoom(socket.id, roomCode);
        
        if (result.success) {
            socket.join(result.room.id);
            
            socket.emit('room:joined', {
                roomId: result.room.id,
                roomCode: result.room.code
            });
            
            console.log(`✅ ${user.username} joined room: ${roomCode}`);
            
            // Notify room creator
            const creatorSocket = io.sockets.sockets.get(result.room.players[0]);
            if (creatorSocket) {
                creatorSocket.emit('room:opponent_joined', {
                    opponent: user
                });
            }
            
            // Start game
            gameManager.startGame(result.room.id);
        } else {
            socket.emit('room:error', { message: result.message });
        }
    });
    
    socket.on('room:leave', ({ roomId }) => {
        const room = gameManager.getRoom(roomId);
        if (room) {
            socket.leave(roomId);
            
            // Notify opponent
            socket.to(roomId).emit('room:opponent_left', {
                reason: 'Player left'
            });
            
            gameManager.removeRoom(roomId);
            console.log(`🚪 User left room: ${roomId}`);
        }
    });
    
    // Game actions
    socket.on('game:move', ({ roomId, move }) => {
        const user = userManager.getUser(socket.id);
        const result = gameManager.makeMove(roomId, socket.id, move);
        
        if (result.success) {
            console.log(`♟️ Move in ${roomId}: ${move} by ${user?.username}`);
            
            // Notify opponent
            socket.to(roomId).emit('game:move', {
                move: move,
                fen: result.fen
            });
            
            // Check game over
            if (result.gameOver) {
                io.to(roomId).emit('game:over', {
                    winner: result.winner,
                    reason: result.reason,
                    fen: result.fen
                });
                
                console.log(`🏁 Game over in ${roomId}: ${result.reason}`);
            }
        } else {
            socket.emit('game:invalid_move', {
                message: result.message
            });
        }
    });
    
    socket.on('game:draw_offer', ({ roomId }) => {
        const user = userManager.getUser(socket.id);
        
        socket.to(roomId).emit('game:draw_offer', {
            from: user?.username || 'Opponent'
        });
        
        console.log(`🤝 Draw offer in ${roomId} by ${user?.username}`);
    });
    
    socket.on('game:draw_response', ({ roomId, accept }) => {
        if (accept) {
            io.to(roomId).emit('game:draw_accepted', {});
            gameManager.endGame(roomId, null, 'draw');
            console.log(`🤝 Draw accepted in ${roomId}`);
        } else {
            socket.to(roomId).emit('game:draw_declined', {});
            console.log(`❌ Draw declined in ${roomId}`);
        }
    });
    
    socket.on('game:resign', ({ roomId }) => {
        const room = gameManager.getRoom(roomId);
        if (room) {
            const winner = room.players.find(p => p !== socket.id);
            
            io.to(roomId).emit('game:over', {
                winner: room.getPlayerColor(winner),
                reason: 'resignation'
            });
            
            gameManager.endGame(roomId, winner, 'resignation');
            console.log(`🏳️ Resignation in ${roomId}`);
        }
    });
    
    // Chat
    socket.on('chat:message', ({ roomId, message }) => {
        const user = userManager.getUser(socket.id);
        if (!user) return;
        
        const cleanMessage = message.substring(0, 200).trim();
        
        io.to(roomId).emit('chat:message', {
            sender: socket.id,
            username: user.username,
            message: cleanMessage,
            timestamp: Date.now()
        });
        
        console.log(`💬 Chat in ${roomId} from ${user.username}: ${cleanMessage}`);
    });
    
    // Disconnect
    socket.on('disconnect', () => {
        const user = userManager.getUser(socket.id);
        
        if (user) {
            console.log(`❌ User disconnected: ${user.username} (${socket.id})`);
            
            // Handle active games
            const activeRooms = gameManager.getUserRooms(socket.id);
            activeRooms.forEach(roomId => {
                socket.to(roomId).emit('room:opponent_left', {
                    reason: 'disconnected'
                });
                gameManager.removeRoom(roomId);
            });
            
            // Remove from matchmaking
            gameManager.removeFromMatchmaking(socket.id);
            
            // Remove user
            userManager.removeUser(socket.id);
            
            // Broadcast updated user list
            io.emit('users:update', {
                users: userManager.getAllUsers()
            });
        } else {
            console.log(`❌ Client disconnected: ${socket.id}`);
        }
    });
});

// Handle missing assets gracefully
app.get('/assets/*', (req, res) => {
    console.log(`⚠️ Missing asset: ${req.path}`);
    res.status(404).send('Asset not found');
});

// Specific routes
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

// Serve frontend for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend', 'index.html'));
});

server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║         🎮 CHESS GAME SERVER STARTED 🎮                  ║
╠══════════════════════════════════════════════════════════╣
║  🚀 Server: http://localhost:${PORT}                       ║
║  📁 Frontend: ${path.join(__dirname, '../Frontend')}     
║                                                          ║
║  🏠 Routes:                                              ║
║     • Home:           http://localhost:${PORT}/           ║
║     • Play vs Bot:    http://localhost:${PORT}/play-vs-bot.html
║     • Multiplayer:    http://localhost:${PORT}/play-multiplayer.html
║     • Health Check:   http://localhost:${PORT}/api/health ║
║                                                          ║
║  🔌 WebSocket: Socket.IO enabled for multiplayer        ║
╚══════════════════════════════════════════════════════════╝
    `);
});