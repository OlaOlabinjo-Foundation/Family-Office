/** @param {import('better-sqlite3').Database} database */
export function getSnapshotById(database, id) {
  const row = database.prepare('SELECT * FROM portfolio_snapshots WHERE id = ?').get(id);
  if (!row) return null;
  return {
    id: row.id,
    createdAt: row.created_at,
    totalAssets: row.total_assets,
    totalLiabilities: row.total_liabilities,
    netPosition: row.net_position,
    cashPosition: row.cash_position,
    liquidityRatio: row.liquidity_ratio,
    healthScore: row.health_score,
  };
}

/**
 * @param {import('better-sqlite3').Database} database
 * @param {number} priorId
 * @param {number} currentId
 */
export function compareSnapshots(database, priorId, currentId) {
  const prior = getSnapshotById(database, priorId);
  const current = getSnapshotById(database, currentId);
  if (!prior || !current) return { ok: false, error: 'One or both snapshots not found.' };
  if (prior.id === current.id) return { ok: false, error: 'Choose two different snapshots.' };

  const delta = {
    netPosition: current.netPosition - prior.netPosition,
    totalAssets: current.totalAssets - prior.totalAssets,
    totalLiabilities: current.totalLiabilities - prior.totalLiabilities,
    cashPosition: current.cashPosition - prior.cashPosition,
    liquidityRatio: (current.liquidityRatio ?? 0) - (prior.liquidityRatio ?? 0),
    healthScore: (current.healthScore ?? 0) - (prior.healthScore ?? 0),
  };

  return { ok: true, prior, current, delta };
}

/** Default: second-latest vs latest by id. */
export function compareLatestPair(database) {
  const rows = database
    .prepare('SELECT id FROM portfolio_snapshots ORDER BY id DESC LIMIT 2')
    .all();
  if (rows.length < 2) {
    return { ok: false, error: 'Need at least two snapshots to compare.' };
  }
  return compareSnapshots(database, rows[1].id, rows[0].id);
}
