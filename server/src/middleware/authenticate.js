import { verifyToken } from '../auth.js';
import { readSessionToken } from './sessionCookie.js';

const PUBLIC_API_PREFIXES = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/mfa/verify',
  '/api/auth/mfa/enrollment/',
  '/api/health',
  '/api/auth/demo-users',
];

/** @param {import('express').Express} app */
export function applyAuthenticateMiddleware(app) {
  app.use((req, res, next) => {
    if (PUBLIC_API_PREFIXES.some((p) => req.path.startsWith(p))) {
      return next();
    }
    if (!req.path.startsWith('/api/')) return next();

    const token = readSessionToken(req);
    const user = verifyToken(token);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    req.user = user;
    next();
  });
}
