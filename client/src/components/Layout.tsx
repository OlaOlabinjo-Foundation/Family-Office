import { useMemo, useState, useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useServerHealth } from '../hooks/useServerHealth'
import { setDocumentTitle } from '../lib/documentTitle'
import type { Role } from '../context/AuthContext'
import { isChairmanExecutivePath } from '../lib/chairmanPages'

const NAV: { to: string; label: string; roles?: Role[]; end?: boolean; leadSqliteOnly?: boolean }[] = [
  { to: '/', label: 'Command Centre', end: true },
  { to: '/search', label: 'Search' },
  { to: '/assets', label: 'Asset Intelligence' },
  { to: '/treasury', label: 'Treasury & liquidity' },
  { to: '/risk', label: 'Risk' },
  { to: '/decisions', label: 'Decisions' },
  { to: '/actions', label: 'Task inbox' },
  { to: '/communications', label: 'Communications', roles: ['lead', 'analyst'] },
  { to: '/import', label: 'Excel Import', roles: ['lead', 'analyst'] },
  { to: '/reports', label: 'Reports' },
  { to: '/snapshots', label: 'Snapshots' },
  { to: '/documents', label: 'Compliance' },
  { to: '/compliance/calendar', label: 'Compliance calendar' },
  { to: '/data/master', label: 'Master Register' },
  { to: '/maintenance', label: 'Data maintenance' },
  { to: '/audit', label: 'Audit trail', roles: ['chairman', 'lead', 'analyst'] },
  { to: '/admin/users', label: 'Team users', roles: ['lead'], leadSqliteOnly: true },
  { to: '/settings', label: 'Account' },
  { to: '/help', label: 'Help' },
]

const CHAIRMAN_NAV: { to: string; label: string; end?: boolean }[] = [
  { to: '/', label: 'Overview', end: true },
  { to: '/reports', label: 'Reports' },
  { to: '/treasury', label: 'Treasury' },
  { to: '/assets', label: 'Assets' },
  { to: '/documents', label: 'Compliance' },
  { to: '/audit', label: 'Audit trail' },
  { to: '/help', label: 'Help' },
  { to: '/settings', label: 'Account' },
]

function useMobileNav() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)').matches : false
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const onChange = () => setMobile(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return mobile
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, canWrite } = useAuth()
  const [open, setOpen] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const { version: serverVersion, credentialStore } = useServerHealth()
  const loc = useLocation()
  const navigate = useNavigate()
  const mobile = useMobileNav()
  const role = user?.role

  const links = useMemo(() => {
    if (!role) return NAV
    if (role === 'chairman') return CHAIRMAN_NAV
    return NAV.filter((n) => {
      if (n.roles && !n.roles.includes(role)) return false
      if (n.leadSqliteOnly && !(role === 'lead' && credentialStore === 'sqlite')) return false
      return true
    })
  }, [role, credentialStore])

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
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pageTitle = useMemo(() => {
    if (loc.pathname === '/search') return 'Search'
    if (loc.pathname === '/admin/users') return 'Team users'
    if (loc.pathname === '/settings') return 'Account'
    if (loc.pathname === '/help') return 'Help'
    if (loc.pathname === '/treasury') return 'Treasury & liquidity'
    if (loc.pathname === '/maintenance') return 'Data maintenance'
    if (loc.pathname === '/compliance/calendar') return 'Compliance calendar'
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

  const drawerOpen = mobile && open
  const drawerHiddenFromA11y = mobile && !open
  const chairmanExecutiveHome = role === 'chairman' && isChairmanExecutivePath(loc.pathname)

  return (
    <div
      className={`app-shell min-h-screen min-h-[100dvh] bg-fo-black text-white${chairmanExecutiveHome ? ' app-shell--chairman-exec' : ''}`}
    >
      <a
        href="#main-content"
        className="fixed left-4 top-4 z-[200] -translate-y-[200%] rounded-md bg-fo-gold px-4 py-2 text-sm font-medium text-fo-black shadow-lg transition-transform focus:translate-y-0 focus:outline-none motion-reduce:transition-none"
      >
        Skip to main content
      </a>

      {drawerOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/75"
          onClick={() => setOpen(false)}
        />
      ) : null}

      {/* Mobile top bar — full width; main content never shares a row with the sidebar */}
      <header
        className={`app-chrome no-print sticky top-0 z-50 w-full items-center gap-2 border-b border-fo-border bg-fo-graphite/95 px-3 py-2 backdrop-blur-sm pt-[max(0.5rem,env(safe-area-inset-top))] ${mobile ? 'flex' : 'hidden'}`}
      >
        <button
          type="button"
          className="btn-touch shrink-0 rounded-lg border border-fo-border bg-fo-panel px-3 text-xs font-medium uppercase tracking-wider text-fo-gold-soft focus-ring-inset"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="sidebar-nav"
        >
          Menu
        </button>
        <div className="min-w-0 flex-1 px-1">
          <div className="truncate font-[family-name:var(--font-display)] text-base leading-tight text-fo-gold">
            Ola Olabinjo
          </div>
          <div className="truncate text-[10px] uppercase tracking-widest text-zinc-500">{pageTitle}</div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="btn-touch shrink-0 rounded-lg border border-fo-border bg-fo-panel px-3 text-xs font-medium uppercase tracking-wider text-zinc-200 focus-ring-inset"
        >
          Out
        </button>
      </header>

      <div className={`flex min-h-0 flex-1 ${mobile ? 'flex-col' : 'min-h-[100dvh] flex-row'}`}>
        <aside
          id="sidebar-nav"
          aria-hidden={drawerHiddenFromA11y || undefined}
          className={[
            'no-print flex-col border-r border-fo-border bg-fo-graphite',
            mobile
              ? drawerOpen
                ? 'fixed inset-y-0 left-0 z-50 flex w-[min(100vw,20rem)] max-w-full shadow-2xl shadow-black/80'
                : 'hidden'
              : 'flex w-72 shrink-0',
          ].join(' ')}
        >
          <div className="border-b border-fo-border p-5 lg:pt-6">
            <div className="font-[family-name:var(--font-display)] text-xl leading-tight text-fo-gold lg:text-2xl">
              Ola Olabinjo
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.25em] text-zinc-400">Investment</div>
            <div className={`mt-2 text-[10px] text-zinc-500 ${mobile ? 'hidden' : 'block'}`}>
              Family Office Command Centre
            </div>
          </div>

          {role !== 'chairman' ? (
            <form onSubmit={submitSearch} className="shrink-0 border-b border-fo-border p-3">
              <div className="flex gap-2">
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search registers…"
                  aria-label="Search registers"
                  className="min-h-11 flex-1 rounded-lg border border-fo-border bg-fo-panel px-3 text-base outline-none focus:border-fo-gold lg:text-sm"
                />
                <button
                  type="submit"
                  className="btn-touch shrink-0 rounded-lg bg-fo-gold px-4 text-sm font-medium text-fo-black focus-ring-inset"
                >
                  Go
                </button>
              </div>
            </form>
          ) : (
            <div className="shrink-0 border-b border-fo-border px-5 py-3 lg:px-5">
              <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">Principal navigation</p>
            </div>
          )}

          <nav className="flex-1 space-y-0.5 overflow-y-auto overscroll-contain p-2" aria-label="Main">
            {links.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex min-h-11 items-center rounded-lg border-l-2 px-3 py-2.5 text-sm transition-colors focus-ring-inset ${
                    isActive
                      ? 'border-fo-gold bg-fo-panel font-medium text-fo-gold-soft'
                      : 'border-transparent text-zinc-300 active:bg-fo-panel/80'
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="space-y-2 border-t border-fo-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-xs text-zinc-400">
            <div>
              <div className="text-sm text-white">{user?.displayName}</div>
              <div className="mt-0.5 uppercase tracking-wider text-[10px]">{user?.role}</div>
              {!canWrite ? <div className="mt-1 text-fo-amber">Read-only view</div> : null}
            </div>
            <button
              type="button"
              onClick={logout}
              className={`btn-touch w-full rounded-lg border border-fo-border bg-fo-panel text-zinc-200 focus-ring-inset ${mobile ? 'flex' : 'hidden'}`}
            >
              Sign out
            </button>
            <p className={`pt-1 text-[10px] leading-snug text-zinc-600 ${mobile ? 'hidden' : 'block'}`}>
              {credentialStore === 'demo'
                ? 'Demo accounts'
                : credentialStore === 'sqlite'
                  ? 'SQLite accounts'
                  : 'Configured accounts'}{' '}
              · NGN
              {serverVersion ? (
                <>
                  {' '}
                  · <span className="text-zinc-500">{serverVersion}</span>
                </>
              ) : null}
            </p>
          </div>
        </aside>

        <main id="main-content" tabIndex={-1} className="flex min-h-0 min-w-0 flex-1 flex-col outline-none">
          <div
            className={`flex-wrap items-center gap-4 border-b border-fo-border bg-gradient-to-r from-fo-black to-fo-graphite px-4 py-4 sm:px-8 ${mobile || chairmanExecutiveHome ? 'hidden' : 'flex'}`}
          >
            <div className="min-w-0 w-full sm:w-auto sm:max-w-[40%]">
              <div className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">Institutional view</div>
              <div className="truncate font-[family-name:var(--font-display)] text-2xl text-white">{pageTitle}</div>
            </div>
            <form
              onSubmit={submitSearch}
              className="order-3 flex w-full min-w-[200px] max-w-lg flex-1 md:order-none md:w-auto"
            >
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search registers (min. 2 characters)…"
                aria-label="Search registers"
                className="min-h-10 flex-1 rounded-l-md border border-r-0 border-fo-border bg-fo-panel px-3 py-2 text-sm outline-none focus:border-fo-gold"
              />
              <button
                type="submit"
                className="min-h-10 shrink-0 rounded-r-md bg-fo-gold px-4 py-2 text-sm font-medium text-fo-black focus-ring-inset"
              >
                Search
              </button>
            </form>
            <div className="flex shrink-0 items-center gap-3 md:ml-auto">
              <p className="hidden max-w-[14rem] text-right text-xs leading-snug text-zinc-500 xl:block">
                Reporting currency: <span className="text-fo-gold">NGN</span> · Workbook-aligned
              </p>
              <div className="hidden flex-col items-end gap-0.5 border-l border-fo-border pl-3 sm:flex">
                <span className="max-w-[10rem] truncate text-[10px] text-zinc-500" title={user?.displayName}>
                  {user?.displayName}
                </span>
                <button
                  type="button"
                  onClick={logout}
                  className="min-h-10 rounded-md border border-fo-border bg-fo-panel/80 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-zinc-200 hover:border-fo-gold hover:text-fo-gold-soft focus-ring-inset"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>

          <div
            className={
              chairmanExecutiveHome
                ? 'flex-1 w-full max-w-none p-0 pb-[max(1.5rem,env(safe-area-inset-bottom))]'
                : 'mx-auto w-full max-w-[1600px] flex-1 p-4 sm:p-6 lg:p-8 pb-[max(1.5rem,env(safe-area-inset-bottom))]'
            }
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
