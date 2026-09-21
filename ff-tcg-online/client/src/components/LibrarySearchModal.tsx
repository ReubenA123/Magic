import React, { useState } from 'react';
import { CardDefinition, CardInstance, LibrarySearchFilter } from '../types';
import Card from './Card';

interface LibrarySearchModalProps {
  sourceName: string;
  filter: LibrarySearchFilter;
  /** Every card in the controller's library that already matches `filter` -
   * see engine/effects.ts: matchesLibrarySearchFilter. There is no way to
   * see or pick anything outside this list - the search is restricted to
   * exactly what the source card's own text allows, same as a real "search
   * for a [type] card" never turning up something else. */
  cards: { definition: CardDefinition; instance: CardInstance }[];
  onChoose: (instanceId: string) => void;
  onFindNothing: () => void;
}

function filterLabel(filter: LibrarySearchFilter): string {
  switch (filter.kind) {
    case 'basicLand':
      return 'a basic land card';
    case 'anyLand':
      return 'a land card';
    case 'landByName':
      return `a card named ${filter.name}`;
    case 'subtype':
      return `a ${filter.subtype} card`;
    case 'exactName':
      return `a card named ${filter.name}`;
  }
}

/**
 * GameState.pendingLibrarySearch - a deck-builder-style grid, but always
 * pre-filtered to exactly what the source's own text searches for (see
 * filterLabel/matchesLibrarySearchFilter) with no way to widen it. A quick
 * text filter narrows the grid further for a big library, same idea as the
 * deck builder's own search box, but never adds anything back that didn't
 * already match. "Find Nothing" is always available - a real search is
 * never actually mandatory to succeed.
 */
export default function LibrarySearchModal({ sourceName, filter, cards, onChoose, onFindNothing }: LibrarySearchModalProps) {
  const [query, setQuery] = useState('');
  const visible = query.trim() ? cards.filter((c) => c.definition.name.toLowerCase().includes(query.trim().toLowerCase())) : cards;

  return (
    <div className="card-actions-overlay">
      <div className="zone-modal">
        <div className="card-actions-header">
          <strong>{sourceName} - Search your library</strong>
        </div>
        <p className="card-actions-text">
          Choose {filterLabel(filter)} from your library to reveal and put into your hand.
        </p>
        {cards.length > 8 && (
          <input
            className="library-search-query"
            type="text"
            placeholder="Filter by name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
        <div className="zone-modal-grid">
          {visible.map((c) => (
            <Card key={c.instance.instanceId} definition={c.definition} instance={c.instance} onClick={() => onChoose(c.instance.instanceId)} />
          ))}
        </div>
        <button className="opponent-view-exit-button" onClick={onFindNothing}>
          Find Nothing
        </button>
      </div>
    </div>
  );
}
