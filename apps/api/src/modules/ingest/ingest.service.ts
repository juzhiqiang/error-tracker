import { Injectable, Inject } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { createHash } from 'crypto'
import { sql } from 'drizzle-orm'
import { DB } from '../../db/db.module'
import { events, performanceMetrics } from '../../db/schema'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../db/schema'

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
  ) {}

  async ingestEvent(projectId: string, payload: IncomingEvent): Promise<void> {
    const serverFingerprint = this.computeServerFingerprint(payload)

    const result = await this.db.execute(sql`
      INSERT INTO issues (project_id, fingerprint, title, level, first_seen, last_seen, count, user_count)
      VALUES (${projectId}, ${serverFingerprint}, ${payload.message.slice(0, 255)}, ${payload.level}, now(), now(), 1, 1)
      ON CONFLICT (project_id, fingerprint) DO UPDATE SET
        last_seen = now(),
        count = issues.count + 1,
        user_count = issues.user_count + 1,
        status = CASE WHEN issues.status = 'resolved' THEN 'unresolved' ELSE issues.status END
      RETURNING id
    `)

    const issueId = (result as unknown as { id: string }[])[0]?.id

    await this.db.insert(events).values({
      id: payload.eventId,
      issueId,
      projectId,
      timestamp: new Date(payload.timestamp),
      level: payload.level,
      message: payload.message,
      stacktrace: payload.stacktrace ?? null,
      breadcrumbs: payload.breadcrumbs ?? null,
      request: payload.request ?? null,
      user: payload.user ?? null,
      tags: payload.tags ?? null,
      environment: payload.environment,
      release: payload.release,
    })

    await this.eventsQueue.add('check-alert', { projectId, issueId })
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

  private computeServerFingerprint(event: IncomingEvent): string {
    const frames = (event.stacktrace ?? []).slice(0, 3)
    const frameKey = frames.map((f) => `${f.function}@${f.filename.split('/').pop()}`).join('|')
    return createHash('sha1')
      .update(`${event.level}:${event.message}:${frameKey}`)
      .digest('hex')
      .slice(0, 16)
  }
}
