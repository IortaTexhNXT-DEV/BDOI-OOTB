import 'dotenv/config';

const env = (name, fallback) => {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
};

export const config = Object.freeze({
  port: Number(env('PORT', 8000)),
  nodeEnv: env('NODE_ENV', 'development'),
  databaseUrl: env('DATABASE_URL', 'postgres://brokerverse:brokerverse@127.0.0.1:5432/brokerverse'),
  jwtSecret: env('JWT_SECRET', 'dev-only-secret-change-me'),
  accessTtl: Number(env('JWT_ACCESS_TTL_SECONDS', 86400)),
  refreshTtl: Number(env('JWT_REFRESH_TTL_SECONDS', 2592000)),
  corsOrigins: env('CORS_ORIGINS', '*').split(',').map((s) => s.trim()).filter(Boolean),
  uploadDir: env('UPLOAD_DIR', './uploads'),
  publicBaseUrl: env('PUBLIC_BASE_URL', 'http://localhost:8000'),
  smtpUrl: env('SMTP_URL', ''),
  logLevel: env('LOG_LEVEL', 'info'),
});
