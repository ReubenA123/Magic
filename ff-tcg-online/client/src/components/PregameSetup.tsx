import React, { useEffect, useRef } from 'react';
import { GameState } from '../types';
import { getCardDefinition } from '../data/cards';
import { sendAction } from '../api/socket';
import Card from './Card';

interface PregameSetupProps {
  state: GameState;
  yourPlayerId: string;
}

const OPENING_HAND_SIZE = 7;
const AUTO_DRAW_INTERVAL_MS = 350; // 7 draws ~ 2.5s total

/**
 * Everything here reuses the same generic actions the rest of the game
 * uses (DRAW_CARD, MOVE_CARD, SHUFFLE_LIBRARY) - there's no special
 * "mulligan" action. On arrival, your opening 7 draw themselves
 * automatically (see the effect below) - after that, click any card to
 * send it back to your library (which reshuffles automatically - see
 * engine/actions.ts: moveCard), draw or shuffle manually if you want a
 * different hand, and hit Ready when you're happy.
 */
export default function PregameSetup({ state, yourPlayerId }: PregameSetupProps) {
  const you = state.players.find((p) => p.id === yourPlayerId)!;
  const opponent = state.players.find((p) => p.id !== yourPlayerId)!;

  // Auto-draw up to a 7-card opening hand once, on arrival - a few hundred ms
  // apart so it visibly deals one card at a time instead of all at once.
  // Guarded by a ref (not state) so it fires exactly once even under
  // StrictMode's double-invoke, and never re-triggers from later hand changes
  // (manual draws/mulligans afterward should stay a single instant action).
  const autoDrawStarted = useRef(false);
  useEffect(() => {
    if (autoDrawStarted.current || you.ready) return;
    autoDrawStarted.current = true;
    let drawn = 0;
    const remaining = OPENING_HAND_SIZE - you.zones.hand.length;
    if (remaining <= 0) return;
    const interval = setInterval(() => {
      sendAction({ type: 'DRAW_CARD' });
      drawn += 1;
      if (drawn >= remaining) clearInterval(interval);
    }, AUTO_DRAW_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="pregame-screen">
      <h2>Set up your opening hand</h2>
      <p className="pregame-hint">
        Draw cards, click any you don't want to shuffle them back into your library, and press Ready when you're happy. The game starts once both of
        you are ready.
      </p>

      <div className="pregame-status">
        <span>You: {you.ready ? 'Ready' : 'Not ready'}</span>
        <span>
          {opponent.name}: {opponent.ready ? 'Ready' : 'Not ready'}
        </span>
      </div>

      <div className="pregame-hand">
        {you.zones.hand.map((c) => (
          <div key={c.instanceId} className="pregame-card-enter">
            <Card definition={getCardDefinition(c.defId)} instance={c} onClick={() => sendAction({ type: 'MOVE_CARD', instanceId: c.instanceId, toZone: 'library' })} />
          </div>
        ))}
      </div>

      <div className="pregame-controls">
        <button onClick={() => sendAction({ type: 'DRAW_CARD' })} disabled={you.ready}>
          Draw a card
        </button>
        <button onClick={() => sendAction({ type: 'SHUFFLE_LIBRARY' })} disabled={you.ready}>
          Shuffle library
        </button>
        <button className="ready-button" onClick={() => sendAction({ type: 'READY_TO_START' })} disabled={you.ready}>
          {you.ready ? 'Waiting for opponent\u2026' : "I'm ready"}
        </button>
      </div>

      <p className="pregame-library-count">{you.zones.library.length} cards left in your library.</p>
    </div>
  );
}
