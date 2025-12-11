// Backend/scripts/importPuzzles.js
const fs = require('fs');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const path = require('path');

// Load env từ thư mục gốc
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const Puzzle = require('../models/Puzzle');

// CẤU HÌNH GIỚI HẠN SỐ LƯỢNG
const IMPORT_LIMIT = 150000; 

// Kết nối MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err);
        process.exit(1);
    });

// Xác định độ khó
function getDifficulty(rating) {
    if (rating < 1200) return 'beginner';
    if (rating < 1600) return 'intermediate';
    if (rating < 2200) return 'advanced';
    return 'expert';
}

async function importPuzzles() {
    let count = 0;
    let skipped = 0;
    let errors = 0;
    const batchSize = 1000;
    let batch = [];
    let lineNumber = 0;

    console.log('🚀 Starting puzzle import...');
    console.log(`⚠️  LIMIT SET TO: ${IMPORT_LIMIT.toLocaleString()} puzzles\n`);

    // Đường dẫn file (tự động tìm trong folder Backend/data)
    const csvFilePath = path.join(__dirname, '..', 'data', 'lichess_db_puzzle.csv');

    if (!fs.existsSync(csvFilePath)) {
        console.error('❌ File not found:', csvFilePath);
        process.exit(1);
    }

    const startTime = Date.now();

    // Định nghĩa tên cột thủ công (vì file Lichess không có header)
    const LICHESS_HEADERS = [
        'PuzzleId', 'FEN', 'Moves', 'Rating', 'RatingDeviation', 
        'Popularity', 'NbPlays', 'Themes', 'GameUrl', 'OpeningTags'
    ];

    const stream = fs.createReadStream(csvFilePath)
        .pipe(csv({
            separator: ',',
            headers: LICHESS_HEADERS,
            skipLines: 0,
            strict: false
        }))
        .on('data', (row) => {
            // Nếu đã đủ số lượng (đang đợi batch cuối xử lý) thì không đọc thêm
            if (count >= IMPORT_LIMIT) return;

            lineNumber++;

            try {
                // Bỏ qua dòng tiêu đề nếu file lỡ có
                if (isNaN(row.Rating)) return;

                // Validate required fields
                if (!row.PuzzleId || !row.FEN || !row.Moves) {
                    errors++;
                    return;
                }

                const rating = parseInt(row.Rating);
                
                const movesStr = (row.Moves || '').trim();
                const moves = movesStr.split(/\s+/).filter(m => m.length > 0);
                if (moves.length === 0) return;

                let themes = [];
                if (row.Themes) {
                    themes = row.Themes.trim().split(/\s+/).filter(t => t.length > 0);
                }

                let gameUrl = '';
                if (row.GameUrl) {
                    gameUrl = row.GameUrl.trim().replace(/,\s*$/, '');
                }

                const puzzle = {
                    puzzleId: row.PuzzleId.trim(),
                    fen: row.FEN.trim(),
                    moves: moves,
                    rating: rating,
                    ratingDeviation: parseInt(row.RatingDeviation) || 0,
                    themes: themes,
                    difficulty: getDifficulty(rating),
                    popularity: parseInt(row.Popularity) || 0,
                    nbPlays: parseInt(row.NbPlays) || 0,
                    gameUrl: gameUrl
                };

                batch.push(puzzle);

                // Insert in batches
                if (batch.length >= batchSize) {
                    stream.pause(); // Tạm dừng đọc

                    Puzzle.insertMany(batch, { ordered: false })
                        .then(() => {
                            count += batch.length;
                            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                            const rate = (count / elapsed).toFixed(0);
                            process.stdout.write(`\r✅ Imported ${count.toLocaleString()} / ${IMPORT_LIMIT.toLocaleString()} puzzles... (${rate}/sec)`);

                            batch = [];

                            // --- KIỂM TRA GIỚI HẠN ---
                            if (count >= IMPORT_LIMIT) {
                                console.log('\n\n🛑 REACHED LIMIT! Stopping import.');
                                stream.destroy(); // Hủy stream đọc file
                                finishImport(count, skipped, errors, startTime);
                            } else {
                                stream.resume(); // Tiếp tục đọc nếu chưa đủ
                            }
                        })
                        .catch(error => {
                            if (error.code === 11000) {
                                const inserted = error.result ? error.result.nInserted : (batchSize - (error.writeErrors?.length || 0));
                                count += inserted;
                                skipped += (error.writeErrors?.length || 0);
                            } else {
                                console.error('\n❌ Batch Error:', error.message);
                            }
                            
                            batch = [];
                            
                            // Check limit cả trong trường hợp lỗi
                            if (count >= IMPORT_LIMIT) {
                                console.log('\n\n🛑 REACHED LIMIT (with errors)! Stopping.');
                                stream.destroy();
                                finishImport(count, skipped, errors, startTime);
                            } else {
                                stream.resume();
                            }
                        });
                }

            } catch (error) {
                errors++;
            }
        })
        .on('end', () => {
            // Trường hợp file hết trước khi đạt limit
            if (batch.length > 0 && count < IMPORT_LIMIT) {
                Puzzle.insertMany(batch, { ordered: false })
                    .then((res) => {
                        count += res.length;
                        finishImport(count, skipped, errors, startTime);
                    })
                    .catch(() => {
                        finishImport(count, skipped, errors, startTime);
                    });
            } else if (count < IMPORT_LIMIT) {
                finishImport(count, skipped, errors, startTime);
            }
        })
        .on('error', (error) => {
            console.error('\n❌ File read error:', error);
            mongoose.connection.close();
            process.exit(1);
        });
}

// Hàm tổng kết và thoát
function finishImport(count, skipped, errors, startTime) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(70));
    console.log(`   ✅ Successfully imported:  ${count.toLocaleString()} puzzles`);
    console.log(`   ⚠️  Skipped (duplicates):   ${skipped.toLocaleString()}`);
    console.log(`   ❌ Errors/Ignored:         ${errors.toLocaleString()}`);
    console.log(`   ⏱️  Duration:               ${duration}s`);
    console.log('='.repeat(70) + '\n');

    console.log('👋 Closing database connection...');
    mongoose.connection.close();
    process.exit(0);
}

importPuzzles();