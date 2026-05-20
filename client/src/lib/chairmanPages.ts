/** Routes that use the full-width chairman executive shell (no institutional header). */
export const CHAIRMAN_EXECUTIVE_PATHS = ['/', '/treasury', '/reports', '/assets', '/documents'] as const

export function isChairmanExecutivePath(pathname: string): boolean {
  if (pathname === '/') return true
  return CHAIRMAN_EXECUTIVE_PATHS.some(
    (p) => p !== '/' && (pathname === p || pathname.startsWith(`${p}/`)),
  )
}
