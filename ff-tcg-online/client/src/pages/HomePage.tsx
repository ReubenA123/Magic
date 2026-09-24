import React, { useEffect, useState } from 'react';
import { Page } from '../components/NavBar';
import { CARD_POOL, getCardDefinition } from '../data/cards';
import { CommunityDeck, ARCHETYPE_LABELS } from '../api/accountTypes';
import { listCommunityDecks } from '../api/communityDecks';
import Card from '../components/Card';

interface HomePageProps {
  onNavigate: (page: Page) => void;
}

const TOP_DECKS_SHOWN = 3;

function TopDecks({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const [decks, setDecks] = useState<CommunityDeck[] | null>(null);

  useEffect(() => {
    listCommunityDecks({ sort: 'votes', limit: TOP_DECKS_SHOWN })
      .then(setDecks)
      .catch(() => setDecks([]));
  }, []);

  if (decks !== null && decks.length === 0) return null;

  return (
    <div className="home-top-decks">
      <div className="home-top-decks-header">
        <h2>Top Decks</h2>
        <button className="home-top-decks-viewall" onClick={() => onNavigate('decks')}>
          View all decks {'→'}
        </button>
      </div>
      {decks === null ? (
        <p className="account-tab-hint">Loading…</p>
      ) : (
        <div className="home-top-decks-grid">
          {decks.map((deck, i) => {
            let commander;
            try {
              commander = getCardDefinition(deck.commanderId);
            } catch {
              return null;
            }
            return (
              <button key={deck.id} className="home-top-deck-card" onClick={() => onNavigate('decks')}>
                <span className="community-deck-rank">#{i + 1}</span>
                <Card definition={commander} />
                <div className="home-top-deck-info">
                  <strong>{deck.name}</strong>
                  <span className="account-tab-hint">
                    {commander.name} · {ARCHETYPE_LABELS[deck.archetype]}
                  </span>
                  <span className="community-deck-vote-button community-deck-vote-static">{'▲'} {deck.voteCount}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function HomePage({ onNavigate }: HomePageProps) {
  return (
    <div className="home-page">
      <h1>Magic</h1>
      <p className="home-subtitle">A private two-player card game.</p>
      <div className="home-cards">
        <button className="home-card" onClick={() => onNavigate('library')}>
          <h3>Library</h3>
          <p>Browse all {CARD_POOL.length} cards in the pool.</p>
        </button>
        <button className="home-card" onClick={() => onNavigate('decks')}>
          <h3>Decks</h3>
          <p>Browse and vote on community decks.</p>
        </button>
        <button className="home-card" onClick={() => onNavigate('versus')}>
          <h3>Versus</h3>
          <p>Start or join a match.</p>
        </button>
      </div>

      <TopDecks onNavigate={onNavigate} />
    </div>
  );
}