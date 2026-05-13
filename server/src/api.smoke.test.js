import { describe, it, expect } from 'vitest';
import request from 'supertest';
import XLSX from 'xlsx';
import { app } from './serverApp.js';

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
    expect(Array.isArray(res.body.recommendations)).toBe(true);
  });

  it('GET /api/treasury returns overview object', async () => {
    const token = await loginAs('lead');
    const res = await request(app).get('/api/treasury').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.totals).toBeDefined();
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('GET /api/snapshots returns items array', async () => {
    const token = await loginAs('viewer');
    const res = await request(app).get('/api/snapshots').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
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
});
