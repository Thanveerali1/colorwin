import bcrypt from 'bcrypt';
import { prisma } from '../../lib/prisma';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt';
import type { SignupInput, LoginInput } from './auth.schema';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env';
import crypto from 'crypto';
import { sendOtpEmail } from '../../lib/mailer';

const SALT_ROUNDS = 10;
const SIGNUP_BONUS = 5000; // starting Play Coins

export async function signup(input: SignupInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new Error('EMAIL_TAKEN');
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        wallet: {
          create: { balance: SIGNUP_BONUS },
        },
      },
    });

    await tx.transaction.create({
      data: {
        userId: created.id,
        type: 'DEPOSIT',
        amount: SIGNUP_BONUS,
      },
    });

    return created;
  });

  return issueTokens(user.id);
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !user.passwordHash) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new Error('INVALID_CREDENTIALS');
  }

  return issueTokens(user.id);
}

const googleClient = new OAuth2Client(env.googleClientId);

export async function loginWithGoogle(idToken: string) {
  // Verifies the token's signature and audience directly with Google --
  // never trusts a client-supplied claim of "this is a real Google user."
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.googleClientId,
    });
    payload = ticket.getPayload();
  } catch {
    throw new Error('INVALID_GOOGLE_TOKEN');
  }

  if (!payload?.email || !payload.email_verified) {
    throw new Error('INVALID_GOOGLE_TOKEN');
  }

  let user = await prisma.user.findUnique({ where: { email: payload.email } });

  if (!user) {
    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: payload.name || payload.email!.split('@')[0],
          email: payload.email!,
          wallet: { create: { balance: SIGNUP_BONUS } },
       },
      });
      await tx.transaction.create({
        data: { userId: created.id, type: 'DEPOSIT', amount: SIGNUP_BONUS },
      });
      return created;
    });
  }

  return { ...issueTokens(user.id), name: user.name };
}

export function refreshAccessToken(refreshToken: string) {
  try {
    const payload = verifyRefreshToken(refreshToken);
    return { accessToken: signAccessToken({ userId: payload.userId }) };
  } catch {
    throw new Error('INVALID_REFRESH_TOKEN');
  }
}


const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const MAX_OTP_ATTEMPTS = 5;
const OTP_REQUEST_COOLDOWN_MS = 60 * 1000; // 1 minute between requests

function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  // Always behave the same way whether or not the email exists --
  // prevents attackers from using this endpoint to discover valid accounts.
  if (!user) return;

  // Rate limit: don't allow a new OTP request within the cooldown window
  // of the last one, to prevent spamming a victim's inbox.
  if (
    user.resetOtpExpiresAt &&
    user.resetOtpExpiresAt.getTime() - OTP_EXPIRY_MS + OTP_REQUEST_COOLDOWN_MS > Date.now()
  ) {
    return;
  }

  // Cryptographically random 6-digit code -- NOT Math.random().
  const otp = crypto.randomInt(100000, 999999).toString();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetOtpHash: hashOtp(otp),
      resetOtpExpiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
      resetOtpAttempts: 0,
    },
  });

  await sendOtpEmail(user.email, otp);
}

export async function resetPasswordWithOtp(email: string, otp: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.resetOtpHash || !user.resetOtpExpiresAt) {
    throw new Error('INVALID_OTP');
  }

  if (user.resetOtpExpiresAt.getTime() < Date.now()) {
    throw new Error('OTP_EXPIRED');
  }

  if (user.resetOtpAttempts >= MAX_OTP_ATTEMPTS) {
    throw new Error('TOO_MANY_ATTEMPTS');
  }

  const providedHash = hashOtp(otp);

  if (providedHash !== user.resetOtpHash) {
    // Record the failed attempt so repeated guesses eventually lock out.
    await prisma.user.update({
      where: { id: user.id },
      data: { resetOtpAttempts: { increment: 1 } },
    });
    throw new Error('INVALID_OTP');
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  // Success -- update password AND invalidate the OTP so it can't be reused.
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      resetOtpHash: null,
      resetOtpExpiresAt: null,
      resetOtpAttempts: 0,
    },
  });
}

function issueTokens(userId: string) {
  return {
    accessToken: signAccessToken({ userId }),
    refreshToken: signRefreshToken({ userId }),
  };
}
