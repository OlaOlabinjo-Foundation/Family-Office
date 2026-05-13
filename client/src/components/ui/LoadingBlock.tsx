export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="space-y-4 py-10" role="status" aria-busy="true" aria-label={label}>
      <div className="h-3 w-44 rounded-md bg-fo-border motion-safe:animate-pulse" />
      <div className="h-3 max-w-md rounded-md bg-fo-border/70 motion-safe:animate-pulse" />
      <div className="h-3 max-w-xs rounded-md bg-fo-border/50 motion-safe:animate-pulse" />
      <p className="text-sm text-zinc-500">{label}</p>
    </div>
  )
}
