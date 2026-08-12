// ============================================================================
// engine/state.ts
//
// Builds the initial GameState: shuffles each player's deck into their
// library and starts them with an EMPTY hand. There's no automatic opening
// hand - see README.md's "Pregame / mulligan" section for why: drawing is
// manual throughout this app, including at the start of the game, so
// players draw their own opening hands and can freely put cards back and
// re-shuffle before hitting Ready.
// ============================================================================

import { CardInstance, GameState, PlayerState } from '../types';
import { buildDefaultDecklist } from '../data/cards';

let instanceCounter = 0;
function nextInstanceId(): string {
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
  }));

  return {
    id,
    name,
    life: 20,
    zones: { library, hand: [], battlefield: [], graveyard: [], exile: [] },
    ready: false,
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

export function findOwningZone(player: PlayerState, instanceId: string): { zone: keyof PlayerState['zones']; card: CardInstance } | null {
  const zoneNames: (keyof PlayerState['zones'])[] = ['library', 'hand', 'battlefield', 'graveyard', 'exile'];
  for (const zone of zoneNames) {
    const card = player.zones[zone].find((c) => c.instanceId === instanceId);
    if (card) return { zone, card };
  }
  return null;
}

/**
 * Finds a card instance across BOTH players' zones, not just one player's.
 * This is what lets either player act on either player's cards (tap an
 * opponent's creature, move their dead creature to their own graveyard,
 * add a counter your removal spell put on their permanent, etc) - a
 * deliberate choice for a shared, trust-based tool rather than a strictly
 * adversarial one. See engine/actions.ts for where this gets used.
 */
export function findCardAnywhere(state: GameState, instanceId: string): { ownerPlayerId: string; zone: keyof PlayerState['zones']; card: CardInstance } | null {
  for (const player of state.players) {
    const found = findOwningZone(player, instanceId);
    if (found) return { ownerPlayerId: player.id, zone: found.zone, card: found.card };
  }
  return null;
}

export { shuffle, nextInstanceId };
