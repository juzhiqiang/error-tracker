'use client'

import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info, MinusCircle, ShieldAlert, SignalHigh, TriangleAlert } from 'lucide-react'
import type { IssueLevel, IssueStatus } from '@/lib/api'
import { useI18n } from '@/lib/i18n'

const statusMap: Record<IssueStatus, { labelKey: string; className: string; icon: ReactNode }> = {
  unresolved: {
    labelKey: 'status.unresolved',
    className: 'border-danger/35 bg-danger/10 text-red-200',
    icon: <AlertCircle className="h-3.5 w-3.5" />,
  },
  resolved: {
    labelKey: 'status.resolved',
    className: 'border-success/35 bg-success/10 text-emerald-200',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  ignored: {
    labelKey: 'status.ignored',
    className: 'border-slate-700 bg-slate-800 text-slate-300',
    icon: <MinusCircle className="h-3.5 w-3.5" />,
  },
}

const levelMap: Record<IssueLevel, { labelKey: string; className: string; icon: ReactNode }> = {
  fatal: {
    labelKey: 'level.fatal',
    className: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
    icon: <ShieldAlert className="h-3.5 w-3.5" />,
  },
  error: {
    labelKey: 'level.error',
    className: 'border-danger/35 bg-danger/10 text-red-200',
    icon: <AlertCircle className="h-3.5 w-3.5" />,
  },
  warning: {
    labelKey: 'level.warning',
    className: 'border-warning/40 bg-warning/10 text-amber-200',
    icon: <TriangleAlert className="h-3.5 w-3.5" />,
  },
  info: {
    labelKey: 'level.info',
    className: 'border-info/40 bg-info/10 text-sky-200',
    icon: <Info className="h-3.5 w-3.5" />,
  },
}

const ratingMap: Record<string, { labelKey: string; className: string; icon: ReactNode }> = {
  good: {
    labelKey: 'rating.good',
    className: 'border-success/35 bg-success/10 text-emerald-200',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  'needs-improvement': {
    labelKey: 'rating.needs',
    className: 'border-warning/40 bg-warning/10 text-amber-200',
    icon: <SignalHigh className="h-3.5 w-3.5" />,
  },
  poor: {
    labelKey: 'rating.poor',
    className: 'border-danger/35 bg-danger/10 text-red-200',
    icon: <TriangleAlert className="h-3.5 w-3.5" />,
  },
}

export function StatusBadge({ status }: { status: IssueStatus }) {
  const item = statusMap[status] ?? statusMap.unresolved
  return <TranslatedBadge className={item.className} icon={item.icon} labelKey={item.labelKey} />
}

export function LevelBadge({ level }: { level: IssueLevel }) {
  const item = levelMap[level] ?? levelMap.error
  return <TranslatedBadge className={item.className} icon={item.icon} labelKey={item.labelKey} />
}

export function RatingBadge({ rating }: { rating: string }) {
  const item = ratingMap[rating] ?? ratingMap.good
  return <TranslatedBadge className={item.className} icon={item.icon} labelKey={item.labelKey} />
}

function TranslatedBadge({ className, icon, labelKey }: { className: string; icon: ReactNode; labelKey: string }) {
  const { t } = useI18n()
  return <Badge className={className} icon={icon} label={t(labelKey)} />
}

function Badge({ className, icon, label }: { className: string; icon: ReactNode; label: string }) {
  return (
    <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-medium ${className}`}>
      {icon}
      {label}
    </span>
  )
}
