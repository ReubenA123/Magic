// ============================================================================
// api/communityDecks.ts
//
// Thin wrappers over the /community-decks endpoints - the public, voted-on
// Decks tab (see server/src/routes/communityDecks.ts). Distinct from
// api/decks.ts, which is a user's own private deck box.
// ============================================================================

import { api } from './rest';
import { Archetype, CommunityDeck } from './accountTypes';

export interface CommunityDeckFilters {
  commanderId?: string;
  archetype?: Archetype;
  /** Colour letters (e.g. "WU") - every one must appear in the commander's
   * own cost, see server/src/db/communityDecks.ts's commanderCostContains. */
  colours?: string;
  sort?: 'votes' | 'newest';
  limit?: number;
}

function toQueryString(filters: CommunityDeckFilters): string {
  const params = new URLSearchParams();
  if (filters.commanderId) params.set('commanderId', filters.commanderId);
  if (filters.archetype) params.set('archetype', filters.archetype);
  if (filters.colours) params.set('colours', filters.colours);
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.limit) params.set('limit', String(filters.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function listCommunityDecks(filters: CommunityDeckFilters = {}): Promise<CommunityDeck[]> {
  const res = await api.get<{ decks: CommunityDeck[] }>(`/community-decks${toQueryString(filters)}`);
  return res.decks;
}

export async function publishCommunityDeck(deck: { name: string; commanderId: string; cardIds: string[]; archetype: Archetype }): Promise<CommunityDeck> {
  const res = await api.post<{ deck: CommunityDeck }>('/community-decks', deck);
  return res.deck;
}

export async function deleteCommunityDeck(id: string): Promise<void> {
  await api.delete(`/community-decks/${encodeURIComponent(id)}`);
}

export async function voteForCommunityDeck(id: string): Promise<void> {
  await api.post(`/community-decks/${encodeURIComponent(id)}/vote`);
}

export async function removeVoteForCommunityDeck(id: string): Promise<void> {
  await api.delete(`/community-decks/${encodeURIComponent(id)}/vote`);
}
