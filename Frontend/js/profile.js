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
});

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
    document.getElementById('profile-avatar').src = user.avatar;
    document.getElementById('profile-username').textContent = user.username;
    document.getElementById('profile-email').textContent = user.email;
    document.getElementById('profile-rating').textContent = `⭐ ${user.rating}`;
    document.getElementById('profile-status').textContent = user.isOnline ? '🟢 Online' : '⚪ Offline';
    
    const joinedDate = new Date(user.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    document.getElementById('profile-joined').textContent = `📅 Joined: ${joinedDate}`;
    
    // Stats
    document.getElementById('stat-games').textContent = user.gamesPlayed;
    document.getElementById('stat-won').textContent = user.gamesWon;
    document.getElementById('stat-lost').textContent = user.gamesLost;
    document.getElementById('stat-draw').textContent = user.gamesDraw;
    document.getElementById('stat-winrate').textContent = `${user.winRate}%`;
}