import { Injectable, Inject } from '@nestjs/common'
import { eq, and, ilike, sql } from 'drizzle-orm'
import { DB } from '../../db/db.module'
import { issues } from '../../db/schema'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../db/schema'

export interface IssuesQuery {
  projectId: string
  status?: 'unresolved' | 'resolved' | 'ignored'
  level?: string
  q?: string
  timeRange?: '1h' | '24h' | '7d' | '30d'
  page?: number
  limit?: number
}

const timeRangeMap: Record<string, string> = {
  '1h': '1 hour',
  '24h': '24 hours',
  '7d': '7 days',
  '30d': '30 days',
}

@Injectable()
export class IssuesService {
  constructor(@Inject(DB) private db: PostgresJsDatabase<typeof schema>) {}

  async list(query: IssuesQuery) {
    const { projectId, status, level, q, timeRange, page = 1, limit = 25 } = query
    const conditions = [eq(issues.projectId, projectId)]
    if (status) conditions.push(eq(issues.status, status))
    if (level) conditions.push(eq(issues.level, level as never))
    if (q) conditions.push(ilike(issues.title, `%${q}%`))
    if (timeRange) {
      conditions.push(sql`${issues.lastSeen} >= now() - interval '${sql.raw(timeRangeMap[timeRange])}'`)
    }

    const [rows, countResult] = await Promise.all([
      this.db
        .select()
        .from(issues)
        .where(and(...conditions))
        .orderBy(sql`${issues.lastSeen} desc`)
        .limit(limit)
        .offset((page - 1) * limit),
      this.db
        .select({ total: sql<number>`count(*)` })
        .from(issues)
        .where(and(...conditions)),
    ])
    return { rows, total: Number(countResult[0]?.total ?? 0), page, limit }
  }

  async findById(id: string) {
    const [issue] = await this.db.select().from(issues).where(eq(issues.id, id)).limit(1)
    return issue ?? null
  }

  async updateStatus(id: string, status: 'resolved' | 'ignored' | 'unresolved') {
    await this.db.update(issues).set({ status }).where(eq(issues.id, id))
  }
}
