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
  /** A currently-active static buff (see types.ts: LandCountBuff) - the
   * caller works out whether the condition is actually met right now (it
   * needs board state Card itself doesn't have), this just displays it. */
  staticBuff?: { power: number; toughness: number } | null;
}

export default function Card({ definition, instance, faceDown, selected, dimmed, onClick, onDoubleClick, staticBuff }: CardProps) {
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
  const commanderTax = instance?.counters.find((c) => c.label === 'Commander Tax')?.amount ?? 0;
  const otherCounters = instance?.counters.filter((c) => c.label !== 'Commander Tax') ?? [];

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
      {commanderTax > 0 && (
        <span className="commander-tax-badge" title={`Costs {${commanderTax}} more to cast from the command zone`}>
          +{commanderTax}
        </span>
      )}
      {otherCounters.length > 0 && (
        <div className="card-counters">
          {otherCounters.map((c) => (
            <span key={c.label} className="counter-badge" title={`${c.amount} ${c.label} counter(s)`}>
              {c.label} {c.amount}
            </span>
          ))}
        </div>
      )}
      {staticBuff && (
        <span className="static-buff-badge" title="Current power/toughness with its static ability active">
          {staticBuff.power}/{staticBuff.toughness}
        </span>
      )}
    </div>
  );
}