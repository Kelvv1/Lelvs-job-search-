import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut, User } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { UserProfile } from '../types.ts';

interface AuthContextValue {
  firebaseUser: User | null;
  dbUser: UserProfile | null;
  loading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [dbUser, setDbUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const authFetch = useCallback(
    async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken();
        headers.set('Authorization', `Bearer ${token}`);
      }
      if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
        headers.set('Content-Type', 'application/json');
      }
      return fetch(input, { ...init, headers });
    },
    []
  );

  const refreshProfile = useCallback(async () => {
    if (!auth.currentUser) {
      setDbUser(null);
      return;
    }
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch('/api/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { user: UserProfile };
        setDbUser(data.user);
      }
    } catch (err) {
      console.error('Failed to load user profile:', err);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await refreshProfile();
      } else {
        setDbUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [refreshProfile]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unable to complete sign-in. Please try again.';
      setAuthError(message);
    }
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    setDbUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        dbUser,
        loading,
        authError,
        signInWithGoogle,
        signOut,
        refreshProfile,
        authFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
