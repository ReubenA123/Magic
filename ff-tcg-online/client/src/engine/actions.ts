// ============================================================================
// engine/actions.ts
// ============================================================================

import { ActionResult, CardDefinition, CardInstance, CombatAssignment, GameAction, GameState, ManaColor, Phase, ZoneName } from '../types';
import { findCardAnywhere, getOpponent, getPlayer, updatePlayer, detachEverythingFrom, nextInstanceId, shuffle } from './state'; import { getCardDefinition, frontFaceDefId } from '../data/cards';
import { canPay, payCost, parseCostLabel, emptyManaPool, manaValue, effectiveCastCost } from './mana';
import { hasKeyword, hasKeywordEffective } from './keywords';
import {
  resolveCombatDamage,
  resolvePendingDeaths,
  effectivePower,
  effectiveToughness,
  isEffectivelyCreature,
  resolveFight,
  resolveOneWayPowerDamage,
  getActiveCharacteristicOverride,
  hasEquipGrantedKeywordDuringOwnTurn,
  hasSelfGrantedKeywordDuringOwnTurn,
  loseLife,
  damageMultiplierFor,
  effectiveWardCost,
  hasBoardGrantedKeyword,
  beginCommanderZoneChoice,
} from './combat';
import {
  resolveCardEffects,
  triggerLandfall,
  triggerNoncreatureCastAbilities,
  triggerArtifactEnterWatchers,
  triggerSubtypeEnterWatchers,
  triggerCreatureEnterWatchers,
  triggerSagaLoreCounter,
  applyTemporaryBuff,
  grantTemporaryKeyword,
  exileAndReturnTransformed,
  returnFromGraveyardTransformed,
  returnSelfFromGraveyard,
  resolveSacrificeQueue,
  matchesSacrificeFilter,
  sacrificeFilterLabel,
  resolveOnDeathTriggers,
  moveCreaturesToGraveyardAndTrigger,
  matchesReanimateFilter,
  matchesReturnFromGraveyardFilter,
  stripSagaProgress,
  beginRevealPickup,
  beginLibrarySearch,
  matchesLibrarySearchFilter,
  isNonbasicLand,
} from './effects';

const PHASE_ORDER: Phase[] = ['untap', 'upkeep', 'draw', 'main1', 'combat_begin', 'declare_attackers', 'declare_blockers', 'combat_damage', 'combat_end', 'main2', 'end', 'cleanup'];

function isMutualActive(state: GameState): boolean {
  return state.mutualAdjustment.status === 'active';
}

/** Whether `card` (still owned by `ownerId`, still actually on a
 * battlefield at the moment this is checked) is that player's chosen
 * commander - the gate every bounce/exile site below checks before
 * intercepting a departure into engine/combat.ts: beginCommanderZoneChoice
 * instead of moving it directly. */
function isPlayersCommander(state: GameState, ownerId: string, card: CardInstance): boolean {
  const owner = getPlayer(state, ownerId);
  return !!owner.commanderDefId && frontFaceDefId(card.defId) === owner.commanderDefId;
}

/** Every action goes through this single entry point, so it's also the one
 * place that can reliably notice "did a watched permanent leave the
 * battlefield" (see GameState.battlefieldLeaveWatchers) no matter which of
 * the many code paths caused it - combat death, sacrifice, bounce, exile,
 * put on a library, ... - without having to instrument each of them
 * individually (and risk missing one). Compares the battlefields before and
 * after the real action resolves; anything watched that was there before
 * and isn't anywhere after fires its effects and is removed (one-shot). */
export function applyAction(state: GameState, action: GameAction, playerId: string): ActionResult {
  const result = applyActionInner(state, action, playerId);
  if (!result.ok) return result;
  const watched = checkBattlefieldLeaveWatchers(state, result.state);
  const unexiled = checkExileUntilSourceLeaves(state, watched.state);
  const cleaned = stripStaleRevealMarkers(unexiled.state);
  const logLines = [...watched.logLines, ...unexiled.logLines];
  if (logLines.length === 0) return { ok: true, state: cleaned };
  return { ok: true, state: { ...cleaned, log: [...cleaned.log, ...logLines] } };
}

function checkBattlefieldLeaveWatchers(prevState: GameState, nextState: GameState): { state: GameState; logLines: string[] } {
  if (nextState.battlefieldLeaveWatchers.length === 0) return { state: nextState, logLines: [] };

  const isOnAnyBattlefield = (state: GameState, instanceId: string) => state.players.some((p) => p.zones.battlefield.some((c) => c.instanceId === instanceId));

  const departed = nextState.battlefieldLeaveWatchers.filter(
    (w) => isOnAnyBattlefield(prevState, w.watchedInstanceId) && !isOnAnyBattlefield(nextState, w.watchedInstanceId)
  );
  if (departed.length === 0) return { state: nextState, logLines: [] };

  let next: GameState = { ...nextState, battlefieldLeaveWatchers: nextState.battlefieldLeaveWatchers.filter((w) => !departed.includes(w)) };
  const logLines: string[] = [];
  for (const watcher of departed) {
    // If the watcher itself also left this same action, there's nothing left
    // to run the effects ON - just let the watch lapse silently.
    if (!isOnAnyBattlefield(next, watcher.watcherInstanceId)) continue;
    const resolved = resolveCardEffects(next, watcher.controllerId, watcher.effects, watcher.watcherInstanceId);
    next = resolved.state;
    logLines.push(...resolved.logLines);
  }
  return { state: next, logLines };
}

/** "Exile target creature ... until [this] leaves the battlefield" (Auron,
 * Venerated Guardian's Shooting Star) - a real "O-Ring" style linked exile.
 * Deliberately a SEPARATE list from battlefieldLeaveWatchers above rather
 * than reusing it: that mechanism skips its own effects entirely if the
 * WATCHER also left the battlefield in the same instant ("nothing left to
 * run the effects on") - exactly the case here, since the watched permanent
 * and the exiling source are the SAME card. Same "diff before/after, one-shot"
 * shape as checkBattlefieldLeaveWatchers, just unconditional on the source's
 * own continued presence, since returning the exiled card doesn't need
 * anything from the source itself (see engine/effects.ts:
 * exileTargetCreatureWithLessPowerUntilSourceLeaves, the only effect that
 * populates this list right now - a card like White Auracite wanting the
 * same "until this leaves" pattern would populate it the same way). */
function checkExileUntilSourceLeaves(prevState: GameState, nextState: GameState): { state: GameState; logLines: string[] } {
  if (nextState.exileUntilSourceLeaves.length === 0) return { state: nextState, logLines: [] };

  const isOnAnyBattlefield = (state: GameState, instanceId: string) => state.players.some((p) => p.zones.battlefield.some((c) => c.instanceId === instanceId));

  const departed = nextState.exileUntilSourceLeaves.filter(
    (w) => isOnAnyBattlefield(prevState, w.sourceInstanceId) && !isOnAnyBattlefield(nextState, w.sourceInstanceId)
  );
  if (departed.length === 0) return { state: nextState, logLines: [] };

  let next: GameState = { ...nextState, exileUntilSourceLeaves: nextState.exileUntilSourceLeaves.filter((w) => !departed.includes(w)) };
  const logLines: string[] = [];
  for (const watcher of departed) {
    for (const p of next.players) {
      const exiledCard = p.zones.exile.find((c) => c.instanceId === watcher.exiledInstanceId);
      if (!exiledCard) continue;
      const def = getCardDefinition(exiledCard.defId);
      const newCard: CardInstance = {
        instanceId: nextInstanceId(),
        defId: exiledCard.defId,
        ownerId: p.id,
        tapped: false,
        counters: [],
        damageMarked: 0,
        summoningSick: !hasKeyword(def, 'haste'),
      };
      next = updatePlayer(next, p.id, (pl) => ({
        ...pl,
        zones: { ...pl.zones, exile: pl.zones.exile.filter((c) => c.instanceId !== watcher.exiledInstanceId), battlefield: [...pl.zones.battlefield, newCard] },
      }));
      logLines.push(`${def.name} returns to the battlefield.`);
      break;
    }
  }
  return { state: next, logLines };
}

/** CardInstance.revealedToOpponentWhileInHand should only ever be true for a
 * card that's ACTUALLY still sitting in its owner's hand right now - run
 * after every single action (regardless of what it was) so leaving hand for
 * ANY reason (cast, discarded, milled, exiled, tucked into a library,
 * sacrificed, ...) drops the marker immediately, without having to
 * instrument each of those many zone-change code paths individually and
 * risk missing one - same "diff after the fact" reasoning as
 * checkBattlefieldLeaveWatchers above. A plain no-op scan (returns the same
 * state reference) on the overwhelming majority of actions, which never
 * touch a revealed card at all. */
function stripStaleRevealMarkers(state: GameState): GameState {
  let next = state;
  for (const player of state.players) {
    const zones = player.zones;
    const zoneNames: (keyof typeof zones)[] = ['library', 'battlefield', 'graveyard', 'exile', 'commander'];
    let changedZones: Partial<typeof zones> | null = null;
    for (const zoneName of zoneNames) {
      const cards = zones[zoneName];
      if (!cards.some((c) => c.revealedToOpponentWhileInHand)) continue;
      changedZones = { ...(changedZones ?? {}), [zoneName]: cards.map((c) => (c.revealedToOpponentWhileInHand ? { ...c, revealedToOpponentWhileInHand: undefined } : c)) };
    }
    if (changedZones) next = updatePlayer(next, player.id, (p) => ({ ...p, zones: { ...p.zones, ...changedZones } }));
  }
  return next;
}

function applyActionInner(state: GameState, action: GameAction, playerId: string): ActionResult {
  switch (action.type) {
    case 'DRAW_CARD':
      return drawCard(state, playerId);
    case 'MOVE_CARD':
      return moveCard(state, playerId, action.instanceId, action.toZone);
    case 'SHUFFLE_LIBRARY':
      return shuffleLibrary(state, playerId);
    case 'TOGGLE_TAP':
      return toggleTap(state, playerId, action.instanceId, action.chosenColor);
    case 'CAST_CARD':
      return castCard(state, playerId, action.instanceId, action.chosenX, action.chosenModeIndices, action.chosenTierIndex, undefined, action.kickerPaymentInstanceId);
    case 'ACTIVATE_ABILITY':
      return activateAbility(state, playerId, action.instanceId, action.abilityId, action.costTargetInstanceIds);
    case 'ADJUST_LIFE':
      return adjustLife(state, action.playerId, action.delta);
    case 'ADJUST_COUNTER':
      return adjustCounter(state, playerId, action.instanceId, action.label, action.delta);
    case 'FLIP_CARD':
      return flipCard(state, action.instanceId);
    case 'ATTACH_CARD':
      return attachCard(state, playerId, action.instanceId, action.targetInstanceId);
    case 'DETACH_CARD':
      return detachCard(state, playerId, action.instanceId);
    case 'DECLARE_ATTACKERS':
      return declareAttackers(state, playerId, action.instanceIds);
    case 'DECLARE_BLOCKERS':
      return declareBlockers(state, playerId, action.assignments);
    case 'ORDER_BLOCKERS':
      return orderBlockers(state, playerId, action.attackerInstanceId, action.orderedBlockerIds);
    case 'CHOOSE_TARGET':
      return chooseTarget(state, playerId, action.targetInstanceId, false, action.targetPlayerId);
    case 'CYCLE_CARD':
      return cycleCard(state, playerId, action.instanceId);
    case 'CHOOSE_REVEALED_CARD':
      return chooseRevealedCard(state, playerId, action.instanceId);
    case 'CHOOSE_MANA_COLOR':
      return chooseManaColor(state, playerId, action.color);
    case 'CHOOSE_SACRIFICE':
      return chooseSacrifice(state, playerId, action.instanceId);
    case 'RESOLVE_SURVEIL':
      return resolveSurveil(state, playerId, action.graveyardIds, action.keepOrder);
    case 'RETURN_FROM_GRAVEYARD':
      return returnFromGraveyard(state, playerId, action.instanceId);
    case 'DISCARD_CARD':
      return discardCard(state, playerId, action.instanceId);
    case 'RESOLVE_OPTIONAL_BOUNCE':
      return resolveOptionalBounce(state, playerId, action.instanceId);
    case 'RESOLVE_LAND_BOUNCE':
      return resolveLandBounce(state, playerId, action.instanceId);
    case 'RESOLVE_LIBRARY_OR_GRAVEYARD_SEARCH':
      return resolveLibraryOrGraveyardSearch(state, playerId, action.instanceId);
    case 'CAST_FROM_EXILE':
      return castFromExile(state, playerId, action.instanceId, action.chosenX);
    case 'RESOLVE_SACRIFICE_FOR_EXILE_PLAY':
      return resolveOptionalSacrificeForExilePlay(state, playerId, action.instanceId);
    case 'RESOLVE_REVEAL_FILTERED':
      return resolveRevealFiltered(state, playerId, action.instanceId);
    case 'RESOLVE_OPTIONAL_DISCARD_HAND_FOR_DEVOTION':
      return resolveOptionalDiscardHandForDevotion(state, playerId, action.accept);
    case 'RESOLVE_CHOOSE_ONE_MODE':
      return resolveChooseOneMode(state, playerId, action.modeIndex);
    case 'CHOOSE_PLAYER_TARGET':
      return choosePlayerTarget(state, playerId, action.targetPlayerId);
    case 'CREW_VEHICLE':
      return crewVehicle(state, playerId, action.instanceId, action.crewInstanceIds);
    case 'CAST_FROM_GRAVEYARD':
      return castFromGraveyard(state, playerId, action.instanceId, action.chosenX);
    case 'RESOLVE_RETURN_INSTANT_OR_SORCERY_FROM_GRAVEYARD':
      return resolveReturnInstantOrSorceryFromGraveyard(state, playerId, action.instanceId);
    case 'RESOLVE_PUT_LAND_FROM_HAND':
      return resolvePutLandFromHand(state, playerId, action.instanceId);
    case 'RESOLVE_CAST_FROM_GRAVEYARD_ANY_MANA':
      return resolveCastFromGraveyardAnyMana(state, playerId, action.instanceId);
    case 'CAST_ARTIFACT_FROM_GRAVEYARD_FOR_LIFE':
      return castArtifactFromGraveyardForLife(state, playerId, action.instanceId, action.sourceInstanceId);
    case 'RESOLVE_MILL_THEN_PUT_LAND_INTO_HAND':
      return resolveMillThenPutLandIntoHand(state, playerId, action.instanceId);
    case 'RESOLVE_REANIMATE':
      return resolveReanimate(state, playerId, action.instanceId);
    case 'RESOLVE_RETURN_CREATURE_FROM_GRAVEYARD':
      return resolveReturnCreatureFromGraveyard(state, playerId, action.instanceId);
    case 'RESOLVE_OPTIONAL_TRANSFORM':
      return resolveOptionalTransform(state, playerId, action.accept);
    case 'RESOLVE_OPTIONAL_PAY_LIFE':
      return resolveOptionalPayLife(state, playerId, action.accept);
    case 'RESOLVE_COMMANDER_ZONE_CHOICE':
      return resolveCommanderZoneChoice(state, playerId, action.toCommandZone);
    case 'RESOLVE_WARD_PAYMENT':
      return resolveWardPayment(state, playerId, action.pay);
    case 'RESOLVE_FREE_CAST_FROM_HAND':
      return resolveFreeCastFromHand(state, playerId, action.instanceId);
    case 'RESOLVE_LIBRARY_SEARCH':
      return resolveLibrarySearch(state, playerId, action.instanceId);
    case 'RESOLVE_GRAVEYARD_EXILE':
      return resolveGraveyardExile(state, playerId, action.instanceId);
    case 'DISCARD_UP_TO_THEN_DRAW':
      return resolveDiscardUpToThenDraw(state, playerId, action.instanceId);
    case 'RESOLVE_REVEAL_PICKUP':
      return resolveRevealPickup(state, playerId);
    case 'CHOOSE_COIN_SIDE':
      return chooseCoinSide(state, playerId, action.side);
    case 'RESOLVE_HIDEAWAY':
      return resolveHideaway(state, playerId, action.instanceId);
    case 'NEXT_PHASE':
      return nextPhase(state, playerId);
    case 'END_TURN':
      return endTurn(state, playerId);
    case 'READY_TO_START':
      return readyToStart(state, playerId);
    case 'REQUEST_MUTUAL_ADJUSTMENT':
      return requestMutualAdjustment(state, playerId);
    case 'RESPOND_MUTUAL_ADJUSTMENT':
      return respondMutualAdjustment(state, playerId, action.accept);
    case 'REQUEST_EXIT_MUTUAL_ADJUSTMENT':
      return requestExitMutualAdjustment(state, playerId);
    case 'RESPOND_EXIT_MUTUAL_ADJUSTMENT':
      return respondExitMutualAdjustment(state, playerId, action.accept);
    case 'CONCEDE':
      return concede(state, playerId);
    case 'UNDO':
      return { ok: false, error: 'UNDO should be handled by the calling layer.' };
    default:
      return { ok: false, error: 'Unknown action.' };
  }
}

function shuffleArr<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function performDraw(state: GameState, playerId: string): ActionResult {
  const player = getPlayer(state, playerId);
  const [drawn, ...rest] = player.zones.library;
  if (!drawn) return { ok: false, error: 'Your library is empty.' };
  const next = updatePlayer(state, playerId, (p) => ({ ...p, zones: { ...p.zones, library: rest, hand: [...p.zones.hand, drawn] } }));
  return { ok: true, state: { ...next, log: [...next.log, `${player.name} draws a card.`] } };
}

/** One manual draw per turn, only during your own draw step - bypassed
 * during Mutual Adjustment and during pregame, where either player can draw
 * freely while building their opening hand. Drawing during the draw step
 * also immediately advances into main phase 1, since there's nothing else
 * to do there once you've drawn. */
function drawCard(state: GameState, playerId: string): ActionResult {
  const player = getPlayer(state, playerId);
  const mutual = isMutualActive(state);
  const pregame = state.phase === 'pregame';
  if (!mutual && !pregame) {
    if (state.phase !== 'draw') return { ok: false, error: 'You can only draw during the draw step (until effects that grant extra draws are added).' };
    if (state.activePlayerId !== playerId) return { ok: false, error: "It's not your draw step." };
    if (player.hasDrawnThisTurn) return { ok: false, error: 'Already drew a card this turn.' };
  }

  const result = performDraw(state, playerId);
  if (!result.ok) return result;

  let next = updatePlayer(result.state, playerId, (p) => ({ ...p, hasDrawnThisTurn: true }));
  if (!mutual && !pregame && next.phase === 'draw' && next.activePlayerId === playerId) {
    // This is a phase transition in its own right (draw -> main1), just one
    // folded into the draw action instead of a separate NEXT_PHASE click -
    // so it owes main1 the same entry hooks nextPhase() runs for every other
    // transition into it: mana empties/unspent lands untap (there's no
    // priority system, so mana COULD have been floated during the draw
    // step), and "as your precombat main phase begins" triggers fire - Saga
    // lore counters (engine/effects.ts: triggerSagaLoreCounter) foremost
    // among them. Without this, a Saga's lore counter silently never
    // advanced past its entering count for as long as players kept drawing
    // normally (the only path that DOESN'T route through nextPhase).
    next = clearManaAndRefundUnspentLands({ ...next, phase: 'main1' });
    next = applyMainPhaseTriggers(next);
  }
  return { ok: true, state: next };
}

function moveCard(state: GameState, playerId: string, instanceId: string, toZone: ZoneName): ActionResult {
  const found = findCardAnywhere(state, instanceId);
  if (!found) return { ok: false, error: "That card couldn't be found." };
  if (found.zone === toZone) return { ok: false, error: 'That card is already there.' };

  const mutual = isMutualActive(state);
  if (!mutual && toZone === 'battlefield' && (found.zone === 'hand' || found.zone === 'commander')) {
    return { ok: false, error: 'Use the Play/Cast button instead - it pays the cost automatically.' };
  }

  const def = getCardDefinition(found.card.defId);
  const ownerId = found.ownerPlayerId;
  let next = state;

  if (found.zone === 'battlefield') {
    next = detachEverythingFrom(next, instanceId);
  }

  next = updatePlayer(next, ownerId, (p) => ({ ...p, zones: { ...p.zones, [found.zone]: p.zones[found.zone].filter((c) => c.instanceId !== instanceId) } }));

  const movedCard = {
    ...found.card,
    tapped: false,
    damageMarked: 0,
    attachedToInstanceId: undefined,
    summoningSick: toZone === 'battlefield' && def.type === 'creature' ? !hasKeyword(def, 'haste') : false,
  };

  next = updatePlayer(next, ownerId, (p) => {
    if (toZone === 'library') return { ...p, zones: { ...p.zones, library: shuffleArr([...p.zones.library, movedCard]) } };
    return { ...p, zones: { ...p.zones, [toZone]: [...p.zones[toZone], movedCard] } };
  });

  const mover = getPlayer(state, playerId);
  return { ok: true, state: { ...next, log: [...next.log, `${mover.name} moves ${def.name} to ${toZone}.`] } };
}


function shuffleLibrary(state: GameState, playerId: string): ActionResult {
  const player = getPlayer(state, playerId);
  const next = updatePlayer(state, playerId, (p) => ({ ...p, zones: { ...p.zones, library: shuffleArr(p.zones.library) } }));
  return { ok: true, state: { ...next, log: [...next.log, `${player.name} shuffles their library.`] } };
}

/** A permanent's own producesMana, or - if it doesn't have one - whatever a
 * grantsManaAbilityToOthers permanent (e.g. A Realm Reborn) the SAME
 * controller controls is handing out to everything else. Real rules would
 * let a permanent stack an existing mana ability with a granted one; this
 * engine keeps it simple and only grants to permanents with no ability of
 * their own.
 *
 * Checked FIRST against CardDefinition.characteristicOverrides (Ultima,
 * Origin of Oblivion's blight counter: "loses all land types and abilities
 * and has '{T}: Add {C}.'") - an active override always wins outright, even
 * over the permanent's own printed producesMana, matching "loses ... and
 * has" replacing rather than adding to what was there. */
function effectiveProducesMana(state: GameState, controllerId: string, def: CardDefinition, instance: CardInstance): ManaColor | 'any' | ManaColor[] | undefined {
  const override = getActiveCharacteristicOverride(instance);
  if (override && override.overridesProducesMana !== undefined) return override.overridesProducesMana ?? undefined;
  if (def.producesMana) return def.producesMana;
  const granter = getPlayer(state, controllerId).zones.battlefield.find(
    (c) => c.instanceId !== instance.instanceId && !!getCardDefinition(c.defId).grantsManaAbilityToOthers
  );
  return granter ? getCardDefinition(granter.defId).grantsManaAbilityToOthers : undefined;
}

/** How much mana one tap of a permanent with `def` actually produces of
 * `color` - def.producesManaAmount (Ring of the Lucii's "T: Add MM"), unless
 * the controller has a permanent with doublesColorlessManaFromLands
 * (Ultima, Origin of Oblivion) AND this is a LAND tapping for colorless
 * specifically, in which case it's doubled on top of that. Shared by every
 * place mana is actually added to or refunded from a pool (tap, manual
 * untap-refund, and the automatic end-of-phase unspent-mana sweep) so they
 * can never disagree about how much a given tap was worth. */
function effectiveProducedManaAmount(state: GameState, controllerId: string, def: CardDefinition, color: ManaColor | undefined): number {
  const base = def.producesManaAmount ?? 1;
  if (color !== 'C' || def.type !== 'land') return base;
  const hasDoubler = getPlayer(state, controllerId).zones.battlefield.some((c) => getCardDefinition(c.defId).doublesColorlessManaFromLands);
  return hasDoubler ? base * 2 : base;
}

function resolveTapColor(producesMana: ManaColor | 'any' | ManaColor[], chosenColor?: ManaColor): { ok: true; color: ManaColor } | { ok: false; error: string } {
  if (Array.isArray(producesMana)) {
    if (!chosenColor || !producesMana.includes(chosenColor)) return { ok: false, error: `Choose one of: ${producesMana.join(', ')}.` };
    return { ok: true, color: chosenColor };
  }
  if (producesMana === 'any') {
    if (!chosenColor) return { ok: false, error: 'Choose a colour to produce.' };
    return { ok: true, color: chosenColor };
  }
  return { ok: true, color: producesMana };
}

function toggleTap(state: GameState, playerId: string, instanceId: string, chosenColor?: ManaColor): ActionResult {
  const found = findCardAnywhere(state, instanceId);
  if (!found || found.zone !== 'battlefield') return { ok: false, error: 'Only cards on a battlefield can be tapped.' };
  const def = getCardDefinition(found.card.defId);
  const wasTapped = found.card.tapped;
  const mutual = isMutualActive(state);

  // A pending chooseManaColor effect (Crossroads Village) blocks tap-toggling
  // in either direction - it matters for untapping too, since a card like
  // this always enters already tapped (entersTapped), so the very first
  // TOGGLE_TAP call on it would otherwise be an untap, skipping right past a
  // guard placed only in the tapping branch below.
  if (state.pendingManaColorChoice?.instanceId === instanceId) {
    return { ok: false, error: `Choose a colour for ${def.name} first.` };
  }

  // Untapping: hand back whatever mana this specific permanent produced - but
  // only while that mana is still sitting unspent in the pool. Once it's
  // been spent, or if it was never tapped FOR mana in the first place
  // (entered tapped, tapped for an ability cost, tapped from combat, etc.),
  // there's nothing to refund - it just stays tapped until the real untap
  // step, same as it would for anyone actually playing the physical card.
  // Mutual Adjustment is the one place a free manual untap is intentional.
  if (wasTapped) {
    const producedColor = found.card.producedManaColor;
    // How much of producedColor THIS tap actually added - Ring of the
    // Lucii's "T: Add MM" is 2, everything else defaults to 1 (doubled again
    // if a doublesColorlessManaFromLands permanent applied). Refunding needs
    // the same amount back, not a flat 1.
    const producedAmount = effectiveProducedManaAmount(state, found.ownerPlayerId, def, producedColor);
    if (!mutual) {
      if (!producedColor) {
        return { ok: false, error: `${def.name} is tapped - it'll untap automatically at your next untap step.` };
      }
      if (getPlayer(state, found.ownerPlayerId).manaPool[producedColor] < producedAmount) {
        return { ok: false, error: `${def.name}'s mana has already been spent.` };
      }
    }
    let next = updatePlayer(state, found.ownerPlayerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.map((c) => (c.instanceId === instanceId ? { ...c, tapped: false, producedManaColor: undefined } : c)),
      },
      manaPool: producedColor ? { ...p.manaPool, [producedColor]: p.manaPool[producedColor] - producedAmount } : p.manaPool,
    }));
    if (producedColor) next = { ...next, log: [...next.log, `${def.name} is untapped, returning ${producedAmount} ${producedColor} mana to the pool.`] };
    return { ok: true, state: next };
  }

  let resolvedColor: ManaColor | undefined;
  const producesMana = effectiveProducesMana(state, found.ownerPlayerId, def, found.card);
  if (found.card.chosenManaColor) {
    // Locked in once by CHOOSE_MANA_COLOR - takes priority over (and, for a
    // card like Crossroads Village, stands in entirely for) producesMana.
    resolvedColor = found.card.chosenManaColor;
  } else if (producesMana) {
    // Mana creatures (e.g. Goobbue Gardener's "Tap: Add G.") follow the same
    // summoning-sickness rule as any other tap ability - only lands are
    // exempt, since they were never "just cast" in the creature sense.
    if (!mutual && def.type === 'creature' && found.card.summoningSick) {
      return { ok: false, error: `${def.name} has summoning sickness and can't tap for mana yet.` };
    }
    const resolved = resolveTapColor(producesMana, chosenColor);
    if (!resolved.ok) return resolved;
    resolvedColor = resolved.color;
  }

  // Ring of the Lucii's "T: Add MM" produces 2 colorless from one tap -
  // everything else defaults to 1 (doubled again by a
  // doublesColorlessManaFromLands permanent, e.g. Ultima, Origin of
  // Oblivion). See types.ts: producesManaAmount.
  const producedAmount = effectiveProducedManaAmount(state, found.ownerPlayerId, def, resolvedColor);
  let next = updatePlayer(state, found.ownerPlayerId, (p) => ({
    ...p,
    zones: {
      ...p.zones,
      battlefield: p.zones.battlefield.map((c) => (c.instanceId === instanceId ? { ...c, tapped: true, producedManaColor: resolvedColor } : c)),
    },
    manaPool: resolvedColor ? { ...p.manaPool, [resolvedColor]: p.manaPool[resolvedColor] + producedAmount } : p.manaPool,
  }));
  if (resolvedColor) next = { ...next, log: [...next.log, `${def.name} adds ${producedAmount > 1 ? `${producedAmount} ` : ''}${resolvedColor} to mana pool.`] };

  // "{T}, Sacrifice this: ..." folded into one tap (e.g. a Treasure token) -
  // only once it actually produced mana, not on a no-op tap.
  if (resolvedColor && found.card.sacrificesOnTap) {
    const sacResult = moveCreaturesToGraveyardAndTrigger(next, [instanceId], 'is sacrificed');
    next = { ...sacResult.state, log: [...sacResult.state.log, ...sacResult.logLines] };
  }

  return { ok: true, state: next };
}

/** How many lands `playerId` is allowed to play this turn - the ordinary
 * one, plus CardDefinition.extraLandsPerTurn (Zell Dincht) summed across
 * every such permanent they control, in case more than one is ever in
 * play at once. See PlayerState.landsPlayedThisTurn. */
function maxLandsPerTurn(state: GameState, playerId: string): number {
  const player = getPlayer(state, playerId);
  const extra = player.zones.battlefield.reduce((sum, c) => sum + (getCardDefinition(c.defId).extraLandsPerTurn ?? 0), 0);
  return 1 + extra;
}

function checkLegendRule(state: GameState, playerId: string): GameState {
  const player = getPlayer(state, playerId);
  const legendaryNames = new Map<string, number>();
  for (const c of player.zones.battlefield) {
    const def = getCardDefinition(c.defId);
    if (def.subtype?.toLowerCase().includes('legendary')) {
      legendaryNames.set(def.name, (legendaryNames.get(def.name) ?? 0) + 1);
    }
  }
  let next = state;
  for (const [name, count] of legendaryNames) {
    if (count > 1) next = { ...next, log: [...next.log, `Legend rule: ${player.name} controls ${count} copies of ${name} - choose one to keep, move the rest to your graveyard.`] };
  }
  return next;
}

function castCard(
  state: GameState,
  playerId: string,
  instanceId: string,
  chosenX?: number,
  chosenModeIndices?: number[],
  chosenTierIndex?: number,
  // "Cast without paying its mana cost" (Buster Sword's granted trigger,
  // via RESOLVE_FREE_CAST_FROM_HAND) - bypasses BOTH the mana cost/payment
  // AND the normal "your turn, main phase only" timing gate, same as `mutual`
  // does for cost but ALSO for timing, since this is a one-shot window
  // granted by an ability firing mid-combat, not normal-timing casting.
  free?: boolean,
  // "Kicker - [cost]" (see CardDefinition.kicker) - the specific permanent
  // paid with (a land to return to hand, or a creature/artifact to
  // sacrifice). Omitted entirely declines to kick, even on a card that HAS
  // a kicker ability.
  kickerPaymentInstanceId?: string
): ActionResult {
  const player = getPlayer(state, playerId);
  const mutual = isMutualActive(state);
  // See engine/effects.ts: triggerNoncreatureCastAbilities - only a
  // permanent (or equipment target) that was ALREADY on the battlefield
  // before this cast resolved is eligible to see it as a trigger event.
  const preCastBattlefieldIds = new Set(player.zones.battlefield.map((c) => c.instanceId));

  let card = player.zones.hand.find((c) => c.instanceId === instanceId);
  let sourceZone: 'hand' | 'commander' | null = card ? 'hand' : null;
  if (!card) {
    card = player.zones.commander.find((c) => c.instanceId === instanceId);
    if (card) sourceZone = 'commander';
  }
  if (!card || !sourceZone) return { ok: false, error: 'That card is not in your hand or commander zone.' };

  const def = getCardDefinition(card.defId);

  if (def.chooseModes && (!chosenModeIndices || chosenModeIndices.length === 0 || chosenModeIndices.some((i) => !def.chooseModes![i]))) {
    return { ok: false, error: `${def.name} requires choosing one or more modes.` };
  }
  if (def.tieredModes && (chosenTierIndex === undefined || !def.tieredModes[chosenTierIndex])) {
    return { ok: false, error: `${def.name} requires choosing one tier.` };
  }

  if (!mutual && !free && def.type !== 'land' && def.type !== 'instant' && !hasKeyword(def, 'flash')) {
    if (state.activePlayerId !== playerId) return { ok: false, error: `${def.name} can only be cast on your own turn (no flash).` };
    if (state.phase !== 'main1' && state.phase !== 'main2') return { ok: false, error: `${def.name} can only be cast during a main phase (no flash).` };
  }

  if (def.type === 'land') {
    if (!mutual) {
      if (state.activePlayerId !== playerId) return { ok: false, error: 'You can only play a land on your own turn.' };
      if (player.landsPlayedThisTurn >= maxLandsPerTurn(state, playerId)) return { ok: false, error: "You've already played a land this turn." };
    }
    let next = updatePlayer(state, playerId, (p) => ({ ...p, zones: { ...p.zones, hand: p.zones.hand.filter((c) => c.instanceId !== instanceId) } }));
    const movedCard = { ...card, tapped: !!def.entersTapped, damageMarked: 0, summoningSick: false };
    next = updatePlayer(next, playerId, (p) => ({
      ...p,
      zones: { ...p.zones, battlefield: [...p.zones.battlefield, movedCard] },
      hasPlayedLandThisTurn: mutual ? p.hasPlayedLandThisTurn : true,
      landsPlayedThisTurn: mutual ? p.landsPlayedThisTurn : p.landsPlayedThisTurn + 1,
    }));
    next = checkLegendRule(next, playerId);

    let effectLogLines: string[] = [];
    if (def.onEnter && def.onEnter.length > 0) {
      const resolved = resolveCardEffects(next, playerId, def.onEnter, movedCard.instanceId);
      next = resolved.state;
      effectLogLines = resolved.logLines;
    }
    const landfallResult = triggerLandfall(next, playerId);
    next = landfallResult.state;
    effectLogLines = [...effectLogLines, ...landfallResult.logLines];

    return { ok: true, state: { ...next, log: [...next.log, `${player.name} plays ${def.name}.`, ...effectLogLines] } };
  }

  const commanderTax = sourceZone === 'commander' ? card.counters.find((c) => c.label === 'Commander Tax')?.amount ?? 0 : 0;
  // "This spell costs 1 less to cast for each permanent card in your
  // graveyard" (Diamond Weapon), "Affinity for [subtype]s" (Travel the
  // Overworld), "Affinity for [type]s" (Valkyrie Aerial Unit) - see
  // engine/mana.ts: effectiveCastCost/dynamicCostReduction, also used
  // client-side (GameBoard.tsx/CardActionsPanel.tsx) so a discounted card
  // doesn't sit looking unaffordable against its full printed cost.
  let parsed = effectiveCastCost(def, player);
  // "Tiered (Choose one additional cost.)" (Vincent's Limit Break) - the
  // chosen tier's own cost is paid ON TOP OF the card's printed (and
  // otherwise-reduced) cost, not instead of it.
  if (def.tieredModes && chosenTierIndex !== undefined) {
    const tierCost = parseCostLabel(def.tieredModes[chosenTierIndex].additionalCost);
    const mergedColors: Partial<Record<Exclude<ManaColor, 'C'>, number>> = { ...parsed.colors };
    for (const [color, amount] of Object.entries(tierCost.colors)) {
      const key = color as Exclude<ManaColor, 'C'>;
      mergedColors[key] = (mergedColors[key] ?? 0) + (amount ?? 0);
    }
    parsed = { generic: parsed.generic + tierCost.generic, colors: mergedColors, hasX: parsed.hasX || tierCost.hasX };
  }
  const extraGeneric = (parsed.hasX ? chosenX ?? 0 : 0) + commanderTax;

  if (!mutual && !free && !canPay(player.manaPool, parsed, extraGeneric)) {
    return { ok: false, error: `Not enough mana to cast ${def.name}${commanderTax > 0 ? ` (includes +${commanderTax} commander tax)` : ''}.` };
  }

  // "Kicker - [cost]" (see CardDefinition.kicker) - validated up front,
  // alongside the mana cost, so an illegal kicker payment fails the whole
  // cast rather than leaving mana already spent.
  const wasKicked = !!(def.kicker && kickerPaymentInstanceId);
  let kickerCard: CardInstance | undefined;
  if (wasKicked) {
    kickerCard = player.zones.battlefield.find((c) => c.instanceId === kickerPaymentInstanceId);
    if (!kickerCard) return { ok: false, error: 'That is not a legal Kicker payment - it must be a permanent you control.' };
    const kickerCardDef = getCardDefinition(kickerCard.defId);
    if (def.kicker!.cost === 'returnLandToHand' && kickerCardDef.type !== 'land') {
      return { ok: false, error: 'Kicker requires returning a land you control to its owner’s hand.' };
    }
    if (def.kicker!.cost === 'sacrificeCreatureOrArtifact' && !matchesSacrificeFilter(kickerCardDef, kickerCard, 'creatureOrArtifact')) {
      return { ok: false, error: 'Kicker requires sacrificing a creature or artifact you control.' };
    }
  }

  let next = state;
  if (!mutual && !free) next = updatePlayer(next, playerId, (p) => ({ ...p, manaPool: payCost(p.manaPool, parsed, extraGeneric) }));
  if (wasKicked && kickerCard) {
    const kickerCardDef = getCardDefinition(kickerCard.defId);
    if (def.kicker!.cost === 'returnLandToHand') {
      next = detachEverythingFrom(next, kickerCard.instanceId);
      next = updatePlayer(next, playerId, (p) => ({
        ...p,
        zones: {
          ...p.zones,
          battlefield: p.zones.battlefield.filter((c) => c.instanceId !== kickerCard!.instanceId),
          hand: [...p.zones.hand, { ...kickerCard!, tapped: false, attachedToInstanceId: undefined }],
        },
      }));
      next = { ...next, log: [...next.log, `${player.name} pays Kicker by returning ${kickerCardDef.name} to their hand.`] };
    } else {
      const sacResult = moveCreaturesToGraveyardAndTrigger(next, [kickerCard.instanceId], 'is sacrificed');
      next = sacResult.state;
      next = { ...next, log: [...next.log, `${player.name} pays Kicker by sacrificing ${kickerCardDef.name}.`, ...sacResult.logLines] };
    }
  }
  // "The first legendary creature spell you cast each turn costs [N] less"
  // (Serah Farron, Crystallized Serah) - the discount itself is already
  // folded into `parsed` above (see engine/mana.ts: dynamicCostReduction),
  // this just marks it used so a SECOND legendary creature spell this turn
  // doesn't also get discounted.
  if (
    !mutual &&
    def.type === 'creature' &&
    def.subtype?.toLowerCase().includes('legendary') &&
    !player.usedFirstLegendaryCreatureSpellDiscountThisTurn &&
    player.zones.battlefield.some((c) => getCardDefinition(c.defId).reducesCastCostForFirstLegendaryCreatureSpellEachTurn)
  ) {
    next = updatePlayer(next, playerId, (p) => ({ ...p, usedFirstLegendaryCreatureSpellDiscountThisTurn: true }));
  }
  next = updatePlayer(next, playerId, (p) => ({
    ...p,
    zones: { ...p.zones, [sourceZone as 'hand' | 'commander']: p.zones[sourceZone as 'hand' | 'commander'].filter((c) => c.instanceId !== instanceId) },
  }));

  const isPermanent = def.type === 'creature' || def.type === 'artifact' || def.type === 'enchantment';
  const targetZone: ZoneName = isPermanent ? 'battlefield' : 'graveyard';
  // Board-granted haste (The Fire Crystal's "Creatures you control have
  // haste", Ardyn's Demon anthem) only ever gets ONE chance to matter: right
  // here, at entry - nothing rechecks it dynamically afterward, so a
  // creature that enters WHILE the anthem source is already out gets it,
  // but one that was already summoning-sick before the anthem existed
  // never retroactively does. See types.ts: staticAnthemForControlledSubtype.
  const hasHaste = hasKeyword(def, 'haste') || (def.type === 'creature' && hasBoardGrantedKeyword(state, playerId, card, def, 'haste'));
  // Commander Tax itself doesn't change here - it's already sitting on the
  // card's own counters (carried along by the spread above) and only ever
  // goes up when the commander returns to the command zone, not when it's
  // cast from there - see engine/combat.ts: resolvePendingDeaths. A stale
  // 'lore' counter (e.g. from a Saga that was bounced to hand mid-chapters)
  // is stripped by stripSagaProgress so this fresh cast always starts its
  // chapters over, same as any other fresh entrance.
  let movedCard = stripSagaProgress({ ...card, tapped: isPermanent && !!def.entersTapped, damageMarked: 0, summoningSick: def.type === 'creature' ? !hasHaste : false });

  // "When you next cast a creature spell this turn, [bonus]" (Summon:
  // Fenrir's Heavenward Howl, Summon: Brynhildr's Gestalt Mode) - consumed
  // by THIS spell if it qualifies (a creature spell, same controller).
  const nextSpellBonus = def.type === 'creature' ? next.pendingNextCreatureSpellBonus : null;
  if (nextSpellBonus && nextSpellBonus.controllerId === playerId) {
    if (nextSpellBonus.counterLabel && nextSpellBonus.counterAmount) {
      movedCard = { ...movedCard, counters: [...movedCard.counters, { label: nextSpellBonus.counterLabel, amount: nextSpellBonus.counterAmount }] };
    }
    if (nextSpellBonus.grantsHaste) movedCard = { ...movedCard, summoningSick: false };
    next = { ...next, pendingNextCreatureSpellBonus: null };
  }

  next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, [targetZone]: [...p.zones[targetZone], movedCard] } }));
  next = checkLegendRule(next, playerId);

  let effectLogLines: string[] = [];
  // A modal spell's chosen modes replace onCast entirely - resolved in the
  // order the modes are printed, regardless of the order they were picked in.
  const autoEffects = def.chooseModes
    ? def.chooseModes.flatMap((mode, i) => (chosenModeIndices!.includes(i) ? mode.effects : []))
    : def.tieredModes
      ? def.tieredModes[chosenTierIndex!].effects
      : isPermanent
        ? def.onEnter
        : def.onCast;
  if (autoEffects && autoEffects.length > 0) {
    const resolved = resolveCardEffects(next, playerId, autoEffects, movedCard.instanceId, wasKicked, chosenX);
    next = resolved.state;
    effectLogLines = resolved.logLines;
  }

  if (isPermanent && def.saga) {
    const sagaResult = triggerSagaLoreCounter(next, playerId, movedCard.instanceId);
    next = sagaResult.state;
    effectLogLines = [...effectLogLines, ...sagaResult.logLines];
  }

  if (def.type === 'artifact') {
    const artifactWatchResult = triggerArtifactEnterWatchers(next, playerId);
    next = artifactWatchResult.state;
    effectLogLines = [...effectLogLines, ...artifactWatchResult.logLines];
  }

  if (isPermanent) {
    const subtypeWatchResult = triggerSubtypeEnterWatchers(next, playerId, def.subtype);
    next = subtypeWatchResult.state;
    effectLogLines = [...effectLogLines, ...subtypeWatchResult.logLines];
  }

  if (def.type === 'creature') {
    const creatureWatchResult = triggerCreatureEnterWatchers(next, playerId, movedCard.instanceId);
    next = creatureWatchResult.state;
    effectLogLines = [...effectLogLines, ...creatureWatchResult.logLines];
  }

  if (def.type !== 'creature') {
    const triggered = triggerNoncreatureCastAbilities(next, playerId, manaValue(parsed) + extraGeneric, preCastBattlefieldIds);


    next = triggered.state;
    effectLogLines = [...effectLogLines, ...triggered.logLines];
  }

  const xNote = parsed.hasX ? ` (X=${chosenX ?? 0})` : '';
  const taxNote = commanderTax > 0 ? ` (+${commanderTax} commander tax paid)` : '';
  const freeNote = mutual ? ' (free - Mutual Adjustment active)' : '';
  return { ok: true, state: { ...next, log: [...next.log, `${player.name} casts ${def.name}${xNote}${taxNote}${freeNote}.`, ...effectLogLines] } };
}

/** "Flashback N" - cast this once from the graveyard for its flashback cost, then it's exiled instead of going to the graveyard again. */
function castFromGraveyard(state: GameState, playerId: string, instanceId: string, chosenX?: number): ActionResult {
  const player = getPlayer(state, playerId);
  const mutual = isMutualActive(state);
  const preCastBattlefieldIds = new Set(player.zones.battlefield.map((c) => c.instanceId));

  const card = player.zones.graveyard.find((c) => c.instanceId === instanceId);
  if (!card) return { ok: false, error: 'That card is not in your graveyard.' };

  const def = getCardDefinition(card.defId);
  if (!def.flashback) return { ok: false, error: `${def.name} has no flashback ability.` };

  if (!mutual && def.type !== 'instant' && !hasKeyword(def, 'flash')) {
    if (state.activePlayerId !== playerId) return { ok: false, error: `${def.name} can only be cast on your own turn (no flash).` };
    if (state.phase !== 'main1' && state.phase !== 'main2') return { ok: false, error: `${def.name} can only be cast during a main phase (no flash).` };
  }

  const parsed = parseCostLabel(def.flashback.cost);
  const extraGeneric = parsed.hasX ? chosenX ?? 0 : 0;

  if (!mutual && !canPay(player.manaPool, parsed, extraGeneric)) {
    return { ok: false, error: `Not enough mana to flashback ${def.name} (${def.flashback.cost}).` };
  }

  let next = state;
  if (!mutual) next = updatePlayer(next, playerId, (p) => ({ ...p, manaPool: payCost(p.manaPool, parsed, extraGeneric) }));
  next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, graveyard: p.zones.graveyard.filter((c) => c.instanceId !== instanceId) } }));

  const isPermanent = def.type === 'creature' || def.type === 'artifact' || def.type === 'enchantment';
  const targetZone: ZoneName = isPermanent ? 'battlefield' : 'exile';
  const hasHaste = hasKeyword(def, 'haste') || (def.type === 'creature' && hasBoardGrantedKeyword(state, playerId, card, def, 'haste'));
  let movedCard = stripSagaProgress({ ...card, tapped: isPermanent && !!def.entersTapped, damageMarked: 0, summoningSick: def.type === 'creature' ? !hasHaste : false });

  const nextSpellBonus = def.type === 'creature' ? next.pendingNextCreatureSpellBonus : null;
  if (nextSpellBonus && nextSpellBonus.controllerId === playerId) {
    if (nextSpellBonus.counterLabel && nextSpellBonus.counterAmount) {
      movedCard = { ...movedCard, counters: [...movedCard.counters, { label: nextSpellBonus.counterLabel, amount: nextSpellBonus.counterAmount }] };
    }
    if (nextSpellBonus.grantsHaste) movedCard = { ...movedCard, summoningSick: false };
    next = { ...next, pendingNextCreatureSpellBonus: null };
  }

  next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, [targetZone]: [...p.zones[targetZone], movedCard] } }));
  next = checkLegendRule(next, playerId);

  let effectLogLines: string[] = [];
  // See types.ts: FlashbackAbility.effects - only set when this specific
  // card's flashback behaves genuinely differently from casting it plainly
  // (The Final Days' "create X tokens instead" via flashback). Every other
  // flashback card here has no override, so this just falls through to the
  // same onEnter/onCast a normal cast would use.
  const autoEffects = def.flashback.effects ?? (isPermanent ? def.onEnter : def.onCast);
  if (autoEffects && autoEffects.length > 0) {
    const resolved = resolveCardEffects(next, playerId, autoEffects, movedCard.instanceId);
    next = resolved.state;
    effectLogLines = resolved.logLines;
  }

  if (isPermanent && def.saga) {
    const sagaResult = triggerSagaLoreCounter(next, playerId, movedCard.instanceId);
    next = sagaResult.state;
    effectLogLines = [...effectLogLines, ...sagaResult.logLines];
  }

  if (def.type === 'artifact') {
    const artifactWatchResult = triggerArtifactEnterWatchers(next, playerId);
    next = artifactWatchResult.state;
    effectLogLines = [...effectLogLines, ...artifactWatchResult.logLines];
  }

  if (isPermanent) {
    const subtypeWatchResult = triggerSubtypeEnterWatchers(next, playerId, def.subtype);
    next = subtypeWatchResult.state;
    effectLogLines = [...effectLogLines, ...subtypeWatchResult.logLines];
  }

  if (def.type === 'creature') {
    const creatureWatchResult = triggerCreatureEnterWatchers(next, playerId, movedCard.instanceId);
    next = creatureWatchResult.state;
    effectLogLines = [...effectLogLines, ...creatureWatchResult.logLines];
  }

  if (def.type !== 'creature') {
    const triggered = triggerNoncreatureCastAbilities(next, playerId, manaValue(parsed) + extraGeneric, preCastBattlefieldIds);


    next = triggered.state;
    effectLogLines = [...effectLogLines, ...triggered.logLines];
  }

  const xNote = parsed.hasX ? ` (X=${chosenX ?? 0})` : '';
  const freeNote = mutual ? ' (free - Mutual Adjustment active)' : '';
  const exileNote = isPermanent ? '' : ', then it is exiled';
  return { ok: true, state: { ...next, log: [...next.log, `${player.name} casts ${def.name} via flashback${xNote}${freeNote}${exileNote}.`, ...effectLogLines] } };
}

/** Casts a card sitting in ANY player's exile zone using a GameState.exilePlayGrants
 * entry (Lightning, Security Sergeant's persistent "you may play that card
 * for as long as you control Lightning", and Reno and Rude's this-turn/
 * any-mana grant) - unlike castFromGraveyard (always the same player's own
 * card from their own graveyard), the grant holder and the exiled card's
 * owner can be different players (Reno and Rude exiles a card from the
 * OPPONENT's library), so ownership is always read off the card itself
 * rather than assumed to equal playerId. */
function castFromExile(state: GameState, playerId: string, instanceId: string, chosenX?: number): ActionResult {
  const mutual = isMutualActive(state);
  const found = findCardAnywhere(state, instanceId);
  if (!found || found.zone !== 'exile') return { ok: false, error: 'That card is not in exile.' };
  const card = found.card;
  const ownerId = found.ownerPlayerId;

  const grant = state.exilePlayGrants.find((g) => g.instanceId === instanceId && g.playerId === playerId);
  if (!grant) return { ok: false, error: 'You do not have permission to play that card.' };
  if (grant.requiresControlOfInstanceId) {
    const controllerBoard = getPlayer(state, playerId).zones.battlefield;
    if (!controllerBoard.some((c) => c.instanceId === grant.requiresControlOfInstanceId)) {
      return { ok: false, error: 'You no longer control the source of that permission.' };
    }
  }

  const def = getCardDefinition(card.defId);
  const player = getPlayer(state, playerId);
  const preCastBattlefieldIds = new Set(player.zones.battlefield.map((c) => c.instanceId));

  // "Playing" an exiled LAND this way still counts as your land drop for the
  // turn, same limit castCard's land branch enforces - it doesn't go through
  // the mana-cost payment path below at all (lands have no cost).
  if (def.type === 'land') {
    if (!mutual) {
      if (state.activePlayerId !== playerId) return { ok: false, error: 'You can only play a land on your own turn.' };
      if (player.landsPlayedThisTurn >= maxLandsPerTurn(state, playerId)) return { ok: false, error: "You've already played a land this turn." };
    }
    let next = updatePlayer(state, ownerId, (p) => ({ ...p, zones: { ...p.zones, exile: p.zones.exile.filter((c) => c.instanceId !== instanceId) } }));
    next = { ...next, exilePlayGrants: next.exilePlayGrants.filter((g) => !(g.instanceId === instanceId && g.playerId === playerId)) };
    const movedCard = { ...card, tapped: !!def.entersTapped, damageMarked: 0, summoningSick: false };
    next = updatePlayer(next, playerId, (p) => ({
      ...p,
      zones: { ...p.zones, battlefield: [...p.zones.battlefield, movedCard] },
      hasPlayedLandThisTurn: mutual ? p.hasPlayedLandThisTurn : true,
      landsPlayedThisTurn: mutual ? p.landsPlayedThisTurn : p.landsPlayedThisTurn + 1,
    }));
    next = checkLegendRule(next, playerId);
    let landEffectLogLines: string[] = [];
    if (def.onEnter && def.onEnter.length > 0) {
      const resolved = resolveCardEffects(next, playerId, def.onEnter, movedCard.instanceId);
      next = resolved.state;
      landEffectLogLines = resolved.logLines;
    }
    const landfallResult = triggerLandfall(next, playerId);
    next = landfallResult.state;
    landEffectLogLines = [...landEffectLogLines, ...landfallResult.logLines];
    return { ok: true, state: { ...next, log: [...next.log, `${player.name} plays ${def.name} from exile.`, ...landEffectLogLines] } };
  }

  if (!mutual && def.type !== 'instant' && !hasKeyword(def, 'flash')) {
    if (state.activePlayerId !== playerId) return { ok: false, error: `${def.name} can only be cast on your own turn (no flash).` };
    if (state.phase !== 'main1' && state.phase !== 'main2') return { ok: false, error: `${def.name} can only be cast during a main phase (no flash).` };
  }

  const parsed = parseCostLabel(def.costLabel);
  const extraGeneric = parsed.hasX ? chosenX ?? 0 : 0;
  const colorPips = Object.values(parsed.colors).reduce((a: number, b) => a + (b ?? 0), 0);
  const effectiveParsed = grant.anyColorMana ? { generic: parsed.generic + colorPips, colors: {}, hasX: parsed.hasX } : parsed;

  if (!mutual && !canPay(player.manaPool, effectiveParsed, extraGeneric)) {
    return { ok: false, error: `Not enough mana to cast ${def.name} (${def.costLabel}).` };
  }

  let next = state;
  if (!mutual) next = updatePlayer(next, playerId, (p) => ({ ...p, manaPool: payCost(p.manaPool, effectiveParsed, extraGeneric) }));
  next = updatePlayer(next, ownerId, (p) => ({ ...p, zones: { ...p.zones, exile: p.zones.exile.filter((c) => c.instanceId !== instanceId) } }));
  next = { ...next, exilePlayGrants: next.exilePlayGrants.filter((g) => !(g.instanceId === instanceId && g.playerId === playerId)) };

  const isPermanent = def.type === 'creature' || def.type === 'artifact' || def.type === 'enchantment';
  const hasHaste = hasKeyword(def, 'haste') || (def.type === 'creature' && hasBoardGrantedKeyword(state, playerId, card, def, 'haste'));
  const movedCard = stripSagaProgress({ ...card, tapped: isPermanent && !!def.entersTapped, damageMarked: 0, summoningSick: def.type === 'creature' ? !hasHaste : false });

  if (isPermanent) {
    next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, battlefield: [...p.zones.battlefield, movedCard] } }));
    next = checkLegendRule(next, playerId);
  } else {
    next = updatePlayer(next, ownerId, (p) => ({ ...p, zones: { ...p.zones, graveyard: [...p.zones.graveyard, movedCard] } }));
  }

  let effectLogLines: string[] = [];
  const autoEffects = isPermanent ? def.onEnter : def.onCast;
  if (autoEffects && autoEffects.length > 0) {
    const resolved = resolveCardEffects(next, playerId, autoEffects, movedCard.instanceId);
    next = resolved.state;
    effectLogLines = resolved.logLines;
  }

  if (isPermanent && def.saga) {
    const sagaResult = triggerSagaLoreCounter(next, playerId, movedCard.instanceId);
    next = sagaResult.state;
    effectLogLines = [...effectLogLines, ...sagaResult.logLines];
  }

  if (def.type === 'artifact') {
    const artifactWatchResult = triggerArtifactEnterWatchers(next, playerId);
    next = artifactWatchResult.state;
    effectLogLines = [...effectLogLines, ...artifactWatchResult.logLines];
  }

  if (isPermanent) {
    const subtypeWatchResult = triggerSubtypeEnterWatchers(next, playerId, def.subtype);
    next = subtypeWatchResult.state;
    effectLogLines = [...effectLogLines, ...subtypeWatchResult.logLines];
  }

  if (def.type === 'creature') {
    const creatureWatchResult = triggerCreatureEnterWatchers(next, playerId, movedCard.instanceId);
    next = creatureWatchResult.state;
    effectLogLines = [...effectLogLines, ...creatureWatchResult.logLines];
  }

  if (def.type !== 'creature') {
    const triggered = triggerNoncreatureCastAbilities(next, playerId, manaValue(effectiveParsed) + extraGeneric, preCastBattlefieldIds);
    next = triggered.state;
    effectLogLines = [...effectLogLines, ...triggered.logLines];
  }

  const xNote = parsed.hasX ? ` (X=${chosenX ?? 0})` : '';
  return { ok: true, state: { ...next, log: [...next.log, `${player.name} plays ${def.name} from exile${xNote}.`, ...effectLogLines] } };
}

/** "Then you may sacrifice another creature or artifact. If you do, you may
 * play the exiled card this turn, and mana of any type can be spent to cast
 * it" (Reno and Rude, ExileTopOfTargetPlayerLibraryThenOptionalSacrificeToPlayEffect) -
 * instanceId: null declines (no permission granted). */
function resolveOptionalSacrificeForExilePlay(state: GameState, playerId: string, instanceId: string | null): ActionResult {
  const pending = state.pendingOptionalSacrificeForExilePlay;
  if (!pending) return { ok: false, error: 'Nothing is waiting on that choice right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your choice to make." };

  if (instanceId === null) {
    return { ok: true, state: { ...state, pendingOptionalSacrificeForExilePlay: null } };
  }

  const player = getPlayer(state, playerId);
  const card = player.zones.battlefield.find((c) => c.instanceId === instanceId);
  if (!card || instanceId === pending.sourceInstanceId || !matchesSacrificeFilter(getCardDefinition(card.defId), card, 'creatureOrArtifact')) {
    return { ok: false, error: 'You must sacrifice another creature or artifact.' };
  }
  const def = getCardDefinition(card.defId);

  const sacResult = moveCreaturesToGraveyardAndTrigger(state, [instanceId], 'is sacrificed');
  let next = sacResult.state;
  next = {
    ...next,
    pendingOptionalSacrificeForExilePlay: null,
    exilePlayGrants: [...next.exilePlayGrants, { instanceId: pending.exiledInstanceId, playerId, anyColorMana: true, expiresAtCleanup: true }],
  };

  return { ok: true, state: { ...next, log: [...next.log, `${player.name} sacrifices ${def.name}.`, ...sacResult.logLines] } };
}

/**
 * Places one of a pendingReveal's still-unassigned cards according to the
 * current step, then either advances to the next step or - once at most one
 * card would be left to choose between - auto-resolves everything remaining
 * to remainderDestination and clears pendingReveal. See types.ts: RevealAndDivideEffect.
 */
function chooseRevealedCard(state: GameState, playerId: string, instanceId: string): ActionResult {
  const pending = state.pendingReveal;
  if (!pending) return { ok: false, error: 'No reveal is waiting for a choice right now.' };
  const step = pending.steps[pending.stepIndex];
  if (!step) return { ok: false, error: 'No more choices to make for this reveal.' };

  const expectedChooserId = step.chooser === 'you' ? pending.controllerId : getOpponent(state, pending.controllerId).id;
  if (playerId !== expectedChooserId) return { ok: false, error: "It's not your choice to make." };

  const card = pending.revealed.find((c) => c.instanceId === instanceId);
  if (!card) return { ok: false, error: 'That card is not part of the current reveal.' };

  const owner = getPlayer(state, pending.controllerId);
  const remaining = pending.revealed.filter((c) => c.instanceId !== instanceId);

  function place(s: GameState, c: CardInstance, destination: 'hand' | 'bottomOfLibrary'): GameState {
    return updatePlayer(s, pending!.controllerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        hand: destination === 'hand' ? [...p.zones.hand, c] : p.zones.hand,
        library: destination === 'bottomOfLibrary' ? [...p.zones.library, c] : p.zones.library,
      },
    }));
  }

  let next = place(state, card, step.destination);
  const chooser = getPlayer(next, playerId);
  const destLabel = (d: 'hand' | 'bottomOfLibrary') => (d === 'hand' ? `${owner.name}'s hand` : `the bottom of ${owner.name}'s library`);
  const def = getCardDefinition(card.defId);
  const logLines = [`${chooser.name} puts ${def.name} into ${destLabel(step.destination)}.`];

  const nextStepIndex = pending.stepIndex + 1;
  if (remaining.length <= 1 || nextStepIndex >= pending.steps.length) {
    for (const c of remaining) {
      next = place(next, c, pending.remainderDestination);
      logLines.push(`${getCardDefinition(c.defId).name} automatically goes to ${destLabel(pending.remainderDestination)}.`);
    }
    next = { ...next, pendingReveal: null };
  } else {
    next = { ...next, pendingReveal: { ...pending, revealed: remaining, stepIndex: nextStepIndex } };
  }

  return { ok: true, state: { ...next, log: [...next.log, ...logLines] } };
}

function activateAbility(state: GameState, playerId: string, instanceId: string, abilityId: string, costTargetInstanceIds?: string[]): ActionResult {
  const found = findCardAnywhere(state, instanceId);
  if (!found) return { ok: false, error: "That card couldn't be found." };
  const def = getCardDefinition(found.card.defId);
  const ability = def.abilities?.find((a) => a.id === abilityId);
  if (!ability) return { ok: false, error: `${def.name} has no such ability.` };
  // A permanent's activated ability - {T}-cost ones especially, but really
  // any of them - only makes sense once the card is actually a permanent ON
  // the battlefield, not still sitting in hand (or anywhere else) as a
  // card. Real MTG rules: you cast/play the card first, THEN activate what
  // it does once it's out - there's no such thing as tapping a card in your
  // hand. returnFromGraveyardTransformed and returnSelfFromGraveyard are the
  // deliberate exceptions (Garland, Knight of Cornelia and Relentless
  // X-ATM092's own abilities explicitly live in the graveyard instead).
  if (ability.returnFromGraveyardTransformed || ability.returnSelfFromGraveyard) {
    if (found.zone !== 'graveyard') return { ok: false, error: `${ability.label} can only be activated from the graveyard.` };
  } else if (found.zone !== 'battlefield') {
    return { ok: false, error: `${def.name} must be on the battlefield before you can activate ${ability.label} - cast or play it first.` };
  }

  const owner = getPlayer(state, found.ownerPlayerId);
  const mutual = isMutualActive(state);
  // "This ability costs [N] less to activate for each [subtype] you
  // control" (Qiqirn Merchant) - reduces the GENERIC portion only, capped
  // at 0, same as every spell-level cost reduction (engine/mana.ts:
  // dynamicCostReduction) but scoped to this one activated ability's cost.
  const rawManaCost = ability.cost.manaLabel ? parseCostLabel(ability.cost.manaLabel) : null;
  const abilityCostReduction = ability.cost.reducePerControlledSubtype
    ? ability.cost.reducePerControlledSubtype.amountPerUnit *
      owner.zones.battlefield.filter((c) => getCardDefinition(c.defId).subtype?.toLowerCase().includes(ability.cost.reducePerControlledSubtype!.subtype.toLowerCase())).length
    : 0;
  const manaCost = rawManaCost ? { ...rawManaCost, generic: Math.max(0, rawManaCost.generic - abilityCostReduction) } : null;

  let sacrificeTargets: CardInstance[] = [];
  if (ability.cost.sacrificeAnother) {
    const neededCount = ability.cost.sacrificeAnotherCount ?? 1;
    const ids = costTargetInstanceIds ?? [];
    if (ids.length !== neededCount || new Set(ids).size !== ids.length) {
      return { ok: false, error: `${ability.label} requires choosing ${neededCount} other permanent${neededCount === 1 ? '' : 's'} to sacrifice.` };
    }
    const candidates: CardInstance[] = [];
    for (const id of ids) {
      const candidate = owner.zones.battlefield.find((c) => c.instanceId === id);
      if (!candidate || candidate.instanceId === instanceId) {
        return { ok: false, error: `${ability.label} requires sacrificing ANOTHER permanent you control.` };
      }
      const candidateDef = getCardDefinition(candidate.defId);
      const matchesFilter =
        ability.cost.sacrificeAnother === 'artifactOrCreature'
          ? candidateDef.type === 'artifact' || candidateDef.type === 'creature'
          : candidateDef.type === ability.cost.sacrificeAnother;
      if (!matchesFilter) return { ok: false, error: `${ability.label} requires sacrificing a ${ability.cost.sacrificeAnother}.` };
      candidates.push(candidate);
    }
    sacrificeTargets = candidates;
  }

  if (!mutual && ability.onlyDuringOwnEndStep && (state.phase !== 'end' || state.activePlayerId !== found.ownerPlayerId)) {
    return { ok: false, error: `${ability.label} can only be activated during your own end step.` };
  }
  if (!mutual && ability.onlyDuringOwnFirstMainPhase && (state.phase !== 'main1' || state.activePlayerId !== found.ownerPlayerId)) {
    return { ok: false, error: `${ability.label} can only be activated during your own first main phase.` };
  }
  if (!mutual && ability.onlyDuringOwnUpkeep && (state.phase !== 'upkeep' || state.activePlayerId !== found.ownerPlayerId)) {
    return { ok: false, error: `${ability.label} can only be activated during your own upkeep.` };
  }
  if (!mutual && ability.onlyDuringOwnMainPhase && ((state.phase !== 'main1' && state.phase !== 'main2') || state.activePlayerId !== found.ownerPlayerId)) {
    return { ok: false, error: `${ability.label} can only be activated as a sorcery (your own turn, either main phase).` };
  }
  if (ability.requiresGraveyardSize && owner.zones.graveyard.length < ability.requiresGraveyardSize) {
    return { ok: false, error: `${ability.label} requires at least ${ability.requiresGraveyardSize} cards in your graveyard.` };
  }
  if (ability.requiresControlledLegendaryCreatureCount) {
    const legendaryCreatureCount = owner.zones.battlefield.filter(
      (c) => getCardDefinition(c.defId).type === 'creature' && getCardDefinition(c.defId).subtype?.toLowerCase().includes('legendary')
    ).length;
    if (legendaryCreatureCount < ability.requiresControlledLegendaryCreatureCount) {
      return { ok: false, error: `${ability.label} requires controlling at least ${ability.requiresControlledLegendaryCreatureCount} legendary creatures.` };
    }
  }
  let meldPartner: CardInstance | null = null;
  if (ability.meldsWith) {
    meldPartner = owner.zones.battlefield.find((c) => c.defId === ability.meldsWith!.partnerDefId && c.ownerId === found.ownerPlayerId) ?? null;
    if (!meldPartner) {
      return { ok: false, error: `${ability.label} requires you to also own and control ${getCardDefinition(ability.meldsWith.partnerDefId).name}.` };
    }
  }
  if (!mutual && ability.cost.tap && def.type === 'creature' && found.card.summoningSick) {
    return { ok: false, error: `${def.name} has summoning sickness and can't use a tap ability yet.` };
  }
  if (ability.cost.tap && found.card.tapped) return { ok: false, error: `${def.name} is already tapped.` };
  if (!mutual && manaCost && !canPay(owner.manaPool, manaCost, 0)) return { ok: false, error: `Not enough mana to activate ${ability.label}.` };
  const exileCost = ability.cost.exileFromGraveyard ?? 0;
  if (exileCost > 0 && owner.zones.graveyard.length < exileCost) {
    return { ok: false, error: `Not enough cards in your graveyard to activate ${ability.label} (needs ${exileCost}).` };
  }
  if (ability.cost.payLife && owner.life < ability.cost.payLife) {
    return { ok: false, error: `Not enough life to activate ${ability.label} (needs ${ability.cost.payLife}).` };
  }
  // "...and its activated abilities can't be activated" (Stuck in Summoner's
  // Sanctum) - same cross-battlefield attach lookup as runUntapStep's
  // attachedPreventsUntap, since an Aura may be attached from either side.
  if (found.zone === 'battlefield' && state.players.some((p) => p.zones.battlefield.some((c) => c.attachedToInstanceId === instanceId && getCardDefinition(c.defId).attachedPreventsAbilities))) {
    return { ok: false, error: `${def.name}'s activated abilities can't be activated.` };
  }

  let next = state;
  if (!mutual && manaCost) next = updatePlayer(next, found.ownerPlayerId, (p) => ({ ...p, manaPool: payCost(p.manaPool, manaCost, 0) }));
  if (ability.cost.payLife) next = loseLife(next, found.ownerPlayerId, ability.cost.payLife);
  if (ability.cost.tap) {
    next = updatePlayer(next, found.ownerPlayerId, (p) => ({
      ...p,
      zones: { ...p.zones, [found.zone]: p.zones[found.zone].map((c) => (c.instanceId === instanceId ? { ...c, tapped: true } : c)) },
    }));
  }
  if (ability.cost.sacrificeSelf) {
    next = updatePlayer(next, found.ownerPlayerId, (p) => ({
      ...p,
      zones: { ...p.zones, [found.zone]: p.zones[found.zone].filter((c) => c.instanceId !== instanceId), graveyard: [...p.zones.graveyard, { ...found.card, tapped: false }] },
    }));
  }
  if (ability.cost.exileSelf) {
    next = updatePlayer(next, found.ownerPlayerId, (p) => ({
      ...p,
      zones: { ...p.zones, [found.zone]: p.zones[found.zone].filter((c) => c.instanceId !== instanceId), exile: [...p.zones.exile, { ...found.card, tapped: false }] },
    }));
  }
  let sacrificeTargetLogLines: string[] = [];
  if (sacrificeTargets.length > 0) {
    // Goes through the shared death pipeline (not a plain zone move) so it
    // correctly triggers things like onAnyDeathDrain/onDeathDistributeCounters.
    const sacResult = moveCreaturesToGraveyardAndTrigger(
      next,
      sacrificeTargets.map((c) => c.instanceId),
      'is sacrificed'
    );
    next = sacResult.state;
    sacrificeTargetLogLines = sacResult.logLines;
  }
  if (exileCost > 0) {
    // Which exact cards get exiled is never mechanically relevant elsewhere
    // in this engine - auto-select rather than making the player pick.
    const toExile = getPlayer(next, found.ownerPlayerId).zones.graveyard.slice(0, exileCost);
    next = updatePlayer(next, found.ownerPlayerId, (p) => ({
      ...p,
      zones: { ...p.zones, graveyard: p.zones.graveyard.slice(exileCost), exile: [...p.zones.exile, ...toExile] },
    }));
  }
  let transformedIntoDef = null as ReturnType<typeof getCardDefinition> | null;
  let transformIntoEffectLogLines: string[] = [];
  if (ability.transformSelf && def.transformsInto) {
    const backDefId = def.transformsInto;
    transformedIntoDef = getCardDefinition(backDefId);
    next = updatePlayer(next, found.ownerPlayerId, (p) => ({
      ...p,
      zones: { ...p.zones, [found.zone]: p.zones[found.zone].map((c) => (c.instanceId === instanceId ? stripSagaProgress({ ...c, defId: backDefId }) : c)) },
    }));
    if (transformedIntoDef.grantsExtraTurnOnTransform) {
      next = { ...next, extraTurnsQueued: [...next.extraTurnsQueued, found.ownerPlayerId] };
    }
    if (transformedIntoDef.onTransformInto && transformedIntoDef.onTransformInto.length > 0) {
      const resolved = resolveCardEffects(next, found.ownerPlayerId, transformedIntoDef.onTransformInto, instanceId);
      next = resolved.state;
      transformIntoEffectLogLines = resolved.logLines;
    }
  }

  let exiledAndReturnedDef = null as ReturnType<typeof getCardDefinition> | null;
  let exileReturnLogLines: string[] = [];
  if (ability.exileAndReturnTransformed && def.transformsInto) {
    exiledAndReturnedDef = getCardDefinition(def.transformsInto);
    const result = exileAndReturnTransformed(next, found.ownerPlayerId, instanceId);
    next = checkLegendRule(result.state, found.ownerPlayerId);
    exileReturnLogLines = result.logLines;
  }
  let returnedFromGraveyardDef = null as ReturnType<typeof getCardDefinition> | null;
  if (ability.returnFromGraveyardTransformed && def.transformsInto) {
    returnedFromGraveyardDef = getCardDefinition(def.transformsInto);
    const result = returnFromGraveyardTransformed(next, found.ownerPlayerId, instanceId);
    next = checkLegendRule(result.state, found.ownerPlayerId);
    exileReturnLogLines = result.logLines;
  }
  if (ability.returnSelfFromGraveyard) {
    const result = returnSelfFromGraveyard(next, found.ownerPlayerId, instanceId, ability.returnSelfFromGraveyard);
    next = checkLegendRule(result.state, found.ownerPlayerId);
    exileReturnLogLines = result.logLines;
  }

  let meldedIntoDef = null as ReturnType<typeof getCardDefinition> | null;
  if (ability.meldsWith && meldPartner) {
    const resultDef = getCardDefinition(ability.meldsWith.resultDefId);
    meldedIntoDef = resultDef;
    const partnerId = meldPartner.instanceId;
    next = detachEverythingFrom(next, instanceId);
    next = detachEverythingFrom(next, partnerId);
    const ownerNow = getPlayer(next, found.ownerPlayerId);
    const meldedAway = [ownerNow.zones.battlefield.find((c) => c.instanceId === instanceId), ownerNow.zones.battlefield.find((c) => c.instanceId === partnerId)].filter(
      (c): c is CardInstance => !!c
    );
    next = updatePlayer(next, found.ownerPlayerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: [
          ...p.zones.battlefield.filter((c) => c.instanceId !== instanceId && c.instanceId !== partnerId),
          {
            instanceId: nextInstanceId(),
            defId: resultDef.id,
            ownerId: found.ownerPlayerId,
            tapped: false,
            counters: [],
            damageMarked: 0,
            summoningSick: !hasKeyword(resultDef, 'haste'),
          },
        ],
        exile: [...p.zones.exile, ...meldedAway],
      },
    }));
  }

  let playHideawayLogLines: string[] = [];
  if (ability.playHideawayCard) {
    const selfNow = getPlayer(next, found.ownerPlayerId).zones.battlefield.find((c) => c.instanceId === instanceId);
    const hiddenId = selfNow?.hideawayExiledCardId;
    const hiddenCard = hiddenId ? getPlayer(next, found.ownerPlayerId).zones.exile.find((c) => c.instanceId === hiddenId) : undefined;
    if (!hiddenCard) {
      playHideawayLogLines = [`${def.name} has nothing hidden away to play.`];
    } else {
      const hiddenDef = getCardDefinition(hiddenCard.defId);
      const isPermanent = hiddenDef.type === 'creature' || hiddenDef.type === 'artifact' || hiddenDef.type === 'enchantment' || hiddenDef.type === 'land';
      const hasHaste = hasKeyword(hiddenDef, 'haste');
      const movedCard = stripSagaProgress({
        ...hiddenCard,
        faceDown: undefined,
        tapped: isPermanent && !!hiddenDef.entersTapped,
        damageMarked: 0,
        summoningSick: hiddenDef.type === 'creature' ? !hasHaste : false,
      });
      next = updatePlayer(next, found.ownerPlayerId, (p) => {
        const clearedBattlefield = p.zones.battlefield.map((c) => (c.instanceId === instanceId ? { ...c, hideawayExiledCardId: undefined } : c));
        const exile = p.zones.exile.filter((c) => c.instanceId !== hiddenId);
        return isPermanent
          ? { ...p, zones: { ...p.zones, exile, battlefield: [...clearedBattlefield, movedCard] } }
          : { ...p, zones: { ...p.zones, exile, battlefield: clearedBattlefield, graveyard: [...p.zones.graveyard, movedCard] } };
      });
      next = checkLegendRule(next, found.ownerPlayerId);

      const autoEffects = isPermanent ? hiddenDef.onEnter : hiddenDef.onCast;
      if (autoEffects && autoEffects.length > 0) {
        const resolved = resolveCardEffects(next, found.ownerPlayerId, autoEffects, movedCard.instanceId);
        next = resolved.state;
        playHideawayLogLines = [...playHideawayLogLines, ...resolved.logLines];
      }
      if (isPermanent && hiddenDef.saga) {
        const sagaResult = triggerSagaLoreCounter(next, found.ownerPlayerId, movedCard.instanceId);
        next = sagaResult.state;
        playHideawayLogLines = [...playHideawayLogLines, ...sagaResult.logLines];
      }
      if (hiddenDef.type === 'artifact') {
        const artifactWatchResult = triggerArtifactEnterWatchers(next, found.ownerPlayerId);
        next = artifactWatchResult.state;
        playHideawayLogLines = [...playHideawayLogLines, ...artifactWatchResult.logLines];
      }
      if (!isPermanent) {
        const triggered = triggerNoncreatureCastAbilities(next, found.ownerPlayerId, 0);
        next = triggered.state;
        playHideawayLogLines = [...playHideawayLogLines, ...triggered.logLines];
      }
      playHideawayLogLines = [`${owner.name} plays ${hiddenDef.name} for free from ${def.name}'s hideaway.`, ...playHideawayLogLines];
    }
  }

  let effectLogLines: string[] = [...exileReturnLogLines, ...sacrificeTargetLogLines, ...transformIntoEffectLogLines, ...playHideawayLogLines];
  if (ability.effects && ability.effects.length > 0) {
    const resolved = resolveCardEffects(next, found.ownerPlayerId, ability.effects, instanceId);
    next = resolved.state;
    effectLogLines = [...effectLogLines, ...resolved.logLines];
  }

  let logLine = `${owner.name} activates ${ability.label} on ${def.name}: ${ability.effectText}`;
  if (ability.cost.discardCards) logLine += ` (also discard ${ability.cost.discardCards} card(s) manually as part of the cost)`;
  if (transformedIntoDef) {
    logLine += ` ${def.name} transforms into ${transformedIntoDef.name}.`;
    if (transformedIntoDef.grantsExtraTurnOnTransform) logLine += ` ${owner.name} takes an extra turn after this one.`;
  }
  if (exiledAndReturnedDef) {
    logLine += ` ${def.name} is exiled, then returns to the battlefield transformed into ${exiledAndReturnedDef.name}.`;
    if (exiledAndReturnedDef.grantsExtraTurnOnTransform) logLine += ` ${owner.name} takes an extra turn after this one.`;
  }
  if (returnedFromGraveyardDef) {
    logLine += ` ${def.name} returns from the graveyard to the battlefield transformed into ${returnedFromGraveyardDef.name}.`;
    if (returnedFromGraveyardDef.grantsExtraTurnOnTransform) logLine += ` ${owner.name} takes an extra turn after this one.`;
  }
  if (meldedIntoDef && meldPartner) {
    logLine += ` ${def.name} and ${getCardDefinition(meldPartner.defId).name} are exiled and meld into ${meldedIntoDef.name}.`;
  }

  return { ok: true, state: { ...next, log: [...next.log, logLine, ...effectLogLines] } };
}

function adjustLife(state: GameState, targetPlayerId: string, delta: number): ActionResult {
  if (!isMutualActive(state)) return { ok: false, error: 'Life can only be changed automatically (combat damage) or during Mutual Adjustment.' };
  const target = getPlayer(state, targetPlayerId);
  const next = updatePlayer(state, targetPlayerId, (p) => ({ ...p, life: p.life + delta }));
  const verb = delta >= 0 ? 'gains' : 'loses';
  return { ok: true, state: { ...next, log: [...next.log, `${target.name} ${verb} ${Math.abs(delta)} life (now ${target.life + delta}) [Mutual Adjustment].`] } };
}

function adjustCounter(state: GameState, playerId: string, instanceId: string, label: string, delta: number): ActionResult {
  const found = findCardAnywhere(state, instanceId);
  if (!found) return { ok: false, error: "That card couldn't be found." };
  const next = updatePlayer(state, found.ownerPlayerId, (p) => ({
    ...p,
    zones: {
      ...p.zones,
      [found.zone]: p.zones[found.zone].map((c) => {
        if (c.instanceId !== instanceId) return c;
        const existing = c.counters.find((ctr) => ctr.label === label);
        const newAmount = (existing?.amount ?? 0) + delta;
        const otherCounters = c.counters.filter((ctr) => ctr.label !== label);
        return { ...c, counters: newAmount > 0 ? [...otherCounters, { label, amount: newAmount }] : otherCounters };
      }),
    },
  }));
  return { ok: true, state: next };
}

/** Free, unconditional flip for double-faced cards with no cost to transform.
 * A card whose transform is gated behind a paid ability (see CardAbility.
 * transformSelf) must go through activateAbility instead - this refuses it
 * here so there's no free bypass of that ability's cost/timing. */
function flipCard(state: GameState, instanceId: string): ActionResult {
  const found = findCardAnywhere(state, instanceId);
  if (!found) return { ok: false, error: "That card couldn't be found." };
  const currentDef = getCardDefinition(found.card.defId);
  if (!currentDef.transformsInto) return { ok: false, error: `${currentDef.name} has no back face to flip to.` };
  if (currentDef.abilities?.some((a) => a.transformSelf)) {
    return { ok: false, error: `${currentDef.name} only transforms by paying its ability's cost.` };
  }
  const backDef = getCardDefinition(currentDef.transformsInto);
  let next = updatePlayer(state, found.ownerPlayerId, (p) => ({
    ...p,
    zones: { ...p.zones, [found.zone]: p.zones[found.zone].map((c) => (c.instanceId === instanceId ? stripSagaProgress({ ...c, defId: backDef.id }) : c)) },
  }));
  if (backDef.grantsExtraTurnOnTransform) {
    next = { ...next, extraTurnsQueued: [...next.extraTurnsQueued, found.ownerPlayerId] };
  }
  const extraTurnNote = backDef.grantsExtraTurnOnTransform ? ` ${getPlayer(next, found.ownerPlayerId).name} takes an extra turn after this one.` : '';
  let transformEffectLogLines: string[] = [];
  if (backDef.onTransformInto && backDef.onTransformInto.length > 0) {
    const resolved = resolveCardEffects(next, found.ownerPlayerId, backDef.onTransformInto, instanceId);
    next = resolved.state;
    transformEffectLogLines = resolved.logLines;
  }
  return { ok: true, state: { ...next, log: [...next.log, `${currentDef.name} transforms into ${backDef.name}.${extraTurnNote}`, ...transformEffectLogLines] } };
}

function attachCard(state: GameState, playerId: string, instanceId: string, targetInstanceId: string): ActionResult {
  const found = findCardAnywhere(state, instanceId);
  if (!found || found.zone !== 'battlefield') return { ok: false, error: 'Only a permanent on the battlefield can be attached.' };
  const def = getCardDefinition(found.card.defId);
  if (!def.attachesTo) return { ok: false, error: `${def.name} can't be attached to anything.` };

  const target = findCardAnywhere(state, targetInstanceId);
  if (!target || target.zone !== 'battlefield') return { ok: false, error: 'Target is not on the battlefield.' };
  const targetDef = getCardDefinition(target.card.defId);
  if (target.card.instanceId === instanceId) return { ok: false, error: "A card can't attach to itself." };
  if (def.attachesTo !== 'permanent' && targetDef.type !== def.attachesTo) {
    return { ok: false, error: `${def.name} can only attach to a ${def.attachesTo}.` };
  }

  const mutual = isMutualActive(state);
  const isEquipment = !!def.equipCost;

  // "Equip [cost]" always means "attach to target creature YOU control" -
  // unlike an Aura (attachesTo with no equipCost), which can enchant either
  // player's permanent per its own printed text (e.g. a curse). Checked
  // against the EQUIPMENT's own owner (this engine has no separate
  // control-changing concept), matching every other same-controller equip
  // lookup (equipBuffBonus, equipmentContributions, ...).
  if (!mutual && isEquipment && target.ownerPlayerId !== found.ownerPlayerId) {
    return { ok: false, error: `${def.name} can only be equipped to a creature you control.` };
  }
  // "Hexproof" - can't be the target of anything its controller doesn't
  // control, equip included. No existing pendingTarget path enforces this
  // yet (a broader gap), but equip is the one the rule was explicitly
  // requested for.
  if (!mutual && isEquipment && hasKeyword(targetDef, 'hexproof')) {
    return { ok: false, error: `${targetDef.name} has hexproof and can't be equipped.` };
  }

  if (!mutual && !isEquipment && found.card.attachedToInstanceId) {
    return { ok: false, error: `${def.name} is already attached - Auras don't move once attached.` };
  }

  let next = state;
  if (isEquipment && !mutual) {
    let parsed = parseCostLabel(def.equipCost!);
    // "Equip abilities you activate that target [this] cost N less to
    // activate" (Cloud, Planet's Champion) - reduces the GENERIC portion
    // only, capped at 0, same convention as every other cost reduction here.
    if (targetDef.reducesEquipCostWhenTargetingThis) {
      const reduction = Math.min(parsed.generic, targetDef.reducesEquipCostWhenTargetingThis);
      parsed = { ...parsed, generic: parsed.generic - reduction };
    }
    const owner = getPlayer(state, found.ownerPlayerId);
    if (!canPay(owner.manaPool, parsed, 0)) return { ok: false, error: `Not enough mana to equip ${def.name} (${def.equipCost}).` };
    next = updatePlayer(next, found.ownerPlayerId, (p) => ({ ...p, manaPool: payCost(p.manaPool, parsed, 0) }));
  }

  next = updatePlayer(next, found.ownerPlayerId, (p) => ({
    ...p,
    zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === instanceId ? { ...c, attachedToInstanceId: targetInstanceId } : c)) },
  }));

  const actor = getPlayer(state, playerId);
  return { ok: true, state: { ...next, log: [...next.log, `${actor.name} attaches ${def.name} to ${targetDef.name}.`] } };
}

function detachCard(state: GameState, playerId: string, instanceId: string): ActionResult {
  const found = findCardAnywhere(state, instanceId);
  if (!found || found.zone !== 'battlefield') return { ok: false, error: "That card isn't on the battlefield." };
  const def = getCardDefinition(found.card.defId);
  if (!found.card.attachedToInstanceId) return { ok: false, error: `${def.name} isn't attached to anything.` };

  const next = updatePlayer(state, found.ownerPlayerId, (p) => ({
    ...p,
    zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === instanceId ? { ...c, attachedToInstanceId: undefined } : c)) },
  }));
  const actor = getPlayer(state, playerId);
  return { ok: true, state: { ...next, log: [...next.log, `${actor.name} detaches ${def.name}.`] } };
}

/** Same legality rules declareAttackers itself enforces per creature - used to decide whether the whole combat sequence is worth entering at all. */
/** "As long as this creature has a counter on it, it can attack as though it
 * didn't have defender" (Demon Wall). */
function isEffectivelyDefender(def: CardDefinition, instance: CardInstance): boolean {
  return hasKeyword(def, 'defender') && !(def.ignoresDefenderIfHasCounter && instance.counters.length > 0);
}

function hasLegalAttacker(state: GameState, playerId: string): boolean {
  return getPlayer(state, playerId).zones.battlefield.some((c) => {
    if (c.tapped || c.summoningSick) return false;
    const def = getCardDefinition(c.defId);
    return isEffectivelyCreature(def, c) && !isEffectivelyDefender(def, c);
  });
}

function declareAttackers(state: GameState, playerId: string, instanceIds: string[]): ActionResult {
  if (state.activePlayerId !== playerId) return { ok: false, error: 'Only the active player declares attackers.' };
  if (state.phase !== 'declare_attackers') return { ok: false, error: 'Not currently the declare attackers step.' };

  const player = getPlayer(state, playerId);
  for (const id of instanceIds) {
    const creature = player.zones.battlefield.find((c) => c.instanceId === id);
    if (!creature) return { ok: false, error: 'One of the chosen attackers is not on your battlefield.' };
    if (creature.tapped) return { ok: false, error: 'A tapped creature cannot attack.' };
    if (creature.summoningSick) return { ok: false, error: "A creature with summoning sickness can't attack yet." };
    const def = getCardDefinition(creature.defId);
    if (!isEffectivelyCreature(def, creature)) return { ok: false, error: 'Only creatures can attack.' };
    if (isEffectivelyDefender(def, creature)) return { ok: false, error: `${def.name} has defender and can't attack.` };
  }

  const attackerIds = new Set(instanceIds);
  let next = updatePlayer(state, playerId, (p) => ({
    ...p,
    zones: {
      ...p.zones,
      battlefield: p.zones.battlefield.map((c) => {
        if (!attackerIds.has(c.instanceId)) return c;
        const def = getCardDefinition(c.defId);
        return hasKeyword(def, 'vigilance') || hasBoardGrantedKeyword(state, playerId, c, def, 'vigilance') ? c : { ...c, tapped: true };
      }),
    },
  }));

  const skipBlockers = instanceIds.length === 0;
  next = {
    ...next,
    declaredAttackers: instanceIds,
    combatAssignments: instanceIds.map((id) => ({ attackerInstanceId: id, blockerInstanceIds: [] })),
    phase: skipBlockers ? 'combat_end' : 'declare_blockers',
    combatReadyPlayers: [],
    log: [...next.log, instanceIds.length > 0 ? `${player.name} attacks with ${instanceIds.length} creature(s).` : `${player.name} declares no attackers - skipping straight past blocking.`],
  };

  // "Whenever a creature you control attacks alone, it gains [keyword] until
  // end of turn" (Seifer Almasy, Squall - SeeD Mercenary) - a board-wide
  // watcher: whichever creature ends up as the sole attacker gets the
  // keyword, regardless of which permanent carries the trigger.
  if (instanceIds.length === 1) {
    const watcher = getPlayer(next, playerId).zones.battlefield.find((c) => getCardDefinition(c.defId).attacksAloneGrantsKeyword);
    if (watcher) {
      const keyword = getCardDefinition(watcher.defId).attacksAloneGrantsKeyword!;
      const soloAttacker = getPlayer(next, playerId).zones.battlefield.find((c) => c.instanceId === instanceIds[0])!;
      next = grantTemporaryKeyword(next, instanceIds[0], keyword);
      next = { ...next, log: [...next.log, `${getCardDefinition(soloAttacker.defId).name} attacks alone and gains ${keyword} until end of turn.`] };
    }
  }

  for (const id of instanceIds) {
    const attacker = getPlayer(next, playerId).zones.battlefield.find((c) => c.instanceId === id);
    if (!attacker) continue; // e.g. it already left the battlefield via an earlier attacker's own onAttack effect
    const attackerDef = getCardDefinition(attacker.defId);
    if (attackerDef.onAttack && attackerDef.onAttack.length > 0) {
      const resolved = resolveCardEffects(next, playerId, attackerDef.onAttack, id);
      next = { ...resolved.state, log: [...resolved.state.log, ...resolved.logLines] };
    }
    // "Whenever [this] attacks, you may transform it" (Vincent Valentine) -
    // same pendingOptionalTransform/exileAndReturnTransformed flow as
    // onCombatDamageToPlayerMayTransform (Jecht), just triggered at attack
    // declaration instead of on dealing combat damage. resolveOptionalTransform
    // itself already defers resolving until after combat ends, so setting
    // this mid-combat is safe.
    if (attackerDef.onAttackMayTransform && !next.pendingOptionalTransform) {
      next = { ...next, pendingOptionalTransform: { sourceInstanceId: id, controllerId: playerId } };
    }
    // "Whenever equipped creature attacks, ..." (Genji Glove, Ultima Weapon) -
    // a granted trigger from any Equipment currently attached to this
    // attacker, resolved with the ATTACKER (not the equipment) as source so
    // a self-referencing effect (e.g. UntapSelfIfFirstCombatPhaseOfTurnEffect)
    // targets the creature that's actually attacking. Re-checked against the
    // battlefield fresh (rather than reusing `attacker`) since the onAttack
    // effects just above could have moved it.
    if (!getPlayer(next, playerId).zones.battlefield.some((c) => c.instanceId === id)) continue;
    const equipment = getPlayer(next, playerId).zones.battlefield.filter((c) => c.attachedToInstanceId === id);
    for (const eq of equipment) {
      const eqDef = getCardDefinition(eq.defId);
      if (!eqDef.equipGrantsOnAttack || eqDef.equipGrantsOnAttack.length === 0) continue;
      const resolved = resolveCardEffects(next, playerId, eqDef.equipGrantsOnAttack, id);
      next = { ...resolved.state, log: [...resolved.state.log, ...resolved.logLines] };
    }
  }

  // "Whenever an opponent attacks you, ..." (Lulu, Stern Guardian) - fires
  // once per DEFENDING permanent that has it (not once per attacker), and
  // only when at least one attacker was actually declared - unlike onAttack
  // above, this belongs to the player being attacked, so it's checked
  // against the DEFENDER's battlefield, keyed off `defender.id` as the
  // controller/source for resolveCardEffects even though `playerId` (the
  // attacker) is who triggered it.
  if (instanceIds.length > 0) {
    const defender = getOpponent(next, playerId);
    for (const c of defender.zones.battlefield) {
      const def = getCardDefinition(c.defId);
      if (!def.onOpponentAttacksYou || def.onOpponentAttacksYou.length === 0) continue;
      const resolved = resolveCardEffects(next, defender.id, def.onOpponentAttacksYou, c.instanceId);
      next = { ...resolved.state, log: [...resolved.state.log, ...resolved.logLines] };
    }
  }

  return { ok: true, state: next };
}

function declareBlockers(state: GameState, playerId: string, assignments: CombatAssignment[]): ActionResult {
  const defender = getOpponent(state, state.activePlayerId);
  if (defender.id !== playerId) return { ok: false, error: 'Only the defending player declares blockers.' };
  if (state.phase !== 'declare_blockers') return { ok: false, error: 'Not currently the declare blockers step.' };

  const blockerPlayer = getPlayer(state, playerId);
  const attackerPlayer = getPlayer(state, state.activePlayerId);
  const usedBlockers = new Set<string>();

  for (const assignment of assignments) {
    const attackerCreature = attackerPlayer.zones.battlefield.find((c) => c.instanceId === assignment.attackerInstanceId);
    if (!attackerCreature) return { ok: false, error: 'Unknown attacker in blocking assignment.' };
    const attackerDef = getCardDefinition(attackerCreature.defId);
    const menace = hasKeyword(attackerDef, 'menace') || hasBoardGrantedKeyword(state, attackerPlayer.id, attackerCreature, attackerDef, 'menace');

    if (menace && assignment.blockerInstanceIds.length === 1) {
      return { ok: false, error: `${attackerDef.name} has menace - it must be blocked by two or more creatures, or not at all.` };
    }

    if (assignment.blockerInstanceIds.length > 0 && hasKeywordEffective(attackerDef, attackerCreature, 'unblockable')) {
      return { ok: false, error: `${attackerDef.name} can't be blocked this turn.` };
    }

    for (const blockerId of assignment.blockerInstanceIds) {
      if (usedBlockers.has(blockerId)) return { ok: false, error: 'A creature cannot block more than one attacker.' };
      const blocker = blockerPlayer.zones.battlefield.find((c) => c.instanceId === blockerId);
      if (!blocker) return { ok: false, error: 'One of the chosen blockers is not on your battlefield.' };
      if (blocker.tapped) return { ok: false, error: 'A tapped creature cannot block.' };
      const blockerDef = getCardDefinition(blocker.defId);
      const attackerHasFlying =
        hasKeyword(attackerDef, 'flying') ||
        hasEquipGrantedKeywordDuringOwnTurn(state, attackerPlayer.id, attackerCreature.instanceId, 'flying') ||
        hasSelfGrantedKeywordDuringOwnTurn(state, attackerPlayer.id, attackerDef, 'flying');
      const blockerHasFlyingOrReach =
        hasKeyword(blockerDef, 'flying') ||
        hasKeyword(blockerDef, 'reach') ||
        hasBoardGrantedKeyword(state, blockerPlayer.id, blocker, blockerDef, 'reach') ||
        hasEquipGrantedKeywordDuringOwnTurn(state, blockerPlayer.id, blocker.instanceId, 'flying') ||
        hasSelfGrantedKeywordDuringOwnTurn(state, blockerPlayer.id, blockerDef, 'flying');
      if (attackerHasFlying && !blockerHasFlyingOrReach) {
        return { ok: false, error: `${blockerDef.name} can't block a flying creature (no flying/reach).` };
      }
      usedBlockers.add(blockerId);
    }
  }

  const next: GameState = {
    ...state,
    combatAssignments: state.combatAssignments.map((existing) => assignments.find((a) => a.attackerInstanceId === existing.attackerInstanceId) ?? existing),
    phase: 'combat_damage',
    combatReadyPlayers: [],
    log: [...state.log, `${blockerPlayer.name} declares blockers. Both players must press Resolve Combat before damage happens - cast an instant first if you want.`],
  };

  return { ok: true, state: next };
}

/** The attacking player chooses the order damage is assigned among multiple
 * blockers on one attacker - the defender chose WHICH creatures block, but
 * the attacker decides the order they take damage in (see engine/combat.ts:
 * dealDamagePass, which assigns strictly in blockerInstanceIds order). */
function orderBlockers(state: GameState, playerId: string, attackerInstanceId: string, orderedBlockerIds: string[]): ActionResult {
  if (state.phase !== 'combat_damage') return { ok: false, error: 'Blocker order can only be set before combat damage resolves.' };
  if (state.activePlayerId !== playerId) return { ok: false, error: 'Only the attacking player orders blockers.' };
  const assignment = state.combatAssignments.find((a) => a.attackerInstanceId === attackerInstanceId);
  if (!assignment) return { ok: false, error: 'Unknown attacker.' };
  const current = new Set(assignment.blockerInstanceIds);
  if (current.size !== orderedBlockerIds.length || orderedBlockerIds.some((id) => !current.has(id))) {
    return { ok: false, error: "Blocker order must match that attacker's current blockers exactly." };
  }

  const next: GameState = {
    ...state,
    combatAssignments: state.combatAssignments.map((a) => (a.attackerInstanceId === attackerInstanceId ? { ...a, blockerInstanceIds: orderedBlockerIds } : a)),
  };
  return { ok: true, state: next };
}

function chooseTarget(state: GameState, playerId: string, targetInstanceId: string | null, wardPaid = false, targetPlayerId?: string): ActionResult {
  const pending = state.pendingTarget;
  if (!pending) return { ok: false, error: 'No effect is waiting for a target right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your target to choose." };

  if (pending.effect.type === 'dealDamageToAnyOtherTargetAndSelf') {
    if (!pending.firstInstanceId) {
      // First pick: "target creature you control" - the damage source.
      if (targetInstanceId === null) return { ok: false, error: 'You must choose a creature you control.' };
      const sourceCandidate = findCardAnywhere(state, targetInstanceId);
      if (!sourceCandidate || sourceCandidate.zone !== 'battlefield' || sourceCandidate.ownerPlayerId !== playerId) {
        return { ok: false, error: 'You must choose a creature you control.' };
      }
      const sourceCandidateDef = getCardDefinition(sourceCandidate.card.defId);
      if (sourceCandidateDef.type !== 'creature') return { ok: false, error: 'You must choose a creature you control.' };
      const next = { ...state, pendingTarget: { ...pending, firstInstanceId: targetInstanceId } };
      const actor = getPlayer(next, playerId);
      return { ok: true, state: { ...next, log: [...next.log, `${actor.name} chooses ${sourceCandidateDef.name} - now choose any other target.`] } };
    }

    // Second pick: "any other target" - a creature (either player's,
    // excluding the source) OR a player (including the controller's own -
    // no restriction is stated beyond "other than the source").
    const sourceFound = findCardAnywhere(state, pending.firstInstanceId);
    if (!sourceFound || sourceFound.zone !== 'battlefield') return { ok: false, error: 'The source creature is no longer available.' };
    const sourceDef = getCardDefinition(sourceFound.card.defId);
    const amount = effectivePower(sourceDef, sourceFound.card, state, sourceFound.ownerPlayerId);
    let next = state;
    const logLines: string[] = [];

    if (targetPlayerId) {
      if (!state.players.some((p) => p.id === targetPlayerId)) return { ok: false, error: 'That is not a legal player target.' };
      next = loseLife(next, targetPlayerId, amount);
      logLines.push(`${sourceDef.name} deals ${amount} damage to ${getPlayer(next, targetPlayerId).name}.`);
    } else {
      if (targetInstanceId === null || targetInstanceId === pending.firstInstanceId) {
        return { ok: false, error: 'You must choose a different creature, or a player.' };
      }
      const otherFound = findCardAnywhere(next, targetInstanceId);
      if (!otherFound || otherFound.zone !== 'battlefield') return { ok: false, error: "That's not a legal target - it must be a creature or a player." };
      const otherDef = getCardDefinition(otherFound.card.defId);
      if (otherDef.type !== 'creature') return { ok: false, error: "That's not a legal target - it must be a creature or a player." };
      next = updatePlayer(next, otherFound.ownerPlayerId, (p) => ({
        ...p,
        zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === targetInstanceId ? { ...c, damageMarked: c.damageMarked + amount } : c)) },
      }));
      logLines.push(`${sourceDef.name} deals ${amount} damage to ${otherDef.name}.`);
      const damagedOther = getPlayer(next, otherFound.ownerPlayerId).zones.battlefield.find((c) => c.instanceId === targetInstanceId);
      const otherLethal =
        !!damagedOther &&
        !hasKeywordEffective(otherDef, damagedOther, 'indestructible') &&
        !hasBoardGrantedKeyword(next, otherFound.ownerPlayerId, damagedOther, otherDef, 'indestructible') &&
        damagedOther.damageMarked >= effectiveToughness(otherDef, damagedOther, next, otherFound.ownerPlayerId);
      if (otherLethal) {
        const lethalResult = moveCreaturesToGraveyardAndTrigger(next, [targetInstanceId], 'dies');
        next = { ...lethalResult.state, log: [...lethalResult.state.log, ...lethalResult.logLines] };
      }
    }

    // "...and X damage to itself" - the source always takes the same amount too.
    next = updatePlayer(next, sourceFound.ownerPlayerId, (p) => ({
      ...p,
      zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === pending.firstInstanceId ? { ...c, damageMarked: c.damageMarked + amount } : c)) },
    }));
    logLines.push(`${sourceDef.name} deals ${amount} damage to itself.`);
    const damagedSource = getPlayer(next, sourceFound.ownerPlayerId).zones.battlefield.find((c) => c.instanceId === pending.firstInstanceId);
    const selfLethal =
      !!damagedSource &&
      !hasKeywordEffective(sourceDef, damagedSource, 'indestructible') &&
      !hasBoardGrantedKeyword(next, sourceFound.ownerPlayerId, damagedSource, sourceDef, 'indestructible') &&
      damagedSource.damageMarked >= effectiveToughness(sourceDef, damagedSource, next, sourceFound.ownerPlayerId);
    if (selfLethal) {
      const lethalResult = moveCreaturesToGraveyardAndTrigger(next, [pending.firstInstanceId], 'dies');
      next = { ...lethalResult.state, log: [...lethalResult.state.log, ...lethalResult.logLines] };
    }

    next = { ...next, pendingTarget: null };
    return { ok: true, state: { ...next, log: [...next.log, ...logLines] } };
  }

  // "You may have this creature enter as a copy of any creature on the
  // battlefield, except it enters with X additional +1/+1 counters on it"
  // (Altered Ego) - a top-level special case, not part of the generic
  // isOptional list below, because declining still has to add the counters
  // (the generic list's decline path just clears pendingTarget and does
  // nothing else). Also deliberately ahead of the hexproof/Ward checks
  // further down - copying isn't a real "target" in Magic rules terms (a
  // hexproof creature can still be copied), so this shouldn't be gated by
  // either.
  if (pending.effect.type === 'becomeCopyOfAnyCreatureThenAddCounters') {
    const counterAmount = pending.effect.counterAmount ?? 0;
    const addCounters = (c: CardInstance): CardInstance => {
      if (counterAmount <= 0) return c;
      const existing = c.counters.find((ctr) => ctr.label === '+1/+1')?.amount ?? 0;
      return { ...c, counters: [...c.counters.filter((ctr) => ctr.label !== '+1/+1'), { label: '+1/+1', amount: existing + counterAmount }] };
    };
    const actor = getPlayer(state, playerId);
    const sourceDef = getCardDefinition(findCardAnywhere(state, pending.sourceInstanceId)!.card.defId);

    if (targetInstanceId === null) {
      let next = updatePlayer(state, playerId, (p) => ({
        ...p,
        zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === pending.sourceInstanceId ? addCounters(c) : c)) },
      }));
      next = { ...next, pendingTarget: null };
      const note = counterAmount > 0 ? ` It enters with ${counterAmount} +1/+1 counter(s).` : '';
      return { ok: true, state: { ...next, log: [...next.log, `${actor.name} declines to copy a creature with ${sourceDef.name}.${note}`] } };
    }

    const target = findCardAnywhere(state, targetInstanceId);
    if (!target || target.zone !== 'battlefield') return { ok: false, error: "That's not a legal target - it must be a creature on the battlefield." };
    const targetDef = getCardDefinition(target.card.defId);
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };

    let next = updatePlayer(state, playerId, (p) => ({
      ...p,
      zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === pending.sourceInstanceId ? addCounters({ ...c, defId: targetDef.id }) : c)) },
    }));
    next = { ...next, pendingTarget: null };
    const note = counterAmount > 0 ? `, entering with ${counterAmount} +1/+1 counter(s)` : '';
    return { ok: true, state: { ...next, log: [...next.log, `${sourceDef.name} enters as a copy of ${targetDef.name}${note}.`] } };
  }

  if (targetInstanceId === null) {
    // Only "up to one" targeting - SelfFightTargetEffect.optional, or
    // PutCounterOnUpToOneOwnCreatureEffect (always optional, per its name) -
    // allows declining; every other pending effect requires an actual target.
    const isOptional =
      (pending.effect.type === 'selfFightTarget' && pending.effect.optional) ||
      (pending.effect.type === 'destroyTarget' && pending.effect.optional) ||
      (pending.effect.type === 'attachSelfToTarget' && pending.effect.optional) ||
      pending.effect.type === 'putCounterOnUpToOneOwnCreature' ||
      pending.effect.type === 'bounceUpToOneOtherNonlandPermanent' ||
      pending.effect.type === 'putCounterOnUpToOneOtherCreatureEqualToOwnPower' ||
      pending.effect.type === 'tapStunAndGainLifeForNonbasicLands' ||
      (pending.effect.type === 'pumpUpToTwoTargets' && !!pending.firstInstanceId) ||
      pending.effect.type === 'attachAllControlledEquipmentToTargetCreature' ||
      pending.effect.type === 'proliferate';
    if (!isOptional) {
      return { ok: false, error: 'This ability requires a target.' };
    }
    const source = findCardAnywhere(state, pending.sourceInstanceId);
    const sourceName = source ? getCardDefinition(source.card.defId).name : 'This ability';
    const declineNote = pending.effect.type === 'proliferate' ? `${sourceName} finishes proliferating.` : `${sourceName}'s optional target was declined.`;
    return { ok: true, state: { ...state, pendingTarget: null, log: [...state.log, declineNote] } };
  }

  // "Hexproof" - can't be targeted by an opponent's spells or abilities at
  // all (unlike Ward, there's no cost to pay around it - it's simply not a
  // legal target). Checked before Ward for exactly that reason: no point
  // even offering to pay Ward's cost for a target that was never legal in
  // the first place. Self-targeting (found.ownerPlayerId === playerId) is
  // untouched, same as real hexproof only stopping OPPONENTS.
  {
    const hexproofCheckTarget = findCardAnywhere(state, targetInstanceId);
    if (hexproofCheckTarget && hexproofCheckTarget.ownerPlayerId !== playerId) {
      const hexproofTargetDef = getCardDefinition(hexproofCheckTarget.card.defId);
      const hasHexproof =
        hasKeywordEffective(hexproofTargetDef, hexproofCheckTarget.card, 'hexproof') ||
        hasBoardGrantedKeyword(state, hexproofCheckTarget.ownerPlayerId, hexproofCheckTarget.card, hexproofTargetDef, 'hexproof');
      if (hasHexproof) {
        return { ok: false, error: `${hexproofTargetDef.name} has hexproof - it can't be targeted by your spells or abilities.` };
      }
    }
  }

  // "Ward [cost]" - targeting an opponent's warded permanent pauses here
  // (pendingTarget deliberately left untouched) until they pay or decline
  // via RESOLVE_WARD_PAYMENT. Paying re-enters this same function with
  // wardPaid so it isn't asked to pay twice. See engine/combat.ts:
  // effectiveWardCost, resolveWardPayment below.
  if (!wardPaid) {
    const targetFound = findCardAnywhere(state, targetInstanceId);
    if (targetFound && targetFound.ownerPlayerId !== playerId) {
      const targetDef = getCardDefinition(targetFound.card.defId);
      const ward = effectiveWardCost(state, targetFound.ownerPlayerId, targetFound.card, targetDef);
      if (ward) {
        return { ok: true, state: { ...state, pendingWardPayment: { controllerId: playerId, targetInstanceId, wardOwnerId: targetFound.ownerPlayerId, cost: ward } } };
      }
    }
  }

  if (pending.effect.type === 'tapAndStun') {
    const opponent = getOpponent(state, playerId);
    const target = opponent.zones.battlefield.find((c) => c.instanceId === targetInstanceId);
    if (!target) return { ok: false, error: "That's not a legal target - it must be a permanent your opponent controls." };

    const targetDef = getCardDefinition(target.defId);
    const matchesType = pending.effect.targetType === 'artifactOrCreature' ? targetDef.type === 'artifact' || targetDef.type === 'creature' : targetDef.type === pending.effect.targetType;
    if (!matchesType) return { ok: false, error: `${targetDef.name} is not a legal target for this ability.` };

    const existingStun = target.counters.find((c) => c.label === 'Stun')?.amount ?? 0;
    let next = updatePlayer(state, opponent.id, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.map((c) => {
          if (c.instanceId !== targetInstanceId) return c;
          if (pending.effect.type === 'tapAndStun' && pending.effect.noStunCounter) return { ...c, tapped: true };
          return { ...c, tapped: true, counters: [...c.counters.filter((ctr) => ctr.label !== 'Stun'), { label: 'Stun', amount: existingStun + 1 }] };
        }),
      },
    }));
    next = { ...next, pendingTarget: null };

    const actor = getPlayer(next, playerId);
    const stunNote = pending.effect.noStunCounter ? '' : ' and puts a stun counter on it';
    return { ok: true, state: { ...next, log: [...next.log, `${actor.name} taps ${targetDef.name}${stunNote}.`] } };
  }

  if (pending.effect.type === 'untapTargetAttacker') {
    const found = findCardAnywhere(state, targetInstanceId);
    if (!found || found.zone !== 'battlefield' || !state.declaredAttackers.includes(targetInstanceId)) {
      return { ok: false, error: "That's not a legal target - it must be an attacking creature." };
    }
    const targetDef = getCardDefinition(found.card.defId);
    let next = updatePlayer(state, found.ownerPlayerId, (p) => ({
      ...p,
      zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === targetInstanceId ? { ...c, tapped: false } : c)) },
    }));
    next = { ...next, pendingTarget: null };
    const actor = getPlayer(next, playerId);
    return { ok: true, state: { ...next, log: [...next.log, `${actor.name} untaps ${targetDef.name}.`] } };
  }

  if (pending.effect.type === 'putStunCounterOnTargetAttacker') {
    const found = findCardAnywhere(state, targetInstanceId);
    if (!found || found.zone !== 'battlefield' || !state.declaredAttackers.includes(targetInstanceId)) {
      return { ok: false, error: "That's not a legal target - it must be a creature attacking you." };
    }
    const targetDef = getCardDefinition(found.card.defId);
    const existingStun = found.card.counters.find((c) => c.label === 'Stun')?.amount ?? 0;
    let next = updatePlayer(state, found.ownerPlayerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.map((c) =>
          c.instanceId === targetInstanceId ? { ...c, counters: [...c.counters.filter((ctr) => ctr.label !== 'Stun'), { label: 'Stun', amount: existingStun + 1 }] } : c
        ),
      },
    }));
    next = { ...next, pendingTarget: null };
    const actor = getPlayer(next, playerId);
    return { ok: true, state: { ...next, log: [...next.log, `${actor.name} puts a Stun counter on ${targetDef.name}.`] } };
  }

  if (pending.effect.type === 'proliferate') {
    // targetInstanceId === null (declining to proliferate anything else) is
    // already handled generically above (see the isOptional whitelist) -
    // this only ever runs here with a real target chosen.
    const alreadyChosen = pending.effect.alreadyChosen ?? [];
    if (alreadyChosen.includes(targetInstanceId)) {
      return { ok: false, error: 'You already proliferated that permanent this time.' };
    }
    const found = findCardAnywhere(state, targetInstanceId);
    if (!found || found.zone !== 'battlefield' || found.card.counters.length === 0) {
      return { ok: false, error: "That's not a legal target - it must be a permanent with at least one counter on it." };
    }
    const targetDef = getCardDefinition(found.card.defId);
    let next = updatePlayer(state, found.ownerPlayerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.map((c) => (c.instanceId === targetInstanceId ? { ...c, counters: c.counters.map((ctr) => ({ ...ctr, amount: ctr.amount + 1 })) } : c)),
      },
    }));
    const newAlreadyChosen = [...alreadyChosen, targetInstanceId];
    const hasMoreLegalTargets = [...next.players[0].zones.battlefield, ...next.players[1].zones.battlefield].some(
      (c) => c.counters.length > 0 && !newAlreadyChosen.includes(c.instanceId)
    );
    next = {
      ...next,
      pendingTarget: hasMoreLegalTargets ? { ...pending, effect: { type: 'proliferate', alreadyChosen: newAlreadyChosen } } : null,
    };
    const actor = getPlayer(next, playerId);
    return { ok: true, state: { ...next, log: [...next.log, `${actor.name} proliferates ${targetDef.name}, adding another counter of each kind already there.`] } };
  }

  if (pending.effect.type === 'tapStunAndGainLifeForNonbasicLands') {
    const opponent = getOpponent(state, playerId);
    const target = opponent.zones.battlefield.find((c) => c.instanceId === targetInstanceId);
    if (!target) return { ok: false, error: "That's not a legal target - it must be a nonland permanent your opponent controls." };
    const targetDef = getCardDefinition(target.defId);
    if (targetDef.type === 'land') return { ok: false, error: `${targetDef.name} is not a legal target for this ability.` };

    // Recomputed fresh here rather than carried over from the initial
    // trigger (see engine/effects.ts) - nothing can change the controller's
    // nonbasic land count in between (this is one uninterrupted onEnter
    // resolution, with only the target choice itself pausing it), so it's
    // always the same X either way.
    const controller = getPlayer(state, playerId);
    const x = controller.zones.battlefield.filter((c) => isNonbasicLand(getCardDefinition(c.defId))).length;
    const existingStun = target.counters.find((c) => c.label === 'Stun')?.amount ?? 0;
    let next = updatePlayer(state, opponent.id, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.map((c) =>
          c.instanceId !== targetInstanceId
            ? c
            : { ...c, tapped: true, counters: x > 0 ? [...c.counters.filter((ctr) => ctr.label !== 'Stun'), { label: 'Stun', amount: existingStun + x }] : c.counters }
        ),
      },
    }));
    next = { ...next, pendingTarget: null };

    const actor = getPlayer(next, playerId);
    const stunNote = x > 0 ? ` and puts ${x} stun counter${x === 1 ? '' : 's'} on it` : '';
    return { ok: true, state: { ...next, log: [...next.log, `${actor.name} taps ${targetDef.name}${stunNote}.`] } };
  }

  if (pending.effect.type === 'chooseCreatureDebuffOthersAndWatchLeave') {
    const opponent = getOpponent(state, playerId);
    const target = opponent.zones.battlefield.find((c) => c.instanceId === targetInstanceId);
    if (!target || getCardDefinition(target.defId).type !== 'creature') {
      return { ok: false, error: "That's not a legal target - it must be a creature your opponent controls." };
    }

    const { power, toughness, onWatchedLeaveEffects } = pending.effect;
    let next = state;
    for (const player of next.players) {
      for (const c of player.zones.battlefield) {
        if (c.instanceId === pending.sourceInstanceId || c.instanceId === targetInstanceId) continue;
        if (getCardDefinition(c.defId).type !== 'creature') continue;
        next = applyTemporaryBuff(next, c.instanceId, power, toughness);
      }
    }
    next = {
      ...next,
      pendingTarget: null,
      battlefieldLeaveWatchers: [
        ...next.battlefieldLeaveWatchers,
        { watcherInstanceId: pending.sourceInstanceId, watchedInstanceId: targetInstanceId, controllerId: playerId, effects: onWatchedLeaveEffects },
      ],
    };

    const targetDef = getCardDefinition(target.defId);
    const sourceName = getCardDefinition(findCardAnywhere(next, pending.sourceInstanceId)!.card.defId).name;
    return {
      ok: true,
      state: { ...next, log: [...next.log, `${sourceName} chooses ${targetDef.name}. Other creatures get ${power}/${toughness} until end of turn.`] },
    };
  }

  if (pending.effect.type === 'grantTemporaryBaseStatsAndDeathReturn') {
    const owner = getPlayer(state, playerId);
    const target = owner.zones.battlefield.find((c) => c.instanceId === targetInstanceId);
    if (!target || getCardDefinition(target.defId).type !== 'creature') {
      return { ok: false, error: "That's not a legal target - it must be a creature you control." };
    }

    const { power, toughness } = pending.effect;
    let next = updatePlayer(state, playerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.map((c) =>
          c.instanceId === targetInstanceId ? { ...c, temporaryBaseStats: { power, toughness }, temporaryOnDeathReturnTapped: true } : c
        ),
      },
    }));
    next = { ...next, pendingTarget: null };

    const targetDef = getCardDefinition(target.defId);
    const sourceName = getCardDefinition(findCardAnywhere(next, pending.sourceInstanceId)!.card.defId).name;
    return {
      ok: true,
      state: {
        ...next,
        log: [
          ...next.log,
          `${sourceName} targets ${targetDef.name}, setting its base power/toughness to ${power}/${toughness} until end of turn and granting it a return-when-it-dies trigger.`,
        ],
      },
    };
  }

  const found = findCardAnywhere(state, targetInstanceId);
  if (!found || found.zone !== 'battlefield') return { ok: false, error: "That's not a legal target - it must be a permanent on the battlefield." };
  const targetDef = getCardDefinition(found.card.defId);

  if (pending.effect.type === 'destroyTarget') {
    // Unlike tapAndStun, this can target either player's permanents (e.g.
    // Airship Crash names no controller restriction at all).
    const isFlyingCreature = targetDef.type === 'creature' && hasKeyword(targetDef, 'flying');
    const matchesFilter =
      pending.effect.targetFilter === 'anyPermanent' ||
      (pending.effect.targetFilter === 'nonlandPermanent' && targetDef.type !== 'land') ||
      (pending.effect.targetFilter === 'creatureWithMinPower' &&
        targetDef.type === 'creature' &&
        effectivePower(targetDef, found.card, state, found.ownerPlayerId) >= (pending.effect.minPower ?? 0)) ||
      (pending.effect.targetFilter === 'artifactEnchantmentOrFlyingCreature' && (targetDef.type === 'artifact' || targetDef.type === 'enchantment' || isFlyingCreature)) ||
      (pending.effect.targetFilter === 'artifactOrEnchantment' && (targetDef.type === 'artifact' || targetDef.type === 'enchantment')) ||
      (pending.effect.targetFilter === 'creatureWithDamageMarked' && targetDef.type === 'creature' && found.card.damageMarked > 0) ||
      (pending.effect.targetFilter === 'land' && targetDef.type === 'land') ||
      (pending.effect.targetFilter === 'creature' && targetDef.type === 'creature');
    if (!matchesFilter) return { ok: false, error: `${targetDef.name} is not a legal target for this ability.` };

    if (hasKeywordEffective(targetDef, found.card, 'indestructible') || hasBoardGrantedKeyword(state, found.ownerPlayerId, found.card, targetDef, 'indestructible')) {
      const next = { ...state, pendingTarget: null };
      return { ok: true, state: { ...next, log: [...next.log, `${targetDef.name} is indestructible and survives.`] } };
    }

    const destroyResult = moveCreaturesToGraveyardAndTrigger(state, [targetInstanceId], 'is destroyed');
    const next = { ...destroyResult.state, pendingTarget: null, log: [...destroyResult.state.log, ...destroyResult.logLines] };
    return { ok: true, state: next };
  }

  if (pending.effect.type === 'pumpTarget') {
    // No controller restriction stated by default (either player's creature
    // is a legal target) - restrictToOwnCreature (Magic Damper) narrows it.
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    const { power, toughness, grantKeyword, restrictToOwnCreature, alsoUntap, grantsTemporaryOnDeathPutCountersEqualToPower } = pending.effect;
    if (restrictToOwnCreature && found.ownerPlayerId !== playerId) {
      return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature you control.` };
    }
    let next = applyTemporaryBuff(state, targetInstanceId, power, toughness);
    if (grantKeyword) next = grantTemporaryKeyword(next, targetInstanceId, grantKeyword);
    if (alsoUntap) {
      next = updatePlayer(next, found.ownerPlayerId, (p) => ({
        ...p,
        zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === targetInstanceId ? { ...c, tapped: false } : c)) },
      }));
    }
    if (grantsTemporaryOnDeathPutCountersEqualToPower) {
      next = updatePlayer(next, found.ownerPlayerId, (p) => ({
        ...p,
        zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === targetInstanceId ? { ...c, temporaryOnDeathPutCountersEqualToPower: true } : c)) },
      }));
    }
    next = { ...next, pendingTarget: null };
    const actor = getPlayer(next, playerId);
    const keywordNote = grantKeyword ? ` and gains ${grantKeyword}` : '';
    const untapNote = alsoUntap ? ' It is untapped.' : '';
    return { ok: true, state: { ...next, log: [...next.log, `${actor.name} targets ${targetDef.name}: it gets +${power}/+${toughness}${keywordNote} until end of turn.${untapNote}`] } };
  }

  if (pending.effect.type === 'pumpUpToTwoTargets') {
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    if (targetInstanceId === pending.firstInstanceId) return { ok: false, error: 'The second target must be a different creature.' };
    const { power, toughness } = pending.effect;
    let next = applyTemporaryBuff(state, targetInstanceId, power, toughness);
    const actor = getPlayer(next, playerId);
    next = {
      ...next,
      pendingTarget: pending.firstInstanceId ? null : { ...pending, firstInstanceId: targetInstanceId },
      log: [...next.log, `${actor.name} targets ${targetDef.name}: it gets +${power}/+${toughness} until end of turn.`],
    };
    return { ok: true, state: next };
  }

  if (pending.effect.type === 'grantKeywordsToTargetPermanent') {
    const { keywords } = pending.effect;
    let next = state;
    for (const keyword of keywords) {
      next = grantTemporaryKeyword(next, targetInstanceId, keyword);
    }
    next = { ...next, pendingTarget: null };
    const actor = getPlayer(next, playerId);
    return { ok: true, state: { ...next, log: [...next.log, `${actor.name} targets ${targetDef.name}: it gains ${keywords.join(' and ')} until end of turn.`] } };
  }

  if (pending.effect.type === 'gainControlOfTargetCreature') {
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    if (pending.effect.opponentControlledOnly && found.ownerPlayerId === playerId) {
      return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature an opponent controls.` };
    }
    const { untap, grantKeywords } = pending.effect;
    const movingCard = found.card;
    let next = state;
    if (found.ownerPlayerId !== playerId) {
      next = updatePlayer(next, found.ownerPlayerId, (p) => ({ ...p, zones: { ...p.zones, battlefield: p.zones.battlefield.filter((c) => c.instanceId !== targetInstanceId) } }));
      next = updatePlayer(next, playerId, (p) => ({
        ...p,
        zones: { ...p.zones, battlefield: [...p.zones.battlefield, { ...movingCard, tapped: untap ? false : movingCard.tapped, temporaryControlUntilEndOfTurn: true }] },
      }));
      next = triggerControlLostToOpponentWatchers(next, found.ownerPlayerId);
    } else if (untap) {
      next = updatePlayer(next, playerId, (p) => ({
        ...p,
        zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === targetInstanceId ? { ...c, tapped: false } : c)) },
      }));
    }
    for (const keyword of grantKeywords ?? []) {
      next = grantTemporaryKeyword(next, targetInstanceId, keyword);
    }
    next = { ...next, pendingTarget: null };
    const actor = getPlayer(next, playerId);
    const untapNote = untap ? ' It is untapped.' : '';
    const keywordNote = grantKeywords && grantKeywords.length > 0 ? ` It gains ${grantKeywords.join(' and ')} until end of turn.` : '';
    return { ok: true, state: { ...next, log: [...next.log, `${actor.name} gains control of ${targetDef.name} until end of turn.${untapNote}${keywordNote}`] } };
  }

  if (pending.effect.type === 'giveControlOfAnotherOwnPermanentToOpponent') {
    if (found.ownerPlayerId !== playerId) return { ok: false, error: `${targetDef.name} is not a legal target - it must be a permanent you control.` };
    if (targetInstanceId === pending.sourceInstanceId) return { ok: false, error: 'You must choose a permanent other than the source.' };
    const opponent = getOpponent(state, playerId);
    const movingCard = found.card;
    let next = updatePlayer(state, playerId, (p) => ({ ...p, zones: { ...p.zones, battlefield: p.zones.battlefield.filter((c) => c.instanceId !== targetInstanceId) } }));
    next = updatePlayer(next, opponent.id, (p) => ({ ...p, zones: { ...p.zones, battlefield: [...p.zones.battlefield, movingCard] } }));
    next = checkLegendRule(next, opponent.id);
    next = triggerControlLostToOpponentWatchers(next, playerId);
    if (pending.effect.drawCard) {
      const drawn = getPlayer(next, playerId).zones.library.slice(0, 1);
      next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(1), hand: [...p.zones.hand, ...drawn] } }));
    }
    next = { ...next, pendingTarget: null };
    const actor = getPlayer(next, playerId);
    const drawNote = pending.effect.drawCard ? ` ${actor.name} draws a card.` : '';
    return { ok: true, state: { ...next, log: [...next.log, `${opponent.name} gains control of ${targetDef.name}.${drawNote}`] } };
  }

  if (pending.effect.type === 'gainControlOfTargetEquipmentAndAttach') {
    if (!pending.firstInstanceId) {
      if (targetDef.type !== 'creature' || found.ownerPlayerId !== playerId) {
        return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature you control.` };
      }
      const next = { ...state, pendingTarget: { ...pending, firstInstanceId: targetInstanceId } };
      const actor = getPlayer(next, playerId);
      return { ok: true, state: { ...next, log: [...next.log, `${actor.name} chooses ${targetDef.name} - now choose an Equipment.`] } };
    }
    if (!targetDef.subtype?.toLowerCase().includes('equipment')) {
      return { ok: false, error: `${targetDef.name} is not a legal target - it must be an Equipment.` };
    }
    const creatureInstanceId = pending.firstInstanceId;
    const movingEquipment = found.card;
    let next = state;
    if (found.ownerPlayerId !== playerId) {
      next = updatePlayer(next, found.ownerPlayerId, (p) => ({ ...p, zones: { ...p.zones, battlefield: p.zones.battlefield.filter((c) => c.instanceId !== targetInstanceId) } }));
      next = updatePlayer(next, playerId, (p) => ({
        ...p,
        zones: { ...p.zones, battlefield: [...p.zones.battlefield, { ...movingEquipment, temporaryControlUntilEndOfTurn: true }] },
      }));
      next = triggerControlLostToOpponentWatchers(next, found.ownerPlayerId);
    }
    next = updatePlayer(next, playerId, (p) => ({
      ...p,
      zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === targetInstanceId ? { ...c, attachedToInstanceId: creatureInstanceId } : c)) },
    }));
    next = { ...next, pendingTarget: null };
    const actor = getPlayer(next, playerId);
    const creatureName = getCardDefinition(findCardAnywhere(next, creatureInstanceId)!.card.defId).name;
    return {
      ok: true,
      state: { ...next, log: [...next.log, `${actor.name} gains control of ${targetDef.name} until end of turn and attaches it to ${creatureName}.`] },
    };
  }

  if (pending.effect.type === 'putCounterOnTarget') {
    // No controller restriction stated (same as pumpTarget/destroyTarget).
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    const { counterLabel, counterAmount } = pending.effect;
    let next = updatePlayer(state, found.ownerPlayerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.map((c) => {
          if (c.instanceId !== targetInstanceId) return c;
          const hasCounter = c.counters.some((ctr) => ctr.label === counterLabel);
          const counters = hasCounter
            ? c.counters.map((ctr) => (ctr.label === counterLabel ? { ...ctr, amount: ctr.amount + counterAmount } : ctr))
            : [...c.counters, { label: counterLabel, amount: counterAmount }];
          return { ...c, counters };
        }),
      },
    }));
    next = { ...next, pendingTarget: null };
    const actor = getPlayer(next, playerId);
    return { ok: true, state: { ...next, log: [...next.log, `${actor.name} puts a ${counterLabel} counter on ${targetDef.name}.`] } };
  }

  if (pending.effect.type === 'putCounterOnTargetLand') {
    if (targetDef.type !== 'land') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a land.` };
    const { counterLabel, counterAmount } = pending.effect;
    let next = updatePlayer(state, found.ownerPlayerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.map((c) => {
          if (c.instanceId !== targetInstanceId) return c;
          const hasCounter = c.counters.some((ctr) => ctr.label === counterLabel);
          const counters = hasCounter
            ? c.counters.map((ctr) => (ctr.label === counterLabel ? { ...ctr, amount: ctr.amount + counterAmount } : ctr))
            : [...c.counters, { label: counterLabel, amount: counterAmount }];
          return { ...c, counters };
        }),
      },
    }));
    next = { ...next, pendingTarget: null };
    const actor = getPlayer(next, playerId);
    return { ok: true, state: { ...next, log: [...next.log, `${actor.name} puts a ${counterLabel} counter on ${targetDef.name}.`] } };
  }

  if (pending.effect.type === 'debuffTargetByGraveyard') {
    // Must be a creature an OPPONENT controls, like tapAndStun.
    if (found.ownerPlayerId === playerId) return { ok: false, error: "That's not a legal target - it must be a creature your opponent controls." };
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    const graveyardCount = getPlayer(state, playerId).zones.graveyard.filter((c) => {
      const d = getCardDefinition(c.defId);
      return d.type === 'creature' || d.type === 'artifact' || d.type === 'enchantment' || d.type === 'land';
    }).length;
    const { powerPerUnit, toughnessPerUnit } = pending.effect;
    const totalPower = powerPerUnit * graveyardCount;
    const totalToughness = toughnessPerUnit * graveyardCount;
    let next = applyTemporaryBuff(state, targetInstanceId, totalPower, totalToughness);
    next = { ...next, pendingTarget: null };
    const actor = getPlayer(next, playerId);
    return {
      ok: true,
      state: { ...next, log: [...next.log, `${actor.name} targets ${targetDef.name}: it gets ${totalPower}/${totalToughness} until end of turn (${graveyardCount} permanent card(s) in graveyard).`] },
    };
  }

  if (pending.effect.type === 'selfFightTarget') {
    // No controller restriction stated, and the source itself can't be the target.
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    if (targetInstanceId === pending.sourceInstanceId) return { ok: false, error: "This creature can't fight itself." };
    const fought = resolveFight(state, pending.sourceInstanceId, targetInstanceId);
    const deathTriggers = resolveOnDeathTriggers(fought.state, [pending.sourceInstanceId, targetInstanceId]);
    let next = { ...deathTriggers.state, pendingTarget: null };
    next = { ...next, log: [...next.log, ...fought.logLines, ...deathTriggers.logLines] };
    return { ok: true, state: next };
  }

  if (pending.effect.type === 'chooseCreaturesFight') {
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    if (!pending.firstInstanceId) {
      // First pick: "target creature you control".
      if (found.ownerPlayerId !== playerId) return { ok: false, error: 'The first target must be a creature you control.' };
      const next = { ...state, pendingTarget: { ...pending, firstInstanceId: targetInstanceId } };
      const actor = getPlayer(next, playerId);
      return { ok: true, state: { ...next, log: [...next.log, `${actor.name} chooses ${targetDef.name} to fight - now choose an opponent's creature.`] } };
    }
    // Second pick: "target creature an opponent controls".
    if (found.ownerPlayerId === playerId) return { ok: false, error: 'The second target must be a creature an opponent controls.' };
    const fought = resolveFight(state, pending.firstInstanceId, targetInstanceId);
    const deathTriggers = resolveOnDeathTriggers(fought.state, [pending.firstInstanceId, targetInstanceId]);
    let next = { ...deathTriggers.state, pendingTarget: null };
    next = { ...next, log: [...next.log, ...fought.logLines, ...deathTriggers.logLines] };
    return { ok: true, state: next };
  }

  if (pending.effect.type === 'chooseCreatureDealsDamageToOpponentCreature') {
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    if (!pending.firstInstanceId) {
      // First pick: "target creature you control".
      if (found.ownerPlayerId !== playerId) return { ok: false, error: 'The first target must be a creature you control.' };
      const next = { ...state, pendingTarget: { ...pending, firstInstanceId: targetInstanceId } };
      const actor = getPlayer(next, playerId);
      return { ok: true, state: { ...next, log: [...next.log, `${actor.name} chooses ${targetDef.name} to deal damage - now choose an opponent's creature.`] } };
    }
    // Second pick: "target creature an opponent controls".
    if (found.ownerPlayerId === playerId) return { ok: false, error: 'The second target must be a creature an opponent controls.' };
    const multiplier = pending.effect.doubleDamage ? 2 : 1;
    const dealt = resolveOneWayPowerDamage(state, pending.firstInstanceId, targetInstanceId, multiplier);
    const deathTriggers = resolveOnDeathTriggers(dealt.state, [targetInstanceId]);
    let next = { ...deathTriggers.state, pendingTarget: null };
    next = { ...next, log: [...next.log, ...dealt.logLines, ...deathTriggers.logLines] };
    return { ok: true, state: next };
  }

  if (pending.effect.type === 'modifySagaLoreCounter') {
    // Target restricted to a Saga the CONTROLLER controls.
    if (found.ownerPlayerId !== playerId) return { ok: false, error: 'That Saga is not yours to modify.' };
    if (!targetDef.saga) return { ok: false, error: `${targetDef.name} is not a Saga.` };
    if (pending.effect.delta === 1) {
      const sagaResult = triggerSagaLoreCounter(state, playerId, targetInstanceId);
      const next = { ...sagaResult.state, pendingTarget: null };
      return { ok: true, state: { ...next, log: [...next.log, ...sagaResult.logLines] } };
    }
    const existingLore = found.card.counters.find((c) => c.label === 'lore')?.amount ?? 0;
    const newLore = Math.max(0, existingLore - 1);
    let next = updatePlayer(state, playerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.map((c) => {
          if (c.instanceId !== targetInstanceId) return c;
          const otherCounters = c.counters.filter((ctr) => ctr.label !== 'lore');
          return { ...c, counters: newLore > 0 ? [...otherCounters, { label: 'lore', amount: newLore }] : otherCounters };
        }),
      },
    }));
    next = { ...next, pendingTarget: null };
    const actor = getPlayer(next, playerId);
    return { ok: true, state: { ...next, log: [...next.log, `${actor.name} removes a lore counter from ${targetDef.name} (no chapter ability triggers).`] } };
  }

  if (pending.effect.type === 'tapTarget') {
    const matchesTapFilter = pending.effect.targetFilter === 'nonlandPermanent' ? targetDef.type !== 'land' : targetDef.type === 'creature';
    if (!matchesTapFilter) return { ok: false, error: `${targetDef.name} is not a legal target.` };
    let next = updatePlayer(state, found.ownerPlayerId, (p) => ({
      ...p,
      zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === targetInstanceId ? { ...c, tapped: true } : c)) },
    }));
    next = { ...next, pendingTarget: null };
    const actor = getPlayer(next, playerId);
    return { ok: true, state: { ...next, log: [...next.log, `${actor.name} taps ${targetDef.name}.`] } };
  }

  if (pending.effect.type === 'putCounterOnUpToOneOwnCreature') {
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    if (!pending.effect.anyController && found.ownerPlayerId !== playerId) return { ok: false, error: 'You must choose a creature you control.' };
    const { counterLabel, counterAmount } = pending.effect;
    let next = updatePlayer(state, found.ownerPlayerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.map((c) => {
          if (c.instanceId !== targetInstanceId) return c;
          const hasCounter = c.counters.some((ctr) => ctr.label === counterLabel);
          const counters = hasCounter
            ? c.counters.map((ctr) => (ctr.label === counterLabel ? { ...ctr, amount: ctr.amount + counterAmount } : ctr))
            : [...c.counters, { label: counterLabel, amount: counterAmount }];
          return { ...c, counters };
        }),
      },
    }));
    if (pending.effect.grantKeyword) next = grantTemporaryKeyword(next, targetInstanceId, pending.effect.grantKeyword);
    next = { ...next, pendingTarget: null };
    const actor = getPlayer(next, playerId);
    const keywordNote = pending.effect.grantKeyword ? ` It gains ${pending.effect.grantKeyword} until end of turn.` : '';
    return { ok: true, state: { ...next, log: [...next.log, `${actor.name} puts a ${counterLabel} counter on ${targetDef.name}.${keywordNote}`] } };
  }

  if (pending.effect.type === 'attachSelfToTarget') {
    const matchesType = pending.effect.targetTypeFilter === 'artifactOrCreature' ? targetDef.type === 'artifact' || targetDef.type === 'creature' : targetDef.type === 'creature';
    if (!matchesType) return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    if (!pending.effect.allowAnyController && found.ownerPlayerId !== playerId) return { ok: false, error: 'You must attach to a creature you control.' };
    const sourceFound = findCardAnywhere(state, pending.sourceInstanceId);
    const sourceDef = sourceFound ? getCardDefinition(sourceFound.card.defId) : null;
    let next = updatePlayer(state, playerId, (p) => ({
      ...p,
      zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === pending.sourceInstanceId ? { ...c, attachedToInstanceId: targetInstanceId } : c)) },
    }));
    if (pending.effect.grantKeyword) next = grantTemporaryKeyword(next, targetInstanceId, pending.effect.grantKeyword);
    if (pending.effect.tapTarget) {
      next = updatePlayer(next, found.ownerPlayerId, (p) => ({
        ...p,
        zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === targetInstanceId ? { ...c, tapped: true } : c)) },
      }));
    }
    next = { ...next, pendingTarget: null };
    const actor = getPlayer(next, playerId);
    const keywordNote = pending.effect.grantKeyword ? ` ${targetDef.name} gains ${pending.effect.grantKeyword} until end of turn.` : '';
    const tapNote = pending.effect.tapTarget ? ` ${targetDef.name} is tapped.` : '';
    return { ok: true, state: { ...next, log: [...next.log, `${actor.name} attaches ${sourceDef?.name ?? 'the Equipment'} to ${targetDef.name}.${keywordNote}${tapNote}`] } };
  }

  if (pending.effect.type === 'destroyOpponentCreature') {
    // opponent-only, creature-only.
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    if (found.ownerPlayerId === playerId) return { ok: false, error: "That's not a legal target - it must be a creature your opponent controls." };
    if (hasKeywordEffective(targetDef, found.card, 'indestructible') || hasBoardGrantedKeyword(state, found.ownerPlayerId, found.card, targetDef, 'indestructible')) {
      const next = { ...state, pendingTarget: null };
      return { ok: true, state: { ...next, log: [...next.log, `${targetDef.name} is indestructible and survives.`] } };
    }
    const destroyResult = moveCreaturesToGraveyardAndTrigger(state, [targetInstanceId], 'is destroyed');
    let next: GameState = { ...destroyResult.state, pendingTarget: null, log: [...destroyResult.state.log, ...destroyResult.logLines] };
    if (pending.effect.thenDrawForCreaturesDiedThisTurn && next.creaturesDiedThisTurn > 0) {
      const actor = getPlayer(next, playerId);
      const count = next.creaturesDiedThisTurn;
      const drawn = actor.zones.library.slice(0, count);
      next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(count), hand: [...p.zones.hand, ...drawn] } }));
      next = { ...next, log: [...next.log, `${actor.name} draws ${drawn.length} card(s) (${count} creature(s) died this turn).`] };
    }
    return { ok: true, state: next };
  }

  if (pending.effect.type === 'bounceUpToOneOtherNonlandPermanent') {
    if (targetDef.type === 'land') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a nonland permanent.` };
    if (targetInstanceId === pending.sourceInstanceId) return { ok: false, error: 'You must choose a permanent other than the source.' };
    const bounceOwner = getPlayer(state, found.ownerPlayerId);
    let next = detachEverythingFrom(state, targetInstanceId);
    const bouncedCard = { ...found.card, tapped: false, attachedToInstanceId: undefined, damageMarked: 0 };
    next = updatePlayer(next, found.ownerPlayerId, (p) => ({ ...p, zones: { ...p.zones, battlefield: p.zones.battlefield.filter((c) => c.instanceId !== targetInstanceId) } }));
    if (isPlayersCommander(next, found.ownerPlayerId, found.card)) {
      next = beginCommanderZoneChoice(next, found.ownerPlayerId, 'hand', bouncedCard);
      next = { ...next, pendingTarget: null, log: [...next.log, `${targetDef.name} would return to ${bounceOwner.name}'s hand - ${bounceOwner.name} chooses whether it goes there or to the command zone instead.`] };
      return { ok: true, state: next };
    }
    next = updatePlayer(next, found.ownerPlayerId, (p) => ({ ...p, zones: { ...p.zones, hand: [...p.zones.hand, bouncedCard] } }));
    next = { ...next, pendingTarget: null, log: [...next.log, `${targetDef.name} is returned to ${bounceOwner.name}'s hand.`] };
    return { ok: true, state: next };
  }

  if (pending.effect.type === 'putCounterOnUpToOneOtherCreatureEqualToOwnPower') {
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    if (targetInstanceId === pending.sourceInstanceId) return { ok: false, error: 'You must choose a creature other than the source.' };
    const sourceFound = findCardAnywhere(state, pending.sourceInstanceId);
    const amount = sourceFound ? effectivePower(getCardDefinition(sourceFound.card.defId), sourceFound.card, state, sourceFound.ownerPlayerId) : 0;
    const { counterLabel, alsoGrantsSubtype } = pending.effect;
    let next = updatePlayer(state, found.ownerPlayerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.map((c) => {
          if (c.instanceId !== targetInstanceId) return c;
          const hasCounter = c.counters.some((ctr) => ctr.label === counterLabel);
          const counters = hasCounter
            ? c.counters.map((ctr) => (ctr.label === counterLabel ? { ...ctr, amount: ctr.amount + amount } : ctr))
            : [...c.counters, { label: counterLabel, amount }];
          const grantedSubtypes = alsoGrantsSubtype && !c.grantedSubtypes?.includes(alsoGrantsSubtype) ? [...(c.grantedSubtypes ?? []), alsoGrantsSubtype] : c.grantedSubtypes;
          return { ...c, counters, grantedSubtypes };
        }),
      },
    }));
    next = { ...next, pendingTarget: null };
    const actor = getPlayer(next, playerId);
    const subtypeNote = alsoGrantsSubtype ? ` and becomes a ${alsoGrantsSubtype}` : '';
    return { ok: true, state: { ...next, log: [...next.log, `${actor.name} puts ${amount} ${counterLabel} counter(s) on ${targetDef.name}${subtypeNote}.`] } };
  }

  if (pending.effect.type === 'damageTargetAndControllerByEquipmentCount') {
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    const actor = getPlayer(state, playerId);
    const equipmentCount = actor.zones.battlefield.filter((c) => getCardDefinition(c.defId).subtype?.toLowerCase().includes('equipment')).length;
    const { damageToCreature } = pending.effect;
    let next = updatePlayer(state, found.ownerPlayerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.map((c) => (c.instanceId === targetInstanceId ? { ...c, damageMarked: c.damageMarked + damageToCreature } : c)),
      },
    }));
    const targetOwner = getPlayer(next, found.ownerPlayerId);
    next = loseLife(next, targetOwner.id, equipmentCount);
    next = {
      ...next,
      pendingTarget: null,
      log: [...next.log, `${actor.name} deals ${damageToCreature} damage to ${targetDef.name} and ${equipmentCount} damage to ${targetOwner.name}.`],
    };
    const damagedTarget = getPlayer(next, found.ownerPlayerId).zones.battlefield.find((c) => c.instanceId === targetInstanceId);
    const isLethal =
      !!damagedTarget &&
      !hasKeywordEffective(targetDef, damagedTarget, 'indestructible') &&
      !hasBoardGrantedKeyword(next, found.ownerPlayerId, damagedTarget, targetDef, 'indestructible') &&
      damagedTarget.damageMarked >= effectiveToughness(targetDef, damagedTarget, next, found.ownerPlayerId);
    if (isLethal) {
      const lethalResult = moveCreaturesToGraveyardAndTrigger(next, [targetInstanceId], 'dies');
      next = { ...lethalResult.state, log: [...lethalResult.state.log, ...lethalResult.logLines] };
    }
    return { ok: true, state: next };
  }

  if (pending.effect.type === 'pumpAnotherControlledCreature') {
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    if (found.ownerPlayerId !== playerId) return { ok: false, error: 'You must choose a creature you control.' };
    if (targetInstanceId === pending.sourceInstanceId) return { ok: false, error: 'You must choose a creature other than the source.' };
    const { power, toughness, grantKeyword } = pending.effect;
    let next = applyTemporaryBuff(state, targetInstanceId, power, toughness);
    if (grantKeyword) next = grantTemporaryKeyword(next, targetInstanceId, grantKeyword);
    next = { ...next, pendingTarget: null };
    const actor = getPlayer(next, playerId);
    const keywordNote = grantKeyword ? ` and gains ${grantKeyword}` : '';
    return { ok: true, state: { ...next, log: [...next.log, `${actor.name} targets ${targetDef.name}: it gets +${power}/+${toughness}${keywordNote} until end of turn.`] } };
  }

  if (pending.effect.type === 'putCounterOnAnotherCreatureGrantsIndestructibleUntilNextTurn') {
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    if (found.ownerPlayerId !== playerId) return { ok: false, error: 'You must choose a creature you control.' };
    if (targetInstanceId === pending.sourceInstanceId) return { ok: false, error: 'You must choose a creature other than the source.' };
    const { counterLabel, counterAmount, drawIfLegendary } = pending.effect;
    let next = updatePlayer(state, playerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.map((c) => {
          if (c.instanceId !== targetInstanceId) return c;
          const hasCounter = c.counters.some((ctr) => ctr.label === counterLabel);
          const counters = hasCounter
            ? c.counters.map((ctr) => (ctr.label === counterLabel ? { ...ctr, amount: ctr.amount + counterAmount } : ctr))
            : [...c.counters, { label: counterLabel, amount: counterAmount }];
          return { ...c, counters, temporaryKeywordsUntilNextTurn: [...(c.temporaryKeywordsUntilNextTurn ?? []), 'indestructible'] };
        }),
      },
    }));
    next = { ...next, pendingTarget: null };
    const actor = getPlayer(next, playerId);
    let logLines = [`${actor.name} puts a ${counterAmount} ${counterLabel} counter on ${targetDef.name}; it gains indestructible until ${actor.name}'s next turn.`];
    if (drawIfLegendary && targetDef.subtype?.toLowerCase().includes('legendary')) {
      const drawResult = resolveCardEffects(next, playerId, [{ type: 'drawCards', amount: 1 }], pending.sourceInstanceId);
      next = drawResult.state;
      logLines = [...logLines, ...drawResult.logLines];
    }
    return { ok: true, state: { ...next, log: [...next.log, ...logLines] } };
  }

  if (pending.effect.type === 'exileThenReturnTargetOwnCreature') {
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    if (found.ownerPlayerId !== playerId) return { ok: false, error: 'You must choose a creature you control.' };
    const targetCard = found.card;
    const hasHaste = hasKeyword(targetDef, 'haste');
    const freshInstance: CardInstance = {
      instanceId: nextInstanceId(),
      defId: targetCard.defId,
      ownerId: targetCard.ownerId,
      tapped: false,
      counters: [],
      damageMarked: 0,
      summoningSick: !hasHaste,
    };
    let next = detachEverythingFrom(state, targetInstanceId);
    next = updatePlayer(next, targetCard.ownerId, (p) => ({
      ...p,
      zones: { ...p.zones, battlefield: [...p.zones.battlefield.filter((c) => c.instanceId !== targetInstanceId), freshInstance] },
    }));
    next = { ...next, pendingTarget: null };
    const actor = getPlayer(next, playerId);
    let effectLogLines: string[] = [`${actor.name} exiles ${targetDef.name}, then returns it to the battlefield.`];
    if (targetDef.onEnter && targetDef.onEnter.length > 0) {
      const resolved = resolveCardEffects(next, targetCard.ownerId, targetDef.onEnter, freshInstance.instanceId);
      next = resolved.state;
      effectLogLines = [...effectLogLines, ...resolved.logLines];
    }
    return { ok: true, state: { ...next, log: [...next.log, ...effectLogLines] } };
  }

  if (pending.effect.type === 'attachAllControlledEquipmentToTargetCreature') {
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    if (found.ownerPlayerId !== playerId) return { ok: false, error: 'You must choose a creature you control.' };
    const player = getPlayer(state, playerId);
    const equipmentIds = player.zones.battlefield.filter((c) => !!getCardDefinition(c.defId).equipCost).map((c) => c.instanceId);
    let next = updatePlayer(state, playerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.map((c) => (equipmentIds.includes(c.instanceId) ? { ...c, attachedToInstanceId: targetInstanceId } : c)),
      },
    }));
    next = { ...next, pendingTarget: null };
    const actor = getPlayer(next, playerId);
    return { ok: true, state: { ...next, log: [...next.log, `${actor.name} attaches all Equipment they control to ${targetDef.name}.`] } };
  }

  if (pending.effect.type === 'exileTargetCreatureWithLessPowerUntilSourceLeaves') {
    const sourceFound = findCardAnywhere(state, pending.sourceInstanceId);
    if (!sourceFound) return { ok: false, error: 'The source creature is no longer available.' };
    const sourceDef = getCardDefinition(sourceFound.card.defId);
    const sourcePower = effectivePower(sourceDef, sourceFound.card, state, sourceFound.ownerPlayerId);

    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    if (found.ownerPlayerId === playerId) return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature the defending player controls.` };
    const targetPower = effectivePower(targetDef, found.card, state, found.ownerPlayerId);
    if (targetPower >= sourcePower) return { ok: false, error: `${targetDef.name} is not a legal target - its power isn't less than ${sourceDef.name}'s.` };

    let next = detachEverythingFrom(state, targetInstanceId);
    next = updatePlayer(next, found.ownerPlayerId, (p) => ({
      ...p,
      zones: { ...p.zones, battlefield: p.zones.battlefield.filter((c) => c.instanceId !== targetInstanceId), exile: [...p.zones.exile, found.card] },
    }));
    next = {
      ...next,
      pendingTarget: null,
      exileUntilSourceLeaves: [...next.exileUntilSourceLeaves, { sourceInstanceId: pending.sourceInstanceId, exiledInstanceId: targetInstanceId }],
    };
    return { ok: true, state: { ...next, log: [...next.log, `${sourceDef.name} exiles ${targetDef.name} until it leaves the battlefield.`] } };
  }

  if (pending.effect.type === 'damageTargetCreature') {
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    const { amount } = pending.effect;
    const actor = getPlayer(state, playerId);
    let next = updatePlayer(state, found.ownerPlayerId, (p) => ({
      ...p,
      zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === targetInstanceId ? { ...c, damageMarked: c.damageMarked + amount } : c)) },
    }));
    next = { ...next, pendingTarget: null, log: [...next.log, `${actor.name} deals ${amount} damage to ${targetDef.name}.`] };
    const damagedTarget = getPlayer(next, found.ownerPlayerId).zones.battlefield.find((c) => c.instanceId === targetInstanceId);
    const isLethal =
      !!damagedTarget &&
      !hasKeywordEffective(targetDef, damagedTarget, 'indestructible') &&
      !hasBoardGrantedKeyword(next, found.ownerPlayerId, damagedTarget, targetDef, 'indestructible') &&
      damagedTarget.damageMarked >= effectiveToughness(targetDef, damagedTarget, next, found.ownerPlayerId);
    if (isLethal && pending.effect.exileIfDies) {
      // "If that creature would die this turn, exile it instead" (Suplex) -
      // a one-shot replacement, so this skips moveCreaturesToGraveyardAndTrigger
      // (and therefore onDeath triggers) entirely, same as any other death
      // redirect to exile.
      next = detachEverythingFrom(next, targetInstanceId);
      next = updatePlayer(next, found.ownerPlayerId, (p) => ({
        ...p,
        zones: { ...p.zones, battlefield: p.zones.battlefield.filter((c) => c.instanceId !== targetInstanceId), exile: [...p.zones.exile, damagedTarget!] },
      }));
      next = { ...next, log: [...next.log, `${targetDef.name} is exiled instead of dying.`] };
    } else if (isLethal) {
      const lethalResult = moveCreaturesToGraveyardAndTrigger(next, [targetInstanceId], 'dies');
      next = { ...lethalResult.state, log: [...lethalResult.state.log, ...lethalResult.logLines] };
    }
    return { ok: true, state: next };
  }

  if (pending.effect.type === 'exileTargetPermanent') {
    const isLegal =
      pending.effect.targetFilter === 'artifact'
        ? targetDef.type === 'artifact'
        : pending.effect.targetFilter === 'creature'
          ? targetDef.type === 'creature'
          : pending.effect.targetFilter === 'nonlandPermanent'
            ? targetDef.type !== 'land'
            : true;
    if (!isLegal) return { ok: false, error: `${targetDef.name} is not a legal target.` };
    const actor = getPlayer(state, playerId);
    let next = detachEverythingFrom(state, targetInstanceId);
    next = updatePlayer(next, found.ownerPlayerId, (p) => ({ ...p, zones: { ...p.zones, battlefield: p.zones.battlefield.filter((c) => c.instanceId !== targetInstanceId) } }));
    if (isPlayersCommander(next, found.ownerPlayerId, found.card)) {
      const cardOwner = getPlayer(next, found.ownerPlayerId);
      next = beginCommanderZoneChoice(next, found.ownerPlayerId, 'exile', found.card);
      next = { ...next, pendingTarget: null, log: [...next.log, `${actor.name} would exile ${targetDef.name} - ${cardOwner.name} chooses whether it goes there or to the command zone instead.`] };
      return { ok: true, state: next };
    }
    next = updatePlayer(next, found.ownerPlayerId, (p) => ({ ...p, zones: { ...p.zones, exile: [...p.zones.exile, found.card] } }));
    next = { ...next, pendingTarget: null, log: [...next.log, `${actor.name} exiles ${targetDef.name}.`] };
    return { ok: true, state: next };
  }

  if (pending.effect.type === 'createTokenCopyOfTarget') {
    if (targetDef.type !== 'artifact' && targetDef.type !== 'creature' && targetDef.type !== 'land') {
      return { ok: false, error: `${targetDef.name} is not a legal target - it must be an artifact, creature, or land.` };
    }
    const token: CardInstance = {
      instanceId: nextInstanceId(),
      defId: targetDef.id,
      ownerId: playerId,
      tapped: false,
      counters: [],
      damageMarked: 0,
      summoningSick: !hasKeyword(targetDef, 'haste'),
      isToken: true,
    };
    let next = updatePlayer(state, playerId, (p) => ({ ...p, zones: { ...p.zones, battlefield: [...p.zones.battlefield, token] } }));
    next = { ...next, pendingTarget: null };
    const actor = getPlayer(next, playerId);
    return { ok: true, state: { ...next, log: [...next.log, `${actor.name} creates a token copy of ${targetDef.name}.`] } };
  }

  if (pending.effect.type === 'sweepDamageFromChosenCreature') {
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    if (found.ownerPlayerId !== playerId) return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature you control.` };

    const amount = effectivePower(targetDef, found.card, state, found.ownerPlayerId);
    const actor = getPlayer(state, playerId);
    let next = state;
    const dead: string[] = [];
    for (const p of next.players) {
      for (const c of p.zones.battlefield) {
        if (c.instanceId === targetInstanceId) continue;
        const cDef = getCardDefinition(c.defId);
        if (cDef.type !== 'creature') continue;
        if (hasKeywordEffective(cDef, c, 'indestructible') || hasBoardGrantedKeyword(next, p.id, c, cDef, 'indestructible')) continue;
        next = updatePlayer(next, p.id, (pl) => ({
          ...pl,
          zones: { ...pl.zones, battlefield: pl.zones.battlefield.map((bc) => (bc.instanceId === c.instanceId ? { ...bc, damageMarked: bc.damageMarked + amount } : bc)) },
        }));
        const updated = getPlayer(next, p.id).zones.battlefield.find((bc) => bc.instanceId === c.instanceId)!;
        if (updated.damageMarked >= effectiveToughness(cDef, updated, next, p.id)) dead.push(c.instanceId);
      }
    }
    next = { ...next, pendingTarget: null, log: [...next.log, `${actor.name}'s ${targetDef.name} deals ${amount} damage to every other creature.`] };
    if (dead.length > 0) {
      const sweepResult = moveCreaturesToGraveyardAndTrigger(next, dead, 'dies');
      next = { ...sweepResult.state, log: [...sweepResult.state.log, ...sweepResult.logLines] };
    }
    return { ok: true, state: next };
  }

  // 'bounceTarget' (Eject's 'nonland', Ice Magic's Blizzard 'creature') - no
  // controller restriction, so it's the last member of the
  // pendingTarget.effect union and needs no further type narrowing.
  if (pending.effect.targetFilter === 'creature' ? targetDef.type !== 'creature' : targetDef.type === 'land') {
    return { ok: false, error: `${targetDef.name} is not a legal target - it must be a ${pending.effect.targetFilter === 'creature' ? 'creature' : 'nonland permanent'}.` };
  }
  const bounceOwner = getPlayer(state, found.ownerPlayerId);
  let next = detachEverythingFrom(state, targetInstanceId);
  const bouncedCard = { ...found.card, tapped: false, attachedToInstanceId: undefined, damageMarked: 0 };
  next = updatePlayer(next, found.ownerPlayerId, (p) => ({ ...p, zones: { ...p.zones, battlefield: p.zones.battlefield.filter((c) => c.instanceId !== targetInstanceId) } }));
  if (isPlayersCommander(next, found.ownerPlayerId, found.card)) {
    next = beginCommanderZoneChoice(next, found.ownerPlayerId, 'hand', bouncedCard);
    next = { ...next, pendingTarget: null, log: [...next.log, `${targetDef.name} would return to ${bounceOwner.name}'s hand - ${bounceOwner.name} chooses whether it goes there or to the command zone instead.`] };
    return { ok: true, state: next };
  }
  next = updatePlayer(next, found.ownerPlayerId, (p) => ({ ...p, zones: { ...p.zones, hand: [...p.zones.hand, bouncedCard] } }));
  next = { ...next, pendingTarget: null, log: [...next.log, `${targetDef.name} is returned to ${bounceOwner.name}'s hand.`] };
  return { ok: true, state: next };
}

/** "Ward [cost]" - the player who tried to target a warded permanent (via
 * chooseTarget, above) either pays up (re-entering chooseTarget with
 * wardPaid so it goes through this time) or declines, countering the
 * whole spell/ability's targeting (clears pendingTarget entirely, same as
 * real Ward - it's the targeting that's countered, not just this one
 * target swapped for another). */
function resolveWardPayment(state: GameState, playerId: string, pay: boolean): ActionResult {
  const pending = state.pendingWardPayment;
  if (!pending) return { ok: false, error: 'Nothing is waiting on a Ward payment right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your payment to make." };

  const targetPending = state.pendingTarget;
  if (!targetPending) return { ok: true, state: { ...state, pendingWardPayment: null } };

  const wardTargetFound = findCardAnywhere(state, pending.targetInstanceId);
  const wardedName = wardTargetFound ? getCardDefinition(wardTargetFound.card.defId).name : 'That permanent';

  if (!pay) {
    const sourceFound = findCardAnywhere(state, targetPending.sourceInstanceId);
    const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : "That ability";
    return {
      ok: true,
      state: { ...state, pendingWardPayment: null, pendingTarget: null, log: [...state.log, `${sourceName} is countered by ${wardedName}'s Ward - the cost wasn't paid.`] },
    };
  }

  const actor = getPlayer(state, playerId);
  if (pending.cost.mana) {
    const parsed = parseCostLabel(pending.cost.mana);
    if (!canPay(actor.manaPool, parsed, 0)) return { ok: false, error: "Not enough mana to pay this Ward's cost." };
    const next = updatePlayer(state, playerId, (p) => ({ ...p, manaPool: payCost(p.manaPool, parsed, 0) }));
    const paidState = { ...next, pendingWardPayment: null, log: [...next.log, `${actor.name} pays ${wardedName}'s Ward cost.`] };
    return chooseTarget(paidState, playerId, pending.targetInstanceId, true);
  }
  if (pending.cost.lifeEqualToOwnPower && wardTargetFound) {
    const wardedDef = getCardDefinition(wardTargetFound.card.defId);
    const amount = effectivePower(wardedDef, wardTargetFound.card, state, pending.wardOwnerId);
    const next = loseLife(state, playerId, amount);
    const paidState = { ...next, pendingWardPayment: null, log: [...next.log, `${actor.name} pays ${amount} life for ${wardedName}'s Ward.`] };
    return chooseTarget(paidState, playerId, pending.targetInstanceId, true);
  }
  return { ok: false, error: "This Ward's cost can no longer be computed." };
}

/** "As it enters, choose a color" (Crossroads Village) - see types.ts:
 * ChooseManaColorEffect. Locks the choice onto the card instance forever
 * after; see toggleTap for where that then takes priority over the
 * CardDefinition's own (usually absent, for a card like this) producesMana. */
function chooseManaColor(state: GameState, playerId: string, color: ManaColor): ActionResult {
  const pending = state.pendingManaColorChoice;
  if (!pending) return { ok: false, error: 'Nothing is waiting on a colour choice right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your colour to choose." };
  // "Choose a color" (Crossroads Village) - one of the five real colors,
  // never colorless, matching real rules' distinction between "a color" and
  // {C}. Nothing currently uses this effect for anything but a genuine
  // 5-color choice, so this rejects 'C' unconditionally rather than needing
  // a per-card flag.
  if (color === 'C') return { ok: false, error: 'Choose one of the five colors (not colorless).' };

  const found = findCardAnywhere(state, pending.instanceId);
  const name = found ? getCardDefinition(found.card.defId).name : 'That permanent';

  let next = updatePlayer(state, playerId, (p) => ({
    ...p,
    zones: {
      ...p.zones,
      battlefield: p.zones.battlefield.map((c) => (c.instanceId === pending.instanceId ? { ...c, chosenManaColor: color } : c)),
    },
  }));
  next = { ...next, pendingManaColorChoice: null };

  return { ok: true, state: { ...next, log: [...next.log, `${name} will produce ${color} mana.`] } };
}

/** "Target opponent sacrifices a creature of their choice" (Cornered by
 * Black Mages) / "Each player sacrifices a [filter] of their choice" (Gaius
 * van Baelsar) - see types.ts: SacrificeCreatureEffect, EachPlayerSacrificesEffect.
 * Only reached for a real human player; the VS AI player picks its own
 * permanent automatically inside effects.ts's resolveSacrificeQueue instead.
 * Once this player's pick resolves, hands the rest of the queue (if any)
 * back to resolveSacrificeQueue to continue (auto-resolving any further AI
 * players, pausing again on the next human). */
function chooseSacrifice(state: GameState, playerId: string, instanceId: string): ActionResult {
  const pending = state.pendingSacrifice;
  if (!pending) return { ok: false, error: 'Nothing is waiting on a sacrifice right now.' };
  const [currentId, ...rest] = pending.remainingPlayerIds;
  if (currentId !== playerId) return { ok: false, error: "It's not your turn to sacrifice." };

  const player = getPlayer(state, playerId);
  const card = player.zones.battlefield.find((c) => c.instanceId === instanceId);
  if (!card) return { ok: false, error: 'That permanent is not on your battlefield.' };
  const def = getCardDefinition(card.defId);
  if (!matchesSacrificeFilter(def, card, pending.filter)) return { ok: false, error: `You must sacrifice a ${sacrificeFilterLabel(pending.filter)}.` };

  const sacResult = moveCreaturesToGraveyardAndTrigger(state, [instanceId], 'is sacrificed');
  let next = sacResult.state;
  const result = resolveSacrificeQueue(next, pending.sourceInstanceId, rest, pending.filter);
  next = { ...result.state, log: [...result.state.log, ...sacResult.logLines, ...result.logLines] };

  return { ok: true, state: next };
}

/** "Surveil N" (Ultimecia, Time Sorceress and future cards) - see types.ts:
 * SurveilEffect. `graveyardIds` and `keepOrder` together must account for
 * every surveiled card exactly once; `keepOrder` becomes the new top of the
 * library, first entry on top. */
function resolveSurveil(state: GameState, playerId: string, graveyardIds: string[], keepOrder: string[]): ActionResult {
  const pending = state.pendingSurveil;
  if (!pending) return { ok: false, error: 'Nothing is waiting on a surveil right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your surveil." };

  const allIds = new Set(pending.cards.map((c) => c.instanceId));
  const combined = [...graveyardIds, ...keepOrder];
  const combinedSet = new Set(combined);
  if (combined.length !== pending.cards.length || combinedSet.size !== pending.cards.length || ![...combinedSet].every((id) => allIds.has(id))) {
    return { ok: false, error: 'Surveil choices must account for every surveiled card exactly once.' };
  }

  const byId = new Map(pending.cards.map((c) => [c.instanceId, c]));
  const toGraveyard = graveyardIds.map((id) => byId.get(id)!);
  const toKeep = keepOrder.map((id) => byId.get(id)!);

  let next = updatePlayer(state, playerId, (p) => ({
    ...p,
    zones: { ...p.zones, graveyard: [...p.zones.graveyard, ...toGraveyard], library: [...toKeep, ...p.zones.library] },
  }));
  next = { ...next, pendingSurveil: null };

  let player = getPlayer(next, playerId);
  let logLine = `${player.name} surveils: ${toGraveyard.length} to the graveyard, ${toKeep.length} back on top.`;

  // "Whenever you scry or surveil, draw a card" (Matoya, Archon Elder) - this
  // engine only has surveil (no separate scry), so it triggers here for
  // every permanent the controller owns with onOwnSurveilDraw, regardless of
  // which permanent actually caused the surveil.
  const surveilDrawTriggers = player.zones.battlefield.filter((c) => getCardDefinition(c.defId).onOwnSurveilDraw);
  if (surveilDrawTriggers.length > 0) {
    const drawn = player.zones.library.slice(0, surveilDrawTriggers.length);
    next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(surveilDrawTriggers.length), hand: [...p.zones.hand, ...drawn] } }));
    player = getPlayer(next, playerId);
    logLine += ` ${drawn.length} card(s) drawn from surveil trigger(s).`;
  }

  // "Then draw a card" (Dreams of Laguna) - drawn from the library only now
  // that the keep/graveyard choice has actually rearranged it (see
  // types.ts: SurveilEffect.thenDrawCount for why this can't just be a
  // separate LootEffect earlier in the onCast array).
  if (pending.thenDrawCount) {
    const drawn = player.zones.library.slice(0, pending.thenDrawCount);
    next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(pending.thenDrawCount!), hand: [...p.zones.hand, ...drawn] } }));
    player = getPlayer(next, playerId);
    logLine += ` Then draws ${drawn.length} card(s).`;
  }

  return { ok: true, state: { ...next, log: [...next.log, logLine] } };
}

/** "Return a permanent card from your graveyard to your hand" (Vanille,
 * Cheerful l'Cie's millThenReturn) - see types.ts: MillThenReturnEffect. */
function returnFromGraveyard(state: GameState, playerId: string, instanceId: string): ActionResult {
  const pending = state.pendingReturnFromGraveyard;
  if (!pending) return { ok: false, error: 'Nothing is waiting on a graveyard return right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your graveyard to choose from." };

  const player = getPlayer(state, playerId);
  const card = player.zones.graveyard.find((c) => c.instanceId === instanceId);
  if (!card) return { ok: false, error: 'That card is not in your graveyard.' };
  const def = getCardDefinition(card.defId);
  if (def.type !== 'creature' && def.type !== 'artifact' && def.type !== 'enchantment' && def.type !== 'land') {
    return { ok: false, error: 'You must return a permanent card.' };
  }

  let next = updatePlayer(state, playerId, (p) => ({
    ...p,
    zones: { ...p.zones, graveyard: p.zones.graveyard.filter((c) => c.instanceId !== instanceId), hand: [...p.zones.hand, card] },
  }));
  next = { ...next, pendingReturnFromGraveyard: null };

  return { ok: true, state: { ...next, log: [...next.log, `${player.name} returns ${def.name} from the graveyard to hand.`] } };
}

/** "Draw a card, then discard a card" (Emet-Selch, Unsundered and other
 * loot effects) - see types.ts: LootEffect. Each call resolves one card of
 * the outstanding count; the pending state clears once it reaches 0. */
function discardCard(state: GameState, playerId: string, instanceId: string): ActionResult {
  const pending = state.pendingDiscard;
  if (!pending) return { ok: false, error: 'Nothing is waiting on a discard right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your discard." };

  const player = getPlayer(state, playerId);
  const card = player.zones.hand.find((c) => c.instanceId === instanceId);
  if (!card) return { ok: false, error: 'That card is not in your hand.' };
  const def = getCardDefinition(card.defId);

  let next = updatePlayer(state, playerId, (p) => ({
    ...p,
    zones: { ...p.zones, hand: p.zones.hand.filter((c) => c.instanceId !== instanceId), graveyard: [...p.zones.graveyard, { ...card, tapped: false }] },
  }));
  const remaining = pending.count - 1;
  const handLeft = getPlayer(next, playerId).zones.hand.length;
  next = { ...next, pendingDiscard: remaining > 0 && handLeft > 0 ? { ...pending, count: remaining } : null };

  return { ok: true, state: { ...next, log: [...next.log, `${player.name} discards ${def.name}.`] } };
}

/** "You may return another permanent you control to its owner's hand"
 * (Ambrosia Whiteheart's OptionalBounceEffect) - `instanceId: null` declines. */
function resolveOptionalBounce(state: GameState, playerId: string, instanceId: string | null): ActionResult {
  const pending = state.pendingOptionalBounce;
  if (!pending) return { ok: false, error: 'Nothing is waiting on an optional return right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your choice to make." };

  if (instanceId === null) {
    return { ok: true, state: { ...state, pendingOptionalBounce: null } };
  }

  const player = getPlayer(state, playerId);
  const card = player.zones.battlefield.find((c) => c.instanceId === instanceId);
  if (!card || instanceId === pending.sourceInstanceId) {
    return { ok: false, error: 'You must return another permanent you control.' };
  }
  const def = getCardDefinition(card.defId);

  let next = detachEverythingFrom(state, instanceId);
  const bouncedCard = { ...card, tapped: false, attachedToInstanceId: undefined, damageMarked: 0 };
  next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, battlefield: p.zones.battlefield.filter((c) => c.instanceId !== instanceId) } }));
  next = { ...next, pendingOptionalBounce: null };
  if (isPlayersCommander(next, playerId, card)) {
    next = beginCommanderZoneChoice(next, playerId, 'hand', bouncedCard);
    return { ok: true, state: { ...next, log: [...next.log, `${def.name} would return to ${player.name}'s hand - ${player.name} chooses whether it goes there or to the command zone instead.`] } };
  }
  next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, hand: [...p.zones.hand, bouncedCard] } }));

  return { ok: true, state: { ...next, log: [...next.log, `${player.name} returns ${def.name} to their hand.`] } };
}

/** "Return a land you control to its owner's hand" (Zell Dincht's end step
 * trigger, ReturnControlledLandToHandEffect) - mandatory and land-restricted,
 * unlike resolveOptionalBounce above. */
function resolveLandBounce(state: GameState, playerId: string, instanceId: string): ActionResult {
  const pending = state.pendingLandBounce;
  if (!pending) return { ok: false, error: 'Nothing is waiting on a land return right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your choice to make." };

  const player = getPlayer(state, playerId);
  const card = player.zones.battlefield.find((c) => c.instanceId === instanceId);
  if (!card || getCardDefinition(card.defId).type !== 'land') {
    return { ok: false, error: 'You must return a land you control.' };
  }
  const def = getCardDefinition(card.defId);

  let next = detachEverythingFrom(state, instanceId);
  next = updatePlayer(next, playerId, (p) => ({
    ...p,
    zones: { ...p.zones, battlefield: p.zones.battlefield.filter((c) => c.instanceId !== instanceId), hand: [...p.zones.hand, { ...card, tapped: false, attachedToInstanceId: undefined }] },
  }));
  next = { ...next, pendingLandBounce: null };

  return { ok: true, state: { ...next, log: [...next.log, `${player.name} returns ${def.name} to their hand.`] } };
}

/** "You may discard your hand, then draw cards equal to your devotion to
 * [color]" (Clive, Ifrit's Dominant) - devotion counts every symbol of that
 * color across the printed mana costs of permanents the controller
 * controls (X costs never count toward it). `accept: false` declines outright. */
function resolveOptionalDiscardHandForDevotion(state: GameState, playerId: string, accept: boolean): ActionResult {
  const pending = state.pendingOptionalDiscardHandForDevotion;
  if (!pending) return { ok: false, error: 'Nothing is waiting on that choice right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your choice to make." };

  if (!accept) {
    return { ok: true, state: { ...state, pendingOptionalDiscardHandForDevotion: null } };
  }

  const player = getPlayer(state, playerId);
  const devotion = player.zones.battlefield.reduce((sum, c) => {
    const def = getCardDefinition(c.defId);
    const colors = parseCostLabel(def.costLabel).colors as Record<string, number | undefined>;
    return sum + (colors[pending.color] ?? 0);
  }, 0);

  let next = updatePlayer(state, playerId, (p) => ({
    ...p,
    zones: { ...p.zones, hand: [], graveyard: [...p.zones.graveyard, ...p.zones.hand.map((c) => ({ ...c, tapped: false }))] },
  }));
  const drawn = getPlayer(next, playerId).zones.library.slice(0, devotion);
  next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(devotion), hand: [...p.zones.hand, ...drawn] } }));
  next = { ...next, pendingOptionalDiscardHandForDevotion: null };

  return { ok: true, state: { ...next, log: [...next.log, `${player.name} discards their hand and draws ${drawn.length} card(s) (devotion to ${pending.color}: ${devotion}).`] } };
}

/** "When [this] enters, choose one — ..." (Coliseum Behemoth) - resolves
 * the EXACTLY-one chosen mode's effects. See types.ts: ChooseOneModeEffect. */
function resolveChooseOneMode(state: GameState, playerId: string, modeIndex: number): ActionResult {
  const pending = state.pendingChooseOneMode;
  if (!pending) return { ok: false, error: 'Nothing is waiting on a mode choice right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your choice to make." };
  const mode = pending.modes[modeIndex];
  if (!mode) return { ok: false, error: 'That is not a legal mode.' };

  let next: GameState = { ...state, pendingChooseOneMode: null };
  const resolved = resolveCardEffects(next, playerId, mode.effects, pending.sourceInstanceId);
  next = resolved.state;
  return { ok: true, state: { ...next, log: [...next.log, ...resolved.logLines] } };
}

/** "Target player draws N cards" (Combat Tutorial) - the first "target a
 * player" effect in this engine. See types.ts: DrawCardsFromTargetPlayerEffect. */
function choosePlayerTarget(state: GameState, playerId: string, targetPlayerId: string): ActionResult {
  const pending = state.pendingPlayerTarget;
  if (!pending) return { ok: false, error: 'Nothing is waiting on a player target right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your target to choose." };
  if (!state.players.some((p) => p.id === targetPlayerId)) return { ok: false, error: 'That is not a legal player target.' };

  const { count } = pending.effect;
  const target = getPlayer(state, targetPlayerId);
  const drawn = target.zones.library.slice(0, count);
  let next = updatePlayer(state, targetPlayerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(count), hand: [...p.zones.hand, ...drawn] } }));
  next = { ...next, pendingPlayerTarget: null };

  return { ok: true, state: { ...next, log: [...next.log, `${target.name} draws ${drawn.length} card(s).`] } };
}

/** "Return target creature card from your graveyard to the battlefield[,
 * with N additional counters on it]" (Evil Reawakened) - see types.ts:
 * ReanimateTargetFromGraveyardEffect. The picked card must be a creature in
 * the CONTROLLER's own graveyard (not any battlefield permanent, unlike the
 * rest of the pendingTarget family). */
function resolveReanimate(state: GameState, playerId: string, instanceId: string): ActionResult {
  const pending = state.pendingReanimate;
  if (!pending) return { ok: false, error: 'Nothing is waiting on a reanimation target right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your target to choose." };

  const player = getPlayer(state, playerId);
  const card = player.zones.graveyard.find((c) => c.instanceId === instanceId);
  if (!card) return { ok: false, error: 'That card is not in your graveyard.' };
  const def = getCardDefinition(card.defId);
  if (!matchesReanimateFilter(def, pending.effect)) {
    const wantCreature = !pending.effect.nonlegendaryPermanentInsteadOfCreature;
    return { ok: false, error: `${def.name} is not a legal target - it must be a${wantCreature ? ' creature card' : ' nonlegendary permanent card'}.` };
  }

  const { extraCounterLabel, extraCounterAmount, forceEntersTapped } = pending.effect;
  const counters = extraCounterLabel && extraCounterAmount ? [{ label: extraCounterLabel, amount: extraCounterAmount }] : [];
  const hasHaste = hasKeyword(def, 'haste');
  const entersTapped = !!forceEntersTapped || !!def.entersTapped;
  const movedCard: CardInstance = stripSagaProgress({ ...card, tapped: entersTapped, damageMarked: 0, summoningSick: !hasHaste, counters, attachedToInstanceId: undefined });

  let next = updatePlayer(state, playerId, (p) => ({
    ...p,
    zones: { ...p.zones, graveyard: p.zones.graveyard.filter((c) => c.instanceId !== instanceId), battlefield: [...p.zones.battlefield, movedCard] },
  }));
  next = checkLegendRule(next, playerId);
  next = { ...next, pendingReanimate: null };

  let effectLogLines: string[] = [];
  if (def.onEnter && def.onEnter.length > 0) {
    const resolved = resolveCardEffects(next, playerId, def.onEnter, movedCard.instanceId);
    next = resolved.state;
    effectLogLines = resolved.logLines;
  }

  const counterNote = counters.length > 0 ? ` with ${extraCounterAmount} ${extraCounterLabel} counter(s)` : '';
  return { ok: true, state: { ...next, log: [...next.log, `${player.name} returns ${def.name} to the battlefield${counterNote}.`, ...effectLogLines] } };
}

/** "You may put a land card from your hand onto the battlefield" (PuPu UFO,
 * PutLandFromHandOntoBattlefieldEffect) - null declines. Doesn't touch
 * hasPlayedLandThisTurn/landsPlayedThisTurn at all (this isn't "playing" a
 * land, so it never counts against the controller's land-drop budget). */
function resolvePutLandFromHand(state: GameState, playerId: string, instanceId: string | null): ActionResult {
  const pending = state.pendingPutLandFromHand;
  if (!pending) return { ok: false, error: 'Nothing is waiting on that choice right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your choice to make." };

  if (!instanceId) {
    return { ok: true, state: { ...state, pendingPutLandFromHand: null } };
  }

  const player = getPlayer(state, playerId);
  const card = player.zones.hand.find((c) => c.instanceId === instanceId);
  if (!card) return { ok: false, error: 'That card is not in your hand.' };
  const def = getCardDefinition(card.defId);
  if (def.type !== 'land') return { ok: false, error: `${def.name} is not a land.` };

  const movedCard: CardInstance = { ...card, tapped: !!def.entersTapped, damageMarked: 0, summoningSick: false };
  let next = updatePlayer(state, playerId, (p) => ({
    ...p,
    zones: { ...p.zones, hand: p.zones.hand.filter((c) => c.instanceId !== instanceId), battlefield: [...p.zones.battlefield, movedCard] },
  }));
  next = checkLegendRule(next, playerId);
  next = { ...next, pendingPutLandFromHand: null };

  let effectLogLines: string[] = [];
  if (def.onEnter && def.onEnter.length > 0) {
    const resolved = resolveCardEffects(next, playerId, def.onEnter, movedCard.instanceId);
    next = resolved.state;
    effectLogLines = resolved.logLines;
  }
  const landfallResult = triggerLandfall(next, playerId);
  next = landfallResult.state;
  effectLogLines = [...effectLogLines, ...landfallResult.logLines];

  return { ok: true, state: { ...next, log: [...next.log, `${player.name} puts ${def.name} onto the battlefield.`, ...effectLogLines] } };
}

/** "You may cast target instant or sorcery card from a graveyard, and mana
 * of any type can be spent to cast that spell. If that spell would be put
 * into a graveyard, exile it instead" (Quistis Trepe,
 * CastTargetInstantOrSorceryFromGraveyardAnyManaEffect) - null declines.
 * "a graveyard" (not "your graveyard") means either player's graveyard is a
 * legal source, matching resolveOptionalSacrificeForExilePlay-style "any
 * color mana" cost handling from castFromExile. */
function resolveCastFromGraveyardAnyMana(state: GameState, playerId: string, instanceId: string | null): ActionResult {
  const pending = state.pendingCastFromGraveyardAnyMana;
  if (!pending) return { ok: false, error: 'Nothing is waiting on that choice right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your choice to make." };

  if (!instanceId) {
    return { ok: true, state: { ...state, pendingCastFromGraveyardAnyMana: null } };
  }

  const found = findCardAnywhere(state, instanceId);
  if (!found || found.zone !== 'graveyard') return { ok: false, error: 'That card is not in a graveyard.' };
  const def = getCardDefinition(found.card.defId);
  if (def.type !== 'instant' && def.type !== 'sorcery') return { ok: false, error: `${def.name} is not a legal target - it must be an instant or sorcery card.` };

  const mutual = isMutualActive(state);
  const player = getPlayer(state, playerId);
  const preCastBattlefieldIds = new Set(player.zones.battlefield.map((c) => c.instanceId));
  const parsed = parseCostLabel(def.costLabel);
  const colorPips = Object.values(parsed.colors).reduce((a: number, b) => a + (b ?? 0), 0);
  const effectiveParsed = { generic: parsed.generic + colorPips, colors: {}, hasX: parsed.hasX };

  if (!mutual && !canPay(player.manaPool, effectiveParsed, 0)) {
    return { ok: false, error: `Not enough mana to cast ${def.name} (${def.costLabel}).` };
  }

  let next = state;
  if (!mutual) next = updatePlayer(next, playerId, (p) => ({ ...p, manaPool: payCost(p.manaPool, effectiveParsed, 0) }));
  next = updatePlayer(next, found.ownerPlayerId, (p) => ({ ...p, zones: { ...p.zones, graveyard: p.zones.graveyard.filter((c) => c.instanceId !== instanceId) } }));
  next = { ...next, pendingCastFromGraveyardAnyMana: null };

  let effectLogLines: string[] = [];
  if (def.onCast && def.onCast.length > 0) {
    const resolved = resolveCardEffects(next, playerId, def.onCast, instanceId);
    next = resolved.state;
    effectLogLines = resolved.logLines;
  }
  const triggered = triggerNoncreatureCastAbilities(next, playerId, manaValue(effectiveParsed), preCastBattlefieldIds);
  next = triggered.state;
  effectLogLines = [...effectLogLines, ...triggered.logLines];

  // "If that spell would be put into a graveyard, exile it instead" -
  // redirects the normal post-resolution destination for a cast instant/
  // sorcery (its owner's graveyard) to its owner's exile zone.
  next = updatePlayer(next, found.ownerPlayerId, (p) => ({ ...p, zones: { ...p.zones, exile: [...p.zones.exile, found.card] } }));

  return { ok: true, state: { ...next, log: [...next.log, `${player.name} casts ${def.name} from a graveyard, then it is exiled.`, ...effectLogLines] } };
}

/** "You may cast artifact spells from your graveyard by paying N life in
 * addition to paying their other costs. If you cast a spell this way, that
 * artifact enters with a finality counter on it" (Noctis, Prince of Lucis,
 * CardDefinition.grantsCastArtifactsFromGraveyardForLife) - a STATIC,
 * always-available permission (unlike Flashback, not tied to the card's
 * own ability), so this is invoked directly via GameAction
 * 'CAST_ARTIFACT_FROM_GRAVEYARD_FOR_LIFE' rather than through a pending
 * choice or a per-card effect. */
function castArtifactFromGraveyardForLife(state: GameState, playerId: string, instanceId: string, sourceInstanceId: string): ActionResult {
  const mutual = isMutualActive(state);
  const player = getPlayer(state, playerId);
  const source = player.zones.battlefield.find((c) => c.instanceId === sourceInstanceId);
  if (!source) return { ok: false, error: 'That permanent is not on your battlefield.' };
  const sourceDef = getCardDefinition(source.defId);
  if (!sourceDef.grantsCastArtifactsFromGraveyardForLife) return { ok: false, error: `${sourceDef.name} doesn't grant this.` };
  const extraLifeCost = sourceDef.grantsCastArtifactsFromGraveyardForLife;

  const card = player.zones.graveyard.find((c) => c.instanceId === instanceId);
  if (!card) return { ok: false, error: 'That card is not in your graveyard.' };
  const def = getCardDefinition(card.defId);
  if (def.type !== 'artifact') return { ok: false, error: `${def.name} is not an artifact.` };

  const preCastBattlefieldIds = new Set(player.zones.battlefield.map((c) => c.instanceId));
  const parsed = parseCostLabel(def.costLabel);

  if (!mutual && !canPay(player.manaPool, parsed, 0)) {
    return { ok: false, error: `Not enough mana to cast ${def.name} (${def.costLabel}).` };
  }
  if (!mutual && player.life <= extraLifeCost) {
    return { ok: false, error: `Not enough life to pay the additional cost (${extraLifeCost}).` };
  }

  let next = state;
  if (!mutual) {
    next = updatePlayer(next, playerId, (p) => ({ ...p, manaPool: payCost(p.manaPool, parsed, 0), life: p.life - extraLifeCost }));
  }
  next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, graveyard: p.zones.graveyard.filter((c) => c.instanceId !== instanceId) } }));

  const movedCard: CardInstance = stripSagaProgress({
    ...card,
    tapped: !!def.entersTapped,
    damageMarked: 0,
    summoningSick: !hasKeyword(def, 'haste'),
    counters: [{ label: 'Finality', amount: 1 }],
  });
  next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, battlefield: [...p.zones.battlefield, movedCard] } }));
  next = checkLegendRule(next, playerId);

  let effectLogLines: string[] = [];
  if (def.onEnter && def.onEnter.length > 0) {
    const resolved = resolveCardEffects(next, playerId, def.onEnter, movedCard.instanceId);
    next = resolved.state;
    effectLogLines = resolved.logLines;
  }
  const artifactWatchResult = triggerArtifactEnterWatchers(next, playerId);
  next = artifactWatchResult.state;
  effectLogLines = [...effectLogLines, ...artifactWatchResult.logLines];
  const subtypeWatchResult = triggerSubtypeEnterWatchers(next, playerId, def.subtype);
  next = subtypeWatchResult.state;
  effectLogLines = [...effectLogLines, ...subtypeWatchResult.logLines];
  const triggered = triggerNoncreatureCastAbilities(next, playerId, manaValue(parsed), preCastBattlefieldIds);
  next = triggered.state;
  effectLogLines = [...effectLogLines, ...triggered.logLines];

  return {
    ok: true,
    state: { ...next, log: [...next.log, `${player.name} casts ${def.name} from their graveyard (paying ${extraLifeCost} life), entering with a finality counter.`, ...effectLogLines] },
  };
}

/** "You may put a land card from among them into your hand. If you put a
 * Town card into your hand this way, you gain 2 life" (Town Greeter,
 * MillThenPutLandIntoHandGainLifeIfTownEffect) - null declines. */
function resolveMillThenPutLandIntoHand(state: GameState, playerId: string, instanceId: string | null): ActionResult {
  const pending = state.pendingMillThenPutLandIntoHand;
  if (!pending) return { ok: false, error: 'Nothing is waiting on that choice right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your choice to make." };

  if (!instanceId) {
    return { ok: true, state: { ...state, pendingMillThenPutLandIntoHand: null } };
  }

  if (!pending.milledInstanceIds.includes(instanceId)) {
    return { ok: false, error: 'You must choose one of the cards just milled.' };
  }
  const player = getPlayer(state, playerId);
  const card = player.zones.graveyard.find((c) => c.instanceId === instanceId);
  if (!card) return { ok: false, error: 'That card is not in your graveyard.' };
  const def = getCardDefinition(card.defId);
  if (def.type !== 'land') return { ok: false, error: `${def.name} is not a land.` };

  let next = updatePlayer(state, playerId, (p) => ({
    ...p,
    zones: { ...p.zones, graveyard: p.zones.graveyard.filter((c) => c.instanceId !== instanceId), hand: [...p.zones.hand, card] },
  }));
  next = { ...next, pendingMillThenPutLandIntoHand: null };

  let logLines = [`${player.name} puts ${def.name} into their hand.`];
  if (def.subtype?.toLowerCase().includes('town')) {
    const gainResult = resolveCardEffects(next, playerId, [{ type: 'gainLife', amount: pending.lifeGainIfTown }], pending.sourceInstanceId);
    next = gainResult.state;
    logLines = [...logLines, ...gainResult.logLines];
  }

  return { ok: true, state: { ...next, log: [...next.log, ...logLines] } };
}

/** "Return target instant or sorcery card from your graveyard to your
 * hand" (Sorceress's Schemes, ReturnInstantOrSorceryFromGraveyardToHandEffect). */
function resolveReturnInstantOrSorceryFromGraveyard(state: GameState, playerId: string, instanceId: string): ActionResult {
  const pending = state.pendingReturnInstantOrSorceryFromGraveyard;
  if (!pending) return { ok: false, error: 'Nothing is waiting on that target right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your target to choose." };

  const player = getPlayer(state, playerId);
  const card = player.zones.graveyard.find((c) => c.instanceId === instanceId);
  if (!card) return { ok: false, error: 'That card is not in your graveyard.' };
  const def = getCardDefinition(card.defId);
  if (def.type !== 'instant' && def.type !== 'sorcery') return { ok: false, error: `${def.name} is not a legal target - it must be an instant or sorcery card.` };

  const next = updatePlayer(state, playerId, (p) => ({
    ...p,
    zones: { ...p.zones, graveyard: p.zones.graveyard.filter((c) => c.instanceId !== instanceId), hand: [...p.zones.hand, card] },
  }));

  return { ok: true, state: { ...next, pendingReturnInstantOrSorceryFromGraveyard: null, log: [...next.log, `${player.name} returns ${def.name} to their hand.`] } };
}

/** "Return up to N target creature cards from your graveyard to your hand"
 * (Fight On!) - see types.ts: ReturnCreaturesFromGraveyardToHandEffect.
 * `instanceId: null` stops early (the "up to" part); otherwise picks one
 * more creature card and decrements `remaining`, clearing the pending state
 * once it hits 0 or the graveyard runs out of legal picks. */
function resolveReturnCreatureFromGraveyard(state: GameState, playerId: string, instanceId: string | null): ActionResult {
  const pending = state.pendingReturnCreaturesFromGraveyard;
  if (!pending) return { ok: false, error: 'Nothing is waiting on a graveyard return right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your choice to make." };

  if (instanceId === null) {
    return { ok: true, state: { ...state, pendingReturnCreaturesFromGraveyard: null, log: [...state.log, `${getPlayer(state, playerId).name} stops returning cards from their graveyard.`] } };
  }

  const player = getPlayer(state, playerId);
  const card = player.zones.graveyard.find((c) => c.instanceId === instanceId);
  if (!card) return { ok: false, error: 'That card is not in your graveyard.' };
  const def = getCardDefinition(card.defId);
  if (!matchesReturnFromGraveyardFilter(def, { type: 'returnCreaturesFromGraveyardToHand', count: 0, anyPermanentInsteadOfCreature: pending.anyPermanentInsteadOfCreature })) {
    const wantCreature = !pending.anyPermanentInsteadOfCreature;
    return { ok: false, error: `${def.name} is not a legal target - it must be a${wantCreature ? ' creature card' : ' permanent card'}.` };
  }

  let next = updatePlayer(state, playerId, (p) => ({
    ...p,
    zones: { ...p.zones, graveyard: p.zones.graveyard.filter((c) => c.instanceId !== instanceId), hand: [...p.zones.hand, card] },
  }));

  const remaining = pending.remaining - 1;
  const stillEligible = getPlayer(next, playerId)
    .zones.graveyard.some((c) => matchesReturnFromGraveyardFilter(getCardDefinition(c.defId), { type: 'returnCreaturesFromGraveyardToHand', count: 0, anyPermanentInsteadOfCreature: pending.anyPermanentInsteadOfCreature }));
  next = { ...next, pendingReturnCreaturesFromGraveyard: remaining > 0 && stillEligible ? { ...pending, remaining } : null };

  return { ok: true, state: { ...next, log: [...next.log, `${player.name} returns ${def.name} to their hand.`] } };
}

/** "Whenever [this] deals combat damage to a player, you may exile it, then
 * return it to the battlefield transformed" (Jecht, Reluctant Guardian) -
 * the trigger fires the instant damage is dealt (mid-combat), but the
 * actual choice stays open until combat has fully resolved and left the
 * board: exiling Jecht mid-combat_end would swap out the attacker's
 * instanceId while the attack box is still showing it, making him just
 * vanish from his own attack instead of visibly finishing the attack first.
 * See GameBoard.tsx's own showCombatZones-gated banner for the matching
 * client-side wait. */
function resolveOptionalTransform(state: GameState, playerId: string, accept: boolean): ActionResult {
  const pending = state.pendingOptionalTransform;
  if (!pending) return { ok: false, error: 'Nothing is waiting on an optional transform right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your choice to make." };
  if (state.phase === 'declare_attackers' || state.phase === 'declare_blockers' || state.phase === 'combat_damage' || state.phase === 'combat_end') {
    return { ok: false, error: 'Wait until combat ends before deciding whether to transform.' };
  }

  if (!accept) {
    return { ok: true, state: { ...state, pendingOptionalTransform: null } };
  }

  const result = exileAndReturnTransformed(state, playerId, pending.sourceInstanceId);
  const next = { ...result.state, pendingOptionalTransform: null, log: [...result.state.log, ...result.logLines] };
  return { ok: true, state: next };
}

/** "You may pay N life. If you do, ..." (Seymour Flux's upkeep trigger). */
function resolveOptionalPayLife(state: GameState, playerId: string, accept: boolean): ActionResult {
  const pending = state.pendingOptionalPayLife;
  if (!pending) return { ok: false, error: 'Nothing is waiting on an optional payment right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your choice to make." };

  if (!accept) {
    return { ok: true, state: { ...state, pendingOptionalPayLife: null } };
  }

  const sourceName = getCardDefinition(findCardAnywhere(state, pending.sourceInstanceId)!.card.defId).name;
  let next = loseLife(state, playerId, pending.lifeCost);
  next = { ...next, log: [...next.log, `${getPlayer(next, playerId).name} pays ${pending.lifeCost} life for ${sourceName}.`] };
  const resolved = resolveCardEffects(next, playerId, pending.effects, pending.sourceInstanceId);
  next = { ...resolved.state, pendingOptionalPayLife: null, log: [...resolved.state.log, ...resolved.logLines] };
  return { ok: true, state: next };
}

/** The real "commander replacement effect" - the owner chooses between the
 * command zone and wherever their commander was actually headed (see
 * GameState.pendingCommanderZoneChoice/engine/combat.ts:
 * beginCommanderZoneChoice). Both outcomes were already precomputed at the
 * moment of departure, so this just places whichever one was chosen into
 * its zone and, if another commander's choice was queued behind this one
 * (a board wipe killing both at once), promotes it to the new pending one. */
function resolveCommanderZoneChoice(state: GameState, playerId: string, toCommandZone: boolean): ActionResult {
  const pending = state.pendingCommanderZoneChoice;
  if (!pending) return { ok: false, error: 'Nothing is waiting on a commander zone choice right now.' };
  if (pending.ownerId !== playerId) return { ok: false, error: "It's not your commander." };

  const chosenCard = toCommandZone ? pending.commandZoneCard : pending.destinationCard;
  const def = getCardDefinition(chosenCard.defId);
  let next = updatePlayer(state, playerId, (p) => ({
    ...p,
    zones: { ...p.zones, [toCommandZone ? 'commander' : pending.destinationZone]: [...p.zones[toCommandZone ? 'commander' : pending.destinationZone], chosenCard] },
  }));
  const destinationLabel = toCommandZone ? 'command zone' : pending.destinationZone;
  next = { ...next, log: [...next.log, `${getPlayer(next, playerId).name} sends ${def.name} to the ${destinationLabel}.`] };

  const [nextPending, ...restQueue] = pending.queued;
  next = { ...next, pendingCommanderZoneChoice: nextPending ? { ...nextPending, queued: restQueue } : null };
  return { ok: true, state: next };
}

/** "You may cast a spell from your hand with mana value less than or equal
 * to that damage without paying its mana cost." (Buster Sword's granted
 * trigger) - instanceId: null declines. Restricted to nonland cards
 * ("spell" excludes lands) at or under pending.maxManaValue; delegates the
 * actual cast to castCard's `free` param (bypasses both cost and normal
 * timing - see castCard). */
function resolveFreeCastFromHand(state: GameState, playerId: string, instanceId: string | null): ActionResult {
  const pending = state.pendingFreeCastFromHand;
  if (!pending) return { ok: false, error: 'Nothing is waiting on a free cast right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your choice to make." };

  if (!instanceId) {
    return { ok: true, state: { ...state, pendingFreeCastFromHand: null } };
  }

  const player = getPlayer(state, playerId);
  const card = player.zones.hand.find((c) => c.instanceId === instanceId);
  if (!card) return { ok: false, error: 'That card is not in your hand.' };
  const def = getCardDefinition(card.defId);
  if (def.type === 'land') return { ok: false, error: 'A land is not a spell - it can’t be cast this way.' };
  if (manaValue(effectiveCastCost(def, player)) > pending.maxManaValue) {
    return { ok: false, error: `${def.name}'s mana value is too high (max ${pending.maxManaValue}).` };
  }

  const result = castCard(state, playerId, instanceId, undefined, undefined, undefined, true);
  if (!result.ok) return result;
  return { ok: true, state: { ...result.state, pendingFreeCastFromHand: null } };
}

/** Resolving a GameState.pendingLibrarySearch - instanceId: null means the
 * controller chose to find nothing (always allowed, same as a real "search
 * for a [type] card" never being forced to actually find one). A chosen
 * card must still be in the library and still match the filter (defense
 * against a stale/replayed action - the client only ever offers matches in
 * the first place). Reveal (when pending.reveal) marks the found card with
 * CardInstance.revealedToOpponentWhileInHand and posts GameState.lastReveal
 * for the client's own "X reveals Y" notification. */
function resolveLibrarySearch(state: GameState, playerId: string, instanceId: string | null): ActionResult {
  const pending = state.pendingLibrarySearch;
  if (!pending) return { ok: false, error: 'Nothing is waiting on a library search right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your search to make." };

  const player = getPlayer(state, playerId);

  if (!instanceId) {
    const next = updatePlayer(state, playerId, (p) => ({ ...p, zones: { ...p.zones, library: shuffle(p.zones.library) } }));
    return { ok: true, state: { ...next, pendingLibrarySearch: null, log: [...next.log, `${player.name} finds nothing.`] } };
  }

  const foundIndex = player.zones.library.findIndex((c) => c.instanceId === instanceId);
  if (foundIndex === -1) return { ok: false, error: 'That card is not in your library.' };
  const foundCard = player.zones.library[foundIndex];
  if (!matchesLibrarySearchFilter(getCardDefinition(foundCard.defId), pending.filter)) {
    return { ok: false, error: "That card doesn't match what this search is looking for." };
  }
  const foundName = getCardDefinition(foundCard.defId).name;
  if (pending.excludeNames?.includes(foundName)) {
    return { ok: false, error: 'You already found a card with that name this search - the rest must have different names.' };
  }

  const rest = player.zones.library.filter((_, i) => i !== foundIndex);
  const logLines: string[] = [];
  let next: GameState;

  if (pending.toBattlefieldTapped) {
    const movedCard: CardInstance = { ...foundCard, tapped: true };
    next = updatePlayer(state, playerId, (p) => ({ ...p, zones: { ...p.zones, library: shuffle(rest), battlefield: [...p.zones.battlefield, movedCard] } }));
    logLines.push(`${player.name} finds ${foundName} and puts it onto the battlefield tapped.`);
  } else if (pending.toBattlefieldUntapped) {
    const movedCard: CardInstance = { ...foundCard, tapped: false, damageMarked: 0, summoningSick: !hasKeyword(getCardDefinition(foundCard.defId), 'haste') };
    next = updatePlayer(state, playerId, (p) => ({ ...p, zones: { ...p.zones, library: shuffle(rest), battlefield: [...p.zones.battlefield, movedCard] } }));
    logLines.push(`${player.name} finds ${foundName} and puts it onto the battlefield.`);
  } else {
    const movedCard: CardInstance = pending.reveal ? { ...foundCard, revealedToOpponentWhileInHand: true } : foundCard;
    next = updatePlayer(state, playerId, (p) => ({ ...p, zones: { ...p.zones, library: shuffle(rest), hand: [...p.zones.hand, movedCard] } }));
    logLines.push(`${player.name} finds ${foundName}.`);
  }

  // "Search for up to N ... with different names" (Reach the Horizon) - a
  // completed pick with picks still remaining re-arms the search excluding
  // this name, instead of ending it; if nothing else in the library still
  // qualifies, ends gracefully with whatever was already found.
  if (pending.remainingPicks && pending.remainingPicks > 0) {
    const newExcludeNames = [...(pending.excludeNames ?? []), foundName];
    const stillHasMatch = getPlayer(next, playerId).zones.library.some(
      (c) => matchesLibrarySearchFilter(getCardDefinition(c.defId), pending.filter) && !newExcludeNames.includes(getCardDefinition(c.defId).name)
    );
    next = {
      ...next,
      pendingLibrarySearch: stillHasMatch ? { ...pending, remainingPicks: pending.remainingPicks - 1, excludeNames: newExcludeNames } : null,
    };
  } else {
    next = { ...next, pendingLibrarySearch: null };
  }

  if (pending.reveal && !pending.toBattlefieldTapped && !pending.toBattlefieldUntapped) {
    next = { ...next, lastReveal: { instanceId, ownerId: playerId, sourceInstanceId: pending.sourceInstanceId } };
    const sourceFound = findCardAnywhere(next, pending.sourceInstanceId);
    const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'an ability';
    logLines.push(`${player.name} reveals ${foundName} (found via ${sourceName}).`);
  }

  return { ok: true, state: { ...next, log: [...next.log, ...logLines] } };
}

/** "Search your library and/or graveyard for an artifact card with mana
 * value N or less" (Delivery Moogle, SearchLibraryOrGraveyardForArtifactEffect) -
 * unlike resolveLibrarySearch, the chosen card can come from either zone. */
function resolveLibraryOrGraveyardSearch(state: GameState, playerId: string, instanceId: string | null): ActionResult {
  const pending = state.pendingLibraryOrGraveyardSearch;
  if (!pending) return { ok: false, error: 'Nothing is waiting on that search right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your search to make." };

  const player = getPlayer(state, playerId);

  if (!instanceId) {
    const next = updatePlayer(state, playerId, (p) => ({ ...p, zones: { ...p.zones, library: shuffle(p.zones.library) } }));
    return { ok: true, state: { ...next, pendingLibraryOrGraveyardSearch: null, log: [...next.log, `${player.name} finds nothing.`] } };
  }

  const matches = (c: CardInstance) => {
    const d = getCardDefinition(c.defId);
    return d.type === 'artifact' && manaValue(parseCostLabel(d.costLabel)) <= pending.maxManaValue;
  };

  const fromLibraryIndex = player.zones.library.findIndex((c) => c.instanceId === instanceId);
  const fromGraveyardIndex = player.zones.graveyard.findIndex((c) => c.instanceId === instanceId);
  if (fromLibraryIndex === -1 && fromGraveyardIndex === -1) return { ok: false, error: 'That card is not in your library or graveyard.' };

  const foundCard = fromLibraryIndex !== -1 ? player.zones.library[fromLibraryIndex] : player.zones.graveyard[fromGraveyardIndex];
  if (!matches(foundCard)) return { ok: false, error: "That card doesn't match what this search is looking for." };
  const foundName = getCardDefinition(foundCard.defId).name;

  let next: GameState;
  if (fromLibraryIndex !== -1) {
    const rest = player.zones.library.filter((_, i) => i !== fromLibraryIndex);
    next = updatePlayer(state, playerId, (p) => ({ ...p, zones: { ...p.zones, library: shuffle(rest), hand: [...p.zones.hand, foundCard] } }));
  } else {
    const rest = player.zones.graveyard.filter((_, i) => i !== fromGraveyardIndex);
    next = updatePlayer(state, playerId, (p) => ({ ...p, zones: { ...p.zones, graveyard: rest, hand: [...p.zones.hand, foundCard] } }));
  }
  next = { ...next, pendingLibraryOrGraveyardSearch: null };

  return { ok: true, state: { ...next, log: [...next.log, `${player.name} finds ${foundName} and puts it into their hand.`] } };
}

/** Picking up a RevealTopThenLoseLifeByManaValueEffect's reveal (Dark
 * Confidant) - moves it into hand, applies the life loss, and records it on
 * the source permanent's revealedCardIds history (if it's still on the
 * battlefield - it normally is, but don't crash if something else removed it
 * mid-upkeep). If another copy of this effect is queued behind this one
 * (GameState.pendingRevealPickup.queuedSourceIds), immediately reveals its
 * source's turn next via beginRevealPickup. */
function resolveRevealPickup(state: GameState, playerId: string): ActionResult {
  const pending = state.pendingRevealPickup;
  if (!pending) return { ok: false, error: 'Nothing is waiting on a reveal pickup right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your reveal to pick up." };

  const revealedDef = getCardDefinition(pending.revealedCard.defId);
  const mv = manaValue(parseCostLabel(revealedDef.costLabel));
  let next = updatePlayer(state, playerId, (p) => ({
    ...p,
    life: p.life - mv,
    zones: {
      ...p.zones,
      hand: [...p.zones.hand, pending.revealedCard],
      battlefield: p.zones.battlefield.map((c) =>
        c.instanceId === pending.sourceInstanceId ? { ...c, revealedCardIds: [...(c.revealedCardIds ?? []), pending.revealedCard.instanceId] } : c
      ),
    },
  }));
  const player = getPlayer(next, playerId);
  let logLines = [`${player.name} picks up ${revealedDef.name}, adding it to their hand, and loses ${mv} life.`];

  next = { ...next, pendingRevealPickup: null };
  if (pending.queuedSourceIds.length > 0) {
    const [nextSource, ...rest] = pending.queuedSourceIds;
    const result = beginRevealPickup(next, playerId, nextSource, rest);
    next = result.state;
    logLines = [...logLines, ...result.logLines];
  }

  return { ok: true, state: { ...next, log: [...next.log, ...logLines] } };
}

/** "Flip a coin. If you win the flip, [ifWinEffects]." (The Gold Saucer) -
 * the flip itself happens right here, the instant the controller calls a
 * side: no separate "reveal" pause the way pendingSurveil/pendingTarget etc.
 * work, since there's nothing left to choose once the coin's been called.
 * Sets GameState.lastCoinFlip purely so the client can animate/display the
 * result (components/CoinFlipModal.tsx) - the actual state changes from
 * winning have already happened by the time it reads that. */
function chooseCoinSide(state: GameState, playerId: string, side: 'heads' | 'tails'): ActionResult {
  const pending = state.pendingCoinFlip;
  if (!pending) return { ok: false, error: 'Nothing is waiting on a coin flip right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your coin flip." };

  const result: 'heads' | 'tails' = Math.random() < 0.5 ? 'heads' : 'tails';
  const won = result === side;
  let next: GameState = {
    ...state,
    pendingCoinFlip: null,
    lastCoinFlip: { id: nextInstanceId(), sourceInstanceId: pending.sourceInstanceId, controllerId: playerId, called: side, result, won },
  };

  const actor = getPlayer(next, playerId);
  const source = findCardAnywhere(next, pending.sourceInstanceId);
  const sourceName = source ? getCardDefinition(source.card.defId).name : 'The ability';
  let logLines = [`${actor.name} calls ${side} for ${sourceName}'s coin flip - it lands on ${result}. ${actor.name} ${won ? 'wins' : 'loses'} the flip.`];

  if (won && pending.ifWinEffects.length > 0) {
    const resolved = resolveCardEffects(next, playerId, pending.ifWinEffects, pending.sourceInstanceId);
    next = resolved.state;
    logLines = [...logLines, ...resolved.logLines];
  }

  return { ok: true, state: { ...next, log: [...next.log, ...logLines] } };
}

/** "Look at the top N cards of your library, exile one face down, then put
 * the rest on the bottom in a random order." (Clive's Hideaway's Hideaway 4)
 * - the exiled card is tied to `sourceInstanceId` via
 * CardInstance.hideawayExiledCardId, for that same permanent's own
 * playHideawayCard release ability to find later. Not optional - there's no
 * "may" in the reminder text, so `instanceId` must be one of
 * pending.cards. */
function resolveHideaway(state: GameState, playerId: string, instanceId: string): ActionResult {
  const pending = state.pendingHideaway;
  if (!pending) return { ok: false, error: 'Nothing is waiting on a hideaway pick right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your hideaway pick." };
  const chosen = pending.cards.find((c) => c.instanceId === instanceId);
  if (!chosen) return { ok: false, error: 'That card is not among the ones being looked at.' };

  const rest = shuffle(pending.cards.filter((c) => c.instanceId !== instanceId));
  let next: GameState = updatePlayer(state, playerId, (p) => ({
    ...p,
    zones: {
      ...p.zones,
      library: [...p.zones.library, ...rest],
      exile: [...p.zones.exile, { ...chosen, faceDown: true }],
      battlefield: p.zones.battlefield.map((c) => (c.instanceId === pending.sourceInstanceId ? { ...c, hideawayExiledCardId: chosen.instanceId } : c)),
    },
  }));
  next = { ...next, pendingHideaway: null };

  const player = getPlayer(next, playerId);
  const sourceFound = findCardAnywhere(next, pending.sourceInstanceId);
  const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'This land';
  return {
    ok: true,
    state: { ...next, log: [...next.log, `${player.name} exiles a card face down with ${sourceName}, putting the rest on the bottom of their library in a random order.`] },
  };
}

/** "Exile target card from a graveyard. If a creature card was exiled this
 * way, create a Food token." (Ignis Scientia). */
function resolveGraveyardExile(state: GameState, playerId: string, instanceId: string | null): ActionResult {
  const pending = state.pendingGraveyardExile;
  if (!pending) return { ok: false, error: 'Nothing is waiting on a graveyard exile right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your choice to make." };
  if (instanceId === null) return { ok: false, error: 'This ability requires a target.' };

  const found = findCardAnywhere(state, instanceId);
  if (!found || found.zone !== 'graveyard') return { ok: false, error: "That's not a legal target - it must be a card in a graveyard." };
  const def = getCardDefinition(found.card.defId);

  let next = updatePlayer(state, found.ownerPlayerId, (p) => ({
    ...p,
    zones: { ...p.zones, graveyard: p.zones.graveyard.filter((c) => c.instanceId !== instanceId) },
  }));
  let logLine = `${def.name} is exiled from the graveyard.`;
  if (pending.createFoodTokenIfCreature && def.type === 'creature') {
    const tokenDef = getCardDefinition('token-food');
    const token: CardInstance = {
      instanceId: nextInstanceId(),
      defId: tokenDef.id,
      ownerId: playerId,
      tapped: false,
      counters: [],
      damageMarked: 0,
      summoningSick: false,
      isToken: true,
    };
    next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, battlefield: [...p.zones.battlefield, token] } }));
    logLine += ` ${getPlayer(next, playerId).name} creates a ${tokenDef.name} token.`;
  }
  next = { ...next, pendingGraveyardExile: null, log: [...next.log, logLine] };
  return { ok: true, state: next };
}

/** "Discard up to [maxCount] cards, then draw that many cards" (Joshua,
 * Phoenix's Dominant) - `instanceId: null` stops discarding early and moves
 * straight to drawing however many were discarded so far. */
function resolveDiscardUpToThenDraw(state: GameState, playerId: string, instanceId: string | null): ActionResult {
  const pending = state.pendingDiscardUpToThenDraw;
  if (!pending) return { ok: false, error: 'Nothing is waiting on a discard right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your choice to make." };

  function finish(s: GameState, discardedCount: number): GameState {
    const player = getPlayer(s, playerId);
    const drawn = player.zones.library.slice(0, discardedCount);
    let n = updatePlayer(s, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(drawn.length), hand: [...p.zones.hand, ...drawn] } }));
    n = { ...n, pendingDiscardUpToThenDraw: null, log: [...n.log, `${player.name} draws ${drawn.length} card(s).`] };
    return n;
  }

  if (instanceId === null) {
    return { ok: true, state: finish(state, pending.discardedSoFar) };
  }

  const player = getPlayer(state, playerId);
  const card = player.zones.hand.find((c) => c.instanceId === instanceId);
  if (!card) return { ok: false, error: 'That card is not in your hand.' };
  const def = getCardDefinition(card.defId);

  let next = updatePlayer(state, playerId, (p) => ({
    ...p,
    zones: { ...p.zones, hand: p.zones.hand.filter((c) => c.instanceId !== instanceId), graveyard: [...p.zones.graveyard, card] },
  }));
  next = { ...next, log: [...next.log, `${player.name} discards ${def.name}.`] };

  const discardedSoFar = pending.discardedSoFar + 1;
  const stillEligible = discardedSoFar < pending.maxCount && getPlayer(next, playerId).zones.hand.length > 0;
  if (!stillEligible) {
    return { ok: true, state: finish(next, discardedSoFar) };
  }
  next = { ...next, pendingDiscardUpToThenDraw: { ...pending, discardedSoFar } };
  return { ok: true, state: next };
}

/** "Look at the top N cards, you may reveal a [filterType] card and put it
 * into your hand, put the rest on the bottom in a random order" (Ashe,
 * Princess of Dalmasca's RevealFilteredEffect) - `instanceId: null` declines
 * the pick (everything goes to the bottom). */
function resolveRevealFiltered(state: GameState, playerId: string, instanceId: string | null): ActionResult {
  const pending = state.pendingRevealFiltered;
  if (!pending) return { ok: false, error: 'Nothing is waiting on a reveal right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your reveal." };

  let taken: CardInstance | null = null;
  if (instanceId !== null) {
    taken = pending.revealed.find((c) => c.instanceId === instanceId) ?? null;
    if (!taken) return { ok: false, error: 'That card is not part of this reveal.' };
    const filterTypes = Array.isArray(pending.filterType) ? pending.filterType : [pending.filterType];
    if (!filterTypes.includes(getCardDefinition(taken.defId).type)) {
      return { ok: false, error: `You may only take a ${filterTypes.join(' or ')} card this way.` };
    }
  }

  const rest = pending.revealed.filter((c) => c.instanceId !== instanceId);
  const toGraveyard = pending.restDestination === 'graveyard';
  const toBattlefieldTapped = pending.takenDestination === 'battlefieldTapped';
  const takenCard: CardInstance | null = taken && toBattlefieldTapped ? { ...taken, tapped: true, summoningSick: getCardDefinition(taken.defId).type === 'creature' } : taken;
  let next = updatePlayer(state, playerId, (p) => ({
    ...p,
    zones: {
      ...p.zones,
      hand: taken && !toBattlefieldTapped ? [...p.zones.hand, taken] : p.zones.hand,
      battlefield: takenCard && toBattlefieldTapped ? [...p.zones.battlefield, takenCard] : p.zones.battlefield,
      library: toGraveyard ? p.zones.library : [...p.zones.library, ...shuffleArr(rest)],
      graveyard: toGraveyard ? [...p.zones.graveyard, ...rest] : p.zones.graveyard,
    },
  }));
  next = { ...next, pendingRevealFiltered: null };

  const player = getPlayer(next, playerId);
  const restNote = toGraveyard ? 'the rest go to the graveyard.' : 'the rest go to the bottom of the library in a random order.';
  const destinationNote = toBattlefieldTapped ? 'puts' : 'takes';
  const placeNote = toBattlefieldTapped ? 'onto the battlefield tapped' : '';
  let effectLogLines: string[] = [];
  if (takenCard && toBattlefieldTapped) {
    next = checkLegendRule(next, playerId);
    const takenDef = getCardDefinition(takenCard.defId);
    if (takenDef.onEnter && takenDef.onEnter.length > 0) {
      const resolved = resolveCardEffects(next, playerId, takenDef.onEnter, takenCard.instanceId);
      next = resolved.state;
      effectLogLines = resolved.logLines;
    }
    if (takenDef.type === 'land') {
      const landfallResult = triggerLandfall(next, playerId);
      next = landfallResult.state;
      effectLogLines = [...effectLogLines, ...landfallResult.logLines];
    }
  }
  const logLine = taken ? `${player.name} ${destinationNote} ${getCardDefinition(taken.defId).name}${placeNote ? ` ${placeNote}` : ''}; ${restNote}` : `${player.name} puts all revealed cards on the bottom of the library in a random order.`;
  return { ok: true, state: { ...next, log: [...next.log, logLine, ...effectLogLines] } };
}

/** "Crew N" (Vehicle mechanic) - tap any number of OTHER creatures the
 * controller controls, with total power >= the Vehicle's crew cost, to make
 * it an artifact creature until end of turn. See CardDefinition.crew,
 * CardInstance.crewedUntilEndOfTurn, and engine/combat.ts:
 * isEffectivelyCreature. Untimed, like every other activated ability here
 * with no onlyDuringOwn* guard - crewing creatures may have summoning
 * sickness (tapping to crew isn't attacking), and a Vehicle can't crew itself. */
function crewVehicle(state: GameState, playerId: string, instanceId: string, crewInstanceIds: string[]): ActionResult {
  const found = findCardAnywhere(state, instanceId);
  if (!found || found.zone !== 'battlefield') return { ok: false, error: 'Only a permanent on the battlefield can be crewed.' };
  if (found.ownerPlayerId !== playerId) return { ok: false, error: 'You can only crew your own Vehicle.' };
  const def = getCardDefinition(found.card.defId);
  if (def.crew === undefined) return { ok: false, error: `${def.name} isn't a Vehicle (no Crew cost).` };
  if (crewInstanceIds.length === 0) return { ok: false, error: 'Choose at least one creature to crew with.' };
  if (crewInstanceIds.includes(instanceId)) return { ok: false, error: 'A Vehicle cannot crew itself.' };

  const player = getPlayer(state, playerId);
  const crewers: CardInstance[] = [];
  for (const id of crewInstanceIds) {
    const c = player.zones.battlefield.find((c) => c.instanceId === id);
    if (!c) return { ok: false, error: 'One of the chosen crew is not on your battlefield.' };
    if (c.tapped) return { ok: false, error: 'A tapped creature cannot crew a Vehicle.' };
    const cDef = getCardDefinition(c.defId);
    if (!isEffectivelyCreature(cDef, c)) return { ok: false, error: `${cDef.name} isn't a creature and can't crew a Vehicle.` };
    crewers.push(c);
  }

  const totalPower = crewers.reduce((sum, c) => sum + effectivePower(getCardDefinition(c.defId), c, state, playerId), 0);
  if (totalPower < def.crew) return { ok: false, error: `${def.name} needs at least ${def.crew} total power to crew (chose ${totalPower}).` };

  const crewIdSet = new Set(crewInstanceIds);
  const next = updatePlayer(state, playerId, (p) => ({
    ...p,
    zones: {
      ...p.zones,
      battlefield: p.zones.battlefield.map((c) => {
        if (c.instanceId === instanceId) return { ...c, crewedUntilEndOfTurn: true };
        if (crewIdSet.has(c.instanceId)) return { ...c, tapped: true };
        return c;
      }),
    },
  }));

  return { ok: true, state: { ...next, log: [...next.log, `${player.name} crews ${def.name} with ${crewers.length} creature(s) (${totalPower} power).`] } };
}

/** "[Land]cycling"/"Cycling" - see types.ts: CyclingAbility. A hand-only cost, so it doesn't go through castCard. */
function cycleCard(state: GameState, playerId: string, instanceId: string): ActionResult {
  const player = getPlayer(state, playerId);
  const card = player.zones.hand.find((c) => c.instanceId === instanceId);
  if (!card) return { ok: false, error: 'That card is not in your hand.' };
  const def = getCardDefinition(card.defId);
  if (!def.cycling) return { ok: false, error: `${def.name} has no cycling ability.` };

  const mutual = isMutualActive(state);
  const parsed = parseCostLabel(def.cycling.cost);
  if (!mutual && !canPay(player.manaPool, parsed, 0)) {
    return { ok: false, error: `Not enough mana to cycle ${def.name} (${def.cycling.cost}).` };
  }

  let next = state;
  if (!mutual) next = updatePlayer(next, playerId, (p) => ({ ...p, manaPool: payCost(p.manaPool, parsed, 0) }));
  next = updatePlayer(next, playerId, (p) => ({
    ...p,
    zones: { ...p.zones, hand: p.zones.hand.filter((c) => c.instanceId !== instanceId), graveyard: [...p.zones.graveyard, { ...card, tapped: false }] },
  }));

  const searchName = def.cycling.searchLandName;
  if (!searchName) {
    const drawn = getPlayer(next, playerId).zones.library[0];
    if (!drawn) return { ok: true, state: { ...next, log: [...next.log, `${player.name} cycles ${def.name} - library is empty.`] } };
    next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(1), hand: [...p.zones.hand, drawn] } }));
    return { ok: true, state: { ...next, log: [...next.log, `${player.name} cycles ${def.name}, drawing a card.`] } };
  }

  const result = beginLibrarySearch(next, playerId, instanceId, { kind: 'landByName', name: searchName }, true);
  next = result.state;
  return { ok: true, state: { ...next, log: [...next.log, `${player.name} cycles ${def.name}.`, ...result.logLines] } };
}

/** "Whenever [this] deals combat damage to a player, ..." (Squall, SeeD
 * Mercenary's "return target permanent card...") as a generic AUTOMATIC
 * trigger - unlike onCombatDamageToPlayerMayTransform (a hardcoded yes/no
 * pending choice), this just resolves `onCombatDamageToPlayer` like any
 * other effect list. Lives in actions.ts (not combat.ts, where the damage
 * itself is dealt) to avoid a circular import with effects.ts's
 * resolveCardEffects; approximates "deals combat damage to a player" as
 * "is UNBLOCKED" (declared with zero blockers), which misses the rarer case
 * of trampling damage through blockers reaching the player as well. Must be
 * called BEFORE resolveCombatDamage, while declaredAttackers/
 * combatAssignments are still populated. */
function applyCombatDamageToPlayerTriggers(state: GameState): GameState {
  let next = state;
  for (const attackerId of state.declaredAttackers) {
    const assignment = state.combatAssignments.find((a) => a.attackerInstanceId === attackerId);
    if (!assignment || assignment.blockerInstanceIds.length > 0) continue;
    const found = findCardAnywhere(next, attackerId);
    if (!found || found.zone !== 'battlefield') continue;
    const def = getCardDefinition(found.card.defId);
    if (def.onCombatDamageToPlayer && def.onCombatDamageToPlayer.length > 0) {
      const resolved = resolveCardEffects(next, found.ownerPlayerId, def.onCombatDamageToPlayer, attackerId);
      next = { ...resolved.state, log: [...resolved.state.log, ...resolved.logLines] };
    }
    // "Whenever A CREATURE YOU CONTROL deals combat damage to a player, ..."
    // (Ultimecia, Temporal Threat) - a board-wide watcher, unlike
    // onCombatDamageToPlayer above (self only): every permanent the
    // attacker's controller controls with this field fires, regardless of
    // which one actually attacked.
    for (const watcher of getPlayer(next, found.ownerPlayerId).zones.battlefield) {
      const watcherDef = getCardDefinition(watcher.defId);
      if (!watcherDef.onAnyControlledCreatureCombatDamageToPlayer || watcherDef.onAnyControlledCreatureCombatDamageToPlayer.length === 0) continue;
      const resolved = resolveCardEffects(next, found.ownerPlayerId, watcherDef.onAnyControlledCreatureCombatDamageToPlayer, watcher.instanceId);
      next = { ...resolved.state, log: [...resolved.state.log, ...resolved.logLines] };
    }
    // "Whenever equipped creature deals combat damage to a player, draw a
    // card, then you may cast a spell from your hand with mana value less
    // than or equal to that damage without paying its mana cost." (Buster
    // Sword) - a granted trigger from any Equipment attached to this
    // attacker. The damage amount is computed the same way
    // resolveCombatDamage is about to deal it (effectivePower *
    // damageMultiplierFor) since this runs before that actually happens.
    const equipment = getPlayer(next, found.ownerPlayerId).zones.battlefield.filter((c) => c.attachedToInstanceId === attackerId);
    for (const eq of equipment) {
      const eqDef = getCardDefinition(eq.defId);
      if (!eqDef.equipGrantsOnCombatDamageToPlayer || eqDef.equipGrantsOnCombatDamageToPlayer.length === 0) continue;
      const resolved = resolveCardEffects(next, found.ownerPlayerId, eqDef.equipGrantsOnCombatDamageToPlayer, attackerId);
      next = { ...resolved.state, log: [...resolved.state.log, ...resolved.logLines] };
    }
    if (equipment.some((eq) => getCardDefinition(eq.defId).equipGrantsDrawThenMayCastFreeUpToCombatDamage)) {
      const damage = effectivePower(def, found.card, next, found.ownerPlayerId) * damageMultiplierFor(next, found.ownerPlayerId, def);
      const drawn = getPlayer(next, found.ownerPlayerId).zones.library.slice(0, 1);
      next = updatePlayer(next, found.ownerPlayerId, (p) => ({
        ...p,
        zones: { ...p.zones, library: p.zones.library.slice(1), hand: [...p.zones.hand, ...drawn] },
      }));
      const drawNote = drawn.length > 0 ? `${getPlayer(next, found.ownerPlayerId).name} draws a card.` : `${getPlayer(next, found.ownerPlayerId).name}'s library is empty.`;
      next = { ...next, pendingFreeCastFromHand: { sourceInstanceId: attackerId, controllerId: found.ownerPlayerId, maxManaValue: damage }, log: [...next.log, drawNote] };
    }
  }
  return next;
}

/** "Whenever [this] deals combat damage to a player, that player gains
 * control of it. If they do, you draw that many cards, create that many
 * tapped Treasure tokens, then lose that much life." (Kain, Traitorous
 * Dragoon) - unlike every other onCombatDamageToPlayer-family trigger
 * (which fires from applyCombatDamageToPlayerTriggers, BEFORE the damage
 * itself resolves), a control change has to happen AFTER
 * resolveCombatDamage actually deals the damage: dealDamagePass looks up an
 * attacker by CURRENT control (findInstance searches every player's
 * battlefield, and treats whichever one it's found on as "the attacker's
 * controller"), so swapping control first would make the creature attack
 * its own new controller instead. Approximates "deals combat damage to a
 * player" as "is UNBLOCKED", same caveat as every sibling trigger. "You" in
 * the card's own text is the ORIGINAL controller (the one who just lost
 * Kain), not whoever just gained it - real MTG has exactly this kind of
 * "you still benefit even though you're handing over the creature" text. */
/** "Whenever an opponent gains control of a permanent from you, [effect]"
 * (Zidane, Tantalus Thief) - called right after ANY control-change
 * mechanism moves a permanent away from `formerControllerId` to an
 * opponent, for every OTHER permanent formerControllerId still controls
 * carrying this field. See types.ts: CardDefinition.onOpponentGainsControlFromYouTrigger. */
function triggerControlLostToOpponentWatchers(state: GameState, formerControllerId: string): GameState {
  let next = state;
  for (const card of getPlayer(next, formerControllerId).zones.battlefield) {
    const def = getCardDefinition(card.defId);
    if (!def.onOpponentGainsControlFromYouTrigger || def.onOpponentGainsControlFromYouTrigger.length === 0) continue;
    const resolved = resolveCardEffects(next, formerControllerId, def.onOpponentGainsControlFromYouTrigger, card.instanceId);
    next = { ...resolved.state, log: [...resolved.state.log, ...resolved.logLines] };
  }
  return next;
}

function applyPostCombatDamageControlChanges(state: GameState): GameState {
  let next = state;
  for (const attackerId of state.declaredAttackers) {
    const assignment = state.combatAssignments.find((a) => a.attackerInstanceId === attackerId);
    if (!assignment || assignment.blockerInstanceIds.length > 0) continue;
    const found = findCardAnywhere(next, attackerId);
    if (!found || found.zone !== 'battlefield') continue;
    const def = getCardDefinition(found.card.defId);
    if (!def.combatDamageToPlayerGrantsControlToThem) continue;

    const damage = effectivePower(def, found.card, next, found.ownerPlayerId) * damageMultiplierFor(next, found.ownerPlayerId, def);
    if (damage <= 0) continue;

    const oldControllerId = found.ownerPlayerId;
    const newControllerId = getOpponent(next, oldControllerId).id;
    const movingCard = getPlayer(next, oldControllerId).zones.battlefield.find((c) => c.instanceId === attackerId);
    if (!movingCard) continue;

    next = updatePlayer(next, oldControllerId, (p) => ({ ...p, zones: { ...p.zones, battlefield: p.zones.battlefield.filter((c) => c.instanceId !== attackerId) } }));
    next = updatePlayer(next, newControllerId, (p) => ({ ...p, zones: { ...p.zones, battlefield: [...p.zones.battlefield, movingCard] } }));
    next = triggerControlLostToOpponentWatchers(next, oldControllerId);

    const drawn = getPlayer(next, oldControllerId).zones.library.slice(0, damage);
    next = updatePlayer(next, oldControllerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(damage), hand: [...p.zones.hand, ...drawn] } }));

    const treasureDef = getCardDefinition('token-treasure');
    const treasures: CardInstance[] = Array.from({ length: damage }, () => ({
      instanceId: nextInstanceId(),
      defId: treasureDef.id,
      ownerId: oldControllerId,
      tapped: true,
      counters: [],
      damageMarked: 0,
      summoningSick: true,
      isToken: true,
      sacrificesOnTap: !!treasureDef.sacrificesOnTap,
    }));
    next = updatePlayer(next, oldControllerId, (p) => ({ ...p, zones: { ...p.zones, battlefield: [...p.zones.battlefield, ...treasures] } }));
    next = loseLife(next, oldControllerId, damage);

    const oldController = getPlayer(next, oldControllerId);
    const newController = getPlayer(next, newControllerId);
    next = {
      ...next,
      log: [
        ...next.log,
        `${newController.name} gains control of ${def.name}. ${oldController.name} draws ${damage} card(s), creates ${damage} Treasure token(s), and loses ${damage} life.`,
      ],
    };
  }
  return next;
}

/** Leaving End Combat: now that both players have seen the outcome,
 * actually move anything that died to the graveyard, and clear the combat
 * bookkeeping so surviving attackers/blockers reappear in their normal
 * battlefield row for the rest of the turn. Shared by nextPhase (sequential
 * Next Phase) and endTurn (an early End Turn clicked while still sitting on
 * combat_end) - both paths owe this exactly once. */
function resolveCombatEndEffects(state: GameState): GameState {
  const diedCandidates = state.pendingDeaths;
  const next = resolvePendingDeaths(state);
  const deathTriggers = resolveOnDeathTriggers(next, diedCandidates);
  return { ...deathTriggers.state, declaredAttackers: [], combatAssignments: [], log: [...deathTriggers.state.log, ...deathTriggers.logLines] };
}

/** "As your precombat main phase begins, put a lore counter on each Saga
 * you control" / "At the beginning of your first main phase, ..." - fires
 * exactly once, right as the active player's main1 begins. Shared by
 * nextPhase and endTurn (an early End Turn clicked before ever reaching
 * main1 still owes this). */
function applyMainPhaseTriggers(state: GameState): GameState {
  let next = state;
  const active = getPlayer(next, next.activePlayerId);
  for (const c of active.zones.battlefield) {
    if (!getCardDefinition(c.defId).saga) continue;
    const sagaResult = triggerSagaLoreCounter(next, next.activePlayerId, c.instanceId);
    next = { ...sagaResult.state, log: [...sagaResult.state.log, ...sagaResult.logLines] };
  }
  for (const c of active.zones.battlefield) {
    const cDef = getCardDefinition(c.defId);
    if (!cDef.onOwnFirstMainPhase || cDef.onOwnFirstMainPhase.length === 0) continue;
    const resolved = resolveCardEffects(next, next.activePlayerId, cDef.onOwnFirstMainPhase, c.instanceId);
    next = { ...resolved.state, log: [...resolved.state.log, ...resolved.logLines] };
  }
  return next;
}

/** "At the beginning of your end step, if this creature didn't enter the
 * battlefield this turn, return it to its owner's hand" (Cactuar), plus the
 * generic onOwnEndStep automatic trigger (e.g. Exdeath, Void Warlock) -
 * fires exactly once, right as the active player's own end step begins.
 * Shared by nextPhase and endTurn (an early End Turn still owes this - see
 * resolveCombatEndEffects above for why). */
function applyEndStepTriggers(state: GameState): GameState {
  let next = { ...state, endStepNumberThisTurn: state.endStepNumberThisTurn + 1 };
  const active = getPlayer(next, next.activePlayerId);
  for (const c of active.zones.battlefield) {
    const cDef = getCardDefinition(c.defId);
    if (!cDef.bounceSelfAtEndStepIfNotSummoningSick || c.summoningSick) continue;
    next = detachEverythingFrom(next, c.instanceId);
    const bouncedCard = { ...c, tapped: false, attachedToInstanceId: undefined, damageMarked: 0 };
    next = updatePlayer(next, next.activePlayerId, (p) => ({ ...p, zones: { ...p.zones, battlefield: p.zones.battlefield.filter((x) => x.instanceId !== c.instanceId) } }));
    if (isPlayersCommander(next, next.activePlayerId, c)) {
      next = beginCommanderZoneChoice(next, next.activePlayerId, 'hand', bouncedCard);
      next = { ...next, log: [...next.log, `${cDef.name} would return to ${active.name}'s hand - ${active.name} chooses whether it goes there or to the command zone instead.`] };
      continue;
    }
    next = updatePlayer(next, next.activePlayerId, (p) => ({ ...p, zones: { ...p.zones, hand: [...p.zones.hand, bouncedCard] } }));
    next = { ...next, log: [...next.log, `${cDef.name} returns to ${active.name}'s hand.`] };
  }
  for (const c of active.zones.battlefield) {
    const cDef = getCardDefinition(c.defId);
    if (!cDef.onOwnEndStep || cDef.onOwnEndStep.length === 0) continue;
    const resolved = resolveCardEffects(next, next.activePlayerId, cDef.onOwnEndStep, c.instanceId);
    next = { ...resolved.state, log: [...resolved.state.log, ...resolved.logLines] };
  }
  // "At the beginning of the next end step, ..." (Random Encounter) - a
  // one-shot queue consumed by literally the VERY NEXT end step to occur,
  // whoever's turn it is (no "your own" restriction, unlike onOwnEndStep
  // above). See types.ts: QueueEffectsAtNextEndStepEffect.
  if (next.pendingDelayedEndStepEffects.length > 0) {
    for (const entry of next.pendingDelayedEndStepEffects) {
      const resolved = resolveCardEffects(next, entry.controllerId, entry.effects, entry.sourceInstanceId);
      next = { ...resolved.state, log: [...resolved.state.log, ...resolved.logLines] };
    }
    next = { ...next, pendingDelayedEndStepEffects: [] };
  }
  return next;
}

/** End-of-turn cleanup: clears combat damage, deathtouch marks, temporary
 * buffs/keywords, and other until-end-of-turn state. Fires exactly once,
 * right as cleanup begins. Shared by nextPhase and endTurn. */
function applyCleanupResets(state: GameState): GameState {
  let next = state;

  // "You may play the exiled card THIS TURN" (Reno and Rude's
  // expiresAtCleanup grant) - Lightning, Security Sergeant's persistent
  // grant has no expiresAtCleanup and is left alone here.
  if (next.exilePlayGrants.some((g) => g.expiresAtCleanup)) {
    next = { ...next, exilePlayGrants: next.exilePlayGrants.filter((g) => !g.expiresAtCleanup) };
  }

  // "Gain control of [it] until end of turn" (Unexpected Request, Zidane,
  // Stolen Uniform) reverts here. ownerId never changes, so a card whose
  // temporaryControlUntilEndOfTurn flag is set and is sitting in a
  // battlefield array that ISN'T its owner's is exactly the set that needs
  // to move back - no separate "who controlled it before" tracking needed.
  // Kain, Traitorous Dragoon's permanent control change never sets this
  // flag, so it's untouched here.
  for (const player of next.players) {
    const toRevert = player.zones.battlefield.filter((c) => c.temporaryControlUntilEndOfTurn && c.ownerId !== player.id);
    if (toRevert.length === 0) continue;
    next = updatePlayer(next, player.id, (p) => ({
      ...p,
      zones: { ...p.zones, battlefield: p.zones.battlefield.filter((c) => !toRevert.some((r) => r.instanceId === c.instanceId)) },
    }));
    for (const d of toRevert) {
      const ownerName = getPlayer(next, d.ownerId).name;
      next = updatePlayer(next, d.ownerId, (p) => ({
        ...p,
        zones: { ...p.zones, battlefield: [...p.zones.battlefield, { ...d, temporaryControlUntilEndOfTurn: undefined }] },
      }));
      next = { ...next, log: [...next.log, `${getCardDefinition(d.defId).name} returns to ${ownerName}'s control.`] };
    }
  }

  for (const player of next.players) {
    next = updatePlayer(next, player.id, (p) => ({
      ...p,
      lifeGainedThisTurn: 0,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.map((c) => ({
          ...c,
          damageMarked: 0,
          tookDeathtouchDamage: false,
          temporaryBuff: undefined,
          temporaryBaseStats: undefined,
          temporaryOnDeathReturnTapped: undefined,
          temporaryOnDeathPutCountersEqualToPower: undefined,
          crewedUntilEndOfTurn: undefined,
          temporarilyCreatureUntilEndOfTurn: undefined,
          temporaryGrantedSubtype: undefined,
          temporaryKeywords: undefined,
          onAnyDeathDrawUsedThisTurn: undefined,
        })),
      },
    }));
  }
  next = { ...next, creaturesDiedThisTurn: 0, pendingNextCreatureSpellBonus: null };
  const active = getPlayer(next, next.activePlayerId);
  if (active.zones.hand.length > 7) {
    next = { ...next, log: [...next.log, `${active.name} has more than 7 cards - discard down to 7 before ending the turn.`] };
  }
  return next;
}

function nextPhase(state: GameState, playerId: string): ActionResult {
  // combat_damage is the one step BOTH players can call this on - each
  // marks themselves ready to resolve, and damage only actually happens
  // once both have. Every other phase still requires the active player.
  if (state.phase !== 'combat_damage' && state.activePlayerId !== playerId) {
    return { ok: false, error: 'Only the active player advances the phase.' };
  }
  if (state.phase === 'declare_attackers') return { ok: false, error: 'Declare your attackers (even zero) to move past this step.' };
  if (state.phase === 'declare_blockers') return { ok: false, error: "Waiting on the defending player's blocks." };
  if (state.phase === 'draw' && !isMutualActive(state) && !getPlayer(state, playerId).hasDrawnThisTurn) {
    return { ok: false, error: 'Draw your card before moving on.' };
  }

  if (state.phase === 'combat_damage') {
    if (isMutualActive(state)) {
      let next = resolveCombatDamage(applyCombatDamageToPlayerTriggers(state));
      next = applyPostCombatDamageControlChanges(next);
      next = { ...next, phase: 'combat_end', combatReadyPlayers: [] };
      next = clearManaAndRefundUnspentLands(next);
      return { ok: true, state: next };
    }

    if (state.combatReadyPlayers.includes(playerId)) {
      return { ok: false, error: 'Already marked ready - waiting on the other player.' };
    }

    const readyNow = [...state.combatReadyPlayers, playerId];
    const actor = getPlayer(state, playerId);

    if (readyNow.length >= 2) {
      let next = resolveCombatDamage(applyCombatDamageToPlayerTriggers({ ...state, combatReadyPlayers: [] }));
      next = applyPostCombatDamageControlChanges(next);
      next = { ...next, phase: 'combat_end' };
      next = clearManaAndRefundUnspentLands(next);
      return { ok: true, state: next };
    }

    return { ok: true, state: { ...state, combatReadyPlayers: readyNow, log: [...state.log, `${actor.name} is ready to resolve combat.`] } };
  }

  const currentIndex = PHASE_ORDER.indexOf(state.phase as Phase);
  if (currentIndex === -1 || currentIndex === PHASE_ORDER.length - 1) {
    return { ok: false, error: 'Use End Turn to move on from the cleanup step.' };
  }

  let nextPhaseName = PHASE_ORDER[currentIndex + 1];
  // "After this phase, there is an additional combat phase" (Genji Glove) -
  // QueueExtraCombatPhaseIfFirstCombatPhaseOfTurnEffect queues one; leaving
  // End Combat with one or more still queued loops back into another combat
  // phase (consuming one from the queue) instead of proceeding into Main 2.
  // An extra combat phase doesn't get its own untap/upkeep/draw - only
  // combat itself repeats - so this jumps straight to declare_attackers,
  // same as the ordinary combat_begin skip just below.
  const hasExtraCombatQueued = state.phase === 'combat_end' && state.extraCombatPhasesQueued > 0;
  if (hasExtraCombatQueued) nextPhaseName = 'declare_attackers';
  const enteringCombatBegin = nextPhaseName === 'combat_begin' || hasExtraCombatQueued;
  // Nothing happens during the momentary "begin combat" step yet - skip
  // straight into declaring attackers so the attack zone appears the
  // instant combat starts, per the "no separate attackers phase" design.
  if (nextPhaseName === 'combat_begin') nextPhaseName = 'declare_attackers';

  // "There is an additional end step after this step" (Y'shtola Rhul) -
  // QueueExtraEndStepIfFirstEndStepOfTurnEffect queues one; leaving 'end'
  // with one or more still queued loops back into another 'end' phase
  // (consuming one from the queue) instead of proceeding to cleanup.
  const hasExtraEndQueued = state.phase === 'end' && state.extraEndStepsQueued > 0;
  if (hasExtraEndQueued) nextPhaseName = 'end';

  // Nothing to declare if every creature is tapped, summoning sick, or has
  // defender (or there are no creatures at all) - the attackers/blockers
  // steps (and the ready-up handshake in combat_damage) couldn't do
  // anything anyway, so skip straight to End Combat. Combat still shows as
  // having happened - Full Board still comes up for it (showCombatZones
  // includes combat_end) and the very next Next Phase press goes through
  // the normal End Combat -> Main 2 handling below - it just never stops on
  // a step with nothing to actually declare.
  if (nextPhaseName === 'declare_attackers' && !hasLegalAttacker(state, state.activePlayerId)) {
    nextPhaseName = 'combat_end';
  }

  let next: GameState = clearManaAndRefundUnspentLands({
    ...state,
    phase: nextPhaseName,
    extraCombatPhasesQueued: hasExtraCombatQueued ? state.extraCombatPhasesQueued - 1 : state.extraCombatPhasesQueued,
    extraEndStepsQueued: hasExtraEndQueued ? state.extraEndStepsQueued - 1 : state.extraEndStepsQueued,
  });

  // Leaving End Combat: now that both players have seen the outcome,
  // actually move anything that died to the graveyard, and clear the
  // combat bookkeeping so surviving attackers/blockers reappear in their
  // normal battlefield row for the rest of the turn (previously this only
  // cleared at END_TURN, so survivors stayed invisible all the way through
  // main phase 2).
  if (state.phase === 'combat_end') {
    next = resolveCombatEndEffects(next);
  }

  // "At the beginning of your upkeep, ..." as an AUTOMATIC trigger (e.g.
  // Dark Confidant) - fires exactly once, right as the active player's
  // upkeep begins.
  if (next.phase === 'upkeep') {
    const active = getPlayer(next, next.activePlayerId);
    for (const c of active.zones.battlefield) {
      const cDef = getCardDefinition(c.defId);
      if (!cDef.onOwnUpkeep || cDef.onOwnUpkeep.length === 0) continue;
      const resolved = resolveCardEffects(next, next.activePlayerId, cDef.onOwnUpkeep, c.instanceId);
      next = { ...resolved.state, log: [...resolved.state.log, ...resolved.logLines] };
    }
  }

  // "At the beginning of combat on your turn, ..." (Jenova, Ancient
  // Calamity) - same shape as the onOwnUpkeep hook above, but the
  // 'combat_begin' phase itself is skipped over instantly (see
  // enteringCombatBegin above), so this fires right as declare_attackers is
  // entered instead of checking next.phase directly.
  if (enteringCombatBegin) {
    // See GameState.combatPhaseNumberThisTurn - counts this as the 1st,
    // 2nd, ... combat phase of the turn, before anything below checks it
    // (an extra combat phase's own onOwnCombatBegin triggers, if any, should
    // already see the updated count).
    next = { ...next, combatPhaseNumberThisTurn: next.combatPhaseNumberThisTurn + 1 };
    const active = getPlayer(next, next.activePlayerId);
    for (const c of active.zones.battlefield) {
      const cDef = getCardDefinition(c.defId);
      if (!cDef.onOwnCombatBegin || cDef.onOwnCombatBegin.length === 0) continue;
      const resolved = resolveCardEffects(next, next.activePlayerId, cDef.onOwnCombatBegin, c.instanceId);
      next = { ...resolved.state, log: [...resolved.state.log, ...resolved.logLines] };
    }
  }

  // "As your precombat main phase begins, put a lore counter on each Saga
  // you control" - fires exactly once, right as the active player's main1
  // begins (right after their draw step in the normal phase order). See
  // types.ts: SagaAbility, engine/effects.ts: triggerSagaLoreCounter.
  if (next.phase === 'main1') {
    next = applyMainPhaseTriggers(next);
  }

  // summoningSick is still true for the rest of the turn something entered
  // (cleared only at the controller's own next untap step), so !summoningSick
  // in applyEndStepTriggers means it's been out since before this turn.
  if (next.phase === 'end') {
    next = applyEndStepTriggers(next);
  }

  if (next.phase === 'cleanup') {
    next = applyCleanupResets(next);
  }

  return { ok: true, state: next };
}

function runUntapStep(state: GameState, playerId: string): GameState {
  // "Enchanted/equipped permanent doesn't untap during its controller's
  // untap step" (Sleep Magic, Stuck in Summoner's Sanctum) - the attached
  // permanent can sit on EITHER player's battlefield (an Aura may enchant an
  // opponent's creature), unlike every other attach lookup in this engine
  // (equipBuffBonus etc.), which only ever searches the SAME controller's
  // own battlefield since Equipment always attaches to a creature you
  // control. So this checks both players' battlefields, not just `playerId`'s.
  const preventsUntap = (instanceId: string) =>
    state.players.some((p) => p.zones.battlefield.some((c) => c.attachedToInstanceId === instanceId && getCardDefinition(c.defId).attachedPreventsUntap));
  return updatePlayer(state, playerId, (p) => ({
    ...p,
    hasPlayedLandThisTurn: false,
    landsPlayedThisTurn: 0,
    hasDrawnThisTurn: false,
    usedFirstLegendaryCreatureSpellDiscountThisTurn: false,
    zones: {
      ...p.zones,
      battlefield: p.zones.battlefield.map((c) => {
        const stun = c.counters.find((ctr) => ctr.label.toLowerCase() === 'stun');
        if (stun && stun.amount > 0) {
          return { ...c, counters: c.counters.map((ctr) => (ctr.label.toLowerCase() === 'stun' ? { ...ctr, amount: ctr.amount - 1 } : ctr)).filter((ctr) => ctr.amount > 0) };
        }
        if (preventsUntap(c.instanceId)) return { ...c, summoningSick: false, producedManaColor: undefined, temporaryKeywordsUntilNextTurn: undefined };
        return { ...c, tapped: false, summoningSick: false, producedManaColor: undefined, temporaryKeywordsUntilNextTurn: undefined };
      }),
    },
  }));
}

/**
 * Tapping a land only "costs" you anything once its mana is actually spent -
 * so a land tapped for mana that never got used untaps for free right when
 * that mana disappears (see clearManaAndRefundUnspentLands) instead of
 * sitting tapped for nothing. Mirrors toggleTap's own spent/unspent check:
 * walk the color's still-full pool down by each land's own produced amount
 * (1, or 2 for Ring of the Lucii - see types.ts: producesManaAmount) per
 * untapped land, so with several lands of the same color only as many of
 * them untap as actually went unspent.
 */
function untapUnspentManaLands(state: GameState, playerId: string): GameState {
  const remaining: Record<ManaColor, number> = { ...getPlayer(state, playerId).manaPool };
  return updatePlayer(state, playerId, (p) => ({
    ...p,
    zones: {
      ...p.zones,
      battlefield: p.zones.battlefield.map((c) => {
        if (!c.tapped || !c.producedManaColor) return c;
        // Ring of the Lucii's "T: Add MM" produces (and so must refund) 2
        // colorless from one tap - everything else defaults to 1 (doubled
        // again by doublesColorlessManaFromLands, e.g. Ultima).
        const producedAmount = effectiveProducedManaAmount(state, playerId, getCardDefinition(c.defId), c.producedManaColor);
        if (remaining[c.producedManaColor] < producedAmount) return c;
        remaining[c.producedManaColor] -= producedAmount;
        return { ...c, tapped: false, producedManaColor: undefined };
      }),
    },
  }));
}

/**
 * Mana empties at every phase change, not just once per turn - whatever
 * either player left unspent is gone the moment the phase moves on (an
 * instant-speed response can tap into the non-active player's pool too, so
 * this always runs for both players, not just whoever is advancing the
 * phase). untapUnspentManaLands runs first so it still reads each player's
 * about-to-be-cleared pool to know which taps were never actually spent.
 */
function clearManaAndRefundUnspentLands(state: GameState): GameState {
  let next = state;
  for (const player of state.players) {
    next = untapUnspentManaLands(next, player.id);
  }
  return { ...next, players: next.players.map((p) => ({ ...p, manaPool: emptyManaPool() })) as GameState['players'] };
}

function endTurn(state: GameState, playerId: string): ActionResult {
  if (state.activePlayerId !== playerId) return { ok: false, error: "It's not your turn." };

  const mutual = isMutualActive(state);
  const pregame = state.phase === 'pregame';
  if (!mutual && !pregame && !getPlayer(state, playerId).hasDrawnThisTurn) {
    return { ok: false, error: 'Draw your card before ending your turn.' };
  }
  if (state.declaredAttackers.length > 0 && (state.phase === 'declare_blockers' || state.phase === 'combat_damage')) {
    return { ok: false, error: 'Combat has been declared - it must resolve before you can end your turn.' };
  }

  // Ending the turn early (before naturally clicking Next Phase through
  // every remaining step) still owes the active player every phase-gated
  // automatic effect between here and cleanup, exactly once - same as if
  // they'd clicked through normally instead of using End Turn as a
  // shortcut. Compare against PHASE_ORDER position rather than checking
  // state.phase directly so this can't double-fire something that already
  // ran naturally (e.g. clicking End Turn from 'end' or 'cleanup' - those
  // effects already happened when nextPhase advanced into that phase).
  let preHandoff: GameState = state;
  if (!pregame) {
    const currentIndex = PHASE_ORDER.indexOf(state.phase as Phase);
    if (state.phase === 'combat_end') preHandoff = resolveCombatEndEffects(preHandoff);
    if (currentIndex < PHASE_ORDER.indexOf('main1')) preHandoff = applyMainPhaseTriggers(preHandoff);
    if (currentIndex < PHASE_ORDER.indexOf('end')) preHandoff = applyEndStepTriggers(preHandoff);
    if (currentIndex < PHASE_ORDER.indexOf('cleanup')) preHandoff = applyCleanupResets(preHandoff);
  }

  // An extra turn (e.g. Ultimecia, Omnipotent's Time Compression) jumps the
  // queue ahead of the normal opponent's-turn handoff - possibly giving the
  // SAME player another turn, if that's who the queue names.
  const queuedPlayerId = preHandoff.extraTurnsQueued[0];
  const newActivePlayer = queuedPlayerId ? getPlayer(preHandoff, queuedPlayerId) : getOpponent(preHandoff, playerId);

  // Turn end is a phase change too, so the same unspent-mana clear applies
  // here first - runUntapStep then fully untaps the new active player
  // regardless, making its own refund redundant for them but harmless.
  let next = clearManaAndRefundUnspentLands(preHandoff);
  next = runUntapStep(next, newActivePlayer.id);
  next = {
    ...next,
    activePlayerId: newActivePlayer.id,
    phase: 'untap',
    turnNumber: next.turnNumber + 1,
    declaredAttackers: [],
    combatAssignments: [],
    extraCombatPhasesQueued: 0,
    combatPhaseNumberThisTurn: 0,
    extraEndStepsQueued: 0,
    endStepNumberThisTurn: 0,
    extraTurnsQueued: queuedPlayerId ? next.extraTurnsQueued.slice(1) : next.extraTurnsQueued,
    log: [...next.log, `Turn ${next.turnNumber + 1}: ${newActivePlayer.name}'s turn${queuedPlayerId ? ' (extra turn)' : ''}.`],
  };

  return { ok: true, state: next };
}

function readyToStart(state: GameState, playerId: string): ActionResult {
  if (state.phase !== 'pregame') return { ok: false, error: 'The game has already started.' };
  const player = getPlayer(state, playerId);
  let next = updatePlayer(state, playerId, (p) => ({ ...p, ready: true }));
  next = { ...next, log: [...next.log, `${player.name} is ready.`] };
  if (next.players.every((p) => p.ready)) {
    next = { ...next, phase: 'untap', turnNumber: 1, log: [...next.log, `Both players are ready. ${getPlayer(next, next.activePlayerId).name} goes first.`] };
  }
  return { ok: true, state: next };
}

function requestMutualAdjustment(state: GameState, playerId: string): ActionResult {
  if (state.mutualAdjustment.status !== 'inactive') return { ok: false, error: 'A Mutual Adjustment request is already in progress.' };
  const requester = getPlayer(state, playerId);
  return {
    ok: true,
    state: { ...state, mutualAdjustment: { status: 'requested', requestedBy: playerId, agreedBy: [playerId] }, log: [...state.log, `${requester.name} requests Mutual Adjustment - waiting for the other player to agree.`] },
  };
}

function respondMutualAdjustment(state: GameState, playerId: string, accept: boolean): ActionResult {
  if (state.mutualAdjustment.status !== 'requested') return { ok: false, error: 'No Mutual Adjustment request is pending.' };
  const responder = getPlayer(state, playerId);
  if (!accept) {
    return { ok: true, state: { ...state, mutualAdjustment: { status: 'inactive', agreedBy: [] }, log: [...state.log, `${responder.name} declined Mutual Adjustment.`] } };
  }
  const agreedBy = Array.from(new Set([...state.mutualAdjustment.agreedBy, playerId]));
  const bothAgreed = agreedBy.length >= 2;
  return {
    ok: true,
    state: {
      ...state,
      mutualAdjustment: { status: bothAgreed ? 'active' : 'requested', requestedBy: state.mutualAdjustment.requestedBy, agreedBy },
      log: [...state.log, bothAgreed ? 'Both players agreed - Mutual Adjustment is now active. Normal rules are suspended until both players agree to exit.' : `${responder.name} agreed to Mutual Adjustment.`],
    },
  };
}

function requestExitMutualAdjustment(state: GameState, playerId: string): ActionResult {
  if (state.mutualAdjustment.status !== 'active') return { ok: false, error: 'Mutual Adjustment is not currently active.' };
  const requester = getPlayer(state, playerId);
  return {
    ok: true,
    state: { ...state, mutualAdjustment: { status: 'exit_requested', requestedBy: playerId, agreedBy: [playerId] }, log: [...state.log, `${requester.name} wants to end Mutual Adjustment - waiting for the other player to agree.`] },
  };
}

function respondExitMutualAdjustment(state: GameState, playerId: string, accept: boolean): ActionResult {
  if (state.mutualAdjustment.status !== 'exit_requested') return { ok: false, error: 'No exit request is pending.' };
  const responder = getPlayer(state, playerId);
  if (!accept) {
    return { ok: true, state: { ...state, mutualAdjustment: { status: 'active', agreedBy: [] }, log: [...state.log, `${responder.name} declined to end Mutual Adjustment - it remains active.`] } };
  }
  const agreedBy = Array.from(new Set([...state.mutualAdjustment.agreedBy, playerId]));
  const bothAgreed = agreedBy.length >= 2;
  return {
    ok: true,
    state: {
      ...state,
      mutualAdjustment: { status: bothAgreed ? 'inactive' : 'exit_requested', requestedBy: state.mutualAdjustment.requestedBy, agreedBy: bothAgreed ? [] : agreedBy },
      log: [...state.log, bothAgreed ? 'Both players agreed - Mutual Adjustment has ended. Normal rules resume.' : `${responder.name} agreed to end Mutual Adjustment.`],
    },
  };
}

function concede(state: GameState, playerId: string): ActionResult {
  const opponent = getOpponent(state, playerId);
  const conceder = getPlayer(state, playerId);

  // "When the chosen player loses the game, you win the game." (Shinryu,
  // Transcendent Rival's Burning Chains) - find any permanent whose
  // chosenOpponentId is the CONCEDING (losing) player and whose definition
  // grants this; that permanent's controller is the winner. In this
  // 2-player-only engine that's always the same player `opponent` already
  // names (there's only one other player it could possibly be) - this
  // doesn't change the actual winner yet, it just makes the real mechanism
  // the card describes exist and be checkable, ready for whenever the
  // engine supports more than 2 players.
  let winnerId = opponent.id;
  for (const player of state.players) {
    for (const c of player.zones.battlefield) {
      const def = getCardDefinition(c.defId);
      if (def.winsGameIfChosenOpponentLoses && c.chosenOpponentId === playerId) {
        winnerId = player.id;
      }
    }
  }

  const winner = getPlayer(state, winnerId);
  return { ok: true, state: { ...state, winnerId, log: [...state.log, `${conceder.name} concedes. ${winner.name} wins!`] } };
}