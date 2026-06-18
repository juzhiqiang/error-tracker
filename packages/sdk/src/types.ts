export type Level = 'fatal' | 'error' | 'warning' | 'info' | 'debug'

export type BreadcrumbType = 'ui.click' | 'ui.input' | 'navigation' | 'http' | 'console' | 'error'

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

export interface WebVitalPerformanceEvent {
  eventId: string
  timestamp: number
  type: 'performance'
  kind?: 'web-vital'
  name: 'LCP' | 'FID' | 'CLS' | 'INP' | 'TTFB' | 'FCP'
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  url?: string
  context?: EventContext
}

export interface ResourcePerformanceEvent {
  eventId: string
  timestamp: number
  type: 'performance'
  kind: 'resource'
  name: 'resource'
  value: number
  duration: number
  url: string
  initiatorType?: string
  transferSize?: number
  encodedBodySize?: number
  decodedBodySize?: number
  traceId?: string
  context?: EventContext
}

export interface LongTaskPerformanceEvent {
  eventId: string
  timestamp: number
  type: 'performance'
  kind: 'longtask'
  name: 'longtask'
  value: number
  duration: number
  startTime?: number
  context?: EventContext
}

export type PerformanceEvent = WebVitalPerformanceEvent | ResourcePerformanceEvent | LongTaskPerformanceEvent

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

export interface CaptureMessageOptions {
  fingerprint?: string
  tags?: Record<string, string>
  context?: EventContext
}

export interface BlankScreenOptions {
  enabled?: boolean
  samplePointCount?: number
  threshold?: number
  delayMs?: number
  blankSelectors?: string[]
}

export interface TracingOptions {
  enabled?: boolean
  tracePropagationTargets?: Array<string | RegExp>
}

export interface SdkOptions {
  dsn: string
  token?: string
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
  blankScreen?: BlankScreenOptions
  tracing?: TracingOptions
  beforeSend?: (event: ErrorEvent) => ErrorEvent | null
}
