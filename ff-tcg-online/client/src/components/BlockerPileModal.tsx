import React from 'react';
import { CardDefinition, CardInstance } from '../types';
import Card from './Card';

interface BlockerPileModalProps {
  attackerName: string;
  blockers: { definition: CardDefinition; instance: CardInstance }[];
  /** Only present while blocks can still be changed (declare_blockers) -
   * omit it to make this a read-only peek during/after combat damage. */
  onRemove?: (instanceId: string) => void;
  onClose: () => void;
}

/**
 * Three or more creatures blocking one attacker stack like a land pile on
 * the battlefield - this is what clicking that pile opens, so you can see
 * (and, while still declaring blockers, remove) any of them individually
 * instead of only ever reaching whichever one happened to be on top.
 */
export default function BlockerPileModal({ attackerName, blockers, onRemove, onClose }: BlockerPileModalProps) {
  return (
    <div className="card-actions-overlay" onClick={onClose}>
      <div className="zone-modal" onClick={(e) => e.stopPropagation()}>
        <div className="card-actions-header">
          <strong>Blocking {attackerName}</strong>
          <button className="close-button" onClick={onClose}>
            {'✕'}
          </button>
        </div>
        <p className="card-actions-text">{onRemove ? 'Click a blocker to remove it.' : `${blockers.length} creatures are blocking.`}</p>
        <div className="zone-modal-grid">
          {blockers.map((b) => (
            <Card
              key={b.instance.instanceId}
              definition={b.definition}
              instance={{ ...b.instance, tapped: false }}
              onClick={onRemove ? () => onRemove(b.instance.instanceId) : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
