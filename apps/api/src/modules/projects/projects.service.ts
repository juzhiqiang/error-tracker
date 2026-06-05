import { Injectable, Inject } from '@nestjs/common'
import { randomBytes } from 'crypto'
import { eq, sql } from 'drizzle-orm'
import { DB } from '../../db/db.module'
import { projectMembers, projects } from '../../db/schema'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../db/schema'

@Injectable()
export class ProjectsService {
  constructor(@Inject(DB) private db: PostgresJsDatabase<typeof schema>) {}

  async list(userId?: string) {
    if (!userId) return []
    const result = await this.db.execute(sql`
      SELECT DISTINCT
        p.id,
        p.organization_id as "organizationId",
        p.name,
        p.slug,
        p.dsn_token as "dsnToken",
        p.webhook_url as "webhookUrl",
        p.alert_threshold as "alertThreshold",
        p.retention_days as "retentionDays",
        p.created_at as "createdAt"
      FROM projects p
      LEFT JOIN project_members pm ON pm.project_id = p.id
      LEFT JOIN organization_members om ON om.organization_id = p.organization_id
      WHERE pm.user_id = ${userId}
        OR om.user_id = ${userId}
      ORDER BY p.created_at
    `)
    return rowsFrom<typeof projects.$inferSelect>(result)
  }

  async create(body: { name: string; slug: string }, ownerUserId?: string) {
    const dsnToken = randomBytes(20).toString('hex')
    const created = await this.db.insert(projects).values({ name: body.name, slug: body.slug, dsnToken }).returning()
    if (ownerUserId && created[0]?.id) {
      await this.db
        .insert(projectMembers)
        .values({ projectId: created[0].id, userId: ownerUserId, role: 'owner' })
        .onConflictDoNothing()
    }
    return created
  }

  rotateToken(projectId: string) {
    const dsnToken = randomBytes(20).toString('hex')
    return this.db.update(projects).set({ dsnToken }).where(eq(projects.id, projectId)).returning()
  }
}

function rowsFrom<T>(result: unknown): T[] {
  return Array.isArray(result) ? (result as T[]) : ((result as { rows?: T[] }).rows ?? [])
}
