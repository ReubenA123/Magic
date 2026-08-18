// ============================================================================
// utils/colourIdentity.ts
//
// Commander's "colour identity" rule: a card's identity is every colour that
// appears anywhere on it - its cost AND any colour symbols mentioned in its
// rules text. A deck can only contain cards whose identity is a subset of
// its commander's.
//
// Transformed (back-face) cards are treated as colourless in their own
// right - their real identity is inherited from whichever front face flips
// into them, matching how double-faced cards work in real Commander rules.
// ============================================================================

import { CardDefinition } from '../types';
import { CARD_POOL } from '../data/cards';
import { isTransformBackFace } from './commander';

export type ManaLetter = 'W' | 'U' | 'B' | 'R' | 'G';

const ALL_COLOURS: ManaLetter[] = ['W', 'U', 'B', 'R', 'G'];

function getColoursFromCost(costLabel: string): ManaLetter[] {
  return ALL_COLOURS.filter((c) => costLabel.includes(c));
}

function getColoursFromText(text: string): ManaLetter[] {
  return ALL_COLOURS.filter((c) => new RegExp(`\\b${c}\\b`).test(text));
}

function getOwnColours(def: CardDefinition): ManaLetter[] {
  const fromCost = getColoursFromCost(def.costLabel);
  const fromText = getColoursFromText(def.text);
  return Array.from(new Set([...fromCost, ...fromText]));
}

export function getColourIdentity(def: CardDefinition): ManaLetter[] {
  if (isTransformBackFace(def.id)) {
    const frontFace = CARD_POOL.find((c) => c.transformsInto === def.id);
    return frontFace ? getOwnColours(frontFace) : [];
  }
  return getOwnColours(def);
}

export function isWithinColourIdentity(def: CardDefinition, allowedColours: ManaLetter[]): boolean {
  return getColourIdentity(def).every((c) => allowedColours.includes(c));
}