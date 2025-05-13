// Check if user is authenticated
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// Protect routes
function protectRoute() {
    if (!checkAuth()) {
        return;
    }
}

// Logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

// Get current user
function getCurrentUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}

// Display user info in dashboard
function displayUserInfo() {
    const user = getCurrentUser();
    if (user && document.getElementById('userName')) {
        document.getElementById('userName').textContent = user.name;
    }
}

// Initialize auth functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on a protected page
    if (!window.location.pathname.includes('login.html') && 
        !window.location.pathname.includes('register.html')) {
        protectRoute();
        displayUserInfo();
    }

    // Add logout event listeners
    const logoutButtons = document.querySelectorAll('.logout-btn');
    logoutButtons.forEach(button => {
        button.addEventListener('click', logout);
    });
});