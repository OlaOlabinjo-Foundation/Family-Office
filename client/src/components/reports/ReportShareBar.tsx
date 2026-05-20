import { useState } from 'react'
import { reportPath, type ReportSlug } from '../../lib/reportsCatalog'

function fullReportUrl(slug: ReportSlug): string {
  if (typeof window === 'undefined') return reportPath(slug)
  return `${window.location.origin}${reportPath(slug)}`
}

export function ReportShareBar({ slug }: { slug: ReportSlug }) {
  const [copied, setCopied] = useState(false)
  const url = fullReportUrl(slug)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this report link:', url)
    }
  }

  return (
    <div className="rounded-xl border border-fo-border/80 bg-fo-panel/30 px-4 py-3 print:hidden">
      <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">Report address</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <a
          href={url}
          className="min-w-0 flex-1 truncate font-mono text-xs text-fo-gold-soft hover:text-fo-gold hover:underline"
          title={url}
        >
          {url}
        </a>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => void copyLink()}
            className="rounded-lg border border-fo-border px-3 py-1.5 text-[10px] uppercase tracking-wider text-zinc-300 hover:border-fo-gold/50"
          >
            {copied ? 'Copied' : 'Copy link'}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-fo-border px-3 py-1.5 text-[10px] uppercase tracking-wider text-zinc-300 hover:border-fo-gold/50"
          >
            Open in tab
          </a>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-zinc-600 leading-relaxed">
        Bookmark or share this address after signing in. Use <span className="font-mono text-zinc-500">npm run dev</span> or{' '}
        <span className="font-mono text-zinc-500">npm start</span> so deep links and the API both work.
      </p>
    </div>
  )
}
