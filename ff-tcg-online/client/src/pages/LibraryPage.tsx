import React, { useMemo, useState } from 'react';
import { CARD_POOL, getCardDefinition } from '../data/cards';
import { CardType, ManaColor } from '../types';
import { getColourIdentity, ManaLetter } from '../utils/colourIdentity';
import Card from '../components/Card';
import { isTransformBackFace } from '../utils/commander';

const TYPE_FILTERS: (CardType | 'all')[] = ['all', 'creature', 'instant', 'sorcery', 'artifact', 'enchantment', 'land'];
const MANA_FILTERS: { id: ManaColor | 'all' | 'multicolor' | 'colorless'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'W', label: 'W' },
  { id: 'U', label: 'U' },
  { id: 'B', label: 'B' },
  { id: 'R', label: 'R' },
  { id: 'G', label: 'G' },
  { id: 'multicolor', label: 'Multi' },
  { id: 'colorless', label: 'Colourless' },
];

export default function LibraryPage() {
  const [filter, setFilter] = useState<CardType | 'all'>('all');
  const [manaFilter, setManaFilter] = useState<(typeof MANA_FILTERS)[number]['id']>('all');
  const [query, setQuery] = useState('');
  // Which transformable cards are currently showing their back face, keyed
  // by the FRONT face's id (the only id that ever appears as a tile here).
  const [flippedIds, setFlippedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return CARD_POOL.filter((c) => {
      if (isTransformBackFace(c.id)) return false; // shown via the flip icon instead
      const matchesType = filter === 'all' || c.type === filter;
      const matchesQuery = c.name.toLowerCase().includes(query.toLowerCase());
      const colours = getColourIdentity(c);
      const matchesMana =
        manaFilter === 'all' ||
        (manaFilter === 'colorless' && colours.length === 0) ||
        (manaFilter === 'multicolor' && colours.length > 1) ||
        colours.includes(manaFilter as ManaLetter);
      return matchesType && matchesQuery && matchesMana;
    });
  }, [filter, query, manaFilter]);

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
        <div className="library-filters">
          {MANA_FILTERS.map((m) => (
            <button key={m.id} className={`mana-filter-button mana-${m.id} ${manaFilter === m.id ? 'library-filter-active' : ''}`} onClick={() => setManaFilter(m.id)}>
              {m.label}
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