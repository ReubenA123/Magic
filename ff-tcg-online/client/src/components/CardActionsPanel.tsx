import React, { useState } from 'react';
import { CardDefinition, CardInstance, ZoneName } from '../types';

interface CardActionsPanelProps {
  definition: CardDefinition;
  instance: CardInstance;
  currentZone: ZoneName;
  onToggleTap: () => void;
  onFlip: () => void;   // add this
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
};

const ALL_ZONES: ZoneName[] = ['hand', 'battlefield', 'graveyard', 'exile', 'library'];

/**
 * The one central place every manual action on a card happens - opened by
 * clicking any card you control, in any zone. Keeping everything in one
 * panel (rather than a button per action scattered across the card itself)
 * keeps the board grid readable, especially once cards start carrying
 * several counters.
 */
export default function CardActionsPanel({ definition, instance, currentZone, onToggleTap, onFlip, onMove, onAdjustCounter, onClose }: CardActionsPanelProps) {
    const [newCounterLabel, setNewCounterLabel] = useState('+1/+1');

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
            Flip
          </button>
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
