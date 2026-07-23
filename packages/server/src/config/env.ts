import dotenv from 'dotenv';
dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4000,
  databaseUrl: required('DATABASE_URL'),
  redisUrl: required('REDIS_URL'),
  jwtAccessSecret: required('JWT_ACCESS_SECRET'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET'),
  clientUrl: process.env.CLIENT_URL || 'http://127.0.0.1:5173',
  appUrl: process.env.APP_URL || 'http://127.0.0.1:5173',
  googleClientId: required('GOOGLE_CLIENT_ID'),
  // Resend sends over HTTPS, not SMTP -- unaffected by Render (and most
  // other PaaS providers) blocking outbound SMTP ports on free tiers.
  resendApiKey: required('RESEND_API_KEY'),
  // Defaults to Resend's shared sandbox sender, which works with zero setup
  // but has weaker deliverability (may land in spam more often). Once you've
  // verified your own domain in the Resend dashboard, set RESEND_FROM_EMAIL
  // to something like "ColorWin <noreply@yourdomain.com>" instead.
  resendFromEmail: process.env.RESEND_FROM_EMAIL || 'ColorWin <onboarding@resend.dev>',
};