import React from 'react';
import { CardDefinition, CardInstance } from '../types';
import Card from './Card';

interface HideawayModalProps {
  sourceName: string;
  count: number;
  cards: { definition: CardDefinition; instance: CardInstance }[];
  onChoose: (instanceId: string) => void;
}

/**
 * Shown while a HideawayEffect (see types.ts) is outstanding, e.g. Clive's
 * Hideaway's "Hideaway 4" - `cards` is the full looked-at pile (library-
 * derived, so private - only the controller or soloControl ever renders
 * this, gated in GameBoard). Unlike RevealFilteredModal, there's no Skip:
 * the reminder text has no "may", so exactly one of these must be chosen -
 * it goes to exile face down, tied to the source permanent, and the rest go
 * to the bottom of the library in a random order (RESOLVE_HIDEAWAY).
 */
export default function HideawayModal({ sourceName, count, cards, onChoose }: HideawayModalProps) {
  return (
    <div className="card-actions-overlay">
      <div className="zone-modal">
        <div className="card-actions-header">
          <strong>{sourceName} - Hideaway {count}</strong>
        </div>
        <p className="card-actions-text">
          Choose one of these {count} cards to exile face down. The rest go to the bottom of your library in a random order.
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
