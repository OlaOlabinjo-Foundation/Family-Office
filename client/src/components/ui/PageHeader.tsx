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
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-white tracking-tight sm:text-3xl md:text-4xl">
          {title}
        </h1>
        {description ? <p className="max-w-3xl text-sm leading-relaxed text-zinc-400">{description}</p> : null}
      </div>
      {actions ? (
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center [&_button]:btn-touch [&_a]:btn-touch">
          {actions}
        </div>
      ) : null}
    </div>
  )
}
