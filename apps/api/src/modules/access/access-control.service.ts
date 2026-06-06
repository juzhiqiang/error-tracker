import { Inject, Injectable } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import { DB } from '../../db/db.module'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../db/schema'
import type { ProjectRole } from './project-roles.decorator'

@Injectable()
export class AccessControlService {
  constructor(@Inject(DB) private readonly db: PostgresJsDatabase<typeof schema>) {}

  async canAccessProject(userId: string, projectId: string, requiredRoles: ProjectRole[]): Promise<boolean> {
    const result = await this.db.execute(sql`
      SELECT pm.role
      FROM project_members pm
      WHERE pm.user_id = ${userId}
        AND pm.project_id = ${projectId}
      UNION ALL
      SELECT om.role
      FROM organization_members om
      JOIN projects p ON p.organization_id = om.organization_id
      WHERE om.user_id = ${userId}
        AND p.id = ${projectId}
      UNION ALL
      SELECT tp.role
      FROM team_projects tp
      JOIN teams t ON t.id = tp.team_id
      JOIN team_members tm ON tm.team_id = t.id
      JOIN projects p ON p.id = tp.project_id AND p.organization_id = t.organization_id
      WHERE tm.user_id = ${userId}
        AND tp.project_id = ${projectId}
    `)

    const rows = rowsFrom<{ role: ProjectRole }>(result)
    const requiredRank = Math.min(...requiredRoles.map((role) => roleRank[role]))
    return rows.some((row) => roleRank[row.role] >= requiredRank)
  }

  async canAccessIssue(userId: string, issueId: string, requiredRoles: ProjectRole[]): Promise<boolean> {
    const result = await this.db.execute(sql`
      SELECT project_id as "projectId"
      FROM issues
      WHERE id = ${issueId}
      LIMIT 1
    `)
    const projectId = rowsFrom<{ projectId: string }>(result)[0]?.projectId
    return projectId ? this.canAccessProject(userId, projectId, requiredRoles) : false
  }

  async canAccessEvent(userId: string, eventId: string, requiredRoles: ProjectRole[]): Promise<boolean> {
    const result = await this.db.execute(sql`
      SELECT project_id as "projectId"
      FROM events
      WHERE id = ${eventId}
      LIMIT 1
    `)
    const projectId = rowsFrom<{ projectId: string }>(result)[0]?.projectId
    return projectId ? this.canAccessProject(userId, projectId, requiredRoles) : false
  }
}

const roleRank: Record<ProjectRole, number> = {
  viewer: 1,
  member: 2,
  admin: 3,
  owner: 4,
}

function rowsFrom<T>(result: unknown): T[] {
  return Array.isArray(result) ? (result as T[]) : ((result as { rows?: T[] }).rows ?? [])
}
