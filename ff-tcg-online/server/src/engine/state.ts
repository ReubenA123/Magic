// ============================================================================
// engine/state.ts
// ============================================================================

import { CardInstance, GameState, PlayerState } from '../types';
import { buildDefaultDecklist, getCardDefinition } from '../data/cards';
import { emptyManaPool } from './mana';

let instanceCounter = 0;
export function nextInstanceId(): string {
  instanceCounter += 1;
  return `inst-${instanceCounter}`;
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildPlayer(id: string, name: string): PlayerState {
  const decklist = buildDefaultDecklist();
  const library: CardInstance[] = shuffle(decklist).map((defId) => ({
    instanceId: nextInstanceId(),
    defId,
    ownerId: id,
    tapped: false,
    counters: [],
    damageMarked: 0,
    summoningSick: false,
  }));

  return {
    id,
    name,
    life: 20,
    zones: { library, hand: [], battlefield: [], graveyard: [], exile: [], commander: [] },
    ready: false,
    manaPool: emptyManaPool(),
    hasPlayedLandThisTurn: false,
    hasDrawnThisTurn: false,
    commanderDamageTaken: 0,
  };
}

export function createInitialState(player1Name: string, player2Name: string, player1Id: string, player2Id: string): GameState {
  const p1 = buildPlayer(player1Id, player1Name);
  const p2 = buildPlayer(player2Id, player2Name);

  return {
    players: [p1, p2],
    activePlayerId: p1.id,
    phase: 'pregame',
    turnNumber: 0,
    log: [`${p1.name} and ${p2.name} begin a game. Draw your opening hand, then press Ready when you're happy with it.`],
    winnerId: null,
    declaredAttackers: [],
    combatAssignments: [],
    mutualAdjustment: { status: 'inactive', agreedBy: [] },
    pendingDeaths: [],
    pendingTarget: null,
    pendingReveal: null,
  };
}

export function getPlayer(state: GameState, playerId: string): PlayerState {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new Error(`Unknown player id: ${playerId}`);
  return player;
}

export function getOpponent(state: GameState, playerId: string): PlayerState {
  const opponent = state.players.find((p) => p.id !== playerId);
  if (!opponent) throw new Error(`No opponent found for player id: ${playerId}`);
  return opponent;
}

export function updatePlayer(state: GameState, playerId: string, updater: (p: PlayerState) => PlayerState): GameState {
  return { ...state, players: state.players.map((p) => (p.id === playerId ? updater(p) : p)) as GameState['players'] };
}

export function findCardAnywhere(state: GameState, instanceId: string) {
  const zoneNames: (keyof PlayerState['zones'])[] = ['library', 'hand', 'battlefield', 'graveyard', 'exile', 'commander'];
  for (const player of state.players) {
    for (const zone of zoneNames) {
      const card = player.zones[zone].find((c) => c.instanceId === instanceId);
      if (card) return { ownerPlayerId: player.id, zone, card };
    }
  }
  return null;
}

/** Shared by actions.ts and combat.ts: when a permanent leaves the
 * battlefield, detach anything attached to it. Auras go to their owner's
 * graveyard; Equipment just becomes unattached and stays put. */
export function detachEverythingFrom(state: GameState, anchorInstanceId: string): GameState {
  let next = state;
  for (const p2 of next.players) {
    const attached = p2.zones.battlefield.filter((c) => c.attachedToInstanceId === anchorInstanceId);
    for (const child of attached) {
      const childDef = getCardDefinition(child.defId);
      if (childDef.type === 'enchantment') {
        next = updatePlayer(next, p2.id, (p) => ({
          ...p,
          zones: { ...p.zones, battlefield: p.zones.battlefield.filter((c) => c.instanceId !== child.instanceId), graveyard: [...p.zones.graveyard, { ...child, attachedToInstanceId: undefined, tapped: false }] },
        }));
        next = { ...next, log: [...next.log, `${childDef.name} falls off and goes to the graveyard.`] };
      } else {
        next = updatePlayer(next, p2.id, (p) => ({
          ...p,
          zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === child.instanceId ? { ...c, attachedToInstanceId: undefined } : c)) },
        }));
        next = { ...next, log: [...next.log, `${childDef.name} becomes unattached.`] };
      }
    }
  }
  return next;
}

export { shuffle };