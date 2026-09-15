import React from 'react';
import { CardDefinition, CardInstance } from '../types';
import Card from './Card';

interface ReturnFromGraveyardModalProps {
  sourceName: string;
  cards: { definition: CardDefinition; instance: CardInstance }[];
  onChoose: (instanceId: string) => void;
  /** Overrides the default "Return a permanent" / "...to your hand" copy -
   * used by ReanimateModal-shaped callers (Evil Reawakened returns to the
   * BATTLEFIELD, not the hand) and by "up to N" callers (Fight On!). */
  title?: string;
  description?: string;
  /** Only rendered when provided - lets an "up to N" pick (Fight On!) stop
   * early. Omitted entirely for a mandatory pick (Vanille, Evil Reawakened). */
  onCancel?: () => void;
}

/**
 * Shown while a graveyard-to-somewhere effect is waiting on its return step
 * - originally just MillThenReturnEffect (e.g. Vanille, Cheerful l'Cie's
 * "mill two, then return a permanent card from your graveyard to your
 * hand"), now shared with ReanimateTargetFromGraveyardEffect (Evil
 * Reawakened) and ReturnCreaturesFromGraveyardToHandEffect (Fight On!) via
 * the title/description/onCancel overrides above. `cards` is every eligible
 * card currently in the controller's graveyard. No cancel button unless
 * `onCancel` is passed - a mandatory pick is the only time this modal shows
 * at all otherwise.
 */
export default function ReturnFromGraveyardModal({ sourceName, cards, onChoose, title, description, onCancel }: ReturnFromGraveyardModalProps) {
  return (
    <div className="card-actions-overlay">
      <div className="zone-modal">
        <div className="card-actions-header">
          <strong>{sourceName} - {title ?? 'Return a permanent'}</strong>
        </div>
        <p className="card-actions-text">{description ?? 'Choose a permanent card from your graveyard to return to your hand.'}</p>
        <div className="zone-modal-grid">
          {cards.map((c) => (
            <Card key={c.instance.instanceId} definition={c.definition} instance={c.instance} onClick={() => onChoose(c.instance.instanceId)} />
          ))}
        </div>
        {onCancel && (
          <button className="opponent-view-exit-button" onClick={onCancel}>
            Stop
          </button>
        )}
      </div>
    </div>
  );
}
