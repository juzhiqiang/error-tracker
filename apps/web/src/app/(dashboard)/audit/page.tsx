'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CalendarClock,
  Database,
  Download,
  Filter,
  History,
  Search,
  ShieldCheck,
  Tag,
  UserRound,
} from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { MetricCard } from '@/components/metric-card'
import { PageHeader, Panel } from '@/components/panel'
import { ProjectSelect } from '@/components/project-select'
import { api, type AuditLogFilters, type AuditLogRow, type Project } from '@/lib/api'
import { compactNumber, formatDateTime, formatFullDateTime, stringifyRecord } from '@/lib/format'
import { useI18n } from '@/lib/i18n'

const targetTypeOptions = ['', 'project', 'issue', 'sourcemap', 'project_member', 'project_invitation'] as const

export default function AuditPage() {
  const { t } = useI18n()
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [actorUserId, setActorUserId] = useState('')
  const [action, setAction] = useState('')
  const [targetType, setTargetType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [rows, setRows] = useState<AuditLogRow[]>([])
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
    refresh(projectId)
  }, [projectId])

  const metrics = useMemo(() => {
    const actors = new Set(rows.map((row) => row.actorUserId || t('common.unknown')))
    const actions = new Set(rows.map((row) => row.action))
    return {
      total: rows.length,
      actors: actors.size,
      actions: actions.size,
      latest: rows[0]?.createdAt ? formatDateTime(rows[0].createdAt) : '-',
    }
  }, [rows, t])

  const exportHref = projectId ? api.auditLogs.exportUrl(buildFilters(projectId)) : ''

  async function refresh(nextProjectId = projectId) {
    if (!nextProjectId) return
    setLoading(true)
    try {
      setRows(await api.auditLogs.list(buildFilters(nextProjectId)))
      setError('')
    } catch {
      setRows([])
      setError(t('audit.loadError'))
    } finally {
      setLoading(false)
    }
  }

  function resetFilters() {
    setActorUserId('')
    setAction('')
    setTargetType('')
    setFrom('')
    setTo('')
  }

  function buildFilters(nextProjectId: string): AuditLogFilters {
    return {
      projectId: nextProjectId,
      actorUserId: actorUserId.trim() || undefined,
      action: action.trim() || undefined,
      targetType: targetType || undefined,
      from: toIsoDateTime(from),
      to: toIsoDateTime(to),
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t('audit.eyebrow')}
        title={t('audit.title')}
        description={t('audit.description')}
        action={<ProjectSelect projects={projects} value={projectId} onChange={setProjectId} />}
      />

      {error && (
        <div className="rounded-md border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<History className="h-5 w-5 text-indigo-300" />}
          label={t('audit.metric.rows')}
          value={loading ? '...' : compactNumber(metrics.total)}
          tone="primary"
        />
        <MetricCard
          icon={<UserRound className="h-5 w-5 text-cyan-300" />}
          label={t('audit.metric.actors')}
          value={loading ? '...' : compactNumber(metrics.actors)}
        />
        <MetricCard
          icon={<Tag className="h-5 w-5 text-emerald-300" />}
          label={t('audit.metric.actions')}
          value={loading ? '...' : compactNumber(metrics.actions)}
          tone="success"
        />
        <MetricCard
          icon={<CalendarClock className="h-5 w-5 text-amber-300" />}
          label={t('audit.metric.latest')}
          value={loading ? '...' : metrics.latest}
          tone="warning"
        />
      </section>

      <Panel title={t('audit.filters.title')} description={t('audit.filters.description')}>
        <div className="grid gap-3 lg:grid-cols-[minmax(180px,0.8fr)_minmax(180px,0.8fr)_180px_180px_180px]">
          <label className="block min-w-0">
            <span className="mb-1.5 block text-sm text-slate-300">{t('audit.filter.actor')}</span>
            <input
              value={actorUserId}
              onChange={(event) => setActorUserId(event.target.value)}
              placeholder="user-id"
              className="app-control w-full px-3 font-mono text-sm"
            />
          </label>
          <label className="block min-w-0">
            <span className="mb-1.5 block text-sm text-slate-300">{t('audit.filter.action')}</span>
            <input
              value={action}
              onChange={(event) => setAction(event.target.value)}
              placeholder="project.created"
              className="app-control w-full px-3 font-mono text-sm"
            />
          </label>
          <label className="block min-w-0">
            <span className="mb-1.5 block text-sm text-slate-300">{t('audit.filter.targetType')}</span>
            <select
              value={targetType}
              onChange={(event) => setTargetType(event.target.value)}
              className="app-control w-full px-3 text-sm"
            >
              {targetTypeOptions.map((item) => (
                <option key={item || 'all'} value={item}>
                  {item ? t(`audit.targetType.${item}`) : t('audit.targetType.all')}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0">
            <span className="mb-1.5 block text-sm text-slate-300">{t('audit.filter.from')}</span>
            <input
              type="datetime-local"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="app-control w-full px-3 text-sm"
            />
          </label>
          <label className="block min-w-0">
            <span className="mb-1.5 block text-sm text-slate-300">{t('audit.filter.to')}</span>
            <input
              type="datetime-local"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="app-control w-full px-3 text-sm"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <div className="inline-flex min-h-8 items-center gap-2 rounded-md border border-primary/35 bg-primary/10 px-2.5 text-xs font-medium text-indigo-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t('audit.guardHint')}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={resetFilters}
              className="app-button inline-flex items-center justify-center gap-2 border border-slate-700 px-3 text-sm text-slate-300 hover:bg-slate-900 hover:text-slate-50"
            >
              <Filter className="h-4 w-4" />
              {t('audit.action.reset')}
            </button>
            {exportHref ? (
              <a
                href={exportHref}
                className="app-button inline-flex min-h-[44px] items-center justify-center gap-2 border border-success/35 bg-success/10 px-3 text-sm font-medium text-emerald-200 hover:bg-success/15"
              >
                <Download className="h-4 w-4" />
                {t('audit.action.export')}
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="app-button inline-flex items-center justify-center gap-2 border border-slate-700 px-3 text-sm text-slate-500 opacity-60"
              >
                <Download className="h-4 w-4" />
                {t('audit.action.export')}
              </button>
            )}
            <button
              type="button"
              onClick={() => refresh(projectId)}
              disabled={!projectId || loading}
              className="app-button inline-flex items-center justify-center gap-2 bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Search className="h-4 w-4" />
              {loading ? t('audit.action.searching') : t('audit.action.search')}
            </button>
          </div>
        </div>
      </Panel>

      {!projectId && !loading ? (
        <EmptyState title={t('audit.emptyProjectTitle')} description={t('audit.emptyProjectDescription')} />
      ) : (
        <AuditTable rows={rows} loading={loading} />
      )}
    </div>
  )
}

function AuditTable({ rows, loading }: { rows: AuditLogRow[]; loading: boolean }) {
  const { t } = useI18n()

  return (
    <Panel title={t('audit.table.title')} description={t('audit.table.description')} bodyClassName="p-0">
      {loading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-md bg-slate-800/70" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="p-4">
          <EmptyState title={t('audit.emptyTitle')} description={t('audit.emptyDescription')} />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[1040px]">
            <div className="grid grid-cols-[180px_220px_190px_minmax(0,1fr)] gap-4 border-b border-line bg-slate-950/55 px-4 py-2.5 text-xs font-medium text-slate-500">
              <span>{t('audit.table.time')}</span>
              <span>{t('audit.table.action')}</span>
              <span>{t('audit.table.actor')}</span>
              <span>{t('audit.table.metadata')}</span>
            </div>
            <div className="divide-y divide-line">
              {rows.map((row, index) => (
                <div
                  key={`${row.createdAt}-${row.action}-${row.targetId ?? index}`}
                  className="app-table-row grid min-h-[76px] grid-cols-[180px_220px_190px_minmax(0,1fr)] items-center gap-4 px-4 py-3"
                >
                  <div className="font-mono text-xs text-slate-500">{formatFullDateTime(row.createdAt)}</div>
                  <div className="min-w-0 space-y-2">
                    <ActionBadge action={row.action} />
                    <div className="truncate font-mono text-xs text-slate-500">
                      {row.targetType}
                      {row.targetId ? ` / ${row.targetId}` : ''}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-mono text-xs text-slate-300">
                      {row.actorUserId || t('common.unknown')}
                    </div>
                    <div className="mt-1 truncate font-mono text-[11px] text-slate-600">{row.projectId}</div>
                  </div>
                  <pre className="max-h-24 overflow-auto whitespace-pre-wrap rounded-md border border-line bg-slate-950/45 p-2 font-mono text-xs leading-5 text-slate-400">
                    {stringifyRecord(row.metadata)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Panel>
  )
}

function ActionBadge({ action }: { action: string }) {
  const tone =
    action.startsWith('issue.')
      ? 'border-warning/35 bg-warning/10 text-amber-200'
      : action.startsWith('sourcemap.')
        ? 'border-success/35 bg-success/10 text-emerald-200'
        : action.includes('member') || action.includes('invitation')
          ? 'border-info/35 bg-info/10 text-cyan-200'
          : 'border-primary/35 bg-primary/10 text-indigo-200'

  return (
    <span className={`inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-md border px-2 font-mono text-xs ${tone}`}>
      <Database className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{action}</span>
    </span>
  )
}

function toIsoDateTime(value: string): string | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}
