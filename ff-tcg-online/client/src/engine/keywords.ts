// ============================================================================
// engine/keywords.ts
//
// Combat keywords are detected by searching a card's `text` for the phrase,
// rather than a separate structured field - this avoids re-editing every
// card you've already written. Slight risk of a false positive if a card's
// prose happens to contain one of these phrases incidentally.
// ============================================================================

export type CombatKeyword = 'flying' | 'first strike' | 'double strike' | 'deathtouch' | 'trample' | 'lifelink' | 'vigilance' | 'reach' | 'menace' | 'haste';

export function hasKeyword(text: string, keyword: CombatKeyword): boolean {
  return text.toLowerCase().includes(keyword);
}