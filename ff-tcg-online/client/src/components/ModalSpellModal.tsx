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
 * the modes are printed, regardless of check order. When
 * CardDefinition.chooseExactlyOneMode is set (Destroy Evil's "Choose one —",
 * unlike every other chooseModes card here), this instead renders radio
 * buttons restricting the pick to exactly one mode.
 */
export default function ModalSpellModal({ definition, onConfirm, onCancel }: ModalSpellModalProps) {
  const exactlyOne = !!definition.chooseExactlyOneMode;
  const [checked, setChecked] = useState<Set<number>>(new Set());

  function toggle(i: number) {
    if (exactlyOne) {
      setChecked(new Set([i]));
      return;
    }
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
          <strong>{definition.name} - Choose {exactlyOne ? 'one' : 'one or more'}</strong>
        </div>

        <div className="card-actions-section">
          {(definition.chooseModes ?? []).map((mode, i) => (
            <label key={i} className="card-actions-hint" style={{ display: 'flex', alignItems: 'center', gap: '0.5em', cursor: 'pointer' }}>
              <input type={exactlyOne ? 'radio' : 'checkbox'} checked={checked.has(i)} onChange={() => toggle(i)} />
              {mode.label}
            </label>
          ))}
        </div>

        <div className="card-actions-spacer" />

        <div className="card-actions-bottom-row">
          <button className="card-action-button card-action-button-play" disabled={checked.size === 0} onClick={() => onConfirm([...checked])}>
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
