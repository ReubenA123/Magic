import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import AccountDecksTab from '../components/AccountDecksTab';
import AccountFriendsTab from '../components/AccountFriendsTab';
import AvatarCropper from '../components/AvatarCropper';

type Tab = 'decks' | 'friends' | 'achievements';

export default function AccountPage() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>('decks');
  const [editingAvatar, setEditingAvatar] = useState(false);

  // App.tsx only ever renders this page once `user` is set (NavBar routes
  // here from the logged-in state) - this is just a defensive fallback for
  // the moment right after logging out, before the page changes away.
  if (!user) return null;

  return (
    <div className="account-page">
      <div className="account-header">
        <div className="account-header-avatar">
          <Avatar avatar={user.avatar} size={96} />
          <button className="card-action-button secondary" onClick={() => setEditingAvatar(true)}>
            Edit Image
          </button>
        </div>
        <div className="account-header-info">
          <h1>{user.username}</h1>
          <p className="account-tab-hint">Friend code: {user.friendCode}</p>
        </div>
        <button className="concede-button" onClick={() => logout()}>
          Log Out
        </button>
      </div>

      <div className="account-tabs">
        <button className={`account-tab-button ${tab === 'decks' ? 'account-tab-button-active' : ''}`} onClick={() => setTab('decks')}>
          Created Decks
        </button>
        <button className={`account-tab-button ${tab === 'friends' ? 'account-tab-button-active' : ''}`} onClick={() => setTab('friends')}>
          Friends
        </button>
        <button className="account-tab-button" disabled title="Coming later">
          Achievements
        </button>
      </div>

      <div className="account-tab-content">
        {tab === 'decks' && <AccountDecksTab />}
        {tab === 'friends' && <AccountFriendsTab />}
      </div>

      {editingAvatar && <AvatarCropper onClose={() => setEditingAvatar(false)} />}
    </div>
  );
}
