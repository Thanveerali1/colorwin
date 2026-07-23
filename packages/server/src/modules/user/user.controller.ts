import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../auth/auth.middleware';
import { updateProfileSchema } from './user.schema';
import { getProfile, updateProfile } from './user.service';
import { profileUpdateLimiter } from '../../lib/rateLimit';

export const userRouter = Router();

userRouter.use(requireAuth);

userRouter.get('/me', async (req: AuthedRequest, res) => {
  try {
    const profile = await getProfile(req.userId!);
    res.json(profile);
  } catch (err) {
    if (err instanceof Error && err.message === 'USER_NOT_FOUND') {
      // Same stale-token scenario as GET /wallet/me -- the client already
      // knows how to handle this by forcing a fresh login.
      return res.status(404).json({ error: 'USER_NOT_FOUND' });
    }
    console.error(err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

userRouter.patch('/me', profileUpdateLimiter, async (req: AuthedRequest, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
  }

  try {
    const profile = await updateProfile(req.userId!, parsed.data);
    res.json(profile);
  } catch (err) {
    if (err instanceof Error && err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: 'USER_NOT_FOUND' });
    }
    if (err instanceof Error && err.message === 'PROFILE_LOCKED') {
      return res.status(403).json({ error: 'PROFILE_LOCKED' });
    }
    console.error(err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});