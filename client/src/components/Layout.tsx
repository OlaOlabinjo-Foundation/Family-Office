import { useMemo, useState, useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useServerVersion } from '../hooks/useServerVersion'
import { setDocumentTitle } from '../lib/documentTitle'

import type { Role } from '../context/AuthContext'

const NAV: { to: string; label: string; roles?: Role[]; end?: boolean }[] = [
  { to: '/', label: 'Command Centre', end: true },
  { to: '/search', label: 'Search' },
  { to: '/assets', label: 'Asset Intelligence' },
  { to: '/treasury', label: 'Treasury & liquidity' },
  { to: '/risk', label: 'Risk' },
  { to: '/decisions', label: 'Decisions' },
  { to: '/actions', label: 'Next Actions' },
  { to: '/import', label: 'Excel Import', roles: ['lead', 'analyst'] },
  { to: '/reports', label: 'Reports' },
  { to: '/snapshots', label: 'Snapshots' },
  { to: '/documents', label: 'Compliance' },
  { to: '/data/master', label: 'Master Register' },
  { to: '/audit', label: 'Audit trail', roles: ['chairman', 'lead', 'analyst'] },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, canWrite } = useAuth()
  const [open, setOpen] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const serverVersion = useServerVersion()
  const loc = useLocation()
  const navigate = useNavigate()
  const role = user?.role
  const links = role ? NAV.filter((n) => !n.roles || n.roles.includes(role)) : NAV

  useEffect(() => {
    const p = new URLSearchParams(loc.search)
    const qq = p.get('q')
    if (loc.pathname === '/search' && qq) setSearchInput(qq)
  }, [loc.pathname, loc.search])

  useEffect(() => {
    setOpen(false)
  }, [loc.pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const pageTitle = useMemo(() => {
    if (loc.pathname === '/search') return 'Search'
    if (loc.pathname === '/treasury') return 'Treasury & liquidity'
    const fromNav = links.find((n) => n.to === loc.pathname)?.label
    if (fromNav) return fromNav
    return 'Page not found'
  }, [loc.pathname, links])

  useEffect(() => {
    setDocumentTitle(pageTitle)
  }, [pageTitle])

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    const t = searchInput.trim()
    if (t.length < 2) return
    navigate(`/search?q=${encodeURIComponent(t)}`)
    setOpen(false)
  }

  return (
    <div className="min-h-screen bg-fo-black text-white flex flex-col md:flex-row">
      <a
        href="#main-content"
        className="fixed left-4 top-4 z-[200] -translate-y-[200%] rounded-md bg-fo-gold px-4 py-2 text-sm font-medium text-fo-black shadow-lg transition-transform focus:translate-y-0 focus:outline-none motion-reduce:transition-none"
      >
        Skip to main content
      </a>
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <header className="md:hidden flex items-center justify-between gap-2 px-4 py-3 border-b border-fo-border bg-fo-graphite z-40">
        <div className="min-w-0 flex-1">
          <div className="font-[family-name:var(--font-display)] text-lg tracking-wide text-fo-gold truncate">OOI</div>
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 truncate">{pageTitle}</div>
        </div>
        <button
          type="button"
          className="text-sm uppercase tracking-widest text-fo-gold-soft border border-fo-border rounded px-3 py-1.5 shrink-0 focus-ring-inset"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="sidebar-nav"
        >
          Menu
        </button>
      </header>

      <aside
        id="sidebar-nav"
        className={`fixed md:static inset-y-0 left-0 z-40 w-[min(100%,18rem)] border-r border-fo-border bg-fo-graphite flex-col transition-transform duration-200 md:translate-x-0 ${
          open ? 'flex translate-x-0' : 'hidden md:flex'
        }`}
      >
        <div className="p-6 border-b border-fo-border hidden md:block">
          <div className="font-[family-name:var(--font-display)] text-2xl text-fo-gold leading-tight">Ola Olabinjo</div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-zinc-400 mt-1">Investment</div>
          <div className="text-[10px] text-zinc-500 mt-3">Family Office Command Centre</div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {links.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `block rounded-md border-l-2 px-3 py-2 text-sm transition-colors focus-ring-inset ${
                  isActive
                    ? 'border-fo-gold bg-fo-panel text-fo-gold-soft'
                    : 'border-transparent text-zinc-300 hover:border-zinc-700 hover:bg-fo-panel hover:text-white'
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <form onSubmit={submitSearch} className="px-3 pb-3 md:hidden border-b border-fo-border shrink-0">
          <div className="flex gap-2">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search…"
              aria-label="Search registers"
              className="flex-1 rounded-md bg-fo-panel border border-fo-border px-3 py-2 text-sm outline-none focus:border-fo-gold"
            />
            <button type="submit" className="rounded-md bg-fo-gold text-fo-black px-3 py-2 text-xs font-medium shrink-0 focus-ring-inset">
              Go
            </button>
          </div>
        </form>
        <div className="p-4 border-t border-fo-border text-xs text-zinc-400 space-y-2">
          <div>
            <div className="text-white text-sm">{user?.displayName}</div>
            <div className="uppercase tracking-wider text-[10px] mt-0.5">{user?.role}</div>
            {!canWrite && <div className="text-fo-amber mt-1">Read-only executive view</div>}
          </div>
          <button
            type="button"
            onClick={logout}
            className="w-full border border-fo-border rounded py-2 text-zinc-200 hover:border-fo-gold hover:text-fo-gold-soft focus-ring-inset"
          >
            Sign out
          </button>
          <p className="text-[10px] text-zinc-600 leading-snug pt-1">
            Mock session · NGN reporting
            {serverVersion ? (
              <>
                {' '}
                · <span className="text-zinc-500">release {serverVersion}</span>
              </>
            ) : null}
          </p>
        </div>
      </aside>

      <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 md:ml-0 outline-none">
        <div className="hidden md:flex flex-wrap items-center gap-4 px-8 py-4 border-b border-fo-border bg-gradient-to-r from-fo-black to-fo-graphite">
          <div className="min-w-[180px]">
            <div className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">Institutional view</div>
            <div className="font-[family-name:var(--font-display)] text-2xl text-white">{pageTitle}</div>
          </div>
          <form onSubmit={submitSearch} className="flex flex-1 min-w-[200px] max-w-lg">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search registers (min. 2 characters)…"
              aria-label="Search registers"
              className="flex-1 rounded-l-md bg-fo-panel border border-r-0 border-fo-border px-3 py-2 text-sm outline-none focus:border-fo-gold"
            />
            <button
              type="submit"
              className="rounded-r-md bg-fo-gold text-fo-black px-4 py-2 text-sm font-medium shrink-0 focus-ring-inset"
            >
              Search
            </button>
          </form>
          <div className="text-xs text-zinc-500 shrink-0 md:ml-auto">
            Reporting currency: <span className="text-fo-gold">NGN</span> · Workbook-aligned
          </div>
        </div>
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto">{children}</div>
      </main>
    </div>
  )
}
