import { HttpException, HttpStatus, Inject, Injectable, Optional, PayloadTooLargeException } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'

export type IngestBodyKind = 'ingest' | 'replay'

export interface IngestLimitsOptions {
  maxIngestBytes?: number
  maxReplayBytes?: number
  rateLimitWindowMs?: number
  maxRequestsPerWindow?: number
  dailyEventQuota?: number
}

export const INGEST_LIMITS_OPTIONS = Symbol('INGEST_LIMITS_OPTIONS')

interface WindowCounter {
  resetAt: number
  count: number
}

interface RedisCounterClient {
  incrby(key: string, amount: number): Promise<number>
  decrby(key: string, amount: number): Promise<number>
  pexpire(key: string, milliseconds: number): Promise<unknown>
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

  constructor(
    @Optional() @Inject(INGEST_LIMITS_OPTIONS) options: IngestLimitsOptions = {},
    @Optional() @InjectQueue('ingest') private readonly ingestQueue?: Queue,
  ) {
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

  async assertRequestAllowed(projectId: string, now = Date.now()): Promise<void> {
    const count = await this.incrementCounter(
      `ingest:rate:${projectId}`,
      1,
      this.maxRequestsPerWindow,
      this.rateLimitWindowMs,
      now,
      this.requestWindows,
    )
    if (count > this.maxRequestsPerWindow) {
      throw new HttpException('ingest rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS)
    }
  }

  async assertDailyQuota(projectId: string, eventCount: number, now = Date.now()): Promise<void> {
    const count = await this.incrementCounter(
      `ingest:quota:${projectId}:${this.utcDayKey(now)}`,
      eventCount,
      this.dailyEventQuota,
      this.msUntilNextUtcDay(now),
      now,
      this.dailyUsage,
    )
    if (count > this.dailyEventQuota) {
      throw new HttpException('daily ingest quota exceeded', HttpStatus.TOO_MANY_REQUESTS)
    }
  }

  private async incrementCounter(
    key: string,
    amount: number,
    limit: number,
    ttlMs: number,
    now: number,
    fallbackCounters: Map<string, WindowCounter>,
  ): Promise<number> {
    const redis = await this.redisClient()
    if (!redis) {
      const count = this.incrementMemoryCounter(fallbackCounters, key, amount, now, ttlMs)
      if (count > limit) this.incrementMemoryCounter(fallbackCounters, key, -amount, now, ttlMs)
      return count
    }

    const count = await redis.incrby(key, amount)
    if (count === amount) await redis.pexpire(key, ttlMs)
    if (count > limit) {
      await redis.decrby(key, amount)
    }
    return count
  }

  private incrementMemoryCounter(
    counters: Map<string, WindowCounter>,
    key: string,
    amount: number,
    now: number,
    ttlMs: number,
  ): number {
    const current = counters.get(key)
    if (!current || current.resetAt <= now) {
      const next = { resetAt: now + ttlMs, count: amount }
      counters.set(key, next)
      return next.count
    }
    current.count += amount
    return current.count
  }

  private async redisClient(): Promise<RedisCounterClient | null> {
    const client = (this.ingestQueue as (Queue & { client?: Promise<RedisCounterClient> }) | undefined)?.client
    return client ? await client : null
  }

  private msUntilNextUtcDay(now: number): number {
    const date = new Date(now)
    const nextDay = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1)
    return nextDay - now
  }

  private utcDayKey(now: number): string {
    return new Date(now).toISOString().slice(0, 10)
  }
}
