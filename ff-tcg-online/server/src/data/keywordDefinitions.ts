// ============================================================================
// data/keywordDefinitions.ts
//
// Short, original reference definitions for the keywords the engine
// actually understands (see engine/keywords.ts) - a data source for a
// future hover-tooltip feature, not wired into the UI yet. Add a new entry
// here whenever a new keyword is taught to the engine.
// ============================================================================

export const KEYWORD_DEFINITIONS: Record<string, string> = {
  flying: 'Can only be blocked by creatures with flying or reach.',
  'first strike': 'Deals its combat damage before creatures without first or double strike.',
  'double strike': 'Deals combat damage in both the first-strike and regular damage steps.',
  deathtouch: 'Any damage it deals to a creature is enough to destroy it.',
  trample: 'Excess damage beyond lethal on its blockers carries over to the defending player.',
  lifelink: 'Its controller gains life equal to any damage it deals.',
  vigilance: "Doesn't tap when attacking.",
  reach: 'Can block creatures with flying.',
  menace: 'Must be blocked by two or more creatures, or not at all.',
  haste: 'Can attack or use tap abilities immediately, ignoring summoning sickness.',
  flash: 'Can be cast any time an instant could be cast.',
  defender: "Can't attack.",
  hexproof: "Can't be targeted by an opponent's spells or abilities.",
  indestructible: "Can't be destroyed by damage or destroy effects.",
};