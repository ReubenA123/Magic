// ============================================================================
// hooks/useLocalGame.ts
//
// State management for a local (offline, browser-only) game - the VS AI /
// practice mode equivalent of what the server does for networked play,
// including its own small undo history, since there's no socket layer here
// to hold one.
// ============================================================================

import { useCallback, useRef, useState } from 'react';
import { GameAction, GameState } from '../types';
import { applyAction } from '../engine/actions';

const MAX_HISTORY = 25;

export function useLocalGame(initialState: GameState) {
  const [state, setState] = useState<GameState>(initialState);
  const [actionError, setActionError] = useState<string | null>(null);
  const historyRef = useRef<GameState[]>([]);

  const dispatch = useCallback((action: GameAction, actingPlayerId?: string) => {
    setState((current) => {
      if (action.type === 'UNDO') {
        const previous = historyRef.current.pop();
        if (!previous) {
          setActionError('Nothing left to undo.');
          return current;
        }
        setActionError(null);
        return { ...previous, log: [...previous.log, 'Undo used.'] };
      }

      const playerId = actingPlayerId ?? current.players[0].id;
      const result = applyAction(current, action, playerId);
      if (!result.ok) {
        setActionError(result.error);
        return current;
      }

      historyRef.current.push(current);
      if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
      setActionError(null);
      return result.state;
    });
  }, []);

  return { state, dispatch, actionError };
}