// ============================================================================
// api/auth.ts
//
// Thin wrappers over the /auth endpoints - see context/AuthContext.tsx for
// where these actually get called from and how the session is kept around.
// ============================================================================

import { api, setToken } from './rest';
import { Account } from './accountTypes';

interface AuthResponse {
  token: string;
  user: Account;
}

export async function signup(username: string, password: string, email: string): Promise<Account> {
  const res = await api.post<AuthResponse>('/auth/signup', { username, password, email: email || undefined });
  setToken(res.token);
  return res.user;
}

export async function login(username: string, password: string): Promise<Account> {
  const res = await api.post<AuthResponse>('/auth/login', { username, password });
  setToken(res.token);
  return res.user;
}

export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } finally {
    // Clear the local token even if the network call fails (server already
    // unreachable, token already expired) - there's no scenario where
    // staying "logged in" locally after asking to log out is the right call.
    setToken(null);
  }
}

export async function fetchCurrentUser(): Promise<Account> {
  const res = await api.get<{ user: Account }>('/auth/me');
  return res.user;
}

export async function setAvatar(cardId: string, x: number, y: number, zoom: number): Promise<Account> {
  const res = await api.put<{ user: Account }>('/auth/me/avatar', { cardId, x, y, zoom });
  return res.user;
}
