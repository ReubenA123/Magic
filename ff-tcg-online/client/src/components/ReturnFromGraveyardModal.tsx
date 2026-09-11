import React from 'react';
import { CardDefinition, CardInstance } from '../types';
import Card from './Card';

interface ReturnFromGraveyardModalProps {
  sourceName: string;
  cards: { definition: CardDefinition; instance: CardInstance }[];
  onChoose: (instanceId: string) => void;
}

/**
 * Shown while a MillThenReturnEffect (see types.ts) is waiting on its
 * mandatory return step, e.g. Vanille, Cheerful l'Cie's "mill two, then
 * return a permanent card from your graveyard to your hand" - `cards` is
 * every eligible permanent currently in the controller's graveyard (not just
 * the newly milled ones), matching the card's actual wording. No cancel -
 * the return is mandatory whenever at least one eligible card exists, which
 * is the only time this modal is shown at all.
 */
export default function ReturnFromGraveyardModal({ sourceName, cards, onChoose }: ReturnFromGraveyardModalProps) {
  return (
    <div className="card-actions-overlay">
      <div className="zone-modal">
        <div className="card-actions-header">
          <strong>{sourceName} - Return a permanent</strong>
        </div>
        <p className="card-actions-text">Choose a permanent card from your graveyard to return to your hand.</p>
        <div className="zone-modal-grid">
          {cards.map((c) => (
            <Card key={c.instance.instanceId} definition={c.definition} instance={c.instance} onClick={() => onChoose(c.instance.instanceId)} />
          ))}
        </div>
      </div>
    </div>
  );
}
