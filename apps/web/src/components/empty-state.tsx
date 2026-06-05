import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-md border border-dashed border-slate-700/80 bg-slate-950/40 px-6 py-8 text-center">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-400">
        <Inbox className="h-5 w-5" />
      </div>
      <div className="text-sm font-semibold text-slate-100">{title}</div>
      <div className="mt-1 max-w-md text-sm leading-6 text-slate-400">{description}</div>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
