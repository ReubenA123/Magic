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
     * controller picks WHICH one(s) client-side before dispatching, and they
     * arrive baked into the ACTIVATE_ABILITY action as costTargetInstanceIds
     * (unlike exileFromGraveyard, this choice is strategically meaningful
     * enough that auto-selecting it wouldn't be right). See
     * engine/actions.ts: activateAbility. */
    sacrificeAnother?: 'creature' | 'artifact' | 'artifactOrCreature';
    /** How many "another creature/artifact" permanents sacrificeAnother
     * requires - defaults to 1. The Gold Saucer's "Sacrifice two artifacts"
     * needs 2. */
    sacrificeAnotherCount?: number;
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
  /** A precondition (not a cost) - the controller must control at least this
   * many legendary creatures for the ability to be legal at all (Clive's
   * Hideaway: "if you control four or more legendary creatures"). Checked
   * the same way checkLegendRule and other "legendary" checks elsewhere
   * already do: def.subtype?.toLowerCase().includes('legendary'). */
  requiresControlledLegendaryCreatureCount?: number;
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
  count?: number | 'perCreatureYouControl' | 'perCreatureCardInYourGraveyard';
  tapped?: boolean;
  /** Job select style: attach the permanent generating this effect to the
   * (single) token it just created. Only meaningful when count resolves to 1. */
  attachSelfToToken?: boolean;
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
    | 'creature';
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
  /** "If that creature would die this turn, exile it instead" (Suplex) - a
   * one-shot replacement checked right after this specific damage is dealt,
   * distinct from CardDefinition-level death redirects (onDeathExileAndCreateTokens,
   * a Finality counter, ...) since it isn't a property of the creature
   * itself, just this one attack. See engine/actions.ts: chooseTarget's
   * damageTargetCreature branch. */
  exileIfDies?: boolean;
}

/** "Exile target [filter]" (Suplex's "Exile target artifact") - the exile
 * counterpart to DestroyTargetEffect, kept separate (rather than adding an
 * `exileInsteadOfDestroy` flag there) since exiling is a distinct zone
 * change from destroying, not just a flavor difference. */
export interface ExileTargetPermanentEffect {
  type: 'exileTargetPermanent';
  targetFilter: 'artifact' | 'creature' | 'anyPermanent' | 'nonlandPermanent' | 'artifactEnchantmentOrTappedCreature';
  /** "...an opponent controls" (Summon: Yojimbo's chapter I) - every other
   * targetFilter above has no owner restriction at all, so this only ever
   * needs checking when set. */
  opponentControlledOnly?: boolean;
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
   * and, if it's a land, landfall - see engine/actions.ts: resolveRevealFiltered. */
  takenDestination?: 'hand' | 'battlefieldTapped';
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
}

/** "Search your library for a land card, reveal it, put it into your hand,
 * then shuffle" (World Map) - the ANY-land counterpart to
 * SearchLibraryForBasicLandEffect above, matching every CardDefinition.type
 * === 'land', basic or not. */
export interface SearchLibraryForAnyLandEffect {
  type: 'searchLibraryForAnyLand';
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
  | { kind: 'basicLandOrSubtype'; subtype: string };

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
}

/** "Permanents you control gain [keyword, keyword] until end of turn"
 * (Restoration Magic's Curaga tier) - the board-wide, no-targeting
 * counterpart to GrantKeywordsToTargetPermanentEffect. */
export interface GrantKeywordsToControlledPermanentsEffect {
  type: 'grantKeywordsToControlledPermanents';
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
  /** Defaults to 'creature'. 'nonlandPermanent' widens legal targets to
   * "target nonland permanent" (Ring of the Lucii). */
  targetFilter?: 'creature' | 'nonlandPermanent';
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

/** "Put a [counterLabel] counter on each creature target player controls"
 * (Collective Effort) - the second effect in this engine to target a
 * PLAYER rather than a permanent, same GameState.pendingPlayerTarget/
 * 'CHOOSE_PLAYER_TARGET' flow as DrawCardsFromTargetPlayerEffect above. */
export interface PutCounterOnEachCreatureTargetPlayerControlsEffect {
  type: 'putCounterOnEachCreatureTargetPlayerControls';
  counterLabel: string;
  counterAmount: number;
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
   * effectiveChosenX). */
  counterAmount: number | 'chosenX';
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
   * permanent, either player's). */
  targetFilter: 'nonland' | 'creature';
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
  /** "...to the battlefield TAPPED" (Phoenix Down) - overrides
   * CardDefinition.entersTapped regardless of what the card itself says. */
  forceEntersTapped?: boolean;
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
}

/** "Each opponent loses N life" (Summon: Anima's Oblivion chapter) - unlike
 * EachPlayerLosesLifeEffect (both players) or LoseLifeEffect (the caster
 * only), this hits just the opponent; 2-player-only engine, so "each
 * opponent" is simply the one. */
export interface EachOpponentLosesLifeEffect {
  type: 'eachOpponentLosesLife';
  amount: number;
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

/** "Destroy all artifacts and creatures" (Ultima) - unlike DestroyTargetEffect,
 * no targeting at all; hits every matching permanent on BOTH battlefields,
 * respecting indestructible per permanent. */
export interface DestroyAllEffect {
  type: 'destroyAll';
  targetFilter: 'artifactAndCreature' | 'artifactAndEnchantment' | 'creatureWithNoCounters';
  /** "Put a [counterLabel] counter on this creature for each permanent
   * destroyed this way" (Bane of Progress) - counts only permanents that
   * actually died here (indestructible/Shield-saved ones don't count),
   * puts that many counters on sourceInstanceId. */
  thenCounterSelfLabel?: string;
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
  | UntapTargetAttackerEffect
  | PutStunCounterOnTargetAttackerEffect
  | TapStunAndGainLifeForNonbasicLandsEffect
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
  | HideawayEffect
  | DamageEqualToEquippedCreaturesEffect
  | SearchLibraryForLandEffect
  | SearchLibraryForBasicLandEffect
  | SearchLibraryForBasicLandOrSubtypeEffect
  | SearchLibraryForAnyLandEffect
  | PumpTargetEffect
  | GrantKeywordToOtherAttackersEffect
  | LoseLifeEffect
  | EachPlayerLosesLifeEffect
  | PumpControlledSubtypeEffect
  | PutCounterOnTargetEffect
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
  | ChooseOneModeEffect
  | DrawCardsFromTargetPlayerEffect
  | PutCounterOnEachCreatureTargetPlayerControlsEffect
  | PutCounterOnUpToOneOwnCreatureEffect
  | AttachSelfToTargetEffect
  | RevealTopThenLoseLifeByManaValueEffect
  | MayPayLifeThenEffect
  | MayEffectEffect
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
  | ExileTopOfTargetPlayerLibraryThenOptionalSacrificeToPlayEffect
  | ChooseCreatureDealsDamageToOpponentCreatureEffect
  | IfKickedEffect
  | IfControlAtLeastCreaturesEffect
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
  | MillThenPutLandIntoHandGainLifeIfTownEffect
  | ExileThenReturnTargetOwnCreatureEffect
  | QueueExtraEndStepIfFirstEndStepOfTurnEffect
  | AttachAllControlledEquipmentToTargetCreatureEffect
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
  | BecomeCopyOfAnyCreatureThenAddCountersEffect
  | CreateTokenIfNotControllingNamedEffect
  | DebuffOpponentCreaturesEffect
  | MillSelfEffect
  | DamageTargetCreatureEqualToCreaturesAndEquipmentEffect
  | TapAllOpponentCreaturesEffect
  | DestroyAllEffect
  | DamageEachCreatureEffect
  | DamageEachOpponentEqualToGraveyardNoncreatureNonlandCountEffect
  | GrantKeywordsToTargetPermanentEffect
  | GrantKeywordsToControlledPermanentsEffect
  | GainControlOfTargetCreatureEffect
  | GiveControlOfAnotherOwnPermanentToOpponentEffect
  | GainControlOfTargetEquipmentAndAttachEffect
  | SetPendingNextCreatureSpellBonusEffect
  | CreateTokenIfControlledSubtypeCountAtLeastEffect
  | BuffOtherCreaturesYouControlByControlledSubtypeCountEffect
  | MillEachOpponentByYourHandSizeEffect
  | DamageTargetCreatureEqualToOtherControlledSubtypePowerEffect
  | SearchLibraryForSubtypeEffect
  | ExileTopOfEachOpponentLibraryEffect
  | DamageAnyTargetEffect
  | SupportEffect
  | GrantOnDeathReturnToHandToTargetEffect
  | DestroyUpToOneOpponentArtifactThenPutCounterOnSelfEffect
  | IfCounterPutOnSelfThisTurnEffect;

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
  producesMana?: ManaColor | 'any' | ManaColor[] | 'commanderColorIdentity';
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
  /** "Whenever an opponent attacks you, ..." (Lulu, Stern Guardian) - the
   * DEFENDER's counterpart to onAttack above: fires once per permanent that
   * has it (not once per attacker), whenever the opponent declares one or
   * more attackers, regardless of who/how many. See engine/actions.ts:
   * declareAttackers, checked against the DEFENDING player's battlefield. */
  onOpponentAttacksYou?: CardEffect[];
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
  /** "During your turn, as long as [this] is equipped, it has [keywords]"
   * (Cloud, Planet's Champion's double strike + indestructible) - unlike
   * equipGrantsKeywordDuringOwnTurn (the EQUIPMENT granting a keyword to
   * whatever it's attached to), this is on the CREATURE itself and doesn't
   * care which Equipment it is, only that it's currently equipped by
   * something. See engine/combat.ts: hasBoardGrantedKeyword. */
  hasKeywordsWhileEquipped?: string[];
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
  /** "Whenever an opponent casts a spell, put N counters of this label on
   * THIS permanent[, and you gain M life]" (Sunscorch Regent) - checked once
   * per completed CAST_CARD (any spell type - lands don't reach this check,
   * see engine/actions.ts: castCard), against the CASTER's opponent's
   * battlefield. See engine/effects.ts: triggerOpponentCastSpellWatchers. */
  onOpponentCastsSpell?: { counterLabel: string; counterAmount: number; alsoGainLife?: number };
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
  /** "Whenever one or more creatures you control with counters on them deal
   * combat damage to a player, [effect]. Do this only once each turn." (Tidus,
   * Yuna's Guardian's Cheer) - narrower than
   * onAnyControlledCreatureCombatDamageToPlayer above (only fires for an
   * unblocked attacker that itself HAS a counter) and gated to once per turn
   * via CardInstance.cheerTriggeredThisTurn on the watcher, cleared at
   * cleanup like every other "once each turn" flag in this engine. See
   * engine/actions.ts: applyCombatDamageToPlayerTriggers. */
  onAnyControlledCreatureWithCountersCombatDamageToPlayer?: CardEffect[];
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
  /** "When [this] dies, return it to the battlefield tapped (front face
   * up)" (Galian Beast, a transform back face) - a replacement effect, same
   * priority tier as onDeathExileAndCreateTokens: redirects away from the
   * graveyard entirely, reverting to its front face (frontFaceDefId) same
   * as any other permanent leaving the battlefield transformed. Since this
   * is a genuinely NEW object re-entering, it gets a fresh summoning-sick
   * check against the FRONT face's own haste (not this back face's). See
   * engine/combat.ts: moveCreaturesToGraveyard. */
  onDeathReturnToBattlefieldTapped?: boolean;
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
   * branch on it. See engine/actions.ts: castCard. */
  kicker?: { cost: 'returnLandToHand' | 'sacrificeCreatureOrArtifact' };
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
  /** "As long as this creature has a counter on it, it can attack as though
   * it didn't have defender" (Demon Wall) - checked alongside the normal
   * defender keyword wherever attack-legality is decided. */
  ignoresDefenderIfHasCounter?: boolean;
  /** "This spell costs 1 less to cast for each permanent card in your
   * graveyard" (Diamond Weapon) - reduces the GENERIC portion of the cost
   * (never below 0), applied in engine/actions.ts: castCard, before
   * checking affordability. */
  costReductionPerGraveyardPermanent?: number;
  /** "Affinity for [subtype]s" (Travel the Overworld's "Affinity for Towns")
   * - reduces the GENERIC portion of the cost by `amountPerUnit` for each
   * controlled permanent matching `subtype` (never below 0), same
   * cast-time-computed shape as costReductionPerGraveyardPermanent. */
  costReductionPerControlledSubtype?: { subtype: string; amountPerUnit: number };
  /** "Affinity for [type]s" (Valkyrie Aerial Unit's "Affinity for artifacts")
   * - the CardType-based counterpart to costReductionPerControlledSubtype,
   * for Affinity wordings that count by type rather than subtype. */
  costReductionPerControlledType?: { type: CardType; amountPerUnit: number };
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
  /** "The first legendary creature spell you cast each turn costs [N] less
   * to cast" (Serah Farron, Crystallized Serah) - board-wide, like
   * reducesCastCostForColor, but filtered to legendary creature spells and
   * limited to once per turn. See PlayerState.usedFirstLegendaryCreatureSpellDiscountThisTurn,
   * engine/mana.ts: dynamicCostReduction, engine/actions.ts: castCard (sets
   * the used-this-turn flag once a legendary creature spell is actually cast). */
  reducesCastCostForFirstLegendaryCreatureSpellEachTurn?: number;
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
  /** Combat keywords this card's OWN text mentions (as plain prose, e.g.
   * "Demons you control have menace") but that do NOT apply to the card
   * itself - only to something else the text is granting them to. Without
   * this, engine/keywords.ts: hasKeyword's substring search over the whole
   * text would incorrectly give the card itself that keyword permanently.
   * See engine/keywords.ts header comment. */
  excludeSelfKeywords?: string[];
  /** "Equipped creature has KEYWORD" (Genji Glove's double strike) -
   * unconditional, unlike equipGrantsKeywordDuringOwnTurn. A string[] grants
   * more than one keyword at once (Samurai's Katana's trample AND haste).
   * See engine/combat.ts: hasEquipGrantedKeyword. */
  equipGrantsKeyword?: string | string[];
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
  /** Set once CardDefinition.onAnyControlledCreatureWithCountersCombatDamageToPlayer
   * has fired for this instance this turn (Tidus, Yuna's Guardian's Cheer -
   * "do this only once each turn") - cleared at the cleanup step alongside
   * onAnyDeathDrawUsedThisTurn above. */
  cheerTriggeredThisTurn?: boolean;
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
  /** True for a card exiled face down (currently only via HideawayEffect) -
   * hidden from BOTH players (unlike a normal exile, or a private reveal
   * gated just to the controller), so the client only ever renders this as
   * a card back, even to its own owner, until it's actually played. */
  faceDown?: boolean;
  /** Set by a ChooseOpponentEffect (Shinryu, Transcendent Rival's "As this
   * creature transforms into Shinryu, choose an opponent") - the id of the
   * player this permanent chose. See types.ts:
   * CardDefinition.winsGameIfChosenOpponentLoses, engine/actions.ts: concede. */
  chosenOpponentId?: string;
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
      | TapStunAndGainLifeForNonbasicLandsEffect
      | ChooseCreatureDebuffOthersAndWatchLeaveEffect
      | GrantTemporaryBaseStatsAndDeathReturnEffect
      | DestroyTargetEffect
      | PumpTargetEffect
      | PutCounterOnTargetEffect
      | ProliferateEffect
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
      | DamageTargetCreatureEffect
      | SweepDamageFromChosenCreatureEffect
      | CreateTokenCopyOfTargetEffect
      | BecomeCopyOfAnyCreatureThenAddCountersEffect
      | UntapTargetAttackerEffect
      | PutStunCounterOnTargetAttackerEffect
      | GrantKeywordsToTargetPermanentEffect
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
      | DealDamageToAnyOtherTargetAndSelfEffect
      | PutCounterOnTargetLandEffect
      | PutCounterOnTargetCommanderEnteredThisTurnEffect
      | MoveCounterBetweenTargetCreaturesEffect
      | DamageAnyTargetEffect
      | SupportEffect
      | GrantOnDeathReturnToHandToTargetEffect
      | DestroyUpToOneOpponentArtifactThenPutCounterOnSelfEffect;
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
     * means X DIFFERENT creatures). */
    chosenInstanceIds?: string[];
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
  pendingSacrifice: { sourceInstanceId: string; remainingPlayerIds: string[]; filter: SacrificeFilter } | null;
  /** Set when an EachPlayerKeepOneCreatureSacrificeRestEffect (Promise of
   * Loyalty) is waiting on the FRONT id in `remainingPlayerIds` to pick
   * which of their own creatures to keep - cleared, or advanced to the next
   * remaining player, by CHOOSE_KEEP_ONE_SACRIFICE_REST. See
   * engine/effects.ts: resolveKeepOneSacrificeRestQueue. */
  pendingKeepOneSacrificeRest: { sourceInstanceId: string; remainingPlayerIds: string[] } | null;
  /** Set while a SurveilEffect is mid-resolution - cleared by RESOLVE_SURVEIL.
   * `cards` are the surveiled cards, already removed from the library (so
   * they don't show up there in the meantime) but not yet anywhere else. */
  pendingSurveil: { sourceInstanceId: string; controllerId: string; cards: CardInstance[]; thenDrawCount?: number } | null;
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
  pendingReturnFromGraveyard: { sourceInstanceId: string; controllerId: string } | null;
  /** Set while a LootEffect's discard step is outstanding - cleared by
   * DISCARD_CARD once `count` reaches 0 (or the hand runs out first). */
  pendingDiscard: { sourceInstanceId: string; controllerId: string; count: number } | null;
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
    restDestination?: 'bottomOfLibrary' | 'graveyard';
    takenDestination?: 'hand' | 'battlefieldTapped';
  } | null;
  /** Set while a DiscardHandThenDrawByDevotionEffect's "you may" is
   * outstanding - cleared by RESOLVE_OPTIONAL_DISCARD_HAND_FOR_DEVOTION. */
  pendingOptionalDiscardHandForDevotion: { sourceInstanceId: string; controllerId: string; color: ManaColor } | null;
  /** Set while a ChooseOneModeEffect is waiting for its EXACTLY-one pick -
   * cleared by RESOLVE_CHOOSE_ONE_MODE. */
  pendingChooseOneMode: { sourceInstanceId: string; controllerId: string; modes: SpellMode[] } | null;
  /** Set while a DrawCardsFromTargetPlayerEffect is waiting for its player
   * target - cleared by CHOOSE_PLAYER_TARGET. */
  pendingPlayerTarget: { sourceInstanceId: string; controllerId: string; effect: DrawCardsFromTargetPlayerEffect | PutCounterOnEachCreatureTargetPlayerControlsEffect } | null;
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
   * (an instanceId to cast, or null to decline). */
  pendingCastFromGraveyardAnyMana: { sourceInstanceId: string; controllerId: string } | null;
  /** Set while a MillThenPutLandIntoHandGainLifeIfTownEffect's "you may put
   * a land from among them into your hand" choice is outstanding -
   * `milledInstanceIds` restricts the legal pick to exactly the cards THIS
   * effect just milled. Cleared by RESOLVE_MILL_THEN_PUT_LAND_INTO_HAND. */
  pendingMillThenPutLandIntoHand: { sourceInstanceId: string; controllerId: string; milledInstanceIds: string[]; lifeGainIfTown: number } | null;
  /** Set while a ReturnCreaturesFromGraveyardToHandEffect is mid-sequence -
   * `remaining` counts down each pick, cleared (by choice or by hitting 0)
   * via RESOLVE_RETURN_CREATURE_FROM_GRAVEYARD. */
  pendingReturnCreaturesFromGraveyard: { sourceInstanceId: string; controllerId: string; remaining: number; anyPermanentInsteadOfCreature?: boolean } | null;
  /** Set while an onCombatDamageToPlayerMayTransform trigger's "you may" is
   * outstanding (Jecht, Reluctant Guardian) - cleared by
   * RESOLVE_OPTIONAL_TRANSFORM. Accepting exiles-and-returns the source
   * transformed via exileAndReturnTransformed; declining just clears this. */
  pendingOptionalTransform: { sourceInstanceId: string; controllerId: string } | null;
  /** Set while a MayPayLifeThenEffect's "you may" is outstanding (Seymour
   * Flux's upkeep trigger) - cleared by RESOLVE_OPTIONAL_PAY_LIFE. Accepting
   * pays lifeCost then resolves effects; declining just clears this. See
   * GameBoard.tsx for the purple "awaiting this choice" outline on the
   * source permanent while set. */
  pendingOptionalPayLife: { sourceInstanceId: string; controllerId: string; lifeCost: number; effects: CardEffect[] } | null;
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
  pendingNextCreatureSpellBonus: { controllerId: string; counterLabel?: string; counterAmount?: number; grantsHaste?: boolean } | null;
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
    /** "Search for up to N ... with different names" (Reach the Horizon) -
     * how many MORE picks remain after the one currently being made; a
     * completed pick re-arms pendingLibrarySearch with this decremented
     * (rather than clearing it) as long as it's still positive. Omitted for
     * every ordinary single-pick search. */
    remainingPicks?: number;
    /** Names already picked earlier in the same multi-pick chain - excluded
     * from matching on every subsequent pick ("with different names"). */
    excludeNames?: string[];
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
    optional?: boolean;
    thenCreateToken?: { tokenId: string; counterIfManaValueAtLeast?: { value: number; counterLabel: string; counterAmount: number } };
  } | null;
  /** Set while a DiscardUpToThenDrawThatManyEffect's discard step is
   * outstanding (Joshua, Phoenix's Dominant) - `discardedSoFar` counts up
   * each DISCARD_UP_TO_THEN_DRAW pick, `maxCount` caps it; declining further
   * (instanceId: null) or hitting maxCount both move straight to drawing
   * discardedSoFar cards and clear this. */
  pendingDiscardUpToThenDraw: { sourceInstanceId: string; controllerId: string; maxCount: number; discardedSoFar: number } | null;
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
      /** CardDefinition.escalateCost's payment - one OTHER untapped creature
       * per mode chosen beyond the first (Collective Effort). Ignored unless
       * the card actually has escalateCost set. */
      escalateCostInstanceIds?: string[];
      /** CardDefinition.multikickerCost's payment count - how many times it
       * was paid (0/omitted declines it entirely). Ignored unless the card
       * actually has multikickerCost set. */
      chosenMultikickerCount?: number;
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
  | { type: 'RESOLVE_CHOOSE_ONE_MODE'; modeIndex: number }
  | { type: 'CHOOSE_PLAYER_TARGET'; targetPlayerId: string }
  | { type: 'CYCLE_CARD'; instanceId: string }
  | { type: 'CHOOSE_REVEALED_CARD'; instanceId: string }
  | { type: 'CHOOSE_MANA_COLOR'; color: ManaColor }
  | { type: 'CHOOSE_SACRIFICE'; instanceId: string }
  | { type: 'CHOOSE_KEEP_ONE_SACRIFICE_REST'; instanceId: string }
  | { type: 'RESOLVE_SURVEIL'; graveyardIds: string[]; keepOrder: string[] }
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
  | { type: 'RESOLVE_REANIMATE'; instanceId: string }
  | { type: 'RESOLVE_RETURN_INSTANT_OR_SORCERY_FROM_GRAVEYARD'; instanceId: string }
  | { type: 'RESOLVE_PUT_LAND_FROM_HAND'; instanceId: string | null }
  | { type: 'RESOLVE_CAST_FROM_GRAVEYARD_ANY_MANA'; instanceId: string | null }
  | { type: 'CAST_ARTIFACT_FROM_GRAVEYARD_FOR_LIFE'; instanceId: string; sourceInstanceId: string }
  | { type: 'RESOLVE_MILL_THEN_PUT_LAND_INTO_HAND'; instanceId: string | null }
  | { type: 'RESOLVE_RETURN_CREATURE_FROM_GRAVEYARD'; instanceId: string | null }
  | { type: 'RESOLVE_OPTIONAL_TRANSFORM'; accept: boolean }
  | { type: 'RESOLVE_OPTIONAL_PAY_LIFE'; accept: boolean }
  | { type: 'RESOLVE_MAY_EFFECT'; accept: boolean }
  | { type: 'RESOLVE_COMMANDER_ZONE_CHOICE'; toCommandZone: boolean }
  | { type: 'RESOLVE_WARD_PAYMENT'; pay: boolean }
  | { type: 'RESOLVE_ATTACK_TAX_PAYMENT'; pay: boolean }
  | { type: 'RESOLVE_COUNTER_TRANSFER'; targetInstanceId: string | null }
  | { type: 'RESOLVE_PUT_CREATURE_OR_LAND_FROM_HAND'; instanceId: string | null }
  | { type: 'RESOLVE_REVEAL_LAND_TYPE_FROM_HAND'; instanceId: string | null }
  | { type: 'RESOLVE_FREE_CAST_FROM_HAND'; instanceId: string | null }
  | { type: 'RESOLVE_LIBRARY_SEARCH'; instanceId: string | null }
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