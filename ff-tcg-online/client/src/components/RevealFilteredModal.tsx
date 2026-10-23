import React from 'react';
import { CardDefinition, CardInstance, CardType } from '../types';
import Card from './Card';

interface RevealFilteredModalProps {
  sourceName: string;
  filterType: CardType | CardType[];
  cards: { definition: CardDefinition; instance: CardInstance }[];
  onChoose: (instanceId: string) => void;
  onSkip: () => void;
  /** Defaults to 'hand'. 'battlefieldTapped' (Ignis Scientia),
   * 'battlefieldTappedAttacking' (Bartz Klauser), and 'battlefieldUntapped'
   * (Seymour Guado) adjust the copy below to match
   * RevealFilteredEffect.takenDestination. */
  takenDestination?: 'hand' | 'battlefieldTapped' | 'battlefieldTappedAttacking' | 'battlefieldUntapped';
}

/**
 * Shown while a RevealFilteredEffect (see types.ts) is outstanding, e.g.
 * Ashe, Princess of Dalmasca's "look at the top five cards of your library,
 * you may reveal an artifact card and put it into your hand" - `cards` is
 * the full revealed pile (library-derived, so private - only the controller
 * or soloControl ever renders this, gated in GameBoard). Only a card matching
 * `filterType` is clickable; Skip sends everything to the bottom in a random
 * order (RESOLVE_REVEAL_FILTERED with instanceId: null).
 */
export default function RevealFilteredModal({ sourceName, filterType, cards, onChoose, onSkip, takenDestination = 'hand' }: RevealFilteredModalProps) {
  const filterTypes = Array.isArray(filterType) ? filterType : [filterType];
  const destinationNote =
    takenDestination === 'battlefieldTappedAttacking'
      ? 'put it onto the battlefield tapped and attacking'
      : takenDestination === 'battlefieldTapped'
        ? 'put it onto the battlefield tapped'
        : takenDestination === 'battlefieldUntapped'
          ? 'put it onto the battlefield'
          : 'take it into your hand';
  return (
    <div className="card-actions-overlay">
      <div className="zone-modal">
        <div className="card-actions-header">
          <strong>{sourceName} - Reveal</strong>
        </div>
        <p className="card-actions-text">You may choose a {filterTypes.join(' or ')} card from among these to {destinationNote}. The rest go to the bottom of your library in a random order.</p>
        <div className="zone-modal-grid">
          {cards.map((c) => {
            const eligible = filterTypes.includes(c.definition.type);
            return (
              <Card
                key={c.instance.instanceId}
                definition={c.definition}
                instance={c.instance}
                onClick={eligible ? () => onChoose(c.instance.instanceId) : undefined}
                dimmed={!eligible}
              />
            );
          })}
        </div>
        <div className="card-actions-bottom-row">
          <button className="card-action-button secondary" onClick={onSkip}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
