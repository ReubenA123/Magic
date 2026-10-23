import React, { useState } from 'react';
import { CardDefinition } from '../types';
import Card from './Card';
import CardArtVariantModal, { ArtVariantDeckBuilderActions } from './CardArtVariantModal';

interface CardArtStackProps {
  /** All same-named cards this tile represents - must be at least 2, or
   * there'd be nothing to cycle/pick between (use a plain <Card> instead). */
  variants: CardDefinition[];
  deckBuilder?: ArtVariantDeckBuilderActions;
}

/**
 * A Library/Deck Builder grid tile for a card with multiple arts (e.g. Cid,
 * Timeless Artificer's 15 printings). Shows one art at a time with arrows to
 * step through them in place; clicking the card itself opens
 * CardArtVariantModal to see/pick from the full set (and, in the Deck
 * Builder, add the currently-shown art to the deck and/or set it as
 * commander - same buttons a single-art tile gets, just acting on whichever
 * art the arrows have landed on).
 */
export default function CardArtStack({ variants, deckBuilder }: CardArtStackProps) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const current = variants[index];

  function showPrev(e: React.MouseEvent) {
    e.stopPropagation();
    setIndex((i) => (i - 1 + variants.length) % variants.length);
  }

  function showNext(e: React.MouseEvent) {
    e.stopPropagation();
    setIndex((i) => (i + 1) % variants.length);
  }

  const isCommander = deckBuilder?.commanderId === current.id;
  const canAdd = !!deckBuilder && !isCommander && deckBuilder.canAddCopy(current, deckBuilder.cardIds);
  const legalCommander = !!deckBuilder?.isLegalCommander(current);

  return (
    <>
      <div className="card-art-stack">
        <button className="card-art-stack-arrow card-art-stack-arrow-left" onClick={showPrev} title="Previous art">
          {'‹'}
        </button>
        <div className="card-art-stack-card" onClick={() => setOpen(true)} title={`Art ${index + 1} of ${variants.length} - click to choose from all`}>
          <Card definition={current} />
        </div>
        <button className="card-art-stack-arrow card-art-stack-arrow-right" onClick={showNext} title="Next art">
          {'›'}
        </button>
      </div>
      {deckBuilder && (
        <div className="deckbuilder-pool-actions">
          <button
            disabled={!legalCommander}
            onClick={() => deckBuilder.onSetCommander(current.id)}
            title={legalCommander ? '' : 'Must be a legendary creature, not a transform back face'}
          >
            {isCommander ? 'Is your commander' : 'Set as Commander'}
          </button>
          <button disabled={!canAdd} onClick={() => deckBuilder.onAdd(current.id)}>
            {isCommander ? "Can't add commander" : canAdd ? 'Add to deck' : 'Already in deck'}
          </button>
        </div>
      )}
      {open && <CardArtVariantModal name={current.name} variants={variants} onClose={() => setOpen(false)} deckBuilder={deckBuilder} />}
    </>
  );
}
