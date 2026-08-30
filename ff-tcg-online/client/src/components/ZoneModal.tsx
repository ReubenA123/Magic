import React, { useMemo, useState } from 'react';
import { CardInstance, CardType } from '../types';
import { getCardDefinition } from '../data/cards';
import Card from './Card';

interface ZoneModalProps {
  title: string;
  cards: CardInstance[];
  onClose: () => void;
  onCardClick: (instanceId: string) => void;
}

const TYPE_FILTERS: (CardType | 'all')[] = ['all', 'creature', 'instant', 'sorcery', 'artifact', 'enchantment', 'land'];

export default function ZoneModal({ title, cards, onClose, onCardClick }: ZoneModalProps) {
  const [filter, setFilter] = useState<CardType | 'all'>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    return [...cards].reverse().filter((c) => {
      const def = getCardDefinition(c.defId);
      const matchesType = filter === 'all' || def.type === filter;
      const matchesQuery = def.name.toLowerCase().includes(query.toLowerCase());
      return matchesType && matchesQuery;
    });
  }, [cards, filter, query]);

  return (
    <div className="card-actions-overlay" onClick={onClose}>
      <div className="zone-modal" onClick={(e) => e.stopPropagation()}>
        <div className="card-actions-header">
          <strong>{title}</strong>
          <button className="close-button" onClick={onClose}>
            {'\u2715'}
          </button>
        </div>

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

        {filtered.length === 0 ? (
          <p className="card-actions-hint">No matching cards.</p>
        ) : (
          <div className="zone-modal-grid">
            {filtered.map((c) => (
              <Card key={c.instanceId} definition={getCardDefinition(c.defId)} instance={{ ...c, tapped: false }} onClick={() => onCardClick(c.instanceId)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}