/** @typedef {'chairman' | 'lead' | 'analyst' | 'viewer'} Role */

import crypto from 'crypto';

const USERS = [
  { username: 'chairman', password: 'demo', role: 'chairman', displayName: 'Chairman / Principal' },
  { username: 'lead', password: 'demo', role: 'lead', displayName: 'Family Office Lead' },
  { username: 'analyst', password: 'demo', role: 'analyst', displayName: 'Analyst' },
  { username: 'viewer', password: 'demo', role: 'viewer', displayName: 'Viewer' }
];

const JWT_SECRET = typeof process.env.JWT_SECRET === 'string' ? process.env.JWT_SECRET.trim() : '';

/** @type {Map<string, {username: string, role: Role, displayName: string, exp: number}>} */
const sessions = new Map();

function b64encode(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
}

function b64decode(token) {
  try {
    return JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function signJwtPayload(payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyJwtToken(token) {
  if (!JWT_SECRET || !token.includes('.')) return null;
  const dot = token.lastIndexOf('.');
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expect = crypto.createHmac('sha256', JWT_SECRET).update(body).digest('base64url');
  if (sig.length !== expect.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  } catch {
    return null;
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!payload || !payload.exp || payload.exp < Date.now()) return null;
  if (!payload.username || !payload.role) return null;
  return payload;
}

export function login(username, password) {
  const u = USERS.find((x) => x.username === username && x.password === password);
  if (!u) return null;
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = { username: u.username, role: u.role, displayName: u.displayName, exp };
  if (JWT_SECRET) {
    const token = signJwtPayload(payload);
    return { token, user: { username: u.username, role: u.role, displayName: u.displayName } };
  }
  const token = b64encode(payload);
  sessions.set(token, payload);
  return { token, user: { username: u.username, role: u.role, displayName: u.displayName } };
}

export function verifyToken(token) {
  if (!token) return null;
  if (JWT_SECRET) {
    const jwtUser = verifyJwtToken(token);
    if (jwtUser) return jwtUser;
  }
  const cached = sessions.get(token);
  if (cached && cached.exp > Date.now()) return cached;
  const decoded = b64decode(token);
  if (!decoded || !decoded.exp || decoded.exp < Date.now()) return null;
  return decoded;
}

/** Minimum role rank for route (higher = more access). viewer=1 analyst=2 lead=3 chairman=3 read */
const rank = { viewer: 1, analyst: 2, lead: 3, chairman: 3 };

export function requireAuth(minRole = 'viewer') {
  return (req, res, next) => {
    const h = req.headers.authorization || '';
    const tok = h.startsWith('Bearer ') ? h.slice(7) : null;
    const user = verifyToken(tok);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    req.user = user;
    if (rank[user.role] < rank[minRole]) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

export function listMockUsers() {
  return USERS.map((u) => ({ username: u.username, role: u.role, displayName: u.displayName }));
}
