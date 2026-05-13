type PaginationBarProps = {
  offset: number
  limit: number
  total: number
  disabled?: boolean
  onOffsetChange: (nextOffset: number) => void
  /** When false, only Previous / Next are shown (default: true when more than one page). */
  showEdgeButtons?: boolean
}

export function PaginationBar({
  offset,
  limit,
  total,
  disabled,
  onOffsetChange,
  showEdgeButtons = true,
}: PaginationBarProps) {
  if (total <= limit) return null
  const start = total === 0 ? 0 : offset + 1
  const end = Math.min(offset + limit, total)
  const canPrev = offset > 0
  const canNext = offset + limit < total
  const lastOffset = Math.max(0, (Math.ceil(total / limit) - 1) * limit)
  const edges = showEdgeButtons && total > limit

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 border-t border-fo-border bg-fo-panel/60 px-3 py-2.5 text-xs text-zinc-400"
      aria-label="Results pagination"
    >
      <span aria-live="polite">
        Showing <span className="text-zinc-200">{start}</span>–<span className="text-zinc-200">{end}</span> of{' '}
        <span className="text-zinc-200">{total}</span>
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {edges ? (
          <button
            type="button"
            disabled={disabled || !canPrev}
            onClick={() => onOffsetChange(0)}
            className="rounded-md border border-fo-border bg-fo-black px-2.5 py-1.5 text-zinc-300 hover:border-fo-gold hover:text-fo-gold-soft disabled:cursor-not-allowed disabled:opacity-35 focus-ring-inset"
          >
            First
          </button>
        ) : null}
        <button
          type="button"
          disabled={disabled || !canPrev}
          onClick={() => onOffsetChange(Math.max(0, offset - limit))}
          className="rounded-md border border-fo-border bg-fo-black px-3 py-1.5 text-zinc-200 hover:border-fo-gold hover:text-fo-gold-soft disabled:cursor-not-allowed disabled:opacity-35 focus-ring-inset"
        >
          Previous page
        </button>
        <button
          type="button"
          disabled={disabled || !canNext}
          onClick={() => onOffsetChange(offset + limit)}
          className="rounded-md border border-fo-border bg-fo-black px-3 py-1.5 text-zinc-200 hover:border-fo-gold hover:text-fo-gold-soft disabled:cursor-not-allowed disabled:opacity-35 focus-ring-inset"
        >
          Next page
        </button>
        {edges ? (
          <button
            type="button"
            disabled={disabled || offset >= lastOffset}
            onClick={() => onOffsetChange(lastOffset)}
            className="rounded-md border border-fo-border bg-fo-black px-2.5 py-1.5 text-zinc-300 hover:border-fo-gold hover:text-fo-gold-soft disabled:cursor-not-allowed disabled:opacity-35 focus-ring-inset"
          >
            Last
          </button>
        ) : null}
      </div>
    </nav>
  )
}
