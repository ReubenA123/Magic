// ============================================================================
// engine/actions.ts
// ============================================================================

import { ActionResult, CombatAssignment, GameAction, GameState, ManaColor, Phase, ZoneName } from '../types';
import { findCardAnywhere, getOpponent, getPlayer, updatePlayer } from './state';
import { getCardDefinition } from '../data/cards';
import { emptyManaPool, canPay, payCost, parseCostLabel } from './mana';
import { hasKeyword } from './keywords';
import { resolveCombatDamage } from './combat';

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
    case 'DECLARE_ATTACKERS':
      return declareAttackers(state, playerId, action.instanceIds);
    case 'DECLARE_BLOCKERS':
      return declareBlockers(state, playerId, action.assignments);
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

function emptyManaPools(state: GameState): GameState {
  return { ...state, players: state.players.map((p) => ({ ...p, manaPool: emptyManaPool() })) as GameState['players'] };
}

function shuffleArr<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function drawCard(state: GameState, playerId: string): ActionResult {
  const player = getPlayer(state, playerId);
  if (!isMutualActive(state) && player.hasDrawnThisTurn) {
    return { ok: false, error: 'Already drew a card this turn.' };
  }
  const result = performDraw(state, playerId);
  if (!result.ok) return result;
  const next = updatePlayer(result.state, playerId, (p) => ({ ...p, hasDrawnThisTurn: true }));
  return { ok: true, state: next };
}

function performDraw(state: GameState, playerId: string): ActionResult {
  const player = getPlayer(state, playerId);
  const [drawn, ...rest] = player.zones.library;
  if (!drawn) return { ok: false, error: 'Your library is empty.' };
  const next = updatePlayer(state, playerId, (p) => ({ ...p, zones: { ...p.zones, library: rest, hand: [...p.zones.hand, drawn] } }));
  return { ok: true, state: { ...next, log: [...next.log, `${player.name} draws a card.`] } };
}

/** Manual zone moves - for anything that ISN'T "play this card from my
 * hand," which now goes through castCard instead (see below) so cost gets
 * enforced. Moving hand/commander -> battlefield is blocked here outside
 * Mutual Adjustment, since that would bypass paying for the card. */
function moveCard(state: GameState, playerId: string, instanceId: string, toZone: ZoneName): ActionResult {
  const found = findCardAnywhere(state, instanceId);
  if (!found) return { ok: false, error: "That card couldn't be found." };
  if (found.zone === toZone) return { ok: false, error: 'That card is already there.' };

  const mutual = isMutualActive(state);
  if (!mutual && toZone === 'battlefield' && (found.zone === 'hand' || found.zone === 'commander')) {
    return { ok: false, error: 'Use the Play/Cast button instead - it pays the cost automatically.' };
  }

  const ownerId = found.ownerPlayerId;
  let next = updatePlayer(state, ownerId, (p) => ({ ...p, zones: { ...p.zones, [found.zone]: p.zones[found.zone].filter((c) => c.instanceId !== instanceId) } }));

  const def = getCardDefinition(found.card.defId);
  const movedCard = {
    ...found.card,
    tapped: false,
    damageMarked: 0,
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

  let next = updatePlayer(state, found.ownerPlayerId, (p) => ({
    ...p,
    zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === instanceId ? { ...c, tapped: !c.tapped } : c)) },
  }));

  if (!wasTapped && def.type === 'land' && def.producesMana) {
    const resolved = resolveTapColor(def.producesMana, chosenColor);
    if (!resolved.ok) return resolved;
    next = updatePlayer(next, found.ownerPlayerId, (p) => ({ ...p, manaPool: { ...p.manaPool, [resolved.color]: p.manaPool[resolved.color] + 1 } }));
    next = { ...next, log: [...next.log, `${def.name} adds ${resolved.color} to mana pool.`] };
  }

  return { ok: true, state: next };
}

/**
 * The single "play this card" action - covers lands AND spells. The engine
 * decides where the card ends up: lands and permanents go to the
 * battlefield, instants/sorceries go to the graveyard after resolving.
 * Lands are free but limited to one per turn (on your own turn); everything
 * else costs mana, checked and paid automatically. Mutual Adjustment
 * bypasses both the cost and the one-land-per-turn limit.
 */
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
  let movedCard = { ...card, tapped: false, damageMarked: 0, summoningSick: def.type === 'creature' ? !hasHaste : false };

  if (sourceZone === 'commander') {
    const existingTax = movedCard.counters.find((c) => c.label === 'Commander Tax')?.amount ?? 0;
    movedCard = { ...movedCard, counters: [...movedCard.counters.filter((c) => c.label !== 'Commander Tax'), { label: 'Commander Tax', amount: existingTax + 2 }] };
  }

  next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, [targetZone]: [...p.zones[targetZone], movedCard] } }));

  const xNote = parsed.hasX ? ` (X=${chosenX ?? 0})` : '';
  const taxNote = commanderTax > 0 ? ` (+${commanderTax} commander tax paid)` : '';
  const freeNote = mutual ? ' (free - Mutual Adjustment active)' : '';
  return { ok: true, state: { ...next, log: [...next.log, `${player.name} casts ${def.name}${xNote}${taxNote}${freeNote}.`] } };
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

  next = {
    ...next,
    declaredAttackers: instanceIds,
    combatAssignments: instanceIds.map((id) => ({ attackerInstanceId: id, blockerInstanceIds: [] })),
    phase: 'declare_blockers',
    log: [...next.log, instanceIds.length > 0 ? `${player.name} attacks with ${instanceIds.length} creature(s).` : `${player.name} declares no attackers.`],
  };

  return { ok: true, state: emptyManaPools(next) };
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

  let next: GameState = {
    ...state,
    combatAssignments: state.combatAssignments.map((existing) => assignments.find((a) => a.attackerInstanceId === existing.attackerInstanceId) ?? existing),
    log: [...state.log, `${blockerPlayer.name} declares blockers.`],
  };

  next = resolveCombatDamage(next);
  next = { ...next, phase: 'combat_damage' };
  return { ok: true, state: emptyManaPools(next) };
}

function nextPhase(state: GameState, playerId: string): ActionResult {
  if (state.activePlayerId !== playerId) return { ok: false, error: 'Only the active player advances the phase.' };
  if (state.phase === 'declare_attackers') return { ok: false, error: 'Declare your attackers (even zero) to move past this step.' };
  if (state.phase === 'declare_blockers') return { ok: false, error: "Waiting on the defending player's blocks." };

  const currentIndex = PHASE_ORDER.indexOf(state.phase as Phase);
  if (currentIndex === -1 || currentIndex === PHASE_ORDER.length - 1) {
    return { ok: false, error: 'Use End Turn to move on from the cleanup step.' };
  }

  let next: GameState = { ...state, phase: PHASE_ORDER[currentIndex + 1] };
  next = emptyManaPools(next);

  if (next.phase === 'draw') {
    const result = performDraw(next, next.activePlayerId);
    if (result.ok) next = updatePlayer(result.state, next.activePlayerId, (p) => ({ ...p, hasDrawnThisTurn: true }));
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
        return { ...c, tapped: false, summoningSick: false };
      }),
    },
  }));
}

function endTurn(state: GameState, playerId: string): ActionResult {
  if (state.activePlayerId !== playerId) return { ok: false, error: "It's not your turn." };
  const newActivePlayer = getOpponent(state, playerId);

  let next = runUntapStep(state, newActivePlayer.id);
  next = emptyManaPools(next);
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