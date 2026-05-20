import { Link } from 'react-router-dom'
import { formatCompactNgn, formatPct } from '../../lib/format'
import type { ReportSlug } from '../../lib/reportsCatalog'

function formatScalar(v: unknown): string {
  if (v == null) return '\u2014'
  if (typeof v === 'string') return v
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '\u2014'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  const s = JSON.stringify(v)
  return s.length > 240 ? `${s.slice(0, 240)}\u2026` : s
}

function humanKpiLabel(key: string): string {
  const map: Record<string, string> = {
    totalAssets: 'Total assets',
    totalLiabilities: 'Total liabilities',
    netPosition: 'Net position',
    cashPosition: 'Cash position',
    portfolioHealthScore: 'Portfolio health score',
    pendingDecisions: 'Pending decisions',
    outstandingDocumentation: 'Outstanding documentation',
  }
  return map[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim()
}

function formatKpiValue(key: string, v: unknown): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return formatScalar(v)
  if (key === 'portfolioHealthScore') return `${Math.round(v)} / 100`
  if (key === 'pendingDecisions' || key === 'outstandingDocumentation') return String(Math.round(v))
  return formatCompactNgn(v)
}

function formatSectionRow(row: Record<string, unknown>): string {
  const raw = row.value
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return formatScalar(raw)
  const label = String(row.label ?? '')
  const isAllocation = row.name != null && row.label == null
  if (isAllocation) return formatCompactNgn(raw)
  if (/ratio/i.test(label)) return raw >= 0 && raw <= 1 ? formatPct(raw) : String(raw)
  if (/score|pending/i.test(label)) return String(Math.round(raw))
  return formatCompactNgn(raw)
}

function formatExposureRow(row: Record<string, unknown>): string {
  const v = row.value
  if (typeof v === 'number' && Number.isFinite(v)) return formatCompactNgn(v)
  return formatScalar(v)
}

const ITEMS_PREVIEW_MAX_ROWS = 40
const ITEMS_PREVIEW_MAX_COLS = 10

function ItemsPreviewTable({ rows }: { rows: Record<string, unknown>[] }) {
  const keys = Object.keys(rows[0] ?? {}).filter((k) => k !== 'updated_at')
  const cols = keys.slice(0, ITEMS_PREVIEW_MAX_COLS)
  const slice = rows.slice(0, ITEMS_PREVIEW_MAX_ROWS)
  if (!cols.length) return <p className="text-zinc-500">No columns in extract.</p>

  return (
    <div className="overflow-x-auto rounded-lg border border-fo-border max-h-[min(420px,50vh)] overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-fo-graphite z-10">
          <tr>
            {cols.map((c) => (
              <th key={c} className="text-left font-medium text-zinc-400 px-2 py-2 border-b border-fo-border whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slice.map((row, ri) => (
            <tr key={ri} className="border-b border-fo-border/40 last:border-0">
              {cols.map((c) => (
                <td key={c} className="px-2 py-1.5 text-zinc-300 max-w-[14rem] truncate" title={formatScalar(row[c])}>
                  {formatScalar(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > ITEMS_PREVIEW_MAX_ROWS ? (
        <p className="text-[10px] text-zinc-600 px-2 py-2 border-t border-fo-border">
          Showing first {ITEMS_PREVIEW_MAX_ROWS} of {rows.length} rows.
        </p>
      ) : null}
    </div>
  )
}

export function ReportHumanReadout({ data, slug }: { data: Record<string, unknown>; slug: ReportSlug }) {
  const title = String(data.title ?? 'Report')
  const generatedAt = String(data.generatedAt ?? '')
  const metaSlug = String(data.slug ?? slug)

  const sections = data.sections
  const executiveSummary = typeof data.executiveSummary === 'string' ? data.executiveSummary : null
  const kpis = data.kpis && typeof data.kpis === 'object' && !Array.isArray(data.kpis) ? (data.kpis as Record<string, unknown>) : null
  const periodMovement = data.periodMovement
  const allocation = Array.isArray(data.allocation) ? data.allocation : null
  const countryExposure = Array.isArray(data.countryExposure) ? data.countryExposure : null
  const risks = Array.isArray(data.risks) ? data.risks : Array.isArray(data.riskSignals) ? data.riskSignals : null
  const items = Array.isArray(data.items) ? data.items : null
  const hasHeatmap = data.heatmap != null && slug === 'risk'

  return (
    <div className="space-y-8 text-sm text-zinc-300">
      <header className="border-b border-fo-border pb-4">
        <h2 className="font-[family-name:var(--font-display)] text-xl text-white">{title}</h2>
        <p className="mt-1 text-xs text-zinc-500">
          {generatedAt ? (
            <time dateTime={generatedAt}>{generatedAt.replace('T', ' ').slice(0, 19)}</time>
          ) : null}
          {generatedAt ? ' · ' : null}
          <span className="font-mono text-zinc-400">{metaSlug}</span>
        </p>
      </header>

      {executiveSummary ? (
        <section>
          <h3 className="text-[10px] uppercase tracking-[0.25em] text-fo-gold mb-2">Executive summary</h3>
          <p className="text-zinc-300 leading-relaxed">{executiveSummary}</p>
        </section>
      ) : null}

      {kpis ? (
        <section>
          <h3 className="text-[10px] uppercase tracking-[0.25em] text-fo-gold mb-3">Key indicators</h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {Object.entries(kpis).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-fo-border/40 py-1.5">
                <dt className="text-zinc-500">{humanKpiLabel(k)}</dt>
                <dd className="text-white font-medium tabular-nums">{formatKpiValue(k, v)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {Array.isArray(sections) && sections.length > 0 ? (
        <section className="space-y-6">
          {sections.map((sec, idx) => {
            const s = sec as { heading?: string; rows?: unknown[] }
            const rows = Array.isArray(s.rows) ? s.rows : []
            return (
              <div key={`${s.heading ?? 'sec'}-${idx}`}>
                <h3 className="text-[10px] uppercase tracking-[0.25em] text-fo-gold mb-2">{s.heading ?? 'Section'}</h3>
                <div className="overflow-x-auto rounded-lg border border-fo-border">
                  <table className="w-full text-sm">
                    <tbody>
                      {rows.map((r, i) => {
                        const row = r as Record<string, unknown>
                        const label = String(row.label ?? row.name ?? `Row ${i + 1}`)
                        return (
                          <tr key={`${label}-${i}`} className="border-b border-fo-border/50 last:border-0">
                            <td className="px-3 py-2 text-zinc-400 align-top">{label}</td>
                            <td className="px-3 py-2 text-white text-right align-top whitespace-nowrap">{formatSectionRow(row)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </section>
      ) : null}

      {allocation && !sections ? (
        <section>
          <h3 className="text-[10px] uppercase tracking-[0.25em] text-fo-gold mb-2">Allocation</h3>
          <div className="overflow-x-auto rounded-lg border border-fo-border">
            <table className="w-full text-sm">
              <tbody>
                {allocation.map((r, i) => {
                  const row = r as Record<string, unknown>
                  const name = String(row.name ?? row.label ?? `Line ${i + 1}`)
                  return (
                    <tr key={`${name}-${i}`} className="border-b border-fo-border/50 last:border-0">
                      <td className="px-3 py-2 text-zinc-400">{name}</td>
                      <td className="px-3 py-2 text-white text-right tabular-nums">{formatSectionRow({ ...row, label: null })}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {countryExposure ? (
        <section>
          <h3 className="text-[10px] uppercase tracking-[0.25em] text-fo-gold mb-2">Country exposure</h3>
          <div className="overflow-x-auto rounded-lg border border-fo-border">
            <table className="w-full text-sm">
              <tbody>
                {countryExposure.map((r, i) => {
                  const row = r as Record<string, unknown>
                  const name = String(row.country ?? row.name ?? row.label ?? `Row ${i + 1}`)
                  return (
                    <tr key={`${name}-${i}`} className="border-b border-fo-border/50 last:border-0">
                      <td className="px-3 py-2 text-zinc-400">{name}</td>
                      <td className="px-3 py-2 text-white text-right tabular-nums">{formatExposureRow(row)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {periodMovement && typeof periodMovement === 'object' && !Array.isArray(periodMovement) ? (
        <section>
          <h3 className="text-[10px] uppercase tracking-[0.25em] text-fo-gold mb-2">Period movement</h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
            {Object.entries(periodMovement as Record<string, unknown>).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-fo-border/30 py-1">
                <dt className="text-zinc-500 font-mono">{k}</dt>
                <dd className="text-zinc-200 text-right break-all">{formatScalar(v)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {risks && risks.length > 0 ? (
        <section>
          <h3 className="text-[10px] uppercase tracking-[0.25em] text-fo-gold mb-2">Risk signals</h3>
          <ul className="space-y-3">
            {risks.map((r, i) => {
              const row = r as Record<string, unknown>
              const titleText = String(row.title ?? row.id ?? `Signal ${i + 1}`)
              const detail = row.detail != null ? String(row.detail) : null
              const level = row.level != null ? String(row.level) : null
              const cta = typeof row.ctaTo === 'string' ? row.ctaTo : null
              return (
                <li key={String(row.id ?? i)} className="rounded-lg border border-fo-border/60 bg-fo-black/20 px-3 py-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-white font-medium">{titleText}</span>
                    {level ? <span className="text-[10px] uppercase tracking-wider text-fo-amber">{level}</span> : null}
                  </div>
                  {detail ? <p className="mt-1 text-xs text-zinc-500 leading-relaxed">{detail}</p> : null}
                  {cta ? (
                    <p className="mt-2">
                      <Link to={cta} className="text-xs text-fo-gold-soft hover:underline">
                        Open related view →
                      </Link>
                    </p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {hasHeatmap ? (
        <p className="text-xs text-zinc-500 leading-relaxed">
          Interactive heatmap data is included in this pack. For the live grid, open{' '}
          <Link to="/assets" className="text-fo-gold-soft hover:underline">
            Assets
          </Link>
          .
        </p>
      ) : null}

      {items && items.length > 0 ? (
        <section>
          <h3 className="text-[10px] uppercase tracking-[0.25em] text-fo-gold mb-2">Register extract ({items.length} rows)</h3>
          <ItemsPreviewTable rows={items as Record<string, unknown>[]} />
        </section>
      ) : null}
    </div>
  )
}

export function flattenReportRows(data: Record<string, unknown>) {
  const rows: Record<string, unknown>[] = []
  const walk = (obj: unknown, prefix = '') => {
    if (obj === null || obj === undefined) return
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => walk(item, `${prefix}[${i}]`))
      return
    }
    if (typeof obj === 'object') {
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        const key = prefix ? `${prefix}.${k}` : k
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) walk(v, key)
        else if (Array.isArray(v)) rows.push({ key, value: JSON.stringify(v) })
        else rows.push({ key, value: v as unknown })
      }
    } else {
      rows.push({ key: prefix, value: obj })
    }
  }
  walk(data)
  return rows.length ? rows : [{ key: 'payload', value: JSON.stringify(data) }]
}
