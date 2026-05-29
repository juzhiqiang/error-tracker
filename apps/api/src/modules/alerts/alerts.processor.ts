import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import { Inject } from '@nestjs/common'
import { eq, sql } from 'drizzle-orm'
import { DB } from '../../db/db.module'
import { issues, projects } from '../../db/schema'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../db/schema'

@Processor('events')
export class AlertsProcessor extends WorkerHost {
  constructor(@Inject(DB) private db: PostgresJsDatabase<typeof schema>) {
    super()
  }

  async process(job: Job<{ projectId: string; issueId: string }>): Promise<void> {
    if (job.name !== 'check-alert') return
    const { projectId, issueId } = job.data

    const [project] = await this.db.select().from(projects).where(eq(projects.id, projectId)).limit(1)
    if (!project?.webhookUrl) return

    const [issue] = await this.db.select().from(issues).where(eq(issues.id, issueId)).limit(1)
    if (!issue) return

    const isNew = issue.count === 1

    const result = await this.db.execute(sql`
      SELECT count(*) as "recentCount" FROM events
      WHERE issue_id = ${issueId}
        AND timestamp >= now() - interval '10 minutes'
    `)
    const recentCount = Number((result as unknown as { recentCount: string }[])[0]?.recentCount ?? 0)

    const shouldAlert = isNew || recentCount >= (project.alertThreshold ?? 50)
    if (!shouldAlert) return

    const text = isNew
      ? `🔴 [${project.name}] 新错误首次出现: ${issue.title}`
      : `⚠️ [${project.name}] 错误激增 (${recentCount}次/10min): ${issue.title}`

    await fetch(project.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }).catch(() => {
      // 告警失败不影响主流程
    })
  }
}
