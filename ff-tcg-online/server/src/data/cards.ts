// ============================================================================
// data/cards.ts
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
  id: 'absolute-virtue',
  name: 'Absolute Virtue',
  type: 'creature',
  subtype: 'Legendary Creature \u2014 Avatar Warrior',
  costLabel:'6WU',
  power: 8,
  toughness: 8,
  text:"This spell can’t be countered. Flying, You have protection from each of your opponents. (You can’t be dealt damage, enchanted, or targeted by anything controlled by your opponents.)",
  imagePath: '/assets/cards/absolute-virtue.webp',
},
{
  id: "adventurer's-airship",
  name: 'Adventurers Airship',
  type: 'artifact',
  costLabel: '3',
  text: 'Flying. Whenever Adventurer\u2019s Airship attacks, you may draw a card, then discard a card. Crew 2 (Tap any number of creatures you control with total power 2 or more: This Vehicle becomes an artifact creature until end of turn.)',
  imagePath: '/assets/cards/adventurers-airship.webp',
},
{
  id: "adventurer's-inn",
  name: 'Adventurers Inn',
  type: 'land',
  costLabel: '-',
  text: 'When this land enters the battlefield, you gain 2 life. Tap: add one colourless mana',
  imagePath: '/assets/cards/adventurers-inn.webp',
},
  {
  id: 'adelbert-steiner',
  name: 'Adelbert Steiner',
  type: 'creature',
  costLabel: '1W',
  power: 3,
  toughness: 4,
  text: 'Vigilance. A knight\u2019s duty does not end at the front line.',
  imagePath: '/assets/cards/adelbert-steiner.webp',
},
{
  id: 'aerith-gainsborough',
  name: 'Aerith Gainsborough',
  type: 'creature',
  subtype: 'Legendary Creature \u2014 Human Cleric',
  costLabel: '2W',
  power: 2,
  toughness: 2,
  text: 'Lifelink. Whenever you gain life, put a +1/+1 counter on Aerith Gainsborough. When Aerith Gainsborough dies, put X +1/+1 counters on each legendary creature you control where X is the number of +1/+1 counters on Aerith Gainsborough.',
  imagePath: '/assets/cards/aerith-gainsborough.jpg',
},
{
  id: 'aettir-and-priwen',
  name: 'Aettir and Priwen',
  type: 'artifact',
  subtype: 'Legendary Artifact - Equipment',
  costLabel: '6',
  text: "Equipped creatures has base power and toughness X/X, where X is your life total. Equip 5",
  imagePath: '/assets/cards/aettir-and-priwen.webp',
},
{
  id: 'ahriman',
  name: 'Ahriman',
  type: 'creature',
  costLabel: '2B',
  power: 2,
  toughness: 2,
  text: 'Flying, deathtouch. 3, Sacrifice another creature or artifact: Draw a card.',
  imagePath: '/assets/cards/ahriman.webp',
},
{
  id: 'airship-crash',
  name: 'Airship Crash',
  type: 'instant',
  costLabel: '2G',
  text: 'Destroy target artifact, enchantment, or creature with flying. Cycling 2 (2, Discard this card: Draw a card.)',
  imagePath: '/assets/cards/airship-crash.webp',
},
{
  id: 'al-bhed-salvagers',
  name: 'Al Bhed Salvagers',
  type: 'creature',
  costLabel: '2B',
  power: 2,
  toughness: 3,
  text: 'Whenever this creature or another creature or artifact you control dies, target opponent loses 1 life and you gain 1 life.',
  imagePath: '/assets/cards/al-bhed-salvagers.webp',
},
{
  id: 'ambrosia-whiteheart',
  name: 'Ambrosia Whiteheart',
  type: 'creature',
  costLabel: '1W',
  power: 2,
  toughness: 2,
  text: "When Ambrosia Whiteheart enters, you may return another permanent you control to its owner's hand. Landfall \u2014 Whenever a land you control enters, Ambrosia Whiteheart gets +1/+0 until end of turn.",
  imagePath: '/assets/cards/ambrosia-whiteheart.webp',
},
{
  id: 'ancient-adamantoise',
  name: 'Ancient Adamantoise',
  type: 'creature',
  costLabel: '5GGG',
  power: 8,
  toughness: 20,
  text: "Vigilance, ward 3. Damage isn't removed from this creature during cleanup steps. All damage that would be dealt to you and other permanents you control is dealt to this creature instead. When this creature dies, exile it and create ten tapped Treasure tokens.",
  imagePath: '/assets/cards/ancient-adamantoise.webp',
},
{
  id: 'ardyn-the-usurper',
  name: 'Ardyn, the Usurper',
  type: 'creature',
  subtype: 'Legendary Creature \u2014 Elder Human Noble',
  costLabel: '5BBB',
  power: 4,
  toughness: 4,
  text: "Demons you control have menace, lifelink, and haste. Starscourge \u2014 At the beginning of combat on your turn, exile up to one target creature card from a graveyard. If you exiled a card this way, create a token thats a copy of that card, except it's a 5/5 black Demon.",
  imagePath: '/assets/cards/ardyn-the-usurper.webp',
},
{
  id: 'a-realm-reborn',
  name: 'A Realm Reborn',
  type: 'enchantment',
  costLabel: '4GG',
  text: " Other permants you control have 'Tap: Add one mana of any color.'",
  imagePath: '/assets/cards/a-realm-reborn.webp',
},
{
  id: 'ashe-princess-of-dalmasca',
  name: 'Ashe, Princess of Dalmasca',
  type: 'creature',
  subtype: 'Legendary Creature \u2014 Human Rebel Noble',
  costLabel: '2W',
  power: 3,
  toughness: 2,
  text: "Whenever Ashe attacks, look at the top five cards of your library. You may reveal an artifact card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.",
  imagePath: '/assets/cards/ashe-princess-of-dalmasca.webp',
},
{
  id: 'astrologians-planishere',
  name: "Astrologian's Planisphere",
  type: 'artifact',
  costLabel: '1W',
  text: "Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.) Equipped creature is a Wizard in addition to its other types and has “Whenever you cast a noncreature spell and whenever you draw your third card each turn, put a +1/+1 counter on this creature. Diana — Equip {2}",
  imagePath: '/assets/cards/astrologians-planishere.webp',
},
{
  id: 'aurons-inspiration',
  name: "Auron's Inspiration",
  type: 'instant',
  costLabel: '2W',
  text: "Attacking creatures get +2/+0 until end of turn.Flashback 2WW (You may cast this card from your graveyard for its flashback cost. Then exile it.)",
  imagePath: '/assets/cards/aurons-inspiration.webp',
},
{
  id: 'balamb-garden-seed-academy',
  name: 'Balamb Garden Seed Academy',
  type: 'land',
  costLabel: '-',
  text: "This land enters tapped. Tap: Add G or U. 5GU Tap: Transform this land. This ability costs 1 less to activate for each other Town you control.",
  imagePath: '/assets/cards/balamb-garden-seed-academy.webp',
  transformsInto: 'balamb-garden-airborne',
},
{
  id: 'balamb-garden-airborne',
  name: 'Balamb Garden Airborne',
  type: 'artifact',
  subtype:'Legendary Artifact \u2014 Vehicle',
  costLabel: '-',
  text: "Flying. Whenever Balamb Garden attacks, draw a card. Crew 1",
  imagePath: '/assets/cards/balamb-garden-airborne.webp',
},
{
  id: 'balamb-t-rexaur',
  name: 'Balamb T-Rexaur',
  type: 'creature',
  subtype: 'Legendary Creature \u2014 Dinosaur',
  costLabel: '4GG',
  power: 6,
  toughness: 6,
  text: "Trample. Whenever this creature enters, you gain 3 life. Forestcycling 2(2 Discard this card: Search your library for a forest card, reveal it, put it into your hand then shuffle)",
  imagePath: '/assets/cards/balamb-t-rexaur.webp',
},
{
  id: 'balthier-and-fran',
  name: 'Balthier and Fran',
  type: 'creature',
  subtype: 'Legendary Creature \u2014 Human Rabbit',
  costLabel: '1RG',
  power: 4,
  toughness: 3,
  text: "Reach. Vehicles you control get +1/+1 and have vigilance and reach. Whenever a Vehicle crewed by Balthier and Fran this turn attacks, if it’s the first combat phase of the turn, you may pay 1RG. If you do, after this phase, there is an additional combat phase.",
  imagePath: '/assets/cards/balthier-and-fran.webp',
},
{
  id: 'bards-bow',
  name: "Bard's Bow",
  type: 'artifact',
  subtype: 'Equipment',
  costLabel: '2G',
  text: "Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.) Equipped creature gets +2/+2, has reach, and is a Bard in addition to its other types. Perseus’s Bow — Equip 6( 6: Attach to target creature you control. Equip only as a sorcery.)",
  imagePath: '/assets/cards/bards-bow.webp',
},
{
  id: 'baron-airship-kingdom',
  name: 'Baron Airship Kingdom',
  type: 'land',
  costLabel: '-',
  text: "This land enters tapped. Tap: Add R or W.",
  imagePath: '/assets/cards/baron-airship-kingdom.webp',
},
{
  id: 'barret-wallace',
  name: 'Barret Wallace',
  type: 'creature',
  subtype: 'Legendary Creature \u2014 Human Rebel',
  costLabel: '3R',
  power: 4,
  toughness: 4,
  text: "Reach, Whenever Barret Wallace attacks, it deals damage equal to the number of equipped creatures you control to defending player.",
  imagePath: '/assets/cards/barret-wallace.webp',
},
{
  id: 'bartz-and-boko',
  name: 'Bartz and Boko',
  type: 'creature',
  subtype: 'Legendary Creature \u2014 Human Bird',
  costLabel: '3GU',
  power: 4,
  toughness: 3,
  text: "Affinity for Birds (This spell costs {1} less to cast for each Bird you control.) When Bartz and Boko enters, each other Bird you control deals damage equal to its power to target creature an opponent controls.",
  imagePath: '/assets/cards/bartz-and-boko.webp',
},
{
  id: 'battle-menu',
  name: 'Battle Menu',
  type: 'instant',
  costLabel: '1W',
  text: "Choose one — • Attack — Create a 2/2 white Knight creature token. • Ability — Target creature gets +0/+4 until end of turn. "+
  " • Magic — Destroy target creature with power 4 or greater. • Item — You gain 4 life.",
  imagePath: '/assets/cards/battle-menu.webp',
},
{
  id: 'beatrix-loyal-general',
  name: 'Beatrix, Loyal General',
  type: 'creature',
  subtype: 'Legendary Creature \u2014 Human Soldier',
  costLabel: '4WW',
  power: 4,
  toughness: 4,
  text: "Vigilance (Attacking doesn’t cause this creature to tap.) At the beginning of combat on your turn, " +
  "you may attach any number of Equipment you control to target creature you control.",
  imagePath: '/assets/cards/beatrix-loyal-general.webp',
},
{
  id: 'black-mages-rod',
  name: "Black Mage's Rod",
  type: 'artifact',
  subtype: 'Equipment',
  costLabel: '1B',
  text: 'Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, ' +
  'then attach this to it.) Equipped creature gets +1/+0, has “Whenever you cast a noncreature spell, ' +
  'this creature deals 1 damage to each opponent,” and is a Wizard in addition to its other types.Equip 3',
  imagePath: '/assets/cards/black-mages-rod.webp',
},
{
  id: 'black-waltz-no3',
  name: 'Black Waltz No. 3',
  type: 'creature',
  subtype: 'Legendary Creature \u2014 Wizard',
  costLabel: '2BR',
  power: 2,
  toughness: 2,
  text: "Flying, deathtouch " +
  "Whenever you cast a noncreature spell, Black Waltz No. 3 deals 2 damage to each opponent.",
  imagePath: '/assets/cards/black-waltz-no3.webp',
},
{
  id: 'blazing-bomb',
  name: 'Blazing Bomb',
  type: 'creature',
  subtype: 'Emental',
  costLabel: 'R',
  power: 1,
  toughness: 1,
  text: "Whenever you cast a noncreature spell, if at least four mana was spent to cast it, put a +1/+1 counter on this creature. " +
  "Blow Up — {T}, Sacrifice this creature: It deals damage equal to its power to target creature. Activate only as a sorcery.",
  imagePath: '/assets/cards/blazing-bomb.webp',
},
{
  id: 'blitzball',
  name: 'Blitzball',
  type: 'artifact',
  costLabel: "3",
  text: ": Add one mana of any color. " +
  "GOOOOAAAALLL! — {T}, Sacrifice this artifact: Draw two cards. Activate only if an opponent was dealt combat " +
  "damage by a legendary creature this turn.",
  imagePath: '/assets/cards/blitzball.webp',
},
{
  id: 'blitzball-shot',
  name: 'Blitzball Shot',
  type: 'instant',
  costLabel: "1G",
  text: "Target creature gets +3/+3 and gains trample until end of turn.",
  imagePath: '/assets/cards/blitzball-shot.webp',
},
{
  id: 'buster-sword',
  name: 'Buster Sword',
  type: 'artifact',
  subtype: 'Equipment',
  costLabel: '3',
  text: "Equipped creature gets +3/+2. " +
  "Whenever equipped creature deals combat damage to a player, draw a card, " +
  "then you may cast a spell from your hand with mana value less than or equal to that damage without paying its mana cost. Equip 2",
  imagePath: '/assets/cards/buster-sword.webp',
},
{
  id: 'cactuar',
  name: 'Cactuar',
  type: 'creature',
  costLabel: '1G',
  power: 3,
  toughness: 3,
  text: "Trample. " +
  "At the beginning of your end step, if this creature didn’t enter the battlefield this turn, return it to its owner’s hand.",
  imagePath: '/assets/cards/cactuar.webp',
},
{
  id: 'call-the-mountain-chocobo',
  name: 'Call the Mountain Chocobo',
  type: 'sorcery',
  costLabel: '3R',
  text: "Search your library for a Mountain card, reveal it, put it into your hand, then shuffle. " +
  'Create a 2/2 green Bird creature token with “Whenever a land you control enters, this token gets +1/+0 until end of turn.”' +
  "Flashback {5}{R} (You may cast this card from your graveyard for its flashback cost. Then exile it.)",
  imagePath: '/assets/cards/call-the-mountain-chocobo.webp',
}

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
  {
  id: 'ultima',
  name: 'Ultima',
  type: 'sorcery',
  costLabel: '3WW',
  text: 'Destroy all artifacts and creatures. End the turn. (Exile all spells and abilities from the stack, including this card. The player whose turn it is discards down to their maximum hand size. Damage wears off, and “this turn” and “until end of turn” effects end.) “Such devastation … this was not my intention!” —Gaius van Baelsar',
  imagePath: '/assets/cards/ultima.jpg',
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
