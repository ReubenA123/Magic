// ============================================================================
// engine/state.ts (CLIENT-LOCAL COPY for VS AI / practice mode)
// ============================================================================

import { CardInstance, GameState, PlayerState } from '../types';
import { SavedDeck } from '../utils/deckStorage';
import { emptyManaPool } from './mana';

let instanceCounter = 0;
function nextInstanceId(): string {
  instanceCounter += 1;
  return `local-inst-${instanceCounter}`;
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
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
  const zoneNames: (keyof PlayerState['zones'])[] = ['library', 'hand', 'battlefield', 'graveyard', 'exile'];
  for (const player of state.players) {
    for (const zone of zoneNames) {
      const card = player.zones[zone].find((c) => c.instanceId === instanceId);
      if (card) return { ownerPlayerId: player.id, zone, card };
    }
  }
  return null;
}

export function createStateFromDeck(deck: SavedDeck, humanName: string): GameState {
  const humanId = 'you';
  const aiId = 'ai';

  function buildPlayer(id: string, name: string): PlayerState {
    const library: CardInstance[] = shuffle(deck.cardIds).map((defId) => ({
      instanceId: nextInstanceId(),
      defId,
      ownerId: id,
      tapped: false,
      counters: [],
      damageMarked: 0,
      summoningSick: false,
    }));

    const commanderInstance: CardInstance = {
      instanceId: nextInstanceId(),
      defId: deck.commanderId,
      ownerId: id,
      tapped: false,
      counters: [{ label: 'Commander', amount: 1 }],
      damageMarked: 0,
      summoningSick: false,
    };

    const openingHand = library.splice(0, 7);

    return {
      id,
      name,
      life: 40,
      zones: { library, hand: [commanderInstance, ...openingHand], battlefield: [], graveyard: [], exile: [] },
      ready: true,
      manaPool: emptyManaPool(),
    };
  }

  const you = buildPlayer(humanId, humanName);
  const ai = buildPlayer(aiId, 'AI Opponent');

  return {
    players: [you, ai],
    activePlayerId: humanId,
    phase: 'untap',
    turnNumber: 1,
    log: [`${humanName} starts a practice match, both sides playing "${deck.name}".`, "The AI doesn't make real decisions - you control both sides of the board."],
    winnerId: null,
    declaredAttackers: [],
    combatAssignments: [],
  };
}