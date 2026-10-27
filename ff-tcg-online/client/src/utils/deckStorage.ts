// ============================================================================
// utils/deckStorage.ts
//
// Deck persistence - server-backed (see api/decks.ts) when logged in, so
// decks follow you to a different computer or browser, falling back to
// this browser's localStorage when nobody's logged in (same as before
// accounts existed). Every function is async now even for the local-storage
// path, so DeckBuilderPage doesn't need two different call shapes depending
// on which backend is actually in play.
// ============================================================================

import { getToken } from '../api/rest';
import { deleteRemoteDeck, listRemoteDecks, markRemoteDeckPlayed, upsertRemoteDeck } from '../api/decks';

export interface SavedDeck {
  id: string;
  name: string;
  commanderId: string;
  cardIds: string[]; // the 99 (or however many you've added so far), one entry per copy
  createdAt: string;
  updatedAt: string;
  /** Null until the deck has actually started a game at least once - just
   * this one timestamp, not real match history (see markDeckPlayed below). */
  lastPlayedAt: string | null;
  /** Optional (missing on anything saved before this existed - treat that
   * as false, never undefined, when sorting/displaying). Favourited decks
   * are pinned to the top of every "your decks" list. */
  favourite?: boolean;
  /** Which of data/cardBacks.ts's CARD_BACKS this deck is cosmetically
   * skinned with - null/undefined means the plain default back. Picked in
   * the Library's deck editor, read once at game start (see
   * engine/state.ts: createStateFromDeck) into PlayerState.libraryCardBackId. */
  cardBackId?: string | null;
}

/** Favourites first, otherwise stable (keeps whatever order the caller's
 * list was already in - most-recently-updated first from the server/local
 * storage, both of which already sort that way). */
export function sortDecksFavouritesFirst(decks: SavedDeck[]): SavedDeck[] {
  return [...decks].sort((a, b) => Number(!!b.favourite) - Number(!!a.favourite));
}

const STORAGE_KEY = 'magic-decks';

function loadLocalDecks(): SavedDeck[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Re-saving an existing id keeps its original createdAt/lastPlayedAt
 * rather than letting the caller's fresh object overwrite them - matches
 * the server's upsert (see server/src/db/decks.ts), even though nothing in
 * the UI currently re-saves an existing id (every Save makes a new one). */
function saveLocalDeck(deck: SavedDeck): void {
  const decks = loadLocalDecks();
  const existingIndex = decks.findIndex((d) => d.id === deck.id);
  if (existingIndex >= 0) {
    decks[existingIndex] = { ...deck, createdAt: decks[existingIndex].createdAt, lastPlayedAt: decks[existingIndex].lastPlayedAt };
  } else {
    decks.push(deck);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
}

function deleteLocalDeck(id: string): void {
  const decks = loadLocalDecks().filter((d) => d.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
}

function markLocalDeckPlayed(id: string): void {
  const decks = loadLocalDecks();
  const deck = decks.find((d) => d.id === id);
  if (!deck) return;
  deck.lastPlayedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
}

export async function loadDecks(): Promise<SavedDeck[]> {
  if (getToken()) return listRemoteDecks();
  return loadLocalDecks();
}

export async function saveDeck(deck: SavedDeck): Promise<void> {
  if (getToken()) {
    await upsertRemoteDeck(deck);
    return;
  }
  saveLocalDeck(deck);
}

/** Call whenever a game actually starts with this deck (see VsAiPage) -
 * stamps a single "last played" timestamp, not real match history (see
 * the SavedDeck.lastPlayedAt doc comment for why). */
export async function markDeckPlayed(id: string): Promise<void> {
  if (getToken()) {
    await markRemoteDeckPlayed(id);
    return;
  }
  markLocalDeckPlayed(id);
}

export async function deleteDeck(id: string): Promise<void> {
  if (getToken()) {
    await deleteRemoteDeck(id);
    return;
  }
  deleteLocalDeck(id);
}

export function newDeckId(): string {
  return `deck-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

/** cardIds is just the 99 (the commander lives in its own slot, never in
 * this list - see DeckBuilderPage's setAsCommander) - anywhere a deck's
 * total size is shown as a single summary number, it should read as a
 * full 100-card deck, not 99. */
export function deckTotalCardCount(deck: SavedDeck): number {
  return deck.cardIds.length + 1;
}

/** Decks built before logging in (or on a computer you're not logged in on
 * right now) sit in this browser's localStorage - this pushes all of them
 * up to the account in one go. Safe to run more than once: it's an upsert
 * on each deck's own id, so re-importing just re-saves the same decks
 * rather than duplicating them. */
export function hasLocalDecksToImport(): boolean {
  return loadLocalDecks().length > 0;
}

export async function importLocalDecksToAccount(): Promise<number> {
  const local = loadLocalDecks();
  for (const deck of local) {
    await upsertRemoteDeck(deck);
  }
  return local.length;
}
