import React, { useState } from 'react';
import { CardDefinition } from '../types';
import CardFullScreenModal from '../components/CardFullScreenModal';

/** Shared "click a card, see it full screen" behaviour - used by the
 * Library/Deck Builder pool, the chosen commander slot, saved-deck
 * previews, and the art-variant picker. Spread `cardClickProps(def)` onto
 * whatever wraps a <Card> to wire up the click; render `fullScreenModal`
 * once near the bottom of the component. */
export function useCardFullScreen() {
  const [shown, setShown] = useState<CardDefinition | null>(null);

  function cardClickProps(definition: CardDefinition) {
    return { onClick: () => setShown(definition) };
  }

  const fullScreenModal = shown ? <CardFullScreenModal definition={shown} onClose={() => setShown(null)} /> : null;

  return { cardClickProps, fullScreenModal };
}
