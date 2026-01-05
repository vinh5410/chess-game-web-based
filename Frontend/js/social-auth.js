// Google Login Handler
async function handleCredentialResponse(response) {
    try {
        const res = await fetch(`${window.APP_CONFIG.API_BASE}/api/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: response.credential })
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

// Facebook Login Setup
window.fbAsyncInit = function() {
    FB.init({
      appId      : '1279869883978594',
      cookie     : true,
      xfbml      : true,
      version    : 'v18.0'
    });
};

function fbLogin() {
    FB.login(function(response) {
        if (response.authResponse) {
            FB.api('/me', {fields: 'name, email, picture'}, async function(profile) {
                try {
                    const res = await fetch(`${window.APP_CONFIG.API_BASE}/api/auth/facebook`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userID: profile.id,
                            accessToken: response.authResponse.accessToken,
                            email: profile.email,
                            name: profile.name,
                            picture: profile.picture
                        })
                    });
                    const data = await res.json();
                    if (data.success) {
                        localStorage.setItem('token', data.token);
                        localStorage.setItem('user', JSON.stringify(data.user));
                        window.location.href = 'index.html';
                    } else {
                         if (typeof showMessage === 'function') {
                            showMessage(data.message, 'error');
                        } else {
                            alert(data.message);
                        }
                    }
                } catch (error) {
                    console.error('FB Login Error:', error);
                }
            });
        }
    }, {scope: 'public_profile,email'});
}