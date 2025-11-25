class SocketClient {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.userId = null;
        this.username = null;
        this.currentRoom = null;
        this.eventHandlers = new Map();
        
        // Server URL - Change this to your server address
        this.serverUrl = 'http://localhost:3000';
    }
    
    connect() {
        console.log('🔌 Connecting to server:', this.serverUrl);
        
        if (this.socket) {
            console.warn('⚠️ Socket already exists, disconnecting...');
            this.disconnect();
        }
        
        try {
            this.socket = io(this.serverUrl, {
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionAttempts: 5,
                transports: ['websocket', 'polling']
            });
            
            this.setupDefaultHandlers();
            
        } catch (error) {
            console.error('❌ Socket connection error:', error);
            this.onConnectionError(error);
        }
    }
    
    setupDefaultHandlers() {
        this.socket.on('connect', () => {
            console.log('✅ Connected to server:', this.socket.id);
            this.connected = true;
            this.userId = this.socket.id;
            this.emit('connection_success');
        });
        
        this.socket.on('disconnect', (reason) => {
            console.log('❌ Disconnected:', reason);
            this.connected = false;
            this.emit('disconnected', reason);
        });
        
        this.socket.on('connect_error', (error) => {
            console.error('❌ Connection error:', error);
            this.emit('connection_error', error);
        });
        
        this.socket.on('reconnect', (attemptNumber) => {
            console.log('🔄 Reconnected after', attemptNumber, 'attempts');
            this.emit('reconnected', attemptNumber);
        });
        
        this.socket.on('reconnect_failed', () => {
            console.error('❌ Reconnection failed');
            this.emit('reconnect_failed');
        });
    }
    
    // User authentication
    login(username) {
        console.log('👤 Logging in as:', username);
        this.username = username;
        this.socket.emit('user:login', { username });
    }
    
    logout() {
        console.log('👋 Logging out');
        this.socket.emit('user:logout');
        this.username = null;
        this.currentRoom = null;
    }
    
    // Random matchmaking
    findRandomMatch() {
        console.log('🎲 Finding random match...');
        this.socket.emit('matchmaking:join');
    }
    
    cancelRandomMatch() {
        console.log('❌ Cancelling random match...');
        this.socket.emit('matchmaking:leave');
    }
    
    // Private room
    createPrivateRoom() {
        console.log('🔐 Creating private room...');
        this.socket.emit('room:create');
    }
    
    joinPrivateRoom(roomCode) {
        console.log('🔗 Joining room:', roomCode);
        this.socket.emit('room:join', { roomCode });
    }
    
    leaveRoom() {
        console.log('🚪 Leaving room');
        if (this.currentRoom) {
            this.socket.emit('room:leave', { roomId: this.currentRoom });
            this.currentRoom = null;
        }
    }
    
    // Game actions
    makeMove(move) {
        console.log('♟️ Making move:', move);
        this.socket.emit('game:move', {
            roomId: this.currentRoom,
            move: move
        });
    }
    
    offerDraw() {
        console.log('🤝 Offering draw');
        this.socket.emit('game:draw_offer', { roomId: this.currentRoom });
    }
    
    respondDraw(accept) {
        console.log('🤝 Responding to draw:', accept);
        this.socket.emit('game:draw_response', {
            roomId: this.currentRoom,
            accept: accept
        });
    }
    
    resign() {
        console.log('🏳️ Resigning');
        this.socket.emit('game:resign', { roomId: this.currentRoom });
    }
    
    // Chat
    sendChatMessage(message) {
        console.log('💬 Sending message:', message);
        this.socket.emit('chat:message', {
            roomId: this.currentRoom,
            message: message
        });
    }
    
    // Event handling
    on(eventName, handler) {
        if (!this.eventHandlers.has(eventName)) {
            this.eventHandlers.set(eventName, []);
        }
        this.eventHandlers.get(eventName).push(handler);
        
        // Also register with socket.io
        if (this.socket) {
            this.socket.on(eventName, handler);
        }
    }
    
    off(eventName, handler) {
        if (this.eventHandlers.has(eventName)) {
            const handlers = this.eventHandlers.get(eventName);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
        
        if (this.socket) {
            this.socket.off(eventName, handler);
        }
    }
    
    emit(eventName, data) {
        const handlers = this.eventHandlers.get(eventName) || [];
        handlers.forEach(handler => handler(data));
    }
    
    disconnect() {
        if (this.socket) {
            console.log('🔌 Disconnecting socket...');
            this.socket.disconnect();
            this.socket = null;
            this.connected = false;
            this.userId = null;
            this.username = null;
            this.currentRoom = null;
        }
    }
    
    // Getters
    isConnected() {
        return this.connected && this.socket && this.socket.connected;
    }
    
    getUserId() {
        return this.userId;
    }
    
    getUsername() {
        return this.username;
    }
    
    getCurrentRoom() {
        return this.currentRoom;
    }
    
    setCurrentRoom(roomId) {
        this.currentRoom = roomId;
    }
}

// Create global instance
window.socketClient = new SocketClient();