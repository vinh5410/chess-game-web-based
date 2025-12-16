const User = require('../models/User');
module.exports = (io, userManager, gameManager) => {
    io.on('connection', (socket) => {
        console.log(`🔌 Client connected: ${socket.id}`);

        // --- AUTH ---
        socket.on('user:login', async ({ username }) => {
            const existingUser = userManager.getUser(socket.id);
            if (existingUser) return; // Đã login rồi

            const result = userManager.addUser(socket.id, username);

            if (result.success) {
                // Cập nhật socketId vào DB
                const userDB = await User.findOne({ username });
                if (userDB) {
                    userDB.socketId = socket.id;
                    await userDB.save();
                }

                socket.emit('user:login_success', { 
                    userId: socket.id, 
                    username: result.user.username 
                });
                io.emit('users:update', { users: userManager.getAllUsers() });
                console.log(`✅ User logged in: ${username}`);
            } else {
                socket.emit('user:login_error', { message: result.message });
            }
        });

        socket.on('user:logout', () => {
            const user = userManager.removeUser(socket.id);
            if (user) {
                io.emit('users:update', { users: userManager.getAllUsers() });
            }
        });

        // --- MATCHMAKING ---
        socket.on('matchmaking:join', (data) => {  // ✅ NHẬN data
            const user = userManager.getUser(socket.id);
            const userId = user?.userId || user?._id; // hoặc trường phù hợp
            if (!user) return socket.emit('room:error', { message: 'Login first' });
            const timeControl = data?.timeControl || 300;  // ✅ LẤY timeControl, default 300
            const result = gameManager.addToMatchmaking(socket.id, userId, timeControl);  // ✅ TRUYỀN timeControl
            
            if (!result.matched) {
                socket.emit('matchmaking:waiting', { 
                    queue: gameManager.getMatchmakingQueueSize() 
                });
            }
        });

        socket.on('matchmaking:leave', () => {
            const removed = gameManager.removeFromMatchmaking(socket.id);
            if (removed) {
                socket.emit('matchmaking:left'); // EMIT EVENT VỀ CLIENT
                console.log(`👋 User left matchmaking: ${socket.id}`);
            }
        });

        // --- PRIVATE ROOM ---
        socket.on('room:create', (data) => {  // ✅ NHẬN data
            const user = userManager.getUser(socket.id);
            if (!user) return socket.emit('room:error', { message: 'Login first' });
            const userId = user.userId || user._id;
            const timeControl = data?.timeControl || 300;  // ✅ LẤY timeControl
            const room = gameManager.createPrivateRoom(socket.id, userId, timeControl);  // ✅ TRUYỀN timeControl
            socket.join(room.id);
            socket.emit('room:created', { roomId: room.id, roomCode: room.code });
        });

        socket.on('room:join', ({ roomCode }) => {
            const user = userManager.getUser(socket.id);
            if (!user) return socket.emit('room:error', { message: 'Login first' });
            const userId = user.userId || user._id;
            const result = gameManager.joinPrivateRoom(socket.id, userId, roomCode);
            if (result.success) {
                socket.join(result.room.id);
                socket.emit('room:joined', { roomId: result.room.id, roomCode: result.room.code });
                
                // Báo cho chủ phòng
                const creatorId = result.room.players[0]?.socketId;
                io.to(creatorId).emit('room:opponent_joined', { 
                    opponent: { id: user.id, username: user.username } 
                });
                
                gameManager.startGame(result.room.id);
            } else {
                socket.emit('room:error', { message: result.message });
            }
        });

        // --- GAMEPLAY ---
        socket.on('game:move', async ({ roomId, move }) => {
            const result = gameManager.makeMove(roomId, socket.id, move);
            
            if (result.success) {
                const room = gameManager.getRoom(roomId);
                // Send move to all players in room (including sender) with timer snapshot
                const timersSnapshot = room ? { ...room.timers } : {};
                const currentPlayerObj = room ? room.players.find(p => room.playerColors[p.socketId] === room.currentTurn) : null;
                const currentTurnSocketId = currentPlayerObj ? currentPlayerObj.socketId : null;
                
                socket.to(roomId).emit('game:move', {
                    move: move,
                    fen: result.fen,
                    timers: timersSnapshot,
                    currentTurnSocketId,
                    by: socket.id
                });
                socket.emit('game:move_applied', {
                    fen: result.fen,
                    timers: timersSnapshot,
                    currentTurnSocketId
                });

                // If game finished, emit game over and call endGame
                if (result.gameOver) {
                    io.to(roomId).emit('game:over', {
                        winner: result.winner,
                        reason: result.reason,
                        fen: result.fen
                    });
                    let winnerId = null;
                    if (result.reason === 'checkmate') {
                        winnerId = socket.id;
                    }
                    await gameManager.endGame(roomId, winnerId, result.reason);
                }
            } else {
                socket.emit('game:invalid_move', { message: result.message });
            }
        });
        socket.on('game:request_time_sync', ({ roomId }) => {
            const room = gameManager.getRoom(roomId);
            if (room) {
                const currentPlayerObj = room.players.find(p => room.playerColors[p.socketId] === room.currentTurn);
                const currentTurnSocketId = currentPlayerObj ? currentPlayerObj.socketId : null;
                socket.emit('game:timer_update', {
                    timers: { ...room.timers },
                    currentTurnSocketId
                });
            }
        });
        socket.on('game:resign', async ({ roomId }) => {
            const room = gameManager.getRoom(roomId);
            if (room) {
                // Logic: Tìm người còn lại là người thắng
                const opponentId = room.getOpponent(socket.id);
                const winnerColor = room.getPlayerColor(opponentId);
                
                io.to(roomId).emit('game:over', {
                    winner: winnerColor,
                    reason: 'resignation'
                });
                
                // Gọi endGame có sẵn
                await gameManager.endGame(roomId, opponentId, 'resignation');
            }
        });

        // --- CHAT ---
        socket.on('chat:message', ({ roomId, message }) => {
            const user = userManager.getUser(socket.id);
            if (user) {
                io.to(roomId).emit('chat:message', {
                    sender: socket.id,
                    username: user.username,
                    message: message.substring(0, 200),
                    timestamp: Date.now()
                });
            }
        });

        // --- 5. FRIEND SYSTEM & INVITE ---

        // A. Xử lý Kết bạn
        socket.on('friend:request', async ({ toUsername }) => {
            const sender = userManager.getUser(socket.id);
            if (!sender) return;

            try {
                // Tìm người nhận trong DB
                const receiverDB = await User.findOne({ username: toUsername });
                const senderDB = await User.findOne({ username: sender.username });

                if (!receiverDB) {
                    return socket.emit('friend:error', { message: 'User not found' });
                }
                if (receiverDB.username === sender.username) {
                    return socket.emit('friend:error', { message: 'Cannot add yourself' });
                }

                // Kiểm tra trùng
                const isFriend = senderDB.friends.find(f => f.username === toUsername);
                if (isFriend) {
                    return socket.emit('friend:error', { message: 'Already friends or request sent' });
                }

                // Update DB (Thêm vào danh sách cả 2 với status pending)
                receiverDB.friends.push({ 
                    userId: senderDB._id, 
                    username: sender.username, 
                    status: 'pending' 
                });
                await receiverDB.save();

                socket.emit('friend:success', { message: `Request sent to ${toUsername}` });

                // Báo ngay cho người nhận nếu đang online
                // (Dùng hàm tìm user của userManager)
                // Lưu ý: userManager của bạn lưu theo socketId, nên phải duyệt map để tìm
                const allUsers = userManager.getAllUsers(); // Hàm này trả về array {id, username...}
                const receiverOnline = allUsers.find(u => u.username === toUsername);
                
                if (receiverOnline) {
                    io.to(receiverOnline.id).emit('friend:received_request', { 
                        from: sender.username 
                    });
                }

            } catch (e) {
                console.error(e);
                socket.emit('friend:error', { message: 'Database error' });
            }
        });

        // B. Xử lý Mời chơi (Game Invite)
        socket.on('game:invite', ({ toUsername, roomId }) => {
            const sender = userManager.getUser(socket.id);
            if (!sender) return;

            // Tìm người được mời
            const allUsers = userManager.getAllUsers();
            const receiver = allUsers.find(u => u.username === toUsername);
            
            if (receiver) {
                // Gửi lời mời kèm RoomID
                io.to(receiver.id).emit('game:invite_received', {
                    from: sender.username,
                    roomId: roomId
                });
                socket.emit('game:invite_sent', { to: toUsername });
            } else {
                socket.emit('game:error', { message: 'User is offline or not found' });
            }
        });
        
        // C. Chấp nhận lời mời (Optional - Client có thể tự join thẳng)
        socket.on('game:invite_accept', ({ roomId }) => {
            // Logic này client tự xử lý bằng cách emit 'room:join'
            console.log(`User ${socket.id} accepted invite to ${roomId}`);
        });

        // --- DISCONNECT ---
        socket.on('disconnect', () => {
            const user = userManager.getUser(socket.id);
            if (user) {
                console.log(`❌ Disconnected: ${user.username}`);
                
                // Xử lý thoát game, thoát hàng đợi
                const activeRooms = gameManager.getUserRooms(socket.id);
                activeRooms.forEach(roomId => {
                    socket.to(roomId).emit('room:opponent_left', { reason: 'disconnected' });
                    gameManager.removeRoom(roomId);
                });
                
                gameManager.removeFromMatchmaking(socket.id);
                userManager.removeUser(socket.id);
                
                io.emit('users:update', { users: userManager.getAllUsers() });
            }
        });
// handle client leaving a room (explicit leave -> notify opponent and remove room)
        socket.on('room:leave', ({ roomId }) => {
            try {
                const room = gameManager.getRoom(roomId);
                if (!room) return;
                if (room.hasPlayer(socket.id)) {
                    socket.to(roomId).emit('room:opponent_left', { reason: 'left' });
                    socket.leave(roomId);
                    gameManager.removeRoom(roomId);
                    console.log(`🚪 User ${socket.id} left room ${roomId}`);
                }
            } catch (e) {
                console.error('Error handling room:leave', e);
            }
        });        
    });
};