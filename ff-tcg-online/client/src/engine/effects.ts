// ============================================================================
// engine/effects.ts (CLIENT-LOCAL COPY for VS AI / practice mode)
// ============================================================================

import { CardDefinition, CardEffect, CardInstance, GameState } from '../types';
import { findCardAnywhere, getOpponent, getPlayer, nextInstanceId, shuffle, updatePlayer, detachEverythingFrom } from './state';
import { getCardDefinition } from '../data/cards';
import { effectivePower, effectiveToughness, moveCreaturesToGraveyard, applyGainLifeTriggers, addLife, loseLife, damageMultiplierFor } from './combat';
import { hasKeyword } from './keywords';
import { parseCostLabel, manaValue } from './mana';

export type SacrificeFilter = 'creature' | 'creatureToken' | 'nontokenCreature' | 'enchantment' | 'anyPermanent';

/** Whether `instance` is a legal sacrifice for `filter` - shared by
 * resolveSacrificeQueue (below) and engine/actions.ts: chooseSacrifice. */
export function matchesSacrificeFilter(def: CardDefinition, instance: CardInstance, filter: SacrificeFilter): boolean {
  if (filter === 'creature') return def.type === 'creature';
  if (filter === 'creatureToken') return def.type === 'creature' && !!instance.isToken;
  if (filter === 'nontokenCreature') return def.type === 'creature' && !instance.isToken;
  if (filter === 'anyPermanent') return def.type !== 'instant' && def.type !== 'sorcery';
  return def.type === 'enchantment';
}

export function sacrificeFilterLabel(filter: SacrificeFilter): string {
  if (filter === 'creature') return 'creature';
  if (filter === 'creatureToken') return 'creature token';
  if (filter === 'nontokenCreature') return 'nontoken creature';
  if (filter === 'anyPermanent') return 'permanent';
  return 'enchantment';
}

/**
 * Resolves a "player(s) sacrifice a [filter] of their choice" queue
 * (SacrificeCreatureEffect, EachPlayerSacrificesEffect) one player at a
 * time: a player with nothing eligible is skipped silently, the VS AI
 * opponent auto-picks (same lowest-stats-first heuristic as before, which
 * degrades gracefully to a uniform random pick for non-creature filters
 * since effectivePower/effectiveToughness just read 0 for those), and the
 * first human player found pauses the whole queue in GameState.pendingSacrifice
 * - continued by engine/actions.ts: chooseSacrifice, which calls back into
 * this same function with the rest of the queue once they've chosen.
 */
export function resolveSacrificeQueue(state: GameState, sourceInstanceId: string, remainingPlayerIds: string[], filter: SacrificeFilter): { state: GameState; logLines: string[] } {
  let next = state;
  const logLines: string[] = [];
  let queue = remainingPlayerIds;

  while (queue.length > 0) {
    const [currentId, ...rest] = queue;
    const current = getPlayer(next, currentId);
    const eligible = current.zones.battlefield.filter((c) => matchesSacrificeFilter(getCardDefinition(c.defId), c, filter));

    if (eligible.length === 0) {
      logLines.push(`${current.name} has no ${sacrificeFilterLabel(filter)} to sacrifice.`);
      queue = rest;
      continue;
    }

    if (currentId === 'ai') {
      // The VS AI opponent doesn't make real decisions anywhere else either
      // (see engine/state.ts: createStateFromDeck) - pick the lowest current
      // power+toughness, ties broken at random via reservoir sampling.
      let best = eligible[0];
      let bestScore = effectivePower(getCardDefinition(best.defId), best, next, currentId) + effectiveToughness(getCardDefinition(best.defId), best, next, currentId);
      let tieCount = 1;
      for (const c of eligible.slice(1)) {
        const score = effectivePower(getCardDefinition(c.defId), c, next, currentId) + effectiveToughness(getCardDefinition(c.defId), c, next, currentId);
        if (score < bestScore) {
          best = c;
          bestScore = score;
          tieCount = 1;
        } else if (score === bestScore) {
          tieCount += 1;
          if (Math.random() < 1 / tieCount) best = c;
        }
      }
      const def = getCardDefinition(best.defId);
      const sacResult = moveCreaturesToGraveyardAndTrigger(next, [best.instanceId], 'is sacrificed');
      next = sacResult.state;
      logLines.push(`${current.name} sacrifices ${def.name}.`, ...sacResult.logLines);
      queue = rest;
      continue;
    }

    next = { ...next, pendingSacrifice: { sourceInstanceId, remainingPlayerIds: queue, filter } };
    return { state: next, logLines };
  }

  next = { ...next, pendingSacrifice: null };
  return { state: next, logLines };
}

/** Resolves CardDefinition.onDeath for any of `candidateInstanceIds` that
 * actually reached a graveyard or command zone (i.e. really died, as
 * opposed to being redirected to exile by a replacement effect like
 * onDeathExileAndCreateTokens) - checked by zone lookup AFTER the death
 * pipeline has already run, rather than inside engine/combat.ts:
 * moveCreaturesToGraveyard itself, since that module can't import this one
 * (effects.ts already imports FROM combat.ts, and the client build's ESM
 * bundler has no CommonJS require() to break the cycle with lazily). */
export function resolveOnDeathTriggers(state: GameState, candidateInstanceIds: string[]): { state: GameState; logLines: string[] } {
  let next = state;
  const logLines: string[] = [];
  for (const id of candidateInstanceIds) {
    const found = findCardAnywhere(next, id);
    if (!found || (found.zone !== 'graveyard' && found.zone !== 'commander')) continue;
    const def = getCardDefinition(found.card.defId);
    if (!def.onDeath || def.onDeath.length === 0) continue;
    const resolved = resolveCardEffects(next, found.ownerPlayerId, def.onDeath, id);
    next = resolved.state;
    logLines.push(...resolved.logLines);
  }
  return { state: next, logLines };
}

/** Combines engine/combat.ts: moveCreaturesToGraveyard with
 * resolveOnDeathTriggers - the usual way to kill something outside of
 * combat.ts itself (which has its own internal calls that get their
 * triggers fired by their OWN callers instead - see engine/actions.ts's
 * resolveFight/resolvePendingDeaths call sites). */
export function moveCreaturesToGraveyardAndTrigger(state: GameState, deadIds: string[], verb: string = 'is destroyed'): { state: GameState; logLines: string[] } {
  const next = moveCreaturesToGraveyard(state, deadIds, verb);
  return resolveOnDeathTriggers(next, deadIds);
}

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
        sacrificesOnTap: !!tokenDef.sacrificesOnTap,
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
      const result = resolveSacrificeQueue(next, sourceInstanceId, Array(effect.count ?? 1).fill(opponent.id), effect.filter ?? 'creature');
      next = result.state;
      logLines.push(...result.logLines);
    } else if (effect.type === 'eachPlayerSacrifices') {
      const result = resolveSacrificeQueue(
        next,
        sourceInstanceId,
        next.players.map((p) => p.id),
        effect.filter
      );
      next = result.state;
      logLines.push(...result.logLines);
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
    } else if (effect.type === 'millThenReturn') {
      const player = getPlayer(next, playerId);
      const milled = player.zones.library.slice(0, effect.millCount);
      next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(effect.millCount), graveyard: [...p.zones.graveyard, ...milled] } }));
      logLines.push(`${player.name} mills ${milled.length} card(s).`);

      const eligible = getPlayer(next, playerId).zones.graveyard.filter((c) => {
        const d = getCardDefinition(c.defId);
        return d.type === 'creature' || d.type === 'artifact' || d.type === 'enchantment' || d.type === 'land';
      });
      if (eligible.length === 0) {
        logLines.push(`${player.name} has no permanent card in their graveyard to return.`);
      } else {
        next = { ...next, pendingReturnFromGraveyard: { sourceInstanceId, controllerId: playerId } };
      }
    } else if (effect.type === 'loot') {
      const player = getPlayer(next, playerId);
      const drawn = player.zones.library.slice(0, effect.drawCount);
      next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(effect.drawCount), hand: [...p.zones.hand, ...drawn] } }));
      logLines.push(`${player.name} draws ${drawn.length} card(s).`);

      const handAfterDraw = getPlayer(next, playerId).zones.hand;
      if (effect.discardCount > 0 && handAfterDraw.length > 0) {
        next = { ...next, pendingDiscard: { sourceInstanceId, controllerId: playerId, count: Math.min(effect.discardCount, handAfterDraw.length) } };
      }
    } else if (effect.type === 'gainLife') {
      next = addLife(next, playerId, effect.amount);
      next = applyGainLifeTriggers(next, playerId);
      logLines.push(`${getPlayer(next, playerId).name} gains ${effect.amount} life.`);
    } else if (effect.type === 'surveil') {
      const player = getPlayer(next, playerId);
      const cards = player.zones.library.slice(0, effect.count);
      if (cards.length === 0) {
        logLines.push(`${player.name}'s library is empty - nothing to surveil.`);
        // "Then draw a card" (Dreams of Laguna) still happens even with
        // nothing to surveil - there's no pendingSurveil step to fold it
        // into here, so it runs immediately instead.
        if (effect.thenDrawCount) {
          const drawn = player.zones.library.slice(0, effect.thenDrawCount);
          next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, hand: [...p.zones.hand, ...drawn] } }));
          logLines.push(`${player.name} draws ${drawn.length} card(s).`);
        }
      } else {
        next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(effect.count) } }));
        next = { ...next, pendingSurveil: { sourceInstanceId, controllerId: playerId, cards, thenDrawCount: effect.thenDrawCount } };
        logLines.push(`${player.name} surveils ${cards.length}.`);
      }
    } else if (effect.type === 'destroyTarget') {
      const hasLegalTarget = [...next.players[0].zones.battlefield, ...next.players[1].zones.battlefield].some((c) => {
        const d = getCardDefinition(c.defId);
        const isFlyingCreature = d.type === 'creature' && hasKeyword(d.text, 'flying');
        return (
          effect.targetFilter === 'anyPermanent' ||
          (effect.targetFilter === 'artifactEnchantmentOrFlyingCreature' && (d.type === 'artifact' || d.type === 'enchantment' || isFlyingCreature)) ||
          (effect.targetFilter === 'artifactOrEnchantment' && (d.type === 'artifact' || d.type === 'enchantment'))
        );
      });
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'bounceTarget') {
      const hasLegalTarget = [...next.players[0].zones.battlefield, ...next.players[1].zones.battlefield].some((c) => getCardDefinition(c.defId).type !== 'land');
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'optionalBounce') {
      const player = getPlayer(next, playerId);
      const hasOtherPermanent = player.zones.battlefield.some((c) => c.instanceId !== sourceInstanceId);
      if (!hasOtherPermanent) {
        logLines.push(`${player.name} has no other permanent to return to hand.`);
      } else {
        next = { ...next, pendingOptionalBounce: { sourceInstanceId, controllerId: playerId } };
      }
    } else if (effect.type === 'pumpAttackers') {
      for (const id of next.declaredAttackers) {
        next = applyTemporaryBuff(next, id, effect.power, effect.toughness);
      }
      logLines.push(`Attacking creatures get +${effect.power}/+${effect.toughness} until end of turn.`);
    } else if (effect.type === 'revealFiltered') {
      const player = getPlayer(next, playerId);
      const revealed = player.zones.library.slice(0, effect.count);
      next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(effect.count) } }));
      if (revealed.length === 0) {
        logLines.push(`${player.name}'s library is empty - nothing to reveal.`);
      } else {
        next = { ...next, pendingRevealFiltered: { sourceInstanceId, controllerId: playerId, revealed, filterType: effect.filterType } };
        logLines.push(`${player.name} reveals the top ${revealed.length} card(s) of their library.`);
      }
    } else if (effect.type === 'damageEqualToEquippedCreatures') {
      const player = getPlayer(next, playerId);
      // Equipment isn't tracked via a dedicated boolean field anywhere in this
      // engine - every Equipment card's subtype text contains "Equipment"
      // (case varies - some are 'Equipment', some 'equipment'), so that's the
      // signal used here rather than equipCost (which no Equipment card in
      // the data actually has populated - it's free text only today).
      const isEquipment = (d: ReturnType<typeof getCardDefinition>) => d.type === 'artifact' && !!d.subtype?.toLowerCase().includes('equipment');
      const equippedCount = player.zones.battlefield.filter((c) => {
        const d = getCardDefinition(c.defId);
        return d.type === 'creature' && player.zones.battlefield.some((other) => other.attachedToInstanceId === c.instanceId && isEquipment(getCardDefinition(other.defId)));
      }).length;
      if (equippedCount > 0) {
        const opponent = getOpponent(next, playerId);
        next = updatePlayer(next, opponent.id, (p) => ({ ...p, life: p.life - equippedCount }));
        logLines.push(`${getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name} deals ${equippedCount} damage to ${opponent.name} (equipped creatures).`);
      }
    } else if (effect.type === 'searchLibraryForLand') {
      const player = getPlayer(next, playerId);
      const foundIndex = player.zones.library.findIndex((c) => getCardDefinition(c.defId).name === effect.landName);
      if (foundIndex === -1) {
        next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: shuffle(p.zones.library) } }));
        logLines.push(`${player.name} searches for a ${effect.landName} but finds none - shuffles the library.`);
      } else {
        const foundCard = player.zones.library[foundIndex];
        const rest = player.zones.library.filter((_, i) => i !== foundIndex);
        next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: shuffle(rest), hand: [...p.zones.hand, foundCard] } }));
        logLines.push(`${player.name} searches their library for ${effect.landName}, puts it into hand, then shuffles.`);
      }
    } else if (effect.type === 'pumpTarget') {
      const hasLegalTarget = [...next.players[0].zones.battlefield, ...next.players[1].zones.battlefield].some((c) => getCardDefinition(c.defId).type === 'creature');
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'grantKeywordToOtherAttackers') {
      for (const id of next.declaredAttackers) {
        if (id === sourceInstanceId) continue;
        next = grantTemporaryKeyword(next, id, effect.keyword);
      }
      logLines.push(`Other attacking creatures gain ${effect.keyword} until end of turn.`);
    } else if (effect.type === 'loseLife') {
      next = updatePlayer(next, playerId, (p) => ({ ...p, life: p.life - effect.amount }));
      logLines.push(`${getPlayer(next, playerId).name} loses ${effect.amount} life.`);
    } else if (effect.type === 'pumpControlledSubtype') {
      const player = getPlayer(next, playerId);
      const matching = player.zones.battlefield.filter((c) => {
        const d = getCardDefinition(c.defId);
        return d.type === 'creature' && !!d.subtype?.toLowerCase().includes(effect.subtype.toLowerCase());
      });
      for (const c of matching) {
        next = applyTemporaryBuff(next, c.instanceId, effect.power, effect.toughness);
        if (effect.grantKeyword) next = grantTemporaryKeyword(next, c.instanceId, effect.grantKeyword);
      }
      if (matching.length > 0) {
        const keywordNote = effect.grantKeyword ? ` and gain ${effect.grantKeyword}` : '';
        logLines.push(`${effect.subtype}s you control get +${effect.power}/+${effect.toughness}${keywordNote} until end of turn.`);
      }
    } else if (effect.type === 'putCounterOnTarget') {
      const hasLegalTarget = [...next.players[0].zones.battlefield, ...next.players[1].zones.battlefield].some((c) => getCardDefinition(c.defId).type === 'creature');
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'debuffTargetByGraveyard') {
      const opponent = getOpponent(next, playerId);
      const hasLegalTarget = opponent.zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'creature');
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'selfFightTarget') {
      const hasLegalTarget = [...next.players[0].zones.battlefield, ...next.players[1].zones.battlefield].some(
        (c) => c.instanceId !== sourceInstanceId && getCardDefinition(c.defId).type === 'creature'
      );
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'chooseCreaturesFight') {
      const player = getPlayer(next, playerId);
      const opponent = getOpponent(next, playerId);
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      const hasLegalTargets =
        player.zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'creature') &&
        opponent.zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'creature');
      if (!hasLegalTargets) {
        logLines.push(`${sourceName}'s ability has no legal targets.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'modifySagaLoreCounter') {
      const player = getPlayer(next, playerId);
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      const hasLegalTarget = player.zones.battlefield.some((c) => !!getCardDefinition(c.defId).saga);
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'discardHandThenDrawByDevotion') {
      next = { ...next, pendingOptionalDiscardHandForDevotion: { sourceInstanceId, controllerId: playerId, color: effect.color } };
    } else if (effect.type === 'addMana') {
      next = updatePlayer(next, playerId, (p) => {
        const manaPool = { ...p.manaPool };
        for (const [color, amount] of Object.entries(effect.colors)) {
          manaPool[color as keyof typeof manaPool] += amount ?? 0;
        }
        return { ...p, manaPool };
      });
      const colorNote = Object.entries(effect.colors)
        .map(([color, amount]) => `${amount}${color}`)
        .join('');
      logLines.push(`${getPlayer(next, playerId).name} adds ${colorNote}.`);
    } else if (effect.type === 'exileAndReturnTransformedSelfIfLoreAtLeast') {
      const source = findCardAnywhere(next, sourceInstanceId);
      const currentLore = source?.card.counters.find((c) => c.label === 'lore')?.amount ?? 0;
      if (currentLore >= effect.minLore) {
        const transformed = exileAndReturnTransformed(next, playerId, sourceInstanceId);
        next = transformed.state;
        logLines.push(...transformed.logLines);
      }
    } else if (effect.type === 'exileAndReturnTransformedSelf') {
      const transformed = exileAndReturnTransformed(next, playerId, sourceInstanceId);
      next = transformed.state;
      logLines.push(...transformed.logLines);
    } else if (effect.type === 'tapTarget') {
      const hasLegalTarget = [...next.players[0].zones.battlefield, ...next.players[1].zones.battlefield].some((c) => getCardDefinition(c.defId).type === 'creature');
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'chooseOneMode') {
      next = { ...next, pendingChooseOneMode: { sourceInstanceId, controllerId: playerId, modes: effect.modes } };
    } else if (effect.type === 'drawCardsFromTargetPlayer') {
      next = { ...next, pendingPlayerTarget: { sourceInstanceId, controllerId: playerId, effect } };
    } else if (effect.type === 'putCounterOnUpToOneOwnCreature') {
      const hasLegalTarget = getPlayer(next, playerId).zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'creature');
      if (hasLegalTarget) {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'attachSelfToTarget') {
      const hasLegalTarget = getPlayer(next, playerId).zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'creature');
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName} has no legal target to attach to.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'revealTopThenLoseLifeByManaValue') {
      const player = getPlayer(next, playerId);
      const revealedCard = player.zones.library[0];
      if (!revealedCard) {
        logLines.push(`${player.name}'s library is empty - nothing to reveal.`);
      } else {
        const revealedDef = getCardDefinition(revealedCard.defId);
        const mv = manaValue(parseCostLabel(revealedDef.costLabel));
        next = updatePlayer(next, playerId, (p) => ({
          ...p,
          life: p.life - mv,
          zones: { ...p.zones, library: p.zones.library.slice(1), hand: [...p.zones.hand, revealedCard] },
        }));
        logLines.push(`${player.name} reveals ${revealedDef.name}, puts it into their hand, and loses ${mv} life.`);
      }
    } else if (effect.type === 'destroyOpponentCreature') {
      const opponent = getOpponent(next, playerId);
      const hasLegalTarget = opponent.zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'creature');
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'drawForCreaturesDiedThisTurn') {
      const player = getPlayer(next, playerId);
      const count = next.creaturesDiedThisTurn;
      if (count > 0) {
        const drawn = player.zones.library.slice(0, count);
        next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(count), hand: [...p.zones.hand, ...drawn] } }));
        logLines.push(`${player.name} draws ${drawn.length} card(s) (${count} creature(s) died this turn).`);
      }
    } else if (effect.type === 'putCounterOnSelf') {
      const { counterLabel, counterAmount } = effect;
      next = updatePlayer(next, playerId, (p) => ({
        ...p,
        zones: {
          ...p.zones,
          battlefield: p.zones.battlefield.map((c) => {
            if (c.instanceId !== sourceInstanceId) return c;
            const hasCounter = c.counters.some((ctr) => ctr.label === counterLabel);
            const counters = hasCounter
              ? c.counters.map((ctr) => (ctr.label === counterLabel ? { ...ctr, amount: ctr.amount + counterAmount } : ctr))
              : [...c.counters, { label: counterLabel, amount: counterAmount }];
            return { ...c, counters };
          }),
        },
      }));
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      logLines.push(`${sourceName} gets a ${counterLabel} counter.`);
    } else if (effect.type === 'buffOtherCreaturesYouControl') {
      const player = getPlayer(next, playerId);
      const others = player.zones.battlefield.filter((c) => c.instanceId !== sourceInstanceId && getCardDefinition(c.defId).type === 'creature');
      for (const c of others) {
        if (effect.counterLabel && effect.counterAmount) {
          const { counterLabel, counterAmount } = effect;
          next = updatePlayer(next, playerId, (p) => ({
            ...p,
            zones: {
              ...p.zones,
              battlefield: p.zones.battlefield.map((bc) => {
                if (bc.instanceId !== c.instanceId) return bc;
                const hasCounter = bc.counters.some((ctr) => ctr.label === counterLabel);
                const counters = hasCounter
                  ? bc.counters.map((ctr) => (ctr.label === counterLabel ? { ...ctr, amount: ctr.amount + counterAmount } : ctr))
                  : [...bc.counters, { label: counterLabel, amount: counterAmount }];
                return { ...bc, counters };
              }),
            },
          }));
        }
        if (effect.grantKeyword) next = grantTemporaryKeyword(next, c.instanceId, effect.grantKeyword);
      }
      if (others.length > 0) {
        const counterNote = effect.counterLabel && effect.counterAmount ? ` a ${effect.counterLabel} counter` : '';
        const keywordNote = effect.grantKeyword ? `${counterNote ? ' and' : ''} ${effect.grantKeyword} until end of turn` : '';
        logLines.push(`Other creatures you control each get${counterNote}${keywordNote}.`);
      }
    } else if (effect.type === 'shuffleGraveyardIntoLibrary') {
      const player = getPlayer(next, playerId);
      const toShuffle = player.zones.graveyard.filter((c) => getCardDefinition(c.defId).type !== 'land');
      if (toShuffle.length === 0) {
        logLines.push(`${player.name} has no nonland card in their graveyard to shuffle in.`);
      } else {
        const keptInGraveyard = player.zones.graveyard.filter((c) => getCardDefinition(c.defId).type === 'land');
        next = updatePlayer(next, playerId, (p) => ({
          ...p,
          zones: { ...p.zones, graveyard: keptInGraveyard, library: shuffle([...p.zones.library, ...toShuffle]) },
        }));
        next = addLife(next, playerId, toShuffle.length);
        logLines.push(`${player.name} shuffles ${toShuffle.length} card(s) from their graveyard into their library and gains ${toShuffle.length} life.`);
      }
    } else if (effect.type === 'reanimateTargetFromGraveyard') {
      const player = getPlayer(next, playerId);
      const eligible = player.zones.graveyard.filter((c) => getCardDefinition(c.defId).type === 'creature');
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (eligible.length === 0) {
        logLines.push(`${sourceName} has no legal target - ${player.name} has no creature card in their graveyard.`);
      } else {
        next = { ...next, pendingReanimate: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'drawCardsEqualToControlledTypeCount') {
      const player = getPlayer(next, playerId);
      const count = player.zones.battlefield.filter((c) => getCardDefinition(c.defId).type === effect.cardType).length;
      if (count > 0) {
        const drawn = player.zones.library.slice(0, count);
        next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(count), hand: [...p.zones.hand, ...drawn] } }));
        logLines.push(`${player.name} draws ${drawn.length} card(s) (${count} ${effect.cardType}(s) controlled).`);
      }
    } else if (effect.type === 'transformSelfIfGraveyardSizeAtLeast') {
      const found = findCardAnywhere(next, sourceInstanceId);
      const def = found ? getCardDefinition(found.card.defId) : null;
      const player = getPlayer(next, playerId);
      if (found && def?.transformsInto && player.zones.graveyard.length >= effect.minGraveyardSize) {
        const backDef = getCardDefinition(def.transformsInto);
        next = updatePlayer(next, playerId, (p) => ({
          ...p,
          zones: { ...p.zones, [found.zone]: p.zones[found.zone].map((c) => (c.instanceId === sourceInstanceId ? { ...c, defId: backDef.id } : c)) },
        }));
        logLines.push(`${def.name} transforms into ${backDef.name}.`);
      }
    } else if (effect.type === 'returnCreaturesFromGraveyardToHand') {
      const player = getPlayer(next, playerId);
      const eligible = player.zones.graveyard.filter((c) => getCardDefinition(c.defId).type === 'creature');
      if (eligible.length === 0) {
        logLines.push(`${player.name} has no creature card in their graveyard to return.`);
      } else {
        next = { ...next, pendingReturnCreaturesFromGraveyard: { sourceInstanceId, controllerId: playerId, remaining: effect.count } };
      }
    } else if (effect.type === 'putSelfOnBottomOfLibrary') {
      const found = findCardAnywhere(next, sourceInstanceId);
      if (found && found.zone === 'graveyard') {
        const def = getCardDefinition(found.card.defId);
        next = updatePlayer(next, found.ownerPlayerId, (p) => ({
          ...p,
          zones: { ...p.zones, graveyard: p.zones.graveyard.filter((c) => c.instanceId !== sourceInstanceId), library: [...p.zones.library, { ...found.card, counters: [] }] },
        }));
        logLines.push(`${def.name} is put on the bottom of its owner's library.`);
      }
    } else if (effect.type === 'eachOpponentDiscards') {
      const opponent = getOpponent(next, playerId);
      const count = Math.min(effect.count, opponent.zones.hand.length);
      if (count > 0) {
        next = { ...next, pendingDiscard: { sourceInstanceId, controllerId: opponent.id, count } };
      } else {
        logLines.push(`${opponent.name} has no cards in hand to discard.`);
      }
    } else if (effect.type === 'pumpSelfByGraveyardCount') {
      const player = getPlayer(next, playerId);
      const graveyardCount = player.zones.graveyard.filter((c) => {
        const d = getCardDefinition(c.defId);
        return d.type === 'creature' || d.type === 'artifact' || d.type === 'enchantment' || d.type === 'land';
      }).length;
      const power = effect.powerPerUnit * graveyardCount;
      const toughness = effect.toughnessPerUnit * graveyardCount;
      next = applyTemporaryBuff(next, sourceInstanceId, power, toughness);
      logLines.push(`${player.name}'s permanent gets +${power}/+${toughness} until end of turn (${graveyardCount} permanent card(s) in graveyard).`);
    } else if (effect.type === 'millOpponentByLifeGainedThisTurn') {
      const player = getPlayer(next, playerId);
      const opponent = getOpponent(next, playerId);
      const count = Math.min(player.lifeGainedThisTurn, opponent.zones.library.length);
      if (count > 0) {
        next = updatePlayer(next, opponent.id, (p) => ({
          ...p,
          zones: { ...p.zones, library: p.zones.library.slice(count), graveyard: [...p.zones.graveyard, ...p.zones.library.slice(0, count)] },
        }));
        logLines.push(`${opponent.name} mills ${count} card(s) (${player.name} gained ${player.lifeGainedThisTurn} life this turn).`);
      }
    } else if (effect.type === 'pumpSelf') {
      next = applyTemporaryBuff(next, sourceInstanceId, effect.power, effect.toughness);
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      logLines.push(`${sourceName} gets +${effect.power}/+${effect.toughness} until end of turn.`);
    } else if (effect.type === 'exileTargetGraveyardCard') {
      const hasLegalTarget = [...next.players[0].zones.graveyard, ...next.players[1].zones.graveyard].length > 0;
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingGraveyardExile: { sourceInstanceId, controllerId: playerId, createFoodTokenIfCreature: effect.createFoodTokenIfCreature } };
      }
    } else if (effect.type === 'dealDamageToEachOpponent') {
      const opponent = getOpponent(next, playerId);
      next = loseLife(next, opponent.id, effect.amount);
      logLines.push(`${opponent.name} loses ${effect.amount} life.`);
    } else if (effect.type === 'tapAllOpponentLands') {
      const opponent = getOpponent(next, playerId);
      next = updatePlayer(next, opponent.id, (p) => ({
        ...p,
        zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (getCardDefinition(c.defId).type === 'land' ? { ...c, tapped: true } : c)) },
      }));
      logLines.push(`All lands ${opponent.name} controls are tapped.`);
    } else if (effect.type === 'bounceUpToOneOtherNonlandPermanent') {
      const hasLegalTarget = [...next.players[0].zones.battlefield, ...next.players[1].zones.battlefield].some(
        (c) => getCardDefinition(c.defId).type !== 'land' && c.instanceId !== sourceInstanceId
      );
      if (hasLegalTarget) {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'putCounterOnUpToOneOtherCreatureEqualToOwnPower') {
      const hasLegalTarget = [...next.players[0].zones.battlefield, ...next.players[1].zones.battlefield].some(
        (c) => getCardDefinition(c.defId).type === 'creature' && c.instanceId !== sourceInstanceId
      );
      if (hasLegalTarget) {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'discardUpToThenDrawThatMany') {
      const player = getPlayer(next, playerId);
      if (player.zones.hand.length > 0 && effect.maxCount > 0) {
        next = { ...next, pendingDiscardUpToThenDraw: { sourceInstanceId, controllerId: playerId, maxCount: effect.maxCount, discardedSoFar: 0 } };
      }
    } else if (effect.type === 'damageTargetAndControllerByEquipmentCount') {
      const hasLegalTarget = [...next.players[0].zones.battlefield, ...next.players[1].zones.battlefield].some((c) => getCardDefinition(c.defId).type === 'creature');
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'drawCards') {
      const player = getPlayer(next, playerId);
      const drawn = player.zones.library.slice(0, effect.amount);
      next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(drawn.length), hand: [...p.zones.hand, ...drawn] } }));
      logLines.push(`${player.name} draws ${drawn.length} card(s).`);
    } else if (effect.type === 'transformSelfIfControlledSubtypeCountAtLeast') {
      const found = findCardAnywhere(next, sourceInstanceId);
      const def = found ? getCardDefinition(found.card.defId) : null;
      const player = getPlayer(next, playerId);
      const count = player.zones.battlefield.filter((c) => getCardDefinition(c.defId).subtype?.toLowerCase().includes(effect.subtype.toLowerCase())).length;
      if (found && def?.transformsInto && count >= effect.minCount) {
        const backDef = getCardDefinition(def.transformsInto);
        next = updatePlayer(next, playerId, (p) => ({
          ...p,
          zones: { ...p.zones, [found.zone]: p.zones[found.zone].map((c) => (c.instanceId === sourceInstanceId ? { ...c, defId: backDef.id } : c)) },
        }));
        logLines.push(`${def.name} transforms into ${backDef.name}.`);
      }
    }
  }

  return { state: next, logLines };
}

/** Applies (additively) a temporary power/toughness bonus that lasts until
 * end of turn - see CardInstance.temporaryBuff, cleared at the cleanup step
 * (engine/actions.ts: nextPhase). Used by PumpAttackersEffect and a
 * LandfallTrigger's temporaryBuff payout. */
export function applyTemporaryBuff(state: GameState, instanceId: string, power: number, toughness: number): GameState {
  for (const player of state.players) {
    if (!player.zones.battlefield.some((c) => c.instanceId === instanceId)) continue;
    return updatePlayer(state, player.id, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.map((c) => {
          if (c.instanceId !== instanceId) return c;
          const existing = c.temporaryBuff ?? { power: 0, toughness: 0 };
          return { ...c, temporaryBuff: { power: existing.power + power, toughness: existing.toughness + toughness } };
        }),
      },
    }));
  }
  return state;
}

/** Grants a keyword temporarily (until end of turn), additively - see
 * CardInstance.temporaryKeywords and engine/keywords.ts: hasKeywordEffective.
 * Used by PumpTargetEffect and GrantKeywordToOtherAttackersEffect. */
export function grantTemporaryKeyword(state: GameState, instanceId: string, keyword: string): GameState {
  for (const player of state.players) {
    if (!player.zones.battlefield.some((c) => c.instanceId === instanceId)) continue;
    return updatePlayer(state, player.id, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.map((c) => {
          if (c.instanceId !== instanceId) return c;
          const existing = c.temporaryKeywords ?? [];
          return existing.includes(keyword) ? c : { ...c, temporaryKeywords: [...existing, keyword] };
        }),
      },
    }));
  }
  return state;
}

/**
 * Landfall - checks every permanent playerId controls for a landfall
 * trigger and adds its counter. Call this once, right after a land enters
 * that player's battlefield (see engine/actions.ts: castCard's land branch).
 */
/** "Whenever an artifact you control enters, ..." (Golbez, Crystal
 * Collector) - see types.ts: CardDefinition.onAnyArtifactEnterTrigger.
 * Called once right after any artifact enters the battlefield (see
 * engine/actions.ts: castCard/castFromGraveyard) for every OTHER permanent
 * the controller has with this field. */
export function triggerArtifactEnterWatchers(state: GameState, playerId: string): { state: GameState; logLines: string[] } {
  let next = state;
  const logLines: string[] = [];

  for (const card of getPlayer(next, playerId).zones.battlefield) {
    const def = getCardDefinition(card.defId);
    if (!def.onAnyArtifactEnterTrigger || def.onAnyArtifactEnterTrigger.length === 0) continue;
    const resolved = resolveCardEffects(next, playerId, def.onAnyArtifactEnterTrigger, card.instanceId);
    next = resolved.state;
    logLines.push(...resolved.logLines);
  }

  return { state: next, logLines };
}

export function triggerLandfall(state: GameState, playerId: string): { state: GameState; logLines: string[] } {
  let next = state;
  const logLines: string[] = [];

  for (const card of getPlayer(next, playerId).zones.battlefield) {
    const def = getCardDefinition(card.defId);
    if (!def.landfall) continue;
    if (def.landfall.temporaryBuff) {
      const { power, toughness } = def.landfall.temporaryBuff;
      next = applyTemporaryBuff(next, card.instanceId, power, toughness);
      logLines.push(`Landfall: ${def.name} gets +${power}/+${toughness} until end of turn.`);
      continue;
    }
    if (def.landfall.createTokenId) {
      const resolved = resolveCardEffects(next, playerId, [{ type: 'createToken', tokenId: def.landfall.createTokenId }], card.instanceId);
      next = resolved.state;
      logLines.push(`Landfall: ${def.name} triggers.`, ...resolved.logLines);
      continue;
    }
    const { counterLabel, counterAmount } = def.landfall;
    if (!counterLabel || !counterAmount) continue;
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
export function triggerNoncreatureCastAbilities(state: GameState, playerId: string, manaSpent: number): { state: GameState; logLines: string[] } {
  let next = state;
  const logLines: string[] = [];

  for (const card of getPlayer(next, playerId).zones.battlefield) {
    const def = getCardDefinition(card.defId);
    const trigger = def.noncreatureCastTrigger;
    if (!trigger) continue;
    if (trigger.damageEachOpponent) {
      const opponent = getOpponent(next, playerId);
      const amount = trigger.damageEachOpponent * damageMultiplierFor(next, playerId, def);
      next = loseLife(next, opponent.id, amount);
      logLines.push(`${def.name} deals ${amount} damage to ${opponent.name}.`);
    }
    if (trigger.counterIfExpensive && manaSpent >= trigger.counterIfExpensive.minManaValue) {
      const { counterLabel, counterAmount } = trigger.counterIfExpensive;
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
      logLines.push(`${def.name} triggers, gaining a ${counterLabel} counter (${manaSpent} mana was spent).`);
    }
    if (trigger.surveilCount) {
      const resolved = resolveCardEffects(next, playerId, [{ type: 'surveil', count: trigger.surveilCount }], card.instanceId);
      next = resolved.state;
      logLines.push(...resolved.logLines);
    }
  }

  return { state: next, logLines };
}

/** "Saga" - puts a lore counter on `instanceId` (an ordinary Counter
 * labeled 'lore') and resolves any SagaChapter whose `numbers` includes the
 * new total. Called once as a Saga enters the battlefield (engine/actions.ts:
 * castCard/castFromGraveyard) and again as its controller's precombat main
 * phase begins (engine/actions.ts: nextPhase). See types.ts: SagaAbility. */
export function triggerSagaLoreCounter(state: GameState, playerId: string, instanceId: string): { state: GameState; logLines: string[] } {
  const player = getPlayer(state, playerId);
  const card = player.zones.battlefield.find((c) => c.instanceId === instanceId);
  if (!card) return { state, logLines: [] };
  const def = getCardDefinition(card.defId);
  if (!def.saga) return { state, logLines: [] };

  const existingLore = card.counters.find((c) => c.label === 'lore')?.amount ?? 0;
  const newCount = existingLore + 1;

  let next = updatePlayer(state, playerId, (p) => ({
    ...p,
    zones: {
      ...p.zones,
      battlefield: p.zones.battlefield.map((c) => {
        if (c.instanceId !== instanceId) return c;
        const hasCounter = c.counters.some((ctr) => ctr.label === 'lore');
        const counters = hasCounter
          ? c.counters.map((ctr) => (ctr.label === 'lore' ? { ...ctr, amount: newCount } : ctr))
          : [...c.counters, { label: 'lore', amount: newCount }];
        return { ...c, counters };
      }),
    },
  }));

  const logLines: string[] = [`${def.name} gets a lore counter (now ${newCount}).`];
  const matchingChapters = def.saga.chapters.filter((ch) => ch.numbers.includes(newCount));
  for (const chapter of matchingChapters) {
    const resolved = resolveCardEffects(next, playerId, chapter.effects, instanceId);
    next = resolved.state;
    logLines.push(...resolved.logLines);
  }

  const maxChapterNumber = Math.max(...def.saga.chapters.flatMap((ch) => ch.numbers));
  const stillOnBattlefield = getPlayer(next, playerId).zones.battlefield.some((c) => c.instanceId === instanceId);
  const shouldSacrifice = newCount >= maxChapterNumber && def.type !== 'creature' && def.saga.sacrificeAfterFinalChapter !== false;
  if (shouldSacrifice && stillOnBattlefield) {
    const sacResult = moveCreaturesToGraveyardAndTrigger(next, [instanceId], 'is sacrificed');
    next = sacResult.state;
    logLines.push(`${def.name}'s saga is complete - it is sacrificed.`, ...sacResult.logLines);
  }

  return { state: next, logLines };
}

/** EXILE `instanceId`, then create a brand-new permanent of its
 * transformsInto face entering the battlefield in its place (e.g. Clive,
 * Ifrit's Dominant <-> Ifrit, Warden of Inferno) - unlike a plain defId
 * swap, this is a genuine zone change: the new object is subject to
 * summoning sickness again, and its own onEnter/Saga-entry effects fire
 * fresh. Shared by engine/actions.ts: activateAbility's exileAndReturnTransformed
 * cost, and ExileAndReturnTransformedSelfIfLoreAtLeastEffect above. Does
 * NOT re-check the legend rule (a corner case left for the caller). */
export function exileAndReturnTransformed(state: GameState, playerId: string, instanceId: string): { state: GameState; logLines: string[] } {
  const player = getPlayer(state, playerId);
  const card = player.zones.battlefield.find((c) => c.instanceId === instanceId);
  if (!card) return { state, logLines: [] };
  const def = getCardDefinition(card.defId);
  if (!def.transformsInto) return { state, logLines: [] };
  const backDef = getCardDefinition(def.transformsInto);

  let next = detachEverythingFrom(state, instanceId);
  const newInstanceId = nextInstanceId();
  const hasHasteBack = hasKeyword(backDef.text, 'haste');
  const isPermanentBack = backDef.type === 'creature' || backDef.type === 'artifact' || backDef.type === 'enchantment';
  const newCard: CardInstance = {
    instanceId: newInstanceId,
    defId: backDef.id,
    ownerId: playerId,
    tapped: isPermanentBack && !!backDef.entersTapped,
    counters: [],
    damageMarked: 0,
    summoningSick: backDef.type === 'creature' ? !hasHasteBack : false,
  };
  next = updatePlayer(next, playerId, (p) => ({
    ...p,
    zones: {
      ...p.zones,
      battlefield: [...p.zones.battlefield.filter((c) => c.instanceId !== instanceId), newCard],
      exile: [...p.zones.exile, { ...card, tapped: false, attachedToInstanceId: undefined, damageMarked: 0 }],
    },
  }));

  const logLines = [`${def.name} is exiled, then returns to the battlefield transformed into ${backDef.name}.`];
  if (backDef.onEnter && backDef.onEnter.length > 0) {
    const resolved = resolveCardEffects(next, playerId, backDef.onEnter, newInstanceId);
    next = resolved.state;
    logLines.push(...resolved.logLines);
  }
  if (backDef.saga) {
    const sagaResult = triggerSagaLoreCounter(next, playerId, newInstanceId);
    next = sagaResult.state;
    logLines.push(...sagaResult.logLines);
  }
  if (backDef.grantsExtraTurnOnTransform) {
    next = { ...next, extraTurnsQueued: [...next.extraTurnsQueued, playerId] };
  }

  return { state: next, logLines };
}

/** "Return this card from your graveyard to the battlefield transformed"
 * (Garland, Knight of Cornelia) - see types.ts:
 * CardAbility.returnFromGraveyardTransformed. Like exileAndReturnTransformed,
 * but the source is already in the graveyard rather than the battlefield,
 * so it just leaves that zone entirely instead of also visiting exile. */
export function returnFromGraveyardTransformed(state: GameState, playerId: string, instanceId: string): { state: GameState; logLines: string[] } {
  const player = getPlayer(state, playerId);
  const card = player.zones.graveyard.find((c) => c.instanceId === instanceId);
  if (!card) return { state, logLines: [] };
  const def = getCardDefinition(card.defId);
  if (!def.transformsInto) return { state, logLines: [] };
  const backDef = getCardDefinition(def.transformsInto);

  const newInstanceId = nextInstanceId();
  const hasHasteBack = hasKeyword(backDef.text, 'haste');
  const newCard: CardInstance = {
    instanceId: newInstanceId,
    defId: backDef.id,
    ownerId: playerId,
    tapped: !!backDef.entersTapped,
    counters: [],
    damageMarked: 0,
    summoningSick: !hasHasteBack,
  };
  let next = updatePlayer(state, playerId, (p) => ({
    ...p,
    zones: { ...p.zones, graveyard: p.zones.graveyard.filter((c) => c.instanceId !== instanceId), battlefield: [...p.zones.battlefield, newCard] },
  }));

  const logLines = [`${def.name} returns from the graveyard to the battlefield transformed into ${backDef.name}.`];
  if (backDef.onEnter && backDef.onEnter.length > 0) {
    const resolved = resolveCardEffects(next, playerId, backDef.onEnter, newInstanceId);
    next = resolved.state;
    logLines.push(...resolved.logLines);
  }
  if (backDef.saga) {
    const sagaResult = triggerSagaLoreCounter(next, playerId, newInstanceId);
    next = sagaResult.state;
    logLines.push(...sagaResult.logLines);
  }
  if (backDef.grantsExtraTurnOnTransform) {
    next = { ...next, extraTurnsQueued: [...next.extraTurnsQueued, playerId] };
  }

  return { state: next, logLines };
}
