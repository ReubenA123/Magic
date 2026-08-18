import React, { useMemo, useState } from 'react';
import { CARD_POOL, getCardDefinition } from '../data/cards';
import { CardType } from '../types';
import Card from '../components/Card';
import { isTransformBackFace } from '../utils/commander';

const TYPE_FILTERS: (CardType | 'all')[] = ['all', 'creature', 'instant', 'sorcery', 'artifact', 'enchantment', 'land'];

export default function LibraryPage() {
  const [filter, setFilter] = useState<CardType | 'all'>('all');
  const [query, setQuery] = useState('');
  // Which transformable cards are currently showing their back face, keyed
  // by the FRONT face's id (the only id that ever appears as a tile here).
  const [flippedIds, setFlippedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return CARD_POOL.filter((c) => {
      if (isTransformBackFace(c.id)) return false; // shown via the flip icon instead
      const matchesType = filter === 'all' || c.type === filter;
      const matchesQuery = c.name.toLowerCase().includes(query.toLowerCase());
      return matchesType && matchesQuery;
    });
  }, [filter, query]);

  function toggleFlip(id: string) {
    setFlippedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
        {filtered.map((def) => {
          const isFlippable = !!def.transformsInto;
          const shownDef = isFlippable && flippedIds.has(def.id) ? getCardDefinition(def.transformsInto!) : def;
          return (
            <div key={def.id} className="library-card-wrapper">
              <Card definition={shownDef} />
              {isFlippable && (
                <button className="flip-icon-button" onClick={() => toggleFlip(def.id)} title="Flip / show transformed side">
                  {'\u21bb'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}