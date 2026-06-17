export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002'

export type IssueStatus = 'unresolved' | 'resolved' | 'ignored'
export type IssueLevel = 'fatal' | 'error' | 'warning' | 'info'
export type TimeRange = '1h' | '24h' | '7d' | '30d'
export type ProjectRole = 'owner' | 'admin' | 'member' | 'viewer'
export type InvitationEmailDelivery =
  | { status: 'sent'; messageId?: string }
  | { status: 'not_configured' }
  | { status: 'failed'; error: string }

export interface Project {
  id: string
  name: string
  slug: string
  dsnToken: string
  webhookUrl?: string | null
  alertThreshold?: number | null
  alertUserThreshold?: number | null
  retentionDays?: number | null
  aiAnalysisEnabled?: boolean
  createdAt: string
}

export interface ProjectMember {
  userId: string
  email: string
  name: string
  role: ProjectRole
  createdAt: string
}

export type ProjectInvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired'

export interface ProjectInvitation {
  id: string
  projectId: string
  projectName: string
  email: string
  role: ProjectRole
  status: ProjectInvitationStatus
  invitedByUserId?: string | null
  inviterEmail?: string | null
  acceptedByUserId?: string | null
  expiresAt: string
  acceptedAt?: string | null
  revokedAt?: string | null
  createdAt: string
  inviteToken?: string
  inviteUrl?: string
  emailDelivery?: InvitationEmailDelivery
}

export interface Issue {
  id: string
  projectId: string
  fingerprint: string
  title: string
  level: IssueLevel
  status: IssueStatus
  firstSeen: string
  lastSeen: string
  count: number
  userCount: number
  assigneeUserId?: string | null
  assignedAt?: string | null
  assignedByUserId?: string | null
  resolvedAt?: string | null
  resolvedByUserId?: string | null
  fixedInRelease?: string | null
  regressedAt?: string | null
  regressedInRelease?: string | null
  mergedIntoIssueId?: string | null
  splitFromIssueId?: string | null
}

export interface StackFrame {
  function: string
  filename: string
  lineno?: number
  colno?: number
}

export interface Breadcrumb {
  timestamp: number
  type: string
  message?: string
  data?: Record<string, unknown>
}

export interface EventRow {
  id: string
  issueId: string
  projectId: string
  timestamp: string
  level: string
  message: string
  stacktrace: StackFrame[] | null
  breadcrumbs: Breadcrumb[] | null
  request: Record<string, unknown> | null
  user: Record<string, unknown> | null
  tags: Record<string, string> | null
  context: Record<string, unknown> | null
  environment: string | null
  release: string | null
}

export interface IssueListResponse {
  rows: Issue[]
  total: number
  page: number
  limit: number
}

export interface IssueComment {
  id: number
  issueId: string
  authorUserId?: string | null
  authorEmail?: string | null
  authorName?: string | null
  body: string
  createdAt: string
}

export interface IssueFacet {
  value: string
  count: number
}

export interface IssueTagFacet extends IssueFacet {
  key: string
}

export interface IssueFacets {
  releases: IssueFacet[]
  environments: IssueFacet[]
  tags: IssueTagFacet[]
}

export interface TrendPoint {
  hour: string
  count: number | string
}

export type PerformanceKind = 'web-vital' | 'resource' | 'http' | 'longtask'

export interface PerformanceSummary {
  kind?: PerformanceKind
  name: 'LCP' | 'FID' | 'CLS' | 'INP' | 'TTFB' | 'resource' | 'http' | 'longtask' | string
  rating?: 'good' | 'needs-improvement' | 'poor' | null
  method?: string | null
  status?: number | string | null
  initiator_type?: string | null
  count: number | string
  avg_value: number | string
  slowest?: number | string | null
}

export type AiPriority = 'low' | 'medium' | 'high'
export type AiConfidence = 'low' | 'medium' | 'high'

export interface AiRecommendation {
  title: string
  reason: string
  steps: string[]
}

export interface AiAnalysis {
  summary: string
  probableCause: string
  priority: AiPriority
  confidence: AiConfidence
  evidence: string[]
  recommendations: AiRecommendation[]
  testsToAdd: string[]
  provider?: 'local' | 'openai'
  model?: string
}

export interface HealthReport {
  ok: boolean
  checks?: Record<string, { ok?: boolean; latencyMs?: number; error?: string }>
  queues?: Record<string, Record<string, number>>
  ingest?: Record<string, number>
}

export interface SourcemapUploadResponse {
  uploaded: number
}

export type OperationsQueueName = 'events' | 'cleanup'

export interface QueueFailedJob {
  id: string
  name: string
  failedReason?: string | null
  timestamp: number
}

export interface QueueOperationsSnapshot {
  counts: Record<string, number>
  failedJobs: QueueFailedJob[]
}

export interface QueueOperationsReport {
  events: QueueOperationsSnapshot
  cleanup: QueueOperationsSnapshot
}

export interface AuditLogRow {
  createdAt: string
  actorUserId?: string | null
  projectId?: string | null
  action: string
  targetType: string
  targetId?: string | null
  metadata?: Record<string, unknown> | null
}

export interface AuditLogFilters {
  projectId: string
  actorUserId?: string
  action?: string
  targetType?: string
  from?: string
  to?: string
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (!(init?.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`)
  return res.json()
}

function searchParams<T extends object>(params: T): string {
  const search = new URLSearchParams()
  Object.entries(params as Record<string, unknown>).forEach(([key, value]) => {
    if (value !== undefined && String(value).trim() !== '') search.set(key, String(value))
  })
  return search.toString()
}

export const api = {
  health: () => apiFetch<HealthReport>('/health'),
  issues: {
    list: (params: Record<string, string>) =>
      apiFetch<IssueListResponse>(`/api/issues?${new URLSearchParams(params)}`),
    get: (id: string) => apiFetch<Issue>(`/api/issues/${id}`),
    events: (id: string) => apiFetch<EventRow[]>(`/api/issues/${id}/events`),
    update: (id: string, body: { status: IssueStatus }) =>
      apiFetch<Issue>(`/api/issues/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    assign: (id: string, body: { assigneeUserId: string | null }) =>
      apiFetch<Issue>(`/api/issues/${id}/assignment`, { method: 'PATCH', body: JSON.stringify(body) }),
    markFixed: (id: string, body: { release: string }) =>
      apiFetch<Issue>(`/api/issues/${id}/fix`, { method: 'PATCH', body: JSON.stringify(body) }),
    comments: (id: string) => apiFetch<IssueComment[]>(`/api/issues/${id}/comments`),
    addComment: (id: string, body: { body: string }) =>
      apiFetch<IssueComment>(`/api/issues/${id}/comments`, { method: 'POST', body: JSON.stringify(body) }),
    facets: (id: string) => apiFetch<IssueFacets>(`/api/issues/${id}/facets`),
    merge: (id: string, body: { targetIssueId: string }) =>
      apiFetch<Issue>(`/api/issues/${id}/merge`, { method: 'POST', body: JSON.stringify(body) }),
    split: (id: string, body: { eventIds: string[] }) =>
      apiFetch<Issue>(`/api/issues/${id}/split`, { method: 'POST', body: JSON.stringify(body) }),
    aiAnalysis: (id: string) =>
      apiFetch<AiAnalysis>(`/api/issues/${encodeURIComponent(id)}/ai-analysis`, { method: 'POST' }),
  },
  events: {
    get: (id: string) => apiFetch<EventRow>(`/api/events/${id}`),
    replay: (id: string) => apiFetch<{ events: unknown[] }>(`/api/events/${id}/replay`),
  },
  stats: {
    issues: (projectId: string, days = 7) =>
      apiFetch<TrendPoint[]>(`/api/stats/issues?projectId=${projectId}&days=${days}`),
    performance: (projectId: string) =>
      apiFetch<PerformanceSummary[]>(`/api/stats/performance?projectId=${projectId}`),
    aiPerformance: (projectId: string) =>
      apiFetch<AiAnalysis>(`/api/stats/performance/ai-analysis?${new URLSearchParams({ projectId })}`, { method: 'POST' }),
  },
  sourcemaps: {
    upload: (projectId: string, release: string, formData: FormData) =>
      apiFetch<SourcemapUploadResponse>(
        `/api/sourcemaps/${encodeURIComponent(projectId)}/${encodeURIComponent(release)}`,
        { method: 'POST', body: formData },
      ),
  },
  operations: {
    queues: (projectId: string) =>
      apiFetch<QueueOperationsReport>(`/api/operations/queues?${new URLSearchParams({ projectId })}`),
    retryQueueJob: (projectId: string, queueName: OperationsQueueName, jobId: string) =>
      apiFetch<{ ok: true }>(
        `/api/operations/queues/${queueName}/jobs/${encodeURIComponent(jobId)}/retry?${new URLSearchParams({ projectId })}`,
        { method: 'POST' },
      ),
    removeQueueJob: (projectId: string, queueName: OperationsQueueName, jobId: string) =>
      apiFetch<{ ok: true }>(
        `/api/operations/queues/${queueName}/jobs/${encodeURIComponent(jobId)}?${new URLSearchParams({ projectId })}`,
        { method: 'DELETE' },
      ),
  },
  auditLogs: {
    list: (params: AuditLogFilters) => apiFetch<AuditLogRow[]>(`/api/audit-logs?${searchParams(params)}`),
    exportUrl: (params: AuditLogFilters) => `${API_BASE}/api/audit-logs/export.csv?${searchParams(params)}`,
  },
  projects: {
    list: () => apiFetch<Project[]>('/api/projects'),
    create: (body: { name: string; slug: string }) =>
      apiFetch<Project[]>('/api/projects', { method: 'POST', body: JSON.stringify(body) }),
    rotateToken: (id: string) => apiFetch<Project[]>(`/api/projects/${id}/rotate-token`, { method: 'POST' }),
    updateAiAnalysis: (id: string, enabled: boolean) =>
      apiFetch<Project[]>(`/api/projects/${id}/ai-analysis`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),
    updateAlertSettings: (
      id: string,
      body: { webhookUrl: string | null; alertThreshold: number; alertUserThreshold: number },
    ) =>
      apiFetch<Project[]>(`/api/projects/${id}/alert-settings`, { method: 'PATCH', body: JSON.stringify(body) }),
    members: (projectId: string) => apiFetch<ProjectMember[]>(`/api/projects/${projectId}/members`),
    addMember: (projectId: string, body: { email: string; role: ProjectRole }) =>
      apiFetch<ProjectMember>(`/api/projects/${projectId}/members`, { method: 'POST', body: JSON.stringify(body) }),
    updateMemberRole: (projectId: string, userId: string, role: ProjectRole) =>
      apiFetch<ProjectMember>(`/api/projects/${projectId}/members/${userId}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    removeMember: (projectId: string, userId: string) =>
      apiFetch<{ ok: true }>(`/api/projects/${projectId}/members/${userId}`, { method: 'DELETE' }),
    invitations: (projectId: string) => apiFetch<ProjectInvitation[]>(`/api/projects/${projectId}/invitations`),
    createInvitation: (projectId: string, body: { email: string; role: ProjectRole }) =>
      apiFetch<ProjectInvitation>(`/api/projects/${projectId}/invitations`, { method: 'POST', body: JSON.stringify(body) }),
    resendInvitation: (projectId: string, invitationId: string) =>
      apiFetch<ProjectInvitation>(`/api/projects/${projectId}/invitations/${invitationId}/resend`, { method: 'POST' }),
    revokeInvitation: (projectId: string, invitationId: string) =>
      apiFetch<{ ok: true }>(`/api/projects/${projectId}/invitations/${invitationId}`, { method: 'DELETE' }),
  },
  invitations: {
    detail: (token: string) => apiFetch<ProjectInvitation>(`/api/invitations/${encodeURIComponent(token)}`),
    accept: (token: string) => apiFetch<ProjectInvitation>(`/api/invitations/${encodeURIComponent(token)}/accept`, { method: 'POST' }),
  },
}
