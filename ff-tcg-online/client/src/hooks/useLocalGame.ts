// ============================================================================
// hooks/useLocalGame.ts
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { GameAction, GameState } from '../types';
import { applyAction } from '../engine/actions';
import { getCardDefinition } from '../data/cards';

const MAX_HISTORY = 25;
const AI_PLAYER_ID = 'ai';

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

  // --- Basic AI turn: play a land if it has one, then end turn. -----------
  // Deliberately simple for now - see engine/actions.ts if you want the AI
  // to eventually cast creatures/spells too; this just proves the turn
  // actually passes back and forth correctly.
  useEffect(() => {
    if (state.activePlayerId !== AI_PLAYER_ID) return;
    if (state.mutualAdjustment.status !== 'inactive') return;
    if (state.winnerId) return;

    const timer = setTimeout(() => {
      setState((current) => {
        if (current.activePlayerId !== AI_PLAYER_ID) return current;
        let working = current;

        const aiPlayer = working.players.find((p) => p.id === AI_PLAYER_ID)!;
        if (!aiPlayer.hasPlayedLandThisTurn) {
          const landCard = aiPlayer.zones.hand.find((c) => getCardDefinition(c.defId).type === 'land');
          if (landCard) {
            const playResult = applyAction(working, { type: 'CAST_CARD', instanceId: landCard.instanceId }, AI_PLAYER_ID);
            if (playResult.ok) working = playResult.state;
          }
        }

        const endResult = applyAction(working, { type: 'END_TURN' }, AI_PLAYER_ID);
        if (endResult.ok) working = endResult.state;

        return working;
      });
    }, 900);

    return () => clearTimeout(timer);
  }, [state.activePlayerId, state.turnNumber, state.mutualAdjustment.status, state.winnerId]);

  return { state, dispatch, actionError };
}