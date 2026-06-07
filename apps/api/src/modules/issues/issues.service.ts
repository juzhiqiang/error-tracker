import { BadRequestException, Injectable, Inject } from '@nestjs/common'
import { createHash } from 'crypto'
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

export interface IssueCommentRow {
  id: number
  issueId: string
  authorUserId?: string | null
  authorEmail?: string | null
  authorName?: string | null
  body: string
  createdAt: Date | string
}

export interface IssueFacet {
  value: string
  count: number
}

export interface IssueTagFacet extends IssueFacet {
  key: string
}

export interface IssueFacets {
  releases: IssueFacet[]
  environments: IssueFacet[]
  tags: IssueTagFacet[]
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

  async updateStatus(id: string, status: 'resolved' | 'ignored' | 'unresolved', actorUserId?: string | null) {
    const values: Record<string, unknown> = { status }
    if (status === 'resolved') {
      values.resolvedAt = new Date()
      values.resolvedByUserId = actorUserId ?? null
      values.regressedAt = null
      values.regressedInRelease = null
    }
    if (status === 'unresolved') {
      values.resolvedAt = null
      values.resolvedByUserId = null
    }
    const [issue] = await this.db.update(issues).set(values).where(eq(issues.id, id)).returning()
    return issue ?? null
  }

  async assign(id: string, assigneeUserId: string | null, actorUserId?: string | null) {
    const [issue] = await this.db
      .update(issues)
      .set({
        assigneeUserId: assigneeUserId?.trim() || null,
        assignedAt: new Date(),
        assignedByUserId: actorUserId ?? null,
      })
      .where(eq(issues.id, id))
      .returning()
    return issue ?? null
  }

  async markFixed(id: string, release: string, actorUserId?: string | null) {
    const fixedInRelease = release.trim()
    if (!fixedInRelease) throw new BadRequestException('Release is required')
    const [issue] = await this.db
      .update(issues)
      .set({
        status: 'resolved',
        fixedInRelease,
        resolvedAt: new Date(),
        resolvedByUserId: actorUserId ?? null,
        regressedAt: null,
        regressedInRelease: null,
      })
      .where(eq(issues.id, id))
      .returning()
    return issue ?? null
  }

  async listComments(issueId: string): Promise<IssueCommentRow[]> {
    return rowsFrom<IssueCommentRow>(
      await this.db.execute(sql`
        SELECT
          c.id,
          c.issue_id as "issueId",
          c.author_user_id as "authorUserId",
          u.email as "authorEmail",
          u.name as "authorName",
          c.body,
          c.created_at as "createdAt"
        FROM issue_comments c
        LEFT JOIN "user" u ON u.id = c.author_user_id
        WHERE c.issue_id = ${issueId}
        ORDER BY c.created_at DESC
      `),
    )
  }

  async addComment(issueId: string, authorUserId: string, body: string): Promise<IssueCommentRow | null> {
    const trimmed = body.trim()
    if (!trimmed) throw new BadRequestException('Comment body is required')
    const result = await this.db.execute(sql`
      WITH inserted AS (
        INSERT INTO issue_comments (issue_id, author_user_id, body)
        VALUES (${issueId}, ${authorUserId}, ${trimmed})
        RETURNING id, issue_id, author_user_id, body, created_at
      )
      SELECT
        inserted.id,
        inserted.issue_id as "issueId",
        inserted.author_user_id as "authorUserId",
        u.email as "authorEmail",
        u.name as "authorName",
        inserted.body,
        inserted.created_at as "createdAt"
      FROM inserted
      LEFT JOIN "user" u ON u.id = inserted.author_user_id
    `)
    return rowsFrom<IssueCommentRow>(result)[0] ?? null
  }

  async mergeIssues(sourceIssueId: string, targetIssueId: string) {
    if (sourceIssueId === targetIssueId) throw new BadRequestException('Source and target issue must differ')
    return this.db.transaction(async (tx) => {
      const result = await tx.execute(sql`
        WITH source_issue AS (
          SELECT id, project_id FROM issues WHERE id = ${sourceIssueId}
        ),
        target_issue AS (
          SELECT id, project_id FROM issues WHERE id = ${targetIssueId}
        ),
        moved_events AS (
          UPDATE events
          SET issue_id = ${targetIssueId}
          WHERE issue_id = ${sourceIssueId}
            AND EXISTS (
              SELECT 1 FROM source_issue s, target_issue t
              WHERE s.project_id = t.project_id
            )
          RETURNING id
        ),
        source_marked AS (
          UPDATE issues
          SET status = 'ignored',
              merged_into_issue_id = ${targetIssueId}
          WHERE id = ${sourceIssueId}
            AND EXISTS (
              SELECT 1 FROM source_issue s, target_issue t
              WHERE s.project_id = t.project_id
            )
          RETURNING id
        ),
        refreshed AS (
          UPDATE issues
          SET
            count = (SELECT count(*)::int FROM events WHERE issue_id = ${targetIssueId}),
            user_count = ${issueUserCountSql(targetIssueId)},
            last_seen = COALESCE((SELECT max(timestamp) FROM events WHERE issue_id = ${targetIssueId}), issues.last_seen)
          WHERE id = ${targetIssueId}
            AND EXISTS (SELECT 1 FROM source_marked)
          RETURNING *
        )
        SELECT
          id,
          project_id as "projectId",
          fingerprint,
          title,
          level,
          status,
          first_seen as "firstSeen",
          last_seen as "lastSeen",
          count,
          user_count as "userCount",
          assignee_user_id as "assigneeUserId",
          assigned_at as "assignedAt",
          assigned_by_user_id as "assignedByUserId",
          resolved_at as "resolvedAt",
          resolved_by_user_id as "resolvedByUserId",
          fixed_in_release as "fixedInRelease",
          regressed_at as "regressedAt",
          regressed_in_release as "regressedInRelease",
          merged_into_issue_id as "mergedIntoIssueId",
          split_from_issue_id as "splitFromIssueId"
        FROM refreshed
      `)
      return rowsFrom<typeof issues.$inferSelect>(result)[0] ?? null
    })
  }

  async splitIssue(sourceIssueId: string, eventIds: string[]) {
    const uniqueEventIds = [...new Set(eventIds.map((id) => id.trim()).filter(Boolean))]
    if (uniqueEventIds.length === 0) throw new BadRequestException('At least one event id is required')
    const splitFingerprint = `split:${createHash('sha1').update(`${sourceIssueId}:${uniqueEventIds.join(',')}`).digest('hex').slice(0, 16)}`
    const eventIdList = sql.join(uniqueEventIds.map((id) => sql`${id}`), sql`, `)

    return this.db.transaction(async (tx) => {
      const result = await tx.execute(sql`
        WITH selected_events AS (
          SELECT e.*
          FROM events e
          WHERE e.issue_id = ${sourceIssueId}
            AND e.id IN (${eventIdList})
        ),
        first_event AS (
          SELECT * FROM selected_events
          ORDER BY timestamp DESC
          LIMIT 1
        ),
        source_issue AS (
          SELECT * FROM issues WHERE id = ${sourceIssueId}
        ),
        new_issue AS (
          INSERT INTO issues (
            project_id,
            fingerprint,
            title,
            level,
            status,
            first_seen,
            last_seen,
            count,
            user_count,
            split_from_issue_id
          )
          SELECT
            source_issue.project_id,
            ${splitFingerprint},
            left(COALESCE(first_event.message, source_issue.title), 255),
            COALESCE(first_event.level, source_issue.level),
            'unresolved',
            COALESCE((SELECT min(timestamp) FROM selected_events), now()),
            COALESCE((SELECT max(timestamp) FROM selected_events), now()),
            0,
            0,
            source_issue.id
          FROM source_issue
          JOIN first_event ON true
          RETURNING *
        ),
        moved_events AS (
          UPDATE events
          SET issue_id = (SELECT id FROM new_issue)
          WHERE issue_id = ${sourceIssueId}
            AND id IN (${eventIdList})
          RETURNING *
        ),
        refreshed_new AS (
          UPDATE issues
          SET
            count = (SELECT count(*)::int FROM events WHERE issue_id = (SELECT id FROM new_issue)),
            user_count = ${issueUserCountForNewIssueSql()},
            first_seen = COALESCE((SELECT min(timestamp) FROM moved_events), issues.first_seen),
            last_seen = COALESCE((SELECT max(timestamp) FROM moved_events), issues.last_seen)
          WHERE id = (SELECT id FROM new_issue)
          RETURNING *
        ),
        refreshed_source AS (
          UPDATE issues
          SET
            count = (SELECT count(*)::int FROM events WHERE issue_id = ${sourceIssueId}),
            user_count = ${issueUserCountSql(sourceIssueId)},
            last_seen = COALESCE((SELECT max(timestamp) FROM events WHERE issue_id = ${sourceIssueId}), issues.last_seen)
          WHERE id = ${sourceIssueId}
          RETURNING id
        )
        SELECT
          id,
          project_id as "projectId",
          fingerprint,
          title,
          level,
          status,
          first_seen as "firstSeen",
          last_seen as "lastSeen",
          count,
          user_count as "userCount",
          assignee_user_id as "assigneeUserId",
          assigned_at as "assignedAt",
          assigned_by_user_id as "assignedByUserId",
          resolved_at as "resolvedAt",
          resolved_by_user_id as "resolvedByUserId",
          fixed_in_release as "fixedInRelease",
          regressed_at as "regressedAt",
          regressed_in_release as "regressedInRelease",
          merged_into_issue_id as "mergedIntoIssueId",
          split_from_issue_id as "splitFromIssueId"
        FROM refreshed_new
        WHERE EXISTS (SELECT 1 FROM refreshed_source)
      `)
      return rowsFrom<typeof issues.$inferSelect>(result)[0] ?? null
    })
  }

  async facets(issueId: string): Promise<IssueFacets> {
    const [releaseRows, environmentRows, tagRows] = await Promise.all([
      this.db.execute(sql`
        SELECT COALESCE(release, '(none)') as value, count(*)::int as count
        FROM events
        WHERE issue_id = ${issueId}
        GROUP BY COALESCE(release, '(none)')
        ORDER BY count DESC, value
        LIMIT 10
      `),
      this.db.execute(sql`
        SELECT COALESCE(environment, '(none)') as value, count(*)::int as count
        FROM events
        WHERE issue_id = ${issueId}
        GROUP BY COALESCE(environment, '(none)')
        ORDER BY count DESC, value
        LIMIT 10
      `),
      this.db.execute(sql`
        SELECT tag.key, tag.value, count(*)::int as count
        FROM events e
        CROSS JOIN LATERAL jsonb_each_text(e.tags) AS tag(key, value)
        WHERE e.issue_id = ${issueId}
          AND e.tags IS NOT NULL
        GROUP BY tag.key, tag.value
        ORDER BY count DESC, tag.key, tag.value
        LIMIT 20
      `),
    ])

    return {
      releases: rowsFrom<{ value: string; count: number | string }>(releaseRows).map(normalizeFacet),
      environments: rowsFrom<{ value: string; count: number | string }>(environmentRows).map(normalizeFacet),
      tags: rowsFrom<{ key: string; value: string; count: number | string }>(tagRows).map((row) => ({
        key: row.key,
        value: row.value,
        count: Number(row.count),
      })),
    }
  }
}

function rowsFrom<T>(result: unknown): T[] {
  return Array.isArray(result) ? (result as T[]) : ((result as { rows?: T[] }).rows ?? [])
}

function normalizeFacet(row: { value: string; count: number | string }): IssueFacet {
  return { value: row.value, count: Number(row.count) }
}

function issueUserCountSql(issueId: string) {
  return sql`(
    SELECT count(DISTINCT ${eventUserKeySql()})::int
    FROM events
    WHERE issue_id = ${issueId}
      AND "user" IS NOT NULL
      AND ${eventUserKeySql()} IS NOT NULL
  )`
}

function issueUserCountForNewIssueSql() {
  return sql`(
    SELECT count(DISTINCT ${eventUserKeySql()})::int
    FROM events
    WHERE issue_id = (SELECT id FROM new_issue)
      AND "user" IS NOT NULL
      AND ${eventUserKeySql()} IS NOT NULL
  )`
}

function eventUserKeySql() {
  return sql`COALESCE(
    NULLIF('id:' || btrim("user"->>'id'), 'id:'),
    NULLIF('id:' || btrim("user"->>'userId'), 'id:'),
    NULLIF('email:' || lower(btrim("user"->>'email')), 'email:'),
    NULLIF('username:' || lower(btrim("user"->>'username')), 'username:'),
    NULLIF('anonymousId:' || btrim("user"->>'anonymousId'), 'anonymousId:')
  )`
}
