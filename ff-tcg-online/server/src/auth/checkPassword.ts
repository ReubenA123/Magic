// ============================================================================
// auth/checkPassword.ts
//
// The whole "auth system" for this project: one shared password, set via the
// GAME_PASSWORD environment variable (see .env.example), that both you and
// your brother type in on the login screen. There are no user accounts -
// that's intentional, since this is built for exactly two known people, not
// public sign-ups. See socket/index.ts for where this gets called.
// ============================================================================

export function checkPassword(candidate: unknown): boolean {
  const expected = process.env.GAME_PASSWORD;
  if (!expected) {
    // Fail closed: if the server operator forgot to set a password, refuse
    // every connection rather than silently running unprotected.
    console.error('GAME_PASSWORD is not set - refusing all connections. See server/.env.example.');
    return false;
  }
  return typeof candidate === 'string' && candidate === expected;
}
