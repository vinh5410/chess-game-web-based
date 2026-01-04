const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - JWT verification
exports.protect = async (req, res, next) => {
    let token;
    
    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    // Check for token in cookies
    else if (req.cookies.token) {
        token = req.cookies.token;
    }
    
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized to access this route'
        });
    }
    
    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Get user from token
        req.user = await User.findById(decoded.id);
        
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }
        
        next();
    } catch (error) {
        console.error('JWT verification error:', error);
        return res.status(401).json({
            success: false,
            message: 'Not authorized to access this route'
        });
    }
};

// Middleware: Prevent IDOR (Only owner can access)
exports.restrictToOwner = (req, res, next) => {
    // Check if user is logged in
    if (!req.user) {
        return res.status(401).json({ message: 'You are not logged in' });
    }

    // Check if requested ID matches logged-in user ID
    // Assumes route parameter is :id or :userId
    const requestedId = req.params.id || req.params.userId;
    
    if (requestedId && req.user._id.toString() !== requestedId) {
        return res.status(403).json({ 
            success: false,
            message: 'You do not have permission to perform this action on another user.' 
        });
    }
    next();
};