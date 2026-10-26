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
  { id: 'a-realm-reborn',
    name: 'A Realm Reborn',
    type: 'enchantment',
    costLabel: '{4}{G}{G}',
    text: 'Other permanents you control have Tap Add one mana of any color',
    imagePath: '/assets/cards/a-realm-reborn.webp',
    grantsManaAbilityToOthers: 'any',
  },
  {
    id: 'absolute-virtue',
    name: 'Absolute Virtue',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Avatar Warrior',
    costLabel: '{6}{W}{U}',
    power: 8,
    toughness: 8,
    text: "This spell can\u2019t be countered. Flying, You have protection from each of your opponents. (You can\u2019t be dealt damage, enchanted, or targeted by anything controlled by your opponents.)",
    imagePath: '/assets/cards/absolute-virtue.webp',
    // "Can't be countered" is moot - this engine has no counterspell/stack
    // system at all. "Protection from each of your opponents" is deferred -
    // protection is an established gap (no such mechanic exists).
  },
  {
    id: "adventurer's-airship",
    name: 'Adventurers Airship',
    type: 'artifact',
    costLabel: '{3}',
    // Was missing its `crew` field entirely, so it could never actually be
    // crewed. The optional "may draw, then discard" attack trigger is
    // deferred (this engine's LootEffect draw is always mandatory).
    text: 'Flying. Whenever Adventurer\u2019s Airship attacks, you may draw a card, then discard a card. Crew 2 (Tap any number of creatures you control with total power 2 or more: This Vehicle becomes an artifact creature until end of turn.)',
    crew: 2,
    imagePath: '/assets/cards/adventurers-airship.webp',
  },
  {
    id: "adventurer's-inn",
    name: 'Adventurers Inn',
    type: 'land',
    costLabel: '-',
    text: 'When this land enters the battlefield, you gain 2 life. Tap: add one colourless mana',
    imagePath: '/assets/cards/adventurers-inn.webp',
    producesMana: 'C',
    onEnter: [{ type: 'gainLife', amount: 2 }],
  },
  {
    id: 'adelbert-steiner',
    name: 'Adelbert Steiner',
    type: 'creature',
    subtype: 'Legendary Creature Human Knight',
    costLabel: '{1}{W}',
    power: 3,
    toughness: 4,
    text: 'Vigilance. A knight\u2019s duty does not end at the front line.',
    imagePath: '/assets/cards/adelbert-steiner.webp',
  },
  {
    id:'adeline-resplendent-cathar',
    name:'Hero of Light',
    type:'creature',
    subtype:'Legendary Creature — Human Knight',
    costLabel:'{1}{W}{W}',
    power: 0,
    toughness: 4,
    text:'Vigilance\n'+
    'Hero of Light\u2019s power is equal to the number of creatures you control.\n'+
    'Whenever you attack, for each opponent, create a 1/1 white Human creature token that\u2019s tapped and attacking that player or a planeswalker they control.',
    basePowerEqualsControlledCreatureCount: true,
    onAttack: [{ type: 'createToken', tokenId: 'token-human', tapped: true, entersAttacking: true }],
    imagePath:'/assets/cards/adeline-resplendent-cathar.webp'
  },
  {
    id: 'aerith-last-ancient',
    name: 'Aerith Last Ancient',
    type: 'creature',
    subtype: 'Legendary Creature — Human Cleric Druid',
    costLabel: '{2}{G}{W}',
    power: 3,
    toughness: 5,
    text: 'Lifelink\n' +
      'Raise — At the beginning of your end step, if you gained life this turn, return target creature card from your graveyard to your hand. If you gained 7 or more life this turn, return that card to the battlefield instead.\n' +
      '“Right here, right now, I need to know I did everything I could.”',
    imagePath: '/assets/cards/aerith-last-ancient.webp',
    onOwnEndStep: [{ type: 'returnTargetCreatureFromGraveyardToHandOrBattlefieldIfLifeGainedAtLeast', minLifeGained: 7 }],
  },
  {
    id: 'anger',
    name: 'Anger',
    type: 'creature',
    subtype: 'Creature Incarnation',
    costLabel: '{3}{R}',
    power: 2,
    toughness: 2,
    text: 'Haste\n' +
      'As long as this card is in your graveyard and you control a Mountain, creatures you control have haste.\n' +
      '“Relm’s inside!”\n' +
      '—Strago Magus',
    imagePath: '/assets/cards/anger.webp',
    grantsControlledCreaturesKeywordWhileInGraveyard: { keyword: 'haste', requiresControlledLandName: 'Mountain' },
  },
  {
    id: 'aerith-gainsborough',
    name: 'Aerith Gainsborough',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Cleric',
    costLabel: '{2}{W}',
    power: 2,
    toughness: 2,
    text: 'Lifelink. Whenever you gain life, put a +1/+1 counter on Aerith Gainsborough. When Aerith Gainsborough dies, put X +1/+1 counters on each legendary creature you control where X is the number of +1/+1 counters on Aerith Gainsborough.',
    imagePath: '/assets/cards/aerith-gainsborough.webp',
    onGainLifeTrigger: { counterLabel: '+1/+1', counterAmount: 1 },
    onDeathDistributeCounters: { counterLabel: '+1/+1', targetFilter: 'legendary' },
  },
  {
    id: 'aettir-and-priwen',
    name: 'Aettir and Priwen',
    type: 'artifact',
    subtype: 'Legendary Artifact - Equipment',
    costLabel: '{6}',
    text: "Equipped creatures has base power and toughness X/X, where X is your life total. Equip 5",
    imagePath: '/assets/cards/aettir-and-priwen.webp',
    attachesTo: 'creature',
    equipCost: '{5}',
    setsBasePowerToughnessToControllerLife: true,
  },
  {
    id: 'ahriman',
    name: 'Ahriman',
    type: 'creature',
    subtype: 'Creature Eye Horror',
    costLabel: '{2}{B}',
    power: 2,
    toughness: 2,
    text: 'Flying, deathtouch. 3, Sacrifice another creature or artifact: Draw a card.',
    imagePath: '/assets/cards/ahriman.webp',
    abilities: [
      {
        id: 'ahriman-draw',
        label: 'Sacrifice, Draw',
        cost: { manaLabel: '{3}', sacrificeAnother: 'artifactOrCreature' },
        effects: [{ type: 'loot', drawCount: 1, discardCount: 0 }],
        effectText: 'Sacrifice another creature or artifact: Draw a card.',
      },
    ],
  },
  {
    id: 'airship-crash',
    name: 'Airship Crash',
    type: 'instant',
    costLabel: '{2}{G}',
    text: 'Destroy target artifact, enchantment, or creature with flying. Cycling 2 (2, Discard this card: Draw a card.)',
    onCast: [{ type: 'destroyTarget', targetFilter: 'artifactEnchantmentOrFlyingCreature' }],
    cycling: { cost: '{2}' },
    imagePath: '/assets/cards/airship-crash.webp',
  },
  {
    id: 'al-bhed-salvagers',
    name: 'Al Bhed Salvagers',
    type: 'creature',
    subtype: 'Creature Human Artificer Warrior',
    costLabel: '{2}{B}',
    power: 2,
    toughness: 3,
    text: 'Whenever this creature or another creature or artifact you control dies, target opponent loses 1 life and you gain 1 life.',
    imagePath: '/assets/cards/al-bhed-salvagers.webp',
    onAnyDeathDrain: { opponentLifeLoss: 1, controllerLifeGain: 1 },
  },
  {
    id: 'alisaie-leveilleur',
    name: 'Alisaie Leveilleur',
    type: 'creature',
    subtype: 'Legendary Creature — Elf Wizard',
    costLabel: '{2}{W}',
    power: 3,
    toughness: 2,
    text: 'Partner with Alphinaud Leveilleur (When this creature enters, target player may put Alphinaud Leveilleur into their hand from their library, then shuffle.)\n' +
      'First strike\n' +
      'Dualcast — The second spell you cast each turn costs {2} less to cast.',
    imagePath: '/assets/cards/alisaie-leveilleur.webp',
    onEnter: [{ type: 'mayPutExactNamedCardFromLibraryToHandForTargetPlayer', name: 'Alphinaud Leveilleur' }],
    reducesCastCostForSecondSpellEachTurn: 2,
  },
  {
    id: 'alphinaud-leveilleur',
    name: 'Alphinaud Leveilleur',
    type: 'creature',
    subtype: 'Legendary Creature — Elf Wizard',
    costLabel: '{3}{U}',
    power: 2,
    toughness: 4,
    text: 'Partner with Alisaie Leveilleur (When this creature enters, target player may put Alisaie Leveilleur into their hand from their library, then shuffle.)\n' +
      'Vigilance\n' +
      'Eukrasia — Whenever you cast your second spell each turn, draw a card.',
    imagePath: '/assets/cards/alphinaud-leveilleur.webp',
    onEnter: [{ type: 'mayPutExactNamedCardFromLibraryToHandForTargetPlayer', name: 'Alisaie Leveilleur' }],
    drawCardOnSecondSpellEachTurn: true,
  },
  {
    id: 'altered-ego',
    name: 'Altered Ego',
    type: 'creature',
    subtype: 'creature shapeshifter',
    costLabel: '{2}{X}{G}{U}',
    power: 0,
    toughness: 0,
    // "This spell can't be countered" has nothing to hook into - this
    // engine has no stack/priority system, so there's no countermagic at
    // all yet (see Syncopate's own card comment for the same conclusion).
    // Left as flavor/rules text only, same as Syncopate's un-implemented
    // counter effect.
    text: 'This spell can\u2019t be countered.\n' +
      'You may have this creature enter as a copy of any creature on the battlefield, ' +
      'except it enters with X additional +1/+1 counters on it',
    imagePath: '/assets/cards/altered-ego.webp',
    onEnter: [{ type: 'becomeCopyOfAnyCreatureThenAddCounters' }],
  },
  {
    id:'amarant-coral',
    name:'Amarant Coral',
    type:'creature',
    subtype:'Legendary Creature \u2014 Human Monk',
    costLabel:'{2}{R}{G}',
    power: 5,
    toughness: 4,
    text:'Trample\n'+
    'Amarant Coral attacks each combat if able.\n'+
    'No Mercy — Whenever Amarant Coral deals combat damage to an opponent, it deals that much damage to each other opponent.\n'+
    '“I\u2019m not here to help. I just want it to be fair.”',
    imagePath:'/assets/cards/amarant-coral.webp',
    mustAttackIfAble: true,
    // "No Mercy" is a guaranteed no-op - there's no "each other opponent" in a 2-player engine.
  },
  {
    id: 'ambrosia-whiteheart',
    name: 'Ambrosia Whiteheart',
    type: 'creature',
    subtype: 'Legendary Creature Bird',
    costLabel: '{1}{W}',
    power: 2,
    toughness: 2,
    text: "When Ambrosia Whiteheart enters, you may return another permanent you control to its owner's hand. Landfall \u2014 Whenever a land you control enters, Ambrosia Whiteheart gets +1/+0 until end of turn.",
    imagePath: '/assets/cards/ambrosia-whiteheart.webp',
    onEnter: [{ type: 'optionalBounce' }],
    landfall: { temporaryBuff: { power: 1, toughness: 0 } },
  },
  {
    id: 'an-offer-you-can-t-refuse',
    name: 'An Offer You Can’t Refuse',
    type: 'instant',
    costLabel: '{U}',
    // "Counter target noncreature spell" is deferred - this engine has no
    // stack/priority system at all (CAST_CARD resolves a spell's effects
    // immediately, so there's no "spell sitting on the stack" object left to
    // counter by the time any other card could respond), same conclusion as
    // Syncopate's own card comment. A real implementation would need a whole
    // new casting pipeline (announce -> priority window -> resolve), not
    // just a new effect on this one card, so this stays flavor/rules text
    // only - no onCast effects.
    text: 'Counter target noncreature spell. Its controller creates two Treasure tokens. (They\u2019re artifacts with "{T}, Sacrifice this token: Add one mana of any color.")',
    imagePath: '/assets/cards/an-offer-you-can-t-refuse.webp',
  },
  {
    id: 'ancient-adamantoise',
    name: 'Ancient Adamantoise',
    type: 'creature',
    subtype: 'Creature Turtle',
    costLabel: '{5}{G}{G}{G}',
    power: 8,
    toughness: 20,
    text: "Vigilance, ward 3. Damage isn't removed from this creature during cleanup steps. All damage that would be dealt to you and other permanents you control is dealt to this creature instead. When this creature dies, exile it and create ten tapped Treasure tokens.",
    imagePath: '/assets/cards/ancient-adamantoise.webp',
    onDeathExileAndCreateTokens: { tokenId: 'token-treasure', count: 10 },
    wardCost: { mana: '{3}' },
    // "Damage isn't removed during cleanup" and "all damage to you/your
    // other permanents is dealt to this creature instead" are still
    // deferred - the former needs a per-creature damage-persistence flag
    // (this engine always clears damageMarked at cleanup) and the latter
    // needs a damage-redirection replacement effect; neither exists yet.
  },
  {
    id:'ancient-copper-dragon',
    name:'Dragon of Mount Gulg',
    type: 'creature',
    subtype:'Creature — Elder Dragon',
    costLabel:'{4}{R}{R}',
    power: 6,
    toughness: 5,
    text:'Flying\n'+
    'Whenever this creature deals combat damage to a player, roll a d20. You create a number of Treasure tokens equal to the result.',
    imagePath:'/assets/cards/ancient-copper-dragon.webp',
    onCombatDamageToPlayer: [{ type: 'createToken', tokenId: 'token-treasure', count: 'd20Roll' }]
  },
  {
    id: 'angel-of-the-ruins',
    name: 'Angel of the Ruins',
    type: 'creature',
    subtype: 'Artifact Creature Angel',
    costLabel: '{5}{W}{W}',
    power: 5,
    toughness: 7,
    text: 'Flying\n' +
      'When this creature enters, exile up to two target artifacts and/or enchantments.\n' +
      'Plainscycling {2} ({2}, Discard this card: Search your library for a Plains card, reveal it, put it into your hand, then shuffle.)',
    imagePath: '/assets/cards/angel-of-the-ruins.webp',
    onEnter: [{ type: 'exileTargetPermanent', targetFilter: 'artifactOrEnchantment', upToTwo: true }],
    cycling: { cost: '{2}', searchLandName: 'Plains' },
  },
  {
    id: 'arcane-signet',
    name: 'Arcane Signet',
    type: 'artifact',
    costLabel: '{2}',
    text: '{T}: Add one mana of any color in your commander’s color identity.',
    imagePath: '/assets/cards/arcane-signet.webp',
    // Color identity here is approximated as just the commander's own
    // printed mana cost colors (see engine/actions.ts: toggleTap's
    // 'commanderColorIdentity' resolution) - real color identity also
    // includes any mana symbols in the commander's rules/reminder text,
    // which this engine has no generic way to derive from CardDefinition.
    producesMana: 'commanderColorIdentity',
  },
  {
    id: 'archfiend-of-depravity',
    name: 'Archfiend of Depravity',
    type: 'creature',
    subtype: 'Creature Demon',
    costLabel: '{3}{B}{B}',
    power: 5,
    toughness: 5,
    text: 'Flying\n' +
      'At the beginning of each opponent\u2019s end step, that player chooses up to two creatures they control, then sacrifices the rest.\n' +
      'Ancient monsters that had long been sealed away were released when the world was ripped apart.',
    imagePath: '/assets/cards/archfiend-of-depravity.webp',
    onOpponentEndStep: [{ type: 'chooseUpToNCreaturesSacrificeRest', keepCount: 2 }],
  },
  {
    id: 'archmage-emeritus',
    name: 'Archmage Emeritus',
    type: 'creature',
    subtype: 'Creature — Human Wizard',
    costLabel: '{2}{U}{U}',
    power: 2,
    toughness: 2,
    text: 'Magecraft — Whenever you cast or copy an instant or sorcery spell, draw a card.\n' +
      '"If you are ever to become a capable astrologian, you must believe in the path laid out before you, and in your power to read it, follow it, and ultimately control it."\n' +
      '—Leveva Heavensreader',
    imagePath: '/assets/cards/archmage-emeritus.webp',
    onCastOrCopyInstantOrSorceryDrawCard: true,
  },
  {
    id: 'ardbert-warrior-of-darkness',
    name: 'Ardbert, Warrior of Darkness',
    type: 'creature',
    subtype: 'Legendary Creature — Spirit Warrior',
    costLabel: '{1}{W}{B}',
    power: 2,
    toughness: 2,
    text: 'Whenever you cast a white spell, put a +1/+1 counter on each legendary creature you control. They gain vigilance until end of turn.\n' +
      'Whenever you cast a black spell, put a +1/+1 counter on each legendary creature you control. They gain menace until end of turn.\n' +
      '“Always we took the burden of fighting upon ourselves. That\u2019s what heroes do, isn\u2019t it?”',
    imagePath: '/assets/cards/ardbert-warrior-of-darkness.webp',
    onOwnCastColorSpellTrigger: [
      { color: 'W', effects: [{ type: 'putCounterOnEachControlledCreatureMatchingSubtype', subtype: 'Legendary', counterLabel: '+1/+1', counterAmount: 1, grantKeyword: 'vigilance' }] },
      { color: 'B', effects: [{ type: 'putCounterOnEachControlledCreatureMatchingSubtype', subtype: 'Legendary', counterLabel: '+1/+1', counterAmount: 1, grantKeyword: 'menace' }] },
    ],
  },
  {
    id: 'arcane-sanctum',
    name: 'Arcane Sanctum',
    type: 'land',
    costLabel: '-',
    text: 'This land enters tapped.\n' +
      '{T}: Add {W}, {U}, or {B}.\n' +
      '“None of us were prepared for the spectacle that awaited us when we first stepped into the tower. To be surrounded by the marvels of a lost age took our breath away.”\n' +
      '—Ironworks datalog 2.5',
    imagePath: '/assets/cards/arcane-sanctum.webp',
    entersTapped: true,
    producesMana: ['W', 'U', 'B'],
  },
  {
    id:'archaeomancer-s-map',
    name:'Archaeomancer\u2019s Map',
    type:'artifact',
    costLabel:'{2}{W}',
    text:'When this artifact enters, search your library for up to two basic Plains cards, reveal them, put them into your hand, then shuffle.\n'+
    'Whenever a land an opponent controls enters, if that player controls more lands than you, you may put a land card from your hand onto the battlefield.',
    imagePath:'/assets/cards/archaeomancer-s-map.webp',
    onEnter: [{ type: 'searchLibraryForLand', landName: 'Plains', count: 2 }],
    onOpponentLandEnterIfTheyHaveMoreLands: { effects: [{ type: 'putLandFromHandOntoBattlefield' }] },
  },
  {
    id: 'ardyn-the-usurper',
    name: 'Ardyn, the Usurper',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Elder Human Noble',
    costLabel: '{5}{B}{B}{B}',
    power: 4,
    toughness: 4,
    text: "Demons you control have menace, lifelink, and haste. Starscourge \u2014 At the beginning of combat on your turn, exile up to one target creature card from a graveyard. If you exiled a card this way, create a token thats a copy of that card, except it's a 5/5 black Demon.",
    imagePath: '/assets/cards/ardyn-the-usurper.webp',
    // Ardyn isn't a Demon himself, so without this his own text's "menace,
    // lifelink, and haste" would falsely self-apply via the plain substring
    // keyword check (see engine/keywords.ts).
    excludeSelfKeywords: ['menace', 'lifelink', 'haste'],
    staticAnthemForControlledSubtype: { subtype: 'Demon', power: 0, toughness: 0, grantKeywords: ['menace', 'lifelink', 'haste'] },
    // The haste half of the anthem has no actual effect - see
    // engine/combat.ts: hasBoardGrantedKeyword's doc comment (summoning
    // sickness is only ever checked once, at entry, from the card's own
    // printed haste - nothing rechecks it dynamically against board grants
    // the way menace/lifelink are). Still included in the data since it's
    // accurate to the printed text and harmless. Starscourge is still
    // deferred entirely - needs a graveyard-targeted exile-then-copy-with-
    // a-stat/type override, which no existing copy effect supports
    // (createTokenCopyOfTarget only copies a battlefield permanent,
    // unchanged).
  },
  {
    id:'armory-automaton',
    name:'Armory Automaton',
    type:'creature',
    subtype:'Artifact Creature — Construct',
    costLabel:'{3}',
    power: 2,
    toughness: 2,
    text:'Whenever this creature enters or attacks, you may attach any number of target Equipment to it. (Control of the Equipment doesn\u2019t change.)\n'+
    '“They don\u2019t call those things sweepers for nothing. They can wipe out a whole squad in seconds.”\n'+
    '—Jessie, Avalanche rebel',
    // Simplified to "Equipment you control" - see
    // AttachAllControlledEquipmentToSelfEffect's own doc comment for why the
    // real "any Equipment, including an opponent's, control doesn't change"
    // clause is deferred.
    onEnter: [{ type: 'mayEffect', effects: [{ type: 'attachAllControlledEquipmentToSelf' }] }],
    onAttack: [{ type: 'mayEffect', effects: [{ type: 'attachAllControlledEquipmentToSelf' }] }],
    imagePath:'/assets/cards/armory-automaton.webp'
  },
  {
    id: 'ash-barrens',
    name: 'Ash Barrens',
    type: 'land',
    costLabel: '-',
    text: '{T}: Add {C}.\nBasic landcycling {1} ({1}, Discard this card: Search your library for a basic land card, reveal it, put it into your hand, then shuffle.)',
    imagePath: '/assets/cards/ash-barrens.webp',
    producesMana: 'C',
    cycling: { cost: '{1}', searchAnyBasicLand: true },
  },
  {
    id: 'ashe-princess-of-dalmasca',
    name: 'Ashe, Princess of Dalmasca',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Rebel Noble',
    costLabel: '{2}{W}',
    power: 3,
    toughness: 2,
    text: "Whenever Ashe attacks, look at the top five cards of your library. You may reveal an artifact card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.",
    imagePath: '/assets/cards/ashe-princess-of-dalmasca.webp',
    onAttack: [{ type: 'revealFiltered', count: 5, filterType: 'artifact' }],
  },
  {
    id: 'astrologian-s-planisphere',
    name: "Astrologian's Planisphere",
    type: 'artifact',
    subtype: 'Equipment',
    costLabel: '{1}{W}',
    // Was missing its Equipment subtype entirely (on top of attachesTo/
    // equipCost), so it could never actually be equipped to anything.
    // The "whenever you draw your third card each turn" half of the
    // granted counter-trigger is deferred - no per-turn draw-count
    // tracking exists in this engine (only the noncreature-spell half is
    // wired, via equipGrantsNoncreatureCastTrigger).
    text: "Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.) Equipped creature is a Wizard in addition to its other types and has “Whenever you cast a noncreature spell and whenever you draw your third card each turn, put a +1/+1 counter on this creature. Diana — Equip {2}",
    onEnter: [{ type: 'createToken', tokenId: 'token-hero', attachSelfToToken: true }],
    attachesTo: 'creature',
    equipCost: '{2}',
    equipGrantsSubtype: 'Wizard',
    equipGrantsNoncreatureCastTrigger: { counterIfExpensive: { minManaValue: 0, counterLabel: '+1/+1', counterAmount: 1 } },
    imagePath: '/assets/cards/astrologian-s-planisphere.webp',
  },
  {
    id: 'authority-of-the-consuls',
    name: 'Authority of the Consuls',
    type: 'enchantment',
    costLabel: '{W}',
    text: 'Creatures your opponents control enter tapped.\n' +
      'Whenever a creature an opponent controls enters, you gain 1 life.\n' +
      '“He must be guilty of something or other, or he wouldn\u2019t have attempted to flee the Empire.”\n' +
      '—Yotsuyu goe Brutus',
    imagePath: '/assets/cards/authority-of-the-consuls.webp',
    opponentCreaturesEnterTappedAndYouGainLife: { lifeGain: 1 },
  },
  {
    id: 'aurons-inspiration',
    name: "Auron's Inspiration",
    type: 'instant',
    costLabel: '{2}{W}',
    text: "Attacking creatures get +2/+0 until end of turn.Flashback 2WW (You may cast this card from your graveyard for its flashback cost. Then exile it.)",
    onCast: [{ type: 'pumpAttackers', power: 2, toughness: 0 }],
    imagePath: '/assets/cards/aurons-inspiration.webp',
  },
  {
    id: 'auron-venerated-guardian',
    name: 'Auron, Venerated Guardian',
    type: 'creature',
    subtype: 'Legendary Creature Human Spirit Samurai',
    costLabel: '{3}{W}',
    power: 2,
    toughness: 5,
    text: 'Vigilance \n' +
      'Shooting Star — Whenever Auron attacks, put a +1/+1 counter on it. When you do, ' +
      'exile target creature defending player controls with power less than Auron\u2019s ' +
      'power until Auron leaves the battlefield.',
    imagePath: '/assets/cards/auron-venerated-guardian.webp',
    onAttack: [
      { type: 'putCounterOnSelf', counterLabel: '+1/+1', counterAmount: 1 },
      { type: 'exileTargetCreatureWithLessPowerUntilSourceLeaves' },
    ],
  },
  {
    id: 'austere-command',
    name: 'Austere Command',
    type: 'sorcery',
    costLabel: '{4}{W}{W}',
    text: 'Choose two —\n' +
      '• Destroy all artifacts.\n' +
      '• Destroy all enchantments.\n' +
      '• Destroy all creatures with mana value 3 or less.\n' +
      '• Destroy all creatures with mana value 4 or greater.',
    imagePath: '/assets/cards/austere-command.webp',
    chooseExactlyNModes: 2,
    chooseModes: [
      { label: 'Destroy all artifacts.', effects: [{ type: 'destroyAll', targetFilter: 'artifact' }] },
      { label: 'Destroy all enchantments.', effects: [{ type: 'destroyAll', targetFilter: 'enchantment' }] },
      { label: 'Destroy all creatures with mana value 3 or less.', effects: [{ type: 'destroyAll', targetFilter: 'creatureWithManaValueAtMost', maxManaValue: 3 }] },
      { label: 'Destroy all creatures with mana value 4 or greater.', effects: [{ type: 'destroyAll', targetFilter: 'creatureWithManaValueAtLeast', minManaValue: 4 }] },
    ],
  },
  {
    id: 'avalanche-of-sector-7',
    name: 'Avalanche of Sector 7',
    type: 'creature',
    subtype: 'Legendary Creature — Human Rebel',
    costLabel: '{2}{R}',
    toughness: 3,
    text: 'Menace\n' +
      'Avalanche of Sector 7’s power is equal to the number of artifacts your opponents control.\n' +
      'Whenever an opponent activates an ability of an artifact they control, Avalanche of Sector 7 deals 1 damage to that player.',
    imagePath: '/assets/cards/avalanche-of-sector-7.webp',
    basePowerEqualsOpponentControlledArtifactCount: true,
    onOpponentActivatesArtifactAbilityDealsDamage: 1,
  },
  {
    id:'azusa-lost-but-seeking',
    name:'Princess Sarah',
    type:'creature',
    subtype:'Legendary Creature — Human Monk',
    costLabel:'{2}{G}',
    power: 1,
    toughness: 2,
    text:'You may play two additional lands on each of your turns.',
    imagePath:'/assets/cards/azusa-lost-but-seeking.webp',
    extraLandsPerTurn: 2
  },
  {
    id: 'balamb-garden-seed-academy',
    name: 'Balamb Garden Seed Academy',
    type: 'land',
    costLabel: '-',
    text: "This land enters tapped. Tap: Add G or U. 5GU Tap: Transform this land. This ability costs 1 less to activate for each other Town you control.",
    imagePath: '/assets/cards/balamb-garden-seed-academy.webp',
    entersTapped: true,
    transformsInto: 'balamb-garden-airborne',
    producesMana: ['G', 'U'],
    // The "costs 1 less per other Town you control" discount is left manual -
    // this engine has no generic subtype-counting cost-reduction system, so
    // this activates at the flat printed cost instead.
    abilities: [
      {
        id: 'balamb-transform',
        label: 'Transform',
        cost: { manaLabel: '{5}{G}{U}', tap: true },
        transformSelf: true,
        effectText: 'Transform this land.',
      },
    ],
  },
  {
    id: 'balamb-garden-airborne',
    name: 'Balamb Garden Airborne',
    type: 'artifact',
    subtype: 'Legendary Artifact \u2014 Vehicle',
    costLabel: '-',
    // Was missing its `crew` field entirely, so it could never actually be
    // crewed.
    text: "Flying. Whenever Balamb Garden attacks, draw a card. Crew 1",
    crew: 1,
    onAttack: [{ type: 'drawCards', amount: 1 }],
    imagePath: '/assets/cards/balamb-garden-airborne.webp',
  },
  {
    id: 'balamb-t-rexaur',
    name: 'Balamb T-Rexaur',
    type: 'creature',
    subtype: 'Creature \u2014 Dinosaur',
    costLabel: '{4}{G}{G}',
    power: 6,
    toughness: 6,
    text: "Trample. Whenever this creature enters, you gain 3 life. Forestcycling 2(2 Discard this card: Search your library for a forest card, reveal it, put it into your hand then shuffle)",
    onEnter: [{ type: 'gainLife', amount: 3 }],
    cycling: { cost: '{2}', searchLandName: 'Forest' },
    imagePath: '/assets/cards/balamb-t-rexaur.webp',
  },
  {
    id: 'baleful-strix',
    name: 'Baleful Strix',
    type: 'creature',
    subtype: 'Artifact Creature Bird',
    costLabel: '{U}{B}',
    power: 1,
    toughness: 1,
    text: 'Flying, deathtouch\n' +
      'When this creature enters, draw a card.\n' +
      'Skatenes are mind-quickened owls, granted sentience via powerful magicks much in the same way toads are transformed into poroggos.',
    imagePath: '/assets/cards/baleful-strix.webp',
    onEnter: [{ type: 'drawCards', amount: 1 }],
  },
  {
    id: 'balthier-and-fran',
    name: 'Balthier and Fran',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Rabbit',
    costLabel: '{1}{R}{G}',
    power: 4,
    toughness: 3,
    text: "Reach. Vehicles you control get +1/+1 and have vigilance and reach. Whenever a Vehicle crewed by Balthier and Fran this turn attacks, if it\u2019s the first combat phase of the turn, you may pay 1RG. If you do, after this phase, there is an additional combat phase.",
    imagePath: '/assets/cards/balthier-and-fran.webp',
    staticAnthemForControlledSubtype: { subtype: 'Vehicle', power: 1, toughness: 1, grantKeywords: ['vigilance', 'reach'] },
    // Balthier truly has Reach (the first sentence), but NOT vigilance -
    // vigilance is only granted to Vehicles. Without this, the "have
    // vigilance and reach" anthem clause would falsely self-apply vigilance
    // to Balthier via the plain substring keyword check (his attacks would
    // never tap him).
    excludeSelfKeywords: ['vigilance'],
    // The "...and have vigilance and reach" keyword half of the anthem is
    // deferred (see ardyn-the-usurper for why), and the extra-combat-phase
    // trigger is deferred - there's no "additional combat phase" mechanism
    // (only whole extra TURNS are supported, via extraTurnsQueued).
  },
  {
    id: 'bane-of-progress',
    name: 'Bane of Progress',
    type: 'creature',
    subtype: 'Creature Elemental',
    costLabel: '{4}{G}{G}',
    power: 2,
    toughness: 2,
    text: 'When this creature enters, destroy all artifacts and enchantments. Put a +1/+1 counter ' +
      'on this creature for each permanent destroyed this way.',
    imagePath: '/assets/cards/bane-of-progress.webp',
    onEnter: [{ type: 'destroyAll', targetFilter: 'artifactAndEnchantment', thenCounterSelfLabel: '+1/+1' }],
  },
  {
    id: 'banon-the-returners-leader',
    name: 'Banon, the Returners Leader',
    type: 'creature',
    subtype: 'Legendary Creature Human Cleric Rebel',
    costLabel: '{R}{W}',
    power: 1,
    toughness: 3,
    text: 'Pray — Once during each of your turns, you may cast a creature spell from among cards in your graveyard that were put there from anywhere other than the battlefield this turn.\n' +
      'Whenever you attack, you may pay {1} and discard a card. If you do, draw a card.\n' +
      '“You are this world’s last ray of light… our final hope.”',
    imagePath: '/assets/cards/banon-the-returners-leader.webp',
    grantsOncePerTurnCastCreatureFromGraveyardIfNotFromBattlefield: true,
    // The real cost is "pay {1} AND discard a card" (the discard is part of
    // the cost, not a follow-on) - approximated as "pay {1}, then draw then
    // discard" via the existing loot effect, since MayPayManaThenEffect only
    // models a pure mana cost. Only diverges with an empty hand (the real
    // card couldn't be activated at all; this one still draws, since loot's
    // own discard step gracefully no-ops when the hand is empty).
    onAttack: [{ type: 'mayPayManaThenEffect', manaCost: '{1}', effects: [{ type: 'loot', drawCount: 1, discardCount: 1 }] }],
  },
  {
    id: 'bards-bow',
    name: "Bard's Bow",
    type: 'artifact',
    subtype: 'Equipment',
    costLabel: '{2}{G}',
    text: "Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.) Equipped creature gets +2/+2, has reach, and is a Bard in addition to its other types. Perseus’s Bow — Equip 6( 6: Attach to target creature you control. Equip only as a sorcery.)",
    onEnter: [{ type: 'createToken', tokenId: 'token-hero', attachSelfToToken: true }],
    attachesTo: 'creature',
    equipCost: '{6}',
    equipBuff: { power: 2, toughness: 2 },
    equipGrantsKeyword: 'reach',
    equipGrantsSubtype: 'Bard',
    imagePath: '/assets/cards/bards-bow.webp',
  },
  {
    id: 'baron-airship-kingdom',
    name: 'Baron Airship Kingdom',
    type: 'land',
    costLabel: '-',
    text: "This land enters tapped. Tap: Add R or W.",
    imagePath: '/assets/cards/baron-airship-kingdom.webp',
    entersTapped: true,
    producesMana: ['R', 'W']
  },
  {
    id:'barret-avalanche-leader',
    name:'Barret, Avalanche Leader',
    type:'creature',
    subtype:'Legendary Creature — Human Rebel',
    costLabel:'{2}{R}{G}',
    power: 4,
    toughness: 4,
    text:'Reach\n'+
    'Avalanche! — Whenever an Equipment you control enters, create a 2/2 red Rebel creature token.\n'+
    'At the beginning of combat on your turn, attach up to one target Equipment you control to target Rebel you control.',
    onAnyControlledSubtypeEnterTrigger: { subtypes: ['Equipment'], effects: [{ type: 'createToken', tokenId: 'token-rebel' }] },
    onOwnCombatBegin: [{ type: 'attachTargetControlledEquipmentToTargetRebel' }],
    imagePath:'/assets/cards/barret-avalanche-leader.webp'
  },
  {
    id: 'barret-wallace',
    name: 'Barret Wallace',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Rebel',
    costLabel: '{3}{R}',
    power: 4,
    toughness: 4,
    text: "Reach, Whenever Barret Wallace attacks, it deals damage equal to the number of equipped creatures you control to defending player.",
    onAttack: [{ type: 'damageEqualToEquippedCreatures' }],
    imagePath: '/assets/cards/barret-wallace.webp',
  },
  {
    id: 'bartz-and-boko',
    name: 'Bartz and Boko',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Bird',
    costLabel: '{3}{G}{U}',
    power: 4,
    toughness: 3,
    text: "Affinity for Birds (This spell costs {1} less to cast for each Bird you control.) When Bartz and Boko enters, each other Bird you control deals damage equal to its power to target creature an opponent controls.",
    imagePath: '/assets/cards/bartz-and-boko.webp',
    costReductionPerControlledSubtype: { subtype: 'Bird', amountPerUnit: 1 },
    onEnter: [{ type: 'damageTargetCreatureEqualToOtherControlledSubtypePower', subtype: 'Bird' }],
  },
  {
    id: 'bastion-of-remembrance',
    name: 'Bastion of Remembrance',
    costLabel: '{2}{B}',
    type: 'enchantment',
    text: 'When this enchantment enters, create a 1/1 white Human Soldier creature token.\n' +
      'Whenever a creature you control dies, each opponent loses 1 life and you gain 1 life.\n' +
      'The legacy of Gaius van Baelsar is a towering monument to imperial tyranny.',
    imagePath: '/assets/cards/bastion-of-remembrance.webp',
    onEnter: [{ type: 'createToken', tokenId: 'token-soldier' }],
    // Reuses onAnyDeathDrain as-is, same as Al Bhed Salvagers - that field
    // fires for an ARTIFACT dying too (not just a creature), slightly
    // broader than this card's own "creature you control" wording. Minor,
    // accepted deviation (same shape as every other close-enough reuse in
    // this file) rather than forking a creature-only variant for one card.
    onAnyDeathDrain: { opponentLifeLoss: 1, controllerLifeGain: 1 },
  },
  {
    id: 'bastion-protector',
    name: 'Bastion Protector',
    type: 'creature',
    subtype: 'Creature — Human Soldier',
    costLabel: '{2}{W}',
    power: 3,
    toughness: 3,
    text: 'Commander creatures you control get +2/+2 and have indestructible.\n' +
      '"Squad A will set up here and search for suspects. B will establish a perimeter—roadblocks included. Contain the situation!"',
    imagePath: '/assets/cards/bastion-protector.webp',
    staticAnthemForCommanderCreaturesYouControl: { power: 2, toughness: 2, grantKeywords: ['indestructible'] },
  },
  {
    id: 'battlefield-forge',
    name: 'Battlefield Forge',
    type: 'land',
    costLabel: '-',
    text: '{T}: Add {C}.\n' +
      '{T}: Add {R} or {W}. This land deals 1 damage to you.\n' +
      '"Welcome to the new world order."\n' +
      '—Rufus Shinra',
    imagePath: '/assets/cards/battlefield-forge.webp',
    producesMana: 'C',
    altProducesMana: { colors: ['R', 'W'], payLife: 1 },
  },
  {
    id: 'battle-menu',
    name: 'Battle Menu',
    type: 'instant',
    costLabel: '{1}{W}',
    text: "Choose one — • Attack — Create a 2/2 white Knight creature token. • Ability — Target creature gets +0/+4 until end of turn. " +
      " • Magic — Destroy target creature with power 4 or greater. • Item — You gain 4 life.",
    // Modeled as onCast: [chooseOneMode] (an EFFECT resolved at cast time)
    // rather than CardDefinition.chooseModes (a cast-time "choose one OR
    // MORE" mechanism used elsewhere) - chooseOneMode already enforces
    // exactly one pick, matching "Choose one" here.
    onCast: [
      {
        type: 'chooseOneMode',
        modes: [
          { label: 'Attack — Create a 2/2 white Knight creature token.', effects: [{ type: 'createToken', tokenId: 'token-knight' }] },
          { label: 'Ability — Target creature gets +0/+4 until end of turn.', effects: [{ type: 'pumpTarget', power: 0, toughness: 4 }] },
          { label: 'Magic — Destroy target creature with power 4 or greater.', effects: [{ type: 'destroyTarget', targetFilter: 'creatureWithMinPower', minPower: 4 }] },
          { label: 'Item — You gain 4 life.', effects: [{ type: 'gainLife', amount: 4 }] },
        ],
      },
    ],
    imagePath: '/assets/cards/battle-menu.webp',
  },
  {
    id: 'beatrix-loyal-general',
    name: 'Beatrix, Loyal General',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Soldier',
    costLabel: '{4}{W}{W}',
    power: 4,
    toughness: 4,
    text: "Vigilance (Attacking doesn\u2019t cause this creature to tap.) At the beginning of combat on your turn, " +
      "you may attach any number of Equipment you control to target creature you control.",
    imagePath: '/assets/cards/beatrix-loyal-general.webp',
    onOwnCombatBegin: [{ type: 'attachAllControlledEquipmentToTargetCreature' }],
  },
  {
    id: 'bedevil',
    name: 'Bedevil',
    type: 'instant',
    costLabel: '{B}{B}{R}',
    text: 'Destroy target artifact, creature, or planeswalker.\n' +
      'On that day… the world was changed forever…',
    imagePath: '/assets/cards/bedevil.webp',
    onCast: [{ type: 'destroyTarget', targetFilter: 'artifactOrCreature' }],
  },
  {
    id: 'behemoth-sledge',
    name: 'Behemoth Sledge',
    type: 'artifact',
    subtype: 'Artifact Equipment',
    costLabel: '{1}{G}{W}',
    text: 'Equipped creature gets +2/+2 and has trample and lifelink.\n' +
      'Equip {3}\n' +
      'A crudely reinforced baseball bat. Designed to beat the living tar out of anything and everything.',
    imagePath: '/assets/cards/behemoth-sledge.webp',
    equipBuff: { power: 2, toughness: 2 },
    equipGrantsKeyword: ['trample', 'lifelink'],
    equipCost: '{3}',
    attachesTo: 'creature',
  },
  {
    id: 'big-score',
    name: 'Big Score',
    type: 'instant',
    costLabel: '{3}{R}',
    text: 'As an additional cost to cast this spell, discard a card.\n' +
      'Draw two cards and create two Treasure tokens. (They\u2019re artifacts with “{T}, Sacrifice this token: Add one mana of any color.”)\n' +
      '“Look, I finally found it… The legendary treasure that can undo death itself.”',
    imagePath: '/assets/cards/big-score.webp',
    // Modeled as LootEffect(draw 2, discard 1) rather than a true up-front
    // "discard as a cost" - same approximation as Laughing Mad elsewhere in
    // this file (net card change and end-of-resolution hand are identical
    // either way).
    onCast: [{ type: 'loot', drawCount: 2, discardCount: 1 }, { type: 'createToken', tokenId: 'token-treasure', count: 2 }],
  },
  {
    id:'birds-of-paradise',
    name:'Paradise Chocobo',
    type:'creature',
    subtype:'Creature \u2014 Bird',
    costLabel:'{G}',
    power: 0,
    toughness: 1,
    text:'Flying\n'+
    '{T}: Add one mana of any color.\n'+
    'It is rumored that wild breeds of the species— including those which have retained the capacity for flight—still thrive throughout forests nestled in the vastly unexplored valleys of Abalathia\u2019s Spine.',
    imagePath:'/assets/cards/birds-of-paradise.webp',
    producesMana: 'any',
  },
  {
    id: 'black-mages-rod',
    name: "Black Mage's Rod",
    type: 'artifact',
    subtype: 'Equipment',
    costLabel: '{1}{B}',
    text: 'Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, ' +
      'then attach this to it.) Equipped creature gets +1/+0, has “Whenever you cast a noncreature spell, ' +
      'this creature deals 1 damage to each opponent,” and is a Wizard in addition to its other types.\nEquip 3',
    onEnter: [{ type: 'createToken', tokenId: 'token-hero', attachSelfToToken: true }],
    attachesTo: 'creature',
    equipCost: '{3}',
    equipBuff: { power: 1, toughness: 0 },
    equipGrantsSubtype: 'Wizard',
    equipGrantsNoncreatureCastTrigger: { damageEachOpponent: 1 },
    imagePath: '/assets/cards/black-mages-rod.webp',
  },
  {
    id: 'black-waltz-no3',
    name: 'Black Waltz No. 3',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Wizard',
    costLabel: '{2}{B}{R}',
    power: 2,
    toughness: 2,
    text: "Flying, deathtouch " +
      "Whenever you cast a noncreature spell, Black Waltz No. 3 deals 2 damage to each opponent.",
    noncreatureCastTrigger: { damageEachOpponent: 2 },
    imagePath: '/assets/cards/black-waltz-no3.webp',
  },
  {
    id: 'blazing-bomb',
    name: 'Blazing Bomb',
    type: 'creature',
    subtype: 'Emental',
    costLabel: '{R}',
    power: 1,
    toughness: 1,
    text: "Whenever you cast a noncreature spell, if at least four mana was spent to cast it, put a +1/+1 counter on this creature. " +
      "Blow Up — {T}, Sacrifice this creature: It deals damage equal to its power to target creature. Activate only as a sorcery.",
    noncreatureCastTrigger: { counterIfExpensive: { minManaValue: 4, counterLabel: '+1/+1', counterAmount: 1 } },
    imagePath: '/assets/cards/blazing-bomb.webp',
  },
  {
    id: 'blitzball',
    name: 'Blitzball',
    type: 'artifact',
    costLabel: '{3}',
    text: ": Add one mana of any color. " +
      "GOOOOAAAALLL! — {T}, Sacrifice this artifact: Draw two cards. Activate only if an opponent was dealt combat " +
      "damage by a legendary creature this turn.",
    producesMana: 'any',
    imagePath: '/assets/cards/blitzball.webp',
    // The GOOOOAAAALLL! ability is deferred - "an opponent was dealt combat
    // damage by a legendary creature this turn" needs a new per-turn
    // tracked condition this engine doesn't have (only creaturesDiedThisTurn
    // exists as a comparable "this turn" tracker, and it doesn't fit).
  },
  {
    id: 'blitzball-shot',
    name: 'Blitzball Shot',
    type: 'instant',
    costLabel: '{1}{G}',
    text: "Target creature gets +3/+3 and gains trample until end of turn.",
    onCast: [{ type: 'pumpTarget', power: 3, toughness: 3, grantKeyword: 'trample' }],
    imagePath: '/assets/cards/blitzball-shot.webp',
  },
  {
    id: 'blitzball-stadium',
    name: 'Blitzball Stadium',
    type: 'artifact',
    costLabel: '{X}{U}',
    text: 'When this artifact enters, support X. (Put a +1/+1 counter on each of up to X target creatures.)\n' +
      'Go for the Goal! — {3}, {T}: Until end of turn, target creature can\u2019t be blocked this turn.',
    imagePath: '/assets/cards/blitzball-stadium.webp',
    onEnter: [{ type: 'support', counterLabel: '+1/+1', counterAmount: 1 }],
    abilities: [
      {
        id: 'blitzball-stadium-goal',
        label: 'Go for the Goal!',
        cost: { manaLabel: '{3}', tap: true },
        effects: [{ type: 'grantKeywordsToTargetPermanent', keywords: ['unblockable'], creatureOnly: true }],
        effectText: "Until end of turn, target creature can't be blocked this turn.",
        // The granted "draws a card for each kind of counter on it" trigger
        // is deferred - it would need a whole new per-creature GRANTED
        // triggered-ability shape (fire on ITS combat damage to a player,
        // for the rest of the turn only, counting distinct counter LABELS
        // rather than a total count), which nothing else in this engine
        // needs yet. Only the unblockable half is implemented.
      },
    ],
  },
  {
    id:'blue-mage-s-cane',
    name:'Blue Mage\u2019s Cane',
    type:'artifact',
    subtype:'Artifact — Equipment',
    costLabel:'{2}{U}',
    text:'Job select\n'+
    'Equipped creature gets +0/+2, is a Wizard in addition to its other types, and has “Whenever this creature attacks, exile up to one target instant or sorcery card from defending player’s graveyard. If you do, copy it. You may cast the copy by paying {3} rather than paying its mana cost.”\n'+
    'Spirit of the Whalaqee — Equip {2}',
    imagePath:'/assets/cards/blue-mage-s-cane.webp',
    onEnter: [{ type: 'createToken', tokenId: 'token-hero', attachSelfToToken: true }],
    attachesTo: 'creature',
    equipCost: '{2}',
    equipBuff: { power: 0, toughness: 2 },
    equipGrantsSubtype: 'Wizard',
    equipGrantsOnAttack: [{ type: 'exileTargetInstantOrSorceryFromOpponentGraveyardThenMayCastForFixedCost', fixedCost: '{3}' }],
  },
  {
    id:'bolas-s-citadel',
    name:'Kefka\u2019s Tower',
    type:'artifact',
    subtype:'Legendary Artifact',
    costLabel:'{3}{B}{B}{B}',
    text:'You may look at the top card of your library any time.\n'+
    'You may play lands and cast spells from the top of your library. If you cast a spell this way, pay life equal to its mana value rather than pay its mana cost.\n'+
    '{T}, Sacrifice ten nonland permanents: Each opponent loses 10 life.',
    grantsPlayFromTopOfLibrary: { payLifeInsteadOfManaCost: true },
    abilities: [
      {
        id: 'bolas-s-citadel-sac',
        label: 'Sacrifice ten nonland permanents',
        cost: { tap: true, sacrificeAnother: 'nonlandPermanent', sacrificeAnotherCount: 10 },
        effects: [{ type: 'eachOpponentLosesLife', amount: 10 }],
        effectText: 'Each opponent loses 10 life.',
      },
    ],
    imagePath:'/assets/cards/bolas-s-citadel.webp'
  },
  {
    id:'bonders-enclave',
    name:'Bonders\u2019 Enclave',
    type:'land',
    costLabel:'-',
    text:'{T}: Add {C}.\n'+
    '{3}, {T}: Draw a card. Activate only if you control a creature with power 4 or greater.\n'+
    '“With things the way they are now, how \nbout raising a chocobo?”\n'+
    '—Chocobo Bill',
    imagePath:'/assets/cards/bonders-enclave.webp',
    producesMana: 'C',
    abilities: [
      {
        id: 'bonders-enclave-draw',
        label: 'Draw a card',
        cost: { manaLabel: '{3}', tap: true },
        requiresControlledCreaturePowerAtLeast: 4,
        effects: [{ type: 'drawCards', amount: 1 }],
        effectText: 'Draw a card. Activate only if you control a creature with power 4 or greater.',
      },
    ],
  },
  {
    id: 'bred-for-the-hunt',
    name: 'Bred for the Hunt',
    type: 'enchantment',
    costLabel: '{1}{G}{U}',
    text: 'Whenever a creature you control with a +1/+1 counter on it deals combat damage to a player, you may draw a card.',
    imagePath: '/assets/cards/bred-for-the-hunt.webp',
    onAnyControlledCreatureWithCounterCombatDamageToPlayer: [{ type: 'mayEffect', effects: [{ type: 'drawCards', amount: 1 }] }],
  },
  {
    id:'brilliant-wings',
    name:'Brilliant Wings',
    type:'enchantment',
    subtype:'Enchantment \u2014 Aura',
    costLabel:'{1}{W}',
    text:'Flash\n'+
    'Enchant creature you control\n'+
    'Enchanted creature has flying and hexproof.\n'+
    'Whenever a creature you control enters, you may pay {1}. If you do, attach this Aura to that creature.',
    imagePath:'/assets/cards/brilliant-wings.webp',
    attachesTo: 'creature',
    onEnter: [{ type: 'attachSelfToTarget' }],
    equipGrantsKeyword: ['flying', 'hexproof'],
    excludeSelfKeywords: ['flying', 'hexproof'],
    // The "whenever a creature you control enters, you may pay {1} to move
    // this Aura to it instead" re-attachment clause is deferred - no
    // "may move an already-attached Aura to a newly-entering creature"
    // mechanism exists.
  },
  {
    id:'bronze-guardian',
    name:'Bronze Guardian',
    type:'creature',
    subtype:'Artifact Creature — Golem',
    costLabel:'{4}{W}',
    toughness: 5,
    text:'Double strike\n'+
    'Ward {2} (Whenever this creature becomes the target of a spell or ability an opponent controls, counter it unless that player pays {2}.)\n'+
    'Other artifacts you control have ward {2}.\n'+
    'Bronze Guardian\u2019s power is equal to the number of artifacts you control.',
    imagePath:'/assets/cards/bronze-guardian.webp',
    wardCost: { mana: '{2}' },
    grantsWardToOtherControlledArtifacts: { mana: '{2}' },
    basePowerEqualsControlledArtifactCount: true,
  },
  {
    id: 'brushland',
    name: 'Brushland',
    type: 'land',
    costLabel: '-',
    text: '{T}: Add {C}.\n{T}: Add {G} or {W}. This land deals 1 damage to you.',
    imagePath: '/assets/cards/brushland.webp',
    producesMana: 'C',
    altProducesMana: { colors: ['G', 'W'], payLife: 1 },
  },
  {
    id:'bugenhagen-wise-elder',
    name:'Bugenhagen, Wise Elder',
    type:'creature',
    subtype:'Legendary Creature — Human Shaman',
    costLabel:'{1}{G}',
    power: 1,
    toughness: 3,
    text:'Reach\n'+
    'At the beginning of your upkeep, if you control a creature with power 7 or greater, draw a card.\n'+
    '{T}: Add one mana of any color.\n'+
    '“I’ve been thinking if there was anything we could do to help a planet already in misery…”',
    onOwnUpkeep: [{ type: 'ifControlCreatureWithPowerAtLeast', minPower: 7, thenEffects: [{ type: 'drawCards', amount: 1 }], elseEffects: [] }],
    abilities: [
      {
        id: 'bugenhagen-wise-elder-add',
        label: 'Add one mana of any color',
        cost: { tap: true },
        effects: [{ type: 'addOneManaOfChosenColor' }],
        effectText: 'Add one mana of any color.',
      },
    ],
    imagePath:'/assets/cards/bugenhagen-wise-elder.webp'
  },
  {
    id: 'buster-sword',
    name: 'Buster Sword',
    type: 'artifact',
    subtype: 'Equipment',
    costLabel: '{3}',
    text: "Equipped creature gets +3/+2. " +
      "Whenever equipped creature deals combat damage to a player, draw a card, " +
      "then you may cast a spell from your hand with mana value less than or equal to that damage without paying its mana cost. Equip 2",
    imagePath: '/assets/cards/buster-sword.webp',
    attachesTo: 'creature',
    equipCost: '{2}',
    equipBuff: { power: 3, toughness: 2 },
    equipGrantsDrawThenMayCastFreeUpToCombatDamage: true,
  },
  {
    id: 'cactuar',
    name: 'Cactuar',
    type: 'creature',
    costLabel: '{G}',
    power: 3,
    toughness: 3,
    text: "Trample. \n" +
      "At the beginning of your end step, if this creature didn\u2019t enter the battlefield this turn, return it to its owner\u2019s hand.",
    bounceSelfAtEndStepIfNotSummoningSick: true,
    imagePath: '/assets/cards/cactuar.webp',
  },
  {
    id: 'cait-sith-fortune-teller',
    name: 'Cait Sith, Fortune Teller',
    type: 'creature',
    subtype: 'Legendary Artifact Creature — Cat Moogle',
    costLabel: '{3}{R}',
    power: 3,
    toughness: 3,
    text: 'Lucky Slots — At the beginning of combat on your turn, scry 1, then exile the top card of your library. You may play that card this turn. When you exile a card this way, target creature you control gets +X/+0 until end of turn, where X is that card’s mana value.\n' +
      '“I\u2019m friend to one and all, thanks to my crystal ball!”',
    imagePath: '/assets/cards/cait-sith-fortune-teller.webp',
    onOwnCombatBegin: [{ type: 'scryThenExileTopPlayableThisTurnThenPumpTargetByExiledManaValue' }],
  },
  {
    id: 'call-the-mountain-chocobo',
    name: 'Call the Mountain Chocobo',
    type: 'sorcery',
    costLabel: '{3}{R}',
    text: "Search your library for a Mountain card, reveal it, put it into your hand, then shuffle. " +
      'Create a 2/2 green Bird creature token with “Whenever a land you control enters, this token gets +1/+0 until end of turn.”' +
      "Flashback {5}{R} (You may cast this card from your graveyard for its flashback cost. Then exile it.)",
    onCast: [{ type: 'searchLibraryForLand', landName: 'Mountain' }, { type: 'createToken', tokenId: 'token-bird' }],
    flashback: { cost: '{5}{R}' },
    imagePath: '/assets/cards/call-the-mountain-chocobo.webp',
  },
  {
    id:'campsite-cuisine',
    name:'Campsite Cuisine',
    type:'enchantment',
    costLabel:'{1}{G}',
    text:'Whenever this enchantment or a legendary creature you control enters, create a Food token.\n'+
    'Whenever you attack, you may sacrifice X Foods. When you do, up to X target attacking creatures each get +3/+3 and gain trample and indestructible until end of turn.',
    imagePath:'/assets/cards/campsite-cuisine.webp'
  },
  {
    id: 'canopy-vista',
    name: 'Canopy Vista',
    type: 'land',
    costLabel: '-',
    text: '({T}: Add {G} or {W}.)\n' +
      'This land enters tapped unless you control two or more basic lands.',
    imagePath: '/assets/cards/canopy-vista.webp',
    entersTappedUnlessControlBasicLandCount: 2,
    producesMana: ['G', 'W'],
  },
  {
    id: 'capital-city',
    name: 'Capital City',
    type: 'land',
    costLabel: '-',
    text: "Add Mana \n 1 Tap: Add one mana of any colour. \nCycling 2 (2, Discard this card: Draw a card.)",
    cycling: { cost: '{2}' },
    imagePath: '/assets/cards/capital-city.webp',
    producesMana: 'C'
  },
  {
    id: 'cargo-ship',
    name: 'Cargo Ship',
    type: 'artifact',
    subtype: 'Vehicle',
    costLabel: '{1}{U}',
    power: 2,
    toughness: 3,
    text: "Flying, vigilance \n Tap: Add Mana. Spend this mana only to cast an artifact spell or activate an ability of an artifact source. \n Crew 1",
    // Was missing its mana ability entirely. The "spend this mana only on
    // artifacts" restriction isn't enforced (this engine's mana pool isn't
    // tagged by source) - it just produces plain colorless mana.
    crew: 1,
    producesMana: 'C',
    imagePath: '/assets/cards/cargo-ship.webp',
  },
  {
    id: 'cecil,dark-knight',
    name: 'Cecil, Dark Knight',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Knight',
    costLabel: '{B}',
    power: 2,
    toughness: 3,
    text: "Deathtouch \n Darkness \u2014 Whenever Cecil deals damage, you lose that much life. Then if your life total is less than or equal to half your starting life " +
      "toal, untap Cecil and transform it.",
    imagePath: '/assets/cards/cecil-dark-knight.webp',
    transformsInto: 'cecil-redeemed-paladin',
    // Deferred - needs a generic "whenever this deals ANY damage" watcher
    // (broader than onCombatDamageToPlayer's combat-to-a-player-only scope)
    // plus a starting-life-total comparison this engine doesn't track
    // (GameState has no separate "starting life" field to compare against).
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
    onAttack: [{ type: 'grantKeywordToOtherAttackers', keyword: 'indestructible' }],
    imagePath: '/assets/cards/cecil-redeemed-paladin.webp',
  },
  {
    id:'celes-rune-knight',
    name:'Celes, Rune Knight',
    type:'creature',
    subtype:'Legendary Creature — Human Wizard Knight',
    costLabel:'{1}{R}{W}{B}',
    power: 4,
    toughness: 4,
    text:'When Celes enters, discard any number of cards, then draw that many cards plus one.\n'+
    'Whenever one or more other creatures you control enter, if one or more of them entered from a graveyard or was cast from a graveyard, put a +1/+1 counter on each creature you control.',
    imagePath:'/assets/cards/celes-rune-knight.webp',
    onEnter: [{ type: 'discardUpToThenDrawThatMany', maxCount: Infinity, plusOne: true }],
    onAnyOtherControlledCreatureEnterFromGraveyardPutCounterOnAllControlledCreatures: true,
  },
  {
    id: 'champions-from-beyond',
    name: 'Champions from Beyond',
    type: 'enchantment',
    costLabel: '{X}{W}{W}',
    text: 'When this enchantment enters, create X 1/1 colorless Hero creature tokens.\n' +
      'Light Party — Whenever you attack with four or more creatures, scry 2, then draw a card.\n' +
      'Full Party — Whenever you attack with eight or more creatures, those creatures get +4/+4 until end of turn.',
    imagePath: '/assets/cards/champions-from-beyond.webp',
    onEnter: [{ type: 'createToken', tokenId: 'token-hero', count: 'chosenX' }],
    // "Scry 2" has no dedicated mechanic in this engine - approximated as
    // Surveil 2 (look at the top 2, choice is top-or-graveyard instead of
    // top-or-bottom), the closest existing "look at the top of your
    // library and rearrange" effect.
    onAttackWithAtLeastNCreatures: { minCount: 4, effects: [{ type: 'surveil', count: 2, thenDrawCount: 1 }] },
    pumpAllAttackersIfAttackedWithAtLeastNCreatures: { minCount: 8, power: 4, toughness: 4 },
  },
  {
    id:'champion-s-helm',
    name:'Champion\u2019s Helm',
    type:'artifact',
    subtype:'Artifact — Equipment',
    costLabel:'{3}',
    text:'Equipped creature gets +2/+2.\n'+
    'As long as equipped creature is legendary, it has hexproof. (It can\u2019t be the target of spells or abilities your opponents control.)\n'+
    'Equip {1}',
    imagePath:'/assets/cards/champion-s-helm.webp',
    attachesTo: 'creature',
    equipCost: '{1}',
    equipBuff: { power: 2, toughness: 2 },
    equipGrantsKeywordIfEquippedLegendary: 'hexproof',
  },
  {
    id:'chaos-shrine-s-black-crystal',
    name:'Chaos Shrine\u2019s Black Crystal',
    costLabel:'{3}{B}',
    type:'artifact',
    subtype:'Legendary Artifact',
    text:'Whenever a nontoken creature you control dies, exile it.\n'+
    'At the beginning of your upkeep, you may put a creature card exiled with Chaos Shrine\u2019s Black Crystal onto the battlefield under your control with a finality counter on it.',
    imagePath:'/assets/cards/chaos-shrine-s-black-crystal.webp'
  },
  {
    id: 'chasm-skulker',
    name: 'Chasm Skulker',
    type: 'creature',
    subtype: 'Creature Squid Horror',
    costLabel: '{2}{U}',
    power: 1,
    toughness: 1,
    text: 'Whenever you draw a card, put a +1/+1 counter on this creature.\n' +
      'When this creature dies, create X 1/1 blue Squid creature tokens with islandwalk, where X is the number ' +
      'of +1/+1 counters on this creature. (They can\u2019t be blocked as long as defending player controls an Island.)',
    imagePath: '/assets/cards/chasm-skulker.webp',
    onDrawTrigger: { counterLabel: '+1/+1', counterAmount: 1 },
    onDeathCreateTokensEqualToOwnCounters: { counterLabel: '+1/+1', tokenId: 'token-squid' },
  },
  {
    id: 'chaos-warp',
    name: 'Chaos Warp',
    type: 'instant',
    costLabel: '{2}{R}',
    text: 'The owner of target permanent shuffles it into their library, then reveals the top card of their library. If it\u2019s a permanent card, they put it onto the battlefield.\n' +
      '“I\u2019m getting less human…”\n' +
      '—Vincent Valentine',
    imagePath: '/assets/cards/chaos-warp.webp',
    onCast: [{ type: 'shuffleTargetPermanentIntoLibraryThenRevealTop' }],
  },
  {
    id:'chocobo-camp',
    name:'Chocobo Camp',
    type:'land',
    costLabel:'-',
    text:'This land enters tapped unless you control a legendary creature.\n'+
    '{T}: Add {G}. When you next cast a Bird creature spell this turn, it enters with an additional +1/+1 counter on it.\n'+
    '{2}{G}{G}, {T}: Create a 2/2 green Bird creature token with “Whenever a land you control enters, this token gets +1/+0 until end of turn.”',
    imagePath:'/assets/cards/chocobo-camp.webp',
    entersTappedUnlessControlLegendaryCreature: true,
    producesMana: 'G',
    onTapForManaEffects: [{ type: 'setPendingNextCreatureSpellBonus', counterLabel: '+1/+1', counterAmount: 1, subtypeFilter: 'Bird' }],
    abilities: [
      {
        id: 'chocobo-camp-bird',
        label: 'Create Bird',
        cost: { manaLabel: '{2}{G}{G}', tap: true },
        effects: [{ type: 'createToken', tokenId: 'token-bird' }],
        effectText: 'Create a 2/2 green Bird creature token with "Whenever a land you control enters, this token gets +1/+0 until end of turn."',
      },
    ],
  },
  {
    id: 'chocobo-kick',
    name: 'Chocobo Kick',
    type: 'sorcery',
    costLabel: '{1}{G}',
    text: "Kicker \u2014 Return a land you control to its owner\u2019s hand. " +
      "(You may return a land you control to its owner\u2019s hand in addition to any other costs as you cast this spell.)\n " +
      "Target creature you control deals damage equal to its power to target creature an opponent controls. If this spell was kicked, \n" +
      "the creature you control deals twice that much damage instead.",
    imagePath: '/assets/cards/chocobo-kick.webp',
    kicker: { cost: 'returnLandToHand' },
    onCast: [
      {
        type: 'ifKicked',
        thenEffects: [{ type: 'chooseCreatureDealsDamageToOpponentCreature', doubleDamage: true }],
        elseEffects: [{ type: 'chooseCreatureDealsDamageToOpponentCreature' }],
      },
    ],
  },
  {
    id: 'chocobo-knights',
    name: 'Chocobo Knights',
    type: 'creature',
    subtype: 'Creature Human Knight',
    costLabel: '{3}{W}',
    power: 3,
    toughness: 3,
    text: 'Whenever you attack, creatures you control with counters on them gain double strike until end of turn.\n' +
      'Only a select few can become Chocobo Knights. You have to be a skilled rider or achieve some combat merit to become one.',
    imagePath: '/assets/cards/chocobo-knights.webp',
    grantsKeywordToOwnCreaturesWithCountersOnAttack: 'double strike',
  },
  {
    id: 'chocobo-racetrack',
    name: 'Chocobo Racetrack',
    type: 'artifact',
    costLabel: '{3}{G}{G}',
    text: "Landfall — Whenever a land you control enters, create a 2/2 green Bird creature token with “Whenever a land you control enters, this token gets +1/+0 until end of turn.",
    landfall: { createTokenId: 'token-bird' },
    imagePath: '/assets/cards/chocobo-racetrack.webp',
  },
  {
    id: 'choco-comet',
    name: 'Choco\u2014Comet',
    type: 'sorcery',
    costLabel: '{X}{R}{R}',
    text: "Choco\u2014Comet deals X damage to any target.\nCreate a 2/2 green Bird creature token with 'Whenever a land you control enters, this token gets +1/+0 until end of turn.'",
    onCast: [{ type: 'createToken', tokenId: 'token-bird' }],
    imagePath: '/assets/cards/choco-comet.webp',
  },
  {
    id: 'choco-seeker-of-paradise',
    name: 'Choco, Seeker of Paradise',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Bird',
    costLabel: '{1}{G}{W}{U}',
    power: 3,
    toughness: 5,
    text: "Whenever one or more Birds you control attack, look at that many cards from the top of your library. " +
      "You may put one of them into your hand. Then put any number of land cards from among them onto the battlefield tapped and the rest into your graveyard." +
      "\nLandfall — Whenever a land you control enters, Choco gets +1/+0 until end of turn.",
    landfall: { temporaryBuff: { power: 1, toughness: 0 } },
    imagePath: '/assets/cards/choco-seeker-of-paradise.webp',
  },
  {
    id:'choked-estuary',
    name:'Choked Estuary',
    type:'land',
    costLabel:'-',
    text:'As this land enters, you may reveal an Island or Swamp card from your hand. If you don\u2019t, this land enters tapped.\n'+
    '{T}: Add {U} or {B}.\n'+
    '“The imperials have not gained any ground since our last battle, but neither have we.”\n'+
    '—Ala Mhigan resistance fighter',
    imagePath:'/assets/cards/choked-estuary.webp',
    entersTappedUnlessRevealLandNames: ['Island', 'Swamp'],
    producesMana: ['U', 'B'],
  },
  {
    id:'cid-freeflier-pilot',
    name:'Cid, Freeflier Pilot',
    type: 'creature',
    subtype:'Legendary Creature \u2014 Human Warrior Pilot',
    costLabel:'{1}{W}',
    power: 2,
    toughness: 2,
    text:'Equipment and Vehicle spells you cast cost {1} less to cast.\n'+
    'Jump — During your turn, Cid has flying.\n'+
    '{2}, {T}: Return target Equipment or Vehicle card from your graveyard to your hand.\n'+
    '“I\u2019m Cid—that\u2019s who the hell I am! Now just let me handle it!”',
    imagePath:'/assets/cards/cid-freeflier-pilot.webp',
    reducesCastCostForSubtypes: ['Equipment', 'Vehicle'],
    grantsSelfKeywordDuringOwnTurn: 'flying',
    abilities: [
      {
        id: 'cid-freeflier-pilot-return',
        label: 'Return Equipment/Vehicle',
        cost: { manaLabel: '{2}', tap: true },
        effects: [{ type: 'returnTargetEquipmentOrVehicleFromGraveyardToHand' }],
        effectText: 'Return target Equipment or Vehicle card from your graveyard to your hand.',
      },
    ],
  },
  {
    id:'cid-timeless-artificer-f2',
    name:'Cid, Timeless Artificer',
    costLabel:'{2}{W}{U}',
    type:'creature',
    subtype:'Legendary Creature \u2014 Human Artificer',
    power: 4,
    toughness: 4,
    text:'Artifact creatures and Heroes you control get +1/+1 for each Artificer you control and each Artificer card in your graveyard.\n'+
    'A deck can have any number of cards named Cid, Timeless Artificer.\n'+
    'Cycling {W}{U} ({W}{U}, Discard this card: Draw a card.)',
    imagePath:'/assets/cards/cid-timeless-artificer-f2.webp',
    dynamicAnthemForArtifactCreaturesAndHeroesPerArtificer: true,
    cycling: { cost: '{W}{U}' },
    // "A deck can have any number of cards named Cid, Timeless Artificer"
    // is a deckbuilding-only rule with no in-game effect - same as Partner.
  },
  {
    id:'cid-timeless-artificer-f3',
    name:'Cid, Timeless Artificer',
    costLabel:'{2}{W}{U}',
    type:'creature',
    subtype:'Legendary Creature \u2014 Human Artificer',
    power: 4,
    toughness: 4,
    text:'Artifact creatures and Heroes you control get +1/+1 for each Artificer you control and each Artificer card in your graveyard.\n'+
    'A deck can have any number of cards named Cid, Timeless Artificer.\n'+
    'Cycling {W}{U} ({W}{U}, Discard this card: Draw a card.)',
    imagePath:'/assets/cards/cid-timeless-artificer-f3.webp',
    dynamicAnthemForArtifactCreaturesAndHeroesPerArtificer: true,
    cycling: { cost: '{W}{U}' },
  },
  {
    id:'cid-timeless-artificer-f4',
    name:'Cid, Timeless Artificer',
    costLabel:'{2}{W}{U}',
    type:'creature',
    subtype:'Legendary Creature \u2014 Human Artificer',
    power: 4,
    toughness: 4,
    text:'Artifact creatures and Heroes you control get +1/+1 for each Artificer you control and each Artificer card in your graveyard.\n'+
    'A deck can have any number of cards named Cid, Timeless Artificer.\n'+
    'Cycling {W}{U} ({W}{U}, Discard this card: Draw a card.)',
    imagePath:'/assets/cards/cid-timeless-artificer-f4.webp',
    dynamicAnthemForArtifactCreaturesAndHeroesPerArtificer: true,
    cycling: { cost: '{W}{U}' },
  },
  {
    id:'cid-timeless-artificer-f5',
    name:'Cid, Timeless Artificer',
    costLabel:'{2}{W}{U}',
    type:'creature',
    subtype:'Legendary Creature \u2014 Human Artificer',
    power: 4,
    toughness: 4,
    text:'Artifact creatures and Heroes you control get +1/+1 for each Artificer you control and each Artificer card in your graveyard.\n'+
    'A deck can have any number of cards named Cid, Timeless Artificer.\n'+
    'Cycling {W}{U} ({W}{U}, Discard this card: Draw a card.)',
    imagePath:'/assets/cards/cid-timeless-artificer-f5.webp',
    dynamicAnthemForArtifactCreaturesAndHeroesPerArtificer: true,
    cycling: { cost: '{W}{U}' },
  },
  {
    id:'cid-timeless-artificer-f6',
    name:'Cid, Timeless Artificer',
    costLabel:'{2}{W}{U}',
    type:'creature',
    subtype:'Legendary Creature \u2014 Human Artificer',
    power: 4,
    toughness: 4,
    text:'Artifact creatures and Heroes you control get +1/+1 for each Artificer you control and each Artificer card in your graveyard.\n'+
    'A deck can have any number of cards named Cid, Timeless Artificer.\n'+
    'Cycling {W}{U} ({W}{U}, Discard this card: Draw a card.)',
    imagePath:'/assets/cards/cid-timeless-artificer-f6.webp',
    dynamicAnthemForArtifactCreaturesAndHeroesPerArtificer: true,
    cycling: { cost: '{W}{U}' },
  },
  {
    id:'cid-timeless-artificer-f7',
    name:'Cid, Timeless Artificer',
    costLabel:'{2}{W}{U}',
    type:'creature',
    subtype:'Legendary Creature \u2014 Human Artificer',
    power: 4,
    toughness: 4,
    text:'Artifact creatures and Heroes you control get +1/+1 for each Artificer you control and each Artificer card in your graveyard.\n'+
    'A deck can have any number of cards named Cid, Timeless Artificer.\n'+
    'Cycling {W}{U} ({W}{U}, Discard this card: Draw a card.)',
    imagePath:'/assets/cards/cid-timeless-artificer-f7.webp',
    dynamicAnthemForArtifactCreaturesAndHeroesPerArtificer: true,
    cycling: { cost: '{W}{U}' },
  },
  {
    id:'cid-timeless-artificer-f8',
    name:'Cid, Timeless Artificer',
    costLabel:'{2}{W}{U}',
    type:'creature',
    subtype:'Legendary Creature \u2014 Human Artificer',
    power: 4,
    toughness: 4,
    text:'Artifact creatures and Heroes you control get +1/+1 for each Artificer you control and each Artificer card in your graveyard.\n'+
    'A deck can have any number of cards named Cid, Timeless Artificer.\n'+
    'Cycling {W}{U} ({W}{U}, Discard this card: Draw a card.)',
    imagePath:'/assets/cards/cid-timeless-artificer-f8.webp',
    dynamicAnthemForArtifactCreaturesAndHeroesPerArtificer: true,
    cycling: { cost: '{W}{U}' },
  },
  {
    id:'cid-timeless-artificer-f9',
    name:'Cid, Timeless Artificer',
    costLabel:'{2}{W}{U}',
    type:'creature',
    subtype:'Legendary Creature \u2014 Human Artificer',
    power: 4,
    toughness: 4,
    text:'Artifact creatures and Heroes you control get +1/+1 for each Artificer you control and each Artificer card in your graveyard.\n'+
    'A deck can have any number of cards named Cid, Timeless Artificer.\n'+
    'Cycling {W}{U} ({W}{U}, Discard this card: Draw a card.)',
    imagePath:'/assets/cards/cid-timeless-artificer-f9.webp',
    dynamicAnthemForArtifactCreaturesAndHeroesPerArtificer: true,
    cycling: { cost: '{W}{U}' },
  },
  {
    id:'cid-timeless-artificer-f10',
    name:'Cid, Timeless Artificer',
    costLabel:'{2}{W}{U}',
    type:'creature',
    subtype:'Legendary Creature \u2014 Human Artificer',
    power: 4,
    toughness: 4,
    text:'Artifact creatures and Heroes you control get +1/+1 for each Artificer you control and each Artificer card in your graveyard.\n'+
    'A deck can have any number of cards named Cid, Timeless Artificer.\n'+
    'Cycling {W}{U} ({W}{U}, Discard this card: Draw a card.)',
    imagePath:'/assets/cards/cid-timeless-artificer-f10.webp',
    dynamicAnthemForArtifactCreaturesAndHeroesPerArtificer: true,
    cycling: { cost: '{W}{U}' },
  },
  {
    id:'cid-timeless-artificer-f11',
    name:'Cid, Timeless Artificer',
    costLabel:'{2}{W}{U}',
    type:'creature',
    subtype:'Legendary Creature \u2014 Human Artificer',
    power: 4,
    toughness: 4,
    text:'Artifact creatures and Heroes you control get +1/+1 for each Artificer you control and each Artificer card in your graveyard.\n'+
    'A deck can have any number of cards named Cid, Timeless Artificer.\n'+
    'Cycling {W}{U} ({W}{U}, Discard this card: Draw a card.)',
    imagePath:'/assets/cards/cid-timeless-artificer-f11.webp',
    dynamicAnthemForArtifactCreaturesAndHeroesPerArtificer: true,
    cycling: { cost: '{W}{U}' },
  },
  {
    id:'cid-timeless-artificer-f12',
    name:'Cid, Timeless Artificer',
    costLabel:'{2}{W}{U}',
    type:'creature',
    subtype:'Legendary Creature \u2014 Human Artificer',
    power: 4,
    toughness: 4,
    text:'Artifact creatures and Heroes you control get +1/+1 for each Artificer you control and each Artificer card in your graveyard.\n'+
    'A deck can have any number of cards named Cid, Timeless Artificer.\n'+
    'Cycling {W}{U} ({W}{U}, Discard this card: Draw a card.)',
    imagePath:'/assets/cards/cid-timeless-artificer-f12.webp',
    dynamicAnthemForArtifactCreaturesAndHeroesPerArtificer: true,
    cycling: { cost: '{W}{U}' },
  },
  {
    id:'cid-timeless-artificer-f13',
    name:'Cid, Timeless Artificer',
    costLabel:'{2}{W}{U}',
    type:'creature',
    subtype:'Legendary Creature \u2014 Human Artificer',
    power: 4,
    toughness: 4,
    text:'Artifact creatures and Heroes you control get +1/+1 for each Artificer you control and each Artificer card in your graveyard.\n'+
    'A deck can have any number of cards named Cid, Timeless Artificer.\n'+
    'Cycling {W}{U} ({W}{U}, Discard this card: Draw a card.)',
    imagePath:'/assets/cards/cid-timeless-artificer-f13.webp',
    dynamicAnthemForArtifactCreaturesAndHeroesPerArtificer: true,
    cycling: { cost: '{W}{U}' },
  },
  {
    id:'cid-timeless-artificer-f14',
    name:'Cid, Timeless Artificer',
    costLabel:'{2}{W}{U}',
    type:'creature',
    subtype:'Legendary Creature \u2014 Human Artificer',
    power: 4,
    toughness: 4,
    text:'Artifact creatures and Heroes you control get +1/+1 for each Artificer you control and each Artificer card in your graveyard.\n'+
    'A deck can have any number of cards named Cid, Timeless Artificer.\n'+
    'Cycling {W}{U} ({W}{U}, Discard this card: Draw a card.)',
    imagePath:'/assets/cards/cid-timeless-artificer-f14.webp',
    dynamicAnthemForArtifactCreaturesAndHeroesPerArtificer: true,
    cycling: { cost: '{W}{U}' },
  },
  {
    id:'cid-timeless-artificer-f15',
    name:'Cid, Timeless Artificer',
    costLabel:'{2}{W}{U}',
    type:'creature',
    subtype:'Legendary Creature \u2014 Human Artificer',
    power: 4,
    toughness: 4,
    text:'Artifact creatures and Heroes you control get +1/+1 for each Artificer you control and each Artificer card in your graveyard.\n'+
    'A deck can have any number of cards named Cid, Timeless Artificer.\n'+
    'Cycling {W}{U} ({W}{U}, Discard this card: Draw a card.)',
    imagePath:'/assets/cards/cid-timeless-artificer-f15.webp',
    dynamicAnthemForArtifactCreaturesAndHeroesPerArtificer: true,
    cycling: { cost: '{W}{U}' },
  },
  {
    id:'cid-timeless-artificer-f16',
    name:'Cid, Timeless Artificer',
    costLabel:'{2}{W}{U}',
    type:'creature',
    subtype:'Legendary Creature \u2014 Human Artificer',
    power: 4,
    toughness: 4,
    text:'Artifact creatures and Heroes you control get +1/+1 for each Artificer you control and each Artificer card in your graveyard.\n'+
    'A deck can have any number of cards named Cid, Timeless Artificer.\n'+
    'Cycling {W}{U} ({W}{U}, Discard this card: Draw a card.)',
    imagePath:'/assets/cards/cid-timeless-artificer-f16.webp',
    dynamicAnthemForArtifactCreaturesAndHeroesPerArtificer: true,
    cycling: { cost: '{W}{U}' },
  },
  {
    id: 'cinder-glade',
    name: 'Cinder Glade',
    type: 'land',
    costLabel: '-',
    text: '({T}: Add {R} or {G}.)\n' +
      'This land enters tapped unless you control two or more basic lands.\n' +
      '“After we lost the war, we got peace, but with that, we lost something else. Now look at Wutai…”\n' +
      '—Yuffie Kisaragi',
    imagePath: '/assets/cards/cinder-glade.webp',
    entersTappedUnlessControlBasicLandCount: 2,
    producesMana: ['R', 'G'],
  },
  {
    id: 'circle-of-power',
    name: 'Circle of Power',
    type: 'sorcery',
    costLabel: '{3}{B}',
    text: "You draw two cards and you lose 2 life. Create a 0/1 black Wizard creature token with " +
      "'Whenever you cast a noncreature spell, this token deals 1 damage to each opponent.'" +
      "\nWizards you control get +1/+0 and gain lifelink until end of turn.",
    onCast: [
      { type: 'loot', drawCount: 2, discardCount: 0 },
      { type: 'loseLife', amount: 2 },
      { type: 'createToken', tokenId: 'token-wizard' },
      { type: 'pumpControlledSubtype', subtype: 'Wizard', power: 1, toughness: 0, grantKeyword: 'lifelink' },
    ],
    imagePath: '/assets/cards/circle-of-power.webp',
  },
  {
    id: 'clash-of-the-eikons',
    name: 'Clash of the Eikons',
    type: 'sorcery',
    costLabel: '{G}',
    text: "Choose one or more \u2014 " +
      "\n• Target creature you control fights target creature an opponent controls." +
      "\n• Remove a lore counter from target Saga you control. (Removing lore counters doesn\u2019t cause chapter abilities to trigger.)" +
      "\n• Put a lore counter on target Saga you control.",
    chooseModes: [
      { label: 'Target creature you control fights target creature an opponent controls.', effects: [{ type: 'chooseCreaturesFight' }] },
      { label: 'Remove a lore counter from target Saga you control.', effects: [{ type: 'modifySagaLoreCounter', delta: -1 }] },
      { label: 'Put a lore counter on target Saga you control.', effects: [{ type: 'modifySagaLoreCounter', delta: 1 }] },
    ],
    imagePath: '/assets/cards/clash-of-the-eikons.webp',
  },
  {
    id:'cleansing-nova',
    name:'Cleansing Nova',
    type:'sorcery',
    costLabel:'{3}{W}{W}',
    text:'Choose one —\n'+
    '• Destroy all creatures.\n'+
    '• Destroy all artifacts and enchantments.\n'+
    '“We called this calamity the \u2019Flood of Light.\u2019 Everything it touched was leeched of life and vigor, leaving naught behind but a luminous wasteland.”\n'+
    '—Moren, Crystarium Librarian',
    chooseModes: [
      { label: 'Destroy all creatures.', effects: [{ type: 'destroyAll', targetFilter: 'creature' }] },
      { label: 'Destroy all artifacts and enchantments.', effects: [{ type: 'destroyAll', targetFilter: 'artifactAndEnchantment' }] },
    ],
    chooseExactlyOneMode: true,
    imagePath:'/assets/cards/cleansing-nova.webp'
  },
  {
    id: 'clever-concealment',
    name: 'Clever Concealment',
    type: 'instant',
    costLabel: '{2}{W}{W}',
    text: 'Convoke (Your creatures can help cast this spell. Each creature you tap while casting this spell pays for {1} or one mana of that creature\u2019s color.)\n' +
      'Any number of target nonland permanents you control phase out. (Treat them and anything attached to them as though they don\u2019t exist until your next turn.)',
    imagePath: '/assets/cards/clever-concealment.webp',
    convoke: true,
    onCast: [{ type: 'phaseOutAnyNumberOfTargetControlledNonlandPermanents' }],
  },
  {
    id: 'clifftop-retreat',
    name: 'Clifftop Retreat',
    type: 'land',
    costLabel: '-',
    text: 'This land enters tapped unless you control a Mountain or a Plains.\n' +
      '{T}: Add {R} or {W}.\n' +
      '"Our mission is to survey a run-down reactor."\n' +
      '—Sephiroth',
    imagePath: '/assets/cards/clifftop-retreat.webp',
    entersTappedUnlessControlLandNames: ['Mountain', 'Plains'],
    producesMana: ['R', 'W'],
  },
  {
    id: 'clive-ifrits-dominant',
    name: "Clive, Ifrit's Dominant",
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Noble Warrior',
    costLabel: '{4}{R}{R}',
    power: 5,
    toughness: 5,
    text: 'When Clive enters, you may discard your hand, then draw cards equal to your devotion to red. (Each R in the mana costs of permanents you control counts toward your devotion to red.)' +
      "4RR, T: Exile Clive, then return it to the battlefield transformed under its owner\u2019s control. Activate only as a sorcery.",
    imagePath: '/assets/cards/clive-ifrit-s-dominant.webp',
    transformsInto: 'ifrit-warden-of-inferno',
    onEnter: [{ type: 'discardHandThenDrawByDevotion', color: 'R' }],
    abilities: [
      {
        id: 'clive-transform',
        label: 'Transform',
        cost: { manaLabel: '{4}{R}{R}', tap: true },
        exileAndReturnTransformed: true,
        onlyDuringOwnMainPhase: true,
        effectText: "Exile Clive, then return it to the battlefield transformed under its owner's control.",
      },
    ],
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
    transformsInto: 'clive-ifrits-dominant',
    saga: {
      chapters: [
        { numbers: [1], effects: [{ type: 'selfFightTarget', optional: true }] },
        {
          numbers: [2, 3],
          effects: [
            { type: 'addMana', colors: { R: 4 } },
            { type: 'exileAndReturnTransformedSelfIfLoreAtLeast', minLore: 3 },
          ],
        },
      ],
    },
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
    producesMana: 'C',
    onEnter: [{ type: 'hideaway', count: 4 }],
    abilities: [
      {
        id: 'clives-hideaway-play',
        label: 'Play Hidden Card',
        cost: { manaLabel: '{2}', tap: true },
        requiresControlledLegendaryCreatureCount: 4,
        playHideawayCard: true,
        effectText: 'You may play the exiled card without paying its mana cost if you control four or more legendary creatures.',
      },
    ],
  },
  {
    id: 'cloud-ex-soldier',
    name: 'Cloud, Ex-Soldier',
    type: 'creature',
    subtype: 'Legendary Creature — Human Soldier Mercenary',
    costLabel: '{2}{R}{G}{W}',
    power: 4,
    toughness: 4,
    text: 'Haste\n' +
      'When Cloud enters, attach up to one target Equipment you control to it.\n' +
      'Whenever Cloud attacks, draw a card for each equipped attacking creature you control. Then if Cloud has power 7 or greater, create two Treasure tokens.',
    imagePath: '/assets/cards/cloud-ex-soldier.webp',
    onEnter: [{ type: 'mayAttachTargetControlledEquipmentToSelf' }],
    onAttack: [{ type: 'drawForEquippedAttackersThenEffectsIfPowerAtLeast', minPower: 7, thenEffects: [{ type: 'createToken', tokenId: 'token-treasure', count: 2 }] }],
  },
  {
    id: 'cloud-s-limit-break',
    name: 'Cloud’s Limit Break',
    type: 'instant',
    costLabel: '{1}{W}',
    text: 'Tiered (Choose one additional cost.)\n' +
      '• Cross-Slash — {0} — Destroy target tapped creature.\n' +
      '• Blade Beam — {1} — Destroy any number of target tapped creatures with different controllers.\n' +
      '• Omnislash — {3}{W} — Destroy all tapped creatures.',
    imagePath: '/assets/cards/cloud-s-limit-break.webp',
    tieredModes: [
      { label: 'Cross-Slash — {0} — Destroy target tapped creature.', additionalCost: '{0}', effects: [{ type: 'destroyTarget', targetFilter: 'tappedCreature' }] },
      {
        label: 'Blade Beam — {1} — Destroy any number of target tapped creatures with different controllers.',
        additionalCost: '{1}',
        effects: [{ type: 'destroyAnyNumberOfTappedCreaturesWithDifferentControllers' }],
      },
      { label: 'Omnislash — {3}{W} — Destroy all tapped creatures.', additionalCost: '{3}{W}', effects: [{ type: 'destroyAll', targetFilter: 'tappedCreature' }] },
    ],
  },
  {
    id: 'cloudbound-moogle',
    name: 'Cloudbound Moogle',
    type: 'creature',
    costLabel: '{3}{W}{W}',
    power: 2,
    toughness: 3,
    text: "Flying \n When this creature enters, put a +1/+1 counter on target creature. \n" +
      "Plainscycling 2 (2, Discard this card: Search your library for a Plains card, reveal it, put it into your hand, then shuffle.)",
    onEnter: [{ type: 'putCounterOnTarget', counterLabel: '+1/+1', counterAmount: 1 }],
    cycling: { cost: '{2}', searchLandName: 'Plains' },
    imagePath: '/assets/cards/cloudbound-moogle.webp'
  },
  {
    id: 'cloud-midgar-mercenary',
    name: 'Cloud, Midgar Mercenary',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Soldier Mercenary',
    costLabel: '{W}{W}',
    power: 2,
    toughness: 1,
    text: "When Cloud enters, search your library for an Equipment card, reveal it, put it into your hand, then shuffle." +
      "\nAs long as Cloud is equipped, if a triggered ability of Cloud or an Equipment attached to it triggers, that ability triggers an additional time.",
    imagePath: '/assets/cards/cloud-midgar-mercenary.webp',
    onEnter: [{ type: 'searchLibraryForSubtype', subtype: 'Equipment' }],
    // The "triggers an additional time while equipped" doubling clause is
    // deferred - no mechanism doubles an arbitrary triggered ability.
  },
  {
    id: 'cloud-of-darkness',
    name: 'Cloud of Darkness',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Avatar',
    costLabel: '{2}{B}{G}{G}',
    power: 3,
    toughness: 3,
    text: 'Flying \nParticle Beam — When Cloud of Darkness enters, target creature an opponent controls gets -X/-X ' +
      "until end of turn, where X is the number of permanent cards in your graveyard.",
    onEnter: [{ type: 'debuffTargetByGraveyard', powerPerUnit: -1, toughnessPerUnit: -1 }],
    imagePath: '/assets/cards/cloud-of-darkness.webp'
  },
  {
    id: 'cloud-planets-champion',
    name: "Cloud, Planet's Champion",
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Soldier Mercenary',
    costLabel: '{3}{R}{W}',
    power: 4,
    toughness: 4,
    text: "During your turn, as long as Cloud is equipped, it has double strike and indestructible. " +
      "(This creature deals both first-strike and regular combat damage. Damage and effects that say “destroy” don\u2019t destroy this creature.)" +
      "Equip abilities you activate that target Cloud cost 2 less to activate.",
    imagePath: '/assets/cards/cloud-planet-s-champion.webp',
    // Without this, hasKeyword's naive text scan would see "double strike"/
    // "indestructible" as plain substrings of Cloud's own printed text and
    // grant them UNCONDITIONALLY (even unequipped, even on the opponent's
    // turn) - excludeSelfKeywords suppresses that, leaving only the real,
    // conditional grant below (hasKeywordsWhileEquipped, checked through
    // engine/combat.ts: hasBoardGrantedKeyword).
    excludeSelfKeywords: ['double strike', 'indestructible'],
    hasKeywordsWhileEquipped: ['double strike', 'indestructible'],
    reducesEquipCostWhenTargetingThis: 2,
  },
  {
    id: 'coeurl',
    name: 'Coeurl',
    type: 'creature',
    costLabel: '{1}{W}',
    power: 2,
    toughness: 2,
    text: "1W Tap target nonenchantment creature",
    imagePath: '/assets/cards/coeurl.webp',
    abilities: [
      {
        id: 'coeurl-tap',
        label: 'Tap',
        cost: { manaLabel: '{1}{W}' },
        effects: [{ type: 'tapTarget' }],
        effectText: 'Tap target nonenchantment creature.',
      },
    ],
  },
  {
    id:'coin-of-fate',
    name:'Coin of Fate',
    type:'artifact',
    costLabel:'{1}{W}',
    text:'When this artifact enters, surveil 1.\n'+
    '{3}{W}, {T}, Exile two creature cards from your graveyard, Sacrifice this artifact: An opponent chooses one of the exiled cards. You put that card on the bottom of your library and return the other to the battlefield tapped. You become the monarch.',
    imagePath:'/assets/cards/coin-of-fate.webp',
    onEnter: [{ type: 'surveil', count: 1 }],
    abilities: [
      {
        id: 'coin-of-fate-activate',
        label: 'Activate',
        cost: { manaLabel: '{3}{W}', tap: true, exileChosenCreatureCardsFromGraveyard: 2, sacrificeSelf: true },
        effects: [{ type: 'opponentChoosesOneOfExiledCardsToBottomRestReturnsTappedThenBecomeMonarch' }],
        effectText:
          'An opponent chooses one of the exiled cards. You put that card on the bottom of your library and return the other to the battlefield tapped. You become the monarch.',
      },
    ],
  },
  {
    id: 'coliseum-behemoth',
    name: 'Coliseum Behemoth',
    type: 'creature',
    costLabel: '{5}{G}{G}',
    power: 7,
    toughness: 7,
    text: "Trample \nWhen this creature enters, choose one \u2014 \n Destroy target artifact or enchantment \nDraw a card",
    onEnter: [
      {
        type: 'chooseOneMode',
        modes: [
          { label: 'Destroy target artifact or enchantment', effects: [{ type: 'destroyTarget', targetFilter: 'artifactOrEnchantment' }] },
          { label: 'Draw a card', effects: [{ type: 'loot', drawCount: 1, discardCount: 0 }] },
        ],
      },
    ],
    imagePath: '/assets/cards/coliseum-behemoth.webp',
  },
  {
    id: 'collective-effort',
    name: 'Collective Effort',
    type: 'sorcery',
    costLabel: '{1}{W}{W}',
    text: 'Escalate—Tap an untapped creature you control. (Pay this cost for each mode chosen beyond the first.)\n' +
      'Choose one or more —\n' +
      '• Destroy target creature with power 4 or greater.\n' +
      '• Destroy target enchantment. \n' +
      '• Put a +1/+1 counter on each creature target player controls.',
    imagePath: '/assets/cards/collective-effort.webp',
    escalateCost: 'tapCreature',
    // Modes 1 and 2 (both destroyTarget) share pendingTarget - if BOTH are
    // chosen together, only the second one actually ends up resolvable, same
    // known limitation as the pre-existing Clash of the Eikons: chooseModes
    // resolves every selected mode's effects through one flat
    // resolveCardEffects call, and the second destroyTarget's arming
    // silently clobbers the first's before the player ever acts on it.
    // Mode 3 is unaffected (it arms the separate pendingPlayerTarget), so
    // 1+3 or 2+3 together both work correctly - only choosing 1 AND 2 in the
    // same cast loses one of them. Fixing the general case would need a
    // mode-effect queue (like pendingCounterTransferQueue) shared across
    // every chooseModes card, out of scope here.
    chooseModes: [
      { label: 'Destroy target creature with power 4 or greater.', effects: [{ type: 'destroyTarget', targetFilter: 'creatureWithMinPower', minPower: 4 }] },
      { label: 'Destroy target enchantment.', effects: [{ type: 'destroyTarget', targetFilter: 'enchantment' }] },
      {
        label: 'Put a +1/+1 counter on each creature target player controls.',
        effects: [{ type: 'putCounterOnEachCreatureTargetPlayerControls', counterLabel: '+1/+1', counterAmount: 1 }],
      },
    ],
  },
  {
    id: 'colossus-hammer',
    name: 'Colossus Hammer',
    type: 'artifact',
    subtype: 'equipment',
    costLabel: '{1}',
    text: 'Equipped creature gets +10/+10 and loses flying.\n' +
      'Equip {8} ({8}: Attach to target creature you control. Equip only as a sorcery.)\n' +
      '“Sorry to keep you waiting. It\u2019s me! I\u2019ll handle the rest!”',
    imagePath: '/assets/cards/colossus-hammer.webp',
    equipBuff: { power: 10, toughness: 10 },
    equipRemovesKeyword: 'flying',
    equipCost: '{8}',
    attachesTo: 'creature',
  },
  {
    id:'combustible-gearhulk',
    name:'Combustible Gearhulk',
    type:'creature',
    subtype:'Artifact Creature — Construct',
    costLabel:'{4}{R}{R}',
    power: 6,
    toughness: 6,
    text:'First strike\n'+
    'When this creature enters, target opponent may have you draw three cards. If the player doesn\u2019t, you mill three cards, then this creature deals damage to that player equal to the total mana value of those cards.',
    imagePath:'/assets/cards/combustible-gearhulk.webp',
    onEnter: [{ type: 'opponentMayHaveYouDrawElseMillAndDealDamage', count: 3 }],
  },
  {
    id:'commander-s-sphere',
    name:'Commander’s Sphere',
    type:'artifact',
    costLabel:'{3}',
    text:'{T}: Add one mana of any color in your commander\u2019s color identity.\n'+
    'Sacrifice this artifact: Draw a card.\n'+
    '“Have you ever heard of something called a Growth Egg? Have you? Hmmm? It was buried in a tomb to the west a looong, long time ago!”\n'+
    '—Kohlingen resident',
    imagePath:'/assets/cards/commander-s-sphere.webp',
    producesMana: 'commanderColorIdentity',
    abilities: [
      {
        id: 'commander-s-sphere-sac',
        label: 'Sacrifice: Draw a card',
        cost: { sacrificeSelf: true },
        effects: [{ type: 'drawCards', amount: 1 }],
        effectText: 'Draw a card.',
      },
    ],
  },
  {
    id:'conformer-shuriken',
    name:'Conformer Shuriken',
    type:'artifact',
    subtype:'Legendary Artifact — Equipment',
    costLabel:'{2}',
    text:'Equipped creature has “Whenever this creature attacks, tap target creature defending player controls. If that creature has greater power than this creature, put a number of +1/+1 counters on this creature equal to the difference.”\n'+
    'Equip {2}',
    imagePath:'/assets/cards/conformer-shuriken.webp',
    attachesTo: 'creature',
    equipCost: '{2}',
    equipGrantsOnAttack: [{ type: 'tapTargetThenCounterSelfByPowerDifferenceIfGreater' }],
  },
  {
    id:'contaminated-aquifer',
    name:'Contaminated Aquifer',
    type:'land',
    costLabel:'-',
    text:'({T}: Add {U} or {B}.)\n'+
    'This land enters tapped.\n'+
    '“With Gunnhildr\u2019s Blades and the Warrior of Light leading the charge, it is only a matter of time before Castrum Lacus Litore is ours.”\n'+
    '—Bajsaljen Ulgasch',
    imagePath:'/assets/cards/contaminated-aquifer.webp',
    entersTapped: true,
    producesMana: ['U', 'B'],
  },
  {
    id: 'conqueror-s-flail',
    name: 'Conqueror’s Flail',
    type: 'artifact',
    subtype: 'Artifact Equipment',
    costLabel: '{2}',
    text: 'Equipped creature gets +1/+1 for each color among permanents you control.\n' +
      'As long as this Equipment is attached to a creature, your opponents can\u2019t cast spells during your turn.\n' +
      'Equip {2}',
    imagePath: '/assets/cards/conqueror-s-flail.webp',
    equipBuffPerDistinctControlledColor: { power: 1, toughness: 1 },
    equipGrantsOpponentsCantCastDuringYourTurn: true,
    equipCost: '{2}',
    attachesTo: 'creature',
  },
  {
    id: 'combat-tutorial',
    name: 'Combat Tutorial',
    type: 'sorcery',
    costLabel: '{2}{U}',
    text: "Target player draws two cards. Put a +1/+1 counter on up to one target creature you control.",
    onCast: [
      { type: 'drawCardsFromTargetPlayer', count: 2 },
      { type: 'putCounterOnUpToOneOwnCreature', counterLabel: '+1/+1', counterAmount: 1 },
    ],
    imagePath: '/assets/cards/combat-tutorial.webp'
  },
  {
    id: 'command-tower',
    name: 'Command Tower',
    type: 'land',
    costLabel: '-',
    text: '{T}: Add one mana of any color in your commander\u2019s color identity.',
    imagePath: '/assets/cards/command-tower.webp',
    producesMana: 'commanderColorIdentity',
  },
  {
    id: 'commune-with-beavers',
    name: 'Commune with Beavers',
    type: 'sorcery',
    costLabel: '{G}',
    text: 'Look at the top three cards of your library. You may reveal an artifact, creature, ' +
      "or land card from among them and put it into your hand. Put the rest on the bottom of your library in any order.",
    onCast: [{ type: 'revealFiltered', count: 3, filterType: ['artifact', 'creature', 'land'] }],
    imagePath: '/assets/cards/commune-with-beavers.webp',
  },
  {
    id: 'coral-sword',
    name: 'Coral Sword',
    type: 'artifact',
    subtype: 'equipment',
    costLabel: '{R}',
    text: 'Flash \nWhen this Equipment enters, attach it to target creature you control. That creature gains first strike until end of turn.\n Equipped creature gets +1/+0.\nEquip 1',
    onEnter: [{ type: 'attachSelfToTarget', grantKeyword: 'first strike' }],
    attachesTo: 'creature',
    equipCost: '{1}',
    equipBuff: { power: 1, toughness: 0 },
    imagePath: '/assets/cards/coral-sword.webp',
  },
  {
    id: 'cornered-by-black-mages',
    name: 'Cornered by Black Mages',
    type: 'sorcery',
    costLabel: '{1}{B}{B}',
    text: 'Target opponent sacrifices a creature of their choice. \nCreate a 0/1 black Wizard creature token with “Whenever you cast a noncreature spell, ' +
      ' this token deals 1 damage to each opponent.”',
    onCast: [{ type: 'sacrificeCreature', target: 'opponent' }, { type: 'createToken', tokenId: 'token-wizard' }],
    imagePath: '/assets/cards/cornered-by-black-mages.webp'
  },
  {
    id:'counterspell',
    name:'Wild Rose Rebellion',
    type:'instant',
    costLabel:'{U}{U}',
    text:'Counter target spell.',
    imagePath:'/assets/cards/counterspell.webp',
    // Deferred - this engine has no stack/priority system (see Syncopate's
    // own card comment for the full reasoning): CAST_CARD resolves a
    // spell's effects immediately, so there is no "spell sitting on the
    // stack" left to counter by the time any other card could respond. A
    // real implementation would need a whole new casting pipeline
    // (announce -> priority window for responses -> resolve), not just a
    // new effect on this one card.
  },
  {
    id: 'coveted-jewel',
    name: 'Coveted Jewel',
    type: 'artifact',
    costLabel: '{6}',
    text: 'When this artifact enters, draw three cards.\n' +
      '{T}: Add three mana of any one color.\n' +
      'Whenever one or more creatures an opponent controls attack you and aren\u2019t blocked, that player draws three cards and gains control of this artifact. Untap it.',
    imagePath: '/assets/cards/coveted-jewel.webp',
    onEnter: [{ type: 'drawCards', amount: 3 }],
    abilities: [
      {
        id: 'coveted-jewel-add',
        label: 'Add three mana of any one color',
        cost: { tap: true },
        effects: [{ type: 'addOneManaOfChosenColor', amount: 3 }],
        effectText: 'Add three mana of any one color.',
      },
    ],
    onUnblockedOpponentAttackGrantsControlAndDraws: { drawCount: 3 },
  },
  {
    id: 'crackling-doom',
    name: 'Crackling Doom',
    type: 'instant',
    costLabel: '{R}{W}{B}',
    text: 'Crackling Doom deals 2 damage to each opponent. Each opponent sacrifices a creature with the greatest power among creatures that player controls.\n' +
      '“No hard feelings, now… I\u2019m just going to use this power you\u2019ve unleashed to put you to sleep…”',
    imagePath: '/assets/cards/crackling-doom.webp',
    onCast: [{ type: 'dealDamageToEachOpponent', amount: 2 }, { type: 'eachOpponentSacrificesCreatureWithGreatestPower' }],
  },
  {
    id: 'crossroad-village',
    name: 'Crossroads Village',
    type: 'land',
    costLabel: '-',
    text: "This land enters tapped. As it enters, choose a color. \nTap: Add one mana of the chosen color.",
    imagePath: '/assets/cards/crossroads-village.webp',
    entersTapped: true,
    onEnter: [{ type: 'chooseManaColor' }],
  },
  {
    id: 'crux-of-fate',
    name: 'Crux of Fate',
    type: 'sorcery',
    costLabel: '{3}{B}{B}',
    text: 'Choose one —\n' +
      '• Destroy all Dragon creatures.\n' +
      '• Destroy all non-Dragon creatures.\n' +
      '“Thou art weak, Hraesvelgr—a slithering wyrm who fawneth on the vermin who should rightly be his prey.”',
    imagePath: '/assets/cards/crux-of-fate.webp',
    onCast: [
      {
        type: 'chooseOneMode',
        modes: [
          { label: 'Destroy all Dragon creatures.', effects: [{ type: 'destroyAll', targetFilter: 'creatureMatchingSubtype', requiredSubtype: 'Dragon' }] },
          { label: 'Destroy all non-Dragon creatures.', effects: [{ type: 'destroyAll', targetFilter: 'creatureNotMatchingSubtype', requiredSubtype: 'Dragon' }] },
        ],
      },
    ],
  },
  {
    id: 'crystal-fragments',
    name: 'Crystal Fragments',
    type: 'artifact',
    subtype: 'equipment',
    costLabel: '{W}',
    text: "Equipped creature gets +1/+1. \n5WW: Exile this Equipment, then return it to the battlefield transformed under its owner\u2019s control. Activate only as a sorcery. \nEquip 1",
    attachesTo: 'creature',
    equipCost: '{1}',
    equipBuff: { power: 1, toughness: 1 },
    imagePath: '/assets/cards/crystal-fragments.webp'
  },
  {
    id: 'cultivate',
    name: 'Cultivate',
    type: 'sorcery',
    costLabel: '{2}{G}',
    text: 'Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.\n' +
      '“They say you can\u2019t grow grass and flowers in Midgar. But for some reason, the flowers have no trouble blooming here.”',
    imagePath: '/assets/cards/cultivate.webp',
    onCast: [{ type: 'cultivate' }],
  },
  {
    id: 'cut-a-deal',
    name: 'Cut a Deal',
    type: 'sorcery',
    costLabel: '{2}{W}',
    text: 'Each opponent draws a card, then you draw a card for each opponent who drew a card this way.\n' +
      '“A strong Eorzea will ever have need of a strong Ul\u2019dah.”\n' +
      '—Nanamo Ul Namo',
    imagePath: '/assets/cards/cut-a-deal.webp',
    onCast: [{ type: 'eachOpponentDrawsThenCasterDrawsForEachWhoDid' }],
  },
  {
    id:'cyan-vengeful-samurai',
    name:'Cyan, Vengeful Samurai',
    type:'creature',
    subtype:'Legendary Creature — Human Samurai',
    costLabel:'{6}{W}',
    power: 3,
    toughness: 3,
    text:'This spell costs {1} less to cast for each creature card in your graveyard.\n'+
    'Double strike\n'+
    'Whenever one or more creature cards leave your graveyard, put a +1/+1 counter on Cyan.\n'+
    '“There will be no mercy for thee!”',
    imagePath:'/assets/cards/cyan-vengeful-samurai.webp',
    costReductionPerGraveyardCreature: 1,
    onAnyOwnCreatureCardLeaveGraveyardPutCounterOnSelf: { counterLabel: '+1/+1', counterAmount: 1 },
  },
  {
    id:'dancer-s-chakrams',
    name:'Dancer\u2019s Chakrams',
    type:'artifact',
    subtype:'Artifact — Equipment',
    costLabel:'{3}{W}',
    text:'Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.)\n'+
    'Equipped creature gets +2/+2, has lifelink and “Other commanders you control get +2/+2 and have lifelink,” and is a Performer in addition to its other types.\n'+
    'Krishna — Equip {3}',
    imagePath:'/assets/cards/dancer-s-chakrams.webp',
    onEnter: [{ type: 'createToken', tokenId: 'token-hero', attachSelfToToken: true }],
    attachesTo: 'creature',
    equipCost: '{3}',
    equipBuff: { power: 2, toughness: 2 },
    equipGrantsKeyword: 'lifelink',
    equipGrantsSubtype: 'Performer',
    equipGrantsAnthemForOtherCommandersYouControl: { power: 2, toughness: 2, grantKeywords: ['lifelink'] },
  },
  {
    id: 'damning-verdict',
    name: 'Damning Verdict',
    type: 'sorcery',
    costLabel: '{3}{W}{W}',
    text: 'Destroy all creatures with no counters on them.\n' +
      '“Yevon is embodied by eternal, unchanging continuity, summoner. Those who question these truths—they are traitors!”',
    imagePath: '/assets/cards/damning-verdict.webp',
    onCast: [{ type: 'destroyAll', targetFilter: 'creatureWithNoCounters' }],
  },
  {
    id:'dark-ritual',
    name:'Darkness of Eternity',
    type:'instant',
    costLabel:'{B}',
    text:'Add {B}{B}{B}.',
    onCast: [{ type: 'addMana', colors: { B: 3 } }],
    imagePath:'/assets/cards/dark-ritual.webp'
  },
  {
    id: 'dark-confidant',
    name: 'Dark Confidant',
    type: 'creature',
    subtype: 'Human Wizard',
    costLabel: '{1}{B}',
    power: 2,
    toughness: 1,
    text: "At the beginning of your upkeep, reveal the top card of your library and put that card into your hand. You lose life equal to its mana value.",
    onOwnUpkeep: [{ type: 'revealTopThenLoseLifeByManaValue' }],
    imagePath: '/assets/cards/dark-confidant.webp'
  },
  {
    id: 'dark-knights-greatsword',
    name: "Dark Knight's Greatsword",
    type: 'artifact',
    subtype: 'equipment',
    costLabel: '{2}{B}',
    text: 'Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.) \n' +
      "Equipped creature gets +3/+0 and is a Knight in addition to its other types. \nChaosbringer — Equip—Pay 3 life. Activate only once each turn.",
    onEnter: [{ type: 'createToken', tokenId: 'token-hero', attachSelfToToken: true }],
    attachesTo: 'creature',
    equipBuff: { power: 3, toughness: 0 },
    equipGrantsSubtype: 'Knight',
    imagePath: '/assets/cards/dark-knight-s-greatsword.webp'
  },
  {
    id:'darksteel-plate',
    name:'Darksteel Plate',
    type:'artifact',
    subtype:'equipment',
    costLabel:'{3}',
    text:'Indestructible\n'+
    'Equipped creature has indestructible.\n'+
    'Equip {2}\n'+
    '“A Shinra uniform… I was so proud when I first put it on.”',
    attachesTo: 'creature',
    equipCost: '{2}',
    equipGrantsKeyword: 'indestructible',
    imagePath:'/assets/cards/darksteel-plate.webp'
  },
  {
    id: 'darkwater-catacombs',
    name: 'Darkwater Catacombs',
    costLabel: '-',
    type: 'land',
    text: '{1}, {T}: Add {U}{B}.\n' +
      'Thought to have been built by the Nymian civilization, which thrived in the area some fifteen centuries ago, the palace appears to have been dedicated to their patron deity, Oschon, the Wanderer.',
    imagePath: '/assets/cards/darkwater-catacombs.webp',
    abilities: [
      {
        id: 'darkwater-catacombs-add',
        label: 'Add {U}{B}',
        cost: { manaLabel: '{1}', tap: true },
        effects: [{ type: 'addMana', colors: { U: 1, B: 1 } }],
        effectText: 'Add {U}{B}.',
      },
    ],
  },
  {
    id:'day-of-judgment',
    name:'Spira\u2019s Punishment',
    type:'sorcery',
    costLabel:'{2}{W}{W}',
    text:'Destroy all creatures.\n'+
    'Sin appeared a thousand years ago, a raging demon intent on reducing Spira to rubble. Everyone in Spira lives under Sin\u2019s black shadow.',
    imagePath:'/assets/cards/day-of-judgment.webp',
    onCast: [{ type: 'destroyAll', targetFilter: 'creature' }],
  },
  {
    id: 'deadly-embrace',
    name: 'Deadly Embrace',
    type: 'sorcery',
    costLabel: '{3}{B}{B}',
    text: 'Destroy target creature an opponent controls. Then draw a card for each creature that died this turn.',
    onCast: [{ type: 'destroyOpponentCreature', thenDrawForCreaturesDiedThisTurn: true }],
    imagePath: '/assets/cards/deadly-embrace.webp'
  },
  {
    id: 'decimate',
    name: 'Decimate',
    type: 'sorcery',
    costLabel: '{2}{R}{G}',
    text: 'Destroy target artifact, target creature, target enchantment, and target land. (You can\u2019t cast this spell unless you have legal choices for all its targets.)\n' +
      '“Progress requires sacrifice. Learn to live with it.”\n' +
      '—President Shinra',
    imagePath: '/assets/cards/decimate.webp',
    onCast: [{ type: 'destroyArtifactCreatureEnchantmentAndLand' }],
  },
  {
    id: 'delivery-moogle',
    name: 'Delivery Moogle',
    type: 'creature',
    subtype: 'Moogle',
    costLabel: '{3}{W}',
    power: 3,
    toughness: 2,
    text: 'Flying \nWhen this creature enters, search your library and/or graveyard for an artifact card with mana value 2 or less, ' +
      "\n reveal it, and put it into your hand. If you search your library this way, shuffle.",
    imagePath: '/assets/cards/delivery-moogle.webp',
    onEnter: [{ type: 'searchLibraryOrGraveyardForArtifact', maxManaValue: 2 }],
  },
  {
    id: 'demon-wall',
    name: 'Demon Wall',
    type: 'creature',
    subtype: 'Artifact Creature \u2014 Demon Wall',
    costLabel: '{1}{B}',
    power: 3,
    toughness: 3,
    text: 'Defender \nMenace (This creature can\u2019t be blocked except by two or more creatures.) ' +
      "As long as this creature has a counter on it, it can attack as though it didn\u2019t have defender. " +
      "\n5B: Put two +1/+1 counters on this creature.",
    ignoresDefenderIfHasCounter: true,
    abilities: [
      {
        id: 'demon-wall-grow',
        label: 'Grow',
        cost: { manaLabel: '{5}{B}' },
        effects: [{ type: 'putCounterOnSelf', counterLabel: '+1/+1', counterAmount: 2 }],
        effectText: 'Put two +1/+1 counters on this creature.',
      },
    ],
    imagePath: '/assets/cards/demon-wall.webp'
  },
  {
    id: 'demolition-field',
    name: 'Demolition Field',
    type: 'land',
    costLabel: '-',
    text: '{T}: Add {C}.\n' +
      '{2}, {T}, Sacrifice this land: Destroy target nonbasic land an opponent controls. That land\u2019s controller may search their library for a basic land card, put it onto the battlefield, then shuffle. You may search your library for a basic land card, put it onto the battlefield, then shuffle.',
    imagePath: '/assets/cards/demolition-field.webp',
    producesMana: 'C',
    abilities: [
      {
        id: 'demolition-field-destroy',
        label: 'Sacrifice: Destroy Nonbasic Land',
        cost: { manaLabel: '{2}', tap: true, sacrificeSelf: true },
        effects: [{ type: 'destroyTarget', targetFilter: 'opponentNonbasicLand', thenBothPlayersMaySearchBasicLandToBattlefield: true }],
        effectText: 'Destroy target nonbasic land an opponent controls. That land\u2019s controller may search their library for a basic land card, put it onto the battlefield, then shuffle. You may search your library for a basic land card, put it onto the battlefield, then shuffle.',
      },
    ],
  },
  {
    id: 'desolate-mire',
    name: 'Desolate Mire',
    type: 'land',
    costLabel: '-',
    text: '{1}, {T}: Add {W}{B}.\n' +
      '“To the south of here lies the Veldt. \u2019Tis a wild and dangerous land, inhabited by all manner of ferocious beasts…”\n' +
      '—Cyan Garamonde',
    imagePath: '/assets/cards/desolate-mire.webp',
    abilities: [
      {
        id: 'desolate-mire-filter',
        label: 'Add {W}{B}',
        cost: { manaLabel: '{1}', tap: true },
        effects: [{ type: 'addMana', colors: { W: 1, B: 1 } }],
        effectText: 'Add {W}{B}.',
      },
    ],
  },
  {
    id: 'destroy-evil',
    name: 'Destroy Evil',
    type: 'instant',
    costLabel: '{1}{W}',
    text: 'Choose one —\n' +
      '• Destroy target creature with toughness 4 or greater.\n' +
      '• Destroy target enchantment.',
    imagePath: '/assets/cards/destroy-evil.webp',
    chooseModes: [
      { label: 'Destroy target creature with toughness 4 or greater', effects: [{ type: 'destroyTarget', targetFilter: 'creatureWithMinToughness', minToughness: 4 }] },
      { label: 'Destroy target enchantment', effects: [{ type: 'destroyTarget', targetFilter: 'enchantment' }] },
    ],
    chooseExactlyOneMode: true,
  },
  {
    id: 'diamond-weapon',
    name: 'Diamond Weapon',
    type: 'creature',
    subtype: 'Legendary Artifact Creature \u2014 Elemental',
    costLabel: '{7}{G}{G}',
    power: 8,
    toughness: 8,
    text: "This spell costs 1 less to cast for each permanent card in your graveyard. \nReach \n Immune — Prevent all combat damage that would be dealt to Diamond Weapon.",
    costReductionPerGraveyardPermanent: 1,
    preventsAllCombatDamage: true,
    imagePath: '/assets/cards/diamond-weapon.webp'
  },
  {
    id:'dig-through-time',
    name:'Dig Through Time',
    type:'instant',
    costLabel:'{6}{U}{U}',
    text:'Delve (Each card you exile from your graveyard while casting this spell pays for {1}.)\n'+
    'Look at the top seven cards of your library. Put two of them into your hand and the rest on the bottom of your library in any order.',
    imagePath:'/assets/cards/dig-through-time.webp',
    delve: true,
    onCast: [{ type: 'lookAtTopNPutMToHandRestToBottom', count: 7, keepCount: 2 }],
  },
  {
    id: 'dion-bahamut-dominant',
    name: "Dion Bahamut's Dominant",
    type: 'creature',
    subtype: "Legendary Creature \u2014 Human Noble Knight",
    costLabel: '{3}{W}',
    power: 3,
    toughness: 3,
    text: 'Dragonfire Dive — During your turn, Dion and other Knights you control have flying.\nWhen Dion enters, create a 2/2 white Knight creature token.' +
      "4WW, Tap: Exile Dion, then return it to the battlefield transformed under its owner\u2019s control. Activate only as a sorcery.",
    onEnter: [{ type: 'createToken', tokenId: 'token-knight' }],
    // Dion's own flying is conditional ("during YOUR turn"), not permanent -
    // excludeSelfKeywords stops the plain substring match from granting it
    // unconditionally, and grantsSelfKeywordDuringOwnTurn implements the
    // real restriction (checked at the same declareBlockers call site as
    // the "other Knights" anthem half, which is deferred - see
    // ardyn-the-usurper for why).
    excludeSelfKeywords: ['flying'],
    grantsSelfKeywordDuringOwnTurn: 'flying',
    abilities: [
      {
        id: 'dion-transform',
        label: 'Transform',
        cost: { manaLabel: '{4}{W}{W}', tap: true },
        exileAndReturnTransformed: true,
        onlyDuringOwnMainPhase: true,
        effectText: "Exile Dion, then return it to the battlefield transformed under its owner's control.",
      },
    ],
    imagePath: '/assets/cards/dion-bahamut-s-dominant.webp',
    transformsInto: 'bahamut-warden-of-light'
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
    transformsInto: 'dion-bahamut-dominant',
    saga: {
      chapters: [
        {
          numbers: [1, 2],
          effects: [{ type: 'buffOtherCreaturesYouControl', counterLabel: '+1/+1', counterAmount: 1, grantKeyword: 'flying' }],
        },
        {
          numbers: [3],
          effects: [{ type: 'destroyTarget', targetFilter: 'anyPermanent' }, { type: 'exileAndReturnTransformedSelf' }],
        },
      ],
    },
    imagePath: '/assets/cards/bahamut-warden-of-light.webp'
  },
  {
    id: 'dispatch',
    name: 'Dispatch',
    type: 'instant',
    costLabel: '{W}',
    text: 'Tap target creature.\n' +
      'Metalcraft — If you control three or more artifacts, exile that creature.\n' +
      '“I\u2019ll take the chopper! The bikes are all yours, Cloud!”\n' +
      '—Barret Wallace',
    imagePath: '/assets/cards/dispatch.webp',
    onCast: [{ type: 'tapTargetThenExileIfMetalcraft' }],
  },
  {
    id: "dragoons-lance",
    name: "Dragoon's Lance",
    type: 'artifact',
    subtype: 'equipment',
    costLabel: '{1}{W}',
    text: 'Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.)' +
      "\nEquipped creature gets +1/+0 and is a Knight in addition to its other types." +
      "\nDuring your turn, equipped creature has flying.\nGae Bolg — Equip 4",
    onEnter: [{ type: 'createToken', tokenId: 'token-hero', attachSelfToToken: true }],
    attachesTo: 'creature',
    equipCost: '{4}',
    equipBuff: { power: 1, toughness: 0 },
    equipGrantsKeywordDuringOwnTurn: 'flying',
    equipGrantsSubtype: 'Knight',
    imagePath: '/assets/cards/dragoon-s-lance.webp'
  },
  {
    id: 'dragoons-wyvern',
    name: "Dragoon's Wyvern",
    type: 'creature',
    costLabel: '{2}{U}',
    power: 2,
    toughness: 1,
    text: "Flying\n When this creature enters, create a 1/1 colorless Hero creature token.",
    onEnter: [{ type: 'createToken', tokenId: 'token-hero' }],
    imagePath: '/assets/cards/dragoon-s-wyvern.webp'
  },
  {
    id: 'dragonskull-summit',
    name: 'Dragon Summit',
    type: 'land',
    costLabel: '-',
    text: 'This land enters tapped unless you control a Swamp or a Mountain.\n' +
      '{T}: Add {B} or {R}.\n' +
      'Eight dragons seal away its awesome might; the might of the one called “Crusader.” And when the eight shall fall, the one again shall rise.',
    imagePath: '/assets/cards/dragonskull-summit.webp',
    entersTappedUnlessControlLandNames: ['Swamp', 'Mountain'],
    producesMana: ['B', 'R'],
  },
  {
    id: 'dreams-of-laguna',
    name: 'Dreams of Laguna',
    type: 'instant',
    costLabel: '{1}{U}',
    text: "Surveil 1, then draw a card. (To surveil 1, look at the top card of your library. You may put it into your graveyard.) " +
      "\nFlashback 3U (You may cast this card from your graveyard for its flashback cost. Then exile it.)",
    onCast: [{ type: 'surveil', count: 1, thenDrawCount: 1 }],
    flashback: { cost: '{3}{U}' },
    imagePath: '/assets/cards/dreams-of-laguna.webp'
  },
  {
    id:'drowned-catacomb',
    name:'Drowned Catacomb',
    type:'land',
    costLabel:'-',
    text:'This land enters tapped unless you control an Island or a Swamp.\n'+
    '{T}: Add {U} or {B}.\n'+
    '“The maze that surrounds the base of the tower is known as the \u2019Labyrinth of the Ancients.’”\n'+
    '—G\u2019raha Tia',
    imagePath:'/assets/cards/drowned-catacomb.webp',
    entersTappedUnlessControlLandNames: ['Island', 'Swamp'],
    producesMana: ['U', 'B'],
  },
  {
    id:'duelist-s-flame',
    name:'Duelist\u2019s Flame',
    type:'instant',
    costLabel:'{X}{R}{R}',
    text:'Until end of turn, target blocked creature you control gets +X/+0 and gains trample and “Whenever this creature deals combat damage to a player, look at that many cards from the top of your library. Exile up to one nonland card from among them and put the rest on the bottom of your library in a random order. You may cast the exiled card without paying its mana cost.”',
    imagePath:'/assets/cards/duelist-s-flame.webp'
  },
  {
    id: 'duskshell-crawler',
    name: 'Duskshell Crawler',
    type: 'creature',
    subtype: 'Creature Insect',
    costLabel: '{1}{G}',
    power: 0,
    toughness: 3,
    text: 'When this creature enters, put a +1/+1 counter on target creature.\n' +
      'Each creature you control with a +1/+1 counter on it has trample. (It can deal excess combat damage to the player or planeswalker it\u2019s attacking.)',
    imagePath: '/assets/cards/duskshell-crawler.webp',
    onEnter: [{ type: 'putCounterOnTarget', counterLabel: '+1/+1', counterAmount: 1 }],
    staticAnthemForCreaturesWithCounter: { counterLabel: '+1/+1', grantKeywords: ['trample'] },
  },
  {
    id: 'dwarven-castel-guard',
    name: 'Dwarven Castle Guard',
    type: 'creature',
    costLabel: '{1}{W}',
    power: 2,
    toughness: 1,
    text: "When this creature dies, create a 1/1 colorless Hero creature token.",
    onDeath: [{ type: 'createToken', tokenId: 'token-hero' }],
    imagePath: '/assets/cards/dwarven-castle-guard.webp'
  },
  {
    id:'edea-possessed-sorceress',
    name:'Edea, Possessed Sorceress',
    type:'creature',
    subtype:'Legendary Creature \u2014 Human Warlock',
    costLabel:'{2}{U}{B}{R}',
    power: 2,
    toughness: 5,
    text:'Ward {2}\n'+
    'At the beginning of combat on your turn, gain control of target creature an opponent controls until end of turn. Untap that creature. It gains haste until end of turn.\n'+
    'Whenever a creature you control but don\u2019t own dies, return it to the battlefield under its owner\u2019s control and you draw a card.',
    imagePath:'/assets/cards/edea-possessed-sorceress.webp',
    wardCost: { mana: '{2}' },
    onOwnCombatBegin: [{ type: 'gainControlOfTargetCreature', opponentControlledOnly: true, untap: true, grantKeywords: ['haste'] }],
    onAnyControlledButNotOwnedCreatureDiesReturnToOwnerAndDraw: true,
  },
  {
    id: 'eden-seat-of-the-sanctum',
    name: 'Eden, Seat of the Sanctum',
    type: 'land',
    costLabel: '-',
    text: "T: Add C.\n 5, T: Mill two cards. Then you may sacrifice this land. When you do, return another target permanent card from your graveyard to your hand.",
    imagePath: '/assets/cards/eden-seat-of-the-sanctum.webp',
    producesMana: 'C'
  },
  {
    id: 'edgar-king-of-figaro',
    name: 'Edgar, King of Figaro',
    type: 'creature',
    subtype: 'Legendary Creatures \u2014 Human Artificer Noble',
    costLabel: '{4}{U}{U}',
    power: 4,
    toughness: 5,
    text: "When Edgar enters, draw a card for each artifact you control. " +
      "Two-Headed Coin — The first time you flip one or more coins each turn, those coins come up heads and you win those flips.",
    onEnter: [{ type: 'drawCardsEqualToControlledTypeCount', cardType: 'artifact' }],
    imagePath: '/assets/cards/edgar-king-of-figaro.webp'
  },
  {
    id:'edgar-master-machinist',
    name:'Edgar, Master Machinist',
    type:'creature',
    subtype:'Legendary Creature — Human Artificer Noble',
    costLabel:'{2}{R}{W}',
    power: 2,
    toughness: 4,
    text:'Once during each of your turns, you may cast an artifact spell from your graveyard. If you cast a spell this way, that artifact enters tapped.\n'+
    'Tools — Whenever Edgar attacks, it gets +X/+0 until end of turn, where X is the greatest mana value among artifacts you control.',
    grantsOncePerTurnCastArtifactFromGraveyardEntersTapped: true,
    onAttack: [{ type: 'pumpSelfByGreatestControlledArtifactManaValue' }],
    imagePath:'/assets/cards/edgar-master-machinist.webp'
  },
  {
    id: 'eject',
    name: 'Eject',
    type: 'instant',
    costLabel: '{3}{U}',
    text: "This spell can\u2019t be countered.\n Return target nonland permanent to its owner\u2019s hand.\n Draw a card.",
    onCast: [{ type: 'bounceTarget', targetFilter: 'nonland' }, { type: 'loot', drawCount: 1, discardCount: 0 }],
    imagePath: '/assets/cards/eject.webp'
  },
  {
    id:'elena-turk-recruit',
    name:'Elena, Turk Recruit',
    type:'creature',
    subtype:'Legendary Creature — Human Assassin',
    costLabel:'{2}{W}',
    power: 1,
    toughness: 4,
    text:'When Elena enters, return target non-Assassin historic card from your graveyard to your hand. (Artifacts, legendaries, and Sagas are historic.)\n'+
    'Whenever you cast a historic spell, put a +1/+1 counter on Elena.\n'+
    '“Looks like talking alone won\u2019t cut it. You\u2019re going to have to feel some pain!”',
    onEnter: [{ type: 'returnTargetNonAssassinHistoricFromGraveyardToHand' }],
    onOwnCastHistoricSpellTrigger: [{ type: 'putCounterOnSelf', counterLabel: '+1/+1', counterAmount: 1 }],
    imagePath:'/assets/cards/elena-turk-recruit.webp'
  },
  {
    id: 'elixir',
    name: 'Elixir',
    type: 'artifact',
    costLabel: '{1}',
    text: "This artifact enters tapped.\n5, T, Exile this artifact: Shuffle all nonland cards from your graveyard into your library. " +
      "You gain life equal to the number of cards shuffled into your library this way.",
    imagePath: '/assets/cards/elixir.webp',
    entersTapped: true,
    abilities: [
      {
        id: 'elixir-shuffle',
        label: 'Shuffle',
        cost: { manaLabel: '{5}', tap: true, exileSelf: true },
        effects: [{ type: 'shuffleGraveyardIntoLibrary', filter: 'nonland' }],
        effectText: 'Shuffle all nonland cards from your graveyard into your library. You gain life equal to the number of cards shuffled in this way.',
      },
    ],
  },
  {
    id: 'emet-selch-of-the-third-seat',
    name: 'Emet-Selch of the Third Seat',
    type: 'creature',
    subtype: 'Legendary Creature — Elder Wizard',
    costLabel: '{2}{U}{B}',
    text: 'Spells you cast from your graveyard cost {2} less to cast.\n' +
      'Whenever one or more opponents lose life, you may cast target instant or sorcery card from your graveyard. If that spell would be put into your graveyard, exile it instead. Do this only once each turn.',
    imagePath: '/assets/cards/emet-selch-of-the-third-seat.webp',
    onOpponentLoseLifeMayCastFromGraveyardOncePerTurn: { discount: 2 },
  },
  {
    id: 'emet-selch-unsundered',
    name: "Emet\u2014Selch, Unsundered",
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Elder Wizard',
    costLabel: '{1}{U}{B}',
    power: 2,
    toughness: 4,
    text: "Vigilance \nWhenever Emet-Selch enters or attacks, draw a card, then discard a card.\n" +
      "At the beginning of your upkeep, if there are fourteen or more cards in your graveyard, you may transform Emet-Selch.",
    imagePath: '/assets/cards/emet-selch-unsundered.webp',
    transformsInto: 'hades-sorcerer-of-eld',
    onEnter: [{ type: 'loot', drawCount: 1, discardCount: 1 }],
    onAttack: [{ type: 'loot', drawCount: 1, discardCount: 1 }],
    abilities: [
      {
        id: 'transform',
        label: 'Transform into Hades',
        cost: {},
        onlyDuringOwnUpkeep: true,
        requiresGraveyardSize: 14,
        transformSelf: true,
        effectText: 'If there are fourteen or more cards in your graveyard, transform Emet-Selch into Hades, Sorcerer of Eld.',
      },
    ],
  },
  {
    id: 'endless-detour',
    name: 'Endless Detour',
    type: 'instant',
    costLabel: '{G}{W}{U}',
    text: 'The owner of target nonland permanent puts it on their choice of the top or bottom of their library.',
    imagePath: '/assets/cards/endless-detour.webp',
    onCast: [{ type: 'putTargetNonlandPermanentInLibraryOwnersChoice' }],
    // "Target spell" is deferred - this engine has no separate stack, so a
    // spell resolves immediately and there's never a window to target one.
    // "Card in a graveyard" is deferred too - it would need a genuine
    // "either a battlefield permanent OR a graveyard card" unified target
    // picker, which nothing else in this engine has.
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
    id:'endurance',
    name:'Magus Sisters',
    type:'creature',
    subtype:'Creature — Elemental Incarnation',
    costLabel:'{1}{G}{G}',
    power: 3,
    toughness: 4,
    text:'Flash\n'+
    'Reach\n'+
    'When this creature enters, up to one target player puts all the cards from their graveyard on the bottom of their library in a random order.\n'+
    'Evoke—Exile a green card from your hand.',
    imagePath:'/assets/cards/endurance.webp',
    onEnter: [{ type: 'graveyardToBottomOfLibraryForTargetPlayer' }],
    evokeCost: { exileColor: 'G' },
  },
  {
    id: 'esper-origins',
    name: 'Esper Origins',
    type: 'sorcery',
    costLabel: '{1}{G}',
    text: "Surveil 2. You gain 2 life. If this spell was cast from a graveyard, exile it, then put it onto the battlefield transformed under its owner\u2019s control " +
      "with a finality counter on it. (If a creature with a finality counter on it would die, exile it instead.)\nFlashback 3G",
    onCast: [{ type: 'surveil', count: 2 }, { type: 'gainLife', amount: 2 }],
    flashback: { cost: '{3}{G}' },
    imagePath: '/assets/cards/esper-origins.webp'
    // The "if cast from a graveyard, exile it, then put it onto the
    // battlefield transformed with a finality counter" clause is deferred -
    // no mechanism here turns a flashbacked SORCERY into a permanent
    // (flashback.effects only overrides onCast/onEnter, it doesn't change
    // the underlying spell type). Finality counters themselves now work
    // (see engine/combat.ts: moveCreaturesToGraveyard's toExileFromFinality)
    // once something can actually apply one to this card.
  },
  {
    id: 'espers-to-magicite',
    name: 'Espers to Magicite',
    type: 'instant',
    costLabel: '{3}{B}',
    text: 'Exile each opponent\u2019s graveyard. When you do, choose up to one target creature card exiled this way. Create a token that\u2019s a copy of that card, except it\u2019s an artifact and it loses all other card types.\n' +
      '“Come to me, my magicite pretty … come, and help me build the Magitek Empire of Kefka!”',
    imagePath: '/assets/cards/espers-to-magicite.webp',
    onCast: [{ type: 'exileEachOpponentGraveyardThenMayCopyExiledCreatureAsToken' }],
  },
  {
    id: 'estinien-varlineau',
    name: 'Estinien Varlineau',
    type: 'creature',
    subtype: 'Legendary Creature — Elf Warrior',
    costLabel: '{2}{W}{B}',
    power: 3,
    toughness: 3,
    text: 'Whenever you cast a noncreature spell, put a +1/+1 counter on Estinien Varlineau. It gains flying until end of turn.\n' +
      'At the beginning of your second main phase, you draw X cards and lose X life, where X is the number of your opponents who were dealt combat damage by Estinien Varlineau or a Dragon this turn.',
    imagePath: '/assets/cards/estinien-varlineau.webp',
    noncreatureCastTrigger: { effects: [{ type: 'putCounterOnSelf', counterLabel: '+1/+1', counterAmount: 1, alsoGrantTemporaryKeyword: 'flying' }] },
    // The second main-phase draw/life-loss clause is deferred - there's no
    // "was [this player] dealt combat damage by [this creature or subtype]
    // this turn" tracker in this engine (same missing-infrastructure class
    // as Fang, Fearless I'Cie's "cards left your graveyard" clause).
  },
  {
    id: 'ether',
    name: "Ether",
    type: 'artifact',
    costLabel: '{3}{U}',
    text: "Tap, Exile this artifact: Add {U}. When you next cast an instant or sorcery spell this turn, copy that spell. You may choose new targets for the copy.",
    imagePath: "/assets/cards/ether.webp"
  },
  {
    id: 'everflowing-chalice',
    name: 'Everflowing Chalice',
    type: 'artifact',
    costLabel: '{0}',
    text: 'Multikicker {2} (You may pay an additional {2} any number of times as you cast this spell.)\n' +
      'This artifact enters with a charge counter on it for each time it was kicked.\n' +
      '{T}: Add {C} for each charge counter on this artifact.',
    imagePath: '/assets/cards/everflowing-chalice.webp',
    multikickerCost: '{2}',
    onEnter: [{ type: 'putCounterOnSelf', counterLabel: 'charge', counterAmount: 'chosenX' }],
    producesMana: 'C',
    producesManaAmountEqualToOwnCounterLabel: 'charge',
  },
  {
    id: 'evil-reawakened',
    name: "Evil Reawakened",
    type: "sorcery",
    costLabel: '{4}{B}',
    text: "Return target creature card from your graveyard to the battlefield with two additional +1/+1 counters on it.",
    onCast: [{ type: 'reanimateTargetFromGraveyard', extraCounterLabel: '+1/+1', extraCounterAmount: 2 }],
    imagePath: "/assets/cards/evil-reawakened.webp"
  },
  {
    id: 'evolving-wilds',
    name: 'Evolving Wilds',
    type: 'land',
    costLabel: '-',
    text: '{T}, Sacrifice this land: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.',
    imagePath: '/assets/cards/evolving-wilds.webp',
    abilities: [
      {
        id: 'evolving-wilds-fetch',
        label: 'Fetch',
        cost: { tap: true, sacrificeSelf: true },
        effects: [{ type: 'searchLibraryForBasicLand', toBattlefieldTapped: true }],
        effectText: 'Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.',
      },
    ],
  },
  {
    id: "excalibur-ii",
    name: "Excalibur II",
    type: 'artifact',
    subtype: 'equipment',
    costLabel: '{1}',
    text: "Whenever you gain life, put a charge counter on Excalibur II.\nEquipped creature gets +1/+1 for each charge counter on Excalibur II.\nEquip 3",
    onGainLifeTrigger: { counterLabel: 'charge', counterAmount: 1 },
    attachesTo: 'creature',
    equipCost: '{3}',
    equipBuffPerCounter: { counterLabel: 'charge', power: 1, toughness: 1 },
    imagePath: "/assets/cards/excalibur-ii.webp"
  },
  {
    id: "exdeath-void-warlock",
    name: "Exdeath, Void Warlock",
    type: "creature",
    subtype: "Legendary Creature \u2014 Spirit Warlock",
    costLabel: '{1}{B}{G}',
    power: 3,
    toughness: 3,
    text: "When Exdeath enters, you gain 3 life.\nAt the beginning of your end step, if there are six or more permanent cards in your graveyard, transform Exdeath.",
    onEnter: [{ type: 'gainLife', amount: 3 }],
    onOwnEndStep: [{ type: 'transformSelfIfGraveyardSizeAtLeast', minGraveyardSize: 6 }],
    imagePath: "/assets/cards/exdeath-void-warlock.webp",
    transformsInto: "neo-exdeath-dimension-s-end"
  },
  {
    id: "neo-exdeath-dimension-s-end",
    name: "Neo Exdeath, Dimension's End",
    type: 'creature',
    costLabel: '-',
    power: 0,
    toughness: 3,
    text: "When Exdeath enters, you gain 3 life.\nAt the beginning of your end step, if there are six or more permanent cards in your graveyard, transform Exdeath.",
    onEnter: [{ type: 'gainLife', amount: 3 }],
    onOwnEndStep: [{ type: 'transformSelfIfGraveyardSizeAtLeast', minGraveyardSize: 6 }],
    imagePath: '/assets/cards/neo-exdeath-dimension-s-end.webp'
  },
  {
    id: 'exotic-orchard',
    name: 'Exotic Orchard',
    type: 'land',
    costLabel: '-',
    text: '{T}: Add one mana of any color that a land an opponent controls could produce.',
    imagePath: '/assets/cards/exotic-orchard.webp',
    producesMana: 'opponentLandColors',
  },
  {
    id: 'explorer-s-scope',
    name: 'Explorer\u2019s Scope',
    type: 'artifact',
    subtype: 'equipment artifact',
    costLabel: '{1}',
    text: 'Whenever equipped creature attacks, look at the top card of your library. If it\u2019s a land card, you may put it onto the battlefield tapped.\n' +
      'Equip {1} ({1}: Attach to target creature you control. Equip only as a sorcery.)',
    imagePath: '/assets/cards/explorer-s-scope.webp',
    equipGrantsOnAttack: [{ type: 'mayPutTopLandOntoBattlefieldTapped' }],
    equipCost: '{1}',
    attachesTo: 'creature',
  },
  {
    id:'exsanguinate',
    name:'Exsanguinate',
    type:'sorcery',
    costLabel:'{X}{B}{B}',
    text:'Each opponent loses X life. You gain life equal to the life lost this way.\n'+
    '“As the fight wore on, blood began to soak through his armor, spreading to every ilm of his body. But when it began to rise and envelop him as a mist, I realized it wasn’t blood, but something dark and twisted…”\n'+
    '—Ishgardian Citizen',
    onCast: [{ type: 'eachOpponentLosesLife', amount: 'chosenX', gainLifeEqualToLifeLost: true }],
    imagePath:'/assets/cards/exsanguinate.webp'
  },
  {
    id:'eye-of-nidhogg',
    name:'Eye of Nidhogg',
    costLabel:'{2}{B}',
    type:'enchantment',
    subtype:'Legendary Enchantment — Aura',
    text:'Enchant creature\n'+
    'Enchanted creature is a black Dragon with base power and toughness 4/2, has flying and deathtouch, and is goaded. (It attacks each combat if able and attacks a player other than you if able.)\n'+
    'When Eye of Nidhogg is put into a graveyard from the battlefield, return it to its owner\u2019s hand.',
    imagePath:'/assets/cards/eye-of-nidhogg.webp',
    attachesTo: 'creature',
    onEnter: [{ type: 'attachSelfToTarget' }],
    attachedSetsBasePowerToughness: { power: 4, toughness: 2 },
    equipGrantsKeyword: ['flying', 'deathtouch'],
    equipGrantsSubtype: 'Dragon',
    returnsSelfToHandOnDeath: true,
  },
  {
    id: 'fandaniel-telophoroi-ascian',
    name: 'Fandaniel, Telophoroi Ascian',
    type: 'creature',
    subtype: 'Legendary Creature — Elder Wizard',
    costLabel: '{4}{B}',
    text: 'Whenever you cast an instant or sorcery spell, surveil 1.\n' +
      'At the beginning of your end step, each opponent may sacrifice a nontoken creature of their choice. Each opponent who doesn\u2019t loses 2 life for each instant and sorcery card in your graveyard.',
    imagePath: '/assets/cards/fandaniel-telophoroi-ascian.webp',
    noncreatureCastTrigger: { surveilCount: 1, instantOrSorceryOnly: true },
    onOwnEndStep: [{ type: 'eachOpponentMaySacrificeNontokenCreatureElseLoseLifePerInstantSorcery', lifePerCard: 2 }],
  },
  {
    id: 'fang-fearless-l-cie',
    name: "Fang, Fearless I'Cie",
    type: 'creature',
    costLabel: '{2}{B}',
    subtype: 'Legendary Creature \u2014 Human Warrior',
    power: 2,
    toughness: 3,
    // Deferred - there's no generic "cards left this zone" event system here
    // (every graveyard-shrinking codepath - exile costs, reanimate, cast from
    // graveyard, flashback, shuffle-into-library, ...) is a separate direct
    // zone move, not routed through one place a watcher could hook.
    text: "Whenever one or more cards leave your graveyard, you draw a card and you lose 1 life. This ability triggers only once each turn.",
    imagePath: '/assets/cards/fang-fearless-l-cie.webp'
  },
  {
    id: 'fate-of-the-sun-cryst',
    name: "Fate of the Sun-Cryst",
    type: 'instant',
    costLabel: '{4}{W}',
    // The cost-reduction clause is deferred - this engine pays mana costs at
    // cast time, before pendingTarget is even set, so "costs less if it
    // targets X" has no target to check yet when the cost would be computed.
    text: 'This spell costs 2 less to cast if it targets a tapped creature.\nDestroy target nonland permanent.',
    imagePath: '/assets/cards/fate-of-the-sun-cryst.webp',
    onCast: [{ type: 'destroyTarget', targetFilter: 'nonlandPermanent' }],
  },
  {
    id:'fated-clash',
    name:'Fated Clash',
    type:'sorcery',
    costLabel:'{3}{W}{W}',
    text:'You may cast this spell as though it had flash if a creature is attacking and a creature is blocking.\n'+
    'Target creature you control and target creature an opponent controls each gain indestructible until end of turn. Then destroy all creatures.\n'+
    '“I\u2019ll show you who\u2019s the better man!”\n'+
    '—Seifer Almasy',
    imagePath:'/assets/cards/fated-clash.webp',
    onCast: [{ type: 'grantIndestructibleToOwnAndOpponentCreatureThenDestroyAll' }],
  },
  {
    id: 'fathom-mage',
    name: 'Fathom Mage',
    type: 'creature',
    subtype: 'Creature Human Wizard',
    costLabel: '{2}{G}{U}',
    power: 1,
    toughness: 1,
    text: 'Evolve (Whenever a creature you control enters, if that creature has greater power or toughness than this creature, put a +1/+1 counter on this creature.)\n' +
      'Whenever a +1/+1 counter is put on this creature, you may draw a card.',
    imagePath: '/assets/cards/fathom-mage.webp',
    evolve: true,
    onOwnCounterAddedTrigger: { counterLabel: '+1/+1', effects: [{ type: 'mayEffect', effects: [{ type: 'drawCards', amount: 1 }] }] },
  },
  {
    id: 'farseek',
    name: 'Farseek',
    type: 'sorcery',
    costLabel: '{1}{G}',
    text: 'Search your library for a Plains, Island, Swamp, or Mountain card, put it onto the battlefield tapped, then shuffle.',
    imagePath: '/assets/cards/farseek.webp',
    onCast: [{ type: 'searchLibraryForBasicLand', toBattlefieldTapped: true, excludeNames: ['Forest'] }],
  },
  {
    id: 'farewell',
    name: 'Farewell',
    type: 'sorcery',
    costLabel: '{4}{W}{W}',
    text: 'Choose one or more — \n' +
      '• Exile all artifacts. \n' +
      '• Exile all creatures. \n' +
      '• Exile all enchantments. \n' +
      '• Exile all graveyards. \n' +
      '“Stay with me until the end. Please.”',
    imagePath: '/assets/cards/farewell.webp',
    chooseModes: [
      { label: 'Exile all artifacts.', effects: [{ type: 'exileAll', targetFilter: 'artifact' }] },
      { label: 'Exile all creatures.', effects: [{ type: 'exileAll', targetFilter: 'creature' }] },
      { label: 'Exile all enchantments.', effects: [{ type: 'exileAll', targetFilter: 'enchantment' }] },
      { label: 'Exile all graveyards.', effects: [{ type: 'exileAllGraveyards' }] },
    ],
  },
  {
    id:'fatal-push',
    name:'Battle at the Bridge',
    type:'instant',
    costLabel:'{B}',
    text:'Destroy target creature if it has mana value 2 or less.\n'+
    'Revolt — Destroy that creature if it has mana value 4 or less instead if a permanent left the battlefield under your control this turn.',
    imagePath:'/assets/cards/fatal-push.webp',
    onCast: [{ type: 'destroyTarget', targetFilter: 'creatureWithManaValueAtMostRevolt', maxManaValue: 2, revoltManaValue: 4 }]
  },
  {
    id: 'fetid-heath',
    name: 'Fetid Heath',
    type: 'land',
    costLabel: '-',
    text: '{T}: Add {C}.\n' +
      '{W/B}, {T}: Add {W}{W}, {W}{B}, or {B}{B}.\n' +
      '“Nowhere… to… run… Nowhere… to… hide… No escape… for… you…”\n' +
      '—Ghosts on the Phantom Train',
    imagePath: '/assets/cards/fetid-heath.webp',
    producesMana: 'C',
    abilities: [
      {
        // Real printed cost is the hybrid symbol {W/B} (pay one W or one B) -
        // approximated as a flat {1} generic, same deviation already used
        // for Sunken Ruins' identical filter-land shape.
        id: 'fetid-heath-filter',
        label: 'Add two mana',
        cost: { manaLabel: '{1}', tap: true },
        effects: [
          {
            type: 'chooseOneMode',
            modes: [
              { label: 'Add {W}{W}', effects: [{ type: 'addMana', colors: { W: 2 } }] },
              { label: 'Add {W}{B}', effects: [{ type: 'addMana', colors: { W: 1, B: 1 } }] },
              { label: 'Add {B}{B}', effects: [{ type: 'addMana', colors: { B: 2 } }] },
            ],
          },
        ],
        effectText: 'Add {W}{W}, {W}{B}, or {B}{B}.',
      },
    ],
  },
  {
    id: "fight-on",
    name: "Fight On!",
    type: 'instant',
    costLabel: '{2}{B}',
    text: "Return up to two target creature cards from your graveyard to your hand.",
    onCast: [{ type: 'returnCreaturesFromGraveyardToHand', count: 2 }],
    imagePath: '/assets/cards/fight-on.webp'
  },
  {
    id: 'fight-rigging',
    name: 'Fight Rigging',
    type: 'enchantment',
    costLabel: '{2}{G}',
    text: 'Hideaway 5 (When this enchantment enters, look at the top five cards of your library, exile one face down, then put the rest on the bottom in a random order.)\n' +
      'At the beginning of combat on your turn, put a +1/+1 counter on target creature you control. Then if you control a creature with power 7 or greater, you may play the exiled card without paying its mana cost.',
    imagePath: '/assets/cards/fight-rigging.webp',
    onEnter: [{ type: 'hideaway', count: 5 }],
    onOwnCombatBegin: [{ type: 'putCounterOnTargetOwnCreatureThenMayPlayHideawayIfCreaturePowerAtLeast', counterLabel: '+1/+1', counterAmount: 1, minPower: 7 }],
  },
  {
    id:'final-judgment',
    name:'Final Judgment',
    costLabel:'{4}{W}{W}',
    type:'sorcery',
    text:'Exile all creatures.\n'+
    '“Let this be a lesson to all those who would walk the path of sin—the wicked shall not inherit this world!”\n'+
    '—Vauthry',
    imagePath:'/assets/cards/final-judgment.webp',
    onCast: [{ type: 'exileAll', targetFilter: 'creature' }],
  },
  {
    id:'fire-lit-thicket',
    name:'Fire-Lit Thicket',
    type:'land',
    costLabel:'-',
    text:'{T}: Add {C}.\n'+
    '{R/G}, {T}: Add {R}{R}, {R}{G}, or {G}{G}.\n'+
    '“Welcome to Wall Market, the pleasure capital of Midgar that\u2019s got everything for everybody!”\n'+
    '—Wall Market barker',
    imagePath:'/assets/cards/fire-lit-thicket.webp',
    producesMana: 'C',
    abilities: [
      {
        id: 'fire-lit-thicket-filter',
        label: 'Add two mana',
        cost: { manaLabel: '{1}', tap: true },
        effects: [
          {
            type: 'chooseOneMode',
            modes: [
              { label: 'Add {R}{R}', effects: [{ type: 'addMana', colors: { R: 2 } }] },
              { label: 'Add {R}{G}', effects: [{ type: 'addMana', colors: { R: 1, G: 1 } }] },
              { label: 'Add {G}{G}', effects: [{ type: 'addMana', colors: { G: 2 } }] },
            ],
          },
        ],
        effectText: 'Add {R}{R}, {R}{G}, or {G}{G}.',
      },
    ],
  },
  {
    id: 'fire-magic',
    name: "Fire Magic",
    type: 'instant',
    costLabel: '{R}',
    text: "Tiered (Choose one additional cost.) \n" +
      "• Fire — {0} — Fire Magic deals 1 damage to each creature. \n" +
      "• Fira — {2} — Fire Magic deals 2 damage to each creature. \n" +
      "• Firaga — {5} — Fire Magic deals 3 damage to each creature.",
    imagePath: '/assets/cards/fire-magic.webp',
    tieredModes: [
      { label: 'Fire — {0} — 1 damage to each creature', additionalCost: '{0}', effects: [{ type: 'damageEachCreature', amount: 1 }] },
      { label: 'Fira — {2} — 2 damage to each creature', additionalCost: '{2}', effects: [{ type: 'damageEachCreature', amount: 2 }] },
      { label: 'Firaga — {5} — 3 damage to each creature', additionalCost: '{5}', effects: [{ type: 'damageEachCreature', amount: 3 }] },
    ],
  },
  {
    id: 'firion-wild-rose-warrior',
    name: "Firion, Wild Rose Warrior",
    type: 'creature',
    subtype: "Legendary Creature \u2014 Human Rebel Warrior",
    costLabel: '{2}{R}',
    power: 3,
    toughness: 3,
    // Firion isn't unconditionally hasty himself (only while equipped) -
    // without this, "equipped creatures you control have haste" would
    // falsely self-apply via the plain substring keyword check even when
    // Firion has no Equipment attached.
    excludeSelfKeywords: ['haste'],
    text: "Equipped creatures you control have haste.\nWhenever a nontoken Equipment you control enters, create a token that\u2019s a copy of it, " +
      "except it has “This Equipment\u2019s equip abilities cost {2} less to activate.” Sacrifice that token at the beginning of the next upkeep.",
    // Deferred entirely - "equipped creatures you control have haste" is a
    // blanket static grant unrelated to any specific Equipment's own
    // equipGrantsKeyword, and the Equipment-copying clause needs a token
    // that dynamically copies another card's characteristics (with modified
    // text), which createToken (fixed pre-authored tokenIds only) can't do.
    imagePath: '/assets/cards/firion-wild-rose-warrior.webp'
  },
  {
    id:'fishing-gear',
    name:'Fishing Gear',
    type:'artifact',
    subtype:'Artifact \u2014 Equipment',
    costLabel:'{3}',
    text:'Whenever equipped creature deals combat damage to a player, exile the top card of that player\u2019s library. If it\u2019s a permanent card, you may put it onto the battlefield under your control. If you don\u2019t, create a 1/1 blue Fish creature token.\n'+
    'Equip {2}',
    imagePath:'/assets/cards/fishing-gear.webp',
    attachesTo: 'creature',
    equipCost: '{2}',
    equipGrantsExileTopOfDefenderLibraryMayPlayOrCreateFish: true,
  },
  {
    id:'flayer-of-the-hatebound',
    name:'Flayer of the Hatebound',
    type:'creature',
    subtype:'Creature — Devil',
    costLabel:'{5}{R}',
    power: 4,
    toughness: 2,
    text:'Undying (When this creature dies, if it had no +1/+1 counters on it, return it to the battlefield under its owner\u2019s control with a +1/+1 counter on it.)\n'+
    'Whenever this creature or another creature enters from your graveyard, that creature deals damage equal to its power to any target.',
    hasUndying: true,
    dealsDamageEqualToPowerWhenCreatureEntersFromGraveyard: true,
    imagePath:'/assets/cards/flayer-of-the-hatebound.webp'
  },
  {
    id:'flash-photography',
    name:'Flash Photography',
    type:'sorcery',
    costLabel:'{2}{U}{U}',
    text:'You may cast this spell as though it had flash if it targets a permanent you control.\n'+
    'Create a token that\u2019s a copy of target permanent.\n'+
    'Flashback {4}{U}{U}\n'+
    '“Gimme a pose I\u2019ll never forget!”',
    imagePath:'/assets/cards/flash-photography.webp',
    // The alternate-flash-timing condition ("if it targets a permanent you
    // control") is deferred - same category as every other conditional-flash
    // clause in this engine (timing nuance, not a mechanical effect).
    onCast: [{ type: 'createTokenCopyOfTarget', anyPermanent: true }],
    flashback: { cost: '{4}{U}{U}' },
  },
  {
    id: 'flooded-grove',
    name: 'Flooded Grove',
    type: 'land',
    costLabel: '-',
    text: '{T}: Add {C}.\n' +
      '{G/U}, {T}: Add {G}{G}, {G}{U}, or {U}{U}.',
    imagePath: '/assets/cards/flooded-grove.webp',
    producesMana: 'C',
    // The filter ability ({G/U}, T: Add two mana in one of three color
    // combos) is deferred, same reasoning as Starting Town's own deferred
    // alternate mana ability - parseCostLabel has no concept of a hybrid
    // mana symbol like {G/U} at all (it would just be silently ignored, same
    // as any other unrecognized symbol), and "add TWO mana in a chosen
    // combination" doesn't fit producesMana's model either (that always
    // produces exactly one mana of a chosen color, never a pair). Both would
    // need real new infrastructure, not just a new CardDefinition field.
  },
  {
    id: 'foreboding-ruins',
    name: 'Foreboding Ruins',
    type: 'land',
    costLabel: '-',
    text: 'As this land enters, you may reveal a Swamp or Mountain card from your hand. If you don\u2019t, this land enters tapped.\n' +
      '{T}: Add {B} or {R}.\n' +
      '"They were storing an awful lot of flame rods in there…"\n' +
      '—Thamasa elder',
    imagePath: '/assets/cards/foreboding-ruins.webp',
    producesMana: ['B', 'R'],
    entersTappedUnlessRevealLandNames: ['Swamp', 'Mountain'],
  },
  {
    id: 'forge-of-heroes',
    name: 'Forge of Heroes',
    type: 'land',
    costLabel: '-',
    text: '{T}: Add {C}. \n' +
      '{T}: Choose target commander that entered this turn. Put a +1/+1 counter on it if it\u2019s a creature ' +
      'and a loyalty counter on it if it\u2019s a planeswalker.',
    imagePath: '/assets/cards/forge-of-heroes.webp',
    producesMana: 'C',
    // The "loyalty counter if it's a planeswalker" half of the second
    // ability can never actually apply - this engine has no planeswalker
    // CardType at all, and only a creature can ever be a commanderDefId - so
    // putCounterOnTargetCommanderEnteredThisTurn always puts a +1/+1 counter,
    // no branching needed. This is a real activated ability (cost.tap),
    // mutually exclusive with the plain {T}: Add {C} mana ability above
    // since both share the same tapped flag - activating one uses up the
    // land's tap for the turn, just like real Magic.
    abilities: [
      {
        id: 'counter-commander-entered-this-turn',
        label: 'Put a counter on target commander that entered this turn',
        cost: { tap: true },
        effects: [{ type: 'putCounterOnTargetCommanderEnteredThisTurn', counterLabel: '+1/+1', counterAmount: 1 }],
        effectText: 'Choose target commander that entered this turn. Put a +1/+1 counter on it.',
      },
    ],
  },
  {
    id: 'forgotten-ancient',
    name: 'Forgotten Ancient',
    type: 'creature',
    subtype: 'Creature Elemental',
    costLabel: '{3}{G}',
    power: 0,
    toughness: 3,
    text: 'Whenever a player casts a spell, you may put a +1/+1 counter on this creature.\n' +
      'At the beginning of your upkeep, you may move any number of +1/+1 counters from this creature onto other creatures.\n' +
      '“Find your peace on the Farplane. Leave Spira to the living.”\n' +
      '—Auron',
    imagePath: '/assets/cards/forgotten-ancient.webp',
    onAnyPlayerCastsSpellTrigger: [{ type: 'mayEffect', effects: [{ type: 'putCounterOnSelf', counterLabel: '+1/+1', counterAmount: 1 }] }],
    onOwnUpkeep: [{ type: 'mayMoveAllCountersToTargetCreature', counterLabel: '+1/+1' }],
  },
  {
    id: 'fortified-village',
    name: 'Fortified Village',
    type: 'land',
    costLabel: '-',
    text: 'As this land enters, you may reveal a Forest or Plains card from your hand. If you don’t, ' +
      'this land enters tapped. \n{T}: Add {G} or {W}.',
    imagePath: '/assets/cards/fortified-village.webp',
    producesMana: ['G', 'W'],
    entersTappedUnlessRevealLandNames: ['Forest', 'Plains'],
  },
  {
    id: "forest",
    name: "Forest",
    type: "land",
    costLabel: "-",
    text: "(T: Add G.)",
    imagePath: '/assets/cards/forest.webp',
    producesMana: 'G'
  },
  {
    id: "freya-crescent",
    name: "Freya Crescent",
    type: "creature",
    subtype: 'Legendary Creature \u2014 Rat Knight',
    costLabel: '{R}',
    power: 1,
    toughness: 1,
    text: "Jump — During your turn, Freya Crescent has flying.\nT: Add R. Spend this mana only to cast an Equipment spell or activate an equip ability",
    grantsSelfKeywordDuringOwnTurn: 'flying',
    imagePath: '/assets/cards/freya-crescent.webp'
  },
  {
    id: 'from-father-to-son',
    name: 'From Father to Son',
    type: 'sorcery',
    costLabel: '{1}{W}',
    text: "Search your library for a Vehicle card, reveal it, and put it into your hand. If this spell was cast from a graveyard, put that card onto the battlefield instead. " +
      "Then shuffle. \nFlashback 4WWW",
    imagePath: '/assets/cards/from-father-to-son.webp',
    onCast: [{ type: 'searchLibraryForSubtype', subtype: 'Vehicle' }],
    flashback: { cost: '{4}{W}{W}{W}', effects: [{ type: 'searchLibraryForSubtype', subtype: 'Vehicle', toBattlefieldUntapped: true }] },
  },
  {
    id: 'furious-rise',
    name: 'Furious Rise',
    type: 'enchantment',
    costLabel: '{2}{R}',
    text: 'At the beginning of your end step, if you control a creature with power 4 or greater, exile the top card of your library. You may play that card until you exile another card with this enchantment.\n' +
      '“You guys are worthless, but my proud creation is a sure thing!”',
    imagePath: '/assets/cards/furious-rise.webp',
    onOwnEndStep: [{ type: 'exileTopOfLibraryPlayableUntilAnotherExiledWithSourceIfControlCreaturePowerAtLeast', minPower: 4 }],
  },
  {
    id:'fury',
    name:'Ifrit',
    type:'creature',
    subtype:'Creature — Elemental Incarnation',
    costLabel:'{3}{R}{R}',
    power: 3,
    toughness: 3,
    text:'Double strike\n'+
    'When this creature enters, it deals 4 damage divided as you choose among any number of target creatures and/or planeswalkers.\n'+
    'Evoke—Exile a red card from your hand.',
    imagePath:'/assets/cards/fury.webp',
    onEnter: [{ type: 'divideDamageAmongChosenTargets', totalDamage: 4 }],
    evokeCost: { exileColor: 'R' },
  },
  {
    id: 'furycalm-snarl',
    name: 'Furycalm Snarl',
    type: 'land',
    costLabel: '-',
    text: 'As this land enters, you may reveal a Mountain or Plains card from your hand. If you don\u2019t, this land enters tapped.\n' +
      '{T}: Add {R} or {W}.\n' +
      '"It sure helped having Cid here. I had no idea he could drive a train…"\n' +
      '—Red XIII',
    imagePath: '/assets/cards/furycalm-snarl.webp',
    producesMana: ['R', 'W'],
    entersTappedUnlessRevealLandNames: ['Mountain', 'Plains'],
  },
  {
    id: 'g-raha-tia-scion-reborn',
    name: 'G\u2019raha Tia, Scion Reborn',
    type: 'creature',
    subtype: 'Legendary Creature — Cat Wizard',
    costLabel: '{W}{U}{B}',
    power: 2,
    toughness: 3,
    text: 'Lifelink\n' +
      'Throw Wide the Gates — Whenever you cast a noncreature spell, you may pay X life, where X is that spell\u2019s mana value. If you do, create a 1/1 colorless Hero creature token and put X +1/+1 counters on it. Do this only once each turn.',
    imagePath: '/assets/cards/g-raha-tia-scion-reborn.webp',
    noncreatureCastTrigger: { mayPayLifeEqualToManaSpentCreateHeroTokenOncePerTurn: true },
  },
  {
    id: "gaelicat",
    name: 'Gaelicat',
    type: 'creature',
    costLabel: '{2}{W}',
    power: 1,
    toughness: 3,
    text: "Flying, vigilance \nAs long as you control two or more artifacts, this creature gets +2/+0.",
    controlledTypeCountBuff: { type: 'artifact', minCount: 2, power: 2, toughness: 0 },
    imagePath: '/assets/cards/gaelicat.webp'
  },
  {
    id: "gaius-van-baelsar",
    name: "Gaius van Baelsar",
    type: 'creature',
    subtype: "Legendary Creature \u2014 Human Soldier",
    costLabel: '{2}{B}{B}',
    power: 3,
    toughness: 2,
    text: "When Gaius van Baelsar enters, choose one — " +
      "\n• Each player sacrifices a creature token of their choice. " +
      "\n• Each player sacrifices a nontoken creature of their choice. " +
      "\n• Each player sacrifices an enchantment of their choice.",
    onEnter: [
      {
        type: 'chooseOneMode',
        modes: [
          { label: 'Each player sacrifices a creature token of their choice.', effects: [{ type: 'eachPlayerSacrifices', filter: 'creatureToken' }] },
          { label: 'Each player sacrifices a nontoken creature of their choice.', effects: [{ type: 'eachPlayerSacrifices', filter: 'nontokenCreature' }] },
          { label: 'Each player sacrifices an enchantment of their choice.', effects: [{ type: 'eachPlayerSacrifices', filter: 'enchantment' }] },
        ],
      },
    ],
    imagePath: '/assets/cards/gaius-van-baelsar.webp'
  },
  {
    id: "galuf-s-final-act",
    name: "Galuf's Final Act",
    type: 'instant',
    costLabel: '{1}{G}',
    text: 'Until end of turn, target creature gets +1/+0 and gains “When this creature dies, put a number of +1/+1 counters equal to its power on up to one target creature.”',
    imagePath: '/assets/cards/galuf-s-final-act.webp',
    onCast: [{ type: 'pumpTarget', power: 1, toughness: 0, grantsTemporaryOnDeathPutCountersEqualToPower: true }],
  },
  {
    id: 'game-trail',
    name: 'Game Trail',
    type: 'land',
    costLabel: '-',
    text: 'As this land enters, you may reveal a Mountain or Forest card from your hand. If you don’t, this land enters tapped.\n' +
      '{T}: Add {R} or {G}.\n' +
      'Many attractions await you here at the Gold Saucer. You will be moved and excited, thrilled and terrified!',
    imagePath: '/assets/cards/game-trail.webp',
    producesMana: ['R', 'G'],
    entersTappedUnlessRevealLandNames: ['Mountain', 'Forest'],
  },
  {
    id: 'garland-knight-of-cornelia',
    name: "Garland, Knight of Cornelia",
    type: "creature",
    subtype: 'Legendary Creature \u2014 Human Knight',
    costLabel: '{B}{R}',
    power: 3,
    toughness: 2,
    text: "Whenever you cast a noncreature spell, surveil 1. (Look at the top card of your library. You may put it into your graveyard.)" +
      "\n3BBRR: Return this card from your graveyard to the battlefield transformed. Activate only as a sorcery.",
    noncreatureCastTrigger: { surveilCount: 1 },
    abilities: [
      {
        id: 'garland-return-transformed',
        label: 'Return Transformed',
        cost: { manaLabel: '{3}{B}{B}{R}{R}' },
        returnFromGraveyardTransformed: true,
        onlyDuringOwnMainPhase: true,
        effectText: 'Return this card from your graveyard to the battlefield transformed.',
      },
    ],
    imagePath: '/assets/cards/garland-knight-of-cornelia.webp',
    transformsInto: 'chaos-the-endless'
  },
  {
    id: 'chaos-the-endless',
    name: 'Chaos, the Endless',
    type: 'creature',
    costLabel: '-',
    power: 5,
    toughness: 5,
    text: "Flying \nWhen Chaos dies, put it on the bottom of its owner\u2019s library.",
    onDeath: [{ type: 'putSelfOnBottomOfLibrary' }],
    imagePath: '/assets/cards/chaos-the-endless.webp'
  },
  {
    id: 'garnet-princess-of-alexandria',
    name: 'Garnet, Princess of Alexandria',
    type: 'creature',
    subtype: ' Legendary Creature \u2014 Human Noble Cleric',
    costLabel: '{G}{W}',
    power: 2,
    toughness: 2,
    // Lifelink works automatically (keyword text). The "remove a lore
    // counter from each of any number of Sagas" clause is deferred - it's an
    // open-ended "choose any number from many" multi-select, a shape no
    // existing targeting/choice flow here supports (they're all "exactly
    // one" or "up to one").
    text: "Lifelink \n Whenever Garnet attacks, you may remove a lore counter from each of any number of Sagas you control. " +
      "Put a +1/+1 counter on Garnet for each lore counter removed this way.",
    imagePath: '/assets/cards/garnet-princess-of-alexandria.webp'
  },
  {
    id: 'gatta-and-luzzu',
    name: 'Gatta and Luzzu',
    type: 'creature',
    subtype: 'Legendary Creature Human Soldier',
    costLabel: '{2}{W}',
    power: 1,
    toughness: 1,
    // "If damage would be dealt to that creature this turn" is scoped down to
    // COMBAT damage only - engine/combat.ts: markDamage is the one real choke
    // point for damage in this engine; non-combat/spell damage is marked
    // damageMarked directly at many scattered call sites with no shared
    // funnel, far more than this one card's clause justifies covering.
    text: 'Flash\n' +
      'When Gatta and Luzzu enters, choose target creature you control. If damage would be dealt to that creature this turn, prevent that damage and put that many +1/+1 counters on it.',
    imagePath: '/assets/cards/gatta-and-luzzu.webp',
    onEnter: [{ type: 'grantPreventCombatDamageConvertToCounterToTargetOwnCreature', counterLabel: '+1/+1' }],
  },
  {
    id:'garland-royal-kidnapper',
    name:'Garland, Royal Kidnapper',
    type:'creature',
    subtype:'Legendary Creature \u2014 Human Knight',
    costLabel:'{2}{U}{B}',
    power: 3,
    toughness: 4,
    text:'When Garland enters, target opponent becomes the monarch.\n'+
    'Whenever an opponent becomes the monarch, gain control of target creature that player controls for as long as they’re the monarch.\n'+
    'Creatures you control but don\u2019t own get +2/+2 and can\u2019t be sacrificed.',
    imagePath:'/assets/cards/garland-royal-kidnapper.webp',
    onEnter: [{ type: 'targetOpponentBecomesMonarch' }],
    staticAnthemForControlledButNotOwnedCreatures: { power: 2, toughness: 2 },
    // The "whenever an opponent becomes the monarch, gain control of
    // target creature that player controls for as long as they're the
    // monarch" clause is deferred - no mechanism ties a control change's
    // duration to the monarchy persisting (see
    // TargetOpponentBecomesMonarchEffect's own doc comment).
  },
  {
    id: 'gau-feral-youth',
    name: 'Gau, Feral Youth',
    type: 'creature',
    subtype: 'Legendary Creature — Human Berserker',
    costLabel: '{1}{R}',
    power: 2,
    toughness: 2,
    text: 'Rage — Whenever Gau attacks, put a +1/+1 counter on it.\n' +
      'At the beginning of each end step, if a card left your graveyard this turn, Gau deals damage equal to its power to each opponent.\n' +
      '“Uwao! Aooh! I’m Gau! Your friend! Frieeend!!!”',
    imagePath: '/assets/cards/gau-feral-youth.webp',
    onAttack: [{ type: 'putCounterOnSelf', counterLabel: '+1/+1', counterAmount: 1 }],
    // The end-step damage clause is deferred - it depends on "a card left
    // your graveyard this turn", which has no tracking mechanism in this
    // engine (same documented gap as Fang, Fearless I'Cie's near-identical
    // clause nearby).
  },
  {
    id: 'general-leo-cristophe',
    name: 'General Leo Christophe',
    type: 'creature',
    subtype: 'Legendary Creature Human Soldier',
    costLabel: '{4}{W}',
    power: 2,
    toughness: 2,
    text: 'When General Leo Cristophe enters, return up to one target creature card with mana value 3 or less from your graveyard to the battlefield. Then put a +1/+1 counter on General Leo Cristophe for each creature you control.\n' +
      '“You\nre a human being before you\nre a soldier.”',
    imagePath: '/assets/cards/general-leo-cristophe.webp',
    onEnter: [
      { type: 'reanimateTargetFromGraveyard', maxManaValue: 3, optional: true, thenPutCounterOnSourceEqualToControlledCreatureCount: { counterLabel: '+1/+1' } },
    ],
  },
  {
    id: 'generous-patron',
    name: 'Generous Patron',
    type: 'creature',
    subtype: 'Creature Elf Advisor',
    costLabel: '{2}{G}',
    power: 1,
    toughness: 4,
    text: 'When this creature enters, support 2. (Put a +1/+1 counter on each of up to two other target creatures.)\n' +
      'Whenever you put one or more counters on a creature you don’t control, draw a card.\n' +
      '“Look at the crowd, folks!”\n' +
      '—Blitzball announcer',
    imagePath: '/assets/cards/generous-patron.webp',
    onEnter: [{ type: 'support', counterLabel: '+1/+1', counterAmount: 1, count: 2, excludeSelf: true }],
    onOwnCounterPlacedOnOpponentCreatureTrigger: [{ type: 'drawCards', amount: 1 }],
  },
  {
    id: 'genji-glove',
    name: 'Genji Glove',
    costLabel: '{5}',
    type: 'artifact',
    subtype: 'equipment',
    text: "Equipped creature has double strike. \n" +
      "Whenever equipped creature attacks, if it\u2019s the first combat phase of the turn, untap it. After this phase, there is an additional combat phase. " +
      "Equip 3",
    attachesTo: 'creature',
    equipCost: '{3}',
    equipGrantsKeyword: 'double strike',
    equipGrantsOnAttack: [{ type: 'untapSelfIfFirstCombatPhaseOfTurn' }, { type: 'queueExtraCombatPhaseIfFirstCombatPhaseOfTurn' }],
    imagePath: '/assets/cards/genji-glove.webp'
  },
  {
    id: 'geothermal-bog',
    name: 'Geothermal Bog',
    costLabel: '-',
    type: 'land',
    text: '({T}: Add {B} or {R}.)\n' +
      'This land enters tapped.\n' +
      '“Legend has it that the Phoenix turned itself to stone ages ago… It seems the story was true.”\n' +
      '—Locke Cole',
    imagePath: '/assets/cards/geothermal-bog.webp',
    entersTapped: true,
    producesMana: ['B', 'R'],
  },
  {
    id: 'gigantoad',
    name: "Gigantoad",
    costLabel: '{3}{G}',
    type: 'creature',
    subtype: 'Frog',
    power: 4,
    toughness: 4,
    text: "As long as you control seven or more lands, this creature gets +2/+2.",
    landCountBuff: { minLands: 7, power: 2, toughness: 2 },
    imagePath: '/assets/cards/gigantoad.webp'
  },
  {
    id: "gilgamesh-master-at-arms",
    name: "Gilgamesh, Master-at-Arms",
    costLabel: '{4}{R}{R}',
    type: 'creature',
    power: 6,
    toughness: 6,
    // Deferred entirely - "put any number of Equipment cards from among them
    // onto the battlefield" is an open-ended choose-any-number-from-many
    // reveal, well beyond the existing fixed-single-pick reveal/search flows.
    text: "Whenever Gilgamesh enters or attacks, look at the top six cards of your library. \n" +
      "You may put any number of Equipment cards from among them onto the battlefield. Put the rest on the bottom of your library \n" +
      "in a random order. When you put one or more Equipment onto the battlefield this way, you may attach one of them to a Samurai you control.",
    imagePath: '/assets/cards/gilgamesh-master-at-arms.webp'
  },
  {
    id: "giott-king-of-the-dwarves",
    name: "Giott, King of the Dwarves",
    costLabel: '{R}{W}',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Dwarf Noble',
    power: 1,
    toughness: 1,
    // Double strike works automatically (keyword text).
    text: "Double strike \n " +
      "Whenever Giott or another Dwarf you control enters and whenever an Equipment you control enters, you may discard a card. If you do, draw a card.",
    onAnyControlledSubtypeEnterTrigger: { subtypes: ['Dwarf', 'Equipment'], effects: [{ type: 'discardUpToThenDrawThatMany', maxCount: 1 }] },
    imagePath: '/assets/cards/giott-king-of-the-dwarves.webp'
  },
  {
    id: 'gladiolus-amicitia',
    name: "Gladiolus Amicita",
    costLabel: '{4}{R}{G}',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Warrior',
    power: 6,
    toughness: 6,
    // The ETB search clause is deferred - "search for A land card" (any of
    // several, controller's choice, onto the battlefield) is the same
    // open-ended multi-card-search gap noted on Ignis Scientia; unlike
    // SearchLibraryForLandEffect (fixed single land name, to hand).
    // Gladiolus himself never gets trample (only "another target creature"
    // does) - without this, the landfall clause would falsely self-apply
    // trample via the plain substring keyword check.
    excludeSelfKeywords: ['trample'],
    text: "When Gladiolus Amicitia enters, search your library for a land card, put it onto the battlefield tapped, then shuffle. \n" +
      "Landfall — Whenever a land you control enters, another target creature you control gets +2/+2 and gains trample until end of turn.",
    imagePath: '/assets/cards/gladiolus-amicitia.webp',
    landfall: { pumpAnotherControlledCreature: { power: 2, toughness: 2, grantKeyword: 'trample' } },
  },
  {
    id: 'glacial-fortress',
    name: 'Glacial Fortress',
    type: 'land',
    costLabel: '-',
    text: 'This land enters tapped unless you control a Plains or an Island.\n' +
      '{T}: Add {W} or {U}.',
    imagePath: '/assets/cards/glacial-fortress.webp',
    entersTappedUnlessControlLandNames: ['Plains', 'Island'],
    producesMana: ['W', 'U'],
  },
  {
    id:'godo-bandit-warlord',
    name:'Gilgamesh, Weapon Collector',
    costLabel:'{5}{R}',
    type:'creature',
    subtype:'Legendary Creature — Human Barbarian',
    power: 3,
    toughness: 3,
    text:'When Gilgamesh enters, you may search your library for an Equipment card, put it onto the battlefield, then shuffle.\n'+
    'Whenever Gilgamesh attacks for the first time each turn, untap it and all Samurai you control. After this phase, there is an additional combat phase.',
    imagePath:'/assets/cards/godo-bandit-warlord.webp',
    onEnter: [{ type: 'searchLibraryForSubtype', subtype: 'Equipment', toBattlefieldUntapped: true }],
    onAttack: [{ type: 'untapSelfIfFirstCombatPhaseOfTurn', alsoUntapControlledSubtype: 'Samurai' }, { type: 'queueExtraCombatPhaseIfFirstCombatPhaseOfTurn' }]
  },
  {
    id: "gogo-master-of-mimicry",
    name: "Gogo, Master of Mimicry",
    costLabel: '{2}{U}',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Wizard',
    power: 2,
    toughness: 4,
    // Deferred entirely - ability-copying has no supporting mechanism
    // anywhere in this engine (activated/triggered abilities just resolve
    // and vanish; there's nothing to hold a reference to for a copy to
    // re-run, with or without new targets).
    text: "XX Tap:Copy target activated or triggered ability you control X times. You may choose new targets for the copies. " +
      "This ability can\u2019t be copied and X can\u2019t be 0. (Mana abilities can\u2019t be targeted.)",
    imagePath: '/assets/cards/gogo-master-of-mimicry.webp'
  },
  {
    id: 'gogo-mysterious-mime',
    name: 'Gogo, Mysterious Mime',
    costLabel: '{3}{R}',
    type: 'creature',
    subtype: 'Legendary Creature Wizard',
    power: 2,
    toughness: 2,
    text: 'At the beginning of combat on your turn, you may have Gogo become a copy of another target creature you control until end of turn, except its name is Gogo, Mysterious Mime. If you do, Gogo and that creature each get +2/+0 and gain haste until end of turn and attack this turn if able.',
    imagePath: '/assets/cards/gogo-mysterious-mime.webp',
    onOwnCombatBegin: [{ type: 'mayBecomeCopyOfAnotherControlledCreatureThenBuffBoth', power: 2, toughness: 0, grantKeyword: 'haste' }],
  },
  {
    id: 'gohn-town-of-ruin',
    name: "Gohn, Town of Ruin",
    costLabel: '-',
    type: 'land',
    text: "This land enters tapped. Tap: Add B or G.",
    imagePath: '/assets/cards/gohn-town-of-ruin.webp',
    entersTapped: true,
    producesMana: ['B', 'G']
  },
  {
    id: 'golbez-crystal-collector',
    name: 'Golbez, Crystal Collector',
    costLabel: '{U}{B}',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Wizard',
    power: 1,
    toughness: 4,
    text: 'Whenever an artifact you control enters, surveil 1. \n' +
      "At the beginning of your end step, if you control four or more artifacts, return target creature card from your graveyard to your hand. " +
      'Then if you control eight or more artifacts, each opponent loses life equal to that card\u2019s power.',
    onAnyArtifactEnterTrigger: [{ type: 'surveil', count: 1 }],
    imagePath: '/assets/cards/golbez-crystal-collector.webp'
  },
  {
    id: 'gongaga-reactor-town',
    name: 'Gongaga, Reactor Town',
    costLabel: '-',
    type: 'land',
    text: 'This land enters tapped. \nTap: Add R or G.',
    imagePath: '/assets/cards/gongaga-reactor-town.webp',
    entersTapped: true,
    producesMana: ['R', 'G']
  },
  {
    id: 'goobbue-gardener',
    name: 'Goobbue Gardener',
    costLabel: '{1}{G}',
    type: 'creature',
    power: 1,
    toughness: 3,
    text: 'Tap: Add G.',
    imagePath: '/assets/cards/goobbue-gardener.webp',
    producesMana: 'G'
  },
  {
    id: 'g-raha-tia',
    name: "G'raha Tia",
    costLabel: '{4}{W}',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Cat Archer',
    power: 3,
    toughness: 5,
    text: 'Reach \n The Allagan Eye — Whenever one or more other creatures and/or artifacts you control die, draw a card. This ability triggers only once each turn.',
    onAnyDeathDraw: true,
    imagePath: '/assets/cards/g-raha-tia.webp'
  },
  {
    id: 'gran-pulse-ochu',
    name: 'Gran Pulse Ochu',
    costLabel: '{G}',
    type: 'creature',
    power: 1,
    toughness: 1,
    text: 'Deathtouch \n8: Until end of turn, this creature gets +1/+1 for each permanent card in your graveyard.',
    abilities: [
      {
        id: 'gran-pulse-ochu-pump',
        label: 'Pump',
        cost: { manaLabel: '{8}' },
        effects: [{ type: 'pumpSelfByGraveyardCount', powerPerUnit: 1, toughnessPerUnit: 1 }],
        effectText: 'Until end of turn, this creature gets +1/+1 for each permanent card in your graveyard.',
      },
    ],
    imagePath: '/assets/cards/gran-pulse-ochu.webp'
  },
  {
    id: 'grateful-apparition',
    name: 'Grateful Apparition',
    type: 'creature',
    subtype: 'Creature Spirit',
    costLabel: '{1}{W}',
    power: 1,
    toughness: 1,
    text: 'Flying\n' +
      'Whenever this creature deals combat damage to a player or planeswalker, proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.)',
    imagePath: '/assets/cards/grateful-apparition.webp',
    onCombatDamageToPlayer: [{ type: 'proliferate' }],
  },
  {
    id: 'graven-cairns',
    name: 'Graven Cairns',
    type: 'land',
    costLabel: '-',
    text: '{T}: Add {C}.\n' +
      '{B/R}, {T}: Add {B}{B}, {B}{R}, or {R}{R}.\n' +
      '“At times we were friendly rivals, and at times we were simply friends. We’d always talk about our dreams… Like which of us would be first to sail beyond the sky to the stars.”\n' +
      '—Setzer Gabbiani',
    imagePath: '/assets/cards/graven-cairns.webp',
    producesMana: 'C',
    abilities: [
      {
        // Real printed cost is the hybrid symbol {B/R} (pay one B or one R) -
        // approximated as a flat {1} generic, same deviation already used
        // for Fetid Heath's identical filter-land shape.
        id: 'graven-cairns-filter',
        label: 'Add two mana',
        cost: { manaLabel: '{1}', tap: true },
        effects: [
          {
            type: 'chooseOneMode',
            modes: [
              { label: 'Add {B}{B}', effects: [{ type: 'addMana', colors: { B: 2 } }] },
              { label: 'Add {B}{R}', effects: [{ type: 'addMana', colors: { B: 1, R: 1 } }] },
              { label: 'Add {R}{R}', effects: [{ type: 'addMana', colors: { R: 2 } }] },
            ],
          },
        ],
        effectText: 'Add {B}{B}, {B}{R}, or {R}{R}.',
      },
    ],
  },
  {
    id:'grief',
    name:'Anima',
    costLabel:'{2}{B}{B}',
    type:'creature',
    subtype:'Creature — Elemental Incarnation',
    power: 3,
    toughness: 2,
    text:'Menace\n'+
    'When this creature enters, target opponent reveals their hand. You choose a nonland card from it. That player discards that card.\n'+
    'Evoke—Exile a black card from your hand.',
    imagePath:'/assets/cards/grief.webp',
    onEnter: [{ type: 'revealOpponentHandChooseNonlandCardThenDiscard' }],
    evokeCost: { exileColor: 'B' },
  },
  {
    id: 'guadosalam-farplane-gateway',
    name: 'Guadosalam, Farplane Gateway',
    costLabel: '-',
    type: 'land',
    text: 'This land enters tapped. \nTap: Add G or U.',
    imagePath: '/assets/cards/guadosalam-farplane-gateway.webp',
    entersTapped: true,
    producesMana: ['G', 'U']
  },
  {
    id: 'gyre-sage',
    name: 'Gyre Sage',
    type: 'creature',
    subtype: 'Creature Elf Druid',
    costLabel: '{1}{G}',
    power: 1,
    toughness: 2,
    text: 'Evolve (Whenever a creature you control enters, if that creature has greater power or toughness than this creature, put a +1/+1 counter on this creature.)\n' +
      '{T}: Add {G} for each +1/+1 counter on this creature.',
    imagePath: '/assets/cards/gyre-sage.webp',
    evolve: true,
    producesMana: 'G',
    producesManaAmountEqualToOwnCounterLabel: '+1/+1',
  },
  {
    id: 'gysahl-greens',
    name: 'Gysahl Greens',
    costLabel: '{1}{G}',
    type: 'sorcery',
    text: 'Create a 2/2 green Bird creature token with “Whenever a land you control enters, this token gets +1/+0 until end of turn.”' +
      "\nFlashback {6}",
    onCast: [{ type: 'createToken', tokenId: 'token-bird' }],
    flashback: { cost: '{6}' },
    imagePath: '/assets/cards/gysahl-greens.webp'
  },
  {
    id: 'haste-magic',
    name: 'Haste Magic',
    costLabel: '{1}{R}',
    type: 'instant',
    text: 'Target creature gets +3/+1 and gains haste until end of turn. Exile the top card of your library. You may play it until your next end step.',
    onCast: [{ type: 'pumpTarget', power: 3, toughness: 1, grantKeyword: 'haste' }],
    imagePath: '/assets/cards/haste-magic.webp'
  },
  {
    id: 'hardened-scales',
    name: 'Hardened Scales',
    type: 'enchantment',
    costLabel: '{G}',
    text: 'If one or more +1/+1 counters would be put on a creature you control, that many plus one +1/+1 counters are put on it instead.\n' +
      '“When it starts, I won’t be myself any more. I won’t be able to hold myself back.”\n' +
      '—Jecht',
    imagePath: '/assets/cards/hardened-scales.webp',
    increasesOwnCounterPlacementsByOne: '+1/+1',
  },
  {
    id: 'harmonize',
    name: 'Harmonize',
    type: 'sorcery',
    costLabel: '{2}{G}{G}',
    text: 'Draw three cards.\n' +
      '“Only the Ancients, only Aerith can save us from Meteor.”\n' +
      '—Cloud Strife',
    imagePath: '/assets/cards/harmonize.webp',
    onCast: [{ type: 'drawCards', amount: 3 }],
  },
  {
    id: 'hecteyes',
    name: 'Hecteyes',
    costLabel: '{1}{B}',
    type: 'creature',
    power: 1,
    toughness: 1,
    text: 'When this creature enters, each opponent discards a card.',
    onEnter: [{ type: 'eachOpponentDiscards', count: 1 }],
    imagePath: '/assets/cards/hecteyes.webp'
  },
  {
    id:'heidegger-shinra-executive',
    name:'Heidegger, Shinra Executive',
    costLabel:'{3}{W}',
    type:'creature',
    subtype:'Legendary Creature — Human Soldier',
    power: 3,
    toughness: 3,
    text:'At the beginning of combat on your turn, target creature you control gets +X/+0 until end of turn, where X is the number of Soldiers you control.\n'+
    'At the beginning of your end step, create a number of 1/1 white Soldier creature tokens equal to the number of opponents who control more creatures than you.',
    imagePath:'/assets/cards/heidegger-shinra-executive.webp',
    onOwnCombatBegin: [{ type: 'pumpTargetOwnCreatureByControlledSubtypeCount', subtype: 'Soldier' }],
    onOwnEndStep: [{ type: 'createTokenIfOpponentControlsMoreCreaturesThanYou', tokenId: 'token-soldier' }],
  },
  {
    id:'helitrooper',
    name:'Helitrooper',
    costLabel:'{1}{W}',
    type:'creature',
    subtype:'Creature — Human Soldier',
    power: 1,
    toughness: 2,
    text:'Flying\n'+
    'Whenever this creature attacks, another target attacking creature gains flying until end of turn.\n'+
    'Equip abilities you activate that target this creature cost {2} less to activate.',
    imagePath:'/assets/cards/helitrooper.webp',
    onAttack: [{ type: 'grantKeywordToAnotherTargetAttackingCreature', keyword: 'flying' }],
    reducesEquipCostWhenTargetingThis: 2,
  },
  {
    id: 'hellkite-tyrant',
    name: 'Hellkite Tyrant',
    costLabel: '{4}{R}{R}',
    type: 'creature',
    subtype: 'Creature — Dragon',
    power: 6,
    toughness: 5,
    text: 'Flying, trample\n' +
      'Whenever this creature deals combat damage to a player, gain control of all artifacts that player controls.\n' +
      'At the beginning of your upkeep, if you control twenty or more artifacts, you win the game.',
    imagePath: '/assets/cards/hellkite-tyrant.webp',
    onCombatDamageToPlayer: [{ type: 'gainControlOfAllArtifactsControlledByOpponent' }],
    onOwnUpkeep: [{ type: 'winGameIfControlAtLeastNOfType', count: 20, cardType: 'artifact' }],
  },
  {
    id:'herald-s-horn',
    name:'Herald\u2019s Horn',
    costLabel:'{3}',
    type:'artifact',
    text:'As this artifact enters, choose a creature type.\n'+
    'Creature spells you cast of the chosen type cost {1} less to cast.\n'+
    'At the beginning of your upkeep, look at the top card of your library. If it\u2019s a creature card of the chosen type, you may reveal it and put it into your hand.',
    imagePath:'/assets/cards/herald-s-horn.webp',
    onEnter: [{ type: 'chooseCreatureType' }],
    reducesCastCostForOwnChosenCreatureType: true,
    onOwnUpkeepLookTopForChosenCreatureTypeToHand: true,
  },
  {
    id: 'hermes-overseer-of-elpis',
    name: 'Hermes, Overseer of Elpis',
    costLabel: '{3}{U}',
    type: 'creature',
    subtype: 'Legendary Creature — Elder Wizard',
    power: 2,
    toughness: 4,
    text: 'Whenever you cast a noncreature spell, create a 1/1 blue Bird creature token with flying and vigilance.\n' +
      'Whenever you attack with one or more Birds, scry 2.\n' +
      '“For us, there may be no higher purpose than to live for our world, but what of the other living beings out there?”',
    imagePath: '/assets/cards/hermes-overseer-of-elpis.webp',
    noncreatureCastTrigger: { effects: [{ type: 'createToken', tokenId: 'token-bird-flying-vigilance' }] },
    onAttackWithSubtype: { subtype: 'Bird', effects: [{ type: 'surveil', count: 2 }] },
  },
  {
    id:'hero-s-blade',
    name:'Hero\u2019s Blade',
    costLabel:'{2}',
    type:'artifact',
    subtype:'Artifact — Equipment',
    text:'Equipped creature gets +3/+2.\n'+
    'Whenever a legendary creature you control enters, you may attach this Equipment to it.\n'+
    'Equip {4} ({4}: Attach to target creature you control. Equip only as a sorcery.)',
    attachesTo: 'creature',
    equipCost: '{4}',
    equipBuff: { power: 3, toughness: 2 },
    mayAttachSelfToControlledLegendaryCreatureOnEnter: true,
    imagePath:'/assets/cards/hero-s-blade.webp'
  },
  {
    id:'hero-s-heirloom',
    name:'Hero\u2019s Heirloom',
    costLabel:'{2}',
    type:'artifact',
    subtype:'Artifact — Equipment',
    text:'Equipped creature gets +2/+1.\n'+
    'As long as equipped creature is legendary, it has trample and haste.\n'+
    'Equip {2}',
    attachesTo: 'creature',
    equipCost: '{2}',
    equipBuff: { power: 2, toughness: 1 },
    equipGrantsKeywordIfEquippedLegendary: ['trample', 'haste'],
    imagePath:'/assets/cards/hero-s-heirloom.webp'
  },
  {
    id: 'hill-gigas',
    name: 'Hill Gigas',
    costLabel: '{4}{R}{R}',
    type: 'creature',
    power: 5,
    toughness: 4,
    text: 'Trample, haste \n' +
      'Mountaincycling 2(2, Discard this card: Search your library for a Mountain card, reveal it, put it into your hand, then shuffle.)',
    cycling: { cost: '{2}', searchLandName: 'Mountain' },
    imagePath: '/assets/cards/hill-gigas.webp'
  },
  {
    id: 'high-market',
    name: 'High Market',
    costLabel: '-',
    type: 'land',
    text: '{T}: Add {C}.\n' +
      '{T}, Sacrifice a creature: You gain 1 life.\n' +
      '“Pretty impressive that a kid like me can run a business, don’t ya think? You should buy something to encourage me!”\n' +
      '—Nikeah boy',
    imagePath: '/assets/cards/high-market.webp',
    producesMana: 'C',
    abilities: [
      {
        id: 'high-market-sac',
        label: 'Sacrifice a creature',
        cost: { tap: true, sacrificeAnother: 'creature' },
        effects: [{ type: 'gainLife', amount: 1 }],
        effectText: 'You gain 1 life.',
      },
    ],
  },
  {
    id:'hildibrand-manderville',
    name:'Hildibrand Manderville',
    costLabel:'{1}{W}',
    type:'creature',
    subtype:'Legendary Creature — Human Detective',
    power: 2,
    toughness: 2,
    text:'Creature tokens you control get +1/+1.\n'+
    'When Hildibrand Manderville dies, you may cast it from your graveyard as an Adventure until the end of your next turn.\n'+
    'Gentleman’s Rise {2}{B} \n' +
    'Instant — Adventure\n'+
    'Create a 2/2 black Zombie creature token. (Then exile this card. You may cast the creature later from exile.)',
    staticAnthemForControlledTokens: { power: 1, toughness: 1 },
    // Deferred: the "dies, may cast as an Adventure" trigger and the
    // Gentleman's Rise Adventure half - this engine has no Adventure-card
    // support yet. Revisit alongside the other monster/instant Adventure
    // cards (Hypnotic Sprite).
    imagePath:'/assets/cards/hildibrand-manderville.webp',
  },
  {
    id: 'hinterland-harbor',
    name: 'Hinterland Harbor',
    type: 'land',
    costLabel: '-',
    text: 'This land enters tapped unless you control a Forest or an Island.\n' +
      '{T}: Add {G} or {U}.\n' +
      '“The entire river glows, like a sea of stars.”\n' +
      '—Lulu',
    imagePath: '/assets/cards/hinterland-harbor.webp',
    entersTappedUnlessControlLandNames: ['Forest', 'Island'],
    producesMana: ['G', 'U'],
  },
  {
    id: 'hope-estheim',
    name: 'Hope Estheim',
    costLabel: '{W}{U}',
    type: 'creature',
    subtype: 'Legendary Creatue \u2014 Human Wizard',
    power: 2,
    toughness: 2,
    text: 'Lifelink \n' +
      'At the beginning of your end step, each opponent mills X cards, where X is the amount of life you gained this turn.',
    onOwnEndStep: [{ type: 'millOpponentByLifeGainedThisTurn' }],
    imagePath: '/assets/cards/hope-estheim.webp'
  },
  {
    id: 'hraesvelgr-of-the-first-brood',
    name: 'Hraesvelgr of the First Brood',
    costLabel: '{4}{U}',
    type: 'creature',
    subtype: 'Legendary Creature — Elder Dragon',
    power: 5,
    toughness: 5,
    text: 'Flying, vigilance, ward {2}\n' +
      'Shiva’s Aid — When Hraesvelgr enters and whenever you cast a noncreature spell, target creature gets +1/+0 until end of turn and can’t be blocked this turn.\n' +
      '“Never shall our grief be assuaged nor our loss forgotten.”',
    imagePath: '/assets/cards/hraesvelgr-of-the-first-brood.webp',
    wardCost: { mana: '{2}' },
    onEnter: [{ type: 'pumpTarget', power: 1, toughness: 0, grantKeyword: 'unblockable' }],
    noncreatureCastTrigger: { effects: [{ type: 'pumpTarget', power: 1, toughness: 0, grantKeyword: 'unblockable' }] },
  },
  {
    id:'hypnotic-sprite',
    name:'Hypnotic Sprite',
    costLabel:'{U}{U}',
    type:'creature',
    subtype:'Creature — Faerie',
    power: 2,
    toughness: 1,
    text:'Flying\n'+
    'Mesmeric Glare {2}{U}\n'+
    'Instant — Adventure\n'+
    'Counter target spell with mana value 3 or less. (Then exile this card. You may cast the creature later from exile.)',
    // Flying is auto-detected from the text above - zero new code needed.
    // Deferred: the Mesmeric Glare Adventure half (counter target spell with
    // mana value 3 or less) - this engine has no Adventure-card support yet.
    // Revisit alongside the other monster/instant Adventure cards
    // (Hildibrand Manderville).
    imagePath:'/assets/cards/hypnotic-sprite.webp'
  },
  {
    id: 'ice-flan',
    name: 'Ice Flan',
    costLabel: '{4}{U}{U}',
    type: 'creature',
    power: 5,
    toughness: 4,
    text: 'When this creature enters, tap target artifact or creature an opponent controls. Put a stun counter on it. ' +
      '(If a permanent with a stun counter would become untapped, remove one from it instead.)\n' +
      'Islandcycling 2 (2, Discard this card: Search your library for an Island card, reveal it, put it into your hand, then shuffle.)',
    onEnter: [{ type: 'tapAndStun', targetController: 'opponent', targetType: 'artifactOrCreature' }],
    cycling: { cost: '{2}', searchLandName: 'Island' },
    imagePath: '/assets/cards/ice-flan.webp'
  },
  {
    id: 'ice-magic',
    name: 'Ice Magic',
    costLabel: '{1}{U}',
    type: 'instant',
    text: 'Tiered (Choose one additional cost.) \n' +
      '• Blizzard — {0} — Return target creature to its owner\u2019s hand. \n' +
      '• Blizzara — {2} — Target creature\u2019s owner puts it on their choice of the top or bottom of their library. \n' +
      '• Blizzaga — {5}{U} — Target creature\u2019s owner shuffles it into their library.',
    imagePath: '/assets/cards/ice-magic.webp',
    tieredModes: [{ label: 'Blizzard — {0} — Return target creature to its owner’s hand', additionalCost: '{0}', effects: [{ type: 'bounceTarget', targetFilter: 'creature' }] }],
    // Blizzara ("owner puts it on their choice of top or bottom of
    // library") and Blizzaga ("owner shuffles it into their library") are
    // still deferred - both need a target creature's OWNER (not the
    // caster) to make a choice about it, which no effect here supports;
    // Blizzard alone is wired via the existing bounceTarget effect.
  },
  {
    id: 'idyllic-beachfront',
    name: 'Idyllic Beachfront',
    type: 'land',
    costLabel: '-',
    text: '({T}: Add {W} or {U}.)\n' +
      'This land enters tapped.\n' +
      '“This is where I was born. I started blitz when I was five. I joined the Aurochs at thirteen… ten years ago. Ten years… and we never won a game.”\n' +
      '—Wakka',
    imagePath: '/assets/cards/idyllic-beachfront.webp',
    entersTapped: true,
    producesMana: ['W', 'U'],
  },
  {
    id: 'inexorable-tide',
    name: 'Inexorable Tide',
    type: 'enchantment',
    costLabel: '{3}{U}',
    text: 'Whenever you cast a spell, proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.)\n' +
      '“When Sin attacked Zanarkand that day, I woke up in Spira.”\n' +
      '—Tidus',
    imagePath: '/assets/cards/inexorable-tide.webp',
    onOwnCastAnySpellTrigger: [{ type: 'proliferate' }],
  },
  {
    id: 'ignis-scientia',
    name: 'Ignis Scientia',
    costLabel: '{1}{G}{U}',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Advisor',
    power: 2,
    toughness: 2,
    text: 'When Ignis Scientia enters, look at the top six cards of your library. You may put a land card from among them onto the battlefield tapped. ' +
      'Put \u2019the rest on the bottom of your library in a random order. \n' +
      'I\u2019ve Come Up with a New Recipe! — 1GU, Tap: Exile target card from a graveyard. If a creature card was exiled this way, create a Food token.',
    imagePath: '/assets/cards/ignis-scientia.webp',
    onEnter: [{ type: 'revealFiltered', count: 6, filterType: 'land', takenDestination: 'battlefieldTapped' }],
    abilities: [
      {
        id: 'ignis-recipe',
        label: "I've Come Up with a New Recipe!",
        cost: { manaLabel: '{1}{G}{U}', tap: true },
        effects: [{ type: 'exileTargetGraveyardCard', createFoodTokenIfCreature: true }],
        effectText: 'Exile target card from a graveyard. If a creature card was exiled this way, create a Food token.',
      },
    ],
  },
  {
    id: 'il-mheg-pixie',
    name: 'Il Mheg Pixie',
    costLabel: '{1}{U}',
    type: 'creature',
    power: 2,
    toughness: 1,
    text: 'Flying \n Whenever this creature attacks, surveil 1.',
    imagePath: '/assets/cards/il-mheg-pixie.webp',
    onAttack: [{ type: 'surveil', count: 1 }],
  },
  {
    id: 'incubation-druid',
    name: 'Incubation Druid',
    type: 'creature',
    subtype: 'Creature Elf Druid',
    costLabel: '{1}{G}',
    power: 0,
    toughness: 2,
    text: '{T}: Add one mana of any type that a land you control could produce. If this creature has a +1/+1 counter on it, add three mana of that type instead.\n' +
      '{3}{G}{G}: Adapt 3. (If this creature has no +1/+1 counters on it, put three +1/+1 counters on it.)',
    imagePath: '/assets/cards/incubation-druid.webp',
    producesMana: 'ownLandColors',
    producesManaAmountIfOwnCounter: { counterLabel: '+1/+1', amount: 3 },
    abilities: [
      {
        id: 'incubation-druid-adapt',
        label: 'Adapt 3',
        cost: { manaLabel: '{3}{G}{G}' },
        effects: [{ type: 'adapt', counterLabel: '+1/+1', amount: 3 }],
        effectText: 'If this creature has no +1/+1 counters on it, put three +1/+1 counters on it.',
      },
    ],
  },
  {
    id: 'insomnia-crown-city',
    name: 'Insomnia, Crown City',
    costLabel: '-',
    type: 'land',
    text: 'This land enters tapped. \nTap: Add W or B.',
    imagePath: '/assets/cards/insomnia-crown-city.webp',
    entersTapped: true,
    producesMana: ['W', 'B']
  },
  {
    id: 'inspiring-call',
    name: 'Inspiring Call',
    costLabel: '{2}{G}',
    type: 'instant',
    text: 'Draw a card for each creature you control with a +1/+1 counter on it. Those creatures gain indestructible until end of turn. ' +
      '(Damage and effects that say "destroy" don’t destroy them.)',
    imagePath: '/assets/cards/inspiring-call.webp',
    onCast: [{ type: 'drawForCreaturesWithCounterThenGrantIndestructible', counterLabel: '+1/+1' }],
  },
  {
    id: 'instant-ramen',
    name: 'Instant Ramen',
    costLabel: '{2}',
    // The printed text describes an artifact ("this artifact enters" /
    // "Sacrifice this artifact") - 'instant' would resolve straight to the
    // graveyard and make all of it unreachable, so this is corrected to match
    // what the card actually says.
    type: 'artifact',
    text: 'Flash \n When this artifact enters, draw a card. \n2, Tap, Sacrifice this artifact: You gain 3 life.',
    imagePath: '/assets/cards/instant-ramen.webp',
    onEnter: [{ type: 'drawCards', amount: 1 }],
    abilities: [
      {
        id: 'instant-ramen-eat',
        label: 'Eat',
        cost: { manaLabel: '{2}', tap: true, sacrificeSelf: true },
        effects: [{ type: 'gainLife', amount: 3 }],
        effectText: 'You gain 3 life.',
      },
    ],
  },
  {
    id: 'interceptor-shadow-s-hound',
    name: 'Interceptor, Shadow’s Hound',
    costLabel: '{2}{B}{B}',
    type: 'creature',
    subtype: 'Legendary Creature Dog',
    power: 4,
    toughness: 3,
    text: 'Menace\n' +
      'Assassins you control have menace.\n' +
      'Whenever you attack with one or more legendary creatures, you may pay {2}{B}. If you do, return this card from your graveyard to the battlefield tapped and attacking.',
    imagePath: '/assets/cards/interceptor-shadow-s-hound.webp',
    staticAnthemForControlledSubtype: { subtype: 'Assassin', power: 0, toughness: 0, grantKeywords: ['menace'] },
    onAttackWithLegendaryReturnSelfFromGraveyardTappedAndAttacking: { manaCost: '{2}{B}' },
  },
  {
    id: 'into-the-story',
    name: 'Into the Story',
    costLabel: '{5}{U}{U}',
    type: 'instant',
    text: 'This spell costs {3} less to cast if an opponent has seven or more cards in their graveyard.\n' +
      'Draw four cards.\n' +
      '“Hear… feel… think…”',
    imagePath: '/assets/cards/into-the-story.webp',
    costReductionIfOpponentGraveyardAtLeast: { minCount: 7, amount: 3 },
    onCast: [{ type: 'drawCards', amount: 4 }],
  },
  {
    id:'inspiring-statuary',
    name:'Inspiring Statuary',
    costLabel:'{3}',
    type:'artifact',
    text:'Nonartifact spells you cast have improvise. (Your artifacts can help cast those spells. Each artifact you tap after you’re done activating mana abilities pays for {1}.)\n'+
    '“Man thinks very highly of himself.”\n'+
    '—Barret Wallace',
    imagePath:'/assets/cards/inspiring-statuary.webp',
    grantsImproviseToNonartifactSpells: true,
  },
  {
    id: 'iron-giant',
    name: 'Iron Giant',
    costLabel: '{7}',
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
    imagePath: '/assets/cards/ishgard-the-holy-see.webp',
    entersTapped: true,
    producesMana: 'W'
  },
  {
    id: 'island',
    name: 'Island',
    costLabel: '-',
    type: 'land',
    text: 'Basic Land — Island \n(Tap: Add U.)',
    imagePath: '/assets/cards/island.webp',
    producesMana: 'U'
  },
  {
    id:'isolated-chapel',
    name:'Isolated Chapel',
    costLabel:'-',
    type:'land',
    text:'This land enters tapped unless you control a Plains or a Swamp.\n'+
    '{T}: Add {W} or {B}.\n'+
    'This is the Sealed Gate… Beyond there is the esper world.',
    imagePath:'/assets/cards/isolated-chapel.webp',
    entersTappedUnlessControlLandNames: ['Plains', 'Swamp'],
    producesMana: ['W', 'B'],
  },
  {
    id: 'item-shopkeep',
    name: 'Item Shopkeep',
    costLabel: '{1}{R}',
    type: 'creature',
    power: 2,
    toughness: 2,
    text: 'Whenever you attack, target attacking equipped creature gains menace until end of turn. (It can\u2019t be blocked except by two or more creatures.)',
    imagePath: '/assets/cards/item-shopkeep.webp',
    // Item Shopkeep never has menace itself (only a CHOSEN attacking
    // equipped creature gains it temporarily) - without this, its own text
    // would falsely self-apply menace via the plain substring keyword
    // check.
    excludeSelfKeywords: ['menace'],
    // The "whenever you attack, target attacking equipped creature gains
    // menace" trigger is deferred - needs a "target ANY attacking creature"
    // pick tied to the attack-declaration moment, which no effect supports.
  },
  {
    id: 'jecht-reluctant-guardian',
    name: 'Jecht, Reluctant Guardian',
    costLabel: '{3}{B}',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Warrior',
    power: 4,
    toughness: 3,
    text: 'Menace \n Whenever Jecht deals combat damage to a player, you may exile it, then return it to the battlefield transformed under its owner\u2019s control.',
    imagePath: '/assets/cards/jecht-reluctant-guardian.webp',
    transformsInto: 'braska-s-final-aeon',
    onCombatDamageToPlayerMayTransform: true,
  },
  {
    id: 'braska-s-final-aeon',
    name: "Braska's Final Aeon",
    costLabel: '-',
    type: 'creature',
    power: 7,
    toughness: 7,
    text: 'I, II — Jecht Beam — Each opponent discards a card and you draw a card. \n' +
      'III — Ultimate Jecht Shot — Each opponent sacrifices two creatures of their choice. \n' +
      'Menace',
    imagePath: '/assets/cards/braska-s-final-aeon.webp',
    saga: {
      chapters: [
        { numbers: [1, 2], effects: [{ type: 'eachOpponentDiscards', count: 1 }, { type: 'drawCards', amount: 1 }] },
        { numbers: [3], effects: [{ type: 'sacrificeCreature', target: 'opponent', count: 2 }] },
      ],
      sacrificeAfterFinalChapter: true,
    },
  },
  {
    id: 'jenova-ancient-calamity',
    name: 'Jenova, Ancient Calamity',
    costLabel: '{2}{B}{G}',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Alien',
    power: 1,
    toughness: 5,
    text: "At the beginning of combat on your turn, put a number of +1/+1 counters equal to Jenova\u2019s power on up to one other target creature. " +
      "That creature becomes a Mutant in addition to its other types. Whenever a Mutant you control dies during your turn, you draw cards equal to its power.",
    imagePath: '/assets/cards/jenova-ancient-calamity.webp',
    onOwnCombatBegin: [{ type: 'putCounterOnUpToOneOtherCreatureEqualToOwnPower', counterLabel: '+1/+1', alsoGrantsSubtype: 'Mutant' }],
    onAnyDeathDrawEqualToPowerIfSubtype: { subtype: 'Mutant', duringOwnTurnOnly: true },
  },
  {
    id: 'jidoor-aristocratic-capital',
    name: 'Jidoor, Aristocratic Capital',
    costLabel: '-',
    type: 'land',
    text: "This land enters tapped. \nTap: Add U.\nOverture 4UU\n" +
      "Sorcery — Adventure\n Target opponent mills half their library, rounded down. (Then exile this card. You may play the land later from exile.)",
    imagePath: '/assets/cards/jidoor-aristocratic-capital.webp',
    entersTapped: true,
    producesMana: 'U'
  },
  {
    id: 'jill-shiva-s-dominant',
    name: "Jill, Shiva's Dominant",
    costLabel: '{2}{U}',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Noble Warrior',
    power: 2,
    toughness: 2,
    text: "When Jill enters, return up to one other target nonland permanent to its owner\u2019s hand.\n" +
      "3UU, Tap: Exile Jill, then return it to the battlefield transformed under its owner\u2019s control. Activate only as a sorcery.",
    imagePath: '/assets/cards/jill-shiva-s-dominant.webp',
    transformsInto: 'shiva-warden-of-ice',
    onEnter: [{ type: 'bounceUpToOneOtherNonlandPermanent' }],
    abilities: [
      {
        id: 'jill-transform',
        label: 'Transform',
        cost: { manaLabel: '{3}{U}{U}', tap: true },
        exileAndReturnTransformed: true,
        onlyDuringOwnMainPhase: true,
        effectText: "Exile Jill, then return it to the battlefield transformed under its owner's control.",
      },
    ],
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
    imagePath: '/assets/cards/shiva-warden-of-ice.webp',
    transformsInto: 'jill-shiva-s-dominant',
    saga: {
      chapters: [
        { numbers: [1, 2], effects: [{ type: 'pumpTarget', power: 0, toughness: 0, grantKeyword: 'unblockable' }] },
        { numbers: [3], effects: [{ type: 'tapAllOpponentLands' }, { type: 'exileAndReturnTransformedSelf' }] },
      ],
    },
  },
  {
    id: 'joshua-phoenix-s-dominant',
    name: "Joshua, Phoenix's Dominant",
    costLabel: '{1}{R}{W}',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Noble Wizard',
    power: 3,
    toughness: 4,
    text: "When Joshua enters, discard up to two cards, then draw that many cards. \n" +
      "3RW, Tap: Exile Joshua, then return it to the battlefield transformed under its owner\u2019s control. Activate only as a sorcery.",
    imagePath: '/assets/cards/joshua-phoenix-s-dominant.webp',
    transformsInto: 'phoenix-warden-of-fire',
    onEnter: [{ type: 'discardUpToThenDrawThatMany', maxCount: 2 }],
    abilities: [
      {
        id: 'joshua-transform',
        label: 'Transform',
        cost: { manaLabel: '{3}{R}{W}', tap: true },
        exileAndReturnTransformed: true,
        onlyDuringOwnMainPhase: true,
        effectText: "Exile Joshua, then return it to the battlefield transformed under its owner's control.",
      },
    ],
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
    imagePath: '/assets/cards/phoenix-warden-of-fire.webp',
    transformsInto: 'joshua-phoenix-s-dominant',
    // Chapter III's reanimation clause ("return any number of target creature
    // cards with total mana value 6 or less") is deferred - there's no
    // mechanism here for a budget-constrained multi-card choice (as opposed
    // to ReanimateTargetFromGraveyardEffect's single fixed pick) - but the
    // self-flip back to the front face still fires on schedule.
    saga: {
      chapters: [
        { numbers: [1, 2], effects: [{ type: 'dealDamageToEachOpponent', amount: 2 }] },
        { numbers: [3], effects: [{ type: 'exileAndReturnTransformedSelf' }] },
      ],
    },
  },
  {
    id: 'judge-magister-gabranth',
    name: 'Judge Magister Gabranth',
    costLabel: '{W}{B}',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Advisor Knight',
    power: 2,
    toughness: 2,
    text: "Menace \n(This creature can\u2019t be blocked except by two or more creatures.) \n" +
      "Whenever another creature or artifact you control dies, put a +1/+1 counter on Judge Magister Gabranth.",
    imagePath: '/assets/cards/judge-magister-gabranth.webp',
    onAnyDeathCounterSelf: { counterLabel: '+1/+1', counterAmount: 1 },
  },
  {
    id: 'judgment-bolt',
    name: 'Judgment Bolt',
    costLabel: '{3}{R}',
    type: 'instant',
    text: "Judgment Bolt deals 5 damage to target creature and X damage to that creature\u2019s controller, where X is the number of Equipment you control.",
    imagePath: '/assets/cards/judgment-bolt.webp',
    onCast: [{ type: 'damageTargetAndControllerByEquipmentCount', damageToCreature: 5 }],
  },
  {
    id:'judgment-of-alexander',
    name:'Judgement of Alexander',
    costLabel:'{2}{W}',
    type:'instant',
    text:'Prevent all damage that would be dealt to you this turn by sources your opponents control. Whenever damage from a creature is prevented this way, each commander creature you control deals damage equal to its power to that creature.\n'+
    '“Your powers even transcend Bahamut\u2019s… Alexander, I\u2019ve been waiting for you.”\n'+
    '—Kuja',
    imagePath:'/assets/cards/judgment-of-alexander.webp',
    // Fully deferred - this needs a genuine damage-prevention-shield system
    // (prevent all damage from opponent sources for the rest of the turn)
    // with a redirect trigger on top (prevented damage causes YOUR
    // commander creatures to retaliate), and no damage-prevention
    // mechanism of any kind exists in this engine (combat/burn damage is
    // always just applied). Same category as previously-deferred cards
    // that need a nonexistent stack/priority system.
  },
  {
    id: 'jumbo-cactuar',
    name: 'Jumbo Cactuar',
    costLabel: '{5}{G}{G}',
    type: 'creature',
    power: 1,
    toughness: 7,
    text: "10,000 Needles — Whenever this creature attacks, it gets +9999/+0 until end of turn.",
    imagePath: '/assets/cards/jumbo-cactuar.webp',
    onAttack: [{ type: 'pumpSelf', power: 9999, toughness: 0 }],
  },
  {
    id: 'jungle-shrine',
    name: 'Jungle Shrine',
    costLabel: '-',
    type: 'land',
    text: 'This land enters tapped.\n' +
      '{T}: Add {R}, {G}, or {W}.\n' +
      '“This is… the Temple of the Ancients. I know… I feel it. The knowledge of the Ancients…”\n' +
      '—Aerith Gainsborough',
    imagePath: '/assets/cards/jungle-shrine.webp',
    entersTapped: true,
    producesMana: ['R', 'G', 'W'],
  },
  {
    id: 'kain-traitorous-dragoon',
    name: 'Kain, Traitorous Dragoon',
    costLabel: '{2}{B}',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Knight',
    power: 2,
    toughness: 4,
    text: 'Jump — During your turn, Kain has flying.\n' +
      "Whenever Kain deals combat damage to a player, that player gains control of Kain. If they do, you draw that many cards, " +
      "create that many tapped Treasure tokens, then lose that much life.",
    imagePath: '/assets/cards/kain-traitorous-dragoon.webp',
    grantsSelfKeywordDuringOwnTurn: 'flying',
    combatDamageToPlayerGrantsControlToThem: true,
  },
  {
    id: 'kefka-court-mage',
    name: 'Kefka, Court Mage',
    costLabel: '{2}{U}{B}{R}',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Wizard',
    power: 4,
    toughness: 5,
    text: "Whenever Kefka enters or attacks, each player discards a card. Then you draw a card for each card type among cards discarded this way.\n" +
      "8: Each opponent sacrifices a permanent of their choice. Transform Kefka. Activate only as a sorcery.",
    imagePath: '/assets/cards/kefka-court-mage.webp',
    transformsInto: 'kefka-ruler-of-ruin',
    // The "enters or attacks" discard-then-draw-by-distinct-type-count clause
    // is deferred - counting how many distinct card TYPES were discarded this
    // way (as opposed to a fixed number of cards) has no existing mechanism.
    abilities: [
      {
        id: 'kefka-transform',
        label: 'Transform',
        cost: { manaLabel: '{8}' },
        onlyDuringOwnMainPhase: true,
        effects: [{ type: 'sacrificeCreature', target: 'opponent', filter: 'anyPermanent' }],
        transformSelf: true,
        effectText: "Each opponent sacrifices a permanent of their choice. Transform Kefka.",
      },
    ],
  },
  {
    id: 'kefka-dancing-mad',
    name: 'Kefka, Dancing Mad',
    costLabel: '{5}{B}{R}',
    type: 'creature',
    subtype: 'Legendary Creature — Human Wizard',
    power: 6,
    toughness: 6,
    text: 'During your turn, Kefka has indestructible.\n' +
      'At the beginning of your end step, exile a card at random from each opponent’s graveyard. You may cast any number of spells from among cards exiled this way without paying their mana costs. Then each player who owns a spell you cast this way loses life equal to its mana value.',
    imagePath: '/assets/cards/kefka-dancing-mad.webp',
    hasIndestructibleDuringControllerTurn: true,
    // Without this, the plain substring check hasKeyword() (see
    // engine/keywords.ts) would see Kefka's OWN printed text mentioning
    // "indestructible" and grant it UNCONDITIONALLY, defeating the whole
    // point of the turn-gated static check above - same fix as every
    // other self-referencing keyword mention elsewhere in this file.
    excludeSelfKeywords: ['indestructible'],
    onOwnEndStep: [{ type: 'exileRandomFromEachOpponentGraveyardThenMayCastFree' }],
  },
  {
    id: 'kefka-ruler-of-ruin',
    name: 'Kefka, Court Mage',
    costLabel: '-',
    type: 'creature',
    power: 5,
    toughness: 7,
    text: 'Flying \n Whenever an opponent loses life during your turn, you draw that many cards.',
    imagePath: '/assets/cards/kefka-ruler-of-ruin.webp',
    onOpponentLifeLossDuringYourTurn: true,
  },
  {
    id:'key-to-the-city',
    name:'Key to the City',
    costLabel:'{2}',
    type:'artifact',
    text:'{T}, Discard a card: Up to one target creature can’t be blocked this turn.\n'+
    'Whenever this artifact becomes untapped, you may pay {2}. If you do, draw a card.\n'+
    '“Oh dear… We’re really in trouble this time…”\n'+
    '—The Impresario, opera house manager',
    imagePath:'/assets/cards/key-to-the-city.webp',
    onSelfUntapMayPayThenDraw: { manaCost: '{2}', effects: [{ type: 'drawCards', amount: 1 }] },
    abilities: [
      {
        id: 'key-to-the-city-unblockable',
        label: 'Make a creature unblockable',
        cost: { tap: true, discardCards: 1 },
        effects: [{ type: 'grantKeywordsToTargetPermanent', keywords: ['unblockable'], creatureOnly: true, optional: true }],
        effectText: "Up to one target creature can't be blocked this turn.",
      },
    ],
  },
  {
    id: 'kimahri-valiant-guardian',
    name: 'Kimahri Valiant Guardian',
    costLabel: '{2}{G}{U}',
    type: 'creature',
    subtype: 'Legendary Creature Cat Warrior',
    power: 3,
    toughness: 3,
    text: 'Vigilance\n' +
      'Ronso Rage — At the beginning of combat on your turn, put a +1/+1 counter on Kimahri and tap target creature an opponent controls. ' +
      'Then you may have Kimahri become a copy of that creature, except its name is Kimahri, Valiant Guardian and it has vigilance and this ability.',
    imagePath: '/assets/cards/kimahri-valiant-guardian.webp',
    onOwnCombatBegin: [{ type: 'ronsoRage', counterLabel: '+1/+1', counterAmount: 1 }],
    // The "become a copy" half only copies power/toughness (see
    // CardInstance.copiedStatsFromDefId's own doc comment) - the copied
    // creature's other keywords/abilities/types are NOT granted, which
    // happens to line up reasonably well with the printed exception clause
    // ("except its name is Kimahri... and it has vigilance and this
    // ability"), even though the real card's copy effect is broader than
    // just stats.
  },
  {
    id:'krile-baldesion',
    name:'Krile Baldesion',
    costLabel:'{W}{U}',
    type:'creature',
    subtype:'Legendary Creature — Dwarf Wizard',
    power: 2,
    toughness: 1,
    text:'Lifelink\n'+
    'Trace Aether — Whenever you cast a noncreature spell, you may return target creature card with mana value equal to that spell’s mana value from your graveyard to your hand. Do this only once each turn.',
    imagePath:'/assets/cards/krile-baldesion.webp',
    noncreatureCastTrigger: { mayReturnCreatureFromGraveyardWithManaValueEqualToSpentOncePerTurn: true },
  },
  {
    id: 'kuja-genome-sorcerer',
    name: 'Kuja, Genome Sorcerer',
    costLabel: '{2}{B}{R}',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Mutant Wizard',
    power: 3,
    toughness: 4,
    text: 'At the beginning of your end step, create a tapped 0/1 black Wizard creature token with ' +
      '“Whenever you cast a noncreature spell, this token deals 1 damage to each opponent.” Then if you control four or more Wizards, transform Kuja.',
    imagePath: '/assets/cards/kuja-genome-sorcerer.webp',
    transformsInto: 'trance-kuja-fate-defied',
    onOwnEndStep: [
      { type: 'createToken', tokenId: 'token-wizard', tapped: true },
      { type: 'transformSelfIfControlledSubtypeCountAtLeast', subtype: 'Wizard', minCount: 4 },
    ],
  },
  {
    id: 'trance-kuja-fate-defied',
    name: 'Trance Kuja, Fate Defied',
    costLabel: '-',
    type: 'creature',
    power: 4,
    toughness: 6,
    text: 'Flare Star — If a Wizard you control would deal damage to a permanent or player, it deals double that damage instead.',
    imagePath: '/assets/cards/trance-kuja-fate-defied.webp',
    doublesSubtypeDamage: 'Wizard',
  },
  {
    id: 'laughing-mad',
    name: 'Laughing Mad',
    costLabel: '{2}{R}',
    type: 'instant',
    text: 'As an additional cost to cast this spell, discard a card.\nDraw two cards.\nFlashback 3R',
    imagePath: '/assets/cards/laughing-mad.webp',
    // Modeled as LootEffect(draw 2, discard 1) rather than a true up-front
    // "discard as a cost" - net card change and end-of-resolution hand are
    // identical either way (nothing here cares about discard-before-draw
    // sequencing), and this reuses the existing draw-then-discard plumbing
    // instead of needing a new pre-cast-cost/choice mechanism.
    onCast: [{ type: 'loot', drawCount: 2, discardCount: 1 }],
    flashback: { cost: '{3}{R}' },
  },
  {
    id: 'legions-to-ashes',
    name: 'Legions to Ashes',
    costLabel: '{1}{W}{B}',
    type: 'sorcery',
    text: 'Exile target nonland permanent an opponent controls and all tokens that player controls with the same name as that permanent.\n' +
      '“Ha-ha! I’m raring to go! Can’t be leaving everything up to you whippersnappers!”\n' +
      '—Strago Magus',
    imagePath: '/assets/cards/legions-to-ashes.webp',
    onCast: [{ type: 'exileTargetPermanent', targetFilter: 'nonlandPermanent', opponentControlledOnly: true, alsoExileSameNameTokensControlledByTarget: true }],
  },
  {
    id:'lethal-scheme',
    name:'Lethal Scheme',
    costLabel:'{2}{B}{B}',
    type:'instant',
    text:'Convoke (Your creatures can help cast this spell. Each creature you tap while casting this spell pays for {1} or one mana of that creature’s color.)\n'+
    'Destroy target creature or planeswalker. Each creature that convoked this spell connives. (Draw a card, then discard a card. If you discarded a nonland card, put a +1/+1 counter on that creature.)',
    imagePath:'/assets/cards/lethal-scheme.webp',
    convoke: true,
    onCast: [{ type: 'destroyTarget', targetFilter: 'creature' }, { type: 'conniveConvokingCreatures' }],
  },
  {
    id: 'lifestream-s-blessing',
    name: 'Lifestream’s Blessing',
    costLabel: '{4}{G}{G}',
    type: 'instant',
    text: 'Draw X cards, where X is the greatest power among creatures you controlled as you cast this spell. If this spell was cast from exile, you gain twice X life.\n' +
      'Foretell {4}{G} (During your turn, you may pay {2} and exile this card from your hand face down. Cast it on a later turn for its foretell cost.)\n' +
      '“We came to tell you our memories. Come, planet! Show us your answer!”\n' +
      '—Cloud Strife',
    imagePath: '/assets/cards/lifestream-s-blessing.webp',
    onCast: [{ type: 'drawCardsEqualToGreatestPower' }],
    onCastFromExileEffects: [{ type: 'gainLifeEqualToTwiceGreatestPower' }],
    foretell: { cost: '{4}{G}' },
  },
  {
    id: 'lightning-army-of-one',
    name: 'Lightning, Army of One',
    costLabel: '{1}{R}{W}',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Soldier',
    power: 3,
    toughness: 2,
    text: "First strike, trample, lifelink\n Stagger — Whenever Lightning deals combat damage to a player," +
      "until your next turn, if a source would deal damage to that player or a permanent that player controls, it deals double that damage instead.",
    imagePath: '/assets/cards/lightning-army-of-one.webp'
  },
  {
    id:'lightning-greaves',
    name:'Lightning Greaves',
    costLabel:'{2}',
    type:'artifact',
    subtype:'Artifact — Equipment',
    text:'Equipped creature has haste and shroud. (It can’t be the target of spells or abilities.)\n'+
    'Equip {0}\n'+
    '“Gotta step it up!”\n'+
    '—Tifa Lockhart',
    imagePath:'/assets/cards/lightning-greaves.webp',
    attachesTo: 'creature',
    equipCost: '{0}',
    equipGrantsKeyword: ['haste', 'shroud'],
  },
  {
    id: 'lightning-security-sergeant',
    name: 'Lightning, Security Sergeant',
    costLabel: '{2}{R}',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Soldier',
    power: 2,
    toughness: 3,
    text: "Menace \n" +
      "Whenever Lightning deals combat damage to a player, exile the top card of your library. You may play that card for as long as you control Lightning.",
    imagePath: '/assets/cards/lightning-security-sergeant.webp',
    onCombatDamageToPlayer: [{ type: 'exileTopOfLibraryPlayableWhileControllingSource' }],
  },
  {
    id: 'light-of-judgment',
    name: 'Light of Judgment',
    costLabel: '{4}{R}',
    type: 'instant',
    // The "destroy up to one Equipment attached to that creature" clause is
    // deferred - its target set depends on whatever the FIRST target was,
    // a two-stage dependent-targeting shape nothing else here does.
    text: 'Light of Judgment deals 6 damage to target creature. Destroy up to one Equipment attached to that creature.',
    onCast: [{ type: 'damageTargetCreature', amount: 6 }],
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
    imagePath: '/assets/cards/lindblum-industrial-regency.webp',
    entersTapped: true,
    producesMana: 'R'
  },
  {
    id:'lingering-souls',
    name:'Lingering Souls',
    costLabel:'{2}{W}',
    type:'sorcery',
    text:'Create two 1/1 white Spirit creature tokens with flying.\n'+
    'Flashback {1}{B} (You may cast this card from your graveyard for its flashback cost. Then exile it.)\n'+
    '“Strange as it may seem, the longer I linger here, the less the matter of my epitaph concerns me.”',
    imagePath:'/assets/cards/lingering-souls.webp',
    onCast: [{ type: 'createToken', tokenId: 'token-spirit', count: 2 }],
    flashback: { cost: '{1}{B}' },
  },
  {
    id: 'lion-heart',
    name: 'Lion Heart',
    costLabel: '{4}',
    type: 'artifact',
    subtype: 'Equipment',
    // The ETB "deals 2 damage to any target" clause is deferred - no effect
    // here targets a creature OR a player interchangeably ("any target").
    text: 'When this Equipment enters, it deals 2 damage to any target.\n Equipped creature gets +2/+1.\n Equip 2',
    attachesTo: 'creature',
    equipCost: '{2}',
    equipBuff: { power: 2, toughness: 1 },
    imagePath: '/assets/cards/lion-heart.webp'
  },
  {
    id: 'locke-cole',
    name: 'Locke Cole',
    costLabel: '{1}{U}{B}',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Rogue',
    power: 2,
    toughness: 3,
    text: "Deathtouch, lifelink \n Whenever Locke Cole deals combat damage to a player, draw a card, then discard a card.",
    onCombatDamageToPlayer: [{ type: 'loot', drawCount: 1, discardCount: 1 }],
    imagePath: '/assets/cards/locke-cole.webp'
  },
  {
    id:'locke-treasure-hunter',
    name:'Locke, Treasure Hunter',
    costLabel:'{1}{B}{R}',
    type:'creature',
    subtype:'Legendary Creature — Human Rogue',
    power: 2,
    toughness: 3,
    text:'Locke can’t be blocked by creatures with greater power.\n'+
    'Mug — Whenever Locke attacks, each player mills a card. If a land card was milled this way, create a Treasure token. Until end of turn, you may cast a spell from among those cards.',
    imagePath:'/assets/cards/locke-treasure-hunter.webp',
    cantBeBlockedByCreaturesWithGreaterPower: true,
    onAttack: [{ type: 'mug' }],
  },
  {
    id: 'loporrit-scout',
    name: 'Loporrit Scout',
    costLabel: '{2}{G}',
    type: 'creature',
    power: 3,
    toughness: 2,
    text: 'Whenever another creature you control enters, this creature gets +1/+1 until end of turn.',
    onAnyOtherControlledCreatureEnterTrigger: [{ type: 'pumpSelf', power: 1, toughness: 1 }],
    imagePath: '/assets/cards/loporrit-scout.webp'
  },
  {
    id: 'lord-jyscal-guado',
    name: 'Lord Jyscal Guado',
    costLabel: '{1}{W}',
    type: 'creature',
    subtype: 'Legendary Creature Spirit Cleric',
    power: 2,
    toughness: 1,
    text: 'Flying\n' +
      'At the beginning of each end step, if you put a counter on a creature this turn, investigate. (Create a Clue token. It’s an artifact with "{2}, Sacrifice this token: Draw a card.")',
    imagePath: '/assets/cards/lord-jyscal-guado.webp',
    onAnyEndStep: [{ type: 'ifCounterPutOnOwnCreatureThisTurn', thenEffects: [{ type: 'createToken', tokenId: 'token-clue' }], elseEffects: [] }],
  },
  {
    id: 'louisoix-s-sacrifice',
    name: "Louisoix's Sacrifice",
    costLabel: '{U}',
    type: 'instant',
    text: 'As an additional cost to cast this spell, sacrifice a legendary creature or pay 2. Counter target activated ability, triggered ability, or noncreature spell.',
    imagePath: '/assets/cards/louisoix-s-sacrifice.webp'
  },
  {
    id: 'luminous-broodmoth',
    name: 'Luminous Broodmoth',
    costLabel: '{2}{W}{W}',
    type: 'creature',
    subtype: 'Creature Insect',
    power: 3,
    toughness: 4,
    text: 'Flying\n' +
      'Whenever a creature you control without flying dies, return it to the battlefield under its owner’s control with a flying counter on it.',
    imagePath: '/assets/cards/luminous-broodmoth.webp',
    onAnyControlledCreatureWithoutFlyingDeathReturnWithFlyingCounter: true,
  },
  {
    id: 'lunatic-pandora',
    name: 'Lunatic Pandora',
    costLabel: '{1}',
    type: 'artifact',
    text: "2, Tap: Surveil 1. (Look at the top card of your library. You may put it into your graveyard.) \n" +
      "6, Tap, Sacrifice Lunatic Pandora: Destroy target nonland permanent.",
    imagePath: '/assets/cards/lunatic-pandora.webp',
    abilities: [
      {
        id: 'lunatic-pandora-surveil',
        label: 'Surveil',
        cost: { manaLabel: '{2}', tap: true },
        effects: [{ type: 'surveil', count: 1 }],
        effectText: 'Surveil 1.',
      },
      {
        id: 'lunatic-pandora-destroy',
        label: 'Destroy',
        cost: { manaLabel: '{6}', tap: true, sacrificeSelf: true },
        effects: [{ type: 'destroyTarget', targetFilter: 'nonlandPermanent' }],
        effectText: 'Destroy target nonland permanent.',
      },
    ],
  },
  {
    id: 'lulu-stern-guardian',
    name: 'Lulu, Stern Guardian',
    costLabel: '{2}{U}',
    type: 'creature',
    subtype: 'Legendary Creature Human Wizard',
    power: 2,
    toughness: 3,
    text: 'Whenever an opponent attacks you, choose target creature attacking you. Put a stun counter on that creature.\n' +
      '{3}{U}: Proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind ' +
      'already there.)',
    imagePath: '/assets/cards/lulu-stern-guardian.webp',
    onOpponentAttacksYou: [{ type: 'putStunCounterOnTargetAttacker' }],
    abilities: [
      {
        id: 'lulu-proliferate',
        label: 'Proliferate',
        cost: { manaLabel: '{3}{U}' },
        effects: [{ type: 'proliferate' }],
        effectText: 'Proliferate.',
      },
    ],
  },
  {
    id:'lyse-hext',
    name:'Lyse Hext',
    costLabel:'{1}{W}{U}',
    type:'creature',
    subtype:'Legendary Creature — Human Rebel Monk',
    power: 2,
    toughness: 2,
    text:'Prowess (Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.)\n'+
    'Noncreature spells you cast cost {1} less to cast.\n'+
    'As long as you’ve cast two or more noncreature spells this turn, Lyse Hext has double strike.',
    noncreatureCastTrigger: { pumpSelf: { power: 1, toughness: 1 } },
    reducesCastCostForNoncreatureSpells: 1,
    hasDoubleStrikeIfControllerCastTwoOrMoreNoncreatureSpellsThisTurn: true,
    excludeSelfKeywords: ['double strike'],
    imagePath:'/assets/cards/lyse-hext.webp'
  },
  {
    id: 'machinist-s-arsenal',
    name: "Machinist's Arsenal",
    costLabel: '{4}{W}',
    type: 'artifact',
    subtype: 'Equipment',
    text: "Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.)" +
      "Equipped creature gets +2/+2 for each artifact you control and is an Artificer in addition to its other types." +
      "Machina — Equip 4 (4: Attach to target creature you control. Equip only as a sorcery.)",
    onEnter: [{ type: 'createToken', tokenId: 'token-hero', attachSelfToToken: true }],
    attachesTo: 'creature',
    equipCost: '{4}',
    equipBuffPerControlledType: { type: 'artifact', power: 2, toughness: 2 },
    equipGrantsSubtype: 'Artificer',
    imagePath: '/assets/cards/machinist-s-arsenal.webp'
  },
  {
    id: 'magic-damper',
    name: 'Magic Damper',
    costLabel: '{U}',
    type: 'instant',
    text: 'Target creature you control gets +1/+1 and gains hexproof until end of turn. Untap it.',
    onCast: [{ type: 'pumpTarget', power: 1, toughness: 1, grantKeyword: 'hexproof', restrictToOwnCreature: true, alsoUntap: true }],
    imagePath: '/assets/cards/magic-damper.webp'
  },
  {
    id: 'magic-pot',
    name: 'Magic Pot',
    costLabel: '{3}',
    type: 'creature',
    subtype: 'artifact',
    power: 1,
    toughness: 4,
    text: 'When this creature dies, create a Treasure token. (It\u2019s an artifact with “{T}, Sacrifice this token: Add one mana of any color.”)\n' +
      "2, Tap: Exile target card from a graveyard.",
    imagePath: '/assets/cards/magic-pot.webp',
    onDeath: [{ type: 'createToken', tokenId: 'token-treasure' }],
    // "2, Tap: Exile target card from a graveyard" is deferred - no
    // activated-ability CardEffect targets a graveyard card yet (only
    // GraveyardExileEffect's own dedicated onCast/onEnter pendingGraveyardExile
    // flow does, not a generic activated ability).
  },
  {
    id: 'magitek-armor',
    name: 'Magitek Armor',
    costLabel: '{3}{W}',
    type: 'artifact',
    power: 4,
    toughness: 4,
    // Was missing its `crew` field entirely, so it could never actually be
    // crewed.
    text: 'When this Vehicle enters, create a 1/1 colorless Hero creature token. \nCrew 1',
    onEnter: [{ type: 'createToken', tokenId: 'token-hero' }],
    crew: 1,
    imagePath: '/assets/cards/magitek-armor.webp'
  },
  {
    id: 'magitek-infantry',
    name: 'Magitek Infantry',
    costLabel: '{W}',
    type: 'creature',
    subtype: 'Artifact Robot Soldier',
    power: 1,
    toughness: 1,
    text: "This creature gets +1/+0 as long as you control another artifact. \n" +
      "2W: Search your library for a card named Magitek Infantry, put it onto the battlefield tapped, then shuffle.",
    imagePath: '/assets/cards/magitek-infantry.webp',
    controlledTypeCountBuff: { type: 'artifact', minCount: 1, power: 1, toughness: 0 },
    abilities: [
      {
        id: 'magitek-infantry-search',
        label: 'Search',
        cost: { manaLabel: '{2}{W}' },
        effects: [{ type: 'searchLibraryForNamedCard', cardName: 'Magitek Infantry' }],
        effectText: 'Search your library for a card named Magitek Infantry, put it onto the battlefield tapped, then shuffle.',
      },
    ],
  },
  {
    id: 'magitek-scythe',
    name: 'Magitek Scythe',
    costLabel: '{4}',
    type: 'artifact',
    subtype: 'Equipment',
    text: 'A Test of Your Reflexes! — When this Equipment enters, you may attach it to target creature you control. ' +
      "If you do, that creature gains first strike until end of turn and must be blocked this turn if able." +
      "Equipped creature gets +2/+1. \nEquip 2",
    onEnter: [{ type: 'attachSelfToTarget', optional: true, grantKeyword: 'first strike' }],
    // "Must be blocked this turn if able" is still deferred - it needs
    // declareBlockers to enforce a forced-block requirement (checking
    // whether blocking is even possible first, per "if able"), a distinct,
    // more involved mechanic from the attach-and-first-strike above (see The
    // Masamune's identical, equally deferred clause).
    attachesTo: 'creature',
    equipCost: '{2}',
    equipBuff: { power: 2, toughness: 1 },
    imagePath: '/assets/cards/magitek-scythe.webp'
  },
  {
    id: 'malboro',
    name: 'Malboro',
    costLabel: '{4}{B}{B}',
    type: 'creature',
    power: 4,
    toughness: 4,
    text: "Bad Breath — When this creature enters, each opponent discards a card, loses 2 life, and exiles the top three cards of their library.\n" +
      "Swampcycling 2 (2, Discard this card: Search your library for a Swamp card, reveal it, put it into your hand, then shuffle.)",
    cycling: { cost: '{2}', searchLandName: 'Swamp' },
    imagePath: '/assets/cards/malboro.webp',
    onEnter: [{ type: 'eachOpponentDiscards', count: 1 }, { type: 'dealDamageToEachOpponent', amount: 2 }, { type: 'exileTopOfEachOpponentLibrary', count: 3 }],
  },
  {
    id: 'maester-seymour',
    name: 'Maester Seymour',
    costLabel: '{2}{G}',
    type: 'creature',
    subtype: 'Legendary Creature Human Elf Cleric',
    power: 1,
    toughness: 3,
    text: 'At the beginning of combat on your turn, put a number of +1/+1 counters equal to Maester Seymour’s power on another target creature you control.\n' +
      '{3}{G}{G}: Monstrosity X, where X is the number of counters among creatures you control. (If this creature isn’t monstrous, put X +1/+1 counters on it and it becomes monstrous.)',
    imagePath: '/assets/cards/maester-seymour.webp',
    onOwnCombatBegin: [
      { type: 'putCounterOnUpToOneOtherCreatureEqualToOwnPower', counterLabel: '+1/+1', restrictToOwnCreature: true, mandatory: true },
    ],
    abilities: [
      {
        id: 'maester-seymour-monstrosity',
        label: 'Monstrosity',
        cost: { manaLabel: '{3}{G}{G}' },
        requiresNotMonstrous: true,
        effects: [{ type: 'monstrosityByControlledCreatureCounterCount', counterLabel: '+1/+1' }],
        effectText: "Monstrosity X, where X is the number of counters among creatures you control.",
      },
    ],
  },
  {
    id: 'mask-of-memory',
    name: 'Mask of Memory',
    costLabel: '{2}',
    type: 'artifact',
    subtype: 'Artifact — Equipment',
    text: 'Whenever equipped creature deals combat damage to a player, you may draw two cards. If you do, discard a card.\n' +
      'Equip {1} ({1}: Attach to target creature you control. Equip only as a sorcery.)',
    imagePath: '/assets/cards/mask-of-memory.webp',
    equipGrantsOnCombatDamageToPlayer: [{ type: 'mayEffect', effects: [{ type: 'loot', drawCount: 2, discardCount: 1 }] }],
    equipCost: '{1}',
    attachesTo: 'creature',
  },
  {
    id: 'matoya-archon-elder',
    name: 'Matoya, Archon Elder',
    costLabel: '{2}{U}',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Warlock',
    power: 1,
    toughness: 4,
    text: "Whenever you scry or surveil, draw a card. (Draw after you scry or surveil.)",
    imagePath: '/assets/cards/matoya-archon-elder.webp',
    onOwnSurveilDraw: true,
  },
  {
    id: 'memories-returning',
    name: 'Memories Returning',
    costLabel: '{2}{U}{U}',
    type: 'sorcery',
    text: 'Reveal the top five cards of your library. Put one of them into your hand. Then choose an opponent. ' +
      "They put one on the bottom of your library. Then you put one into your hand. Then they put one on the bottom of your library. Put the other into your hand.\n" +
      "Flashback 7UU",
    onCast: [{ type: 'revealAndDivide', count: 5, steps: [{ chooser: 'you', destination: 'hand' }, { chooser: 'opponent', destination: 'bottomOfLibrary' }, { chooser: 'you', destination: 'hand' }, { chooser: 'opponent', destination: 'bottomOfLibrary' }], remainderDestination: 'hand' }],
    flashback: { cost: '{7}{U}{U}' },
    imagePath: '/assets/cards/memories-returning.webp'
  },
  {
    id:'mega-flare',
    name:'Mega Flare',
    costLabel:'{2}{R}',
    type:'sorcery',
    text:'Kicker {3}{R}{R}\n'+
    'If this spell was kicked, create a 6/6 red Dragon creature token with flying.\n'+
    'For each opponent, choose up to one target creature that player controls. Mega Flare deals damage equal to the greatest power among creatures you control to each of the chosen creatures.',
    imagePath:'/assets/cards/mega-flare.webp',
    kicker: { cost: 'mana', manaCost: '{3}{R}{R}' },
    onCast: [
      { type: 'ifKicked', thenEffects: [{ type: 'createToken', tokenId: 'token-dragon' }], elseEffects: [] },
      { type: 'damageEqualToGreatestControlledPowerToUpToOneOpponentCreature' },
    ],
  },
  {
    id: 'meteor-golem',
    name: 'Meteor Golem',
    costLabel: '{7}',
    type: 'creature',
    subtype: 'Artifact Creature — Golem',
    power: 3,
    toughness: 3,
    text: 'When this creature enters, destroy target nonland permanent an opponent controls.\n' +
      'A mechanical monster equipped with a massive arsenal of weapons and attacks, including its signature Wave Cannon.',
    imagePath: '/assets/cards/meteor-golem.webp',
    onEnter: [{ type: 'destroyTarget', targetFilter: 'opponentNonlandPermanent' }],
  },
  {
    id: 'mind-stone',
    name: 'Mind Stone',
    costLabel: '{2}',
    type: 'artifact',
    text: '{T}: Add {C}.\n' +
      '{1}, {T}, Sacrifice this artifact: Draw a card.\n' +
      'A relic that greatly enhances the magical power of its wielder.',
    imagePath: '/assets/cards/mind-stone.webp',
    producesMana: 'C',
    abilities: [
      {
        id: 'mind-stone-draw',
        label: 'Sacrifice: Draw a Card',
        cost: { manaLabel: '{1}', tap: true, sacrificeSelf: true },
        effects: [{ type: 'drawCards', amount: 1 }],
        effectText: 'Draw a card.',
      },
    ],
  },
  {
    id: 'midgar-city-of-mako',
    name: 'Midgar, City of Mako',
    costLabel: '-',
    type: 'land',
    text: "This land enters tapped. \nTap: Add B. \nA triumph of technology and testament to man’s potential.\n" +
      "Reactor Raid 2B \nSorcery — Adventure\n " +
      "You may sacrifice an artifact or creature. If you do, draw two cards. (Then exile this card. You may play the land later from exile.)",
    imagePath: '/assets/cards/midgar-city-of-mako.webp',
    entersTapped: true,
    producesMana: 'B'
  },
  {
    id: 'millikin',
    name: 'Millikin',
    costLabel: '{2}',
    type: 'creature',
    subtype: 'Artifact Creature — Construct',
    power: 0,
    toughness: 1,
    text: '{T}, Mill a card: Add {C}. (Activate only as an instant. To mill a card, put the top card of your library into your graveyard.)\n' +
      'machine that dazes and confuses its enemies with bewildering signals.',
    imagePath: '/assets/cards/millikin.webp',
    abilities: [
      {
        id: 'millikin-mana',
        label: 'Mill a Card: Add {C}',
        cost: { tap: true, millSelf: 1 },
        effects: [{ type: 'addMana', colors: { C: 1 } }],
        effectText: 'Add {C}.',
      },
    ],
  },
  {
    id: 'minwu-white-mage',
    name: 'Minwu, White Mage',
    costLabel: '{3}{W}{W}',
    type: 'creature',
    subtype: "Legendary Ceature \u2014 Human Cleric",
    power: 3,
    toughness: 3,
    text: "Vigilance, lifelink \nWhenever you gain life, put a +1/+1 counter on each Cleric you control.",
    imagePath: '/assets/cards/minwu-white-mage.webp',
    onGainLifeTrigger: { counterLabel: '+1/+1', counterAmount: 1, subtypeFilter: 'Cleric' },
  },
  {
    id: 'mog-moogle-warrior',
    name: 'Mog, Moogle Warrior',
    costLabel: '{1}{R}{W}',
    type: 'creature',
    subtype: 'Legendary Creature — Moogle Warrior',
    power: 1,
    toughness: 2,
    text: 'Lifelink\n' +
      'Dance — At the beginning of your end step, each player may discard a card. Each player who discarded a card this way draws a card. If a creature card was discarded this way, you create a 1/2 white Moogle creature token with lifelink. Then if a noncreature card was discarded this way, put a +1/+1 counter on each Moogle you control.',
    imagePath: '/assets/cards/mog-moogle-warrior.webp',
    onOwnEndStep: [{ type: 'mogMoogleWarriorDance' }],
  },
  {
    id: 'monk-s-fist',
    name: "Monk's Fist",
    costLabel: '{2}',
    type: 'artifact',
    subtype: 'Equipment',
    text: "Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.)\n" +
      "Equipped creature gets +1/+0 and is a Monk in addition to its other types.\n" +
      "Equip 2 (2: Attach to target creature you control. Equip only as a sorcery.)",
    onEnter: [{ type: 'createToken', tokenId: 'token-hero', attachSelfToToken: true }],
    attachesTo: 'creature',
    equipCost: '{2}',
    equipBuff: { power: 1, toughness: 0 },
    equipGrantsSubtype: 'Monk',
    imagePath: '/assets/cards/monk-s-fist.webp'
  },
  {
    id: 'moogles-valor',
    name: "Moogles' Valor",
    costLabel: '{3}{W}{W}',
    type: 'instant',
    text: 'For each creature you control, create a 1/2 white Moogle creature token with lifelink. Then creatures you control gain indestructible until end of turn.',
    onCast: [{ type: 'createToken', tokenId: 'token-moogle', count: 'perCreatureYouControl' }],
    imagePath: '/assets/cards/moogles-valor.webp'
  },
  {
    id: 'morbid-opportunist',
    name: 'Morbid Opportunist',
    costLabel: '{2}{B}',
    type: 'creature',
    subtype: 'Creature — Human Rogue',
    power: 1,
    toughness: 3,
    text: 'Whenever one or more other creatures die, draw a card. This ability triggers only once each turn.\n' +
      '“Great people here! You can trust everything they say!”\n' +
      '—Zozo resident',
    imagePath: '/assets/cards/morbid-opportunist.webp',
    onAnyCreatureDeathAnywhereDraw: true,
  },
  {
    id: 'mortify',
    name: 'Mortify',
    costLabel: '{1}{W}{B}',
    type: 'instant',
    text: 'Destroy target creature or enchantment.\n' +
      '“Espers… Who’d have dreamed they were that powerful…”\n' +
      '—Imperial soldier',
    imagePath: '/assets/cards/mortify.webp',
    onCast: [{ type: 'destroyTarget', targetFilter: 'creatureOrEnchantment' }],
  },
  {
    id: 'mossfire-valley',
    name: 'Mossfire Valley',
    costLabel: '-',
    type: 'land',
    text: '{1}, {T}: Add {R}{G}.\n' +
      '“Look at this rusted rocket. I was supposed to be the first man in space with this. Everyday, it tilts a little bit more.”\n' +
      '—Cid Highwind',
    imagePath: '/assets/cards/mossfire-valley.webp',
    abilities: [
      {
        id: 'mossfire-valley-add',
        label: 'Add {R}{G}',
        cost: { manaLabel: '{1}', tap: true },
        effects: [{ type: 'addMana', colors: { R: 1, G: 1 } }],
        effectText: 'Add {R}{G}.',
      },
    ],
  },
  {
    id: 'mountain',
    name: 'Mountain',
    costLabel: '-',
    type: 'land',
    text: "(Tap: Add R.)",
    imagePath: '/assets/cards/mountain.webp',
    producesMana: 'R'
  },
  {
    id:'murderous-rider',
    name:'Murderous Rider',
    costLabel:'{1}{B}{B}',
    type:'creature',
    subtype:'Creature — Zombie Knight',
    power: 2,
    toughness: 3,
    text:'Lifelink\n'+
    'When this creature dies, put it on the bottom of its owner’s library.',
    onDeathPutOnBottomOfOwnersLibrary: true,
    imagePath:'/assets/cards/murderous-rider.webp'
  },
  {
    id: 'mysidian-elder',
    name: 'Mysidian Elde',
    costLabel: '{2}{R}',
    type: 'creature',
    power: 1,
    toughness: 3,
    text: "When this creature enters, create a 0/1 black Wizard creature token with “Whenever you cast a noncreature spell, this token deals 1 damage to each opponent.”",
    onEnter: [{ type: 'createToken', tokenId: 'token-wizard' }],
    imagePath: '/assets/cards/mysidian-elder.webp'
  },
  {
    id: 'namazu-trader',
    name: 'Namazu Trader',
    costLabel: '{3}{B}',
    type: 'creature',
    power: 3,
    toughness: 4,
    text: "When this creature enters, you lose 1 life and create a Treasure token. \n" +
      "Whenever this creature attacks, you may sacrifice another creature or artifact. If you do, surveil 2. ",
    imagePath: '/assets/cards/namazu-trader.webp',
    onEnter: [{ type: 'loseLife', amount: 1 }, { type: 'createToken', tokenId: 'token-treasure' }],
    // The attack-trigger optional sacrifice-then-surveil is deferred - no
    // "whenever this attacks, you may sacrifice X, if you do Y" trigger
    // mechanism exists yet (only unconditional onAttack effects do).
  },
  {
    id: 'nature-s-lore',
    name: 'Nature’s Lore',
    costLabel: '{1}{G}',
    type: 'sorcery',
    text: 'Search your library for a Forest card, put that card onto the battlefield, then shuffle.\n' +
      '“The spirits that return to the planet, merge with one another and roam the planet. They roam, converge, and divide, becoming a swell, called the lifestream.”\n' +
      '—Bugenhagen',
    imagePath: '/assets/cards/nature-s-lore.webp',
    onCast: [{ type: 'searchLibraryForLand', landName: 'Forest', toBattlefieldUntapped: true }],
  },
  {
    id: 'nesting-grounds',
    name: 'Nesting Grounds',
    costLabel: '-',
    type: 'land',
    text: '{T}: Add {C}.\n' +
      '{1}, {T}: Move a counter from target permanent you control onto a second target permanent. Activate only as a sorcery.\n' +
      'A butterfly will lead the way to secret things.',
    imagePath: '/assets/cards/nesting-grounds.webp',
    producesMana: 'C',
    abilities: [
      {
        id: 'nesting-grounds-move-counter',
        label: 'Move Counter',
        cost: { manaLabel: '{1}', tap: true },
        onlyDuringOwnMainPhase: true,
        effects: [{ type: 'moveOneCounterFromOwnPermanentToAnyPermanent' }],
        effectText: 'Move a counter from target permanent you control onto a second target permanent.',
      },
    ],
  },
  {
    id: 'nibelheim-aflame',
    name: 'Nibelheim Aflame',
    costLabel: '{2}{R}{R}',
    type: 'sorcery',
    text: 'Choose target creature you control. It deals damage equal to its power to each other creature. If this spell was cast from a graveyard, ' +
      'discard your hand and draw four cards. \n Flashback 5RR (You may cast this card from your graveyard for its flashback cost. Then exile it.)',
    imagePath: '/assets/cards/nibelheim-aflame.webp',
    onCast: [{ type: 'sweepDamageFromChosenCreature' }],
    flashback: { cost: '{5}{R}{R}' },
    // The "if cast from a graveyard, discard your hand and draw four cards"
    // flashback-conditional bonus is deferred - onCast has no way to know
    // whether it's resolving as a normal cast or a flashback cast.
  },
  {
    id: 'night-s-whisper',
    name: 'Night\u2019s Whisper',
    costLabel: '{1}{B}',
    type: 'sorcery',
    text: 'You draw two cards and lose 2 life.\n' +
      '“My love… you made me so happy. Thank you…”\n' +
      '—Elayne Garamonde',
    imagePath: '/assets/cards/night-s-whisper.webp',
    onCast: [{ type: 'drawCards', amount: 2 }, { type: 'loseLife', amount: 2 }],
  },
  {
    id: 'ninja-s-blades',
    name: "Ninja's Blades",
    costLabel: '{2}{B}',
    type: 'artifact',
    subtype: 'Equipment',
    text: "Job select \n Equipped creature gets +1/+1, is a Ninja in addition to its other types, and has " +
      "“Whenever this creature deals combat damage to a player, draw a card, then discard a card. That player loses life equal to the discarded card\u2019s mana value.”\n" +
      "Mutsunokami — Equip 2",
    // The granted "draw a card, then discard a card; that player loses life
    // equal to the discarded card's mana value" combat-damage trigger is
    // deferred - the life-loss amount depends on WHICH card the player
    // chooses to discard, and no mechanism here can hang a follow-up effect
    // off an in-progress discard choice yet (see GameState.pendingDiscard).
    onEnter: [{ type: 'createToken', tokenId: 'token-hero', attachSelfToToken: true }],
    attachesTo: 'creature',
    equipCost: '{2}',
    equipBuff: { power: 1, toughness: 1 },
    equipGrantsSubtype: 'Ninja',
    imagePath: '/assets/cards/ninja-s-blades.webp'
  },
  {
    id:'noctis-heir-apparent',
    name:'Noctis, Heir Apparent',
    costLabel:'{W}{U}{B}',
    type:'creature',
    subtype:'Legendary Creature \u2014 Human Noble',
    power: 2,
    toughness: 3,
    text:'Whenever a creature you control enters during combat, you may attach target Equipment you control to target creature you control.\n'+
    'Warp-Strike — {3}: Exile Noctis. Return it to the battlefield under its owner\u2019s control tapped and attacking at the beginning of that player\u2019s next declare attackers step. It can\u2019t be blocked that combat.',
    imagePath:'/assets/cards/noctis-heir-apparent.webp',
    onAnyControlledCreatureEntersDuringCombatMayAttachControlledEquipment: true,
    // Warp-Strike (exile self, return tapped and attacking at the
    // beginning of the owner's next declare attackers step, unblockable
    // that combat) is deferred - no "return at a future declare attackers
    // step" timing hook exists yet (only "next end step" does).
  },
  {
    id: 'noctis-prince-of-lucis',
    name: 'Noctis, Prince of Lucis',
    costLabel: '{1}{W}{U}{B}',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Noble',
    power: 4,
    toughness: 3,
    text: "Lifelink\n You may cast artifact spells from your graveyard by paying 3 life in addition to paying their other costs. " +
      "If you cast a spell this way, that artifact enters with a finality counter on it.",
    imagePath: '/assets/cards/noctis-prince-of-lucis.webp',
    grantsCastArtifactsFromGraveyardForLife: 3,
  },
  {
    id: 'nomad-outpost',
    name: 'Nomad Outpost',
    costLabel: '-',
    type: 'land',
    text: 'This land enters tapped.\n' +
      '{T}: Add {R}, {W}, or {B}.\n' +
      '“The Empire is snuffing out Returners wherever it finds them. We must find a way to strike back before it’s too late…”\n' +
      '—Returner soldier',
    imagePath: '/assets/cards/nomad-outpost.webp',
    entersTapped: true,
    producesMana: ['R', 'W', 'B'],
  },
  {
    id:'nyxbloom-ancient',
    name:'The Cloudsea Djinn',
    costLabel:'{4}{G}{G}{G}',
    type:'creature',
    subtype:'Enchantment Creature — Elemental',
    power: 5,
    toughness: 5,
    text:'Trample\n'+
    'If you tap a permanent for mana, it produces three times as much of that mana instead.',
    imagePath:'/assets/cards/nyxbloom-ancient.webp',
    triplesAllManaProduced: true
  },
  {
    id: 'o-aka-traveling-merchant',
    name: 'O’aka, Traveling Merchant',
    costLabel: '{1}{U}',
    type: 'creature',
    subtype: 'Legendary Creature Human Citizen',
    power: 1,
    toughness: 2,
    text: '{T}, Remove a counter from a nonland permanent you control: Draw a card.',
    imagePath: '/assets/cards/o-aka-traveling-merchant.webp',
    abilities: [
      {
        id: 'oaka-draw',
        label: 'Draw',
        cost: { tap: true, removeCounterFromAnotherPermanent: 'nonland' },
        effects: [{ type: 'drawCards', amount: 1 }],
        effectText: 'Draw a card.',
      },
    ],
  },
  {
    id:'observed-stasis',
    name:'Observed Stasis',
    costLabel:'{3}{U}',
    type:'enchantment',
    subtype:'Enchantment — Aura',
    text:'Flash\n'+
    'Enchant creature an opponent controls\n'+
    'When this Aura enters, remove enchanted creature from combat. Then draw a card for each tapped creature its controller controls.\n'+
    'Enchanted creature loses all abilities and can’t attack or block.',
    imagePath:'/assets/cards/observed-stasis.webp',
    attachesTo: 'creature',
    onEnter: [{ type: 'attachSelfToTarget', opponentControlledOnly: true, removeFromCombatThenDrawForControllerTappedCreatures: true }],
    attachedPreventsAttacking: true,
    attachedPreventsBlocking: true,
  },
  {
    id: 'omega-heartless-evolution',
    name: 'Omega, Heartless Evolution',
    costLabel: '{5}{G}{U}',
    type: 'creature',
    subtype: 'Legendary Artifact Creature \u2014  Robot',
    power: 8,
    toughness: 8,
    text: "Wave Cannon — When Omega enters, for each opponent, tap up to one target nonland permanent that opponent controls. " +
      "Put X stun counters on each of those permanents and you gain X life, where X is the number of nonbasic lands you control. " +
      "(If a permanent with a stun counter would become untapped, remove one from it instead.)",
    imagePath: '/assets/cards/omega-heartless-evolution.webp',
    // "For each opponent" is always exactly the one opponent - this engine
    // is 2-player only - so no separate per-opponent loop is needed. See
    // types.ts: TapStunAndGainLifeForNonbasicLandsEffect.
    onEnter: [{ type: 'tapStunAndGainLifeForNonbasicLands' }],
  },
  {
    id: 'opera-love-song',
    name: 'Opera Love Song',
    costLabel: '{1}{R}',
    type: 'instant',
    text: "Choose one — \n• Exile the top two cards of your library. You may play those cards until your next end step.\n" +
      "• One or two target creatures each get +2/+0 until end of turn",
    imagePath: '/assets/cards/opera-love-song.webp',
    onCast: [
      {
        type: 'chooseOneMode',
        modes: [
          { label: 'Exile the top two cards of your library. You may play those cards until your next end step.', effects: [{ type: 'exileTopOfLibraryPlayableUntilCleanup', count: 2 }] },
          { label: 'One or two target creatures each get +2/+0 until end of turn.', effects: [{ type: 'pumpUpToTwoTargets', power: 2, toughness: 0 }] },
        ],
      },
    ],
  },
  {
    id: 'overflowing-basin',
    name: 'Overflowing Basin',
    costLabel: '-',
    type: 'land',
    text: '{1}, {T}: Add {G}{U}.\n' +
      '“They say that clouds of pyreflies gather here when night falls.”\n' +
      '—Yuna',
    imagePath: '/assets/cards/overflowing-basin.webp',
    abilities: [
      {
        id: 'overflowing-basin-filter',
        label: 'Add {G}{U}',
        cost: { manaLabel: '{1}', tap: true },
        effects: [{ type: 'addMana', colors: { G: 1, U: 1 } }],
        effectText: 'Add {G}{U}.',
      },
    ],
  },
  {
    id: 'overkill',
    name: 'Overkill',
    costLabel: '{2}{B}',
    type: 'instant',
    text: 'Target creature gets -0/-9999 until end of turn.',
    imagePath: '/assets/cards/overkill.webp',
    onCast: [{ type: 'pumpTarget', power: 0, toughness: -9999 }],
  },
  {
    id: 'paladin-s-arms',
    name: "Paladin's Arms",
    costLabel: '{2}{W}',
    type: 'artifact',
    subtype: 'Equipment',
    text: "Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.) \n" +
      "Equipped creature gets +2/+1, has ward {1}, and is a Knight in addition to its other types. \n" +
      "Lightbringer and Hero\u2019s Shield — Equip 4 (4: Attach to target creature you control. Equip only as a sorcery.)",
    onEnter: [{ type: 'createToken', tokenId: 'token-hero', attachSelfToToken: true }],
    attachesTo: 'creature',
    equipCost: '{4}',
    equipBuff: { power: 2, toughness: 1 },
    equipGrantsWard: { mana: '{1}' },
    equipGrantsSubtype: 'Knight',
    imagePath: '/assets/cards/paladin-s-arms.webp'
  },
  {
    id:'palace-jailer',
    name:'Palace Jailer',
    costLabel:'{2}{W}{W}',
    type:'creature',
    subtype:'Creature — Human Soldier',
    power: 2,
    toughness: 2,
    text:'When this creature enters, you become the monarch.\n'+
    'When this creature enters, exile target creature an opponent controls until an opponent becomes the monarch.\n'+
    '“I think we all know who really deserves to be locked up in here…”',
    imagePath:'/assets/cards/palace-jailer.webp',
    onEnter: [{ type: 'becomeMonarch' }, { type: 'exileTargetCreatureUntilMonarchChanges' }],
  },
  {
    id:'papalymo-totolymo',
    name:'Papalymo Totolymo',
    costLabel:'{W}{B}',
    type:'creature',
    subtype:'Legendary Creature — Dwarf',
    power: 1,
    toughness: 2,
    text:'Whenever you cast a noncreature spell, Papalymo Totolymo deals 1 damage to each opponent and you gain 1 life.\n'+
    '{4}, {T}, Sacrifice Papalymo Totolymo: Each opponent who lost life this turn sacrifices a creature with the greatest power among creatures they control.',
    imagePath:'/assets/cards/papalymo-totolymo.webp',
    noncreatureCastTrigger: { damageEachOpponent: 1, effects: [{ type: 'gainLife', amount: 1 }] },
    abilities: [
      {
        id: 'papalymo-totolymo-sac',
        label: 'Sacrifice: Each Opponent Who Lost Life Sacrifices Their Greatest Creature',
        cost: { manaLabel: '{4}', tap: true, sacrificeSelf: true },
        effects: [{ type: 'eachOpponentWhoLostLifeSacrificesGreatestPowerCreature' }],
        effectText: 'Each opponent who lost life this turn sacrifices a creature with the greatest power among creatures they control.',
      },
    ],
  },
  {
    id: 'path-of-ancestry',
    name: 'Path of Ancestry',
    costLabel: '-',
    type: 'land',
    // "Scry" has no separate implementation in this engine (approximated as
    // Surveil 1 everywhere - see onOwnSurveilDraw's own doc comment), and
    // "when THAT mana is spent" is approximated as "when the very next spell
    // this controller casts is paid for" since this engine's mana pool has
    // no provenance tracking - see types.ts: ArmManaIdentitySourceScryEffect
    // and GameState.pendingManaIdentitySourceScry for the full mechanics and
    // the known edge cases that approximation doesn't cover.
    text: 'This land enters tapped.\n' +
      '{T}: Add one mana of any color in your commander’s color identity. When that mana is spent to cast a creature spell that shares a creature type with your commander, scry 1. (Look at the top card of your library. You may put that card on the bottom.)',
    imagePath: '/assets/cards/path-of-ancestry.webp',
    entersTapped: true,
    producesMana: 'commanderColorIdentity',
    onTapForManaEffects: [{ type: 'armManaIdentitySourceScry' }],
  },
  {
    id: 'path-of-discovery',
    name: 'Path of Discovery',
    costLabel: '{3}{G}',
    type: 'enchantment',
    text: 'Whenever a creature you control enters, it explores. (Reveal the top card of your library. Put that card into your hand if it’s a land. Otherwise, put a +1/+1 counter on the creature, then put the card back or put it into your graveyard.)',
    imagePath: '/assets/cards/path-of-discovery.webp',
    onAnyControlledCreatureEnterEffects: [{ type: 'explore' }],
  },
  {
    id: 'path-to-exile',
    name: 'Path to Exile',
    type: 'instant',
    costLabel: '{W}',
    text: 'Exile target creature. Its controller may search their library for a basic land card, put that card onto the battlefield tapped, then shuffle.',
    imagePath: '/assets/cards/path-to-exile.webp',
    onCast: [{ type: 'exileTargetCreatureThenControllerMaySearchBasicLand' }],
  },
  {
    id: 'phantom-train',
    name: "Phantom Train",
    costLabel: '{3}{B}',
    type: 'artifact',
    power: 4,
    toughness: 4,
    text: "Trample \n Sacrifice another artifact or creature: Put a +1/+1 counter on this Vehicle." +
      "It becomes a Spirit artifact creature in addition to its other types until end of turn.",
    imagePath: '/assets/cards/phantom-train.webp',
    abilities: [
      {
        id: 'phantom-train-activate',
        label: 'Activate',
        cost: { sacrificeAnother: 'artifactOrCreature' },
        effects: [{ type: 'putCounterOnSelf', counterLabel: '+1/+1', counterAmount: 1 }, { type: 'becomeCreatureUntilEndOfTurn', subtype: 'Spirit' }],
        effectText: 'Put a +1/+1 counter on this Vehicle. It becomes a Spirit artifact creature in addition to its other types until end of turn.',
      },
    ],
  },
  {
    id: 'phoenix-down',
    name: 'Phoenix Down',
    costLabel: '{W}',
    type: 'artifact',
    text: "1W, Tap, Exile this artifact: Choose one — \n" +
      "• Return target creature card with mana value 4 or less from your graveyard to the battlefield tapped. \n" +
      "• Exile target Skeleton, Spirit, or Zombie.",
    imagePath: '/assets/cards/phoenix-down.webp',
    // Only mode 1 is implemented - mode 2 ("exile target Skeleton, Spirit, or
    // Zombie") is deferred since there's no choose-a-mode UI for activated
    // abilities (only CAST_CARD's chosenModeIndices supports modal choices).
    abilities: [
      {
        id: 'phoenix-down-reanimate',
        label: 'Reanimate',
        cost: { manaLabel: '{1}{W}', tap: true, exileSelf: true },
        effects: [{ type: 'reanimateTargetFromGraveyard', maxManaValue: 4, forceEntersTapped: true }],
        effectText: 'Return target creature card with mana value 4 or less from your graveyard to the battlefield tapped.',
      },
    ],
  },
  {
    id:'pitiless-plunderer',
    name:'Pitiless Plunderer',
    costLabel:'{3}{B}',
    type:'creature',
    subtype:'Creature — Human Pirate',
    power: 1,
    toughness: 4,
    text:'Whenever another creature you control dies, create a Treasure token. (It’s an artifact with “{T}, Sacrifice this token: Add one mana of any color.”)\n'+
    '“We’re gonna go into the castle through a secret cave that nobody else knows about!”',
    imagePath:'/assets/cards/pitiless-plunderer.webp',
    onAnyDeathCreateToken: { tokenId: 'token-treasure' },
  },
  {
    id: 'plains',
    name: "Plains",
    costLabel: '-',
    type: 'land',
    text: '(T: Add W.)',
    imagePath: '/assets/cards/plains.webp',
    producesMana: 'W'
  },
  {
    id: 'poison-the-waters',
    name: 'Poison the Waters',
    costLabel: '{1}{B}',
    type: 'sorcery',
    text: "Choose one — \n• All creatures get -1/-1 until end of turn.\n " +
      "• Target player reveals their hand. You choose an artifact or creature card from it. That player discards that card.",
    imagePath: '/assets/cards/poison-the-waters.webp',
    // Only mode 1 is implemented - mode 2 ("reveal target player's hand,
    // choose a card from it, they discard it") is deferred (no
    // reveal-opponent's-hand-and-choose mechanism exists), and there's no
    // choose-a-mode UI anyway (see phoenix-down for the same modal-ability gap).
    onCast: [{ type: 'buffAllCreatures', power: -1, toughness: -1 }],
  },
  {
    id: 'port-town',
    name: 'Port Town',
    costLabel: '-',
    type: 'land',
    text: 'As this land enters, you may reveal a Plains or Island card from your hand. If you don’t, this land enters tapped.\n' +
      '{T}: Add {W} or {U}.\n' +
      '“The excitement here has reached a fever pitch as the opening ceremony gets under way!”\n' +
      '—Blitzball announcer',
    imagePath: '/assets/cards/port-town.webp',
    entersTappedUnlessRevealLandNames: ['Plains', 'Island'],
    producesMana: ['W', 'U'],
  },
  {
    id:'praetor-s-grasp',
    name:'Unseat the Usurper',
    costLabel:'{1}{B}{B}',
    type:'sorcery',
    text:'Search target opponent’s library for a card and exile it face down. Then that player shuffles. You may play that card for as long as it remains exiled.\n'+
    '“The throne brings you here? It seats only one.”',
    imagePath:'/assets/cards/praetor-s-grasp.webp',
    onCast: [{ type: 'searchOpponentLibraryExileFaceDownThenMayPlay' }],
  },
  {
    id: 'prairie-stream',
    name: 'Prairie Stream',
    costLabel: '-',
    type: 'land',
    text: '({T}: Add {W} or {U}.)\n' +
      'This land enters tapped unless you control two or more basic lands.\n' +
      '“Hydatos, a reference to its watery disposition. This will be the last corner of the island that the expedition will need to contend with.”\n' +
      '—Eureka expedition ferryman',
    imagePath: '/assets/cards/prairie-stream.webp',
    entersTappedUnlessControlBasicLandCount: 2,
    producesMana: ['W', 'U'],
  },
  {
    id: 'priest-of-fell-rites',
    name: 'Priest of Fell Rites',
    costLabel: '{W}{B}',
    type: 'creature',
    subtype: 'Creature — Human Warlock',
    power: 2,
    toughness: 2,
    text: '{T}, Pay 3 life, Sacrifice this creature: Return target creature card from your graveyard to the battlefield. Activate only as a sorcery.\n' +
      'Unearth {3}{W}{B} ({3}{W}{B}: Return this card from your graveyard to the battlefield. It gains haste. Exile it at the beginning of the next end step or if it would leave the battlefield. Unearth only as a sorcery.)',
    imagePath: '/assets/cards/priest-of-fell-rites.webp',
    abilities: [
      {
        id: 'priest-of-fell-rites-return',
        label: 'Return a Creature from Your Graveyard',
        cost: { tap: true, payLife: 3, sacrificeSelf: true },
        onlyDuringOwnMainPhase: true,
        effects: [{ type: 'reanimateTargetFromGraveyard' }],
        effectText: 'Return target creature card from your graveyard to the battlefield.',
      },
    ],
    unearth: { cost: '{3}{W}{B}' },
  },
  {
    id:'feed-the-swarm',
    name:'Primogenesis',
    costLabel:'{1}{B}',
    type:'sorcery',
    text:'Destroy target creature or enchantment an opponent controls. You lose life equal to that permanent’s mana value.\n'+
    '“If it is consciousness that weaves your wills together… then we shall set you apart once more.”',
    imagePath:'/assets/cards/feed-the-swarm.webp',
    onCast: [{ type: 'destroyTarget', targetFilter: 'creatureOrEnchantment', opponentControlledOnly: true, thenLoseLifeEqualToManaValue: true }],
  },
  {
    id: 'prishe-s-wanderings',
    name: "Prishe's Wanderings",
    costLabel: '{2}{G}',
    type: 'instant',
    text: 'Search your library for a basic land card or Town card, put it onto the battlefield tapped, then shuffle. ' +
      'When you search your library this way, put a +1/+1 counter on target creature you control.',
    onCast: [{ type: 'searchLibraryForBasicLandOrSubtype', subtype: 'Town', toBattlefieldTapped: true }],
    imagePath: '/assets/cards/prishe-s-wanderings.webp',
    // The linked "then put a +1/+1 counter on target creature you control"
    // follow-up is still deferred - there's no mechanism to chain a NEW
    // targeted effect off the end of a library search resolving (the
    // library-search flow doesn't hand off to a second pending state).
  },
  {
    id:'professional-face-breaker',
    name:'Professional Face-Breaker',
    costLabel:'{2}{R}',
    type:'creature',
    subtype:'Creature — Human Warrior',
    power: 2,
    toughness: 3,
    text:'Menace\n'+
    'Whenever one or more creatures you control deal combat damage to a player, create a Treasure token.\n'+
    'Sacrifice a Treasure: Exile the top card of your library. You may play that card this turn.',
    imagePath:'/assets/cards/professional-face-breaker.webp',
    onAnyControlledCreatureCombatDamageToPlayer: [{ type: 'createToken', tokenId: 'token-treasure' }],
    abilities: [
      {
        id: 'professional-face-breaker-sac',
        label: 'Sacrifice a Treasure',
        cost: { sacrificeAnotherWithSubtype: 'Treasure' },
        effects: [{ type: 'exileTopOfLibraryPlayableUntilCleanup', count: 1 }],
        effectText: 'Exile the top card of your library. You may play that card this turn.',
      },
    ],
  },
  {
    id: 'professor-hojo',
    name: 'Professor Hojo',
    costLabel: '{1}{G}',
    type: 'creature',
    subtype: 'Legendary Creature — Human Scientist',
    power: 2,
    toughness: 2,
    text: 'The first activated ability you activate during your turn that targets a creature you control costs {2} less to activate.\n' +
      'Whenever one or more creatures you control become the target of an activated ability, draw a card. This ability triggers only once each turn.',
    imagePath: '/assets/cards/professor-hojo.webp',
    reducesActivatedAbilityCostForFirstOwnCreatureTargetingEachTurn: 2,
    onOwnControlledCreatureTargetedByActivatedAbility: [{ type: 'drawCards', amount: 1 }],
  },
  {
    id: 'promise-of-loyalty',
    name: 'Promise of Loyalty',
    costLabel: '{4}{W}',
    type: 'sorcery',
    text: 'Each player puts a vow counter on a creature they control and sacrifices the rest. Each of those creatures can’t attack you or planeswalkers you control for as long as it has a vow counter on it.\n' +
      '“Listen to my story. This may be our last chance.”\n' +
      '—Tidus',
    imagePath: '/assets/cards/promise-of-loyalty.webp',
    onCast: [{ type: 'eachPlayerKeepOneCreatureSacrificeRest' }],
  },
  {
    id: 'prompto-argentum',
    name: 'Prompto Argentum',
    costLabel: '{1}{R}',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Scout',
    power: 2,
    toughness: 2,
    text: "Haste \n Selfie Shot — Whenever you cast a noncreature spell, if at least four mana was spent to cast it, create a Treasure token.",
    imagePath: '/assets/cards/prompto-argentum.webp',
    noncreatureCastTrigger: { createTokenIfExpensive: { minManaValue: 4, tokenId: 'token-treasure' } },
  },
  {
    id:'propaganda',
    name:'Propaganda',
    costLabel:'{2}{U}',
    type:'enchantment',
    text:'Creatures can’t attack you unless their controller pays {2} for each creature they control that’s attacking you.\n'+
    '“Barring a few exceptions, we have detained all those with allegiance to the Scions. The Rising Stones is also under our control.”\n'+
    '—Crystal Brave Soldier',
    imagePath:'/assets/cards/propaganda.webp',
    staticAttacksYouCostGeneric: 2
  },
  {
    id: 'protection-magic',
    name: 'Protection Magic',
    costLabel: '{1}{W}',
    type: 'instant',
    text: 'Put a shield counter on each of up to three target creatures. (If a creature with a shield counter would be dealt damage or destroyed, remove a shield counter from it instead.)',
    imagePath: '/assets/cards/protection-magic.webp',
    onCast: [{ type: 'support', counterLabel: 'Shield', counterAmount: 1, count: 3 }],
  },
  {
    id:'pull-from-tomorrow',
    name:'Pull from Tomorrow',
    costLabel:'{X}{U}{U}',
    type:'instant',
    text:'Draw X cards, then discard a card.\n'+
    'He knew there was no way back home, back to Zanarkand.',
    imagePath:'/assets/cards/pull-from-tomorrow.webp'
  },
  {
    id: 'pupu-ufo',
    name: "PuPu UFO",
    costLabel: '{2}',
    type: 'creature',
    subtype: 'Artifact Construct Alien',
    power: 0,
    toughness: 4,
    text: "Flying \n Tap: You may put a land card from your hand onto the battlefield.\n" +
      "3: Until end of turn, this creature\u2019s base power becomes equal to the number of Towns you control.",
    imagePath: '/assets/cards/pupu-ufo.webp',
    abilities: [
      {
        id: 'put-land',
        label: 'Put a land from hand onto the battlefield',
        cost: { tap: true },
        effects: [{ type: 'putLandFromHandOntoBattlefield' }],
        effectText: 'You may put a land card from your hand onto the battlefield.',
      },
      {
        id: 'base-power-towns',
        label: 'Base power = Towns you control',
        cost: { manaLabel: '{3}' },
        effects: [{ type: 'setBasePowerUntilEndOfTurnToControlledSubtypeCount', subtype: 'Town' }],
        effectText: "Until end of turn, this creature\u2019s base power becomes equal to the number of Towns you control.",
      },
    ],
  },
  {
    id:'puresteel-paladin',
    name:'Puresteel Paladin',
    costLabel:'{W}{W}',
    type:'creature',
    subtype:'Creature \u2014 Human Knight',
    power: 2,
    toughness: 2,
    text:'Whenever an Equipment you control enters, you may draw a card.\n'+
    'Metalcraft \u2014 Equipment you control have equip {0} as long as you control three or more artifacts.',
    imagePath:'/assets/cards/puresteel-paladin.webp',
    onAnyControlledSubtypeEnterTrigger: { subtypes: ['Equipment'], effects: [{ type: 'mayEffect', effects: [{ type: 'drawCards', amount: 1 }] }] },
    reducesEquipCostToZeroIfMetalcraftActive: true
  },
  {
    id:'purphoros-god-of-the-forge',
    name:'Kefka Palazzo',
    costLabel:'{3}{R}',
    type:'creature',
    subtype:'Legendary Enchantment Creature — God',
    power: 6,
    toughness: 5,
    text:'Indestructible\n'+
    'As long as your devotion to red is less than five, Kefka Palazzo isn’t a creature.\n'+
    'Whenever another creature you control enters, Kefka Palazzo deals 2 damage to each opponent.\n'+
    '{2}{R}: Creatures you control get +1/+0 until end of turn.',
    imagePath:'/assets/cards/purphoros-god-of-the-forge.webp',
    // "...isn't a creature" while devotion to red is below five is deferred -
    // no type-changing mechanic exists in this engine (same unaddressed gap
    // as The Warring Triad's own identical clause).
    onAnyOtherControlledCreatureEnterTrigger: [{ type: 'dealDamageToEachOpponent', amount: 2 }],
    abilities: [
      {
        id: 'kefka-palazzo-pump',
        label: 'Pump',
        cost: { manaLabel: '{2}{R}' },
        effects: [{ type: 'buffOtherCreaturesYouControl', power: 1, toughness: 0 }, { type: 'pumpSelf', power: 1, toughness: 0 }],
        effectText: 'Creatures you control get +1/+0 until end of turn.',
      },
    ],
  },
  {
    id: 'qiqirn-merchant',
    name: 'Qiqirn Merchant',
    costLabel: '{2}{U}',
    type: 'creature',
    power: 1,
    toughness: 4,
    text: "1, Tap: Draw a card, then discard a card. \n" +
      "7, Tap, Sacrifice this creature: Draw three cards. This ability costs 1 less to activate for each Town you control.",
    imagePath: '/assets/cards/qiqirn-merchant.webp',
    abilities: [
      {
        id: 'qiqirn-merchant-loot',
        label: 'Loot',
        cost: { manaLabel: '{1}', tap: true },
        effects: [{ type: 'loot', drawCount: 1, discardCount: 1 }],
        effectText: 'Draw a card, then discard a card.',
      },
      {
        id: 'qiqirn-merchant-draw-three',
        label: 'Draw Three',
        cost: { manaLabel: '{7}', tap: true, sacrificeSelf: true, reducePerControlledSubtype: { subtype: 'Town', amountPerUnit: 1 } },
        effects: [{ type: 'loot', drawCount: 3, discardCount: 0 }],
        effectText: 'Draw three cards. This ability costs 1 less to activate for each Town you control.',
      },
    ],
  },
  {
    id: 'queen-brahne',
    name: 'Queen Brahne',
    costLabel: '{2}{R}',
    type: 'creature',
    subtype: 'Legendary Creature Human Noble',
    power: 2,
    toughness: 1,
    text: "Prowess (Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.) \n " +
      "Whenever Queen Brahne attacks, create a 0/1 black Wizard creature token with “Whenever you cast a noncreature spell, this token deals 1 damage to each opponent.”",
    imagePath: '/assets/cards/queen-brahne.webp',
    noncreatureCastTrigger: { pumpSelf: { power: 1, toughness: 1 } },
    onAttack: [{ type: 'createToken', tokenId: 'token-wizard', tapped: true }],
  },
  {
    id: 'quina-qu-gourmet',
    name: 'Quina, Qu Gourmet',
    costLabel: '{2}{G}',
    type: 'creature',
    subtype: 'Legendary Creature Qu',
    power: 2,
    toughness: 3,
    text: 'If one or more tokens would be created under your control, those tokens plus a 1/1 green Frog creature token are created instead. \n' +
      "2, Sacrifice a Frog: Put a +1/+1 counter on Quina.",
    imagePath: '/assets/cards/quina-qu-gourmet.webp',
    // Deferred - the "whenever a token would be created, also create a
    // Frog" clause is a replacement effect on every CreateTokenEffect in the
    // game, which no general replacement-effect system exists to implement.
    // The Frog-sacrifice ability alone (without its trigger source) wouldn't
    // be worth wiring in isolation.
  },
  {
    id: 'quistis-trepe',
    name: 'Quistis Trepe',
    costLabel: '{2}{U}',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Wizard',
    power: 2,
    toughness: 2,
    text: "Blue Magic — When Quistis Trepe enters, you may cast target instant or sorcery card from a graveyard, " +
      "and mana of any type can be spent to cast that spell. If that spell would be put into a graveyard, exile it instead.",
    imagePath: '/assets/cards/quistis-trepe.webp',
    onEnter: [{ type: 'castTargetInstantOrSorceryFromGraveyardAnyMana' }],
  },
  {
    id: 'qutrub-forayer',
    name: 'Qutrub Forayer',
    costLabel: '{2}{B}',
    type: 'creature',
    power: 3,
    toughness: 2,
    text: 'When this creature enters, choose one — \n' +
      '• Destroy target creature that was dealt damage this turn. \n' +
      '• Exile up to two target cards from a single graveyard.',
    imagePath: '/assets/cards/qutrub-forayer.webp',
    // Only mode 1 is implemented - mode 2 ("exile up to two target cards
    // from a single graveyard") is deferred (no multi-select
    // graveyard-targeting mechanism exists), and there's no choose-a-mode UI
    // for onEnter anyway (see phoenix-down for the same modal gap).
    onEnter: [{ type: 'destroyTarget', targetFilter: 'creatureWithDamageMarked' }],
  },
  {
    id: 'rabanastre-royal-city',
    name: 'Rabanastre, Royal City',
    costLabel: '-',
    type: 'land',
    text: "This land enters tapped.\n Tap: Add R or W.",
    imagePath: '/assets/cards/rabanastre-royal-city.webp',
    entersTapped: true,
    producesMana: ['R', 'W']
  },
  {
    id: 'radiant-grove',
    name: 'Radiant Grove',
    costLabel: '-',
    type: 'land',
    text: '({T}: Add {G} or {W}.) \nThis land enters tapped. \n' +
      '“You’re not really going to see the dead, more like your memories of them. They take on the form of the dead person—an illusion, nothing else.”\n' +
      '—Rikku',
    imagePath: '/assets/cards/radiant-grove.webp',
    entersTapped: true,
    producesMana: ['G', 'W'],
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
    imagePath: '/assets/cards/ragnarok-divine-deliverance.webp',
    onDeath: [{ type: 'destroyTarget', targetFilter: 'anyPermanent' }, { type: 'reanimateTargetFromGraveyard', nonlegendaryPermanentInsteadOfCreature: true }],
  },
  {
    id:'ranger-captain-of-eos',
    name:'Knights of San d’Oria',
    costLabel:'{1}{W}{W}',
    type:'creature',
    subtype:'Creature — Human Soldier Ranger',
    power: 3,
    toughness: 3,
    text:'When this creature enters, you may search your library for a creature card with mana value 1 or less, reveal it, put it into your hand, then shuffle.\n'+
    'Sacrifice this creature: Your opponents can’t cast noncreature spells this turn.',
    onEnter: [{ type: 'searchLibraryForCreatureWithManaValueAtMost', maxManaValue: 1 }],
    abilities: [
      {
        id: 'ranger-captain-of-eos-sac',
        label: "Sacrifice: Opponents can't cast noncreature spells this turn",
        cost: { sacrificeSelf: true },
        effects: [{ type: 'opponentsCantCastNoncreatureSpellsThisTurn' }],
        effectText: "Your opponents can't cast noncreature spells this turn.",
      },
    ],
    imagePath:'/assets/cards/ranger-captain-of-eos.webp'
  },
  {
    id: 'rampant-growth',
    name: 'Rampant Growth',
    costLabel: '{1}{G}',
    type: 'sorcery',
    text: 'Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.\n' +
      '“It is up to the planet to decide. What is best for the planet. What is bad for the planet. All that is bad will disappear.”\n' +
      '—Bugenhagen',
    imagePath: '/assets/cards/rampant-growth.webp',
    onCast: [{ type: 'searchLibraryForBasicLand', toBattlefieldTapped: true }],
  },
  {
    id: 'rampant-rejuvenator',
    name: 'Rampant Rejuvenator',
    costLabel: '{3}{G}',
    type: 'creature',
    subtype: 'Creature Plant Hydra',
    power: 0,
    toughness: 0,
    text: 'This creature enters with two +1/+1 counters on it.\n' +
      'When this creature dies, search your library for up to X basic land cards, where X is this creature’s power, put them onto the battlefield, then shuffle.',
    imagePath: '/assets/cards/rampant-rejuvenator.webp',
    onEnter: [{ type: 'putCounterOnSelf', counterLabel: '+1/+1', counterAmount: 2 }],
    onDeath: [{ type: 'searchLibraryForUpToXBasicLandsEqualToPower' }],
  },
  {
    id: 'random-encounter',
    name: 'Random Encounter',
    costLabel: '{4}{R}{R}',
    type: 'sorcery',
    text: 'Shuffle your library, then mill four cards. Put each creature card milled this way onto the battlefield. ' +
      'They gain haste. At the beginning of the next end step, return those creatures to their owner\u2019s hand.\n' +
      'Flashback 6RR',
    imagePath: '/assets/cards/random-encounter.webp',
    flashback: { cost: '{6}{R}{R}' },
    onCast: [{ type: 'millThenPutCreaturesOntoBattlefield', millCount: 4, grantsHaste: true, thenReturnToHandAtNextEndStep: true }],
  },
  {
    id: 'raubahn-bull-of-ala-mhigo',
    name: 'Raubahn, Bull of Ala Mhigo',
    costLabel: '{1}{R}',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Warrior',
    power: 2,
    toughness: 2,
    text: 'Ward—Pay life equal to Raubahn\u2019s power.\n Whenever Raubahn attacks, attach up to one target Equipment you control to target attacking creature.',
    imagePath: '/assets/cards/raubahn-bull-of-ala-mhigo.webp',
    wardCost: { lifeEqualToOwnPower: true },
    // The attack-trigger "attach up to one target Equipment to target
    // attacking creature" is still deferred - needs a two-target
    // (Equipment + creature) attach effect that doesn't exist (the existing
    // attach effects are all single-target, source-attaches-to-target).
  },
  {
    id: 'reach-the-horizon',
    name: 'Reach the Horizon',
    costLabel: '{3}{G}',
    type: 'sorcery',
    text: 'Search your library for up to two basic land cards and/or Town cards with different names, put them onto the battlefield tapped, then shuffle.',
    imagePath: '/assets/cards/reach-the-horizon.webp',
    onCast: [{ type: 'searchLibraryForBasicLandOrSubtype', subtype: 'Town', toBattlefieldTapped: true, count: 2 }],
  },
  {
    id: 'reanimate',
    name: 'Reanimate',
    costLabel: '{B}',
    type: 'sorcery',
    text: 'Put target creature card from a graveyard onto the battlefield under your control. You lose life equal to that card’s mana value.\n' +
      '“The world is about to learn… the meaning of… fear…”\n' +
      '—Emperor Geshtahl',
    imagePath: '/assets/cards/reanimate.webp',
    onCast: [{ type: 'reanimateTargetFromGraveyard', anyGraveyard: true, loseLifeEqualToManaValue: true }],
  },
  {
    id: 'reaper-s-scythe',
    name: 'Reaper’s Scythe',
    costLabel: '{2}{B}',
    type: 'artifact',
    subtype: 'Artifact — Equipment',
    text: 'Job select\n' +
      'At the beginning of your end step, put a soul counter on this Equipment for each player who lost life this turn.\n' +
      'Equipped creature gets +1/+1 for each soul counter on this Equipment and is an Assassin in addition to its other types.\n' +
      'Death Sickle — Equip {2}',
    imagePath: '/assets/cards/reaper-s-scythe.webp',
    onEnter: [{ type: 'createToken', tokenId: 'token-hero', attachSelfToToken: true }],
    attachesTo: 'creature',
    equipCost: '{2}',
    onOwnEndStep: [{ type: 'putCounterOnSelf', counterLabel: 'soul', counterAmount: 'playersWhoLostLifeThisTurnCount' }],
    equipBuffPerCounter: { counterLabel: 'soul', power: 1, toughness: 1 },
    equipGrantsSubtype: 'Assassin',
  },
  {
    id: 'red-mage-s-rapier',
    name: "Red Mage's Rapier",
    costLabel: '{1}{R}',
    type: 'artifact',
    subtype: 'Equipment',
    text: "Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.) \n" +
      "Equipped creature has “Whenever you cast a noncreature spell, this creature gets +2/+0 until end of turn” and is a Wizard in addition to its other types.\n" +
      "Equip 3",
    onEnter: [{ type: 'createToken', tokenId: 'token-hero', attachSelfToToken: true }],
    attachesTo: 'creature',
    equipCost: '{3}',
    equipGrantsSubtype: 'Wizard',
    equipGrantsNoncreatureCastTrigger: { pumpSelf: { power: 2, toughness: 0 } },
    imagePath: '/assets/cards/red-mage-s-rapier.webp'
  },
  {
    id: 'red-xiii-proud-warrior',
    name: 'Red XIII, Proud Warrior',
    costLabel: '{1}{R}{G}',
    type: 'creature',
    subtype: 'Legendary Creature — Beast Warrior',
    power: 3,
    toughness: 3,
    text: 'Vigilance, trample\n' +
      'Other modified creatures you control have vigilance and trample. (Equipment, Auras you control, and counters are modifications.)\n' +
      'Cosmo Memory — When Red XIII enters, return target Aura or Equipment card from your graveyard to your hand.',
    imagePath: '/assets/cards/red-xiii-proud-warrior.webp',
    staticAnthemForOtherModifiedCreatures: { grantKeywords: ['vigilance', 'trample'] },
    onEnter: [{ type: 'returnTargetAuraOrEquipmentFromGraveyardToHand' }],
  },
  {
    id: 'rejoin-the-fight',
    name: 'Rejoin the Fight',
    costLabel: '{5}{B}',
    type: 'sorcery',
    text: 'Mill three cards. Then starting with the next opponent in turn order, each opponent chooses a creature card in your graveyard that hasn’t been chosen. Return each card chosen this way to the battlefield under your control.\n' +
      '“I have to fight… to protect the people I love, and to make the world a safe place for new lives!”',
    imagePath: '/assets/cards/rejoin-the-fight.webp',
    onCast: [{ type: 'millThenOpponentChoosesCreatureFromYourGraveyardToBattlefield', millCount: 3 }],
  },
  {
    id: 'relentless-x-atm092',
    name: 'Relentless X-ATM092',
    costLabel: '{6}',
    type: 'creature',
    subtype: 'Artifact Creature Robot Spider',
    power: 6,
    toughness: 5,
    text: 'This creature can\u2019t be blocked except by three or more creatures. \n' +
      "8: Return this card from your graveyard to the battlefield tapped with a finality counter on it. " +
      "(If a creature with a finality counter on it would die, exile it instead.)",
    imagePath: '/assets/cards/relentless-x-atm092.webp',
    abilities: [
      {
        id: 'relentless-x-atm092-return',
        label: 'Return',
        cost: { manaLabel: '{8}' },
        effectText: 'Return this card from your graveyard to the battlefield tapped with a finality counter on it.',
        returnSelfFromGraveyard: { tapped: true, counterLabel: 'Finality', counterAmount: 1 },
      },
    ],
    // "Can't be blocked except by three or more creatures" is still
    // deferred - needs a numeric block-threshold beyond menace's fixed two,
    // which this engine doesn't support yet.
  },
  {
    id: 'relic-of-legends',
    name: 'Relic of Legends',
    costLabel: '{3}',
    type: 'artifact',
    text: '{T}: Add one mana of any color.\n' +
      'Tap an untapped legendary creature you control: Add one mana of any color.\n' +
      '“A smile better suits a hero.”\n' +
      '—Haurchefant Greystone',
    imagePath: '/assets/cards/relic-of-legends.webp',
    producesMana: 'any',
    abilities: [
      {
        id: 'relic-of-legends-tap-legendary',
        label: 'Tap a Legendary Creature: Add One Mana of Any Color',
        cost: { tapAnotherLegendaryCreature: true },
        effects: [{ type: 'addOneManaOfChosenColor' }],
        effectText: 'Add one mana of any color.',
      },
    ],
  },
  {
    id: 'relm-s-sketching',
    name: "Relm's Sketching",
    costLabel: '{2}{U}{U}',
    type: 'sorcery',
    text: "Create a token that\u2019s a copy of target artifact, creature, or land.",
    imagePath: '/assets/cards/relm-s-sketching.webp',
    onCast: [{ type: 'createTokenCopyOfTarget' }],
  },
  {
    id: 'reno-and-rude',
    name: 'Reno and Rude',
    costLabel: '{1}{B}',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Assassin',
    power: 2,
    toughness: 1,
    text: "Menace \n Whenever Reno and Rude deals combat damage to a player, exile the top card of that player\u2019s library. " +
      "Then you may sacrifice another creature or artifact. If you do, you may play the exiled card this turn, and mana of any type can be spent to cast it.",
    imagePath: '/assets/cards/reno-and-rude.webp',
    onCombatDamageToPlayer: [{ type: 'exileTopOfTargetPlayerLibraryThenOptionalSacrificeToPlay' }],
  },
  {
    id: 'resentful-revelation',
    name: 'Resentful Revelation',
    costLabel: '{1}{B}',
    type: 'sorcery',
    text: 'Look at the top three cards of your library. Put one of them into your hand and the rest into your graveyard. \n' +
      'Flashback 6B',
    imagePath: '/assets/cards/resentful-revelation.webp',
    onCast: [{ type: 'revealFiltered', count: 3, filterType: ['creature', 'instant', 'sorcery', 'land', 'artifact', 'enchantment'], restDestination: 'graveyard' }],
    flashback: { cost: '{6}{B}' },
  },
  {
    id: 'resourceful-defense',
    name: 'Resourceful Defense',
    costLabel: '{2}{W}',
    type: 'enchantment',
    text: 'Whenever a permanent you control leaves the battlefield, if it had counters on it, put those counters on target permanent you control.\n' +
      '{4}{W}: Move any number of counters from target permanent you control onto a second target permanent you control.',
    imagePath: '/assets/cards/resourceful-defense.webp',
    onOwnPermanentDiesMoveCountersToTarget: true,
    abilities: [
      {
        id: 'resourceful-defense-move',
        label: 'Move Counters',
        cost: { manaLabel: '{4}{W}' },
        effects: [{ type: 'moveAllCountersBetweenTargetPermanents' }],
        effectText: 'Move any number of counters from target permanent you control onto a second target permanent you control.',
      },
    ],
  },
  {
    id: 'restoration-magic',
    name: 'Restoration Magic',
    costLabel: '{W}',
    type: 'instant',
    text: 'Tiered (Choose one additional cost.) \n• Cure — 0 — Target permanent gains hexproof and indestructible until end of turn.\n' +
      "• Cura — 1 — Target permanent gains hexproof and indestructible until end of turn. You gain 3 life.\n" +
      "• Curaga — 3W — Permanents you control gain hexproof and indestructible until end of turn. You gain 6 life.",
    imagePath: '/assets/cards/restoration-magic.webp',
    tieredModes: [
      { label: 'Cure — {0} — Target permanent gains hexproof and indestructible', additionalCost: '{0}', effects: [{ type: 'grantKeywordsToTargetPermanent', keywords: ['hexproof', 'indestructible'] }] },
      {
        label: 'Cura — {1} — Target permanent gains hexproof and indestructible, gain 3 life',
        additionalCost: '{1}',
        effects: [{ type: 'grantKeywordsToTargetPermanent', keywords: ['hexproof', 'indestructible'] }, { type: 'gainLife', amount: 3 }],
      },
      {
        label: 'Curaga — {3}{W} — Permanents you control gain hexproof and indestructible, gain 6 life',
        additionalCost: '{3}{W}',
        effects: [{ type: 'grantKeywordsToControlledPermanents', keywords: ['hexproof', 'indestructible'] }, { type: 'gainLife', amount: 6 }],
      },
    ],
  },
  {
    id: 'retrieve-the-esper',
    name: 'Retrieve the Esper',
    costLabel: '{3}{U}',
    type: 'sorcery',
    text: 'Create a 3/3 blue Robot Warrior artifact creature token. Then if this spell was cast from a graveyard, put two +1/+1 counters on that token. \nFlashback 5U',
    imagePath: '/assets/cards/retrieve-the-esper.webp',
    onCast: [{ type: 'createToken', tokenId: 'token-robot-warrior' }],
    flashback: { cost: '{5}{U}' },
    // The flashback-conditional "+2 counters if cast from a graveyard" bonus
    // is deferred - onCast has no way to know whether it's resolving as a
    // normal cast or a flashback cast (same gap as Nibelheim Aflame).
  },
  {
    id: 'ride-the-shoopuf',
    name: 'Ride the Shoopuf',
    costLabel: '{1}{G}',
    type: 'enchantment',
    text: 'Landfall — Whenever a land you control enters, put a +1/+1 counter on target creature you control. \n' +
      "5GG: This enchantment becomes a 7/7 Beast creature in addition to its other types.",
    imagePath: '/assets/cards/ride-the-shoopuf.webp',
    landfall: { putCounterOnTargetOwnCreature: { counterLabel: '+1/+1', counterAmount: 1 } },
    // "5GG: becomes a 7/7 Beast creature" is deferred - unlike
    // BecomeCreatureUntilEndOfTurnEffect (temporary), this is PERMANENT with
    // a fixed base power/toughness, which no existing mechanism models.
  },
  {
    id: 'rikku-resourceful-guardian',
    name: 'Rikku, Resourceful Guardian',
    costLabel: '{2}{G}{U}',
    type: 'creature',
    subtype: 'Legendary Creature Human Artificer',
    power: 2,
    toughness: 3,
    text: 'Whenever you put one or more counters on a creature, until end of turn, that creature can’t be blocked by creatures your opponents control.\n' +
      'Steal — {1}, {T}: Move a counter from target creature an opponent controls onto target creature you control. Activate only as a sorcery.\n' +
      '“Rikku-approved item coming up!”',
    imagePath: '/assets/cards/rikku-resourceful-guardian.webp',
    onOwnCounterPlacementGrantsRecipientKeyword: 'unblockable',
    abilities: [
      {
        id: 'rikku-steal',
        label: 'Steal',
        cost: { manaLabel: '{1}', tap: true },
        onlyDuringOwnMainPhase: true,
        effects: [{ type: 'moveCounterFromOpponentCreatureToOwnCreature' }],
        effectText: 'Move a counter from target creature an opponent controls onto target creature you control.',
      },
    ],
  },
  {
    id: 'ring-of-the-lucii',
    name: 'Ring of the Lucii',
    costLabel: '{4}',
    type: 'artifact',
    text: 'T: Add MM. \n2, Tap, Pay 1 life: Tap target nonland permanent.',
    imagePath: '/assets/cards/ring-of-the-lucii.webp',
    producesMana: 'C',
    producesManaAmount: 2,
    abilities: [
      {
        id: 'ring-of-the-lucii-tap',
        label: 'Tap',
        cost: { manaLabel: '{2}', tap: true, payLife: 1 },
        effects: [{ type: 'tapTarget', targetFilter: 'nonlandPermanent' }],
        effectText: 'Tap target nonland permanent.',
      },
    ],
  },
  {
    id:'rinoa-angel-wing',
    name:'Rinoa, Angel Wing',
    costLabel:'{2}{W}',
    type:'creature',
    subtype:'Legendary Ceature \u2014 Human Rebel Warlock',
    power: 2,
    toughness: 4,
    text:'At the beginning of combat on your turn, creatures you control with flying get +1/+1 and gain vigilance until end of turn.\n'+
    'Whenever one or more attacking creatures you control die, you may return one of them to the battlefield tapped under its owner\u2019s control with a flying counter on it. Do this only once each turn.',
    imagePath:'/assets/cards/rinoa-angel-wing.webp',
    onOwnCombatBegin: [{ type: 'pumpControlledCreaturesWithKeyword', filterKeyword: 'flying', power: 1, toughness: 1, grantKeywords: ['vigilance'] }],
    // The "whenever one or more attacking creatures you control die, you
    // may return one to the battlefield tapped with a flying counter,
    // once each turn" half is deferred - needs a dedicated
    // attacking-creature-death watcher plus a once-per-turn gate, a
    // meaningfully larger single-card mechanism than this batch's budget
    // covers for a secondary clause.
  },
  {
    id: 'rinoa-heartilly',
    name: 'Rinoa Heartilly',
    costLabel: '{3}{G}{W}',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Rebel Warlock',
    power: 4,
    toughness: 4,
    text: 'When Rinoa Heartilly enters, create Angelo, a legendary 1/1 green and white Dog creature token. \n' +
      'Angelo Cannon — Whenever Rinoa Heartilly attacks, another target creature you control gets +1/+1 until end of turn for each creature you control.',
    imagePath: '/assets/cards/rinoa-heartilly.webp',
    onEnter: [{ type: 'createToken', tokenId: 'token-angelo' }],
    // Angelo Cannon's dynamic per-creature-count scaling on ANOTHER target
    // creature is deferred - PumpAnotherControlledCreatureEffect only
    // supports a fixed amount, and this needs a live count read at
    // resolution time instead.
  },
  {
    id: 'rise-of-the-dark-realms',
    name: 'Rise of the Dark Realms',
    costLabel: '{7}{B}{B}',
    type: 'sorcery',
    text: 'Put all creature cards from all graveyards onto the battlefield under your control.\n' +
      '“You can’t destroy everything! People will always have dreams!”\n' +
      '—Terra Branford',
    imagePath: '/assets/cards/rise-of-the-dark-realms.webp',
    onCast: [{ type: 'putAllCreatureCardsFromAllGraveyardsOntoBattlefield' }],
  },
  {
    id:'rite-of-replication',
    name:'Rite of Replication',
    costLabel:'{2}{U}{U}',
    type:'sorcery',
    text:'Kicker {5} (You may pay an additional {5} as you cast this spell.)\n'+
    'Create a token that’s a copy of target creature. If this spell was kicked, create five of those tokens instead.\n'+
    '“Eorzea is mine by right!”',
    kicker: { cost: 'mana', manaCost: '{5}' },
    onCast: [{ type: 'createTokenCopyOfTarget', creatureOnly: true, count: 'fiveIfKicked' }],
    imagePath:'/assets/cards/rite-of-replication.webp'
  },
  {
    id: 'rogue-s-passage',
    name: 'Rogue’s Passage',
    costLabel: '-',
    type: 'land',
    text: '{T}: Add {C}.\n' +
      '{4}, {T}: Target creature can’t be blocked this turn.\n' +
      '"Make your way out of town through the mines! I’ll try to buy you some time."\n' +
      '—Old man from Narshe',
    imagePath: '/assets/cards/rogue-s-passage.webp',
    producesMana: 'C',
    abilities: [
      {
        id: 'rogue-s-passage-unblockable',
        label: 'Unblockable',
        cost: { manaLabel: '{4}', tap: true },
        effects: [{ type: 'grantKeywordsToTargetPermanent', keywords: ['unblockable'], creatureOnly: true }],
        effectText: "Target creature can't be blocked this turn.",
      },
    ],
  },
  {
    id: 'rook-turret',
    name: 'Rook Turret',
    costLabel: '{3}{U}',
    type: 'creature',
    subtype: 'Artifact',
    power: 3,
    toughness: 3,
    text: 'Flying \nWhenever another artifact you control enters, you may draw a card. If you do, discard a card.',
    // Approximated with discardUpToThenDrawThatMany (discard-of-your-choice
    // first, THEN draw that many) rather than the printed draw-first order -
    // same net "optionally swap one card" outcome, same substitution used
    // for Giott/Rydia/Summon: G.F. Ifrit's identical "may X, if you do Y" shape.
    onAnyArtifactEnterTrigger: [{ type: 'discardUpToThenDrawThatMany', maxCount: 1 }],
    imagePath: '/assets/cards/rook-turret.webp',
  },
  {
    id: 'rosa-resolute-white-mage',
    name: 'Rosa, Resolute White Mage',
    costLabel: '{3}{W}',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Noble Cleric',
    power: 2,
    toughness: 3,
    text: 'Reach \nAt the beginning of combat on your turn, put a +1/+1 counter on target creature you control. ' +
      'It gains lifelink until end of turn. (Damage dealt by the creature also causes you to gain that much life.)',
    imagePath: '/assets/cards/rosa-resolute-white-mage.webp',
    onOwnCombatBegin: [{ type: 'putCounterOnUpToOneOwnCreature', counterLabel: '+1/+1', counterAmount: 1, grantKeyword: 'lifelink' }],
  },
  {
    id: 'rootbound-crag',
    name: 'Rootbound Crag',
    costLabel: '-',
    type: 'land',
    text: 'This land enters tapped unless you control a Mountain or a Forest.\n' +
      '{T}: Add {R} or {G}.\n' +
      '“Did Sephiroth… do this?”\n' +
      '—Cloud Strife',
    imagePath: '/assets/cards/rootbound-crag.webp',
    entersTappedUnlessControlLandNames: ['Mountain', 'Forest'],
    producesMana: ['R', 'G'],
  },
  {
    id: 'rufus-shinra',
    name: 'Rufus Shinra',
    costLabel: '{1}{W}{B}',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Noble',
    power: 2,
    toughness: 4,
    text: 'Whenever Rufus Shinra attacks, if you don’t control a creature named Darkstar, create Darkstar, a legendary 2/2 white and black Dog creature token.',
    imagePath: '/assets/cards/rufus-shinra.webp',
    onAttack: [{ type: 'createTokenIfNotControllingNamed', tokenId: 'token-darkstar', name: 'Darkstar' }],
  },
  {
    id:'ruin-grinder',
    name:'Ruin Grinder',
    costLabel:'{5}{R}',
    type:'creature',
    subtype:'Artifact Creature — Construct',
    power: 7,
    toughness: 4,
    text:'Menace\n'+
    'When this creature dies, each player may discard their hand and draw seven cards.\n'+
    'Mountaincycling {2} ({2}, Discard this card: Search your library for a Mountain card, reveal it, put it into your hand, then shuffle.)\n',
    imagePath:'/assets/cards/ruin-grinder.webp',
    onDeath: [{ type: 'eachPlayerMayDiscardHandAndDrawThenDamageOpponentsWhoDid', drawCount: 7, damageAmount: 0 }],
    cycling: { cost: '{2}', searchLandName: 'Mountain' }
  },
  {
    id: 'ruinous-ultimatum',
    name: 'Ruinous Ultimatum',
    costLabel: '{R}{R}{W}{W}{W}{B}{B}',
    type: 'sorcery',
    text: 'Destroy all nonland permanents your opponents control.\n' +
      '“This little hamlet has too much ’boring’ and not enough ’burning’… Torch everything!”',
    imagePath: '/assets/cards/ruinous-ultimatum.webp',
    onCast: [{ type: 'destroyAll', targetFilter: 'nonlandPermanent', opponentControlledOnly: true }],
  },
  {
    id: 'rugged-prairie',
    name: 'Rugged Prairie',
    costLabel: '-',
    type: 'land',
    text: '{T}: Add {C}.\n' +
      '{R/W}, {T}: Add {R}{R}, {R}{W}, or {W}{W}.\n' +
      '"Corel sure has gone to pot. It used to be a famous coal mining town! Now, it’s nothing but a miserable pit! Me, my bulldozer… everything’s out of work."\n' +
      '—Corel resident',
    imagePath: '/assets/cards/rugged-prairie.webp',
    producesMana: 'C',
    abilities: [
      {
        // Real printed cost is the hybrid symbol {R/W} (pay one R or one W) -
        // approximated as a flat {1} generic, same deviation already used
        // for Sunken Ruins/Fetid Heath's identical filter-land shape.
        id: 'rugged-prairie-filter',
        label: 'Add two mana',
        cost: { manaLabel: '{1}', tap: true },
        effects: [
          {
            type: 'chooseOneMode',
            modes: [
              { label: 'Add {R}{R}', effects: [{ type: 'addMana', colors: { R: 2 } }] },
              { label: 'Add {R}{W}', effects: [{ type: 'addMana', colors: { R: 1, W: 1 } }] },
              { label: 'Add {W}{W}', effects: [{ type: 'addMana', colors: { W: 2 } }] },
            ],
          },
        ],
        effectText: 'Add {R}{R}, {R}{W}, or {W}{W}.',
      },
    ],
  },
  {
    id: 'rydia-s-return',
    name: 'Rydia\u2019s Return',
    costLabel: '{3}{G}{G}',
    type: 'sorcery',
    text: 'Choose one — \n• Creatures you control get +3/+3 until end of turn.\n• Return up to two target permanent cards from your graveyard to your hand.',
    imagePath: '/assets/cards/rydia-s-return.webp',
    onCast: [
      {
        type: 'chooseOneMode',
        modes: [
          { label: 'Creatures you control get +3/+3 until end of turn.', effects: [{ type: 'buffOtherCreaturesYouControl', power: 3, toughness: 3 }] },
          { label: 'Return up to two target permanent cards from your graveyard to your hand.', effects: [{ type: 'returnCreaturesFromGraveyardToHand', count: 2, anyPermanentInsteadOfCreature: true }] },
        ],
      },
    ],
  },
  {
    id: 'rydia-summoner-of-mist',
    name: 'Rydia, Summoner of Mist',
    costLabel: '{R}{G}',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Shaman',
    power: 1,
    toughness: 2,
    text: 'Landfall — Whenever a land you control enters, you may discard a card. If you do, draw a card.\n' +
      'Summon — {X}, {T}: Return target Saga card with mana value X from your graveyard to the battlefield with ' +
      'a finality counter on it. It gains haste until end of turn. Activate only as a sorcery.',
    imagePath: '/assets/cards/rydia-summoner-of-mist.webp',
    landfall: { discardUpToOneThenDraw: true },
    // The Summon ability is still deferred - needs an {X} cost on an
    // ACTIVATED ability (only CAST_CARD/CAST_FROM_GRAVEYARD support
    // chosenX) plus a "mana value exactly X, and must be a Saga" reanimate
    // filter, neither of which exist.
  },
  {
    id: 'sabin-master-monk',
    name: 'Sabin, Master Monk',
    costLabel: '{4}{R}',
    type: 'creature',
    subtype: 'Legendary Creature — Human Noble Monk',
    power: 4,
    toughness: 3,
    text: 'Double strike\n' +
      'Blitz—{2}{R}{R}, Discard a card. (If you cast this spell for its blitz cost, it gains haste and “When this creature dies, draw a card.” Sacrifice it at the beginning of the next end step.)\n' +
      'You may cast this card from your graveyard using its blitz ability.',
    imagePath: '/assets/cards/sabin-master-monk.webp',
    blitz: { cost: '{2}{R}{R}' },
  },
  {
    id: 'sabotender',
    name: 'Sabotender',
    costLabel: '{1}{R}',
    type: 'creature',
    power: 2,
    toughness: 1,
    text: 'Reach \nLandfall — Whenever a land you control enters, this creature deals 1 damage to each opponent.',
    imagePath: '/assets/cards/sabotender.webp',
    landfall: { damageEachOpponent: 1 },
  },
  {
    id: 'sacred-peaks',
    name: 'Sacred Peaks',
    costLabel: '-',
    type: 'land',
    subtype: 'Mountain Plains',
    text: '({T}: Add {R} or {W}.)\n' +
      'This land enters tapped.\n' +
      '"So this is the power of the Warring Triad! With this and my magicite… the world will be mine to command!"\n' +
      '—Emperor Gestahl',
    imagePath: '/assets/cards/sacred-peaks.webp',
    entersTapped: true,
    producesMana: ['R', 'W'],
  },
  {
    id: 'sage-s-nouliths',
    name: 'Sage\u2019s Nouliths',
    costLabel: '{1}{U}',
    type: 'artifact',
    subtype: 'Equipment',
    text: 'Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.) \n' +
      'Equipped creature gets +1/+0, has “Whenever this creature attacks, untap target attacking creature,” and is a Cleric in addition to its other types.\n' +
      'Hagneia — Equip 3',
    onEnter: [{ type: 'createToken', tokenId: 'token-hero', attachSelfToToken: true }],
    attachesTo: 'creature',
    equipCost: '{3}',
    equipBuff: { power: 1, toughness: 0 },
    equipGrantsSubtype: 'Cleric',
    equipGrantsOnAttack: [{ type: 'untapTargetAttacker' }],
    imagePath: '/assets/cards/sage-s-nouliths.webp'
  },
  {
    id: 'sahagin',
    name: 'Sahagin',
    costLabel: '{1}{U}',
    type: 'creature',
    power: 1,
    toughness: 3,
    text: 'Whenever you cast a noncreature spell, if at least four mana was spent to cast it, put a +1/+1 counter on this creature and it can\u2019t be blocked this turn.',
    imagePath: '/assets/cards/sahagin.webp',
    noncreatureCastTrigger: { counterIfExpensive: { minManaValue: 4, counterLabel: '+1/+1', counterAmount: 1, grantKeyword: 'unblockable' } },
  },
  {
    id: 'samurai-s-katana',
    name: 'Samurai\u2019s Katana',
    costLabel: '{2}{R}',
    type: 'artifact',
    subtype: 'Equipment',
    text: 'Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.)\n' +
      'Equipped creature gets +2/+2, has trample and haste, and is a Samurai in addition to its other types. \n' +
      'Murasame — Equip 5',
    onEnter: [{ type: 'createToken', tokenId: 'token-hero', attachSelfToToken: true }],
    attachesTo: 'creature',
    equipCost: '{5}',
    equipBuff: { power: 2, toughness: 2 },
    equipGrantsKeyword: ['trample', 'haste'],
    equipGrantsSubtype: 'Samurai',
    imagePath: '/assets/cards/samurai-s-katana.webp'
  },
  {
    id: 'sandworm',
    name: 'Sandworm',
    costLabel: '{4}{R}',
    type: 'creature',
    power: 5,
    toughness: 4,
    text: 'Haste \n' +
      'When this creature enters, destroy target land. Its controller may search their library for a basic land card, put it onto the battlefield tapped, then shuffle.',
    imagePath: '/assets/cards/sandworm.webp',
    onEnter: [{ type: 'destroyTarget', targetFilter: 'land' }],
    // The destroyed land's controller's optional replacement search is
    // deferred - no mechanism links a follow-up effect to "whoever just lost
    // the thing that was destroyed".
  },
  {
    id: 'sazh-katzroy',
    name: 'Sazh Katzro',
    costLabel: '{3}{G}',
    type: 'creature',
    subtype: 'Legendary Creature \u2014 Human Pilot',
    power: 3,
    toughness: 3,
    text: 'When Sazh Katzroy enters, you may search your library for a Bird or basic land card, reveal it, put it into your hand, then shuffle.\n' +
      'Whenever Sazh Katzroy attacks, put a +1/+1 counter on target creature, then double the number of +1/+1 counters on that creature.',
    onEnter: [{ type: 'searchLibraryForBasicLandOrSubtype', subtype: 'Bird' }],
    imagePath: '/assets/cards/sazh-katzroy.webp',
    // The attack trigger is still deferred - it needs a counter-doubling
    // mechanism (put a +1/+1 counter, THEN double however many are on that
    // creature) that doesn't exist yet. The ETB tutor's OR-filter search
    // (Bird or basic land) is now wired via LibrarySearchFilter's
    // 'basicLandOrSubtype' kind.
  },
  {
    id: 'sazh-s-chocobo',
    name: 'Sazh\u2019s Chocobo',
    costLabel: '{G}',
    type: 'creature',
    subtype: 'Bird',
    power: 0,
    toughness: 1,
    text: 'Landfall — Whenever a land you control enters, put a +1/+1 counter on this creature.',
    imagePath: '/assets/cards/sazh-s-chocobo.webp',
    landfall: { counterLabel: '+1/+1', counterAmount: 1 },
  },
  {
    id: 'scavenger-grounds',
    name: 'Scavenger Grounds',
    costLabel: '-',
    type: 'land',
    text: '{T}: Add {C}.\n' +
      '{2}, {T}, Sacrifice a Desert: Exile all graveyards.\n' +
      '“The Burn”—once a verdant region teeming with flora and fauna, repeated summonings saw it bled of aether and reduced to a barren desert.',
    imagePath: '/assets/cards/scavenger-grounds.webp',
    producesMana: ['C'],
    abilities: [
      {
        id: 'scavenger-grounds-exile',
        label: 'Exile all graveyards',
        cost: { manaLabel: '{2}', tap: true, sacrificeAnotherWithSubtype: 'Desert' },
        effects: [{ type: 'exileAllGraveyards' }],
        effectText: 'Exile all graveyards.',
      },
    ],
  },
  {
    id: 'scholar-of-new-horizons',
    name: 'Scholar of New Horizons',
    costLabel: '{1}{W}',
    type: 'creature',
    subtype: 'Creature Scout',
    power: 1,
    toughness: 1,
    text: 'This creature enters with a +1/+1 counter on it.\n' +
      '{T}, Remove a counter from a permanent you control: Search your library for a Plains card and reveal it. If an opponent controls more lands than you, you may put that card onto the battlefield tapped. If you don’t put the card onto the battlefield, put it into your hand. Then shuffle.',
    imagePath: '/assets/cards/scholar-of-new-horizons.webp',
    onEnter: [{ type: 'putCounterOnSelf', counterLabel: '+1/+1', counterAmount: 1 }],
    abilities: [
      {
        id: 'scholar-of-new-horizons-search',
        label: 'Search for Plains',
        cost: { tap: true, removeCounterFromAnotherPermanent: 'any' },
        effects: [{ type: 'searchLibraryForLandConditionalBattlefieldIfOpponentHasMoreLands', landName: 'Plains' }],
        effectText: 'Search your library for a Plains card and reveal it. If an opponent controls more lands than you, put it onto the battlefield tapped - otherwise into your hand.',
      },
    ],
  },
  {
    id: 'scorpion-sentinel',
    name: 'Scorpion Sentinel',
    costLabel: '{1}{U}',
    type: 'creature',
    subtype: 'artifact Robot Scorpion',
    power: 1,
    toughness: 4,
    text: 'As long as you control seven or more lands, this creature gets +3/+0.',
    landCountBuff: { minLands: 7, power: 3, toughness: 0 },
    imagePath: '/assets/cards/scorpion-sentinel.webp'
  },
  {
    id:'search-for-dagger',
    name:'Search for Dagger',
    costLabel:'{1}{W}',
    type:'enchantment',
    text:'Whenever your commander enters or attacks, look at the top six cards of your library. You may reveal a legendary creature card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.\n'+
    '“Dagger is more important to me than anything else.”',
    imagePath:'/assets/cards/search-for-dagger.webp',
    onCommanderEnterOrAttack: [{ type: 'revealFiltered', count: 6, filterType: 'creature', filterSubtype: 'legendary' }],
  },
  {
    id: 'seaside-citadel',
    name: 'Seaside Citadel',
    costLabel: '-',
    type: 'land',
    text: 'This land enters tapped.\n' +
      '{T}: Add {G}, {W}, or {U}.\n' +
      '“I lived in the city of Bevelle until ten years ago. It\u2019s the biggest city in Spira! The main temple of Yevon is there.”\n' +
      '—Yuna',
    imagePath: '/assets/cards/seaside-citadel.webp',
    entersTapped: true,
    producesMana: ['G', 'W', 'U'],
  },
  {
    id: 'secret-rendezvous',
    name: 'Secret Rendezvous',
    costLabel: '{1}{W}{W}',
    type: 'sorcery',
    text: 'You and target opponent each draw three cards.\n' +
      '"Ok, I\u2019m going to just go ahead and say it…"',
    imagePath: '/assets/cards/secret-rendezvous.webp',
    onCast: [{ type: 'drawCardsFromTargetPlayer', count: 3, opponentOnly: true, alsoCasterDraws: true }],
  },
  {
    id: 'seifer-almasy',
    name: 'Seifer Almasy',
    costLabel: '{3}{R}',
    type: 'creature',
    subtype: 'Legendary Creature Human Knight',
    power: 3,
    toughness: 4,
    text: 'Whenever a creature you control attacks alone, it gains double strike until end of turn. \n' +
      'Fire Cross — Whenever Seifer Almasy deals combat damage to a player, you may cast target instant or ' +
      'sorcery card with mana value 3 or less from your graveyard without paying its mana cost. If that spell would be put into your graveyard, exile it instead.',
    imagePath: '/assets/cards/seifer-almasy.webp',
    attacksAloneGrantsKeyword: 'double strike',
    // Without this, Seifer's own text mentioning "double strike" (describing
    // the temporary grant attacksAloneGrantsKeyword already implements)
    // would falsely self-apply it PERMANENTLY via the plain substring
    // keyword check, regardless of whether he actually attacked alone.
    excludeSelfKeywords: ['double strike'],
    // Fire Cross is deferred - no mechanism casts an arbitrary targeted
    // instant/sorcery from a graveyard for free (this engine has no
    // stack/cast simulation reusable outside the normal hand-casting flow;
    // same gap as Quistis Trepe).
  },
  {
    id:'seifer-balamb-rival',
    name:'Seifer, Balamb Rival',
    costLabel:'{2}{B}{R}',
    type:'creature',
    subtype:'Legendary Creature \u2014 Human Mercenary',
    power: 4,
    toughness: 3,
    text:'First strike\n'+
    'Whenever you attack a player, goad target creature that player controls.\n'+
    'Whenever a creature attacking one of your opponents becomes blocked by two or more creatures, that attacking creature gains deathtouch until end of turn.',
    imagePath:'/assets/cards/seifer-balamb-rival.webp',
    onOwnAttackGoadTargetOpponentCreature: true,
    grantsDeathtouchToOwnAttackerBlockedByTwoOrMore: true,
  },
  {
    id: 'self-destruct',
    name: 'Self-Destruct',
    costLabel: '{1}{R}',
    type: 'instant',
    text: 'Target creature you control deals X damage to any other target and X damage to itself, where X is its power.',
    imagePath: '/assets/cards/self-destruct.webp',
    onCast: [{ type: 'dealDamageToAnyOtherTargetAndSelf' }],
  },
  {
    id: 'sephiroth-fabled-soldier',
    name: 'Sephiroth, Fabled SOLDIER',
    costLabel: '{2}{B}',
    type: 'creature',
    subtype: 'Legendary Creature Human Avatar Soldier',
    power: 3,
    toughness: 3,
    text: 'Whenever Sephiroth enters or attacks, you may sacrifice another creature. If you do, draw a card.\n' +
      'Whenever another creature dies, target opponent loses 1 life and you gain 1 life. If this is the fourth time this ability has resolved this turn, transform Sephiroth.',
    imagePath: '/assets/cards/sephiroth-fabled-soldier.webp',
    transformsInto: 'sephiroth-one-winged-angel',
    // Both abilities deferred - the enters-or-attacks sacrifice-for-a-card
    // is the established "may sacrifice X, if you do Y" gap, and the
    // death-drain-with-a-per-turn-resolution-counter-that-transforms is a
    // one-off tracking mechanism this engine doesn't have.
  },
  {
    id: 'sephiroth-fallen-hero',
    name: 'Sephiroth, Fallen Hero',
    costLabel: '{3}{R}{W}',
    type: 'creature',
    subtype: 'Legendary Creature — Human Avatar Soldier',
    power: 7,
    toughness: 5,
    text: 'Jenova Cells — Whenever Sephiroth attacks, you may put a cell counter on target creature. Until end of turn, each modified creature you control has base power and toughness 7/5. (Equipment, Auras you control, and counters are modifications.)\n' +
      'The Reunion — {3}, Sacrifice a modified creature: Return this card from your graveyard to the battlefield tapped.',
    imagePath: '/assets/cards/sephiroth-fallen-hero.webp',
    onAttack: [{ type: 'jenovaCellsAttackTrigger', counterLabel: 'cell', power: 7, toughness: 5 }],
    abilities: [
      {
        id: 'sephiroth-fallen-hero-reunion',
        label: 'The Reunion',
        cost: { manaLabel: '{3}', sacrificeAnotherModifiedCreature: true },
        effectText: 'Return this card from your graveyard to the battlefield tapped.',
        returnSelfFromGraveyard: { tapped: true },
      },
    ],
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
    imagePath: '/assets/cards/sephiroth-one-winged-angel.webp',
    // Both deferred - emblems are an established gap (no emblem system),
    // and "sacrifice any number of other creatures, draw that many" needs a
    // general "any number of X" multi-select mechanism that doesn't exist.
  },
  {
    id: 'sephiroth-planet-s-heir',
    name: 'Sephiroth, Planet\u2019s Heir',
    costLabel: '{4}{U}{B}',
    type: 'creature',
    subtype: 'Legendary Creature Human Avatar Soldier',
    power: 4,
    toughness: 4,
    text: 'Vigilance (Attacking doesn\u2019t cause this creature to tap.) \n' +
      'When Sephiroth enters, creatures your opponents control get -2/-2 until end of turn. \n' +
      'Whenever a creature an opponent controls dies, put a +1/+1 counter on Sephiroth.',
    imagePath: '/assets/cards/sephiroth-planet-s-heir.webp',
    onEnter: [{ type: 'debuffOpponentCreatures', power: -2, toughness: -2 }],
    // "Whenever a creature an opponent controls dies, put a counter on
    // Sephiroth" is deferred - onAnyDeathCounterSelf/onAnyDeathDrain only
    // watch the CONTROLLER's own creatures dying, not an opponent's.
  },
  {
    id: 'sephiroth-s-intervention',
    name: 'Sephiroth\u2019s Intervention',
    costLabel: '{3}{B}',
    type: 'instant',
    text: 'Destroy target creature. You gain 2 life.',
    imagePath: '/assets/cards/sephiroth-s-intervention.webp',
    onCast: [{ type: 'destroyTarget', targetFilter: 'creature' }, { type: 'gainLife', amount: 2 }],
  },
  {
    id: 'sepulchral-primordial',
    name: 'Sepulchral Primordial',
    costLabel: '{5}{B}{B}',
    type: 'creature',
    subtype: 'Creature — Avatar',
    power: 5,
    toughness: 4,
    text: 'Intimidate (This creature can’t be blocked except by artifact creatures and/or creatures that share a color with it.)\n' +
      'When this creature enters, for each opponent, you may put up to one target creature card from that player’s graveyard onto the battlefield under your control.',
    imagePath: '/assets/cards/sepulchral-primordial.webp',
    onEnter: [{ type: 'reanimateTargetFromGraveyard', opponentGraveyardOnly: true, optional: true }],
  },
  {
    id: 'serah-farron',
    name: 'Serah Farron',
    costLabel: '{1}{G}{W}',
    type: 'creature',
    subtype: 'Legendary Creature Human Citizen',
    power: 2,
    toughness: 2,
    text: 'The first legendary creature spell you cast each turn costs 2 less to cast. \n' +
      'At the beginning of combat on your turn, if you control two or more other legendary creatures, you may transform Serah Farron.',
    imagePath: '/assets/cards/serah-farron.webp',
    transformsInto: 'crystallized-serah',
    reducesCastCostForFirstLegendaryCreatureSpellEachTurn: 2,
    // The transform condition ("at the beginning of combat, if you control
    // two or more other legendary creatures, you may transform") is still
    // deferred - needs its own onOwnCombatBegin check with a controlled-
    // legendary-creature-count condition and an optional (may) transform,
    // neither of which exists as a combined shape yet.
  },
  {
    id: 'crystallized-serah',
    name: 'Crystallized Serah',
    costLabel: '-',
    type: 'artifact',
    subtype: 'Legendary Artifact',
    text: 'The first legendary creature spell you cast each turn costs 2 less to cast. \n' +
      'Legendary creatures you control get +2/+2.',
    imagePath: '/assets/cards/crystallized-serah.webp',
    reducesCastCostForFirstLegendaryCreatureSpellEachTurn: 2,
    staticAnthemForControlledSubtype: { subtype: 'legendary', power: 2, toughness: 2 },
  },
  {
    id: 'setzer-wandering-gambler',
    name: 'Setzer, Wandering Gambler',
    costLabel: '{1}{B}{R}',
    type: 'creature',
    subtype: 'Legendary Creature — Human Rogue Pilot',
    power: 2,
    toughness: 2,
    text: 'When Setzer enters, create The Blackjack, a legendary 3/3 colorless Vehicle artifact token with flying and crew 2.\n' +
      'Whenever a Vehicle you control deals combat damage to a player, flip a coin.\n' +
      'Whenever you win a coin flip, create two tapped Treasure tokens.',
    imagePath: '/assets/cards/setzer-wandering-gambler.webp',
    onEnter: [{ type: 'createToken', tokenId: 'token-the-blackjack' }],
    onAnyControlledVehicleCombatDamageToPlayer: [{ type: 'coinFlip', ifWinEffects: [] }],
    onWinCoinFlip: [{ type: 'createToken', tokenId: 'token-treasure', count: 2, tapped: true }],
  },
  {
    id: 'seymour-flux',
    name: 'Seymour Flux',
    costLabel: '{4}{B}',
    type: 'creature',
    subtype: 'Legendary Creature Spirit Avatar',
    power: 5,
    toughness: 5,
    text: 'At the beginning of your upkeep, you may pay 1 life. If you do, draw a card and put a +1/+1 counter on Seymour Flux.',
    imagePath: '/assets/cards/seymour-flux.webp',
    onOwnUpkeep: [
      {
        type: 'mayPayLifeThenEffect',
        lifeCost: 1,
        effects: [{ type: 'drawCards', amount: 1 }, { type: 'putCounterOnSelf', counterLabel: '+1/+1', counterAmount: 1 }],
      },
    ],
  },
  {
    id: 'shadow-mysterious-assassin',
    name: 'Shadow, Mysterious Assassin',
    costLabel: '{2}{B}',
    type: 'creature',
    subtype: 'Legendary Creature — Human Assassin',
    power: 3,
    toughness: 3,
    text: 'Deathtouch\n' +
      'Throw — Whenever Shadow deals combat damage to a player, you may sacrifice another nonland permanent. If you do, draw two cards and each opponent loses life equal to the mana value of the sacrificed permanent.',
    imagePath: '/assets/cards/shadow-mysterious-assassin.webp',
    onCombatDamageToPlayer: [{ type: 'maySacrificeAnotherNonlandPermanentThenDrawAndOpponentsLoseLifeEqualToManaValue', drawCount: 2 }],
  },
  {
    id: 'shadowblood-ridge',
    name: 'Shadowblood Ridge',
    costLabel: '-',
    type: 'land',
    text: '{1}, {T}: Add {B}{R}.\n' +
      '“The time has come for us to claim our rightful dominion over the world!”\n' +
      '—Emperor Gestahl',
    imagePath: '/assets/cards/shadowblood-ridge.webp',
    abilities: [
      {
        id: 'shadowblood-ridge-add',
        label: 'Add {B}{R}',
        cost: { manaLabel: '{1}', tap: true },
        effects: [{ type: 'addMana', colors: { B: 1, R: 1 } }],
        effectText: 'Add {B}{R}.',
      },
    ],
  },
  {
    id: 'shambling-cie-th',
    name: 'Shambling Cie\u2019th',
    costLabel: '{2}{B}',
    type: 'creature',
    power: 3,
    toughness: 3,
    text: 'This creature enters tapped. \n' +
      'Whenever you cast a noncreature spell, you may pay B. If you do, return this card from your graveyard to your hand.',
    imagePath: '/assets/cards/shambling-cie-th.webp',
    entersTapped: true,
    // The graveyard-recursion trigger is deferred - another instance of the
    // established optional-cost-for-benefit gap.
  },
  {
    id: 'shantotto-tactician-magician',
    name: 'Shantotto, Tactician Magician',
    costLabel: '{1}{U}{R}',
    type: 'creature',
    subtype: 'Legendary Creature Dwarf Wizard',
    power: 0,
    toughness: 4,
    text: 'Whenever you cast a noncreature spell, Shantotto gets +X/+0 until end of turn, where X is the amount of mana spent to cast that spell. If X is 4 or more, draw a card.',
    imagePath: '/assets/cards/shantotto-tactician-magician.webp',
    noncreatureCastTrigger: { pumpSelfByManaSpent: { drawIfAtLeast: 4 } },
  },
  {
    id: 'sharlayan-nation-of-scholars',
    name: 'Sharlayan, Nation of Scholars',
    costLabel: '-',
    type: 'land',
    text: 'This land enters tapped. \nTap: Add W or U.',
    imagePath: '/assets/cards/sharlayan-nation-of-scholars.webp',
    entersTapped: true,
    producesMana: ['W', 'U']
  },
  {
    id: 'shelinda-yevon-acolyte',
    name: 'Shelinda Yevon, Acolyte',
    costLabel: '{G}{W}',
    type: 'creature',
    subtype: 'Legendary Creature Human Cleric',
    power: 2,
    toughness: 2,
    text: 'Lifelink\n' +
      'Whenever another creature you control enters, put a +1/+1 counter on that creature if its power is less than Shelinda’s power. Otherwise, put a +1/+1 counter on Shelinda.\n' +
      '“Truly, I know nothing of the ways of fighting, but I do know some white magic.”',
    imagePath: '/assets/cards/shelinda-yevon-acolyte.webp',
    onAnyOtherControlledCreatureEnterComparePowerPutCounter: { counterLabel: '+1/+1' },
  },
  {
    id: 'shineshadow-snarl',
    name: 'Shineshadow Snarl',
    costLabel: '-',
    type: 'land',
    text: 'As this land enters, you may reveal a Plains or Swamp card from your hand. If you don’t, this land enters tapped.\n' +
      '{T}: Add {W} or {B}.\n' +
      'Reports of bloody carnage have reached the Crystarium, and the guard has deployed in force in answer to Holminster’s plea for aid.',
    imagePath: '/assets/cards/shineshadow-snarl.webp',
    entersTappedUnlessRevealLandNames: ['Plains', 'Swamp'],
    producesMana: ['W', 'B'],
  },
  {
    id: 'shinra-reinforcements',
    name: 'Shinra Reinforcement',
    costLabel: '{2}{B}',
    type: 'creature',
    power: 2,
    toughness: 3,
    text: 'When this creature enters, mill three cards and you gain 3 life.',
    imagePath: '/assets/cards/shinra-reinforcements.webp',
    onEnter: [{ type: 'millSelf', count: 3 }, { type: 'gainLife', amount: 3 }],
  },
  {
    id: 'sidequest-card-collection',
    name: 'Sidequest: Card Collection',
    costLabel: '{3}{U}',
    type: 'enchantment',
    text: 'When this enchantment enters, draw three cards, then discard two cards. \n' +
      'At the beginning of your end step, if eight or more cards are in your graveyard, transform this enchantment.',
    imagePath: '/assets/cards/sidequest-card-collection.webp',
    onEnter: [{ type: 'loot', drawCount: 3, discardCount: 2 }],
    // The transform trigger is deferred - this card has no printed back
    // face/transformsInto target defined anywhere in this set, so there's
    // nothing for transformSelfIfGraveyardSizeAtLeast to point to.
  },
  {
    id: 'sidequest-catch-a-fish',
    name: 'Sidequest: Catch a Fish',
    costLabel: '{2}{W}',
    type: 'enchantment',
    text: 'At the beginning of your upkeep, look at the top card of your library. If it\u2019s an artifact or creature card, ' +
      'you may reveal it and put it into your hand. If you put a card into your hand this way, create a Food token and transform this enchantment.',
    imagePath: '/assets/cards/sidequest-catch-a-fish.webp',
    transformsInto: 'cooking-campsite',
    // Deferred - "look at the top card, if it's an artifact/creature you may
    // reveal and put it into hand" is a conditional-optional library peek
    // this engine has no mechanism for, and the Food token + transform are
    // both gated on that same optional pick actually happening.
  },
  {
    id: 'cooking-campsite',
    name: 'Cooking Campsite',
    costLabel: '-',
    type: 'land',
    text: ': Add W. \n ' +
      '3, Tap, Sacrifice an artifact: Put a +1/+1 counter on each creature you control. Activate only as a sorcery.',
    imagePath: '/assets/cards/cooking-campsite.webp',
    producesMana: 'W',
    // Implemented fully even though the front face's transform trigger that
    // would reach this card is deferred (see sidequest-catch-a-fish) -
    // matches this session's convention of keeping back faces functional
    // regardless of front-face reachability.
    abilities: [
      {
        id: 'cooking-campsite-counters',
        label: 'Cook',
        cost: { manaLabel: '{3}', tap: true, sacrificeAnother: 'artifact' },
        onlyDuringOwnMainPhase: true,
        effects: [{ type: 'buffOtherCreaturesYouControl', counterLabel: '+1/+1', counterAmount: 1 }],
        effectText: 'Put a +1/+1 counter on each creature you control.',
      },
    ],
  },
  {
    id: 'sidequest-hunt-the-mark',
    name: 'Sidequest: Hunt the Mark',
    costLabel: '{3}{B}{B}',
    type: 'enchantment',
    text: 'When this enchantment enters, destroy up to one target creature.\n' +
      'At the beginning of your end step, if a creature died under an opponent\u2019s control this turn, ' +
      'create a Treasure token. Then if you control three or more Treasures, transform this enchantment.',
    imagePath: '/assets/cards/sidequest-hunt-the-mark.webp',
    transformsInto: 'yiazmat-ultimate-mark',
    onEnter: [{ type: 'destroyTarget', targetFilter: 'creature', optional: true }],
    // The end-step Treasure-creation/transform chain is deferred - "a
    // creature died under an OPPONENT's control this turn" isn't tracked
    // (creaturesDiedThisTurn is a single global counter, not per-controller).
  },
  {
    id: 'yiazmat-ultimate-mark',
    name: 'Yiazmat, Ultimate Mark',
    costLabel: '-',
    type: 'creature',
    subtype: 'Legendary Creature Dragon',
    power: 5,
    toughness: 6,
    text: '1B, Sacrifice another creature or artifact: Yiazmat gains indestructible until end of turn. Tap it.',
    imagePath: '/assets/cards/yiazmat-ultimate-mark.webp',
    // Implemented fully even though the front face's transform trigger that
    // would reach this card is deferred (see sidequest-hunt-the-mark).
    abilities: [
      {
        id: 'yiazmat-ultimate-mark-activate',
        label: 'Activate',
        cost: { manaLabel: '{1}{B}', sacrificeAnother: 'artifactOrCreature' },
        effects: [{ type: 'pumpSelf', power: 0, toughness: 0, grantKeyword: 'indestructible', tapSelf: true }],
        effectText: 'Yiazmat gains indestructible until end of turn. Tap it.',
      },
    ],
  },
  {
    id: 'sidequest-play-blitzball',
    name: 'Sidequest: Play Blitzbal',
    costLabel: '{2}{R}',
    type: 'enchantment',
    text: 'At the beginning of combat on your turn, target creature you control gets +2/+0 until end of turn.\n' +
      'At the end of combat on your turn, if a player was dealt 6 or more combat damage this turn, transform this enchantment, then attach it to a creature you control.',
    imagePath: '/assets/cards/sidequest-play-blitzball.webp',
    transformsInto: 'world-champion-celestial-weapon',
    onOwnCombatBegin: [{ type: 'pumpAnotherControlledCreature', power: 2, toughness: 0 }],
    // "target creature you control" is approximated via
    // PumpAnotherControlledCreatureEffect (excludes the source, which isn't
    // a creature anyway, so this is effectively "any creature you control").
    // The end-of-combat transform-then-attach chain is deferred - there's no
    // "end of combat" trigger phase hook, no combat-damage-dealt-this-turn
    // tracking, and no "transform, then immediately attach the new face"
    // mechanism.
  },
  {
    id: 'world-champion-celestial-weapon',
    name: 'World Champion, Celestial Weapon',
    costLabel: '-',
    type: 'artifact',
    subtype: 'Legendary Artifact Equipment',
    text: 'Double Overdrive — Equipped creature gets +2/+0 and has double strike. \n' +
      'Equip 3 (3: Attach to target creature you control. Equip only as a sorcery.)',
    attachesTo: 'creature',
    equipCost: '{3}',
    equipBuff: { power: 2, toughness: 0 },
    equipGrantsKeyword: 'double strike',
    imagePath: '/assets/cards/world-champion-celestial-weapon.webp'
  },
  {
    id: 'sidequest-raise-a-chocobo',
    name: 'Sidequest: Raise a Chocobo',
    costLabel: '{1}{G}',
    type: 'enchantment',
    text: 'When this enchantment enters, create a 2/2 green Bird creature token with “Whenever a land you control enters, this token gets +1/+0 until end of turn.”\n' +
      'At the beginning of your first main phase, if you control four or more Birds, transform this enchantment.',
    onEnter: [{ type: 'createToken', tokenId: 'token-bird' }],
    onOwnFirstMainPhase: [{ type: 'transformSelfIfControlledSubtypeCountAtLeast', subtype: 'Bird', minCount: 4 }],
    imagePath: '/assets/cards/sidequest-raise-a-chocobo.webp',
    transformsInto: 'black-chocobo'
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
    imagePath: '/assets/cards/black-chocobo.webp',
    landfall: { pumpControlledSubtype: { subtype: 'Bird', power: 1, toughness: 0 } },
    // The transform-trigger "search your library for a land card" is
    // deferred - every search effect in this engine targets an exact card
    // name (or a fixed basic-land-type list), and there's no "any land,
    // no name restriction" search variant.
  },
  {
    id: 'siegfried-famed-swordsman',
    name: 'Siegfried, Famed Swordsman',
    costLabel: '{3}{B}',
    type: 'creature',
    subtype: 'Legendary Creature — Human Warrior Rogue',
    power: 2,
    toughness: 2,
    text: 'Menace\n' +
      'When Siegfried enters, mill three cards. Then put X +1/+1 counters on Siegfried, where X is twice the number of creature cards in your graveyard.\n' +
      'Recent rumors speak of an impostor that shows up and masquerades as Siegfried himself.',
    imagePath: '/assets/cards/siegfried-famed-swordsman.webp',
    onEnter: [{ type: 'millSelf', count: 3 }, { type: 'putCounterOnSelf', counterLabel: '+1/+1', counterAmount: 'twiceGraveyardCreatureCount' }],
  },
  {
    id: 'sin-spira-s-punishment',
    name: 'Sin, Spira\u2019s Punishment',
    costLabel: '{4}{B}{G}{U}',
    type: 'creature',
    subtype: 'Legendary Creature Leviathan Avatar',
    power: 7,
    toughness: 7,
    text: 'Flying \n' +
      'Whenever Sin enters or attacks, exile a permanent card from your graveyard at random, then create a tapped token that\u2019s a copy of that card. ' +
      'If the exiled card is a land card, repeat this process.',
    onEnter: [{ type: 'randomGraveyardCopy', repeatOnLand: true }],
    onAttack: [{ type: 'randomGraveyardCopy', repeatOnLand: true }],
    imagePath: '/assets/cards/sin-spira-s-punishment.webp'
  },
  {
    id: 'sin-unending-cataclysm',
    name: 'Sin, Unending Cataclysm',
    costLabel: '{5}{G}{U}',
    type: 'creature',
    subtype: 'Legendary Creature Leviathan Avatar',
    power: 5,
    toughness: 5,
    text: 'Flying, trample\n' +
      'As Sin enters, remove all counters from any number of artifacts, creatures, and enchantments. Sin enters with X +1/+1 counters on it, where X is twice the number of counters removed this way.\n' +
      'When Sin dies, put its counters on target creature you control, then shuffle this card into its owner\u2019s library.',
    imagePath: '/assets/cards/sin-unending-cataclysm.webp',
    onEnter: [{ type: 'removeAllCountersEnterWithDoubleAsCounter', counterLabel: '+1/+1' }],
    onDeath: [{ type: 'putOwnCountersOnTargetThenShuffleSelfIntoLibrary' }],
  },
  {
    id: 'skullclamp',
    name: 'Skullclamp',
    costLabel: '{1}',
    type: 'artifact',
    subtype: 'Artifact Equipment',
    text: 'Equipped creature gets +1/-1.\n' +
      'Whenever equipped creature dies, draw two cards.\n' +
      'Equip {1}\n' +
      '“My mother\u2019s name is Jenova… \u2019The Jenova Project\u2019… is this just a coincidence?”\n' +
      '—Sephiroth',
    imagePath: '/assets/cards/skullclamp.webp',
    equipBuff: { power: 1, toughness: -1 },
    equipGrantsOnDeath: [{ type: 'drawCards', amount: 2 }],
    equipCost: '{1}',
    attachesTo: 'creature',
  },
  {
    id: 'skycloud-expanse',
    name: 'Skycloud Expanse',
    costLabel: '-',
    type: 'land',
    text: '{1}, {T}: Add {W}{U}.\n' +
      '“Deep within the Sea of Clouds, beyond treacherous winds and swirling rock, lies a land like no other. Isles—nay, pristine jewels—clustered about a massive floating crystal.”\n' +
      '—Diadem mission commander',
    imagePath: '/assets/cards/skycloud-expanse.webp',
    abilities: [
      {
        id: 'skycloud-expanse-filter',
        label: 'Add {W}{U}',
        cost: { manaLabel: '{1}', tap: true },
        effects: [{ type: 'addMana', colors: { W: 1, U: 1 } }],
        effectText: 'Add {W}{U}.',
      },
    ],
  },
  {
    id: 'slash-of-light',
    name: 'Slash of Light',
    costLabel: '{1}{W}',
    type: 'instant',
    text: 'Slash of Light deals damage equal to the number of creatures you control plus the number of Equipment you control to target creature.',
    imagePath: '/assets/cards/slash-of-light.webp',
    onCast: [{ type: 'damageTargetCreatureEqualToCreaturesAndEquipment' }],
  },
  {
    id: 'slayers-stronghold',
    name: 'Slayers’ Stronghold',
    costLabel: '-',
    type: 'land',
    text: '{T}: Add {C}.\n' +
      '{R}{W}, {T}: Target creature gets +2/+0 and gains vigilance and haste until end of turn.\n' +
      '"Today the No. 1 Reactor was bombed. The terrorist group Avalanche has claimed responsibility for the bombing."\n' +
      '—President Shinra',
    imagePath: '/assets/cards/slayers-stronghold.webp',
    producesMana: 'C',
    abilities: [
      {
        id: 'slayers-stronghold-pump',
        label: 'Pump',
        cost: { manaLabel: '{R}{W}', tap: true },
        effects: [{ type: 'pumpTarget', power: 2, toughness: 0, grantKeyword: ['vigilance', 'haste'] }],
        effectText: 'Target creature gets +2/+0 and gains vigilance and haste until end of turn.',
      },
    ],
  },
  {
    id: 'sleep-magic',
    name: 'Sleep Magic',
    costLabel: '{U}',
    type: 'enchantment',
    text: 'Enchant creature \n ' +
      'When this Aura enters, tap enchanted creature. \n' +
      'Enchanted creature doesn\u2019t untap during its controller\u2019s untap step.\n' +
      'When enchanted creature is dealt damage, sacrifice this Aura.',
    imagePath: '/assets/cards/sleep-magic.webp',
    // Was wired via onCast, which castCard never reads for a permanent type
    // (creature/artifact/enchantment) - only onEnter is, so this Aura's
    // attach effect silently never fired at all. Fixed to onEnter.
    onEnter: [{ type: 'attachSelfToTarget', allowAnyController: true, tapTarget: true }],
    attachedPreventsUntap: true,
    // "When enchanted creature is dealt damage, sacrifice this Aura" is
    // deferred - no cross-cutting hook watches every damage-dealing code
    // path (combat AND effect damage) for a single-card trigger like this.
  },
  {
    id: 'smoldering-marsh',
    name: 'Smoldering Marsh',
    costLabel: '-',
    type: 'land',
    text: '({T}: Add {B} or {R}.)\n' +
      'This land enters tapped unless you control two or more basic lands.\n' +
      'In order to reach the Sealed Gate and enter the land of the espers, one must brave a volcanic dungeon, fraught with vile monsters.',
    imagePath: '/assets/cards/smoldering-marsh.webp',
    entersTappedUnlessControlBasicLandCount: 2,
    producesMana: ['B', 'R'],
  },
  {
    id: 'snort',
    name: 'Snort',
    costLabel: '{3}{R}',
    type: 'sorcery',
    text: 'Each player may discard their hand and draw five cards. Then Snort deals 5 damage to each opponent who discarded their hand this way.\n' +
      'Flashback {5}{R} (You may cast this card from your graveyard for its flashback cost. Then exile it.)',
    imagePath: '/assets/cards/snort.webp',
    onCast: [{ type: 'eachPlayerMayDiscardHandAndDrawThenDamageOpponentsWhoDid', drawCount: 5, damageAmount: 5 }],
    flashback: { cost: '{5}{R}' },
  },
  {
    id: 'snow-villiers',
    name: 'Snow Villiers',
    costLabel: '{2}{W}',
    type: 'creature',
    subtype: 'Legendary Creature Human Rebel Monk',
    toughness: 3,
    text: 'Vigilance \nSnow Villiers\u2019s power is equal to the number of creatures you control.',
    imagePath: '/assets/cards/snow-villiers.webp',
    basePowerEqualsControlledCreatureCount: true,
  },
  {
    id: 'snuff-out',
    name: 'Snuff Out',
    costLabel: '{3}{B}',
    type: 'instant',
    text: 'If you control a Swamp, you may pay 4 life rather than pay this spell’s mana cost.\n' +
      'Destroy target nonblack creature. It can’t be regenerated.\n' +
      '“Look, Avere! All these people have come to make you a gift of their souls!”',
    imagePath: '/assets/cards/snuff-out.webp',
    alternateCastCostPayLifeIfControlLandName: { landName: 'Swamp', lifeCost: 4 },
    onCast: [{ type: 'destroyTarget', targetFilter: 'nonblackCreature' }],
  },
  {
    id: 'sol-ring',
    name: 'Sol Ring',
    costLabel: '{1}',
    type: 'artifact',
    text: '{T}: Add {C}{C}.',
    imagePath: '/assets/cards/sol-ring.webp',
    producesMana: 'C',
    producesManaAmount: 2,
  },
  {
    id: 'sorceress-s-schemes',
    name: 'Sorceress\u2019s Schemes',
    costLabel: '{3}{R}',
    type: 'sorcery',
    text: 'Return target instant or sorcery card from your graveyard or exiled card with flashback you own to your hand. Add R. \n' +
      'Flashback 4R',
    imagePath: '/assets/cards/sorceress-s-schemes.webp',
    // Approximates away the "or exiled card with flashback you own"
    // alternate source - this engine doesn't track "cards exiled
    // specifically because they had flashback" as a distinct pool.
    onCast: [{ type: 'returnInstantOrSorceryFromGraveyardToHand' }, { type: 'addMana', colors: { R: 1 } }],
    flashback: { cost: '{4}{R}' },
  },
  {
    id: 'soldier-military-program',
    name: 'SOLDIER Military Program',
    costLabel: '{2}{W}',
    type: 'enchantment',
    text: 'At the beginning of combat on your turn, choose one. If you control a commander, you may choose both instead.\n' +
      '• Create a 1/1 white Soldier creature token.\n' +
      '• Put a +1/+1 counter on each of up to two Soldiers you control.',
    imagePath: '/assets/cards/soldier-military-program.webp',
    onOwnCombatBegin: [
      {
        type: 'chooseOneMode',
        allowBothIfCommander: true,
        modes: [
          { label: 'Create a 1/1 white Soldier creature token', effects: [{ type: 'createToken', tokenId: 'token-soldier' }] },
          { label: 'Put a +1/+1 counter on each of up to two Soldiers you control', effects: [{ type: 'putCounterOnUpToTwoOwnCreatures', counterLabel: '+1/+1', counterAmount: 1, restrictToSubtype: 'Soldier' }] },
        ],
      },
    ],
  },
  {
    id: 'solemn-simulacrum',
    name: 'Solemn Simulacrum',
    costLabel: '{4}',
    type: 'creature',
    subtype: 'Artifact Creature Golem',
    power: 2,
    toughness: 2,
    text: 'When this creature enters, you may search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.\n' +
      'When this creature dies, you may draw a card.',
    imagePath: '/assets/cards/solemn-simulacrum.webp',
    onEnter: [{ type: 'searchLibraryForBasicLand', toBattlefieldTapped: true }],
    onDeath: [{ type: 'mayEffect', effects: [{ type: 'drawCards', amount: 1 }] }],
  },
  {
    id:'solitude',
    name:'Yojimbo',
    costLabel:'{3}{W}{W}',
    type:"creature",
    subtype:'Creature — Elemental Incarnation',
    power: 3,
    toughness: 2,
    text:'Flash\n'+
    'Lifelink\n'+
    'When this creature enters, exile up to one other target creature. That creature’s controller gains life equal to its power.\n'+
    'Evoke—Exile a white card from your hand.',
    imagePath:'/assets/cards/solitude.webp',
    onEnter: [{ type: 'exileUpToOneOtherTargetCreatureThenControllerGainsLifeEqualToItsPower' }],
    evokeCost: { exileColor: 'W' },
  },
  {
    id: 'sphere-grid',
    name: 'Sphere Grid',
    costLabel: '{1}{G}',
    type: 'enchantment',
    text: 'Whenever a creature you control deals combat damage to a player, put a +1/+1 counter on that creature.\n' +
      'Unlock Ability — Creatures you control with +1/+1 counters on them have reach and trample.',
    imagePath: '/assets/cards/sphere-grid.webp',
    onAnyControlledCreatureCombatDamageToPlayerPutCounterOnThatCreature: { counterLabel: '+1/+1', counterAmount: 1 },
    staticAnthemForCreaturesWithCounter: { counterLabel: '+1/+1', grantKeywords: ['reach', 'trample'] },
  },
  {
    id: 'spire-of-industry',
    name: 'Spire of Industry',
    costLabel: '-',
    type: 'land',
    text: '{T}: Add {C}.\n' +
      '{T}, Pay 1 life: Add one mana of any color. Activate only if you control an artifact.\n' +
      '"A shining monument to corporate greed. One of these days I’m gonna tear it down and burn the rubble."\n' +
      '—Barret Wallace',
    imagePath: '/assets/cards/spire-of-industry.webp',
    producesMana: 'C',
    abilities: [
      {
        id: 'spire-of-industry-any-color',
        label: 'Add one mana of any color',
        cost: { tap: true, payLife: 1 },
        requiresControlledArtifact: true,
        effects: [{ type: 'addOneManaOfChosenColor' }],
        effectText: 'Add one mana of any color. Activate only if you control an artifact.',
      },
    ],
  },
  {
    id:'squall-gunblade-duelist',
    name:'Squall, Gunblade Duelist',
    costLabel:'{R}{W}{B}',
    type:'creature',
    subtype:'Legendary Creature \u2014 Human Mercenary',
    power: 3,
    toughness: 2,
    text:'First strike\n'+
    'As Squall enters, choose a number.\n'+
    'Whenever one or more creatures attack one of your opponents, if any of those creatures have power or toughness equal to the chosen number, Squall deals damage equal to its power to defending player.',
    imagePath:'/assets/cards/squall-gunblade-duelist.webp',
    onEnter: [{ type: 'chooseNumber' }],
    onAnyAttackMatchesChosenNumberDealsSourcePowerToDefender: true,
  },
  {
    id: 'squall-seed-mercenary',
    name: 'Squall, SeeD Mercenary',
    costLabel: '{2}{W}{B}',
    type: 'creature',
    subtype: 'Legendary Creature Human Knight Mercenary',
    power: 3,
    toughness: 4,
    text: 'Rough Divide — Whenever a creature you control attacks alone, it gains double strike until end of turn. \n' +
      'Whenever Squall deals combat damage to a player, return target permanent card with mana value 3 or less from your graveyard to the battlefield.',
    imagePath: '/assets/cards/squall-seed-mercenary.webp',
    attacksAloneGrantsKeyword: 'double strike',
    // Without this, Squall's own text mentioning "double strike" would
    // falsely self-apply it PERMANENTLY via the plain substring keyword
    // check, regardless of whether he actually attacked alone (see
    // seifer-almasy for the identical issue).
    excludeSelfKeywords: ['double strike'],
    onCombatDamageToPlayer: [{ type: 'reanimateTargetFromGraveyard', maxManaValue: 3, nonlegendaryPermanentInsteadOfCreature: true }],
    // onCombatDamageToPlayer approximates "deals combat damage to a player"
    // as "is unblocked" - see engine/actions.ts: applyCombatDamageToPlayerTriggers.
  },
  {
    id:'sram-senior-edificer',
    name:'Firion, Swordmaster',
    costLabel:'{1}{W}',
    type:'creature',
    subtype:'Legendary Creature — Dwarf Advisor',
    power: 2,
    toughness: 2,
    text:'Whenever you cast an Aura, Equipment, or Vehicle spell, draw a card.',
    onOwnCastSubtypeSpellTrigger: { subtypes: ['Aura', 'Equipment', 'Vehicle'], effects: [{ type: 'drawCards', amount: 1 }] },
    imagePath:'/assets/cards/sram-senior-edificer.webp'
  },
  {
    id:'star-of-extinction',
    name:'Meteorfall',
    costLabel:'{5}{R}{R}',
    type:'sorcery',
    text:'Destroy target land. Meteorfall deals 20 damage to each creature and each planeswalker.\n'+
    '“What would happen if there was an injury that threatened the very life of the planet?”',
    imagePath:'/assets/cards/star-of-extinction.webp',
    onCast: [{ type: 'destroyTarget', targetFilter: 'land' }, { type: 'damageEachCreature', amount: 20 }],
  },
  {
    id: 'starting-town',
    name: 'Starting Town',
    costLabel: '-',
    type: 'land',
    text: 'This land enters tapped unless it\u2019s your first, second, or third turn of the game.\n' +
      'Tap: Add C. \n' +
      'Tap, Pay 1 life: Add one mana of any color.',
    imagePath: '/assets/cards/starting-town.webp',
    producesMana: 'C',
    // Both deferred - the conditional-entersTapped (based on turn number) and
    // the alternate "pay 1 life for any color" mana ability aren't
    // supported: lands always tap via the single fixed producesMana value,
    // not the CardAbility system, so there's no way to offer a second,
    // differently-costed mana option on the same land.
  },
  {
    id: 'stitch-together',
    name: 'Stitch Together',
    costLabel: '{B}{B}',
    type: 'sorcery',
    text: 'Return target creature card from your graveyard to your hand.\n' +
      'Threshold — Return that card from your graveyard to the battlefield instead if there are seven or more cards in your graveyard.',
    imagePath: '/assets/cards/stitch-together.webp',
    onCast: [{ type: 'returnTargetCreatureFromGraveyardToHandOrBattlefieldIfGraveyardCountAtLeast', minGraveyardCount: 7 }],
  },
  {
  id: 'stitcher-s-supplier',
  name: 'Stitcher’s Supplier',
  costLabel: '{B}',
  type: 'creature',
  subtype: 'Creature — Zombie',
  power: 1,
  toughness: 1,
  text: 'When this creature enters or dies, mill three cards. (Put the top three cards of your library into your graveyard.)\n' +
    'All those wounded by the necromancer’s zombie stick are doomed to a fate of eternal undeath!',
  imagePath: '/assets/cards/stitcher-s-supplier.webp',
  onEnter: [{ type: 'millSelf', count: 3 }],
  onDeath: [{ type: 'millSelf', count: 3 }],
  },
  {
  id: 'stiltzkin-moogle-merchant',
  name: 'Stiltzkin, Moogle Merchant',
  costLabel: '{W}',
  type: 'creature',
  subtype: 'Legendary Creature Moogle',
  power: 1,
  toughness: 2,
  text: 'Lifelink \n' +
  '2, Tap: Target opponent gains control of another target permanent you control. If they do, you draw a card.',
  imagePath:'/assets/cards/stiltzkin-moogle-merchant.webp',
  abilities: [
    {
      id: 'stiltzkin-moogle-merchant-giveaway',
      label: 'Give Away',
      cost: { manaLabel: '{2}', tap: true },
      effectText: 'Target opponent gains control of another target permanent you control. If they do, you draw a card.',
      effects: [{ type: 'giveControlOfAnotherOwnPermanentToOpponent', drawCard: true }],
    },
  ],
  },
  {
  id: 'stolen-uniform',
  name: 'Stolen Uniform',
  costLabel: '{U}',
  type: 'instant',
  text: 'Choose target creature you control and target Equipment. Gain control of that Equipment until end of turn. ' +
  'Attach it to the chosen creature. When you lose control of that Equipment this turn, if it\u2019s attached to a creature you control, unattach it.',
  imagePath: '/assets/cards/stolen-uniform.webp',
  onCast: [{ type: 'gainControlOfTargetEquipmentAndAttach' }],
  // The delayed "when you lose control of that Equipment this turn, if
  // it's attached to a creature you control, unattach it" clause is still
  // deferred - the core control-change/attach is wired, but nothing
  // detaches it again once temporaryControlUntilEndOfTurn reverts at
  // cleanup, so it may remain attached to the borrower's creature.
  },
  {
  id: 'strago-and-relm',
  name: 'Strago and Relm',
  costLabel: '{2}{R}',
  type: 'creature',
  subtype: 'Legendary Creature — Human Wizard',
  power: 1,
  toughness: 3,
  text: 'Sketch and Lore — {2}{R}, {T}: Target opponent exiles cards from the top of their library until they exile an instant, sorcery, or creature card. You may cast that card without paying its mana cost. If you cast a creature spell this way, it gains haste and “At the beginning of the end step, sacrifice this creature.” Activate only as a sorcery.',
  imagePath: '/assets/cards/strago-and-relm.webp',
  abilities: [
    {
      id: 'strago-and-relm-sketch-and-lore',
      label: 'Sketch and Lore',
      cost: { manaLabel: '{2}{R}', tap: true },
      onlyDuringOwnMainPhase: true,
      effects: [{ type: 'exileFromOpponentLibraryUntilTypeThenMayCastFree' }],
      effectText: 'Target opponent exiles cards from the top of their library until they exile an instant, sorcery, or creature card. You may cast that card without paying its mana cost. If you cast a creature spell this way, it gains haste and "At the beginning of the end step, sacrifice this creature."',
    },
  ],
  },
  {
  id: 'stuck-in-summoner-s-sanctum',
  name: 'Stuck in Summoner\u2019s Sanctum',
  costLabel: '{2}{U}',
  type: 'enchantment',
  subtype: 'Aura',
  text: 'Flash \n' +
  'Enchant artifact or creature \n' +
  'When this Aura enters, tap enchanted permanent. \n' +
  'Enchanted permanent doesn\u2019t untap during its controller\u2019s untap step and its activated abilities can\u2019t be activated.',
  imagePath:'/assets/cards/stuck-in-summoner-s-sanctum.webp',
  // Was wired via onCast, which castCard never reads for a permanent type
  // (creature/artifact/enchantment) - only onEnter is, so this Aura's
  // attach effect silently never fired at all. Fixed to onEnter.
  onEnter: [{ type: 'attachSelfToTarget', allowAnyController: true, targetTypeFilter: 'artifactOrCreature', tapTarget: true }],
  attachedPreventsUntap: true,
  attachedPreventsAbilities: true,
  },
  {
  id: 'sublime-epiphany',
  name: 'Sublime Epiphany',
  costLabel: '{4}{U}{U}',
  type: 'instant',
  text: 'Choose one or more —\n' +
    '• Counter target spell.\n' +
    '• Counter target activated or triggered ability.\n' +
    '• Return target nonland permanent to its owner’s hand.\n' +
    '• Create a token that’s a copy of target creature you control.\n' +
    '• Target player draws a card.',
  imagePath: '/assets/cards/sublime-epiphany.webp',
  // No stack/priority system exists in this engine (spells resolve
  // immediately on cast), so "counter target spell"/"counter target
  // activated or triggered ability" can never fire - same precedent as
  // Syncopate. Kept in chooseModes for printed-text fidelity, but no-op.
  chooseModes: [
    { label: 'Counter target spell.', effects: [] },
    { label: 'Counter target activated or triggered ability.', effects: [] },
    { label: 'Return target nonland permanent to its owner’s hand.', effects: [{ type: 'bounceTarget', targetFilter: 'nonland' }] },
    { label: 'Create a token that’s a copy of target creature you control.', effects: [{ type: 'createTokenCopyOfTarget', creatureOnly: true, controlledOnly: true }] },
    { label: 'Target player draws a card.', effects: [{ type: 'drawCardsFromTargetPlayer', count: 1 }] },
  ],
  },
  {
    id:'subtlety',
    name:'Shiva',
    costLabel:'{2}{U}{U}',
    type:'creature',
    subtype:'Creature — Elemental',
    power: 3,
    toughness: 3,
    text:'Flash\n'+
    'Flying\n'+
    'When this creature enters, choose up to one target creature spell or planeswalker spell. Its owner puts it on their choice of the top or bottom of their library.\n'+
    'Evoke—Exile a blue card from your hand.',
    imagePath:'/assets/cards/subtlety.webp',
    evokeCost: { exileColor: 'U' },
    // See client/src/data/cards.ts's matching comment - the ETB clause
    // targets a spell on a stack this engine doesn't have, so it's
    // deferred entirely (same "no stack" precedent as Sublime Epiphany/
    // Syncopate just above).
  },
  {
    id: 'sulfurous-springs',
    name: 'Sulfurous Springs',
    costLabel: '-',
    type: 'land',
    text: '{T}: Add {C}.\n' +
      '{T}: Add {B} or {R}. This land deals 1 damage to you.\n' +
      'The legendary treasure sleeps where the mountains form a star.',
    imagePath: '/assets/cards/sulfurous-springs.webp',
    producesMana: 'C',
    altProducesMana: { colors: ['B', 'R'], payLife: 1 },
  },
  {
    id: 'sungrass-prairie',
    name: 'Sungrass Prairie',
    costLabel: '-',
    type: 'land',
    text: '{1}, {T}: Add {G}{W}.\n' +
      '“Thinking of crossing the marshes? Hmm, then it’ll probably be safer for you to get a chocobo.”\n' +
      '—Chocobo Bill',
    imagePath: '/assets/cards/sungrass-prairie.webp',
    abilities: [
      {
        id: 'sungrass-prairie-filter',
        label: 'Add {G}{W}',
        cost: { manaLabel: '{1}', tap: true },
        effects: [{ type: 'addMana', colors: { G: 1, W: 1 } }],
        effectText: 'Add {G}{W}.',
      },
    ],
  },
  {
    id: 'sunken-hollow',
    name: 'Sunken Hollow',
    costLabel: '-',
    type: 'land',
    text: '({T}: Add {U} or {B}.)\n' +
      'This land enters tapped unless you control two or more basic lands.\n' +
      'Haunting the depths of what is now Loch Seld, Skalla’s silent walls lure adventurers into the salt-laden waters with the promise of mysteries unsolved and treasures unclaimed.',
    imagePath: '/assets/cards/sunken-hollow.webp',
    entersTappedUnlessControlBasicLandCount: 2,
    producesMana: ['U', 'B'],
  },
  {
    id: 'sunken-ruins',
    name: 'Sunken Ruins',
    costLabel: '-',
    type: 'land',
    text: '{T}: Add {C}.\n' +
      '{U/B}, {T}: Add {U}{U}, {U}{B}, or {B}{B}.\n' +
      '"Look closely. Emet-Selch has not simply reclaimed these ruins he has layered the semblance of an entire city upon them."\n' +
      '—Y’shtola Rhul',
    imagePath: '/assets/cards/sunken-ruins.webp',
    producesMana: ['C'],
    abilities: [
      {
        // Real printed cost is the hybrid symbol {U/B} (pay one U or one B) -
        // approximated as a flat {1} generic, same "no hybrid-mana support in
        // parseCostLabel/canPay/payCost, and adding it is a bigger change
        // than this one land justifies" deviation as every other
        // engine-limitation note elsewhere in this file.
        id: 'sunken-ruins-filter',
        label: 'Add two mana',
        cost: { manaLabel: '{1}', tap: true },
        effects: [
          {
            type: 'chooseOneMode',
            modes: [
              { label: 'Add {U}{U}', effects: [{ type: 'addMana', colors: { U: 2 } }] },
              { label: 'Add {U}{B}', effects: [{ type: 'addMana', colors: { U: 1, B: 1 } }] },
              { label: 'Add {B}{B}', effects: [{ type: 'addMana', colors: { B: 2 } }] },
            ],
          },
        ],
        effectText: 'Add {U}{U}, {U}{B}, or {B}{B}.',
      },
    ],
  },
  {
    id: 'sunlit-marsh',
    name: 'Sunlit Marsh',
    costLabel: '-',
    type: 'land',
    text: '({T}: Add {W} or {B}.)\n' +
      'This land enters tapped.\n' +
      '"Ah, our guests have arrived!"\n' +
      '—Aenc Thon, Lord of the Lingering Gaze',
    imagePath: '/assets/cards/sunlit-marsh.webp',
    entersTapped: true,
    producesMana: ['W', 'B'],
  },
  {
    id: 'sunpetal-grove',
    name: 'Sunpetal Grove',
    costLabel: '-',
    type: 'land',
    text: 'This land enters tapped unless you control a Forest or a Plains.\n' +
      '{T}: Add {G} or {W}.\n' +
      '“I wish I could live in a place like this. Peaceful… living with a smile on my face every day.”\n' +
      '—Yuna',
    imagePath: '/assets/cards/sunpetal-grove.webp',
    entersTappedUnlessControlLandNames: ['Forest', 'Plains'],
    producesMana: ['G', 'W'],
  },
  {
    id: 'sunscorched-divide',
    name: 'Sunscorched Divide',
    costLabel: '-',
    type: 'land',
    text: '{1}, {T}: Add {R}{W}.\n' +
      '“You there! We’re about to storm the castle. The two of you will join the assault squad. Get moving!”\n' +
      '—Imperial soldier',
    imagePath: '/assets/cards/sunscorched-divide.webp',
    abilities: [
      {
        id: 'sunscorched-divide-filter',
        label: 'Add {R}{W}',
        cost: { manaLabel: '{1}', tap: true },
        effects: [{ type: 'addMana', colors: { R: 1, W: 1 } }],
        effectText: 'Add {R}{W}.',
      },
    ],
  },
  {
  id: 'summon-anima',
  name: 'Summon: Anima',
  costLabel: '{4}{B}{B}',
  type: 'creature',
  subtype: 'Enchantment Creature Saga Horror',
  power: 4,
  toughness: 4,
  text: '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after IV.) \n' +
  'I, II, III — Pain — You draw a card and you lose 1 life. \n' +
  'IV — Oblivion — Each opponent sacrifices a creature of their choice and loses 3 life.\n' +
  'Menace',
  saga: {
    chapters: [
      { numbers: [1, 2, 3], effects: [{ type: 'drawCards', amount: 1 }, { type: 'loseLife', amount: 1 }] },
      { numbers: [4], effects: [{ type: 'sacrificeCreature', target: 'opponent' }, { type: 'eachOpponentLosesLife', amount: 3 }] },
    ],
    sacrificeAfterFinalChapter: true,
  },
  imagePath:'/assets/cards/summon-anima.webp'
  },
  {
  id: 'summon-bahamut',
  name: 'Summon: Bahamut',
  costLabel: '{9}',
  type: 'creature',
  subtype: 'Enchantment Creature Saga Dragon',
  power: 9,
  toughness: 9,
  text: '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after IV.) \n' +
  'I, II — Destroy up to one target nonland permanent. \n' +
  'III — Draw two cards. \n' +
  'IV — Mega Flare — This creature deals damage equal to the total mana value of other permanents you control to each opponent.' +
  'Flying',
  // Chapter IV's "damage equal to the total mana value of other permanents
  // you control" is deferred - a one-off calculation with no reusable
  // mechanism behind it. The chapter number itself is still tracked (with
  // no effects attached) purely so the 4th lore counter is the one that
  // triggers the "Sacrifice after IV" cleanup instead of the 3rd.
  saga: {
    chapters: [
      { numbers: [1, 2], effects: [{ type: 'destroyTarget', targetFilter: 'nonlandPermanent', optional: true }] },
      { numbers: [3], effects: [{ type: 'drawCards', amount: 2 }] },
      { numbers: [4], effects: [] },
    ],
    sacrificeAfterFinalChapter: true,
  },
  imagePath:'/assets/cards/summon-bahamut.webp'
  },
  {
  id: 'summon-brynhildr',
  name: 'Summon: Brynhildr',
  costLabel: '{1}{R}',
  type: 'creature',
  subtype: 'Enchantment Creature Saga Knight',
  power: 2,
  toughness: 1,
  text: '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.) \n' +
  'I — Chain — Exile the top card of your library. During any turn you put a lore counter on this Saga, you may play that card. \n' +
  'II, III — Gestalt Mode — When you next cast a creature spell this turn, it gains haste until end of turn.',
  imagePath:'/assets/cards/summon-brynhildr.webp',
  // Chapter I is still deferred - "exile the top card, then during any
  // turn you put a lore counter on this you may play it" needs a
  // persistent-condition impulse play window tied to a specific
  // permanent's ongoing lore-counter triggers, which doesn't exist yet.
  saga: {
    chapters: [
      { numbers: [1], effects: [] },
      { numbers: [2, 3], effects: [{ type: 'setPendingNextCreatureSpellBonus', grantsHaste: true }] },
    ],
    sacrificeAfterFinalChapter: true,
  },
  },
  {
  id: 'summon-choco-mog',
  name: 'Summon: Choco/Mog',
  costLabel: '{2}{W}',
  type: 'creature',
  subtype: 'Enchantment Creature Saga Bird Moogle',
  power: 3,
  toughness: 3,
  text: '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after IV.) \n' +
  'I, II, III, IV — Stampede! — Other creatures you control get +1/+0 until end of turn.',
  saga: {
    chapters: [{ numbers: [1, 2, 3, 4], effects: [{ type: 'buffOtherCreaturesYouControl', power: 1, toughness: 0 }] }],
    sacrificeAfterFinalChapter: true,
  },
  imagePath:'/assets/cards/summon-choco-mog.webp'
  },
  {
  id: 'summoner-s-grimoire',
  name: 'Summoner\u2019s Grimoire',
  costLabel: '{3}{G}',
  type: 'artifact',
  subtype: 'Artifact Equipment',
  text: 'Job select \n' +
  'Equipped creature is a Shaman in addition to its other types and has “Whenever this creature attacks, ' +
  'you may put a creature card from your hand onto the battlefield. If that card is an enchantment card, it enters tapped and attacking.”' +
  'Abraxas — Equip 3',
  // The granted attack-trigger battlefield-cheat ("put a creature card
  // from your hand onto the battlefield, entering tapped and attacking if
  // it's an enchantment") is still deferred - "enters already attacking,
  // joining an in-progress combat" has no supporting mechanism here.
  onEnter: [{ type: 'createToken', tokenId: 'token-hero', attachSelfToToken: true }],
  equipGrantsSubtype: 'Shaman',
  attachesTo: 'creature',
  equipCost: '{3}',
  imagePath:'/assets/cards/summoner-s-grimoire.webp'
  },
  {
  id: 'summon-esper-ramuh',
  name: 'Summon: Esper Ramuh',
  costLabel: '{2}{R}{R}',
  type: 'creature',
  subtype: 'Enhancement Creature Saga Wizard',
  power: 3,
  toughness: 3,
  text: '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.) \n' +
  'I — Judgment Bolt — This creature deals damage equal to the number of noncreature, nonland cards in your graveyard to target creature an opponent controls.\n' +
  'II, III — Wizards you control get +1/+0 until end of turn.',
  // Chapter I's "damage equal to noncreature nonland cards in graveyard" is
  // deferred - a one-off graveyard-count calculation with no reusable
  // mechanism behind it.
  saga: {
    chapters: [{ numbers: [2, 3], effects: [{ type: 'pumpControlledSubtype', subtype: 'Wizard', power: 1, toughness: 0 }] }],
    sacrificeAfterFinalChapter: true,
  },
  imagePath:'/assets/cards/summon-esper-ramuh.webp'
  },
  {
    id: 'summon-esper-valigarmanda',
    name: 'Summon: Esper Valigarmanda',
    costLabel: '{3}{R}',
    type: 'creature',
    subtype: 'Enchantment Creature Saga Drake',
    power: 3,
    toughness: 3,
    text: '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after IV.)\n' +
      'I — Exile an instant or sorcery card from each graveyard.\n' +
      'II, III, IV — Add {R} for each lore counter on this Saga. You may cast an instant or sorcery card exiled with this Saga, and mana of any type can be spent to cast that spell.\n' +
      'Flying, haste',
    imagePath: '/assets/cards/summon-esper-valigarmanda.webp',
    // Chapter I is approximated as a single pick from EITHER graveyard (not
    // strictly "one from each") - see ExileTargetGraveyardCardEffect.
    // instantOrSorceryOnly's own doc comment. The "you may cast an exiled
    // instant/sorcery with any mana" half of chapters II-IV is deferred -
    // same "exile now, play later" persistent-permission gap already
    // documented as deferred for Summon: Brynhildr.
    saga: {
      chapters: [
        { numbers: [1], effects: [{ type: 'exileTargetGraveyardCard', instantOrSorceryOnly: true, optional: true }] },
        { numbers: [2, 3, 4], effects: [{ type: 'addManaEqualToOwnLoreCounter', color: 'R' }] },
      ],
      sacrificeAfterFinalChapter: true,
    },
  },
  {
  // Was '' (an empty id) - getCardDefinition('') could never find this card,
  // and any deck containing it would break. 'summon-fat-chocobo' matches the
  // naming convention every other Summon: X card uses.
  id: 'summon-fat-chocobo',
  name: 'Summon: Fat Chocobo',
  costLabel: '{4}{G}',
  type: 'creature',
  subtype: 'Enchantment Creature Saga Bird',
  power: 4,
  toughness: 4,
  text: '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after IV.) \n' +
  'I — Wark — Create a 2/2 green Bird creature token with “Whenever a land you control enters, this token gets +1/+0 until end of turn.”\n' +
  'II, III, IV — Kerplunk — Creatures you control gain trample until end of turn.',
  // Chapters II-IV grant trample to OTHER creatures you control only
  // (buffOtherCreaturesYouControl always excludes the source) - the real
  // card's "creatures you control" would include Fat Chocobo itself too.
  saga: {
    chapters: [
      { numbers: [1], effects: [{ type: 'createToken', tokenId: 'token-bird' }] },
      { numbers: [2, 3, 4], effects: [{ type: 'buffOtherCreaturesYouControl', grantKeyword: 'trample' }] },
    ],
    sacrificeAfterFinalChapter: true,
  },
  imagePath:'/assets/cards/summon-fat-chocobo.webp'
  },
  {
  id: 'summon-fenrir',
  name: 'Summon: Fenrir',
  costLabel: '{2}{G}',
  type: 'creature',
  subtype: 'Enchanment Creature Saga Wolf',
  power: 3,
  toughness: 2,
  text: 'I — Crescent Fang — Search your library for a basic land card, put it onto the battlefield tapped, then shuffle. \n' +
  'II — Heavenward Howl — When you next cast a creature spell this turn, that creature enters with an additional +1/+1 counter on it. \n' +
  'III — Ecliptic Growl — Draw a card if you control the creature with the greatest power or tied for the greatest power.',
  imagePath:'/assets/cards/summon-fenrir.webp',
  // Chapter III is still deferred - "draw a card if you control the
  // creature with the greatest power (or tied for it)" needs a "compare my
  // power against every creature on the battlefield" mechanism that
  // doesn't exist yet. Still wired up for lore-counter progression and
  // sacrifice after III (missing from the printed text here, but every
  // other 3-chapter Saga in this set ends the same way).
  saga: {
    chapters: [
      { numbers: [1], effects: [{ type: 'searchLibraryForBasicLand', toBattlefieldTapped: true }] },
      { numbers: [2], effects: [{ type: 'setPendingNextCreatureSpellBonus', counterLabel: '+1/+1', counterAmount: 1 }] },
      { numbers: [3], effects: [] },
    ],
    sacrificeAfterFinalChapter: true,
  },
  },
  {
  id: 'summon-g-f-cerberus',
  name: 'Summon: G.F. Cerberus',
  costLabel: '{2}{R}{R}',
  type: 'creature',
  subtype: 'Enchantment Creature Saga Dog',
  power: 3,
  toughness: 3,
  text: '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.) \n' +
  'I — Surveil 1. (Look at the top card of your library. You may put it into your graveyard.) \n' +
  'II — Double — When you next cast an instant or sorcery spell this turn, copy it. You may choose new targets for the copy. \n' +
  'III — Triple — When you next cast an instant or sorcery spell this turn, copy it twice. You may choose new targets for the copies.',
  // Chapters II-III's spell-copying are deferred - no spell-copy mechanism
  // exists anywhere in this engine. Both chapter numbers are still tracked
  // (with no effects attached) purely so the 3rd lore counter is the one
  // that triggers the "Sacrifice after III" cleanup instead of the 1st.
  saga: {
    chapters: [
      { numbers: [1], effects: [{ type: 'surveil', count: 1 }] },
      { numbers: [2], effects: [] },
      { numbers: [3], effects: [] },
    ],
    sacrificeAfterFinalChapter: true,
  },
  imagePath:'/assets/cards/summon-g-f-cerberus.webp'
  },
  {
  id: 'summon-g-f-ifrit',
  name: 'Summon: G.F. Ifrit',
  costLabel: '{2}{R}',
  type: 'creature',
  subtype: 'Enchantment Creature Saga Demon',
  power: 3,
  toughness: 2,
  text: '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after IV.) \n' +
  'I, II — You may discard a card. If you do, draw a card. \n' +
  'III, IV — Add R.',
  imagePath:'/assets/cards/summon-g-f-ifrit.webp',
  saga: {
    chapters: [
      { numbers: [1, 2], effects: [{ type: 'discardUpToThenDrawThatMany', maxCount: 1 }] },
      { numbers: [3, 4], effects: [{ type: 'addMana', colors: { R: 1 } }] },
    ],
    sacrificeAfterFinalChapter: true,
  },
  },
  {
    id: 'summon-good-king-mog-xii',
    name: 'Summon: Good King Mog XII',
    costLabel: '{4}{W}',
    type: 'creature',
    subtype: 'Enchantment Creature — Saga Moogle',
    power: 4,
    toughness: 4,
    text: '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after IV.)\n' +
      'I — Create two 1/2 white Moogle creature tokens with lifelink.\n' +
      'II, III — Whenever you cast a noncreature spell this turn, create a token that’s a copy of a non-Saga token you control.\n' +
      'IV — Put two +1/+1 counters on each other Moogle you control.\n' +
      'Flying, lifelink',
    imagePath: '/assets/cards/summon-good-king-mog-xii.webp',
    saga: {
      chapters: [
        { numbers: [1], effects: [{ type: 'createToken', tokenId: 'token-moogle', count: 2 }] },
        { numbers: [2, 3], effects: [{ type: 'grantTemporaryNoncreatureCastCreatesTokenCopy' }] },
        { numbers: [4], effects: [{ type: 'putCounterOnEachControlledCreatureMatchingSubtype', subtype: 'Moogle', counterLabel: '+1/+1', counterAmount: 2, excludeSelf: true }] },
      ],
      sacrificeAfterFinalChapter: true,
    },
  },
  {
    id: 'summon-ixion',
    name: 'Summon: Ixion',
    costLabel: '{2}{W}',
    type: 'creature',
    subtype: 'Enchantment Creature Saga Unicorn',
    power: 3,
    toughness: 3,
    text: '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.)\n' +
      'I — Aerospark — Exile target creature an opponent controls until this Saga leaves the battlefield.\n' +
      'II, III — Put a +1/+1 counter on each of up to two target creatures you control. You gain 2 life.\n' +
      'First strike',
    imagePath: '/assets/cards/summon-ixion.webp',
    saga: {
      chapters: [
        { numbers: [1], effects: [{ type: 'exileTargetOpponentCreatureUntilSourceLeaves' }] },
        { numbers: [2, 3], effects: [{ type: 'gainLife', amount: 2 }, { type: 'putCounterOnUpToTwoOwnCreatures', counterLabel: '+1/+1', counterAmount: 1 }] },
      ],
      sacrificeAfterFinalChapter: true,
    },
  },
  {
  id: 'summon-knights-of-round',
  name: 'Summon: Knights of Round',
  costLabel: '{6}{W}{W}',
  type: 'creature',
  subtype: 'Enchantment Creature Saga Knight',
  power: 3,
  toughness: 3,
  text: '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after V.) \n' +
  'I, II, III, IV — Create three 2/2 white Knight creature tokens. \n' +
  'V — Ultimate End — Other creatures you control get +2/+2 until end of turn. Put an indestructible counter on each of them.\n' +
  'Indestructible',
  imagePath:'/assets/cards/summon-knights-of-round.webp',
  // Chapter V's "indestructible counter" is granted as an actual (temporary)
  // indestructible keyword instead of a cosmetic counter - a counter labeled
  // 'indestructible' wouldn't be consulted by anything that actually checks
  // destruction (engine/combat.ts: hasKeywordEffective is), so a literal
  // counter would be decoration only. grantTemporaryKeyword IS checked
  // there, so this is the version that actually protects them.
  saga: {
    chapters: [
      { numbers: [1, 2, 3, 4], effects: [{ type: 'createToken', tokenId: 'token-knight', count: 3 }] },
      { numbers: [5], effects: [{ type: 'buffOtherCreaturesYouControl', power: 2, toughness: 2, grantKeyword: 'indestructible' }] },
    ],
    sacrificeAfterFinalChapter: true,
  },
  },
  {
  id: 'summon-kujata',
  name: 'Summon: Kujata',
  costLabel: '{5}{R}',
  type: 'creature',
  subtype: 'Enchantment Creature — Saga Ox',
  power: 7,
  toughness: 5,
  text: '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.)\n' +
    'I — Lightning — This creature deals 3 damage to each of up to two target creatures.\n' +
    'II — Ice — Up to three target creatures can’t block this turn.\n' +
    'III — Fire — Discard a card, then draw two cards. When you discard a card this way, this creature deals damage equal to that card’s mana value to each opponent.\n' +
    'Trample, haste',
  imagePath: '/assets/cards/summon-kujata.webp',
  saga: {
    chapters: [
      { numbers: [1], effects: [{ type: 'damageTargetCreature', amount: 3, upToTwo: true }] },
      { numbers: [2], effects: [{ type: 'grantCantBlockToUpToThreeTargets' }] },
      { numbers: [3], effects: [{ type: 'discardThenDrawThenDamageOpponentsEqualToDiscardedManaValue', drawCount: 2 }] },
    ],
    sacrificeAfterFinalChapter: true,
  },
  },
  {
  id: 'summon-leviathan',
  name: 'Summon: Leviathan',
  costLabel: '{4}{U}{U}',
  type: 'creature',
  subtype: 'Enchantment Creature Saga Leviathan',
  power: 6,
  toughness: 6,
  text: '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.) \n' +
  'I — Return each creature that isn’t a Kraken, Leviathan, Merfolk, Octopus, or Serpent to its owner\u2019s hand. \n' +
  'II, III — Until end of turn, whenever a Kraken, Leviathan, Merfolk, Octopus, or Serpent attacks, draw a card. \n' +
  'Ward 2',
  imagePath:'/assets/cards/summon-leviathan.webp',
  wardCost: { mana: '{2}' },
  // Both chapters' own effects are still deferred: chapter I needs a
  // conditional "return every creature EXCEPT [subtype list]" mass bounce,
  // and chapters II/III need a delayed "until end of turn, whenever a
  // [subtype list] attacks, draw" granted trigger - neither mechanism
  // exists yet. Still wired up for lore-counter progression and sacrifice
  // after III.
  saga: {
    chapters: [{ numbers: [1], effects: [] }, { numbers: [2, 3], effects: [] }],
    sacrificeAfterFinalChapter: true,
  },
  },
  {
    id: 'summon-magus-sisters',
    name: 'Summon: Magus Sisters',
    costLabel: '{4}{G}',
    type: 'creature',
    subtype: 'Enchantment Creature Saga Faerie',
    power: 5,
    toughness: 5,
    text: '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.)\n' +
      'I, II, III — Choose one at random —\n' +
      '• Combine Powers! — Put three +1/+1 counters on target creature.\n' +
      '• Defense! — Put a shield counter on target creature. You gain 3 life. \n' +
      '• Fight! — This creature fights up to one target creature an opponent controls.\n' +
      'Haste',
    imagePath: '/assets/cards/summon-magus-sisters.webp',
    saga: {
      chapters: [
        {
          numbers: [1, 2, 3],
          effects: [
            {
              type: 'chooseOneAtRandom',
              options: [
                [{ type: 'putCounterOnTarget', counterLabel: '+1/+1', counterAmount: 3 }],
                [{ type: 'putCounterOnTarget', counterLabel: 'Shield', counterAmount: 1 }, { type: 'gainLife', amount: 3 }],
                [{ type: 'selfFightTarget', optional: true }],
              ],
            },
          ],
        },
      ],
      sacrificeAfterFinalChapter: true,
    },
  },
  {
  id: 'summon-primal-garuda',
  name: 'Summon: Primal Garuda',
  costLabel: '{3}{W}',
  type: 'creature',
  subtype: 'Enchantment Creature Saga Harpy',
  power: 3,
  toughness: 3,
  text: '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.) \n' +
  'I — Aerial Blast — This creature deals 4 damage to target tapped creature an opponent controls. \n' +
  'II, III — Slipstream — Another target creature you control gets +1/+0 and gains flying until end of turn. \n' +
  'Flying',
  imagePath:'/assets/cards/summon-primal-garuda.webp',
  // Chapter I's own effect is deferred - the only existing damage-a-target
  // effect (damageTargetCreature) allows ANY creature either player
  // controls, with no way to restrict to "an opponent's TAPPED creature",
  // and using it as-is would let this hit a legal target the real card
  // couldn't. Chapters II/III match pumpAnotherControlledCreature exactly.
  saga: {
    chapters: [
      { numbers: [1], effects: [] },
      { numbers: [2, 3], effects: [{ type: 'pumpAnotherControlledCreature', power: 1, toughness: 0, grantKeyword: 'flying' }] },
    ],
    sacrificeAfterFinalChapter: true,
  },
  },
  {
  id: 'summon-primal-odin',
  name: 'Summon: Primal Odin',
  costLabel: '{4}{B}{B}',
  type: 'creature',
  subtype: 'Enchantment Creature Saga Knight',
  power: 5,
  toughness: 3,
  text: '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.)\n' +
  'I — Gungnir — Destroy target creature an opponent controls. \n' +
  'II — Zantetsuken — This creature gains “Whenever this creature deals combat damage to a player, that player loses the game.” \n' +
  'III — Hall of Sorrow — Draw two cards. Each player loses 2 life.',
  imagePath:'/assets/cards/summon-primal-odin.webp',
  saga: {
    chapters: [
      { numbers: [1], effects: [{ type: 'destroyOpponentCreature' }] },
      { numbers: [2], effects: [{ type: 'grantCombatDamageToPlayerCausesLoss' }] },
      { numbers: [3], effects: [{ type: 'drawCards', amount: 2 }, { type: 'eachPlayerLosesLife', amount: 2 }] },
    ],
    sacrificeAfterFinalChapter: true,
  },
  },
  {
  id: 'summon-shiva',
  name: 'Summon: Shiva',
  costLabel: '{3}{U}{U}',
  type: 'creature',
  subtype: 'Enchantment Creature Saga Elemental',
  power: 4,
  toughness: 5,
  text: '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.) \n' +
  'I, II — Heavenly Strike — Tap target creature an opponent controls. Put a stun counter on it. ' +
  '(If a permanent with a stun counter would become untapped, remove one from it instead.) \n' +
  'III — Diamond Dust — Draw a card for each tapped creature your opponents control.',
  imagePath:'/assets/cards/summon-shiva.webp',
  saga: {
    chapters: [
      { numbers: [1, 2], effects: [{ type: 'tapAndStun', targetController: 'opponent', targetType: 'creature' }] },
      { numbers: [3], effects: [{ type: 'drawForTappedOpponentCreatures' }] },
    ],
    sacrificeAfterFinalChapter: true,
  },
  },
  {
  id: 'summon-titan',
  name: 'Summon: Titan',
  costLabel: '{3}{G}{G}',
  type: 'creature',
  subtype: 'Enchantment Creature Saga Giant',
  power: 7,
  toughness: 7,
  text: '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.) \n' +
  'I — Mill five cards. \n' +
  'II — Return all land cards from your graveyard to the battlefield tapped. \n' +
  'III — Until end of turn, another target creature you control gains trample and gets +X/+X, where X is the number of lands you control.\n' +
  'Reach, trample',
  imagePath:'/assets/cards/summon-titan.webp',
  // Chapter II's own effect is deferred - no mass graveyard-to-battlefield
  // reanimation mechanism exists (only single-target reanimate). Chapter
  // III is deferred too - PumpAnotherControlledCreatureEffect only takes a
  // fixed power/toughness, not a dynamic X based on lands controlled.
  // Chapter I matches millSelf exactly.
  saga: {
    chapters: [
      { numbers: [1], effects: [{ type: 'millSelf', count: 5 }] },
      { numbers: [2], effects: [] },
      { numbers: [3], effects: [] },
    ],
    sacrificeAfterFinalChapter: true,
  },
  },
  {
    id: 'summon-valefor',
    name: 'Summon: Valefor',
    costLabel: '{4}{U}',
    type: 'creature',
    subtype: 'Enchantment Creature Saga Drake',
    power: 5,
    toughness: 4,
    text: '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after IV.)\n' +
      'I — Sonic Wings — Each opponent chooses a creature with the greatest mana value among creatures they control. ' +
      'Return those creatures to their owners’ hands. \n' +
      'II, III, IV — Tap up to one target creature and put a stun counter on it.\n' +
      'Flying',
    imagePath: '/assets/cards/summon-valefor.webp',
    saga: {
      chapters: [
        { numbers: [1], effects: [{ type: 'bounceOpponentCreaturesWithGreatestManaValue' }] },
        { numbers: [2, 3, 4], effects: [{ type: 'tapUpToOneTargetCreatureAndStun' }] },
      ],
      sacrificeAfterFinalChapter: true,
    },
  },
  {
    id: 'summon-yojimbo',
    name: 'Summon: Yojimbo',
    costLabel: '{3}{W}',
    type: 'creature',
    subtype: 'Enchantment Creature Saga Samurai',
    power: 5,
    toughness: 5,
    text: '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after IV.)\n' +
      'I — Exile target artifact, enchantment, or tapped creature an opponent controls.\n' +
      'II, III — Until your next turn, creatures can’t attack you unless their controller pays {2} for each of those creatures.\n' +
      'IV — Create X Treasure tokens, where X is the number of opponents who control a creature with power 4 or greater.\n' +
      'Vigilance',
    imagePath: '/assets/cards/summon-yojimbo.webp',
    saga: {
      chapters: [
        { numbers: [1], effects: [{ type: 'exileTargetPermanent', targetFilter: 'artifactEnchantmentOrTappedCreature', opponentControlledOnly: true }] },
        { numbers: [2, 3], effects: [{ type: 'grantAttacksCostUntilNextTurn', amount: 2 }] },
        { numbers: [4], effects: [{ type: 'createTokenIfOpponentControlsCreatureWithPowerAtLeast', tokenId: 'token-treasure', minPower: 4, count: 1 }] },
      ],
      sacrificeAfterFinalChapter: true,
    },
  },
  {
    id: 'summoning-materia',
    name: 'Summoning Materia',
    costLabel: '{2}{G}',
    type: 'artifact',
    subtype: 'Artifact Equipment',
    // "You may look at the top card of your library any time" is purely
    // informational (no hidden-zone mechanic this engine enforces against
    // its own controller to begin with). "You may cast creature spells from
    // the top of your library" (while attached) is deferred - this engine
    // has no persistent "play from a different zone" permission that tracks
    // a MOVING target (the top card) rather than a fixed instanceId, the
    // same gap already documented on The Lunar Whale/Traveling Chocobo.
    text: 'You may look at the top card of your library any time.\n' +
      'As long as this Equipment is attached to a creature, you may cast creature spells from the top of your library.\n' +
      'Equipped creature gets +2/+2 and has vigilance and “{T}: Add {G}.”\n' +
      'Equip {2}',
    imagePath: '/assets/cards/summoning-materia.webp',
    equipBuff: { power: 2, toughness: 2 },
    equipGrantsKeyword: 'vigilance',
    equipGrantsManaAbility: 'G',
    equipCost: '{2}',
    attachesTo: 'creature',
  },
  {
    id: 'summoner-s-sending',
    name: 'Summoner’s Sending',
    costLabel: '{1}{W}',
    type: 'enchantment',
    text: 'At the beginning of your end step, you may exile target creature card from a graveyard. If you do, create a 1/1 white Spirit creature token with flying. Put a +1/+1 counter on it if the exiled card’s mana value is 4 or greater.',
    imagePath: '/assets/cards/summoner-s-sending.webp',
    onOwnEndStep: [
      {
        type: 'exileTargetGraveyardCard',
        optional: true,
        creatureOnly: true,
        thenCreateToken: { tokenId: 'token-spirit', counterIfManaValueAtLeast: { value: 4, counterLabel: '+1/+1', counterAmount: 1 } },
      },
    ],
  },
  {
    id: 'sun-titan',
    name: 'Sun Titan',
    costLabel: '{4}{W}{W}',
    type: 'creature',
    subtype: 'Creature Giant',
    power: 6,
    toughness: 6,
    text: 'Vigilance\n' +
      'Whenever this creature enters or attacks, you may return target permanent card with mana value 3 or less from your graveyard to the battlefield.\n' +
      'Wrexsoul is formed of the countless souls lost during the conflict one thousand years past…',
    imagePath: '/assets/cards/sun-titan.webp',
    onEnter: [{ type: 'reanimateTargetFromGraveyard', anyPermanentInsteadOfCreature: true, maxManaValue: 3, optional: true }],
    onAttack: [{ type: 'reanimateTargetFromGraveyard', anyPermanentInsteadOfCreature: true, maxManaValue: 3, optional: true }],
  },
  {
    id: 'sunscorch-regent',
    name: 'Sunscorch Regent',
    costLabel: '{3}{W}{W}',
    type: 'creature',
    subtype: 'Creature Dragon',
    power: 4,
    toughness: 3,
    text: 'Flying\n' +
      'Whenever an opponent casts a spell, put a +1/+1 counter on this creature and you gain 1 life.',
    imagePath: '/assets/cards/sunscorch-regent.webp',
    onOpponentCastsSpell: { counterLabel: '+1/+1', counterAmount: 1, alsoGainLife: 1 },
  },
  {
  id: 'suplex',
  name: 'Suplex',
  costLabel: '{1}{R}',
  type: 'sorcery',
  text: 'Choose one — \n' +
  '• Suplex deals 3 damage to target creature. If that creature would die this turn, exile it instead. \n' +
  '• Exile target artifact.',
  imagePath:'/assets/cards/suplex.webp',
  onCast: [
    {
      type: 'chooseOneMode',
      modes: [
        { label: 'Deal 3 damage to target creature', effects: [{ type: 'damageTargetCreature', amount: 3, exileIfDies: true }] },
        { label: 'Exile target artifact', effects: [{ type: 'exileTargetPermanent', targetFilter: 'artifact' }] },
      ],
    },
  ],
  },
  {
  id: 'swallowed-by-leviathan',
  name: 'Swallowed by Leviathan',
  costLabel: '{2}{U}',
  type: 'instant',
  text: 'Choose target spell. Surveil 2, then counter the chosen spell unless its controller pays 1 for each card in your graveyard. ' +
  '(To surveil 2, look at the top two cards of your library, then put any number of them into your graveyard and the rest on top of your library in any order.)',
  imagePath:'/assets/cards/swallowed-by-leviathan.webp',
  // Deferred - same reason as Syncopate: this engine has no stack/priority
  // system, so "target spell" has nothing left to point at by the time a
  // response could be cast. Blocked on the same missing architecture, not
  // a per-card gap.
  },
  {
  id: 'swamp',
  name: 'Swamp',
  costLabel: '-',
  type: 'land',
  text: 'Tap add B',
  imagePath:'/assets/cards/swamp.webp',
  producesMana: 'B'
  },
  {
    id: 'swiftfoot-boots',
    name: 'Swiftfoot Boots',
    costLabel: '{2}',
    type: 'artifact',
    subtype: 'Artifact Equipment',
    text: 'Equipped creature has hexproof and haste. (It can’t be the target of spells or abilities your opponents control. It can attack and {T} no matter when it came under your control.)\n' +
      'Equip {1} ({1}: Attach to target creature you control. Equip only as a sorcery.)\n' +
      '“You can gain all kinds of abilities by equipping relics.”\n' +
      '—South Figaro merchant',
    imagePath: '/assets/cards/swiftfoot-boots.webp',
    attachesTo: 'creature',
    equipCost: '{1}',
    equipGrantsKeyword: ['hexproof', 'haste'],
  },
  {
    id: 'sword-of-the-animist',
    name: 'Sword of the Animist',
    costLabel: '{2}',
    type: 'artifact',
    subtype: 'Legendary Artifact Equipment',
    text: 'Equipped creature gets +1/+1.\n' +
      'Whenever equipped creature attacks, you may search your library for a basic land card, put it onto the battlefield tapped, then shuffle.\n' +
      'Equip {2}\n' +
      '“Don’t fight here! You’ll ruin the flowers!”',
    imagePath: '/assets/cards/sword-of-the-animist.webp',
    equipBuff: { power: 1, toughness: 1 },
    equipGrantsOnAttack: [{ type: 'mayEffect', effects: [{ type: 'searchLibraryForBasicLand', toBattlefieldTapped: true }] }],
    equipCost: '{2}',
    attachesTo: 'creature',
  },
  {
    id: 'swords-to-plowshares',
    name: 'Swords to Plowshares',
    costLabel: '{W}',
    type: 'instant',
    text: 'Exile target creature. Its controller gains life equal to its power.\n' +
      '“The refreshing caress of the wind, the soothing whisper of the waves… how liberating!”',
    imagePath: '/assets/cards/swords-to-plowshares.webp',
    onCast: [{ type: 'exileTargetCreatureThenControllerGainsLifeEqualToPower' }],
  },
  {
  id: 'syncopate',
  name: 'Syncopate',
  costLabel: '{X}{U}',
  type: 'instant',
  text: 'Counter target spell unless its controller pays {X}. If that spell is countered this way, exile it instead of putting it into its owner\u2019s graveyard.',
  imagePath: '/assets/cards/syncopate.webp',
  // Deferred - this engine has no stack/priority system (see the similar
  // note on line 37): CAST_CARD resolves a spell's effects immediately,
  // so there is no "spell sitting on the stack" object left to counter by
  // the time any other card could respond. A real implementation would
  // need a whole new casting pipeline (announce -> priority window for
  // responses -> resolve), not just a new effect on this one card.
  },
  {
  id: 'syphon-mind',
  name: 'Syphon Mind',
  costLabel: '{3}{B}',
  type: 'sorcery',
  text: 'Each other player discards a card. You draw a card for each card discarded this way.\n' +
    '“’Tis now all but certain that the towers were conceived to facilitate the summoning of primals by those imprisoned within.”\n' +
    '—Urianger Augurelt',
  imagePath: '/assets/cards/syphon-mind.webp',
  onCast: [{ type: 'eachOpponentDiscards', count: 1, thenCasterDrawsForEachDiscarded: true }],
  },
  {
    id:'syr-konrad-the-grim',
    name:'Golbez, Clad in Darkness',
    costLabel:'{3}{B}{B}',
    type:'creature',
    subtype:'Legendary Creature — Human Knight',
    power: 5,
    toughness: 4,
    text:'Whenever another creature dies, or a creature card is put into a graveyard from anywhere other than the battlefield, or a creature card leaves your graveyard, Golbez deals 1 damage to each opponent.\n'+
    '{1}{B}: Each player mills a card.',
    imagePath:'/assets/cards/syr-konrad-the-grim.webp',
    // Only "another creature dies" (the first of three OR'd conditions) is
    // implemented - see onAnyCreatureDeathAnywhereDamageEachOpponent's own
    // doc comment for why the other two are deferred.
    onAnyCreatureDeathAnywhereDamageEachOpponent: 1,
    abilities: [
      {
        id: 'golbez-clad-in-darkness-mill',
        label: 'Mill',
        cost: { manaLabel: '{1}{B}' },
        effects: [{ type: 'eachPlayerMills', count: 1 }],
        effectText: 'Each player mills a card.',
      },
    ],
  },
  {
    id: 'talisman-of-conviction',
    name: 'Talisman of Conviction',
    costLabel: '{2}',
    type: 'artifact',
    text: '{T}: Add {C}.\n' +
      '{T}: Add {R} or {W}. This artifact deals 1 damage to you.\n' +
      '“He’s alive… Locke’s alive!”\n' +
      '—Celes Chere',
    imagePath: '/assets/cards/talisman-of-conviction.webp',
    producesMana: ['C'],
    altProducesMana: { colors: ['R', 'W'], payLife: 1 },
  },
  {
    id: 'talisman-of-dominance',
    name: 'Talisman of Dominance',
    costLabel: '{2}',
    type: 'artifact',
    text: '{T}: Add {C}.\n' +
      '{T}: Add {U} or {B}. This artifact deals 1 damage to you.\n' +
      '“The Ascian used me, as he used so many others-all to further the restoration of his wretched god.”\n' +
      '—Gaius Baelsar',
    imagePath: '/assets/cards/talisman-of-dominance.webp',
    producesMana: ['C'],
    altProducesMana: { colors: ['U', 'B'], payLife: 1 },
  },
  {
    id: 'talisman-of-hierarchy',
    name: 'Talisman of Hierarchy',
    costLabel: '{2}',
    type: 'artifact',
    text: '{T}: Add {C}.\n' +
      '{T}: Add {W} or {B}. This artifact deals 1 damage to you.\n' +
      '“A red mage’s spells belong to two distinct schools, rooted as they are in the ancient disciplines of black and white magic.”',
    imagePath: '/assets/cards/talisman-of-hierarchy.webp',
    producesMana: ['C'],
    altProducesMana: { colors: ['W', 'B'], payLife: 1 },
  },
  {
    id: 'talisman-of-indulgence',
    name: 'Talisman of Indulgence',
    costLabel: '{2}',
    type: 'artifact',
    text: '{T}: Add {C}.\n' +
      '{T}: Add {B} or {R}. This artifact deals 1 damage to you.\n' +
      '“Hee-hee-hee! You’re not getting away from me!”',
    imagePath: '/assets/cards/talisman-of-indulgence.webp',
    producesMana: ['C'],
    altProducesMana: { colors: ['B', 'R'], payLife: 1 },
  },
  {
    id: 'talisman-of-progress',
    name: 'Talisman of Progress',
    costLabel: '{2}',
    type: 'artifact',
    text: '{T}: Add {C}.\n' +
      '{T}: Add {W} or {U}. This artifact deals 1 damage to you.\n' +
      '“Master Louisoix… I understand now… the choice you made… In death… there is life…”\n' +
      '—Moenbryda Wilfsunnwyn',
    imagePath: '/assets/cards/talisman-of-progress.webp',
    producesMana: ['C'],
    altProducesMana: { colors: ['W', 'U'], payLife: 1 },
  },
  {
    id: 'tangled-islet',
    name: 'Tangled Islet',
    costLabel: '-',
    type: 'land',
    text: '({T}: Add {G} or {U}.)\n' +
      'This land enters tapped.\n' +
      '“Are you heading for Kilika Temple? Then just follow this trail. There are poisonous fiends in the forest. Be on your guard!”\n' +
      '—Crusader captain',
    imagePath: '/assets/cards/tangled-islet.webp',
    entersTapped: true,
    producesMana: ['G', 'U'],
  },
  {
    id: 'tataru-taru',
    name: 'Tataru Taru',
    costLabel: '{1}{W}',
    type: 'creature',
    subtype: 'Legendary Creature — Dwarf Advisor',
    power: 0,
    toughness: 3,
    text: 'When Tataru Taru enters, you draw a card and target opponent may draw a card.\n' +
      'Scions’ Secretary — Whenever an opponent draws a card, if it isn’t that player’s turn, create a tapped Treasure token. This ability triggers only once each turn.',
    imagePath: '/assets/cards/tataru-taru.webp',
    onEnter: [{ type: 'drawThenTargetOpponentMayDraw' }],
    onOpponentDrawsOffTurnCreateTappedTokenOncePerTurn: { tokenId: 'token-treasure' },
  },
  {
  id: 'tellah-great-sage',
  name: 'Tellah, Great Sage',
  costLabel: '{3}{U}{R}',
  type: 'creature',
  subtype: 'Legendary Creature Human Wizard',
  power: 3,
  toughness: 3,
  text: 'Whenever you cast a noncreature spell, create a 1/1 colorless Hero creature token. If four or more mana was spent to cast that spell, ' +
  'draw two cards. If eight or more mana was spent to cast that spell, sacrifice Tellah and it deals that much damage to each opponent.',
  noncreatureCastTrigger: {
    createTokenIfExpensive: { minManaValue: 0, tokenId: 'token-hero' },
    drawCardsIfExpensive: { minManaValue: 4, amount: 2 },
    sacrificeSelfAndDealDamageEqualToManaSpentIfExpensive: { minManaValue: 8 },
  },
  imagePath: '/assets/cards/tellah-great-sage.webp'
  },
  {
    id: 'temple-of-enlightenment',
    name: 'Temple of Enlightenment',
    costLabel: '-',
    type: 'land',
    text: 'This land enters tapped.\n' +
      'When this land enters, scry 1. (Look at the top card of your library. You may put that card on the bottom.)\n' +
      '{T}: Add {W} or {U}.',
    imagePath: '/assets/cards/temple-of-enlightenment.webp',
    entersTapped: true,
    // This engine only has surveil (no separate scry) - see engine/actions.ts:
    // resolveSurveil's own comment on Matoya, Archon Elder for the same
    // established simplification. "Look at the top card, may put it on the
    // bottom" collapses to "surveil 1" (look, then keep on top or send to
    // the graveyard) - not a perfect match (scry's alternate destination is
    // the BOTTOM of the library, not the graveyard), but with only one card
    // looked at, choosing to keep it on top vs. sending it away is the same
    // meaningful decision either way.
    onEnter: [{ type: 'surveil', count: 1 }],
    producesMana: ['W', 'U'],
  },
  {
    id: 'temple-of-mystery',
    name: 'Temple of Mystery',
    costLabel: '-',
    type: 'land',
    text: 'This land enters tapped.\n' +
      'When this land enters, scry 1. (Look at the top card of your library. You may put that card on the bottom.)\n' +
      '{T}: Add {G} or {U}.',
    imagePath: '/assets/cards/temple-of-mystery.webp',
    entersTapped: true,
    onEnter: [{ type: 'surveil', count: 1 }],
    producesMana: ['G', 'U'],
  },
  {
    id: 'temple-of-plenty',
    name: 'Temple of Plenty',
    costLabel: '-',
    type: 'land',
    text: 'This land enters tapped.\n' +
      'When this land enters, scry 1. (Look at the top card of your library. You may put that card on the bottom.)\n' +
      '{T}: Add {G} or {W}.',
    imagePath: '/assets/cards/temple-of-plenty.webp',
    entersTapped: true,
    onEnter: [{ type: 'surveil', count: 1 }],
    producesMana: ['G', 'W'],
  },
  {
    id: 'temple-of-the-false-god',
    name: 'Temple of the False God',
    costLabel: '-',
    type: 'land',
    text: '{T}: Add {C}{C}. Activate only if you control five or more lands.\n' +
      '“It is better for you to die in hope than to live in despair. Let me be your liberator.”\n' +
      '—Lady Yunalesca',
    imagePath: '/assets/cards/temple-of-the-false-god.webp',
    producesMana: 'C',
    producesManaAmount: 2,
    producesManaOnlyIfControlLandCount: 5,
  },
  {
    id:'temporal-extortion',
    name:'Absorb into Time',
    costLabel:'{B}{B}{B}{B}',
    type:'sorcery',
    text:'When you cast this spell, any player may pay half their life, rounded up. If a player does, counter Absorb into Time.\n'+
    'Take an extra turn after this one.\n'+
    '“Let us start a new reign of terror. I will let you live a fantasy beyond your imagination.”',
    imagePath:'/assets/cards/temporal-extortion.webp',
    onCast: [{ type: 'anyPlayerMayPayHalfLifeToCounterThenExtraTurn' }],
  },
  {
    id: 'terra-herald-of-hope',
    name: 'Terra, Herald of Hope',
    costLabel: '{R}{W}{B}',
    type: 'creature',
    subtype: 'Legendary Creature Human Wizard Warrior',
    power: 3,
    toughness: 3,
    text: 'Trance — At the beginning of combat on your turn, mill two cards. Terra gains flying until end of turn.\n' +
      'Whenever Terra deals combat damage to a player, you may pay {2}. When you do, return target creature card with power 3 or less from your graveyard to the battlefield tapped.',
    imagePath: '/assets/cards/terra-herald-of-hope.webp',
    onOwnCombatBegin: [{ type: 'millSelf', count: 2 }, { type: 'pumpSelf', power: 0, toughness: 0, grantKeyword: 'flying' }],
    onCombatDamageToPlayer: [
      { type: 'mayPayManaThenEffect', manaCost: '{2}', effects: [{ type: 'reanimateTargetFromGraveyard', maxPower: 3, forceEntersTapped: true }] },
    ],
  },
  {
  id: 'terra-magical-adept',
  name: 'Terra, Magical Adept',
  costLabel: '{1}{R}{G}',
  type: 'creature',
  subtype: 'Legendary Creature Human Wizard Warrior',
  power: 4,
  toughness: 2,
  text: 'When Terra enters, mill five cards. Put up to one enchantment card milled this way into your hand. \n' +
  'Trance — 4RG, Tap: Exile Terra, then return it to the battlefield transformed under its owner\u2019s control. Activate only as a sorcery.',
  imagePath: '/assets/cards/terra-magical-adept.webp',
  transformsInto: 'esper-terra',
  // "Mill 5, put up to one enchantment card FROM AMONG THOSE MILLED into
  // hand" is exactly revealFiltered with restDestination 'graveyard' - the
  // chosen card is pulled into hand instead of joining the rest in the
  // graveyard, matching "milled this way" (only these 5, not the whole
  // graveyard).
  onEnter: [{ type: 'revealFiltered', count: 5, filterType: 'enchantment', restDestination: 'graveyard' }],
  abilities: [
    {
      id: 'terra-trance',
      label: 'Trance',
      cost: { manaLabel: '{4}{R}{G}', tap: true },
      onlyDuringOwnMainPhase: true,
      exileAndReturnTransformed: true,
      effectText: 'Exile Terra, then return it to the battlefield transformed under its owner’s control.',
    },
  ],
  },
  {
  id: 'esper-terra',
  name: 'Esper Terra',
  costLabel: '-',
  type: 'creature',
  subtype: 'Legendary Enchantment Creature Saga Wizard',
  power: 6,
  toughness: 6,
  text: '(As this Saga enters and after your draw step, add a lore counter.) \n' +
  'I, II, III — Create a token that’s a copy of target nonlegendary enchantment you control. It gains haste. ' +
  'If it\u2019s a Saga, put up to three lore counters on it. Sacrifice it at the beginning of your next end step.\n' +
  'IV — Add {W}{W}, {U}{U}, {B}{B}, {R}{R}, and {G}{G}. Exile Esper Terra, then return it to the battlefield (front face up).\n' +
  'Flying',
  imagePath: '/assets/cards/esper-terra.webp',
  // Chapters I-III are deferred entirely - "create a token copy of target
  // nonlegendary enchantment, conditionally seed it with lore counters, then
  // sacrifice it at a delayed end step" is well beyond any existing
  // mechanism. Chapter IV's mana is implemented; the "exile, then return"
  // half isn't - unlike Ifrit/Bahamut's matching chapter (which has a real
  // transformsInto back face), Terra returns as ITSELF ("front face up"),
  // and exileAndReturnTransformedSelfIfLoreAtLeast is transform-only, so
  // this Saga is left uncapped rather than sacrificed - it just keeps
  // accruing lore counters (chapters I-IV won't re-trigger once reached)
  // once it hits Chapter IV.
  saga: {
    chapters: [
      { numbers: [1, 2, 3], effects: [] },
      { numbers: [4], effects: [{ type: 'addMana', colors: { W: 2, U: 2, B: 2, R: 2, G: 2 } }] },
    ],
  },
  },
  {
    id: 'tifa-martial-artist',
    name: 'Tifa Martial Artist',
    costLabel: '{1}{R}{G}{W}',
    type: 'creature',
    subtype: 'Legendary Creature — Human Monk',
    power: 4,
    toughness: 4,
    text: 'Melee (Whenever this creature attacks, it gets +1/+1 until end of turn for each opponent you attacked this combat.)\n' +
      'Whenever one or more creatures you control with power 7 or greater deal combat damage to a player, untap all creatures you control. If it’s the first combat phase of your turn, there is an additional combat phase after this phase.',
    imagePath: '/assets/cards/tifa-martial-artist.webp',
    // Melee approximated as a flat +1/+1 on attack - in this 2-player
    // engine "each opponent you attacked this combat" is always exactly 1
    // (there's only one opponent to attack), so the real per-opponent
    // scaling and the flat approximation produce the same result here.
    onAttack: [{ type: 'pumpSelf', power: 1, toughness: 1 }],
    onAnyControlledCreatureWithPowerAtLeastCombatDamageToPlayer: {
      minPower: 7,
      effects: [{ type: 'untapAllControlledCreatures' }, { type: 'queueExtraCombatPhaseIfFirstCombatPhaseOfTurn' }],
    },
  },
  {
    id: 'thancred-waters',
    name: 'Thancred Waters',
    costLabel: '{4}{W}',
    type: 'creature',
    subtype: 'Legendary Creature — Human Warrior',
    power: 3,
    toughness: 5,
    text: 'Flash\n' +
      'Royal Guard — When Thancred Waters enters, another target legendary permanent you control gains indestructible for as long as you control Thancred Waters.\n' +
      'Whenever you cast a noncreature spell, Thancred Waters gains indestructible until end of turn.',
    imagePath: '/assets/cards/thancred-waters.webp',
    onEnter: [{ type: 'grantIndestructibleToTargetWhileSourceInPlay' }],
    noncreatureCastTrigger: { effects: [{ type: 'grantTemporaryKeywordToSelf', keyword: 'indestructible' }] },
  },
  {
  id: 'the-crystal-s-chosen',
  name: 'The Crystal\u2019s Chosen',
  costLabel: '{5}{W}{W}',
  type: 'sorcery',
  text: 'Create four 1/1 colorless Hero creature tokens. Then put a +1/+1 counter on each creature you control.',
  imagePath: '/assets/cards/the-crystal-s-chosen.webp',
  onCast: [
    { type: 'createToken', tokenId: 'token-hero', count: 4 },
    { type: 'buffOtherCreaturesYouControl', counterLabel: '+1/+1', counterAmount: 1 },
  ],
  },
  {
  id: 'the-darkness-crystal', 
  name: 'The Darkness Crystal',
  costLabel: '{2}{B}{B}',
  type: 'artifact',
  subtype: 'Legendary Artifact',
  text: 'Black spells you cast cost {1} less to cast. \n' +
  'If a nontoken creature an opponent controls would die, instead exile it and you gain 2 life. \n' +
  '{4}{B}{B}, {T}: Put target creature card exiled with The Darkness Crystal onto the battlefield tapped under your control with two additional +1/+1 counters on it.',
  imagePath: '/assets/cards/the-darkness-crystal.webp',
  reducesCastCostForColor: { color: 'B', amount: 1 },
  // The other two abilities are deferred - a universal "replace EVERY
  // opponent nontoken creature death with exile+lifegain" watcher plus an
  // activated ability that tracks and later reanimates specifically the
  // cards exiled BY THIS SOURCE (not just any exiled creature) are each a
  // meaningfully larger, single-card mechanism, same category as Cloud/
  // Town Greeter (deprioritized in an earlier bulk round).
  },
  {
    id:'the-destined-black-mage',
    name:'The Destined Black Mage',
    costLabel:'{2}{B}',
    type:'creature',
    subtype:'Legendary Creature \u2014 Human Wizard',
    power: 3,
    toughness: 2,
    text:'Deathtouch\n'+
    '{B}, {T}: Another target creature you control gains deathtouch until end of turn.\n'+
    'Whenever you cast a noncreature spell, The Destined Black Mage deals 1 damage to each opponent. If you have a full party, it deals 3 damage to each opponent instead.',
    imagePath:'/assets/cards/the-destined-black-mage.webp',
    abilities: [
      {
        id: 'the-destined-black-mage-deathtouch',
        label: 'Deathtouch',
        cost: { manaLabel: '{B}', tap: true },
        effects: [{ type: 'grantKeywordsToTargetPermanent', keywords: ['deathtouch'], creatureOnly: true, restrictToOwnCreature: true, excludesSource: true }],
        effectText: 'Another target creature you control gains deathtouch until end of turn.',
      },
    ],
    noncreatureCastTrigger: { damageEachOpponentOrMoreWithFullParty: { normal: 1, fullParty: 3 } },
  },
  {
    id:'the-destined-thief',
    name:'The Destined Thief',
    costLabel:'{2}{U}',
    type:'creature',
    subtype:'Legendary Creature \u2014 Human Rogue',
    power: 2,
    toughness: 2,
    text:'The Destined Thief can\u2019t be blocked.\n'+
    '{U}, {T}: Another target creature you control can\u2019t be blocked this turn.\n'+
    'Whenever one or more creatures you control deal combat damage to one or more players, draw a card, then discard a card. If you have a full party, instead draw three cards.',
    imagePath:'/assets/cards/the-destined-thief.webp',
    isUnblockableSelf: true,
    abilities: [
      {
        id: 'the-destined-thief-unblockable',
        label: 'Unblockable',
        cost: { manaLabel: '{U}', tap: true },
        effects: [{ type: 'grantKeywordsToTargetPermanent', keywords: ['unblockable'], creatureOnly: true, restrictToOwnCreature: true, excludesSource: true }],
        effectText: "Another target creature you control can't be blocked this turn.",
      },
    ],
    onAnyControlledCreatureOneOrMoreCombatDamageToPlayer: [{ type: 'ifFullParty', thenEffects: [{ type: 'drawCards', amount: 3 }], elseEffects: [{ type: 'loot', drawCount: 1, discardCount: 1 }] }],
  },
  {
    id:'the-destined-warrior',
    name:'The Destined Warrior',
    costLabel:'{1}{W}{U}{B}',
    type:'creature',
    subtype:'Legendary Creature \u2014 Human Warrior',
    power: 3,
    toughness: 3,
    text:'First strike, vigilance, menace\n'+
    'Cleric, Rogue, Warrior, and Wizard spells you cast cost {1} less to cast.\n'+
    'At the beginning of combat on your turn, creatures you control get +1/+0 until end of turn. If you have a full party, creatures you control get +3/+0 until end of turn instead.',
    imagePath:'/assets/cards/the-destined-warrior.webp',
    reducesCastCostForSubtypes: ['Cleric', 'Rogue', 'Warrior', 'Wizard'],
    onOwnCombatBegin: [{ type: 'pumpAllControlledOrMoreWithFullParty', power: 1, toughness: 0, fullPartyPower: 3, fullPartyToughness: 0 }],
  },
  {
    id:'the-destined-white-mage',
    name:'The Destined White Mage',
    costLabel:'{2}{W}',
    type:'creature',
    subtype:'Legendary Creature \u2014 Human Cleric',
    power: 2,
    toughness: 3,
    text:'Lifelink\n'+
    '{W}, {T}: Another target creature you control gains lifelink until end of turn.\n'+
    'Whenever you gain life, put a +1/+1 counter on target creature you control. If you have a full party, put three +1/+1 counters on that creature instead.',
    imagePath:'/assets/cards/the-destined-white-mage.webp',
    abilities: [
      {
        id: 'the-destined-white-mage-lifelink',
        label: 'Lifelink',
        cost: { manaLabel: '{W}', tap: true },
        effects: [{ type: 'grantKeywordsToTargetPermanent', keywords: ['lifelink'], creatureOnly: true, restrictToOwnCreature: true, excludesSource: true }],
        effectText: 'Another target creature you control gains lifelink until end of turn.',
      },
    ],
    onGainLifeTriggerTargeted: { counterLabel: '+1/+1', counterAmount: 1, fullPartyCounterAmount: 3 },
  },
  {
  id: 'the-earth-crystal',
  name: 'The Earth Crystal',
  costLabel: '{2}{G}{G}',
  type: 'artifact',
  subtype: 'Legendary Artifact',
  text: 'Green spells you cast cost {1} less to cast. \n' +
  'If one or more +1/+1 counters would be put on a creature you control, twice that many +1/+1 counters are put on that creature instead. \n' +
  '{4}{G}{G}, {T}: Distribute two +1/+1 counters among one or two target creatures you control.',
  imagePath: '/assets/cards/the-earth-crystal.webp',
  reducesCastCostForColor: { color: 'G', amount: 1 },
  // The other two abilities are deferred - doubling EVERY +1/+1 counter
  // placement across the whole engine is a universal replacement effect
  // that would need touching every counter-adding effect and combat
  // trigger, and the distribute-among-1-or-2-targets activated ability is
  // its own multi-target allocation mechanism - each a larger, single-card
  // job, same category as Cloud/Town Greeter (deprioritized earlier).
  },
  {
  id: 'the-emperor-of-palamecia',
  name: 'The Emperor of Palamecia',
  costLabel: '{U}{R}',
  type: 'creature',
  subtype: 'Legendary Creature Human Noble Warrior',
  power: 2,
  toughness: 2,
  text: '{T}: Add {U} or {R}. Spend this mana only to cast a noncreature spell. \n' +
  'Whenever you cast a noncreature spell, if at least four mana was spent to cast it, put a +1/+1 counter on The Emperor of Palamecia. ' +
  'Then if it has three or more +1/+1 counters on it, transform it.',
  imagePath: '/assets/cards/the-emperor-of-palamecia.webp',
  transformsInto: 'the-lord-master-of-hell'
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
  onAttack: [{ type: 'damageEachOpponentEqualToGraveyardNoncreatureNonlandCount' }],
  imagePath: '/assets/cards/the-lord-master-of-hell.webp'
  },
  {
    id: 'the-falcon-airship-restored',
    name: 'The Falcon, Airship Restored',
    costLabel: '{2}{B}',
    type: 'artifact',
    subtype: 'Legendary Artifact — Vehicle',
    power: 4,
    toughness: 3,
    text: 'Flying\n' +
      'Whenever The Falcon deals combat damage to a player, you may sacrifice it. When you do, return target creature card from your graveyard to the battlefield.\n' +
      '{4}{B}: Return this card from your graveyard to the battlefield tapped.\n' +
      'Crew 2',
    imagePath: '/assets/cards/the-falcon-airship-restored.webp',
    crew: 2,
    onCombatDamageToPlayer: [{ type: 'mayEffect', effects: [{ type: 'sacrificeSelf' }, { type: 'reanimateTargetFromGraveyard' }] }],
    abilities: [
      {
        id: 'the-falcon-airship-restored-return',
        label: 'Return',
        cost: { manaLabel: '{4}{B}' },
        effectText: 'Return this card from your graveyard to the battlefield tapped.',
        returnSelfFromGraveyard: { tapped: true },
      },
    ],
  },
  {
  id: 'the-final-days',
  name: 'The Final Days', 
  costLabel: '{2}{B}{B}',
  type: 'sorcery',
  text: 'Create two tapped 2/2 black Horror creature tokens. If this spell was cast from a graveyard, instead create X of those tokens, ' +
  'where X is the number of creature cards in your graveyard. \nFlashback {4}{B}{B}',
  imagePath: '/assets/cards/the-final-days.webp',
  onCast: [{ type: 'createToken', tokenId: 'token-horror', count: 2, tapped: true }],
  flashback: {
    cost: '{4}{B}{B}',
    effects: [{ type: 'createToken', tokenId: 'token-horror', count: 'perCreatureCardInYourGraveyard', tapped: true }],
  },
  },
  {
  id: 'the-fire-crystal',
  name: 'The Fire Crystal',
  costLabel: '{2}{R}{R}',
  type: 'artifact',
  subtype: 'Legendary Artifact',
  text: 'Red spells you cast cost {1} less to cast. \n' +
  'Creatures you control have haste. \n' +
  '{4}{R}{R}, {T}: Create a token that\u2019s a copy of target creature you control. Sacrifice it at the beginning of the next end step.',
  imagePath: '/assets/cards/the-fire-crystal.webp',
  reducesCastCostForColor: { color: 'R', amount: 1 },
  staticAnthemForControlledSubtype: { subtype: '*', power: 0, toughness: 0, grantKeywords: ['haste'] },
  // The activated ability ("create a token copy of target creature, then
  // sacrifice it at the next end step") is still deferred - no existing
  // copy effect pairs with a delayed "sacrifice at the next end step"
  // trigger.
  },
  {
  id: 'the-gold-saucer',
  name: 'The Gold Saucer',
  costLabel: '-',
  type: 'land',
  text: '{T}: Add {M}. \n' +
  '{2}, {T}: Flip a coin. If you win the flip, create a Treasure token. \n' +
  '{3}, {T}, Sacrifice two artifacts: Draw a card.',
  imagePath: '/assets/cards/the-gold-saucer.webp',
  producesMana: 'C',
  abilities: [
    {
      id: 'the-gold-saucer-flip',
      label: 'Flip a Coin',
      cost: { manaLabel: '{2}', tap: true },
      effects: [{ type: 'coinFlip', ifWinEffects: [{ type: 'createToken', tokenId: 'token-treasure' }] }],
      effectText: 'Flip a coin. If you win the flip, create a Treasure token.',
    },
    {
      id: 'the-gold-saucer-draw',
      label: 'Draw a Card',
      cost: { manaLabel: '{3}', tap: true, sacrificeAnother: 'artifact', sacrificeAnotherCount: 2 },
      effects: [{ type: 'drawCards', amount: 1 }],
      effectText: 'Sacrifice two artifacts: Draw a card.',
    },
  ],
  },
  {
  id: 'the-lunar-whale',
  name: 'The Lunar Whale',
  costLabel: '{3}{U}',
  type: 'artifact',
  subtype: 'Legendary Artifact Vehicle',
  text: 'Flying \n' +
  'You may look at the top card of your library any time.\n' +
  'As long as The Lunar Whale attacked this turn, you may play the top card of your library.\n' +
  'Crew 1',
  // Was missing its `crew` field entirely. The top-of-library play
  // permissions are deferred - no mechanism tracks "may play from library".
  crew: 1,
  imagePath: '/assets/cards/the-lunar-whale.webp'
  },
  {
  id: 'the-masamune',
  name: 'The Masamune',
  costLabel: '{3}',
  type: 'artifact',
  subtype: 'Legendary Artifact Equipment',
  text: 'As long as equipped creature is attacking, it has first strike and must be blocked if able.\n' +
  'Equipped creature has “If a creature dying causes a triggered ability of this creature or an emblem you own to trigger, that ability triggers an additional time.”\n' +
  'Equip {2}',
  // The conditional "while attacking" first-strike grant and the granted
  // death-trigger-doubling ability are deferred.
  attachesTo: 'creature',
  equipCost: '{2}',
  imagePath: '/assets/cards/the-masamune.webp'
  },
  {
  id: 'the-prima-vista',
  name: 'The Prima Vista',
  costLabel: '{4}{U}',
  type: 'artifact',
  subtype: 'Legendary Artifact Vehicle',
  power: 5,
  toughness: 3,
  text: 'Flying \n' +
  'Whenever you cast a noncreature spell, if at least four mana was spent to cast it, The Prima Vista becomes an artifact creature until end of turn.\n' +
  'Crew 2 (Tap any number of creatures you control with total power 2 or more: This Vehicle becomes an artifact creature until end of turn.)',
  // Was missing its `crew` field entirely. The alternate "becomes a creature
  // when you cast an expensive noncreature spell" trigger is deferred.
  crew: 2,
  imagePath: '/assets/cards/the-prima-vista.webp'
  },
  {
  id: 'the-regalia',
  name: 'The Regalia',
  costLabel: '{4}',
  type: 'artifact',
  subtype: 'Legendary Artifact — Vehicle',
  power: 4,
  toughness: 4,
  text: 'Haste \n' +
  'Whenever The Regalia attacks, reveal cards from the top of your library until you reveal a land card. ' +
  'Put that card onto the battlefield tapped and the rest on the bottom of your library in a random order. \n' +
  'Crew 1',
  // Was missing its `crew` field entirely. The "reveal until you hit a
  // land" attack trigger is deferred - no variable-length reveal mechanism
  // exists (only fixed-count reveals).
  crew: 1,
  imagePath: '/assets/cards/the-regalia.webp'
  },
  {
  id: 'the-wandering-minstrel',
  name: 'The Wandering Minstrel',
  costLabel: '{G}{U}',
  type: 'creature',
  subtype: 'Legendary Creature Human Bird',
  power: 1,
  toughness: 3,
  text: 'Lands you control enter untapped. \n' +
  'The Minstrel\u2019s Ballad — At the beginning of combat on your turn, if you control five or more Towns, create a 2/2 Elemental creature token thats all colors. \n' +
  '{3}{W}{U}{B}{R}{G}: Other creatures you control get +X/+X until end of turn, where X is the number of Towns you control.',
  imagePath: '/assets/cards/the-wandering-minstrel.webp',
  // "Lands you control enter untapped" is deferred - no replacement effect
  // overrides CardDefinition.entersTapped for a controller's own lands.
  onOwnCombatBegin: [{ type: 'createTokenIfControlledSubtypeCountAtLeast', subtype: 'Town', minCount: 5, tokenId: 'token-elemental' }],
  abilities: [
    {
      id: 'the-wandering-minstrel-ballad',
      label: 'Ballad',
      cost: { manaLabel: '{3}{W}{U}{B}{R}{G}' },
      effects: [{ type: 'buffOtherCreaturesYouControlByControlledSubtypeCount', subtype: 'Town' }],
      effectText: 'Other creatures you control get +X/+X until end of turn, where X is the number of Towns you control.',
    },
  ],
  },
  {
  id: 'the-warring-triad',
  name: 'The Warring Triad',
  costLabel: '{3}',
  type: 'creature',
  subtype: 'Legendary Artifact Creature',
  power: 5,
  toughness: 5,
  text: 'Flying, trample, haste\n' +
    'As long as there are fewer than eight cards in your graveyard, The Warring Triad isn’t a creature.\n' +
    '{T}, Mill a card: Target player adds one mana of any color. (Activate only as an instant.)',
  imagePath: '/assets/cards/the-warring-triad.webp',
  // "Isn't a creature while your graveyard has fewer than eight cards" is
  // deferred - def.type === 'creature' is checked directly (not through a
  // single overridable helper) in far too many places across this engine
  // (summoning sickness, legal attacker/blocker, combat eligibility, ...)
  // for a conditional de-animation to be retrofitted safely for one card.
  abilities: [
    {
      id: 'the-warring-triad-mana',
      label: 'Add mana',
      cost: { tap: true, millSelf: 1 },
      effects: [{ type: 'addOneManaOfChosenColor' }],
      effectText: 'Target player adds one mana of any color.',
    },
  ],
  },
  {
  id: 'the-water-crystal',
  name: 'The Water Crystal',
  costLabel: '{2}{U}{U}',
  type: 'artifact',
  subtype: 'Legendary Artifact',
  text: 'Blue spells you cast cost {1} less to cast. \n' +
  'If an opponent would mill one or more cards, they mill that many cards plus four instead. \n' +
  '{4}{U}{U}, {T}: Each opponent mills cards equal to the number of cards in your hand.',
  imagePath: '/assets/cards/the-water-crystal.webp',
  reducesCastCostForColor: { color: 'U', amount: 1 },
  // The opponent-mill replacement effect ("if an opponent would mill one or
  // more cards, they mill that many plus four instead") is still deferred -
  // no general damage/mill/life-gain replacement-effect mechanism exists
  // yet (only the specific finality-counter and onDeathExileAndCreateTokens
  // replacement effects, neither of which generalizes to this).
  abilities: [
    {
      id: 'the-water-crystal-mill',
      label: 'Mill',
      cost: { manaLabel: '{4}{U}{U}', tap: true },
      effects: [{ type: 'millEachOpponentByYourHandSize' }],
      effectText: 'Each opponent mills cards equal to the number of cards in your hand.',
    },
  ],
  },
  {
  id: 'the-wind-crystal',
  name: 'The Wind Crystal',
  costLabel: '{2}{W}{W}',
  type: 'artifact',
  subtype: 'Legendary Artifact',
  text: 'White spells you cast cost {1} less to cast. \n' +
  'If you would gain life, you gain twice that much life instead. \n' +
  '{4}{W}{W}, {T}: Creatures you control gain flying and lifelink until end of turn.',
  imagePath: '/assets/cards/the-wind-crystal.webp',
  reducesCastCostForColor: { color: 'W', amount: 1 },
  // "If you would gain life, you gain twice that much life instead" is
  // still deferred - no general life-gain replacement-effect mechanism
  // exists yet (gainLife/addLife always apply the exact requested amount).
  abilities: [
    {
      id: 'the-wind-crystal-empower',
      label: 'Empower',
      cost: { manaLabel: '{4}{W}{W}', tap: true },
      effects: [
        { type: 'buffOtherCreaturesYouControl', grantKeyword: 'flying' },
        { type: 'buffOtherCreaturesYouControl', grantKeyword: 'lifelink' },
      ],
      effectText: 'Creatures you control gain flying and lifelink until end of turn.',
    },
  ],
  },
  {
  id: 'thief-s-knife',
  name: 'Thief\u2019s Knife',
  costLabel: '{2}{U}',
  type: 'artifact',
  subtype: 'Equipment',
  text: 'Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.)\n' +
  'Equipped creature gets +1/+1, has “Whenever this creature deals combat damage to a player, draw a card,” and is a Rogue in addition to its other types.\n' +
  'Equip {4}',
  onEnter: [{ type: 'createToken', tokenId: 'token-hero', attachSelfToToken: true }],
  attachesTo: 'creature',
  equipCost: '{4}',
  equipBuff: { power: 1, toughness: 1 },
  equipGrantsSubtype: 'Rogue',
  equipGrantsOnCombatDamageToPlayer: [{ type: 'drawCards', amount: 1 }],
  imagePath: '/assets/cards/thief-s-knife.webp'
  },
  {
  id: 'thought-vessel',
  name: 'Thought Vessel',
  costLabel: '{2}',
  type: 'artifact',
  text: 'You have no maximum hand size.\n' +
    '{T}: Add {C}.\n' +
    'Initiating… Performing diagnostics… Diagnostics complete. To proceed, please agree to the terms and conditions of use.',
  imagePath: '/assets/cards/thought-vessel.webp',
  // "You have no maximum hand size" needs no field at all - this engine
  // never actually enforces a hand-size discard in the first place (the
  // end-of-turn ">7 cards" check is only a log reminder, not a forced
  // discard), so every player already effectively has no maximum.
  producesMana: 'C',
  },
  {
    id: 'three-visits',
    name: 'Three Visits',
    costLabel: '{1}{G}',
    type: 'sorcery',
    text: 'Search your library for a Forest card, put it onto the battlefield, then shuffle.\n' +
      '“If I give up now, I could do anything I wanted to, and yet … even if I was with you, I could never forget.”\n' +
      '—Yuna',
    imagePath: '/assets/cards/three-visits.webp',
    onCast: [{ type: 'searchLibraryForLand', landName: 'Forest', toBattlefieldUntapped: true }],
  },
  {
  id: 'thunder-magic',
  name: 'Thunder Magic',
  costLabel: '-',
  type: 'instant',
  text: 'Tiered (Choose one additional cost.) \n' +
  '• Thunder — {0} — Thunder Magic deals 2 damage to target creature. \n' +
  '• Thundara — {3} — Thunder Magic deals 4 damage to target creature. \n' +
  '• Thundaga — {5}{R} — Thunder Magic deals 8 damage to target creature.',
  imagePath: '/assets/cards/thunder-magic.webp',
  tieredModes: [
    { label: 'Thunder — {0} — 2 damage to target creature', additionalCost: '{0}', effects: [{ type: 'damageTargetCreature', amount: 2 }] },
    { label: 'Thundara — {3} — 4 damage to target creature', additionalCost: '{3}', effects: [{ type: 'damageTargetCreature', amount: 4 }] },
    { label: 'Thundaga — {5}{R} — 8 damage to target creature', additionalCost: '{5}{R}', effects: [{ type: 'damageTargetCreature', amount: 8 }] },
  ],
  },
  {
  id: 'tidus-blitzball-star',
  name: 'Tidus, Blitzball Star',
  costLabel: '{1}{W}{U}',
  type: 'creature',
  subtype: 'Legendary Creature Human Warrior',
  power: 2,
  toughness: 1,
  text: 'Whenever an artifact you control enters, put a +1/+1 counter on Tidus. \n' +
  'Whenever Tidus attacks, tap target creature an opponent controls.',
  imagePath: '/assets/cards/tidus-blitzball-star.webp',
  onAnyArtifactEnterTrigger: [{ type: 'putCounterOnSelf', counterLabel: '+1/+1', counterAmount: 1 }],
  onAttack: [{ type: 'tapAndStun', targetController: 'opponent', targetType: 'creature', noStunCounter: true }],
  },
  {
    id: 'tidus-yuna-s-guardian',
    name: 'Tidus, Yuna’s Guardian',
    costLabel: '{G}{W}{U}',
    type: 'creature',
    subtype: 'Legendary Creature Human Warrior',
    power: 3,
    toughness: 3,
    text: 'At the beginning of combat on your turn, you may move a counter from target creature you control ' +
      'onto a second target creature you control.\n' +
      'Cheer — Whenever one or more creatures you control with counters on them deal combat damage to a player, ' +
      'you may draw a card and proliferate. Do this only once each turn.',
    imagePath: '/assets/cards/tidus-yuna-s-guardian.webp',
    onOwnCombatBegin: [{ type: 'mayEffect', effects: [{ type: 'moveCounterBetweenTargetCreatures' }] }],
    onAnyControlledCreatureWithCountersCombatDamageToPlayer: [{ type: 'mayEffect', effects: [{ type: 'drawCards', amount: 1 }, { type: 'proliferate' }] }],
  },
  {
  id: 'tifa-lockhart',
  name: 'Tifa Lockhart',
  costLabel: '{1}{G}',
  type: 'creature',
  // Was missing power/toughness entirely.
  power: 2,
  toughness: 2,
  text: 'Trample \n' +
  'Landfall — Whenever a land you control enters, double Tifa Lockhart\u2019s power until end of turn.',
  imagePath: '/assets/cards/tifa-lockhart.webp',
  landfall: { doubleSelfPowerUntilEndOfTurn: true },
  },
  {
  id: 'tifa-s-limit-break',
  name: 'Tifa\u2019s Limit Break',
  costLabel: '{G}',
  type: 'instant',
  text: 'Tiered (Choose one additional cost.) \n' +
  '• Somersault — {0} — Target creature gets +2/+2 until end of turn. \n' +
  '• Meteor Strikes — {2} — Double target creature’s power and toughness until end of turn. \n' +
  '• Final Heaven — {6}{G} — Triple target creature’s power and toughness until end of turn.',
  imagePath: '/assets/cards/tifa-s-limit-break.webp',
  tieredModes: [{ label: 'Somersault — {0} — Target creature gets +2/+2 until end of turn', additionalCost: '{0}', effects: [{ type: 'pumpTarget', power: 2, toughness: 2 }] }],
  // Meteor Strikes and Final Heaven ("double"/"triple target creature's
  // power and toughness") are still deferred - no effect here can scale a
  // TARGET's stats by a multiplier (only doubleSelfPowerUntilEndOfTurn
  // exists, which is self-only and power-only); Somersault alone is wired
  // via the existing pumpTarget effect.
  },
  {
    id: 'tireless-tracker',
    name: 'Tireless Tracker',
    costLabel: '{2}{G}',
    type: 'creature',
    subtype: 'Creature Human Scout',
    power: 3,
    toughness: 2,
    text: 'Landfall — Whenever a land you control enters, investigate. (Create a Clue token. It’s an artifact with "{2}, Sacrifice this token: Draw a card.")\n' +
      'Whenever you sacrifice a Clue, put a +1/+1 counter on this creature.',
    imagePath: '/assets/cards/tireless-tracker.webp',
    landfall: { createTokenId: 'token-clue' },
    onControlledTokenSacrificed: { tokenId: 'token-clue', counterLabel: '+1/+1', counterAmount: 1 },
  },
  {
    id: 'together-forever',
    name: 'Together Forever',
    costLabel: '{W}{W}',
    type: 'enchantment',
    text: 'When this enchantment enters, support 2. (Put a +1/+1 counter on each of up to two target creatures.)\n' +
      '{1}: Choose target creature with a counter on it. When that creature dies this turn, return that card to its owner’s hand.',
    imagePath: '/assets/cards/together-forever.webp',
    onEnter: [{ type: 'support', counterLabel: '+1/+1', counterAmount: 1, count: 2 }],
    abilities: [
      {
        id: 'together-forever-bind',
        label: 'Bind Fate',
        cost: { manaLabel: '{1}' },
        effects: [{ type: 'grantOnDeathReturnToHandToTarget' }],
        effectText: "Choose target creature with a counter on it. When that creature dies this turn, return that card to its owner's hand.",
      },
    ],
  },
  {
  id: 'tome-of-legends',
  name: 'Tome of Legends',
  costLabel: '{2}',
  type: 'artifact',
  text: 'This artifact enters with a page counter on it.\n' +
    'Whenever your commander enters or attacks, put a page counter on this artifact.\n' +
    '{1}, {T}, Remove a page counter from this artifact: Draw a card.',
  imagePath: '/assets/cards/tome-of-legends.webp',
  onEnter: [{ type: 'putCounterOnSelf', counterLabel: 'page', counterAmount: 1 }],
  onCommanderEnterOrAttack: [{ type: 'putCounterOnSelf', counterLabel: 'page', counterAmount: 1 }],
  abilities: [
    {
      id: 'tome-of-legends-draw',
      label: 'Remove a Page Counter: Draw a Card',
      cost: { manaLabel: '{1}', tap: true, removeCounterFromSelf: { label: 'page' } },
      effects: [{ type: 'drawCards', amount: 1 }],
      effectText: 'Draw a card.',
    },
  ],
  },
  {
  id: 'tonberry',
  name: 'Tonberry',
  costLabel: '{B}',
  type: 'creature',
  subtype: 'Creature Salamander Horror',
  // Was missing power/toughness entirely.
  power: 2,
  toughness: 2,
  text: 'This creature enters tapped with a stun counter on it. (If it would become untapped, remove a stun counter from it instead.) \n' +
  'Chef\u2019s Knife — During your turn, this creature has first strike and deathtouch.',
  imagePath: '/assets/cards/tonberry.webp',
  entersTapped: true,
  onEnter: [{ type: 'putCounterOnSelf', counterLabel: 'Stun', counterAmount: 1 }],
  grantsSelfKeywordDuringOwnTurn: ['first strike', 'deathtouch'],
  },
  {
  id: 'torgal-a-fine-hound',
  name: 'Torgal, A Fine Hound',
  costLabel: '{1}{G}',
  type: 'creature',
  subtype: 'Legendary Creature Wolf',
  power: 2,
  toughness: 2,
  text: 'Whenever you cast your first Human creature spell each turn, that creature enters with an additional +1/+1 counter on it for each Dog and/or Wolf you control. \n' +
  '{T}: Add one mana of any color.',
  imagePath: '/assets/cards/torgal-a-fine-hound.webp',
  // The "first Human creature spell each turn enters with additional
  // counters" trigger is deferred - needs a once-per-turn-per-spell-type
  // tracker plus modifying the ETB of a DIFFERENT permanent than the one
  // carrying the trigger, neither of which exists.
  producesMana: 'any',
  },
  {
  id: 'torrential-gearhulk',
  name: 'Torrential Gearhulk',
  costLabel: '{4}{U}{U}',
  type: 'creature',
  subtype: 'Artifact Creature — Construct',
  power: 5,
  toughness: 6,
  text: 'Flash\n' +
    'When this creature enters, you may cast target instant card from your graveyard without paying its mana cost. If that spell would be put into your graveyard, exile it instead.\n',
  imagePath: '/assets/cards/torrential-gearhulk.webp',
  onEnter: [{ type: 'castTargetInstantOrSorceryFromGraveyardAnyMana', instantOnly: true, ownGraveyardOnly: true, free: true }],
  },
  {
  id: 'town-greeter',
  name: 'Town Greeter',
  costLabel: '{1}{G}',
  type: 'creature',
  subtype: 'Creature Human Citizen',
  power: 1,
  toughness: 1,
  text: 'When this creature enters, mill four cards. You may put a land card from among them into your hand. If you put a Town card into your hand this way, you gain 2 life',
  imagePath: '/assets/cards/town-greeter.webp',
  onEnter: [{ type: 'millThenPutLandIntoHandGainLifeIfTown', millCount: 4, lifeGainIfTown: 2 }],
  },
  {
    id:'toxic-deluge',
    name:'Merciless Poisoning',
    costLabel:'{2}{B}',
    type:'sorcery',
    text:'As an additional cost to cast this spell, pay X life.\n'+
    'All creatures get -X/-X until end of turn.\n'+
    '“We needn’t show mercy to those who side with the Returners.”',
    imagePath:'/assets/cards/toxic-deluge.webp',
    additionalCostPayXLife: true,
    onCast: [{ type: 'allCreaturesGetNegativeChosenXUntilEndOfTurn' }],
  },
  {
    id: 'tragic-arrogance',
    name: 'Tragic Arrogance',
    costLabel: '{3}{W}{W}',
    type: 'sorcery',
    text: 'For each player, you choose from among the permanents that player controls an artifact, a creature, an enchantment, and a planeswalker. Then each player sacrifices all other nonland permanents they control.',
    imagePath: '/assets/cards/tragic-arrogance.webp',
    onCast: [{ type: 'tragicArrogance' }],
  },
  {
  id: 'trailblazer-s-boots',
  name: 'Trailblazer’s Boots',
  costLabel: '{2}',
  type: 'artifact',
  subtype: 'Artifact Equipment',
  text: 'Equipped creature has nonbasic landwalk. (It can’t be blocked as long as defending player controls a nonbasic land.)\n' +
    'Equip {2}\n' +
    '“The gate to tomorrow is not the light of heaven, but the darkness of the depths of the earth.”\n' +
    '—Vincent Valentine',
  imagePath: '/assets/cards/trailblazer-s-boots.webp',
  attachesTo: 'creature',
  equipCost: '{2}',
  equipGrantsKeyword: 'nonbasic landwalk',
  },
  {
  id: 'transpose',
  name: 'Transpose',
  costLabel: '{2}{B}',
  type: 'instant',
  text: 'Draw a card, then discard a card. You lose 1 life. If this spell was cast from your hand, create a 0/1 black Wizard creature token with "Whenever you cast a noncreature spell, this token deals 1 damage to each opponent."\n' +
    'Rebound (If you cast this spell from your hand, exile it as it resolves. At the beginning of your next upkeep, you may cast this card from exile without paying its mana cost.)',
  imagePath: '/assets/cards/transpose.webp',
  onCast: [{ type: 'loot', drawCount: 1, discardCount: 1 }, { type: 'loseLife', amount: 1 }, { type: 'createToken', tokenId: 'token-wizard' }],
  rebound: { effects: [{ type: 'loot', drawCount: 1, discardCount: 1 }, { type: 'loseLife', amount: 1 }] },
  },
  {
  id: 'traveling-chocobo',
  name: 'Traveling Chocobo',
  costLabel: '{2}{G}',
  type: 'creature',
  subtype: 'Bird Creature',
  power: 3,
  toughness: 2,
  text: 'You may look at the top card of your library any time. \n' +
  'You may play lands and cast Bird spells from the top of your library. \n' +
  'If a land or Bird you control entering the battlefield causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time.',
  imagePath: '/assets/cards/traveling-chocobo.webp',
  // Deferred - "play lands and cast spells from the top of your library"
  // is a persistent play-from-a-zone-other-than-hand mechanic (an
  // established gap), and the trigger-doubling clause depends on it.
  },
  {
  id: 'travel-the-overworld',
  name: 'Travel the Overworld',
  costLabel: '{5}{U}{U}',
  type: 'sorcery',
  text: 'Affinity for Towns (This spell costs {1} less to cast for each Town you control.) \n' +
  'Draw four cards.',
  imagePath: '/assets/cards/travel-the-overworld.webp',
  costReductionPerControlledSubtype: { subtype: 'Town', amountPerUnit: 1 },
  onCast: [{ type: 'drawCards', amount: 4 }],
  },
  {
  id: 'treno-dark-city',
  name: 'Treno, Dark City',
  costLabel: '-',
  type: 'land',
  text:'This land enters tapped. \n' +
  '{T}: Add {U} or {B}.',
  imagePath: '/assets/cards/treno-dark-city.webp',
  entersTapped: true,
  producesMana: ['U', 'B']
  },
  {
  id: 'triple-triad',
  name: 'Triple Triad',
  costLabel: '{3}{R}{R}{R}',
  type: 'enchantment',
  text: 'At the beginning of your upkeep, each player exiles the top card of their library. Until end of turn, \n' +
  'you may play the card you own exiled this way and each other card exiled this way with lesser mana value than it without paying their mana costs.',
  imagePath: '/assets/cards/triple-triad.webp',
  // Deferred - simultaneous each-player exile-then-free-cast with a
  // mana-value comparison across the whole batch is well beyond the
  // established "play from exile" gap; no mechanism here handles even the
  // simpler single-player version of this.
  },
  {
    id: 'tromell-seymour-s-butler',
    name: 'Tromell, Seymour’s Butler',
    costLabel: '{2}{G}',
    type: 'creature',
    subtype: 'Legendary Creature Elf Advisor',
    power: 2,
    toughness: 3,
    text: 'Each other nontoken creature you control enters with an additional +1/+1 counter on it.\n' +
      '{1}, {T}: Proliferate X times, where X is the number of nontoken creatures you control that entered this turn. (To proliferate, choose any number of permanents and/or players, then give each another counter of each kind already there.)',
    imagePath: '/assets/cards/tromell-seymour-s-butler.webp',
    grantsOtherNontokenCreaturesExtraCounterOnEnter: { counterLabel: '+1/+1', counterAmount: 1 },
    abilities: [
      {
        id: 'tromell-proliferate',
        label: 'Proliferate',
        cost: { manaLabel: '{1}', tap: true },
        effects: [{ type: 'repeatProliferateByNontokenCreaturesEnteredThisTurn' }],
        effectText: 'Proliferate X times, where X is the number of nontoken creatures you control that entered this turn.',
      },
    ],
  },
  {
    id: 'ultima',
    name: 'Ultima',
    type: 'sorcery',
    costLabel: '{3}{W}{W}',
    text: 'Destroy all artifacts and creatures. End the turn. (Exile all spells and abilities from the stack, including this card. The player whose turn it is discards down to their maximum hand size. Damage wears off, and “this turn” and “until end of turn” effects end.) “Such devastation … this was not my intention!” —Gaius van Baelsar',
    imagePath: '/assets/cards/ultima.webp',
    onCast: [{ type: 'destroyAll', targetFilter: 'artifactAndCreature' }],
    // "End the turn" is deferred - there's no phase-skip/reset-turn effect
    // (discard to hand size, clear damage/until-end-of-turn effects, and
    // jump straight to the next player's turn all at once).
  },
  {
    id: 'ultimate-magic-holy',
    name: 'Ultimate Magic Holy',
    costLabel: '{2}{W}',
    type: 'instant',
    // "Prevent all damage that would be dealt to you this turn" is deferred -
    // this engine's loseLife is the one funnel for BOTH true damage and
    // pure life-loss, with no way to tell them apart at this call site, so a
    // "prevent damage only" effect can't be built here without either
    // over-preventing plain life-loss too or auditing every damage call site
    // individually. The indestructible grant (the other half) works fully.
    text: 'Permanents you control gain indestructible until end of turn. If this spell was cast from exile, prevent all damage that would be dealt to you this turn.\n' +
      'Foretell {2}{W} (During your turn, you may pay {2} and exile this card from your hand face down. Cast it on a later turn for its foretell cost.)',
    imagePath: '/assets/cards/ultimate-magic-holy.webp',
    onCast: [{ type: 'grantKeywordsToControlledPermanents', keywords: ['indestructible'] }],
    foretell: { cost: '{2}{W}' },
  },
  {
    id: 'ultimate-magic-meteor',
    name: 'Ultimate Magic Meteor',
    costLabel: '{5}{R}',
    type: 'sorcery',
    text: 'Ultimate Magic: Meteor deals 7 damage to each creature. If this spell was cast from exile, for each opponent, choose an artifact or land that player controls. Destroy the chosen permanents.\n' +
      'Foretell {5}{R} (During your turn, you may pay {2} and exile this card from your hand face down. Cast it on a later turn for its foretell cost.)',
    imagePath: '/assets/cards/ultimate-magic-meteor.webp',
    onCast: [{ type: 'damageEachCreature', amount: 7 }],
    onCastFromExileEffects: [{ type: 'destroyTarget', targetFilter: 'opponentArtifactOrLand' }],
    foretell: { cost: '{5}{R}' },
  },
  {
  id: 'ultima-origin-of-oblivion',
  name: 'Ultima, Origin of Oblivion',
  costLabel: '{5}',
  type: 'creature',
  subtype:'Legendary Creature God',
  power: 4,
  toughness: 4,
  text: 'Flying \n' +
  'Whenever Ultima attacks, put a blight counter on target land. For as long as that land has a blight counter on it, ' +
  'it loses all land types and abilities and has “{T}: Add {C}.”\n' +
  'Whenever you tap a land for {C}, add an additional {C}.',
  imagePath: '/assets/cards/ultima-origin-of-oblivion.webp',
  onAttack: [{ type: 'putCounterOnTargetLand', counterLabel: 'blight', counterAmount: 1 }],
  doublesColorlessManaFromLands: true,
  // The blight counter's actual effect (losing all land types/abilities,
  // gaining "{T}: Add {C}") is registered once, globally, in engine/combat.ts:
  // COUNTER_CHARACTERISTIC_OVERRIDES - it applies to whichever permanent
  // actually carries the counter (almost always an OPPONENT's land, not
  // anything Ultima itself controls), not to Ultima's own CardDefinition.
  },
  {
  id: 'ultima-weapon',
  name: 'Ultima Weapon',
  costLabel: '{7}',
  type: 'artifact',
  subtype: 'Legendary Artifact Equipment',
  text: 'Whenever equipped creature attacks, destroy target creature an opponent controls. \n' +
  'Equipped creature gets +7/+7.\n' +
  'Equip {7}',
  // The "whenever equipped creature attacks, destroy target creature an
  // opponent controls" granted trigger is deferred.
  attachesTo: 'creature',
  equipCost: '{7}',
  equipBuff: { power: 7, toughness: 7 },
  imagePath: '/assets/cards/ultima-weapon.webp'
  },
  {
  id: 'ultimecia-temporal-threat',
  name: 'Ultimecia, Temporal Threat',
  costLabel: '{4}{U}{U}',
  type: 'creature',
  subtype: 'Legendary Creature Human Warlock',
  power: 4,
  toughness: 4,
  text: 'When Ultimecia enters, tap all creatures your opponents control. \n' +
  'Whenever a creature you control deals combat damage to a player, draw a card.',
  imagePath: '/assets/cards/ultimecia-temporal-threat.webp',
  onEnter: [{ type: 'tapAllOpponentCreatures' }],
  onAnyControlledCreatureCombatDamageToPlayer: [{ type: 'drawCards', amount: 1 }],
  },
  {
  id: 'ultimecia-time-sorceress',
  name: 'Ultimecia, Time Sorceress',
  costLabel: '{3}{U}{B}',
  type: 'creature',
  subtype: 'Legendary Creature Human Warlock',
  power: 4,
  toughness: 5,
  text: 'Whenever Ultimecia enters or attacks, surveil 2. (Look at the top two cards of your library, ' +
  'then put any number of them into your graveyard and the rest on top of your library in any order.) \n' +
  'At the beginning of your end step, you may pay {4}{U}{U}{B}{B} and exile eight cards from your graveyard. If you do, transform Ultimecia.',
  imagePath: '/assets/cards/ultimecia-time-sorceress.webp',
  transformsInto: 'ultimecia-omnipotent',
  onEnter: [{ type: 'surveil', count: 2 }],
  onAttack: [{ type: 'surveil', count: 2 }],
  abilities: [
    {
      id: 'transform',
      label: 'Transform',
      cost: { manaLabel: '{4}{U}{U}{B}{B}', exileFromGraveyard: 8 },
      onlyDuringOwnEndStep: true,
      transformSelf: true,
      effectText: 'Exile eight cards from your graveyard. If you do, transform Ultimecia.',
    },
  ],
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
  imagePath: '/assets/cards/ultimecia-omnipotent.webp',
  grantsExtraTurnOnTransform: true,
  },
  {
  id: 'ultros-obnoxious-octopus',
  name: 'Ultros, Obnoxious Octopus',
  costLabel: '{1}{U}',
  type: 'creature',
  subtype: 'Legendary Creature Octopus',
  power: 2,
  toughness: 1,
  text: 'Whenever you cast a noncreature spell, if at least four mana was spent to cast it, tap target creature an opponent controls ' +
  'and put a stun counter on it. (If a permanent with a stun counter would become untapped, remove one from it instead.)\n' +
  'Whenever you cast a noncreature spell, if at least eight mana was spent to cast it, put eight +1/+1 counters on Ultros.',
  imagePath: '/assets/cards/ultros-obnoxious-octopus.webp',
  noncreatureCastTrigger: {
    tapAndStunOpponentCreatureIfExpensive: { minManaValue: 4 },
    counterIfExpensive: { minManaValue: 8, counterLabel: '+1/+1', counterAmount: 8 },
  },
  },
  {
    id: 'umaro-raging-yeti',
    name: 'Umaro, Raging Yeti',
    costLabel: '{5}{R}',
    type: 'creature',
    subtype: 'Legendary Creature Yeti Berserker',
    power: 6,
    toughness: 6,
    text: 'Trample\n' +
      'At the beginning of combat on your turn, choose one at random —\n' +
      '• Other creatures you control get +3/+0 and gain trample until end of turn.\n' +
      '• Discard your hand, then draw four cards.\n' +
      '• Umaro deals 5 damage to any target.',
    imagePath: '/assets/cards/umaro-raging-yeti.webp',
    onOwnCombatBegin: [
      {
        type: 'chooseOneAtRandom',
        options: [
          [{ type: 'buffOtherCreaturesYouControl', power: 3, toughness: 0, grantKeyword: 'trample' }],
          [{ type: 'discardHandThenDraw', drawCount: 4 }],
          [{ type: 'damageAnyTarget', amount: 5 }],
        ],
      },
    ],
  },
  {
  id: 'undercity-dire-rat',
  name: 'Undercity Dire Rat',
  costLabel: '{1}{B}',
  type: 'creature',
  subtype: 'Creature Rat',
  power: 2,
  toughness: 2,
  text: 'Rat Tail — When this creature dies, create a Treasure token. (It’s an artifact with “{T}, Sacrifice this token: Add one mana of any color.”)',
  imagePath: '/assets/cards/undercity-dire-rat.webp',
  onDeath: [{ type: 'createToken', tokenId: 'token-treasure' }],
  },
  {
    id: 'underground-river',
    name: 'Underground River',
    type: 'land',
    costLabel: '-',
    text: '{T}: Add {C}.\n' +
      '{T}: Add {U} or {B}. This land deals 1 damage to you.\n' +
      'For years, it was not known how the pirates were able to raid areas so far from the coast, until a local shepherd sighted a band of painted ruffians entering the Sastasha Seagrot…',
    imagePath: '/assets/cards/underground-river.webp',
    producesMana: 'C',
    altProducesMana: { colors: ['U', 'B'], payLife: 1 },
  },
  {
  id: 'unexpected-request',
  name: 'Unexpected Request',
  costLabel: '{2}{R}',
  type: 'sorcery',
  text: 'Gain control of target creature until end of turn. Untap that creature. It gains haste until end of turn. ' +
  'You may attach an Equipment you control to that creature. If you do, unattach it at the beginning of the next end step.',
  imagePath: '/assets/cards/unexpected-request.webp',
  onCast: [{ type: 'gainControlOfTargetCreature', untap: true, grantKeywords: ['haste'] }],
  // The optional "you may attach an Equipment you control to that
  // creature, unattaching it at the next end step" clause is still
  // deferred - needs an optional second targeting step plus a delayed
  // "at the beginning of the next end step" unattach trigger, neither of
  // which exists yet; the core control-change/untap/haste is wired.
  },
  {
    id: 'unfinished-business',
    name: 'Unfinished Business',
    costLabel: '{3}{W}{W}',
    type: 'sorcery',
    text: 'Return target creature card from your graveyard to the battlefield, then return up to two target Aura and/or Equipment cards from your graveyard to the battlefield attached to that creature. (If the Auras can’t enchant that creature, they remain in your graveyard.)\n' +
      '“If you’re gonna pick a fight with the Turks, you’d better be prepared to leave in a body bag.”',
    imagePath: '/assets/cards/unfinished-business.webp',
    onCast: [{ type: 'reanimateTargetFromGraveyard', thenReturnUpToTwoAurasOrEquipmentAttached: true }],
  },
  {
    id: 'urianger-augurelt',
    name: 'Urianger Augurelt',
    costLabel: '{W}{U}',
    type: 'creature',
    subtype: 'Legendary Creature — Elf Advisor',
    power: 1,
    toughness: 3,
    text: 'Whenever you play a land from exile or cast a spell from exile, you gain 2 life.\n' +
      'Draw Arcanum — {T}: Look at the top card of your library. You may exile it face down.\n' +
      'Play Arcanum — {T}: Until end of turn, you may play cards exiled with Urianger Augurelt. Spells you cast this way cost {2} less to cast.',
    imagePath: '/assets/cards/urianger-augurelt.webp',
    onPlayOrCastFromExileGainLife: 2,
    abilities: [
      {
        id: 'urianger-augurelt-draw-arcanum',
        label: 'Draw Arcanum',
        cost: { tap: true },
        effects: [{ type: 'mayEffect', effects: [{ type: 'exileTopOfLibraryFaceDownTaggedWithSource' }] }],
        effectText: 'Look at the top card of your library. You may exile it face down.',
      },
      {
        id: 'urianger-augurelt-play-arcanum',
        label: 'Play Arcanum',
        cost: { tap: true },
        effects: [{ type: 'grantTemporaryPlayPermissionForFaceDownExiledBySource', costReduction: 2 }],
        effectText: 'Until end of turn, you may play cards exiled with Urianger Augurelt. Spells you cast this way cost {2} less to cast.',
      },
    ],
  },
  {
    id:'urza-lord-high-artificer',
    name:'Terra Branford',
    type:'creature',
    subtype:'Legendary Creature — Human Artificer',
    costLabel:'{2}{U}{U}',
    power: 1,
    toughness: 4,
    text:'When Terra Branford enters, create a 0/0 colorless Construct artifact creature token with “This token gets +1/+1 for each artifact you control.”\n'+
    'Tap an untapped artifact you control: Add {U}.\n'+
    '{5}: Shuffle your library, then exile the top card. Until end of turn, you may play that card without paying its mana cost.',
    onEnter: [{ type: 'createToken', tokenId: 'token-construct' }],
    abilities: [
      {
        id: 'urza-lord-high-artificer-mana',
        label: 'Tap an artifact: Add {U}',
        cost: { tapAnotherArtifact: true },
        effects: [{ type: 'addMana', colors: { U: 1 } }],
        effectText: 'Add {U}.',
      },
      {
        id: 'urza-lord-high-artificer-exile',
        label: 'Shuffle, exile the top card, play it free this turn',
        cost: { manaLabel: '{5}' },
        effects: [{ type: 'exileTopOfLibraryPlayableUntilCleanup', count: 1, shuffleFirst: true, free: true }],
        effectText: 'Shuffle your library, then exile the top card. Until end of turn, you may play that card without paying its mana cost.',
      },
    ],
    imagePath:'/assets/cards/urza-lord-high-artificer.webp'
  },
  {
  id: 'vaan-street-thief',
  name: 'Vaan, Street Thief',
  costLabel: '{2}{R}',
  type: 'creature',
  subtype: 'Legendary Creature Human Scout',
  power: 2,
  toughness: 2,
  text: 'Whenever one or more Scouts, Pirates, and/or Rogues you control deal combat damage to a player, ' +
  'exile the top card of that player\u2019s library. You may cast it. If you don\u2019t, create a Treasure token. \n' +
  'Whenever you cast a spell you don\u2019t own, put a +1/+1 counter on each Scout, Pirate, and Rogue you control.',
  imagePath: '/assets/cards/vaan-street-thief.webp',
  // Both deferred - the first ability needs a subtype-filtered combat-damage
  // watcher (only Scouts/Pirates/Rogues, unlike onAnyControlledCreatureCombatDamageToPlayer's
  // any-creature watcher) plus an impulse-cast-with-a-fallback mechanism; the
  // second needs to track "cast a spell you don't own", a condition this
  // engine (which barely supports casting foreign-owned cards at all) has no
  // way to detect.
  },
  {
    id: 'vandalblast',
    name: 'Vandalblast',
    costLabel: '{R}',
    type: 'sorcery',
    text: 'Destroy target artifact you don’t control.\n' +
      'Overload {4}{R} (You may cast this spell for its overload cost. If you do, change “target” in its text to “each.”)\n' +
      '“Danger’s part of the job. Don’t worry about me.”',
    imagePath: '/assets/cards/vandalblast.webp',
    onCast: [{ type: 'destroyTarget', targetFilter: 'opponentArtifact' }],
    overload: { cost: '{4}{R}', effects: [{ type: 'destroyAll', targetFilter: 'artifact', opponentControlledOnly: true }] },
  },
  {
  id: 'valkyrie-aerial-unit',
  name: 'Valkyrie Aerial Unit',
  costLabel: '{5}{U}{U}',
  type: 'creature',
  subtype: 'Artifact Creature Construct',
  power: 5,
  toughness: 4,
  text: 'Affinity for artifacts (This spell costs {1} less to cast for each artifact you control.) \n' +
  'Flying \n' +
  'When this creature enters, surveil 2.',
  imagePath: '/assets/cards/valkyrie-aerial-unit.webp',
  costReductionPerControlledType: { type: 'artifact', amountPerUnit: 1 },
  onEnter: [{ type: 'surveil', count: 2 }],
  },
  {
  id: 'vanille-cheerful-l-cie',
  name: 'Vanille, Cheerful l\u2019Cie',
  costLabel: '{3}{G}',
  type: 'creature',
  subtype: 'Legendary Creature Human Cleric',
  power: 3,
  toughness: 2,
  text: 'When Vanille enters, mill two cards, then return a permanent card from your graveyard to your hand. \n' +
  'At the beginning of your first main phase, if you both own and control Vanille and a creature named Fang, ' +
  'Fearless l\u2019Cie, you may pay {3}{B}{G}. If you do, exile them, then meld them into Ragnarok, Divine Deliverance.',
  imagePath: '/assets/cards/vanille-cheerful-l-cie.webp',
  onEnter: [{ type: 'millThenReturn', millCount: 2 }],
  abilities: [
    {
      id: 'meld',
      label: 'Meld into Ragnarok',
      cost: { manaLabel: '{3}{B}{G}' },
      onlyDuringOwnFirstMainPhase: true,
      meldsWith: { partnerDefId: 'fang-fearless-l-cie', resultDefId: 'ragnarok-divine-deliverance' },
      effectText: "If you own and control Fang, Fearless l’Cie, exile them both and meld into Ragnarok, Divine Deliverance.",
    },
  ],
  },
  {
    id: 'vanquish-the-horde',
    name: 'Vanquish the Horde',
    costLabel: '{6}{W}{W}',
    type: 'sorcery',
    text: 'This spell costs {1} less to cast for each creature on the battlefield.\n' +
      'Destroy all creatures.\n' +
      '“Sir! A mass of high-density energy is heading towards Midgar!”\n' +
      '—Shinra operator',
    imagePath: '/assets/cards/vanquish-the-horde.webp',
    costReductionPerCreatureOnBattlefield: 1,
    onCast: [{ type: 'destroyAll', targetFilter: 'creature' }],
  },
  {
  id: 'vayne-s-treachery',
  name: 'Vayne\u2019s Treachery',
  costLabel: '{1}{B}',
  type: 'instant',
  text: 'Kicker—Sacrifice an artifact or creature. (You may sacrifice an artifact or creature in addition to any other costs as you cast this spell.) \n' +
  'Target creature gets -2/-2 until end of turn. If this spell was kicked, that creature gets -6/-6 until end of turn instead.',
  imagePath: '/assets/cards/vayne-s-treachery.webp',
  kicker: { cost: 'sacrificeCreatureOrArtifact' },
  onCast: [
    {
      type: 'ifKicked',
      thenEffects: [{ type: 'pumpTarget', power: -6, toughness: -6 }],
      elseEffects: [{ type: 'pumpTarget', power: -2, toughness: -2 }],
    },
  ],
  },
  {
  id: 'vector-imperial-capital',
  name: 'Vector, Imperial Capital',
  costLabel: '-',
  type: 'land',
  text: 'This land enters tapped. \n' +
  '{T}: Add {B} or {R}.',
  imagePath: '/assets/cards/vector-imperial-capital.webp',
  entersTapped: true,
  producesMana: ['B', 'R']
  },
  {
  id: 'venat-heart-of-hydaelyn',
  name: 'Venat, Heart of Hydaelyn',
  costLabel: '{1}{W}{W}',
  type: 'creature',
  subtype: 'Legendary Creature Elder Wizard',
  power: 3,
  toughness: 3,
  text: 'Whenever you cast a legendary spell, draw a card. This ability triggers only once each turn. \n' +
  'Hero\u2019s Sundering — {7}, {T}: Exile target nonland permanent. Transform Venat. Activate only as a sorcery.',
  imagePath: '/assets/cards/venat-heart-of-hydaelyn.webp',
  transformsInto: 'hydaelyn-the-mothercrystal',
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
  imagePath: '/assets/cards/hydaelyn-the-mothercrystal.webp',
  onOwnCombatBegin: [{ type: 'putCounterOnAnotherCreatureGrantsIndestructibleUntilNextTurn', counterLabel: '+1/+1', counterAmount: 1, drawIfLegendary: true }],
  },
  {
    id:'venser-shaper-savant',
    name:'Master Xande',
    costLabel:'{2}{U}{U}',
    type:'creature',
    subtype:'Legendary Creature — Human Wizard',
    power: 2,
    toughness: 2,
    text:'Flash\n'+
    'When Master Xande enters, return target spell or permanent to its owner’s hand.',
    // The "or spell" half is deferred - this engine has no stack/priority
    // system (see Counterspell/Syncopate's own card comments), so there's
    // no "spell sitting on the stack" to bounce. The "target permanent"
    // half is fully reachable and implemented below.
    onEnter: [{ type: 'bounceTarget', targetFilter: 'anyPermanent' }],
    imagePath:'/assets/cards/venser-shaper-savant.webp'
  },
  {
  id: 'vincent-s-limit-break',
  name: 'Vincent\u2019s Limit Break',
  costLabel: '{1}{B}',
  type: 'instant',
  text: 'Tiered (Choose one additional cost.) \n ' +
  'Until end of turn, target creature you control gains “When this creature dies, ' +
  'return it to the battlefield tapped under its owner’s control” and has the chosen base power and toughness.\n' +
  '• Galian Beast — {0} — 3/2. \n' +
  '• Death Gigas — {1} — 5/2. \n' +
  '• Hellmasker — {3} — 7/2.',
  imagePath: '/assets/cards/vincent-s-limit-break.webp',
  tieredModes: [
    { label: 'Galian Beast — {0} — 3/2', additionalCost: '{0}', effects: [{ type: 'grantTemporaryBaseStatsAndDeathReturn', power: 3, toughness: 2 }] },
    { label: 'Death Gigas — {1} — 5/2', additionalCost: '{1}', effects: [{ type: 'grantTemporaryBaseStatsAndDeathReturn', power: 5, toughness: 2 }] },
    { label: 'Hellmasker — {3} — 7/2', additionalCost: '{3}', effects: [{ type: 'grantTemporaryBaseStatsAndDeathReturn', power: 7, toughness: 2 }] }
  ]
  },
  {
  id: 'vincent-valentine',
  name: 'Vincent Valentine',
  costLabel: '{2}{B}{B}',
  type: 'creature',
  subtype: 'Legendary Creature Assassin',
  power: 2,
  toughness: 2,
  text: 'Whenever a creature an opponent controls dies, put a number of +1/+1 counters on Vincent Valentine equal to that creature\u2019s power.\n' +
  'Whenever Vincent Valentine attacks, you may transform it.',
  imagePath: '/assets/cards/vincent-valentine.webp',
  transformsInto: 'galian-beast',
  onAnyOpponentCreatureDeathPutCounterEqualToPower: { counterLabel: '+1/+1' },
  onAttackMayTransform: true,
  },
  {
    id:'vincent-vengeful-atoner',
    name:'Vincent, Vengeful Atoner',
    costLabel:'{2}{R}',
    type:'creature',
    subtype:'Legendary Creature — Assassin',
    power: 3,
    toughness: 3,
    text:'Menace\n'+
    'Whenever one or more creatures you control deal combat damage to a player, put a +1/+1 counter on Vincent.\n'+
    'Chaos — Whenever Vincent deals combat damage to an opponent, it deals that much damage to each other opponent if Vincent’s power is 7 or greater.',
    imagePath:'/assets/cards/vincent-vengeful-atoner.webp',
    onAnyControlledCreatureOneOrMoreCombatDamageToPlayer: [{ type: 'putCounterOnSelf', counterLabel: '+1/+1', counterAmount: 1 }],
    // "...it deals that much damage to each OTHER opponent..." - always a
    // guaranteed no-op in this 2-player engine (there is never an "other"
    // opponent beyond the one already dealt damage), same established
    // "number of other opponents" simplification used elsewhere.
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
  onDeathReturnToBattlefieldTapped: true,
  imagePath: '/assets/cards/galian-beast.webp'
  },
  {
    id: 'vindicate',
    name: 'Vindicate',
    costLabel: '{1}{W}{B}',
    type: 'sorcery',
    text: 'Destroy target permanent.\n' +
      '“Remember… remember us… remember… that we once lived…”',
    imagePath: '/assets/cards/vindicate.webp',
    onCast: [{ type: 'destroyTarget', targetFilter: 'anyPermanent' }],
  },
  {
    id: 'vineglimmer-snarl',
    name: 'Vineglimmer Snarl',
    costLabel: '-',
    type: 'land',
    text: 'As this land enters, you may reveal a Forest or Island card from your hand. If you don’t, this land enters tapped.\n' +
      '{T}: Add {G} or {U}.',
    imagePath: '/assets/cards/vineglimmer-snarl.webp',
    entersTappedUnlessRevealLandNames: ['Forest', 'Island'],
    producesMana: ['G', 'U'],
  },
  {
  id: 'vivi-ornitier',
  name: 'Vivi Ornitier',
  costLabel: '{1}{U}{R}',
  type: 'creature',
  subtype: 'Legendary Creature Wizard',
  power: 0,
  toughness: 3,
  text: '{0}: Add X mana in any combination of {U} and/or {R}, where X is Vivi Ornitier\u2019s power. Activate only during your turn and only once each turn. \n' +
  'Whenever you cast a noncreature spell, put a +1/+1 counter on Vivi Ornitier and it deals 1 damage to each opponent',
  imagePath: '/assets/cards/vivi-ornitier.webp'
  },
  {
    id:'vivi-s-persistence',
    name:'Vivi\u2019s Persistence',
    costLabel:'{1}{R}',
    type:'instant',
    text:'Create a 0/1 black Wizard creature token with “Whenever you cast a noncreature spell, this token deals 1 damage to each opponent.”\n'+
    'Whenever your commander enters or attacks, you may pay {2}. If you do, return this card from your graveyard to your hand.',
    imagePath:'/assets/cards/vivi-s-persistence.webp'
  },
  {
    id: 'void-rend',
    name: 'Void Rend',
    costLabel: '{W}{U}{B}',
    type: 'instant',
    text: 'This spell can\u2019t be countered.\n' +
      'Destroy target nonland permanent.\n' +
      '“I expect some voidsent are more intelligent than others. Perhaps these ones simply do not understand our words.”\n' +
      '—Y\u2019shtola Rhul',
    imagePath: '/assets/cards/void-rend.webp',
    // "Can't be countered" is unreachable - this engine has no counterspell
    // mechanic at all (spells resolve immediately on cast, no stack).
    onCast: [{ type: 'destroyTarget', targetFilter: 'nonlandPermanent' }],
  },
  {
    id: 'wakka-devoted-guardian',
    name: 'Wakka, Devoted Guardian',
    costLabel: '{2}{G}{W}',
    type: 'creature',
    subtype: 'Legendary Creature Human Warrior',
    power: 4,
    toughness: 4,
    text: 'Reach, trample\n' +
      'Whenever Wakka deals combat damage to a player, destroy up to one target artifact that player controls and put a +1/+1 counter on Wakka.\n' +
      'Blitzball Captain — At the beginning of your end step, if a counter was put on Wakka this turn, put a +1/+1 counter on each other creature you control.',
    imagePath: '/assets/cards/wakka-devoted-guardian.webp',
    onCombatDamageToPlayer: [{ type: 'destroyUpToOneOpponentArtifactThenPutCounterOnSelf', counterLabel: '+1/+1', counterAmount: 1 }],
    onOwnEndStep: [{ type: 'ifCounterPutOnSelfThisTurn', thenEffects: [{ type: 'buffOtherCreaturesYouControl', counterLabel: '+1/+1', counterAmount: 1 }], elseEffects: [] }],
  },
  {
    id: 'walking-ballista',
    name: 'Walking Ballista',
    costLabel: '{X}{X}',
    type: 'creature',
    subtype: 'Artifact Creature Construct',
    power: 0,
    toughness: 0,
    text: 'This creature enters with X +1/+1 counters on it.\n' +
      '{4}: Put a +1/+1 counter on this creature.\n' +
      'Remove a +1/+1 counter from this creature: It deals 1 damage to any target.',
    imagePath: '/assets/cards/walking-ballista.webp',
    onEnter: [{ type: 'putCounterOnSelf', counterLabel: '+1/+1', counterAmount: 'chosenX' }],
    abilities: [
      {
        id: 'walking-ballista-grow',
        label: 'Grow',
        cost: { manaLabel: '{4}' },
        effects: [{ type: 'putCounterOnSelf', counterLabel: '+1/+1', counterAmount: 1 }],
        effectText: 'Put a +1/+1 counter on this creature.',
      },
      {
        id: 'walking-ballista-shoot',
        label: 'Shoot',
        cost: { removeCounterFromSelf: { label: '+1/+1' } },
        effects: [{ type: 'damageAnyTarget', amount: 1 }],
        effectText: 'It deals 1 damage to any target.',
      },
    ],
  },
  {
    id:'warrior-s-resolve',
    name:'Warrior\u2019s Resolve',
    costLabel:'{2}{W}',
    type:'enchantment',
    text:'Creatures you control have training. (Whenever a creature you control attacks with another creature with greater power, put a +1/+1 counter on the creature with lesser power.)\n'+
    'At the beginning of your end step, if you control a creature with a +1/+1 counter on it that attacked this turn, draw a card.',
    imagePath:'/assets/cards/warrior-s-resolve.webp',
    grantsControlledCreaturesTraining: true,
    onOwnEndStepDrawIfAttackedCreatureHasCounter: true,
  },
  {
  id: 'warrior-s-sword',
  name: 'Warrior\u2019s Sword',
  costLabel: '{3}{R}',
  type: 'artifact',
  subtype: 'Equipment',
  text: 'Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.) \n' +
  'Equipped creature gets +3/+2 and is a Warrior in addition to its other types. \n' +
  'Equip {5} ({5}: Attach to target creature you control. Equip only as a sorcery.)',
  onEnter: [{ type: 'createToken', tokenId: 'token-hero', attachSelfToToken: true }],
  attachesTo: 'creature',
  equipCost: '{5}',
  equipBuff: { power: 3, toughness: 2 },
  equipGrantsSubtype: 'Warrior',
  imagePath: '/assets/cards/warrior-s-sword.webp'
  },
  {
  id: 'wastes',
  name: 'Wastes',
  costLabel: '-',
  type: 'land',
  text: 'Tap Add M',
  imagePath: '/assets/cards/wastes.webp',
  producesMana: 'C'
  },
  {
    id:'wayfarer-s-bauble',
    name:'Wayfarer’s Bauble',
    costLabel:'{1}',
    type:'artifact',
    text:'{2}, {T}, Sacrifice this artifact: Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.\n'+
    '“Treasure, treasure!”',
    abilities: [
      {
        id: 'wayfarer-s-bauble-search',
        label: 'Search for a basic land',
        cost: { manaLabel: '{2}', tap: true, sacrificeSelf: true },
        effects: [{ type: 'searchLibraryForBasicLand', toBattlefieldTapped: true }],
        effectText: 'Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.',
      },
    ],
    imagePath:'/assets/cards/wayfarer-s-bauble.webp'
  },
  {
  id: 'weapons-vendor',
  name: 'Weapons Vendor',
  costLabel: '{3}{W}',
  type: 'creature',
  subtype: 'Creature Human Artificer',
  power: 2,
  toughness: 2,
  text: 'When this creature enters, draw a card. \n' +
  'At the beginning of combat on your turn, if you control an Equipment, you may pay {1}. ' +
  'When you do, attach target Equipment you control to target creature you control.',
  imagePath: '/assets/cards/weapons-vendor.webp',
  onEnter: [{ type: 'drawCards', amount: 1 }],
  // The combat-begin optional-pay-to-attach trigger is deferred - the
  // established optional-cost-for-benefit gap.
  },
  {
  id: 'white-auracite',
  name: 'White Auracite',
  costLabel: '{2}{W}{W}',
  type: 'artifact',
  text: 'When this artifact enters, exile target nonland permanent an opponent controls until this artifact leaves the battlefield. \n' +
  '{T}: Add {W}.',
  imagePath: '/assets/cards/white-auracite.webp',
  producesMana: 'W',
  // The ETB exile is deferred - "until this artifact leaves the
  // battlefield" needs a linked exile that returns the card when a specific
  // OTHER permanent leaves play, a hook no exile effect here has.
  },
  {
  id: 'white-mage-s-staff',
  name: 'White Mage\u2019s Staff',
  costLabel: '{1}{W}',
  type: 'artifact',
  subtype: 'Equipment',
  text: 'Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.) \n ' +
  'Equipped creature gets +1/+1, has “Whenever this creature attacks, you gain 1 life,” and is a Cleric in addition to its other types.\n' +
  'Equip {3} ({3}: Attach to target creature you control. Equip only as a sorcery.)',
  onEnter: [{ type: 'createToken', tokenId: 'token-hero', attachSelfToToken: true }],
  attachesTo: 'creature',
  equipCost: '{3}',
  equipBuff: { power: 1, toughness: 1 },
  equipGrantsSubtype: 'Cleric',
  equipGrantsOnAttack: [{ type: 'gainLife', amount: 1 }],
  imagePath: '/assets/cards/white-mage-s-staff.webp'
  },
  {
  id: 'windurst-federation-center',
  name: 'Windurst, Federation Center',
  costLabel: '-',
  type: 'land',
  subtype: 'Town',
  text: 'This land enters tapped. \n{T}: Add {G} or {W}.',
  imagePath: '/assets/cards/windurst-federation-center.webp',
  entersTapped: true,
  producesMana: ['G', 'W']
  },
  {
    id: 'wooded-ridgeline',
    name: 'Wooded Ridgeline',
    costLabel: '-',
    type: 'land',
    text: '({T}: Add {R} or {G}.)\n' +
      'This land enters tapped.\n' +
      '“Monsters instinctively target weaker prey,” said Cloud. “Hmm… you’d better watch out then,” Aerith teased.',
    imagePath: '/assets/cards/wooded-ridgeline.webp',
    producesMana: ['R', 'G'],
    entersTapped: true,
  },
  {
  id: 'world-map',
  name: 'World Map',
  costLabel: '{1}',
  type: 'artifact',
  text: '{1}, {T}, Sacrifice this artifact: Search your library for a basic land card, reveal it, put it into your hand, then shuffle. \n' +
  '{3}, {T}, Sacrifice this artifact: Search your library for a land card, reveal it, put it into your hand, then shuffle.',
  abilities: [
    {
      id: 'world-map-basic',
      label: 'Search for a basic land',
      cost: { manaLabel: '{1}', tap: true, sacrificeSelf: true },
      effects: [{ type: 'searchLibraryForBasicLand' }],
      effectText: 'Search your library for a basic land card, reveal it, put it into your hand, then shuffle.',
    },
    {
      id: 'world-map-any',
      label: 'Search for any land',
      cost: { manaLabel: '{3}', tap: true, sacrificeSelf: true },
      effects: [{ type: 'searchLibraryForAnyLand' }],
      effectText: 'Search your library for a land card, reveal it, put it into your hand, then shuffle.',
    },
  ],
  imagePath: '/assets/cards/world-map.webp'
  },
  {
    id:'wrecking-ball-arm',
    name:'Wrecking Ball Arm',
    costLabel:'{2}',
    type:'artifact',
    subtype:'Legendary Artifact — Equipment',
    text:'Equipped creature has base power and toughness 7/7 and can’t be blocked by creatures with power 2 or less.\n'+
    'Equip legendary creature {3}\n'+
    'Equip {7}\n'+
    '“I don’t care what it is! I’m gonna bust him up!”\n',
    attachesTo: 'creature',
    equipCost: '{7}',
    equipCostIfTargetLegendary: '{3}',
    attachedSetsBasePowerToughness: { power: 7, toughness: 7 },
    equipGrantsCantBeBlockedByCreaturesWithPowerAtMost: 2,
    imagePath:'/assets/cards/wrecking-ball-arm.webp'
  },
  {
  id: 'xande-dark-mage',
  name: 'Xande, Dark Mage',
  costLabel: '{2}{U}{B}',
  type: 'creature',
  subtype: 'Legendary Creature Human Wizard',
  power: 3,
  toughness: 3,
  text: 'Menace (This creature can\u2019t be blocked except by two or more creatures.) \n' +
  'Xande gets +1/+1 for each noncreature, nonland card in your graveyard.',
  imagePath: '/assets/cards/xande-dark-mage.webp',
  powerBonusPerGraveyardNoncreatureNonland: 1,
  },
  {
  id: 'you-re-not-alone',
  name: 'You\u2019re Not Alone',
  costLabel: '{W}',
  type: 'instant',
  text: 'Target creature gets +2/+2 until end of turn. If you control three or more creatures, it gets +4/+4 until end of turn instead.',
  imagePath: '/assets/cards/you-re-not-alone.webp',
  onCast: [
    {
      type: 'ifControlAtLeastCreatures',
      count: 3,
      thenEffects: [{ type: 'pumpTarget', power: 4, toughness: 4 }],
      elseEffects: [{ type: 'pumpTarget', power: 2, toughness: 2 }],
    },
  ],
  },
  {
  id: 'y-shtola-night-s-blessed',
  name: 'Y’shtola, Night’s Blessed',
  costLabel: '{1}{W}{U}{B}',
  type: 'creature',
  subtype: 'Legendary Creature — Cat Warlock',
  power: 2,
  toughness: 4,
  text: 'Vigilance\n' +
    'At the beginning of each end step, if a player lost 4 or more life this turn, you draw a card.\n' +
    'Whenever you cast a noncreature spell with mana value 3 or greater, Y’shtola deals 2 damage to each opponent and you gain 2 life.',
  imagePath: '/assets/cards/y-shtola-night-s-blessed.webp',
  onAnyEndStepIfAnyPlayerLostLifeThisTurn: { minLifeLost: 4, effects: [{ type: 'drawCards', amount: 1 }] },
  noncreatureCastTrigger: { damageEachOpponentAndGainLifeIfManaValueAtLeast: { minManaValue: 3, amount: 2 } },
  },
  {
  id: 'y-shtola-rhul',
  name: 'Y\u2019shtola Rhul',
  costLabel: '{4}{U}{U}',
  type: 'creature',
  subtype: 'Legendary Creature Cat Druid',
  power: 3,
  toughness: 5,
  text: 'At the beginning of your end step, exile target creature you control, then return it to the battlefield under ' +
  'its owner\u2019s control. Then if it\u2019s the first end step of the turn, there is an additional end step after this step.',
  imagePath: '/assets/cards/y-shtola-rhul.webp',
  onOwnEndStep: [{ type: 'exileThenReturnTargetOwnCreature' }, { type: 'queueExtraEndStepIfFirstEndStepOfTurn' }],
  },
  {
    id:'yawgmoth-thran-physician',
    name:'The Emperor, Hell Tyrant',
    costLabel:'{2}{B}{B}',
    type:'creature',
    subtype:'Legendary Creature — Human Cleric',
    power: 2,
    toughness: 4,
    text:'Protection from Humans\n'+
    'Pay 1 life, Sacrifice another creature: Put a -1/-1 counter on up to one target creature and draw a card.\n'+
    '{B}{B}, Discard a card: Proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.)',
    imagePath:'/assets/cards/yawgmoth-thran-physician.webp',
    // "Protection from Humans" is deferred - no protection mechanic exists
    // in this engine at all (same unaddressed gap as Absolute Virtue's own
    // printed protection).
    abilities: [
      {
        id: 'the-emperor-hell-tyrant-sac',
        label: 'Sacrifice',
        cost: { payLife: 1, sacrificeAnother: 'creature' },
        effects: [{ type: 'putCounterOnTarget', counterLabel: '-1/-1', counterAmount: 1, optional: true }, { type: 'drawCards', amount: 1 }],
        effectText: 'Put a -1/-1 counter on up to one target creature and draw a card.',
      },
      {
        id: 'the-emperor-hell-tyrant-proliferate',
        label: 'Proliferate',
        cost: { manaLabel: '{B}{B}', discardCards: 1 },
        effects: [{ type: 'proliferate' }],
        effectText: 'Proliferate.',
      },
    ],
  },
  {
    id: 'yuffie-materia-hunter',
    name: 'Yuffie, Materia Hunter',
    costLabel: '{2}{R}',
    type: 'creature',
    subtype: 'Legendary Creature Human Ninja',
    power: 3,
    toughness: 3,
    text: 'Ninjutsu {1}{R} ({1}{R}, Return an unblocked attacker you control to hand: Put this card onto the battlefield from your hand tapped and attacking.)\n' +
      'When Yuffie enters, gain control of target noncreature artifact for as long as you control Yuffie. Then you may attach an Equipment you control to Yuffie.',
    imagePath: '/assets/cards/yuffie-materia-hunter.webp',
    ninjutsu: { cost: '{1}{R}' },
    onEnter: [{ type: 'gainControlOfTargetNoncreatureArtifactPermanent' }],
  },
  {
    id: 'yuna-s-decision',
    name: 'Yuna’s Decision',
    costLabel: '{3}{G}',
    type: 'sorcery',
    text: 'Choose one —\n' +
      '• Continue the Pilgrimage — Sacrifice a creature. If you do, draw a card, then you may put a creature card and/or a land card from your hand onto the battlefield. \n' +
      '• Find Another Way — Return one or two target permanent cards from your graveyard to your hand.',
    imagePath: '/assets/cards/yuna-s-decision.webp',
    chooseModes: [
      {
        label: 'Continue the Pilgrimage — Sacrifice a creature. If you do, draw a card, then you may put a creature card and/or a land card from your hand onto the battlefield.',
        effects: [{ type: 'sacrificeOwnCreatureThenDraw', thenPutCreatureAndOrLandFromHand: true }],
      },
      { label: 'Find Another Way — Return one or two target permanent cards from your graveyard to your hand.', effects: [{ type: 'returnUpToTwoTargetPermanentsFromGraveyardToHand' }] },
    ],
  },
  {
    id: 'yuna-grand-summoner',
    name: 'Yuna, Grand Summoner',
    costLabel: '{1}{G}{W}{U}',
    type: 'creature',
    subtype: 'Legendary Creature Human Cleric',
    power: 1,
    toughness: 5,
    text: 'Grand Summon — {T}: Add one mana of any color. When you next cast a creature spell this turn, ' +
      'that creature enters with two additional +1/+1 counters on it.\n' +
      'Whenever another permanent you control is put into a graveyard from the battlefield, ' +
      'if it had one or more counters on it, you may put that number of +1/+1 counters on target creature.',
    imagePath: '/assets/cards/yuna-grand-summoner.webp',
    producesMana: 'any',
    onTapForManaEffects: [{ type: 'setPendingNextCreatureSpellBonus', counterLabel: '+1/+1', counterAmount: 2 }],
    onOtherPermanentDeathTransferCounters: true,
  },
  {
  id: 'yuna-hope-of-spira',
  name: 'Yuna, Hope of Spira',
  costLabel: '{3}{G}{W}',
  type: 'creature',
  subtype: 'Legendary Creature Human Cleric',
  power: 3,
  toughness: 5,
  text: 'During your turn, Yuna and enchantment creatures you control have trample, lifelink, and ward {2}.\n' +
  'At the beginning of your end step, return up to one target enchantment card from your graveyard to the battlefield with a finality counter on it.',
  imagePath: '/assets/cards/yuna-hope-of-spira.webp',
  grantsControlledGroupKeywordsDuringOwnTurn: { subtypeMatch: 'enchantment', includeSelf: true, keywords: ['trample', 'lifelink'], ward: { mana: '{2}' } },
  // The end-step "return target enchantment card from your graveyard to
  // the battlefield with a finality counter" is deferred - the existing
  // reanimateTargetFromGraveyard effect defaults to a creature-card filter
  // (or, via nonlegendaryPermanentInsteadOfCreature, any nonlegendary
  // permanent), neither of which matches "an enchantment card" specifically,
  // and finality counters aren't mechanically implemented anywhere in this
  // engine yet either (currently just flavor text on several cards).
  },
  {
    id: 'yuna-s-whistle',
    name: 'Yuna’s Whistle',
    costLabel: '{1}{G}{G}',
    type: 'instant',
    text: 'Reveal cards from the top of your library until you reveal a creature card. Put that card into your hand ' +
      'and the rest on the bottom of your library in a random order. When you reveal a creature card this way, ' +
      'put X +1/+1 counters on target creature you control, where X is the mana value of that card.',
    imagePath: '/assets/cards/yuna-s-whistle.webp',
    onCast: [{ type: 'revealUntilCreatureThenPutCountersEqualToManaValue' }],
  },
  {
  id: 'zack-fair',
  name: 'Zack Fair',
  costLabel: '{W}',
  type: 'creature',
  subtype: 'Legendary Creature Human Soldier',
  power: 0,
  toughness: 1,
  text: 'Zack Fair enters with a +1/+1 counter on it. \n' +
  '{1}, Sacrifice Zack Fair: Target creature you control gains indestructible until end of turn. Put Zack Fair\u2019s ' +
  'counters on that creature and attach an Equipment that was attached to Zack Fair to that creature.',
  imagePath: '/assets/cards/zack-fair.webp',
  // Was missing both the ETB counter and the sacrifice ability entirely.
  onEnter: [{ type: 'putCounterOnSelf', counterLabel: '+1/+1', counterAmount: 1 }],
  // Zack Fair never keeps indestructible himself - he's sacrificed as part
  // of the ability's own cost before the target could ever benefit from it
  // being on him. Without this, his own text would falsely self-apply
  // indestructible via the plain substring keyword check.
  excludeSelfKeywords: ['indestructible'],
  abilities: [
    {
      id: 'zack-fair-sacrifice',
      label: 'Sacrifice',
      cost: { manaLabel: '{1}', sacrificeSelf: true },
      effects: [{ type: 'pumpTarget', power: 0, toughness: 0, grantKeyword: 'indestructible' }],
      effectText: 'Target creature you control gains indestructible until end of turn.',
      // "Put Zack Fair's counters on that creature and attach an Equipment
      // that was attached to Zack Fair to that creature" is deferred - no
      // effect moves counters/attachments from a just-sacrificed source to
      // a separately-chosen target.
    },
  ],
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
  imagePath: '/assets/cards/zanarkand-ancient-metropolis.webp',
  entersTapped: true,
  producesMana: 'G'
  },
  {
  id: 'zell-dincht',
  name: 'Zell Dincht',
  costLabel: '{2}{R}',
  type: 'creature',
  subtype: 'Legendary Creature Human Monk',
  power: 0,
  toughness: 3,
  text: 'You may play an additional land on each of your turns. \n' +
  'Zell Dincht gets +1/+0 for each land you control. \n' +
  'At the beginning of your end step, return a land you control to its owner\u2019s hand.',
  imagePath: '/assets/cards/zell-dincht.webp',
  extraLandsPerTurn: 1,
  powerBonusPerControlledLand: 1,
  onOwnEndStep: [{ type: 'returnControlledLandToHand' }],
  },
  {
  id: 'zenos-yae-galvus',
  name: 'Zenos yae Galvus',
  costLabel: '{3}{B}{B}',
  type: 'creature',
  subtype: 'Legendary Creature Human Noble Soldier Warrior',
  power: 4,
  toughness: 4,
  text: 'My First Friend — When Zenos yae Galvus enters, choose a creature an opponent controls. Until end of turn, '+
  'creatures other than Zenos yae Galvus and the chosen creature get -2/-2. \n' +
  'When the chosen creature leaves the battlefield, transform Zenos yae Galvus.',
  imagePath: '/assets/cards/zenos-yae-galvus.webp',
  transformsInto:'shinryu-transcendent-rival',
  onEnter: [{ type: 'chooseCreatureDebuffOthersAndWatchLeave', power: -2, toughness: -2, onWatchedLeaveEffects: [{ type: 'transformSelf' }] }],
  },
  {
  id: 'shinryu-transcendent-rival',
  name: 'Shinryu, Transcendent Rival',
  costLabel: '-',
  type: 'creature',
  subtype:'Legendary Creature Dragon',
  power: 8,
  toughness: 8,
  text: 'Flying \n' +
  'As this creature transforms into Shinryu, choose an opponent. \n' +
  'Burning Chains — When the chosen player loses the game, you win the game.',
  imagePath: '/assets/cards/shinryu-transcendent-rival.webp',
  onTransformInto: [{ type: 'chooseOpponent' }],
  winsGameIfChosenOpponentLoses: true,
  },
  {
  id: 'zidane-tantalus-thief',
  name: 'Zidane, Tantalus Thief',
  costLabel: '{3}{R}{W}',
  type: 'creature',
  subtype: 'Legendary Creature Human Mutant Scout',
  power: 3,
  toughness: 3,
  text: 'When Zidane enters, gain control of target creature an opponent controls until end of turn. Untap it. It gains lifelink and haste until end of turn. \n' +
  'Whenever an opponent gains control of a permanent from you, you create a Treasure token.',
  imagePath: '/assets/cards/zidane-tantalus-thief.webp',
  onEnter: [{ type: 'gainControlOfTargetCreature', opponentControlledOnly: true, untap: true, grantKeywords: ['lifelink', 'haste'] }],
  onOpponentGainsControlFromYouTrigger: [{ type: 'createToken', tokenId: 'token-treasure' }],
  },
  {
  id: 'zodiark-umbral-god',
  name: 'Zodiark, Umbral God',
  costLabel: '{B}{B}{B}{B}{B}',
  type: 'creature',
  subtype: 'Legendary Creature God',
  power: 5,
  toughness: 5,
  text: 'Indestructible \n' +
  'When Zodiark enters, each player sacrifices half the non-God creatures they control of their choice, rounded down. \n' +
  'Whenever a player sacrifices another creature, put a +1/+1 counter on Zodiark.',
  imagePath: '/assets/cards/zodiark-umbral-god.webp',
  onEnter: [{ type: 'eachPlayerSacrificesHalfRoundedDown', filter: 'nonGodCreature' }],
  // "Whenever a player sacrifices another creature, put a +1/+1 counter on
  // Zodiark" is still deferred - a truly universal "any sacrifice, by
  // either player, from ANY source" watcher would need hooking into every
  // sacrifice-resolution path across the whole engine (resolveSacrificeQueue,
  // chooseSacrifice, and every ad hoc sacrificeSelf cost), not just this
  // one ETB effect.
  },
  // --- cards present in the server/current pool but not in the last git commit's client pool (recovered via merge, appended here) ---
  {
    id:'akroma-s-will',
    name:'Blessing of the Oracle',
    type:'instant',
    costLabel:'{3}{W}',
    text:'Choose one. If you control a commander as you cast this spell, you may choose both instead.\n'+
    '• Creatures you control gain flying, vigilance, and double strike until end of turn.\n'+
    '• Creatures you control gain lifelink, indestructible, and protection from each color until end of turn.',
    imagePath:'/assets/cards/akroma-s-will.webp',
    // "...and protection from each color" is deferred on the second mode -
    // no protection mechanic exists in this engine at all (same
    // unaddressed gap as Absolute Virtue's own printed protection).
    onCast: [
      {
        type: 'chooseOneMode',
        allowBothIfCommander: true,
        modes: [
          { label: 'Creatures you control gain flying, vigilance, and double strike until end of turn.', effects: [{ type: 'grantKeywordsToControlledPermanents', keywords: ['flying', 'vigilance', 'double strike'] }] },
          { label: 'Creatures you control gain lifelink and indestructible until end of turn.', effects: [{ type: 'grantKeywordsToControlledPermanents', keywords: ['lifelink', 'indestructible'] }] },
        ],
      },
    ],
  },
  {
    id:'atraxa-grand-unifier',
    name:'Sephiroth, the Savior',
    type:'creature',
    subtype:'Legendary Creature — Phyrexian Angel',
    costLabel:'{3}{G}{W}{U}{B}',
    power: 7,
    toughness: 7,
    text:'Flying, vigilance, deathtouch, lifelink\n'+
    'When Sephiroth enters, reveal the top ten cards of your library. For each card type, you may put a card of that type from among the revealed cards into your hand. Put the rest on the bottom of your library in a random order.',
    imagePath:'/assets/cards/atraxa-grand-unifier.webp',
    onEnter: [{ type: 'revealTopNThenPutOneOfEachCardTypeToHand', count: 10 }],
  },
  {
    id:'bruse-tarl-boorish-herder',
    name:'Hugo Kupka',
    type:'creature',
    subtype:'Legendary Creature — Human Ally',
    costLabel:'{2}{R}{W}',
    power: 3,
    toughness: 3,
    text:'Whenever Hugo Kupka enters or attacks, target creature you control gains double strike and lifelink until end of turn.\n'+
    'Partner',
    imagePath:'/assets/cards/bruse-tarl-boorish-herder.webp',
    onEnter: [{ type: 'grantKeywordsToTargetPermanent', keywords: ['double strike', 'lifelink'], creatureOnly: true, restrictToOwnCreature: true }],
    onAttack: [{ type: 'grantKeywordsToTargetPermanent', keywords: ['double strike', 'lifelink'], creatureOnly: true, restrictToOwnCreature: true }],
  },
  {
    id:'carpet-of-flowers',
    name:'Fal’Cie Paradise',
    type:'enchantment',
    costLabel:'{G}',
    text:'At the beginning of each of your main phases, if you haven’t added mana with this ability this turn, you may add X mana of any one color, where X is the number of Islands target opponent controls.',
    imagePath:'/assets/cards/carpet-of-flowers.webp',
    abilities: [
      {
        id: 'carpet-of-flowers-mana',
        label: 'Add Mana',
        cost: {},
        onlyDuringOwnMainPhase: true,
        onlyIfNotUsedThisTurn: true,
        effects: [{ type: 'addOneManaOfChosenColor', amountEqualToOpponentSubtypeCount: 'Island' }],
        effectText: 'Add X mana of any one color, where X is the number of Islands your opponent controls.',
      },
    ],
  },
  {
    id:'captain-lannery-storm',
    name:'Vaan, Aspiring Pirate',
    costLabel:'{2}{R}',
    type:'creature',
    subtype:'Legendary Creature — Human Pirate',
    power: 2,
    toughness: 2,
    text:'Haste\n'+
    'Whenever Vaan attacks, create a Treasure token.\n'+
    'Whenever you sacrifice a Treasure, Vaan gets +1/+0 until end of turn.',
    imagePath:'/assets/cards/captain-lannery-storm.webp',
    onAttack: [{ type: 'createToken', tokenId: 'token-treasure' }],
    onOwnSacrificeSubtypeTrigger: { subtype: 'Treasure', effects: [{ type: 'pumpSelf', power: 1, toughness: 0 }] }
  },
  {
    id:'chromatic-lantern',
    name:'Crystal of Altar Cave',
    costLabel:'{3}',
    type:'artifact',
    text:'Lands you control have “{T}: Add one mana of any color.”\n'+
    '{T}: Add one mana of any color.',
    imagePath:'/assets/cards/chromatic-lantern.webp',
    producesMana: 'any',
    landsYouControlProduceAnyColor: true
  },
  {
    id:'cryptic-command',
    name:'To the Crystal Tower',
    type:'instant',
    costLabel:'{1}{U}{U}{U}',
    text:'Choose two —\n'+
    '• Counter target spell.\n'+
    '• Return target permanent to its owner’s hand.\n'+
    '• Tap all creatures your opponents control.\n'+
    '• Draw a card.',
    imagePath:'/assets/cards/cryptic-command.webp',
    // "Counter target spell" is deferred entirely - this engine has no
    // stack/priority system at all (a spell resolves the instant it's
    // cast, so there's never a window where an opposing spell exists to
    // counter). The remaining three modes are fully implemented; "choose
    // two" of these three (instead of four) is a legal subset either way.
    chooseModes: [
      { label: 'Return target permanent to its owner’s hand.', effects: [{ type: 'bounceTarget', targetFilter: 'anyPermanent' }] },
      { label: 'Tap all creatures your opponents control.', effects: [{ type: 'tapAllOpponentCreatures' }] },
      { label: 'Draw a card.', effects: [{ type: 'drawCards', amount: 1 }] },
    ],
    chooseExactlyNModes: 2
  },
  {
    id:'danitha-capashen-paragon',
    name:'Squall Leonhart',
    type:'creature',
    subtype:'Legendary Creature — Human Knight',
    costLabel:'{2}{W}',
    power: 2,
    toughness: 2,
    text:'First strike, vigilance, lifelink\n'+
    'Aura and Equipment spells you cast cost {1} less to cast.',
    imagePath:'/assets/cards/danitha-capashen-paragon.webp',
    reducesCastCostForAuraOrEquipmentSpells: 1
  },
  {
    id:'deadly-dispute',
    name:'Baron Rivalry',
    type:'instant',
    costLabel:'{1}{B}',
    text:'As an additional cost to cast this spell, sacrifice an artifact or creature.\n'+
    'Draw two cards and create a Treasure token.',
    imagePath:'/assets/cards/deadly-dispute.webp',
    additionalCostSacrifice: 'creatureOrArtifact',
    onCast: [{ type: 'drawCards', amount: 2 }, { type: 'createToken', tokenId: 'token-treasure' }]
  },
  {
    id:'dovin-s-veto',
    name:'Shadowbringers',
    type:'instant',
    costLabel:'{W}{U}',
    text:'This spell can’t be countered.\n'+
    'Counter target noncreature spell.',
    imagePath:'/assets/cards/dovin-s-veto.webp'
    // Deferred entirely - this engine has no stack/priority system at all
    // (a spell resolves the instant it's cast, so there's never a window
    // where an opposing spell exists to counter, and nothing for "this
    // spell can't be countered" to protect against either). Same
    // unaddressed gap as every other counterspell this session (Cryptic
    // Command, Syphon Mind).
  },
  {
    id:'fynn-the-fangbearer',
    name:'Vayne Carudas Solidor',
    costLabel:'{1}{G}',
    type:'creature',
    subtype:'Legendary Creature — Human Warrior',
    power: 1,
    toughness: 3,
    text:'Deathtouch \n'+
    'Whenever a creature you control with deathtouch deals combat damage to a player, that player gets two poison counters',
    imagePath:'/assets/cards/fynn-the-fangbearer.webp',
    onAnyControlledCreatureWithKeywordCombatDamageGivesPoison: { keyword: 'deathtouch', amount: 2 }
  },
  {
    id:'gix-yawgmoth-praetor',
    name:'The Shadow Lord',
    costLabel:'{1}{B}{B}',
    type:'creature',
    subtype:'Legendary Creature — Phyrexian Praetor',
    power: 3,
    toughness: 3,
    text:'Whenever a creature deals combat damage to one of your opponents, its controller may pay 1 life. If they do, they draw a card.\n'+
    '{4}{B}{B}{B}, Discard X cards: Exile the top X cards of target opponent’s library. You may play lands and cast spells from among cards exiled this way without paying their mana costs.',
    imagePath:'/assets/cards/gix-yawgmoth-praetor.webp',
    // "A creature deals combat damage to one of your opponents" - in this
    // 2-player engine the only creature that can ever deal combat damage
    // TO your opponent is one YOU control (your opponent can't attack
    // themselves), so this collapses to the plain board-wide "a creature
    // you control" watcher shape.
    onAnyControlledCreatureCombatDamageToPlayer: [{ type: 'mayPayLifeThenEffect', lifeCost: 1, effects: [{ type: 'drawCards', amount: 1 }] }],
    // The {4}{B}{B}{B}, Discard X cards ability is deferred entirely - this
    // engine has no activated-ability X-cost infrastructure (GameAction
    // 'ACTIVATE_ABILITY' has no chosenX slot) and no "exile N from a
    // target player's library, grant a persistent free-cast permission for
    // all of them" effect; building both for this one ability's sake is
    // out of scope here.
  },
  {
    id:'inalla-archmage-ritualist',
    name:'Kuja, Mage Manufacturer',
    costLabel:'{2}{U}{B}{R}',
    type:'creature',
    subtype:'Legendary Creature — Human Wizard',
    power: 4,
    toughness: 5,
    text:'Eminence — Whenever another nontoken Wizard you control enters, if Inalla is in the command zone or on the battlefield, you may pay {1}. If you do, create a token that’s a copy of that Wizard. The token gains haste. Exile it at the beginning of the next end step.\n'+
    'Tap five untapped Wizards you control: Target player loses 7 life.',
    imagePath:'/assets/cards/inalla-archmage-ritualist.webp',
    // Eminence's "or in the command zone" half is deferred - only checked
    // while Inalla is actually on the battlefield (see
    // onAnyOtherControlledNontokenSubtypeEnterTrigger's own doc comment).
    onAnyOtherControlledNontokenSubtypeEnterTrigger: {
      subtype: 'Wizard',
      effects: [{ type: 'mayPayManaThenEffect', manaCost: '{1}', effects: [{ type: 'createTokenCopyOfSelf', grantsHaste: true, thenExileAtNextEndStep: true }] }],
    },
    abilities: [
      {
        id: 'inalla-archmage-ritualist-drain',
        label: 'Drain',
        cost: { tapControlledSubtypeCount: { subtype: 'Wizard', count: 5 } },
        effects: [{ type: 'loseLifeForTargetPlayer', amount: 7 }],
        effectText: 'Target player loses 7 life.',
      },
    ],
  },
  {
    id:'isshin-two-heavens-as-one',
    name:'Lightning, Lone Commando',
    costLabel:'{R}{W}{B}',
    type:'creature',
    subtype:'Legendary Creature — Human Samurai',
    power: 3,
    toughness: 4,
    text:'If a creature attacking causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time.',
    imagePath:'/assets/cards/isshin-two-heavens-as-one.webp'
    // Deferred entirely - no mechanism doubles an arbitrary triggered
    // ability in this engine (same established gap as Cloud, Midgar
    // Mercenary's and The Masamune's own "triggers an additional time"
    // clauses).
  },
  {
    id:'jodah-the-unifier',
    name:'Warrior of Light',
    costLabel:'{W}{U}{B}{R}{G}',
    type:'creature',
    subtype:'Legendary Creature — Human Wizard',
    power: 5,
    toughness: 5,
    text:'Legendary creatures you control get +X/+X, where X is the number of legendary creatures you control.\n'+
    'Whenever you cast a legendary spell from your hand, exile cards from the top of your library until you exile a legendary nonland card with lesser mana value. You may cast that card without paying its mana cost. Put the rest on the bottom of your library in a random order.',
    imagePath:'/assets/cards/jodah-the-unifier.webp',
    staticAnthemForControlledSubtypeEqualToOwnCount: { subtype: 'legendary' },
    onOwnCastLegendarySpellFromHandDigForLesserManaValueLegendary: true
  },
  {
    id:'k-rrik-son-of-yawgmoth',
    name:'Emet-Selch, Ascian',
    costLabel:'{4}{B/P}{B/P}{B/P}',
    type:'creature',
    subtype:'Legendary Creature — Phyrexian Horror Minion',
    power: 2,
    toughness: 2,
    text:'Lifelink\n'+
    'For each {B} in a cost, you may pay 2 life rather than pay that mana.\n'+
    'Whenever you cast a black spell, put a +1/+1 counter on Emet-Selch.',
    imagePath:'/assets/cards/k-rrik-son-of-yawgmoth.webp',
    // "For each {B} in a cost, you may pay 2 life rather than pay that
    // mana" is deferred as a GRANTED, board-wide effect - this engine's own
    // Phyrexian mana support (ParsedCost.phyrexian) only ever folds a
    // card's OWN printed {B/P} pips, like this card's own cost just above;
    // generalizing "any {B} pip in ANY cost you pay" would mean threading
    // an optional life-payment choice through every mana-cost check in the
    // engine (ordinary colored pips included), well beyond this card's own
    // casting.
    onOwnCastColorSpellTrigger: [{ color: 'B', effects: [{ type: 'putCounterOnSelf', counterLabel: '+1/+1', counterAmount: 1 }] }]
  },
  {
    id:'kenrith-the-returned-king',
    name:'Noctis Lucis Caelum',
    costLabel:'{4}{W}',
    type:'creature',
    subtype:'Legendary Creature — Human Noble',
    power: 5,
    toughness: 5,
    text:'{R}: All creatures gain trample and haste until end of turn.\n'+
    '{1}{G}: Put a +1/+1 counter on target creature.\n'+
    '{2}{W}: Target player gains 5 life.\n'+
    '{3}{U}: Target player draws a card.\n'+
    '{4}{B}: Put target creature card from a graveyard onto the battlefield under its owner’s control.\n',
    imagePath:'/assets/cards/kenrith-the-returned-king.webp',
    abilities: [
      {
        id: 'kenrith-the-returned-king-trample-haste',
        label: 'Trample and Haste',
        cost: { manaLabel: '{R}' },
        effects: [{ type: 'grantKeywordsToAllCreatures', keywords: ['trample', 'haste'] }],
        effectText: 'All creatures gain trample and haste until end of turn.',
      },
      {
        id: 'kenrith-the-returned-king-counter',
        label: 'Counter',
        cost: { manaLabel: '{1}{G}' },
        effects: [{ type: 'putCounterOnTarget', counterLabel: '+1/+1', counterAmount: 1 }],
        effectText: 'Put a +1/+1 counter on target creature.',
      },
      {
        id: 'kenrith-the-returned-king-life',
        label: 'Life',
        cost: { manaLabel: '{2}{W}' },
        effects: [{ type: 'gainLifeForTargetPlayer', amount: 5 }],
        effectText: 'Target player gains 5 life.',
      },
      {
        id: 'kenrith-the-returned-king-draw',
        label: 'Draw',
        cost: { manaLabel: '{3}{U}' },
        effects: [{ type: 'drawCardsFromTargetPlayer', count: 1 }],
        effectText: 'Target player draws a card.',
      },
      {
        id: 'kenrith-the-returned-king-reanimate',
        label: 'Reanimate',
        cost: { manaLabel: '{4}{B}' },
        effects: [{ type: 'reanimateTargetFromGraveyard', anyGraveyard: true, entersUnderOwnerControl: true }],
        effectText: 'Put target creature card from a graveyard onto the battlefield under its owner’s control.',
      },
    ],
  },
  {
    id:'kinnan-bonder-prodigy',
    name:'Seymour Guado',
    type:'creature',
    subtype:'Legendary Creature — Human Druid',
    costLabel:'{G}{U}',
    power: 2,
    toughness: 2,
    text:'Whenever you tap a nonland permanent for mana, add one mana of any type that permanent produced.\n'+
    '{5}{G}{U}: Look at the top five cards of your library. You may put a non-Human creature card from among them onto the battlefield. Put the rest on the bottom of your library in a random order.',
    imagePath:'/assets/cards/kinnan-bonder-prodigy.webp',
    grantsExtraManaOfSameTypeWhenTappingNonlandPermanent: true,
    abilities: [
      {
        id: 'kinnan-bonder-prodigy-dig',
        label: 'Dig',
        cost: { manaLabel: '{5}{G}{U}' },
        effects: [{ type: 'revealFiltered', count: 5, filterType: 'creature', excludeSubtype: 'Human', takenDestination: 'battlefieldUntapped' }],
        effectText: 'Look at the top five cards of your library. You may put a non-Human creature card from among them onto the battlefield. Put the rest on the bottom of your library in a random order.',
      },
    ],
  },
  {
    id:'kraum-ludevic-s-opus',
    name:'Barnabas Tharmr',
    costLabel:'{3}{U}{R}',
    type:'creature',
    subtype:'Legendary Creature — Zombie Horror',
    power: 4,
    toughness: 4,
    text:'Flying, haste\n'+
    'Whenever an opponent casts their second spell each turn, draw a card.\n'+
    'Partner',
    imagePath:'/assets/cards/kraum-ludevic-s-opus.webp',
    // "Partner" is a deckbuilding-only rule - see Cecil Harvey's own doc
    // comment.
    onOpponentCastsSecondSpellEachTurnTrigger: [{ type: 'drawCards', amount: 1 }]
  },
  {
    id:'laboratory-maniac',
    name:'Vana’diel Adventurers',
    costLabel:'{2}{U}',
    type:'creature',
    subtype:'Creature — Human Wizard',
    power: 2,
    toughness: 2,
    text:'If you would draw a card while your library has no cards in it, you win the game instead.',
    imagePath:'/assets/cards/laboratory-maniac.webp',
    winsGameIfWouldDrawFromEmptyLibrary: true
  },
  {
    id:'light-up-the-stage',
    name:'A Promise Fulfilled',
    type:'sorcery',
    costLabel:'{2}{R}',
    text:'Spectacle {R} \n'+
    'Exile the top two cards of your library. Until the end of your next turn, you may play those cards.',
    imagePath:'/assets/cards/light-up-the-stage.webp',
    spectacleCost: '{R}',
    onCast: [{ type: 'exileTopOfLibraryPlayableUntilCleanup', count: 2, untilControllerNextTurn: true }]
  },
  {
    id:'loran-of-the-third-path',
    name:'Garnet Til Alexandros 17th',
    costLabel:'{2}{W}',
    type:'creature',
    subtype:'Legendary Creature — Human Artificer',
    power: 2,
    toughness: 1,
    text:'Vigilance\n'+
    'When Garnet Til Alexandros 17th enters, destroy up to one target artifact or enchantment.\n'+
    '{T}: You and target opponent each draw a card.',
    imagePath:'/assets/cards/loran-of-the-third-path.webp',
    onEnter: [{ type: 'destroyTarget', targetFilter: 'artifactOrEnchantment', optional: true }],
    abilities: [
      {
        id: 'loran-of-the-third-path-draw',
        label: 'Draw',
        cost: { tap: true },
        effects: [{ type: 'drawCardsFromTargetPlayer', count: 1, opponentOnly: true, alsoCasterDraws: true }],
        effectText: 'You and target opponent each draw a card.',
      },
    ],
  },
  {
    id:'mangara-the-diplomat',
    name:'Minwu, Rebellion Strategist',
    costLabel:'{3}{W}',
    type:'creature',
    subtype:'Legendary Creature — Human Cleric',
    power: 2,
    toughness: 4,
    text:'Lifelink\n'+
    'Whenever an opponent attacks with creatures, if two or more of those creatures are attacking you and/or planeswalkers you control, draw a card.\n'+
    'Whenever an opponent casts their second spell each turn, draw a card.',
    imagePath:'/assets/cards/mangara-the-diplomat.webp',
    // "...and/or planeswalkers you control" simplifies away - see
    // onOpponentAttacksYouWithCreatureCountAtLeast's own doc comment.
    onOpponentAttacksYouWithCreatureCountAtLeast: { minCount: 2, effects: [{ type: 'drawCards', amount: 1 }] },
    onOpponentCastsSecondSpellEachTurnTrigger: [{ type: 'drawCards', amount: 1 }]
  },
  {
    id:'mizzix-s-mastery',
    name:'Dawn Warriors’ Legacy',
    costLabel:'{3}{R}',
    type:'sorcery',
    text:'Exile target card that’s an instant or sorcery from your graveyard. For each card exiled this way, copy it, and you may cast the copy without paying its mana cost. Exile Dawn Warriors’ Legacy.\n'+
    'Overload {5}{R}{R}{R}',
    imagePath:'/assets/cards/mizzix-s-mastery.webp',
    onCast: [{ type: 'exileTargetInstantOrSorceryFromOpponentGraveyardThenMayCastForFixedCost', ownGraveyardOnly: true, fixedCost: '{0}' }],
    exilesSelfInsteadOfGraveyardAfterResolving: true,
    overload: { cost: '{5}{R}{R}{R}', effects: [{ type: 'exileAllInstantOrSorceryFromOwnGraveyardThenMayCastFree' }] },
  },
  {
    id:'muldrotha-the-gravetide',
    name:'Orphan, Cocoon fal’Cie',
    costLabel:'{3}{B}{G}{U}',
    type:'creature',
    subtype:'Legendary Creature — Elemental Avatar',
    power: 6,
    toughness: 6,
    text:'During each of your turns, you may play a land and cast a permanent spell of each permanent type from your graveyard.',
    imagePath:'/assets/cards/muldrotha-the-gravetide.webp',
    // "...play a land...from your graveyard" is deferred - see
    // PlayerState.graveyardCastTypesUsedThisTurn's own doc comment for why
    // (no graveyard-sourced land-play pathway exists at all).
    grantsCastPermanentFromOwnGraveyardOncePerTypeEachTurn: true
  },
  {
    id:'najeela-the-blade-blossom',
    name:'Cloud Strife',
    costLabel:'{2}{R}',
    type:'creature',
    subtype:'Legendary Creature — Human Warrior',
    power: 3,
    toughness: 2,
    text:'Whenever a Warrior attacks, you may have its controller create a 1/1 white Warrior creature token that’s tapped and attacking.\n'+
    '{W}{U}{B}{R}{G}: Untap all attacking creatures. They gain trample, lifelink, and haste until end of turn. After this phase, there is an additional combat phase. Activate only during combat.',
    imagePath:'/assets/cards/najeela-the-blade-blossom.webp',
    onAnyWarriorAttacksMayCreateTokenForAttackerController: { tokenId: 'token-warrior' },
    abilities: [
      {
        id: 'najeela-the-blade-blossom-combat',
        label: 'Extra Combat',
        cost: { manaLabel: '{W}{U}{B}{R}{G}' },
        onlyDuringCombat: true,
        effects: [
          { type: 'untapAllAttackingCreatures' },
          { type: 'grantKeywordsToAllAttackers', keywords: ['trample', 'lifelink', 'haste'] },
          { type: 'queueExtraCombatPhase' },
        ],
        effectText: 'Untap all attacking creatures. They gain trample, lifelink, and haste until end of turn. After this phase, there is an additional combat phase.',
      },
    ],
  },
  {
    id:'nature-s-claim',
    name:'Search for the Frozen Esper',
    costLabel:'{G}',
    type:'instant',
    text:'Destroy target artifact or enchantment. Its controller gains 4 life.',
    imagePath:'/assets/cards/nature-s-claim.webp',
    onCast: [{ type: 'destroyTarget', targetFilter: 'artifactOrEnchantment', thenControllerGainsLife: 4 }],
  },
  {
    id:'primeval-titan',
    name:'Astral Titan',
    costLabel:'{4}{G}{G}',
    type:'creature',
    subtype:'Creature — Giant',
    power: 6,
    toughness: 6,
    text:'Trample\n'+
    'Whenever this creature enters or attacks, you may search your library for up to two land cards, put them onto the battlefield tapped, then shuffle.',
    imagePath:'/assets/cards/primeval-titan.webp',
    onEnter: [{ type: 'searchLibraryForAnyLand', count: 2, toBattlefieldTapped: true }],
    onAttack: [{ type: 'searchLibraryForAnyLand', count: 2, toBattlefieldTapped: true }]
  },
  {
    id:'ragavan-nimble-pilferer',
    name:'Zidane Tribal',
    costLabel:'{R}',
    type:'creature',
    subtype:'Legendary Creature — Monkey Pirate',
    power: 2,
    toughness: 1,
    text:'Whenever Zidane Tribal deals combat damage to a player, create a Treasure token and exile the top card of that player’s library. Until end of turn, you may cast that card.\n'+
    'Dash {1}{R}',
    imagePath:'/assets/cards/ragavan-nimble-pilferer.webp',
    onCombatDamageToPlayerCreateTreasureAndExileTopOfTheirLibraryPlayableUntilEndOfTurn: true,
    dash: { cost: '{1}{R}' },
  },
  {
    id:'rhystic-study',
    name:'Stay with Me',
    costLabel:'{2}{U}',
    type:'enchantment',
    text:'Whenever an opponent casts a spell, you may draw a card unless that player pays {1}.',
    imagePath:'/assets/cards/rhystic-study.webp',
    onOpponentCastsSpellMayDrawUnlessTheyPay: { cost: 1 }
  },
  {
    id:'stroke-of-midnight',
    name:'Memories of Nibelheim',
    costLabel:'{2}{W}',
    type:'instant',
    text:'Destroy target nonland permanent. Its controller creates a 1/1 white Human creature token.',
    imagePath:'/assets/cards/stroke-of-midnight.webp',
    onCast: [{ type: 'destroyTarget', targetFilter: 'nonlandPermanent', thenCreateTokenForDestroyedController: 'token-human' }]
  },
  {
    id:'teferi-mage-of-zhalfir',
    name:'Edea Kramer',
    costLabel:'{2}{U}{U}{U}',
    type:'creature',
    subtype:'Legendary Creature — Human Wizard',
    power: 3,
    toughness: 4,
    text:'Flash\n'+
    'Creature cards you own that aren’t on the battlefield have flash.\n'+
    'Each opponent can cast spells only any time they could cast a sorcery.',
    imagePath:'/assets/cards/teferi-mage-of-zhalfir.webp',
    grantsFlashToOwnedCreatureCardsNotOnBattlefield: true,
    opponentsCanOnlyCastAtSorcerySpeed: true
  },
  {
    id:'thrasios-triton-hero',
    name:'Tidus, Zanarkand Fayth',
    costLabel:'{G}{U}',
    type:'creature',
    subtype:'Legendary Creature — Merfolk Wizard',
    power: 1,
    toughness: 3,
    text:'{4}: Scry 1, then reveal the top card of your library. If it’s a land card, put it onto the battlefield tapped. Otherwise, draw a card.\n'+
    'Partner',
    imagePath:'/assets/cards/thrasios-triton-hero.webp',
    // "Partner" is a deckbuilding-only rule - see Cecil Harvey's own doc
    // comment for why it has no in-game effect here.
    abilities: [
      {
        id: 'thrasios-triton-hero-scry',
        label: 'Scry',
        cost: { manaLabel: '{4}' },
        effects: [{ type: 'surveil', count: 1, thenRevealTopLandToBattlefieldTappedElseDraw: true }],
        effectText: 'Scry 1, then reveal the top card of your library. If it’s a land card, put it onto the battlefield tapped. Otherwise, draw a card.',
      },
    ],
  },
  {
    id:'traxos-scourge-of-kroog',
    name:'Giant of Babil',
    costLabel:'{7}',
    type:'creature',
    subtype:'Legendary Artifact Creature — Construct',
    power: 7,
    toughness: 7,
    text:'Trample\n'+
    'Giant of Babil enters tapped and doesn’t untap during your untap step.\n'+
    'Whenever you cast a historic spell, untap Giant of Babil.',
    imagePath:'/assets/cards/traxos-scourge-of-kroog.webp',
    entersTapped: true,
    doesntUntapDuringControllerUntapStep: true,
    onOwnCastHistoricSpellTrigger: [{ type: 'untapSelf' }]
  },
  {
    id:'tymna-the-weaver',
    name:'Cecil Harvey',
    type:'creature',
    subtype:'Legendary Creature — Human Cleric',
    costLabel:'{1}{W}{B}',
    power: 2,
    toughness: 2,
    text:'Lifelink\n'+
    'At the beginning of each of your postcombat main phases, you may pay X life, where X is the number of opponents that were dealt combat damage this turn. If you do, draw X cards.\n'+
    'Partner',
    imagePath:'/assets/cards/tymna-the-weaver.webp',
    // "Partner" is a deckbuilding-only rule (lets a Commander deck run two
    // commanders) - this engine only ever supports a single commander
    // (PlayerState.commanderDefId is singular), so it has no in-game
    // effect to hook here.
    onOwnPostcombatMainPhase: [{ type: 'mayPayLifeThenEffect', lifeCost: 1, effects: [{ type: 'drawCards', amount: 1 }], onlyIfOpponentDealtCombatDamageThisTurn: true }]
  },
  {
    id:'varragoth-bloodsky-sire',
    name:'Ardyn Izunia',
    costLabel:'{2}{B}',
    type:'creature',
    subtype:'Legendary Creature — Demon Rogue',
    power: 2,
    toughness: 3,
    text:'Deathtouch\n'+
    'Boast — {1}{B}: Target player searches their library for a card, then shuffles and puts that card on top. ',
    imagePath:'/assets/cards/varragoth-bloodsky-sire.webp',
    abilities: [
      {
        id: 'varragoth-bloodsky-sire-boast',
        label: 'Boast',
        cost: { manaLabel: '{1}{B}' },
        onlyIfAttackedThisTurn: true,
        effects: [{ type: 'searchLibraryForAnyCardToTopForTargetPlayer' }],
        effectText: 'Target player searches their library for a card, then shuffles and puts that card on top.',
      },
    ],
  },
  {
    id:'vial-smasher-the-fierce',
    name:'Clive Rosfield',
    costLabel:'{1}{B}{R}',
    type:'creature',
    subtype:'Legendary Creature — Goblin Berserker',
    power: 2,
    toughness: 3,
    text:'Whenever you cast your first spell each turn, choose an opponent at random. Clive Rosfield deals damage equal to that spell’s mana value to that player or a planeswalker that player controls.\n'+
    'Partner',
    imagePath:'/assets/cards/vial-smasher-the-fierce.webp',
    // "Choose an opponent at random" is always the one opponent in this
    // 2-player engine, and "or a planeswalker that player controls" never
    // applies (no planeswalkers). "Partner" is a deckbuilding-only rule -
    // see Cecil Harvey's own doc comment.
    onOwnCastFirstSpellEachTurnDealDamageEqualToManaValue: true
  },
  {
    id:'winota-joiner-of-forces',
    name:'Bartz Klauser',
    costLabel:'{2}{R}{W}',
    type:'creature',
    subtype:'Legendary Creature — Human Warrior',
    power: 4,
    toughness: 4,
    text:'Whenever a non-Human creature you control attacks, look at the top six cards of your library. You may put a Human creature card from among them onto the battlefield tapped and attacking. It gains indestructible until end of turn. Put the rest of the cards on the bottom of your library in a random order.',
    imagePath:'/assets/cards/winota-joiner-of-forces.webp',
    onAnyControlledCreatureAttacksWithoutSubtypeTrigger: {
      excludedSubtype: 'Human',
      effects: [
        {
          type: 'revealFiltered',
          count: 6,
          filterType: 'creature',
          filterSubtype: 'Human',
          takenDestination: 'battlefieldTappedAttacking',
          thenGrantsIndestructibleUntilEndOfTurn: true,
        },
      ],
    },
  },
];

/**
 * Definitions for tokens created by other cards' onEnter/onCast effects (see
 * types.ts: CreateTokenEffect). Not part of any deck or the printed card
 * pool - looked up the same way via getCardDefinition once a token exists on
 * the battlefield. Keyed by the stats/text actually printed on the cards
 * that create them, so multiple cards creating "a 2/2 green Bird" etc. share
 * one entry.
 */
export const TOKEN_POOL: CardDefinition[] = [
  {
    id: 'token-hero',
    name: 'Hero',
    type: 'creature',
    subtype: 'Hero Token',
    costLabel: '-',
    power: 1,
    toughness: 1,
    text: '',
    imagePath: '/assets/cards/token-hero.webp',
  },
  {
    id: 'token-spirit',
    name: 'Spirit',
    type: 'creature',
    subtype: 'Spirit Token',
    costLabel: '-',
    power: 1,
    toughness: 1,
    text: 'Flying',
    imagePath: '/assets/cards/token-spirit.webp',
  },
  {
    id: 'token-squid',
    name: 'Squid',
    type: 'creature',
    subtype: 'Squid Token',
    costLabel: '-',
    power: 1,
    toughness: 1,
    text: 'Islandwalk (This creature can’t be blocked as long as defending player controls an Island.)',
    imagePath: '/assets/cards/token-squid.webp',
  },
  {
    id: 'token-wizard',
    name: 'Wizard',
    type: 'creature',
    subtype: 'Wizard Token',
    costLabel: '-',
    power: 0,
    toughness: 1,
    text: 'Whenever you cast a noncreature spell, this token deals 1 damage to each opponent.',
    imagePath: '/assets/cards/token-wizard.webp',
    noncreatureCastTrigger: { damageEachOpponent: 1 },
  },
  {
    id: 'token-food',
    name: 'Food',
    type: 'artifact',
    subtype: 'Food Token',
    costLabel: '-',
    text: '2, T, Sacrifice this artifact: You gain 3 life.',
    imagePath: '/assets/cards/food.webp',
    abilities: [
      {
        id: 'token-food-eat',
        label: 'Eat',
        cost: { manaLabel: '{2}', tap: true, sacrificeSelf: true },
        effects: [{ type: 'gainLife', amount: 3 }],
        effectText: 'You gain 3 life.',
      },
    ],
  },
  {
    id: 'token-clue',
    name: 'Clue',
    type: 'artifact',
    subtype: 'Clue Token',
    costLabel: '-',
    text: '{2}, Sacrifice this token: Draw a card.',
    imagePath: '/assets/cards/token-clue.webp',
    abilities: [
      {
        id: 'token-clue-draw',
        label: 'Draw',
        cost: { manaLabel: '{2}', sacrificeSelf: true },
        effects: [{ type: 'drawCards', amount: 1 }],
        effectText: 'Draw a card.',
      },
    ],
  },
  {
    id: 'token-bird',
    name: 'Bird',
    type: 'creature',
    subtype: 'Bird Token',
    costLabel: '-',
    power: 2,
    toughness: 2,
    text: 'Whenever a land you control enters, this token gets +1/+0 until end of turn.',
    imagePath: '/assets/cards/token-bird.webp',
  },
  {
    id: 'token-bird-flying-vigilance',
    name: 'Bird',
    type: 'creature',
    subtype: 'Bird Token',
    costLabel: '-',
    power: 1,
    toughness: 1,
    text: 'Flying, vigilance',
    imagePath: '/assets/cards/token-bird.webp',
  },
  {
    id: 'token-knight',
    name: 'Knight',
    type: 'creature',
    subtype: 'Knight Token',
    costLabel: '-',
    power: 2,
    toughness: 2,
    text: '',
    imagePath: '/assets/cards/token-knight.webp',
  },
  {
    id: 'token-moogle',
    name: 'Moogle',
    type: 'creature',
    subtype: 'Moogle Token',
    costLabel: '-',
    power: 1,
    toughness: 2,
    text: 'Lifelink',
    imagePath: '/assets/cards/token-moogle.webp',
  },
  {
    id: 'token-elemental',
    name: 'Elemental',
    type: 'creature',
    subtype: 'Elemental Token',
    costLabel: '-',
    power: 2,
    toughness: 2,
    text: 'This token is all colors.',
    imagePath: '/assets/cards/token-elemental.webp',
  },
  {
    id: 'token-treasure',
    name: 'Treasure',
    type: 'artifact',
    subtype: 'Treasure Token',
    costLabel: '-',
    text: 'Tap, Sacrifice this token: Add one mana of any color.',
    imagePath: '/assets/cards/treasure.webp',
    producesMana: 'any',
    sacrificesOnTap: true,
  },
  {
    id: 'token-angelo',
    name: 'Angelo',
    type: 'creature',
    subtype: 'Legendary Dog Token',
    costLabel: '-',
    power: 1,
    toughness: 1,
    text: '',
    imagePath: '/assets/cards/token-angelo.webp',
  },
  {
    id: 'token-darkstar',
    name: 'Darkstar',
    type: 'creature',
    subtype: 'Legendary Dog Token',
    costLabel: '-',
    power: 2,
    toughness: 2,
    text: '',
    imagePath: '/assets/cards/token-darkstar.webp',
  },
  {
    id: 'token-robot-warrior',
    name: 'Robot Warrior',
    type: 'creature',
    subtype: 'Artifact Robot Warrior Token',
    costLabel: '-',
    power: 3,
    toughness: 3,
    text: '',
    imagePath: '/assets/cards/token-robot-warrior.webp',
  },
  {
    id: 'token-horror',
    name: 'Horror',
    type: 'creature',
    subtype: 'Horror Token',
    costLabel: '-',
    power: 2,
    toughness: 2,
    text: '',
    imagePath: '/assets/cards/horror.webp',
  },
  {
    id: 'token-soldier',
    name: 'Soldier',
    type: 'creature',
    subtype: 'Human Soldier Token',
    costLabel: '-',
    power: 1,
    toughness: 1,
    text: '',
    imagePath: '/assets/cards/token-soldier.webp',
  },
  {
    id: 'token-rebel',
    name: 'Rebel',
    type: 'creature',
    subtype: 'Human Rebel Token',
    costLabel: '-',
    power: 2,
    toughness: 2,
    text: '',
    imagePath: '/assets/cards/token-rebel.webp',
  },
  {
    id: 'token-human',
    name: 'Human',
    type: 'creature',
    subtype: 'Human Token',
    costLabel: '-',
    power: 1,
    toughness: 1,
    text: '',
    imagePath: '/assets/cards/token-human.webp',
  },
  {
    id: 'token-construct',
    name: 'Construct',
    type: 'creature',
    subtype: 'Artifact Creature — Construct Token',
    costLabel: '-',
    power: 0,
    toughness: 0,
    text: 'This creature gets +1/+1 for each artifact you control.',
    powerBonusPerControlledArtifact: 1,
    imagePath: '/assets/cards/token-construct.webp',
  },
  {
    id: 'token-the-blackjack',
    name: 'The Blackjack',
    type: 'artifact',
    subtype: 'Legendary Artifact — Vehicle Token',
    costLabel: '-',
    power: 3,
    toughness: 3,
    text: 'Flying\nCrew 2',
    imagePath: '/assets/cards/token-the-blackjack.webp',
    crew: 2,
  },
  // --- cards present in the server/current pool but not in the last git commit's client pool (recovered via merge, appended here) ---
  {
    id: 'token-warrior',
    name: 'Warrior',
    type: 'creature',
    subtype: 'Warrior Token',
    costLabel: '-',
    power: 1,
    toughness: 1,
    text: '',
    imagePath: '/assets/cards/token-warrior.webp',
  },
];

export function getCardDefinition(defId: string): CardDefinition {
  const def = CARD_POOL.find((c) => c.id === defId) ?? TOKEN_POOL.find((c) => c.id === defId);
  if (!def) throw new Error(`Unknown card id: ${defId}`);
  return def;
}

/** Like getCardDefinition, but returns null instead of throwing when the id
 * matches nothing in the pool - for data that didn't come from the live
 * CARD_POOL/TOKEN_POOL itself (a saved deck, a community deck) where one
 * stale id, left behind by a card that's since been renamed or removed,
 * shouldn't crash the whole page. */
export function tryGetCardDefinition(defId: string): CardDefinition | null {
  return CARD_POOL.find((c) => c.id === defId) ?? TOKEN_POOL.find((c) => c.id === defId) ?? null;
}

/** A transformed back face (Braska's Final Aeon, Clive, Ifrit's Warden of
 * Inferno's back side, ...) only ever exists ON THE BATTLEFIELD - the front
 * face and back face are the same physical card, so the moment it leaves
 * the battlefield (dies, is bounced, milled, ...) it reverts to its front
 * face, the same way a real double-faced permanent does. Returns `defId`
 * itself for anything that ISN'T a back face (the front face of a
 * transforming card, or any card that doesn't transform at all) - reverse
 * lookup is safe here since exactly one printed card ever names a given id
 * as its transformsInto. See engine/combat.ts: moveCreaturesToGraveyard,
 * the one place this is currently applied (a permanent leaving the
 * battlefield via death/sacrifice) - other zone-change paths (bounce, mill,
 * exile) don't yet call this. */
export function frontFaceDefId(defId: string): string {
  const frontFace = CARD_POOL.find((c) => c.transformsInto === defId);
  return frontFace ? frontFace.id : defId;
}

/**
 * One fixed 40-card decklist: lands spread across the five crystals, plus
 * two copies of every nonland card. No deck builder yet - both players play
 * this same list. A natural next step is a deck-selection screen that picks
 * a subset of CARD_POOL per player instead of hardcoding this.
 */
export function buildDefaultDecklist(): string[] {
  // Plain, untapped, single-color basic lands - not the "fire-crystal"-style
  // ids this used to reference, which were never real cards in CARD_POOL and
  // crashed (getCardDefinition throws on an unknown id) the moment a player
  // actually tried to interact with one.
  const lands = ['plains', 'island', 'swamp', 'mountain', 'forest'];
  // A transform back face (Hades, Ragnarok, Ultimecia's Omnipotent side, ...)
  // never exists as its own library card - it's only ever reached by
  // flipping the front face already in play, so it must never be dealt into
  // a hand or library on its own. Every real back face is printed with
  // costLabel: '-' (it's never cast on its own), so that - not just "is
  // SOME card's transformsInto target" - is the actual signal: Ifrit,
  // Warden of Inferno's own transformsInto points back to Clive, Ifrit's
  // Dominant (a real, castable front face with a real cost), and that
  // bidirectional link would otherwise wrongly exclude Clive too.
  const backFaceIds = new Set(
    CARD_POOL.map((c) => c.transformsInto)
      .filter((id): id is string => !!id)
      .filter((id) => getCardDefinition(id).costLabel === '-')
  );
  const nonlands = CARD_POOL.filter((c) => c.type !== 'land' && !backFaceIds.has(c.id)).map((c) => c.id);

  const decklist: string[] = [];
  for (let i = 0; i < 17; i++) decklist.push(lands[i % lands.length]);
  for (const id of nonlands) decklist.push(id, id);
  return decklist;
}
