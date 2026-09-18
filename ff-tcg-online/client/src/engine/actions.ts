// ============================================================================
// engine/actions.ts
// ============================================================================

import { ActionResult, CardDefinition, CardInstance, CombatAssignment, GameAction, GameState, ManaColor, Phase, ZoneName } from '../types';
import { findCardAnywhere, getOpponent, getPlayer, updatePlayer, detachEverythingFrom, nextInstanceId, shuffle } from './state'; import { getCardDefinition } from '../data/cards';
import { canPay, payCost, parseCostLabel, emptyManaPool, manaValue, effectiveCastCost } from './mana';
import { hasKeyword, hasKeywordEffective } from './keywords';
import {
  resolveCombatDamage,
  resolvePendingDeaths,
  effectivePower,
  effectiveToughness,
  isEffectivelyCreature,
  resolveFight,
  hasEquipGrantedKeywordDuringOwnTurn,
  hasSelfGrantedKeywordDuringOwnTurn,
  loseLife,
} from './combat';
import {
  resolveCardEffects,
  triggerLandfall,
  triggerNoncreatureCastAbilities,
  triggerArtifactEnterWatchers,
  triggerSagaLoreCounter,
  applyTemporaryBuff,
  grantTemporaryKeyword,
  exileAndReturnTransformed,
  returnFromGraveyardTransformed,
  resolveSacrificeQueue,
  matchesSacrificeFilter,
  sacrificeFilterLabel,
  resolveOnDeathTriggers,
  moveCreaturesToGraveyardAndTrigger,
  matchesReanimateFilter,
  matchesReturnFromGraveyardFilter,
  stripSagaProgress,
  beginRevealPickup,
  isNonbasicLand,
} from './effects';

const PHASE_ORDER: Phase[] = ['untap', 'upkeep', 'draw', 'main1', 'combat_begin', 'declare_attackers', 'declare_blockers', 'combat_damage', 'combat_end', 'main2', 'end', 'cleanup'];

function isMutualActive(state: GameState): boolean {
  return state.mutualAdjustment.status === 'active';
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
  if (watched.logLines.length === 0) return result;
  return { ok: true, state: { ...watched.state, log: [...watched.state.log, ...watched.logLines] } };
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
      return castCard(state, playerId, action.instanceId, action.chosenX, action.chosenModeIndices, action.chosenTierIndex);
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
      return chooseTarget(state, playerId, action.targetInstanceId);
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
    case 'RESOLVE_REANIMATE':
      return resolveReanimate(state, playerId, action.instanceId);
    case 'RESOLVE_RETURN_CREATURE_FROM_GRAVEYARD':
      return resolveReturnCreatureFromGraveyard(state, playerId, action.instanceId);
    case 'RESOLVE_OPTIONAL_TRANSFORM':
      return resolveOptionalTransform(state, playerId, action.accept);
    case 'RESOLVE_OPTIONAL_PAY_LIFE':
      return resolveOptionalPayLife(state, playerId, action.accept);
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
 * their own. */
function effectiveProducesMana(state: GameState, controllerId: string, def: CardDefinition, instanceId: string): ManaColor | 'any' | ManaColor[] | undefined {
  if (def.producesMana) return def.producesMana;
  const granter = getPlayer(state, controllerId).zones.battlefield.find(
    (c) => c.instanceId !== instanceId && !!getCardDefinition(c.defId).grantsManaAbilityToOthers
  );
  return granter ? getCardDefinition(granter.defId).grantsManaAbilityToOthers : undefined;
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
    // Lucii's "T: Add MM" is 2, everything else defaults to 1. Refunding
    // needs the same amount back, not a flat 1.
    const producedAmount = def.producesManaAmount ?? 1;
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
  const producesMana = effectiveProducesMana(state, found.ownerPlayerId, def, instanceId);
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
  // everything else defaults to 1. See types.ts: producesManaAmount.
  const producedAmount = def.producesManaAmount ?? 1;
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
  chosenTierIndex?: number
): ActionResult {
  const player = getPlayer(state, playerId);
  const mutual = isMutualActive(state);

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

  if (!mutual && def.type !== 'land' && def.type !== 'instant' && !hasKeyword(def, 'flash')) {
    if (state.activePlayerId !== playerId) return { ok: false, error: `${def.name} can only be cast on your own turn (no flash).` };
    if (state.phase !== 'main1' && state.phase !== 'main2') return { ok: false, error: `${def.name} can only be cast during a main phase (no flash).` };
  }

  if (def.type === 'land') {
    if (!mutual) {
      if (state.activePlayerId !== playerId) return { ok: false, error: 'You can only play a land on your own turn.' };
      if (player.hasPlayedLandThisTurn) return { ok: false, error: "You've already played a land this turn." };
    }
    let next = updatePlayer(state, playerId, (p) => ({ ...p, zones: { ...p.zones, hand: p.zones.hand.filter((c) => c.instanceId !== instanceId) } }));
    const movedCard = { ...card, tapped: !!def.entersTapped, damageMarked: 0, summoningSick: false };
    next = updatePlayer(next, playerId, (p) => ({
      ...p,
      zones: { ...p.zones, battlefield: [...p.zones.battlefield, movedCard] },
      hasPlayedLandThisTurn: mutual ? p.hasPlayedLandThisTurn : true,
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

  if (!mutual && !canPay(player.manaPool, parsed, extraGeneric)) {
    return { ok: false, error: `Not enough mana to cast ${def.name}${commanderTax > 0 ? ` (includes +${commanderTax} commander tax)` : ''}.` };
  }

  let next = state;
  if (!mutual) next = updatePlayer(next, playerId, (p) => ({ ...p, manaPool: payCost(p.manaPool, parsed, extraGeneric) }));
  next = updatePlayer(next, playerId, (p) => ({
    ...p,
    zones: { ...p.zones, [sourceZone as 'hand' | 'commander']: p.zones[sourceZone as 'hand' | 'commander'].filter((c) => c.instanceId !== instanceId) },
  }));

  const isPermanent = def.type === 'creature' || def.type === 'artifact' || def.type === 'enchantment';
  const targetZone: ZoneName = isPermanent ? 'battlefield' : 'graveyard';
  const hasHaste = hasKeyword(def, 'haste');
  // Commander Tax itself doesn't change here - it's already sitting on the
  // card's own counters (carried along by the spread above) and only ever
  // goes up when the commander returns to the command zone, not when it's
  // cast from there - see engine/combat.ts: resolvePendingDeaths. A stale
  // 'lore' counter (e.g. from a Saga that was bounced to hand mid-chapters)
  // is stripped by stripSagaProgress so this fresh cast always starts its
  // chapters over, same as any other fresh entrance.
  const movedCard = stripSagaProgress({ ...card, tapped: isPermanent && !!def.entersTapped, damageMarked: 0, summoningSick: def.type === 'creature' ? !hasHaste : false });

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

  if (def.type !== 'creature') {
    const triggered = triggerNoncreatureCastAbilities(next, playerId, manaValue(parsed) + extraGeneric);
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
  const hasHaste = hasKeyword(def, 'haste');
  const movedCard = stripSagaProgress({ ...card, tapped: isPermanent && !!def.entersTapped, damageMarked: 0, summoningSick: def.type === 'creature' ? !hasHaste : false });

  next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, [targetZone]: [...p.zones[targetZone], movedCard] } }));
  next = checkLegendRule(next, playerId);

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

  if (def.type !== 'creature') {
    const triggered = triggerNoncreatureCastAbilities(next, playerId, manaValue(parsed) + extraGeneric);
    next = triggered.state;
    effectLogLines = [...effectLogLines, ...triggered.logLines];
  }

  const xNote = parsed.hasX ? ` (X=${chosenX ?? 0})` : '';
  const freeNote = mutual ? ' (free - Mutual Adjustment active)' : '';
  const exileNote = isPermanent ? '' : ', then it is exiled';
  return { ok: true, state: { ...next, log: [...next.log, `${player.name} casts ${def.name} via flashback${xNote}${freeNote}${exileNote}.`, ...effectLogLines] } };
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
  if (ability.returnFromGraveyardTransformed && found.zone !== 'graveyard') {
    return { ok: false, error: `${ability.label} can only be activated from the graveyard.` };
  }

  const owner = getPlayer(state, found.ownerPlayerId);
  const mutual = isMutualActive(state);
  const manaCost = ability.cost.manaLabel ? parseCostLabel(ability.cost.manaLabel) : null;

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

  if (!mutual && !isEquipment && found.card.attachedToInstanceId) {
    return { ok: false, error: `${def.name} is already attached - Auras don't move once attached.` };
  }

  let next = state;
  if (isEquipment && !mutual) {
    const parsed = parseCostLabel(def.equipCost!);
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
        return hasKeyword(def, 'vigilance') ? c : { ...c, tapped: true };
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
    const menace = hasKeyword(attackerDef, 'menace');

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

function chooseTarget(state: GameState, playerId: string, targetInstanceId: string | null): ActionResult {
  const pending = state.pendingTarget;
  if (!pending) return { ok: false, error: 'No effect is waiting for a target right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your target to choose." };

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
      pending.effect.type === 'tapStunAndGainLifeForNonbasicLands';
    if (!isOptional) {
      return { ok: false, error: 'This ability requires a target.' };
    }
    const source = findCardAnywhere(state, pending.sourceInstanceId);
    const sourceName = source ? getCardDefinition(source.card.defId).name : 'This ability';
    return { ok: true, state: { ...state, pendingTarget: null, log: [...state.log, `${sourceName}'s optional target was declined.`] } };
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

    if (hasKeywordEffective(targetDef, found.card, 'indestructible')) {
      const next = { ...state, pendingTarget: null };
      return { ok: true, state: { ...next, log: [...next.log, `${targetDef.name} is indestructible and survives.`] } };
    }

    const destroyResult = moveCreaturesToGraveyardAndTrigger(state, [targetInstanceId], 'is destroyed');
    const next = { ...destroyResult.state, pendingTarget: null, log: [...destroyResult.state.log, ...destroyResult.logLines] };
    return { ok: true, state: next };
  }

  if (pending.effect.type === 'pumpTarget') {
    // No controller restriction stated, so either player's creature is a legal target.
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    const { power, toughness, grantKeyword } = pending.effect;
    let next = applyTemporaryBuff(state, targetInstanceId, power, toughness);
    if (grantKeyword) next = grantTemporaryKeyword(next, targetInstanceId, grantKeyword);
    next = { ...next, pendingTarget: null };
    const actor = getPlayer(next, playerId);
    const keywordNote = grantKeyword ? ` and gains ${grantKeyword}` : '';
    return { ok: true, state: { ...next, log: [...next.log, `${actor.name} targets ${targetDef.name}: it gets +${power}/+${toughness}${keywordNote} until end of turn.`] } };
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
    if (found.ownerPlayerId !== playerId) return { ok: false, error: 'You must choose a creature you control.' };
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
    if (hasKeywordEffective(targetDef, found.card, 'indestructible')) {
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
    next = updatePlayer(next, found.ownerPlayerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.filter((c) => c.instanceId !== targetInstanceId),
        hand: [...p.zones.hand, { ...found.card, tapped: false, attachedToInstanceId: undefined, damageMarked: 0 }],
      },
    }));
    next = { ...next, pendingTarget: null, log: [...next.log, `${targetDef.name} is returned to ${bounceOwner.name}'s hand.`] };
    return { ok: true, state: next };
  }

  if (pending.effect.type === 'putCounterOnUpToOneOtherCreatureEqualToOwnPower') {
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    if (targetInstanceId === pending.sourceInstanceId) return { ok: false, error: 'You must choose a creature other than the source.' };
    const sourceFound = findCardAnywhere(state, pending.sourceInstanceId);
    const amount = sourceFound ? effectivePower(getCardDefinition(sourceFound.card.defId), sourceFound.card, state, sourceFound.ownerPlayerId) : 0;
    const { counterLabel } = pending.effect;
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
          return { ...c, counters };
        }),
      },
    }));
    next = { ...next, pendingTarget: null };
    const actor = getPlayer(next, playerId);
    return { ok: true, state: { ...next, log: [...next.log, `${actor.name} puts ${amount} ${counterLabel} counter(s) on ${targetDef.name}.`] } };
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
    const isLethal = !!damagedTarget && !hasKeywordEffective(targetDef, damagedTarget, 'indestructible') && damagedTarget.damageMarked >= effectiveToughness(targetDef, damagedTarget, next, found.ownerPlayerId);
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
    const isLethal = !!damagedTarget && !hasKeywordEffective(targetDef, damagedTarget, 'indestructible') && damagedTarget.damageMarked >= effectiveToughness(targetDef, damagedTarget, next, found.ownerPlayerId);
    if (isLethal) {
      const lethalResult = moveCreaturesToGraveyardAndTrigger(next, [targetInstanceId], 'dies');
      next = { ...lethalResult.state, log: [...lethalResult.state.log, ...lethalResult.logLines] };
    }
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
        if (hasKeywordEffective(cDef, c, 'indestructible')) continue;
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

  // 'bounceTarget' (Eject) - "Return target nonland permanent to its
  // owner's hand." No controller restriction, so it's the last member of
  // the pendingTarget.effect union and needs no further type narrowing.
  if (targetDef.type === 'land') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a nonland permanent.` };
  const bounceOwner = getPlayer(state, found.ownerPlayerId);
  let next = detachEverythingFrom(state, targetInstanceId);
  next = updatePlayer(next, found.ownerPlayerId, (p) => ({
    ...p,
    zones: {
      ...p.zones,
      battlefield: p.zones.battlefield.filter((c) => c.instanceId !== targetInstanceId),
      hand: [...p.zones.hand, { ...found.card, tapped: false, attachedToInstanceId: undefined, damageMarked: 0 }],
    },
  }));
  next = { ...next, pendingTarget: null, log: [...next.log, `${targetDef.name} is returned to ${bounceOwner.name}'s hand.`] };
  return { ok: true, state: next };
}

/** "As it enters, choose a color" (Crossroads Village) - see types.ts:
 * ChooseManaColorEffect. Locks the choice onto the card instance forever
 * after; see toggleTap for where that then takes priority over the
 * CardDefinition's own (usually absent, for a card like this) producesMana. */
function chooseManaColor(state: GameState, playerId: string, color: ManaColor): ActionResult {
  const pending = state.pendingManaColorChoice;
  if (!pending) return { ok: false, error: 'Nothing is waiting on a colour choice right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your colour to choose." };

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
  next = updatePlayer(next, playerId, (p) => ({
    ...p,
    zones: { ...p.zones, battlefield: p.zones.battlefield.filter((c) => c.instanceId !== instanceId), hand: [...p.zones.hand, { ...card, tapped: false, attachedToInstanceId: undefined }] },
  }));
  next = { ...next, pendingOptionalBounce: null };

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
 * return it to the battlefield transformed" (Jecht, Reluctant Guardian). */
function resolveOptionalTransform(state: GameState, playerId: string, accept: boolean): ActionResult {
  const pending = state.pendingOptionalTransform;
  if (!pending) return { ok: false, error: 'Nothing is waiting on an optional transform right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your choice to make." };

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

  const library = getPlayer(next, playerId).zones.library;
  const foundIndex = library.findIndex((c) => getCardDefinition(c.defId).name === searchName);
  if (foundIndex === -1) {
    next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: shuffleArr(p.zones.library) } }));
    return { ok: true, state: { ...next, log: [...next.log, `${player.name} cycles ${def.name} - no ${searchName} found, shuffles the library.`] } };
  }

  const found = library[foundIndex];
  const rest = library.filter((_, i) => i !== foundIndex);
  next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: shuffleArr(rest), hand: [...p.zones.hand, found] } }));
  return { ok: true, state: { ...next, log: [...next.log, `${player.name} cycles ${def.name}, searching up a ${searchName}.`] } };
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
  let next = state;
  const active = getPlayer(next, next.activePlayerId);
  for (const c of active.zones.battlefield) {
    const cDef = getCardDefinition(c.defId);
    if (!cDef.bounceSelfAtEndStepIfNotSummoningSick || c.summoningSick) continue;
    next = detachEverythingFrom(next, c.instanceId);
    next = updatePlayer(next, next.activePlayerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.filter((x) => x.instanceId !== c.instanceId),
        hand: [...p.zones.hand, { ...c, tapped: false, attachedToInstanceId: undefined, damageMarked: 0 }],
      },
    }));
    next = { ...next, log: [...next.log, `${cDef.name} returns to ${active.name}'s hand.`] };
  }
  for (const c of active.zones.battlefield) {
    const cDef = getCardDefinition(c.defId);
    if (!cDef.onOwnEndStep || cDef.onOwnEndStep.length === 0) continue;
    const resolved = resolveCardEffects(next, next.activePlayerId, cDef.onOwnEndStep, c.instanceId);
    next = { ...resolved.state, log: [...resolved.state.log, ...resolved.logLines] };
  }
  return next;
}

/** End-of-turn cleanup: clears combat damage, deathtouch marks, temporary
 * buffs/keywords, and other until-end-of-turn state. Fires exactly once,
 * right as cleanup begins. Shared by nextPhase and endTurn. */
function applyCleanupResets(state: GameState): GameState {
  let next = state;
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
          crewedUntilEndOfTurn: undefined,
          temporarilyCreatureUntilEndOfTurn: undefined,
          temporaryGrantedSubtype: undefined,
          temporaryKeywords: undefined,
          onAnyDeathDrawUsedThisTurn: undefined,
        })),
      },
    }));
  }
  next = { ...next, creaturesDiedThisTurn: 0 };
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
    hasDrawnThisTurn: false,
    zones: {
      ...p.zones,
      battlefield: p.zones.battlefield.map((c) => {
        const stun = c.counters.find((ctr) => ctr.label.toLowerCase() === 'stun');
        if (stun && stun.amount > 0) {
          return { ...c, counters: c.counters.map((ctr) => (ctr.label.toLowerCase() === 'stun' ? { ...ctr, amount: ctr.amount - 1 } : ctr)).filter((ctr) => ctr.amount > 0) };
        }
        if (preventsUntap(c.instanceId)) return { ...c, summoningSick: false, producedManaColor: undefined };
        return { ...c, tapped: false, summoningSick: false, producedManaColor: undefined };
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
        // colorless from one tap - everything else defaults to 1.
        const producedAmount = getCardDefinition(c.defId).producesManaAmount ?? 1;
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