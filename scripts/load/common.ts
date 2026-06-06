export interface LoadProject {
  projectId: string
  token: string
  cookie?: string
}

export interface TimedResult {
  status: number
  durationMs: number
}

export const apiUrl = (process.env.ERROR_TRACKER_API_URL ?? 'http://localhost:3002').replace(/\/$/, '')
const webOrigin = process.env.ERROR_TRACKER_WEB_ORIGIN ?? 'http://localhost:3003'
const email = process.env.ERROR_TRACKER_LOAD_EMAIL ?? process.env.E2E_EMAIL ?? 'e2e-owner@example.com'
const password = process.env.ERROR_TRACKER_LOAD_PASSWORD ?? process.env.E2E_PASSWORD ?? 'e2e-password-123'
const loadProjectSlug = process.env.ERROR_TRACKER_LOAD_PROJECT_SLUG ?? 'load-test'

export function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback)
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

export function envSizes(name: string, fallback: number[]): number[] {
  return (process.env[name] ?? fallback.join(','))
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0)
}

export async function ensureLoadProject(): Promise<LoadProject> {
  if (process.env.ERROR_TRACKER_PROJECT_ID && process.env.ERROR_TRACKER_DSN_TOKEN) {
    return {
      projectId: process.env.ERROR_TRACKER_PROJECT_ID,
      token: process.env.ERROR_TRACKER_DSN_TOKEN,
      cookie: await signInCookie().catch(() => undefined),
    }
  }

  const cookie = await signInCookie()
  const existing = await authedJson<Array<{ id: string; slug: string; dsnToken: string }>>('/api/projects', cookie)
  const project = existing.find((item) => item.slug === loadProjectSlug)
  if (project) {
    return { projectId: project.id, token: project.dsnToken, cookie }
  }

  const created = await authedJson<Array<{ id: string; dsnToken: string }>>('/api/projects', cookie, {
    method: 'POST',
    body: JSON.stringify({ name: 'Load Test', slug: loadProjectSlug }),
  })
  const first = created[0]
  if (!first) throw new Error('Unable to create load-test project')
  return { projectId: first.id, token: first.dsnToken, cookie }
}

export async function timedFetch(url: string, init?: RequestInit): Promise<TimedResult> {
  const started = performance.now()
  const response = await fetch(url, init)
  await response.arrayBuffer().catch(() => undefined)
  return { status: response.status, durationMs: Math.round(performance.now() - started) }
}

export function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.ceil((percentileValue / 100) * sorted.length) - 1)
  return sorted[index]
}

export async function runWorkers(total: number, concurrency: number, task: (index: number) => Promise<void>): Promise<void> {
  let next = 0
  const workerCount = Math.max(1, Math.min(concurrency, Math.max(total, 1)))
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (next < total) {
        const index = next
        next += 1
        await task(index)
      }
    }),
  )
}

async function signInCookie(): Promise<string> {
  let response = await authRequest('/api/auth/sign-in/email', { email, password })
  if (!response.ok) {
    await authRequest('/api/auth/sign-up/email', { name: 'Load Test Owner', email, password })
    response = await authRequest('/api/auth/sign-in/email', { email, password })
  }
  if (!response.ok) {
    throw new Error(`Unable to sign in load user ${email}: ${response.status}`)
  }
  const cookies = getSetCookies(response)
  if (cookies.length === 0) {
    throw new Error('Auth response did not include session cookies')
  }
  return cookies.map((cookie) => cookie.split(';')[0]).join('; ')
}

async function authRequest(path: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(`${apiUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: webOrigin },
    body: JSON.stringify(body),
  })
}

async function authedJson<T>(path: string, cookie: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  headers.set('Cookie', cookie)
  const response = await fetch(`${apiUrl}${path}`, { ...init, headers })
  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${await response.text()}`)
  }
  return (await response.json()) as T
}

function getSetCookies(response: Response): string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] }
  const cookies = headers.getSetCookie?.()
  if (cookies?.length) return cookies
  const cookie = response.headers.get('set-cookie')
  return cookie ? [cookie] : []
}
