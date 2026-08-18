// ============================================================================
// utils/deckStorage.ts
//
// Deck persistence, using the browser's localStorage - decks are saved per
// browser/device, not synced to a server or to your brother's machine. If
// you want decks shared between computers later, this is the layer that'd
// need to talk to the server instead (a DECKS table plus socket actions,
// same pattern as everything else) - for now this keeps deck building
// simple and fully separate from the live game state.
// ============================================================================

export interface SavedDeck {
  id: string;
  name: string;
  commanderId: string;
  cardIds: string[]; // the 99 (or however many you've added so far), one entry per copy
  updatedAt: string;
}

const STORAGE_KEY = 'magic-decks';

export function loadDecks(): SavedDeck[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDeck(deck: SavedDeck): void {
  const decks = loadDecks();
  const existingIndex = decks.findIndex((d) => d.id === deck.id);
  if (existingIndex >= 0) decks[existingIndex] = deck;
  else decks.push(deck);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
}

export function deleteDeck(id: string): void {
  const decks = loadDecks().filter((d) => d.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
}

export function newDeckId(): string {
  return `deck-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}