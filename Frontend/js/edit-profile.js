document.addEventListener('DOMContentLoaded', () => {
    if (!requireAuth()) return;
    
    const user = getCurrentUser();
    if (!user) return;
    
    // Load current data
    document.getElementById('username').value = user.username;
    document.getElementById('avatar').value = user.avatar || '';
    
    // Handle profile update
    document.getElementById('editProfileForm').addEventListener('submit', handleProfileUpdate);
    
    // Handle password change
    document.getElementById('changePasswordForm').addEventListener('submit', handlePasswordChange);
});

async function handleProfileUpdate(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const avatar = document.getElementById('avatar').value.trim();
    const messageEl = document.getElementById('message');
    
    messageEl.textContent = 'Updating...';
    messageEl.className = 'message success';
    
    try {
        const response = await fetch('/api/users/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({ username, avatar })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            // Update localStorage
            localStorage.setItem('user', JSON.stringify(data.user));
            
            messageEl.textContent = 'Profile updated successfully!';
            messageEl.className = 'message success';
            
            setTimeout(() => {
                window.location.href = '/profile.html';
            }, 1500);
        } else {
            messageEl.textContent = data.message || 'Update failed';
            messageEl.className = 'message error';
        }
        
    } catch (error) {
        console.error('Update error:', error);
        messageEl.textContent = 'Network error';
        messageEl.className = 'message error';
    }
}

async function handlePasswordChange(e) {
    e.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;
    const messageEl = document.getElementById('passwordMessage');
    
    if (newPassword !== confirmNewPassword) {
        messageEl.textContent = 'Passwords do not match';
        messageEl.className = 'message error';
        return;
    }
    
    messageEl.textContent = 'Changing password...';
    messageEl.className = 'message success';
    
    try {
        const response = await fetch('/api/auth/password', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({ currentPassword, newPassword })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            messageEl.textContent = 'Password changed successfully!';
            messageEl.className = 'message success';
            document.getElementById('changePasswordForm').reset();
        } else {
            messageEl.textContent = data.message || 'Password change failed';
            messageEl.className = 'message error';
        }
        
    } catch (error) {
        console.error('Password change error:', error);
        messageEl.textContent = 'Network error';
        messageEl.className = 'message error';
    }
}

function showMessage(text, type, elementId = 'message') {
    const messageEl = document.getElementById(elementId);
    messageEl.textContent = text;
    messageEl.className = `message ${type}`;
}