import React, { useState } from 'react';
import { CardDefinition } from '../types';

interface ModalSpellModalProps {
  definition: CardDefinition;
  onConfirm: (chosenModeIndices: number[]) => void;
  onCancel: () => void;
}

/**
 * Shown when casting a "Choose one or more —" modal spell (e.g. Clash of
 * the Eikons) - see types.ts: SpellMode. The caster checks any NONEMPTY
 * subset of modes, then Cast dispatches CAST_CARD with those indices;
 * effects.ts/actions.ts resolve every checked mode's effects in the order
 * the modes are printed, regardless of check order.
 */
export default function ModalSpellModal({ definition, onConfirm, onCancel }: ModalSpellModalProps) {
  const [checked, setChecked] = useState<Set<number>>(new Set());

  function toggle(i: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <div className="card-drawer-overlay">
      <div className="card-preview-panel">
        <img src={definition.imagePath} alt={definition.name} className="card-preview-image" />
      </div>

      <div className="card-actions-panel">
        <div className="card-actions-header">
          <strong>{definition.name} - Choose one or more</strong>
        </div>

        <div className="card-actions-section">
          {(definition.chooseModes ?? []).map((mode, i) => (
            <label key={i} className="card-actions-hint" style={{ display: 'flex', alignItems: 'center', gap: '0.5em', cursor: 'pointer' }}>
              <input type="checkbox" checked={checked.has(i)} onChange={() => toggle(i)} />
              {mode.label}
            </label>
          ))}
        </div>

        <div className="card-actions-spacer" />

        <div className="card-actions-bottom-row">
          <button className="card-action-button card-action-button-play" disabled={checked.size === 0} onClick={() => onConfirm([...checked])}>
            Cast
          </button>
          <button className="card-action-button secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
