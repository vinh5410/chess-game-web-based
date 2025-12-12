// Initialize navbar functionality
document.addEventListener('DOMContentLoaded', () => {
    updateNavbarState();
    setupLogoutHandler();
});

// Update navbar based on login state
function updateNavbarState() {
    const user = getCurrentUser();
    const authButtons = document.getElementById('auth-buttons');
    const userMenu = document.getElementById('user-menu');
    
    if (user && authButtons && userMenu) {
        // User is logged in
        authButtons.style.display = 'none';
        userMenu.style.display = 'block';
        
        // Update user info
        const userAvatar = document.getElementById('user-avatar');
        const usernameDisplay = document.getElementById('username-display');
        
        if (userAvatar) {
            userAvatar.src = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=random&size=128`;
        }
        if (usernameDisplay) {
            usernameDisplay.textContent = user.username || 'User';
        }
    } else {
        // User is NOT logged in
        if (authButtons) authButtons.style.display = 'flex';
        if (userMenu) userMenu.style.display = 'none';
    }
}

// Setup logout button handler
function setupLogoutHandler() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
}

// Get current user from localStorage
function getCurrentUser() {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    
    try {
        return JSON.parse(userStr);
    } catch (error) {
        console.error('Error parsing user data:', error);
        return null;
    }
}

// Logout user
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Redirect to home page
    window.location.href = '/index.html';
}

// Update navbar when page visibility changes (when user returns to tab)
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        updateNavbarState();
    }
});
