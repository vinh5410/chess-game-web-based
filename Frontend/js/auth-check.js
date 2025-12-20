// Get auth data from localStorage
function getAuthData() {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (!token || !userStr) {
        return { isLoggedIn: false, user: null, token: null };
    }
    
    try {
        const user = JSON.parse(userStr);
        return { isLoggedIn: true, user, token };
    } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('user');
        return { isLoggedIn: false, user: null, token: null };
    }
}

// Check if user is logged in
function isLoggedIn() {
    const { isLoggedIn } = getAuthData();
    return isLoggedIn;
}

// Get current user
function getCurrentUser() {
    const { user } = getAuthData();
    return user;
}

// Get auth token
function getAuthToken() {
    const { token } = getAuthData();
    return token;
}

// Logout function
function logout() {
    // Call logout API
    fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${getAuthToken()}`
        }
    }).catch(err => console.error('Logout error:', err));
    
    // Clear localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Redirect to login
    window.location.href = '/login.html';
}

// Require authentication (redirect if not logged in)
function requireAuth() {
    if (!isLoggedIn()) {
        window.location.href = '/login.html';
        return false;
    }
    return true;
}

// Redirect to home if already logged in (for login/register pages)
function redirectIfLoggedIn() {
    if (isLoggedIn()) {
        window.location.href = '/index.html';
    }
}

// Update navbar based on auth status
function updateNavbar() {
    const { isLoggedIn, user } = getAuthData();
    
    const authButtons = document.getElementById('auth-buttons');
    const userMenu = document.getElementById('user-menu');
    const usernameDisplay = document.getElementById('username-display');
    const userAvatar = document.getElementById('user-avatar');
    
    if (isLoggedIn && user) {
        // Hide login/register buttons
        if (authButtons) authButtons.style.display = 'none';
        
        // Show user menu
        if (userMenu) userMenu.style.display = 'flex';
        if (usernameDisplay) usernameDisplay.textContent = user.username;
        
        // Set avatar with fallback to default
        if (userAvatar) {
            const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=d4af37&color=0f172a`;
            userAvatar.src = user.avatar || defaultAvatar;
        }
    } else {
        // Show login/register buttons
        if (authButtons) authButtons.style.display = 'flex';
        
        // Hide user menu
        if (userMenu) userMenu.style.display = 'none';
    }
}

// Initialize auth on page load
document.addEventListener('DOMContentLoaded', () => {
    updateNavbar();
    
    // Logout button handler
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
    
    // Dropdown toggle for mobile/desktop
    const userInfo = document.querySelector('.user-info');
    const dropdown = document.querySelector('.dropdown');
    const dropdownMenu = document.querySelector('.dropdown-menu');
    
    if (userInfo && dropdownMenu) {
        // Click handler for mobile
        userInfo.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // On mobile (width <= 768px), toggle show class
            if (window.innerWidth <= 768) {
                dropdownMenu.classList.toggle('show');
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown')) {
                dropdownMenu.classList.remove('show');
            }
        });
        
        // Prevent dropdown from closing when clicking inside menu
        dropdownMenu.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Desktop: Keep dropdown open when hovering
        if (dropdown) {
            let hoverTimeout;
            
            dropdown.addEventListener('mouseenter', () => {
                clearTimeout(hoverTimeout);
                if (window.innerWidth > 768) {
                    dropdownMenu.style.display = 'block';
                    setTimeout(() => {
                        dropdownMenu.style.opacity = '1';
                        dropdownMenu.style.transform = 'translateY(0)';
                        dropdownMenu.style.pointerEvents = 'auto';
                    }, 10);
                }
            });
            
            dropdown.addEventListener('mouseleave', () => {
                if (window.innerWidth > 768) {
                    hoverTimeout = setTimeout(() => {
                        dropdownMenu.style.opacity = '0';
                        dropdownMenu.style.transform = 'translateY(-10px)';
                        dropdownMenu.style.pointerEvents = 'none';
                        setTimeout(() => {
                            dropdownMenu.style.display = 'none';
                        }, 200);
                    }, 100); // 100ms delay before closing
                }
            });
            
            // Keep menu open when hovering over it
            dropdownMenu.addEventListener('mouseenter', () => {
                clearTimeout(hoverTimeout);
            });
            
            dropdownMenu.addEventListener('mouseleave', () => {
                if (window.innerWidth > 768) {
                    hoverTimeout = setTimeout(() => {
                        dropdownMenu.style.opacity = '0';
                        dropdownMenu.style.transform = 'translateY(-10px)';
                        dropdownMenu.style.pointerEvents = 'none';
                        setTimeout(() => {
                            dropdownMenu.style.display = 'none';
                        }, 200);
                    }, 100);
                }
            });
        }
    }
    
    // Auth icon trigger for mobile (when not logged in)
    const authIconTrigger = document.querySelector('.auth-icon-trigger');
    const authDropdown = document.querySelector('.auth-dropdown');
    
    if (authIconTrigger && authDropdown) {
        console.log('Auth icon trigger found, setting up click handler');
        authIconTrigger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (window.innerWidth <= 768) {
                console.log('Auth icon clicked, toggling dropdown');
                authDropdown.classList.toggle('show');
            }
        });
        
        // Close auth dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#auth-buttons')) {
                authDropdown.classList.remove('show');
            }
        });
        // Hide dropdown if resizing to desktop
        const syncAuthDropdown = () => {
            if (window.innerWidth > 768) {
                authDropdown.classList.remove('show');
            }
        };
        syncAuthDropdown();
        window.addEventListener('resize', () => {
            // lightweight debounce via requestAnimationFrame
            window.requestAnimationFrame(syncAuthDropdown);
        });

    } else {
        console.log('Auth elements not found:', { authIconTrigger, authDropdown });
    }
});