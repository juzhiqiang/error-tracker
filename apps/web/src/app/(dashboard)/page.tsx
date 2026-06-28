'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Database,
  FileCode2,
  Globe2,
  PackageCheck,
  RadioTower,
  Server,
  ShieldAlert,
  Workflow,
  Users,
} from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyState } from '@/components/empty-state'
import { MetricCard } from '@/components/metric-card'
import { PageHeader, Panel } from '@/components/panel'
import { ProjectSelect } from '@/components/project-select'
import { LevelBadge, RatingBadge, StatusBadge } from '@/components/status-badge'
import { WorldAccessMap } from '@/components/world-access-map'
import {
  api,
  type GeoDistributionPoint,
  type HealthReport,
  type Issue,
  type PerformanceDeviceSummary,
  type PerformanceSummary,
  type Project,
  type QueueOperationsReport,
  type TrendPoint,
} from '@/lib/api'
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
  const [devices, setDevices] = useState<PerformanceDeviceSummary[]>([])
  const [geo, setGeo] = useState<GeoDistributionPoint[]>([])
  const [health, setHealth] = useState<HealthReport | null>(null)
  const [operations, setOperations] = useState<QueueOperationsReport | null>(null)
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
      api.stats.issues(projectId, 14),
      api.stats.performance(projectId),
      api.stats.performanceDevices(projectId),
      api.stats.geo(projectId),
      api.health(),
      api.operations.queues(projectId),
    ])
      .then(([issueResult, trendResult, performanceResult, deviceResult, geoResult, healthResult, operationsResult]) => {
        setIssues(issueResult.rows)
        setTotal(issueResult.total)
        setTrend(trendResult)
        setPerformance(performanceResult)
        setDevices(deviceResult)
        setGeo(geoResult)
        setHealth(healthResult)
        setOperations(operationsResult)
        setError('')
      })
      .catch(() => {
        setError(t('overview.loadError'))
      })
      .finally(() => setLoading(false))
  }, [projectId, t])

  const hasLoadError = Boolean(error)
  const selectedProject = projects.find((item) => item.id === projectId)
  const unresolved = issues.filter((issue) => issue.status === 'unresolved').length
  const severe = issues.filter((issue) => issue.status === 'unresolved' && ['fatal', 'error'].includes(issue.level)).length
  const affectedUsers = issues.reduce((sum, issue) => sum + Number(issue.userCount ?? 0), 0)
  const recentIssues = issues.slice(0, 7)
  const healthItems = useMemo(() => Object.entries(health?.checks ?? {}), [health])
  const webVitals = performance.filter((item) => (item.kind ?? 'web-vital') === 'web-vital')
  const poorVitals = webVitals.filter((item) => item.rating === 'poor').reduce((sum, item) => sum + toNumber(item.count), 0)
  const rejectedIngest = toNumber(health?.ingest?.rejected)
  const failedQueueJobs = Object.values(operations ?? {}).reduce(
    (sum, item) => sum + toNumber(item.counts?.failed) + (item.failedJobs?.length ?? 0),
    0,
  )
  const activeSignals = [severe, poorVitals, rejectedIngest, failedQueueJobs].filter((value) => value > 0).length
  const trendRows = trend.map((item) => ({
    hour: formatDateTime(item.hour),
    count: toNumber(item.count),
  }))
  const topVital = [...webVitals].sort((a, b) => {
    const ratingWeight = { poor: 3, 'needs-improvement': 2, good: 1 }
    return ratingWeight[b.rating ?? 'good'] - ratingWeight[a.rating ?? 'good'] || toNumber(b.count) - toNumber(a.count)
  })[0]
  const topVitalRating = topVital?.rating ?? 'good'
  const webVitalCount = webVitals.reduce((sum, item) => sum + toNumber(item.count), 0)

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
          value={loading ? '...' : hasLoadError ? '-' : compactNumber(total)}
          hint={selectedProject ? selectedProject.slug : t('overview.metric.noProject')}
          icon={<AlertTriangle className="h-5 w-5 text-red-300" />}
          tone="danger"
        />
        <MetricCard
          label={t('overview.metric.unresolved')}
          value={loading ? '...' : hasLoadError ? '-' : unresolved}
          hint={t('overview.metric.window')}
          icon={<Clock3 className="h-5 w-5 text-amber-300" />}
          tone="warning"
        />
        <MetricCard
          label={t('overview.metric.priority')}
          value={loading ? '...' : hasLoadError ? '-' : severe}
          hint={t('overview.metric.priorityHint')}
          icon={<RadioTower className="h-5 w-5 text-indigo-300" />}
          tone="primary"
        />
        <MetricCard
          label={t('overview.metric.users')}
          value={loading ? '...' : hasLoadError ? '-' : compactNumber(affectedUsers)}
          hint={t('overview.metric.usersHint')}
          icon={<Users className="h-5 w-5 text-emerald-300" />}
          tone="success"
        />
      </section>

      <Panel
        title={t('overview.webSetup.title')}
        description={t('overview.webSetup.description')}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/settings" className="app-button inline-flex items-center gap-2 border border-primary/35 bg-primary/10 px-3 text-sm text-indigo-200 hover:bg-primary/15">
              <PackageCheck className="h-4 w-4" />
              {t('overview.webSetup.openSettings')}
            </Link>
            <Link href="/docs#verify-ingestion" className="app-button inline-flex items-center gap-2 border border-slate-700 px-3 text-sm text-slate-200 hover:bg-slate-800">
              <ArrowUpRight className="h-4 w-4" />
              {t('overview.webSetup.openDocs')}
            </Link>
          </div>
        }
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <WebSetupItem
            icon={<PackageCheck className="h-4 w-4" />}
            label={t('overview.webSetup.projectStep')}
            value={selectedProject ? t('overview.webSetup.projectReady') : t('overview.webSetup.projectPending')}
            ready={Boolean(selectedProject)}
          />
          <WebSetupItem
            icon={<AlertTriangle className="h-4 w-4" />}
            label={t('overview.webSetup.issueStep')}
            value={hasLoadError ? t('overview.loadError') : total > 0 ? t('overview.webSetup.issueReady', { count: compactNumber(total) }) : t('overview.webSetup.issuePending')}
            ready={!hasLoadError && total > 0}
          />
          <WebSetupItem
            icon={<Activity className="h-4 w-4" />}
            label={t('overview.webSetup.performanceStep')}
            value={hasLoadError ? t('overview.loadError') : webVitalCount > 0 ? t('overview.webSetup.performanceReady', { count: compactNumber(webVitalCount) }) : t('overview.webSetup.performancePending')}
            ready={!hasLoadError && webVitalCount > 0}
          />
          <WebSetupItem
            icon={<FileCode2 className="h-4 w-4" />}
            label={t('overview.webSetup.sourcemapStep')}
            value={t('overview.webSetup.sourcemapHint')}
            ready={false}
          />
        </div>
      </Panel>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,0.75fr)]">
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
          {hasLoadError ? (
            <EmptyState title={t('overview.trend.emptyTitle')} description={t('overview.loadError')} />
          ) : trendRows.length === 0 ? (
            <EmptyState title={t('overview.trend.emptyTitle')} description={t('overview.trend.emptyDescription')} />
          ) : (
            <div className="h-[330px]">
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

        <Panel title={t('overview.risk.title')} description={t('overview.risk.description')}>
          <div className="grid gap-3">
            <RiskBlock
              icon={<ShieldAlert className="h-4 w-4" />}
              label={t('overview.risk.score')}
              value={loading ? '...' : hasLoadError ? '-' : `${activeSignals} / 4`}
              detail={hasLoadError ? t('overview.loadError') : activeSignals > 0 ? t('overview.risk.review') : t('overview.risk.clear')}
              tone={hasLoadError || activeSignals > 0 ? 'danger' : 'success'}
            />
            <RiskBlock
              icon={<Activity className="h-4 w-4" />}
              label={t('overview.health.title')}
              value={hasLoadError ? '-' : health?.ok === false ? t('common.check') : t('common.healthy')}
              detail={hasLoadError ? t('overview.loadError') : `${healthItems.filter(([, item]) => item?.ok === false).length} / ${Math.max(1, healthItems.length)} ${t('overview.risk.failedChecks')}`}
              tone={hasLoadError || health?.ok === false ? 'danger' : 'success'}
            />
            <RiskBlock
              icon={<Server className="h-4 w-4" />}
              label={t('overview.health.ingest')}
              value={hasLoadError ? '-' : `${compactNumber(health?.ingest?.accepted ?? 0)} / ${compactNumber(rejectedIngest)}`}
              detail={hasLoadError ? t('overview.loadError') : t('overview.risk.acceptedRejected')}
              tone={hasLoadError ? 'danger' : rejectedIngest > 0 ? 'warning' : 'primary'}
            />
            <RiskBlock
              icon={<Workflow className="h-4 w-4" />}
              label={t('overview.risk.queue')}
              value={loading ? '...' : hasLoadError ? '-' : compactNumber(failedQueueJobs)}
              detail={hasLoadError ? t('overview.loadError') : t('overview.risk.failedJobs')}
              tone={hasLoadError || failedQueueJobs > 0 ? 'danger' : 'success'}
            />
            {topVital && (
              <div className="app-panel-muted p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="text-xs text-slate-400">{t('overview.health.topVital')}</div>
                  <RatingBadge rating={topVitalRating} />
                </div>
                <div className="font-mono text-lg text-slate-100">
                  {topVital.name} / {formatMetricValue(topVital.name, topVital.avg_value)}
                </div>
              </div>
            )}
            <div className="grid gap-2 pt-1">
              <HealthRow label="API" ok={hasLoadError ? false : health?.ok} icon={<Activity className="h-4 w-4" />} />
              {healthItems.slice(0, 4).map(([name, item]) => (
                <HealthRow key={name} label={name.toUpperCase()} ok={item?.ok !== false} icon={<Database className="h-4 w-4" />} />
              ))}
            </div>
          </div>
        </Panel>
      </section>

      <Panel title={t('overview.geo.title')} description={t('overview.geo.description')}>
        <WorldAccessMap data={hasLoadError ? [] : geo} emptyText={hasLoadError ? t('overview.loadError') : t('overview.geo.empty')} totalLabel={t('overview.geo.total')} />
      </Panel>

      <Panel
        title={t('overview.devices.title')}
        description={t('overview.devices.description')}
        action={
          <Link href={`/performance?${new URLSearchParams({ projectId })}`} className="app-button inline-flex items-center gap-2 px-3 text-sm text-indigo-300 hover:bg-primary/10">
            {t('nav.performance')}
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        }
      >
        {loading ? (
          <div className="grid gap-3 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-md bg-slate-800/70" />
            ))}
          </div>
        ) : hasLoadError ? (
          <EmptyState title={t('overview.devices.emptyTitle')} description={t('overview.loadError')} />
        ) : devices.length === 0 ? (
          <EmptyState title={t('overview.devices.emptyTitle')} description={t('overview.devices.emptyDescription')} />
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {devices.slice(0, 3).map((device) => (
              <Link
                key={device.deviceId ?? `${device.browser}-${device.lastSeen}`}
                href={`/performance?${new URLSearchParams({ projectId, ...(device.deviceId ? { deviceId: device.deviceId } : {}) })}`}
                className="app-panel-muted block p-4 hover:bg-slate-800/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-100">{[device.browser, device.os, device.deviceType].filter(Boolean).join(' / ') || t('common.unknown')}</div>
                    <div className="mt-1 truncate font-mono text-xs text-slate-500">{device.deviceId ?? '-'}</div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-500" />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <DeviceStat label={t('performance.devices.poor')} value={compactNumber(device.poorCount)} tone={device.poorCount > 0 ? 'danger' : 'neutral'} />
                  <DeviceStat label={t('performance.devices.samples')} value={compactNumber(device.sampleCount)} />
                  <DeviceStat label={t('performance.devices.errors')} value={compactNumber(device.relatedErrorCount)} tone={device.relatedErrorCount > 0 ? 'warning' : 'neutral'} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Panel>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel
          title={t('overview.recent.title')}
          description={
            hasLoadError
              ? t('overview.loadError')
              : poorVitals > 0
              ? t('overview.recent.performancePoor', { count: poorVitals })
              : t('overview.recent.performanceGood')
          }
          action={
            <Link href="/issues" className="app-button inline-flex items-center gap-2 px-3 text-sm text-indigo-300 hover:bg-primary/10">
              {t('overview.trend.action')}
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
          ) : hasLoadError ? (
            <EmptyState title={t('overview.recent.emptyTitle')} description={t('overview.loadError')} />
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

        <Panel title={t('overview.actions.title')} description={t('overview.actions.description')}>
          <div className="space-y-3">
            <ActionItem icon={<AlertTriangle className="h-4 w-4" />} label={t('overview.metric.priority')} value={hasLoadError ? '-' : severe} tone={hasLoadError || severe > 0 ? 'danger' : 'success'} />
            <ActionItem icon={<Activity className="h-4 w-4" />} label={t('overview.recent.performance')} value={hasLoadError ? '-' : poorVitals} tone={hasLoadError || poorVitals > 0 ? 'warning' : 'success'} />
            <ActionItem icon={<Workflow className="h-4 w-4" />} label={t('overview.risk.queue')} value={hasLoadError ? '-' : failedQueueJobs} tone={hasLoadError || failedQueueJobs > 0 ? 'danger' : 'success'} />
            <ActionItem icon={<Globe2 className="h-4 w-4" />} label={t('overview.geo.visited')} value={hasLoadError ? '-' : geo.length} tone="primary" />
          </div>
        </Panel>
      </section>
    </div>
  )
}

function RiskBlock({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ReactNode
  label: string
  value: string | number
  detail: string
  tone: 'danger' | 'warning' | 'success' | 'primary'
}) {
  const toneClass = {
    danger: 'border-danger/35 bg-danger/10 text-red-200',
    warning: 'border-warning/35 bg-warning/10 text-amber-200',
    success: 'border-success/35 bg-success/10 text-emerald-200',
    primary: 'border-primary/35 bg-primary/10 text-indigo-200',
  }[tone]
  return (
    <div className={`min-h-[72px] rounded-md border px-3 py-3 ${toneClass}`}>
      <div className="flex items-center gap-2 text-xs font-medium">
        {icon}
        {label}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="font-mono text-2xl leading-none text-slate-50">{value}</div>
        <div className="text-right text-xs text-slate-400">{detail}</div>
      </div>
    </div>
  )
}

function ActionItem({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode
  label: string
  value: number | string
  tone: 'danger' | 'warning' | 'success' | 'primary'
}) {
  const toneClass = {
    danger: 'text-red-300',
    warning: 'text-amber-300',
    success: 'text-emerald-300',
    primary: 'text-indigo-300',
  }[tone]
  return (
    <div className="app-panel-muted flex min-h-[56px] items-center justify-between gap-3 px-3">
      <div className="flex min-w-0 items-center gap-2 text-sm text-slate-300">
        <span className={toneClass}>{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <span className={`font-mono text-sm ${toneClass}`}>{typeof value === 'number' ? compactNumber(value) : value}</span>
    </div>
  )
}

function WebSetupItem({
  icon,
  label,
  value,
  ready,
}: {
  icon: ReactNode
  label: string
  value: string
  ready: boolean
}) {
  return (
    <div className={`app-panel-muted min-h-[116px] p-4 ${ready ? 'border-success/35 bg-success/10' : 'border-slate-700 bg-slate-950/35'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
          {icon}
          {label}
        </div>
        <CheckCircle2 className={`h-4 w-4 ${ready ? 'text-emerald-300' : 'text-slate-600'}`} />
      </div>
      <div className={`mt-3 text-sm leading-6 ${ready ? 'text-emerald-100' : 'text-slate-300'}`}>{value}</div>
    </div>
  )
}

function DeviceStat({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'danger' | 'warning' }) {
  const toneClass =
    tone === 'danger'
      ? 'text-red-200'
      : tone === 'warning'
        ? 'text-amber-200'
        : 'text-slate-200'
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/40 p-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`mt-1 font-mono text-sm ${toneClass}`}>{value}</div>
    </div>
  )
}

function HealthRow({ label, ok, icon }: { label: string; ok?: boolean; icon: ReactNode }) {
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
