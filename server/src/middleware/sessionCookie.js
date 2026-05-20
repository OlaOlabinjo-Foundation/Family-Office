export const SESSION_COOKIE_NAME = 'ooi_session';

export function sessionCookieEnabled() {
  return process.env.FAMILY_OFFICE_SESSION_COOKIE === '1';
}

/**
 * @param {import('express').Response} res
 * @param {string} token
 */
export function setSessionCookie(res, token) {
  if (!sessionCookieEnabled()) return;
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

/** @param {import('express').Response} res */
export function clearSessionCookie(res) {
  if (!sessionCookieEnabled()) return;
  res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
}

/**
 * @param {import('express').Request} req
 * @returns {string | null}
 */
export function readSessionToken(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  const fromCookie = req.cookies?.[SESSION_COOKIE_NAME];
  return typeof fromCookie === 'string' && fromCookie.length ? fromCookie : null;
}
