// Firebase Login Handler with Enhanced UI and Loading Animation
class LoginHandler {
    constructor() {
        this.form = document.getElementById('loginForm');
        this.submitBtn = this.form.querySelector('button[type="submit"]');
        this.googleBtn = document.getElementById('googleSignInBtn');
        this.messageDiv = document.getElementById('loginMessage');
        this.isSubmitting = false;

        this.init();
    }

    init() {
        this.addEventListeners();
        this.setupGoogleSignIn();
        this.checkAuthState();
        this.createLoadingOverlay();
    }

    createLoadingOverlay() {
        // Create loading overlay with video
        const overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #000;
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        const video = document.createElement('video');
        video.id = 'loadingVideo';
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.style.cssText = `
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
        `;
        video.src = '../videos/loading.mp4';

        overlay.appendChild(video);
        document.body.appendChild(overlay);
    }

    showLoadingAnimation() {
        const overlay = document.getElementById('loadingOverlay');
        const video = document.getElementById('loadingVideo');

        overlay.style.display = 'flex';
        setTimeout(() => {
            overlay.style.opacity = '1';
        }, 10);

        // Play video
        video.play().catch(err => console.log('Video play error:', err));
    }

    addEventListeners() {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        this.googleBtn.addEventListener('click', (e) => this.handleGoogleSignIn(e));
    }

    setupGoogleSignIn() {
        this.provider = new firebase.auth.GoogleAuthProvider();
    }

    checkAuthState() {
        // Check if user is already logged in
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                // User is signed in, redirect to main page
                window.location.href = '../index.html';
            }
        });
    }

    async handleSubmit(e) {
        e.preventDefault();
        if (this.isSubmitting) return;

        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        if (!email || !password) {
            this.showMessage('Please fill in all fields', 'error');
            return;
        }

        this.isSubmitting = true;
        this.setLoading(true);

        try {
            await firebase.auth().signInWithEmailAndPassword(email, password);
            this.showMessage('Login successful!', 'success');

            // Show loading animation
            this.showLoadingAnimation();

            // Redirect after a delay to show the animation
            setTimeout(() => {
                window.location.href = '../index.html';
            }, 2000);
        } catch (error) {
            console.error('Login error:', error);
            this.showMessage(this.getErrorMessage(error.code), 'error');
            this.isSubmitting = false;
            this.setLoading(false);
        }
    }

    async handleGoogleSignIn(e) {
        e.preventDefault();
        this.setLoading(true, this.googleBtn);

        try {
            await firebase.auth().signInWithPopup(this.provider);
            this.showMessage('Google sign-in successful!', 'success');

            // Show loading animation
            this.showLoadingAnimation();

            // Redirect after a delay to show the animation
            setTimeout(() => {
                window.location.href = '../index.html';
            }, 2000);
        } catch (error) {
            console.error('Google sign-in error:', error);
            this.showMessage(this.getErrorMessage(error.code), 'error');
            this.setLoading(false, this.googleBtn);
        }
    }

    setLoading(loading, btn = this.submitBtn) {
        if (loading) {
            btn.disabled = true;
            btn.classList.add('loading');
            if (btn === this.submitBtn) {
                btn.querySelector('.btn-text').textContent = 'Signing in...';
            } else {
                btn.textContent = 'Connecting...';
            }
        } else {
            btn.disabled = false;
            btn.classList.remove('loading');
            if (btn === this.submitBtn) {
                btn.querySelector('.btn-text').textContent = 'Sign In';
            } else {
                // Restore Google button content
                btn.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                        <path d="M9.003 18c2.43 0 4.467-.806 5.956-2.18L12.05 13.56c-.806.54-1.836.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.96v2.332C2.44 15.983 5.485 18 9.003 18z" fill="#34A853"/>
                        <path d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.96H.957C.347 6.175 0 7.55 0 9.002c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                        <path d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9.003 0 5.485 0 2.44 2.017.96 4.958L3.967 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335"/>
                    </svg>
                    Continue with Google
                `;
            }
        }
    }

    showMessage(message, type) {
        this.messageDiv.textContent = message;
        this.messageDiv.className = `message ${type}`;
        this.messageDiv.style.display = 'block';

        setTimeout(() => {
            this.messageDiv.style.display = 'none';
        }, 5000);
    }

    getErrorMessage(code) {
        switch (code) {
            case 'auth/user-not-found':
                return 'No account found with this email.';
            case 'auth/wrong-password':
                return 'Incorrect password.';
            case 'auth/invalid-email':
                return 'Invalid email address.';
            case 'auth/user-disabled':
                return 'This account has been disabled.';
            case 'auth/too-many-requests':
                return 'Too many failed attempts. Please try again later.';
            case 'auth/popup-closed-by-user':
                return 'Sign-in popup was closed.';
            case 'auth/cancelled-popup-request':
                return 'Sign-in was cancelled.';
            case 'auth/invalid-credential':
                return 'Invalid email or password.';
            default:
                return 'An error occurred. Please try again.';
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new LoginHandler();
});