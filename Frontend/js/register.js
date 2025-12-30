document.addEventListener('DOMContentLoaded', () => {
    
    redirectIfLoggedIn();
});

// EXISTING REGISTER FORM HANDLER
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const messageEl = document.getElementById('message');
    
    messageEl.textContent = '';
    messageEl.className = 'message';
    
    
    if (!username || !email || !password || !confirmPassword) {
        messageEl.textContent = 'Please fill in all fields';
        messageEl.className = 'message error';
        return;
    }
    
    if (username.length < 3) {
        messageEl.textContent = 'Username must be at least 3 characters';
        messageEl.className = 'message error';
        return;
    }
    
    if (password.length < 6) {
        messageEl.textContent = 'Password must be at least 6 characters';
        messageEl.className = 'message error';
        return;
    }
    
    if (password !== confirmPassword) {
        messageEl.textContent = 'Passwords do not match';
        messageEl.className = 'message error';
        return;
    }
    
    messageEl.textContent = 'Creating account...';
    messageEl.className = 'message success';
    
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            // Save to localStorage
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('userId', data.user._id);
            messageEl.textContent = 'Registration successful! Redirecting...';
            messageEl.className = 'message success';
            
            // Redirect to home
            setTimeout(() => {
                window.location.href = '/index.html';
            }, 1000);
            
        } else {
            messageEl.textContent = data.message || 'Registration failed';
            messageEl.className = 'message error';
        }
        
    } catch (error) {
        console.error('Register error:', error);
        messageEl.textContent = 'Network error. Please try again.';
        messageEl.className = 'message error';
    }
});