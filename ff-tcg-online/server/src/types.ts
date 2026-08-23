// ============================================================================
// types.ts
// ============================================================================

export type CardType = 'creature' | 'instant' | 'sorcery' | 'land' | 'artifact' | 'enchantment';

export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G' | 'C';
export type ManaPool = Record<ManaColor, number>;

export interface CardAbility {
  id: string;
  label: string;
  cost: {
    tap?: boolean;
    sacrificeSelf?: boolean;
    discardCards?: number;
    manaLabel?: string;
  };
  effectText: string;
}

export interface CardDefinition {
  id: string;
  name: string;
  type: CardType;
  subtype?: string;
  costLabel: string;
  power?: number;
  toughness?: number;
  text: string;
  imagePath: string;
  transformsInto?: string;
  producesMana?: ManaColor | 'any' | ManaColor[];
  abilities?: CardAbility[];
}

export interface Counter {
  label: string;
  amount: number;
}

export interface CardInstance {
  instanceId: string;
  defId: string;
  ownerId: string;
  tapped: boolean;
  counters: Counter[];
  damageMarked: number;
  summoningSick: boolean;
}

export type ZoneName = 'library' | 'hand' | 'battlefield' | 'graveyard' | 'exile' | 'commander';

export interface PlayerState {
  id: string;
  name: string;
  life: number;
  zones: Record<ZoneName, CardInstance[]>;
  ready: boolean;
  manaPool: ManaPool;
  hasPlayedLandThisTurn: boolean;
  /** Which CardDefinition id is this player's actual commander, if known.
   * Set at game creation for VS AI (from the chosen deck). Networked
   * Versus play doesn't have deck selection wired up yet, so this stays
   * undefined there for now - see CardActionsPanel for where this gates
   * the "move to commander zone" option. */
  hasDrawnThisTurn: boolean;
  commanderDefId?: string;
  commanderDamageTaken: number;
}

export type Phase =
  | 'pregame'
  | 'untap'
  | 'upkeep'
  | 'draw'
  | 'main1'
  | 'combat_begin'
  | 'declare_attackers'
  | 'declare_blockers'
  | 'combat_damage'
  | 'combat_end'
  | 'main2'
  | 'end'
  | 'cleanup';

export interface CombatAssignment {
  attackerInstanceId: string;
  blockerInstanceIds: string[];
}

/**
 * Mutual Adjustment: a sandbox/correction mode both players must agree to
 * enter (and agree to exit). While active, the usual rules - mana cost,
 * one land per turn, no manual life changes - are all bypassed, so you two
 * can fix a mistake or set up a test scenario together. See
 * engine/actions.ts for exactly which checks this turns off.
 */
export interface MutualAdjustmentState {
  status: 'inactive' | 'requested' | 'active' | 'exit_requested';
  requestedBy?: string;
  agreedBy: string[];
}

export interface GameState {
  players: [PlayerState, PlayerState];
  activePlayerId: string;
  phase: Phase;
  turnNumber: number;
  log: string[];
  winnerId: string | null;
  declaredAttackers: string[];
  combatAssignments: CombatAssignment[];
  mutualAdjustment: MutualAdjustmentState;
}

export type GameAction =
  | { type: 'DRAW_CARD' }
  | { type: 'MOVE_CARD'; instanceId: string; toZone: ZoneName }
  | { type: 'SHUFFLE_LIBRARY' }
  | { type: 'TOGGLE_TAP'; instanceId: string; chosenColor?: ManaColor }
  | { type: 'CAST_CARD'; instanceId: string; chosenX?: number }
  | { type: 'ACTIVATE_ABILITY'; instanceId: string; abilityId: string }
  | { type: 'ADJUST_LIFE'; playerId: string; delta: number }
  | { type: 'ADJUST_COUNTER'; instanceId: string; label: string; delta: number }
  | { type: 'FLIP_CARD'; instanceId: string }
  | { type: 'DECLARE_ATTACKERS'; instanceIds: string[] }
  | { type: 'DECLARE_BLOCKERS'; assignments: CombatAssignment[] }
  | { type: 'NEXT_PHASE' }
  | { type: 'END_TURN' }
  | { type: 'READY_TO_START' }
  | { type: 'REQUEST_MUTUAL_ADJUSTMENT' }
  | { type: 'RESPOND_MUTUAL_ADJUSTMENT'; accept: boolean }
  | { type: 'REQUEST_EXIT_MUTUAL_ADJUSTMENT' }
  | { type: 'RESPOND_EXIT_MUTUAL_ADJUSTMENT'; accept: boolean }
  | { type: 'UNDO' }
  | { type: 'CONCEDE' };

export type ActionResult = { ok: true; state: GameState } | { ok: false; error: string };