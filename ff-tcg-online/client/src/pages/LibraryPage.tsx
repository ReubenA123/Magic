import React, { useMemo, useState } from 'react';
import { CARD_POOL } from '../data/cards';
import { CardType } from '../types';
import Card from '../components/Card';

const TYPE_FILTERS: (CardType | 'all')[] = ['all', 'creature', 'instant', 'sorcery', 'artifact', 'enchantment', 'land'];

export default function LibraryPage() {
  const [filter, setFilter] = useState<CardType | 'all'>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    return CARD_POOL.filter((c) => {
      const matchesType = filter === 'all' || c.type === filter;
      const matchesQuery = c.name.toLowerCase().includes(query.toLowerCase());
      return matchesType && matchesQuery;
    });
  }, [filter, query]);

  return (
    <div className="library-page">
      <div className="library-controls">
        <input className="library-search" placeholder="Search by name\u2026" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="library-filters">
          {TYPE_FILTERS.map((t) => (
            <button key={t} className={`library-filter-button ${filter === t ? 'library-filter-active' : ''}`} onClick={() => setFilter(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <p className="library-count">{filtered.length} card(s)</p>
      <div className="library-grid">
        {filtered.map((def) => (
          <Card key={def.id} definition={def} />
        ))}
      </div>
    </div>
  );
}