// ============================================================================
// utils/commander.ts
//
// Legality checks for Commander-mode deck building. Nothing here is
// enforced by the game engine itself (same philosophy as everywhere else in
// this app) - it just drives what the Deck Builder page lets you pick, so
// you don't accidentally build an illegal deck by mistake.
// ============================================================================

import { CardDefinition } from '../types';
import { CARD_POOL, getCardDefinition } from '../data/cards';

/** True if some other card in the pool transforms into this one - i.e. this
 * card is a "back face" and was never meant to be chosen or added on its
 * own. Exported so the library page and colour identity logic can reuse it. */
export function isTransformBackFace(defId: string): boolean {
  return CARD_POOL.some((c) => c.transformsInto === defId);
}

/**
 * A legal commander must be a legendary creature (subtype text contains
 * "Legendary Creature"), and can't itself be a transform back face - the
 * FRONT face of a transforming card is still eligible, since that's the
 * card you'd actually start with in the command zone.
 */
export function isLegalCommander(def: CardDefinition): boolean {
  if (def.type !== 'creature') return false;
  if (!def.subtype?.toLowerCase().includes('legendary creature')) return false;
  if (isTransformBackFace(def.id)) return false;
  return true;
}

/** Cards whose name is exempt from the singleton rule - their whole gimmick
 * is running several copies. Add more names here if similar cards come up. */
const UNLIMITED_NAME_EXCEPTIONS = ['Cid, Timeless Artificer'];

/**
 * Singleton rule, checked by NAME (not id) - two card objects sharing a
 * name still count as "the same card." Back faces are never addable at all
 * - they only ever enter play by flipping an existing battlefield card, not
 * by being drawn or cast on their own.
 */
export function canAddCopy(def: CardDefinition, currentCardIds: string[]): boolean {
  if (isTransformBackFace(def.id)) return false;
  if (def.type === 'land') return true;
  if (UNLIMITED_NAME_EXCEPTIONS.includes(def.name)) return true;
  const existingNames = currentCardIds.map((id) => getCardDefinition(id).name);
  return !existingNames.includes(def.name);
}