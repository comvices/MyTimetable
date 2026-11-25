import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch, getAuthToken, setAuthToken } from '../lib/api';
import { AuthSessionUser } from '../types/saas';

interface BootstrapStatusResponse {
  needsAdminSetup: boolean;
  adminUsername: string;
}

interface AuthResponse {
  token: string;
  user: AuthSessionUser;
}

interface AuthContextValue {
  currentUser: AuthSessionUser | null;
  userProfile: AuthSessionUser | null;
  authReady: boolean;
  isSuperAdmin: boolean;
  needsAdminSetup: boolean;
  adminUsername: string;
  loginWithUsername: (username: string, password: string) => Promise<AuthSessionUser>;
  setupInitialAdmin: (
    username: string,
    password: string,
    displayName?: string
  ) => Promise<AuthSessionUser>;
  signUpWithUsername: (
    username: string,
    password: string,
    displayName: string,
    email?: string
  ) => Promise<AuthSessionUser>;
  refreshProfile: () => Promise<void>;
  refreshBootstrapStatus: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthSessionUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [needsAdminSetup, setNeedsAdminSetup] = useState(false);
  const [adminUsername, setAdminUsername] = useState('admin');

  const refreshBootstrapStatus = useCallback(async () => {
    try {
      const status = await apiFetch<BootstrapStatusResponse>('/api/auth/bootstrap-status');
      setNeedsAdminSetup(Boolean(status.needsAdminSetup));
      if (status.adminUsername) {
        setAdminUsername(status.adminUsername);
      }
    } catch {
      // Ignore network hiccup on initial check
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refreshBootstrapStatus();
      const token = getAuthToken();
      if (token) {
        try {
          const data = await apiFetch<{ user: AuthSessionUser }>('/api/auth/me');
          if (!cancelled) {
            setCurrentUser(data.user);
          }
        } catch {
          setAuthToken(null);
          if (!cancelled) setCurrentUser(null);
        }
      }
      if (!cancelled) {
        setAuthReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshBootstrapStatus]);

  const loginWithUsername = async (username: string, password: string): Promise<AuthSessionUser> => {
    const data = await apiFetch<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: username.trim(), password }),
    });
    setAuthToken(data.token);
    setCurrentUser(data.user);
    setAuthReady(true);
    return data.user;
  };

  const setupInitialAdmin = async (
    username: string,
    password: string,
    displayName?: string
  ): Promise<AuthSessionUser> => {
    const data = await apiFetch<AuthResponse>('/api/auth/setup-admin', {
      method: 'POST',
      body: JSON.stringify({
        username: username.trim(),
        password,
        displayName: displayName?.trim(),
      }),
    });
    setAuthToken(data.token);
    setCurrentUser(data.user);
    setNeedsAdminSetup(false);
    setAuthReady(true);
    return data.user;
  };

  const signUpWithUsername = async (
    username: string,
    password: string,
    displayName: string,
    email?: string
  ): Promise<AuthSessionUser> => {
    const data = await apiFetch<AuthResponse>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        username: username.trim(),
        password,
        displayName: displayName.trim(),
        email: email?.trim(),
      }),
    });
    setAuthToken(data.token);
    setCurrentUser(data.user);
    setAuthReady(true);
    return data.user;
  };

  const refreshProfile = async () => {
    if (!getAuthToken()) return;
    try {
      const data = await apiFetch<{ user: AuthSessionUser }>('/api/auth/me');
      setCurrentUser(data.user);
    } catch {
      setAuthToken(null);
      setCurrentUser(null);
    }
  };

  const signOut = async () => {
    setAuthToken(null);
    setCurrentUser(null);
  };

  const isSuperAdmin = currentUser?.role === 'super_admin';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile: currentUser,
        authReady,
        isSuperAdmin,
        needsAdminSetup,
        adminUsername,
        loginWithUsername,
        setupInitialAdmin,
        signUpWithUsername,
        refreshProfile,
        refreshBootstrapStatus,
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
