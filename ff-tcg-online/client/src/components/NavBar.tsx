import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import AccountAuthModal from './AccountAuthModal';

export type Page = 'home' | 'library' | 'deckbuilder' | 'versus' | 'account';

interface NavBarProps {
  page: Page;
  onNavigate: (page: Page) => void;
}

export default function NavBar({ page, onNavigate }: NavBarProps) {
  const { user, restoring } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const tabs: { id: Page; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'library', label: 'Library' },
    { id: 'deckbuilder', label: 'Deck Builder' },
    { id: 'versus', label: 'Versus' },
  ];

  return (
    <nav className="nav-bar">
      <span className="nav-brand">Magic</span>
      <div className="nav-tabs">
        {tabs.map((tab) => (
          <button key={tab.id} className={`nav-tab ${page === tab.id ? 'nav-tab-active' : ''}`} onClick={() => onNavigate(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Account + avatar, pinned to the far right - see AccountAuthModal for
          the log in/sign up flow this opens when nobody's logged in yet. */}
      <button
        className={`nav-account-button ${page === 'account' ? 'nav-tab-active' : ''}`}
        onClick={() => (user ? onNavigate('account') : setShowAuthModal(true))}
        disabled={restoring}
      >
        <span>{restoring ? 'Loading…' : user ? user.username : 'Account'}</span>
        <Avatar avatar={user?.avatar} size={32} />
      </button>

      {showAuthModal && <AccountAuthModal onClose={() => setShowAuthModal(false)} />}
    </nav>
  );
}