import React, { useMemo, useState } from 'react';
import { CARD_POOL, getCardDefinition } from '../data/cards';
import { CardType } from '../types';
import Card from '../components/Card';
import DeckViewModal from '../components/DeckViewModal';
import { isLegalCommander, canAddCopy, isTransformBackFace } from '../utils/commander';
import { loadDecks, saveDeck, deleteDeck, newDeckId, SavedDeck } from '../utils/deckStorage';
import { getColourIdentity, isWithinColourIdentity, ManaLetter } from '../utils/colourIdentity';

// --- Static filter option lists ------------------------------------------
type PoolFilter = CardType | 'all' | 'commander';
const TYPE_FILTERS: PoolFilter[] = ['all', 'commander', 'creature', 'instant', 'sorcery', 'artifact', 'enchantment', 'land'];
const DECK_SIZE_TARGET = 99; // plus the commander = 100, standard Commander deck size

const MANA_FILTERS: { id: ManaLetter | 'all' | 'multicolor' | 'colorless'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'W', label: 'W' },
  { id: 'U', label: 'U' },
  { id: 'B', label: 'B' },
  { id: 'R', label: 'R' },
  { id: 'G', label: 'G' },
  { id: 'multicolor', label: 'Multi' },
  { id: 'colorless', label: 'Colourless' },
];

/** Turns a flat list of card ids into { def, count } groups, deduplicated -
 * used for both the in-progress deck and any saved deck being previewed. */
function groupCardIds(cardIds: string[]) {
  const counts = new Map<string, number>();
  for (const id of cardIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  return Array.from(counts.entries()).map(([id, count]) => ({ def: getCardDefinition(id), count }));
}

export default function DeckBuilderPage() {
  // --- Deck-in-progress state ------------------------------------------
  const [deckName, setDeckName] = useState('New Deck');
  const [commanderId, setCommanderId] = useState<string | null>(null);
  const [cardIds, setCardIds] = useState<string[]>([]);

  // --- Card pool browsing/filtering state -------------------------------
  const [filter, setFilter] = useState<PoolFilter>('all');
  const [manaFilter, setManaFilter] = useState<(typeof MANA_FILTERS)[number]['id']>('all');
  const [query, setQuery] = useState('');
  // Which transformable cards are currently showing their back face, keyed
  // by the FRONT face's id (the only id ever addable to a deck).
  const [flippedIds, setFlippedIds] = useState<Set<string>>(new Set());

  // --- Saved decks + the deck currently being previewed -------------------
  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>(() => loadDecks());
  const [viewingDeck, setViewingDeck] = useState<SavedDeck | null>(null);

  // --- Derived values -----------------------------------------------------
  const commander = commanderId ? getCardDefinition(commanderId) : null;
  const commanderColours = commander ? getColourIdentity(commander) : null;

  const filteredPool = useMemo(() => {
    return CARD_POOL.filter((c) => {
      if (isTransformBackFace(c.id)) return false; // never addable/selectable directly
      const matchesType = filter === 'all' || (filter === 'commander' ? isLegalCommander(c) : c.type === filter);
      const matchesQuery = c.name.toLowerCase().includes(query.toLowerCase());
      const matchesIdentity = !commanderColours || isWithinColourIdentity(c, commanderColours);

      const cardColours = getColourIdentity(c);
      const matchesMana =
        manaFilter === 'all' ||
        (manaFilter === 'colorless' && cardColours.length === 0) ||
        (manaFilter === 'multicolor' && cardColours.length > 1) ||
        cardColours.includes(manaFilter as ManaLetter);

      return matchesType && matchesQuery && matchesIdentity && matchesMana;
    });
  }, [filter, query, manaFilter, commanderColours]);

  const deckGroups = useMemo(() => groupCardIds(cardIds), [cardIds]);

  // --- Actions --------------------------------------------------------------
  function setAsCommander(defId: string) {
    setCommanderId(defId);
    // If the card was already sitting in the 99 before being made
    // commander, pull it back out - it can't be both.
    setCardIds((prev) => prev.filter((id) => id !== defId));
  }

  function addToDeck(defId: string) {
    const def = getCardDefinition(defId);
    if (defId === commanderId) return; // the commander itself never goes in the 99
    if (!canAddCopy(def, cardIds)) return;
    setCardIds((prev) => [...prev, defId]);
  }

  function toggleFlip(id: string) {
    setFlippedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function removeOneFromDeck(defId: string) {
    setCardIds((prev) => {
      const idx = prev.indexOf(defId);
      if (idx === -1) return prev;
      const next = [...prev];
      next.splice(idx, 1);
      return next;
    });
  }

  function handleSave() {
    if (!commanderId) {
      alert('Choose a commander before saving.');
      return;
    }
    const deck: SavedDeck = {
      id: newDeckId(),
      name: deckName || 'Untitled Deck',
      commanderId,
      cardIds,
      updatedAt: new Date().toISOString(),
    };
    saveDeck(deck);
    setSavedDecks(loadDecks());
  }

  function handleLoad(deck: SavedDeck) {
    setDeckName(deck.name);
    setCommanderId(deck.commanderId);
    setCardIds(deck.cardIds);
  }

  function handleDelete(id: string) {
    deleteDeck(id);
    setSavedDecks(loadDecks());
  }

  function handleExport() {
    if (!commander) {
      alert('Choose a commander before exporting.');
      return;
    }
    const lines = [`Commander: ${commander.name}`, '', ...deckGroups.map((g) => `${g.count}x ${g.def.name}`)];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${deckName.replace(/\s+/g, '-').toLowerCase() || 'deck'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- Render ---------------------------------------------------------------
  return (
    <div className="deckbuilder-page">
      {/* Left side: browsable, filterable card pool */}
      <div className="deckbuilder-main">
        <div className="library-controls">
          <input className="library-search" placeholder="Search by name\u2026" value={query} onChange={(e) => setQuery(e.target.value)} />

          <div className="library-filters">
            {TYPE_FILTERS.map((t) => (
              <button key={t} className={`library-filter-button ${filter === t ? 'library-filter-active' : ''}`} onClick={() => setFilter(t)}>
                {t}
              </button>
            ))}
          </div>

          <div className="library-filters">
            {MANA_FILTERS.map((m) => (
              <button key={m.id} className={`mana-filter-button mana-${m.id} ${manaFilter === m.id ? 'library-filter-active' : ''}`} onClick={() => setManaFilter(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {commanderColours && (
          <p className="deckbuilder-identity-note">
            Showing cards within {commander!.name}'s colour identity ({commanderColours.join('') || 'colourless'}).
          </p>
        )}

        <div className="deckbuilder-pool-grid">
          {filteredPool.map((def) => {
            const legal = isLegalCommander(def);
            const isCommander = def.id === commanderId;
            const canAdd = !isCommander && canAddCopy(def, cardIds);
            const isFlippable = !!def.transformsInto;
            const shownDef = isFlippable && flippedIds.has(def.id) ? getCardDefinition(def.transformsInto!) : def;
            return (
              <div key={def.id} className="deckbuilder-pool-item">
                <div className="library-card-wrapper">
                  <Card definition={shownDef} />
                  {isFlippable && (
                    <button className="flip-icon-button" onClick={() => toggleFlip(def.id)} title="Flip / show transformed side">
                      {'↻'}
                    </button>
                  )}
                </div>
                <div className="deckbuilder-pool-actions">
                  <button disabled={!legal} onClick={() => setAsCommander(def.id)} title={legal ? '' : 'Must be a legendary creature, not a transform back face'}>
                    {isCommander ? 'Is your commander' : 'Set as Commander'}
                  </button>
                  <button disabled={!canAdd} onClick={() => addToDeck(def.id)}>
                    {isCommander ? "Can't add commander" : canAdd ? 'Add to deck' : 'Already in deck'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right side: the deck being built, plus save/load/export */}
      <div className="deckbuilder-sidebar">
        <input className="deckbuilder-name-input" value={deckName} onChange={(e) => setDeckName(e.target.value)} />

        <div className="deckbuilder-commander-slot">
          <div className="card-actions-label">Commander</div>
          {commander ? (
            <div className="deckbuilder-commander-card">
              <Card definition={commander} />
              <span>{commander.name}</span>
            </div>
          ) : (
            <p className="card-actions-hint">No commander chosen yet.</p>
          )}
        </div>

        <div className="deckbuilder-count">
          {cardIds.length} / {DECK_SIZE_TARGET} cards
          {cardIds.length > DECK_SIZE_TARGET && <span className="deckbuilder-warning"> (over the limit)</span>}
        </div>

        <div className="deckbuilder-list">
          {deckGroups.length === 0 && <p className="card-actions-hint">No cards added yet.</p>}
          {deckGroups.map(({ def, count }) => (
            <div key={def.id} className="deckbuilder-list-row">
              <span>
                {count}x {def.name}
              </span>
              <button className="counter-step" onClick={() => removeOneFromDeck(def.id)}>
                {'\u2013'}
              </button>
            </div>
          ))}
        </div>

        <div className="deckbuilder-buttons">
          <button onClick={handleSave}>Save deck</button>
          <button onClick={handleExport}>Export as text</button>
        </div>

        {savedDecks.length > 0 && (
          <div className="deckbuilder-saved-list">
            <div className="card-actions-label">Saved decks</div>
            {savedDecks.map((d) => (
              <div key={d.id} className="deckbuilder-list-row">
                <button className="deckbuilder-deck-name-link" onClick={() => setViewingDeck(d)}>
                  {d.name}
                </button>
                <div className="deckbuilder-saved-actions">
                  <button className="deckbuilder-load-button" onClick={() => handleLoad(d)}>
                    Load
                  </button>
                  <button className="deckbuilder-delete-button" onClick={() => handleDelete(d.id)}>
                    {'\u2715'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewingDeck && (
        <DeckViewModal
          title={viewingDeck.name}
          commander={getCardDefinition(viewingDeck.commanderId)}
          cardGroups={groupCardIds(viewingDeck.cardIds)}
          onClose={() => setViewingDeck(null)}
        />
      )}
    </div>
  );
}