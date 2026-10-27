import React, { useState } from 'react';
import { CardDefinition, CardType } from '../types';
import Card from './Card';
import CardBackPickerModal from './CardBackPickerModal';
import { getCardBackImagePath } from '../data/cardBacks';
import { useCardFullScreen } from '../hooks/useCardFullScreen';

const TYPE_ORDER: CardType[] = ['creature', 'artifact', 'enchantment', 'instant', 'sorcery', 'land'];
const TYPE_LABELS: Record<CardType, string> = {
  creature: 'Creatures',
  artifact: 'Artifacts',
  enchantment: 'Enchantments',
  instant: 'Instants',
  sorcery: 'Sorceries',
  land: 'Lands',
};

/** Only present for a deck the viewer actually owns - omitted when browsing
 * someone else's published community deck, which isn't yours to rename or
 * favourite. */
export interface DeckViewEditableProps {
  favourite: boolean;
  onRename: (name: string) => void;
  onToggleFavourite: () => void;
  cardBackId: string | null;
  onChangeCardBack: (id: string) => void;
}

interface DeckViewModalProps {
  title: string;
  commander: CardDefinition | null;
  cardGroups: { def: CardDefinition; count: number }[];
  onClose: () => void;
  editable?: DeckViewEditableProps;
}

export default function DeckViewModal({ title, commander, cardGroups, onClose, editable }: DeckViewModalProps) {
  const { cardClickProps, fullScreenModal } = useCardFullScreen();
  const [nameDraft, setNameDraft] = useState(title);
  const [showCardBackPicker, setShowCardBackPicker] = useState(false);

  function commitRename() {
    const trimmed = nameDraft.trim();
    if (editable && trimmed && trimmed !== title) editable.onRename(trimmed);
    else setNameDraft(title); // blank or unchanged - snap back rather than saving garbage
  }

  const groupedByType = TYPE_ORDER.map((type) => ({
    type,
    groups: cardGroups.filter((g) => g.def.type === type),
  })).filter((section) => section.groups.length > 0);

  return (
    <>
      <div className="card-actions-overlay deck-view-overlay" onClick={onClose}>
        <div className="zone-modal deck-view-modal" onClick={(e) => e.stopPropagation()}>
          <div className="card-actions-header">
            {editable ? (
              <div className="deckview-title-row">
                <button
                  className={`deckview-favourite-star ${editable.favourite ? 'deckview-favourite-star-active' : ''}`}
                  onClick={editable.onToggleFavourite}
                  title={editable.favourite ? 'Unfavourite this deck' : 'Favourite this deck - pins it to the top of your list'}
                >
                  {editable.favourite ? '★' : '☆'}
                </button>
                <input
                  className="deckview-name-input"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                />
              </div>
            ) : (
              <strong>{title}</strong>
            )}
            <button className="close-button" onClick={onClose}>
              {'✕'}
            </button>
          </div>

          {(commander || editable) && (
            <div className="deckview-commander-row">
              <div className="deckview-commander-main">
                {commander && (
                  <div className="card-clickable-wrapper" {...cardClickProps(commander)}>
                    <Card definition={commander} />
                  </div>
                )}
                <div>
                  <div className="card-actions-label">Commander</div>
                  <div>{commander?.name}</div>
                </div>
              </div>

              {editable && (
                <div className="deckbuilder-cardback-slot">
                  <div className="card-actions-label">Card Back</div>
                  {editable.cardBackId && (
                    <div className="deckbuilder-cardback-preview">
                      <img src={getCardBackImagePath(editable.cardBackId)} alt="" />
                    </div>
                  )}
                  <button className="deckbuilder-cardback-change-button" onClick={() => setShowCardBackPicker(true)}>
                    Change Card Back
                  </button>
                </div>
              )}
            </div>
          )}

          {cardGroups.length === 0 ? (
            <p className="card-actions-hint">No other cards in this deck.</p>
          ) : (
            groupedByType.map(({ type, groups }) => (
              <div key={type} className="deckview-type-section">
                <div className="card-actions-label">
                  {TYPE_LABELS[type]} ({groups.reduce((sum, g) => sum + g.count, 0)})
                </div>
                <div className="zone-modal-grid">
                  {groups.map(({ def, count }) => (
                    <div key={def.id} className="deckview-card-item card-clickable-wrapper" {...cardClickProps(def)}>
                      <Card definition={def} />
                      <span className="deckview-card-count">x{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showCardBackPicker && editable && (
        <CardBackPickerModal selectedId={editable.cardBackId} onSelect={editable.onChangeCardBack} onClose={() => setShowCardBackPicker(false)} />
      )}

      {fullScreenModal}
    </>
  );
}
