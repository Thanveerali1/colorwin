import nodemailer from 'nodemailer';
import { env } from '../config/env';

// Using explicit host/port/secure instead of the 'service: gmail' shorthand,
// and forcing IPv4 (family: 4). Some cloud hosts (Render included) have
// unreliable IPv6 routing to Gmail's SMTP servers, which manifests as
// ETIMEDOUT/ENETUNREACH errors that are otherwise intermittent and hard to
// reproduce locally.
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: env.gmailUser,
    pass: env.gmailAppPassword,
  },
  family: 4,
  connectionTimeout: 15_000,
  greetingTimeout: 15_000,
  socketTimeout: 15_000,
});

export async function sendOtpEmail(to: string, otp: string) {
  await transporter.sendMail({
    from: `"ColorWin" <${env.gmailUser}>`,
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
}

export async function sendVerificationEmail(to: string, token: string) {
  const link = `${env.appUrl}/#/verify-email?token=${token}`;

  await transporter.sendMail({
    from: `"ColorWin" <${env.gmailUser}>`,
    to,
    subject: 'Verify your ColorWin email',
    html: `
      <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto;">
        <h2 style="color: #1e293b;">Verify your email</h2>
        <p>Thanks for signing up for ColorWin. Click below to verify your email address. This link expires in 24 hours.</p>
        <p style="text-align: center; margin: 24px 0;">
          <a href="${link}" style="background: #fbbf24; color: #1e293b; font-weight: bold; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">
            Verify email
          </a>
        </p>
        <p style="color: #64748b; font-size: 13px;">If you didn't create this account, you can safely ignore this email.</p>
      </div>
    `,
  });
}