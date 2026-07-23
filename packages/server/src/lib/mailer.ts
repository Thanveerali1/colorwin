import { Resend } from 'resend';
import { env } from '../config/env';

const resend = new Resend(env.resendApiKey);

export async function sendOtpEmail(to: string, otp: string) {
  const { error } = await resend.emails.send({
    from: env.resendFromEmail,
    to,
    subject: 'Your ColorWin password reset code',
    html: `
      <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto;">
        <h2 style="color: #1e293b;">Reset your password</h2>
        <p>Use this code to reset your ColorWin password. It expires in 10 minutes.</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 4px; background: #f1f5f9; padding: 16px; text-align: center; border-radius: 8px;">${otp}</p>
        <p style="color: #64748b; font-size: 13px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });

  // The Resend SDK doesn't throw on API-level failures (invalid key, unverified
  // domain, etc.) -- it returns { error } instead. Throw explicitly so the
  // existing .catch() logging in auth.service.ts actually sees these.
  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}