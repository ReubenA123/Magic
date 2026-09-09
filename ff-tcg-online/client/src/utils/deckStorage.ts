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
import { deleteRemoteDeck, listRemoteDecks, upsertRemoteDeck } from '../api/decks';

export interface SavedDeck {
  id: string;
  name: string;
  commanderId: string;
  cardIds: string[]; // the 99 (or however many you've added so far), one entry per copy
  updatedAt: string;
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

function saveLocalDeck(deck: SavedDeck): void {
  const decks = loadLocalDecks();
  const existingIndex = decks.findIndex((d) => d.id === deck.id);
  if (existingIndex >= 0) decks[existingIndex] = deck;
  else decks.push(deck);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
}

function deleteLocalDeck(id: string): void {
  const decks = loadLocalDecks().filter((d) => d.id !== id);
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
