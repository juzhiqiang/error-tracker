import { HttpException, HttpStatus, Injectable, PayloadTooLargeException } from '@nestjs/common'

export type IngestBodyKind = 'ingest' | 'replay'

export interface IngestLimitsOptions {
  maxIngestBytes?: number
  maxReplayBytes?: number
  rateLimitWindowMs?: number
  maxRequestsPerWindow?: number
  dailyEventQuota?: number
}

interface WindowCounter {
  resetAt: number
  count: number
}

@Injectable()
export class IngestLimitsService {
  private readonly maxIngestBytes: number
  private readonly maxReplayBytes: number
  private readonly rateLimitWindowMs: number
  private readonly maxRequestsPerWindow: number
  private readonly dailyEventQuota: number
  private readonly requestWindows = new Map<string, WindowCounter>()
  private readonly dailyUsage = new Map<string, WindowCounter>()

  constructor(options: IngestLimitsOptions = {}) {
    this.maxIngestBytes = options.maxIngestBytes ?? Number(process.env.INGEST_MAX_BODY_BYTES ?? 512 * 1024)
    this.maxReplayBytes = options.maxReplayBytes ?? Number(process.env.REPLAY_MAX_BODY_BYTES ?? 5 * 1024 * 1024)
    this.rateLimitWindowMs = options.rateLimitWindowMs ?? Number(process.env.INGEST_RATE_WINDOW_MS ?? 60_000)
    this.maxRequestsPerWindow = options.maxRequestsPerWindow ?? Number(process.env.INGEST_RATE_MAX_REQUESTS ?? 300)
    this.dailyEventQuota = options.dailyEventQuota ?? Number(process.env.INGEST_DAILY_EVENT_QUOTA ?? 100_000)
  }

  assertBodySize(kind: IngestBodyKind, body: unknown): void {
    const bytes = Buffer.byteLength(JSON.stringify(body ?? null), 'utf8')
    const limit = kind === 'replay' ? this.maxReplayBytes : this.maxIngestBytes
    if (bytes > limit) {
      throw new PayloadTooLargeException(`${kind} body cannot exceed ${limit} bytes`)
    }
  }

  assertRequestAllowed(projectId: string, now = Date.now()): void {
    const window = this.currentCounter(this.requestWindows, projectId, now, this.rateLimitWindowMs)
    if (window.count >= this.maxRequestsPerWindow) {
      throw new HttpException('ingest rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS)
    }
    window.count += 1
  }

  assertDailyQuota(projectId: string, eventCount: number, now = Date.now()): void {
    const window = this.currentCounter(this.dailyUsage, projectId, now, this.msUntilNextUtcDay(now))
    if (window.count + eventCount > this.dailyEventQuota) {
      throw new HttpException('daily ingest quota exceeded', HttpStatus.TOO_MANY_REQUESTS)
    }
    window.count += eventCount
  }

  private currentCounter(counters: Map<string, WindowCounter>, key: string, now: number, ttlMs: number): WindowCounter {
    const current = counters.get(key)
    if (!current || current.resetAt <= now) {
      const next = { resetAt: now + ttlMs, count: 0 }
      counters.set(key, next)
      return next
    }
    return current
  }

  private msUntilNextUtcDay(now: number): number {
    const date = new Date(now)
    const nextDay = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1)
    return nextDay - now
  }
}
