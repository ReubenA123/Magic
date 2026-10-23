// ============================================================================
// engine/mana.ts
//
// Parses costLabel strings (real Magic-style symbol notation, like '{2}{R}'
// or '{4}{B}{B}') into something the engine can actually check and pay
// against.
// ============================================================================

import { CardDefinition, ManaColor, ManaPool, PlayerState } from '../types';
import { getCardDefinition } from '../data/cards';

export function emptyManaPool(): ManaPool {
  return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
}

export interface ParsedCost {
  generic: number;
  colors: Partial<Record<Exclude<ManaColor, 'C'>, number>>;
  hasX: boolean;
  /** Phyrexian mana symbols ('{B/P}', spoken "pay 1 black mana or 2 life") -
   * kept SEPARATE from `colors` since each pip can be paid either way,
   * unlike an ordinary colored pip. Only ever populated by
   * engine/actions.ts: castCard's main hand/commander-casting path (via
   * GameAction 'CAST_CARD's own phyrexianLifePayments), which folds the
   * player's chosen mana/life split into `colors` + a separate life
   * payment before this reaches canPay/payCost - every OTHER casting path
   * (flashback, overload, exile, graveyard, ninjutsu, blitz, equip, ...)
   * doesn't look at this field at all, so a Phyrexian-cost card cast
   * through one of those paths would currently treat its Phyrexian pips as
   * free (a known, narrow gap - no current card needs those paths for a
   * Phyrexian cost). */
  phyrexian?: Partial<Record<Exclude<ManaColor, 'C'>, number>>;
}

/** '-' or '' = free (used by lands and back faces with no cast cost).
 * Otherwise a sequence of brace-delimited symbols, e.g. '{2}{X}{G}{U}' -
 * order never matters (each symbol is self-contained), unlike the old plain
 * '2XGU'-style shorthand this replaced, which silently dropped a generic
 * number that didn't come first (see Altered Ego's original '2XGU'... cost,
 * which is what surfaced the bug). A numeric symbol is generic mana (summed
 * if more than one appears, though that's not expected in practice); 'X'
 * marks a variable cost, resolved via CAST_CARD's chosenX; W/U/B/R/G is one
 * pip of that colour each (repeat the symbol for more than one pip). Any
 * symbol this doesn't recognize (a kicker's non-mana cost enum like
 * 'returnLandToHand', which never goes through this parser to begin with)
 * is simply ignored rather than erroring. */
export function parseCostLabel(costLabel: string): ParsedCost {
  const trimmed = costLabel.trim();
  if (trimmed === '-' || trimmed === '') return { generic: 0, colors: {}, hasX: false };

  const symbols = [...trimmed.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);

  let generic = 0;
  let hasX = false;
  const colors: Partial<Record<Exclude<ManaColor, 'C'>, number>> = {};
  const phyrexian: Partial<Record<Exclude<ManaColor, 'C'>, number>> = {};
  for (const symbol of symbols) {
    if (/^\d+$/.test(symbol)) {
      generic += parseInt(symbol, 10);
    } else if (symbol === 'X' || symbol === 'x') {
      hasX = true;
    } else if (symbol === 'W' || symbol === 'U' || symbol === 'B' || symbol === 'R' || symbol === 'G') {
      colors[symbol] = (colors[symbol] ?? 0) + 1;
    } else {
      // "{B/P}" ("pay one black mana or 2 life") - K'rrik, Son of
      // Yawgmoth's own cast cost. See ParsedCost.phyrexian's own doc
      // comment for which casting paths actually honor this.
      const phyrexianMatch = /^([WUBRG])\/P$/i.exec(symbol);
      if (phyrexianMatch) {
        const color = phyrexianMatch[1].toUpperCase() as Exclude<ManaColor, 'C'>;
        phyrexian[color] = (phyrexian[color] ?? 0) + 1;
      }
    }
  }
  return Object.keys(phyrexian).length > 0 ? { generic, colors, hasX, phyrexian } : { generic, colors, hasX };
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
  // A Phyrexian mana symbol still counts as 1 toward mana value, same as
  // any other colored pip, regardless of how it's ultimately paid.
  const phyrexianTotal = cost.phyrexian ? Object.values(cost.phyrexian).reduce((a, b) => a + (b ?? 0), 0) : 0;
  return cost.generic + colourTotal + phyrexianTotal;
}

/** How much `def`'s GENERIC cost is reduced right now for `player`, from its
 * own dynamic cost-reduction fields (costReductionPerGraveyardPermanent -
 * Diamond Weapon; costReductionPerControlledSubtype - Travel the Overworld;
 * costReductionPerControlledType - Valkyrie Aerial Unit). Never reduces
 * coloured pips, and the caller still has to cap it at the printed cost's
 * own generic amount (Math.min(printedCost.generic, this)) - this just
 * returns the raw, uncapped total. Shared by engine/actions.ts: castCard
 * (which actually pays the reduced cost) and the client's hand-dimming,
 * auto-scroll-to-lands, and CardActionsPanel afford/display logic in
 * GameBoard.tsx/CardActionsPanel.tsx - those used to check affordability
 * against the full printed cost, so a card like Diamond Weapon could sit
 * looking unplayable (dimmed in hand, Cast button disabled) even once its
 * graveyard discount made it actually affordable. */
export function dynamicCostReduction(def: CardDefinition, player: PlayerState, opponent?: PlayerState): number {
  const graveyardPermanentCount = def.costReductionPerGraveyardPermanent
    ? player.zones.graveyard.filter((c) => {
        const d = getCardDefinition(c.defId);
        return d.type === 'creature' || d.type === 'artifact' || d.type === 'enchantment' || d.type === 'land';
      }).length
    : 0;
  const controlledSubtypeCount = def.costReductionPerControlledSubtype
    ? player.zones.battlefield.filter((c) => getCardDefinition(c.defId).subtype?.toLowerCase().includes(def.costReductionPerControlledSubtype!.subtype.toLowerCase())).length
    : 0;
  const controlledTypeCount = def.costReductionPerControlledType
    ? player.zones.battlefield.filter((c) => getCardDefinition(c.defId).type === def.costReductionPerControlledType!.type).length
    : 0;
  // "This spell costs {1} less to cast for each creature on the
  // battlefield" (Vanquish the Horde) - counts BOTH battlefields, unlike
  // controlledTypeCount above; only adds the opponent's count when
  // `opponent` is actually passed in (same optional convention as
  // opponentGraveyardDiscount below).
  const creatureOnBattlefieldCount = def.costReductionPerCreatureOnBattlefield
    ? player.zones.battlefield.filter((c) => getCardDefinition(c.defId).type === 'creature').length +
      (opponent ? opponent.zones.battlefield.filter((c) => getCardDefinition(c.defId).type === 'creature').length : 0)
    : 0;
  // "This spell costs {3} less to cast if an opponent has seven or more
  // cards in their graveyard" (Into the Story) - `opponent` is optional
  // (the two display-only client call sites that only want a ballpark
  // affordability check can omit it; the real cast-time call sites always
  // pass it), so this simply contributes 0 when omitted rather than
  // erroring.
  // "This spell costs {1} less to cast for each creature card in your
  // graveyard." (Cyan, Vengeful Samurai) - the CREATURE-only cousin of
  // graveyardPermanentCount above (which also counts artifacts/
  // enchantments/lands).
  const graveyardCreatureCount = def.costReductionPerGraveyardCreature ? player.zones.graveyard.filter((c) => getCardDefinition(c.defId).type === 'creature').length : 0;
  const opponentGraveyardDiscount =
    def.costReductionIfOpponentGraveyardAtLeast && opponent && opponent.zones.graveyard.length >= def.costReductionIfOpponentGraveyardAtLeast.minCount
      ? def.costReductionIfOpponentGraveyardAtLeast.amount
      : 0;

  // Board-wide reducers (The Water Crystal/The Wind Crystal's "[Color]
  // spells you cast cost {N} less", Serah Farron/Crystallized Serah's
  // "first legendary creature spell each turn") - unlike the self-only
  // fields above, these come from OTHER permanents the caster controls,
  // so every one of them needs checking, not just `def` itself.
  const ownCost = parseCostLabel(def.costLabel);
  let boardWideReduction = 0;
  const isLegendaryCreature = def.type === 'creature' && !!def.subtype?.toLowerCase().includes('legendary');
  for (const c of player.zones.battlefield) {
    const other = getCardDefinition(c.defId);
    if (other.reducesCastCostForColor && (ownCost.colors[other.reducesCastCostForColor.color] ?? 0) > 0) {
      boardWideReduction += other.reducesCastCostForColor.amount;
    }
    if (other.reducesCastCostForNoncreatureSpells && def.type !== 'creature') {
      boardWideReduction += other.reducesCastCostForNoncreatureSpells;
    }
    if (other.reducesCastCostForAuraOrEquipmentSpells && (def.subtype?.toLowerCase().includes('aura') || def.subtype?.toLowerCase().includes('equipment'))) {
      boardWideReduction += other.reducesCastCostForAuraOrEquipmentSpells;
    }
    if (other.reducesCastCostForFirstLegendaryCreatureSpellEachTurn && isLegendaryCreature && !player.usedFirstLegendaryCreatureSpellDiscountThisTurn) {
      boardWideReduction += other.reducesCastCostForFirstLegendaryCreatureSpellEachTurn;
    }
    if (other.reducesCastCostForSecondSpellEachTurn && (player.spellsCastThisTurn ?? 0) === 1) {
      boardWideReduction += other.reducesCastCostForSecondSpellEachTurn;
    }
    // "Creature spells you cast of the chosen type cost {1} less to cast."
    // (Herald's Horn) - reads the CHOSEN type off this specific permanent's
    // own instance (c), not def.
    if (other.reducesCastCostForOwnChosenCreatureType && def.type === 'creature' && c.chosenCreatureType && def.subtype?.toLowerCase().includes(c.chosenCreatureType.toLowerCase())) {
      boardWideReduction += 1;
    }
    // "Cleric, Rogue, Warrior, and Wizard spells you cast cost {1} less to
    // cast." (The Destined Warrior) - any of the four listed subtypes.
    if (other.reducesCastCostForSubtypes && def.subtype && other.reducesCastCostForSubtypes.some((st) => def.subtype!.toLowerCase().includes(st.toLowerCase()))) {
      boardWideReduction += 1;
    }
  }

  return (
    (def.costReductionPerGraveyardPermanent ? def.costReductionPerGraveyardPermanent * graveyardPermanentCount : 0) +
    (def.costReductionPerControlledSubtype ? def.costReductionPerControlledSubtype.amountPerUnit * controlledSubtypeCount : 0) +
    (def.costReductionPerControlledType ? def.costReductionPerControlledType.amountPerUnit * controlledTypeCount : 0) +
    (def.costReductionPerCreatureOnBattlefield ? def.costReductionPerCreatureOnBattlefield * creatureOnBattlefieldCount : 0) +
    (def.costReductionPerGraveyardCreature ? def.costReductionPerGraveyardCreature * graveyardCreatureCount : 0) +
    opponentGraveyardDiscount +
    boardWideReduction
  );
}

/** `parseCostLabel(def.costLabel)` with dynamicCostReduction already applied
 * and capped - the actual cost `player` would pay to cast `def` right now.
 * Shared convenience wrapper so call sites don't have to repeat the
 * cap-and-apply arithmetic themselves. */
export function effectiveCastCost(def: CardDefinition, player: PlayerState, opponent?: PlayerState): ParsedCost {
  const printed = parseCostLabel(def.costLabel);
  const reduction = Math.min(printed.generic, dynamicCostReduction(def, player, opponent));
  return reduction > 0 ? { ...printed, generic: printed.generic - reduction } : printed;
}