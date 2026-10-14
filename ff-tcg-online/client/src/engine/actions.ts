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
  hasEquipGrantedKeyword,
  hasSelfGrantedKeywordDuringOwnTurn,
  loseLife,
  damageMultiplierFor,
  effectiveWardCost,
  hasBoardGrantedKeyword,
  beginCommanderZoneChoice,
  checkIndestructibleOrShielded,
  applyDrawTriggers,
  isModifiedCreature,
} from './combat';
import {
  resolveCardEffects,
  triggerLandfall,
  triggerOpponentLandEnterWatchers,
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
  resolveKeepOneSacrificeRestQueue,
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
  triggerOpponentCastSpellWatchers,
  triggerAnyPlayerCastSpellWatchers,
  applyCounterPlacementSideEffects,
  checkLegendRule,
  hardenedScalesAdjustedAmount,
  sharesCreatureType,
  releaseExiledUntilMonarchChanges,
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
      return castCard(
        state,
        playerId,
        action.instanceId,
        action.chosenX,
        action.chosenModeIndices,
        action.chosenTierIndex,
        undefined,
        action.kickerPaymentInstanceId,
        action.escalateCostInstanceIds,
        action.chosenMultikickerCount,
        action.convokeInstanceIds,
        action.payAlternateLifeCost,
        action.delveInstanceIds
      );
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
    case 'RESOLVE_ADD_MANA_OF_CHOSEN_COLOR':
      return resolveAddManaOfChosenColor(state, playerId, action.color);
    case 'CHOOSE_SACRIFICE':
      return chooseSacrifice(state, playerId, action.instanceId);
    case 'CHOOSE_KEEP_ONE_SACRIFICE_REST':
      return chooseKeepOneSacrificeRest(state, playerId, action.instanceId);
    case 'CHOOSE_UP_TO_N_CREATURES_SACRIFICE_REST':
      return chooseUpToNCreaturesSacrificeRest(state, playerId, action.instanceId);
    case 'RESOLVE_SCRY_BEFORE_EXILE':
      return resolveScryBeforeExile(state, playerId, action.toBottom);
    case 'RESOLVE_SURVEIL':
      return resolveSurveil(state, playerId, action.graveyardIds, action.keepOrder);
    case 'RESOLVE_EXPLORE':
      return resolveExplore(state, playerId, action.toGraveyard);
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
      return resolveChooseOneMode(state, playerId, action.modeIndex, action.alsoModeIndex);
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
    case 'RESOLVE_MAY_PUT_TOP_LAND_ONTO_BATTLEFIELD_TAPPED':
      return resolveMayPutTopLandOntoBattlefieldTapped(state, playerId, action.accept);
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
    case 'RESOLVE_RETURN_CREATURE_FROM_GRAVEYARD_HAND_OR_BATTLEFIELD':
      return resolveReturnCreatureFromGraveyardHandOrBattlefield(state, playerId, action.instanceId);
    case 'RESOLVE_ESPERS_TO_MAGICITE_CHOICE':
      return resolveEspersToMagiciteChoice(state, playerId, action.instanceId);
    case 'RESOLVE_THROW_WIDE_THE_GATES':
      return resolveThrowWideTheGatesChoice(state, playerId, action.accept);
    case 'RESOLVE_SNORT_CHOICE':
      return resolveSnortChoice(state, playerId, action.accept);
    case 'RESOLVE_KEFKA_CHOICE':
      return resolveKefkaChoice(state, playerId, action.instanceId);
    case 'RESOLVE_REJOIN_THE_FIGHT_CHOICE':
      return resolveRejoinTheFightChoice(state, playerId, action.instanceId);
    case 'RESOLVE_TRAGIC_ARROGANCE_CHOICE':
      return resolveTragicArroganceChoice(state, playerId, action.instanceId);
    case 'RESOLVE_ATTACH_FROM_GRAVEYARD_CHOICE':
      return resolveAttachFromGraveyardChoice(state, playerId, action.instanceId);
    case 'CAST_WITH_OVERLOAD':
      return castWithOverload(state, playerId, action.instanceId);
    case 'CAST_WITH_BLITZ':
      return castWithBlitz(state, playerId, action.instanceId, action.discardInstanceId);
    case 'RESOLVE_MAY_SACRIFICE_FOR_DRAW_AND_DRAIN_CHOICE':
      return resolveMaySacrificeForDrawAndDrainChoice(state, playerId, action.instanceId);
    case 'RESOLVE_STRAGO_AND_RELM_CHOICE':
      return resolveStragoAndRelmChoice(state, playerId, action.accept);
    case 'ACTIVATE_UNEARTH':
      return activateUnearth(state, playerId, action.instanceId);
    case 'RESOLVE_MOG_MOOGLE_WARRIOR_DANCE_CHOICE':
      return resolveMogMoogleWarriorDanceChoice(state, playerId, action.instanceId);
    case 'RESOLVE_FANDANIEL_CHOICE':
      return resolveFandanielChoice(state, playerId, action.instanceId);
    case 'RESOLVE_REBOUND_CHOICE':
      return resolveReboundChoice(state, playerId, action.accept);
    case 'RESOLVE_LOOK_AT_TOP_N_PUT_M_TO_HAND_REST_TO_BOTTOM':
      return resolveLookAtTopNPutMToHandRestToBottom(state, playerId, action.instanceId);
    case 'RESOLVE_OPTIONAL_TRANSFORM':
      return resolveOptionalTransform(state, playerId, action.accept);
    case 'RESOLVE_OPTIONAL_BECOME_COPY':
      return resolveOptionalBecomeCopy(state, playerId, action.accept);
    case 'RESOLVE_LIBRARY_PLACEMENT_CHOICE':
      return resolveLibraryPlacementChoice(state, playerId, action.toTop);
    case 'RESOLVE_OPTIONAL_PAY_LIFE':
      return resolveOptionalPayLife(state, playerId, action.accept);
    case 'RESOLVE_OPTIONAL_PAY_MANA':
      return resolveOptionalPayMana(state, playerId, action.accept);
    case 'CAST_CREATURE_FROM_GRAVEYARD_VIA_GRANT':
      return castCreatureFromGraveyardViaGrant(state, playerId, action.instanceId);
    case 'FORETELL_CARD':
      return foretellCard(state, playerId, action.instanceId);
    case 'ACTIVATE_NINJUTSU':
      return activateNinjutsu(state, playerId, action.instanceId, action.returnInstanceId);
    case 'RESOLVE_MAY_EFFECT':
      return resolveMayEffect(state, playerId, action.accept);
    case 'RESOLVE_COMMANDER_ZONE_CHOICE':
      return resolveCommanderZoneChoice(state, playerId, action.toCommandZone);
    case 'RESOLVE_WARD_PAYMENT':
      return resolveWardPayment(state, playerId, action.pay);
    case 'RESOLVE_ATTACK_TAX_PAYMENT':
      return resolveAttackTaxPayment(state, playerId, action.pay);
    case 'RESOLVE_COUNTER_TRANSFER':
      return resolveCounterTransfer(state, playerId, action.targetInstanceId);
    case 'RESOLVE_PUT_CREATURE_OR_LAND_FROM_HAND':
      return resolvePutCreatureOrLandFromHand(state, playerId, action.instanceId);
    case 'RESOLVE_REVEAL_LAND_TYPE_FROM_HAND':
      return resolveRevealLandTypeFromHand(state, playerId, action.instanceId);
    case 'RESOLVE_FREE_CAST_FROM_HAND':
      return resolveFreeCastFromHand(state, playerId, action.instanceId);
    case 'RESOLVE_LIBRARY_SEARCH':
      return resolveLibrarySearch(state, playerId, action.instanceId, action.toBattlefieldTapped);
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

  let next = applyDrawTriggers(result.state, playerId, 1);
  next = updatePlayer(next, playerId, (p) => ({ ...p, hasDrawnThisTurn: true }));
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
function effectiveProducesMana(
  state: GameState,
  controllerId: string,
  def: CardDefinition,
  instance: CardInstance
): ManaColor | 'any' | ManaColor[] | 'commanderColorIdentity' | 'opponentLandColors' | 'ownLandColors' | undefined {
  const override = getActiveCharacteristicOverride(instance);
  if (override && override.overridesProducesMana !== undefined) return override.overridesProducesMana ?? undefined;
  if (def.producesMana) return def.producesMana;
  // "Equipped creature has '{T}: Add [color].'" (Summoning Materia) - more
  // specific than the broad grantsManaAbilityToOthers fallback below, so
  // checked first.
  const equippedWith = getPlayer(state, controllerId).zones.battlefield.find(
    (c) => c.attachedToInstanceId === instance.instanceId && !!getCardDefinition(c.defId).equipGrantsManaAbility
  );
  if (equippedWith) return getCardDefinition(equippedWith.defId).equipGrantsManaAbility;
  const granter = getPlayer(state, controllerId).zones.battlefield.find(
    (c) => c.instanceId !== instance.instanceId && !!getCardDefinition(c.defId).grantsManaAbilityToOthers
  );
  return granter ? getCardDefinition(granter.defId).grantsManaAbilityToOthers : undefined;
}

/** Every color a land the given player's OPPONENT controls could produce
 * (Exotic Orchard) - unions each opponent land's own producesMana/
 * altProducesMana, excluding colorless ({C}, matching real Magic's "any
 * color" meaning the five colors only). 'any' contributes all five;
 * 'commanderColorIdentity'/'opponentLandColors' on an OPPONENT'S OWN land
 * are deliberately not resolved recursively (an edge case no current card
 * creates) and simply contribute nothing. Falls back to no colors (the
 * caller treats that as plain colorless) if the opponent has no
 * mana-producing land, or only colorless-producing ones. */
function opponentLandColors(state: GameState, controllerId: string): ManaColor[] {
  const ALL_FIVE: ManaColor[] = ['W', 'U', 'B', 'R', 'G'];
  const opponent = getOpponent(state, controllerId);
  const colors = new Set<ManaColor>();
  for (const c of opponent.zones.battlefield) {
    const d = getCardDefinition(c.defId);
    if (d.type !== 'land') continue;
    if (d.producesMana === 'any') ALL_FIVE.forEach((x) => colors.add(x));
    else if (Array.isArray(d.producesMana)) d.producesMana.forEach((x) => colors.add(x));
    else if (d.producesMana && d.producesMana !== 'commanderColorIdentity' && d.producesMana !== 'opponentLandColors' && d.producesMana !== 'ownLandColors') colors.add(d.producesMana);
    if (d.altProducesMana) d.altProducesMana.colors.forEach((x) => colors.add(x));
  }
  colors.delete('C');
  return [...colors];
}

/** Every color a land the given player THEMSELVES controls could produce
 * (Incubation Druid's "Add one mana of any type that a land you control
 * could produce") - the controller's-own-lands mirror of opponentLandColors
 * above, same recursive-self-reference and colorless-exclusion caveats. */
function ownLandColors(state: GameState, controllerId: string): ManaColor[] {
  const ALL_FIVE: ManaColor[] = ['W', 'U', 'B', 'R', 'G'];
  const player = getPlayer(state, controllerId);
  const colors = new Set<ManaColor>();
  for (const c of player.zones.battlefield) {
    const d = getCardDefinition(c.defId);
    if (d.type !== 'land') continue;
    if (d.producesMana === 'any') ALL_FIVE.forEach((x) => colors.add(x));
    else if (Array.isArray(d.producesMana)) d.producesMana.forEach((x) => colors.add(x));
    else if (d.producesMana && d.producesMana !== 'commanderColorIdentity' && d.producesMana !== 'opponentLandColors' && d.producesMana !== 'ownLandColors') colors.add(d.producesMana);
    if (d.altProducesMana) d.altProducesMana.colors.forEach((x) => colors.add(x));
  }
  colors.delete('C');
  return [...colors];
}

/** How much mana one tap of a permanent with `def` actually produces of
 * `color` - def.producesManaAmount (Ring of the Lucii's "T: Add MM"), or, if
 * set, def.producesManaAmountEqualToOwnCounterLabel (Everflowing Chalice's
 * "Add {C} for each charge counter on this artifact" - read live off
 * `instance`, not a fixed printed number) - unless the controller has a
 * permanent with doublesColorlessManaFromLands (Ultima, Origin of Oblivion)
 * AND this is a LAND tapping for colorless specifically, in which case it's
 * doubled on top of that. Shared by every place mana is actually added to or
 * refunded from a pool (tap, manual untap-refund, and the automatic
 * end-of-phase unspent-mana sweep) so they can never disagree about how much
 * a given tap was worth. */
function effectiveProducedManaAmount(state: GameState, controllerId: string, def: CardDefinition, instance: CardInstance, color: ManaColor | undefined): number {
  const base = def.producesManaAmountEqualToOwnCounterLabel
    ? instance.counters.find((c) => c.label === def.producesManaAmountEqualToOwnCounterLabel)?.amount ?? 0
    : def.producesManaAmountIfOwnCounter && instance.counters.some((c) => c.label === def.producesManaAmountIfOwnCounter!.counterLabel && c.amount > 0)
    ? def.producesManaAmountIfOwnCounter.amount
    : def.producesManaAmount ?? 1;
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
  if (found.card.phasedOut) return { ok: false, error: `${def.name} is phased out - treat it as though it doesn't exist.` };

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
    const producedAmount = effectiveProducedManaAmount(state, found.ownerPlayerId, def, found.card, producedColor);
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
  let producesMana = effectiveProducesMana(state, found.ownerPlayerId, def, found.card);
  if (producesMana === 'commanderColorIdentity') {
    const owner = getPlayer(state, found.ownerPlayerId);
    const commanderDef = owner.commanderDefId ? getCardDefinition(owner.commanderDefId) : null;
    const identity = commanderDef ? ([...new Set(Object.keys(parseCostLabel(commanderDef.costLabel).colors))] as ManaColor[]) : [];
    producesMana = identity.length > 1 ? identity : identity.length === 1 ? identity[0] : 'C';
  }
  if (producesMana === 'opponentLandColors') {
    const colors = opponentLandColors(state, found.ownerPlayerId);
    producesMana = colors.length > 1 ? colors : colors.length === 1 ? colors[0] : 'C';
  }
  if (producesMana === 'ownLandColors') {
    const colors = ownLandColors(state, found.ownerPlayerId);
    producesMana = colors.length > 1 ? colors : colors.length === 1 ? colors[0] : 'C';
  }
  // "Pain land" - a SECOND, alternate tap-for-mana mode alongside the plain
  // producesMana above (Brushland's "{T}: Add {C}." / "{T}: Add {G} or {W}.
  // This land deals 1 damage to you.") - only engages when the player's
  // chosenColor picks one of the alt mode's own colors (the client's mana
  // picker offers both modes' colors together); otherwise this land behaves
  // exactly like plain producesMana, unaffected.
  let altLifePayment: number | undefined;
  if (def.altProducesMana && chosenColor && def.altProducesMana.colors.includes(chosenColor)) {
    producesMana = def.altProducesMana.colors;
    altLifePayment = def.altProducesMana.payLife;
  }
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
    // "Activate only if you control five or more lands" (Temple of the
    // False God) - gates the mana ability entirely below that land count.
    if (!mutual && def.producesManaOnlyIfControlLandCount) {
      const landCount = getPlayer(state, found.ownerPlayerId).zones.battlefield.filter((c) => getCardDefinition(c.defId).type === 'land').length;
      if (landCount < def.producesManaOnlyIfControlLandCount) {
        return { ok: false, error: `${def.name} can only be activated if you control ${def.producesManaOnlyIfControlLandCount} or more lands.` };
      }
    }
    const resolved = resolveTapColor(producesMana, chosenColor);
    if (!resolved.ok) return resolved;
    resolvedColor = resolved.color;
  }

  // Ring of the Lucii's "T: Add MM" produces 2 colorless from one tap -
  // everything else defaults to 1 (doubled again by a
  // doublesColorlessManaFromLands permanent, e.g. Ultima, Origin of
  // Oblivion). See types.ts: producesManaAmount.
  const producedAmount = effectiveProducedManaAmount(state, found.ownerPlayerId, def, found.card, resolvedColor);
  let next = updatePlayer(state, found.ownerPlayerId, (p) => ({
    ...p,
    zones: {
      ...p.zones,
      battlefield: p.zones.battlefield.map((c) => (c.instanceId === instanceId ? { ...c, tapped: true, producedManaColor: resolvedColor } : c)),
    },
    manaPool: resolvedColor ? { ...p.manaPool, [resolvedColor]: p.manaPool[resolvedColor] + producedAmount } : p.manaPool,
  }));
  if (resolvedColor) next = { ...next, log: [...next.log, `${def.name} adds ${producedAmount > 1 ? `${producedAmount} ` : ''}${resolvedColor} to mana pool.`] };
  if (resolvedColor && altLifePayment) {
    next = loseLife(next, found.ownerPlayerId, altLifePayment);
    next = { ...next, log: [...next.log, `${def.name} deals ${altLifePayment} damage to ${getPlayer(next, found.ownerPlayerId).name}.`] };
  }

  // "{T}, Sacrifice this: ..." folded into one tap (e.g. a Treasure token) -
  // only once it actually produced mana, not on a no-op tap.
  if (resolvedColor && found.card.sacrificesOnTap) {
    const sacResult = moveCreaturesToGraveyardAndTrigger(next, [instanceId], 'is sacrificed');
    next = { ...sacResult.state, log: [...sacResult.state.log, ...sacResult.logLines] };
  }

  // "{T}: Add one mana of any color. [Additional effect]" (Yuna, Grand
  // Summoner's Grand Summon) - only once this tap actually produced mana,
  // same no-op-tap gate as sacrificesOnTap just above.
  if (resolvedColor && def.onTapForManaEffects && def.onTapForManaEffects.length > 0) {
    const resolved = resolveCardEffects(next, found.ownerPlayerId, def.onTapForManaEffects, instanceId);
    next = { ...resolved.state, log: [...resolved.state.log, ...resolved.logLines] };
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
  kickerPaymentInstanceId?: string,
  // "Escalate — Tap an untapped creature you control." (see CardDefinition.
  // escalateCost) - one OTHER untapped creature the controller taps for
  // each mode chosen beyond the first.
  escalateCostInstanceIds?: string[],
  // "Multikicker [cost]" (see CardDefinition.multikickerCost) - how many
  // times it was paid (0/omitted declines it entirely).
  chosenMultikickerCount?: number,
  // "Convoke" (see CardDefinition.convoke) - the controller's own untapped
  // creatures tapped to help pay this cast's cost.
  convokeInstanceIds?: string[],
  // "You may pay [lifeCost] life rather than pay this spell's mana cost"
  // (see CardDefinition.alternateCastCostPayLifeIfControlLandName) -
  // requested explicitly; no silent fallback to normal mana payment if
  // the land condition isn't met.
  payAlternateLifeCost?: boolean,
  // "Delve" (see CardDefinition.delve) - the controller's own graveyard
  // cards exiled to help pay this cast's generic cost.
  delveInstanceIds?: string[]
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
  if (def.chooseModes && def.chooseExactlyOneMode && chosenModeIndices!.length !== 1) {
    return { ok: false, error: `${def.name} requires choosing exactly one mode.` };
  }
  if (def.chooseModes && !def.chooseExactlyOneMode && def.chooseExactlyNModes !== undefined && chosenModeIndices!.length !== def.chooseExactlyNModes) {
    return { ok: false, error: `${def.name} requires choosing exactly ${def.chooseExactlyNModes} mode(s).` };
  }
  if (def.tieredModes && (chosenTierIndex === undefined || !def.tieredModes[chosenTierIndex])) {
    return { ok: false, error: `${def.name} requires choosing one tier.` };
  }

  if (!mutual && !free && def.type !== 'land' && def.type !== 'instant' && !hasKeyword(def, 'flash')) {
    if (state.activePlayerId !== playerId) return { ok: false, error: `${def.name} can only be cast on your own turn (no flash).` };
    if (state.phase !== 'main1' && state.phase !== 'main2') return { ok: false, error: `${def.name} can only be cast during a main phase (no flash).` };
  }

  // "As long as this Equipment is attached to a creature, your opponents
  // can't cast spells during your turn." (Conqueror's Flail) - checked
  // only here (castCard's own main path), not castFromGraveyard/flashback/
  // exile, same scoped-down convention as NoncreatureCastTrigger. Lands
  // aren't spells, so def.type === 'land' is never blocked by this.
  if (!mutual && !free && def.type !== 'land' && state.activePlayerId !== playerId) {
    const turnPlayer = getPlayer(state, state.activePlayerId);
    const locksOutCasting = turnPlayer.zones.battlefield.some((c) =>
      turnPlayer.zones.battlefield.some((eq) => eq.attachedToInstanceId === c.instanceId && getCardDefinition(eq.defId).equipGrantsOpponentsCantCastDuringYourTurn)
    );
    if (locksOutCasting) {
      return { ok: false, error: `${def.name} can't be cast - ${turnPlayer.name}'s Equipment prevents opponents from casting spells during their turn.` };
    }
  }

  if (def.type === 'land') {
    if (!mutual) {
      if (state.activePlayerId !== playerId) return { ok: false, error: 'You can only play a land on your own turn.' };
      if (player.landsPlayedThisTurn >= maxLandsPerTurn(state, playerId)) return { ok: false, error: "You've already played a land this turn." };
    }
    let next = updatePlayer(state, playerId, (p) => ({ ...p, zones: { ...p.zones, hand: p.zones.hand.filter((c) => c.instanceId !== instanceId) } }));
    // "~ enters the battlefield tapped unless you control an Island or a
    // Plains" (Glacial Fortress) - fully determined by board state BEFORE
    // this land is added (`player`, captured at the top of this function),
    // no player choice at all - unlike entersTappedUnlessRevealLandNames
    // below, which always enters tapped provisionally pending a real reveal
    // decision.
    const controlsMatchingNamedLand = !!def.entersTappedUnlessControlLandNames && player.zones.battlefield.some((c) => def.entersTappedUnlessControlLandNames!.includes(getCardDefinition(c.defId).name));
    // "~ enters the battlefield tapped unless you control two or more basic
    // lands" (Canopy Vista) - same board-state-only, no-choice timing.
    const BASIC_LAND_NAMES = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'];
    const basicLandCount = player.zones.battlefield.filter((c) => {
      const cDef = getCardDefinition(c.defId);
      return cDef.type === 'land' && BASIC_LAND_NAMES.includes(cDef.name);
    }).length;
    const tappedForTangoLand = !!def.entersTappedUnlessControlBasicLandCount && basicLandCount < def.entersTappedUnlessControlBasicLandCount;
    // A "check land" (entersTappedUnlessRevealLandNames) always enters
    // tapped provisionally - the reveal choice (pendingRevealLandTypeFromHand)
    // untaps it after the fact if a matching card is shown, since the
    // reveal itself needs the land to already be a real battlefield object
    // (findCardAnywhere target) rather than being decided before placement.
    const movedCard = {
      ...card,
      tapped: !!def.entersTapped || !!def.entersTappedUnlessRevealLandNames || (!!def.entersTappedUnlessControlLandNames && !controlsMatchingNamedLand) || tappedForTangoLand,
      damageMarked: 0,
      summoningSick: false,
    };
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
    const opponentLandWatchResult = triggerOpponentLandEnterWatchers(next, playerId);
    next = opponentLandWatchResult.state;
    effectLogLines = [...effectLogLines, ...opponentLandWatchResult.logLines];

    if (def.entersTappedUnlessRevealLandNames) {
      next = { ...next, pendingRevealLandTypeFromHand: { sourceInstanceId: movedCard.instanceId, controllerId: playerId, landNames: def.entersTappedUnlessRevealLandNames } };
    }

    return { ok: true, state: { ...next, log: [...next.log, `${player.name} plays ${def.name}.`, ...effectLogLines] } };
  }

  const commanderTax = sourceZone === 'commander' ? card.counters.find((c) => c.label === 'Commander Tax')?.amount ?? 0 : 0;
  // "This spell costs 1 less to cast for each permanent card in your
  // graveyard" (Diamond Weapon), "Affinity for [subtype]s" (Travel the
  // Overworld), "Affinity for [type]s" (Valkyrie Aerial Unit) - see
  // engine/mana.ts: effectiveCastCost/dynamicCostReduction, also used
  // client-side (GameBoard.tsx/CardActionsPanel.tsx) so a discounted card
  // doesn't sit looking unaffordable against its full printed cost.
  let parsed = effectiveCastCost(def, player, getOpponent(state, playerId));
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
  // "Multikicker [cost]" (Everflowing Chalice) - like Tiered above, merged
  // ON TOP of the card's printed cost, but scaled by how many times it was
  // paid instead of applied once.
  const multikickerCount = def.multikickerCost && chosenMultikickerCount ? chosenMultikickerCount : 0;
  if (multikickerCount > 0) {
    const perKick = parseCostLabel(def.multikickerCost!);
    const mergedColors: Partial<Record<Exclude<ManaColor, 'C'>, number>> = { ...parsed.colors };
    for (const [color, amount] of Object.entries(perKick.colors)) {
      const key = color as Exclude<ManaColor, 'C'>;
      mergedColors[key] = (mergedColors[key] ?? 0) + (amount ?? 0) * multikickerCount;
    }
    parsed = { generic: parsed.generic + perKick.generic * multikickerCount, colors: mergedColors, hasX: parsed.hasX || perKick.hasX };
  }
  // "Convoke" (Clever Concealment) - validated up front, same reasoning as
  // Escalate/Kicker above. Each tapped creature greedily pays a still-unpaid
  // colored pip it matches first (approximating its "color" as the colored
  // symbols in its own printed cost, same as Arcane Signet's commander color
  // identity), falling back to generic.
  let convokeCards: CardInstance[] = [];
  if (!mutual && def.convoke && convokeInstanceIds && convokeInstanceIds.length > 0) {
    if (new Set(convokeInstanceIds).size !== convokeInstanceIds.length) {
      return { ok: false, error: 'Convoke creatures must be different from each other.' };
    }
    for (const id of convokeInstanceIds) {
      const candidate = player.zones.battlefield.find((c) => c.instanceId === id);
      if (!candidate) return { ok: false, error: 'Convoke requires tapping creatures you control.' };
      if (candidate.tapped) return { ok: false, error: 'Convoke requires tapping UNTAPPED creatures.' };
      if (getCardDefinition(candidate.defId).type !== 'creature') return { ok: false, error: 'Convoke requires tapping creatures.' };
      convokeCards.push(candidate);
    }
    const mergedColors: Partial<Record<Exclude<ManaColor, 'C'>, number>> = { ...parsed.colors };
    let genericRemaining = parsed.generic;
    for (const c of convokeCards) {
      const cColors = parseCostLabel(getCardDefinition(c.defId).costLabel).colors;
      const matchColor = (Object.keys(cColors) as Exclude<ManaColor, 'C'>[]).find((color) => (mergedColors[color] ?? 0) > 0);
      if (matchColor) mergedColors[matchColor] = (mergedColors[matchColor] ?? 0) - 1;
      else if (genericRemaining > 0) genericRemaining -= 1;
    }
    parsed = { generic: genericRemaining, colors: mergedColors, hasX: parsed.hasX };
  }
  // "Delve (Each card you exile from your graveyard while casting this
  // spell pays for {1}.)" (Dig Through Time) - validated up front, same
  // reasoning as Convoke/Escalate above. Reduces the GENERIC portion only.
  let delveCards: CardInstance[] = [];
  if (!mutual && def.delve && delveInstanceIds && delveInstanceIds.length > 0) {
    if (new Set(delveInstanceIds).size !== delveInstanceIds.length) {
      return { ok: false, error: 'Delve cards must be different from each other.' };
    }
    if (delveInstanceIds.length > parsed.generic) {
      return { ok: false, error: `Delve can’t exile more cards than ${def.name}'s generic cost (${parsed.generic}).` };
    }
    for (const id of delveInstanceIds) {
      const candidate = player.zones.graveyard.find((c) => c.instanceId === id);
      if (!candidate) return { ok: false, error: 'Delve requires exiling cards from your own graveyard.' };
      delveCards.push(candidate);
    }
    parsed = { ...parsed, generic: parsed.generic - delveCards.length };
  }
  const extraGeneric = (parsed.hasX ? chosenX ?? 0 : 0) + commanderTax;

  // "You may pay [lifeCost] life rather than pay this spell's mana cost"
  // (Snuff Out) - an alternate TOTAL cost, not a discount: skips the mana
  // affordability check/payment entirely in favor of a flat life payment,
  // gated on controlling a land with the printed name. Requested
  // explicitly via payAlternateLifeCost, so there's no silent fallback to
  // normal mana payment if the land condition isn't met.
  const altCost = def.alternateCastCostPayLifeIfControlLandName;
  const useAlternateLifeCost = !!payAlternateLifeCost;
  if (useAlternateLifeCost) {
    if (!altCost) return { ok: false, error: `${def.name} has no alternate life-payment cost.` };
    if (!mutual && !player.zones.battlefield.some((c) => getCardDefinition(c.defId).name === altCost.landName)) {
      return { ok: false, error: `You must control a ${altCost.landName} to pay ${altCost.lifeCost} life instead of ${def.name}'s mana cost.` };
    }
    if (!mutual && player.life < altCost.lifeCost) {
      return { ok: false, error: `Not enough life to pay ${altCost.lifeCost} for ${def.name}.` };
    }
  }

  if (!mutual && !free && !useAlternateLifeCost && !canPay(player.manaPool, parsed, extraGeneric)) {
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

  // "Escalate — Tap an untapped creature you control." (Collective Effort) -
  // one OTHER untapped creature per mode chosen BEYOND THE FIRST (picking
  // just one mode is always free). Validated up front, same reasoning as
  // Kicker just above.
  let escalateCards: CardInstance[] = [];
  if (!mutual && def.escalateCost && chosenModeIndices) {
    const extraModesChosen = chosenModeIndices.length - 1;
    if (extraModesChosen > 0) {
      const ids = escalateCostInstanceIds ?? [];
      if (ids.length !== extraModesChosen || new Set(ids).size !== ids.length) {
        return { ok: false, error: `Escalate requires tapping ${extraModesChosen} untapped creature(s) you control for the extra mode(s) chosen.` };
      }
      for (const id of ids) {
        const candidate = player.zones.battlefield.find((c) => c.instanceId === id);
        if (!candidate) return { ok: false, error: 'Escalate requires tapping creatures you control.' };
        if (candidate.tapped) return { ok: false, error: 'Escalate requires tapping UNTAPPED creatures.' };
        if (getCardDefinition(candidate.defId).type !== 'creature') return { ok: false, error: 'Escalate requires tapping creatures.' };
        escalateCards.push(candidate);
      }
    }
  }

  let next = state;
  if (!mutual && !free) {
    if (useAlternateLifeCost) {
      next = loseLife(next, playerId, altCost!.lifeCost);
    } else {
      next = updatePlayer(next, playerId, (p) => ({ ...p, manaPool: payCost(p.manaPool, parsed, extraGeneric) }));
    }
  }
  if (escalateCards.length > 0) {
    const escalateIds = new Set(escalateCards.map((c) => c.instanceId));
    next = updatePlayer(next, playerId, (p) => ({
      ...p,
      zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (escalateIds.has(c.instanceId) ? { ...c, tapped: true } : c)) },
    }));
    next = { ...next, log: [...next.log, `${player.name} pays Escalate by tapping ${escalateCards.length} creature(s).`] };
  }
  if (convokeCards.length > 0) {
    const convokeIds = new Set(convokeCards.map((c) => c.instanceId));
    next = updatePlayer(next, playerId, (p) => ({
      ...p,
      zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (convokeIds.has(c.instanceId) ? { ...c, tapped: true } : c)) },
    }));
    next = { ...next, log: [...next.log, `${player.name} convokes by tapping ${convokeCards.length} creature(s).`] };
  }
  if (delveCards.length > 0) {
    const delveIds = new Set(delveCards.map((c) => c.instanceId));
    next = updatePlayer(next, playerId, (p) => ({
      ...p,
      zones: { ...p.zones, graveyard: p.zones.graveyard.filter((c) => !delveIds.has(c.instanceId)), exile: [...p.zones.exile, ...delveCards] },
    }));
    next = { ...next, log: [...next.log, `${player.name} delves by exiling ${delveCards.length} card(s) from their graveyard.`] };
  }
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
  // "Dualcast" (Alisaie Leveilleur) - counts every non-land cast, so the
  // THIRD+ spell this turn correctly stops qualifying for the discount
  // (only checked against === 1 in dynamicCostReduction above).
  let eukrasiaDrawLogLines: string[] = [];
  if (!mutual) {
    const newSpellsCastThisTurn = (player.spellsCastThisTurn ?? 0) + 1;
    next = updatePlayer(next, playerId, (p) => ({ ...p, spellsCastThisTurn: newSpellsCastThisTurn }));
    // "Eukrasia — Whenever you cast your second spell each turn, draw a
    // card." (Alphinaud Leveilleur) - fires exactly on the second cast,
    // not every cast after the first.
    if (newSpellsCastThisTurn === 2) {
      for (const watcher of getPlayer(next, playerId).zones.battlefield) {
        const watcherDef = getCardDefinition(watcher.defId);
        if (!watcherDef.drawCardOnSecondSpellEachTurn) continue;
        const drawn = getPlayer(next, playerId).zones.library.slice(0, 1);
        next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(1), hand: [...p.zones.hand, ...drawn] } }));
        eukrasiaDrawLogLines.push(`${watcherDef.name} triggers: ${getPlayer(next, playerId).name} draws a card.`);
      }
    }
  }
  // "Magecraft — Whenever you cast or copy an instant or sorcery spell,
  // draw a card." (Archmage Emeritus) - the "or copy" half is deferred
  // (no spell-copy mechanism exists in this engine), so only a genuine
  // cast reaches this.
  if (!mutual && (def.type === 'instant' || def.type === 'sorcery')) {
    for (const watcher of getPlayer(next, playerId).zones.battlefield) {
      const watcherDef = getCardDefinition(watcher.defId);
      if (!watcherDef.onCastOrCopyInstantOrSorceryDrawCard) continue;
      const drawn = getPlayer(next, playerId).zones.library.slice(0, 1);
      next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(1), hand: [...p.zones.hand, ...drawn] } }));
      eukrasiaDrawLogLines.push(`${watcherDef.name} triggers: ${getPlayer(next, playerId).name} draws a card.`);
    }
  }
  next = updatePlayer(next, playerId, (p) => ({
    ...p,
    zones: { ...p.zones, [sourceZone as 'hand' | 'commander']: p.zones[sourceZone as 'hand' | 'commander'].filter((c) => c.instanceId !== instanceId) },
  }));

  const isPermanent = def.type === 'creature' || def.type === 'artifact' || def.type === 'enchantment';
  // "Rebound... exile it as it resolves" (Transpose) - only when cast from
  // hand, which castCard always is (every other zone has its own dedicated
  // casting function). See ReboundAbility.
  const targetZone: ZoneName = isPermanent ? 'battlefield' : def.rebound ? 'exile' : 'graveyard';
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
  let movedCard = stripSagaProgress({
    ...card,
    tapped: isPermanent && !!def.entersTapped,
    damageMarked: 0,
    summoningSick: def.type === 'creature' ? !hasHaste : false,
    pendingReboundNextUpkeep: !isPermanent && !!def.rebound ? true : undefined,
  });

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

  // "When that mana is spent to cast a creature spell that shares a
  // creature type with your commander, scry 1." (Path of Ancestry) -
  // consumed by whatever is cast here regardless of type (see GameState.
  // pendingManaIdentitySourceScry's own doc comment for the approximation
  // this stands in for).
  let manaIdentityScryLogLines: string[] = [];
  if (next.pendingManaIdentitySourceScry?.controllerId === playerId) {
    next = { ...next, pendingManaIdentitySourceScry: null };
    const commanderDefId = getPlayer(next, playerId).commanderDefId;
    if (commanderDefId && sharesCreatureType(def, getCardDefinition(commanderDefId))) {
      const resolved = resolveCardEffects(next, playerId, [{ type: 'surveil', count: 1 }], movedCard.instanceId);
      next = resolved.state;
      manaIdentityScryLogLines = resolved.logLines;
    }
  }

  let effectLogLines: string[] = [...manaIdentityScryLogLines];
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
    // Multikicker has no real {X} in its own cost, so its paid count safely
    // reuses the same chosenX slot onEnter's PutCounterOnSelfEffect reads
    // (Everflowing Chalice's charge counters) - see CardDefinition.multikickerCost.
    const effectiveChosenX = def.multikickerCost ? multikickerCount : chosenX;
    const resolved = resolveCardEffects(next, playerId, autoEffects, movedCard.instanceId, wasKicked, effectiveChosenX, convokeCards.map((c) => c.instanceId));
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
    const triggered = triggerNoncreatureCastAbilities(next, playerId, manaValue(parsed) + extraGeneric, preCastBattlefieldIds, def.type);


    next = triggered.state;
    effectLogLines = [...effectLogLines, ...triggered.logLines];
  }

  const opponentCastResult = triggerOpponentCastSpellWatchers(next, playerId);
  next = opponentCastResult.state;
  effectLogLines = [...effectLogLines, ...opponentCastResult.logLines];

  const anyPlayerCastResult = triggerAnyPlayerCastSpellWatchers(next, playerId, def);
  next = anyPlayerCastResult.state;
  effectLogLines = [...effectLogLines, ...anyPlayerCastResult.logLines];

  const xNote = parsed.hasX ? ` (X=${chosenX ?? 0})` : '';
  const multikickerNote = multikickerCount > 0 ? ` (Multikicker paid ${multikickerCount} time(s))` : '';
  const taxNote = commanderTax > 0 ? ` (+${commanderTax} commander tax paid)` : '';
  const freeNote = mutual ? ' (free - Mutual Adjustment active)' : '';
  return { ok: true, state: { ...next, log: [...next.log, `${player.name} casts ${def.name}${xNote}${multikickerNote}${taxNote}${freeNote}.`, ...effectLogLines, ...eukrasiaDrawLogLines] } };
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

  // See types.ts: GameState.pendingManaIdentitySourceScry (Path of Ancestry) -
  // same consumption as castCard above, for completeness on the flashback path.
  let manaIdentityScryLogLines: string[] = [];
  if (next.pendingManaIdentitySourceScry?.controllerId === playerId) {
    next = { ...next, pendingManaIdentitySourceScry: null };
    const commanderDefId = getPlayer(next, playerId).commanderDefId;
    if (commanderDefId && sharesCreatureType(def, getCardDefinition(commanderDefId))) {
      const resolved = resolveCardEffects(next, playerId, [{ type: 'surveil', count: 1 }], movedCard.instanceId);
      next = resolved.state;
      manaIdentityScryLogLines = resolved.logLines;
    }
  }

  let effectLogLines: string[] = [...manaIdentityScryLogLines];
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
    const triggered = triggerNoncreatureCastAbilities(next, playerId, manaValue(parsed) + extraGeneric, preCastBattlefieldIds, def.type);


    next = triggered.state;
    effectLogLines = [...effectLogLines, ...triggered.logLines];
  }

  const xNote = parsed.hasX ? ` (X=${chosenX ?? 0})` : '';
  const freeNote = mutual ? ' (free - Mutual Adjustment active)' : '';
  const exileNote = isPermanent ? '' : ', then it is exiled';
  return { ok: true, state: { ...next, log: [...next.log, `${player.name} casts ${def.name} via flashback${xNote}${freeNote}${exileNote}.`, ...effectLogLines] } };
}

/** "Overload {cost}" (Vandalblast) - casts the card from hand for its
 * OverloadAbility.cost instead of its normal costLabel, resolving
 * OverloadAbility.effects (the board-wide "each" version) instead of
 * onCast. Deliberately narrower than castCard/castFromGraveyard - only
 * hand-cast instants/sorceries are supported (no onEnter/Saga/artifact/
 * subtype/creature-watcher handling), since every card with `overload` in
 * this pool so far is a plain sorcery; this is this engine's first
 * Overload card. */
function castWithOverload(state: GameState, playerId: string, instanceId: string): ActionResult {
  const player = getPlayer(state, playerId);
  const mutual = isMutualActive(state);
  const card = player.zones.hand.find((c) => c.instanceId === instanceId);
  if (!card) return { ok: false, error: 'That card is not in your hand.' };
  const def = getCardDefinition(card.defId);
  if (!def.overload) return { ok: false, error: `${def.name} has no overload ability.` };

  if (!mutual && def.type !== 'instant' && !hasKeyword(def, 'flash')) {
    if (state.activePlayerId !== playerId) return { ok: false, error: `${def.name} can only be cast on your own turn (no flash).` };
    if (state.phase !== 'main1' && state.phase !== 'main2') return { ok: false, error: `${def.name} can only be cast during a main phase (no flash).` };
  }

  const parsed = parseCostLabel(def.overload.cost);
  if (!mutual && !canPay(player.manaPool, parsed, 0)) {
    return { ok: false, error: `Not enough mana to overload ${def.name} (${def.overload.cost}).` };
  }

  let next = state;
  if (!mutual) next = updatePlayer(next, playerId, (p) => ({ ...p, manaPool: payCost(p.manaPool, parsed, 0) }));
  next = updatePlayer(next, playerId, (p) => ({
    ...p,
    zones: { ...p.zones, hand: p.zones.hand.filter((c) => c.instanceId !== instanceId), graveyard: [...p.zones.graveyard, card] },
  }));

  let effectLogLines: string[] = [];
  if (def.overload.effects.length > 0) {
    const resolved = resolveCardEffects(next, playerId, def.overload.effects, instanceId);
    next = resolved.state;
    effectLogLines = resolved.logLines;
  }

  const freeNote = mutual ? ' (free - Mutual Adjustment active)' : '';
  return { ok: true, state: { ...next, log: [...next.log, `${player.name} casts ${def.name} with overload${freeNote}.`, ...effectLogLines] } };
}

/** "Pray — Once during each of your turns, you may cast a creature spell
 * from among cards in your graveyard that were put there from anywhere
 * other than the battlefield this turn." (Banon, the Returners' Leader) -
 * see CardDefinition.grantsOncePerTurnCastCreatureFromGraveyardIfNotFromBattlefield.
 * Pays the card's own NORMAL printed cost (not flashback) - a simpler
 * sibling of castFromGraveyard that skips kicker/multikicker/modal-mode
 * support (castFromGraveyard itself already doesn't support those either). */
function castCreatureFromGraveyardViaGrant(state: GameState, playerId: string, instanceId: string): ActionResult {
  const mutual = isMutualActive(state);
  const player = getPlayer(state, playerId);
  const granter = player.zones.battlefield.find((c) => getCardDefinition(c.defId).grantsOncePerTurnCastCreatureFromGraveyardIfNotFromBattlefield);
  if (!granter) return { ok: false, error: 'You have no permission to cast a creature from your graveyard this way.' };
  if (!mutual && player.usedGraveyardCastPermissionThisTurn) {
    return { ok: false, error: `${getCardDefinition(granter.defId).name}'s Pray can only be used once per turn.` };
  }
  if (!mutual && (state.activePlayerId !== playerId || (state.phase !== 'main1' && state.phase !== 'main2'))) {
    return { ok: false, error: 'This can only be used on your own turn, during a main phase.' };
  }

  const card = player.zones.graveyard.find((c) => c.instanceId === instanceId);
  if (!card) return { ok: false, error: 'That card is not in your graveyard.' };
  const def = getCardDefinition(card.defId);
  if (def.type !== 'creature') return { ok: false, error: `${def.name} is not a legal choice - it must be a creature card.` };
  if (card.graveyardEntrySource !== 'other') {
    return { ok: false, error: `${def.name} is not a legal choice - it must have entered your graveyard this turn from somewhere other than the battlefield.` };
  }

  const parsed = parseCostLabel(def.costLabel);
  if (!mutual && !canPay(player.manaPool, parsed, 0)) {
    return { ok: false, error: `Not enough mana to cast ${def.name} (${def.costLabel}).` };
  }

  let next = state;
  if (!mutual) next = updatePlayer(next, playerId, (p) => ({ ...p, manaPool: payCost(p.manaPool, parsed, 0) }));
  next = updatePlayer(next, playerId, (p) => ({
    ...p,
    zones: { ...p.zones, graveyard: p.zones.graveyard.filter((c) => c.instanceId !== instanceId) },
    usedGraveyardCastPermissionThisTurn: mutual ? p.usedGraveyardCastPermissionThisTurn : true,
  }));

  const hasHaste = hasKeyword(def, 'haste') || hasBoardGrantedKeyword(state, playerId, card, def, 'haste');
  const movedCard = stripSagaProgress({ ...card, tapped: !!def.entersTapped, damageMarked: 0, summoningSick: !hasHaste, graveyardEntrySource: undefined });
  next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, battlefield: [...p.zones.battlefield, movedCard] } }));
  next = checkLegendRule(next, playerId);

  let effectLogLines: string[] = [];
  if (def.onEnter && def.onEnter.length > 0) {
    const resolved = resolveCardEffects(next, playerId, def.onEnter, movedCard.instanceId);
    next = resolved.state;
    effectLogLines = resolved.logLines;
  }
  const creatureWatchResult = triggerCreatureEnterWatchers(next, playerId, movedCard.instanceId);
  next = creatureWatchResult.state;
  effectLogLines = [...effectLogLines, ...creatureWatchResult.logLines];
  const subtypeWatchResult = triggerSubtypeEnterWatchers(next, playerId, def.subtype);
  next = subtypeWatchResult.state;
  effectLogLines = [...effectLogLines, ...subtypeWatchResult.logLines];

  const actor = getPlayer(next, playerId);
  return {
    ok: true,
    state: { ...next, log: [...next.log, `${actor.name} casts ${def.name} from their graveyard via ${getCardDefinition(granter.defId).name}'s Pray.`, ...effectLogLines] },
  };
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
    const exileWatchResult = triggerPlayOrCastFromExileWatchers(next, playerId);
    next = exileWatchResult.state;
    landEffectLogLines = [...landEffectLogLines, ...exileWatchResult.logLines];
    return { ok: true, state: { ...next, log: [...next.log, `${player.name} plays ${def.name} from exile.`, ...landEffectLogLines] } };
  }

  if (!mutual && def.type !== 'instant' && !hasKeyword(def, 'flash')) {
    if (state.activePlayerId !== playerId) return { ok: false, error: `${def.name} can only be cast on your own turn (no flash).` };
    if (state.phase !== 'main1' && state.phase !== 'main2') return { ok: false, error: `${def.name} can only be cast during a main phase (no flash).` };
  }

  const costLabel = grant.overrideCostLabel ?? def.costLabel;
  const parsed = parseCostLabel(costLabel);
  const extraGeneric = parsed.hasX ? chosenX ?? 0 : 0;
  const colorPips = Object.values(parsed.colors).reduce((a: number, b) => a + (b ?? 0), 0);
  let effectiveParsed = grant.anyColorMana ? { generic: parsed.generic + colorPips, colors: {}, hasX: parsed.hasX } : parsed;
  if (grant.costReduction) {
    effectiveParsed = { ...effectiveParsed, generic: Math.max(0, effectiveParsed.generic - grant.costReduction) };
  }

  if (!mutual && !canPay(player.manaPool, effectiveParsed, extraGeneric)) {
    return { ok: false, error: `Not enough mana to cast ${def.name} (${costLabel}).` };
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

  // "If this spell was cast from exile, [effects]." (Foretell's own bonus
  // clause) - only ever resolved from THIS function, which is sufficient to
  // guarantee "cast from exile" is genuinely true.
  if (def.onCastFromExileEffects && def.onCastFromExileEffects.length > 0) {
    const resolved = resolveCardEffects(next, playerId, def.onCastFromExileEffects, movedCard.instanceId);
    next = resolved.state;
    effectLogLines = [...effectLogLines, ...resolved.logLines];
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
    const triggered = triggerNoncreatureCastAbilities(next, playerId, manaValue(effectiveParsed) + extraGeneric, preCastBattlefieldIds, def.type);
    next = triggered.state;
    effectLogLines = [...effectLogLines, ...triggered.logLines];
  }

  const exileWatchResult = triggerPlayOrCastFromExileWatchers(next, playerId);
  next = exileWatchResult.state;
  effectLogLines = [...effectLogLines, ...exileWatchResult.logLines];

  const xNote = parsed.hasX ? ` (X=${chosenX ?? 0})` : '';
  return { ok: true, state: { ...next, log: [...next.log, `${player.name} plays ${def.name} from exile${xNote}.`, ...effectLogLines] } };
}

/** "Whenever you play a land from exile or cast a spell from exile, you
 * gain [N] life." (Urianger Augurelt) - checked against EVERY permanent
 * the controller controls (board-wide watcher), called from BOTH success
 * paths of castFromExile (land and spell) right before returning. */
function triggerPlayOrCastFromExileWatchers(state: GameState, playerId: string): { state: GameState; logLines: string[] } {
  let next = state;
  const logLines: string[] = [];
  for (const c of getPlayer(next, playerId).zones.battlefield) {
    const d = getCardDefinition(c.defId);
    if (!d.onPlayOrCastFromExileGainLife) continue;
    const resolved = resolveCardEffects(next, playerId, [{ type: 'gainLife', amount: d.onPlayOrCastFromExileGainLife }], c.instanceId);
    next = resolved.state;
    logLines.push(...resolved.logLines);
  }
  return { state: next, logLines };
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
  // "The first activated ability you activate during your turn that
  // targets a creature you control costs [N] less to activate" (Professor
  // Hojo) - see CardAbility.targetsOwnCreature's own doc comment for why
  // this is a static per-ability marker. Sums every granting permanent the
  // controller controls (multiple Hojos stack, same as every other
  // board-wide discount here), and only while
  // usedFirstOwnCreatureTargetingAbilityDiscountThisTurn is still false.
  const hojoDiscount =
    ability.targetsOwnCreature && !owner.usedFirstOwnCreatureTargetingAbilityDiscountThisTurn
      ? owner.zones.battlefield.reduce((sum, c) => sum + (getCardDefinition(c.defId).reducesActivatedAbilityCostForFirstOwnCreatureTargetingEachTurn ?? 0), 0)
      : 0;
  const manaCost = rawManaCost ? { ...rawManaCost, generic: Math.max(0, rawManaCost.generic - abilityCostReduction - hojoDiscount) } : null;

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
  if (ability.cost.sacrificeAnotherWithSubtype) {
    const ids = costTargetInstanceIds ?? [];
    if (ids.length !== 1) return { ok: false, error: `${ability.label} requires choosing a ${ability.cost.sacrificeAnotherWithSubtype} to sacrifice.` };
    const candidate = owner.zones.battlefield.find((c) => c.instanceId === ids[0]);
    if (!candidate) return { ok: false, error: `${ability.label} requires sacrificing a permanent you control.` };
    const candidateDef = getCardDefinition(candidate.defId);
    if (!candidateDef.subtype?.toLowerCase().includes(ability.cost.sacrificeAnotherWithSubtype.toLowerCase())) {
      return { ok: false, error: `${ability.label} requires sacrificing a ${ability.cost.sacrificeAnotherWithSubtype}.` };
    }
    sacrificeTargets = [...sacrificeTargets, candidate];
  }
  if (ability.cost.sacrificeAnotherModifiedCreature) {
    const ids = costTargetInstanceIds ?? [];
    if (ids.length !== 1) return { ok: false, error: `${ability.label} requires choosing a modified creature to sacrifice.` };
    const candidate = owner.zones.battlefield.find((c) => c.instanceId === ids[0]);
    if (!candidate) return { ok: false, error: `${ability.label} requires sacrificing a creature you control.` };
    const candidateDef = getCardDefinition(candidate.defId);
    if (candidateDef.type !== 'creature' || !isModifiedCreature(state, candidate)) {
      return { ok: false, error: `${ability.label} requires sacrificing a modified creature.` };
    }
    sacrificeTargets = [...sacrificeTargets, candidate];
  }

  // "Tap an untapped legendary creature you control" as (part of) the
  // cost (Relic of Legends) - a SEPARATE permanent from this ability's own
  // source, picked by the controller via costTargetInstanceIds.
  let tapAnotherTarget: CardInstance | null = null;
  if (ability.cost.tapAnotherLegendaryCreature) {
    const ids = costTargetInstanceIds ?? [];
    if (ids.length !== 1) return { ok: false, error: `${ability.label} requires choosing an untapped legendary creature you control.` };
    const candidate = owner.zones.battlefield.find((c) => c.instanceId === ids[0]);
    if (!candidate) return { ok: false, error: `${ability.label} requires tapping a creature you control.` };
    if (candidate.tapped) return { ok: false, error: `${ability.label} requires an UNTAPPED legendary creature.` };
    const candidateDef = getCardDefinition(candidate.defId);
    if (candidateDef.type !== 'creature' || !candidateDef.subtype?.toLowerCase().includes('legendary')) {
      return { ok: false, error: `${ability.label} requires tapping a legendary creature.` };
    }
    tapAnotherTarget = candidate;
  }

  let counterRemovalTarget: CardInstance | null = null;
  let counterRemovalLabel: string | null = null;
  if (ability.cost.removeCounterFromAnotherPermanent) {
    const ids = costTargetInstanceIds ?? [];
    if (ids.length !== 1) {
      return { ok: false, error: `${ability.label} requires choosing a nonland permanent you control to remove a counter from.` };
    }
    const candidate = owner.zones.battlefield.find((c) => c.instanceId === ids[0]);
    if (!candidate) return { ok: false, error: `${ability.label} requires a permanent you control.` };
    const candidateDef = getCardDefinition(candidate.defId);
    if (ability.cost.removeCounterFromAnotherPermanent === 'nonland' && candidateDef.type === 'land') {
      return { ok: false, error: `${ability.label} requires a nonland permanent.` };
    }
    if (candidate.counters.length === 0) return { ok: false, error: `${candidateDef.name} has no counters to remove.` };
    counterRemovalTarget = candidate;
    counterRemovalLabel = [...candidate.counters].sort((a, b) => b.amount - a.amount)[0].label;
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
  if (ability.requiresNotMonstrous && found.card.monstrous) {
    return { ok: false, error: `${def.name} is already monstrous.` };
  }
  if (ability.requiresControlledArtifact && !owner.zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'artifact')) {
    return { ok: false, error: `${ability.label} requires controlling an artifact.` };
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
  if (ability.cost.removeCounterFromSelf) {
    const { label, amount = 1 } = ability.cost.removeCounterFromSelf;
    const has = found.card.counters.find((c) => c.label === label)?.amount ?? 0;
    if (has < amount) return { ok: false, error: `${def.name} needs ${amount} ${label} counter(s) to activate ${ability.label}.` };
  }
  // "...and its activated abilities can't be activated" (Stuck in Summoner's
  // Sanctum) - same cross-battlefield attach lookup as runUntapStep's
  // attachedPreventsUntap, since an Aura may be attached from either side.
  if (found.zone === 'battlefield' && state.players.some((p) => p.zones.battlefield.some((c) => c.attachedToInstanceId === instanceId && getCardDefinition(c.defId).attachedPreventsAbilities))) {
    return { ok: false, error: `${def.name}'s activated abilities can't be activated.` };
  }

  let next = state;
  if (!mutual && manaCost) next = updatePlayer(next, found.ownerPlayerId, (p) => ({ ...p, manaPool: payCost(p.manaPool, manaCost, 0) }));
  if (hojoDiscount > 0) next = updatePlayer(next, found.ownerPlayerId, (p) => ({ ...p, usedFirstOwnCreatureTargetingAbilityDiscountThisTurn: true }));
  if (ability.cost.payLife) next = loseLife(next, found.ownerPlayerId, ability.cost.payLife);
  if (ability.cost.tap) {
    next = updatePlayer(next, found.ownerPlayerId, (p) => ({
      ...p,
      zones: { ...p.zones, [found.zone]: p.zones[found.zone].map((c) => (c.instanceId === instanceId ? { ...c, tapped: true } : c)) },
    }));
  }
  if (tapAnotherTarget) {
    next = updatePlayer(next, found.ownerPlayerId, (p) => ({
      ...p,
      zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === tapAnotherTarget!.instanceId ? { ...c, tapped: true } : c)) },
    }));
  }
  if (ability.cost.sacrificeSelf) {
    next = updatePlayer(next, found.ownerPlayerId, (p) => ({
      ...p,
      zones: { ...p.zones, [found.zone]: p.zones[found.zone].filter((c) => c.instanceId !== instanceId), graveyard: [...p.zones.graveyard, { ...found.card, tapped: false }] },
    }));
    // "Whenever you sacrifice a Clue, ..." (Tireless Tracker) - checked
    // against every OTHER permanent the controller controls whenever a
    // sacrificeSelf-cost ability completes on a permanent matching the
    // watcher's own onControlledTokenSacrificed.tokenId.
    for (const watcher of getPlayer(next, found.ownerPlayerId).zones.battlefield) {
      const watcherDef = getCardDefinition(watcher.defId);
      const trigger = watcherDef.onControlledTokenSacrificed;
      if (!trigger || trigger.tokenId !== def.id) continue;
      next = updatePlayer(next, found.ownerPlayerId, (p) => ({
        ...p,
        zones: {
          ...p.zones,
          battlefield: p.zones.battlefield.map((c) => {
            if (c.instanceId !== watcher.instanceId) return c;
            const hasCounter = c.counters.some((ctr) => ctr.label === trigger.counterLabel);
            const counters = hasCounter
              ? c.counters.map((ctr) => (ctr.label === trigger.counterLabel ? { ...ctr, amount: ctr.amount + trigger.counterAmount } : ctr))
              : [...c.counters, { label: trigger.counterLabel, amount: trigger.counterAmount }];
            return { ...c, counters };
          }),
        },
      }));
      next = { ...next, log: [...next.log, `${watcherDef.name} gets a ${trigger.counterLabel} counter.`] };
    }
  }
  if (ability.cost.exileSelf) {
    next = updatePlayer(next, found.ownerPlayerId, (p) => ({
      ...p,
      zones: { ...p.zones, [found.zone]: p.zones[found.zone].filter((c) => c.instanceId !== instanceId), exile: [...p.zones.exile, { ...found.card, tapped: false }] },
    }));
  }
  if (ability.cost.removeCounterFromSelf) {
    const { label, amount = 1 } = ability.cost.removeCounterFromSelf;
    next = updatePlayer(next, found.ownerPlayerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        [found.zone]: p.zones[found.zone].map((c) =>
          c.instanceId === instanceId ? { ...c, counters: c.counters.map((ctr) => (ctr.label === label ? { ...ctr, amount: ctr.amount - amount } : ctr)).filter((ctr) => ctr.amount > 0) } : c
        ),
      },
    }));
  }
  if (counterRemovalTarget && counterRemovalLabel) {
    const removeInstanceId = counterRemovalTarget.instanceId;
    const removeLabel = counterRemovalLabel;
    next = updatePlayer(next, found.ownerPlayerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.map((c) =>
          c.instanceId === removeInstanceId
            ? { ...c, counters: c.counters.map((ctr) => (ctr.label === removeLabel ? { ...ctr, amount: ctr.amount - 1 } : ctr)).filter((ctr) => ctr.amount > 0) }
            : c
        ),
      },
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
  if (ability.cost.millSelf) {
    const milled = getPlayer(next, found.ownerPlayerId).zones.library.slice(0, ability.cost.millSelf);
    next = updatePlayer(next, found.ownerPlayerId, (p) => ({
      ...p,
      zones: { ...p.zones, library: p.zones.library.slice(ability.cost.millSelf), graveyard: [...p.zones.graveyard, ...milled] },
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

  // See types.ts: PlayHideawayCardEffect - factored out of this ability-only
  // path into a reusable CardEffect (also used by Fight Rigging's combat
  // trigger, which isn't an activated ability at all).
  let playHideawayLogLines: string[] = [];
  if (ability.playHideawayCard) {
    const resolved = resolveCardEffects(next, found.ownerPlayerId, [{ type: 'playHideawayCard' }], instanceId);
    next = resolved.state;
    playHideawayLogLines = resolved.logLines;
  }

  let effectLogLines: string[] = [...exileReturnLogLines, ...sacrificeTargetLogLines, ...transformIntoEffectLogLines, ...playHideawayLogLines];
  if (ability.effects && ability.effects.length > 0) {
    const resolved = resolveCardEffects(next, found.ownerPlayerId, ability.effects, instanceId);
    next = resolved.state;
    // Tags the pendingTarget this ability's own effects just armed (if
    // any) as having come from an ACTIVATED ABILITY specifically, not a
    // spell - see GameState.pendingTarget.fromActivatedAbility's own doc
    // comment, consumed by chooseTarget below for Professor Hojo's
    // "...become the target of an activated ability" trigger.
    if (next.pendingTarget) next = { ...next, pendingTarget: { ...next.pendingTarget, fromActivatedAbility: true } };
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

  // "Whenever an opponent activates an ability of an artifact they
  // control, [this] deals [amount] damage to that player." (Avalanche of
  // Sector 7) - checked against the ACTIVATING player's OPPONENT's
  // battlefield, only when the activated permanent is itself an artifact.
  if (def.type === 'artifact') {
    const activatorOpponent = getOpponent(next, found.ownerPlayerId);
    for (const watcher of activatorOpponent.zones.battlefield) {
      const watcherDef = getCardDefinition(watcher.defId);
      if (!watcherDef.onOpponentActivatesArtifactAbilityDealsDamage) continue;
      const amount = watcherDef.onOpponentActivatesArtifactAbilityDealsDamage * damageMultiplierFor(next, activatorOpponent.id, watcherDef);
      next = loseLife(next, found.ownerPlayerId, amount);
      effectLogLines = [...effectLogLines, `${watcherDef.name} triggers: ${owner.name} loses ${amount} life.`];
    }
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
    // "Metalcraft — Equipment you control have equip {0} as long as you
    // control three or more artifacts." (Puresteel Paladin) - overrides
    // the WHOLE cost to {0}, not a flat reduction.
    const hasMetalcraftZeroCost =
      owner.zones.battlefield.filter((c) => getCardDefinition(c.defId).type === 'artifact').length >= 3 &&
      owner.zones.battlefield.some((c) => getCardDefinition(c.defId).reducesEquipCostToZeroIfMetalcraftActive);
    if (hasMetalcraftZeroCost) parsed = { generic: 0, colors: {}, hasX: false };
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
    if (creature.phasedOut) return { ok: false, error: 'A phased-out creature cannot attack.' };
    if (creature.tapped) return { ok: false, error: 'A tapped creature cannot attack.' };
    if (creature.summoningSick) return { ok: false, error: "A creature with summoning sickness can't attack yet." };
    const def = getCardDefinition(creature.defId);
    if (!isEffectivelyCreature(def, creature)) return { ok: false, error: 'Only creatures can attack.' };
    if (isEffectivelyDefender(def, creature)) return { ok: false, error: `${def.name} has defender and can't attack.` };
    // "Can't attack you or planeswalkers you control for as long as it has
    // a vow counter on it" (Promise of Loyalty) - in this 2-player, no-
    // planeswalker engine, a creature with a Vow counter simply can't
    // attack at all (it only ever has one opponent it could attack anyway).
    if (creature.counters.some((c) => c.label === 'Vow' && c.amount > 0)) {
      return { ok: false, error: `${def.name} has a vow counter on it and can't attack.` };
    }
    // "...can't attack..." as part of an attached Aura's grant (Observed
    // Stasis) - checked against every permanent attached to this one.
    if (state.players.some((p) => p.zones.battlefield.some((c) => c.attachedToInstanceId === id && getCardDefinition(c.defId).attachedPreventsAttacking))) {
      return { ok: false, error: `${def.name} can't attack.` };
    }
  }

  // "Until your next turn, creatures can't attack you unless their
  // controller pays {2} for each of those creatures" (Summon: Yojimbo) -
  // summed across every such permanent the DEFENDER controls, then
  // multiplied by the number of attackers actually being declared (no tax
  // on declaring zero attackers). Pauses here on a payment prompt instead
  // of committing the attack, same shape as Ward's pendingWardPayment.
  if (instanceIds.length > 0) {
    const defender = getOpponent(state, playerId);
    const costPerCreature = defender.zones.battlefield.reduce(
      (sum, c) => sum + (c.attacksYouCostGenericUntilNextTurn ?? 0) + (getCardDefinition(c.defId).staticAttacksYouCostGeneric ?? 0),
      0
    );
    if (costPerCreature > 0) {
      const totalGeneric = costPerCreature * instanceIds.length;
      return { ok: true, state: { ...state, pendingAttackTaxPayment: { controllerId: playerId, instanceIds, totalGeneric } } };
    }
  }

  return finalizeDeclareAttackers(state, playerId, instanceIds);
}

/** Actually commits an attack declaration - tapping non-vigilance attackers,
 * setting combatAssignments/phase, and firing every onAttack-adjacent
 * trigger. Split out from declareAttackers so a Yojimbo-style attack tax can
 * pause on a payment prompt (see pendingAttackTaxPayment) and re-enter here
 * afterward with the SAME already-legality-checked instanceIds, without
 * re-running (or duplicating) the legality checks above. */
function finalizeDeclareAttackers(state: GameState, playerId: string, instanceIds: string[]): ActionResult {
  const player = getPlayer(state, playerId);
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

  // "Whenever you attack, creatures you control with counters on them gain
  // [keyword] until end of turn" (Chocobo Knights) - any nonzero attack
  // declaration (not just solo), granted to every creature the controller
  // has with at least one counter, attacking or not.
  if (instanceIds.length > 0) {
    const countersWatchers = getPlayer(next, playerId).zones.battlefield.filter((c) => getCardDefinition(c.defId).grantsKeywordToOwnCreaturesWithCountersOnAttack);
    for (const watcher of countersWatchers) {
      const keyword = getCardDefinition(watcher.defId).grantsKeywordToOwnCreaturesWithCountersOnAttack!;
      const matching = getPlayer(next, playerId).zones.battlefield.filter((c) => c.counters.length > 0 && getCardDefinition(c.defId).type === 'creature');
      for (const c of matching) {
        next = grantTemporaryKeyword(next, c.instanceId, keyword);
      }
      if (matching.length > 0) {
        next = { ...next, log: [...next.log, `${getCardDefinition(watcher.defId).name} triggers: creatures with counters gain ${keyword} until end of turn.`] };
      }
    }
  }

  // "Light Party — Whenever you attack with four or more creatures, [effects]."
  // / "Full Party — Whenever you attack with eight or more creatures, those
  // creatures get +X/+Y until end of turn." (Champions from Beyond) - both
  // checked against instanceIds.length (the number just declared), board-wide.
  if (instanceIds.length > 0) {
    for (const watcher of getPlayer(next, playerId).zones.battlefield) {
      const trigger = getCardDefinition(watcher.defId).onAttackWithAtLeastNCreatures;
      if (!trigger || instanceIds.length < trigger.minCount) continue;
      const resolved = resolveCardEffects(next, playerId, trigger.effects, watcher.instanceId);
      next = { ...resolved.state, log: [...resolved.state.log, ...resolved.logLines] };
    }
    for (const watcher of getPlayer(next, playerId).zones.battlefield) {
      const trigger = getCardDefinition(watcher.defId).pumpAllAttackersIfAttackedWithAtLeastNCreatures;
      if (!trigger || instanceIds.length < trigger.minCount) continue;
      for (const id of instanceIds) {
        next = applyTemporaryBuff(next, id, trigger.power, trigger.toughness);
      }
      next = { ...next, log: [...next.log, `${getCardDefinition(watcher.defId).name} triggers: attacking creatures get +${trigger.power}/+${trigger.toughness} until end of turn.`] };
    }
    // "Whenever you attack with one or more Birds, scry 2." (Hermes,
    // Overseer of Elpis) - the subtype-filtered cousin of
    // onAttackWithAtLeastNCreatures above.
    for (const watcher of getPlayer(next, playerId).zones.battlefield) {
      const trigger = getCardDefinition(watcher.defId).onAttackWithSubtype;
      if (!trigger) continue;
      const hasMatchingAttacker = instanceIds.some((id) => {
        const attacker = getPlayer(next, playerId).zones.battlefield.find((c) => c.instanceId === id);
        return !!attacker && getCardDefinition(attacker.defId).subtype?.toLowerCase().includes(trigger.subtype.toLowerCase());
      });
      if (!hasMatchingAttacker) continue;
      const resolved = resolveCardEffects(next, playerId, trigger.effects, watcher.instanceId);
      next = { ...resolved.state, log: [...resolved.state.log, ...resolved.logLines] };
    }
    // "Whenever your commander enters or attacks, [effects]." (Tome of
    // Legends) - the "attacks" half; see triggerCreatureEnterWatchers for
    // the "enters" half.
    const attackingOwner = getPlayer(next, playerId);
    if (attackingOwner.commanderDefId) {
      const hasCommanderAttacker = instanceIds.some((id) => {
        const attacker = attackingOwner.zones.battlefield.find((c) => c.instanceId === id);
        return !!attacker && frontFaceDefId(attacker.defId) === attackingOwner.commanderDefId;
      });
      if (hasCommanderAttacker) {
        for (const watcher of getPlayer(next, playerId).zones.battlefield) {
          const watcherDef = getCardDefinition(watcher.defId);
          if (!watcherDef.onCommanderEnterOrAttack || watcherDef.onCommanderEnterOrAttack.length === 0) continue;
          const resolved = resolveCardEffects(next, playerId, watcherDef.onCommanderEnterOrAttack, watcher.instanceId);
          next = { ...resolved.state, log: [...resolved.state.log, ...resolved.logLines] };
        }
      }
    }
  }

  // "Whenever you attack with one or more legendary creatures, you may pay
  // [manaCost]. If you do, return this card from your graveyard to the
  // battlefield tapped and attacking." (Interceptor, Shadow's Hound) -
  // checked against the GRAVEYARD (not the battlefield, unlike every
  // sibling attack-trigger above), since the card carrying this ability is
  // dead when it matters.
  if (instanceIds.length > 0) {
    const hasLegendaryAttacker = instanceIds.some((id) => {
      const attacker = getPlayer(next, playerId).zones.battlefield.find((c) => c.instanceId === id);
      return !!attacker && !!getCardDefinition(attacker.defId).subtype?.toLowerCase().includes('legendary');
    });
    if (hasLegendaryAttacker) {
      for (const gyCard of getPlayer(next, playerId).zones.graveyard) {
        const grant = getCardDefinition(gyCard.defId).onAttackWithLegendaryReturnSelfFromGraveyardTappedAndAttacking;
        if (!grant) continue;
        next = {
          ...next,
          pendingOptionalPayMana: { sourceInstanceId: gyCard.instanceId, controllerId: playerId, manaCost: grant.manaCost, effects: [{ type: 'returnSelfFromGraveyardTappedAndAttacking' }] },
        };
      }
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

    // "Islandwalk" (Chasm Skulker's Squid tokens) - can't be blocked as long
    // as the DEFENDING player controls a land named Island. Matched by card
    // NAME, same limitation as Fortified Village's check-land (this pool's
    // basics don't carry a real land-type/subtype field).
    if (
      assignment.blockerInstanceIds.length > 0 &&
      hasKeywordEffective(attackerDef, attackerCreature, 'islandwalk') &&
      blockerPlayer.zones.battlefield.some((c) => getCardDefinition(c.defId).name === 'Island')
    ) {
      return { ok: false, error: `${attackerDef.name} has islandwalk - it can't be blocked while you control an Island.` };
    }

    // "Nonbasic landwalk" (Trailblazer's Boots) - can't be blocked as long
    // as the defending player controls a NONBASIC land, same shape as
    // islandwalk just above but checked against land TYPE (not a specific
    // name) via the same basic-land-id list used for "nonbasic land"
    // targeting elsewhere in this engine.
    if (
      assignment.blockerInstanceIds.length > 0 &&
      (hasKeywordEffective(attackerDef, attackerCreature, 'nonbasic landwalk') ||
        hasEquipGrantedKeyword(state, attackerPlayer.id, attackerCreature.instanceId, 'nonbasic landwalk')) &&
      blockerPlayer.zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'land' && !['plains', 'island', 'swamp', 'mountain', 'forest'].includes(c.defId))
    ) {
      return { ok: false, error: `${attackerDef.name} has nonbasic landwalk - it can't be blocked while you control a nonbasic land.` };
    }

    for (const blockerId of assignment.blockerInstanceIds) {
      if (usedBlockers.has(blockerId)) return { ok: false, error: 'A creature cannot block more than one attacker.' };
      const blocker = blockerPlayer.zones.battlefield.find((c) => c.instanceId === blockerId);
      if (!blocker) return { ok: false, error: 'One of the chosen blockers is not on your battlefield.' };
      if (blocker.phasedOut) return { ok: false, error: 'A phased-out creature cannot block.' };
      if (blocker.tapped) return { ok: false, error: 'A tapped creature cannot block.' };
      // "Up to three target creatures can't block this turn." (Summon:
      // Kujata's chapter II) - a plain per-instance grant, unconditional.
      if (blocker.temporaryCantBlock) return { ok: false, error: `${getCardDefinition(blocker.defId).name} can't block this turn.` };
      // "...or block." (Observed Stasis, continuing attachedPreventsAttacking) -
      // checked against every permanent attached to this blocker.
      if (state.players.some((p) => p.zones.battlefield.some((c) => c.attachedToInstanceId === blockerId && getCardDefinition(c.defId).attachedPreventsBlocking))) {
        return { ok: false, error: `${getCardDefinition(blocker.defId).name} can't block.` };
      }
      const blockerDef = getCardDefinition(blocker.defId);
      // "Equipped creature ... loses flying" (Colossus Hammer) - checked
      // before the normal flying sources below, since it overrides the
      // creature's own printed flying outright.
      const attackerEquipRemovesFlying = attackerPlayer.zones.battlefield.some(
        (c) => c.attachedToInstanceId === attackerCreature.instanceId && getCardDefinition(c.defId).equipRemovesKeyword === 'flying'
      );
      const attackerHasFlying =
        !attackerEquipRemovesFlying &&
        (hasKeyword(attackerDef, 'flying') ||
          hasEquipGrantedKeywordDuringOwnTurn(state, attackerPlayer.id, attackerCreature.instanceId, 'flying') ||
          hasSelfGrantedKeywordDuringOwnTurn(state, attackerPlayer.id, attackerDef, 'flying'));
      const blockerHasFlyingOrReach =
        hasKeyword(blockerDef, 'flying') ||
        hasKeyword(blockerDef, 'reach') ||
        hasBoardGrantedKeyword(state, blockerPlayer.id, blocker, blockerDef, 'reach') ||
        hasEquipGrantedKeywordDuringOwnTurn(state, blockerPlayer.id, blocker.instanceId, 'flying') ||
        hasSelfGrantedKeywordDuringOwnTurn(state, blockerPlayer.id, blockerDef, 'flying');
      if (attackerHasFlying && !blockerHasFlyingOrReach) {
        return { ok: false, error: `${blockerDef.name} can't block a flying creature (no flying/reach).` };
      }
      // "Intimidate" (Sepulchral Primordial) - can't be blocked except by
      // artifact creatures and/or creatures that share a color with it.
      // Checked per-blocker (unlike islandwalk/landwalk's once-per-attacker
      // checks above), since some of several blockers might qualify while
      // others don't.
      if (hasKeyword(attackerDef, 'intimidate') || hasBoardGrantedKeyword(state, attackerPlayer.id, attackerCreature, attackerDef, 'intimidate')) {
        const blockerIsArtifactCreature = !!blockerDef.subtype?.toLowerCase().includes('artifact');
        const attackerColorPips = parseCostLabel(attackerDef.costLabel).colors;
        const blockerColorPips = parseCostLabel(blockerDef.costLabel).colors;
        const attackerColors = (Object.keys(attackerColorPips) as Exclude<ManaColor, 'C'>[]).filter((c) => (attackerColorPips[c] ?? 0) > 0);
        const blockerColors = (Object.keys(blockerColorPips) as Exclude<ManaColor, 'C'>[]).filter((c) => (blockerColorPips[c] ?? 0) > 0);
        const sharesColor = attackerColors.some((c) => blockerColors.includes(c));
        if (!blockerIsArtifactCreature && !sharesColor) {
          return { ok: false, error: `${blockerDef.name} can't block ${attackerDef.name} (intimidate - not an artifact creature and shares no color).` };
        }
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

/** "Ninjutsu [cost]" (Yuffie, Materia Hunter) - "[cost], Return an unblocked
 * attacker you control to hand: Put this card onto the battlefield from
 * your hand tapped and attacking." Legal once blocks are declared and
 * combat damage hasn't resolved yet (this engine jumps straight to
 * phase: 'combat_damage' the instant blocks are in - see declareBlockers
 * above - and only actually resolves damage once both players ready up),
 * same window Instant-speed responses use elsewhere in this engine. */
function activateNinjutsu(state: GameState, playerId: string, instanceId: string, returnInstanceId: string): ActionResult {
  if (state.phase !== 'combat_damage') return { ok: false, error: 'Ninjutsu can only be activated after blockers are declared, before damage resolves.' };
  if (state.activePlayerId !== playerId) return { ok: false, error: 'Only the attacking player can activate Ninjutsu.' };

  const player = getPlayer(state, playerId);
  const card = player.zones.hand.find((c) => c.instanceId === instanceId);
  if (!card) return { ok: false, error: 'That card is not in your hand.' };
  const def = getCardDefinition(card.defId);
  if (!def.ninjutsu) return { ok: false, error: `${def.name} has no Ninjutsu ability.` };

  const returning = player.zones.battlefield.find((c) => c.instanceId === returnInstanceId);
  if (!returning || !state.declaredAttackers.includes(returnInstanceId)) {
    return { ok: false, error: 'That is not one of your attacking creatures.' };
  }
  const assignment = state.combatAssignments.find((a) => a.attackerInstanceId === returnInstanceId);
  if (assignment && assignment.blockerInstanceIds.length > 0) {
    return { ok: false, error: `${getCardDefinition(returning.defId).name} is blocked - Ninjutsu needs an UNBLOCKED attacker.` };
  }

  const mutual = isMutualActive(state);
  const parsed = parseCostLabel(def.ninjutsu.cost);
  if (!mutual && !canPay(player.manaPool, parsed, 0)) {
    return { ok: false, error: `Not enough mana for Ninjutsu (${def.ninjutsu.cost}).` };
  }

  let next = state;
  if (!mutual) next = updatePlayer(next, playerId, (p) => ({ ...p, manaPool: payCost(p.manaPool, parsed, 0) }));
  next = updatePlayer(next, playerId, (p) => ({
    ...p,
    zones: {
      ...p.zones,
      hand: p.zones.hand.filter((c) => c.instanceId !== instanceId),
      battlefield: p.zones.battlefield.filter((c) => c.instanceId !== returnInstanceId),
    },
  }));
  next = updatePlayer(next, returning.ownerId, (p) => ({ ...p, zones: { ...p.zones, hand: [...p.zones.hand, { ...returning, tapped: false, attachedToInstanceId: undefined, damageMarked: 0 }] } }));

  const movedCard = stripSagaProgress({ ...card, tapped: true, damageMarked: 0, summoningSick: false });
  next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, battlefield: [...p.zones.battlefield, movedCard] } }));
  next = checkLegendRule(next, playerId);
  next = {
    ...next,
    declaredAttackers: [...next.declaredAttackers.filter((id) => id !== returnInstanceId), movedCard.instanceId],
    combatAssignments: [...next.combatAssignments.filter((a) => a.attackerInstanceId !== returnInstanceId), { attackerInstanceId: movedCard.instanceId, blockerInstanceIds: [] }],
  };

  let effectLogLines: string[] = [];
  if (def.onEnter && def.onEnter.length > 0) {
    const resolved = resolveCardEffects(next, playerId, def.onEnter, movedCard.instanceId);
    next = resolved.state;
    effectLogLines = resolved.logLines;
  }
  const creatureWatchResult = triggerCreatureEnterWatchers(next, playerId, movedCard.instanceId);
  next = creatureWatchResult.state;
  effectLogLines = [...effectLogLines, ...creatureWatchResult.logLines];

  const actor = getPlayer(next, playerId);
  return {
    ok: true,
    state: {
      ...next,
      log: [...next.log, `${actor.name} uses Ninjutsu: returns ${getCardDefinition(returning.defId).name} to hand, putting ${def.name} onto the battlefield tapped and attacking.`, ...effectLogLines],
    },
  };
}

function chooseTargetResolve(state: GameState, playerId: string, targetInstanceId: string | null, wardPaid = false, targetPlayerId?: string): ActionResult {
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
      let otherLethal = !!damagedOther && damagedOther.damageMarked >= effectiveToughness(otherDef, damagedOther, next, otherFound.ownerPlayerId);
      if (otherLethal && damagedOther) {
        const survives = checkIndestructibleOrShielded(next, targetInstanceId, otherDef, damagedOther, otherFound.ownerPlayerId);
        next = survives.state;
        otherLethal = !survives.survives;
      }
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
    let selfLethal = !!damagedSource && damagedSource.damageMarked >= effectiveToughness(sourceDef, damagedSource, next, sourceFound.ownerPlayerId);
    if (selfLethal && damagedSource) {
      const survives = checkIndestructibleOrShielded(next, pending.firstInstanceId, sourceDef, damagedSource, sourceFound.ownerPlayerId);
      next = survives.state;
      selfLethal = !survives.survives;
    }
    if (selfLethal) {
      const lethalResult = moveCreaturesToGraveyardAndTrigger(next, [pending.firstInstanceId], 'dies');
      next = { ...lethalResult.state, log: [...lethalResult.state.log, ...lethalResult.logLines] };
    }

    next = { ...next, pendingTarget: null };
    return { ok: true, state: { ...next, log: [...next.log, ...logLines] } };
  }

  if (pending.effect.type === 'damageAnyTarget') {
    // Fixed amount, single step, source is always the permanent whose
    // ability this is - the simpler cousin of dealDamageToAnyOtherTargetAndSelf
    // just above (no source pick, no self-damage, no "other than" restriction).
    const sourceFound = findCardAnywhere(state, pending.sourceInstanceId);
    if (!sourceFound || sourceFound.zone !== 'battlefield') return { ok: false, error: 'The source is no longer available.' };
    const sourceDef = getCardDefinition(sourceFound.card.defId);
    const amount = pending.effect.amount;
    let next = state;

    if (targetPlayerId) {
      if (!state.players.some((p) => p.id === targetPlayerId)) return { ok: false, error: 'That is not a legal player target.' };
      next = loseLife(next, targetPlayerId, amount);
      next = { ...next, pendingTarget: null, log: [...next.log, `${sourceDef.name} deals ${amount} damage to ${getPlayer(next, targetPlayerId).name}.`] };
      return { ok: true, state: next };
    }

    if (targetInstanceId === null) return { ok: false, error: 'You must choose a creature or a player.' };
    const otherFound = findCardAnywhere(next, targetInstanceId);
    if (!otherFound || otherFound.zone !== 'battlefield') return { ok: false, error: "That's not a legal target - it must be a creature or a player." };
    const otherDef = getCardDefinition(otherFound.card.defId);
    if (otherDef.type !== 'creature') return { ok: false, error: "That's not a legal target - it must be a creature or a player." };
    next = updatePlayer(next, otherFound.ownerPlayerId, (p) => ({
      ...p,
      zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === targetInstanceId ? { ...c, damageMarked: c.damageMarked + amount } : c)) },
    }));
    const logLines = [`${sourceDef.name} deals ${amount} damage to ${otherDef.name}.`];
    const damagedOther = getPlayer(next, otherFound.ownerPlayerId).zones.battlefield.find((c) => c.instanceId === targetInstanceId);
    let otherLethal = !!damagedOther && damagedOther.damageMarked >= effectiveToughness(otherDef, damagedOther, next, otherFound.ownerPlayerId);
    if (otherLethal && damagedOther) {
      const survives = checkIndestructibleOrShielded(next, targetInstanceId, otherDef, damagedOther, otherFound.ownerPlayerId);
      next = survives.state;
      otherLethal = !survives.survives;
    }
    if (otherLethal) {
      const lethalResult = moveCreaturesToGraveyardAndTrigger(next, [targetInstanceId], 'dies');
      next = { ...lethalResult.state, log: [...lethalResult.state.log, ...lethalResult.logLines] };
    }
    next = { ...next, pendingTarget: null, log: [...next.log, ...logLines] };
    return { ok: true, state: next };
  }

  if (pending.effect.type === 'destroyUpToOneOpponentArtifactThenPutCounterOnSelf') {
    // A top-level special case, not part of the generic isOptional list
    // below - declining (or there being no artifact to destroy) still has
    // to put the counter on Wakka, which the generic decline path (just
    // clears pendingTarget and does nothing else) doesn't do.
    const { counterLabel, counterAmount } = pending.effect;
    let next = state;
    const logLines: string[] = [];
    if (targetInstanceId !== null) {
      const found = findCardAnywhere(state, targetInstanceId);
      if (!found || found.zone !== 'battlefield') return { ok: false, error: "That's not a legal target - it must be an artifact." };
      const targetDef = getCardDefinition(found.card.defId);
      if (targetDef.type !== 'artifact' || found.ownerPlayerId === playerId) {
        return { ok: false, error: `${targetDef.name} is not a legal target - it must be an artifact an opponent controls.` };
      }
      const survives = checkIndestructibleOrShielded(next, targetInstanceId, targetDef, found.card, found.ownerPlayerId);
      next = survives.state;
      if (!survives.survives) {
        const destroyResult = moveCreaturesToGraveyardAndTrigger(next, [targetInstanceId], 'is destroyed');
        next = destroyResult.state;
        logLines.push(...destroyResult.logLines);
      } else {
        logLines.push(`${targetDef.name} survives.`);
      }
    }
    const resolved = resolveCardEffects(next, playerId, [{ type: 'putCounterOnSelf', counterLabel, counterAmount }], pending.sourceInstanceId);
    next = resolved.state;
    logLines.push(...resolved.logLines);
    next = updatePlayer(next, playerId, (p) => ({
      ...p,
      zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === pending.sourceInstanceId ? { ...c, counterPutOnSelfThisTurn: true } : c)) },
    }));
    next = { ...next, pendingTarget: null };
    return { ok: true, state: { ...next, log: [...next.log, ...logLines] } };
  }

  if (pending.effect.type === 'grantOnDeathReturnToHandToTarget') {
    if (targetInstanceId === null) return { ok: false, error: 'You must choose a creature with a counter on it.' };
    const found = findCardAnywhere(state, targetInstanceId);
    if (!found || found.zone !== 'battlefield') return { ok: false, error: "That's not a legal target - it must be a creature with a counter on it." };
    const targetDef = getCardDefinition(found.card.defId);
    if (targetDef.type !== 'creature' || found.card.counters.length === 0) {
      return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature with a counter on it.` };
    }
    const next = updatePlayer(state, found.ownerPlayerId, (p) => ({
      ...p,
      zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === targetInstanceId ? { ...c, temporaryOnDeathReturnToHand: true } : c)) },
    }));
    const actor = getPlayer(next, playerId);
    return {
      ok: true,
      state: { ...next, pendingTarget: null, log: [...next.log, `${actor.name} binds ${targetDef.name}'s fate - if it dies this turn, it returns to its owner's hand.`] },
    };
  }

  if (pending.effect.type === 'ronsoRage') {
    // A top-level special case, not the generic found/targetDef fallback -
    // tapping transitions into pendingOptionalBecomeCopy instead of just
    // clearing pendingTarget, so it needs its own full resolution here.
    if (targetInstanceId === null) return { ok: false, error: 'You must choose a creature an opponent controls.' };
    const found = findCardAnywhere(state, targetInstanceId);
    if (!found || found.zone !== 'battlefield' || found.ownerPlayerId === playerId) {
      return { ok: false, error: 'You must choose a creature an opponent controls.' };
    }
    const targetDef = getCardDefinition(found.card.defId);
    if (targetDef.type !== 'creature') return { ok: false, error: 'You must choose a creature an opponent controls.' };
    let next = updatePlayer(state, found.ownerPlayerId, (p) => ({
      ...p,
      zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === targetInstanceId ? { ...c, tapped: true } : c)) },
    }));
    const actor = getPlayer(next, playerId);
    next = {
      ...next,
      pendingTarget: null,
      pendingOptionalBecomeCopy: { sourceInstanceId: pending.sourceInstanceId, controllerId: playerId, copyDefId: targetDef.id },
      log: [...next.log, `${actor.name} taps ${targetDef.name}.`],
    };
    return { ok: true, state: next };
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
      (pending.effect.type === 'putCounterOnUpToOneOtherCreatureEqualToOwnPower' && !pending.effect.mandatory) ||
      pending.effect.type === 'tapStunAndGainLifeForNonbasicLands' ||
      (pending.effect.type === 'pumpUpToTwoTargets' && !!pending.firstInstanceId) ||
      (pending.effect.type === 'exileTargetPermanent' && pending.effect.upToTwo && !!pending.firstInstanceId) ||
      (pending.effect.type === 'damageTargetCreature' && pending.effect.upToTwo && !!pending.firstInstanceId) ||
      (pending.effect.type === 'grantCantBlockToUpToThreeTargets' && (pending.chosenInstanceIds?.length ?? 0) > 0) ||
      pending.effect.type === 'attachAllControlledEquipmentToTargetCreature' ||
      pending.effect.type === 'proliferate' ||
      pending.effect.type === 'tapUpToOneTargetCreatureAndStun' ||
      (pending.effect.type === 'putCounterOnUpToTwoOwnCreatures' && !!pending.firstInstanceId) ||
      (pending.effect.type === 'returnUpToTwoTargetPermanentsFromGraveyardToHand' && !!pending.firstInstanceId) ||
      pending.effect.type === 'moveCounterBetweenTargetCreatures' ||
      pending.effect.type === 'mayMoveAllCountersToTargetCreature' ||
      pending.effect.type === 'mayAttachTargetControlledEquipmentToSelf' ||
      pending.effect.type === 'destroyAnyNumberOfTappedCreaturesWithDifferentControllers' ||
      pending.effect.type === 'phaseOutAnyNumberOfTargetControlledNonlandPermanents' ||
      pending.effect.type === 'mayBecomeCopyOfAnotherControlledCreatureThenBuffBoth' ||
      pending.effect.type === 'jenovaCellsAttackTrigger' ||
      pending.effect.type === 'exileTargetInstantOrSorceryFromOpponentGraveyardThenMayCastForFixedCost' ||
      pending.effect.type === 'returnTargetCreatureFromGraveyardWithManaValueEqualTo' ||
      pending.effect.type === 'support';
    if (!isOptional) {
      return { ok: false, error: 'This ability requires a target.' };
    }
    const source = findCardAnywhere(state, pending.sourceInstanceId);
    const sourceName = source ? getCardDefinition(source.card.defId).name : 'This ability';
    // "Proliferate X times" (Tromell, Seymour's Butler) - finishing (declining)
    // one full proliferate pass starts the NEXT one fresh (alreadyChosen
    // reset) rather than clearing pendingTarget, as long as more remain.
    if (pending.effect.type === 'proliferate' && (pending.effect.remainingIterations ?? 0) > 1) {
      const nextEffect = { ...pending.effect, alreadyChosen: [], remainingIterations: pending.effect.remainingIterations! - 1 };
      return {
        ok: true,
        state: { ...state, pendingTarget: { ...pending, effect: nextEffect }, log: [...state.log, `${sourceName} finishes one Proliferate pass and starts another.`] },
      };
    }
    const declineNote = pending.effect.type === 'proliferate' ? `${sourceName} finishes proliferating.` : `${sourceName}'s optional target was declined.`;
    return { ok: true, state: { ...state, pendingTarget: null, log: [...state.log, declineNote] } };
  }

  // "Return one or two target permanent cards from your graveyard to your
  // hand" (Yuna's Decision) - a top-level special case, not the generic
  // battlefield-only `found`/`targetDef` a few lines down (this targets the
  // GRAVEYARD instead), same mandatory-first/optional-second two-step as
  // PumpUpToTwoTargetsEffect (see the isOptional whitelist above).
  if (pending.effect.type === 'returnUpToTwoTargetPermanentsFromGraveyardToHand') {
    if (targetInstanceId === pending.firstInstanceId) return { ok: false, error: 'The second card must be different from the first.' };
    const graveyardFound = findCardAnywhere(state, targetInstanceId);
    if (!graveyardFound || graveyardFound.zone !== 'graveyard' || graveyardFound.ownerPlayerId !== playerId) {
      return { ok: false, error: "That's not a legal target - it must be a permanent card in your own graveyard." };
    }
    const graveyardTargetDef = getCardDefinition(graveyardFound.card.defId);
    if (graveyardTargetDef.type !== 'creature' && graveyardTargetDef.type !== 'artifact' && graveyardTargetDef.type !== 'enchantment' && graveyardTargetDef.type !== 'land') {
      return { ok: false, error: `${graveyardTargetDef.name} is not a legal target - it must be a permanent card.` };
    }
    let next = updatePlayer(state, playerId, (p) => ({
      ...p,
      zones: { ...p.zones, graveyard: p.zones.graveyard.filter((c) => c.instanceId !== targetInstanceId), hand: [...p.zones.hand, graveyardFound.card] },
    }));
    const actor = getPlayer(next, playerId);
    next = {
      ...next,
      pendingTarget: pending.firstInstanceId ? null : { ...pending, firstInstanceId: targetInstanceId },
      log: [...next.log, `${actor.name} returns ${graveyardTargetDef.name} from their graveyard to hand.`],
    };
    return { ok: true, state: next };
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
        hasBoardGrantedKeyword(state, hexproofCheckTarget.ownerPlayerId, hexproofCheckTarget.card, hexproofTargetDef, 'hexproof') ||
        hasEquipGrantedKeyword(state, hexproofCheckTarget.ownerPlayerId, hexproofCheckTarget.card.instanceId, 'hexproof');
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

  if (pending.effect.type === 'putCounterOnTargetOwnCreatureThenMayPlayHideawayIfCreaturePowerAtLeast') {
    const owner = getPlayer(state, playerId);
    const target = owner.zones.battlefield.find((c) => c.instanceId === targetInstanceId);
    if (!target || getCardDefinition(target.defId).type !== 'creature') {
      return { ok: false, error: "That's not a legal target - it must be a creature you control." };
    }

    const { counterLabel, minPower } = pending.effect;
    const counterAmount = hardenedScalesAdjustedAmount(state, playerId, counterLabel, pending.effect.counterAmount);
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
          return { ...c, counters };
        }),
      },
    }));
    const sideEffects = applyCounterPlacementSideEffects(next, playerId, targetInstanceId, counterLabel);
    next = sideEffects.state;
    next = { ...next, pendingTarget: null };

    const targetDef = getCardDefinition(target.defId);
    const sourceFound = findCardAnywhere(next, pending.sourceInstanceId)!;
    const sourceName = getCardDefinition(sourceFound.card.defId).name;
    const logLines = [`${sourceName} puts a ${counterLabel} counter on ${targetDef.name}.`, ...sideEffects.logLines];

    // "Then if you control a creature with power 7 or greater, you may play
    // the exiled card..." - checked AFTER the counter above, so the
    // just-countered creature's own new power counts.
    const hasBigCreature = getPlayer(next, playerId).zones.battlefield.some(
      (c) => getCardDefinition(c.defId).type === 'creature' && effectivePower(getCardDefinition(c.defId), c, next, playerId) >= minPower
    );
    if (hasBigCreature) {
      next = { ...next, pendingMayEffect: { sourceInstanceId: pending.sourceInstanceId, controllerId: playerId, effects: [{ type: 'playHideawayCard' }] } };
    }

    return { ok: true, state: { ...next, log: [...next.log, ...logLines] } };
  }

  if (pending.effect.type === 'grantPreventCombatDamageConvertToCounterToTargetOwnCreature') {
    const owner = getPlayer(state, playerId);
    const target = owner.zones.battlefield.find((c) => c.instanceId === targetInstanceId);
    if (!target || getCardDefinition(target.defId).type !== 'creature') {
      return { ok: false, error: "That's not a legal target - it must be a creature you control." };
    }

    const { counterLabel } = pending.effect;
    let next = updatePlayer(state, playerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.map((c) =>
          c.instanceId === targetInstanceId ? { ...c, temporaryPreventCombatDamageConvertToCounterLabel: counterLabel } : c
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
          `${sourceName} targets ${targetDef.name}, which will convert combat damage into ${counterLabel} counters until end of turn.`,
        ],
      },
    };
  }

  if (pending.effect.type === 'mayMoveAllCountersToTargetCreature') {
    const { counterLabel } = pending.effect;
    const sourceFound = findCardAnywhere(state, pending.sourceInstanceId);
    const targetFound = findCardAnywhere(state, targetInstanceId);
    if (!sourceFound || sourceFound.zone !== 'battlefield') return { ok: false, error: "The source is no longer on the battlefield." };
    if (targetInstanceId === pending.sourceInstanceId) return { ok: false, error: 'The target must be a different creature.' };
    if (!targetFound || targetFound.zone !== 'battlefield' || getCardDefinition(targetFound.card.defId).type !== 'creature') {
      return { ok: false, error: "That's not a legal target - it must be a creature." };
    }
    const amount = sourceFound.card.counters.find((ctr) => ctr.label === counterLabel)?.amount ?? 0;
    if (amount <= 0) return { ok: false, error: `${getCardDefinition(sourceFound.card.defId).name} has no ${counterLabel} counters to move.` };

    const removeFromSource = (c: CardInstance): CardInstance =>
      c.instanceId === pending.sourceInstanceId ? { ...c, counters: c.counters.filter((ctr) => ctr.label !== counterLabel) } : c;
    const addToTarget = (c: CardInstance): CardInstance => {
      if (c.instanceId !== targetInstanceId) return c;
      const hasCounter = c.counters.some((ctr) => ctr.label === counterLabel);
      const counters = hasCounter
        ? c.counters.map((ctr) => (ctr.label === counterLabel ? { ...ctr, amount: ctr.amount + amount } : ctr))
        : [...c.counters, { label: counterLabel, amount }];
      return { ...c, counters };
    };
    let next = {
      ...state,
      players: state.players.map((p) => ({
        ...p,
        zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => addToTarget(removeFromSource(c))) },
      })) as GameState['players'],
    };
    next = { ...next, pendingTarget: null };

    const sourceName = getCardDefinition(sourceFound.card.defId).name;
    const targetName = getCardDefinition(targetFound.card.defId).name;
    return {
      ok: true,
      state: { ...next, log: [...next.log, `${sourceName} moves ${amount} ${counterLabel} counter(s) onto ${targetName}.`] },
    };
  }

  if (pending.effect.type === 'exileTargetInstantOrSorceryFromOpponentGraveyardThenMayCastForFixedCost') {
    const graveyardFound = findCardAnywhere(state, targetInstanceId);
    if (!graveyardFound || graveyardFound.zone !== 'graveyard' || graveyardFound.ownerPlayerId === playerId) {
      return { ok: false, error: "That's not a legal target - it must be an instant or sorcery card in an opponent's graveyard." };
    }
    const graveyardTargetDef = getCardDefinition(graveyardFound.card.defId);
    if (graveyardTargetDef.type !== 'instant' && graveyardTargetDef.type !== 'sorcery') {
      return { ok: false, error: `${graveyardTargetDef.name} is not a legal target - it must be an instant or sorcery card.` };
    }
    let next = updatePlayer(state, graveyardFound.ownerPlayerId, (p) => ({
      ...p,
      zones: { ...p.zones, graveyard: p.zones.graveyard.filter((c) => c.instanceId !== targetInstanceId), exile: [...p.zones.exile, graveyardFound.card] },
    }));
    next = {
      ...next,
      pendingTarget: null,
      exilePlayGrants: [...next.exilePlayGrants, { instanceId: targetInstanceId, playerId, overrideCostLabel: pending.effect.fixedCost, expiresAtCleanup: true }],
    };
    const actor = getPlayer(next, playerId);
    return {
      ok: true,
      state: { ...next, log: [...next.log, `${actor.name} exiles ${graveyardTargetDef.name} and copies it - the copy may be cast by paying ${pending.effect.fixedCost}.`] },
    };
  }

  if (pending.effect.type === 'returnTargetCreatureFromGraveyardWithManaValueEqualTo') {
    const graveyardFound = findCardAnywhere(state, targetInstanceId);
    if (!graveyardFound || graveyardFound.zone !== 'graveyard' || graveyardFound.ownerPlayerId !== playerId) {
      return { ok: false, error: "That's not a legal target - it must be a creature card in your own graveyard." };
    }
    const graveyardTargetDef = getCardDefinition(graveyardFound.card.defId);
    if (graveyardTargetDef.type !== 'creature') return { ok: false, error: `${graveyardTargetDef.name} is not a legal target - it must be a creature card.` };
    if (manaValue(parseCostLabel(graveyardTargetDef.costLabel)) !== pending.effect.manaValue) {
      return { ok: false, error: `${graveyardTargetDef.name} is not a legal target - its mana value must be exactly ${pending.effect.manaValue}.` };
    }
    let next = updatePlayer(state, playerId, (p) => ({
      ...p,
      zones: { ...p.zones, graveyard: p.zones.graveyard.filter((c) => c.instanceId !== targetInstanceId), hand: [...p.zones.hand, graveyardFound.card] },
    }));
    next = { ...next, pendingTarget: null };
    const actor = getPlayer(next, playerId);
    return { ok: true, state: { ...next, log: [...next.log, `${actor.name} returns ${graveyardTargetDef.name} from their graveyard to their hand.`] } };
  }

  const found = findCardAnywhere(state, targetInstanceId);
  if (!found || found.zone !== 'battlefield') return { ok: false, error: "That's not a legal target - it must be a permanent on the battlefield." };
  const targetDef = getCardDefinition(found.card.defId);

  if (pending.effect.type === 'exileTargetOpponentCreatureUntilSourceLeaves') {
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    if (found.ownerPlayerId === playerId) return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature an opponent controls.` };
    const sourceFound = findCardAnywhere(state, pending.sourceInstanceId);
    const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'This Saga';
    let next = detachEverythingFrom(state, targetInstanceId);
    next = updatePlayer(next, found.ownerPlayerId, (p) => ({ ...p, zones: { ...p.zones, battlefield: p.zones.battlefield.filter((c) => c.instanceId !== targetInstanceId) } }));
    next = updatePlayer(next, found.ownerPlayerId, (p) => ({ ...p, zones: { ...p.zones, exile: [...p.zones.exile, found.card] } }));
    next = {
      ...next,
      pendingTarget: null,
      exileUntilSourceLeaves: [...next.exileUntilSourceLeaves, { sourceInstanceId: pending.sourceInstanceId, exiledInstanceId: targetInstanceId }],
    };
    return { ok: true, state: { ...next, log: [...next.log, `${sourceName} exiles ${targetDef.name} until it leaves the battlefield.`] } };
  }

  if (pending.effect.type === 'tapUpToOneTargetCreatureAndStun') {
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    const existingStun = found.card.counters.find((c) => c.label === 'Stun')?.amount ?? 0;
    let next = updatePlayer(state, found.ownerPlayerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.map((c) =>
          c.instanceId === targetInstanceId ? { ...c, tapped: true, counters: [...c.counters.filter((ctr) => ctr.label !== 'Stun'), { label: 'Stun', amount: existingStun + 1 }] } : c
        ),
      },
    }));
    next = { ...next, pendingTarget: null };
    const actor = getPlayer(next, playerId);
    return { ok: true, state: { ...next, log: [...next.log, `${actor.name} taps ${targetDef.name} and puts a Stun counter on it.`] } };
  }

  if (pending.effect.type === 'putCounterOnUpToTwoOwnCreatures') {
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    if (found.ownerPlayerId !== playerId) return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature you control.` };
    if (targetInstanceId === pending.firstInstanceId) return { ok: false, error: 'The second target must be a different creature.' };
    const { counterLabel, counterAmount } = pending.effect;
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
          return { ...c, counters };
        }),
      },
    }));
    const actor = getPlayer(next, playerId);
    next = {
      ...next,
      pendingTarget: pending.firstInstanceId ? null : { ...pending, firstInstanceId: targetInstanceId },
      log: [...next.log, `${actor.name} puts a ${counterLabel} counter on ${targetDef.name}.`],
    };
    return { ok: true, state: next };
  }

  if (pending.effect.type === 'support') {
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    if (pending.effect.excludeSelf && targetInstanceId === pending.sourceInstanceId) {
      return { ok: false, error: `${targetDef.name} is not a legal target - it must be another creature.` };
    }
    if ((pending.chosenInstanceIds ?? []).includes(targetInstanceId)) {
      return { ok: false, error: 'You must choose a different creature for each pick.' };
    }
    const { counterLabel } = pending.effect;
    const counterAmount = hardenedScalesAdjustedAmount(state, found.ownerPlayerId, counterLabel, pending.effect.counterAmount);
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
    const remaining = (pending.remainingPicks ?? 1) - 1;
    const chosenInstanceIds = [...(pending.chosenInstanceIds ?? []), targetInstanceId];
    const actor = getPlayer(next, playerId);
    // See PlayerState.counterPutOnOwnCreatureThisTurn - only a handful of
    // the most common counter-adding effects set this.
    next = updatePlayer(next, playerId, (p) => ({ ...p, counterPutOnOwnCreatureThisTurn: true }));
    const sideEffects = applyCounterPlacementSideEffects(next, playerId, targetInstanceId, counterLabel);
    next = sideEffects.state;
    next = {
      ...next,
      pendingTarget: remaining > 0 ? { ...pending, remainingPicks: remaining, chosenInstanceIds } : null,
      log: [...next.log, `${actor.name} puts a ${counterLabel} counter on ${targetDef.name}.`, ...sideEffects.logLines],
    };
    return { ok: true, state: next };
  }

  if (pending.effect.type === 'moveCounterBetweenTargetCreatures') {
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    if (found.ownerPlayerId !== playerId) return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature you control.` };
    if (!pending.firstInstanceId) {
      if (found.card.counters.length === 0) return { ok: false, error: `${targetDef.name} is not a legal target - it must have a counter on it.` };
      return { ok: true, state: { ...state, pendingTarget: { ...pending, firstInstanceId: targetInstanceId } } };
    }
    if (targetInstanceId === pending.firstInstanceId) return { ok: false, error: 'The second target must be a different creature.' };
    const sourceFound = findCardAnywhere(state, pending.firstInstanceId);
    if (!sourceFound || sourceFound.zone !== 'battlefield' || sourceFound.card.counters.length === 0) {
      return { ok: true, state: { ...state, pendingTarget: null, log: [...state.log, "The chosen counter is no longer there to move."] } };
    }
    const sourceDef = getCardDefinition(sourceFound.card.defId);
    // Auto-picks the counter type with the highest count if the source has
    // more than one kind - see MoveCounterBetweenTargetCreaturesEffect's own
    // comment for why this doesn't ask the controller to choose.
    const [counterToMove] = [...sourceFound.card.counters].sort((a, b) => b.amount - a.amount);
    let next = updatePlayer(state, sourceFound.ownerPlayerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.map((c) => {
          if (c.instanceId !== pending.firstInstanceId) return c;
          const counters = c.counters
            .map((ctr) => (ctr.label === counterToMove.label ? { ...ctr, amount: ctr.amount - 1 } : ctr))
            .filter((ctr) => ctr.amount > 0);
          return { ...c, counters };
        }),
      },
    }));
    next = updatePlayer(next, found.ownerPlayerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.map((c) => {
          if (c.instanceId !== targetInstanceId) return c;
          const hasCounter = c.counters.some((ctr) => ctr.label === counterToMove.label);
          const counters = hasCounter
            ? c.counters.map((ctr) => (ctr.label === counterToMove.label ? { ...ctr, amount: ctr.amount + 1 } : ctr))
            : [...c.counters, { label: counterToMove.label, amount: 1 }];
          return { ...c, counters };
        }),
      },
    }));
    const actor = getPlayer(next, playerId);
    next = { ...next, pendingTarget: null, log: [...next.log, `${actor.name} moves a ${counterToMove.label} counter from ${sourceDef.name} onto ${targetDef.name}.`] };
    return { ok: true, state: next };
  }

  if (pending.effect.type === 'moveAllCountersBetweenTargetPermanents') {
    if (found.ownerPlayerId !== playerId) return { ok: false, error: `${targetDef.name} is not a legal target - it must be a permanent you control.` };
    if (!pending.firstInstanceId) {
      if (found.card.counters.length === 0) return { ok: false, error: `${targetDef.name} is not a legal target - it must have a counter on it.` };
      return { ok: true, state: { ...state, pendingTarget: { ...pending, firstInstanceId: targetInstanceId } } };
    }
    if (targetInstanceId === pending.firstInstanceId) return { ok: false, error: 'The second target must be different from the first.' };
    const sourceFound = findCardAnywhere(state, pending.firstInstanceId);
    if (!sourceFound || sourceFound.zone !== 'battlefield' || sourceFound.card.counters.length === 0) {
      return { ok: true, state: { ...state, pendingTarget: null, log: [...state.log, "The chosen counter is no longer there to move."] } };
    }
    const sourceDef = getCardDefinition(sourceFound.card.defId);
    // Auto-picks the counter type with the highest count, then moves ALL of
    // it - see MoveAllCountersBetweenTargetPermanentsEffect's own comment.
    const [counterToMove] = [...sourceFound.card.counters].sort((a, b) => b.amount - a.amount);
    let next = updatePlayer(state, sourceFound.ownerPlayerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.map((c) =>
          c.instanceId !== pending.firstInstanceId ? c : { ...c, counters: c.counters.filter((ctr) => ctr.label !== counterToMove.label) }
        ),
      },
    }));
    next = updatePlayer(next, found.ownerPlayerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.map((c) => {
          if (c.instanceId !== targetInstanceId) return c;
          const hasCounter = c.counters.some((ctr) => ctr.label === counterToMove.label);
          const counters = hasCounter
            ? c.counters.map((ctr) => (ctr.label === counterToMove.label ? { ...ctr, amount: ctr.amount + counterToMove.amount } : ctr))
            : [...c.counters, { label: counterToMove.label, amount: counterToMove.amount }];
          return { ...c, counters };
        }),
      },
    }));
    const actor2 = getPlayer(next, playerId);
    next = {
      ...next,
      pendingTarget: null,
      log: [...next.log, `${actor2.name} moves ${counterToMove.amount} ${counterToMove.label} counter(s) from ${sourceDef.name} onto ${targetDef.name}.`],
    };
    return { ok: true, state: next };
  }

  if (pending.effect.type === 'moveOneCounterFromOwnPermanentToAnyPermanent') {
    if (!pending.firstInstanceId) {
      if (found.ownerPlayerId !== playerId) return { ok: false, error: `${targetDef.name} is not a legal target - it must be a permanent you control.` };
      if (found.card.counters.length === 0) return { ok: false, error: `${targetDef.name} is not a legal target - it must have a counter on it.` };
      return { ok: true, state: { ...state, pendingTarget: { ...pending, firstInstanceId: targetInstanceId } } };
    }
    // No ownership restriction on the second pick - either player's permanent.
    if (targetInstanceId === pending.firstInstanceId) return { ok: false, error: 'The second target must be different from the first.' };
    const sourceFound = findCardAnywhere(state, pending.firstInstanceId);
    if (!sourceFound || sourceFound.zone !== 'battlefield' || sourceFound.card.counters.length === 0) {
      return { ok: true, state: { ...state, pendingTarget: null, log: [...state.log, "The chosen counter is no longer there to move."] } };
    }
    const sourceDef = getCardDefinition(sourceFound.card.defId);
    const [counterToMove] = [...sourceFound.card.counters].sort((a, b) => b.amount - a.amount);
    let next = updatePlayer(state, sourceFound.ownerPlayerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.map((c) => {
          if (c.instanceId !== pending.firstInstanceId) return c;
          const counters = c.counters
            .map((ctr) => (ctr.label === counterToMove.label ? { ...ctr, amount: ctr.amount - 1 } : ctr))
            .filter((ctr) => ctr.amount > 0);
          return { ...c, counters };
        }),
      },
    }));
    next = updatePlayer(next, found.ownerPlayerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.map((c) => {
          if (c.instanceId !== targetInstanceId) return c;
          const hasCounter = c.counters.some((ctr) => ctr.label === counterToMove.label);
          const counters = hasCounter
            ? c.counters.map((ctr) => (ctr.label === counterToMove.label ? { ...ctr, amount: ctr.amount + 1 } : ctr))
            : [...c.counters, { label: counterToMove.label, amount: 1 }];
          return { ...c, counters };
        }),
      },
    }));
    const actor4 = getPlayer(next, playerId);
    next = { ...next, pendingTarget: null, log: [...next.log, `${actor4.name} moves a ${counterToMove.label} counter from ${sourceDef.name} onto ${targetDef.name}.`] };
    return { ok: true, state: next };
  }

  if (pending.effect.type === 'moveDeadPermanentCountersToTarget') {
    if (found.ownerPlayerId !== playerId) return { ok: false, error: `${targetDef.name} is not a legal target - it must be a permanent you control.` };
    const { counters: countersToMove } = pending.effect;
    let next = updatePlayer(state, playerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.map((c) => {
          if (c.instanceId !== targetInstanceId) return c;
          let counters = c.counters;
          for (const ctr of countersToMove) {
            const hasCounter = counters.some((x) => x.label === ctr.label);
            counters = hasCounter ? counters.map((x) => (x.label === ctr.label ? { ...x, amount: x.amount + ctr.amount } : x)) : [...counters, { ...ctr }];
          }
          return { ...c, counters };
        }),
      },
    }));
    next = { ...next, pendingTarget: null };
    const actor3 = getPlayer(next, playerId);
    const summary = countersToMove.map((c) => `${c.amount} ${c.label}`).join(', ');
    next = { ...next, log: [...next.log, `${actor3.name} puts ${summary} counter(s) onto ${targetDef.name}.`] };
    return { ok: true, state: next };
  }

  if (pending.effect.type === 'moveCounterFromOpponentCreatureToOwnCreature') {
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    if (!pending.firstInstanceId) {
      if (found.ownerPlayerId === playerId) return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature an opponent controls.` };
      if (found.card.counters.length === 0) return { ok: false, error: `${targetDef.name} is not a legal target - it must have a counter on it.` };
      return { ok: true, state: { ...state, pendingTarget: { ...pending, firstInstanceId: targetInstanceId } } };
    }
    if (found.ownerPlayerId !== playerId) return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature you control.` };
    const sourceFound = findCardAnywhere(state, pending.firstInstanceId);
    if (!sourceFound || sourceFound.zone !== 'battlefield' || sourceFound.card.counters.length === 0) {
      return { ok: true, state: { ...state, pendingTarget: null, log: [...state.log, "The chosen counter is no longer there to move."] } };
    }
    const sourceDef = getCardDefinition(sourceFound.card.defId);
    const [counterToMove] = [...sourceFound.card.counters].sort((a, b) => b.amount - a.amount);
    let next = updatePlayer(state, sourceFound.ownerPlayerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.map((c) => {
          if (c.instanceId !== pending.firstInstanceId) return c;
          const counters = c.counters
            .map((ctr) => (ctr.label === counterToMove.label ? { ...ctr, amount: ctr.amount - 1 } : ctr))
            .filter((ctr) => ctr.amount > 0);
          return { ...c, counters };
        }),
      },
    }));
    next = updatePlayer(next, found.ownerPlayerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.map((c) => {
          if (c.instanceId !== targetInstanceId) return c;
          const hasCounter = c.counters.some((ctr) => ctr.label === counterToMove.label);
          const counters = hasCounter
            ? c.counters.map((ctr) => (ctr.label === counterToMove.label ? { ...ctr, amount: ctr.amount + 1 } : ctr))
            : [...c.counters, { label: counterToMove.label, amount: 1 }];
          return { ...c, counters };
        }),
      },
    }));
    const actor2 = getPlayer(next, playerId);
    next = { ...next, pendingTarget: null, log: [...next.log, `${actor2.name} moves a ${counterToMove.label} counter from ${sourceDef.name} onto ${targetDef.name}.`] };
    return { ok: true, state: next };
  }

  if (pending.effect.type === 'sacrificeOwnCreatureThenDraw') {
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    if (found.ownerPlayerId !== playerId) return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature you control.` };
    const sacResult = moveCreaturesToGraveyardAndTrigger(state, [targetInstanceId], 'is sacrificed');
    let next: GameState = { ...sacResult.state, pendingTarget: null, log: [...sacResult.state.log, ...sacResult.logLines] };
    const actor = getPlayer(next, playerId);
    const drawn = actor.zones.library.slice(0, 1);
    next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(1), hand: [...p.zones.hand, ...drawn] } }));
    next = { ...next, log: [...next.log, `${actor.name} draws a card.`] };
    if (pending.effect.thenPutCreatureAndOrLandFromHand) {
      next = { ...next, pendingPutCreatureAndOrLandFromHand: { controllerId: playerId, stage: 'creature' } };
    }
    return { ok: true, state: next };
  }

  if (pending.effect.type === 'revealUntilCreatureThenPutCountersEqualToManaValue') {
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    if (found.ownerPlayerId !== playerId) return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature you control.` };
    const counterAmount = pending.effect.counterAmount ?? 0;
    let next = state;
    if (counterAmount > 0) {
      next = updatePlayer(state, playerId, (p) => ({
        ...p,
        zones: {
          ...p.zones,
          battlefield: p.zones.battlefield.map((c) => {
            if (c.instanceId !== targetInstanceId) return c;
            const existing = c.counters.find((ctr) => ctr.label === '+1/+1')?.amount ?? 0;
            return { ...c, counters: [...c.counters.filter((ctr) => ctr.label !== '+1/+1'), { label: '+1/+1', amount: existing + counterAmount }] };
          }),
        },
      }));
    }
    next = { ...next, pendingTarget: null };
    const actor = getPlayer(next, playerId);
    return { ok: true, state: { ...next, log: [...next.log, `${actor.name} puts ${counterAmount} +1/+1 counter(s) on ${targetDef.name}.`] } };
  }

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
      (pending.effect.targetFilter === 'creatureWithMinToughness' &&
        targetDef.type === 'creature' &&
        effectiveToughness(targetDef, found.card, state, found.ownerPlayerId) >= (pending.effect.minToughness ?? 0)) ||
      (pending.effect.targetFilter === 'artifactEnchantmentOrFlyingCreature' && (targetDef.type === 'artifact' || targetDef.type === 'enchantment' || isFlyingCreature)) ||
      (pending.effect.targetFilter === 'artifactOrEnchantment' && (targetDef.type === 'artifact' || targetDef.type === 'enchantment')) ||
      (pending.effect.targetFilter === 'enchantment' && targetDef.type === 'enchantment') ||
      (pending.effect.targetFilter === 'creatureWithDamageMarked' && targetDef.type === 'creature' && found.card.damageMarked > 0) ||
      (pending.effect.targetFilter === 'land' && targetDef.type === 'land') ||
      (pending.effect.targetFilter === 'creature' && targetDef.type === 'creature') ||
      (pending.effect.targetFilter === 'opponentArtifactOrLand' && (targetDef.type === 'artifact' || targetDef.type === 'land') && found.ownerPlayerId !== playerId) ||
      (pending.effect.targetFilter === 'tappedCreature' && targetDef.type === 'creature' && found.card.tapped) ||
      (pending.effect.targetFilter === 'opponentNonlandPermanent' && targetDef.type !== 'land' && found.ownerPlayerId !== playerId) ||
      (pending.effect.targetFilter === 'opponentNonbasicLand' && isNonbasicLand(targetDef) && found.ownerPlayerId !== playerId) ||
      (pending.effect.targetFilter === 'artifactOrCreature' && (targetDef.type === 'artifact' || targetDef.type === 'creature')) ||
      (pending.effect.targetFilter === 'creatureOrEnchantment' && (targetDef.type === 'creature' || targetDef.type === 'enchantment')) ||
      (pending.effect.targetFilter === 'opponentArtifact' && targetDef.type === 'artifact' && found.ownerPlayerId !== playerId) ||
      (pending.effect.targetFilter === 'nonblackCreature' && targetDef.type === 'creature' && !parseCostLabel(targetDef.costLabel).colors.B) ||
      (pending.effect.targetFilter === 'artifact' && targetDef.type === 'artifact');
    if (!matchesFilter) return { ok: false, error: `${targetDef.name} is not a legal target for this ability.` };

    // "Destroy target artifact, target creature, target enchantment, and
    // target land." (Decimate) - once the CURRENT filter resolves (destroyed
    // or survived), advances thenDestroyFilterQueue to the next filter with
    // a legal target anywhere, skipping any with none; every OTHER
    // destroyTarget card simply has no queue, so this is always null for them.
    const advanceDecimateQueue = (s: GameState): GameState['pendingTarget'] => {
      const queue = pending.effect.type === 'destroyTarget' ? pending.effect.thenDestroyFilterQueue : undefined;
      if (!queue || queue.length === 0) return null;
      const hasAnyOfType = (t: 'artifact' | 'creature' | 'enchantment' | 'land') => s.players.some((p) => p.zones.battlefield.some((c) => getCardDefinition(c.defId).type === t));
      const idx = queue.findIndex((t) => hasAnyOfType(t));
      if (idx === -1) return null;
      return { sourceInstanceId: pending.sourceInstanceId, controllerId: playerId, effect: { type: 'destroyTarget', targetFilter: queue[idx], thenDestroyFilterQueue: queue.slice(idx + 1) } };
    };

    const survives = checkIndestructibleOrShielded(state, targetInstanceId, targetDef, found.card, found.ownerPlayerId);
    if (survives.survives) {
      const next = { ...survives.state, pendingTarget: advanceDecimateQueue(survives.state) };
      const note = survives.via === 'shield' ? `${targetDef.name}'s shield counter is removed, preventing the destruction.` : `${targetDef.name} is indestructible and survives.`;
      return { ok: true, state: { ...next, log: [...next.log, note] } };
    }

    const destroyResult = moveCreaturesToGraveyardAndTrigger(survives.state, [targetInstanceId], 'is destroyed');
    let next: GameState = { ...destroyResult.state, pendingTarget: advanceDecimateQueue(destroyResult.state), log: [...destroyResult.state.log, ...destroyResult.logLines] };
    // "That land's controller may search... You may also search..."
    // (Demolition Field) - the destroyed land's controller (the opponent,
    // per 'opponentNonbasicLand' above) searches first; chainedSearchForPlayerId
    // arms the caster's own search once that one resolves.
    if (pending.effect.thenBothPlayersMaySearchBasicLandToBattlefield) {
      // Untapped - the printed text never says "tapped" (unlike most other
      // "search ... put onto the battlefield" effects in this pool).
      const searchResult = beginLibrarySearch(next, found.ownerPlayerId, pending.sourceInstanceId, { kind: 'basicLand' }, false, undefined, undefined, undefined, true);
      next = searchResult.state;
      next = { ...next, pendingLibrarySearch: next.pendingLibrarySearch ? { ...next.pendingLibrarySearch, chainedSearchForPlayerId: playerId } : null };
      next = { ...next, log: [...next.log, ...searchResult.logLines] };
      if (!next.pendingLibrarySearch) {
        // The opponent had nothing to find (beginLibrarySearch already
        // shuffled and resolved inline) - go straight to the caster's own
        // search instead of losing the chain.
        const ownSearchResult = beginLibrarySearch(next, playerId, pending.sourceInstanceId, { kind: 'basicLand' }, false, undefined, undefined, undefined, true);
        next = { ...ownSearchResult.state, log: [...ownSearchResult.state.log, ...ownSearchResult.logLines] };
      }
    }
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
    const grantKeywords = Array.isArray(grantKeyword) ? grantKeyword : grantKeyword ? [grantKeyword] : [];
    for (const kw of grantKeywords) next = grantTemporaryKeyword(next, targetInstanceId, kw);
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
    const keywordNote = grantKeywords.length > 0 ? ` and gains ${grantKeywords.join(' and ')}` : '';
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

  if (pending.effect.type === 'grantIndestructibleToTargetWhileSourceInPlay') {
    if (targetInstanceId === pending.sourceInstanceId) return { ok: false, error: 'You must target ANOTHER legendary permanent.' };
    if (!targetDef.subtype?.toLowerCase().includes('legendary')) return { ok: false, error: `${targetDef.name} is not a legal target - it must be legendary.` };
    if (found.ownerPlayerId !== playerId) return { ok: false, error: `${targetDef.name} is not a legal target - you must control it.` };
    let next = updatePlayer(state, playerId, (p) => ({
      ...p,
      zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === targetInstanceId ? { ...c, grantedIndestructibleWhileSourceInPlay: pending.sourceInstanceId } : c)) },
    }));
    next = { ...next, pendingTarget: null };
    const actor = getPlayer(next, playerId);
    const sourceName = getCardDefinition(findCardAnywhere(next, pending.sourceInstanceId)!.card.defId).name;
    return { ok: true, state: { ...next, log: [...next.log, `${actor.name} targets ${targetDef.name}: it gains indestructible for as long as they control ${sourceName}.`] } };
  }

  if (pending.effect.type === 'exileTargetCreatureUntilMonarchChanges') {
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    if (found.ownerPlayerId === playerId) return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature an opponent controls.` };
    let next = detachEverythingFrom(state, targetInstanceId);
    next = updatePlayer(next, found.ownerPlayerId, (p) => ({
      ...p,
      zones: { ...p.zones, battlefield: p.zones.battlefield.filter((c) => c.instanceId !== targetInstanceId), exile: [...p.zones.exile, { ...found.card, attachedToInstanceId: undefined, tapped: false }] },
    }));
    next = {
      ...next,
      pendingTarget: null,
      exileUntilMonarchChangesFrom: [...next.exileUntilMonarchChangesFrom, { exiledInstanceId: targetInstanceId, ownerPlayerId: found.ownerPlayerId, exilingControllerId: playerId }],
    };
    const actor = getPlayer(next, playerId);
    return { ok: true, state: { ...next, log: [...next.log, `${actor.name} exiles ${targetDef.name} until an opponent becomes the monarch.`] } };
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
    const { counterLabel } = pending.effect;
    const counterAmount = hardenedScalesAdjustedAmount(state, found.ownerPlayerId, counterLabel, pending.effect.counterAmount);
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
    // See PlayerState.counterPutOnOwnCreatureThisTurn - only a handful of
    // the most common counter-adding effects set this.
    next = { ...next, pendingTarget: null, players: next.players.map((p) => (p.id === playerId ? { ...p, counterPutOnOwnCreatureThisTurn: true } : p)) as GameState['players'] };
    const sideEffects = applyCounterPlacementSideEffects(next, playerId, targetInstanceId, counterLabel);
    next = sideEffects.state;
    const actor = getPlayer(next, playerId);
    return { ok: true, state: { ...next, log: [...next.log, `${actor.name} puts a ${counterLabel} counter on ${targetDef.name}.`, ...sideEffects.logLines] } };
  }

  if (pending.effect.type === 'jenovaCellsAttackTrigger') {
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    const { counterLabel } = pending.effect;
    let next = updatePlayer(state, found.ownerPlayerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.map((c) => {
          if (c.instanceId !== targetInstanceId) return c;
          const hasCounter = c.counters.some((ctr) => ctr.label === counterLabel);
          const counters = hasCounter
            ? c.counters.map((ctr) => (ctr.label === counterLabel ? { ...ctr, amount: ctr.amount + 1 } : ctr))
            : [...c.counters, { label: counterLabel, amount: 1 }];
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

  if (pending.effect.type === 'putCounterOnTargetCommanderEnteredThisTurn') {
    if (!isPlayersCommander(state, found.ownerPlayerId, found.card)) return { ok: false, error: `${targetDef.name} is not a legal target - it must be a commander.` };
    if (!found.card.summoningSick) return { ok: false, error: `${targetDef.name} is not a legal target - it must have entered the battlefield this turn.` };
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

  if (pending.effect.type === 'tapTargetThenExileIfMetalcraft') {
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target.` };
    const caster = getPlayer(state, playerId);
    const metalcraft = caster.zones.battlefield.filter((c) => getCardDefinition(c.defId).type === 'artifact').length >= 3;
    let next: GameState;
    let logLine: string;
    if (metalcraft) {
      next = updatePlayer(state, found.ownerPlayerId, (p) => ({
        ...p,
        zones: { ...p.zones, battlefield: p.zones.battlefield.filter((c) => c.instanceId !== targetInstanceId), exile: [...p.zones.exile, { ...found.card, tapped: false }] },
      }));
      logLine = `${caster.name}'s Metalcraft exiles ${targetDef.name}.`;
    } else {
      next = updatePlayer(state, found.ownerPlayerId, (p) => ({
        ...p,
        zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === targetInstanceId ? { ...c, tapped: true } : c)) },
      }));
      logLine = `${caster.name} taps ${targetDef.name}.`;
    }
    next = { ...next, pendingTarget: null };
    return { ok: true, state: { ...next, log: [...next.log, logLine] } };
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
    if (!pending.effect.allowAnyController && !pending.effect.opponentControlledOnly && found.ownerPlayerId !== playerId) return { ok: false, error: 'You must attach to a creature you control.' };
    if (pending.effect.opponentControlledOnly && found.ownerPlayerId === playerId) return { ok: false, error: 'You must attach to a creature an opponent controls.' };
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
    let removeFromCombatDrawNote = '';
    if (pending.effect.removeFromCombatThenDrawForControllerTappedCreatures) {
      next = {
        ...next,
        declaredAttackers: next.declaredAttackers.filter((id) => id !== targetInstanceId),
        combatAssignments: next.combatAssignments
          .filter((a) => a.attackerInstanceId !== targetInstanceId)
          .map((a) => ({ ...a, blockerInstanceIds: a.blockerInstanceIds.filter((id) => id !== targetInstanceId) })),
      };
      const targetController = getPlayer(next, found.ownerPlayerId);
      const tappedCount = targetController.zones.battlefield.filter((c) => c.tapped).length;
      const drawn = targetController.zones.library.slice(0, tappedCount);
      next = updatePlayer(next, found.ownerPlayerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(drawn.length), hand: [...p.zones.hand, ...drawn] } }));
      removeFromCombatDrawNote = ` ${targetDef.name} is removed from combat. ${targetController.name} draws ${drawn.length} card(s).`;
    }
    next = { ...next, pendingTarget: null };
    const actor = getPlayer(next, playerId);
    const keywordNote = pending.effect.grantKeyword ? ` ${targetDef.name} gains ${pending.effect.grantKeyword} until end of turn.` : '';
    const tapNote = pending.effect.tapTarget ? ` ${targetDef.name} is tapped.` : '';
    return { ok: true, state: { ...next, log: [...next.log, `${actor.name} attaches ${sourceDef?.name ?? 'the Equipment'} to ${targetDef.name}.${keywordNote}${tapNote}${removeFromCombatDrawNote}`] } };
  }

  if (pending.effect.type === 'destroyOpponentCreature') {
    // opponent-only, creature-only.
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    if (found.ownerPlayerId === playerId) return { ok: false, error: "That's not a legal target - it must be a creature your opponent controls." };
    const destroySurvives = checkIndestructibleOrShielded(state, targetInstanceId, targetDef, found.card, found.ownerPlayerId);
    if (destroySurvives.survives) {
      const next = { ...destroySurvives.state, pendingTarget: null };
      const note = destroySurvives.via === 'shield' ? `${targetDef.name}'s shield counter is removed, preventing the destruction.` : `${targetDef.name} is indestructible and survives.`;
      return { ok: true, state: { ...next, log: [...next.log, note] } };
    }
    const destroyResult = moveCreaturesToGraveyardAndTrigger(destroySurvives.state, [targetInstanceId], 'is destroyed');
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
    let isLethal = !!damagedTarget && damagedTarget.damageMarked >= effectiveToughness(targetDef, damagedTarget, next, found.ownerPlayerId);
    if (isLethal && damagedTarget) {
      const survives = checkIndestructibleOrShielded(next, targetInstanceId, targetDef, damagedTarget, found.ownerPlayerId);
      next = survives.state;
      isLethal = !survives.survives;
    }
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
    if (pending.effect.upToTwo && targetInstanceId === pending.firstInstanceId) {
      return { ok: false, error: 'The second target must be a different creature.' };
    }
    const { amount } = pending.effect;
    const actor = getPlayer(state, playerId);
    let next = updatePlayer(state, found.ownerPlayerId, (p) => ({
      ...p,
      zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === targetInstanceId ? { ...c, damageMarked: c.damageMarked + amount } : c)) },
    }));
    // "...to EACH OF UP TO TWO target creatures" (Summon: Kujata) - same
    // mandatory-first/optional-second convention as PumpUpToTwoTargetsEffect.
    const advanceToSecondPick = pending.effect.upToTwo && !pending.firstInstanceId;
    next = {
      ...next,
      pendingTarget: advanceToSecondPick ? { ...pending, firstInstanceId: targetInstanceId } : null,
      log: [...next.log, `${actor.name} deals ${amount} damage to ${targetDef.name}.`],
    };
    const damagedTarget = getPlayer(next, found.ownerPlayerId).zones.battlefield.find((c) => c.instanceId === targetInstanceId);
    let isLethal = !!damagedTarget && damagedTarget.damageMarked >= effectiveToughness(targetDef, damagedTarget, next, found.ownerPlayerId);
    if (isLethal && damagedTarget) {
      const survives = checkIndestructibleOrShielded(next, targetInstanceId, targetDef, damagedTarget, found.ownerPlayerId);
      next = survives.state;
      isLethal = !survives.survives;
    }
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

  if (pending.effect.type === 'grantCantBlockToUpToThreeTargets') {
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    const alreadyChosen = pending.chosenInstanceIds ?? [];
    if (alreadyChosen.includes(targetInstanceId)) return { ok: false, error: 'Each target must be a different creature.' };
    let next = updatePlayer(state, found.ownerPlayerId, (p) => ({
      ...p,
      zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === targetInstanceId ? { ...c, temporaryCantBlock: true } : c)) },
    }));
    const chosenInstanceIds = [...alreadyChosen, targetInstanceId];
    const actor = getPlayer(next, playerId);
    next = {
      ...next,
      pendingTarget: chosenInstanceIds.length < 3 ? { ...pending, chosenInstanceIds } : null,
      log: [...next.log, `${actor.name} targets ${targetDef.name}: it can't block this turn.`],
    };
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
            : pending.effect.targetFilter === 'artifactEnchantmentOrTappedCreature'
              ? targetDef.type === 'artifact' || targetDef.type === 'enchantment' || (targetDef.type === 'creature' && found.card.tapped)
              : pending.effect.targetFilter === 'artifactOrEnchantment'
                ? targetDef.type === 'artifact' || targetDef.type === 'enchantment'
                : true;
    if (!isLegal) return { ok: false, error: `${targetDef.name} is not a legal target.` };
    if (pending.effect.opponentControlledOnly && found.ownerPlayerId === playerId) {
      return { ok: false, error: `${targetDef.name} is not a legal target - it must be a permanent an opponent controls.` };
    }
    if (pending.effect.upToTwo && targetInstanceId === pending.firstInstanceId) {
      return { ok: false, error: 'The second target must be a different permanent.' };
    }
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
    let exileLogLines = [`${actor.name} exiles ${targetDef.name}.`];
    if (pending.effect.alsoExileSameNameTokensControlledByTarget) {
      const matchingTokens = getPlayer(next, found.ownerPlayerId).zones.battlefield.filter((c) => c.isToken && c.defId === found.card.defId);
      if (matchingTokens.length > 0) {
        const matchingIds = new Set(matchingTokens.map((c) => c.instanceId));
        next = updatePlayer(next, found.ownerPlayerId, (p) => ({
          ...p,
          zones: { ...p.zones, battlefield: p.zones.battlefield.filter((c) => !matchingIds.has(c.instanceId)), exile: [...p.zones.exile, ...matchingTokens] },
        }));
        exileLogLines.push(`Also exiles ${matchingTokens.length} ${targetDef.name} token(s) ${getPlayer(next, found.ownerPlayerId).name} controls.`);
      }
    }
    // "Exile UP TO TWO target [filter]" (Angel of the Ruins) - same
    // mandatory-first/optional-second two-step convention as
    // PumpUpToTwoTargetsEffect: re-arm with firstInstanceId set after the
    // first pick, clear after the second.
    const advanceToSecondPick = pending.effect.upToTwo && !pending.firstInstanceId;
    next = { ...next, pendingTarget: advanceToSecondPick ? { ...pending, firstInstanceId: targetInstanceId } : null, log: [...next.log, ...exileLogLines] };
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
        if (updated.damageMarked < effectiveToughness(cDef, updated, next, p.id)) continue;
        const survives = checkIndestructibleOrShielded(next, c.instanceId, cDef, updated, p.id);
        next = survives.state;
        if (!survives.survives) dead.push(c.instanceId);
      }
    }
    next = { ...next, pendingTarget: null, log: [...next.log, `${actor.name}'s ${targetDef.name} deals ${amount} damage to every other creature.`] };
    if (dead.length > 0) {
      const sweepResult = moveCreaturesToGraveyardAndTrigger(next, dead, 'dies');
      next = { ...sweepResult.state, log: [...sweepResult.state.log, ...sweepResult.logLines] };
    }
    return { ok: true, state: next };
  }

  if (pending.effect.type === 'putOwnCountersOnTargetThenShuffleSelfIntoLibrary') {
    if (targetDef.type !== 'creature' || found.ownerPlayerId !== playerId) {
      return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature you control.` };
    }
    const sourceFound = findCardAnywhere(state, pending.sourceInstanceId);
    const sourceDef = sourceFound ? getCardDefinition(sourceFound.card.defId) : null;
    const countersToMove = sourceFound?.card.counters ?? [];
    let next = state;
    if (countersToMove.length > 0) {
      next = updatePlayer(next, found.ownerPlayerId, (p) => ({
        ...p,
        zones: {
          ...p.zones,
          battlefield: p.zones.battlefield.map((c) => {
            if (c.instanceId !== targetInstanceId) return c;
            let counters = c.counters;
            for (const ctr of countersToMove) {
              const has = counters.some((existing) => existing.label === ctr.label);
              counters = has
                ? counters.map((existing) => (existing.label === ctr.label ? { ...existing, amount: existing.amount + ctr.amount } : existing))
                : [...counters, { ...ctr }];
            }
            return { ...c, counters };
          }),
        },
      }));
    }
    const logLines = [
      countersToMove.length > 0 ? `${targetDef.name} receives ${sourceDef?.name ?? 'the source'}'s counters.` : `${sourceDef?.name ?? 'The source'} had no counters to move.`,
    ];
    if (sourceFound) {
      next = updatePlayer(next, sourceFound.ownerPlayerId, (p) => ({
        ...p,
        zones: { ...p.zones, [sourceFound.zone]: p.zones[sourceFound.zone].filter((c) => c.instanceId !== pending.sourceInstanceId) },
      }));
      const shuffled = shuffle([...getPlayer(next, sourceFound.ownerPlayerId).zones.library, { ...sourceFound.card, tapped: false, counters: [], damageMarked: 0 }]);
      next = updatePlayer(next, sourceFound.ownerPlayerId, (p) => ({ ...p, zones: { ...p.zones, library: shuffled } }));
      logLines.push(`${sourceDef?.name ?? 'The card'} is shuffled into ${getPlayer(next, sourceFound.ownerPlayerId).name}'s library.`);
    }
    next = { ...next, pendingTarget: null };
    return { ok: true, state: { ...next, log: [...next.log, ...logLines] } };
  }

  if (pending.effect.type === 'exileTargetCreatureThenControllerMaySearchBasicLand') {
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    const actor = getPlayer(state, playerId);
    let next = detachEverythingFrom(state, targetInstanceId);
    next = updatePlayer(next, found.ownerPlayerId, (p) => ({ ...p, zones: { ...p.zones, battlefield: p.zones.battlefield.filter((c) => c.instanceId !== targetInstanceId) } }));
    if (isPlayersCommander(next, found.ownerPlayerId, found.card)) {
      const cardOwner = getPlayer(next, found.ownerPlayerId);
      next = beginCommanderZoneChoice(next, found.ownerPlayerId, 'exile', found.card);
      next = {
        ...next,
        pendingTarget: null,
        log: [...next.log, `${actor.name} would exile ${targetDef.name} - ${cardOwner.name} chooses whether it goes there or to the command zone instead. The land search is skipped.`],
      };
      return { ok: true, state: next };
    }
    next = updatePlayer(next, found.ownerPlayerId, (p) => ({ ...p, zones: { ...p.zones, exile: [...p.zones.exile, found.card] } }));
    next = { ...next, pendingTarget: null, log: [...next.log, `${actor.name} exiles ${targetDef.name}.`] };
    const searchResult = beginLibrarySearch(next, found.ownerPlayerId, pending.sourceInstanceId, { kind: 'basicLand' }, true, true);
    next = searchResult.state;
    return { ok: true, state: { ...next, log: [...next.log, ...searchResult.logLines] } };
  }

  if (pending.effect.type === 'exileTargetCreatureThenControllerGainsLifeEqualToPower') {
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    const actor = getPlayer(state, playerId);
    const power = effectivePower(targetDef, found.card, state, found.ownerPlayerId);
    let next = detachEverythingFrom(state, targetInstanceId);
    next = updatePlayer(next, found.ownerPlayerId, (p) => ({ ...p, zones: { ...p.zones, battlefield: p.zones.battlefield.filter((c) => c.instanceId !== targetInstanceId) } }));
    if (isPlayersCommander(next, found.ownerPlayerId, found.card)) {
      const cardOwner = getPlayer(next, found.ownerPlayerId);
      next = beginCommanderZoneChoice(next, found.ownerPlayerId, 'exile', found.card);
      next = {
        ...next,
        pendingTarget: null,
        log: [...next.log, `${actor.name} would exile ${targetDef.name} - ${cardOwner.name} chooses whether it goes there or to the command zone instead.`],
      };
      const resolved = resolveCardEffects(next, found.ownerPlayerId, [{ type: 'gainLife', amount: power }], targetInstanceId);
      return { ok: true, state: { ...resolved.state, log: [...resolved.state.log, ...resolved.logLines] } };
    }
    next = updatePlayer(next, found.ownerPlayerId, (p) => ({ ...p, zones: { ...p.zones, exile: [...p.zones.exile, found.card] } }));
    next = { ...next, pendingTarget: null, log: [...next.log, `${actor.name} exiles ${targetDef.name}.`] };
    const resolved = resolveCardEffects(next, found.ownerPlayerId, [{ type: 'gainLife', amount: power }], targetInstanceId);
    return { ok: true, state: { ...resolved.state, log: [...resolved.state.log, ...resolved.logLines] } };
  }

  if (pending.effect.type === 'putTargetNonlandPermanentInLibraryOwnersChoice') {
    if (targetDef.type === 'land') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a nonland permanent.` };
    const owner = getPlayer(state, found.ownerPlayerId);
    const next = {
      ...state,
      pendingTarget: null,
      pendingLibraryPlacementChoice: { sourceInstanceId: pending.sourceInstanceId, casterId: playerId, ownerId: found.ownerPlayerId, targetInstanceId },
    };
    return {
      ok: true,
      state: { ...next, log: [...next.log, `${targetDef.name}'s owner (${owner.name}) chooses whether to put it on the top or bottom of their library.`] },
    };
  }

  if (pending.effect.type === 'gainControlOfTargetNoncreatureArtifactPermanent') {
    if (targetDef.type !== 'artifact') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a noncreature artifact.` };
    let next = updatePlayer(state, found.ownerPlayerId, (p) => ({
      ...p,
      zones: { ...p.zones, battlefield: p.zones.battlefield.filter((c) => c.instanceId !== targetInstanceId) },
    }));
    next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, battlefield: [...p.zones.battlefield, found.card] } }));
    // "Then you may attach an Equipment you control to [this]." (Yuffie,
    // Materia Hunter) - chained from HERE rather than a second effect in the
    // same onEnter list, since both are pendingTarget-based and a second
    // list entry would clobber this one before the player ever resolved it
    // (the same collision class Collective Effort's modes hit elsewhere).
    const hasEquipmentToAttach = getPlayer(next, playerId).zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'artifact' && !!getCardDefinition(c.defId).equipCost);
    next = {
      ...next,
      pendingTarget: hasEquipmentToAttach
        ? { sourceInstanceId: pending.sourceInstanceId, controllerId: playerId, effect: { type: 'mayAttachTargetControlledEquipmentToSelf' } }
        : null,
    };
    const actor = getPlayer(next, playerId);
    next = { ...next, log: [...next.log, `${actor.name} gains control of ${targetDef.name}.`] };
    return { ok: true, state: next };
  }

  if (pending.effect.type === 'mayAttachTargetControlledEquipmentToSelf') {
    if (targetDef.type !== 'artifact' || !targetDef.equipCost) return { ok: false, error: `${targetDef.name} is not a legal target - it must be an Equipment.` };
    if (found.ownerPlayerId !== playerId) return { ok: false, error: `${targetDef.name} is not a legal target - it must be an Equipment you control.` };
    const next = updatePlayer(state, playerId, (p) => ({
      ...p,
      zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === targetInstanceId ? { ...c, attachedToInstanceId: pending.sourceInstanceId } : c)) },
    }));
    const sourceName = getCardDefinition(findCardAnywhere(next, pending.sourceInstanceId)!.card.defId).name;
    return {
      ok: true,
      state: { ...next, pendingTarget: null, log: [...next.log, `${getPlayer(next, playerId).name} attaches ${targetDef.name} to ${sourceName}.`] },
    };
  }

  if (pending.effect.type === 'shuffleTargetPermanentIntoLibraryThenRevealTop') {
    const ownerId = found.card.ownerId;
    const actor = getPlayer(state, playerId);
    let next = detachEverythingFrom(state, targetInstanceId);
    next = updatePlayer(next, found.ownerPlayerId, (p) => ({ ...p, zones: { ...p.zones, battlefield: p.zones.battlefield.filter((c) => c.instanceId !== targetInstanceId) } }));
    const shuffledCard: CardInstance = { ...found.card, tapped: false, counters: [], damageMarked: 0, attachedToInstanceId: undefined, summoningSick: true };
    next = updatePlayer(next, ownerId, (p) => ({ ...p, zones: { ...p.zones, library: shuffle([...p.zones.library, shuffledCard]) } }));
    next = { ...next, pendingTarget: null };
    let logLines = [`${actor.name} shuffles ${targetDef.name} into ${getPlayer(next, ownerId).name}'s library.`];

    const owner = getPlayer(next, ownerId);
    const revealed = owner.zones.library[0];
    if (!revealed) {
      return { ok: true, state: { ...next, log: [...next.log, ...logLines, `${owner.name}'s library is empty - nothing is revealed.`] } };
    }
    const revealedDef = getCardDefinition(revealed.defId);
    logLines.push(`${owner.name} reveals ${revealedDef.name} off the top of their library.`);
    if (revealedDef.type === 'instant' || revealedDef.type === 'sorcery') {
      return { ok: true, state: { ...next, log: [...next.log, ...logLines] } };
    }
    const entersTapped = !!revealedDef.entersTapped;
    const hasHaste = hasKeyword(revealedDef, 'haste');
    const movedCard: CardInstance = stripSagaProgress({ ...revealed, tapped: entersTapped, summoningSick: !hasHaste, damageMarked: 0, counters: [], attachedToInstanceId: undefined });
    next = updatePlayer(next, ownerId, (p) => ({
      ...p,
      zones: { ...p.zones, library: p.zones.library.slice(1), battlefield: [...p.zones.battlefield, movedCard] },
    }));
    next = checkLegendRule(next, ownerId);
    logLines.push(`${owner.name} puts ${revealedDef.name} onto the battlefield.`);
    if (revealedDef.onEnter && revealedDef.onEnter.length > 0) {
      const resolved = resolveCardEffects(next, ownerId, revealedDef.onEnter, movedCard.instanceId);
      next = resolved.state;
      logLines = [...logLines, ...resolved.logLines];
    }
    return { ok: true, state: { ...next, log: [...next.log, ...logLines] } };
  }

  if (pending.effect.type === 'destroyAnyNumberOfTappedCreaturesWithDifferentControllers') {
    if (targetDef.type !== 'creature' || !found.card.tapped) return { ok: false, error: `${targetDef.name} is not a legal target - it must be a tapped creature.` };
    const usedControllerIds = pending.usedControllerIds ?? [];
    if (usedControllerIds.includes(found.ownerPlayerId)) {
      return { ok: false, error: `${targetDef.name} is not a legal target - a creature that player controls was already destroyed this way.` };
    }
    const destroyResult = moveCreaturesToGraveyardAndTrigger(state, [targetInstanceId], 'is destroyed');
    let next = { ...destroyResult.state, log: [...destroyResult.state.log, ...destroyResult.logLines] };
    const nextUsedControllerIds = [...usedControllerIds, found.ownerPlayerId];
    const stillLegal = next.players.some((p) => !nextUsedControllerIds.includes(p.id) && p.zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'creature' && c.tapped));
    next = { ...next, pendingTarget: stillLegal ? { ...pending, usedControllerIds: nextUsedControllerIds } : null };
    return { ok: true, state: next };
  }

  if (pending.effect.type === 'phaseOutAnyNumberOfTargetControlledNonlandPermanents') {
    if (targetDef.type === 'land') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a nonland permanent.` };
    if (found.ownerPlayerId !== playerId) return { ok: false, error: `${targetDef.name} is not a legal target - it must be a permanent you control.` };
    if ((pending.chosenInstanceIds ?? []).includes(targetInstanceId)) {
      return { ok: false, error: 'You must choose a different permanent for each pick.' };
    }
    let next = updatePlayer(state, playerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.map((c) => (c.instanceId === targetInstanceId || c.attachedToInstanceId === targetInstanceId ? { ...c, phasedOut: true } : c)),
      },
    }));
    const chosenInstanceIds = [...(pending.chosenInstanceIds ?? []), targetInstanceId];
    const actor = getPlayer(next, playerId);
    next = { ...next, pendingTarget: { ...pending, chosenInstanceIds }, log: [...next.log, `${actor.name} phases out ${targetDef.name}.`] };
    return { ok: true, state: next };
  }

  if (pending.effect.type === 'mayBecomeCopyOfAnotherControlledCreatureThenBuffBoth') {
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    if (found.ownerPlayerId !== playerId) return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature you control.` };
    if (targetInstanceId === pending.sourceInstanceId) return { ok: false, error: `${targetDef.name} is not a legal target - it must be another creature.` };
    const { power, toughness, grantKeyword } = pending.effect;
    let next = updatePlayer(state, playerId, (p) => ({
      ...p,
      zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === pending.sourceInstanceId ? { ...c, temporaryBaseStats: { power: targetDef.power ?? 0, toughness: targetDef.toughness ?? 0 } } : c)) },
    }));
    next = applyTemporaryBuff(next, pending.sourceInstanceId, power, toughness);
    next = grantTemporaryKeyword(next, pending.sourceInstanceId, grantKeyword);
    next = applyTemporaryBuff(next, targetInstanceId, power, toughness);
    next = grantTemporaryKeyword(next, targetInstanceId, grantKeyword);
    const sourceDef = getCardDefinition(findCardAnywhere(next, pending.sourceInstanceId)!.card.defId);
    const actor = getPlayer(next, playerId);
    next = { ...next, pendingTarget: null };
    return {
      ok: true,
      state: {
        ...next,
        log: [
          ...next.log,
          `${actor.name} has ${sourceDef.name} become a copy of ${targetDef.name} until end of turn - both get +${power}/+${toughness} and gain ${grantKeyword} until end of turn.`,
        ],
      },
    };
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

/** Thin wrapper around chooseTargetResolve (the giant per-effect-type
 * dispatcher above) that checks, generically, whether the target just
 * chosen counts as "a creature you control becomes the target of an
 * activated ability" (Professor Hojo) - checked here instead of inside
 * every individual branch above, since ANY of them could be the activated
 * ability in question and this only needs to know WHICH instance got
 * targeted and WHO controls the triggering ability, not how that branch's
 * own effect resolved. Only fires for a pendingTarget armed with
 * fromActivatedAbility (see its own doc comment) - a spell's targeting
 * never counts. */
function chooseTarget(state: GameState, playerId: string, targetInstanceId: string | null, wardPaid = false, targetPlayerId?: string): ActionResult {
  const pending = state.pendingTarget;
  const result = chooseTargetResolve(state, playerId, targetInstanceId, wardPaid, targetPlayerId);
  if (!result.ok || !pending?.fromActivatedAbility || !targetInstanceId) return result;

  const targetFound = findCardAnywhere(result.state, targetInstanceId);
  if (!targetFound || targetFound.zone !== 'battlefield' || targetFound.ownerPlayerId !== pending.controllerId) return result;
  if (getCardDefinition(targetFound.card.defId).type !== 'creature') return result;

  let next = result.state;
  for (const watcher of getPlayer(next, pending.controllerId).zones.battlefield) {
    const watcherDef = getCardDefinition(watcher.defId);
    if (!watcherDef.onOwnControlledCreatureTargetedByActivatedAbility || watcherDef.onOwnControlledCreatureTargetedByActivatedAbility.length === 0) continue;
    if (watcher.targetedByActivatedAbilityDrawTriggeredThisTurn) continue;
    next = updatePlayer(next, pending.controllerId, (p) => ({
      ...p,
      zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === watcher.instanceId ? { ...c, targetedByActivatedAbilityDrawTriggeredThisTurn: true } : c)) },
    }));
    const resolved = resolveCardEffects(next, pending.controllerId, watcherDef.onOwnControlledCreatureTargetedByActivatedAbility, watcher.instanceId);
    next = { ...resolved.state, log: [...resolved.state.log, ...resolved.logLines] };
  }
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

/** Summon: Yojimbo's attack tax - the attacking player either pays the
 * summed {N} cost (re-entering finalizeDeclareAttackers with the SAME
 * already-legality-checked instanceIds) or declines, which simply cancels
 * the attack declaration (no attackers are tapped, phase stays
 * declare_attackers) so they can redeclare with fewer/no attackers. */
function resolveAttackTaxPayment(state: GameState, playerId: string, pay: boolean): ActionResult {
  const pending = state.pendingAttackTaxPayment;
  if (!pending) return { ok: false, error: 'Nothing is waiting on an attack tax payment right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your payment to make." };

  if (!pay) {
    return { ok: true, state: { ...state, pendingAttackTaxPayment: null, log: [...state.log, `${getPlayer(state, playerId).name} declines to pay the attack tax - no attackers are declared.`] } };
  }

  const actor = getPlayer(state, playerId);
  const parsed = parseCostLabel(`{${pending.totalGeneric}}`);
  if (!canPay(actor.manaPool, parsed, 0)) return { ok: false, error: 'Not enough mana to pay the attack tax.' };
  const next = updatePlayer(state, playerId, (p) => ({ ...p, manaPool: payCost(p.manaPool, parsed, 0) }));
  const paidState = { ...next, pendingAttackTaxPayment: null, log: [...next.log, `${actor.name} pays {${pending.totalGeneric}} to attack.`] };
  return finalizeDeclareAttackers(paidState, playerId, pending.instanceIds);
}

/** Yuna, Grand Summoner's "you may put N +1/+1 counters on target creature" -
 * always resolves the FRONT of pendingCounterTransferQueue (see that field's
 * own comment for why this is a queue rather than pendingTarget itself).
 * null declines; a target must be a creature (either player's - the real
 * card names no restriction). */
function resolveCounterTransfer(state: GameState, playerId: string, targetInstanceId: string | null): ActionResult {
  const queue = state.pendingCounterTransferQueue;
  const current = queue[0];
  if (!current) return { ok: false, error: 'Nothing is waiting on a counter transfer choice right now.' };
  if (current.controllerId !== playerId) return { ok: false, error: "It's not your choice to make." };

  if (!targetInstanceId) {
    return { ok: true, state: { ...state, pendingCounterTransferQueue: queue.slice(1) } };
  }

  const found = findCardAnywhere(state, targetInstanceId);
  if (!found || found.zone !== 'battlefield') return { ok: false, error: "That's not a legal target - it must be a creature on the battlefield." };
  const targetDef = getCardDefinition(found.card.defId);
  if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };

  let next = updatePlayer(state, found.ownerPlayerId, (p) => ({
    ...p,
    zones: {
      ...p.zones,
      battlefield: p.zones.battlefield.map((c) => {
        if (c.instanceId !== targetInstanceId) return c;
        const hasCounter = c.counters.some((ctr) => ctr.label === '+1/+1');
        const counters = hasCounter
          ? c.counters.map((ctr) => (ctr.label === '+1/+1' ? { ...ctr, amount: ctr.amount + current.amount } : ctr))
          : [...c.counters, { label: '+1/+1', amount: current.amount }];
        return { ...c, counters };
      }),
    },
  }));
  next = { ...next, pendingCounterTransferQueue: queue.slice(1) };
  return { ok: true, state: { ...next, log: [...next.log, `${current.sourceName} triggers: puts ${current.amount} +1/+1 counter(s) on ${targetDef.name}.`] } };
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

/** "Target player adds one mana of any color." (The Warring Triad) - see
 * types.ts: AddOneManaOfChosenColorEffect for why "target player" is
 * approximated as the activator themselves. */
function resolveAddManaOfChosenColor(state: GameState, playerId: string, color: ManaColor): ActionResult {
  const pending = state.pendingAddManaOfChosenColor;
  if (!pending) return { ok: false, error: 'Nothing is waiting on a colour choice right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your colour to choose." };
  if (color === 'C') return { ok: false, error: 'Choose one of the five colors (not colorless).' };

  const amount = pending.amount ?? 1;
  let next = updatePlayer(state, playerId, (p) => ({ ...p, manaPool: { ...p.manaPool, [color]: p.manaPool[color] + amount } }));
  next = { ...next, pendingAddManaOfChosenColor: null };
  const player = getPlayer(next, playerId);
  return { ok: true, state: { ...next, log: [...next.log, `${player.name} adds ${amount} ${color} mana.`] } };
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

/** "Each player puts a vow counter on a creature they control and sacrifices
 * the rest" (Promise of Loyalty) - the "keep one" cousin of chooseSacrifice
 * just above. `instanceId` is the ONE creature to keep; every OTHER
 * creature the current front-queue player controls is sacrificed as part
 * of the same choice. */
function chooseKeepOneSacrificeRest(state: GameState, playerId: string, instanceId: string): ActionResult {
  const pending = state.pendingKeepOneSacrificeRest;
  if (!pending) return { ok: false, error: 'Nothing is waiting on this choice right now.' };
  const [currentId, ...rest] = pending.remainingPlayerIds;
  if (currentId !== playerId) return { ok: false, error: "It's not your turn to choose." };

  const player = getPlayer(state, playerId);
  const card = player.zones.battlefield.find((c) => c.instanceId === instanceId);
  if (!card) return { ok: false, error: 'That creature is not on your battlefield.' };
  if (getCardDefinition(card.defId).type !== 'creature') return { ok: false, error: 'You must keep a creature.' };

  const toSacrifice = player.zones.battlefield.filter((c) => c.instanceId !== instanceId && getCardDefinition(c.defId).type === 'creature').map((c) => c.instanceId);
  const sacResult = toSacrifice.length > 0 ? moveCreaturesToGraveyardAndTrigger(state, toSacrifice, 'is sacrificed') : { state, logLines: [] as string[] };
  let next = updatePlayer(sacResult.state, playerId, (p) => ({
    ...p,
    zones: {
      ...p.zones,
      battlefield: p.zones.battlefield.map((c) => {
        if (c.instanceId !== instanceId) return c;
        const hasCounter = c.counters.some((ctr) => ctr.label === 'Vow');
        const counters = hasCounter ? c.counters.map((ctr) => (ctr.label === 'Vow' ? { ...ctr, amount: ctr.amount + 1 } : ctr)) : [...c.counters, { label: 'Vow', amount: 1 }];
        return { ...c, counters };
      }),
    },
  }));
  const actor = getPlayer(next, playerId);
  const def = getCardDefinition(card.defId);
  const result = resolveKeepOneSacrificeRestQueue(next, pending.sourceInstanceId, rest);
  next = { ...result.state, log: [...result.state.log, `${actor.name} keeps ${def.name} and puts a vow counter on it.`, ...sacResult.logLines, ...result.logLines] };

  return { ok: true, state: next };
}

/** "That player chooses up to two creatures they control, then sacrifices
 * the rest" (Archfiend of Depravity) - one click per keep, committed
 * immediately (same shape as CHOOSE_KEEP_ONE_SACRIFICE_REST above, just
 * accumulating toward `keepCount` instead of stopping at one). A null
 * instanceId stops early (sacrificing everything not yet chosen, even
 * short of keepCount) - see types.ts: GameState.
 * pendingChooseUpToNCreaturesSacrificeRest. */
function chooseUpToNCreaturesSacrificeRest(state: GameState, playerId: string, instanceId: string | null): ActionResult {
  const pending = state.pendingChooseUpToNCreaturesSacrificeRest;
  if (!pending) return { ok: false, error: 'Nothing is waiting on that choice right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your choice to make." };

  const sweep = (chosenInstanceIds: string[]): ActionResult => {
    const player = getPlayer(state, playerId);
    const sacIds = player.zones.battlefield
      .filter((c) => getCardDefinition(c.defId).type === 'creature' && !chosenInstanceIds.includes(c.instanceId))
      .map((c) => c.instanceId);
    const sacResult = sacIds.length > 0 ? moveCreaturesToGraveyardAndTrigger(state, sacIds, 'is sacrificed') : { state, logLines: [] as string[] };
    const next = { ...sacResult.state, pendingChooseUpToNCreaturesSacrificeRest: null };
    return { ok: true, state: { ...next, log: [...next.log, ...sacResult.logLines] } };
  };

  if (instanceId === null) {
    return sweep(pending.chosenInstanceIds);
  }

  const candidate = getPlayer(state, playerId).zones.battlefield.find((c) => c.instanceId === instanceId);
  if (!candidate) return { ok: false, error: 'That creature is not on your battlefield.' };
  if (getCardDefinition(candidate.defId).type !== 'creature') return { ok: false, error: 'You must choose a creature.' };
  if (pending.chosenInstanceIds.includes(instanceId)) return { ok: false, error: 'You already chose that creature.' };

  const chosenInstanceIds = [...pending.chosenInstanceIds, instanceId];
  if (chosenInstanceIds.length >= pending.keepCount) {
    return sweep(chosenInstanceIds);
  }
  return { ok: true, state: { ...state, pendingChooseUpToNCreaturesSacrificeRest: { ...pending, chosenInstanceIds } } };
}

/** Scry 1, then exile whichever card is left on top (playable this turn),
 * then arm the +X/+0 pump keyed to that card's mana value (Cait Sith,
 * Fortune Teller) - continues on immediately from the scry decision alone;
 * see types.ts: ScryThenExileTopPlayableThisTurnThenPumpTargetByExiledManaValueEffect. */
function resolveScryBeforeExile(state: GameState, playerId: string, toBottom: boolean): ActionResult {
  const pending = state.pendingScryBeforeExile;
  if (!pending) return { ok: false, error: 'Nothing is waiting on a scry right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your choice to make." };

  let next = state;
  if (toBottom) {
    next = updatePlayer(next, playerId, (p) => {
      const [top, ...rest] = p.zones.library;
      return top ? { ...p, zones: { ...p.zones, library: [...rest, top] } } : p;
    });
  }
  next = { ...next, pendingScryBeforeExile: null };

  const player = getPlayer(next, playerId);
  const topCard = player.zones.library[0];
  if (!topCard) {
    return { ok: true, state: { ...next, log: [...next.log, `${player.name}'s library is empty - nothing is exiled.`] } };
  }
  const def = getCardDefinition(topCard.defId);
  next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(1), exile: [...p.zones.exile, topCard] } }));
  next = { ...next, exilePlayGrants: [...next.exilePlayGrants, { instanceId: topCard.instanceId, playerId, expiresAtCleanup: true }] };
  const logLines = [`${player.name} exiles ${def.name} - they may play it this turn.`];

  const mv = manaValue(parseCostLabel(def.costLabel));
  const hasLegalPumpTarget = player.zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'creature');
  if (mv > 0 && hasLegalPumpTarget) {
    next = { ...next, pendingTarget: { sourceInstanceId: pending.sourceInstanceId, controllerId: playerId, effect: { type: 'pumpTarget', power: mv, toughness: 0 } } };
  }
  return { ok: true, state: { ...next, log: [...next.log, ...logLines] } };
}

/** "Choose up to one target creature card exiled this way. Create a token
 * that's a copy of that card..." (Espers to Magicite) - `instanceId` must
 * be one of the specific cards `pending.eligibleInstanceIds` named (the
 * ones THIS effect just exiled), found by searching every player's exile
 * zone (the card's owner, not necessarily the caster). Declining
 * (instanceId: null) is always allowed - "up to one". */
function resolveEspersToMagiciteChoice(state: GameState, playerId: string, instanceId: string | null): ActionResult {
  const pending = state.pendingEspersToMagiciteChoice;
  if (!pending) return { ok: false, error: 'Nothing is waiting on that choice right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your choice to make." };

  if (!instanceId) {
    return { ok: true, state: { ...state, pendingEspersToMagiciteChoice: null, log: [...state.log, `${getPlayer(state, playerId).name} declines.`] } };
  }
  if (!pending.eligibleInstanceIds.includes(instanceId)) {
    return { ok: false, error: 'That card is not one of the creature cards exiled this way.' };
  }

  const found = findCardAnywhere(state, instanceId);
  if (!found) return { ok: false, error: 'That card is not in exile.' };
  const def = getCardDefinition(found.card.defId);
  const token: CardInstance = {
    instanceId: nextInstanceId(),
    defId: def.id,
    ownerId: playerId,
    tapped: false,
    counters: [],
    damageMarked: 0,
    summoningSick: !hasKeyword(def, 'haste'),
    isToken: true,
  };
  let next = updatePlayer(state, playerId, (p) => ({ ...p, zones: { ...p.zones, battlefield: [...p.zones.battlefield, token] } }));
  next = { ...next, pendingEspersToMagiciteChoice: null };
  const actor = getPlayer(next, playerId);
  return { ok: true, state: { ...next, log: [...next.log, `${actor.name} creates a token copy of ${def.name}.`] } };
}

/** "You may pay X life, where X is that spell's mana value. If you do,
 * create a 1/1 colorless Hero creature token and put X +1/+1 counters on
 * it." (G'raha Tia, Scion Reborn's "Throw Wide the Gates") - `manaValue`
 * was already fixed at trigger time (see engine/effects.ts:
 * triggerNoncreatureCastAbilities), so declining or accepting here never
 * re-derives it. No minimum-life check, same as resolveOptionalPayLife -
 * the controller can pay themselves to 0 or below if they choose to. */
function resolveThrowWideTheGatesChoice(state: GameState, playerId: string, accept: boolean): ActionResult {
  const pending = state.pendingThrowWideTheGatesChoice;
  if (!pending) return { ok: false, error: 'Nothing is waiting on that choice right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your choice to make." };

  if (!accept) {
    return { ok: true, state: { ...state, pendingThrowWideTheGatesChoice: null } };
  }

  let next = loseLife(state, playerId, pending.manaValue);
  const token: CardInstance = {
    instanceId: nextInstanceId(),
    defId: 'token-hero',
    ownerId: playerId,
    tapped: false,
    counters: pending.manaValue > 0 ? [{ label: '+1/+1', amount: pending.manaValue }] : [],
    damageMarked: 0,
    summoningSick: true,
    isToken: true,
  };
  next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, battlefield: [...p.zones.battlefield, token] } }));
  next = { ...next, pendingThrowWideTheGatesChoice: null };
  const actor = getPlayer(next, playerId);
  return { ok: true, state: { ...next, log: [...next.log, `${actor.name} pays ${pending.manaValue} life and creates a Hero token with ${pending.manaValue} +1/+1 counter(s).`] } };
}

/** "Each player may discard their hand and draw N cards. Then [source]
 * deals M damage to each opponent who discarded their hand this way."
 * (Snort) - see GameState.pendingSnortChoice's own doc comment for the
 * queue/APNAP shape. Only the player at the FRONT of pendingPlayerIds may
 * act; once the queue drains, damage is dealt to whichever of
 * discardedPlayerIds aren't the caster themselves. */
function resolveSnortChoice(state: GameState, playerId: string, accept: boolean): ActionResult {
  const pending = state.pendingSnortChoice;
  if (!pending) return { ok: false, error: 'Nothing is waiting on that choice right now.' };
  if (pending.pendingPlayerIds[0] !== playerId) return { ok: false, error: "It's not your choice to make yet." };

  let next = state;
  const logLines: string[] = [];
  let discardedPlayerIds = pending.discardedPlayerIds;
  if (accept) {
    const player = getPlayer(next, playerId);
    const discarded = player.zones.hand;
    const drawn = player.zones.library.slice(0, pending.drawCount);
    next = updatePlayer(next, playerId, (p) => ({
      ...p,
      zones: { ...p.zones, hand: drawn, graveyard: [...p.zones.graveyard, ...discarded.map((c) => ({ ...c, graveyardEntrySource: 'other' as const }))], library: p.zones.library.slice(drawn.length) },
    }));
    logLines.push(`${player.name} discards their hand (${discarded.length}) and draws ${drawn.length}.`);
    discardedPlayerIds = [...discardedPlayerIds, playerId];
  } else {
    logLines.push(`${getPlayer(next, playerId).name} declines.`);
  }

  const remaining = pending.pendingPlayerIds.slice(1);
  if (remaining.length > 0) {
    next = { ...next, pendingSnortChoice: { ...pending, pendingPlayerIds: remaining, discardedPlayerIds } };
    return { ok: true, state: { ...next, log: [...next.log, ...logLines] } };
  }

  for (const id of discardedPlayerIds) {
    if (id === pending.casterId) continue;
    const victim = getPlayer(next, id);
    next = loseLife(next, id, pending.damageAmount);
    logLines.push(`${victim.name} loses ${pending.damageAmount} life.`);
  }
  next = { ...next, pendingSnortChoice: null };
  return { ok: true, state: { ...next, log: [...next.log, ...logLines] } };
}

/** "Dance — At the beginning of your end step, each player may discard a
 * card. Each player who discarded a card this way draws a card. If a
 * creature card was discarded this way, you create a 1/2 white Moogle
 * creature token with lifelink. Then if a noncreature card was discarded
 * this way, put a +1/+1 counter on each Moogle you control." (Mog, Moogle
 * Warrior) - see MogMoogleWarriorDanceEffect. Same sequential queue shape
 * as resolveSnortChoice just above, but each player picks a SPECIFIC card
 * (or declines) rather than discarding their whole hand, and the two
 * bonus checks read across both players' discards combined, always
 * benefiting `pending.controllerId` (Mog's own controller) regardless of
 * which player actually discarded which card. */
function resolveMogMoogleWarriorDanceChoice(state: GameState, playerId: string, instanceId: string | null): ActionResult {
  const pending = state.pendingMogMoogleWarriorDanceChoice;
  if (!pending) return { ok: false, error: 'Nothing is waiting on that choice right now.' };
  if (pending.pendingPlayerIds[0] !== playerId) return { ok: false, error: "It's not your choice to make yet." };

  let next = state;
  const logLines: string[] = [];
  let creatureDiscarded = pending.creatureDiscarded;
  let noncreatureDiscarded = pending.noncreatureDiscarded;

  if (instanceId) {
    const player = getPlayer(next, playerId);
    const card = player.zones.hand.find((c) => c.instanceId === instanceId);
    if (!card) return { ok: false, error: 'That card is not in your hand.' };
    const def = getCardDefinition(card.defId);
    next = updatePlayer(next, playerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        hand: p.zones.hand.filter((c) => c.instanceId !== instanceId),
        graveyard: [...p.zones.graveyard, { ...card, graveyardEntrySource: 'other' as const }],
      },
    }));
    const drawn = getPlayer(next, playerId).zones.library.slice(0, 1);
    next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(1), hand: [...p.zones.hand, ...drawn] } }));
    logLines.push(`${player.name} discards ${def.name} and draws a card.`);
    if (def.type === 'creature') creatureDiscarded = true;
    else noncreatureDiscarded = true;
  } else {
    logLines.push(`${getPlayer(next, playerId).name} declines.`);
  }

  const remaining = pending.pendingPlayerIds.slice(1);
  if (remaining.length > 0) {
    next = { ...next, pendingMogMoogleWarriorDanceChoice: { ...pending, pendingPlayerIds: remaining, creatureDiscarded, noncreatureDiscarded } };
    return { ok: true, state: { ...next, log: [...next.log, ...logLines] } };
  }

  next = { ...next, pendingMogMoogleWarriorDanceChoice: null };
  if (creatureDiscarded) {
    const resolved = resolveCardEffects(next, pending.controllerId, [{ type: 'createToken', tokenId: 'token-moogle' }], pending.sourceInstanceId);
    next = resolved.state;
    logLines.push(...resolved.logLines);
  }
  if (noncreatureDiscarded) {
    const resolved = resolveCardEffects(next, pending.controllerId, [{ type: 'putCounterOnEachControlledCreatureMatchingSubtype', subtype: 'Moogle', counterLabel: '+1/+1', counterAmount: 1 }], pending.sourceInstanceId);
    next = resolved.state;
    logLines.push(...resolved.logLines);
  }
  return { ok: true, state: { ...next, log: [...next.log, ...logLines] } };
}

/** "Each opponent may sacrifice a nontoken creature of their choice. Each
 * opponent who doesn't loses [lifePerCard] life for each instant and
 * sorcery card in your graveyard." (Fandaniel, Telophoroi Ascian) - the
 * DECIDER is pending.opponentId; declining (instanceId: null) computes the
 * life loss from `pending.controllerId`'s graveyard at THIS moment (not
 * cached when the choice was armed), same "read live" reasoning as every
 * other delayed graveyard-count effect in this engine. */
function resolveFandanielChoice(state: GameState, playerId: string, instanceId: string | null): ActionResult {
  const pending = state.pendingFandanielChoice;
  if (!pending) return { ok: false, error: 'Nothing is waiting on that choice right now.' };
  if (pending.opponentId !== playerId) return { ok: false, error: "It's not your choice to make." };

  let next: GameState = { ...state, pendingFandanielChoice: null };
  const decider = getPlayer(next, playerId);

  if (instanceId) {
    const card = decider.zones.battlefield.find((c) => c.instanceId === instanceId);
    if (!card) return { ok: false, error: 'That permanent is not on your battlefield.' };
    const def = getCardDefinition(card.defId);
    if (def.type !== 'creature' || card.isToken) return { ok: false, error: 'You must sacrifice a nontoken creature.' };
    const sacResult = moveCreaturesToGraveyardAndTrigger(next, [instanceId], 'is sacrificed');
    next = sacResult.state;
    return { ok: true, state: { ...next, log: [...next.log, ...sacResult.logLines] } };
  }

  const graveyardCount = getPlayer(next, pending.controllerId).zones.graveyard.filter((c) => {
    const d = getCardDefinition(c.defId);
    return d.type === 'instant' || d.type === 'sorcery';
  }).length;
  const amount = pending.lifePerCard * graveyardCount;
  next = loseLife(next, playerId, amount);
  return { ok: true, state: { ...next, log: [...next.log, `${decider.name} declines to sacrifice and loses ${amount} life.`] } };
}

/** "At the beginning of your next upkeep, you may cast this card from
 * exile without paying its mana cost." (Rebound - Transpose) - uses
 * CardDefinition.rebound.effects (NOT the card's own onCast, which may
 * have a hand-only clause this recast shouldn't repeat). Resolves to the
 * GRAVEYARD afterward like any ordinary cast instant/sorcery - Rebound
 * only ever offers this once, so there's no second exile-and-rearm. */
function resolveReboundChoice(state: GameState, playerId: string, accept: boolean): ActionResult {
  const pending = state.pendingReboundChoice;
  if (!pending) return { ok: false, error: 'Nothing is waiting on that choice right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your choice to make." };

  const player = getPlayer(state, playerId);
  const card = player.zones.exile.find((c) => c.instanceId === pending.sourceInstanceId);
  if (!card) return { ok: false, error: 'That card is no longer in exile.' };
  const def = getCardDefinition(card.defId);

  if (!accept) {
    return { ok: true, state: { ...state, pendingReboundChoice: null, log: [...state.log, `${player.name} declines to Rebound ${def.name}.`] } };
  }

  const preCastBattlefieldIds = new Set(player.zones.battlefield.map((c) => c.instanceId));
  let next = updatePlayer(state, playerId, (p) => ({
    ...p,
    zones: { ...p.zones, exile: p.zones.exile.filter((c) => c.instanceId !== pending.sourceInstanceId), graveyard: [...p.zones.graveyard, card] },
  }));
  next = { ...next, pendingReboundChoice: null };

  let effectLogLines: string[] = [];
  if (def.rebound && def.rebound.effects.length > 0) {
    const resolved = resolveCardEffects(next, playerId, def.rebound.effects, card.instanceId);
    next = resolved.state;
    effectLogLines = resolved.logLines;
  }
  const triggered = triggerNoncreatureCastAbilities(next, playerId, 0, preCastBattlefieldIds, def.type);
  next = triggered.state;
  effectLogLines = [...effectLogLines, ...triggered.logLines];

  return { ok: true, state: { ...next, log: [...next.log, `${player.name} Rebounds ${def.name} from exile.`, ...effectLogLines] } };
}

/** "Look at the top seven cards of your library. Put two of them into
 * your hand and the rest on the bottom of your library in any order."
 * (Dig Through Time) - picks accumulate in pending.chosenInstanceIds one
 * at a time until keepCount is reached, then everything else goes to the
 * bottom, shuffled (see LookAtTopNPutMToHandRestToBottomEffect's own doc
 * comment for why "in any order" is approximated this way). No decline
 * option - every pick up to keepCount is mandatory, same as a plain
 * "look at N, choose M" with no "may" in the printed text. */
function resolveLookAtTopNPutMToHandRestToBottom(state: GameState, playerId: string, instanceId: string | null): ActionResult {
  const pending = state.pendingLookAtTopNPutMToHandRestToBottom;
  if (!pending) return { ok: false, error: 'Nothing is waiting on that choice right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your choice to make." };
  if (!instanceId) return { ok: false, error: 'You must choose a card.' };
  if (pending.chosenInstanceIds.includes(instanceId)) return { ok: false, error: 'You already chose that card.' };
  const card = pending.cards.find((c) => c.instanceId === instanceId);
  if (!card) return { ok: false, error: 'That card is not among the ones being looked at.' };

  const chosenInstanceIds = [...pending.chosenInstanceIds, instanceId];
  const player = getPlayer(state, playerId);

  if (chosenInstanceIds.length < pending.keepCount) {
    return { ok: true, state: { ...state, pendingLookAtTopNPutMToHandRestToBottom: { ...pending, chosenInstanceIds } } };
  }

  const toHand = pending.cards.filter((c) => chosenInstanceIds.includes(c.instanceId));
  const toBottom = shuffle(pending.cards.filter((c) => !chosenInstanceIds.includes(c.instanceId)));
  const next: GameState = {
    ...updatePlayer(state, playerId, (p) => ({ ...p, zones: { ...p.zones, hand: [...p.zones.hand, ...toHand], library: [...p.zones.library, ...toBottom] } })),
    pendingLookAtTopNPutMToHandRestToBottom: null,
  };
  return { ok: true, state: { ...next, log: [...next.log, `${player.name} puts ${toHand.length} card(s) into their hand and ${toBottom.length} on the bottom of their library.`] } };
}

/** "You may cast any number of spells from among cards exiled this way
 * without paying their mana costs. Then each player who owns a spell you
 * cast this way loses life equal to its mana value." (Kefka, Dancing
 * Mad) - `instanceId` must be one of pending.eligibleInstanceIds (the
 * cards THIS resolution exiled), found by searching every player's exile
 * zone (its owner, not necessarily the caster). Declining (instanceId:
 * null) just drops the front of the queue - "any number" permits 0. A
 * permanent cast this way enters the battlefield under the CASTER's
 * control (real "you cast it" rule); an instant/sorcery resolves and goes
 * to its OWNER's graveyard (no "exile instead" clause in Kefka's text,
 * unlike Quistis Trepe's cast-from-graveyard effect). */
function resolveKefkaChoice(state: GameState, playerId: string, instanceId: string | null): ActionResult {
  const pending = state.pendingKefkaChoice;
  if (!pending) return { ok: false, error: 'Nothing is waiting on that choice right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your choice to make." };

  if (!instanceId) {
    const rest = pending.eligibleInstanceIds.slice(1);
    return { ok: true, state: { ...state, pendingKefkaChoice: rest.length > 0 ? { ...pending, eligibleInstanceIds: rest } : null } };
  }
  if (!pending.eligibleInstanceIds.includes(instanceId)) {
    return { ok: false, error: 'That card is not one of the cards exiled this way.' };
  }

  const found = findCardAnywhere(state, instanceId);
  if (!found || found.zone !== 'exile') return { ok: false, error: 'That card is not in exile.' };
  const def = getCardDefinition(found.card.defId);
  if (def.type === 'land') return { ok: false, error: 'A land is not a spell - it can’t be cast this way.' };

  const isPermanent = def.type === 'creature' || def.type === 'artifact' || def.type === 'enchantment';
  let next = updatePlayer(state, found.ownerPlayerId, (p) => ({ ...p, zones: { ...p.zones, exile: p.zones.exile.filter((c) => c.instanceId !== instanceId) } }));
  const movedCard: CardInstance = { ...found.card, tapped: isPermanent && !!def.entersTapped, damageMarked: 0, summoningSick: def.type === 'creature' ? !hasKeyword(def, 'haste') : false };
  const targetZone: 'battlefield' | 'graveyard' = isPermanent ? 'battlefield' : 'graveyard';
  const targetOwnerId = isPermanent ? playerId : found.ownerPlayerId;
  next = updatePlayer(next, targetOwnerId, (p) => ({ ...p, zones: { ...p.zones, [targetZone]: [...p.zones[targetZone], movedCard] } }));
  if (isPermanent) next = checkLegendRule(next, playerId);

  let logLines = [`${getPlayer(next, playerId).name} casts ${def.name} from exile without paying its mana cost.`];
  const autoEffects = isPermanent ? def.onEnter : def.onCast;
  if (autoEffects && autoEffects.length > 0) {
    const resolved = resolveCardEffects(next, playerId, autoEffects, movedCard.instanceId);
    next = resolved.state;
    logLines = [...logLines, ...resolved.logLines];
  }

  const mv = manaValue(parseCostLabel(def.costLabel));
  if (mv > 0) {
    next = loseLife(next, found.ownerPlayerId, mv);
    logLines.push(`${getPlayer(next, found.ownerPlayerId).name} loses ${mv} life.`);
  }

  const rest = pending.eligibleInstanceIds.filter((id) => id !== instanceId);
  next = { ...next, pendingKefkaChoice: rest.length > 0 ? { ...pending, eligibleInstanceIds: rest } : null };
  return { ok: true, state: { ...next, log: [...next.log, ...logLines] } };
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

/** "...then put the card back or put it into your graveyard" (ExploreEffect's
 * nonland branch) - the counter and the land-to-hand case already happened
 * before pendingExplore was ever set (see ExploreEffect's own doc comment);
 * this only resolves the one remaining binary choice. */
function resolveExplore(state: GameState, playerId: string, toGraveyard: boolean): ActionResult {
  const pending = state.pendingExplore;
  if (!pending) return { ok: false, error: 'Nothing is waiting on an explore choice right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your explore to resolve." };

  const next = updatePlayer(state, playerId, (p) => ({
    ...p,
    zones: toGraveyard
      ? { ...p.zones, graveyard: [...p.zones.graveyard, pending.revealedCard] }
      : { ...p.zones, library: [pending.revealedCard, ...p.zones.library] },
  }));
  const player = getPlayer(next, playerId);
  const cardName = getCardDefinition(pending.revealedCard.defId).name;
  const logLine = toGraveyard ? `${player.name} puts ${cardName} into their graveyard.` : `${player.name} puts ${cardName} back on top of their library.`;
  return { ok: true, state: { ...next, pendingExplore: null, log: [...next.log, logLine] } };
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
  if (pending.filter === 'auraOrEquipment') {
    if (!def.subtype?.toLowerCase().includes('aura') && !def.subtype?.toLowerCase().includes('equipment')) {
      return { ok: false, error: 'You must return an Aura or Equipment card.' };
    }
  } else if (def.type !== 'creature' && def.type !== 'artifact' && def.type !== 'enchantment' && def.type !== 'land') {
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
    zones: { ...p.zones, hand: p.zones.hand.filter((c) => c.instanceId !== instanceId), graveyard: [...p.zones.graveyard, { ...card, tapped: false, graveyardEntrySource: 'other' }] },
  }));
  let logLines = [`${player.name} discards ${def.name}.`];

  // "You draw a card for each card discarded this way." (Syphon Mind) -
  // a DIFFERENT player (thenCasterDraws) draws once for each card the
  // discarder actually discards.
  if (pending.thenCasterDraws) {
    const casterId = pending.thenCasterDraws;
    const caster = getPlayer(next, casterId);
    const drawn = caster.zones.library.slice(0, 1);
    next = updatePlayer(next, casterId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(1), hand: [...p.zones.hand, ...drawn] } }));
    logLines.push(`${caster.name} draws a card.`);
  }
  // "Discard a card, then draw two cards. When you discard a card this
  // way, this creature deals damage equal to that card's mana value to
  // each opponent." (Summon: Kujata's chapter III) - the SAME player
  // (the discarder) draws, then each opponent loses life equal to the
  // just-discarded card's mana value.
  if (pending.thenDrawCountForDiscarder) {
    const drawn = getPlayer(next, playerId).zones.library.slice(0, pending.thenDrawCountForDiscarder);
    next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(pending.thenDrawCountForDiscarder!), hand: [...p.zones.hand, ...drawn] } }));
    logLines.push(`${getPlayer(next, playerId).name} draws ${drawn.length} card(s).`);
  }
  if (pending.thenDamageOpponentsEqualToDiscardedManaValue) {
    const mv = manaValue(parseCostLabel(def.costLabel));
    const opponent = getOpponent(next, playerId);
    next = updatePlayer(next, opponent.id, (p) => ({ ...p, life: p.life - mv }));
    logLines.push(`${opponent.name} loses ${mv} life.`);
  }
  // Connive (Lethal Scheme) - a NONLAND discard puts a +1/+1 counter on
  // the conniving creature itself.
  if (pending.thenCounterOnInstanceIdIfNonland && def.type !== 'land') {
    const connivingId = pending.thenCounterOnInstanceIdIfNonland;
    const stillThere = findCardAnywhere(next, connivingId);
    if (stillThere && stillThere.zone === 'battlefield') {
      next = updatePlayer(next, stillThere.ownerPlayerId, (p) => ({
        ...p,
        zones: {
          ...p.zones,
          battlefield: p.zones.battlefield.map((c) => {
            if (c.instanceId !== connivingId) return c;
            const hasCounter = c.counters.some((ctr) => ctr.label === '+1/+1');
            const counters = hasCounter ? c.counters.map((ctr) => (ctr.label === '+1/+1' ? { ...ctr, amount: ctr.amount + 1 } : ctr)) : [...c.counters, { label: '+1/+1', amount: 1 }];
            return { ...c, counters };
          }),
        },
      }));
      logLines.push(`${getCardDefinition(stillThere.card.defId).name} gets a +1/+1 counter (discarded a nonland card).`);
    }
  }

  const remaining = pending.count - 1;
  const handLeft = getPlayer(next, playerId).zones.hand.length;
  if (remaining > 0 && handLeft > 0) {
    next = { ...next, pendingDiscard: { ...pending, count: remaining } };
  } else if (pending.thenContinueConniveQueue && pending.thenContinueConniveQueue.length > 0) {
    const [nextConnivingId, ...rest] = pending.thenContinueConniveQueue;
    const drawn = getPlayer(next, playerId).zones.library.slice(0, 1);
    next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(drawn.length), hand: [...p.zones.hand, ...drawn] } }));
    next = { ...next, pendingDiscard: { sourceInstanceId: pending.sourceInstanceId, controllerId: playerId, count: 1, thenCounterOnInstanceIdIfNonland: nextConnivingId, thenContinueConniveQueue: rest } };
    const nextConnivingFound = findCardAnywhere(next, nextConnivingId);
    logLines.push(`${nextConnivingFound ? getCardDefinition(nextConnivingFound.card.defId).name : 'A creature'} connives.`);
  } else {
    next = { ...next, pendingDiscard: null };
  }

  return { ok: true, state: { ...next, log: [...next.log, ...logLines] } };
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
function resolveChooseOneMode(state: GameState, playerId: string, modeIndex: number, alsoModeIndex?: number): ActionResult {
  const pending = state.pendingChooseOneMode;
  if (!pending) return { ok: false, error: 'Nothing is waiting on a mode choice right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your choice to make." };
  const mode = pending.modes[modeIndex];
  if (!mode) return { ok: false, error: 'That is not a legal mode.' };

  let next: GameState = { ...state, pendingChooseOneMode: null };
  const resolved = resolveCardEffects(next, playerId, mode.effects, pending.sourceInstanceId);
  next = resolved.state;
  let logLines = resolved.logLines;

  // "If you control a commander, you may choose both instead" (SOLDIER
  // Military Program) - a second, distinct mode may also be resolved, but
  // only when the controller actually has a commander (not just because
  // the ability's own allowBothIfCommander flag is set).
  if (alsoModeIndex !== undefined && alsoModeIndex !== modeIndex) {
    if (!pending.allowBothIfCommander) return { ok: false, error: 'You may only choose one mode.' };
    if (!getPlayer(next, playerId).commanderDefId) return { ok: false, error: 'You need a commander to choose both modes.' };
    const alsoMode = pending.modes[alsoModeIndex];
    if (!alsoMode) return { ok: false, error: 'That is not a legal mode.' };
    const alsoResolved = resolveCardEffects(next, playerId, alsoMode.effects, pending.sourceInstanceId);
    next = alsoResolved.state;
    logLines = [...logLines, ...alsoResolved.logLines];
  }

  return { ok: true, state: { ...next, log: [...next.log, ...logLines] } };
}

/** "Target player draws N cards" (Combat Tutorial) - the first "target a
 * player" effect in this engine. See types.ts: DrawCardsFromTargetPlayerEffect. */
function choosePlayerTarget(state: GameState, playerId: string, targetPlayerId: string): ActionResult {
  const pending = state.pendingPlayerTarget;
  if (!pending) return { ok: false, error: 'Nothing is waiting on a player target right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your target to choose." };
  if (!state.players.some((p) => p.id === targetPlayerId)) return { ok: false, error: 'That is not a legal player target.' };
  if (pending.effect.type === 'drawCardsFromTargetPlayer' && pending.effect.opponentOnly && targetPlayerId === playerId) {
    return { ok: false, error: 'You must choose an opponent.' };
  }

  if (pending.effect.type === 'putCounterOnEachCreatureTargetPlayerControls') {
    const { counterLabel, counterAmount } = pending.effect;
    const target = getPlayer(state, targetPlayerId);
    let next = updatePlayer(state, targetPlayerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.map((c) => {
          if (getCardDefinition(c.defId).type !== 'creature') return c;
          const hasCounter = c.counters.some((ctr) => ctr.label === counterLabel);
          const counters = hasCounter
            ? c.counters.map((ctr) => (ctr.label === counterLabel ? { ...ctr, amount: ctr.amount + counterAmount } : ctr))
            : [...c.counters, { label: counterLabel, amount: counterAmount }];
          return { ...c, counters };
        }),
      },
    }));
    next = { ...next, pendingPlayerTarget: null };
    return { ok: true, state: { ...next, log: [...next.log, `Each creature ${target.name} controls gets a ${counterLabel} counter.`] } };
  }

  if (pending.effect.type === 'mayPutExactNamedCardFromLibraryToHandForTargetPlayer') {
    const next = { ...state, pendingPlayerTarget: null };
    const searchResult = beginLibrarySearch(next, targetPlayerId, pending.sourceInstanceId, { kind: 'exactName', name: pending.effect.name }, false);
    return { ok: true, state: { ...searchResult.state, log: [...searchResult.state.log, ...searchResult.logLines] } };
  }

  const { count, alsoCasterDraws } = pending.effect;
  const target = getPlayer(state, targetPlayerId);
  const drawn = target.zones.library.slice(0, count);
  let next = updatePlayer(state, targetPlayerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(count), hand: [...p.zones.hand, ...drawn] } }));
  const logLines = [`${target.name} draws ${drawn.length} card(s).`];
  if (alsoCasterDraws) {
    const caster = getPlayer(next, playerId);
    const casterDrawn = caster.zones.library.slice(0, count);
    next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(count), hand: [...p.zones.hand, ...casterDrawn] } }));
    logLines.push(`${caster.name} draws ${casterDrawn.length} card(s).`);
  }
  next = { ...next, pendingPlayerTarget: null };

  return { ok: true, state: { ...next, log: [...next.log, ...logLines] } };
}

/** "Return target creature card from your graveyard to the battlefield[,
 * with N additional counters on it]" (Evil Reawakened) - see types.ts:
 * ReanimateTargetFromGraveyardEffect. The picked card must be a creature in
 * the CONTROLLER's own graveyard (not any battlefield permanent, unlike the
 * rest of the pendingTarget family). */
function resolveReanimate(state: GameState, playerId: string, instanceId: string | null): ActionResult {
  const pending = state.pendingReanimate;
  if (!pending) return { ok: false, error: 'Nothing is waiting on a reanimation target right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your target to choose." };

  if (!instanceId) {
    if (!pending.effect.optional) return { ok: false, error: 'This ability requires a target.' };
    let next: GameState = { ...state, pendingReanimate: null };
    let declineLogLines: string[] = [];
    if (pending.effect.thenPutCounterOnSourceEqualToControlledCreatureCount) {
      const { counterLabel } = pending.effect.thenPutCounterOnSourceEqualToControlledCreatureCount;
      const resolved = resolveCardEffects(next, playerId, [{ type: 'putCounterOnSelf', counterLabel, counterAmount: 'controlledCreatureCount' }], pending.sourceInstanceId);
      next = resolved.state;
      declineLogLines = resolved.logLines;
    }
    return { ok: true, state: { ...next, log: [...next.log, `${getPlayer(next, playerId).name} declines.`, ...declineLogLines] } };
  }

  const player = getPlayer(state, playerId);
  // "...from A graveyard" (Reanimate) - search every player's graveyard
  // when anyGraveyard is set, instead of only the controller's own.
  // "...from THAT PLAYER's graveyard" (Sepulchral Primordial) - search
  // ONLY the opponent's when opponentGraveyardOnly is set instead.
  let ownerPlayerId = playerId;
  let card: CardInstance | undefined;
  if (pending.effect.opponentGraveyardOnly) {
    const opponent = getOpponent(state, playerId);
    card = opponent.zones.graveyard.find((c) => c.instanceId === instanceId);
    ownerPlayerId = opponent.id;
  } else {
    card = player.zones.graveyard.find((c) => c.instanceId === instanceId);
    if (!card && pending.effect.anyGraveyard) {
      for (const p of state.players) {
        const found = p.zones.graveyard.find((c) => c.instanceId === instanceId);
        if (found) {
          card = found;
          ownerPlayerId = p.id;
          break;
        }
      }
    }
  }
  if (!card) return { ok: false, error: 'That card is not in a graveyard.' };
  const def = getCardDefinition(card.defId);
  if (!matchesReanimateFilter(def, pending.effect)) {
    const wantCreature = !pending.effect.nonlegendaryPermanentInsteadOfCreature && !pending.effect.anyPermanentInsteadOfCreature;
    return { ok: false, error: `${def.name} is not a legal target - it must be a${wantCreature ? ' creature card' : ' nonlegendary permanent card'}.` };
  }

  const { extraCounterLabel, extraCounterAmount, forceEntersTapped } = pending.effect;
  const counters = extraCounterLabel && extraCounterAmount ? [{ label: extraCounterLabel, amount: extraCounterAmount }] : [];
  const hasHaste = hasKeyword(def, 'haste');
  const entersTapped = !!forceEntersTapped || !!def.entersTapped;
  const movedCard: CardInstance = stripSagaProgress({ ...card, tapped: entersTapped, damageMarked: 0, summoningSick: !hasHaste, counters, attachedToInstanceId: undefined });

  let next = updatePlayer(state, ownerPlayerId, (p) => ({ ...p, zones: { ...p.zones, graveyard: p.zones.graveyard.filter((c) => c.instanceId !== instanceId) } }));
  next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, battlefield: [...p.zones.battlefield, movedCard] } }));
  next = checkLegendRule(next, playerId);
  next = { ...next, pendingReanimate: null };

  let effectLogLines: string[] = [];
  if (def.onEnter && def.onEnter.length > 0) {
    const resolved = resolveCardEffects(next, playerId, def.onEnter, movedCard.instanceId);
    next = resolved.state;
    effectLogLines = resolved.logLines;
  }
  if (pending.effect.thenPutCounterOnSourceEqualToControlledCreatureCount) {
    const { counterLabel } = pending.effect.thenPutCounterOnSourceEqualToControlledCreatureCount;
    const resolved = resolveCardEffects(next, playerId, [{ type: 'putCounterOnSelf', counterLabel, counterAmount: 'controlledCreatureCount' }], pending.sourceInstanceId);
    next = resolved.state;
    effectLogLines = [...effectLogLines, ...resolved.logLines];
  }
  if (pending.effect.loseLifeEqualToManaValue) {
    next = loseLife(next, playerId, manaValue(parseCostLabel(def.costLabel)));
  }
  if (pending.effect.thenReturnUpToTwoAurasOrEquipmentAttached) {
    const hasEligible = getPlayer(next, playerId).zones.graveyard.some((c) => {
      const d = getCardDefinition(c.defId);
      return !!d.subtype?.toLowerCase().includes('aura') || !!d.subtype?.toLowerCase().includes('equipment');
    });
    if (hasEligible) {
      next = { ...next, pendingAttachFromGraveyardChoice: { sourceInstanceId: pending.sourceInstanceId, controllerId: playerId, attachToInstanceId: movedCard.instanceId, remaining: 2 } };
    }
  }

  const counterNote = counters.length > 0 ? ` with ${extraCounterAmount} ${extraCounterLabel} counter(s)` : '';
  return { ok: true, state: { ...next, log: [...next.log, `${getPlayer(next, playerId).name} returns ${def.name} to the battlefield${counterNote}.`, ...effectLogLines] } };
}

/** "...then return up to two target Aura and/or Equipment cards from your
 * graveyard to the battlefield attached to that creature. (If the Auras
 * can't enchant that creature, they remain in your graveyard.)" (Unfinished
 * Business) - instanceId: null stops early (always legal); otherwise the
 * chosen card must be an Aura or Equipment card in the controller's own
 * graveyard. If the reanimated creature is somehow no longer on the
 * battlefield, the pick simply fails (the card stays in the graveyard),
 * matching the printed reminder text. */
function resolveAttachFromGraveyardChoice(state: GameState, playerId: string, instanceId: string | null): ActionResult {
  const pending = state.pendingAttachFromGraveyardChoice;
  if (!pending) return { ok: false, error: 'Nothing is waiting on that choice right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your choice to make." };

  if (!instanceId) {
    return { ok: true, state: { ...state, pendingAttachFromGraveyardChoice: null, log: [...state.log, `${getPlayer(state, playerId).name} stops returning cards.`] } };
  }

  const player = getPlayer(state, playerId);
  const card = player.zones.graveyard.find((c) => c.instanceId === instanceId);
  if (!card) return { ok: false, error: 'That card is not in your graveyard.' };
  const def = getCardDefinition(card.defId);
  const isAuraOrEquipment = !!def.subtype?.toLowerCase().includes('aura') || !!def.subtype?.toLowerCase().includes('equipment');
  if (!isAuraOrEquipment) return { ok: false, error: `${def.name} is not a legal choice - it must be an Aura or Equipment card.` };

  const target = findCardAnywhere(state, pending.attachToInstanceId);
  let next = state;
  let logLine: string;
  if (!target || target.zone !== 'battlefield') {
    logLine = `${player.name} can't return ${def.name} - it remains in their graveyard.`;
  } else {
    next = updatePlayer(next, playerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        graveyard: p.zones.graveyard.filter((c) => c.instanceId !== instanceId),
        battlefield: [...p.zones.battlefield, { ...card, tapped: false, attachedToInstanceId: pending.attachToInstanceId }],
      },
    }));
    logLine = `${player.name} returns ${def.name} to the battlefield attached to ${getCardDefinition(target.card.defId).name}.`;
  }

  const remaining = pending.remaining - 1;
  const stillEligible =
    remaining > 0 &&
    getPlayer(next, playerId).zones.graveyard.some((c) => {
      const d = getCardDefinition(c.defId);
      return !!d.subtype?.toLowerCase().includes('aura') || !!d.subtype?.toLowerCase().includes('equipment');
    });
  next = { ...next, pendingAttachFromGraveyardChoice: stillEligible ? { ...pending, remaining } : null };
  return { ok: true, state: { ...next, log: [...next.log, logLine] } };
}

/** "Throw — ...you may sacrifice another nonland permanent. If you do,
 * draw two cards and each opponent loses life equal to the mana value of
 * the sacrificed permanent." (Shadow, Mysterious Assassin) - instanceId:
 * null declines. */
function resolveMaySacrificeForDrawAndDrainChoice(state: GameState, playerId: string, instanceId: string | null): ActionResult {
  const pending = state.pendingMaySacrificeForDrawAndDrainChoice;
  if (!pending) return { ok: false, error: 'Nothing is waiting on that choice right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your choice to make." };

  if (!instanceId) {
    return { ok: true, state: { ...state, pendingMaySacrificeForDrawAndDrainChoice: null, log: [...state.log, `${getPlayer(state, playerId).name} declines.`] } };
  }

  const player = getPlayer(state, playerId);
  const card = player.zones.battlefield.find((c) => c.instanceId === instanceId);
  if (!card || instanceId === pending.sourceInstanceId) {
    return { ok: false, error: 'You must sacrifice ANOTHER permanent you control.' };
  }
  const def = getCardDefinition(card.defId);
  if (def.type === 'land') return { ok: false, error: `${def.name} is not a legal choice - it must be a nonland permanent.` };

  const mv = manaValue(parseCostLabel(def.costLabel));
  const sacResult = moveCreaturesToGraveyardAndTrigger(state, [instanceId], 'is sacrificed');
  let next = sacResult.state;

  const drawn = getPlayer(next, playerId).zones.library.slice(0, pending.drawCount);
  next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(pending.drawCount), hand: [...p.zones.hand, ...drawn] } }));

  const opponent = getOpponent(next, playerId);
  next = updatePlayer(next, opponent.id, (p) => ({ ...p, life: p.life - mv }));
  next = { ...next, pendingMaySacrificeForDrawAndDrainChoice: null };

  const player2 = getPlayer(next, playerId);
  return {
    ok: true,
    state: {
      ...next,
      log: [...next.log, ...sacResult.logLines, `${player2.name} draws ${drawn.length} card(s) and ${opponent.name} loses ${mv} life.`],
    },
  };
}

/** "Sketch and Lore — ...You may cast that card without paying its mana
 * cost. If you cast a creature spell this way, it gains haste and 'At the
 * beginning of the end step, sacrifice this creature.'" (Strago and Relm) -
 * accept: false declines (the found card just stays in exile, unplayed). */
function resolveStragoAndRelmChoice(state: GameState, playerId: string, accept: boolean): ActionResult {
  const pending = state.pendingStragoAndRelmChoice;
  if (!pending) return { ok: false, error: 'Nothing is waiting on that choice right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your choice to make." };

  if (!accept) {
    return { ok: true, state: { ...state, pendingStragoAndRelmChoice: null, log: [...state.log, `${getPlayer(state, playerId).name} declines.`] } };
  }

  const found = findCardAnywhere(state, pending.foundInstanceId);
  if (!found || found.zone !== 'exile') return { ok: false, error: 'That card is not in exile.' };
  const def = getCardDefinition(found.card.defId);
  const isPermanent = def.type === 'creature';
  let next = updatePlayer(state, found.ownerPlayerId, (p) => ({ ...p, zones: { ...p.zones, exile: p.zones.exile.filter((c) => c.instanceId !== pending.foundInstanceId) } }));

  const movedCard: CardInstance = isPermanent
    ? { ...found.card, tapped: false, summoningSick: false }
    : found.card;
  const targetZone: 'battlefield' | 'graveyard' = isPermanent ? 'battlefield' : 'graveyard';
  const targetOwnerId = isPermanent ? playerId : found.ownerPlayerId;
  next = updatePlayer(next, targetOwnerId, (p) => ({ ...p, zones: { ...p.zones, [targetZone]: [...p.zones[targetZone], movedCard] } }));
  if (isPermanent) next = checkLegendRule(next, playerId);

  let logLines = [`${getPlayer(next, playerId).name} casts ${def.name} from exile without paying its mana cost.`];
  const autoEffects = isPermanent ? def.onEnter : def.onCast;
  if (autoEffects && autoEffects.length > 0) {
    const resolved = resolveCardEffects(next, playerId, autoEffects, movedCard.instanceId);
    next = resolved.state;
    logLines = [...logLines, ...resolved.logLines];
  }

  if (isPermanent) {
    // "...it gains haste and 'At the beginning of the end step, sacrifice
    // this creature.'" - haste is already baked into summoningSick: false
    // above; queue the delayed sacrifice via the same generic
    // pendingDelayedEndStepEffects/SacrificeSelfEffect plumbing Blitz uses.
    next = { ...next, pendingDelayedEndStepEffects: [...next.pendingDelayedEndStepEffects, { controllerId: playerId, sourceInstanceId: movedCard.instanceId, effects: [{ type: 'sacrificeSelf' }] }] };
  }

  next = { ...next, pendingStragoAndRelmChoice: null };
  return { ok: true, state: { ...next, log: [...next.log, ...logLines] } };
}

/** "Blitz—[cost], Discard a card." (Sabin, Master Monk) - casts the card
 * from HAND or GRAVEYARD for its BlitzAbility.cost instead of its normal
 * costLabel, discarding `discardInstanceId` as part of the cost, granting
 * haste and a persistent "draw a card when this dies" grant, then queuing
 * a delayed self-sacrifice at the next end step. Deliberately narrower
 * than castCard - no onEnter-adjacent extras (Saga/artifact/subtype/
 * creature-watcher triggers) since every Blitz card in this pool so far
 * is a plain creature with no such clauses. */
function castWithBlitz(state: GameState, playerId: string, instanceId: string, discardInstanceId: string): ActionResult {
  const player = getPlayer(state, playerId);
  const mutual = isMutualActive(state);

  let card = player.zones.hand.find((c) => c.instanceId === instanceId);
  let sourceZone: 'hand' | 'graveyard' | null = card ? 'hand' : null;
  if (!card) {
    card = player.zones.graveyard.find((c) => c.instanceId === instanceId);
    if (card) sourceZone = 'graveyard';
  }
  if (!card || !sourceZone) return { ok: false, error: 'That card is not in your hand or graveyard.' };
  const def = getCardDefinition(card.defId);
  if (!def.blitz) return { ok: false, error: `${def.name} has no Blitz ability.` };
  if (!mutual && (state.activePlayerId !== playerId || (state.phase !== 'main1' && state.phase !== 'main2'))) {
    return { ok: false, error: `${def.name} can only be Blitzed on your own turn, during a main phase.` };
  }

  const discardCard = player.zones.hand.find((c) => c.instanceId === discardInstanceId);
  if (!discardCard || discardInstanceId === instanceId) {
    return { ok: false, error: 'Blitz requires discarding a different card from your hand.' };
  }
  const discardDef = getCardDefinition(discardCard.defId);

  const parsed = parseCostLabel(def.blitz.cost);
  if (!mutual && !canPay(player.manaPool, parsed, 0)) {
    return { ok: false, error: `Not enough mana to Blitz ${def.name} (${def.blitz.cost}).` };
  }

  let next = state;
  if (!mutual) next = updatePlayer(next, playerId, (p) => ({ ...p, manaPool: payCost(p.manaPool, parsed, 0) }));
  next = updatePlayer(next, playerId, (p) => ({
    ...p,
    zones: { ...p.zones, hand: p.zones.hand.filter((c) => c.instanceId !== discardInstanceId), graveyard: [...p.zones.graveyard, { ...discardCard, tapped: false, graveyardEntrySource: 'other' }] },
  }));
  next = updatePlayer(next, playerId, (p) => ({
    ...p,
    zones: { ...p.zones, [sourceZone]: p.zones[sourceZone!].filter((c) => c.instanceId !== instanceId) },
  }));

  const movedCard: CardInstance = { ...card, tapped: !!def.entersTapped, damageMarked: 0, summoningSick: false, grantsOnDeathDrawCardWhileBlitzed: true };
  next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, battlefield: [...p.zones.battlefield, movedCard] } }));
  next = checkLegendRule(next, playerId);
  next = { ...next, pendingDelayedEndStepEffects: [...next.pendingDelayedEndStepEffects, { controllerId: playerId, sourceInstanceId: movedCard.instanceId, effects: [{ type: 'sacrificeSelf' }] }] };

  let logLines = [`${player.name} Blitzes ${def.name} (discarding ${discardDef.name}).`];
  if (def.onEnter && def.onEnter.length > 0) {
    const resolved = resolveCardEffects(next, playerId, def.onEnter, movedCard.instanceId);
    next = resolved.state;
    logLines = [...logLines, ...resolved.logLines];
  }

  return { ok: true, state: { ...next, log: [...next.log, ...logLines] } };
}

/** "Unearth [cost] (...)" (Priest of Fell Rites) - see UnearthAbility.
 * Graveyard-only (unlike castWithBlitz, never from hand), no discard cost,
 * just mana. Grants haste (summoningSick: false) and queues a delayed
 * ExileSelfEffect via pendingDelayedEndStepEffects, same plumbing Blitz's
 * own delayed sacrifice uses. */
function activateUnearth(state: GameState, playerId: string, instanceId: string): ActionResult {
  const player = getPlayer(state, playerId);
  const mutual = isMutualActive(state);

  const card = player.zones.graveyard.find((c) => c.instanceId === instanceId);
  if (!card) return { ok: false, error: 'That card is not in your graveyard.' };
  const def = getCardDefinition(card.defId);
  if (!def.unearth) return { ok: false, error: `${def.name} has no Unearth ability.` };
  if (!mutual && (state.activePlayerId !== playerId || (state.phase !== 'main1' && state.phase !== 'main2'))) {
    return { ok: false, error: `${def.name} can only be Unearthed on your own turn, during a main phase.` };
  }

  const parsed = parseCostLabel(def.unearth.cost);
  if (!mutual && !canPay(player.manaPool, parsed, 0)) {
    return { ok: false, error: `Not enough mana to Unearth ${def.name} (${def.unearth.cost}).` };
  }

  let next = state;
  if (!mutual) next = updatePlayer(next, playerId, (p) => ({ ...p, manaPool: payCost(p.manaPool, parsed, 0) }));
  next = updatePlayer(next, playerId, (p) => ({
    ...p,
    zones: { ...p.zones, graveyard: p.zones.graveyard.filter((c) => c.instanceId !== instanceId) },
  }));

  const movedCard: CardInstance = { ...card, tapped: !!def.entersTapped, damageMarked: 0, summoningSick: false };
  next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, battlefield: [...p.zones.battlefield, movedCard] } }));
  next = checkLegendRule(next, playerId);
  next = { ...next, pendingDelayedEndStepEffects: [...next.pendingDelayedEndStepEffects, { controllerId: playerId, sourceInstanceId: movedCard.instanceId, effects: [{ type: 'exileSelf' }] }] };

  let logLines = [`${player.name} Unearths ${def.name}.`];
  if (def.onEnter && def.onEnter.length > 0) {
    const resolved = resolveCardEffects(next, playerId, def.onEnter, movedCard.instanceId);
    next = resolved.state;
    logLines = [...logLines, ...resolved.logLines];
  }
  if (def.saga) {
    const sagaResult = triggerSagaLoreCounter(next, playerId, movedCard.instanceId);
    next = sagaResult.state;
    logLines = [...logLines, ...sagaResult.logLines];
  }

  return { ok: true, state: { ...next, log: [...next.log, ...logLines] } };
}

/** "...each opponent chooses a creature card in your graveyard..." (Rejoin
 * the Fight) - the DECIDER is the opponent (pending.opponentId), not the
 * caster who benefits (pending.casterId); the chosen card always returns
 * to the battlefield under the CASTER's control regardless of whose
 * graveyard it's sitting in (always the caster's own here). Declining
 * (instanceId: null) is always allowed, same as every other "nothing to
 * choose" pending in this engine. */
function resolveRejoinTheFightChoice(state: GameState, playerId: string, instanceId: string | null): ActionResult {
  const pending = state.pendingRejoinTheFightChoice;
  if (!pending) return { ok: false, error: 'Nothing is waiting on that choice right now.' };
  if (pending.opponentId !== playerId) return { ok: false, error: "It's not your choice to make." };

  if (!instanceId) {
    return { ok: true, state: { ...state, pendingRejoinTheFightChoice: null, log: [...state.log, `${getPlayer(state, playerId).name} declines to choose.`] } };
  }

  const caster = getPlayer(state, pending.casterId);
  const card = caster.zones.graveyard.find((c) => c.instanceId === instanceId);
  if (!card) return { ok: false, error: 'That card is not in the graveyard.' };
  const def = getCardDefinition(card.defId);
  if (def.type !== 'creature') return { ok: false, error: `${def.name} is not a legal choice - it must be a creature card.` };

  const hasHaste = hasKeyword(def, 'haste');
  const movedCard: CardInstance = stripSagaProgress({ ...card, tapped: !!def.entersTapped, damageMarked: 0, summoningSick: !hasHaste, counters: [], attachedToInstanceId: undefined });
  let next = updatePlayer(state, pending.casterId, (p) => ({
    ...p,
    zones: { ...p.zones, graveyard: p.zones.graveyard.filter((c) => c.instanceId !== instanceId), battlefield: [...p.zones.battlefield, movedCard] },
  }));
  next = checkLegendRule(next, pending.casterId);
  next = { ...next, pendingRejoinTheFightChoice: null };

  let effectLogLines: string[] = [];
  if (def.onEnter && def.onEnter.length > 0) {
    const resolved = resolveCardEffects(next, pending.casterId, def.onEnter, movedCard.instanceId);
    next = resolved.state;
    effectLogLines = resolved.logLines;
  }

  const chooser = getPlayer(state, playerId);
  const casterAfter = getPlayer(next, pending.casterId);
  return {
    ok: true,
    state: { ...next, log: [...next.log, `${chooser.name} returns ${def.name} to the battlefield under ${casterAfter.name}'s control.`, ...effectLogLines] },
  };
}

/** "For each player, you choose from among the permanents that player
 * controls an artifact, a creature, an enchantment, and a planeswalker.
 * Then each player sacrifices all other nonland permanents they control."
 * (Tragic Arrogance) - walks pending.remainingSteps one (playerId,
 * cardType) pair at a time; the CASTER makes every choice (not each
 * player for themselves). instanceId: null declines that one exemption.
 * Once remainingSteps is exhausted, every nonland permanent not in
 * exemptInstanceIds is sacrificed in one pass. */
function resolveTragicArroganceChoice(state: GameState, playerId: string, instanceId: string | null): ActionResult {
  const pending = state.pendingTragicArroganceChoice;
  if (!pending) return { ok: false, error: 'Nothing is waiting on that choice right now.' };
  if (pending.casterId !== playerId) return { ok: false, error: "It's not your choice to make." };
  const step = pending.remainingSteps[0];
  if (!step) return { ok: false, error: 'No choice is pending.' };

  let exemptInstanceIds = pending.exemptInstanceIds;
  const caster = getPlayer(state, playerId);
  if (instanceId) {
    const target = getPlayer(state, step.playerId).zones.battlefield.find((c) => c.instanceId === instanceId);
    if (!target) return { ok: false, error: 'That is not a legal permanent to exempt.' };
    const def = getCardDefinition(target.defId);
    if (def.type !== step.cardType) {
      const article = step.cardType === 'artifact' || step.cardType === 'enchantment' ? 'an' : 'a';
      return { ok: false, error: `You must choose ${article} ${step.cardType}.` };
    }
    exemptInstanceIds = [...exemptInstanceIds, instanceId];
  }

  const remainingSteps = pending.remainingSteps.slice(1);
  if (remainingSteps.length > 0) {
    return { ok: true, state: { ...state, pendingTragicArroganceChoice: { ...pending, remainingSteps, exemptInstanceIds }, log: [...state.log, `${caster.name} makes their choices.`] } };
  }

  let next: GameState = { ...state, pendingTragicArroganceChoice: null };
  const toSacrifice: string[] = [];
  for (const p of next.players) {
    for (const c of p.zones.battlefield) {
      if (getCardDefinition(c.defId).type === 'land') continue;
      if (exemptInstanceIds.includes(c.instanceId)) continue;
      toSacrifice.push(c.instanceId);
    }
  }
  if (toSacrifice.length > 0) {
    const result = moveCreaturesToGraveyardAndTrigger(next, toSacrifice, 'is sacrificed');
    next = { ...result.state, log: [...result.state.log, ...result.logLines] };
  }
  return { ok: true, state: { ...next, log: [...next.log, `Tragic Arrogance resolves - ${toSacrifice.length} permanent(s) sacrificed.`] } };
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

/** "Whenever equipped creature attacks, look at the top card of your
 * library. If it's a land card, you may put it onto the battlefield
 * tapped." (Explorer's Scope) - only ever called while
 * pendingMayPutTopLandOntoBattlefieldTapped is armed, which already
 * confirmed the top card is a land, so there's no re-validation of card type
 * here - just the accept/decline split. */
function resolveMayPutTopLandOntoBattlefieldTapped(state: GameState, playerId: string, accept: boolean): ActionResult {
  const pending = state.pendingMayPutTopLandOntoBattlefieldTapped;
  if (!pending) return { ok: false, error: 'Nothing is waiting on that choice right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your choice to make." };

  if (!accept) {
    return { ok: true, state: { ...state, pendingMayPutTopLandOntoBattlefieldTapped: null, log: [...state.log, `${getPlayer(state, playerId).name} declines.`] } };
  }

  const player = getPlayer(state, playerId);
  const topCard = player.zones.library[0];
  if (!topCard) return { ok: true, state: { ...state, pendingMayPutTopLandOntoBattlefieldTapped: null } };
  const def = getCardDefinition(topCard.defId);
  const movedCard: CardInstance = { ...topCard, tapped: true, damageMarked: 0, summoningSick: false };
  let next = updatePlayer(state, playerId, (p) => ({
    ...p,
    zones: { ...p.zones, library: p.zones.library.slice(1), battlefield: [...p.zones.battlefield, movedCard] },
  }));
  next = checkLegendRule(next, playerId);
  next = { ...next, pendingMayPutTopLandOntoBattlefieldTapped: null };

  let effectLogLines: string[] = [];
  if (def.onEnter && def.onEnter.length > 0) {
    const resolved = resolveCardEffects(next, playerId, def.onEnter, movedCard.instanceId);
    next = resolved.state;
    effectLogLines = resolved.logLines;
  }
  const landfallResult = triggerLandfall(next, playerId);
  next = landfallResult.state;
  effectLogLines = [...effectLogLines, ...landfallResult.logLines];

  return { ok: true, state: { ...next, log: [...next.log, `${player.name} puts ${def.name} onto the battlefield tapped.`, ...effectLogLines] } };
}

/** "You may put a creature card and/or a land card from your hand onto the
 * battlefield" (Yuna's Decision) - two INDEPENDENT "you may" choices, so
 * `pending.stage` tracks which one is currently being offered; declining
 * (instanceId: null) or completing the 'creature' stage always advances to
 * 'land', and resolving 'land' clears pendingPutCreatureAndOrLandFromHand
 * entirely. The creature half mirrors castCard's own permanent-enters
 * plumbing (onEnter, creature/subtype enter watchers, summoning sickness
 * unless it has haste) rather than resolvePutLandFromHand's simpler land-only
 * shape just above. */
function resolvePutCreatureOrLandFromHand(state: GameState, playerId: string, instanceId: string | null): ActionResult {
  const pending = state.pendingPutCreatureAndOrLandFromHand;
  if (!pending) return { ok: false, error: 'Nothing is waiting on that choice right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your choice to make." };

  const nextStage = pending.stage === 'creature' ? { controllerId: playerId, stage: 'land' as const } : null;

  if (!instanceId) {
    return { ok: true, state: { ...state, pendingPutCreatureAndOrLandFromHand: nextStage } };
  }

  const player = getPlayer(state, playerId);
  const card = player.zones.hand.find((c) => c.instanceId === instanceId);
  if (!card) return { ok: false, error: 'That card is not in your hand.' };
  const def = getCardDefinition(card.defId);
  if (pending.stage === 'creature' && def.type !== 'creature') return { ok: false, error: `${def.name} is not a creature.` };
  if (pending.stage === 'land' && def.type !== 'land') return { ok: false, error: `${def.name} is not a land.` };

  const movedCard: CardInstance = {
    ...card,
    tapped: !!def.entersTapped,
    damageMarked: 0,
    summoningSick: def.type === 'creature' ? !hasKeyword(def, 'haste') : false,
  };
  let next = updatePlayer(state, playerId, (p) => ({
    ...p,
    zones: { ...p.zones, hand: p.zones.hand.filter((c) => c.instanceId !== instanceId), battlefield: [...p.zones.battlefield, movedCard] },
  }));
  next = checkLegendRule(next, playerId);
  next = { ...next, pendingPutCreatureAndOrLandFromHand: nextStage };

  let effectLogLines: string[] = [];
  if (def.onEnter && def.onEnter.length > 0) {
    const resolved = resolveCardEffects(next, playerId, def.onEnter, movedCard.instanceId);
    next = resolved.state;
    effectLogLines = resolved.logLines;
  }
  if (def.type === 'creature') {
    const creatureWatchResult = triggerCreatureEnterWatchers(next, playerId, movedCard.instanceId);
    next = creatureWatchResult.state;
    effectLogLines = [...effectLogLines, ...creatureWatchResult.logLines];
    const subtypeWatchResult = triggerSubtypeEnterWatchers(next, playerId, def.subtype);
    next = subtypeWatchResult.state;
    effectLogLines = [...effectLogLines, ...subtypeWatchResult.logLines];
  } else {
    const landfallResult = triggerLandfall(next, playerId);
    next = landfallResult.state;
    effectLogLines = [...effectLogLines, ...landfallResult.logLines];
  }

  return { ok: true, state: { ...next, log: [...next.log, `${player.name} puts ${def.name} onto the battlefield.`, ...effectLogLines] } };
}

/** "As this land enters, you may reveal a [name] or [name] card from your
 * hand. If you don't, this land enters tapped" (a check land, Fortified
 * Village) - the land already entered tapped by the time this is set (see
 * castCard's land-playing branch); revealing a matching card untaps it,
 * null (or a non-matching card) leaves it tapped. Revealing doesn't move or
 * exile the card - it stays in hand, this is a look-and-verify only. */
function resolveRevealLandTypeFromHand(state: GameState, playerId: string, instanceId: string | null): ActionResult {
  const pending = state.pendingRevealLandTypeFromHand;
  if (!pending) return { ok: false, error: 'Nothing is waiting on that choice right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your choice to make." };

  if (!instanceId) {
    return { ok: true, state: { ...state, pendingRevealLandTypeFromHand: null } };
  }

  const player = getPlayer(state, playerId);
  const card = player.zones.hand.find((c) => c.instanceId === instanceId);
  if (!card) return { ok: false, error: 'That card is not in your hand.' };
  const def = getCardDefinition(card.defId);
  if (!pending.landNames.includes(def.name)) return { ok: false, error: `${def.name} doesn't match what's needed here.` };

  const landFound = findCardAnywhere(state, pending.sourceInstanceId);
  let next = state;
  if (landFound && landFound.zone === 'battlefield') {
    next = updatePlayer(next, landFound.ownerPlayerId, (p) => ({
      ...p,
      zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === pending.sourceInstanceId ? { ...c, tapped: false } : c)) },
    }));
  }
  const landName = landFound ? getCardDefinition(landFound.card.defId).name : 'This land';
  next = { ...next, pendingRevealLandTypeFromHand: null };
  return { ok: true, state: { ...next, log: [...next.log, `${player.name} reveals ${def.name} - ${landName} enters untapped.`] } };
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

  // "...target instant or sorcery card from YOUR graveyard" (Emet-Selch of
  // the Third Seat's ownGraveyardOnly) - restricted to the controller's own
  // graveyard, unlike Quistis Trepe's default (either player's, via
  // findCardAnywhere searching every zone of every player).
  const found = pending.ownGraveyardOnly
    ? (() => {
        const card = getPlayer(state, playerId).zones.graveyard.find((c) => c.instanceId === instanceId);
        return card ? { ownerPlayerId: playerId, zone: 'graveyard' as const, card } : null;
      })()
    : findCardAnywhere(state, instanceId);
  if (!found || found.zone !== 'graveyard') return { ok: false, error: 'That card is not in a graveyard.' };
  const def = getCardDefinition(found.card.defId);
  const eligibleTypes = pending.instantOnly ? ['instant'] : ['instant', 'sorcery'];
  if (!eligibleTypes.includes(def.type)) {
    return { ok: false, error: pending.instantOnly ? `${def.name} is not a legal target - it must be an instant card.` : `${def.name} is not a legal target - it must be an instant or sorcery card.` };
  }

  const mutual = isMutualActive(state);
  const player = getPlayer(state, playerId);
  const preCastBattlefieldIds = new Set(player.zones.battlefield.map((c) => c.instanceId));
  const parsed = parseCostLabel(def.costLabel);
  const colorPips = Object.values(parsed.colors).reduce((a: number, b) => a + (b ?? 0), 0);
  // "Spells you cast from your graveyard cost [discount] less to cast"
  // (Emet-Selch) - reduces the generic portion only, never below 0, same
  // shape as every other flat cast-cost discount in this engine.
  // "...without paying its mana cost" (Torrential Gearhulk's `free`) skips
  // payment entirely instead of just discounting it.
  const effectiveParsed = { generic: pending.free ? 0 : Math.max(0, parsed.generic + colorPips - (pending.discount ?? 0)), colors: {}, hasX: parsed.hasX };

  if (!mutual && !pending.free && !canPay(player.manaPool, effectiveParsed, 0)) {
    return { ok: false, error: `Not enough mana to cast ${def.name} (${def.costLabel}).` };
  }

  let next = state;
  if (!mutual && !pending.free) next = updatePlayer(next, playerId, (p) => ({ ...p, manaPool: payCost(p.manaPool, effectiveParsed, 0) }));
  next = updatePlayer(next, found.ownerPlayerId, (p) => ({ ...p, zones: { ...p.zones, graveyard: p.zones.graveyard.filter((c) => c.instanceId !== instanceId) } }));
  next = { ...next, pendingCastFromGraveyardAnyMana: null };

  let effectLogLines: string[] = [];
  if (def.onCast && def.onCast.length > 0) {
    const resolved = resolveCardEffects(next, playerId, def.onCast, instanceId);
    next = resolved.state;
    effectLogLines = resolved.logLines;
  }
  const triggered = triggerNoncreatureCastAbilities(next, playerId, manaValue(effectiveParsed), preCastBattlefieldIds, def.type);
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
  const triggered = triggerNoncreatureCastAbilities(next, playerId, manaValue(parsed), preCastBattlefieldIds, def.type);
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

/** "Raise" (Aerith, Last Ancient) - `pending.toBattlefield` was already
 * decided at arming time (see types.ts: GameState.
 * pendingReturnCreatureFromGraveyardHandOrBattlefield's own doc comment).
 * Declining (instanceId: null) is always allowed - the ability names no
 * "must" wording. */
function resolveReturnCreatureFromGraveyardHandOrBattlefield(state: GameState, playerId: string, instanceId: string | null): ActionResult {
  const pending = state.pendingReturnCreatureFromGraveyardHandOrBattlefield;
  if (!pending) return { ok: false, error: 'Nothing is waiting on that choice right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your choice to make." };

  if (!instanceId) {
    return { ok: true, state: { ...state, pendingReturnCreatureFromGraveyardHandOrBattlefield: null, log: [...state.log, `${getPlayer(state, playerId).name} declines.`] } };
  }

  const player = getPlayer(state, playerId);
  const card = player.zones.graveyard.find((c) => c.instanceId === instanceId);
  if (!card) return { ok: false, error: 'That card is not in your graveyard.' };
  const def = getCardDefinition(card.defId);
  if (def.type !== 'creature') return { ok: false, error: `${def.name} is not a legal target - it must be a creature card.` };

  let next: GameState;
  let effectLogLines: string[] = [];
  if (pending.toBattlefield) {
    const hasHaste = hasKeyword(def, 'haste');
    const movedCard: CardInstance = stripSagaProgress({ ...card, tapped: !!def.entersTapped, damageMarked: 0, summoningSick: !hasHaste, attachedToInstanceId: undefined });
    next = updatePlayer(state, playerId, (p) => ({
      ...p,
      zones: { ...p.zones, graveyard: p.zones.graveyard.filter((c) => c.instanceId !== instanceId), battlefield: [...p.zones.battlefield, movedCard] },
    }));
    next = checkLegendRule(next, playerId);
    if (def.onEnter && def.onEnter.length > 0) {
      const resolved = resolveCardEffects(next, playerId, def.onEnter, movedCard.instanceId);
      next = resolved.state;
      effectLogLines = resolved.logLines;
    }
  } else {
    next = updatePlayer(state, playerId, (p) => ({
      ...p,
      zones: { ...p.zones, graveyard: p.zones.graveyard.filter((c) => c.instanceId !== instanceId), hand: [...p.zones.hand, card] },
    }));
  }
  next = { ...next, pendingReturnCreatureFromGraveyardHandOrBattlefield: null };
  const destinationNote = pending.toBattlefield ? 'the battlefield' : 'their hand';
  return { ok: true, state: { ...next, log: [...next.log, `${player.name} returns ${def.name} to ${destinationNote}.`, ...effectLogLines] } };
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

/** "Then you may have [this] become a copy of that creature" (Kimahri,
 * Valiant Guardian's Ronso Rage) - see CardInstance.copiedStatsFromDefId's
 * own doc comment for why this only copies power/toughness. */
function resolveOptionalBecomeCopy(state: GameState, playerId: string, accept: boolean): ActionResult {
  const pending = state.pendingOptionalBecomeCopy;
  if (!pending) return { ok: false, error: 'Nothing is waiting on a become-copy choice right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your choice to make." };

  if (!accept) {
    return { ok: true, state: { ...state, pendingOptionalBecomeCopy: null } };
  }

  const found = findCardAnywhere(state, pending.sourceInstanceId);
  if (!found || found.zone !== 'battlefield') {
    return { ok: true, state: { ...state, pendingOptionalBecomeCopy: null } };
  }
  const copyDef = getCardDefinition(pending.copyDefId);
  const sourceDef = getCardDefinition(found.card.defId);
  const next = updatePlayer(state, found.ownerPlayerId, (p) => ({
    ...p,
    zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === pending.sourceInstanceId ? { ...c, copiedStatsFromDefId: pending.copyDefId } : c)) },
  }));
  return {
    ok: true,
    state: {
      ...next,
      pendingOptionalBecomeCopy: null,
      log: [...next.log, `${sourceDef.name} becomes a copy of ${copyDef.name}'s power and toughness (keeping its own name and abilities).`],
    },
  };
}

/** "The owner ... puts it on their choice of the top or bottom of their
 * library." (Endless Detour) - the OWNER chooses, not the caster (see
 * pending.ownerId, distinct from pending.casterId which is only kept for
 * bookkeeping/log purposes and never actually used to gate this choice). */
function resolveLibraryPlacementChoice(state: GameState, playerId: string, toTop: boolean): ActionResult {
  const pending = state.pendingLibraryPlacementChoice;
  if (!pending) return { ok: false, error: 'Nothing is waiting on a library placement choice right now.' };
  if (pending.ownerId !== playerId) return { ok: false, error: "It's not your choice to make." };

  const found = findCardAnywhere(state, pending.targetInstanceId);
  if (!found || found.zone !== 'battlefield') {
    return { ok: true, state: { ...state, pendingLibraryPlacementChoice: null } };
  }
  const def = getCardDefinition(found.card.defId);
  let next = detachEverythingFrom(state, pending.targetInstanceId);
  const movedCard: CardInstance = { ...found.card, tapped: false, attachedToInstanceId: undefined, damageMarked: 0, counters: [], summoningSick: false };
  next = updatePlayer(next, pending.ownerId, (p) => ({
    ...p,
    zones: {
      ...p.zones,
      battlefield: p.zones.battlefield.filter((c) => c.instanceId !== pending.targetInstanceId),
      library: toTop ? [movedCard, ...p.zones.library] : [...p.zones.library, movedCard],
    },
  }));
  const owner = getPlayer(next, pending.ownerId);
  next = { ...next, pendingLibraryPlacementChoice: null, log: [...next.log, `${owner.name} puts ${def.name} on the ${toTop ? 'top' : 'bottom'} of their library.`] };
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

/** The MANA-cost cousin of resolveOptionalPayLife above (Terra, Herald of
 * Hope's combat-damage trigger; Banon's attack trigger). Declining, or being
 * unable to pay, both just clear the pending choice. */
function resolveOptionalPayMana(state: GameState, playerId: string, accept: boolean): ActionResult {
  const pending = state.pendingOptionalPayMana;
  if (!pending) return { ok: false, error: 'Nothing is waiting on an optional payment right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your choice to make." };

  if (!accept) {
    return { ok: true, state: { ...state, pendingOptionalPayMana: null } };
  }

  const player = getPlayer(state, playerId);
  const mutual = isMutualActive(state);
  const parsed = parseCostLabel(pending.manaCost);
  if (!mutual && !canPay(player.manaPool, parsed, 0)) {
    return { ok: false, error: `Not enough mana to pay (${pending.manaCost}).` };
  }

  const sourceName = getCardDefinition(findCardAnywhere(state, pending.sourceInstanceId)!.card.defId).name;
  let next = state;
  if (!mutual) next = updatePlayer(next, playerId, (p) => ({ ...p, manaPool: payCost(p.manaPool, parsed, 0) }));
  next = { ...next, log: [...next.log, `${getPlayer(next, playerId).name} pays ${pending.manaCost} for ${sourceName}.`] };
  const resolved = resolveCardEffects(next, playerId, pending.effects, pending.sourceInstanceId);
  next = { ...resolved.state, pendingOptionalPayMana: null, log: [...resolved.state.log, ...resolved.logLines] };
  return { ok: true, state: next };
}

/** "You may [do X]" with no cost (Tidus, Yuna's Guardian's Cheer) - the
 * no-cost cousin of resolveOptionalPayLife just above. */
function resolveMayEffect(state: GameState, playerId: string, accept: boolean): ActionResult {
  const pending = state.pendingMayEffect;
  if (!pending) return { ok: false, error: 'Nothing is waiting on an optional choice right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your choice to make." };

  if (!accept) {
    return { ok: true, state: { ...state, pendingMayEffect: null } };
  }

  const resolved = resolveCardEffects(state, playerId, pending.effects, pending.sourceInstanceId);
  const next = { ...resolved.state, pendingMayEffect: null, log: [...resolved.state.log, ...resolved.logLines] };
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
  if (manaValue(effectiveCastCost(def, player, getOpponent(state, playerId))) > pending.maxManaValue) {
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
function resolveLibrarySearch(state: GameState, playerId: string, instanceId: string | null, chosenToBattlefieldTapped?: boolean): ActionResult {
  const pending = state.pendingLibrarySearch;
  if (!pending) return { ok: false, error: 'Nothing is waiting on a library search right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your search to make." };

  const player = getPlayer(state, playerId);
  const chainedSearchForPlayerId = pending.chainedSearchForPlayerId;
  const chainedSearchToHand = pending.chainedSearchToHand;
  // "That land's controller may search... You may also search..."
  // (Demolition Field) - once THIS search resolves (found or declined),
  // immediately arm the chained search for the other player rather than
  // just clearing pendingLibrarySearch. "...put one onto the battlefield
  // tapped and the other into your hand" (Cultivate) - chainedSearchToHand
  // is the same idea for the SAME player, just to a different destination
  // (plain hand - no battlefield flags passed through).
  const continueChain = (resolvedState: GameState): GameState => {
    // Only once the WHOLE search sequence for this player is actually
    // done - a still-ongoing multi-pick search (remainingPicks) re-arms
    // pendingLibrarySearch for ANOTHER pick of the SAME player first.
    if (resolvedState.pendingLibrarySearch) return resolvedState;
    if (chainedSearchForPlayerId) {
      const chained = beginLibrarySearch(
        resolvedState,
        chainedSearchForPlayerId,
        pending.sourceInstanceId,
        pending.filter,
        pending.reveal,
        pending.toBattlefieldTapped,
        undefined,
        undefined,
        pending.toBattlefieldUntapped
      );
      return { ...chained.state, log: [...chained.state.log, ...chained.logLines] };
    }
    if (chainedSearchToHand) {
      const chained = beginLibrarySearch(resolvedState, playerId, pending.sourceInstanceId, pending.filter, pending.reveal);
      return { ...chained.state, log: [...chained.state.log, ...chained.logLines] };
    }
    return resolvedState;
  };

  if (!instanceId) {
    const next = updatePlayer(state, playerId, (p) => ({ ...p, zones: { ...p.zones, library: shuffle(p.zones.library) } }));
    return { ok: true, state: continueChain({ ...next, pendingLibrarySearch: null, log: [...next.log, `${player.name} finds nothing.`] }) };
  }

  const foundIndex = player.zones.library.findIndex((c) => c.instanceId === instanceId);
  if (foundIndex === -1) return { ok: false, error: 'That card is not in your library.' };
  const foundCard = player.zones.library[foundIndex];
  if (!matchesLibrarySearchFilter(getCardDefinition(foundCard.defId), pending.filter)) {
    return { ok: false, error: "That card doesn't match what this search is looking for." };
  }
  const foundName = getCardDefinition(foundCard.defId).name;
  if (!pending.allowDuplicateNames && pending.excludeNames?.includes(foundName)) {
    return { ok: false, error: 'You already found a card with that name this search - the rest must have different names.' };
  }

  const rest = player.zones.library.filter((_, i) => i !== foundIndex);
  const logLines: string[] = [];
  let next: GameState;

  // mayChooseBattlefieldTapped (Scholar of New Horizons) - the controller's
  // own choice, made right now, overrides this search's own fixed
  // toBattlefieldTapped/toBattlefieldUntapped entirely.
  const goesToBattlefieldTapped = pending.mayChooseBattlefieldTapped ? !!chosenToBattlefieldTapped : pending.toBattlefieldTapped;
  const goesToBattlefieldUntapped = !pending.mayChooseBattlefieldTapped && pending.toBattlefieldUntapped;

  if (goesToBattlefieldTapped) {
    const movedCard: CardInstance = { ...foundCard, tapped: true };
    next = updatePlayer(state, playerId, (p) => ({ ...p, zones: { ...p.zones, library: shuffle(rest), battlefield: [...p.zones.battlefield, movedCard] } }));
    logLines.push(`${player.name} finds ${foundName} and puts it onto the battlefield tapped.`);
  } else if (goesToBattlefieldUntapped) {
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
  // allowDuplicateNames (Rampant Rejuvenator) skips the exclusion entirely,
  // so the SAME name can be found again on a later pick in this chain.
  if (pending.remainingPicks && pending.remainingPicks > 0) {
    const newExcludeNames = pending.allowDuplicateNames ? pending.excludeNames : [...(pending.excludeNames ?? []), foundName];
    const stillHasMatch = getPlayer(next, playerId).zones.library.some(
      (c) => matchesLibrarySearchFilter(getCardDefinition(c.defId), pending.filter) && !newExcludeNames?.includes(getCardDefinition(c.defId).name)
    );
    next = {
      ...next,
      pendingLibrarySearch: stillHasMatch ? { ...pending, remainingPicks: pending.remainingPicks - 1, excludeNames: newExcludeNames } : null,
    };
  } else {
    next = { ...next, pendingLibrarySearch: null };
  }

  if (pending.reveal && !goesToBattlefieldTapped && !goesToBattlefieldUntapped) {
    next = { ...next, lastReveal: { instanceId, ownerId: playerId, sourceInstanceId: pending.sourceInstanceId } };
    const sourceFound = findCardAnywhere(next, pending.sourceInstanceId);
    const sourceName = sourceFound ? getCardDefinition(sourceFound.card.defId).name : 'an ability';
    logLines.push(`${player.name} reveals ${foundName} (found via ${sourceName}).`);
  }

  return { ok: true, state: continueChain({ ...next, log: [...next.log, ...logLines] }) };
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

  // "Whenever you win a coin flip, [effects]." (Setzer, Wandering
  // Gambler's second trigger) - a STANDING board-wide watcher, separate
  // from this specific flip's own ifWinEffects above: fires for every
  // permanent the winning player controls, regardless of what actually
  // flipped the coin.
  if (won) {
    for (const watcher of getPlayer(next, playerId).zones.battlefield) {
      const watcherDef = getCardDefinition(watcher.defId);
      if (!watcherDef.onWinCoinFlip || watcherDef.onWinCoinFlip.length === 0) continue;
      const resolved = resolveCardEffects(next, playerId, watcherDef.onWinCoinFlip, watcher.instanceId);
      next = resolved.state;
      logLines = [...logLines, ...resolved.logLines];
    }
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
 * way, create a Food token." (Ignis Scientia) - also handles Summoner's
 * Sending's "you may exile target CREATURE card..." via pending.optional/
 * creatureOnly/thenCreateToken. */
function resolveGraveyardExile(state: GameState, playerId: string, instanceId: string | null): ActionResult {
  const pending = state.pendingGraveyardExile;
  if (!pending) return { ok: false, error: 'Nothing is waiting on a graveyard exile right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your choice to make." };
  if (instanceId === null) {
    if (!pending.optional) return { ok: false, error: 'This ability requires a target.' };
    const actor = getPlayer(state, playerId);
    return { ok: true, state: { ...state, pendingGraveyardExile: null, log: [...state.log, `${actor.name} declines to exile a card from a graveyard.`] } };
  }

  const found = findCardAnywhere(state, instanceId);
  if (!found || found.zone !== 'graveyard') return { ok: false, error: "That's not a legal target - it must be a card in a graveyard." };
  const def = getCardDefinition(found.card.defId);
  if (pending.creatureOnly && def.type !== 'creature') {
    return { ok: false, error: `${def.name} is not a legal target - it must be a creature card.` };
  }
  if (pending.instantOrSorceryOnly && def.type !== 'instant' && def.type !== 'sorcery') {
    return { ok: false, error: `${def.name} is not a legal target - it must be an instant or sorcery card.` };
  }

  // Bug fix: this used to remove the card from the graveyard without ever
  // actually placing it in exile anywhere below - it just vanished. Ignis
  // Scientia and Summoner's Sending were silently losing the exiled card
  // into the void instead of genuinely exiling it.
  let next = updatePlayer(state, found.ownerPlayerId, (p) => ({
    ...p,
    zones: { ...p.zones, graveyard: p.zones.graveyard.filter((c) => c.instanceId !== instanceId), exile: [...p.zones.exile, found.card] },
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
  if (pending.thenCreateToken) {
    const { tokenId, counterIfManaValueAtLeast } = pending.thenCreateToken;
    const tokenDef = getCardDefinition(tokenId);
    const qualifies = !!counterIfManaValueAtLeast && manaValue(parseCostLabel(def.costLabel)) >= counterIfManaValueAtLeast.value;
    const token: CardInstance = {
      instanceId: nextInstanceId(),
      defId: tokenDef.id,
      ownerId: playerId,
      tapped: false,
      counters: qualifies ? [{ label: counterIfManaValueAtLeast!.counterLabel, amount: counterIfManaValueAtLeast!.counterAmount }] : [],
      damageMarked: 0,
      summoningSick: true,
      isToken: true,
    };
    next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, battlefield: [...p.zones.battlefield, token] } }));
    logLine += ` ${getPlayer(next, playerId).name} creates a ${tokenDef.name} token${qualifies ? ` with a ${counterIfManaValueAtLeast!.counterLabel} counter on it` : ''}.`;
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
  if (def.cycling.searchAnyBasicLand) {
    const result = beginLibrarySearch(next, playerId, instanceId, { kind: 'basicLand' }, true);
    next = result.state;
    return { ok: true, state: { ...next, log: [...next.log, `${player.name} cycles ${def.name}.`, ...result.logLines] } };
  }
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

/** "Foretell [cost]" (Ultimate Magic: Holy/Meteor, Lifestream's Blessing) -
 * "During your turn, you may pay {2} and exile this card from your hand face
 * down. Cast it on a later turn for its foretell cost." The {2} exile cost
 * is a fixed part of the real keyword, not configurable per-card. Grants a
 * PERSISTENT GameState.exilePlayGrants entry (no expiresAtCleanup) with
 * overrideCostLabel set to the card's own foretell cost, consumed by
 * engine/actions.ts: castFromExile whenever the controller later plays it. */
function foretellCard(state: GameState, playerId: string, instanceId: string): ActionResult {
  const player = getPlayer(state, playerId);
  const card = player.zones.hand.find((c) => c.instanceId === instanceId);
  if (!card) return { ok: false, error: 'That card is not in your hand.' };
  const def = getCardDefinition(card.defId);
  if (!def.foretell) return { ok: false, error: `${def.name} has no Foretell ability.` };

  const mutual = isMutualActive(state);
  if (!mutual && state.activePlayerId !== playerId) {
    return { ok: false, error: 'Foretell can only be activated during your own turn.' };
  }
  const parsed = parseCostLabel('{2}');
  if (!mutual && !canPay(player.manaPool, parsed, 0)) {
    return { ok: false, error: `Not enough mana to foretell ${def.name} ({2}).` };
  }

  let next = state;
  if (!mutual) next = updatePlayer(next, playerId, (p) => ({ ...p, manaPool: payCost(p.manaPool, parsed, 0) }));
  next = updatePlayer(next, playerId, (p) => ({
    ...p,
    zones: { ...p.zones, hand: p.zones.hand.filter((c) => c.instanceId !== instanceId), exile: [...p.zones.exile, { ...card, faceDown: true }] },
  }));
  next = { ...next, exilePlayGrants: [...next.exilePlayGrants, { instanceId, playerId, overrideCostLabel: def.foretell.cost }] };

  return { ok: true, state: { ...next, log: [...next.log, `${player.name} foretells a card.`] } };
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
    // "Whenever a creature deals combat damage to the monarch, that
    // creature's controller becomes the monarch." (the Monarch mechanic)
    // - this attacker just dealt unblocked combat damage to its
    // controller's opponent, so if THAT opponent is the current monarch,
    // the monarchy transfers.
    const defenderId = getOpponent(next, found.ownerPlayerId).id;
    if (next.monarchPlayerId === defenderId && found.ownerPlayerId !== defenderId) {
      next = { ...next, monarchPlayerId: found.ownerPlayerId };
      const released = releaseExiledUntilMonarchChanges(next);
      next = released.state;
      next = { ...next, log: [...next.log, `${getPlayer(next, found.ownerPlayerId).name} becomes the monarch (dealt combat damage to the monarch).`, ...released.logLines] };
    }
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
    // "Whenever a VEHICLE you control deals combat damage to a player,
    // [effects]." (Setzer, Wandering Gambler) - the same board-wide watcher
    // shape as onAnyControlledCreatureCombatDamageToPlayer above, but only
    // fires when the ATTACKER itself is a Vehicle (crewed Vehicles are the
    // only way one can ever legally attack at all).
    if (def.subtype?.toLowerCase().includes('vehicle')) {
      for (const watcher of getPlayer(next, found.ownerPlayerId).zones.battlefield) {
        const watcherDef = getCardDefinition(watcher.defId);
        if (!watcherDef.onAnyControlledVehicleCombatDamageToPlayer || watcherDef.onAnyControlledVehicleCombatDamageToPlayer.length === 0) continue;
        const resolved = resolveCardEffects(next, found.ownerPlayerId, watcherDef.onAnyControlledVehicleCombatDamageToPlayer, watcher.instanceId);
        next = { ...resolved.state, log: [...resolved.state.log, ...resolved.logLines] };
      }
    }
    // "Whenever a creature you control deals combat damage to a player, put
    // a counter on THAT CREATURE" (Sphere Grid) - applied directly to the
    // attacker (attackerId), unlike the generic watcher loop above which
    // only ever gets the WATCHER as sourceInstanceId.
    for (const watcher of getPlayer(next, found.ownerPlayerId).zones.battlefield) {
      const watcherDef = getCardDefinition(watcher.defId);
      const grant = watcherDef.onAnyControlledCreatureCombatDamageToPlayerPutCounterOnThatCreature;
      if (!grant) continue;
      next = updatePlayer(next, found.ownerPlayerId, (p) => ({
        ...p,
        zones: {
          ...p.zones,
          battlefield: p.zones.battlefield.map((c) => {
            if (c.instanceId !== attackerId) return c;
            const hasCounter = c.counters.some((ctr) => ctr.label === grant.counterLabel);
            const counters = hasCounter
              ? c.counters.map((ctr) => (ctr.label === grant.counterLabel ? { ...ctr, amount: ctr.amount + grant.counterAmount } : ctr))
              : [...c.counters, { label: grant.counterLabel, amount: grant.counterAmount }];
            return { ...c, counters };
          }),
        },
      }));
      next = { ...next, log: [...next.log, `${watcherDef.name}: ${def.name} gets a ${grant.counterLabel} counter.`] };
    }
    // "Whenever one or more creatures you control with counters on them deal
    // combat damage to a player, [effect]. Do this only once each turn."
    // (Tidus, Yuna's Guardian's Cheer) - narrower than
    // onAnyControlledCreatureCombatDamageToPlayer above: only fires if THIS
    // attacker itself has a counter, and gated to once per turn via the
    // watcher's own cheerTriggeredThisTurn flag.
    if (found.card.counters.length > 0) {
      for (const watcher of getPlayer(next, found.ownerPlayerId).zones.battlefield) {
        const watcherDef = getCardDefinition(watcher.defId);
        if (!watcherDef.onAnyControlledCreatureWithCountersCombatDamageToPlayer || watcherDef.onAnyControlledCreatureWithCountersCombatDamageToPlayer.length === 0) continue;
        if (watcher.cheerTriggeredThisTurn) continue;
        next = updatePlayer(next, found.ownerPlayerId, (p) => ({
          ...p,
          zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === watcher.instanceId ? { ...c, cheerTriggeredThisTurn: true } : c)) },
        }));
        const resolved = resolveCardEffects(next, found.ownerPlayerId, watcherDef.onAnyControlledCreatureWithCountersCombatDamageToPlayer, watcher.instanceId);
        next = { ...resolved.state, log: [...resolved.state.log, ...resolved.logLines] };
      }
      // "Whenever a creature you control with a +1/+1 counter on it deals
      // combat damage to a player, [effect]." (Bred for the Hunt) - same
      // "attacker itself has a counter" gate as Tidus's Cheer just above,
      // but NO once-per-turn restriction (no such clause in its text).
      for (const watcher of getPlayer(next, found.ownerPlayerId).zones.battlefield) {
        const watcherDef = getCardDefinition(watcher.defId);
        if (!watcherDef.onAnyControlledCreatureWithCounterCombatDamageToPlayer || watcherDef.onAnyControlledCreatureWithCounterCombatDamageToPlayer.length === 0) continue;
        const resolved = resolveCardEffects(next, found.ownerPlayerId, watcherDef.onAnyControlledCreatureWithCounterCombatDamageToPlayer, watcher.instanceId);
        next = { ...resolved.state, log: [...resolved.state.log, ...resolved.logLines] };
      }
    }
    // "Whenever one or more creatures you control with power [minPower] or
    // greater deal combat damage to a player, [effect]. ... only once each
    // turn." (Tifa, Martial Artist) - same shape as the counters-gated
    // Cheer block above, gated on effectivePower instead (no counters
    // precondition of its own).
    {
      const attackerPower = effectivePower(def, found.card, next, found.ownerPlayerId);
      for (const watcher of getPlayer(next, found.ownerPlayerId).zones.battlefield) {
        const watcherDef = getCardDefinition(watcher.defId);
        const grant = watcherDef.onAnyControlledCreatureWithPowerAtLeastCombatDamageToPlayer;
        if (!grant || grant.effects.length === 0) continue;
        if (attackerPower < grant.minPower) continue;
        if (watcher.powerThresholdCombatDamageTriggeredThisTurn) continue;
        next = updatePlayer(next, found.ownerPlayerId, (p) => ({
          ...p,
          zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === watcher.instanceId ? { ...c, powerThresholdCombatDamageTriggeredThisTurn: true } : c)) },
        }));
        const resolved = resolveCardEffects(next, found.ownerPlayerId, grant.effects, watcher.instanceId);
        next = { ...resolved.state, log: [...resolved.state.log, ...resolved.logLines] };
      }
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

  // "Whenever one or more creatures an opponent controls attack you and
  // aren't blocked, that player draws [drawCount] cards and gains control
  // of this [artifact]. Untap it." (Coveted Jewel) - the REVERSE direction
  // of combatDamageToPlayerGrantsControlToThem above (a permanent on the
  // DEFENDER's own battlefield changes to the ATTACKER), and fires at most
  // ONCE this combat regardless of how many attackers got through
  // unblocked, so it's checked outside the per-attacker loop above.
  {
    const hasUnblockedAttacker = state.declaredAttackers.some((id) => {
      const assignment = state.combatAssignments.find((a) => a.attackerInstanceId === id);
      return !!assignment && assignment.blockerInstanceIds.length === 0;
    });
    if (hasUnblockedAttacker) {
      const attackerId = state.activePlayerId;
      const defenderId = getOpponent(next, attackerId).id;
      const jewel = getPlayer(next, defenderId).zones.battlefield.find((c) => getCardDefinition(c.defId).onUnblockedOpponentAttackGrantsControlAndDraws);
      if (jewel) {
        const def = getCardDefinition(jewel.defId);
        const grant = def.onUnblockedOpponentAttackGrantsControlAndDraws!;
        next = updatePlayer(next, defenderId, (p) => ({ ...p, zones: { ...p.zones, battlefield: p.zones.battlefield.filter((c) => c.instanceId !== jewel.instanceId) } }));
        const movedCard = { ...jewel, tapped: false };
        next = updatePlayer(next, attackerId, (p) => ({ ...p, zones: { ...p.zones, battlefield: [...p.zones.battlefield, movedCard] } }));
        next = triggerControlLostToOpponentWatchers(next, defenderId);

        const drawn = getPlayer(next, attackerId).zones.library.slice(0, grant.drawCount);
        next = updatePlayer(next, attackerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(grant.drawCount), hand: [...p.zones.hand, ...drawn] } }));

        const attacker = getPlayer(next, attackerId);
        next = { ...next, log: [...next.log, `${attacker.name} gains control of ${def.name} (untapped) and draws ${grant.drawCount} card(s).`] };
      }
    }
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
  // "At the beginning of EACH end step, ..." (Lord Jyscal Guado) - unlike
  // onOwnEndStep above (only the active player's own permanents), this
  // checks BOTH players' battlefields, since it fires regardless of whose
  // turn's end step this is.
  for (const player of next.players) {
    for (const c of player.zones.battlefield) {
      const cDef = getCardDefinition(c.defId);
      if (!cDef.onAnyEndStep || cDef.onAnyEndStep.length === 0) continue;
      const resolved = resolveCardEffects(next, player.id, cDef.onAnyEndStep, c.instanceId);
      next = { ...resolved.state, log: [...resolved.state.log, ...resolved.logLines] };
    }
  }
  // "At the beginning of each end step, if a player lost [N] or more life
  // this turn, [effect]." (Y'shtola, Night's Blessed) - checked fresh every
  // end step against BOTH players' lifeLostThisTurn (no "once per turn"
  // gate - Y'shtola's own text states none).
  for (const player of next.players) {
    for (const c of player.zones.battlefield) {
      const cDef = getCardDefinition(c.defId);
      const grant = cDef.onAnyEndStepIfAnyPlayerLostLifeThisTurn;
      if (!grant || grant.effects.length === 0) continue;
      if (!next.players.some((p) => p.lifeLostThisTurn >= grant.minLifeLost)) continue;
      const resolved = resolveCardEffects(next, player.id, grant.effects, c.instanceId);
      next = { ...resolved.state, log: [...resolved.state.log, ...resolved.logLines] };
    }
  }
  // "At the beginning of the end step, the monarch draws a card." (the
  // Monarch mechanic - see BecomeMonarchEffect) - fires every end step
  // regardless of whose turn it is, as long as someone is the monarch.
  if (next.monarchPlayerId) {
    const monarch = getPlayer(next, next.monarchPlayerId);
    const drawn = monarch.zones.library.slice(0, 1);
    next = updatePlayer(next, monarch.id, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(drawn.length), hand: [...p.zones.hand, ...drawn] } }));
    next = { ...next, log: [...next.log, `${monarch.name} draws a card (the monarch).`] };
  }
  // "At the beginning of each opponent's end step, ..." (Archfiend of
  // Depravity) - fires once per permanent whose controller is NOT the
  // player whose end step this currently is (their opponent), resolving
  // with the ACTIVE player (the affected opponent) as the effect context.
  for (const player of next.players) {
    if (player.id === next.activePlayerId) continue;
    for (const c of player.zones.battlefield) {
      const cDef = getCardDefinition(c.defId);
      if (!cDef.onOpponentEndStep || cDef.onOpponentEndStep.length === 0) continue;
      const resolved = resolveCardEffects(next, next.activePlayerId, cDef.onOpponentEndStep, c.instanceId);
      next = { ...resolved.state, log: [...resolved.state.log, ...resolved.logLines] };
    }
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

  // CardInstance.graveyardEntrySource (Banon, the Returners' Leader) only
  // ever means "this turn" by virtue of being cleared here every cleanup -
  // no separate turn-number/timestamp tracking needed.
  for (const player of next.players) {
    if (player.zones.graveyard.every((c) => c.graveyardEntrySource === undefined)) continue;
    next = updatePlayer(next, player.id, (p) => ({ ...p, zones: { ...p.zones, graveyard: p.zones.graveyard.map((c) => ({ ...c, graveyardEntrySource: undefined })) } }));
  }

  // "You may play the exiled card THIS TURN" (Reno and Rude's
  // expiresAtCleanup grant) - Lightning, Security Sergeant's persistent
  // grant has no expiresAtCleanup and is left alone here.
  if (next.exilePlayGrants.some((g) => g.expiresAtCleanup)) {
    next = { ...next, exilePlayGrants: next.exilePlayGrants.filter((g) => !g.expiresAtCleanup) };
  }

  // "Whenever you cast a noncreature spell this turn, ..." (Summon: Good
  // King Mog XII) - "this turn" only.
  for (const player of next.players) {
    if (!player.temporaryNoncreatureCastCreatesTokenCopyUntilEndOfTurn) continue;
    next = updatePlayer(next, player.id, (p) => ({ ...p, temporaryNoncreatureCastCreatesTokenCopyUntilEndOfTurn: false }));
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
      lifeLostThisTurn: 0,
      modifiedCreaturesHaveBasePowerToughnessUntilEndOfTurn: null,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.map((c) => ({
          ...c,
          damageMarked: 0,
          tookDeathtouchDamage: false,
          temporaryBuff: undefined,
          temporaryBaseStats: undefined,
          temporaryOnDeathReturnTapped: undefined,
          temporaryOnDeathReturnToHand: undefined,
          temporaryOnDeathPutCountersEqualToPower: undefined,
          temporaryCantBlock: undefined,
          crewedUntilEndOfTurn: undefined,
          temporarilyCreatureUntilEndOfTurn: undefined,
          temporaryGrantedSubtype: undefined,
          temporaryKeywords: undefined,
          onAnyDeathDrawUsedThisTurn: undefined,
          onAnyCreatureDeathAnywhereDrawUsedThisTurn: undefined,
          onOpponentLoseLifeMayCastFromGraveyardTriggeredThisTurn: undefined,
          cheerTriggeredThisTurn: undefined,
          powerThresholdCombatDamageTriggeredThisTurn: undefined,
          throwWideTheGatesTriggeredThisTurn: undefined,
          traceAetherTriggeredThisTurn: undefined,
          // Was missing here entirely - Professor Hojo's draw trigger would
          // only ever have fired once per instance for the rest of the
          // game, not once per turn as its own text says.
          targetedByActivatedAbilityDrawTriggeredThisTurn: undefined,
          scionsSecretaryTriggeredThisTurn: undefined,
          counterPutOnSelfThisTurn: undefined,
        })),
      },
    }));
  }
  next = { ...next, creaturesDiedThisTurn: 0, pendingNextCreatureSpellBonus: null, pendingManaIdentitySourceScry: null };
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
    // "At the beginning of your next upkeep, you may cast this card from
    // exile without paying its mana cost." (Rebound - Transpose) - offers
    // the choice for the FIRST still-pending Rebound card in exile, then
    // clears the flag either way (see CardInstance.pendingReboundNextUpkeep's
    // own doc comment for why this is never offered a second time).
    const reboundCard = active.zones.exile.find((c) => c.pendingReboundNextUpkeep);
    if (reboundCard && !next.pendingReboundChoice) {
      next = updatePlayer(next, active.id, (p) => ({
        ...p,
        zones: { ...p.zones, exile: p.zones.exile.map((c) => (c.instanceId === reboundCard.instanceId ? { ...c, pendingReboundNextUpkeep: undefined } : c)) },
      }));
      next = { ...next, pendingReboundChoice: { sourceInstanceId: reboundCard.instanceId, controllerId: active.id } };
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
    usedFirstOwnCreatureTargetingAbilityDiscountThisTurn: false,
    usedGraveyardCastPermissionThisTurn: false,
    spellsCastThisTurn: 0,
    zones: {
      ...p.zones,
      battlefield: p.zones.battlefield.map((c) => {
        const stun = c.counters.find((ctr) => ctr.label.toLowerCase() === 'stun');
        if (stun && stun.amount > 0) {
          return { ...c, counters: c.counters.map((ctr) => (ctr.label.toLowerCase() === 'stun' ? { ...ctr, amount: ctr.amount - 1 } : ctr)).filter((ctr) => ctr.amount > 0) };
        }
        if (preventsUntap(c.instanceId)) return { ...c, summoningSick: false, producedManaColor: undefined, temporaryKeywordsUntilNextTurn: undefined, attacksYouCostGenericUntilNextTurn: undefined, phasedOut: undefined };
        return { ...c, tapped: false, summoningSick: false, producedManaColor: undefined, temporaryKeywordsUntilNextTurn: undefined, attacksYouCostGenericUntilNextTurn: undefined, phasedOut: undefined };
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
        const producedAmount = effectiveProducedManaAmount(state, playerId, getCardDefinition(c.defId), c, c.producedManaColor);
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
  // "If you put a counter on a creature THIS TURN" (Lord Jyscal Guado) needs
  // to be false for BOTH players the instant a new turn actually begins -
  // unlike hasPlayedLandThisTurn/hasDrawnThisTurn (only ever meaningfully
  // read for whichever player is untapping), this flag is checked for
  // EITHER player's own permanents at end step, so resetting it only inside
  // runUntapStep (which only touches the incoming active player) would leave
  // the other player's flag stale from their last turn until their own next
  // untap - two turns later in this 2-player engine.
  next = { ...next, players: next.players.map((p) => ({ ...p, counterPutOnOwnCreatureThisTurn: false })) as GameState['players'] };
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