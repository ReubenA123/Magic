import React, { useState } from 'react';

interface LoginProps {
  onSubmit: (name: string, password: string) => void;
  errorMessage: string | null;
  onVsAi: () => void;
}

export default function Login({ onSubmit, errorMessage, onVsAi }: LoginProps) {
  const [name, setName] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim(), 'unused');
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1>Magic</h1>
        <p className="login-subtitle">Enter your name to join.</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="name">Your name</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoFocus />

          {errorMessage && <p className="login-error">{errorMessage}</p>}

          <button type="submit" disabled={!name.trim()}>
            Join game
          </button>
        </form>

        <button className="vs-ai-button" onClick={onVsAi}>
          VS AI
        </button>
      </div>
    </div>
  );
}