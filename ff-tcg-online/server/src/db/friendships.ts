// ============================================================================
// db/friendships.ts
//
// One row per relationship, requester -> recipient, in 'pending' or
// 'accepted' status - see connection.ts's schema comment for why declining
// or unfriending just deletes the row instead of recording a third status.
// ============================================================================

import { randomUUID } from 'crypto';
import { db } from './connection';
import { findUserById, PublicUser, toPublicUser } from './users';

/** One relationship row from the viewer's side, whatever its status - the
 * `id` here is always the friendships row itself (not either user's id),
 * since that's what removeFriendship/acceptFriendRequest need to target
 * (see routes/friends.ts's unfriend/decline/cancel, which are all "delete
 * this row" regardless of which of the three this came from). */
export interface FriendshipEntry {
  id: string;
  otherUser: PublicUser;
  createdAt: string;
}

interface FriendshipRow {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: 'pending' | 'accepted';
  created_at: string;
  responded_at: string | null;
}

export type SendRequestResult = { ok: true; requestId: string } | { ok: false; error: string };

export function sendFriendRequest(requesterId: string, recipientId: string): SendRequestResult {
  if (requesterId === recipientId) return { ok: false, error: "You can't friend yourself." };
  if (!findUserById(recipientId)) return { ok: false, error: 'No such user.' };

  // A relationship can exist as either (A requests B) or (B requests A) -
  // check both directions so B can't "re-request" A and end up with two
  // rows for what's really one relationship.
  const existing = db
    .prepare(
      `SELECT * FROM friendships
       WHERE (requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?)`,
    )
    .get(requesterId, recipientId, recipientId, requesterId) as unknown as FriendshipRow | undefined;

  if (existing?.status === 'accepted') return { ok: false, error: 'You are already friends.' };
  if (existing?.status === 'pending') return { ok: false, error: 'A friend request is already pending between you two.' };

  const id = randomUUID();
  db.prepare('INSERT INTO friendships (id, requester_id, recipient_id, status) VALUES (?, ?, ?, ?)').run(id, requesterId, recipientId, 'pending');
  return { ok: true, requestId: id };
}

/** Only the recipient can accept - returns false for "no such pending
 * request addressed to you" (already handled, wrong user, or never existed). */
export function acceptFriendRequest(requestId: string, recipientId: string): boolean {
  const result = db
    .prepare(`UPDATE friendships SET status = 'accepted', responded_at = datetime('now') WHERE id = ? AND recipient_id = ? AND status = 'pending'`)
    .run(requestId, recipientId);
  return result.changes > 0;
}

/** Covers three end-of-relationship cases with one query: the recipient
 * declining a pending request, the requester cancelling their own pending
 * request, or either side unfriending an already-accepted relationship -
 * all of them just mean "this row shouldn't exist anymore". */
export function removeFriendship(friendshipId: string, actingUserId: string): boolean {
  const result = db.prepare('DELETE FROM friendships WHERE id = ? AND (requester_id = ? OR recipient_id = ?)').run(friendshipId, actingUserId, actingUserId);
  return result.changes > 0;
}

function otherPartyId(row: FriendshipRow, viewerId: string): string {
  return row.requester_id === viewerId ? row.recipient_id : row.requester_id;
}

export function listFriends(userId: string): FriendshipEntry[] {
  const rows = db
    .prepare(`SELECT * FROM friendships WHERE (requester_id = ? OR recipient_id = ?) AND status = 'accepted'`)
    .all(userId, userId) as unknown as FriendshipRow[];
  const friends: FriendshipEntry[] = [];
  for (const row of rows) {
    const other = findUserById(otherPartyId(row, userId));
    if (other) friends.push({ id: row.id, otherUser: toPublicUser(other), createdAt: row.created_at });
  }
  return friends;
}

export function listIncomingRequests(userId: string): FriendshipEntry[] {
  const rows = db.prepare(`SELECT * FROM friendships WHERE recipient_id = ? AND status = 'pending'`).all(userId) as unknown as FriendshipRow[];
  return rows.map((row) => ({ id: row.id, otherUser: toPublicUser(findUserById(row.requester_id)!), createdAt: row.created_at }));
}

export function listOutgoingRequests(userId: string): FriendshipEntry[] {
  const rows = db.prepare(`SELECT * FROM friendships WHERE requester_id = ? AND status = 'pending'`).all(userId) as unknown as FriendshipRow[];
  return rows.map((row) => ({ id: row.id, otherUser: toPublicUser(findUserById(row.recipient_id)!), createdAt: row.created_at }));
}
