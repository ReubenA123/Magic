// ============================================================================
// data/cards.ts
//
// NOTE ON DUPLICATION: this is a copy of /server/src/data/cards.ts. The
// server only sends CardInstance objects (defId + state) over the wire, not
// full CardDefinition objects, so the client needs its own copy of the pool
// to look up names/art/text. Keep both in sync when you edit either one.
//
// The card pool. Since nothing here is parsed by the engine (see types.ts),
// `text` can just be the real, full rules text for the card - you and your
// brother read it and apply it by hand, using the tap/counter/life/zone
// controls the app gives you. Adding a new card is pure data entry: copy an
// entry below, give it a unique id, done. Remember to make the same edit in
// /client/src/data/cards.ts.
//
// costLabel is shown on the card but isn't checked against anything - it's
// there so you both know what you're "supposed" to pay, the same way it
// would be printed on a physical card.
// ============================================================================

import { CardDefinition } from '../types';

export const CARD_POOL: CardDefinition[] = [
  // --- Lands -----------------------------------------------------------
  { id: 'fire-crystal', name: 'Fire Crystal', type: 'land', costLabel: '-', text: 'Tap: add R.', imagePath: '/assets/cards/fire-crystal.jpg' },
  { id: 'water-crystal', name: 'Water Crystal', type: 'land', costLabel: '-', text: 'Tap: add U.', imagePath: '/assets/cards/water-crystal.jpg' },
  { id: 'earth-crystal', name: 'Earth Crystal', type: 'land', costLabel: '-', text: 'Tap: add G.', imagePath: '/assets/cards/earth-crystal.jpg' },
  { id: 'holy-crystal', name: 'Holy Crystal', type: 'land', costLabel: '-', text: 'Tap: add W.', imagePath: '/assets/cards/holy-crystal.jpg' },
  { id: 'shadow-crystal', name: 'Shadow Crystal', type: 'land', costLabel: '-', text: 'Tap: add B.', imagePath: '/assets/cards/shadow-crystal.jpg' },

  // --- Creatures ---------------------------------------------------------
  {
    id: 'cloud-strife',
    name: 'Cloud Strife',
    type: 'creature',
    costLabel: '1R',
    power: 3,
    toughness: 3,
    text: 'Whenever Cloud Strife attacks, you may put a +1/+1 counter on him.',
    imagePath: '/assets/cards/cloud-strife.jpg',
  },
  {
    id: 'tifa-lockhart',
    name: 'Tifa Lockhart',
    type: 'creature',
    costLabel: '1W',
    power: 2,
    toughness: 3,
    text: 'First strike.',
    imagePath: '/assets/cards/tifa-lockhart.jpg',
  },
  {
    id: 'squall-leonhart',
    name: 'Squall Leonhart',
    type: 'creature',
    costLabel: '2U',
    power: 3,
    toughness: 2,
    text: 'Whenever Squall Leonhart deals combat damage to a player, draw a card, then discard a card.',
    imagePath: '/assets/cards/squall-leonhart.jpg',
  },
  {
    id: 'yuna',
    name: 'Yuna',
    type: 'creature',
    costLabel: '1W',
    power: 1,
    toughness: 3,
    text: 'Lifelink. 1W, Tap: put a +1/+1 counter on target creature.',
    imagePath: '/assets/cards/yuna.jpg',
  },
  {
    id: 'vivi-ornitier',
    name: 'Vivi Ornitier',
    type: 'creature',
    costLabel: '1R',
    power: 1,
    toughness: 1,
    text: '1R, Tap, Sacrifice Vivi Ornitier: deal 3 damage to any target.',
    imagePath: '/assets/cards/vivi-ornitier.jpg',
  },
  {
    id: 'auron',
    name: 'Auron',
    type: 'creature',
    costLabel: '3B',
    power: 4,
    toughness: 4,
    text: 'Trample. Auron cannot block creatures with power 2 or less.',
    imagePath: '/assets/cards/auron.jpg',
  },
  {
    id: 'terra-branford',
    name: 'Terra Branford',
    type: 'creature',
    costLabel: '2U',
    power: 2,
    toughness: 4,
    text: 'Flying. When Terra Branford enters the battlefield, you may draw a card, then discard a card.',
    imagePath: '/assets/cards/terra-branford.jpg',
  },
  {
    id: 'kefka-palazzo',
    name: 'Kefka Palazzo',
    type: 'creature',
    costLabel: '3B',
    power: 3,
    toughness: 3,
    text: 'At the beginning of your upkeep, each player discards a card at random.',
    imagePath: '/assets/cards/kefka-palazzo.jpg',
  },
  {
    id: 'sephiroth',
    name: 'Sephiroth',
    type: 'creature',
    costLabel: '4BB',
    power: 6,
    toughness: 5,
    text: 'Flying, deathtouch. Sephiroth cannot be blocked by more than one creature.',
    imagePath: '/assets/cards/sephiroth.jpg',
  },
  {
    id: 'red-xiii',
    name: 'Red XIII',
    type: 'creature',
    costLabel: '2G',
    power: 3,
    toughness: 3,
    text: 'Haste. Whenever another creature you control enters the battlefield, Red XIII gets +1/+0 until end of turn.',
    imagePath: '/assets/cards/red-xiii.jpg',
  },
  {
    id: 'shantotto',
    name: 'Shantotto',
    type: 'creature',
    costLabel: '1U',
    power: 1,
    toughness: 2,
    text: 'Whenever you cast an instant or sorcery spell, scry 1 (look at the top card of your library, then decide whether to keep it there or put it on the bottom).',
    imagePath: '/assets/cards/shantotto.jpg',
  },

  // --- Instants / Sorceries -------------------------------------------------
  {
    id: 'firaga',
    name: 'Firaga',
    type: 'sorcery',
    costLabel: '2R',
    text: 'Deal 4 damage to any target.',
    imagePath: '/assets/cards/firaga.jpg',
  },
  {
    id: 'blizzaga',
    name: 'Blizzaga',
    type: 'instant',
    costLabel: '1U',
    text: 'Tap target creature. It does not untap during its controller\u2019s next untap step.',
    imagePath: '/assets/cards/blizzaga.jpg',
  },
  {
    id: 'cure',
    name: 'Cure',
    type: 'instant',
    costLabel: '1W',
    text: 'Restore 4 life to target player. If that player controls a creature named Yuna, restore 6 life instead.',
    imagePath: '/assets/cards/cure.jpg',
  },
  {
    id: 'meteor',
    name: 'Meteor',
    type: 'sorcery',
    costLabel: '4RR',
    text: 'Deal 6 damage divided as you choose among any number of target creatures and/or players.',
    imagePath: '/assets/cards/meteor.jpg',
  },
  {
    id: 'phoenix-down',
    name: 'Phoenix Down',
    type: 'instant',
    costLabel: 'W',
    text: 'Return target creature card from your graveyard to your hand.',
    imagePath: '/assets/cards/phoenix-down.jpg',
  },

  // --- Artifacts --------------------------------------------------------
  {
    id: 'materia-shard',
    name: 'Materia Shard',
    type: 'artifact',
    costLabel: '1',
    text: 'Tap: add one mana of any color. 3, Tap, Sacrifice Materia Shard: draw a card.',
    imagePath: '/assets/cards/materia-shard.jpg',
  },
];

export function getCardDefinition(defId: string): CardDefinition {
  const def = CARD_POOL.find((c) => c.id === defId);
  if (!def) throw new Error(`Unknown card id: ${defId}`);
  return def;
}

/**
 * One fixed 40-card decklist: lands spread across the five crystals, plus
 * two copies of every nonland card. No deck builder yet - both players play
 * this same list. A natural next step is a deck-selection screen that picks
 * a subset of CARD_POOL per player instead of hardcoding this.
 */
export function buildDefaultDecklist(): string[] {
  const lands = ['fire-crystal', 'water-crystal', 'earth-crystal', 'holy-crystal', 'shadow-crystal'];
  const nonlands = CARD_POOL.filter((c) => c.type !== 'land').map((c) => c.id);

  const decklist: string[] = [];
  for (let i = 0; i < 17; i++) decklist.push(lands[i % lands.length]);
  for (const id of nonlands) decklist.push(id, id);
  return decklist;
}
