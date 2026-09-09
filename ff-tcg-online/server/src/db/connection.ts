// ============================================================================
// db/connection.ts
//
// One SQLite file on disk, opened once and shared by every module that needs
// it. Uses Node's own built-in `node:sqlite` (stable since Node 22.5, no
// native dependency to install/build) - see package.json's `engines` field
// for the minimum Node version this requires.
//
// The database file lives outside git entirely (see the repo root
// .gitignore) - it holds password hashes, so it must never be committed.
// ============================================================================

import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(__dirname, '..', '..', 'data');
const DB_PATH = join(DATA_DIR, 'accounts.db');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(DB_PATH);

// Foreign keys are off by default in SQLite - without this, deleting a user
// would silently leave their sessions/friendships behind as orphaned rows.
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    username_lower TEXT NOT NULL UNIQUE,
    friend_code TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    email TEXT,
    avatar_card_id TEXT,
    avatar_crop_x REAL,
    avatar_crop_y REAL,
    avatar_crop_zoom REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

  -- One row per friend relationship, in either 'pending' (sent by requester,
  -- awaiting recipient's response) or 'accepted' state. Declining/cancelling
  -- a request just deletes the row rather than leaving a 'declined' row
  -- around - there's nothing useful to keep once it's over, and the
  -- requester is free to try again later.
  CREATE TABLE IF NOT EXISTS friendships (
    id TEXT PRIMARY KEY,
    requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    responded_at TEXT,
    UNIQUE (requester_id, recipient_id)
  );

  CREATE INDEX IF NOT EXISTS idx_friendships_recipient ON friendships(recipient_id);
  CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id);

  -- id is client-generated (see client/src/utils/deckStorage.ts's newDeckId)
  -- and only ever unique *within one user's own decks*, not globally, so the
  -- primary key is the pair rather than id alone - otherwise two different
  -- users could collide on the same id and overwrite each other's deck.
  CREATE TABLE IF NOT EXISTS decks (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    commander_id TEXT NOT NULL,
    card_ids TEXT NOT NULL, -- JSON array of card def ids, one entry per copy
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, id)
  );
`);
