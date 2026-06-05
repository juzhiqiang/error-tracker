import type { ReactNode } from 'react'

export function MetricCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
}: {
  label: string
  value: string | number
  hint?: string
  icon: ReactNode
  tone?: 'default' | 'danger' | 'success' | 'warning' | 'primary'
}) {
  const tones = {
    default: 'border-line',
    danger: 'border-danger/35 bg-danger/[0.07]',
    success: 'border-success/35 bg-success/[0.07]',
    warning: 'border-warning/35 bg-warning/[0.07]',
    primary: 'border-primary/35 bg-primary/[0.07]',
  }

  return (
    <div className={`app-panel p-4 ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-slate-400">{label}</div>
          <div className="mt-2 font-mono text-2xl font-semibold leading-none text-slate-50">{value}</div>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-950/55 text-slate-200">
          {icon}
        </div>
      </div>
      {hint && <div className="mt-3 truncate text-xs text-slate-500">{hint}</div>}
    </div>
  )
}
