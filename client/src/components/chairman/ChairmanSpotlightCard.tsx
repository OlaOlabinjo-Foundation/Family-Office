import { Link } from 'react-router-dom'
import { formatCompactNgn } from '../../lib/format'
import type { ChairmanSpotlight } from '../../lib/chairmanExecutive'

const KIND_LABEL: Record<string, string> = {
  property: 'Top property',
  private_equity: 'Private equity',
  securities: 'Public securities',
  cash: 'Primary bank',
  liquid_asset: 'Liquid asset',
}

const KIND_GRADIENT: Record<string, string> = {
  property: 'from-amber-900/40 via-stone-800/80 to-fo-black',
  private_equity: 'from-indigo-950/50 via-fo-graphite to-fo-black',
  securities: 'from-sky-950/40 via-fo-graphite to-fo-black',
  cash: 'from-emerald-950/40 via-fo-graphite to-fo-black',
  liquid_asset: 'from-teal-950/40 via-fo-graphite to-fo-black',
}

export function ChairmanSpotlightCard({ item }: { item: ChairmanSpotlight }) {
  const label = KIND_LABEL[item.kind] || 'Highlight'
  const gradient = KIND_GRADIENT[item.kind] || 'from-fo-graphite to-fo-black'

  return (
    <article className="chairman-card flex flex-col overflow-hidden rounded-2xl border border-fo-border/80 bg-fo-graphite/60 shadow-lg shadow-black/30">
      <div className={`relative h-36 bg-gradient-to-br ${gradient}`}>
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(circle at 30% 20%, rgba(212,175,55,0.25), transparent 50%), linear-gradient(135deg, transparent 40%, rgba(0,0,0,0.6))',
          }}
          aria-hidden
        />
        <div className="absolute bottom-3 left-3 right-3">
          <p className="text-[10px] uppercase tracking-widest text-fo-gold-soft/90">{label}</p>
          <h3 className="mt-1 font-[family-name:var(--font-display)] text-base text-white line-clamp-3 sm:text-lg">{item.title}</h3>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs text-zinc-500 line-clamp-2">{item.subtitle}</p>
        <p className="mt-2 font-[family-name:var(--font-display)] text-2xl text-white">{formatCompactNgn(item.valueNgn)}</p>
        <p className="mt-1 text-xs text-fo-green">{item.trendLabel}</p>
        <Link
          to={item.href}
          className="mt-4 inline-flex w-fit rounded-lg border border-fo-gold/40 bg-fo-gold/10 px-3 py-2 text-[11px] uppercase tracking-wider text-fo-gold-soft hover:bg-fo-gold/20"
        >
          View details
        </Link>
      </div>
    </article>
  )
}
