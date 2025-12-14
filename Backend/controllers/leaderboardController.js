const User = require('../models/User');

// @desc    Get leaderboard
// @route   GET /api/users/leaderboard
// @access  Public
const getLeaderboard = async (req, res) => {
    try {
        // Lấy top 50 người có Elo cao nhất
        const users = await User.find()
            .sort({ rating: -1 }) // Sắp xếp giảm dần theo rating
            .limit(50)
            .select('username rating avatar'); // Chỉ lấy các trường cần thiết

        // --- ĐOẠN NÀY ĐỂ LOG RA TERMINAL CHO BẠN XEM ---
        console.log('\n╔════════════════════════════════════╗');
        console.log('║       🏆 TOP 5 LEADERBOARD 🏆      ║');
        console.log('╠════════════════════════════════════╣');
        
        if (users.length === 0) {
            console.log('║  (Chưa có người dùng nào)          ║');
        } else {
            users.slice(0, 5).forEach((u, index) => {
                const rank = index + 1;
                // Format cho đẹp để log thẳng hàng
                const name = u.username.padEnd(15, ' '); 
                console.log(`║  #${rank} | ${name} | Elo: ${u.rating}  ║`);
            });
        }
        console.log('╚════════════════════════════════════╝\n');
        // -----------------------------------------------

        res.status(200).json({
            success: true,
            count: users.length,
            leaderboard: users
        });
    } catch (error) {
        console.error('❌ Get leaderboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

module.exports = { getLeaderboard };