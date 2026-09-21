// ============================================================================
// engine/effects.ts
// ============================================================================

import { CardDefinition, CardEffect, CardInstance, GameState, NoncreatureCastTrigger, ReanimateTargetFromGraveyardEffect, ReturnCreaturesFromGraveyardToHandEffect } from '../types';
import { findCardAnywhere, getOpponent, getPlayer, nextInstanceId, shuffle, updatePlayer, detachEverythingFrom } from './state';
import { getCardDefinition } from '../data/cards';
import { effectivePower, effectiveToughness, moveCreaturesToGraveyard, applyGainLifeTriggers, addLife, loseLife, damageMultiplierFor } from './combat';
import { hasKeyword, hasKeywordEffective } from './keywords';
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

/** The 5 basic land ids (engine/data/cards.ts: buildDefaultDecklist uses the
 * same list) - anything else with type 'land' counts as "nonbasic" for
 * TapStunAndGainLifeForNonbasicLandsEffect (Omega, Heartless Evolution). */
const BASIC_LAND_IDS = new Set(['plains', 'island', 'swamp', 'mountain', 'forest']);

/** Whether a permanent is a nonbasic land - see BASIC_LAND_IDS above. */
export function isNonbasicLand(def: CardDefinition): boolean {
  return def.type === 'land' && !BASIC_LAND_IDS.has(def.id);
}

export function sacrificeFilterLabel(filter: SacrificeFilter): string {
  if (filter === 'creature') return 'creature';
  if (filter === 'creatureToken') return 'creature token';
  if (filter === 'nontokenCreature') return 'nontoken creature';
  if (filter === 'anyPermanent') return 'permanent';
  return 'enchantment';
}

/** Whether a graveyard card is a legal target for a ReanimateTargetFromGraveyardEffect -
 * shared by resolveCardEffects's hasLegalTarget check (below) and
 * engine/actions.ts: resolveReanimate, so they can never disagree about what
 * was offered versus what's actually accepted. Default (no
 * nonlegendaryPermanentInsteadOfCreature): creature card, any mana value
 * unless maxManaValue caps it (Evil Reawakened, Phoenix Down). With
 * nonlegendaryPermanentInsteadOfCreature: any nonland... actually any
 * permanent (creature/artifact/enchantment/land) card that isn't legendary
 * (Ragnarok, Divine Deliverance) - mana value is irrelevant there. */
export function matchesReanimateFilter(def: CardDefinition, effect: ReanimateTargetFromGraveyardEffect): boolean {
  if (effect.nonlegendaryPermanentInsteadOfCreature) {
    return def.type !== 'instant' && def.type !== 'sorcery' && !def.subtype?.toLowerCase().includes('legendary');
  }
  if (def.type !== 'creature') return false;
  if (effect.maxManaValue !== undefined && manaValue(parseCostLabel(def.costLabel)) > effect.maxManaValue) return false;
  return true;
}

/** Whether a graveyard card is a legal pick for a
 * ReturnCreaturesFromGraveyardToHandEffect - shared by resolveCardEffects's
 * eligibility check (above) and engine/actions.ts: resolveReturnCreatureFromGraveyard.
 * Default: creature card. anyPermanentInsteadOfCreature (Rydia's Return): any
 * non-instant, non-sorcery card. */
export function matchesReturnFromGraveyardFilter(def: CardDefinition, effect: ReturnCreaturesFromGraveyardToHandEffect): boolean {
  if (effect.anyPermanentInsteadOfCreature) return def.type !== 'instant' && def.type !== 'sorcery';
  return def.type === 'creature';
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

/** Reveals `controllerId`'s current top-of-library card for a
 * RevealTopThenLoseLifeByManaValueEffect source (Dark Confidant) and sets
 * GameState.pendingRevealPickup so the controller can pick it up (moving it
 * to hand and taking the life loss) on their own time via
 * RESOLVE_REVEAL_PICKUP - both players can see the reveal in the meantime,
 * unlike a private SurveilEffect peek. If the library is empty, nothing was
 * actually revealed, so this just logs that and immediately moves on to the
 * next queued source instead of leaving a pending reveal for a card that
 * never existed - see engine/actions.ts: resolveRevealPickup, which pops
 * `queuedSourceIds` the same way once the current one is picked up. */
export function beginRevealPickup(state: GameState, controllerId: string, sourceInstanceId: string, queuedSourceIds: string[]): { state: GameState; logLines: string[] } {
  let next = state;
  let source = sourceInstanceId;
  let queue = queuedSourceIds;
  const logLines: string[] = [];

  for (;;) {
    const player = getPlayer(next, controllerId);
    const revealedCard = player.zones.library[0];
    if (!revealedCard) {
      logLines.push(`${player.name}'s library is empty - nothing to reveal.`);
      if (queue.length === 0) return { state: next, logLines };
      [source, ...queue] = queue;
      continue;
    }
    next = updatePlayer(next, controllerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(1) } }));
    next = { ...next, pendingRevealPickup: { sourceInstanceId: source, controllerId, revealedCard, queuedSourceIds: queue } };
    logLines.push(`${player.name} reveals ${getCardDefinition(revealedCard.defId).name} off the top of their library.`);
    return { state: next, logLines };
  }
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
    if (def.onDeath && def.onDeath.length > 0) {
      const resolved = resolveCardEffects(next, found.ownerPlayerId, def.onDeath, id);
      next = resolved.state;
      logLines.push(...resolved.logLines);
    }
    // "Gains 'When this creature dies, return it to the battlefield tapped
    // under its owner's control' until end of turn" (Vincent's Limit Break) -
    // a TEMPORARY grant on the instance itself (CardInstance.
    // temporaryOnDeathReturnTapped), not part of the card's own definition,
    // checked separately from def.onDeath above. Re-checks the card is
    // STILL sitting in the graveyard first - the onDeath effects just above
    // could already have moved it somewhere else (e.g. its OWN onDeath
    // reanimating it), in which case this has nothing left to do.
    if (found.card.temporaryOnDeathReturnTapped) {
      const stillThere = findCardAnywhere(next, id);
      if (stillThere && stillThere.zone === 'graveyard') {
        const ownerId = stillThere.ownerPlayerId;
        const newCard: CardInstance = {
          instanceId: nextInstanceId(),
          defId: stillThere.card.defId,
          ownerId,
          tapped: true,
          counters: [],
          damageMarked: 0,
          summoningSick: true,
        };
        next = updatePlayer(next, ownerId, (p) => ({
          ...p,
          zones: { ...p.zones, graveyard: p.zones.graveyard.filter((c) => c.instanceId !== id), battlefield: [...p.zones.battlefield, newCard] },
        }));
        logLines.push(`${def.name} returns to the battlefield tapped.`);
      }
    }
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
    } else if (effect.type === 'tapStunAndGainLifeForNonbasicLands') {
      // The life gain is unconditional - it isn't "for each permanent tapped
      // this way", just a flat "you gain X life" alongside the (separately
      // optional) tap - so it's applied right here, BEFORE the pendingTarget
      // step below, rather than folded into chooseTarget's resolution. That
      // matters because declining an optional pendingTarget (see chooseTarget's
      // isOptional check) only ever clears pendingTarget - it doesn't re-run
      // effect-specific logic - so if the life gain lived there, choosing not
      // to tap anything would also wrongly skip the life gain entirely.
      const player = getPlayer(next, playerId);
      const x = player.zones.battlefield.filter((c) => isNonbasicLand(getCardDefinition(c.defId))).length;
      if (x > 0) {
        next = addLife(next, playerId, x);
        next = applyGainLifeTriggers(next, playerId);
        logLines.push(`${getPlayer(next, playerId).name} gains ${x} life (nonbasic lands controlled).`);
      }
      const opponent = getOpponent(next, playerId);
      const hasLegalTarget = opponent.zones.battlefield.some((c) => getCardDefinition(c.defId).type !== 'land');
      if (!hasLegalTarget) {
        const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
        logLines.push(`${sourceName}'s tap ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'coinFlip') {
      // No legality check needed - a coin flip always has something to
      // resolve. See engine/actions.ts: chooseCoinSide for the actual flip
      // (decided the moment the controller calls a side, not here).
      next = { ...next, pendingCoinFlip: { sourceInstanceId, controllerId: playerId, ifWinEffects: effect.ifWinEffects } };
    } else if (effect.type === 'hideaway') {
      const player = getPlayer(next, playerId);
      const cards = player.zones.library.slice(0, effect.count);
      if (cards.length === 0) {
        logLines.push(`${player.name}'s library is empty - nothing to hide away.`);
      } else {
        next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(effect.count) } }));
        next = { ...next, pendingHideaway: { sourceInstanceId, controllerId: playerId, cards } };
        logLines.push(`${player.name} looks at the top ${cards.length} card(s) of their library to hide one away.`);
      }
    } else if (effect.type === 'chooseCreatureDebuffOthersAndWatchLeave') {
      const opponent = getOpponent(next, playerId);
      const hasLegalTarget = opponent.zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'creature');
      if (!hasLegalTarget) {
        const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'grantTemporaryBaseStatsAndDeathReturn') {
      const hasLegalTarget = getPlayer(next, playerId).zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'creature');
      if (!hasLegalTarget) {
        const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
        logLines.push(`${sourceName} has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'grantCombatDamageToPlayerCausesLoss') {
      const found = findCardAnywhere(next, sourceInstanceId);
      if (found && found.zone === 'battlefield') {
        next = updatePlayer(next, found.ownerPlayerId, (p) => ({
          ...p,
          zones: {
            ...p.zones,
            battlefield: p.zones.battlefield.map((c) => (c.instanceId === sourceInstanceId ? { ...c, grantedCombatDamageToPlayerCausesLoss: true } : c)),
          },
        }));
        logLines.push(`${getCardDefinition(found.card.defId).name} gains: whenever it deals combat damage to a player, that player loses the game.`);
      }
    } else if (effect.type === 'untapSelfIfFirstCombatPhaseOfTurn') {
      if (next.combatPhaseNumberThisTurn === 1) {
        const found = findCardAnywhere(next, sourceInstanceId);
        if (found && found.zone === 'battlefield') {
          next = updatePlayer(next, found.ownerPlayerId, (p) => ({
            ...p,
            zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === sourceInstanceId ? { ...c, tapped: false } : c)) },
          }));
          logLines.push(`${getCardDefinition(found.card.defId).name} untaps.`);
        }
      }
    } else if (effect.type === 'queueExtraCombatPhaseIfFirstCombatPhaseOfTurn') {
      if (next.combatPhaseNumberThisTurn === 1) {
        next = { ...next, extraCombatPhasesQueued: next.extraCombatPhasesQueued + 1 };
        logLines.push('There will be an additional combat phase after this one.');
      }
    } else if (effect.type === 'transformSelf') {
      // A no-op (not an error) if the source has already left the battlefield
      // or has no back face - by the time this fires (typically from a
      // battlefieldLeaveWatcher, see engine/actions.ts), the source may have
      // left play some other way in the same resolution chain.
      const found = findCardAnywhere(next, sourceInstanceId);
      if (found && found.zone === 'battlefield') {
        const currentDef = getCardDefinition(found.card.defId);
        if (currentDef.transformsInto) {
          const backDef = getCardDefinition(currentDef.transformsInto);
          next = updatePlayer(next, playerId, (p) => ({
            ...p,
            zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === sourceInstanceId ? stripSagaProgress({ ...c, defId: backDef.id }) : c)) },
          }));
          if (backDef.grantsExtraTurnOnTransform) {
            next = { ...next, extraTurnsQueued: [...next.extraTurnsQueued, playerId] };
          }
          logLines.push(`${currentDef.name} transforms into ${backDef.name}.`);
          if (backDef.onTransformInto && backDef.onTransformInto.length > 0) {
            const resolved = resolveCardEffects(next, playerId, backDef.onTransformInto, sourceInstanceId);
            next = resolved.state;
            logLines.push(...resolved.logLines);
          }
        }
      }
    } else if (effect.type === 'chooseOpponent') {
      // This engine is 2-player only, so there's only ever one legal choice -
      // no pendingPlayerTarget pause needed, same reasoning as Omega,
      // Heartless Evolution's "for each opponent" collapsing to the one
      // opponent that actually exists.
      const opponent = getOpponent(next, playerId);
      next = updatePlayer(next, playerId, (p) => ({
        ...p,
        zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === sourceInstanceId ? { ...c, chosenOpponentId: opponent.id } : c)) },
      }));
      logLines.push(`${getPlayer(next, playerId).name} chooses ${opponent.name}.`);
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
      const hasLegalTarget = next.players.some((p) =>
        p.zones.battlefield.some((c) => {
          const d = getCardDefinition(c.defId);
          const isFlyingCreature = d.type === 'creature' && hasKeyword(d, 'flying');
          return (
            effect.targetFilter === 'anyPermanent' ||
            (effect.targetFilter === 'nonlandPermanent' && d.type !== 'land') ||
            (effect.targetFilter === 'creatureWithMinPower' && d.type === 'creature' && effectivePower(d, c, next, p.id) >= (effect.minPower ?? 0)) ||
            (effect.targetFilter === 'artifactEnchantmentOrFlyingCreature' && (d.type === 'artifact' || d.type === 'enchantment' || isFlyingCreature)) ||
            (effect.targetFilter === 'artifactOrEnchantment' && (d.type === 'artifact' || d.type === 'enchantment')) ||
            (effect.targetFilter === 'creatureWithDamageMarked' && d.type === 'creature' && c.damageMarked > 0) ||
            (effect.targetFilter === 'land' && d.type === 'land') ||
            (effect.targetFilter === 'creature' && d.type === 'creature')
          );
        })
      );
      if (!hasLegalTarget) {
        if (!effect.optional) {
          const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
          logLines.push(`${sourceName}'s ability has no legal target.`);
        }
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
        next = {
          ...next,
          pendingRevealFiltered: { sourceInstanceId, controllerId: playerId, revealed, filterType: effect.filterType, restDestination: effect.restDestination, takenDestination: effect.takenDestination },
        };
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
    } else if (effect.type === 'searchLibraryForBasicLand') {
      const player = getPlayer(next, playerId);
      const foundIndex = player.zones.library.findIndex((c) => BASIC_LAND_IDS.has(c.defId));
      if (foundIndex === -1) {
        next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: shuffle(p.zones.library) } }));
        logLines.push(`${player.name} searches for a basic land but finds none - shuffles the library.`);
      } else {
        const foundCard = player.zones.library[foundIndex];
        const rest = player.zones.library.filter((_, i) => i !== foundIndex);
        next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: shuffle(rest), hand: [...p.zones.hand, foundCard] } }));
        logLines.push(`${player.name} searches their library for a basic land card (${getCardDefinition(foundCard.defId).name}), puts it into hand, then shuffles.`);
      }
    } else if (effect.type === 'searchLibraryForAnyLand') {
      const player = getPlayer(next, playerId);
      const foundIndex = player.zones.library.findIndex((c) => getCardDefinition(c.defId).type === 'land');
      if (foundIndex === -1) {
        next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: shuffle(p.zones.library) } }));
        logLines.push(`${player.name} searches for a land card but finds none - shuffles the library.`);
      } else {
        const foundCard = player.zones.library[foundIndex];
        const rest = player.zones.library.filter((_, i) => i !== foundIndex);
        next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: shuffle(rest), hand: [...p.zones.hand, foundCard] } }));
        logLines.push(`${player.name} searches their library for a land card (${getCardDefinition(foundCard.defId).name}), puts it into hand, then shuffles.`);
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
    } else if (effect.type === 'eachPlayerLosesLife') {
      for (const p of next.players) {
        next = updatePlayer(next, p.id, (pl) => ({ ...pl, life: pl.life - effect.amount }));
      }
      logLines.push(`Each player loses ${effect.amount} life.`);
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
      const hasLegalTarget = [...next.players[0].zones.battlefield, ...next.players[1].zones.battlefield].some((c) => {
        const d = getCardDefinition(c.defId);
        return effect.targetFilter === 'nonlandPermanent' ? d.type !== 'land' : d.type === 'creature';
      });
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
      const matchesType = (d: CardDefinition) => (effect.targetTypeFilter === 'artifactOrCreature' ? d.type === 'artifact' || d.type === 'creature' : d.type === 'creature');
      const candidates = effect.allowAnyController ? [...next.players[0].zones.battlefield, ...next.players[1].zones.battlefield] : getPlayer(next, playerId).zones.battlefield;
      const hasLegalTarget = candidates.some((c) => matchesType(getCardDefinition(c.defId)));
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName} has no legal target to attach to.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'revealTopThenLoseLifeByManaValue') {
      // Doesn't move the card to hand or apply the life loss itself anymore -
      // see beginRevealPickup below, which pauses on GameState.pendingRevealPickup
      // (RESOLVE_REVEAL_PICKUP in engine/actions.ts) so the reveal can be
      // shown to both players and the controller picks it up in their own
      // time, instead of it happening invisibly in one instant. If another
      // copy of this effect already left something pending this same
      // upkeep, queue behind it - see GameState.pendingRevealPickup.
      if (next.pendingRevealPickup) {
        next = { ...next, pendingRevealPickup: { ...next.pendingRevealPickup, queuedSourceIds: [...next.pendingRevealPickup.queuedSourceIds, sourceInstanceId] } };
      } else {
        const result = beginRevealPickup(next, playerId, sourceInstanceId, []);
        next = result.state;
        logLines.push(...result.logLines);
      }
    } else if (effect.type === 'mayPayLifeThenEffect') {
      // Just pauses on the controller's yes/no - see GameState.
      // pendingOptionalPayLife and engine/actions.ts: resolveOptionalPayLife,
      // which actually pays the life and resolves `effects` on accept.
      next = { ...next, pendingOptionalPayLife: { sourceInstanceId, controllerId: playerId, lifeCost: effect.lifeCost, effects: effect.effects } };
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
    } else if (effect.type === 'drawForTappedOpponentCreatures') {
      const player = getPlayer(next, playerId);
      const opponent = getOpponent(next, playerId);
      const count = opponent.zones.battlefield.filter((c) => c.tapped && getCardDefinition(c.defId).type === 'creature').length;
      if (count > 0) {
        const drawn = player.zones.library.slice(0, count);
        next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(count), hand: [...p.zones.hand, ...drawn] } }));
        logLines.push(`${player.name} draws ${drawn.length} card(s) (${count} tapped creature(s) ${opponent.name} controls).`);
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
        if (effect.power || effect.toughness) next = applyTemporaryBuff(next, c.instanceId, effect.power ?? 0, effect.toughness ?? 0);
        if (effect.grantKeyword) next = grantTemporaryKeyword(next, c.instanceId, effect.grantKeyword);
      }
      if (others.length > 0) {
        const counterNote = effect.counterLabel && effect.counterAmount ? ` a ${effect.counterLabel} counter` : '';
        const buffNote = effect.power || effect.toughness ? `${counterNote ? ' and' : ''} +${effect.power ?? 0}/+${effect.toughness ?? 0} until end of turn` : '';
        const keywordNote = effect.grantKeyword ? `${counterNote || buffNote ? ' and' : ''} ${effect.grantKeyword} until end of turn` : '';
        logLines.push(`Other creatures you control each get${counterNote}${buffNote}${keywordNote}.`);
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
      const eligible = player.zones.graveyard.filter((c) => matchesReanimateFilter(getCardDefinition(c.defId), effect));
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (eligible.length === 0) {
        logLines.push(`${sourceName} has no legal target - ${player.name} has no matching card in their graveyard.`);
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
          zones: { ...p.zones, [found.zone]: p.zones[found.zone].map((c) => (c.instanceId === sourceInstanceId ? stripSagaProgress({ ...c, defId: backDef.id }) : c)) },
        }));
        logLines.push(`${def.name} transforms into ${backDef.name}.`);
      }
    } else if (effect.type === 'returnCreaturesFromGraveyardToHand') {
      const player = getPlayer(next, playerId);
      const eligible = player.zones.graveyard.filter((c) => matchesReturnFromGraveyardFilter(getCardDefinition(c.defId), effect));
      if (eligible.length === 0) {
        logLines.push(`${player.name} has no ${effect.anyPermanentInsteadOfCreature ? 'permanent' : 'creature'} card in their graveyard to return.`);
      } else {
        next = { ...next, pendingReturnCreaturesFromGraveyard: { sourceInstanceId, controllerId: playerId, remaining: effect.count, anyPermanentInsteadOfCreature: effect.anyPermanentInsteadOfCreature } };
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
      if (effect.grantKeyword) next = grantTemporaryKeyword(next, sourceInstanceId, effect.grantKeyword);
      if (effect.tapSelf) {
        const found = findCardAnywhere(next, sourceInstanceId);
        if (found && found.zone === 'battlefield') {
          next = updatePlayer(next, found.ownerPlayerId, (p) => ({
            ...p,
            zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === sourceInstanceId ? { ...c, tapped: true } : c)) },
          }));
        }
      }
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      const keywordNote = effect.grantKeyword ? ` and gains ${effect.grantKeyword} until end of turn` : '';
      const tapNote = effect.tapSelf ? ' It is tapped.' : '';
      logLines.push(`${sourceName} gets +${effect.power}/+${effect.toughness} until end of turn${keywordNote}.${tapNote}`);
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
    } else if (effect.type === 'tapAllOpponentCreatures') {
      const opponent = getOpponent(next, playerId);
      next = updatePlayer(next, opponent.id, (p) => ({
        ...p,
        zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (getCardDefinition(c.defId).type === 'creature' ? { ...c, tapped: true } : c)) },
      }));
      logLines.push(`All creatures ${opponent.name} controls are tapped.`);
    } else if (effect.type === 'destroyAll') {
      const dead = [...next.players[0].zones.battlefield, ...next.players[1].zones.battlefield]
        .filter((c) => {
          const d = getCardDefinition(c.defId);
          const matchesFilter = effect.targetFilter === 'artifactAndCreature' ? d.type === 'artifact' || d.type === 'creature' : false;
          return matchesFilter && !hasKeywordEffective(d, c, 'indestructible');
        })
        .map((c) => c.instanceId);
      if (dead.length > 0) {
        const destroyResult = moveCreaturesToGraveyardAndTrigger(next, dead, 'is destroyed');
        next = destroyResult.state;
        logLines.push(...destroyResult.logLines);
      }
      logLines.push('All artifacts and creatures are destroyed.');
    } else if (effect.type === 'createTokenIfControlledSubtypeCountAtLeast') {
      const player = getPlayer(next, playerId);
      const count = player.zones.battlefield.filter((c) => getCardDefinition(c.defId).subtype?.toLowerCase().includes(effect.subtype.toLowerCase())).length;
      if (count >= effect.minCount) {
        const resolved = resolveCardEffects(next, playerId, [{ type: 'createToken', tokenId: effect.tokenId }], sourceInstanceId);
        next = resolved.state;
        logLines.push(...resolved.logLines);
      }
    } else if (effect.type === 'buffOtherCreaturesYouControlByControlledSubtypeCount') {
      const player = getPlayer(next, playerId);
      const count = player.zones.battlefield.filter((c) => getCardDefinition(c.defId).subtype?.toLowerCase().includes(effect.subtype.toLowerCase())).length;
      const resolved = resolveCardEffects(next, playerId, [{ type: 'buffOtherCreaturesYouControl', power: count, toughness: count }], sourceInstanceId);
      next = resolved.state;
      logLines.push(...resolved.logLines);
    } else if (effect.type === 'millEachOpponentByYourHandSize') {
      const player = getPlayer(next, playerId);
      const count = player.zones.hand.length;
      const opponent = getOpponent(next, playerId);
      const milled = opponent.zones.library.slice(0, count);
      next = updatePlayer(next, opponent.id, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(count), graveyard: [...p.zones.graveyard, ...milled] } }));
      logLines.push(`${opponent.name} mills ${milled.length} card(s).`);
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
          zones: { ...p.zones, [found.zone]: p.zones[found.zone].map((c) => (c.instanceId === sourceInstanceId ? stripSagaProgress({ ...c, defId: backDef.id }) : c)) },
        }));
        logLines.push(`${def.name} transforms into ${backDef.name}.`);
      }
    } else if (effect.type === 'pumpAnotherControlledCreature') {
      const player = getPlayer(next, playerId);
      const hasLegalTarget = player.zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'creature' && c.instanceId !== sourceInstanceId);
      if (hasLegalTarget) {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'damageTargetCreature') {
      const hasLegalTarget = next.players.some((p) => p.zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'creature'));
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'sweepDamageFromChosenCreature') {
      const player = getPlayer(next, playerId);
      const hasLegalTarget = player.zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'creature');
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target - ${player.name} controls no creature.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'searchLibraryForNamedCard') {
      const player = getPlayer(next, playerId);
      const foundIndex = player.zones.library.findIndex((c) => getCardDefinition(c.defId).name === effect.cardName);
      if (foundIndex === -1) {
        next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: shuffle(p.zones.library) } }));
        logLines.push(`${player.name} searches for a ${effect.cardName} but finds none - shuffles the library.`);
      } else {
        const foundDef = getCardDefinition(player.zones.library[foundIndex].defId);
        const foundCard: CardInstance = { ...player.zones.library[foundIndex], tapped: true, damageMarked: 0, summoningSick: !hasKeyword(foundDef, 'haste') };
        const rest = player.zones.library.filter((_, i) => i !== foundIndex);
        next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: shuffle(rest), battlefield: [...p.zones.battlefield, foundCard] } }));
        logLines.push(`${player.name} searches their library for ${effect.cardName}, puts it onto the battlefield tapped, then shuffles.`);
      }
    } else if (effect.type === 'searchLibraryForSubtype') {
      const player = getPlayer(next, playerId);
      const foundIndex = player.zones.library.findIndex((c) => getCardDefinition(c.defId).subtype?.toLowerCase().includes(effect.subtype.toLowerCase()));
      if (foundIndex === -1) {
        next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: shuffle(p.zones.library) } }));
        logLines.push(`${player.name} searches for a ${effect.subtype} card but finds none - shuffles the library.`);
      } else {
        const foundCard = player.zones.library[foundIndex];
        const rest = player.zones.library.filter((_, i) => i !== foundIndex);
        next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: shuffle(rest), hand: [...p.zones.hand, foundCard] } }));
        logLines.push(`${player.name} searches their library for a ${effect.subtype} card, puts it into hand, then shuffles.`);
      }
    } else if (effect.type === 'exileTopOfEachOpponentLibrary') {
      for (const p of next.players) {
        if (p.id === playerId) continue;
        const exiled = p.zones.library.slice(0, effect.count);
        next = updatePlayer(next, p.id, (pl) => ({ ...pl, zones: { ...pl.zones, library: pl.zones.library.slice(effect.count), exile: [...pl.zones.exile, ...exiled] } }));
        logLines.push(`${p.name} exiles the top ${exiled.length} card(s) of their library.`);
      }
    } else if (effect.type === 'buffAllCreatures') {
      for (const p of next.players) {
        for (const c of p.zones.battlefield) {
          if (getCardDefinition(c.defId).type !== 'creature') continue;
          next = applyTemporaryBuff(next, c.instanceId, effect.power, effect.toughness);
        }
      }
      logLines.push(`All creatures get +${effect.power}/+${effect.toughness} until end of turn.`);
    } else if (effect.type === 'becomeCreatureUntilEndOfTurn') {
      const found = findCardAnywhere(next, sourceInstanceId);
      if (found && found.zone === 'battlefield') {
        next = updatePlayer(next, found.ownerPlayerId, (p) => ({
          ...p,
          zones: {
            ...p.zones,
            battlefield: p.zones.battlefield.map((c) =>
              c.instanceId === sourceInstanceId ? { ...c, temporarilyCreatureUntilEndOfTurn: true, temporaryGrantedSubtype: effect.subtype } : c
            ),
          },
        }));
        logLines.push(
          `${getCardDefinition(found.card.defId).name} becomes a${effect.subtype ? ` ${effect.subtype}` : ''} creature until end of turn.`
        );
      }
    } else if (effect.type === 'createTokenCopyOfTarget') {
      const hasLegalTarget = [...next.players[0].zones.battlefield, ...next.players[1].zones.battlefield].some((c) => {
        const d = getCardDefinition(c.defId);
        return d.type === 'artifact' || d.type === 'creature' || d.type === 'land';
      });
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'debuffOpponentCreatures') {
      const opponent = getOpponent(next, playerId);
      for (const c of opponent.zones.battlefield) {
        if (getCardDefinition(c.defId).type !== 'creature') continue;
        next = applyTemporaryBuff(next, c.instanceId, effect.power, effect.toughness);
      }
      logLines.push(`Creatures ${opponent.name} controls get ${effect.power}/${effect.toughness} until end of turn.`);
    } else if (effect.type === 'millSelf') {
      const player = getPlayer(next, playerId);
      const milled = player.zones.library.slice(0, effect.count);
      next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(effect.count), graveyard: [...p.zones.graveyard, ...milled] } }));
      logLines.push(`${player.name} mills ${milled.length} card(s).`);
    } else if (effect.type === 'damageTargetCreatureEqualToCreaturesAndEquipment') {
      const player = getPlayer(next, playerId);
      const creatureCount = player.zones.battlefield.filter((c) => getCardDefinition(c.defId).type === 'creature').length;
      const equipmentCount = player.zones.battlefield.filter((c) => getCardDefinition(c.defId).subtype?.toLowerCase().includes('equipment')).length;
      const resolved = resolveCardEffects(next, playerId, [{ type: 'damageTargetCreature', amount: creatureCount + equipmentCount }], sourceInstanceId);
      next = resolved.state;
      logLines.push(...resolved.logLines);
    } else if (effect.type === 'damageTargetCreatureEqualToOtherControlledSubtypePower') {
      const player = getPlayer(next, playerId);
      const totalPower = player.zones.battlefield
        .filter((c) => c.instanceId !== sourceInstanceId && getCardDefinition(c.defId).subtype?.toLowerCase().includes(effect.subtype.toLowerCase()))
        .reduce((sum, c) => sum + effectivePower(getCardDefinition(c.defId), c, next, playerId), 0);
      const resolved = resolveCardEffects(next, playerId, [{ type: 'damageTargetCreature', amount: totalPower }], sourceInstanceId);
      next = resolved.state;
      logLines.push(...resolved.logLines);
    } else if (effect.type === 'createTokenIfNotControllingNamed') {
      const player = getPlayer(next, playerId);
      const alreadyControls = player.zones.battlefield.some((c) => getCardDefinition(c.defId).name === effect.name);
      if (!alreadyControls) {
        const resolved = resolveCardEffects(next, playerId, [{ type: 'createToken', tokenId: effect.tokenId }], sourceInstanceId);
        next = resolved.state;
        logLines.push(...resolved.logLines);
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
/** Strips a Saga's 'lore' counter and CardInstance.sagaChaptersTriggered
 * tracking from `card` - shared by every "fresh entrance" and "in-place
 * transform" code path (engine/actions.ts: castCard, castFromGraveyard,
 * resolveReanimate, flipCard, activateAbility's transformSelf; this file's
 * transformSelfIfGraveyardSizeAtLeast/transformSelfIfControlledSubtypeCountAtLeast
 * resolvers) so a Saga always starts its chapters fresh on a new
 * summon/transform, never carrying over progress from a previous stay on
 * the battlefield. Harmless no-op for a card that was never a Saga. */
export function stripSagaProgress(card: CardInstance): CardInstance {
  if (!card.counters.some((c) => c.label === 'lore') && card.sagaChaptersTriggered === undefined) return card;
  return { ...card, counters: card.counters.filter((c) => c.label !== 'lore'), sagaChaptersTriggered: undefined };
}

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
    if (def.landfall.pumpAnotherControlledCreature) {
      const { power, toughness, grantKeyword } = def.landfall.pumpAnotherControlledCreature;
      const resolved = resolveCardEffects(next, playerId, [{ type: 'pumpAnotherControlledCreature', power, toughness, grantKeyword }], card.instanceId);
      next = resolved.state;
      logLines.push(`Landfall: ${def.name} triggers.`, ...resolved.logLines);
      continue;
    }
    if (def.landfall.createTokenId) {
      const resolved = resolveCardEffects(next, playerId, [{ type: 'createToken', tokenId: def.landfall.createTokenId }], card.instanceId);
      next = resolved.state;
      logLines.push(`Landfall: ${def.name} triggers.`, ...resolved.logLines);
      continue;
    }
    if (def.landfall.damageEachOpponent) {
      const opponent = getOpponent(next, playerId);
      const amount = def.landfall.damageEachOpponent * damageMultiplierFor(next, playerId, def);
      next = loseLife(next, opponent.id, amount);
      logLines.push(`Landfall: ${def.name} deals ${amount} damage to ${opponent.name}.`);
      continue;
    }
    if (def.landfall.putCounterOnTargetOwnCreature) {
      const { counterLabel, counterAmount } = def.landfall.putCounterOnTargetOwnCreature;
      const resolved = resolveCardEffects(next, playerId, [{ type: 'putCounterOnUpToOneOwnCreature', counterLabel, counterAmount }], card.instanceId);
      next = resolved.state;
      logLines.push(`Landfall: ${def.name} triggers.`, ...resolved.logLines);
      continue;
    }
    if (def.landfall.pumpControlledSubtype) {
      const { subtype, power, toughness } = def.landfall.pumpControlledSubtype;
      const resolved = resolveCardEffects(next, playerId, [{ type: 'pumpControlledSubtype', subtype, power, toughness }], card.instanceId);
      next = resolved.state;
      logLines.push(`Landfall: ${def.name} triggers.`, ...resolved.logLines);
      continue;
    }
    if (def.landfall.doubleSelfPowerUntilEndOfTurn) {
      const currentPower = effectivePower(def, card, next, playerId);
      next = applyTemporaryBuff(next, card.instanceId, currentPower, 0);
      logLines.push(`Landfall: ${def.name}'s power is doubled until end of turn.`);
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
export function triggerNoncreatureCastAbilities(
  state: GameState,
  playerId: string,
  manaSpent: number,
  eligibleInstanceIds?: Set<string>
): { state: GameState; logLines: string[] } {
  let next = state;
  const logLines: string[] = [];

  function applyTrigger(card: CardInstance, def: CardDefinition, trigger: NoncreatureCastTrigger) {
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
      if (trigger.counterIfExpensive.grantKeyword) next = grantTemporaryKeyword(next, card.instanceId, trigger.counterIfExpensive.grantKeyword);
      const keywordNote = trigger.counterIfExpensive.grantKeyword ? ` and gains ${trigger.counterIfExpensive.grantKeyword} until end of turn` : '';
      logLines.push(`${def.name} triggers, gaining a ${counterLabel} counter${keywordNote} (${manaSpent} mana was spent).`);
    }
    if (trigger.surveilCount) {
      const resolved = resolveCardEffects(next, playerId, [{ type: 'surveil', count: trigger.surveilCount }], card.instanceId);
      next = resolved.state;
      logLines.push(...resolved.logLines);
    }
    if (trigger.pumpSelf) {
      next = applyTemporaryBuff(next, card.instanceId, trigger.pumpSelf.power, trigger.pumpSelf.toughness);
      logLines.push(`${def.name} triggers (Prowess): gets +${trigger.pumpSelf.power}/+${trigger.pumpSelf.toughness} until end of turn.`);
    }
    if (trigger.createTokenIfExpensive && manaSpent >= trigger.createTokenIfExpensive.minManaValue) {
      const resolved = resolveCardEffects(next, playerId, [{ type: 'createToken', tokenId: trigger.createTokenIfExpensive.tokenId }], card.instanceId);
      next = resolved.state;
      logLines.push(...resolved.logLines);
    }
    if (trigger.pumpSelfByManaSpent) {
      next = applyTemporaryBuff(next, card.instanceId, manaSpent, 0);
      let drawNote = '';
      if (trigger.pumpSelfByManaSpent.drawIfAtLeast !== undefined && manaSpent >= trigger.pumpSelfByManaSpent.drawIfAtLeast) {
        const resolved = resolveCardEffects(next, playerId, [{ type: 'drawCards', amount: 1 }], card.instanceId);
        next = resolved.state;
        drawNote = ` ${resolved.logLines.join(' ')}`;
      }
      logLines.push(`${def.name} triggers: gets +${manaSpent}/+0 until end of turn (${manaSpent} mana was spent).${drawNote}`);
    }
    if (trigger.tapAndStunOpponentCreatureIfExpensive && manaSpent >= trigger.tapAndStunOpponentCreatureIfExpensive.minManaValue) {
      const resolved = resolveCardEffects(next, playerId, [{ type: 'tapAndStun', targetController: 'opponent', targetType: 'creature' }], card.instanceId);
      next = resolved.state;
      logLines.push(...resolved.logLines);
    }
  }

  for (const card of getPlayer(next, playerId).zones.battlefield) {
    // A permanent (or, via an attached Equipment, whatever it just got
    // attached to - e.g. Black Mage's Rod's Job Select token) that entered
    // the battlefield as PART OF resolving THIS SAME cast can't have seen
    // this cast as a trigger event - it didn't exist yet at the moment the
    // spell was cast, only once the spell finished resolving. Without this,
    // casting Black Mage's Rod would immediately trigger its own
    // just-created, just-attached token's granted "whenever you cast a
    // noncreature spell" ability off its own casting.
    if (eligibleInstanceIds && !eligibleInstanceIds.has(card.instanceId)) continue;
    const def = getCardDefinition(card.defId);
    if (def.noncreatureCastTrigger) applyTrigger(card, def, def.noncreatureCastTrigger);
    // "Whenever you cast a noncreature spell, this creature deals 1 damage
    // to each opponent" (Black Mage's Rod) - a granted trigger from any
    // Equipment currently attached to this permanent, applied against the
    // EQUIPPED CREATURE (not the equipment) as source/target, same
    // reasoning as CardDefinition.equipGrantsOnAttack.
    const equipment = getPlayer(next, playerId).zones.battlefield.filter((c) => c.attachedToInstanceId === card.instanceId);
    for (const eq of equipment) {
      const eqDef = getCardDefinition(eq.defId);
      if (eqDef.equipGrantsNoncreatureCastTrigger) applyTrigger(card, def, eqDef.equipGrantsNoncreatureCastTrigger);
    }
  }

  return { state: next, logLines };
}

/** "Saga" - puts a lore counter on `instanceId` (an ordinary Counter
 * labeled 'lore') and resolves any SagaChapter whose `numbers` includes the
 * new total. Called once as a Saga enters the battlefield (engine/actions.ts:
 * castCard/castFromGraveyard) and again as its controller's precombat main
 * phase begins (engine/actions.ts: nextPhase). See types.ts: SagaAbility.
 *
 * A chapter number only ever fires the FIRST time it's reached during this
 * Saga's current, continuous stay on the battlefield - see
 * CardInstance.sagaChaptersTriggered. Without this, a lore counter reduced
 * by ModifySagaLoreCounterEffect (delta: -1) and then raised back to a
 * previously-reached number (by this function or by delta: 1, which also
 * calls into here) would incorrectly re-fire that chapter. */
export function triggerSagaLoreCounter(state: GameState, playerId: string, instanceId: string): { state: GameState; logLines: string[] } {
  const player = getPlayer(state, playerId);
  const card = player.zones.battlefield.find((c) => c.instanceId === instanceId);
  if (!card) return { state, logLines: [] };
  const def = getCardDefinition(card.defId);
  if (!def.saga) return { state, logLines: [] };

  const existingLore = card.counters.find((c) => c.label === 'lore')?.amount ?? 0;
  const newCount = existingLore + 1;
  const alreadyTriggered = card.sagaChaptersTriggered ?? [];
  const matchingChapters = def.saga.chapters.filter((ch) => ch.numbers.includes(newCount) && !alreadyTriggered.includes(newCount));

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
        return { ...c, counters, sagaChaptersTriggered: matchingChapters.length > 0 ? [...alreadyTriggered, newCount] : c.sagaChaptersTriggered };
      }),
    },
  }));

  const logLines: string[] = [`${def.name} gets a lore counter (now ${newCount}).`];
  for (const chapter of matchingChapters) {
    const resolved = resolveCardEffects(next, playerId, chapter.effects, instanceId);
    next = resolved.state;
    logLines.push(...resolved.logLines);
  }

  const maxChapterNumber = Math.max(...def.saga.chapters.flatMap((ch) => ch.numbers));
  const reachedFinalChapterThisTime = matchingChapters.some((ch) => ch.numbers.includes(maxChapterNumber));
  const stillOnBattlefield = getPlayer(next, playerId).zones.battlefield.some((c) => c.instanceId === instanceId);
  const shouldSacrifice =
    reachedFinalChapterThisTime &&
    (def.saga.sacrificeAfterFinalChapter === true || (def.type !== 'creature' && def.saga.sacrificeAfterFinalChapter !== false));
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
 * fresh. The "exile" step is momentary and never actually left sitting in
 * the exile zone - front and back face are the same physical double-faced
 * card, so there is only ever one object to show on screen, not a copy left
 * behind in exile plus a new one on the battlefield (see
 * returnFromGraveyardTransformed below, which never visits exile at all for
 * the same reason). Shared by engine/actions.ts: activateAbility's
 * exileAndReturnTransformed cost, and
 * ExileAndReturnTransformedSelfIfLoreAtLeastEffect above. Does NOT re-check
 * the legend rule (a corner case left for the caller). */
export function exileAndReturnTransformed(state: GameState, playerId: string, instanceId: string): { state: GameState; logLines: string[] } {
  const player = getPlayer(state, playerId);
  const card = player.zones.battlefield.find((c) => c.instanceId === instanceId);
  if (!card) return { state, logLines: [] };
  const def = getCardDefinition(card.defId);
  if (!def.transformsInto) return { state, logLines: [] };
  const backDef = getCardDefinition(def.transformsInto);

  let next = detachEverythingFrom(state, instanceId);
  const newInstanceId = nextInstanceId();
  const hasHasteBack = hasKeyword(backDef, 'haste');
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
  const hasHasteBack = hasKeyword(backDef, 'haste');
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
