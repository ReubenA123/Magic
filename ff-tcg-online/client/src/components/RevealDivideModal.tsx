import React from 'react';
import { CardDefinition, CardInstance } from '../types';
import Card from './Card';

interface RevealDivideModalProps {
  sourceName: string;
  cards: { definition: CardDefinition; instance: CardInstance }[];
  isYourChoice: boolean;
  chooserName: string;
  destinationLabel: string;
  onChoose: (instanceId: string) => void;
}

/**
 * Shown while a RevealAndDivideEffect (see types.ts) is mid-sequence, e.g.
 * Memories Returning's "reveal five, alternate picks" - the revealed cards
 * are public information, so both players see the same grid; only whoever
 * the current step names as chooser can actually click one. No close
 * button - like BlockOrderModal, this represents a mandatory step in
 * resolving the spell, not something to dismiss.
 */
export default function RevealDivideModal({ sourceName, cards, isYourChoice, chooserName, destinationLabel, onChoose }: RevealDivideModalProps) {
  return (
    <div className="card-actions-overlay">
      <div className="zone-modal">
        <div className="card-actions-header">
          <strong>{sourceName} - revealed cards</strong>
        </div>
        <p className="card-actions-text">
          {isYourChoice ? `Choose a card to put into ${destinationLabel}.` : `Waiting for ${chooserName} to choose a card for ${destinationLabel}.`}
        </p>
        <div className="zone-modal-grid">
          {cards.map((c) => (
            <Card key={c.instance.instanceId} definition={c.definition} instance={c.instance} onClick={isYourChoice ? () => onChoose(c.instance.instanceId) : undefined} />
          ))}
        </div>
      </div>
    </div>
  );
}
