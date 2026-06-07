export type Level = 'fatal' | 'error' | 'warning' | 'info' | 'debug'

export type BreadcrumbType = 'ui.click' | 'navigation' | 'http' | 'console' | 'error'

export interface Breadcrumb {
  timestamp: number
  type: BreadcrumbType
  message?: string
  data?: Record<string, unknown>
}

export interface StackFrame {
  filename: string
  function: string
  lineno?: number
  colno?: number
  inApp?: boolean
}

export interface ErrorEvent {
  eventId: string
  timestamp: number
  level: Level
  message: string
  fingerprint: string
  environment?: string
  release?: string
  stacktrace?: StackFrame[]
  breadcrumbs?: Breadcrumb[]
  request?: {
    url?: string
    method?: string
    headers?: Record<string, string>
  }
  user?: {
    id?: string
    ip?: string
    userAgent?: string
  }
  tags?: Record<string, string>
  context?: EventContext
}

export interface PerformanceEvent {
  eventId: string
  timestamp: number
  type: 'performance'
  name: 'LCP' | 'FID' | 'CLS' | 'INP' | 'TTFB'
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  url?: string
  context?: EventContext
}

export type TrackerEvent = ErrorEvent | PerformanceEvent

export interface EventContext {
  environment?: import('./core/environment').EnvironmentSnapshot
  [key: string]: unknown
}

export interface Integration {
  name: string
  setup(client: import('./core/client').ErrorTrackerClient): void
  teardown?(): void
}

export interface SdkOptions {
  dsn: string
  environment?: string
  release?: string
  sampleRate?: number
  queue?: {
    maxSize?: number
    maxRetries?: number
    retryDelayMs?: number
    persist?: boolean
    persistenceKey?: string
  }
  integrations?: Integration[]
  beforeSend?: (event: ErrorEvent) => ErrorEvent | null
}
