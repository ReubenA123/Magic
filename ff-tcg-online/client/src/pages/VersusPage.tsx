import React, { useEffect, useState } from 'react';
import Login from '../components/Login';
import PregameSetup from '../components/PregameSetup';
import GameBoard from '../components/GameBoard';
import { connectToGame, getSocket } from '../api/socket';
import { GameState } from '../types';

type ConnectionStatus = 'logged-out' | 'connecting' | 'waiting-for-opponent' | 'in-game' | 'error';

export default function VersusPage() {
  const [status, setStatus] = useState<ConnectionStatus>('logged-out');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [yourPlayerId, setYourPlayerId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);

  function handleLogin(name: string, password: string) {
    setStatus('connecting');
    setErrorMessage(null);
    const socket = connectToGame(password);

    socket.on('connect_error', (err) => {
      setStatus('error');
      setErrorMessage(err.message === 'Incorrect password.' ? 'Incorrect password.' : 'Could not connect to the server.');
    });

    socket.on('connect', () => {
      socket.emit('join', { name });
    });

    socket.on('joined', ({ playerId }: { playerId: string }) => {
      setYourPlayerId(playerId);
      setStatus('waiting-for-opponent');
    });

    socket.on('join-error', (message: string) => {
      setStatus('error');
      setErrorMessage(message);
    });

    socket.on('state', (state: GameState) => {
      setGameState(state);
      setStatus('in-game');
    });

    socket.on('action-error', (message: string) => {
      setActionError(message);
      setTimeout(() => setActionError(null), 4000);
    });
  }

  useEffect(() => {
    return () => {
      try {
        getSocket().removeAllListeners();
      } catch {
        // Socket was never connected - nothing to clean up.
      }
    };
  }, []);

  if (status === 'logged-out' || status === 'connecting' || status === 'error') {
    return <Login onSubmit={handleLogin} errorMessage={errorMessage} />;
  }

  if (status === 'waiting-for-opponent') {
    return (
      <div className="waiting-screen">
        <h2>Waiting for your brother to join{'\u2026'}</h2>
        <p>Send him the URL and the password. The board appears the moment he joins.</p>
      </div>
    );
  }

  if (status === 'in-game' && gameState && yourPlayerId) {
    if (gameState.phase === 'pregame') {
      return <PregameSetup state={gameState} yourPlayerId={yourPlayerId} />;
    }
    return <GameBoard state={gameState} yourPlayerId={yourPlayerId} actionError={actionError} />;
  }

  return null;
}