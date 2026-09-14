import React from 'react';
import { CardDefinition, CardInstance } from '../types';
import Card from './Card';

interface OptionalBounceModalProps {
  sourceName: string;
  cards: { definition: CardDefinition; instance: CardInstance }[];
  onChoose: (instanceId: string) => void;
  onSkip: () => void;
}

/**
 * Shown while an OptionalBounceEffect (see types.ts) is outstanding, e.g.
 * Ambrosia Whiteheart's "you may return another permanent you control to its
 * owner's hand" - `cards` is every OTHER permanent the controller currently
 * has on the battlefield (public information, unlike a hand/library reveal,
 * so no privacy gating is needed here). Skip declines - RESOLVE_OPTIONAL_BOUNCE
 * with instanceId: null.
 */
export default function OptionalBounceModal({ sourceName, cards, onChoose, onSkip }: OptionalBounceModalProps) {
  return (
    <div className="card-actions-overlay">
      <div className="zone-modal">
        <div className="card-actions-header">
          <strong>{sourceName} - Return a permanent?</strong>
        </div>
        <p className="card-actions-text">You may return another permanent you control to its owner's hand.</p>
        {cards.length > 0 ? (
          <div className="zone-modal-grid">
            {cards.map((c) => (
              <Card key={c.instance.instanceId} definition={c.definition} instance={c.instance} onClick={() => onChoose(c.instance.instanceId)} />
            ))}
          </div>
        ) : (
          <p className="card-actions-text">No other permanent to return.</p>
        )}
        <div className="card-actions-bottom-row">
          <button className="card-action-button secondary" onClick={onSkip}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
