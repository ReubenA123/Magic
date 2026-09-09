// ============================================================================
// auth/passwords.ts
//
// Password hashing via Node's built-in crypto.scrypt - no extra dependency
// needed (unlike bcrypt/argon2, which require a native module). scrypt is a
// well-regarded, deliberately slow key-derivation function, which is exactly
// what you want for password storage: it makes brute-forcing a stolen hash
// far more expensive than a fast general-purpose hash like SHA-256 would.
//
// Stored format is "<saltHex>:<hashHex>" in a single string, so verifying
// later doesn't need a separate salt column.
// ============================================================================

import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const KEY_LENGTH = 64;

export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(plain, salt, KEY_LENGTH);
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(plain, salt, KEY_LENGTH);
  // timingSafeEqual throws if the buffers differ in length, which a
  // corrupted/foreign hash could trigger - that's still "not a match",
  // just via an exception instead of returning false directly.
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
