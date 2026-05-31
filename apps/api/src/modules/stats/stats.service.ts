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
    return (result as unknown as { rows?: unknown[] }).rows ?? []
  }

  async performanceSummary(projectId: string) {
    const result = await this.db.execute(sql`
      SELECT name, rating, count(*) as count, avg(value) as avg_value
      FROM performance_metrics
      WHERE project_id = ${projectId}
        AND timestamp >= now() - interval '24 hours'
      GROUP BY name, rating ORDER BY name, rating
    `)
    return (result as unknown as { rows?: unknown[] }).rows ?? []
  }
}
