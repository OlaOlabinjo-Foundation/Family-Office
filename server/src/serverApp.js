import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { migrate, db } from './db.js';
import { MASTER_XLSX_PATH } from './config.js';
import { login, verifyToken } from './auth.js';
import { previewImport } from './importExcel.js';
import { importBuffer, logImport } from './importService.js';
import { computeDashboard, getRiskHeatmap } from './intelligence.js';
import { recordPortfolioSnapshot } from './snapshots.js';
import { logAudit } from './audit.js';
import { globalSearch } from './search.js';
import { getTreasuryOverview, getTreasuryExportFlatRows } from './treasury.js';
import { rowsToCsv } from './exportCsv.js';
import { backupDatabaseBeforeImport } from './dbBackup.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readWorkspaceVersion() {
  try {
    const rootPkg = path.join(__dirname, '../../package.json');
    const j = JSON.parse(fs.readFileSync(rootPkg, 'utf8'));
    return typeof j.version === 'string' ? j.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const WORKSPACE_VERSION = readWorkspaceVersion();

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

migrate();

function tryBootstrapFromMasterWorkbook() {
  if (process.env.SKIP_WORKBOOK_BOOTSTRAP === '1') return;
  try {
    const row = db.prepare('SELECT COUNT(*) as c FROM master_assets').get();
    if (row.c > 0) return;
    if (!fs.existsSync(MASTER_XLSX_PATH)) {
      console.warn('[bootstrap] Master workbook not found at', MASTER_XLSX_PATH);
      return;
    }
    const buf = fs.readFileSync(MASTER_XLSX_PATH);
    const { summary } = importBuffer(buf, { replace: true });
    logImport(path.basename(MASTER_XLSX_PATH), 'success', 'Initial import from operational workbook', summary);
    console.log('[bootstrap] Imported master workbook.', summary);
  } catch (e) {
    console.error('[bootstrap] Failed:', e.message);
  }
}

tryBootstrapFromMasterWorkbook();

function seedInitialSnapshotIfNeeded() {
  try {
    const m = db.prepare('SELECT COUNT(*) as c FROM master_assets').get();
    const s = db.prepare('SELECT COUNT(*) as c FROM portfolio_snapshots').get();
    if (m.c > 0 && s.c === 0) {
      recordPortfolioSnapshot(db);
      console.log('[snapshots] Initial portfolio snapshot captured.');
    }
  } catch (e) {
    console.warn('[snapshots] seed:', e.message);
  }
}

seedInitialSnapshotIfNeeded();

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 40;
const loginFailures = new Map();

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0].trim();
  return req.socket?.remoteAddress || 'local';
}

function loginFailuresAllowed(ip) {
  const now = Date.now();
  const cur = loginFailures.get(ip);
  if (!cur || now > cur.resetAt) return true;
  return cur.count < LOGIN_MAX_FAILURES;
}

function recordLoginFailure(ip) {
  const now = Date.now();
  let cur = loginFailures.get(ip);
  if (!cur || now > cur.resetAt) {
    cur = { count: 0, resetAt: now + LOGIN_WINDOW_MS };
  }
  cur.count += 1;
  loginFailures.set(ip, cur);
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'ola-olabinjo-command-centre',
    version: WORKSPACE_VERSION,
    time: new Date().toISOString(),
    auth: {
      mode: process.env.JWT_SECRET ? 'jwt-hs256' : 'legacy-mock',
      sessionSigned: Boolean(process.env.JWT_SECRET)
    }
  });
});

app.post('/api/auth/login', (req, res) => {
  const ip = clientIp(req);
  if (!loginFailuresAllowed(ip)) {
    return res.status(429).json({ error: 'Too many failed login attempts from this address. Try again in 15 minutes.' });
  }
  const { username, password } = req.body || {};
  const session = login(username, password);
  if (!session) {
    recordLoginFailure(ip);
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  loginFailures.delete(ip);
  res.json(session);
});

app.get('/api/auth/demo-users', (_req, res) => {
  res.json({
    message: 'Mock authentication — use these in development only.',
    users: [
      { username: 'chairman', password: 'demo', role: 'chairman' },
      { username: 'lead', password: 'demo', role: 'lead' },
      { username: 'analyst', password: 'demo', role: 'analyst' },
      { username: 'viewer', password: 'demo', role: 'viewer' }
    ]
  });
});

function requireMutation(req, res, next) {
  if (req.user.role === 'chairman' || req.user.role === 'viewer') {
    return res.status(403).json({ error: 'Read-only role' });
  }
  next();
}

function requireAuditAccess(req, res, next) {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'Audit trail is not available for this role' });
  }
  next();
}

app.use((req, res, next) => {
  if (req.path.startsWith('/api/auth/login') || req.path.startsWith('/api/health') || req.path.startsWith('/api/auth/demo-users')) {
    return next();
  }
  if (!req.path.startsWith('/api/')) return next();
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  const user = verifyToken(token);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  req.user = user;
  next();
});

app.get('/api/me', (req, res) => {
  res.json({ user: { username: req.user.username, role: req.user.role, displayName: req.user.displayName } });
});

const EXPORT_TABLES = new Set([
  'master_assets',
  'cash_banking',
  'real_estate',
  'liabilities',
  'public_securities',
  'operating_businesses',
  'private_investments',
  'documents',
  'advisors',
  'portfolio_snapshots'
]);

app.get('/api/export/treasury-flags', (req, res) => {
  const rows = getTreasuryExportFlatRows(db);
  const csv = rowsToCsv(rows);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="treasury_cash_with_flags.csv"');
  res.send(`\ufeff${csv}`);
});

app.get('/api/export/audit', requireAuditAccess, (req, res) => {
  const raw = parseInt(String(req.query.limit ?? '500'), 10);
  const limit = Number.isFinite(raw) ? Math.min(2000, Math.max(1, raw)) : 500;
  const rows = db
    .prepare(`SELECT id, created_at, actor, action, entity_type, entity_id, meta_json FROM audit_log ORDER BY id DESC LIMIT ?`)
    .all(limit);
  const csv = rowsToCsv(rows);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="audit_log.csv"');
  res.send(`\ufeff${csv}`);
});

app.get('/api/export/:table', (req, res) => {
  const t = req.params.table;
  if (!EXPORT_TABLES.has(t)) return res.status(404).json({ error: 'Export not available for this table' });
  const rows = db.prepare(`SELECT * FROM ${t} ORDER BY id ASC`).all();
  const csv = rowsToCsv(rows);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${t}.csv"`);
  res.send(`\ufeff${csv}`);
});

app.get('/api/dashboard/summary', (req, res) => {
  res.json(computeDashboard());
});

app.get('/api/dashboard/risk-heatmap', (_req, res) => {
  res.json(getRiskHeatmap());
});

app.get('/api/audit', requireAuditAccess, (req, res) => {
  const limRaw = parseInt(String(req.query.limit ?? '200'), 10);
  const limit = Number.isFinite(limRaw) ? Math.min(500, Math.max(1, limRaw)) : 200;
  const offRaw = parseInt(String(req.query.offset ?? '0'), 10);
  const offset = Number.isFinite(offRaw) ? Math.max(0, offRaw) : 0;

  const totalRow = db.prepare(`SELECT COUNT(*) as c FROM audit_log`).get();
  const total = totalRow.c;

  const rows = db.prepare(`SELECT * FROM audit_log ORDER BY id DESC LIMIT ? OFFSET ?`).all(limit, offset);
  const items = rows.map((r) => {
    let meta = null;
    if (r.meta_json) {
      try {
        meta = JSON.parse(r.meta_json);
      } catch {
        meta = { raw: r.meta_json };
      }
    }
    const { meta_json, ...rest } = r;
    return { ...rest, meta };
  });
  res.json({ items, total, limit, offset });
});

app.get('/api/documents/tracker', (req, res) => {
  const limRaw = parseInt(String(req.query.limit ?? '30'), 10);
  const limit = Number.isFinite(limRaw) ? Math.min(200, Math.max(1, limRaw)) : 30;
  const offRaw = parseInt(String(req.query.offset ?? '0'), 10);
  const offset = Number.isFinite(offRaw) ? Math.max(0, offRaw) : 0;

  const where = `(
    (document_category IS NOT NULL AND length(trim(document_category)) > 0)
    OR (entity_asset IS NOT NULL AND length(trim(entity_asset)) > 0)
  )`;

  const totalRow = db.prepare(`SELECT COUNT(*) as c FROM documents WHERE ${where}`).get();
  const total = totalRow.c;
  const rows = db.prepare(`SELECT * FROM documents WHERE ${where} ORDER BY id ASC LIMIT ? OFFSET ?`).all(limit, offset);
  res.json({ items: rows, total, limit, offset });
});

app.get('/api/search', (req, res) => {
  const q = String(req.query.q || '');
  res.json(globalSearch(db, q));
});

app.get('/api/treasury', (_req, res) => {
  res.json(getTreasuryOverview(db));
});

app.get('/api/decisions', (_req, res) => {
  res.json({ items: computeDashboard().decisions });
});

app.get('/api/recommendations', (_req, res) => {
  res.json({ items: computeDashboard().recommendations });
});

app.patch('/api/decisions/:id/resolve', requireMutation, (req, res) => {
  const id = decodeURIComponent(req.params.id);
  db.prepare(
    `INSERT INTO decision_actions (decision_id, status, resolved_at, resolved_by)
     VALUES (?, 'resolved', datetime('now'), ?)
     ON CONFLICT(decision_id) DO UPDATE SET
       status = excluded.status,
       resolved_at = excluded.resolved_at,
       resolved_by = excluded.resolved_by`
  ).run(id, req.user.username);
  logAudit(db, {
    actor: req.user.username,
    action: 'decision.resolve',
    entityType: 'decision',
    entityId: id,
    meta: {}
  });
  res.json({ ok: true, dashboard: computeDashboard() });
});

app.delete('/api/decisions/:id/resolve', requireMutation, (req, res) => {
  const id = decodeURIComponent(req.params.id);
  db.prepare('DELETE FROM decision_actions WHERE decision_id = ?').run(id);
  logAudit(db, {
    actor: req.user.username,
    action: 'decision.reopen',
    entityType: 'decision',
    entityId: id,
    meta: {}
  });
  res.json({ ok: true, dashboard: computeDashboard() });
});

app.get('/api/snapshots', (_req, res) => {
  const items = db.prepare('SELECT * FROM portfolio_snapshots ORDER BY id DESC LIMIT 100').all();
  res.json({ items });
});

app.post('/api/snapshots/capture', requireMutation, (req, res) => {
  recordPortfolioSnapshot(db);
  logAudit(db, {
    actor: req.user.username,
    action: 'snapshot.capture',
    entityType: 'portfolio_snapshot',
    meta: { source: 'manual' }
  });
  res.json({ ok: true, dashboard: computeDashboard() });
});

app.post('/api/import/preview', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file required (multipart field: file)' });
  try {
    const name = req.file.originalname || 'upload.xlsx';
    const ext = path.extname(name).toLowerCase();
    if (!['.xlsx', '.xls', '.csv'].includes(ext)) {
      return res.status(400).json({ error: 'Unsupported format. Use .xlsx, .xls, or .csv' });
    }
    const preview = previewImport(req.file.buffer);
    res.json({ filename: name, ...preview });
  } catch (e) {
    res.status(400).json({ error: e.message || 'Failed to parse workbook' });
  }
});

app.post('/api/import/confirm', requireMutation, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file required' });
  try {
    const name = req.file.originalname || 'upload.xlsx';
    let backupInfo;
    try {
      backupInfo = backupDatabaseBeforeImport();
    } catch (be) {
      console.error('[import] pre-import backup failed:', be);
      return res.status(500).json({ error: 'Could not create a safety backup before import. Import aborted.' });
    }
    const { summary } = importBuffer(req.file.buffer, { replace: true });
    logImport(name, 'success', 'User confirmed import', summary);
    recordPortfolioSnapshot(db);
    logAudit(db, {
      actor: req.user.username,
      action: 'import.confirm',
      entityType: 'workbook',
      entityId: name,
      meta: { summary, backup: backupInfo }
    });
    res.json({ ok: true, summary, dashboard: computeDashboard(), backup: backupInfo });
  } catch (e) {
    logImport(req.file.originalname || 'upload', 'error', e.message, {});
    res.status(400).json({ error: e.message || 'Import failed' });
  }
});

app.get('/api/import/history', (_req, res) => {
  const rows = db.prepare(`SELECT * FROM import_history ORDER BY id DESC LIMIT 50`).all();
  res.json({ items: rows });
});

const TABLES_READ = [
  'master_assets',
  'cash_banking',
  'real_estate',
  'public_securities',
  'operating_businesses',
  'private_investments',
  'liabilities',
  'advisors',
  'documents'
];

app.get('/api/data/:table', (req, res) => {
  const t = req.params.table;
  if (!TABLES_READ.includes(t)) return res.status(404).json({ error: 'Unknown table' });
  const totalRow = db.prepare(`SELECT COUNT(*) as c FROM ${t}`).get();
  const total = totalRow.c;

  const limRaw = req.query.limit;
  const offRaw = req.query.offset;
  if (limRaw === undefined && offRaw === undefined) {
    const rows = db.prepare(`SELECT * FROM ${t} ORDER BY id ASC`).all();
    return res.json({ items: rows, total });
  }

  const limit = Math.min(200, Math.max(1, parseInt(String(limRaw ?? '50'), 10) || 50));
  const offset = Math.max(0, parseInt(String(offRaw ?? '0'), 10) || 0);
  const rows = db.prepare(`SELECT * FROM ${t} ORDER BY id ASC LIMIT ? OFFSET ?`).all(limit, offset);
  res.json({ items: rows, total, limit, offset });
});

app.put('/api/data/:table/:id', requireMutation, (req, res) => {
  const t = req.params.table;
  if (!TABLES_READ.includes(t)) return res.status(404).json({ error: 'Unknown table' });
  const id = Number(req.params.id);
  const row = db.prepare(`SELECT * FROM ${t} WHERE id = ?`).get(id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const patch = req.body || {};
  const cols = Object.keys(row).filter((k) => k !== 'id' && k !== 'updated_at');
  const updates = cols.filter((c) => Object.prototype.hasOwnProperty.call(patch, c));
  if (!updates.length) return res.status(400).json({ error: 'No valid fields' });
  const sets = updates.map((c) => `${c} = @${c}`).join(', ');
  const params = { id, ...patch };
  for (const c of cols) if (params[c] === undefined) params[c] = row[c];
  db.prepare(`UPDATE ${t} SET ${sets}, updated_at = datetime('now') WHERE id = @id`).run(params);
  const next = db.prepare(`SELECT * FROM ${t} WHERE id = ?`).get(id);
  logAudit(db, {
    actor: req.user.username,
    action: 'data.update',
    entityType: t,
    entityId: String(id),
    meta: { fields: updates }
  });
  res.json(next);
});

app.post('/api/data/:table', requireMutation, (req, res) => {
  const t = req.params.table;
  if (!TABLES_READ.includes(t)) return res.status(404).json({ error: 'Unknown table' });
  const body = req.body || {};
  const cols = db
    .prepare(`PRAGMA table_info(${t})`)
    .all()
    .map((r) => r.name)
    .filter((n) => n !== 'id' && n !== 'updated_at');
  const insertCols = cols.filter((c) => body[c] !== undefined);
  if (!insertCols.length) return res.status(400).json({ error: 'Provide at least one field' });
  const placeholders = insertCols.map((c) => `@${c}`).join(', ');
  const named = {};
  for (const c of insertCols) named[c] = body[c] ?? null;
  const sql = `INSERT INTO ${t} (${insertCols.join(', ')}, updated_at) VALUES (${placeholders}, datetime('now'))`;
  const info = db.prepare(sql).run(named);
  const created = db.prepare(`SELECT * FROM ${t} WHERE id = ?`).get(info.lastInsertRowid);
  logAudit(db, {
    actor: req.user.username,
    action: 'data.create',
    entityType: t,
    entityId: String(info.lastInsertRowid),
    meta: { keys: insertCols }
  });
  res.status(201).json(created);
});

app.delete('/api/data/:table/:id', requireMutation, (req, res) => {
  const t = req.params.table;
  if (!TABLES_READ.includes(t)) return res.status(404).json({ error: 'Unknown table' });
  const id = Number(req.params.id);
  db.prepare(`DELETE FROM ${t} WHERE id = ?`).run(id);
  logAudit(db, {
    actor: req.user.username,
    action: 'data.delete',
    entityType: t,
    entityId: String(id),
    meta: {}
  });
  res.json({ ok: true });
});

app.get('/api/reports/:slug', (req, res) => {
  const dash = computeDashboard();
  const slug = req.params.slug;
  const base = {
    generatedAt: new Date().toISOString(),
    title: 'Ola Olabinjo Investment — Family Office',
    slug
  };
  switch (slug) {
    case 'net-worth':
      return res.json({
        ...base,
        sections: [
          { heading: 'Summary', rows: [{ label: 'Total assets', value: dash.totalAssets }, { label: 'Total liabilities', value: dash.totalLiabilities }, { label: 'Net position', value: dash.netPosition }] },
          { heading: 'Allocation', rows: dash.allocation }
        ]
      });
    case 'liquidity':
      return res.json({
        ...base,
        sections: [{ heading: 'Liquidity', rows: [{ label: 'Cash position', value: dash.cashPosition }, { label: 'Liquidity ratio', value: dash.liquidityRatio }] }]
      });
    case 'risk':
      return res.json({ ...base, riskSignals: dash.riskSignals, heatmap: getRiskHeatmap() });
    case 'property':
      return res.json({ ...base, items: db.prepare(`SELECT * FROM real_estate ORDER BY id`).all() });
    case 'liability':
      return res.json({ ...base, items: db.prepare(`SELECT * FROM liabilities ORDER BY id`).all() });
    case 'exposure':
      return res.json({ ...base, countryExposure: dash.countryExposure, allocation: dash.allocation });
    case 'documents':
      return res.json({ ...base, items: db.prepare(`SELECT * FROM documents ORDER BY id`).all() });
    case 'monthly':
      return res.json({
        ...base,
        executiveSummary: `Net position ${dash.netPosition?.toLocaleString?.() ?? dash.netPosition}. Health score ${dash.portfolioHealthScore}.`,
        kpis: {
          totalAssets: dash.totalAssets,
          totalLiabilities: dash.totalLiabilities,
          netPosition: dash.netPosition,
          cashPosition: dash.cashPosition,
          portfolioHealthScore: dash.portfolioHealthScore,
          pendingDecisions: dash.pendingDecisions,
          outstandingDocumentation: dash.outstandingDocumentation
        },
        periodMovement: dash.monthlyPortfolioMovement,
        allocation: dash.allocation,
        risks: dash.riskSignals.slice(0, 15)
      });
    default:
      return res.status(404).json({ error: 'Unknown report' });
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal error' });
});

const staticDir = path.join(__dirname, '../../client/dist');
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(staticDir, 'index.html'));
  });
}

export { app };
