import React, { useState } from 'react';
import NavBar, { Page } from './components/NavBar';
import HomePage from './pages/HomePage';
import LibraryPage from './pages/LibraryPage';
import VersusPage from './pages/VersusPage';

export default function App() {
  const [page, setPage] = useState<Page>('home');

  return (
    <div className="app-shell">
      <NavBar page={page} onNavigate={setPage} />
      <div className="app-content">
        {page === 'home' && <HomePage onNavigate={setPage} />}
        {page === 'library' && <LibraryPage />}
        {page === 'versus' && <VersusPage />}
      </div>
    </div>
  );
}