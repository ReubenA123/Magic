// ============================================================================
// engine/keywords.ts
//
// Combat keywords are detected by searching a card's `text` for the phrase,
// rather than a separate structured field - this avoids re-editing every
// card you've already written. Slight risk of a false positive if a card's
// prose happens to contain one of these phrases incidentally.
// ============================================================================

import { CardDefinition, CardInstance } from '../types';

export type CombatKeyword = 'flying' | 'first strike' | 'double strike' | 'deathtouch' | 'trample' | 'lifelink' | 'vigilance' | 'reach' | 'menace' | 'haste' | 'flash' | 'defender' | 'hexproof' | 'indestructible' | 'unblockable';
export function hasKeyword(text: string, keyword: CombatKeyword): boolean {
  return text.toLowerCase().includes(keyword);
}

/** Like hasKeyword, but also true if `keyword` was granted temporarily via
 * CardInstance.temporaryKeywords (e.g. Blitzball Shot granting trample, or
 * Cecil, Redeemed Paladin's Protect granting indestructible to other
 * attackers) - use this instead of hasKeyword wherever a temporary grant
 * should count too. */
export function hasKeywordEffective(def: CardDefinition, instance: CardInstance, keyword: CombatKeyword): boolean {
  return hasKeyword(def.text, keyword) || !!instance.temporaryKeywords?.includes(keyword);
}