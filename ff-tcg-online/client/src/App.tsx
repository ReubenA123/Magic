import React, { useState } from 'react';
import NavBar, { Page } from './components/NavBar';
import HomePage from './pages/HomePage';
import LibraryPage from './pages/LibraryPage';
import DeckBuilderPage from './pages/DeckBuilderPage';
import VersusPage from './pages/VersusPage';
import { GameActivityProvider } from './context/GameActivity';

const PAGE_STORAGE_KEY = 'magic-current-page';
const VALID_PAGES: Page[] = ['home', 'library', 'deckbuilder', 'versus'];

function loadInitialPage(): Page {
  try {
    const saved = localStorage.getItem(PAGE_STORAGE_KEY);
    if (saved && VALID_PAGES.includes(saved as Page)) return saved as Page;
  } catch {
    // localStorage unavailable - fall through to default.
  }
  return 'home';
}

export default function App() {
  const [page, setPage] = useState<Page>(loadInitialPage);
  const [inGame, setInGame] = useState(false);

  function navigate(next: Page) {
    setPage(next);
    try {
      localStorage.setItem(PAGE_STORAGE_KEY, next);
    } catch {
      // Ignore - just means the choice won't survive a refresh this time.
    }
  }

  return (
    <GameActivityProvider value={setInGame}>
      <div className="app-shell">
        <NavBar page={page} onNavigate={navigate} pinned={!inGame} />
        <div className="app-content">
          {page === 'home' && <HomePage onNavigate={navigate} />}
          {page === 'library' && <LibraryPage />}
          {page === 'deckbuilder' && <DeckBuilderPage />}
          {page === 'versus' && <VersusPage />}
        </div>
      </div>
    </GameActivityProvider>
  );
}