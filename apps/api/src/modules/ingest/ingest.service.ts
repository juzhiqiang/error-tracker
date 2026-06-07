import { Injectable, Inject } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { createHash } from 'crypto'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { DB } from '../../db/db.module'
import { events, issues, issueUsers, performanceMetrics, replays } from '../../db/schema'
import { MinioService } from '../sourcemaps/minio.service'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../db/schema'
import { scrubPii } from './pii-scrubber'

interface StackFrame {
  function: string
  filename: string
  lineno?: number
  colno?: number
}

interface IncomingEvent {
  eventId: string
  timestamp: number
  level: string
  message: string
  fingerprint: string
  stacktrace?: StackFrame[]
  breadcrumbs?: unknown[]
  request?: Record<string, unknown>
  user?: Record<string, unknown>
  tags?: Record<string, string>
  context?: Record<string, unknown>
  environment?: string
  release?: string
}

interface PerformancePayload {
  eventId: string
  type: 'performance'
  name: 'LCP' | 'FID' | 'CLS' | 'INP' | 'TTFB'
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  url?: string
  timestamp: number
}

@Injectable()
export class IngestService {
  constructor(
    @Inject(DB) private db: PostgresJsDatabase<typeof schema>,
    @InjectQueue('events') private eventsQueue: Queue,
    private readonly minio: MinioService,
  ) {}

  async ingestEvent(projectId: string, payload: IncomingEvent): Promise<void> {
    const issueId = await this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${payload.eventId}), 0)`)

      const [existingEvent] = await tx.select({ id: events.id }).from(events).where(eq(events.id, payload.eventId)).limit(1)
      if (existingEvent) return null

      const serverFingerprint = this.computeServerFingerprint(payload)

      const result = await tx.execute(sql`
        INSERT INTO issues (project_id, fingerprint, title, level, first_seen, last_seen, count, user_count)
        VALUES (${projectId}, ${serverFingerprint}, ${payload.message.slice(0, 255)}, ${payload.level}, now(), now(), 1, 0)
        ON CONFLICT (project_id, fingerprint) DO UPDATE SET
          last_seen = now(),
          count = issues.count + 1,
          status = CASE WHEN issues.status = 'resolved' THEN 'unresolved' ELSE issues.status END
        RETURNING id
      `)

      const issueId =
        (result as unknown as { rows?: { id: string }[] }).rows?.[0]?.id ??
        (result as unknown as { id: string }[])[0]?.id

      const userHash = issueId ? this.computeUserHash(issueId, payload.user) : null
      if (issueId && userHash) {
        const insertedUsers = await tx
          .insert(issueUsers)
          .values({ issueId, userHash })
          .onConflictDoNothing()
          .returning({ id: issueUsers.id })

        if (insertedUsers.length > 0) {
          await tx
            .update(issues)
            .set({ userCount: sql`${issues.userCount} + 1` })
            .where(eq(issues.id, issueId))
        }
      }

      await tx
        .insert(events)
        .values({
          id: payload.eventId,
          issueId,
          projectId,
          timestamp: new Date(payload.timestamp),
          level: payload.level,
          message: payload.message,
          stacktrace: payload.stacktrace ?? null,
          breadcrumbs: payload.breadcrumbs ? scrubPii(payload.breadcrumbs) : null,
          request: payload.request ? scrubPii(payload.request) : null,
          user: payload.user ? scrubPii(payload.user) : null,
          tags: payload.tags ? scrubPii(payload.tags) : null,
          context: payload.context ? scrubPii(payload.context) : null,
          environment: payload.environment,
          release: payload.release,
        })
        .onConflictDoNothing()

      await tx
        .update(replays)
        .set({ eventId: payload.eventId })
        .where(and(isNull(replays.eventId), eq(replays.storageUrl, this.replayStorageKey(projectId, payload.eventId))))

      return issueId
    })

    if (!issueId) return

    await this.eventsQueue.add('check-alert', { projectId, issueId }, this.alertJobOptions())
  }

  async ingestPerformance(projectId: string, metrics: PerformancePayload[]): Promise<void> {
    if (!metrics.length) return
    await this.db.insert(performanceMetrics).values(
      metrics.map((m) => ({
        projectId,
        name: m.name,
        value: Math.round(m.value),
        rating: m.rating,
        url: m.url,
        timestamp: new Date(m.timestamp),
      })),
    )
  }

  async ingestReplay(projectId: string, eventId: string, rrwebEvents: unknown[]): Promise<void> {
    if (!rrwebEvents?.length) return

    const key = this.replayStorageKey(projectId, eventId)
    await this.minio.upload(key, JSON.stringify(rrwebEvents), 'application/json')

    const timestamps = rrwebEvents as { timestamp?: number }[]
    const first = timestamps[0]?.timestamp ?? 0
    const last = timestamps[timestamps.length - 1]?.timestamp ?? first
    const duration = Math.max(0, last - first)

    const [event] = await this.db.select({ id: events.id }).from(events).where(eq(events.id, eventId)).limit(1)
    await this.db
      .insert(replays)
      .values({ eventId: event ? eventId : null, storageUrl: key, duration })
      .onConflictDoNothing()
  }

  private replayStorageKey(projectId: string, eventId: string): string {
    return `replays/${projectId}/${eventId}.json`
  }

  private computeServerFingerprint(event: IncomingEvent): string {
    const frames = (event.stacktrace ?? []).slice(0, 3)
    const frameKey = frames.map((f) => `${f.function}@${f.filename.split('/').pop()}`).join('|')
    return createHash('sha1')
      .update(`${event.level}:${event.message}:${frameKey}`)
      .digest('hex')
      .slice(0, 16)
  }

  private computeUserHash(issueId: string, user?: Record<string, unknown>): string | null {
    const userKey = this.userKey(user)
    return userKey ? createHash('md5').update(`${issueId}:${userKey}`).digest('hex') : null
  }

  private userKey(user?: Record<string, unknown>): string | null {
    if (!user) return null

    const id = this.stringUserValue(user.id) ?? this.stringUserValue(user.userId)
    if (id) return `id:${id}`

    const email = this.stringUserValue(user.email)?.toLowerCase()
    if (email) return `email:${email}`

    const username = this.stringUserValue(user.username)?.toLowerCase()
    if (username) return `username:${username}`

    const anonymousId = this.stringUserValue(user.anonymousId)
    return anonymousId ? `anonymousId:${anonymousId}` : null
  }

  private stringUserValue(value: unknown): string | null {
    if (typeof value !== 'string' && typeof value !== 'number') return null
    const normalized = String(value).trim()
    return normalized.length > 0 ? normalized : null
  }

  private alertJobOptions() {
    return {
      attempts: 3,
      backoff: { type: 'exponential' as const, delay: 5000 },
      removeOnComplete: true,
      removeOnFail: false,
    }
  }
}
