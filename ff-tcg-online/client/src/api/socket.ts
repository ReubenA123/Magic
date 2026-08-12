// ============================================================================
// api/socket.ts
//
// One socket connection, created lazily once the player submits the login
// form (see components/Login.tsx). Keeping this in its own module - rather
// than creating a new socket inside a component - means the connection
// survives component re-renders and is easy to import from anywhere.
// ============================================================================

import { io, Socket } from 'socket.io-client';
import { GameAction, GameState } from '../types';

// Point this at wherever the server actually runs. In dev this is the
// server's default port (see server/.env.example); override with a .env
// file (VITE_SERVER_URL) if you deploy the two apps separately.
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

let socket: Socket | null = null;

export function connectToGame(password: string): Socket {
  if (socket) return socket;
  socket = io(SERVER_URL, { auth: { password } });
  return socket;
}

export function getSocket(): Socket {
  if (!socket) throw new Error('Socket not connected yet - call connectToGame first.');
  return socket;
}

export function sendAction(action: GameAction) {
  getSocket().emit('action', action);
}

export function disconnectFromGame() {
  socket?.disconnect();
  socket = null;
}

// Re-exported purely so components can import GameState/GameAction from one
// place alongside the socket helpers, if convenient.
export type { GameState, GameAction };
