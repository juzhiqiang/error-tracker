import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import { DB } from '../../db/db.module'
import { projects } from '../../db/schema'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../db/schema'
import type { ProjectRole } from '../access/project-roles.decorator'

type OrganizationRole = ProjectRole
type TeamProjectRole = Exclude<ProjectRole, 'owner'>

export interface OrganizationCreateBody {
  name: string
  slug: string
}

export interface TeamCreateBody {
  name: string
  slug: string
}

export interface TeamMemberBody {
  userId: string
}

export interface TeamProjectBody {
  projectId: string
  role: TeamProjectRole
}

@Injectable()
export class OrganizationsService {
  constructor(@Inject(DB) private readonly db: PostgresJsDatabase<typeof schema>) {}

  async list(userId?: string) {
    if (!userId) return []
    const result = await this.db.execute(sql`
      SELECT
        o.id,
        o.name,
        o.slug,
        om.role,
        o.created_at as "createdAt"
      FROM organizations o
      JOIN organization_members om ON om.organization_id = o.id
      WHERE om.user_id = ${userId}
      ORDER BY o.created_at
    `)
    return rowsFrom(result)
  }

  async create(body: OrganizationCreateBody, userId: string) {
    const created = rowsFrom(
      await this.db.execute(sql`
        WITH created_organization AS (
          INSERT INTO organizations (name, slug)
          VALUES (${body.name}, ${body.slug})
          RETURNING id, name, slug, created_at
        ),
        created_member AS (
          INSERT INTO organization_members (organization_id, user_id, role)
          SELECT id, ${userId}, 'owner' FROM created_organization
          ON CONFLICT (organization_id, user_id) DO NOTHING
          RETURNING organization_id
        )
        SELECT
          id,
          name,
          slug,
          created_at as "createdAt"
        FROM created_organization
      `),
    )
    return created[0] ?? null
  }

  async listProjects(organizationId: string, userId?: string) {
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
      LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ${userId}
      LEFT JOIN organization_members om ON om.organization_id = p.organization_id AND om.user_id = ${userId}
      LEFT JOIN team_projects tp ON tp.project_id = p.id
      LEFT JOIN teams t ON t.id = tp.team_id AND t.organization_id = p.organization_id
      LEFT JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = ${userId}
      WHERE p.organization_id = ${organizationId}
        AND (
          pm.user_id IS NOT NULL
          OR om.user_id IS NOT NULL
          OR tm.user_id IS NOT NULL
        )
      ORDER BY p.created_at
    `)
    return rowsFrom<typeof projects.$inferSelect>(result)
  }

  async createTeam(organizationId: string, body: TeamCreateBody, actorUserId: string) {
    await this.assertOrganizationRole(organizationId, actorUserId, ['owner', 'admin'])
    const created = rowsFrom(
      await this.db.execute(sql`
        INSERT INTO teams (organization_id, name, slug)
        VALUES (${organizationId}, ${body.name}, ${body.slug})
        RETURNING
          id,
          organization_id as "organizationId",
          name,
          slug,
          created_at as "createdAt"
      `),
    )
    return created[0] ?? null
  }

  async addTeamMember(organizationId: string, teamId: string, body: TeamMemberBody, actorUserId: string) {
    await this.assertOrganizationRole(organizationId, actorUserId, ['owner', 'admin'])
    const created = rowsFrom(
      await this.db.execute(sql`
        WITH selected_team AS (
          SELECT id
          FROM teams
          WHERE id = ${teamId}
            AND organization_id = ${organizationId}
        ),
        upserted AS (
          INSERT INTO team_members (team_id, user_id)
          SELECT id, ${body.userId} FROM selected_team
          ON CONFLICT (team_id, user_id) DO NOTHING
          RETURNING team_id, user_id, created_at
        )
        SELECT
          team_id as "teamId",
          user_id as "userId",
          created_at as "createdAt"
        FROM upserted
      `),
    )
    const member = created[0]
    if (!member) throw new NotFoundException('Team not found')
    return member
  }

  async bindTeamProject(organizationId: string, teamId: string, body: TeamProjectBody, actorUserId: string) {
    await this.assertOrganizationRole(organizationId, actorUserId, ['owner', 'admin'])
    const created = rowsFrom(
      await this.db.execute(sql`
        WITH selected_binding AS (
          SELECT t.id as team_id, p.id as project_id
          FROM teams t
          JOIN projects p ON p.organization_id = t.organization_id
          WHERE t.id = ${teamId}
            AND t.organization_id = ${organizationId}
            AND p.id = ${body.projectId}
        ),
        upserted AS (
          INSERT INTO team_projects (team_id, project_id, role)
          SELECT team_id, project_id, ${body.role} FROM selected_binding
          ON CONFLICT (team_id, project_id) DO UPDATE SET role = EXCLUDED.role
          RETURNING team_id, project_id, role, created_at
        )
        SELECT
          team_id as "teamId",
          project_id as "projectId",
          role,
          created_at as "createdAt"
        FROM upserted
      `),
    )
    const binding = created[0]
    if (!binding) throw new NotFoundException('Team or project not found')
    return binding
  }

  private async assertOrganizationRole(
    organizationId: string,
    userId: string,
    requiredRoles: OrganizationRole[],
  ): Promise<void> {
    const result = await this.db.execute(sql`
      SELECT role
      FROM organization_members
      WHERE organization_id = ${organizationId}
        AND user_id = ${userId}
      LIMIT 1
    `)
    const rows = rowsFrom<{ role: OrganizationRole }>(result)
    const requiredRank = Math.min(...requiredRoles.map((role) => roleRank[role]))
    if (!rows.some((row) => roleRank[row.role] >= requiredRank)) {
      throw new ForbiddenException('Organization access denied')
    }
  }
}

const roleRank: Record<OrganizationRole, number> = {
  viewer: 1,
  member: 2,
  admin: 3,
  owner: 4,
}

function rowsFrom<T = Record<string, unknown>>(result: unknown): T[] {
  return Array.isArray(result) ? (result as T[]) : ((result as { rows?: T[] }).rows ?? [])
}
