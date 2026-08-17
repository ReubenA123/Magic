import React from 'react';
import { Page } from '../components/NavBar';
import { CARD_POOL } from '../data/cards';

interface HomePageProps {
  onNavigate: (page: Page) => void;
}

export default function HomePage({ onNavigate }: HomePageProps) {
  return (
    <div className="home-page">
      <h1>Magic</h1>
      <p className="home-subtitle">A private two-player card game.</p>
      <div className="home-cards">
        <button className="home-card" onClick={() => onNavigate('library')}>
          <h3>Library</h3>
          <p>Browse all {CARD_POOL.length} cards in the pool.</p>
        </button>
        <button className="home-card" onClick={() => onNavigate('versus')}>
          <h3>Versus</h3>
          <p>Start or join a match.</p>
        </button>
      </div>
    </div>
  );
}