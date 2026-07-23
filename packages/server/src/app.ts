import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { authRouter } from './modules/auth/auth.controller';
import { walletRouter } from './modules/wallet/wallet.controller';
import { transactionsRouter } from './modules/transactions/transactions.controller';
import { roundRouter } from './modules/round/round.controller';
import { leaderboardRouter } from './modules/leaderboard/leaderboard.controller';
import { userRouter } from './modules/user/user.controller';

export const app = express();

// Required for express-rate-limit (and req.ip generally) to read the real
// client IP from X-Forwarded-For, since Render/most PaaS sit behind a proxy.
// Without this, rate limits would apply to all traffic as a single "IP".
app.set('trust proxy', 1);

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
app.use('/api/user', userRouter);

export default app;