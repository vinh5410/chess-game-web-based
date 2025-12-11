// Frontend/js/game-history.js

const API_URL = 'http://localhost:3000/api';
let currentPage = 1;
let currentFilter = 'all';
let totalPages = 1;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadNavbar();
    
    const user = getCurrentUser();
    if (!user) {
        window.location.href = '/login.html';
        return;
    }
    
    setupEventListeners();
    await loadUserStats(user.id);
    await loadGameHistory(user.id);
});

function setupEventListeners() {
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            currentFilter = e.target.dataset.type;
            currentPage = 1;
            
            const user = getCurrentUser();
            await loadGameHistory(user.id);
        });
    });
}

async function loadUserStats(userId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/game-history/stats/${userId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            const stats = result.data;
            document.getElementById('totalGames').textContent = stats.totalGames || 0;
            document.getElementById('wins').textContent = stats.wins || 0;
            document.getElementById('draws').textContent = stats.draws || 0;
            document.getElementById('losses').textContent = stats.losses || 0;
            document.getElementById('winRate').textContent = 
                stats.totalGames > 0 ? `${stats.winRate.toFixed(1)}%` : '0%';
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadGameHistory(userId, page = 1) {
    const gamesList = document.getElementById('gamesList');
    gamesList.innerHTML = '<div class="loading">Loading games...</div>';
    
    try {
        const token = localStorage.getItem('token');
        let url = `${API_URL}/game-history/user/${userId}?page=${page}&limit=10`;
        
        if (currentFilter !== 'all') {
            url += `&gameType=${currentFilter}`;
        }
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            displayGames(result.data, userId);
            totalPages = result.totalPages;
            currentPage = result.currentPage;
            updatePagination();
        } else {
            gamesList.innerHTML = '<div class="empty-state"><h2>No games found</h2><p>Start playing to see your game history!</p></div>';
        }
    } catch (error) {
        console.error('Error loading games:', error);
        gamesList.innerHTML = '<div class="empty-state"><h2>Error loading games</h2><p>Please try again later.</p></div>';
    }
}

function displayGames(games, userId) {
    const gamesList = document.getElementById('gamesList');
    
    if (games.length === 0) {
        gamesList.innerHTML = '<div class="empty-state"><h2>No games found</h2><p>Start playing to see your game history!</p></div>';
        return;
    }
    
    gamesList.innerHTML = games.map(game => {
        const isWhite = game.whitePlayer.userId === userId;
        const isWinner = (isWhite && game.result === 'white-win') || 
                        (!isWhite && game.result === 'black-win');
        const isDraw = game.result === 'draw';
        
        const resultText = isDraw ? 'Draw' : (isWinner ? 'Victory' : 'Defeat');
        const resultClass = isDraw ? 'draw' : (isWinner ? 'win' : 'loss');
        
        const date = new Date(game.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        return `
            <div class="game-card" data-game-id="${game._id}">
                <div class="game-info">
                    <div class="game-header">
                        <span class="game-type ${game.gameType}">${game.gameType === 'pvp' ? '⚔️ PvP' : '🤖 vs Bot'}</span>
                        <span class="game-date">📅 ${date}</span>
                    </div>
                    
                    <div class="game-players">
                        <div class="player ${game.result === 'white-win' ? 'winner' : ''}">
                            ♔ ${game.whitePlayer.username}
                            ${game.whitePlayer.rating ? `(${game.whitePlayer.rating})` : ''}
                        </div>
                        <span class="vs-text">vs</span>
                        <div class="player ${game.result === 'black-win' ? 'winner' : ''}">
                            ♚ ${game.blackPlayer.username}
                            ${game.blackPlayer.rating ? `(${game.blackPlayer.rating})` : ''}
                        </div>
                    </div>
                    
                    <div class="game-meta">
                        <span>⏱️ ${formatDuration(game.duration)}</span>
                        <span>📊 ${game.moves?.length || 0} moves</span>
                        <span>🏁 ${getTerminationText(game.terminationReason)}</span>
                    </div>
                </div>
                
                <div class="game-result">
                    <span class="result-badge ${resultClass}">${resultText}</span>
                    <div class="game-actions">
                        <button class="btn btn-primary" onclick="viewGame('${game._id}')">
                            👁️ View
                        </button>
                        <button class="btn btn-secondary" onclick="downloadPGN('${game._id}')">
                            📥 PGN
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function formatDuration(seconds) {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
}

function getTerminationText(reason) {
    const texts = {
        'checkmate': 'Checkmate',
        'resignation': 'Resignation',
        'timeout': 'Timeout',
        'draw-agreement': 'Draw Agreement',
        'stalemate': 'Stalemate',
        'insufficient-material': 'Insufficient Material',
        'threefold-repetition': 'Threefold Repetition',
        'fifty-move-rule': '50-Move Rule'
    };
    return texts[reason] || 'Game Over';
}

function updatePagination() {
    const pagination = document.getElementById('pagination');
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let html = `
        <button class="page-btn" onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
            ◀ Previous
        </button>
        <span class="page-info">Page ${currentPage} of ${totalPages}</span>
        <button class="page-btn" onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
            Next ▶
        </button>
    `;
    
    pagination.innerHTML = html;
}

async function changePage(page) {
    if (page < 1 || page > totalPages) return;
    
    const user = getCurrentUser();
    await loadGameHistory(user.id, page);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function viewGame(gameId) {
    window.location.href = `/game-replay.html?id=${gameId}`;
}

async function downloadPGN(gameId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/game-history/${gameId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            const pgn = result.data.pgn;
            const blob = new Blob([pgn], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `game_${gameId}.pgn`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }
    } catch (error) {
        console.error('Error downloading PGN:', error);
        alert('Failed to download PGN');
    }
}