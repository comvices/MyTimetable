import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import { OperationType, handleFirestoreError } from '../lib/firestoreError';
import { AuthSessionUser, SUPER_ADMIN_EMAIL, UserAccount } from '../types/saas';

interface AuthContextValue {
  firebaseUser: User | null;
  currentUser: AuthSessionUser | null;
  userProfile: UserAccount | null;
  authReady: boolean;
  isSuperAdmin: boolean;
  signInWithGoogle: () => Promise<AuthSessionUser>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toSessionUser(profile: UserAccount): AuthSessionUser {
  return {
    uid: profile.uid,
    email: profile.email,
    displayName: profile.displayName,
    username: profile.email.split('@')[0] || profile.uid,
    role: profile.role,
    schoolId: profile.schoolId,
    schoolSlug: profile.schoolSlug,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserAccount | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const syncUserProfile = useCallback(async (fbUser: User): Promise<UserAccount> => {
    const email = (fbUser.email || '').trim();
    const isRootEmail =
      email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() && fbUser.emailVerified;

    let adminExists = false;
    const adminRef = doc(db, 'admins', fbUser.uid);
    try {
      const adminSnap = await getDoc(adminRef);
      adminExists = adminSnap.exists();
      if (isRootEmail && !adminExists) {
        await setDoc(adminRef, {
          uid: fbUser.uid,
          email: email || SUPER_ADMIN_EMAIL,
          createdAt: serverTimestamp(),
        });
        adminExists = true;
      }
    } catch (err) {
      if (!isRootEmail) {
        // Non-admin reading own /admins/{uid} doc that doesn't exist is allowed, ignore transient error
        adminExists = false;
      } else {
        handleFirestoreError(err, OperationType.WRITE, `admins/${fbUser.uid}`);
      }
    }

    const effectiveSuperAdmin = (isRootEmail || adminExists) && fbUser.emailVerified;
    setIsSuperAdmin(effectiveSuperAdmin);

    const userRef = doc(db, 'users', fbUser.uid);
    let userSnap;
    try {
      userSnap = await getDoc(userRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `users/${fbUser.uid}`);
    }

    const safeDisplayName = (
      fbUser.displayName ||
      email.split('@')[0] ||
      'ผู้ใช้งานระบบ'
    ).slice(0, 150);

    if (!userSnap.exists()) {
      const payload = {
        uid: fbUser.uid,
        email: (email || `${fbUser.uid}@users.local`).slice(0, 200),
        displayName: safeDisplayName,
        role: effectiveSuperAdmin ? ('super_admin' as const) : ('school_admin' as const),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      try {
        await setDoc(userRef, payload);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${fbUser.uid}`);
      }
      const createdSnap = await getDoc(userRef);
      const createdData = createdSnap.data() as UserAccount;
      setUserProfile(createdData);
      return createdData;
    }

    const existingData = userSnap.data() as UserAccount;
    if (effectiveSuperAdmin && existingData.role !== 'super_admin') {
      try {
        await updateDoc(userRef, {
          role: 'super_admin',
          updatedAt: serverTimestamp(),
        });
        existingData.role = 'super_admin';
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${fbUser.uid}`);
      }
    }

    setUserProfile(existingData);
    return existingData;
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (!fbUser) {
        setUserProfile(null);
        setIsSuperAdmin(false);
        setAuthReady(true);
        return;
      }

      try {
        await syncUserProfile(fbUser);
      } catch (err) {
        console.error('Failed to synchronize user profile:', err);
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, [syncUserProfile]);

  const signInWithGoogle = async (): Promise<AuthSessionUser> => {
    const credential = await signInWithPopup(auth, googleProvider);
    const profile = await syncUserProfile(credential.user);
    setFirebaseUser(credential.user);
    setAuthReady(true);
    return toSessionUser(profile);
  };

  const refreshProfile = async () => {
    if (!auth.currentUser) return;
    await syncUserProfile(auth.currentUser);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setFirebaseUser(null);
    setUserProfile(null);
    setIsSuperAdmin(false);
  };

  const currentUser = userProfile ? toSessionUser(userProfile) : null;

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        currentUser,
        userProfile,
        authReady,
        isSuperAdmin,
        signInWithGoogle,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
