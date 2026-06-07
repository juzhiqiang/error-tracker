'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Filter, Search } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/panel'
import { ProjectSelect } from '@/components/project-select'
import { LevelBadge, StatusBadge } from '@/components/status-badge'
import { api, type Issue, type IssueLevel, type IssueStatus, type Project, type TimeRange } from '@/lib/api'
import { compactNumber, formatDateTime } from '@/lib/format'
import { useI18n } from '@/lib/i18n'

const timeRanges: Array<{ value: TimeRange; labelKey: string }> = [
  { value: '1h', labelKey: 'issues.time.1h' },
  { value: '24h', labelKey: 'issues.time.24h' },
  { value: '7d', labelKey: 'issues.time.7d' },
  { value: '30d', labelKey: 'issues.time.30d' },
]

const statuses: Array<{ value: '' | IssueStatus; labelKey: string }> = [
  { value: '', labelKey: 'issues.status.all' },
  { value: 'unresolved', labelKey: 'status.unresolved' },
  { value: 'resolved', labelKey: 'status.resolved' },
  { value: 'ignored', labelKey: 'status.ignored' },
]

const levels: Array<{ value: '' | IssueLevel; labelKey: string }> = [
  { value: '', labelKey: 'issues.level.all' },
  { value: 'fatal', labelKey: 'level.fatal' },
  { value: 'error', labelKey: 'level.error' },
  { value: 'warning', labelKey: 'level.warning' },
  { value: 'info', labelKey: 'level.info' },
]

export default function IssuesPage() {
  const { t } = useI18n()
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [issues, setIssues] = useState<Issue[]>([])
  const [q, setQ] = useState('')
  const [timeRange, setTimeRange] = useState<TimeRange>('24h')
  const [status, setStatus] = useState<'' | IssueStatus>('')
  const [level, setLevel] = useState<'' | IssueLevel>('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.projects
      .list()
      .then((items) => {
        setProjects(items)
        setProjectId((current) => current || items[items.length - 1]?.id || '')
        if (items.length === 0) setLoading(false)
      })
      .catch(() => {
        setError(t('common.projectListError'))
        setLoading(false)
      })
  }, [t])

  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    const params: Record<string, string> = { projectId, timeRange, page: String(page) }
    if (q.trim()) params.q = q.trim()
    if (status) params.status = status
    if (level) params.level = level
    api.issues
      .list(params)
      .then((result) => {
        setIssues(result.rows)
        setTotal(result.total)
        setError('')
      })
      .catch(() => {
        setIssues([])
        setTotal(0)
        setError(t('issues.loadError'))
      })
      .finally(() => setLoading(false))
  }, [projectId, q, timeRange, status, level, page])

  const totalPages = Math.max(1, Math.ceil(total / 25))
  const summary = useMemo(
    () => ({
      unresolved: issues.filter((issue) => issue.status === 'unresolved').length,
      severe: issues.filter((issue) => ['fatal', 'error'].includes(issue.level)).length,
      users: issues.reduce((sum, issue) => sum + Number(issue.userCount ?? 0), 0),
    }),
    [issues],
  )

  function updateProject(nextProjectId: string) {
    setProjectId(nextProjectId)
    setPage(1)
  }

  function updateFilter(update: () => void) {
    update()
    setPage(1)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t('issues.eyebrow')}
        title={t('issues.title')}
        description={t('issues.description')}
        action={<ProjectSelect projects={projects} value={projectId} onChange={updateProject} />}
      />

      <section className="grid gap-3 md:grid-cols-4">
        <SummaryItem label={t('issues.summary.matching')} value={compactNumber(total)} />
        <SummaryItem label={t('issues.summary.unresolved')} value={summary.unresolved} />
        <SummaryItem label={t('issues.summary.priority')} value={summary.severe} />
        <SummaryItem label={t('issues.summary.users')} value={compactNumber(summary.users)} />
      </section>

      <section className="app-panel p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1 sm:min-w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={q}
              onChange={(event) => {
                setQ(event.target.value)
                setPage(1)
              }}
              placeholder={t('issues.search')}
              className="app-control w-full pl-9 pr-3 text-sm"
            />
          </div>
          <Select value={timeRange} onChange={(value) => updateFilter(() => setTimeRange(value as TimeRange))} options={timeRanges.map((item) => ({ value: item.value, label: t(item.labelKey) }))} />
          <Select value={status} onChange={(value) => updateFilter(() => setStatus(value as '' | IssueStatus))} options={statuses.map((item) => ({ value: item.value, label: t(item.labelKey) }))} />
          <Select value={level} onChange={(value) => updateFilter(() => setLevel(value as '' | IssueLevel))} options={levels.map((item) => ({ value: item.value, label: t(item.labelKey) }))} />
        </div>
      </section>

      {error && (
        <div className="rounded-md border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <section className="app-panel overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[960px]">
            <div className="grid grid-cols-[128px_104px_minmax(0,1fr)_96px_96px_150px] gap-4 border-b border-line bg-slate-950/50 px-4 py-2.5 text-xs font-medium text-slate-500">
              <span>{t('overview.table.status')}</span>
              <span>{t('overview.table.level')}</span>
              <span>{t('overview.table.issue')}</span>
              <span>{t('issues.table.users')}</span>
              <span>{t('overview.table.events')}</span>
              <span className="text-right">{t('overview.table.lastSeen')}</span>
            </div>
            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 7 }).map((_, index) => (
                  <div key={index} className="h-14 animate-pulse rounded-md bg-slate-800/70" />
                ))}
              </div>
            ) : issues.length === 0 ? (
              <div className="p-5">
                <EmptyState title={t('issues.emptyTitle')} description={t('issues.emptyDescription')} />
              </div>
            ) : (
              <div className="divide-y divide-line">
                {issues.map((issue) => (
                  <Link
                    key={issue.id}
                    href={`/issues/${issue.id}`}
                    className="app-table-row grid min-h-[68px] grid-cols-[128px_104px_minmax(0,1fr)_96px_96px_150px] items-center gap-4 px-4 py-3"
                  >
                    <StatusBadge status={issue.status} />
                    <LevelBadge level={issue.level} />
                    <div className="min-w-0">
                      <div className="truncate font-mono text-sm text-slate-100">{issue.title}</div>
                      <div className="mt-1 truncate font-mono text-xs text-slate-500">{issue.fingerprint}</div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {issue.assigneeUserId && <IssueMeta>{t('issues.meta.assignee', { id: issue.assigneeUserId })}</IssueMeta>}
                        {issue.fixedInRelease && <IssueMeta>{t('issues.meta.fixed', { release: issue.fixedInRelease })}</IssueMeta>}
                        {issue.regressedAt && <IssueMeta tone="danger">{t('issues.meta.regressed')}</IssueMeta>}
                        {issue.mergedIntoIssueId && <IssueMeta>{t('issues.meta.merged', { id: issue.mergedIntoIssueId })}</IssueMeta>}
                      </div>
                    </div>
                    <span className="font-mono text-sm text-slate-300">{issue.userCount}</span>
                    <span className="font-mono text-sm text-slate-300">{issue.count}</span>
                    <span className="text-right text-xs text-slate-500">{formatDateTime(issue.lastSeen)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <div>
          <Filter className="mr-2 inline h-4 w-4" />
          {t('issues.page', { page, totalPages })}
        </div>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="app-button inline-flex items-center gap-2 border border-slate-700 px-3 text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            {t('issues.previous')}
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((current) => current + 1)}
            className="app-button inline-flex items-center gap-2 border border-slate-700 px-3 text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t('issues.next')}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </div>
  )
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="app-control px-3 text-sm">
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

function SummaryItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="app-panel p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 font-mono text-2xl font-semibold text-slate-50">{value}</div>
    </div>
  )
}

function IssueMeta({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'danger' }) {
  const className = tone === 'danger' ? 'border-danger/30 bg-danger/10 text-red-200' : 'border-slate-700 bg-slate-900 text-slate-400'
  return <span className={`rounded-md border px-2 py-0.5 font-mono text-[11px] ${className}`}>{children}</span>
}
