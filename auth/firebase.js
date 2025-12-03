// Firebase configuration (replace with your actual config)
const firebaseConfig = {
  apiKey: "AIzaSyDF6DnQ15g2EeyVW-ifGJagr18XlUWpTZk",
  authDomain: "agrisense-7e8ba.firebaseapp.com",
  projectId: "agrisense-7e8ba",
  storageBucket: "agrisense-7e8ba.firebasestorage.app",
  messagingSenderId: "1029238587073",
  appId: "1:1029238587073:web:23ca56a7ee1e35cc7e9e40",
  measurementId: "G-KL6YC59WL2"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Auth
const auth = firebase.auth();

// Initialize Firestore (if needed)
const db = firebase.firestore();
