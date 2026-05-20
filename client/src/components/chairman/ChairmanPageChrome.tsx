import { Link } from 'react-router-dom'

type Props = {
  title: string
  subtitle?: string
  children: React.ReactNode
  actions?: React.ReactNode
}

export function ChairmanPageChrome({ title, subtitle, children, actions }: Props) {
  return (
    <div className="chairman-executive-shell chairman-executive w-full min-w-0">
      <header className="chairman-topbar sticky top-0 z-30 border-b border-fo-border/80 bg-fo-black/90 backdrop-blur-md no-print">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="shrink-0 rounded-lg border border-fo-border/80 bg-fo-panel/50 px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-400 hover:border-fo-gold/50 hover:text-fo-gold-soft"
          >
            ← Overview
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-[family-name:var(--font-display)] text-lg text-white sm:text-xl">{title}</h1>
            {subtitle ? <p className="mt-0.5 text-xs text-zinc-500 line-clamp-2">{subtitle}</p> : null}
          </div>
          <span className="hidden sm:inline-flex rounded-full border border-fo-border/60 bg-fo-panel/40 px-3 py-1 text-[10px] uppercase tracking-widest text-zinc-500">
            Read-only
          </span>
          {actions ? <div className="flex w-full flex-wrap gap-2 sm:w-auto">{actions}</div> : null}
        </div>
      </header>
      <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-8">{children}</div>
    </div>
  )
}
