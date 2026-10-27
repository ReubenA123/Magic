import React from 'react';
import { CARD_BACKS } from '../data/cardBacks';

interface CardBackPickerModalProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}

/** Opened by the deck editor's "Change Card Back" button - picking one
 * closes the modal immediately, same "pick and you're done" feel as the
 * mana-filter buttons rather than needing a separate confirm step. */
export default function CardBackPickerModal({ selectedId, onSelect, onClose }: CardBackPickerModalProps) {
  return (
    <div className="card-actions-overlay" onClick={onClose}>
      <div className="zone-modal cardback-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="card-actions-header">
          <strong>Choose a Card Back</strong>
          <button className="close-button" onClick={onClose}>
            {'✕'}
          </button>
        </div>

        <div className="cardback-picker-grid">
          {CARD_BACKS.map((b) => (
            <button
              key={b.id}
              className={`cardback-picker-option ${selectedId === b.id ? 'cardback-picker-option-active' : ''}`}
              onClick={() => {
                onSelect(b.id);
                onClose();
              }}
            >
              <img src={b.imagePath} alt={b.name} />
              <span>{b.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
