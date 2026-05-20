import type { ReactNode } from 'react'

type TableScrollProps = {
  children: ReactNode
  /** Shown above table on small screens */
  hint?: string
  className?: string
  maxHeight?: string
}

/**
 * Horizontal scroll wrapper for data tables on narrow viewports.
 */
export function TableScroll({
  children,
  hint = 'Swipe sideways for more columns',
  className = '',
  maxHeight = 'max-h-[min(70vh,560px)]',
}: TableScrollProps) {
  return (
    <section className={`table-scroll-host ${className}`}>
      <p className="table-scroll-hint mb-2 text-[11px] text-zinc-500 md:hidden" aria-hidden>
        {hint}
      </p>
      <section
        className={`table-scroll -mx-1 px-1 sm:mx-0 sm:px-0 overflow-x-auto overflow-y-auto ${maxHeight} rounded-2xl border border-fo-border touch-pan-x`}
      >
        {children}
      </section>
    </section>
  )
}
