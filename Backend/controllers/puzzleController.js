const Puzzle = require('../models/Puzzle');
const UserPuzzle = require('../models/UserPuzzle');
const User = require('../models/User');

// @desc    Get random puzzle
// @route   GET /api/puzzles/random?difficulty=intermediate&theme=mate
// @access  Public
exports.getRandomPuzzle = async (req, res) => {
    try {
        const { difficulty, theme, userRating } = req.query;
        
        let query = {};
        
        // Filter by difficulty
        if (difficulty && ['beginner', 'intermediate', 'advanced', 'expert'].includes(difficulty)) {
            query.difficulty = difficulty;
        }
        
        // Filter by theme
        if (theme) {
            query.themes = theme;
        }
        
        // Filter by rating range (±300 from user rating)
        if (userRating) {
            const rating = parseInt(userRating);
            query.rating = {
                $gte: Math.max(500, rating - 300),
                $lte: Math.min(3500, rating + 300)
            };
        }
        
        // Get random puzzle
        const count = await Puzzle.countDocuments(query);
        if (count === 0) { /* return 404 */ }

        // Dùng aggregate $sample để lấy ngẫu nhiên tối ưu hơn
        const randomPuzzles = await Puzzle.aggregate([
            { $match: query },
            { $sample: { size: 1 } }
        ]);

        const puzzle = randomPuzzles[0]; // Kết quả trả về là mảng
        
        // Don't send moves (solution) to frontend
        const puzzleData = {
            puzzleId: puzzle.puzzleId,
            fen: puzzle.fen,
            rating: puzzle.rating,
            themes: puzzle.themes,
            difficulty: puzzle.difficulty,
            popularity: puzzle.popularity,
            // THÊM DÒNG NÀY: Gửi nước đi đầu tiên (Blunder) để Frontend hiển thị
            initialMove: puzzle.moves[0] 
        };
        
        res.status(200).json({
            success: true,
            puzzle: puzzleData
        });
        
    } catch (error) {
        console.error('Get puzzle error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Verify puzzle move
// @route   POST /api/puzzles/verify
// @access  Private
exports.verifyMove = async (req, res) => {
    try {
        const { puzzleId, move, moveNumber } = req.body;
        
        const puzzle = await Puzzle.findOne({ puzzleId });
        if (!puzzle) {
            return res.status(404).json({
                success: false,
                message: 'Puzzle not found'
            });
        }
        
        // Check if move is correct
        const expectedMove = puzzle.moves[moveNumber];
        const isCorrect = move === expectedMove;

        // Move cuối cùng là move có index = moves.length - 1
        // Kiểm tra xem đã hết nước chưa
        const isComplete = moveNumber >= puzzle.moves.length - 1; 

        res.status(200).json({
            success: true,
            isCorrect,
            isComplete,
            // Nếu chưa xong, gửi nước tiếp theo của máy (index + 1)
            nextMove: isComplete ? null : puzzle.moves[moveNumber + 1]
        });
        
    } catch (error) {
        console.error('Verify move error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Submit completed puzzle
// @route   POST /api/puzzles/submit
// @access  Private
exports.submitPuzzle = async (req, res) => {
    try {
        const { puzzleId, solved, timeTaken, hintsUsed, attempts } = req.body;
        const userId = req.user.id;
        
        // Get puzzle
        const puzzle = await Puzzle.findOne({ puzzleId });
        if (!puzzle) {
            return res.status(404).json({
                success: false,
                message: 'Puzzle not found'
            });
        }
        
        // Update puzzle stats
        puzzle.nbPlays += 1;
        await puzzle.save();
        
        // Get or create user puzzle record
        let userPuzzle = await UserPuzzle.findOne({ userId });
        if (!userPuzzle) {
            userPuzzle = new UserPuzzle({ userId });
        }
        
        // Update attempts
        userPuzzle.puzzlesAttempted += 1;
        
        // Update statistics by difficulty
        const diffStats = userPuzzle.statistics.byDifficulty[puzzle.difficulty];
        diffStats.attempted += 1;
        
        // If solved
        if (solved) {
            userPuzzle.puzzlesSolved += 1;
            diffStats.solved += 1;
            
            // Update streak
            const today = new Date().toDateString();
            const lastDate = userPuzzle.streak.lastDate 
                ? new Date(userPuzzle.streak.lastDate).toDateString() 
                : null;
            
            if (lastDate === today) {
                // Same day, don't increment
            } else if (lastDate === new Date(Date.now() - 86400000).toDateString()) {
                // Yesterday, increment streak
                userPuzzle.streak.current += 1;
            } else {
                // Streak broken, reset
                userPuzzle.streak.current = 1;
            }
            
            userPuzzle.streak.lastDate = new Date();
            
            // Update longest streak
            if (userPuzzle.streak.current > userPuzzle.streak.longest) {
                userPuzzle.streak.longest = userPuzzle.streak.current;
            }
            
            // Update rating (simplified ELO)
            const K = 32; // K-factor
            const expectedScore = 1 / (1 + Math.pow(10, (puzzle.rating - userPuzzle.puzzleRating) / 400));
            const actualScore = 1;
            const ratingChange = Math.round(K * (actualScore - expectedScore));
            userPuzzle.puzzleRating += ratingChange;
            
            // Clamp rating between 500-3500
            userPuzzle.puzzleRating = Math.max(500, Math.min(3500, userPuzzle.puzzleRating));
        } else {
            // Failed - update rating down
            const K = 32;
            const expectedScore = 1 / (1 + Math.pow(10, (puzzle.rating - userPuzzle.puzzleRating) / 400));
            const actualScore = 0;
            const ratingChange = Math.round(K * (actualScore - expectedScore));
            userPuzzle.puzzleRating += ratingChange;
            userPuzzle.puzzleRating = Math.max(500, Math.min(3500, userPuzzle.puzzleRating));
            
            // Reset streak
            userPuzzle.streak.current = 0;
        }
        
        // Update theme statistics
        puzzle.themes.forEach(theme => {
            if (!userPuzzle.statistics.byTheme.has(theme)) {
                userPuzzle.statistics.byTheme.set(theme, { solved: 0, attempted: 0 });
            }
            const themeStats = userPuzzle.statistics.byTheme.get(theme);
            themeStats.attempted += 1;
            if (solved) themeStats.solved += 1;
        });
        
        // Add to solved puzzles history
        userPuzzle.solvedPuzzles.push({
            puzzleId,
            attempts,
            solved,
            timeTaken,
            hintsUsed,
            solvedAt: new Date()
        });
        
        // Keep only last 100 puzzles
        if (userPuzzle.solvedPuzzles.length > 100) {
            userPuzzle.solvedPuzzles = userPuzzle.solvedPuzzles.slice(-100);
        }
        
        userPuzzle.lastSolved = new Date();
        await userPuzzle.save();
        
        res.status(200).json({
            success: true,
            newRating: userPuzzle.puzzleRating,
            ratingChange: solved ? '+' : '',
            streak: userPuzzle.streak.current,
            stats: {
                puzzlesSolved: userPuzzle.puzzlesSolved,
                puzzlesAttempted: userPuzzle.puzzlesAttempted,
                successRate: ((userPuzzle.puzzlesSolved / userPuzzle.puzzlesAttempted) * 100).toFixed(1)
            }
        });
        
    } catch (error) {
        console.error('Submit puzzle error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Get user puzzle statistics
// @route   GET /api/puzzles/stats
// @access  Private
exports.getUserStats = async (req, res) => {
    try {
        const userId = req.user.id;
        
        let userPuzzle = await UserPuzzle.findOne({ userId });
        if (!userPuzzle) {
            return res.status(200).json({
                success: true,
                stats: {
                    puzzleRating: 1200,
                    puzzlesSolved: 0,
                    puzzlesAttempted: 0,
                    successRate: 0,
                    streak: { current: 0, longest: 0 },
                    byDifficulty: {
                        beginner: { solved: 0, attempted: 0, rate: 0 },
                        intermediate: { solved: 0, attempted: 0, rate: 0 },
                        advanced: { solved: 0, attempted: 0, rate: 0 },
                        expert: { solved: 0, attempted: 0, rate: 0 }
                    }
                }
            });
        }
        
        const successRate = userPuzzle.puzzlesAttempted > 0
            ? ((userPuzzle.puzzlesSolved / userPuzzle.puzzlesAttempted) * 100).toFixed(1)
            : 0;
        
        // Calculate rates by difficulty
        const byDifficulty = {};
        Object.keys(userPuzzle.statistics.byDifficulty).forEach(diff => {
            const stats = userPuzzle.statistics.byDifficulty[diff];
            byDifficulty[diff] = {
                solved: stats.solved,
                attempted: stats.attempted,
                rate: stats.attempted > 0 ? ((stats.solved / stats.attempted) * 100).toFixed(1) : 0
            };
        });
        
        res.status(200).json({
            success: true,
            stats: {
                puzzleRating: userPuzzle.puzzleRating,
                puzzlesSolved: userPuzzle.puzzlesSolved,
                puzzlesAttempted: userPuzzle.puzzlesAttempted,
                successRate,
                streak: userPuzzle.streak,
                byDifficulty
            }
        });
        
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Get puzzle leaderboard
// @route   GET /api/puzzles/leaderboard?limit=10
// @access  Public
exports.getLeaderboard = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        
        const topUsers = await UserPuzzle.find()
            .sort({ puzzleRating: -1, puzzlesSolved: -1 })
            .limit(limit)
            .populate('userId', 'username avatar');
        
        const leaderboard = topUsers.map((up, index) => ({
            rank: index + 1,
            username: up.userId.username,
            avatar: up.userId.avatar || '/assets/default-avatar.png',
            puzzleRating: up.puzzleRating,
            puzzlesSolved: up.puzzlesSolved,
            streak: up.streak.longest,
            successRate: up.puzzlesAttempted > 0 
                ? ((up.puzzlesSolved / up.puzzlesAttempted) * 100).toFixed(1) 
                : 0
        }));
        
        res.status(200).json({
            success: true,
            leaderboard
        });
        
    } catch (error) {
        console.error('Get leaderboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Get puzzle hint
// @route   GET /api/puzzles/:puzzleId/hint
// @access  Private
// Sửa lại hàm getHint trong puzzleController.js
exports.getHint = async (req, res) => {
    try {
        const { puzzleId } = req.params;
        // Lấy moveIndex từ query string (ví dụ: ?moveIndex=2)
        const moveIndex = parseInt(req.query.moveIndex) || 0; 
        
        const puzzle = await Puzzle.findOne({ puzzleId });
        if (!puzzle) {
            return res.status(404).json({ success: false, message: 'Puzzle not found' });
        }
        
        // Kiểm tra xem index có hợp lệ không
        if (moveIndex >= puzzle.moves.length) {
             return res.status(400).json({ success: false, message: 'No more moves' });
        }

        const moveString = puzzle.moves[moveIndex]; // Ví dụ: "e2e4"
        
        // Trả về gợi ý
        const hint = {
            from: moveString.substring(0, 2), // "e2"
            to: moveString.substring(2, 4)    // "e4"
        };
        
        res.status(200).json({
            success: true,
            hint
        });
        
    } catch (error) {
        console.error('Get hint error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};