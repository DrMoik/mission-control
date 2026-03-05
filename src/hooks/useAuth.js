// ─── useAuth ─────────────────────────────────────────────────────────────────
// Firebase Auth state + user profile document subscription.
// Creates user doc on first sign-in; subscribes to live profile updates.

import { useState, useEffect, useRef } from 'react';
import { auth, db, googleProvider } from '../firebase.js';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';

/**
 * @param {{ onSignOut?: () => void }} options
 * @returns {{ authUser: object | null, authLoading: boolean, userProfile: object | null, handleGoogleSignIn: () => Promise<void>, handleSignOut: () => void }}
 */
export function useAuth(options = {}) {
  const { onSignOut = () => {} } = options;

  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);

  const profileUnsubRef = useRef(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (profileUnsubRef.current) {
        profileUnsubRef.current();
        profileUnsubRef.current = null;
      }
      setAuthUser(user);
      if (user) {
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          await setDoc(ref, {
            uid: user.uid,
            displayName: user.displayName || user.email,
            email: user.email,
            photoURL: user.photoURL || null,
            platformRole: 'user',
            createdAt: serverTimestamp(),
          });
        }
        profileUnsubRef.current = onSnapshot(ref, (s) => {
          if (s.exists()) setUserProfile(s.data());
        });
      } else {
        setUserProfile(null);
        onSignOut();
      }
      setAuthLoading(false);
    });
  }, [onSignOut]);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') alert(e.message);
    }
  };

  const handleSignOut = () => {
    signOut(auth);
    onSignOut();
  };

  return { authUser, authLoading, userProfile, handleGoogleSignIn, handleSignOut };
}
