import { db } from './db.js';
import { buildComplianceCalendarDigest } from './complianceCalendar.js';
import { isOutstandingDocumentRow } from './documentFilters.js';
import { ctaForRiskContext } from './riskCta.js';
import { FX_NGN_PER_USD, FX_NGN_PER_GBP, FX_NGN_PER_EUR } from './config.js';

const MS_DAY = 86400000;

/** @param {number} ngn @param {number} ngnPerUnit */
function ngnToForeign(ngn, ngnPerUnit) {
  const n = Number(ngn);
  if (!Number.isFinite(n) || !Number.isFinite(ngnPerUnit) || ngnPerUnit <= 0) return 0;
  return n / ngnPerUnit;
}

/**
 * @param {number} totalAssetsNgn
 * @param {number} totalLiabilitiesNgn
 * @param {number} netNgn
 */
function buildNetWorthFxSnapshot(totalAssetsNgn, totalLiabilitiesNgn, netNgn) {
  return {
    baseCurrency: 'NGN',
    ratesIndicative: {
      ngnPerUsd: FX_NGN_PER_USD,
      ngnPerGbp: FX_NGN_PER_GBP,
      ngnPerEur: FX_NGN_PER_EUR,
      disclaimer:
        'Indicative FX only: the operational book is in NGN. USD, GBP, and EUR amounts use configurable NGN-per-unit rates (env FX_NGN_PER_USD, FX_NGN_PER_GBP, FX_NGN_PER_EUR).'
    },
    grossAssets: {
      ngn: totalAssetsNgn,
      usd: ngnToForeign(totalAssetsNgn, FX_NGN_PER_USD),
      gbp: ngnToForeign(totalAssetsNgn, FX_NGN_PER_GBP),
      eur: ngnToForeign(totalAssetsNgn, FX_NGN_PER_EUR)
    },
    totalLiabilities: {
      ngn: totalLiabilitiesNgn,
      usd: ngnToForeign(totalLiabilitiesNgn, FX_NGN_PER_USD),
      gbp: ngnToForeign(totalLiabilitiesNgn, FX_NGN_PER_GBP),
      eur: ngnToForeign(totalLiabilitiesNgn, FX_NGN_PER_EUR)
    },
    netWorth: {
      ngn: netNgn,
      usd: ngnToForeign(netNgn, FX_NGN_PER_USD),
      gbp: ngnToForeign(netNgn, FX_NGN_PER_GBP),
      eur: ngnToForeign(netNgn, FX_NGN_PER_EUR)
    }
  };
}

/**
 * Real estate rows ranked by implied return (current vs purchase) when purchase exists; otherwise by book value.
 * @param {import('better-sqlite3').Database} database
 */
function buildTopPropertyByReturn(database, limit = 6) {
  let rows;
  try {
    rows = database.prepare('SELECT * FROM real_estate').all();
  } catch {
    return [];
  }
  const enriched = [];
  for (const r of rows) {
    const cv = r.current_value != null ? Number(r.current_value) : NaN;
    if (!Number.isFinite(cv) || cv <= 0) continue;
    const pp = r.purchase_price != null ? Number(r.purchase_price) : NaN;
    const hasPurchase = Number.isFinite(pp) && pp > 0;
    const impliedReturnPct = hasPurchase ? ((cv - pp) / pp) * 100 : null;
    enriched.push({ r, cv, purchasePriceNgn: hasPurchase ? pp : null, impliedReturnPct });
  }
  enriched.sort((a, b) => {
    const aHas = a.impliedReturnPct != null;
    const bHas = b.impliedReturnPct != null;
    if (aHas && bHas) return b.impliedReturnPct - a.impliedReturnPct;
    if (aHas) return -1;
    if (bHas) return 1;
    return b.cv - a.cv;
  });
  return enriched.slice(0, limit).map(({ r, cv, purchasePriceNgn, impliedReturnPct }) => ({
    id: r.id,
    name: (r.name_address && String(r.name_address).trim()) || r.property_id || `Property #${r.id}`,
    country: r.country || '—',
    propertyType: r.property_type || '—',
    currentValueNgn: cv,
    purchasePriceNgn,
    impliedReturnPct,
    riskLevel: r.risk_level || '—',
    propertyPurpose: r.property_purpose || null
  }));
}

/**
 * Top holdings for chairman executive spotlight cards.
 * @param {import('better-sqlite3').Database} database
 */
function buildChairmanSpotlights(database) {
  const propertyRows = buildTopPropertyByReturn(database, 1);
  const property = propertyRows[0]
    ? {
        kind: 'property',
        id: propertyRows[0].id,
        title: propertyRows[0].name,
        subtitle: propertyRows[0].country,
        valueNgn: propertyRows[0].currentValueNgn,
        trendLabel:
          propertyRows[0].impliedReturnPct != null
            ? `Value ${propertyRows[0].impliedReturnPct >= 0 ? 'up' : 'down'} ${Math.abs(propertyRows[0].impliedReturnPct).toFixed(1)}%`
            : 'Book value',
        href: '/assets',
        riskLevel: propertyRows[0].riskLevel
      }
    : null;

  const peCandidates = [];
  try {
    for (const r of database.prepare('SELECT * FROM private_investments').all()) {
      const v = r.latest_valuation != null ? Number(r.latest_valuation) : NaN;
      if (!Number.isFinite(v) || v <= 0) continue;
      peCandidates.push({
        kind: 'private_equity',
        id: r.id,
        title: (r.investment_name && String(r.investment_name).trim()) || r.asset_id || `Investment #${r.id}`,
        subtitle: r.country || r.investment_type || 'Private',
        valueNgn: v,
        trendLabel: r.investment_type || 'Private investment',
        href: '/assets',
        riskLevel: r.risk_level || '—'
      });
    }
  } catch {
    /* table optional */
  }
  try {
    for (const r of database.prepare('SELECT * FROM public_securities').all()) {
      const v = r.market_value != null ? Number(r.market_value) : NaN;
      if (!Number.isFinite(v) || v <= 0) continue;
      peCandidates.push({
        kind: 'securities',
        id: r.id,
        title: (r.investment_name && String(r.investment_name).trim()) || r.ticker || `Holding #${r.id}`,
        subtitle: r.country || r.sector || 'Listed',
        valueNgn: v,
        trendLabel: r.ticker ? String(r.ticker) : 'Public securities',
        href: '/assets',
        riskLevel: r.risk_level || '—'
      });
    }
  } catch {
    /* ignore */
  }
  peCandidates.sort((a, b) => b.valueNgn - a.valueNgn);
  const privateEquity = peCandidates[0] || null;

  let liquidAccount = null;
  try {
    const cashRows = database
      .prepare('SELECT * FROM cash_banking WHERE current_balance IS NOT NULL ORDER BY current_balance DESC LIMIT 1')
      .all();
    const c = cashRows[0];
    if (c && Number(c.current_balance) > 0) {
      liquidAccount = {
        kind: 'cash',
        id: c.id,
        title: (c.bank_name && String(c.bank_name).trim()) || c.account_name || `Account #${c.id}`,
        subtitle: c.owner_entity || c.currency || 'Cash',
        valueNgn: Number(c.current_balance),
        trendLabel: c.account_type || 'Bank account',
        href: '/treasury',
        riskLevel: c.risk_level || '—'
      };
    }
  } catch {
    /* ignore */
  }

  if (!liquidAccount) {
    const master = database.prepare('SELECT * FROM master_assets').all();
    let best = null;
    for (const m of master) {
      const liq = String(m.liquidity || '').toLowerCase();
      if (!liq.includes('liquid') && !liq.includes('cash')) continue;
      const nv =
        m.net_value ??
        (m.current_value != null ? m.current_value - (m.associated_debt || 0) : 0);
      if (!Number.isFinite(nv) || nv <= 0) continue;
      if (!best || nv > best.valueNgn) {
        best = {
          kind: 'liquid_asset',
          id: m.id,
          title: (m.asset_name && String(m.asset_name).trim()) || m.asset_id || `Asset #${m.id}`,
          subtitle: m.asset_category || 'Liquid',
          valueNgn: nv,
          trendLabel: m.liquidity || 'Liquid book line',
          href: '/treasury',
          riskLevel: m.risk_level || '—'
        };
      }
    }
    liquidAccount = best;
  }

  return { property, privateEquity, liquidAccount };
}

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

function dataQualitySeverityRank(severity) {
  if (severity === 'high') return 3;
  if (severity === 'medium') return 2;
  return 1;
}

/**
 * Actionable checklist for Command Centre — each item links to the screen that fixes it.
 * @param {import('better-sqlite3').Database} database
 * @param {Date} now
 * @param {{ openDecisions: number }} ctx
 */
function buildDataQualityChecklist(database, now, ctx) {
  const master = database.prepare('SELECT * FROM master_assets').all();
  const cash = database.prepare('SELECT * FROM cash_banking').all();
  const docs = database.prepare('SELECT * FROM documents').all();
  /** @type {{ id: string; label: string; count: number; href: string; severity: 'high' | 'medium' | 'low' }[]} */
  const items = [];

  if (master.length === 0) {
    items.push({
      id: 'empty_register',
      label: 'Master register is empty — load the workbook',
      count: 1,
      href: '/import',
      severity: 'high',
    });
  }

  let staleValuation = 0;
  for (const m of master) {
    const d = parseIsoDate(m.last_valuation_date);
    if (!d || daysBetween(now, d) > 365) staleValuation++;
  }
  if (staleValuation > 0) {
    items.push({
      id: 'stale_valuation',
      label: 'Assets with missing or overdue valuation (>12 months)',
      count: staleValuation,
      href: '/data/master',
      severity: staleValuation > 3 ? 'high' : 'medium',
    });
  }

  let outstanding = 0;
  let unreviewedOutstanding = 0;
  for (const d of docs) {
    if (!(d.document_category || d.entity_asset)) continue;
    if (!isOutstandingDocumentRow(d)) continue;
    outstanding++;
    if (!d.reviewed_at) unreviewedOutstanding++;
  }
  if (outstanding > 0) {
    items.push({
      id: 'outstanding_docs',
      label: 'Outstanding compliance documents',
      count: outstanding,
      href: '/documents?outstanding=1',
      severity: outstanding > 10 ? 'high' : 'medium',
    });
  }
  if (unreviewedOutstanding > 0) {
    items.push({
      id: 'unreviewed_docs',
      label: 'Outstanding docs not yet portal-reviewed',
      count: unreviewedOutstanding,
      href: '/documents?outstanding=1',
      severity: 'medium',
    });
  }

  let staleRec = 0;
  let belowMin = 0;
  for (const c of cash) {
    if (!cashTreasuryTracked(c)) continue;
    const rec = parseIsoDate(c.last_reconciled_date);
    const days = rec ? daysBetween(now, rec) : 9999;
    if (!rec || days > 30) staleRec++;
    const bal = c.current_balance ?? 0;
    const minb = c.minimum_required_balance;
    if (minb != null && bal < minb) belowMin++;
  }
  if (staleRec > 0) {
    items.push({
      id: 'stale_reconciliation',
      label: 'Bank accounts with stale or missing reconciliation',
      count: staleRec,
      href: '/treasury',
      severity: staleRec > 2 ? 'high' : 'medium',
    });
  }
  if (belowMin > 0) {
    items.push({
      id: 'below_minimum_balance',
      label: 'Accounts below minimum required balance',
      count: belowMin,
      href: '/treasury',
      severity: 'high',
    });
  }

  if (ctx.openDecisions > 0) {
    items.push({
      id: 'open_decisions',
      label: 'Open decisions awaiting action',
      count: ctx.openDecisions,
      href: '/decisions',
      severity: ctx.openDecisions > 5 ? 'high' : 'medium',
    });
  }

  items.sort((a, b) => dataQualitySeverityRank(b.severity) - dataQualitySeverityRank(a.severity));
  return { items, allClear: items.length === 0 };
}

/** @param {import('better-sqlite3').Database} database */
export function computeDashboard(database = db) {
  const master = database
    .prepare(`SELECT * FROM master_assets WHERE deleted_at IS NULL OR deleted_at = ''`)
    .all();
  const cash = database
    .prepare(`SELECT * FROM cash_banking WHERE deleted_at IS NULL OR deleted_at = ''`)
    .all();
  const liab = database
    .prepare(`SELECT * FROM liabilities WHERE deleted_at IS NULL OR deleted_at = ''`)
    .all();
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
  const pendingDocRows = docs.filter(isOutstandingDocumentRow);
  const outstandingDocs = pendingDocRows.length;

  const complianceDigestItems = pendingDocRows
    .map((r) => {
      const rq = parseIsoDate(r.date_requested);
      const daysOpen = rq ? Math.floor((now.getTime() - rq.getTime()) / MS_DAY) : null;
      return { r, daysOpen };
    })
    .sort((a, b) => {
      if (a.daysOpen == null && b.daysOpen == null) return 0;
      if (a.daysOpen == null) return 1;
      if (b.daysOpen == null) return -1;
      return b.daysOpen - a.daysOpen;
    })
    .slice(0, 6)
    .map(({ r, daysOpen }) => ({
      id: r.id,
      documentCategory: r.document_category || '—',
      entityAsset: r.entity_asset || '—',
      status: r.status || '—',
      dateRequested: r.date_requested || null,
      daysOpen,
      riskLevel: r.risk_level || '—'
    }));

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

  const riskSignalsWithCta = riskSignals.map((r) => ({
    ...r,
    ctaTo: ctaForRiskContext(r.id, r.category)
  }));

  const dataQuality = buildDataQualityChecklist(database, now, { openDecisions: openDecisions.length });

  return {
    brand: 'Ola Olabinjo Investment',
    asOf: now.toISOString(),
    masterAssetRowCount: master.length,
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
    riskSignals: riskSignalsWithCta,
    decisions,
    recommendations,
    alerts: riskSignalsWithCta.filter((r) => r.severity >= 3).slice(0, 12),
    snapshotTrend,
    netWorthFX: buildNetWorthFxSnapshot(totalAssets, totalLiabilities, netPosition),
    topPropertyByReturn: buildTopPropertyByReturn(database, 6),
    chairmanSpotlights: buildChairmanSpotlights(database),
    complianceDigest: {
      outstandingCount: outstandingDocs,
      items: complianceDigestItems
    },
    complianceCalendar: buildComplianceCalendarDigest(database, now),
    dataQuality
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
      confidence: d.riskLevel === 'Critical' ? 0.95 : d.riskLevel === 'High' ? 0.88 : 0.78,
      ctaTo: `/decisions?focus=${encodeURIComponent(d.id)}`
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
      confidence: 0.72,
      ctaTo: ctaForRiskContext(r.id, r.category)
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
      level: s.level,
      ctaTo: ctaForRiskContext(s.id, s.category)
    }))
  };
}
