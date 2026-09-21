import React from 'react';
import { CardDefinition, CardInstance } from '../types';
import Card from './Card';

interface FreeCastModalProps {
  sourceName: string;
  maxManaValue: number;
  cards: { definition: CardDefinition; instance: CardInstance }[];
  onChoose: (instanceId: string) => void;
  onSkip: () => void;
}

/**
 * GameState.pendingFreeCastFromHand (Buster Sword's "draw a card, then you
 * may cast a spell from your hand with mana value less than or equal to
 * that damage without paying its mana cost") - `cards` is already filtered
 * to nonland, mana-value-eligible hand cards (see GameBoard.tsx), so
 * whatever shows here is always a legal pick. Unlike DiscardModal, this is
 * optional ("you may") - Skip always available, and shown even when there's
 * nothing eligible so the player can see why.
 */
export default function FreeCastModal({ sourceName, maxManaValue, cards, onChoose, onSkip }: FreeCastModalProps) {
  return (
    <div className="card-actions-overlay">
      <div className="zone-modal">
        <div className="card-actions-header">
          <strong>{sourceName} - Cast for free</strong>
        </div>
        <p className="card-actions-text">
          {cards.length > 0
            ? `You may cast a spell from your hand with mana value ${maxManaValue} or less, without paying its mana cost.`
            : `Nothing in your hand has mana value ${maxManaValue} or less.`}
        </p>
        <div className="zone-modal-grid">
          {cards.map((c) => (
            <Card key={c.instance.instanceId} definition={c.definition} instance={c.instance} onClick={() => onChoose(c.instance.instanceId)} />
          ))}
        </div>
        <div className="card-actions-bottom-row">
          <button className="card-action-button card-action-button-cancel-x" onClick={onSkip}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
