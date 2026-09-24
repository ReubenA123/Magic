import React, { useEffect, useMemo, useState } from 'react';
import { Page } from '../components/NavBar';
import { getCardDefinition } from '../data/cards';
import { CardDefinition } from '../types';
import { Archetype, ARCHETYPE_LABELS, ARCHETYPES, CommunityDeck } from '../api/accountTypes';
import { deleteCommunityDeck, listCommunityDecks, publishCommunityDeck, removeVoteForCommunityDeck, voteForCommunityDeck } from '../api/communityDecks';
import { ApiError } from '../api/rest';
import { loadDecks, deckTotalCardCount, SavedDeck } from '../utils/deckStorage';
import { useAuth } from '../context/AuthContext';
import Card from '../components/Card';
import DeckViewModal from '../components/DeckViewModal';

const MANA_FILTERS: { id: string; label: string }[] = [
  { id: '', label: 'All' },
  { id: 'W', label: 'W' },
  { id: 'U', label: 'U' },
  { id: 'B', label: 'B' },
  { id: 'R', label: 'R' },
  { id: 'G', label: 'G' },
];

function groupCardIds(cardIds: string[]) {
  const counts = new Map<string, number>();
  for (const id of cardIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  return Array.from(counts.entries()).map(([id, count]) => ({ def: getCardDefinition(id), count }));
}

interface DeckRowProps {
  deck: CommunityDeck;
  commander: CardDefinition;
  rank?: number;
  isOwn: boolean;
  onView: () => void;
  onVote: () => void;
  onUnvote: () => void;
  onDelete: () => void;
  loggedIn: boolean;
}

function DeckRow({ deck, commander, rank, isOwn, onView, onVote, onUnvote, onDelete, loggedIn }: DeckRowProps) {
  return (
    <div className="community-deck-row">
      {rank !== undefined && <span className="community-deck-rank">#{rank}</span>}
      <div className="community-deck-commander-thumb">
        <Card definition={commander} />
      </div>
      <div className="community-deck-info">
        <button className="deckbuilder-deck-name-link" onClick={onView}>
          {deck.name}
        </button>
        <div className="community-deck-meta">
          <span className="community-deck-archetype-tag">{ARCHETYPE_LABELS[deck.archetype]}</span>
          <span className="account-tab-hint">
            {commander.name} · by {deck.publisher ? deck.publisher.username : (deck.publisherName ?? 'Official')}
          </span>
        </div>
      </div>
      <div className="community-deck-actions">
        <button
          className={`community-deck-vote-button ${deck.hasVoted ? 'community-deck-vote-active' : ''}`}
          disabled={!loggedIn}
          title={loggedIn ? (deck.hasVoted ? 'Remove your vote' : 'Vote for this deck') : 'Log in to vote'}
          onClick={deck.hasVoted ? onUnvote : onVote}
        >
          {'▲'} {deck.voteCount}
        </button>
        {isOwn && (
          <button className="deckbuilder-delete-button" title="Unpublish" onClick={onDelete}>
            {'✕'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function DecksPage({ onNavigate: _onNavigate }: { onNavigate: (page: Page) => void }) {
  const { user } = useAuth();
  const [decks, setDecks] = useState<CommunityDeck[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewingDeck, setViewingDeck] = useState<CommunityDeck | null>(null);

  // --- Filters -------------------------------------------------------------
  const [commanderQuery, setCommanderQuery] = useState('');
  const [colour, setColour] = useState('');
  const [archetype, setArchetype] = useState<Archetype | ''>('');
  const [sort, setSort] = useState<'votes' | 'newest'>('votes');

  // --- Publish flow ----------------------------------------------------------
  const [showPublish, setShowPublish] = useState(false);
  const [myDecks, setMyDecks] = useState<SavedDeck[]>([]);
  const [publishDeckId, setPublishDeckId] = useState('');
  const [publishArchetype, setPublishArchetype] = useState<Archetype>('other');
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  function refresh() {
    listCommunityDecks({ archetype: archetype || undefined, colours: colour || undefined, sort })
      .then(setDecks)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load decks.'));
  }

  useEffect(refresh, [archetype, colour, sort]);

  useEffect(() => {
    if (!showPublish) return;
    loadDecks()
      .then((all) => setMyDecks(all.filter((d) => deckTotalCardCount(d) === 100)))
      .catch(() => setMyDecks([]));
  }, [showPublish]);

  const filteredDecks = useMemo(() => {
    if (!decks) return [];
    const q = commanderQuery.trim().toLowerCase();
    if (!q) return decks;
    return decks.filter((d) => {
      try {
        return getCardDefinition(d.commanderId).name.toLowerCase().includes(q);
      } catch {
        return false;
      }
    });
  }, [decks, commanderQuery]);

  async function handleVote(deckId: string) {
    setError(null);
    try {
      await voteForCommunityDeck(deckId);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not register your vote.');
    }
  }

  async function handleUnvote(deckId: string) {
    setError(null);
    try {
      await removeVoteForCommunityDeck(deckId);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove your vote.');
    }
  }

  async function handleDelete(deckId: string) {
    setError(null);
    try {
      await deleteCommunityDeck(deckId);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not unpublish that deck.');
    }
  }

  async function handlePublish() {
    const deck = myDecks.find((d) => d.id === publishDeckId);
    if (!deck) return;
    setPublishing(true);
    setPublishError(null);
    try {
      await publishCommunityDeck({ name: deck.name, commanderId: deck.commanderId, cardIds: deck.cardIds, archetype: publishArchetype });
      setShowPublish(false);
      setPublishDeckId('');
      refresh();
    } catch (err) {
      setPublishError(err instanceof ApiError ? err.message : 'Could not publish that deck.');
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="decks-page">
      <div className="decks-page-header">
        <h1>Decks</h1>
        <p className="home-subtitle">Browse, filter, and vote on decks the community has built - the top-voted ones show on the home page.</p>
        {user ? (
          <button className="card-action-button" onClick={() => setShowPublish((v) => !v)}>
            {showPublish ? 'Cancel' : 'Publish a deck'}
          </button>
        ) : (
          <p className="account-tab-hint">Log in to publish one of your own decks or to vote.</p>
        )}
      </div>

      {showPublish && (
        <div className="decks-publish-panel">
          {myDecks.length === 0 ? (
            <p className="account-tab-hint">
              None of your saved decks are complete yet (100 cards including the commander) - finish one in the Deck Builder first.
            </p>
          ) : (
            <>
              <select value={publishDeckId} onChange={(e) => setPublishDeckId(e.target.value)}>
                <option value="">Choose one of your decks…</option>
                {myDecks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <select value={publishArchetype} onChange={(e) => setPublishArchetype(e.target.value as Archetype)}>
                {ARCHETYPES.map((a) => (
                  <option key={a} value={a}>
                    {ARCHETYPE_LABELS[a]}
                  </option>
                ))}
              </select>
              <button className="card-action-button" disabled={!publishDeckId || publishing} onClick={handlePublish}>
                {publishing ? 'Publishing…' : 'Publish'}
              </button>
            </>
          )}
          {publishError && <p className="account-tab-error">{publishError}</p>}
        </div>
      )}

      <div className="decks-filter-bar">
        <input className="library-search" placeholder="Filter by commander name…" value={commanderQuery} onChange={(e) => setCommanderQuery(e.target.value)} />

        <div className="library-filters">
          {MANA_FILTERS.map((m) => (
            <button
              key={m.id}
              className={`mana-filter-button ${m.id ? `mana-${m.id}` : ''} ${colour === m.id ? 'library-filter-active' : ''}`}
              onClick={() => setColour(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="library-filters">
          <button className={`library-filter-button ${archetype === '' ? 'library-filter-active' : ''}`} onClick={() => setArchetype('')}>
            All types
          </button>
          {ARCHETYPES.map((a) => (
            <button key={a} className={`library-filter-button ${archetype === a ? 'library-filter-active' : ''}`} onClick={() => setArchetype(a)}>
              {ARCHETYPE_LABELS[a]}
            </button>
          ))}
        </div>

        <div className="library-filters">
          <button className={`library-filter-button ${sort === 'votes' ? 'library-filter-active' : ''}`} onClick={() => setSort('votes')}>
            Top voted
          </button>
          <button className={`library-filter-button ${sort === 'newest' ? 'library-filter-active' : ''}`} onClick={() => setSort('newest')}>
            Newest
          </button>
        </div>
      </div>

      {error && <p className="account-tab-error">{error}</p>}
      {decks === null && !error && <p className="account-tab-hint">Loading decks…</p>}
      {decks !== null && filteredDecks.length === 0 && <p className="account-tab-hint">No decks match those filters yet.</p>}

      <div className="community-deck-list">
        {filteredDecks.map((deck, i) => {
          let commander: CardDefinition | null = null;
          try {
            commander = getCardDefinition(deck.commanderId);
          } catch {
            commander = null;
          }
          if (!commander) return null;
          return (
            <DeckRow
              key={deck.id}
              deck={deck}
              commander={commander}
              rank={sort === 'votes' ? i + 1 : undefined}
              isOwn={!!user && deck.publisher?.id === user.id}
              onView={() => setViewingDeck(deck)}
              onVote={() => handleVote(deck.id)}
              onUnvote={() => handleUnvote(deck.id)}
              onDelete={() => handleDelete(deck.id)}
              loggedIn={!!user}
            />
          );
        })}
      </div>

      {viewingDeck &&
        (() => {
          let commander: CardDefinition | null = null;
          try {
            commander = getCardDefinition(viewingDeck.commanderId);
          } catch {
            commander = null;
          }
          return (
            <DeckViewModal title={viewingDeck.name} commander={commander} cardGroups={groupCardIds(viewingDeck.cardIds)} onClose={() => setViewingDeck(null)} />
          );
        })()}
    </div>
  );
}
