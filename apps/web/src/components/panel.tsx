import type { ReactNode } from 'react'

export function Panel({
  title,
  description,
  action,
  children,
  className = '',
  bodyClassName = '',
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={`app-panel overflow-hidden ${className}`}>
      <div className="app-panel-header flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
          {description && <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">{description}</p>}
        </div>
        {action}
      </div>
      <div className={`app-panel-body ${bodyClassName}`}>{children}</div>
    </section>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-indigo-300">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-semibold leading-tight text-slate-50 sm:text-[28px]">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{description}</p>
      </div>
      {action}
    </header>
  )
}
