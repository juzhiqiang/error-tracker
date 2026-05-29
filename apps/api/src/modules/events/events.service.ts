import { Injectable, Inject } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { SourceMapConsumer } from 'source-map'
import { DB } from '../../db/db.module'
import { events, sourceMaps } from '../../db/schema'
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

  private async resolveStackTrace(projectId: string, release: string, frames: StackFrame[]) {
    return Promise.all(
      frames.map(async (frame) => {
        try {
          const [sm] = await this.db.select().from(sourceMaps).where(eq(sourceMaps.projectId, projectId)).limit(1)

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
