// ============================================================================
// auth/session.ts
//
// Sessions are opaque random tokens stored server-side (in the sessions
// table), not signed JWTs - a bit more storage work, but it means a session
// can actually be revoked (logout, or a future "log out everywhere" /ban
// feature) by just deleting the row, instead of having to wait out a JWT's
// expiry or maintain a separate blocklist.
//
// The client sends the token back as `Authorization: Bearer <token>` (see
// requireAuth below) - kept out of cookies entirely so there's no
// cross-origin cookie/CORS-credentials configuration to get right between
// the Vite dev server and this API.
// ============================================================================

import { randomBytes } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { db } from '../db/connection';
import { findUserById, User } from '../db/users';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function createSession(userId: string): string {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);
  return token;
}

export function deleteSession(token: string): void {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

/** Null if the token doesn't exist or has expired - an expired row is
 * deleted on the way out rather than left to accumulate. */
export function resolveSession(token: string): User | null {
  const row = db.prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?').get(token) as unknown as { user_id: string; expires_at: string } | undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return findUserById(row.user_id);
}

export interface AuthedRequest extends Request {
  user?: User;
}

/** Express middleware for any route that needs a logged-in user - attaches
 * the resolved User to req.user, or responds 401 itself so route handlers
 * never have to check "is there a user?" before using req.user. */
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  if (!token) {
    res.status(401).json({ error: 'Not logged in.' });
    return;
  }
  const user = resolveSession(token);
  if (!user) {
    res.status(401).json({ error: 'Session expired or invalid - please log in again.' });
    return;
  }
  req.user = user;
  next();
}
