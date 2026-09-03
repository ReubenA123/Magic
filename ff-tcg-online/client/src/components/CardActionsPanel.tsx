import React, { useState } from 'react';
import { CardDefinition, CardInstance, ManaColor, ManaPool, ZoneName } from '../types';
import { parseCostLabel, canPay } from '../engine/mana';

interface CardActionsPanelProps {
  definition: CardDefinition;
  instance: CardInstance;
  currentZone: ZoneName;
  ownerManaPool: ManaPool;
  ownerCommanderDefId?: string;
  mutualActive: boolean;
  isMyTurn: boolean;
  alreadyPlayedLand: boolean;
  attachedToName: string | null;
  manaOptions?: ManaColor[];
  onToggleTap: () => void;
  onChooseTapColor: (color: ManaColor) => void;
  onFlip: () => void;
  onCast: () => void;
  onActivateAbility: (abilityId: string) => void;
  onMove: (toZone: ZoneName) => void;
  onAdjustCounter: (label: string, delta: number) => void;
  onStartAttach: () => void;
  onDetach: () => void;
  onCycle: () => void;
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
  ownerCommanderDefId,
  mutualActive,
  isMyTurn,
  alreadyPlayedLand,
  attachedToName,
  manaOptions,
  onToggleTap,
  onChooseTapColor,
  onFlip,
  onCast,
  onActivateAbility,
  onMove,
  onAdjustCounter,
  onStartAttach,
  onDetach,
  onCycle,
  onClose,
}: CardActionsPanelProps) {
  const [showManaChoice, setShowManaChoice] = useState(false);

  const commanderTax = currentZone === 'commander' ? instance.counters.find((c) => c.label === 'Commander Tax')?.amount ?? 0 : 0;
  const parsedCost = parseCostLabel(definition.costLabel);
  const isLand = definition.type === 'land';
  const canPlay = mutualActive || (isLand ? isMyTurn && !alreadyPlayedLand : canPay(ownerManaPool, parsedCost, commanderTax));
  const canPlayHere = currentZone === 'hand' || (currentZone === 'commander' && !isLand);
  const canCycleHere = currentZone === 'hand' && !!definition.cycling;
  const canCycle = canCycleHere && (mutualActive || canPay(ownerManaPool, parseCostLabel(definition.cycling!.cost), 0));
  const isActualCommander = ownerCommanderDefId === definition.id;
  const isOnBattlefield = currentZone === 'battlefield';
  const needsManaChoice = !instance.tapped && !!manaOptions && manaOptions.length > 0;

  const availableZones = ALL_ZONES.filter((z) => z !== currentZone)
    .filter((z) => z !== 'commander' || isActualCommander)
    .filter((z) => z !== 'battlefield' || mutualActive);

  function handleTapClick() {
    if (needsManaChoice) {
      setShowManaChoice(true);
      return;
    }
    onToggleTap();
  }

  return (
    <div className="card-drawer-overlay" onClick={onClose}>
      <div className="card-preview-panel" onClick={(e) => e.stopPropagation()}>
        <img src={definition.imagePath} alt={definition.name} className="card-preview-image" />
      </div>

      <div className="card-actions-panel" onClick={(e) => e.stopPropagation()}>
        <div className="card-actions-header">
          <strong>{definition.name}</strong>
          <button className="close-button" onClick={onClose}>
            {'\u2715'}
          </button>
        </div>

        <p className="card-actions-text">{definition.text}</p>

        {mutualActive && <p className="mutual-active-note">Mutual Adjustment is active - normal cost/timing rules are suspended.</p>}

        {definition.attachesTo && isOnBattlefield && (
          <div className="card-actions-section">
            <div className="card-actions-label">Attachment</div>
            {attachedToName ? (
              <>
                <p className="card-actions-hint">Attached to: {attachedToName}</p>
                <button className="card-action-button secondary" onClick={onDetach}>
                  Detach
                </button>
              </>
            ) : (
              <button className="card-action-button secondary" onClick={onStartAttach}>
                {definition.equipCost ? `Equip (${definition.equipCost})` : 'Attach to\u2026'}
              </button>
            )}
          </div>
        )}

        {definition.abilities && definition.abilities.length > 0 && (
          <div className="card-actions-section">
            <div className="card-actions-label">Abilities</div>
            {definition.abilities.map((ability) => {
              const manaCost = ability.cost.manaLabel ? parseCostLabel(ability.cost.manaLabel) : null;
              const affordable = mutualActive || !manaCost || canPay(ownerManaPool, manaCost, 0);
              const tapBlocked = !!ability.cost.tap && instance.tapped;
              return (
                <button key={ability.id} className="card-action-button secondary" disabled={!affordable || tapBlocked} onClick={() => onActivateAbility(ability.id)} title={ability.effectText}>
                  {ability.label}
                </button>
              );
            })}
          </div>
        )}

        {mutualActive && (
          <div className="card-actions-section">
            <div className="card-actions-label">Move to (Mutual Adjustment)</div>
            <div className="card-actions-zone-row">
              {availableZones.map((zone) => (
                <button key={zone} className="card-action-button secondary" onClick={() => onMove(zone)}>
                  {ZONE_LABELS[zone]}
                </button>
              ))}
            </div>
          </div>
        )}

        {mutualActive && (
          <div className="card-actions-section">
            <div className="card-actions-label">Counters (Mutual Adjustment)</div>
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
          </div>
        )}

        <div className="card-actions-spacer" />

        {isOnBattlefield && (
          <div className="card-actions-bottom-row">
            {showManaChoice ? (
              <div className="mana-choice-inline">
                <div className="mana-choice-inline-label">Choose which mana to add</div>
                <div className="mana-choice-buttons">
                  {manaOptions!.map((color) => (
                    <button key={color} className={`mana-choice-button mana-${color}`} onClick={() => onChooseTapColor(color)}>
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <button className="card-action-button card-action-button-play" onClick={handleTapClick}>
                {instance.tapped ? 'Untap' : 'Tap'}
              </button>
            )}
            {definition.transformsInto && (
              <button className="card-action-button card-action-button-play" onClick={onFlip}>
                Flip / Transform
              </button>
            )}
          </div>
        )}

        {canPlayHere && (
          <button className="card-action-button card-action-button-play" disabled={!canPlay} onClick={onCast} title={canPlay ? '' : isLand ? 'Already played a land, or not your turn' : 'Not enough mana'}>
            {isLand ? `Play ${definition.name}` : `Cast (${definition.costLabel}${commanderTax > 0 ? ` +${commanderTax} tax` : ''})`}
          </button>
        )}

        {canCycleHere && (
          <button className="card-action-button secondary" disabled={!canCycle} onClick={onCycle} title={canCycle ? '' : 'Not enough mana'}>
            {`Cycle (${definition.cycling!.cost})`}
          </button>
        )}
      </div>
    </div>
  );
}