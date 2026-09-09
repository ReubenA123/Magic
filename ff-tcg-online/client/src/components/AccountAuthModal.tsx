import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/rest';

interface AccountAuthModalProps {
  onClose: () => void;
}

/**
 * Log in / sign up, toggled by one tab pair rather than two separate
 * screens - see NavBar for where this opens from. Username/password only,
 * by design (see project notes): no OAuth, and email is strictly optional,
 * offered purely as a password-recovery path for later.
 */
export default function AccountAuthModal({ onClose }: AccountAuthModalProps) {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function switchMode(next: 'login' | 'signup') {
    setMode(next);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === 'signup' && password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') await login(username, password);
      else await signup(username, password, email);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong - try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card-actions-overlay" onClick={onClose}>
      <div className="account-auth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="card-actions-header">
          <strong>{mode === 'login' ? 'Log In' : 'Sign Up'}</strong>
          <button className="close-button" onClick={onClose}>
            {'✕'}
          </button>
        </div>

        <div className="account-auth-tabs">
          <button className={`account-auth-tab ${mode === 'login' ? 'account-auth-tab-active' : ''}`} onClick={() => switchMode('login')} type="button">
            Log In
          </button>
          <button className={`account-auth-tab ${mode === 'signup' ? 'account-auth-tab-active' : ''}`} onClick={() => switchMode('signup')} type="button">
            Sign Up
          </button>
        </div>

        <form className="account-auth-form" onSubmit={handleSubmit}>
          <label htmlFor="account-username">Username</label>
          <input id="account-username" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={20} autoFocus required />

          <label htmlFor="account-password">Password</label>
          <input id="account-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />

          {mode === 'signup' && (
            <>
              <label htmlFor="account-confirm-password">Confirm password</label>
              <input id="account-confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} required />

              <label htmlFor="account-email">Email (optional)</label>
              <input id="account-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Only used to recover your password" />
              <p className="account-auth-hint">Skip this if you don't want to add it - just know there's no way to recover your account if you forget your password.</p>
            </>
          )}

          {error && <p className="login-error">{error}</p>}

          <button type="submit" className="card-action-button card-action-button-play" disabled={submitting}>
            {submitting ? 'Please wait…' : mode === 'login' ? 'Log In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
