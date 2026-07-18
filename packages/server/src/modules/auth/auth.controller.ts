import { Router } from 'express';
import { signupSchema, loginSchema, requestResetSchema, resetPasswordSchema } from './auth.schema';
import {
  signup,
  login,
  refreshAccessToken,
  loginWithGoogle,
  requestPasswordReset,
  resetPasswordWithOtp,
} from './auth.service';
import {
  loginLimiter,
  signupLimiter,
  passwordResetRequestLimiter,
  passwordResetVerifyLimiter,
  googleLoginLimiter,
} from '../../lib/rateLimit';

export const authRouter = Router();

authRouter.post('/signup', signupLimiter, async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
  }

  try {
    const tokens = await signup(parsed.data);
    return res.status(201).json(tokens);
  } catch (err) {
    if (err instanceof Error && err.message === 'EMAIL_TAKEN') {
      return res.status(409).json({ error: 'EMAIL_TAKEN' });
    }
    console.error(err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

authRouter.post('/login', loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
  }

  try {
    const tokens = await login(parsed.data);
    return res.json(tokens);
  } catch (err) {
    if (err instanceof Error && err.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    }
    console.error(err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

authRouter.post('/google', googleLoginLimiter, async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) {
    return res.status(400).json({ error: 'MISSING_ID_TOKEN' });
  }
  try {
    const result = await loginWithGoogle(idToken);
    res.json(result);
  } catch {
    res.status(401).json({ error: 'INVALID_GOOGLE_TOKEN' });
  }
});

authRouter.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'MISSING_REFRESH_TOKEN' });
  }
  try {
    const result = refreshAccessToken(refreshToken);
    res.json(result);
  } catch {
    res.status(401).json({ error: 'INVALID_REFRESH_TOKEN' });
  }
});

authRouter.post('/request-reset', passwordResetRequestLimiter, async (req, res) => {
  const parsed = requestResetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'VALIDATION_ERROR' });
  }

  await requestPasswordReset(parsed.data.email);

  res.json({ message: 'If that email exists, a code has been sent.' });
});

authRouter.post('/reset-password', passwordResetVerifyLimiter, async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
  }

  try {
    await resetPasswordWithOtp(parsed.data.email, parsed.data.otp, parsed.data.newPassword);
    res.json({ message: 'Password reset successfully.' });
  } catch (err) {
    if (err instanceof Error && ['INVALID_OTP', 'OTP_EXPIRED', 'TOO_MANY_ATTEMPTS'].includes(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});