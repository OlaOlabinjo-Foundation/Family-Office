import { Link } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader'

export function NotFound() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Navigation"
        title="Page not found"
        description="No screen is registered for this address. Use the sidebar or the links below."
      />
      <div className="flex flex-wrap gap-3">
        <Link
          to="/"
          className="rounded-lg border border-fo-gold px-4 py-2 text-sm text-fo-gold-soft hover:bg-fo-gold/10 focus-ring-inset"
        >
          Command centre
        </Link>
        <Link
          to="/search"
          className="rounded-lg border border-fo-border px-4 py-2 text-sm text-zinc-300 hover:border-fo-gold/50 focus-ring-inset"
        >
          Global search
        </Link>
      </div>
    </div>
  )
}
