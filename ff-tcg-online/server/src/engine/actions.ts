// ============================================================================
// engine/actions.ts
// ============================================================================

import { ActionResult, CardDefinition, CardInstance, CombatAssignment, GameAction, GameState, ManaColor, Phase, ZoneName } from '../types';
import { findCardAnywhere, getOpponent, getPlayer, updatePlayer, detachEverythingFrom, nextInstanceId } from './state'; import { getCardDefinition } from '../data/cards';
import { canPay, payCost, parseCostLabel, emptyManaPool, manaValue } from './mana';
import { hasKeyword, hasKeywordEffective } from './keywords';
import { resolveCombatDamage, resolvePendingDeaths, moveCreaturesToGraveyard, effectivePower, isEffectivelyCreature, resolveFight } from './combat';
import { resolveCardEffects, triggerLandfall, triggerNoncreatureCastAbilities, triggerSagaLoreCounter, applyTemporaryBuff, grantTemporaryKeyword, exileAndReturnTransformed } from './effects';

const PHASE_ORDER: Phase[] = ['untap', 'upkeep', 'draw', 'main1', 'combat_begin', 'declare_attackers', 'declare_blockers', 'combat_damage', 'combat_end', 'main2', 'end', 'cleanup'];

function isMutualActive(state: GameState): boolean {
  return state.mutualAdjustment.status === 'active';
}

export function applyAction(state: GameState, action: GameAction, playerId: string): ActionResult {
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
      return castCard(state, playerId, action.instanceId, action.chosenX, action.chosenModeIndices);
    case 'ACTIVATE_ABILITY':
      return activateAbility(state, playerId, action.instanceId, action.abilityId, action.costTargetInstanceId);
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
    next = { ...next, phase: 'main1' };
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
    summoningSick: toZone === 'battlefield' && def.type === 'creature' ? !hasKeyword(def.text, 'haste') : false,
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
    if (!mutual) {
      if (!producedColor) {
        return { ok: false, error: `${def.name} is tapped - it'll untap automatically at your next untap step.` };
      }
      if (getPlayer(state, found.ownerPlayerId).manaPool[producedColor] <= 0) {
        return { ok: false, error: `${def.name}'s mana has already been spent.` };
      }
    }
    let next = updatePlayer(state, found.ownerPlayerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.map((c) => (c.instanceId === instanceId ? { ...c, tapped: false, producedManaColor: undefined } : c)),
      },
      manaPool: producedColor ? { ...p.manaPool, [producedColor]: p.manaPool[producedColor] - 1 } : p.manaPool,
    }));
    if (producedColor) next = { ...next, log: [...next.log, `${def.name} is untapped, returning ${producedColor} mana to the pool.`] };
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

  let next = updatePlayer(state, found.ownerPlayerId, (p) => ({
    ...p,
    zones: {
      ...p.zones,
      battlefield: p.zones.battlefield.map((c) => (c.instanceId === instanceId ? { ...c, tapped: true, producedManaColor: resolvedColor } : c)),
    },
    manaPool: resolvedColor ? { ...p.manaPool, [resolvedColor]: p.manaPool[resolvedColor] + 1 } : p.manaPool,
  }));
  if (resolvedColor) next = { ...next, log: [...next.log, `${def.name} adds ${resolvedColor} to mana pool.`] };

  // "{T}, Sacrifice this: ..." folded into one tap (e.g. a Treasure token) -
  // only once it actually produced mana, not on a no-op tap.
  if (resolvedColor && found.card.sacrificesOnTap) {
    next = moveCreaturesToGraveyard(next, [instanceId], 'is sacrificed');
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

function castCard(state: GameState, playerId: string, instanceId: string, chosenX?: number, chosenModeIndices?: number[]): ActionResult {
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

  if (!mutual && def.type !== 'land' && def.type !== 'instant' && !hasKeyword(def.text, 'flash')) {
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
  const printedCost = parseCostLabel(def.costLabel);
  // "This spell costs 1 less to cast for each permanent card in your
  // graveyard" (Diamond Weapon) - reduces the GENERIC portion only, never
  // below 0.
  const graveyardPermanentCount = player.zones.graveyard.filter((c) => {
    const d = getCardDefinition(c.defId);
    return d.type === 'creature' || d.type === 'artifact' || d.type === 'enchantment' || d.type === 'land';
  }).length;
  const costReduction = def.costReductionPerGraveyardPermanent ? Math.min(printedCost.generic, def.costReductionPerGraveyardPermanent * graveyardPermanentCount) : 0;
  const parsed = costReduction > 0 ? { ...printedCost, generic: printedCost.generic - costReduction } : printedCost;
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
  const hasHaste = hasKeyword(def.text, 'haste');
  // Commander Tax itself doesn't change here - it's already sitting on the
  // card's own counters (carried along by the spread above) and only ever
  // goes up when the commander returns to the command zone, not when it's
  // cast from there - see engine/combat.ts: resolvePendingDeaths.
  const movedCard = { ...card, tapped: isPermanent && !!def.entersTapped, damageMarked: 0, summoningSick: def.type === 'creature' ? !hasHaste : false };

  next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, [targetZone]: [...p.zones[targetZone], movedCard] } }));
  next = checkLegendRule(next, playerId);

  let effectLogLines: string[] = [];
  // A modal spell's chosen modes replace onCast entirely - resolved in the
  // order the modes are printed, regardless of the order they were picked in.
  const autoEffects = def.chooseModes
    ? def.chooseModes.flatMap((mode, i) => (chosenModeIndices!.includes(i) ? mode.effects : []))
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

  if (!mutual && def.type !== 'instant' && !hasKeyword(def.text, 'flash')) {
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
  const hasHaste = hasKeyword(def.text, 'haste');
  const movedCard = { ...card, tapped: isPermanent && !!def.entersTapped, damageMarked: 0, summoningSick: def.type === 'creature' ? !hasHaste : false };

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

function activateAbility(state: GameState, playerId: string, instanceId: string, abilityId: string, costTargetInstanceId?: string): ActionResult {
  const found = findCardAnywhere(state, instanceId);
  if (!found) return { ok: false, error: "That card couldn't be found." };
  const def = getCardDefinition(found.card.defId);
  const ability = def.abilities?.find((a) => a.id === abilityId);
  if (!ability) return { ok: false, error: `${def.name} has no such ability.` };

  const owner = getPlayer(state, found.ownerPlayerId);
  const mutual = isMutualActive(state);
  const manaCost = ability.cost.manaLabel ? parseCostLabel(ability.cost.manaLabel) : null;

  let sacrificeTarget: CardInstance | null = null;
  if (ability.cost.sacrificeAnother) {
    if (!costTargetInstanceId) return { ok: false, error: `${ability.label} requires choosing another permanent to sacrifice.` };
    const candidate = owner.zones.battlefield.find((c) => c.instanceId === costTargetInstanceId);
    if (!candidate || candidate.instanceId === instanceId) {
      return { ok: false, error: `${ability.label} requires sacrificing ANOTHER permanent you control.` };
    }
    const candidateDef = getCardDefinition(candidate.defId);
    const matchesFilter =
      ability.cost.sacrificeAnother === 'artifactOrCreature'
        ? candidateDef.type === 'artifact' || candidateDef.type === 'creature'
        : candidateDef.type === ability.cost.sacrificeAnother;
    if (!matchesFilter) return { ok: false, error: `${ability.label} requires sacrificing a ${ability.cost.sacrificeAnother}.` };
    sacrificeTarget = candidate;
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

  let next = state;
  if (!mutual && manaCost) next = updatePlayer(next, found.ownerPlayerId, (p) => ({ ...p, manaPool: payCost(p.manaPool, manaCost, 0) }));
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
  if (sacrificeTarget) {
    // Goes through the shared death pipeline (not a plain zone move) so it
    // correctly triggers things like onAnyDeathDrain/onDeathDistributeCounters.
    next = moveCreaturesToGraveyard(next, [sacrificeTarget.instanceId], 'is sacrificed');
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
  if (ability.transformSelf && def.transformsInto) {
    const backDefId = def.transformsInto;
    transformedIntoDef = getCardDefinition(backDefId);
    next = updatePlayer(next, found.ownerPlayerId, (p) => ({
      ...p,
      zones: { ...p.zones, [found.zone]: p.zones[found.zone].map((c) => (c.instanceId === instanceId ? { ...c, defId: backDefId } : c)) },
    }));
    if (transformedIntoDef.grantsExtraTurnOnTransform) {
      next = { ...next, extraTurnsQueued: [...next.extraTurnsQueued, found.ownerPlayerId] };
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
            summoningSick: !hasKeyword(resultDef.text, 'haste'),
          },
        ],
        exile: [...p.zones.exile, ...meldedAway],
      },
    }));
  }

  let effectLogLines: string[] = [...exileReturnLogLines];
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
    zones: { ...p.zones, [found.zone]: p.zones[found.zone].map((c) => (c.instanceId === instanceId ? { ...c, defId: backDef.id } : c)) },
  }));
  if (backDef.grantsExtraTurnOnTransform) {
    next = { ...next, extraTurnsQueued: [...next.extraTurnsQueued, found.ownerPlayerId] };
  }
  const extraTurnNote = backDef.grantsExtraTurnOnTransform ? ` ${getPlayer(next, found.ownerPlayerId).name} takes an extra turn after this one.` : '';
  return { ok: true, state: { ...next, log: [...next.log, `${currentDef.name} transforms into ${backDef.name}.${extraTurnNote}`] } };
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
  return hasKeyword(def.text, 'defender') && !(def.ignoresDefenderIfHasCounter && instance.counters.length > 0);
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
        return hasKeyword(def.text, 'vigilance') ? c : { ...c, tapped: true };
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

  for (const id of instanceIds) {
    const attacker = getPlayer(next, playerId).zones.battlefield.find((c) => c.instanceId === id);
    if (!attacker) continue; // e.g. it already left the battlefield via an earlier attacker's own onAttack effect
    const attackerDef = getCardDefinition(attacker.defId);
    if (attackerDef.onAttack && attackerDef.onAttack.length > 0) {
      const resolved = resolveCardEffects(next, playerId, attackerDef.onAttack, id);
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
    const menace = hasKeyword(attackerDef.text, 'menace');

    if (menace && assignment.blockerInstanceIds.length === 1) {
      return { ok: false, error: `${attackerDef.name} has menace - it must be blocked by two or more creatures, or not at all.` };
    }

    for (const blockerId of assignment.blockerInstanceIds) {
      if (usedBlockers.has(blockerId)) return { ok: false, error: 'A creature cannot block more than one attacker.' };
      const blocker = blockerPlayer.zones.battlefield.find((c) => c.instanceId === blockerId);
      if (!blocker) return { ok: false, error: 'One of the chosen blockers is not on your battlefield.' };
      if (blocker.tapped) return { ok: false, error: 'A tapped creature cannot block.' };
      const blockerDef = getCardDefinition(blocker.defId);
      if (hasKeyword(attackerDef.text, 'flying') && !hasKeyword(blockerDef.text, 'flying') && !hasKeyword(blockerDef.text, 'reach')) {
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
    const isOptional = (pending.effect.type === 'selfFightTarget' && pending.effect.optional) || pending.effect.type === 'putCounterOnUpToOneOwnCreature';
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
        battlefield: p.zones.battlefield.map((c) =>
          c.instanceId === targetInstanceId ? { ...c, tapped: true, counters: [...c.counters.filter((ctr) => ctr.label !== 'Stun'), { label: 'Stun', amount: existingStun + 1 }] } : c
        ),
      },
    }));
    next = { ...next, pendingTarget: null };

    const actor = getPlayer(next, playerId);
    return { ok: true, state: { ...next, log: [...next.log, `${actor.name} taps ${targetDef.name} and puts a stun counter on it.`] } };
  }

  const found = findCardAnywhere(state, targetInstanceId);
  if (!found || found.zone !== 'battlefield') return { ok: false, error: "That's not a legal target - it must be a permanent on the battlefield." };
  const targetDef = getCardDefinition(found.card.defId);

  if (pending.effect.type === 'destroyTarget') {
    // Unlike tapAndStun, this can target either player's permanents (e.g.
    // Airship Crash names no controller restriction at all).
    const isFlyingCreature = targetDef.type === 'creature' && hasKeyword(targetDef.text, 'flying');
    const matchesFilter =
      pending.effect.targetFilter === 'anyPermanent' ||
      (pending.effect.targetFilter === 'artifactEnchantmentOrFlyingCreature' && (targetDef.type === 'artifact' || targetDef.type === 'enchantment' || isFlyingCreature)) ||
      (pending.effect.targetFilter === 'artifactOrEnchantment' && (targetDef.type === 'artifact' || targetDef.type === 'enchantment'));
    if (!matchesFilter) return { ok: false, error: `${targetDef.name} is not a legal target for this ability.` };

    if (hasKeywordEffective(targetDef, found.card, 'indestructible')) {
      const next = { ...state, pendingTarget: null };
      return { ok: true, state: { ...next, log: [...next.log, `${targetDef.name} is indestructible and survives.`] } };
    }

    let next = moveCreaturesToGraveyard(state, [targetInstanceId], 'is destroyed');
    next = { ...next, pendingTarget: null };
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
    let next = { ...fought.state, pendingTarget: null };
    next = { ...next, log: [...next.log, ...fought.logLines] };
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
    let next = { ...fought.state, pendingTarget: null };
    next = { ...next, log: [...next.log, ...fought.logLines] };
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
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
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
    next = { ...next, pendingTarget: null };
    const actor = getPlayer(next, playerId);
    return { ok: true, state: { ...next, log: [...next.log, `${actor.name} puts a ${counterLabel} counter on ${targetDef.name}.`] } };
  }

  if (pending.effect.type === 'attachSelfToTarget') {
    if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
    if (found.ownerPlayerId !== playerId) return { ok: false, error: 'You must attach to a creature you control.' };
    const sourceFound = findCardAnywhere(state, pending.sourceInstanceId);
    const sourceDef = sourceFound ? getCardDefinition(sourceFound.card.defId) : null;
    let next = updatePlayer(state, playerId, (p) => ({
      ...p,
      zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === pending.sourceInstanceId ? { ...c, attachedToInstanceId: targetInstanceId } : c)) },
    }));
    if (pending.effect.grantKeyword) next = grantTemporaryKeyword(next, targetInstanceId, pending.effect.grantKeyword);
    next = { ...next, pendingTarget: null };
    const actor = getPlayer(next, playerId);
    const keywordNote = pending.effect.grantKeyword ? ` ${targetDef.name} gains ${pending.effect.grantKeyword} until end of turn.` : '';
    return { ok: true, state: { ...next, log: [...next.log, `${actor.name} attaches ${sourceDef?.name ?? 'the Equipment'} to ${targetDef.name}.${keywordNote}`] } };
  }

  // 'destroyOpponentCreature' (Deadly Embrace) - opponent-only, creature-only.
  if (targetDef.type !== 'creature') return { ok: false, error: `${targetDef.name} is not a legal target - it must be a creature.` };
  if (found.ownerPlayerId === playerId) return { ok: false, error: "That's not a legal target - it must be a creature your opponent controls." };
  if (hasKeywordEffective(targetDef, found.card, 'indestructible')) {
    const next = { ...state, pendingTarget: null };
    return { ok: true, state: { ...next, log: [...next.log, `${targetDef.name} is indestructible and survives.`] } };
  }
  let next = moveCreaturesToGraveyard(state, [targetInstanceId], 'is destroyed');
  next = { ...next, pendingTarget: null };
  if (pending.effect.thenDrawForCreaturesDiedThisTurn && next.creaturesDiedThisTurn > 0) {
    const actor = getPlayer(next, playerId);
    const count = next.creaturesDiedThisTurn;
    const drawn = actor.zones.library.slice(0, count);
    next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(count), hand: [...p.zones.hand, ...drawn] } }));
    next = { ...next, log: [...next.log, `${actor.name} draws ${drawn.length} card(s) (${count} creature(s) died this turn).`] };
  }
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
 * Black Mages) - see types.ts: SacrificeCreatureEffect. Only reached for a
 * real human opponent; the VS AI opponent picks its own creature
 * automatically inside effects.ts's resolveCardEffects instead. */
function chooseSacrifice(state: GameState, playerId: string, instanceId: string): ActionResult {
  const pending = state.pendingSacrifice;
  if (!pending) return { ok: false, error: 'Nothing is waiting on a sacrifice right now.' };
  if (pending.playerId !== playerId) return { ok: false, error: "It's not your creature to sacrifice." };

  const player = getPlayer(state, playerId);
  const card = player.zones.battlefield.find((c) => c.instanceId === instanceId);
  if (!card) return { ok: false, error: 'That creature is not on your battlefield.' };
  const def = getCardDefinition(card.defId);
  if (def.type !== 'creature') return { ok: false, error: 'You must sacrifice a creature.' };

  let next = moveCreaturesToGraveyard(state, [instanceId], 'is sacrificed');
  next = { ...next, pendingSacrifice: null };

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

  const player = getPlayer(next, playerId);
  return { ok: true, state: { ...next, log: [...next.log, `${player.name} surveils: ${toGraveyard.length} to the graveyard, ${toKeep.length} back on top.`] } };
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
  let next = updatePlayer(state, playerId, (p) => ({
    ...p,
    zones: {
      ...p.zones,
      hand: taken ? [...p.zones.hand, taken] : p.zones.hand,
      library: [...p.zones.library, ...shuffleArr(rest)],
    },
  }));
  next = { ...next, pendingRevealFiltered: null };

  const player = getPlayer(next, playerId);
  const logLine = taken
    ? `${player.name} takes ${getCardDefinition(taken.defId).name}; the rest go to the bottom of the library in a random order.`
    : `${player.name} puts all revealed cards on the bottom of the library in a random order.`;
  return { ok: true, state: { ...next, log: [...next.log, logLine] } };
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
      let next = resolveCombatDamage(state);
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
      let next = resolveCombatDamage({ ...state, combatReadyPlayers: [] });
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

  let next: GameState = clearManaAndRefundUnspentLands({ ...state, phase: nextPhaseName });

  // Leaving End Combat: now that both players have seen the outcome,
  // actually move anything that died to the graveyard, and clear the
  // combat bookkeeping so surviving attackers/blockers reappear in their
  // normal battlefield row for the rest of the turn (previously this only
  // cleared at END_TURN, so survivors stayed invisible all the way through
  // main phase 2).
  if (state.phase === 'combat_end') {
    next = resolvePendingDeaths(next);
    next = { ...next, declaredAttackers: [], combatAssignments: [] };
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

  // "As your precombat main phase begins, put a lore counter on each Saga
  // you control" - fires exactly once, right as the active player's main1
  // begins (right after their draw step in the normal phase order). See
  // types.ts: SagaAbility, engine/effects.ts: triggerSagaLoreCounter.
  if (next.phase === 'main1') {
    const active = getPlayer(next, next.activePlayerId);
    for (const c of active.zones.battlefield) {
      if (!getCardDefinition(c.defId).saga) continue;
      const sagaResult = triggerSagaLoreCounter(next, next.activePlayerId, c.instanceId);
      next = { ...sagaResult.state, log: [...sagaResult.state.log, ...sagaResult.logLines] };
    }
  }

  // "At the beginning of your end step, if this creature didn't enter the
  // battlefield this turn, return it to its owner's hand" (Cactuar) -
  // summoningSick is still true for the rest of the turn something entered
  // (cleared only at the controller's own next untap step), so !summoningSick
  // here means it's been out since before this turn. Fires exactly once,
  // right as the active player's own end step begins.
  if (next.phase === 'end') {
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
  }

  if (next.phase === 'cleanup') {
    for (const player of next.players) {
      next = updatePlayer(next, player.id, (p) => ({
        ...p,
        zones: {
          ...p.zones,
          battlefield: p.zones.battlefield.map((c) => ({
            ...c,
            damageMarked: 0,
            tookDeathtouchDamage: false,
            temporaryBuff: undefined,
            crewedUntilEndOfTurn: undefined,
            temporaryKeywords: undefined,
          })),
        },
      }));
    }
    next = { ...next, creaturesDiedThisTurn: 0 };
    const active = getPlayer(next, next.activePlayerId);
    if (active.zones.hand.length > 7) {
      next = { ...next, log: [...next.log, `${active.name} has more than 7 cards - discard down to 7 before ending the turn.`] };
    }
  }

  return { ok: true, state: next };
}

function runUntapStep(state: GameState, playerId: string): GameState {
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
 * walk the color's still-full pool down by one per untapped land, so with
 * several lands of the same color only as many of them untap as actually
 * went unspent.
 */
function untapUnspentManaLands(state: GameState, playerId: string): GameState {
  const remaining: Record<ManaColor, number> = { ...getPlayer(state, playerId).manaPool };
  return updatePlayer(state, playerId, (p) => ({
    ...p,
    zones: {
      ...p.zones,
      battlefield: p.zones.battlefield.map((c) => {
        if (!c.tapped || !c.producedManaColor || remaining[c.producedManaColor] <= 0) return c;
        remaining[c.producedManaColor] -= 1;
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

  // An extra turn (e.g. Ultimecia, Omnipotent's Time Compression) jumps the
  // queue ahead of the normal opponent's-turn handoff - possibly giving the
  // SAME player another turn, if that's who the queue names.
  const queuedPlayerId = state.extraTurnsQueued[0];
  const newActivePlayer = queuedPlayerId ? getPlayer(state, queuedPlayerId) : getOpponent(state, playerId);

  // Turn end is a phase change too, so the same unspent-mana clear applies
  // here first - runUntapStep then fully untaps the new active player
  // regardless, making its own refund redundant for them but harmless.
  let next = clearManaAndRefundUnspentLands(state);
  next = runUntapStep(next, newActivePlayer.id);
  next = {
    ...next,
    activePlayerId: newActivePlayer.id,
    phase: 'untap',
    turnNumber: next.turnNumber + 1,
    declaredAttackers: [],
    combatAssignments: [],
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
  return { ok: true, state: { ...state, winnerId: opponent.id, log: [...state.log, `${conceder.name} concedes. ${opponent.name} wins!`] } };
}