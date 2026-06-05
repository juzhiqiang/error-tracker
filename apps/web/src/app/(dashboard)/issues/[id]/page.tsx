'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Clock3,
  Code2,
  Fingerprint,
  GitBranch,
  Globe2,
  Play,
  RotateCcw,
  Tags,
  User,
} from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { Panel } from '@/components/panel'
import { LevelBadge, StatusBadge } from '@/components/status-badge'
import { api, type Breadcrumb, type EventRow, type Issue, type IssueLevel, type IssueStatus, type StackFrame } from '@/lib/api'
import { compactNumber, formatFullDateTime, formatTime, stringifyRecord } from '@/lib/format'
import { useI18n } from '@/lib/i18n'

const statusActions: Array<{ status: IssueStatus; labelKey: string; icon: ReactNode }> = [
  { status: 'unresolved', labelKey: 'detail.action.reopen', icon: <RotateCcw className="h-4 w-4" /> },
  { status: 'resolved', labelKey: 'detail.action.resolve', icon: <CheckCircle2 className="h-4 w-4" /> },
  { status: 'ignored', labelKey: 'detail.action.ignore', icon: <Ban className="h-4 w-4" /> },
]

export default function IssueDetailPage() {
  const { t } = useI18n()
  const params = useParams<{ id: string }>()
  const issueId = params.id
  const [issue, setIssue] = useState<Issue | null>(null)
  const [events, setEvents] = useState<EventRow[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<IssueStatus | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!issueId) return
    setLoading(true)
    Promise.all([api.issues.get(issueId), api.issues.events(issueId)])
      .then(([issueResult, eventResult]) => {
        const ordered = [...eventResult].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        setIssue(issueResult)
        setEvents(ordered)
        setSelectedEventId((current) => current || ordered[0]?.id || '')
        setError('')
      })
      .catch(() => setError(t('detail.loadError')))
      .finally(() => setLoading(false))
  }, [issueId, t])

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? events[0],
    [events, selectedEventId],
  )

  async function updateStatus(status: IssueStatus) {
    if (!issue || issue.status === status) return
    setUpdating(status)
    try {
      const updated = await api.issues.update(issue.id, { status })
      setIssue(updated)
      toast.success(t('detail.toast.updated'))
    } catch {
      toast.error(t('detail.toast.updateFailed'))
    } finally {
      setUpdating(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-md bg-slate-800/70" />
        ))}
      </div>
    )
  }

  if (error || !issue) {
    return (
      <EmptyState
        title={t('detail.unavailableTitle')}
        description={error || t('detail.unavailableDescription')}
        action={
          <Link href="/issues" className="app-button inline-flex items-center rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover">
            {t('common.backToIssues')}
          </Link>
        }
      />
    )
  }

  return (
    <div className="space-y-5">
      <header className="space-y-4">
        <Link href="/issues" className="app-button inline-flex items-center gap-2 px-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100">
          <ArrowLeft className="h-4 w-4" />
          {t('common.backToIssues')}
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={issue.status} />
              <LevelBadge level={issue.level} />
              <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-500">
                {issue.id}
              </span>
            </div>
            <h1 className="break-words font-mono text-2xl font-semibold leading-tight text-slate-50">{issue.title}</h1>
            <p className="mt-3 max-w-5xl break-all font-mono text-xs leading-5 text-slate-500">
              {t('detail.fingerprint', { fingerprint: issue.fingerprint })}
            </p>
          </div>

          <Link
            href={`/issues/${issue.id}/replay`}
            className="app-button inline-flex items-center gap-2 border border-primary/40 bg-primary/10 px-4 text-sm font-medium text-indigo-200 hover:bg-primary/20"
          >
            <Play className="h-4 w-4" />
            {t('detail.openReplay')}
          </Link>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <Fact label={t('detail.fact.events')} value={compactNumber(issue.count)} icon={<Clock3 className="h-4 w-4 text-red-300" />} />
        <Fact label={t('detail.fact.users')} value={compactNumber(issue.userCount)} icon={<User className="h-4 w-4 text-amber-300" />} />
        <Fact label={t('detail.fact.firstSeen')} value={formatFullDateTime(issue.firstSeen)} icon={<GitBranch className="h-4 w-4 text-indigo-300" />} />
        <Fact label={t('detail.fact.lastSeen')} value={formatFullDateTime(issue.lastSeen)} icon={<Clock3 className="h-4 w-4 text-emerald-300" />} />
      </section>

      <section className="app-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">{t('detail.workflow.title')}</h2>
            <p className="mt-1 text-xs text-slate-400">{t('detail.workflow.description')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {statusActions.map((action) => (
              <button
                key={action.status}
                disabled={issue.status === action.status || updating !== null}
                onClick={() => updateStatus(action.status)}
                className="app-button inline-flex items-center gap-2 border border-slate-700 px-3 text-sm text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {action.icon}
                {updating === action.status ? t('detail.action.updating') : t(action.labelKey)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Panel title={t('detail.timeline.title')} description={t('detail.timeline.description', { count: events.length })}>
          {events.length === 0 ? (
            <EmptyState title={t('detail.timeline.emptyTitle')} description={t('detail.timeline.emptyDescription')} />
          ) : (
            <div className="space-y-2">
              {events.map((event) => {
                const active = event.id === selectedEvent?.id
                return (
                  <button
                    key={event.id}
                    onClick={() => setSelectedEventId(event.id)}
                    className={`w-full rounded-md border p-3 text-left transition ${
                      active ? 'border-primary/50 bg-primary/10' : 'border-line bg-slate-950/35 hover:bg-slate-800/55'
                    }`}
                  >
                    <div className="flex min-h-[28px] items-center justify-between gap-2">
                      <LevelBadge level={asIssueLevel(event.level)} />
                      <span className="font-mono text-xs text-slate-500">{formatFullDateTime(event.timestamp)}</span>
                    </div>
                    <div className="mt-2 line-clamp-2 font-mono text-xs leading-5 text-slate-300">{event.message}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                      {event.environment && <span>{event.environment}</span>}
                      {event.release && <span>{event.release}</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title={t('detail.stack.title')} description={t('detail.stack.description')}>
            <StackTrace frames={selectedEvent?.stacktrace ?? []} />
          </Panel>

          <Panel title={t('detail.breadcrumbs.title')} description={t('detail.breadcrumbs.description')}>
            <BreadcrumbTimeline items={selectedEvent?.breadcrumbs ?? []} />
          </Panel>

          <Panel title={t('detail.context.title')} description={t('detail.context.description')}>
            {selectedEvent ? <EventContext event={selectedEvent} issue={issue} /> : <EmptyState title={t('detail.context.emptyTitle')} description={t('detail.context.emptyDescription')} />}
          </Panel>
        </div>
      </section>
    </div>
  )
}

function Fact({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="app-panel p-4">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-2 break-words font-mono text-sm font-semibold text-slate-100">{value}</div>
    </div>
  )
}

function StackTrace({ frames }: { frames: StackFrame[] | null }) {
  const { t } = useI18n()
  if (!frames?.length) return <EmptyState title={t('detail.stack.emptyTitle')} description={t('detail.stack.emptyDescription')} />
  return (
    <pre className="app-code overflow-x-auto p-4 text-xs text-slate-300">
      {frames
        .map((frame) => {
          const location = [frame.filename, frame.lineno, frame.colno].filter(Boolean).join(':')
          return `at ${frame.function || '<anonymous>'} (${location})`
        })
        .join('\n')}
    </pre>
  )
}

function BreadcrumbTimeline({ items }: { items: Breadcrumb[] | null }) {
  const { t } = useI18n()
  if (!items?.length) return <EmptyState title={t('detail.breadcrumbs.emptyTitle')} description={t('detail.breadcrumbs.emptyDescription')} />
  return (
    <div className="relative space-y-4 border-l border-slate-700 pl-5">
      {items.map((item, index) => (
        <div key={`${item.timestamp}-${index}`} className="relative">
          <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border border-primary bg-slate-950" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-slate-500">{formatTime(normalizeTimestamp(item.timestamp))}</span>
            <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-xs text-slate-300">{item.type}</span>
          </div>
          <div className="mt-1 break-words text-sm leading-6 text-slate-200">{item.message || stringifyRecord(item.data)}</div>
        </div>
      ))}
    </div>
  )
}

function EventContext({ event, issue }: { event: EventRow; issue: Issue }) {
  const { t } = useI18n()
  const tags = Object.entries(event.tags ?? {})
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ContextBlock icon={<Globe2 className="h-4 w-4" />} label={t('detail.context.environment')} value={event.environment || '-'} />
      <ContextBlock icon={<GitBranch className="h-4 w-4" />} label={t('detail.context.release')} value={event.release || '-'} />
      <ContextBlock icon={<Code2 className="h-4 w-4" />} label={t('detail.context.eventId')} value={event.id} />
      <ContextBlock icon={<Fingerprint className="h-4 w-4" />} label={t('detail.context.fingerprint')} value={issue.fingerprint} />

      <ContextPre icon={<User className="h-4 w-4" />} label={t('detail.context.user')} value={stringifyRecord(event.user)} />
      <ContextPre icon={<Globe2 className="h-4 w-4" />} label={t('detail.context.request')} value={stringifyRecord(event.request)} />

      <div className="app-panel-muted p-4 lg:col-span-2">
        <div className="mb-3 flex items-center gap-2 text-xs text-slate-400">
          <Tags className="h-4 w-4" />
          {t('detail.context.tags')}
        </div>
        {tags.length === 0 ? (
          <div className="text-sm text-slate-500">{t('detail.context.noTags')}</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map(([key, value]) => (
              <span key={key} className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-300">
                {key}: {value}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ContextBlock({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="app-panel-muted p-4">
      <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
        {icon}
        {label}
      </div>
      <div className="break-all font-mono text-sm text-slate-200">{value}</div>
    </div>
  )
}

function ContextPre({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="app-panel-muted p-4 lg:col-span-2">
      <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
        {icon}
        {label}
      </div>
      <pre className="overflow-x-auto font-mono text-xs leading-6 text-slate-300">{value}</pre>
    </div>
  )
}

function asIssueLevel(level: string): IssueLevel {
  return ['fatal', 'error', 'warning', 'info'].includes(level) ? (level as IssueLevel) : 'error'
}

function normalizeTimestamp(timestamp: number): number {
  return timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp
}
