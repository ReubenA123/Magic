// ============================================================================
// context/AuthContext.tsx
//
// The one place that knows whether anyone's logged in - wraps the whole app
// (see App.tsx) so NavBar's account button, the account page, and anything
// else that cares can all read the same state via useAuth() instead of each
// re-implementing "am I logged in" against localStorage themselves.
// ============================================================================

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Account } from '../api/accountTypes';
import { fetchCurrentUser, login as apiLogin, logout as apiLogout, signup as apiSignup } from '../api/auth';
import { getToken, setToken } from '../api/rest';

interface AuthContextValue {
  user: Account | null;
  /** True only during the initial "is there a saved session?" check on
   * load - never true again after that resolves, so the UI can show a
   * neutral loading state for that one moment instead of flashing "logged
   * out" before a valid saved session has had a chance to restore. */
  restoring: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, password: string, email: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: Account) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Account | null>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setRestoring(false);
      return;
    }
    fetchCurrentUser()
      .then(setUser)
      .catch(() => setToken(null)) // saved token is expired/invalid - fall back to logged-out
      .finally(() => setRestoring(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setUser(await apiLogin(username, password));
  }, []);

  const signup = useCallback(async (username: string, password: string, email: string) => {
    setUser(await apiSignup(username, password, email));
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, restoring, login, signup, logout, setUser }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider.');
  return ctx;
}
