// Firebase Authentication for Signup
// Handles email/password signup and Google signup

class SignupForm {
    constructor() {
        this.form = document.getElementById('signupForm');
        this.submitBtn = this.form.querySelector('button[type="submit"]');
        this.googleBtn = document.getElementById('googleSignUpBtn');
        this.messageDiv = document.getElementById('signupMessage');
        this.isSubmitting = false;

        this.init();
    }

    init() {
        this.addEventListeners();
        this.setupGoogleSignUp();
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

    checkAuthState() {
        // Check if user is already logged in
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                // User is signed in, redirect to main page
                window.location.href = '../index.html';
            }
        });
    }

    addEventListeners() {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        this.googleBtn.addEventListener('click', (e) => this.handleGoogleSignUp(e));
    }

    setupGoogleSignUp() {
        this.provider = new firebase.auth.GoogleAuthProvider();
    }

    async handleSubmit(e) {
        e.preventDefault();
        if (this.isSubmitting) return;

        const name = document.getElementById('signupName').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('signupConfirmPassword').value;

        if (!name || !email || !password || !confirmPassword) {
            this.showMessage('Please fill in all fields', 'error');
            return;
        }

        if (password !== confirmPassword) {
            this.showMessage('Passwords do not match', 'error');
            return;
        }

        if (password.length < 6) {
            this.showMessage('Password should be at least 6 characters', 'error');
            return;
        }

        this.isSubmitting = true;
        this.setLoading(true);

        try {
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            // Update display name
            await userCredential.user.updateProfile({
                displayName: name
            });
            this.showMessage('Account created successfully!', 'success');
            setTimeout(() => {
                window.location.href = 'login.html'; // Redirect to login
            }, 2000);
        } catch (error) {
            this.showMessage(this.getErrorMessage(error.code), 'error');
        } finally {
            this.isSubmitting = false;
            this.setLoading(false);
        }
    }

    async handleGoogleSignUp(e) {
        e.preventDefault();
        this.setLoading(true, this.googleBtn);

        try {
            await firebase.auth().signInWithPopup(this.provider);
            this.showMessage('Google sign-up successful!', 'success');

            // Show loading animation
            this.showLoadingAnimation();

            setTimeout(() => {
                window.location.href = '../index.html';
            }, 2000);
        } catch (error) {
            this.showMessage(this.getErrorMessage(error.code), 'error');
        } finally {
            this.setLoading(false, this.googleBtn);
        }
    }

    setLoading(loading, btn = this.submitBtn) {
        if (loading) {
            btn.disabled = true;
            btn.textContent = 'Loading...';
        } else {
            btn.disabled = false;
            btn.textContent = btn === this.submitBtn ? 'Sign Up' : 'Sign up with Google';
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
            case 'auth/email-already-in-use':
                return 'An account with this email already exists.';
            case 'auth/invalid-email':
                return 'Invalid email address.';
            case 'auth/weak-password':
                return 'Password is too weak.';
            case 'auth/operation-not-allowed':
                return 'Operation not allowed.';
            default:
                return 'An error occurred. Please try again.';
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SignupForm();
});
