import React from 'react';
import { Phase } from '../types';

const PHASE_LABELS: Record<Phase, string> = {
  pregame: 'Pregame',
  untap: 'Untap',
  upkeep: 'Upkeep',
  draw: 'Draw',
  main1: 'Main Phase 1',
  combat: 'Combat',
  main2: 'Main Phase 2',
  end: 'End Step',
};

interface PhaseBarProps {
  phase: Phase;
  turnNumber: number;
  isYourTurn: boolean;
  onNextPhase: () => void;
  onEndTurn: () => void;
}

/** A reference strip only - nothing is enforced by phase, see types.ts. Next
 * Phase just advances the cosmetic label; End Turn is what actually passes
 * the turn (and untaps the other player's stuff for them). */
export default function PhaseBar({ phase, turnNumber, isYourTurn, onNextPhase, onEndTurn }: PhaseBarProps) {
  return (
    <div className="phase-bar">
      <div className="phase-bar-info">
        <span className="phase-bar-turn">Turn {turnNumber}</span>
        <span className="phase-bar-phase">{PHASE_LABELS[phase]}</span>
        <span className="phase-bar-whose-turn">{isYourTurn ? 'Your turn' : "Opponent's turn"}</span>
      </div>
      {isYourTurn && (
        <div className="phase-bar-buttons">
          <button className="phase-bar-button secondary" onClick={onNextPhase} disabled={phase === 'end'}>
            Next phase
          </button>
          <button className="phase-bar-button" onClick={onEndTurn}>
            End turn
          </button>
        </div>
      )}
    </div>
  );
}
