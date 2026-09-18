// ============================================================================
// engine/keywords.ts
//
// Combat keywords are detected by searching a card's `text` for the phrase,
// rather than a separate structured field - this avoids re-editing every
// card you've already written. Real risk (not just theoretical): a card
// whose text GRANTS a keyword to something else ("Demons you control have
// menace", "another target creature gains trample") still contains that
// keyword as a plain substring of its OWN text, so a naive check would
// incorrectly give the card itself that keyword permanently. See
// CardDefinition.excludeSelfKeywords, which lists keywords a card's own text
// mentions but that do NOT apply to the card itself (because the sentence
// is granting them to something else) - hasKeyword takes the whole
// CardDefinition (not just its .text) specifically so it can consult this.
// ============================================================================

import { CardDefinition, CardInstance } from '../types';

export type CombatKeyword = 'flying' | 'first strike' | 'double strike' | 'deathtouch' | 'trample' | 'lifelink' | 'vigilance' | 'reach' | 'menace' | 'haste' | 'flash' | 'defender' | 'hexproof' | 'indestructible' | 'unblockable';
export function hasKeyword(def: CardDefinition, keyword: CombatKeyword): boolean {
  if (def.excludeSelfKeywords?.includes(keyword)) return false;
  return def.text.toLowerCase().includes(keyword);
}

/** Like hasKeyword, but also true if `keyword` was granted temporarily via
 * CardInstance.temporaryKeywords (e.g. Blitzball Shot granting trample, or
 * Cecil, Redeemed Paladin's Protect granting indestructible to other
 * attackers) - use this instead of hasKeyword wherever a temporary grant
 * should count too. */
export function hasKeywordEffective(def: CardDefinition, instance: CardInstance, keyword: CombatKeyword): boolean {
  return hasKeyword(def, keyword) || !!instance.temporaryKeywords?.includes(keyword);
}