// ============================================================================
// hooks/useLocalGame.ts
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { CardInstance, GameAction, GameState, ManaColor } from '../types';
import { applyAction } from '../engine/actions';
import { getCardDefinition } from '../data/cards';
import { canPay, parseCostLabel } from '../engine/mana';
import { hasKeyword } from '../engine/keywords';
import { effectivePower, effectiveToughness, isLegalPendingTarget } from '../engine/combat';

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

  // --- AI: mark itself ready to resolve combat -------------------------
  // Deliberately NOT gated by "is it the AI's turn" - combat_damage can
  // happen during YOUR turn (when you're attacking and the AI is
  // defending), and the AI still needs to agree to resolve. Without this
  // separate effect, the AI would never respond in that situation, leaving
  // the game stuck waiting on a "ready" that never comes.
  useEffect(() => {
    if (state.winnerId) return;
    if (state.phase !== 'combat_damage') return;
    if (state.mutualAdjustment.status !== 'inactive') return;
    if (state.combatReadyPlayers.includes(AI_PLAYER_ID)) return;

    const timer = setTimeout(() => {
      dispatch({ type: 'NEXT_PHASE' }, AI_PLAYER_ID);
    }, 800);
    return () => clearTimeout(timer);
  }, [state.phase, state.combatReadyPlayers, state.mutualAdjustment.status, state.winnerId, dispatch]);

  // --- AI: choose a target for its own pending targeted ability ---------
  // Without this, the AI could cast something like a tap-and-stun creature
  // or Omega's Wave Cannon and then just leave GameState.pendingTarget
  // sitting there forever - nobody else is allowed to choose for the AI, so
  // the "choose a target" banner would never clear. Deliberately simple, not
  // remotely optimal: prefers the biggest creature (power + toughness
  // combined, ties broken at random - same shape as engine/effects.ts:
  // resolveSacrificeQueue's own AI heuristic) among legal candidates;
  // failing that, the first legal artifact or enchantment; failing that,
  // whatever's first; only declines if nothing at all is legal (shouldn't
  // normally happen - the engine only ever offers a target when at least
  // one exists). See engine/combat.ts: isLegalPendingTarget for the shared
  // legality rules (same ones the human-facing UI uses).
  useEffect(() => {
    if (state.winnerId) return;
    if (state.mutualAdjustment.status !== 'inactive') return;
    const pending = state.pendingTarget;
    if (!pending || pending.controllerId !== AI_PLAYER_ID) return;

    const timer = setTimeout(() => {
      const candidates = state.players.flatMap((p) =>
        p.zones.battlefield.filter((c) => isLegalPendingTarget(state, pending, c, p.id)).map((c) => ({ card: c, ownerId: p.id }))
      );

      if (candidates.length === 0) {
        dispatch({ type: 'CHOOSE_TARGET', targetInstanceId: null }, AI_PLAYER_ID);
        return;
      }

      const creatures = candidates.filter((c) => getCardDefinition(c.card.defId).type === 'creature');
      let chosen: CardInstance;
      if (creatures.length > 0) {
        let best = creatures[0];
        let bestScore = -Infinity;
        let tieCount = 0;
        for (const c of creatures) {
          const d = getCardDefinition(c.card.defId);
          const score = effectivePower(d, c.card, state, c.ownerId) + effectiveToughness(d, c.card, state, c.ownerId);
          if (score > bestScore) {
            best = c;
            bestScore = score;
            tieCount = 1;
          } else if (score === bestScore) {
            tieCount += 1;
            if (Math.random() < 1 / tieCount) best = c;
          }
        }
        chosen = best.card;
      } else {
        const artifactOrEnchantment = candidates.find((c) => {
          const t = getCardDefinition(c.card.defId).type;
          return t === 'artifact' || t === 'enchantment';
        });
        chosen = (artifactOrEnchantment ?? candidates[0]).card;
      }

      dispatch({ type: 'CHOOSE_TARGET', targetInstanceId: chosen.instanceId }, AI_PLAYER_ID);
    }, 800);
    return () => clearTimeout(timer);
  }, [state, dispatch]);

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
    // Let the targeting effect above fully resolve first - otherwise this
    // effect could fire on the same stale state and dispatch something else
    // (e.g. cast another card) while a target is still outstanding, and
    // since pendingTarget only ever holds one at a time, a second cast that
    // also needs a target would silently clobber the first, leaving it
    // stuck forever.
    if (state.pendingTarget?.controllerId === AI_PLAYER_ID) return;

    const timer = setTimeout(() => {
      const ai = state.players.find((p) => p.id === AI_PLAYER_ID)!;

      switch (state.phase) {
        case 'upkeep':
        case 'combat_begin':
        case 'combat_end':
        case 'combat_damage':
          dispatch({ type: 'NEXT_PHASE' }, AI_PLAYER_ID);
          break;
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
            return d.type === 'creature' && !c.tapped && !c.summoningSick && !hasKeyword(d, 'defender');
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