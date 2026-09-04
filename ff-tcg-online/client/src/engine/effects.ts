// ============================================================================
// engine/effects.ts (CLIENT-LOCAL COPY for VS AI / practice mode)
// ============================================================================

import { CardEffect, CardInstance, GameState } from '../types';
import { findCardAnywhere, getOpponent, getPlayer, nextInstanceId, updatePlayer } from './state';
import { getCardDefinition } from '../data/cards';

/**
 * Applies a permanent's/spell's automatic CardEffect list (onEnter/onCast).
 * `sourceInstanceId` is the instance that generated the effects - needed for
 * attachSelfToToken.
 */
export function resolveCardEffects(
  state: GameState,
  playerId: string,
  effects: CardEffect[],
  sourceInstanceId: string
): { state: GameState; logLines: string[] } {
  let next = state;
  const logLines: string[] = [];

  for (const effect of effects) {
    if (effect.type === 'createToken') {
      const tokenDef = getCardDefinition(effect.tokenId);
      const count =
        effect.count === 'perCreatureYouControl'
          ? getPlayer(next, playerId).zones.battlefield.filter((c) => getCardDefinition(c.defId).type === 'creature').length
          : effect.count ?? 1;

      const tokens: CardInstance[] = Array.from({ length: count }, () => ({
        instanceId: nextInstanceId(),
        defId: tokenDef.id,
        ownerId: playerId,
        tapped: !!effect.tapped,
        counters: [],
        damageMarked: 0,
        summoningSick: true,
      }));

      if (tokens.length > 0) {
        next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, battlefield: [...p.zones.battlefield, ...tokens] } }));
        const plural = tokens.length > 1 ? 's' : '';
        logLines.push(`${getPlayer(next, playerId).name} creates ${tokens.length} ${tokenDef.name} token${plural}.`);

        if (effect.attachSelfToToken && tokens.length === 1) {
          next = updatePlayer(next, playerId, (p) => ({
            ...p,
            zones: {
              ...p.zones,
              battlefield: p.zones.battlefield.map((c) => (c.instanceId === sourceInstanceId ? { ...c, attachedToInstanceId: tokens[0].instanceId } : c)),
            },
          }));
        }
      }
    } else if (effect.type === 'tapAndStun') {
      const opponent = getOpponent(next, playerId);
      const validTargets = opponent.zones.battlefield.filter((c) => {
        const d = getCardDefinition(c.defId);
        if (effect.targetType === 'artifactOrCreature') return d.type === 'artifact' || d.type === 'creature';
        return d.type === effect.targetType;
      });
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (validTargets.length === 0) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'revealAndDivide') {
      const player = getPlayer(next, playerId);
      const revealed = player.zones.library.slice(0, effect.count);
      next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(effect.count) } }));

      if (revealed.length === 0) {
        logLines.push(`${player.name}'s library is empty - nothing to reveal.`);
      } else if (revealed.length === 1 || effect.steps.length === 0) {
        // Too few cards to even go through the first pick - everything just
        // falls straight through to the remainder destination.
        next = updatePlayer(next, playerId, (p) => ({
          ...p,
          zones: {
            ...p.zones,
            hand: effect.remainderDestination === 'hand' ? [...p.zones.hand, ...revealed] : p.zones.hand,
            library: effect.remainderDestination === 'bottomOfLibrary' ? [...p.zones.library, ...revealed] : p.zones.library,
          },
        }));
        logLines.push(
          `${player.name} reveals ${revealed.length} card(s) - it goes straight to ${effect.remainderDestination === 'hand' ? 'hand' : 'the bottom of the library'}.`
        );
      } else {
        next = { ...next, pendingReveal: { sourceInstanceId, controllerId: playerId, revealed, stepIndex: 0, steps: effect.steps, remainderDestination: effect.remainderDestination } };
        logLines.push(`${player.name} reveals the top ${revealed.length} card(s) of their library.`);
      }
    }
  }

  return { state: next, logLines };
}
