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
    /** "Exile two creature cards from your graveyard" as (part of) the cost
     * (Coin of Fate) - unlike exileFromGraveyard above, WHICH cards get
     * exiled genuinely matters here (the ability's own effect later has the
     * opponent choose between them), so the controller picks via
     * costTargetInstanceIds (same "strategically meaningful, so player-
     * chosen" convention as sacrificeAnother). Restricted to creature
     * cards. See engine/actions.ts: activateAbility, which threads the
     * resulting exiled ids into resolveCardEffects's exiledCostInstanceIds
     * parameter for OpponentChoosesOneOfExiledCardsToBottomRestReturnsTappedThenBecomeMonarchEffect
     * to read. */
    exileChosenCreatureCardsFromGraveyard?: number;
    /** "Sacrifice another creature/artifact/either" as part of the cost - the
     * controller picks WHICH one(s) client-side before dispatching, and they
     * arrive baked into the ACTIVATE_ABILITY action as costTargetInstanceIds
     * (unlike exileFromGraveyard, this choice is strategically meaningful
     * enough that auto-selecting it wouldn't be right). See
     * engine/actions.ts: activateAbility. */
    sacrificeAnother?: 'creature' | 'artifact' | 'artifactOrCreature' | 'nonlandPermanent';
    /** How many "another creature/artifact" permanents sacrificeAnother
     * requires - defaults to 1. The Gold Saucer's "Sacrifice two artifacts"
     * needs 2. Kefka's Tower's "Sacrifice ten nonland permanents" needs 10. */
    sacrificeAnotherCount?: number;
    /** "Sacrifice a [subtype]" as (part of) the cost (Scavenger Grounds'
     * "Sacrifice a Desert") - the subtype-matching cousin of
     * sacrificeAnother above (which only matches by fixed TYPE, not an
     * arbitrary subtype string), matched the same substring way as every
     * other subtype check in this engine (e.g. reducePerControlledSubtype).
     * Unlike sacrificeAnother, this may be satisfied by THIS SAME permanent
     * if it happens to have that subtype itself - real Scavenger Grounds
     * says "Sacrifice a Desert", not "Sacrifice another Desert". No land in
     * the current pool has subtype 'Desert' yet, so this specific instance
     * has no valid sacrifice target - same "provably inert until a future
     * card needs it" shape as other deferred grants noted elsewhere. */
    sacrificeAnotherWithSubtype?: string;
    /** "Sacrifice a modified creature" as (part of) the cost (Sephiroth,
     * Fallen Hero's "The Reunion") - the "modified" cousin of
     * sacrificeAnotherWithSubtype above, matched via engine/combat.ts:
     * isModifiedCreature (counters, or an Equipment/Aura attached) instead
     * of a subtype string. Like sacrificeAnotherWithSubtype, this may be
     * satisfied by THIS SAME permanent if it's itself modified - the real
     * card doesn't say "another". */
    sacrificeAnotherModifiedCreature?: boolean;
    /** "Exile this [permanent]" as (part of) the cost (e.g. Elixir) - unlike
     * sacrificeSelf, the card goes to exile instead of the graveyard. */
    exileSelf?: boolean;
    /** "Pay N life" as (part of) the cost (e.g. Ring of the Lucii). Checked
     * against the controller's current life before any other cost is paid. */
    payLife?: number;
    /** "This ability costs [N] less to activate for each [subtype] you
     * control" (Qiqirn Merchant's "...for each Town you control") - reduces
     * the GENERIC portion of manaLabel (never below 0), same shape as
     * CardDefinition.costReductionPerControlledSubtype but for an ACTIVATED
     * ABILITY's cost instead of a spell's. See engine/actions.ts:
     * activateAbility. */
    reducePerControlledSubtype?: { subtype: string; amountPerUnit: number };
    /** "Remove a [label] counter from this creature" as (part of) the cost
     * (Walking Ballista's damage ability) - validated/removed in
     * engine/actions.ts: activateAbility, right alongside sacrificeSelf/
     * exileSelf. `amount` defaults to 1. */
    removeCounterFromSelf?: { label: string; amount?: number };
    /** "Remove a counter from a nonland permanent you control" as (part of)
     * the cost (O'aka, Traveling Merchant) - unlike removeCounterFromSelf
     * (fixed to this permanent), the controller picks WHICH permanent via
     * costTargetInstanceIds (same choice-arrives-baked-in convention as
     * sacrificeAnother). Which counter LABEL gets removed, if the chosen
     * permanent has more than one kind, is auto-picked (highest amount
     * first) rather than asked - same simplification
     * MoveCounterBetweenTargetCreaturesEffect already uses. See
     * engine/actions.ts: activateAbility. */
    /** 'any' (Scholar of New Horizons' "a permanent you control", no nonland
     * restriction stated) additionally allows a LAND to be chosen - checked
     * in engine/actions.ts: activateAbility alongside the 'nonland' case. */
    removeCounterFromAnotherPermanent?: 'nonland' | 'any';
    /** "Mill a card" as (part of) the cost (The Warring Triad's "{T}, Mill
     * a card: ...") - moves this many cards from the top of the
     * controller's own library to their graveyard, same mechanics as
     * MillThenReturnEffect's own milling half, just paid as a cost instead
     * of resolved as an effect. */
    millSelf?: number;
    /** "Tap an untapped legendary creature you control" as (part of) the
     * cost (Relic of Legends) - a SEPARATE permanent gets tapped, not this
     * ability's own source (unlike the plain `tap` flag above); the
     * controller picks WHICH one via costTargetInstanceIds, same
     * choice-arrives-baked-in convention as sacrificeAnother. See
     * engine/actions.ts: activateAbility. */
    tapAnotherLegendaryCreature?: boolean;
    /** "Tap an untapped artifact you control" as (part of) the cost (Terra
     * Branford's mana ability) - the artifact-filtered cousin of
     * tapAnotherLegendaryCreature just above, same choice-arrives-baked-in
     * convention via costTargetInstanceIds. See engine/actions.ts:
     * activateAbility. */
    tapAnotherArtifact?: boolean;
    /** "Tap five untapped Wizards you control" as (part of) the cost
     * (Inalla, Archmage Ritualist's drain ability) - the subtype-counted
     * cousin of tapAnotherLegendaryCreature/tapAnotherArtifact above, but
     * for a FIXED NUMBER of permanents matching an arbitrary subtype
     * instead of one single permanent of a fixed type. The controller
     * picks WHICH ones via costTargetInstanceIds, same choice-arrives-
     * baked-in convention. See engine/actions.ts: activateAbility. */
    tapControlledSubtypeCount?: { subtype: string; count: number };
  };
  /** Marks this ability's own targeting as ALWAYS restricted to a creature
   * its activator controls (e.g. an ability whose effect sets
   * restrictToOwnCreature) - consulted by
   * CardDefinition.reducesActivatedAbilityCostForFirstOwnCreatureTargetingEachTurn
   * (Professor Hojo's "The first activated ability you activate during
   * your turn that targets a creature you control costs {2} less to
   * activate"). A STATIC per-ability marker rather than a dynamic check
   * against whichever target actually gets chosen, since this engine pays
   * an ability's cost (engine/actions.ts: activateAbility) before its
   * target is chosen (CHOOSE_TARGET, a separate later action) - real
   * Magic determines costs AFTER targets are locked in, but reversing that
   * order here would be a much bigger change than this one card
   * justifies. Known gap: an ability that CAN target either player's
   * creatures but happens to be aimed at your own this time never
   * qualifies, only one whose printed effect is unconditionally
   * "...you control". No ability in the current card pool sets this yet,
   * so the discount currently has no beneficiary - same "provably inert
   * until a future card needs it" shape as other deferred clauses noted
   * elsewhere in this file. */
  targetsOwnCreature?: boolean;
  /** "At the beginning of your end step, you may..." - since there's no
   * separate trigger/priority system, this just restricts activation to
   * your own end step instead, and the player chooses to press it or not,
   * standing in for "you may". Bypassed under Mutual Adjustment like other
   * timing restrictions (see engine/actions.ts: castCard's own !mutual check). */
  onlyDuringOwnEndStep?: boolean;
  /** "Boast — Activate only if this creature attacked this turn." (Ardyn
   * Izunia) - checked against CardInstance.attackedThisTurn on THIS
   * ability's own source permanent, not a phase/timing restriction. Bypassed
   * under Mutual Adjustment like every other activation restriction. */
  onlyIfAttackedThisTurn?: boolean;
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
  /** "Activate only during combat." (Najeela, the Blade-Blossom) - legal
   * during any of the combat phases, on EITHER player's turn (the printed
   * text has no "your turn" qualifier, unlike onlyDuringOwnMainPhase/
   * onlyDuringOwnEndStep above). Bypassed under Mutual Adjustment like
   * every other timing restriction here. */
  onlyDuringCombat?: boolean;
  /** "At the beginning of each of your main phases, if you haven't added
   * mana with this ability this turn, you may..." (Fal'Cie Paradise) -
   * approximates the automatic "at the beginning of... you may" trigger as
   * a player-activated ability restricted to onlyDuringOwnMainPhase (no
   * separate trigger/priority system exists - same stand-in convention as
   * onlyDuringOwnEndStep), gated on CardInstance.usedOncePerTurnAbilityThisTurn
   * on this ability's own source permanent. Reset at the controller's own
   * untap step. */
  onlyIfNotUsedThisTurn?: boolean;
  /** A precondition (not a cost) - the controller's graveyard must have at
   * least this many cards for the ability to be legal at all (e.g. Emet-Selch,
   * Unsundered's "if there are fourteen or more cards in your graveyard"). */
  requiresGraveyardSize?: number;
  /** A precondition (not a cost) - the controller must control at least this
   * many legendary creatures for the ability to be legal at all (Clive's
   * Hideaway: "if you control four or more legendary creatures"). Checked
   * the same way checkLegendRule and other "legendary" checks elsewhere
   * already do: def.subtype?.toLowerCase().includes('legendary'). */
  requiresControlledLegendaryCreatureCount?: number;
  /** "Activate only if you control an artifact." (Spire of Industry) - a
   * precondition (not a cost), checked the same simple way every other
   * "requires controlling N [thing]" precondition here does. */
  requiresControlledArtifact?: boolean;
  /** "Activate only if you control a creature with power [N] or greater."
   * (Bonders' Enclave) - a precondition (not a cost), checked live against
   * the controller's own board via engine/combat.ts: effectivePower, same
   * "requires controlling N [thing]" family as the siblings above. */
  requiresControlledCreaturePowerAtLeast?: number;
  /** "Monstrosity X" (Maester Seymour) - a precondition (not a cost): the
   * ability is illegal to activate at all once CardInstance.monstrous is
   * already set on this permanent ("if this creature isn't monstrous").
   * Pairs with an effect (e.g. MonstrosityByControlledCreatureCounterCountEffect)
   * that actually sets the flag - this field only gates re-activation. */
  requiresNotMonstrous?: boolean;
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
  /** "Return this card from your graveyard to the battlefield [tapped]
   * [with a counter]" (Relentless X-ATM092) - the same graveyard-sourced
   * activated ability shape as returnFromGraveyardTransformed, but the card
   * comes back AS ITSELF (no transformsInto needed). See engine/effects.ts:
   * returnSelfFromGraveyard. */
  returnSelfFromGraveyard?: { tapped?: boolean; counterLabel?: string; counterAmount?: number };
  /** Meld: requires the controller to also own and control a creature with
   * `partnerDefId` (checked as a precondition, same as a targeting
   * restriction) - after costs are paid, exiles both this permanent and the
   * partner, then creates a fresh `resultDefId` permanent in their place.
   * See engine/actions.ts: activateAbility. */
  meldsWith?: { partnerDefId: string; resultDefId: string };
  /** After costs (and requiresControlledLegendaryCreatureCount, if set) are
   * met: play the specific card this permanent hid away via a HideawayEffect
   * (CardInstance.hideawayExiledCardId) without paying its mana cost -
   * Clive's Hideaway's "You may play the exiled card...". A no-op (with a
   * log line, not an error) if nothing was ever hidden away, or it's
   * already been played. See engine/actions.ts: activateAbility. */
  playHideawayCard?: boolean;
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
  /** Defaults to 1. 'perCreatureCardInYourGraveyard' (The Final Days' own
   * flashback-only count) reads the number of graveyard cards whose
   * CardDefinition.type is 'creature' at resolution time - not "how many
   * you started with" or anything cached, just a live count. */
  /** 'chosenX' (Champions from Beyond's "create X ... tokens") - reads
   * whatever X value was paid for the SOURCE's own {X} cost, same chosenX
   * parameter resolveCardEffects already threads through for every onEnter
   * (see engine/actions.ts: castCard). 0 if the source had no {X} at all. */
  /** 'd20Roll' ("roll a d20... create a number of Treasure tokens equal to
   * the result", Dragon of Mount Gulg) - rolls 1-20 immediately via
   * Math.random(), same "no decision point, so no interactive pause" logic
   * as shuffle()/RandomGraveyardCopyEffect, unlike the existing
   * pendingCoinFlip mechanism (which pauses because the real card lets the
   * player call a side before the flip). */
  count?: number | 'perCreatureYouControl' | 'perCreatureCardInYourGraveyard' | 'chosenX' | 'd20Roll';
  tapped?: boolean;
  /** Job select style: attach the permanent generating this effect to the
   * (single) token it just created. Only meaningful when count resolves to 1. */
  attachSelfToToken?: boolean;
  /** "...create a 1/1 white Human creature token that's tapped and
   * attacking that player..." (Hero of Light) - joins the ALREADY-DECLARED
   * attack (appended to GameState.declaredAttackers/combatAssignments),
   * same mechanism as ReturnSelfFromGraveyardTappedAndAttackingEffect, just
   * for a freshly created token instead of a graveyard return. Always
   * attacks the controller's one opponent - "for each opponent"/"or a
   * planeswalker they control" simplifies to the single opponent in this
   * 2-player, no-planeswalkers engine. Meaningless without `tapped: true`
   * (nothing currently sets one without the other). */
  entersAttacking?: boolean;
}

/** "If you don't control a creature named [name], create [tokenId], a
 * legendary ... token" (Rufus Shinra's Darkstar) - unlike CreateTokenEffect,
 * this is skipped entirely if a permanent with that exact name is already
 * controlled, since this engine's legend rule (checkLegendRule) only logs a
 * warning rather than actually forcing a choice/cleanup, so an unconditional
 * create would leave duplicate tokens on the battlefield forever. */
export interface CreateTokenIfNotControllingNamedEffect {
  type: 'createTokenIfNotControllingNamed';
  tokenId: string;
  name: string;
}

/** "...you may have its controller create a 1/1 white Warrior creature
 * token that's tapped and attacking." (Cloud Strife) - unlike
 * CreateTokenEffect above (always creates for whoever resolveCardEffects
 * is run as), this is baked with a FIXED target player id at the moment
 * the triggering event is detected, since the token's recipient (the
 * attacking Warrior's controller) isn't necessarily the same as whichever
 * player ends up "running" this effect (GameState.pendingMayEffect always
 * resolves as its own controllerId - see engine/actions.ts: resolveMayEffect).
 * See CardDefinition.onAnyWarriorAttacksMayCreateTokenForAttackerController. */
export interface CreateTokenForFixedPlayerEffect {
  type: 'createTokenForFixedPlayer';
  tokenId: string;
  playerId: string;
  tapped?: boolean;
  entersAttacking?: boolean;
}

/**
 * Requires the controller to pick a target once the source resolves - see
 * GameState.pendingTarget and engine/actions.ts: chooseTarget. Only
 * generated by onEnter for now.
 */
/** "Ward [cost]" (Ancient Adamantoise, Summon: Leviathan, Paladin's Arms,
 * Yuna's group grant) - whenever an opponent targets the warded permanent,
 * that targeting is countered unless they pay this cost. Either a mana cost
 * (parsed the same way as any other cost string) or a dynamic life payment
 * "equal to [the warded permanent]'s power" (Raubahn) - never both. See
 * engine/combat.ts: effectiveWardCost, engine/actions.ts: chooseTarget/
 * resolveWardPayment. */
export interface WardCost {
  mana?: string;
  lifeEqualToOwnPower?: boolean;
}

/** "Untap target attacking creature" (Sage's Nouliths' granted "whenever
 * this creature attacks" trigger) - targets any currently-declared attacker
 * (see GameState.declaredAttackers), either player's, though in practice
 * only one side ever has attackers at a time. See
 * engine/actions.ts: chooseTarget, engine/combat.ts: isLegalPendingTarget. */
export interface UntapTargetAttackerEffect {
  type: 'untapTargetAttacker';
}

/** "Choose target creature attacking you. Put a stun counter on that
 * creature." (Lulu, Stern Guardian's onOpponentAttacksYou) - restricted to
 * GameState.declaredAttackers, same "must currently be attacking" gate as
 * UntapTargetAttackerEffect above, but stuns instead of untapping, and
 * (unlike TapAndStunEffect) never taps - it's already attacking, so tapped
 * is a given. */
export interface PutStunCounterOnTargetAttackerEffect {
  type: 'putStunCounterOnTargetAttacker';
}

export interface TapAndStunEffect {
  type: 'tapAndStun';
  targetController: 'opponent';
  targetType: 'artifact' | 'creature' | 'artifactOrCreature';
  /** "Tap target creature an opponent controls" with no stun counter at all
   * (Tidus, Blitzball Star) - unlike every other use of this effect, which
   * always adds a Stun counter. */
  noStunCounter?: boolean;
}

/** "Whenever this creature attacks, tap target creature defending player
 * controls. If that creature has greater power than this creature, put a
 * number of +1/+1 counters on this creature equal to the difference."
 * (Conformer Shuriken, granted via equipGrantsOnAttack) - "defending
 * player" is just the attacker's controller's one opponent in this
 * 2-player engine. `sourceInstanceId` is the ATTACKING creature itself
 * (same convention as every other equipGrantsOnAttack effect), which is
 * also who receives the counters. See engine/actions.ts: chooseTarget. */
export interface TapTargetThenCounterSelfByPowerDifferenceIfGreaterEffect {
  type: 'tapTargetThenCounterSelfByPowerDifferenceIfGreater';
}

/** "Tap up to one target creature and put a stun counter on it" (Summon:
 * Valefor's chapters II-IV) - a dedicated, narrow effect (like
 * TapStunAndGainLifeForNonbasicLandsEffect below) rather than widening
 * TapAndStunEffect: this one has NO controller restriction at all (unlike
 * TapAndStunEffect's hardcoded opponent-only), and the pick is optional
 * ("up to one", declinable via CHOOSE_TARGET's null convention). */
export interface TapUpToOneTargetCreatureAndStunEffect {
  type: 'tapUpToOneTargetCreatureAndStun';
}

/** "Exile target creature an opponent controls until [this] leaves the
 * battlefield" (Summon: Ixion's Aerospark) - the unrestricted-power sibling
 * of ExileTargetCreatureWithLessPowerUntilSourceLeavesEffect above: same
 * GameState.exileUntilSourceLeaves plumbing, mandatory target, just no
 * power comparison. */
export interface ExileTargetOpponentCreatureUntilSourceLeavesEffect {
  type: 'exileTargetOpponentCreatureUntilSourceLeaves';
}

/** "Put a [counterLabel] counter on each of up to two target creatures you
 * control" (Summon: Ixion's chapters II/III) - same "mandatory first pick,
 * optional second" two-step convention as PumpUpToTwoTargetsEffect (see
 * engine/actions.ts: chooseTarget's `firstInstanceId` handling), just
 * applying a permanent counter to each pick immediately instead of a
 * temporary buff, and restricted to creatures the controller owns. */
export interface PutCounterOnUpToTwoOwnCreaturesEffect {
  type: 'putCounterOnUpToTwoOwnCreatures';
  counterLabel: string;
  counterAmount: number;
  /** "...on each of up to two Soldiers you control" (SOLDIER Military
   * Program) - restricts the legal picks to creatures whose subtype
   * contains this string (same substring match as every other subtype
   * filter in this engine), instead of any creature you control. */
  restrictToSubtype?: string;
}

/** "Create X Treasure tokens, where X is the number of opponents who
 * control a creature with power [minPower] or greater" (Summon: Yojimbo's
 * chapter IV) - this engine is 2-player only, so "number of opponents" is
 * always 0 or 1: resolved immediately (no targeting) by checking whether
 * the one opponent has any qualifying creature and creating `count` tokens
 * if so, 0 otherwise. */
export interface CreateTokenIfOpponentControlsCreatureWithPowerAtLeastEffect {
  type: 'createTokenIfOpponentControlsCreatureWithPowerAtLeast';
  tokenId: string;
  minPower: number;
  count: number;
}

/** "Each opponent chooses a creature with the greatest mana value among
 * creatures they control. Return those creatures to their owners' hands"
 * (Summon: Valefor's Sonic Wings) - resolved immediately, no targeting: in
 * this 2-player engine "each opponent" is the one opponent, and rather than
 * modeling an opponent-side "choice" UI, every one of their creatures tied
 * for the highest mana value is bounced (matches the plural "those
 * creatures" in the reminder text). */
export interface BounceOpponentCreaturesWithGreatestManaValueEffect {
  type: 'bounceOpponentCreaturesWithGreatestManaValue';
}

/** "Choose one at random —" (Summon: Magus Sisters) - unlike
 * ChooseOneModeEffect (the PLAYER picks), the engine rolls a random index
 * and resolves that one option's effects via the same resolveCardEffects
 * machinery, immediately - no pending state needed at all, since there's no
 * decision for anyone to make. Each option can still independently arm its
 * own pendingTarget if IT needs a target (e.g. "put counters on target
 * creature"), same as any other effect list. */
export interface ChooseOneAtRandomEffect {
  type: 'chooseOneAtRandom';
  options: CardEffect[][];
}

/** "Return one or two target permanent cards from your graveyard to your
 * hand" (Yuna's Decision's Find Another Way mode) - same "mandatory first,
 * optional second" two-step convention as PumpUpToTwoTargetsEffect/
 * PutCounterOnUpToTwoOwnCreaturesEffect above, just picking from the
 * controller's OWN graveyard instead of the battlefield, restricted to
 * permanent card types (creature/artifact/enchantment/land). */
export interface ReturnUpToTwoTargetPermanentsFromGraveyardToHandEffect {
  type: 'returnUpToTwoTargetPermanentsFromGraveyardToHand';
}

/** "Sacrifice a creature. If you do, draw a card[, then you may put a
 * creature card and/or a land card from your hand onto the battlefield]"
 * (Yuna's Decision's Continue the Pilgrimage mode) - modeled as choosing
 * target creature you control (mandatory if you have one, arming
 * has-legal-target the same way any other targeted effect does) via the
 * normal pendingTarget/CHOOSE_TARGET flow, then sacrificing it and drawing
 * in one step at resolution. `thenPutCreatureAndOrLandFromHand` chains
 * straight into GameState.pendingPutCreatureAndOrLandFromHand right after
 * the draw (can't just be a second sibling effect in the same onCast array -
 * that would arm it immediately, before the sacrifice/draw above has even
 * resolved, since resolveCardEffects doesn't pause between effects in a
 * list). See engine/actions.ts: chooseTarget's 'sacrificeOwnCreatureThenDraw'
 * branch, resolvePutCreatureOrLandFromHand. */
export interface SacrificeOwnCreatureThenDrawEffect {
  type: 'sacrificeOwnCreatureThenDraw';
  thenPutCreatureAndOrLandFromHand?: boolean;
}

/** "Throw — Whenever Shadow deals combat damage to a player, you may
 * sacrifice another nonland permanent. If you do, draw [drawCount] cards
 * and each opponent loses life equal to the mana value of the sacrificed
 * permanent." (Shadow, Mysterious Assassin) - a self-only onCombatDamageToPlayer
 * trigger (unlike the generic sacrifice-queue effects elsewhere, the
 * "mana value of the sacrificed permanent" needs to be read at the moment
 * of sacrifice, so this is its own dedicated pending choice rather than
 * composed from smaller pieces). See GameState.
 * pendingMaySacrificeForDrawAndDrainChoice. */
export interface MaySacrificeAnotherNonlandPermanentThenDrawAndOpponentsLoseLifeEqualToManaValueEffect {
  type: 'maySacrificeAnotherNonlandPermanentThenDrawAndOpponentsLoseLifeEqualToManaValue';
  drawCount: number;
}

/** "Reveal cards from the top of your library until you reveal a creature
 * card. Put that card into your hand and the rest on the bottom of your
 * library in a random order. When you reveal a creature card this way, put
 * X +1/+1 counters on target creature you control, where X is the mana
 * value of that card." (Yuna's Whistle) - resolved in two parts: the reveal
 * loop itself runs immediately (bounded by library size, same "loop until
 * found or empty" shape as engine/effects.ts: beginRevealPickup), then -
 * only if a creature was actually found - this arms a pendingTarget for the
 * counter placement, with `counterAmount` already baked in to the mana
 * value found (filled in at arm time, same convention as Altered Ego's
 * chosenX capture). If no creature is left in the library, the reveal/mill
 * still happens but there's nothing left to grant counters for. */
export interface RevealUntilCreatureThenPutCountersEqualToManaValueEffect {
  type: 'revealUntilCreatureThenPutCountersEqualToManaValue';
  counterAmount?: number;
}

/** "For each opponent, tap up to one target nonland permanent that opponent
 * controls. Put X stun counters on each of those permanents and you gain X
 * life, where X is the number of nonbasic lands you control." (Omega,
 * Heartless Evolution's Wave Cannon) - a fixed, narrow effect distinct from
 * TapAndStunEffect: the target is OPTIONAL ("up to one" - see
 * engine/actions.ts: chooseTarget's isOptional check), covers any nonland
 * permanent type rather than just artifact/creature, and X (both the
 * stun-counter count and the life gained) is computed once, at resolution,
 * from the controller's CURRENT nonbasic land count - not a fixed 1 like
 * every other tap-and-stun effect. This engine is 2-player only, so "for
 * each opponent" is always exactly the one opponent - no separate
 * per-opponent loop is needed. See engine/effects.ts: isNonbasicLand. */
export interface TapStunAndGainLifeForNonbasicLandsEffect {
  type: 'tapStunAndGainLifeForNonbasicLands';
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
    /** "target enchantment" (Collective Effort). */
    | 'enchantment'
    /** "target permanent" - no type restriction at all (Bahamut, Warden of
     * Inferno's Gigaflare). */
    | 'anyPermanent'
    /** "target nonland permanent" (Fate of the Sun-Cryst) - any permanent
     * except a land, distinct from anyPermanent above. */
    | 'nonlandPermanent'
    /** "target creature with power N or greater" (Battle Menu's Magic mode) -
     * checked against effectivePower at resolution time; requires `minPower`. */
    | 'creatureWithMinPower'
    /** "target creature with toughness N or greater" (Destroy Evil) - the
     * toughness sibling of creatureWithMinPower above; checked against
     * effectiveToughness at resolution time; requires `minToughness`. */
    | 'creatureWithMinToughness'
    /** "target creature that was dealt damage this turn" (Qutrub Forayer) -
     * checked against CardInstance.damageMarked > 0 at resolution time. Not
     * perfectly accurate to the wording (damageMarked clears at cleanup, not
     * specifically "this turn" in a way this engine tracks separately, but
     * damage is always dealt and checked within the same turn in practice). */
    | 'creatureWithDamageMarked'
    /** "target land" (Sandworm). */
    | 'land'
    /** "target creature" - no controller restriction, no other qualifier
     * (Sephiroth's Intervention). */
    | 'creature'
    /** "choose an artifact or land that [an opponent] controls" (Ultimate
     * Magic: Meteor's foretold bonus) - unlike every other filter above, this
     * ONE has an owner restriction baked into the filter name itself (an
     * opponent of the effect's controller), since no current card needs an
     * "artifact or land" filter without that restriction. */
    | 'opponentArtifactOrLand'
    /** "target tapped creature" (Cloud's Limit Break's Cross-Slash tier) - no
     * controller restriction, checked against CardInstance.tapped at
     * resolution time. */
    | 'tappedCreature'
    /** "target nonland permanent an opponent controls" (Meteor Golem) - the
     * opponent-restricted cousin of 'nonlandPermanent' above. */
    | 'opponentNonlandPermanent'
    /** "target nonbasic land an opponent controls" (Demolition Field). */
    | 'opponentNonbasicLand'
    /** "target artifact, creature, or planeswalker" (Bedevil) - this engine
     * has no planeswalker CardType (2-player, no planeswalkers printed in
     * this pool yet), so that part of the clause is simply unreachable
     * rather than modeled - same "planeswalker clause is moot" treatment
     * as other cards already noted in notes.md. */
    | 'artifactOrCreature'
    /** "target creature or enchantment" (Mortify). */
    | 'creatureOrEnchantment'
    /** "target artifact you don't control" (Vandalblast) - in this
     * 2-player engine, "you don't control" an artifact means the one
     * opponent controls it; narrower than 'opponentArtifactOrLand' above,
     * which also allows targeting a land. */
    | 'opponentArtifact'
    /** "target nonblack creature" (Snuff Out) - checked against the
     * target's own printed color identity (parseCostLabel(costLabel).colors),
     * same derivation used for commander color identity elsewhere - a
     * creature with no black pip in its cost (including a colorless one)
     * qualifies. */
    | 'nonblackCreature'
    /** "target artifact" (Decimate) - standalone, no OR-qualifier (unlike
     * every existing artifact-involving filter above, which all pair it
     * with something else). */
    | 'artifact'
    /** "Destroy target creature if it has mana value [maxManaValue] or
     * less. Revolt — ...mana value [revoltManaValue] or less instead if a
     * permanent left the battlefield under your control this turn." (Fatal
     * Push) - modeled as a hard targeting restriction (same convention as
     * creatureWithMinPower/creatureWithMinToughness above - a target that
     * doesn't qualify is simply illegal to choose, not "fizzles at
     * resolution"), with the THRESHOLD itself picked live at the moment of
     * targeting by PlayerState.permanentLeftBattlefieldThisTurn. Requires
     * `maxManaValue` and `revoltManaValue`. */
    | 'creatureWithManaValueAtMostRevolt';
  /** Only used with targetFilter: 'creatureWithMinPower'. */
  minPower?: number;
  /** Only used with targetFilter: 'creatureWithMinToughness'. */
  minToughness?: number;
  /** Only used with targetFilter: 'creatureWithManaValueAtMostRevolt' - the
   * normal (Revolt NOT active) ceiling. */
  maxManaValue?: number;
  /** Only used with targetFilter: 'creatureWithManaValueAtMostRevolt' - the
   * raised ceiling while Revolt is active. */
  revoltManaValue?: number;
  /** "destroy up to one target [filter]" (Summon: Bahamut) - decline-able via
   * the null-target convention, same as every other "up to one" effect. */
  optional?: boolean;
  /** "Destroy target artifact, target creature, target enchantment, and
   * target land." (Decimate) - FOUR separate, sequential, MANDATORY
   * targets of different types rather than "up to N" of the same filter.
   * Holds the remaining filters still to come after THIS one resolves (or
   * is skipped - see below); re-arms pendingTarget with the next filter
   * once the current one finishes, until the queue is empty. See
   * DestroyArtifactCreatureEnchantmentAndLandEffect, engine/actions.ts:
   * chooseTarget's own 'destroyTarget' branch. A filter with NO legal
   * target anywhere is silently skipped (dequeued without asking the
   * player) rather than blocking the whole spell - the printed "(You
   * can't cast this spell unless you have legal choices for all its
   * targets.)" restriction is NOT enforced at cast time, same established
   * "no legal target, skip" approximation every other targeted effect in
   * this engine already uses instead of a hard precondition on casting. */
  thenDestroyFilterQueue?: ('artifact' | 'creature' | 'enchantment' | 'land')[];
  /** "That land's controller may search their library for a basic land
   * card, put it onto the battlefield, then shuffle. You may search your
   * library for a basic land card, put it onto the battlefield, then
   * shuffle." (Demolition Field) - in this 2-player engine "that land's
   * controller" is simply the destroyer's opponent (the only legal target
   * owner, per 'opponentNonbasicLand' above), so this just means "both
   * players may search" - chained via GameState.pendingLibrarySearch.
   * chainedSearchForPlayerId (opponent searches first, then the caster). */
  thenBothPlayersMaySearchBasicLandToBattlefield?: boolean;
  /** "...an opponent controls." (Feed the Swarm's "target creature or
   * enchantment an opponent controls") - a general AND-modifier on top of
   * whichever targetFilter above already matched, rather than a dedicated
   * filter value (unlike opponentNonlandPermanent/opponentNonbasicLand/
   * opponentArtifact above, each of which bakes the restriction into a
   * single-type filter name). See engine/actions.ts: chooseTarget. */
  opponentControlledOnly?: boolean;
  /** "You lose life equal to that permanent's mana value." (Feed the
   * Swarm) - applied to the CONTROLLER after the destroy actually
   * resolves (not if the target survives via indestructible/Shield), read
   * from the destroyed permanent's own printed costLabel. The "then"
   * naming distinguishes this from ReanimateTargetFromGraveyardEffect's
   * own loseLifeEqualToManaValue (same idea, different trigger). */
  thenLoseLifeEqualToManaValue?: boolean;
  /** "Its controller creates a 1/1 white Human creature token." (Memories
   * of Nibelheim) - applied to the DESTROYED PERMANENT's own controller
   * (found.ownerPlayerId), not the caster, right after the destroy
   * actually resolves (not if it survives via indestructible/Shield). */
  thenCreateTokenForDestroyedController?: string;
  /** "Its controller gains N life." (Search for the Frozen Esper) - applied
   * to the DESTROYED PERMANENT's own controller (found.ownerPlayerId), same
   * "then" convention as thenCreateTokenForDestroyedController above, just
   * a life gain instead of a token. */
  thenControllerGainsLife?: number;
}

/** "Destroy target artifact, target creature, target enchantment, and
 * target land." (Decimate) - arms the FIRST of the four as an ordinary
 * DestroyTargetEffect (targetFilter: whichever of the four actually has a
 * legal target first, in artifact/creature/enchantment/land order), with
 * the rest queued in its own thenDestroyFilterQueue. A completely inert
 * no-op (logged, like every other "no legal target" effect) only if NONE
 * of the four types has any legal target anywhere. */
export interface DestroyArtifactCreatureEnchantmentAndLandEffect {
  type: 'destroyArtifactCreatureEnchantmentAndLand';
}

/** "[This] deals N damage to target creature" (Light of Judgment) - a plain
 * targeted damage effect, distinct from every other damage-shaped effect
 * here (which are all either combat damage or "to each opponent"/"to that
 * creature's controller" combos). Respects indestructible; lethal damage
 * goes through the normal death pipeline. */
export interface DamageTargetCreatureEffect {
  type: 'damageTargetCreature';
  amount: number;
  /** "If that creature would die this turn, exile it instead" (Suplex) - a
   * one-shot replacement checked right after this specific damage is dealt,
   * distinct from CardDefinition-level death redirects (onDeathExileAndCreateTokens,
   * a Finality counter, ...) since it isn't a property of the creature
   * itself, just this one attack. See engine/actions.ts: chooseTarget's
   * damageTargetCreature branch. */
  exileIfDies?: boolean;
  /** "...to EACH OF UP TO TWO target creatures" (Summon: Kujata's chapter
   * I) - same mandatory-first/optional-second two-step convention as
   * PumpUpToTwoTargetsEffect (pendingTarget.firstInstanceId), just dealing
   * this same `amount` to each pick independently instead of a shared buff. */
  upToTwo?: boolean;
}

/** "For each opponent, choose up to one target creature that player
 * controls. Mega Flare deals damage equal to the greatest power among
 * creatures you control to each of the chosen creatures." (Mega Flare) -
 * "for each opponent" collapses to "up to one target creature the
 * opponent controls" in this 2-player engine (there's only ever one
 * opponent to iterate), same simplification as ChooseOpponentEffect.
 * Declinable via CHOOSE_TARGET's null convention, same as destroyTarget.optional. */
export interface DamageEqualToGreatestControlledPowerToUpToOneOpponentCreatureEffect {
  type: 'damageEqualToGreatestControlledPowerToUpToOneOpponentCreature';
}

/** "Up to three target creatures can't block this turn." (Summon:
 * Kujata's chapter II) - unlike every "up to two" effect elsewhere (which
 * reuses pendingTarget.firstInstanceId for the one extra pick), three
 * picks needs GameState.pendingTarget.chosenInstanceIds, a plain
 * accumulating array. Same approximation as the "up to two" family: the
 * FIRST pick is mandatory (a legal target is already guaranteed to exist
 * by the time this arms at all), only the 2nd/3rd are declinable. */
export interface GrantCantBlockToUpToThreeTargetsEffect {
  type: 'grantCantBlockToUpToThreeTargets';
}

/** "Discard a card, then draw two cards. When you discard a card this
 * way, this creature deals damage equal to that card's mana value to
 * each opponent." (Summon: Kujata's chapter III) - the controller discards
 * ONE card of their own choice (GameState.pendingDiscard, controllerId ===
 * the caster, not an opponent), then draws `drawCount`, then each
 * opponent loses life equal to the discarded card's mana value - all via
 * pendingDiscard's thenDrawCountForDiscarder/
 * thenDamageOpponentsEqualToDiscardedManaValue fields, resolved together
 * in engine/actions.ts: discardCard right after the single discard. A
 * no-op (nothing to discard) if the controller's hand is empty. */
export interface DiscardThenDrawThenDamageOpponentsEqualToDiscardedManaValueEffect {
  type: 'discardThenDrawThenDamageOpponentsEqualToDiscardedManaValue';
  drawCount: number;
}

/** "Exile target [filter]" (Suplex's "Exile target artifact") - the exile
 * counterpart to DestroyTargetEffect, kept separate (rather than adding an
 * `exileInsteadOfDestroy` flag there) since exiling is a distinct zone
 * change from destroying, not just a flavor difference. */
export interface ExileTargetPermanentEffect {
  type: 'exileTargetPermanent';
  targetFilter: 'artifact' | 'creature' | 'anyPermanent' | 'nonlandPermanent' | 'artifactEnchantmentOrTappedCreature' | 'artifactOrEnchantment';
  /** "...an opponent controls" (Summon: Yojimbo's chapter I) - every other
   * targetFilter above has no owner restriction at all, so this only ever
   * needs checking when set. */
  opponentControlledOnly?: boolean;
  /** "...and all tokens that player controls with the same name as that
   * permanent" (Legions to Ashes) - after the primary target is exiled,
   * also exiles every OTHER token on the same controller's battlefield
   * sharing the target's defId (tokens with the same "name" always share a
   * defId in this engine - there's no independent token-naming system, and
   * CreateTokenCopyOfTargetEffect's own copy tokens reuse the copied card's
   * defId too). See engine/actions.ts: chooseTarget's own resolution. */
  alsoExileSameNameTokensControlledByTarget?: boolean;
  /** "Exile UP TO TWO target [filter]" (Angel of the Ruins) - same
   * mandatory-first/optional-second two-step convention as
   * PumpUpToTwoTargetsEffect (see engine/actions.ts: chooseTarget's own
   * `firstInstanceId` handling): a no-op with zero legal targets, exactly
   * one pick if the second is declined (null), up to two distinct ones
   * otherwise. */
  upToTwo?: boolean;
}

/** "Exile target creature. Its controller may search their library for a
 * basic land card, put that card onto the battlefield tapped, then
 * shuffle." (Path to Exile) - a mandatory exile (any controller, no
 * restriction) followed by a library search GRANTED TO THE EXILED
 * CREATURE'S CONTROLLER, not the caster - unlike every other search effect
 * in this engine, `playerId` passed to engine/effects.ts: beginLibrarySearch
 * here is found.ownerPlayerId, which may be the caster's opponent. See
 * engine/actions.ts: chooseTarget's top-level special case for this effect
 * (it arms a DIFFERENT player's pendingLibrarySearch than pendingTarget.controllerId,
 * so it can't use the generic exileTargetPermanent branch). If the exiled
 * creature turns out to be a commander (redirected to the command zone
 * instead of exile), the search is skipped entirely - same simplification
 * as every other "then X" effect chained after an exile in this engine. */
export interface ExileTargetCreatureThenControllerMaySearchBasicLandEffect {
  type: 'exileTargetCreatureThenControllerMaySearchBasicLand';
}

/** "Exile target creature. Its controller gains life equal to its power."
 * (Swords to Plowshares) - a mandatory exile (any controller, no
 * restriction) followed by a life gain for THE EXILED CREATURE'S
 * CONTROLLER (not necessarily the caster), same "life/search granted to
 * found.ownerPlayerId, not playerId" shape as
 * ExileTargetCreatureThenControllerMaySearchBasicLandEffect above - but
 * since gaining life is immediate/synchronous (no further pending state to
 * arm for a different player), this doesn't need that effect's own
 * top-level chooseTarget special case; the ordinary dispatch chain handles
 * it. Power is read via effectivePower right before the creature leaves
 * the battlefield. */
export interface ExileTargetCreatureThenControllerGainsLifeEqualToPowerEffect {
  type: 'exileTargetCreatureThenControllerGainsLifeEqualToPower';
}

/** "Exile target creature defending player controls with power less than
 * [this]'s power until [this] leaves the battlefield" (Auron, Venerated
 * Guardian's Shooting Star, fired via onAttack alongside a plain
 * putCounterOnSelf - see cards.ts; the printed "When you do" doesn't need
 * separate reflexive-trigger plumbing, since both effects just run together
 * whenever Auron attacks). Unlike ExileTargetPermanentEffect above (a fixed
 * filter, permanent exile), this compares against the SOURCE's own current
 * effectivePower at resolution time rather than a stored threshold, and the
 * exile isn't permanent - see GameState.exileUntilSourceLeaves, populated
 * when this resolves in engine/actions.ts: chooseTarget. "Defending player"
 * is just the attacker's one opponent, same shortcut this 2-player engine
 * already takes everywhere else. */
export interface ExileTargetCreatureWithLessPowerUntilSourceLeavesEffect {
  type: 'exileTargetCreatureWithLessPowerUntilSourceLeaves';
}

/** "Choose target creature you control. It deals damage equal to its power
 * to each OTHER creature" (Nibelheim Aflame) - targets a creature you
 * control (like PutCounterOnUpToOneOwnCreatureEffect, but mandatory, not "up
 * to one"), then at resolution reads THAT creature's own effective power and
 * marks that much damage on every other creature on the battlefield
 * (either player's), respecting indestructible per creature. */
export interface SweepDamageFromChosenCreatureEffect {
  type: 'sweepDamageFromChosenCreature';
}

/** "Search your library for a card named [cardName], put it onto the
 * battlefield tapped, then shuffle" (Magitek Infantry) - the
 * onto-the-battlefield counterpart to SearchLibraryForLandEffect (which
 * only ever goes to hand and is land-only); not restricted to lands. */
export interface SearchLibraryForNamedCardEffect {
  type: 'searchLibraryForNamedCard';
  cardName: string;
}

/** "Search your library for a [subtype] card, reveal it, put it into your
 * hand, then shuffle" (Cloud, Midgar Mercenary's "search your library for an
 * Equipment card") - unlike SearchLibraryForLandEffect/SearchLibraryForNamedCardEffect
 * (exact name), this matches by subtype, and unlike searchLibraryForNamedCard
 * (battlefield tapped), this goes to hand. */
export interface SearchLibraryForSubtypeEffect {
  type: 'searchLibraryForSubtype';
  subtype: string;
  /** "If this spell was cast from a graveyard, put that card onto the
   * battlefield instead [of hand]" (From Father to Son's flashback-only
   * behavior, via FlashbackAbility.effects) - unlike other search effects'
   * toBattlefieldTapped, the card enters UNTAPPED here (nothing in the
   * printed text says otherwise). */
  toBattlefieldUntapped?: boolean;
}

/** "When this creature enters, you may search your library for a creature
 * card with mana value [N] or less, reveal it, put it into your hand, then
 * shuffle." (Ranger-Captain of Eos) - the mana-value-ceiling cousin of
 * SearchLibraryForSubtypeEffect above, via LibrarySearchFilter's
 * 'creatureWithManaValueAtMost' kind. The "may" is just the usual
 * decline-via-null convention on the resulting pendingLibrarySearch, same
 * as every other search here. */
export interface SearchLibraryForCreatureWithManaValueAtMostEffect {
  type: 'searchLibraryForCreatureWithManaValueAtMost';
  maxManaValue: number;
}

/** "All creatures get -X/-Y until end of turn" (Poison the Waters) - unlike
 * BuffOtherCreaturesYouControlEffect (your own, excluding the source), this
 * hits every creature on the battlefield, either player's, no exclusions. */
export interface BuffAllCreaturesEffect {
  type: 'buffAllCreatures';
  power: number;
  toughness: number;
}

/** "[This] becomes a [subtype] artifact creature in addition to its other
 * types until end of turn" (Phantom Train) - sets
 * CardInstance.temporarilyCreatureUntilEndOfTurn on the source; see
 * engine/combat.ts: isEffectivelyCreature. */
export interface BecomeCreatureUntilEndOfTurnEffect {
  type: 'becomeCreatureUntilEndOfTurn';
  /** Purely cosmetic - see CardInstance.temporaryGrantedSubtype. */
  subtype?: string;
}

/** "Creatures your opponents control get -X/-Y until end of turn" (Sephiroth,
 * Planet's Heir) - the opponent-only counterpart to
 * BuffOtherCreaturesYouControlEffect (your own) and BuffAllCreaturesEffect
 * (both sides, no exclusion). */
export interface DebuffOpponentCreaturesEffect {
  type: 'debuffOpponentCreatures';
  power: number;
  toughness: number;
}

/** "Mill N cards" (Shinra Reinforcement) - unlike MillThenReturnEffect, this
 * is a bare mill with no follow-up graveyard return. */
export interface MillSelfEffect {
  type: 'millSelf';
  count: number;
}

/** "{1}{B}: Each player mills a card." (Golbez, Clad in Darkness) - unlike
 * MillSelfEffect above (caster only), this mills EVERY player, each from
 * their own library. No existing generic "both players mill" effect
 * covers this exact shape. */
export interface EachPlayerMillsEffect {
  type: 'eachPlayerMills';
  count: number;
}

/** "Each opponent exiles the top N cards of their library" (Malboro's Bad
 * Breath) - the exile counterpart to MillSelfEffect (self, graveyard), but
 * for opponents and to exile. */
export interface ExileTopOfEachOpponentLibraryEffect {
  type: 'exileTopOfEachOpponentLibrary';
  count: number;
}

/** "Whenever [this] deals combat damage to a player, exile the top card of
 * your library. You may play that card for as long as you control [this]"
 * (Lightning, Security Sergeant) - unlike a flashback ability (tied to the
 * card's OWN printed cost, cast from its own graveyard), this grants
 * whatever card gets exiled a persistent play PERMISSION that's re-checked
 * live every time it's played (not removed the moment the source leaves
 * the battlefield - if you regain control of/replay the source, the
 * permission is simply valid again). See GameState.exilePlayGrants and
 * engine/actions.ts: castFromExile. */
export interface ExileTopOfLibraryPlayableWhileControllingSourceEffect {
  type: 'exileTopOfLibraryPlayableWhileControllingSource';
}

/** "Draw Arcanum — {T}: Look at the top card of your library. You may
 * exile it face down." (Urianger Augurelt) - unlike every other
 * "exile top of library, playable..." effect above, this grants NO play
 * permission at all by itself; the card just sits face down in exile,
 * tagged via CardInstance.exiledFaceDownBySourceInstanceId, until a
 * SEPARATE ability (Play Arcanum, see
 * GrantTemporaryPlayPermissionForFaceDownExiledBySourceEffect below)
 * grants a temporary permission for every card tagged this way. Wrapped
 * in a MayEffectEffect for the "you may" - "look at" itself isn't
 * modeled as a separate reveal step, consistent with how this engine's
 * other "look at the top card, then maybe [X]" abilities already work. */
export interface ExileTopOfLibraryFaceDownTaggedWithSourceEffect {
  type: 'exileTopOfLibraryFaceDownTaggedWithSource';
}

/** "Play Arcanum — {T}: Until end of turn, you may play cards exiled with
 * Urianger Augurelt. Spells you cast this way cost {2} less to cast."
 * (Urianger Augurelt) - finds every card in the controller's exile zone
 * tagged with this SOURCE's instanceId (via exiledFaceDownBySourceInstanceId)
 * and grants each one an ExilePlayGrant (expiresAtCleanup, this
 * effect's own costReduction). A no-op if nothing is currently tagged. */
export interface GrantTemporaryPlayPermissionForFaceDownExiledBySourceEffect {
  type: 'grantTemporaryPlayPermissionForFaceDownExiledBySource';
  costReduction?: number;
}

/** "At the beginning of your end step, if you control a creature with power
 * 4 or greater, exile the top card of your library. You may play that card
 * until you exile another card with this enchantment." (Furious Rise) -
 * unlike ExileTopOfLibraryPlayableWhileControllingSourceEffect above (whose
 * grants can freely stack - Lightning's wording never invalidates an
 * earlier one), resolving this REPLACES any still-outstanding grant from
 * this same source (see engine/effects.ts), since only the MOST RECENTLY
 * exiled card is ever playable. Reuses requiresControlOfInstanceId purely
 * as a way to tag which grant belongs to which source for that replacement
 * - a minor side effect is the permission would also lapse early if the
 * enchantment itself left the battlefield, which isn't printed but has no
 * practical difference (there'd be no way to "exile another card with
 * this enchantment" once it's gone anyway). */
export interface ExileTopOfLibraryPlayableUntilAnotherExiledWithSourceIfControlCreaturePowerAtLeastEffect {
  type: 'exileTopOfLibraryPlayableUntilAnotherExiledWithSourceIfControlCreaturePowerAtLeast';
  minPower: number;
}

/** "Whenever [this] deals combat damage to a player, exile the top card of
 * that player's library. Then you may sacrifice another creature or
 * artifact. If you do, you may play the exiled card this turn, and mana of
 * any type can be spent to cast it" (Reno and Rude) - "that player" is
 * always just the controller's one opponent (2-player games only), so no
 * explicit target is needed. The optional sacrifice is a single yes/no-ish
 * choice bundled with a specific instance to give up, not the
 * multi-permanent GameState.pendingSacrifice queue - see
 * GameState.pendingOptionalSacrificeForExilePlay and engine/actions.ts:
 * resolveOptionalSacrificeForExilePlay. */
export interface ExileTopOfTargetPlayerLibraryThenOptionalSacrificeToPlayEffect {
  type: 'exileTopOfTargetPlayerLibraryThenOptionalSacrificeToPlay';
}

/** "[This] deals damage equal to the number of creatures you control plus
 * the number of Equipment you control to target creature" (Slash of Light) -
 * the dynamic amount is computed from the CASTER's own battlefield at the
 * moment this effect is queued (not at the later CHOOSE_TARGET moment), then
 * dispatched as an ordinary DamageTargetCreatureEffect with that amount
 * baked in - see engine/effects.ts: resolveCardEffects. */
export interface DamageTargetCreatureEqualToCreaturesAndEquipmentEffect {
  type: 'damageTargetCreatureEqualToCreaturesAndEquipment';
}

/** "Each OTHER [subtype] you control deals damage equal to its power to
 * target creature an opponent controls" (Bartz and Boko) - each matching
 * creature deals its own power separately in the real rules text, but since
 * they all hit the SAME target, this is equivalent to (and implemented as) a
 * single damage instance for their SUMMED power - computed at the moment
 * this effect is queued, then dispatched as an ordinary
 * DamageTargetCreatureEffect, same pattern as
 * DamageTargetCreatureEqualToCreaturesAndEquipmentEffect. */
export interface DamageTargetCreatureEqualToOtherControlledSubtypePowerEffect {
  type: 'damageTargetCreatureEqualToOtherControlledSubtypePower';
  subtype: string;
}

/** "Create a token that's a copy of target artifact, creature, or land"
 * (Relm's Sketching) - unlike RandomGraveyardCopyEffect (a random graveyard
 * card, no targeting), this targets any ONE battlefield permanent (either
 * player's) via the normal pendingTarget/CHOOSE_TARGET flow, and the new
 * token enters the battlefield under the CASTER's control, untapped. */
export interface CreateTokenCopyOfTargetEffect {
  type: 'createTokenCopyOfTarget';
  /** "...of target CREATURE..." (Sublime Epiphany) - narrows the default
   * "artifact, creature, or land" filter down to creatures only, paired
   * with controlledOnly below. */
  creatureOnly?: boolean;
  /** "Create a token that's a copy of target PERMANENT." (Flash
   * Photography) - widens the default (artifact, creature, or land only)
   * to every permanent type, including enchantment. Mutually exclusive
   * with creatureOnly in practice. */
  anyPermanent?: boolean;
  /** "...target creature YOU CONTROL" (Sublime Epiphany) - every other
   * card using this effect has no owner restriction at all. */
  controlledOnly?: boolean;
  /** "Create a token that's a copy of target creature. If this spell was
   * kicked, create five of those tokens instead." (Rite of Replication) -
   * resolved to a plain number (1 or 5) at ARM time (when this is baked
   * into GameState.pendingTarget.effect, whose copy of `wasKicked` is still
   * in scope there, unlike by the time CHOOSE_TARGET later actually creates
   * the token(s)). Defaults to 1 when omitted. */
  count?: number | 'fiveIfKicked';
}

/** "You may have this creature enter as a copy of any creature on the
 * battlefield, except it enters with X additional +1/+1 counters on it"
 * (Altered Ego) - unlike CreateTokenCopyOfTargetEffect above (spawns a NEW
 * token alongside the source), this rewrites the SOURCE's own defId in
 * place, same "in-place defId swap" as CardAbility/CardEffect transformSelf,
 * just target-driven instead of pointing at a fixed transformsInto. Declining
 * the copy (see engine/actions.ts: chooseTarget's top-level special case for
 * this effect, not the generic isOptional list - it still has to add the
 * counters on decline, which the generic "just clear pendingTarget" path
 * doesn't do) still adds the counters; only whether it becomes a copy is
 * optional. counterAmount is left undefined on the card's own onEnter list -
 * X isn't known until cast - and filled in when this gets armed into
 * GameState.pendingTarget (engine/effects.ts: resolveCardEffects's chosenX
 * parameter, threaded from engine/actions.ts: castCard for exactly this
 * effect). */
export interface BecomeCopyOfAnyCreatureThenAddCountersEffect {
  type: 'becomeCopyOfAnyCreatureThenAddCounters';
  counterAmount?: number;
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

/** "As this artifact enters, choose a creature type." (Herald's Horn) -
 * same shape as ChooseManaColorEffect above (arms GameState.
 * pendingChooseCreatureType, cleared by CHOOSE_CREATURE_TYPE into
 * CardInstance.chosenCreatureType), just a free-text creature type instead
 * of a fixed 5-color enum - this engine has no master creature-type list,
 * so any non-empty string is accepted. */
export interface ChooseCreatureTypeEffect {
  type: 'chooseCreatureType';
}

/** "As Squall enters, choose a number." (Squall, Gunblade Duelist) - same
 * shape as ChooseCreatureTypeEffect above, just a number (arms GameState.
 * pendingChooseNumber, cleared by CHOOSE_NUMBER into CardInstance.chosenNumber). */
export interface ChooseNumberEffect {
  type: 'chooseNumber';
}

/** "Target player adds one mana of any color." (The Warring Triad) -
 * "target player" is approximated as the ACTIVATOR themselves: in this
 * 2-player engine a rational activator always targets themselves (there's
 * no adversarial way to force them to target the opponent instead), so
 * this skips a genuine player-target step and just lets the controller
 * pick the color and receive the mana directly. Unlike ChooseManaColorEffect
 * above (a PERSISTENT per-instance lock on what a permanent produces going
 * forward), this is a one-shot immediate mana addition. See GameState.
 * pendingAddManaOfChosenColor and GameAction 'RESOLVE_ADD_MANA_OF_CHOSEN_COLOR'. */
export interface AddOneManaOfChosenColorEffect {
  type: 'addOneManaOfChosenColor';
  /** "Add THREE mana of any one color" (Coveted Jewel) - defaults to 1
   * (The Warring Triad's plain "one mana of any color"). Ignored when
   * amountEqualToOpponentSubtypeCount is set. */
  amount?: number;
  /** "...where X is the number of Islands target opponent controls." (Fal'Cie
   * Paradise) - overrides `amount` with a LIVE count of the opponent's
   * battlefield permanents whose subtype contains this string, read fresh
   * each time this resolves. "target opponent" is approximated as THE
   * opponent (this is a 2-player engine - no genuine choice to make). See
   * engine/effects.ts: resolveCardEffects's 'addOneManaOfChosenColor' branch. */
  amountEqualToOpponentSubtypeCount?: string;
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

/** "Each player sacrifices HALF the [creatures matching filter] they
 * control of their choice, rounded down" (Zodiark, Umbral God's "half the
 * non-God creatures they control") - unlike EachPlayerSacrificesEffect
 * (always exactly one sacrifice per player), the COUNT here is dynamic and
 * computed separately per player from their own current board (so the two
 * players can end up sacrificing different numbers). See engine/effects.ts:
 * resolveSacrificeQueue/matchesSacrificeFilter's 'nonGodCreature' filter. */
export interface EachPlayerSacrificesHalfRoundedDownEffect {
  type: 'eachPlayerSacrificesHalfRoundedDown';
  filter: 'nonGodCreature';
}

/** "Return a land you control to its owner's hand" (Zell Dincht's end step
 * trigger) - unlike OptionalBounceEffect this is MANDATORY (no decline
 * option) and restricted to lands specifically, so it can't reuse
 * GameState.pendingOptionalBounce/RESOLVE_OPTIONAL_BOUNCE. If the controller
 * has no lands at all, this is a no-op (nothing to return) rather than
 * creating a pending choice with zero legal picks. See
 * GameState.pendingLandBounce and engine/actions.ts: resolveLandBounce. */
export interface ReturnControlledLandToHandEffect {
  type: 'returnControlledLandToHand';
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

/** "Explore" (real MTG keyword action) - "Reveal the top card of your
 * library. Put that card into your hand if it's a land. Otherwise, put a
 * +1/+1 counter on [sourceInstanceId], then put the card back or put it into
 * your graveyard." The land case is fully automatic (no choice); the nonland
 * case always puts the counter immediately, then pauses on
 * GameState.pendingExplore for the top-or-graveyard choice (RESOLVE_EXPLORE) -
 * unlike SurveilEffect, there's no reordering or "any number" here, just one
 * card and one binary choice, so this gets its own small pending state
 * rather than overloading pendingSurveil's shape. The counter honors
 * CardDefinition.increasesOwnCounterPlacementsByOne (Hardened Scales) and
 * applyCounterPlacementSideEffects like every other counter-adding effect. */
export interface ExploreEffect {
  type: 'explore';
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
  /** "Scry 1, then reveal the top card of your library. If it's a land
   * card, put it onto the battlefield tapped. Otherwise, draw a card."
   * (Tidus, Zanarkand Fayth) - "Scry" has no separate mechanic in this
   * engine (same established equivalence as onOwnSurveilDraw's own doc
   * comment - surveil approximates it, sending unwanted cards to the
   * graveyard instead of the bottom of the library), so this is modeled
   * as a plain SurveilEffect with this follow-up on the now-rearranged
   * top card. Mutually exclusive with thenDrawCount in practice (no
   * current card needs both). */
  thenRevealTopLandToBattlefieldTappedElseDraw?: boolean;
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

/** "Cosmo Memory — When Red XIII enters, return target Aura or Equipment
 * card from your graveyard to your hand." (Red XIII, Proud Warrior) - the
 * TARGETED (pick one specific card, mandatory if any exists) cousin of
 * MillThenReturnEffect's own graveyard-to-hand return, scoped to just
 * Aura/Equipment cards via GameState.pendingReturnFromGraveyard.filter. */
export interface ReturnTargetAuraOrEquipmentFromGraveyardToHandEffect {
  type: 'returnTargetAuraOrEquipmentFromGraveyardToHand';
}

/** "{2}, {T}: Return target Equipment or Vehicle card from your graveyard
 * to your hand." (Cid, Freeflier Pilot) - the Equipment/Vehicle-filtered
 * sibling of ReturnTargetAuraOrEquipmentFromGraveyardToHandEffect above,
 * same shape and GameState.pendingReturnFromGraveyard mechanism, just a
 * different filter value ('equipmentOrVehicle'). */
export interface ReturnTargetEquipmentOrVehicleFromGraveyardToHandEffect {
  type: 'returnTargetEquipmentOrVehicleFromGraveyardToHand';
}

/** "When Elena enters, return target non-Assassin historic card from your
 * graveyard to your hand. (Artifacts, legendaries, and Sagas are historic.)"
 * (Elena, Turk Recruit) - the historic-filtered cousin of
 * ReturnTargetAuraOrEquipmentFromGraveyardToHandEffect above, via the same
 * GameState.pendingReturnFromGraveyard.filter mechanism. "Historic" is
 * checked the same way everywhere else in this engine would: def.type ===
 * 'artifact' (not subtype - see the artifact-counting convention already
 * used by engine/combat.ts: controlledArtifactCountBaseStat and friends),
 * !!def.saga, or a 'legendary' subtype substring; "non-Assassin" excludes
 * anything whose subtype contains that word. */
export interface ReturnTargetNonAssassinHistoricFromGraveyardToHandEffect {
  type: 'returnTargetNonAssassinHistoricFromGraveyardToHand';
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
  /** "...a Human creature card from among them..." (Bartz Klauser) - an
   * ADDITIONAL AND-constraint on top of filterType (which stays 'creature'
   * for this card), rather than a replacement for it. */
  filterSubtype?: string;
  /** "...a non-Human creature card from among them..." (Seymour Guado) -
   * the negated cousin of filterSubtype above: excludes any card whose
   * subtype contains this string, rather than requiring it. Checked
   * alongside filterType/filterSubtype (all three AND together when
   * present), never together with filterSubtype on the same effect (no
   * current card needs both an inclusion and exclusion). */
  excludeSubtype?: string;
  /** Where the cards NOT put into hand go. Defaults to 'bottomOfLibrary'
   * (Ashe, Princess of Dalmasca's wording). 'graveyard' matches "put the
   * rest into your graveyard" (Resentful Revelation) - note that wording
   * also drops the "may" (the pick becomes mandatory) and removes the type
   * filter (ANY card may be picked), both still handled the same way by
   * resolveRevealFiltered; only the destination differs. */
  restDestination?: 'bottomOfLibrary' | 'graveyard';
  /** Where the chosen card goes. Defaults to 'hand'. 'battlefieldTapped'
   * (Ignis Scientia's "put a land card from among them onto the battlefield
   * tapped") is a genuine zone change onto the battlefield - unlike every
   * other destination here, this triggers the card's own onEnter effects
   * and, if it's a land, landfall - see engine/actions.ts: resolveRevealFiltered.
   * 'battlefieldTappedAttacking' (Bartz Klauser's "...onto the battlefield
   * tapped and attacking") additionally joins the ALREADY-DECLARED attack
   * (appended to GameState.declaredAttackers/combatAssignments), same
   * mechanism as CreateTokenEffect.entersAttacking. 'battlefieldUntapped'
   * (Seymour Guado's own {5}{G}{U} ability, "put a non-Human creature card
   * from among them onto the battlefield" with no "tapped" in the printed
   * text) - a genuine zone change like battlefieldTapped, just entering
   * untapped (with summoning sickness, same as any other new arrival). */
  takenDestination?: 'hand' | 'battlefieldTapped' | 'battlefieldTappedAttacking' | 'battlefieldUntapped';
  /** "It gains indestructible until end of turn." (Bartz Klauser) - applied
   * to the taken card only when it actually enters the battlefield. */
  thenGrantsIndestructibleUntilEndOfTurn?: boolean;
}

/** "Hideaway N (When this land enters, look at the top N cards of your
 * library, exile one face down, then put the rest on the bottom in a random
 * order.)" (Clive's Hideaway) - unlike RevealFilteredEffect, the exiled card
 * is face down (hidden from both players, not just off-limits to the
 * opponent - see CardInstance.faceDown) and tied specifically to THIS
 * permanent (CardInstance.hideawayExiledCardId) so its own later release
 * ability (CardAbility.playHideawayCard) knows which card is "the exiled
 * card". Pauses on GameState.pendingHideaway for the required (not
 * optional - there's no "may" in the reminder text) pick. See
 * engine/actions.ts: resolveHideaway. */
export interface HideawayEffect {
  type: 'hideaway';
  count: number;
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
 * instead of a hand-discard cost. Resolved via GameState.pendingLibrarySearch
 * (see engine/effects.ts: matchesLibrarySearchFilter), same as every other
 * SearchLibraryFor*Effect below. */
export interface SearchLibraryForLandEffect {
  type: 'searchLibraryForLand';
  landName: string;
  /** "...put it onto the battlefield, then shuffle" (Three Visits) instead
   * of the default "...put it into your hand". */
  toBattlefieldUntapped?: boolean;
  /** "Search for up to N [landName] cards" (Archaeomancer's Map's "up to
   * two basic Plains cards") - chains N sequential picks via
   * GameState.pendingLibrarySearch.remainingPicks, always with
   * allowDuplicateNames (every match necessarily shares the same
   * landName already, so there's no "different names" possibility to even
   * consider). Omitted/1 means the plain single-pick search every other
   * card using this effect already has. */
  count?: number;
}

/** "Search your library for a basic land card, reveal it, put it into your
 * hand, then shuffle" (World Map) - unlike SearchLibraryForLandEffect (one
 * exact printed name), this matches ANY of the 5 basic lands - the
 * controller's own pick (see GameState.pendingLibrarySearch), not just
 * whichever comes first in library order. */
export interface SearchLibraryForBasicLandEffect {
  type: 'searchLibraryForBasicLand';
  /** "...put it onto the battlefield tapped" (Summon: Fenrir's Crescent
   * Fang) instead of the default "...put it into your hand". */
  toBattlefieldTapped?: boolean;
  /** "Search your library for a Plains, Island, Swamp, or Mountain card"
   * (Farseek) - excludes specific basic land names from an otherwise
   * "any basic land" search. Reuses GameState.pendingLibrarySearch's
   * existing excludeNames field (originally built for Reach the Horizon's
   * "different names" chaining), just seeded up front here instead of
   * accumulated turn by turn. */
  excludeNames?: string[];
}

/** "Search your library for a basic land card or [subtype] card" (Prishe's
 * Wanderings' "...or Town card", Sazh Katzroy's "a Bird or basic land
 * card") - the OR-filter counterpart to SearchLibraryForBasicLandEffect,
 * using LibrarySearchFilter's 'basicLandOrSubtype' kind. */
export interface SearchLibraryForBasicLandOrSubtypeEffect {
  type: 'searchLibraryForBasicLandOrSubtype';
  subtype: string;
  toBattlefieldTapped?: boolean;
  /** "Search for up to N ... with different names" (Reach the Horizon) -
   * chains N sequential single-card searches (see GameState.pendingLibrarySearch's
   * remainingPicks/excludeNames), each excluding every name already found by
   * an earlier pick in the same chain. Omitted/1 means the plain single-pick
   * search every other card using this effect already has. */
  count?: number;
}

/** "When you next cast a creature spell this turn, [bonus]" (Summon:
 * Fenrir's Heavenward Howl, Summon: Brynhildr's Gestalt Mode) - see
 * GameState.pendingNextCreatureSpellBonus. Immediate, no targeting - just
 * arms the delayed trigger. */
export interface SetPendingNextCreatureSpellBonusEffect {
  type: 'setPendingNextCreatureSpellBonus';
  counterLabel?: string;
  counterAmount?: number;
  grantsHaste?: boolean;
  /** "When you next cast a BIRD creature spell this turn, ..." (Chocobo
   * Camp) - narrows the default ("a creature spell", no restriction) down
   * to a specific subtype, matched the same substring way as every other
   * subtype filter in this engine. */
  subtypeFilter?: string;
}

/** "Search your library for a land card, reveal it, put it into your hand,
 * then shuffle" (World Map) - the ANY-land counterpart to
 * SearchLibraryForBasicLandEffect above, matching every CardDefinition.type
 * === 'land', basic or not. */
export interface SearchLibraryForAnyLandEffect {
  type: 'searchLibraryForAnyLand';
  /** "...put it onto the battlefield tapped, then shuffle" (Astral Titan)
   * instead of the default "...put it into your hand". */
  toBattlefieldTapped?: boolean;
  /** "...search your library for up to two land cards..." (Astral Titan) -
   * chains N sequential, independently decline-able picks via
   * GameState.pendingLibrarySearch.remainingPicks, same shape as
   * SearchLibraryForLandEffect.count. Omitted/1 means the plain
   * single-pick search World Map's own wording already has. */
  count?: number;
}

/** "Reveal the top ten cards of your library. For each card type, you may
 * put a card of that type from among the revealed cards into your hand.
 * Put the rest on the bottom of your library in a random order." (Sephiroth,
 * the Savior) - all six real card types this engine has (CardType) are
 * eligible, one pick per type, resolved as a sequence of individual picks
 * (one RESOLVE_REVEAL_TOP_N_THEN_PUT_ONE_OF_EACH_CARD_TYPE call per card
 * taken, ending in a null to stop early) rather than a single simultaneous
 * choice - produces the same final result since all picks come from the
 * same already-revealed, already-off-the-library pool. See
 * GameState.pendingRevealTopNThenPutOneOfEachCardType. */
export interface RevealTopNThenPutOneOfEachCardTypeToHandEffect {
  type: 'revealTopNThenPutOneOfEachCardTypeToHand';
  count: number;
}

/** "Search your library for up to two basic land cards, reveal those
 * cards, put one onto the battlefield tapped and the other into your
 * hand, then shuffle." (Cultivate) - approximated as TWO independent "up
 * to one" searches chained via GameState.pendingLibrarySearch.
 * chainedSearchToHand (first to the battlefield tapped, then to hand)
 * rather than one true "up to two, split across two destinations" search -
 * functionally identical for the 0/1/2-found outcomes a basic-land search
 * can actually produce, without needing a new "which of these N picks
 * goes where" pending shape. */
export interface CultivateEffect {
  type: 'cultivate';
}

/** "Look at the top seven cards of your library. Put two of them into
 * your hand and the rest on the bottom of your library in any order."
 * (Dig Through Time) - the "in any order" half is approximated the same
 * way every other "rest in a random order" card in this engine already
 * is (shuffled, rather than player-arranged). See
 * GameState.pendingLookAtTopNPutMToHandRestToBottom, engine/actions.ts:
 * resolveLookAtTopNPutMToHandRestToBottom. */
export interface LookAtTopNPutMToHandRestToBottomEffect {
  type: 'lookAtTopNPutMToHandRestToBottom';
  count: number;
  keepCount: number;
}

/** "Each creature that convoked this spell connives." (Lethal Scheme) -
 * reads `convokedInstanceIds` (threaded through resolveCardEffects the
 * same way wasKicked/chosenX already are - see engine/actions.ts:
 * castCard, the only caller that ever has real Convoke creatures to
 * report). Each one draws a card, then discards a card; if that discard
 * is a NONLAND card, a +1/+1 counter goes on the SAME creature. No-op if
 * nothing convoked this cast. See GameState.pendingDiscard's
 * thenCounterOnInstanceIdIfNonland/thenContinueConniveQueue. */
export interface ConniveConvokingCreaturesEffect {
  type: 'conniveConvokingCreatures';
}

/** "You become the monarch." (Palace Jailer) - see GameState.monarchPlayerId.
 * Becoming the monarch while already the monarch is a harmless no-op
 * (same player stays monarch). */
export interface BecomeMonarchEffect {
  type: 'becomeMonarch';
}

/** "Target opponent becomes the monarch." (Garland, Royal Kidnapper) -
 * "target opponent" is approximated as THE opponent (a 2-player engine has
 * no genuine choice to make), same simplification as ChooseOpponentEffect.
 * The "whenever an opponent becomes the monarch, gain control of target
 * creature that player controls for as long as they're the monarch" half
 * is deferred - no mechanism in this engine ties a control change's
 * duration to the monarchy persisting/changing (unlike
 * exileUntilMonarchChangesFrom, which only ever RELEASES something back,
 * never needs to revert an ownership-preserving control grant). */
export interface TargetOpponentBecomesMonarchEffect {
  type: 'targetOpponentBecomesMonarch';
}

/** "An opponent chooses one of the exiled cards. You put that card on the
 * bottom of your library and return the other to the battlefield tapped.
 * You become the monarch." (Coin of Fate) - reads the two ids exiled by
 * CardAbility.cost.exileChosenCreatureCardsFromGraveyard via
 * resolveCardEffects's exiledCostInstanceIds parameter. Arms
 * GameState.pendingOpponentChoosesExiledCard (the OPPONENT makes this
 * pick, not the controller) - cleared by RESOLVE_OPPONENT_CHOOSES_EXILED_CARD,
 * which also resolves the bottom/return/monarch payout. */
export interface OpponentChoosesOneOfExiledCardsToBottomRestReturnsTappedThenBecomeMonarchEffect {
  type: 'opponentChoosesOneOfExiledCardsToBottomRestReturnsTappedThenBecomeMonarch';
}

/** "Exile target creature an opponent controls until an opponent becomes
 * the monarch." (Palace Jailer) - in this 2-player engine, "an opponent
 * becomes the monarch" simplifies to "the monarchy changes away from
 * whoever is exiling it right now" (there's only one opponent it could
 * change TO). See GameState.exileUntilMonarchChangesFrom, engine/actions.ts:
 * chooseTarget's own branch (arms it) and wherever monarchPlayerId is
 * reassigned (releases it). */
export interface ExileTargetCreatureUntilMonarchChangesEffect {
  type: 'exileTargetCreatureUntilMonarchChanges';
}

/** "When this creature enters, exile up to one other target creature.
 * That creature's controller gains life equal to its power." (Solitude) -
 * "other" excludes the source itself (so a creature can never target
 * itself even though it just entered too); no controller restriction
 * otherwise. Power is read at the moment of exile (engine/combat.ts:
 * effectivePower). See engine/actions.ts: chooseTarget. */
export interface ExileUpToOneOtherTargetCreatureThenControllerGainsLifeEqualToItsPowerEffect {
  type: 'exileUpToOneOtherTargetCreatureThenControllerGainsLifeEqualToItsPower';
}

/** "When this creature enters, target opponent reveals their hand. You
 * choose a nonland card from it. That player discards that card." (Grief) -
 * "target opponent" simplifies to the one opponent in this 2-player
 * engine (no separate CHOOSE_PLAYER_TARGET step needed), but unlike
 * every pendingDiscard-based discard in this engine (chooser === discarder),
 * here the CONTROLLER picks and the OPPONENT discards - a dedicated
 * pending state (GameState.pendingChooseCardFromOpponentHandToDiscard),
 * not pendingDiscard. Mandatory if the opponent has any nonland card. See
 * engine/actions.ts: resolveChooseCardFromOpponentHandToDiscard. */
export interface RevealOpponentHandChooseNonlandCardThenDiscardEffect {
  type: 'revealOpponentHandChooseNonlandCardThenDiscard';
}

/** "When this creature enters, it deals [totalDamage] damage divided as
 * you choose among any number of target creatures and/or planeswalkers."
 * (Fury) - this engine has no 'planeswalker' CardType, so only creatures
 * are reachable; no controller restriction (either player's creatures are
 * fair game). Resolved as a sequence of (target, amount) picks via
 * GameState.pendingDivideDamageAmongTargets/RESOLVE_DIVIDE_DAMAGE_AMONG_TARGETS -
 * the first pick is mandatory if any legal target exists, each pick must
 * assign at least 1 of the remaining damage to a NOT-yet-chosen creature,
 * and the sequence auto-finishes once the full amount is assigned or no
 * further distinct targets remain. */
export interface DivideDamageAmongChosenTargetsEffect {
  type: 'divideDamageAmongChosenTargets';
  totalDamage: number;
}

/** "When this creature enters, up to one target player puts all the
 * cards from their graveyard on the bottom of their library in a random
 * order." (Endurance) - the first "up to one" (declinable) use of the
 * existing pendingPlayerTarget/CHOOSE_PLAYER_TARGET flow; every prior
 * effect sharing that flow is mandatory. See engine/actions.ts:
 * choosePlayerTarget. */
export interface GraveyardToBottomOfLibraryForTargetPlayerEffect {
  type: 'graveyardToBottomOfLibraryForTargetPlayer';
}

/** "All creatures get -X/-X until end of turn." (Toxic Deluge) - X is
 * read from the chosenX param (see CardDefinition.additionalCostPayXLife,
 * the "pay X life" additional cost this always pairs with). Applies to
 * every creature on BOTH battlefields unconditionally, then sweeps any
 * that end up with effectiveToughness <= 0 to their owner's graveyard -
 * indestructible does NOT save a creature from 0 toughness (that's a
 * state-based "it ceases to exist as a creature" rule in real Magic, not
 * a destroy effect). See engine/effects.ts's own resolution (no dedicated
 * action needed - this resolves immediately, same as any other
 * unconditional board-wide effect). */
export interface AllCreaturesGetNegativeChosenXUntilEndOfTurnEffect {
  type: 'allCreaturesGetNegativeChosenXUntilEndOfTurn';
}

/** "When you cast this spell, any player may pay half their life, rounded
 * up. If a player does, counter [this]. Take an extra turn after this
 * one." (Temporal Extortion) - "any player" is approximated as just the
 * one opponent (same "a rational caster never counters their own spell"
 * simplification as every other "any/each player" effect in this engine
 * that only ever matters for an opponent). This engine has no stack, so
 * "counter" here just means "skip queuing the extra turn" - the spell
 * still resolves everything else normally (there's nothing else to
 * resolve). Arms GameState.pendingPayHalfLifeToCounterChoice/
 * RESOLVE_PAY_HALF_LIFE_TO_COUNTER_CHOICE. */
export interface AnyPlayerMayPayHalfLifeToCounterThenExtraTurnEffect {
  type: 'anyPlayerMayPayHalfLifeToCounterThenExtraTurn';
}

/** "Search target opponent's library for a card and exile it face down.
 * Then that player shuffles. You may play that card for as long as it
 * remains exiled." (Praetor's Grasp) - unlike every SearchLibraryFor*Effect
 * elsewhere (always the searcher's OWN library, result to hand/battlefield),
 * this searches the OPPONENT's library and exiles the result face down,
 * granting the CONTROLLER a persistent GameState.exilePlayGrants entry (no
 * expiresAtCleanup - "for as long as it remains exiled" is just the normal
 * persistent-grant shape, consumed automatically once actually cast, same
 * as Lightning, Security Sergeant's own persistent grant). Mandatory if
 * the opponent's library isn't empty. See GameState.pendingSearchOpponentLibraryToExile,
 * engine/actions.ts: resolveSearchOpponentLibraryToExile. */
export interface SearchOpponentLibraryExileFaceDownThenMayPlayEffect {
  type: 'searchOpponentLibraryExileFaceDownThenMayPlay';
}

/** "At the beginning of combat on your turn, target creature you control
 * gets +X/+0 until end of turn, where X is the number of [subtype] you
 * control." (Heidegger, Shinra Executive's "Soldiers") - the subtype
 * count is read fresh at the moment the target is actually chosen (not
 * when this armed), same "live, not snapshotted" convention as every
 * other dynamic-amount effect here. Always restricted to the controller's
 * own creatures (the printed text already says "you control", unlike
 * PutCounterOnUpToOneOtherCreatureEqualToOwnPowerEffect's optional
 * restrictToOwnCreature). */
export interface PumpTargetOwnCreatureByControlledSubtypeCountEffect {
  type: 'pumpTargetOwnCreatureByControlledSubtypeCount';
  subtype: string;
}

/** "At the beginning of your end step, create a number of 1/1 white
 * Soldier creature tokens equal to the number of opponents who control
 * more creatures than you." (Heidegger, Shinra Executive) - "the number
 * of opponents who..." simplifies to 0 or 1 in this 2-player engine (the
 * one opponent either qualifies or doesn't), same established
 * "each/number of opponents" simplification used throughout this engine. */
export interface CreateTokenIfOpponentControlsMoreCreaturesThanYouEffect {
  type: 'createTokenIfOpponentControlsMoreCreaturesThanYou';
  tokenId: string;
}

/** "Each opponent who lost life this turn sacrifices a creature with the
 * greatest power among creatures they control." (Papalymo Totolymo) -
 * "each opponent" is the one opponent in this 2-player engine; checked
 * against PlayerState.lifeLostThisTurn. Ties for "greatest power" are
 * broken by auto-picking the first one found (same simplification as
 * every other "the [superlative]" auto-pick in this engine - no current
 * card needs the controller to choose among tied candidates). */
export interface EachOpponentWhoLostLifeSacrificesGreatestPowerCreatureEffect {
  type: 'eachOpponentWhoLostLifeSacrificesGreatestPowerCreature';
}

/** What GameState.pendingLibrarySearch is currently restricted to - the
 * controller only ever sees (and can only ever pick from) cards in their
 * library actually matching this, same way a real search says "for a
 * [type/subtype/name] card" and nothing else is a legal find. See
 * engine/effects.ts: matchesLibrarySearchFilter. */
export type LibrarySearchFilter =
  | { kind: 'basicLand' }
  | { kind: 'anyLand' }
  | { kind: 'landByName'; name: string }
  | { kind: 'subtype'; subtype: string }
  | { kind: 'exactName'; name: string }
  /** "Search for a basic land card OR a [subtype] card" (Prishe's
   * Wanderings' "...or Town card", Sazh Katzroy's "a Bird or basic land
   * card") - an OR of the 'basicLand' and 'subtype' kinds above, since
   * neither alone can express "either of these two, controller's choice". */
  | { kind: 'basicLandOrSubtype'; subtype: string }
  /** "Search your library for a creature card with mana value [N] or less"
   * (Ranger-Captain of Eos) - same shape as 'subtype' above, just filtered
   * on type + a manaValue(parseCostLabel(...)) ceiling instead of subtype
   * text. */
  | { kind: 'creatureWithManaValueAtMost'; maxManaValue: number }
  /** "Target player searches their library for a card, then shuffles and
   * puts that card on top." (Ardyn Izunia's Boast) - no restriction
   * whatsoever, matching any card at all. */
  | { kind: 'any' };

/** "Target creature gets +X/+Y (and gains [grantKeyword]) until end of turn"
 * (Blitzball Shot) - a SINGLE chosen target, unlike PumpAttackersEffect
 * (every currently-declared attacker). No controller restriction is stated
 * on the card, so any creature either player controls is a legal target -
 * same as DestroyTargetEffect. See CardInstance.temporaryKeywords. */
export interface PumpTargetEffect {
  type: 'pumpTarget';
  power: number;
  toughness: number;
  /** A string[] grants more than one keyword at once (Slayers' Stronghold's
   * "...and gains vigilance and haste until end of turn"). */
  grantKeyword?: string | string[];
  /** "Target creature YOU control..." (Magic Damper) - narrows down from
   * the default (either player's creature is fair game). */
  restrictToOwnCreature?: boolean;
  /** "...Untap it." (Magic Damper) - applied alongside the pump/keyword
   * grant, not conditioned on anything. */
  alsoUntap?: boolean;
  /** "...and gains 'When this creature dies, put a number of +1/+1 counters
   * equal to its power on up to one target creature'" (Galuf's Final Act) -
   * sets CardInstance.temporaryOnDeathPutCountersEqualToPower on the target,
   * checked by engine/effects.ts: resolveOnDeathTriggers. */
  grantsTemporaryOnDeathPutCountersEqualToPower?: boolean;
}

/** "Target permanent gains [keyword, keyword] until end of turn"
 * (Restoration Magic's Cure/Cura tiers) - unlike PumpTargetEffect (creature
 * only, and always a stat change), this targets ANY permanent type and
 * only ever grants keywords, no power/toughness. See
 * CardInstance.temporaryKeywords, engine/effects.ts: grantTemporaryKeyword
 * (already type-agnostic - works on any permanent). */
export interface GrantKeywordsToTargetPermanentEffect {
  type: 'grantKeywordsToTargetPermanent';
  keywords: string[];
  /** Restricts the legal target to creatures only (Blitzball Stadium's "Go
   * for the Goal!": "target creature ... can't be blocked") - omitted
   * (false) preserves the default any-permanent targeting Restoration
   * Magic's "target permanent" uses. See engine/combat.ts:
   * isLegalPendingTarget. */
  creatureOnly?: boolean;
  /** "...target creature YOU control..." (Hugo Kupka) - narrows down from
   * the default (either player's permanent is fair game), same convention
   * as PumpTargetEffect.restrictToOwnCreature. Only meaningful alongside
   * creatureOnly (every current user of this flag sets both). */
  restrictToOwnCreature?: boolean;
  /** "...target creature AN OPPONENT controls..." (Fated Clash's second
   * target) - the inverse of restrictToOwnCreature above. */
  restrictToOpponentCreature?: boolean;
  /** "Up to one target creature can't be blocked this turn." (Key to the
   * City) - declinable via CHOOSE_TARGET's null convention, same as
   * destroyTarget.optional/attachSelfToTarget.optional. Omitted (false)
   * preserves the default mandatory targeting every other current user of
   * this effect has. */
  optional?: boolean;
  /** "ANOTHER target creature you control..." (The Destined Black/White/
   * Thief Mage cycle's own activated abilities) - excludes the activating
   * permanent itself from the legal targets, same "another" convention as
   * GrantKeywordToAnotherTargetAttackingCreatureEffect. Only meaningful
   * alongside restrictToOwnCreature (every current user of this flag sets
   * both). */
  excludesSource?: boolean;
}

/** "...Thancred Waters gains indestructible until end of turn." (Thancred
 * Waters's noncreature-cast trigger) - a plain self-targeted temporary
 * keyword grant, no counter/target/condition attached (unlike every
 * sibling self-buff shape elsewhere, which all bundle in something else).
 * See engine/effects.ts: grantTemporaryKeyword. */
export interface GrantTemporaryKeywordToSelfEffect {
  type: 'grantTemporaryKeywordToSelf';
  keyword: string;
}

/** "...another target legendary permanent you control gains indestructible
 * for as long as you control Thancred Waters." (Thancred Waters's Royal
 * Guard) - unlike a temporary (until-end-of-turn) grant, this is
 * PERSISTENT but conditional: re-checked live (engine/combat.ts:
 * checkIndestructibleOrShielded) against whether `sourceInstanceId` (the
 * granting permanent) is STILL on a battlefield, not a one-time snapshot.
 * See CardInstance.grantedIndestructibleWhileSourceInPlay. */
export interface GrantIndestructibleToTargetWhileSourceInPlayEffect {
  type: 'grantIndestructibleToTargetWhileSourceInPlay';
}

/** "Permanents you control gain [keyword, keyword] until end of turn"
 * (Restoration Magic's Curaga tier) - the board-wide, no-targeting
 * counterpart to GrantKeywordsToTargetPermanentEffect. */
export interface GrantKeywordsToControlledPermanentsEffect {
  type: 'grantKeywordsToControlledPermanents';
  keywords: string[];
}

/** "Creatures you control with flying get +1/+1 and gain vigilance until
 * end of turn." (Rinoa, Angel Wing) - unlike
 * GrantKeywordsToControlledPermanentsEffect above (every controlled
 * permanent, keywords only), this is filtered to creatures that already
 * have `filterKeyword` and bundles in a stat pump alongside the granted
 * keywords. */
export interface PumpControlledCreaturesWithKeywordEffect {
  type: 'pumpControlledCreaturesWithKeyword';
  filterKeyword: string;
  power: number;
  toughness: number;
  grantKeywords?: string[];
}

/** "Creatures you control get +1/+0 until end of turn. If you have a full
 * party, creatures you control get +3/+0 until end of turn instead." (The
 * Destined Warrior) - every creature the controller controls, no filter,
 * scaled by hasFullParty (engine/actions.ts) at resolution time. */
export interface PumpAllControlledOrMoreWithFullPartyEffect {
  type: 'pumpAllControlledOrMoreWithFullParty';
  power: number;
  toughness: number;
  fullPartyPower: number;
  fullPartyToughness: number;
}

/** "All creatures gain [keyword, keyword] until end of turn." (Noctis Lucis
 * Caelum's {R} ability) - unlike GrantKeywordsToControlledPermanentsEffect
 * above (the activator's own permanents only), this hits every CREATURE on
 * EITHER battlefield, no owner restriction at all. */
export interface GrantKeywordsToAllCreaturesEffect {
  type: 'grantKeywordsToAllCreatures';
  keywords: string[];
}

/** "Gain control of target creature [an opponent controls] until end of
 * turn. Untap it. It gains [keywords] until end of turn." (Unexpected
 * Request, Zidane, Tantalus Thief) - moves the CardInstance to the
 * caster's battlefield array (ownerId unchanged), marking it with
 * CardInstance.temporaryControlUntilEndOfTurn so it automatically reverts
 * at cleanup. See engine/actions.ts: chooseTarget, applyCleanupResets. */
export interface GainControlOfTargetCreatureEffect {
  type: 'gainControlOfTargetCreature';
  untap?: boolean;
  grantKeywords?: string[];
  /** "...an opponent controls" (Zidane) - narrows from the default (any
   * creature, including your own, though gaining control of your own
   * creature would be a no-op). */
  opponentControlledOnly?: boolean;
}

/** "Goad target creature." (Seifer, Balamb Rival) - sets
 * CardInstance.goadedUntilControllerNextUntapStep on an OPPONENT's
 * creature (goading your own would be a pointless no-op, same reasoning
 * as gainControlOfTargetCreature's own opponentControlledOnly), enforced
 * the same way as CardDefinition.mustAttackIfAble. See that field's own
 * doc comment for why the rest of real Goad's text is redundant in a
 * 2-player engine. */
export interface GoadTargetCreatureEffect {
  type: 'goadTargetCreature';
}

/** "Target creature you control and target creature an opponent controls
 * each gain indestructible until end of turn. Then destroy all
 * creatures." (Fated Clash) - a two-step pendingTarget.firstInstanceId
 * chain (own creature first, then an opponent's), same shape as
 * DealDamageToAnyOtherTargetAndSelfEffect, ending in an unconditional
 * destroyAll('creature') once both picks are in. The alternate-flash-
 * timing condition ("if a creature is attacking and a creature is
 * blocking") is deferred, same category as every other conditional-flash
 * clause in this engine. */
export interface GrantIndestructibleToOwnAndOpponentCreatureThenDestroyAllEffect {
  type: 'grantIndestructibleToOwnAndOpponentCreatureThenDestroyAll';
}

/** "Gain control of target noncreature artifact for as long as you control
 * [this]." (Yuffie, Materia Hunter) - APPROXIMATED as a PERMANENT control
 * change (same array-move mechanism as GiveControlOfAnotherOwnPermanentToOpponentEffect),
 * since nothing in this engine watches "permanent X leaves the battlefield"
 * in order to revert a DIFFERENT permanent's control - the same gap
 * documented for Resourceful Defense's "leaves the battlefield" scope. If
 * Yuffie later dies/is bounced/is exiled, the artifact simply stays under
 * its new controller instead of reverting. */
export interface GainControlOfTargetNoncreatureArtifactPermanentEffect {
  type: 'gainControlOfTargetNoncreatureArtifactPermanent';
}

/** "Whenever this creature deals combat damage to a player, gain control
 * of all artifacts that player controls." (Hellkite Tyrant) - unlike
 * GainControlOfTargetNoncreatureArtifactPermanentEffect above, needs no
 * target at all: "that player" is simply whoever this effect's own
 * onCombatDamageToPlayer trigger already identifies as the opponent.
 * PERMANENT (no "until end of turn"), same as every other control-change
 * effect in this engine except Stolen Uniform's. */
export interface GainControlOfAllArtifactsControlledByOpponentEffect {
  type: 'gainControlOfAllArtifactsControlledByOpponent';
}

/** "At the beginning of your upkeep, if you control twenty or more
 * artifacts, you win the game." (Hellkite Tyrant) - sets GameState.winnerId
 * directly, same mechanism already used for "causes [opponent] to lose
 * the game" (see engine/combat.ts). Checked live against the controller's
 * current battlefield at resolution time, not a cached count. */
export interface WinGameIfControlAtLeastNOfTypeEffect {
  type: 'winGameIfControlAtLeastNOfType';
  count: number;
  cardType: CardType;
}

/** "Each opponent may sacrifice a nontoken creature of their choice. Each
 * opponent who doesn't loses [lifePerCard] life for each instant and
 * sorcery card in your graveyard." (Fandaniel, Telophoroi Ascian) - in
 * this 2-player engine "each opponent" is the one opponent, so this just
 * arms GameState.pendingFandanielChoice for them: pick a nontoken creature
 * to sacrifice, or decline (null) to instead lose life equal to
 * `lifePerCard` times however many instant/sorcery cards sit in the
 * CONTROLLER's (not the decider's) graveyard at resolution time. See
 * engine/actions.ts: resolveFandanielChoice. */
export interface EachOpponentMaySacrificeNontokenCreatureElseLoseLifePerInstantSorceryEffect {
  type: 'eachOpponentMaySacrificeNontokenCreatureElseLoseLifePerInstantSorcery';
  lifePerCard: number;
}

/** "Target opponent may have you draw [count] cards. If the player
 * doesn't, you mill [count] cards, then this creature deals damage to
 * that player equal to the total mana value of those cards." (Combustible
 * Gearhulk) - "target opponent" is just the one opponent in this 2-player
 * engine, so this arms GameState.pendingOpponentMayHaveYouDrawElseMillAndDealDamage
 * for them: accept lets the controller draw, decline mills instead and
 * deals damage back to the DECIDER equal to the milled cards' total mana
 * value. See engine/actions.ts: resolveOpponentMayHaveYouDrawElseMillAndDealDamage. */
export interface OpponentMayHaveYouDrawElseMillAndDealDamageEffect {
  type: 'opponentMayHaveYouDrawElseMillAndDealDamage';
  count: number;
}

/** "Target opponent gains control of another target permanent you
 * control. If they do, you draw a card." (Stiltzkin, Moogle Merchant) -
 * unlike GainControlOfTargetCreatureEffect, this is PERMANENT (no "until
 * end of turn") and goes the other way: the CASTER gives away one of
 * their OWN other permanents. Same array-move mechanism as Kain,
 * Traitorous Dragoon's automatic version, just player-chosen. In this
 * 2-player engine "target opponent" is simply the one opponent, so only
 * the second target (the permanent to give away) needs an actual pick. */
export interface GiveControlOfAnotherOwnPermanentToOpponentEffect {
  type: 'giveControlOfAnotherOwnPermanentToOpponent';
  drawCard?: boolean;
}

/** "Choose target creature you control and target Equipment. Gain control
 * of that Equipment until end of turn. Attach it to the chosen creature."
 * (Stolen Uniform) - a two-step pick (own creature first, then any
 * Equipment either player controls), same firstInstanceId pattern as
 * ChooseCreaturesFightEffect. The Equipment's control change is temporary
 * (CardInstance.temporaryControlUntilEndOfTurn), same as
 * GainControlOfTargetCreatureEffect. The card's own delayed "unattach it
 * when you lose control of it this turn" clause is NOT implemented (see
 * the deferred comment on the card itself). */
export interface GainControlOfTargetEquipmentAndAttachEffect {
  type: 'gainControlOfTargetEquipmentAndAttach';
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

/** "Whenever this creature attacks, another target attacking creature
 * gains [keyword] until end of turn." (Helitrooper) - unlike
 * GrantKeywordToOtherAttackersEffect above (ALL other attackers,
 * unconditional), this is a SINGLE targeted pick, same
 * pendingTarget/CHOOSE_TARGET flow as UntapTargetAttackerEffect, just
 * additionally excluding the source itself ("another"). Mandatory - no
 * "up to one" wording - but only armed if another attacker actually
 * exists. See engine/actions.ts: chooseTarget. */
export interface GrantKeywordToAnotherTargetAttackingCreatureEffect {
  type: 'grantKeywordToAnotherTargetAttackingCreature';
  keyword: string;
}

/** "Mug — Whenever Locke attacks, each player mills a card. If a land
 * card was milled this way, create a Treasure token. Until end of turn,
 * you may cast a spell from among those cards." (Locke, Treasure Hunter) -
 * "you" (who may cast) is Locke's controller (the attacker), regardless
 * of which player's library the eligible card actually came from. Unlike
 * Flashback (a fixed alternate cost baked into the card), this grants a
 * ONE-TURN permission to cast the milled card from its OWNER's graveyard
 * for its normal printed cost - see GameState.graveyardPlayGrants,
 * engine/actions.ts: castFromGraveyard (extended to also accept a
 * matching grant, not just def.flashback). */
export interface MugEffect {
  type: 'mug';
}

/** "You lose N life" (Circle of Power) - unlike a negative GainLifeEffect,
 * this deliberately does NOT run onGainLifeTrigger (losing life isn't
 * gaining it). */
export interface LoseLifeEffect {
  type: 'loseLife';
  amount: number;
}

/** "Each player loses N life" (Summon: Primal Odin's Hall of Sorrow chapter)
 * - unlike LoseLifeEffect above (the controller only), this hits BOTH
 * players; this engine is 2-player only, so "each player" is simply the
 * caster and their one opponent, with no need for a per-player targeting
 * loop. Also deliberately doesn't run onGainLifeTrigger, same reasoning as
 * LoseLifeEffect. */
export interface EachPlayerLosesLifeEffect {
  type: 'eachPlayerLosesLife';
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

/** "Put a [counterLabel] counter on each [subtype] creature you control.
 * They gain [grantKeyword] until end of turn." (Ardbert, Warrior of
 * Darkness) - the PERMANENT-counter cousin of PumpControlledSubtypeEffect
 * above (that one is a temporary stat buff); matched the same
 * case-insensitive substring way against each creature's subtype text,
 * INCLUDING the source itself if it matches (unlike
 * BuffOtherCreaturesYouControlEffect's "each OTHER creature") UNLESS
 * excludeSelf is set (Summon: Good King Mog XII's chapter IV - "each OTHER
 * Moogle you control", since the Saga itself is also a Moogle). */
export interface PutCounterOnEachControlledCreatureMatchingSubtypeEffect {
  type: 'putCounterOnEachControlledCreatureMatchingSubtype';
  subtype: string;
  counterLabel: string;
  counterAmount: number;
  grantKeyword?: string;
  excludeSelf?: boolean;
}

/** "Whenever you cast a noncreature spell this turn, create a token that's
 * a copy of a non-Saga token you control." (Summon: Good King Mog XII's
 * chapters II/III) - sets PlayerState.
 * temporaryNoncreatureCastCreatesTokenCopyUntilEndOfTurn; see that field's
 * own doc comment for why this is a player-level flag rather than a
 * permanent-sourced NoncreatureCastTrigger. Picks the first non-Saga token
 * found when it actually fires (deliberately simple - no pendingTarget
 * built for a repeating delayed trigger). */
export interface GrantTemporaryNoncreatureCastCreatesTokenCopyEffect {
  type: 'grantTemporaryNoncreatureCastCreatesTokenCopy';
}

/** "Put N counters of [counterLabel] on target creature" (Cloudbound
 * Moogle) - a single chosen target, no controller restriction stated on the
 * card (same as PumpTargetEffect/DestroyTargetEffect). */
export interface PutCounterOnTargetEffect {
  type: 'putCounterOnTarget';
  counterLabel: string;
  counterAmount: number;
  /** "...it gains [grantKeyword] until end of turn" (Rosa, Resolute White
   * Mage's "It gains lifelink until end of turn") - applied to the SAME
   * target as the counter, same shot. */
  grantKeyword?: string;
  /** "...put a -1/-1 counter on up to one target creature..." (The
   * Emperor, Hell Tyrant's sac ability) - decline-able via the null-target
   * convention, same as destroyTarget.optional. Omitted (false) preserves
   * the default mandatory targeting every other current user of this
   * effect has. */
  optional?: boolean;
  /** "...target creature YOU control." (The Destined White Mage) - narrows
   * down from the default (either player's creature is fair game), same
   * convention as PumpTargetEffect.restrictToOwnCreature. */
  restrictToOwnCreature?: boolean;
}

/** "Whenever Sephiroth attacks, you may put a cell counter on target
 * creature. Until end of turn, each modified creature you control has
 * base power and toughness [power]/[toughness]. (Equipment, Auras you
 * control, and counters are modifications.)" (Sephiroth, Fallen Hero's
 * Jenova Cells) - the base-stat-setting half is UNCONDITIONAL (fires
 * regardless of whether the "may" counter placement is accepted or
 * declined - two separate sentences in the printed text), so it's applied
 * immediately when this effect resolves (see PlayerState.
 * modifiedCreaturesHaveBasePowerToughnessUntilEndOfTurn), while the
 * counter placement itself pauses on the usual pendingTarget/CHOOSE_TARGET
 * "may" flow (declinable - see chooseTarget's isOptional whitelist). */
export interface JenovaCellsAttackTriggerEffect {
  type: 'jenovaCellsAttackTrigger';
  counterLabel: string;
  power: number;
  toughness: number;
}

/** "Choose any number of permanents and/or players, then give each another
 * counter of each kind already there." (Lulu, Stern Guardian's {3}{U}
 * activated ability, real Magic's Proliferate) - "any number" is modeled as
 * repeat-until-decline over the EXISTING single-target pendingTarget/
 * CHOOSE_TARGET flow (see engine/actions.ts: chooseTarget's top-level
 * special case for this effect) rather than new multi-select plumbing:
 * choosing a permanent bumps every counter already on it by one and
 * re-arms this same effect for another pick, declining (a null target)
 * ends it. `alreadyChosen` tracks which instances were already picked THIS
 * resolution, so the same permanent can't be double-dipped in one
 * Proliferate. Scope note: this engine has no player-level counters of any
 * kind (no poison/energy/experience tracking on PlayerState), so unlike the
 * real card, only permanents are eligible targets - the "or players" half
 * of the printed text is a known, unimplemented gap. */
export interface ProliferateEffect {
  type: 'proliferate';
  alreadyChosen?: string[];
  /** "Proliferate X times" (Tromell, Seymour's Butler) - how many MORE
   * complete proliferate passes remain after this one; declining (finishing)
   * the current pass re-arms a fresh pass (alreadyChosen reset) as long as
   * this is still positive, instead of clearing pendingTarget outright. See
   * engine/actions.ts: chooseTarget's proliferate decline branch. Omitted
   * for a plain single "Proliferate". */
  remainingIterations?: number;
}

/** "Proliferate X times, where X is the number of nontoken creatures you
 * control that entered this turn" (Tromell, Seymour's Butler) - computes X
 * (approximated via CardInstance.summoningSick as "entered this turn", the
 * same established proxy this engine already uses elsewhere - see
 * CardDefinition.putCounterOnTargetCommanderEnteredThisTurn's doc comment),
 * then re-dispatches to an ordinary ProliferateEffect with that baked in as
 * remainingIterations. A no-op (not even armed) if X is 0. */
export interface RepeatProliferateByNontokenCreaturesEnteredThisTurnEffect {
  type: 'repeatProliferateByNontokenCreaturesEnteredThisTurn';
}

/** "Put a [counterLabel] counter on target land" (Ultima, Origin of
 * Oblivion's blight counter) - the land-only cousin of PutCounterOnTargetEffect
 * (which is creature-only). Typically paired with a matching entry in the
 * source's own CardDefinition.characteristicOverrides keyed to the same
 * counterLabel, so the counter placed here is what actually activates the
 * override. */
export interface PutCounterOnTargetLandEffect {
  type: 'putCounterOnTargetLand';
  counterLabel: string;
  counterAmount: number;
}

/** "Choose target commander that entered this turn. Put a [counterLabel]
 * counter on it if it's a creature and a loyalty counter on it if it's a
 * planeswalker" (Forge of Heroes) - the planeswalker half of that text can
 * never actually apply in this engine (CardType has no 'planeswalker'
 * variant at all, and only a creature can ever be set as commanderDefId), so
 * this always puts a counterLabel counter, no branching needed. "Entered
 * this turn" reuses CardInstance.summoningSick as the entered-this-turn
 * signal, same known approximation as CardDefinition.
 * bounceSelfAtEndStepIfNotSummoningSick (breaks for a commander that entered
 * this turn but also has haste, since summoningSick would already be false -
 * accepted as consistent with that existing precedent rather than building a
 * separate, more precise "entered this turn" tracker just for this card). */
export interface PutCounterOnTargetCommanderEnteredThisTurnEffect {
  type: 'putCounterOnTargetCommanderEnteredThisTurn';
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

/** "Target creature you control deals damage equal to its power to target
 * creature an opponent controls" (Chocobo Kick) - a ONE-DIRECTIONAL cousin
 * of ChooseCreaturesFightEffect (that one deals damage both ways; this one
 * only the chosen creature deals damage, the target never deals any back).
 * Reuses the exact same two-step pendingTarget.firstInstanceId pick. */
export interface ChooseCreatureDealsDamageToOpponentCreatureEffect {
  type: 'chooseCreatureDealsDamageToOpponentCreature';
  /** "If this spell was kicked, the creature you control deals twice that
   * much damage instead" - doubles the chosen creature's power for this
   * calculation. Only ever set true from inside an IfKickedEffect's
   * thenEffects (see CardDefinition.kicker). */
  doubleDamage?: boolean;
}

/** Branches on whether the spell's Kicker cost was paid (see
 * CardDefinition.kicker and GameAction 'CAST_CARD's kickerPaymentInstanceId) -
 * a generic wrapper so individual effects (damage, pump, ...) never need
 * their own kicker-awareness; only the branch actually taken resolves. */
export interface IfKickedEffect {
  type: 'ifKicked';
  thenEffects: CardEffect[];
  elseEffects: CardEffect[];
}

/** "If you control three or more creatures, [bigger effect] instead"
 * (You're Not Alone) - a generic board-state conditional wrapper, same
 * shape as IfKickedEffect but gated on the CASTER's own current creature
 * count instead of a kicker payment. Reusable for any future "if you
 * control N or more creatures" card regardless of what the branches do. */
export interface IfControlAtLeastCreaturesEffect {
  type: 'ifControlAtLeastCreatures';
  count: number;
  thenEffects: CardEffect[];
  elseEffects: CardEffect[];
}

/** "If you have a full party, [bigger effect] instead." (The Destined
 * Black/White/Thief/Warrior cycle) - same generic conditional-wrapper
 * shape as IfControlAtLeastCreaturesEffect above, gated on hasFullParty
 * (engine/combat.ts) instead of a plain creature count. */
export interface IfFullPartyEffect {
  type: 'ifFullParty';
  thenEffects: CardEffect[];
  elseEffects: CardEffect[];
}

/** "At the beginning of your upkeep, if you control a creature with power 7
 * or greater, draw a card." (Bugenhagen, Wise Elder) - the power-threshold
 * cousin of IfControlAtLeastCreaturesEffect above, same generic
 * thenEffects/elseEffects conditional wrapper shape. Checked live against
 * engine/combat.ts: effectivePower (temporary buffs count), true if ANY
 * controlled creature meets the threshold. */
export interface IfControlCreatureWithPowerAtLeastEffect {
  type: 'ifControlCreatureWithPowerAtLeast';
  minPower: number;
  thenEffects: CardEffect[];
  elseEffects: CardEffect[];
}

/** "Search your library and/or graveyard for an artifact card with mana
 * value N or less, reveal it, and put it into your hand. If you search
 * your library this way, shuffle" (Delivery Moogle) - unlike every other
 * SearchLibraryFor*Effect (library only), this looks in BOTH of the
 * controller's own zones at once and the player picks from whichever has a
 * match. Approximates the "if you search your library" conditional shuffle
 * as an unconditional one (the two zones are searched together, not as a
 * genuinely separate "library only" vs "graveyard only" choice). See
 * GameState.pendingLibraryOrGraveyardSearch. */
export interface SearchLibraryOrGraveyardForArtifactEffect {
  type: 'searchLibraryOrGraveyardForArtifact';
  maxManaValue: number;
}

/** "Shuffle your library, then mill four cards. Put each creature card
 * milled this way onto the battlefield. They gain haste[. At the beginning
 * of the next end step, return those creatures to their owner's hand]"
 * (Random Encounter) - unlike MillThenReturnEffect (mills to the graveyard,
 * optionally returns some to hand from THERE), this puts the milled
 * CREATURE cards straight onto the battlefield; everything else milled
 * still goes to the graveyard as normal. See
 * GameState.pendingDelayedEndStepEffects for the "at the next end step"
 * follow-up, queued dynamically against whichever specific instances this
 * created (ReturnSpecificInstancesToOwnersHandEffect). */
export interface MillThenPutCreaturesOntoBattlefieldEffect {
  type: 'millThenPutCreaturesOntoBattlefield';
  millCount: number;
  grantsHaste?: boolean;
  thenReturnToHandAtNextEndStep?: boolean;
}

/** A dynamically-generated follow-up, queued by
 * MillThenPutCreaturesOntoBattlefieldEffect (and reusable by anything else
 * that needs to bounce a specific, resolution-time-determined set of
 * instances later) rather than a fixed CardDefinition-level effect list -
 * `instanceIds` is baked in at the moment it's queued. An instance no
 * longer on the battlefield by the time this fires (already died, was
 * bounced some other way, ...) is silently skipped. */
export interface ReturnSpecificInstancesToOwnersHandEffect {
  type: 'returnSpecificInstancesToOwnersHand';
  instanceIds: string[];
}

/** The exile-zone cousin of ReturnSpecificInstancesToOwnersHandEffect above -
 * same dynamically-generated, resolution-time-determined instance list,
 * queued via QueueEffectsAtNextEndStepEffect (Inalla, Archmage Ritualist's
 * "Exile it at the beginning of the next end step" for the token copy her
 * Eminence trigger creates). An instance no longer on the battlefield by
 * the time this fires is silently skipped. */
export interface ExileSpecificInstancesEffect {
  type: 'exileSpecificInstances';
  instanceIds: string[];
}

/** "Create a token that's a copy of [the source permanent itself]." (Inalla,
 * Archmage Ritualist's Eminence trigger: "create a token that's a copy of
 * that Wizard", where "that Wizard" is the just-entered creature this
 * effect resolves with as its own sourceInstanceId) - unlike
 * CreateTokenCopyOfTargetEffect (a player-chosen target via pendingTarget),
 * this needs no targeting at all. */
export interface CreateTokenCopyOfSelfEffect {
  type: 'createTokenCopyOfSelf';
  grantsHaste?: boolean;
  /** "Exile it at the beginning of the next end step." - queues an
   * ExileSpecificInstancesEffect for the newly-created token's own
   * instanceId via QueueEffectsAtNextEndStepEffect. */
  thenExileAtNextEndStep?: boolean;
}

/** Queues `effects` to resolve at the very next end step to occur -
 * whoever's turn it is, no "your own" restriction (matching printed text
 * with no "your" qualifier, e.g. Random Encounter's "at the beginning of
 * the NEXT end step..."). Unlike CardDefinition.onOwnEndStep (a permanent's
 * own always-on trigger, gated to its controller's turn), this is a
 * one-shot dynamic queue entry - see GameState.pendingDelayedEndStepEffects
 * and engine/actions.ts: applyEndStepTriggers. */
export interface QueueEffectsAtNextEndStepEffect {
  type: 'queueEffectsAtNextEndStep';
  effects: CardEffect[];
}

/** "Exile the top two cards of your library. You may play those cards
 * until your next end step" (Opera Love Song) - since this card can only
 * ever be cast at sorcery speed (no flash), "your next end step" always
 * means later THIS SAME turn's end step, so this reuses the exact same
 * expiresAtCleanup window as Reno and Rude's this-turn grant (see
 * GameState.exilePlayGrants) rather than needing a longer-lived expiry. */
export interface ExileTopOfLibraryPlayableUntilCleanupEffect {
  type: 'exileTopOfLibraryPlayableUntilCleanup';
  count: number;
  /** "Shuffle your library, THEN exile the top card." (Terra Branford) -
   * shuffles before exiling, unlike every other current caller (which just
   * exile straight off the top). */
  shuffleFirst?: boolean;
  /** "...you may play that card without paying its mana cost." (Terra
   * Branford) - unlike Opera Love Song's normal-cost grant, this one is
   * free: baked in as GameState.exilePlayGrants.overrideCostLabel: '{0}'. */
  free?: boolean;
  /** "Until the end of your next turn, you may play those cards." (A
   * Promise Fulfilled) - unlike the default expiresAtCleanup (this same
   * turn only), this survives through the rest of this turn, the
   * opponent's whole turn, and the controller's own ENTIRE next turn,
   * expiring at ITS cleanup instead. Approximated as expiring at the
   * controller's next UNTAP step instead (same "until next turn" shorthand
   * convention as CardInstance.temporaryKeywordsUntilNextTurn) rather than
   * tracking the exact end-of-turn boundary. See GameState.exilePlayGrants.
   * expiresAtControllerNextUntapStep. */
  untilControllerNextTurn?: boolean;
}

/** "Lucky Slots — At the beginning of combat on your turn, scry 1, then
 * exile the top card of your library. You may play that card this turn.
 * When you exile a card this way, target creature you control gets +X/+0
 * until end of turn, where X is that card's mana value." (Cait Sith,
 * Fortune Teller) - the first Scry in this engine (look at the top card,
 * optionally put it on the bottom), bundled into one effect with the
 * exile/play-grant/pump that follows since the eventual pump amount
 * depends on whichever card the scry decision leaves on top. See
 * GameState.pendingScryBeforeExile (the scry step only - the ensuing pump
 * target reuses the ordinary PumpTargetEffect pendingTarget machinery with
 * its power already computed), engine/actions.ts:
 * resolveScryBeforeExile. */
export interface ScryThenExileTopPlayableThisTurnThenPumpTargetByExiledManaValueEffect {
  type: 'scryThenExileTopPlayableThisTurnThenPumpTargetByExiledManaValue';
}

/** "One or two target creatures each get +X/+Y until end of turn" (Opera
 * Love Song) - a mandatory first pick, then an OPTIONAL second (declined
 * via CHOOSE_TARGET's null convention, same as every other "up to one"
 * effect) - unlike ChooseCreaturesFightEffect's two-step pick, both targets
 * get the identical treatment rather than fighting each other, and either
 * player's creatures are fair game (no controller restriction stated). */
export interface PumpUpToTwoTargetsEffect {
  type: 'pumpUpToTwoTargets';
  power: number;
  toughness: number;
}

/** "Return target instant or sorcery card from your graveyard to your
 * hand" (Sorceress's Schemes) - a graveyard-card pick, same shape as
 * ReanimateTargetFromGraveyardEffect (its own dedicated pending state,
 * since GameState.pendingTarget is battlefield-only) but returns to hand
 * instead of the battlefield. Approximates away the printed "or exiled
 * card with flashback you own" alternate source - this engine doesn't
 * track "cards exiled specifically because they had flashback" as a
 * distinct, searchable pool. */
export interface ReturnInstantOrSorceryFromGraveyardToHandEffect {
  type: 'returnInstantOrSorceryFromGraveyardToHand';
}

/** "Put a +1/+1 counter on another target creature you control. Until your
 * next turn, it gains indestructible. If that creature is legendary, draw
 * a card" (Hydaelyn, the Mothercrystal's Blessing of Light) - mandatory if
 * a legal target exists (no "up to one"), same convention as
 * PumpAnotherControlledCreatureEffect. The keyword grant outlives a normal
 * "until end of turn" buff - see CardInstance.temporaryKeywordsUntilNextTurn,
 * cleared at the GRANTING player's own next untap step (engine/actions.ts:
 * runUntapStep) rather than at cleanup. */
export interface PutCounterOnAnotherCreatureGrantsIndestructibleUntilNextTurnEffect {
  type: 'putCounterOnAnotherCreatureGrantsIndestructibleUntilNextTurn';
  counterLabel: string;
  counterAmount: number;
  drawIfLegendary?: boolean;
}

/** "Tap: You may put a land card from your hand onto the battlefield" (PuPu
 * UFO) - unlike GameState.pendingFreeCastFromHand (casting a SPELL for
 * free), a land is never cast in the first place; this bypasses the mana
 * cost/land-drop budget entirely and doesn't count against the controller's
 * one-land-per-turn limit, matching "put onto the battlefield" (not "play")
 * wording. Triggers landfall like any other land entering. See
 * GameState.pendingPutLandFromHand. */
export interface PutLandFromHandOntoBattlefieldEffect {
  type: 'putLandFromHandOntoBattlefield';
}

/** "Whenever equipped creature attacks, look at the top card of your
 * library. If it's a land card, you may put it onto the battlefield
 * tapped." (Explorer's Scope) - the LIBRARY-TOP cousin of
 * PutLandFromHandOntoBattlefieldEffect above: no choice of WHICH card (it's
 * always whatever's on top), so the "may" is a plain accept/decline rather
 * than naming an instanceId. If the top card isn't a land, this resolves
 * immediately with no pending choice at all - only arms
 * GameState.pendingMayPutTopLandOntoBattlefieldTapped when there's actually
 * something to decide. Triggers landfall like any other land entering. See
 * engine/actions.ts: resolveMayPutTopLandOntoBattlefieldTapped. */
export interface MayPutTopLandOntoBattlefieldTappedEffect {
  type: 'mayPutTopLandOntoBattlefieldTapped';
}

/** "3: Until end of turn, this creature's base power becomes equal to the
 * number of Towns you control" (PuPu UFO) - approximates real Magic's
 * continuous, live-recomputed effect as a one-time snapshot taken at
 * activation (via CardInstance.temporaryBaseStats, same as
 * GrantTemporaryBaseStatsAndDeathReturnEffect), so a Town entering or
 * leaving LATER the same turn won't retroactively change it. Toughness is
 * left at its normal printed value - only power is set. */
export interface SetBasePowerUntilEndOfTurnToControlledSubtypeCountEffect {
  type: 'setBasePowerUntilEndOfTurnToControlledSubtypeCount';
  subtype: string;
}

/** "You may cast target instant or sorcery card from a graveyard, and mana
 * of any type can be spent to cast that spell. If that spell would be put
 * into a graveyard, exile it instead" (Quistis Trepe) - "a graveyard" (not
 * "your graveyard") means either player's is fair game. Unlike
 * ExileTopOfTargetPlayerLibraryThenOptionalSacrificeToPlayEffect's
 * exilePlayGrants (a persistent later-play permission), this is an
 * IMMEDIATE "you may cast it right now" choice, same shape as
 * GameState.pendingFreeCastFromHand - declining (or having no legal
 * target) just does nothing further. See GameState.pendingCastFromGraveyardAnyMana. */
export interface CastTargetInstantOrSorceryFromGraveyardAnyManaEffect {
  type: 'castTargetInstantOrSorceryFromGraveyardAnyMana';
  /** "...target INSTANT card..." (Torrential Gearhulk) - narrows the
   * legal target from Quistis's own "instant or sorcery" default down to
   * instants only. */
  instantOnly?: boolean;
  /** "...from YOUR graveyard..." (Torrential Gearhulk) - narrows from
   * Quistis's own "a graveyard" (either player's) down to the
   * controller's own, same flag name/meaning as
   * GameState.pendingCastFromGraveyardAnyMana.ownGraveyardOnly. */
  ownGraveyardOnly?: boolean;
  /** "...without paying its mana cost" (Torrential Gearhulk) - skips
   * payment entirely, unlike Quistis's own "mana of any type can be
   * spent" (still pays the full mana VALUE, just color-agnostically). */
  free?: boolean;
}

/** "Whenever this creature attacks, exile up to one target instant or
 * sorcery card from defending player's graveyard. If you do, copy it. You
 * may cast the copy by paying [fixedCost] rather than paying its mana
 * cost." (Blue Mage's Cane, granted via equipGrantsOnAttack) - "defending
 * player" is just the attacker's controller's one opponent in this
 * 2-player engine. This engine has no spell-copy mechanism at all (see
 * CardDefinition.onCastOrCopyInstantOrSorceryDrawCard's own doc comment),
 * so "copy it, cast the copy" is approximated as "you may cast the
 * already-exiled card itself for [fixedCost]" - mechanically identical
 * (the same effects resolve either way), just via GameState.exilePlayGrants'
 * existing overrideCostLabel instead of a nonexistent copy object. Up to
 * one target - declining (or having no legal target) does nothing further,
 * same convention as CastTargetInstantOrSorceryFromGraveyardAnyManaEffect
 * above. See engine/actions.ts: chooseTarget. */
export interface ExileTargetInstantOrSorceryFromOpponentGraveyardThenMayCastForFixedCostEffect {
  type: 'exileTargetInstantOrSorceryFromOpponentGraveyardThenMayCastForFixedCost';
  fixedCost: string;
  /** "...from YOUR graveyard..." (Dawn Warriors' Legacy's normal,
   * non-Overload mode) - flips the legal target from the default (an
   * OPPONENT's graveyard) to the controller's own, same flag name/meaning
   * as CastTargetInstantOrSorceryFromGraveyardAnyManaEffect.ownGraveyardOnly.
   * Paired with fixedCost: '{0}' for Dawn Warriors' Legacy's "without
   * paying its mana cost" (there's no dedicated `free` flag here since
   * '{0}' already parses to a trivially payable cost). See
   * engine/actions.ts: chooseTarget, engine/combat.ts: isLegalPendingTarget. */
  ownGraveyardOnly?: boolean;
}

/** "Overload {5}{R}{R}{R}" half of Dawn Warriors' Legacy - the board-wide
 * "each" version of ExileTargetInstantOrSorceryFromOpponentGraveyardThenMayCastForFixedCostEffect's
 * ownGraveyardOnly mode: no targeting at all, exiles EVERY instant or
 * sorcery card in the controller's own graveyard at once and grants each
 * one a free ExilePlayGrant (expiresAtCleanup), same "copy it, cast the
 * copy" approximation as its targeted sibling. See CardDefinition.overload,
 * engine/effects.ts: resolveCardEffects. */
export interface ExileAllInstantOrSorceryFromOwnGraveyardThenMayCastFreeEffect {
  type: 'exileAllInstantOrSorceryFromOwnGraveyardThenMayCastFree';
}

/** Armed by NoncreatureCastTrigger.mayReturnCreatureFromGraveyardWithManaValueEqualToSpentOncePerTurn
 * (Krile Baldesion's Trace Aether) - `manaValue` is fixed at the moment the
 * triggering spell was cast (the spell's own mana value), so the legal
 * target is any creature card in the controller's OWN graveyard whose mana
 * value exactly matches it. See engine/actions.ts: chooseTarget. */
export interface ReturnTargetCreatureFromGraveyardWithManaValueEqualToEffect {
  type: 'returnTargetCreatureFromGraveyardWithManaValueEqualTo';
  manaValue: number;
}

/** "Mill four cards. You may put a land card from among them into your
 * hand. If you put a Town card into your hand this way, you gain 2 life"
 * (Town Greeter) - unlike GameState.pendingReturnFromGraveyard (any
 * permanent, from the WHOLE graveyard), the pick here is restricted to
 * LANDS specifically, and only from among the cards THIS effect just
 * milled (not anything already sitting in the graveyard beforehand). See
 * GameState.pendingMillThenPutLandIntoHand. */
export interface MillThenPutLandIntoHandGainLifeIfTownEffect {
  type: 'millThenPutLandIntoHandGainLifeIfTown';
  millCount: number;
  lifeGainIfTown: number;
}

/** "Exile target creature you control, then return it to the battlefield
 * under its owner's control" (Y'shtola Rhul) - a targeted "blink": the
 * returned permanent is a genuinely NEW object (fresh instanceId, fresh
 * summoning sickness check), same convention as
 * exileAndReturnTransformed/returnSelfFromGraveyard, just for an arbitrary
 * chosen creature rather than the source itself. Mandatory if the
 * controller controls any creature (no "up to one" wording). */
export interface ExileThenReturnTargetOwnCreatureEffect {
  type: 'exileThenReturnTargetOwnCreature';
}

/** "You may attach any number of Equipment you control to target creature
 * you control" (Beatrix, Loyal General) - "any number" simplifies to "all
 * of them" (there's never a reason to attach fewer, and none of them cost
 * anything extra to move this way), so this just re-attaches EVERY
 * Equipment the controller currently controls to the chosen target, free.
 * Optional (declined via CHOOSE_TARGET's null convention). */
export interface AttachAllControlledEquipmentToTargetCreatureEffect {
  type: 'attachAllControlledEquipmentToTargetCreature';
}

/** "Whenever this creature enters or attacks, you may attach any number of
 * target Equipment to it. (Control of the Equipment doesn't change.)"
 * (Armory Automaton) - the attach-to-SELF cousin of
 * AttachAllControlledEquipmentToTargetCreatureEffect above, same "any
 * number simplifies to all of them" convention, wrapped in a MayEffectEffect
 * for the "you may". DEFERRED: the real card's "control doesn't change"
 * clause lets it borrow ANY Equipment on the battlefield, including an
 * opponent's, without taking control of it - this engine's equip-bonus
 * scanning (engine/combat.ts: equipBuffBonus and friends) only ever checks
 * the EQUIPPED CREATURE's OWN controller's battlefield for attached
 * Equipment, so a cross-player attachment would silently not grant its
 * bonus. Stolen Uniform hit the same wall and worked around it by actually
 * changing control first (CardInstance.temporaryControlUntilEndOfTurn) -
 * not an option here, since this card's whole point is that control stays
 * put. Simplified down to "Equipment you control" instead. */
export interface AttachAllControlledEquipmentToSelfEffect {
  type: 'attachAllControlledEquipmentToSelf';
}

/** "If it's the first end step of the turn, there is an additional end
 * step after this step" (Y'shtola Rhul) - increments GameState.extraEndStepsQueued,
 * gated on GameState.endStepNumberThisTurn === 1 the same way
 * QueueExtraCombatPhaseIfFirstCombatPhaseOfTurnEffect gates on
 * combatPhaseNumberThisTurn, so the granted extra end step firing this
 * SAME effect again doesn't chain a second one indefinitely. See
 * engine/actions.ts: nextPhase, which consumes the queue leaving 'end'. */
export interface QueueExtraEndStepIfFirstEndStepOfTurnEffect {
  type: 'queueExtraEndStepIfFirstEndStepOfTurn';
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

/** "Discard your hand, then draw N cards." (Umaro, Raging Yeti's "choose one
 * at random" mode) - unconditional (no "you may"), fixed draw count, unlike
 * DiscardHandThenDrawByDevotionEffect above (optional, devotion-scaled). */
export interface DiscardHandThenDrawEffect {
  type: 'discardHandThenDraw';
  drawCount: number;
}

/** "Each player may discard their hand and draw N cards. Then [this] deals
 * M damage to each opponent who discarded their hand this way." (Snort) -
 * unlike DiscardHandThenDrawEffect above (unconditional, caster only),
 * BOTH players decide independently (APNAP order - see
 * GameState.pendingSnortChoice.pendingPlayerIds), and only the CASTER's
 * opponent(s) who actually discarded take the damage (the caster is never
 * their own opponent, so their own choice never deals them damage). */
export interface EachPlayerMayDiscardHandAndDrawThenDamageOpponentsWhoDidEffect {
  type: 'eachPlayerMayDiscardHandAndDrawThenDamageOpponentsWhoDid';
  drawCount: number;
  damageAmount: number;
}

/** "Dance — At the beginning of your end step, each player may discard a
 * card. Each player who discarded a card this way draws a card. If a
 * creature card was discarded this way, you create a 1/2 white Moogle
 * creature token with lifelink. Then if a noncreature card was discarded
 * this way, put a +1/+1 counter on each Moogle you control." (Mog, Moogle
 * Warrior) - unlike EachPlayerMayDiscardHandAndDrawThenDamageOpponentsWhoDidEffect
 * above (whole hand, no choice of card), each player picks ONE specific
 * card (or declines) via GameState.pendingMogMoogleWarriorDanceChoice,
 * same sequential "one pending player at a time" shape. The two bonus
 * checks ("if A creature card was discarded this way"/"if a noncreature
 * card was discarded this way") read across BOTH players' discards
 * combined, not just the controller's own - resolved once the queue of
 * pending players empties. See engine/actions.ts:
 * resolveMogMoogleWarriorDanceChoice. */
export interface MogMoogleWarriorDanceEffect {
  type: 'mogMoogleWarriorDance';
}

/** "Add [colors]" (Ifrit, Warden of Inferno's Brimstone chapter) - adds
 * straight to the controller's mana pool, additively per color. */
export interface AddManaEffect {
  type: 'addMana';
  colors: Partial<Record<ManaColor, number>>;
}

/** "Add [color] for each lore counter on this Saga." (Summon: Esper
 * Valigarmanda's chapters II-IV) - reads the SOURCE's own current lore
 * counter total at resolution time (already incremented by the
 * triggerSagaLoreCounter call that resolved this chapter), unlike
 * AddManaEffect's fixed amount. The accompanying "you may cast an instant or
 * sorcery card exiled with this Saga, and mana of any type can be spent" is
 * NOT implemented - same "exile now, play later" persistent-permission gap
 * already documented as deferred for Summon: Brynhildr. */
export interface AddManaEqualToOwnLoreCounterEffect {
  type: 'addManaEqualToOwnLoreCounter';
  color: ManaColor;
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
  /** Defaults to 'creature'. 'nonlandPermanent' widens legal targets to
   * "target nonland permanent" (Ring of the Lucii). */
  targetFilter?: 'creature' | 'nonlandPermanent';
}

/** "Tap target creature. Metalcraft — If you control three or more
 * artifacts, exile that creature [instead]." (Dispatch) - "Metalcraft" is
 * checked against the CASTER's own battlefield (not the target's
 * controller's), same timing as every other "if you control N [type]"
 * precondition in this engine: at the moment the target is actually
 * chosen (CHOOSE_TARGET), not when the spell was cast - a controller who
 * loses an artifact between casting and choosing a target would miss the
 * upgrade. */
export interface TapTargetThenExileIfMetalcraftEffect {
  type: 'tapTargetThenExileIfMetalcraft';
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
  /** "If you control a commander, you may choose both instead" (SOLDIER
   * Military Program) - when true AND the controller has a commander, the
   * pending choice (see GameState.pendingChooseOneMode) also accepts a
   * second mode index alongside the mandatory first one. */
  allowBothIfCommander?: boolean;
}

/** "Target player draws N cards" (Combat Tutorial) - the first effect in
 * this engine to target a PLAYER rather than a permanent. See
 * GameState.pendingPlayerTarget and GameAction 'CHOOSE_PLAYER_TARGET'. */
export interface DrawCardsFromTargetPlayerEffect {
  type: 'drawCardsFromTargetPlayer';
  count: number;
  /** "target OPPONENT draws N cards" (Secret Rendezvous) - restricts the
   * legal player target to an opponent, unlike Combat Tutorial's own
   * unrestricted "target player" (which may choose themselves). Checked in
   * engine/actions.ts: choosePlayerTarget. */
  opponentOnly?: boolean;
  /** "You and target opponent each draw N cards" (Secret Rendezvous) - the
   * CASTER also draws `count` cards, in addition to whatever the target
   * player draws. */
  alsoCasterDraws?: boolean;
}

/** "Target player gains N life." (Noctis Lucis Caelum's {2}{W} ability) -
 * same GameState.pendingPlayerTarget/'CHOOSE_PLAYER_TARGET' flow as
 * DrawCardsFromTargetPlayerEffect above. */
export interface GainLifeForTargetPlayerEffect {
  type: 'gainLifeForTargetPlayer';
  amount: number;
}

/** "Target player loses N life." (Inalla, Archmage Ritualist's drain
 * ability) - the negative-life cousin of GainLifeForTargetPlayerEffect
 * above, same GameState.pendingPlayerTarget/'CHOOSE_PLAYER_TARGET' flow. */
export interface LoseLifeForTargetPlayerEffect {
  type: 'loseLifeForTargetPlayer';
  amount: number;
}

/** "Put a [counterLabel] counter on each creature target player controls"
 * (Collective Effort) - the second effect in this engine to target a
 * PLAYER rather than a permanent, same GameState.pendingPlayerTarget/
 * 'CHOOSE_PLAYER_TARGET' flow as DrawCardsFromTargetPlayerEffect above. */
export interface PutCounterOnEachCreatureTargetPlayerControlsEffect {
  type: 'putCounterOnEachCreatureTargetPlayerControls';
  counterLabel: string;
  counterAmount: number;
}

/** "Partner with [name] (When this creature enters, target player may put
 * [name] into their hand from their library, then shuffle.)" (Alisaie
 * Leveilleur) - the third effect in this engine to target a PLAYER rather
 * than a permanent, same GameState.pendingPlayerTarget/'CHOOSE_PLAYER_TARGET'
 * flow as the two above; once a target player is chosen, it continues
 * straight into the ordinary pendingLibrarySearch machinery for THAT
 * player (LibrarySearchFilter's 'exactName' kind, to hand, always
 * shuffling afterward) rather than a new mechanism - every library search
 * in this engine already allows declining via a null pick, which is what
 * "may" means here in practice. */
export interface MayPutExactNamedCardFromLibraryToHandForTargetPlayerEffect {
  type: 'mayPutExactNamedCardFromLibraryToHandForTargetPlayer';
  name: string;
}

/** "Target player searches their library for a card, then shuffles and
 * puts that card on top." (Ardyn Izunia's Boast) - the fourth effect in
 * this engine to target a PLAYER rather than a permanent, same
 * GameState.pendingPlayerTarget/'CHOOSE_PLAYER_TARGET' flow as the others;
 * once a target player is chosen, continues into the ordinary
 * pendingLibrarySearch machinery for THAT player (LibrarySearchFilter's
 * 'any' kind, toTopOfLibrary destination). */
export interface SearchLibraryForAnyCardToTopForTargetPlayerEffect {
  type: 'searchLibraryForAnyCardToTopForTargetPlayer';
}

/** "Target creature you control deals X damage to any other target and X
 * damage to itself, where X is its power" (Self-Destruct) - the first
 * "any other target" effect in this engine: unlike every pendingTarget
 * effect above (creatures/permanents only) or pendingPlayerTarget
 * (players only), the SECOND pick here can be either. Two-step, same
 * firstInstanceId convention as ChooseCreaturesFightEffect (first pick:
 * the source, a creature you control; second pick: any other target,
 * a creature OR a player) - see GameAction 'CHOOSE_TARGET's targetPlayerId,
 * a general-purpose addition meant to be reused by future "any target"
 * effects rather than building another one-off mechanism each time. */
export interface DealDamageToAnyOtherTargetAndSelfEffect {
  type: 'dealDamageToAnyOtherTargetAndSelf';
}

/** "It deals N damage to any target" (Walking Ballista's counter-removal
 * ability) - a simpler, ONE-STEP cousin of DealDamageToAnyOtherTargetAndSelfEffect:
 * no separate "pick a source creature" step (the source is always the
 * permanent whose ability this is, via pendingTarget.sourceInstanceId), a
 * fixed amount instead of power-based, and no self-damage or "other than
 * the source" restriction. See GameAction 'CHOOSE_TARGET's targetPlayerId
 * for the player-vs-permanent branch, same as the effect above. */
export interface DamageAnyTargetEffect {
  type: 'damageAnyTarget';
  amount: number;
}

/** "Support X" (Blitzball Stadium's onEnter: "Put a +1/+1 counter on each of
 * up to X target creatures.") - the first "up to X" (not a fixed 2) target
 * effect in this engine: X comes from GameState.pendingTarget.remainingPicks,
 * seeded from resolveCardEffects's chosenX and decremented by one on each
 * pick (see engine/actions.ts: chooseTarget), rather than the fixed-2
 * firstInstanceId shape PutCounterOnUpToTwoOwnCreaturesEffect uses. Legal
 * targets are ANY creature (either player's), matching Support's real
 * reminder text having no controller restriction. Always declinable, at
 * any pick (including the first) - see GameState.pendingTarget.chosenInstanceIds. */
export interface SupportEffect {
  type: 'support';
  counterLabel: string;
  counterAmount: number;
  /** A fixed "Support N" (Together Forever's "support 2") - omit to fall
   * back to the cast's chosenX instead (Blitzball Stadium's "support X",
   * where X is genuinely chosen at cast time). See engine/effects.ts:
   * resolveCardEffects. */
  count?: number;
  /** "...on each of up to two OTHER target creatures" (Generous Patron) -
   * unlike every other Support card here (no self-exclusion stated),
   * excludes the source itself from the legal target pool. */
  excludeSelf?: boolean;
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
  /** "...it gains [grantKeyword] until end of turn" (Rosa, Resolute White
   * Mage's "It gains lifelink until end of turn") - applied to the same
   * target as the counter. Also reused for Ride the Shoopuf's landfall
   * payout (no grantKeyword there). */
  grantKeyword?: string;
  /** "...put counters on up to one target creature" (Galuf's Final Act's
   * temporarily-granted death trigger) - no controller restriction at all,
   * unlike the default "own creature" name/behavior. See
   * engine/actions.ts: chooseTarget's putCounterOnUpToOneOwnCreature branch. */
  anyController?: boolean;
}

/** "When this Equipment enters, attach it to target creature you control[,
 * granting it grantKeyword until end of turn]" (Coral Sword) - restricted
 * to the controller's own creatures, unlike a normal manual Attach. */
export interface AttachSelfToTargetEffect {
  type: 'attachSelfToTarget';
  /** "You MAY attach it to target creature..." (Magitek Scythe) - defaults
   * to false/mandatory (Coral Sword's plain "attach it to target creature
   * you control", no "may"). See engine/actions.ts: chooseTarget's
   * isOptional check. */
  optional?: boolean;
  grantKeyword?: string;
  /** Defaults to false (a creature YOU control - Job-select Equipment's
   * usual "attach to target creature you control"). True lets a real Aura
   * (e.g. Sleep Magic, Stuck in Summoner's Sanctum) enchant either player's
   * permanent, matching "Enchant creature" having no controller restriction. */
  allowAnyController?: boolean;
  /** Defaults to 'creature'. 'artifactOrCreature' widens legal targets to
   * "Enchant artifact or creature" Auras (Stuck in Summoner's Sanctum). */
  targetTypeFilter?: 'creature' | 'artifactOrCreature';
  /** "When this Aura enters, tap enchanted permanent" (Sleep Magic, Stuck in
   * Summoner's Sanctum) - taps the target as part of attaching, distinct
   * from grantKeyword's temporary keyword grant. */
  tapTarget?: boolean;
  /** "Enchant creature AN OPPONENT CONTROLS" (Observed Stasis) - the
   * opposite restriction of allowAnyController above: ONLY an opponent's
   * creature is legal, never the controller's own. Mutually exclusive
   * with allowAnyController in practice (no current card sets both). */
  opponentControlledOnly?: boolean;
  /** "When this Aura enters, remove enchanted creature from combat. Then
   * draw a card for each tapped creature its controller controls."
   * (Observed Stasis) - resolved immediately after attaching, since the
   * enchanted creature is only known once the target is actually chosen
   * (this engine's established pattern: a "then do X to the target"
   * clause has to be a parameter on the attach effect itself, not a
   * separate list entry after it - see Coral Sword's grantKeyword for the
   * existing precedent). */
  removeFromCombatThenDrawForControllerTappedCreatures?: boolean;
}

/** "Whenever a legendary creature you control enters, you may attach this
 * Equipment to it." (Hero's Blade) - unlike AttachSelfToTargetEffect above
 * (a pendingTarget pick), the target here is already fully determined by
 * the triggering event itself (the just-entered creature), so this just
 * carries that instanceId straight through as a plain parameter and
 * resolves immediately once accepted. Wrapped in a MayEffectEffect for the
 * "you may" (see CardDefinition.mayAttachSelfToControlledLegendaryCreatureOnEnter,
 * engine/effects.ts: triggerCreatureEnterWatchers, which already receives
 * the entered creature's instanceId for other watchers like this). */
export interface AttachSelfToFixedTargetEffect {
  type: 'attachSelfToFixedTarget';
  targetInstanceId: string;
}

/** "Then you may attach an Equipment you control to [this creature]."
 * (Yuffie, Materia Hunter) - the reverse of AttachSelfToTargetEffect above
 * (there, the Equipment itself is the source and attaches to a target
 * creature; here, the SOURCE is a creature and the TARGET is an Equipment
 * the controller picks, attaching to the source). Optional - declining via
 * a null target is always legal. */
export interface MayAttachTargetControlledEquipmentToSelfEffect {
  type: 'mayAttachTargetControlledEquipmentToSelf';
}

/** "At the beginning of combat on your turn, attach up to one target
 * Equipment you control to target Rebel you control." (Barret, Avalanche
 * Leader) - a genuine two-TARGET pick (unlike
 * MayAttachTargetControlledEquipmentToSelfEffect above, whose destination is
 * always the source itself): first pick an Equipment you control (the "up
 * to one" - declinable via CHOOSE_TARGET's null convention, same as
 * MoveCounterBetweenTargetCreaturesEffect's own mandatory-first/optional
 * shape), then a Rebel creature you control to attach it to (mandatory once
 * the first pick is made - no "up to one" on this half). See
 * GameState.pendingTarget.firstInstanceId for the two-step pick. Armed only
 * if the controller has both at least one Equipment and at least one Rebel
 * creature (otherwise a no-op, same "no legal target" convention used
 * throughout this engine). */
export interface AttachTargetControlledEquipmentToTargetRebelEffect {
  type: 'attachTargetControlledEquipmentToTargetRebel';
  /** "...attach target Equipment you control to target creature you
   * control." (Noctis, Heir Apparent) - widens the second pick's filter
   * from "a Rebel you control" to any creature you control. */
  anyControlledCreatureInsteadOfRebel?: boolean;
}

/** "Reveal the top card of your library and put it into your hand. You
 * lose life equal to its mana value." (Dark Confidant) - a fixed, narrow
 * combo of draw-then-lose-life-by-cost, used from an onOwnUpkeep trigger. */
export interface RevealTopThenLoseLifeByManaValueEffect {
  type: 'revealTopThenLoseLifeByManaValue';
}

/** "You may pay N life. If you do, [effects]." (Seymour Flux's "you may pay
 * 1 life. If you do, draw a card and put a +1/+1 counter on Seymour Flux",
 * used from an onOwnUpkeep trigger) - unlike revealTopThenLoseLifeByManaValue
 * above (a fixed, automatic combo), this pauses on the controller's actual
 * yes/no choice, same shape as onCombatDamageToPlayerMayTransform's
 * GameState.pendingOptionalTransform. See GameState.pendingOptionalPayLife
 * and engine/actions.ts: resolveOptionalPayLife. */
export interface MayPayLifeThenEffect {
  type: 'mayPayLifeThenEffect';
  lifeCost: number;
  effects: CardEffect[];
  /** "...the number of opponents that were dealt combat damage this
   * turn." (Cecil Harvey's postcombat main phase trigger) - since this is
   * a 2-player engine, that count is always 0 or 1, and 0 is a guaranteed
   * no-op (pay 0 life, do nothing) either way, so this just skips arming
   * the choice at all unless the controller's one opponent actually has
   * PlayerState.dealtCombatDamageThisTurn set. */
  onlyIfOpponentDealtCombatDamageThisTurn?: boolean;
}

/** "You may pay [manaCost]. If you do, [effects]." (Terra, Herald of Hope's
 * "you may pay {2}. When you do, return target creature card with power 3
 * or less..."; Banon, the Returners' Leader's "you may pay {1} and discard a
 * card. If you do, draw a card.") - the MANA-cost cousin of
 * MayPayLifeThenEffect above, same pendingOptionalPayMana/
 * RESOLVE_OPTIONAL_PAY_MANA yes/no shape. Declining (or being unable to pay)
 * just clears the pending choice. */
export interface MayPayManaThenEffect {
  type: 'mayPayManaThenEffect';
  manaCost: string;
  effects: CardEffect[];
}

/** "...return this card from your graveyard to the battlefield tapped and
 * attacking." (Interceptor, Shadow's Hound) - the "if you do" half of its
 * own attack-trigger-from-the-graveyard ability (see CardDefinition.
 * onAttackWithLegendaryReturnSelfFromGraveyardTappedAndAttacking, armed as
 * a MayPayManaThenEffect-shaped pendingOptionalPayMana). Always targets
 * `sourceInstanceId` itself - there's no other card this could mean. Joins
 * the ALREADY-DECLARED attack (appended to GameState.declaredAttackers/
 * combatAssignments) rather than starting a separate one, since this
 * resolves mid-declare-attackers, before blockers are assigned. */
export interface ReturnSelfFromGraveyardTappedAndAttackingEffect {
  type: 'returnSelfFromGraveyardTappedAndAttacking';
}

/** "You may [do X]" with no cost at all (Tidus, Yuna's Guardian's Cheer -
 * "you may draw a card and proliferate") - the no-cost cousin of
 * MayPayLifeThenEffect above, pausing on the same kind of yes/no choice via
 * GameState.pendingMayEffect and RESOLVE_MAY_EFFECT, just without a life
 * payment step. Generic enough for any future "you may" text that isn't
 * gated behind a cost. */
export interface MayEffectEffect {
  type: 'mayEffect';
  effects: CardEffect[];
}

/** "When [this] enters, you draw a card and target opponent may draw a
 * card." (Tataru Taru) - "target opponent" is just THE one opponent in
 * this 2-player engine. Bundles the unconditional self-draw with arming
 * the EXISTING pendingMayEffect/RESOLVE_MAY_EFFECT flow (same as
 * MayEffectEffect above), just redirected to the OPPONENT as the decider
 * instead of this effect's own caster. */
export interface DrawThenTargetOpponentMayDrawEffect {
  type: 'drawThenTargetOpponentMayDraw';
}

/** "Flip a coin. If you win the flip, [ifWinEffects]." (The Gold Saucer) -
 * pauses on GameState.pendingCoinFlip until the controller calls a side
 * (RESOLVE happens in one step via CHOOSE_COIN_SIDE: the random result is
 * decided, compared against the call, and `ifWinEffects` resolved
 * immediately if it matches - there's no separate "reveal" pause). See
 * engine/actions.ts: chooseCoinSide, GameState.lastCoinFlip (what the
 * client actually animates/displays). */
export interface CoinFlipEffect {
  type: 'coinFlip';
  ifWinEffects: CardEffect[];
}

/** "Choose a creature an opponent controls. Until end of turn, creatures
 * other than [this] and the chosen creature get -X/-Y. When the chosen
 * creature leaves the battlefield, [onWatchedLeaveEffects]." (Zenos yae
 * Galvus) - a fixed, narrow effect combining a mandatory target (see
 * GameState.pendingTarget and engine/actions.ts: chooseTarget) with setting
 * up a GameState.battlefieldLeaveWatchers entry, the general "notice when a
 * SPECIFIC permanent leaves the battlefield BY ANY MEANS (not just dies)"
 * primitive - reusable by any future card with a similar "until it leaves
 * play" trigger (e.g. White Auracite's "until this artifact leaves the
 * battlefield"), not just this one. See engine/actions.ts:
 * checkBattlefieldLeaveWatchers. */
export interface ChooseCreatureDebuffOthersAndWatchLeaveEffect {
  type: 'chooseCreatureDebuffOthersAndWatchLeave';
  power: number;
  toughness: number;
  onWatchedLeaveEffects: CardEffect[];
}

/** "Transform [this]." as an automatic effect (Zenos yae Galvus, via its own
 * ChooseCreatureDebuffOthersAndWatchLeaveEffect's onWatchedLeaveEffects) -
 * the same in-place defId swap as CardAbility.transformSelf (a paid ability)
 * or FLIP_CARD (now unreachable from the UI), just triggered automatically
 * instead of by player action. Also fires the back face's own
 * onTransformInto, same as those two. A no-op (no error, just nothing
 * happens) if this permanent isn't on the battlefield or has no
 * transformsInto - see engine/effects.ts's resolution for why silent rather
 * than logged: by the time this fires the source may have already left play
 * some other way in the same resolution chain. */
export interface TransformSelfEffect {
  type: 'transformSelf';
}

/** "Choose an opponent." (Shinryu, Transcendent Rival's "As this creature
 * transforms into Shinryu, choose an opponent") - this engine is 2-player
 * only, so there's only ever one legal choice; no pendingTarget/pendingPlayerTarget
 * pause is needed, same reasoning as Omega, Heartless Evolution's "for each
 * opponent" collapsing to just the one opponent. Sets
 * CardInstance.chosenOpponentId on the source. See types.ts:
 * CardDefinition.winsGameIfChosenOpponentLoses (Shinryu's "Burning Chains"),
 * engine/actions.ts: concede. */
export interface ChooseOpponentEffect {
  type: 'chooseOpponent';
}

/** "Until end of turn, target creature you control gains 'When this creature
 * dies, return it to the battlefield tapped under its owner's control' and
 * has the chosen base power and toughness." (Vincent's Limit Break's Tiered
 * modes) - a mandatory target (see GameState.pendingTarget), restricted to
 * the controller's own creatures. Sets CardInstance.temporaryBaseStats
 * (checked in engine/combat.ts: effectivePower/effectiveToughness at the
 * same base-stat layer as a life-based base, ahead of counters/buffs) and
 * CardInstance.temporaryOnDeathReturnTapped (checked in engine/effects.ts:
 * resolveOnDeathTriggers) - both cleared at the cleanup step alongside
 * temporaryBuff. */
export interface GrantTemporaryBaseStatsAndDeathReturnEffect {
  type: 'grantTemporaryBaseStatsAndDeathReturn';
  power: number;
  toughness: number;
}

/** "{1}: Choose target creature with a counter on it. When that creature
 * dies this turn, return that card to its owner's hand." (Together
 * Forever) - a mandatory single-pick target (any controller, restricted to
 * creatures that already have at least one counter), granting a TEMPORARY
 * "return to hand on death" - CardInstance.temporaryOnDeathReturnToHand,
 * checked in engine/effects.ts: resolveOnDeathTriggers, the "return to
 * hand" sibling of temporaryOnDeathReturnTapped. Resolved immediately on
 * pick (no follow-up choice), same as PutStunCounterOnTargetAttackerEffect. */
export interface GrantOnDeathReturnToHandToTargetEffect {
  type: 'grantOnDeathReturnToHandToTarget';
}

/** "Whenever Wakka deals combat damage to a player, destroy up to one target
 * artifact that player controls and put a +1/+1 counter on Wakka." (Wakka,
 * Devoted Guardian) - the "and put a counter on self" half always happens,
 * whether or not a target existed or was declined, so this is one combined
 * effect rather than a destroy effect plus a separate sibling in the same
 * list (which couldn't guarantee the counter still applies on decline/no
 * legal target). "That player" is simply the source's controller's one
 * opponent (this engine is 2-player only) - see engine/actions.ts:
 * applyCombatDamageToPlayerTriggers, which only ever fires this from the
 * attacker's own onCombatDamageToPlayer, so there's no other player it
 * could mean. Sets CardInstance.counterPutOnSelfThisTurn on the source
 * whenever the counter is actually added, for IfCounterPutOnSelfThisTurnEffect
 * to read later the same turn. */
export interface DestroyUpToOneOpponentArtifactThenPutCounterOnSelfEffect {
  type: 'destroyUpToOneOpponentArtifactThenPutCounterOnSelf';
  counterLabel: string;
  counterAmount: number;
}

/** "At the beginning of your end step, if a counter was put on Wakka this
 * turn, put a +1/+1 counter on each other creature you control." (Wakka,
 * Devoted Guardian's Blitzball Captain) - a generic board-state conditional
 * wrapper, same "thenEffects/elseEffects" shape as IfKickedEffect/
 * IfControlAtLeastCreaturesEffect, gated on CardInstance.counterPutOnSelfThisTurn
 * instead. NOTE: that flag is only ever set by this card's OWN
 * DestroyUpToOneOpponentArtifactThenPutCounterOnSelfEffect - it does not
 * track counters added by any other source, the same kind of narrow,
 * self-referential approximation this engine already uses for
 * CardInstance.cheerTriggeredThisTurn. */
export interface IfCounterPutOnSelfThisTurnEffect {
  type: 'ifCounterPutOnSelfThisTurn';
  thenEffects: CardEffect[];
  elseEffects: CardEffect[];
}

/** "At the beginning of each end step, if you put a counter on a creature
 * this turn, [effect]." (Lord Jyscal Guado) - a generic board-state
 * conditional wrapper, same "thenEffects/elseEffects" shape as
 * IfCounterPutOnSelfThisTurnEffect above, but gated on the WIDER
 * PlayerState.counterPutOnOwnCreatureThisTurn flag instead of a single
 * instance's own. NOTE: that flag is only set by a handful of the most
 * common counter-adding effects (putCounterOnSelf, putCounterOnTarget,
 * putCounterOnUpToOneOwnCreature, support, proliferate - see
 * engine/effects.ts/actions.ts for the exact set) - it is NOT a
 * comprehensive "any counter from any source" tracker, since dozens of
 * effect types in this engine can add a counter and retrofitting every one
 * of them is far more than this one card's clause justifies. A real
 * counters-matter deck will trip this most of the time; an obscure counter
 * source might not. */
export interface IfCounterPutOnOwnCreatureThisTurnEffect {
  type: 'ifCounterPutOnOwnCreatureThisTurn';
  thenEffects: CardEffect[];
  elseEffects: CardEffect[];
}

/** "As [this] enters, remove all counters from any number of artifacts,
 * creatures, and enchantments. [This] enters with X +1/+1 counters on it,
 * where X is twice the number of counters removed this way." (Sin,
 * Unending Cataclysm) - approximated as stripping EVERY counter from EVERY
 * artifact/creature/enchantment either player controls (both the "any
 * number" of permanents AND which specific counters, since there's no
 * existing "choose any number of permanents" selection mechanism in this
 * engine, and building one for a single card's ETB isn't worth it) rather
 * than a genuine player choice of which ones to strip. Always resolves
 * immediately (no targeting), matching the "as this enters" replacement-
 * style timing (no pendingTarget pause). */
export interface RemoveAllCountersEnterWithDoubleAsCounterEffect {
  type: 'removeAllCountersEnterWithDoubleAsCounter';
  counterLabel: string;
}

/** "When [this] dies, put its counters on target creature you control, then
 * shuffle this card into its owner's library." (Sin, Unending Cataclysm) -
 * reads the counters off THIS CARD ITSELF at resolution time (still sitting
 * wherever moveCreaturesToGraveyard left it - this engine doesn't strip
 * counters on death, see engine/combat.ts: moveCreaturesToGraveyard's
 * graveyardMap), moves them onto the chosen target, then removes the source
 * from wherever it currently is and shuffles it into its OWNER's library
 * (regardless of who controlled it). Mandatory if the controller has
 * another creature; if not, just shuffles with nothing to move. */
export interface PutOwnCountersOnTargetThenShuffleSelfIntoLibraryEffect {
  type: 'putOwnCountersOnTargetThenShuffleSelfIntoLibrary';
}

/** "Monstrosity X, where X is [dynamic amount]. (If this creature isn't
 * monstrous, put X +1/+1 counters on it and it becomes monstrous.)"
 * (Maester Seymour's activated ability) - the "isn't monstrous" check is a
 * precondition on the ABILITY itself (see CardAbility.requiresNotMonstrous),
 * not on this effect; by the time this resolves, it always applies X
 * counters and sets CardInstance.monstrous. X here is specifically "the
 * number of counters among creatures you control" (summed across every
 * counter on every creature the controller controls, including this one) -
 * a different X shape than any existing dynamic-counter effect, so it isn't
 * generalized further than this one card's wording. */
export interface MonstrosityByControlledCreatureCounterCountEffect {
  type: 'monstrosityByControlledCreatureCounterCount';
  counterLabel: string;
}

/** "Ronso Rage — At the beginning of combat on your turn, put a [counterLabel]
 * counter on [this] and tap target creature an opponent controls. Then you
 * may have [this] become a copy of that creature, except its name/keywords/
 * this ability are kept." (Kimahri, Valiant Guardian) - the counter-on-self
 * half is unconditional and immediate; the tap is a mandatory single target
 * (opponent's creature only); accepting the "become a copy" follow-up
 * (GameState.pendingOptionalBecomeCopy) sets CardInstance.copiedStatsFromDefId
 * to the SAME creature just tapped, not a fresh choice. See
 * engine/actions.ts: chooseTarget's top-level special case for this effect
 * (it transitions into a different pending state on resolution, so it can't
 * just clear pendingTarget the generic way) and resolveOptionalBecomeCopy. */
export interface RonsoRageEffect {
  type: 'ronsoRage';
  counterLabel: string;
  counterAmount: number;
}

/** "At the beginning of combat on your turn, you may have [this] become a
 * copy of another target creature you control until end of turn, except
 * its name is [this name]. If you do, [this] and that creature each get
 * +X/+Y and gain [grantKeyword] until end of turn and attack this turn if
 * able." (Gogo, Mysterious Mime) - the UNTIL-END-OF-TURN cousin of
 * RonsoRageEffect's "become a copy" (that one is permanent); same
 * power/toughness-only approximation, but via CardInstance.
 * temporaryBaseStats (cleared at cleanup) rather than copiedStatsFromDefId
 * (which never clears). "Attack this turn if able" is deferred - this
 * engine has no mechanism anywhere that forces or validates a mandatory
 * attack declaration. See GameState.pendingTarget (armed only when the
 * controller has another creature to target; the "may" decline is the
 * ordinary null-target convention). */
export interface MayBecomeCopyOfAnotherControlledCreatureThenBuffBothEffect {
  type: 'mayBecomeCopyOfAnotherControlledCreatureThenBuffBoth';
  power: number;
  toughness: number;
  grantKeyword: string;
}

/** "This creature gains 'Whenever this creature deals combat damage to a
 * player, that player loses the game.'" (Summon: Primal Odin's Zantetsuken
 * chapter) - unlike Vincent's Limit Break above, this is a PERMANENT grant
 * (no "until end of turn"), so it sets CardInstance.
 * grantedCombatDamageToPlayerCausesLoss directly rather than going through
 * any pendingTarget/temporary-buff machinery - Odin already IS the source,
 * there's nothing to target. Checked in engine/combat.ts:
 * dealDirectDamageToDefender, the one function every path that deals combat
 * damage to a player (unblocked, or trampling over blockers) routes
 * through. Never cleared by cleanup - only lost if the creature itself
 * leaves the battlefield (a fresh CardInstance on return has no counters/
 * grants either, same as any other permanent). */
export interface GrantCombatDamageToPlayerCausesLossEffect {
  type: 'grantCombatDamageToPlayerCausesLoss';
}

/** "Whenever you cast a historic spell, untap [this]." (Giant of Babil) -
 * a plain, unconditional self-untap, unlike UntapSelfIfFirstCombatPhaseOfTurnEffect
 * (gated to combat phase 1) - usable from any CardEffect context. */
export interface UntapSelfEffect {
  type: 'untapSelf';
}

/** "Until your next turn, creatures can't attack you unless their
 * controller pays {2} for each of those creatures" (Summon: Yojimbo,
 * chapters II/III) - sets CardInstance.attacksYouCostGenericUntilNextTurn
 * on the source (Yojimbo itself), read by engine/actions.ts: declareAttackers
 * whenever an opponent declares attackers against this permanent's
 * controller, and cleared at that controller's own next untap step (same
 * duration as temporaryKeywordsUntilNextTurn). */
export interface GrantAttacksCostUntilNextTurnEffect {
  type: 'grantAttacksCostUntilNextTurn';
  amount: number;
}

/** "Whenever equipped creature attacks, if it's the first combat phase of
 * the turn, untap it." (Genji Glove) - untaps sourceInstanceId (the
 * equipped creature - see CardDefinition.equipGrantsOnAttack) only when
 * GameState.combatPhaseNumberThisTurn is 1, so this can't also fire during
 * the extra combat phase it grants below and untap the creature a second
 * time (which would let it attack a third time this turn). A no-op outside
 * combat phase 1 rather than an error. */
export interface UntapSelfIfFirstCombatPhaseOfTurnEffect {
  type: 'untapSelfIfFirstCombatPhaseOfTurn';
  /** "...untap it and all Samurai you control." (Gilgamesh, Weapon
   * Collector) - also untaps every OTHER controlled permanent whose
   * CardDefinition.subtype contains this string (case-insensitive
   * substring match, same convention as every other subtype check in this
   * engine), gated by the exact same combat-phase-1-only condition as the
   * self-untap above. */
  alsoUntapControlledSubtype?: string;
}

/** "After this phase, there is an additional combat phase." (Genji Glove) -
 * increments GameState.extraCombatPhasesQueued, gated the same way as
 * UntapSelfIfFirstCombatPhaseOfTurnEffect above (only during combat phase
 * 1) so triggering again during the granted extra combat phase doesn't
 * queue a second one and chain indefinitely. See engine/actions.ts:
 * nextPhase, which consumes the queue leaving End Combat. */
export interface QueueExtraCombatPhaseIfFirstCombatPhaseOfTurnEffect {
  type: 'queueExtraCombatPhaseIfFirstCombatPhaseOfTurn';
}

/** "After this phase, there is an additional combat phase." (Najeela, the
 * Blade-Blossom) - the UNGATED sibling of
 * QueueExtraCombatPhaseIfFirstCombatPhaseOfTurnEffect above: no
 * first-combat-phase-only restriction, since Najeela's own printed text has
 * none (deliberately - this is how the real card's infinite-combat combo
 * works, chaining off its own granted extra combat phase as long as mana
 * holds out). Same GameState.extraCombatPhasesQueued increment either way. */
export interface QueueExtraCombatPhaseEffect {
  type: 'queueExtraCombatPhase';
}

/** "Untap all creatures you control." (Tifa, Martial Artist) - unlike
 * UntapSelfIfFirstCombatPhaseOfTurnEffect above (one specific permanent),
 * this hits every creature the controller controls, with no first-combat-
 * phase gate of its own (Tifa's own gate is on the SECOND clause - the
 * extra combat phase - not this one). */
export interface UntapAllControlledCreaturesEffect {
  type: 'untapAllControlledCreatures';
}

/** "Untap all attacking creatures." (Najeela, the Blade-Blossom) - unlike
 * UntapAllControlledCreaturesEffect above (every creature the controller
 * controls, attacking or not), this only hits GameState.declaredAttackers,
 * matching the printed wording exactly (relevant mainly for creatures
 * without vigilance that just attacked and got tapped doing so). */
export interface UntapAllAttackingCreaturesEffect {
  type: 'untapAllAttackingCreatures';
}

/** "They gain trample, lifelink, and haste until end of turn." (Najeela,
 * the Blade-Blossom, following her own UntapAllAttackingCreaturesEffect) -
 * the multi-keyword, no-targeting cousin of GrantKeywordToOtherAttackersEffect
 * (which grants exactly one keyword and excludes the source itself); this
 * grants every listed keyword to every currently-declared attacker,
 * INCLUDING the activator's own permanent if it happens to be attacking. */
export interface GrantKeywordsToAllAttackersEffect {
  type: 'grantKeywordsToAllAttackers';
  keywords: string[];
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

/** "Draw a card for each tapped creature your opponents control" (Summon:
 * Shiva's Diamond Dust chapter) - a live battlefield count at resolution
 * time, unlike DrawForCreaturesDiedThisTurnEffect's turn-long running tally. */
export interface DrawForTappedOpponentCreaturesEffect {
  type: 'drawForTappedOpponentCreatures';
}

/** "Draw a card for each equipped attacking creature you control. Then if
 * [this] has power N or greater, [thenEffects]." (Cloud, Ex-SOLDIER) - the
 * equipped-and-attacking count is read live off GameState.declaredAttackers
 * (already populated by the time an onAttack trigger resolves) intersected
 * with the controller's own battlefield, each checked for ANY attached
 * permanent (CardInstance.attachedToInstanceId pointing at it) - same
 * "attached to it" check equipGrantsOnDeath uses elsewhere. The power check
 * reads effectivePower at resolution time (after any pump already applied
 * earlier in the same trigger chain). thenEffects is a plain nested list
 * (not hardcoded token fields) so this stays reusable beyond just Cloud's
 * own "create two Treasure tokens" bonus. */
export interface DrawForEquippedAttackersThenEffectsIfPowerAtLeastEffect {
  type: 'drawForEquippedAttackersThenEffectsIfPowerAtLeast';
  minPower: number;
  thenEffects: CardEffect[];
}

/** "Draw a card for each creature you control with a [counterLabel] counter
 * on it. Those creatures gain indestructible until end of turn." (Inspiring
 * Call) - the SAME set of creatures counted for the draw is the set that
 * gets the keyword, so this is one combined effect rather than a draw
 * effect plus a separate grant (which would have no way to "remember" which
 * creatures qualified). See engine/effects.ts: grantTemporaryKeyword. */
export interface DrawForCreaturesWithCounterThenGrantIndestructibleEffect {
  type: 'drawForCreaturesWithCounterThenGrantIndestructible';
  counterLabel: string;
}

/** "Put N counters of [counterLabel] on this creature" (Demon Wall's "5B:
 * Put two +1/+1 counters on this creature.") - unlike PutCounterOnTargetEffect,
 * this needs no target at all; it always applies to the source itself. */
export interface PutCounterOnSelfEffect {
  type: 'putCounterOnSelf';
  counterLabel: string;
  /** A literal amount, or 'chosenX' to use whatever X-like value the caller
   * passed resolveCardEffects (Walking Ballista's "enters with X +1/+1
   * counters" reads the cast's chosen X; Everflowing Chalice's "a charge
   * counter for each time it was kicked" reuses the same chosenX slot to
   * carry its Multikicker count instead - see engine/actions.ts: castCard's
   * effectiveChosenX). 'controlledCreatureCount' (General Leo Cristophe's
   * "a +1/+1 counter ... for each creature you control") reads the
   * controller's own current creature count at resolution time instead. */
  /** 'twiceGraveyardCreatureCount' (Siegfried, Famed Swordsman's "put X
   * +1/+1 counters on Siegfried, where X is twice the number of creature
   * cards in your graveyard") - read live at resolution time, so it
   * already sees any earlier effect in the same list that filled the
   * graveyard first (e.g. a preceding millSelf). */
  /** 'playersWhoLostLifeThisTurnCount' (Reaper's Scythe's "put a soul
   * counter on this Equipment for each player who lost life this turn") -
   * reads PlayerState.lifeLostThisTurn across BOTH players live at
   * resolution time (> 0 counts as "lost life"). */
  counterAmount: number | 'chosenX' | 'controlledCreatureCount' | 'twiceGraveyardCreatureCount' | 'playersWhoLostLifeThisTurnCount';
  /** "...It gains flying until end of turn." (Estinien Varlineau's noncreature-
   * cast trigger) - a temporary keyword grant bundled alongside the counter,
   * same shape as NoncreatureCastTrigger.counterIfExpensive's own grantKeyword
   * sibling, just available on this effect directly instead of only through
   * that one narrower trigger struct. See engine/effects.ts: grantTemporaryKeyword. */
  alsoGrantTemporaryKeyword?: string;
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
  /** 'creature' (Ice Magic's Blizzard tier - "target creature") narrows the
   * legal target set down from the original 'nonland' (Eject - any nonland
   * permanent, either player's). 'anyPermanent' (Master Xande's "return
   * target ... permanent to its owner's hand") widens it the other way -
   * lands included. */
  targetFilter: 'nonland' | 'creature' | 'anyPermanent';
}

/** "The owner of target spell, nonland permanent, or card in a graveyard
 * puts it on their choice of the top or bottom of their library." (Endless
 * Detour) - only the "target nonland permanent" mode is implemented.
 * "Target spell" has no analog in this engine at all (there's no separate
 * stack/priority system - a spell resolves the instant it's cast, so
 * there's never a window where an opposing spell exists to target). "Target
 * card in a graveyard" is deferred too - it would need a genuine "either a
 * battlefield permanent OR a graveyard card" unified target picker, which
 * nothing else in this engine has (every other targeted effect picks from
 * exactly one zone shape). The OWNER decides top-or-bottom, not the caster -
 * see GameState.pendingLibraryPlacementChoice, GameAction
 * 'RESOLVE_LIBRARY_PLACEMENT_CHOICE'. */
export interface PutTargetNonlandPermanentInLibraryOwnersChoiceEffect {
  type: 'putTargetNonlandPermanentInLibraryOwnersChoice';
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
  /** "...with mana value N or less" (Phoenix Down) - defaults to no limit. */
  maxManaValue?: number;
  /** "Return target NONLEGENDARY PERMANENT card" (Ragnarok, Divine
   * Deliverance) instead of the default "creature card" filter - any
   * non-instant, non-sorcery, non-legendary card. */
  nonlegendaryPermanentInsteadOfCreature?: boolean;
  /** "Return target permanent card" (Sun Titan) - any non-instant,
   * non-sorcery card, WITHOUT nonlegendaryPermanentInsteadOfCreature's
   * legendary exclusion, and (unlike that mode) still respects maxManaValue. */
  anyPermanentInsteadOfCreature?: boolean;
  /** "...with power N or less" (Terra, Herald of Hope) - the power sibling of
   * maxManaValue, checked against the graveyard card's own PRINTED power
   * (no live battlefield context to compute effectivePower from a card
   * that's sitting in the graveyard). */
  maxPower?: number;
  /** "...to the battlefield TAPPED" (Phoenix Down) - overrides
   * CardDefinition.entersTapped regardless of what the card itself says. */
  forceEntersTapped?: boolean;
  /** "You MAY return..." (Sun Titan, Terra's may-pay-mana follow-up) -
   * defaults to false/mandatory (Evil Reawakened's plain "return target
   * creature card..."). Declining is only legal when this is set - see
   * engine/actions.ts: resolveReanimate. */
  optional?: boolean;
  /** "Then put a [counterLabel] counter on [this] for each creature you
   * control" (General Leo Cristophe) - applies to the effect's own SOURCE
   * (the creature with this ability), not the reanimated card, and reads
   * the creature count AFTER the reanimated creature (if any) has already
   * joined the battlefield, so it's included. Fires even when the
   * reanimate is declined (the card says "Then", not "If you do") - see
   * engine/actions.ts: resolveReanimate. */
  thenPutCounterOnSourceEqualToControlledCreatureCount?: { counterLabel: string };
  /** "...from A graveyard" (Reanimate) rather than the default "your
   * graveyard" - widens the eligible pool, and the pending resolution, to
   * EITHER player's graveyard. See engine/actions.ts: resolveReanimate,
   * which finds the chosen instanceId across all players' graveyards
   * (removing it from whichever one actually has it) when this is set,
   * instead of only ever looking at the controller's own. */
  anyGraveyard?: boolean;
  /** "...onto the battlefield under its OWNER'S control" (Noctis Lucis
   * Caelum's {4}{B} ability) - unlike every other current user of this
   * effect (which always reanimates onto the ACTIVATOR's own battlefield,
   * even with anyGraveyard set), this puts the found card under whichever
   * player actually owns it instead. Only meaningful alongside
   * anyGraveyard (reanimating your own graveyard already puts it under
   * your own control either way). See engine/actions.ts: resolveReanimate. */
  entersUnderOwnerControl?: boolean;
  /** "You lose life equal to that card's mana value" (Reanimate) - applied
   * to the CONTROLLER (the one doing the reanimating), after the card has
   * actually entered the battlefield, regardless of whose graveyard it
   * came from. */
  loseLifeEqualToManaValue?: boolean;
  /** "...then return up to two target Aura and/or Equipment cards from
   * your graveyard to the battlefield attached to that creature." (Unfinished
   * Business) - once the creature actually resolves, arms
   * GameState.pendingAttachFromGraveyardChoice for up to 2 more picks (a
   * no-op if there's no eligible Aura/Equipment card in the graveyard at
   * all). See engine/actions.ts: resolveReanimate/resolveAttachFromGraveyardChoice. */
  thenReturnUpToTwoAurasOrEquipmentAttached?: boolean;
  /** "...from THAT PLAYER's graveyard" (Sepulchral Primordial's "for each
   * opponent, you may put up to one target creature card from that
   * player's graveyard onto the battlefield under your control") -
   * restricts the eligible pool to the OPPONENT's graveyard only, unlike
   * anyGraveyard above (which includes the controller's own). "For each
   * opponent" collapses to "the one opponent" in this 2-player engine, so
   * this needs no separate per-opponent iteration. Always paired with
   * `optional: true` - the printed "you may" has no fallback effect on
   * decline. */
  opponentGraveyardOnly?: boolean;
}

/** "Draw a card for each [cardType] you control" (Edgar, King of Figaro's
 * "for each artifact you control") - immediate, no targeting. */
export interface DrawCardsEqualToControlledTypeCountEffect {
  type: 'drawCardsEqualToControlledTypeCount';
  cardType: CardType;
}

/** "Draw X cards, where X is the greatest power among creatures you
 * controlled as you cast this spell." (Lifestream's Blessing) - "as you cast
 * this spell" is approximated as "right now, at resolution" (this engine
 * resolves a spell's effects immediately on cast, so there's no meaningful
 * gap between the two moments for anything to change in). 0 if the
 * controller has no creatures. */
export interface DrawCardsEqualToGreatestPowerEffect {
  type: 'drawCardsEqualToGreatestPower';
}

/** "If this spell was cast from exile, you gain twice X life" (Lifestream's
 * Blessing), where X is the same "greatest power among creatures you
 * control" DrawCardsEqualToGreatestPowerEffect computes - recomputed
 * independently here rather than threading a value between two separate
 * CardEffect resolutions (onCast vs. onCastFromExileEffects), since nothing
 * on the board changes between them in this engine's immediate-resolution
 * model. */
export interface GainLifeEqualToTwiceGreatestPowerEffect {
  type: 'gainLifeEqualToTwiceGreatestPower';
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
  /** "Return up to N target PERMANENT cards from your graveyard to your
   * hand" (Rydia's Return) instead of the default creature-only filter - any
   * non-instant, non-sorcery card, same predicate as
   * ReanimateTargetFromGraveyardEffect.nonlegendaryPermanentInsteadOfCreature
   * minus the nonlegendary restriction (this card has none). */
  anyPermanentInsteadOfCreature?: boolean;
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
  /** "You draw a card for each card discarded this way." (Syphon Mind) -
   * sets GameState.pendingDiscard.thenCasterDraws to this effect's own
   * caster, so engine/actions.ts: discardCard draws them a card for each
   * one the OPPONENT actually discards (never more than `count`, and 0 if
   * the opponent had nothing to discard). */
  thenCasterDrawsForEachDiscarded?: boolean;
}

/** "Each opponent loses N life" (Summon: Anima's Oblivion chapter) - unlike
 * EachPlayerLosesLifeEffect (both players) or LoseLifeEffect (the caster
 * only), this hits just the opponent; 2-player-only engine, so "each
 * opponent" is simply the one. */
export interface EachOpponentLosesLifeEffect {
  type: 'eachOpponentLosesLife';
  /** 'chosenX' (Exsanguinate's {X}{B}{B}) reads the spell's own paid X value,
   * same convention as PutCounterOnSelfEffect.counterAmount's 'chosenX'. */
  amount: number | 'chosenX';
  /** "You gain life equal to the life lost this way." (Exsanguinate) - life
   * lost is always exactly `amount` (life has no floor at 0 in this engine,
   * same as real rules), so this just gives the caster that same amount. */
  gainLifeEqualToLifeLost?: boolean;
}

/** "Each opponent draws a card, then you draw a card for each opponent who
 * drew a card this way." (Cut a Deal) - "each opponent" is just the one in
 * this 2-player engine, so the caster's own draw is simply 0 or 1,
 * depending on whether the opponent's library actually had a card to draw
 * (an empty-library opponent "didn't draw a card this way"). */
export interface EachOpponentDrawsThenCasterDrawsForEachWhoDidEffect {
  type: 'eachOpponentDrawsThenCasterDrawsForEachWhoDid';
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

/** "Tools — Whenever Edgar attacks, it gets +X/+0 until end of turn, where X
 * is the greatest mana value among artifacts you control." (Edgar, Master
 * Machinist) - a dynamic self-buff like PumpSelfByGraveyardCountEffect
 * above, but reading the MAX mana value among controlled artifacts (def.type
 * === 'artifact', same artifact-counting convention as
 * engine/combat.ts: controlledArtifactCountBaseStat) instead of a flat count.
 * 0 (no pump) if the controller has no artifacts. */
export interface PumpSelfByGreatestControlledArtifactManaValueEffect {
  type: 'pumpSelfByGreatestControlledArtifactManaValue';
}

/** "Each opponent mills X cards, where X is the amount of life you gained
 * this turn" (Hope Estheim) - reads PlayerState.lifeGainedThisTurn. Meant
 * for CardDefinition.onOwnEndStep. */
export interface MillOpponentByLifeGainedThisTurnEffect {
  type: 'millOpponentByLifeGainedThisTurn';
}

/** "Raise — At the beginning of your end step, if you gained life this
 * turn, return target creature card from your graveyard to your hand. If
 * you gained [minLifeGained] or more life this turn, return that card to
 * the battlefield instead." (Aerith, Last Ancient) - the WHOLE ability is
 * gated on PlayerState.lifeGainedThisTurn > 0 (no-op, not even arming a
 * target, if nothing was gained); the hand-vs-battlefield destination is a
 * second, independent threshold check against the same counter, decided
 * once at arming time (see GameState.
 * pendingReturnCreatureFromGraveyardHandOrBattlefield). */
export interface ReturnTargetCreatureFromGraveyardToHandOrBattlefieldIfLifeGainedAtLeastEffect {
  type: 'returnTargetCreatureFromGraveyardToHandOrBattlefieldIfLifeGainedAtLeast';
  minLifeGained: number;
}

/** "Threshold — Return target creature card from your graveyard to your
 * hand. Return that card to the battlefield instead if there are
 * [minGraveyardCount] or more cards in your graveyard." (Stitch Together) -
 * same pendingReturnCreatureFromGraveyardHandOrBattlefield/
 * resolveReturnCreatureFromGraveyardHandOrBattlefield machinery as the
 * life-gained-threshold effect above, just gated on the controller's
 * CURRENT graveyard size (counted before the target card is removed)
 * instead of life gained this turn - and unlike that effect, there's no
 * "whole ability is a no-op" outer condition, since this one has no
 * "if you gained life" prerequisite of its own. */
export interface ReturnTargetCreatureFromGraveyardToHandOrBattlefieldIfGraveyardCountAtLeastEffect {
  type: 'returnTargetCreatureFromGraveyardToHandOrBattlefieldIfGraveyardCountAtLeast';
  minGraveyardCount: number;
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
  /** "...and gains [grantKeyword] until end of turn" (Yiazmat, Ultimate
   * Mark's "gains indestructible until end of turn"). */
  grantKeyword?: string;
  /** "...Tap it." (Yiazmat, Ultimate Mark) - taps the source as part of the
   * same effect. */
  tapSelf?: boolean;
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
  /** "You MAY exile target CREATURE card from a graveyard" (Summoner's
   * Sending) - unlike Ignis Scientia's mandatory "exile target card" (any
   * card type, no decline), this restricts legal targets to creature cards
   * only and lets the controller decline entirely (RESOLVE_GRAVEYARD_EXILE
   * with instanceId: null). See engine/actions.ts: resolveGraveyardExile. */
  creatureOnly?: boolean;
  /** "Exile an instant or sorcery card from each graveyard" (Summon: Esper
   * Valigarmanda) - APPROXIMATED as a single pick from EITHER graveyard
   * (not strictly "one from each", which would need two sequential
   * pendingGraveyardExile picks and risks clobbering if run back to back),
   * restricted to instant/sorcery cards instead of creatures. */
  instantOrSorceryOnly?: boolean;
  optional?: boolean;
  /** "...create a 1/1 white Spirit creature token with flying. Put a +1/+1
   * counter on it if the exiled card's mana value is 4 or greater."
   * (Summoner's Sending) - a different, always-created token than
   * createFoodTokenIfCreature's fixed Food, with an optional mana-value-
   * gated bonus counter read off the just-exiled card. */
  thenCreateToken?: { tokenId: string; counterIfManaValueAtLeast?: { value: number; counterLabel: string; counterAmount: number } };
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

/** "Each opponent sacrifices a creature with the greatest power among
 * creatures that player controls." (Crackling Doom) - unlike
 * EachPlayerSacrificesEffect (a player's OWN CHOICE of which creature,
 * going through pendingSacrifice), this is fully determined by the board,
 * no choice at all - except on an actual tie for greatest power, where real
 * rules would let the opponent choose; this just picks the first
 * highest-power creature found instead (deliberately simple - no
 * pendingSacrifice-style tie-break UI built for this one case). */
export interface EachOpponentSacrificesCreatureWithGreatestPowerEffect {
  type: 'eachOpponentSacrificesCreatureWithGreatestPower';
}

/** "Tap all lands your opponents control" (Shiva, Warden of Ice's Cold
 * Snap) - immediate, no targeting. */
export interface TapAllOpponentLandsEffect {
  type: 'tapAllOpponentLands';
}

/** "Tap all creatures your opponents control" (Ultimecia, Temporal Threat) -
 * the creature counterpart to TapAllOpponentLandsEffect. */
export interface TapAllOpponentCreaturesEffect {
  type: 'tapAllOpponentCreatures';
}

/** "Sacrifice this creature: Your opponents can't cast noncreature spells
 * this turn." (Ranger-Captain of Eos) - sets PlayerState.
 * cantCastNoncreatureSpellsThisTurn on the controller's one opponent (2-player
 * engine, so "your opponents" is just the one). Checked in
 * engine/actions.ts: castCard's own main path only, same scoped-down
 * convention as equipGrantsOpponentsCantCastDuringYourTurn. */
export interface OpponentsCantCastNoncreatureSpellsThisTurnEffect {
  type: 'opponentsCantCastNoncreatureSpellsThisTurn';
}

/** "Destroy all artifacts and creatures" (Ultima) - unlike DestroyTargetEffect,
 * no targeting at all; hits every matching permanent on BOTH battlefields,
 * respecting indestructible per permanent. */
export interface DestroyAllEffect {
  type: 'destroyAll';
  /** 'tappedCreature' (Cloud's Limit Break's Omnislash tier) - every tapped
   * creature either player controls, no other qualifier. 'artifact'/
   * 'enchantment' (Austere Command's own modes) - the single-type cousins
   * of 'artifactAndCreature'/'artifactAndEnchantment' above.
   * 'creatureWithManaValueAtMost'/'creatureWithManaValueAtLeast' (also
   * Austere Command) need `maxManaValue`/`minManaValue` respectively. */
  targetFilter:
    | 'artifactAndCreature'
    | 'artifactAndEnchantment'
    | 'creatureWithNoCounters'
    | 'tappedCreature'
    | 'artifact'
    | 'enchantment'
    | 'creatureWithManaValueAtMost'
    | 'creatureWithManaValueAtLeast'
    /** 'nonlandPermanent' (Ruinous Ultimatum's "Destroy all nonland
     * permanents your opponents control.") - every permanent whose type
     * isn't 'land', always paired with opponentControlledOnly below (no
     * printed card here destroys every nonland permanent on BOTH sides
     * unconditionally). */
    | 'nonlandPermanent'
    /** 'creature' (Vanquish the Horde's "Destroy all creatures.") - every
     * creature on either battlefield, UNLIKE 'artifactAndCreature' above
     * (which also sweeps artifacts) - this card's printed text doesn't
     * mention artifacts at all. */
    | 'creature'
    /** 'creatureMatchingSubtype'/'creatureNotMatchingSubtype' (Crux of
     * Fate's "Destroy all Dragon creatures." / "Destroy all non-Dragon
     * creatures." modes) - both require `requiredSubtype` below, matched
     * the same substring way as every other subtype filter in this
     * engine. */
    | 'creatureMatchingSubtype'
    | 'creatureNotMatchingSubtype';
  /** Only used with targetFilter: 'creatureMatchingSubtype'/'creatureNotMatchingSubtype'. */
  requiredSubtype?: string;
  /** Only used with targetFilter: 'creatureWithManaValueAtMost'. */
  maxManaValue?: number;
  /** Only used with targetFilter: 'creatureWithManaValueAtLeast'. */
  minManaValue?: number;
  /** "Put a [counterLabel] counter on this creature for each permanent
   * destroyed this way" (Bane of Progress) - counts only permanents that
   * actually died here (indestructible/Shield-saved ones don't count),
   * puts that many counters on sourceInstanceId. */
  thenCounterSelfLabel?: string;
  /** "...your opponents control" (Ruinous Ultimatum) - restricts the whole
   * effect to just the one opponent's battlefield in this 2-player engine,
   * skipping the controller's own entirely. Every other DestroyAllEffect
   * card hits both battlefields unconditionally, so this only ever needs
   * checking when set. */
  opponentControlledOnly?: boolean;
}

/** "Exile all [artifacts/creatures/enchantments]" (Farewell) - the exile
 * cousin of DestroyAllEffect, but deliberately does NOT check indestructible
 * or Shield counters: exile isn't "destroyed", so neither protection
 * applies, matching real rules. Doesn't route a hit commander through
 * beginCommanderZoneChoice either (unlike the single-target
 * ExileTargetPermanentEffect) - that mechanism is built for one permanent at
 * a time, not a simultaneous mass effect that could hit both players'
 * commanders at once; a commander caught by this just goes to exile like
 * anything else, a known simplification for this one card's edge case. */
export interface ExileAllEffect {
  type: 'exileAll';
  targetFilter: 'artifact' | 'creature' | 'enchantment';
}

/** "Exile all graveyards" (Farewell) - operates on graveyard zones directly,
 * not battlefield permanents, so it's a separate effect from ExileAllEffect
 * above rather than another targetFilter value on it. */
export interface ExileAllGraveyardsEffect {
  type: 'exileAllGraveyards';
}

/** "Put all creature cards from all graveyards onto the battlefield under
 * your control." (Rise of the Dark Realms) - the mass-reanimation cousin of
 * ExileAllGraveyardsEffect above (same "iterate every player's graveyard"
 * shape), but moves matching cards to the BATTLEFIELD, all under the
 * caster's control, instead of exiling them. Each moved creature's own
 * onEnter still fires, same as any other reanimation effect in this
 * engine. No "additional type/color" grant and no delayed sacrifice - this
 * card's own printed text doesn't have either clause. */
export interface PutAllCreatureCardsFromAllGraveyardsOntoBattlefieldEffect {
  type: 'putAllCreatureCardsFromAllGraveyardsOntoBattlefield';
}

/** "Mill three cards. Then starting with the next opponent in turn order,
 * each opponent chooses a creature card in your graveyard that hasn't been
 * chosen. Return each card chosen this way to the battlefield under your
 * control." (Rejoin the Fight) - arms GameState.pendingRejoinTheFightChoice,
 * a no-op (just the mill, logged) if the controller's graveyard ends up
 * with no creature card for the opponent to choose at all. */
export interface MillThenOpponentChoosesCreatureFromYourGraveyardToBattlefieldEffect {
  type: 'millThenOpponentChoosesCreatureFromYourGraveyardToBattlefield';
  millCount: number;
}

/** "For each player, you choose from among the permanents that player
 * controls an artifact, a creature, an enchantment, and a planeswalker.
 * Then each player sacrifices all other nonland permanents they control."
 * (Tragic Arrogance) - arms GameState.pendingTragicArroganceChoice; see its
 * own doc comment for why there's no planeswalker exemption step. */
export interface TragicArroganceEffect {
  type: 'tragicArrogance';
}

/** "Exile each opponent's graveyard. When you do, choose up to one target
 * creature card exiled this way. Create a token that's a copy of that
 * card, except it's an artifact and it loses all other card types."
 * (Espers to Magicite) - the whole sequence is bundled into one effect
 * since the follow-up pick must be scoped to exactly the cards THIS effect
 * just exiled (not any creature card that happens to already be sitting in
 * an opponent's exile zone from something unrelated). See GameState.
 * pendingEspersToMagiciteChoice. The "except it's an artifact and loses
 * all other card types" twist is DEFERRED - the created token reuses the
 * original creature's own defId (same approach CreateTokenCopyOfTargetEffect
 * already uses), so it stays whatever type that creature printed as; this
 * engine's CardDefinition has one single `type` field with no
 * per-instance override for "this copy is a different type than its
 * defId says", same class of gap as every other "becomes a copy except
 * [characteristic]" card already approximated elsewhere (Ronso Rage,
 * Altered Ego). */
export interface ExileEachOpponentGraveyardThenMayCopyExiledCreatureAsTokenEffect {
  type: 'exileEachOpponentGraveyardThenMayCopyExiledCreatureAsToken';
}

/** "Exile a card at random from each opponent's graveyard. You may cast
 * any number of spells from among cards exiled this way without paying
 * their mana costs. Then each player who owns a spell you cast this way
 * loses life equal to its mana value." (Kefka, Dancing Mad's end step
 * trigger) - same "bundle the exile with a follow-up pick scoped to
 * exactly what this exiled" shape as
 * ExileEachOpponentGraveyardThenMayCopyExiledCreatureAsTokenEffect above,
 * but CASTING the card (for free) instead of copying it, and "any number"
 * collapses to "one card per opponent" in this 2-player engine (see
 * GameState.pendingKefkaChoice). A land card exiled this way is never a
 * legal choice - "cast any number of SPELLS", and a land isn't a spell -
 * so it just sits in exile unused, matching the real "then exile it"
 * language of similar un-castable misses elsewhere in this file. */
export interface ExileRandomFromEachOpponentGraveyardThenMayCastFreeEffect {
  type: 'exileRandomFromEachOpponentGraveyardThenMayCastFree';
}

/** "Sketch and Lore — {2}{R}, {T}: Target opponent exiles cards from the
 * top of their library until they exile an instant, sorcery, or creature
 * card. You may cast that card without paying its mana cost. If you cast
 * a creature spell this way, it gains haste and 'At the beginning of the
 * end step, sacrifice this creature.' Activate only as a sorcery." (Strago
 * and Relm) - "target opponent" is always just the one opponent in this
 * 2-player engine, so no real targeting choice is needed; digs through
 * their library (cards that don't match stay exiled too, same as any
 * other "exile until you hit X" dig). Unlike
 * ExileRandomFromEachOpponentGraveyardThenMayCastFreeEffect above
 * (Kefka's OWNER loses life equal to mana value as the cost of the free
 * cast), this has NO such downside - a genuinely free cast. See
 * GameState.pendingStragoAndRelmChoice. A creature cast this way gets
 * haste + a delayed sacrifice via the same SacrificeSelfEffect/
 * pendingDelayedEndStepEffects plumbing Blitz uses. */
export interface ExileFromOpponentLibraryUntilTypeThenMayCastFreeEffect {
  type: 'exileFromOpponentLibraryUntilTypeThenMayCastFree';
}

/** "Sacrifice this creature." (the delayed half of Blitz/Strago and
 * Relm's free-cast-a-creature clause) - a generic, reusable one-shot
 * self-sacrifice, resolved either immediately (as an ordinary CardEffect)
 * or later via GameState.pendingDelayedEndStepEffects (sourceInstanceId is
 * exactly what gets sacrificed either way). Goes through the normal
 * sacrifice/death pipeline (onDeath triggers, etc.), unlike a plain zone
 * move. */
export interface SacrificeSelfEffect {
  type: 'sacrificeSelf';
}

/** "Exile this creature." (Unearth's own delayed trigger - see
 * UnearthAbility) - the exile-instead-of-graveyard cousin of
 * SacrificeSelfEffect above, same "resolved immediately or later via
 * GameState.pendingDelayedEndStepEffects" shape. A plain zone move (no
 * onDeath triggers fire - real Unearth's delayed exile never passes
 * through the graveyard at all). No-op if the source already left the
 * battlefield some other way by the time this resolves. */
export interface ExileSelfEffect {
  type: 'exileSelf';
}

/** "Each player puts a vow counter on a creature they control and sacrifices
 * the rest. Each of those creatures can't attack you or planeswalkers you
 * control for as long as it has a vow counter on it." (Promise of Loyalty) -
 * each player, one at a time, independently picks ONE of their own
 * creatures to keep; every other creature they control is sacrificed
 * automatically as part of that same choice. Same "remainingPlayerIds
 * queue, one player's turn at a time" shape as SacrificeFilter/GameState.
 * pendingSacrifice (see engine/effects.ts: resolveKeepOneSacrificeRestQueue,
 * engine/actions.ts: chooseKeepOneSacrificeRest), including the same
 * `currentId === 'ai'` auto-resolution baked directly into the shared queue
 * resolver. The counter label is always the hardcoded 'Vow' (not a
 * parameter - no other card needs a different label for this), checked as
 * an attack restriction in engine/actions.ts: declareAttackers. "or
 * planeswalkers you control" is simplified away entirely - this engine has
 * no planeswalker CardType, and in a 2-player game "can't attack you" and
 * "can't attack while it has a Vow counter" collapse to the same thing
 * regardless of who cast the spell (a creature can only ever attack its
 * controller's one opponent), so there's no need to track which player
 * "you" refers to. */
export interface EachPlayerKeepOneCreatureSacrificeRestEffect {
  type: 'eachPlayerKeepOneCreatureSacrificeRest';
}

/** "That player chooses up to two creatures they control, then sacrifices
 * the rest" (Archfiend of Depravity, via onOpponentEndStep) - the "keep up
 * to N" cousin of EachPlayerKeepOneCreatureSacrificeRestEffect above: a
 * SINGLE player only (whichever one resolveCardEffects is called for, not
 * "each player"), no Vow counter (this is a board-wipe choice, not an
 * attack restriction), and a configurable keepCount instead of a hardcoded
 * one. Already controlling keepCount or fewer creatures needs no real
 * choice and resolves immediately with nothing sacrificed. The 'ai' player
 * auto-keeps its best keepCount creatures (power+toughness), same heuristic
 * as the keep-one queue's AI branch. See
 * GameState.pendingChooseUpToNCreaturesSacrificeRest, engine/effects.ts:
 * resolveChooseUpToNCreaturesSacrificeRestQueue, engine/actions.ts:
 * chooseUpToNCreaturesSacrificeRest. */
export interface ChooseUpToNCreaturesSacrificeRestEffect {
  type: 'chooseUpToNCreaturesSacrificeRest';
  keepCount: number;
}

/** "At the beginning of combat on your turn, you may move a counter from
 * target creature you control onto a second target creature you control"
 * (Tidus, Yuna's Guardian) - a mandatory-first/optional-second two-step pick
 * like PumpUpToTwoTargetsEffect, except the FIRST pick must already have a
 * counter (there's nothing to move otherwise) and the whole thing can be
 * declined outright before picking anything (see the effect's own "you
 * may"). If the source has more than one counter TYPE, this moves one of
 * whichever type has the highest count (the real card lets the controller
 * choose the type, but auto-picking the largest stack is a reasonable
 * simplification - most counters in this pool are +1/+1 anyway, and this
 * only matters for a source carrying two DIFFERENT counter types at once). */
export interface MoveCounterBetweenTargetCreaturesEffect {
  type: 'moveCounterBetweenTargetCreatures';
}

/** "Whenever a permanent you control leaves the battlefield, if it had
 * counters on it, put those counters on target permanent you control."
 * (Resourceful Defense) - scoped to permanents that go to the GRAVEYARD
 * (destroy, sacrifice, lethal damage - the one real choke point this engine
 * has for "a permanent left the battlefield", engine/effects.ts:
 * resolveOnDeathTriggers), not every possible way to leave the battlefield
 * (bounce to hand, exile) - a true "any removal from the battlefield, to any
 * zone" watcher would need hooking into dozens of scattered call sites, far
 * more than this one card's clause justifies. `counters` is a snapshot of
 * the dying permanent's own counters taken the moment it died (copied
 * wholesale, every label and amount, not just one type - unlike the
 * auto-pick-highest-stack simplification MoveCounterBetweenTargetCreaturesEffect
 * uses elsewhere, because here ALL the dying permanent's counters are meant
 * to move together). Mandatory target - ANY permanent (not creature-only)
 * the controller controls. */
export interface MoveDeadPermanentCountersToTargetEffect {
  type: 'moveDeadPermanentCountersToTarget';
  counters: Counter[];
}

/** "{4}{W}: Move any number of counters from target permanent you control
 * onto a second target permanent you control." (Resourceful Defense) -
 * approximated as moving ALL of the first permanent's counters of
 * whichever label has the highest count (same "distribute N things across
 * picks" problem and the same auto-pick-highest-stack fallback
 * MoveCounterBetweenTargetCreaturesEffect/MayMoveAllCountersToTargetCreatureEffect
 * already use elsewhere), generalized to ANY PERMANENT TYPE for both picks
 * (unlike MoveCounterBetweenTargetCreaturesEffect, which is creature-only) -
 * see GameState.pendingTarget.firstInstanceId for the two-step pick. */
export interface MoveAllCountersBetweenTargetPermanentsEffect {
  type: 'moveAllCountersBetweenTargetPermanents';
}

/** "{1}, {T}: Move a counter from target permanent you control onto a
 * second target permanent. Activate only as a sorcery." (Nesting Grounds) -
 * unlike MoveCounterBetweenTargetCreaturesEffect (both picks "creature you
 * control") or MoveAllCountersBetweenTargetPermanentsEffect (both picks
 * "permanent you control", moves ALL), this moves exactly ONE counter, the
 * FIRST pick must be a permanent the activating player controls, and the
 * SECOND pick has NO ownership restriction at all (either player's
 * permanent, any type). Same auto-pick-highest-count-counter-type
 * simplification as its siblings for a source with more than one kind. */
export interface MoveOneCounterFromOwnPermanentToAnyPermanentEffect {
  type: 'moveOneCounterFromOwnPermanentToAnyPermanent';
}

/** "{T}: Add one mana of any color in your commander's color identity. When
 * THAT MANA is spent to cast a creature spell that shares a creature type
 * with your commander, scry 1." (Path of Ancestry) - this engine's mana pool
 * has no provenance tracking at all (nothing remembers which tap produced
 * which mana once it's pooled), so "when THAT mana is spent" is approximated
 * as "when the very next spell this controller casts is paid for" (see
 * GameState.pendingManaIdentitySourceScry, set by this effect via
 * CardDefinition.onTapForManaEffects, consumed in engine/actions.ts:
 * castCard the same way pendingNextCreatureSpellBonus is). This can
 * misfire if the player taps this land but then spends OTHER mana first and
 * holds this mana for a later spell, or pays for something else entirely
 * with pooled mana that happens to include this - a real, acknowledged gap
 * from the lack of true provenance tracking, not worth a mana-pool rewrite
 * for one card's clause. "Scry" has no separate implementation in this
 * engine (see onOwnSurveilDraw's own doc comment) - resolved as Surveil 1. */
export interface ArmManaIdentitySourceScryEffect {
  type: 'armManaIdentitySourceScry';
}

/** "At the beginning of your upkeep, you may move any number of
 * [counterLabel] counters from this creature onto OTHER creatures."
 * (Forgotten Ancient) - approximated as moving ALL of this creature's
 * counterLabel counters onto a SINGLE target creature, rather than letting
 * the player choose how many (0 up to all) and split them across MULTIPLE
 * recipients - that general "distribute N things across any number of
 * targets" problem doesn't exist anywhere else in this engine (every
 * "up to X" target effect here puts a FIXED amount on EACH pick, never a
 * shared pool divided between picks). A no-op (not even armed) if the
 * source has none of counterLabel to move, or no other creature exists to
 * receive them. Always declinable (the "you may" is the decline). */
export interface MayMoveAllCountersToTargetCreatureEffect {
  type: 'mayMoveAllCountersToTargetCreature';
  counterLabel: string;
}

/** "When [this] enters, choose target creature you control. If damage would
 * be dealt to that creature this turn, prevent that damage and put that
 * many [counterLabel] counters on it instead." (Gatta and Luzzu) -
 * APPROXIMATED to combat damage only: engine/combat.ts: markDamage is the
 * one real choke point for combat damage, but non-combat (spell/ability)
 * damage is marked directly, inline, at dozens of scattered call sites
 * throughout this engine with no shared funnel - comprehensively covering
 * every one of them is far more than this card's clause justifies. Sets
 * CardInstance.temporaryPreventCombatDamageConvertToCounterLabel, cleared
 * at the cleanup step like any other "until end of turn" grant. Mandatory
 * target, restricted to the controller's own creatures. */
export interface GrantPreventCombatDamageConvertToCounterToTargetOwnCreatureEffect {
  type: 'grantPreventCombatDamageConvertToCounterToTargetOwnCreature';
  counterLabel: string;
}

/** "Adapt N" (Incubation Druid's "Adapt 3") - a real MTG keyword action: "If
 * this creature has no [counterLabel] counters on it, put N of them on it."
 * A no-op (nothing happens, not even a failed action) if it already has one
 * or more - unlike every other counter-adding effect here, this one can
 * legitimately do nothing and that's correct, expected behavior. */
export interface AdaptEffect {
  type: 'adapt';
  counterLabel: string;
  amount: number;
}

/** "When this creature dies, search your library for up to X basic land
 * cards, where X is this creature's power, put them onto the battlefield,
 * then shuffle." (Rampant Rejuvenator) - X is read from the dying instance's
 * own last-known power (printed power + counters, same approximation
 * resolveOnDeathTriggers' temporaryOnDeathPutCountersEqualToPower already
 * uses - equip/anthem bonuses that applied while alive aren't recoverable).
 * Resolved as a chain of GameState.pendingLibrarySearch picks (remainingPicks
 * = X - 1) with allowDuplicateNames set, so unlike Reach the Horizon's
 * "search for up to N with different names" (the only other multi-pick
 * precedent), this CAN find the same basic land name more than once, matching
 * the printed card (no "different names" clause stated). Any future "search
 * for up to N [repeatable type]" card without a stated different-names
 * restriction should reuse allowDuplicateNames the same way, rather than a
 * new pending-state shape. */
export interface SearchLibraryForUpToXBasicLandsEqualToPowerEffect {
  type: 'searchLibraryForUpToXBasicLandsEqualToPower';
}

/** "Steal — {1}, {T}: Move a counter from target creature an opponent
 * controls onto target creature you control." (Rikku, Resourceful Guardian) -
 * the cross-player mirror of MoveCounterBetweenTargetCreaturesEffect (which
 * requires BOTH picks to be the controller's own creatures): the FIRST pick
 * must be a creature an OPPONENT controls with at least one counter, the
 * SECOND must be a creature the activating player controls. Same
 * auto-pick-highest-count-counter-type simplification as
 * MoveCounterBetweenTargetCreaturesEffect for a source with more than one
 * counter kind. See GameState.pendingTarget.firstInstanceId for the two-step
 * pick. */
export interface MoveCounterFromOpponentCreatureToOwnCreatureEffect {
  type: 'moveCounterFromOpponentCreatureToOwnCreature';
}

/** "Search your library for a [landName] card and reveal it. If an opponent
 * controls more lands than you, you may put that card onto the battlefield
 * tapped. If you don't, put it into your hand. Then shuffle." (Scholar of
 * New Horizons) - the "if [condition]" gate is checked ONCE, before the
 * search even begins (an opponent controlling more lands than the activating
 * player at that moment); if true, GameState.pendingLibrarySearch.
 * mayChooseBattlefieldTapped is set, so the controller genuinely chooses the
 * destination (battlefield tapped, or hand) at RESOLVE_LIBRARY_SEARCH time -
 * if false, the search behaves exactly like a plain SearchLibraryForLandEffect
 * (straight to hand, no choice offered), matching the printed card's "if you
 * don't [put it onto the battlefield]" fallback. This is the GENERAL shape
 * for "search always finds something, then you may put it onto the
 * battlefield instead of hand" - any future card with that shape should set
 * mayChooseBattlefieldTapped from its own gating condition the same way,
 * rather than adding a new effect type. */
export interface SearchLibraryForLandConditionalBattlefieldIfOpponentHasMoreLandsEffect {
  type: 'searchLibraryForLandConditionalBattlefieldIfOpponentHasMoreLands';
  landName: string;
}

/** Plays whatever card is sitting in CardInstance.hideawayExiledCardId on
 * `sourceInstanceId` (a HideawayEffect's "exiled card") without paying its
 * mana cost - the exact same resolution CardDefinition.playHideawayCard's
 * activated-ability path already used (Clive's Hideaway), now factored out
 * into a reusable CardEffect so any OTHER trigger shape (not just a paid
 * activated ability) can offer "play the exiled card" too - e.g. wrapped in
 * a MayEffectEffect for Fight Rigging's "you may play the exiled card"
 * combat trigger (see PutCounterOnTargetOwnCreatureThenMayPlayHideawayIfCreaturePowerAtLeastEffect
 * below). A no-op (with a log line, not an error) if nothing was ever hidden
 * away, or it's already been played. See engine/effects.ts:
 * resolveCardEffects's own resolution for the full mechanics (legend rule,
 * Saga/artifact/noncreature-cast triggers on the newly-played card). */
export interface PlayHideawayCardEffect {
  type: 'playHideawayCard';
}

/** "At the beginning of combat on your turn, put a +1/+1 counter on target
 * creature you control. Then if you control a creature with power 7 or
 * greater, you may play the exiled card without paying its mana cost."
 * (Fight Rigging) - a mandatory single target (arms GameState.pendingTarget,
 * same "mandatory, own creature" shape as GrantTemporaryBaseStatsAndDeathReturnEffect;
 * a no-op with no legal target - zero creatures controlled - skips the
 * "then" check entirely too, matching how a real illegal-target trigger
 * never resolves at all). The power check happens AFTER the counter is
 * placed (so the just-countered creature's own new power counts), and on a
 * hit arms a genuine "you may" via the existing GameState.pendingMayEffect
 * wrapping a single PlayHideawayCardEffect - no new pending-state needed.
 * See engine/actions.ts: chooseTarget's own resolution. */
export interface PutCounterOnTargetOwnCreatureThenMayPlayHideawayIfCreaturePowerAtLeastEffect {
  type: 'putCounterOnTargetOwnCreatureThenMayPlayHideawayIfCreaturePowerAtLeast';
  counterLabel: string;
  counterAmount: number;
  minPower: number;
}

/** "[This] deals N damage to each creature" (Fire Magic) - unlike
 * DestroyAllEffect (unconditional destruction), this marks damage and only
 * kills creatures whose toughness it actually exceeds, same "mark then
 * check lethal" resolution as SweepDamageFromChosenCreatureEffect. No
 * targeting needed - every creature on either battlefield is hit. */
export interface DamageEachCreatureEffect {
  type: 'damageEachCreature';
  amount: number;
}

/** "[This] deals X damage to each opponent, where X is the number of
 * noncreature, nonland cards in your graveyard" (The Lord Master of Hell's
 * Starfall) - a one-off graveyard-count-scaled damage effect, immediate, no
 * targeting. */
export interface DamageEachOpponentEqualToGraveyardNoncreatureNonlandCountEffect {
  type: 'damageEachOpponentEqualToGraveyardNoncreatureNonlandCount';
}

/** "If you control [minCount] or more [subtype]s, create [tokenId]" (The
 * Wandering Minstrel's Minstrel's Ballad) - a conditional, immediate,
 * no-target token creation. Unlike TransformSelfIfControlledSubtypeCountAtLeastEffect
 * (which transforms the source), this creates a token and leaves the source
 * alone. */
export interface CreateTokenIfControlledSubtypeCountAtLeastEffect {
  type: 'createTokenIfControlledSubtypeCountAtLeast';
  subtype: string;
  minCount: number;
  tokenId: string;
}

/** "Other creatures you control get +X/+X until end of turn, where X is the
 * number of [subtype]s you control" (The Wandering Minstrel) - the dynamic
 * amount is computed from the controller's own battlefield at the moment
 * this effect is queued, then dispatched as an ordinary
 * BuffOtherCreaturesYouControlEffect with that amount baked in - see
 * engine/effects.ts: resolveCardEffects. */
export interface BuffOtherCreaturesYouControlByControlledSubtypeCountEffect {
  type: 'buffOtherCreaturesYouControlByControlledSubtypeCount';
  subtype: string;
}

/** "Each opponent mills cards equal to the number of cards in your hand"
 * (The Water Crystal) - a dynamic mill amount read from the CONTROLLER's own
 * hand size at resolution time. */
export interface MillEachOpponentByYourHandSizeEffect {
  type: 'millEachOpponentByYourHandSize';
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
  /** "That creature becomes a [Subtype] in addition to its other types"
   * (Jenova, Ancient Calamity) - a permanent grant on the chosen target,
   * alongside the counters. See CardInstance.grantedSubtypes. */
  alsoGrantsSubtype?: string;
  /** "...on ANOTHER target creature YOU CONTROL" (Maester Seymour) - unlike
   * Jenova's wording (no "you control"), restricts the legal target to the
   * controller's own creatures. */
  restrictToOwnCreature?: boolean;
  /** Whether the target is MANDATORY (Maester Seymour's plain "target
   * creature", no "up to") rather than "up to one" (Jenova, declinable) -
   * omitted/false preserves Jenova's behavior. See engine/actions.ts:
   * chooseTarget's isOptional list. */
  mandatory?: boolean;
}

/** "Discard up to two cards, then draw that many cards" (Joshua, Phoenix's
 * Dominant) - unlike LootEffect (mandatory draw N, then discard N), the
 * discard comes FIRST and is itself "up to" (optional/partial), and the
 * draw afterward is however many were actually discarded, not a fixed
 * number. Needs its own pending flow - see GameState.pendingDiscardUpToThenDraw. */
export interface DiscardUpToThenDrawThatManyEffect {
  type: 'discardUpToThenDrawThatMany';
  /** "...discard ANY NUMBER of cards..." (Celes, Rune Knight) - pass
   * Infinity; the discard naturally stops once hand is empty regardless
   * (see engine/actions.ts: resolveDiscardUpToThenDraw's stillEligible
   * check), so there's no separate "unbounded" flag needed. */
  maxCount: number;
  /** "...then draw that many cards PLUS ONE." (Celes, Rune Knight) - unlike
   * every other current card using this effect (which draw EXACTLY how
   * many were discarded), this draws one extra on top. */
  plusOne?: boolean;
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

/** "The owner of target permanent shuffles it into their library, then
 * reveals the top card of their library. If it's a permanent card, they put
 * it onto the battlefield." (Chaos Warp) - targets ANY permanent, either
 * player's, but the shuffle/reveal/battlefield-entry all happen to its
 * OWNER (CardInstance.ownerId), not whoever currently controls it - the
 * first effect in this engine where those two can diverge in a way that
 * matters (see Yuffie, Materia Hunter's permanent control-gain). If the
 * revealed card isn't a permanent card, nothing further happens to it (the
 * printed text only specifies what happens for the permanent case). */
export interface ShuffleTargetPermanentIntoLibraryThenRevealTopEffect {
  type: 'shuffleTargetPermanentIntoLibraryThenRevealTop';
}

/** "Destroy any number of target tapped creatures with different
 * controllers" (Cloud's Limit Break's Blade Beam tier) - in this engine's
 * always-2-player games, "different controllers" caps this at exactly one
 * pick per player (0, 1, or 2 total). Always declinable, at any pick
 * (including the first) - same "any number" shape as SupportEffect, but
 * tracking USED CONTROLLERS instead of used instance ids, since the
 * destroyed creature itself is gone and can't be re-checked for who
 * controlled it. See GameState.pendingTarget.usedControllerIds. */
export interface DestroyAnyNumberOfTappedCreaturesWithDifferentControllersEffect {
  type: 'destroyAnyNumberOfTappedCreaturesWithDifferentControllers';
}

/** "Any number of target nonland permanents you control phase out. (Treat
 * them and anything attached to them as though they don't exist until your
 * next turn.)" (Clever Concealment) - same "any number, always declinable"
 * shape as SupportEffect, reusing GameState.pendingTarget.chosenInstanceIds
 * to exclude already-picked permanents from later picks in the same
 * sequence. Phasing itself is CardInstance.phasedOut, a scoped-down
 * approximation: a phased-out permanent can't attack, block, be targeted,
 * or tap for mana/activated abilities (the choke points this engine
 * actually gates on), and phases back in automatically at the start of its
 * controller's next untap step - but it's NOT excluded from other board-wide
 * "for each creature you control"-style counts (devotion, anthems, etc.),
 * a documented gap rather than auditing every such call site. Anything
 * ATTACHED to a chosen permanent phases out (and back in) alongside it. */
export interface PhaseOutAnyNumberOfTargetControlledNonlandPermanentsEffect {
  type: 'phaseOutAnyNumberOfTargetControlledNonlandPermanents';
}

export type CardEffect =
  | CreateTokenEffect
  | TapAndStunEffect
  | TapTargetThenCounterSelfByPowerDifferenceIfGreaterEffect
  | UntapTargetAttackerEffect
  | PutStunCounterOnTargetAttackerEffect
  | TapStunAndGainLifeForNonbasicLandsEffect
  | DestroyTargetEffect
  | DestroyArtifactCreatureEnchantmentAndLandEffect
  | RevealAndDivideEffect
  | ChooseManaColorEffect
  | AddOneManaOfChosenColorEffect
  | SacrificeCreatureEffect
  | RandomGraveyardCopyEffect
  | SurveilEffect
  | MillThenReturnEffect
  | ReturnTargetAuraOrEquipmentFromGraveyardToHandEffect
  | ReturnTargetEquipmentOrVehicleFromGraveyardToHandEffect
  | ReturnTargetNonAssassinHistoricFromGraveyardToHandEffect
  | LootEffect
  | GainLifeEffect
  | OptionalBounceEffect
  | PumpAttackersEffect
  | RevealFilteredEffect
  | HideawayEffect
  | DamageEqualToEquippedCreaturesEffect
  | SearchLibraryForLandEffect
  | SearchLibraryForAnyLandEffect
  | SearchLibraryForBasicLandEffect
  | SearchLibraryForBasicLandOrSubtypeEffect
  | CultivateEffect
  | LookAtTopNPutMToHandRestToBottomEffect
  | RevealTopNThenPutOneOfEachCardTypeToHandEffect
  | ChooseCreatureTypeEffect
  | ChooseNumberEffect
  | PumpControlledCreaturesWithKeywordEffect
  | PumpAllControlledOrMoreWithFullPartyEffect
  | GoadTargetCreatureEffect
  | GrantIndestructibleToOwnAndOpponentCreatureThenDestroyAllEffect
  | TargetOpponentBecomesMonarchEffect
  | DamageEqualToGreatestControlledPowerToUpToOneOpponentCreatureEffect
  | IfFullPartyEffect
  | ExileAllInstantOrSorceryFromOwnGraveyardThenMayCastFreeEffect
  | CreateTokenForFixedPlayerEffect
  | UntapAllAttackingCreaturesEffect
  | GrantKeywordsToAllAttackersEffect
  | QueueExtraCombatPhaseEffect
  | ConniveConvokingCreaturesEffect
  | BecomeMonarchEffect
  | OpponentChoosesOneOfExiledCardsToBottomRestReturnsTappedThenBecomeMonarchEffect
  | ExileTargetCreatureUntilMonarchChangesEffect
  | ExileUpToOneOtherTargetCreatureThenControllerGainsLifeEqualToItsPowerEffect
  | RevealOpponentHandChooseNonlandCardThenDiscardEffect
  | DivideDamageAmongChosenTargetsEffect
  | GraveyardToBottomOfLibraryForTargetPlayerEffect
  | AllCreaturesGetNegativeChosenXUntilEndOfTurnEffect
  | AnyPlayerMayPayHalfLifeToCounterThenExtraTurnEffect
  | SearchOpponentLibraryExileFaceDownThenMayPlayEffect
  | PumpTargetOwnCreatureByControlledSubtypeCountEffect
  | CreateTokenIfOpponentControlsMoreCreaturesThanYouEffect
  | EachOpponentWhoLostLifeSacrificesGreatestPowerCreatureEffect
  | PumpTargetEffect
  | GrantKeywordToOtherAttackersEffect
  | GrantKeywordToAnotherTargetAttackingCreatureEffect
  | MugEffect
  | LoseLifeEffect
  | EachPlayerLosesLifeEffect
  | PumpControlledSubtypeEffect
  | PutCounterOnTargetEffect
  | JenovaCellsAttackTriggerEffect
  | ProliferateEffect
  | DebuffTargetByGraveyardEffect
  | SelfFightTargetEffect
  | ChooseCreaturesFightEffect
  | ModifySagaLoreCounterEffect
  | DiscardHandThenDrawByDevotionEffect
  | AddManaEffect
  | ExileAndReturnTransformedSelfIfLoreAtLeastEffect
  | ExileAndReturnTransformedSelfEffect
  | TapTargetEffect
  | TapTargetThenExileIfMetalcraftEffect
  | ChooseOneModeEffect
  | DrawCardsFromTargetPlayerEffect
  | GainLifeForTargetPlayerEffect
  | LoseLifeForTargetPlayerEffect
  | SearchLibraryForAnyCardToTopForTargetPlayerEffect
  | PutCounterOnEachCreatureTargetPlayerControlsEffect
  | PutCounterOnUpToOneOwnCreatureEffect
  | AttachSelfToTargetEffect
  | AttachSelfToFixedTargetEffect
  | RevealTopThenLoseLifeByManaValueEffect
  | MayPayLifeThenEffect
  | MayEffectEffect
  | DrawThenTargetOpponentMayDrawEffect
  | MoveCounterBetweenTargetCreaturesEffect
  | ExileAllEffect
  | ExileAllGraveyardsEffect
  | EachPlayerKeepOneCreatureSacrificeRestEffect
  | CoinFlipEffect
  | ChooseCreatureDebuffOthersAndWatchLeaveEffect
  | TransformSelfEffect
  | ChooseOpponentEffect
  | GrantTemporaryBaseStatsAndDeathReturnEffect
  | GrantCombatDamageToPlayerCausesLossEffect
  | UntapSelfEffect
  | GrantAttacksCostUntilNextTurnEffect
  | UntapSelfIfFirstCombatPhaseOfTurnEffect
  | QueueExtraCombatPhaseIfFirstCombatPhaseOfTurnEffect
  | DestroyOpponentCreatureEffect
  | DrawForCreaturesDiedThisTurnEffect
  | DrawForTappedOpponentCreaturesEffect
  | PutCounterOnSelfEffect
  | BuffOtherCreaturesYouControlEffect
  | EachPlayerSacrificesEffect
  | EachPlayerSacrificesHalfRoundedDownEffect
  | ReturnControlledLandToHandEffect
  | ExileTopOfLibraryPlayableWhileControllingSourceEffect
  | ExileTopOfLibraryPlayableUntilAnotherExiledWithSourceIfControlCreaturePowerAtLeastEffect
  | ExileTopOfLibraryFaceDownTaggedWithSourceEffect
  | GrantTemporaryPlayPermissionForFaceDownExiledBySourceEffect
  | ExileTopOfTargetPlayerLibraryThenOptionalSacrificeToPlayEffect
  | ChooseCreatureDealsDamageToOpponentCreatureEffect
  | IfKickedEffect
  | IfControlAtLeastCreaturesEffect
  | IfControlCreatureWithPowerAtLeastEffect
  | SearchLibraryOrGraveyardForArtifactEffect
  | MillThenPutCreaturesOntoBattlefieldEffect
  | ReturnSpecificInstancesToOwnersHandEffect
  | QueueEffectsAtNextEndStepEffect
  | ExileTargetPermanentEffect
  | ExileTargetCreatureWithLessPowerUntilSourceLeavesEffect
  | ExileTargetOpponentCreatureUntilSourceLeavesEffect
  | TapUpToOneTargetCreatureAndStunEffect
  | PutCounterOnUpToTwoOwnCreaturesEffect
  | CreateTokenIfOpponentControlsCreatureWithPowerAtLeastEffect
  | BounceOpponentCreaturesWithGreatestManaValueEffect
  | ChooseOneAtRandomEffect
  | ReturnUpToTwoTargetPermanentsFromGraveyardToHandEffect
  | SacrificeOwnCreatureThenDrawEffect
  | RevealUntilCreatureThenPutCountersEqualToManaValueEffect
  | ExileTopOfLibraryPlayableUntilCleanupEffect
  | PumpUpToTwoTargetsEffect
  | ReturnInstantOrSorceryFromGraveyardToHandEffect
  | PutCounterOnAnotherCreatureGrantsIndestructibleUntilNextTurnEffect
  | PutLandFromHandOntoBattlefieldEffect
  | SetBasePowerUntilEndOfTurnToControlledSubtypeCountEffect
  | CastTargetInstantOrSorceryFromGraveyardAnyManaEffect
  | ExileTargetInstantOrSorceryFromOpponentGraveyardThenMayCastForFixedCostEffect
  | ReturnTargetCreatureFromGraveyardWithManaValueEqualToEffect
  | MillThenPutLandIntoHandGainLifeIfTownEffect
  | ExileThenReturnTargetOwnCreatureEffect
  | QueueExtraEndStepIfFirstEndStepOfTurnEffect
  | AttachAllControlledEquipmentToTargetCreatureEffect
  | AttachAllControlledEquipmentToSelfEffect
  | AttachTargetControlledEquipmentToTargetRebelEffect
  | DealDamageToAnyOtherTargetAndSelfEffect
  | PutCounterOnTargetLandEffect
  | PutCounterOnTargetCommanderEnteredThisTurnEffect
  | BounceTargetEffect
  | ShuffleGraveyardIntoLibraryEffect
  | ReanimateTargetFromGraveyardEffect
  | DrawCardsEqualToControlledTypeCountEffect
  | TransformSelfIfGraveyardSizeAtLeastEffect
  | ReturnCreaturesFromGraveyardToHandEffect
  | PutSelfOnBottomOfLibraryEffect
  | EachOpponentDiscardsEffect
  | EachOpponentLosesLifeEffect
  | PumpSelfByGraveyardCountEffect
  | PumpSelfByGreatestControlledArtifactManaValueEffect
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
  | DamageTargetCreatureEffect
  | SweepDamageFromChosenCreatureEffect
  | SearchLibraryForNamedCardEffect
  | BuffAllCreaturesEffect
  | BecomeCreatureUntilEndOfTurnEffect
  | CreateTokenCopyOfTargetEffect
  | CreateTokenCopyOfSelfEffect
  | ExileSpecificInstancesEffect
  | BecomeCopyOfAnyCreatureThenAddCountersEffect
  | CreateTokenIfNotControllingNamedEffect
  | DebuffOpponentCreaturesEffect
  | MillSelfEffect
  | EachPlayerMillsEffect
  | DamageTargetCreatureEqualToCreaturesAndEquipmentEffect
  | TapAllOpponentCreaturesEffect
  | OpponentsCantCastNoncreatureSpellsThisTurnEffect
  | DestroyAllEffect
  | DamageEachCreatureEffect
  | DamageEachOpponentEqualToGraveyardNoncreatureNonlandCountEffect
  | GrantKeywordsToTargetPermanentEffect
  | GrantTemporaryKeywordToSelfEffect
  | GrantIndestructibleToTargetWhileSourceInPlayEffect
  | GrantKeywordsToControlledPermanentsEffect
  | GrantKeywordsToAllCreaturesEffect
  | GainControlOfTargetCreatureEffect
  | GiveControlOfAnotherOwnPermanentToOpponentEffect
  | GainControlOfTargetEquipmentAndAttachEffect
  | SetPendingNextCreatureSpellBonusEffect
  | CreateTokenIfControlledSubtypeCountAtLeastEffect
  | BuffOtherCreaturesYouControlByControlledSubtypeCountEffect
  | MillEachOpponentByYourHandSizeEffect
  | DamageTargetCreatureEqualToOtherControlledSubtypePowerEffect
  | SearchLibraryForSubtypeEffect
  | SearchLibraryForCreatureWithManaValueAtMostEffect
  | ExileTopOfEachOpponentLibraryEffect
  | DamageAnyTargetEffect
  | SupportEffect
  | GrantOnDeathReturnToHandToTargetEffect
  | DestroyUpToOneOpponentArtifactThenPutCounterOnSelfEffect
  | IfCounterPutOnSelfThisTurnEffect
  | RemoveAllCountersEnterWithDoubleAsCounterEffect
  | PutOwnCountersOnTargetThenShuffleSelfIntoLibraryEffect
  | MonstrosityByControlledCreatureCounterCountEffect
  | RepeatProliferateByNontokenCreaturesEnteredThisTurnEffect
  | RonsoRageEffect
  | IfCounterPutOnOwnCreatureThisTurnEffect
  | DrawForCreaturesWithCounterThenGrantIndestructibleEffect
  | ExileTargetCreatureThenControllerMaySearchBasicLandEffect
  | PutTargetNonlandPermanentInLibraryOwnersChoiceEffect
  | MayMoveAllCountersToTargetCreatureEffect
  | GrantPreventCombatDamageConvertToCounterToTargetOwnCreatureEffect
  | AdaptEffect
  | SearchLibraryForUpToXBasicLandsEqualToPowerEffect
  | MoveCounterFromOpponentCreatureToOwnCreatureEffect
  | SearchLibraryForLandConditionalBattlefieldIfOpponentHasMoreLandsEffect
  | PlayHideawayCardEffect
  | PutCounterOnTargetOwnCreatureThenMayPlayHideawayIfCreaturePowerAtLeastEffect
  | ExploreEffect
  | MoveDeadPermanentCountersToTargetEffect
  | MoveAllCountersBetweenTargetPermanentsEffect
  | MoveOneCounterFromOwnPermanentToAnyPermanentEffect
  | ArmManaIdentitySourceScryEffect
  | MayPayManaThenEffect
  | ReturnSelfFromGraveyardTappedAndAttackingEffect
  | DiscardHandThenDrawEffect
  | EachPlayerMayDiscardHandAndDrawThenDamageOpponentsWhoDidEffect
  | MogMoogleWarriorDanceEffect
  | GainControlOfTargetNoncreatureArtifactPermanentEffect
  | GainControlOfAllArtifactsControlledByOpponentEffect
  | WinGameIfControlAtLeastNOfTypeEffect
  | EachOpponentMaySacrificeNontokenCreatureElseLoseLifePerInstantSorceryEffect
  | OpponentMayHaveYouDrawElseMillAndDealDamageEffect
  | MayAttachTargetControlledEquipmentToSelfEffect
  | AddManaEqualToOwnLoreCounterEffect
  | DrawCardsEqualToGreatestPowerEffect
  | GainLifeEqualToTwiceGreatestPowerEffect
  | ShuffleTargetPermanentIntoLibraryThenRevealTopEffect
  | DestroyAnyNumberOfTappedCreaturesWithDifferentControllersEffect
  | PhaseOutAnyNumberOfTargetControlledNonlandPermanentsEffect
  | MayPutTopLandOntoBattlefieldTappedEffect
  | ChooseUpToNCreaturesSacrificeRestEffect
  | MayBecomeCopyOfAnotherControlledCreatureThenBuffBothEffect
  | DrawForEquippedAttackersThenEffectsIfPowerAtLeastEffect
  | ScryThenExileTopPlayableThisTurnThenPumpTargetByExiledManaValueEffect
  | MayPutExactNamedCardFromLibraryToHandForTargetPlayerEffect
  | PutCounterOnEachControlledCreatureMatchingSubtypeEffect
  | GrantTemporaryNoncreatureCastCreatesTokenCopyEffect
  | ExileTargetCreatureThenControllerGainsLifeEqualToPowerEffect
  | ReturnTargetCreatureFromGraveyardToHandOrBattlefieldIfLifeGainedAtLeastEffect
  | ReturnTargetCreatureFromGraveyardToHandOrBattlefieldIfGraveyardCountAtLeastEffect
  | PutAllCreatureCardsFromAllGraveyardsOntoBattlefieldEffect
  | MillThenOpponentChoosesCreatureFromYourGraveyardToBattlefieldEffect
  | TragicArroganceEffect
  | EachOpponentDrawsThenCasterDrawsForEachWhoDidEffect
  | MaySacrificeAnotherNonlandPermanentThenDrawAndOpponentsLoseLifeEqualToManaValueEffect
  | ExileFromOpponentLibraryUntilTypeThenMayCastFreeEffect
  | SacrificeSelfEffect
  | ExileSelfEffect
  | GrantCantBlockToUpToThreeTargetsEffect
  | DiscardThenDrawThenDamageOpponentsEqualToDiscardedManaValueEffect
  | EachOpponentSacrificesCreatureWithGreatestPowerEffect
  | ExileEachOpponentGraveyardThenMayCopyExiledCreatureAsTokenEffect
  | ExileRandomFromEachOpponentGraveyardThenMayCastFreeEffect
  | UntapAllControlledCreaturesEffect;

/** One mode of a "Choose one or more —" modal spell (e.g. Clash of the
 * Eikons) - the caster picks any NONEMPTY subset of modes at cast time (see
 * GameAction 'CAST_CARD's chosenModeIndices), and every chosen mode's
 * effects resolve in the order the modes are printed, regardless of pick
 * order. See engine/actions.ts: castCard. */
export interface SpellMode {
  label: string;
  effects: CardEffect[];
}

/** "Tiered (Choose one additional cost.)" (Vincent's Limit Break) - unlike
 * SpellMode/chooseModes (any nonempty subset, no extra cost), Tiered is
 * EXACTLY one pick, and each option adds its OWN cost on top of the card's
 * printed cost - the pick has to happen before payment, not after, since it
 * changes what payment even means. See GameAction 'CAST_CARD's
 * chosenTierIndex and engine/actions.ts: castCard. */
export interface TieredMode {
  label: string;
  additionalCost: string;
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
  /** "Basic landcycling [cost]" (Ash Barrens) - unlike searchLandName above
   * (one exact printed name), this matches ANY of the 5 basic lands, the
   * controller's own pick. See engine/actions.ts: cycleCard. */
  searchAnyBasicLand?: boolean;
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

/** One entry of engine/combat.ts: COUNTER_CHARACTERISTIC_OVERRIDES - a "mini
 * layer system" for "any permanent with a [counter label] counter on it has
 * these specific printed characteristics replaced" (Ultima, Origin of
 * Oblivion's blight counter: "For as long as that land has a blight counter
 * on it, it loses all land types and abilities and has '{T}: Add {C}.'").
 *
 * Deliberately keyed by COUNTER LABEL in a shared registry, not attached to
 * whichever CardDefinition happens to grant the counter - a counter's
 * meaning has to be checked against the permanent that HAS it (e.g. an
 * opponent's Plains blighted by Ultima), which is almost never the card
 * that put it there, so the override can't live on the source's own
 * CardDefinition. This mirrors how this engine already treats a few other
 * special counter labels (Finality, Stun) as universal, hardcoded-by-name
 * behaviors rather than per-card data - just generalized into a small
 * lookup table instead of one-off `c.label === '...'` checks, so a future
 * card introducing a NEW counter-driven characteristic change is a single
 * new registry entry, not new code. NOT a full Magic-rules layer system (no
 * timestamps, no dependency resolution, no interaction between multiple
 * overrides active at once) - see engine/combat.ts:
 * getActiveCharacteristicOverride for how an entry is actually read, and
 * its own comment for exactly how limited "mini" is here. */
export interface CharacteristicOverride {
  /** Replaces CardDefinition.subtype entirely (e.g. a land losing every
   * printed land type). Omit to leave subtype untouched. */
  overridesSubtype?: string;
  /** Replaces CardDefinition.producesMana entirely (e.g. a land that could
   * tap for {G} or {W} now only makes {C}) - null replaces it with "produces
   * nothing at all" rather than leaving the printed ability active. Omit to
   * leave producesMana untouched. */
  overridesProducesMana?: ManaColor | 'any' | ManaColor[] | null;
}

/** Cast this from the graveyard once, for this cost, then exile it instead of it going to the graveyard again. */
export interface FlashbackAbility {
  cost: string;
  /** Overrides CardDefinition.onCast/onEnter specifically for THIS
   * (flashback) cast, when the card's own effect genuinely differs
   * depending on where it was cast from (The Final Days: "create two
   * tokens" from hand, but "create X tokens" via flashback) - see
   * engine/actions.ts: castFromGraveyard. Omit to just reuse onCast/onEnter
   * unchanged, which is what every other flashback card here still does. */
  effects?: CardEffect[];
}

/** "Overload {cost} (You may cast this spell for its overload cost. If you
 * do, change "target" in its text to "each.")" (Vandalblast) - this
 * engine's first Overload card, so there's no existing alternate-cost
 * concept to extend; modeled narrowly (hand-cast instants/sorceries only,
 * no permanent-type support) since nothing in this card pool needs more
 * yet. See GameAction 'CAST_WITH_OVERLOAD', engine/actions.ts:
 * castWithOverload - a deliberately simpler sibling of castFromGraveyard's
 * flashback handling (no onEnter/Saga/artifact/subtype/creature-watcher
 * support), since every card with `overload` so far is a plain sorcery. */
/** "Blitz—[cost], Discard a card. (If you cast this spell for its blitz
 * cost, it gains haste and 'When this creature dies, draw a card.'
 * Sacrifice it at the beginning of the next end step.) You may cast this
 * card from your graveyard using its blitz ability." (Sabin, Master Monk) -
 * this engine's first Blitz card, so there's no existing alternate-cost
 * concept to extend; modeled as a bespoke GameAction ('CAST_WITH_BLITZ')
 * rather than folding into castCard's already-long parameter list, since
 * the discard-a-card cost needs the player to choose WHICH card (unlike
 * the loot-effect approximation used for an ordinary "discard as an
 * additional cost" elsewhere - this one has no draw to piggyback on). */
export interface BlitzAbility {
  cost: string;
}

/** "Unearth [cost] ([cost]: Return this card from your graveyard to the
 * battlefield. It gains haste. Exile it at the beginning of the next end
 * step or if it would leave the battlefield. Unearth only as a sorcery.)"
 * (Priest of Fell Rites) - graveyard-only (unlike Blitz, never castable
 * from hand), no discard cost, just mana. Modeled as its own GameAction
 * ('ACTIVATE_UNEARTH') rather than extending BlitzAbility, since there's no
 * discard choice to thread through. Approximated like Blitz: a creature
 * brought back this way gets haste and a delayed ExileSelfEffect queued
 * via GameState.pendingDelayedEndStepEffects (not a full "replacement
 * effect for the rest of the game" - if it dies earlier some OTHER way,
 * it goes to the graveyard normally instead of being exiled, same scope
 * limitation already accepted for Blitz's own delayed sacrifice). See
 * engine/actions.ts: activateUnearth. */
export interface UnearthAbility {
  cost: string;
}

export interface OverloadAbility {
  cost: string;
  /** The effects actually resolved under Overload - always a board-wide
   * "each" version of the card's own normal onCast, e.g. destroyAll
   * instead of destroyTarget. Required (unlike FlashbackAbility.effects)
   * since Overload's whole point is changing "target" to "each" - there's
   * no sensible fallback to the card's own onCast. */
  effects: CardEffect[];
}

/** "Rebound (If you cast this spell from your hand, exile it as it
 * resolves. At the beginning of your next upkeep, you may cast this card
 * from exile without paying its mana cost.)" (Transpose) - only triggers
 * when cast from HAND; castCard is the only function that ever casts a
 * card FROM hand (every other zone - graveyard, exile, flashback, Blitz,
 * Unearth, ... - has its own dedicated function), so "was this cast from
 * hand" needs no separate flag threaded through resolveCardEffects: it's
 * simply whichever function is doing the casting. `effects` is the
 * separate list resolved on the REBOUND recast itself (Transpose's own
 * "If this spell was cast from your hand, create a..." token clause is
 * correctly omitted there, since that recast is from exile, not hand) -
 * required, same reasoning as OverloadAbility.effects: there's no sensible
 * fallback to the card's own onCast, which may include a hand-only clause.
 * See GameState.pendingReboundChoice, CardInstance.pendingReboundNextUpkeep,
 * engine/actions.ts: castCard/resolveReboundChoice. */
export interface ReboundAbility {
  effects: CardEffect[];
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
  /** Alternative payout - "this creature deals N damage to each opponent"
   * (Sabotender) - same shot as NoncreatureCastTrigger.damageEachOpponent,
   * just gated on landfall instead of a noncreature cast. */
  damageEachOpponent?: number;
  /** Alternative payout - "put a [counterLabel] counter on TARGET creature
   * you control" (Ride the Shoopuf) - resolved via the existing
   * PutCounterOnUpToOneOwnCreatureEffect/pendingTarget flow, so in practice
   * the pick is technically declinable ("up to one") rather than truly
   * mandatory like the card's "target" wording - a minor, harmless deviation
   * since a rational player never declines a free counter. */
  putCounterOnTargetOwnCreature?: { counterLabel: string; counterAmount: number };
  /** Alternative payout - "[subtype]s you control get +X/+Y until end of
   * turn" (Black Chocobo) - resolved via the existing
   * PumpControlledSubtypeEffect, immediate, no targeting. */
  pumpControlledSubtype?: { subtype: string; power: number; toughness: number };
  /** Alternative payout - "double [this]'s power until end of turn" (Tifa
   * Lockhart) - reads the SOURCE's own current effective power at trigger
   * time and applies that same amount again as a temporary buff (additive
   * doubling), unlike temporaryBuff's fixed +X/+Y. */
  doubleSelfPowerUntilEndOfTurn?: boolean;
  /** Alternative payout - "you may discard a card. If you do, draw a card"
   * (Rydia, Summoner of Mist) - resolved via the existing
   * DiscardUpToThenDrawThatManyEffect with maxCount 1 (discard 0 or 1 of
   * your own choice, draw that many). */
  discardUpToOneThenDraw?: boolean;
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
  /** `grantKeyword`, when set, ALSO grants that keyword until end of turn
   * (Sahagin's "put a +1/+1 counter... and it can't be blocked this turn"). */
  counterIfExpensive?: { minManaValue: number; counterLabel: string; counterAmount: number; grantKeyword?: string };
  /** "Whenever you cast a noncreature spell, surveil N" (Garland, Knight of
   * Cornelia) - reuses the same pendingSurveil flow as SurveilEffect. */
  surveilCount?: number;
  /** "Whenever you cast a noncreature spell, [this] deals 1 damage to each
   * opponent. If you have a full party, it deals 3 damage to each opponent
   * instead." (The Destined Black Mage) - see hasFullParty (engine/actions.ts). */
  damageEachOpponentOrMoreWithFullParty?: { normal: number; fullParty: number };
  /** "Whenever you cast a noncreature spell, this creature gets +X/+Y until
   * end of turn" (Prowess, e.g. Queen Brahne) - a temporary self-buff, unlike
   * counterIfExpensive's permanent counter. Applied via applyTemporaryBuff,
   * so it's not gated on how much mana was spent (real Prowess never is). */
  pumpSelf?: { power: number; toughness: number };
  /** "If at least [minManaValue] mana was spent casting it, create [tokenId]"
   * (Prompto Argentum's Selfie Shot) - like counterIfExpensive but creates a
   * token instead of a counter. */
  createTokenIfExpensive?: { minManaValue: number; tokenId: string };
  /** "Whenever you cast a noncreature spell, [this] gets +X/+0 until end of
   * turn, where X is the mana spent casting it. If X is 4 or more, draw a
   * card." (Shantotto, Tactician Magician) - a DYNAMIC self-buff scaled by
   * mana spent (unlike pumpSelf's fixed amount), with an optional draw
   * threshold. */
  pumpSelfByManaSpent?: { drawIfAtLeast?: number };
  /** "If at least [minManaValue] mana was spent casting it, tap target
   * creature an opponent controls and put a stun counter on it" (Ultros,
   * Obnoxious Octopus) - sets up the same pendingTarget/tapAndStun flow as
   * TapAndStunEffect, just gated on mana spent instead of an immediate cast. */
  tapAndStunOpponentCreatureIfExpensive?: { minManaValue: number };
  /** "If at least [minManaValue] mana was spent casting it, draw N cards"
   * (Tellah, Great Sage's "if four or more mana was spent, draw two
   * cards") - unlike counterIfExpensive/createTokenIfExpensive, this pays
   * out cards instead of a counter or token. */
  drawCardsIfExpensive?: { minManaValue: number; amount: number };
  /** "If at least [minManaValue] mana was spent casting it, sacrifice
   * [this] and it deals that much damage to each opponent" (Tellah, Great
   * Sage's "if eight or more mana was spent, sacrifice Tellah and it deals
   * that much damage to each opponent") - the damage amount is however
   * much mana was ACTUALLY spent (which is always >= minManaValue), not a
   * fixed number. */
  sacrificeSelfAndDealDamageEqualToManaSpentIfExpensive?: { minManaValue: number };
  /** "Whenever you cast a noncreature spell, you may pay X life, where X is
   * that spell's mana value. If you do, create a 1/1 colorless Hero
   * creature token and put X +1/+1 counters on it. Do this only once each
   * turn." (G'raha Tia, Scion Reborn's "Throw Wide the Gates") - X is
   * approximated as `manaSpent` (same established "mana value" ≈ "mana
   * actually spent" conflation as every sibling field above, e.g.
   * counterIfExpensive), paused on the controller's yes/no choice via
   * GameState.pendingThrowWideTheGatesChoice (unlike every sibling trigger
   * above, which all resolve immediately) and gated once per turn via
   * CardInstance.throwWideTheGatesTriggeredThisTurn. See
   * engine/actions.ts: resolveThrowWideTheGatesChoice. */
  mayPayLifeEqualToManaSpentCreateHeroTokenOncePerTurn?: boolean;
  /** "Whenever you cast a noncreature spell with mana value [N] or
   * greater, [this] deals M damage to each opponent and you gain M life."
   * (Y'shtola, Night's Blessed) - gated on the triggering spell's mana
   * value (approximated as `manaSpent`, same established conflation as
   * every sibling field above), unlike every sibling here this has NO
   * once-per-turn restriction (Y'shtola's own text states none). */
  damageEachOpponentAndGainLifeIfManaValueAtLeast?: { minManaValue: number; amount: number };
  /** "Whenever you cast a noncreature spell, you may return target creature
   * card with mana value equal to that spell's mana value from your
   * graveyard to your hand. Do this only once each turn." (Krile Baldesion's
   * Trace Aether) - "that spell's mana value" is approximated as
   * `manaSpent` (same established conflation as every sibling field above).
   * Arms the usual pendingTarget/CHOOSE_TARGET flow (declinable, same as
   * every other "may" + target effect) only if a legal target exists;
   * gated once per turn via CardInstance.traceAetherTriggeredThisTurn. See
   * engine/effects.ts: triggerNoncreatureCastAbilities, engine/actions.ts:
   * chooseTarget. */
  mayReturnCreatureFromGraveyardWithManaValueEqualToSpentOncePerTurn?: boolean;
  /** Restricts every field below (currently just `effects`, but also
   * `surveilCount` above) to fire only when the triggering spell was
   * specifically an instant or sorcery (Fandaniel, Telophoroi Ascian's
   * "Whenever you cast an instant or sorcery spell, surveil 1.") - unlike
   * every OTHER field on this struct, which fire for ANY noncreature cast
   * (artifact/enchantment included). See engine/actions.ts: the `castType`
   * parameter threaded into triggerNoncreatureCastAbilities. */
  instantOrSorceryOnly?: boolean;
  /** Generic catch-all: any ordinary CardEffect list (including a
   * TARGETED one - resolveCardEffects can still arm pendingTarget from
   * here, same as tapAndStunOpponentCreatureIfExpensive already proves)
   * resolved unconditionally on a qualifying noncreature cast. Added so
   * cast-trigger cards whose effect doesn't fit any of the specific
   * parameterized shapes above (Estinien Varlineau's counter+flying,
   * Hermes's Bird token, Hraesvelgr's targeted pump+unblockable) don't
   * each need their own bespoke field. */
  effects?: CardEffect[];
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
   * doesn't apply by default and the card's own last-chapter effect governs
   * its fate instead (e.g. an exileAndReturnTransformedSelf loop back to the
   * front face). Set explicitly to false to opt a non-creature Saga out too.
   * Set explicitly to true to force a creature Saga to ALSO sacrifice itself
   * after its final chapter (e.g. Braska's Final Aeon, or any "Summon: X"
   * Saga creature whose own reminder text says "Sacrifice after N") -
   * without this override, a creature Saga never auto-sacrifices no matter
   * how high its lore counter climbs. See engine/effects.ts:
   * triggerSagaLoreCounter. */
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
  /** 'commanderColorIdentity' (Arcane Signet's "Add one mana of any color in
   * your commander's color identity") is resolved in engine/actions.ts:
   * toggleTap into a concrete ManaColor[] before ever reaching
   * resolveTapColor - approximated as the colors appearing in the
   * controller's commander's own printed mana cost only (this engine has no
   * broader "color identity" tracker that also reads a commander's rules
   * text/reminder text for colors mentioned there, which real Commander
   * rules would include). Falls back to plain colorless ({C}) if the
   * controller has no commander set (e.g. a non-Commander game) or their
   * commander is colorless. */
  /** 'opponentLandColors' (Exotic Orchard's "Add one mana of any color that a
   * land an opponent controls could produce") is also resolved in
   * engine/actions.ts: toggleTap, the same way as commanderColorIdentity -
   * unions every ManaColor each opponent-controlled land's own producesMana
   * (or altProducesMana) could ever give, excluding colorless ({C}, matching
   * real Magic's "any color" meaning the five colors only). Falls back to
   * plain colorless if the opponent controls no mana-producing land, or
   * only colorless-producing ones. In a 2-player engine "an opponent" is
   * always just the one opponent. */
  /** 'ownLandColors' (Incubation Druid's "Add one mana of any type that a
   * land you control could produce") - the controller's-own-lands mirror of
   * 'opponentLandColors' below, resolved the exact same way in
   * engine/actions.ts: toggleTap (via the ownLandColors helper), just reading
   * the controller's own battlefield instead of their opponent's. */
  producesMana?: ManaColor | 'any' | ManaColor[] | 'commanderColorIdentity' | 'opponentLandColors' | 'ownLandColors';
  /** "Pain land" - a SECOND, alternate tap-for-mana mode alongside the plain
   * producesMana above (Brushland: "{T}: Add {C}." / "{T}: Add {G} or {W}.
   * This land deals 1 damage to you.") - engaged in engine/actions.ts:
   * toggleTap only when the player's chosen color is one of THESE colors
   * (not producesMana's own), in which case that color is added and payLife
   * damage is dealt instead of the plain mode applying. */
  altProducesMana?: { colors: ManaColor[]; payLife: number };
  /** How much of producesMana's color one tap actually adds - defaults to 1.
   * Ring of the Lucii's "T: Add MM" (two colorless from one tap) needs 2.
   * Affects both sides of engine/actions.ts: toggleTap (adding it, and
   * refunding it on a same-turn free untap) and the client's own
   * untappableCardsInGroup (client/src/components/GameBoard.tsx), which has
   * to know how much of the pool one more untap would actually give back. */
  producesManaAmount?: number;
  /** "{T}: Add {C} for each charge counter on this artifact" (Everflowing
   * Chalice) - overrides producesManaAmount above with a LIVE count read off
   * the specific CardInstance's own counters instead of a fixed printed
   * number, for cards whose mana output scales with their own counters. */
  producesManaAmountEqualToOwnCounterLabel?: string;
  /** "Add one mana... If this creature has a [counterLabel] counter on it,
   * add three mana of that type instead" (Incubation Druid) - unlike
   * producesManaAmountEqualToOwnCounterLabel (output scales 1:1 with a
   * counter count), this is a flat ALL-OR-NOTHING override: the instance
   * either has at least one of counterLabel (amount applies) or it doesn't
   * (plain default of 1 applies). Checked in engine/actions.ts:
   * effectiveProducedManaAmount. */
  producesManaAmountIfOwnCounter?: { counterLabel: string; amount: number };
  /** "Activate only if you control five or more lands" (Temple of the False
   * God) - gates producesMana entirely (the tap is simply illegal below this
   * land count), checked in engine/actions.ts: toggleTap. */
  producesManaOnlyIfControlLandCount?: number;
  /** "Whenever you tap a land for {C}, add an additional {C}" (Ultima,
   * Origin of Oblivion) - a controller-wide passive, unlike producesManaAmount
   * (a fixed per-permanent amount printed on the mana source itself). Only
   * ever doubles LAND colorless production specifically, matching the
   * printed wording. See engine/actions.ts: effectiveProducedManaAmount,
   * used everywhere a land's colorless tap is actually added to or refunded
   * from the mana pool. */
  doublesColorlessManaFromLands?: boolean;
  /** "If you tap a permanent for mana, it produces three times as much of
   * that mana instead." (The Cloudsea Djinn) - unlike
   * doublesColorlessManaFromLands above (lands only, {C} only), this
   * applies unconditionally: any permanent, any color. Stacks
   * multiplicatively with doublesColorlessManaFromLands when both are
   * controlled (e.g. a colorless-producing land under both becomes ×6).
   * See engine/actions.ts: effectiveProducedManaAmount. */
  triplesAllManaProduced?: boolean;
  /** "Whenever you tap a nonland permanent for mana, add one mana of any
   * type that permanent produced." (Seymour Guado) - unlike
   * triplesAllManaProduced above (a flat multiplier on the amount
   * produced), this is a flat +1 of the SAME resolved color, added once
   * per qualifying tap regardless of how much that tap itself produced,
   * and only for NONLAND permanents (lands are excluded by the printed
   * text, unlike every other mana-doubler here). Fires once per controlled
   * permanent carrying this field (so two copies would each add one).
   * Checked in engine/actions.ts: toggleTap, right after the tap's own
   * mana is added to the pool. */
  grantsExtraManaOfSameTypeWhenTappingNonlandPermanent?: boolean;
  abilities?: CardAbility[];
  /** Marks this as an Aura or Equipment - what kind of permanent it can be
   * attached to. See CardInstance.attachedToInstanceId and
   * engine/actions.ts: attachCard/detachCard. */
  attachesTo?: 'creature' | 'artifact' | 'land' | 'enchantment' | 'permanent';
  /** Equipment only - mana cost to attach/reattach. Auras don't have this;
   * they attach for free once, right after casting, via the same Attach flow. */
  equipCost?: string;
  /** "Equip legendary creature {3}" alongside a plain "Equip {7}"
   * (Wrecking Ball Arm) - a CHEAPER alternate cost that only applies when
   * the chosen target is legendary. Auto-selected whenever the target
   * qualifies (there's never a reason to pay the pricier equipCost on a
   * legendary target instead), same "auto-pick the better option" approach
   * as Metalcraft's whole-cost override - no "which equip ability"
   * selection UI needed. See engine/actions.ts: attachCard. */
  equipCostIfTargetLegendary?: string;
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
  /** "As long as this Equipment is attached to a creature, your opponents
   * can't cast spells during your turn." (Conqueror's Flail) - checked
   * only in engine/actions.ts: castCard's own main path (not
   * castFromGraveyard/flashback/exile), same scoped-down convention as
   * NoncreatureCastTrigger. Lands aren't spells, so playing one is never
   * blocked by this. */
  equipGrantsOpponentsCantCastDuringYourTurn?: boolean;
  /** "Creature cards you own that aren't on the battlefield have flash."
   * (Edea Kramer) - checked alongside the plain printed `flash` keyword
   * wherever cast timing matters (hand, flashback/graveyard, exile - every
   * current casting path), restricted to CREATURE cards per the printed
   * wording. See engine/actions.ts: hasValidCastTiming. */
  grantsFlashToOwnedCreatureCardsNotOnBattlefield?: boolean;
  /** "Each opponent can cast spells only any time they could cast a
   * sorcery." (Edea Kramer) - a board-wide restriction on the OPPONENT,
   * overriding even their own innately instant/flash spells (unlike
   * equipGrantsOpponentsCantCastDuringYourTurn above, which only blocks
   * entirely during the controller's turn, this applies on EITHER turn,
   * every turn). See engine/actions.ts: hasValidCastTiming. */
  opponentsCanOnlyCastAtSorcerySpeed?: boolean;
  /** "[This] enters tapped and doesn't untap during your untap step."
   * (Giant of Babil) - unlike CardInstance-derived attachedPreventsUntap
   * (an attached Equipment/Aura causing ITS HOST not to untap), this is
   * the permanent's own innate characteristic, no attachment needed. See
   * engine/actions.ts: runUntapStep. */
  doesntUntapDuringControllerUntapStep?: boolean;
  /** "If you would draw a card while your library has no cards in it, you
   * win the game instead." (Vana'diel Adventurers) - this engine has no
   * "lose by decking out" rule at all (an empty-library draw is simply a
   * rejected action), so this is purely additive: it's the first thing
   * that ever happens on an empty-library draw. See engine/actions.ts:
   * performDraw. */
  winsGameIfWouldDrawFromEmptyLibrary?: boolean;
  /** Fires once, automatically, when this permanent enters the battlefield. */
  onEnter?: CardEffect[];
  /** "Eminence — Whenever another nontoken Wizard you control enters, if
   * [this] is in the command zone or on the battlefield, [effects]."
   * (Inalla, Archmage Ritualist) - resolves with the ENTERED creature as
   * source (same shape as onAnyControlledCreatureEnterEffects), filtered to
   * non-token permanents matching `subtype`, excluding the watcher itself.
   * Eminence's "or in the command zone" half is deferred - checked only
   * while this permanent is actually on the battlefield, since nothing in
   * this engine watches for triggers from a card sitting in the command
   * zone. See engine/effects.ts: triggerCreatureEnterWatchers. */
  onAnyOtherControlledNontokenSubtypeEnterTrigger?: { subtype: string; effects: CardEffect[] };
  /** "Whenever you sacrifice a [subtype], [effects]." (Vaan, Aspiring
   * Pirate's "Whenever you sacrifice a Treasure, Vaan gets +1/+0 until end
   * of turn") - checked against every permanent the controller sacrifices
   * (matched by `verb === 'is sacrificed'`, the same tag already used at
   * every genuine sacrifice call site in this engine), queued via
   * GameState.pendingOwnSacrificeSubtypeTriggerEffects since
   * engine/combat.ts: moveCreaturesToGraveyard can't call resolveCardEffects
   * itself (same circular-import reason as pendingEquipmentDeathEffects).
   * Resolves with the WATCHER (not the sacrificed permanent) as source. */
  onOwnSacrificeSubtypeTrigger?: { subtype: string; effects: CardEffect[] };
  /** Fires once, automatically, when this instant/sorcery resolves (right
   * before it goes to the graveyard). */
  onCast?: CardEffect[];
  /** Fires once, automatically, whenever this creature is declared as an
   * attacker. See engine/actions.ts: declareAttackers. */
  onAttack?: CardEffect[];
  /** "Whenever an opponent attacks you, ..." (Lulu, Stern Guardian) - the
   * DEFENDER's counterpart to onAttack above: fires once per permanent that
   * has it (not once per attacker), whenever the opponent declares one or
   * more attackers, regardless of who/how many. See engine/actions.ts:
   * declareAttackers, checked against the DEFENDING player's battlefield. */
  onOpponentAttacksYou?: CardEffect[];
  /** "Whenever an opponent attacks with creatures, if two or more of those
   * creatures are attacking you and/or planeswalkers you control, [effect]."
   * (Minwu, Rebellion Strategist) - the count-gated sibling of
   * onOpponentAttacksYou just above: same "fires once per permanent, once
   * per combat, regardless of who/how many" shape, but only when the
   * TOTAL number of declared attackers meets minCount. "...and/or
   * planeswalkers you control" simplifies away - this engine has no
   * planeswalkers, so every declared attacker is already attacking the
   * defending player. See engine/actions.ts: declareAttackers. */
  onOpponentAttacksYouWithCreatureCountAtLeast?: { minCount: number; effects: CardEffect[] };
  /** "Whenever a non-Human creature you control attacks, [effect]." (Bartz
   * Klauser) - a board-wide watcher like onAnyControlledCreatureCombatDamageToPlayer,
   * but checked at attack DECLARATION instead of combat damage, and
   * filtered to attackers whose own subtype does NOT contain
   * `excludedSubtype`. Fires once per qualifying attacker (not once per
   * combat), with the WATCHER (not the attacker) as sourceInstanceId. See
   * engine/actions.ts: finalizeDeclareAttackers. */
  onAnyControlledCreatureAttacksWithoutSubtypeTrigger?: { excludedSubtype: string; effects: CardEffect[] };
  /** "Whenever a Warrior attacks, you may have its controller create a 1/1
   * white Warrior creature token that's tapped and attacking." (Cloud
   * Strife) - unlike every sibling attack watcher above (checked against
   * the WATCHER's own controller's attackers only), this fires for ANY
   * Warrior that attacks EITHER player's declared attack, since
   * engine/actions.ts: finalizeDeclareAttackers is checked against both
   * battlefields for this field. The token always goes to the ATTACKING
   * Warrior's controller (not necessarily this watcher's own controller),
   * via a dedicated CreateTokenForFixedPlayerEffect baked with that
   * player's id at trigger time - a plain createToken can't redirect to a
   * player other than whoever resolveCardEffects runs as. The "may" is a
   * GameState.pendingMayEffect prompt for THIS permanent's controller (the
   * one deciding whether to hand out the token), same single-pending-slot
   * limitation already accepted elsewhere when multiple triggers could
   * fire from one event (e.g. Interceptor, Shadow's Hound) - if more than
   * one Warrior attacks in the same declaration, only the last one's
   * prompt survives. */
  onAnyWarriorAttacksMayCreateTokenForAttackerController?: { tokenId: string };
  /** "{T}: Add one mana of any color. [Additional effect]" (Yuna, Grand
   * Summoner's Grand Summon) - fires alongside a plain producesMana tap
   * (see CardDefinition.producesMana, engine/actions.ts: toggleTap), only
   * when that specific tap actually produced mana (not a no-op tap on an
   * already-tapped or summoning-sick permanent). Lets a mana ability carry
   * a secondary effect without needing a whole separate activated ability -
   * reusable by any future "tap for mana, and also X" card. */
  onTapForManaEffects?: CardEffect[];
  /** "Cycling" family - activated from hand, see engine/actions.ts: cycleCard. */
  cycling?: CyclingAbility;
  /** "Ninjutsu [cost]" (Yuffie, Materia Hunter) - "[cost], Return an
   * unblocked attacker you control to hand: Put this card onto the
   * battlefield from your hand tapped and attacking." Legal only during
   * declare_blockers once blocks are assigned (so "unblocked" is actually
   * knowable) - see GameAction 'ACTIVATE_NINJUTSU' and engine/actions.ts:
   * activateNinjutsu. The ninja enters already attacking (added to
   * GameState.declaredAttackers in the returned creature's place), bypassing
   * summoning sickness, matching "put onto the battlefield... attacking". */
  ninjutsu?: { cost: string };
  /** See LandCountBuff - a static, always-on-condition-met power/toughness buff. */
  landCountBuff?: LandCountBuff;
  /** "You may play an additional land on each of your turns" (Zell Dincht) -
   * raises the controller's land-drop limit for the turn by this many, on
   * top of the ordinary one. Stacks additively across every such permanent
   * the controller has (not just this one). See PlayerState.landsPlayedThisTurn
   * and engine/actions.ts: castCard's land branch. */
  extraLandsPerTurn?: number;
  /** "Gets +N/+0 for each land you control" (Zell Dincht) - unlike
   * landCountBuff (a fixed bonus once a threshold is met) this SCALES
   * per-unit with the controller's current land count, recomputed live
   * (same as basePowerEqualsControlledCreatureCount). See
   * engine/combat.ts: effectivePower. */
  powerBonusPerControlledLand?: number;
  /** "Gets +N/+N for each noncreature, nonland card in your graveyard"
   * (Xande, Dark Mage) - the graveyard-count cousin of
   * powerBonusPerControlledLand, recomputed live the same way. */
  powerBonusPerGraveyardNoncreatureNonland?: number;
  /** "This token gets +1/+1 for each artifact you control." (Terra
   * Branford's Construct token) - the controlled-artifact-count cousin of
   * powerBonusPerGraveyardNoncreatureNonland above, same "+N/+N applied to
   * BOTH stats" shape (checked in both effectivePower and
   * effectiveToughness), recomputed live. Matched by def.type === 'artifact'
   * only, same convention as every other artifact count in this engine
   * (e.g. controlledArtifactCountBaseStat) - an Artifact CREATURE (type:
   * 'creature', "Artifact Creature" only in its subtype text, like this
   * Construct itself) does NOT self-count, matching real Magic rules too
   * (the Construct's own ability only counts OTHER/all artifacts, and here
   * it happens to not be type==='artifact' itself anyway). */
  powerBonusPerControlledArtifact?: number;
  /** "During your turn, as long as [this] is equipped, it has [keywords]"
   * (Cloud, Planet's Champion's double strike + indestructible) - unlike
   * equipGrantsKeywordDuringOwnTurn (the EQUIPMENT granting a keyword to
   * whatever it's attached to), this is on the CREATURE itself and doesn't
   * care which Equipment it is, only that it's currently equipped by
   * something. See engine/combat.ts: hasBoardGrantedKeyword. */
  hasKeywordsWhileEquipped?: string[];
  /** "As long as you've cast two or more noncreature spells this turn, [this]
   * has double strike." (Lyse Hext) - a STATIC self-grant conditioned on
   * PlayerState.noncreatureSpellsCastThisTurn, unlike every "gains double
   * strike until end of turn" reactive grant elsewhere in this file. Checked
   * in engine/combat.ts: hasBoardGrantedKeyword, not gated to the
   * controller's own turn (double strike also matters while blocking on the
   * opponent's turn). Note: this card's own printed text contains the
   * literal phrase "double strike", so it also needs
   * excludeSelfKeywords: ['double strike'] - otherwise the naive
   * substring-based hasKeyword check in engine/keywords.ts would make it
   * unconditionally true. */
  hasDoubleStrikeIfControllerCastTwoOrMoreNoncreatureSpellsThisTurn?: boolean;
  /** "Equip abilities you activate that target [this] cost N less to
   * activate" (Cloud, Planet's Champion) - checked against the EQUIP
   * TARGET's own definition (not the equipment's), same generic-cost-only,
   * capped-at-printed-cost convention as every other cost reduction here.
   * See engine/actions.ts: attachCard. */
  reducesEquipCostWhenTargetingThis?: number;
  /** "You may cast artifact spells from your graveyard by paying N life in
   * addition to paying their other costs. If you cast a spell this way,
   * that artifact enters with a finality counter on it" (Noctis, Prince of
   * Lucis) - a STATIC, always-available permission for ANY artifact in the
   * controller's own graveyard (unlike CardDefinition.flashback, which is a
   * per-card ability), exposed as GameAction 'CAST_ARTIFACT_FROM_GRAVEYARD_FOR_LIFE'.
   * See engine/actions.ts: castArtifactFromGraveyardForLife. */
  grantsCastArtifactsFromGraveyardForLife?: number;
  /** "Pray — Once during each of your turns, you may cast a creature spell
   * from among cards in your graveyard that were put there from anywhere
   * other than the battlefield this turn." (Banon, the Returners' Leader) -
   * checked against CardInstance.graveyardEntrySource (set at the handful of
   * most common "card enters a graveyard" call sites - see that field's own
   * doc comment for coverage caveats) and PlayerState.
   * usedGraveyardCastPermissionThisTurn. Pays the card's own NORMAL printed
   * cost (not flashback). See GameAction 'CAST_CREATURE_FROM_GRAVEYARD_VIA_GRANT'
   * and engine/actions.ts: castCreatureFromGraveyardViaGrant. Sorcery-speed
   * only (own turn, main phase), like an ordinary creature cast. */
  grantsOncePerTurnCastCreatureFromGraveyardIfNotFromBattlefield?: boolean;
  /** "Once during each of your turns, you may cast an artifact spell from
   * your graveyard. If you cast a spell this way, that artifact enters
   * tapped." (Edgar, Master Machinist) - the artifact-filtered cousin of
   * grantsOncePerTurnCastCreatureFromGraveyardIfNotFromBattlefield just
   * above: same shared PlayerState.usedGraveyardCastPermissionThisTurn flag
   * (only one such grant is expected in play at once, under the legend
   * rule), same NORMAL-cost/sorcery-speed-only shape, but with no
   * graveyardEntrySource restriction (ANY artifact in the graveyard
   * qualifies, not just one that entered this turn) and the returned
   * permanent always enters tapped regardless of its own printed
   * entersTapped. A separate GameAction/function
   * (CAST_ARTIFACT_FROM_GRAVEYARD_VIA_GRANT / castArtifactFromGraveyardViaGrant)
   * rather than generalizing castCreatureFromGraveyardViaGrant itself, to
   * avoid touching Banon's already-working, differently-conditioned path. */
  grantsOncePerTurnCastArtifactFromGraveyardEntersTapped?: boolean;
  /** "You may play lands and cast spells from the top of your library. If
   * you cast a spell this way, pay life equal to its mana value rather than
   * pay its mana cost." (Kefka's Tower) - a LIVE, always-on permission
   * (unlike every exilePlayGrants-based "play from X" mechanic elsewhere in
   * this engine, which are per-card queued grants): checked fresh every
   * time against whether the controller currently has ANY permanent with
   * this field, against whatever card is CURRENTLY sitting on top of their
   * library. See engine/actions.ts: castFromLibraryTop (its own dedicated
   * function, mirroring castFromExile/castFromGraveyard's "separate
   * function per alternate-zone cast source" convention rather than
   * threading a new lookup branch through castCard's already-enormous
   * body). "You may look at the top card of your library any time" is
   * satisfied for free by this - the UI has to show it face-up for it to
   * be clickable at all. */
  grantsPlayFromTopOfLibrary?: { payLifeInsteadOfManaCost?: boolean };
  /** "As long as this card is in your graveyard and you control a [landName],
   * creatures you control have [keyword]." (Anger) - the graveyard-sourced
   * sibling of staticAnthemForControlledSubtype's subtype: '*' case (same
   * "creatures you control have X" anthem, no subtype restriction), just
   * sourced from the graveyard instead of the battlefield, with an extra
   * "you control a land named X" gate. Checked in engine/combat.ts:
   * hasBoardGrantedKeyword. Same retroactive-haste caveat as
   * staticAnthemForControlledSubtype's own doc comment applies here too. */
  grantsControlledCreaturesKeywordWhileInGraveyard?: { keyword: string; requiresControlledLandName?: string };
  /** See FlashbackAbility - cast from the graveyard, see engine/actions.ts: castFromGraveyard. */
  flashback?: FlashbackAbility;
  /** See OverloadAbility - an alternate cast mode from hand (not graveyard
   * like flashback), changing the spell's own targeted effect into a
   * board-wide one. See GameAction 'CAST_WITH_OVERLOAD'. */
  overload?: OverloadAbility;
  /** "Foretell [cost]" (Ultimate Magic: Holy/Meteor, Lifestream's Blessing) -
   * "During your turn, you may pay {2} and exile this card from your hand
   * face down. Cast it on a later turn for its foretell cost." Reuses
   * GameState.exilePlayGrants (ExilePlayGrant.overrideCostLabel set to this
   * cost) as a PERSISTENT grant - see GameAction 'FORETELL_CARD' and
   * engine/actions.ts: foretellCard. The {2} exile cost is a fixed part of
   * the real keyword, not configurable per-card. */
  foretell?: { cost: string };
  /** "If this spell was cast from exile, [effects]." (Foretell's own bonus
   * clause on several cards) - resolved ONLY by engine/actions.ts:
   * castFromExile (never by the ordinary castCard/castFromGraveyard paths),
   * which is sufficient to guarantee "cast from exile" is genuinely true -
   * no separate flag needed. Runs IN ADDITION to onCast/onEnter, not instead
   * of it. */
  onCastFromExileEffects?: CardEffect[];
  /** "Whenever you play a land from exile or cast a spell from exile, you
   * gain [amount] life." (Urianger Augurelt) - a board-wide watcher,
   * checked against EVERY permanent the controller controls (not just
   * this one) whenever engine/actions.ts: castFromExile successfully
   * plays/casts something for them, via triggerPlayOrCastFromExileWatchers. */
  onPlayOrCastFromExileGainLife?: number;
  /** "This land/creature/artifact enters tapped." - applied the moment this
   * permanent is moved onto the battlefield (engine/actions.ts: castCard),
   * instead of leaving it to the player to remember to tap it themselves.
   * Only covers the plain, unconditional wording - a few cards phrase this
   * conditionally ("...unless it's your first, second, or third turn") or
   * apply it to something other than themselves (search effects tutoring a
   * land onto the battlefield tapped); those still need to be handled by hand. */
  entersTapped?: boolean;
  /** "As this land enters, you may reveal a [name1] or [name2] card from
   * your hand. If you don't, this land enters tapped" (a "check land",
   * Fortified Village) - matched by CARD NAME rather than a real land-type
   * check, since this pool's basic lands don't carry a subtype field for
   * their own basic land types (Forest/Plains/etc. are identified purely by
   * name here) - close enough for the only cards that would ever actually
   * satisfy this in practice (the basics themselves). See
   * GameState.pendingRevealLandTypeFromHand, engine/actions.ts: castCard's
   * land-playing branch, resolveRevealLandTypeFromHand. Only wired into
   * castCard's own "play a land normally" path, not every other "put a land
   * onto the battlefield" effect elsewhere in this engine (PuPu UFO, Yuna's
   * Decision) - those still just use the land's plain entersTapped. */
  entersTappedUnlessRevealLandNames?: string[];
  /** "~ enters the battlefield tapped unless you control an Island or a
   * Plains" (Glacial Fortress, an Innistrad "checkland") - unlike
   * entersTappedUnlessRevealLandNames above (a hand reveal, a real player
   * choice/interaction), this is a plain, fully-determined-by-board-state
   * check with no decision at all: computed once, directly, at the moment
   * of entry. Matched by CARD NAME, same reasoning and same limitation as
   * entersTappedUnlessRevealLandNames. Only wired into castCard's own "play
   * a land normally" path. */
  entersTappedUnlessControlLandNames?: string[];
  /** "~ enters the battlefield tapped unless you control two or more basic
   * lands" (Canopy Vista, a Battle for Zendikar "tango land") - counts
   * every permanent with CardDefinition.type === 'land' AND a name matching
   * one of the five basics (Plains/Island/Swamp/Mountain/Forest), same
   * name-based basic-land detection this engine already uses elsewhere
   * (e.g. CyclingAbility.searchAnyBasicLand). Only wired into castCard's
   * own "play a land normally" path. */
  entersTappedUnlessControlBasicLandCount?: number;
  /** See LandfallTrigger. */
  landfall?: LandfallTrigger;
  /** "Whenever a land an opponent controls enters, if that player controls
   * more lands than you, [effects]." (Archaeomancer's Map) - the condition
   * is evaluated live, at the moment the land enters (same "opponent has
   * more lands" comparison as SearchLibraryForLandConditionalBattlefieldIfOpponentHasMoreLandsEffect,
   * just as an ongoing watcher instead of a one-shot search gate), checked
   * against the WATCHER's controller's own land count vs. whichever player's
   * land just entered. See engine/effects.ts: triggerOpponentLandEnterWatchers,
   * called from engine/actions.ts: castCard's land branch, right alongside
   * triggerLandfall. Only wired into that one "play a land normally" path,
   * same scope limitation as landfall itself. */
  onOpponentLandEnterIfTheyHaveMoreLands?: { effects: CardEffect[] };
  /** See NoncreatureCastTrigger. */
  noncreatureCastTrigger?: NoncreatureCastTrigger;
  /** "When this creature transforms into [this], take an extra turn after
   * this one" (e.g. Ultimecia, Omnipotent's Time Compression) - checked
   * against the BACK face's own definition, whichever way the transform
   * happened (a paid transformSelf ability or a free FLIP_CARD), and queued
   * onto GameState.extraTurnsQueued. See engine/actions.ts: flipCard,
   * activateAbility, endTurn. */
  grantsExtraTurnOnTransform?: boolean;
  /** "Burning Chains — When the chosen player loses the game, you win the
   * game." (Shinryu, Transcendent Rival) - consulted in engine/actions.ts:
   * concede against the permanent's own CardInstance.chosenOpponentId (set
   * by a ChooseOpponentEffect). This engine is 2-player only, so this
   * doesn't currently change anything a plain "the other player wins"
   * wouldn't already give you - it's here so the actual mechanism the card
   * describes exists and is tested, ready for when the engine supports more
   * than 2 players (GameState.players would need to stop being a fixed
   * 2-tuple first). */
  winsGameIfChosenOpponentLoses?: boolean;
  /** "Whenever you gain life, put N counters of this label on THIS permanent"
   * (e.g. Aerith Gainsborough) - fires off any life gain (lifelink combat
   * damage or a gainLife effect), for as long as this permanent stays on the
   * battlefield. See engine/combat.ts: applyGainLifeTriggers. Manual life
   * changes under Mutual Adjustment deliberately don't trigger this.
   * `subtypeFilter`, when set (e.g. Minwu, White Mage's "each Cleric you
   * control"), puts the counter on every controlled creature matching that
   * subtype instead of just this permanent itself. */
  onGainLifeTrigger?: { counterLabel: string; counterAmount: number; subtypeFilter?: string };
  /** "Whenever you gain life, put a +1/+1 counter on target creature you
   * control. If you have a full party, put three +1/+1 counters on that
   * creature instead." (The Destined White Mage) - the TARGETED cousin of
   * onGainLifeTrigger above (which has no targeting at all - always the
   * watcher itself, or every creature matching subtypeFilter). Arms a
   * putCounterOnTarget pendingTarget (restrictToOwnCreature: true) with the
   * counter amount already resolved via hasFullParty at the moment life is
   * gained. See engine/combat.ts: applyGainLifeTriggers. */
  onGainLifeTriggerTargeted?: { counterLabel: string; counterAmount: number; fullPartyCounterAmount: number };
  /** "Whenever you draw a card, put N counters of this label on THIS
   * permanent" (Chasm Skulker) - same shape as onGainLifeTrigger, but there's
   * no single choke point for drawing a card the way addLife is for gaining
   * life (dozens of effects/actions inline their own library.slice/hand
   * push), so this is only checked from the two most central draw paths:
   * the normal per-turn draw (engine/actions.ts: drawCard) and the generic
   * DrawCardsEffect (engine/effects.ts) - not every one of this engine's
   * many other specific "draw" effects (loot, reveal-then-draw, etc.). See
   * engine/combat.ts: applyDrawTriggers. */
  onDrawTrigger?: { counterLabel: string; counterAmount: number };
  /** "Scions' Secretary — Whenever an opponent draws a card, if it isn't
   * that player's turn, create a tapped [tokenId] token. This ability
   * triggers only once each turn." (Tataru Taru) - checked in
   * engine/combat.ts: applyDrawTriggers, the SAME place onDrawTrigger
   * above is checked, so it shares its known limitation: only the primary
   * DRAW_CARD action and the generic DrawCardsEffect ('drawCards') route
   * through applyDrawTriggers - a loot effect, library search, or any
   * other hand-splicing draw doesn't call it at all. Gated once per turn
   * via CardInstance.scionsSecretaryTriggeredThisTurn. */
  onOpponentDrawsOffTurnCreateTappedTokenOncePerTurn?: { tokenId: string };
  /** "Whenever an opponent casts a spell, put N counters of this label on
   * THIS permanent[, and you gain M life]" (Sunscorch Regent) - checked once
   * per completed CAST_CARD (any spell type - lands don't reach this check,
   * see engine/actions.ts: castCard), against the CASTER's opponent's
   * battlefield. See engine/effects.ts: triggerOpponentCastSpellWatchers. */
  onOpponentCastsSpell?: { counterLabel: string; counterAmount: number; alsoGainLife?: number };
  /** "Whenever an opponent casts their second spell each turn, [effect]."
   * (Minwu, Rebellion Strategist) - unlike onOpponentCastsSpell above (a
   * fixed counter/life shape, fires on every opponent cast), this is a
   * generic CardEffect list gated to only the opponent's SECOND spell cast
   * each turn, checked against the caster's own PlayerState.spellsCastThisTurn
   * (already incremented by the time this runs). See engine/effects.ts:
   * triggerOpponentCastSpellWatchers. */
  onOpponentCastsSecondSpellEachTurnTrigger?: CardEffect[];
  /** "Whenever an opponent casts a spell, you may draw a card unless that
   * player pays [cost]." (Stay with Me) - unlike onOpponentCastsSpell
   * above (fires unconditionally, counter/life only), the CASTER gets an
   * actual yes/no choice right after their cast resolves: pay the generic
   * mana cost, or let this permanent's controller draw. See
   * GameState.pendingRhysticDrawPayment and engine/actions.ts:
   * resolveRhysticDrawPayment. Only ever arms for the FIRST such permanent
   * found on the controller's battlefield per cast (a narrow, documented
   * simplification - two of these simultaneously is an unhandled edge
   * case no current deck can actually produce). */
  onOpponentCastsSpellMayDrawUnlessTheyPay?: { cost: number };
  /** "Whenever you scry or surveil, draw a card" (Matoya, Archon Elder) -
   * this engine only has surveil (no separate scry mechanic), so this fires
   * once per RESOLVE_SURVEIL that resolves for this permanent's controller,
   * for as long as it stays on the battlefield. See engine/actions.ts:
   * resolveSurveil. */
  onOwnSurveilDraw?: boolean;
  /** "When this creature dies, put X counters of this label on each
   * [targetFilter] creature you control, where X is the number of counters
   * of this label THIS creature had" (e.g. Aerith Gainsborough) - read at
   * the moment of death, before it leaves the battlefield. See
   * engine/combat.ts: moveCreaturesToGraveyard. Only 'legendary' (subtype
   * text contains "Legendary Creature") is implemented as a target filter. */
  onDeathDistributeCounters?: { counterLabel: string; targetFilter: 'legendary' };
  /** "Whenever another permanent you control is put into a graveyard from
   * the battlefield, if it had one or more counters on it, you may put that
   * number of +1/+1 counters on target creature" (Yuna, Grand Summoner) -
   * unlike onDeathDistributeCounters above (an automatic, untargeted payout
   * read from the dying creature's OWN counters), this needs a target
   * choice, so it can't just apply itself inline the way that one does -
   * see GameState.pendingCounterTransferQueue, engine/combat.ts:
   * moveCreaturesToGraveyard (where entries are queued) and
   * engine/actions.ts: resolveCounterTransfer (where they're resolved).
   * Applies to ANY permanent leaving via the graveyard, not creatures only -
   * "another permanent," not "another creature." */
  onOtherPermanentDeathTransferCounters?: boolean;
  /** "When this creature dies, create X 1/1 [tokenId] creature tokens, where
   * X is the number of [counterLabel] counters on this creature" (Chasm
   * Skulker) - X is read from the dying creature's OWN counters, captured
   * before it left the battlefield, same timing as onDeathDistributeCounters
   * above but creating tokens instead of distributing counters elsewhere. */
  onDeathCreateTokensEqualToOwnCounters?: { counterLabel: string; tokenId: string };
  /** Static ability: every OTHER permanent this card's controller controls
   * gains this as its own producesMana, as long as it doesn't already have
   * one of its own (e.g. A Realm Reborn's "Other permanents you control have
   * Tap: Add one mana of any color"). See engine/mana.ts: effectiveProducesMana. */
  grantsManaAbilityToOthers?: ManaColor | 'any' | ManaColor[];
  /** "...cast a permanent spell of each permanent type from your
   * graveyard" (Orphan, Cocoon fal'Cie) - grants a blanket permission to
   * cast ANY creature/artifact/enchantment card in the controller's OWN
   * graveyard (not a specific instanceId, unlike GameState.graveyardPlayGrants),
   * limited to once per permanent TYPE each turn via
   * PlayerState.graveyardCastTypesUsedThisTurn. Paid at the card's normal
   * printed cost. See engine/actions.ts: castFromGraveyard. The "play a
   * land" half is deferred - see that PlayerState field's own doc comment. */
  grantsCastPermanentFromOwnGraveyardOncePerTypeEachTurn?: boolean;
  /** "Lands you control have '{T}: Add one mana of any color.'" (Chromatic
   * Lantern) - unlike grantsManaAbilityToOthers above (fills in only for a
   * permanent with no ability of its own), this overrides EVERY controlled
   * land's effective producesMana to 'any', regardless of what it already
   * printed. See engine/actions.ts: effectiveProducesMana. */
  landsYouControlProduceAnyColor?: boolean;
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
  /** "Whenever one or more other creatures die, draw a card. This ability
   * triggers only once each turn." (Morbid Opportunist) - the ANY-board
   * cousin of onAnyDeathDraw just above: counts creature deaths on EITHER
   * side (not just ones this permanent's controller controls), excluding
   * the watcher itself. Same once-per-turn gate shape, via its own
   * CardInstance flag (onAnyCreatureDeathAnywhereDrawUsedThisTurn). See
   * engine/combat.ts: moveCreaturesToGraveyard. */
  onAnyCreatureDeathAnywhereDraw?: boolean;
  /** "Whenever another creature dies, ... [this] deals 1 damage to each
   * opponent." (Golbez, Clad in Darkness) - the damage-dealing cousin of
   * onAnyCreatureDeathAnywhereDraw just above: same "any board, excluding
   * the watcher itself" shape, but with NO once-per-turn limiter (the
   * printed text has none) and fires once PER qualifying death rather than
   * once per batch, so simultaneous deaths deal cumulative damage. Only
   * the first of Golbez's three OR'd trigger conditions ("another creature
   * dies") is implemented - "a creature card is put into a graveyard from
   * anywhere other than the battlefield" and "a creature card leaves your
   * graveyard" have no central watcher to hook into and are deferred, same
   * "implement the reachable majority" convention as Fatal Push's Revolt.
   * See engine/combat.ts: moveCreaturesToGraveyard. */
  onAnyCreatureDeathAnywhereDamageEachOpponent?: number;
  /** "Whenever another creature or artifact you control dies, put a
   * [counterLabel] counter on [this]" (Judge Magister Gabranth) - same
   * watcher shape as onAnyDeathDrain, just puts a counter on the watcher
   * itself instead of changing life totals. */
  onAnyDeathCounterSelf?: { counterLabel: string; counterAmount: number };
  /** "Whenever a creature you control without flying dies, return it to the
   * battlefield under its owner's control with a flying counter on it."
   * (Luminous Broodmoth) - a boolean switch (the whole effect is fixed, no
   * parameters), checked in engine/combat.ts: moveCreaturesToGraveyard, same
   * watcher-loop shape as onAnyDeathDrain et al. A 'Flying' counter is a
   * new universal, hardcoded-by-name label - see engine/keywords.ts:
   * hasKeywordEffective. */
  onAnyControlledCreatureWithoutFlyingDeathReturnWithFlyingCounter?: boolean;
  /** "Whenever a creature an opponent controls dies, put a number of
   * [counterLabel] counters on [this] equal to that creature's power"
   * (Vincent Valentine) - the mirror image of onAnyDeathDrain/onAnyDeathDraw/
   * onAnyDeathCounterSelf (all of which watch the CONTROLLER's own board):
   * this watches the OPPONENT's creatures dying instead. Checked in
   * engine/combat.ts: moveCreaturesToGraveyard against the dying creature's
   * pre-removal power (same "approximate at time of death" reasoning as
   * onAnyDeathDrawEqualToPowerIfSubtype). */
  onAnyOpponentCreatureDeathPutCounterEqualToPower?: { counterLabel: string };
  /** "Whenever a [Subtype] you control dies during your turn, you draw
   * cards equal to its power" (Jenova, Ancient Calamity's Mutant clause) -
   * same watcher shape as onAnyDeathDrain, but filtered to creatures
   * carrying the given subtype (checked via CardInstance.grantedSubtypes/
   * engine/combat.ts: hasGrantedSubtype, so it also matches a genuinely
   * PRINTED subtype, not just a granted one) and gated to the watcher's
   * controller's own turn, scaling the draw by the dying creature's power
   * (read from its last known stats, right before removal) rather than a
   * fixed amount. */
  onAnyDeathDrawEqualToPowerIfSubtype?: { subtype: string; duringOwnTurnOnly?: boolean };
  /** "Whenever a creature you control deals combat damage to a player, ..."
   * (Ultimecia, Temporal Threat) - a board-wide watcher (any of the
   * controller's creatures, not just this one), unlike
   * CardDefinition.onCombatDamageToPlayer (self only). Fires once per
   * unblocked attacker the controller has, for every permanent they control
   * carrying this field. See engine/actions.ts: applyCombatDamageToPlayerTriggers. */
  onAnyControlledCreatureCombatDamageToPlayer?: CardEffect[];
  /** "Whenever a creature you control with [keyword] deals combat damage
   * to a player, that player gets N poison counters." (Fynn, the
   * Fangbearer) - a board-wide watcher like onAnyControlledCreatureCombatDamageToPlayer
   * above, but filtered to attackers with the given keyword and applying
   * poison directly rather than resolving a generic CardEffect list (no
   * current CardEffect targets "the just-damaged player" this way). See
   * engine/actions.ts: applyCombatDamageToPlayerTriggers. */
  onAnyControlledCreatureWithKeywordCombatDamageGivesPoison?: { keyword: string; amount: number };
  /** "Whenever one or more creatures you control deal combat damage to a
   * player, [effect]." (Vincent, Vengeful Atoner) - unlike
   * onAnyControlledCreatureCombatDamageToPlayer above, which fires once PER
   * unblocked attacker, this fires at most ONCE per combat regardless of
   * how many of the controller's creatures connected, matching the printed
   * "one or more" batching (so a simultaneous multi-attacker alpha strike
   * doesn't put multiple counters on in a single combat). Computed in a
   * separate pass after the main per-attacker loop. See engine/actions.ts:
   * applyCombatDamageToPlayerTriggers. */
  onAnyControlledCreatureOneOrMoreCombatDamageToPlayer?: CardEffect[];
  /** "Whenever a creature you control deals combat damage to a player, put a
   * [counterLabel] counter on THAT CREATURE" (Sphere Grid) - unlike
   * onAnyControlledCreatureCombatDamageToPlayer above (whose CardEffect list
   * is resolved with the WATCHER as sourceInstanceId, so a generic effect
   * list can't target "the creature that just dealt damage"), this applies
   * the counter directly to the attacker itself. A dedicated field rather
   * than a new generic CardEffect, since nothing else needs this shape yet.
   * See engine/actions.ts: applyCombatDamageToPlayerTriggers. */
  onAnyControlledCreatureCombatDamageToPlayerPutCounterOnThatCreature?: { counterLabel: string; counterAmount: number };
  /** "Whenever one or more creatures you control with counters on them deal
   * combat damage to a player, [effect]. Do this only once each turn." (Tidus,
   * Yuna's Guardian's Cheer) - narrower than
   * onAnyControlledCreatureCombatDamageToPlayer above (only fires for an
   * unblocked attacker that itself HAS a counter) and gated to once per turn
   * via CardInstance.cheerTriggeredThisTurn on the watcher, cleared at
   * cleanup like every other "once each turn" flag in this engine. See
   * engine/actions.ts: applyCombatDamageToPlayerTriggers. */
  onAnyControlledCreatureWithCountersCombatDamageToPlayer?: CardEffect[];
  /** "Whenever one or more creatures you control with power [minPower] or
   * greater deal combat damage to a player, [effect]. ... only once each
   * turn" (Tifa, Martial Artist) - the power-gated sibling of
   * onAnyControlledCreatureWithCountersCombatDamageToPlayer above, same
   * once-per-turn-via-CardInstance-flag shape
   * (powerThresholdCombatDamageTriggeredThisTurn). Checked against
   * effectivePower at the moment combat damage is about to be dealt. See
   * engine/actions.ts: applyCombatDamageToPlayerTriggers. */
  onAnyControlledCreatureWithPowerAtLeastCombatDamageToPlayer?: { minPower: number; effects: CardEffect[] };
  /** "Whenever a creature you control with a +1/+1 counter on it deals
   * combat damage to a player, [effect]." (Bred for the Hunt) - unlike
   * onAnyControlledCreatureWithCountersCombatDamageToPlayer just above
   * (Tidus's Cheer), this has NO "do this only once each turn" clause in
   * its printed text, so it fires once per qualifying unblocked attacker
   * with no CardInstance-level once-per-turn gate at all. Named singular
   * "Counter" (vs. the sibling field's plural "Counters") specifically to
   * keep the two visually distinct given how similar they otherwise read.
   * See engine/actions.ts: applyCombatDamageToPlayerTriggers. */
  onAnyControlledCreatureWithCounterCombatDamageToPlayer?: CardEffect[];
  /** "Whenever [this] deals combat damage to a player, you may exile it,
   * then return it to the battlefield transformed" (Jecht, Reluctant
   * Guardian) - an optional reactive trigger, unlike every other automatic
   * trigger here, so it pauses on GameState.pendingOptionalTransform for a
   * yes/no choice (RESOLVE_OPTIONAL_TRANSFORM) instead of just firing. */
  onCombatDamageToPlayerMayTransform?: boolean;
  /** "Whenever [this] attacks, you may transform it" (Vincent Valentine) -
   * the attack-declaration-timed counterpart to
   * onCombatDamageToPlayerMayTransform, same pendingOptionalTransform flow
   * either way. See engine/actions.ts: declareAttackers. */
  onAttackMayTransform?: boolean;
  /** "Whenever [this] deals combat damage to a player, ..." (Squall, SeeD
   * Mercenary) - a generic AUTOMATIC trigger, unlike
   * onCombatDamageToPlayerMayTransform's hardcoded yes/no pending choice.
   * See engine/actions.ts: applyCombatDamageToPlayerTriggers for the
   * "unblocked" approximation this relies on. */
  onCombatDamageToPlayer?: CardEffect[];
  /** "Whenever [this] deals combat damage to a player, create a Treasure
   * token and exile the top card of that player's library. Until end of
   * turn, you may cast that card." (Zidane Tribal) - a dedicated hardcoded
   * trigger (not a generic CardEffect list) since it needs to know WHICH
   * player was damaged (the resolveCardEffects context has no player-target
   * slot to carry that), resolved directly in
   * engine/actions.ts: applyCombatDamageToPlayerTriggers. The exiled card's
   * play permission is a plain ExilePlayGrant with expiresAtCleanup (same
   * "this turn" convention used everywhere else in this engine), granted to
   * the ATTACKER's controller even though the card came from the
   * DEFENDER's library. */
  onCombatDamageToPlayerCreateTreasureAndExileTopOfTheirLibraryPlayableUntilEndOfTurn?: boolean;
  /** "Whenever equipped creature deals combat damage to a player, exile the
   * top card of that player's library. If it's a permanent card, you may
   * put it onto the battlefield under your control. If you don't, create a
   * 1/1 blue Fish creature token." (Fishing Gear) - a dedicated hardcoded
   * trigger (same reasoning as onCombatDamageToPlayerCreateTreasure...
   * above - needs to know WHICH player was damaged), resolved directly in
   * engine/actions.ts: applyCombatDamageToPlayerTriggers alongside the
   * existing equipGrantsOnCombatDamageToPlayer loop. */
  equipGrantsExileTopOfDefenderLibraryMayPlayOrCreateFish?: boolean;
  /** "Whenever one or more creatures attack one of your opponents, if any
   * of those creatures have power or toughness equal to the chosen number,
   * [this] deals damage equal to its power to defending player." (Squall,
   * Gunblade Duelist) - "one of your opponents" is simply the opponent in
   * this 2-player engine, so this is checked against the attacking
   * player's own just-declared instanceIds. Reads CardInstance.chosenNumber
   * off this permanent's own instance. See engine/actions.ts:
   * finalizeDeclareAttackers. */
  onAnyAttackMatchesChosenNumberDealsSourcePowerToDefender?: boolean;
  /** "Whenever you attack a player, goad target creature that player
   * controls." (Seifer, Balamb Rival) - fires once per attack declaration
   * (not once per attacking creature), arming a GoadTargetCreatureEffect
   * pendingTarget. See engine/actions.ts: finalizeDeclareAttackers. */
  onOwnAttackGoadTargetOpponentCreature?: boolean;
  /** "Whenever a creature attacking one of your opponents becomes blocked
   * by two or more creatures, that attacking creature gains deathtouch
   * until end of turn." (Seifer, Balamb Rival) - checked once per attacker
   * right after blockers are declared. See engine/actions.ts: declareBlockers. */
  grantsDeathtouchToOwnAttackerBlockedByTwoOrMore?: boolean;
  /** "Whenever a creature you control enters during combat, you may attach
   * target Equipment you control to target creature you control." (Noctis,
   * Heir Apparent) - the "during combat" half of the gate is checked
   * against the current phase at the moment of entry (same combat-phase
   * list as CardAbility.onlyDuringCombat), the "attach target Equipment...
   * to target creature" half resolved as a two-step pendingTarget chain
   * (reusing the same shape as AttachTargetControlledEquipmentToTargetRebelEffect,
   * just with a creature-you-control destination instead of a Rebel).
   * See engine/effects.ts: triggerCreatureEnterWatchers. */
  onAnyControlledCreatureEntersDuringCombatMayAttachControlledEquipment?: boolean;
  /** "This land enters tapped unless you control a legendary creature."
   * (Chocobo Camp) - same conditional-entersTapped shape as
   * entersTappedUnlessControlLandNames/entersTappedUnlessControlBasicLandCount,
   * just gated on controlling ANY legendary creature instead of a land count. */
  entersTappedUnlessControlLegendaryCreature?: boolean;
  /** "Whenever a creature you control but don't own dies, return it to the
   * battlefield under its owner's control and you draw a card." (Edea,
   * Possessed Sorceress) - a dedicated death-pipeline redirect tier (same
   * priority-tier convention as onDeathReturnToBattlefieldTapped et al.,
   * see engine/combat.ts: moveCreaturesToGraveyard), checked against the
   * CONTROLLER's (not the dying card's own) battlefield for this field.
   * Approximates "you draw a card" as the controller (Edea's side) drawing,
   * matching the printed "you" unambiguously here (only one player could
   * ever be controlling-but-not-owning in a 1v1 game). */
  onAnyControlledButNotOwnedCreatureDiesReturnToOwnerAndDraw?: boolean;
  /** "Cleric, Rogue, Warrior, and Wizard spells you cast cost {1} less to
   * cast." (The Destined Warrior) - an unconditional, always-on cost
   * reduction for any of these four class subtypes, unlike
   * reducesCastCostForSecondSpellEachTurn's own once-per-turn gate. Checked
   * in engine/actions.ts: castCard against the CAST card's own subtype. */
  reducesCastCostForSubtypes?: string[];
  /** "Creatures you control have training. (Whenever a creature you
   * control attacks with another creature with greater power, put a
   * +1/+1 counter on the creature with lesser power.)" (Warrior's
   * Resolve) - simplified to AT MOST ONE counter per qualifying attacker
   * per combat (if it has at least one co-attacker with strictly greater
   * power), rather than once per qualifying co-attacker - same
   * "superlative comparison collapses to a single check" simplification
   * used elsewhere in this engine, since real Training could in principle
   * trigger multiple times per combat. Checked in engine/actions.ts:
   * finalizeDeclareAttackers. */
  grantsControlledCreaturesTraining?: boolean;
  /** "At the beginning of your end step, if you control a creature with a
   * +1/+1 counter on it that attacked this turn, draw a card." (Warrior's
   * Resolve) - checked in engine/actions.ts's end-step trigger processing. */
  onOwnEndStepDrawIfAttackedCreatureHasCounter?: boolean;
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
  /** "Whenever one or more opponents lose life, you may cast target instant
   * or sorcery card from your graveyard... Spells you cast from your
   * graveyard cost [discount] less to cast. If that spell would be put
   * into your graveyard, exile it instead. Do this only once each turn."
   * (Emet-Selch of the Third Seat) - unlike onOpponentLifeLossDuringYourTurn
   * above, this has NO "during your turn" restriction. Reuses
   * CastTargetInstantOrSorceryFromGraveyardAnyManaEffect's whole pending-
   * choice/exile-instead-of-graveyard machinery (see
   * GameState.pendingCastFromGraveyardAnyMana), just armed directly from
   * engine/combat.ts: loseLife instead of a cast/enter trigger, restricted
   * to the controller's OWN graveyard, and discounted. Gated once per turn
   * via CardInstance.onOpponentLoseLifeMayCastFromGraveyardTriggeredThisTurn.
   * The printed "Spells you cast from your graveyard cost [discount] less"
   * is a static ability in real Magic that would apply to ANY graveyard
   * cast, but the only graveyard-casting permission this card's controller
   * has in practice is this same granted ability, so scoping the discount
   * to just this one cast covers every case that's actually reachable. */
  onOpponentLoseLifeMayCastFromGraveyardOncePerTurn?: { discount: number };
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
  /** "When [this] dies, return it to the battlefield tapped (front face
   * up)" (Galian Beast, a transform back face) - a replacement effect, same
   * priority tier as onDeathExileAndCreateTokens: redirects away from the
   * graveyard entirely, reverting to its front face (frontFaceDefId) same
   * as any other permanent leaving the battlefield transformed. Since this
   * is a genuinely NEW object re-entering, it gets a fresh summoning-sick
   * check against the FRONT face's own haste (not this back face's). See
   * engine/combat.ts: moveCreaturesToGraveyard. */
  onDeathReturnToBattlefieldTapped?: boolean;
  /** "Undying (When this creature dies, if it had no +1/+1 counters on it,
   * return it to the battlefield under its owner's control with a +1/+1
   * counter on it.)" (Flayer of the Hatebound) - the CONDITIONAL cousin of
   * onDeathReturnToBattlefieldTapped above: same replacement-effect priority
   * tier, but only redirects away from the graveyard if the dying instance
   * had no +1/+1 counters already on it (checked against the dying
   * CardInstance, before this redirect would add one). Returns UNTAPPED
   * (unlike Galian Beast's own always-tapped return) with a fresh +1/+1
   * counter, and a fresh summoning-sickness check against its own haste,
   * same "genuinely new object" convention. See engine/combat.ts:
   * moveCreaturesToGraveyard. */
  hasUndying?: boolean;
  /** "Whenever this creature or another creature enters from your
   * graveyard, that creature deals damage equal to its power to any
   * target." (Flayer of the Hatebound) - unlike every other
   * graveyard-enters-the-battlefield trigger in this engine (which fire
   * through engine/effects.ts: triggerCreatureEnterWatchers from a normal
   * cast/reanimate action in engine/actions.ts), the creatures THIS card
   * cares about most often arrive via a death-REPLACEMENT effect
   * (hasUndying above, or onDeathReturnToBattlefieldTapped) that happens
   * inside engine/combat.ts: moveCreaturesToGraveyard, which can't call
   * resolveCardEffects directly (same circular-import wall
   * pendingEquipmentDeathEffects already works around). So this is queued
   * onto GameState.pendingCreatureEnteredFromGraveyardEffects instead,
   * drained by engine/effects.ts: resolveOnDeathTriggers right alongside
   * that queue - which runs after EVERY moveCreaturesToGraveyard call site,
   * combat or not. Checked against every creature the controller has with
   * this flag (not just the source), once per creature that returns this
   * way - "this creature or another creature" are symmetric, each
   * triggering independently. */
  dealsDamageEqualToPowerWhenCreatureEntersFromGraveyard?: boolean;
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
  /** "Choose one —" (Destroy Evil) rather than the default "Choose one or
   * more —" every other chooseModes card here uses (Clash of the Eikons,
   * Farewell, Collective Effort) - restricts the pick to EXACTLY one mode,
   * enforced in engine/actions.ts: castCard and rendered as radio buttons
   * (not checkboxes) by ModalSpellModal. Meaningless combined with
   * escalateCost (nothing currently does). */
  chooseExactlyOneMode?: boolean;
  /** "Choose two —" (Austere Command) - the exactly-N generalization of
   * chooseExactlyOneMode above (that one is hardcoded to exactly one, and
   * takes precedence if both were somehow set). Enforced the same way in
   * engine/actions.ts: castCard, rendered as checkboxes capped at N
   * simultaneous picks by ModalSpellModal (a radio group can't express
   * "exactly two"). */
  chooseExactlyNModes?: number;
  /** "Escalate — Tap an untapped creature you control." (Collective Effort) -
   * an ADDITIONAL cost paid once for each mode chosen beyond the first on a
   * chooseModes spell (picking a single mode is always free, same as any
   * other modal spell here). Only the "tap a creature" variant is modeled -
   * real Magic also has Escalate costs paid in mana, but no card in this
   * pool needs that yet. See GameAction 'CAST_CARD's
   * escalateCostInstanceIds, engine/actions.ts: castCard. */
  escalateCost?: 'tapCreature';
  /** See TieredMode. Mutually exclusive with onCast/chooseModes - the chosen
   * tier's effects are what resolve instead, after its additional cost is
   * paid alongside the card's own printed cost. */
  tieredModes?: TieredMode[];
  /** "Kicker - [cost]" (Chocobo Kick, Vayne's Treachery) - an OPTIONAL
   * additional cost paid alongside the card's own printed mana cost, as
   * part of the same cast. Unlike TieredMode (a menu of distinct additional
   * costs, exactly one required), Kicker is a single binary yes/no extra
   * cost; GameAction 'CAST_CARD's kickerPaymentInstanceId names the specific
   * permanent paid with (a land to return, or a creature/artifact to
   * sacrifice) - omitted entirely declines to kick. Whether the spell WAS
   * kicked is then threaded into engine/effects.ts: resolveCardEffects as
   * `wasKicked`, consumed by IfKickedEffect wherever onCast/onEnter needs to
   * branch on it. See engine/actions.ts: castCard.
   * 'mana' (Rite of Replication's "Kicker {5}") - the much more common real
   * form of Kicker, a plain additional MANA cost rather than a specific
   * permanent paid as an alternate cost; `manaCost` holds that cost string,
   * merged on top of the printed cost the same way Multikicker/TieredMode
   * are, and the player opts in via GameAction 'CAST_CARD's payManaKicker
   * instead of naming a permanent. */
  kicker?: { cost: 'returnLandToHand' | 'sacrificeCreatureOrArtifact' | 'mana'; manaCost?: string };
  /** "Convoke (Your creatures can help cast this spell. Each creature you tap
   * while casting this spell pays for {1} or one mana of that creature's
   * color.)" (Clever Concealment) - see GameAction 'CAST_CARD's
   * convokeInstanceIds, engine/actions.ts: castCard. A tapped creature's own
   * "color" is approximated the same way Arcane Signet's commander color
   * identity is - the colored symbols in its own printed costLabel, since
   * this engine has no separate color-identity field - and the engine
   * greedily assigns each tapped creature to a still-unpaid colored pip it
   * matches before falling back to generic, rather than asking the player to
   * choose (simpler action shape, same outcome in practice). */
  convoke?: boolean;
  /** "Nonartifact spells you cast have improvise. (Your artifacts can help
   * cast those spells. Each artifact you tap after you're done activating
   * mana abilities pays for {1}.)" (Inspiring Statuary) - unlike convoke
   * (a property of the SPELL being cast), this is a board-wide grant from
   * a permanent the controller controls, checked against every OTHER
   * nonartifact spell they cast. No color-matching (always generic only,
   * same as real Improvise) - see GameAction 'CAST_CARD's
   * improviseInstanceIds, engine/actions.ts: castCard. */
  grantsImproviseToNonartifactSpells?: boolean;
  /** "Multikicker [cost]" (Everflowing Chalice) - like Kicker, an OPTIONAL
   * additional mana cost paid alongside the card's own printed cost, but
   * payable ANY NUMBER of times rather than just once. GameAction
   * 'CAST_CARD's chosenMultikickerCount is how many times it was paid;
   * castCard merges `chosenMultikickerCount * parseCostLabel(multikickerCost)`
   * into the spell's total cost the same way TieredMode's additionalCost is
   * merged, just scaled instead of a flat one-time add. That same count is
   * also threaded into onEnter's resolveCardEffects as `chosenX` (there's no
   * real {X} in this card's cost to conflict with it), for
   * PutCounterOnSelfEffect's counterAmount: 'chosenX' to read. */
  multikickerCost?: string;
  /** "At the beginning of your upkeep, ..." as an AUTOMATIC trigger (unlike
   * CardAbility.onlyDuringOwnUpkeep, which just restricts an activated
   * ability's timing) - e.g. Dark Confidant. Fires once, right as the
   * controller's own upkeep begins. See engine/actions.ts: nextPhase. */
  onOwnUpkeep?: CardEffect[];
  /** "At the beginning of each of your postcombat main phases, [effect]."
   * (Cecil Harvey) - the main2-timed sibling of onOwnUpkeep above, fires
   * exactly once as the active player's second main phase begins. See
   * engine/actions.ts: nextPhase. */
  onOwnPostcombatMainPhase?: CardEffect[];
  /** "As long as this creature has a counter on it, it can attack as though
   * it didn't have defender" (Demon Wall) - checked alongside the normal
   * defender keyword wherever attack-legality is decided. */
  ignoresDefenderIfHasCounter?: boolean;
  /** "This spell costs 1 less to cast for each permanent card in your
   * graveyard" (Diamond Weapon) - reduces the GENERIC portion of the cost
   * (never below 0), applied in engine/actions.ts: castCard, before
   * checking affordability. */
  costReductionPerGraveyardPermanent?: number;
  /** "This spell costs {1} less to cast for each creature card in your
   * graveyard." (Cyan, Vengeful Samurai) - the CREATURE-only cousin of
   * costReductionPerGraveyardPermanent above (which also counts artifacts/
   * enchantments/lands). See engine/mana.ts: dynamicCostReduction. */
  costReductionPerGraveyardCreature?: number;
  /** "Whenever one or more creature cards leave your graveyard, put a
   * [counterLabel] counter on [this]." (Cyan, Vengeful Samurai) - see
   * engine/actions.ts: checkGraveyardCreatureLeaveWatchers, a global
   * before/after diff run after every action (same shape as
   * GameState.battlefieldLeaveWatchers' own check), rather than a flag
   * threaded through every individual graveyard-removal call site. Fires
   * at most once per action regardless of how many cards left at once. */
  onAnyOwnCreatureCardLeaveGraveyardPutCounterOnSelf?: { counterLabel: string; counterAmount: number };
  /** "Affinity for [subtype]s" (Travel the Overworld's "Affinity for Towns")
   * - reduces the GENERIC portion of the cost by `amountPerUnit` for each
   * controlled permanent matching `subtype` (never below 0), same
   * cast-time-computed shape as costReductionPerGraveyardPermanent. */
  costReductionPerControlledSubtype?: { subtype: string; amountPerUnit: number };
  /** "Affinity for [type]s" (Valkyrie Aerial Unit's "Affinity for artifacts")
   * - the CardType-based counterpart to costReductionPerControlledSubtype,
   * for Affinity wordings that count by type rather than subtype. */
  costReductionPerControlledType?: { type: CardType; amountPerUnit: number };
  /** "This spell costs {1} less to cast for each creature on the
   * battlefield" (Vanquish the Horde) - unlike costReductionPerControlledType
   * above (the caster's own board only), this counts creatures on BOTH
   * battlefields, so engine/mana.ts: dynamicCostReduction adds the
   * opponent's creature count too (only when `opponent` is actually
   * passed in - same optional-opponent convention as
   * costReductionIfOpponentGraveyardAtLeast). */
  costReductionPerCreatureOnBattlefield?: number;
  /** "This spell costs [amount] less to cast if an opponent has [minCount]
   * or more cards in their graveyard" (Into the Story) - a threshold
   * discount (either the full amount or nothing), unlike the per-unit
   * scaling fields above. Checked against an OPPONENT's graveyard, so
   * engine/mana.ts: dynamicCostReduction/effectiveCastCost both take an
   * optional `opponent` parameter for this one field alone. */
  costReductionIfOpponentGraveyardAtLeast?: { minCount: number; amount: number };
  /** "[Color] spells you cast cost {N} less to cast" (The Water Crystal's
   * blue, The Wind Crystal's white) - unlike every other cost-reduction
   * field above (which reduce THIS card's OWN cost, checked only while
   * casting itself), this is a board-wide effect: the permanent carrying it
   * reduces the cost of OTHER spells its controller casts, whenever they
   * match `color`. "Matches" means the cast card's own mana cost contains
   * that color's pip - reduces only the GENERIC portion, same as every
   * other reduction here. See engine/mana.ts: dynamicCostReduction, which
   * now also scans the caster's battlefield for these. */
  reducesCastCostForColor?: { color: Exclude<ManaColor, 'C'>; amount: number };
  /** "Noncreature spells you cast cost [N] less to cast" (Lyse Hext) - the
   * type-keyed cousin of reducesCastCostForColor just above: same board-wide
   * shape, but matched against the cast card's def.type !== 'creature'
   * instead of a mana color pip. See engine/mana.ts: dynamicCostReduction. */
  reducesCastCostForNoncreatureSpells?: number;
  /** "Aura and Equipment spells you cast cost {1} less to cast." (Squall
   * Leonhart) - the subtype-matched cousin of reducesCastCostForNoncreatureSpells
   * just above: same board-wide shape, but matched against the cast card's
   * own subtype containing "Aura" or "Equipment" instead of its type. See
   * engine/mana.ts: dynamicCostReduction. */
  reducesCastCostForAuraOrEquipmentSpells?: number;
  /** "The first legendary creature spell you cast each turn costs [N] less
   * to cast" (Serah Farron, Crystallized Serah) - board-wide, like
   * reducesCastCostForColor, but filtered to legendary creature spells and
   * limited to once per turn. See PlayerState.usedFirstLegendaryCreatureSpellDiscountThisTurn,
   * engine/mana.ts: dynamicCostReduction, engine/actions.ts: castCard (sets
   * the used-this-turn flag once a legendary creature spell is actually cast). */
  reducesCastCostForFirstLegendaryCreatureSpellEachTurn?: number;
  /** "Dualcast — The second spell you cast each turn costs {2} less to
   * cast." (Alisaie Leveilleur) - board-wide, like reducesCastCostForColor,
   * but checked against PlayerState.spellsCastThisTurn === 1 (exactly one
   * prior spell already cast this turn, so the one being costed now would
   * be the second) instead of a used-this-turn boolean flag, since here
   * ONLY the second cast qualifies, not every cast after the first. */
  reducesCastCostForSecondSpellEachTurn?: number;
  /** "Creature spells you cast of the chosen type cost {1} less to cast."
   * (Herald's Horn) - reads CardInstance.chosenCreatureType off THIS
   * permanent's own instance (set by a prior ChooseCreatureTypeEffect),
   * checked against the CAST card's own subtype. Checked in
   * engine/actions.ts: castCard. */
  reducesCastCostForOwnChosenCreatureType?: boolean;
  /** "At the beginning of your upkeep, look at the top card of your
   * library. If it's a creature card of the chosen type, you may reveal it
   * and put it into your hand." (Herald's Horn) - reads this permanent's
   * own CardInstance.chosenCreatureType, resolved directly in
   * engine/actions.ts's upkeep-trigger processing (not a generic
   * RevealFilteredEffect, since the filter subtype is chosen per-instance
   * rather than fixed at authoring time). */
  onOwnUpkeepLookTopForChosenCreatureTypeToHand?: boolean;
  /** "Eukrasia — Whenever you cast your second spell each turn, draw a
   * card." (Alphinaud Leveilleur) - the draw-trigger cousin of
   * reducesCastCostForSecondSpellEachTurn above, same PlayerState.
   * spellsCastThisTurn tracking (checked right where it increments, in
   * engine/actions.ts: castCard) and same "only under real mana, not
   * Mutual Adjustment" limitation that field already has (spellsCastThisTurn
   * is never incremented at all while mutual is active). */
  drawCardOnSecondSpellEachTurn?: boolean;
  /** "Magecraft — Whenever you cast or copy an instant or sorcery spell,
   * draw a card." (Archmage Emeritus) - narrower than the
   * NoncreatureCastTrigger family (which fires for ANY noncreature spell,
   * including artifacts/enchantments), so it's checked directly in
   * engine/actions.ts: castCard rather than through
   * triggerNoncreatureCastAbilities. The "or copy" half is deferred - this
   * engine has no spell-copy mechanism at all, so only the "cast" half is
   * reachable. */
  onCastOrCopyInstantOrSorceryDrawCard?: boolean;
  /** "The first activated ability you activate during your turn that
   * targets a creature you control costs [N] less to activate" (Professor
   * Hojo) - board-wide, like reducesCastCostForColor, but scoped to
   * ACTIVATED ABILITIES (see CardAbility.targetsOwnCreature's own doc
   * comment for why that's a static marker) instead of spells, and applied
   * directly in engine/actions.ts: activateAbility rather than
   * engine/mana.ts: dynamicCostReduction (which only ever costs spells).
   * See PlayerState.usedFirstOwnCreatureTargetingAbilityDiscountThisTurn. */
  reducesActivatedAbilityCostForFirstOwnCreatureTargetingEachTurn?: number;
  /** "Whenever one or more creatures you control become the target of an
   * activated ability, [effect]. Do this only once each turn." (Professor
   * Hojo's "...draw a card") - checked in engine/actions.ts: chooseTarget
   * (not resolveCardEffects's usual per-effect-type branches, since ANY of
   * them could be the activated ability in question here) right after a
   * CHOOSE_TARGET resolves one armed via GameState.pendingTarget.
   * fromActivatedAbility, gated once per turn via CardInstance.
   * targetedByActivatedAbilityDrawTriggeredThisTurn. */
  onOwnControlledCreatureTargetedByActivatedAbility?: CardEffect[];
  /** "[Subtype]s you control get +X/+Y[, and have KEYWORD, KEYWORD]"
   * (Balthier and Fran's "Vehicles you control get +1/+1 and have
   * vigilance and reach", Ardyn, the Usurper's "Demons you control have
   * menace, lifelink, and haste", The Fire Crystal's unqualified "Creatures
   * you control have haste" - power/toughness 0/0 on the keywords-only
   * cards) - a STATIC anthem applied to every permanent the SAME controller
   * controls whose own subtype matches (not just this source), unlike
   * controlledTypeCountBuff (buffs only the source itself) or
   * landCountBuff. `subtype: '*'` is a sentinel meaning "every creature,
   * no subtype restriction" (The Fire Crystal has no narrower subtype to
   * check against). See engine/combat.ts: effectivePower/effectiveToughness/
   * anthemBuffBonus for power/toughness, hasBoardGrantedKeyword for
   * grantKeywords. A granted `haste` only actually bypasses summoning
   * sickness for a creature that entered WHILE the anthem source was
   * already out (checked once at entry, in engine/actions.ts: castCard/
   * castFromGraveyard) - it can't retroactively un-stick a creature that
   * was already summoning-sick before the anthem existed, since nothing
   * rechecks it dynamically after that point. */
  staticAnthemForControlledSubtype?: { subtype: string; power: number; toughness: number; grantKeywords?: string[] };
  /** "Legendary creatures you control get +X/+X, where X is the number of
   * legendary creatures you control." (Warrior of Light) - the dynamic-X
   * cousin of staticAnthemForControlledSubtype just above: same "applies to
   * every controlled creature whose own subtype matches" shape, but the
   * bonus itself is a LIVE count of controlled permanents matching that
   * same subtype string, re-evaluated wherever power/toughness is checked
   * (not a fixed number). The granting permanent counts toward its own X
   * if it also matches `subtype` (Warrior of Light is itself Legendary).
   * See engine/combat.ts: anthemBuffBonus. */
  staticAnthemForControlledSubtypeEqualToOwnCount?: { subtype: string };
  /** "Creature tokens you control get +X/+Y." (Hildibrand Manderville) - the
   * isToken-filtered cousin of staticAnthemForControlledSubtype just above
   * (matched against CardInstance.isToken instead of a subtype string).
   * See engine/combat.ts: anthemBuffBonus for power/toughness,
   * hasBoardGrantedKeyword for grantKeywords. Deliberately only this evergreen
   * anthem clause is implemented for Hildibrand right now - its "dies, may
   * cast as an Adventure" trigger and the Gentleman's Rise Adventure half are
   * deferred until this engine's Adventure-card support is built. */
  staticAnthemForControlledTokens?: { power: number; toughness: number; grantKeywords?: string[] };
  /** "Creatures you control but don't own get +2/+2 and can't be
   * sacrificed." (Garland, Royal Kidnapper) - only the stat half; checked
   * in engine/combat.ts: anthemBuffBonus against the INSTANCE's own
   * ownerId vs. whoever currently controls it. The "can't be sacrificed"
   * half is deferred - matchesSacrificeFilter (engine/effects.ts) and
   * every sacrifice-cost validator it's reused by (chooseSacrifice,
   * activateAbility's sacrificeSelf/sacrificeAnother/additionalCostSacrifice
   * branches) take just (def, instance, filter), with no controller/state
   * context to check ownership-vs-control against - wiring it through all
   * of them is a larger refactor than this one clause's edge case (a
   * stolen creature being sacrificed back) justifies right now. */
  staticAnthemForControlledButNotOwnedCreatures?: { power: number; toughness: number };
  /** "Artifact creatures and Heroes you control get +1/+1 for each
   * Artificer you control and each Artificer card in your graveyard."
   * (Cid, Timeless Artificer) - a dedicated anthem field since the buffed
   * filter (artifact creature or Hero) differs from the counted subtype
   * (Artificer), and the count spans both the battlefield and graveyard.
   * See engine/combat.ts: anthemBuffBonus. */
  dynamicAnthemForArtifactCreaturesAndHeroesPerArtificer?: boolean;
  /** "Creatures you control with a [counterLabel] counter on them have
   * [grantKeywords]" (Sphere Grid's Unlock Ability) - the counter-based
   * sibling of staticAnthemForControlledSubtype above: same always-on (not
   * turn-gated) keyword grant, just matched by counter label instead of
   * subtype. Power/toughness bonuses aren't supported here since no current
   * card needs them for this shape. See engine/combat.ts: hasBoardGrantedKeyword. */
  staticAnthemForCreaturesWithCounter?: { counterLabel: string; grantKeywords: string[] };
  /** "Other modified creatures you control have [grantKeywords]."
   * (Red XIII, Proud Warrior - "Equipment, Auras you control, and
   * counters are modifications.") - the isModifiedCreature cousin of
   * staticAnthemForCreaturesWithCounter above; excludes the GRANTING
   * permanent itself ("other"), matching engine/combat.ts: isModifiedCreature
   * (has a counter, or something attached) rather than a fixed counter
   * label. See engine/combat.ts: hasBoardGrantedKeyword. */
  staticAnthemForOtherModifiedCreatures?: { grantKeywords: string[] };
  /** "Commander creatures you control get +X/+Y and have [grantKeywords]."
   * (Bastion Protector) - the "is this creature your commander" cousin of
   * staticAnthemForControlledSubtype (same always-on grant shape, matched
   * via CardInstance.defId === PlayerState.commanderDefId instead of a
   * subtype string). See engine/combat.ts: anthemBuffBonus/
   * hasBoardGrantedKeyword. */
  staticAnthemForCommanderCreaturesYouControl?: { power: number; toughness: number; grantKeywords?: string[] };
  /** "Equipped creature... has 'Other commanders you control get +X/+Y and
   * have [grantKeywords].'" (Dancer's Chakrams) - unlike
   * staticAnthemForCommanderCreaturesYouControl (always on while the
   * granting card is anywhere on the battlefield), this only applies while
   * the granting Equipment is actually ATTACHED to something (checked via
   * CardInstance.attachedToInstanceId, same "attachment, not just
   * presence" gate as equipGrantsKeyword/equipGrantsSubtype), and excludes
   * the equipped creature itself ("other") even if that creature happens
   * to be the commander. See engine/combat.ts: anthemBuffBonus/
   * hasBoardGrantedKeyword. */
  equipGrantsAnthemForOtherCommandersYouControl?: { power: number; toughness: number; grantKeywords?: string[] };
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
  /** "At the beginning of EACH end step, ..." (Lord Jyscal Guado) - unlike
   * onOwnEndStep above (only the controller's own end step), this fires
   * every time ANY end step happens, whoever's turn it is. See
   * engine/actions.ts: applyEndStepTriggers. */
  onAnyEndStep?: CardEffect[];
  /** "At the beginning of each end step, if a player lost [N] or more life
   * this turn, [effect]." (Y'shtola, Night's Blessed) - the conditional
   * cousin of onAnyEndStep above, gated on EITHER player's
   * PlayerState.lifeLostThisTurn, checked fresh every end step (not just
   * once per turn - this can fire on both end steps of the same turn if
   * the threshold is already met by the first one). See
   * engine/actions.ts: applyEndStepTriggers. */
  onAnyEndStepIfAnyPlayerLostLifeThisTurn?: { minLifeLost: number; effects: CardEffect[] };
  /** "At the beginning of each opponent's end step, ..." (Archfiend of
   * Depravity) - unlike onOwnEndStep (controller's own end step) or
   * onAnyEndStep (every end step), this fires only when it's one of the
   * CONTROLLER's opponents' end step - in this 2-player engine, exactly
   * whenever the active player (whoever's end step it is) is NOT this
   * permanent's controller. Effects resolve with the ACTIVE player (the
   * opponent being affected - "that player chooses...") as the playerId
   * context, not the permanent's controller. See engine/actions.ts:
   * applyEndStepTriggers. */
  onOpponentEndStep?: CardEffect[];
  /** "At the beginning of your first main phase, ..." as an AUTOMATIC
   * trigger (Sidequest: Raise a Chocobo) - same shape as onOwnUpkeep/
   * onOwnEndStep, just gated on the 'main1' phase instead. See
   * engine/actions.ts: nextPhase. */
  onOwnFirstMainPhase?: CardEffect[];
  /** "Enchanted/equipped permanent doesn't untap during its controller's
   * untap step" (Sleep Magic, Stuck in Summoner's Sanctum) - checked against
   * every permanent attached to this one. See engine/actions.ts: runUntapStep. */
  attachedPreventsUntap?: boolean;
  /** "...and its activated abilities can't be activated" (Stuck in
   * Summoner's Sanctum) - checked against every permanent attached to this
   * one. See engine/actions.ts: activateAbility. */
  attachedPreventsAbilities?: boolean;
  /** "Whenever a creature you control attacks alone, it gains [keyword]
   * until end of turn" (Seifer Almasy, Squall - SeeD Mercenary) - a
   * board-wide watcher (not self-only): whichever creature ends up being the
   * controller's sole declared attacker gets the keyword, regardless of
   * which permanent carries this trigger. See engine/actions.ts:
   * declareAttackers. */
  attacksAloneGrantsKeyword?: string;
  /** "Whenever you attack, creatures you control with counters on them gain
   * [keyword] until end of turn" (Chocobo Knights) - a board-wide watcher
   * like attacksAloneGrantsKeyword just above, but triggered by ANY nonzero
   * attack declaration (not just a solo attacker) and granted to every
   * creature the controller has with at least one counter (attacking or
   * not), not just the watcher itself. See engine/actions.ts:
   * declareAttackers. */
  grantsKeywordToOwnCreaturesWithCountersOnAttack?: string;
  /** "Light Party — Whenever you attack with [minCount] or more creatures,
   * [effects]." (Champions from Beyond) - checked against the number of
   * creatures actually declared as attackers this combat (instanceIds.length
   * in engine/actions.ts: finalizeDeclareAttackers), board-wide like
   * attacksAloneGrantsKeyword above. */
  onAttackWithAtLeastNCreatures?: { minCount: number; effects: CardEffect[] };
  /** "Whenever you attack with one or more [subtype], [effects]." (Hermes,
   * Overseer of Elpis's "...Birds, scry 2.") - the subtype-filtered cousin
   * of onAttackWithAtLeastNCreatures above: fires once if ANY declared
   * attacker's subtype matches (case-insensitive substring, same
   * convention as every other subtype check in this engine), regardless
   * of how many total attackers there were. */
  onAttackWithSubtype?: { subtype: string; effects: CardEffect[] };
  /** "Whenever your commander enters or attacks, [effects]." (Tome of
   * Legends) - fires from TWO call sites: engine/effects.ts:
   * triggerCreatureEnterWatchers (the "enters" half) and engine/actions.ts:
   * finalizeDeclareAttackers (the "attacks" half), both comparing the
   * entering/attacking creature's frontFaceDefId against the controller's
   * own PlayerState.commanderDefId - the same identity check
   * isPlayersCommander already uses elsewhere. */
  onCommanderEnterOrAttack?: CardEffect[];
  /** "Full Party — Whenever you attack with [minCount] or more creatures,
   * those creatures get +X/+Y until end of turn." (Champions from Beyond) -
   * applies to every DECLARED ATTACKER this combat (not a filtered subset),
   * same trigger point as onAttackWithAtLeastNCreatures above. */
  pumpAllAttackersIfAttackedWithAtLeastNCreatures?: { minCount: number; power: number; toughness: number };
  /** "Whenever you attack with one or more legendary creatures, you may
   * pay [manaCost]. If you do, return this card from your graveyard to the
   * battlefield tapped and attacking." (Interceptor, Shadow's Hound) -
   * unlike every sibling attack-trigger field above (checked against
   * battlefield permanents), this is checked against the controller's
   * GRAVEYARD instead, since the card doing the checking is dead when it
   * matters. See engine/actions.ts: finalizeDeclareAttackers, which scans
   * the graveyard for this field right alongside its battlefield-watcher
   * loops, arming a pendingOptionalPayMana (manaCost, effects: [{ type:
   * 'returnSelfFromGraveyardTappedAndAttacking' }]) when at least one
   * declared attacker is legendary. */
  onAttackWithLegendaryReturnSelfFromGraveyardTappedAndAttacking?: { manaCost: string };
  /** "Whenever this artifact becomes untapped, you may pay [manaCost]. If
   * you do, [effects]." (Key to the City) - checked in engine/actions.ts:
   * runUntapStep against every permanent that just transitioned from
   * tapped to untapped during the controller's own untap step (the only
   * "untap" path this is wired into - same scope limitation as other
   * single-call-site triggers elsewhere). Arms the existing
   * pendingOptionalPayMana (a single slot, not a queue - if more than one
   * such permanent untaps in the same step, only the first is offered). */
  onSelfUntapMayPayThenDraw?: { manaCost: string; effects: CardEffect[] };
  /** "When this permanent transforms into [this], ..." (Black Chocobo) -
   * checked against the BACK face's own definition, fired once right as the
   * transform completes (either a free FLIP_CARD or a paid transformSelf
   * ability). See engine/actions.ts: flipCard, activateAbility. */
  onTransformInto?: CardEffect[];
  /** "As long as you control N or more permanents of [type], this creature
   * gets +X/+Y" (Gaelicat's "two or more artifacts") - the same static,
   * always-on-condition-met buff shape as landCountBuff, generalized to any
   * CardType instead of being hardcoded to lands. See
   * engine/combat.ts: effectivePower/effectiveToughness. */
  controlledTypeCountBuff?: { type: CardType; minCount: number; power: number; toughness: number };
  /** "[This creature]'s power is equal to the number of creatures you
   * control" (Snow Villiers) - unlike every other power/toughness modifier
   * here (which adds to a fixed printed base), this REPLACES the base power
   * outright, same layer as lifeBasedBaseStat (checked first, before
   * counters/buffs are added on top). Toughness is unaffected - Snow
   * Villiers still has a normal printed toughness. See
   * engine/combat.ts: effectivePower. */
  basePowerEqualsControlledCreatureCount?: boolean;
  /** "Avalanche of Sector 7's power is equal to the number of artifacts
   * your opponents control." (Avalanche of Sector 7) - the "opponent's
   * artifacts" cousin of basePowerEqualsControlledCreatureCount above,
   * same base-override layer (checked right alongside it, before counters/
   * buffs are added on top). Toughness is unaffected - the card has a
   * normal printed toughness. See engine/combat.ts: effectivePower. */
  basePowerEqualsOpponentControlledArtifactCount?: boolean;
  /** "[This creature]'s power is equal to the number of artifacts you
   * control." (Bronze Guardian) - the "your OWN artifacts" cousin of
   * basePowerEqualsOpponentControlledArtifactCount above, same base-
   * override layer as basePowerEqualsControlledCreatureCount. Like every
   * other artifact-count check in this engine (e.g. Puresteel Paladin's
   * Metalcraft), this matches CardDefinition.type === 'artifact' only -
   * Bronze Guardian's own type is 'creature' (its "Artifact Creature"
   * status lives only in its printed subtype text), so it does NOT count
   * itself, same known limitation as every other artifact-counting field
   * here. See engine/combat.ts: effectivePower. */
  basePowerEqualsControlledArtifactCount?: boolean;
  /** "Whenever an opponent activates an ability of an artifact they
   * control, [this] deals [amount] damage to that player." (Avalanche of
   * Sector 7) - checked in engine/actions.ts: activateAbility right after
   * an ability actually resolves, against every permanent the ACTIVATING
   * player's opponent controls with this field, when the activated
   * permanent's own type is 'artifact'. */
  onOpponentActivatesArtifactAbilityDealsDamage?: number;
  /** "Equipped creature gets +X/+Y for each [counterLabel] counter on this
   * Equipment" (Excalibur II, whose charge counters come from the existing
   * onGainLifeTrigger field) - unlike equipBuff (a fixed bonus), this reads
   * the EQUIPMENT's own counters, not the wielder's. See
   * engine/combat.ts: effectivePower/effectiveToughness. */
  equipBuffPerCounter?: { counterLabel: string; power: number; toughness: number };
  /** "Equipped creature gets +X/+Y for each [type] you control" (Machinist's
   * Arsenal's "+2/+2 for each artifact you control") - unlike
   * controlledTypeCountBuff (a threshold-gated buff on the permanent's OWN
   * static ability), this scales linearly with the count and comes from an
   * attached Equipment. See engine/combat.ts: equipBuffBonus. */
  equipBuffPerControlledType?: { type: CardType; power: number; toughness: number };
  /** "Equipped creature gets +X/+Y for each color among permanents you
   * control" (Conqueror's Flail) - the DISTINCT-COLOR cousin of
   * equipBuffPerControlledType above. Each controlled permanent's "color"
   * is approximated as the colored symbols in its own printed costLabel
   * (same approximation Arcane Signet's commander color identity already
   * uses), unioned across every permanent controlled, then counted - a
   * colorless permanent (land, artifact with no colored pips) contributes
   * nothing. See engine/combat.ts: equipBuffBonus. */
  equipBuffPerDistinctControlledColor?: { power: number; toughness: number };
  /** "During your turn, [this creature] has KEYWORD[, KEYWORD]" (Freya
   * Crescent's Jump; Tonberry's "has first strike and deathtouch") - the
   * self-only counterpart to equipGrantsKeywordDuringOwnTurn (which reads an
   * attached Equipment's grant instead of the permanent's own). A single
   * string or an array for multiple keywords. Checked at the same call site
   * (engine/actions.ts: declareBlockers). */
  grantsSelfKeywordDuringOwnTurn?: string | string[];
  /** "During your turn, [this] and [subtype] creatures you control have
   * KEYWORD[, KEYWORD] [and ward [cost]]" (Yuna, Hope of Spira's "Yuna and
   * enchantment creatures you control have trample, lifelink, and ward
   * {2}") - the board-wide counterpart to grantsSelfKeywordDuringOwnTurn
   * (self only) and equipGrantsKeywordDuringOwnTurn (equipment-granted):
   * this permanent's own printed text grants a keyword group to itself
   * (if includeSelf) AND every other creature it controls matching
   * subtypeMatch, but only during its controller's turn. `ward`, when set,
   * is granted the same way but isn't a plain CombatKeyword (it carries a
   * cost) so it's checked separately - see engine/combat.ts:
   * hasBoardGrantedKeyword, effectiveWardCost. */
  grantsControlledGroupKeywordsDuringOwnTurn?: { subtypeMatch?: string; includeSelf: boolean; keywords?: string[]; ward?: WardCost };
  /** "Ward [cost]" printed directly on this permanent (Ancient Adamantoise,
   * Summon: Leviathan, Raubahn's dynamic "pay life equal to Raubahn's
   * power"). See WardCost, engine/combat.ts: effectiveWardCost. */
  wardCost?: WardCost;
  /** "Other artifacts you control have ward [cost]." (Bronze Guardian) -
   * an always-on anthem grant, excluding the granting permanent itself
   * ("other") since that one already has its own printed wardCost. See
   * engine/combat.ts: effectiveWardCost. */
  grantsWardToOtherControlledArtifacts?: WardCost;
  /** "Equipped creature has ward [cost]" (Paladin's Arms) - the
   * equipment-granted counterpart to wardCost, same pattern as
   * equipGrantsKeyword vs. a permanent's own printed keyword. */
  equipGrantsWard?: WardCost;
  /** "Whenever [this] deals combat damage to a player, that player gains
   * control of [this]. If they do, you draw that many cards, create that
   * many tapped Treasure tokens, then lose that much life." (Kain,
   * Traitorous Dragoon) - "you" is always the ORIGINAL controller (the one
   * who just lost the creature), not the new one. See engine/actions.ts:
   * applyPostCombatDamageControlChanges, run right after combat damage
   * resolves (control has to change AFTER damage, not before, or the
   * creature would attack its own new controller). */
  combatDamageToPlayerGrantsControlToThem?: boolean;
  /** "Whenever one or more creatures an opponent controls attack you and
   * aren't blocked, that player draws [drawCount] cards and gains control
   * of this [artifact]. Untap it." (Coveted Jewel) - the REVERSE direction
   * of combatDamageToPlayerGrantsControlToThem above (that one hands the
   * ATTACKING creature itself to the DEFENDER; this hands a permanent
   * sitting on the DEFENDER's own battlefield to the ATTACKER), and
   * triggers from ANY unblocked attacker getting through this combat, not
   * from this permanent's own combat damage. Checked once per combat (not
   * once per unblocked attacker) in engine/actions.ts:
   * applyPostCombatDamageControlChanges, same "unblocked approximates
   * dealt combat damage" caveat as every sibling trigger there. */
  onUnblockedOpponentAttackGrantsControlAndDraws?: { drawCount: number };
  /** "Whenever a Vehicle you control deals combat damage to a player,
   * [effects]." (Setzer, Wandering Gambler) - a board-wide watcher like
   * onAnyControlledCreatureCombatDamageToPlayer, but restricted to
   * attackers whose own subtype contains "Vehicle" (crewed Vehicles are
   * the only way a Vehicle can ever be a legal attacker at all). See
   * engine/actions.ts: applyCombatDamageToPlayerTriggers. */
  onAnyControlledVehicleCombatDamageToPlayer?: CardEffect[];
  /** "Whenever you win a coin flip, [effects]." (Setzer, Wandering
   * Gambler's second trigger) - a STANDING board-wide watcher, separate
   * from any specific CoinFlipEffect.ifWinEffects (which only fires for
   * the ability that itself flipped the coin). Checked for every
   * permanent the WINNING player controls, right after any coin flip
   * resolves - see engine/actions.ts: chooseCoinSide. */
  onWinCoinFlip?: CardEffect[];
  /** "If you control a Swamp, you may pay [lifeCost] life rather than pay
   * this spell's mana cost." (Snuff Out) - an alternate TOTAL cost (not a
   * discount), requested explicitly via GameAction 'CAST_CARD's
   * payAlternateLifeCost (no silent fallback to normal mana payment if the
   * land condition isn't met). See engine/actions.ts: castCard. */
  alternateCastCostPayLifeIfControlLandName?: { landName: string; lifeCost: number };
  /** "Spectacle [cost] (You may cast this spell for its spectacle cost
   * rather than its mana cost if an opponent lost life this turn.)" (A
   * Promise Fulfilled) - another alternate TOTAL cost, same "requested
   * explicitly via GameAction 'CAST_CARD', no silent fallback" shape as
   * alternateCastCostPayLifeIfControlLandName above, gated on
   * PlayerState.lifeLostThisTurn > 0 for the caster's opponent instead of
   * a land. See engine/actions.ts: castCard. */
  spectacleCost?: string;
  /** "Evoke—Exile a [color] card from your hand." (the Modern Horizons 2
   * Elemental Incarnations - Subtlety's blue, and the others this engine
   * will likely need too: Solitude/white, Grief/black, Fury/red,
   * Endurance/green) - an alternate TOTAL cost (not a discount), requested
   * explicitly via GameAction 'CAST_CARD's evokeExileInstanceId (the
   * specific OTHER card in hand to exile; no silent fallback to normal
   * mana payment if it doesn't match `color`). Deliberately does NOT
   * implement the real template's "When this creature enters, if its
   * evoke cost was paid, sacrifice it" - that clause isn't present in
   * this card's own printed text (this engine's card data is the source
   * of truth, not the real Magic card), so a card using this field keeps
   * its evoked copy on the battlefield permanently unless some other
   * printed clause says otherwise. See engine/actions.ts: castCard. */
  evokeCost?: { exileColor: Exclude<ManaColor, 'C'> };
  /** "As an additional cost to cast this spell, pay X life." (Toxic
   * Deluge) - unlike useAlternateLifeCost/evokeCost (both REPLACE the
   * mana cost), this is paid ON TOP OF it. X has no {X} in the printed
   * mana cost at all (unlike parsed.hasX cards) - it's a free-choice
   * amount tied only to this life payment, requested via the same
   * GameAction 'CAST_CARD's chosenX slot every {X}-cost card already
   * uses (reused here without ever feeding extraGeneric). See
   * engine/actions.ts: castCard. */
  additionalCostPayXLife?: boolean;
  /** "As an additional cost to cast this spell, sacrifice an artifact or
   * creature." (Baron Rivalry) - paid ON TOP OF the mana cost, same shape
   * as additionalCostPayXLife just above but sacrificing a permanent
   * instead of paying life. WHICH permanent is strategically meaningful,
   * so the controller picks it via GameAction 'CAST_CARD's own
   * sacrificeCostInstanceId, same "player choice arrives baked in"
   * convention as kicker's sacrificeCreatureOrArtifact payment. Reuses
   * SacrificeFilter (matched via engine/effects.ts: matchesSacrificeFilter)
   * rather than a new string union. See engine/actions.ts: castCard. */
  additionalCostSacrifice?: SacrificeFilter;
  /** See BlitzAbility - an alternate cast mode (from hand OR graveyard)
   * paying a different mana cost plus discarding a card, granting haste
   * and a death-trigger draw, then sacrificing itself at the next end
   * step. See GameAction 'CAST_WITH_BLITZ'. */
  blitz?: BlitzAbility;
  /** See UnearthAbility - a graveyard-only return-to-battlefield mode
   * paying a mana cost, granting haste, then exiling itself (via a
   * delayed ExileSelfEffect) at the next end step. See GameAction
   * 'ACTIVATE_UNEARTH'. */
  unearth?: UnearthAbility;
  /** See ReboundAbility - "exile instead of graveyard, may cast again free
   * at your next upkeep" (only when cast from hand). */
  rebound?: ReboundAbility;
  /** "You may cast this spell for its dash cost. If you do, it gains
   * haste, and it's returned from the battlefield to its owner's hand at
   * the beginning of the next end step." (Zidane Tribal) - an alternate
   * cast mode from hand, same shape as BlitzAbility but with no discard
   * cost and a delayed ReturnSpecificInstancesToOwnersHandEffect (via
   * GameState.pendingDelayedEndStepEffects) instead of Blitz's delayed
   * sacrifice. See GameAction 'CAST_WITH_DASH'. */
  dash?: { cost: string };
  /** "Exile Dawn Warriors' Legacy." (Mizzix's Mastery) - the spell exiles
   * itself after resolving instead of going to the graveyard, same
   * zone-redirect shape as ReboundAbility but with no later free recast.
   * See engine/actions.ts: castCard's own targetZone computation. */
  exilesSelfInsteadOfGraveyardAfterResolving?: boolean;
  /** "Delve (Each card you exile from your graveyard while casting this
   * spell pays for {1}.)" (Dig Through Time) - requested via GameAction
   * 'CAST_CARD's delveInstanceIds (own graveyard cards to exile, one per
   * {1} of generic cost covered - the controller must choose at most as
   * many as the spell's generic cost, same strict-count validation as
   * Convoke/Escalate elsewhere in this engine). See engine/actions.ts:
   * castCard. */
  delve?: boolean;
  /** "Whenever another creature you control dies, create [tokenId]."
   * (Pitiless Plunderer) - the token-creating cousin of onAnyDeathCounterSelf/
   * onAnyDeathDrain (same watcher family, same "excludes the watcher
   * itself" shape), restricted to CREATURE deaths only (not artifacts,
   * unlike its siblings - Pitiless Plunderer's own text says "creature").
   * Creates one token per qualifying death. combat.ts can't call
   * resolveCardEffects (circular import), so the token is constructed
   * directly here instead of going through CreateTokenEffect. See
   * engine/combat.ts: moveCreaturesToGraveyard. */
  onAnyDeathCreateToken?: { tokenId: string };
  /** "Metalcraft — Equipment you control have equip {0} as long as you
   * control three or more artifacts." (Puresteel Paladin) - checked
   * against the EQUIPPING creature's controller's own battlefield (not
   * the Equipment's), same "Metalcraft" threshold TapTargetThenExileIfMetalcraftEffect
   * already uses elsewhere, just applied to equip cost instead of a
   * one-shot spell effect. Overrides the WHOLE equip cost to {0}, not a
   * flat reduction. See engine/actions.ts: attachCard. */
  reducesEquipCostToZeroIfMetalcraftActive?: boolean;
  /** "Creatures can't attack you unless their controller pays {2} for
   * each creature they control that's attacking you." (Propaganda) - the
   * ALWAYS-ON static cousin of CardInstance.attacksYouCostGenericUntilNextTurn
   * (Summon: Yojimbo's temporary, "until your next turn" grant): this one
   * has no expiry at all, active for as long as the permanent itself
   * stays on the battlefield. Summed together with the instance-level
   * field wherever either is read. See engine/actions.ts: declareAttackers. */
  staticAttacksYouCostGeneric?: number;
  /** "Enchanted creature is a [color] [subtype] with base power and
   * toughness [power]/[toughness]..." (Eye of Nidhogg) - the static-number
   * cousin of setsBasePowerToughnessToControllerLife (same "any Aura/
   * Equipment attached" mechanism, just a fixed pair instead of a
   * dynamic life-based one). Checked alongside it in effectivePower/
   * effectiveToughness - see engine/combat.ts: attachedStaticBaseStat.
   * The "is a [color]" half is NOT modeled (nothing in this engine's
   * current card pool ever checks a creature's color against anything
   * OTHER than its own printed costLabel, and overriding that would have
   * unwanted ripple effects on mana cost display) - same "flavor-only,
   * not mechanically reachable" scope limit as other deferred clauses. */
  attachedSetsBasePowerToughness?: { power: number; toughness: number };
  /** "...can't attack..." as part of an attached Aura's grant (Observed
   * Stasis) - checked against every permanent attached to this one, same
   * shape as attachedPreventsUntap/attachedPreventsAbilities above. See
   * engine/actions.ts: declareAttackers. */
  attachedPreventsAttacking?: boolean;
  /** "...or block." (Observed Stasis, continuing attachedPreventsAttacking
   * above) - the blocking half, checked in engine/actions.ts: declareBlockers. */
  attachedPreventsBlocking?: boolean;
  /** "[This] can't be blocked by creatures with greater power." (Locke,
   * Treasure Hunter) - checked against effectivePower at the moment
   * blockers are declared. See engine/actions.ts: declareBlockers. */
  cantBeBlockedByCreaturesWithGreaterPower?: boolean;
  /** "Equipped creature ... can't be blocked by creatures with power [N] or
   * less." (Wrecking Ball Arm) - the equip-granted, inverse-threshold
   * cousin of cantBeBlockedByCreaturesWithGreaterPower above (that one is a
   * creature's own printed ability; this is granted by an attached
   * Equipment instead). Checked the same way, in
   * engine/actions.ts: declareBlockers. */
  equipGrantsCantBeBlockedByCreaturesWithPowerAtMost?: number;
  /** "When [this] is put into a graveyard from the battlefield, return it
   * to its owner's hand." (Eye of Nidhogg) - checked at BOTH places a
   * non-creature permanent can reach the graveyard: engine/state.ts:
   * detachEverythingFrom (an Aura falling off its enchanted permanent -
   * manually kept in parity between server/client, since state.ts is
   * never byte-mirrored) and engine/combat.ts: moveCreaturesToGraveyard
   * (destroyed/sacrificed directly while still attached). Redirects the
   * destination from graveyard to hand; no "loses all abilities" is
   * stripped by this flag, that's a separate (deferred) clause. */
  returnsSelfToHandOnDeath?: boolean;
  /** "When this creature dies, put it on the bottom of its owner's library."
   * (Murderous Rider) - the bottom-of-library cousin of
   * returnsSelfToHandOnDeath just above, same replacement-effect shape
   * (never actually reaches the graveyard). Only checked in
   * engine/combat.ts: moveCreaturesToGraveyard - no current card with this
   * flag can be an Aura's enchanted permanent, so unlike
   * returnsSelfToHandOnDeath it doesn't need an engine/state.ts:
   * detachEverythingFrom branch too. */
  onDeathPutOnBottomOfOwnersLibrary?: boolean;
  /** Combat keywords this card's OWN text mentions (as plain prose, e.g.
   * "Demons you control have menace") but that do NOT apply to the card
   * itself - only to something else the text is granting them to. Without
   * this, engine/keywords.ts: hasKeyword's substring search over the whole
   * text would incorrectly give the card itself that keyword permanently.
   * See engine/keywords.ts header comment. */
  excludeSelfKeywords?: string[];
  /** "[This] can't be blocked." as plain prose rather than the reminder-text
   * word "unblockable" (The Destined Thief) - hasKeyword's substring search
   * only ever matches the literal keyword string, so wording that never
   * says "unblockable" needs this explicit, unconditional flag instead.
   * Checked in engine/actions.ts: declareBlockers alongside the normal
   * hasKeywordEffective(..., 'unblockable') check. */
  isUnblockableSelf?: boolean;
  /** "[This] attacks each combat if able." (Amarant Coral) - enforced as a
   * precondition on declaring attackers (engine/actions.ts: declareAttackers),
   * not just flavor text: if this permanent could legally attack (untapped,
   * no summoning sickness unless it has haste, not a Defender), it MUST be
   * included among the chosen instanceIds, or the action is rejected. Also
   * the mechanical backbone of CardInstance.goadedUntilControllerNextUntapStep
   * below (Goad is "forced to attack" plus a few 2-player-irrelevant extras -
   * see that field's own doc comment). */
  mustAttackIfAble?: boolean;
  /** "During your turn, [this] has indestructible." (Kefka, Dancing Mad) -
   * a STATIC keyword conditioned on whose turn it currently is, unlike
   * every "gains indestructible until end of turn" reactive grant
   * elsewhere in this file (all unconditional once triggered). Checked in
   * engine/combat.ts: checkIndestructibleOrShielded against
   * GameState.activePlayerId. */
  hasIndestructibleDuringControllerTurn?: boolean;
  /** "Equipped creature has KEYWORD" (Genji Glove's double strike) -
   * unconditional, unlike equipGrantsKeywordDuringOwnTurn. A string[] grants
   * more than one keyword at once (Samurai's Katana's trample AND haste).
   * See engine/combat.ts: hasEquipGrantedKeyword. */
  equipGrantsKeyword?: string | string[];
  /** "As long as equipped creature is legendary, it has [keyword]."
   * (Champion's Helm) - the conditional cousin of equipGrantsKeyword
   * above (unconditional), checked live against the EQUIPPED creature's
   * own printed subtype (same "legendary" substring match as
   * checkLegendRule and every other legendary check in this engine). See
   * engine/combat.ts: hasEquipGrantedKeyword. */
  equipGrantsKeywordIfEquippedLegendary?: string | string[];
  /** "Equipped creature ... loses KEYWORD" (Colossus Hammer's "loses
   * flying") - the removal cousin of equipGrantsKeyword above. Scoped down
   * to the one call site where losing flying actually changes anything
   * mechanically (engine/actions.ts: declareBlockers's attackerHasFlying
   * check, which gates whether a non-flying/non-reach blocker can legally
   * block it) - NOT threaded through every other place 'flying' is checked
   * (targeting filters like 'artifactEnchantmentOrFlyingCreature', which
   * exist for entirely different cards and would need the full keyword
   * system reworked to subtract rather than only ever add, for a drawback
   * clause only this one card has). */
  equipRemovesKeyword?: string;
  /** "Equipped creature is a [Subtype] in addition to its other types" (Dark
   * Knight's Greatsword's "...is a Knight...") - surfaced by
   * components/CardActionsPanel.tsx's "what's modifying this card" section
   * (see engine/combat.ts: equipmentContributions) AND counted alongside the
   * permanent's own printed subtype text by any subtype-matching effect that
   * calls engine/combat.ts: hasGrantedSubtype (currently: pumpControlledSubtype,
   * onGainLifeTrigger's subtypeFilter). Other subtype-counting effects in this
   * engine don't check it yet - only wired where an existing card actually
   * needed it. */
  equipGrantsSubtype?: string;
  /** "Whenever equipped creature attacks, [effects]" (Genji Glove, Ultima
   * Weapon) - a granted triggered ability, unlike equipGrantsKeyword (a
   * static keyword). Checked in engine/actions.ts: declareAttackers
   * alongside the attacker's own onAttack, for every Equipment currently
   * attached to it. Effects resolve with the EQUIPPED CREATURE as
   * sourceInstanceId (so a self-referencing effect like
   * UntapSelfIfFirstCombatPhaseOfTurnEffect targets the creature, not the
   * equipment). */
  equipGrantsOnAttack?: CardEffect[];
  /** "Whenever equipped creature dies, [effects]." (Skullclamp) - the one
   * death-watcher shape in this whole engine that needs to see an attachment
   * the INSTANT BEFORE it's severed (engine/combat.ts: moveCreaturesToGraveyard
   * detaches every attachment from a dying creature before anything else
   * runs), so it's captured there directly into GameState.
   * pendingEquipmentDeathEffects and drained by engine/effects.ts:
   * resolveOnDeathTriggers (which can actually call resolveCardEffects;
   * combat.ts can't, to avoid a circular import). Effects resolve with the
   * EQUIPMENT's own instanceId as source (the equipped creature is already
   * gone by the time this runs). */
  equipGrantsOnDeath?: CardEffect[];
  /** "Whenever a legendary creature you control enters, you may attach this
   * Equipment to it." (Hero's Blade) - checked in engine/effects.ts:
   * triggerCreatureEnterWatchers for every OTHER creature (naturally
   * excluded by the entered-permanent's own type check - an Equipment is
   * never a creature) that enters under the SAME controller as this
   * Equipment. See AttachSelfToFixedTargetEffect, wrapped in a
   * MayEffectEffect for the "you may". */
  mayAttachSelfToControlledLegendaryCreatureOnEnter?: boolean;
  /** "Equipped creature has '{T}: Add [color].'" (Summoning Materia) - grants
   * a tap-for-mana ability to whatever this Equipment is attached to, same
   * priority tier as CardDefinition.grantsManaAbilityToOthers (checked
   * BEFORE that broader fallback in engine/actions.ts: effectiveProducesMana,
   * since an equip grant is more specific than a passive "grant to anything
   * with none" effect). */
  equipGrantsManaAbility?: ManaColor;
  /** "Equipped creature has 'Whenever you cast a noncreature spell, ...'"
   * (Black Mage's Rod, Red Mage's Rapier) - the equip-granted counterpart to
   * CardDefinition.noncreatureCastTrigger (a permanent's own printed
   * version). Checked in engine/effects.ts: triggerNoncreatureCastAbilities
   * for every Equipment attached to each of the caster's permanents,
   * applied against the EQUIPPED CREATURE as source/target. */
  equipGrantsNoncreatureCastTrigger?: NoncreatureCastTrigger;
  /** "Whenever equipped creature deals combat damage to a player, draw a
   * card, then you may cast a spell from your hand with mana value less
   * than or equal to that damage without paying its mana cost." (Buster
   * Sword) - checked in engine/actions.ts: applyCombatDamageToPlayerTriggers
   * for every Equipment attached to an unblocked attacker (same "approximates
   * as unblocked" caveat as CardDefinition.onCombatDamageToPlayer). The draw
   * happens immediately; the "may cast" half pauses on
   * GameState.pendingFreeCastFromHand (RESOLVE_FREE_CAST_FROM_HAND) since it
   * needs the player's own choice of which card, if any. A plain boolean
   * rather than a CardEffect/NoncreatureCastTrigger-shaped field because the
   * mana-value cap is a dynamic per-trigger number (the damage dealt), not
   * something a static effect definition can carry. */
  equipGrantsDrawThenMayCastFreeUpToCombatDamage?: boolean;
  /** "Whenever equipped creature deals combat damage to a player, [effects]"
   * (Thief's Knife's "draw a card") - the generic counterpart to
   * equipGrantsDrawThenMayCastFreeUpToCombatDamage (which is hardcoded to
   * Buster Sword's specific draw-then-free-cast shape); use this one for any
   * OTHER "on combat damage to a player" grant that a plain CardEffect list
   * can express. Checked in engine/actions.ts:
   * applyCombatDamageToPlayerTriggers for every Equipment attached to an
   * unblocked attacker, resolved with the EQUIPPED CREATURE as
   * sourceInstanceId (same reasoning as equipGrantsOnAttack). */
  equipGrantsOnCombatDamageToPlayer?: CardEffect[];
  /** "Whenever an artifact you control enters, ..." (Golbez, Crystal
   * Collector) - fires once per artifact entering the battlefield, for as
   * long as this permanent stays out. Checked at the main "a permanent
   * enters" call sites (engine/actions.ts: castCard, castFromGraveyard) -
   * not every conceivable path a permanent could appear on the battlefield
   * (e.g. token creation), which stays out of scope for now. */
  onAnyArtifactEnterTrigger?: CardEffect[];
  /** "Whenever [this] or another [Subtype] you control enters, and
   * whenever a[n] [OtherSubtype] you control enters, ..." (Giott, King of
   * the Dwarves' "Giott or another Dwarf...and whenever an Equipment...") -
   * the subtype-filtered counterpart to onAnyArtifactEnterTrigger (which is
   * type-based and unconditional). Fires once per matching permanent
   * entering (checked against its OWN subtype text), including the watcher
   * itself if its own subtype also matches - same call sites and same
   * token-creation caveat as onAnyArtifactEnterTrigger. */
  onAnyControlledSubtypeEnterTrigger?: { subtypes: string[]; effects: CardEffect[] };
  /** "Whenever an opponent gains control of a permanent from you, [effect]"
   * (Zidane, Tantalus Thief) - fires once for EVERY control-change
   * mechanism in this engine that results in an opponent taking one of
   * this permanent's controller's permanents: GainControlOfTargetCreatureEffect/
   * GainControlOfTargetEquipmentAndAttachEffect (someone takes your stuff),
   * GiveControlOfAnotherOwnPermanentToOpponentEffect (you give it away), and
   * Kain, Traitorous Dragoon's automatic combat-damage control swap. See
   * engine/actions.ts: triggerControlLostToOpponentWatchers, called from
   * each of those four resolution points right after the move happens. */
  onOpponentGainsControlFromYouTrigger?: CardEffect[];
  /** "Whenever another creature you control enters, [effect]" (Loporrit
   * Scout) - fires for ANY creature entering (no subtype filter, unlike
   * onAnyControlledSubtypeEnterTrigger), explicitly excluding the watcher's
   * own entry ("another"). See engine/effects.ts:
   * triggerCreatureEnterWatchers, called from the same castCard/
   * castFromGraveyard hook points as the other enter-watchers. */
  onAnyOtherControlledCreatureEnterTrigger?: CardEffect[];
  /** "Whenever one or more other creatures you control enter, if one or
   * more of them entered from a graveyard or was cast from a graveyard,
   * put a +1/+1 counter on each creature you control." (Celes, Rune
   * Knight) - checked against the `fromGraveyard` flag threaded into
   * engine/effects.ts: triggerCreatureEnterWatchers, true only from its two
   * explicit "cast FROM a graveyard" call sites (castFromGraveyard,
   * castCreatureFromGraveyardViaGrant). "Entered from a graveyard" via
   * reanimation effects is a known gap - those call sites don't call
   * triggerCreatureEnterWatchers at all yet (a pre-existing limitation,
   * not something this card's implementation introduces). Approximated as
   * firing per individual entering creature (same collapsing-to-per-event
   * convention as every other "whenever one or more..." trigger here)
   * rather than batching multiple simultaneous entries into one trigger. */
  onAnyOtherControlledCreatureEnterFromGraveyardPutCounterOnAllControlledCreatures?: boolean;
  /** "Creatures your opponents control enter tapped. Whenever a creature
   * an opponent controls enters, you gain [lifeGain] life." (Authority of
   * the Consuls) - bundled into one field since both clauses trigger off
   * the SAME "an opponent's creature enters" event. Checked in
   * engine/effects.ts: triggerCreatureEnterWatchers against the ENTERING
   * creature's controller's opponent's battlefield (i.e. THIS permanent's
   * own controller must be an opponent of whoever the creature just
   * entered under), tapping the creature retroactively since this watcher
   * hook runs right after entry, not as a true replacement effect. */
  opponentCreaturesEnterTappedAndYouGainLife?: { lifeGain: number };
  /** "Each other nontoken creature you control enters with an additional
   * [counterLabel] counter on it." (Tromell, Seymour's Butler) - a static
   * replacement-style grant, checked directly in engine/effects.ts:
   * triggerCreatureEnterWatchers (the same hook onAnyOtherControlledCreatureEnterTrigger
   * uses) rather than through a generic CardEffect list, since it needs to
   * apply to the JUST-ENTERED creature specifically (not to the watcher, the
   * only sourceInstanceId a generic effect list gets there). Naturally
   * excludes tokens - triggerCreatureEnterWatchers is only ever called from
   * castCard/castFromGraveyard/castFromExile's own creature-entry paths, and
   * a token created via CreateTokenEffect never runs through those, so no
   * explicit isToken check is even needed against those. Known gap: a
   * creature entering via reanimation or another non-cast path doesn't run
   * through this hook at all, so it won't see this bonus. */
  grantsOtherNontokenCreaturesExtraCounterOnEnter?: { counterLabel: string; counterAmount: number };
  /** "Evolve (Whenever a creature you control enters, if that creature has
   * greater power or toughness than this creature, put a +1/+1 counter on
   * this creature.)" (Fathom Mage) - a real MTG keyword, checked directly in
   * engine/effects.ts: triggerCreatureEnterWatchers (same hook as
   * onAnyOtherControlledCreatureEnterTrigger) by comparing effectivePower/
   * effectiveToughness of the entering creature against THIS permanent's
   * own, at the moment just before any counter would be added - so the
   * comparison is never against itself post-counter. Naturally never fires
   * off its own entry (the watcher loop skips card.instanceId === enteredInstanceId). */
  evolve?: boolean;
  /** "Whenever a [counterLabel] counter is put on this creature, [effect]."
   * (Fathom Mage's "...you may draw a card") - checked by
   * engine/effects.ts: applyCounterPlacementSideEffects, called from only a
   * HANDFUL of the most common counter-adding effects (see that function's
   * own doc comment for the exact, deliberately-incomplete list). */
  onOwnCounterAddedTrigger?: { counterLabel: string; effects: CardEffect[] };
  /** "Whenever you put one or more counters on a creature you don't
   * control, [effect]." (Generous Patron's "...draw a card") - same
   * deliberately-incomplete coverage as onOwnCounterAddedTrigger above, via
   * the same applyCounterPlacementSideEffects helper. Fires once per
   * counter-ADDING EVENT (matching each of the few call sites that check
   * this already resolving one recipient at a time), not once per counter
   * within that event - "one or more counters" in a single event only ever
   * draws once here regardless of amount. "Don't control" is approximated
   * as "doesn't own". */
  onOwnCounterPlacedOnOpponentCreatureTrigger?: CardEffect[];
  /** "Whenever you put one or more counters on a creature, until end of
   * turn, that creature can't be blocked by creatures your opponents
   * control." (Rikku, Resourceful Guardian) - checked by engine/effects.ts:
   * applyCounterPlacementSideEffects, same deliberately-incomplete call-site
   * coverage as onOwnCounterAddedTrigger/onOwnCounterPlacedOnOpponentCreatureTrigger
   * above. Unlike those two (which run a CardEffect[] against the WATCHER),
   * this grants the named keyword straight to the RECIPIENT (via
   * engine/effects.ts: grantTemporaryKeyword), whoever controls it - the
   * printed text states no ownership restriction on "a creature". */
  onOwnCounterPlacementGrantsRecipientKeyword?: string;
  /** "If one or more [counterLabel] counters would be put on a creature you
   * control, that many plus one [counterLabel] counters are put on it
   * instead." (Hardened Scales) - a REPLACEMENT effect on the AMOUNT, not a
   * trigger - see engine/effects.ts: hardenedScalesAdjustedAmount for the
   * actual resolution and its own doc comment for scope/coverage caveats. */
  increasesOwnCounterPlacementsByOne?: string;
  /** "Whenever another creature you control enters, put a [counterLabel]
   * counter on that creature if its power is less than this creature's
   * power. Otherwise, put a [counterLabel] counter on this creature."
   * (Shelinda Yevon, Acolyte) - checked directly in engine/effects.ts:
   * triggerCreatureEnterWatchers (same hook as evolve/
   * onAnyOtherControlledCreatureEnterTrigger), comparing the entering
   * creature's effectivePower against this permanent's own at the moment
   * just before either counter is added. */
  onAnyOtherControlledCreatureEnterComparePowerPutCounter?: { counterLabel: string };
  /** "Whenever a creature you control enters, [effects]." (Path of
   * Discovery's "it explores") - unlike onAnyOtherControlledCreatureEnterTrigger
   * (which always runs effects against the WATCHER as source), these effects
   * run with the JUST-ENTERED creature itself as source, matching "it" in
   * the printed text. Checked in engine/effects.ts:
   * triggerCreatureEnterWatchers, same loop (and same self-skip) as evolve/
   * onAnyOtherControlledCreatureEnterComparePowerPutCounter above. */
  onAnyControlledCreatureEnterEffects?: CardEffect[];
  /** "Whenever you cast a spell, [effects]." (Inexorable Tide's
   * "proliferate") - unlike onAnyPlayerCastsSpellTrigger (either player) or
   * onOpponentCastsSpell (opponent only, fixed shape), this is the
   * self-only, generic-CardEffect[] shape. See engine/effects.ts:
   * triggerAnyPlayerCastSpellWatchers, which checks this alongside
   * onAnyPlayerCastsSpellTrigger in the same traversal. */
  onOwnCastAnySpellTrigger?: CardEffect[];
  /** "Whenever you cast a [color] spell, [effects]." (Ardbert, Warrior of
   * Darkness's separate white and black triggers) - the color-filtered
   * cousin of onOwnCastAnySpellTrigger just above, checked against the
   * actually-cast spell's own printed colors (parseCostLabel(def.costLabel).
   * colors) in the SAME traversal/call site - a multicolor spell can fire
   * more than one entry. See engine/effects.ts:
   * triggerAnyPlayerCastSpellWatchers (now takes the cast CardDefinition as
   * a parameter to check this). No type restriction (unlike
   * NoncreatureCastTrigger) - a creature spell of the right color counts
   * too. */
  onOwnCastColorSpellTrigger?: { color: Exclude<ManaColor, 'C'>; effects: CardEffect[] }[];
  /** "Whenever you cast a historic spell, put a +1/+1 counter on Elena."
   * (Elena, Turk Recruit) - the historic-filtered cousin of
   * onOwnCastAnySpellTrigger above, checked against the actually-cast
   * spell's own def.type === 'artifact' / !!def.saga / 'legendary' subtype
   * substring (same "historic" test as
   * ReturnTargetNonAssassinHistoricFromGraveyardToHandEffect), in the SAME
   * traversal/call site as onOwnCastColorSpellTrigger. */
  onOwnCastHistoricSpellTrigger?: CardEffect[];
  /** "Whenever you cast an Aura, Equipment, or Vehicle spell, draw a card."
   * (Sram, Senior Edificer) - the subtype-filtered cousin of
   * onOwnCastHistoricSpellTrigger above: matches if the actually-cast
   * spell's def.subtype contains ANY of `subtypes` (case-insensitive
   * substring, same convention as every other subtype filter in this
   * engine), checked in the SAME traversal/call site as
   * onOwnCastColorSpellTrigger. */
  onOwnCastSubtypeSpellTrigger?: { subtypes: string[]; effects: CardEffect[] };
  /** "Whenever you cast a legendary spell from your hand, exile cards from
   * the top of your library until you exile a legendary nonland card with
   * lesser mana value. You may cast that card without paying its mana
   * cost. Put the rest on the bottom of your library in a random order."
   * (Warrior of Light) - unlike every onOwnCast*Trigger field above (a
   * fixed CardEffect list), this is a dedicated, hardcoded dig: unbounded
   * reveal count (stops at the first match, or empties the library),
   * compared against the JUST-CAST spell's own mana value, with no match
   * meaning every exiled card goes to the bottom and nothing is granted.
   * Only fires for a spell actually cast FROM HAND (not commander zone,
   * graveyard, or exile) - checked in engine/actions.ts: castCard, right
   * alongside triggerAnyPlayerCastSpellWatchers. The found card's play
   * permission is persistent (no "this turn" in the printed text, unlike
   * e.g. Reno and Rude's grant) - see engine/effects.ts:
   * triggerCastLegendarySpellFromHandDig. */
  onOwnCastLegendarySpellFromHandDigForLesserManaValueLegendary?: boolean;
  /** "Whenever you cast your first spell each turn, choose an opponent at
   * random. [This] deals damage equal to that spell's mana value to that
   * player or a planeswalker that player controls." (Clive Rosfield) -
   * "choose an opponent at random" is always just the one opponent in
   * this 2-player engine, and "or a planeswalker that player controls"
   * never applies (no planeswalkers), so this simplifies to a flat
   * damage-to-the-opponent trigger. A dedicated boolean (not a generic
   * CardEffect list) since the damage amount is read directly from the
   * just-cast spell's own mana value, which no existing CardEffect
   * exposes. Checked against the caster's own PlayerState.spellsCastThisTurn
   * (already incremented by the time this runs, so === 1 means this was
   * their first). See engine/effects.ts: triggerAnyPlayerCastSpellWatchers. */
  onOwnCastFirstSpellEachTurnDealDamageEqualToManaValue?: boolean;
  /** "Whenever a permanent you control leaves the battlefield, if it had
   * counters on it, put those counters on target permanent you control."
   * (Resourceful Defense) - see MoveDeadPermanentCountersToTargetEffect's own
   * doc comment for the real scope (graveyard-bound deaths only). Checked in
   * engine/effects.ts: resolveOnDeathTriggers against every OTHER permanent
   * the dying card's OWNER controls (not the dying card's own def.onDeath -
   * this is a generic watcher on a SEPARATE permanent, same shape as
   * onOwnCounterPlacementGrantsRecipientKeyword's "watch something happen to
   * ANY of my other permanents" pattern). */
  onOwnPermanentDiesMoveCountersToTarget?: boolean;
  /** "Whenever a player casts a spell, [effect]." (Forgotten Ancient) -
   * unlike CardDefinition.onOpponentCastsSpell (opponent only, fixed
   * counter/life-gain shape) or onOpponentGainsControlFromYouTrigger-style
   * fields, this fires for a spell cast by EITHER player, including the
   * watcher's own controller, and resolves a generic CardEffect list (wrap
   * in MayEffectEffect for a "you may" clause, as this card's own text
   * needs). See engine/actions.ts: castCard's own call alongside
   * triggerOpponentCastSpellWatchers. */
  onAnyPlayerCastsSpellTrigger?: CardEffect[];
  /** "Whenever you sacrifice a [tokenId] token, put a [counterLabel] counter
   * on this creature." (Tireless Tracker, watching its own Clue tokens) -
   * checked in engine/actions.ts: activateAbility, right when a
   * CardAbility.cost.sacrificeSelf payment on a permanent matching `tokenId`
   * completes, against every OTHER permanent the same controller controls
   * carrying this field. Matched by defId, not merely "is a token" - so this
   * only reacts to sacrificing THIS SPECIFIC token type, not any token. */
  onControlledTokenSacrificed?: { tokenId: string; counterLabel: string; counterAmount: number };
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
  /** "Boast — Activate only if this creature attacked this turn." (Ardyn
   * Izunia) - set whenever this instance is declared as an attacker (see
   * engine/actions.ts: finalizeDeclareAttackers), persists for the rest of
   * the turn (unlike GameState.declaredAttackers, cleared at End Combat),
   * reset at this creature's own controller's next untap step. */
  attackedThisTurn?: boolean;
  /** Gates CardAbility.onlyIfNotUsedThisTurn (Fal'Cie Paradise's mana
   * ability) - set whenever that ability resolves on this instance, reset
   * at this creature's own controller's next untap step, same lifecycle as
   * attackedThisTurn above. */
  usedOncePerTurnAbilityThisTurn?: boolean;
  /** "Goad target creature." (Seifer, Balamb Rival) - "a goaded creature
   * attacks each combat if able, and attacks a player other than you if
   * able" (Seifer's own controller is "you"). In this 2-player engine
   * there's only ever one OTHER player to attack anyway, so this collapses
   * to exactly CardDefinition.mustAttackIfAble's own forced-attack
   * enforcement, just temporary and on a permanent that may not otherwise
   * have that field. Reset at the goaded creature's own controller's next
   * untap step (same lifecycle as attackedThisTurn above - matches "until
   * your next turn"). */
  goadedUntilControllerNextUntapStep?: boolean;
  /** Set when CardDefinition.onEnterChooseCreatureType (Herald's Horn) has
   * resolved its choice - the specific creature type this permanent's own
   * cost-reduction/upkeep-dig text refers to for the rest of the game.
   * Never reset (the choice is permanent, matching "As this artifact
   * enters, choose a creature type."). See GameState.pendingChooseCreatureType. */
  chosenCreatureType?: string;
  /** Set when CardDefinition.onEnterChooseNumber (Squall, Gunblade Duelist)
   * has resolved its choice - never reset (permanent for the rest of the
   * game, matching "As Squall enters, choose a number."). See
   * GameState.pendingChooseNumber. */
  chosenNumber?: number;
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
  /** Set whenever this card moves INTO a graveyard, recording whether that
   * move came from the battlefield (destroy/sacrifice/combat death - see
   * engine/combat.ts: moveCreaturesToGraveyard) or anywhere else (discard,
   * mill - see the handful of most common such call sites). Cleared (set to
   * undefined) for every card in every graveyard at cleanup, so its mere
   * presence already means "this turn" without a separate timestamp. Backs
   * CardDefinition.grantsOncePerTurnCastCreatureFromGraveyardIfNotFromBattlefield
   * (Banon, the Returners' Leader) - deliberately incomplete coverage (same
   * convention as PlayerState.counterPutOnOwnCreatureThisTurn): a card that
   * reaches the graveyard via some OTHER scattered path (exile-then-mill
   * combos, etc.) simply won't have this set, and is conservatively treated
   * as NOT eligible rather than guessed at. */
  graveyardEntrySource?: 'battlefield' | 'other';
  /** "[Target creature] becomes a [Subtype] in addition to its other types"
   * (Jenova, Ancient Calamity) - a PERMANENT grant on this specific
   * instance, lasting for as long as it stays on the battlefield (unlike
   * CardDefinition.equipGrantsSubtype, which comes from an attached
   * Equipment and disappears the moment it's unattached). Checked
   * alongside the card's own printed subtype and any equip-granted one by
   * engine/combat.ts: hasGrantedSubtype. */
  grantedSubtypes?: string[];
  /** "Gain control of [this] until end of turn" (Unexpected Request,
   * Zidane, Stolen Uniform) - set only while this specific control change
   * is temporary. Since ownerId never changes and "controller" is simply
   * whichever player's battlefield array currently holds the instance, a
   * card with this flag set is trivially "misplaced" once ownerId no
   * longer matches its current array's owner - engine/actions.ts:
   * applyCleanupResets sweeps for exactly that and moves it back to its
   * owner, clearing this flag. Kain, Traitorous Dragoon's PERMANENT
   * control change (combat-damage-triggered) never sets this, so it's
   * left alone here - the same array-move mechanism, just without an
   * expiry. */
  temporaryControlUntilEndOfTurn?: boolean;
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
  /** "Has base power and toughness X/Y until end of turn" (Vincent's Limit
   * Break) - unlike temporaryBuff (a delta added on top of everything),
   * this REPLACES the printed/life-based base that counters, equipment, and
   * temporaryBuff itself all still layer on top of afterward - same layer
   * priority as a life-based base (see engine/combat.ts: lifeBasedBaseStat,
   * effectivePower/effectiveToughness). Cleared at the cleanup step
   * alongside temporaryBuff. */
  temporaryBaseStats?: { power: number; toughness: number };
  /** "Gains 'When this creature dies, return it to the battlefield tapped
   * under its owner's control' until end of turn" (Vincent's Limit Break) -
   * a TEMPORARY grant, unlike CardDefinition.onDeath (a permanent part of a
   * card's own definition), so it's checked on the instance itself. See
   * engine/effects.ts: resolveOnDeathTriggers. Cleared at the cleanup step
   * alongside temporaryBuff - if it hasn't died by end of turn, the grant
   * just lapses. */
  temporaryOnDeathReturnTapped?: boolean;
  /** "Gains 'When this creature dies, return that card to its owner's hand'
   * until end of turn" (Together Forever) - the "return to hand" sibling of
   * temporaryOnDeathReturnTapped just above, same TEMPORARY-grant-on-the-
   * instance convention and same cleanup-step clearing. See
   * engine/effects.ts: resolveOnDeathTriggers. */
  temporaryOnDeathReturnToHand?: boolean;
  /** "Gains 'When this creature dies, put a number of +1/+1 counters equal
   * to its power on up to one target creature'" (Galuf's Final Act) - same
   * temporary-grant-on-the-instance convention as temporaryOnDeathReturnTapped,
   * just a different death effect. The amount is captured HERE (at the
   * moment the buff is granted plus whatever's on the instance when it
   * actually dies, approximating "last known information" - see
   * engine/effects.ts: resolveOnDeathTriggers) rather than recomputed from
   * a fresh effectivePower() call, which can't see board-only bonuses
   * (equip/anthem) once the creature is no longer on the battlefield anyway. */
  temporaryOnDeathPutCountersEqualToPower?: boolean;
  /** "When this creature dies, draw a card." (granted by Blitz, Sabin,
   * Master Monk) - a PERSISTENT grant (not cleared at cleanup like the
   * temporaryOnDeath* grants above), since it's not an "until end of turn"
   * effect - it lasts for as long as this specific permanent exists,
   * which in practice is always this same turn anyway (Blitz's own
   * delayed sacrifice kills it before cleanup could matter). Checked in
   * engine/effects.ts: resolveOnDeathTriggers. */
  grantsOnDeathDrawCardWhileBlitzed?: boolean;
  /** "Up to three target creatures can't block this turn." (Summon:
   * Kujata's chapter II) - cleared at the cleanup step like every other
   * until-end-of-turn instance grant. Checked in engine/actions.ts:
   * declareBlockers. */
  temporaryCantBlock?: boolean;
  /** "This creature gains 'Whenever this creature deals combat damage to a
   * player, that player loses the game.'" (Summon: Primal Odin's Zantetsuken
   * chapter, GrantCombatDamageToPlayerCausesLossEffect) - PERMANENT, unlike
   * every other temporary* field on this interface; never cleared by
   * cleanup. Checked in engine/combat.ts: dealDirectDamageToDefender. */
  grantedCombatDamageToPlayerCausesLoss?: boolean;
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
  /** "[This] becomes a [subtype] artifact creature in addition to its other
   * types until end of turn" (Phantom Train) - the crew-independent
   * counterpart to crewedUntilEndOfTurn (crewedUntilEndOfTurn is gated on
   * CardDefinition.crew being set at all, which a card that becomes a
   * creature this way but has no Crew ability of its own would fail). Also
   * checked by engine/combat.ts: isEffectivelyCreature. Reverts at cleanup
   * alongside temporaryBuff. */
  temporarilyCreatureUntilEndOfTurn?: boolean;
  /** The subtype named by a BecomeCreatureUntilEndOfTurnEffect (e.g.
   * "Spirit" - Phantom Train), kept alongside temporarilyCreatureUntilEndOfTurn
   * purely for display (CardActionsPanel.tsx's "Additional type" line) -
   * nothing else in the engine currently reads a permanent's subtype text,
   * so this doesn't feed into any actual subtype-matching logic. Reverts at
   * cleanup alongside temporaryBuff. */
  temporaryGrantedSubtype?: string;
  /** Keywords granted temporarily (until end of turn) on top of whatever the
   * card's own text already says - e.g. Blitzball Shot granting trample, or
   * Cecil, Redeemed Paladin's Protect granting indestructible to other
   * attackers. See engine/keywords.ts: hasKeywordEffective, which checks
   * both this and the card's own text. Cleared at the cleanup step alongside
   * temporaryBuff. */
  temporaryKeywords?: string[];
  /** Keywords granted "until your next turn" (Hydaelyn, the Mothercrystal's
   * Blessing of Light) - outlives a normal end-of-turn temporaryKeywords
   * grant (survives through the opponent's whole turn), cleared instead at
   * the GRANTING player's own next untap step. See engine/keywords.ts:
   * hasKeywordEffective and engine/actions.ts: runUntapStep. */
  temporaryKeywordsUntilNextTurn?: string[];
  /** "Until your next turn, creatures can't attack you unless their
   * controller pays {2} for each of those creatures" (Summon: Yojimbo) -
   * the generic mana cost per attacking creature that a DECLARE_ATTACKERS
   * against this permanent's controller must pay (summed across every
   * permanent that has this set, then multiplied by the number of attackers
   * being declared). Same "until your next turn" duration/clearing as
   * temporaryKeywordsUntilNextTurn above - cleared at this permanent's
   * controller's own next untap step. See engine/actions.ts: declareAttackers,
   * runUntapStep. */
  attacksYouCostGenericUntilNextTurn?: number;
  /** Set once CardDefinition.onAnyDeathDraw has fired for this instance this
   * turn (G'raha Tia's "triggers only once each turn") - cleared at the
   * cleanup step alongside temporaryBuff/temporaryKeywords. */
  onAnyDeathDrawUsedThisTurn?: boolean;
  /** Set once CardDefinition.onAnyCreatureDeathAnywhereDraw has fired for
   * this instance this turn (Morbid Opportunist) - the same once-per-turn
   * shape as onAnyDeathDrawUsedThisTurn just above, kept as its own flag
   * since a permanent could in principle have both abilities. Cleared at
   * the cleanup step alongside it. */
  onAnyCreatureDeathAnywhereDrawUsedThisTurn?: boolean;
  /** Set once CardDefinition.onOpponentLoseLifeMayCastFromGraveyardOncePerTurn
   * has fired for this instance this turn (Emet-Selch of the Third Seat) -
   * same once-per-turn shape as onAnyDeathDrawUsedThisTurn above, cleared
   * at the cleanup step alongside it. */
  onOpponentLoseLifeMayCastFromGraveyardTriggeredThisTurn?: boolean;
  /** Set on a CardDefinition.rebound card the moment it's exiled instead of
   * going to the graveyard after resolving (cast from hand) - checked at
   * the controller's very next upkeep (engine/actions.ts: nextPhase) to
   * arm GameState.pendingReboundChoice, then cleared unconditionally
   * whether accepted or declined (Rebound only ever offers that ONE
   * upkeep's window, never again after). Not a "this turn" flag - it can
   * persist across the end of the casting turn into the next, unlike
   * every OTHER *ThisTurn/*TriggeredThisTurn flag in this file, so it is
   * deliberately NOT cleared by applyCleanupResets. */
  pendingReboundNextUpkeep?: boolean;
  /** Set by a GrantIndestructibleToTargetWhileSourceInPlayEffect pick
   * (Thancred Waters's Royal Guard) - the instanceId of the PERMANENT
   * granting indestructible this way, re-checked live (not a one-time
   * snapshot) every time indestructibility matters. See
   * engine/combat.ts: checkIndestructibleOrShielded. Persistent (no
   * "until end of turn"), so deliberately not cleared by cleanup - only
   * ever stops mattering once the granting source itself leaves play. */
  grantedIndestructibleWhileSourceInPlay?: string;
  /** Set once CardDefinition.onAnyControlledCreatureWithCountersCombatDamageToPlayer
   * has fired for this instance this turn (Tidus, Yuna's Guardian's Cheer -
   * "do this only once each turn") - cleared at the cleanup step alongside
   * onAnyDeathDrawUsedThisTurn above. */
  cheerTriggeredThisTurn?: boolean;
  /** Set once CardDefinition.onAnyControlledCreatureWithPowerAtLeastCombatDamageToPlayer
   * has fired for this instance this turn (Tifa, Martial Artist's "do this
   * only once each turn") - same shape as cheerTriggeredThisTurn above,
   * just gated on power instead of counters. Cleared at the cleanup step
   * alongside it. */
  powerThresholdCombatDamageTriggeredThisTurn?: boolean;
  /** Set once CardDefinition.noncreatureCastTrigger's
   * mayPayLifeEqualToManaSpentCreateHeroTokenOncePerTurn has armed
   * GameState.pendingThrowWideTheGatesChoice for this instance this turn
   * (G'raha Tia, Scion Reborn's "do this only once each turn") - same
   * shape as cheerTriggeredThisTurn/powerThresholdCombatDamageTriggeredThisTurn
   * above. Cleared at the cleanup step alongside them. */
  throwWideTheGatesTriggeredThisTurn?: boolean;
  /** Gates NoncreatureCastTrigger.mayReturnCreatureFromGraveyardWithManaValueEqualToSpentOncePerTurn
   * for this instance this turn (Krile Baldesion's Trace Aether, "Do this
   * only once each turn") - same shape as cheerTriggeredThisTurn above.
   * Cleared at the cleanup step alongside them. */
  traceAetherTriggeredThisTurn?: boolean;
  /** Set once CardDefinition.onOwnControlledCreatureTargetedByActivatedAbility
   * has fired for this instance this turn (Professor Hojo's "do this only
   * once each turn") - same shape as cheerTriggeredThisTurn and its
   * siblings above. Cleared at the cleanup step alongside them. */
  targetedByActivatedAbilityDrawTriggeredThisTurn?: boolean;
  /** Set once CardDefinition.onOpponentDrawsOffTurnCreateTappedTokenOncePerTurn
   * has fired for this instance this turn (Tataru Taru's "do this only
   * once each turn") - same shape as cheerTriggeredThisTurn and its
   * siblings above. Cleared at the cleanup step alongside them. */
  scionsSecretaryTriggeredThisTurn?: boolean;
  /** Set whenever DestroyUpToOneOpponentArtifactThenPutCounterOnSelfEffect
   * (Wakka, Devoted Guardian) actually adds its counter to this instance -
   * read later the same turn by IfCounterPutOnSelfThisTurnEffect (Wakka's
   * Blitzball Captain end-step trigger). Cleared at the cleanup step
   * alongside cheerTriggeredThisTurn/onAnyDeathDrawUsedThisTurn. Only ever
   * set by that one effect - see IfCounterPutOnSelfThisTurnEffect's own
   * doc comment for why this isn't a universal "any counter, any source"
   * tracker. */
  counterPutOnSelfThisTurn?: boolean;
  /** Chapter numbers (SagaChapter.numbers entries) whose effects have
   * already resolved for THIS Saga's current, continuous stay on the
   * battlefield under its current defId - see engine/effects.ts:
   * triggerSagaLoreCounter. A Saga's lore counter can be added/removed by
   * other effects (ModifySagaLoreCounterEffect), and the counter revisiting
   * a number it already passed must NOT re-fire that chapter - this array is
   * what remembers "already fired" independent of the counter's current
   * value. Reset (left undefined) whenever the Saga freshly enters the
   * battlefield (cast, reanimated, ...) or transforms into a new defId, so
   * a fresh summon/transform always gets a clean slate ("once per summon,
   * not once per game"). */
  sagaChaptersTriggered?: number[];
  /** instanceIds of every card THIS permanent has revealed via
   * RevealTopThenLoseLifeByManaValueEffect (Dark Confidant) while
   * continuously on the battlefield - append-only, never cleared while this
   * instance persists (so both players can keep seeing the running list,
   * which is the entire point of a card like this - it tells the opponent
   * what's been added to your hand). A fresh instance (recast after leaving
   * the battlefield) starts with none, same as sagaChaptersTriggered above.
   * The UI greys out any entry no longer found in the controller's hand
   * (played, discarded, ...) rather than removing it - see
   * components/CardActionsPanel.tsx. */
  revealedCardIds?: string[];
  /** True while THIS exact instance sits revealed, face-up, in its
   * controller's hand - e.g. a library search that "reveals it, puts it
   * into your hand" (World Map, ...). Both players can inspect it (see
   * components/CardActionsPanel.tsx) and it's drawn with a purple outline
   * for the opponent, but only for as long as it's genuinely still sitting
   * in that hand - engine/actions.ts: applyAction strips this from any card
   * no longer found in a hand zone after every action, so leaving hand for
   * ANY reason (cast, discarded, exiled, tucked into library, ...) drops it
   * immediately, and it never reappears if the same physical card is later
   * drawn again. Distinct from CardInstance.revealedCardIds (Dark
   * Confidant's own running reveal history, which is source-permanent-scoped
   * and never cleared) - this one is about the REVEALED CARD's own
   * hand-tenure, not any particular source's history. */
  revealedToOpponentWhileInHand?: boolean;
  /** instanceId of the card THIS permanent hid away via a HideawayEffect
   * (Clive's Hideaway) - set once, by RESOLVE_HIDEAWAY, and read by its own
   * playHideawayCard ability to know which exiled card is "the exiled card".
   * The card itself sits in the owner's exile zone with faceDown: true. */
  hideawayExiledCardId?: string;
  /** "Monstrosity X" (Maester Seymour) - set once its Monstrosity ability
   * resolves, permanently (never cleared, unlike a "this turn" flag) making
   * that same ability illegal to activate again. See CardAbility.
   * requiresNotMonstrous. */
  monstrous?: boolean;
  /** "Have [this] become a copy of that creature" (Kimahri, Valiant
   * Guardian's Ronso Rage) - set once RESOLVE_OPTIONAL_BECOME_COPY accepts,
   * PERMANENT (lasts until this instance leaves the battlefield, matching a
   * real copy effect's continuous duration - never cleared at cleanup).
   * Approximated as a POWER/TOUGHNESS-ONLY copy (read in engine/combat.ts:
   * effectivePower/effectiveToughness as the base, same layer as
   * temporaryBaseStats) - deliberately does NOT copy the target's name,
   * types, or other abilities/keywords, matching the printed "except its
   * name is Kimahri... and it has vigilance and this ability" exception
   * clause (and conveniently sidestepping the much harder "full copy except
   * for specific characteristics" layer-system problem). */
  copiedStatsFromDefId?: string;
  /** Set by GrantPreventCombatDamageConvertToCounterToTargetOwnCreatureEffect
   * (Gatta and Luzzu) until end of turn - whenever engine/combat.ts: markDamage
   * would mark COMBAT damage on this creature, it instead puts that many
   * counters of this label on it and marks no damage. Scoped to combat damage
   * only, since markDamage is the one real choke point for damage in this
   * engine; non-combat damage is marked inline at many scattered call sites
   * with no shared funnel. Cleared at cleanup like other until-end-of-turn
   * instance grants. */
  temporaryPreventCombatDamageConvertToCounterLabel?: string;
  /** True for a card exiled face down (currently only via HideawayEffect) -
   * hidden from BOTH players (unlike a normal exile, or a private reveal
   * gated just to the controller), so the client only ever renders this as
   * a card back, even to its own owner, until it's actually played. */
  faceDown?: boolean;
  /** Tags a face-down exiled card with WHICH permanent exiled it (Urianger
   * Augurelt's Draw Arcanum) - unlike CardInstance.hideawayExiledCardId
   * (one single card, tracked on the SOURCE permanent), this can tag any
   * number of accumulated exiled cards, found later by filtering the
   * controller's exile zone for this field (Play Arcanum). */
  exiledFaceDownBySourceInstanceId?: string;
  /** Set by a ChooseOpponentEffect (Shinryu, Transcendent Rival's "As this
   * creature transforms into Shinryu, choose an opponent") - the id of the
   * player this permanent chose. See types.ts:
   * CardDefinition.winsGameIfChosenOpponentLoses, engine/actions.ts: concede. */
  chosenOpponentId?: string;
  /** Set by PhaseOutAnyNumberOfTargetControlledNonlandPermanentsEffect
   * (Clever Concealment) - "treated as though it doesn't exist" until its
   * controller's next untap step (see engine/actions.ts: the untap-step
   * reset function, which clears this). A scoped-down approximation: gates
   * attacking, blocking, being targeted, and tapping for mana/activated
   * abilities (see engine/combat.ts: isLegalPendingTarget), but is NOT
   * excluded from other board-wide "for each creature you control" counts -
   * a documented gap, not an oversight. Anything attached to the phased-out
   * permanent is set phasedOut too, and clears alongside it. */
  phasedOut?: boolean;
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
  /** How many lands this player has actually played this turn - separate
   * from hasPlayedLandThisTurn (which only ever tracks "at least one" for
   * the ordinary one-land-per-turn gate and the UI badge) because
   * CardDefinition.extraLandsPerTurn (Zell Dincht) raises the turn's actual
   * limit above 1, so the gate needs a real count to compare against the
   * limit rather than a boolean. Reset at the untap step. See
   * engine/actions.ts: castCard's land branch. */
  landsPlayedThisTurn: number;
  /** Which CardDefinition id is this player's actual commander, if known.
   * Set at game creation for VS AI (from the chosen deck). Networked
   * Versus play doesn't have deck selection wired up yet, so this stays
   * undefined there for now - see CardActionsPanel for where this gates
   * the "move to commander zone" option. */
  hasDrawnThisTurn: boolean;
  /** "The first legendary creature spell you cast each turn costs [N] less"
   * (Serah Farron, Crystallized Serah) - set once that discount has been
   * used this turn, so a second legendary creature spell in the same turn
   * pays full price. Reset at the untap step, same as hasPlayedLandThisTurn/
   * hasDrawnThisTurn. See CardDefinition.reducesCastCostForFirstLegendaryCreatureSpellEachTurn,
   * engine/mana.ts: dynamicCostReduction, engine/actions.ts: castCard. */
  usedFirstLegendaryCreatureSpellDiscountThisTurn?: boolean;
  /** "The first activated ability you activate during your turn that
   * targets a creature you control costs [N] less" (Professor Hojo) - set
   * once that discount has been used this turn, same shape as
   * usedFirstLegendaryCreatureSpellDiscountThisTurn above but for
   * CardDefinition.reducesActivatedAbilityCostForFirstOwnCreatureTargetingEachTurn.
   * Reset at the untap step alongside it. */
  usedFirstOwnCreatureTargetingAbilityDiscountThisTurn?: boolean;
  /** "Dualcast — The second spell you cast each turn costs {2} less to
   * cast." (Alisaie Leveilleur) - a running count of spells (non-land
   * casts) this player has cast this turn, incremented once per successful
   * cast in engine/actions.ts: castCard. Checked (not just a boolean, since
   * ONLY the second cast - not the third, fourth, etc. - qualifies) against
   * CardDefinition.reducesCastCostForSecondSpellEachTurn in engine/mana.ts:
   * dynamicCostReduction. Reset at the untap step. */
  spellsCastThisTurn?: number;
  /** "As long as you've cast two or more noncreature spells this turn, [this]
   * has double strike." (Lyse Hext) - the noncreature-only cousin of
   * spellsCastThisTurn just above (which counts every spell, creature
   * included), incremented alongside it in engine/actions.ts: castCard
   * whenever def.type !== 'creature'. Checked live (>= 2, not just
   * incremented past a threshold once) against
   * CardDefinition.hasDoubleStrikeIfControllerCastTwoOrMoreNoncreatureSpellsThisTurn
   * in engine/combat.ts: hasBoardGrantedKeyword. Reset at the untap step. */
  noncreatureSpellsCastThisTurn?: number;
  /** "Sacrifice this creature: Your opponents can't cast noncreature spells
   * this turn." (Ranger-Captain of Eos) - set on the RESTRICTED player's own
   * record (not the one who activated the ability), checked in
   * engine/actions.ts: castCard. Reset at the CLEANUP step (not untap,
   * unlike most "ThisTurn" flags here) - it's set on whichever player was
   * restricted, not whoever's turn it is, so it has to clear when the
   * current turn ends regardless of whose untap comes next. */
  cantCastNoncreatureSpellsThisTurn?: boolean;
  /** "Revolt — ... if a permanent left the battlefield under your control
   * this turn." (Fatal Push) - set whenever ANY permanent this player
   * controlled dies/is sacrificed/is destroyed (engine/combat.ts:
   * moveCreaturesToGraveyard, the single highest-value, most centralized
   * "a permanent left the battlefield" call site). NOT a comprehensive
   * "any permanent leaving by any means" tracker - a bounced or exiled
   * permanent doesn't set this, same kind of narrow, documented
   * approximation this engine already uses for similar broad conditions
   * (e.g. PlayerState.counterPutOnOwnCreatureThisTurn). Reset at the
   * CLEANUP step, same reasoning as cantCastNoncreatureSpellsThisTurn just
   * above - it tracks "this turn" for whichever player it was set on, not
   * whoever's turn it currently is. */
  permanentLeftBattlefieldThisTurn?: boolean;
  /** "Once during each of your turns, you may cast a creature spell..."
   * (Banon, the Returners' Leader's Pray) - set once used this turn, reset at
   * the untap step like the discount flag above. A single player-level flag
   * (not per-source) since only one such grant can realistically be in play
   * at once under the legend rule. */
  usedGraveyardCastPermissionThisTurn?: boolean;
  /** "Whenever you cast a noncreature spell this turn, create a token
   * that's a copy of a non-Saga token you control." (Summon: Good King Mog
   * XII's chapters II/III) - a temporary, player-level grant (unlike most
   * noncreature-cast triggers, which live on a still-on-the-battlefield
   * permanent via CardDefinition.noncreatureCastTrigger) since the Saga
   * itself may already be gone (sacrificed after chapter IV) by the time a
   * later spell is cast. Checked in engine/effects.ts:
   * triggerNoncreatureCastAbilities (the one shared "a noncreature spell
   * was just cast" call site), cleared at cleanup. */
  temporaryNoncreatureCastCreatesTokenCopyUntilEndOfTurn?: boolean;
  commanderDefId?: string;
  commanderDamageTaken: number;
  /** "...that player gets two poison counters." (Fynn, the Fangbearer) -
   * tracked and displayed the same way as commanderDamageTaken above (a
   * running total with no automatic loss-at-threshold check - this engine
   * doesn't auto-end the game on life <= 0 either, leaving win conditions
   * to the players/client). See engine/actions.ts:
   * applyCombatDamageToPlayerTriggers. */
  poisonCounters: number;
  /** Which of client/src/data/cardBacks.ts's CARD_BACKS this player chose
   * for their deck (null = the plain default back) - purely cosmetic, read
   * only by the client when rendering their library pile face down (see
   * GameBoard.tsx). Set once at game start from SavedDeck.cardBackId (see
   * engine/state.ts: createStateFromDeck) and never changes mid-game. */
  libraryCardBackId: string | null;
  /** "...cast a permanent spell of each permanent type from your
   * graveyard" (Orphan, Cocoon fal'Cie) - which permanent TYPES this
   * player has already cast from their own graveyard this way this turn,
   * so a second creature/artifact/enchantment spell from the graveyard
   * the same turn is correctly blocked (one of EACH type, not unlimited).
   * The "play a land" half of the printed text is deferred - this
   * engine's land-playing pathway (hand only) has no graveyard-sourced
   * counterpart at all, unlike castFromGraveyard's existing flashback/
   * Mug-grant machinery for spells. Reset at the cleanup step. See
   * engine/actions.ts: castFromGraveyard. */
  graveyardCastTypesUsedThisTurn?: ('creature' | 'artifact' | 'enchantment')[];
  /** Total life gained this turn from any automatic source (lifelink combat
   * damage, a gainLife effect, onAnyDeathDrain, ...) - NOT manual ADJUST_LIFE
   * changes, same "manual changes don't feed automatic triggers" convention
   * as onGainLifeTrigger. See engine/combat.ts: addLife. Reset at cleanup.
   * Used by Hope Estheim's end-step mill. */
  lifeGainedThisTurn: number;
  /** Total life LOST this turn from any automatic source (combat damage,
   * a damage/loseLife effect, ...) - the symmetrical counterpart to
   * lifeGainedThisTurn above, same "manual ADJUST_LIFE changes don't feed
   * automatic triggers" convention. See engine/combat.ts: loseLife. Reset
   * at cleanup. Used by Y'shtola, Night's Blessed's end-step draw. */
  lifeLostThisTurn: number;
  /** "...the number of opponents that were dealt combat damage this turn."
   * (Cecil Harvey) - unlike lifeLostThisTurn above (ANY life loss, combat
   * or not), this is set ONLY from actual combat damage, read on the
   * DEFENDING player (not the attacker). See engine/combat.ts:
   * dealDirectDamageToDefender, the single central function every path
   * that deals combat damage to a player (unblocked, trample-over) routes
   * through. Reset at the cleanup step like every other "this turn" flag. */
  dealtCombatDamageThisTurn?: boolean;
  /** "Until end of turn, each modified creature you control has base
   * power and toughness [power]/[toughness]." (Sephiroth, Fallen Hero's
   * Jenova Cells) - re-checked continuously (engine/combat.ts:
   * modifiedCreatureBaseStat), so a creature that becomes modified LATER
   * the same turn still picks this up retroactively. Cleared at cleanup. */
  modifiedCreaturesHaveBasePowerToughnessUntilEndOfTurn?: { power: number; toughness: number } | null;
  /** "If you put a counter on a creature this turn" (Lord Jyscal Guado) -
   * see IfCounterPutOnOwnCreatureThisTurnEffect's own doc comment for the
   * (deliberately incomplete) set of effects that set this. Reset for BOTH
   * players together at the moment a new turn actually begins (see
   * engine/actions.ts: endTurn/nextPhase's turn-handoff) - unlike
   * hasPlayedLandThisTurn/hasDrawnThisTurn (per-player, reset only at that
   * player's own untap step), this needs to be fresh for whichever player's
   * end-step watcher reads it, not just the incoming active player. */
  counterPutOnOwnCreatureThisTurn?: boolean;
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

/** A permission for `playerId` to play/cast a specific card instance
 * currently sitting in exile (in ANY player's exile zone, not necessarily
 * playerId's own - e.g. Reno and Rude exiles a card from the OPPONENT's
 * library, but its own controller gets to play it). See
 * engine/actions.ts: castFromExile. */
export interface ExilePlayGrant {
  instanceId: string;
  playerId: string;
  /** "mana of any type can be spent to cast it" (Reno and Rude) - the cost
   * is paid as pure generic mana value instead of requiring specific colors. */
  anyColorMana?: boolean;
  /** "for as long as you control [source]" (Lightning, Security Sergeant) -
   * re-checked live against playerId's current battlefield every time
   * CAST_FROM_EXILE is attempted, not a one-time snapshot. */
  requiresControlOfInstanceId?: string;
  /** "you may play this THIS TURN" (Reno and Rude) - removed at the next
   * cleanup step if unused. Omitted for a persistent grant like Lightning's. */
  expiresAtCleanup?: boolean;
  /** "Until the end of your next turn, you may play those cards." (A
   * Promise Fulfilled) - see ExileTopOfLibraryPlayableUntilCleanupEffect.
   * untilControllerNextTurn's own doc comment for the approximation this
   * makes. Removed at playerId's own NEXT untap step if unused. */
  expiresAtControllerNextUntapStep?: boolean;
  /** "Cast it on a later turn for its foretell cost" (Foretell, see
   * CardDefinition.foretell) - pay THIS cost instead of the card's own
   * costLabel. Mutually exclusive with anyColorMana in practice (no current
   * card needs both), but not enforced as such. */
  overrideCostLabel?: string;
  /** "Spells you cast this way cost {2} less to cast" (Urianger Augurelt's
   * Play Arcanum) - reduces the GENERIC portion of the cost by this
   * amount (capped at 0), same convention as every other cost reduction
   * in this engine. Mutually exclusive with overrideCostLabel in
   * practice (no current card needs both), but not enforced as such. */
  costReduction?: number;
}

/** Every filter a sacrifice choice can be restricted to - see
 * engine/effects.ts: matchesSacrificeFilter/sacrificeFilterLabel. Defined
 * here (not in effects.ts, where the matching logic lives) so
 * GameState.pendingSacrifice can reference it directly instead of
 * duplicating it as a separate inline literal union that's easy to forget
 * to update in lockstep whenever a new filter value is added. */
export type SacrificeFilter = 'creature' | 'creatureToken' | 'nontokenCreature' | 'enchantment' | 'anyPermanent' | 'nonGodCreature' | 'creatureOrArtifact';

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
  /** A queue of "an Equipment granting equipGrantsOnDeath just unattached
   * from a dying creature" entries (Skullclamp) - populated by
   * engine/combat.ts: moveCreaturesToGraveyard right before it detaches
   * everything from a dying permanent (combat.ts can't call
   * resolveCardEffects itself, to avoid a circular import with effects.ts),
   * and drained immediately by engine/effects.ts: resolveOnDeathTriggers,
   * which runs right after every moveCreaturesToGraveyard call site. */
  pendingEquipmentDeathEffects: { effects: CardEffect[]; sourceInstanceId: string; controllerId: string }[];
  /** Every outstanding CardDefinition.onOwnSacrificeSubtypeTrigger entry
   * (Vaan, Aspiring Pirate) - same queue-and-drain shape as
   * pendingEquipmentDeathEffects just above, for the same circular-import
   * reason. Queued by engine/combat.ts: moveCreaturesToGraveyard, drained
   * by engine/effects.ts: resolveOnDeathTriggers. */
  pendingOwnSacrificeSubtypeTriggerEffects: { effects: CardEffect[]; sourceInstanceId: string; controllerId: string }[];
  /** Same queue-and-drain shape as pendingEquipmentDeathEffects above, for
   * CardDefinition.dealsDamageEqualToPowerWhenCreatureEntersFromGraveyard
   * (Flayer of the Hatebound) - populated by engine/combat.ts:
   * moveCreaturesToGraveyard whenever a creature returns to the battlefield
   * via a death-replacement effect (hasUndying, onDeathReturnToBattlefieldTapped),
   * drained by engine/effects.ts: resolveOnDeathTriggers right alongside it. */
  pendingCreatureEnteredFromGraveyardEffects: { effects: CardEffect[]; sourceInstanceId: string; controllerId: string }[];
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
      | TapTargetThenCounterSelfByPowerDifferenceIfGreaterEffect
      | TapStunAndGainLifeForNonbasicLandsEffect
      | ChooseCreatureDebuffOthersAndWatchLeaveEffect
      | GrantTemporaryBaseStatsAndDeathReturnEffect
      | DestroyTargetEffect
      | PumpTargetEffect
      | PutCounterOnTargetEffect
      | JenovaCellsAttackTriggerEffect
      | ProliferateEffect
      | DebuffTargetByGraveyardEffect
      | SelfFightTargetEffect
      | ChooseCreaturesFightEffect
      | ModifySagaLoreCounterEffect
      | TapTargetEffect
      | TapTargetThenExileIfMetalcraftEffect
      | PutCounterOnUpToOneOwnCreatureEffect
      | AttachSelfToTargetEffect
      | DestroyOpponentCreatureEffect
      | BounceTargetEffect
      | BounceUpToOneOtherNonlandPermanentEffect
      | PutCounterOnUpToOneOtherCreatureEqualToOwnPowerEffect
      | DamageTargetAndControllerByEquipmentCountEffect
      | PumpAnotherControlledCreatureEffect
      | DamageTargetCreatureEffect
      | GrantCantBlockToUpToThreeTargetsEffect
      | SweepDamageFromChosenCreatureEffect
      | CreateTokenCopyOfTargetEffect
      | BecomeCopyOfAnyCreatureThenAddCountersEffect
      | UntapTargetAttackerEffect
      | PutStunCounterOnTargetAttackerEffect
      | GrantKeywordsToTargetPermanentEffect
      | GrantIndestructibleToTargetWhileSourceInPlayEffect
      | ExileTargetCreatureUntilMonarchChangesEffect
      | ExileUpToOneOtherTargetCreatureThenControllerGainsLifeEqualToItsPowerEffect
      | PumpTargetOwnCreatureByControlledSubtypeCountEffect
      | GrantKeywordToAnotherTargetAttackingCreatureEffect
      | ExileTargetInstantOrSorceryFromOpponentGraveyardThenMayCastForFixedCostEffect
      | ReturnTargetCreatureFromGraveyardWithManaValueEqualToEffect
      | GainControlOfTargetCreatureEffect
      | GiveControlOfAnotherOwnPermanentToOpponentEffect
      | GainControlOfTargetEquipmentAndAttachEffect
      | ChooseCreatureDealsDamageToOpponentCreatureEffect
      | ExileTargetPermanentEffect
      | ExileTargetCreatureWithLessPowerUntilSourceLeavesEffect
      | ExileTargetOpponentCreatureUntilSourceLeavesEffect
      | TapUpToOneTargetCreatureAndStunEffect
      | PutCounterOnUpToTwoOwnCreaturesEffect
      | ReturnUpToTwoTargetPermanentsFromGraveyardToHandEffect
      | SacrificeOwnCreatureThenDrawEffect
      | RevealUntilCreatureThenPutCountersEqualToManaValueEffect
      | PumpUpToTwoTargetsEffect
      | PutCounterOnAnotherCreatureGrantsIndestructibleUntilNextTurnEffect
      | ExileThenReturnTargetOwnCreatureEffect
      | AttachAllControlledEquipmentToTargetCreatureEffect
      | AttachTargetControlledEquipmentToTargetRebelEffect
      | DealDamageToAnyOtherTargetAndSelfEffect
      | PutCounterOnTargetLandEffect
      | PutCounterOnTargetCommanderEnteredThisTurnEffect
      | MoveCounterBetweenTargetCreaturesEffect
      | DamageAnyTargetEffect
      | SupportEffect
      | GrantOnDeathReturnToHandToTargetEffect
      | DestroyUpToOneOpponentArtifactThenPutCounterOnSelfEffect
      | PutOwnCountersOnTargetThenShuffleSelfIntoLibraryEffect
      | RonsoRageEffect
      | ExileTargetCreatureThenControllerMaySearchBasicLandEffect
      | ExileTargetCreatureThenControllerGainsLifeEqualToPowerEffect
      | PutTargetNonlandPermanentInLibraryOwnersChoiceEffect
      | MayMoveAllCountersToTargetCreatureEffect
      | GrantPreventCombatDamageConvertToCounterToTargetOwnCreatureEffect
      | MoveCounterFromOpponentCreatureToOwnCreatureEffect
      | PutCounterOnTargetOwnCreatureThenMayPlayHideawayIfCreaturePowerAtLeastEffect
      | MoveDeadPermanentCountersToTargetEffect
      | MoveAllCountersBetweenTargetPermanentsEffect
      | MoveOneCounterFromOwnPermanentToAnyPermanentEffect
      | GainControlOfTargetNoncreatureArtifactPermanentEffect
      | MayAttachTargetControlledEquipmentToSelfEffect
      | ShuffleTargetPermanentIntoLibraryThenRevealTopEffect
      | DestroyAnyNumberOfTappedCreaturesWithDifferentControllersEffect
      | PhaseOutAnyNumberOfTargetControlledNonlandPermanentsEffect
      | MayBecomeCopyOfAnotherControlledCreatureThenBuffBothEffect
      | GoadTargetCreatureEffect
      | DamageEqualToGreatestControlledPowerToUpToOneOpponentCreatureEffect
      | GrantIndestructibleToOwnAndOpponentCreatureThenDestroyAllEffect;
    /** Only used by ChooseCreaturesFightEffect/ChooseCreatureDealsDamageToOpponentCreatureEffect:
     * the first (controller's own) creature already chosen, waiting on the
     * second (opponent's) pick. */
    firstInstanceId?: string;
    /** SupportEffect only: how many MORE picks remain after the one
     * currently being made ("support X" seeds this with X) - decremented by
     * engine/actions.ts: chooseTarget on each pick, same
     * decrement-and-re-arm shape as pendingLibrarySearch.remainingPicks,
     * just living on pendingTarget instead since Support targets permanents,
     * not library cards. Reaching 0 (or an explicit decline) clears
     * pendingTarget entirely. */
    remainingPicks?: number;
    /** SupportEffect only: creatures already given a counter earlier in the
     * same "support X" sequence - excluded from matching on every
     * subsequent pick (Support's "each of up to X target creatureS" always
     * means X DIFFERENT creatures). Reused as-is by
     * GrantCantBlockToUpToThreeTargetsEffect's "up to three" (a plain
     * accumulating array, unlike firstInstanceId's fixed one-extra-slot
     * shape every "up to two" effect uses instead). */
    chosenInstanceIds?: string[];
    /** DestroyAnyNumberOfTappedCreaturesWithDifferentControllersEffect only
     * (Cloud's Limit Break's Blade Beam) - player ids already used up this
     * sequence. The controller-id cousin of chosenInstanceIds above, needed
     * because the destroyed creature itself no longer exists to re-check who
     * controlled it on a later pick. */
    usedControllerIds?: string[];
    /** Set when this pendingTarget was armed from an ACTIVATED ABILITY's own
     * effects (engine/actions.ts: activateAbility), rather than a spell's
     * onCast/onEnter or any other trigger - consulted by engine/actions.ts:
     * chooseTarget for CardDefinition.onOwnControlledCreatureTargetedByActivatedAbility
     * (Professor Hojo), which must only fire for a genuine activated
     * ability's target, not a spell's. */
    fromActivatedAbility?: boolean;
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
  /** Set while a ChooseCreatureTypeEffect's choice is outstanding (Herald's
   * Horn) - cleared by CHOOSE_CREATURE_TYPE into CardInstance.chosenCreatureType. */
  pendingChooseCreatureType: { instanceId: string; controllerId: string } | null;
  /** Set while a ChooseNumberEffect's choice is outstanding (Squall,
   * Gunblade Duelist) - cleared by CHOOSE_NUMBER into CardInstance.chosenNumber. */
  pendingChooseNumber: { instanceId: string; controllerId: string } | null;
  /** Set while an AddOneManaOfChosenColorEffect's color pick is outstanding
   * (The Warring Triad) - cleared by RESOLVE_ADD_MANA_OF_CHOSEN_COLOR. */
  pendingAddManaOfChosenColor: { controllerId: string; amount?: number } | null;
  /** Set when a sacrificeCreature or eachPlayerSacrifices effect is waiting
   * on the FRONT id in `remainingPlayerIds` to pick one of their own
   * permanents (matching `filter`) to sacrifice - cleared, or advanced to
   * the next remaining player, by CHOOSE_SACRIFICE. Null whenever nothing is
   * waiting on this. See engine/effects.ts: resolveSacrificeQueue. */
  pendingSacrifice: { sourceInstanceId: string; remainingPlayerIds: string[]; filter: SacrificeFilter } | null;
  /** Set when an EachPlayerKeepOneCreatureSacrificeRestEffect (Promise of
   * Loyalty) is waiting on the FRONT id in `remainingPlayerIds` to pick
   * which of their own creatures to keep - cleared, or advanced to the next
   * remaining player, by CHOOSE_KEEP_ONE_SACRIFICE_REST. See
   * engine/effects.ts: resolveKeepOneSacrificeRestQueue. */
  pendingKeepOneSacrificeRest: { sourceInstanceId: string; remainingPlayerIds: string[] } | null;
  /** Set when a ChooseUpToNCreaturesSacrificeRestEffect (Archfiend of
   * Depravity) is waiting on a human player to pick which of their own
   * creatures to keep, one at a time - `chosenInstanceIds` accumulates
   * picks (excluded from matching on later picks), reaching `keepCount`
   * (or an explicit decline via CHOOSE_UP_TO_N_CREATURES_SACRIFICE_REST's
   * null instanceId) sacrifices every other creature and clears this. See
   * engine/effects.ts: resolveChooseUpToNCreaturesSacrificeRestQueue. */
  pendingChooseUpToNCreaturesSacrificeRest: { sourceInstanceId: string; controllerId: string; keepCount: number; chosenInstanceIds: string[] } | null;
  /** Set while a ScryThenExileTopPlayableThisTurnThenPumpTargetByExiledManaValueEffect's
   * Scry 1 choice is outstanding (Cait Sith, Fortune Teller) - cleared by
   * RESOLVE_SCRY_BEFORE_EXILE, which then immediately continues into the
   * exile/play-grant/pump-target steps using whichever card is left on top. */
  pendingScryBeforeExile: { sourceInstanceId: string; controllerId: string } | null;
  /** Set while a SurveilEffect is mid-resolution - cleared by RESOLVE_SURVEIL.
   * `cards` are the surveiled cards, already removed from the library (so
   * they don't show up there in the meantime) but not yet anywhere else. */
  pendingSurveil: { sourceInstanceId: string; controllerId: string; cards: CardInstance[]; thenDrawCount?: number; thenRevealTopLandToBattlefieldTappedElseDraw?: boolean } | null;
  /** Set while an ExploreEffect's "put the card back or put it into your
   * graveyard" choice is outstanding - the land auto-to-hand case and the
   * counter placement both already happened before this is ever set (see
   * ExploreEffect's own doc comment); `revealedCard` is the one card, already
   * removed from the library. Cleared by RESOLVE_EXPLORE. */
  pendingExplore: { sourceInstanceId: string; controllerId: string; revealedCard: CardInstance } | null;
  /** FIFO queue of player ids owed an extra turn (e.g. Ultimecia, Omnipotent's
   * Time Compression) - see engine/actions.ts: endTurn, which pops the front
   * entry and gives that player the next turn instead of the usual opponent. */
  extraTurnsQueued: string[];
  /** "After this phase, there is an additional combat phase" (Genji Glove,
   * Balthier and Fran) - QueueExtraCombatPhaseIfFirstCombatPhaseOfTurnEffect
   * increments this; engine/actions.ts: nextPhase consumes one and loops
   * back into another combat phase (straight to declare_attackers - an
   * extra combat phase doesn't get its own untap/upkeep/draw) instead of
   * proceeding from End Combat into Main 2 whenever this is above 0. Reset
   * to 0 on every turn handoff (engine/actions.ts: endTurn). */
  extraCombatPhasesQueued: number;
  /** How many combat phases have happened so far this turn (the first one
   * is number 1) - lets UntapSelfIfFirstCombatPhaseOfTurnEffect and
   * QueueExtraCombatPhaseIfFirstCombatPhaseOfTurnEffect tell an extra combat
   * phase apart from the turn's normal one, so Genji Glove's loop can't
   * chain into more than one extra combat phase per turn. Incremented every
   * time a combat phase begins (engine/actions.ts: nextPhase's
   * enteringCombatBegin), reset to 0 on every turn handoff (endTurn). */
  combatPhaseNumberThisTurn: number;
  /** "There is an additional end step after this step" (Y'shtola Rhul) -
   * QueueExtraEndStepIfFirstEndStepOfTurnEffect increments this; leaving
   * 'end' loops back into another 'end' phase (engine/actions.ts: nextPhase)
   * instead of proceeding to cleanup whenever this is above 0. Reset to 0
   * on every turn handoff (endTurn). */
  extraEndStepsQueued: number;
  /** How many end steps have happened so far this turn (the first one is
   * number 1) - same "tell the extra one apart from the normal one so it
   * can't chain indefinitely" role as combatPhaseNumberThisTurn, for
   * QueueExtraEndStepIfFirstEndStepOfTurnEffect. Incremented every time
   * engine/actions.ts: applyEndStepTriggers runs, reset to 0 on turn handoff. */
  endStepNumberThisTurn: number;
  /** Set when a millThenReturn effect (e.g. Vanille, Cheerful l'Cie) needs
   * `controllerId` to pick a permanent card out of their graveyard to return
   * to hand - cleared by RETURN_FROM_GRAVEYARD. Only set at all if at least
   * one permanent card is actually available (otherwise nothing to choose). */
  /** `filter: 'auraOrEquipment'` (Red XIII, Proud Warrior's Cosmo Memory)
   * narrows the choice from the default "any permanent card" down to just
   * Aura/Equipment cards; `filter: 'nonAssassinHistoric'` (Elena, Turk
   * Recruit) narrows it to non-Assassin historic cards instead - see
   * engine/actions.ts: returnFromGraveyard. */
  pendingReturnFromGraveyard: { sourceInstanceId: string; controllerId: string; filter?: 'auraOrEquipment' | 'nonAssassinHistoric' | 'equipmentOrVehicle' } | null;
  /** Set while a LootEffect's discard step is outstanding - cleared by
   * DISCARD_CARD once `count` reaches 0 (or the hand runs out first). */
  pendingDiscard: {
    sourceInstanceId: string;
    controllerId: string;
    count: number;
    /** Syphon Mind's "you draw a card for each card discarded this way" -
     * the id of the (different) player who draws, once per card the
     * controller above actually discards. */
    thenCasterDraws?: string;
    /** Summon: Kujata's chapter III - the SAME player (controllerId above,
     * discarding their own card) draws this many afterward. */
    thenDrawCountForDiscarder?: number;
    /** Summon: Kujata's chapter III - each opponent loses life equal to
     * the mana value of whatever was just discarded. */
    thenDamageOpponentsEqualToDiscardedManaValue?: boolean;
    /** Connive (Lethal Scheme) - if the card THIS discard resolves is a
     * NONLAND card, put a +1/+1 counter on this instanceId (the
     * conniving creature). */
    thenCounterOnInstanceIdIfNonland?: string;
    /** Connive (Lethal Scheme) - remaining creatures still to connive
     * after this one; once this discard resolves, draws 1 for the next
     * id in the queue and re-arms pendingDiscard for it (count: 1,
     * thenCounterOnInstanceIdIfNonland: that id), until the queue empties. */
    thenContinueConniveQueue?: string[];
  } | null;
  /** Set while a LookAtTopNPutMToHandRestToBottomEffect is outstanding
   * (Dig Through Time) - `cards` are already off the library;
   * `chosenInstanceIds` accumulates picks for hand until it reaches
   * `keepCount`, then the rest go to the bottom (shuffled). Cleared by
   * RESOLVE_LOOK_AT_TOP_N_PUT_M_TO_HAND_REST_TO_BOTTOM. */
  pendingLookAtTopNPutMToHandRestToBottom: { sourceInstanceId: string; controllerId: string; cards: CardInstance[]; keepCount: number; chosenInstanceIds: string[] } | null;
  /** Set while a RevealTopNThenPutOneOfEachCardTypeToHandEffect is
   * outstanding (Sephiroth, the Savior) - `revealed` cards are already off
   * the library; `takenTypes` accumulates which CardType values have
   * already been used up (one pick per type), `takenInstanceIds` which
   * specific cards were taken. Cleared (remaining `revealed` minus
   * `takenInstanceIds` shuffled to the bottom of the library) by
   * RESOLVE_REVEAL_TOP_N_THEN_PUT_ONE_OF_EACH_CARD_TYPE with a null
   * instanceId, or once every CardType has been taken. */
  pendingRevealTopNThenPutOneOfEachCardType: { sourceInstanceId: string; controllerId: string; revealed: CardInstance[]; takenTypes: CardType[]; takenInstanceIds: string[] } | null;
  /** Set while an OptionalBounceEffect is outstanding - cleared by
   * RESOLVE_OPTIONAL_BOUNCE (either an instanceId to bounce, or null to decline). */
  pendingOptionalBounce: { sourceInstanceId: string; controllerId: string } | null;
  /** Set while a ReturnControlledLandToHandEffect is outstanding (mandatory,
   * no decline option) - cleared by RESOLVE_LAND_BOUNCE. */
  pendingLandBounce: { sourceInstanceId: string; controllerId: string } | null;
  /** Set while a SearchLibraryOrGraveyardForArtifactEffect is outstanding -
   * cleared by RESOLVE_LIBRARY_OR_GRAVEYARD_SEARCH (an instanceId from
   * either the controller's library or graveyard, or null to decline). */
  pendingLibraryOrGraveyardSearch: { sourceInstanceId: string; controllerId: string; maxManaValue: number } | null;
  /** Every outstanding QueueEffectsAtNextEndStepEffect entry - consumed (and
   * cleared) in full by the very next call to engine/actions.ts:
   * applyEndStepTriggers, regardless of whose turn's end step that is. */
  pendingDelayedEndStepEffects: { controllerId: string; sourceInstanceId: string; effects: CardEffect[] }[];
  /** Every outstanding ExilePlayGrant - see engine/actions.ts: castFromExile.
   * Consumed (removed) when the card is actually played; expiresAtCleanup
   * grants are also swept at the cleanup step regardless. */
  exilePlayGrants: ExilePlayGrant[];
  /** Every outstanding "may cast this card from a graveyard, for its
   * normal printed cost, until end of turn" permission (Locke, Treasure
   * Hunter's Mug) - the GRAVEYARD-residing cousin of exilePlayGrants
   * (always expires at cleanup unconditionally; no overrideCostLabel/
   * anyColorMana options since nothing using this yet needs them). See
   * engine/actions.ts: castFromGraveyard (extended to accept a matching
   * grant alongside its existing def.flashback path). */
  graveyardPlayGrants: { instanceId: string; playerId: string }[];
  /** Set while an ExileTopOfTargetPlayerLibraryThenOptionalSacrificeToPlayEffect's
   * "you may sacrifice another creature or artifact" choice is outstanding -
   * cleared by RESOLVE_SACRIFICE_FOR_EXILE_PLAY (an instanceId to sacrifice,
   * or null to decline). See engine/actions.ts: resolveOptionalSacrificeForExilePlay. */
  pendingOptionalSacrificeForExilePlay: { sourceInstanceId: string; controllerId: string; exiledInstanceId: string } | null;
  /** Set while a RevealFilteredEffect is outstanding - cleared by
   * RESOLVE_REVEAL_FILTERED. `revealed` cards are already off the library. */
  pendingRevealFiltered: {
    sourceInstanceId: string;
    controllerId: string;
    revealed: CardInstance[];
    filterType: CardType | CardType[];
    filterSubtype?: string;
    excludeSubtype?: string;
    restDestination?: 'bottomOfLibrary' | 'graveyard';
    takenDestination?: 'hand' | 'battlefieldTapped' | 'battlefieldTappedAttacking' | 'battlefieldUntapped';
    thenGrantsIndestructibleUntilEndOfTurn?: boolean;
  } | null;
  /** Set while a DiscardHandThenDrawByDevotionEffect's "you may" is
   * outstanding - cleared by RESOLVE_OPTIONAL_DISCARD_HAND_FOR_DEVOTION. */
  pendingOptionalDiscardHandForDevotion: { sourceInstanceId: string; controllerId: string; color: ManaColor } | null;
  /** Set while a ChooseOneModeEffect is waiting for its EXACTLY-one pick -
   * cleared by RESOLVE_CHOOSE_ONE_MODE. */
  pendingChooseOneMode: { sourceInstanceId: string; controllerId: string; modes: SpellMode[]; allowBothIfCommander?: boolean } | null;
  /** Set while a DrawCardsFromTargetPlayerEffect is waiting for its player
   * target - cleared by CHOOSE_PLAYER_TARGET. */
  pendingPlayerTarget: {
    sourceInstanceId: string;
    controllerId: string;
    effect:
      | DrawCardsFromTargetPlayerEffect
      | PutCounterOnEachCreatureTargetPlayerControlsEffect
      | MayPutExactNamedCardFromLibraryToHandForTargetPlayerEffect
      | GraveyardToBottomOfLibraryForTargetPlayerEffect
      | GainLifeForTargetPlayerEffect
      | LoseLifeForTargetPlayerEffect
      | SearchLibraryForAnyCardToTopForTargetPlayerEffect;
  } | null;
  /** Set while a RevealOpponentHandChooseNonlandCardThenDiscardEffect
   * (Grief) is outstanding - `controllerId` makes the pick (not the
   * `opponentId` whose hand it is, nor whose card gets discarded).
   * Cleared by RESOLVE_CHOOSE_CARD_FROM_OPPONENT_HAND_TO_DISCARD. */
  pendingChooseCardFromOpponentHandToDiscard: { sourceInstanceId: string; controllerId: string; opponentId: string } | null;
  /** Set while a DivideDamageAmongChosenTargetsEffect (Fury) is being
   * assigned - `remainingDamage` decreases with each pick,
   * `chosenInstanceIds` excludes already-picked creatures from being
   * picked again. Cleared (and the damage dealt) once remainingDamage
   * reaches 0 or no further distinct targets remain. See
   * engine/actions.ts: resolveDivideDamageAmongTargets. */
  pendingDivideDamageAmongTargets: { sourceInstanceId: string; controllerId: string; remainingDamage: number; chosenInstanceIds: string[] } | null;
  /** Set while an AnyPlayerMayPayHalfLifeToCounterThenExtraTurnEffect's
   * choice is outstanding (Temporal Extortion) - `opponentId` is the
   * DECIDER (see that effect's own doc comment for why "any player"
   * simplifies to just the opponent). Cleared by
   * RESOLVE_PAY_HALF_LIFE_TO_COUNTER_CHOICE. */
  pendingPayHalfLifeToCounterChoice: { sourceInstanceId: string; controllerId: string; opponentId: string } | null;
  /** Set while a SearchOpponentLibraryExileFaceDownThenMayPlayEffect
   * (Praetor's Grasp) is outstanding - `controllerId` browses
   * `opponentId`'s library (full information, same as every other library
   * search in this engine). Cleared by
   * RESOLVE_SEARCH_OPPONENT_LIBRARY_TO_EXILE. */
  pendingSearchOpponentLibraryToExile: { sourceInstanceId: string; controllerId: string; opponentId: string } | null;
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
  /** Set while a ReturnInstantOrSorceryFromGraveyardToHandEffect is waiting
   * for its pick - cleared by RESOLVE_RETURN_INSTANT_OR_SORCERY_FROM_GRAVEYARD. */
  pendingReturnInstantOrSorceryFromGraveyard: { sourceInstanceId: string; controllerId: string } | null;
  /** Set while a PutLandFromHandOntoBattlefieldEffect's "you may" choice is
   * outstanding - cleared by RESOLVE_PUT_LAND_FROM_HAND (an instanceId to
   * put onto the battlefield, or null to decline). */
  pendingPutLandFromHand: { sourceInstanceId: string; controllerId: string } | null;
  /** Set while a MayPutTopLandOntoBattlefieldTappedEffect's "you may" choice
   * is outstanding (Explorer's Scope) - only armed once the top card has
   * already been checked and confirmed to be a land. Cleared by
   * RESOLVE_MAY_PUT_TOP_LAND_ONTO_BATTLEFIELD_TAPPED. */
  pendingMayPutTopLandOntoBattlefieldTapped: { sourceInstanceId: string; controllerId: string } | null;
  /** Set while SacrificeOwnCreatureThenDrawEffect's
   * thenPutCreatureAndOrLandFromHand choice is outstanding (Yuna's Decision) -
   * `stage` tracks which of the two independent "you may" choices is
   * currently being offered; picking (or declining, via instanceId: null)
   * the creature stage advances to the land stage, and resolving the land
   * stage clears this entirely. See engine/actions.ts:
   * resolvePutCreatureOrLandFromHand. */
  pendingPutCreatureAndOrLandFromHand: { controllerId: string; stage: 'creature' | 'land' } | null;
  /** Set while a CardDefinition.entersTappedUnlessRevealLandNames check-land
   * choice is outstanding (Fortified Village) - the land itself already
   * entered tapped by the time this is set; revealing a matching card
   * untaps it, declining (instanceId: null) leaves it tapped. See
   * engine/actions.ts: resolveRevealLandTypeFromHand. */
  pendingRevealLandTypeFromHand: { sourceInstanceId: string; controllerId: string; landNames: string[] } | null;
  /** Set while a CastTargetInstantOrSorceryFromGraveyardAnyManaEffect's "you
   * may" choice is outstanding - cleared by RESOLVE_CAST_FROM_GRAVEYARD_ANY_MANA
   * (an instanceId to cast, or null to decline). `ownGraveyardOnly` and
   * `discount` are set only by CardDefinition.onOpponentLoseLifeMayCastFromGraveyardOncePerTurn
   * (Emet-Selch of the Third Seat) - Quistis Trepe's own "a graveyard"
   * (either player's) and full price are the default (both omitted).
   * `instantOnly`/`free`/`ownGraveyardOnly` also carried over directly from
   * CastTargetInstantOrSorceryFromGraveyardAnyManaEffect's own same-named
   * fields (Torrential Gearhulk). */
  pendingCastFromGraveyardAnyMana: { sourceInstanceId: string; controllerId: string; ownGraveyardOnly?: boolean; discount?: number; instantOnly?: boolean; free?: boolean } | null;
  /** Set while a MillThenPutLandIntoHandGainLifeIfTownEffect's "you may put
   * a land from among them into your hand" choice is outstanding -
   * `milledInstanceIds` restricts the legal pick to exactly the cards THIS
   * effect just milled. Cleared by RESOLVE_MILL_THEN_PUT_LAND_INTO_HAND. */
  pendingMillThenPutLandIntoHand: { sourceInstanceId: string; controllerId: string; milledInstanceIds: string[]; lifeGainIfTown: number } | null;
  /** Set while a ReturnCreaturesFromGraveyardToHandEffect is mid-sequence -
   * `remaining` counts down each pick, cleared (by choice or by hitting 0)
   * via RESOLVE_RETURN_CREATURE_FROM_GRAVEYARD. */
  pendingReturnCreaturesFromGraveyard: { sourceInstanceId: string; controllerId: string; remaining: number; anyPermanentInsteadOfCreature?: boolean } | null;
  /** Set while Aerith, Last Ancient's "Raise" end-step trigger is waiting on
   * its graveyard target - `toBattlefield` is decided ONCE at arming time
   * (PlayerState.lifeGainedThisTurn checked against the card's own
   * minLifeGained, nothing changes that between arming and the player's
   * pick) rather than re-checked at resolution. Cleared by
   * RESOLVE_RETURN_CREATURE_FROM_GRAVEYARD_HAND_OR_BATTLEFIELD. */
  pendingReturnCreatureFromGraveyardHandOrBattlefield: { sourceInstanceId: string; controllerId: string; toBattlefield: boolean } | null;
  /** Set while ExileEachOpponentGraveyardThenMayCopyExiledCreatureAsTokenEffect's
   * "choose up to one target creature card exiled this way" is outstanding
   * (Espers to Magicite) - `eligibleInstanceIds` are exactly the creature
   * cards THIS effect just exiled (across every opponent), not every
   * creature card that happens to be in an opponent's exile zone. Cleared
   * by RESOLVE_ESPERS_TO_MAGICITE_CHOICE (an instanceId to copy, or null
   * to decline). */
  pendingEspersToMagiciteChoice: { sourceInstanceId: string; controllerId: string; eligibleInstanceIds: string[] } | null;
  /** Set while NoncreatureCastTrigger.mayPayLifeEqualToManaSpentCreateHeroTokenOncePerTurn's
   * "you may pay X life" is outstanding (G'raha Tia, Scion Reborn's "Throw
   * Wide the Gates") - `manaValue` is fixed at trigger time (the mana spent
   * casting the spell that triggered this). Cleared by
   * RESOLVE_THROW_WIDE_THE_GATES. */
  pendingThrowWideTheGatesChoice: { sourceInstanceId: string; controllerId: string; manaValue: number } | null;
  /** Set while an EachPlayerMayDiscardHandAndDrawThenDamageOpponentsWhoDidEffect
   * is mid-sequence (Snort) - `pendingPlayerIds` is a queue (front = whose
   * turn it is to decide, APNAP order), drained one RESOLVE_SNORT_CHOICE at
   * a time; `discardedPlayerIds` accumulates who actually discarded, read
   * once the queue empties to deal damage to the caster's opponent(s) among
   * them. Cleared once that final damage step resolves. */
  pendingSnortChoice: { sourceInstanceId: string; casterId: string; drawCount: number; damageAmount: number; pendingPlayerIds: string[]; discardedPlayerIds: string[] } | null;
  /** Set while a MogMoogleWarriorDanceEffect is mid-sequence (Mog, Moogle
   * Warrior's Dance) - `pendingPlayerIds` is the same kind of queue as
   * pendingSnortChoice's, drained one RESOLVE_MOG_MOOGLE_WARRIOR_DANCE_CHOICE
   * at a time; `creatureDiscarded`/`noncreatureDiscarded` accumulate
   * whether EITHER player's discard this sequence matched each type,
   * checked once the queue empties to resolve the two bonus effects
   * (always under `controllerId`, i.e. Mog's own controller, regardless of
   * which player actually discarded which card). */
  pendingMogMoogleWarriorDanceChoice: { sourceInstanceId: string; controllerId: string; pendingPlayerIds: string[]; creatureDiscarded: boolean; noncreatureDiscarded: boolean } | null;
  /** Set while an ExileRandomFromEachOpponentGraveyardThenMayCastFreeEffect's
   * "may cast" is outstanding (Kefka, Dancing Mad) - `eligibleInstanceIds`
   * are exactly the cards THIS resolution exiled (never more than one per
   * opponent, so just one entry in this 2-player engine), each consumed
   * one at a time by RESOLVE_KEFKA_CHOICE (cast or decline), re-arming
   * with the remainder until empty. */
  pendingKefkaChoice: { sourceInstanceId: string; controllerId: string; eligibleInstanceIds: string[] } | null;
  /** "Mill three cards. Then starting with the next opponent in turn order,
   * each opponent chooses a creature card in your graveyard that hasn't
   * been chosen. Return each card chosen this way to the battlefield under
   * your control." (Rejoin the Fight) - "each opponent" is just the one
   * opponent in this 2-player engine, so "that hasn't been chosen" never
   * actually matters (there's only ever one pick to make). `casterId` is
   * who the mill/return benefits; `opponentId` is who actually makes the
   * choice - cleared by RESOLVE_REJOIN_THE_FIGHT_CHOICE (an instanceId from
   * casterId's graveyard, or null if there's nothing left to legally pick). */
  pendingRejoinTheFightChoice: { sourceInstanceId: string; casterId: string; opponentId: string } | null;
  /** Set while an EachOpponentMaySacrificeNontokenCreatureElseLoseLifePerInstantSorceryEffect's
   * choice is outstanding (Fandaniel, Telophoroi Ascian) - `opponentId` is
   * the DECIDER, `controllerId` is whose graveyard the life-loss math
   * reads from if they decline. Cleared by RESOLVE_FANDANIEL_CHOICE. */
  pendingFandanielChoice: { sourceInstanceId: string; controllerId: string; opponentId: string; lifePerCard: number } | null;
  /** Set while an OpponentMayHaveYouDrawElseMillAndDealDamageEffect's
   * choice is outstanding (Combustible Gearhulk) - `opponentId` is the
   * DECIDER, `controllerId` draws (if accepted) or deals the damage (if
   * declined, to the decider). Cleared by
   * RESOLVE_OPPONENT_MAY_HAVE_YOU_DRAW_ELSE_MILL_AND_DEAL_DAMAGE. */
  pendingOpponentMayHaveYouDrawElseMillAndDealDamage: { sourceInstanceId: string; controllerId: string; opponentId: string; count: number } | null;
  /** Set at the start of `controllerId`'s upkeep for the first exiled card
   * still carrying CardInstance.pendingReboundNextUpkeep (Rebound) - see
   * ReboundAbility. Cleared by RESOLVE_REBOUND_CHOICE either way (accept
   * or decline); only one such choice is ever offered per upkeep even if
   * multiple Rebound cards are sitting in exile, same "single pending
   * slot" simplification used elsewhere in this engine. */
  pendingReboundChoice: { sourceInstanceId: string; controllerId: string } | null;
  /** The monarch (see BecomeMonarchEffect) - null until someone becomes
   * it, then always exactly one player. Checked at every end step (that
   * player draws an extra card - engine/actions.ts: applyEndStepTriggers)
   * and reassigned whenever a creature deals combat damage to the current
   * monarch (engine/actions.ts: applyCombatDamageToPlayerTriggers), same
   * "steals the monarchy" real rule. Reassignment also releases any
   * exileUntilMonarchChangesFrom entries whose exiler is no longer the
   * (new) monarch. */
  monarchPlayerId: string | null;
  /** Every outstanding ExileTargetCreatureUntilMonarchChangesEffect pick
   * (Palace Jailer) - released (returned to its owner's battlefield)
   * the moment monarchPlayerId changes away from `exilingControllerId`.
   * See engine/actions.ts: wherever monarchPlayerId is reassigned. */
  exileUntilMonarchChangesFrom: { exiledInstanceId: string; ownerPlayerId: string; exilingControllerId: string }[];
  /** Set while an OpponentChoosesOneOfExiledCardsToBottomRestReturnsTappedThenBecomeMonarchEffect
   * (Coin of Fate) is outstanding - `opponentId` (not `controllerId`) is
   * who actually makes the pick, same "the other player decides" shape as
   * pendingFandanielChoice. Cleared by RESOLVE_OPPONENT_CHOOSES_EXILED_CARD,
   * mandatory (no decline - real rule forces a choice between exactly the
   * two already-exiled cards). */
  pendingOpponentChoosesExiledCard: { sourceInstanceId: string; controllerId: string; opponentId: string; exiledInstanceIds: [string, string] } | null;
  /** "For each player, you choose from among the permanents that player
   * controls an artifact, a creature, an enchantment, and a planeswalker.
   * Then each player sacrifices all other nonland permanents they
   * control." (Tragic Arrogance) - this engine has no 'planeswalker'
   * CardType at all, so that exemption slot never has a legal target and
   * is simply never generated. `remainingSteps` walks caster-first, then
   * each other player, one (playerId, cardType) pair at a time - each step
   * omitted up front if that player currently controls zero permanents of
   * that type (nothing to legally exempt). Cleared (and the sacrifice
   * finalized) by RESOLVE_TRAGIC_ARROGANCE_CHOICE once remainingSteps runs
   * out; an instanceId of null on any step just declines that exemption. */
  pendingTragicArroganceChoice: {
    sourceInstanceId: string;
    casterId: string;
    remainingSteps: { playerId: string; cardType: 'artifact' | 'creature' | 'enchantment' }[];
    exemptInstanceIds: string[];
  } | null;
  /** "...then return up to two target Aura and/or Equipment cards from your
   * graveyard to the battlefield attached to that creature." (Unfinished
   * Business) - armed by resolveReanimate once the creature itself
   * resolves; `remaining` starts at 2 and decrements with each pick,
   * auto-clearing once it hits 0 or no eligible card is left. Cleared by
   * RESOLVE_ATTACH_FROM_GRAVEYARD_CHOICE (an instanceId, or null to stop
   * early). */
  pendingAttachFromGraveyardChoice: { sourceInstanceId: string; controllerId: string; attachToInstanceId: string; remaining: number } | null;
  /** Set while a MaySacrificeAnotherNonlandPermanentThenDrawAndOpponentsLoseLifeEqualToManaValueEffect's
   * "you may" is outstanding (Shadow, Mysterious Assassin's Throw) -
   * cleared by RESOLVE_MAY_SACRIFICE_FOR_DRAW_AND_DRAIN_CHOICE (an
   * instanceId to sacrifice, or null to decline). */
  pendingMaySacrificeForDrawAndDrainChoice: { sourceInstanceId: string; controllerId: string; drawCount: number } | null;
  /** Set while an ExileFromOpponentLibraryUntilTypeThenMayCastFreeEffect's
   * "you may cast that card" is outstanding (Strago and Relm's Sketch and
   * Lore) - `foundInstanceId` is the one card the dig actually found (or
   * unset if nothing matched - never armed in that case). Cleared by
   * RESOLVE_STRAGO_AND_RELM_CHOICE (accept or decline). */
  pendingStragoAndRelmChoice: { sourceInstanceId: string; controllerId: string; foundInstanceId: string } | null;
  /** Set while an onCombatDamageToPlayerMayTransform trigger's "you may" is
   * outstanding (Jecht, Reluctant Guardian) - cleared by
   * RESOLVE_OPTIONAL_TRANSFORM. Accepting exiles-and-returns the source
   * transformed via exileAndReturnTransformed; declining just clears this. */
  pendingOptionalTransform: { sourceInstanceId: string; controllerId: string } | null;
  /** Set while RonsoRageEffect's "then you may have [this] become a copy of
   * that creature" is outstanding (Kimahri, Valiant Guardian) - cleared by
   * RESOLVE_OPTIONAL_BECOME_COPY. Accepting sets CardInstance.
   * copiedStatsFromDefId to `copyDefId`; declining just clears this. */
  pendingOptionalBecomeCopy: { sourceInstanceId: string; controllerId: string; copyDefId: string } | null;
  /** Set while PutTargetNonlandPermanentInLibraryOwnersChoiceEffect's target
   * has been chosen and is waiting on its OWNER (not necessarily the
   * caster) to pick top or bottom of their own library - cleared by
   * RESOLVE_LIBRARY_PLACEMENT_CHOICE. `ownerId` is who gets to choose;
   * `targetInstanceId` is still sitting on the battlefield until resolved. */
  pendingLibraryPlacementChoice: { sourceInstanceId: string; casterId: string; ownerId: string; targetInstanceId: string } | null;
  /** Set while a MayPayLifeThenEffect's "you may" is outstanding (Seymour
   * Flux's upkeep trigger) - cleared by RESOLVE_OPTIONAL_PAY_LIFE. Accepting
   * pays lifeCost then resolves effects; declining just clears this. See
   * GameBoard.tsx for the purple "awaiting this choice" outline on the
   * source permanent while set. */
  pendingOptionalPayLife: { sourceInstanceId: string; controllerId: string; lifeCost: number; effects: CardEffect[] } | null;
  /** Set while a MayPayManaThenEffect's "you may" is outstanding (Terra,
   * Herald of Hope's combat-damage trigger; Banon's attack trigger) - the
   * MANA-cost cousin of pendingOptionalPayLife above, cleared by
   * RESOLVE_OPTIONAL_PAY_MANA. Accepting pays manaCost then resolves
   * effects; declining (or being unable to pay) just clears this. */
  pendingOptionalPayMana: { sourceInstanceId: string; controllerId: string; manaCost: string; effects: CardEffect[] } | null;
  /** Set while a MayEffectEffect's "you may" is outstanding (Tidus, Yuna's
   * Guardian's Cheer) - the no-cost cousin of pendingOptionalPayLife above,
   * cleared by RESOLVE_MAY_EFFECT. Accepting resolves effects; declining
   * just clears this. */
  pendingMayEffect: { sourceInstanceId: string; controllerId: string; effects: CardEffect[] } | null;
  /** Set whenever a commander is about to leave the battlefield for
   * anywhere other than the battlefield itself (destroyed, sacrificed,
   * bounced, exiled) - the real "commander replacement effect": its OWNER
   * gets to choose whether it goes to the command zone instead of wherever
   * it was headed, rather than that happening automatically. Both possible
   * outcomes are precomputed at the moment of departure (destinationCard
   * already has whatever reset that specific path normally applies -
   * damage/tapped cleared, etc; commandZoneCard already has the front face
   * reverted and Commander Tax bumped, matching the old automatic-reroute
   * shape) so RESOLVE_COMMANDER_ZONE_CHOICE just has to place one of the
   * two rather than recompute anything. `queued` covers the rare case of
   * more than one commander leaving in the same instant (a board wipe
   * killing both), resolved one at a time in order. See
   * engine/combat.ts: moveCreaturesToGraveyard/beginCommanderZoneChoice. */
  pendingCommanderZoneChoice: {
    ownerId: string;
    destinationZone: 'graveyard' | 'exile' | 'hand';
    destinationCard: CardInstance;
    commandZoneCard: CardInstance;
    queued: { ownerId: string; destinationZone: 'graveyard' | 'exile' | 'hand'; destinationCard: CardInstance; commandZoneCard: CardInstance }[];
  } | null;
  /** Set when CHOOSE_TARGET is about to target a permanent with Ward that
   * its controller doesn't already control (see CardDefinition.wardCost/
   * equipGrantsWard/grantsControlledGroupKeywordsDuringOwnTurn.ward) -
   * `controllerId` is the player doing the TARGETING (who must decide
   * whether to pay), not the warded permanent's controller. `pendingTarget`
   * is deliberately left untouched while this is set, so paying can simply
   * re-run the original targeting; declining clears both. See
   * engine/actions.ts: chooseTarget, resolveWardPayment. */
  pendingWardPayment: { controllerId: string; targetInstanceId: string; wardOwnerId: string; cost: WardCost } | null;
  /** Set right after a spell resolves, if the caster's opponent controls a
   * permanent with onOpponentCastsSpellMayDrawUnlessTheyPay - `payerId` is
   * the CASTER (who decides whether to pay), `controllerId` is the
   * permanent's own controller (who draws if the caster doesn't/can't pay).
   * Cleared by RESOLVE_RHYSTIC_DRAW_PAYMENT. See engine/effects.ts:
   * triggerOpponentCastSpellWatchers, engine/actions.ts:
   * resolveRhysticDrawPayment. */
  pendingRhysticDrawPayment: { payerId: string; controllerId: string; sourceInstanceId: string; cost: number } | null;
  /** Set when DECLARE_ATTACKERS would attack a player whose battlefield has
   * one or more permanents with attacksYouCostGenericUntilNextTurn set
   * (Summon: Yojimbo) - `instanceIds` are the already-legality-checked
   * attackers waiting on this payment, `totalGeneric` is the summed
   * per-creature cost across every such permanent times the number of
   * attackers. Paying re-runs the actual attack declaration (tapping,
   * onAttack triggers, etc. - see engine/actions.ts: finalizeDeclareAttackers);
   * declining simply clears this and leaves the game in declare_attackers,
   * unchanged, for the player to redeclare with fewer/no attackers. */
  pendingAttackTaxPayment: { controllerId: string; instanceIds: string[]; totalGeneric: number } | null;
  /** Queued "you may put N +1/+1 counters on target creature" prompts from
   * CardDefinition.onOtherPermanentDeathTransferCounters (Yuna, Grand
   * Summoner) - a QUEUE (not a single pendingTarget-shaped slot) because
   * several qualifying deaths can happen simultaneously (e.g. a board
   * wipe), each needing its own independent target choice, and because
   * setting this INSIDE moveCreaturesToGraveyard would otherwise collide
   * with whatever pendingTarget flow is already resolving at the call site
   * (nearly every chooseTarget branch unconditionally overwrites
   * pendingTarget: null right after calling moveCreaturesToGraveyardAndTrigger,
   * which would silently wipe out a pendingTarget set from in there). Always
   * resolved from the FRONT of the queue - see engine/actions.ts:
   * resolveCounterTransfer. */
  pendingCounterTransferQueue: { controllerId: string; sourceName: string; amount: number }[];
  /** Set while CardDefinition.equipGrantsDrawThenMayCastFreeUpToCombatDamage's
   * "may cast" half is outstanding (Buster Sword) - cleared by
   * RESOLVE_FREE_CAST_FROM_HAND. Declining (instanceId: null) or casting
   * something both just clear this; there's no "keep going" loop since the
   * card only grants one free cast per hit. */
  pendingFreeCastFromHand: { sourceInstanceId: string; controllerId: string; maxManaValue: number } | null;
  /** "When you next cast a creature spell this turn, [bonus]" (Summon:
   * Fenrir's Heavenward Howl - an extra +1/+1 counter; Summon: Brynhildr's
   * Gestalt Mode - haste) - a delayed one-shot trigger, consumed by the
   * very next creature spell `controllerId` casts (engine/actions.ts:
   * castCard), or cleared unused at cleanup ("this turn" - see
   * applyCleanupResets) if no creature spell follows. Only one can be
   * pending at a time; a second SetPendingNextCreatureSpellBonusEffect
   * before the first is consumed simply overwrites it, matching how real
   * Magic would stack multiple delayed triggers as separate, independent
   * ones - an acceptable simplification since no current card creates two. */
  pendingNextCreatureSpellBonus: { controllerId: string; counterLabel?: string; counterAmount?: number; grantsHaste?: boolean; subtypeFilter?: string } | null;
  /** Set by ArmManaIdentitySourceScryEffect (Path of Ancestry's tap-for-mana
   * trigger) - consumed by `controllerId`'s very next spell cast in
   * engine/actions.ts: castCard, the same "very next cast" approximation
   * pendingNextCreatureSpellBonus uses, see ArmManaIdentitySourceScryEffect's
   * own doc comment for why this can't be true mana-provenance tracking.
   * Cleared on ANY next cast (not just a qualifying creature spell) - unlike
   * pendingNextCreatureSpellBonus, which waits for a qualifying one - since
   * "that mana" is spent (on whatever was cast) either way. */
  pendingManaIdentitySourceScry: { controllerId: string } | null;
  /** Set while a SearchLibraryFor*Effect (or CyclingAbility.searchLandName's
   * land-search half) is waiting on the controller to browse their library
   * and pick a match, or decline and find nothing - cleared by
   * RESOLVE_LIBRARY_SEARCH. `filter` restricts which of the controller's own
   * library cards the client is even allowed to show/pick (see
   * engine/effects.ts: matchesLibrarySearchFilter) - there's no way to see
   * or choose anything outside it, same as a real "search for a [type]
   * card" only ever finding that type. `reveal` is true for every current
   * caller (all of them say "reveal it" in their printed text) - the found
   * card is shown to the opponent too and marked with
   * CardInstance.revealedToOpponentWhileInHand, rather than silently
   * appearing in hand. */
  /** `toBattlefieldTapped`: "search for a [X] card, PUT IT ONTO THE
   * BATTLEFIELD tapped" (Summon: Fenrir's Crescent Fang) instead of the
   * default "...put it into your hand" - every other current caller omits
   * this (defaults to hand). See engine/actions.ts: resolveLibrarySearch. */
  pendingLibrarySearch: {
    sourceInstanceId: string;
    controllerId: string;
    filter: LibrarySearchFilter;
    reveal: boolean;
    toBattlefieldTapped?: boolean;
    /** See SearchLibraryForSubtypeEffect.toBattlefieldUntapped. */
    toBattlefieldUntapped?: boolean;
    /** "...then shuffles and puts that card on top." (Ardyn Izunia's
     * Boast) - the found card goes on top of the REST of the library,
     * shuffled first (so it isn't shuffled back in alongside it), instead
     * of to hand/battlefield. See engine/actions.ts: resolveLibrarySearch. */
    toTopOfLibrary?: boolean;
    /** "Search for up to N ... with different names" (Reach the Horizon) -
     * how many MORE picks remain after the one currently being made; a
     * completed pick re-arms pendingLibrarySearch with this decremented
     * (rather than clearing it) as long as it's still positive. Omitted for
     * every ordinary single-pick search. */
    remainingPicks?: number;
    /** Names already picked earlier in the same multi-pick chain - excluded
     * from matching on every subsequent pick ("with different names"). Never
     * populated at all when allowDuplicateNames is set (see below), so the
     * "already found a card with that name" rejection in
     * engine/actions.ts: resolveLibrarySearch never triggers for those
     * searches. */
    excludeNames?: string[];
    /** "Search for up to N basic land cards... put them onto the
     * battlefield" (Rampant Rejuvenator) - unlike Reach the Horizon's
     * "different names" (the ONLY multi-pick precedent before this), a plain
     * "up to N" search with no "different names" clause stated must allow
     * repeats (two Plains is perfectly legal). Set by whichever effect
     * resolver arms a multi-pick search that doesn't want the default
     * different-names restriction - see engine/effects.ts:
     * searchLibraryForUpToXBasicLandsEqualToPower's resolution for the
     * current example, and reuse this same flag for any future "search for
     * up to N [[basic land/other repeatable type]]" card rather than adding
     * a parallel pending-state shape. */
    allowDuplicateNames?: boolean;
    /** "If an opponent controls more lands than you, you may put that card
     * onto the battlefield tapped. If you don't, put it into your hand."
     * (Scholar of New Horizons) - the GENERAL "this search always finds
     * something, then the controller may choose to put it onto the
     * battlefield instead of its default destination" shape: when set, the
     * controller supplies RESOLVE_LIBRARY_SEARCH's own toBattlefieldTapped
     * at pick time instead of this object's own (fixed)
     * toBattlefieldTapped/toBattlefieldUntapped applying. The printed
     * card's "if [condition]" gate is evaluated ONCE, before the search
     * even begins (see engine/effects.ts:
     * searchLibraryForLandConditionalBattlefieldIfOpponentHasMoreLands's
     * resolution) - this flag is only ever true/false for the WHOLE search,
     * never re-evaluated per pick. Reusable as-is for any future "search for
     * [X], then you may put it onto the battlefield instead" card, whatever
     * that card's own gating condition turns out to be. */
    mayChooseBattlefieldTapped?: boolean;
    /** "That land's controller may search... You may also search..."
     * (Demolition Field) - once THIS search resolves (found or declined),
     * immediately arm a second pendingLibrarySearch for this player id,
     * same filter/destination, rather than overloading the single
     * pendingLibrarySearch slot to run two players' searches at once (it
     * can only ever hold one). See engine/actions.ts: resolveLibrarySearch. */
    chainedSearchForPlayerId?: string;
    /** "...put one onto the battlefield tapped and the other into your
     * hand" (Cultivate) - once THIS search (armed to go to the battlefield
     * tapped) resolves (found or declined), arms a SECOND search for the
     * SAME player/filter/source but with no battlefield destination set
     * (defaults to hand), same "chain into a second, differently-shaped
     * search" idea as chainedSearchForPlayerId just above, just for a
     * different DESTINATION on the SAME player rather than a different
     * player. See CultivateEffect, engine/actions.ts: resolveLibrarySearch. */
    chainedSearchToHand?: boolean;
  } | null;
  /** Set once, right when a card is revealed to the opponent (currently only
   * via a pendingLibrarySearch pick) - purely a "show a passing notification
   * of what just got revealed" signal for the client (same shape as
   * lastCoinFlip), not a running log. `sourceInstanceId` is whatever caused
   * the reveal (e.g. World Map), so the notification can caption "revealed
   * from [source]". */
  lastReveal: { instanceId: string; ownerId: string; sourceInstanceId: string } | null;
  /** Set while an ExileTargetGraveyardCardEffect is waiting for its pick of a
   * card in ANY graveyard (Ignis Scientia) - cleared by
   * RESOLVE_GRAVEYARD_EXILE. `createFoodTokenIfCreature` mirrors the source
   * effect's flag so the resolver knows whether to spawn a token-food. The
   * remaining fields mirror the same-named ones on ExileTargetGraveyardCardEffect
   * (Summoner's Sending's "you may exile target CREATURE card..."). */
  pendingGraveyardExile: {
    sourceInstanceId: string;
    controllerId: string;
    createFoodTokenIfCreature?: boolean;
    creatureOnly?: boolean;
    instantOrSorceryOnly?: boolean;
    optional?: boolean;
    thenCreateToken?: { tokenId: string; counterIfManaValueAtLeast?: { value: number; counterLabel: string; counterAmount: number } };
  } | null;
  /** Set while a DiscardUpToThenDrawThatManyEffect's discard step is
   * outstanding (Joshua, Phoenix's Dominant) - `discardedSoFar` counts up
   * each DISCARD_UP_TO_THEN_DRAW pick, `maxCount` caps it; declining further
   * (instanceId: null) or hitting maxCount both move straight to drawing
   * discardedSoFar cards and clear this. */
  pendingDiscardUpToThenDraw: { sourceInstanceId: string; controllerId: string; maxCount: number; discardedSoFar: number; plusOne?: boolean } | null;
  /** Set while a RevealTopThenLoseLifeByManaValueEffect (Dark Confidant) is
   * outstanding - the top card is revealed (publicly - both players can see
   * `revealedCard`, unlike a private SurveilEffect peek) and already off the
   * library, but not yet in hand and the life loss hasn't happened yet. The
   * controller picks it up with RESOLVE_REVEAL_PICKUP, which moves it to
   * hand, applies the life loss, records it on the source's
   * CardInstance.revealedCardIds, and (if `queuedSourceIds` isn't empty) pops
   * the next source and reveals ITS current top card the same way - so two
   * copies of this effect triggering in the same upkeep resolve one at a
   * time against the real, currently-on-top card, never both revealing the
   * same one. See engine/effects.ts: beginRevealPickup. */
  pendingRevealPickup: { sourceInstanceId: string; controllerId: string; revealedCard: CardInstance; queuedSourceIds: string[] } | null;
  /** Set while a CoinFlipEffect (The Gold Saucer) is waiting on the
   * controller to call heads or tails - cleared (and resolved in the same
   * step) by CHOOSE_COIN_SIDE. See engine/actions.ts: chooseCoinSide. */
  pendingCoinFlip: { sourceInstanceId: string; controllerId: string; ifWinEffects: CardEffect[] } | null;
  /** The most recent coin flip's outcome (CoinFlipEffect) - purely for the
   * client to animate/reveal (components/CoinFlipModal.tsx); the actual
   * game-state changes from winning already happened by the time this is
   * set, in the same CHOOSE_COIN_SIDE step. `id` is fresh every flip so the
   * client can tell a genuinely new flip apart from the same one still
   * sitting here after a re-render or reconnect, and only animate once per
   * flip. Never cleared afterward - harmless to leave around, same as
   * GameState.log entries. */
  lastCoinFlip: { id: string; sourceInstanceId: string; controllerId: string; called: 'heads' | 'tails'; result: 'heads' | 'tails'; won: boolean } | null;
  /** Set while a HideawayEffect (Clive's Hideaway) is waiting on the
   * controller to pick which of the looked-at cards to exile face down -
   * `cards` are already off the library (so they don't show up there in the
   * meantime), same as pendingSurveil. Cleared by RESOLVE_HIDEAWAY, which
   * also puts the rest on the bottom of the library in a random order. */
  pendingHideaway: { sourceInstanceId: string; controllerId: string; cards: CardInstance[] } | null;
  /** General "notice when a SPECIFIC permanent leaves the battlefield, by
   * ANY means" primitive (Zenos yae Galvus's "When the chosen creature
   * leaves the battlefield, transform Zenos yae Galvus", and reusable by any
   * future "until it leaves the battlefield"/"when it leaves the
   * battlefield" card - e.g. White Auracite). Checked after EVERY action
   * (see engine/actions.ts: checkBattlefieldLeaveWatchers) by comparing
   * before/after state - a single before/after diff over every action,
   * rather than instrumenting each of the many individual places a
   * permanent can leave the battlefield (combat death, sacrifice, bounce,
   * exile, put on a library, ...), so a new departure path can never
   * silently fail to notify a watcher. Entries are one-shot: removed the
   * moment `watchedInstanceId` is noticed gone from every battlefield,
   * regardless of destination (leaving and later re-entering does NOT
   * re-arm it - something would have to set up a fresh watch). */
  battlefieldLeaveWatchers: { watcherInstanceId: string; watchedInstanceId: string; controllerId: string; effects: CardEffect[] }[];
  /** "Exile target creature ... until [this] leaves the battlefield" (Auron,
   * Venerated Guardian's Shooting Star) - a real "O-Ring" style linked
   * exile. Deliberately separate from battlefieldLeaveWatchers above: that
   * mechanism skips its own effects entirely if the WATCHER also left the
   * battlefield in the same instant, which is exactly what happens here
   * (the watched permanent and the exiling source are the SAME card, so by
   * definition the "watcher" is always gone by the time this would fire).
   * Checked after every action the same before/after-diff way (see
   * engine/actions.ts: checkExileUntilSourceLeaves), just unconditional on
   * the source's own presence - returning the exiled card doesn't need
   * anything from the source. Reusable by any future "until this leaves the
   * battlefield" exile card (e.g. White Auracite, not yet wired up to
   * this). */
  exileUntilSourceLeaves: { sourceInstanceId: string; exiledInstanceId: string }[];
}

export type GameAction =
  | { type: 'DRAW_CARD' }
  | { type: 'MOVE_CARD'; instanceId: string; toZone: ZoneName }
  | { type: 'SHUFFLE_LIBRARY' }
  | { type: 'TOGGLE_TAP'; instanceId: string; chosenColor?: ManaColor }
  | {
      type: 'CAST_CARD';
      instanceId: string;
      chosenX?: number;
      chosenModeIndices?: number[];
      chosenTierIndex?: number;
      kickerPaymentInstanceId?: string;
      /** CardDefinition.kicker's 'mana' variant payment choice (Rite of
       * Replication's "Kicker {5}") - omitted/false declines; ignored
       * unless the card's kicker.cost is actually 'mana'. */
      payManaKicker?: boolean;
      /** CardDefinition.escalateCost's payment - one OTHER untapped creature
       * per mode chosen beyond the first (Collective Effort). Ignored unless
       * the card actually has escalateCost set. */
      escalateCostInstanceIds?: string[];
      /** CardDefinition.multikickerCost's payment count - how many times it
       * was paid (0/omitted declines it entirely). Ignored unless the card
       * actually has multikickerCost set. */
      chosenMultikickerCount?: number;
      /** CardDefinition.convoke's payment - the controller's own untapped
       * creatures tapped to help pay this cast's cost. Omitted/empty just
       * pays the full cost in mana, same as not having Convoke at all. */
      convokeInstanceIds?: string[];
      /** "You may pay [lifeCost] life rather than pay this spell's mana
       * cost." (Snuff Out) - requested explicitly; no silent fallback to
       * normal mana payment if CardDefinition.alternateCastCostPayLifeIfControlLandName's
       * land condition isn't met. */
      payAlternateLifeCost?: boolean;
      /** "Delve" (see CardDefinition.delve) - own graveyard cards to
       * exile, each covering {1} of generic cost. Ignored unless the
       * card actually has delve set; must not exceed the generic cost. */
      delveInstanceIds?: string[];
      /** "Improvise" (see CardDefinition.grantsImproviseToNonartifactSpells) -
       * the controller's own untapped ARTIFACTS tapped to help pay this
       * cast's GENERIC cost, same shape as convokeInstanceIds but for
       * artifacts instead of creatures and no color-matching (always
       * generic only, same as real Improvise). Ignored unless the
       * controller actually has a permanent granting it AND this spell is
       * itself nonartifact; must not exceed the generic cost. */
      improviseInstanceIds?: string[];
      /** "Evoke—Exile a [color] card from your hand." (see
       * CardDefinition.evokeCost) - the specific OTHER card in hand to
       * exile as an alternate TOTAL cost; requested explicitly, no silent
       * fallback to normal mana payment if it doesn't match the required
       * color. Ignored unless the card actually has evokeCost set. */
      evokeExileInstanceId?: string;
      /** CardDefinition.additionalCostSacrifice's payment (Baron Rivalry) -
       * the controller's own permanent to sacrifice, matching the filter.
       * Ignored unless the card actually has additionalCostSacrifice set. */
      sacrificeCostInstanceId?: string;
      /** Phyrexian mana payment split (see ParsedCost.phyrexian) - how many
       * of each color's Phyrexian pips to pay with 2 life each instead of
       * mana. Ignored unless the card's own cost actually has Phyrexian
       * pips of that color. */
      phyrexianLifePayments?: Partial<Record<Exclude<ManaColor, 'C'>, number>>;
      /** CardDefinition.spectacleCost's payment (A Promise Fulfilled) -
       * requested explicitly; ignored unless the card actually has
       * spectacleCost set. */
      payAlternateSpectacleCost?: boolean;
    }
  | { type: 'ACTIVATE_ABILITY'; instanceId: string; abilityId: string; costTargetInstanceIds?: string[] }
  | { type: 'ADJUST_LIFE'; playerId: string; delta: number }
  | { type: 'ADJUST_COUNTER'; instanceId: string; label: string; delta: number }
  | { type: 'FLIP_CARD'; instanceId: string }
  | { type: 'ATTACH_CARD'; instanceId: string; targetInstanceId: string }
  | { type: 'DETACH_CARD'; instanceId: string }
  | { type: 'DECLARE_ATTACKERS'; instanceIds: string[] }
  | { type: 'DECLARE_BLOCKERS'; assignments: CombatAssignment[] }
  | { type: 'ORDER_BLOCKERS'; attackerInstanceId: string; orderedBlockerIds: string[] }
  | {
      type: 'CHOOSE_TARGET';
      targetInstanceId: string | null;
      /** Chooses a PLAYER instead of a permanent - only legal for a pendingTarget
       * effect that explicitly accepts one (DealDamageToAnyOtherTargetAndSelfEffect's
       * second pick, or DamageAnyTargetEffect's single pick). Mutually
       * exclusive with targetInstanceId; omit/leave undefined for every
       * ordinary permanent-only pendingTarget effect. */
      targetPlayerId?: string;
    }
  | { type: 'RESOLVE_OPTIONAL_DISCARD_HAND_FOR_DEVOTION'; accept: boolean }
  | { type: 'RESOLVE_CHOOSE_ONE_MODE'; modeIndex: number; alsoModeIndex?: number }
  | {
      type: 'CHOOSE_PLAYER_TARGET';
      /** null declines - only legal for an "up to one target player" effect
       * (GraveyardToBottomOfLibraryForTargetPlayerEffect); every other
       * current pendingPlayerTarget effect is mandatory and rejects null.
       * See engine/actions.ts: choosePlayerTarget. */
      targetPlayerId: string | null;
    }
  | { type: 'CYCLE_CARD'; instanceId: string }
  | { type: 'CHOOSE_REVEALED_CARD'; instanceId: string }
  | { type: 'CHOOSE_MANA_COLOR'; color: ManaColor }
  | { type: 'CHOOSE_CREATURE_TYPE'; creatureType: string }
  | { type: 'CHOOSE_NUMBER'; number: number }
  | { type: 'RESOLVE_ADD_MANA_OF_CHOSEN_COLOR'; color: ManaColor }
  | { type: 'CHOOSE_SACRIFICE'; instanceId: string }
  | { type: 'CHOOSE_KEEP_ONE_SACRIFICE_REST'; instanceId: string }
  | { type: 'CHOOSE_UP_TO_N_CREATURES_SACRIFICE_REST'; instanceId: string | null }
  | { type: 'RESOLVE_SCRY_BEFORE_EXILE'; toBottom: boolean }
  | { type: 'RESOLVE_SURVEIL'; graveyardIds: string[]; keepOrder: string[] }
  | { type: 'RESOLVE_EXPLORE'; toGraveyard: boolean }
  | { type: 'RETURN_FROM_GRAVEYARD'; instanceId: string }
  | { type: 'DISCARD_CARD'; instanceId: string }
  | { type: 'RESOLVE_OPTIONAL_BOUNCE'; instanceId: string | null }
  | { type: 'RESOLVE_LAND_BOUNCE'; instanceId: string }
  | { type: 'RESOLVE_LIBRARY_OR_GRAVEYARD_SEARCH'; instanceId: string | null }
  | { type: 'CAST_FROM_EXILE'; instanceId: string; chosenX?: number }
  | { type: 'RESOLVE_SACRIFICE_FOR_EXILE_PLAY'; instanceId: string | null }
  | { type: 'RESOLVE_REVEAL_FILTERED'; instanceId: string | null }
  | { type: 'CREW_VEHICLE'; instanceId: string; crewInstanceIds: string[] }
  | { type: 'CAST_FROM_GRAVEYARD'; instanceId: string; chosenX?: number }
  | { type: 'RESOLVE_REANIMATE'; instanceId: string | null }
  | { type: 'RESOLVE_RETURN_INSTANT_OR_SORCERY_FROM_GRAVEYARD'; instanceId: string }
  | { type: 'RESOLVE_PUT_LAND_FROM_HAND'; instanceId: string | null }
  | { type: 'RESOLVE_MAY_PUT_TOP_LAND_ONTO_BATTLEFIELD_TAPPED'; accept: boolean }
  | { type: 'RESOLVE_CAST_FROM_GRAVEYARD_ANY_MANA'; instanceId: string | null }
  | { type: 'CAST_ARTIFACT_FROM_GRAVEYARD_FOR_LIFE'; instanceId: string; sourceInstanceId: string }
  | { type: 'RESOLVE_MILL_THEN_PUT_LAND_INTO_HAND'; instanceId: string | null }
  | { type: 'RESOLVE_RETURN_CREATURE_FROM_GRAVEYARD'; instanceId: string | null }
  | { type: 'RESOLVE_RETURN_CREATURE_FROM_GRAVEYARD_HAND_OR_BATTLEFIELD'; instanceId: string | null }
  | { type: 'RESOLVE_ESPERS_TO_MAGICITE_CHOICE'; instanceId: string | null }
  | { type: 'RESOLVE_THROW_WIDE_THE_GATES'; accept: boolean }
  | { type: 'RESOLVE_SNORT_CHOICE'; accept: boolean }
  | { type: 'RESOLVE_KEFKA_CHOICE'; instanceId: string | null }
  | { type: 'RESOLVE_REJOIN_THE_FIGHT_CHOICE'; instanceId: string | null }
  | { type: 'RESOLVE_TRAGIC_ARROGANCE_CHOICE'; instanceId: string | null }
  | { type: 'RESOLVE_ATTACH_FROM_GRAVEYARD_CHOICE'; instanceId: string | null }
  | { type: 'CAST_WITH_OVERLOAD'; instanceId: string }
  | { type: 'CAST_WITH_BLITZ'; instanceId: string; discardInstanceId: string }
  | { type: 'CAST_WITH_DASH'; instanceId: string }
  | { type: 'RESOLVE_REVEAL_TOP_N_THEN_PUT_ONE_OF_EACH_CARD_TYPE'; instanceId: string | null }
  | { type: 'RESOLVE_MAY_SACRIFICE_FOR_DRAW_AND_DRAIN_CHOICE'; instanceId: string | null }
  | { type: 'RESOLVE_STRAGO_AND_RELM_CHOICE'; accept: boolean }
  | { type: 'ACTIVATE_UNEARTH'; instanceId: string }
  | { type: 'RESOLVE_MOG_MOOGLE_WARRIOR_DANCE_CHOICE'; instanceId: string | null }
  | { type: 'RESOLVE_FANDANIEL_CHOICE'; instanceId: string | null }
  | { type: 'RESOLVE_REBOUND_CHOICE'; accept: boolean }
  | { type: 'RESOLVE_LOOK_AT_TOP_N_PUT_M_TO_HAND_REST_TO_BOTTOM'; instanceId: string | null }
  | { type: 'RESOLVE_OPPONENT_CHOOSES_EXILED_CARD'; instanceId: string }
  | { type: 'RESOLVE_OPPONENT_MAY_HAVE_YOU_DRAW_ELSE_MILL_AND_DEAL_DAMAGE'; accept: boolean }
  | { type: 'RESOLVE_CHOOSE_CARD_FROM_OPPONENT_HAND_TO_DISCARD'; instanceId: string }
  | { type: 'RESOLVE_DIVIDE_DAMAGE_AMONG_TARGETS'; instanceId: string | null; amount?: number }
  | { type: 'RESOLVE_PAY_HALF_LIFE_TO_COUNTER_CHOICE'; accept: boolean }
  | { type: 'RESOLVE_SEARCH_OPPONENT_LIBRARY_TO_EXILE'; instanceId: string | null }
  | { type: 'RESOLVE_OPTIONAL_TRANSFORM'; accept: boolean }
  | { type: 'RESOLVE_OPTIONAL_BECOME_COPY'; accept: boolean }
  | { type: 'RESOLVE_LIBRARY_PLACEMENT_CHOICE'; toTop: boolean }
  | { type: 'RESOLVE_OPTIONAL_PAY_LIFE'; accept: boolean }
  | { type: 'RESOLVE_OPTIONAL_PAY_MANA'; accept: boolean }
  | { type: 'CAST_CREATURE_FROM_GRAVEYARD_VIA_GRANT'; instanceId: string }
  | { type: 'CAST_ARTIFACT_FROM_GRAVEYARD_VIA_GRANT'; instanceId: string }
  | { type: 'CAST_FROM_LIBRARY_TOP'; instanceId: string; chosenX?: number }
  | { type: 'FORETELL_CARD'; instanceId: string }
  | { type: 'ACTIVATE_NINJUTSU'; instanceId: string; returnInstanceId: string }
  | { type: 'RESOLVE_MAY_EFFECT'; accept: boolean }
  | { type: 'RESOLVE_COMMANDER_ZONE_CHOICE'; toCommandZone: boolean }
  | { type: 'RESOLVE_WARD_PAYMENT'; pay: boolean }
  | { type: 'RESOLVE_RHYSTIC_DRAW_PAYMENT'; pay: boolean }
  | { type: 'RESOLVE_ATTACK_TAX_PAYMENT'; pay: boolean }
  | { type: 'RESOLVE_COUNTER_TRANSFER'; targetInstanceId: string | null }
  | { type: 'RESOLVE_PUT_CREATURE_OR_LAND_FROM_HAND'; instanceId: string | null }
  | { type: 'RESOLVE_REVEAL_LAND_TYPE_FROM_HAND'; instanceId: string | null }
  | { type: 'RESOLVE_FREE_CAST_FROM_HAND'; instanceId: string | null }
  | {
      type: 'RESOLVE_LIBRARY_SEARCH';
      instanceId: string | null;
      /** Only consulted when GameState.pendingLibrarySearch.
       * mayChooseBattlefieldTapped is set (Scholar of New Horizons' "you may
       * put that card onto the battlefield tapped") - the controller's own
       * choice of destination for THIS pick, made at the same time as the
       * card pick itself. Ignored (and the pending search's own fixed
       * toBattlefieldTapped/toBattlefieldUntapped applies as normal) for
       * every ordinary search that doesn't offer this choice. */
      toBattlefieldTapped?: boolean;
    }
  | { type: 'RESOLVE_GRAVEYARD_EXILE'; instanceId: string | null }
  | { type: 'DISCARD_UP_TO_THEN_DRAW'; instanceId: string | null }
  | { type: 'RESOLVE_REVEAL_PICKUP' }
  | { type: 'CHOOSE_COIN_SIDE'; side: 'heads' | 'tails' }
  | { type: 'RESOLVE_HIDEAWAY'; instanceId: string }
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