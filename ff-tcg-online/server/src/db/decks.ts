// ============================================================================
// db/decks.ts
//
// Server-side deck storage, replacing client/src/utils/deckStorage.ts's
// localStorage - the SavedDeck shape here is deliberately identical to that
// file's, so the client swap is just pointing the same function signatures
// at fetch calls instead of localStorage (see routes/decks.ts).
// ============================================================================

import { db } from './connection';

export interface SavedDeck {
  id: string;
  name: string;
  commanderId: string;
  cardIds: string[];
  createdAt: string;
  updatedAt: string;
  /** Null until markDeckPlayed runs at least once - this is a single
   * timestamp, not real match history (see routes/decks.ts's played route
   * and the project notes on why full game history is out of scope for now). */
  lastPlayedAt: string | null;
  /** Optional on the way in (an older client, or a rename-only payload,
   * might not send it) - always present (never undefined) on the way out,
   * via rowToDeck below. */
  favourite?: boolean;
  /** Cosmetic only - which client/src/data/cardBacks.ts CARD_BACKS id this
   * deck's library pile is skinned with. Null/undefined = the default back. */
  cardBackId?: string | null;
}

interface DeckRow {
  id: string;
  name: string;
  commander_id: string;
  card_ids: string;
  created_at: string;
  updated_at: string;
  last_played_at: string | null;
  favourite: number;
  card_back_id: string | null;
}

function rowToDeck(row: DeckRow): SavedDeck {
  return {
    id: row.id,
    name: row.name,
    commanderId: row.commander_id,
    cardIds: JSON.parse(row.card_ids),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastPlayedAt: row.last_played_at,
    favourite: !!row.favourite,
    cardBackId: row.card_back_id,
  };
}

export function listDecks(userId: string): SavedDeck[] {
  const rows = db.prepare('SELECT * FROM decks WHERE user_id = ? ORDER BY updated_at DESC').all(userId) as unknown as DeckRow[];
  return rows.map(rowToDeck);
}

export function findDeck(userId: string, deckId: string): SavedDeck | null {
  const row = db.prepare('SELECT * FROM decks WHERE user_id = ? AND id = ?').get(userId, deckId) as unknown as DeckRow | undefined;
  return row ? rowToDeck(row) : null;
}

/** Create-or-update by (userId, deck.id), matching the client's existing
 * saveDeck semantics exactly - the caller doesn't need to know or care
 * whether this is the deck's first save or its fiftieth. created_at and
 * last_played_at are deliberately left out of the UPDATE half: a re-save
 * shouldn't reset when the deck was first made, or erase that it's
 * actually been played, just because its contents changed.
 *
 * created_at is set explicitly here rather than left to the column's own
 * schema default - a table migrated by connection.ts's ALTER TABLE path
 * (rather than created fresh) has no such default at all (SQLite won't
 * allow one there - see that file's comment), so relying on it would leave
 * created_at NULL on every deck saved after a migration. */
export function upsertDeck(userId: string, deck: SavedDeck): SavedDeck {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO decks (id, user_id, name, commander_id, card_ids, created_at, updated_at, favourite, card_back_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, id) DO UPDATE SET
       name = excluded.name,
       commander_id = excluded.commander_id,
       card_ids = excluded.card_ids,
       updated_at = excluded.updated_at,
       favourite = excluded.favourite,
       card_back_id = excluded.card_back_id`,
  ).run(deck.id, userId, deck.name, deck.commanderId, JSON.stringify(deck.cardIds), now, now, deck.favourite ? 1 : 0, deck.cardBackId ?? null);
  return findDeck(userId, deck.id)!;
}

/** Stamped whenever a game actually starts with this deck (see
 * routes/decks.ts) - returns false for "no such deck of yours" the same
 * way deleteDeck does. */
export function markDeckPlayed(userId: string, deckId: string): boolean {
  const result = db.prepare("UPDATE decks SET last_played_at = datetime('now') WHERE user_id = ? AND id = ?").run(userId, deckId);
  return result.changes > 0;
}

/** Returns false if there was no such deck for this user (either it never
 * existed, or it belongs to someone else) - callers use that to tell "already
 * gone" apart from "actually deleted just now" if they need to. */
export function deleteDeck(userId: string, deckId: string): boolean {
  const result = db.prepare('DELETE FROM decks WHERE user_id = ? AND id = ?').run(userId, deckId);
  return result.changes > 0;
}
