import React, { useState } from 'react';
import { CardDefinition } from '../types';

interface TieredModeModalProps {
  definition: CardDefinition;
  onConfirm: (chosenTierIndex: number) => void;
  onCancel: () => void;
}

/**
 * Shown when casting a "Tiered (Choose one additional cost.)" spell (e.g.
 * Vincent's Limit Break) - see types.ts: TieredMode. Unlike ModalSpellModal
 * (any nonempty subset, no extra cost), exactly one tier is picked, and its
 * additionalCost is paid ON TOP OF the card's own printed cost - see
 * engine/actions.ts: castCard.
 */
export default function TieredModeModal({ definition, onConfirm, onCancel }: TieredModeModalProps) {
  const [chosen, setChosen] = useState<number | null>(null);

  return (
    <div className="card-drawer-overlay">
      <div className="card-preview-panel">
        <img src={definition.imagePath} alt={definition.name} className="card-preview-image" />
      </div>

      <div className="card-actions-panel">
        <div className="card-actions-header">
          <strong>{definition.name} - Choose one additional cost</strong>
        </div>

        <div className="card-actions-section">
          {(definition.tieredModes ?? []).map((tier, i) => (
            <label key={i} className="card-actions-hint" style={{ display: 'flex', alignItems: 'center', gap: '0.5em', cursor: 'pointer' }}>
              <input type="radio" name="tiered-mode" checked={chosen === i} onChange={() => setChosen(i)} />
              {tier.label}
            </label>
          ))}
        </div>

        <div className="card-actions-spacer" />

        <div className="card-actions-bottom-row">
          <button className="card-action-button card-action-button-play" disabled={chosen === null} onClick={() => onConfirm(chosen!)}>
            Cast
          </button>
          <button className="card-action-button card-action-button-cancel-x" onClick={onCancel} aria-label="Cancel" title="Cancel">
            {'✕'}
          </button>
        </div>
      </div>
    </div>
  );
}
