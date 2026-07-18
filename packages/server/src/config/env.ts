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
  // Full app URL including any subpath, used for links inside emails
  // (different from clientUrl, which is only used for CORS and must be a
  // bare origin with no path).
  appUrl: process.env.APP_URL || 'http://127.0.0.1:5173',
  googleClientId: required('GOOGLE_CLIENT_ID'),
  // Resend (HTTP-based email API) -- switched from Gmail SMTP because
  // Render's free tier blocks outbound SMTP ports (465/587/25) entirely,
  // which no amount of timeout/IPv4 tuning could work around. Resend sends
  // over HTTPS (443), which is never blocked.
  resendApiKey: required('RESEND_API_KEY'),
};