import { computeDashboard } from './intelligence.js';

/**
 * Persist a point-in-time portfolio view for period-on-period movement.
 * @param {import('better-sqlite3').Database} database
 */
export function recordPortfolioSnapshot(database) {
  const dash = computeDashboard(database);
  database
    .prepare(
      `INSERT INTO portfolio_snapshots (
        total_assets, total_liabilities, net_position, cash_position, liquidity_ratio, health_score
      ) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      dash.totalAssets,
      dash.totalLiabilities,
      dash.netPosition,
      dash.cashPosition,
      dash.liquidityRatio,
      dash.portfolioHealthScore
    );
}
