import { Injectable, Inject } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import { DB } from '../../db/db.module'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../db/schema'

@Injectable()
export class StatsService {
  constructor(@Inject(DB) private db: PostgresJsDatabase<typeof schema>) {}

  async issuesTrend(projectId: string, days = 7) {
    const result = await this.db.execute(sql`
      SELECT date_trunc('hour', last_seen) as hour, count(*) as count
      FROM issues
      WHERE project_id = ${projectId}
        AND last_seen >= now() - interval '${sql.raw(days + ' days')}'
      GROUP BY 1 ORDER BY 1
    `)
    return sqlRows(result)
  }

  async performanceSummary(projectId: string) {
    const result = await this.db.execute(sql`
      SELECT
        kind,
        name,
        rating,
        method,
        status,
        initiator_type,
        count(*) as count,
        avg(value) as avg_value,
        max(COALESCE(duration, value)) as slowest
      FROM performance_metrics
      WHERE project_id = ${projectId}
        AND timestamp >= now() - interval '24 hours'
      GROUP BY kind, name, rating, method, status, initiator_type
      ORDER BY kind, name, rating, method, status, initiator_type
    `)
    return sqlRows(result)
  }
}

function sqlRows(result: unknown): unknown[] {
  if (Array.isArray(result)) return result
  return (result as { rows?: unknown[] } | null)?.rows ?? []
}
