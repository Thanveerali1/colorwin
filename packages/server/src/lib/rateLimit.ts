import rateLimit from 'express-rate-limit';

// Shared error shape so the frontend can handle all rate-limit responses the same way.
function limitHandler(req: any, res: any) {
  res.status(429).json({ error: 'TOO_MANY_REQUESTS' });
}

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 8, // 8 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitHandler,
});

export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitHandler,
});

export const passwordResetRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitHandler,
});

export const passwordResetVerifyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15, // a bit looser -- this covers genuine typo retries, the OTP's own
  // per-account 5-attempt cap (see auth.service.ts) is the real brute-force wall
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitHandler,
});

export const emailVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitHandler,
});

export const googleLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // looser -- Google's own token verification is already the real gate here
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitHandler,
});