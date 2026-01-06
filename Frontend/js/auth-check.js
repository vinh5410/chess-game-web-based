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

function isLoggedIn() {
    const { isLoggedIn } = getAuthData();
    return isLoggedIn;
}

function getCurrentUser() {
    const { user } = getAuthData();
    return user;
}

function getAuthToken() {
    const { token } = getAuthData();
    return token;
}

function logout() {
    fetch(`${window.APP_CONFIG.API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${getAuthToken()}`
        },
        credentials: 'include'
    }).catch(err => console.error('Logout error:', err));
    
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
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
        if (authButtons) authButtons.style.display = 'none';
        if (userMenu) userMenu.style.display = 'flex';
        if (usernameDisplay) usernameDisplay.textContent = user.username;
        if (userAvatar) {
            const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=d4af37&color=0f172a`;
            userAvatar.src = user.avatar || defaultAvatar;
        }
    } else {
        if (authButtons) authButtons.style.display = 'flex';
        if (userMenu) userMenu.style.display = 'none';
    }
}

// Initialize auth on page load
document.addEventListener('DOMContentLoaded', () => {
    updateNavbar();
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
    
    const userInfo = document.querySelector('.user-info');
    const dropdown = document.querySelector('.dropdown');
    const dropdownMenu = document.querySelector('.dropdown-menu');
    
    if (userInfo && dropdownMenu) {
        userInfo.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.innerWidth <= 768) {
                dropdownMenu.classList.toggle('show');
            }
        });
        
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown')) {
                dropdownMenu.classList.remove('show');
            }
        });
        
        dropdownMenu.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
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
                    }, 100);
                }
            });
            
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
    } else {
        console.log('Auth elements not found:', { authIconTrigger: userInfo, dropdownMenu });
    }

    const authIconTrigger = document.querySelector('.auth-icon-trigger');
    const authDropdown = document.querySelector('.auth-dropdown');
    
    if (authIconTrigger && authDropdown) {
        authIconTrigger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (window.innerWidth <= 768) {
                authDropdown.classList.toggle('show');
            }
        });
        
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#auth-buttons')) {
                authDropdown.classList.remove('show');
            }
        });
        const syncAuthDropdown = () => {
            if (window.innerWidth > 768) {
                authDropdown.classList.remove('show');
            }
        };
        syncAuthDropdown();
        window.addEventListener('resize', () => {
            window.requestAnimationFrame(syncAuthDropdown);
        });
    } else {
        console.log('Auth elements not found:', { authIconTrigger, authDropdown });
    }
});