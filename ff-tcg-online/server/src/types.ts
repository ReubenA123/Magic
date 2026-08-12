// ============================================================================
// types.ts
//
// This project works like a shared digital tabletop rather than a rules
// engine: it tracks WHERE cards are, whether they're tapped, what counters
// are on them, and life totals - but it never reads a card's text and
// decides what happens. You and your brother do that part yourselves, the
// same way you would across a real table. That trade-off is deliberate: it
// means every card in the game "just works" the moment you add it to
// data/cards.ts, with no scripting required, at the cost of the game not
// stopping you from doing something illegal. See README.md for the full
// reasoning.
//
// NOTE ON DUPLICATION: this file is duplicated at /client/src/types.ts.
// Keep both in sync by hand when you change shapes here.
// ============================================================================

export type CardType = 'creature' | 'instant' | 'sorcery' | 'land' | 'artifact' | 'enchantment';

/**
 * Static definition of a card - the template every copy of a card shares.
 * costLabel and text are just what gets displayed; nothing in the engine
 * parses them, so feel free to write full, accurate rules text.
 */
export interface CardDefinition {
  id: string; // also used as the image filename stem
  name: string;
  type: CardType;
  subtype?: string; //e.g. "Legendary Creature"
  costLabel: string; // e.g. "1R", "WW", "-" for lands
  power?: number; // printed power, before counters - only meaningful for creatures
  toughness?: number; // printed toughness, before counters
  text: string;
  imagePath: string;
  transformsInto?: string;
}

/** A labelled counter on a card, e.g. { label: '+1/+1', amount: 2 } or
 * { label: 'poison', amount: 1 }. Counters are entirely free-form - you and
 * your brother decide what a label means and the app just tracks the count. */
export interface Counter {
  label: string;
  amount: number;
}

/** A specific copy of a card as it exists in a running game. */
export interface CardInstance {
  instanceId: string;
  defId: string; // -> CardDefinition.id
  ownerId: string;
  tapped: boolean;
  counters: Counter[];
}

export type ZoneName = 'library' | 'hand' | 'battlefield' | 'graveyard' | 'exile';

export interface PlayerState {
  id: string;
  name: string;
  life: number;
  zones: Record<ZoneName, CardInstance[]>;
  /** Set once during the pregame step (see engine/actions.ts: READY_TO_START).
   * Once both players are ready, turn 1 begins. */
  ready: boolean;
}

/**
 * Phases are a visual reference strip only - nothing in the engine enforces
 * what you can do during which phase. Real Magic has more granular combat
 * sub-steps (declare attackers, declare blockers, etc); those are collapsed
 * into a single "combat" phase here since there's no automatic combat
 * resolution to sequence around - add them back if you want the extra detail.
 */
export type Phase = 'pregame' | 'untap' | 'upkeep' | 'draw' | 'main1' | 'combat' | 'main2' | 'end';

export interface GameState {
  players: [PlayerState, PlayerState];
  activePlayerId: string;
  phase: Phase;
  turnNumber: number; // 0 during pregame, 1 from the first real turn onward
  log: string[];
  winnerId: string | null; // only ever set by an explicit CONCEDE
}

// ----------------------------------------------------------------------------
// Client -> server intents. Every one of these is validated only for basic
// sanity (does this card exist, is it yours to move) - never for whether the
// move is "legal" under any card's rules text.
// ----------------------------------------------------------------------------
export type GameAction =
  | { type: 'DRAW_CARD' }
  | { type: 'MOVE_CARD'; instanceId: string; toZone: ZoneName }
  | { type: 'SHUFFLE_LIBRARY' }
  | { type: 'TOGGLE_TAP'; instanceId: string }
  | { type: 'ADJUST_LIFE'; playerId: string; delta: number }
  | { type: 'ADJUST_COUNTER'; instanceId: string; label: string; delta: number }
  | { type: 'FLIP_CARD'; instanceId: string }
  | { type: 'NEXT_PHASE' }
  | { type: 'END_TURN' }
  | { type: 'READY_TO_START' }
  | { type: 'UNDO' }
  | { type: 'CONCEDE' };

export type ActionResult = { ok: true; state: GameState } | { ok: false; error: string };
