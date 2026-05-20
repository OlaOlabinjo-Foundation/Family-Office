import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { useServerHealth } from '../hooks/useServerHealth'
import { setDocumentTitle } from '../lib/documentTitle'

type Surface = {
  title: string
  description: string
  to: string
  /** Who can edit (human-readable). */
  editRoles: string
  /** Who can at least open the screen. */
  viewRoles: string
  /** Hide card when false. */
  show?: boolean
}

export function DataMaintenance() {
  const { user, canWrite, canViewAudit } = useAuth()
  const { credentialStore } = useServerHealth()
  const showTeamUsers = user?.role === 'lead' && credentialStore === 'sqlite'

  useEffect(() => {
    setDocumentTitle('Data maintenance')
  }, [])

  const surfaces: Surface[] = [
    {
      title: 'Master register',
      description: 'Add assets, edit full register fields in-app, CSV export — no Excel required for single-row changes.',
      to: '/data/master',
      editRoles: 'Lead, Analyst',
      viewRoles: 'Chairman, Lead, Analyst, Viewer',
    },
    {
      title: 'Cash & banking register',
      description: 'Treasury accounts — add or edit balances, reconciliation dates, and policy fields in the portal.',
      to: '/data/cash',
      editRoles: 'Lead, Analyst',
      viewRoles: 'Chairman, Lead, Analyst, Viewer',
    },
    {
      title: 'Real estate register',
      description: 'Properties — title, valuation, and ownership fields without re-importing the whole workbook.',
      to: '/data/real-estate',
      editRoles: 'Lead, Analyst',
      viewRoles: 'Chairman, Lead, Analyst, Viewer',
    },
    {
      title: 'Public securities register',
      description: 'Listed holdings — tickers, market values, and owner entity; archived rows can be restored.',
      to: '/data/securities',
      editRoles: 'Lead, Analyst',
      viewRoles: 'Chairman, Lead, Analyst, Viewer',
    },
    {
      title: 'Liabilities register',
      description: 'Debt facilities — outstanding balances and maturity; feeds net position and entity exposure.',
      to: '/data/liabilities',
      editRoles: 'Lead, Analyst',
      viewRoles: 'Chairman, Lead, Analyst, Viewer',
    },
    {
      title: 'Entity exposure',
      description: 'Roll-up by legal owner / borrower across master, cash, real estate, securities, and liabilities.',
      to: '/entities',
      editRoles: '— (read-only roll-up)',
      viewRoles: 'Chairman, Lead, Analyst, Viewer',
    },
    {
      title: 'Approval queue',
      description:
        'Analyst-submitted register changes (master, cash, real estate, securities, liabilities) — lead approves or rejects with audit trail.',
      to: '/approvals',
      editRoles: 'Lead (approve/reject); Analyst (submit)',
      viewRoles: 'Lead, Analyst',
      show: canWrite,
    },
    {
      title: 'Excel import',
      description: 'Preview and confirm a full workbook replace (creates an audit event and optional backup).',
      to: '/import',
      editRoles: 'Lead, Analyst',
      viewRoles: 'Lead, Analyst (others are redirected)',
      show: canWrite,
    },
    {
      title: 'Compliance tracker',
      description:
        'Document requests and statuses; attach evidence in the document vault; mark rows as reviewed without changing workbook status.',
      to: '/documents',
      editRoles: 'Lead, Analyst (review + exports)',
      viewRoles: 'All roles',
    },
    {
      title: 'Compliance calendar',
      description: 'Recurring KYC, filings, and attestations with due dates — overdue items on Command Centre.',
      to: '/compliance/calendar',
      editRoles: 'Lead, Analyst',
      viewRoles: 'All roles',
    },
    {
      title: 'Task inbox',
      description: 'Unified queue: open decisions, compliance verification, and data-quality items — plus weekly digest email (lead).',
      to: '/actions',
      editRoles: 'Lead (digest send); resolve decisions: Lead, Analyst',
      viewRoles: 'All roles',
    },
    {
      title: 'Treasury & liquidity',
      description: 'Cash policy dashboard and flags; edit account rows on the cash register or via Excel import.',
      to: '/treasury',
      editRoles: 'Lead, Analyst (cash register)',
      viewRoles: 'All roles',
    },
    {
      title: 'Snapshots',
      description: 'Capture portfolio snapshots after material changes (writes create audit entries).',
      to: '/snapshots',
      editRoles: 'Lead, Analyst',
      viewRoles: 'All roles',
    },
    {
      title: 'Team users',
      description: 'Create and retire SQLite sign-in accounts (optional audit note on each change).',
      to: '/admin/users',
      editRoles: 'Lead only',
      viewRoles: 'Lead (SQLite auth only)',
      show: showTeamUsers,
    },
    {
      title: 'Audit trail',
      description: 'Append-only history of imports, access changes, decisions, and compliance reviews.',
      to: '/audit',
      editRoles: '— (read-only)',
      viewRoles: 'Chairman, Lead, Analyst',
      show: canViewAudit,
    },
    {
      title: 'Account',
      description: 'Password change when the server exposes it; profile is always visible.',
      to: '/settings',
      editRoles: 'Password (when enabled)',
      viewRoles: 'All roles',
    },
  ]

  return (
    <div className="space-y-8 max-w-4xl">
      <PageHeader
        eyebrow="Operations"
        title="Data maintenance"
        description="One place to see where book data and access are updated, who may edit, and how to get there. Destructive flows (imports, user removal) stay behind confirmations elsewhere — use this hub for orientation, not as a shortcut past governance."
      />

      {!canWrite ? (
        <div
          role="status"
          className="rounded-xl border border-fo-amber/35 bg-fo-amber/10 px-4 py-3 text-sm text-zinc-200 leading-relaxed"
        >
          <span className="font-medium text-fo-amber">Read-only for your role.</span> You can open registers and exports, but
          confirming imports, editing master rows, marking compliance reviews, and capturing snapshots require a{' '}
          <strong className="text-zinc-100">lead</strong> or <strong className="text-zinc-100">analyst</strong> account. See{' '}
          <Link to="/help" className="text-fo-gold-soft hover:underline">
            Help
          </Link>{' '}
          or <Link to="/settings" className="text-fo-gold-soft hover:underline">Account</Link>.
        </div>
      ) : null}

      <ul className="grid gap-4 sm:grid-cols-2">
        {surfaces
          .filter((s) => s.show !== false)
          .map((s) => (
            <li key={s.to} className="rounded-2xl border border-fo-border bg-fo-graphite/40 p-5 flex flex-col">
              <h2 className="font-medium text-white">{s.title}</h2>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed flex-1">{s.description}</p>
              <dl className="mt-3 space-y-1 text-[11px] text-zinc-500">
                <div>
                  <dt className="inline text-zinc-600">Can edit: </dt>
                  <dd className="inline text-zinc-300">{s.editRoles}</dd>
                </div>
                <div>
                  <dt className="inline text-zinc-600">Can open: </dt>
                  <dd className="inline text-zinc-300">{s.viewRoles}</dd>
                </div>
              </dl>
              <Link
                to={s.to}
                className="mt-4 inline-flex w-fit rounded-md border border-fo-border bg-fo-panel px-3 py-2 text-xs font-medium uppercase tracking-wider text-fo-gold-soft hover:border-fo-gold/50 hover:text-fo-gold"
              >
                Open →
              </Link>
            </li>
          ))}
      </ul>
    </div>
  )
}
