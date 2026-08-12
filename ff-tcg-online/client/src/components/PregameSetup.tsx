import React from 'react';
import { GameState } from '../types';
import { getCardDefinition } from '../data/cards';
import { sendAction } from '../api/socket';
import Card from './Card';

interface PregameSetupProps {
  state: GameState;
  yourPlayerId: string;
}

/**
 * Everything here reuses the same generic actions the rest of the game
 * uses (DRAW_CARD, MOVE_CARD, SHUFFLE_LIBRARY) - there's no special
 * "mulligan" action. Draw cards until your hand looks right, click any
 * card to send it back to your library (which reshuffles automatically -
 * see engine/actions.ts: moveCard), and hit Ready when you're happy.
 */
export default function PregameSetup({ state, yourPlayerId }: PregameSetupProps) {
  const you = state.players.find((p) => p.id === yourPlayerId)!;
  const opponent = state.players.find((p) => p.id !== yourPlayerId)!;

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
          <Card key={c.instanceId} definition={getCardDefinition(c.defId)} instance={c} onClick={() => sendAction({ type: 'MOVE_CARD', instanceId: c.instanceId, toZone: 'library' })} />
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
