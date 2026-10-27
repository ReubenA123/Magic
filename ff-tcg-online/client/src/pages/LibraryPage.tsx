import React, { useEffect, useMemo, useState } from 'react';
import { CARD_POOL, getCardDefinition, tryGetCardDefinition } from '../data/cards';
import { getCardBackImagePath } from '../data/cardBacks';
import { CardDefinition, CardType } from '../types';
import Card from '../components/Card';
import CardArtStack from '../components/CardArtStack';
import DeckViewModal from '../components/DeckViewModal';
import CardBackPickerModal from '../components/CardBackPickerModal';
import { isLegalCommander, canAddCopy, isTransformBackFace } from '../utils/commander';
import { groupByArtVariants } from '../utils/artVariants';
import {
  loadDecks,
  saveDeck,
  deleteDeck,
  newDeckId,
  hasLocalDecksToImport,
  importLocalDecksToAccount,
  sortDecksFavouritesFirst,
  SavedDeck,
} from '../utils/deckStorage';
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
  // Cosmetic only - which library pile skin this deck uses (see
  // data/cardBacks.ts). Null = the plain default back.
  const [cardBackId, setCardBackId] = useState<string | null>(null);
  const [showCardBackPicker, setShowCardBackPicker] = useState(false);
  // The saved deck currently loaded into the editor above, if any - so
  // "Save deck" updates THAT deck in place (same id, and its createdAt/
  // favourite/lastPlayedAt carried over) instead of always minting a new
  // one. Null while building a brand new deck from scratch; set the moment
  // an existing deck is loaded OR the first time a new one is saved (so a
  // second "Save deck" click on the same session updates it too, rather
  // than creating a duplicate every time).
  const [editingDeck, setEditingDeck] = useState<SavedDeck | null>(null);

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
    setCardBackId(null);
    setEditingDeck(null);
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
    // Reuse the loaded deck's id (and whatever it already had for these
    // fields) so this updates it in place instead of saving a duplicate -
    // only a genuinely new deck (editingDeck still null) mints a fresh id.
    const deck: SavedDeck = {
      id: editingDeck?.id ?? newDeckId(),
      name: deckName || 'Untitled Deck',
      commanderId,
      cardIds,
      createdAt: editingDeck?.createdAt ?? now,
      updatedAt: now,
      lastPlayedAt: editingDeck?.lastPlayedAt ?? null,
      favourite: editingDeck?.favourite ?? false,
      cardBackId,
    };
    setSaveError(null);
    try {
      await saveDeck(deck);
      refreshSavedDecks();
      setEditingDeck(deck); // further saves this session keep updating it too
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save that deck.');
    }
  }

  function handleLoad(deck: SavedDeck) {
    setDeckName(deck.name);
    setCommanderId(deck.commanderId);
    setCardBackId(deck.cardBackId ?? null);
    setCardIds(deck.cardIds);
    setEditingDeck(deck);
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

  // If the deck being renamed/favourited/re-skinned here is ALSO the one
  // currently loaded into the builder (same id), keep that in sync too -
  // otherwise a later "Save deck" click there would silently overwrite the
  // change with the builder's own stale copy of it.
  function syncEditingDeck(updated: SavedDeck) {
    setEditingDeck((prev) => (prev?.id === updated.id ? updated : prev));
  }

  async function handleRenameSavedDeck(deck: SavedDeck, name: string) {
    const updated = { ...deck, name };
    setSaveError(null);
    try {
      await saveDeck(updated);
      refreshSavedDecks();
      setViewingDeck((prev) => (prev?.id === deck.id ? updated : prev));
      syncEditingDeck(updated);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not rename that deck.');
    }
  }

  async function handleToggleFavourite(deck: SavedDeck) {
    const updated = { ...deck, favourite: !deck.favourite };
    setSaveError(null);
    try {
      await saveDeck(updated);
      refreshSavedDecks();
      setViewingDeck((prev) => (prev?.id === deck.id ? updated : prev));
      syncEditingDeck(updated);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not update that deck.');
    }
  }

  async function handleChangeCardBackSavedDeck(deck: SavedDeck, newCardBackId: string) {
    const updated = { ...deck, cardBackId: newCardBackId };
    setSaveError(null);
    try {
      await saveDeck(updated);
      refreshSavedDecks();
      setViewingDeck((prev) => (prev?.id === deck.id ? updated : prev));
      syncEditingDeck(updated);
      // Also reflect it live if this exact deck happens to be open in the
      // builder right now, so the two views never disagree.
      if (editingDeck?.id === deck.id) setCardBackId(newCardBackId);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not update that deck.');
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
      {sortDecksFavouritesFirst(savedDecks).map((d) => (
        <div key={d.id} className="deckbuilder-list-row">
          <button className="deckbuilder-deck-name-link" onClick={() => setViewingDeck(d)}>
            {d.favourite && <span className="deckview-favourite-star deckview-favourite-star-active deckview-favourite-star-inline">{'★'}</span>}
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

            <div className="deckbuilder-top-row">
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

              <div className="deckbuilder-cardback-slot">
                <div className="card-actions-label">Card Back</div>
                {cardBackId && (
                  <div className="deckbuilder-cardback-preview">
                    <img src={getCardBackImagePath(cardBackId)} alt="" />
                  </div>
                )}
                <button className="deckbuilder-cardback-change-button" onClick={() => setShowCardBackPicker(true)}>
                  Change Card Back
                </button>
              </div>
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
          editable={{
            favourite: !!viewingDeck.favourite,
            onRename: (name) => handleRenameSavedDeck(viewingDeck, name),
            onToggleFavourite: () => handleToggleFavourite(viewingDeck),
            cardBackId: viewingDeck.cardBackId ?? null,
            onChangeCardBack: (id) => handleChangeCardBackSavedDeck(viewingDeck, id),
          }}
        />
      )}

      {showCardBackPicker && <CardBackPickerModal selectedId={cardBackId} onSelect={setCardBackId} onClose={() => setShowCardBackPicker(false)} />}

      {fullScreenModal}
    </div>
  );
}
