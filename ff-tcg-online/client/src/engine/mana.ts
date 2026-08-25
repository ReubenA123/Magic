// ============================================================================
// engine/mana.ts
//
// Parses costLabel strings (the shorthand you've been writing, like '2R' or
// '4BB') into something the engine can actually check and pay against.
// ============================================================================

import { ManaColor, ManaPool } from '../types';

export function emptyManaPool(): ManaPool {
  return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
}

export interface ParsedCost {
  generic: number;
  colors: Partial<Record<Exclude<ManaColor, 'C'>, number>>;
  hasX: boolean;
}

/** '-' or '' = free (used by lands). Leading digits = generic. Each
 * following letter is one pip of that colour (repeat a letter for more than
 * one pip); 'X' marks a variable cost, resolved via CAST_CARD's chosenX. */
export function parseCostLabel(costLabel: string): ParsedCost {
  const trimmed = costLabel.trim();
  if (trimmed === '-' || trimmed === '') return { generic: 0, colors: {}, hasX: false };

  const genericMatch = trimmed.match(/^\d+/);
  const generic = genericMatch ? parseInt(genericMatch[0], 10) : 0;
  const rest = trimmed.slice(genericMatch ? genericMatch[0].length : 0);

  const colors: Partial<Record<Exclude<ManaColor, 'C'>, number>> = {};
  let hasX = false;
  for (const ch of rest) {
    if (ch === 'X' || ch === 'x') {
      hasX = true;
      continue;
    }
    if (ch === 'W' || ch === 'U' || ch === 'B' || ch === 'R' || ch === 'G') {
      colors[ch] = (colors[ch] ?? 0) + 1;
    }
  }
  return { generic, colors, hasX };
}

export function canPay(pool: ManaPool, cost: ParsedCost, extraGeneric: number): boolean {
  const remaining = { ...pool };
  for (const [color, amount] of Object.entries(cost.colors)) {
    const c = color as Exclude<ManaColor, 'C'>;
    if ((remaining[c] ?? 0) < (amount ?? 0)) return false;
    remaining[c] -= amount ?? 0;
  }
  const genericNeeded = cost.generic + extraGeneric;
  const totalLeft = Object.values(remaining).reduce((a, b) => a + b, 0);
  return totalLeft >= genericNeeded;
}

/** Assumes canPay() already returned true - callers must check first. */
export function payCost(pool: ManaPool, cost: ParsedCost, extraGeneric: number): ManaPool {
  const remaining = { ...pool };
  for (const [color, amount] of Object.entries(cost.colors)) {
    const c = color as Exclude<ManaColor, 'C'>;
    remaining[c] -= amount ?? 0;
  }
  let genericNeeded = cost.generic + extraGeneric;
  const order: ManaColor[] = ['C', 'W', 'U', 'B', 'R', 'G'];
  for (const color of order) {
    if (genericNeeded <= 0) break;
    const used = Math.min(remaining[color], genericNeeded);
    remaining[color] -= used;
    genericNeeded -= used;
  }
  return remaining;
}

/** Total mana value of a cost - generic + every coloured pip, ignoring X
 * (X's value isn't fixed until cast). "Mana value 5" style checks. */
export function manaValue(cost: ParsedCost): number {
  const colourTotal = Object.values(cost.colors).reduce((a, b) => a + (b ?? 0), 0);
  return cost.generic + colourTotal;
}