import { describe, it, expect } from 'vitest';
import request from 'supertest';
import XLSX from 'xlsx';
import { app } from './serverApp.js';
import { db } from './db.js';
import { hashPasswordToScrypt } from './userCredentials.js';
import { beginMfaSetup, confirmMfaSetup, totpNow } from './mfa.js';

function minimalImportXlsxBuffer() {
  const wb = XLSX.utils.book_new();
  const headers = [
    'Asset ID',
    'Asset Name',
    'Asset Category',
    'Asset Sub-Type',
    'Legal Owner / Entity',
    'Ownership Structure',
    'Jurisdiction',
    'Current Value',
    'Currency',
    'Annual Income',
    'Associated Debt',
    'Net Value',
    'Liquidity',
    'Strategic / Core',
    'Manager / Custodian',
    'Last Valuation Date',
    'Risk Level',
    'Document Reference',
  ];
  const row = [
    'SMOKE-ASSET-1',
    'Smoke test asset',
    'Other',
    '',
    'Test LLC',
    '',
    'NG',
    1,
    'NGN',
    0,
    0,
    1,
    'Illiquid',
    'Core',
    '',
    '',
    'Low',
    '',
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, row]);
  XLSX.utils.book_append_sheet(wb, ws, 'Master Asset Register');

  const docHeaders = [
    'Document ID',
    'Document Category',
    'Entity / Asset',
    'Available',
    'Requested From',
    'Date Requested',
    'Date Received',
    'Storage Location / Link',
    'Owner',
    'Status',
    'Risk Level',
    'Notes',
  ];
  const docRow = ['SMOKE-DOC-1', 'KYC', 'Test LLC', '', '', '2024-01-15', '', '', 'Lead', 'Open', 'Low', ''];
  const wsDoc = XLSX.utils.aoa_to_sheet([docHeaders, docRow]);
  XLSX.utils.book_append_sheet(wb, wsDoc, 'Document Tracker');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

async function loginAs(username) {
  const res = await request(app).post('/api/auth/login').send({ username, password: 'demo' });
  expect(res.status).toBe(200);
  expect(res.body.token).toBeTruthy();
  return res.body.token;
}

describe('API smoke (isolated in-memory SQLite)', () => {
  it('GET /api/health returns ok and semver-like version', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.service).toBe('ola-olabinjo-command-centre');
    expect(typeof res.body.version).toBe('string');
    expect(res.body.version.length).toBeGreaterThan(0);
    expect(typeof res.body.time).toBe('string');
    expect(res.body.auth).toBeDefined();
    expect(['jwt-hs256', 'legacy-mock']).toContain(res.body.auth.mode);
    expect(typeof res.body.auth.sessionSigned).toBe('boolean');
    expect(['demo', 'env', 'sqlite']).toContain(res.body.auth.credentialStore);
    expect(['demo', 'configured']).toContain(res.body.auth.userSource);
  });

  it('POST /api/auth/login rejects bad credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'analyst', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('GET /api/me requires Bearer token', async () => {
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(401);
  });

  it('GET /api/me returns role for analyst', async () => {
    const token = await loginAs('analyst');
    const res = await request(app).get('/api/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('analyst');
    expect(res.body.flags?.canChangePassword).toBe(false);
    expect(res.body.flags?.credentialStore).toBe('demo');
    expect(res.body.flags?.canManageAppUsers).toBe(false);
  });

  it('GET /api/data/:table with pagination returns shape', async () => {
    const token = await loginAs('analyst');
    const res = await request(app)
      .get('/api/data/master_assets')
      .query({ limit: 10, offset: 0 })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    const { total, limit, offset, items } = res.body;
    expect(typeof total).toBe('number');
    expect(limit).toBe(10);
    expect(offset).toBe(0);
    expect(items.length).toBe(Math.min(limit, Math.max(0, total - offset)));
  });

  it('GET /api/documents/tracker returns pagination fields', async () => {
    const token = await loginAs('lead');
    const res = await request(app)
      .get('/api/documents/tracker')
      .query({ limit: 5, offset: 0 })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    const { total, limit, offset, items } = res.body;
    expect(typeof total).toBe('number');
    expect(limit).toBe(5);
    expect(offset).toBe(0);
    expect(items.length).toBe(Math.min(limit, Math.max(0, total - offset)));
  });

  it('GET /api/documents/tracker supports outstanding filter and metadata', async () => {
    const token = await loginAs('lead');
    const all = await request(app)
      .get('/api/documents/tracker')
      .query({ limit: 50, offset: 0 })
      .set('Authorization', `Bearer ${token}`);
    const out = await request(app)
      .get('/api/documents/tracker')
      .query({ limit: 50, offset: 0, outstanding: '1' })
      .set('Authorization', `Bearer ${token}`);
    expect(all.status).toBe(200);
    expect(out.status).toBe(200);
    expect(out.body.outstandingOnly).toBe(true);
    expect(out.body.sort).toBe('oldest_requested');
    expect(out.body.total).toBeLessThanOrEqual(all.body.total);
  });

  it('PATCH /api/documents/:id/review rejects invalid id, missing row, and read-only roles', async () => {
    const lead = await loginAs('lead');
    const bad = await request(app).patch('/api/documents/abc/review').set('Authorization', `Bearer ${lead}`).send({ reviewed: true });
    expect(bad.status).toBe(400);

    const missing = await request(app).patch('/api/documents/999999/review').set('Authorization', `Bearer ${lead}`).send({ reviewed: true });
    expect(missing.status).toBe(404);

    const viewer = await loginAs('viewer');
    const v = await request(app).patch('/api/documents/1/review').set('Authorization', `Bearer ${viewer}`).send({ reviewed: true });
    expect(v.status).toBe(403);

    const chairman = await loginAs('chairman');
    const c = await request(app).patch('/api/documents/1/review').set('Authorization', `Bearer ${chairman}`).send({ reviewed: true });
    expect(c.status).toBe(403);

    const bare = await request(app).patch('/api/documents/1/review').send({ reviewed: true });
    expect(bare.status).toBe(401);
  });

  it('PATCH /api/documents/:id/review sets and clears reviewed fields (after seed import)', async () => {
    const leadToken = await loginAs('lead');
    const buf = minimalImportXlsxBuffer();
    const imp = await request(app)
      .post('/api/import/confirm')
      .set('Authorization', `Bearer ${leadToken}`)
      .attach('file', buf, 'smoke-with-doc.xlsx');
    expect(imp.status).toBe(200);

    const tracker = await request(app)
      .get('/api/documents/tracker')
      .query({ limit: 5, offset: 0 })
      .set('Authorization', `Bearer ${leadToken}`);
    expect(tracker.status).toBe(200);
    expect(tracker.body.items.length).toBeGreaterThan(0);
    const id = tracker.body.items[0].id;

    const setRes = await request(app)
      .patch(`/api/documents/${id}/review`)
      .set('Authorization', `Bearer ${leadToken}`)
      .send({ reviewed: true });
    expect(setRes.status).toBe(200);
    expect(setRes.body.reviewed_by).toBe('lead');
    expect(setRes.body.reviewed_at).toBeTruthy();

    const analyst = await loginAs('analyst');
    const clearRes = await request(app)
      .patch(`/api/documents/${id}/review`)
      .set('Authorization', `Bearer ${analyst}`)
      .send({ reviewed: false });
    expect(clearRes.status).toBe(200);
    expect(clearRes.body.reviewed_at).toBeNull();
    expect(clearRes.body.reviewed_by).toBeNull();
  });

  it('GET /api/export/documents-tracker returns CSV', async () => {
    const token = await loginAs('analyst');
    const res = await request(app).get('/api/export/documents-tracker').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(String(res.headers['content-type'] || '')).toMatch(/text\/csv/);
    expect(String(res.headers['content-disposition'] || '')).toMatch(/documents_tracker_all/);
  });

  it('GET /api/export/documents-tracker accepts sort=oldest_requested', async () => {
    const token = await loginAs('analyst');
    const res = await request(app)
      .get('/api/export/documents-tracker')
      .query({ sort: 'oldest_requested' })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(String(res.headers['content-type'] || '')).toMatch(/text\/csv/);
  });

  it('GET /api/audit denies viewer', async () => {
    const token = await loginAs('viewer');
    const res = await request(app).get('/api/audit').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('GET /api/audit allows analyst with limit/offset', async () => {
    const token = await loginAs('analyst');
    const res = await request(app)
      .get('/api/audit')
      .query({ limit: 8, offset: 0 })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.limit).toBe(8);
    expect(res.body.offset).toBe(0);
    expect(typeof res.body.total).toBe('number');
  });

  it('GET /api/audit filters by entity_type and entity_id (row history)', async () => {
    const lead = await loginAs('lead');
    const created = await request(app)
      .post('/api/data/master_assets')
      .set('Authorization', `Bearer ${lead}`)
      .send({
        asset_id: 'AUDIT-SCOPE-1',
        asset_name: 'Audit scope test',
        asset_category: 'Other',
        jurisdiction: 'NG',
        net_value: 1,
        currency: 'NGN',
      });
    expect(created.status).toBe(201);
    const rowId = String(created.body.id);

    const scoped = await request(app)
      .get('/api/audit')
      .query({ entity_type: 'master_assets', entity_id: rowId, limit: 20 })
      .set('Authorization', `Bearer ${lead}`);
    expect(scoped.status).toBe(200);
    expect(scoped.body.entityType).toBe('master_assets');
    expect(scoped.body.entityId).toBe(rowId);
    expect(scoped.body.total).toBeGreaterThanOrEqual(1);
    expect(scoped.body.items.every((r) => r.entity_type === 'master_assets' && r.entity_id === rowId)).toBe(true);
    expect(scoped.body.items.some((r) => r.action === 'data.create')).toBe(true);

    const buf = minimalImportXlsxBuffer();
    await request(app)
      .post('/api/import/confirm')
      .set('Authorization', `Bearer ${lead}`)
      .attach('file', buf, 'audit-doc.xlsx');
    const tracker = await request(app)
      .get('/api/documents/tracker')
      .query({ limit: 1 })
      .set('Authorization', `Bearer ${lead}`);
    const docId = tracker.body.items[0].id;
    await request(app)
      .patch(`/api/documents/${docId}/review`)
      .set('Authorization', `Bearer ${lead}`)
      .send({ reviewed: true });

    const docScoped = await request(app)
      .get('/api/audit')
      .query({ entity_type: 'document', entity_id: String(docId), limit: 10 })
      .set('Authorization', `Bearer ${lead}`);
    expect(docScoped.status).toBe(200);
    expect(docScoped.body.items.some((r) => r.action === 'documents.review_set')).toBe(true);
  });

  it('GET /api/search requires auth and returns capped payload', async () => {
    const bare = await request(app).get('/api/search').query({ q: 'ab' });
    expect(bare.status).toBe(401);

    const token = await loginAs('analyst');
    const res = await request(app).get('/api/search').query({ q: 'ab' }).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.query).toBe('ab');
    expect(res.body.maxPerSection).toBe(24);
    expect(Array.isArray(res.body.master_assets)).toBe(true);
    expect(Array.isArray(res.body.documents)).toBe(true);
    for (const d of res.body.documents) {
      expect(typeof d.outstandingInTracker).toBe('boolean');
    }
  });

  it('chairman can load dashboard summary with calendar digest', async () => {
    const chairman = await loginAs('chairman');
    const res = await request(app).get('/api/dashboard/summary').set('Authorization', `Bearer ${chairman}`);
    expect(res.status).toBe(200);
    expect(res.body.complianceCalendar).toBeDefined();
    expect(typeof res.body.netPosition).toBe('number');
    const audit = await request(app).get('/api/audit?limit=5').set('Authorization', `Bearer ${chairman}`);
    expect(audit.status).toBe(200);
    const writeDenied = await request(app)
      .post('/api/compliance/calendar')
      .set('Authorization', `Bearer ${chairman}`)
      .send({ title: 'X', dueDate: '2026-01-01' });
    expect(writeDenied.status).toBe(403);
  });

  it('GET /api/dashboard/summary returns dashboard shape', async () => {
    const token = await loginAs('viewer');
    const res = await request(app).get('/api/dashboard/summary').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.netPosition).toBe('number');
    expect(Array.isArray(res.body.decisions)).toBe(true);
    expect(res.body.monthlyPortfolioMovement).toBeDefined();
    expect(['snapshot_delta', 'baseline', 'none']).toContain(res.body.monthlyPortfolioMovement.basis);
    expect(Array.isArray(res.body.allocation)).toBe(true);
    expect(Array.isArray(res.body.countryExposure)).toBe(true);
    expect(Array.isArray(res.body.riskSignals)).toBe(true);
    for (const s of res.body.riskSignals) {
      expect(typeof s.ctaTo).toBe('string');
      expect(s.ctaTo.startsWith('/')).toBe(true);
    }
    expect(Array.isArray(res.body.alerts)).toBe(true);
    for (const a of res.body.alerts) {
      expect(typeof a.ctaTo).toBe('string');
    }
    expect(Array.isArray(res.body.recommendations)).toBe(true);
    for (const rec of res.body.recommendations) {
      expect(typeof rec.ctaTo).toBe('string');
      expect(rec.ctaTo.startsWith('/')).toBe(true);
    }
    expect(res.body.netWorthFX).toBeDefined();
    expect(res.body.netWorthFX.netWorth.ngn).toBe(res.body.netPosition);
    expect(Array.isArray(res.body.topPropertyByReturn)).toBe(true);
    expect(res.body.complianceDigest).toBeDefined();
    expect(typeof res.body.complianceDigest.outstandingCount).toBe('number');
    expect(Array.isArray(res.body.complianceDigest.items)).toBe(true);
    expect(res.body.dataQuality).toBeDefined();
    expect(typeof res.body.dataQuality.allClear).toBe('boolean');
    expect(Array.isArray(res.body.dataQuality.items)).toBe(true);
    for (const q of res.body.dataQuality.items) {
      expect(typeof q.id).toBe('string');
      expect(typeof q.label).toBe('string');
      expect(typeof q.count).toBe('number');
      expect(q.href.startsWith('/')).toBe(true);
    }
  });

  it('GET /api/dashboard/risk-heatmap returns cells with ctaTo', async () => {
    const token = await loginAs('analyst');
    const res = await request(app).get('/api/dashboard/risk-heatmap').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.cells)).toBe(true);
    for (const cell of res.body.cells) {
      expect(typeof cell.ctaTo).toBe('string');
      expect(cell.ctaTo.startsWith('/')).toBe(true);
    }
  });

  it('GET /api/treasury returns overview object', async () => {
    const token = await loginAs('lead');
    const res = await request(app).get('/api/treasury').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.totals).toBeDefined();
    expect(Array.isArray(res.body.items)).toBe(true);
    for (const row of res.body.items) {
      expect(typeof row.ctaTo).toBe('string');
      expect(row.ctaTo.startsWith('/')).toBe(true);
    }
  });

  it('GET /api/snapshots returns items array', async () => {
    const token = await loginAs('viewer');
    const res = await request(app).get('/api/snapshots').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('GET /api/data/master_assets/options and next-asset-id', async () => {
    const token = await loginAs('lead');
    const opts = await request(app).get('/api/data/master_assets/options').set('Authorization', `Bearer ${token}`);
    expect(opts.status).toBe(200);
    expect(Array.isArray(opts.body.categories)).toBe(true);
    expect(opts.body.categories.length).toBeGreaterThan(0);

    const next = await request(app)
      .get('/api/data/master_assets/next-asset-id')
      .query({ category: 'Real Estate' })
      .set('Authorization', `Bearer ${token}`);
    expect(next.status).toBe(200);
    expect(String(next.body.asset_id)).toMatch(/^OOI-RE-\d{4}$/);
  });

  it('POST and PUT /api/data/master_assets for lead', async () => {
    const token = await loginAs('lead');
    const created = await request(app)
      .post('/api/data/master_assets')
      .set('Authorization', `Bearer ${token}`)
      .send({
        asset_id: 'SMOKE-UI-ASSET',
        asset_name: 'Portal-created asset',
        asset_category: 'Other',
        jurisdiction: 'NG',
        net_value: 1000,
        currency: 'NGN',
      });
    expect(created.status).toBe(201);
    expect(created.body.asset_id).toBe('SMOKE-UI-ASSET');

    const updated = await request(app)
      .put(`/api/data/master_assets/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ asset_name: 'Portal-updated asset', net_value: 2000 });
    expect(updated.status).toBe(200);
    expect(updated.body.asset_name).toBe('Portal-updated asset');
    expect(updated.body.net_value).toBe(2000);

    const viewer = await loginAs('viewer');
    const denied = await request(app)
      .post('/api/data/master_assets')
      .set('Authorization', `Bearer ${viewer}`)
      .send({ asset_id: 'X', asset_name: 'Y' });
    expect(denied.status).toBe(403);
  });

  it('GET /api/data/cash_banking and real_estate options; POST/PUT rows', async () => {
    const token = await loginAs('lead');
    const cashOpts = await request(app).get('/api/data/cash_banking/options').set('Authorization', `Bearer ${token}`);
    expect(cashOpts.status).toBe(200);
    expect(Array.isArray(cashOpts.body.currencies)).toBe(true);

    const cash = await request(app)
      .post('/api/data/cash_banking')
      .set('Authorization', `Bearer ${token}`)
      .send({
        account_id: 'SMOKE-CASH-1',
        bank_name: 'Test Bank',
        currency: 'NGN',
        current_balance: 50000,
      });
    expect(cash.status).toBe(201);
    const cashUp = await request(app)
      .put(`/api/data/cash_banking/${cash.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ current_balance: 55000 });
    expect(cashUp.status).toBe(200);
    expect(cashUp.body.current_balance).toBe(55000);

    const reOpts = await request(app).get('/api/data/real_estate/options').set('Authorization', `Bearer ${token}`);
    expect(reOpts.status).toBe(200);
    expect(Array.isArray(reOpts.body.countries)).toBe(true);

    const re = await request(app)
      .post('/api/data/real_estate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        property_id: 'SMOKE-RE-1',
        name_address: 'Smoke test property',
        country: 'NG',
        current_value: 1e7,
        currency: 'NGN',
      });
    expect(re.status).toBe(201);
    const reUp = await request(app)
      .put(`/api/data/real_estate/${re.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title_held: 'Yes' });
    expect(reUp.status).toBe(200);
    expect(reUp.body.title_held).toBe('Yes');
  });

  it('GET /api/entities/exposure aggregates by entity', async () => {
    const token = await loginAs('analyst');
    const res = await request(app).get('/api/entities/exposure').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(typeof res.body.itemCount).toBe('number');
  });

  it('public_securities and liabilities CRUD; soft delete and restore', async () => {
    const token = await loginAs('lead');
    const psOpts = await request(app).get('/api/data/public_securities/options').set('Authorization', `Bearer ${token}`);
    expect(psOpts.status).toBe(200);
    expect(Array.isArray(psOpts.body.currencies)).toBe(true);

    const ps = await request(app)
      .post('/api/data/public_securities')
      .set('Authorization', `Bearer ${token}`)
      .send({
        investment_name: 'Smoke Holdings Ltd',
        ticker: 'SMOKE-PS',
        owner_entity: 'Test LLC',
        market_value: 100000,
        currency: 'NGN',
      });
    expect(ps.status).toBe(201);

    const del = await request(app)
      .delete(`/api/data/public_securities/${ps.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);

    const archived = await request(app)
      .get('/api/data/public_securities?archived=1')
      .set('Authorization', `Bearer ${token}`);
    expect(archived.status).toBe(200);
    expect(archived.body.items.some((r) => r.id === ps.body.id)).toBe(true);

    const restore = await request(app)
      .post(`/api/data/public_securities/${ps.body.id}/restore`)
      .set('Authorization', `Bearer ${token}`);
    expect(restore.status).toBe(200);
    expect(restore.body.id).toBe(ps.body.id);
    expect(restore.body.deleted_at).toBeFalsy();

    const liabOpts = await request(app).get('/api/data/liabilities/options').set('Authorization', `Bearer ${token}`);
    expect(liabOpts.status).toBe(200);

    const liab = await request(app)
      .post('/api/data/liabilities')
      .set('Authorization', `Bearer ${token}`)
      .send({
        facility_id: 'SMOKE-LIAB-1',
        borrower_entity: 'Test LLC',
        outstanding_balance: 25000,
        currency: 'NGN',
      });
    expect(liab.status).toBe(201);
    const liabUp = await request(app)
      .put(`/api/data/liabilities/${liab.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ outstanding_balance: 20000 });
    expect(liabUp.status).toBe(200);
    expect(liabUp.body.outstanding_balance).toBe(20000);
  });

  it('compliance calendar CRUD and digest', async () => {
    const lead = await loginAs('lead');
    const created = await request(app)
      .post('/api/compliance/calendar')
      .set('Authorization', `Bearer ${lead}`)
      .send({
        title: 'Annual KYC refresh',
        category: 'KYC',
        entity: 'Test LLC',
        dueDate: '2020-01-01',
        recurrence: 'annual',
        owner: 'Analyst',
      });
    expect(created.status).toBe(201);
    expect(created.body.title).toBe('Annual KYC refresh');
    expect(created.body.overdue).toBe(true);

    const digest = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${lead}`);
    expect(digest.status).toBe(200);
    expect(digest.body.complianceCalendar.overdueCount).toBeGreaterThanOrEqual(1);

    const complete = await request(app)
      .post(`/api/compliance/calendar/${created.body.id}/complete`)
      .set('Authorization', `Bearer ${lead}`);
    expect(complete.status).toBe(200);
    expect(complete.body.status).toBe('pending');
    expect(complete.body.dueDate).toMatch(/^2021-/);

    const del = await request(app)
      .delete(`/api/compliance/calendar/${created.body.id}`)
      .set('Authorization', `Bearer ${lead}`);
    expect(del.status).toBe(200);
  });

  it('change request queue: analyst submit, lead approve', async () => {
    const analyst = await loginAs('analyst');
    const blocked = await request(app)
      .post('/api/data/master_assets')
      .set('Authorization', `Bearer ${analyst}`)
      .send({ asset_id: 'BLOCKED', asset_name: 'Should fail' });
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('approval_required');

    const submitted = await request(app)
      .post('/api/change-requests')
      .set('Authorization', `Bearer ${analyst}`)
      .send({
        table: 'master_assets',
        operation: 'create',
        payload: { asset_id: 'CR-ASSET-1', asset_name: 'Queued asset', net_value: 100 },
      });
    expect(submitted.status).toBe(201);
    expect(submitted.body.status).toBe('pending');

    const lead = await loginAs('lead');
    const list = await request(app)
      .get('/api/change-requests?status=pending')
      .set('Authorization', `Bearer ${lead}`);
    expect(list.status).toBe(200);
    expect(list.body.items.some((r) => r.id === submitted.body.id)).toBe(true);

    const approved = await request(app)
      .post(`/api/change-requests/${submitted.body.id}/approve`)
      .set('Authorization', `Bearer ${lead}`)
      .send({ comment: 'Looks good' });
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe('approved');

    const row = await request(app)
      .get('/api/data/master_assets?limit=100')
      .set('Authorization', `Bearer ${lead}`);
    expect(row.body.items.some((r) => r.asset_id === 'CR-ASSET-1')).toBe(true);
  });

  it('change request queue: liabilities register blocked for analyst direct write', async () => {
    const analyst = await loginAs('analyst');
    const blocked = await request(app)
      .post('/api/data/liabilities')
      .set('Authorization', `Bearer ${analyst}`)
      .send({ facility_id: 'BLOCKED-L', lender: 'Should fail' });
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('approval_required');

    const submitted = await request(app)
      .post('/api/change-requests')
      .set('Authorization', `Bearer ${analyst}`)
      .send({
        table: 'liabilities',
        operation: 'create',
        payload: { facility_id: 'CR-LIAB-1', lender: 'Queued lender', outstanding_balance: 50000 },
      });
    expect(submitted.status).toBe(201);

    const lead = await loginAs('lead');
    const approved = await request(app)
      .post(`/api/change-requests/${submitted.body.id}/approve`)
      .set('Authorization', `Bearer ${lead}`)
      .send({});
    expect(approved.status).toBe(200);

    const row = await request(app)
      .get('/api/data/liabilities?limit=100')
      .set('Authorization', `Bearer ${lead}`);
    expect(row.body.items.some((r) => r.facility_id === 'CR-LIAB-1')).toBe(true);
  });

  it('GET /api/tasks/inbox returns unified task list', async () => {
    const token = await loginAs('analyst');
    const res = await request(app).get('/api/tasks/inbox').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.summary.total).toBe('number');
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('GET /api/tasks/digest/preview returns text', async () => {
    const token = await loginAs('lead');
    const res = await request(app).get('/api/tasks/digest/preview').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.text).toBe('string');
    expect(res.body.text).toMatch(/weekly digest/i);
  });

  it('POST /api/tasks/digest/send requires lead and reports SMTP status', async () => {
    const analyst = await loginAs('analyst');
    const denied = await request(app)
      .post('/api/tasks/digest/send')
      .set('Authorization', `Bearer ${analyst}`)
      .send({});
    expect(denied.status).toBe(403);

    const lead = await loginAs('lead');
    const res = await request(app)
      .post('/api/tasks/digest/send')
      .set('Authorization', `Bearer ${lead}`)
      .send({ baseUrl: 'http://localhost:5173' });
    expect([200, 503]).toContain(res.status);
  });

  it('GET /api/snapshots/compare returns delta when two snapshots exist', async () => {
    const lead = await loginAs('lead');
    await request(app).post('/api/snapshots/capture').set('Authorization', `Bearer ${lead}`);
    await request(app).post('/api/snapshots/capture').set('Authorization', `Bearer ${lead}`);
    const res = await request(app).get('/api/snapshots/compare').set('Authorization', `Bearer ${lead}`);
    expect(res.status).toBe(200);
    expect(res.body.prior).toBeDefined();
    expect(res.body.current).toBeDefined();
    expect(typeof res.body.delta.netPosition).toBe('number');
  });

  it('GET /api/export/master_assets returns CSV', async () => {
    const token = await loginAs('analyst');
    const res = await request(app).get('/api/export/master_assets').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(String(res.headers['content-type'] || '')).toMatch(/text\/csv/);
    const text = res.text;
    expect(text.startsWith('\ufeff') || /id|asset_id/i.test(text)).toBe(true);
  });

  it('POST /api/import/confirm returns backup metadata (skipped for in-memory DB)', async () => {
    const token = await loginAs('lead');
    const buf = minimalImportXlsxBuffer();
    const res = await request(app)
      .post('/api/import/confirm')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buf, 'smoke-import.xlsx');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.summary).toBeDefined();
    expect(res.body.backup).toBeDefined();
    expect(res.body.backup.ok).toBe(true);
    expect(res.body.backup.skipped).toBe(true);
    expect(res.body.backup.reason).toBe('memory_or_empty_path');
  });

  it('GET /api/admin/app-users forbidden for analyst', async () => {
    const token = await loginAs('analyst');
    const res = await request(app).get('/api/admin/app-users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('GET /api/admin/app-users rejected for lead when not sqlite auth', async () => {
    const token = await loginAs('lead');
    const res = await request(app).get('/api/admin/app-users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(String(res.body.error || '')).toMatch(/sqlite/i);
  });

  it('document vault: upload, list, download, delete', async () => {
    const lead = await loginAs('lead');
    const chairman = await loginAs('chairman');

    const track = await request(app).get('/api/documents/tracker?limit=5').set('Authorization', `Bearer ${lead}`);
    expect(track.status).toBe(200);
    expect(track.body.items.length).toBeGreaterThan(0);
    const docId = track.body.items[0].id;

    const pdfBuf = Buffer.from('%PDF-1.4\n% smoke vault file\n');
    const uploadRes = await request(app)
      .post(`/api/documents/${docId}/vault`)
      .set('Authorization', `Bearer ${lead}`)
      .field('note', 'Smoke test evidence')
      .attach('file', pdfBuf, { filename: 'evidence.pdf', contentType: 'application/pdf' });
    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.file.id).toBeTruthy();

    const list = await request(app).get(`/api/documents/${docId}/vault`).set('Authorization', `Bearer ${chairman}`);
    expect(list.status).toBe(200);
    expect(list.body.files.length).toBeGreaterThanOrEqual(1);

    const fileId = uploadRes.body.file.id;
    const dl = await request(app)
      .get(`/api/vault/files/${fileId}/download`)
      .set('Authorization', `Bearer ${chairman}`);
    expect(dl.status).toBe(200);
    expect(Number(dl.headers['content-length'] || 0)).toBeGreaterThan(0);

    const chairUpload = await request(app)
      .post(`/api/documents/${docId}/vault`)
      .set('Authorization', `Bearer ${chairman}`)
      .attach('file', pdfBuf, { filename: 'blocked.pdf', contentType: 'application/pdf' });
    expect(chairUpload.status).toBe(403);

    const del = await request(app).delete(`/api/vault/files/${fileId}`).set('Authorization', `Bearer ${lead}`);
    expect(del.status).toBe(200);

    const after = await request(app).get(`/api/documents/${docId}/vault`).set('Authorization', `Bearer ${lead}`);
    expect(after.body.files.length).toBe(0);
  });

  it('POST /api/communications logs entry (mail skipped without SMTP)', async () => {
    const token = await loginAs('lead');
    const res = await request(app)
      .post('/api/communications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        partyAName: 'Family Office Lead',
        partyBName: 'External Adviser',
        partyAEmail: 'lead@example.com',
        partyBEmail: 'adviser@example.com',
        channel: 'email',
        subject: 'Smoke test',
        body: 'Follow-up notes from smoke test.',
        notifyParty: 'both',
      });
    expect(res.status).toBe(201);
    expect(res.body.item.id).toBeTruthy();
    expect(res.body.mail).toBeDefined();
  });

  it('MFA forced enrollment on first sqlite login when FAMILY_OFFICE_MFA_REQUIRED=1', async () => {
    const prevAuth = process.env.FAMILY_OFFICE_AUTH;
    const prevMfa = process.env.FAMILY_OFFICE_MFA_REQUIRED;
    process.env.FAMILY_OFFICE_AUTH = 'sqlite';
    process.env.FAMILY_OFFICE_MFA_REQUIRED = '1';
    const testUser = 'mfa-enroll-smoke';
    const testPassword = 'SmokeTestMfa2';
    try {
      db.prepare('DELETE FROM app_users WHERE lower(username) = lower(?)').run(testUser);
      db.prepare(
        'INSERT INTO app_users (username, display_name, role, password_scrypt) VALUES (?, ?, ?, ?)'
      ).run(testUser, 'Enroll Smoke', 'analyst', hashPasswordToScrypt(testPassword));

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: testUser, password: testPassword });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.enrollmentRequired).toBe(true);
      expect(loginRes.body.enrollmentToken).toBeTruthy();

      const setup = await request(app)
        .post('/api/auth/mfa/enrollment/setup')
        .send({ enrollmentToken: loginRes.body.enrollmentToken });
      expect(setup.status).toBe(200);
      expect(setup.body.secret).toBeTruthy();

      const code = totpNow(setup.body.secret);
      const enable = await request(app)
        .post('/api/auth/mfa/enrollment/enable')
        .send({ enrollmentToken: loginRes.body.enrollmentToken, code });
      expect(enable.status).toBe(200);
      expect(enable.body.token).toBeTruthy();
      expect(enable.body.recoveryCodes?.length).toBeGreaterThan(0);
    } finally {
      db.prepare('DELETE FROM app_users WHERE lower(username) = lower(?)').run(testUser);
      if (prevAuth === undefined) delete process.env.FAMILY_OFFICE_AUTH;
      else process.env.FAMILY_OFFICE_AUTH = prevAuth;
      if (prevMfa === undefined) delete process.env.FAMILY_OFFICE_MFA_REQUIRED;
      else process.env.FAMILY_OFFICE_MFA_REQUIRED = prevMfa;
    }
  });

  it('MFA login flow for sqlite lead/analyst', async () => {
    const prevAuth = process.env.FAMILY_OFFICE_AUTH;
    process.env.FAMILY_OFFICE_AUTH = 'sqlite';
    const testUser = 'mfa-smoke-analyst';
    const testPassword = 'SmokeTestMfa1';
    try {
      db.prepare('DELETE FROM app_users WHERE lower(username) = lower(?)').run(testUser);
      db.prepare(
        'INSERT INTO app_users (username, display_name, role, password_scrypt) VALUES (?, ?, ?, ?)'
      ).run(testUser, 'MFA Smoke Analyst', 'analyst', hashPasswordToScrypt(testPassword));

      const setup = beginMfaSetup(testUser);
      expect(setup.ok).toBe(true);
      const code = totpNow(setup.secret);
      const enabled = confirmMfaSetup(testUser, code);
      expect(enabled.ok).toBe(true);
      expect(enabled.recoveryCodes?.length).toBeGreaterThan(0);

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: testUser, password: testPassword });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.mfaRequired).toBe(true);
      expect(loginRes.body.mfaToken).toBeTruthy();
      expect(loginRes.body.token).toBeFalsy();

      const badMfa = await request(app)
        .post('/api/auth/mfa/verify')
        .send({ mfaToken: loginRes.body.mfaToken, code: '000000' });
      expect(badMfa.status).toBe(401);

      const goodCode = totpNow(setup.secret);
      const mfaRes = await request(app)
        .post('/api/auth/mfa/verify')
        .send({ mfaToken: loginRes.body.mfaToken, code: goodCode });
      expect(mfaRes.status).toBe(200);
      expect(mfaRes.body.token).toBeTruthy();
      expect(mfaRes.body.user.username).toBe(testUser);

      const me = await request(app).get('/api/me').set('Authorization', `Bearer ${mfaRes.body.token}`);
      expect(me.status).toBe(200);
      expect(me.body.flags.mfaEnabled).toBe(true);
    } finally {
      db.prepare('DELETE FROM app_users WHERE lower(username) = lower(?)').run(testUser);
      if (prevAuth === undefined) delete process.env.FAMILY_OFFICE_AUTH;
      else process.env.FAMILY_OFFICE_AUTH = prevAuth;
    }
  });
});
