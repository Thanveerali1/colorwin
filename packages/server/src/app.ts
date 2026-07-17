import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { authRouter } from './modules/auth/auth.controller';
import { walletRouter } from './modules/wallet/wallet.controller';
import { transactionsRouter } from './modules/transactions/transactions.controller';
import { roundRouter } from './modules/round/round.controller';
import { leaderboardRouter } from './modules/leaderboard/leaderboard.controller';

export const app = express();

// IMPORTANT: cors + express.json() must be registered BEFORE any router that
// reads req.body -- otherwise req.body comes back undefined with a confusing
// Zod "expected object, received undefined" error.
app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: env.nodeEnv });
});

app.use('/api/auth', authRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/round', roundRouter);
app.use('/api/leaderboard', leaderboardRouter);

export default app;
