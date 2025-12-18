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
    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=d4af37&color=0f172a`;
    document.getElementById('profile-avatar').src = user.avatar || defaultAvatar;
    
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
    document.getElementById('stat-games').textContent = user.gamesPlayed || 0;
    document.getElementById('stat-won').textContent = user.gamesWon || 0;
    document.getElementById('stat-lost').textContent = user.gamesLost || 0;
    document.getElementById('stat-draw').textContent = user.gamesDraw || 0;
    
    // Calculate win rate if not provided
    let winRate = user.winRate;
    if (winRate === undefined || winRate === null) {
        const played = user.gamesPlayed || 0;
        const won = user.gamesWon || 0;
        winRate = played > 0 ? Math.round((won / played) * 100) : 0;
    }
    document.getElementById('stat-winrate').textContent = `${winRate}%`;
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
        
        // Tính rating sau trận = rating trước + ratingChange
        const ratingChange = myPlayer.ratingChange || 0;
        const ratingAfter = (myPlayer.rating || 1200) + ratingChange;
        
        // Tính rating sau trận của đối thủ
        const opponentRatingChange = opponent.ratingChange || 0;
        const opponentRatingAfter = (opponent.rating || 1200) + opponentRatingChange;
        
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
                        <span class="player-rating">(${ratingAfter})</span>
                    </div>
                    <span class="vs">vs</span>
                    <div class="player">
                        <span class="player-name">${opponent.username}</span>
                        <span class="player-rating">(${opponentRatingAfter})</span>
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
    
    // Update player info - names based on color (White at bottom, Black at top)
    const whiteName = game.whitePlayer?.username || game.white?.username || 'White';
    const blackName = game.blackPlayer?.username || game.black?.username || 'Black';
    const whiteAvatar = game.whitePlayer?.avatar || game.white?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(whiteName)}&background=d4af37&color=0f172a`;
    const blackAvatar = game.blackPlayer?.avatar || game.black?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(blackName)}&background=d4af37&color=0f172a`;
    
    // Bottom = White, Top = Black (standard chess view)
    document.getElementById('replay-player-name').textContent = whiteName;
    document.getElementById('replay-opponent-name').textContent = blackName;
    document.getElementById('replay-player-avatar').src = whiteAvatar;
    document.getElementById('replay-opponent-avatar').src = blackAvatar;
    
    // Initialize renderer if needed - responsive mode
    if (!replayRenderer) {
        try {
            replayRenderer = new ChessBoardRenderer('replay-canvas', { responsive: true });
            await replayRenderer.loadPieceImages();
            console.log('✅ Replay renderer initialized');
        } catch (error) {
            console.error('Failed to initialize replay renderer:', error);
            return;
        }
    }
    
    // Handle resize for responsive canvas
    handleReplayResize();
    
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

function handleReplayResize() {
    if (!replayRenderer) return;
    
    const boardSquare = document.querySelector('.replay-board-square');
    if (!boardSquare) return;
    
    const rect = boardSquare.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height);
    
    if (size < 50) {
        setTimeout(handleReplayResize, 100);
        return;
    }
    
    const dpr = window.devicePixelRatio || 1;
    const canvas = replayRenderer.canvas;
    
    // Set display size
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    
    // Set actual canvas resolution
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    
    // Scale context for DPR
    replayRenderer.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    
    // Update internal sizes
    replayRenderer.canvasSize = size;
    replayRenderer.squareSize = size / 8;
    
    replayRenderer.draw();
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
    document.getElementById('first-move').addEventListener('click', () => {
        if (currentMoveIndex > 0 && currentGameMoves[0] && window.Sound) {
            window.Sound.playMove(currentGameMoves[0]);
        }
        showReplayMove(0);
    });
    document.getElementById('prev-move').addEventListener('click', () => {
        if (currentMoveIndex > 0) {
            const move = currentGameMoves[currentMoveIndex - 1];
            if (move && window.Sound) window.Sound.playMove(move);
        }
        showReplayMove(currentMoveIndex - 1);
    });
    document.getElementById('next-move').addEventListener('click', () => {
        if (currentMoveIndex < currentGameMoves.length) {
            const move = currentGameMoves[currentMoveIndex];
            if (move && window.Sound) window.Sound.playMove(move);
        }
        showReplayMove(currentMoveIndex + 1);
    });
    document.getElementById('last-move').addEventListener('click', () => {
        if (currentMoveIndex < currentGameMoves.length && currentGameMoves[currentGameMoves.length - 1] && window.Sound) {
            window.Sound.playMove(currentGameMoves[currentGameMoves.length - 1]);
        }
        showReplayMove(currentGameMoves.length);
    });
    
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
        
        if (e.key === 'ArrowLeft') {
            if (currentMoveIndex > 0) {
                const move = currentGameMoves[currentMoveIndex - 1];
                if (move && window.Sound) window.Sound.playMove(move);
            }
            showReplayMove(currentMoveIndex - 1);
        }
        if (e.key === 'ArrowRight') {
            if (currentMoveIndex < currentGameMoves.length) {
                const move = currentGameMoves[currentMoveIndex];
                if (move && window.Sound) window.Sound.playMove(move);
            }
            showReplayMove(currentMoveIndex + 1);
        }
        if (e.key === 'Home') {
            if (currentMoveIndex > 0 && currentGameMoves[0] && window.Sound) {
                window.Sound.playMove(currentGameMoves[0]);
            }
            showReplayMove(0);
        }
        if (e.key === 'End') {
            if (currentMoveIndex < currentGameMoves.length && currentGameMoves[currentGameMoves.length - 1] && window.Sound) {
                window.Sound.playMove(currentGameMoves[currentGameMoves.length - 1]);
            }
            showReplayMove(currentGameMoves.length);
        }
        if (e.key === 'Escape') document.getElementById('replay-modal').classList.remove('active');
    });
    
    // Resize handler for responsive replay board
    let resizeTimeout;
    window.addEventListener('resize', () => {
        if (!document.getElementById('replay-modal').classList.contains('active')) return;
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => handleReplayResize(), 100);
    });
}