// ============================================================================
// index.ts
//
// Server entry point. Starts an HTTP server (Express, currently just for a
// health check) with a Socket.io server attached for the actual game
// traffic. See socket/index.ts for the game logic wiring, and README.md at
// the project root for how to run this.
// ============================================================================

import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { registerSocketHandlers } from './socket';

const PORT = Number(process.env.PORT) || 4000;
// In dev, the client runs on its own Vite dev server (default port 5173) and
// needs CORS permission to open a socket to this server. In production,
// where you build the client and serve it from this same server (or from a
// static host), you can tighten this to your actual domain.
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const app = express();
app.get('/health', (_req, res) => res.json({ ok: true }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGIN },
});

registerSocketHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`Game server listening on http://localhost:${PORT}`);
  if (!process.env.GAME_PASSWORD) {
    console.warn('WARNING: GAME_PASSWORD is not set in the environment - see server/.env.example. All connections will be refused until it is set.');
  }
});
