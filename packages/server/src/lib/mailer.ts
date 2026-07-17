import nodemailer from 'nodemailer';
import { env } from '../config/env';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: env.gmailUser,
    pass: env.gmailAppPassword,
  },
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