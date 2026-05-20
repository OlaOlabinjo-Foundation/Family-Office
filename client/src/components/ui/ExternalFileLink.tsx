import { normalizeHttpUrl, truncateUrl } from '../../lib/externalLinks'

export function ExternalFileLink({
  href,
  label = 'Open file link',
  className = 'text-[11px] uppercase tracking-wider text-fo-gold-soft hover:text-fo-gold underline underline-offset-2',
}: {
  href: string | null | undefined
  label?: string
  className?: string
}) {
  const url = normalizeHttpUrl(href)
  if (!url) return null
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={className} title={url}>
      {label}
      <span className="sr-only"> ({truncateUrl(url)})</span>
    </a>
  )
}
