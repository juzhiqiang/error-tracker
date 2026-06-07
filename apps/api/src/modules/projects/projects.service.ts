import { ForbiddenException, Injectable, Inject, UnauthorizedException } from '@nestjs/common'
import { randomBytes } from 'crypto'
import { eq, sql } from 'drizzle-orm'
import { DB } from '../../db/db.module'
import { projects } from '../../db/schema'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../db/schema'

interface ProjectCreateBody {
  name: string
  slug: string
  organizationId?: string
}

export interface ProjectAlertSettingsBody {
  webhookUrl?: string | null
  alertThreshold?: number | null
  alertUserThreshold?: number | null
}

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
        p.alert_user_threshold as "alertUserThreshold",
        p.retention_days as "retentionDays",
        p.ai_analysis_enabled as "aiAnalysisEnabled",
        p.created_at as "createdAt"
      FROM projects p
      LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ${userId}
      LEFT JOIN organization_members om ON om.organization_id = p.organization_id AND om.user_id = ${userId}
      LEFT JOIN team_projects tp ON tp.project_id = p.id
      LEFT JOIN teams t ON t.id = tp.team_id AND t.organization_id = p.organization_id
      LEFT JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = ${userId}
      WHERE pm.user_id IS NOT NULL
        OR om.user_id IS NOT NULL
        OR tm.user_id IS NOT NULL
      ORDER BY p.created_at
    `)
    return rowsFrom<typeof projects.$inferSelect>(result)
  }

  async create(body: ProjectCreateBody, ownerUserId?: string) {
    if (!ownerUserId) throw new UnauthorizedException('User required')

    const organizationId = await this.resolveOrganizationIdForCreate(body.organizationId, ownerUserId)
    const dsnToken = randomBytes(20).toString('hex')
    const created = rowsFrom<typeof projects.$inferSelect>(
      await this.db.execute(sql`
        INSERT INTO projects (organization_id, name, slug, dsn_token)
        VALUES (${organizationId}, ${body.name}, ${body.slug}, ${dsnToken})
        RETURNING
          id,
          organization_id as "organizationId",
          name,
          slug,
          dsn_token as "dsnToken",
          webhook_url as "webhookUrl",
          alert_threshold as "alertThreshold",
          alert_user_threshold as "alertUserThreshold",
          retention_days as "retentionDays",
          ai_analysis_enabled as "aiAnalysisEnabled",
          created_at as "createdAt"
      `),
    )
    if (created[0]?.id) {
      await this.db.execute(sql`
        INSERT INTO project_members (project_id, user_id, role)
        VALUES (${created[0].id}, ${ownerUserId}, 'owner')
        ON CONFLICT (project_id, user_id) DO NOTHING
      `)
    }
    return created
  }

  rotateToken(projectId: string) {
    const dsnToken = randomBytes(20).toString('hex')
    return this.db.update(projects).set({ dsnToken }).where(eq(projects.id, projectId)).returning()
  }

  updateAiAnalysisEnabled(projectId: string, aiAnalysisEnabled: boolean) {
    return this.db.update(projects).set({ aiAnalysisEnabled }).where(eq(projects.id, projectId)).returning()
  }

  updateAlertSettings(projectId: string, body: ProjectAlertSettingsBody) {
    const webhookUrl = body.webhookUrl?.trim() || null
    return this.db
      .update(projects)
      .set({
        webhookUrl,
        alertThreshold: normalizeThreshold(body.alertThreshold, 50),
        alertUserThreshold: normalizeThreshold(body.alertUserThreshold, 10),
      })
      .where(eq(projects.id, projectId))
      .returning()
  }

  private async resolveOrganizationIdForCreate(organizationId: string | undefined, userId: string): Promise<string> {
    if (organizationId) {
      const membership = rowsFrom<{ id: string }>(
        await this.db.execute(sql`
          SELECT organization_id as id
          FROM organization_members
          WHERE organization_id = ${organizationId}
            AND user_id = ${userId}
            AND role IN ('owner', 'admin', 'member')
          LIMIT 1
        `),
      )
      if (!membership[0]) throw new ForbiddenException('Organization access denied')
      return organizationId
    }

    const existing = rowsFrom<{ id: string }>(
      await this.db.execute(sql`
        SELECT organization_id as id
        FROM organization_members
        WHERE user_id = ${userId}
          AND role IN ('owner', 'admin', 'member')
        ORDER BY created_at
        LIMIT 1
      `),
    )
    if (existing[0]?.id) return existing[0].id

    const created = rowsFrom<{ id: string }>(
      await this.db.execute(sql`
        WITH created_organization AS (
          INSERT INTO organizations (name, slug)
          VALUES (${`Personal ${userId.slice(0, 8)}`}, ${`personal-${userId.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-${randomBytes(4).toString('hex')}`})
          RETURNING id
        ),
        created_member AS (
          INSERT INTO organization_members (organization_id, user_id, role)
          SELECT id, ${userId}, 'owner' FROM created_organization
          ON CONFLICT (organization_id, user_id) DO NOTHING
          RETURNING organization_id
        )
        SELECT id FROM created_organization
      `),
    )

    if (!created[0]?.id) throw new Error('Failed to create default organization')
    return created[0].id
  }
}

function rowsFrom<T>(result: unknown): T[] {
  return Array.isArray(result) ? (result as T[]) : ((result as { rows?: T[] }).rows ?? [])
}

function normalizeThreshold(value: number | null | undefined, fallback: number): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback
  return Math.min(100_000, Math.max(1, Math.round(numeric)))
}
