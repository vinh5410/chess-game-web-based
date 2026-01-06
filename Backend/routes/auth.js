const express = require('express');
const router = express.Router();
const {
    register,
    verifyAccount,
    login,
    logout,
    getMe,
    changePassword,
    forgotPassword,
    resetPassword,
    resendVerificationEmail,
    googleLogin
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.get('/verify/:token', verifyAccount);
router.post('/login', login);
router.post('/google', googleLogin);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/password', protect, changePassword); // NEW

router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword/:token', resetPassword);
router.post('/resend-verification', resendVerificationEmail);

module.exports = router;