// ============================================================================
// db/communityDecks.ts
//
// The published/voted-on deck list behind the client's Decks tab - distinct
// from db/decks.ts (a user's own private deck box). See connection.ts's
// schema comment for why publishing is a snapshot copy rather than a flag on
// the private table.
// ============================================================================

import { randomUUID } from 'crypto';
import { db } from './connection';
import { findUserById, PublicUser, toPublicUser } from './users';
import { CARD_POOL } from '../data/cards';

export const ARCHETYPES = ['aggro', 'midrange', 'control', 'combo', 'tribal', 'ramp', 'voltron', 'other'] as const;
export type Archetype = (typeof ARCHETYPES)[number];

export interface CommunityDeck {
  id: string;
  /** Null for an official/preset deck with no publishing account (see
   * connection.ts) - the client shows publisherName in that case instead. */
  publisher: PublicUser | null;
  publisherName: string | null;
  name: string;
  commanderId: string;
  cardIds: string[];
  archetype: Archetype;
  createdAt: string;
  voteCount: number;
  /** Only meaningful when a viewerId was passed to a list/find call - false
   * (never null/undefined) for a logged-out viewer, same as "you haven't
   * voted" would read either way. */
  hasVoted: boolean;
}

interface CommunityDeckRow {
  id: string;
  user_id: string | null;
  publisher_name: string | null;
  name: string;
  commander_id: string;
  card_ids: string;
  archetype: Archetype;
  created_at: string;
  vote_count: number;
  viewer_voted: number;
}

function rowToDeck(row: CommunityDeckRow): CommunityDeck {
  const publisherUser = row.user_id ? findUserById(row.user_id) : null;
  return {
    id: row.id,
    publisher: publisherUser ? toPublicUser(publisherUser) : null,
    publisherName: publisherUser ? null : row.publisher_name,
    name: row.name,
    commanderId: row.commander_id,
    cardIds: JSON.parse(row.card_ids),
    archetype: row.archetype,
    createdAt: row.created_at,
    voteCount: row.vote_count,
    hasVoted: !!row.viewer_voted,
  };
}

export interface CommunityDeckFilters {
  /** Substring match against the commander's own card id (the client passes
   * a card id here, having already resolved a name search against its own
   * card pool - the server has no card-name index of its own to search). */
  commanderId?: string;
  archetype?: Archetype;
  /** Every letter must appear somewhere in the commander's OWN costLabel -
   * an approximation of full colour identity (which would need the whole
   * card pool's text, not just cost, to compute precisely) that's good
   * enough for a filter bar. See client/src/utils/colourIdentity.ts for the
   * fuller client-side version used during deck building itself. */
  commanderCostContains?: string;
  sort?: 'votes' | 'newest';
  limit?: number;
}

const SELECT_WITH_VOTES = `
  SELECT
    cd.*,
    (SELECT COUNT(*) FROM deck_votes v WHERE v.deck_id = cd.id) AS vote_count,
    (SELECT COUNT(*) FROM deck_votes v WHERE v.deck_id = cd.id AND v.user_id = ?) AS viewer_voted
  FROM community_decks cd
`;

/** `viewerId` is only used to compute hasVoted per row - pass null/undefined
 * for a logged-out viewer (every row's hasVoted then reads false, since no
 * user_id in deck_votes will ever equal an empty string). */
export function listCommunityDecks(filters: CommunityDeckFilters, viewerId?: string | null): CommunityDeck[] {
  const clauses: string[] = [];
  const params: (string | number)[] = [viewerId ?? ''];

  if (filters.commanderId) {
    clauses.push('cd.commander_id = ?');
    params.push(filters.commanderId);
  }
  if (filters.archetype) {
    clauses.push('cd.archetype = ?');
    params.push(filters.archetype);
  }

  let sql = SELECT_WITH_VOTES;
  if (clauses.length > 0) sql += ` WHERE ${clauses.join(' AND ')}`;
  sql += filters.sort === 'newest' ? ' ORDER BY cd.created_at DESC' : ' ORDER BY vote_count DESC, cd.created_at DESC';
  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }

  const rows = db.prepare(sql).all(...params) as unknown as CommunityDeckRow[];
  const decks = rows.map(rowToDeck);
  // Colour filtering isn't a plain column match (it reads the COMMANDER
  // card's own printed cost, which this table doesn't store) - so it's
  // applied here, in JS, against each row's resolved commander rather than
  // folded into the WHERE clause above. Every requested colour letter must
  // appear somewhere in the commander's costLabel; a commander whose id no
  // longer resolves to a real card (shouldn't normally happen) just fails
  // the filter rather than crashing the whole listing.
  if (filters.commanderCostContains) {
    const letters = filters.commanderCostContains.toUpperCase().split('');
    return decks.filter((d) => {
      const commander = CARD_POOL.find((c) => c.id === d.commanderId);
      return !!commander && letters.every((l) => commander.costLabel.toUpperCase().includes(l));
    });
  }
  return decks;
}

export function findCommunityDeck(deckId: string, viewerId?: string | null): CommunityDeck | null {
  const row = db.prepare(`${SELECT_WITH_VOTES} WHERE cd.id = ?`).get(viewerId ?? '', deckId) as unknown as CommunityDeckRow | undefined;
  return row ? rowToDeck(row) : null;
}

export function publishCommunityDeck(
  userId: string,
  deck: { name: string; commanderId: string; cardIds: string[]; archetype: Archetype },
): CommunityDeck {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO community_decks (id, user_id, name, commander_id, card_ids, archetype)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, userId, deck.name, deck.commanderId, JSON.stringify(deck.cardIds), deck.archetype);
  return findCommunityDeck(id, userId)!;
}

/** For seeding official/preset decks with no publishing user - see
 * connection.ts's publisher_name comment. Not exposed over HTTP; only ever
 * called from a one-off seed script. */
export function publishOfficialDeck(deck: { name: string; publisherName: string; commanderId: string; cardIds: string[]; archetype: Archetype }): CommunityDeck {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO community_decks (id, user_id, publisher_name, name, commander_id, card_ids, archetype)
     VALUES (?, NULL, ?, ?, ?, ?, ?)`,
  ).run(id, deck.publisherName, deck.name, deck.commanderId, JSON.stringify(deck.cardIds), deck.archetype);
  return findCommunityDeck(id)!;
}

/** Only the original publisher can remove their own published deck - an
 * official deck (user_id NULL) can never match any real userId here, so it
 * can only ever be removed by editing the database directly, same as it was
 * created. */
export function deleteCommunityDeck(deckId: string, userId: string): boolean {
  const result = db.prepare('DELETE FROM community_decks WHERE id = ? AND user_id = ?').run(deckId, userId);
  return result.changes > 0;
}

/** Idempotent - voting again just leaves the existing row alone (see
 * connection.ts's deck_votes PRIMARY KEY comment), so callers never need to
 * check "did I already vote?" first. */
export function voteForDeck(deckId: string, userId: string): void {
  db.prepare('INSERT OR IGNORE INTO deck_votes (deck_id, user_id) VALUES (?, ?)').run(deckId, userId);
}

export function removeVoteForDeck(deckId: string, userId: string): void {
  db.prepare('DELETE FROM deck_votes WHERE deck_id = ? AND user_id = ?').run(deckId, userId);
}
