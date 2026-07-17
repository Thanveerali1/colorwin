import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../auth/auth.middleware';
import { placeBetSchema } from './round.schema';
import { getActiveRound, getRoundHistory, getMyBetForRound, placeBet, cancelBet } from './round.service';

export const roundRouter = Router();

// Public routes: anyone can see the current round state and past results.
roundRouter.get('/active', async (_req, res) => {
  const round = await getActiveRound();
  res.json(round);
});

roundRouter.get('/history', async (_req, res) => {
  const history = await getRoundHistory(100);
  res.json(history);
});

roundRouter.use(requireAuth);

roundRouter.get('/my-bet', async (req: AuthedRequest, res) => {
  const round = await getActiveRound();
  if (!round) {
    return res.json(null);
  }
  const bet = await getMyBetForRound(req.userId!, round.id);
  res.json(bet);
});

roundRouter.post('/bet', async (req: AuthedRequest, res) => {
  const parsed = placeBetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
  }

  try {
    const bet = await placeBet(req.userId!, parsed.data);
    res.status(201).json(bet);
  } catch (err) {
    if (
      err instanceof Error &&
      ['BETTING_CLOSED', 'INSUFFICIENT_FUNDS', 'BET_ALREADY_PLACED'].includes(err.message)
    ) {
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

roundRouter.delete('/bet/:id', async (req: AuthedRequest, res) => {
  try {
    const result = await cancelBet(req.userId!, req.params.id as string);
    res.json(result);
  } catch (err) {
    if (err instanceof Error && ['BET_NOT_FOUND', 'CANCEL_WINDOW_CLOSED'].includes(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});
