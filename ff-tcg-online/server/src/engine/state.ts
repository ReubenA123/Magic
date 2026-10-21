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
    landsPlayedThisTurn: 0,
    hasDrawnThisTurn: false,
    commanderDamageTaken: 0,
    lifeGainedThisTurn: 0,
    lifeLostThisTurn: 0,
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
    pendingEquipmentDeathEffects: [],
    pendingCreatureEnteredFromGraveyardEffects: [],
    combatReadyPlayers: [],
    pendingTarget: null,
    pendingReveal: null,
    pendingManaColorChoice: null,
    pendingAddManaOfChosenColor: null,
    pendingSacrifice: null,
    pendingKeepOneSacrificeRest: null,
    pendingChooseUpToNCreaturesSacrificeRest: null,
    pendingScryBeforeExile: null,
    pendingSurveil: null,
    pendingExplore: null,
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
    graveyardPlayGrants: [],
    pendingOptionalSacrificeForExilePlay: null,
    pendingLibraryOrGraveyardSearch: null,
    pendingDelayedEndStepEffects: [],
    pendingRevealFiltered: null,
    pendingOptionalDiscardHandForDevotion: null,
    pendingChooseOneMode: null,
    pendingPlayerTarget: null,
    creaturesDiedThisTurn: 0,
    pendingReanimate: null,
    pendingReturnInstantOrSorceryFromGraveyard: null,
    pendingPutLandFromHand: null,
    pendingMayPutTopLandOntoBattlefieldTapped: null,
    pendingPutCreatureAndOrLandFromHand: null,
    pendingRevealLandTypeFromHand: null,
    pendingCastFromGraveyardAnyMana: null,
    pendingMillThenPutLandIntoHand: null,
    pendingReturnCreaturesFromGraveyard: null,
    pendingReturnCreatureFromGraveyardHandOrBattlefield: null,
    pendingEspersToMagiciteChoice: null,
    pendingThrowWideTheGatesChoice: null,
    pendingSnortChoice: null,
    pendingKefkaChoice: null,
    pendingRejoinTheFightChoice: null,
    pendingFandanielChoice: null,
    pendingOpponentMayHaveYouDrawElseMillAndDealDamage: null,
    pendingChooseCardFromOpponentHandToDiscard: null,
    pendingDivideDamageAmongTargets: null,
    pendingPayHalfLifeToCounterChoice: null,
    pendingSearchOpponentLibraryToExile: null,
    pendingReboundChoice: null,
    pendingLookAtTopNPutMToHandRestToBottom: null,
    monarchPlayerId: null,
    exileUntilMonarchChangesFrom: [],
    pendingOpponentChoosesExiledCard: null,
    pendingTragicArroganceChoice: null,
    pendingAttachFromGraveyardChoice: null,
    pendingMaySacrificeForDrawAndDrainChoice: null,
    pendingStragoAndRelmChoice: null,
    pendingMogMoogleWarriorDanceChoice: null,
    pendingOptionalTransform: null,
    pendingOptionalBecomeCopy: null,
    pendingLibraryPlacementChoice: null,
    pendingOptionalPayLife: null,
    pendingOptionalPayMana: null,
    pendingMayEffect: null,
    pendingCommanderZoneChoice: null,
    pendingWardPayment: null,
    pendingAttackTaxPayment: null,
    pendingCounterTransferQueue: [],
    pendingFreeCastFromHand: null,
    pendingNextCreatureSpellBonus: null,
    pendingManaIdentitySourceScry: null,
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
        // "When [this] is put into a graveyard from the battlefield,
        // return it to its owner's hand." (Eye of Nidhogg) - falling off
        // IS being put into a graveyard from the battlefield, so this
        // redirects the destination to hand instead.
        if (childDef.returnsSelfToHandOnDeath) {
          next = updatePlayer(next, p2.id, (p) => ({
            ...p,
            zones: { ...p.zones, battlefield: p.zones.battlefield.filter((c) => c.instanceId !== child.instanceId), hand: [...p.zones.hand, { ...child, attachedToInstanceId: undefined, tapped: false }] },
          }));
          next = { ...next, log: [...next.log, `${childDef.name} falls off and returns to its owner's hand.`] };
          continue;
        }
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