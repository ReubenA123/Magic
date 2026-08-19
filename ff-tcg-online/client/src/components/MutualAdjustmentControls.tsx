import React from 'react';
import { GameState } from '../types';

interface MutualAdjustmentControlsProps {
  state: GameState;
  yourPlayerId: string;
  onRequest: () => void;
  onRespond: (accept: boolean) => void;
  onRequestExit: () => void;
  onRespondExit: (accept: boolean) => void;
}

export default function MutualAdjustmentControls({ state, yourPlayerId, onRequest, onRespond, onRequestExit, onRespondExit }: MutualAdjustmentControlsProps) {
  const ma = state.mutualAdjustment;

  if (ma.status === 'inactive') {
    return (
      <button className="mutual-adjustment-button" onClick={onRequest}>
        Request Mutual Adjustment
      </button>
    );
  }

  if (ma.status === 'requested') {
    if (ma.requestedBy === yourPlayerId) {
      return <span className="mutual-adjustment-waiting">Waiting for agreement\u2026</span>;
    }
    return (
      <span className="mutual-adjustment-prompt">
        Agree to Mutual Adjustment?
        <button className="mutual-adjustment-yes" onClick={() => onRespond(true)}>
          Yes
        </button>
        <button className="mutual-adjustment-no" onClick={() => onRespond(false)}>
          No
        </button>
      </span>
    );
  }

  if (ma.status === 'active') {
    return (
      <button className="mutual-adjustment-button mutual-adjustment-active" onClick={onRequestExit}>
        Mutual Adjustment Active - End it
      </button>
    );
  }

  if (ma.status === 'exit_requested') {
    if (ma.requestedBy === yourPlayerId) {
      return <span className="mutual-adjustment-waiting">Waiting to confirm exit\u2026</span>;
    }
    return (
      <span className="mutual-adjustment-prompt">
        End Mutual Adjustment?
        <button className="mutual-adjustment-yes" onClick={() => onRespondExit(true)}>
          Yes
        </button>
        <button className="mutual-adjustment-no" onClick={() => onRespondExit(false)}>
          No
        </button>
      </span>
    );
  }

  return null;
}