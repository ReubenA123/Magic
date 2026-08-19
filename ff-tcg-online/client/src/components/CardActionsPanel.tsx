import React, { useState } from 'react';
import { CardDefinition, CardInstance, ManaPool, ZoneName } from '../types';
import { parseCostLabel, canPay } from '../engine/mana';

interface CardActionsPanelProps {
  definition: CardDefinition;
  instance: CardInstance;
  currentZone: ZoneName;
  ownerManaPool: ManaPool;
  onToggleTap: () => void;
  onFlip: () => void;
  onCast: () => void;
  onActivateAbility: (abilityId: string) => void;
  onMove: (toZone: ZoneName) => void;
  onAdjustCounter: (label: string, delta: number) => void;
  onClose: () => void;
}

const ZONE_LABELS: Record<ZoneName, string> = {
  library: 'Library (shuffles in)',
  hand: 'Hand',
  battlefield: 'Battlefield',
  graveyard: 'Graveyard',
  exile: 'Exile',
  commander: 'Commander zone',
};

const ALL_ZONES: ZoneName[] = ['hand', 'battlefield', 'graveyard', 'exile', 'library', 'commander'];

export default function CardActionsPanel({
  definition,
  instance,
  currentZone,
  ownerManaPool,
  onToggleTap,
  onFlip,
  onCast,
  onActivateAbility,
  onMove,
  onAdjustCounter,
  onClose,
}: CardActionsPanelProps) {
  const [newCounterLabel, setNewCounterLabel] = useState('+1/+1');

  const commanderTax = currentZone === 'commander' ? instance.counters.find((c) => c.label === 'Commander Tax')?.amount ?? 0 : 0;
  const parsedCost = parseCostLabel(definition.costLabel);
  const canAffordCast = canPay(ownerManaPool, parsedCost, commanderTax);
  const canCastHere = (currentZone === 'hand' || currentZone === 'commander') && definition.type !== 'land';

  return (
    <div className="card-actions-overlay" onClick={onClose}>
      <div className="card-actions-panel" onClick={(e) => e.stopPropagation()}>
        <div className="card-actions-header">
          <strong>{definition.name}</strong>
          <button className="close-button" onClick={onClose}>
            {'\u2715'}
          </button>
        </div>
        <p className="card-actions-text">{definition.text}</p>

        {currentZone === 'battlefield' && (
          <button className="card-action-button" onClick={onToggleTap}>
            {instance.tapped ? 'Untap' : 'Tap'}
          </button>
        )}

        {definition.transformsInto && (
          <button className="card-action-button" onClick={onFlip}>
            Flip / Transform
          </button>
        )}

        {canCastHere && (
          <button className="card-action-button" disabled={!canAffordCast} onClick={onCast} title={canAffordCast ? '' : 'Not enough mana'}>
            Cast ({definition.costLabel}
            {commanderTax > 0 ? ` +${commanderTax} tax` : ''})
          </button>
        )}

        {definition.abilities && definition.abilities.length > 0 && (
          <div className="card-actions-section">
            <div className="card-actions-label">Abilities</div>
            {definition.abilities.map((ability) => {
              const manaCost = ability.cost.manaLabel ? parseCostLabel(ability.cost.manaLabel) : null;
              const affordable = !manaCost || canPay(ownerManaPool, manaCost, 0);
              const tapBlocked = !!ability.cost.tap && instance.tapped;
              return (
                <button
                  key={ability.id}
                  className="card-action-button secondary"
                  disabled={!affordable || tapBlocked}
                  onClick={() => onActivateAbility(ability.id)}
                  title={ability.effectText}
                >
                  {ability.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="card-actions-section">
          <div className="card-actions-label">Move to</div>
          <div className="card-actions-zone-row">
            {ALL_ZONES.filter((z) => z !== currentZone).map((zone) => (
              <button key={zone} className="card-action-button secondary" onClick={() => onMove(zone)}>
                {ZONE_LABELS[zone]}
              </button>
            ))}
          </div>
        </div>

        <div className="card-actions-section">
          <div className="card-actions-label">Counters</div>
          {instance.counters.length === 0 && <p className="card-actions-hint">No counters yet.</p>}
          {instance.counters.map((c) => (
            <div key={c.label} className="counter-row">
              <span>
                {c.label}: {c.amount}
              </span>
              <button className="counter-step" onClick={() => onAdjustCounter(c.label, -1)}>
                {'\u2013'}
              </button>
              <button className="counter-step" onClick={() => onAdjustCounter(c.label, 1)}>
                +
              </button>
            </div>
          ))}
          <div className="counter-add-row">
            <input value={newCounterLabel} onChange={(e) => setNewCounterLabel(e.target.value)} placeholder="counter label" />
            <button className="counter-step" onClick={() => newCounterLabel.trim() && onAdjustCounter(newCounterLabel.trim(), 1)}>
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}