import React from 'react';
import { Phase } from '../types';

const PHASE_LABELS: Record<Phase, string> = {
  pregame: 'Pregame',
  untap: 'Untap',
  upkeep: 'Upkeep',
  draw: 'Draw',
  main1: 'Main 1',
  combat_begin: 'Combat',
  declare_attackers: 'Combat',
  declare_blockers: 'Combat',
  combat_damage: 'Combat',
  combat_end: 'End Combat',
  main2: 'Main 2',
  end: 'End',
  cleanup: 'Cleanup',
};

interface PhaseBarProps {
  phase: Phase;
  turnNumber: number;
  isYourTurn: boolean;
  hideControls?: boolean;
  onNextPhase: () => void;
  onEndTurn: () => void;
}

export default function PhaseBar({ phase, turnNumber, isYourTurn, hideControls, onNextPhase, onEndTurn }: PhaseBarProps) {
  return (
    <div className="phase-bar-compact">
      <span className="phase-bar-compact-info">
        T{turnNumber} {'\u00b7'} {PHASE_LABELS[phase]} {'\u00b7'} {isYourTurn ? 'You' : 'Opp'}
      </span>
      {isYourTurn && !hideControls && (
        <>
          <button className="phase-bar-compact-button secondary" onClick={onNextPhase} disabled={phase === 'end'}>
            Next
          </button>
          <button className="phase-bar-compact-button" onClick={onEndTurn}>
            End Turn
          </button>
        </>
      )}
    </div>
  );
}