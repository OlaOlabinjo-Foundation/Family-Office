import { db } from './db.js';

const MS_DAY = 86400000;

function daysBetween(a, b) {
  return Math.floor((a.getTime() - b.getTime()) / MS_DAY);
}

function parseIsoDate(s) {
  if (!s || typeof s !== 'string') return null;
  const d = new Date(s.slice(0, 10) + 'T12:00:00Z');
  return Number.isNaN(d.getTime()) ? null : d;
}

function riskRank(level) {
  const l = String(level || '').toLowerCase();
  if (l.includes('critical')) return 4;
  if (l.includes('high')) return 3;
  if (l.includes('medium') || l.includes('moderate')) return 2;
  return 1;
}

function scoreToHealth(score) {
  return Math.max(0, Math.min(100, Math.round(100 - score)));
}

/** Cash row is in active treasury tracking (balances / policy / flows), not a blank template line */
function cashTreasuryTracked(c) {
  return (
    c.current_balance != null ||
    c.minimum_required_balance != null ||
    (c.average_monthly_outflow != null && Number(c.average_monthly_outflow) > 0) ||
    (c.last_reconciled_date != null && String(c.last_reconciled_date).trim() !== '')
  );
}

/** @param {import('better-sqlite3').Database} database */
export function computeDashboard(database = db) {
  const master = database.prepare('SELECT * FROM master_assets').all();
  const cash = database.prepare('SELECT * FROM cash_banking').all();
  const liab = database.prepare('SELECT * FROM liabilities').all();
  const docs = database.prepare('SELECT * FROM documents').all();

  let totalAssets = 0;
  for (const m of master) {
    const nv =
      m.net_value ??
      (m.current_value != null ? m.current_value - (m.associated_debt || 0) : null);
    if (nv != null && Number.isFinite(nv)) totalAssets += nv;
  }

  let totalLiabilities = 0;
  for (const L of liab) {
    if (L.outstanding_balance != null && Number.isFinite(L.outstanding_balance)) {
      totalLiabilities += L.outstanding_balance;
    }
  }

  let cashPosition = 0;
  for (const c of cash) {
    if (c.current_balance != null && Number.isFinite(c.current_balance)) cashPosition += c.current_balance;
  }

  const netPosition = totalAssets - totalLiabilities;
  const liquidityRatio = totalAssets > 0 ? cashPosition / totalAssets : 0;

  const byCategory = {};
  for (const m of master) {
    const cat = m.asset_category || 'Uncategorised';
    const nv =
      m.net_value ??
      (m.current_value != null ? m.current_value - (m.associated_debt || 0) : 0);
    byCategory[cat] = (byCategory[cat] || 0) + (nv || 0);
  }

  const byCountry = {};
  for (const m of master) {
    const c = m.jurisdiction || m.country || 'Unknown';
    const nv =
      m.net_value ??
      (m.current_value != null ? m.current_value - (m.associated_debt || 0) : 0);
    byCountry[c] = (byCountry[c] || 0) + (nv || 0);
  }

  const now = new Date();
  let highRiskExposure = 0;
  for (const m of master) {
    if (riskRank(m.risk_level) >= 3) {
      const nv =
        m.net_value ??
        (m.current_value != null ? m.current_value - (m.associated_debt || 0) : 0);
      highRiskExposure += nv || 0;
    }
  }

  const riskSignals = buildRiskSignals(database, now);
  const decisionsRaw = buildDecisions(database, now, {
    totalAssets,
    cashPosition,
    liquidityRatio,
    byCategory
  });

  const actionRows = database.prepare('SELECT decision_id, status, resolved_at, resolved_by FROM decision_actions').all();
  const actionMap = new Map(actionRows.map((r) => [r.decision_id, r]));
  const decisions = decisionsRaw.map((d) => {
    const a = actionMap.get(d.id);
    if (a?.status === 'resolved') {
      return {
        ...d,
        status: 'resolved',
        resolvedAt: a.resolved_at,
        resolvedBy: a.resolved_by
      };
    }
    return { ...d, status: 'open' };
  });
  decisions.sort((x, y) => {
    if (x.status === y.status) return 0;
    return x.status === 'open' ? -1 : 1;
  });

  const openDecisions = decisions.filter((d) => d.status === 'open');
  const recommendations = buildRecommendations(openDecisions, riskSignals);

  const portfolioRiskScore = riskSignals.reduce((acc, r) => acc + r.weight * r.severity, 0);
  const healthScore = scoreToHealth(portfolioRiskScore);

  const pendingDecisions = openDecisions.length;
  const outstandingDocs = docs.filter((d) => {
    const st = String(d.status || '').toLowerCase();
    if (!(d.document_category || d.entity_asset)) return false;
    if (st.includes('complete') || st.includes('received')) return false;
    return st.includes('missing') || st.includes('pending') || st.includes('requested') || st === 'open';
  }).length;

  const snaps = database
    .prepare(
      `SELECT id, created_at, total_assets, total_liabilities, net_position, cash_position, liquidity_ratio, health_score
       FROM portfolio_snapshots ORDER BY id DESC LIMIT 2`
    )
    .all();

  let monthlyPortfolioMovement;
  if (snaps.length >= 2) {
    const latest = snaps[0];
    const prev = snaps[1];
    monthlyPortfolioMovement = {
      basis: 'snapshot_delta',
      priorAsOf: prev.created_at,
      currentAsOf: latest.created_at,
      netPositionChange: latest.net_position - prev.net_position,
      totalAssetsChange: latest.total_assets - prev.total_assets,
      totalLiabilitiesChange: latest.total_liabilities - prev.total_liabilities,
      cashPositionChange: latest.cash_position - prev.cash_position
    };
  } else if (snaps.length === 1) {
    monthlyPortfolioMovement = {
      basis: 'baseline',
      message: 'Baseline snapshot on file. Capture another after material book updates to see period-on-period movement.'
    };
  } else {
    monthlyPortfolioMovement = {
      basis: 'none',
      message: 'No snapshots yet. Taken on Excel import or from Portfolio snapshots.'
    };
  }

  const snapRows = database
    .prepare(
      `SELECT id, created_at, net_position, health_score FROM portfolio_snapshots ORDER BY id DESC LIMIT 24`
    )
    .all();
  const snapshotTrend = [...snapRows]
    .reverse()
    .map((r) => ({
      at: r.created_at,
      netPosition: r.net_position,
      healthScore: r.health_score
    }));

  return {
    brand: 'Ola Olabinjo Investment',
    asOf: now.toISOString(),
    totalNetWorth: netPosition,
    totalAssets,
    totalLiabilities,
    netPosition,
    cashPosition,
    monthlyPortfolioMovement,
    liquidityRatio,
    highRiskExposure,
    pendingDecisions,
    outstandingDocumentation: outstandingDocs,
    portfolioHealthScore: healthScore,
    allocation: Object.entries(byCategory).map(([name, value]) => ({ name, value })),
    countryExposure: Object.entries(byCountry).map(([name, value]) => ({ name, value })),
    riskSignals,
    decisions,
    recommendations,
    alerts: riskSignals.filter((r) => r.severity >= 3).slice(0, 12),
    snapshotTrend
  };
}

function buildRiskSignals(database, now) {
  const signals = [];
  const master = database.prepare('SELECT * FROM master_assets').all();
  const cash = database.prepare('SELECT * FROM cash_banking').all();
  const liab = database.prepare('SELECT * FROM liabilities').all();
  const docs = database.prepare('SELECT * FROM documents').all();

  const totalAssets = master.reduce((s, m) => {
    const nv =
      m.net_value ??
      (m.current_value != null ? m.current_value - (m.associated_debt || 0) : 0);
    return s + (nv || 0);
  }, 0);

  const byCategory = {};
  for (const m of master) {
    const cat = m.asset_category || 'Uncategorised';
    const nv =
      m.net_value ??
      (m.current_value != null ? m.current_value - (m.associated_debt || 0) : 0);
    byCategory[cat] = (byCategory[cat] || 0) + (nv || 0);
  }
  for (const [cat, val] of Object.entries(byCategory)) {
    const conc = totalAssets > 0 ? val / totalAssets : 0;
    if (conc > 0.6) {
      signals.push({
        id: `conc-${cat}`,
        category: 'Concentration',
        title: `High concentration in ${cat}`,
        detail: `${(conc * 100).toFixed(1)}% of portfolio`,
        severity: conc > 0.75 ? 4 : 3,
        level: conc > 0.75 ? 'Critical' : 'High',
        weight: 2
      });
    }
  }

  let cashPosition = 0;
  for (const c of cash) {
    if (c.current_balance != null && Number.isFinite(c.current_balance)) cashPosition += c.current_balance;
  }
  const liqRatio = totalAssets > 0 ? cashPosition / totalAssets : 0;
  if (liqRatio < 0.1 && totalAssets > 0) {
    signals.push({
      id: 'liq-low',
      category: 'Liquidity',
      title: 'Liquidity below 10% of portfolio',
      detail: `Cash / liquid balances imply ${(liqRatio * 100).toFixed(1)}% of gross assets`,
      severity: 3,
      level: 'High',
      weight: 2
    });
  }

  for (const m of master) {
    const d = parseIsoDate(m.last_valuation_date);
    if (d && daysBetween(now, d) > 365) {
      signals.push({
        id: `val-${m.asset_id}`,
        category: 'Valuation',
        title: `Valuation ageing: ${m.asset_name || m.asset_id}`,
        detail: 'Last valuation over 12 months ago',
        severity: 2,
        level: 'Medium',
        weight: 1
      });
    }
  }

  for (const c of cash) {
    if (!cashTreasuryTracked(c)) continue;
    const rec = parseIsoDate(c.last_reconciled_date);
    const days = rec ? daysBetween(now, rec) : 9999;
    if (!rec || days > 30) {
      signals.push({
        id: `rec-${c.account_id}`,
        category: 'Banking',
        title: `Account reconciliation: ${c.bank_name || ''} ${c.account_name || c.account_id}`,
        detail: !rec ? 'No reconciliation date recorded' : `Last reconciled ${days} days ago`,
        severity: !rec || days > 60 ? 3 : 2,
        level: !rec || days > 60 ? 'High' : 'Medium',
        weight: 1
      });
    }
    const bal = c.current_balance ?? 0;
    const minb = c.minimum_required_balance;
    if (minb != null && bal < minb) {
      signals.push({
        id: `bal-${c.account_id}`,
        category: 'Cash',
        title: `Below minimum balance: ${c.account_id}`,
        detail: 'Current balance under policy minimum',
        severity: 3,
        level: 'High',
        weight: 1.5
      });
    }
  }

  for (const L of liab) {
    const md = parseIsoDate(L.maturity_date);
    if (md) {
      const daysTo = daysBetween(md, now);
      if (daysTo >= 0 && daysTo <= 90) {
        signals.push({
          id: `mat-${L.facility_id || L.lender}`,
          category: 'Debt',
          title: `Facility maturity within 90 days`,
          detail: `${L.facility_type || 'Facility'} — ${L.lender || ''}`,
          severity: daysTo <= 30 ? 4 : 3,
          level: daysTo <= 30 ? 'Critical' : 'High',
          weight: 2
        });
      }
    }
  }

  for (const d of docs) {
    const st = String(d.status || '').toLowerCase();
    if (!(d.document_category || d.entity_asset)) continue;
    if (st.includes('complete') || st.includes('received')) continue;
    if (st.includes('missing') || st.includes('pending') || st.includes('requested') || st === 'open') {
      signals.push({
        id: `doc-${d.id || d.document_id || d.document_category}`,
        category: 'Documentation',
        title: `Document gap: ${d.document_category || 'General'}`,
        detail: d.entity_asset || d.notes || 'Review compliance tracker',
        severity: 2,
        level: 'Medium',
        weight: 0.8
      });
    }
  }

  const dedup = new Map();
  for (const s of signals) {
    if (!dedup.has(s.id)) dedup.set(s.id, s);
  }
  return [...dedup.values()].sort((a, b) => b.severity - a.severity);
}

function buildDecisions(database, now, ctx) {
  const items = [];
  const master = database.prepare('SELECT * FROM master_assets').all();
  const cash = database.prepare('SELECT * FROM cash_banking').all();
  const liab = database.prepare('SELECT * FROM liabilities').all();
  const docs = database.prepare('SELECT * FROM documents').all();
  const re = database.prepare('SELECT * FROM real_estate').all();

  for (const m of master) {
    const d = parseIsoDate(m.last_valuation_date);
    if (d && daysBetween(now, d) > 365) {
      items.push({
        id: `DEC-VAL-${m.asset_id}`,
        type: 'Valuation',
        priority: 'P1',
        title: 'Property / asset valuation overdue',
        recommendation: 'Commission an independent valuation and update the Master Asset Register.',
        owner: 'Family Office Lead',
        dueDate: new Date(now.getTime() + 14 * MS_DAY).toISOString().slice(0, 10),
        riskLevel: 'Medium',
        notes: m.asset_name || m.asset_id,
        status: 'open',
        source: 'Master Asset Register'
      });
    }
  }

  for (const row of re) {
    const titleOk = String(row.title_held || '').toLowerCase();
    if (titleOk === 'no' || titleOk === 'n') {
      items.push({
        id: `DEC-TITLE-${row.property_id || row.asset_id}`,
        type: 'Title',
        priority: 'P1',
        title: 'Title perfection incomplete',
        recommendation: 'Engage counsel to complete title perfection and upload evidence to the document vault.',
        owner: 'Family Office Lead',
        dueDate: new Date(now.getTime() + 21 * MS_DAY).toISOString().slice(0, 10),
        riskLevel: 'High',
        notes: row.name_address,
        status: 'open',
        source: 'Real Estate'
      });
    }
  }

  for (const c of cash) {
    if (!cashTreasuryTracked(c)) continue;
    const rec = parseIsoDate(c.last_reconciled_date);
    const days = rec ? daysBetween(now, rec) : 9999;
    if (!rec || days > 30) {
      items.push({
        id: `DEC-REC-${c.account_id}`,
        type: 'Reconciliation',
        priority: !rec || days > 60 ? 'P1' : 'P2',
        title: 'Bank reconciliation overdue',
        recommendation: 'Complete reconciliation and capture sign-off date in Cash & Banking.',
        owner: 'Analyst',
        dueDate: new Date(now.getTime() + 7 * MS_DAY).toISOString().slice(0, 10),
        riskLevel: !rec || days > 60 ? 'High' : 'Medium',
        notes: `${c.bank_name || ''} — ${c.account_name || c.account_id}`,
        status: 'open',
        source: 'Cash & Banking'
      });
    }
  }

  for (const L of liab) {
    const md = parseIsoDate(L.maturity_date);
    if (md) {
      const daysTo = daysBetween(md, now);
      if (daysTo >= 0 && daysTo <= 90) {
        items.push({
          id: `DEC-MAT-${L.facility_id || L.lender}`,
          type: 'Debt',
          priority: daysTo <= 30 ? 'P0' : 'P1',
          title: 'Debt maturity approaching',
          recommendation: 'Review refinance / repayment options with lender and update facility terms.',
          owner: 'Family Office Lead',
          dueDate: L.maturity_date,
          riskLevel: daysTo <= 30 ? 'Critical' : 'High',
          notes: L.borrower_entity,
          status: 'open',
          source: 'Liabilities'
        });
      }
    }
  }

  for (const d of docs) {
    const st = String(d.status || '').toLowerCase();
    if (st.includes('missing') || st.includes('requested')) {
      items.push({
        id: `DEC-DOC-${d.id}`,
        type: 'Compliance',
        priority: 'P2',
        title: 'Missing or incomplete compliance document',
        recommendation: 'Request document from counterparty and upload to secure storage with link.',
        owner: d.owner || 'Analyst',
        dueDate: new Date(now.getTime() + 10 * MS_DAY).toISOString().slice(0, 10),
        riskLevel: 'Medium',
        notes: `${d.document_category || ''} — ${d.entity_asset || ''}`,
        status: 'open',
        source: 'Document Tracker'
      });
    }
  }

  if (ctx.liquidityRatio < 0.1 && ctx.totalAssets > 0) {
    items.push({
      id: 'DEC-LIQ',
      type: 'Liquidity',
      priority: 'P1',
      title: 'Liquidity below policy threshold',
      recommendation: 'Review cash buffers, credit lines, and near-term liquidity needs with treasury.',
      owner: 'Family Office Lead',
      dueDate: new Date(now.getTime() + 14 * MS_DAY).toISOString().slice(0, 10),
      riskLevel: 'High',
      notes: 'Rule: liquidity < 10% of portfolio value',
      status: 'open',
      source: 'Command Centre'
    });
  }

  const topCat = Object.entries(
    master.reduce((acc, m) => {
      const cat = m.asset_category || 'Other';
      const nv =
        m.net_value ??
        (m.current_value != null ? m.current_value - (m.associated_debt || 0) : 0);
      acc[cat] = (acc[cat] || 0) + (nv || 0);
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1])[0];
  if (topCat && ctx.totalAssets > 0 && topCat[1] / ctx.totalAssets > 0.6) {
    items.push({
      id: 'DEC-CONC',
      type: 'Concentration',
      priority: 'P2',
      title: 'Concentration risk elevated',
      recommendation: `Consider diversification away from ${topCat[0]} or introduce hedging / staged exits.`,
      owner: 'Chairman / Principal',
      dueDate: new Date(now.getTime() + 30 * MS_DAY).toISOString().slice(0, 10),
      riskLevel: 'High',
      notes: `${topCat[0]} represents ${((topCat[1] / ctx.totalAssets) * 100).toFixed(1)}% of assets`,
      status: 'open',
      source: 'Asset Intelligence'
    });
  }

  const dedup = new Map();
  for (const it of items) {
    if (!dedup.has(it.id)) dedup.set(it.id, it);
  }
  return [...dedup.values()];
}

function buildRecommendations(decisions, riskSignals) {
  const recs = [];
  for (const d of decisions.slice(0, 20)) {
    recs.push({
      id: `NBA-${d.id}`,
      headline: d.title,
      body: d.recommendation,
      priority: d.priority,
      category: d.type,
      confidence: d.riskLevel === 'Critical' ? 0.95 : d.riskLevel === 'High' ? 0.88 : 0.78
    });
  }
  for (const r of riskSignals.slice(0, 10)) {
    if (recs.length >= 24) break;
    recs.push({
      id: `NBA-${r.id}`,
      headline: r.title,
      body: r.detail,
      priority: r.severity >= 3 ? 'P1' : 'P2',
      category: r.category,
      confidence: 0.72
    });
  }
  return recs;
}

export function getRiskHeatmap(database = db) {
  const signals = buildRiskSignals(database, new Date());
  return {
    levels: ['Low', 'Medium', 'High', 'Critical'],
    cells: signals.map((s) => ({
      id: s.id,
      axisX: s.category,
      axisY: s.title.slice(0, 40),
      value: s.severity,
      level: s.level
    }))
  };
}
