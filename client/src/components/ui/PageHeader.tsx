type PageHeaderProps = {
  eyebrow?: string
  title: string
  description?: string
  actions?: React.ReactNode
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0 space-y-2">
        {eyebrow ? (
          <div className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">{eyebrow}</div>
        ) : null}
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-white tracking-tight md:text-4xl">{title}</h1>
        {description ? <p className="max-w-3xl text-sm leading-relaxed text-zinc-400">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
