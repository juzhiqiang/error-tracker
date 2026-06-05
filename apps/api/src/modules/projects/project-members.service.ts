import { Inject, Injectable } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import { DB } from '../../db/db.module'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../db/schema'
import type { ProjectRole } from '../access/project-roles.decorator'

export interface ProjectMemberRow {
  userId: string
  email: string
  name: string
  role: ProjectRole
  createdAt: Date
}

@Injectable()
export class ProjectMembersService {
  constructor(@Inject(DB) private readonly db: PostgresJsDatabase<typeof schema>) {}

  async list(projectId: string): Promise<ProjectMemberRow[]> {
    const result = await this.db.execute(sql`
      SELECT
        pm.user_id as "userId",
        u.email,
        u.name,
        pm.role,
        pm.created_at as "createdAt"
      FROM project_members pm
      JOIN "user" u ON u.id = pm.user_id
      WHERE pm.project_id = ${projectId}
      ORDER BY
        CASE pm.role
          WHEN 'owner' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'member' THEN 3
          ELSE 4
        END,
        u.email
    `)
    return rowsFrom<ProjectMemberRow>(result)
  }

  async addByEmail(projectId: string, email: string, role: ProjectRole): Promise<ProjectMemberRow | null> {
    const result = await this.db.execute(sql`
      WITH selected_user AS (
        SELECT id FROM "user"
        WHERE lower(email) = lower(${email.trim()})
        LIMIT 1
      ),
      upserted AS (
        INSERT INTO project_members (project_id, user_id, role)
        SELECT ${projectId}, id, ${role} FROM selected_user
        ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role
        RETURNING user_id, role, created_at
      )
      SELECT
        upserted.user_id as "userId",
        u.email,
        u.name,
        upserted.role,
        upserted.created_at as "createdAt"
      FROM upserted
      JOIN "user" u ON u.id = upserted.user_id
    `)
    return rowsFrom<ProjectMemberRow>(result)[0] ?? null
  }

  async updateRole(projectId: string, userId: string, role: ProjectRole): Promise<ProjectMemberRow | null> {
    const result = await this.db.execute(sql`
      WITH updated AS (
        UPDATE project_members
        SET role = ${role}
        WHERE project_id = ${projectId}
          AND user_id = ${userId}
        RETURNING user_id, role, created_at
      )
      SELECT
        updated.user_id as "userId",
        u.email,
        u.name,
        updated.role,
        updated.created_at as "createdAt"
      FROM updated
      JOIN "user" u ON u.id = updated.user_id
    `)
    return rowsFrom<ProjectMemberRow>(result)[0] ?? null
  }

  async remove(projectId: string, userId: string): Promise<void> {
    await this.db.execute(sql`
      DELETE FROM project_members
      WHERE project_id = ${projectId}
        AND user_id = ${userId}
    `)
  }
}

function rowsFrom<T>(result: unknown): T[] {
  return Array.isArray(result) ? (result as T[]) : ((result as { rows?: T[] }).rows ?? [])
}
