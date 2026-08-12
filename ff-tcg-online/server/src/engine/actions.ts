// ============================================================================
// engine/actions.ts
//
// The single entry point for every player intent - applyAction(state,
// action, playerId) is the only function the server calls when a client
// sends a move (see socket/index.ts). Validation here is deliberately light:
// it checks things like "is this card actually yours" and "does this
// instance exist," but it never checks whether a move is legal under any
// card's rules text - see types.ts for why. Undo (for the inevitable
// misclick) is handled one layer up, in socket/index.ts, by snapshotting
// state before each action rather than in here.
// ============================================================================

import { ActionResult, GameAction, GameState, Phase, ZoneName } from '../types';
import { findCardAnywhere, getOpponent, getPlayer, shuffle, updatePlayer } from './state';
import { getCardDefinition } from '../data/cards';

const PHASE_ORDER: Phase[] = ['untap', 'upkeep', 'draw', 'main1', 'combat', 'main2', 'end'];

export function applyAction(state: GameState, action: GameAction, playerId: string): ActionResult {
  switch (action.type) {
    case 'DRAW_CARD':
      return drawCard(state, playerId);
    case 'MOVE_CARD':
      return moveCard(state, playerId, action.instanceId, action.toZone);
    case 'SHUFFLE_LIBRARY':
      return shuffleLibrary(state, playerId);
    case 'TOGGLE_TAP':
      return toggleTap(state, playerId, action.instanceId);
    case 'ADJUST_LIFE':
      return adjustLife(state, action.playerId, action.delta);
    case 'ADJUST_COUNTER':
      return adjustCounter(state, playerId, action.instanceId, action.label, action.delta);
    case 'FLIP_CARD':
      return flipCard(state, action.instanceId);
    case 'NEXT_PHASE':
      return nextPhase(state, playerId);
    case 'END_TURN':
      return endTurn(state, playerId);
    case 'READY_TO_START':
      return readyToStart(state, playerId);
    case 'CONCEDE':
      return concede(state, playerId);
    case 'UNDO':
      // Handled entirely in socket/index.ts (it operates on history, not on
      // a single state) - routed here only so the switch is exhaustive.
      return { ok: false, error: 'UNDO should be handled by the socket layer.' };
    default:
      return { ok: false, error: 'Unknown action.' };
  }
}

function drawCard(state: GameState, playerId: string): ActionResult {
  const player = getPlayer(state, playerId);
  const [drawn, ...rest] = player.zones.library;
  if (!drawn) return { ok: false, error: 'Your library is empty.' };

  const next = updatePlayer(state, playerId, (p) => ({ ...p, zones: { ...p.zones, library: rest, hand: [...p.zones.hand, drawn] } }));
  return { ok: true, state: { ...next, log: [...next.log, `${player.name} draws a card.`] } };
}

function moveCard(state: GameState, playerId: string, instanceId: string, toZone: ZoneName): ActionResult {
  const found = findCardAnywhere(state, instanceId);
  if (!found) return { ok: false, error: "That card couldn't be found." };
  if (found.zone === toZone) return { ok: false, error: 'That card is already there.' };

  const ownerId = found.ownerPlayerId;

  let next = updatePlayer(state, ownerId, (p) => ({
    ...p,
    zones: { ...p.zones, [found.zone]: p.zones[found.zone].filter((c) => c.instanceId !== instanceId) },
  }));

  // Cards always enter their new zone untapped. Real Magic also strips most
  // counters on most zone changes; that detail isn't automatic here, so
  // clear counters yourselves via the card panel if that matters to you.
  const movedCard = { ...found.card, tapped: false };

  next = updatePlayer(next, ownerId, (p) => {
    if (toZone === 'library') {
      // "Milling" a card back into the library shuffles it in immediately,
      // rather than placing it on top - matches shuffling a card back into
      // a physical deck.
      return { ...p, zones: { ...p.zones, library: shuffle([...p.zones.library, movedCard]) } };
    }
    return { ...p, zones: { ...p.zones, [toZone]: [...p.zones[toZone], movedCard] } };
  });

  const mover = getPlayer(state, playerId);
  const cardName = getCardDefinition(movedCard.defId).name;
  return { ok: true, state: { ...next, log: [...next.log, `${mover.name} moves ${cardName} to ${toZone}.`] } };
}

function shuffleLibrary(state: GameState, playerId: string): ActionResult {
  const player = getPlayer(state, playerId);
  const next = updatePlayer(state, playerId, (p) => ({ ...p, zones: { ...p.zones, library: shuffle(p.zones.library) } }));
  return { ok: true, state: { ...next, log: [...next.log, `${player.name} shuffles their library.`] } };
}

function toggleTap(state: GameState, playerId: string, instanceId: string): ActionResult {
  const found = findCardAnywhere(state, instanceId);
  if (!found || found.zone !== 'battlefield') return { ok: false, error: 'Only cards on a battlefield can be tapped.' };

  const next = updatePlayer(state, found.ownerPlayerId, (p) => ({
    ...p,
    zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === instanceId ? { ...c, tapped: !c.tapped } : c)) },
  }));
  return { ok: true, state: next };
}

function adjustLife(state: GameState, targetPlayerId: string, delta: number): ActionResult {
  const target = getPlayer(state, targetPlayerId);
  const next = updatePlayer(state, targetPlayerId, (p) => ({ ...p, life: p.life + delta }));
  const verb = delta >= 0 ? 'gains' : 'loses';
  return { ok: true, state: { ...next, log: [...next.log, `${target.name} ${verb} ${Math.abs(delta)} life (now ${target.life + delta}).`] } };
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
    zones: {
      ...p.zones,
      [found.zone]: p.zones[found.zone].map((c) => (c.instanceId === instanceId ? { ...c, defId: backDef.id } : c)),
    },
  }));

  return { ok: true, state: { ...next, log: [...next.log, `${currentDef.name} transforms into ${backDef.name}.`] } };
}

function nextPhase(state: GameState, playerId: string): ActionResult {
  if (state.activePlayerId !== playerId) return { ok: false, error: 'Only the active player advances the phase.' };
  const currentIndex = PHASE_ORDER.indexOf(state.phase as Phase);
  if (currentIndex === -1 || currentIndex === PHASE_ORDER.length - 1) {
    return { ok: false, error: 'Use End Turn to move on from the end step.' };
  }
  return { ok: true, state: { ...state, phase: PHASE_ORDER[currentIndex + 1] } };
}

function endTurn(state: GameState, playerId: string): ActionResult {
  if (state.activePlayerId !== playerId) return { ok: false, error: "It's not your turn." };
  const newActivePlayer = getOpponent(state, playerId);

  // Quality-of-life: automatically untap the new active player's
  // battlefield, matching the untap step every real turn starts with, so
  // you're not clicking every land by hand each turn.
  let next = updatePlayer(state, newActivePlayer.id, (p) => ({
    ...p,
    zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => ({ ...c, tapped: false })) },
  }));

  next = {
    ...next,
    activePlayerId: newActivePlayer.id,
    phase: 'untap',
    turnNumber: next.turnNumber + 1,
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

function concede(state: GameState, playerId: string): ActionResult {
  const opponent = getOpponent(state, playerId);
  const conceder = getPlayer(state, playerId);
  return { ok: true, state: { ...state, winnerId: opponent.id, log: [...state.log, `${conceder.name} concedes. ${opponent.name} wins!`] } };
}
