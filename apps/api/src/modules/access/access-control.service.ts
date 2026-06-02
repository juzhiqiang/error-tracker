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
      SELECT pm.role FROM project_members pm
      WHERE pm.user_id = ${userId}
        AND pm.project_id = ${projectId}
      UNION
      SELECT om.role FROM organization_members om
      JOIN projects p ON p.organization_id = om.organization_id
      WHERE om.user_id = ${userId}
        AND p.id = ${projectId}
    `)

    const rows = (result as unknown as { rows?: { role: ProjectRole }[] }).rows ?? []
    return rows.some((row) => requiredRoles.includes(row.role))
  }
}
