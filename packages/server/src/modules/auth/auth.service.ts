import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt';
import type { SignupInput, LoginInput } from './auth.schema';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env';
import { sendOtpEmail } from '../../lib/mailer';

const SALT_ROUNDS = 10;
const SIGNUP_BONUS = 5000; // starting Play Coins

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

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

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const MAX_OTP_ATTEMPTS = 5;
const OTP_REQUEST_COOLDOWN_MS = 60 * 1000; // 1 minute between requests

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  // Always behave the same way whether or not the email exists --
  // prevents attackers from using this endpoint to discover valid accounts.
  if (!user) return;

  if (
    user.resetOtpExpiresAt &&
    user.resetOtpExpiresAt.getTime() - OTP_EXPIRY_MS + OTP_REQUEST_COOLDOWN_MS > Date.now()
  ) {
    return;
  }

  const otp = crypto.randomInt(100000, 999999).toString();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetOtpHash: sha256(otp),
      resetOtpExpiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
      resetOtpAttempts: 0,
    },
  });

  // Fire-and-forget -- never block the response on the mail send.
  sendOtpEmail(user.email, otp).catch((err) => {
    console.error('Failed to send OTP email:', err);
  });
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

  const providedHash = sha256(otp);

  if (providedHash !== user.resetOtpHash) {
    await prisma.user.update({
      where: { id: user.id },
      data: { resetOtpAttempts: { increment: 1 } },
    });
    throw new Error('INVALID_OTP');
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

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

export function refreshAccessToken(refreshToken: string) {
  try {
    const payload = verifyRefreshToken(refreshToken);
    return { accessToken: signAccessToken({ userId: payload.userId }) };
  } catch {
    throw new Error('INVALID_REFRESH_TOKEN');
  }
}

function issueTokens(userId: string) {
  return {
    accessToken: signAccessToken({ userId }),
    refreshToken: signRefreshToken({ userId }),
  };
}