import React, { useState } from 'react';
import NavBar, { Page } from './components/NavBar';
import HomePage from './pages/HomePage';
import LibraryPage from './pages/LibraryPage';
import DeckBuilderPage from './pages/DeckBuilderPage';
import DecksPage from './pages/DecksPage';
import VersusPage from './pages/VersusPage';
import AccountPage from './pages/AccountPage';
import { GameActivityProvider } from './context/GameActivity';
import { AuthProvider, useAuth } from './context/AuthContext';

const PAGE_STORAGE_KEY = 'magic-current-page';
const VALID_PAGES: Page[] = ['home', 'library', 'deckbuilder', 'decks', 'versus', 'account'];

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
    <AuthProvider>
      <GameActivityProvider value={setInGame}>
        <div className="app-shell">
          {!inGame && <NavBar page={page} onNavigate={navigate} />}
          <div className="app-content">
            {page === 'home' && <HomePage onNavigate={navigate} />}
            {page === 'library' && <LibraryPage />}
            {page === 'deckbuilder' && <DeckBuilderPage />}
            {page === 'decks' && <DecksPage onNavigate={navigate} />}
            {page === 'versus' && <VersusPage />}
            {/* Falls back to Home rather than a blank page if the saved "last
                page was Account" gets restored after a session has expired. */}
            {page === 'account' && <AccountPageOrHome onNavigate={navigate} />}
          </div>
        </div>
      </GameActivityProvider>
    </AuthProvider>
  );
}

function AccountPageOrHome({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const { user } = useAuth();
  return user ? <AccountPage /> : <HomePage onNavigate={onNavigate} />;
}