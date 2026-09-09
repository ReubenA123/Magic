// ============================================================================
// db/users.ts
//
// All direct reads/writes against the users table - the rest of the server
// goes through these functions rather than writing SQL inline, so the
// column layout (and the User/PublicUser shape) only has to change in one place.
// ============================================================================

import { randomBytes, randomUUID } from 'crypto';
import { db } from './connection';

export interface User {
  id: string;
  username: string;
  friendCode: string;
  passwordHash: string;
  email: string | null;
  avatarCardId: string | null;
  avatarCropX: number | null;
  avatarCropY: number | null;
  avatarCropZoom: number | null;
  createdAt: string;
}

/** What the rest of the app - and other users' clients - are allowed to see.
 * Notably excludes passwordHash and email (email is private recovery info,
 * not a public profile field). */
export interface PublicUser {
  id: string;
  username: string;
  friendCode: string;
  avatar: { cardId: string; x: number; y: number; zoom: number } | null;
}

interface UserRow {
  id: string;
  username: string;
  username_lower: string;
  friend_code: string;
  password_hash: string;
  email: string | null;
  avatar_card_id: string | null;
  avatar_crop_x: number | null;
  avatar_crop_y: number | null;
  avatar_crop_zoom: number | null;
  created_at: string;
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    friendCode: row.friend_code,
    passwordHash: row.password_hash,
    email: row.email,
    avatarCardId: row.avatar_card_id,
    avatarCropX: row.avatar_crop_x,
    avatarCropY: row.avatar_crop_y,
    avatarCropZoom: row.avatar_crop_zoom,
    createdAt: row.created_at,
  };
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    friendCode: user.friendCode,
    avatar:
      user.avatarCardId && user.avatarCropX !== null && user.avatarCropY !== null && user.avatarCropZoom !== null
        ? { cardId: user.avatarCardId, x: user.avatarCropX, y: user.avatarCropY, zoom: user.avatarCropZoom }
        : null,
  };
}

const FRIEND_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I - easy to misread aloud/by eye

function randomFriendCode(): string {
  const bytes = randomBytes(6);
  let code = '';
  for (const byte of bytes) code += FRIEND_CODE_ALPHABET[byte % FRIEND_CODE_ALPHABET.length];
  return code;
}

/** Friend codes are how people find each other precisely when usernames
 * collide or look alike (see the account-page spec) - collisions between
 * two random 6-character codes are astronomically unlikely, but this
 * retries rather than assuming that away entirely. */
function generateUniqueFriendCode(): string {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomFriendCode();
    const existing = db.prepare('SELECT 1 FROM users WHERE friend_code = ?').get(code);
    if (!existing) return code;
  }
  throw new Error('Could not generate a unique friend code after 10 attempts.');
}

export function findUserByUsername(username: string): User | null {
  const row = db.prepare('SELECT * FROM users WHERE username_lower = ?').get(username.toLowerCase()) as unknown as UserRow | undefined;
  return row ? rowToUser(row) : null;
}

export function findUserById(id: string): User | null {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as unknown as UserRow | undefined;
  return row ? rowToUser(row) : null;
}

export function findUserByFriendCode(friendCode: string): User | null {
  const row = db.prepare('SELECT * FROM users WHERE friend_code = ?').get(friendCode.toUpperCase()) as unknown as UserRow | undefined;
  return row ? rowToUser(row) : null;
}

export function createUser(username: string, passwordHash: string, email: string | null): User {
  const id = randomUUID();
  const friendCode = generateUniqueFriendCode();
  db.prepare(
    `INSERT INTO users (id, username, username_lower, friend_code, password_hash, email)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, username, username.toLowerCase(), friendCode, passwordHash, email);
  return findUserById(id)!;
}

export function setUserAvatar(userId: string, cardId: string, x: number, y: number, zoom: number): void {
  db.prepare('UPDATE users SET avatar_card_id = ?, avatar_crop_x = ?, avatar_crop_y = ?, avatar_crop_zoom = ? WHERE id = ?').run(
    cardId,
    x,
    y,
    zoom,
    userId,
  );
}

/** Search by username (substring, case-insensitive) or exact friend code -
 * how "add a friend" finds candidates. Capped at 20 results; this is a
 * lookup helper for a small hobby-scale user base, not a search engine. */
export function searchUsers(query: string, excludingUserId: string): PublicUser[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const rows = db
    .prepare(
      `SELECT * FROM users
       WHERE id != ? AND (username_lower LIKE ? OR friend_code = ?)
       LIMIT 20`,
    )
    .all(excludingUserId, `%${trimmed.toLowerCase()}%`, trimmed.toUpperCase()) as unknown as UserRow[];
  return rows.map((row) => toPublicUser(rowToUser(row)));
}
