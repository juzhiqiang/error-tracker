import { Injectable, Inject } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import { SourceMapConsumer } from 'source-map'
import { DB } from '../../db/db.module'
import { events, replays, sourceMaps } from '../../db/schema'
import { MinioService } from '../sourcemaps/minio.service'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../db/schema'

interface StackFrame {
  function: string
  filename: string
  lineno?: number
  colno?: number
}

@Injectable()
export class EventsService {
  constructor(
    @Inject(DB) private db: PostgresJsDatabase<typeof schema>,
    private readonly minio: MinioService,
  ) {}

  async findById(id: string) {
    const [event] = await this.db.select().from(events).where(eq(events.id, id)).limit(1)
    if (!event) return null

    const stacktrace = event.stacktrace as StackFrame[] | null
    if (stacktrace && event.release) {
      event.stacktrace = (await this.resolveStackTrace(event.projectId, event.release, stacktrace)) as unknown
    }
    return event
  }

  async listByIssue(issueId: string, page = 1, limit = 20) {
    return this.db
      .select()
      .from(events)
      .where(eq(events.issueId, issueId))
      .orderBy(events.timestamp)
      .limit(limit)
      .offset((page - 1) * limit)
  }

  async findReplayByEventId(eventId: string): Promise<{ events: unknown[] }> {
    const [replay] = await this.db.select().from(replays).where(eq(replays.eventId, eventId)).limit(1)
    if (!replay) {
      const [event] = await this.db.select({ projectId: events.projectId }).from(events).where(eq(events.id, eventId)).limit(1)
      if (!event) return { events: [] }
      return this.loadReplay(`replays/${event.projectId}/${eventId}.json`)
    }

    return this.loadReplay(replay.storageUrl)
  }

  private async loadReplay(storageUrl: string): Promise<{ events: unknown[] }> {
    try {
      const rawReplay = await this.minio.getObject(storageUrl)
      const events = JSON.parse(rawReplay)
      return { events: Array.isArray(events) ? events : [] }
    } catch {
      return { events: [] }
    }
  }

  private async resolveStackTrace(projectId: string, release: string, frames: StackFrame[]) {
    return Promise.all(
      frames.map(async (frame) => {
        try {
          const sourceMapFilename = sourceMapNameForFrame(frame.filename)
          const [sm] = await this.db
            .select()
            .from(sourceMaps)
            .where(
              and(
                eq(sourceMaps.projectId, projectId),
                eq(sourceMaps.release, release),
                eq(sourceMaps.filename, sourceMapFilename),
              ),
            )
            .limit(1)

          if (!sm) return frame

          const rawMap = await this.minio.getObject(sm.storageUrl)
          const consumer = await new SourceMapConsumer(rawMap)
          if (!frame.lineno || !frame.colno) return frame

          const orig = consumer.originalPositionFor({ line: frame.lineno, column: frame.colno })
          consumer.destroy()

          if (orig.source) {
            return {
              ...frame,
              filename: orig.source,
              lineno: orig.line ?? frame.lineno,
              colno: orig.column ?? frame.colno,
              function: orig.name ?? frame.function,
            }
          }
          return frame
        } catch {
          return frame
        }
      }),
    )
  }
}

function sourceMapNameForFrame(filename: string): string {
  const leaf = filename.split(/[\\/]/).pop() ?? filename
  return leaf.endsWith('.map') ? leaf : `${leaf}.map`
}
