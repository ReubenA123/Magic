import React, { useState } from 'react';
import { CardDefinition, CardInstance } from '../types';

interface CardProps {
  definition: CardDefinition;
  instance?: CardInstance;
  faceDown?: boolean;
  selected?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
}

export default function Card({ definition, instance, faceDown, selected, dimmed, onClick, onDoubleClick }: CardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [backImageFailed, setBackImageFailed] = useState(false);

  if (faceDown) {
    return (
      <div className="card card-back">
        {!backImageFailed && <img src="/assets/cards/card-back.jpg" alt="Card back" className="card-art" onError={() => setBackImageFailed(true)} />}
      </div>
    );
  }

  const classNames = ['card', selected ? 'card-selected' : '', onClick ? 'card-clickable' : '', instance?.tapped ? 'card-tapped' : '', dimmed ? 'card-dimmed' : '']
    .filter(Boolean)
    .join(' ');

  const dualMana = Array.isArray(definition.producesMana) && definition.producesMana.length === 2 ? definition.producesMana : null;

  return (
    <div className={classNames} onClick={onClick} onDoubleClick={onDoubleClick} title={definition.text}>
      {!imageFailed ? (
        <img src={definition.imagePath} alt={definition.name} onError={() => setImageFailed(true)} className="card-art" />
      ) : (
        <div className="card-placeholder">
          <div className="card-placeholder-cost">{definition.costLabel}</div>
          <div className="card-placeholder-name">{definition.name}</div>
          <div className="card-placeholder-type">{definition.subtype ?? definition.type}</div>
          <div className="card-placeholder-text">{definition.text}</div>
          {definition.type === 'creature' && (
            <div className="card-placeholder-pt">
              {definition.power}/{definition.toughness}
            </div>
          )}
        </div>
      )}
      {dualMana && (
        <div className="dual-mana-split">
          <span className={`dual-mana-half mana-${dualMana[0]}`}>{dualMana[0]}</span>
          <span className={`dual-mana-half mana-${dualMana[1]}`}>{dualMana[1]}</span>
        </div>
      )}
      {instance && instance.counters.length > 0 && (
        <div className="card-counters">
          {instance.counters.map((c) => (
            <span key={c.label} className="counter-badge" title={`${c.amount} ${c.label} counter(s)`}>
              {c.label} {c.amount}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}