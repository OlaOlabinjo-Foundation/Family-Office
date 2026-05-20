import { Router } from 'express';
import {
  login,
  completeMfaLogin,
  completeEnrollmentLogin,
  getCredentialStore,
  listMockUsers,
} from '../auth.js';
import {
  beginMfaSetup,
  buildOtpAuthQrUrl,
  peekEnrollmentToken,
} from '../mfa.js';
import { setSessionCookie, clearSessionCookie } from '../middleware/sessionCookie.js';

/**
 * @param {{ db: import('better-sqlite3').Database, logAudit: Function }} deps
 */
export function createAuthRouter({ db, logAudit }) {
  const router = Router();

  function finishAuth(res, session) {
    if (session.token) setSessionCookie(res, session.token);
    res.json(session);
  }

  router.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body || {};
    const session = login(username, password);
    if (!session) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (session.mfaRequired || session.enrollmentRequired) {
      return res.json(session);
    }
    finishAuth(res, session);
  });

  router.post('/api/auth/logout', (_req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  router.post('/api/auth/mfa/enrollment/setup', (req, res) => {
    const enrollmentToken = typeof req.body?.enrollmentToken === 'string' ? req.body.enrollmentToken : '';
    const pending = peekEnrollmentToken(enrollmentToken);
    if (!pending) return res.status(401).json({ error: 'Enrollment session expired. Sign in again.' });
    const result = beginMfaSetup(pending.username);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({
      secret: result.secret,
      otpauthUrl: result.otpauthUrl,
      qrUrl: buildOtpAuthQrUrl(result.otpauthUrl),
      issuer: result.issuer,
      accountName: result.accountName,
    });
  });

  router.post('/api/auth/mfa/enrollment/enable', (req, res) => {
    const enrollmentToken = typeof req.body?.enrollmentToken === 'string' ? req.body.enrollmentToken : '';
    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    const outcome = completeEnrollmentLogin(enrollmentToken, code);
    if (!outcome) {
      return res.status(401).json({ error: 'Enrollment session expired. Sign in again.' });
    }
    if (!outcome.ok) {
      return res.status(400).json({ error: outcome.error });
    }
    logAudit(db, {
      actor: outcome.user.username,
      action: 'auth.mfa_enabled',
      entityType: 'user',
      entityId: outcome.user.username,
      meta: { enrollment: true },
    });
    setSessionCookie(res, outcome.token);
    res.json({
      token: outcome.token,
      user: outcome.user,
      recoveryCodes: outcome.recoveryCodes,
    });
  });

  router.post('/api/auth/mfa/verify', (req, res) => {
    const mfaToken = typeof req.body?.mfaToken === 'string' ? req.body.mfaToken : '';
    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    const session = completeMfaLogin(mfaToken, code);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired authenticator code.' });
    }
    logAudit(db, {
      actor: session.user.username,
      action: 'auth.mfa_login',
      entityType: 'user',
      entityId: session.user.username,
      meta: {},
    });
    finishAuth(res, session);
  });

  router.get('/api/auth/demo-users', (_req, res) => {
    const credentialStore = getCredentialStore();
    if (credentialStore === 'demo') {
      return res.json({
        credentialStore,
        message: 'Mock authentication — use these in development only.',
        users: [
          { username: 'chairman', password: 'demo', role: 'chairman', displayName: 'Chairman / Principal' },
          { username: 'lead', password: 'demo', role: 'lead', displayName: 'Family Office Lead' },
          { username: 'analyst', password: 'demo', role: 'analyst', displayName: 'Analyst' },
          { username: 'viewer', password: 'demo', role: 'viewer', displayName: 'Viewer' },
        ],
      });
    }
    const users = listMockUsers().map((u) => ({
      username: u.username,
      role: u.role,
      displayName: u.displayName,
    }));
    return res.json({
      credentialStore,
      message:
        credentialStore === 'sqlite'
          ? 'SQLite account store — passwords are not returned. Use Account settings after sign-in to change your password.'
          : 'Configured authentication — use the passwords issued by your administrator.',
      users,
    });
  });

  return router;
}
