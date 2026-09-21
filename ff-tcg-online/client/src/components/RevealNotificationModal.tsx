import React from 'react';
import { CardDefinition, CardInstance } from '../types';
import Card from './Card';

interface RevealNotificationModalProps {
  ownerName: string;
  sourceName: string;
  definition: CardDefinition;
  instance: CardInstance;
  onDismiss: () => void;
}

/**
 * A passing "you were just shown a card" notification for GameState.lastReveal
 * (currently only posted by a pendingLibrarySearch pick - see
 * engine/actions.ts: resolveLibrarySearch) - same "already happened
 * server-side, this is just presentation" shape as CoinFlipModal's reveal
 * phase. The card itself keeps living face-up with a purple outline for as
 * long as it's genuinely still sitting in its owner's hand (see Card's
 * revealedInHand prop) - this modal is just the one-time "heads up, this
 * just got revealed" moment, not the ongoing way to look at it again.
 */
export default function RevealNotificationModal({ ownerName, sourceName, definition, instance, onDismiss }: RevealNotificationModalProps) {
  return (
    <div className="card-actions-overlay">
      <div className="zone-modal">
        <div className="card-actions-header">
          <strong>{ownerName} has revealed</strong>
        </div>
        <div className="zone-modal-grid">
          <Card definition={definition} instance={instance} />
        </div>
        <p className="card-actions-text">Revealed from {sourceName}.</p>
        <button className="card-action-button secondary" onClick={onDismiss}>
          Close
        </button>
      </div>
    </div>
  );
}
