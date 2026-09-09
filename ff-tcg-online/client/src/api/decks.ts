// ============================================================================
// api/decks.ts
//
// Thin wrappers over the /decks endpoints - see utils/deckStorage.ts for
// where these actually get used (it decides whether to call these or fall
// back to localStorage, depending on whether anyone's logged in).
// ============================================================================

import { api } from './rest';
import { SavedDeck } from './accountTypes';

export async function listRemoteDecks(): Promise<SavedDeck[]> {
  const res = await api.get<{ decks: SavedDeck[] }>('/decks');
  return res.decks;
}

export async function upsertRemoteDeck(deck: SavedDeck): Promise<SavedDeck> {
  const res = await api.put<{ deck: SavedDeck }>(`/decks/${encodeURIComponent(deck.id)}`, deck);
  return res.deck;
}

export async function deleteRemoteDeck(id: string): Promise<void> {
  await api.delete(`/decks/${encodeURIComponent(id)}`);
}

export async function markRemoteDeckPlayed(id: string): Promise<void> {
  await api.post(`/decks/${encodeURIComponent(id)}/played`);
}
