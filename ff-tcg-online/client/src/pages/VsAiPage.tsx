import React, { useState } from 'react';
import { loadDecks, SavedDeck } from '../utils/deckStorage';
import { getCardDefinition } from '../data/cards';
import { createStateFromDeck } from '../engine/state';
import { useLocalGame } from '../hooks/useLocalGame';
import GameBoard from '../components/GameBoard';

export default function VsAiPage() {
  const [decks] = useState<SavedDeck[]>(() => loadDecks());
  const [selectedDeck, setSelectedDeck] = useState<SavedDeck | null>(null);

  if (!selectedDeck) {
    return (
      <div className="vsai-select-screen">
        <h2>Choose a deck to practice with</h2>
        <p className="pregame-hint">
          The AI doesn't make real decisions yet - you'll control both sides of the board yourself. It plays a
          copy of whichever deck you pick here. Build one in the Deck Builder tab first if none show up below.
        </p>
        {decks.length === 0 ? (
          <p className="card-actions-hint">No saved decks yet.</p>
        ) : (
          <div className="vsai-deck-list">
            {decks.map((d) => (
              <button key={d.id} className="vsai-deck-option" onClick={() => setSelectedDeck(d)}>
                <strong>{d.name}</strong>
                <span>{getCardDefinition(d.commanderId).name}</span>
                <span>{d.cardIds.length} cards</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return <VsAiGame deck={selectedDeck} />;
}

function VsAiGame({ deck }: { deck: SavedDeck }) {
  const [initialState] = useState(() => createStateFromDeck(deck, 'You'));
  const { state, dispatch, actionError } = useLocalGame(initialState);

  return <GameBoard state={state} yourPlayerId={state.players[0].id} actionError={actionError} onAction={dispatch} soloControl />;
}