// ============================================================================
// types.ts
// ============================================================================

export type CardType = 'creature' | 'instant' | 'sorcery' | 'land' | 'artifact' | 'enchantment';

export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G' | 'C';
export type ManaPool = Record<ManaColor, number>;

export interface CardAbility {
  id: string;
  label: string;
  cost: {
    tap?: boolean;
    sacrificeSelf?: boolean;
    discardCards?: number;
    manaLabel?: string;
    /** "Exile N cards from your graveyard" as (part of) the cost - which N
     * cards is never mechanically relevant elsewhere in this engine, so
     * they're auto-selected (oldest first) rather than player-chosen. */
    exileFromGraveyard?: number;
    /** "Sacrifice another creature/artifact/either" as part of the cost - the
     * controller picks WHICH one client-side before dispatching, and it
     * arrives baked into the ACTIVATE_ABILITY action as costTargetInstanceId
     * (unlike exileFromGraveyard, this choice is strategically meaningful
     * enough that auto-selecting it wouldn't be right). See
     * engine/actions.ts: activateAbility. */
    sacrificeAnother?: 'creature' | 'artifact' | 'artifactOrCreature';
    /** "Exile this [permanent]" as (part of) the cost (e.g. Elixir) - unlike
     * sacrificeSelf, the card goes to exile instead of the graveyard. */
    exileSelf?: boolean;
  };
  /** "At the beginning of your end step, you may..." - since there's no
   * separate trigger/priority system, this just restricts activation to
   * your own end step instead, and the player chooses to press it or not,
   * standing in for "you may". Bypassed under Mutual Adjustment like other
   * timing restrictions (see engine/actions.ts: castCard's own !mutual check). */
  onlyDuringOwnEndStep?: boolean;
  /** "At the beginning of your first main phase, you may..." - same "you
   * may" stand-in as onlyDuringOwnEndStep, just gated on main1 instead. */
  onlyDuringOwnFirstMainPhase?: boolean;
  /** "At the beginning of your upkeep, ..." - same "you may" stand-in as
   * onlyDuringOwnEndStep, just gated on the upkeep phase instead. */
  onlyDuringOwnUpkeep?: boolean;
  /** "Activate only as a sorcery" (e.g. Clive, Ifrit's Dominant) - your own
   * turn, either main phase. Bypassed under Mutual Adjustment like every
   * other timing restriction here. */
  onlyDuringOwnMainPhase?: boolean;
  /** A precondition (not a cost) - the controller's graveyard must have at
   * least this many cards for the ability to be legal at all (e.g. Emet-Selch,
   * Unsundered's "if there are fourteen or more cards in your graveyard"). */
  requiresGraveyardSize?: number;
  /** After costs are paid, transform this permanent into its transformsInto
   * back face (same defId swap as FLIP_CARD). */
  transformSelf?: boolean;
  /** After costs are paid, EXILE this permanent, then create a brand-new
   * permanent of its transformsInto back face entering the battlefield in
   * its place (e.g. Clive, Ifrit's Dominant -> Ifrit, Warden of Inferno) -
   * unlike transformSelf's in-place defId swap, this is a genuine zone
   * change: the new object is subject to summoning sickness again, and its
   * own onEnter/Saga-entry effects fire fresh. See engine/actions.ts:
   * activateAbility. */
  exileAndReturnTransformed?: boolean;
  /** "Return this card from your graveyard to the battlefield transformed"
   * (Garland, Knight of Cornelia) - an activated ability whose SOURCE lives
   * in the graveyard rather than the battlefield (unlike every other
   * CardAbility here). Removes it from the graveyard and creates a fresh
   * instance of its transformsInto back face directly on the battlefield -
   * same "genuine zone change, fresh summoning sickness, fresh onEnter" as
   * exileAndReturnTransformed, just sourced from a different zone. See
   * engine/actions.ts: activateAbility. */
  returnFromGraveyardTransformed?: boolean;
  /** Meld: requires the controller to also own and control a creature with
   * `partnerDefId` (checked as a precondition, same as a targeting
   * restriction) - after costs are paid, exiles both this permanent and the
   * partner, then creates a fresh `resultDefId` permanent in their place.
   * See engine/actions.ts: activateAbility. */
  meldsWith?: { partnerDefId: string; resultDefId: string };
  /** Effects resolved (via engine/effects.ts: resolveCardEffects) right after
   * costs are paid - e.g. Ahriman's "Sacrifice another creature or artifact:
   * Draw a card." uses [{ type: 'loot', drawCount: 1, discardCount: 0 }]. */
  effects?: CardEffect[];
  effectText: string;
}

/**
 * Machine-readable card effects, layered on top of the free-text `text`
 * field (which stays the source of truth for display). Only mechanically
 * unambiguous, no-choice effects belong here - see engine/effects.ts. Grows
 * as more patterns get automated; anything not covered here still just
 * displays as text and is applied manually by the players.
 */
export interface CreateTokenEffect {
  type: 'createToken';
  /** id of a CardDefinition in TOKEN_POOL (data/cards.ts). */
  tokenId: string;
  /** Defaults to 1. */
  count?: number | 'perCreatureYouControl';
  tapped?: boolean;
  /** Job select style: attach the permanent generating this effect to the
   * (single) token it just created. Only meaningful when count resolves to 1. */
  attachSelfToToken?: boolean;
}

/**
 * Requires the controller to pick a target once the source resolves - see
 * GameState.pendingTarget and engine/actions.ts: chooseTarget. Only
 * generated by onEnter for now.
 */
export interface TapAndStunEffect {
  type: 'tapAndStun';
  targetController: 'opponent';
  targetType: 'artifact' | 'creature' | 'artifactOrCreature';
}

/**
 * "Destroy target [filter]" - see GameState.pendingTarget and
 * engine/actions.ts: chooseTarget. Respects indestructible, same as any
 * other destroy effect. `targetFilter` is a named literal per distinct
 * wording rather than a generic predicate builder - add more as more cards
 * need them.
 */
export interface DestroyTargetEffect {
  type: 'destroyTarget';
  targetFilter:
    /** "target artifact, enchantment, or creature with flying" (Airship Crash). */
    | 'artifactEnchantmentOrFlyingCreature'
    /** "target artifact or enchantment" (Coliseum Behemoth). */
    | 'artifactOrEnchantment'
    /** "target permanent" - no type restriction at all (Bahamut, Warden of
     * Inferno's Gigaflare). */
    | 'anyPermanent'
    /** "target nonland permanent" (Fate of the Sun-Cryst) - any permanent
     * except a land, distinct from anyPermanent above. */
    | 'nonlandPermanent'
    /** "target creature with power N or greater" (Battle Menu's Magic mode) -
     * checked against effectivePower at resolution time; requires `minPower`. */
    | 'creatureWithMinPower';
  /** Only used with targetFilter: 'creatureWithMinPower'. */
  minPower?: number;
  /** "destroy up to one target [filter]" (Summon: Bahamut) - decline-able via
   * the null-target convention, same as every other "up to one" effect. */
  optional?: boolean;
}

/** "[This] deals N damage to target creature" (Light of Judgment) - a plain
 * targeted damage effect, distinct from every other damage-shaped effect
 * here (which are all either combat damage or "to each opponent"/"to that
 * creature's controller" combos). Respects indestructible; lethal damage
 * goes through the normal death pipeline. */
export interface DamageTargetCreatureEffect {
  type: 'damageTargetCreature';
  amount: number;
}

/**
 * "Reveal the top N cards of your library" followed by a fixed sequence of
 * alternating picks - each step names who chooses next and where their pick
 * goes, consuming the revealed cards one at a time; once fewer cards remain
 * than there are steps left, whatever's left automatically goes to
 * `remainderDestination`. See GameState.pendingReveal and
 * engine/actions.ts: chooseRevealedCard. "you"/"opponent" are always
 * relative to whoever controls the source card, never to whichever player
 * happens to be acting.
 */
export interface RevealAndDivideEffect {
  type: 'revealAndDivide';
  count: number;
  steps: { chooser: 'you' | 'opponent'; destination: 'hand' | 'bottomOfLibrary' }[];
  remainderDestination: 'hand' | 'bottomOfLibrary';
}

/**
 * "As it enters, choose a color" (Crossroads Village) - the chosen color
 * becomes fixed as this permanent's produced mana color from then on (see
 * CardInstance.chosenManaColor and GameState.pendingManaColorChoice).
 * Colorless is deliberately not offered - cards worded this way always mean
 * one of the five real colors.
 */
export interface ChooseManaColorEffect {
  type: 'chooseManaColor';
}

/**
 * "Target opponent sacrifices a creature of their choice" - see
 * GameState.pendingSacrifice and engine/actions.ts: chooseSacrifice. Only
 * "opponent sacrifices a creature" is implemented so far (Cornered by Black
 * Mages); other sacrifice wordings (each player, a permanent, a nontoken
 * creature, etc.) still need to be handled by hand.
 */
export interface SacrificeCreatureEffect {
  type: 'sacrificeCreature';
  target: 'opponent';
  /** "Opponent sacrifices TWO creatures of their choice" (Braska's Final
   * Aeon's Ultimate Jecht Shot) - defaults to 1. Implemented by just queuing
   * the opponent's id this many times in resolveSacrificeQueue, so they pick
   * once per copy. */
  count?: number;
  /** "Sacrifices A PERMANENT of their choice" (Kefka, Court Mage's "8: Each
   * opponent sacrifices a permanent of their choice") - defaults to
   * 'creature' for backward compatibility with the original wording. */
  filter?: 'creature' | 'anyPermanent';
}

/** "Each player sacrifices a [creature token / nontoken creature /
 * enchantment] of their choice" (Gaius van Baelsar) - the generalized
 * "each player, a nontoken creature, etc." case the SacrificeCreatureEffect
 * doc comment above flagged as not yet handled. Shares GameState.pendingSacrifice
 * and engine/actions.ts: chooseSacrifice with SacrificeCreatureEffect, just
 * queues every player (not only the opponent) and allows a broader filter. */
export interface EachPlayerSacrificesEffect {
  type: 'eachPlayerSacrifices';
  filter: 'creatureToken' | 'nontokenCreature' | 'enchantment';
}

/**
 * "Exile a permanent card from your graveyard at random, then create a
 * tapped token that's a copy of that card" (Sin, Spira's Punishment) - see
 * engine/effects.ts: resolveCardEffects. `repeatOnLand` re-runs the whole
 * exile+copy step again as long as the card exiled that time was a land.
 */
export interface RandomGraveyardCopyEffect {
  type: 'randomGraveyardCopy';
  repeatOnLand: boolean;
}

/**
 * "Surveil N" - look at the top N cards of your library, then put any
 * number into the graveyard and the rest back on top in any order. See
 * GameState.pendingSurveil and engine/actions.ts: resolveSurveil.
 */
export interface SurveilEffect {
  type: 'surveil';
  count: number;
  /** "Surveil N, then draw a card" (Dreams of Laguna) - folded into THIS
   * effect (rather than a separate LootEffect run afterward in the same
   * onCast array) because the draw must see the library AFTER the surveil's
   * keep/graveyard choice is actually made; a separate effect earlier in the
   * list would draw before that choice resolves and could pull the wrong
   * card. See engine/actions.ts: resolveSurveil. */
  thenDrawCount?: number;
}

/**
 * "Mill N cards, then return a permanent card from your graveyard to your
 * hand" (Vanille, Cheerful l'Cie) - the return is from the WHOLE graveyard,
 * not just the newly milled cards, and is mandatory if any permanent card is
 * available. See GameState.pendingReturnFromGraveyard and engine/actions.ts:
 * returnFromGraveyard.
 */
export interface MillThenReturnEffect {
  type: 'millThenReturn';
  millCount: number;
}

/**
 * "Draw a card, then discard a card" (Emet-Selch, Unsundered and many other
 * cards using this template) - the draw is immediate and unconditional; the
 * discard is a mandatory player choice from the whole hand (not necessarily
 * the card just drawn), skipped only if the hand is already empty. See
 * GameState.pendingDiscard and engine/actions.ts: discardCard.
 */
export interface LootEffect {
  type: 'loot';
  drawCount: number;
  discardCount: number;
}

/** "You gain N life" (Adventurer's Inn and many other cards). */
export interface GainLifeEffect {
  type: 'gainLife';
  amount: number;
}

/**
 * "You may return another permanent you control to its owner's hand"
 * (Ambrosia Whiteheart) - optional, so a decline option (RESOLVE_OPTIONAL_BOUNCE
 * with instanceId: null) sits alongside picking a target. See
 * GameState.pendingOptionalBounce and engine/actions.ts: resolveOptionalBounce.
 */
export interface OptionalBounceEffect {
  type: 'optionalBounce';
}

/**
 * "Attacking creatures get +X/+Y until end of turn" (Auron's Inspiration) -
 * applies engine/combat.ts's temporary-buff mechanism (see
 * CardInstance.temporaryBuff) to every currently-declared attacker, whoever
 * controls them.
 */
export interface PumpAttackersEffect {
  type: 'pumpAttackers';
  power: number;
  toughness: number;
}

/**
 * "Look at the top N cards of your library. You may reveal a [filterType]
 * card from among them and put it into your hand. Put the rest on the
 * bottom of your library in a random order." (Ashe, Princess of Dalmasca) -
 * a single optional pick restricted to one card type, unlike
 * RevealAndDivideEffect's fixed alternating-picks sequence. See
 * GameState.pendingRevealFiltered and engine/actions.ts: resolveRevealFiltered.
 */
export interface RevealFilteredEffect {
  type: 'revealFiltered';
  count: number;
  /** A single type, or "any of these" (e.g. Commune with Beavers: "an
   * artifact, creature, or land card"). */
  filterType: CardType | CardType[];
}

/**
 * "[This creature] deals damage equal to the number of equipped creatures
 * you control to defending player" (Barret Wallace, onAttack) - counts
 * creatures the controller has on the battlefield with at least one
 * Equipment (an artifact whose subtype text contains "Equipment" - there's
 * no dedicated boolean field for this) attached, and deals that much damage
 * directly to the opponent. No target needed - "defending player" is just
 * the one opponent in this 2-player engine.
 */
export interface DamageEqualToEquippedCreaturesEffect {
  type: 'damageEqualToEquippedCreatures';
}

/** "Search your library for a [landName] card, reveal it, put it into your
 * hand, then shuffle" (Call the Mountain Chocobo) - the same search-by-name
 * logic as CyclingAbility.searchLandName, resolved as an onCast effect
 * instead of a hand-discard cost. */
export interface SearchLibraryForLandEffect {
  type: 'searchLibraryForLand';
  landName: string;
}

/** "Target creature gets +X/+Y (and gains [grantKeyword]) until end of turn"
 * (Blitzball Shot) - a SINGLE chosen target, unlike PumpAttackersEffect
 * (every currently-declared attacker). No controller restriction is stated
 * on the card, so any creature either player controls is a legal target -
 * same as DestroyTargetEffect. See CardInstance.temporaryKeywords. */
export interface PumpTargetEffect {
  type: 'pumpTarget';
  power: number;
  toughness: number;
  grantKeyword?: string;
}

/** "Another target creature you control gets +X/+Y (and gains
 * [grantKeyword]) until end of turn" (Gladiolus Amicitia's Landfall) - the
 * "you control, and not the source itself" counterpart to PumpTargetEffect
 * (which has no controller restriction and doesn't exclude the source). */
export interface PumpAnotherControlledCreatureEffect {
  type: 'pumpAnotherControlledCreature';
  power: number;
  toughness: number;
  grantKeyword?: string;
}

/** "Whenever [this creature] attacks, other attacking creatures gain
 * [keyword] until end of turn" (Cecil, Redeemed Paladin's Protect) - applies
 * to every OTHER currently-declared attacker. See CardInstance.temporaryKeywords. */
export interface GrantKeywordToOtherAttackersEffect {
  type: 'grantKeywordToOtherAttackers';
  keyword: string;
}

/** "You lose N life" (Circle of Power) - unlike a negative GainLifeEffect,
 * this deliberately does NOT run onGainLifeTrigger (losing life isn't
 * gaining it). */
export interface LoseLifeEffect {
  type: 'loseLife';
  amount: number;
}

/** "[Subtype]s you control get +X/+Y (and gain [grantKeyword]) until end of
 * turn" (Circle of Power's "Wizards you control get +1/+0 and gain lifelink
 * until end of turn.") - matched case-insensitively against each creature's
 * subtype text, unlike PumpAttackersEffect (every declared attacker,
 * regardless of subtype) or PumpTargetEffect (one chosen target). */
export interface PumpControlledSubtypeEffect {
  type: 'pumpControlledSubtype';
  subtype: string;
  power: number;
  toughness: number;
  grantKeyword?: string;
}

/** "Put N counters of [counterLabel] on target creature" (Cloudbound
 * Moogle) - a single chosen target, no controller restriction stated on the
 * card (same as PumpTargetEffect/DestroyTargetEffect). */
export interface PutCounterOnTargetEffect {
  type: 'putCounterOnTarget';
  counterLabel: string;
  counterAmount: number;
}

/** "Target creature an opponent controls gets -X/-X until end of turn,
 * where X is the number of permanent cards in your graveyard" (Cloud of
 * Darkness's Particle Beam) - powerPerUnit/toughnessPerUnit are multiplied
 * by the controller's permanent-card graveyard count at resolution time.
 * Opponent-only targeting, like TapAndStunEffect. */
export interface DebuffTargetByGraveyardEffect {
  type: 'debuffTargetByGraveyard';
  powerPerUnit: number;
  toughnessPerUnit: number;
}

/** "[This creature] fights up to one other target creature" (Ifrit, Warden
 * of Inferno's Lunge) - the source itself is one participant; `optional:
 * true` means "up to one" (the controller may decline to pick a target at
 * all - see engine/actions.ts: chooseTarget, GameAction 'CHOOSE_TARGET'
 * with targetInstanceId: null). No controller restriction on the target -
 * either player's creature is legal, matching the card's plain "target
 * creature" wording. See engine/combat.ts: resolveFight. */
export interface SelfFightTargetEffect {
  type: 'selfFightTarget';
  optional: boolean;
}

/** "Target creature you control fights target creature an opponent
 * controls" (Clash of the Eikons) - two independently-chosen, restricted
 * targets (unlike SelfFightTargetEffect, the source itself never
 * participates). Resolved as a two-step pick - see GameState.pendingTarget's
 * optional `firstInstanceId`. */
export interface ChooseCreaturesFightEffect {
  type: 'chooseCreaturesFight';
}

/** "Put/remove a lore counter on/from target Saga you control" (Clash of
 * the Eikons) - target restricted to a Saga (def.saga set) the CONTROLLER
 * controls. delta: 1 goes through the normal chapter-trigger check
 * (engine/effects.ts: triggerSagaLoreCounter); delta: -1 does NOT (per the
 * card's own reminder text: "Removing lore counters doesn't cause chapter
 * abilities to trigger."). */
export interface ModifySagaLoreCounterEffect {
  type: 'modifySagaLoreCounter';
  delta: 1 | -1;
}

/** "You may discard your hand, then draw cards equal to your devotion to
 * [color]" (Clive, Ifrit's Dominant) - devotion is the total count of that
 * color's mana symbols across the printed mana costs of permanents the
 * controller controls. "You may" - see GameState.pendingOptionalDiscardHandForDevotion
 * and GameAction 'RESOLVE_OPTIONAL_DISCARD_HAND_FOR_DEVOTION'. */
export interface DiscardHandThenDrawByDevotionEffect {
  type: 'discardHandThenDrawByDevotion';
  color: ManaColor;
}

/** "Add [colors]" (Ifrit, Warden of Inferno's Brimstone chapter) - adds
 * straight to the controller's mana pool, additively per color. */
export interface AddManaEffect {
  type: 'addMana';
  colors: Partial<Record<ManaColor, number>>;
}

/** "If [this Saga] has [minLore] or more lore counters on it, exile it,
 * then return it to the battlefield (front face up)" (Ifrit, Warden of
 * Inferno's Brimstone chapter) - reads the SOURCE's current lore-counter
 * total (already incremented by the triggerSagaLoreCounter call that
 * resolved this chapter) and, if it meets the threshold, exiles the source
 * and creates a new permanent of its transformsInto face entering the
 * battlefield in its place. See engine/effects.ts: exileAndReturnTransformed. */
export interface ExileAndReturnTransformedSelfIfLoreAtLeastEffect {
  type: 'exileAndReturnTransformedSelfIfLoreAtLeast';
  minLore: number;
}

/** "EXILE this permanent, then return it to the battlefield transformed"
 * (Bahamut, Warden of Light's Gigaflare) - the unconditional counterpart to
 * ExileAndReturnTransformedSelfIfLoreAtLeastEffect, for a Saga chapter (or
 * any other effect context) that always flips back, no threshold check. */
export interface ExileAndReturnTransformedSelfEffect {
  type: 'exileAndReturnTransformedSelf';
}

/** "Tap target [creature]" (Coeurl) - no stun counter, unlike
 * TapAndStunEffect. No controller restriction stated. "Nonenchantment" isn't
 * separately tracked as a distinction anywhere in this engine, so any
 * creature is treated as a legal target. */
export interface TapTargetEffect {
  type: 'tapTarget';
}

/** "When [this] enters, choose one — ..." (Coliseum Behemoth) - unlike
 * SpellMode arrays used by a modal SPELL (CardDefinition.chooseModes, which
 * lets the caster pick ANY NONEMPTY SUBSET at cast time), this is a single,
 * EXACTLY-one pick made via a pending choice at effect-resolution time -
 * usable from any CardEffect context (onEnter, onAttack, ability effects,
 * Saga chapters, ...). See GameState.pendingChooseOneMode and GameAction
 * 'RESOLVE_CHOOSE_ONE_MODE'. */
export interface ChooseOneModeEffect {
  type: 'chooseOneMode';
  modes: SpellMode[];
}

/** "Target player draws N cards" (Combat Tutorial) - the first effect in
 * this engine to target a PLAYER rather than a permanent. See
 * GameState.pendingPlayerTarget and GameAction 'CHOOSE_PLAYER_TARGET'. */
export interface DrawCardsFromTargetPlayerEffect {
  type: 'drawCardsFromTargetPlayer';
  count: number;
}

/** "Put N counters of [counterLabel] on up to one target creature you
 * control" (Combat Tutorial) - like PutCounterOnTargetEffect, but the pick
 * is OPTIONAL (declinable via CHOOSE_TARGET's targetInstanceId: null, same
 * as SelfFightTargetEffect.optional) and restricted to the controller's own
 * creatures. */
export interface PutCounterOnUpToOneOwnCreatureEffect {
  type: 'putCounterOnUpToOneOwnCreature';
  counterLabel: string;
  counterAmount: number;
}

/** "When this Equipment enters, attach it to target creature you control[,
 * granting it grantKeyword until end of turn]" (Coral Sword) - restricted
 * to the controller's own creatures, unlike a normal manual Attach. */
export interface AttachSelfToTargetEffect {
  type: 'attachSelfToTarget';
  grantKeyword?: string;
}

/** "Reveal the top card of your library and put it into your hand. You
 * lose life equal to its mana value." (Dark Confidant) - a fixed, narrow
 * combo of draw-then-lose-life-by-cost, used from an onOwnUpkeep trigger. */
export interface RevealTopThenLoseLifeByManaValueEffect {
  type: 'revealTopThenLoseLifeByManaValue';
}

/** "Destroy target creature an opponent controls" (Deadly Embrace) -
 * opponent-only, creature-only, distinct from DestroyTargetEffect's
 * no-restriction filters. */
export interface DestroyOpponentCreatureEffect {
  type: 'destroyOpponentCreature';
  /** "Then draw a card for each creature that died this turn" (Deadly
   * Embrace) - folded into THIS effect (rather than a separate
   * DrawForCreaturesDiedThisTurnEffect run afterward) because the destroy
   * itself only actually happens once the player picks a target via
   * CHOOSE_TARGET; a separate effect earlier in the same onCast array would
   * read GameState.creaturesDiedThisTurn before this creature's own death
   * had been counted. See engine/actions.ts: chooseTarget's
   * destroyOpponentCreature branch. */
  thenDrawForCreaturesDiedThisTurn?: boolean;
}

/** "Draw a card for each creature that died this turn" as a standalone
 * effect (not preceded by a destroy in the same instruction) - reads
 * GameState.creaturesDiedThisTurn, incremented once by every death this
 * engine processes (see engine/combat.ts: moveCreaturesToGraveyard), reset
 * at the cleanup step. */
export interface DrawForCreaturesDiedThisTurnEffect {
  type: 'drawForCreaturesDiedThisTurn';
}

/** "Put N counters of [counterLabel] on this creature" (Demon Wall's "5B:
 * Put two +1/+1 counters on this creature.") - unlike PutCounterOnTargetEffect,
 * this needs no target at all; it always applies to the source itself. */
export interface PutCounterOnSelfEffect {
  type: 'putCounterOnSelf';
  counterLabel: string;
  counterAmount: number;
}

/** "Put N counters of [counterLabel] on each OTHER creature you control[.
 * Those creatures gain grantKeyword until end of turn]" (Bahamut, Warden of
 * Light's Wings of Light) - like PumpControlledSubtypeEffect, but applies to
 * every OTHER creature regardless of subtype, and adds counters instead of
 * a temporary stat buff. */
export interface BuffOtherCreaturesYouControlEffect {
  type: 'buffOtherCreaturesYouControl';
  counterLabel?: string;
  counterAmount?: number;
  grantKeyword?: string;
  /** "Other creatures you control get +X/+Y until end of turn" (Summon:
   * Choco/Mog's Stampede!) - a temporary buff alternative to counterLabel/
   * counterAmount's permanent counter, applied via applyTemporaryBuff. */
  power?: number;
  toughness?: number;
}

/** "Return target nonland permanent to its owner's hand" (Eject) - unlike
 * OptionalBounceEffect (self only, no target, decline-able), this targets
 * any nonland permanent via the normal pendingTarget/CHOOSE_TARGET flow. */
export interface BounceTargetEffect {
  type: 'bounceTarget';
  targetFilter: 'nonland';
}

/** "Shuffle all nonland cards from your graveyard into your library. You
 * gain life equal to the number of cards shuffled into your library this
 * way." (Elixir) - immediate, no targeting. */
export interface ShuffleGraveyardIntoLibraryEffect {
  type: 'shuffleGraveyardIntoLibrary';
  filter: 'nonland';
}

/** "Return target creature card from your graveyard to the battlefield[,
 * with N additional +1/+1 counters on it]" (Evil Reawakened) - a new pending
 * flow (GameState.pendingReanimate) since the target lives in the
 * controller's OWN graveyard rather than being a battlefield permanent, so
 * it can't reuse pendingTarget's battlefield-only assumptions. */
export interface ReanimateTargetFromGraveyardEffect {
  type: 'reanimateTargetFromGraveyard';
  extraCounterLabel?: string;
  extraCounterAmount?: number;
}

/** "Draw a card for each [cardType] you control" (Edgar, King of Figaro's
 * "for each artifact you control") - immediate, no targeting. */
export interface DrawCardsEqualToControlledTypeCountEffect {
  type: 'drawCardsEqualToControlledTypeCount';
  cardType: CardType;
}

/** "At the beginning of your end step, if there are N or more permanent
 * cards in your graveyard, transform [this]" (Exdeath, Void Warlock) - an
 * in-place defId swap (like CardAbility.transformSelf), not a real
 * exile-and-return zone change. Meant for CardDefinition.onOwnEndStep. */
export interface TransformSelfIfGraveyardSizeAtLeastEffect {
  type: 'transformSelfIfGraveyardSizeAtLeast';
  minGraveyardSize: number;
}

/** "Return up to N target creature cards from your graveyard to your hand"
 * (Fight On!) - a new pending flow (GameState.pendingReturnCreaturesFromGraveyard)
 * letting the controller pick creature cards from their own graveyard one at
 * a time, up to `count`, declining early at any point (unlike
 * ReanimateTargetFromGraveyardEffect, which is a single mandatory pick). */
export interface ReturnCreaturesFromGraveyardToHandEffect {
  type: 'returnCreaturesFromGraveyardToHand';
  count: number;
}

/** "When [this] dies, put it on the bottom of its owner's library" (Chaos,
 * the Endless) - meant for CardDefinition.onDeath. The instance is already
 * sitting in the graveyard by the time onDeath fires, so this just moves it
 * one zone further rather than needing any death-pipeline hook of its own. */
export interface PutSelfOnBottomOfLibraryEffect {
  type: 'putSelfOnBottomOfLibrary';
}

/** "Each opponent discards a card" (Hecteyes) - reuses the same
 * GameState.pendingDiscard/DISCARD_CARD flow as LootEffect's discard step,
 * just with the OPPONENT as the one who has to pick (this engine is
 * 2-player, so "each opponent" is just the one). */
export interface EachOpponentDiscardsEffect {
  type: 'eachOpponentDiscards';
  count: number;
}

/** "You draw a card" (Braska's Final Aeon's Jecht Beam chapters) - no
 * existing CardEffect is a plain, unconditional "draw N cards" (every other
 * draw-shaped effect here is conditional on something), so this fills that
 * gap for chaining after e.g. EachOpponentDiscardsEffect in the same
 * chapter/effects list. */
export interface DrawCardsEffect {
  type: 'drawCards';
  amount: number;
}

/** "Until end of turn, this creature gets +X/+Y for each permanent card in
 * your graveyard" (Gran Pulse Ochu) - the self, positive, temporary-buff
 * counterpart to DebuffTargetByGraveyardEffect (which targets an opponent's
 * creature negatively and permanently isn't quite right either - this one
 * uses applyTemporaryBuff so it clears at cleanup like other "until end of
 * turn" effects). Meant for a CardAbility.effects entry. */
export interface PumpSelfByGraveyardCountEffect {
  type: 'pumpSelfByGraveyardCount';
  powerPerUnit: number;
  toughnessPerUnit: number;
}

/** "Each opponent mills X cards, where X is the amount of life you gained
 * this turn" (Hope Estheim) - reads PlayerState.lifeGainedThisTurn. Meant
 * for CardDefinition.onOwnEndStep. */
export interface MillOpponentByLifeGainedThisTurnEffect {
  type: 'millOpponentByLifeGainedThisTurn';
}

/** "Whenever this creature attacks, it gets +X/+Y until end of turn" (Jumbo
 * Cactuar's "10,000 Needles") - a fixed self buff, unlike
 * PumpSelfByGraveyardCountEffect's dynamic scaling. Uses the same
 * applyTemporaryBuff mechanism, so it clears at cleanup like other "until
 * end of turn" effects. */
export interface PumpSelfEffect {
  type: 'pumpSelf';
  power: number;
  toughness: number;
}

/** "Exile target card from a graveyard. If a creature card was exiled this
 * way, create a Food token." (Ignis Scientia) - targets any single card in
 * EITHER player's graveyard via the normal pendingTarget flow, but the
 * target is a graveyard CARD rather than a battlefield permanent, so it
 * needs its own pending state (like ReanimateTargetFromGraveyardEffect) -
 * see GameState.pendingGraveyardExile. */
export interface ExileTargetGraveyardCardEffect {
  type: 'exileTargetGraveyardCard';
  createFoodTokenIfCreature?: boolean;
}

/** "[This] deals N damage to each opponent" (Phoenix, Warden of Fire's
 * Rising Flames) as a plain immediate CardEffect (unlike
 * NoncreatureCastTrigger.damageEachOpponent, which is a passive trigger
 * field) - usable from a Saga chapter or any other CardEffect list. Goes
 * through the shared loseLife tracker so Kefka, Ruler of Ruin-style
 * "whenever an opponent loses life" watchers still see it. */
export interface DealDamageToEachOpponentEffect {
  type: 'dealDamageToEachOpponent';
  amount: number;
}

/** "Tap all lands your opponents control" (Shiva, Warden of Ice's Cold
 * Snap) - immediate, no targeting. */
export interface TapAllOpponentLandsEffect {
  type: 'tapAllOpponentLands';
}

/** "Return up to one OTHER target nonland permanent to its owner's hand"
 * (Jill, Shiva's Dominant) - like BounceTargetEffect, but "up to one"
 * (decline-able via the null-target convention) and excludes the source
 * itself. */
export interface BounceUpToOneOtherNonlandPermanentEffect {
  type: 'bounceUpToOneOtherNonlandPermanent';
}

/** "Put a number of +1/+1 counters equal to [this creature]'s power on up
 * to one OTHER target creature" (Jenova, Ancient Calamity) - the counter
 * amount is read from the SOURCE's own current power at resolution time,
 * unlike PutCounterOnUpToOneOwnCreatureEffect's fixed amount. Doesn't
 * restrict the target to creatures the controller owns (Jenova's wording
 * has no "you control"). */
export interface PutCounterOnUpToOneOtherCreatureEqualToOwnPowerEffect {
  type: 'putCounterOnUpToOneOtherCreatureEqualToOwnPower';
  counterLabel: string;
}

/** "Discard up to two cards, then draw that many cards" (Joshua, Phoenix's
 * Dominant) - unlike LootEffect (mandatory draw N, then discard N), the
 * discard comes FIRST and is itself "up to" (optional/partial), and the
 * draw afterward is however many were actually discarded, not a fixed
 * number. Needs its own pending flow - see GameState.pendingDiscardUpToThenDraw. */
export interface DiscardUpToThenDrawThatManyEffect {
  type: 'discardUpToThenDrawThatMany';
  maxCount: number;
}

/** "Deals 5 damage to target creature and X damage to that creature's
 * controller, where X is the number of Equipment you control" (Judgment
 * Bolt) - the controller-damage amount is computed from the CASTER's own
 * battlefield at resolution time, not the target's. */
export interface DamageTargetAndControllerByEquipmentCountEffect {
  type: 'damageTargetAndControllerByEquipmentCount';
  damageToCreature: number;
}

/** "At the beginning of your end step, ..., then if you control N or more
 * [subtype]s, transform [this]" (Kuja, Genome Sorcerer) - the subtype-count
 * counterpart to TransformSelfIfGraveyardSizeAtLeastEffect. Subtype is
 * matched case-insensitively against CardDefinition.subtype the same way
 * PumpControlledSubtypeEffect already does. */
export interface TransformSelfIfControlledSubtypeCountAtLeastEffect {
  type: 'transformSelfIfControlledSubtypeCountAtLeast';
  subtype: string;
  minCount: number;
}

export type CardEffect =
  | CreateTokenEffect
  | TapAndStunEffect
  | DestroyTargetEffect
  | RevealAndDivideEffect
  | ChooseManaColorEffect
  | SacrificeCreatureEffect
  | RandomGraveyardCopyEffect
  | SurveilEffect
  | MillThenReturnEffect
  | LootEffect
  | GainLifeEffect
  | OptionalBounceEffect
  | PumpAttackersEffect
  | RevealFilteredEffect
  | DamageEqualToEquippedCreaturesEffect
  | SearchLibraryForLandEffect
  | PumpTargetEffect
  | GrantKeywordToOtherAttackersEffect
  | LoseLifeEffect
  | PumpControlledSubtypeEffect
  | PutCounterOnTargetEffect
  | DebuffTargetByGraveyardEffect
  | SelfFightTargetEffect
  | ChooseCreaturesFightEffect
  | ModifySagaLoreCounterEffect
  | DiscardHandThenDrawByDevotionEffect
  | AddManaEffect
  | ExileAndReturnTransformedSelfIfLoreAtLeastEffect
  | ExileAndReturnTransformedSelfEffect
  | TapTargetEffect
  | ChooseOneModeEffect
  | DrawCardsFromTargetPlayerEffect
  | PutCounterOnUpToOneOwnCreatureEffect
  | AttachSelfToTargetEffect
  | RevealTopThenLoseLifeByManaValueEffect
  | DestroyOpponentCreatureEffect
  | DrawForCreaturesDiedThisTurnEffect
  | PutCounterOnSelfEffect
  | BuffOtherCreaturesYouControlEffect
  | EachPlayerSacrificesEffect
  | BounceTargetEffect
  | ShuffleGraveyardIntoLibraryEffect
  | ReanimateTargetFromGraveyardEffect
  | DrawCardsEqualToControlledTypeCountEffect
  | TransformSelfIfGraveyardSizeAtLeastEffect
  | ReturnCreaturesFromGraveyardToHandEffect
  | PutSelfOnBottomOfLibraryEffect
  | EachOpponentDiscardsEffect
  | PumpSelfByGraveyardCountEffect
  | MillOpponentByLifeGainedThisTurnEffect
  | PumpSelfEffect
  | ExileTargetGraveyardCardEffect
  | DealDamageToEachOpponentEffect
  | TapAllOpponentLandsEffect
  | BounceUpToOneOtherNonlandPermanentEffect
  | PutCounterOnUpToOneOtherCreatureEqualToOwnPowerEffect
  | DiscardUpToThenDrawThatManyEffect
  | DamageTargetAndControllerByEquipmentCountEffect
  | TransformSelfIfControlledSubtypeCountAtLeastEffect
  | DrawCardsEffect
  | PumpAnotherControlledCreatureEffect
  | DamageTargetCreatureEffect;

/** One mode of a "Choose one or more —" modal spell (e.g. Clash of the
 * Eikons) - the caster picks any NONEMPTY subset of modes at cast time (see
 * GameAction 'CAST_CARD's chosenModeIndices), and every chosen mode's
 * effects resolve in the order the modes are printed, regardless of pick
 * order. See engine/actions.ts: castCard. */
export interface SpellMode {
  label: string;
  effects: CardEffect[];
}

/**
 * "[Basic land type]cycling N" and plain "Cycling N" - discard this card
 * from hand, pay N, and either search for a copy of that basic land type
 * (put into hand, then shuffle) or, with no land type, just draw a card.
 */
export interface CyclingAbility {
  cost: string;
  searchLandName?: 'Plains' | 'Island' | 'Swamp' | 'Mountain' | 'Forest';
}

/**
 * A static, continuously-checked buff ("As long as you control N or more
 * lands, this creature gets +X/+Y") - unlike onEnter/onCast, this isn't a
 * one-time trigger; it's re-evaluated live wherever power/toughness matters
 * (engine/combat.ts, and the client's own combat preview), so it turns on
 * and off automatically as the land count crosses the threshold.
 */
export interface LandCountBuff {
  minLands: number;
  power: number;
  toughness: number;
}

/** Cast this from the graveyard once, for this cost, then exile it instead of it going to the graveyard again. */
export interface FlashbackAbility {
  cost: string;
}

/**
 * Landfall - fires once each time ANY land the controller controls enters
 * (not just this permanent itself), for as long as this permanent stays on
 * the battlefield. See engine/effects.ts: triggerLandfall, called from
 * engine/actions.ts right after a land is played. Only "put N counters of
 * this label on this permanent" is implemented - the only landfall payout
 * among the cards that need it so far.
 */
export interface LandfallTrigger {
  counterLabel?: string;
  counterAmount?: number;
  /** Alternative payout to counters - "gets +X/+Y until end of turn" (e.g.
   * Ambrosia Whiteheart, the Bird token). Uses the same temporary-buff
   * mechanism as PumpAttackersEffect. Exactly one of counterLabel,
   * temporaryBuff, or createTokenId should be set. */
  temporaryBuff?: { power: number; toughness: number };
  /** Alternative payout - "create a [tokenId] token" (e.g. Chocobo
   * Racetrack). Resolved by re-running the same createToken CardEffect used
   * by onEnter/onCast - see engine/effects.ts: triggerLandfall. */
  createTokenId?: string;
  /** Alternative payout - "another target creature you control gets +X/+Y
   * (and gains [grantKeyword]) until end of turn" (Gladiolus Amicitia) -
   * unlike PumpTargetEffect (no controller restriction, any creature),
   * this is restricted to a creature the SAME controller owns, and excludes
   * the landfall permanent itself ("another"). Resolved via
   * PumpAnotherControlledCreatureEffect - see engine/effects.ts:
   * triggerLandfall. */
  pumpAnotherControlledCreature?: { power: number; toughness: number; grantKeyword?: string };
}

/**
 * Fires once each time the controller casts a noncreature spell (instant,
 * sorcery, artifact, or enchantment - not a creature and not a land, which
 * isn't "casting a spell" at all), for as long as this permanent/token
 * stays on the battlefield. See engine/effects.ts: triggerNoncreatureCastAbilities.
 * Only "deal N damage to each opponent" is implemented (the Wizard token).
 */
export interface NoncreatureCastTrigger {
  /** Unconditional "deal N damage to each opponent" (e.g. the Wizard token). */
  damageEachOpponent?: number;
  /** "If at least [minManaValue] mana was spent casting it, put N counters of
   * this label on THIS permanent" (e.g. Blazing Bomb) - unlike
   * damageEachOpponent, this is a self-buff conditioned on how much mana the
   * triggering spell actually cost. See engine/actions.ts: castCard/
   * castFromGraveyard, which compute the mana spent and pass it into
   * triggerNoncreatureCastAbilities. */
  counterIfExpensive?: { minManaValue: number; counterLabel: string; counterAmount: number };
  /** "Whenever you cast a noncreature spell, surveil N" (Garland, Knight of
   * Cornelia) - reuses the same pendingSurveil flow as SurveilEffect. */
  surveilCount?: number;
}

/** One chapter ability of a Saga - `numbers` is usually a single chapter
 * number, but some Sagas share one ability across a range (e.g. Ifrit,
 * Warden of Inferno's "II, III — Brimstone"). Fires once a lore counter
 * placed on the Saga brings its lore-counter total to (one of) these
 * numbers. See SagaAbility, engine/effects.ts: triggerSagaLoreCounter. */
export interface SagaChapter {
  numbers: number[];
  effects: CardEffect[];
}

/**
 * "Saga" - a lore counter (an ordinary Counter entry labeled 'lore', not a
 * separate CardInstance field) is put on the Saga once as it enters the
 * battlefield, and again as its controller's precombat main phase begins
 * each turn. Each placement checks whether the new total matches a
 * SagaChapter's `numbers`, and if so resolves that chapter's `effects` (the
 * same CardEffect machinery as onEnter/onCast). See engine/effects.ts:
 * triggerSagaLoreCounter, called from engine/actions.ts's castCard/
 * castFromGraveyard (the initial counter) and nextPhase (the precombat
 * main-phase counter).
 */
export interface SagaAbility {
  chapters: SagaChapter[];
  /** A classic (non-creature) Saga sacrifices itself once its final
   * chapter's effects finish resolving - defaults to true unless this Saga
   * is ALSO a creature (e.g. Ifrit, Warden of Inferno), where that rule
   * doesn't apply and the card's own last-chapter effect governs its fate
   * instead. Set explicitly to false to opt a non-creature Saga out too. */
  sacrificeAfterFinalChapter?: boolean;
}

export interface CardDefinition {
  id: string;
  name: string;
  type: CardType;
  subtype?: string;
  costLabel: string;
  power?: number;
  toughness?: number;
  text: string;
  imagePath: string;
  transformsInto?: string;
  producesMana?: ManaColor | 'any' | ManaColor[];
  abilities?: CardAbility[];
  /** Marks this as an Aura or Equipment - what kind of permanent it can be
   * attached to. See CardInstance.attachedToInstanceId and
   * engine/actions.ts: attachCard/detachCard. */
  attachesTo?: 'creature' | 'artifact' | 'land' | 'enchantment' | 'permanent';
  /** Equipment only - mana cost to attach/reattach. Auras don't have this;
   * they attach for free once, right after casting, via the same Attach flow. */
  equipCost?: string;
  /** "Equipped creature gets +X/+Y" (e.g. Coral Sword) - a static buff applied
   * to whatever this Equipment is currently attached to. See
   * engine/combat.ts: effectivePower/effectiveToughness. Distinct from
   * landCountBuff (applies to the card itself, gated on land count rather
   * than attachment). */
  equipBuff?: { power: number; toughness: number };
  /** "During your turn, equipped creature has KEYWORD" (e.g. Dragoon's
   * Lance's flying) - unlike equipBuff this is conditional on whose turn it
   * is, so it's checked separately (see engine/actions.ts: declareBlockers)
   * rather than folded into hasKeywordEffective, which has no GameState to
   * check turn ownership with. Only "flying" is actually consumed anywhere
   * today (the one place a granted keyword changes legality), but it's typed
   * as a free string for whatever keyword a future card like this grants. */
  equipGrantsKeywordDuringOwnTurn?: string;
  /** Fires once, automatically, when this permanent enters the battlefield. */
  onEnter?: CardEffect[];
  /** Fires once, automatically, when this instant/sorcery resolves (right
   * before it goes to the graveyard). */
  onCast?: CardEffect[];
  /** Fires once, automatically, whenever this creature is declared as an
   * attacker. See engine/actions.ts: declareAttackers. */
  onAttack?: CardEffect[];
  /** "Cycling" family - activated from hand, see engine/actions.ts: cycleCard. */
  cycling?: CyclingAbility;
  /** See LandCountBuff - a static, always-on-condition-met power/toughness buff. */
  landCountBuff?: LandCountBuff;
  /** See FlashbackAbility - cast from the graveyard, see engine/actions.ts: castFromGraveyard. */
  flashback?: FlashbackAbility;
  /** "This land/creature/artifact enters tapped." - applied the moment this
   * permanent is moved onto the battlefield (engine/actions.ts: castCard),
   * instead of leaving it to the player to remember to tap it themselves.
   * Only covers the plain, unconditional wording - a few cards phrase this
   * conditionally ("...unless it's your first, second, or third turn") or
   * apply it to something other than themselves (search effects tutoring a
   * land onto the battlefield tapped); those still need to be handled by hand. */
  entersTapped?: boolean;
  /** See LandfallTrigger. */
  landfall?: LandfallTrigger;
  /** See NoncreatureCastTrigger. */
  noncreatureCastTrigger?: NoncreatureCastTrigger;
  /** "When this creature transforms into [this], take an extra turn after
   * this one" (e.g. Ultimecia, Omnipotent's Time Compression) - checked
   * against the BACK face's own definition, whichever way the transform
   * happened (a paid transformSelf ability or a free FLIP_CARD), and queued
   * onto GameState.extraTurnsQueued. See engine/actions.ts: flipCard,
   * activateAbility, endTurn. */
  grantsExtraTurnOnTransform?: boolean;
  /** "Whenever you gain life, put N counters of this label on THIS permanent"
   * (e.g. Aerith Gainsborough) - fires off any life gain (lifelink combat
   * damage or a gainLife effect), for as long as this permanent stays on the
   * battlefield. See engine/combat.ts: applyGainLifeTriggers. Manual life
   * changes under Mutual Adjustment deliberately don't trigger this. */
  onGainLifeTrigger?: { counterLabel: string; counterAmount: number };
  /** "When this creature dies, put X counters of this label on each
   * [targetFilter] creature you control, where X is the number of counters
   * of this label THIS creature had" (e.g. Aerith Gainsborough) - read at
   * the moment of death, before it leaves the battlefield. See
   * engine/combat.ts: moveCreaturesToGraveyard. Only 'legendary' (subtype
   * text contains "Legendary Creature") is implemented as a target filter. */
  onDeathDistributeCounters?: { counterLabel: string; targetFilter: 'legendary' };
  /** Static ability: every OTHER permanent this card's controller controls
   * gains this as its own producesMana, as long as it doesn't already have
   * one of its own (e.g. A Realm Reborn's "Other permanents you control have
   * Tap: Add one mana of any color"). See engine/mana.ts: effectiveProducesMana. */
  grantsManaAbilityToOthers?: ManaColor | 'any' | ManaColor[];
  /** Equipment only: the equipped creature's base power and toughness are
   * set to the controller's current life total (before any +1/+1 / -1/-1
   * counters or other buffs are applied on top) - e.g. Aettir and Priwen.
   * See engine/combat.ts: effectivePower/effectiveToughness. */
  setsBasePowerToughnessToControllerLife?: boolean;
  /** "Whenever this creature or another creature or artifact you control
   * dies, target opponent loses X life and you gain Y life" (Al Bhed
   * Salvagers) - a death WATCHER: as long as any permanent with this field
   * is on the battlefield (checked on the pre-death snapshot, so it still
   * counts even if it's the one dying), every qualifying creature/artifact
   * death triggers it once. In this 2-player engine "target opponent" is
   * just the one opponent - no real choice to make. See
   * engine/combat.ts: moveCreaturesToGraveyard. */
  onAnyDeathDrain?: { opponentLifeLoss: number; controllerLifeGain: number };
  /** "Whenever one or more OTHER creatures and/or artifacts you control die,
   * draw a card. This ability triggers only once each turn." (G'raha Tia) -
   * same watcher shape as onAnyDeathDrain (checked in the same place), but
   * with its own once-per-turn limiter (CardInstance.onAnyDeathDrawUsedThisTurn)
   * since the payout itself is fixed (always exactly 1 card) rather than
   * scaling, so there's nothing to parameterize beyond "did this already
   * fire this turn". */
  onAnyDeathDraw?: boolean;
  /** "Whenever another creature or artifact you control dies, put a
   * [counterLabel] counter on [this]" (Judge Magister Gabranth) - same
   * watcher shape as onAnyDeathDrain, just puts a counter on the watcher
   * itself instead of changing life totals. */
  onAnyDeathCounterSelf?: { counterLabel: string; counterAmount: number };
  /** "Whenever [this] deals combat damage to a player, you may exile it,
   * then return it to the battlefield transformed" (Jecht, Reluctant
   * Guardian) - an optional reactive trigger, unlike every other automatic
   * trigger here, so it pauses on GameState.pendingOptionalTransform for a
   * yes/no choice (RESOLVE_OPTIONAL_TRANSFORM) instead of just firing. */
  onCombatDamageToPlayerMayTransform?: boolean;
  /** "At the beginning of combat on your turn, ..." (Jenova, Ancient
   * Calamity) - an AUTOMATIC trigger, same shape as onOwnUpkeep/onOwnEndStep
   * but gated on the 'combat_begin' phase instead. See engine/actions.ts:
   * nextPhase. */
  onOwnCombatBegin?: CardEffect[];
  /** "Whenever an opponent loses life during your turn, you draw that many
   * cards" (Kefka, Ruler of Ruin) - a reactive trigger fired at the moment
   * life is lost (not summed over the turn), only while it's this
   * permanent's controller's own turn. See engine/combat.ts: loseLife. */
  onOpponentLifeLossDuringYourTurn?: boolean;
  /** "If a [subtype] you control would deal damage to a permanent or player,
   * it deals double that damage instead" (Trance Kuja, Fate Defied's Flare
   * Star) - a static replacement effect, active for as long as this
   * permanent is on the battlefield. Matched case-insensitively against the
   * damage SOURCE's own CardDefinition.subtype, the same way
   * PumpControlledSubtypeEffect matches subtypes elsewhere. Covers combat
   * damage (both attacking and blocking) and NoncreatureCastTrigger's
   * damageEachOpponent; other damage-shaped effects aren't sourced from a
   * creature so this never applies to them. See engine/combat.ts:
   * damageMultiplierFor. */
  doublesSubtypeDamage?: string;
  /** "When this creature dies, exile it and create N tapped [tokenId]
   * tokens" (Ancient Adamantoise) - exiles instead of the normal graveyard
   * trip. See engine/combat.ts: moveCreaturesToGraveyard. */
  onDeathExileAndCreateTokens?: { tokenId: string; count: number };
  /** "{T}, Sacrifice this: ..." folded into a single tap (e.g. a Treasure
   * token's "Tap, Sacrifice this token: Add one mana of any color") - copied
   * onto every instance of this token as it's created (see engine/effects.ts:
   * resolveCardEffects's createToken branch, and engine/combat.ts:
   * moveCreaturesToGraveyard's onDeathExileAndCreateTokens branch). See
   * CardInstance.sacrificesOnTap for the actual runtime effect. */
  sacrificesOnTap?: boolean;
  /** "Crew N" (Vehicle mechanic) - an artifact with this set is a Vehicle:
   * normally just a non-creature artifact, but any number of OTHER creatures
   * the controller taps with total power >= this number turn it into an
   * artifact creature until end of turn (see CardInstance.crewedUntilEndOfTurn,
   * GameAction 'CREW_VEHICLE', and engine/combat.ts: isEffectivelyCreature,
   * which every combat-legality and death check goes through instead of a
   * plain `type === 'creature'` check). Crewing is untimed here, like every
   * other activated ability in this engine with no onlyDuringOwn* guard, and
   * the crewing creatures may have summoning sickness - tapping to crew
   * isn't attacking. A Vehicle can't crew itself. */
  crew?: number;
  /** "At the beginning of your end step, if this creature didn't enter the
   * battlefield this turn, return it to its owner's hand" (Cactuar) - reuses
   * CardInstance.summoningSick as the "entered this turn" signal (it's only
   * ever true for the rest of the turn a permanent entered, cleared at the
   * controller's own next untap step). See engine/actions.ts: nextPhase. */
  bounceSelfAtEndStepIfNotSummoningSick?: boolean;
  /** See SagaAbility. */
  saga?: SagaAbility;
  /** See SpellMode. Mutually exclusive with onCast - a modal spell's chosen
   * modes are what resolve instead. */
  chooseModes?: SpellMode[];
  /** "At the beginning of your upkeep, ..." as an AUTOMATIC trigger (unlike
   * CardAbility.onlyDuringOwnUpkeep, which just restricts an activated
   * ability's timing) - e.g. Dark Confidant. Fires once, right as the
   * controller's own upkeep begins. See engine/actions.ts: nextPhase. */
  onOwnUpkeep?: CardEffect[];
  /** "As long as this creature has a counter on it, it can attack as though
   * it didn't have defender" (Demon Wall) - checked alongside the normal
   * defender keyword wherever attack-legality is decided. */
  ignoresDefenderIfHasCounter?: boolean;
  /** "This spell costs 1 less to cast for each permanent card in your
   * graveyard" (Diamond Weapon) - reduces the GENERIC portion of the cost
   * (never below 0), applied in engine/actions.ts: castCard, before
   * checking affordability. */
  costReductionPerGraveyardPermanent?: number;
  /** "Prevent all combat damage that would be dealt to [this creature]"
   * (Diamond Weapon's Immune) - checked in engine/combat.ts: markDamage,
   * before any damage is marked (so deathtouch/lethal checks never see it). */
  preventsAllCombatDamage?: boolean;
  /** "When this creature dies, ..." as an AUTOMATIC trigger (Dwarven Castle
   * Guard) - fires once a creature actually reaches the graveyard via
   * engine/combat.ts: moveCreaturesToGraveyard (not for a replacement effect
   * like onDeathExileAndCreateTokens or a finality counter, which redirect
   * away from the graveyard entirely and never technically "die" here,
   * matching the same real-rules distinction creaturesDiedThisTurn uses). */
  onDeath?: CardEffect[];
  /** "At the beginning of your end step, ..." as an AUTOMATIC trigger
   * (Exdeath, Void Warlock) - same shape as onOwnUpkeep, just gated on the
   * 'end' phase instead. See engine/actions.ts: nextPhase. */
  onOwnEndStep?: CardEffect[];
  /** "As long as you control N or more permanents of [type], this creature
   * gets +X/+Y" (Gaelicat's "two or more artifacts") - the same static,
   * always-on-condition-met buff shape as landCountBuff, generalized to any
   * CardType instead of being hardcoded to lands. See
   * engine/combat.ts: effectivePower/effectiveToughness. */
  controlledTypeCountBuff?: { type: CardType; minCount: number; power: number; toughness: number };
  /** "Equipped creature gets +X/+Y for each [counterLabel] counter on this
   * Equipment" (Excalibur II, whose charge counters come from the existing
   * onGainLifeTrigger field) - unlike equipBuff (a fixed bonus), this reads
   * the EQUIPMENT's own counters, not the wielder's. See
   * engine/combat.ts: effectivePower/effectiveToughness. */
  equipBuffPerCounter?: { counterLabel: string; power: number; toughness: number };
  /** "During your turn, [this creature] has KEYWORD" (Freya Crescent's
   * Jump) - the self-only counterpart to equipGrantsKeywordDuringOwnTurn
   * (which reads an attached Equipment's grant instead of the permanent's
   * own). Checked at the same call site (engine/actions.ts: declareBlockers). */
  grantsSelfKeywordDuringOwnTurn?: string;
  /** "Equipped creature has KEYWORD" (Genji Glove's double strike) -
   * unconditional, unlike equipGrantsKeywordDuringOwnTurn. A string[] grants
   * more than one keyword at once (Samurai's Katana's trample AND haste).
   * See engine/combat.ts: hasEquipGrantedKeyword. */
  equipGrantsKeyword?: string | string[];
  /** "Whenever an artifact you control enters, ..." (Golbez, Crystal
   * Collector) - fires once per artifact entering the battlefield, for as
   * long as this permanent stays out. Checked at the main "a permanent
   * enters" call sites (engine/actions.ts: castCard, castFromGraveyard) -
   * not every conceivable path a permanent could appear on the battlefield
   * (e.g. token creation), which stays out of scope for now. */
  onAnyArtifactEnterTrigger?: CardEffect[];
}

export interface Counter {
  label: string;
  amount: number;
}

export interface CardInstance {
  instanceId: string;
  defId: string;
  ownerId: string;
  tapped: boolean;
  counters: Counter[];
  damageMarked: number;
  summoningSick: boolean;
  /** If set, this card (an Aura or Equipment) is attached to the battlefield
   * permanent with this instanceId. Cleared automatically if either card
   * leaves the battlefield - see engine/actions.ts and engine/combat.ts. */
  attachedToInstanceId?: string;
  /** Set while tapped, if tapping this card added mana to its owner's pool -
   * records which color, so untapping (before it's spent) correctly gives it
   * back instead of leaving phantom mana in the pool. See engine/actions.ts: toggleTap. */
  producedManaColor?: ManaColor;
  /** Set once, by a chooseManaColor onEnter effect (e.g. Crossroads Village) -
   * from then on this land always taps for this color, overriding whatever
   * its CardDefinition's own producesMana would otherwise say. See
   * engine/actions.ts: toggleTap. */
  chosenManaColor?: ManaColor;
  /** True for any token (created by a createToken or randomGraveyardCopy
   * effect) rather than a real card - see components/Card.tsx for the
   * "Token" badge this drives. */
  isToken?: boolean;
  /** Set for the rest of the turn once this creature has taken ANY nonzero
   * combat damage from a source with deathtouch - lethal regardless of how
   * much toughness is left (unless indestructible). See engine/combat.ts:
   * markDamage/markPendingDeaths. Reset to false alongside damageMarked
   * (cleanup step, or whenever a creature leaves and re-enters the battlefield). */
  tookDeathtouchDamage?: boolean;
  /** "Gets +X/+Y until end of turn" - a temporary power/toughness bonus on
   * top of everything else (counters, static buffs), cleared at the
   * cleanup step alongside damageMarked. See engine/combat.ts:
   * effectivePower/effectiveToughness, PumpAttackersEffect, LandfallTrigger. */
  temporaryBuff?: { power: number; toughness: number };
  /** "{T}, Sacrifice this: ..." folded into a single tap (e.g. a Treasure
   * token's "Tap, Sacrifice this token: Add one mana of any color") - once
   * this taps for mana, it's immediately moved to its owner's graveyard.
   * See engine/actions.ts: toggleTap. */
  sacrificesOnTap?: boolean;
  /** Set once this Vehicle has been successfully crewed (see
   * CardDefinition.crew) - makes it count as a creature until end of turn
   * (engine/combat.ts: isEffectivelyCreature), reverting at the cleanup
   * step alongside temporaryBuff. */
  crewedUntilEndOfTurn?: boolean;
  /** Keywords granted temporarily (until end of turn) on top of whatever the
   * card's own text already says - e.g. Blitzball Shot granting trample, or
   * Cecil, Redeemed Paladin's Protect granting indestructible to other
   * attackers. See engine/keywords.ts: hasKeywordEffective, which checks
   * both this and the card's own text. Cleared at the cleanup step alongside
   * temporaryBuff. */
  temporaryKeywords?: string[];
  /** Set once CardDefinition.onAnyDeathDraw has fired for this instance this
   * turn (G'raha Tia's "triggers only once each turn") - cleared at the
   * cleanup step alongside temporaryBuff/temporaryKeywords. */
  onAnyDeathDrawUsedThisTurn?: boolean;
}

export type ZoneName = 'library' | 'hand' | 'battlefield' | 'graveyard' | 'exile' | 'commander';

export interface PlayerState {
  id: string;
  name: string;
  life: number;
  zones: Record<ZoneName, CardInstance[]>;
  ready: boolean;
  manaPool: ManaPool;
  hasPlayedLandThisTurn: boolean;
  /** Which CardDefinition id is this player's actual commander, if known.
   * Set at game creation for VS AI (from the chosen deck). Networked
   * Versus play doesn't have deck selection wired up yet, so this stays
   * undefined there for now - see CardActionsPanel for where this gates
   * the "move to commander zone" option. */
  hasDrawnThisTurn: boolean;
  commanderDefId?: string;
  commanderDamageTaken: number;
  /** Total life gained this turn from any automatic source (lifelink combat
   * damage, a gainLife effect, onAnyDeathDrain, ...) - NOT manual ADJUST_LIFE
   * changes, same "manual changes don't feed automatic triggers" convention
   * as onGainLifeTrigger. See engine/combat.ts: addLife. Reset at cleanup.
   * Used by Hope Estheim's end-step mill. */
  lifeGainedThisTurn: number;
}

export type Phase =
  | 'pregame'
  | 'untap'
  | 'upkeep'
  | 'draw'
  | 'main1'
  | 'combat_begin'
  | 'declare_attackers'
  | 'declare_blockers'
  | 'combat_damage'
  | 'combat_end'
  | 'main2'
  | 'end'
  | 'cleanup';

export interface CombatAssignment {
  attackerInstanceId: string;
  blockerInstanceIds: string[];
}

/**
 * Mutual Adjustment: a sandbox/correction mode both players must agree to
 * enter (and agree to exit). While active, the usual rules - mana cost,
 * one land per turn, no manual life changes - are all bypassed, so you two
 * can fix a mistake or set up a test scenario together. See
 * engine/actions.ts for exactly which checks this turns off.
 */
export interface MutualAdjustmentState {
  status: 'inactive' | 'requested' | 'active' | 'exit_requested';
  requestedBy?: string;
  agreedBy: string[];
}

export interface GameState {
  players: [PlayerState, PlayerState];
  activePlayerId: string;
  phase: Phase;
  turnNumber: number;
  log: string[];
  winnerId: string | null;
  declaredAttackers: string[];
  combatAssignments: CombatAssignment[];
  mutualAdjustment: MutualAdjustmentState;
  pendingDeaths: string[];
  /** Players who've pressed "Resolve Combat" during the combat_damage step -
   * damage only actually happens once both are in here, so there's always
   * a window to cast an instant in response. See engine/actions.ts. */
  combatReadyPlayers: string[];
  /** Set when an onEnter effect needs its controller to pick a target before
   * it can resolve (e.g. Ice Flan's tap-and-stun) - cleared by CHOOSE_TARGET.
   * Null whenever nothing is waiting on a target. */
  pendingTarget: {
    sourceInstanceId: string;
    controllerId: string;
    effect:
      | TapAndStunEffect
      | DestroyTargetEffect
      | PumpTargetEffect
      | PutCounterOnTargetEffect
      | DebuffTargetByGraveyardEffect
      | SelfFightTargetEffect
      | ChooseCreaturesFightEffect
      | ModifySagaLoreCounterEffect
      | TapTargetEffect
      | PutCounterOnUpToOneOwnCreatureEffect
      | AttachSelfToTargetEffect
      | DestroyOpponentCreatureEffect
      | BounceTargetEffect
      | BounceUpToOneOtherNonlandPermanentEffect
      | PutCounterOnUpToOneOtherCreatureEqualToOwnPowerEffect
      | DamageTargetAndControllerByEquipmentCountEffect
      | PumpAnotherControlledCreatureEffect
      | DamageTargetCreatureEffect;
    /** Only used by ChooseCreaturesFightEffect: the first (controller's own)
     * creature already chosen, waiting on the second (opponent's) pick. */
    firstInstanceId?: string;
  } | null;
  /** Set while a RevealAndDivideEffect is mid-sequence - cleared automatically
   * once the last card is placed. `revealed` holds the actual cards still
   * unassigned (public information - both players can see them), separate
   * from the six normal zones since they're neither in the library nor
   * anywhere else until a step places them. */
  pendingReveal: {
    sourceInstanceId: string;
    controllerId: string;
    revealed: CardInstance[];
    stepIndex: number;
    steps: RevealAndDivideEffect['steps'];
    remainderDestination: 'hand' | 'bottomOfLibrary';
  } | null;
  /** Set when a chooseManaColor onEnter effect (e.g. Crossroads Village)
   * needs its controller to pick a color before the permanent can be used -
   * cleared by CHOOSE_MANA_COLOR. Null whenever nothing is waiting on this. */
  pendingManaColorChoice: { instanceId: string; controllerId: string } | null;
  /** Set when a sacrificeCreature or eachPlayerSacrifices effect is waiting
   * on the FRONT id in `remainingPlayerIds` to pick one of their own
   * permanents (matching `filter`) to sacrifice - cleared, or advanced to
   * the next remaining player, by CHOOSE_SACRIFICE. Null whenever nothing is
   * waiting on this. See engine/effects.ts: resolveSacrificeQueue. */
  pendingSacrifice: { sourceInstanceId: string; remainingPlayerIds: string[]; filter: 'creature' | 'creatureToken' | 'nontokenCreature' | 'enchantment' | 'anyPermanent' } | null;
  /** Set while a SurveilEffect is mid-resolution - cleared by RESOLVE_SURVEIL.
   * `cards` are the surveiled cards, already removed from the library (so
   * they don't show up there in the meantime) but not yet anywhere else. */
  pendingSurveil: { sourceInstanceId: string; controllerId: string; cards: CardInstance[]; thenDrawCount?: number } | null;
  /** FIFO queue of player ids owed an extra turn (e.g. Ultimecia, Omnipotent's
   * Time Compression) - see engine/actions.ts: endTurn, which pops the front
   * entry and gives that player the next turn instead of the usual opponent. */
  extraTurnsQueued: string[];
  /** Set when a millThenReturn effect (e.g. Vanille, Cheerful l'Cie) needs
   * `controllerId` to pick a permanent card out of their graveyard to return
   * to hand - cleared by RETURN_FROM_GRAVEYARD. Only set at all if at least
   * one permanent card is actually available (otherwise nothing to choose). */
  pendingReturnFromGraveyard: { sourceInstanceId: string; controllerId: string } | null;
  /** Set while a LootEffect's discard step is outstanding - cleared by
   * DISCARD_CARD once `count` reaches 0 (or the hand runs out first). */
  pendingDiscard: { sourceInstanceId: string; controllerId: string; count: number } | null;
  /** Set while an OptionalBounceEffect is outstanding - cleared by
   * RESOLVE_OPTIONAL_BOUNCE (either an instanceId to bounce, or null to decline). */
  pendingOptionalBounce: { sourceInstanceId: string; controllerId: string } | null;
  /** Set while a RevealFilteredEffect is outstanding - cleared by
   * RESOLVE_REVEAL_FILTERED. `revealed` cards are already off the library. */
  pendingRevealFiltered: { sourceInstanceId: string; controllerId: string; revealed: CardInstance[]; filterType: CardType | CardType[] } | null;
  /** Set while a DiscardHandThenDrawByDevotionEffect's "you may" is
   * outstanding - cleared by RESOLVE_OPTIONAL_DISCARD_HAND_FOR_DEVOTION. */
  pendingOptionalDiscardHandForDevotion: { sourceInstanceId: string; controllerId: string; color: ManaColor } | null;
  /** Set while a ChooseOneModeEffect is waiting for its EXACTLY-one pick -
   * cleared by RESOLVE_CHOOSE_ONE_MODE. */
  pendingChooseOneMode: { sourceInstanceId: string; controllerId: string; modes: SpellMode[] } | null;
  /** Set while a DrawCardsFromTargetPlayerEffect is waiting for its player
   * target - cleared by CHOOSE_PLAYER_TARGET. */
  pendingPlayerTarget: { sourceInstanceId: string; controllerId: string; effect: DrawCardsFromTargetPlayerEffect } | null;
  /** Creature deaths processed this turn (incremented once per creature by
   * engine/combat.ts: moveCreaturesToGraveyard, regardless of cause - combat,
   * sacrifice, destroy, Saga completion, ...). Reset to 0 at the cleanup
   * step. See DrawForCreaturesDiedThisTurnEffect (Deadly Embrace). */
  creaturesDiedThisTurn: number;
  /** Set while a ReanimateTargetFromGraveyardEffect is waiting for its pick
   * of a creature card in the controller's OWN graveyard - cleared by
   * RESOLVE_REANIMATE. Only set at all if at least one legal creature card
   * is actually available. */
  pendingReanimate: { sourceInstanceId: string; controllerId: string; effect: ReanimateTargetFromGraveyardEffect } | null;
  /** Set while a ReturnCreaturesFromGraveyardToHandEffect is mid-sequence -
   * `remaining` counts down each pick, cleared (by choice or by hitting 0)
   * via RESOLVE_RETURN_CREATURE_FROM_GRAVEYARD. */
  pendingReturnCreaturesFromGraveyard: { sourceInstanceId: string; controllerId: string; remaining: number } | null;
  /** Set while an onCombatDamageToPlayerMayTransform trigger's "you may" is
   * outstanding (Jecht, Reluctant Guardian) - cleared by
   * RESOLVE_OPTIONAL_TRANSFORM. Accepting exiles-and-returns the source
   * transformed via exileAndReturnTransformed; declining just clears this. */
  pendingOptionalTransform: { sourceInstanceId: string; controllerId: string } | null;
  /** Set while an ExileTargetGraveyardCardEffect is waiting for its pick of a
   * card in ANY graveyard (Ignis Scientia) - cleared by
   * RESOLVE_GRAVEYARD_EXILE. `createFoodTokenIfCreature` mirrors the source
   * effect's flag so the resolver knows whether to spawn a token-food. */
  pendingGraveyardExile: { sourceInstanceId: string; controllerId: string; createFoodTokenIfCreature?: boolean } | null;
  /** Set while a DiscardUpToThenDrawThatManyEffect's discard step is
   * outstanding (Joshua, Phoenix's Dominant) - `discardedSoFar` counts up
   * each DISCARD_UP_TO_THEN_DRAW pick, `maxCount` caps it; declining further
   * (instanceId: null) or hitting maxCount both move straight to drawing
   * discardedSoFar cards and clear this. */
  pendingDiscardUpToThenDraw: { sourceInstanceId: string; controllerId: string; maxCount: number; discardedSoFar: number } | null;
}

export type GameAction =
  | { type: 'DRAW_CARD' }
  | { type: 'MOVE_CARD'; instanceId: string; toZone: ZoneName }
  | { type: 'SHUFFLE_LIBRARY' }
  | { type: 'TOGGLE_TAP'; instanceId: string; chosenColor?: ManaColor }
  | { type: 'CAST_CARD'; instanceId: string; chosenX?: number; chosenModeIndices?: number[] }
  | { type: 'ACTIVATE_ABILITY'; instanceId: string; abilityId: string; costTargetInstanceId?: string }
  | { type: 'ADJUST_LIFE'; playerId: string; delta: number }
  | { type: 'ADJUST_COUNTER'; instanceId: string; label: string; delta: number }
  | { type: 'FLIP_CARD'; instanceId: string }
  | { type: 'ATTACH_CARD'; instanceId: string; targetInstanceId: string }
  | { type: 'DETACH_CARD'; instanceId: string }
  | { type: 'DECLARE_ATTACKERS'; instanceIds: string[] }
  | { type: 'DECLARE_BLOCKERS'; assignments: CombatAssignment[] }
  | { type: 'ORDER_BLOCKERS'; attackerInstanceId: string; orderedBlockerIds: string[] }
  | { type: 'CHOOSE_TARGET'; targetInstanceId: string | null }
  | { type: 'RESOLVE_OPTIONAL_DISCARD_HAND_FOR_DEVOTION'; accept: boolean }
  | { type: 'RESOLVE_CHOOSE_ONE_MODE'; modeIndex: number }
  | { type: 'CHOOSE_PLAYER_TARGET'; targetPlayerId: string }
  | { type: 'CYCLE_CARD'; instanceId: string }
  | { type: 'CHOOSE_REVEALED_CARD'; instanceId: string }
  | { type: 'CHOOSE_MANA_COLOR'; color: ManaColor }
  | { type: 'CHOOSE_SACRIFICE'; instanceId: string }
  | { type: 'RESOLVE_SURVEIL'; graveyardIds: string[]; keepOrder: string[] }
  | { type: 'RETURN_FROM_GRAVEYARD'; instanceId: string }
  | { type: 'DISCARD_CARD'; instanceId: string }
  | { type: 'RESOLVE_OPTIONAL_BOUNCE'; instanceId: string | null }
  | { type: 'RESOLVE_REVEAL_FILTERED'; instanceId: string | null }
  | { type: 'CREW_VEHICLE'; instanceId: string; crewInstanceIds: string[] }
  | { type: 'CAST_FROM_GRAVEYARD'; instanceId: string; chosenX?: number }
  | { type: 'RESOLVE_REANIMATE'; instanceId: string }
  | { type: 'RESOLVE_RETURN_CREATURE_FROM_GRAVEYARD'; instanceId: string | null }
  | { type: 'RESOLVE_OPTIONAL_TRANSFORM'; accept: boolean }
  | { type: 'RESOLVE_GRAVEYARD_EXILE'; instanceId: string | null }
  | { type: 'DISCARD_UP_TO_THEN_DRAW'; instanceId: string | null }
  | { type: 'NEXT_PHASE' }
  | { type: 'END_TURN' }
  | { type: 'READY_TO_START' }
  | { type: 'REQUEST_MUTUAL_ADJUSTMENT' }
  | { type: 'RESPOND_MUTUAL_ADJUSTMENT'; accept: boolean }
  | { type: 'REQUEST_EXIT_MUTUAL_ADJUSTMENT' }
  | { type: 'RESPOND_EXIT_MUTUAL_ADJUSTMENT'; accept: boolean }
  | { type: 'UNDO' }
  | { type: 'CONCEDE' };

export type ActionResult = { ok: true; state: GameState } | { ok: false; error: string };