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
  retentionDays?: number | null
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
  environment: string | null
  release: string | null
}

export interface IssueListResponse {
  rows: Issue[]
  total: number
  page: number
  limit: number
}

export interface TrendPoint {
  hour: string
  count: number | string
}

export interface PerformanceSummary {
  name: 'LCP' | 'FID' | 'CLS' | 'INP' | 'TTFB'
  rating: 'good' | 'needs-improvement' | 'poor'
  count: number | string
  avg_value: number | string
}

export interface HealthReport {
  ok: boolean
  checks?: Record<string, { ok?: boolean; latencyMs?: number; error?: string }>
  queues?: Record<string, Record<string, number>>
  ingest?: Record<string, number>
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`)
  return res.json()
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
  },
  projects: {
    list: () => apiFetch<Project[]>('/api/projects'),
    create: (body: { name: string; slug: string }) =>
      apiFetch<Project[]>('/api/projects', { method: 'POST', body: JSON.stringify(body) }),
    rotateToken: (id: string) => apiFetch<Project[]>(`/api/projects/${id}/rotate-token`, { method: 'POST' }),
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
