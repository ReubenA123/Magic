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
  /** Current power/toughness whenever it differs from the printed stats
   * right now - a static buff (see types.ts: LandCountBuff) and/or +1/+1 /
   * -1/-1 counters. The caller works out the actual current value (it needs
   * board state Card itself doesn't have), this just displays it. */
  staticBuff?: { power: number; toughness: number } | null;
  /** A transformSelf ability's cost/timing are all currently met (see
   * GameBoard's canTransformNow) - drawn as a red outer border/glow so the
   * player notices they can transform this permanent right now. */
  transformReady?: boolean;
  /** RevealTopThenLoseLifeByManaValueEffect's (Dark Confidant) two-state
   * indicator - 'red' while GameState.pendingRevealPickup is waiting on this
   * permanent's controller to pick up the reveal, 'purple' (deliberately
   * dimmer - see .card-reveal-purple) from the moment they pick it up until
   * their next upkeep re-triggers it red. See GameBoard's revealOutlineFor. */
  revealOutline?: 'red' | 'purple';
  /** MayPayLifeThenEffect's (Seymour Flux) "you may" is outstanding on this
   * exact permanent right now (GameState.pendingOptionalPayLife) - a bold
   * purple outline/glow so the pending-target-banner's yes/no choice is
   * obviously tied to this specific card. See GameBoard's
   * awaitingOptionalPayLife. Distinct from revealOutline's dimmer 'purple'
   * (that one just means "already resolved, informational"). */
  awaitingOptionalChoice?: boolean;
}

export default function Card({
  definition,
  instance,
  faceDown,
  selected,
  dimmed,
  onClick,
  onDoubleClick,
  staticBuff,
  transformReady,
  revealOutline,
  awaitingOptionalChoice,
}: CardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [backImageFailed, setBackImageFailed] = useState(false);

  if (faceDown) {
    return (
      <div className="card card-back">
        {!backImageFailed && <img src="/assets/cards/card-back.jpg" alt="Card back" className="card-art" onError={() => setBackImageFailed(true)} />}
      </div>
    );
  }

  const classNames = [
    'card',
    selected ? 'card-selected' : '',
    transformReady ? 'card-transform-ready' : '',
    revealOutline === 'red' ? 'card-reveal-red' : '',
    revealOutline === 'purple' ? 'card-reveal-purple' : '',
    awaitingOptionalChoice ? 'card-optional-choice-purple' : '',
    onClick ? 'card-clickable' : '',
    instance?.tapped ? 'card-tapped' : '',
    dimmed ? 'card-dimmed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const dualMana = Array.isArray(definition.producesMana) && definition.producesMana.length === 2 ? definition.producesMana : null;
  const commanderTax = instance?.counters.find((c) => c.label === 'Commander Tax')?.amount ?? 0;
  // +1/+1 and -1/-1 already surface via the yellow static-buff-badge (see
  // GameBoard's activeStatBadge) - listing them again here would just be a
  // second, redundant readout of the same number.
  const otherCounters = instance?.counters.filter((c) => c.label !== 'Commander Tax' && c.label !== '+1/+1' && c.label !== '-1/-1') ?? [];

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
      {(instance?.isToken || otherCounters.length > 0) && (
        <div className="card-top-left">
          {instance?.isToken && (
            <span className="token-badge" title="This is a token, not a real card">
              Token
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
        </div>
      )}
      {staticBuff && (
        <span className="static-buff-badge" title="Current power/toughness, including counters and static buffs">
          {staticBuff.power}/{staticBuff.toughness}
        </span>
      )}
    </div>
  );
}