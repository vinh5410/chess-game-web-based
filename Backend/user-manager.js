const User = require('./models/User');

class UserManager {
    constructor() {
        this.users = new Map(); // socketId -> user
        this.usernames = new Map(); // usernameLower -> Set(socketId)
        this.disconnectedUsers = new Map(); // usernameLower -> timestamp
    }

    async addUser(socketId, username) {
        const nameKey = username.toLowerCase().trim();

        // If username currently present (one or more sockets), allow additional session.
        // But still support reconnect window: if user was recently disconnected, we also allow.
        const existingSet = this.usernames.get(nameKey);
        if (existingSet && existingSet.size > 0) {
            console.log(`ℹ️ Additional session for username: ${username}`);
            // continue to create new socket entry
        } else {
            // If no existing live session, check disconnectedUsers (reconnect window)
            const disconnectTime = this.disconnectedUsers.get(nameKey);
            if (disconnectTime && (Date.now() - disconnectTime) < 30000) {
                // reconnect allowed: clear disconnected timestamp
                this.disconnectedUsers.delete(nameKey);
                console.log(`✅ Reconnect allowed for ${username}`);
            }
        }

        // Load rating from DB when user logs in
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
            rating: dbRating
        };

        // store by socket
        this.users.set(socketId, user);

        // record in usernames map
        if (!this.usernames.has(nameKey)) this.usernames.set(nameKey, new Set());
        this.usernames.get(nameKey).add(socketId);

        return {
            success: true,
            user: user
        };
    }

    removeUser(socketId) {
        const user = this.users.get(socketId);
        if (user) {
            const nameKey = user.username.toLowerCase();
            // Remove socket from username set
            const set = this.usernames.get(nameKey);
            if (set) {
                set.delete(socketId);
                if (set.size === 0) {
                    // mark disconnect time only when last socket for username goes away
                    this.usernames.delete(nameKey);
                    this.disconnectedUsers.set(nameKey, Date.now());
                    // Auto cleanup after 30 seconds
                    setTimeout(() => {
                        this.disconnectedUsers.delete(nameKey);
                    }, 30000);
                }
            }
        }
        this.users.delete(socketId);
        return user;
    }

    getUser(socketId) {
        return this.users.get(socketId);
    }

    getAllUsers() {
        // Return unique usernames (one entry per username) to avoid duplicates in UI.
        const result = [];
        for (const [nameKey, set] of this.usernames.entries()) {
            // pick the first socketId in set to represent the user
            const firstSocket = set.values().next().value;
            const u = this.users.get(firstSocket);
            if (u) {
                result.push({
                    id: firstSocket,
                    username: u.username,
                    inGame: u.inGame
                });
            }
        }
        return result;
    }

    getOnlineCount() {
        // count unique usernames
        return this.usernames.size;
    }

    setUserInGame(socketId, inGame, roomId = null) {
        const user = this.users.get(socketId);
        if (user) {
            user.inGame = inGame;
            user.currentRoom = roomId;
            this.users.set(socketId, user);
        }
    }

    isUserOnline(socketId) {
        return this.users.has(socketId);
    }

    async getUserRating(socketId) {
        const user = this.users.get(socketId);
        if (!user) return 1200;

        if (user.rating && user.rating !== 1200) {
            return user.rating;
        }

        try {
            const dbUser = await User.findOne({ username: user.username });
            if (dbUser) {
                user.rating = dbUser.rating;
                this.users.set(socketId, user);
                return dbUser.rating;
            }
            return 1200;
        } catch (e) {
            console.error('❌ Error getting user rating:', e);
            return 1200;
        }
    }

    async updateUserRating(socketId, newRating) {
        const user = this.users.get(socketId);
        if (!user) return;

        try {
            await User.findOneAndUpdate({ username: user.username }, { rating: newRating });

            user.rating = newRating;
            this.users.set(socketId, user);

            console.log(`✅ Updated rating for ${user.username}: ${newRating} (Saved to DB & Memory)`);
        } catch (e) {
            console.error('❌ Error updating user rating:', e);
        }
    }
}

module.exports = UserManager;