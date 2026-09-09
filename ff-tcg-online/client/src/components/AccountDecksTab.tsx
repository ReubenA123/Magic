import React, { useEffect, useState } from 'react';
import { deleteDeck, loadDecks, SavedDeck } from '../utils/deckStorage';

/**
 * The account page's view of the same decks DeckBuilderPage reads and
 * writes - goes through deckStorage.ts rather than calling the /decks API
 * directly, so both places agree on "logged in means server-backed"
 * without duplicating that branch.
 */
export default function AccountDecksTab() {
  const [decks, setDecks] = useState<SavedDeck[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDecks()
      .then(setDecks)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load decks.'));
  }, []);

  async function handleDelete(id: string) {
    if (!decks) return;
    const previous = decks;
    setDecks(decks.filter((d) => d.id !== id)); // optimistic - most deletes succeed
    try {
      await deleteDeck(id);
    } catch (err) {
      setDecks(previous);
      setError(err instanceof Error ? err.message : 'Could not delete that deck.');
    }
  }

  if (error) return <p className="account-tab-error">{error}</p>;
  if (!decks) return <p className="account-tab-hint">Loading decks…</p>;
  if (decks.length === 0) return <p className="account-tab-hint">No decks saved to your account yet - build one in the Deck Builder.</p>;

  return (
    <div className="account-deck-list">
      {decks.map((deck) => (
        <div key={deck.id} className="account-deck-row">
          <div className="account-deck-row-info">
            <strong>{deck.name}</strong>
            <span className="account-tab-hint">
              {deck.cardIds.length} cards · updated {new Date(deck.updatedAt).toLocaleDateString()}
            </span>
          </div>
          <button className="card-action-button secondary" onClick={() => handleDelete(deck.id)}>
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
