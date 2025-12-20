document.addEventListener('DOMContentLoaded', async () => {
    // Require authentication
    if (!requireAuth()) return;
    
    const user = getCurrentUser();
    if (!user) {
        window.location.href = '/login.html';
        return;
    }
    
    // Load profile data
    await loadProfile(user.id);
    
    // Load match history
    await loadHistory(user.id, user.username);
    
    // Setup replay controls
    setupReplayControls();
});

let replayRenderer = null;
let currentGameMoves = [];
let currentMoveIndex = 0;

async function loadProfile(userId) {
    try {
        const response = await fetch(`/api/users/profile/${userId}`, {
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            displayProfile(data.user);
        } else {
            alert(data.message || 'Failed to load profile');
        }
        
    } catch (error) {
        console.error('Load profile error:', error);
        alert('Error loading profile');
    }
}

function displayProfile(user) {
    // Profile header
    document.getElementById('profile-avatar').src = user.avatar;
    
    // Set username and title
    const usernameEl = document.getElementById('profile-username');
    const titleEl = document.getElementById('player-title');
    usernameEl.innerHTML = `${user.username} <span id="player-title" class="player-title">${getTitle(user.rating)}</span>`;
    
    document.getElementById('profile-email').textContent = user.email;
    document.getElementById('profile-rating').textContent = user.rating;
    
    const statusEl = document.getElementById('profile-status');
    if (user.isOnline) {
        statusEl.innerHTML = '<i class="fa-solid fa-circle" style="color: #4ade80;"></i> Online';
    } else {
        statusEl.innerHTML = '<i class="fa-solid fa-circle" style="color: #94a3b8;"></i> Offline';
    }
    
    const joinedDate = new Date(user.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    document.getElementById('profile-joined').innerHTML = `<i class="fa-solid fa-calendar"></i> Joined: ${joinedDate}`;
    
    // Stats
    document.getElementById('stat-games').textContent = user.gamesPlayed;
    document.getElementById('stat-won').textContent = user.gamesWon;
    document.getElementById('stat-lost').textContent = user.gamesLost;
    document.getElementById('stat-draw').textContent = user.gamesDraw;
    document.getElementById('stat-winrate').textContent = `${user.winRate}%`;
}

function getTitle(rating) {
    if (rating >= 2400) return 'Grandmaster';
    if (rating >= 2200) return 'Master';
    if (rating >= 2000) return 'Expert';
    if (rating >= 1800) return 'Class A';
    if (rating >= 1600) return 'Class B';
    if (rating >= 1400) return 'Class C';
    if (rating >= 1200) return 'Intermediate';
    return 'Beginner';
}

// Match History Functions
async function loadHistory(userId, username) {
    const body = document.getElementById('history-body');
    
    try {
        const response = await fetch(`/api/history/user/${userId}`);
        const data = await response.json();
        
        if (data.success && data.games && data.games.length > 0) {
            renderHistory(data.games, username);
        } else {
            body.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-chess-board"></i>
                    <h3>No games yet</h3>
                    <p>Start playing to build your match history!</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading history:', error);
        body.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-exclamation-triangle"></i>
                <h3>Failed to load history</h3>
                <p>Please try again later</p>
            </div>
        `;
    }
}

function renderHistory(games, currentUsername) {
    const body = document.getElementById('history-body');
    
    // Sort games by date descending (newest first)
    const sortedGames = [...games].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    body.innerHTML = `<div class="history-list">${sortedGames.map(game => {
        const isWhite = game.whitePlayer.username.toLowerCase() === currentUsername.toLowerCase();
        const opponent = isWhite ? game.blackPlayer : game.whitePlayer;
        const myPlayer = isWhite ? game.whitePlayer : game.blackPlayer;
        
        let result = 'draw';
        let resultText = 'DRAW';
        // Support both formats: 'white-win'/'black-win'/'draw' and '1-0'/'0-1'/'1/2-1/2'
        if (game.result === 'white-win' || game.result === '1-0') {
            result = isWhite ? 'win' : 'loss';
            resultText = isWhite ? 'WIN' : 'LOSS';
        } else if (game.result === 'black-win' || game.result === '0-1') {
            result = isWhite ? 'loss' : 'win';
            resultText = isWhite ? 'LOSS' : 'WIN';
        }
        
        // Calculate final ratings
        const myInitialRating = myPlayer.rating || 1200;
        const myRatingChange = myPlayer.ratingChange || 0;
        const myFinalRating = myInitialRating + myRatingChange;

        const oppInitialRating = opponent.rating || 1200;
        const oppRatingChange = opponent.ratingChange || 0;
        const oppFinalRating = oppInitialRating + oppRatingChange;

        
        // Use startedAt, endedAt, or createdAt (whichever is available)
        const gameDate = game.startedAt || game.endedAt || game.createdAt;
        let date = 'Unknown';
        if (gameDate) {
            const dateObj = new Date(gameDate);
            if (!isNaN(dateObj.getTime())) {
                date = dateObj.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                });
            }
        }
        
        return `
            <div class="history-item" onclick="viewGameReplay('${game._id}')">
                <div class="history-players">
                    <div class="player">
                        <span class="player-name">${currentUsername}</span>
                        <span class="player-rating">(${myFinalRating})</span>
                    </div>
                    <span class="vs">vs</span>
                    <div class="player">
                        <span class="player-name">${opponent.username}</span>
                        <span class="player-rating">(${oppFinalRating})</span>
                    </div>
                </div>
                <span class="history-result ${result}">${resultText}</span>
                <span class="history-date">${date}</span>
            </div>
        `;
    }).join('')}</div>`;
}

// Game Replay Functions
async function viewGameReplay(gameId) {
    try {
        const response = await fetch(`/api/history/game/${gameId}`);
        const data = await response.json();
        
        if (data.success && data.game) {
            openReplayModal(data.game);
        } else {
            alert('Failed to load game');
        }
    } catch (error) {
        console.error('Error loading game:', error);
        alert('Error loading game replay');
    }
}

async function openReplayModal(game) {
    const modal = document.getElementById('replay-modal');
    modal.classList.add('active');
    
    // Wait a tick for modal to become visible before initializing renderer
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Initialize renderer if needed
    if (!replayRenderer) {
        try {
            replayRenderer = new ChessBoardRenderer('replay-canvas', { fixedSize: 400 });
            await replayRenderer.loadPieceImages();
            console.log('✅ Replay renderer initialized');
        } catch (error) {
            console.error('Failed to initialize replay renderer:', error);
            return;
        }
    } else {
        // Re-calculate size in case modal was resized
        replayRenderer.handleResize();
    }
    
    // Flatten moves
    currentGameMoves = [];
    if (game.moves && game.moves.length > 0) {
        for (const movePair of game.moves) {
            if (movePair.white && movePair.white.san) currentGameMoves.push(movePair.white);
            if (movePair.black && movePair.black.san) currentGameMoves.push(movePair.black);
        }
    }
    currentMoveIndex = 0;
    
    showReplayMove(0);
}

function showReplayMove(index) {
    if (!replayRenderer) return;
    
    currentMoveIndex = Math.max(0, Math.min(index, currentGameMoves.length));
    
    // Reset game to starting position
    replayRenderer.game.reset();
    replayRenderer.clearSelection();
    
    // Replay moves up to current index
    for (let i = 0; i < currentMoveIndex; i++) {
        const move = currentGameMoves[i];
        if (move && move.from && move.to) {
            try {
                replayRenderer.game.move({ from: move.from, to: move.to, promotion: move.promotion });
            } catch (e) {
                console.warn('Invalid move in replay:', move, e);
            }
        }
    }
    
    replayRenderer.draw();
    
    const moveInfo = document.getElementById('move-info');
    moveInfo.textContent = currentMoveIndex === 0 
        ? 'Starting Position' 
        : `Move ${currentMoveIndex} / ${currentGameMoves.length}`;
    
    // Update button states
    document.getElementById('first-move').disabled = currentMoveIndex === 0;
    document.getElementById('prev-move').disabled = currentMoveIndex === 0;
    document.getElementById('next-move').disabled = currentMoveIndex === currentGameMoves.length;
    document.getElementById('last-move').disabled = currentMoveIndex === currentGameMoves.length;
}

function setupReplayControls() {
    document.getElementById('first-move').addEventListener('click', () => showReplayMove(0));
    document.getElementById('prev-move').addEventListener('click', () => showReplayMove(currentMoveIndex - 1));
    document.getElementById('next-move').addEventListener('click', () => showReplayMove(currentMoveIndex + 1));
    document.getElementById('last-move').addEventListener('click', () => showReplayMove(currentGameMoves.length));
    
    document.getElementById('close-replay').addEventListener('click', () => {
        document.getElementById('replay-modal').classList.remove('active');
    });
    
    // Close modal on outside click
    document.getElementById('replay-modal').addEventListener('click', (e) => {
        if (e.target.id === 'replay-modal') {
            document.getElementById('replay-modal').classList.remove('active');
        }
    });
    
    // Keyboard navigation for replay
    document.addEventListener('keydown', (e) => {
        if (!document.getElementById('replay-modal').classList.contains('active')) return;
        
        if (e.key === 'ArrowLeft') showReplayMove(currentMoveIndex - 1);
        if (e.key === 'ArrowRight') showReplayMove(currentMoveIndex + 1);
        if (e.key === 'Home') showReplayMove(0);
        if (e.key === 'End') showReplayMove(currentGameMoves.length);
        if (e.key === 'Escape') document.getElementById('replay-modal').classList.remove('active');
    });
}