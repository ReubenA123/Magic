// ============================================================================
// engine/actions.ts
// ============================================================================

import { ActionResult, CardInstance, CombatAssignment, GameAction, GameState, ManaColor, Phase, ZoneName } from '../types';
import { findCardAnywhere, getOpponent, getPlayer, updatePlayer, detachEverythingFrom } from './state'; import { getCardDefinition } from '../data/cards';
import { canPay, payCost, parseCostLabel, emptyManaPool } from './mana';
import { hasKeyword } from './keywords';
import { resolveCombatDamage, resolvePendingDeaths } from './combat';
import { resolveCardEffects } from './effects';

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
      return castCard(state, playerId, action.instanceId, action.chosenX);
    case 'ACTIVATE_ABILITY':
      return activateAbility(state, playerId, action.instanceId, action.abilityId);
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

  // Untapping: hand back whatever mana this specific land produced - but only
  // while that mana is still sitting unspent in the pool. Once it's been
  // spent on something, the land stays tapped for the rest of the turn, same
  // as it would after tapping it for any other reason.
  if (wasTapped) {
    const producedColor = found.card.producedManaColor;
    if (producedColor && getPlayer(state, found.ownerPlayerId).manaPool[producedColor] <= 0) {
      return { ok: false, error: `${def.name}'s mana has already been spent.` };
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
  if (def.type === 'land' && def.producesMana) {
    const resolved = resolveTapColor(def.producesMana, chosenColor);
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

function castCard(state: GameState, playerId: string, instanceId: string, chosenX?: number): ActionResult {
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
    const movedCard = { ...card, tapped: false, damageMarked: 0, summoningSick: false };
    next = updatePlayer(next, playerId, (p) => ({
      ...p,
      zones: { ...p.zones, battlefield: [...p.zones.battlefield, movedCard] },
      hasPlayedLandThisTurn: mutual ? p.hasPlayedLandThisTurn : true,
    }));
    next = checkLegendRule(next, playerId);
    return { ok: true, state: { ...next, log: [...next.log, `${player.name} plays ${def.name}.`] } };
  }

  const commanderTax = sourceZone === 'commander' ? card.counters.find((c) => c.label === 'Commander Tax')?.amount ?? 0 : 0;
  const parsed = parseCostLabel(def.costLabel);
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
  const movedCard = { ...card, tapped: false, damageMarked: 0, summoningSick: def.type === 'creature' ? !hasHaste : false };

  next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, [targetZone]: [...p.zones[targetZone], movedCard] } }));
  next = checkLegendRule(next, playerId);

  let effectLogLines: string[] = [];
  const autoEffects = isPermanent ? def.onEnter : def.onCast;
  if (autoEffects && autoEffects.length > 0) {
    const resolved = resolveCardEffects(next, playerId, autoEffects, movedCard.instanceId);
    next = resolved.state;
    effectLogLines = resolved.logLines;
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
  const movedCard = { ...card, tapped: false, damageMarked: 0, summoningSick: def.type === 'creature' ? !hasHaste : false };

  next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, [targetZone]: [...p.zones[targetZone], movedCard] } }));
  next = checkLegendRule(next, playerId);

  let effectLogLines: string[] = [];
  const autoEffects = isPermanent ? def.onEnter : def.onCast;
  if (autoEffects && autoEffects.length > 0) {
    const resolved = resolveCardEffects(next, playerId, autoEffects, movedCard.instanceId);
    next = resolved.state;
    effectLogLines = resolved.logLines;
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

function activateAbility(state: GameState, playerId: string, instanceId: string, abilityId: string): ActionResult {
  const found = findCardAnywhere(state, instanceId);
  if (!found) return { ok: false, error: "That card couldn't be found." };
  const def = getCardDefinition(found.card.defId);
  const ability = def.abilities?.find((a) => a.id === abilityId);
  if (!ability) return { ok: false, error: `${def.name} has no such ability.` };

  const owner = getPlayer(state, found.ownerPlayerId);
  const mutual = isMutualActive(state);
  const manaCost = ability.cost.manaLabel ? parseCostLabel(ability.cost.manaLabel) : null;

  if (!mutual && ability.cost.tap && def.type === 'creature' && found.card.summoningSick) {
    return { ok: false, error: `${def.name} has summoning sickness and can't use a tap ability yet.` };
  }
  if (ability.cost.tap && found.card.tapped) return { ok: false, error: `${def.name} is already tapped.` };
  if (!mutual && manaCost && !canPay(owner.manaPool, manaCost, 0)) return { ok: false, error: `Not enough mana to activate ${ability.label}.` };

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

  let logLine = `${owner.name} activates ${ability.label} on ${def.name}: ${ability.effectText}`;
  if (ability.cost.discardCards) logLine += ` (also discard ${ability.cost.discardCards} card(s) manually as part of the cost)`;

  return { ok: true, state: { ...next, log: [...next.log, logLine] } };
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

function flipCard(state: GameState, instanceId: string): ActionResult {
  const found = findCardAnywhere(state, instanceId);
  if (!found) return { ok: false, error: "That card couldn't be found." };
  const currentDef = getCardDefinition(found.card.defId);
  if (!currentDef.transformsInto) return { ok: false, error: `${currentDef.name} has no back face to flip to.` };
  const backDef = getCardDefinition(currentDef.transformsInto);
  const next = updatePlayer(state, found.ownerPlayerId, (p) => ({
    ...p,
    zones: { ...p.zones, [found.zone]: p.zones[found.zone].map((c) => (c.instanceId === instanceId ? { ...c, defId: backDef.id } : c)) },
  }));
  return { ok: true, state: { ...next, log: [...next.log, `${currentDef.name} transforms into ${backDef.name}.`] } };
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
function hasLegalAttacker(state: GameState, playerId: string): boolean {
  return getPlayer(state, playerId).zones.battlefield.some((c) => {
    if (c.tapped || c.summoningSick) return false;
    const def = getCardDefinition(c.defId);
    return def.type === 'creature' && !hasKeyword(def.text, 'defender');
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
    if (def.type !== 'creature') return { ok: false, error: 'Only creatures can attack.' };
    if (hasKeyword(def.text, 'defender')) return { ok: false, error: `${def.name} has defender and can't attack.` };
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

function chooseTarget(state: GameState, playerId: string, targetInstanceId: string): ActionResult {
  const pending = state.pendingTarget;
  if (!pending) return { ok: false, error: 'No effect is waiting for a target right now.' };
  if (pending.controllerId !== playerId) return { ok: false, error: "It's not your target to choose." };

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

  if (next.phase === 'cleanup') {
    for (const player of next.players) {
      next = updatePlayer(next, player.id, (p) => ({ ...p, zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => ({ ...c, damageMarked: 0 })) } }));
    }
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
  const newActivePlayer = getOpponent(state, playerId);

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
    log: [...next.log, `Turn ${next.turnNumber + 1}: ${newActivePlayer.name}'s turn.`],
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