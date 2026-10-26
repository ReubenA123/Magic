import React, { useState } from 'react';
import { CardDefinition } from '../types';
import { getCardDefinition } from '../data/cards';
import Card from './Card';

interface CardFullScreenModalProps {
  definition: CardDefinition;
  onClose: () => void;
}

/** A big, legible view of a single card - opened by clicking almost any
 * card tile across the Library/Deck Builder (the pool grid, the chosen
 * commander, a saved deck's contents, an art-variant picker). No close
 * button - click anywhere off the card to dismiss it, same as every other
 * overlay in the app. Transform cards get a flip button in that same
 * top-right corner instead, to see their back face. */
export default function CardFullScreenModal({ definition, onClose }: CardFullScreenModalProps) {
  const [flipped, setFlipped] = useState(false);
  const isFlippable = !!definition.transformsInto;
  const shownDef = isFlippable && flipped ? getCardDefinition(definition.transformsInto!) : definition;

  return (
    <div className="card-actions-overlay card-fullscreen-overlay" onClick={onClose}>
      <div className="card-fullscreen-frame" onClick={(e) => e.stopPropagation()}>
        {isFlippable && (
          <button className="flip-icon-button" onClick={() => setFlipped((f) => !f)} title="Flip / show transformed side">
            {'↻'}
          </button>
        )}
        <Card definition={shownDef} />
      </div>
    </div>
  );
}
