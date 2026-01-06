// Google Login Handler
async function handleCredentialResponse(response) {
    try {
        const res = await fetch(`${window.APP_CONFIG.API_BASE}/api/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: response.credential }),
            credentials: 'include'
        });
        const data = await res.json();
        if (data.success) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            window.location.href = 'index.html';
        } else {
            // Try to show message if showMessage function exists (from other scripts)
            if (typeof showMessage === 'function') {
                showMessage(data.message, 'error');
            } else {
                alert(data.message);
            }
        }
    } catch (error) {
        console.error('Google Login Error:', error);
    }
}


