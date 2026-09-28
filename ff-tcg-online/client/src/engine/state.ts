// ============================================================================
// engine/state.ts (CLIENT-LOCAL COPY for VS AI / practice mode)
// ============================================================================

import { CardInstance, GameState, PlayerState } from '../types';
import { SavedDeck } from '../utils/deckStorage';
import { emptyManaPool } from './mana';

let instanceCounter = 0;
export function nextInstanceId(): string {
  instanceCounter += 1;
  return `local-inst-${instanceCounter}`;
}

export function shuffle<T>(items: T[]): T[] {
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
  const zoneNames: (keyof PlayerState['zones'])[] = ['library', 'hand', 'battlefield', 'graveyard', 'exile', 'commander'];
  for (const player of state.players) {
    for (const zone of zoneNames) {
      const card = player.zones[zone].find((c) => c.instanceId === instanceId);
      if (card) return { ownerPlayerId: player.id, zone, card };
    }
  }
  return null;
}

import { CARD_POOL, getCardDefinition } from '../data/cards';

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

export function createStateFromDeck(deck: SavedDeck, humanName: string): GameState {
  const humanId = 'you';
  const aiId = 'ai';

  // Defensive: a transform back face (Hades, Ragnarok, ...) never exists as
  // its own library card - it's only ever reached by flipping the front
  // face already in play. The deck builder already refuses to add one, but
  // this strips out any that snuck into an older saved deck too, so it can
  // never be drawn or start in an opening hand.
  const backFaceIds = new Set(CARD_POOL.map((c) => c.transformsInto).filter((id): id is string => !!id));
  const cardIds = deck.cardIds.filter((id) => !backFaceIds.has(id));

  function buildPlayer(id: string, name: string): PlayerState {
    const library: CardInstance[] = shuffle(cardIds).map((defId) => ({
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
      counters: [],
      damageMarked: 0,
      summoningSick: false,
    };

    const openingHand = library.splice(0, 7);

    // The AI's commander starts already on the battlefield for now, so it
    // has something to block with from turn one - this is a testing
    // convenience, not how a real Commander game starts.
    const aiStartsOnField = id === 'ai';

    return {
      id,
      name,
      life: 40,
      zones: {
        library,
        hand: openingHand,
        battlefield: aiStartsOnField ? [commanderInstance] : [],
        graveyard: [],
        exile: [],
        commander: aiStartsOnField ? [] : [commanderInstance],
      },
      ready: true,
      manaPool: emptyManaPool(),
      hasPlayedLandThisTurn: false,
      landsPlayedThisTurn: 0,
      hasDrawnThisTurn: false,
      commanderDefId: deck.commanderId,
      commanderDamageTaken: 0,
      lifeGainedThisTurn: 0,
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
    mutualAdjustment: { status: 'inactive', agreedBy: [] },
    pendingDeaths: [],
    combatReadyPlayers: [],
    pendingTarget: null,
    pendingReveal: null,
    pendingManaColorChoice: null,
    pendingSacrifice: null,
    pendingSurveil: null,
    extraTurnsQueued: [],
    extraCombatPhasesQueued: 0,
    combatPhaseNumberThisTurn: 0,
    extraEndStepsQueued: 0,
    endStepNumberThisTurn: 0,
    pendingReturnFromGraveyard: null,
    pendingDiscard: null,
    pendingOptionalBounce: null,
    pendingLandBounce: null,
    exilePlayGrants: [],
    pendingOptionalSacrificeForExilePlay: null,
    pendingLibraryOrGraveyardSearch: null,
    pendingDelayedEndStepEffects: [],
    pendingReturnInstantOrSorceryFromGraveyard: null,
    pendingPutLandFromHand: null,
    pendingCastFromGraveyardAnyMana: null,
    pendingMillThenPutLandIntoHand: null,
    pendingRevealFiltered: null,
    pendingOptionalDiscardHandForDevotion: null,
    pendingChooseOneMode: null,
    pendingPlayerTarget: null,
    creaturesDiedThisTurn: 0,
    pendingReanimate: null,
    pendingReturnCreaturesFromGraveyard: null,
    pendingOptionalTransform: null,
    pendingOptionalPayLife: null,
    pendingCommanderZoneChoice: null,
    pendingWardPayment: null,
    pendingFreeCastFromHand: null,
    pendingNextCreatureSpellBonus: null,
    pendingLibrarySearch: null,
    lastReveal: null,
    pendingGraveyardExile: null,
    pendingDiscardUpToThenDraw: null,
    pendingRevealPickup: null,
    pendingCoinFlip: null,
    lastCoinFlip: null,
    pendingHideaway: null,
    battlefieldLeaveWatchers: [],
    exileUntilSourceLeaves: [],
  };
}

