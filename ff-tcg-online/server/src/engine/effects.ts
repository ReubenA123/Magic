// ============================================================================
// engine/effects.ts
// ============================================================================

import { CardEffect, CardInstance, GameState } from '../types';
import { findCardAnywhere, getOpponent, getPlayer, nextInstanceId, updatePlayer } from './state';
import { getCardDefinition } from '../data/cards';
import { effectivePower, effectiveToughness, moveCreaturesToGraveyard } from './combat';

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
        isToken: true,
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
    } else if (effect.type === 'chooseManaColor') {
      next = { ...next, pendingManaColorChoice: { instanceId: sourceInstanceId, controllerId: playerId } };
    } else if (effect.type === 'sacrificeCreature') {
      const opponent = getOpponent(next, playerId);
      const creatures = opponent.zones.battlefield.filter((c) => getCardDefinition(c.defId).type === 'creature');
      if (creatures.length === 0) {
        logLines.push(`${opponent.name} has no creature to sacrifice.`);
      } else if (opponent.id === 'ai') {
        // The VS AI opponent doesn't make real decisions anywhere else either
        // (see engine/state.ts: createStateFromDeck) - pick the creature with
        // the lowest current power+toughness (effectivePower/effectiveToughness
        // already fold in counters and static buffs), ties broken at random.
        let best = creatures[0];
        let bestScore = effectivePower(getCardDefinition(best.defId), best, next, opponent.id) + effectiveToughness(getCardDefinition(best.defId), best, next, opponent.id);
        let tieCount = 1;
        for (const c of creatures.slice(1)) {
          const score = effectivePower(getCardDefinition(c.defId), c, next, opponent.id) + effectiveToughness(getCardDefinition(c.defId), c, next, opponent.id);
          if (score < bestScore) {
            best = c;
            bestScore = score;
            tieCount = 1;
          } else if (score === bestScore) {
            // Reservoir sampling - keeps every tied creature an equally
            // likely pick, not just a 50/50 against whichever was found first.
            tieCount += 1;
            if (Math.random() < 1 / tieCount) best = c;
          }
        }
        const def = getCardDefinition(best.defId);
        next = moveCreaturesToGraveyard(next, [best.instanceId], 'is sacrificed');
        logLines.push(`${opponent.name} sacrifices ${def.name}.`);
      } else {
        next = { ...next, pendingSacrifice: { playerId: opponent.id, sourceInstanceId } };
      }
    } else if (effect.type === 'randomGraveyardCopy') {
      let guard = 0;
      while (true) {
        guard += 1;
        if (guard > 50) break; // safety net against a runaway all-lands graveyard

        const player = getPlayer(next, playerId);
        const permanentCards = player.zones.graveyard.filter((c) => {
          const d = getCardDefinition(c.defId);
          return d.type === 'creature' || d.type === 'artifact' || d.type === 'enchantment' || d.type === 'land';
        });
        if (permanentCards.length === 0) {
          logLines.push(`${player.name} has no permanent card in their graveyard to exile.`);
          break;
        }

        const chosen = permanentCards[Math.floor(Math.random() * permanentCards.length)];
        const chosenDef = getCardDefinition(chosen.defId);

        next = updatePlayer(next, playerId, (p) => ({
          ...p,
          zones: { ...p.zones, graveyard: p.zones.graveyard.filter((c) => c.instanceId !== chosen.instanceId), exile: [...p.zones.exile, chosen] },
        }));

        const token: CardInstance = {
          instanceId: nextInstanceId(),
          defId: chosenDef.id,
          ownerId: playerId,
          tapped: true,
          counters: [],
          damageMarked: 0,
          summoningSick: true,
          isToken: true,
        };
        next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, battlefield: [...p.zones.battlefield, token] } }));
        logLines.push(`${player.name} exiles ${chosenDef.name} at random and creates a tapped token copy of it.`);

        if (chosenDef.type === 'land') {
          const landfallResult = triggerLandfall(next, playerId);
          next = landfallResult.state;
          logLines.push(...landfallResult.logLines);
        }

        if (!effect.repeatOnLand || chosenDef.type !== 'land') break;
      }
    } else if (effect.type === 'surveil') {
      const player = getPlayer(next, playerId);
      const cards = player.zones.library.slice(0, effect.count);
      if (cards.length === 0) {
        logLines.push(`${player.name}'s library is empty - nothing to surveil.`);
      } else {
        next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(effect.count) } }));
        next = { ...next, pendingSurveil: { sourceInstanceId, controllerId: playerId, cards } };
        logLines.push(`${player.name} surveils ${cards.length}.`);
      }
    }
  }

  return { state: next, logLines };
}

/**
 * Landfall - checks every permanent playerId controls for a landfall
 * trigger and adds its counter. Call this once, right after a land enters
 * that player's battlefield (see engine/actions.ts: castCard's land branch).
 */
export function triggerLandfall(state: GameState, playerId: string): { state: GameState; logLines: string[] } {
  let next = state;
  const logLines: string[] = [];

  for (const card of getPlayer(next, playerId).zones.battlefield) {
    const def = getCardDefinition(card.defId);
    if (!def.landfall) continue;
    const { counterLabel, counterAmount } = def.landfall;
    next = updatePlayer(next, playerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.map((c) => {
          if (c.instanceId !== card.instanceId) return c;
          const hasCounter = c.counters.some((ctr) => ctr.label === counterLabel);
          const counters = hasCounter
            ? c.counters.map((ctr) => (ctr.label === counterLabel ? { ...ctr, amount: ctr.amount + counterAmount } : ctr))
            : [...c.counters, { label: counterLabel, amount: counterAmount }];
          return { ...c, counters };
        }),
      },
    }));
    logLines.push(`Landfall: ${def.name} gets a ${counterLabel} counter.`);
  }

  return { state: next, logLines };
}

/**
 * Checks every permanent playerId controls for a noncreature-cast trigger
 * and applies it. Call this once, right after playerId casts a spell that
 * isn't a creature or a land (see engine/actions.ts: castCard/castFromGraveyard).
 */
export function triggerNoncreatureCastAbilities(state: GameState, playerId: string): { state: GameState; logLines: string[] } {
  let next = state;
  const logLines: string[] = [];

  for (const card of getPlayer(next, playerId).zones.battlefield) {
    const def = getCardDefinition(card.defId);
    if (!def.noncreatureCastTrigger) continue;
    const opponent = getOpponent(next, playerId);
    const amount = def.noncreatureCastTrigger.damageEachOpponent;
    next = updatePlayer(next, opponent.id, (p) => ({ ...p, life: p.life - amount }));
    logLines.push(`${def.name} deals ${amount} damage to ${opponent.name}.`);
  }

  return { state: next, logLines };
}
