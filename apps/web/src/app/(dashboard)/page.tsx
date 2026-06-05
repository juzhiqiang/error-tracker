'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Clock3,
  Database,
  RadioTower,
  Server,
  Users,
} from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyState } from '@/components/empty-state'
import { MetricCard } from '@/components/metric-card'
import { PageHeader, Panel } from '@/components/panel'
import { ProjectSelect } from '@/components/project-select'
import { LevelBadge, RatingBadge, StatusBadge } from '@/components/status-badge'
import { api, type HealthReport, type Issue, type PerformanceSummary, type Project, type TrendPoint } from '@/lib/api'
import { compactNumber, formatDateTime, formatMetricValue, toNumber } from '@/lib/format'
import { useI18n } from '@/lib/i18n'

export default function OverviewPage() {
  const { t } = useI18n()
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [issues, setIssues] = useState<Issue[]>([])
  const [total, setTotal] = useState(0)
  const [trend, setTrend] = useState<TrendPoint[]>([])
  const [performance, setPerformance] = useState<PerformanceSummary[]>([])
  const [health, setHealth] = useState<HealthReport | null>(null)
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
    Promise.all([
      api.issues.list({ projectId, timeRange: '30d', page: '1' }),
      api.stats.issues(projectId, 14).catch(() => []),
      api.stats.performance(projectId).catch(() => []),
      api.health().catch(() => null),
    ])
      .then(([issueResult, trendResult, performanceResult, healthResult]) => {
        setIssues(issueResult.rows)
        setTotal(issueResult.total)
        setTrend(trendResult)
        setPerformance(performanceResult)
        setHealth(healthResult)
        setError('')
      })
      .catch(() => {
        setIssues([])
        setTotal(0)
        setError(t('overview.loadError'))
      })
      .finally(() => setLoading(false))
  }, [projectId])

  const selectedProject = projects.find((item) => item.id === projectId)
  const unresolved = issues.filter((issue) => issue.status === 'unresolved').length
  const severe = issues.filter((issue) => issue.status === 'unresolved' && ['fatal', 'error'].includes(issue.level)).length
  const affectedUsers = issues.reduce((sum, issue) => sum + Number(issue.userCount ?? 0), 0)
  const recentIssues = issues.slice(0, 7)
  const healthItems = useMemo(() => Object.entries(health?.checks ?? {}), [health])
  const poorVitals = performance.filter((item) => item.rating === 'poor').reduce((sum, item) => sum + toNumber(item.count), 0)
  const trendRows = trend.map((item) => ({
    hour: formatDateTime(item.hour),
    count: toNumber(item.count),
  }))
  const topVital = [...performance].sort((a, b) => {
    const ratingWeight = { poor: 3, 'needs-improvement': 2, good: 1 }
    return ratingWeight[b.rating] - ratingWeight[a.rating] || toNumber(b.count) - toNumber(a.count)
  })[0]

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t('overview.eyebrow')}
        title={t('overview.title')}
        description={t('overview.description')}
        action={<ProjectSelect projects={projects} value={projectId} onChange={setProjectId} />}
      />

      {error && (
        <div className="rounded-md border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={t('overview.metric.total')}
          value={loading ? '...' : compactNumber(total)}
          hint={selectedProject ? selectedProject.slug : t('overview.metric.noProject')}
          icon={<AlertTriangle className="h-5 w-5 text-red-300" />}
          tone="danger"
        />
        <MetricCard
          label={t('overview.metric.unresolved')}
          value={loading ? '...' : unresolved}
          hint={t('overview.metric.window')}
          icon={<Clock3 className="h-5 w-5 text-amber-300" />}
          tone="warning"
        />
        <MetricCard
          label={t('overview.metric.priority')}
          value={loading ? '...' : severe}
          hint={t('overview.metric.priorityHint')}
          icon={<RadioTower className="h-5 w-5 text-indigo-300" />}
          tone="primary"
        />
        <MetricCard
          label={t('overview.metric.users')}
          value={loading ? '...' : compactNumber(affectedUsers)}
          hint={t('overview.metric.usersHint')}
          icon={<Users className="h-5 w-5 text-emerald-300" />}
          tone="success"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        <Panel
          title={t('overview.trend.title')}
          description={t('overview.trend.description')}
          action={
            <Link href="/issues" className="app-button inline-flex items-center gap-2 px-3 text-sm text-indigo-300 hover:bg-primary/10">
              {t('overview.trend.action')}
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          }
        >
          {trendRows.length === 0 ? (
            <EmptyState title={t('overview.trend.emptyTitle')} description={t('overview.trend.emptyDescription')} />
          ) : (
            <div className="h-[310px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendRows} margin={{ left: 0, right: 12, top: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="issueTrend" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#263244" strokeDasharray="3 3" />
                  <XAxis dataKey="hour" stroke="#7f8ca3" fontSize={12} minTickGap={26} />
                  <YAxis stroke="#7f8ca3" fontSize={12} allowDecimals={false} width={36} />
                  <Tooltip
                    contentStyle={{ background: '#0b1220', border: '1px solid #334155', borderRadius: 8, color: '#e5edf7' }}
                    labelStyle={{ color: '#a7b1c2' }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#818cf8" strokeWidth={2} fill="url(#issueTrend)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title={t('overview.health.title')} description={t('overview.health.description')}>
          <div className="space-y-3">
            <HealthRow label="API" ok={health?.ok} icon={<Activity className="h-4 w-4" />} />
            {healthItems.map(([name, item]) => (
              <HealthRow key={name} label={name.toUpperCase()} ok={item?.ok !== false} icon={<Database className="h-4 w-4" />} />
            ))}
            <div className="app-panel-muted p-4">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Server className="h-4 w-4" />
                {t('overview.health.ingest')}
              </div>
              <div className="mt-2 font-mono text-xl text-slate-100">
                {health?.ingest?.accepted ?? 0} / {health?.ingest?.rejected ?? 0}
              </div>
            </div>
            {topVital && (
              <div className="app-panel-muted p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="text-xs text-slate-400">{t('overview.health.topVital')}</div>
                  <RatingBadge rating={topVital.rating} />
                </div>
                <div className="font-mono text-lg text-slate-100">
                  {topVital.name} / {formatMetricValue(topVital.name, topVital.avg_value)}
                </div>
              </div>
            )}
          </div>
        </Panel>
      </section>

      <Panel
        title={t('overview.recent.title')}
        description={
          poorVitals > 0
            ? t('overview.recent.performancePoor', { count: poorVitals })
            : t('overview.recent.performanceGood')
        }
        action={
          <Link href="/issues" className="app-button inline-flex items-center gap-2 px-3 text-sm text-indigo-300 hover:bg-primary/10">
            {t('overview.recent.action')}
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        }
      >
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-md bg-slate-800/70" />
            ))}
          </div>
        ) : recentIssues.length === 0 ? (
          <EmptyState title={t('overview.recent.emptyTitle')} description={t('overview.recent.emptyDescription')} />
        ) : (
          <div className="overflow-hidden rounded-md border border-line">
            <div className="grid min-w-[860px] grid-cols-[128px_104px_minmax(0,1fr)_96px_140px] gap-4 border-b border-line bg-slate-950/55 px-4 py-2 text-xs font-medium text-slate-500">
              <span>{t('overview.table.status')}</span>
              <span>{t('overview.table.level')}</span>
              <span>{t('overview.table.issue')}</span>
              <span>{t('overview.table.events')}</span>
              <span className="text-right">{t('overview.table.lastSeen')}</span>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[860px] divide-y divide-line">
                {recentIssues.map((issue) => (
                  <Link
                    key={issue.id}
                    href={`/issues/${issue.id}`}
                    className="app-table-row grid min-h-[64px] grid-cols-[128px_104px_minmax(0,1fr)_96px_140px] items-center gap-4 px-4 py-3"
                  >
                    <StatusBadge status={issue.status} />
                    <LevelBadge level={issue.level} />
                    <div className="min-w-0">
                      <div className="truncate font-mono text-sm text-slate-100">{issue.title}</div>
                      <div className="mt-1 truncate font-mono text-xs text-slate-500">{issue.fingerprint}</div>
                    </div>
                    <span className="font-mono text-sm text-slate-300">{issue.count}</span>
                    <span className="text-right text-xs text-slate-500">{formatDateTime(issue.lastSeen)}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </Panel>
    </div>
  )
}

function HealthRow({ label, ok, icon }: { label: string; ok?: boolean; icon: React.ReactNode }) {
  const { t } = useI18n()
  const healthy = ok !== false
  return (
    <div className="app-panel-muted flex min-h-[44px] items-center justify-between px-3">
      <div className="flex items-center gap-2 text-sm text-slate-300">
        {icon}
        <span>{label}</span>
      </div>
      <span className={healthy ? 'text-sm font-medium text-emerald-300' : 'text-sm font-medium text-red-300'}>
        {healthy ? t('common.healthy') : t('common.check')}
      </span>
    </div>
  )
}
