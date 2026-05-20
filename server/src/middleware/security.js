import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

function parseCorsOrigins() {
  const raw = typeof process.env.FAMILY_OFFICE_CORS_ORIGINS === 'string' ? process.env.FAMILY_OFFICE_CORS_ORIGINS : '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** @param {import('express').Express} app */
export function applySecurityMiddleware(app) {
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  const allowed = parseCorsOrigins();
  const isProd = process.env.NODE_ENV === 'production';

  if (allowed.length > 0) {
    app.use(
      cors({
        origin(origin, callback) {
          if (!origin || allowed.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error('CORS not allowed'));
          }
        },
        credentials: true,
      })
    );
  } else if (isProd) {
    app.use(
      cors({
        origin: false,
        credentials: true,
      })
    );
  } else {
    app.use(cors({ origin: true, credentials: true }));
  }

  const loginMax = isProd ? 10 : 40;
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: loginMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Try again in 15 minutes.' },
    skipSuccessfulRequests: true,
  });

  app.use('/api/auth/login', loginLimiter);
  app.use('/api/auth/mfa/verify', loginLimiter);
  app.use('/api/auth/mfa/enrollment/enable', loginLimiter);
}
