import { Router } from 'express';
import { getTopWinners } from './leaderboard.service';

export const leaderboardRouter = Router();

leaderboardRouter.get('/', async (_req, res) => {
  const data = await getTopWinners(100);
  res.json(data);
});
