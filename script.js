// Main page authentication and user management
firebase.auth().onAuthStateChanged((user) => {
    if (!user) {
        // No user is signed in, redirect to login
        window.location.href = './auth/login.html';
    } else {
        // User is signed in
        console.log('User logged in:', user.email);



        // Setup logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                try {
                    await firebase.auth().signOut();
                    window.location.href = './auth/login.html';
                } catch (error) {
                    console.error('Logout error:', error);
                    alert('Error logging out. Please try again.');
                }
            });
        }
    }
});
