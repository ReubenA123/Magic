import React from 'react';
import { CardInstance } from '../types';
import { getCardDefinition } from '../data/cards';
import Card from './Card';

interface ZoneModalProps {
  title: string;
  cards: CardInstance[];
  onClose: () => void;
  onCardClick: (instanceId: string) => void;
}

/** Graveyard and exile are public zones in Magic - either player can look
 * through either player's pile, so this modal doesn't distinguish "yours"
 * vs "theirs." Clicking a card opens the same CardActionsPanel used
 * everywhere else, so you can e.g. return a creature from a graveyard to
 * hand for a reanimation-style effect. */
export default function ZoneModal({ title, cards, onClose, onCardClick }: ZoneModalProps) {
  return (
    <div className="card-actions-overlay" onClick={onClose}>
      <div className="zone-modal" onClick={(e) => e.stopPropagation()}>
        <div className="card-actions-header">
          <strong>{title}</strong>
          <button className="close-button" onClick={onClose}>
            {'\u2715'}
          </button>
        </div>
        {cards.length === 0 ? (
          <p className="card-actions-hint">Empty.</p>
        ) : (
          <div className="zone-modal-grid">
            {cards.map((c) => (
              <Card key={c.instanceId} definition={getCardDefinition(c.defId)} instance={c} onClick={() => onCardClick(c.instanceId)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
