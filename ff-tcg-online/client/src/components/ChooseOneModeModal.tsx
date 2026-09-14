import React, { useState } from 'react';
import { SpellMode } from '../types';

interface ChooseOneModeModalProps {
  sourceName: string;
  modes: SpellMode[];
  onChoose: (modeIndex: number) => void;
}

/**
 * Shown while a ChooseOneModeEffect (see types.ts) is outstanding, e.g.
 * Coliseum Behemoth's "When this creature enters, choose one — Destroy
 * target artifact or enchantment / Draw a card." - EXACTLY one mode must be
 * picked (unlike ModalSpellModal's "choose one or more", used only for
 * modal SPELLS at cast time). No cancel - the choice is mandatory whenever
 * this modal is shown at all.
 */
export default function ChooseOneModeModal({ sourceName, modes, onChoose }: ChooseOneModeModalProps) {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="card-drawer-overlay">
      <div className="card-actions-panel">
        <div className="card-actions-header">
          <strong>{sourceName} - Choose one</strong>
        </div>

        <div className="card-actions-section">
          {modes.map((mode, i) => (
            <label key={i} className="card-actions-hint" style={{ display: 'flex', alignItems: 'center', gap: '0.5em', cursor: 'pointer' }}>
              <input type="radio" name="choose-one-mode" checked={selected === i} onChange={() => setSelected(i)} />
              {mode.label}
            </label>
          ))}
        </div>

        <div className="card-actions-spacer" />

        <div className="card-actions-bottom-row">
          <button className="card-action-button card-action-button-play" disabled={selected === null} onClick={() => selected !== null && onChoose(selected)}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
