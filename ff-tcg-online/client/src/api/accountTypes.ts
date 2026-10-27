// ============================================================================
// api/accountTypes.ts
//
// Mirrors the shapes the server's auth/decks/friends routes actually return
// (see server/src/db/users.ts, db/decks.ts, db/friendships.ts) - kept as
// plain interfaces here rather than importing from the server package,
// since the client and server are separate deployable apps.
// ============================================================================

export interface AccountAvatar {
  cardId: string;
  x: number;
  y: number;
  zoom: number;
}

export interface Account {
  id: string;
  username: string;
  friendCode: string;
  avatar: AccountAvatar | null;
}

export interface SavedDeck {
  id: string;
  name: string;
  commanderId: string;
  cardIds: string[];
  createdAt: string;
  updatedAt: string;
  /** Null until the deck has actually started a game at least once - just
   * this one timestamp, not real match history (see server/src/db/decks.ts). */
  lastPlayedAt: string | null;
  favourite?: boolean;
  cardBackId?: string | null;
}

/** One relationship row from the viewer's side, whatever its status -
 * `id` is always the friendship row itself, not either user's id (see
 * server/src/db/friendships.ts's FriendshipEntry) - that's what the
 * accept/decline/cancel/unfriend endpoints all key on. Used for the
 * friends list too, not just pending requests, since the shape is identical. */
export interface FriendshipEntry {
  id: string;
  otherUser: Account;
  createdAt: string;
}

/** Mirrors server/src/db/communityDecks.ts's ARCHETYPES - the "kind of deck"
 * tag a publisher picks, and what the Decks tab's "type" filter matches
 * against. */
export const ARCHETYPES = ['aggro', 'midrange', 'control', 'combo', 'tribal', 'ramp', 'voltron', 'other'] as const;
export type Archetype = (typeof ARCHETYPES)[number];

export const ARCHETYPE_LABELS: Record<Archetype, string> = {
  aggro: 'Aggro',
  midrange: 'Midrange',
  control: 'Control',
  combo: 'Combo',
  tribal: 'Tribal',
  ramp: 'Ramp',
  voltron: 'Voltron',
  other: 'Other',
};

/** A published, voted-on deck from the community Decks tab - see
 * server/src/db/communityDecks.ts's CommunityDeck for the full rationale
 * (a snapshot copy of a private SavedDeck, not a live link to one). */
export interface CommunityDeck {
  id: string;
  /** Null for an official/preset deck with no publishing account - show
   * publisherName instead in that case. */
  publisher: Account | null;
  publisherName: string | null;
  name: string;
  commanderId: string;
  cardIds: string[];
  archetype: Archetype;
  createdAt: string;
  voteCount: number;
  hasVoted: boolean;
}
