type IconProps = { className?: string }

export function ChairmanIconReports({ className = 'h-6 w-6' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" d="M4 19V5m6 14V9m6 10V3m4 16v-7" />
    </svg>
  )
}

export function ChairmanIconTreasury({ className = 'h-6 w-6' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" d="M3 10h18M5 10V8a2 2 0 012-2h10a2 2 0 012 2v2M7 14h.01M12 14h.01" />
      <rect x="3" y="10" width="18" height="8" rx="2" />
    </svg>
  )
}

export function ChairmanIconCompliance({ className = 'h-6 w-6' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" d="M9 12h6m-6 4h4M8 4h8l1 3H7l1-3zM6 7h12v13H6V7z" />
    </svg>
  )
}

export function ChairmanIconHelp({ className = 'h-6 w-6' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" d="M8 10a4 4 0 118 0c0 2-2 2.5-3 3m0 4h.01" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}

export function ChairmanIconBell({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" d="M15 17H9l1 2h4l1-2zm-3-13a4 4 0 014 4v3l2 2H6l2-2v-3a4 4 0 014-4z" />
    </svg>
  )
}
