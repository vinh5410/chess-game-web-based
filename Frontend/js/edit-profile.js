document.addEventListener('DOMContentLoaded', () => {
    if (!requireAuth()) return;
    
    const user = getCurrentUser();
    if (!user) return;
    
    // Load current data
    document.getElementById('username').value = user.username;
    document.getElementById('avatar').value = user.avatar || '';
    
    // Set avatar URL input if it's a URL (not base64)
    const avatarUrlInput = document.getElementById('avatarUrl');
    if (avatarUrlInput && user.avatar && !user.avatar.startsWith('data:')) {
        avatarUrlInput.value = user.avatar;
    }
    
    // Update avatar preview
    const avatarPreview = document.getElementById('avatar-preview-img');
    const previewUsername = document.getElementById('preview-username');
    const previewEmail = document.getElementById('preview-email');
    
    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=d4af37&color=0f172a`;
    
    if (avatarPreview) {
        avatarPreview.src = user.avatar || defaultAvatar;
    }
    if (previewUsername) previewUsername.textContent = user.username;
    if (previewEmail) previewEmail.textContent = user.email || '';
    
    // Update avatar preview when URL changes
    if (avatarUrlInput) {
        avatarUrlInput.addEventListener('input', (e) => {
            const url = e.target.value.trim();
            if (url) {
                document.getElementById('avatar').value = url;
                if (avatarPreview) {
                    avatarPreview.src = url;
                }
            }
        });
    }
    
    // Handle file upload
    document.getElementById('avatarFile').addEventListener('change', handleAvatarUpload);
    
    // Handle remove avatar
    const removeBtn = document.getElementById('removeAvatarBtn');
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            document.getElementById('avatar').value = '';
            if (avatarUrlInput) avatarUrlInput.value = '';
            if (avatarPreview) {
                avatarPreview.src = defaultAvatar;
            }
        });
    }
    
    // Handle profile update
    document.getElementById('editProfileForm').addEventListener('submit', handleProfileUpdate);
    
    // Handle password change
    document.getElementById('changePasswordForm').addEventListener('submit', handlePasswordChange);
});

function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB');
        return;
    }
    
    // Compress and resize image
    compressImage(file, 200, 0.8).then(compressedBase64 => {
        // Update preview
        const avatarPreview = document.getElementById('avatar-preview-img');
        if (avatarPreview) {
            avatarPreview.src = compressedBase64;
        }
        
        // Update hidden input field
        document.getElementById('avatar').value = compressedBase64;
        
        // Clear URL input since we're using uploaded image
        const avatarUrlInput = document.getElementById('avatarUrl');
        if (avatarUrlInput) {
            avatarUrlInput.value = '';
        }
    });
}

// Compress image to smaller size for avatar
function compressImage(file, maxSize = 200, quality = 0.8) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                
                // Calculate new dimensions (square crop for avatar)
                let width = img.width;
                let height = img.height;
                let startX = 0;
                let startY = 0;
                
                // Crop to square from center
                if (width > height) {
                    startX = (width - height) / 2;
                    width = height;
                } else {
                    startY = (height - width) / 2;
                    height = width;
                }
                
                // Set canvas size
                canvas.width = maxSize;
                canvas.height = maxSize;
                
                const ctx = canvas.getContext('2d');
                
                // Draw cropped and resized image
                ctx.drawImage(img, startX, startY, width, height, 0, 0, maxSize, maxSize);
                
                // Convert to compressed base64
                const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
                resolve(compressedBase64);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const avatar = document.getElementById('avatar').value.trim();
    const messageEl = document.getElementById('message');
    
    messageEl.textContent = 'Updating...';
    messageEl.className = 'message success';
    
    try {
        // using API config
        const apiBase = window.APP_CONFIG?.API_BASE || 'http://localhost:3000';
        const response = await fetch(`${apiBase}/api/users/profile`, {
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
        // using API config
        const apiBase = window.APP_CONFIG?.API_BASE || 'http://localhost:3000';
        const response = await fetch(`${apiBase}/api/auth/password`, {
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