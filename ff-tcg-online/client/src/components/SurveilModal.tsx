import React, { useState } from 'react';
import { CardDefinition, CardInstance } from '../types';
import Card from './Card';

interface SurveilModalProps {
  sourceName: string;
  cards: { definition: CardDefinition; instance: CardInstance }[];
  onConfirm: (graveyardIds: string[], keepOrder: string[]) => void;
}

/**
 * Shown while a SurveilEffect (see types.ts) is mid-resolution, e.g.
 * Ultimecia, Time Sorceress's "surveil 2" - private to the controller (no
 * isYourChoice prop like RevealDivideModal, since surveiled cards are never
 * public information). Reordering follows BlockOrderModal's up/down pattern,
 * applied to the whole list so a card sent to the graveyard just drops out
 * of the final `keepOrder` wherever it currently sits.
 */
export default function SurveilModal({ sourceName, cards, onConfirm }: SurveilModalProps) {
  const [graveyardIds, setGraveyardIds] = useState<Set<string>>(new Set());
  const [order, setOrder] = useState<string[]>(cards.map((c) => c.instance.instanceId));
  const byId = new Map(cards.map((c) => [c.instance.instanceId, c]));

  function toggleGraveyard(id: string) {
    setGraveyardIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function move(id: string, direction: -1 | 1) {
    setOrder((prev) => {
      const idx = prev.indexOf(id);
      const swapWith = idx + direction;
      if (swapWith < 0 || swapWith >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return next;
    });
  }

  const keepOrder = order.filter((id) => !graveyardIds.has(id));

  return (
    <div className="card-actions-overlay">
      <div className="zone-modal">
        <div className="card-actions-header">
          <strong>
            {sourceName} - Surveil {cards.length}
          </strong>
        </div>
        <p className="card-actions-text">
          Send any of these to the graveyard, then set the order of the rest (top card first) before they go back on top of your library.
        </p>
        <div className="zone-modal-grid">
          {order.map((id, i) => {
            const entry = byId.get(id)!;
            const inGraveyard = graveyardIds.has(id);
            return (
              <div key={id} className="block-order-row">
                <Card definition={entry.definition} instance={entry.instance} dimmed={inGraveyard} />
                <div className="block-order-row-info">
                  <span className="block-order-row-name">{entry.definition.name}</span>
                  <button className="card-action-button secondary" onClick={() => toggleGraveyard(id)}>
                    {inGraveyard ? 'Keep on top' : 'Put in graveyard'}
                  </button>
                </div>
                <div className="block-order-move-buttons">
                  <button className="counter-step" disabled={i === 0} onClick={() => move(id, -1)} title="Move earlier">
                    {'↑'}
                  </button>
                  <button className="counter-step" disabled={i === order.length - 1} onClick={() => move(id, 1)} title="Move later">
                    {'↓'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <button className="card-action-button" onClick={() => onConfirm([...graveyardIds], keepOrder)}>
          Confirm surveil
        </button>
      </div>
    </div>
  );
}
