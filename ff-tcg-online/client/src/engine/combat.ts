// ============================================================================
// engine/combat.ts
// ============================================================================

import { CardInstance, GameState } from '../types';
import { getCardDefinition } from '../data/cards';
import { getOpponent, updatePlayer } from './state';
import { hasKeyword } from './keywords';

function effectivePower(power: number | undefined, instance: CardInstance): number {
  const plus = instance.counters.find((c) => c.label === '+1/+1')?.amount ?? 0;
  const minus = instance.counters.find((c) => c.label === '-1/-1')?.amount ?? 0;
  return (power ?? 0) + plus - minus;
}

function effectiveToughness(toughness: number | undefined, instance: CardInstance): number {
  const plus = instance.counters.find((c) => c.label === '+1/+1')?.amount ?? 0;
  const minus = instance.counters.find((c) => c.label === '-1/-1')?.amount ?? 0;
  return (toughness ?? 0) + plus - minus;
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

function dealDamagePass(state: GameState, pass: 1 | 2): GameState {
  let next = state;

  for (const assignment of next.combatAssignments) {
    const attackerFound = findInstance(next, assignment.attackerInstanceId);
    if (!attackerFound) continue;
    const attackerDef = getCardDefinition(attackerFound.instance.defId);
    const blockers = assignment.blockerInstanceIds.map((id) => findInstance(next, id)).filter((b): b is NonNullable<typeof b> => !!b);
    const isDeathtouch = hasKeyword(attackerDef.text, 'deathtouch');
    const isTrample = hasKeyword(attackerDef.text, 'trample');
    const isLifelink = hasKeyword(attackerDef.text, 'lifelink');

    if (strikesInPass(attackerDef.text, pass)) {
      const power = effectivePower(attackerDef.power, attackerFound.instance);

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
          const toughnessLeft = Math.max(0, effectiveToughness(blockerDef.toughness, blocker.instance) - blocker.instance.damageMarked);
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
      const stillThere = findInstance(next, attackerFound.instance.instanceId);
      if (!stillThere) continue;
      const blockerPower = effectivePower(blockerDef.power, blocker.instance);
      next = markDamage(next, attackerFound.instance.instanceId, blockerPower);
      next = { ...next, log: [...next.log, `${blockerDef.name} deals ${blockerPower} damage to ${attackerDef.name}.`] };
      if (hasKeyword(blockerDef.text, 'lifelink')) next = updatePlayer(next, blocker.controllerId, (p) => ({ ...p, life: p.life + blockerPower }));
    }
  }

  return next;
}

function removeDeadCreatures(state: GameState): GameState {
  let next = state;
  for (const player of state.players) {
    const dead: CardInstance[] = [];
    for (const c of player.zones.battlefield) {
      const def = getCardDefinition(c.defId);
      if (def.type !== 'creature') continue;
      const toughness = effectiveToughness(def.toughness, c);
      const isIndestructible = hasKeyword(def.text, 'indestructible');
      if (!isIndestructible && toughness > 0 && c.damageMarked >= toughness) dead.push(c);
    }
    if (dead.length === 0) continue;

    for (const dyingCard of dead) {
      for (const p2 of next.players) {
        const attached = p2.zones.battlefield.filter((c) => c.attachedToInstanceId === dyingCard.instanceId);
        for (const child of attached) {
          const childDef = getCardDefinition(child.defId);
          if (childDef.type === 'enchantment') {
            next = updatePlayer(next, p2.id, (p) => ({
              ...p,
              zones: { ...p.zones, battlefield: p.zones.battlefield.filter((c) => c.instanceId !== child.instanceId), graveyard: [...p.zones.graveyard, { ...child, attachedToInstanceId: undefined, tapped: false }] },
            }));
          } else {
            next = updatePlayer(next, p2.id, (p) => ({
              ...p,
              zones: { ...p.zones, battlefield: p.zones.battlefield.map((c) => (c.instanceId === child.instanceId ? { ...c, attachedToInstanceId: undefined } : c)) },
            }));
          }
        }
      }
    }

    // Re-read this player's current battlefield from `next` (not the stale
    // loop-start snapshot) since the cascade above may have already
    // changed it - otherwise a detach could get silently overwritten.
    const deadIds = new Set(dead.map((d) => d.instanceId));
    next = updatePlayer(next, player.id, (p) => ({
      ...p,
      zones: {
        ...p.zones,
        battlefield: p.zones.battlefield.filter((c) => !deadIds.has(c.instanceId)),
        graveyard: [...p.zones.graveyard, ...p.zones.battlefield.filter((c) => deadIds.has(c.instanceId))],
      },
    }));

    for (const d of dead) {
      const def = getCardDefinition(d.defId);
      next = { ...next, log: [...next.log, `${def.name} is destroyed.`] };
    }
  }
  return next;
}

export function resolveCombatDamage(state: GameState): GameState {
  let next = dealDamagePass(state, 1);
  next = removeDeadCreatures(next);
  next = dealDamagePass(next, 2);
  next = removeDeadCreatures(next);
  return next;
}