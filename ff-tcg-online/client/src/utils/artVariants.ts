// ============================================================================
// utils/artVariants.ts
//
// Some cards (so far just Cid, Timeless Artificer) exist as several
// CARD_POOL entries sharing one name but each with its own id/imagePath -
// one per alternate art. This groups a card list by name so the Library and
// Deck Builder pages can show one "stacked" tile per name instead of one
// tile per art, with a modal to pick a specific art/printing.
// ============================================================================

import { CardDefinition } from '../types';

/**
 * Groups cards by name, preserving the order each name first appears in.
 * Most groups will have exactly one card - only names with real alternate
 * art/printings in CARD_POOL come back with more than one.
 */
export function groupByArtVariants(cards: CardDefinition[]): CardDefinition[][] {
  const order: string[] = [];
  const byName = new Map<string, CardDefinition[]>();
  for (const c of cards) {
    if (!byName.has(c.name)) {
      byName.set(c.name, []);
      order.push(c.name);
    }
    byName.get(c.name)!.push(c);
  }
  return order.map((name) => byName.get(name)!);
}
