// ============================================================================
// routes/auth.ts
//
// Signup, login, logout, and "who am I" - the whole account-creation and
// session lifecycle. Deck and friend routes live in their own files (see
// routes/) once those land; this one is just identity.
// ============================================================================

import { Router } from 'express';
import { checkUsername } from '../auth/usernamePolicy';
import { hashPassword, verifyPassword } from '../auth/passwords';
import { createSession, deleteSession, requireAuth, AuthedRequest } from '../auth/session';
import { createUser, findUserById, findUserByUsername, setUserAvatar, toPublicUser } from '../db/users';
import { CARD_POOL } from '../data/cards';

const router = Router();

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

router.post('/signup', (req, res) => {
  const { username, password, email } = req.body ?? {};

  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const usernameCheck = checkUsername(username);
  if (!usernameCheck.ok) {
    return res.status(400).json({ error: usernameCheck.reason });
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
  }

  // Optional: an empty string from an untouched form field counts as "not
  // provided", same as omitting the field entirely - only reject a value
  // that was actually typed in and doesn't look like an email.
  let normalizedEmail: string | null = null;
  if (typeof email === 'string' && email.trim() !== '') {
    if (!EMAIL_SHAPE.test(email.trim())) {
      return res.status(400).json({ error: 'That email address doesn’t look right.' });
    }
    normalizedEmail = email.trim().toLowerCase();
  }

  if (findUserByUsername(username)) {
    return res.status(409).json({ error: 'That username is already taken.' });
  }

  const user = createUser(username, hashPassword(password), normalizedEmail);
  const token = createSession(user.id);
  res.status(201).json({ token, user: toPublicUser(user) });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const user = findUserByUsername(username);
  // Deliberately the same error for "no such user" and "wrong password" -
  // distinguishing them would let someone probe which usernames exist.
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Incorrect username or password.' });
  }

  const token = createSession(user.id);
  res.json({ token, user: toPublicUser(user) });
});

router.post('/logout', requireAuth, (req: AuthedRequest, res) => {
  const header = req.headers.authorization!;
  const token = header.slice('Bearer '.length);
  deleteSession(token);
  res.status(204).end();
});

router.get('/me', requireAuth, (req: AuthedRequest, res) => {
  res.json({ user: toPublicUser(req.user!) });
});

// The crop is stored as a reference (which card + where in it), not a
// rendered image - see the account-page spec: the client re-renders the
// crop live (CSS object-position/transform, clipped to a circle) wherever
// the avatar shows, so this only ever has to persist a few numbers.
router.put('/me/avatar', requireAuth, (req: AuthedRequest, res) => {
  const { cardId, x, y, zoom } = req.body ?? {};
  if (typeof cardId !== 'string' || !CARD_POOL.some((c) => c.id === cardId)) {
    return res.status(400).json({ error: 'Unknown card.' });
  }
  if (![x, y, zoom].every((n) => typeof n === 'number' && Number.isFinite(n))) {
    return res.status(400).json({ error: 'x, y, and zoom must all be numbers.' });
  }
  // x/y are fractions of the card art (0-1, where in it the crop circle is
  // centered) - zoom is a multiplier, floored above 1 so it can only ever
  // crop *into* the art, never zoom out to reveal empty space around it.
  if (x < 0 || x > 1 || y < 0 || y > 1 || zoom < 1 || zoom > 5) {
    return res.status(400).json({ error: 'x and y must be between 0 and 1, and zoom between 1 and 5.' });
  }

  setUserAvatar(req.user!.id, cardId, x, y, zoom);
  res.json({ user: toPublicUser(findUserById(req.user!.id)!) });
});

export default router;
