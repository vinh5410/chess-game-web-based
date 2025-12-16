const User = require('./models/User');
class UserManager {
    constructor() {
        this.users = new Map();
        this.disconnectedUsers = new Map(); // username -> timestamp
 
    }
   
    async addUser(socketId, username) {
    async addUser(socketId, username) {
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
       
        // ⭐ Load rating từ DB khi user login
        let dbRating = 1200;
        try {
            const dbUser = await User.findOne({ username });
            if (dbUser) {
                dbRating = dbUser.rating;
                console.log(`📊 Loaded rating for ${username}: ${dbRating}`);
            }
        } catch (e) {
            console.error('❌ Error loading user rating:', e);
        }
 
        const user = {
            id: socketId,
            username: username.trim(),
            connectedAt: Date.now(),
            inGame: false,
            currentRoom: null,
            rating: dbRating  // ⭐ Lưu rating vào memory ngay khi login
            currentRoom: null,
            rating: dbRating  // ⭐ Lưu rating vào memory ngay khi login
        };
       
        this.users.set(socketId, user);
       
        return {
            success: true,
            user: user
        };
    }
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
 
    // Lấy rating của user từ bộ nhớ (ưu tiên) hoặc database
    async getUserRating(socketId) {
        const user = this.users.get(socketId);
        if (!user) return 1200;
       
        // ⭐ Nếu có rating trong memory, dùng luôn (đã được update mới nhất)
        if (user.rating && user.rating !== 1200) {
            return user.rating;
        }
 
        // Fallback: Lấy từ DB nếu memory chưa có
        try {
            const dbUser = await User.findOne({ username: user.username });
            if (dbUser) {
                // ⭐ Lưu lại vào memory để lần sau dùng
                user.rating = dbUser.rating;
                this.users.set(socketId, user);
                return dbUser.rating;
            }
            return 1200;
            if (dbUser) {
                // ⭐ Lưu lại vào memory để lần sau dùng
                user.rating = dbUser.rating;
                this.users.set(socketId, user);
                return dbUser.rating;
            }
            return 1200;
        } catch (e) {
            console.error('❌ Error getting user rating:', e);
            console.error('❌ Error getting user rating:', e);
            return 1200;
        }
    }
 
    // Cập nhật rating của user trong database & memory
    async updateUserRating(socketId, newRating) {
        const user = this.users.get(socketId);
        if (!user) return;
       
        try {
            // 1. Cập nhật vào Database
            // 1. Cập nhật vào Database
            await User.findOneAndUpdate({ username: user.username }, { rating: newRating });
           
            // 2. ⭐ QUAN TRỌNG: Cập nhật ngay vào bộ nhớ (Memory)
            // Nếu không có dòng này, ván sau vẫn dùng rating cũ để tính ELO
            user.rating = newRating;
            this.users.set(socketId, user);
 
            console.log(`✅ Updated rating for ${user.username}: ${newRating} (Saved to DB & Memory)`);
        } catch (e) {
            console.error('❌ Error updating user rating:', e);
            console.error('❌ Error updating user rating:', e);
        }
    }
   
}
 
module.exports = UserManager;