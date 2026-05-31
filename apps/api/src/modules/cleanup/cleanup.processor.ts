import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import { Inject } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import { DB } from '../../db/db.module'
import { projects } from '../../db/schema'
import { MinioService } from '../sourcemaps/minio.service'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../db/schema'

@Processor('cleanup')
export class CleanupProcessor extends WorkerHost {
  constructor(
    @Inject(DB) private db: PostgresJsDatabase<typeof schema>,
    private readonly minio: MinioService,
  ) {
    super()
  }

  async process(job: Job): Promise<void> {
    if (job.name !== 'daily-cleanup') return
    const allProjects = await this.db.select().from(projects)

    for (const project of allProjects) {
      const days = project.retentionDays ?? 30

      const oldReplays = await this.db.execute(sql`
        SELECT r.storage_url FROM replays r
        JOIN events e ON r.event_id = e.id
        WHERE e.project_id = ${project.id}
          AND e.timestamp < now() - interval '${sql.raw(days + ' days')}'
      `)
      const replayRows = (oldReplays as unknown as { rows?: { storage_url: string }[] }).rows ?? []
      for (const r of replayRows) {
        await this.minio.upload(r.storage_url, '').catch(() => {})
      }

      await this.db.execute(sql`
        DELETE FROM events WHERE project_id = ${project.id}
          AND timestamp < now() - interval '${sql.raw(days + ' days')}'
      `)

      await this.db.execute(sql`
        DELETE FROM performance_metrics WHERE project_id = ${project.id}
          AND timestamp < now() - interval '${sql.raw(days + ' days')}'
      `)
    }
  }
}
