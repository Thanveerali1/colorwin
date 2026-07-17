import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../auth/auth.middleware';
import { getTransactionHistory } from './transactions.service';

export const transactionsRouter = Router();

transactionsRouter.use(requireAuth);

transactionsRouter.get('/', async (req: AuthedRequest, res) => {
  const filterParam = (req.query.filter as string) || 'all';
  const allowed = ['all', 'bets', 'deposits', 'withdrawals'];

  if (!allowed.includes(filterParam)) {
    return res.status(400).json({ error: 'INVALID_FILTER' });
  }

  const history = await getTransactionHistory(req.userId!, filterParam as any);
  res.json(history);
});
