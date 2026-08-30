// ============================================================================
// hooks/useLocalGame.ts
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { GameAction, GameState, ManaColor } from '../types';
import { applyAction } from '../engine/actions';
import { getCardDefinition } from '../data/cards';
import { canPay, parseCostLabel } from '../engine/mana';
import { hasKeyword } from '../engine/keywords';

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

  useEffect(() => {
    const ma = state.mutualAdjustment;
    const pendingOnAi = (ma.status === 'requested' || ma.status === 'exit_requested') && ma.requestedBy !== AI_PLAYER_ID && !ma.agreedBy.includes(AI_PLAYER_ID);
    if (!pendingOnAi) return;
    const timer = setTimeout(() => {
      if (ma.status === 'requested') dispatch({ type: 'RESPOND_MUTUAL_ADJUSTMENT', accept: true }, AI_PLAYER_ID);
      else dispatch({ type: 'RESPOND_EXIT_MUTUAL_ADJUSTMENT', accept: true }, AI_PLAYER_ID);
    }, 500);
    return () => clearTimeout(timer);
  }, [state.mutualAdjustment, dispatch]);

  useEffect(() => {
    if (state.winnerId) return;
    if (state.phase !== 'declare_blockers') return;
    if (state.mutualAdjustment.status !== 'inactive') return;
    const defenderId = state.players.find((p) => p.id !== state.activePlayerId)!.id;
    if (defenderId !== AI_PLAYER_ID) return;

    const timer = setTimeout(() => {
      const ai = state.players.find((p) => p.id === AI_PLAYER_ID)!;
      const availableBlockers = ai.zones.battlefield.filter((c) => getCardDefinition(c.defId).type === 'creature' && !c.tapped);
      const assignments = state.declaredAttackers.map((attackerId, i) => ({
        attackerInstanceId: attackerId,
        blockerInstanceIds: availableBlockers[i] ? [availableBlockers[i].instanceId] : [],
      }));
      dispatch({ type: 'DECLARE_BLOCKERS', assignments }, AI_PLAYER_ID);
    }, 800);
    return () => clearTimeout(timer);
  }, [state.phase, state.declaredAttackers, state.activePlayerId, state.mutualAdjustment.status, state.winnerId, dispatch]);

  // --- AI: step through its own turn -----------------------------------
  // Main phase logic: play a land if it hasn't yet, then tap untapped
  // lands one at a time (building its mana pool over several ticks) and
  // cast whatever in hand it can currently afford, repeating until nothing
  // more is affordable, then move on. Deliberately simple - no sequencing
  // strategy, just "spend everything you can."
  useEffect(() => {
    if (state.winnerId) return;
    if (state.activePlayerId !== AI_PLAYER_ID) return;
    if (state.mutualAdjustment.status !== 'inactive') return;
    if (state.phase === 'untap' || state.phase === 'declare_blockers') return;

    const timer = setTimeout(() => {
      const ai = state.players.find((p) => p.id === AI_PLAYER_ID)!;

      switch (state.phase) {
        case 'upkeep':
        case 'combat_begin':
        case 'combat_end':
        case 'combat_damage':
        case 'main2':
        case 'end':
          dispatch({ type: 'NEXT_PHASE' }, AI_PLAYER_ID);
          break;

        case 'draw':
          if (!ai.hasDrawnThisTurn) dispatch({ type: 'DRAW_CARD' }, AI_PLAYER_ID);
          break;

        case 'main1': {
          if (!ai.hasPlayedLandThisTurn) {
            const land = ai.zones.hand.find((c) => getCardDefinition(c.defId).type === 'land');
            if (land) {
              dispatch({ type: 'CAST_CARD', instanceId: land.instanceId }, AI_PLAYER_ID);
              break;
            }
          }

          const untappedLand = ai.zones.battlefield.find((c) => {
            const d = getCardDefinition(c.defId);
            return d.type === 'land' && !c.tapped && d.producesMana;
          });
          if (untappedLand) {
            const d = getCardDefinition(untappedLand.defId);
            let color: ManaColor = 'C';
            if (Array.isArray(d.producesMana)) color = d.producesMana[0];
            else if (d.producesMana && d.producesMana !== 'any') color = d.producesMana;
            dispatch({ type: 'TOGGLE_TAP', instanceId: untappedLand.instanceId, chosenColor: color }, AI_PLAYER_ID);
            break;
          }

          const castable = ai.zones.hand.find((c) => {
            const d = getCardDefinition(c.defId);
            if (d.type === 'land') return false;
            return canPay(ai.manaPool, parseCostLabel(d.costLabel), 0);
          });
          if (castable) {
            dispatch({ type: 'CAST_CARD', instanceId: castable.instanceId }, AI_PLAYER_ID);
            break;
          }

          dispatch({ type: 'NEXT_PHASE' }, AI_PLAYER_ID);
          break;
        }

        case 'declare_attackers': {
          const attackers = ai.zones.battlefield.filter((c) => {
            const d = getCardDefinition(c.defId);
            return d.type === 'creature' && !c.tapped && !c.summoningSick && !hasKeyword(d.text, 'defender');
          });
          dispatch({ type: 'DECLARE_ATTACKERS', instanceIds: attackers.map((c) => c.instanceId) }, AI_PLAYER_ID);
          break;
        }

        case 'cleanup':
          dispatch({ type: 'END_TURN' }, AI_PLAYER_ID);
          break;

        default:
          break;
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [state, dispatch]);

  return { state, dispatch, actionError };
}