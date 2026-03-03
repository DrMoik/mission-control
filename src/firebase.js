import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your Firebase project config.
// To use a different project, replace these values with those from:
// Firebase Console → Project Settings → Your apps → SDK setup and configuration
const firebaseConfig = {
  apiKey: "AIzaSyDl3sTZH41JAdV2hJjf1LtaN0StBAD6Pog",
  authDomain: "quantum-robotics-48d7e.firebaseapp.com",
  projectId: "quantum-robotics-48d7e",
  storageBucket: "quantum-robotics-48d7e.firebasestorage.app",
  messagingSenderId: "501720395148",
  appId: "1:501720395148:web:902024b300a446f70afaa9",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
