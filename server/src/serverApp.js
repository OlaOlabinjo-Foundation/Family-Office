import express from 'express';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { migrate, db } from './db.js';
import { MASTER_XLSX_PATH } from './config.js';
import { getCredentialStore, changeUserPassword } from './auth.js';
import { confirmMfaSetup, disableMfa, getMfaStatus, mfaPolicyApplies } from './mfa.js';
import { applySecurityMiddleware } from './middleware/security.js';
import { applyRequestLogging } from './middleware/requestLog.js';
import { applyAuthenticateMiddleware } from './middleware/authenticate.js';
import { createAuthRouter } from './routes/authRoutes.js';
import { createHealthRouter } from './routes/healthRoutes.js';
import { startScheduledDigest } from './scheduledDigest.js';
import { previewImport } from './importExcel.js';
import { importBuffer, logImport } from './importService.js';
import { computeDashboard, getRiskHeatmap } from './intelligence.js';
import { recordPortfolioSnapshot } from './snapshots.js';
import { logAudit, sanitizeAuditNote } from './audit.js';
import { queryAuditForEntity } from './auditQuery.js';
import { globalSearch } from './search.js';
import { getTreasuryOverview, getTreasuryExportFlatRows } from './treasury.js';
import { rowsToCsv } from './exportCsv.js';
import {
  OUTSTANDING_DOC_STATUS_WHERE,
  TRACKED_DOC_WHERE,
  TRACKER_SORT_OLDEST_REQUESTED
} from './documentFilters.js';
import { backupDatabaseBeforeImport } from './dbBackup.js';
import { notifyImportSuccess, notifyWeeklyDigest } from './notifyMail.js';
import { buildTaskInbox, buildWeeklyDigestText } from './taskInbox.js';
import { listCommunications, createCommunication, sendCommunicationFollowUpEmails } from './communications.js';
import { createAssignedTask, completeAssignedTask } from './assignedTasks.js';
import { scheduleInboxTaskNotifications, notifyTaskOwnerNow } from './taskNotify.js';
import { compareLatestPair, compareSnapshots } from './snapshotCompare.js';
import { createAppUser, deleteAppUser, listAppUsers, patchAppUser } from './adminAppUsers.js';
import { getMasterAssetFieldOptions, nextMasterAssetId } from './masterAssetMeta.js';
import {
  getCashBankingFieldOptions,
  getLiabilitiesFieldOptions,
  getPublicSecuritiesFieldOptions,
  getRealEstateFieldOptions,
} from './registerMeta.js';
import { buildEntityExposure } from './entityExposure.js';
import {
  ensureSoftDeleteColumns,
  restoreRow,
  rowVisibilityWhere,
  softDeleteRow,
  supportsSoftDelete,
} from './registerData.js';
import {
  APPROVAL_TABLES,
  approveChangeRequest,
  listChangeRequests,
  rejectChangeRequest,
  submitChangeRequest,
} from './changeRequests.js';
import {
  buildComplianceCalendarDigest,
  completeComplianceCalendarItem,
  createComplianceCalendarItem,
  deleteComplianceCalendarItem,
  listComplianceCalendarItems,
  reopenComplianceCalendarItem,
  updateComplianceCalendarItem,
} from './complianceCalendar.js';
import {
  attachVaultCounts,
  deleteVaultFile,
  getDocumentRow,
  listVaultFiles,
  resolveVaultFilePath,
  uploadVaultFile,
  VAULT_MAX_BYTES,
} from './documentVault.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const vaultUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: VAULT_MAX_BYTES, files: 1 },
});

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
applySecurityMiddleware(app);
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
applyRequestLogging(app);

migrate();
ensureSoftDeleteColumns(db);

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
startScheduledDigest(db);

app.use(createHealthRouter({ version: WORKSPACE_VERSION }));
app.use(createAuthRouter({ db, logAudit }));

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

function requireLead(req, res, next) {
  if (req.user.role !== 'lead') {
    return res.status(403).json({ error: 'Only the family office lead may manage application users.' });
  }
  next();
}

function requireAnalyst(req, res, next) {
  if (req.user.role !== 'analyst') {
    return res.status(403).json({ error: 'Only analysts submit change requests.' });
  }
  next();
}

function blockAnalystDirectWrite(req, res, next) {
  const t = req.params.table;
  if (req.user.role === 'analyst' && APPROVAL_TABLES.has(t)) {
    return res.status(403).json({
      error: 'Analyst changes must be submitted via the approval queue.',
      code: 'approval_required',
    });
  }
  next();
}

function requireSqliteCredentialStore(req, res, next) {
  if (getCredentialStore() !== 'sqlite') {
    return res.status(400).json({ error: 'Team user management requires FAMILY_OFFICE_AUTH=sqlite.' });
  }
  next();
}

applyAuthenticateMiddleware(app);

app.get('/api/me', (req, res) => {
  const store = getCredentialStore();
  const mfa = getMfaStatus(req.user.username);
  res.json({
    user: {
      username: req.user.username,
      role: req.user.role,
      displayName: req.user.displayName
    },
    flags: {
      canChangePassword: store === 'sqlite',
      credentialStore: store,
      canManageAppUsers: store === 'sqlite' && req.user.role === 'lead',
      canManageMfa: store === 'sqlite' && mfaPolicyApplies(req.user.role),
      mfaEnabled: mfa.enabled,
      mfaPolicyApplies: mfa.policyApplies
    }
  });
});

app.post('/api/auth/change-password', (req, res) => {
  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  const result = changeUserPassword(req.user.username, currentPassword, newPassword);
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }
  logAudit(db, {
    actor: req.user.username,
    action: 'auth.password_change',
    entityType: 'user',
    entityId: req.user.username,
    meta: {}
  });
  res.json({ ok: true });
});

app.get('/api/auth/mfa/status', (req, res) => {
  if (getCredentialStore() !== 'sqlite') {
    return res.json({ available: false, enabled: false, policyApplies: false });
  }
  const status = getMfaStatus(req.user.username);
  res.json({
    available: mfaPolicyApplies(req.user.role),
    enabled: status.enabled,
    policyApplies: status.policyApplies
  });
});

app.post('/api/auth/mfa/setup', (req, res) => {
  if (getCredentialStore() !== 'sqlite') {
    return res.status(400).json({ error: 'MFA is only available when FAMILY_OFFICE_AUTH=sqlite.' });
  }
  if (!mfaPolicyApplies(req.user.role)) {
    return res.status(403).json({ error: 'MFA is only available for lead and analyst accounts.' });
  }
  const result = beginMfaSetup(req.user.username);
  if (!result.ok) return res.status(400).json({ error: result.error });
  logAudit(db, {
    actor: req.user.username,
    action: 'auth.mfa_setup_started',
    entityType: 'user',
    entityId: req.user.username,
    meta: {}
  });
  res.json({
    secret: result.secret,
    otpauthUrl: result.otpauthUrl,
    qrUrl: buildOtpAuthQrUrl(result.otpauthUrl),
    issuer: result.issuer,
    accountName: result.accountName
  });
});

app.post('/api/auth/mfa/enable', (req, res) => {
  if (getCredentialStore() !== 'sqlite') {
    return res.status(400).json({ error: 'MFA is only available when FAMILY_OFFICE_AUTH=sqlite.' });
  }
  const code = typeof req.body?.code === 'string' ? req.body.code : '';
  const result = confirmMfaSetup(req.user.username, code);
  if (!result.ok) return res.status(400).json({ error: result.error });
  logAudit(db, {
    actor: req.user.username,
    action: 'auth.mfa_enabled',
    entityType: 'user',
    entityId: req.user.username,
    meta: {}
  });
  res.json({ ok: true, recoveryCodes: result.recoveryCodes });
});

app.post('/api/auth/mfa/disable', (req, res) => {
  if (getCredentialStore() !== 'sqlite') {
    return res.status(400).json({ error: 'MFA is only available when FAMILY_OFFICE_AUTH=sqlite.' });
  }
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const code = typeof req.body?.code === 'string' ? req.body.code : '';
  const result = disableMfa(req.user.username, password, code);
  if (!result.ok) return res.status(400).json({ error: result.error });
  logAudit(db, {
    actor: req.user.username,
    action: 'auth.mfa_disabled',
    entityType: 'user',
    entityId: req.user.username,
    meta: {}
  });
  res.json({ ok: true });
});

app.get('/api/admin/app-users', requireLead, requireSqliteCredentialStore, (_req, res) => {
  res.json({ items: listAppUsers(db) });
});

app.post('/api/admin/app-users', requireLead, requireSqliteCredentialStore, (req, res) => {
  const { username, displayName, role, password, email, changeNote } = req.body || {};
  const result = createAppUser(db, { username, displayName, role, password, email });
  if (!result.ok) return res.status(400).json({ error: result.error });
  const note = sanitizeAuditNote(changeNote);
  logAudit(db, {
    actor: req.user.username,
    action: 'admin.app_user.create',
    entityType: 'app_user',
    entityId: result.user.username,
    meta: {
      displayName: result.user.displayName,
      role: result.user.role,
      ...(note ? { note } : {}),
    },
  });
  res.status(201).json(result.user);
});

app.patch('/api/admin/app-users/:username', requireLead, requireSqliteCredentialStore, (req, res) => {
  const un = decodeURIComponent(req.params.username);
  const { displayName, role, password, email, changeNote } = req.body || {};
  /** @type {{ displayName?: string, role?: string, password?: string, email?: string | null }} */
  const patch = {};
  if (displayName !== undefined) patch.displayName = displayName;
  if (role !== undefined) patch.role = role;
  if (password !== undefined) patch.password = password;
  if (email !== undefined) patch.email = email;
  const prior = db
    .prepare('SELECT username, display_name as displayName, role FROM app_users WHERE lower(username) = lower(?)')
    .get(un);
  if (!prior) return res.status(404).json({ error: 'User not found.' });
  const result = patchAppUser(db, un, patch);
  if (!result.ok) return res.status(400).json({ error: result.error });
  const note = sanitizeAuditNote(changeNote);
  logAudit(db, {
    actor: req.user.username,
    action: 'admin.app_user.update',
    entityType: 'app_user',
    entityId: un,
    meta: {
      before: { displayName: prior.displayName, role: prior.role },
      after: { displayName: result.user.displayName, role: result.user.role },
      changed: Object.keys(patch),
      passwordRotated: Boolean(patch.password),
      ...(note ? { note } : {}),
    },
  });
  res.json(result.user);
});

app.delete('/api/admin/app-users/:username', requireLead, requireSqliteCredentialStore, (req, res) => {
  const un = decodeURIComponent(req.params.username);
  const prior = db
    .prepare('SELECT username, display_name as displayName, role FROM app_users WHERE lower(username) = lower(?)')
    .get(un);
  const result = deleteAppUser(db, un, req.user.username);
  if (!result.ok) return res.status(400).json({ error: result.error });
  const note = sanitizeAuditNote(req.body?.changeNote);
  logAudit(db, {
    actor: req.user.username,
    action: 'admin.app_user.delete',
    entityType: 'app_user',
    entityId: un,
    meta: prior
      ? { removed: { username: prior.username, displayName: prior.displayName, role: prior.role }, ...(note ? { note } : {}) }
      : note
        ? { note }
        : {},
  });
  res.json({ ok: true });
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

app.get('/api/export/documents-tracker', (req, res) => {
  const q = String(req.query.outstanding ?? '').toLowerCase();
  const outstandingOnly = q === '1' || q === 'true' || q === 'yes';
  const sortRaw = String(req.query.sort ?? '').toLowerCase();
  const where = outstandingOnly ? `${TRACKED_DOC_WHERE} AND ${OUTSTANDING_DOC_STATUS_WHERE}` : TRACKED_DOC_WHERE;
  let orderBy = 'id ASC';
  if (outstandingOnly) orderBy = TRACKER_SORT_OLDEST_REQUESTED;
  else if (sortRaw === 'oldest_requested') orderBy = TRACKER_SORT_OLDEST_REQUESTED;
  const rows = db.prepare(`SELECT * FROM documents WHERE ${where} ORDER BY ${orderBy}`).all();
  const csv = rowsToCsv(rows);
  const name = outstandingOnly ? 'documents_tracker_outstanding.csv' : 'documents_tracker_all.csv';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
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

  const entityType = String(req.query.entity_type ?? '').trim();
  const entityId = String(req.query.entity_id ?? '').trim();
  if (entityType && entityId) {
    const scoped = queryAuditForEntity(db, { entityType, entityId, limit, offset });
    return res.json({ ...scoped, entityType, entityId });
  }

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

  const oq = String(req.query.outstanding ?? '').toLowerCase();
  const outstandingOnly = oq === '1' || oq === 'true' || oq === 'yes';
  const where = outstandingOnly ? `${TRACKED_DOC_WHERE} AND ${OUTSTANDING_DOC_STATUS_WHERE}` : TRACKED_DOC_WHERE;

  const sortRaw = String(req.query.sort ?? '').toLowerCase();
  let orderBy = 'id ASC';
  if (sortRaw === 'oldest_requested') {
    orderBy = TRACKER_SORT_OLDEST_REQUESTED;
  } else if (outstandingOnly) {
    orderBy = TRACKER_SORT_OLDEST_REQUESTED;
  }

  const totalRow = db.prepare(`SELECT COUNT(*) as c FROM documents WHERE ${where}`).get();
  const total = totalRow.c;
  const rows = db.prepare(`SELECT * FROM documents WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).all(limit, offset);
  const items = attachVaultCounts(db, rows);
  res.json({
    items,
    total,
    limit,
    offset,
    outstandingOnly,
    sort: sortRaw || (outstandingOnly ? 'oldest_requested' : 'id')
  });
});

/** Mark a document row as compliance-reviewed (does not change workbook status fields). */
app.patch('/api/documents/:id/review', requireMutation, (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid document id' });
  const reviewed = req.body?.reviewed !== false;
  const row = db.prepare('SELECT id FROM documents WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Document row not found' });
  if (reviewed) {
    db.prepare(
      `UPDATE documents SET reviewed_at = datetime('now'), reviewed_by = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(req.user.username, id);
  } else {
    db.prepare(`UPDATE documents SET reviewed_at = NULL, reviewed_by = NULL, updated_at = datetime('now') WHERE id = ?`).run(id);
  }
  logAudit(db, {
    actor: req.user.username,
    action: reviewed ? 'documents.review_set' : 'documents.review_clear',
    entityType: 'document',
    entityId: String(id),
    meta: {}
  });
  const out = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
  res.json({ ...out, vault_file_count: attachVaultCounts(db, [out])[0]?.vault_file_count ?? 0 });
});

app.get('/api/documents/:id/vault', (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid document id' });
  const doc = getDocumentRow(db, id);
  if (!doc) return res.status(404).json({ error: 'Document row not found' });
  const files = listVaultFiles(db, id);
  res.json({
    document: {
      id: doc.id,
      document_id: doc.document_id,
      document_category: doc.document_category,
      entity_asset: doc.entity_asset,
      status: doc.status,
    },
    files,
  });
});

app.post('/api/documents/:id/vault', requireMutation, vaultUpload.single('file'), (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid document id' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded (field name: file)' });
  const note = typeof req.body?.note === 'string' ? req.body.note : undefined;
  const result = uploadVaultFile(db, id, req.file, req.user.username, note);
  if (!result.ok) return res.status(result.status || 400).json({ error: result.error });
  logAudit(db, {
    actor: req.user.username,
    action: 'vault.upload',
    entityType: 'document',
    entityId: String(id),
    meta: {
      fileId: result.file.id,
      filename: result.file.originalFilename,
      sizeBytes: result.file.sizeBytes,
    },
  });
  res.status(201).json({ file: result.file, vault_file_count: listVaultFiles(db, id).length });
});

app.get('/api/vault/files/:id/download', (req, res) => {
  const fileId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(fileId) || fileId <= 0) return res.status(400).json({ error: 'Invalid file id' });
  const resolved = resolveVaultFilePath(db, fileId);
  if (!resolved) return res.status(404).json({ error: 'File not found' });
  const filename = resolved.row.original_filename || 'document';
  const inline = String(req.query.inline || '') === '1';
  res.setHeader('Content-Type', resolved.row.mime_type || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(filename)}"`,
  );
  res.sendFile(path.resolve(resolved.absPath));
});

app.delete('/api/vault/files/:id', requireMutation, (req, res) => {
  const fileId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(fileId) || fileId <= 0) return res.status(400).json({ error: 'Invalid file id' });
  const resolved = resolveVaultFilePath(db, fileId);
  if (!resolved) return res.status(404).json({ error: 'File not found' });
  const result = deleteVaultFile(db, fileId, req.user.username);
  if (!result.ok) return res.status(result.status || 400).json({ error: result.error });
  logAudit(db, {
    actor: req.user.username,
    action: 'vault.delete',
    entityType: 'document',
    entityId: String(resolved.row.document_row_id),
    meta: { fileId, filename: resolved.row.original_filename },
  });
  res.json({ ok: true });
});

app.get('/api/compliance/calendar', (req, res) => {
  const view = typeof req.query.view === 'string' ? req.query.view : 'all';
  const status = typeof req.query.status === 'string' ? req.query.status : 'pending';
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  res.json(listComplianceCalendarItems(db, { view, status, limit, offset }));
});

app.get('/api/compliance/calendar/digest', (_req, res) => {
  res.json(buildComplianceCalendarDigest(db));
});

app.post('/api/compliance/calendar', requireMutation, (req, res) => {
  const result = createComplianceCalendarItem(db, req.body || {}, req.user.username);
  if (!result.ok) return res.status(400).json({ error: result.error });
  logAudit(db, {
    actor: req.user.username,
    action: 'compliance_calendar.create',
    entityType: 'compliance_calendar',
    entityId: String(result.item.id),
    meta: { title: result.item.title, dueDate: result.item.dueDate },
  });
  if (result.item.owner) {
    void notifyTaskOwnerNow(db, {
      taskKey: `task-calendar-${result.item.id}`,
      owner: result.item.owner,
      title: `Compliance calendar: ${result.item.title}`,
      detail: `${result.item.category}${result.item.entity ? ` · ${result.item.entity}` : ''}`,
      priority: result.item.overdue ? 'P0' : result.item.dueSoon ? 'P1' : 'P2',
      dueDate: result.item.dueDate,
      href: '/compliance/calendar',
      source: 'Compliance calendar',
    }).catch((e) => console.warn('[task-notify] calendar:', e.message));
  }
  scheduleInboxTaskNotifications(db);
  res.status(201).json(result.item);
});

app.put('/api/compliance/calendar/:id', requireMutation, (req, res) => {
  const id = Number(req.params.id);
  const result = updateComplianceCalendarItem(db, id, req.body || {});
  if (!result.ok) return res.status(result.error === 'Not found.' ? 404 : 400).json({ error: result.error });
  logAudit(db, {
    actor: req.user.username,
    action: 'compliance_calendar.update',
    entityType: 'compliance_calendar',
    entityId: String(id),
    meta: {},
  });
  if (result.item.owner && result.item.status === 'pending') {
    void notifyTaskOwnerNow(db, {
      taskKey: `task-calendar-${result.item.id}`,
      owner: result.item.owner,
      title: `Compliance calendar: ${result.item.title}`,
      detail: 'Calendar item updated — review due date and status.',
      priority: result.item.overdue ? 'P0' : 'P2',
      dueDate: result.item.dueDate,
      href: '/compliance/calendar',
      source: 'Compliance calendar',
    }).catch((e) => console.warn('[task-notify] calendar update:', e.message));
  }
  scheduleInboxTaskNotifications(db);
  res.json(result.item);
});

app.post('/api/compliance/calendar/:id/complete', requireMutation, (req, res) => {
  const id = Number(req.params.id);
  const result = completeComplianceCalendarItem(db, id, req.user.username);
  if (!result.ok) return res.status(result.error === 'Not found.' ? 404 : 400).json({ error: result.error });
  logAudit(db, {
    actor: req.user.username,
    action: 'compliance_calendar.complete',
    entityType: 'compliance_calendar',
    entityId: String(id),
    meta: { rolledForward: result.rolledForward },
  });
  res.json(result.item);
});

app.post('/api/compliance/calendar/:id/reopen', requireMutation, (req, res) => {
  const id = Number(req.params.id);
  const result = reopenComplianceCalendarItem(db, id);
  if (!result.ok) return res.status(result.error === 'Not found.' ? 404 : 400).json({ error: result.error });
  logAudit(db, {
    actor: req.user.username,
    action: 'compliance_calendar.reopen',
    entityType: 'compliance_calendar',
    entityId: String(id),
    meta: {},
  });
  res.json(result.item);
});

app.delete('/api/compliance/calendar/:id', requireMutation, (req, res) => {
  const id = Number(req.params.id);
  const result = deleteComplianceCalendarItem(db, id);
  if (!result.ok) return res.status(404).json({ error: result.error });
  logAudit(db, {
    actor: req.user.username,
    action: 'compliance_calendar.delete',
    entityType: 'compliance_calendar',
    entityId: String(id),
    meta: {},
  });
  res.json({ ok: true });
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

app.get('/api/snapshots/compare', (req, res) => {
  const priorRaw = parseInt(String(req.query.prior ?? req.query.priorId ?? ''), 10);
  const currentRaw = parseInt(String(req.query.current ?? req.query.currentId ?? ''), 10);
  let result;
  if (Number.isFinite(priorRaw) && priorRaw > 0 && Number.isFinite(currentRaw) && currentRaw > 0) {
    result = compareSnapshots(db, priorRaw, currentRaw);
  } else {
    result = compareLatestPair(db);
  }
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.json(result);
});

app.get('/api/tasks/inbox', (_req, res) => {
  scheduleInboxTaskNotifications(db);
  res.json(buildTaskInbox(db));
});

app.get('/api/communications', (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  res.json(listCommunications(db, { limit, offset }));
});

app.post('/api/communications', requireMutation, async (req, res) => {
  const result = createCommunication(db, req.body || {}, req.user.username);
  if (!result.ok) return res.status(400).json({ error: result.error });
  let mail = { sent: false, reason: 'no_smtp_url' };
  try {
    mail = await sendCommunicationFollowUpEmails(db, result.item);
  } catch (e) {
    console.warn('[mail] communication follow-up:', e.message);
    mail = { sent: false, reason: e.message };
  }
  res.status(201).json({ item: result.item, mail });
});

app.post('/api/tasks/assigned', requireMutation, async (req, res) => {
  const result = createAssignedTask(db, req.body || {}, req.user.username);
  if (!result.ok) return res.status(400).json({ error: result.error });
  let mail = { sent: false, reason: 'no_owner_email' };
  try {
    mail = await notifyTaskOwnerNow(db, {
      taskKey: `task-assigned-${result.item.id}`,
      owner: result.item.owner,
      title: result.item.title,
      detail: result.item.detail || '',
      priority: result.item.priority,
      dueDate: result.item.dueDate,
      href: `/actions?focus=task-assigned-${result.item.id}`,
      source: 'Assigned tasks',
    });
  } catch (e) {
    console.warn('[task-notify] assigned:', e.message);
  }
  res.status(201).json({ item: result.item, mail });
});

app.post('/api/tasks/assigned/:id/complete', requireMutation, (req, res) => {
  const id = Number(req.params.id);
  const result = completeAssignedTask(db, id, req.user.username);
  if (!result.ok) return res.status(result.error === 'Not found.' ? 404 : 400).json({ error: result.error });
  res.json(result.item);
});

app.get('/api/tasks/digest/preview', (req, res) => {
  const baseUrl =
    typeof req.query.baseUrl === 'string'
      ? req.query.baseUrl
      : typeof process.env.DIGEST_APP_BASE_URL === 'string'
        ? process.env.DIGEST_APP_BASE_URL
        : '';
  const text = buildWeeklyDigestText(db, baseUrl);
  res.json({ text, inbox: buildTaskInbox(db) });
});

app.post('/api/tasks/digest/send', requireLead, async (req, res) => {
  const baseUrl =
    typeof req.body?.baseUrl === 'string'
      ? req.body.baseUrl.trim()
      : typeof process.env.DIGEST_APP_BASE_URL === 'string'
        ? process.env.DIGEST_APP_BASE_URL.trim()
        : '';
  try {
    const mail = await notifyWeeklyDigest(db, { baseUrl });
    logAudit(db, {
      actor: req.user.username,
      action: 'digest.send',
      entityType: 'digest',
      meta: { sent: mail.sent, reason: mail.reason || null, to: mail.to || null },
    });
    if (!mail.sent) {
      return res.status(503).json({
        error:
          mail.reason === 'no_smtp_url'
            ? 'SMTP is not configured on the server (set SMTP_URL, SMTP_FROM, and SMTP_TO or SMTP_DIGEST_TO).'
            : 'Could not send digest email. Check SMTP_FROM and SMTP_TO / SMTP_DIGEST_TO.',
        mail,
      });
    }
    res.json({ ok: true, mail });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Digest send failed' });
  }
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
    const approvedBy = typeof req.body?.approvedBy === 'string' ? req.body.approvedBy.trim().slice(0, 240) : '';
    const effectiveDate = typeof req.body?.effectiveDate === 'string' ? req.body.effectiveDate.trim().slice(0, 40) : '';
    logImport(name, 'success', 'User confirmed import', summary, {
      approvedBy: approvedBy || null,
      effectiveDate: effectiveDate || null
    });
    recordPortfolioSnapshot(db);
    logAudit(db, {
      actor: req.user.username,
      action: 'import.confirm',
      entityType: 'workbook',
      entityId: name,
      meta: { summary, backup: backupInfo, approvedBy: approvedBy || null, effectiveDate: effectiveDate || null }
    });
    void notifyImportSuccess({
      filename: name,
      actor: req.user.username,
      approvedBy: approvedBy || null,
      effectiveDate: effectiveDate || null
    }).catch((e) => console.error('[mail] import notify:', e.message));
    scheduleInboxTaskNotifications(db);
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

app.get('/api/data/master_assets/options', (req, res) => {
  const current = {
    asset_category: typeof req.query.asset_category === 'string' ? req.query.asset_category : '',
    jurisdiction: typeof req.query.jurisdiction === 'string' ? req.query.jurisdiction : '',
    currency: typeof req.query.currency === 'string' ? req.query.currency : '',
    manager_custodian: typeof req.query.manager_custodian === 'string' ? req.query.manager_custodian : '',
  };
  res.json(getMasterAssetFieldOptions(db, { current }));
});

app.get('/api/data/master_assets/next-asset-id', (req, res) => {
  const category = typeof req.query.category === 'string' ? req.query.category : '';
  const assetId = nextMasterAssetId(db, category);
  res.json({ asset_id: assetId, category: category || null });
});

app.get('/api/data/cash_banking/options', (req, res) => {
  const current = {
    currency: typeof req.query.currency === 'string' ? req.query.currency : '',
    account_type: typeof req.query.account_type === 'string' ? req.query.account_type : '',
    risk_level: typeof req.query.risk_level === 'string' ? req.query.risk_level : '',
  };
  res.json(getCashBankingFieldOptions(db, { current }));
});

app.get('/api/data/real_estate/options', (req, res) => {
  const current = {
    currency: typeof req.query.currency === 'string' ? req.query.currency : '',
    country: typeof req.query.country === 'string' ? req.query.country : '',
    property_type: typeof req.query.property_type === 'string' ? req.query.property_type : '',
    risk_level: typeof req.query.risk_level === 'string' ? req.query.risk_level : '',
    title_held: typeof req.query.title_held === 'string' ? req.query.title_held : '',
  };
  res.json(getRealEstateFieldOptions(db, { current }));
});

app.get('/api/data/public_securities/options', (req, res) => {
  const current = {
    currency: typeof req.query.currency === 'string' ? req.query.currency : '',
    country: typeof req.query.country === 'string' ? req.query.country : '',
    security_type: typeof req.query.security_type === 'string' ? req.query.security_type : '',
    risk_level: typeof req.query.risk_level === 'string' ? req.query.risk_level : '',
  };
  res.json(getPublicSecuritiesFieldOptions(db, { current }));
});

app.get('/api/data/liabilities/options', (req, res) => {
  const current = {
    currency: typeof req.query.currency === 'string' ? req.query.currency : '',
    facility_type: typeof req.query.facility_type === 'string' ? req.query.facility_type : '',
    risk_level: typeof req.query.risk_level === 'string' ? req.query.risk_level : '',
  };
  res.json(getLiabilitiesFieldOptions(db, { current }));
});

app.get('/api/entities/exposure', (_req, res) => {
  res.json(buildEntityExposure(db));
});

app.get('/api/change-requests', (req, res) => {
  if (req.user.role !== 'lead' && req.user.role !== 'analyst') {
    return res.status(403).json({ error: 'Approval queue is for lead and analyst roles.' });
  }
  const status = typeof req.query.status === 'string' ? req.query.status : 'pending';
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const submittedBy = req.user.role === 'analyst' ? req.user.username : null;
  res.json(listChangeRequests(db, { status, limit, offset, submittedBy }));
});

app.post('/api/change-requests', requireMutation, requireAnalyst, (req, res) => {
  const table = typeof req.body?.table === 'string' ? req.body.table.trim() : '';
  const operation = typeof req.body?.operation === 'string' ? req.body.operation.trim() : '';
  const rowId = req.body?.rowId != null ? Number(req.body.rowId) : null;
  const payload = req.body?.payload && typeof req.body.payload === 'object' ? req.body.payload : {};
  const result = submitChangeRequest(db, {
    table,
    operation,
    rowId,
    payload,
    submittedBy: req.user.username,
  });
  if (!result.ok) return res.status(400).json({ error: result.error });
  void notifyTaskOwnerNow(db, {
    taskKey: `task-approval-${result.request.id}`,
    owner: 'Lead',
    title: `${result.request.summary || 'Register change'} awaiting approval`,
    detail: `Submitted by ${req.user.username} · ${result.request.table}`,
    priority: 'P1',
    href: '/approvals',
    source: 'Approval queue',
  }).catch((e) => console.warn('[task-notify] change request:', e.message));
  scheduleInboxTaskNotifications(db);
  res.status(201).json(result.request);
});

app.post('/api/change-requests/:id/approve', requireMutation, requireLead, (req, res) => {
  const id = Number(req.params.id);
  const comment =
    typeof req.body?.comment === 'string' ? req.body.comment.trim().slice(0, 500) : '';
  const result = approveChangeRequest(db, id, req.user.username, comment);
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.json(result.request);
});

app.post('/api/change-requests/:id/reject', requireMutation, requireLead, (req, res) => {
  const id = Number(req.params.id);
  const comment =
    typeof req.body?.comment === 'string' ? req.body.comment.trim().slice(0, 500) : '';
  const result = rejectChangeRequest(db, id, req.user.username, comment);
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.json(result.request);
});

app.get('/api/data/:table', (req, res) => {
  const t = req.params.table;
  if (!TABLES_READ.includes(t)) return res.status(404).json({ error: 'Unknown table' });
  const archivedOnly = String(req.query.archived ?? '').toLowerCase() === '1';
  const includeDeleted = String(req.query.include_deleted ?? '').toLowerCase() === '1';
  const { sql: whereSql } = rowVisibilityWhere(db, t, { archivedOnly, includeDeleted });

  const totalRow = db.prepare(`SELECT COUNT(*) as c FROM ${t} WHERE ${whereSql}`).get();
  const total = totalRow.c;

  const limRaw = req.query.limit;
  const offRaw = req.query.offset;
  if (limRaw === undefined && offRaw === undefined) {
    const rows = db.prepare(`SELECT * FROM ${t} WHERE ${whereSql} ORDER BY id ASC`).all();
    return res.json({ items: rows, total, archivedOnly });
  }

  const limit = Math.min(200, Math.max(1, parseInt(String(limRaw ?? '50'), 10) || 50));
  const offset = Math.max(0, parseInt(String(offRaw ?? '0'), 10) || 0);
  const rows = db
    .prepare(`SELECT * FROM ${t} WHERE ${whereSql} ORDER BY id ASC LIMIT ? OFFSET ?`)
    .all(limit, offset);
  res.json({ items: rows, total, limit, offset, archivedOnly });
});

app.post('/api/data/:table/:id/restore', requireMutation, (req, res) => {
  const t = req.params.table;
  if (!TABLES_READ.includes(t)) return res.status(404).json({ error: 'Unknown table' });
  const id = Number(req.params.id);
  const result = restoreRow(db, t, id);
  if (!result.ok) return res.status(400).json({ error: result.error });
  logAudit(db, {
    actor: req.user.username,
    action: 'data.restore',
    entityType: t,
    entityId: String(id),
    meta: {},
  });
  const row = db.prepare(`SELECT * FROM ${t} WHERE id = ?`).get(id);
  res.json(row);
});

app.put('/api/data/:table/:id', requireMutation, blockAnalystDirectWrite, (req, res) => {
  const t = req.params.table;
  if (!TABLES_READ.includes(t)) return res.status(404).json({ error: 'Unknown table' });
  const id = Number(req.params.id);
  const row = db.prepare(`SELECT * FROM ${t} WHERE id = ?`).get(id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const patch = req.body || {};
  const cols = Object.keys(row).filter(
    (k) => k !== 'id' && k !== 'updated_at' && k !== 'deleted_at' && k !== 'deleted_by'
  );
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

app.post('/api/data/:table', requireMutation, blockAnalystDirectWrite, (req, res) => {
  const t = req.params.table;
  if (!TABLES_READ.includes(t)) return res.status(404).json({ error: 'Unknown table' });
  const body = req.body || {};
  const cols = db
    .prepare(`PRAGMA table_info(${t})`)
    .all()
    .map((r) => r.name)
    .filter((n) => n !== 'id' && n !== 'updated_at' && n !== 'deleted_at' && n !== 'deleted_by');
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

app.delete('/api/data/:table/:id', requireMutation, blockAnalystDirectWrite, (req, res) => {
  const t = req.params.table;
  if (!TABLES_READ.includes(t)) return res.status(404).json({ error: 'Unknown table' });
  const id = Number(req.params.id);
  const row = db.prepare(`SELECT * FROM ${t} WHERE id = ?`).get(id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const result = softDeleteRow(db, t, id, req.user.username);
  logAudit(db, {
    actor: req.user.username,
    action: result.mode === 'soft' ? 'data.soft_delete' : 'data.delete',
    entityType: t,
    entityId: String(id),
    meta: {},
  });
  res.json({ ok: true, mode: result.mode });
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
