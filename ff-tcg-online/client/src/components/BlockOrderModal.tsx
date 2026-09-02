import React, { useState } from 'react';
import { CardDefinition, CardInstance } from '../types';
import { hasKeyword } from '../engine/keywords';
import Card from './Card';

interface BlockerEntry {
  definition: CardDefinition;
  instance: CardInstance;
}

interface BlockOrderModalProps {
  attackerDefinition: CardDefinition;
  attackerInstance: CardInstance;
  /** In the engine's current order - only the initial order shown; the
   * player reorders from here before confirming. */
  blockers: BlockerEntry[];
  onConfirm: (orderedInstanceIds: string[]) => void;
}

function counterAdjustedStat(base: number | undefined, instance: CardInstance): number {
  const plus = instance.counters.find((c) => c.label === '+1/+1')?.amount ?? 0;
  const minus = instance.counters.find((c) => c.label === '-1/-1')?.amount ?? 0;
  return (base ?? 0) + plus - minus;
}

/**
 * Shown to the attacking player whenever one of their attackers ends up with
 * 2+ blockers - real combat rule: the defender chose which creatures block,
 * but the attacker chooses the order damage is assigned among them. Mirrors
 * engine/combat.ts's dealDamagePass exactly, so the preview here matches
 * what actually happens once both players press Resolve Combat.
 */
export default function BlockOrderModal({ attackerDefinition, attackerInstance, blockers, onConfirm }: BlockOrderModalProps) {
  const [order, setOrder] = useState<string[]>(blockers.map((b) => b.instance.instanceId));
  const byId = new Map(blockers.map((b) => [b.instance.instanceId, b]));

  function move(instanceId: string, direction: -1 | 1) {
    setOrder((prev) => {
      const idx = prev.indexOf(instanceId);
      const swapWith = idx + direction;
      if (swapWith < 0 || swapWith >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return next;
    });
  }

  const isDeathtouch = hasKeyword(attackerDefinition.text, 'deathtouch');
  const isTrample = hasKeyword(attackerDefinition.text, 'trample');
  const attackerPower = counterAdjustedStat(attackerDefinition.power, attackerInstance);

  let remaining = attackerPower;
  const previews = order.map((id) => {
    const entry = byId.get(id)!;
    const toughnessLeft = Math.max(0, counterAdjustedStat(entry.definition.toughness, entry.instance) - entry.instance.damageMarked);
    if (remaining <= 0) return { ...entry, assigned: 0, remainingToughness: toughnessLeft };
    const lethal = isDeathtouch ? 1 : toughnessLeft;
    const assigned = isTrample ? Math.min(remaining, Math.max(lethal, 0)) : remaining;
    remaining -= assigned;
    return { ...entry, assigned, remainingToughness: Math.max(0, toughnessLeft - assigned) };
  });

  return (
    <div className="card-actions-overlay">
      <div className="block-order-panel">
        <div className="card-actions-header">
          <strong>Choose damage order</strong>
        </div>
        <p className="card-actions-text">
          {attackerDefinition.name} is blocked by {blockers.length} creatures - choose which takes damage first
          {isTrample ? ' (excess tramples through once the rest are covered)' : ''}.
        </p>

        <div className="block-order-body">
          <div className="block-order-attacker">
            <Card definition={attackerDefinition} instance={attackerInstance} />
            <span className="block-order-attacker-power">
              {attackerPower} power{isDeathtouch ? ' • deathtouch' : ''}
              {isTrample ? ' • trample' : ''}
            </span>
          </div>

          <div className="block-order-list">
            {previews.map((b, i) => (
              <div key={b.instance.instanceId} className="block-order-row">
                <span className="block-order-rank">{i + 1}</span>
                <Card definition={b.definition} instance={b.instance} />
                <div className="block-order-row-info">
                  <span className="block-order-row-name">{b.definition.name}</span>
                  <span className="block-order-row-damage">
                    {b.assigned} damage {'→'} {b.remainingToughness <= 0 ? 'dies' : `${b.remainingToughness} toughness left`}
                  </span>
                </div>
                <div className="block-order-move-buttons">
                  <button className="counter-step" disabled={i === 0} onClick={() => move(b.instance.instanceId, -1)} title="Move earlier">
                    {'↑'}
                  </button>
                  <button className="counter-step" disabled={i === previews.length - 1} onClick={() => move(b.instance.instanceId, 1)} title="Move later">
                    {'↓'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button className="card-action-button" onClick={() => onConfirm(order)}>
          Confirm order
        </button>
      </div>
    </div>
  );
}
