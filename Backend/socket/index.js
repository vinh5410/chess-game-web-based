module.exports = (io, userManager, gameManager) => {
    io.on('connection', (socket) => {
        console.log(`🔌 Client connected: ${socket.id}`);

        // --- AUTH ---
        socket.on('user:login', ({ username }) => {
            const existingUser = userManager.getUser(socket.id);
            if (existingUser) return; // Đã login rồi

            // Hàm addUser của bạn trả về object { success, user, message }
            const result = userManager.addUser(socket.id, username);
            
            if (result.success) {
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
        socket.on('matchmaking:join', () => {
            const user = userManager.getUser(socket.id);
            if (!user) return socket.emit('room:error', { message: 'Login first' });

            const result = gameManager.addToMatchmaking(socket.id);
            // Logic tìm trận đã được gameManager xử lý và tự emit sự kiện bên trong
            if (!result.matched) {
                socket.emit('matchmaking:waiting', { 
                    queue: gameManager.getMatchmakingQueueSize() 
                });
            }
        });

        socket.on('matchmaking:leave', () => {
            gameManager.removeFromMatchmaking(socket.id);
        });

        // --- PRIVATE ROOM ---
        socket.on('room:create', () => {
            const user = userManager.getUser(socket.id);
            if (!user) return socket.emit('room:error', { message: 'Login first' });

            const room = gameManager.createPrivateRoom(socket.id);
            socket.join(room.id); // Socket join room của socket.io
            socket.emit('room:created', { roomId: room.id, roomCode: room.code });
        });

        socket.on('room:join', ({ roomCode }) => {
            const user = userManager.getUser(socket.id);
            if (!user) return socket.emit('room:error', { message: 'Login first' });

            const result = gameManager.joinPrivateRoom(socket.id, roomCode);
            if (result.success) {
                socket.join(result.room.id);
                socket.emit('room:joined', { roomId: result.room.id, roomCode: result.room.code });
                
                // Báo cho chủ phòng
                const creatorId = result.room.players[0];
                io.to(creatorId).emit('room:opponent_joined', { 
                    opponent: { id: user.id, username: user.username } 
                });
                
                gameManager.startGame(result.room.id);
            } else {
                socket.emit('room:error', { message: result.message });
            }
        });

        // --- GAMEPLAY ---
        // Lưu ý: FE hiện tại đang dùng event 'game:move' hay 'make_move'?
        // Trong game-manager.js bạn gửi t, nó emit 'game:move'. 
        // Nên ở đây mình listen 'game:move' cho đồng bộ.
        socket.on('game:move', ({ roomId, move }) => {
            // gameManager.makeMove đã xử lý logic check turn, validate move
            // và tự emit 'game:move' cho đối thủ nếu thành công.
            const result = gameManager.makeMove(roomId, socket.id, move);
            
            if (!result.success) {
                socket.emit('game:invalid_move', { message: result.message });
            }
            // Nếu result.success, gameManager tự lo việc broadcast
        });

        socket.on('game:resign', ({ roomId }) => {
             gameManager.handleResignation(roomId, socket.id);
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
    });
};