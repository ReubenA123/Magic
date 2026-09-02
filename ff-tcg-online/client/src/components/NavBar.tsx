import React from 'react';

export type Page = 'home' | 'library' | 'deckbuilder' | 'versus';

interface NavBarProps {
  page: Page;
  onNavigate: (page: Page) => void;
  /** Sticky at the top of the viewport - turned off while a live game is on screen. */
  pinned?: boolean;
}

export default function NavBar({ page, onNavigate, pinned }: NavBarProps) {
  const tabs: { id: Page; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'library', label: 'Library' },
    { id: 'deckbuilder', label: 'Deck Builder' },
    { id: 'versus', label: 'Versus' },
  ];

  return (
    <nav className={`nav-bar ${pinned ? 'nav-bar-pinned' : ''}`}>
      <span className="nav-brand">Magic</span>
      <div className="nav-tabs">
        {tabs.map((tab) => (
          <button key={tab.id} className={`nav-tab ${page === tab.id ? 'nav-tab-active' : ''}`} onClick={() => onNavigate(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}