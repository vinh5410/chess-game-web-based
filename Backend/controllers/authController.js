const User = require('../models/User');
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/sendEmail');
const crypto = require('crypto');

// Generate JWT Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '7d'
    });
};

// Send token response
const sendTokenResponse = (user, statusCode, res) => {
    const token = generateToken(user._id);
    
    const isProduction = process.env.NODE_ENV === 'production';

    const options = {
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        httpOnly: true,
        secure: isProduction ? true : false,
        sameSite: isProduction ? 'none' : 'lax'
    };
    
    res.status(statusCode)
        .cookie('token', token, options)
        .json({
            success: true,
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                avatar: user.avatar,
                rating: user.rating,
                gamesPlayed: user.gamesPlayed
            }
        });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // Validation
        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide username, email and password'
            });
        }
        
        // Check if user exists
        const existingUser = await User.findOne({
            $or: [{ email }, { username }]
        });
        
        if (existingUser) {
            const field = existingUser.email === email ? 'Email' : 'Username';
            return res.status(400).json({
                success: false,
                message: `${field} already exists`
            });
        }
        
        // Create user
        const user = await User.create({
            username,
            email,
            password,
            isVerified: false // Mặc định chưa xác minh
        });

        const token = user.generateToken('verify');
        await user.save({ validateBeforeSave: false });

        // Tạo URL kích hoạt
        const verifyUrl = `${req.protocol}://${req.get('host')}/api/auth/verify/${token}`;

        try {
            // Gửi email kích hoạt
            await sendEmail({
                email: user.email,
                subject: 'Kích hoạt tài khoản Chess Game',
                message: `Click vào link sau để kích hoạt tài khoản: \n\n${verifyUrl}`
            });
            
            console.log('User registered (pending verify):', username);
            
            // Trả về phản hồi thành công
            res.status(200).json({ 
                success: true, 
                message: 'Đăng ký thành công! Hãy kiểm tra email để kích hoạt.' 
            });
            
        } catch (err) {
            console.error('Send email error (Register):', err); // Log lỗi chi tiết
            // Nếu gửi mail thất bại, xóa user vừa tạo
            await User.findByIdAndDelete(user._id);
            return res.status(500).json({ 
                success: false, 
                message: 'Không thể gửi email xác thực. Vui lòng kiểm tra lại email hoặc thử lại sau.' 
            });
        }
        
        console.log('User registered:', username);
        
        //sendTokenResponse(user, 201, res);
        
    } catch (error) {
        console.error('Register error:', error);
        
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(400).json({
                success: false,
                message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
            });
        }
        
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};

// @desc    Kích hoạt tài khoản
// @route   GET /api/auth/verify/:token
exports.verifyAccount = async (req, res) => {
    try {
        // Hash token từ URL để so sánh với DB
        const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
        
        // Tìm user có token đó
        const user = await User.findOne({ verificationToken: hashedToken });

        if (!user) {
            return res.status(400).send('<h1>Link không hợp lệ hoặc đã được sử dụng.</h1>');
        }

        // Kích hoạt user
        user.isVerified = true;
        user.verificationToken = undefined; // Xóa token sau khi dùng
        await user.save({ validateBeforeSave: false });

        // Redirect về trang Login của FE (Sửa đường dẫn '/login.html' nếu FE ông khác)
        res.redirect('/login.html?message=verified_success');
    } catch (error) {
        res.status(500).send('Server Error');
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }
        
        // Find user
        const user = await User.findOne({ email }).select('+password');
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        
        // Check password
        const isPasswordMatch = await user.comparePassword(password);
        
        if (!isPasswordMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        
        // Check if verified
        if (!user.isVerified) {
            return res.status(401).json({ 
                success: false, 
                message: 'Tài khoản chưa kích hoạt. Vui lòng kiểm tra email.' 
            });
        }

        // Update last seen
        user.lastSeen = Date.now();
        user.isOnline = true;
        await user.save({ validateBeforeSave: false });
        
        console.log('User logged in:', user.username);
        
        sendTokenResponse(user, 200, res);
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Quên mật khẩu (Gửi link reset)
// @route   POST /api/auth/forgotpassword
exports.forgotPassword = async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (!user) return res.status(404).json({ success: false, message: 'Email không tồn tại' });

        // Tạo token reset
        const resetToken = user.generateToken('reset');
        await user.save({ validateBeforeSave: false });

        // Link trỏ về trang Reset của FE (Port 3000 là ví dụ, ông sửa lại theo đúng port FE)
        const resetUrl = `${req.protocol}://${req.get('host').split(':')[0]}:3000/reset-password.html?token=${resetToken}`;

        try {
            await sendEmail({ 
                email: user.email, 
                subject: 'Đặt lại mật khẩu', 
                message: `Click link để đổi mật khẩu: \n\n${resetUrl}` 
            });
            res.status(200).json({ success: true, data: 'Đã gửi email hướng dẫn' });
        } catch (err) {
            console.error('Send email error (Forgot Password):', err); // Log lỗi chi tiết
            user.resetPasswordToken = undefined;
            user.resetPasswordExpire = undefined;
            await user.save({ validateBeforeSave: false });
            return res.status(500).json({ success: false, message: 'Lỗi gửi mail' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Đặt lại mật khẩu mới
// @route   PUT /api/auth/resetpassword/:token
exports.resetPassword = async (req, res) => {
    try {
        const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpire: { $gt: Date.now() } // Check xem token còn hạn không
        });

        if (!user) return res.status(400).json({ success: false, message: 'Link hết hạn hoặc không đúng' });

        user.password = req.body.password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        res.status(200).json({ success: true, message: 'Đổi mật khẩu thành công. Hãy đăng nhập lại.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res) => {
    try {
        if (req.user) {
            req.user.isOnline = false;
            req.user.lastSeen = Date.now();
            await req.user.save({ validateBeforeSave: false });
            
            console.log('User logged out:', req.user.username);
        }
        
        res.cookie('token', 'none', {
            expires: new Date(Date.now() + 10 * 1000),
            httpOnly: true
        });
        
        res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });
        
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        res.status(200).json({
            success: true,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                avatar: user.avatar,
                rating: user.rating,
                gamesPlayed: user.gamesPlayed,
                gamesWon: user.gamesWon,
                gamesLost: user.gamesLost,
                gamesDraw: user.gamesDraw,
                winRate: user.winRate,
                createdAt: user.createdAt
            }
        });
        
    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Please provide current and new password'
            });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 6 characters'
            });
        }
        
        const user = await User.findById(req.user.id).select('+password');
        
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }
        
        user.password = newPassword;
        await user.save();
        
        console.log(`Password changed: ${user.username}`);
        
        res.status(200).json({
            success: true,
            message: 'Password changed successfully'
        });
        
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Resend verification email
// @route   POST /api/auth/resend-verification
// @access  Public
exports.resendVerificationEmail = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email address'
            });
        }

        // Find user by email
        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'No account found with this email'
            });
        }

        // Check if already verified
        if (user.isVerified) {
            return res.status(400).json({
                success: false,
                message: 'This account is already verified'
            });
        }

        // Generate new verification token
        const token = user.generateToken('verify');
        await user.save({ validateBeforeSave: false });

        // Create verification URL
        const verifyUrl = `${req.protocol}://${req.get('host')}/api/auth/verify/${token}`;

        try {
            // Send verification email
            await sendEmail({
                email: user.email,
                subject: 'Resend: Kích hoạt tài khoản Chess Game',
                message: `Click vào link sau để kích hoạt tài khoản: \n\n${verifyUrl}\n\nLink này sẽ hết hạn sau 24 giờ.`
            });

            console.log('Verification email resent to:', user.email);

            res.status(200).json({
                success: true,
                message: 'Verification email sent successfully! Please check your inbox.'
            });
        } catch (err) {
            console.error('Send email error:', err);
            res.status(500).json({
                success: false,
                message: 'Failed to send verification email. Please try again later.'
            });
        }

    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Login with Google
// @route   POST /api/auth/google
exports.googleLogin = async (req, res) => {
    try {
        const { token } = req.body;
        const { OAuth2Client } = require('google-auth-library');
        const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        const { name, email, picture, sub: googleId } = ticket.getPayload();

        let user = await User.findOne({ email });

        if (user) {
            // User exists -> Login
            if (!user.googleId) {
                user.googleId = googleId; // Link Google ID if not linked
                await user.save({ validateBeforeSave: false });
            }
        } else {
            // User doesn't exist -> Register
            user = await User.create({
                username: name.replace(/\s+/g, '') + Math.floor(Math.random() * 1000), // Generate username
                email,
                googleId,
                avatar: picture,
                isVerified: true, // Google emails are verified
                password: crypto.randomBytes(20).toString('hex') // Random password
            });
        }

        sendTokenResponse(user, 200, res);

    } catch (error) {
        console.error('Google Login Error:', error);
        res.status(400).json({ success: false, message: 'Google Login Failed' });
    }
};

// @desc    Login with Facebook
// @route   POST /api/auth/facebook
exports.facebookLogin = async (req, res) => {
    try {
        const { userID, accessToken, email, name, picture } = req.body;
        
        // Verify token with Facebook Graph API (Optional but recommended for security)
        // For simplicity, we trust the client data here, but in production verify with FB API

        let user = await User.findOne({ email });

        if (user) {
            if (!user.facebookId) {
                user.facebookId = userID;
                await user.save({ validateBeforeSave: false });
            }
        } else {
            user = await User.create({
                username: name.replace(/\s+/g, '') + Math.floor(Math.random() * 1000),
                email,
                facebookId: userID,
                avatar: picture?.data?.url,
                isVerified: true,
                password: crypto.randomBytes(20).toString('hex')
            });
        }

        sendTokenResponse(user, 200, res);

    } catch (error) {
        console.error('Facebook Login Error:', error);
        res.status(400).json({ success: false, message: 'Facebook Login Failed' });
    }
};