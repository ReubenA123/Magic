// ============================================================================
// engine/combat.ts
// ============================================================================

import { CardDefinition, CardInstance, GameState } from '../types';
import { getCardDefinition } from '../data/cards';
import { getOpponent, updatePlayer, detachEverythingFrom } from './state';
import { hasKeyword } from './keywords';

function countLands(state: GameState, controllerId: string): number {
  const player = state.players.find((p) => p.id === controllerId);
  if (!player) return 0;
  return player.zones.battlefield.filter((c) => getCardDefinition(c.defId).type === 'land').length;
}

/** Whether def's landCountBuff (see types.ts) is currently active for this controller. */
function hasActiveLandCountBuff(def: CardDefinition, state: GameState, controllerId: string): boolean {
  return !!def.landCountBuff && countLands(state, controllerId) >= def.landCountBuff.minLands;
}

function effectivePower(def: CardDefinition, instance: CardInstance, state: GameState, controllerId: string): number {
  const plus = instance.counters.find((c) => c.label === '+1/+1')?.amount ?? 0;
  const minus = instance.counters.find((c) => c.label === '-1/-1')?.amount ?? 0;
  const buff = hasActiveLandCountBuff(def, state, controllerId) ? def.landCountBuff!.power : 0;
  return (def.power ?? 0) + plus - minus + buff;
}

function effectiveToughness(def: CardDefinition, instance: CardInstance, state: GameState, controllerId: string): number {
  const plus = instance.counters.find((c) => c.label === '+1/+1')?.amount ?? 0;
  const minus = instance.counters.find((c) => c.label === '-1/-1')?.amount ?? 0;
  const buff = hasActiveLandCountBuff(def, state, controllerId) ? def.landCountBuff!.toughness : 0;
  return (def.toughness ?? 0) + plus - minus + buff;
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

function markDamage(state: GameState, instanceId: string, amount: number): GameState {
  const found = findInstance(state, instanceId);
  if (!found) return state;
  return updatePlayer(state, found.controllerId, (p) => ({
    ...p,
    zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === instanceId ? { ...c, damageMarked: c.damageMarked + amount } : c)) },
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
    const isTrample = hasKeyword(attackerDef.text, 'trample');
    const isLifelink = hasKeyword(attackerDef.text, 'lifelink');

    if (strikesInPass(attackerDef.text, pass)) {
      const power = effectivePower(attackerDef, attackerFound.instance, next, attackerFound.controllerId);

      if (blockers.length === 0) {
        const defender = getOpponent(next, attackerFound.controllerId);
        next = dealDirectDamageToDefender(next, attackerFound.controllerId, attackerFound.instance.defId, attackerDef.name, defender.id, power);
        next = { ...next, log: [...next.log, `${attackerDef.name} hits ${defender.name} for ${power}.`] };
        if (isLifelink) next = updatePlayer(next, attackerFound.controllerId, (p) => ({ ...p, life: p.life + power }));
      } else {
        let remaining = power;
        for (const blocker of blockers) {
          if (remaining <= 0) break;
          const blockerDef = getCardDefinition(blocker.instance.defId);
          const toughnessLeft = Math.max(0, effectiveToughness(blockerDef, blocker.instance, next, blocker.controllerId) - blocker.instance.damageMarked);
          const lethal = isDeathtouch ? 1 : toughnessLeft;
          const assigned = isTrample ? Math.min(remaining, Math.max(lethal, 0)) : remaining;
          next = markDamage(next, blocker.instance.instanceId, assigned);
          next = { ...next, log: [...next.log, `${attackerDef.name} deals ${assigned} damage to ${blockerDef.name}.`] };
          if (isLifelink) next = updatePlayer(next, attackerFound.controllerId, (p) => ({ ...p, life: p.life + assigned }));
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
      next = markDamage(next, attackerFound.instance.instanceId, blockerPower);
      next = { ...next, log: [...next.log, `${blockerDef.name} deals ${blockerPower} damage to ${attackerDef.name}.`] };
      if (hasKeyword(blockerDef.text, 'lifelink')) next = updatePlayer(next, blocker.controllerId, (p) => ({ ...p, life: p.life + blockerPower }));
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
      if (def.type !== 'creature') continue;
      const isIndestructible = hasKeyword(def.text, 'indestructible');
      const toughness = effectiveToughness(def, c, state, player.id);
      if (!isIndestructible && toughness > 0 && c.damageMarked >= toughness) newlyDead.push(c.instanceId);
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

/** Actually moves every pending-death creature to its owner's graveyard,
 * cascading any attached Auras/Equipment off first. Called when leaving
 * the End Combat step. */
export function resolvePendingDeaths(state: GameState): GameState {
  if (state.pendingDeaths.length === 0) return state;
  let next = state;

  for (const id of state.pendingDeaths) {
    next = detachEverythingFrom(next, id);
  }

  const deadIds = next.pendingDeaths;
  for (const player of next.players) {
    const dead = player.zones.battlefield.filter((c) => deadIds.includes(c.instanceId));
    if (dead.length === 0) continue;
    const survivors = player.zones.battlefield.filter((c) => !deadIds.includes(c.instanceId));

    // A commander dying goes to the command zone instead of the graveyard -
    // untapped (tapped means nothing there), and its Commander Tax goes up
    // by 2 right away, on the return trip rather than the next cast - so a
    // freshly-cast commander that's never died shows no tax at all, and each
    // death after that raises what it'll cost to bring back out again.
    const toCommandZone = dead.filter((d) => player.commanderDefId && d.defId === player.commanderDefId);
    const toGraveyard = dead.filter((d) => !(player.commanderDefId && d.defId === player.commanderDefId));

    next = updatePlayer(next, player.id, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: survivors,
        graveyard: [...p.zones.graveyard, ...toGraveyard.map((d) => ({ ...d, damageMarked: 0 }))],
        commander: [
          ...p.zones.commander,
          ...toCommandZone.map((d) => {
            const existingTax = d.counters.find((c) => c.label === 'Commander Tax')?.amount ?? 0;
            return {
              ...d,
              damageMarked: 0,
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
      next = { ...next, log: [...next.log, `${def.name} is destroyed.`] };
    }
    for (const d of toCommandZone) {
      const def = getCardDefinition(d.defId);
      next = { ...next, log: [...next.log, `${def.name} dies and returns to ${player.name}'s command zone.`] };
    }
  }

  return { ...next, pendingDeaths: [] };
}