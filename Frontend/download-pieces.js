const https = require('https');
const fs = require('fs');
const path = require('path');

// Sử dụng PNG từ lichess hoặc chess.com
const pieces = {
    'wK': 'wK',
    'wQ': 'wQ',
    'wR': 'wR',
    'wB': 'wB',
    'wN': 'wN',
    'wP': 'wP',
    'bK': 'bK',
    'bQ': 'bQ',
    'bR': 'bR',
    'bB': 'bB',
    'bN': 'bN',
    'bP': 'bP'
};

const assetsDir = path.join(__dirname, 'assets', 'pieces');

// Create directory if not exists
if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
}

function downloadPiece(piece) {
    return new Promise((resolve, reject) => {
        // Sử dụng PNG từ chessboardjs.com
        const url = `https://chessboardjs.com/img/chesspieces/wikipedia/${piece}.png`;
        const filePath = path.join(assetsDir, `${piece}.png`);
        
        console.log(`Downloading ${piece}.png...`);
        
        const file = fs.createWriteStream(filePath);
        
        https.get(url, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    console.log(`✅ Downloaded ${piece}.png`);
                    resolve();
                });
            } else {
                fs.unlink(filePath, () => {});
                console.error(`❌ Failed to download ${piece}: HTTP ${response.statusCode}`);
                reject(new Error(`HTTP ${response.statusCode}`));
            }
        }).on('error', (err) => {
            fs.unlink(filePath, () => {});
            console.error(`❌ Failed to download ${piece}:`, err.message);
            reject(err);
        });
    });
}

async function downloadAllPieces() {
    console.log('📥 Downloading chess pieces from chessboardjs.com...\n');
    
    for (const piece of Object.keys(pieces)) {
        try {
            await downloadPiece(piece);
        } catch (error) {
            console.error(`Error downloading ${piece}`);
        }
    }
    
    console.log('\n✅ All pieces downloaded!');
    console.log(`📁 Files saved to: ${assetsDir}`);
}

downloadAllPieces();