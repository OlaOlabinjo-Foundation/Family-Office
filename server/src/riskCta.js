/**
 * Client routes for acting on a risk signal (heatmap cells, recommendations, etc.).
 * Keep in sync with Next Actions `ctaTo` rules for risk-derived items.
 *
 * @param {string} id Signal id (e.g. doc-12, rec-ACC1)
 * @param {string} [category] Risk category (Concentration, Documentation, …)
 */
export function ctaForRiskContext(id, category) {
  const cat = String(category || '');
  if (cat === 'Documentation') {
    const m = /^doc-(\d+)$/.exec(String(id || ''));
    if (m && m[1]) return `/documents?outstanding=1&highlight=${encodeURIComponent(m[1])}`;
    return '/documents?outstanding=1';
  }
  if (cat === 'Banking') {
    const m = /^rec-(.+)$/.exec(String(id || ''));
    if (m && m[1]) return `/treasury?highlight=${encodeURIComponent(m[1])}`;
    return '/treasury';
  }
  if (cat === 'Cash') {
    const m = /^bal-(.+)$/.exec(String(id || ''));
    if (m && m[1]) return `/treasury?highlight=${encodeURIComponent(m[1])}`;
    return '/treasury';
  }
  if (cat === 'Liquidity') return '/treasury';
  if (cat === 'Concentration') {
    const m = /^conc-(.+)$/.exec(String(id || ''));
    if (m && m[1]) return `/assets?category=${encodeURIComponent(m[1])}`;
    return '/assets';
  }
  if (cat === 'Valuation') {
    const m = /^val-(.+)$/.exec(String(id || ''));
    if (m && m[1]) return `/data/master?highlight=${encodeURIComponent(m[1])}`;
    return '/data/master';
  }
  if (cat === 'Debt') {
    const m = /^mat-(.+)$/.exec(String(id || ''));
    if (m && m[1]) return `/search?q=${encodeURIComponent(m[1])}`;
    return '/risk';
  }
  return '/risk';
}
