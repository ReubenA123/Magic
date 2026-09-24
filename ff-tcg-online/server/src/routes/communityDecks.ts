// ============================================================================
// routes/communityDecks.ts
//
// The public Decks tab: browse/filter/vote is open to anyone (logged out or
// in - see optionalAuth below), publishing/voting/deleting your own require
// an account, same auth pattern as routes/decks.ts and routes/friends.ts.
// ============================================================================

import { Router, Response, NextFunction } from 'express';
import { AuthedRequest, requireAuth, resolveSession } from '../auth/session';
import { getCardDefinition, CARD_POOL } from '../data/cards';
import {
  ARCHETYPES,
  Archetype,
  deleteCommunityDeck,
  listCommunityDecks,
  publishCommunityDeck,
  removeVoteForDeck,
  voteForDeck,
} from '../db/communityDecks';

const router = Router();

// Reading the list/one deck never REQUIRES login, but a logged-in viewer's
// own vote still needs to show as already-cast (see communityDecks.ts's
// hasVoted) - this attaches req.user when a valid token is present without
// rejecting the request when one isn't, unlike requireAuth.
function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  if (token) {
    const user = resolveSession(token);
    if (user) req.user = user;
  }
  next();
}

const DECK_SIZE = 99; // plus the commander = 100, standard Commander deck size
const MAX_DECK_NAME_LENGTH = 60;

function isLegalCommanderId(commanderId: string): boolean {
  const def = CARD_POOL.find((c) => c.id === commanderId);
  return !!def && def.type === 'creature' && !!def.subtype?.toLowerCase().includes('legendary creature');
}

function isValidPublishPayload(body: unknown): body is { name: string; commanderId: string; cardIds: string[]; archetype: Archetype } {
  if (!body || typeof body !== 'object') return false;
  const d = body as Record<string, unknown>;
  return (
    typeof d.name === 'string' &&
    d.name.length > 0 &&
    d.name.length <= MAX_DECK_NAME_LENGTH &&
    typeof d.commanderId === 'string' &&
    Array.isArray(d.cardIds) &&
    d.cardIds.every((c) => typeof c === 'string') &&
    typeof d.archetype === 'string' &&
    (ARCHETYPES as readonly string[]).includes(d.archetype)
  );
}

router.get('/', optionalAuth, (req: AuthedRequest, res) => {
  const { commanderId, archetype, colours, sort, limit } = req.query;
  const decks = listCommunityDecks(
    {
      commanderId: typeof commanderId === 'string' ? commanderId : undefined,
      archetype: typeof archetype === 'string' && (ARCHETYPES as readonly string[]).includes(archetype) ? (archetype as Archetype) : undefined,
      commanderCostContains: typeof colours === 'string' ? colours : undefined,
      sort: sort === 'newest' ? 'newest' : 'votes',
      limit: typeof limit === 'string' ? Math.min(parseInt(limit, 10) || 0, 100) || undefined : undefined,
    },
    req.user?.id,
  );
  res.json({ decks });
});

router.get('/archetypes', (_req, res) => {
  res.json({ archetypes: ARCHETYPES });
});

router.post('/', requireAuth, (req: AuthedRequest, res) => {
  const body = req.body ?? {};
  if (!isValidPublishPayload(body)) {
    return res.status(400).json({ error: 'A published deck needs a name, a commanderId, a cardIds list, and an archetype.' });
  }
  if (body.cardIds.length !== DECK_SIZE) {
    return res.status(400).json({ error: `A deck must be complete - exactly ${DECK_SIZE} cards plus the commander (got ${body.cardIds.length}).` });
  }
  if (!isLegalCommanderId(body.commanderId)) {
    return res.status(400).json({ error: 'The commander must be a legendary creature.' });
  }
  for (const id of [body.commanderId, ...body.cardIds]) {
    try {
      getCardDefinition(id);
    } catch {
      return res.status(400).json({ error: `Unknown card id: ${id}.` });
    }
  }
  const deck = publishCommunityDeck(req.user!.id, body);
  res.json({ deck });
});

router.delete('/:id', requireAuth, (req: AuthedRequest, res) => {
  const removed = deleteCommunityDeck(req.params.id, req.user!.id);
  if (!removed) return res.status(404).json({ error: 'No such published deck of yours.' });
  res.status(204).end();
});

router.post('/:id/vote', requireAuth, (req: AuthedRequest, res) => {
  voteForDeck(req.params.id, req.user!.id);
  res.status(204).end();
});

router.delete('/:id/vote', requireAuth, (req: AuthedRequest, res) => {
  removeVoteForDeck(req.params.id, req.user!.id);
  res.status(204).end();
});

export default router;
