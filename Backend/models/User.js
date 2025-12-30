const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true,
        trim: true,
        minlength: [3, 'Username must be at least 3 characters'],
        maxlength: [20, 'Username cannot exceed 20 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false
    },

    isVerified: { type: Boolean, default: false },
    verificationToken: String, // Token kích hoạt tài khoản
    
    resetPasswordToken: String, // Token quên mật khẩu
    resetPasswordExpire: Date,

    avatar: {
        type: String,
        default: function() {
            return `https://ui-avatars.com/api/?name=${encodeURIComponent(this.username)}&background=random&size=128`;
        }
    },
    rating: {
        type: Number,
        default: 1200
    },
    gamesPlayed: {
        type: Number,
        default: 0
    },
    gameIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GameHistory'
}],
    gamesWon: {
        type: Number,
        default: 0
    },
    gamesLost: {
        type: Number,
        default: 0
    },
    gamesDraw: {
        type: Number,
        default: 0
    },
    isOnline: {
        type: Boolean,
        default: false
    },
    lastSeen: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Hash password before saving (ASYNC - NO NEXT)
userSchema.pre('save', async function() {
    // Only hash if password is modified
    if (!this.isModified('password')) {
        return; // Just return, no next()
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    
    // NO next() needed for async functions
});

// Method to compare password
userSchema.methods.comparePassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Generate and hash token
userSchema.methods.generateToken = function(type) {
    const token = crypto.randomBytes(20).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    if (type === 'verify') {
        this.verificationToken = hashedToken;
    } else if (type === 'reset') {
        this.resetPasswordToken = hashedToken;
        this.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 phút
    }
    return token;
};

// Win rate virtual field
userSchema.virtual('winRate').get(function() {
    if (this.gamesPlayed === 0) return 0;
    return Math.round((this.gamesWon / this.gamesPlayed) * 100);
});

userSchema.methods.getRating = function() {
    return this.rating;
};

userSchema.methods.updateRating = function(newRating) {
    this.rating = newRating;
    return this.save();
};

module.exports = mongoose.model('User', userSchema);