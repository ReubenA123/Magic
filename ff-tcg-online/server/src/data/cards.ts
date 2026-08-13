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

import { create } from 'domain';
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
  id: 'dion-bahamut-dominant',
  name: "Dion Bahamut's Dominant",
  type: 'creature',
  subtype: "Legendary Creature \u2014 Human Noble Knight",
  costLabel: '3W',
  power: 3,
  toughness: 3,
  text: 'Dragonfire Dive — During your turn, Dion and other Knights you control have flying.\nWhen Dion enters, create a 2/2 white Knight creature token.' +
  "4WW, Tap: Exile Dion, then return it to the battlefield transformed under its owner’s control. Activate only as a sorcery.",
  imagePath:'/assets/cards/dion-bahamut-s-dominant',
  transformsInto:'Bahamut, Warden of Light'
},
{
  id: 'bahamut-warden-of-light',
  name: 'Bahamut, Warden of Light',
  type: 'creature',
  subtype: 'Legendary Enhancement Creature \u2014 Saga Dragon',
  costLabel: '-',
  power: 5,
  toughness: 5,
  text: "I, II — Wings of Light — Put a +1/+1 counter on each other creature you control. Those creatures gain flying until end of turn." +
  "\nIII — Gigaflare — Destroy target permanent. Exile Bahamut, then return it to the battlefield (front face up). \nFlying",
  imagePath: '/assets/cards/bahamut-warden-of-light'
},
{
  id: "dragoons-lance",
  name: "Dragoon's Lance",
  type: 'artifact',
  subtype: 'equipment',
  costLabel: '1W',
  text: 'Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.)' +
  "\nEquipped creature gets +1/+0 and is a Knight in addition to its other types."+
  "\nDuring your turn, equipped creature has flying.\nGae Bolg — Equip 4",
  imagePath:'/assets/cards/dragoon-s-lance'
},
{
  id: 'dragoons-wyvern',
  name: "Dragoon's Wyvern",
  type: 'creature',
  costLabel: '2U',
  power: 2,
  toughness: 1,
  text:"Flying\n When this creature enters, create a 1/1 colorless Hero creature token.",
  imagePath:'/assets/cards/dragoon-s-wyvern'
},
{
  id: 'dreams-of-laguna',
  name:'Dreams of Laguna',
  type: 'instant',
  costLabel: '1U',
  text: "Surveil 1, then draw a card. (To surveil 1, look at the top card of your library. You may put it into your graveyard.) " +
  "\nFlashback 3U (You may cast this card from your graveyard for its flashback cost. Then exile it.)",
  imagePath:'/assets/cards/dreams-of-laguna'
},
{
  id: 'dwarven-castel-guard',
  name: 'Dwarven Castle Guard',
  type: 'creature',
  costLabel: '1W',
  power: 2,
  toughness: 1,
  text:"When this creature dies, create a 1/1 colorless Hero creature token.",
  imagePath:'/assets/cards/dwarven-castle-guard'
},
{
  id:'eden-seat-of-the-sanctum',
  name:'Eden, Seat of the Sanctum',
  type: 'land',
  costLabel: '-',
  text: "T: Add C.\n 5, T: Mill two cards. Then you may sacrifice this land. When you do, return another target permanent card from your graveyard to your hand.",
  imagePath:'/assets/cards/eden-seat-of-the-sanctum'
},
{
  id: 'edgar-king-of-figaro',
  name: 'Edgar, King of Figaro',
  type: 'creature',
  subtype: 'Legendary Creatures \u2014 Human Artificer Noble',
  costLabel: '4UU',
  power: 4,
  toughness: 5,
  text: "When Edgar enters, draw a card for each artifact you control. " +
  "Two-Headed Coin — The first time you flip one or more coins each turn, those coins come up heads and you win those flips.",
  imagePath:'/assets/cards/edgar-king-of-figaro'
},
{
  id:'eject',
  name:'Eject',
  type: 'instant',
  costLabel: '3U',
  text: "This spell can’t be countered.\n Return target nonland permanent to its owner’s hand.\n Draw a card.",
  imagePath:'/assets/cards/eject'
},
{
  id:'elixir',
  name: 'Elixir',
  type: 'artifact',
  costLabel: '1',
  text: "This artifact enters tapped.\n5, T, Exile this artifact: Shuffle all nonland cards from your graveyard into your library. "+
  "You gain life equal to the number of cards shuffled into your library this way.",
  imagePath:'/assets/cards/elixir'
},
{
  id: 'emet-selch-unsundered',
  name: "Emet\u2014Selch, Unsundered",
  type: 'creature',
  subtype: 'Legendary Creature \u2014 Elder Wizard',
  costLabel: '1UB',
  power: 2,
  toughness: 4,
  text: "Vigilance \nWhenever Emet-Selch enters or attacks, draw a card, then discard a card.\n"+
  "At the beginning of your upkeep, if there are fourteen or more cards in your graveyard, you may transform Emet-Selch.",
  imagePath:'/assets/cards/emet-selch-unsundered',
  transformsInto:'Hades, Sorcerer of Eld'
},
{
  id:'hades-sorcerer-of-eld',
  name:'Hades, Sorcerer of Eld',
  type:'creature',
  costLabel:'-',
  power: 6,
  toughness: 6,
  text: "Vigilance \nEcho of the Lost — During your turn, you may play cards from your graveyard. \n"+
  "If a card or token would be put into your graveyard from anywhere, exile it instead.",
  imagePath:'/assets/cards/hades-sorcerer-of-eld'
},
{
  id: 'esper-origins',
  name:'Esper Origins',
  type: 'sorcery',
  costLabel:'1G',
  text:"Surveil 2. You gain 2 life. If this spell was cast from a graveyard, exile it, then put it onto the battlefield transformed under its owner’s control " +
  "with a finality counter on it. (If a creature with a finality counter on it would die, exile it instead.)\nFlashback 3G",
  imagePath:'/assets/cards/esper-origins'
},
{
  id: 'ether',
  name: "Ether",
  type: 'artifact',
  costLabel: '3U',
  text: "Tap, Exile this artifact: Add {U}. When you next cast an instant or sorcery spell this turn, copy that spell. You may choose new targets for the copy.",
  imagePath:"/assets/cards/ether"
},
{
  id:'evil-reawakened',
  name: "Evil Reawakened",
  type: "sorcery",
  costLabel: "4B",
  text: "Return target creature card from your graveyard to the battlefield with two additional +1/+1 counters on it.",
  imagePath:"/assets/cards/etherevil-reawakened"
},
{
  id:"excalibur-ii",
  name: "Excalibur II",
  type: 'artifact',
  subtype: 'equipment',
  costLabel: '1',
  text: "Whenever you gain life, put a charge counter on Excalibur II.\nEquipped creature gets +1/+1 for each charge counter on Excalibur II.\nEquip 3",
  imagePath:"/assets/cards/excalibur-ii"
},
{
  id:"exdeath-void-warlock",
  name: "Exdeath, Void Warlock",
  type: "creature",
  subtype: "Legendary Creature \u2014 Spirit Warlock",
  costLabel:"1BG",
  power: 3,
  toughness: 3,
  text:"When Exdeath enters, you gain 3 life.\nAt the beginning of your end step, if there are six or more permanent cards in your graveyard, transform Exdeath.",
  imagePath:"/assets/cards/exdeath-void-warlock",
  transformsInto:"Neo Exdeath, Dimension's End"
},
{
  id:"neo-exdeath-dimension-s-end",
  name: "Neo Exdeath, Dimension's End",
  type:'creature',
  costLabel:'-',
  power: x,
  toughness: 3,
  text:"When Exdeath enters, you gain 3 life.\nAt the beginning of your end step, if there are six or more permanent cards in your graveyard, transform Exdeath.",
  imagePath:'/assets/cards/neo-exdeath-dimension-s-end'
},
{
  id:'fang-fearless-l-cie',
  name:"Fang, Fearless I'Cie",
  type: 'creature',
  costLabel: '2B',
  subtype:'Legendary Creature \u2014 Human Warrior',
  power: 2,
  toughness: 3,
  text: "Whenever one or more cards leave your graveyard, you draw a card and you lose 1 life. This ability triggers only once each turn.",
  imagePath:'/assets/cards/fang-fearless-l-cie'
},
{
  id: 'fate-of-the-sun-cryst',
  name:"Fate of the Sun-Cryst",
  type: 'instant',
  costLabel: '4W',
  text: 'This spell costs 2 less to cast if it targets a tapped creature.\nDestroy target nonland permanent.',
  imagePath:'/assets/cards/fate-of-the-sun-cryst'
},
{
  id:"fight-on",
  name:"Fight On!",
  type:'instant',
  costLabel:'2B',
  text:"Return up to two target creature cards from your graveyard to your hand.",
  imagePath:'/assets/cards/fight-on'
},
{
  id:'fire-magic',
  name: "Fire Magic",
  type: 'instant',
  costLabel: "R",
  text:"Tiered (Choose one additional cost.) \n" +
  "• Fire — {0} — Fire Magic deals 1 damage to each creature. \n" +
  "• Fira — {2} — Fire Magic deals 2 damage to each creature. \n" +
  "• Firaga — {5} — Fire Magic deals 3 damage to each creature.",
  imagePath:'/assets/cards/fire-magic'
},
{
  id: 'firion-wild-rose-warrior',
  name: "Firion, Wild Rose Warrior",
  type: 'creature',
  subtype: "Legendary Creature \u2014 Human Rebel Warrior",
  costLabel: '2R',
  power: 3,
  toughness: 3,
  text: "Equipped creatures you control have haste.\nWhenever a nontoken Equipment you control enters, create a token that’s a copy of it, " +
  "except it has “This Equipment’s equip abilities cost {2} less to activate.” Sacrifice that token at the beginning of the next upkeep.",
  imagePath:'/assets/cardsfirion-wild-rose-warrior'
},{
  id: "forest",
  name: "Forest",
  type: "land",
  costLabel: "-",
  text:"(T: Add G.)",
  imagePath:'/assets/cards/forest'
},{
  id: "freya-crescent",
  name: "Freya Crescent",
  type: "creature",
  subtype:'Legendary Creature \u2014 Rat Knight',
  costLabel: "R",
  text: "Jump — During your turn, Freya Crescent has flying.\nT: Add R. Spend this mana only to cast an Equipment spell or activate an equip ability",
  imagePath:'/assets/cards/freya-crescent '
},{
  id: 'from-father-to-son',
  name: 'From Father to Son',
  type: 'sorcery',
  costLabel: '1W',
  text: "Search your library for a Vehicle card, reveal it, and put it into your hand. If this spell was cast from a graveyard, put that card onto the battlefield instead. " +
  "Then shuffle. \nFlashback 4WWW",
  imagePath:'/assets/cards/from-father-to-son'
},{
  id: "gaelicat",
  name: 'Gaelicat',
  type: 'creature',
  costLabel: '2W',
  text: "Flying, vigilance \nAs long as you control two or more artifacts, this creature gets +2/+0.",
  imagePath:'/assets/cards/gaelicat '
},{
  id: "gaius-van-baelsar",
  name: "Gaius van Baelsar",
  type:'creature',
  subtype:"Legendary Creature \u2014 Human Soldier",
  costLabel:'2BB',
  text:"When Gaius van Baelsar enters, choose one — " +
  "\n• Each player sacrifices a creature token of their choice. " +
  "\n• Each player sacrifices a nontoken creature of their choice. " +
  "\n• Each player sacrifices an enchantment of their choice.",
  imagePath:'/assets/cards/gaius-van-baelsar'
},{
  id: "galuf-s-final-act",
  name: "Galuf's Final Act",
  type: 'instant',
  costLabel: '1G',
  text:'Until end of turn, target creature gets +1/+0 and gains “When this creature dies, put a number of +1/+1 counters equal to its power on up to one target creature.”',
  imagePath:'/assets/cards/galuf-s-final-act'
},{
  id: 'garland-knight-of-cornelia',
  name: "Garland, Knight of Cornelia",
  type:"creature",
  subtype:'Legendary Creature \u2014 Human Knight',
  costLabel:'BR',
  power: 3,
  toughness: 2,
  text: "Whenever you cast a noncreature spell, surveil 1. (Look at the top card of your library. You may put it into your graveyard.)" +
  "\n3BBRR: Return this card from your graveyard to the battlefield transformed. Activate only as a sorcery.",
  imagePath:'/assets/cards/garland-knight-of-cornelia',
  transformsInto:'Chaos, the Endless'
},
{
  id: 'chaos-the-endless',
  name: 'Chaos, the Endless',
  type: 'creature',
  costLabel:'-',
  power: 5,
  toughness: 5,
  text: "Flying \nWhen Chaos dies, put it on the bottom of its owner’s library.",
  imagePath: '/assets/cards/chaos-the-endless'
},
{
  id: 'garnet-princess-of-alexandria',
  name: 'Garnet, Princess of Alexandria',
  type: 'creature',
  subtype:' Legendary Creature \u2014 Human Noble Cleric',
  costLabel: 'GW',
  power: 2,
  toughness: 2,
  text: "Lifelink \n Whenever Garnet attacks, you may remove a lore counter from each of any number of Sagas you control. "+
  "Put a +1/+1 counter on Garnet for each lore counter removed this way.",
  imagePath:'/assets/cards/garnet-princess-of-alexandria'
},{
  id: 'genji-glove',
  name: 'Genji Glove',
  costLabel: '5',
  type: 'artifact',
  subtype: 'equipment',
  text:"Equipped creature has double strike. \n" +
  "Whenever equipped creature attacks, if it’s the first combat phase of the turn, untap it. After this phase, there is an additional combat phase. " +
  "Equip 3",
  imagePath:'/assets/cards/genji-glove'
},{
  id: 'gigantoad',
  name: "Gigantoad",
  costLabel: '3G',
  type: 'creature',
  subtype: 'Frog',
  power: 4,
  toughness: 4,
  text: "As long as you control seven or more lands, this creature gets +2/+2.",
  imagePath:'/assets/cards/gigantoad'
},{
  id: "gilgamesh-master-at-arms",
  name: "Gilgamesh, Master-at-Arms",
  costLabel:"4RR",
  type: 'creature',
  power: 6,
  toughness: 6,
  text:"Whenever Gilgamesh enters or attacks, look at the top six cards of your library. \n" +
  "You may put any number of Equipment cards from among them onto the battlefield. Put the rest on the bottom of your library \n" +
  "in a random order. When you put one or more Equipment onto the battlefield this way, you may attach one of them to a Samurai you control.",
  imagePath:'/assets/cards/gilgamesh-master-at-arms'
},
{
  id: "giott-king-of-the-dwarves",
  name: "Giott, King of the Dwarves",
  costLabel: "RW",
  type: 'creature',
  subtype: 'Legendary Creature \u2014 Dwarf Noble',
  power: 1,
  toughness: 1,
  text: "Double strike \n " +
  "Whenever Giott or another Dwarf you control enters and whenever an Equipment you control enters, you may discard a card. If you do, draw a card.",
  imagePath:'/assets/cards/giott-king-of-the-dwarves'
},{
  id: 'gladiolus-amicitia',
  name: "Gladiolus Amicita",
  costLabel: "4RG",
  type: 'creature',
  subtype: 'Legendary Creature \u2014 Human Warrior',
  power: 6,
  toughness: 6,
  text: "When Gladiolus Amicitia enters, search your library for a land card, put it onto the battlefield tapped, then shuffle. \n" +
  "Landfall — Whenever a land you control enters, another target creature you control gets +2/+2 and gains trample until end of turn.",
  imagePath:'/assets/cards/gladiolus-amicitia'
},
{
  id: "gogo-master-of-mimicry",
  name: "Gogo, Master of Mimicry",
  costLabel: '2U',
  type: 'creature',
  subtype: 'Legendary Creature \u2014 Wizard',
  power: 2,
  toughness: 4,
  text: "XX Tap:Copy target activated or triggered ability you control X times. You may choose new targets for the copies. " +
  "This ability can’t be copied and X can’t be 0. (Mana abilities can’t be targeted.)",
  imagePath:'/assets/cards/gogo-master-of-mimicry'
},
{
  id: 'gohn-town-of-ruin',
  name: "Gohn, Town of Ruin",
  costLabel: '-',
  type: 'land',
  text: "This land enters tapped. Tap: Add B or G.",
  imagePath:'/assets/cards/gohn-town-of-ruin'
},
{
  id: 'golbez-crystal-collector',
  name: 'Golbez, Crystal Collector',
  costLabel: 'UB',
  type: 'creature',
  subtype: 'Legendary Creature \u2014 Human Wizard',
  power: 1,
  toughness: 4,
  text: 'Whenever an artifact you control enters, surveil 1. \n' +
  "At the beginning of your end step, if you control four or more artifacts, return target creature card from your graveyard to your hand. " +
  'Then if you control eight or more artifacts, each opponent loses life equal to that card’s power.',
  imagePath:'/assets/cards/golbez-crystal-collector'
},
{
  id: 'gongaga-reactor-town',
  name: 'Gongaga, Reactor Town',
  costLabel: '-',
  type: 'land',
  text: 'This land enters tapped. \nTap: Add R or G.',
  imagePath:'/assets/cards/gongaga-reactor-town'
},
{
  id: 'goobbue-gardener',
  name: 'Goobbue Gardener',
  costLabel: '1G',
  type: 'creature',
  power: 1,
  toughness: 3,
  text: 'Tap: Add G.',
  imagePath:'/assets/cards/goobbue-gardener'
},
{
  id: 'g-raha-tia',
  name: "G'raha Tia",
  costLabel: '4W',
  type: 'creature',
  subtype: 'Legendary Creature \u2014 Cat Archer',
  power: 3,
  toughness: 5,
  text: 'Reach \n The Allagan Eye — Whenever one or more other creatures and/or artifacts you control die, draw a card. This ability triggers only once each turn.',
  imagePath:'/assets/cards/g-raha-tia'
},
{
  id: 'gran-pulse-ochu',
  name: 'Gran Pulse Ochu',
  costLabel: 'G',
  type: 'creature',
  power: 1,
  toughness: 1,
  text: 'Deathtouch \n8: Until end of turn, this creature gets +1/+1 for each permanent card in your graveyard.',
  imagePath:'/assets/cards/gran-pulse-ochu'
},
{
  id: 'guadosalam-farplane-gateway',
  name: 'Guadosalam, Farplane Gateway',
  costLabel: '-',
  type: 'land',
  text: 'This land enters tapped. \nTap: Add G or U.',
  imagePath:'/assets/cards/guadosalam-farplane-gateway'
},
{
  id: 'gysahl-greens',
  name: 'Gysahl Greens',
  costLabel: '1G',
  type: 'sorcery',
  text: 'Create a 2/2 green Bird creature token with “Whenever a land you control enters, this token gets +1/+0 until end of turn.”' +
  "\nFlashback {6}",
  imagePath:'/assets/cards/gysahl-greens'
},{
  id: 'haste-magic',
  name: 'Haste Magic',
  costLabel: '1R',
  type: 'instant',
  text: 'Target creature gets +3/+1 and gains haste until end of turn. Exile the top card of your library. You may play it until your next end step.',
  imagePath:'/assets/cards/haste-magic'
},
{
  id: 'hecteyes',
  name:'Hecteyes',
  costLabel: '1B',
  type: 'creature',
  power: 1,
  toughness: 1,
  text: 'When this creature enters, each opponent discards a card.',
  imagePath:'/assets/cards/hecteyes'
},{
  id: 'hill-gigas',
  name: 'Hill Gigas',
  costLabel: '4RR',
  type: 'creature',
  power: 5,
  toughness: 4,
  text: 'Trample, haste \n' +
  'Mountaincycling 2(2, Discard this card: Search your library for a Mountain card, reveal it, put it into your hand, then shuffle.)',
  imagePath:'/assets/cards/hill-gigas'
},
{
  id: 'hope-estheim',
  name: 'Hope Estheim',
  costLabel: "WU",
  type: 'creature',
  subtype: 'Legendary Creatue \u2014 Human Wizard',
  power: 2,
  toughness: 2,
  text: 'Lifelink \n' +
  'At the beginning of your end step, each opponent mills X cards, where X is the amount of life you gained this turn.',
  imagePath:'/assets/cards/hope-estheim'
},
{
  id: 'ice-flan',
  name: 'Ice Flan',
  costLabel: '4UU',
  type: 'creature',
  power: 5,
  toughness: 4,
  text: 'When this creature enters, tap target artifact or creature an opponent controls. Put a stun counter on it. ' +
  '(If a permanent with a stun counter would become untapped, remove one from it instead.)\n' +
  'Islandcycling 2 (2, Discard this card: Search your library for an Island card, reveal it, put it into your hand, then shuffle.)',
  imagePath:'/assets/cards/ice-flan'
},{
  id: 'ice-magic',
  name: 'Ice Magic',
  costLabel: '1U',
  type: 'instant',
  text: 'Tiered (Choose one additional cost.) \n' +
  '• Blizzard — {0} — Return target creature to its owner’s hand. \n' +
  '• Blizzara — {2} — Target creature’s owner puts it on their choice of the top or bottom of their library. \n' +
  '• Blizzaga — {5}{U} — Target creature’s owner shuffles it into their library.',
  imagePath:'/assets/cards/ice-magic'
},
{
  id: 'ignis-scientia',
  name: 'Ignis Scientia',
  costLabel: '1GU',
  type: 'creature',
  subtype: 'Legendary Creature \u2014 Human Advisor',
  power: 2,
  toughness: 2,
  text: 'When Ignis Scientia enters, look at the top six cards of your library. You may put a land card from among them onto the battlefield tapped. ' +
  'Put the rest on the bottom of your library in a random order. \n' +
  'I’ve Come Up with a New Recipe! — 1GU, Tap: Exile target card from a graveyard. If a creature card was exiled this way, create a Food token.',
  imagePath:'/assets/cards/ignis-scientia'
},
{
  id: 'il-mheg-pixie',
  name: 'Il Mheg Pixie',
  costLabel: '1U',
  type: 'creature',
  power: 2,
  toughness: 1,
  text: 'Flying \n Whenever this creature attacks, surveil 1.',
  imagePath:'/assets/cards/il-mheg-pixie'
},
{
  id: 'insomnia-crown-city',
  name: 'Insomnia, Crown City',
  costLabel: '-',
  type: 'land',
  text:'This land enters tapped. \nTap: Add W or B.',
  imagePath:'/assets/cards/insomnia-crown-city'
},
{
  id: 'instant-ramen',
  name: 'Instant Ramen',
  costLabel: '2',
  type: 'instant',
  text:'Flash \n When this artifact enters, draw a card. \n2, Tap, Sacrifice this artifact: You gain 3 life.',
  imagePath:'/assets/cards/instant-ramen'
},
{
  id: 'iron-giant',
  name: 'Iron Giant',
  costLabel: '7',
  type: 'creature',
  subtype: 'Artifact Demon',
  power: 6,
  toughness: 6,
  text: 'Reach, vigilance, trample',
  imagePath:'/assets/cards/iron-giant'
},
{
  id: 'ishgard-the-holy-see',
  name: 'Ishgard, the Holy See',
  costLabel:'-',
  type: 'land',
  text: 'This land enters tapped. Tap: Add W.' +
  '\nFaith & Grief 3WW \nSorcery — Adventure\n' +
  'Return up to two target artifact and/or enchantment cards from your graveyard to your hand. (Then exile this card. You may play the land later from exile.)',
  imagePath:'/assets/cards/ishgard-the-holy-see'
},
{
  id: 'island',
  name: 'Island',
  costLabel: '-',
  type: 'land',
  text: 'Basic Land — Island \n(Tap: Add U.)',
  imagePath:'/assets/cards/island'
},
{
  id: 'item-shopkeep',
  name: 'Item Shopkeep',
  costLabel: '1R',
  type: 'creature',
  power: 2,
  toughness: 2,
  text: 'Whenever you attack, target attacking equipped creature gains menace until end of turn. (It can’t be blocked except by two or more creatures.)',
  imagePath:'/assets/cards/item-shopkeep'
},
{
  id: 'jecht-reluctant-guardian',
  name: 'Jecht, Reluctant Guardian',
  costLabel: '3B',
  type: 'creature',
  subtype: 'Legendary Creature \u2014 Human Warrior',
  power: 4,
  toughness: 3,
  text: 'Menace \n Whenever Jecht deals combat damage to a player, you may exile it, then return it to the battlefield transformed under its owner’s control.',
  imagePath:'/assets/cards/jecht-reluctant-guardian',
  transformsInto: "Braska's Final Aeon"
},{
  id: 'braska-s-final-aeon',
  name: "Braska's Final Aeon",
  costLabel: '-',
  type:'creature',
  power: 7,
  toughness: 7,
  text: 'I, II — Jecht Beam — Each opponent discards a card and you draw a card. \n' +
  'III — Ultimate Jecht Shot — Each opponent sacrifices two creatures of their choice. \n' +
  'Menace',
  imagePath:'/assets/cards/braska-s-final-aeon'
},
{
  id: 'jenova-ancient-calamity',
  name: 'Jenova, Ancient Calamity',
  costLabel: '2BG',
  type: 'creature',
  subtype: 'Legendary Creature \u2014 Alien',
  power: 1,
  toughness: 5,
  text: "At the beginning of combat on your turn, put a number of +1/+1 counters equal to Jenova’s power on up to one other target creature. " +
  "That creature becomes a Mutant in addition to its other types. Whenever a Mutant you control dies during your turn, you draw cards equal to its power.",
  imagePath:'/assets/cards/jenova-ancient-calamity'
},{
  id:
  name:
  costLabel:
  type:
  power:
  toughness:
  text:
  imagePath:'/assets/cards/'
},{
  id:
  name:
  costLabel:
  type:
  power:
  toughness:
  text:
  imagePath:'/assets/cards/'
},{
  id:
  name:
  costLabel:
  type:
  power:
  toughness:
  text:
  imagePath:'/assets/cards/'
},{
  id:
  name:
  costLabel:
  type:
  power:
  toughness:
  text:
  imagePath:'/assets/cards/'
},{
  id:
  name:
  costLabel:
  type:
  power:
  toughness:
  text:
  imagePath:'/assets/cards/'
},{
  id:
  name:
  costLabel:
  type:
  power:
  toughness:
  text:
  imagePath:'/assets/cards/'
},{
  id:
  name:
  costLabel:
  type:
  power:
  toughness:
  text:
  imagePath:'/assets/cards/'
},{
  id:
  name:
  costLabel:
  type:
  power:
  toughness:
  text:
  imagePath:'/assets/cards/'
},{
  id:
  name:
  costLabel:
  type:
  power:
  toughness:
  text:
  imagePath:'/assets/cards/'
},{
  id:
  name:
  costLabel:
  type:
  power:
  toughness:
  text:
  imagePath:'/assets/cards/'
},{
  id:
  name:
  costLabel:
  type:
  power:
  toughness:
  text:
  imagePath:'/assets/cards/'
},{
  id:
  name:
  costLabel:
  type:
  power:
  toughness:
  text:
  imagePath:'/assets/cards/'
},{
  id:
  name:
  costLabel:
  type:
  power:
  toughness:
  text:
  imagePath:'/assets/cards/'
},{
  id:
  name:
  costLabel:
  type:
  power:
  toughness:
  text:
  imagePath:'/assets/cards/'
},{
  id:
  name:
  costLabel:
  type:
  power:
  toughness:
  text:
  imagePath:'/assets/cards/'
},{
  id:
  name:
  costLabel:
  type:
  power:
  toughness:
  text:
  imagePath:'/assets/cards/'
},{
  id:
  name:
  costLabel:
  type:
  power:
  toughness:
  text:
  imagePath:'/assets/cards/'
},{
  id:
  name:
  costLabel:
  type:
  power:
  toughness:
  text:
  imagePath:'/assets/cards/'
},{
  id:
  name:
  costLabel:
  type:
  power:
  toughness:
  text:
  imagePath:'/assets/cards/'
},{
  id:
  name:
  costLabel:
  type:
  power:
  toughness:
  text:
  imagePath:'/assets/cards/'
},{
  id:
  name:
  costLabel:
  type:
  power:
  toughness:
  text:
  imagePath:'/assets/cards/'
},{
  id:
  name:
  costLabel:
  type:
  power:
  toughness:
  text:
  imagePath:'/assets/cards/'
},{
  id:
  name:
  costLabel:
  type:
  power:
  toughness:
  text:
  imagePath:'/assets/cards/'
},{
  id:
  name:
  costLabel:
  type:
  power:
  toughness:
  text:
  imagePath:'/assets/cards/'
},{
  id:
  name:
  costLabel:
  type:
  power:
  toughness:
  text:
  imagePath:'/assets/cards/'
},{
  id:
  name:
  costLabel:
  type:
  power:
  toughness:
  text:
  imagePath:'/assets/cards/'
},{
  id:
  name:
  costLabel:
  type:
  power:
  toughness:
  text:
  imagePath:'/assets/cards/'
},{
  id:
  name:
  costLabel:
  type:
  power:
  toughness:
  text:
  imagePath:'/assets/cards/'
},{
  id:
  name:
  costLabel:
  type:
  power:
  toughness:
  text:
  imagePath:'/assets/cards/'
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
