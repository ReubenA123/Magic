import React, { useState } from 'react';

interface LoginProps {
  onSubmit: (name: string, password: string) => void;
  errorMessage: string | null;
}

/**
 * The whole "authentication" experience: a name and a shared password, both
 * of which get sent once as the socket connects (see api/socket.ts). There's
 * no account system - see server/auth/checkPassword.ts for why that's fine
 * for a two-person private game.
 */
export default function Login({ onSubmit, errorMessage }: LoginProps) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !password) return;
    onSubmit(name.trim(), password);
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1>Magic</h1>
        <p className="login-subtitle">A private two-player card game. Enter the shared password to join.</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="name">Your name</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoFocus />

          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

          {errorMessage && <p className="login-error">{errorMessage}</p>}

          <button type="submit" disabled={!name.trim() || !password}>
            Join game
          </button>
        </form>
      </div>
    </div>
  );
}
