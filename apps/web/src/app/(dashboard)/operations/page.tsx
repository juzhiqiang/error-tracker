'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, Clock3, Loader2, PlayCircle, RotateCcw, Trash2, Workflow } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/empty-state'
import { MetricCard } from '@/components/metric-card'
import { PageHeader, Panel } from '@/components/panel'
import { ProjectSelect } from '@/components/project-select'
import { api, type OperationsQueueName, type Project, type QueueFailedJob, type QueueOperationsReport, type QueueOperationsSnapshot } from '@/lib/api'
import { compactNumber, formatDateTime } from '@/lib/format'
import { useI18n } from '@/lib/i18n'

const queueNames: OperationsQueueName[] = ['events', 'cleanup']
const countKeys = ['failed', 'waiting', 'active', 'delayed'] as const

export default function OperationsPage() {
  const { t } = useI18n()
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [report, setReport] = useState<QueueOperationsReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionKey, setActionKey] = useState('')

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

  async function refresh(nextProjectId = projectId) {
    if (!nextProjectId) return
    setLoading(true)
    try {
      setReport(await api.operations.queues(nextProjectId))
      setError('')
    } catch {
      setReport(null)
      setError(t('operations.loadError'))
    } finally {
      setLoading(false)
    }
  }

  async function handleRetry(queueName: OperationsQueueName, jobId: string) {
    await runQueueAction(`${queueName}:${jobId}:retry`, () => api.operations.retryQueueJob(projectId, queueName, jobId), 'operations.toast.retrySuccess')
  }

  async function handleRemove(queueName: OperationsQueueName, jobId: string) {
    await runQueueAction(`${queueName}:${jobId}:remove`, () => api.operations.removeQueueJob(projectId, queueName, jobId), 'operations.toast.removeSuccess')
  }

  async function runQueueAction(key: string, action: () => Promise<{ ok: true }>, successKey: string) {
    if (!projectId) return
    setActionKey(key)
    try {
      await action()
      toast.success(t(successKey))
      await refresh(projectId)
    } catch {
      toast.error(t('operations.toast.actionFailed'))
    } finally {
      setActionKey('')
    }
  }

  const totals = useMemo(() => {
    if (!report) return null
    const snapshots = queueNames.map((name) => report[name])
    return countKeys.reduce(
      (acc, key) => ({ ...acc, [key]: snapshots.reduce((sum, snapshot) => sum + count(snapshot, key), 0) }),
      {} as Record<(typeof countKeys)[number], number>,
    )
  }, [report])

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t('operations.eyebrow')}
        title={t('operations.title')}
        description={t('operations.description')}
        action={<ProjectSelect projects={projects} value={projectId} onChange={setProjectId} />}
      />

      {error && (
        <div className="rounded-md border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<AlertTriangle className="h-5 w-5 text-red-300" />} label={t('operations.metric.failed')} value={loading ? '...' : totals ? compactNumber(totals.failed) : '-'} tone="danger" />
        <MetricCard icon={<Clock3 className="h-5 w-5 text-amber-300" />} label={t('operations.metric.waiting')} value={loading ? '...' : totals ? compactNumber(totals.waiting) : '-'} tone="warning" />
        <MetricCard icon={<PlayCircle className="h-5 w-5 text-emerald-300" />} label={t('operations.metric.active')} value={loading ? '...' : totals ? compactNumber(totals.active) : '-'} tone="success" />
        <MetricCard icon={<Workflow className="h-5 w-5 text-indigo-300" />} label={t('operations.metric.delayed')} value={loading ? '...' : totals ? compactNumber(totals.delayed) : '-'} tone="primary" />
      </section>

      {!projectId && !loading ? (
        <EmptyState title={t('operations.emptyTitle')} description={t('operations.emptyDescription')} />
      ) : (
        <section className="grid gap-4 xl:grid-cols-2">
          {queueNames.map((queueName) => (
            <QueuePanel
              key={queueName}
              queueName={queueName}
              snapshot={report?.[queueName] ?? null}
              loading={loading}
              actionKey={actionKey}
              onRetry={handleRetry}
              onRemove={handleRemove}
            />
          ))}
        </section>
      )}
    </div>
  )
}

function QueuePanel({
  queueName,
  snapshot,
  loading,
  actionKey,
  onRetry,
  onRemove,
}: {
  queueName: OperationsQueueName
  snapshot: QueueOperationsSnapshot | null
  loading: boolean
  actionKey: string
  onRetry: (queueName: OperationsQueueName, jobId: string) => void
  onRemove: (queueName: OperationsQueueName, jobId: string) => void
}) {
  const { t } = useI18n()

  return (
    <Panel
      title={t(`operations.queue.${queueName}.title`)}
      description={t(`operations.queue.${queueName}.description`)}
      bodyClassName="space-y-4"
    >
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {countKeys.map((key) => (
          <QueueCount key={key} label={t(`operations.count.${key}`)} value={loading ? '...' : snapshot ? compactNumber(count(snapshot, key)) : '-'} tone={key} />
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-md bg-slate-800/70" />
          ))}
        </div>
      ) : !snapshot ? (
        <EmptyState title={t('operations.unavailableTitle')} description={t('operations.unavailableDescription')} />
      ) : snapshot.failedJobs.length === 0 ? (
        <EmptyState title={t('operations.failed.emptyTitle')} description={t('operations.failed.emptyDescription')} />
      ) : (
        <FailedJobsTable
          queueName={queueName}
          jobs={snapshot.failedJobs}
          actionKey={actionKey}
          onRetry={onRetry}
          onRemove={onRemove}
        />
      )}
    </Panel>
  )
}

function QueueCount({ label, value, tone }: { label: string; value: string; tone: string }) {
  const toneClass =
    {
      failed: 'border-danger/35 bg-danger/10 text-red-200',
      waiting: 'border-warning/35 bg-warning/10 text-amber-200',
      active: 'border-success/35 bg-success/10 text-emerald-200',
      delayed: 'border-primary/35 bg-primary/10 text-indigo-200',
    }[tone] ?? 'border-line text-slate-200'

  return (
    <div className={`rounded-md border px-3 py-3 ${toneClass}`}>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 font-mono text-lg font-semibold">{value}</div>
    </div>
  )
}

function FailedJobsTable({
  queueName,
  jobs,
  actionKey,
  onRetry,
  onRemove,
}: {
  queueName: OperationsQueueName
  jobs: QueueFailedJob[]
  actionKey: string
  onRetry: (queueName: OperationsQueueName, jobId: string) => void
  onRemove: (queueName: OperationsQueueName, jobId: string) => void
}) {
  const { t } = useI18n()

  return (
    <div className="overflow-hidden rounded-md border border-line">
      <div className="grid min-w-[760px] grid-cols-[160px_minmax(0,1fr)_150px_190px] gap-4 border-b border-line bg-slate-950/55 px-4 py-2 text-xs font-medium text-slate-500">
        <span>{t('operations.table.job')}</span>
        <span>{t('operations.table.reason')}</span>
        <span>{t('operations.table.time')}</span>
        <span className="text-right">{t('operations.table.actions')}</span>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[760px] divide-y divide-line">
          {jobs.map((job) => (
            <div key={job.id} className="app-table-row grid min-h-[72px] grid-cols-[160px_minmax(0,1fr)_150px_190px] items-center gap-4 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate font-mono text-sm text-slate-100">{job.name}</div>
                <div className="mt-1 truncate font-mono text-xs text-slate-500">{job.id}</div>
              </div>
              <div className="min-w-0 truncate text-sm text-slate-300">{job.failedReason || t('operations.reason.empty')}</div>
              <div className="font-mono text-xs text-slate-500">{formatDateTime(job.timestamp)}</div>
              <div className="flex justify-end gap-2">
                <QueueActionButton
                  icon={<RotateCcw className="h-4 w-4" />}
                  label={t('operations.action.retry')}
                  loading={actionKey === `${queueName}:${job.id}:retry`}
                  onClick={() => onRetry(queueName, job.id)}
                />
                <QueueActionButton
                  icon={<Trash2 className="h-4 w-4" />}
                  label={t('operations.action.remove')}
                  loading={actionKey === `${queueName}:${job.id}:remove`}
                  danger
                  onClick={() => onRemove(queueName, job.id)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function QueueActionButton({
  icon,
  label,
  loading,
  danger = false,
  onClick,
}: {
  icon: ReactNode
  label: string
  loading: boolean
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`app-button inline-flex min-h-[44px] items-center justify-center gap-2 border px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 ${
        danger
          ? 'border-danger/35 bg-danger/10 text-red-200 hover:bg-danger/15'
          : 'border-slate-700 bg-slate-950/70 text-slate-300 hover:bg-primary/10 hover:text-indigo-200'
      }`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      <span>{label}</span>
    </button>
  )
}

function count(snapshot: QueueOperationsSnapshot, key: (typeof countKeys)[number]): number {
  return Number(snapshot.counts[key] ?? 0)
}
