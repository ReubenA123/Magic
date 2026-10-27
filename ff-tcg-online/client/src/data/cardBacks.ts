// ============================================================================
// data/cardBacks.ts
//
// Cosmetic card-back designs a player can pick for their deck (see the
// Library's deck editor) - purely visual, shown wherever that deck's
// library pile renders face down during a game (see GameBoard.tsx and
// PlayerState.libraryCardBackId). Not CardDefinitions - these never sit in
// a zone, get cast, or interact with anything rules-wise.
// ============================================================================

export interface CardBack {
  id: string;
  name: string;
  imagePath: string;
}

export const DEFAULT_CARD_BACK_ID = 'default';

export const CARD_BACKS: CardBack[] = [
  { id: DEFAULT_CARD_BACK_ID, name: 'Default', imagePath: '/assets/cards/card-back.jpg' },
  { id: 'you-okay', name: 'You Okay', imagePath: '/assets/cards/You-Okay.jpg' }, // Kevin Hong
  { id: 'vivi', name: 'Vivi', imagePath: '/assets/cards/vivi.jpg' },
  { id: 'aerith-and-cloud', name: 'Aerith and Cloud', imagePath: '/assets/cards/Aerith-and-Cloud.jpg' }, // c7肘 (kieta_c7)
  { id: 'ff6', name: 'FF6', imagePath: '/assets/cards/Ff6.jpg' },
  { id: 'moogle-music', name: 'Moogle Music', imagePath: '/assets/cards/moogle-music.jpg' },
  { id: 'yuna', name: 'Yuna', imagePath: '/assets/cards/Yuna.jpg' },
  { id: 'phoenix', name: 'Phoenix', imagePath: '/assets/cards/Phoenix.jpg' },
  { id: 'shivva', name: 'Shivva', imagePath: '/assets/cards/Shivva.jpg' },
];

/** Never throws - an unrecognised or missing id (a deck saved before some
 * since-removed back, or no pick at all) just falls back to the default
 * back's image, the same way a missing card's art falls back to a
 * placeholder elsewhere in the app. */
export function getCardBackImagePath(cardBackId: string | null | undefined): string {
  const found = cardBackId ? CARD_BACKS.find((b) => b.id === cardBackId) : undefined;
  return (found ?? CARD_BACKS[0]).imagePath;
}
