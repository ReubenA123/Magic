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

  // --- Creatures ---------------------------------------------------------
  {
    id: 'absolute-virtue',
    name: 'Absolute Virtue',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Avatar Warrior',
    costLabel: '6WU',
    power: 8,
    toughness: 8,
    text: "This spell can\u2019t be countered. Flying, You have protection from each of your opponents. (You can\u2019t be dealt damage, enchanted, or targeted by anything controlled by your opponents.)",
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
    imagePath: '/assets/cards/aerith-gainsborough.webp',
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
    id: 'astrologian-s-planisphere',
    name: "Astrologian's Planisphere",
    type: 'artifact',
    costLabel: '1W',
    text: "Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.) Equipped creature is a Wizard in addition to its other types and has “Whenever you cast a noncreature spell and whenever you draw your third card each turn, put a +1/+1 counter on this creature. Diana — Equip {2}",
    imagePath: '/assets/cards/astrologian-s-planisphere.webp',
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
    subtype: 'Legendary Artifact \u2014 Vehicle',
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
    text: "Choose one — • Attack — Create a 2/2 white Knight creature token. • Ability — Target creature gets +0/+4 until end of turn. " +
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
    text: "Vigilance (Attacking doesn\u2019t cause this creature to tap.) At the beginning of combat on your turn, " +
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
      "At the beginning of your end step, if this creature didn\u2019t enter the battlefield this turn, return it to its owner\u2019s hand.",
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
    text: "Kicker \u2014 Return a land you control to its owner\u2019s hand. " +
      "(You may return a land you control to its owner\u2019s hand in addition to any other costs as you cast this spell.)\n " +
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
    imagePath: '/assets/cards/circle-of-power.webp',
  },
  {
    id: 'clash-of-the-eikons',
    name: 'Clash of the Eikons',
    type: 'sorcery',
    costLabel: 'G',
    text: "Choose one or more \u2014 " +
      "\n• Target creature you control fights target creature an opponent controls." +
      "\n• Remove a lore counter from target Saga you control. (Removing lore counters doesn\u2019t cause chapter abilities to trigger.)" +
      "\n• Put a lore counter on target Saga you control.",
    imagePath: '/assets/cards/clash-of-the-eikons.webp',
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
      "4RR, T: Exile Clive, then return it to the battlefield transformed under its owner\u2019s control. Activate only as a sorcery.",
    imagePath: '/assets/cards/clive-ifrit-s-dominant.webp',
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
    imagePath: '/assets/cards/ifrit-warden-of-inferno.webp',
  },
  {
    id: 'clives-hideaway',
    name: "Clive's Hideaway",
    type: 'land',
    costLabel: '-',
    text: "Hideaway 4 (When this land enters, look at the top four cards of your library, exile one face down, then put the rest on the bottom in a random order.)" +
      "\nT: Add mana." +
      "\n2, T: You may play the exiled card without paying its mana cost if you control four or more legendary creatures.",
    imagePath: '/assets/cards/clive-s-hideaway.webp',
  },
  {
    id: 'cloudbound-moogle',
    name: 'Cloudbound Moogle',
    type: 'creature',
    costLabel: '3WW',
    text: "Flying \n When this creature enters, put a +1/+1 counter on target creature. \n" +
      "Plainscycling 2 (2, Discard this card: Search your library for a Plains card, reveal it, put it into your hand, then shuffle.)",
    imagePath: '/assets/cards/cloudbound-moogle.webp'
  },
  {
    id: 'cloud-midgar-mercenary',
    name: 'Cloud, Midgar Mercenary',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Soldier Mercenary',
    costLabel: "WW",
    power: 2,
    toughness: 1,
    text: "When Cloud enters, search your library for an Equipment card, reveal it, put it into your hand, then shuffle." +
      "\nAs long as Cloud is equipped, if a triggered ability of Cloud or an Equipment attached to it triggers, that ability triggers an additional time.",
    imagePath: '/assets/cards/cloud-midgar-mercenary.webp'
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
    imagePath: '/assets/cards/cloud-of-darkness.webp'
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
      "(This creature deals both first-strike and regular combat damage. Damage and effects that say “destroy” don\u2019t destroy this creature.)" +
      "Equip abilities you activate that target Cloud cost 2 less to activate.",
    imagePath: '/assets/cards/cloud-planet-s-champion.webp',
  },
  {
    id: 'coeurl',
    name: 'Coeurl',
    type: 'creature',
    costLabel: '1W',
    power: 2,
    toughness: 2,
    text: "1W Tap target nonenchantment creature",
    imagePath: '/assets/cards/coeurl.webp',
  },
  {
    id: 'coliseum-behemoth',
    name: 'Coliseum Behemoth',
    type: 'creature',
    costLabel: '5GG',
    power: 7,
    toughness: 7,
    text: "Trample \nWhen this creature enters, choose one \u2014 \n Destroy target artifact or enchantment \nDraw a card",
    imagePath: '/assets/cards/coliseum-behemoth.webp',
  },
  {
    id: 'combat-tutorial',
    name: 'Combat Tutorial',
    type: 'sorcery',
    costLabel: '2U',
    text: "Target player draws two cards. Put a +1/+1 counter on up to one target creature you control.",
    imagePath: '/assets/cards/combat-tutorial.webp'
  },
  {
    id: 'commune-with-beavers',
    name: 'Commune with Beavers',
    type: 'sorcery',
    costLabel: 'G',
    text: 'Look at the top three cards of your library. You may reveal an artifact, creature, ' +
      "or land card from among them and put it into your hand. Put the rest on the bottom of your library in any order.",
    imagePath: '/assets/cards/commune-with-beavers.webp',
  },
  {
    id: 'coral-sword',
    name: 'Coral Sword',
    type: 'artifact',
    subtype: 'equipment',
    costLabel: 'R',
    text: 'Flash \nWhen this Equipment enters, attach it to target creature you control. That creature gains first strike until end of turn.\n Equipped creature gets +1/+0.\nEquip 1',
    imagePath: '/assets/cards/coral-sword.webp',
  },
  {
    id: 'cornered-by-black-mages',
    name: 'Cornered by Black Mages',
    type: 'sorcery',
    costLabel: '1BB',
    text: 'Target opponent sacrifices a creature of their choice. \nCreate a 0/1 black Wizard creature token with “Whenever you cast a noncreature spell, ' +
      ' this token deals 1 damage to each opponent.”',
    imagePath: '/assets/cards/cornered-by-black-mages.webp'
  },
  {
    id: 'crossroad-village',
    name: 'Crossroads Village',
    type: 'land',
    costLabel: '-',
    text: "This land enters tapped. As it enters, choose a color. \nTap: Add one mana of the chosen color.",
    imagePath: '/assets/cards/crossroads-village.webp'
  },
  {
    id: 'crystal-fragments',
    name: 'Crystal Fragments',
    type: 'artifact',
    subtype: 'equipment',
    costLabel: 'W',
    text: "Equipped creature gets +1/+1. \n5WW: Exile this Equipment, then return it to the battlefield transformed under its owner’s control. Activate only as a sorcery. \nEquip 1",
    imagePath: '/assets/cards/crystal-fragments.webp'
  },
  {
    id: 'dark-confidant',
    name: 'Dark Confidant',
    type: 'creature',
    subtype: 'Human Wizard',
    costLabel: '1B',
    power: 2,
    toughness: 1,
    text: "At the beginning of your upkeep, reveal the top card of your library and put that card into your hand. You lose life equal to its mana value.",
    imagePath: '/assets/cards/dark-confidant.webp'
  },
  {
    id: 'dark-knights-greatsword',
    name: "Dark Knight's Greatsword",
    type: 'artifact',
    subtype: 'equipment',
    costLabel: '2B',
    text: 'Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.) \n' +
      "Equipped creature gets +3/+0 and is a Knight in addition to its other types. \nChaosbringer — Equip—Pay 3 life. Activate only once each turn.",
    imagePath: '/assets/cards/dark-knight-s-greatsword.webp'
  },
  {
    id: 'deadly-embrace',
    name: 'Deadly Embrace',
    type: 'sorcery',
    costLabel: '3BB',
    text: 'Destroy target creature an opponent controls. Then draw a card for each creature that died this turn.',
    imagePath: '/assets/cards/deadly-embrace.webp'
  },
  {
    id: 'delivery-moogle',
    name: 'Delivery Moogle',
    type: 'creature',
    subtype: 'Moogle',
    costLabel: '3W',
    power: 3,
    toughness: 2,
    text: 'Flying \nWhen this creature enters, search your library and/or graveyard for an artifact card with mana value 2 or less, ' +
      "\n reveal it, and put it into your hand. If you search your library this way, shuffle.",
    imagePath: '/assets/cards/delivery-moogle.webp'
  },
  {
    id: 'demon-wall',
    name: 'Demon Wall',
    type: 'creature',
    subtype: 'Artifact Creature \u2014 Demon Wall',
    costLabel: '1B',
    power: 3,
    toughness: 3,
    text: 'Defender \nMenace (This creature can\u2019t be blocked except by two or more creatures.) ' +
      "As long as this creature has a counter on it, it can attack as though it didn\u2019t have defender. " +
      "\n5B: Put two +1/+1 counters on this creature.",
    imagePath: '/assets/cards/demon-wall.webp'
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
    imagePath: '/assets/cards/diamond-weapon.webp'
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
      "4WW, Tap: Exile Dion, then return it to the battlefield transformed under its owner\u2019s control. Activate only as a sorcery.",
    imagePath: '/assets/cards/dion-bahamut-s-dominant.webp',
    transformsInto: 'Bahamut, Warden of Light'
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
    imagePath: '/assets/cards/bahamut-warden-of-light.webp'
  },
  {
    id: "dragoons-lance",
    name: "Dragoon's Lance",
    type: 'artifact',
    subtype: 'equipment',
    costLabel: '1W',
    text: 'Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.)' +
      "\nEquipped creature gets +1/+0 and is a Knight in addition to its other types." +
      "\nDuring your turn, equipped creature has flying.\nGae Bolg — Equip 4",
    imagePath: '/assets/cards/dragoon-s-lance.webp'
  },
  {
    id: 'dragoons-wyvern',
    name: "Dragoon's Wyvern",
    type: 'creature',
    costLabel: '2U',
    power: 2,
    toughness: 1,
    text: "Flying\n When this creature enters, create a 1/1 colorless Hero creature token.",
    imagePath: '/assets/cards/dragoon-s-wyvern.webp'
  },
  {
    id: 'dreams-of-laguna',
    name: 'Dreams of Laguna',
    type: 'instant',
    costLabel: '1U',
    text: "Surveil 1, then draw a card. (To surveil 1, look at the top card of your library. You may put it into your graveyard.) " +
      "\nFlashback 3U (You may cast this card from your graveyard for its flashback cost. Then exile it.)",
    imagePath: '/assets/cards/dreams-of-laguna.webp'
  },
  {
    id: 'dwarven-castel-guard',
    name: 'Dwarven Castle Guard',
    type: 'creature',
    costLabel: '1W',
    power: 2,
    toughness: 1,
    text: "When this creature dies, create a 1/1 colorless Hero creature token.",
    imagePath: '/assets/cards/dwarven-castle-guard.webp'
  },
  {
    id: 'eden-seat-of-the-sanctum',
    name: 'Eden, Seat of the Sanctum',
    type: 'land',
    costLabel: '-',
    text: "T: Add C.\n 5, T: Mill two cards. Then you may sacrifice this land. When you do, return another target permanent card from your graveyard to your hand.",
    imagePath: '/assets/cards/eden-seat-of-the-sanctum.webp'
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
    imagePath: '/assets/cards/edgar-king-of-figaro.webp'
  },
  {
    id: 'eject',
    name: 'Eject',
    type: 'instant',
    costLabel: '3U',
    text: "This spell can\u2019t be countered.\n Return target nonland permanent to its owner\u2019s hand.\n Draw a card.",
    imagePath: '/assets/cards/eject.webp'
  },
  {
    id: 'elixir',
    name: 'Elixir',
    type: 'artifact',
    costLabel: '1',
    text: "This artifact enters tapped.\n5, T, Exile this artifact: Shuffle all nonland cards from your graveyard into your library. " +
      "You gain life equal to the number of cards shuffled into your library this way.",
    imagePath: '/assets/cards/elixir.webp'
  },
  {
    id: 'emet-selch-unsundered',
    name: "Emet\u2014Selch, Unsundered",
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Elder Wizard',
    costLabel: '1UB',
    power: 2,
    toughness: 4,
    text: "Vigilance \nWhenever Emet-Selch enters or attacks, draw a card, then discard a card.\n" +
      "At the beginning of your upkeep, if there are fourteen or more cards in your graveyard, you may transform Emet-Selch.",
    imagePath: '/assets/cards/emet-selch-unsundered.webp',
    transformsInto: 'Hades, Sorcerer of Eld'
  },
  {
    id: 'hades-sorcerer-of-eld',
    name: 'Hades, Sorcerer of Eld',
    type: 'creature',
    costLabel: '-',
    power: 6,
    toughness: 6,
    text: "Vigilance \nEcho of the Lost — During your turn, you may play cards from your graveyard. \n" +
      "If a card or token would be put into your graveyard from anywhere, exile it instead.",
    imagePath: '/assets/cards/hades-sorcerer-of-eld.webp'
  },
  {
    id: 'esper-origins',
    name: 'Esper Origins',
    type: 'sorcery',
    costLabel: '1G',
    text: "Surveil 2. You gain 2 life. If this spell was cast from a graveyard, exile it, then put it onto the battlefield transformed under its owner\u2019s control " +
      "with a finality counter on it. (If a creature with a finality counter on it would die, exile it instead.)\nFlashback 3G",
    imagePath: '/assets/cards/esper-origins.webp'
  },
  {
    id: 'ether',
    name: "Ether",
    type: 'artifact',
    costLabel: '3U',
    text: "Tap, Exile this artifact: Add {U}. When you next cast an instant or sorcery spell this turn, copy that spell. You may choose new targets for the copy.",
    imagePath: "/assets/cards/ether.webp"
  },
  {
    id: 'evil-reawakened',
    name: "Evil Reawakened",
    type: "sorcery",
    costLabel: "4B",
    text: "Return target creature card from your graveyard to the battlefield with two additional +1/+1 counters on it.",
    imagePath: "/assets/cards/evil-reawakened.webp"
  },
  {
    id: "excalibur-ii",
    name: "Excalibur II",
    type: 'artifact',
    subtype: 'equipment',
    costLabel: '1',
    text: "Whenever you gain life, put a charge counter on Excalibur II.\nEquipped creature gets +1/+1 for each charge counter on Excalibur II.\nEquip 3",
    imagePath: "/assets/cards/excalibur-ii.webp"
  },
  {
    id: "exdeath-void-warlock",
    name: "Exdeath, Void Warlock",
    type: "creature",
    subtype: "Legendary Creature \u2014 Spirit Warlock",
    costLabel: "1BG",
    power: 3,
    toughness: 3,
    text: "When Exdeath enters, you gain 3 life.\nAt the beginning of your end step, if there are six or more permanent cards in your graveyard, transform Exdeath.",
    imagePath: "/assets/cards/exdeath-void-warlock.webp",
    transformsInto: "Neo Exdeath, Dimension's End"
  },
  {
    id: "neo-exdeath-dimension-s-end",
    name: "Neo Exdeath, Dimension's End",
    type: 'creature',
    costLabel: '-',
    power: 0,
    toughness: 3,
    text: "When Exdeath enters, you gain 3 life.\nAt the beginning of your end step, if there are six or more permanent cards in your graveyard, transform Exdeath.",
    imagePath: '/assets/cards/neo-exdeath-dimension-s-end.webp'
  },
  {
    id: 'fang-fearless-l-cie',
    name: "Fang, Fearless I'Cie",
    type: 'creature',
    costLabel: '2B',
    subtype: 'Legendary Creature \u2014 Human Warrior',
    power: 2,
    toughness: 3,
    text: "Whenever one or more cards leave your graveyard, you draw a card and you lose 1 life. This ability triggers only once each turn.",
    imagePath: '/assets/cards/fang-fearless-l-cie.webp'
  },
  {
    id: 'fate-of-the-sun-cryst',
    name: "Fate of the Sun-Cryst",
    type: 'instant',
    costLabel: '4W',
    text: 'This spell costs 2 less to cast if it targets a tapped creature.\nDestroy target nonland permanent.',
    imagePath: '/assets/cards/fate-of-the-sun-cryst.webp'
  },
  {
    id: "fight-on",
    name: "Fight On!",
    type: 'instant',
    costLabel: '2B',
    text: "Return up to two target creature cards from your graveyard to your hand.",
    imagePath: '/assets/cards/fight-on.webp'
  },
  {
    id: 'fire-magic',
    name: "Fire Magic",
    type: 'instant',
    costLabel: "R",
    text: "Tiered (Choose one additional cost.) \n" +
      "• Fire — {0} — Fire Magic deals 1 damage to each creature. \n" +
      "• Fira — {2} — Fire Magic deals 2 damage to each creature. \n" +
      "• Firaga — {5} — Fire Magic deals 3 damage to each creature.",
    imagePath: '/assets/cards/fire-magic.webp'
  },
  {
    id: 'firion-wild-rose-warrior',
    name: "Firion, Wild Rose Warrior",
    type: 'creature',
    subtype: "Legendary Creature \u2014 Human Rebel Warrior",
    costLabel: '2R',
    power: 3,
    toughness: 3,
    text: "Equipped creatures you control have haste.\nWhenever a nontoken Equipment you control enters, create a token that\u2019s a copy of it, " +
      "except it has “This Equipment\u2019s equip abilities cost {2} less to activate.” Sacrifice that token at the beginning of the next upkeep.",
    imagePath: '/assets/cards/firion-wild-rose-warrior.webp'
  }, {
    id: "forest",
    name: "Forest",
    type: "land",
    costLabel: "-",
    text: "(T: Add G.)",
    imagePath: '/assets/cards/forest.webp'
  }, {
    id: "freya-crescent",
    name: "Freya Crescent",
    type: "creature",
    subtype: 'Legendary Creature \u2014 Rat Knight',
    costLabel: "R",
    text: "Jump — During your turn, Freya Crescent has flying.\nT: Add R. Spend this mana only to cast an Equipment spell or activate an equip ability",
    imagePath: '/assets/cards/freya-crescent.webp'
  }, {
    id: 'from-father-to-son',
    name: 'From Father to Son',
    type: 'sorcery',
    costLabel: '1W',
    text: "Search your library for a Vehicle card, reveal it, and put it into your hand. If this spell was cast from a graveyard, put that card onto the battlefield instead. " +
      "Then shuffle. \nFlashback 4WWW",
    imagePath: '/assets/cards/from-father-to-son.webp'
  }, {
    id: "gaelicat",
    name: 'Gaelicat',
    type: 'creature',
    costLabel: '2W',
    text: "Flying, vigilance \nAs long as you control two or more artifacts, this creature gets +2/+0.",
    imagePath: '/assets/cards/gaelicat.webp'
  }, {
    id: "gaius-van-baelsar",
    name: "Gaius van Baelsar",
    type: 'creature',
    subtype: "Legendary Creature \u2014 Human Soldier",
    costLabel: '2BB',
    text: "When Gaius van Baelsar enters, choose one — " +
      "\n• Each player sacrifices a creature token of their choice. " +
      "\n• Each player sacrifices a nontoken creature of their choice. " +
      "\n• Each player sacrifices an enchantment of their choice.",
    imagePath: '/assets/cards/gaius-van-baelsar.webp'
  }, {
    id: "galuf-s-final-act",
    name: "Galuf's Final Act",
    type: 'instant',
    costLabel: '1G',
    text: 'Until end of turn, target creature gets +1/+0 and gains “When this creature dies, put a number of +1/+1 counters equal to its power on up to one target creature.”',
    imagePath: '/assets/cards/galuf-s-final-act.webp'
  }, {
    id: 'garland-knight-of-cornelia',
    name: "Garland, Knight of Cornelia",
    type: "creature",
    subtype: 'Legendary Creature \u2014 Human Knight',
    costLabel: 'BR',
    power: 3,
    toughness: 2,
    text: "Whenever you cast a noncreature spell, surveil 1. (Look at the top card of your library. You may put it into your graveyard.)" +
      "\n3BBRR: Return this card from your graveyard to the battlefield transformed. Activate only as a sorcery.",
    imagePath: '/assets/cards/garland-knight-of-cornelia.webp',
    transformsInto: 'Chaos, the Endless'
  },
  {
    id: 'chaos-the-endless',
    name: 'Chaos, the Endless',
    type: 'creature',
    costLabel: '-',
    power: 5,
    toughness: 5,
    text: "Flying \nWhen Chaos dies, put it on the bottom of its owner\u2019s library.",
    imagePath: '/assets/cards/chaos-the-endless.webp'
  },
  {
    id: 'garnet-princess-of-alexandria',
    name: 'Garnet, Princess of Alexandria',
    type: 'creature',
    subtype: ' Legendary Creature \u2014 Human Noble Cleric',
    costLabel: 'GW',
    power: 2,
    toughness: 2,
    text: "Lifelink \n Whenever Garnet attacks, you may remove a lore counter from each of any number of Sagas you control. " +
      "Put a +1/+1 counter on Garnet for each lore counter removed this way.",
    imagePath: '/assets/cards/garnet-princess-of-alexandria.webp'
  }, {
    id: 'genji-glove',
    name: 'Genji Glove',
    costLabel: '5',
    type: 'artifact',
    subtype: 'equipment',
    text: "Equipped creature has double strike. \n" +
      "Whenever equipped creature attacks, if it\u2019s the first combat phase of the turn, untap it. After this phase, there is an additional combat phase. " +
      "Equip 3",
    imagePath: '/assets/cards/genji-glove.webp'
  }, {
    id: 'gigantoad',
    name: "Gigantoad",
    costLabel: '3G',
    type: 'creature',
    subtype: 'Frog',
    power: 4,
    toughness: 4,
    text: "As long as you control seven or more lands, this creature gets +2/+2.",
    imagePath: '/assets/cards/gigantoad.webp'
  }, {
    id: "gilgamesh-master-at-arms",
    name: "Gilgamesh, Master-at-Arms",
    costLabel: "4RR",
    type: 'creature',
    power: 6,
    toughness: 6,
    text: "Whenever Gilgamesh enters or attacks, look at the top six cards of your library. \n" +
      "You may put any number of Equipment cards from among them onto the battlefield. Put the rest on the bottom of your library \n" +
      "in a random order. When you put one or more Equipment onto the battlefield this way, you may attach one of them to a Samurai you control.",
    imagePath: '/assets/cards/gilgamesh-master-at-arms.webp'
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
    imagePath: '/assets/cards/giott-king-of-the-dwarves.webp'
  }, {
    id: 'gladiolus-amicitia',
    name: "Gladiolus Amicita",
    costLabel: "4RG",
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Warrior',
    power: 6,
    toughness: 6,
    text: "When Gladiolus Amicitia enters, search your library for a land card, put it onto the battlefield tapped, then shuffle. \n" +
      "Landfall — Whenever a land you control enters, another target creature you control gets +2/+2 and gains trample until end of turn.",
    imagePath: '/assets/cards/gladiolus-amicitia.webp'
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
      "This ability can\u2019t be copied and X can\u2019t be 0. (Mana abilities can\u2019t be targeted.)",
    imagePath: '/assets/cards/gogo-master-of-mimicry.webp'
  },
  {
    id: 'gohn-town-of-ruin',
    name: "Gohn, Town of Ruin",
    costLabel: '-',
    type: 'land',
    text: "This land enters tapped. Tap: Add B or G.",
    imagePath: '/assets/cards/gohn-town-of-ruin.webp'
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
      'Then if you control eight or more artifacts, each opponent loses life equal to that card\u2019s power.',
    imagePath: '/assets/cards/golbez-crystal-collector.webp'
  },
  {
    id: 'gongaga-reactor-town',
    name: 'Gongaga, Reactor Town',
    costLabel: '-',
    type: 'land',
    text: 'This land enters tapped. \nTap: Add R or G.',
    imagePath: '/assets/cards/gongaga-reactor-town.webp'
  },
  {
    id: 'goobbue-gardener',
    name: 'Goobbue Gardener',
    costLabel: '1G',
    type: 'creature',
    power: 1,
    toughness: 3,
    text: 'Tap: Add G.',
    imagePath: '/assets/cards/goobbue-gardener.webp'
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
    imagePath: '/assets/cards/g-raha-tia.webp'
  },
  {
    id: 'gran-pulse-ochu',
    name: 'Gran Pulse Ochu',
    costLabel: 'G',
    type: 'creature',
    power: 1,
    toughness: 1,
    text: 'Deathtouch \n8: Until end of turn, this creature gets +1/+1 for each permanent card in your graveyard.',
    imagePath: '/assets/cards/gran-pulse-ochu.webp'
  },
  {
    id: 'guadosalam-farplane-gateway',
    name: 'Guadosalam, Farplane Gateway',
    costLabel: '-',
    type: 'land',
    text: 'This land enters tapped. \nTap: Add G or U.',
    imagePath: '/assets/cards/guadosalam-farplane-gateway.webp'
  },
  {
    id: 'gysahl-greens',
    name: 'Gysahl Greens',
    costLabel: '1G',
    type: 'sorcery',
    text: 'Create a 2/2 green Bird creature token with “Whenever a land you control enters, this token gets +1/+0 until end of turn.”' +
      "\nFlashback {6}",
    imagePath: '/assets/cards/gysahl-greens.webp'
  }, {
    id: 'haste-magic',
    name: 'Haste Magic',
    costLabel: '1R',
    type: 'instant',
    text: 'Target creature gets +3/+1 and gains haste until end of turn. Exile the top card of your library. You may play it until your next end step.',
    imagePath: '/assets/cards/haste-magic.webp'
  },
  {
    id: 'hecteyes',
    name: 'Hecteyes',
    costLabel: '1B',
    type: 'creature',
    power: 1,
    toughness: 1,
    text: 'When this creature enters, each opponent discards a card.',
    imagePath: '/assets/cards/hecteyes.webp'
  }, {
    id: 'hill-gigas',
    name: 'Hill Gigas',
    costLabel: '4RR',
    type: 'creature',
    power: 5,
    toughness: 4,
    text: 'Trample, haste \n' +
      'Mountaincycling 2(2, Discard this card: Search your library for a Mountain card, reveal it, put it into your hand, then shuffle.)',
    imagePath: '/assets/cards/hill-gigas.webp'
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
    imagePath: '/assets/cards/hope-estheim.webp'
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
    imagePath: '/assets/cards/ice-flan.webp'
  }, {
    id: 'ice-magic',
    name: 'Ice Magic',
    costLabel: '1U',
    type: 'instant',
    text: 'Tiered (Choose one additional cost.) \n' +
      '• Blizzard — {0} — Return target creature to its owner\u2019s hand. \n' +
      '• Blizzara — {2} — Target creature\u2019s owner puts it on their choice of the top or bottom of their library. \n' +
      '• Blizzaga — {5}{U} — Target creature\u2019s owner shuffles it into their library.',
    imagePath: '/assets/cards/ice-magic.webp'
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
      'Put \u2019the rest on the bottom of your library in a random order. \n' +
      'I’ve Come Up with a New Recipe! — 1GU, Tap: Exile target card from a graveyard. If a creature card was exiled this way, create a Food token.',
    imagePath: '/assets/cards/ignis-scientia.webp'
  },
  {
    id: 'il-mheg-pixie',
    name: 'Il Mheg Pixie',
    costLabel: '1U',
    type: 'creature',
    power: 2,
    toughness: 1,
    text: 'Flying \n Whenever this creature attacks, surveil 1.',
    imagePath: '/assets/cards/il-mheg-pixie.webp'
  },
  {
    id: 'insomnia-crown-city',
    name: 'Insomnia, Crown City',
    costLabel: '-',
    type: 'land',
    text: 'This land enters tapped. \nTap: Add W or B.',
    imagePath: '/assets/cards/insomnia-crown-city.webp'
  },
  {
    id: 'instant-ramen',
    name: 'Instant Ramen',
    costLabel: '2',
    type: 'instant',
    text: 'Flash \n When this artifact enters, draw a card. \n2, Tap, Sacrifice this artifact: You gain 3 life.',
    imagePath: '/assets/cards/instant-ramen.webp'
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
    imagePath: '/assets/cards/iron-giant.webp'
  },
  {
    id: 'ishgard-the-holy-see',
    name: 'Ishgard, the Holy See',
    costLabel: '-',
    type: 'land',
    text: 'This land enters tapped. Tap: Add W.' +
      '\nFaith & Grief 3WW \nSorcery — Adventure\n' +
      'Return up to two target artifact and/or enchantment cards from your graveyard to your hand. (Then exile this card. You may play the land later from exile.)',
    imagePath: '/assets/cards/ishgard-the-holy-see.webp'
  },
  {
    id: 'island',
    name: 'Island',
    costLabel: '-',
    type: 'land',
    text: 'Basic Land — Island \n(Tap: Add U.)',
    imagePath: '/assets/cards/island.webp'
  },
  {
    id: 'item-shopkeep',
    name: 'Item Shopkeep',
    costLabel: '1R',
    type: 'creature',
    power: 2,
    toughness: 2,
    text: 'Whenever you attack, target attacking equipped creature gains menace until end of turn. (It can\u2019t be blocked except by two or more creatures.)',
    imagePath: '/assets/cards/item-shopkeep.webp'
  },
  {
    id: 'jecht-reluctant-guardian',
    name: 'Jecht, Reluctant Guardian',
    costLabel: '3B',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Warrior',
    power: 4,
    toughness: 3,
    text: 'Menace \n Whenever Jecht deals combat damage to a player, you may exile it, then return it to the battlefield transformed under its owner\u2019s control.',
    imagePath: '/assets/cards/jecht-reluctant-guardian.webp',
    transformsInto: "Braska's Final Aeon"
  }, {
    id: 'braska-s-final-aeon',
    name: "Braska's Final Aeon",
    costLabel: '-',
    type: 'creature',
    power: 7,
    toughness: 7,
    text: 'I, II — Jecht Beam — Each opponent discards a card and you draw a card. \n' +
      'III — Ultimate Jecht Shot — Each opponent sacrifices two creatures of their choice. \n' +
      'Menace',
    imagePath: '/assets/cards/braska-s-final-aeon.webp'
  },
  {
    id: 'jenova-ancient-calamity',
    name: 'Jenova, Ancient Calamity',
    costLabel: '2BG',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Alien',
    power: 1,
    toughness: 5,
    text: "At the beginning of combat on your turn, put a number of +1/+1 counters equal to Jenova\u2019s power on up to one other target creature. " +
      "That creature becomes a Mutant in addition to its other types. Whenever a Mutant you control dies during your turn, you draw cards equal to its power.",
    imagePath: '/assets/cards/jenova-ancient-calamity.webp'
  }, {
    id: 'jidoor-aristocratic-capital',
    name: 'Jidoor, Aristocratic Capital',
    costLabel: '-',
    type: 'land',
    text: "This land enters tapped. \nTap: Add U.\nOverture 4UU\n" +
      "Sorcery — Adventure\n Target opponent mills half their library, rounded down. (Then exile this card. You may play the land later from exile.)",
    imagePath: '/assets/cards/jidoor-aristocratic-capital.webp'
  },
  {
    id: 'jill-shiva-s-dominant',
    name: "Jill, Shiva's Dominant",
    costLabel: '2U',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Noble Warrior',
    power: 2,
    toughness: 2,
    text: "When Jill enters, return up to one other target nonland permanent to its owner\u2019s hand.\n" +
      "3UU, Tap: Exile Jill, then return it to the battlefield transformed under its owner\u2019s control. Activate only as a sorcery.",
    imagePath: '/assets/cards/jill-shiva-s-dominant.webp',
    transformsInto: 'Shiva, Warden of Ice'
  },
  {
    id: 'shiva-warden-of-ice',
    name: 'Shiva, Warden of Ice',
    costLabel: '-',
    type: 'creature',
    power: 4,
    toughness: 5,
    text: "I, II — Mesmerize — Target creature can\u2019t be blocked this turn. \n" +
      "III — Cold Snap — Tap all lands your opponents control. Exile Shiva, then return it to the battlefield (front face up).",
    imagePath: '/assets/cards/shiva-warden-of-ice.webp'
  },
  {
    id: 'joshua-phoenix-s-dominant',
    name: "Joshua, Phoenix's Dominant",
    costLabel: '1RW',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Noble Wizard',
    power: 3,
    toughness: 4,
    text: "When Joshua enters, discard up to two cards, then draw that many cards. \n" +
      "3RW, Tap: Exile Joshua, then return it to the battlefield transformed under its owner\u2019s control. Activate only as a sorcery.",
    imagePath: '/assets/cards/joshua-phoenix-s-dominant.webp',
    transformsInto: 'Phoenix, Warden of Fire'
  },
  {
    id: 'phoenix-warden-of-fire',
    name: 'Phoenix, Warden of Fire',
    costLabel: '-',
    type: 'creature',
    power: 4,
    toughness: 4,
    text: 'I, II — Rising Flames — Phoenix deals 2 damage to each opponent. \n' +
      "III — Flames of Rebirth — Return any number of target creature cards with total mana value 6 or less from your graveyard to the battlefield. \n" +
      "Exile Phoenix, then return it to the battlefield (front face up). \nFlying, lifelink",
    imagePath: '/assets/cards/phoenix-warden-of-fire.webp'
  },
  {
    id: 'judge-magister-gabranth',
    name: 'Judge Magister Gabranth',
    costLabel: 'WB',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Advisor Knight',
    power: 2,
    toughness: 2,
    text: "Menace \n(This creature can\u2019t be blocked except by two or more creatures.) \n" +
      "Whenever another creature or artifact you control dies, put a +1/+1 counter on Judge Magister Gabranth.",
    imagePath: '/assets/cards/judge-magister-gabranth.webp'
  },
  {
    id: 'judgment-bolt',
    name: 'Judgment Bolt',
    costLabel: '3R',
    type: 'instant',
    text: "Judgment Bolt deals 5 damage to target creature and X damage to that creature\u2019s controller, where X is the number of Equipment you control.",
    imagePath: '/assets/cards/judgment-bolt.webp'
  }, {
    id: 'jumbo-cactuar',
    name: 'Jumbo Cactuar',
    costLabel: '5GG',
    type: 'creature',
    power: 1,
    toughness: 7,
    text: "10,000 Needles — Whenever this creature attacks, it gets +9999/+0 until end of turn.",
    imagePath: '/assets/cards/jumbo-cactuar.webp'
  },
  {
    id: 'kain-traitorous-dragoon',
    name: 'Kain, Traitorous Dragoon',
    costLabel: '2B',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Knight',
    power: 2,
    toughness: 4,
    text: 'Jump — During your turn, Kain has flying. \n' +
      "Whenever Kain deals combat damage to a player, that player gains control of Kain. If they do, you draw that many cards, " +
      "create that many tapped Treasure tokens, then lose that much life.",
    imagePath: '/assets/cards/kain-traitorous-dragoon.webp'
  },
  {
    id: 'kefka-court-mage',
    name: 'Kefka, Court Mage',
    costLabel: '2UBR',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Wizard',
    power: 4,
    toughness: 5,
    text: "Whenever Kefka enters or attacks, each player discards a card. Then you draw a card for each card type among cards discarded this way.\n" +
      "8: Each opponent sacrifices a permanent of their choice. Transform Kefka. Activate only as a sorcery.",
    imagePath: '/assets/cards/kefka-court-mage.webp',
    transformsInto: "Kefka, Court Mage"
  },
  {
    id: 'kefka-ruler-of-ruin',
    name: 'Kefka, Court Mage',
    costLabel: '-',
    type: 'creature',
    power: 5,
    toughness: 7,
    text: 'Flying \n Whenever an opponent loses life during your turn, you draw that many cards.',
    imagePath: '/assets/cards/kefka-ruler-of-ruin.webp'
  },
  {
    id: 'kuja-genome-sorcerer',
    name: 'Kuja, Genome Sorcerer',
    costLabel: '2BR',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Mutant Wizard',
    power: 3,
    toughness: 4,
    text: 'At the beginning of your end step, create a tapped 0/1 black Wizard creature token with ' +
      '“Whenever you cast a noncreature spell, this token deals 1 damage to each opponent.” Then if you control four or more Wizards, transform Kuja.',
    imagePath: '/assets/cards/kuja-genome-sorcerer.webp',
    transformsInto: 'Trance Kuja, Fate Defied'
  },
  {
    id: 'trance-kuja-fate-defied',
    name: 'Trance Kuja, Fate Defied',
    costLabel: '-',
    type: 'creature',
    power: 4,
    toughness: 6,
    text: 'Flare Star — If a Wizard you control would deal damage to a permanent or player, it deals double that damage instead.',
    imagePath: '/assets/cards/trance-kuja-fate-defied.webp'
  },
  {
    id: 'laughing-mad',
    name: 'Laughing Mad',
    costLabel: '2R',
    type: 'instant',
    text: 'As an additional cost to cast this spell, discard a card.\nDraw two cards.\nFlashback 3R',
    imagePath: '/assets/cards/laughing-mad.webp'
  },
  {
    id: 'lightning-army-of-one',
    name: 'Lightning, Army of One',
    costLabel: '1RW',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Soldier',
    power: 3,
    toughness: 2,
    text: "First strike, trample, lifelink\n Stagger — Whenever Lightning deals combat damage to a player," +
      "until your next turn, if a source would deal damage to that player or a permanent that player controls, it deals double that damage instead.",
    imagePath: '/assets/cards/lightning-army-of-one.webp'
  },
  {
    id: 'lightning-security-sergeant',
    name: 'Lightning, Security Sergeant',
    costLabel: '2R',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Soldier',
    power: 2,
    toughness: 3,
    text: "Menace \n" +
      "Whenever Lightning deals combat damage to a player, exile the top card of your library. You may play that card for as long as you control Lightning.",
    imagePath: '/assets/cards/lightning-security-sergeant.webp'
  },
  {
    id: 'light-of-judgment',
    name: 'Light of Judgment',
    costLabel: '4R',
    type: 'instant',
    text: 'Light of Judgment deals 6 damage to target creature. Destroy up to one Equipment attached to that creature.',
    imagePath: '/assets/cards/light-of-judgment.webp'
  },
  {
    id: 'lindblum-industrial-regency',
    name: 'Lindblum, Industrial Regency',
    costLabel: '-',
    type: 'land',
    text: 'This land enters tapped.\nTap: Add R. \nA city encircled by the ramparts of a massive castle.' +
      "\nMage Siege 2R \nInstant — Adventure\n " +
      'Create a 0/1 black Wizard creature token with “Whenever you cast a noncreature spell, this token deals 1 damage to each opponent.”',
    imagePath: '/assets/cards/lindblum-industrial-regency.webp'
  },
  {
    id: 'lion-heart',
    name: 'Lion Heart',
    costLabel: '4',
    type: 'artifact',
    subtype: 'Equipment',
    text: 'When this Equipment enters, it deals 2 damage to any target.\n Equipped creature gets +2/+1.\n Equip 2',
    imagePath: '/assets/cards/lion-heart.webp'
  },
  {
    id: 'locke-cole',
    name: 'Locke Cole',
    costLabel: '1UB',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Rogue',
    power: 2,
    toughness: 3,
    text: "Deathtouch, lifelink \n Whenever Locke Cole deals combat damage to a player, draw a card, then discard a card.",
    imagePath: '/assets/cards/locke-cole.webp'
  },
  {
    id: 'loporrit-scout',
    name: 'Loporrit Scout',
    costLabel: '2G',
    type: 'creature',
    power: 3,
    toughness: 2,
    text: 'Whenever another creature you control enters, this creature gets +1/+1 until end of turn.',
    imagePath: '/assets/cards/loporrit-scout.webp'
  },
  {
    id: 'louisoix-s-sacrifice',
    name: "Louisoix's Sacrifice",
    costLabel: 'U',
    type: 'instant',
    text: 'As an additional cost to cast this spell, sacrifice a legendary creature or pay 2. Counter target activated ability, triggered ability, or noncreature spell.',
    imagePath: '/assets/cards/louisoix-s-sacrifice.webp'
  },
  {
    id: 'lunatic-pandora',
    name: 'Lunatic Pandora',
    costLabel: '1',
    type: 'artifact',
    text: "2, Tap: Surveil 1. (Look at the top card of your library. You may put it into your graveyard.) \n" +
      "6, Tap, Sacrifice Lunatic Pandora: Destroy target nonland permanent.",
    imagePath: '/assets/cards/lunatic-pandora.webp'
  },
  {
    id: 'machinist-s-arsenal',
    name: "Machinist's Arsenal",
    costLabel: '4W',
    type: 'artifact',
    subtype: 'Equipment',
    text: "Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.)" +
      "Equipped creature gets +2/+2 for each artifact you control and is an Artificer in addition to its other types." +
      "Machina — Equip 4 (4: Attach to target creature you control. Equip only as a sorcery.)",
    imagePath: '/assets/cards/machinist-s-arsenal.webp'
  },
  {
    id: 'magic-damper',
    name: 'Magic Damper',
    costLabel: 'U',
    type: 'instant',
    text: 'Target creature you control gets +1/+1 and gains hexproof until end of turn. Untap it.',
    imagePath: '/assets/cards/magic-damper.webp'
  },
  {
    id: 'magic-pot',
    name: 'Magic Pot',
    costLabel: '3',
    type: 'creature',
    subtype: 'artifact',
    power: 1,
    toughness: 4,
    text: 'When this creature dies, create a Treasure token. (It\u2019s an artifact with “{T}, Sacrifice this token: Add one mana of any color.”)\n' +
      "2, Tap: Exile target card from a graveyard.",
    imagePath: '/assets/cards/magic-pot.webp'
  },
  {
    id: 'magitek-armor',
    name: 'Magitek Armor',
    costLabel: '3W',
    type: 'artifact',
    power: 4,
    toughness: 4,
    text: 'When this Vehicle enters, create a 1/1 colorless Hero creature token. \nCrew 1',
    imagePath: '/assets/cards/magitek-armor.webp'
  },
  {
    id: 'magitek-infantry',
    name: 'Magitek Infantry',
    costLabel: 'W',
    type: 'creature',
    subtype: 'Artifact Robot Soldier',
    power: 1,
    toughness: 1,
    text: "This creature gets +1/+0 as long as you control another artifact. \n" +
      "2W: Search your library for a card named Magitek Infantry, put it onto the battlefield tapped, then shuffle.",
    imagePath: '/assets/cards/magitek-infantry.webp'
  },
  {
    id: 'magitek-scythe',
    name: 'Magitek Scythe',
    costLabel: '4',
    type: 'artifact',
    subtype: 'Equipment',
    text: 'A Test of Your Reflexes! — When this Equipment enters, you may attach it to target creature you control. ' +
      "If you do, that creature gains first strike until end of turn and must be blocked this turn if able." +
      "Equipped creature gets +2/+1. \nEquip 2",
    imagePath: '/assets/cards/magitek-scythe.webp'
  },
  {
    id: 'malboro',
    name: 'Malboro',
    costLabel: '4BB',
    type: 'creature',
    power: 4,
    toughness: 4,
    text: "Bad Breath — When this creature enters, each opponent discards a card, loses 2 life, and exiles the top three cards of their library.\n" +
      "Swampcycling 2 (2, Discard this card: Search your library for a Swamp card, reveal it, put it into your hand, then shuffle.)",
    imagePath: '/assets/cards/malboro.webp'
  },
  {
    id: 'matoya-archon-elder',
    name: 'Matoya, Archon Elder',
    costLabel: '2U',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Warlock',
    power: 1,
    toughness: 4,
    text: "Whenever you scry or surveil, draw a card. (Draw after you scry or surveil.)",
    imagePath: '/assets/cards/matoya-archon-elder.webp'
  },
  {
    id: 'memories-returning',
    name: 'Memories Returning',
    costLabel: '2UU',
    type: 'sorcery',
    text: 'Reveal the top five cards of your library. Put one of them into your hand. Then choose an opponent. ' +
      "They put one on the bottom of your library. Then you put one into your hand. Then they put one on the bottom of your library. Put the other into your hand.\n" +
      "Flashback 7UU",
    imagePath: '/assets/cards/memories-returning.webp'
  },
  {
    id: 'midgar-city-of-mako',
    name: 'Midgar, City of Mako',
    costLabel: '-',
    type: 'land',
    text: "This land enters tapped. \nTap: Add B. \nA triumph of technology and testament to man’s potential.\n" +
      "Reactor Raid 2B \nSorcery — Adventure\n " +
      "You may sacrifice an artifact or creature. If you do, draw two cards. (Then exile this card. You may play the land later from exile.)",
    imagePath: '/assets/cards/midgar-city-of-mako.webp'
  },
  {
    id: 'minwu-white-mage',
    name: 'Minwu, White Mage',
    costLabel: '3WW',
    type: 'creature',
    subtype: "Legendary Ceature \u2014 Human Cleric",
    power: 3,
    toughness: 3,
    text: "Vigilance, lifelink \nWhenever you gain life, put a +1/+1 counter on each Cleric you control.",
    imagePath: '/assets/cards/minwu-white-mage.webp'
  },
  {
    id: 'monk-s-fist',
    name: "Monk's Fist",
    costLabel: '2',
    type: 'artifact',
    subtype: 'Equipment',
    text: "Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.)\n" +
      "Equipped creature gets +1/+0 and is a Monk in addition to its other types.\n" +
      "Equip 2 (2: Attach to target creature you control. Equip only as a sorcery.)",
    imagePath: '/assets/cards/monk-s-fist.webp'
  },
  {
    id: 'moogles-valor',
    name: "Moogles' Valor",
    costLabel: '3WW',
    type: 'instant',
    text: 'For each creature you control, create a 1/2 white Moogle creature token with lifelink. Then creatures you control gain indestructible until end of turn.',
    imagePath: '/assets/cards/moogles-valor.webp'
  },
  {
    id: 'mountain',
    name: 'Mountain',
    costLabel: '-',
    type: 'land',
    text: "(Tap: Add R.)",
    imagePath: '/assets/cards/mountain.webp'
  },
  {
    id: 'mysidian-elder',
    name: 'Mysidian Elde',
    costLabel: '2R',
    type: 'creature',
    power: 1,
    toughness: 3,
    text: "When this creature enters, create a 0/1 black Wizard creature token with “Whenever you cast a noncreature spell, this token deals 1 damage to each opponent.”",
    imagePath: '/assets/cards/mysidian-elder.webp'
  },
  {
    id: 'namazu-trader',
    name: 'Namazu Trader',
    costLabel: '3B',
    type: 'creature',
    power: 3,
    toughness: 4,
    text: "When this creature enters, you lose 1 life and create a Treasure token. \n" +
      "Whenever this creature attacks, you may sacrifice another creature or artifact. If you do, surveil 2. ",
    imagePath: '/assets/cards/namazu-trader.webp'
  },
  {
    id: 'nibelheim-aflame',
    name: 'Nibelheim Aflame',
    costLabel: '2RR',
    type: 'sorcery',
    text: 'Choose target creature you control. It deals damage equal to its power to each other creature. If this spell was cast from a graveyard, ' +
      'discard your hand and draw four cards. \n Flashback 5RR (You may cast this card from your graveyard for its flashback cost. Then exile it.)',
    imagePath: '/assets/cards/nibelheim-aflame.webp'
  },
  {
    id: 'ninja-s-blades',
    name: "Ninja's Blades",
    costLabel: '2B',
    type: 'artifact',
    subtype: 'Equipment',
    text: "Job select \n Equipped creature gets +1/+1, is a Ninja in addition to its other types, and has " +
      "“Whenever this creature deals combat damage to a player, draw a card, then discard a card. That player loses life equal to the discarded card\u2019s mana value.”\n" +
      "Mutsunokami — Equip 2",
    imagePath: '/assets/cards/ninja-s-blades.webp'
  },
  {
    id: 'noctis-prince-of-lucis',
    name: 'Noctis, Prince of Lucis',
    costLabel: '1WUB',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Noble',
    power: 4,
    toughness: 3,
    text: "Lifelink\n You may cast artifact spells from your graveyard by paying 3 life in addition to paying their other costs. " +
      "If you cast a spell this way, that artifact enters with a finality counter on it.",
    imagePath: '/assets/cards/noctis-prince-of-lucis.webp'
  },
  {
    id: 'omega-heartless-evolution',
    name: 'Omega, Heartless Evolution',
    costLabel: '5GU',
    type: 'creature',
    subtype: 'Legendary Artifact Creature \u2014  Robot',
    power: 8,
    toughness: 8,
    text: "Wave Cannon — When Omega enters, for each opponent, tap up to one target nonland permanent that opponent controls. " +
      "Put X stun counters on each of those permanents and you gain X life, where X is the number of nonbasic lands you control. " +
      "(If a permanent with a stun counter would become untapped, remove one from it instead.)",
    imagePath: '/assets/cards/omega-heartless-evolution.webp'
  },
  {
    id: 'opera-love-song',
    name: 'Opera Love Song',
    costLabel: '1R',
    type: 'instant',
    text: "Choose one — \n• Exile the top two cards of your library. You may play those cards until your next end step.\n" +
      "• One or two target creatures each get +2/+0 until end of turn",
    imagePath: '/assets/cards/opera-love-song.webp'
  },
  {
    id: 'overkill',
    name: 'Overkill',
    costLabel: '2B',
    type: 'instant',
    text: 'Target creature gets -0/-9999 until end of turn.',
    imagePath: '/assets/cards/overkill.webp'
  },
  {
    id: 'paladin-s-arms',
    name: "Paladin's Arms",
    costLabel: '2W',
    type: 'artifact',
    subtype: 'Equipment',
    text: "Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.) \n" +
      "Equipped creature gets +2/+1, has ward {1}, and is a Knight in addition to its other types. \n" +
      "Lightbringer and Hero\u2019s Shield — Equip 4 (4: Attach to target creature you control. Equip only as a sorcery.)",
    imagePath: '/assets/cards/paladin-s-arms.webp'
  },
  {
    id: 'phantom-train',
    name: "Phantom Train",
    costLabel: '3B',
    type: 'artifact',
    power: 4,
    toughness: 4,
    text: "Trample \n Sacrifice another artifact or creature: Put a +1/+1 counter on this Vehicle." +
      "It becomes a Spirit artifact creature in addition to its other types until end of turn.",
    imagePath: '/assets/cards/phantom-train.webp'
  },
  {
    id: 'phoenix-down',
    name: 'Phoenix Down',
    costLabel: 'W',
    type: 'artifact',
    text: "1W, Tap, Exile this artifact: Choose one — \n" +
      "• Return target creature card with mana value 4 or less from your graveyard to the battlefield tapped. \n" +
      "• Exile target Skeleton, Spirit, or Zombie.",
    imagePath: '/assets/cards/phoenix-down.webp'
  },
  {
    id: 'plains',
    name: "Plains",
    costLabel: '-',
    type: 'land',
    text: '(T: Add W.)',
    imagePath: '/assets/cards/plains.webp'
  },
  {
    id: 'poison-the-waters',
    name: 'Poison the Waters',
    costLabel: '1B',
    type: 'sorcery',
    text: "Choose one — \n• All creatures get -1/-1 until end of turn.\n " +
      "• Target player reveals their hand. You choose an artifact or creature card from it. That player discards that card.",
    imagePath: '/assets/cards/poison-the-waters.webp'
  },
  {
    id: 'prishe-s-wanderings',
    name: "Prishe's Wanderings",
    costLabel: '2G',
    type: 'instant',
    text: 'Search your library for a basic land card or Town card, put it onto the battlefield tapped, then shuffle. ' +
      'When you search your library this way, put a +1/+1 counter on target creature you control.',
    imagePath: '/assets/cards/prishe-s-wanderings.webp'
  },
  {
    id: 'prompto-argentum',
    name: 'Prompto Argentum',
    costLabel: '1R',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Scout',
    power: 2,
    toughness: 2,
    text: "Haste \n Selfie Shot — Whenever you cast a noncreature spell, if at least four mana was spent to cast it, create a Treasure token.",
    imagePath: '/assets/cards/prompto-argentum.webp'
  },
  {
    id: 'pupu-ufo',
    name: "PuPu UFO",
    costLabel: '2',
    type: 'creature',
    subtype: 'Artifact Construct Alien',
    power: 0,
    toughness: 4,
    text: "Flying \n Tap: You may put a land card from your hand onto the battlefield.\n" +
      "3: Until end of turn, this creature\u2019s base power becomes equal to the number of Towns you control.",
    imagePath: '/assets/cards/pupu-ufo.webp'
  },
  {
    id: 'qiqirn-merchant',
    name: 'Qiqirn Merchant',
    costLabel: '2U',
    type: 'creature',
    power: 1,
    toughness: 4,
    text: "1, Tap: Draw a card, then discard a card. \n" +
      "7, Tap, Sacrifice this creature: Draw three cards. This ability costs 1 less to activate for each Town you control.",
    imagePath: '/assets/cards/qiqirn-merchant.webp'
  },
  {
    id: 'queen-brahne',
    name: 'Queen Brahne',
    costLabel: '2R',
    type: 'creature',
    subtype: 'Legendary Creature Human Noble',
    power: 2,
    toughness: 1,
    text: "Prowess (Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.) \n " +
      "Whenever Queen Brahne attacks, create a 0/1 black Wizard creature token with “Whenever you cast a noncreature spell, this token deals 1 damage to each opponent.”",
    imagePath: '/assets/cards/queen-brahne.webp'
  },
  {
    id: 'quina-qu-gourmet',
    name: 'Quina, Qu Gourmet',
    costLabel: '2G',
    type: 'creature',
    subtype: 'Legendary Creature Qu',
    power: 2,
    toughness: 3,
    text: 'If one or more tokens would be created under your control, those tokens plus a 1/1 green Frog creature token are created instead. \n' +
      "2, Sacrifice a Frog: Put a +1/+1 counter on Quina.",
    imagePath: '/assets/cards/quina-qu-gourmet.webp'
  },
  {
    id: 'quistis-trepe',
    name: 'Quistis Trepe',
    costLabel: '2U',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Wizard',
    power: 2,
    toughness: 2,
    text: "Blue Magic — When Quistis Trepe enters, you may cast target instant or sorcery card from a graveyard, " +
      "and mana of any type can be spent to cast that spell. If that spell would be put into a graveyard, exile it instead.",
    imagePath: '/assets/cards/quistis-trepe.webp'
  },
  {
    id: 'qutrub-forayer',
    name: 'Qutrub Forayer',
    costLabel: '2B',
    type: 'creature',
    power: 3,
    toughness: 2,
    text: 'When this creature enters, choose one — \n' +
      '• Destroy target creature that was dealt damage this turn. \n' +
      '• Exile up to two target cards from a single graveyard.',
    imagePath: '/assets/cards/qutrub-forayer.webp'
  },
  {
    id: 'rabanastre-royal-city',
    name: 'Rabanastre, Royal City',
    costLabel: '-',
    type: 'land',
    text: "This land enters tapped.\n Tap: Add R or W.",
    imagePath: '/assets/cards/rabanastre-royal-city.webp'
  },
  {
    id: 'ragnarok-divine-deliverance',
    name: 'Ragnarok, Divine Deliverance',
    costLabel: '-',
    type: 'creature',
    power: 7,
    toughness: 6,
    text: 'Reach, vigilance, menace, trample, haste \n ' +
      'When Ragnarok dies, destroy target permanent and return target nonlegendary permanent card from your graveyard to the battlefield.',
    imagePath: '/assets/cards/ragnarok-divine-deliverance.webp'
  },
  {
    id: 'random-encounter',
    name: 'Random Encounter',
    costLabel: '4RR',
    type: 'sorcery',
    text: 'Shuffle your library, then mill four cards. Put each creature card milled this way onto the battlefield. ' +
      'They gain haste. At the beginning of the next end step, return those creatures to their owner\u2019s hand.\n' +
      'Flashback 6RR',
    imagePath: '/assets/cards/random-encounter.webp'
  },
  {
    id: 'raubahn-bull-of-ala-mhigo',
    name: 'Raubahn, Bull of Ala Mhigo',
    costLabel: '1R',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Warrior',
    power: 2,
    toughness: 2,
    text: 'Ward—Pay life equal to Raubahn\u2019s power.\n Whenever Raubahn attacks, attach up to one target Equipment you control to target attacking creature.',
    imagePath: '/assets/cards/raubahn-bull-of-ala-mhigo.webp'
  },
  {
    id: 'reach-the-horizon',
    name: 'Reach the Horizon',
    costLabel: '3G',
    type: 'sorcery',
    text: 'Search your library for up to two basic land cards and/or Town cards with different names, put them onto the battlefield tapped, then shuffle.',
    imagePath: '/assets/cards/reach-the-horizon.webp'
  },
  {
    id: 'red-mage-s-rapier',
    name: "Red Mage's Rapier",
    costLabel: '1R',
    type: 'artifact',
    subtype: 'Equipment',
    text: "Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.) \n" +
      "Equipped creature has “Whenever you cast a noncreature spell, this creature gets +2/+0 until end of turn” and is a Wizard in addition to its other types.\n" +
      "Equip 3",
    imagePath: '/assets/cards/red-mage-s-rapier.webp'
  },
  {
    id: 'relentless-x-atm092',
    name: 'Relentless X-ATM092',
    costLabel: '6',
    type: 'creature',
    subtype: 'Artifact Creature Robot Spider',
    power: 6,
    toughness: 5,
    text: 'This creature can\u2019t be blocked except by three or more creatures. \n' +
      "8: Return this card from your graveyard to the battlefield tapped with a finality counter on it. " +
      "(If a creature with a finality counter on it would die, exile it instead.)",
    imagePath: '/assets/cards/relentless-x-atm092.webp'
  },
  {
    id: 'relm-s-sketching',
    name: "Relm's Sketching",
    costLabel: '2UU',
    type: 'sorcery',
    text: "Create a token that\u2019s a copy of target artifact, creature, or land.",
    imagePath: '/assets/cards/relm-s-sketching.webp'
  },
  {
    id: 'reno-and-rude',
    name: 'Reno and Rude',
    costLabel: '1B',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Assassin',
    power: 2,
    toughness: 1,
    text: "Menace \n Whenever Reno and Rude deals combat damage to a player, exile the top card of that player\u2019s library. " +
      "Then you may sacrifice another creature or artifact. If you do, you may play the exiled card this turn, and mana of any type can be spent to cast it.",
    imagePath: '/assets/cards/reno-and-rude.webp'
  },
  {
    id: 'resentful-revelation',
    name: 'Resentful Revelation',
    costLabel: '1B',
    type: 'sorcery',
    text: 'Look at the top three cards of your library. Put one of them into your hand and the rest into your graveyard. \n' +
      'Flashback 6B',
    imagePath: '/assets/cards/resentful-revelation.webp'
  },
  {
    id: 'restoration-magic',
    name: 'Restoration Magic',
    costLabel: 'W',
    type: 'instant',
    text: 'Tiered (Choose one additional cost.) \n• Cure — 0 — Target permanent gains hexproof and indestructible until end of turn.\n' +
      "• Cura — 1 — Target permanent gains hexproof and indestructible until end of turn. You gain 3 life.\n" +
      "• Curaga — 3W — Permanents you control gain hexproof and indestructible until end of turn. You gain 6 life.",
    imagePath: '/assets/cards/restoration-magic.webp'
  },
  {
    id: 'retrieve-the-esper',
    name: 'Retrieve the Esper',
    costLabel: '3U',
    type: 'sorcery',
    text: 'Create a 3/3 blue Robot Warrior artifact creature token. Then if this spell was cast from a graveyard, put two +1/+1 counters on that token. \nFlashback 5U',
    imagePath: '/assets/cards/retrieve-the-esper.webp'
  },
  {
    id: 'ride-the-shoopuf',
    name: 'Ride the Shoopuf',
    costLabel: '1G',
    type: 'enchantment',
    text: 'Landfall — Whenever a land you control enters, put a +1/+1 counter on target creature you control. \n' +
      "5GG: This enchantment becomes a 7/7 Beast creature in addition to its other types.",
    imagePath: '/assets/cards/ride-the-shoopuf.webp'
  },
  {
    id: 'ring-of-the-lucii',
    name: 'Ring of the Lucii',
    costLabel: '4',
    type: 'artifact',
    text: 'T: Add MM. \n2, Tap, Pay 1 life: Tap target nonland permanent.',
    imagePath: '/assets/cards/ring-of-the-lucii.webp'
  },
  {
    id: 'rinoa-heartilly',
    name: 'Rinoa Heartilly',
    costLabel: '3GW',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Rebel Warlock',
    power: 4,
    toughness: 4,
    text: 'When Rinoa Heartilly enters, create Angelo, a legendary 1/1 green and white Dog creature token. \n' +
      'Angelo Cannon — Whenever Rinoa Heartilly attacks, another target creature you control gets +1/+1 until end of turn for each creature you control.',
    imagePath: '/assets/cards/rinoa-heartilly.webp'
  },
  {
    id: 'rook-turret',
    name: 'Rook Turret',
    costLabel: '3U',
    type: 'creature',
    subtype: 'Artifact',
    power: 3,
    toughness: 3,
    text: 'Flying \nWhenever another artifact you control enters, you may draw a card. If you do, discard a card.',
    imagePath: '/assets/cards/rook-turret.webp'
  },
  {
    id: 'rosa-resolute-white-mage',
    name: 'Rosa, Resolute White Mage',
    costLabel: '3W',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Noble Cleric',
    power: 2,
    toughness: 3,
    text: 'Reach \nAt the beginning of combat on your turn, put a +1/+1 counter on target creature you control. ' +
      'It gains lifelink until end of turn. (Damage dealt by the creature also causes you to gain that much life.)',
    imagePath: '/assets/cards/rosa-resolute-white-mage.webp'
  },
  {
    id: 'rufus-shinra',
    name: 'Rufus Shinra',
    costLabel: '1WB',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Noble',
    power: 2,
    toughness: 4,
    text: 'Whenever Rufus Shinra attacks, if you don’t control a creature named Darkstar, create Darkstar, a legendary 2/2 white and black Dog creature token.',
    imagePath: '/assets/cards/rufus-shinra.webp'
  },
  {
    id: 'rydia-s-return',
    name: 'Rydia\u2019s Return',
    costLabel: '3GG',
    type: 'sorcery',
    text: 'Choose one — \n• Creatures you control get +3/+3 until end of turn.\n• Return up to two target permanent cards from your graveyard to your hand.',
    imagePath: '/assets/cards/rydia-s-return.webp'
  },
  {
    id: 'rydia-summoner-of-mist',
    name: 'Rydia, Summoner of Mist',
    costLabel: 'RG',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Shaman',
    power: 1,
    toughness: 2,
    text: 'Landfall — Whenever a land you control enters, you may discard a card. If you do, draw a card.\n' +
      'Summon — {X}, {T}: Return target Saga card with mana value X from your graveyard to the battlefield with ' +
      'a finality counter on it. It gains haste until end of turn. Activate only as a sorcery.',
    imagePath: '/assets/cards/rydia-summoner-of-mist.webp'
  },
  {
    id: 'sabotender',
    name: 'Sabotender',
    costLabel: '1R',
    type: 'creature',
    power: 2,
    toughness: 1,
    text: 'Reach \nLandfall — Whenever a land you control enters, this creature deals 1 damage to each opponent.',
    imagePath: '/assets/cards/sabotender.webp'
  },
  {
    id: 'sage-s-nouliths',
    name: 'Sage\u2019s Nouliths',
    costLabel: '1U',
    type: 'artifact',
    subtype: 'Equipment',
    text: 'Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.) \n' +
      'Equipped creature gets +1/+0, has “Whenever this creature attacks, untap target attacking creature,” and is a Cleric in addition to its other types.\n' +
      'Hagneia — Equip 3',
    imagePath: '/assets/cards/sage-s-nouliths.webp'
  },
  {
    id: 'sahagin',
    name: 'Sahagin',
    costLabel: '1U',
    type: 'creature',
    power: 1,
    toughness: 3,
    text: 'Whenever you cast a noncreature spell, if at least four mana was spent to cast it, put a +1/+1 counter on this creature and it can\u2019t be blocked this turn.',
    imagePath: '/assets/cards/sahagin.webp'
  },
  {
    id: 'samurai-s-katana',
    name: 'Samurai\u2019s Katana',
    costLabel: '2R',
    type: 'artifact',
    subtype: 'Equipment',
    text: 'Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.)\n' +
      'Equipped creature gets +2/+2, has trample and haste, and is a Samurai in addition to its other types. \n' +
      'Murasame — Equip 5',
    imagePath: '/assets/cards/samurai-s-katana.webp'
  },
  {
    id: 'sandworm',
    name: 'Sandworm',
    costLabel: '4R',
    type: 'creature',
    power: 5,
    toughness: 4,
    text: 'Haste \n' +
      'When this creature enters, destroy target land. Its controller may search their library for a basic land card, put it onto the battlefield tapped, then shuffle.',
    imagePath: '/assets/cards/sandworm.webp'
  },
  {
    id: 'sazh-katzroy',
    name: 'Sazh Katzro',
    costLabel: '3G',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Pilot',
    power: 3,
    toughness: 3,
    text: 'When Sazh Katzroy enters, you may search your library for a Bird or basic land card, reveal it, put it into your hand, then shuffle.\n' +
      'Whenever Sazh Katzroy attacks, put a +1/+1 counter on target creature, then double the number of +1/+1 counters on that creature.',
    imagePath: '/assets/cards/sazh-katzroy.webp'
  },
  {
    id: 'sazh-s-chocobo',
    name: 'Sazh\u2019s Chocobo',
    costLabel: 'G',
    type: 'creature',
    subtype: 'Bird',
    power: 0,
    toughness: 1,
    text: 'Landfall — Whenever a land you control enters, put a +1/+1 counter on this creature.',
    imagePath: '/assets/cards/sazh-s-chocobo.webp'
  },
  {
    id: 'scorpion-sentinel',
    name: 'Scorpion Sentinel',
    costLabel: '1U',
    type: 'creature',
    subtype: 'artifact Robot Scorpion',
    power: 1,
    toughness: 4,
    text: 'As long as you control seven or more lands, this creature gets +3/+0.',
    imagePath: '/assets/cards/scorpion-sentinel.webp'
  },
  {
    id: 'seifer-almasy',
    name: 'Seifer Almasy',
    costLabel: '3R',
    type: 'creature',
    subtype: 'Legendary Creature Human Knight',
    power: 3,
    toughness: 4,
    text: 'Whenever a creature you control attacks alone, it gains double strike until end of turn. \n' +
      'Fire Cross — Whenever Seifer Almasy deals combat damage to a player, you may cast target instant or ' +
      'sorcery card with mana value 3 or less from your graveyard without paying its mana cost. If that spell would be put into your graveyard, exile it instead.',
    imagePath: '/assets/cards/seifer-almasy.webp'
  },
  {
    id: 'self-destruct',
    name: 'Self-Destruct',
    costLabel: '1R',
    type: 'instant',
    text: 'Target creature you control deals X damage to any other target and X damage to itself, where X is its power.',
    imagePath: '/assets/cards/self-destruct.webp'
  },
  {
    id: 'sephiroth-fabled-soldier',
    name: 'Sephiroth, Fabled SOLDIER',
    costLabel: '2B',
    type: 'creature',
    subtype: 'Legendary Creature Human Avatar Soldier',
    power: 3,
    toughness: 3,
    text: 'Whenever Sephiroth enters or attacks, you may sacrifice another creature. If you do, draw a card.\n' +
      'Whenever another creature dies, target opponent loses 1 life and you gain 1 life. If this is the fourth time this ability has resolved this turn, transform Sephiroth.',
    imagePath: '/assets/cards/sephiroth-fabled-soldier.webp',
    transformsInto: 'Sephiroth, One-Winged Angel',
  },
  {
    id: 'sephiroth-one-winged-angel',
    name: 'Sephiroth, One-Winged Angel',
    costLabel: '-',
    type: 'creature',
    subtype: 'Legendary Creature Angel Nightmare Avatar',
    power: 5,
    toughness: 5,
    text: 'Super Nova — As this creature transforms into Sephiroth, One-Winged Angel, you get an emblem with "Whenever a creature dies, ' +
      'target opponent loses 1 life and you gain 1 life."\n' +
      'Whenever Sephiroth attacks, you may sacrifice any number of other creatures. If you do, draw that many cards.',
    imagePath: '/assets/cards/sephiroth-one-winged-angel.webp'
  },
  {
    id: 'sephiroth-planet-s-heir',
    name: 'Sephiroth, Planet\u2019s Heir',
    costLabel: '4UB',
    type: 'creature',
    subtype: 'Legendary Creature Human Avatar Soldier',
    power: 4,
    toughness: 4,
    text: 'Vigilance (Attacking doesn\u2019t cause this creature to tap.) \n' +
      'When Sephiroth enters, creatures your opponents control get -2/-2 until end of turn. \n' +
      'Whenever a creature an opponent controls dies, put a +1/+1 counter on Sephiroth.',
    imagePath: '/assets/cards/sephiroth-planet-s-heir.webp'
  },
  {
    id: 'sephiroth-s-intervention',
    name: 'Sephiroth\u2019s Intervention',
    costLabel: '3B',
    type: 'instant',
    text: 'Destroy target creature. You gain 2 life.',
    imagePath: '/assets/cards/sephiroth-s-intervention.webp'
  },
  {
    id: 'serah-farron',
    name: 'Serah Farron',
    costLabel: '1GW',
    type: 'creature',
    subtype: 'Legendary Creature Human Citizen',
    power: 2,
    toughness: 2,
    text: 'The first legendary creature spell you cast each turn costs 2 less to cast. \n' +
      'At the beginning of combat on your turn, if you control two or more other legendary creatures, you may transform Serah Farron.',
    imagePath: '/assets/cards/serah-farron.webp',
    transformsInto: 'Crystallized Serah'
  },
  {
    id: 'crystallized-serah',
    name: 'Crystallized Serah',
    costLabel: '-',
    type: 'artifact',
    subtype: 'Legendary Artifact',
    text: 'The first legendary creature spell you cast each turn costs 2 less to cast. \n' +
      'Legendary creatures you control get +2/+2.',
    imagePath: '/assets/cards/crystallized-serah.webp'
  },
  {
    id: 'seymour-flux',
    name: 'Seymour Flux',
    costLabel: '4B',
    type: 'creature',
    subtype: 'Legendary Creature Spirit Avatar',
    power: 5,
    toughness: 5,
    text: 'At the beginning of your upkeep, you may pay 1 life. If you do, draw a card and put a +1/+1 counter on Seymour Flux.',
    imagePath: '/assets/cards/seymour-flux.webp'
  },
  {
    id: 'shambling-cie-th',
    name: 'Shambling Cie\u2019th',
    costLabel: '2B',
    type: 'creature',
    power: 3,
    toughness: 3,
    text: 'This creature enters tapped. \n' +
      'Whenever you cast a noncreature spell, you may pay B. If you do, return this card from your graveyard to your hand.',
    imagePath: '/assets/cards/shambling-cie-th.webp'
  },
  {
    id: 'shantotto-tactician-magician',
    name: 'Shantotto, Tactician Magician',
    costLabel: '1UR',
    type: 'creature',
    subtype: 'Legendary Creature Dwarf Wizard',
    power: 0,
    toughness: 4,
    text: 'Whenever you cast a noncreature spell, Shantotto gets +X/+0 until end of turn, where X is the amount of mana spent to cast that spell. If X is 4 or more, draw a card.',
    imagePath: '/assets/cards/shantotto-tactician-magician.webp'
  },
  {
    id: 'sharlayan-nation-of-scholars',
    name: 'Sharlayan, Nation of Scholars',
    costLabel: '-',
    type: 'land',
    text: 'This land enters tapped. \nTap: Add W or U.',
    imagePath: '/assets/cards/sharlayan-nation-of-scholars.webp'
  },
  {
    id: 'shinra-reinforcements',
    name: 'Shinra Reinforcement',
    costLabel: '2B',
    type: 'creature',
    power: 2,
    toughness: 3,
    text: 'When this creature enters, mill three cards and you gain 3 life.',
    imagePath: '/assets/cards/shinra-reinforcements.webp'
  },
  {
    id: 'sidequest-card-collection',
    name: 'Sidequest: Card Collection',
    costLabel: '3U',
    type: 'enchantment',
    text: 'When this enchantment enters, draw three cards, then discard two cards. \n' +
      'At the beginning of your end step, if eight or more cards are in your graveyard, transform this enchantment.',
    imagePath: '/assets/cards/sidequest-card-collection.webp'
  },
  {
    id: 'sidequest-catch-a-fish',
    name: 'Sidequest: Catch a Fish',
    costLabel: '2W',
    type: 'enchantment',
    text: 'At the beginning of your upkeep, look at the top card of your library. If it\u2019s an artifact or creature card, ' +
      'you may reveal it and put it into your hand. If you put a card into your hand this way, create a Food token and transform this enchantment.',
    imagePath: '/assets/cards/sidequest-catch-a-fish.webp',
    transformsInto: 'Cooking Campsite'
  },
  {
    id: 'cooking-campsite',
    name: 'Cooking Campsite',
    costLabel: '-',
    type: 'land',
    text: ': Add W. \n ' +
      '3, Tap, Sacrifice an artifact: Put a +1/+1 counter on each creature you control. Activate only as a sorcery.',
    imagePath: '/assets/cards/cooking-campsite.webp'
  },
  {
    id: 'sidequest-hunt-the-mark',
    name: 'Sidequest: Hunt the Mark',
    costLabel: '3BB',
    type: 'enchantment',
    text: 'When this enchantment enters, destroy up to one target creature.\n' +
      'At the beginning of your end step, if a creature died under an opponent\u2019s control this turn, ' +
      'create a Treasure token. Then if you control three or more Treasures, transform this enchantment.',
    imagePath: '/assets/cards/sidequest-hunt-the-mark.webp',
    transformsInto: 'Yiazmat, Ultimate Mark'
  },
  {
    id: 'yiazmat-ultimate-mark',
    name: 'Yiazmat, Ultimate Mark',
    costLabel: '-',
    type: 'creature',
    subtype: 'Legendary Creature Dragon',
    text: '1B, Sacrifice another creature or artifact: Yiazmat gains indestructible until end of turn. Tap it.',
    imagePath: '/assets/cards/yiazmat-ultimate-mark.webp'
  },
  {
    id: 'sidequest-play-blitzball',
    name: 'Sidequest: Play Blitzbal',
    costLabel: '2R',
    type: 'enchantment',
    text: 'At the beginning of combat on your turn, target creature you control gets +2/+0 until end of turn.\n' +
      'At the end of combat on your turn, if a player was dealt 6 or more combat damage this turn, transform this enchantment, then attach it to a creature you control.',
    imagePath: '/assets/cards/sidequest-play-blitzball.webp',
    transformsInto: 'World Champion, Celestial Weapon'
  },
  {
    id: 'world-champion-celestial-weapon',
    name: 'World Champion, Celestial Weapon',
    costLabel: '-',
    type: 'artifact',
    subtype: 'Legendary Artifact Equipment',
    text: 'Double Overdrive — Equipped creature gets +2/+0 and has double strike. \n' +
      'Equip 3 (3: Attach to target creature you control. Equip only as a sorcery.)',
    imagePath: '/assets/cards/world-champion-celestial-weapon.webp'
  },
  {
    id: 'sidequest-raise-a-chocobo',
    name: 'Sidequest: Raise a Chocobo',
    costLabel: '1G',
    type: 'enchantment',
    text: 'When this enchantment enters, create a 2/2 green Bird creature token with “Whenever a land you control enters, this token gets +1/+0 until end of turn.”\n' +
      'At the beginning of your first main phase, if you control four or more Birds, transform this enchantment.',
    imagePath: '/assets/cards/sidequest-raise-a-chocobo.webp',
    transformsInto: 'Black Chocobo'
  },
  {
    id: 'black-chocobo',
    name: 'Black Chocobo',
    costLabel: '-',
    type: 'creature',
    power: 2,
    toughness: 2,
    text: 'When this permanent transforms into Black Chocobo, search your library for a land card, put it onto the battlefield tapped, then shuffle.\n' +
      'Landfall — Whenever a land you control enters, Birds you control get +1/+0 until end of turn.',
    imagePath: '/assets/cards/black-chocobo.webp'
  },
  {
    id: 'sin-spira-s-punishment',
    name: 'Sin, Spira\u2019s Punishment',
    costLabel: '4BGU',
    type: 'creature',
    subtype: 'Legendary Creature Leviathan Avatar',
    power: 7,
    toughness: 7,
    text: 'Flying \n' +
      'Whenever Sin enters or attacks, exile a permanent card from your graveyard at random, then create a tapped token that\u2019s a copy of that card. ' +
      'If the exiled card is a land card, repeat this process.',
    imagePath: '/assets/cards/sin-spira-s-punishment.webp'
  },
  {
    id: 'slash-of-light',
    name: 'Slash of Light',
    costLabel: '1W',
    type: 'instant',
    text: 'Slash of Light deals damage equal to the number of creatures you control plus the number of Equipment you control to target creature.',
    imagePath: '/assets/cards/slash-of-light.webp'
  },
  {
    id: 'sleep-magic',
    name: 'Sleep Magic',
    costLabel: 'B',
    type: 'enchantment',
    text: 'Enchant creature \n ' +
      'When this Aura enters, tap enchanted creature. \n' +
      'Enchanted creature doesn\u2019t untap during its controller\u2019s untap step.\n' +
      'When enchanted creature is dealt damage, sacrifice this Aura.',
    imagePath: '/assets/cards/sleep-magic.webp'
  },
  {
    id: 'snow-villiers',
    name: 'Snow Villiers',
    costLabel: '2W',
    type: 'creature',
    subtype: 'Legendary Creature Human Rebel Monk',
    text: 'Vigilance \nSnow Villiers\u2019s power is equal to the number of creatures you control.',
    imagePath: '/assets/cards/snow-villiers.webp'
  },
  {
    id: 'sorceress-s-schemes',
    name: 'Sorceress\u2019s Schemes',
    costLabel: '3R',
    type: 'sorcery',
    text: 'Return target instant or sorcery card from your graveyard or exiled card with flashback you own to your hand. Add R. \n' +
      'Flashback 4R',
    imagePath: '/assets/cards/sorceress-s-schemes.webp'
  },
  {
    id: 'squall-seed-mercenary',
    name: 'Squall, SeeD Mercenary',
    costLabel: '2WB',
    type: 'creature',
    subtype: 'Legendary Creature Human Knight Mercenary',
    text: 'Rough Divide — Whenever a creature you control attacks alone, it gains double strike until end of turn. \n' +
      'Whenever Squall deals combat damage to a player, return target permanent card with mana value 3 or less from your graveyard to the battlefield.',
    imagePath: '/assets/cards/squall-seed-mercenary.webp'
  },
  {
    id: 'starting-town',
    name: 'Starting Town',
    costLabel: '-',
    type: 'land',
    text: 'This land enters tapped unless it\u2019s your first, second, or third turn of the game.\n' +
      'Tap: Add M. \n' +
      'Tap, Pay 1 life: Add one mana of any color.',
    imagePath: '/assets/cards/starting-town.webp'
  },
  {
  id: 'stiltzkin-moogle-merchant',
  name: 'Stiltzkin, Moogle Merchant',
  costLabel: 'W',
  type: 'creature',
  subtype: 'Legendary Creature Moogle',
  power: 1,
  toughness: 2,
  text: 'Lifelink \n' +
  '2, Tap: Target opponent gains control of another target permanent you control. If they do, you draw a card.',
  imagePath:'/assets/cards/stiltzkin-moogle-merchant.webp'
  },
  {
  id: 'stolen-uniform',
  name: 'Stolen Uniform',
  costLabel: 'U',
  type: 'instant',
  text: 'Choose target creature you control and target Equipment. Gain control of that Equipment until end of turn. ' +
  'Attach it to the chosen creature. When you lose control of that Equipment this turn, if it\u2019s attached to a creature you control, unattach it.',
  imagePath: '/assets/cards/stolen-uniform.webp'
  },
  {
  id: 'stuck-in-summoner-s-sanctum',
  name: 'Stuck in Summoner\u2019s Sanctum',
  costLabel: '2U',
  type: 'enchantment',
  subtype: 'Aura',
  text: 'Flash \n' +
  'Enchant artifact or creature \n' +
  'When this Aura enters, tap enchanted permanent. \n' +
  'Enchanted permanent doesn\u2019t untap during its controller\u2019s untap step and its activated abilities can\u2019t be activated.',
  imagePath:'/assets/cards/stuck-in-summoner-s-sanctum.webp'
  },
  {
  id: 'summon-anima',
  name: 'Summon: Anima',
  costLabel: '4BB',
  type: 'creature',
  subtype: 'Enchantment Creature Saga Horror',
  power: 4,
  toughness: 4,
  text: '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after IV.) \n' +
  'I, II, III — Pain — You draw a card and you lose 1 life. \n' +
  'IV — Oblivion — Each opponent sacrifices a creature of their choice and loses 3 life.\n' +
  'Menace',
  imagePath:'/assets/cards/summon-anima.webp'
  },
  {
  id: 'summon-bahamut',
  name: 'Summon: Bahamut',
  costLabel: '9',
  type: 'creature',
  subtype: 'Enchantment Creature Saga Dragon',
  power: 9,
  toughness: 9,
  text: '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after IV.) \n' +
  'I, II — Destroy up to one target nonland permanent. \n' +
  'III — Draw two cards. \n' +
  'IV — Mega Flare — This creature deals damage equal to the total mana value of other permanents you control to each opponent.' +
  'Flying',
  imagePath:'/assets/cards/summon-bahamut.webp'
  },
  {
  id: 'summon-brynhildr',
  name: 'Summon: Brynhildr',
  costLabel: '1R',
  type: 'creature',
  subtype: 'Enchantment Creature Saga Knight',
  power: 2,
  toughness: 1,
  text: '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.) \n' +
  'I — Chain — Exile the top card of your library. During any turn you put a lore counter on this Saga, you may play that card. \n' +
  'II, III — Gestalt Mode — When you next cast a creature spell this turn, it gains haste until end of turn.',
  imagePath:'/assets/cards/summon-brynhildr.webp'
  },
  {
  id: 'summon-choco-mog',
  name: 'Summon: Choco/Mog',
  costLabel: '2W',
  type: 'creature',
  subtype: 'Enchantment Creature Saga Bird Moogle',
  power: 3,
  toughness: 3,
  text: '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after IV.) \n' +
  'I, II, III, IV — Stampede! — Other creatures you control get +1/+0 until end of turn.',
  imagePath:'/assets/cards/summon-choco-mog.webp'
  },
  {
  id: 'summoner-s-grimoire',
  name: 'Summoner\u2019s Grimoire',
  costLabel: '3G',
  type: 'artifact',
  subtype: 'Artifact Equipment',
  text: 'Job select \n' +
  'Equipped creature is a Shaman in addition to its other types and has “Whenever this creature attacks, ' +
  'you may put a creature card from your hand onto the battlefield. If that card is an enchantment card, it enters tapped and attacking.”' +
  'Abraxas — Equip 3',
  imagePath:'/assets/cards/summoner-s-grimoire.webp'
  },
  {
  id: 'summon-esper-ramuh',
  name: 'Summon: Esper Ramuh',
  costLabel: '2RR',
  type: 'creature',
  subtype: 'Enhancement Creature Saga Wizard',
  power: 3,
  toughness: 3,
  text: '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.) \n' +
  'I — Judgment Bolt — This creature deals damage equal to the number of noncreature, nonland cards in your graveyard to target creature an opponent controls.\n' +
  'II, III — Wizards you control get +1/+0 until end of turn.',
  imagePath:'/assets/cards/summon-esper-ramuh.webp'
  },
  {
  id: '',
  name: 'Summon: Fat Chocobo',
  costLabel: '4G',
  type: 'creature',
  subtype: 'Enchantment Creature Saga Bird',
  power: 4,
  toughness: 4,
  text: '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after IV.) \n' +
  'I — Wark — Create a 2/2 green Bird creature token with “Whenever a land you control enters, this token gets +1/+0 until end of turn.”\n' +
  'II, III, IV — Kerplunk — Creatures you control gain trample until end of turn.',
  imagePath:'/assets/cards/summon-fat-chocobo.webp'
  },
  {
  id: 'summon-fenrir',
  name: 'Summon: Fenrir',
  costLabel: '2G',
  type: 'creature',
  subtype: 'Enchanment Creature Saga Wolf',
  power: 3,
  toughness: 2,
  text: 'I — Crescent Fang — Search your library for a basic land card, put it onto the battlefield tapped, then shuffle. \n' +
  'II — Heavenward Howl — When you next cast a creature spell this turn, that creature enters with an additional +1/+1 counter on it. \n' +
  'III — Ecliptic Growl — Draw a card if you control the creature with the greatest power or tied for the greatest power.',
  imagePath:'/assets/cards/summon-fenrir.webp'
  },
  {
  id: 'summon-g-f-cerberus',
  name: 'Summon: G.F. Cerberus',
  costLabel: '2RR',
  type: 'creature',
  subtype: 'Enchantment Creature Saga Dog',
  power: 3,
  toughness: 3,
  text: '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.) \n' +
  'I — Surveil 1. (Look at the top card of your library. You may put it into your graveyard.) \n' +
  'II — Double — When you next cast an instant or sorcery spell this turn, copy it. You may choose new targets for the copy. \n' +
  'III — Triple — When you next cast an instant or sorcery spell this turn, copy it twice. You may choose new targets for the copies.',
  imagePath:'/assets/cards/summon-g-f-cerberus.webp'
  },
  {
  id: 'summon-g-f-ifrit',
  name: 'Summon: G.F. Ifrit',
  costLabel: '2R',
  type: 'creature',
  subtype: 'Enchantment Creature Saga Demon',
  power: 3,
  toughness: 2,
  text: '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after IV.) \n' +
  'I, II — You may discard a card. If you do, draw a card. \n' +
  'III, IV — Add R.',
  imagePath:'/assets/cards/summon-g-f-ifrit.webp'
  },
  {
  id: 'summon-knights-of-round',
  name: 'Summon: Knights of Round',
  costLabel: '6WW',
  type: 'creature',
  subtype: 'Enchantment Creature Saga Knight',
  power: 3,
  toughness: 3,
  text: '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after V.) \n' +
  'I, II, III, IV — Create three 2/2 white Knight creature tokens. \n' +
  'V — Ultimate End — Other creatures you control get +2/+2 until end of turn. Put an indestructible counter on each of them.\n' +
  'Indestructible',
  imagePath:'/assets/cards/summon-knights-of-round.webp'
  },
  {
  id: 'summon-leviathan',
  name: 'Summon: Leviathan',
  costLabel: '4UU',
  type: 'creature',
  subtype: 'Enchantment Creature Saga Leviathan',
  power: 6,
  toughness: 6,
  text: '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.) \n' +
  'I — Return each creature that isn’t a Kraken, Leviathan, Merfolk, Octopus, or Serpent to its owner\u2019s hand. \n' +
  'II, III — Until end of turn, whenever a Kraken, Leviathan, Merfolk, Octopus, or Serpent attacks, draw a card. \n' +
  'Ward 2',
  imagePath:'/assets/cards/summon-leviathan.webp'
  },
  {
  id: 'summon-primal-garuda',
  name: 'Summon: Primal Garuda',
  costLabel: '3W',
  type: 'creature',
  subtype: 'Enchantment Creature Saga Harpy',
  power: 3,
  toughness: 3,
  text: '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.) \n' +
  'I — Aerial Blast — This creature deals 4 damage to target tapped creature an opponent controls. \n' +
  'II, III — Slipstream — Another target creature you control gets +1/+0 and gains flying until end of turn. \n' +
  'Flying',
  imagePath:'/assets/cards/summon-primal-garuda.webp'
  },
  {
  id: 'summon-primal-odin',
  name: 'Summon: Primal Odin',
  costLabel: '4BB',
  type: 'creature',
  subtype: 'Enchantment Creature Saga Knight',
  power: 5,
  toughness: 3,
  text: '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.)\n' +
  'I — Gungnir — Destroy target creature an opponent controls. \n' +
  'II — Zantetsuken — This creature gains “Whenever this creature deals combat damage to a player, that player loses the game.” \n' +
  'III — Hall of Sorrow — Draw two cards. Each player loses 2 life.',
  imagePath:'/assets/cards/summon-primal-odin.webp'
  },
  {
  id: 'summon-shiva',
  name: 'Summon: Shiva',
  costLabel: '3UU',
  type: 'creature',
  subtype: 'Enchantment Creature Saga Elemental',
  power: 4,
  toughness: 5,
  text: '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.) \n' +
  'I, II — Heavenly Strike — Tap target creature an opponent controls. Put a stun counter on it. ' +
  '(If a permanent with a stun counter would become untapped, remove one from it instead.) \n' +
  'III — Diamond Dust — Draw a card for each tapped creature your opponents control.',
  imagePath:'/assets/cards/summon-shiva.webp'
  },
  {
  id: 'summon-titan',
  name: 'Summon: Titan',
  costLabel: '3GG',
  type: 'creature',
  subtype: 'Enchantment Creature Saga Giant',
  power: 7,
  toughness: 7,
  text: '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.) \n' +
  'I — Mill five cards. \n' +
  'II — Return all land cards from your graveyard to the battlefield tapped. \n' +
  'III — Until end of turn, another target creature you control gains trample and gets +X/+X, where X is the number of lands you control.\n' +
  'Reach, trample',
  imagePath:'/assets/cards/summon-titan.webp'
  },
  {
  id: 'suplex',
  name: 'Suplex',
  costLabel: '1R',
  type: 'sorcery',
  text: 'Choose one — \n' +
  '• Suplex deals 3 damage to target creature. If that creature would die this turn, exile it instead. \n' +
  '• Exile target artifact.',
  imagePath:'/assets/cards/suplex.webp'
  },
  {
  id: 'swallowed-by-leviathan',
  name: 'Swallowed by Leviathan',
  costLabel: '2U',
  type: 'instant',
  text: 'Choose target spell. Surveil 2, then counter the chosen spell unless its controller pays 1 for each card in your graveyard. ' +
  '(To surveil 2, look at the top two cards of your library, then put any number of them into your graveyard and the rest on top of your library in any order.)',
  imagePath:'/assets/cards/swallowed-by-leviathan.webp'
  },
  {
  id: 'swamp',
  name: 'Swamp',
  costLabel: '-',
  type: 'land',
  text: 'Tap add B',
  imagePath:'/assets/cards/swamp.webp'
  },
  {
  id: 'syncopate',
  name: 'Syncopate',
  costLabel: 'XU',
  type: 'instant',
  text: 'Counter target spell unless its controller pays {X}. If that spell is countered this way, exile it instead of putting it into its owner\u2019s graveyard.',
  imagePath: '/assets/cards/syncopate.webp'
  },
  {
  id: 'tellah-great-sage',
  name: 'Tellah, Great Sage',
  costLabel: '3UR',
  type: 'creature',
  subtype: 'Legendary Creature Human Wizard',
  power: 3,
  toughness: 3,
  text: 'Whenever you cast a noncreature spell, create a 1/1 colorless Hero creature token. If four or more mana was spent to cast that spell, ' +
  'draw two cards. If eight or more mana was spent to cast that spell, sacrifice Tellah and it deals that much damage to each opponent.',
  imagePath: '/assets/cards/tellah-great-sage.webp'
  },
  {
  id: 'terra-magical-adept',
  name: 'Terra, Magical Adept',
  costLabel: '1RG',
  type: 'creature',
  subtype: 'Legendary Creature Human Wizard Warrior',
  power: 4,
  toughness: 2,
  text: 'When Terra enters, mill five cards. Put up to one enchantment card milled this way into your hand. \n' +
  'Trance — 4RG, Tap: Exile Terra, then return it to the battlefield transformed under its owner\u2019s control. Activate only as a sorcery.',
  imagePath: '/assets/cards/terra-magical-adept.webp',
  transformsInto: 'Esper Terra'
  },
  {
  id: 'esper-terra',
  name: 'Esper Terra',
  costLabel: '-',
  type: 'creature',
  subtype: 'Legendary Enchantment Creature Saga Wizard',
  text: '(As this Saga enters and after your draw step, add a lore counter.) \n' +
  'I, II, III — Create a token that’s a copy of target nonlegendary enchantment you control. It gains haste. ' +
  'If it\u2019s a Saga, put up to three lore counters on it. Sacrifice it at the beginning of your next end step.\n' +
  'IV — Add {W}{W}, {U}{U}, {B}{B}, {R}{R}, and {G}{G}. Exile Esper Terra, then return it to the battlefield (front face up).\n' +
  'Flying',
  imagePath: '/assets/cards/esper-terra.webp'
  },
   {
  id: 'the-crystal-s-chosen',
  name: 'The Crystal\u2019s Chosen',
  costLabel: '5WW',
  type: 'sorcery',
  text: 'Create four 1/1 colorless Hero creature tokens. Then put a +1/+1 counter on each creature you control.',
  imagePath: '/assets/cards/the-crystal-s-chosen.webp'
  },
  {
  id: 'the-darkness-crystal', 
  name: 'The Darkness Crystal',
  costLabel: '2BB',
  type: 'artifact',
  subtype: 'Legendary Artifact',
  text: 'Black spells you cast cost {1} less to cast. \n' +
  'If a nontoken creature an opponent controls would die, instead exile it and you gain 2 life. \n' +
  '{4}{B}{B}, {T}: Put target creature card exiled with The Darkness Crystal onto the battlefield tapped under your control with two additional +1/+1 counters on it.',
  imagePath: '/assets/cards/the-darkness-crystal.webp'
  },
  {
  id: 'the-earth-crystal',
  name: 'The Earth Crystal',
  costLabel: '2GG',
  type: 'artifact',
  subtype: 'Legendary Artifact',
  text: 'Green spells you cast cost {1} less to cast. \n' +
  'If one or more +1/+1 counters would be put on a creature you control, twice that many +1/+1 counters are put on that creature instead. \n' +
  '{4}{G}{G}, {T}: Distribute two +1/+1 counters among one or two target creatures you control.',
  imagePath: '/assets/cards/the-earth-crystal.webp'
  },
  {
  id: 'the-emperor-of-palamecia',
  name: 'The Emperor of Palamecia',
  costLabel: 'UR',
  type: 'creature',
  subtype: 'Legendary Creature Human Noble Warrior',
  power: 2,
  toughness: 2,
  text: '{T}: Add {U} or {R}. Spend this mana only to cast a noncreature spell. \n' +
  'Whenever you cast a noncreature spell, if at least four mana was spent to cast it, put a +1/+1 counter on The Emperor of Palamecia. ' +
  'Then if it has three or more +1/+1 counters on it, transform it.',
  imagePath: '/assets/cards/the-emperor-of-palamecia.webp',
  transformsInto: 'The Lord Master of Hell'
  },
   {
  id: 'the-lord-master-of-hell',
  name: 'The Lord Master of Hell',
  costLabel: '-',
  type: 'creature',
  subtype: 'Legendary Creature Demon Noble Wizard',
  power: 3,
  toughness: 3,
  text: 'Starfall — Whenever The Lord Master of Hell attacks, it deals X damage to each opponent, where X is the number of noncreature, nonland cards in your graveyard.',
  imagePath: '/assets/cards/the-lord-master-of-hell.webp'
  },
  {
  id: 'the-final-days',
  name: 'The Final Days', 
  costLabel: '2BB',
  type: 'sorcery',
  text: 'Create two tapped 2/2 black Horror creature tokens. If this spell was cast from a graveyard, instead create X of those tokens, ' +
  'where X is the number of creature cards in your graveyard. \nFlashback {4}{B}{B}',
  imagePath: '/assets/cards/the-final-days.webp'
  },
   {
  id: 'the-fire-crystal',
  name: 'The Fire Crystal',
  costLabel: '2RR',
  type: 'artifact',
  subtype: 'Legendary Artifact',
  text: 'Red spells you cast cost {1} less to cast. \n' +
  'Creatures you control have haste. \n' +
  '{4}{R}{R}, {T}: Create a token that\u2019s a copy of target creature you control. Sacrifice it at the beginning of the next end step.',
  imagePath: '/assets/cards/the-fire-crystal.webp'
  },
  {
  id: 'the-gold-saucer',
  name: 'The Gold Saucer',
  costLabel: '-',
  type: 'land',
  text: '{T}: Add {M}. \n' +
  '{2}, {T}: Flip a coin. If you win the flip, create a Treasure token. \n' +
  '{3}, {T}, Sacrifice two artifacts: Draw a card.',
  imagePath: '/assets/cards/the-gold-saucer.webp'
  },
   {
  id: 'the-lunar-whale',
  name: 'The Lunar Whale',
  costLabel: '3U',
  type: 'artifact',
  subtype: 'Legendary Artifact Vehicle',
  text: 'Flying \n' +
  'You may look at the top card of your library any time.\n' +
  'As long as The Lunar Whale attacked this turn, you may play the top card of your library.\n' +
  'Crew 1',
  imagePath: '/assets/cards/the-lunar-whale.webp'
  },
  {
  id: 'the-masamune',
  name: 'The Masamune',
  costLabel: '3',
  type: 'artifact',
  subtype: 'Legendary Artifact Equipment',
  text: 'As long as equipped creature is attacking, it has first strike and must be blocked if able.\n' +
  'Equipped creature has “If a creature dying causes a triggered ability of this creature or an emblem you own to trigger, that ability triggers an additional time.”\n' +
  'Equip {2}',
  imagePath: '/assets/cards/the-masamune.webp'
  },
  {
  id: 'the-prima-vista',
  name: 'The Prima Vista',
  costLabel: '4U',
  type: 'artifact',
  subtype: 'Legendary Artifact Vehicle',
  power: 5,
  toughness: 3,
  text: 'Flying \n' +
  'Whenever you cast a noncreature spell, if at least four mana was spent to cast it, The Prima Vista becomes an artifact creature until end of turn.\n' +
  'Crew 2 (Tap any number of creatures you control with total power 2 or more: This Vehicle becomes an artifact creature until end of turn.)',
  imagePath: '/assets/cards/the-prima-vista.webp'
  },
  {
  id: 'the-regalia',
  name: 'The Regalia',
  costLabel: '4',
  type: 'artifact',
  subtype: 'Legendary Artifact — Vehicle',
  power: 4,
  toughness: 4,
  text: 'Haste \n' +
  'Whenever The Regalia attacks, reveal cards from the top of your library until you reveal a land card. ' +
  'Put that card onto the battlefield tapped and the rest on the bottom of your library in a random order. \n' +
  'Crew 1',
  imagePath: '/assets/cards/the-regalia.webp'
  },
  {
  id: 'the-wandering-minstrel',
  name: 'The Wandering Minstrel',
  costLabel: 'GU',
  type: 'creature',
  subtype: 'Legendary Creature Human Bird',
  power: 1,
  toughness: 3,
  text: 'Lands you control enter untapped. \n' +
  'The Minstrel\u2019s Ballad — At the beginning of combat on your turn, if you control five or more Towns, create a 2/2 Elemental creature token thats all colors. \n' +
  '{3}{W}{U}{B}{R}{G}: Other creatures you control get +X/+X until end of turn, where X is the number of Towns you control.',
  imagePath: '/assets/cards/the-wandering-minstrel.webp'
  },
  {
  id: 'the-water-crystal',
  name: 'The Water Crystal',
  costLabel: '2UU',
  type: 'artifact',
  subtype: 'Legendary Artifact',
  text: 'Blue spells you cast cost {1} less to cast. \n' +
  'If an opponent would mill one or more cards, they mill that many cards plus four instead. \n' +
  '{4}{U}{U}, {T}: Each opponent mills cards equal to the number of cards in your hand.',
  imagePath: '/assets/cards/the-water-crystal.webp'
  },
  {
  id: 'the-wind-crystal',
  name: 'The Wind Crystal',
  costLabel: '2WW',
  type: 'artifact',
  subtype: 'Legendary Artifact',
  text: 'White spells you cast cost {1} less to cast. \n' +
  'If you would gain life, you gain twice that much life instead. \n' +
  '{4}{W}{W}, {T}: Creatures you control gain flying and lifelink until end of turn.',
  imagePath: '/assets/cards/the-wind-crystal.webp'
  },
  {
  id: 'thief-s-knife',
  name: 'Thief\u2019s Knife',
  costLabel: '2U',
  type: 'artifact',
  subtype: 'Equipment',
  text: 'Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.)\n' +
  'Equipped creature gets +1/+1, has “Whenever this creature deals combat damage to a player, draw a card,” and is a Rogue in addition to its other types.\n' +
  'Equip {4}',
  imagePath: '/assets/cards/thief-s-knife.webp'
  },
  {
  id: 'thunder-magic', 
  name: 'Thunder Magic',
  costLabel: 'F',
  type: 'instant',
  text: 'Tiered (Choose one additional cost.) \n' +
  '• Thunder — {0} — Thunder Magic deals 2 damage to target creature. \n' +
  '• Thundara — {3} — Thunder Magic deals 4 damage to target creature. \n' +
  '• Thundaga — {5}{R} — Thunder Magic deals 8 damage to target creature.',
  imagePath: '/assets/cards/thunder-magic.webp'
  },
  {
  id: 'tidus-blitzball-star',
  name: 'Tidus, Blitzball Star',
  costLabel: '1WU',
  type: 'creature',
  subtype: 'Legendary Creature Human Warrior',
  text: 'Whenever an artifact you control enters, put a +1/+1 counter on Tidus. \n' +
  'Whenever Tidus attacks, tap target creature an opponent controls.',
  imagePath: '/assets/cards/tidus-blitzball-star.webp'
  },
  {
  id: 'tifa-lockhart',
  name: 'Tifa Lockhart',
  costLabel: '1G',
  type: 'creature',
  text: 'Trample \n' +
  'Landfall — Whenever a land you control enters, double Tifa Lockhart\u2019s power until end of turn.',
  imagePath: '/assets/cards/tifa-lockhart.webp'
  },
  {
  id: 'tifa-s-limit-break',
  name: 'Tifa\u2019s Limit Break',
  costLabel: 'G',
  type: 'instant',
  text: 'Tiered (Choose one additional cost.) \n' +
  '• Somersault — {0} — Target creature gets +2/+2 until end of turn. \n' +
  '• Meteor Strikes — {2} — Double target creature’s power and toughness until end of turn. \n' +
  '• Final Heaven — {6}{G} — Triple target creature’s power and toughness until end of turn.',
  imagePath: '/assets/cards/tifa-s-limit-break.webp'
  },
  {
  id: 'tonberry',
  name: 'Tonberry',
  costLabel: 'B',
  type: 'creature',
  subtype: 'Creature Salamander Horror',
  text: 'This creature enters tapped with a stun counter on it. (If it would become untapped, remove a stun counter from it instead.) \n' +
  'Chef\u2019s Knife — During your turn, this creature has first strike and deathtouch.',
  imagePath: '/assets/cards/tonberry.webp'
  },
  {
  id: 'torgal-a-fine-hound',
  name: 'Torgal, A Fine Hound',
  costLabel: '1G',
  type: 'creature',
  subtype: 'Legendary Creature Wolf',
  power: 2,
  toughness: 2,
  text: 'Whenever you cast your first Human creature spell each turn, that creature enters with an additional +1/+1 counter on it for each Dog and/or Wolf you control. \n' +
  '{T}: Add one mana of any color.',
  imagePath: '/assets/cards/torgal-a-fine-hound.webp'
  },
  {
  id: 'town-greeter',
  name: 'Town Greeter',
  costLabel: '1G',
  type: 'creature',
  subtype: 'Creature Human Citizen',
  power: 1,
  toughness: 1,
  text: 'When this creature enters, mill four cards. You may put a land card from among them into your hand. If you put a Town card into your hand this way, you gain 2 life',
  imagePath: '/assets/cards/town-greeter.webp'
  },
  {
  id: 'traveling-chocobo',
  name: 'Traveling Chocobo',
  costLabel: '2G',
  type: 'creature',
  subtype: 'Bird Creature',
  power: 3,
  toughness: 2,
  text: 'You may look at the top card of your library any time. \n' +
  'You may play lands and cast Bird spells from the top of your library. \n' +
  'If a land or Bird you control entering the battlefield causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time.',
  imagePath: '/assets/cards/traveling-chocobo.webp'
  },
  {
  id: 'travel-the-overworld',
  name: 'Travel the Overworld',
  costLabel: '5UU',
  type: 'sorcery',
  text: 'Affinity for Towns (This spell costs {1} less to cast for each Town you control.) \n' +
  'Draw four cards.',
  imagePath: '/assets/cards/travel-the-overworld.webp'
  },
  {
  id: 'treno-dark-city',
  name: 'Treno, Dark City',
  costLabel: '-',
  type: 'land',
  text:'This land enters tapped. \n' +
  '{T}: Add {U} or {B}.',
  imagePath: '/assets/cards/treno-dark-city.webp'
  },
  {
  id: 'triple-triad',
  name: 'Triple Triad',
  costLabel: '3RRR',
  type: 'enchantment',
  text: 'At the beginning of your upkeep, each player exiles the top card of their library. Until end of turn, \n' +
  'you may play the card you own exiled this way and each other card exiled this way with lesser mana value than it without paying their mana costs.',
  imagePath: '/assets/cards/triple-triad.webp'
  },
  {
    id: 'ultima',
    name: 'Ultima',
    type: 'sorcery',
    costLabel: '3WW',
    text: 'Destroy all artifacts and creatures. End the turn. (Exile all spells and abilities from the stack, including this card. The player whose turn it is discards down to their maximum hand size. Damage wears off, and “this turn” and “until end of turn” effects end.) “Such devastation … this was not my intention!” —Gaius van Baelsar',
    imagePath: '/assets/cards/ultima.webp',
  },
  {
  id: 'ultima-origin-of-oblivion',
  name: 'Ultima, Origin of Oblivion',
  costLabel: '5',
  type: 'creature',
  subtype:'Legendary Creature God',
  power: 4,
  toughness: 4,
  text: 'Flying \n' +
  'Whenever Ultima attacks, put a blight counter on target land. For as long as that land has a blight counter on it, ' +
  'it loses all land types and abilities and has “{T}: Add {M}.”\n' +
  'Whenever you tap a land for {M}, add an additional {M}.',
  imagePath: '/assets/cards/ultima-origin-of-oblivion.webp'
  },
  {
  id: 'ultima-weapon',
  name: 'Ultima Weapon',
  costLabel: '7',
  type: 'artifact',
  subtype: 'Legendary Artifact Equipment',
  text: 'Whenever equipped creature attacks, destroy target creature an opponent controls. \n' +
  'Equipped creature gets +7/+7.\n' +
  'Equip {7}',
  imagePath: '/assets/cards/ultima-weapon.webp'
  },
  {
  id: 'ultimecia-temporal-threat',
  name: 'Ultimecia, Temporal Threat',
  costLabel: '4UU',
  type: 'creature',
  subtype: 'Legendary Creature Human Warlock',
  power: 4,
  toughness: 4,
  text: 'When Ultimecia enters, tap all creatures your opponents control. \n' +
  'Whenever a creature you control deals combat damage to a player, draw a card.',
  imagePath: '/assets/cards/ultimecia-temporal-threat.webp'
  },
  {
  id: 'ultimecia-time-sorceress',
  name: 'Ultimecia, Time Sorceress',
  costLabel: '3UB',
  type: 'creature',
  subtype: 'Legendary Creature Human Warlock',
  power: 4,
  toughness: 5,
  text: 'Whenever Ultimecia enters or attacks, surveil 2. (Look at the top two cards of your library, ' +
  'then put any number of them into your graveyard and the rest on top of your library in any order.) \n' +
  'At the beginning of your end step, you may pay {4}{U}{U}{B}{B} and exile eight cards from your graveyard. If you do, transform Ultimecia.',
  imagePath: '/assets/cards/ultimecia-time-sorceress.webp',
  transformsInto: 'Ultimecia, Omnipotent',
  },
  {
  id: 'ultimecia-omnipotent',
  name: 'Ultimecia, Omnipotent',
  costLabel: '-',
  type: 'creature',
  subtype: 'Legendary Creature Nightmare Warlock',
  power: 7,
  toughness: 7,
  text: 'Menace (This creature can’t be blocked except by two or more creatures.) \n' +
  'Time Compression — When this creature transforms into Ultimecia, Omnipotent, take an extra turn after this one.',
  imagePath: '/assets/cards/ultimecia-omnipotent.webp'
  },
  {
  id: 'ultros-obnoxious-octopus',
  name: 'Ultros, Obnoxious Octopus',
  costLabel: '1U',
  type: 'creature',
  subtype: 'Legendary Creature Octopus',
  text: 'Whenever you cast a noncreature spell, if at least four mana was spent to cast it, tap target creature an opponent controls ' +
  'and put a stun counter on it. (If a permanent with a stun counter would become untapped, remove one from it instead.)\n' +
  'Whenever you cast a noncreature spell, if at least eight mana was spent to cast it, put eight +1/+1 counters on Ultros.',
  imagePath: '/assets/cards/ultros-obnoxious-octopus.webp'
  },
  {
  id: 'undercity-dire-rat',
  name: 'Undercity Dire Rat',
  costLabel: '1B',
  type: 'creature',
  subtype: 'Creature Rat',
  power: 2,
  toughness: 2,
  text: 'Rat Tail — When this creature dies, create a Treasure token. (It’s an artifact with “{T}, Sacrifice this token: Add one mana of any color.”)',
  imagePath: '/assets/cards/undercity-dire-rat.webp'
  },
  {
  id: 'unexpected-request',
  name: 'Unexpected Request',
  costLabel: '2R',
  type: 'sorcery',
  text: 'Gain control of target creature until end of turn. Untap that creature. It gains haste until end of turn. ' +
  'You may attach an Equipment you control to that creature. If you do, unattach it at the beginning of the next end step.',
  imagePath: '/assets/cards/unexpected-request.webp'
  },
  {
  id: 'vaan-street-thief',
  name: 'Vaan, Street Thief',
  costLabel: '2R',
  type: 'creature',
  subtype: 'Legendary Creature Human Scout',
  power: 2,
  toughness: 2,
  text: 'Whenever one or more Scouts, Pirates, and/or Rogues you control deal combat damage to a player, ' +
  'exile the top card of that player\u2019s library. You may cast it. If you don\u2019t, create a Treasure token. \n' +
  'Whenever you cast a spell you don\u2019t own, put a +1/+1 counter on each Scout, Pirate, and Rogue you control.',
  imagePath: '/assets/cards/vaan-street-thief.webp'
  },
  {
  id: 'valkyrie-aerial-unit',
  name: 'Valkyrie Aerial Unit',
  costLabel: '5UU',
  type: 'creature',
  subtype: 'Artifact Creature Construct',
  power: 5,
  toughness: 4,
  text: 'Affinity for artifacts (This spell costs {1} less to cast for each artifact you control.) \n' +
  'Flying \n' +
  'When this creature enters, surveil 2.',
  imagePath: '/assets/cards/valkyrie-aerial-unit.webp'
  },
  {
  id: 'vanille-cheerful-l-cie',
  name: 'Vanille, Cheerful l\u2019Cie',
  costLabel: '3G',
  type: 'creature',
  subtype: 'Legendary Creature Human Cleric',
  power: 3,
  toughness: 2,
  text: 'When Vanille enters, mill two cards, then return a permanent card from your graveyard to your hand. \n' +
  'At the beginning of your first main phase, if you both own and control Vanille and a creature named Fang, ' +
  'Fearless l\u2019Cie, you may pay {3}{B}{G}. If you do, exile them, then meld them into Ragnarok, Divine Deliverance.',
  imagePath: '/assets/cards/vanille-cheerful-l-cie.webp',
  transformsInto: 'Ragnarok Divine Deliverance'
  },
  {
  id: 'vayne-s-treachery',
  name: 'Vayne\u2019s Treachery',
  costLabel: '1B',
  type: 'instant',
  text: 'Kicker—Sacrifice an artifact or creature. (You may sacrifice an artifact or creature in addition to any other costs as you cast this spell.) \n' +
  'Target creature gets -2/-2 until end of turn. If this spell was kicked, that creature gets -6/-6 until end of turn instead.',
  imagePath: '/assets/cards/vayne-s-treachery.webp'
  },
  {
  id: 'vector-imperial-capital',
  name: 'Vector, Imperial Capital',
  costLabel: '-',
  type: 'land',
  text: 'This land enters tapped. \n' +
  '{T}: Add {B} or {R}.',
  imagePath: '/assets/cards/vector-imperial-capital.webp'
  },
  {
  id: 'venat-heart-of-hydaelyn',
  name: 'Venat, Heart of Hydaelyn',
  costLabel: '1WW',
  type: 'creature',
  subtype: 'Legendary Creature Elder Wizard',
  power: 3,
  toughness: 3,
  text: 'Whenever you cast a legendary spell, draw a card. This ability triggers only once each turn. \n' +
  'Hero’s Sundering — {7}, {T}: Exile target nonland permanent. Transform Venat. Activate only as a sorcery.',
  imagePath: '/assets/cards/venat-heart-of-hydaelyn.webp',
  transformsInto: 'Hydaelyn, the Mothercrystal',
  },
  {
  id: 'hydaelyn-the-mothercrystal',
  name: 'Hydaelyn, the Mothercrystal',
  costLabel: '-',
  type: 'creature',
  subtype: 'Legendary Creature God',
  power: 4,
  toughness: 4,
  text: 'Indestructible \n' +
  'Blessing of Light — At the beginning of combat on your turn, put a +1/+1 counter on another target creature you control. \n' +
  'Until your next turn, it gains indestructible. If that creature is legendary, draw a card.',
  imagePath: '/assets/cards/hydaelyn-the-mothercrystal.webp'
  },
  {
  id: 'vincent-s-limit-break',
  name: 'Vincent\u2019s Limit Break',
  costLabel: '1B',
  type: 'instant',
  text: 'Tiered (Choose one additional cost.) \n ' +
  'Until end of turn, target creature you control gains “When this creature dies, ' +
  'return it to the battlefield tapped under its owner’s control” and has the chosen base power and toughness.\n' +
  '• Galian Beast — {0} — 3/2. \n' +
  '• Death Gigas — {1} — 5/2. \n' +
  '• Hellmasker — {3} — 7/2.',
  imagePath: '/assets/cards/vincent-s-limit-break.webp'
  },
  {
  id: 'vincent-valentine',
  name: 'Vincent Valentine',
  costLabel: '2BB',
  type: 'creature',
  subtype: 'Legendary Creature Assassin',
  power: 2,
  toughness: 2,
  text: 'Whenever a creature an opponent controls dies, put a number of +1/+1 counters on Vincent Valentine equal to that creature\u2019s power.\n' +
  'Whenever Vincent Valentine attacks, you may transform it.',
  imagePath: '/assets/cards/vincent-valentine.webp',
  transformsInto: 'Galian Beast'
  },
  {
  id: 'galian-beast',
  name: 'Galian Beast',
  costLabel: '-',
  power: 3,
  toughness:2,
  type: 'creature',
  subtype: 'Legendary Creature Werewolf Beast',
  text: 'Trample, lifelink \n' +
  'When Galian Beast dies, return it to the battlefield tapped (front face up).',
  imagePath: '/assets/cards/galian-beast.webp'
  },
  {
  id: 'vivi-ornitier',
  name: 'Vivi Ornitier',
  costLabel: '1UR',
  type: 'creature',
  subtype: 'Legendary Creature Wizard',
  power: 0,
  toughness: 3,
  text: '{0}: Add X mana in any combination of {U} and/or {R}, where X is Vivi Ornitier\u2019s power. Activate only during your turn and only once each turn. \n' +
  'Whenever you cast a noncreature spell, put a +1/+1 counter on Vivi Ornitier and it deals 1 damage to each opponent',
  imagePath: '/assets/cards/vivi-ornitier.webp'
  },
  {
  id: 'warrior-s-sword',
  name: 'Warrior\u2019s Sword',
  costLabel: '3R',
  type: 'artifact',
  subtype: 'Equipment',
  text: 'Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.) \n' +
  'Equipped creature gets +3/+2 and is a Warrior in addition to its other types. \n' +
  'Equip {5} ({5}: Attach to target creature you control. Equip only as a sorcery.)',
  imagePath: '/assets/cards/warrior-s-sword.webp'
  },
  {
  id: 'wastes',
  name: 'Wastes',
  costLabel: '-',
  type: 'land',
  text: 'Tap Add M',
  imagePath: '/assets/cards/wastes.webp'
  },
  {
  id: 'weapons-vendor',
  name: 'Weapons Vendor',
  costLabel: '3W',
  type: 'creature',
  subtype: 'Creature Human Artificer',
  power: 2,
  toughness: 2,
  text: 'When this creature enters, draw a card. \n' +
  'At the beginning of combat on your turn, if you control an Equipment, you may pay {1}. ' +
  'When you do, attach target Equipment you control to target creature you control.',
  imagePath: '/assets/cards/weapons-vendor.webp'
  },
  {
  id: 'white-auracite',
  name: 'White Auracite',
  costLabel: '2WW',
  type: 'artifact',
  text: 'When this artifact enters, exile target nonland permanent an opponent controls until this artifact leaves the battlefield. \n' +
  '{T}: Add {W}.',
  imagePath: '/assets/cards/white-auracite.webp'
  },
  {
  id: 'white-mage-s-staff',
  name: 'White Mage\u2019s Staff',
  costLabel: '1W',
  type: 'artifact',
  subtype: 'Equipment',
  text: 'Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.) \n ' +
  'Equipped creature gets +1/+1, has “Whenever this creature attacks, you gain 1 life,” and is a Cleric in addition to its other types.\n' +
  'Equip {3} ({3}: Attach to target creature you control. Equip only as a sorcery.)',
  imagePath: '/assets/cards/white-mage-s-staff.webp'
  },
  {
  id: 'windurst-federation-center',
  name: 'Windurst, Federation Center',
  costLabel: '-',
  type: 'land',
  subtype: 'Town',
  text: 'This land enters tapped. \n{T}: Add {G} or {W}.',
  imagePath: '/assets/cards/windurst-federation-center.webp'
  },
  {
  id: 'world-map',
  name: 'World Map',
  costLabel: '1',
  type: 'artifact',
  text: '{1}, {T}, Sacrifice this artifact: Search your library for a basic land card, reveal it, put it into your hand, then shuffle. \n' +
  '{3}, {T}, Sacrifice this artifact: Search your library for a land card, reveal it, put it into your hand, then shuffle.',
  imagePath: '/assets/cards/world-map.webp'
  },
  {
  id: 'xande-dark-mage',
  name: 'Xande, Dark Mage',
  costLabel: '2UB',
  type: 'creature',
  subtype: 'Legendary Creature Human Wizard',
  power: 3,
  toughness: 3,
  text: 'Menace (This creature can’t be blocked except by two or more creatures.) \n' +
  'Xande gets +1/+1 for each noncreature, nonland card in your graveyard.',
  imagePath: '/assets/cards/xande-dark-mage.webp'
  },
  {
  id: 'you-re-not-alone',
  name: 'You\u2019re Not Alone',
  costLabel: 'W',
  type: 'instant',
  text: 'Target creature gets +2/+2 until end of turn. If you control three or more creatures, it gets +4/+4 until end of turn instead.',
  imagePath: '/assets/cards/you-re-not-alone.webp'
  },
  {
  id: 'y-shtola-rhul',
  name: 'Y\u2019shtola Rhul',
  costLabel: '4UU',
  type: 'creature',
  subtype: 'Legendary Creature Cat Druid',
  text: 'At the beginning of your end step, exile target creature you control, then return it to the battlefield under ' +
  'its owner\u2019s control. Then if it\u2019s the first end step of the turn, there is an additional end step after this step.',
  imagePath: '/assets/cards/y-shtola-rhul.webp'
  },
  {
  id: 'yuna-hope-of-spira',
  name: 'Yuna, Hope of Spira',
  costLabel: '3GW',
  type: 'creature',
  subtype: 'Legendary Creature Human Cleric',
  power: 3,
  toughness: 5,
  text: 'During your turn, Yuna and enchantment creatures you control have trample, lifelink, and ward {2}.\n' +
  'At the beginning of your end step, return up to one target enchantment card from your graveyard to the battlefield with a finality counter on it.',
  imagePath: '/assets/cards/yuna-hope-of-spira.webp'
  },
  {
  id: 'zack-fair',
  name: 'Zack Fair',
  costLabel: 'W',
  type: 'creature',
  subtype: 'Legendary Creature Human Soldier',
  power: 0,
  toughness: 1,
  text: 'Zack Fair enters with a +1/+1 counter on it. \n' +
  '{1}, Sacrifice Zack Fair: Target creature you control gains indestructible until end of turn. Put Zack Fair\u2019s ' +
  'counters on that creature and attach an Equipment that was attached to Zack Fair to that creature.',
  imagePath: '/assets/cards/zack-fair.webp'
  },
  {
  id: 'zanarkand-ancient-metropolis',
  name: 'Zanarkand, Ancient Metropolis',
  costLabel: '-',
  type: 'land',
  text: 'This land enters tapped. \n ' +
  '{T}: Add {G}. \n' +
  'A city dead for a thousand years. The end of Yuna\u2019s journey.\n' +
  'Lasting Fayth {4}{G}{G} \n' +
  'Sorcery — Adventure \n' +
  'Create a 1/1 colorless Hero creature token. Put a +1/+1 counter on it for each land you control. (Then exile this card. You may play the land later from exile.)',
  imagePath: '/assets/cards/zanarkand-ancient-metropolis.webp'
  },
  {
  id: 'zell-dincht',
  name: 'Zell Dincht',
  costLabel: '2R',
  type: 'creature',
  subtype: 'Legendary Creature Human Monk',
  text: 'You may play an additional land on each of your turns. \n' +
  'Zell Dincht gets +1/+0 for each land you control. \n' +
  'At the beginning of your end step, return a land you control to its owner\u2019s hand.',
  imagePath: '/assets/cards/zell-dincht.webp'
  },
  {
  id: 'zenos-yae-galvus',
  name: 'Zenos yae Galvus',
  costLabel: '3BB',
  type: 'creature',
  subtype: 'Legendary Creature Human Noble Soldier Warrior',
  text: 'My First Friend — When Zenos yae Galvus enters, choose a creature an opponent controls. Until end of turn, '+
  'creatures other than Zenos yae Galvus and the chosen creature get -2/-2. \n' +
  'When the chosen creature leaves the battlefield, transform Zenos yae Galvus.',
  imagePath: '/assets/cards/zenos-yae-galvus.webp',
  transformsInto:'Shinryu, Transcendent Rival'
  },
  {
  id: 'shinryu-transcendent-rival',
  name: 'Shinryu, Transcendent Rival',
  costLabel: '-',
  type: 'creature',
  subtype:'Legendary Creature Dragon',
  text: 'Flying \n' +
  'As this creature transforms into Shinryu, choose an opponent. \n' +
  'Burning Chains — When the chosen player loses the game, you win the game.',
  imagePath: '/assets/cards/shinryu-transcendent-rival.webp'
  },
  {
  id: 'zidane-tantalus-thief',
  name: 'Zidane, Tantalus Thief',
  costLabel: '3RW',
  type: 'creature',
  subtype: 'Legendary Creature Human Mutant Scout',
  power: 3,
  toughness: 3,
  text: 'When Zidane enters, gain control of target creature an opponent controls until end of turn. Untap it. It gains lifelink and haste until end of turn. \n' +
  'Whenever an opponent gains control of a permanent from you, you create a Treasure token.',
  imagePath: '/assets/cards/zidane-tantalus-thief.webp'
  },
 {
  id: 'zodiark-umbral-god',
  name: 'Zodiark, Umbral God',
  costLabel: 'BBBBB',
  type: 'creature',
  subtype: 'Legendary Creature God',
  power: 5,
  toughness: 5,
  text: 'Indestructible \n' +
  'When Zodiark enters, each player sacrifices half the non-God creatures they control of their choice, rounded down. \n' +
  'Whenever a player sacrifices another creature, put a +1/+1 counter on Zodiark.',
  imagePath: '/assets/cards/zodiark-umbral-god.webp'
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
