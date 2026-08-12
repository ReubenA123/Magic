// ============================================================================
// socket/index.ts
//
// Wires Socket.io events to the game engine. One in-memory two-player
// session, as before - see the note in the previous version of this file
// (still true) about what that trade-off means for restarts.
//
// New in this version: an undo history. Before every successfully-applied
// action, the state that was current gets pushed onto `session.history`.
// UNDO pops the most recent entry and makes it current again - call it
// repeatedly to step back through several actions, per how you two wanted
// undo to work.
// ============================================================================

import { Server, Socket } from 'socket.io';
import { checkPassword } from '../auth/checkPassword';
import { createInitialState } from '../engine/state';
import { applyAction } from '../engine/actions';
import { GameAction, GameState } from '../types';

interface Seat {
  socketId: string;
  playerId: string;
  name: string;
}

const MAX_HISTORY = 25;

const session: { seats: Seat[]; state: GameState | null; history: GameState[] } = {
  seats: [],
  state: null,
  history: [],
};

export function registerSocketHandlers(io: Server) {
  io.use((socket, next) => {
    const password = socket.handshake.auth?.password;
    if (!checkPassword(password)) {
      next(new Error('Incorrect password.'));
      return;
    }
    next();
  });

  io.on('connection', (socket: Socket) => {
    socket.on('join', (payload: { name: string }) => {
      const name = (payload?.name || 'Player').slice(0, 24);

      const existingSeat = session.seats.find((s) => s.name === name);
      if (existingSeat) {
        existingSeat.socketId = socket.id;
        socket.emit('joined', { playerId: existingSeat.playerId });
        if (session.state) socket.emit('state', session.state);
        return;
      }

      if (session.seats.length >= 2) {
        socket.emit('join-error', 'The game already has two players.');
        return;
      }

      const playerId = `player-${session.seats.length + 1}`;
      session.seats.push({ socketId: socket.id, playerId, name });
      socket.emit('joined', { playerId });

      if (session.seats.length === 2) {
        const [p1, p2] = session.seats;
        session.state = createInitialState(p1.name, p2.name, p1.playerId, p2.playerId);
        session.history = [];
        broadcastState(io);
      }
    });

    socket.on('action', (action: GameAction) => {
      const seat = session.seats.find((s) => s.socketId === socket.id);
      if (!seat || !session.state) {
        socket.emit('action-error', 'You are not seated in an active game yet.');
        return;
      }

      if (action.type === 'UNDO') {
        const previous = session.history.pop();
        if (!previous) {
          socket.emit('action-error', 'Nothing left to undo.');
          return;
        }
        session.state = { ...previous, log: [...previous.log, `${seat.name} used undo.`] };
        broadcastState(io);
        return;
      }

      const result = applyAction(session.state, action, seat.playerId);
      if (!result.ok) {
        socket.emit('action-error', result.error);
        return;
      }

      session.history.push(session.state);
      if (session.history.length > MAX_HISTORY) session.history.shift();

      session.state = result.state;
      broadcastState(io);
    });

    socket.on('disconnect', () => {
      // Seats are intentionally left in place so a dropped connection
      // doesn't end the match - see the reconnect logic in 'join' above.
    });
  });
}

function broadcastState(io: Server) {
  if (!session.state) return;
  io.emit('state', session.state);
}
