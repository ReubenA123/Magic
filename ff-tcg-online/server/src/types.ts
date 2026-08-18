// ============================================================================
// types.ts
// ============================================================================

export type CardType = 'creature' | 'instant' | 'sorcery' | 'land' | 'artifact' | 'enchantment';

export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G' | 'C';
export type ManaPool = Record<ManaColor, number>;

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
  /** Lands only: which mana this produces when tapped. 'any' means the
   * player picks a colour at tap time. A land without this field produces
   * no mana - set it explicitly on every land you add. */
  producesMana?: ManaColor | 'any';
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
  /** Damage marked this turn - cleared at cleanup. Only meaningful for
   * creatures, but present on every instance for simplicity. */
  damageMarked: number;
  /** True until this creature has been under its controller's control
   * since their most recent turn began - stops it attacking unless it has
   * haste. */
  summoningSick: boolean;
}

export type ZoneName = 'library' | 'hand' | 'battlefield' | 'graveyard' | 'exile';

export interface PlayerState {
  id: string;
  name: string;
  life: number;
  zones: Record<ZoneName, CardInstance[]>;
  ready: boolean;
  /** Floating mana available to spend, built by tapping lands. Empties at
   * every phase change. */
  manaPool: ManaPool;
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

export interface GameState {
  players: [PlayerState, PlayerState];
  activePlayerId: string;
  phase: Phase;
  turnNumber: number;
  log: string[];
  winnerId: string | null;
  declaredAttackers: string[];
  combatAssignments: CombatAssignment[];
}

export type GameAction =
  | { type: 'DRAW_CARD' }
  | { type: 'MOVE_CARD'; instanceId: string; toZone: ZoneName }
  | { type: 'SHUFFLE_LIBRARY' }
  | { type: 'TOGGLE_TAP'; instanceId: string; chosenColor?: ManaColor }
  | { type: 'CAST_CARD'; instanceId: string; chosenX?: number }
  | { type: 'ADJUST_LIFE'; playerId: string; delta: number }
  | { type: 'ADJUST_COUNTER'; instanceId: string; label: string; delta: number }
  | { type: 'FLIP_CARD'; instanceId: string }
  | { type: 'DECLARE_ATTACKERS'; instanceIds: string[] }
  | { type: 'DECLARE_BLOCKERS'; assignments: CombatAssignment[] }
  | { type: 'NEXT_PHASE' }
  | { type: 'END_TURN' }
  | { type: 'READY_TO_START' }
  | { type: 'UNDO' }
  | { type: 'CONCEDE' };

export type ActionResult = { ok: true; state: GameState } | { ok: false; error: string };