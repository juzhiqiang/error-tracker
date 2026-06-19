'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Activity, AlertTriangle, Gauge, MonitorDot, SignalHigh, Smartphone, TimerReset, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AiAnalysisPanel } from '@/components/ai-analysis-panel'
import { EmptyState } from '@/components/empty-state'
import { MetricCard } from '@/components/metric-card'
import { PageHeader, Panel } from '@/components/panel'
import { ProjectSelect } from '@/components/project-select'
import { RatingBadge } from '@/components/status-badge'
import { api, type AiAnalysis, type PerformanceDeviceDetail, type PerformanceDeviceSummary, type PerformanceSummary, type Project, type RelatedPerformanceSample } from '@/lib/api'
import { compactNumber, formatDateTime, formatMetricValue, toNumber } from '@/lib/format'
import { useI18n } from '@/lib/i18n'

const metricNames = ['LCP', 'FCP', 'FID', 'CLS', 'INP', 'TTFB'] as const
const timeWindows = [
  { label: '24h', days: 1 },
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
] as const
const ratingColor: Record<string, string> = {
  good: '#22c55e',
  'needs-improvement': '#f59e0b',
  poor: '#ef4444',
}

export default function PerformancePage() {
  const { t } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [data, setData] = useState<PerformanceSummary[]>([])
  const [devices, setDevices] = useState<PerformanceDeviceSummary[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState(searchParams.get('deviceId') ?? '')
  const [selectedSessionId, setSelectedSessionId] = useState(searchParams.get('sessionId') ?? '')
  const [deviceDetail, setDeviceDetail] = useState<PerformanceDeviceDetail | null>(null)
  const [deviceLoading, setDeviceLoading] = useState(false)
  const [timeWindow, setTimeWindow] = useState<(typeof timeWindows)[number]['days']>(7)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  useEffect(() => {
    api.projects
      .list()
      .then((items) => {
        setProjects(items)
        setProjectId((current) => current || searchParams.get('projectId') || items[items.length - 1]?.id || '')
        if (items.length === 0) setLoading(false)
      })
      .catch(() => {
        setError(t('common.projectListError'))
        setLoading(false)
      })
  }, [searchParams, t])

  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    setAiAnalysis(null)
    setAiError('')
    Promise.all([api.stats.performance(projectId, timeWindow), api.stats.performanceDevices(projectId, timeWindow)])
      .then(([result, deviceResult]) => {
        setData(result)
        setDevices(deviceResult)
        setError('')
      })
      .catch(() => {
        setData([])
        setDevices([])
        setError(t('performance.loadError'))
      })
      .finally(() => setLoading(false))
  }, [projectId, timeWindow, t])

  useEffect(() => {
    if (!projectId || !selectedDeviceId) {
      setDeviceDetail(null)
      return
    }
    setDeviceLoading(true)
    api.stats
      .performanceDevice(projectId, selectedDeviceId, timeWindow, selectedSessionId || undefined)
      .then(setDeviceDetail)
      .catch(() => setDeviceDetail(null))
      .finally(() => setDeviceLoading(false))
  }, [projectId, selectedDeviceId, selectedSessionId, timeWindow])

  const webVitalRows = useMemo(() => data.filter((item) => (item.kind ?? 'web-vital') === 'web-vital'), [data])
  const networkRows = useMemo(() => data.filter((item) => ['resource', 'http'].includes(item.kind ?? '')), [data])
  const longTaskRows = useMemo(() => data.filter((item) => item.kind === 'longtask'), [data])

  const metricCards = useMemo(
    () =>
      metricNames.map((name) => {
        const rows = webVitalRows.filter((item) => item.name === name)
        const count = rows.reduce((sum, item) => sum + toNumber(item.count), 0)
        const weighted = rows.reduce((sum, item) => sum + toNumber(item.avg_value) * toNumber(item.count), 0)
        const avg = count ? weighted / count : 0
        const rating = rows.find((item) => item.rating === 'poor')?.rating ?? rows.find((item) => item.rating === 'needs-improvement')?.rating ?? rows[0]?.rating ?? 'good'
        return { name, rows, count, avg, rating }
      }),
    [webVitalRows],
  )

  const chartRows = metricCards.map((metric) => ({
    name: metric.name,
    good: toNumber(metric.rows.find((item) => item.rating === 'good')?.count),
    needs: toNumber(metric.rows.find((item) => item.rating === 'needs-improvement')?.count),
    poor: toNumber(metric.rows.find((item) => item.rating === 'poor')?.count),
  }))

  const totalSamples = metricCards.reduce((sum, metric) => sum + metric.count, 0)
  const poorSamples = webVitalRows.filter((item) => item.rating === 'poor').reduce((sum, item) => sum + toNumber(item.count), 0)
  const coveredMetrics = metricCards.filter((metric) => metric.count > 0).length
  const networkTotal = networkRows.reduce((sum, item) => sum + toNumber(item.count), 0)
  const networkAvg = weightedAverage(networkRows)
  const networkSlowest = Math.max(0, ...networkRows.map((item) => toNumber(item.slowest ?? item.avg_value)))
  const networkErrors = networkRows
    .filter((item) => Number(item.status) >= 400)
    .reduce((sum, item) => sum + toNumber(item.count), 0)
  const longTaskTotal = longTaskRows.reduce((sum, item) => sum + toNumber(item.count), 0)
  const longTaskAvg = weightedAverage(longTaskRows)
  const longTaskSlowest = Math.max(0, ...longTaskRows.map((item) => toNumber(item.slowest ?? item.avg_value)))
  const telemetryTotal = totalSamples + networkTotal + longTaskTotal

  async function generateAiAnalysis() {
    if (!projectId) return
    setAiLoading(true)
    setAiError('')
    try {
      const analysis = await api.stats.aiPerformance(projectId)
      setAiAnalysis(analysis)
      toast.success(t('performance.ai.toast.generated'))
    } catch {
      setAiError(t('performance.ai.error'))
      toast.error(t('performance.ai.error'))
    } finally {
      setAiLoading(false)
    }
  }

  function selectDevice(deviceId?: string, sessionId = '') {
    if (!deviceId || !projectId) return
    setSelectedDeviceId(deviceId)
    setSelectedSessionId(sessionId)
    router.replace(`/performance?${new URLSearchParams({ projectId, deviceId, ...(sessionId ? { sessionId } : {}) })}`)
  }

  function clearDeviceSelection() {
    setSelectedDeviceId('')
    setSelectedSessionId('')
    setDeviceDetail(null)
    if (projectId) router.replace(`/performance?${new URLSearchParams({ projectId })}`)
  }

  function changeProject(nextProjectId: string) {
    setProjectId(nextProjectId)
    setSelectedDeviceId('')
    setSelectedSessionId('')
    setDeviceDetail(null)
    if (nextProjectId) router.replace(`/performance?${new URLSearchParams({ projectId: nextProjectId })}`)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t('performance.eyebrow')}
        title={t('performance.title')}
        description={t('performance.description')}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex min-h-[44px] rounded-md border border-line bg-slate-950/40 p-1">
              {timeWindows.map((item) => (
                <button
                  key={item.days}
                  type="button"
                  onClick={() => setTimeWindow(item.days)}
                  className={`min-h-9 rounded px-3 text-sm transition ${
                    timeWindow === item.days
                      ? 'bg-primary text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <ProjectSelect projects={projects} value={projectId} onChange={changeProject} />
          </div>
        }
      />

      {error && (
        <div className="rounded-md border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard icon={<Activity className="h-5 w-5 text-indigo-300" />} label={t('performance.metric.total')} value={loading ? '...' : compactNumber(telemetryTotal)} tone="primary" />
        <MetricCard icon={<Gauge className="h-5 w-5 text-sky-300" />} label={t('performance.metric.webVitals')} value={loading ? '...' : compactNumber(totalSamples)} tone="primary" />
        <MetricCard icon={<SignalHigh className="h-5 w-5 text-red-300" />} label={t('performance.metric.poor')} value={loading ? '...' : compactNumber(poorSamples)} tone="danger" />
        <MetricCard icon={<MonitorDot className="h-5 w-5 text-emerald-300" />} label={t('performance.metric.covered')} value={`${coveredMetrics} / ${metricNames.length}`} tone="success" />
        <MetricCard icon={<SignalHigh className="h-5 w-5 text-indigo-300" />} label={t('performance.metric.network')} value={loading ? '...' : compactNumber(networkTotal)} tone="primary" />
        <MetricCard icon={<TimerReset className="h-5 w-5 text-amber-300" />} label={t('performance.metric.longTasks')} value={loading ? '...' : compactNumber(longTaskTotal)} tone="warning" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <Panel title={t('performance.distribution.title')} description={t('performance.distribution.description')}>
          {loading ? (
            <div className="h-[320px] animate-pulse rounded-md bg-slate-800/70" />
          ) : totalSamples === 0 ? (
            <EmptyState title={t('performance.emptyTitle')} description={t('performance.emptyDescription')} />
          ) : (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartRows} margin={{ left: 0, right: 12, top: 10, bottom: 0 }}>
                  <CartesianGrid stroke="#263244" strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="#7f8ca3" fontSize={12} />
                  <YAxis stroke="#7f8ca3" fontSize={12} allowDecimals={false} width={36} />
                  <Tooltip
                    contentStyle={{ background: '#0b1220', border: '1px solid #334155', borderRadius: 8, color: '#e5edf7' }}
                    formatter={(value, name) => [value, t(ratingLabelKey(name === 'needs' ? 'needs-improvement' : String(name)))]}
                  />
                  <Bar dataKey="good" stackId="a" fill={ratingColor.good} />
                  <Bar dataKey="needs" stackId="a" fill={ratingColor['needs-improvement']} />
                  <Bar dataKey="poor" stackId="a" fill={ratingColor.poor} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title={t('performance.threshold.title')} description={t('performance.threshold.description')}>
          <div className="space-y-3">
            <Threshold icon={<Gauge className="h-4 w-4 text-indigo-300" />} name="LCP" good="< 2500 ms" poor="> 4000 ms" />
            <Threshold icon={<Gauge className="h-4 w-4 text-sky-300" />} name="FCP" good="< 1800 ms" poor="> 3000 ms" />
            <Threshold icon={<Zap className="h-4 w-4 text-amber-300" />} name="INP" good="< 200 ms" poor="> 500 ms" />
            <Threshold icon={<TimerReset className="h-4 w-4 text-emerald-300" />} name="CLS" good="< 0.1" poor="> 0.25" />
            <Threshold icon={<Activity className="h-4 w-4 text-sky-300" />} name="TTFB" good="< 800 ms" poor="> 1800 ms" />
          </div>
        </Panel>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {metricCards.map((metric) => (
          <div key={metric.name} className="app-panel p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-xl font-semibold text-slate-50">{metric.name}</div>
                <div className="mt-1 text-xs text-slate-500">{t('performance.avg', { value: formatMetricValue(metric.name, metric.avg) })}</div>
              </div>
              <RatingBadge rating={metric.rating} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {['good', 'needs-improvement', 'poor'].map((rating) => {
                const row = metric.rows.find((item) => item.rating === rating)
                return (
                  <div key={rating} className="app-panel-muted p-2">
                    <div className="h-1 rounded-full" style={{ background: ratingColor[rating] }} />
                    <div className="mt-2 font-mono text-sm text-slate-100">{compactNumber(row?.count ?? 0)}</div>
                    <div className="mt-1 text-[11px] text-slate-500">{t(ratingLabelKey(rating))}</div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
      <Panel title={t('performance.devices.title')} description={t('performance.devices.description')}>
        {loading ? (
          <div className="h-[260px] animate-pulse rounded-md bg-slate-800/70" />
        ) : devices.length === 0 ? (
          <EmptyState title={t('performance.devices.emptyTitle')} description={t('performance.devices.emptyDescription')} />
        ) : (
          <div className="overflow-hidden rounded-md border border-slate-800">
            <div className="grid grid-cols-[minmax(180px,1.1fr)_repeat(5,minmax(80px,0.55fr))] gap-3 border-b border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-500">
              <span>{t('performance.devices.device')}</span>
              <span>{t('performance.devices.sessions')}</span>
              <span>{t('performance.devices.samples')}</span>
              <span>{t('performance.devices.poor')}</span>
              <span>{t('performance.devices.slowest')}</span>
              <span>{t('performance.devices.errors')}</span>
            </div>
            {devices.map((device) => (
              <button
                key={device.deviceId ?? `${device.browser}-${device.os}-${device.lastSeen}`}
                type="button"
                onClick={() => selectDevice(device.deviceId)}
                className={`grid w-full grid-cols-[minmax(180px,1.1fr)_repeat(5,minmax(80px,0.55fr))] gap-3 border-b border-slate-800 px-3 py-3 text-left text-sm last:border-b-0 hover:bg-slate-800/60 ${selectedDeviceId === device.deviceId ? 'bg-primary/10 ring-1 ring-primary/40' : ''}`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-slate-100">
                    <Smartphone className="h-4 w-4 text-indigo-300" />
                    <span className="truncate">{[device.browser, device.os, device.deviceType].filter(Boolean).join(' / ') || t('common.unknown')}</span>
                  </div>
                  <div className="mt-1 truncate font-mono text-xs text-slate-500">{device.deviceId ?? '-'}</div>
                  <div className="mt-1 text-xs text-slate-500">{formatDateTime(device.lastSeen)}</div>
                </div>
                <Cell>{compactNumber(device.sessionCount)}</Cell>
                <Cell>{compactNumber(device.sampleCount)}</Cell>
                <Cell tone={device.poorCount > 0 ? 'danger' : 'neutral'}>{compactNumber(device.poorCount)}</Cell>
                <Cell>{formatMetricValue('LCP', device.slowest)}</Cell>
                <Cell tone={device.relatedErrorCount > 0 ? 'warning' : 'neutral'}>{compactNumber(device.relatedErrorCount)}</Cell>
              </button>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title={t('performance.deviceDetail.title')}
        description={selectedDeviceId ? selectedDeviceId : t('performance.deviceDetail.description')}
        action={
          selectedDeviceId ? (
            <button type="button" onClick={clearDeviceSelection} className="app-button px-3 text-sm text-slate-300 hover:bg-slate-800">
              {t('common.clear')}
            </button>
          ) : undefined
        }
      >
        <DeviceDetailPanel detail={deviceDetail} loading={deviceLoading} />
      </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <Panel title={t('performance.network.title')} description={t('performance.network.description')}>
          {loading ? (
            <div className="h-[260px] animate-pulse rounded-md bg-slate-800/70" />
          ) : networkTotal === 0 ? (
            <EmptyState title={t('performance.network.emptyTitle')} description={t('performance.network.emptyDescription')} />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <MetricCard icon={<SignalHigh className="h-5 w-5 text-indigo-300" />} label={t('performance.network.total')} value={compactNumber(networkTotal)} tone="primary" />
                <MetricCard icon={<Gauge className="h-5 w-5 text-emerald-300" />} label={t('performance.network.avg')} value={formatMetricValue('LCP', networkAvg)} tone="success" />
                <MetricCard icon={<TimerReset className="h-5 w-5 text-amber-300" />} label={t('performance.network.slowest')} value={formatMetricValue('LCP', networkSlowest)} tone="warning" />
                <MetricCard icon={<Activity className="h-5 w-5 text-red-300" />} label={t('performance.network.errors')} value={compactNumber(networkErrors)} tone="danger" />
              </div>
              <div className="overflow-hidden rounded-md border border-slate-800">
                {networkRows.slice(0, 8).map((row, index) => (
                  <div key={`${row.kind}-${row.name}-${row.status}-${row.method}-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 border-b border-slate-800 px-3 py-2 text-sm last:border-b-0 hover:bg-slate-800/60">
                    <div className="min-w-0">
                      <div className="truncate text-slate-100">{row.name}</div>
                      <div className="font-mono text-xs text-slate-500">{row.method ?? row.initiator_type ?? row.kind}</div>
                    </div>
                    <div className="font-mono text-slate-300">{row.status ?? '-'}</div>
                    <div className="font-mono text-slate-100">{formatMetricValue('LCP', toNumber(row.slowest ?? row.avg_value))}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>

        <Panel title={t('performance.longtask.title')} description={t('performance.longtask.description')}>
          {loading ? (
            <div className="h-[180px] animate-pulse rounded-md bg-slate-800/70" />
          ) : longTaskTotal === 0 ? (
            <EmptyState title={t('performance.longtask.emptyTitle')} description={t('performance.longtask.emptyDescription')} />
          ) : (
            <div className="grid gap-3">
              <MetricCard icon={<Activity className="h-5 w-5 text-red-300" />} label={t('performance.longtask.count')} value={compactNumber(longTaskTotal)} tone="danger" />
              <MetricCard icon={<Gauge className="h-5 w-5 text-indigo-300" />} label={t('performance.longtask.avg')} value={formatMetricValue('LCP', longTaskAvg)} tone="primary" />
              <MetricCard icon={<TimerReset className="h-5 w-5 text-amber-300" />} label={t('performance.longtask.slowest')} value={formatMetricValue('LCP', longTaskSlowest)} tone="warning" />
            </div>
          )}
        </Panel>
      </section>

      <AiAnalysisPanel
        title={t('performance.ai.title')}
        description={t('performance.ai.description')}
        analyzeLabel={t('performance.ai.action')}
        emptyTitle={t('performance.ai.emptyTitle')}
        emptyDescription={t('performance.ai.emptyDescription')}
        analysis={aiAnalysis}
        loading={aiLoading}
        error={aiError}
        disabled={!projectId}
        onAnalyze={generateAiAnalysis}
      />
    </div>
  )
}

function DeviceDetailPanel({ detail, loading }: { detail: PerformanceDeviceDetail | null; loading: boolean }) {
  const { t } = useI18n()
  if (loading) return <div className="h-[260px] animate-pulse rounded-md bg-slate-800/70" />
  if (!detail) return <EmptyState title={t('performance.deviceDetail.emptyTitle')} description={t('performance.deviceDetail.emptyDescription')} />

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard icon={<Gauge className="h-5 w-5 text-indigo-300" />} label={t('performance.deviceDetail.samples')} value={compactNumber(detail.samples.length)} tone="primary" />
        <MetricCard icon={<AlertTriangle className="h-5 w-5 text-red-300" />} label={t('performance.deviceDetail.errors')} value={compactNumber(detail.relatedErrors.length)} tone="danger" />
        <MetricCard icon={<Smartphone className="h-5 w-5 text-emerald-300" />} label={t('performance.deviceDetail.session')} value={detail.sessionId ? '1' : '-'} tone="success" />
      </div>
      <div className="space-y-2">
        <div className="text-xs font-medium text-slate-400">{t('performance.deviceDetail.samplesTitle')}</div>
        {detail.samples.length === 0 ? (
          <div className="text-sm text-slate-500">{t('performance.deviceDetail.noSamples')}</div>
        ) : (
          detail.samples.slice(0, 8).map((sample, index) => <SampleRow key={`${sample.id ?? index}-${sample.timestamp}`} sample={sample} />)
        )}
      </div>
      <div className="space-y-2 border-t border-line pt-4">
        <div className="text-xs font-medium text-slate-400">{t('performance.deviceDetail.errorsTitle')}</div>
        {detail.relatedErrors.length === 0 ? (
          <div className="text-sm text-slate-500">{t('performance.deviceDetail.noErrors')}</div>
        ) : (
          detail.relatedErrors.slice(0, 6).map((issue) => (
            <Link key={`${issue.id}-${issue.event_id}`} href={`/issues/${issue.id}`} className="block rounded-md border border-line bg-slate-950/30 p-3 hover:bg-slate-800/60">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 truncate font-mono text-sm text-slate-100">{issue.title}</div>
                <span className="font-mono text-xs text-slate-500">{formatDateTime(issue.timestamp)}</span>
              </div>
              <div className="mt-1 truncate text-xs text-slate-500">{issue.message}</div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}

function SampleRow({ sample }: { sample: RelatedPerformanceSample }) {
  const value = toNumber(sample.duration ?? sample.value)
  const poor = sample.rating === 'poor' || value >= 2500
  return (
    <div className="rounded-md border border-line bg-slate-950/30 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-slate-100">{sample.name}</span>
            <span className={`rounded-md border px-2 py-0.5 text-xs ${poor ? 'border-danger/35 bg-danger/10 text-red-200' : 'border-slate-700 text-slate-300'}`}>{sample.rating ?? sample.kind ?? '-'}</span>
          </div>
          <div className="mt-1 truncate font-mono text-xs text-slate-500">{sample.route || sample.page_url || sample.url || '-'}</div>
        </div>
        <div className={`font-mono text-sm ${poor ? 'text-red-200' : 'text-slate-100'}`}>{formatMetricValue(sample.name, value)}</div>
      </div>
    </div>
  )
}

function Cell({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'danger' | 'warning' }) {
  const className =
    tone === 'danger'
      ? 'text-red-200'
      : tone === 'warning'
        ? 'text-amber-200'
        : 'text-slate-200'
  return <div className={`flex items-center gap-1 font-mono text-sm ${className}`}>{tone !== 'neutral' && <AlertTriangle className="h-3.5 w-3.5" />}{children}</div>
}

function Threshold({ icon, name, good, poor }: { icon: React.ReactNode; name: string; good: string; poor: string }) {
  const { t } = useI18n()
  return (
    <div className="app-panel-muted p-4">
      <div className="flex items-center gap-2 font-mono text-sm text-slate-100">
        {icon}
        {name}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md border border-success/35 bg-success/10 px-2 py-1 text-emerald-200">{t('performance.good')} {good}</div>
        <div className="rounded-md border border-danger/35 bg-danger/10 px-2 py-1 text-red-200">{t('performance.poor')} {poor}</div>
      </div>
    </div>
  )
}

function ratingLabelKey(rating?: string): string {
  return (
    {
      good: 'rating.good',
      'needs-improvement': 'rating.needs',
      poor: 'rating.poor',
    }[rating ?? ''] ?? 'common.unknown'
  )
}

function weightedAverage(rows: PerformanceSummary[]): number {
  const count = rows.reduce((sum, item) => sum + toNumber(item.count), 0)
  const weighted = rows.reduce((sum, item) => sum + toNumber(item.avg_value) * toNumber(item.count), 0)
  return count ? weighted / count : 0
}
