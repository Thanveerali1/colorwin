import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../auth/auth.middleware';
import { depositSchema, withdrawSchema } from './wallet.schema';
import { getWallet, deposit, withdraw } from './wallet.service';

export const walletRouter = Router();

walletRouter.use(requireAuth);

walletRouter.get('/me', async (req: AuthedRequest, res) => {
  try {
    const wallet = await getWallet(req.userId!);
    res.json(wallet);
  } catch (err) {
    if (err instanceof Error && err.message === 'WALLET_NOT_FOUND') {
      // Most commonly caused by a stale token from before a local DB reset,
      // or a deleted account. Never let this crash the process.
      return res.status(404).json({ error: 'WALLET_NOT_FOUND' });
    }
    console.error(err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

walletRouter.post('/deposit', async (req: AuthedRequest, res) => {
  const parsed = depositSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
  }

  try {
    const wallet = await deposit(req.userId!, parsed.data.amount);
    res.json(wallet);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

walletRouter.post('/withdraw', async (req: AuthedRequest, res) => {
  const parsed = withdrawSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
  }

  try {
    const wallet = await withdraw(req.userId!, parsed.data.amount);
    res.json(wallet);
  } catch (err) {
    if (err instanceof Error && err.message === 'INSUFFICIENT_FUNDS') {
      return res.status(400).json({ error: 'INSUFFICIENT_FUNDS' });
    }
    console.error(err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});