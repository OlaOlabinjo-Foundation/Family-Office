import { Link } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { setDocumentTitle } from '../lib/documentTitle'
import { useEffect } from 'react'

const HELP_CENTER_URL = import.meta.env.VITE_HELP_CENTER_URL?.trim() || ''

const steps = [
  {
    title: 'Sign in',
    body: 'Use the account issued by your family office administrator. Demo environments may offer quick sign-in tiles for each role.',
  },
  {
    title: 'Command Centre',
    body: 'Start here for net worth, liquidity, risk signals, and recommendations. If the book is empty, use Excel import (lead/analyst) or wait for an initial workbook load.',
  },
  {
    title: 'Treasury & Risk',
    body: 'Review cash and policy lines, then cross-check the risk heatmap and open decisions.',
  },
  {
    title: 'Excel import',
    body: 'Lead and analyst roles can preview and confirm a full workbook replace. Always preview first; the server keeps a safety backup when using an on-disk database.',
  },
  {
    title: 'Snapshots & reports',
    body: 'Capture portfolio snapshots after material changes. Use Reports and Compliance for board-ready extracts and document tracking.',
  },
]

export function Help() {
  const { user, canWrite, canViewAudit } = useAuth()
  const showTeamUsers = user?.role === 'lead'

  useEffect(() => {
    setDocumentTitle('Help & quick start')
  }, [])

  return (
    <div className="space-y-8 max-w-3xl">
      <PageHeader
        eyebrow="Guide"
        title="Help & quick start"
        description="How to use the Family Office Command Centre. For policies, contacts, and board materials, use your organisation’s customer hub when provided."
      />

      {HELP_CENTER_URL ? (
        <div className="rounded-2xl border border-fo-gold/30 bg-fo-gold/5 p-5">
          <div className="text-[10px] uppercase tracking-[0.3em] text-fo-gold mb-2">Customer hub</div>
          <p className="text-sm text-zinc-300 mb-3">
            Open your shared workspace (Notion, Google Docs, or intranet) in a new tab — bookmark this for principals and advisers.
          </p>
          <a
            href={HELP_CENTER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex rounded-md bg-fo-gold px-4 py-2 text-sm font-medium text-fo-black hover:opacity-90 focus-ring-inset"
          >
            Open customer hub
          </a>
        </div>
      ) : null}

      <div className="rounded-2xl border border-fo-border bg-fo-graphite/40 p-5 md:p-6">
        <h2 className="text-lg font-[family-name:var(--font-display)] text-white mb-2">Your access</h2>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Signed in as <span className="text-white">{user?.displayName}</span> ({user?.role}).{' '}
          {canWrite
            ? 'You can confirm Excel imports and edit master data where the API allows.'
            : 'Read-only: browse dashboards, search, reports, and compliance; you cannot confirm imports.'}
        </p>
      </div>

      <div className="rounded-2xl border border-fo-border bg-fo-graphite/40 p-5 md:p-6">
        <h2 className="text-lg font-[family-name:var(--font-display)] text-white mb-2">Command Centre portrait</h2>
        <p className="text-sm text-zinc-400 leading-relaxed">
          The home hero uses your family “about us” image served as{' '}
          <code className="rounded bg-fo-panel px-1.5 py-0.5 text-xs text-fo-gold-soft">client/public/branding/chairman-portal.png</code>. Replace
          that file to change the photo, or set{' '}
          <code className="rounded bg-fo-panel px-1.5 py-0.5 text-xs text-fo-gold-soft">VITE_CHAIRMAN_IMAGE_URL</code> in{' '}
          <code className="rounded bg-fo-panel px-1.5 py-0.5 text-xs text-fo-gold-soft">client/.env</code> to point at another URL. If the file is
          missing and no URL is set, the image panel is hidden automatically.
        </p>
      </div>

      <div className="rounded-2xl border border-fo-border bg-fo-graphite/40 p-5 md:p-6">
        <h2 className="text-lg font-[family-name:var(--font-display)] text-white mb-1">Quick navigation</h2>
        <p className="text-xs text-zinc-500 mb-4">Jump to a module (same destinations as the main navigation).</p>
        <nav className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm" aria-label="Quick links">
          <Link className="rounded-lg border border-fo-border bg-fo-panel/60 px-3 py-2 text-zinc-300 hover:border-fo-gold/40 hover:text-fo-gold-soft" to="/">
            Command Centre
          </Link>
          <Link className="rounded-lg border border-fo-border bg-fo-panel/60 px-3 py-2 text-zinc-300 hover:border-fo-gold/40 hover:text-fo-gold-soft" to="/search">
            Search
          </Link>
          <Link className="rounded-lg border border-fo-border bg-fo-panel/60 px-3 py-2 text-zinc-300 hover:border-fo-gold/40 hover:text-fo-gold-soft" to="/assets">
            Asset Intelligence
          </Link>
          <Link className="rounded-lg border border-fo-border bg-fo-panel/60 px-3 py-2 text-zinc-300 hover:border-fo-gold/40 hover:text-fo-gold-soft" to="/treasury">
            Treasury
          </Link>
          <Link className="rounded-lg border border-fo-border bg-fo-panel/60 px-3 py-2 text-zinc-300 hover:border-fo-gold/40 hover:text-fo-gold-soft" to="/risk">
            Risk
          </Link>
          <Link className="rounded-lg border border-fo-border bg-fo-panel/60 px-3 py-2 text-zinc-300 hover:border-fo-gold/40 hover:text-fo-gold-soft" to="/decisions">
            Decisions
          </Link>
          <Link className="rounded-lg border border-fo-border bg-fo-panel/60 px-3 py-2 text-zinc-300 hover:border-fo-gold/40 hover:text-fo-gold-soft" to="/actions">
            Next actions
          </Link>
          <Link className="rounded-lg border border-fo-border bg-fo-panel/60 px-3 py-2 text-zinc-300 hover:border-fo-gold/40 hover:text-fo-gold-soft" to="/documents">
            Compliance
          </Link>
          <Link className="rounded-lg border border-fo-border bg-fo-panel/60 px-3 py-2 text-zinc-300 hover:border-fo-gold/40 hover:text-fo-gold-soft" to="/snapshots">
            Snapshots
          </Link>
          <Link className="rounded-lg border border-fo-border bg-fo-panel/60 px-3 py-2 text-zinc-300 hover:border-fo-gold/40 hover:text-fo-gold-soft" to="/reports">
            Reports
          </Link>
          <Link className="rounded-lg border border-fo-border bg-fo-panel/60 px-3 py-2 text-zinc-300 hover:border-fo-gold/40 hover:text-fo-gold-soft" to="/data/master">
            Master register
          </Link>
          <Link className="rounded-lg border border-fo-border bg-fo-panel/60 px-3 py-2 text-zinc-300 hover:border-fo-gold/40 hover:text-fo-gold-soft" to="/maintenance">
            Data maintenance
          </Link>
          <Link className="rounded-lg border border-fo-border bg-fo-panel/60 px-3 py-2 text-zinc-300 hover:border-fo-gold/40 hover:text-fo-gold-soft" to="/settings">
            Account
          </Link>
          {canWrite ? (
            <Link className="rounded-lg border border-fo-amber/30 bg-fo-amber/5 px-3 py-2 text-fo-amber hover:border-fo-gold/50" to="/import">
              Excel import
            </Link>
          ) : null}
          {canViewAudit ? (
            <Link className="rounded-lg border border-fo-border bg-fo-panel/60 px-3 py-2 text-zinc-300 hover:border-fo-gold/40 hover:text-fo-gold-soft" to="/audit">
              Audit trail
            </Link>
          ) : null}
          {showTeamUsers ? (
            <Link className="rounded-lg border border-fo-border bg-fo-panel/60 px-3 py-2 text-zinc-300 hover:border-fo-gold/40 hover:text-fo-gold-soft" to="/admin/users">
              Team users
            </Link>
          ) : null}
        </nav>
      </div>

      <ol className="space-y-5">
        {steps.map((s, i) => (
          <li key={s.title} className="rounded-xl border border-fo-border bg-fo-panel/50 p-4 md:p-5">
            <div className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fo-gold/20 text-sm font-medium text-fo-gold">
                {i + 1}
              </span>
              <div>
                <h3 className="font-medium text-white">{s.title}</h3>
                <p className="mt-1 text-sm text-zinc-400 leading-relaxed">{s.body}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-4 text-sm text-zinc-500">
        <Link to="/settings" className="text-fo-gold-soft hover:underline">
          Account & password →
        </Link>
      </div>

      {!HELP_CENTER_URL ? (
        <p className="text-xs text-zinc-600 leading-relaxed">
          Tip for administrators: set <code className="text-zinc-500">VITE_HELP_CENTER_URL</code> at build time to show a prominent link to
          your Notion or Google Doc customer hub.
        </p>
      ) : null}
    </div>
  )
}
