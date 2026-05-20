import { Link } from 'react-router-dom'

export type DataQualityItem = {
  id: string
  label: string
  count: number
  href: string
  severity: 'high' | 'medium' | 'low'
}

type DataQualityPanelProps = {
  items: DataQualityItem[]
  allClear: boolean
}

function severityClass(severity: DataQualityItem['severity']) {
  if (severity === 'high') return 'border-fo-red/35 bg-fo-red/5 text-fo-red'
  if (severity === 'medium') return 'border-fo-amber/35 bg-fo-amber/5 text-fo-amber'
  return 'border-fo-border bg-fo-panel/40 text-zinc-400'
}

export function DataQualityPanel({ items, allClear }: DataQualityPanelProps) {
  return (
    <section
      className="rounded-2xl border border-fo-border bg-fo-graphite/80 p-5 md:p-6"
      aria-labelledby="data-quality-heading"
    >
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-fo-gold">Data quality</p>
          <h2 id="data-quality-heading" className="font-display text-lg text-white mt-1">
            Book health checklist
          </h2>
        </div>
        {allClear ? (
          <span className="text-xs uppercase tracking-wider text-emerald-400/90">All checks clear</span>
        ) : (
          <span className="text-xs text-zinc-500">{items.length} item{items.length === 1 ? '' : 's'} need attention</span>
        )}
      </div>

      {allClear ? (
        <p className="text-sm text-zinc-500 leading-relaxed">
          No open data-quality flags from the current register. Continue routine reviews via{' '}
          <Link to="/documents" className="text-fo-gold-soft hover:underline">
            Compliance
          </Link>{' '}
          and{' '}
          <Link to="/treasury" className="text-fo-gold-soft hover:underline">
            Treasury
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                to={item.href}
                className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm transition-colors hover:border-fo-gold/40 ${severityClass(item.severity)}`}
              >
                <span className="text-zinc-200">{item.label}</span>
                <span className="shrink-0 flex items-center gap-2 tabular-nums font-medium">
                  <span>{item.count}</span>
                  <span className="text-[10px] uppercase tracking-wider opacity-80">Fix →</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
