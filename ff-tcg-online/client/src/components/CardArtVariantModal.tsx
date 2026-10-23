import React from 'react';
import { CardDefinition } from '../types';
import Card from './Card';

/** Deck Builder-only actions - omitted entirely when this modal is opened
 * from the read-only Library page, which just shows the arts with no
 * buttons at all. */
export interface ArtVariantDeckBuilderActions {
  commanderId: string | null;
  cardIds: string[];
  canAddCopy: (def: CardDefinition, currentCardIds: string[]) => boolean;
  isLegalCommander: (def: CardDefinition) => boolean;
  onAdd: (defId: string) => void;
  onSetCommander: (defId: string) => void;
}

interface CardArtVariantModalProps {
  name: string;
  variants: CardDefinition[];
  onClose: () => void;
  deckBuilder?: ArtVariantDeckBuilderActions;
}

/**
 * Lets the player pick between a card's alternate arts/printings (e.g. the
 * 15 "Cid, Timeless Artificer" cards, one per Final Fantasy game he's in).
 * In the Deck Builder, each art can be added to the deck and/or set as
 * commander independently - they're still the same named card everywhere
 * else (singleton/colour-identity rules key off name, not id).
 */
export default function CardArtVariantModal({ name, variants, onClose, deckBuilder }: CardArtVariantModalProps) {
  return (
    <div className="card-actions-overlay" onClick={onClose}>
      <div className="zone-modal" onClick={(e) => e.stopPropagation()}>
        <div className="card-actions-header">
          <strong>{name} - Choose an art ({variants.length})</strong>
          <button className="close-button" onClick={onClose}>
            {'✕'}
          </button>
        </div>

        <div className="zone-modal-grid art-variant-modal-grid">
          {variants.map((def) => {
            const isCommander = deckBuilder?.commanderId === def.id;
            const canAdd = !!deckBuilder && !isCommander && deckBuilder.canAddCopy(def, deckBuilder.cardIds);
            const legalCommander = !!deckBuilder?.isLegalCommander(def);
            const countInDeck = deckBuilder ? deckBuilder.cardIds.filter((id) => id === def.id).length : 0;
            return (
              <div key={def.id} className="art-variant-item">
                <Card definition={def} />
                {countInDeck > 0 && (
                  <span className="deckview-card-count" title={`${countInDeck} copy/copies of this art in your deck`}>
                    x{countInDeck}
                  </span>
                )}
                {deckBuilder && (
                  <div className="deckbuilder-pool-actions">
                    <button
                      disabled={!legalCommander}
                      onClick={() => deckBuilder.onSetCommander(def.id)}
                      title={legalCommander ? '' : 'Must be a legendary creature, not a transform back face'}
                    >
                      {isCommander ? 'Is your commander' : 'Set as Commander'}
                    </button>
                    <button disabled={!canAdd} onClick={() => deckBuilder.onAdd(def.id)}>
                      {isCommander ? "Can't add commander" : canAdd ? 'Add to deck' : 'Already in deck'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
