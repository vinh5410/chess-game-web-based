/**
 * Component Loader - Tải và inject các components dùng chung
 */

class ComponentLoader {
    constructor() {
        this.loaded = {};
    }

    // Load navbar vào trang
    loadNavbar() {
        if (this.loaded.navbar) return;

        const navbarHTML = `
        <nav class="navbar">
            <div class="navbar-container">
                <a href="/" class="navbar-brand">
                    <i class="fa-solid fa-chess-king"></i> CHESSMATE
                </a>
                
                <ul class="navbar-menu">
                    <li><a href="/play-multiplayer.html"><i class="fa-solid fa-users"></i><span class="nav-text"> Multiplayer</span></a></li>
                    <li><a href="/play-vs-bot.html"><i class="fa-solid fa-robot"></i><span class="nav-text"> VS Bot</span></a></li>
                    <li><a href="/puzzles.html"><i class="fa-solid fa-puzzle-piece"></i><span class="nav-text"> Puzzles</span></a></li>
                    <li><a href="/leaderboard.html"><i class="fa-solid fa-trophy"></i><span class="nav-text"> Rankings</span></a></li>
                </ul>
                
                <div class="navbar-actions">
                    <div id="auth-buttons" class="dropdown">
                        <div class="auth-icon-trigger">
                            <i class="fa-solid fa-circle-user"></i>
                        </div>
                        <div class="auth-buttons-desktop">
                            <a href="/login.html" class="btn btn-secondary">Log In</a>
                            <a href="/register.html" class="btn btn-primary">Sign Up</a>
                        </div>
                        <div class="dropdown-menu auth-dropdown">
                            <a href="/login.html" class="dropdown-item"><i class="fa-solid fa-right-to-bracket"></i> Log In</a>
                            <a href="/register.html" class="dropdown-item"><i class="fa-solid fa-user-plus"></i> Sign Up</a>
                        </div>
                    </div>
                    
                    <div id="user-menu">
                        <div class="dropdown">
                            <div class="user-info">
                                <img id="user-avatar" src="https://ui-avatars.com/api/?name=User" alt="Avatar" class="user-avatar">
                                <span id="username-display" class="username">User</span>
                                <i class="fa-solid fa-chevron-down"></i>
                            </div>
                            <div class="dropdown-menu">
                                <a href="/profile.html" class="dropdown-item"><i class="fa-regular fa-user"></i> My Profile</a>
                                <a href="/edit-profile.html" class="dropdown-item"><i class="fa-solid fa-gear"></i> Settings</a>
                                <div class="dropdown-divider"></div>
                                <a href="#" id="logout-btn" class="dropdown-item text-danger"><i class="fa-solid fa-right-from-bracket"></i> Logout</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
        `;

        const placeholder = document.getElementById('navbar-placeholder');
        if (placeholder) {
            placeholder.outerHTML = navbarHTML;
        } else {
            // Insert after background elements if they exist
            const bgBlur = document.querySelector('.bg-blur');
            if (bgBlur) {
                bgBlur.insertAdjacentHTML('afterend', navbarHTML);
            } else {
                document.body.insertAdjacentHTML('afterbegin', navbarHTML);
            }
        }

        this.loaded.navbar = true;
    }

    // Load background gradient
    loadBackground() {
        if (this.loaded.background) return;

        if (!document.querySelector('.bg-gradient')) {
            document.body.insertAdjacentHTML('afterbegin', `
                <div class="bg-gradient"></div>
                <div class="bg-blur"></div>
            `);
        }

        this.loaded.background = true;
    }

    // Load game replay modal
    loadReplayModal() {
        if (this.loaded.replayModal) return;
        if (document.getElementById('replay-modal')) return;

        const replayModalHTML = `
        <div class="replay-modal" id="replay-modal">
            <div class="replay-container">
                <div class="replay-header">
                    <h3><i class="fa-solid fa-chess"></i> Game Replay</h3>
                    <button class="close-modal" id="close-replay">&times;</button>
                </div>
                
                <div class="replay-board-wrapper">
                    <div class="replay-player-info player-top">
                        <img class="player-avatar" id="replay-opponent-avatar" src="https://ui-avatars.com/api/?name=O&background=d4af37&color=0f172a" alt="Avatar">
                        <div class="player-details">
                            <span class="player-name" id="replay-opponent-name">Opponent</span>
                        </div>
                    </div>
                    
                    <div class="replay-board-square">
                        <canvas id="replay-canvas" width="400" height="400"></canvas>
                    </div>
                    
                    <div class="replay-player-info player-bottom">
                        <img class="player-avatar" id="replay-player-avatar" src="https://ui-avatars.com/api/?name=Y&background=d4af37&color=0f172a" alt="Avatar">
                        <div class="player-details">
                            <span class="player-name" id="replay-player-name">You</span>
                        </div>
                    </div>
                </div>
                
                <div class="replay-controls">
                    <button id="first-move"><i class="fa-solid fa-backward-fast"></i></button>
                    <button id="prev-move"><i class="fa-solid fa-backward-step"></i></button>
                    <span class="move-info" id="move-info">Starting Position</span>
                    <button id="next-move"><i class="fa-solid fa-forward-step"></i></button>
                    <button id="last-move"><i class="fa-solid fa-forward-fast"></i></button>
                </div>
            </div>
        </div>
        `;

        document.body.insertAdjacentHTML('beforeend', replayModalHTML);
        this.loaded.replayModal = true;
    }

    // Load all common components
    loadAll() {
        this.loadBackground();
        this.loadNavbar();
    }
}

// Create global instance
window.Components = new ComponentLoader();

// Auto-load navbar immediately if placeholder exists
// This runs synchronously when script is loaded
(function() {
    const placeholder = document.getElementById('navbar-placeholder');
    if (placeholder) {
        window.Components.loadNavbar();
    }
})();

// Also try on DOMContentLoaded as fallback
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('navbar-placeholder') && !window.Components.loaded.navbar) {
        window.Components.loadNavbar();
    }
});
