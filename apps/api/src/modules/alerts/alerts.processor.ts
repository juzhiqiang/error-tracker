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

    const result = await this.db.execute(sql`
      SELECT count(*) as "recentCount" FROM events
      WHERE issue_id = ${issueId}
        AND timestamp >= now() - interval '10 minutes'
    `)
    const recentCount = Number((result as unknown as { rows?: { recentCount: string }[] }).rows?.[0]?.recentCount ?? 0)

    const reasons = alertReasons({
      isNew: Number(issue.count ?? 0) === 1,
      isRegression: isRecentRegression(issue.regressedAt),
      regressedInRelease: issue.regressedInRelease,
      recentCount,
      spikeThreshold: project.alertThreshold ?? 50,
      userCount: Number(issue.userCount ?? 0),
      userThreshold: project.alertUserThreshold ?? 10,
    })
    if (reasons.length === 0) return

    const text = `[${project.name}] ${reasons.join('; ')}: ${issue.title}`

    await fetch(project.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload(project.webhookUrl, text)),
    }).catch(() => {
      // Alert delivery must not block ingest or queue processing.
    })
  }
}

function alertReasons(input: {
  isNew: boolean
  isRegression: boolean
  regressedInRelease?: string | null
  recentCount: number
  spikeThreshold: number
  userCount: number
  userThreshold: number
}): string[] {
  const reasons: string[] = []
  if (input.isNew) reasons.push('new issue')
  if (input.isRegression) {
    const release = input.regressedInRelease ? ` in ${input.regressedInRelease}` : ''
    reasons.push(`regression after resolution${release}`)
  }
  if (input.recentCount >= input.spikeThreshold) reasons.push(`spike ${input.recentCount}/10min`)
  if (input.userThreshold > 0 && input.userCount >= input.userThreshold) {
    reasons.push(`${input.userCount} users affected`)
  }
  return reasons
}

function isRecentRegression(value: unknown): boolean {
  if (!value) return false
  const timestamp = value instanceof Date ? value.getTime() : new Date(String(value)).getTime()
  if (!Number.isFinite(timestamp)) return false
  return Date.now() - timestamp <= 15 * 60 * 1000
}

function webhookPayload(webhookUrl: string, text: string): Record<string, unknown> {
  const host = safeHost(webhookUrl)
  if (host.includes('open.feishu.cn') || host.includes('open.larksuite.com')) {
    return { msg_type: 'text', content: { text } }
  }
  if (host.includes('oapi.dingtalk.com') || host.includes('qyapi.weixin.qq.com')) {
    return { msgtype: 'text', text: { content: text } }
  }
  return { text }
}

function safeHost(webhookUrl: string): string {
  try {
    return new URL(webhookUrl).host.toLowerCase()
  } catch {
    return webhookUrl.toLowerCase()
  }
}
