import React from 'react';

export type Page = 'home' | 'library' | 'versus';

interface NavBarProps {
  page: Page;
  onNavigate: (page: Page) => void;
}

export default function NavBar({ page, onNavigate }: NavBarProps) {
  const tabs: { id: Page; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'library', label: 'Library' },
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
    </nav>
  );
}