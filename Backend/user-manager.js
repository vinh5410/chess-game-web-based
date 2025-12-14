const User = require('./models/User');
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
            username: username.trim(),
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
        }
    }
   
    isUserOnline(socketId) {
        return this.users.has(socketId);
    }

    // Lấy rating của user từ database dựa trên socketId
    async getUserRating(socketId) {
        const user = this.users.get(socketId);
        if (!user) return 1200;
        try {
            const dbUser = await User.findOne({ username: user.username });
            return dbUser ? dbUser.rating : 1200;
        } catch (e) {
            console.error(e);
            return 1200;
        }
    }

    // Cập nhật rating của user trong database dựa trên socketId
    async updateUserRating(socketId, newRating) {
        const user = this.users.get(socketId);
        if (!user) return;
        try {
            await User.findOneAndUpdate({ username: user.username }, { rating: newRating });
        } catch (e) {
            console.error(e);
        }
    }
    
}
 
module.exports = UserManager;