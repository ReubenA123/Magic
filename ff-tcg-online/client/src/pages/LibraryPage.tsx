import React, { useEffect, useMemo, useState } from 'react';
import { CARD_POOL, getCardDefinition, tryGetCardDefinition } from '../data/cards';
import { CardDefinition, CardType } from '../types';
import Card from '../components/Card';
import CardArtStack from '../components/CardArtStack';
import DeckViewModal from '../components/DeckViewModal';
import { isLegalCommander, canAddCopy, isTransformBackFace } from '../utils/commander';
import { groupByArtVariants } from '../utils/artVariants';
import { loadDecks, saveDeck, deleteDeck, newDeckId, hasLocalDecksToImport, importLocalDecksToAccount, SavedDeck } from '../utils/deckStorage';
import { getColourIdentity, isWithinColourIdentity, ManaLetter } from '../utils/colourIdentity';
import { useAuth } from '../context/AuthContext';
import { useCardFullScreen } from '../hooks/useCardFullScreen';

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
 * used for both the in-progress deck and any saved deck being previewed.
 * Saved decks aren't as trustworthy as the live pool - a card can get
 * renamed or removed after a deck that used it was saved - so unknown ids
 * are just dropped instead of crashing the whole page. */
function groupCardIds(cardIds: string[]) {
  const counts = new Map<string, number>();
  for (const id of cardIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([id, count]) => ({ def: tryGetCardDefinition(id), count }))
    .filter((g): g is { def: CardDefinition; count: number } => g.def !== null);
}

/**
 * Library and Deck Builder used to be two separate tabs, but they were
 * really the same screen - browsing the card pool IS how you build a deck.
 * This merged page defaults to plain browsing (no deck-building buttons
 * cluttering every card) until the player hits "Create Deck" on the right,
 * at which point the right side becomes the deck being built - pinned in
 * view (position: sticky, see .deckbuilder-sidebar) no matter how far the
 * pool on the left scrolls - and every card tile grows its
 * commander/add-to-deck buttons.
 */
export default function LibraryPage() {
  // Whether the right side is showing the deck editor (commander slot, deck
  // list, save/export) or just the "Create Deck" + saved-decks panel.
  const [buildingDeck, setBuildingDeck] = useState(false);

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
  const { user } = useAuth();
  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>([]);
  const [viewingDeck, setViewingDeck] = useState<SavedDeck | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Only offered once there's actually something sitting in this browser's
  // localStorage to bring across - re-checked whenever login state changes,
  // since that's the only thing that can make this newly true or false.
  const [canImportLocal, setCanImportLocal] = useState(false);
  const [importing, setImporting] = useState(false);

  // Click almost any card tile (pool, commander slot) to see it full screen.
  const { cardClickProps, fullScreenModal } = useCardFullScreen();

  function refreshSavedDecks() {
    loadDecks()
      .then(setSavedDecks)
      .catch((err) => setSaveError(err instanceof Error ? err.message : 'Could not load your decks.'));
  }

  useEffect(refreshSavedDecks, [user]);
  useEffect(() => setCanImportLocal(!!user && hasLocalDecksToImport()), [user]);

  async function handleImportLocal() {
    setImporting(true);
    setSaveError(null);
    try {
      await importLocalDecksToAccount();
      setCanImportLocal(false);
      refreshSavedDecks();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not import your local decks.');
    } finally {
      setImporting(false);
    }
  }

  // --- Derived values -----------------------------------------------------
  // tryGetCardDefinition, not getCardDefinition - a loaded deck's commander
  // id might belong to a card that's since been renamed or removed.
  const commander = commanderId ? tryGetCardDefinition(commanderId) : null;
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
  const displayGroups = useMemo(() => groupByArtVariants(filteredPool), [filteredPool]);

  // --- Actions --------------------------------------------------------------
  function startNewDeck() {
    setDeckName('New Deck');
    setCommanderId(null);
    setCardIds([]);
    setBuildingDeck(true);
  }

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

  function toggleFlip(id: string, e: React.MouseEvent) {
    e.stopPropagation(); // flipping shouldn't also pop the full-screen view open
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

  async function handleSave() {
    if (!commanderId) {
      alert('Choose a commander before saving.');
      return;
    }
    const now = new Date().toISOString();
    const deck: SavedDeck = {
      id: newDeckId(),
      name: deckName || 'Untitled Deck',
      commanderId,
      cardIds,
      createdAt: now,
      updatedAt: now,
      lastPlayedAt: null,
    };
    setSaveError(null);
    try {
      await saveDeck(deck);
      refreshSavedDecks();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save that deck.');
    }
  }

  function handleLoad(deck: SavedDeck) {
    setDeckName(deck.name);
    setCommanderId(deck.commanderId);
    setCardIds(deck.cardIds);
    setBuildingDeck(true);
  }

  async function handleDelete(id: string) {
    setSaveError(null);
    try {
      await deleteDeck(id);
      refreshSavedDecks();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not delete that deck.');
    }
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

  const savedDecksList = savedDecks.length > 0 && (
    <div className="deckbuilder-saved-list">
      <div className="card-actions-label">Your decks</div>
      {savedDecks.map((d) => (
        <div key={d.id} className="deckbuilder-list-row">
          <button className="deckbuilder-deck-name-link" onClick={() => setViewingDeck(d)}>
            {d.name}
          </button>
          <div className="deckbuilder-saved-actions">
            <button className="deckbuilder-load-button" onClick={() => handleLoad(d)}>
              Edit
            </button>
            <button className="deckbuilder-delete-button" onClick={() => handleDelete(d.id)}>
              {'✕'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  // --- Render ---------------------------------------------------------------
  return (
    <div className="deckbuilder-page">
      {/* Left side: browsable, filterable card pool */}
      <div className="deckbuilder-main">
        <div className="library-controls">
          <input className="library-search" placeholder="Search by name…" value={query} onChange={(e) => setQuery(e.target.value)} />

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

        {buildingDeck && commanderColours && (
          <p className="deckbuilder-identity-note">
            Showing cards within {commander!.name}'s colour identity ({commanderColours.join('') || 'colourless'}).
          </p>
        )}

        <p className="library-count">{filteredPool.length} card(s)</p>

        <div className="deckbuilder-pool-grid">
          {displayGroups.map((group) => {
            if (group.length > 1) {
              return (
                <div key={group[0].name} className="deckbuilder-pool-item">
                  <CardArtStack
                    variants={group}
                    deckBuilder={
                      buildingDeck
                        ? { commanderId, cardIds, canAddCopy, isLegalCommander, onAdd: addToDeck, onSetCommander: setAsCommander }
                        : undefined
                    }
                  />
                </div>
              );
            }
            const def = group[0];
            const legal = isLegalCommander(def);
            const isCommander = def.id === commanderId;
            const canAdd = !isCommander && canAddCopy(def, cardIds);
            const isFlippable = !!def.transformsInto;
            const shownDef = isFlippable && flippedIds.has(def.id) ? getCardDefinition(def.transformsInto!) : def;
            return (
              <div key={def.id} className="deckbuilder-pool-item">
                <div className="library-card-wrapper card-clickable-wrapper" {...cardClickProps(shownDef)}>
                  <Card definition={shownDef} />
                  {isFlippable && (
                    <button className="flip-icon-button" onClick={(e) => toggleFlip(def.id, e)} title="Flip / show transformed side">
                      {'↻'}
                    </button>
                  )}
                </div>
                {buildingDeck && (
                  <div className="deckbuilder-pool-actions">
                    {legal && (
                      <button onClick={() => setAsCommander(def.id)}>{isCommander ? 'Is your commander' : 'Set as Commander'}</button>
                    )}
                    <button disabled={!canAdd} onClick={() => addToDeck(def.id)}>
                      {isCommander ? "Can't add commander" : canAdd ? 'Add to deck' : 'Already in deck'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right side: either "start building" + your saved decks, or the deck
          currently being built - stays pinned in view while the pool on the
          left scrolls. */}
      <div className="deckbuilder-sidebar">
        {buildingDeck ? (
          <>
            <button className="deckbuilder-back-button" onClick={() => setBuildingDeck(false)}>
              {'‹'} Back to Library
            </button>

            <input className="deckbuilder-name-input" value={deckName} onChange={(e) => setDeckName(e.target.value)} />

            <div className="deckbuilder-commander-slot">
              <div className="card-actions-label">Commander</div>
              {commander ? (
                <div className="deckbuilder-commander-card card-clickable-wrapper" {...cardClickProps(commander)}>
                  <Card definition={commander} />
                  <span>{commander.name}</span>
                </div>
              ) : commanderId ? (
                <p className="card-actions-hint">This deck's commander no longer exists in the card pool - pick a new one.</p>
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
                    {'–'}
                  </button>
                </div>
              ))}
            </div>

            <div className="deckbuilder-buttons">
              <button onClick={handleSave}>Save deck</button>
              <button onClick={handleExport}>Export as text</button>
            </div>

            <p className="account-tab-hint">
              {user ? 'Decks save to your account - they’ll follow you to any computer you log in from.' : 'Not logged in - decks save to this browser only.'}
            </p>
            {saveError && <p className="account-tab-error">{saveError}</p>}

            {canImportLocal && (
              <button className="card-action-button secondary" onClick={handleImportLocal} disabled={importing}>
                {importing ? 'Importing…' : 'Import decks saved in this browser'}
              </button>
            )}

            {savedDecksList}
          </>
        ) : (
          <>
            <button className="deckbuilder-create-button" onClick={startNewDeck}>
              Create Deck
            </button>

            {saveError && <p className="account-tab-error">{saveError}</p>}

            {canImportLocal && (
              <button className="card-action-button secondary" onClick={handleImportLocal} disabled={importing}>
                {importing ? 'Importing…' : 'Import decks saved in this browser'}
              </button>
            )}

            {savedDecksList}
          </>
        )}
      </div>

      {viewingDeck && (
        <DeckViewModal
          title={viewingDeck.name}
          commander={tryGetCardDefinition(viewingDeck.commanderId)}
          cardGroups={groupCardIds(viewingDeck.cardIds)}
          onClose={() => setViewingDeck(null)}
        />
      )}

      {fullScreenModal}
    </div>
  );
}
