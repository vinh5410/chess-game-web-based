class UserManager {
    constructor() {
        this.users = new Map(); // userId -> user object
    }
    
    addUser(socketId, username) {
        // Check if username already exists
        const existingUser = Array.from(this.users.values())
            .find(u => u.username.toLowerCase() === username.toLowerCase());
        
        if (existingUser) {
            return {
                success: false,
                message: 'Username already taken'
            };
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
}

module.exports = UserManager;