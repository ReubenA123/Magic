// ============================================================================
// routes/decks.ts
//
// Account-scoped deck storage - every route requires auth and only ever
// touches req.user's own decks. Mirrors deckStorage.ts's load/save/delete
// shape closely enough that the client swap is mostly a drop-in.
// ============================================================================

import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../auth/session';
import { deleteDeck, listDecks, markDeckPlayed, SavedDeck, upsertDeck } from '../db/decks';

const router = Router();
router.use(requireAuth);

const MAX_DECK_NAME_LENGTH = 60;

function isValidDeckPayload(body: unknown): body is SavedDeck {
  if (!body || typeof body !== 'object') return false;
  const d = body as Record<string, unknown>;
  return (
    typeof d.id === 'string' &&
    d.id.length > 0 &&
    typeof d.name === 'string' &&
    d.name.length > 0 &&
    d.name.length <= MAX_DECK_NAME_LENGTH &&
    typeof d.commanderId === 'string' &&
    Array.isArray(d.cardIds) &&
    d.cardIds.every((c) => typeof c === 'string')
  );
}

router.get('/', (req: AuthedRequest, res) => {
  res.json({ decks: listDecks(req.user!.id) });
});

router.put('/:id', (req: AuthedRequest, res) => {
  const body = { ...(req.body ?? {}), id: req.params.id };
  if (!isValidDeckPayload(body)) {
    return res.status(400).json({ error: 'A deck needs an id, a name, a commanderId, and a cardIds list.' });
  }
  res.json({ deck: upsertDeck(req.user!.id, body) });
});

router.delete('/:id', (req: AuthedRequest, res) => {
  const removed = deleteDeck(req.user!.id, req.params.id);
  if (!removed) return res.status(404).json({ error: 'No such deck.' });
  res.status(204).end();
});

// Called whenever a game actually starts with this deck (see VsAiPage) -
// just the one timestamp, not real match history (see markDeckPlayed).
router.post('/:id/played', (req: AuthedRequest, res) => {
  const marked = markDeckPlayed(req.user!.id, req.params.id);
  if (!marked) return res.status(404).json({ error: 'No such deck.' });
  res.status(204).end();
});

export default router;
