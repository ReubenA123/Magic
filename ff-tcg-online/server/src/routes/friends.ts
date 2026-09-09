// ============================================================================
// routes/friends.ts
//
// Search + the full request/accept/decline/unfriend flow. Every route
// requires auth; "acting as req.user" is implicit throughout rather than
// ever trusting a user id from the request body.
// ============================================================================

import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../auth/session';
import { acceptFriendRequest, listFriends, listIncomingRequests, listOutgoingRequests, removeFriendship, sendFriendRequest } from '../db/friendships';
import { searchUsers } from '../db/users';

const router = Router();
router.use(requireAuth);

router.get('/', (req: AuthedRequest, res) => {
  res.json({ friends: listFriends(req.user!.id) });
});

router.get('/requests', (req: AuthedRequest, res) => {
  res.json({
    incoming: listIncomingRequests(req.user!.id),
    outgoing: listOutgoingRequests(req.user!.id),
  });
});

router.get('/search', (req: AuthedRequest, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q : '';
  res.json({ users: searchUsers(query, req.user!.id) });
});

router.post('/requests', (req: AuthedRequest, res) => {
  const { userId } = req.body ?? {};
  if (typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId is required.' });
  }
  const result = sendFriendRequest(req.user!.id, userId);
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.status(201).json({ requestId: result.requestId });
});

router.post('/requests/:id/accept', (req: AuthedRequest, res) => {
  const accepted = acceptFriendRequest(req.params.id, req.user!.id);
  if (!accepted) return res.status(404).json({ error: 'No such pending request.' });
  res.status(204).end();
});

// Covers declining an incoming request, cancelling one you sent, and
// unfriending an already-accepted relationship - removeFriendship only
// requires that req.user is a party to the row, not which side or status.
router.delete('/requests/:id', (req: AuthedRequest, res) => {
  const removed = removeFriendship(req.params.id, req.user!.id);
  if (!removed) return res.status(404).json({ error: 'No such request or friendship.' });
  res.status(204).end();
});

export default router;
