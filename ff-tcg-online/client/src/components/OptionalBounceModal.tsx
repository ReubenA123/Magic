import React from 'react';
import { CardDefinition, CardInstance } from '../types';
import Card from './Card';

interface OptionalBounceModalProps {
  sourceName: string;
  cards: { definition: CardDefinition; instance: CardInstance }[];
  onChoose: (instanceId: string) => void;
  /** Omit for a MANDATORY return (e.g. Zell Dincht's ReturnControlledLandToHandEffect)
   * - no Skip button is shown, and the caller is expected to have already
   * excluded the case of zero eligible cards (see GameState.pendingLandBounce,
   * only ever set when at least one land exists to return). */
  onSkip?: () => void;
  title?: string;
  prompt?: string;
  emptyText?: string;
}

/**
 * Shown while an OptionalBounceEffect (see types.ts) is outstanding, e.g.
 * Ambrosia Whiteheart's "you may return another permanent you control to its
 * owner's hand" - `cards` is every OTHER permanent the controller currently
 * has on the battlefield (public information, unlike a hand/library reveal,
 * so no privacy gating is needed here). Skip declines - RESOLVE_OPTIONAL_BOUNCE
 * with instanceId: null. Also reused, with onSkip omitted, for the mandatory
 * ReturnControlledLandToHandEffect / RESOLVE_LAND_BOUNCE flow (Zell Dincht).
 */
export default function OptionalBounceModal({
  sourceName,
  cards,
  onChoose,
  onSkip,
  title = 'Return a permanent?',
  prompt = 'You may return another permanent you control to its owner’s hand.',
  emptyText = 'No other permanent to return.',
}: OptionalBounceModalProps) {
  return (
    <div className="card-actions-overlay">
      <div className="zone-modal">
        <div className="card-actions-header">
          <strong>{sourceName} - {title}</strong>
        </div>
        <p className="card-actions-text">{prompt}</p>
        {cards.length > 0 ? (
          <div className="zone-modal-grid">
            {cards.map((c) => (
              <Card key={c.instance.instanceId} definition={c.definition} instance={c.instance} onClick={() => onChoose(c.instance.instanceId)} />
            ))}
          </div>
        ) : (
          <p className="card-actions-text">{emptyText}</p>
        )}
        {onSkip && (
          <div className="card-actions-bottom-row">
            <button className="card-action-button secondary" onClick={onSkip}>
              Skip
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
