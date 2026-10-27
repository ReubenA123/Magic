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
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_played_at TEXT,
    favourite INTEGER NOT NULL DEFAULT 0, -- 0/1, SQLite has no real boolean
    card_back_id TEXT, -- cosmetic only, NULL = the plain default back
    PRIMARY KEY (user_id, id)
  );

  -- A published SNAPSHOT of a deck for the community Decks tab - deliberately
  -- its own row, not a flag on the private 'decks' table above: publishing
  -- copies the deck's contents at that moment, so the owner can keep editing
  -- their private deck afterward without silently changing what everyone
  -- else already voted on (they'd need to re-publish to update it).
  -- user_id is nullable so a small number of "official"/preset decks (e.g.
  -- a precon list added directly by the maintainers) can exist with no
  -- publishing account at all - see publisher_name below for how those
  -- display. id is globally unique here (unlike decks.id), since this table
  -- isn't scoped to one user's own rows.
  CREATE TABLE IF NOT EXISTS community_decks (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    -- Display name to fall back on once user_id is NULL (either it always
    -- was, for an official deck, or the publishing account was since
    -- deleted) - ignored otherwise, since a live username can change and
    -- should always be looked up fresh from users.
    publisher_name TEXT,
    name TEXT NOT NULL,
    commander_id TEXT NOT NULL,
    card_ids TEXT NOT NULL,
    -- Free-form "kind of deck" tag the publisher picks (Aggro/Control/...) -
    -- what the filter bar's "type" filter actually matches against, since
    -- nothing about a decklist's cards alone says what archetype it's going
    -- for. See routes/communityDecks.ts for the fixed option list.
    archetype TEXT NOT NULL DEFAULT 'other',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_community_decks_commander ON community_decks(commander_id);

  -- One row per (deck, voter) - the pair is the primary key specifically so
  -- a second vote from the same user on the same deck is a no-op collision
  -- rather than a second row, which is what keeps voting idempotent without
  -- the app layer needing to check "have I already voted?" before every insert.
  CREATE TABLE IF NOT EXISTS deck_votes (
    deck_id TEXT NOT NULL REFERENCES community_decks(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (deck_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_deck_votes_deck ON deck_votes(deck_id);
`);

// Lightweight migration for anyone with a decks table from before
// created_at/last_played_at existed - CREATE TABLE IF NOT EXISTS above
// doesn't retroactively add columns to a table that's already there.
//
// SQLite refuses ADD COLUMN ... NOT NULL DEFAULT (datetime('now')) once the
// table already has rows ("Cannot add a column with non-constant default") -
// a function call can't be resolved to one fixed backfill value for
// existing rows the way a literal default can. So this adds the column
// bare (nullable, no default) and backfills it with an UPDATE instead,
// which has no such restriction. updated_at is the closest real value
// standing in for a created_at nothing ever recorded on these older rows.
const deckColumns = (db.prepare('PRAGMA table_info(decks)').all() as unknown as { name: string }[]).map((c) => c.name);
if (!deckColumns.includes('created_at')) {
  db.exec('ALTER TABLE decks ADD COLUMN created_at TEXT');
  db.exec('UPDATE decks SET created_at = updated_at WHERE created_at IS NULL');
}
if (!deckColumns.includes('last_played_at')) {
  db.exec('ALTER TABLE decks ADD COLUMN last_played_at TEXT');
}
if (!deckColumns.includes('favourite')) {
  // A literal constant default (unlike created_at's datetime('now') above)
  // is fine to add directly, even with existing rows.
  db.exec('ALTER TABLE decks ADD COLUMN favourite INTEGER NOT NULL DEFAULT 0');
}
if (!deckColumns.includes('card_back_id')) {
  db.exec('ALTER TABLE decks ADD COLUMN card_back_id TEXT');
}
