import React, { useState } from 'react';
import { SpellMode } from '../types';

interface ChooseOneModeModalProps {
  sourceName: string;
  modes: SpellMode[];
  /** "If you control a commander, you may choose both instead" (SOLDIER
   * Military Program) - true only when BOTH the ability's own
   * allowBothIfCommander flag is set AND the controller actually has a
   * commander, so this component never needs to know about commanders
   * itself. Switches the picker from radio buttons (exactly one) to
   * checkboxes (one or two). */
  allowBoth?: boolean;
  onChoose: (modeIndex: number, alsoModeIndex?: number) => void;
}

/**
 * Shown while a ChooseOneModeEffect (see types.ts) is outstanding, e.g.
 * Coliseum Behemoth's "When this creature enters, choose one — Destroy
 * target artifact or enchantment / Draw a card." - EXACTLY one mode must be
 * picked (unlike ModalSpellModal's "choose one or more", used only for
 * modal SPELLS at cast time). No cancel - the choice is mandatory whenever
 * this modal is shown at all.
 */
export default function ChooseOneModeModal({ sourceName, modes, allowBoth, onChoose }: ChooseOneModeModalProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState<number[]>([]);

  const toggleChecked = (i: number) => {
    setChecked((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : prev.length < 2 ? [...prev, i] : prev));
  };

  const confirm = () => {
    if (allowBoth) {
      if (checked.length === 0) return;
      onChoose(checked[0], checked[1]);
    } else if (selected !== null) {
      onChoose(selected);
    }
  };

  return (
    <div className="card-drawer-overlay">
      <div className="card-actions-panel">
        <div className="card-actions-header">
          <strong>{sourceName} - Choose one{allowBoth ? ' (or both - you control a commander)' : ''}</strong>
        </div>

        <div className="card-actions-section">
          {modes.map((mode, i) => (
            <label key={i} className="card-actions-hint" style={{ display: 'flex', alignItems: 'center', gap: '0.5em', cursor: 'pointer' }}>
              {allowBoth ? (
                <input type="checkbox" checked={checked.includes(i)} onChange={() => toggleChecked(i)} />
              ) : (
                <input type="radio" name="choose-one-mode" checked={selected === i} onChange={() => setSelected(i)} />
              )}
              {mode.label}
            </label>
          ))}
        </div>

        <div className="card-actions-spacer" />

        <div className="card-actions-bottom-row">
          <button
            className="card-action-button card-action-button-play"
            disabled={allowBoth ? checked.length === 0 : selected === null}
            onClick={confirm}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
