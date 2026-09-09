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
  updatedAt: string;
}

interface DeckRow {
  id: string;
  name: string;
  commander_id: string;
  card_ids: string;
  updated_at: string;
}

function rowToDeck(row: DeckRow): SavedDeck {
  return {
    id: row.id,
    name: row.name,
    commanderId: row.commander_id,
    cardIds: JSON.parse(row.card_ids),
    updatedAt: row.updated_at,
  };
}

export function listDecks(userId: string): SavedDeck[] {
  const rows = db.prepare('SELECT * FROM decks WHERE user_id = ? ORDER BY updated_at DESC').all(userId) as unknown as DeckRow[];
  return rows.map(rowToDeck);
}

/** Create-or-update by (userId, deck.id), matching the client's existing
 * saveDeck semantics exactly - the caller doesn't need to know or care
 * whether this is the deck's first save or its fiftieth. */
export function upsertDeck(userId: string, deck: SavedDeck): SavedDeck {
  const updatedAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO decks (id, user_id, name, commander_id, card_ids, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, id) DO UPDATE SET
       name = excluded.name,
       commander_id = excluded.commander_id,
       card_ids = excluded.card_ids,
       updated_at = excluded.updated_at`,
  ).run(deck.id, userId, deck.name, deck.commanderId, JSON.stringify(deck.cardIds), updatedAt);
  return { ...deck, updatedAt };
}

/** Returns false if there was no such deck for this user (either it never
 * existed, or it belongs to someone else) - callers use that to tell "already
 * gone" apart from "actually deleted just now" if they need to. */
export function deleteDeck(userId: string, deckId: string): boolean {
  const result = db.prepare('DELETE FROM decks WHERE user_id = ? AND id = ?').run(userId, deckId);
  return result.changes > 0;
}
