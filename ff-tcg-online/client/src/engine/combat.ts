// ============================================================================
// engine/combat.ts
// ============================================================================

import { CardDefinition, CardInstance, GameState } from '../types';
import { getCardDefinition } from '../data/cards';
import { getOpponent, updatePlayer, detachEverythingFrom, nextInstanceId } from './state';
import { hasKeyword, hasKeywordEffective } from './keywords';

function countLands(state: GameState, controllerId: string): number {
  const player = state.players.find((p) => p.id === controllerId);
  if (!player) return 0;
  return player.zones.battlefield.filter((c) => getCardDefinition(c.defId).type === 'land').length;
}

/** Whether def's landCountBuff (see types.ts) is currently active for this controller. */
function hasActiveLandCountBuff(def: CardDefinition, state: GameState, controllerId: string): boolean {
  return !!def.landCountBuff && countLands(state, controllerId) >= def.landCountBuff.minLands;
}

/** Whether any Aura/Equipment attached to `instanceId` sets its base power
 * and toughness to the controller's life total (e.g. Aettir and Priwen) -
 * checked before counters/buffs are layered on top, same as real Magic's
 * layer system (a "set base P/T" effect applies earlier than +1/+1 counters). */
function lifeBasedBaseStat(state: GameState, controllerId: string, instanceId: string): number | null {
  const controller = state.players.find((p) => p.id === controllerId);
  if (!controller) return null;
  const hasLifeBasedEquipment = controller.zones.battlefield.some(
    (c) => c.attachedToInstanceId === instanceId && getCardDefinition(c.defId).setsBasePowerToughnessToControllerLife
  );
  return hasLifeBasedEquipment ? controller.life : null;
}

/** Sum of +X/+Y from any Equipment attached to `instanceId` that carries a
 * static equipBuff (e.g. Coral Sword's "+1/+0"). */
function equipBuffBonus(state: GameState, controllerId: string, instanceId: string): { power: number; toughness: number } {
  const controller = state.players.find((p) => p.id === controllerId);
  if (!controller) return { power: 0, toughness: 0 };
  return controller.zones.battlefield.reduce(
    (acc, c) => {
      if (c.attachedToInstanceId !== instanceId) return acc;
      const buff = getCardDefinition(c.defId).equipBuff;
      return buff ? { power: acc.power + buff.power, toughness: acc.toughness + buff.toughness } : acc;
    },
    { power: 0, toughness: 0 }
  );
}

export function effectivePower(def: CardDefinition, instance: CardInstance, state: GameState, controllerId: string): number {
  const base = lifeBasedBaseStat(state, controllerId, instance.instanceId) ?? (def.power ?? 0);
  const plus = instance.counters.find((c) => c.label === '+1/+1')?.amount ?? 0;
  const minus = instance.counters.find((c) => c.label === '-1/-1')?.amount ?? 0;
  const buff = hasActiveLandCountBuff(def, state, controllerId) ? def.landCountBuff!.power : 0;
  const temp = instance.temporaryBuff?.power ?? 0;
  const equip = equipBuffBonus(state, controllerId, instance.instanceId).power;
  return base + plus - minus + buff + temp + equip;
}

export function effectiveToughness(def: CardDefinition, instance: CardInstance, state: GameState, controllerId: string): number {
  const base = lifeBasedBaseStat(state, controllerId, instance.instanceId) ?? (def.toughness ?? 0);
  const plus = instance.counters.find((c) => c.label === '+1/+1')?.amount ?? 0;
  const minus = instance.counters.find((c) => c.label === '-1/-1')?.amount ?? 0;
  const buff = hasActiveLandCountBuff(def, state, controllerId) ? def.landCountBuff!.toughness : 0;
  const temp = instance.temporaryBuff?.toughness ?? 0;
  const equip = equipBuffBonus(state, controllerId, instance.instanceId).toughness;
  return base + plus - minus + buff + temp + equip;
}

/** True for a real creature, or for a Vehicle (def.crew set) that's
 * currently crewed (instance.crewedUntilEndOfTurn) - see CardDefinition.crew.
 * Every place that previously checked `def.type === 'creature'` for combat
 * legality or death purposes goes through this instead, so a crewed Vehicle
 * can attack, block, and die like any other creature until end of turn. */
export function isEffectivelyCreature(def: CardDefinition, instance: CardInstance): boolean {
  return def.type === 'creature' || (def.crew !== undefined && !!instance.crewedUntilEndOfTurn);
}

function findInstance(state: GameState, instanceId: string) {
  for (const player of state.players) {
    const instance = player.zones.battlefield.find((c) => c.instanceId === instanceId);
    if (instance) return { instance, controllerId: player.id };
  }
  return null;
}

function isCommanderAttack(state: GameState, controllerId: string, attackerDefId: string): boolean {
  const controller = state.players.find((p) => p.id === controllerId);
  return !!controller?.commanderDefId && controller.commanderDefId === attackerDefId;
}

function markDamage(state: GameState, instanceId: string, amount: number, isDeathtouch: boolean = false): GameState {
  const found = findInstance(state, instanceId);
  if (!found) return state;
  if (getCardDefinition(found.instance.defId).preventsAllCombatDamage) return state;
  return updatePlayer(state, found.controllerId, (p) => ({
    ...p,
    zones: {
      ...p.zones,
      battlefield: p.zones.battlefield.map((c) =>
        c.instanceId === instanceId ? { ...c, damageMarked: c.damageMarked + amount, tookDeathtouchDamage: c.tookDeathtouchDamage || (isDeathtouch && amount > 0) } : c
      ),
    },
  }));
}

function dealDirectDamageToDefender(state: GameState, attackerControllerId: string, attackerDefId: string, attackerName: string, defenderId: string, amount: number): GameState {
  let next = updatePlayer(state, defenderId, (p) => ({ ...p, life: p.life - amount }));
  if (isCommanderAttack(next, attackerControllerId, attackerDefId)) {
    next = updatePlayer(next, defenderId, (p) => ({ ...p, commanderDamageTaken: p.commanderDamageTaken + amount }));
    next = { ...next, log: [...next.log, `${attackerName} deals ${amount} commander damage.`] };
  }
  return next;
}

function strikesInPass(text: string, pass: 1 | 2): boolean {
  const fs = hasKeyword(text, 'first strike');
  const ds = hasKeyword(text, 'double strike');
  return pass === 1 ? fs || ds : ds || (!fs && !ds);
}

function isPendingDeath(state: GameState, instanceId: string): boolean {
  return state.pendingDeaths.includes(instanceId);
}

/** Checks every permanent playerId controls for an onGainLifeTrigger and
 * applies it. Call this once, right after playerId's life actually goes up
 * (lifelink combat damage, or a gainLife effect - see engine/effects.ts).
 * Deliberately not called for manual life changes under Mutual Adjustment,
 * same as other automatic triggers being bypassed there. */
export function applyGainLifeTriggers(state: GameState, playerId: string): GameState {
  let next = state;
  for (const card of getPlayerBattlefield(next, playerId)) {
    const def = getCardDefinition(card.defId);
    if (!def.onGainLifeTrigger) continue;
    const { counterLabel, counterAmount } = def.onGainLifeTrigger;
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
    next = { ...next, log: [...next.log, `${def.name} triggers, gaining a ${counterLabel} counter.`] };
  }
  return next;
}

function getPlayerBattlefield(state: GameState, playerId: string): CardInstance[] {
  return state.players.find((p) => p.id === playerId)?.zones.battlefield ?? [];
}

function dealDamagePass(state: GameState, pass: 1 | 2): GameState {
  let next = state;

  for (const assignment of next.combatAssignments) {
    const attackerFound = findInstance(next, assignment.attackerInstanceId);
    if (!attackerFound || isPendingDeath(next, attackerFound.instance.instanceId)) continue;
    const attackerDef = getCardDefinition(attackerFound.instance.defId);
    const blockers = assignment.blockerInstanceIds
      .map((id) => findInstance(next, id))
      .filter((b): b is NonNullable<typeof b> => !!b)
      .filter((b) => !isPendingDeath(next, b.instance.instanceId));
    const isDeathtouch = hasKeyword(attackerDef.text, 'deathtouch');
    const isTrample = hasKeywordEffective(attackerDef, attackerFound.instance, 'trample');
    const isLifelink = hasKeyword(attackerDef.text, 'lifelink');

    if (strikesInPass(attackerDef.text, pass)) {
      const power = effectivePower(attackerDef, attackerFound.instance, next, attackerFound.controllerId);

      if (blockers.length === 0) {
        const defender = getOpponent(next, attackerFound.controllerId);
        next = dealDirectDamageToDefender(next, attackerFound.controllerId, attackerFound.instance.defId, attackerDef.name, defender.id, power);
        next = { ...next, log: [...next.log, `${attackerDef.name} hits ${defender.name} for ${power}.`] };
        if (isLifelink) {
          next = updatePlayer(next, attackerFound.controllerId, (p) => ({ ...p, life: p.life + power }));
          next = applyGainLifeTriggers(next, attackerFound.controllerId);
        }
      } else {
        let remaining = power;
        for (const blocker of blockers) {
          if (remaining <= 0) break;
          const blockerDef = getCardDefinition(blocker.instance.defId);
          const toughnessLeft = Math.max(0, effectiveToughness(blockerDef, blocker.instance, next, blocker.controllerId) - blocker.instance.damageMarked);
          const lethal = isDeathtouch ? 1 : toughnessLeft;
          const assigned = isTrample ? Math.min(remaining, Math.max(lethal, 0)) : remaining;
          next = markDamage(next, blocker.instance.instanceId, assigned, isDeathtouch);
          next = { ...next, log: [...next.log, `${attackerDef.name} deals ${assigned} damage to ${blockerDef.name}.`] };
          if (isLifelink) {
            next = updatePlayer(next, attackerFound.controllerId, (p) => ({ ...p, life: p.life + assigned }));
            next = applyGainLifeTriggers(next, attackerFound.controllerId);
          }
          remaining -= assigned;
        }
        if (isTrample && remaining > 0) {
          const defender = getOpponent(next, attackerFound.controllerId);
          next = dealDirectDamageToDefender(next, attackerFound.controllerId, attackerFound.instance.defId, attackerDef.name, defender.id, remaining);
          next = { ...next, log: [...next.log, `${attackerDef.name} tramples ${remaining} over to ${defender.name}.`] };
        }
      }
    }

    for (const blocker of blockers) {
      const blockerDef = getCardDefinition(blocker.instance.defId);
      if (!strikesInPass(blockerDef.text, pass)) continue;
      if (isPendingDeath(next, attackerFound.instance.instanceId)) continue;
      const blockerPower = effectivePower(blockerDef, blocker.instance, next, blocker.controllerId);
      const blockerHasDeathtouch = hasKeyword(blockerDef.text, 'deathtouch');
      next = markDamage(next, attackerFound.instance.instanceId, blockerPower, blockerHasDeathtouch);
      next = { ...next, log: [...next.log, `${blockerDef.name} deals ${blockerPower} damage to ${attackerDef.name}.`] };
      if (hasKeyword(blockerDef.text, 'lifelink')) {
        next = updatePlayer(next, blocker.controllerId, (p) => ({ ...p, life: p.life + blockerPower }));
        next = applyGainLifeTriggers(next, blocker.controllerId);
      }
    }
  }

  return next;
}

/** Marks lethally-damaged creatures as pending death WITHOUT moving them
 * to the graveyard - they stay visible, greyed out, until the End Combat
 * step ends. See engine/actions.ts: nextPhase -> resolvePendingDeaths. */
function markPendingDeaths(state: GameState): GameState {
  const newlyDead: string[] = [];
  for (const player of state.players) {
    for (const c of player.zones.battlefield) {
      if (state.pendingDeaths.includes(c.instanceId)) continue;
      const def = getCardDefinition(c.defId);
      if (!isEffectivelyCreature(def, c)) continue;
      const isIndestructible = hasKeywordEffective(def, c, 'indestructible');
      const toughness = effectiveToughness(def, c, state, player.id);
      // Deathtouch: any nonzero combat damage from that source is lethal
      // regardless of how much toughness is left, unless indestructible.
      if (!isIndestructible && toughness > 0 && (c.damageMarked >= toughness || c.tookDeathtouchDamage)) newlyDead.push(c.instanceId);
    }
  }
  if (newlyDead.length === 0) return state;

  let next = state;
  for (const id of newlyDead) {
    const found = findInstance(next, id);
    if (found) {
      const def = getCardDefinition(found.instance.defId);
      next = { ...next, log: [...next.log, `${def.name} takes lethal damage.`] };
    }
  }
  return { ...next, pendingDeaths: [...next.pendingDeaths, ...newlyDead] };
}

export function resolveCombatDamage(state: GameState): GameState {
  let next = dealDamagePass(state, 1);
  next = markPendingDeaths(next);
  next = dealDamagePass(next, 2);
  next = markPendingDeaths(next);
  return next;
}

/** Actually moves the given creatures to their owners' graveyards (or, for
 * commanders, back to the command zone with increased tax), cascading any
 * attached Auras/Equipment off first. `verb` only changes the log wording
 * ("is destroyed" vs "is sacrificed" etc). Shared by resolvePendingDeaths
 * (combat, batched at the End Combat step) and by immediate effects like
 * sacrifice (see engine/actions.ts: chooseSacrifice). */
export function moveCreaturesToGraveyard(state: GameState, deadIds: string[], verb: string = 'is destroyed'): GameState {
  if (deadIds.length === 0) return state;
  let next = state;

  for (const id of deadIds) {
    next = detachEverythingFrom(next, id);
  }

  for (const player of next.players) {
    const dead = player.zones.battlefield.filter((c) => deadIds.includes(c.instanceId));
    if (dead.length === 0) continue;
    const survivors = player.zones.battlefield.filter((c) => !deadIds.includes(c.instanceId));

    // "When this creature dies, exile it and create N tokens" (e.g. Ancient
    // Adamantoise) redirects away from the graveyard entirely - checked
    // before the commander check, since exiling takes priority.
    const toExileWithTokens = dead.filter((d) => getCardDefinition(d.defId).onDeathExileAndCreateTokens);
    // A commander dying goes to the command zone instead of the graveyard -
    // untapped (tapped means nothing there), and its Commander Tax goes up
    // by 2 right away, on the return trip rather than the next cast - so a
    // freshly-cast commander that's never died shows no tax at all, and each
    // death after that raises what it'll cost to bring back out again.
    const toCommandZone = dead.filter((d) => !toExileWithTokens.includes(d) && player.commanderDefId && d.defId === player.commanderDefId);
    const toGraveyard = dead.filter((d) => !toExileWithTokens.includes(d) && !(player.commanderDefId && d.defId === player.commanderDefId));

    // "Died this turn" (Deadly Embrace) only counts an actual death - a
    // creature redirected to exile by a replacement effect (toExileWithTokens,
    // e.g. Ancient Adamantoise) never technically died, matching real rules.
    const diedCreatureCount = [...toGraveyard, ...toCommandZone].filter((d) => getCardDefinition(d.defId).type === 'creature').length;
    if (diedCreatureCount > 0) next = { ...next, creaturesDiedThisTurn: next.creaturesDiedThisTurn + diedCreatureCount };

    const newTokens: CardInstance[] = [];
    for (const d of toExileWithTokens) {
      const { tokenId, count } = getCardDefinition(d.defId).onDeathExileAndCreateTokens!;
      const tokenDef = getCardDefinition(tokenId);
      for (let i = 0; i < count; i++) {
        newTokens.push({
          instanceId: nextInstanceId(),
          defId: tokenDef.id,
          ownerId: player.id,
          tapped: true,
          counters: [],
          damageMarked: 0,
          summoningSick: true,
          isToken: true,
          sacrificesOnTap: !!tokenDef.sacrificesOnTap,
        });
      }
    }

    next = updatePlayer(next, player.id, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: [...survivors, ...newTokens],
        graveyard: [...p.zones.graveyard, ...toGraveyard.map((d) => ({ ...d, damageMarked: 0, tookDeathtouchDamage: false }))],
        exile: [...p.zones.exile, ...toExileWithTokens.map((d) => ({ ...d, damageMarked: 0, tookDeathtouchDamage: false }))],
        commander: [
          ...p.zones.commander,
          ...toCommandZone.map((d) => {
            const existingTax = d.counters.find((c) => c.label === 'Commander Tax')?.amount ?? 0;
            return {
              ...d,
              damageMarked: 0,
              tookDeathtouchDamage: false,
              tapped: false,
              producedManaColor: undefined,
              counters: [...d.counters.filter((c) => c.label !== 'Commander Tax'), { label: 'Commander Tax', amount: existingTax + 2 }],
            };
          }),
        ],
      },
    }));
    for (const d of toGraveyard) {
      const def = getCardDefinition(d.defId);
      next = { ...next, log: [...next.log, `${def.name} ${verb}.`] };
    }
    for (const d of toCommandZone) {
      const def = getCardDefinition(d.defId);
      next = { ...next, log: [...next.log, `${def.name} dies and returns to ${player.name}'s command zone.`] };
    }
    for (const d of toExileWithTokens) {
      const def = getCardDefinition(d.defId);
      const { tokenId, count } = def.onDeathExileAndCreateTokens!;
      next = { ...next, log: [...next.log, `${def.name} is exiled, creating ${count} ${getCardDefinition(tokenId).name} token(s).`] };
    }

    // "Whenever this creature or another creature or artifact you control
    // dies, target opponent loses X life and you gain Y life" (e.g. Al Bhed
    // Salvagers) - the watcher list is taken from the battlefield BEFORE
    // removal, so a watcher dying in this same batch still counts itself.
    const deathWatchers = player.zones.battlefield.filter((c) => getCardDefinition(c.defId).onAnyDeathDrain);
    const qualifyingDeaths = dead.filter((d) => {
      const t = getCardDefinition(d.defId).type;
      return t === 'creature' || t === 'artifact';
    });
    if (deathWatchers.length > 0 && qualifyingDeaths.length > 0) {
      const opponent = getOpponent(next, player.id);
      for (const watcher of deathWatchers) {
        const watcherDef = getCardDefinition(watcher.defId);
        const { opponentLifeLoss, controllerLifeGain } = watcherDef.onAnyDeathDrain!;
        for (const d of qualifyingDeaths) {
          const dyingDef = getCardDefinition(d.defId);
          next = updatePlayer(next, player.id, (p) => ({ ...p, life: p.life + controllerLifeGain }));
          next = updatePlayer(next, opponent.id, (p) => ({ ...p, life: p.life - opponentLifeLoss }));
          next = {
            ...next,
            log: [...next.log, `${dyingDef.name}'s death triggers ${watcherDef.name}: ${opponent.name} loses ${opponentLifeLoss} life, ${player.name} gains ${controllerLifeGain} life.`],
          };
        }
      }
    }

    // "When this creature dies, put X counters on each [filter] creature you
    // control" (e.g. Aerith Gainsborough) - X is read from the dying
    // creature's OWN counters, captured above before it left the battlefield.
    for (const d of dead) {
      const def = getCardDefinition(d.defId);
      if (!def.onDeathDistributeCounters) continue;
      const { counterLabel, targetFilter } = def.onDeathDistributeCounters;
      const x = d.counters.find((c) => c.label === counterLabel)?.amount ?? 0;
      if (x <= 0) continue;
      next = updatePlayer(next, player.id, (p) => ({
        ...p,
        zones: {
          ...p.zones,
          battlefield: p.zones.battlefield.map((c) => {
            const cDef = getCardDefinition(c.defId);
            const isLegendary = !!cDef.subtype?.toLowerCase().includes('legendary creature');
            if (targetFilter === 'legendary' && !isLegendary) return c;
            const hasCounter = c.counters.some((ctr) => ctr.label === counterLabel);
            const counters = hasCounter
              ? c.counters.map((ctr) => (ctr.label === counterLabel ? { ...ctr, amount: ctr.amount + x } : ctr))
              : [...c.counters, { label: counterLabel, amount: x }];
            return { ...c, counters };
          }),
        },
      }));
      next = { ...next, log: [...next.log, `${def.name}'s death puts ${x} ${counterLabel} counter(s) on each legendary creature ${player.name} controls.`] };
    }
  }

  return next;
}

/** "Fight" - two creatures simultaneously deal damage to each other equal
 * to their power (respecting deathtouch), then anything lethally damaged
 * dies IMMEDIATELY (not staged as a pendingDeath - fighting isn't combat,
 * so there's no End Combat step to wait for). Used by SelfFightTargetEffect
 * and ChooseCreaturesFightEffect. */
export function resolveFight(state: GameState, aInstanceId: string, bInstanceId: string): { state: GameState; logLines: string[] } {
  const aFound = findInstance(state, aInstanceId);
  const bFound = findInstance(state, bInstanceId);
  if (!aFound || !bFound) return { state, logLines: [] };
  const aDef = getCardDefinition(aFound.instance.defId);
  const bDef = getCardDefinition(bFound.instance.defId);
  const aPower = effectivePower(aDef, aFound.instance, state, aFound.controllerId);
  const bPower = effectivePower(bDef, bFound.instance, state, bFound.controllerId);
  const aDeathtouch = hasKeywordEffective(aDef, aFound.instance, 'deathtouch');
  const bDeathtouch = hasKeywordEffective(bDef, bFound.instance, 'deathtouch');

  let next = markDamage(state, bInstanceId, aPower, aDeathtouch);
  next = markDamage(next, aInstanceId, bPower, bDeathtouch);

  const logLines = [`${aDef.name} fights ${bDef.name}: each deals damage equal to its power to the other.`];

  const participants: [string, CardDefinition, string][] = [
    [aInstanceId, aDef, aFound.controllerId],
    [bInstanceId, bDef, bFound.controllerId],
  ];
  const dead: string[] = [];
  for (const [id, def, controllerId] of participants) {
    const found = findInstance(next, id);
    if (!found) continue;
    if (!isEffectivelyCreature(def, found.instance)) continue;
    const isIndestructible = hasKeywordEffective(def, found.instance, 'indestructible');
    const toughness = effectiveToughness(def, found.instance, next, controllerId);
    if (!isIndestructible && toughness > 0 && (found.instance.damageMarked >= toughness || found.instance.tookDeathtouchDamage)) dead.push(id);
  }
  if (dead.length > 0) {
    next = moveCreaturesToGraveyard(next, dead, 'dies from fighting');
  }

  return { state: next, logLines };
}

/** Actually moves every pending-death creature to its owner's graveyard.
 * Called when leaving the End Combat step. */
export function resolvePendingDeaths(state: GameState): GameState {
  if (state.pendingDeaths.length === 0) return state;
  const next = moveCreaturesToGraveyard(state, state.pendingDeaths);
  return { ...next, pendingDeaths: [] };
}
