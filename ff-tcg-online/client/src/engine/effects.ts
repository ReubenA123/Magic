// ============================================================================
// engine/effects.ts
// ============================================================================

import {
  CardDefinition,
  CardEffect,
  CardInstance,
  CardType,
  GameState,
  LibrarySearchFilter,
  NoncreatureCastTrigger,
  ReanimateTargetFromGraveyardEffect,
  ReturnCreaturesFromGraveyardToHandEffect,
  SacrificeFilter,
} from '../types';
import { findCardAnywhere, getOpponent, getPlayer, nextInstanceId, shuffle, updatePlayer, detachEverythingFrom } from './state';
import { getCardDefinition, frontFaceDefId } from '../data/cards';
import { effectivePower, effectiveToughness, moveCreaturesToGraveyard, applyGainLifeTriggers, applyDrawTriggers, addLife, loseLife, damageMultiplierFor, hasGrantedSubtype, checkIndestructibleOrShielded } from './combat';
import { hasKeyword, hasKeywordEffective } from './keywords';
import { parseCostLabel, manaValue } from './mana';

/** Whether `instance` is a legal sacrifice for `filter` - shared by
 * resolveSacrificeQueue (below) and engine/actions.ts: chooseSacrifice. */
export function matchesSacrificeFilter(def: CardDefinition, instance: CardInstance, filter: SacrificeFilter): boolean {
  if (filter === 'creature') return def.type === 'creature';
  if (filter === 'creatureToken') return def.type === 'creature' && !!instance.isToken;
  if (filter === 'nontokenCreature') return def.type === 'creature' && !instance.isToken;
  if (filter === 'anyPermanent') return def.type !== 'instant' && def.type !== 'sorcery';
  if (filter === 'nonGodCreature') return def.type === 'creature' && !def.subtype?.toLowerCase().includes('god');
  if (filter === 'creatureOrArtifact') return def.type === 'creature' || def.type === 'artifact';
  return def.type === 'enchantment';
}

/** The 5 basic land ids (engine/data/cards.ts: buildDefaultDecklist uses the
 * same list) - anything else with type 'land' counts as "nonbasic" for
 * TapStunAndGainLifeForNonbasicLandsEffect (Omega, Heartless Evolution). */
const BASIC_LAND_IDS = new Set(['plains', 'island', 'swamp', 'mountain', 'forest']);

/** Whether `def` is a legal find for a GameState.pendingLibrarySearch's
 * `filter` - shared by every SearchLibraryFor*Effect/CyclingAbility's own
 * land search (engine/actions.ts: resolveLibrarySearch, cycleCard) AND the
 * client (which uses the exact same shape to decide what's even shown as
 * pickable - see components/LibrarySearchModal.tsx). */
export function matchesLibrarySearchFilter(def: CardDefinition, filter: LibrarySearchFilter): boolean {
  if (filter.kind === 'basicLand') return BASIC_LAND_IDS.has(def.id);
  if (filter.kind === 'anyLand') return def.type === 'land';
  if (filter.kind === 'landByName') return def.type === 'land' && def.name === filter.name;
  if (filter.kind === 'subtype') return !!def.subtype?.toLowerCase().includes(filter.subtype.toLowerCase());
  if (filter.kind === 'basicLandOrSubtype') return BASIC_LAND_IDS.has(def.id) || !!def.subtype?.toLowerCase().includes(filter.subtype.toLowerCase());
  if (filter.kind === 'creatureWithManaValueAtMost') return def.type === 'creature' && manaValue(parseCostLabel(def.costLabel)) <= filter.maxManaValue;
  return def.name === filter.name;
}

/** Whether a permanent is a nonbasic land - see BASIC_LAND_IDS above. */
export function isNonbasicLand(def: CardDefinition): boolean {
  return def.type === 'land' && !BASIC_LAND_IDS.has(def.id);
}

/** Words in a CardDefinition.subtype string that are never themselves a
 * creature TYPE - supertypes, the card type itself, and punctuation some
 * entries use as a separator (e.g. "Legendary Creature — Cat Archer"). Used
 * by sharesCreatureType below; there's no structured "creature types" list
 * anywhere in this data model, just the printed subtype string, so this is
 * necessarily a word-level approximation. */
const NON_CREATURE_TYPE_WORDS = new Set(['legendary', 'creature', 'artifact', 'enchantment', 'token', '—', '-']);

function creatureTypeWords(def: CardDefinition): Set<string> {
  return new Set(
    (def.subtype ?? '')
      .split(/[\s—-]+/)
      .map((w) => w.toLowerCase())
      .filter((w) => w && !NON_CREATURE_TYPE_WORDS.has(w))
  );
}

/** "...shares a creature type with your commander" (Path of Ancestry) - both
 * must be creatures with at least one subtype WORD in common, after
 * stripping supertypes/punctuation (see NON_CREATURE_TYPE_WORDS above). A
 * simple word-overlap check, not a structured type system - good enough for
 * every creature subtype string already in this data file, which are all
 * space-separated type names. */
export function sharesCreatureType(a: CardDefinition, b: CardDefinition): boolean {
  if (a.type !== 'creature' || b.type !== 'creature') return false;
  const aWords = creatureTypeWords(a);
  if (aWords.size === 0) return false;
  for (const w of creatureTypeWords(b)) {
    if (aWords.has(w)) return true;
  }
  return false;
}

export function sacrificeFilterLabel(filter: SacrificeFilter): string {
  if (filter === 'creature') return 'creature';
  if (filter === 'creatureToken') return 'creature token';
  if (filter === 'nontokenCreature') return 'nontoken creature';
  if (filter === 'anyPermanent') return 'permanent';
  if (filter === 'nonGodCreature') return 'non-God creature';
  if (filter === 'creatureOrArtifact') return 'creature or artifact';
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
  if (effect.anyPermanentInsteadOfCreature) {
    if (def.type === 'instant' || def.type === 'sorcery') return false;
    if (effect.maxManaValue !== undefined && manaValue(parseCostLabel(def.costLabel)) > effect.maxManaValue) return false;
    return true;
  }
  if (def.type !== 'creature') return false;
  if (effect.maxManaValue !== undefined && manaValue(parseCostLabel(def.costLabel)) > effect.maxManaValue) return false;
  if (effect.maxPower !== undefined && (def.power ?? 0) > effect.maxPower) return false;
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

/** "Each player puts a vow counter on a creature they control and sacrifices
 * the rest" (Promise of Loyalty) - the "keep one" cousin of
 * resolveSacrificeQueue just above: same remainingPlayerIds queue shape and
 * the same `currentId === 'ai'` auto-resolution baked directly in, but here
 * the AI picks its BEST creature to KEEP (highest power+toughness) rather
 * than its worst to sacrifice, since keeping nothing is not an option. A
 * player with 0 or 1 creatures has no real choice, so that's resolved
 * inline without ever pausing on pendingKeepOneSacrificeRest. Continued by
 * engine/actions.ts: chooseKeepOneSacrificeRest once a human player picks. */
export function resolveKeepOneSacrificeRestQueue(state: GameState, sourceInstanceId: string, remainingPlayerIds: string[]): { state: GameState; logLines: string[] } {
  let next = state;
  const logLines: string[] = [];
  let queue = remainingPlayerIds;

  const putVowCounter = (playerId: string, instanceId: string) => {
    next = updatePlayer(next, playerId, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.map((c) => {
          if (c.instanceId !== instanceId) return c;
          const hasCounter = c.counters.some((ctr) => ctr.label === 'Vow');
          const counters = hasCounter ? c.counters.map((ctr) => (ctr.label === 'Vow' ? { ...ctr, amount: ctr.amount + 1 } : ctr)) : [...c.counters, { label: 'Vow', amount: 1 }];
          return { ...c, counters };
        }),
      },
    }));
  };

  while (queue.length > 0) {
    const [currentId, ...rest] = queue;
    const current = getPlayer(next, currentId);
    const eligible = current.zones.battlefield.filter((c) => getCardDefinition(c.defId).type === 'creature');

    if (eligible.length === 0) {
      logLines.push(`${current.name} has no creature to keep.`);
      queue = rest;
      continue;
    }

    if (eligible.length === 1) {
      putVowCounter(currentId, eligible[0].instanceId);
      logLines.push(`${current.name} keeps ${getCardDefinition(eligible[0].defId).name} (their only creature) and puts a vow counter on it.`);
      queue = rest;
      continue;
    }

    if (currentId === 'ai') {
      let best = eligible[0];
      let bestScore = effectivePower(getCardDefinition(best.defId), best, next, currentId) + effectiveToughness(getCardDefinition(best.defId), best, next, currentId);
      let tieCount = 1;
      for (const c of eligible.slice(1)) {
        const score = effectivePower(getCardDefinition(c.defId), c, next, currentId) + effectiveToughness(getCardDefinition(c.defId), c, next, currentId);
        if (score > bestScore) {
          best = c;
          bestScore = score;
          tieCount = 1;
        } else if (score === bestScore) {
          tieCount += 1;
          if (Math.random() < 1 / tieCount) best = c;
        }
      }
      const rest2 = eligible.filter((c) => c.instanceId !== best.instanceId).map((c) => c.instanceId);
      const sacResult = moveCreaturesToGraveyardAndTrigger(next, rest2, 'is sacrificed');
      next = sacResult.state;
      putVowCounter(currentId, best.instanceId);
      logLines.push(`${current.name} keeps ${getCardDefinition(best.defId).name} and puts a vow counter on it.`, ...sacResult.logLines);
      queue = rest;
      continue;
    }

    next = { ...next, pendingKeepOneSacrificeRest: { sourceInstanceId, remainingPlayerIds: queue } };
    return { state: next, logLines };
  }

  next = { ...next, pendingKeepOneSacrificeRest: null };
  return { state: next, logLines };
}

/** "That player chooses up to two creatures they control, then sacrifices
 * the rest" (Archfiend of Depravity) - the single-player, "keep up to N"
 * cousin of resolveKeepOneSacrificeRestQueue just above (no Vow counter, no
 * multi-player queue - always exactly the one player `controllerId` names).
 * Continued by engine/actions.ts: chooseUpToNCreaturesSacrificeRest once a
 * human player picks. */
export function resolveChooseUpToNCreaturesSacrificeRestQueue(
  state: GameState,
  sourceInstanceId: string,
  controllerId: string,
  keepCount: number
): { state: GameState; logLines: string[] } {
  let next = state;
  const logLines: string[] = [];
  const player = getPlayer(next, controllerId);
  const eligible = player.zones.battlefield.filter((c) => getCardDefinition(c.defId).type === 'creature');

  if (eligible.length <= keepCount) {
    logLines.push(`${player.name} controls ${eligible.length} creature(s) - nothing is sacrificed.`);
    return { state: next, logLines };
  }

  if (controllerId === 'ai') {
    const scored = eligible
      .map((c) => ({ c, score: effectivePower(getCardDefinition(c.defId), c, next, controllerId) + effectiveToughness(getCardDefinition(c.defId), c, next, controllerId) }))
      .sort((a, b) => b.score - a.score);
    const keepIds = new Set(scored.slice(0, keepCount).map((x) => x.c.instanceId));
    const sacIds = eligible.filter((c) => !keepIds.has(c.instanceId)).map((c) => c.instanceId);
    const sacResult = moveCreaturesToGraveyardAndTrigger(next, sacIds, 'is sacrificed');
    next = sacResult.state;
    logLines.push(`${player.name} keeps their best ${keepCount} creature(s) and sacrifices the rest.`, ...sacResult.logLines);
    return { state: next, logLines };
  }

  next = { ...next, pendingChooseUpToNCreaturesSacrificeRest: { sourceInstanceId, controllerId, keepCount, chosenInstanceIds: [] } };
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

/** Every "Search your library for a [X] card, ..." effect starts here -
 * shared by every SearchLibraryFor*Effect and CyclingAbility's own land
 * search (engine/actions.ts: cycleCard). If the controller's library has
 * nothing matching `filter` at all, this is a no-op search (shuffle,
 * "finds none") exactly like before - no point opening a picker over an
 * empty result. Otherwise it pauses on GameState.pendingLibrarySearch
 * (RESOLVE_LIBRARY_SEARCH) for the controller's own pick, or their choice
 * to find nothing anyway. */
export function beginLibrarySearch(
  state: GameState,
  playerId: string,
  sourceInstanceId: string,
  filter: LibrarySearchFilter,
  reveal: boolean,
  toBattlefieldTapped?: boolean,
  // "Search for up to N ... with different names" (Reach the Horizon) - see
  // GameState.pendingLibrarySearch's remainingPicks/excludeNames.
  remainingPicks?: number,
  excludeNames?: string[],
  toBattlefieldUntapped?: boolean,
  // "Search for up to N basic land cards" (Rampant Rejuvenator) - see
  // GameState.pendingLibrarySearch.allowDuplicateNames.
  allowDuplicateNames?: boolean,
  // "...you may put that card onto the battlefield tapped" (Scholar of New
  // Horizons) - see GameState.pendingLibrarySearch.mayChooseBattlefieldTapped.
  mayChooseBattlefieldTapped?: boolean
): { state: GameState; logLines: string[] } {
  const player = getPlayer(state, playerId);
  const hasMatch = player.zones.library.some((c) => matchesLibrarySearchFilter(getCardDefinition(c.defId), filter) && !excludeNames?.includes(getCardDefinition(c.defId).name));
  if (!hasMatch) {
    const next = updatePlayer(state, playerId, (p) => ({ ...p, zones: { ...p.zones, library: shuffle(p.zones.library) } }));
    return { state: next, logLines: [`${player.name} searches their library but finds nothing - shuffles.`] };
  }
  const next = {
    ...state,
    pendingLibrarySearch: {
      sourceInstanceId,
      controllerId: playerId,
      filter,
      reveal,
      toBattlefieldTapped,
      remainingPicks,
      excludeNames,
      toBattlefieldUntapped,
      allowDuplicateNames,
      mayChooseBattlefieldTapped,
    },
  };
  return { state: next, logLines: [`${player.name} searches their library.`] };
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

  // Drain GameState.pendingEquipmentDeathEffects (Skullclamp) - queued by
  // engine/combat.ts: moveCreaturesToGraveyard right before it severed the
  // attachment, since this is the first point after that where
  // resolveCardEffects is actually callable.
  if (next.pendingEquipmentDeathEffects.length > 0) {
    const queued = next.pendingEquipmentDeathEffects;
    next = { ...next, pendingEquipmentDeathEffects: [] };
    for (const entry of queued) {
      const resolved = resolveCardEffects(next, entry.controllerId, entry.effects, entry.sourceInstanceId);
      next = resolved.state;
      logLines.push(...resolved.logLines);
    }
  }

  // Drain GameState.pendingCreatureEnteredFromGraveyardEffects (Flayer of
  // the Hatebound) - same queue-and-drain shape as pendingEquipmentDeathEffects
  // just above, for the same circular-import reason.
  if (next.pendingCreatureEnteredFromGraveyardEffects.length > 0) {
    const queued = next.pendingCreatureEnteredFromGraveyardEffects;
    next = { ...next, pendingCreatureEnteredFromGraveyardEffects: [] };
    for (const entry of queued) {
      const resolved = resolveCardEffects(next, entry.controllerId, entry.effects, entry.sourceInstanceId);
      next = resolved.state;
      logLines.push(...resolved.logLines);
    }
  }

  for (const id of candidateInstanceIds) {
    const found = findCardAnywhere(next, id);
    if (!found || (found.zone !== 'graveyard' && found.zone !== 'commander')) {
      // A dying commander doesn't land in a real zone right away - its
      // owner's command-zone-or-graveyard choice is still pending (see
      // engine/combat.ts: beginCommanderZoneChoice), so findCardAnywhere
      // can't see it yet. Its printed onDeath (if any) still fires now,
      // same as any other death - only the two rarer INSTANCE-level onDeath
      // grants below (temporaryOnDeathReturnTapped/
      // temporaryOnDeathPutCountersEqualToPower) are skipped for it: both
      // need the card to actually be sitting in a graveyard array to react
      // to, which isn't true yet and won't necessarily ever be true (the
      // owner might choose the command zone instead) - a known gap for the
      // rare case of a commander carrying one of those grants when it dies.
      const pendingChoice = next.pendingCommanderZoneChoice;
      const pendingEntry =
        pendingChoice?.destinationCard.instanceId === id ? pendingChoice : pendingChoice?.queued.find((q) => q.destinationCard.instanceId === id);
      const pendingSelf = pendingEntry ? { card: pendingEntry.destinationCard, ownerId: pendingEntry.ownerId } : null;
      if (pendingSelf) {
        const pendingDef = getCardDefinition(pendingSelf.card.defId);
        if (pendingDef.onDeath && pendingDef.onDeath.length > 0) {
          const resolved = resolveCardEffects(next, pendingSelf.ownerId, pendingDef.onDeath, id);
          next = resolved.state;
          logLines.push(...resolved.logLines);
        }
      }
      continue;
    }
    const def = getCardDefinition(found.card.defId);
    if (def.onDeath && def.onDeath.length > 0) {
      const resolved = resolveCardEffects(next, found.ownerPlayerId, def.onDeath, id);
      next = resolved.state;
      logLines.push(...resolved.logLines);
    }
    // "Whenever a permanent you control leaves the battlefield, if it had
    // counters on it, put those counters on target permanent you control."
    // (Resourceful Defense) - a watcher on a SEPARATE permanent (not the
    // dying card's own def.onDeath), checked against every OTHER permanent
    // the dying card's owner controls. Snapshot the counters BEFORE this
    // card's own onDeath effects above had a chance to move it elsewhere
    // (findCardAnywhere again, re-checking it's still in the graveyard).
    const stillDead = findCardAnywhere(next, id);
    if (stillDead && stillDead.zone === 'graveyard' && stillDead.card.counters.length > 0) {
      const watcher = getPlayer(next, found.ownerPlayerId).zones.battlefield.find((c) => getCardDefinition(c.defId).onOwnPermanentDiesMoveCountersToTarget);
      const hasLegalTarget = getPlayer(next, found.ownerPlayerId).zones.battlefield.length > 0;
      if (watcher && hasLegalTarget) {
        next = {
          ...next,
          pendingTarget: {
            sourceInstanceId: watcher.instanceId,
            controllerId: found.ownerPlayerId,
            effect: { type: 'moveDeadPermanentCountersToTarget', counters: stillDead.card.counters },
          },
        };
        logLines.push(`${getCardDefinition(watcher.defId).name} triggers - choose a permanent to receive ${def.name}'s counters.`);
      }
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
    // "Gains 'When this creature dies, return that card to its owner's
    // hand' until end of turn" (Together Forever) - the "return to hand"
    // sibling of temporaryOnDeathReturnTapped just above: same "still
    // sitting in the graveyard" re-check, but reuses the SAME instance
    // (not a fresh one) since a hand card isn't a new game object the way a
    // battlefield re-entry is, matching this engine's existing graveyard-
    // to-hand convention (see engine/actions.ts: chooseTarget's
    // 'returnUpToTwoTargetPermanentsFromGraveyardToHand' branch).
    if (found.card.temporaryOnDeathReturnToHand) {
      const stillThere = findCardAnywhere(next, id);
      if (stillThere && stillThere.zone === 'graveyard') {
        const ownerId = stillThere.ownerPlayerId;
        next = updatePlayer(next, ownerId, (p) => ({
          ...p,
          zones: {
            ...p.zones,
            graveyard: p.zones.graveyard.filter((c) => c.instanceId !== id),
            hand: [...p.zones.hand, { ...stillThere.card, temporaryOnDeathReturnToHand: undefined }],
          },
        }));
        logLines.push(`${def.name} returns to its owner's hand.`);
      }
    }
    // "Gains 'When this creature dies, put a number of +1/+1 counters equal
    // to its power on up to one target creature'" (Galuf's Final Act) - same
    // "still sitting in the graveyard" re-check as temporaryOnDeathReturnTapped
    // above. The power is approximated from what's still on the dead
    // instance itself (printed power + counters + any still-marked
    // temporaryBuff) - equip/anthem bonuses that applied while it was alive
    // aren't recoverable once it's left the battlefield, so those are
    // dropped from the last-known-power estimate.
    if (found.card.temporaryOnDeathPutCountersEqualToPower) {
      const stillThere = findCardAnywhere(next, id);
      if (stillThere && stillThere.zone === 'graveyard') {
        const plus = stillThere.card.counters.find((c) => c.label === '+1/+1')?.amount ?? 0;
        const minus = stillThere.card.counters.find((c) => c.label === '-1/-1')?.amount ?? 0;
        const tempPower = stillThere.card.temporaryBuff?.power ?? 0;
        const amount = Math.max(0, (def.power ?? 0) + plus - minus + tempPower);
        if (amount > 0) {
          const resolved = resolveCardEffects(
            next,
            stillThere.ownerPlayerId,
            [{ type: 'putCounterOnUpToOneOwnCreature', counterLabel: '+1/+1', counterAmount: amount, anyController: true }],
            id
          );
          next = resolved.state;
          logLines.push(...resolved.logLines);
        }
      }
    }
    // "When this creature dies, draw a card." (granted by Blitz, Sabin,
    // Master Monk) - a PERSISTENT grant (not cleared at cleanup), checked
    // the same "still sitting in the graveyard" way as the TEMPORARY
    // grants above.
    if (found.card.grantsOnDeathDrawCardWhileBlitzed) {
      const stillThere = findCardAnywhere(next, id);
      if (stillThere && stillThere.zone === 'graveyard') {
        const owner = getPlayer(next, stillThere.ownerPlayerId);
        const drawn = owner.zones.library.slice(0, 1);
        next = updatePlayer(next, stillThere.ownerPlayerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(1), hand: [...p.zones.hand, ...drawn] } }));
        logLines.push(`${owner.name} draws a card (${def.name}'s Blitz).`);
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
  sourceInstanceId: string,
  // Whether the spell's Kicker cost was paid (see CardDefinition.kicker) -
  // only ever read by IfKickedEffect below; every other effect ignores it,
  // so ordinary (non-kicker) callers just omit it.
  wasKicked: boolean = false,
  // The chosen X value for a spell with {X} in its cost (Altered Ego) -
  // only ever read by becomeCopyOfAnyCreatureThenAddCounters below, to bake
  // the counter count into the pendingTarget it arms (see
  // engine/actions.ts: castCard, the only caller that ever has a real X to
  // pass here). Every other effect/caller ignores it.
  chosenX?: number,
  // "Each creature that convoked this spell connives." (Lethal Scheme) -
  // only ever read by conniveConvokingCreatures below, to know WHICH
  // creatures convoked (see engine/actions.ts: castCard, the only caller
  // that ever has real Convoke creatures to report). Every other
  // effect/caller ignores it.
  convokedInstanceIds?: string[],
  // The two ids exiled by CardAbility.cost.exileChosenCreatureCardsFromGraveyard
  // (Coin of Fate) - only ever read by
  // opponentChoosesOneOfExiledCardsToBottomRestReturnsTappedThenBecomeMonarch
  // below. See engine/actions.ts: activateAbility, the only caller that
  // ever has real exiled-cost ids to report.
  exiledCostInstanceIds?: string[]
): { state: GameState; logLines: string[] } {
  let next = state;
  const logLines: string[] = [];

  for (const effect of effects) {
    if (effect.type === 'createToken') {
      const tokenDef = getCardDefinition(effect.tokenId);
      const d20Roll = Math.floor(Math.random() * 20) + 1;
      const count =
        effect.count === 'perCreatureYouControl'
          ? getPlayer(next, playerId).zones.battlefield.filter((c) => getCardDefinition(c.defId).type === 'creature').length
          : effect.count === 'perCreatureCardInYourGraveyard'
            ? getPlayer(next, playerId).zones.graveyard.filter((c) => getCardDefinition(c.defId).type === 'creature').length
            : effect.count === 'chosenX'
              ? chosenX ?? 0
              : effect.count === 'd20Roll'
                ? d20Roll
                : effect.count ?? 1;
      if (effect.count === 'd20Roll') logLines.push(`${getPlayer(next, playerId).name} rolls a d20 and gets ${d20Roll}.`);

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
        // "...create a 1/1 white Human creature token that's tapped and
        // attacking that player..." (Hero of Light) - joins the
        // already-declared attack, same mechanism as
        // ReturnSelfFromGraveyardTappedAndAttackingEffect.
        if (effect.entersAttacking) {
          next = {
            ...next,
            declaredAttackers: [...next.declaredAttackers, ...tokens.map((t) => t.instanceId)],
            combatAssignments: [...next.combatAssignments, ...tokens.map((t) => ({ attackerInstanceId: t.instanceId, blockerInstanceIds: [] }))],
          };
        }
      }
    } else if (effect.type === 'attachAllControlledEquipmentToSelf') {
      const equipmentIds = getPlayer(next, playerId)
        .zones.battlefield.filter((c) => c.instanceId !== sourceInstanceId && !!getCardDefinition(c.defId).equipCost)
        .map((c) => c.instanceId);
      if (equipmentIds.length > 0) {
        const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
        next = updatePlayer(next, playerId, (p) => ({
          ...p,
          zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (equipmentIds.includes(c.instanceId) ? { ...c, attachedToInstanceId: sourceInstanceId } : c)) },
        }));
        logLines.push(`${sourceName} attaches all Equipment its controller controls to itself.`);
      }
    } else if (effect.type === 'attachSelfToFixedTarget') {
      const targetFound = findCardAnywhere(next, effect.targetInstanceId);
      if (!targetFound || targetFound.zone !== 'battlefield') {
        logLines.push("The target is no longer there to attach to.");
      } else {
        const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
        next = updatePlayer(next, playerId, (p) => ({
          ...p,
          zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === sourceInstanceId ? { ...c, attachedToInstanceId: effect.targetInstanceId } : c)) },
        }));
        logLines.push(`${sourceName} attaches itself to ${getCardDefinition(targetFound.card.defId).name}.`);
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
    } else if (effect.type === 'tapTargetThenCounterSelfByPowerDifferenceIfGreater') {
      const opponent = getOpponent(next, playerId);
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (opponent.zones.battlefield.filter((c) => getCardDefinition(c.defId).type === 'creature').length === 0) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'untapTargetAttacker') {
      const hasLegalTarget = next.declaredAttackers.some((id) => findCardAnywhere(next, id)?.zone === 'battlefield');
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'mug') {
      let anyLandMilled = false;
      let milledIds: string[] = [];
      for (const p of next.players) {
        const milled = p.zones.library.slice(0, 1);
        if (milled.length === 0) continue;
        next = updatePlayer(next, p.id, (pl) => ({ ...pl, zones: { ...pl.zones, library: pl.zones.library.slice(1), graveyard: [...pl.zones.graveyard, ...milled] } }));
        logLines.push(`${p.name} mills a card.`);
        if (getCardDefinition(milled[0].defId).type === 'land') anyLandMilled = true;
        milledIds.push(milled[0].instanceId);
      }
      if (anyLandMilled) {
        const token: CardInstance = {
          instanceId: nextInstanceId(),
          defId: 'token-treasure',
          ownerId: playerId,
          tapped: false,
          counters: [],
          damageMarked: 0,
          summoningSick: true,
          isToken: true,
        };
        next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, battlefield: [...p.zones.battlefield, token] } }));
        logLines.push(`${getPlayer(next, playerId).name} creates a Treasure token.`);
      }
      if (milledIds.length > 0) {
        next = { ...next, graveyardPlayGrants: [...next.graveyardPlayGrants, ...milledIds.map((instanceId) => ({ instanceId, playerId }))] };
      }
    } else if (effect.type === 'grantKeywordToAnotherTargetAttackingCreature') {
      const hasLegalTarget = next.declaredAttackers.some((id) => id !== sourceInstanceId && findCardAnywhere(next, id)?.zone === 'battlefield');
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'putStunCounterOnTargetAttacker') {
      const hasLegalTarget = next.declaredAttackers.some((id) => findCardAnywhere(next, id)?.zone === 'battlefield');
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'proliferate') {
      const hasLegalTarget = [...next.players[0].zones.battlefield, ...next.players[1].zones.battlefield].some((c) => c.counters.length > 0);
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s Proliferate has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect: { ...effect, alreadyChosen: [] } } };
      }
    } else if (effect.type === 'exileTargetOpponentCreatureUntilSourceLeaves') {
      const opponent = getOpponent(next, playerId);
      const hasLegalTarget = opponent.zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'creature');
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'tapUpToOneTargetCreatureAndStun') {
      const hasLegalTarget = [...next.players[0].zones.battlefield, ...next.players[1].zones.battlefield].some((c) => getCardDefinition(c.defId).type === 'creature');
      if (hasLegalTarget) {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'putCounterOnUpToTwoOwnCreatures') {
      const player = getPlayer(next, playerId);
      const hasLegalTarget = player.zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'creature');
      if (hasLegalTarget) {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'returnUpToTwoTargetPermanentsFromGraveyardToHand') {
      const player = getPlayer(next, playerId);
      const hasLegalTarget = player.zones.graveyard.some((c) => {
        const d = getCardDefinition(c.defId);
        return d.type === 'creature' || d.type === 'artifact' || d.type === 'enchantment' || d.type === 'land';
      });
      if (hasLegalTarget) {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'sacrificeOwnCreatureThenDraw') {
      const player = getPlayer(next, playerId);
      const hasLegalTarget = player.zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'creature');
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target - there's no creature to sacrifice.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'createTokenIfOpponentControlsCreatureWithPowerAtLeast') {
      const opponent = getOpponent(next, playerId);
      const qualifies = opponent.zones.battlefield.some((c) => {
        const d = getCardDefinition(c.defId);
        return d.type === 'creature' && effectivePower(d, c, next, opponent.id) >= effect.minPower;
      });
      if (qualifies) {
        const tokenDef = getCardDefinition(effect.tokenId);
        const tokens: CardInstance[] = Array.from({ length: effect.count }, () => ({
          instanceId: nextInstanceId(),
          defId: tokenDef.id,
          ownerId: playerId,
          tapped: false,
          counters: [],
          damageMarked: 0,
          summoningSick: true,
          isToken: true,
        }));
        next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, battlefield: [...p.zones.battlefield, ...tokens] } }));
        logLines.push(`${getPlayer(next, playerId).name} creates ${effect.count} ${tokenDef.name} token(s).`);
      }
    } else if (effect.type === 'bounceOpponentCreaturesWithGreatestManaValue') {
      const opponent = getOpponent(next, playerId);
      const creatures = opponent.zones.battlefield.filter((c) => getCardDefinition(c.defId).type === 'creature');
      if (creatures.length > 0) {
        const maxMv = Math.max(...creatures.map((c) => manaValue(parseCostLabel(getCardDefinition(c.defId).costLabel))));
        const toBounce = creatures.filter((c) => manaValue(parseCostLabel(getCardDefinition(c.defId).costLabel)) === maxMv);
        const toBounceIds = new Set(toBounce.map((c) => c.instanceId));
        let bounced = next;
        for (const c of toBounce) bounced = detachEverythingFrom(bounced, c.instanceId);
        bounced = updatePlayer(bounced, opponent.id, (p) => ({
          ...p,
          zones: {
            ...p.zones,
            battlefield: p.zones.battlefield.filter((c) => !toBounceIds.has(c.instanceId)),
            hand: [...p.zones.hand, ...toBounce.map((c) => ({ ...c, tapped: false, attachedToInstanceId: undefined, damageMarked: 0 }))],
          },
        }));
        next = bounced;
        logLines.push(`${opponent.name} returns ${toBounce.map((c) => getCardDefinition(c.defId).name).join(', ')} to hand (highest mana value).`);
      }
    } else if (effect.type === 'chooseOneAtRandom') {
      const index = Math.floor(Math.random() * effect.options.length);
      const resolved = resolveCardEffects(next, playerId, effect.options[index], sourceInstanceId, wasKicked, chosenX);
      next = resolved.state;
      logLines.push(...resolved.logLines);
    } else if (effect.type === 'revealUntilCreatureThenPutCountersEqualToManaValue') {
      const player = getPlayer(next, playerId);
      const revealed: CardInstance[] = [];
      let foundCreature: CardInstance | null = null;
      for (const c of player.zones.library) {
        revealed.push(c);
        if (getCardDefinition(c.defId).type === 'creature') {
          foundCreature = c;
          break;
        }
      }
      const rest = revealed.filter((c) => c.instanceId !== foundCreature?.instanceId);
      next = updatePlayer(next, playerId, (p) => ({
        ...p,
        zones: {
          ...p.zones,
          library: [...p.zones.library.slice(revealed.length), ...shuffle(rest)],
          hand: foundCreature ? [...p.zones.hand, foundCreature] : p.zones.hand,
        },
      }));
      if (foundCreature) {
        const mv = manaValue(parseCostLabel(getCardDefinition(foundCreature.defId).costLabel));
        logLines.push(`${player.name} reveals ${getCardDefinition(foundCreature.defId).name}, puts it into hand, and puts the rest on the bottom in a random order.`);
        const hasLegalTarget = getPlayer(next, playerId).zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'creature');
        if (mv > 0 && hasLegalTarget) {
          next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect: { ...effect, counterAmount: mv } } };
        }
      } else {
        logLines.push(`${player.name} reveals their whole library and finds no creature card.`);
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
    } else if (effect.type === 'playHideawayCard') {
      const owner = getPlayer(next, playerId);
      const sourceDef = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId);
      const selfNow = owner.zones.battlefield.find((c) => c.instanceId === sourceInstanceId);
      const hiddenId = selfNow?.hideawayExiledCardId;
      const hiddenCard = hiddenId ? owner.zones.exile.find((c) => c.instanceId === hiddenId) : undefined;
      if (!hiddenCard) {
        logLines.push(`${sourceDef.name} has nothing hidden away to play.`);
      } else {
        const hiddenDef = getCardDefinition(hiddenCard.defId);
        const isPermanent = hiddenDef.type === 'creature' || hiddenDef.type === 'artifact' || hiddenDef.type === 'enchantment' || hiddenDef.type === 'land';
        const hasHaste = hasKeyword(hiddenDef, 'haste');
        const movedCard = stripSagaProgress({
          ...hiddenCard,
          faceDown: undefined,
          tapped: isPermanent && !!hiddenDef.entersTapped,
          damageMarked: 0,
          summoningSick: hiddenDef.type === 'creature' ? !hasHaste : false,
        });
        next = updatePlayer(next, playerId, (p) => {
          const clearedBattlefield = p.zones.battlefield.map((c) => (c.instanceId === sourceInstanceId ? { ...c, hideawayExiledCardId: undefined } : c));
          const exile = p.zones.exile.filter((c) => c.instanceId !== hiddenId);
          return isPermanent
            ? { ...p, zones: { ...p.zones, exile, battlefield: [...clearedBattlefield, movedCard] } }
            : { ...p, zones: { ...p.zones, exile, battlefield: clearedBattlefield, graveyard: [...p.zones.graveyard, movedCard] } };
        });
        next = checkLegendRule(next, playerId);

        let playLogLines: string[] = [];
        const autoEffects = isPermanent ? hiddenDef.onEnter : hiddenDef.onCast;
        if (autoEffects && autoEffects.length > 0) {
          const resolved = resolveCardEffects(next, playerId, autoEffects, movedCard.instanceId);
          next = resolved.state;
          playLogLines = [...playLogLines, ...resolved.logLines];
        }
        if (isPermanent && hiddenDef.saga) {
          const sagaResult = triggerSagaLoreCounter(next, playerId, movedCard.instanceId);
          next = sagaResult.state;
          playLogLines = [...playLogLines, ...sagaResult.logLines];
        }
        if (hiddenDef.type === 'artifact') {
          const artifactWatchResult = triggerArtifactEnterWatchers(next, playerId);
          next = artifactWatchResult.state;
          playLogLines = [...playLogLines, ...artifactWatchResult.logLines];
        }
        if (!isPermanent) {
          const triggered = triggerNoncreatureCastAbilities(next, playerId, 0);
          next = triggered.state;
          playLogLines = [...playLogLines, ...triggered.logLines];
        }
        logLines.push(`${owner.name} plays ${hiddenDef.name} for free from ${sourceDef.name}'s hideaway.`, ...playLogLines);
      }
    } else if (effect.type === 'putCounterOnTargetOwnCreatureThenMayPlayHideawayIfCreaturePowerAtLeast') {
      const hasLegalTarget = getPlayer(next, playerId).zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'creature');
      if (!hasLegalTarget) {
        const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
        logLines.push(`${sourceName} has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
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
    } else if (effect.type === 'mayMoveAllCountersToTargetCreature') {
      const player = getPlayer(next, playerId);
      const source = player.zones.battlefield.find((c) => c.instanceId === sourceInstanceId);
      const sourceCounter = source?.counters.find((ctr) => ctr.label === effect.counterLabel);
      const hasOtherCreature = [...next.players.flatMap((p) => p.zones.battlefield)].some(
        (c) => c.instanceId !== sourceInstanceId && getCardDefinition(c.defId).type === 'creature'
      );
      if (!sourceCounter || sourceCounter.amount <= 0 || !hasOtherCreature) {
        // No-op: nothing to move, or nowhere to move it.
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'grantPreventCombatDamageConvertToCounterToTargetOwnCreature') {
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
    } else if (effect.type === 'grantAttacksCostUntilNextTurn') {
      const found = findCardAnywhere(next, sourceInstanceId);
      if (found && found.zone === 'battlefield') {
        next = updatePlayer(next, found.ownerPlayerId, (p) => ({
          ...p,
          zones: {
            ...p.zones,
            battlefield: p.zones.battlefield.map((c) => (c.instanceId === sourceInstanceId ? { ...c, attacksYouCostGenericUntilNextTurn: effect.amount } : c)),
          },
        }));
        logLines.push(
          `${getCardDefinition(found.card.defId).name}: until ${getPlayer(next, found.ownerPlayerId).name}'s next turn, creatures can't attack them unless their controller pays {${effect.amount}} for each of those creatures.`
        );
      }
    } else if (effect.type === 'untapSelfIfFirstCombatPhaseOfTurn') {
      if (next.combatPhaseNumberThisTurn === 1) {
        const found = findCardAnywhere(next, sourceInstanceId);
        if (found && found.zone === 'battlefield') {
          const subtype = effect.alsoUntapControlledSubtype?.toLowerCase();
          next = updatePlayer(next, found.ownerPlayerId, (p) => ({
            ...p,
            zones: {
              ...p.zones,
              battlefield: p.zones.battlefield.map((c) =>
                c.instanceId === sourceInstanceId || (subtype && getCardDefinition(c.defId).subtype?.toLowerCase().includes(subtype)) ? { ...c, tapped: false } : c
              ),
            },
          }));
          logLines.push(`${getCardDefinition(found.card.defId).name} untaps${subtype ? ` and all ${effect.alsoUntapControlledSubtype} you control` : ''}.`);
        }
      }
    } else if (effect.type === 'untapAllControlledCreatures') {
      const player = getPlayer(next, playerId);
      next = updatePlayer(next, playerId, (p) => ({
        ...p,
        zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (getCardDefinition(c.defId).type === 'creature' ? { ...c, tapped: false } : c)) },
      }));
      logLines.push(`${player.name} untaps all creatures they control.`);
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
    } else if (effect.type === 'addOneManaOfChosenColor') {
      next = { ...next, pendingAddManaOfChosenColor: { controllerId: playerId, amount: effect.amount } };
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
    } else if (effect.type === 'eachPlayerSacrificesHalfRoundedDown') {
      // Unlike eachPlayerSacrifices (always exactly one per player), the
      // COUNT here is computed separately per player from their own board,
      // so the sacrifice queue can have a different number of entries for
      // each player - queuing a playerId N times means "pick N times".
      const queue: string[] = [];
      for (const p of next.players) {
        const eligibleCount = p.zones.battlefield.filter((c) => matchesSacrificeFilter(getCardDefinition(c.defId), c, effect.filter)).length;
        const toSacrifice = Math.floor(eligibleCount / 2);
        for (let i = 0; i < toSacrifice; i++) queue.push(p.id);
      }
      const result = resolveSacrificeQueue(next, sourceInstanceId, queue, effect.filter);
      next = result.state;
      logLines.push(...result.logLines);
    } else if (effect.type === 'eachPlayerKeepOneCreatureSacrificeRest') {
      const result = resolveKeepOneSacrificeRestQueue(
        next,
        sourceInstanceId,
        next.players.map((p) => p.id)
      );
      next = result.state;
      logLines.push(...result.logLines);
    } else if (effect.type === 'chooseUpToNCreaturesSacrificeRest') {
      const result = resolveChooseUpToNCreaturesSacrificeRestQueue(next, sourceInstanceId, playerId, effect.keepCount);
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
    } else if (effect.type === 'returnTargetAuraOrEquipmentFromGraveyardToHand') {
      const player = getPlayer(next, playerId);
      const eligible = player.zones.graveyard.filter((c) => {
        const d = getCardDefinition(c.defId);
        return d.subtype?.toLowerCase().includes('aura') || d.subtype?.toLowerCase().includes('equipment');
      });
      if (eligible.length === 0) {
        logLines.push(`${player.name} has no Aura or Equipment card in their graveyard to return.`);
      } else {
        next = { ...next, pendingReturnFromGraveyard: { sourceInstanceId, controllerId: playerId, filter: 'auraOrEquipment' } };
      }
    } else if (effect.type === 'returnTargetNonAssassinHistoricFromGraveyardToHand') {
      const player = getPlayer(next, playerId);
      const eligible = player.zones.graveyard.filter((c) => {
        const d = getCardDefinition(c.defId);
        const isHistoric = d.type === 'artifact' || !!d.saga || !!d.subtype?.toLowerCase().includes('legendary');
        const isAssassin = !!d.subtype?.toLowerCase().includes('assassin');
        return isHistoric && !isAssassin;
      });
      if (eligible.length === 0) {
        logLines.push(`${player.name} has no non-Assassin historic card in their graveyard to return.`);
      } else {
        next = { ...next, pendingReturnFromGraveyard: { sourceInstanceId, controllerId: playerId, filter: 'nonAssassinHistoric' } };
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
    } else if (effect.type === 'armManaIdentitySourceScry') {
      next = { ...next, pendingManaIdentitySourceScry: { controllerId: playerId } };
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
    } else if (effect.type === 'explore') {
      const player = getPlayer(next, playerId);
      const topCard = player.zones.library[0];
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!topCard) {
        logLines.push(`${sourceName} explores, but ${player.name}'s library is empty.`);
      } else {
        const topDef = getCardDefinition(topCard.defId);
        if (topDef.type === 'land') {
          next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(1), hand: [...p.zones.hand, topCard] } }));
          logLines.push(`${sourceName} explores and finds ${topDef.name} - a land, straight to hand.`);
        } else {
          next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(1) } }));
          const counterAmount = hardenedScalesAdjustedAmount(next, playerId, '+1/+1', 1);
          next = updatePlayer(next, playerId, (p) => ({
            ...p,
            zones: {
              ...p.zones,
              battlefield: p.zones.battlefield.map((c) => {
                if (c.instanceId !== sourceInstanceId) return c;
                const hasCounter = c.counters.some((ctr) => ctr.label === '+1/+1');
                const counters = hasCounter
                  ? c.counters.map((ctr) => (ctr.label === '+1/+1' ? { ...ctr, amount: ctr.amount + counterAmount } : ctr))
                  : [...c.counters, { label: '+1/+1', amount: counterAmount }];
                return { ...c, counters };
              }),
            },
          }));
          const sideEffects = applyCounterPlacementSideEffects(next, playerId, sourceInstanceId, '+1/+1');
          next = sideEffects.state;
          next = { ...next, pendingExplore: { sourceInstanceId, controllerId: playerId, revealedCard: topCard } };
          logLines.push(`${sourceName} explores, finds a nonland card, and gets a +1/+1 counter.`, ...sideEffects.logLines);
        }
      }
    } else if (effect.type === 'destroyTarget') {
      // "Revolt" (Fatal Push) checks whether a permanent left the
      // battlefield under the CASTER's control this turn, not the target's
      // owner's - so this reads getPlayer(next, playerId), not the `p` being
      // iterated over below.
      const revoltActive = getPlayer(next, playerId).permanentLeftBattlefieldThisTurn ?? false;
      const hasLegalTarget = next.players.some((p) =>
        p.zones.battlefield.some((c) => {
          const d = getCardDefinition(c.defId);
          const isFlyingCreature = d.type === 'creature' && hasKeyword(d, 'flying');
          return (
            effect.targetFilter === 'anyPermanent' ||
            (effect.targetFilter === 'nonlandPermanent' && d.type !== 'land') ||
            (effect.targetFilter === 'creatureWithMinPower' && d.type === 'creature' && effectivePower(d, c, next, p.id) >= (effect.minPower ?? 0)) ||
            (effect.targetFilter === 'creatureWithMinToughness' && d.type === 'creature' && effectiveToughness(d, c, next, p.id) >= (effect.minToughness ?? 0)) ||
            (effect.targetFilter === 'artifactEnchantmentOrFlyingCreature' && (d.type === 'artifact' || d.type === 'enchantment' || isFlyingCreature)) ||
            (effect.targetFilter === 'artifactOrEnchantment' && (d.type === 'artifact' || d.type === 'enchantment')) ||
            (effect.targetFilter === 'enchantment' && d.type === 'enchantment') ||
            (effect.targetFilter === 'creatureWithDamageMarked' && d.type === 'creature' && c.damageMarked > 0) ||
            (effect.targetFilter === 'land' && d.type === 'land') ||
            (effect.targetFilter === 'creature' && d.type === 'creature') ||
            (effect.targetFilter === 'opponentArtifactOrLand' && (d.type === 'artifact' || d.type === 'land') && p.id !== playerId) ||
            (effect.targetFilter === 'tappedCreature' && d.type === 'creature' && c.tapped) ||
            (effect.targetFilter === 'opponentNonlandPermanent' && d.type !== 'land' && p.id !== playerId) ||
            (effect.targetFilter === 'opponentNonbasicLand' && isNonbasicLand(d) && p.id !== playerId) ||
            (effect.targetFilter === 'artifactOrCreature' && (d.type === 'artifact' || d.type === 'creature')) ||
            (effect.targetFilter === 'creatureOrEnchantment' && (d.type === 'creature' || d.type === 'enchantment')) ||
            (effect.targetFilter === 'opponentArtifact' && d.type === 'artifact' && p.id !== playerId) ||
            (effect.targetFilter === 'nonblackCreature' && d.type === 'creature' && !parseCostLabel(d.costLabel).colors.B) ||
            (effect.targetFilter === 'artifact' && d.type === 'artifact') ||
            (effect.targetFilter === 'creatureWithManaValueAtMostRevolt' &&
              d.type === 'creature' &&
              manaValue(parseCostLabel(d.costLabel)) <= (revoltActive ? effect.revoltManaValue ?? 0 : effect.maxManaValue ?? 0))
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
    } else if (effect.type === 'destroyArtifactCreatureEnchantmentAndLand') {
      // "Destroy target artifact, target creature, target enchantment, and
      // target land." (Decimate) - arms the first of the four filters (in
      // this order) that actually has a legal target anywhere, queuing the
      // rest via DestroyTargetEffect.thenDestroyFilterQueue. A type with no
      // legal target is simply skipped, never asked about - see
      // DestroyArtifactCreatureEnchantmentAndLandEffect's own doc comment.
      const order: ('artifact' | 'creature' | 'enchantment' | 'land')[] = ['artifact', 'creature', 'enchantment', 'land'];
      const hasAnyOfType = (t: 'artifact' | 'creature' | 'enchantment' | 'land') => next.players.some((p) => p.zones.battlefield.some((c) => getCardDefinition(c.defId).type === t));
      const firstIndex = order.findIndex((t) => hasAnyOfType(t));
      if (firstIndex === -1) {
        const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
        logLines.push(`${sourceName} has no legal target of any of its four types.`);
      } else {
        next = {
          ...next,
          pendingTarget: {
            sourceInstanceId,
            controllerId: playerId,
            effect: { type: 'destroyTarget', targetFilter: order[firstIndex], thenDestroyFilterQueue: order.slice(firstIndex + 1) },
          },
        };
      }
    } else if (effect.type === 'bounceTarget') {
      const hasLegalTarget = [...next.players[0].zones.battlefield, ...next.players[1].zones.battlefield].some((c) =>
        effect.targetFilter === 'creature' ? getCardDefinition(c.defId).type === 'creature' : getCardDefinition(c.defId).type !== 'land'
      );
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
    } else if (effect.type === 'returnControlledLandToHand') {
      const player = getPlayer(next, playerId);
      const hasLand = player.zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'land');
      if (!hasLand) {
        logLines.push(`${player.name} has no land to return to hand.`);
      } else {
        next = { ...next, pendingLandBounce: { sourceInstanceId, controllerId: playerId } };
      }
    } else if (effect.type === 'exileTopOfLibraryPlayableWhileControllingSource') {
      const player = getPlayer(next, playerId);
      const top = player.zones.library[0];
      if (!top) {
        logLines.push(`${player.name} has no cards left to exile.`);
      } else {
        next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(1), exile: [...p.zones.exile, top] } }));
        next = { ...next, exilePlayGrants: [...next.exilePlayGrants, { instanceId: top.instanceId, playerId, requiresControlOfInstanceId: sourceInstanceId }] };
        const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
        logLines.push(`${player.name} exiles ${getCardDefinition(top.defId).name} - they may play it for as long as they control ${sourceName}.`);
      }
    } else if (effect.type === 'exileTopOfLibraryPlayableUntilAnotherExiledWithSourceIfControlCreaturePowerAtLeast') {
      const player = getPlayer(next, playerId);
      const qualifies = player.zones.battlefield.some((c) => {
        const d = getCardDefinition(c.defId);
        return d.type === 'creature' && effectivePower(d, c, next, playerId) >= effect.minPower;
      });
      if (!qualifies) {
        logLines.push(`${player.name} doesn't control a creature with power ${effect.minPower} or greater.`);
      } else {
        const top = player.zones.library[0];
        if (!top) {
          logLines.push(`${player.name} has no cards left to exile.`);
        } else {
          next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(1), exile: [...p.zones.exile, top] } }));
          // Replaces (doesn't stack with) any still-outstanding grant from
          // this same source - "until you exile another card with this
          // enchantment" invalidates the previous one.
          next = {
            ...next,
            exilePlayGrants: [...next.exilePlayGrants.filter((g) => g.requiresControlOfInstanceId !== sourceInstanceId), { instanceId: top.instanceId, playerId, requiresControlOfInstanceId: sourceInstanceId }],
          };
          const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
          logLines.push(`${player.name} exiles ${getCardDefinition(top.defId).name} - they may play it until they exile another card with ${sourceName}.`);
        }
      }
    } else if (effect.type === 'exileTopOfLibraryFaceDownTaggedWithSource') {
      const player = getPlayer(next, playerId);
      const top = player.zones.library[0];
      if (!top) {
        logLines.push(`${player.name} has no cards left to exile.`);
      } else {
        const exiledCard = { ...top, faceDown: true, exiledFaceDownBySourceInstanceId: sourceInstanceId };
        next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(1), exile: [...p.zones.exile, exiledCard] } }));
        logLines.push(`${player.name} exiles the top card of their library face down.`);
      }
    } else if (effect.type === 'grantTemporaryPlayPermissionForFaceDownExiledBySource') {
      const player = getPlayer(next, playerId);
      const matching = player.zones.exile.filter((c) => c.exiledFaceDownBySourceInstanceId === sourceInstanceId);
      if (matching.length === 0) {
        const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
        logLines.push(`${player.name} has no cards exiled with ${sourceName} to play.`);
      } else {
        const existingIds = new Set(next.exilePlayGrants.filter((g) => g.playerId === playerId).map((g) => g.instanceId));
        const newGrants = matching.filter((c) => !existingIds.has(c.instanceId)).map((c) => ({ instanceId: c.instanceId, playerId, expiresAtCleanup: true, costReduction: effect.costReduction }));
        next = { ...next, exilePlayGrants: [...next.exilePlayGrants, ...newGrants] };
        logLines.push(`${player.name} may play ${matching.length} card(s) exiled with it until end of turn.`);
      }
    } else if (effect.type === 'exileTopOfTargetPlayerLibraryThenOptionalSacrificeToPlay') {
      const opponent = getOpponent(next, playerId);
      const top = opponent.zones.library[0];
      if (!top) {
        logLines.push(`${opponent.name} has no cards left to exile.`);
      } else {
        next = updatePlayer(next, opponent.id, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(1), exile: [...p.zones.exile, top] } }));
        logLines.push(`${getPlayer(next, playerId).name} exiles ${getCardDefinition(top.defId).name} from ${opponent.name}'s library.`);
        const controller = getPlayer(next, playerId);
        const hasEligibleSacrifice = controller.zones.battlefield.some(
          (c) => c.instanceId !== sourceInstanceId && matchesSacrificeFilter(getCardDefinition(c.defId), c, 'creatureOrArtifact')
        );
        if (!hasEligibleSacrifice) {
          logLines.push(`${controller.name} has no other creature or artifact to sacrifice.`);
        } else {
          next = { ...next, pendingOptionalSacrificeForExilePlay: { sourceInstanceId, controllerId: playerId, exiledInstanceId: top.instanceId } };
        }
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
      const remainingPicks = effect.count && effect.count > 1 ? effect.count - 1 : undefined;
      const result = beginLibrarySearch(
        next,
        playerId,
        sourceInstanceId,
        { kind: 'landByName', name: effect.landName },
        true,
        undefined,
        remainingPicks,
        undefined,
        effect.toBattlefieldUntapped,
        remainingPicks ? true : undefined
      );
      next = result.state;
      logLines.push(...result.logLines);
    } else if (effect.type === 'searchLibraryForBasicLand') {
      const result = beginLibrarySearch(next, playerId, sourceInstanceId, { kind: 'basicLand' }, true, effect.toBattlefieldTapped, undefined, effect.excludeNames);
      next = result.state;
      logLines.push(...result.logLines);
    } else if (effect.type === 'searchLibraryForAnyLand') {
      const result = beginLibrarySearch(next, playerId, sourceInstanceId, { kind: 'anyLand' }, true);
      next = result.state;
      logLines.push(...result.logLines);
    } else if (effect.type === 'searchLibraryForBasicLandOrSubtype') {
      const remainingPicks = effect.count && effect.count > 1 ? effect.count - 1 : undefined;
      const result = beginLibrarySearch(next, playerId, sourceInstanceId, { kind: 'basicLandOrSubtype', subtype: effect.subtype }, true, effect.toBattlefieldTapped, remainingPicks);
      next = result.state;
      logLines.push(...result.logLines);
    } else if (effect.type === 'pumpTarget') {
      const pumpCandidates = effect.restrictToOwnCreature ? getPlayer(next, playerId).zones.battlefield : [...next.players[0].zones.battlefield, ...next.players[1].zones.battlefield];
      const hasLegalTarget = pumpCandidates.some((c) => getCardDefinition(c.defId).type === 'creature');
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'grantKeywordsToTargetPermanent') {
      const hasLegalTarget = [...next.players[0].zones.battlefield, ...next.players[1].zones.battlefield].length > 0;
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'grantTemporaryKeywordToSelf') {
      next = grantTemporaryKeyword(next, sourceInstanceId, effect.keyword);
      const sourceDef = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId);
      logLines.push(`${sourceDef.name} gains ${effect.keyword} until end of turn.`);
    } else if (effect.type === 'grantIndestructibleToTargetWhileSourceInPlay') {
      const player = getPlayer(next, playerId);
      const hasLegalTarget = player.zones.battlefield.some(
        (c) => c.instanceId !== sourceInstanceId && getCardDefinition(c.defId).subtype?.toLowerCase().includes('legendary')
      );
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'grantKeywordsToControlledPermanents') {
      const player = getPlayer(next, playerId);
      for (const c of player.zones.battlefield) {
        for (const keyword of effect.keywords) {
          next = grantTemporaryKeyword(next, c.instanceId, keyword);
        }
      }
      if (player.zones.battlefield.length > 0) {
        logLines.push(`Permanents ${player.name} controls gain ${effect.keywords.join(' and ')} until end of turn.`);
      }
    } else if (effect.type === 'gainControlOfTargetCreature') {
      const candidates = effect.opponentControlledOnly ? getOpponent(next, playerId).zones.battlefield : [...next.players[0].zones.battlefield, ...next.players[1].zones.battlefield];
      const hasLegalTarget = candidates.some((c) => getCardDefinition(c.defId).type === 'creature');
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'giveControlOfAnotherOwnPermanentToOpponent') {
      const player = getPlayer(next, playerId);
      const hasLegalTarget = player.zones.battlefield.some((c) => c.instanceId !== sourceInstanceId);
      if (!hasLegalTarget) {
        const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
        logLines.push(`${sourceName} has no other permanent to give away.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'gainControlOfTargetEquipmentAndAttach') {
      const player = getPlayer(next, playerId);
      const hasOwnCreature = player.zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'creature');
      const hasEquipment = [...next.players[0].zones.battlefield, ...next.players[1].zones.battlefield].some((c) => getCardDefinition(c.defId).subtype?.toLowerCase().includes('equipment'));
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasOwnCreature || !hasEquipment) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'setPendingNextCreatureSpellBonus') {
      next = { ...next, pendingNextCreatureSpellBonus: { controllerId: playerId, counterLabel: effect.counterLabel, counterAmount: effect.counterAmount, grantsHaste: effect.grantsHaste } };
      logLines.push(`${getPlayer(next, playerId).name}'s next creature spell this turn gets a bonus.`);
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
    } else if (effect.type === 'eachOpponentLosesLife') {
      const opponent = getOpponent(next, playerId);
      const amount = effect.amount === 'chosenX' ? chosenX ?? 0 : effect.amount;
      next = updatePlayer(next, opponent.id, (p) => ({ ...p, life: p.life - amount }));
      logLines.push(`${opponent.name} loses ${amount} life.`);
      if (effect.gainLifeEqualToLifeLost) {
        next = addLife(next, playerId, amount);
        logLines.push(`${getPlayer(next, playerId).name} gains ${amount} life.`);
      }
    } else if (effect.type === 'eachOpponentDrawsThenCasterDrawsForEachWhoDid') {
      const opponent = getOpponent(next, playerId);
      const opponentDrawn = opponent.zones.library.slice(0, 1);
      next = updatePlayer(next, opponent.id, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(1), hand: [...p.zones.hand, ...opponentDrawn] } }));
      logLines.push(opponentDrawn.length > 0 ? `${opponent.name} draws a card.` : `${opponent.name}'s library is empty.`);
      if (opponentDrawn.length > 0) {
        const player = getPlayer(next, playerId);
        const casterDrawn = player.zones.library.slice(0, 1);
        next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(1), hand: [...p.zones.hand, ...casterDrawn] } }));
        logLines.push(`${player.name} draws a card.`);
      }
    } else if (effect.type === 'pumpControlledSubtype') {
      const player = getPlayer(next, playerId);
      const matching = player.zones.battlefield.filter((c) => {
        const d = getCardDefinition(c.defId);
        return d.type === 'creature' && (!!d.subtype?.toLowerCase().includes(effect.subtype.toLowerCase()) || hasGrantedSubtype(next, playerId, c.instanceId, effect.subtype));
      });
      for (const c of matching) {
        next = applyTemporaryBuff(next, c.instanceId, effect.power, effect.toughness);
        if (effect.grantKeyword) next = grantTemporaryKeyword(next, c.instanceId, effect.grantKeyword);
      }
      if (matching.length > 0) {
        const keywordNote = effect.grantKeyword ? ` and gain ${effect.grantKeyword}` : '';
        logLines.push(`${effect.subtype}s you control get +${effect.power}/+${effect.toughness}${keywordNote} until end of turn.`);
      }
    } else if (effect.type === 'putCounterOnEachControlledCreatureMatchingSubtype') {
      const player = getPlayer(next, playerId);
      const matching = player.zones.battlefield.filter((c) => {
        if (effect.excludeSelf && c.instanceId === sourceInstanceId) return false;
        const d = getCardDefinition(c.defId);
        return d.type === 'creature' && (!!d.subtype?.toLowerCase().includes(effect.subtype.toLowerCase()) || hasGrantedSubtype(next, playerId, c.instanceId, effect.subtype));
      });
      const { counterLabel, grantKeyword } = effect;
      for (const c of matching) {
        const counterAmount = hardenedScalesAdjustedAmount(next, playerId, counterLabel, effect.counterAmount);
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
        const sideEffects = applyCounterPlacementSideEffects(next, playerId, c.instanceId, counterLabel);
        next = sideEffects.state;
        logLines.push(...sideEffects.logLines);
        if (grantKeyword) next = grantTemporaryKeyword(next, c.instanceId, grantKeyword);
      }
      if (matching.length > 0) {
        const keywordNote = grantKeyword ? ` They gain ${grantKeyword} until end of turn.` : '';
        logLines.push(`Each ${effect.subtype} creature ${player.name} controls gets a ${counterLabel} counter.${keywordNote}`);
      }
    } else if (effect.type === 'putCounterOnTarget') {
      const hasLegalTarget = [...next.players[0].zones.battlefield, ...next.players[1].zones.battlefield].some((c) => getCardDefinition(c.defId).type === 'creature');
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'putCounterOnTargetLand') {
      const hasLegalTarget = [...next.players[0].zones.battlefield, ...next.players[1].zones.battlefield].some((c) => getCardDefinition(c.defId).type === 'land');
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'putCounterOnTargetCommanderEnteredThisTurn') {
      const hasLegalTarget = next.players.some((owner) =>
        owner.zones.battlefield.some((c) => !!owner.commanderDefId && frontFaceDefId(c.defId) === owner.commanderDefId && c.summoningSick)
      );
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
    } else if (effect.type === 'chooseCreatureDealsDamageToOpponentCreature') {
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
    } else if (effect.type === 'ifKicked') {
      const chosen = wasKicked ? effect.thenEffects : effect.elseEffects;
      const resolved = resolveCardEffects(next, playerId, chosen, sourceInstanceId, wasKicked);
      next = resolved.state;
      logLines.push(...resolved.logLines);
    } else if (effect.type === 'ifControlAtLeastCreatures') {
      const creatureCount = getPlayer(next, playerId).zones.battlefield.filter((c) => getCardDefinition(c.defId).type === 'creature').length;
      const chosen = creatureCount >= effect.count ? effect.thenEffects : effect.elseEffects;
      const resolved = resolveCardEffects(next, playerId, chosen, sourceInstanceId, wasKicked);
      next = resolved.state;
      logLines.push(...resolved.logLines);
    } else if (effect.type === 'ifControlCreatureWithPowerAtLeast') {
      const hasBigCreature = getPlayer(next, playerId).zones.battlefield.some((c) => {
        const d = getCardDefinition(c.defId);
        return d.type === 'creature' && effectivePower(d, c, next, playerId) >= effect.minPower;
      });
      const chosen = hasBigCreature ? effect.thenEffects : effect.elseEffects;
      const resolved = resolveCardEffects(next, playerId, chosen, sourceInstanceId, wasKicked);
      next = resolved.state;
      logLines.push(...resolved.logLines);
    } else if (effect.type === 'searchLibraryOrGraveyardForArtifact') {
      const player = getPlayer(next, playerId);
      const matches = (c: CardInstance) => {
        const d = getCardDefinition(c.defId);
        return d.type === 'artifact' && manaValue(parseCostLabel(d.costLabel)) <= effect.maxManaValue;
      };
      const hasMatch = player.zones.library.some(matches) || player.zones.graveyard.some(matches);
      if (!hasMatch) {
        logLines.push(`${player.name} searches their library and graveyard but finds nothing.`);
      } else {
        next = { ...next, pendingLibraryOrGraveyardSearch: { sourceInstanceId, controllerId: playerId, maxManaValue: effect.maxManaValue } };
        logLines.push(`${player.name} searches their library and graveyard.`);
      }
    } else if (effect.type === 'millThenPutCreaturesOntoBattlefield') {
      const shuffled = { ...next, players: next.players.map((p) => (p.id === playerId ? { ...p, zones: { ...p.zones, library: shuffle(p.zones.library) } } : p)) } as GameState;
      next = shuffled;
      const player = getPlayer(next, playerId);
      const milled = player.zones.library.slice(0, effect.millCount);
      const rest = player.zones.library.slice(effect.millCount);
      const creatureCards = milled.filter((c) => getCardDefinition(c.defId).type === 'creature');
      const nonCreatureCards = milled.filter((c) => getCardDefinition(c.defId).type !== 'creature');
      const placed = creatureCards.map((c) => ({ ...c, tapped: false, damageMarked: 0, summoningSick: !effect.grantsHaste }));
      next = updatePlayer(next, playerId, (p) => ({
        ...p,
        zones: { ...p.zones, library: rest, graveyard: [...p.zones.graveyard, ...nonCreatureCards], battlefield: [...p.zones.battlefield, ...placed] },
      }));
      logLines.push(
        `${player.name} mills ${milled.length} card(s), putting ${placed.length} creature(s) onto the battlefield${effect.grantsHaste ? ' with haste' : ''}.`
      );
      if (effect.thenReturnToHandAtNextEndStep && placed.length > 0) {
        next = {
          ...next,
          pendingDelayedEndStepEffects: [
            ...next.pendingDelayedEndStepEffects,
            { controllerId: playerId, sourceInstanceId, effects: [{ type: 'returnSpecificInstancesToOwnersHand', instanceIds: placed.map((c) => c.instanceId) }] },
          ],
        };
      }
    } else if (effect.type === 'returnSpecificInstancesToOwnersHand') {
      for (const id of effect.instanceIds) {
        const found = findCardAnywhere(next, id);
        if (!found || found.zone !== 'battlefield') continue;
        const def = getCardDefinition(found.card.defId);
        next = detachEverythingFrom(next, id);
        next = updatePlayer(next, found.ownerPlayerId, (p) => ({
          ...p,
          zones: {
            ...p.zones,
            battlefield: p.zones.battlefield.filter((c) => c.instanceId !== id),
            hand: [...p.zones.hand, { ...found.card, tapped: false, attachedToInstanceId: undefined, damageMarked: 0 }],
          },
        }));
        logLines.push(`${def.name} returns to ${getPlayer(next, found.ownerPlayerId).name}'s hand.`);
      }
    } else if (effect.type === 'queueEffectsAtNextEndStep') {
      next = { ...next, pendingDelayedEndStepEffects: [...next.pendingDelayedEndStepEffects, { controllerId: playerId, sourceInstanceId, effects: effect.effects }] };
    } else if (effect.type === 'grantTemporaryNoncreatureCastCreatesTokenCopy') {
      next = updatePlayer(next, playerId, (p) => ({ ...p, temporaryNoncreatureCastCreatesTokenCopyUntilEndOfTurn: true }));
      logLines.push(`${getPlayer(next, playerId).name} will create a token copy whenever they cast a noncreature spell this turn.`);
    } else if (effect.type === 'exileTopOfLibraryPlayableUntilCleanup') {
      if (effect.shuffleFirst) {
        next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: shuffle(p.zones.library) } }));
      }
      const player = getPlayer(next, playerId);
      const toExile = player.zones.library.slice(0, effect.count);
      if (toExile.length === 0) {
        logLines.push(`${player.name} has no cards left to exile.`);
      } else {
        next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(effect.count), exile: [...p.zones.exile, ...toExile] } }));
        next = {
          ...next,
          exilePlayGrants: [
            ...next.exilePlayGrants,
            ...toExile.map((c) => ({ instanceId: c.instanceId, playerId, expiresAtCleanup: true, ...(effect.free ? { overrideCostLabel: '{0}' } : {}) })),
          ],
        };
        const freeNote = effect.free ? ', without paying their mana cost' : '';
        logLines.push(`${player.name} exiles ${toExile.length} card(s) - they may play them until their next end step${freeNote}.`);
      }
    } else if (effect.type === 'scryThenExileTopPlayableThisTurnThenPumpTargetByExiledManaValue') {
      const player = getPlayer(next, playerId);
      if (player.zones.library.length === 0) {
        logLines.push(`${player.name}'s library is empty - Lucky Slots does nothing.`);
      } else {
        next = { ...next, pendingScryBeforeExile: { sourceInstanceId, controllerId: playerId } };
      }
    } else if (effect.type === 'pumpUpToTwoTargets') {
      const hasLegalTarget = [...next.players[0].zones.battlefield, ...next.players[1].zones.battlefield].some((c) => getCardDefinition(c.defId).type === 'creature');
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'putLandFromHandOntoBattlefield') {
      const player = getPlayer(next, playerId);
      const hasLand = player.zones.hand.some((c) => getCardDefinition(c.defId).type === 'land');
      if (!hasLand) {
        logLines.push(`${player.name} has no land in hand to put onto the battlefield.`);
      } else {
        next = { ...next, pendingPutLandFromHand: { sourceInstanceId, controllerId: playerId } };
      }
    } else if (effect.type === 'mayPutTopLandOntoBattlefieldTapped') {
      const player = getPlayer(next, playerId);
      const topCard = player.zones.library[0];
      const topDef = topCard ? getCardDefinition(topCard.defId) : null;
      if (!topCard || !topDef || topDef.type !== 'land') {
        logLines.push(`${player.name} looks at the top card of their library - it's not a land.`);
      } else {
        next = { ...next, pendingMayPutTopLandOntoBattlefieldTapped: { sourceInstanceId, controllerId: playerId } };
      }
    } else if (effect.type === 'setBasePowerUntilEndOfTurnToControlledSubtypeCount') {
      const player = getPlayer(next, playerId);
      const count = player.zones.battlefield.filter((c) => getCardDefinition(c.defId).subtype?.toLowerCase().includes(effect.subtype.toLowerCase())).length;
      const source = findCardAnywhere(next, sourceInstanceId)!;
      const sourceDef = getCardDefinition(source.card.defId);
      next = updatePlayer(next, playerId, (p) => ({
        ...p,
        zones: {
          ...p.zones,
          battlefield: p.zones.battlefield.map((c) => (c.instanceId === sourceInstanceId ? { ...c, temporaryBaseStats: { power: count, toughness: sourceDef.toughness ?? 0 } } : c)),
        },
      }));
      logLines.push(`${sourceDef.name}'s base power becomes ${count} until end of turn.`);
    } else if (effect.type === 'castTargetInstantOrSorceryFromGraveyardAnyMana') {
      const eligibleTypes = effect.instantOnly ? ['instant'] : ['instant', 'sorcery'];
      const graveyardsToSearch = effect.ownGraveyardOnly ? [getPlayer(next, playerId)] : next.players;
      const hasLegalTarget = graveyardsToSearch.some((p) => p.zones.graveyard.some((c) => eligibleTypes.includes(getCardDefinition(c.defId).type)));
      if (hasLegalTarget) {
        next = {
          ...next,
          pendingCastFromGraveyardAnyMana: {
            sourceInstanceId,
            controllerId: playerId,
            ownGraveyardOnly: effect.ownGraveyardOnly,
            instantOnly: effect.instantOnly,
            free: effect.free,
          },
        };
      }
    } else if (effect.type === 'exileTargetInstantOrSorceryFromOpponentGraveyardThenMayCastForFixedCost') {
      const opponent = getOpponent(next, playerId);
      const hasLegalTarget = opponent.zones.graveyard.some((c) => ['instant', 'sorcery'].includes(getCardDefinition(c.defId).type));
      if (hasLegalTarget) {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'millThenPutLandIntoHandGainLifeIfTown') {
      const player = getPlayer(next, playerId);
      const milled = player.zones.library.slice(0, effect.millCount);
      const rest = player.zones.library.slice(effect.millCount);
      next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: rest, graveyard: [...p.zones.graveyard, ...milled] } }));
      logLines.push(`${player.name} mills ${milled.length} card(s).`);
      const hasLand = milled.some((c) => getCardDefinition(c.defId).type === 'land');
      if (hasLand) {
        next = {
          ...next,
          pendingMillThenPutLandIntoHand: { sourceInstanceId, controllerId: playerId, milledInstanceIds: milled.map((c) => c.instanceId), lifeGainIfTown: effect.lifeGainIfTown },
        };
      }
    } else if (effect.type === 'exileThenReturnTargetOwnCreature') {
      const player = getPlayer(next, playerId);
      const hasLegalTarget = player.zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'creature');
      if (hasLegalTarget) {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'dealDamageToAnyOtherTargetAndSelf') {
      const player = getPlayer(next, playerId);
      const hasLegalTarget = player.zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'creature');
      if (hasLegalTarget) {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'attachAllControlledEquipmentToTargetCreature') {
      const player = getPlayer(next, playerId);
      const hasEquipment = player.zones.battlefield.some((c) => !!getCardDefinition(c.defId).equipCost);
      const hasLegalTarget = player.zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'creature');
      if (!hasEquipment || !hasLegalTarget) {
        logLines.push(`No legal Equipment/target for this ability.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'queueExtraEndStepIfFirstEndStepOfTurn') {
      if (next.endStepNumberThisTurn === 1) {
        next = { ...next, extraEndStepsQueued: next.extraEndStepsQueued + 1 };
        logLines.push(`An additional end step will follow this one.`);
      }
    } else if (effect.type === 'returnInstantOrSorceryFromGraveyardToHand') {
      const player = getPlayer(next, playerId);
      const hasLegalTarget = player.zones.graveyard.some((c) => {
        const d = getCardDefinition(c.defId);
        return d.type === 'instant' || d.type === 'sorcery';
      });
      if (!hasLegalTarget) {
        logLines.push(`${player.name} has no instant or sorcery card in their graveyard to return.`);
      } else {
        next = { ...next, pendingReturnInstantOrSorceryFromGraveyard: { sourceInstanceId, controllerId: playerId } };
      }
    } else if (effect.type === 'exileTargetPermanent') {
      const player = getPlayer(next, playerId);
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      const opponent = getOpponent(next, playerId);
      const candidates = effect.opponentControlledOnly ? opponent.zones.battlefield : [...next.players[0].zones.battlefield, ...next.players[1].zones.battlefield];
      const hasLegalTarget = candidates.some((c) => {
        const d = getCardDefinition(c.defId);
        return effect.targetFilter === 'artifact'
          ? d.type === 'artifact'
          : effect.targetFilter === 'creature'
            ? d.type === 'creature'
            : effect.targetFilter === 'nonlandPermanent'
              ? d.type !== 'land'
              : effect.targetFilter === 'artifactEnchantmentOrTappedCreature'
                ? d.type === 'artifact' || d.type === 'enchantment' || (d.type === 'creature' && c.tapped)
                : effect.targetFilter === 'artifactOrEnchantment'
                  ? d.type === 'artifact' || d.type === 'enchantment'
                  : true;
      });
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'exileTargetCreatureWithLessPowerUntilSourceLeaves') {
      const sourceFound = findCardAnywhere(next, sourceInstanceId);
      const sourceDef = sourceFound ? getCardDefinition(sourceFound.card.defId) : null;
      const sourcePower = sourceFound && sourceDef ? effectivePower(sourceDef, sourceFound.card, next, sourceFound.ownerPlayerId) : 0;
      const opponent = getOpponent(next, playerId);
      const hasLegalTarget = opponent.zones.battlefield.some((c) => {
        const d = getCardDefinition(c.defId);
        return d.type === 'creature' && effectivePower(d, c, next, opponent.id) < sourcePower;
      });
      if (!hasLegalTarget) {
        logLines.push(`${sourceDef?.name ?? 'This creature'}'s ability has no legal target.`);
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
    } else if (effect.type === 'jenovaCellsAttackTrigger') {
      next = updatePlayer(next, playerId, (p) => ({
        ...p,
        modifiedCreaturesHaveBasePowerToughnessUntilEndOfTurn: { power: effect.power, toughness: effect.toughness },
      }));
      logLines.push(`${getPlayer(next, playerId).name}'s modified creatures have base power and toughness ${effect.power}/${effect.toughness} until end of turn.`);
      const hasLegalTarget = [...next.players[0].zones.battlefield, ...next.players[1].zones.battlefield].some((c) => getCardDefinition(c.defId).type === 'creature');
      if (hasLegalTarget) {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'tapTargetThenExileIfMetalcraft') {
      const hasLegalTarget = [...next.players[0].zones.battlefield, ...next.players[1].zones.battlefield].some((c) => getCardDefinition(c.defId).type === 'creature');
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'chooseOneMode') {
      next = { ...next, pendingChooseOneMode: { sourceInstanceId, controllerId: playerId, modes: effect.modes, allowBothIfCommander: effect.allowBothIfCommander } };
    } else if (
      effect.type === 'drawCardsFromTargetPlayer' ||
      effect.type === 'putCounterOnEachCreatureTargetPlayerControls' ||
      effect.type === 'mayPutExactNamedCardFromLibraryToHandForTargetPlayer'
    ) {
      next = { ...next, pendingPlayerTarget: { sourceInstanceId, controllerId: playerId, effect } };
    } else if (effect.type === 'putCounterOnUpToOneOwnCreature') {
      const candidates = effect.anyController ? [...next.players[0].zones.battlefield, ...next.players[1].zones.battlefield] : getPlayer(next, playerId).zones.battlefield;
      const hasLegalTarget = candidates.some((c) => getCardDefinition(c.defId).type === 'creature');
      if (hasLegalTarget) {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'attachSelfToTarget') {
      const matchesType = (d: CardDefinition) => (effect.targetTypeFilter === 'artifactOrCreature' ? d.type === 'artifact' || d.type === 'creature' : d.type === 'creature');
      const candidates = effect.opponentControlledOnly
        ? getOpponent(next, playerId).zones.battlefield
        : effect.allowAnyController
          ? [...next.players[0].zones.battlefield, ...next.players[1].zones.battlefield]
          : getPlayer(next, playerId).zones.battlefield;
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
    } else if (effect.type === 'mayPayManaThenEffect') {
      // The mana-cost cousin of mayPayLifeThenEffect above - see GameState.
      // pendingOptionalPayMana and engine/actions.ts: resolveOptionalPayMana.
      next = { ...next, pendingOptionalPayMana: { sourceInstanceId, controllerId: playerId, manaCost: effect.manaCost, effects: effect.effects } };
    } else if (effect.type === 'returnSelfFromGraveyardTappedAndAttacking') {
      const player = getPlayer(next, playerId);
      const card = player.zones.graveyard.find((c) => c.instanceId === sourceInstanceId);
      if (!card) {
        logLines.push(`That card is no longer in the graveyard.`);
      } else {
        const def = getCardDefinition(card.defId);
        const movedCard: CardInstance = { ...card, tapped: true, damageMarked: 0, summoningSick: false };
        next = updatePlayer(next, playerId, (p) => ({
          ...p,
          zones: { ...p.zones, graveyard: p.zones.graveyard.filter((c) => c.instanceId !== sourceInstanceId), battlefield: [...p.zones.battlefield, movedCard] },
        }));
        next = checkLegendRule(next, playerId);
        next = {
          ...next,
          declaredAttackers: [...next.declaredAttackers, movedCard.instanceId],
          combatAssignments: [...next.combatAssignments, { attackerInstanceId: movedCard.instanceId, blockerInstanceIds: [] }],
        };
        logLines.push(`${player.name} returns ${def.name} from their graveyard to the battlefield, tapped and attacking.`);
        if (def.onEnter && def.onEnter.length > 0) {
          const resolved = resolveCardEffects(next, playerId, def.onEnter, movedCard.instanceId);
          next = resolved.state;
          logLines.push(...resolved.logLines);
        }
      }
    } else if (effect.type === 'discardHandThenDraw') {
      const player = getPlayer(next, playerId);
      const discarded = player.zones.hand;
      const drawn = player.zones.library.slice(0, effect.drawCount);
      next = updatePlayer(next, playerId, (p) => ({
        ...p,
        zones: { ...p.zones, hand: drawn, graveyard: [...p.zones.graveyard, ...discarded.map((c) => ({ ...c, graveyardEntrySource: 'other' as const }))], library: p.zones.library.slice(drawn.length) },
      }));
      logLines.push(`${player.name} discards their hand (${discarded.length}) and draws ${drawn.length}.`);
    } else if (effect.type === 'eachPlayerMayDiscardHandAndDrawThenDamageOpponentsWhoDid') {
      const opponent = getOpponent(next, playerId);
      next = {
        ...next,
        pendingSnortChoice: {
          sourceInstanceId,
          casterId: playerId,
          drawCount: effect.drawCount,
          damageAmount: effect.damageAmount,
          pendingPlayerIds: [playerId, opponent.id],
          discardedPlayerIds: [],
        },
      };
    } else if (effect.type === 'mogMoogleWarriorDance') {
      const opponent = getOpponent(next, playerId);
      next = {
        ...next,
        pendingMogMoogleWarriorDanceChoice: {
          sourceInstanceId,
          controllerId: playerId,
          pendingPlayerIds: [playerId, opponent.id],
          creatureDiscarded: false,
          noncreatureDiscarded: false,
        },
      };
    } else if (effect.type === 'cultivate') {
      const result = beginLibrarySearch(next, playerId, sourceInstanceId, { kind: 'basicLand' }, true, true);
      next = result.state;
      logLines.push(...result.logLines);
      if (next.pendingLibrarySearch) {
        next = { ...next, pendingLibrarySearch: { ...next.pendingLibrarySearch, chainedSearchToHand: true } };
      }
    } else if (effect.type === 'lookAtTopNPutMToHandRestToBottom') {
      const player = getPlayer(next, playerId);
      const cards = player.zones.library.slice(0, effect.count);
      next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(cards.length) } }));
      if (cards.length === 0) {
        logLines.push(`${player.name}'s library is empty.`);
      } else {
        next = { ...next, pendingLookAtTopNPutMToHandRestToBottom: { sourceInstanceId, controllerId: playerId, cards, keepCount: Math.min(effect.keepCount, cards.length), chosenInstanceIds: [] } };
      }
    } else if (effect.type === 'conniveConvokingCreatures') {
      if (convokedInstanceIds && convokedInstanceIds.length > 0) {
        const [first, ...rest] = convokedInstanceIds;
        const player = getPlayer(next, playerId);
        const drawn = player.zones.library.slice(0, 1);
        next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(drawn.length), hand: [...p.zones.hand, ...drawn] } }));
        next = { ...next, pendingDiscard: { sourceInstanceId, controllerId: playerId, count: 1, thenCounterOnInstanceIdIfNonland: first, thenContinueConniveQueue: rest } };
        const connivingDef = findCardAnywhere(next, first);
        logLines.push(`${connivingDef ? getCardDefinition(connivingDef.card.defId).name : 'A creature'} connives.`);
      }
    } else if (effect.type === 'becomeMonarch') {
      next = { ...next, monarchPlayerId: playerId };
      const released = releaseExiledUntilMonarchChanges(next);
      next = released.state;
      logLines.push(`${getPlayer(next, playerId).name} becomes the monarch.`, ...released.logLines);
    } else if (effect.type === 'opponentChoosesOneOfExiledCardsToBottomRestReturnsTappedThenBecomeMonarch') {
      if (exiledCostInstanceIds && exiledCostInstanceIds.length === 2) {
        const opponent = getOpponent(next, playerId);
        next = {
          ...next,
          pendingOpponentChoosesExiledCard: { sourceInstanceId, controllerId: playerId, opponentId: opponent.id, exiledInstanceIds: [exiledCostInstanceIds[0], exiledCostInstanceIds[1]] },
        };
        logLines.push(`${opponent.name} chooses one of the two exiled cards.`);
      }
    } else if (effect.type === 'exileTargetCreatureUntilMonarchChanges') {
      const opponent = getOpponent(next, playerId);
      const hasLegalTarget = opponent.zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'creature');
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'exileUpToOneOtherTargetCreatureThenControllerGainsLifeEqualToItsPower') {
      const hasLegalTarget = next.players.some((p) => p.zones.battlefield.some((c) => c.instanceId !== sourceInstanceId && getCardDefinition(c.defId).type === 'creature'));
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'revealOpponentHandChooseNonlandCardThenDiscard') {
      const opponent = getOpponent(next, playerId);
      const hasNonlandCard = opponent.zones.hand.some((c) => getCardDefinition(c.defId).type !== 'land');
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasNonlandCard) {
        logLines.push(`${sourceName}'s ability has no legal card to choose - ${opponent.name} has no nonland cards in hand.`);
      } else {
        next = { ...next, pendingChooseCardFromOpponentHandToDiscard: { sourceInstanceId, controllerId: playerId, opponentId: opponent.id } };
        logLines.push(`${opponent.name} reveals their hand.`);
      }
    } else if (effect.type === 'divideDamageAmongChosenTargets') {
      const hasLegalTarget = next.players.some((p) => p.zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'creature'));
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingDivideDamageAmongTargets: { sourceInstanceId, controllerId: playerId, remainingDamage: effect.totalDamage, chosenInstanceIds: [] } };
      }
    } else if (effect.type === 'graveyardToBottomOfLibraryForTargetPlayer') {
      next = { ...next, pendingPlayerTarget: { sourceInstanceId, controllerId: playerId, effect } };
    } else if (effect.type === 'allCreaturesGetNegativeChosenXUntilEndOfTurn') {
      const x = chosenX ?? 0;
      if (x > 0) {
        for (const p of next.players) {
          for (const c of p.zones.battlefield) {
            if (getCardDefinition(c.defId).type !== 'creature') continue;
            next = applyTemporaryBuff(next, c.instanceId, -x, -x);
          }
        }
      }
      const dyingIds = next.players.flatMap((p) =>
        p.zones.battlefield
          .filter((c) => getCardDefinition(c.defId).type === 'creature' && effectiveToughness(getCardDefinition(c.defId), c, next, p.id) <= 0)
          .map((c) => c.instanceId)
      );
      if (dyingIds.length > 0) {
        const result = moveCreaturesToGraveyardAndTrigger(next, dyingIds, 'is destroyed');
        next = result.state;
        logLines.push(...result.logLines);
      }
      logLines.push(`All creatures get -${x}/-${x} until end of turn.`);
    } else if (effect.type === 'anyPlayerMayPayHalfLifeToCounterThenExtraTurn') {
      const opponent = getOpponent(next, playerId);
      next = { ...next, pendingPayHalfLifeToCounterChoice: { sourceInstanceId, controllerId: playerId, opponentId: opponent.id } };
    } else if (effect.type === 'pumpTargetOwnCreatureByControlledSubtypeCount') {
      const hasLegalTarget = getPlayer(next, playerId).zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'creature');
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'createTokenIfOpponentControlsMoreCreaturesThanYou') {
      const opponent = getOpponent(next, playerId);
      const yourCount = getPlayer(next, playerId).zones.battlefield.filter((c) => getCardDefinition(c.defId).type === 'creature').length;
      const oppCount = opponent.zones.battlefield.filter((c) => getCardDefinition(c.defId).type === 'creature').length;
      if (oppCount > yourCount) {
        const tokenDef = getCardDefinition(effect.tokenId);
        const token: CardInstance = {
          instanceId: nextInstanceId(),
          defId: effect.tokenId,
          ownerId: playerId,
          tapped: false,
          counters: [],
          damageMarked: 0,
          summoningSick: true,
          isToken: true,
        };
        next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, battlefield: [...p.zones.battlefield, token] } }));
        logLines.push(`${getPlayer(next, playerId).name} creates a ${tokenDef.name} token.`);
      }
    } else if (effect.type === 'searchOpponentLibraryExileFaceDownThenMayPlay') {
      const opponent = getOpponent(next, playerId);
      if (opponent.zones.library.length === 0) {
        logLines.push(`${opponent.name} has no cards in their library.`);
      } else {
        next = { ...next, pendingSearchOpponentLibraryToExile: { sourceInstanceId, controllerId: playerId, opponentId: opponent.id } };
      }
    } else if (effect.type === 'eachOpponentWhoLostLifeSacrificesGreatestPowerCreature') {
      const opponent = getOpponent(next, playerId);
      if (opponent.lifeLostThisTurn > 0) {
        const creatures = opponent.zones.battlefield.filter((c) => getCardDefinition(c.defId).type === 'creature');
        if (creatures.length > 0) {
          const greatest = creatures.reduce((best, c) =>
            effectivePower(getCardDefinition(c.defId), c, next, opponent.id) > effectivePower(getCardDefinition(best.defId), best, next, opponent.id) ? c : best
          );
          const sacResult = moveCreaturesToGraveyardAndTrigger(next, [greatest.instanceId], 'is sacrificed');
          next = sacResult.state;
          logLines.push(...sacResult.logLines);
        }
      }
    } else if (effect.type === 'eachOpponentMaySacrificeNontokenCreatureElseLoseLifePerInstantSorcery') {
      const opponent = getOpponent(next, playerId);
      next = {
        ...next,
        pendingFandanielChoice: { sourceInstanceId, controllerId: playerId, opponentId: opponent.id, lifePerCard: effect.lifePerCard },
      };
    } else if (effect.type === 'opponentMayHaveYouDrawElseMillAndDealDamage') {
      const opponent = getOpponent(next, playerId);
      next = {
        ...next,
        pendingOpponentMayHaveYouDrawElseMillAndDealDamage: { sourceInstanceId, controllerId: playerId, opponentId: opponent.id, count: effect.count },
      };
    } else if (effect.type === 'gainControlOfAllArtifactsControlledByOpponent') {
      const opponent = getOpponent(next, playerId);
      const artifacts = opponent.zones.battlefield.filter((c) => getCardDefinition(c.defId).type === 'artifact');
      if (artifacts.length > 0) {
        const artifactIds = new Set(artifacts.map((c) => c.instanceId));
        next = updatePlayer(next, opponent.id, (p) => ({ ...p, zones: { ...p.zones, battlefield: p.zones.battlefield.filter((c) => !artifactIds.has(c.instanceId)) } }));
        next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, battlefield: [...p.zones.battlefield, ...artifacts] } }));
        logLines.push(`${getPlayer(next, playerId).name} gains control of ${artifacts.length} artifact(s).`);
      }
    } else if (effect.type === 'winGameIfControlAtLeastNOfType') {
      const count = getPlayer(next, playerId).zones.battlefield.filter((c) => getCardDefinition(c.defId).type === effect.cardType).length;
      if (count >= effect.count) {
        next = { ...next, winnerId: playerId };
        logLines.push(`${getPlayer(next, playerId).name} controls ${count} ${effect.cardType}s and wins the game!`);
      }
    } else if (effect.type === 'addManaEqualToOwnLoreCounter') {
      const source = findCardAnywhere(next, sourceInstanceId);
      const loreCount = source?.card.counters.find((c) => c.label === 'lore')?.amount ?? 0;
      if (loreCount > 0) {
        next = updatePlayer(next, playerId, (p) => ({ ...p, manaPool: { ...p.manaPool, [effect.color]: p.manaPool[effect.color] + loreCount } }));
        logLines.push(`${getPlayer(next, playerId).name} adds ${loreCount}${effect.color}.`);
      }
    } else if (effect.type === 'drawCardsEqualToGreatestPower') {
      const player = getPlayer(next, playerId);
      const greatestPower = player.zones.battlefield
        .filter((c) => getCardDefinition(c.defId).type === 'creature')
        .reduce((max, c) => Math.max(max, effectivePower(getCardDefinition(c.defId), c, next, playerId)), 0);
      if (greatestPower > 0) {
        const drawn = player.zones.library.slice(0, greatestPower);
        next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(drawn.length), hand: [...p.zones.hand, ...drawn] } }));
        logLines.push(`${player.name} draws ${drawn.length} card(s) (greatest power among creatures controlled).`);
      }
    } else if (effect.type === 'gainLifeEqualToTwiceGreatestPower') {
      const player = getPlayer(next, playerId);
      const greatestPower = player.zones.battlefield
        .filter((c) => getCardDefinition(c.defId).type === 'creature')
        .reduce((max, c) => Math.max(max, effectivePower(getCardDefinition(c.defId), c, next, playerId)), 0);
      if (greatestPower > 0) {
        next = addLife(next, playerId, greatestPower * 2);
        logLines.push(`${getPlayer(next, playerId).name} gains ${greatestPower * 2} life.`);
      }
    } else if (effect.type === 'moveCounterBetweenTargetCreatures') {
      // "You may move a counter from target creature you control onto a
      // second target creature you control" (Tidus, Yuna's Guardian) - needs
      // at least one OTHER controlled creature besides a counter-bearing
      // source (a lone counter-bearing creature has nowhere to move a
      // counter TO). See engine/actions.ts: chooseTarget's own branch for
      // the actual move.
      const controlled = getPlayer(next, playerId).zones.battlefield.filter((c) => getCardDefinition(c.defId).type === 'creature');
      const hasSource = controlled.some((c) => c.counters.length > 0);
      const hasLegalTarget = hasSource && controlled.length >= 2;
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'attachTargetControlledEquipmentToTargetRebel') {
      // "Attach up to one target Equipment you control to target Rebel you
      // control" (Barret, Avalanche Leader) - armed only if the controller
      // has both at least one Equipment and at least one Rebel creature;
      // see engine/actions.ts: chooseTarget for the actual two-step pick.
      const battlefield = getPlayer(next, playerId).zones.battlefield;
      const hasEquipment = battlefield.some((c) => !!getCardDefinition(c.defId).equipCost);
      const hasRebel = battlefield.some((c) => getCardDefinition(c.defId).subtype?.toLowerCase().includes('rebel'));
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasEquipment || !hasRebel) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'moveAllCountersBetweenTargetPermanents') {
      // "Move any number of counters from target permanent you control onto
      // a second target permanent you control" (Resourceful Defense) - same
      // "need a counter-bearing source plus one other permanent" shape as
      // moveCounterBetweenTargetCreatures above, generalized to ANY
      // permanent type, not just creatures.
      const controlled = getPlayer(next, playerId).zones.battlefield;
      const hasSource = controlled.some((c) => c.counters.length > 0);
      const hasLegalTarget = hasSource && controlled.length >= 2;
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'moveOneCounterFromOwnPermanentToAnyPermanent') {
      // "Move a counter from target permanent you control onto a second
      // target permanent" (Nesting Grounds) - needs a counter-bearing
      // permanent the activating player controls; the SECOND pick can be
      // ANY permanent either player controls, so it's never the bottleneck.
      const hasSource = getPlayer(next, playerId).zones.battlefield.some((c) => c.counters.length > 0);
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasSource) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'gainControlOfTargetNoncreatureArtifactPermanent') {
      const hasLegalTarget = next.players.some((p) => p.zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'artifact'));
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName} has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'mayAttachTargetControlledEquipmentToSelf') {
      const hasLegalTarget = getPlayer(next, playerId).zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'artifact' && !!getCardDefinition(c.defId).equipCost);
      if (hasLegalTarget) {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'shuffleTargetPermanentIntoLibraryThenRevealTop') {
      const hasLegalTarget = next.players.some((p) => p.zones.battlefield.length > 0);
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName} has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'destroyAnyNumberOfTappedCreaturesWithDifferentControllers') {
      const hasLegalTarget = next.players.some((p) => p.zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'creature' && c.tapped));
      if (hasLegalTarget) {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect, usedControllerIds: [] } };
      }
    } else if (effect.type === 'phaseOutAnyNumberOfTargetControlledNonlandPermanents') {
      const hasLegalTarget = getPlayer(next, playerId).zones.battlefield.some((c) => getCardDefinition(c.defId).type !== 'land');
      if (hasLegalTarget) {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect, chosenInstanceIds: [] } };
      }
    } else if (effect.type === 'mayBecomeCopyOfAnotherControlledCreatureThenBuffBoth') {
      const hasLegalTarget = getPlayer(next, playerId).zones.battlefield.some((c) => c.instanceId !== sourceInstanceId && getCardDefinition(c.defId).type === 'creature');
      if (hasLegalTarget) {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'moveCounterFromOpponentCreatureToOwnCreature') {
      const opponent = getOpponent(next, playerId);
      const hasSource = opponent.zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'creature' && c.counters.length > 0);
      const hasOwnCreature = getPlayer(next, playerId).zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'creature');
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasSource || !hasOwnCreature) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'adapt') {
      const source = findCardAnywhere(next, sourceInstanceId);
      const alreadyHasCounter = (source?.card.counters.find((c) => c.label === effect.counterLabel)?.amount ?? 0) > 0;
      const sourceName = source ? getCardDefinition(source.card.defId).name : 'This creature';
      if (alreadyHasCounter) {
        logLines.push(`${sourceName} already has a ${effect.counterLabel} counter - Adapt does nothing.`);
      } else {
        const resolved = resolveCardEffects(next, playerId, [{ type: 'putCounterOnSelf', counterLabel: effect.counterLabel, counterAmount: effect.amount }], sourceInstanceId);
        next = resolved.state;
        logLines.push(...resolved.logLines);
      }
    } else if (effect.type === 'searchLibraryForUpToXBasicLandsEqualToPower') {
      // Reads the dying instance's own last-known power - same approximation
      // resolveOnDeathTriggers' temporaryOnDeathPutCountersEqualToPower
      // already uses (printed power + counters; equip/anthem bonuses from
      // while it was alive aren't recoverable).
      const source = findCardAnywhere(next, sourceInstanceId);
      const sourceDef = source ? getCardDefinition(source.card.defId) : null;
      const plus = source?.card.counters.find((c) => c.label === '+1/+1')?.amount ?? 0;
      const minus = source?.card.counters.find((c) => c.label === '-1/-1')?.amount ?? 0;
      const amount = Math.max(0, (sourceDef?.power ?? 0) + plus - minus);
      if (amount > 0) {
        // allowDuplicateNames: true - "up to X basic land CARDS" with no
        // "different names" clause stated means duplicates (two Plains) are
        // legal, unlike Reach the Horizon's own multi-pick search.
        const result = beginLibrarySearch(
          next,
          playerId,
          sourceInstanceId,
          { kind: 'basicLand' },
          false,
          undefined,
          amount > 1 ? amount - 1 : undefined,
          undefined,
          true,
          true
        );
        next = result.state;
        logLines.push(...result.logLines);
      }
    } else if (effect.type === 'searchLibraryForLandConditionalBattlefieldIfOpponentHasMoreLands') {
      // The "if [condition]" gate is checked ONCE, right here, before the
      // search even begins - see GameState.pendingLibrarySearch.
      // mayChooseBattlefieldTapped's own doc comment.
      const opponent = getOpponent(next, playerId);
      const opponentLandCount = opponent.zones.battlefield.filter((c) => getCardDefinition(c.defId).type === 'land').length;
      const ownLandCount = getPlayer(next, playerId).zones.battlefield.filter((c) => getCardDefinition(c.defId).type === 'land').length;
      const result = beginLibrarySearch(
        next,
        playerId,
        sourceInstanceId,
        { kind: 'landByName', name: effect.landName },
        true,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        opponentLandCount > ownLandCount
      );
      next = result.state;
      logLines.push(...result.logLines);
    } else if (effect.type === 'mayEffect') {
      // The no-cost cousin of mayPayLifeThenEffect above - see GameState.
      // pendingMayEffect and engine/actions.ts: resolveMayEffect.
      next = { ...next, pendingMayEffect: { sourceInstanceId, controllerId: playerId, effects: effect.effects } };
    } else if (effect.type === 'drawThenTargetOpponentMayDraw') {
      const player = getPlayer(next, playerId);
      const drawn = player.zones.library.slice(0, 1);
      next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(1), hand: [...p.zones.hand, ...drawn] } }));
      logLines.push(`${player.name} draws a card.`);
      const opponent = getOpponent(next, playerId);
      next = { ...next, pendingMayEffect: { sourceInstanceId, controllerId: opponent.id, effects: [{ type: 'drawCards', amount: 1 }] } };
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
    } else if (effect.type === 'drawForEquippedAttackersThenEffectsIfPowerAtLeast') {
      const player = getPlayer(next, playerId);
      const equippedAttackerCount = player.zones.battlefield.filter(
        (c) =>
          next.declaredAttackers.includes(c.instanceId) &&
          getCardDefinition(c.defId).type === 'creature' &&
          player.zones.battlefield.some((eq) => eq.attachedToInstanceId === c.instanceId)
      ).length;
      if (equippedAttackerCount > 0) {
        const drawn = player.zones.library.slice(0, equippedAttackerCount);
        next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(equippedAttackerCount), hand: [...p.zones.hand, ...drawn] } }));
        logLines.push(`${player.name} draws ${equippedAttackerCount} card(s) for equipped attacking creature(s).`);
      }
      const source = findCardAnywhere(next, sourceInstanceId);
      const sourceDef = source ? getCardDefinition(source.card.defId) : null;
      if (source && sourceDef && effectivePower(sourceDef, source.card, next, playerId) >= effect.minPower) {
        const resolved = resolveCardEffects(next, playerId, effect.thenEffects, sourceInstanceId);
        next = resolved.state;
        logLines.push(...resolved.logLines);
      }
    } else if (effect.type === 'putCounterOnSelf') {
      const { counterLabel } = effect;
      const rawAmount =
        effect.counterAmount === 'chosenX'
          ? chosenX ?? 0
          : effect.counterAmount === 'controlledCreatureCount'
            ? getPlayer(next, playerId).zones.battlefield.filter((c) => getCardDefinition(c.defId).type === 'creature').length
            : effect.counterAmount === 'twiceGraveyardCreatureCount'
              ? 2 * getPlayer(next, playerId).zones.graveyard.filter((c) => getCardDefinition(c.defId).type === 'creature').length
              : effect.counterAmount === 'playersWhoLostLifeThisTurnCount'
                ? next.players.filter((p) => p.lifeLostThisTurn > 0).length
                : effect.counterAmount;
      const counterAmount = hardenedScalesAdjustedAmount(next, playerId, counterLabel, rawAmount);
      if (counterAmount > 0) {
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
        const sourceDef = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId);
        logLines.push(`${sourceDef.name} gets ${counterAmount} ${counterLabel} counter(s).`);
        // See PlayerState.counterPutOnOwnCreatureThisTurn - only a handful
        // of the most common counter-adding effects set this.
        if (sourceDef.type === 'creature') next = updatePlayer(next, playerId, (p) => ({ ...p, counterPutOnOwnCreatureThisTurn: true }));
        const sideEffects = applyCounterPlacementSideEffects(next, playerId, sourceInstanceId, counterLabel);
        next = sideEffects.state;
        logLines.push(...sideEffects.logLines);
      }
      if (effect.alsoGrantTemporaryKeyword) {
        next = grantTemporaryKeyword(next, sourceInstanceId, effect.alsoGrantTemporaryKeyword);
        logLines.push(`It gains ${effect.alsoGrantTemporaryKeyword} until end of turn.`);
      }
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
      // "...from A graveyard" (Reanimate) widens the eligible pool to every
      // player's graveyard; "...from THAT PLAYER's graveyard" (Sepulchral
      // Primordial's opponentGraveyardOnly) narrows it to just the one
      // opponent's instead.
      const graveyardsToSearch = effect.opponentGraveyardOnly
        ? [getOpponent(next, playerId).zones.graveyard]
        : effect.anyGraveyard
          ? next.players.map((p) => p.zones.graveyard)
          : [player.zones.graveyard];
      const eligible = graveyardsToSearch.flat().filter((c) => matchesReanimateFilter(getCardDefinition(c.defId), effect));
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (eligible.length === 0) {
        logLines.push(
          effect.opponentGraveyardOnly
            ? `${sourceName} has no legal target - ${getOpponent(next, playerId).name} has no matching card in their graveyard.`
            : effect.anyGraveyard
              ? `${sourceName} has no legal target - no graveyard has a matching card.`
              : `${sourceName} has no legal target - ${player.name} has no matching card in their graveyard.`
        );
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
        next = { ...next, pendingDiscard: { sourceInstanceId, controllerId: opponent.id, count, thenCasterDraws: effect.thenCasterDrawsForEachDiscarded ? playerId : undefined } };
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
    } else if (effect.type === 'pumpSelfByGreatestControlledArtifactManaValue') {
      const artifactManaValues = getPlayer(next, playerId)
        .zones.battlefield.filter((c) => getCardDefinition(c.defId).type === 'artifact')
        .map((c) => manaValue(parseCostLabel(getCardDefinition(c.defId).costLabel)));
      const x = artifactManaValues.length > 0 ? Math.max(...artifactManaValues) : 0;
      if (x > 0) {
        next = applyTemporaryBuff(next, sourceInstanceId, x, 0);
        logLines.push(`${getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name} gets +${x}/+0 until end of turn.`);
      }
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
    } else if (effect.type === 'returnTargetCreatureFromGraveyardToHandOrBattlefieldIfLifeGainedAtLeast') {
      const player = getPlayer(next, playerId);
      const hasLegalTarget = player.lifeGainedThisTurn > 0 && player.zones.graveyard.some((c) => getCardDefinition(c.defId).type === 'creature');
      if (!hasLegalTarget) {
        logLines.push(`${player.name} gained no life this turn (or has no creature card in their graveyard) - Raise doesn't trigger.`);
      } else {
        next = {
          ...next,
          pendingReturnCreatureFromGraveyardHandOrBattlefield: { sourceInstanceId, controllerId: playerId, toBattlefield: player.lifeGainedThisTurn >= effect.minLifeGained },
        };
      }
    } else if (effect.type === 'returnTargetCreatureFromGraveyardToHandOrBattlefieldIfGraveyardCountAtLeast') {
      const player = getPlayer(next, playerId);
      const hasLegalTarget = player.zones.graveyard.some((c) => getCardDefinition(c.defId).type === 'creature');
      if (!hasLegalTarget) {
        logLines.push(`${player.name} has no creature card in their graveyard - there is nothing to return.`);
      } else {
        next = {
          ...next,
          pendingReturnCreatureFromGraveyardHandOrBattlefield: { sourceInstanceId, controllerId: playerId, toBattlefield: player.zones.graveyard.length >= effect.minGraveyardCount },
        };
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
      const hasLegalTarget = [...next.players[0].zones.graveyard, ...next.players[1].zones.graveyard].some((c) => {
        const d = getCardDefinition(c.defId);
        return (!effect.creatureOnly || d.type === 'creature') && (!effect.instantOrSorceryOnly || d.type === 'instant' || d.type === 'sorcery');
      });
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = {
          ...next,
          pendingGraveyardExile: {
            sourceInstanceId,
            controllerId: playerId,
            createFoodTokenIfCreature: effect.createFoodTokenIfCreature,
            creatureOnly: effect.creatureOnly,
            instantOrSorceryOnly: effect.instantOrSorceryOnly,
            optional: effect.optional,
            thenCreateToken: effect.thenCreateToken,
          },
        };
      }
    } else if (effect.type === 'dealDamageToEachOpponent') {
      const opponent = getOpponent(next, playerId);
      next = loseLife(next, opponent.id, effect.amount);
      logLines.push(`${opponent.name} loses ${effect.amount} life.`);
    } else if (effect.type === 'eachOpponentSacrificesCreatureWithGreatestPower') {
      const opponent = getOpponent(next, playerId);
      const creatures = opponent.zones.battlefield.filter((c) => getCardDefinition(c.defId).type === 'creature');
      if (creatures.length === 0) {
        logLines.push(`${opponent.name} has no creature to sacrifice.`);
      } else {
        let best = creatures[0];
        let bestPower = effectivePower(getCardDefinition(best.defId), best, next, opponent.id);
        for (const c of creatures.slice(1)) {
          const p = effectivePower(getCardDefinition(c.defId), c, next, opponent.id);
          if (p > bestPower) {
            best = c;
            bestPower = p;
          }
        }
        const sacResult = moveCreaturesToGraveyardAndTrigger(next, [best.instanceId], 'is sacrificed');
        next = sacResult.state;
        logLines.push(`${opponent.name} sacrifices ${getCardDefinition(best.defId).name} (greatest power).`, ...sacResult.logLines);
      }
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
    } else if (effect.type === 'opponentsCantCastNoncreatureSpellsThisTurn') {
      const opponent = getOpponent(next, playerId);
      next = updatePlayer(next, opponent.id, (p) => ({ ...p, cantCastNoncreatureSpellsThisTurn: true }));
      logLines.push(`${opponent.name} can't cast noncreature spells this turn.`);
    } else if (effect.type === 'destroyAll') {
      const dead: string[] = [];
      for (const p of next.players) {
        if (effect.opponentControlledOnly && p.id === playerId) continue;
        for (const c of p.zones.battlefield) {
          const d = getCardDefinition(c.defId);
          const matchesFilter =
            effect.targetFilter === 'artifactAndCreature'
              ? d.type === 'artifact' || d.type === 'creature'
              : effect.targetFilter === 'artifactAndEnchantment'
                ? d.type === 'artifact' || d.type === 'enchantment'
                : effect.targetFilter === 'tappedCreature'
                  ? d.type === 'creature' && c.tapped
                  : effect.targetFilter === 'artifact'
                    ? d.type === 'artifact'
                    : effect.targetFilter === 'enchantment'
                      ? d.type === 'enchantment'
                      : effect.targetFilter === 'creatureWithManaValueAtMost'
                        ? d.type === 'creature' && manaValue(parseCostLabel(d.costLabel)) <= (effect.maxManaValue ?? 0)
                        : effect.targetFilter === 'creatureWithManaValueAtLeast'
                          ? d.type === 'creature' && manaValue(parseCostLabel(d.costLabel)) >= (effect.minManaValue ?? 0)
                          : effect.targetFilter === 'nonlandPermanent'
                            ? d.type !== 'land'
                            : effect.targetFilter === 'creature'
                              ? d.type === 'creature'
                              : effect.targetFilter === 'creatureMatchingSubtype'
                                ? d.type === 'creature' && !!d.subtype?.toLowerCase().includes((effect.requiredSubtype ?? '').toLowerCase())
                                : effect.targetFilter === 'creatureNotMatchingSubtype'
                                  ? d.type === 'creature' && !d.subtype?.toLowerCase().includes((effect.requiredSubtype ?? '').toLowerCase())
                                  : d.type === 'creature' && c.counters.length === 0;
          if (!matchesFilter) continue;
          const survives = checkIndestructibleOrShielded(next, c.instanceId, d, c, p.id);
          next = survives.state;
          if (!survives.survives) dead.push(c.instanceId);
        }
      }
      if (dead.length > 0) {
        const destroyResult = moveCreaturesToGraveyardAndTrigger(next, dead, 'is destroyed');
        next = destroyResult.state;
        logLines.push(...destroyResult.logLines);
      }
      const filterNote =
        effect.targetFilter === 'artifactAndCreature'
          ? 'artifacts and creatures'
          : effect.targetFilter === 'artifactAndEnchantment'
            ? 'artifacts and enchantments'
            : effect.targetFilter === 'tappedCreature'
              ? 'tapped creatures'
              : effect.targetFilter === 'artifact'
                ? 'artifacts'
                : effect.targetFilter === 'enchantment'
                  ? 'enchantments'
                  : effect.targetFilter === 'creatureWithManaValueAtMost'
                    ? `creatures with mana value ${effect.maxManaValue ?? 0} or less`
                    : effect.targetFilter === 'creatureWithManaValueAtLeast'
                      ? `creatures with mana value ${effect.minManaValue ?? 0} or greater`
                      : effect.targetFilter === 'nonlandPermanent'
                        ? 'nonland permanents'
                        : effect.targetFilter === 'creature'
                          ? 'creatures'
                          : effect.targetFilter === 'creatureMatchingSubtype'
                            ? `${effect.requiredSubtype ?? ''} creatures`
                            : effect.targetFilter === 'creatureNotMatchingSubtype'
                              ? `non-${effect.requiredSubtype ?? ''} creatures`
                              : 'creatures with no counters';
      logLines.push(`${dead.length} ${filterNote} destroyed.`);
      if (effect.thenCounterSelfLabel && dead.length > 0) {
        const sourceFound = findCardAnywhere(next, sourceInstanceId);
        if (sourceFound && sourceFound.zone === 'battlefield') {
          const counterLabel = effect.thenCounterSelfLabel;
          next = updatePlayer(next, sourceFound.ownerPlayerId, (p) => ({
            ...p,
            zones: {
              ...p.zones,
              battlefield: p.zones.battlefield.map((c) => {
                if (c.instanceId !== sourceInstanceId) return c;
                const hasCounter = c.counters.some((ctr) => ctr.label === counterLabel);
                const counters = hasCounter
                  ? c.counters.map((ctr) => (ctr.label === counterLabel ? { ...ctr, amount: ctr.amount + dead.length } : ctr))
                  : [...c.counters, { label: counterLabel, amount: dead.length }];
                return { ...c, counters };
              }),
            },
          }));
          logLines.push(`${getCardDefinition(sourceFound.card.defId).name} gets ${dead.length} ${counterLabel} counter(s).`);
        }
      }
    } else if (effect.type === 'exileAll') {
      let exiledCount = 0;
      for (const p of next.players) {
        const matching = p.zones.battlefield.filter((c) => getCardDefinition(c.defId).type === effect.targetFilter);
        if (matching.length === 0) continue;
        exiledCount += matching.length;
        const ids = new Set(matching.map((c) => c.instanceId));
        for (const c of matching) next = detachEverythingFrom(next, c.instanceId);
        next = updatePlayer(next, p.id, (pl) => ({
          ...pl,
          zones: { ...pl.zones, battlefield: pl.zones.battlefield.filter((c) => !ids.has(c.instanceId)), exile: [...pl.zones.exile, ...matching] },
        }));
      }
      logLines.push(`${exiledCount} ${effect.targetFilter}(s) exiled.`);
    } else if (effect.type === 'exileAllGraveyards') {
      let exiledCount = 0;
      for (const p of next.players) {
        if (p.zones.graveyard.length === 0) continue;
        exiledCount += p.zones.graveyard.length;
        const graveyard = p.zones.graveyard;
        next = updatePlayer(next, p.id, (pl) => ({ ...pl, zones: { ...pl.zones, graveyard: [], exile: [...pl.zones.exile, ...graveyard] } }));
      }
      logLines.push(`${exiledCount} card(s) exiled from graveyards.`);
    } else if (effect.type === 'putAllCreatureCardsFromAllGraveyardsOntoBattlefield') {
      let moved: CardInstance[] = [];
      for (const p of next.players) {
        const creatureCards = p.zones.graveyard.filter((c) => getCardDefinition(c.defId).type === 'creature');
        if (creatureCards.length === 0) continue;
        const movedFromThisGraveyard = creatureCards.map((c) => {
          const d = getCardDefinition(c.defId);
          return stripSagaProgress({ ...c, tapped: !!d.entersTapped, damageMarked: 0, summoningSick: !hasKeyword(d, 'haste'), counters: [], attachedToInstanceId: undefined });
        });
        next = updatePlayer(next, p.id, (pl) => ({ ...pl, zones: { ...pl.zones, graveyard: pl.zones.graveyard.filter((c) => getCardDefinition(c.defId).type !== 'creature') } }));
        moved = [...moved, ...movedFromThisGraveyard];
      }
      if (moved.length === 0) {
        logLines.push(`${getPlayer(next, playerId).name} has no creature cards in any graveyard to put onto the battlefield.`);
      } else {
        next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, battlefield: [...p.zones.battlefield, ...moved] } }));
        next = checkLegendRule(next, playerId);
        for (const movedCard of moved) {
          const d = getCardDefinition(movedCard.defId);
          if (d.onEnter && d.onEnter.length > 0) {
            const resolved = resolveCardEffects(next, playerId, d.onEnter, movedCard.instanceId);
            next = resolved.state;
            logLines.push(...resolved.logLines);
          }
        }
        logLines.push(`${getPlayer(next, playerId).name} puts ${moved.length} creature card(s) from all graveyards onto the battlefield under their control.`);
      }
    } else if (effect.type === 'millThenOpponentChoosesCreatureFromYourGraveyardToBattlefield') {
      const player = getPlayer(next, playerId);
      const opponent = getOpponent(next, playerId);
      const milled = player.zones.library.slice(0, effect.millCount);
      next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(effect.millCount), graveyard: [...p.zones.graveyard, ...milled] } }));
      logLines.push(`${player.name} mills ${milled.length} card(s).`);
      const hasEligible = getPlayer(next, playerId).zones.graveyard.some((c) => getCardDefinition(c.defId).type === 'creature');
      if (!hasEligible) {
        logLines.push(`${opponent.name} has no creature card to choose from ${player.name}'s graveyard.`);
      } else {
        next = { ...next, pendingRejoinTheFightChoice: { sourceInstanceId, casterId: playerId, opponentId: opponent.id } };
      }
    } else if (effect.type === 'tragicArrogance') {
      const caster = getPlayer(next, playerId);
      const opponent = getOpponent(next, playerId);
      const remainingSteps: { playerId: string; cardType: 'artifact' | 'creature' | 'enchantment' }[] = [];
      for (const p of [caster, opponent]) {
        for (const cardType of ['artifact', 'creature', 'enchantment'] as const) {
          if (p.zones.battlefield.some((c) => getCardDefinition(c.defId).type === cardType)) {
            remainingSteps.push({ playerId: p.id, cardType });
          }
        }
      }
      if (remainingSteps.length === 0) {
        logLines.push(`No one controls an artifact, creature, or enchantment to exempt - nothing is sacrificed.`);
      } else {
        next = { ...next, pendingTragicArroganceChoice: { sourceInstanceId, casterId: playerId, remainingSteps, exemptInstanceIds: [] } };
      }
    } else if (effect.type === 'maySacrificeAnotherNonlandPermanentThenDrawAndOpponentsLoseLifeEqualToManaValue') {
      const player = getPlayer(next, playerId);
      const hasEligible = player.zones.battlefield.some((c) => c.instanceId !== sourceInstanceId && getCardDefinition(c.defId).type !== 'land');
      if (!hasEligible) {
        logLines.push(`${player.name} has no other nonland permanent to sacrifice.`);
      } else {
        next = { ...next, pendingMaySacrificeForDrawAndDrainChoice: { sourceInstanceId, controllerId: playerId, drawCount: effect.drawCount } };
      }
    } else if (effect.type === 'exileFromOpponentLibraryUntilTypeThenMayCastFree') {
      const opponent = getOpponent(next, playerId);
      let library = opponent.zones.library;
      const exiled: CardInstance[] = [];
      let found: CardInstance | undefined;
      while (library.length > 0) {
        const top = library[0];
        library = library.slice(1);
        exiled.push(top);
        const d = getCardDefinition(top.defId);
        if (d.type === 'instant' || d.type === 'sorcery' || d.type === 'creature') {
          found = top;
          break;
        }
      }
      next = updatePlayer(next, opponent.id, (p) => ({ ...p, zones: { ...p.zones, library, exile: [...p.zones.exile, ...exiled] } }));
      if (!found) {
        logLines.push(`${opponent.name}'s library has no instant, sorcery, or creature card to find.`);
      } else {
        next = { ...next, pendingStragoAndRelmChoice: { sourceInstanceId, controllerId: playerId, foundInstanceId: found.instanceId } };
      }
    } else if (effect.type === 'sacrificeSelf') {
      const found = findCardAnywhere(next, sourceInstanceId);
      if (found && found.zone === 'battlefield') {
        const sacResult = moveCreaturesToGraveyardAndTrigger(next, [sourceInstanceId], 'is sacrificed');
        next = sacResult.state;
        logLines.push(...sacResult.logLines);
      }
    } else if (effect.type === 'exileSelf') {
      const found = findCardAnywhere(next, sourceInstanceId);
      if (found && found.zone === 'battlefield') {
        const exiledDef = getCardDefinition(found.card.defId);
        next = detachEverythingFrom(next, sourceInstanceId);
        next = updatePlayer(next, found.ownerPlayerId, (p) => ({
          ...p,
          zones: { ...p.zones, battlefield: p.zones.battlefield.filter((c) => c.instanceId !== sourceInstanceId), exile: [...p.zones.exile, found.card] },
        }));
        logLines.push(`${exiledDef.name} is exiled.`);
      }
    } else if (effect.type === 'grantCantBlockToUpToThreeTargets') {
      const hasLegalTarget = next.players.some((p) => p.zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'creature'));
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'discardThenDrawThenDamageOpponentsEqualToDiscardedManaValue') {
      const player = getPlayer(next, playerId);
      if (player.zones.hand.length === 0) {
        logLines.push(`${player.name} has no cards to discard.`);
      } else {
        next = {
          ...next,
          pendingDiscard: { sourceInstanceId, controllerId: playerId, count: 1, thenDrawCountForDiscarder: effect.drawCount, thenDamageOpponentsEqualToDiscardedManaValue: true },
        };
      }
    } else if (effect.type === 'exileEachOpponentGraveyardThenMayCopyExiledCreatureAsToken') {
      const opponent = getOpponent(next, playerId);
      const graveyard = opponent.zones.graveyard;
      let exiledCreatureIds: string[] = [];
      if (graveyard.length > 0) {
        exiledCreatureIds = graveyard.filter((c) => getCardDefinition(c.defId).type === 'creature').map((c) => c.instanceId);
        next = updatePlayer(next, opponent.id, (p) => ({ ...p, zones: { ...p.zones, graveyard: [], exile: [...p.zones.exile, ...graveyard] } }));
        logLines.push(`${opponent.name}'s graveyard (${graveyard.length} card(s)) is exiled.`);
      } else {
        logLines.push(`${opponent.name} has no graveyard to exile.`);
      }
      if (exiledCreatureIds.length > 0) {
        next = { ...next, pendingEspersToMagiciteChoice: { sourceInstanceId, controllerId: playerId, eligibleInstanceIds: exiledCreatureIds } };
      }
    } else if (effect.type === 'exileRandomFromEachOpponentGraveyardThenMayCastFree') {
      const opponent = getOpponent(next, playerId);
      if (opponent.zones.graveyard.length === 0) {
        logLines.push(`${opponent.name} has no graveyard to exile from.`);
      } else {
        const picked = opponent.zones.graveyard[Math.floor(Math.random() * opponent.zones.graveyard.length)];
        next = updatePlayer(next, opponent.id, (p) => ({
          ...p,
          zones: { ...p.zones, graveyard: p.zones.graveyard.filter((c) => c.instanceId !== picked.instanceId), exile: [...p.zones.exile, picked] },
        }));
        logLines.push(`${getCardDefinition(picked.defId).name} is exiled at random from ${opponent.name}'s graveyard.`);
        next = { ...next, pendingKefkaChoice: { sourceInstanceId, controllerId: playerId, eligibleInstanceIds: [picked.instanceId] } };
      }
    } else if (effect.type === 'damageEachCreature') {
      const dead: string[] = [];
      for (const p of next.players) {
        for (const c of p.zones.battlefield) {
          const cDef = getCardDefinition(c.defId);
          if (cDef.type !== 'creature') continue;
          const isIndestructible = hasKeywordEffective(cDef, c, 'indestructible');
          next = updatePlayer(next, p.id, (pl) => ({
            ...pl,
            zones: { ...pl.zones, battlefield: pl.zones.battlefield.map((bc) => (bc.instanceId === c.instanceId ? { ...bc, damageMarked: bc.damageMarked + effect.amount } : bc)) },
          }));
          const updated = getPlayer(next, p.id).zones.battlefield.find((bc) => bc.instanceId === c.instanceId)!;
          if (!isIndestructible && updated.damageMarked >= effectiveToughness(cDef, updated, next, p.id)) dead.push(c.instanceId);
        }
      }
      logLines.push(`Each creature takes ${effect.amount} damage.`);
      if (dead.length > 0) {
        const sweepResult = moveCreaturesToGraveyardAndTrigger(next, dead, 'dies');
        next = sweepResult.state;
        logLines.push(...sweepResult.logLines);
      }
    } else if (effect.type === 'damageEachOpponentEqualToGraveyardNoncreatureNonlandCount') {
      const player = getPlayer(next, playerId);
      const count = player.zones.graveyard.filter((c) => {
        const d = getCardDefinition(c.defId);
        return d.type !== 'creature' && d.type !== 'land';
      }).length;
      if (count > 0) {
        const sourceDef = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId);
        const opponent = getOpponent(next, playerId);
        const amount = count * damageMultiplierFor(next, playerId, sourceDef);
        next = loseLife(next, opponent.id, amount);
        logLines.push(`${sourceDef.name} deals ${amount} damage to ${opponent.name} (${count} noncreature, nonland cards in graveyard).`);
      }
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
      const candidates = effect.restrictToOwnCreature ? getPlayer(next, playerId).zones.battlefield : [...next.players[0].zones.battlefield, ...next.players[1].zones.battlefield];
      const hasLegalTarget = candidates.some((c) => getCardDefinition(c.defId).type === 'creature' && c.instanceId !== sourceInstanceId);
      if (hasLegalTarget) {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      } else if (effect.mandatory) {
        const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
        logLines.push(`${sourceName}'s ability has no legal target.`);
      }
    } else if (effect.type === 'discardUpToThenDrawThatMany') {
      const player = getPlayer(next, playerId);
      if (player.zones.hand.length > 0 && effect.maxCount > 0) {
        next = { ...next, pendingDiscardUpToThenDraw: { sourceInstanceId, controllerId: playerId, maxCount: effect.maxCount, discardedSoFar: 0, plusOne: effect.plusOne } };
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
      next = applyDrawTriggers(next, playerId, drawn.length);
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
    } else if (effect.type === 'putCounterOnAnotherCreatureGrantsIndestructibleUntilNextTurn') {
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
      const result = beginLibrarySearch(next, playerId, sourceInstanceId, { kind: 'subtype', subtype: effect.subtype }, true, undefined, undefined, undefined, effect.toBattlefieldUntapped);
      next = result.state;
      logLines.push(...result.logLines);
    } else if (effect.type === 'searchLibraryForCreatureWithManaValueAtMost') {
      const result = beginLibrarySearch(next, playerId, sourceInstanceId, { kind: 'creatureWithManaValueAtMost', maxManaValue: effect.maxManaValue }, true);
      next = result.state;
      logLines.push(...result.logLines);
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
      const copyCandidates = effect.controlledOnly ? getPlayer(next, playerId).zones.battlefield : [...next.players[0].zones.battlefield, ...next.players[1].zones.battlefield];
      const hasLegalTarget = copyCandidates.some((c) => {
        const d = getCardDefinition(c.defId);
        return effect.creatureOnly ? d.type === 'creature' : d.type === 'artifact' || d.type === 'creature' || d.type === 'land';
      });
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        // Resolve 'fiveIfKicked' against THIS cast's own wasKicked now,
        // while it's still in scope - by the time CHOOSE_TARGET later
        // actually creates the token(s), it's long gone.
        const resolvedCount = effect.count === 'fiveIfKicked' ? (wasKicked ? 5 : 1) : effect.count ?? 1;
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect: { ...effect, count: resolvedCount } } };
      }
    } else if (effect.type === 'becomeCopyOfAnyCreatureThenAddCounters') {
      // Always has at least one legal target by the time this runs - the
      // source itself is already sitting on the battlefield (castCard pushes
      // it there before resolving onEnter), and it's a creature. No "no
      // legal target" fallback needed the way createTokenCopyOfTarget above
      // has one.
      next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect: { ...effect, counterAmount: chosenX ?? 0 } } };
    } else if (effect.type === 'debuffOpponentCreatures') {
      const opponent = getOpponent(next, playerId);
      for (const c of opponent.zones.battlefield) {
        if (getCardDefinition(c.defId).type !== 'creature') continue;
        next = applyTemporaryBuff(next, c.instanceId, effect.power, effect.toughness);
      }
      logLines.push(`Creatures ${opponent.name} controls get ${effect.power}/${effect.toughness} until end of turn.`);
    } else if (effect.type === 'millSelf') {
      const player = getPlayer(next, playerId);
      const milled = player.zones.library.slice(0, effect.count).map((c) => ({ ...c, graveyardEntrySource: 'other' as const }));
      next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(effect.count), graveyard: [...p.zones.graveyard, ...milled] } }));
      logLines.push(`${player.name} mills ${milled.length} card(s).`);
    } else if (effect.type === 'eachPlayerMills') {
      for (const p of next.players) {
        const milled = p.zones.library.slice(0, effect.count).map((c) => ({ ...c, graveyardEntrySource: 'other' as const }));
        next = updatePlayer(next, p.id, (pl) => ({ ...pl, zones: { ...pl.zones, library: pl.zones.library.slice(effect.count), graveyard: [...pl.zones.graveyard, ...milled] } }));
        logLines.push(`${p.name} mills ${milled.length} card(s).`);
      }
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
    } else if (effect.type === 'support') {
      const x = effect.count ?? chosenX ?? 0;
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      const anyCreature = next.players.some((p) =>
        p.zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'creature' && !(effect.excludeSelf && c.instanceId === sourceInstanceId))
      );
      if (x <= 0 || !anyCreature) {
        logLines.push(`${sourceName}'s support has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect, remainingPicks: x, chosenInstanceIds: [] } };
      }
    } else if (effect.type === 'damageAnyTarget') {
      // Always has a legal target (there's always at least one player) -
      // no "no legal target" fallback needed.
      next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
    } else if (effect.type === 'grantOnDeathReturnToHandToTarget') {
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      const hasLegalTarget = next.players.some((p) => p.zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'creature' && c.counters.length > 0));
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'destroyUpToOneOpponentArtifactThenPutCounterOnSelf') {
      const opponent = getOpponent(next, playerId);
      const hasArtifact = opponent.zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'artifact');
      if (!hasArtifact) {
        const resolved = resolveCardEffects(next, playerId, [{ type: 'putCounterOnSelf', counterLabel: effect.counterLabel, counterAmount: effect.counterAmount }], sourceInstanceId);
        next = resolved.state;
        next = updatePlayer(next, playerId, (p) => ({
          ...p,
          zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === sourceInstanceId ? { ...c, counterPutOnSelfThisTurn: true } : c)) },
        }));
        logLines.push(...resolved.logLines);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'ifCounterPutOnSelfThisTurn') {
      const source = findCardAnywhere(next, sourceInstanceId);
      const chosen = source?.card.counterPutOnSelfThisTurn ? effect.thenEffects : effect.elseEffects;
      const resolved = resolveCardEffects(next, playerId, chosen, sourceInstanceId, wasKicked, chosenX);
      next = resolved.state;
      logLines.push(...resolved.logLines);
    } else if (effect.type === 'ifCounterPutOnOwnCreatureThisTurn') {
      const chosen = getPlayer(next, playerId).counterPutOnOwnCreatureThisTurn ? effect.thenEffects : effect.elseEffects;
      const resolved = resolveCardEffects(next, playerId, chosen, sourceInstanceId, wasKicked, chosenX);
      next = resolved.state;
      logLines.push(...resolved.logLines);
    } else if (effect.type === 'removeAllCountersEnterWithDoubleAsCounter') {
      let removedCount = 0;
      for (const player of next.players) {
        for (const c of player.zones.battlefield) {
          const d = getCardDefinition(c.defId);
          if (c.instanceId === sourceInstanceId || (d.type !== 'artifact' && d.type !== 'creature' && d.type !== 'enchantment')) continue;
          removedCount += c.counters.reduce((sum, ctr) => sum + ctr.amount, 0);
        }
      }
      next = {
        ...next,
        players: next.players.map((p) => ({
          ...p,
          zones: {
            ...p.zones,
            battlefield: p.zones.battlefield.map((c) => {
              const d = getCardDefinition(c.defId);
              if (c.instanceId === sourceInstanceId || (d.type !== 'artifact' && d.type !== 'creature' && d.type !== 'enchantment')) return c;
              return { ...c, counters: [] };
            }),
          },
        })) as GameState['players'],
      };
      const amount = removedCount * 2;
      logLines.push(`${removedCount} counter(s) removed from other artifacts, creatures, and enchantments.`);
      if (amount > 0) {
        const resolved = resolveCardEffects(next, playerId, [{ type: 'putCounterOnSelf', counterLabel: effect.counterLabel, counterAmount: amount }], sourceInstanceId);
        next = resolved.state;
        logLines.push(...resolved.logLines);
      }
    } else if (effect.type === 'putOwnCountersOnTargetThenShuffleSelfIntoLibrary') {
      const hasLegalTarget = getPlayer(next, playerId).zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'creature');
      if (hasLegalTarget) {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      } else {
        // No other creature to put the counters on - just shuffle the
        // source (wherever moveCreaturesToGraveyard left it) into its
        // owner's library.
        const sourceFound = findCardAnywhere(next, sourceInstanceId);
        if (sourceFound) {
          const sourceDef = getCardDefinition(sourceFound.card.defId);
          next = updatePlayer(next, sourceFound.ownerPlayerId, (p) => ({
            ...p,
            zones: { ...p.zones, [sourceFound.zone]: p.zones[sourceFound.zone].filter((c) => c.instanceId !== sourceInstanceId) },
          }));
          const shuffled = shuffle([...getPlayer(next, sourceFound.ownerPlayerId).zones.library, { ...sourceFound.card, tapped: false, counters: [], damageMarked: 0 }]);
          next = updatePlayer(next, sourceFound.ownerPlayerId, (p) => ({ ...p, zones: { ...p.zones, library: shuffled } }));
          logLines.push(`${sourceDef.name} is shuffled into ${getPlayer(next, sourceFound.ownerPlayerId).name}'s library.`);
        }
      }
    } else if (effect.type === 'monstrosityByControlledCreatureCounterCount') {
      const player = getPlayer(next, playerId);
      const x = player.zones.battlefield.reduce((sum, c) => (getCardDefinition(c.defId).type === 'creature' ? sum + c.counters.reduce((s, ctr) => s + ctr.amount, 0) : sum), 0);
      next = updatePlayer(next, playerId, (p) => ({
        ...p,
        zones: {
          ...p.zones,
          battlefield: p.zones.battlefield.map((c) => {
            if (c.instanceId !== sourceInstanceId) return c;
            const hasCounter = c.counters.some((ctr) => ctr.label === effect.counterLabel);
            const counters = hasCounter
              ? c.counters.map((ctr) => (ctr.label === effect.counterLabel ? { ...ctr, amount: ctr.amount + x } : ctr))
              : [...c.counters, { label: effect.counterLabel, amount: x }];
            return { ...c, counters, monstrous: true };
          }),
        },
      }));
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      logLines.push(`${sourceName} becomes monstrous, putting ${x} ${effect.counterLabel} counter(s) on it.`);
    } else if (effect.type === 'repeatProliferateByNontokenCreaturesEnteredThisTurn') {
      const player = getPlayer(next, playerId);
      const x = player.zones.battlefield.filter((c) => !c.isToken && getCardDefinition(c.defId).type === 'creature' && c.summoningSick).length;
      if (x <= 0) {
        logLines.push(`${player.name} has no nontoken creatures that entered this turn - nothing to proliferate.`);
      } else {
        const resolved = resolveCardEffects(next, playerId, [{ type: 'proliferate', remainingIterations: x }], sourceInstanceId);
        next = resolved.state;
        logLines.push(...resolved.logLines);
      }
    } else if (effect.type === 'ronsoRage') {
      // The counter-on-self half is unconditional and immediate; the
      // tap-and-maybe-copy half only arms if the opponent has a creature.
      const resolved = resolveCardEffects(next, playerId, [{ type: 'putCounterOnSelf', counterLabel: effect.counterLabel, counterAmount: effect.counterAmount }], sourceInstanceId);
      next = resolved.state;
      logLines.push(...resolved.logLines);
      const opponent = getOpponent(next, playerId);
      const hasLegalTarget = opponent.zones.battlefield.some((c) => getCardDefinition(c.defId).type === 'creature');
      if (hasLegalTarget) {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'drawForCreaturesWithCounterThenGrantIndestructible') {
      const player = getPlayer(next, playerId);
      const qualifying = player.zones.battlefield.filter(
        (c) => getCardDefinition(c.defId).type === 'creature' && c.counters.some((ctr) => ctr.label === effect.counterLabel && ctr.amount > 0)
      );
      if (qualifying.length > 0) {
        const drawn = player.zones.library.slice(0, qualifying.length);
        next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, library: p.zones.library.slice(qualifying.length), hand: [...p.zones.hand, ...drawn] } }));
        for (const c of qualifying) {
          next = grantTemporaryKeyword(next, c.instanceId, 'indestructible');
        }
        logLines.push(`${player.name} draws ${qualifying.length} card(s); those creatures gain indestructible until end of turn.`);
      } else {
        logLines.push(`${player.name} has no creature with a ${effect.counterLabel} counter - nothing happens.`);
      }
    } else if (effect.type === 'exileTargetCreatureThenControllerMaySearchBasicLand') {
      const hasLegalTarget = [...next.players[0].zones.battlefield, ...next.players[1].zones.battlefield].some((c) => getCardDefinition(c.defId).type === 'creature');
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'exileTargetCreatureThenControllerGainsLifeEqualToPower') {
      const hasLegalTarget = [...next.players[0].zones.battlefield, ...next.players[1].zones.battlefield].some((c) => getCardDefinition(c.defId).type === 'creature');
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    } else if (effect.type === 'putTargetNonlandPermanentInLibraryOwnersChoice') {
      const hasLegalTarget = [...next.players[0].zones.battlefield, ...next.players[1].zones.battlefield].some((c) => getCardDefinition(c.defId).type !== 'land');
      const sourceName = getCardDefinition(findCardAnywhere(next, sourceInstanceId)!.card.defId).name;
      if (!hasLegalTarget) {
        logLines.push(`${sourceName}'s ability has no legal target.`);
      } else {
        next = { ...next, pendingTarget: { sourceInstanceId, controllerId: playerId, effect } };
      }
    }
  }

  return { state: next, logLines };
}

/** "If one or more [counterLabel] counters would be put on a creature you
 * control, that many plus one are put on it instead." (Hardened Scales) - a
 * REPLACEMENT effect on the AMOUNT of an about-to-happen counter placement,
 * checked against `recipientControllerId`'s own battlefield (Hardened
 * Scales' "a creature YOU control" means ITS OWN controller, who must be the
 * same player as the counter's recipient for this to apply at all - an
 * opponent's Hardened Scales never boosts counters landing on YOUR
 * creatures). Stacks additively - two Hardened Scales-style permanents add
 * two. Generalized via CardDefinition.increasesOwnCounterPlacementsByOne
 * (which counter label it cares about) rather than hardcoding '+1/+1', so
 * any future card with the same shape for a different counter type can
 * reuse this unchanged. Called from only a HANDFUL of the most common
 * counter-adding call sites (same deliberately-incomplete-coverage
 * convention as applyCounterPlacementSideEffects right below, which every
 * one of those same call sites already calls alongside this) - there is no
 * single engine-wide choke point every counter-adding site funnels through
 * the way engine/combat.ts: markDamage is for damage. */
export function hardenedScalesAdjustedAmount(state: GameState, recipientControllerId: string, counterLabel: string, amount: number): number {
  if (amount <= 0) return amount;
  const bonus = getPlayer(state, recipientControllerId).zones.battlefield.filter(
    (c) => getCardDefinition(c.defId).increasesOwnCounterPlacementsByOne === counterLabel
  ).length;
  return amount + bonus;
}

/** Checks the two generic "a counter was just placed on [permanent]" watcher
 * shapes this engine supports, right after a counter has actually been
 * added to `recipientInstanceId` by `actingPlayerId`:
 *  - "Whenever a [counterLabel] counter is put on this creature, [effect]."
 *    (Fathom Mage) - CardDefinition.onOwnCounterAddedTrigger, checked
 *    against the RECIPIENT's own definition.
 *  - "Whenever you put one or more counters on a creature you don't
 *    control, [effect]." (Generous Patron) - CardDefinition.
 *    onOwnCounterPlacedOnOpponentCreatureTrigger, checked against every
 *    permanent the ACTING player controls.
 * Called from only a HANDFUL of the most common counter-adding call sites
 * (putCounterOnSelf, putCounterOnTarget, support's chooseTarget resolution) -
 * same deliberately-incomplete-coverage convention as PlayerState.
 * counterPutOnOwnCreatureThisTurn, not a comprehensive "any counter from any
 * source" tracker. "Don't control" is approximated as "doesn't OWN", same
 * owner/controller conflation this engine already makes everywhere outside
 * genuine temporary-control-change cards. */
export function applyCounterPlacementSideEffects(state: GameState, actingPlayerId: string, recipientInstanceId: string, counterLabel: string): { state: GameState; logLines: string[] } {
  let next = state;
  const logLines: string[] = [];
  const recipientFound = findCardAnywhere(next, recipientInstanceId);
  if (!recipientFound || recipientFound.zone !== 'battlefield') return { state: next, logLines };
  const recipientDef = getCardDefinition(recipientFound.card.defId);
  if (recipientDef.onOwnCounterAddedTrigger && recipientDef.onOwnCounterAddedTrigger.counterLabel === counterLabel) {
    const resolved = resolveCardEffects(next, recipientFound.ownerPlayerId, recipientDef.onOwnCounterAddedTrigger.effects, recipientInstanceId);
    next = resolved.state;
    logLines.push(...resolved.logLines);
  }
  if (recipientFound.ownerPlayerId !== actingPlayerId) {
    for (const watcher of getPlayer(next, actingPlayerId).zones.battlefield) {
      const watcherDef = getCardDefinition(watcher.defId);
      if (!watcherDef.onOwnCounterPlacedOnOpponentCreatureTrigger || watcherDef.onOwnCounterPlacedOnOpponentCreatureTrigger.length === 0) continue;
      const resolved = resolveCardEffects(next, actingPlayerId, watcherDef.onOwnCounterPlacedOnOpponentCreatureTrigger, watcher.instanceId);
      next = resolved.state;
      logLines.push(...resolved.logLines);
    }
  }
  // "Whenever you put one or more counters on a creature, until end of turn,
  // that creature can't be blocked by creatures your opponents control."
  // (Rikku, Resourceful Guardian) - grants the keyword straight to the
  // RECIPIENT (no ownership restriction stated on "a creature"), checked
  // against every permanent the ACTING player controls (unlike the two
  // checks above, Rikku watches her OWN controller's counter placements
  // regardless of who the recipient is).
  for (const watcher of getPlayer(next, actingPlayerId).zones.battlefield) {
    const watcherDef = getCardDefinition(watcher.defId);
    if (!watcherDef.onOwnCounterPlacementGrantsRecipientKeyword) continue;
    next = grantTemporaryKeyword(next, recipientInstanceId, watcherDef.onOwnCounterPlacementGrantsRecipientKeyword);
    logLines.push(`${recipientDef.name} can't be blocked by creatures opponents control this turn (${watcherDef.name}).`);
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

/** Legend rule - purely a reminder LOG LINE, not actual enforcement (this
 * engine never auto-sacrifices anything; players self-adjudicate which copy
 * to keep). Called from every "a permanent just entered" code path in
 * engine/actions.ts, and from PlayHideawayCardEffect below (moved here, out
 * of actions.ts, specifically so both files - and this one's own
 * resolveCardEffects - can call it without a circular import). */
export function checkLegendRule(state: GameState, playerId: string): GameState {
  const player = getPlayer(state, playerId);
  const legendaryNames = new Map<string, number>();
  for (const c of player.zones.battlefield) {
    const def = getCardDefinition(c.defId);
    if (def.subtype?.toLowerCase().includes('legendary')) {
      legendaryNames.set(def.name, (legendaryNames.get(def.name) ?? 0) + 1);
    }
  }
  let next = state;
  for (const [name, count] of legendaryNames) {
    if (count > 1) next = { ...next, log: [...next.log, `Legend rule: ${player.name} controls ${count} copies of ${name} - choose one to keep, move the rest to your graveyard.`] };
  }
  return next;
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

/** Releases every GameState.exileUntilMonarchChangesFrom entry whose
 * exiler is no longer the (current) monarch - called right after
 * `state.monarchPlayerId` is reassigned, whether via BecomeMonarchEffect
 * or a creature stealing the monarchy via combat damage (see
 * engine/actions.ts: applyCombatDamageToPlayerTriggers). Returns each
 * released card to its OWNER's battlefield (summoning sick, same as any
 * other fresh "exile until X" return elsewhere in this engine). */
export function releaseExiledUntilMonarchChanges(state: GameState): { state: GameState; logLines: string[] } {
  let next = state;
  const logLines: string[] = [];
  const toRelease = next.exileUntilMonarchChangesFrom.filter((e) => e.exilingControllerId !== next.monarchPlayerId);
  const toKeep = next.exileUntilMonarchChangesFrom.filter((e) => e.exilingControllerId === next.monarchPlayerId);
  for (const entry of toRelease) {
    const owner = getPlayer(next, entry.ownerPlayerId);
    const exiledCard = owner.zones.exile.find((c) => c.instanceId === entry.exiledInstanceId);
    if (!exiledCard) continue;
    next = updatePlayer(next, entry.ownerPlayerId, (p) => ({
      ...p,
      zones: { ...p.zones, exile: p.zones.exile.filter((c) => c.instanceId !== entry.exiledInstanceId), battlefield: [...p.zones.battlefield, { ...exiledCard, summoningSick: true }] },
    }));
    logLines.push(`${getCardDefinition(exiledCard.defId).name} returns to the battlefield - the monarchy changed.`);
  }
  next = { ...next, exileUntilMonarchChangesFrom: toKeep };
  return { state: next, logLines };
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

/** "Whenever [this] or another [Subtype] you control enters, and whenever
 * a[n] [OtherSubtype] you control enters, ..." (Giott, King of the
 * Dwarves) - see types.ts: CardDefinition.onAnyControlledSubtypeEnterTrigger.
 * Called once right after ANY permanent enters the battlefield (see
 * engine/actions.ts: castCard/castFromGraveyard), passing that permanent's
 * OWN subtype text - checked against every controlled permanent's watcher
 * (including the just-entered one itself, if its own subtype also
 * matches its own watcher, exactly like Giott watching for his own
 * Dwarf-ness). */
export function triggerSubtypeEnterWatchers(state: GameState, playerId: string, enteredSubtype: string | undefined): { state: GameState; logLines: string[] } {
  let next = state;
  const logLines: string[] = [];
  if (!enteredSubtype) return { state: next, logLines };

  for (const card of getPlayer(next, playerId).zones.battlefield) {
    const def = getCardDefinition(card.defId);
    const watch = def.onAnyControlledSubtypeEnterTrigger;
    if (!watch) continue;
    if (!watch.subtypes.some((s) => enteredSubtype.toLowerCase().includes(s.toLowerCase()))) continue;
    const resolved = resolveCardEffects(next, playerId, watch.effects, card.instanceId);
    next = resolved.state;
    logLines.push(...resolved.logLines);
  }

  return { state: next, logLines };
}

/** "Whenever another creature you control enters, [effect]" (Loporrit
 * Scout) - see types.ts: CardDefinition.onAnyOtherControlledCreatureEnterTrigger.
 * Called once right after ANY creature enters the battlefield, excluding
 * the just-entered card itself from the watcher list ("another"). */
export function triggerCreatureEnterWatchers(
  state: GameState,
  playerId: string,
  enteredInstanceId: string,
  // "...entered from a graveyard or was cast from a graveyard..." (Celes,
  // Rune Knight) - true only when THIS call site is genuinely a
  // graveyard-sourced entry (see CardDefinition.
  // onAnyOtherControlledCreatureEnterFromGraveyardPutCounterOnAllControlledCreatures's
  // own doc comment for which call sites set this).
  fromGraveyard?: boolean
): { state: GameState; logLines: string[] } {
  let next = state;
  const logLines: string[] = [];

  // "Creatures your opponents control enter tapped. Whenever a creature
  // an opponent controls enters, you gain [lifeGain] life." (Authority of
  // the Consuls) - checked against the ENTERING creature's controller's
  // OPPONENT's battlefield (watcher.controller must be an opponent of
  // playerId), tapping the entering creature retroactively since this
  // runs right after entry. Known gap: a token entering via CreateTokenEffect
  // never calls this hook at all (same limitation already accepted
  // elsewhere for this exact watcher point), so it won't see this bonus.
  const consulsOpponent = getOpponent(next, playerId);
  const consulsWatchers = consulsOpponent.zones.battlefield.filter((c) => getCardDefinition(c.defId).opponentCreaturesEnterTappedAndYouGainLife);
  if (consulsWatchers.length > 0) {
    const entered = findCardAnywhere(next, enteredInstanceId);
    if (entered && entered.zone === 'battlefield' && getCardDefinition(entered.card.defId).type === 'creature') {
      next = updatePlayer(next, playerId, (p) => ({
        ...p,
        zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === enteredInstanceId ? { ...c, tapped: true } : c)) },
      }));
      for (const watcher of consulsWatchers) {
        const watcherDef = getCardDefinition(watcher.defId);
        const { lifeGain } = watcherDef.opponentCreaturesEnterTappedAndYouGainLife!;
        next = addLife(next, consulsOpponent.id, lifeGain);
        logLines.push(`${watcherDef.name} triggers: ${getCardDefinition(entered.card.defId).name} enters tapped, ${consulsOpponent.name} gains ${lifeGain} life.`);
      }
    }
  }

  for (const card of getPlayer(next, playerId).zones.battlefield) {
    if (card.instanceId === enteredInstanceId) continue;
    const def = getCardDefinition(card.defId);
    if (def.onAnyOtherControlledCreatureEnterTrigger && def.onAnyOtherControlledCreatureEnterTrigger.length > 0) {
      const resolved = resolveCardEffects(next, playerId, def.onAnyOtherControlledCreatureEnterTrigger, card.instanceId);
      next = resolved.state;
      logLines.push(...resolved.logLines);
    }
    if (fromGraveyard && def.onAnyOtherControlledCreatureEnterFromGraveyardPutCounterOnAllControlledCreatures) {
      next = updatePlayer(next, playerId, (p) => ({
        ...p,
        zones: {
          ...p.zones,
          battlefield: p.zones.battlefield.map((c) => {
            if (getCardDefinition(c.defId).type !== 'creature') return c;
            const hasCounter = c.counters.some((ctr) => ctr.label === '+1/+1');
            const counters = hasCounter
              ? c.counters.map((ctr) => (ctr.label === '+1/+1' ? { ...ctr, amount: ctr.amount + 1 } : ctr))
              : [...c.counters, { label: '+1/+1', amount: 1 }];
            return { ...c, counters };
          }),
        },
      }));
      logLines.push(`${def.name} triggers: every creature ${getPlayer(next, playerId).name} controls gets a +1/+1 counter.`);
    }
    // "Whenever your commander enters or attacks, [effects]." (Tome of
    // Legends) - the "enters" half; see finalizeDeclareAttackers for the
    // "attacks" half.
    if (def.onCommanderEnterOrAttack && def.onCommanderEnterOrAttack.length > 0) {
      const entered = findCardAnywhere(next, enteredInstanceId);
      const owner = getPlayer(next, playerId);
      if (entered && owner.commanderDefId && frontFaceDefId(entered.card.defId) === owner.commanderDefId) {
        const resolved = resolveCardEffects(next, playerId, def.onCommanderEnterOrAttack, card.instanceId);
        next = resolved.state;
        logLines.push(...resolved.logLines);
      }
    }
    // "Each other nontoken creature you control enters with an additional
    // [counterLabel] counter on it." (Tromell, Seymour's Butler) - applied
    // directly to the JUST-ENTERED creature, unlike the generic watcher
    // above (which only ever gets the WATCHER itself as sourceInstanceId).
    if (def.grantsOtherNontokenCreaturesExtraCounterOnEnter) {
      const enteredFound = findCardAnywhere(next, enteredInstanceId);
      if (enteredFound && !enteredFound.card.isToken) {
        const { counterLabel, counterAmount } = def.grantsOtherNontokenCreaturesExtraCounterOnEnter;
        next = updatePlayer(next, playerId, (p) => ({
          ...p,
          zones: {
            ...p.zones,
            battlefield: p.zones.battlefield.map((c) => {
              if (c.instanceId !== enteredInstanceId) return c;
              const hasCounter = c.counters.some((ctr) => ctr.label === counterLabel);
              const counters = hasCounter
                ? c.counters.map((ctr) => (ctr.label === counterLabel ? { ...ctr, amount: ctr.amount + counterAmount } : ctr))
                : [...c.counters, { label: counterLabel, amount: counterAmount }];
              return { ...c, counters };
            }),
          },
        }));
        logLines.push(`${def.name} gives ${getCardDefinition(enteredFound.card.defId).name} an additional ${counterLabel} counter.`);
      }
    }
    // Evolve (real MTG keyword): "Whenever a creature enters under your
    // control, if that creature has greater power or toughness than this
    // creature, put a +1/+1 counter on this creature." Compared against the
    // Evolve creature's OWN current stats (read before any counter from this
    // is added), one side being greater is sufficient. Naturally never
    // self-triggers since the loop already skips enteredInstanceId.
    if (def.evolve) {
      const enteredFound = findCardAnywhere(next, enteredInstanceId);
      if (enteredFound) {
        const enteredDef = getCardDefinition(enteredFound.card.defId);
        if (enteredDef.type === 'creature') {
          const enteredPower = effectivePower(enteredDef, enteredFound.card, next, playerId);
          const enteredToughness = effectiveToughness(enteredDef, enteredFound.card, next, playerId);
          const selfPower = effectivePower(def, card, next, playerId);
          const selfToughness = effectiveToughness(def, card, next, playerId);
          if (enteredPower > selfPower || enteredToughness > selfToughness) {
            const resolved = resolveCardEffects(next, playerId, [{ type: 'putCounterOnSelf', counterLabel: '+1/+1', counterAmount: 1 }], card.instanceId);
            next = resolved.state;
            logLines.push(`Evolve: ${def.name} triggers.`, ...resolved.logLines);
          }
        }
      }
    }
    // "Whenever another creature you control enters, put a [counterLabel]
    // counter on that creature if its power is less than this creature's
    // power. Otherwise, put a [counterLabel] counter on this creature."
    // (Shelinda Yevon, Acolyte) - same "compare against own current stats,
    // read before either counter is added" timing as Evolve above.
    if (def.onAnyOtherControlledCreatureEnterComparePowerPutCounter) {
      const enteredFound = findCardAnywhere(next, enteredInstanceId);
      if (enteredFound) {
        const enteredDef = getCardDefinition(enteredFound.card.defId);
        if (enteredDef.type === 'creature') {
          const { counterLabel } = def.onAnyOtherControlledCreatureEnterComparePowerPutCounter;
          const enteredPower = effectivePower(enteredDef, enteredFound.card, next, playerId);
          const selfPower = effectivePower(def, card, next, playerId);
          const recipientId = enteredPower < selfPower ? enteredInstanceId : card.instanceId;
          const resolved = resolveCardEffects(next, playerId, [{ type: 'putCounterOnSelf', counterLabel, counterAmount: 1 }], recipientId);
          next = resolved.state;
          logLines.push(`${def.name} triggers.`, ...resolved.logLines);
        }
      }
    }
    // "Whenever a creature you control enters, [effects]." (Path of
    // Discovery's "it explores") - unlike onAnyOtherControlledCreatureEnterTrigger
    // above, resolves with the ENTERED creature as source, matching "it" in
    // the printed text.
    if (def.onAnyControlledCreatureEnterEffects && def.onAnyControlledCreatureEnterEffects.length > 0) {
      const enteredFound = findCardAnywhere(next, enteredInstanceId);
      if (enteredFound && getCardDefinition(enteredFound.card.defId).type === 'creature') {
        const resolved = resolveCardEffects(next, playerId, def.onAnyControlledCreatureEnterEffects, enteredInstanceId);
        next = resolved.state;
        logLines.push(...resolved.logLines);
      }
    }
    // "Whenever a legendary creature you control enters, you may attach this
    // Equipment to it." (Hero's Blade) - the entered permanent's own type
    // check already excludes the Equipment's own entry (an Equipment is
    // never a creature).
    if (def.mayAttachSelfToControlledLegendaryCreatureOnEnter) {
      const enteredFound = findCardAnywhere(next, enteredInstanceId);
      if (enteredFound && getCardDefinition(enteredFound.card.defId).type === 'creature' && getCardDefinition(enteredFound.card.defId).subtype?.toLowerCase().includes('legendary creature')) {
        next = { ...next, pendingMayEffect: { sourceInstanceId: card.instanceId, controllerId: playerId, effects: [{ type: 'attachSelfToFixedTarget', targetInstanceId: enteredInstanceId }] } };
        logLines.push(`${def.name} may attach itself to ${getCardDefinition(enteredFound.card.defId).name}.`);
      }
    }
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
    if (def.landfall.discardUpToOneThenDraw) {
      const resolved = resolveCardEffects(next, playerId, [{ type: 'discardUpToThenDrawThatMany', maxCount: 1 }], card.instanceId);
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

/** "Whenever a land an opponent controls enters, if that player controls
 * more lands than you, [effects]." (Archaeomancer's Map) - `enteringPlayerId`
 * is whoever just played the land; checked against the OTHER player's
 * battlefield for CardDefinition.onOpponentLandEnterIfTheyHaveMoreLands,
 * gated on enteringPlayerId's land count being strictly greater than the
 * watcher's controller's own land count (both counted live, right now). */
export function triggerOpponentLandEnterWatchers(state: GameState, enteringPlayerId: string): { state: GameState; logLines: string[] } {
  let next = state;
  const logLines: string[] = [];
  const watcherPlayer = getOpponent(next, enteringPlayerId);
  const countLands = (p: GameState['players'][number]) => p.zones.battlefield.filter((c) => getCardDefinition(c.defId).type === 'land').length;
  if (countLands(getPlayer(next, enteringPlayerId)) <= countLands(watcherPlayer)) return { state: next, logLines };

  for (const card of watcherPlayer.zones.battlefield) {
    const def = getCardDefinition(card.defId);
    if (!def.onOpponentLandEnterIfTheyHaveMoreLands || def.onOpponentLandEnterIfTheyHaveMoreLands.effects.length === 0) continue;
    const resolved = resolveCardEffects(next, watcherPlayer.id, def.onOpponentLandEnterIfTheyHaveMoreLands.effects, card.instanceId);
    next = resolved.state;
    logLines.push(`${def.name} triggers.`, ...resolved.logLines);
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
  eligibleInstanceIds?: Set<string>,
  // The just-cast spell's own CardType (Fandaniel, Telophoroi Ascian's
  // "instant or sorcery spell" restriction - see
  // NoncreatureCastTrigger.instantOrSorceryOnly). Every call site has this
  // in scope already (it's the same `def` that gated the call in the
  // first place); optional only so existing callers that genuinely have
  // no spell type to report (there are none left, but kept defensive)
  // don't need updating.
  castType?: CardType
): { state: GameState; logLines: string[] } {
  let next = state;
  const logLines: string[] = [];

  // "Whenever you cast a noncreature spell this turn, create a token
  // that's a copy of a non-Saga token you control." (Summon: Good King Mog
  // XII's chapters II/III) - a player-level grant, not tied to any one
  // still-on-the-battlefield permanent; see PlayerState.
  // temporaryNoncreatureCastCreatesTokenCopyUntilEndOfTurn's own doc
  // comment.
  if (getPlayer(next, playerId).temporaryNoncreatureCastCreatesTokenCopyUntilEndOfTurn) {
    const tokenToCopy = getPlayer(next, playerId).zones.battlefield.find((c) => c.isToken && !getCardDefinition(c.defId).saga);
    if (tokenToCopy) {
      const tokenDef = getCardDefinition(tokenToCopy.defId);
      const copy: CardInstance = { ...tokenToCopy, instanceId: nextInstanceId(), attachedToInstanceId: undefined, counters: [], damageMarked: 0, tapped: false, summoningSick: true };
      next = updatePlayer(next, playerId, (p) => ({ ...p, zones: { ...p.zones, battlefield: [...p.zones.battlefield, copy] } }));
      logLines.push(`${getPlayer(next, playerId).name} creates a token copy of ${tokenDef.name}.`);
    }
  }

  function applyTrigger(card: CardInstance, def: CardDefinition, trigger: NoncreatureCastTrigger) {
    if (trigger.instantOrSorceryOnly && castType !== 'instant' && castType !== 'sorcery') return;
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
    if (trigger.drawCardsIfExpensive && manaSpent >= trigger.drawCardsIfExpensive.minManaValue) {
      const resolved = resolveCardEffects(next, playerId, [{ type: 'drawCards', amount: trigger.drawCardsIfExpensive.amount }], card.instanceId);
      next = resolved.state;
      logLines.push(...resolved.logLines);
    }
    if (trigger.sacrificeSelfAndDealDamageEqualToManaSpentIfExpensive && manaSpent >= trigger.sacrificeSelfAndDealDamageEqualToManaSpentIfExpensive.minManaValue) {
      const opponent = getOpponent(next, playerId);
      const amount = manaSpent * damageMultiplierFor(next, playerId, def);
      next = loseLife(next, opponent.id, amount);
      const casterName = getPlayer(next, playerId).name;
      const sacResult = moveCreaturesToGraveyardAndTrigger(next, [card.instanceId], 'is sacrificed');
      next = sacResult.state;
      logLines.push(`${casterName} sacrifices ${def.name}: ${opponent.name} loses ${amount} life.`, ...sacResult.logLines);
    }
    if (trigger.damageEachOpponentAndGainLifeIfManaValueAtLeast && manaSpent >= trigger.damageEachOpponentAndGainLifeIfManaValueAtLeast.minManaValue) {
      const { amount } = trigger.damageEachOpponentAndGainLifeIfManaValueAtLeast;
      const opponent = getOpponent(next, playerId);
      const dealt = amount * damageMultiplierFor(next, playerId, def);
      next = loseLife(next, opponent.id, dealt);
      next = addLife(next, playerId, amount);
      next = applyGainLifeTriggers(next, playerId);
      logLines.push(`${def.name} triggers: ${opponent.name} loses ${dealt} life and ${getPlayer(next, playerId).name} gains ${amount} life.`);
    }
    if (trigger.mayPayLifeEqualToManaSpentCreateHeroTokenOncePerTurn && !card.throwWideTheGatesTriggeredThisTurn) {
      next = updatePlayer(next, playerId, (p) => ({
        ...p,
        zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === card.instanceId ? { ...c, throwWideTheGatesTriggeredThisTurn: true } : c)) },
      }));
      next = { ...next, pendingThrowWideTheGatesChoice: { sourceInstanceId: card.instanceId, controllerId: playerId, manaValue: manaSpent } };
      logLines.push(`${def.name} triggers: ${getPlayer(next, playerId).name} may pay ${manaSpent} life to create a Hero token.`);
    }
    if (trigger.mayReturnCreatureFromGraveyardWithManaValueEqualToSpentOncePerTurn && !card.traceAetherTriggeredThisTurn) {
      const hasLegalTarget = getPlayer(next, playerId).zones.graveyard.some((c) => getCardDefinition(c.defId).type === 'creature' && manaValue(parseCostLabel(getCardDefinition(c.defId).costLabel)) === manaSpent);
      if (hasLegalTarget) {
        next = updatePlayer(next, playerId, (p) => ({
          ...p,
          zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === card.instanceId ? { ...c, traceAetherTriggeredThisTurn: true } : c)) },
        }));
        next = { ...next, pendingTarget: { sourceInstanceId: card.instanceId, controllerId: playerId, effect: { type: 'returnTargetCreatureFromGraveyardWithManaValueEqualTo', manaValue: manaSpent } } };
        logLines.push(`${def.name} triggers: ${getPlayer(next, playerId).name} may return a creature card with mana value ${manaSpent} from their graveyard to their hand.`);
      }
    }
    if (trigger.effects && trigger.effects.length > 0) {
      const resolved = resolveCardEffects(next, playerId, trigger.effects, card.instanceId);
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

/** "Whenever an opponent casts a spell, put N counters of this label on THIS
 * permanent[, and you gain M life]" (Sunscorch Regent) - checked against the
 * CASTER's opponent's battlefield right after any spell (creature or
 * noncreature - lands never reach this call, see engine/actions.ts:
 * castCard) finishes resolving. */
export function triggerOpponentCastSpellWatchers(state: GameState, casterId: string): { state: GameState; logLines: string[] } {
  let next = state;
  const logLines: string[] = [];
  const opponent = getOpponent(next, casterId);
  for (const card of opponent.zones.battlefield) {
    const def = getCardDefinition(card.defId);
    if (!def.onOpponentCastsSpell) continue;
    const { counterLabel, counterAmount, alsoGainLife } = def.onOpponentCastsSpell;
    next = updatePlayer(next, opponent.id, (p) => ({
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
    if (alsoGainLife) next = addLife(next, opponent.id, alsoGainLife);
    const lifeNote = alsoGainLife ? ` and ${opponent.name} gains ${alsoGainLife} life` : '';
    logLines.push(`${def.name} triggers: gets a ${counterLabel} counter${lifeNote}.`);
  }
  return { state: next, logLines };
}

/** "Whenever a player casts a spell..." (Forgotten Ancient) - broader than
 * triggerOpponentCastSpellWatchers above (which only scans the CASTER's
 * opponent's battlefield for a fixed-shape trigger): this scans BOTH
 * players' battlefields regardless of who cast the spell, including the
 * watcher's own controller, and dispatches through the generic
 * resolveCardEffects/CardEffect[] pipeline instead of a bespoke counter+life
 * shape. */
export function triggerAnyPlayerCastSpellWatchers(state: GameState, casterId: string, castDef?: CardDefinition): { state: GameState; logLines: string[] } {
  let next = state;
  const logLines: string[] = [];
  const castColors = castDef ? Object.keys(parseCostLabel(castDef.costLabel).colors) : [];
  // "Historic" (Elena, Turk Recruit's "Whenever you cast a historic spell,
  // put a +1/+1 counter on Elena") - artifact (def.type, not subtype - same
  // convention as every other artifact count in this engine), Saga, or
  // legendary.
  const isHistoricCast = !!castDef && (castDef.type === 'artifact' || !!castDef.saga || !!castDef.subtype?.toLowerCase().includes('legendary'));
  for (const player of next.players) {
    for (const card of player.zones.battlefield) {
      const def = getCardDefinition(card.defId);
      if (def.onAnyPlayerCastsSpellTrigger && def.onAnyPlayerCastsSpellTrigger.length > 0) {
        const resolved = resolveCardEffects(next, player.id, def.onAnyPlayerCastsSpellTrigger, card.instanceId);
        next = resolved.state;
        logLines.push(...resolved.logLines);
      }
      // "Whenever YOU cast a spell, [effects]." (Inexorable Tide's
      // "proliferate") - unlike onAnyPlayerCastsSpellTrigger above, only the
      // watcher's OWN controller casting triggers this, same restriction as
      // triggerOpponentCastSpellWatchers but for self instead of opponent.
      // Checked in this same loop/call site rather than a parallel traversal.
      if (player.id === casterId && def.onOwnCastAnySpellTrigger && def.onOwnCastAnySpellTrigger.length > 0) {
        const resolved = resolveCardEffects(next, player.id, def.onOwnCastAnySpellTrigger, card.instanceId);
        next = resolved.state;
        logLines.push(...resolved.logLines);
      }
      // "Whenever you cast a [color] spell, [effects]." (Ardbert, Warrior of
      // Darkness) - same self-only restriction as onOwnCastAnySpellTrigger,
      // further filtered to spells actually having that color; a
      // multicolor spell can fire more than one matching entry.
      if (player.id === casterId && def.onOwnCastColorSpellTrigger) {
        for (const entry of def.onOwnCastColorSpellTrigger) {
          if (!castColors.includes(entry.color)) continue;
          const resolved = resolveCardEffects(next, player.id, entry.effects, card.instanceId);
          next = resolved.state;
          logLines.push(...resolved.logLines);
        }
      }
      // "Whenever you cast a historic spell, put a +1/+1 counter on Elena."
      // (Elena, Turk Recruit) - same self-only restriction as
      // onOwnCastAnySpellTrigger, further filtered to historic spells.
      if (player.id === casterId && isHistoricCast && def.onOwnCastHistoricSpellTrigger && def.onOwnCastHistoricSpellTrigger.length > 0) {
        const resolved = resolveCardEffects(next, player.id, def.onOwnCastHistoricSpellTrigger, card.instanceId);
        next = resolved.state;
        logLines.push(...resolved.logLines);
      }
      // "Whenever you cast an Aura, Equipment, or Vehicle spell, draw a
      // card." (Sram, Senior Edificer) - same self-only restriction, matched
      // against the cast spell's own subtype text instead of a fixed
      // "historic" test.
      if (player.id === casterId && def.onOwnCastSubtypeSpellTrigger && castDef?.subtype && def.onOwnCastSubtypeSpellTrigger.subtypes.some((s) => castDef.subtype!.toLowerCase().includes(s.toLowerCase()))) {
        const resolved = resolveCardEffects(next, player.id, def.onOwnCastSubtypeSpellTrigger.effects, card.instanceId);
        next = resolved.state;
        logLines.push(...resolved.logLines);
      }
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
  // Bug caught by testing Summon: Ixion (chapters [1], [2, 3],
  // sacrificeAfterFinalChapter) - the old check was
  // `matchingChapters.some((ch) => ch.numbers.includes(maxChapterNumber))`,
  // which for a shared final chapter spanning multiple numbers (e.g. [2, 3])
  // was true the moment lore reached 2, since THAT chapter's own numbers
  // array happens to also contain 3 - sacrificing a full lore counter
  // early, before chapter 3 (the actual final chapter) ever triggered. The
  // correct check is simply whether the counter itself just reached the
  // true final number - identical result for every single-number final
  // chapter (the overwhelmingly common case), but correctly waits for the
  // LAST number in a shared final chapter like this one.
  const reachedFinalChapterThisTime = newCount === maxChapterNumber;
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

/** "Return this card from your graveyard to the battlefield [tapped], with
 * a [counterLabel] counter on it" (Relentless X-ATM092) - like
 * returnFromGraveyardTransformed, but comes back AS ITSELF rather than a
 * different back face (no CardDefinition.transformsInto needed). See
 * types.ts: CardAbility.returnSelfFromGraveyard. */
export function returnSelfFromGraveyard(
  state: GameState,
  playerId: string,
  instanceId: string,
  opts: { tapped?: boolean; counterLabel?: string; counterAmount?: number }
): { state: GameState; logLines: string[] } {
  const player = getPlayer(state, playerId);
  const card = player.zones.graveyard.find((c) => c.instanceId === instanceId);
  if (!card) return { state, logLines: [] };
  const def = getCardDefinition(card.defId);

  const newInstanceId = nextInstanceId();
  const hasHaste = hasKeyword(def, 'haste');
  const counters = opts.counterLabel ? [{ label: opts.counterLabel, amount: opts.counterAmount ?? 1 }] : [];
  const newCard: CardInstance = {
    instanceId: newInstanceId,
    defId: def.id,
    ownerId: playerId,
    tapped: !!opts.tapped || !!def.entersTapped,
    counters,
    damageMarked: 0,
    summoningSick: !hasHaste,
  };
  let next = updatePlayer(state, playerId, (p) => ({
    ...p,
    zones: { ...p.zones, graveyard: p.zones.graveyard.filter((c) => c.instanceId !== instanceId), battlefield: [...p.zones.battlefield, newCard] },
  }));

  const counterNote = opts.counterLabel ? ` with a ${opts.counterLabel} counter on it` : '';
  const logLines = [`${def.name} returns from the graveyard to the battlefield${opts.tapped ? ' tapped' : ''}${counterNote}.`];
  if (def.onEnter && def.onEnter.length > 0) {
    const resolved = resolveCardEffects(next, playerId, def.onEnter, newInstanceId);
    next = resolved.state;
    logLines.push(...resolved.logLines);
  }
  if (def.saga) {
    const sagaResult = triggerSagaLoreCounter(next, playerId, newInstanceId);
    next = sagaResult.state;
    logLines.push(...sagaResult.logLines);
  }

  return { state: next, logLines };
}
