import React from 'react';
import { CardDefinition } from '../types';
import Card from './Card';

interface DeckViewModalProps {
  title: string;
  commander: CardDefinition | null;
  cardGroups: { def: CardDefinition; count: number }[];
  onClose: () => void;
}

export default function DeckViewModal({ title, commander, cardGroups, onClose }: DeckViewModalProps) {
  return (
    <div className="card-actions-overlay" onClick={onClose}>
      <div className="zone-modal" onClick={(e) => e.stopPropagation()}>
        <div className="card-actions-header">
          <strong>{title}</strong>
          <button className="close-button" onClick={onClose}>
            {'\u2715'}
          </button>
        </div>

        {commander && (
          <div className="deckview-commander-row">
            <Card definition={commander} />
            <div>
              <div className="card-actions-label">Commander</div>
              <div>{commander.name}</div>
            </div>
          </div>
        )}

        {cardGroups.length === 0 ? (
          <p className="card-actions-hint">No other cards in this deck.</p>
        ) : (
          <div className="zone-modal-grid">
            {cardGroups.map(({ def, count }) => (
              <div key={def.id} className="deckview-card-item">
                <Card definition={def} />
                <span className="deckview-card-count">x{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}