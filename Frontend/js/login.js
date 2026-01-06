console.log('🔍 window.APP_CONFIG:', window.APP_CONFIG);
console.log('🔍 API_BASE:', window.APP_CONFIG?.API_BASE);
document.addEventListener('DOMContentLoaded', () => {
    // Redirect if already logged in
    redirectIfLoggedIn();
});
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const messageEl = document.getElementById('message');
    
    messageEl.textContent = '';
    messageEl.className = 'message';
    
    showMessage('Logging in...', 'success');
    
    try {
        const response = await fetch(`${window.APP_CONFIG.API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password }),
            credentials: 'include' // để browser nhận/gửi cookie cross-site
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showMessage('Login successful! Redirecting...', 'success');
            
            // Save token and user data
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('userId', data.user._id);
            // Redirect to home page after 1 second
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } else {
            showMessage(data.message || 'Login failed', 'error');
        }
        
    } catch (error) {
        console.error('Login error:', error);
        showMessage('Network error. Please try again.', 'error');
    }
});

function showMessage(text, type) {
    const messageEl = document.getElementById('message');
    messageEl.textContent = text;
    messageEl.className = `message ${type}`;
}