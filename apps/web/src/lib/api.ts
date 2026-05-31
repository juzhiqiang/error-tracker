const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`)
  return res.json()
}

export const api = {
  issues: {
    list: (params: Record<string, string>) =>
      apiFetch<{ rows: unknown[]; total: number }>(`/api/issues?${new URLSearchParams(params)}`),
    get: (id: string) => apiFetch<unknown>(`/api/issues/${id}`),
    events: (id: string) => apiFetch<unknown[]>(`/api/issues/${id}/events`),
    update: (id: string, body: { status: string }) =>
      apiFetch(`/api/issues/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  },
  events: {
    get: (id: string) => apiFetch<unknown>(`/api/events/${id}`),
    replay: (id: string) => apiFetch<{ events: unknown[] }>(`/api/events/${id}/replay`),
  },
  stats: {
    issues: (projectId: string) => apiFetch<unknown[]>(`/api/stats/issues?projectId=${projectId}`),
    performance: (projectId: string) => apiFetch<unknown[]>(`/api/stats/performance?projectId=${projectId}`),
  },
  projects: {
    list: () => apiFetch<unknown[]>('/api/projects'),
    create: (body: { name: string; slug: string }) =>
      apiFetch('/api/projects', { method: 'POST', body: JSON.stringify(body) }),
  },
}
