import { HttpException, Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common'
import { createHash, randomUUID } from 'crypto'

export const SELF_MONITORING_ENV = Symbol('SELF_MONITORING_ENV')
export const SELF_MONITORING_RUNTIME = Symbol('SELF_MONITORING_RUNTIME')

export interface SelfMonitoringEnv {
  ERROR_TRACKER_DSN?: string
  ERROR_TRACKER_TOKEN?: string
  ERROR_TRACKER_SELF_MONITORING_ENABLED?: string
  ERROR_TRACKER_ENVIRONMENT?: string
  ERROR_TRACKER_RELEASE?: string
}

export interface SelfMonitoringContext {
  method?: string
  path?: string
  statusCode?: number
}

type Sender = (input: string, init?: RequestInit) => Promise<Response>

export interface SelfMonitoringRuntime {
  sender?: Sender
  idFactory?: () => string
  now?: () => number
}

interface StackFrame {
  function: string
  filename: string
  lineno?: number
  colno?: number
}

@Injectable()
export class SelfMonitoringService implements OnModuleInit, OnModuleDestroy {
  private readonly env: SelfMonitoringEnv
  private readonly sender?: Sender
  private readonly idFactory: () => string
  private readonly now: () => number
  private hooksInstalled = false

  constructor(
    @Optional() @Inject(SELF_MONITORING_ENV) env?: SelfMonitoringEnv,
    @Optional() @Inject(SELF_MONITORING_RUNTIME) runtime: SelfMonitoringRuntime = {},
  ) {
    this.env = env ?? process.env
    this.sender = runtime.sender ?? defaultSender()
    this.idFactory = runtime.idFactory ?? randomUUID
    this.now = runtime.now ?? Date.now
  }

  onModuleInit(): void {
    if (!this.isEnabled() || this.hooksInstalled) return
    process.on('unhandledRejection', this.handleUnhandledRejection)
    process.on('uncaughtExceptionMonitor', this.handleUncaughtException)
    this.hooksInstalled = true
  }

  onModuleDestroy(): void {
    if (!this.hooksInstalled) return
    process.off('unhandledRejection', this.handleUnhandledRejection)
    process.off('uncaughtExceptionMonitor', this.handleUncaughtException)
    this.hooksInstalled = false
  }

  isEnabled(): boolean {
    return Boolean(this.dsn()) && !isExplicitlyDisabled(this.env.ERROR_TRACKER_SELF_MONITORING_ENABLED)
  }

  shouldCapture(exception: unknown, context: SelfMonitoringContext = {}): boolean {
    if (!this.isEnabled()) return false
    const path = sanitizePath(context.path)
    if (path?.startsWith('/ingest')) return false
    if (exception instanceof HttpException) return exception.getStatus() >= 500
    return true
  }

  async captureException(exception: unknown, context: SelfMonitoringContext = {}): Promise<void> {
    if (!this.isEnabled()) return
    const dsn = this.dsn()
    if (!dsn || !this.sender) return
    const destination = ingestDestination(dsn, this.env.ERROR_TRACKER_TOKEN)

    const error = normalizeError(exception)
    const statusCode = context.statusCode ?? (exception instanceof HttpException ? exception.getStatus() : 500)
    const path = sanitizePath(context.path)
    if (path?.startsWith('/ingest')) return

    const timestamp = this.now()
    const message = redactText(error.message || error.name)
    const event = {
      eventId: this.idFactory(),
      timestamp,
      level: 'error',
      message,
      fingerprint: buildFingerprint(error.name, message),
      environment: optionalTrim(this.env.ERROR_TRACKER_ENVIRONMENT),
      release: optionalTrim(this.env.ERROR_TRACKER_RELEASE),
      stacktrace: parseStackFrames(error.stack),
      request: context.method || path ? { method: context.method, url: path } : undefined,
      tags: {
        service: 'api',
        source: 'self-monitoring',
        statusCode: String(statusCode),
      },
    }

    try {
      await this.sender(destination.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(destination.token ? { 'x-error-tracker-token': destination.token } : {}),
        },
        body: JSON.stringify({
          events: [event],
          sentAt: new Date(timestamp).toISOString(),
        }),
      })
    } catch {
      // Self-monitoring must never break the request that triggered it.
    }
  }

  private dsn(): string | undefined {
    return optionalTrim(this.env.ERROR_TRACKER_DSN)
  }

  private readonly handleUnhandledRejection = (reason: unknown) => {
    void this.captureException(reason, { statusCode: 500 })
  }

  private readonly handleUncaughtException = (error: Error) => {
    void this.captureException(error, { statusCode: 500 })
  }
}

function defaultSender(): Sender | undefined {
  return typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : undefined
}

function buildFingerprint(name: string, message: string): string {
  const readable = `api:self-monitoring:${name}:${message}`
  if (readable.length <= 180) return readable
  return `api:self-monitoring:${createHash('sha1').update(readable).digest('hex').slice(0, 16)}`
}

function normalizeError(exception: unknown): Error {
  if (exception instanceof Error) return exception
  if (exception instanceof HttpException) return new Error(String(exception.message))
  return new Error(String(exception))
}

function parseStackFrames(stack: string | undefined): StackFrame[] {
  if (!stack) return []
  return stack
    .split('\n')
    .slice(1, 11)
    .map((line): StackFrame | null => {
      const match = line.trim().match(/^at\s+(?:(.*?)\s+\()?(.+?):(\d+):(\d+)\)?$/)
      if (!match) return null
      return {
        function: match[1] || '<anonymous>',
        filename: match[2],
        lineno: Number(match[3]),
        colno: Number(match[4]),
      }
    })
    .filter((frame): frame is StackFrame => Boolean(frame))
}

function sanitizePath(path: string | undefined): string | undefined {
  if (!path) return undefined
  const [withoutHash] = path.split('#')
  const [withoutQuery] = withoutHash.split('?')
  return withoutQuery || '/'
}

function redactText(value: string): string {
  return value.replace(/\b(?:password|passwd|pwd|token|secret|authorization|api[_-]?key)=[^\s&]+/gi, '[Filtered]')
}

function optionalTrim(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed || undefined
}

function ingestDestination(dsn: string, explicitToken?: string): { url: string; token?: string } {
  const configuredToken = optionalTrim(explicitToken)
  try {
    const url = new URL(dsn)
    const parts = url.pathname.split('/').filter(Boolean)
    const ingestIndex = parts.lastIndexOf('ingest')
    const token = ingestIndex >= 0 ? parts[ingestIndex + 2] : undefined
    if (token) {
      url.pathname = `/${parts.slice(0, ingestIndex + 2).join('/')}`
      return { url: url.toString(), token: configuredToken ?? token }
    }
  } catch {
    return { url: dsn, token: configuredToken }
  }
  return { url: dsn, token: configuredToken }
}

function isExplicitlyDisabled(value: string | undefined): boolean {
  return ['0', 'false', 'no', 'off'].includes(value?.trim().toLowerCase() ?? '')
}
