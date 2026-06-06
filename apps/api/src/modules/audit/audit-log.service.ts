import { Inject, Injectable } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import { DB } from '../../db/db.module'
import { auditLogs } from '../../db/schema'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../db/schema'

export interface AuditLogInput {
  actorUserId?: string | null
  projectId?: string | null
  action: string
  targetType: string
  targetId?: string | null
  metadata?: Record<string, unknown> | null
}

export interface AuditLogListFilters {
  projectId: string
  actorUserId?: string
  action?: string
  targetType?: string
  from?: string
  to?: string
  limit?: number
}

export interface AuditLogRow {
  createdAt: string | Date
  actorUserId?: string | null
  projectId?: string | null
  action: string
  targetType: string
  targetId?: string | null
  metadata?: Record<string, unknown> | null
}

@Injectable()
export class AuditLogService {
  constructor(@Inject(DB) private readonly db: PostgresJsDatabase<typeof schema>) {}

  async record(input: AuditLogInput): Promise<void> {
    await this.db.insert(auditLogs).values({
      actorUserId: input.actorUserId ?? null,
      projectId: input.projectId ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      metadata: input.metadata ?? null,
    })
  }

  async listByProject(projectId: string, limit = 100) {
    return this.list({ projectId, limit })
  }

  async list(filters: AuditLogListFilters): Promise<AuditLogRow[]> {
    const conditions = [sql`${auditLogs.projectId} = ${filters.projectId}`]
    if (filters.actorUserId) conditions.push(sql`${auditLogs.actorUserId} = ${filters.actorUserId}`)
    if (filters.action) conditions.push(sql`${auditLogs.action} = ${filters.action}`)
    if (filters.targetType) conditions.push(sql`${auditLogs.targetType} = ${filters.targetType}`)
    if (filters.from) conditions.push(sql`${auditLogs.createdAt} >= ${filters.from}`)
    if (filters.to) conditions.push(sql`${auditLogs.createdAt} <= ${filters.to}`)

    const result = await this.db.execute(sql`
      SELECT
        created_at as "createdAt",
        actor_user_id as "actorUserId",
        project_id as "projectId",
        action,
        target_type as "targetType",
        target_id as "targetId",
        metadata
      FROM audit_logs
      WHERE ${sql.join(conditions, sql` AND `)}
      ORDER BY created_at DESC
      LIMIT ${filters.limit ?? 100}
    `)

    return rowsFrom<AuditLogRow>(result)
  }

  static toCsv(rows: AuditLogRow[]): string {
    const columns = ['createdAt', 'actorUserId', 'projectId', 'action', 'targetType', 'targetId', 'metadata'] as const
    return [
      columns.join(','),
      ...rows.map((row) => columns.map((column) => AuditLogService.csvCell(row[column])).join(',')),
    ].join('\n')
  }

  private static csvCell(value: unknown): string {
    const text =
      value == null
        ? ''
        : value instanceof Date
          ? value.toISOString()
          : typeof value === 'string'
            ? value
            : JSON.stringify(value)
    return `"${text.replaceAll('"', '""')}"`
  }
}

function rowsFrom<T>(result: unknown): T[] {
  return Array.isArray(result) ? (result as T[]) : ((result as { rows?: T[] }).rows ?? [])
}
