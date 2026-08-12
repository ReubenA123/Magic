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
},
{
  id: 'capital-city',
  name: 'Capital City',
  type: 'land',
  costLabel: '-',
  text: "Add Mana \n 1 Tap: Add one mana of any colour. \nCycling 2 (2, Discard this card: Draw a card.)",
  imagePath: '/assets/cards/capital-city.webp',
},
{
  id: 'cargo-ship',
  name: 'Cargo Ship',
  type: 'artifact',
  subtype: 'Vehicle',
  costLabel: '1U',
  power: 2,
  toughness: 3,
  text: "Flying, vigilance \n Tap: Add Mana. Spend this mana only to cast an artifact spell or activate an ability of an artifact source. \n Crew 1",
  imagePath: '/assets/cards/cargo-ship.webp',
},
{
  id: 'cecil,dark-knight',
  name: 'Cecil, Dark Knight',
  type: 'creature',
  subtype: 'Legendary Creature \u2014 Human Knight',
  costLabel: 'B',
  power: 2,
  toughness: 3,
  text: "Deathtouch \n Darkness \u2014 Whenever Cecil deals damage, you lose that much life. Then if your life total is less than or equal to half your starting life " +
  "toal, untap Cecil and transform it.",
  imagePath: '/assets/cards/cecil-dark-knight.webp',
  transformsInto: 'Cecil, Redeemed Paladin'
},
{
  id: 'cecil-redeemed-paladin',
  name: 'Cecil, Redeemed Paladin',
  type: 'creature',
  subtype: 'Legendary Creature \u2014 Human Knight',
  costLabel: '-',
  power: 4,
  toughness: 4,
  text: "Lifelink \n Protect \u2014 Whenever Cecil attacks, other attacking creatures gain indestructible until end of turn.",
  imagePath: '/assets/cards/cecil-redeemed-paladin.webp',
},
{
  id: 'chocobo-kick',
  name: 'Chocobo Kick',
  type: 'sorcery',
  costLabel: '1G',
  text: "Kicker \u2014 Return a land you control to its owner’s hand. " +
  "(You may return a land you control to its owner’s hand in addition to any other costs as you cast this spell.)\n " +
  "Target creature you control deals damage equal to its power to target creature an opponent controls. If this spell was kicked, \n" +
  "the creature you control deals twice that much damage instead.",
  imagePath: '/assets/cards/chocobo-kick.webp',
},
{
  id: 'chocobo-racetrack',
  name: 'Chocobo Racetrack',
  type: 'artifact',
  costLabel: '3GG',
  text: "Landfall — Whenever a land you control enters, create a 2/2 green Bird creature token with “Whenever a land you control enters, this token gets +1/+0 until end of turn.",
  imagePath: '/assets/cards/chocobo-racetrack.webp',
},
{
  id: 'choco-comet',
  name: 'Choco\u2014Comet',
  type: 'sorcery',
  costLabel: 'XRR',
  text: "Choco\u2014Comet deals X damage to any target.\nCreate a 2/2 green Bird creature token with 'Whenever a land you control enters, this token gets +1/+0 until end of turn.'",
  imagePath: '/assets/cards/choco-comet.webp',
},
{
  id: 'choco-seeker-of-paradise',
  name: 'Choco, Seeker of Paradise',
  type: 'creature',
  subtype: 'Legendary Creature \u2014 Bird',
  costLabel: '1GWU',
  power: 3,
  toughness: 5,
  text: "Whenever one or more Birds you control attack, look at that many cards from the top of your library. " +
  "You may put one of them into your hand. Then put any number of land cards from among them onto the battlefield tapped and the rest into your graveyard." +
  "\nLandfall — Whenever a land you control enters, Choco gets +1/+0 until end of turn.",
  imagePath: '/assets/cards/choco-seeker-of-paradise.webp',
},
// --- Cid put in later, he has multiple cards all with the same text but different images -------------------------------------------------------
{
  id: 'circle-of-power',
  name: 'Circle of Power',
  type: 'sorcery',
  costLabel: '3B',
  text: "You draw two cards and you lose 2 life. Create a 0/1 black Wizard creature token with " +
  "'Whenever you cast a noncreature spell, this token deals 1 damage to each opponent.'" +
  "\nWizards you control get +1/+0 and gain lifelink until end of turn.",
  imagePath:'/assets/cards/circle-of-power.webp',
},
{
  id: 'clash-of-the-eikons',
  name: 'Clash of the Eikons',
  type: 'sorcery',
  costLabel: 'G',
  text: "Choose one or more \u2014 " +
  "\n• Target creature you control fights target creature an opponent controls." +
  "\n• Remove a lore counter from target Saga you control. (Removing lore counters doesn’t cause chapter abilities to trigger.)" +
  "\n• Put a lore counter on target Saga you control.",
  imagePath: '/assets/cards/clash-of-the-eikons',
},
{
  id: 'clive-ifrits-dominant',
  name: "Clive, Ifrit's Dominant",
  type: 'creature',
  subtype: 'Legendary Creature \u2014 Human Noble Warrior',
  costLabel: "4RR",
  power: 5,
  toughness: 5,
  text: 'When Clive enters, you may discard your hand, then draw cards equal to your devotion to red. (Each R in the mana costs of permanents you control counts toward your devotion to red.)' +
  "4RR, T: Exile Clive, then return it to the battlefield transformed under its owner’s control. Activate only as a sorcery.",
  imagePath: '/assets/cards/clive-ifrit-s-dominant',
  transformsInto: "Ifrit, Warden of Inferno",
},
{
  id: 'ifrit-warden-of-inferno',
  name: 'Ifrit, Warden of Inferno',
  type: 'creature',
  subtype: 'Legendary Enchantment Creature \u2014 Saga Demon',
  costLabel: '-',
  power: 9,
  toughness: 9,
  text: "I — Lunge — Ifrit fights up to one other target creature. " +
  "\nII, III — Brimstone — Add RRRR. If Ifrit has three or more lore counters on it, exile it, then return it to the battlefield (front face up).",
  imagePath:'/assets/cards/ifrit-warden-of-inferno',
},
{
  id: 'clives-hideaway',
  name: "Clive's Hideaway",
  type: 'land',
  costLabel: '-',
  text: "Hideaway 4 (When this land enters, look at the top four cards of your library, exile one face down, then put the rest on the bottom in a random order.)" +
  "\nT: Add mana." +
  "\n2, T: You may play the exiled card without paying its mana cost if you control four or more legendary creatures.",
  imagePath: '/assets/cards/clive-s-hideaway',
},
{
  id: 'cloudbound-moogle',
  name: 'Cloudbound Moogle',
  type: 'creature',
  costLabel: '3WW',
  text: "Flying \n When this creature enters, put a +1/+1 counter on target creature. \n" +
  "Plainscycling 2 (2, Discard this card: Search your library for a Plains card, reveal it, put it into your hand, then shuffle.)",
  imagePath: '/assets/cards/cloudbound-moogle'
},
{
  id: 'cloud-midgar-mercenary',
  name:'Cloud, Midgar Mercenary',
  type: 'creature',
  subtype: 'Legendary Creature \u2014 Human Soldier Mercenary',
  costLabel: "WW",
  power: 2,
  toughness: 1,
  text: "When Cloud enters, search your library for an Equipment card, reveal it, put it into your hand, then shuffle." +
  "\nAs long as Cloud is equipped, if a triggered ability of Cloud or an Equipment attached to it triggers, that ability triggers an additional time.",
  imagePath: '/assets/cards/cloud-midgar-mercenary'
},
{
  id: 'cloud-of-darkness',
  name: 'Cloud of Darkness',
  type: 'creature',
  subtype: 'Legendary Creature \u2014 Avatar',
  costLabel: "2BGG",
  power: 3,
  toughness: 3,
  text: 'Flying \nParticle Beam — When Cloud of Darkness enters, target creature an opponent controls gets -X/-X ' +
  "until end of turn, where X is the number of permanent cards in your graveyard.",
  imagePath: '/assets/cards/cloud-of-darkness'
},
{
  id: 'cloud-planets-champion',
  name: "Cloud, Planet's Champion",
  type: 'creature',
  subtype: 'Legendary Creature \u2014 Human Soldier Mercenary',
  costLabel: '3RW',
  power: 4,
  toughness: 4,
  text: "During your turn, as long as Cloud is equipped, it has double strike and indestructible. " +
  "(This creature deals both first-strike and regular combat damage. Damage and effects that say “destroy” don’t destroy this creature.)" +
  "Equip abilities you activate that target Cloud cost 2 less to activate.",
  imagePath: '/assets/cards/cloud-planet-s-champion',
},
{
  id: 'coeurl',
  name: 'Coeurl',
  type: 'creature',
  costLabel: '1W',
  power: 2,
  toughness: 2,
  text: "1W Tap target nonenchantment creature",
  imagePath: '/assets/cards/coeurl',
},
{
  id: 'coliseum-behemoth',
  name: 'Coliseum Behemoth',
  type: 'creature',
  costLabel: '5GG',
  power: 7,
  toughness: 7,
  text: "Trample \nWhen this creature enters, choose one \u2014 \n Destroy target artifact or enchantment \nDraw a card",
  imagePath: '/assets/cards/coliseum-behemoth',
},
{
  id: 'combat-tutorial',
  name: 'Combat Tutorial',
  type: 'sorcery',
  costLabel: '2U',
  text: "Target player draws two cards. Put a +1/+1 counter on up to one target creature you control.",
  imagePath: '/assets/cards/combat-tutorial'
},
{
  id:'commune-with-beavers',
  name: 'Commune with Beavers',
  type: 'sorcery',
  costLabel: 'G',
  text: 'Look at the top three cards of your library. You may reveal an artifact, creature, ' +
  "or land card from among them and put it into your hand. Put the rest on the bottom of your library in any order.",
  imagePath: '/assets/cards/commune-with-beavers',
},
{
  id: 'coral-sword',
  name: 'Coral Sword',
  type: 'artifact',
  subtype: 'equipment',
  costLabel: 'R',
  text: 'Flash \nWhen this Equipment enters, attach it to target creature you control. That creature gains first strike until end of turn.\n Equipped creature gets +1/+0.\nEquip 1',
  imagePath:'/assets/cards/coral-sword',
},
{
  id: 'cornered-by-black-mages',
  name: 'Cornered by Black Mages',
  type: 'sorcery',
  costLabel: '1BB',
  text: 'Target opponent sacrifices a creature of their choice. \nCreate a 0/1 black Wizard creature token with “Whenever you cast a noncreature spell, ' +
  ' this token deals 1 damage to each opponent.”',
  imagePath:'/assets/cards/cornered-by-black-mages'
},
{
  id:'crossroad-village',
  name:'Crossroads Village',
  type: 'land',
  costLabel: '-',
  text: "This land enters tapped. As it enters, choose a color. \nTap: Add one mana of the chosen color.",
  imagePath:'/assets/cards/crossroads-village'
},
{
  id: 'crystal-fragments',
  name: 'Crystal Fragments',
  type: 'artifact',
  subtype: 'equipment',
  costLabel: 'W',
  text: "Equipped creature gets +1/+1. \n5WW: Exile this Equipment, then return it to the battlefield transformed under its owner’s control. Activate only as a sorcery. \nEquip 1",
  imagePath:'/assets/cards/crystal-fragments'
},
{
  id:'dark-confidant',
  name: 'Dark Confidant',
  type: 'creature',
  subtype: 'Human Wizard',
  costLabel: '1B',
  power: 2,
  toughness: 1,
  text: "At the beginning of your upkeep, reveal the top card of your library and put that card into your hand. You lose life equal to its mana value.",
  imagePath: '/assets/cards/dark-confidant'
},
{
  id: 'dark-knights-greatsword',
  name: "Dark Knight's Greatsword",
  type: 'artifact',
  subtype: 'equipment',
  costLabel: '2B',
  text: 'Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.) \n' +
  "Equipped creature gets +3/+0 and is a Knight in addition to its other types. \nChaosbringer — Equip—Pay 3 life. Activate only once each turn.",
  imagePath:'/assets/cards/dark-knight-s-greatsword'
},
{
  id: 'deadly-embrace',
  name: 'Deadly Embrace',
  type: 'sorcery',
  costLabel: '3BB',
  text: 'Destroy target creature an opponent controls. Then draw a card for each creature that died this turn.',
  imagePath:'/assets/cards/deadly-embrace'
},
{
  id:'delivery-moogle',
  name:'Delivery Moogle',
  type: 'creature',
  subtype: 'Moogle',
  costLabel: '3W',
  power: 3,
  toughness: 2,
  text: 'Flying \nWhen this creature enters, search your library and/or graveyard for an artifact card with mana value 2 or less, ' +
  "\n reveal it, and put it into your hand. If you search your library this way, shuffle.",
  imagePath:'/assets/cards/delivery-moogle'
},
{
  id:'demon-wall',
  name: 'Demon Wall',
  type: 'creature',
  subtype: 'Artifact Creature \u2014 Demon Wall',
  costLabel: '1B',
  power: 3,
  toughness: 3,
  text: 'Defender \nMenace (This creature can’t be blocked except by two or more creatures.) ' +
  "As long as this creature has a counter on it, it can attack as though it didn’t have defender. " +
  "\n5B: Put two +1/+1 counters on this creature.",
  imagePath:'/assets/cards/demon-wall'
},
{
  id: 'diamond-weapon',
  name: 'Diamond Weapon',
  type: 'creature',
  subtype: 'Legendary Artifact Creature \u2014 Elemental',
  costLabel: '7GG',
  power: 8,
  toughness: 8,
  text: "This spell costs 1 less to cast for each permanent card in your graveyard. \nReach \n Immune — Prevent all combat damage that would be dealt to Diamond Weapon.",
  imagePath: '/assets/cards/diamond-weapon'
},
{
  id: 'ultima',
  name: 'Ultima',
  type: 'sorcery',
  costLabel: '3WW',
  text: 'Destroy all artifacts and creatures. End the turn. (Exile all spells and abilities from the stack, including this card. The player whose turn it is discards down to their maximum hand size. Damage wears off, and “this turn” and “until end of turn” effects end.) “Such devastation … this was not my intention!” —Gaius van Baelsar',
  imagePath: '/assets/cards/ultima.jpg',
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
