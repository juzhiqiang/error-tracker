'use client'

import { useEffect, useMemo, useState } from 'react'
import { Activity, Gauge, MonitorDot, SignalHigh, TimerReset, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AiAnalysisPanel } from '@/components/ai-analysis-panel'
import { EmptyState } from '@/components/empty-state'
import { MetricCard } from '@/components/metric-card'
import { PageHeader, Panel } from '@/components/panel'
import { ProjectSelect } from '@/components/project-select'
import { RatingBadge } from '@/components/status-badge'
import { api, type AiAnalysis, type PerformanceSummary, type Project } from '@/lib/api'
import { compactNumber, formatMetricValue, toNumber } from '@/lib/format'
import { useI18n } from '@/lib/i18n'

const metricNames = ['LCP', 'FID', 'CLS', 'INP', 'TTFB'] as const
const ratingColor: Record<string, string> = {
  good: '#22c55e',
  'needs-improvement': '#f59e0b',
  poor: '#ef4444',
}

export default function PerformancePage() {
  const { t } = useI18n()
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [data, setData] = useState<PerformanceSummary[]>([])
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
    setAiAnalysis(null)
    setAiError('')
    api.stats
      .performance(projectId)
      .then((result) => {
        setData(result)
        setError('')
      })
      .catch(() => {
        setData([])
        setError(t('performance.loadError'))
      })
      .finally(() => setLoading(false))
  }, [projectId, t])

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

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t('performance.eyebrow')}
        title={t('performance.title')}
        description={t('performance.description')}
        action={<ProjectSelect projects={projects} value={projectId} onChange={setProjectId} />}
      />

      {error && (
        <div className="rounded-md border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-3">
        <MetricCard icon={<Activity className="h-5 w-5 text-indigo-300" />} label={t('performance.metric.total')} value={loading ? '...' : compactNumber(totalSamples)} tone="primary" />
        <MetricCard icon={<SignalHigh className="h-5 w-5 text-red-300" />} label={t('performance.metric.poor')} value={loading ? '...' : compactNumber(poorSamples)} tone="danger" />
        <MetricCard icon={<MonitorDot className="h-5 w-5 text-emerald-300" />} label={t('performance.metric.covered')} value={`${coveredMetrics} / ${metricNames.length}`} tone="success" />
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
            <Threshold icon={<Zap className="h-4 w-4 text-amber-300" />} name="INP" good="< 200 ms" poor="> 500 ms" />
            <Threshold icon={<TimerReset className="h-4 w-4 text-emerald-300" />} name="CLS" good="< 0.1" poor="> 0.25" />
            <Threshold icon={<Activity className="h-4 w-4 text-sky-300" />} name="TTFB" good="< 800 ms" poor="> 1800 ms" />
          </div>
        </Panel>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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
    </div>
  )
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
