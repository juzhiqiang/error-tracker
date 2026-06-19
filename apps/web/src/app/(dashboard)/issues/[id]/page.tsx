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
  Cpu,
  Database,
  Fingerprint,
  Gauge,
  GitBranch,
  Globe2,
  HardDrive,
  ImageOff,
  Monitor,
  Network,
  Play,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Tags,
  User,
  Wifi,
} from 'lucide-react'
import { AiAnalysisPanel } from '@/components/ai-analysis-panel'
import { EmptyState } from '@/components/empty-state'
import { Panel } from '@/components/panel'
import { LevelBadge, StatusBadge } from '@/components/status-badge'
import {
  api,
  type AiAnalysis,
  type Breadcrumb,
  type EventRow,
  type Issue,
  type IssueComment,
  type IssueFacets,
  type IssueLevel,
  type IssueStatus,
  type ProjectMember,
  type RelatedPerformanceSample,
  type StackFrame,
} from '@/lib/api'
import { compactNumber, formatFullDateTime, formatMetricValue, formatTime, stringifyRecord, toNumber } from '@/lib/format'
import { useI18n } from '@/lib/i18n'

const statusActions: Array<{ status: IssueStatus; labelKey: string; icon: ReactNode }> = [
  { status: 'unresolved', labelKey: 'detail.action.reopen', icon: <RotateCcw className="h-4 w-4" /> },
  { status: 'resolved', labelKey: 'detail.action.resolve', icon: <CheckCircle2 className="h-4 w-4" /> },
  { status: 'ignored', labelKey: 'detail.action.ignore', icon: <Ban className="h-4 w-4" /> },
]

type UnknownRecord = Record<string, unknown>

const emptyFacets: IssueFacets = { releases: [], environments: [], tags: [] }

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
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [comments, setComments] = useState<IssueComment[]>([])
  const [facets, setFacets] = useState<IssueFacets>(emptyFacets)
  const [relatedPerformance, setRelatedPerformance] = useState<RelatedPerformanceSample[]>([])
  const [assigneeUserId, setAssigneeUserId] = useState('')
  const [fixedRelease, setFixedRelease] = useState('')
  const [commentBody, setCommentBody] = useState('')
  const [targetIssueId, setTargetIssueId] = useState('')
  const [selectedSplitIds, setSelectedSplitIds] = useState<string[]>([])
  const [workflowAction, setWorkflowAction] = useState<'assign' | 'fix' | 'comment' | 'merge' | 'split' | null>(null)

  useEffect(() => {
    if (!issueId) return
    let cancelled = false
    setLoading(true)
    Promise.all([api.issues.get(issueId), api.issues.events(issueId)])
      .then(async ([issueResult, eventResult]) => {
        const ordered = [...eventResult].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        const [memberRows, commentRows, facetRows, performanceRows] = await Promise.all([
          api.projects.members(issueResult.projectId).catch(() => []),
          api.issues.comments(issueResult.id).catch(() => []),
          api.issues.facets(issueResult.id).catch(() => emptyFacets),
          api.stats.issuePerformance(issueResult.id).catch(() => []),
        ])
        if (cancelled) return
        setIssue(issueResult)
        setEvents(ordered)
        setSelectedEventId((current) => current || ordered[0]?.id || '')
        setSelectedSplitIds([])
        setMembers(memberRows)
        setComments(commentRows)
        setFacets(facetRows)
        setRelatedPerformance(performanceRows)
        setAssigneeUserId(issueResult.assigneeUserId ?? '')
        setFixedRelease(issueResult.fixedInRelease ?? '')
        setAiAnalysis(null)
        setAiError('')
        setError('')
      })
      .catch(() => {
        if (!cancelled) setError(t('detail.loadError'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
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
      setFixedRelease(updated.fixedInRelease ?? '')
      toast.success(t('detail.toast.updated'))
    } catch {
      toast.error(t('detail.toast.updateFailed'))
    } finally {
      setUpdating(null)
    }
  }

  async function assignIssue() {
    if (!issue) return
    setWorkflowAction('assign')
    try {
      const updated = await api.issues.assign(issue.id, { assigneeUserId: assigneeUserId || null })
      setIssue(updated)
      setAssigneeUserId(updated.assigneeUserId ?? '')
      toast.success(t('detail.toast.assigned'))
    } catch {
      toast.error(t('detail.toast.assignFailed'))
    } finally {
      setWorkflowAction(null)
    }
  }

  async function markFixed() {
    if (!issue || !fixedRelease.trim()) return
    setWorkflowAction('fix')
    try {
      const updated = await api.issues.markFixed(issue.id, { release: fixedRelease.trim() })
      setIssue(updated)
      setFixedRelease(updated.fixedInRelease ?? '')
      toast.success(t('detail.toast.fixed'))
    } catch {
      toast.error(t('detail.toast.fixFailed'))
    } finally {
      setWorkflowAction(null)
    }
  }

  async function addComment() {
    if (!issue || !commentBody.trim()) return
    setWorkflowAction('comment')
    try {
      const comment = await api.issues.addComment(issue.id, { body: commentBody.trim() })
      setComments((current) => [comment, ...current])
      setCommentBody('')
      toast.success(t('detail.toast.commentAdded'))
    } catch {
      toast.error(t('detail.toast.commentFailed'))
    } finally {
      setWorkflowAction(null)
    }
  }

  async function mergeIssue() {
    if (!issue || !targetIssueId.trim()) return
    setWorkflowAction('merge')
    try {
      const updated = await api.issues.merge(issue.id, { targetIssueId: targetIssueId.trim() })
      setIssue(updated)
      setTargetIssueId('')
      toast.success(t('detail.toast.merged'))
    } catch {
      toast.error(t('detail.toast.mergeFailed'))
    } finally {
      setWorkflowAction(null)
    }
  }

  async function splitIssue() {
    if (!issue || selectedSplitIds.length === 0) return
    setWorkflowAction('split')
    try {
      const newIssue = await api.issues.split(issue.id, { eventIds: selectedSplitIds })
      const remainingEvents = events.filter((event) => !selectedSplitIds.includes(event.id))
      const [refreshedIssue, refreshedFacets] = await Promise.all([
        api.issues.get(issue.id).catch(() => issue),
        api.issues.facets(issue.id).catch(() => emptyFacets),
      ])
      setIssue(refreshedIssue)
      setEvents(remainingEvents)
      setSelectedEventId(remainingEvents[0]?.id || '')
      setSelectedSplitIds([])
      setFacets(refreshedFacets)
      toast.success(t('detail.toast.split', { id: newIssue.id }))
    } catch {
      toast.error(t('detail.toast.splitFailed'))
    } finally {
      setWorkflowAction(null)
    }
  }

  async function generateAiAnalysis() {
    if (!issue) return
    setAiLoading(true)
    setAiError('')
    try {
      const analysis = await api.issues.aiAnalysis(issue.id)
      setAiAnalysis(analysis)
      toast.success(t('detail.ai.toast.generated'))
    } catch {
      setAiError(t('detail.ai.error'))
      toast.error(t('detail.ai.error'))
    } finally {
      setAiLoading(false)
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

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="app-panel p-4">
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

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-xs font-medium text-slate-400">{t('detail.workflow.assignee')}</span>
              <select
                value={assigneeUserId}
                onChange={(event) => setAssigneeUserId(event.target.value)}
                className="app-control w-full px-3 text-sm"
              >
                <option value="">{t('detail.workflow.unassigned')}</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name || member.email}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid content-end">
              <button
                disabled={workflowAction !== null}
                onClick={assignIssue}
                className="app-button inline-flex items-center justify-center gap-2 border border-slate-700 px-3 text-sm text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <User className="h-4 w-4" />
                {workflowAction === 'assign' ? t('detail.action.updating') : t('detail.workflow.saveAssignee')}
              </button>
            </div>
            <label className="grid gap-2">
              <span className="text-xs font-medium text-slate-400">{t('detail.workflow.fixedRelease')}</span>
              <input
                value={fixedRelease}
                onChange={(event) => setFixedRelease(event.target.value)}
                placeholder={t('detail.workflow.releasePlaceholder')}
                className="app-control w-full px-3 font-mono text-sm"
              />
            </label>
            <div className="grid content-end">
              <button
                disabled={workflowAction !== null || !fixedRelease.trim()}
                onClick={markFixed}
                className="app-button inline-flex items-center justify-center gap-2 border border-success/35 bg-success/10 px-3 text-sm text-emerald-200 hover:bg-success/15 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <CheckCircle2 className="h-4 w-4" />
                {workflowAction === 'fix' ? t('detail.action.updating') : t('detail.workflow.markFixed')}
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-2">
            <WorkflowMeta label={t('detail.workflow.assignedTo')} value={assigneeLabel(members, issue.assigneeUserId) || t('detail.workflow.unassigned')} />
            <WorkflowMeta label={t('detail.workflow.fixedIn')} value={issue.fixedInRelease || '-'} />
            <WorkflowMeta label={t('detail.workflow.resolvedAt')} value={issue.resolvedAt ? formatFullDateTime(issue.resolvedAt) : '-'} />
            <WorkflowMeta
              label={t('detail.workflow.regression')}
              value={issue.regressedAt ? t('detail.workflow.regressionMeta', { release: issue.regressedInRelease || '-', time: formatFullDateTime(issue.regressedAt) }) : '-'}
              tone={issue.regressedAt ? 'danger' : 'neutral'}
            />
          </div>
        </div>

        <Panel title={t('detail.facets.title')} description={t('detail.facets.description')}>
          <FacetDistribution facets={facets} />
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Panel title={t('detail.comments.title')} description={t('detail.comments.description')}>
          <div className="grid gap-3">
            <textarea
              value={commentBody}
              onChange={(event) => setCommentBody(event.target.value)}
              placeholder={t('detail.comments.placeholder')}
              className="app-control min-h-24 w-full resize-y px-3 py-2 text-sm leading-6"
            />
            <div className="flex justify-end">
              <button
                disabled={workflowAction !== null || !commentBody.trim()}
                onClick={addComment}
                className="app-button inline-flex items-center gap-2 border border-slate-700 px-3 text-sm text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Code2 className="h-4 w-4" />
                {workflowAction === 'comment' ? t('detail.comments.adding') : t('detail.comments.add')}
              </button>
            </div>
            <CommentList comments={comments} />
          </div>
        </Panel>

        <Panel title={t('detail.ops.title')} description={t('detail.ops.description')}>
          <div className="space-y-4">
            <div className="grid gap-2">
              <label className="text-xs font-medium text-slate-400" htmlFor="merge-target">
                {t('detail.ops.mergeTarget')}
              </label>
              <input
                id="merge-target"
                value={targetIssueId}
                onChange={(event) => setTargetIssueId(event.target.value)}
                className="app-control w-full px-3 font-mono text-sm"
                placeholder="target issue id"
              />
              <button
                disabled={workflowAction !== null || !targetIssueId.trim()}
                onClick={mergeIssue}
                className="app-button inline-flex items-center justify-center gap-2 border border-warning/35 bg-warning/10 px-3 text-sm text-amber-200 hover:bg-warning/15 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <GitBranch className="h-4 w-4" />
                {workflowAction === 'merge' ? t('detail.ops.merging') : t('detail.ops.merge')}
              </button>
            </div>

            <div className="border-t border-line pt-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-xs font-medium text-slate-400">{t('detail.ops.splitSamples')}</div>
                <div className="font-mono text-xs text-slate-500">{t('detail.ops.selected', { count: selectedSplitIds.length })}</div>
              </div>
              <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                {events.slice(0, 8).map((event) => {
                  const checked = selectedSplitIds.includes(event.id)
                  return (
                    <label key={event.id} className="flex min-h-11 cursor-pointer items-start gap-2 rounded-md border border-line bg-slate-950/30 p-2 hover:bg-slate-800/55">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedSplitIds((current) =>
                            checked ? current.filter((id) => id !== event.id) : [...current, event.id],
                          )
                        }
                        className="mt-1 h-4 w-4 accent-primary"
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-mono text-xs text-slate-300">{event.id}</span>
                        <span className="mt-1 block line-clamp-1 text-xs text-slate-500">{event.message}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
              <button
                disabled={workflowAction !== null || selectedSplitIds.length === 0}
                onClick={splitIssue}
                className="app-button mt-3 inline-flex w-full items-center justify-center gap-2 border border-primary/40 bg-primary/10 px-3 text-sm text-indigo-200 hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <GitBranch className="h-4 w-4" />
                {workflowAction === 'split' ? t('detail.ops.splitting') : t('detail.ops.split')}
              </button>
            </div>
          </div>
        </Panel>
      </section>

      <AiAnalysisPanel
        title={t('detail.ai.title')}
        description={t('detail.ai.description')}
        analyzeLabel={t('detail.ai.action')}
        emptyTitle={t('detail.ai.emptyTitle')}
        emptyDescription={t('detail.ai.emptyDescription')}
        analysis={aiAnalysis}
        loading={aiLoading}
        error={aiError}
        onAnalyze={generateAiAnalysis}
      />

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

          <Panel title={t('detail.sdkSignals.title')} description={t('detail.sdkSignals.description')}>
            {selectedEvent ? <SdkSignals event={selectedEvent} /> : <EmptyState title={t('detail.sdkSignals.emptyTitle')} description={t('detail.sdkSignals.emptyDescription')} />}
          </Panel>

          <Panel title={t('detail.relatedPerformance.title')} description={t('detail.relatedPerformance.description')}>
            <RelatedPerformance samples={relatedPerformance} selectedEvent={selectedEvent} />
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

function WorkflowMeta({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'danger' }) {
  const toneClass = tone === 'danger' ? 'border-danger/30 bg-danger/10 text-red-200' : 'border-line bg-slate-950/30 text-slate-300'
  return (
    <div className={`rounded-md border p-3 ${toneClass}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 break-words font-mono text-xs leading-5">{value}</div>
    </div>
  )
}

function FacetDistribution({ facets }: { facets: IssueFacets }) {
  const { t } = useI18n()
  const hasFacets = facets.releases.length > 0 || facets.environments.length > 0 || facets.tags.length > 0
  if (!hasFacets) return <EmptyState title={t('detail.facets.emptyTitle')} description={t('detail.facets.emptyDescription')} />
  return (
    <div className="space-y-4">
      <FacetGroup title={t('detail.facets.releases')} items={facets.releases} />
      <FacetGroup title={t('detail.facets.environments')} items={facets.environments} />
      <FacetGroup title={t('detail.facets.tags')} items={facets.tags.map((tag) => ({ value: `${tag.key}: ${tag.value}`, count: tag.count }))} />
    </div>
  )
}

function FacetGroup({ title, items }: { title: string; items: Array<{ value: string; count: number }> }) {
  if (items.length === 0) return null
  const max = Math.max(...items.map((item) => item.count), 1)
  return (
    <div>
      <div className="mb-2 text-xs font-medium text-slate-400">{title}</div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={`${title}-${item.value}`} className="rounded-md border border-line bg-slate-950/30 p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-mono text-xs text-slate-300">{item.value}</span>
              <span className="font-mono text-xs text-slate-500">{compactNumber(item.count)}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(8, (item.count / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CommentList({ comments }: { comments: IssueComment[] }) {
  const { t } = useI18n()
  if (comments.length === 0) return <EmptyState title={t('detail.comments.emptyTitle')} description={t('detail.comments.emptyDescription')} />
  return (
    <div className="space-y-3">
      {comments.map((comment) => (
        <article key={comment.id} className="rounded-md border border-line bg-slate-950/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 truncate text-sm font-medium text-slate-200">
              {comment.authorName || comment.authorEmail || comment.authorUserId || t('common.unknown')}
            </div>
            <time className="font-mono text-xs text-slate-500">{formatFullDateTime(comment.createdAt)}</time>
          </div>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">{comment.body}</p>
        </article>
      ))}
    </div>
  )
}

function assigneeLabel(members: ProjectMember[], assigneeUserId?: string | null): string {
  if (!assigneeUserId) return ''
  const member = members.find((item) => item.userId === assigneeUserId)
  return member ? member.name || member.email : assigneeUserId
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

function SdkSignals({ event }: { event: EventRow }) {
  const { t } = useI18n()
  const tags = event.tags ?? {}
  const environmentProfile = getEnvironmentProfile(event.context)
  const browser = readEnvironmentValue(environmentProfile, ['userAgent', 'browser', 'name']) ?? tags['browser.name']
  const device = readEnvironmentValue(environmentProfile, ['userAgent', 'device', 'type']) ?? tags['device.type']
  const network = readEnvironmentValue(environmentProfile, ['network', 'quality']) ?? tags['network.quality']
  const tier = readEnvironmentValue(environmentProfile, ['performance', 'tier']) ?? tags['performance.tier']
  const environmentSummary = joinDefined([browser, device, network, tier], ' / ')
  const isResourceError = tags.mechanism === 'resource'
  const isBlankScreen = tags.mechanism === 'blank-screen'
  const grouped = groupBreadcrumbs(event)
  const traceId = firstTraceId(event)

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <SdkSignalItem
        icon={<Network className="h-4 w-4" />}
        title={t('detail.sdkSignals.trace.title')}
        status={traceId ? t('detail.sdkSignals.status.ready') : t('detail.sdkSignals.status.notSeen')}
        tone={traceId ? 'success' : 'neutral'}
        summary={traceId ?? t('detail.sdkSignals.trace.empty')}
      />
      <SdkSignalItem
        icon={<ImageOff className="h-4 w-4" />}
        title={t('detail.sdkSignals.resource.title')}
        status={isResourceError ? t('detail.sdkSignals.status.detected') : t('detail.sdkSignals.status.notSeen')}
        tone={isResourceError ? 'danger' : 'neutral'}
        summary={
          isResourceError
            ? joinDefined([tags.resourceType, tags.resourceUrl], ' ') ?? t('detail.sdkSignals.resource.empty')
            : t('detail.sdkSignals.resource.empty')
        }
      />
      <SdkSignalItem
        icon={<Monitor className="h-4 w-4" />}
        title={t('detail.sdkSignals.blank.title')}
        status={isBlankScreen ? t('detail.sdkSignals.status.detected') : t('detail.sdkSignals.status.notSeen')}
        tone={isBlankScreen ? 'warning' : 'neutral'}
        summary={
          isBlankScreen
            ? t('detail.sdkSignals.blank.summary', {
                blank: tags.blankPoints ?? '-',
                total: tags.samplePoints ?? '-',
                threshold: tags.threshold ?? '-',
              })
            : t('detail.sdkSignals.blank.empty')
        }
      />
      <SdkSignalItem
        icon={<Tags className="h-4 w-4" />}
        title={t('detail.sdkSignals.env.title')}
        status={environmentSummary ? t('detail.sdkSignals.status.ready') : t('detail.sdkSignals.status.notSeen')}
        tone={environmentSummary ? 'success' : 'neutral'}
        summary={environmentSummary ?? t('detail.sdkSignals.env.empty')}
      />
      <SdkSignalItem
        icon={<ShieldCheck className="h-4 w-4" />}
        title={t('detail.sdkSignals.delivery.title')}
        status={t('detail.sdkSignals.status.enabled')}
        tone="success"
        summary={t('detail.sdkSignals.delivery.summary')}
      />
      <SdkSignalList title={t('detail.sdkSignals.http.title')} items={grouped.http} empty={t('detail.sdkSignals.http.empty')} />
      <SdkSignalList title={t('detail.sdkSignals.console.title')} items={grouped.console} empty={t('detail.sdkSignals.console.empty')} />
      <SdkSignalList title={t('detail.sdkSignals.navigation.title')} items={grouped.navigation} empty={t('detail.sdkSignals.navigation.empty')} />
      <SdkSignalList title={t('detail.sdkSignals.interaction.title')} items={grouped.interaction} empty={t('detail.sdkSignals.interaction.empty')} />
    </div>
  )
}

function SdkSignalItem({
  icon,
  title,
  status,
  tone,
  summary,
}: {
  icon: ReactNode
  title: string
  status: string
  tone: 'success' | 'warning' | 'danger' | 'neutral'
  summary: string
}) {
  const toneClass = {
    success: 'border-success/35 bg-success/10 text-emerald-200',
    warning: 'border-warning/35 bg-warning/10 text-amber-200',
    danger: 'border-danger/35 bg-danger/10 text-red-200',
    neutral: 'border-slate-700 bg-slate-900/70 text-slate-300',
  }[tone]

  return (
    <div className="rounded-md border border-line bg-slate-950/30 p-3">
      <div className="flex min-h-[28px] items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-100">
          <span className="text-slate-400">{icon}</span>
          <span className="truncate">{title}</span>
        </div>
        <span className={`shrink-0 rounded-md border px-2 py-1 text-xs ${toneClass}`}>{status}</span>
      </div>
      <div className="mt-2 break-all font-mono text-xs leading-5 text-slate-400">{summary}</div>
    </div>
  )
}

function SdkSignalList({ title, items, empty }: { title: string; items: Breadcrumb[]; empty: string }) {
  return (
    <div className="rounded-md border border-line bg-slate-950/30 p-3 md:col-span-2">
      <div className="flex min-h-[28px] items-center justify-between gap-3">
        <div className="text-sm font-medium text-slate-100">{title}</div>
        <span className="rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 font-mono text-xs text-slate-300">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="mt-2 text-xs leading-5 text-slate-500">{empty}</div>
      ) : (
        <div className="mt-3 space-y-2">
          {items.slice(-5).map((item, index) => (
            <div key={`${item.timestamp}-${item.type}-${index}`} className="rounded-md border border-slate-800 bg-slate-900/50 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] text-slate-500">{formatTime(normalizeTimestamp(item.timestamp))}</span>
                <span className="rounded border border-slate-700 px-1.5 py-0.5 font-mono text-[11px] text-slate-300">{item.type}</span>
              </div>
              <div className="mt-1 break-words font-mono text-xs leading-5 text-slate-300">
                {item.message || stringifyRecord(item.data)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RelatedPerformance({ samples, selectedEvent }: { samples: RelatedPerformanceSample[]; selectedEvent?: EventRow }) {
  const { t } = useI18n()
  if (samples.length === 0) {
    return <EmptyState title={t('detail.relatedPerformance.emptyTitle')} description={t('detail.relatedPerformance.emptyDescription')} />
  }

  const selectedSession = selectedEvent?.sessionId
  const selectedDevice = selectedEvent?.deviceId
  const prioritized = [...samples].sort((a, b) => {
    const aMatch = Number(a.session_id === selectedSession || a.device_id === selectedDevice)
    const bMatch = Number(b.session_id === selectedSession || b.device_id === selectedDevice)
    return bMatch - aMatch || new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  })

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-3">
        <ContextBlock icon={<Gauge className="h-4 w-4" />} label={t('detail.relatedPerformance.samples')} value={compactNumber(samples.length)} />
        <ContextBlock icon={<Smartphone className="h-4 w-4" />} label={t('detail.relatedPerformance.sameDevice')} value={compactNumber(samples.filter((item) => item.device_id && item.device_id === selectedDevice).length)} />
        <ContextBlock icon={<Clock3 className="h-4 w-4" />} label={t('detail.relatedPerformance.sameSession')} value={compactNumber(samples.filter((item) => item.session_id && item.session_id === selectedSession).length)} />
      </div>
      <div className="overflow-hidden rounded-md border border-slate-800">
        {prioritized.slice(0, 10).map((sample, index) => {
          const value = toNumber(sample.duration ?? sample.value)
          const isPoor = sample.rating === 'poor' || value >= 2500
          return (
            <div key={`${sample.id ?? index}-${sample.timestamp}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-slate-800 px-3 py-3 last:border-b-0 hover:bg-slate-800/60">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-slate-100">{sample.name}</span>
                  <span className={`rounded-md border px-2 py-0.5 text-xs ${isPoor ? 'border-danger/35 bg-danger/10 text-red-200' : 'border-slate-700 bg-slate-900 text-slate-300'}`}>
                    {sample.rating ?? sample.kind ?? t('common.unknown')}
                  </span>
                  {sample.session_id === selectedSession && <span className="rounded-md border border-primary/35 bg-primary/10 px-2 py-0.5 text-xs text-indigo-200">{t('detail.relatedPerformance.currentSession')}</span>}
                  {sample.device_id === selectedDevice && <span className="rounded-md border border-success/35 bg-success/10 px-2 py-0.5 text-xs text-emerald-200">{t('detail.relatedPerformance.currentDevice')}</span>}
                  {sample.device_id && (
                    <Link
                      href={`/performance?${new URLSearchParams({ projectId: selectedEvent?.projectId ?? '', deviceId: sample.device_id, ...(sample.session_id ? { sessionId: sample.session_id } : {}) })}`}
                      className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-800"
                    >
                      {t('detail.relatedPerformance.openDevice')}
                    </Link>
                  )}
                </div>
                <div className="mt-2 truncate font-mono text-xs text-slate-500">{sample.route || sample.page_url || sample.url || '-'}</div>
                <div className="mt-1 font-mono text-xs text-slate-600">{formatFullDateTime(sample.timestamp)}</div>
              </div>
              <div className={`self-center font-mono text-sm ${isPoor ? 'text-red-200' : 'text-slate-100'}`}>
                {formatMetricValue(sample.name, value)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function groupBreadcrumbs(event: EventRow) {
  const breadcrumbs = event.breadcrumbs ?? []
  return {
    http: breadcrumbs.filter((item) => item.type === 'http'),
    console: breadcrumbs.filter((item) => item.type === 'console'),
    navigation: breadcrumbs.filter((item) => item.type === 'navigation'),
    interaction: breadcrumbs.filter((item) => item.type === 'ui.click' || item.type === 'ui.input'),
  }
}

function firstTraceId(event: EventRow): string | null {
  const fromTags = event.tags?.traceId ?? event.tags?.['trace.id']
  if (fromTags) return fromTags
  const http = (event.breadcrumbs ?? []).find((item) => typeof item.data?.traceId === 'string')
  return typeof http?.data?.traceId === 'string' ? http.data.traceId : null
}

function EventContext({ event, issue }: { event: EventRow; issue: Issue }) {
  const { t } = useI18n()
  const tags = Object.entries(event.tags ?? {})
  const environmentProfile = getEnvironmentProfile(event.context)
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ContextBlock icon={<Globe2 className="h-4 w-4" />} label={t('detail.context.environment')} value={event.environment || '-'} />
      <ContextBlock icon={<GitBranch className="h-4 w-4" />} label={t('detail.context.release')} value={event.release || '-'} />
      <ContextBlock icon={<Code2 className="h-4 w-4" />} label={t('detail.context.eventId')} value={event.id} />
      <ContextBlock icon={<Fingerprint className="h-4 w-4" />} label={t('detail.context.fingerprint')} value={issue.fingerprint} />

      <EnvironmentProfile profile={environmentProfile} />

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

function EnvironmentProfile({ profile }: { profile: UnknownRecord | null }) {
  const { t } = useI18n()
  if (!profile) {
    return (
      <div className="app-panel-muted p-4 lg:col-span-2">
        <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
          <Monitor className="h-4 w-4" />
          {t('detail.env.title')}
        </div>
        <div className="text-sm text-slate-500">{t('detail.env.empty')}</div>
      </div>
    )
  }

  const userAgent = asRecord(profile.userAgent)
  const browser = asRecord(userAgent?.browser)
  const os = asRecord(userAgent?.os)
  const deviceFromUa = asRecord(userAgent?.device)
  const engine = asRecord(userAgent?.engine)
  const device = asRecord(profile.device)
  const screen = asRecord(device?.screen)
  const viewport = asRecord(device?.viewport)
  const network = asRecord(profile.network)
  const performance = asRecord(profile.performance)
  const storage = asRecord(profile.storage)
  const locale = asRecord(profile.locale)
  const page = asRecord(profile.page)

  const browserText = joinDefined([textValue(browser?.name), textValue(browser?.version)], ' ')
  const osText = joinDefined([textValue(os?.name), textValue(os?.version)], ' ')
  const deviceType = textValue(deviceFromUa?.type)
  const networkQuality = textValue(network?.quality)
  const performanceTier = textValue(performance?.tier)

  return (
    <div className="app-panel-muted overflow-hidden lg:col-span-2">
      <div className="border-b border-line px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Monitor className="h-4 w-4" />
              {t('detail.env.title')}
            </div>
            <div className="mt-2 break-words font-mono text-sm text-slate-100">
              {joinDefined([browserText, osText, deviceType], ' / ') || t('common.unknown')}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <SignalPill icon={<Gauge className="h-3.5 w-3.5" />} label={t('detail.env.performanceTier')} value={performanceTier} tone={tierTone(performanceTier)} />
            <SignalPill icon={<Wifi className="h-3.5 w-3.5" />} label={t('detail.env.networkQuality')} value={networkQuality} tone={qualityTone(networkQuality)} />
            <SignalPill icon={<Smartphone className="h-3.5 w-3.5" />} label={t('detail.env.deviceType')} value={deviceType} tone="neutral" />
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-4 xl:grid-cols-2">
        <ProfileGroup
          icon={<Globe2 className="h-4 w-4" />}
          title={t('detail.env.browserGroup')}
          rows={[
            [t('detail.env.browser'), browserText],
            [t('detail.env.os'), osText],
            [t('detail.env.engine'), joinDefined([textValue(engine?.name), textValue(engine?.version)], ' ')],
            [t('detail.env.ua'), textValue(userAgent?.raw)],
          ]}
        />
        <ProfileGroup
          icon={<Cpu className="h-4 w-4" />}
          title={t('detail.env.hardwareGroup')}
          rows={[
            [t('detail.env.deviceType'), deviceType],
            [t('detail.env.vendor'), textValue(deviceFromUa?.vendor)],
            [t('detail.env.model'), textValue(deviceFromUa?.model)],
            [t('detail.env.platform'), textValue(device?.platform)],
            [t('detail.env.cpu'), numberWithUnit(device?.cpuCores, t('detail.env.cores'))],
            [t('detail.env.memory'), numberWithUnit(device?.memoryGb, 'GB')],
            [t('detail.env.touch'), numberWithUnit(device?.touchPoints, '')],
            [t('detail.env.screen'), formatSize(screen?.width, screen?.height)],
            [t('detail.env.availableScreen'), formatSize(screen?.availWidth, screen?.availHeight)],
            [t('detail.env.viewport'), formatSize(viewport?.width, viewport?.height)],
            [t('detail.env.pixelRatio'), textValue(screen?.pixelRatio)],
            [t('detail.env.colorDepth'), numberWithUnit(screen?.colorDepth, 'bit')],
            [t('detail.env.orientation'), textValue(screen?.orientation)],
            [t('detail.env.performanceScore'), textValue(performance?.score)],
            [t('detail.env.performanceReasons'), Array.isArray(performance?.reasons) ? performance.reasons.join(', ') : undefined],
          ]}
        />
        <ProfileGroup
          icon={<Network className="h-4 w-4" />}
          title={t('detail.env.networkGroup')}
          rows={[
            [t('detail.env.networkQuality'), networkQuality],
            [t('detail.env.online'), booleanText(network?.online, t)],
            [t('detail.env.effectiveType'), textValue(network?.effectiveType)],
            [t('detail.env.rtt'), numberWithUnit(network?.rttMs, 'ms')],
            [t('detail.env.downlink'), numberWithUnit(network?.downlinkMbps, 'Mbps')],
            [t('detail.env.saveData'), booleanText(network?.saveData, t)],
          ]}
        />
        <ProfileGroup
          icon={<HardDrive className="h-4 w-4" />}
          title={t('detail.env.storageGroup')}
          rows={[
            [t('detail.env.persistentStorage'), booleanText(storage?.persisted, t)],
            [t('detail.env.cookies'), booleanText(storage?.cookies, t)],
            [t('detail.env.localStorage'), booleanText(storage?.localStorage, t)],
            [t('detail.env.sessionStorage'), booleanText(storage?.sessionStorage, t)],
            [t('detail.env.indexedDB'), booleanText(storage?.indexedDB, t)],
            [t('detail.env.quota'), formatBytes(storage?.quotaBytes)],
            [t('detail.env.usage'), formatBytes(storage?.usageBytes)],
            [t('detail.env.usageRatio'), formatPercent(storage?.usageRatio)],
          ]}
        />
        <ProfileGroup
          className="xl:col-span-2"
          icon={<Database className="h-4 w-4" />}
          title={t('detail.env.localePageGroup')}
          rows={[
            [t('detail.env.collectedAt'), formatProfileTime(profile.collectedAt)],
            [t('detail.env.language'), textValue(locale?.language)],
            [t('detail.env.languages'), Array.isArray(locale?.languages) ? locale.languages.join(', ') : undefined],
            [t('detail.env.timezone'), textValue(locale?.timezone)],
            [t('detail.env.offset'), numberWithUnit(locale?.timezoneOffsetMinutes, 'min')],
            [t('detail.env.url'), textValue(page?.url)],
            [t('detail.env.referrer'), textValue(page?.referrer)],
            [t('detail.env.visibility'), textValue(page?.visibilityState)],
          ]}
        />
      </div>
    </div>
  )
}

function ProfileGroup({ icon, title, rows, className = '' }: { icon: ReactNode; title: string; rows: Array<[string, string | undefined]>; className?: string }) {
  return (
    <div className={`rounded-md border border-line bg-slate-950/30 p-3 ${className}`}>
      <div className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-300">
        {icon}
        {title}
      </div>
      <dl className="grid gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 sm:grid-cols-[150px_minmax(0,1fr)]">
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="break-words font-mono text-xs leading-5 text-slate-300">{value || '-'}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function SignalPill({ icon, label, value, tone }: { icon: ReactNode; label: string; value?: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }) {
  const classes = {
    success: 'border-success/35 bg-success/10 text-emerald-200',
    warning: 'border-warning/35 bg-warning/10 text-amber-200',
    danger: 'border-danger/35 bg-danger/10 text-red-200',
    neutral: 'border-slate-700 bg-slate-900/70 text-slate-300',
  }[tone]
  return (
    <span className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-md border px-2.5 font-mono text-xs ${classes}`}>
      {icon}
      <span className="text-slate-500">{label}</span>
      <span>{value || '-'}</span>
    </span>
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

function getEnvironmentProfile(context: Record<string, unknown> | null): UnknownRecord | null {
  const environment = asRecord(context?.environment)
  return environment && Object.keys(environment).length > 0 ? environment : null
}

function readEnvironmentValue(profile: UnknownRecord | null, path: string[]): string | undefined {
  let current: unknown = profile
  for (const key of path) {
    const record = asRecord(current)
    if (!record) return undefined
    current = record[key]
  }
  return textValue(current)
}

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as UnknownRecord) : null
}

function textValue(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return undefined
}

function joinDefined(values: Array<string | undefined>, separator: string): string | undefined {
  const filtered = values.filter((value): value is string => Boolean(value))
  return filtered.length ? filtered.join(separator) : undefined
}

function numberWithUnit(value: unknown, unit: string): string | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return unit ? `${value} ${unit}` : String(value)
}

function formatSize(width: unknown, height: unknown): string | undefined {
  if (typeof width !== 'number' || typeof height !== 'number') return undefined
  return `${width} x ${height}`
}

function formatBytes(value: unknown): string | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let next = value
  let unit = 0
  while (next >= 1024 && unit < units.length - 1) {
    next /= 1024
    unit += 1
  }
  return `${next >= 10 || unit === 0 ? next.toFixed(0) : next.toFixed(1)} ${units[unit]}`
}

function formatPercent(value: unknown): string | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return `${(value * 100).toFixed(value < 0.1 ? 1 : 0)}%`
}

function formatProfileTime(value: unknown): string | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined
  return formatFullDateTime(value)
}

function booleanText(value: unknown, t: (key: string) => string): string | undefined {
  if (typeof value !== 'boolean') return undefined
  return value ? t('common.yes') : t('common.no')
}

function tierTone(value?: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (value === 'high') return 'success'
  if (value === 'medium') return 'warning'
  if (value === 'low') return 'danger'
  return 'neutral'
}

function qualityTone(value?: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (value === 'excellent' || value === 'good') return 'success'
  if (value === 'fair') return 'warning'
  if (value === 'poor' || value === 'offline') return 'danger'
  return 'neutral'
}
