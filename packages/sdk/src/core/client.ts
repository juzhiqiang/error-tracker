import type { CaptureMessageOptions, EventContext, SdkOptions, ErrorEvent, TrackerEvent } from '../types'
import { BreadcrumbManager } from './breadcrumbs'
import { DedupeFilter } from './dedupe'
import { EventQueue } from './queue'
import { clientFingerprint, parseStackFrames } from './fingerprint'
import { HttpTransport } from '../transports/http'
import { Scope } from './scope'
import { randomId } from './utils'

export class ErrorTrackerClient {
  readonly breadcrumbs: BreadcrumbManager
  private readonly dedupe: DedupeFilter
  private readonly queue: EventQueue
  private readonly transport: HttpTransport
  readonly scope: Scope
  private readonly options: Required<Pick<SdkOptions, 'dsn' | 'sampleRate'>> & SdkOptions
  private readonly context: EventContext = {}

  constructor(options: SdkOptions) {
    this.options = { sampleRate: 1.0, ...options }
    this.breadcrumbs = new BreadcrumbManager(100)
    this.dedupe = new DedupeFilter(5000)
    this.transport = new HttpTransport(options.dsn, options.token)
    this.scope = new Scope()
    this.queue = new EventQueue(
      options.queue?.maxSize ?? 50,
      async (events) => {
        await this.transport.send(events)
      },
      {
        maxRetries: options.queue?.maxRetries,
        retryDelayMs: options.queue?.retryDelayMs,
        persist: options.queue?.persist,
        persistenceKey: options.queue?.persistenceKey,
      },
    )
  }

  captureException(error: Error, extra?: Record<string, unknown>): string | null {
    if (Math.random() > this.options.sampleRate) return null

    const fingerprint = clientFingerprint(error)
    if (!this.dedupe.shouldSend(fingerprint)) return null

    let event: ErrorEvent = {
      eventId: randomId(),
      timestamp: Date.now(),
      level: 'error',
      message: error.message,
      fingerprint,
      environment: this.options.environment,
      release: this.options.release,
      stacktrace: parseStackFrames(error.stack ?? ''),
      breadcrumbs: this.breadcrumbs.getAll(),
      user: this.scope.getUser() as ErrorEvent['user'],
      tags: { ...this.scope.getTags(), ...(extra as Record<string, string> | undefined) },
      context: this.getContext(),
    }

    if (this.options.beforeSend) {
      const result = this.options.beforeSend(event)
      if (result === null) return null
      event = result
    }

    this.queue.enqueue(event)
    void this.queue.flush().catch(() => undefined)
    return event.eventId
  }

  captureMessage(message: string, level: ErrorEvent['level'] = 'info', options: CaptureMessageOptions = {}): void {
    const event: ErrorEvent = {
      eventId: randomId(),
      timestamp: Date.now(),
      level,
      message,
      fingerprint: options.fingerprint ?? randomId(),
      environment: this.options.environment,
      release: this.options.release,
      user: this.scope.getUser() as ErrorEvent['user'],
      tags: { ...this.scope.getTags(), ...(options.tags ?? {}) },
      breadcrumbs: this.breadcrumbs.getAll(),
      context: { ...this.getContext(), ...(options.context ?? {}) },
    }
    this.queue.enqueue(event)
  }

  capturePerformance(event: TrackerEvent): void {
    this.queue.enqueue({ ...event, context: event.context ?? this.getContext() })
  }

  async flush(isUnloading = false): Promise<void> {
    if (isUnloading) {
      const events = (this.queue as unknown as { items: TrackerEvent[] }).items.splice(0)
      if (events.length > 0) this.transport.send(events, true)
      return
    }
    await this.queue.flush()
  }

  setupIntegrations(): void {
    this.options.integrations?.forEach((i) => i.setup(this))
  }

  setContext(key: string, value: unknown): void {
    this.context[key] = value
  }

  getContext(): EventContext {
    return { ...this.context }
  }
}
