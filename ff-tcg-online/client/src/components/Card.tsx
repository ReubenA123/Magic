import React, { useState } from 'react';
import { CardDefinition, CardInstance } from '../types';

interface CardProps {
  definition: CardDefinition;
  instance?: CardInstance;
  faceDown?: boolean;
  selected?: boolean;
  onClick?: () => void;
}

/**
 * Renders one card. No card art exists yet in this repo - see
 * client/public/assets/cards/README.md - so this always tries the image
 * first and falls back to a plain text placeholder if it 404s, meaning the
 * game is fully playable before any art exists. Counters are drawn as small
 * badges in the corner; tapped cards rotate, matching a physical table.
 */
export default function Card({ definition, instance, faceDown, selected, onClick }: CardProps) {
  const [imageFailed, setImageFailed] = useState(false);

  if (faceDown) {
    return <div className="card card-back" />;
  }

  const classNames = ['card', selected ? 'card-selected' : '', onClick ? 'card-clickable' : '', instance?.tapped ? 'card-tapped' : ''].filter(Boolean).join(' ');

  return (
    <div className={classNames} onClick={onClick} title={definition.text}>
      {!imageFailed ? (
        <img src={definition.imagePath} alt={definition.name} onError={() => setImageFailed(true)} className="card-art" />
      ) : (
        <div className="card-placeholder">
          <div className="card-placeholder-cost">{definition.costLabel}</div>
          <div className="card-placeholder-name">{definition.name}</div>
          <div className="card-placeholder-type">{definition.type}</div>
          <div className="card-placeholder-text">{definition.text}</div>
          {definition.type === 'creature' && (
            <div className="card-placeholder-pt">
              {definition.power}/{definition.toughness}
            </div>
          )}
        </div>
      )}
      <div className="card-name-strip">{definition.name}</div>
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
