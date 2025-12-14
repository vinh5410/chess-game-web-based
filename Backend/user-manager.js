class UserManager {
    constructor() {
        this.users = new Map();
        this.disconnectedUsers = new Map(); // username -> timestamp
    }
    
    addUser(socketId, username) {
        const existingUser = Array.from(this.users.entries())
            .find(([id, u]) => u.username.toLowerCase() === username.toLowerCase());
        
        if (existingUser) {
            const [oldSocketId, oldUser] = existingUser;
            
            if (oldSocketId === socketId) {
                return {
                    success: false,
                    message: 'Already logged in'
                };
            }
            
            // Check if user disconnected recently (within 30 seconds)
            const disconnectTime = this.disconnectedUsers.get(username.toLowerCase());
            if (disconnectTime && (Date.now() - disconnectTime) < 30000) {
                // Allow reconnect within 30 seconds
                console.log(`✅ Reconnect allowed for ${username}`);
                this.users.delete(oldSocketId);
                this.disconnectedUsers.delete(username.toLowerCase());
            } else {
                return {
                    success: false,
                    message: 'Username already taken'
                };
            }
        }
        
        const user = {
            id: socketId,
            username: username,
            connectedAt: Date.now(),
            inGame: false,
            currentRoom: null
        };
        
        this.users.set(socketId, user);
        
        return {
            success: true,
            user: user
        };
    }
    
    removeUser(socketId) {
        const user = this.users.get(socketId);
        if (user) {
            // Mark disconnect time
            this.disconnectedUsers.set(user.username.toLowerCase(), Date.now());
            
            // Auto cleanup after 30 seconds
            setTimeout(() => {
                this.disconnectedUsers.delete(user.username.toLowerCase());
            }, 30000);
        }
        this.users.delete(socketId);
        return user;
    }
    getUser(socketId) {
        return this.users.get(socketId);
    }
    
    getAllUsers() {
        return Array.from(this.users.values()).map(user => ({
            id: user.id,
            username: user.username,
            inGame: user.inGame
        }));
    }
    
    getOnlineCount() {
        return this.users.size;
    }
    
    setUserInGame(socketId, inGame, roomId = null) {
        const user = this.users.get(socketId);
        if (user) {
            user.inGame = inGame;
            user.currentRoom = roomId;
            return true;
        }
        return false;
    }
    
    // THÊM: Lấy user theo username
    getUserByUsername(username) {
        for (const user of this.users.values()) {
            if (user.username === username) {
                return user;
            }
        }
        return null;
    }
    
    isUserOnline(socketId) {
        return this.users.has(socketId);
    }
}

module.exports = UserManager;