import React from 'react';
import { CardDefinition, CardInstance } from '../types';
import Card from './Card';

interface DiscardModalProps {
  sourceName: string;
  count: number;
  cards: { definition: CardDefinition; instance: CardInstance }[];
  onChoose: (instanceId: string) => void;
}

/**
 * Shown while a LootEffect's discard step is outstanding, e.g. Emet-Selch,
 * Unsundered's "draw a card, then discard a card" - `cards` is the
 * controller's whole hand (the discard isn't restricted to the card just
 * drawn), and `count` tracks how many discards are still owed if the
 * effect calls for more than one. No cancel - the discard is mandatory
 * whenever the hand isn't already empty, which is the only time this modal
 * shows at all.
 */
export default function DiscardModal({ sourceName, count, cards, onChoose }: DiscardModalProps) {
  return (
    <div className="card-actions-overlay">
      <div className="zone-modal">
        <div className="card-actions-header">
          <strong>{sourceName} - Discard</strong>
        </div>
        <p className="card-actions-text">
          Choose a card from your hand to discard{count > 1 ? ` (${count} left to discard)` : ''}.
        </p>
        <div className="zone-modal-grid">
          {cards.map((c) => (
            <Card key={c.instance.instanceId} definition={c.definition} instance={c.instance} onClick={() => onChoose(c.instance.instanceId)} />
          ))}
        </div>
      </div>
    </div>
  );
}
