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

  async geoDistribution(projectId: string) {
    const result = await this.db.execute(sql`
      WITH event_context AS (
        SELECT
          coalesce(
            user->>'countryCode',
            user->>'country',
            request->>'countryCode',
            request->>'country',
            context->>'countryCode',
            context->>'country',
            context->'environment'->'locale'->>'countryCode',
            context->'environment'->'locale'->>'country'
          ) as raw_country,
          context->'environment'->'locale'->>'timezone' as timezone,
          context->'environment'->'locale'->>'language' as language
        FROM events
        WHERE project_id = ${projectId}
          AND timestamp >= now() - interval '30 days'
      ),
      event_geo AS (
        SELECT
          CASE
            WHEN lower(raw_country) IN ('united states', 'united states of america', 'usa') THEN 'US'
            WHEN lower(raw_country) IN ('china', 'people''s republic of china') THEN 'CN'
            WHEN lower(raw_country) IN ('japan', 'germany', 'france', 'united kingdom', 'great britain', 'india', 'brazil', 'canada', 'australia', 'singapore', 'south korea') THEN
              CASE lower(raw_country)
                WHEN 'japan' THEN 'JP'
                WHEN 'germany' THEN 'DE'
                WHEN 'france' THEN 'FR'
                WHEN 'united kingdom' THEN 'GB'
                WHEN 'great britain' THEN 'GB'
                WHEN 'india' THEN 'IN'
                WHEN 'brazil' THEN 'BR'
                WHEN 'canada' THEN 'CA'
                WHEN 'australia' THEN 'AU'
                WHEN 'singapore' THEN 'SG'
                WHEN 'south korea' THEN 'KR'
              END
            WHEN upper(left(raw_country, 2)) IN ('US', 'CN', 'JP', 'DE', 'FR', 'GB', 'IN', 'BR', 'CA', 'AU', 'SG', 'KR')
              THEN upper(left(raw_country, 2))
            WHEN timezone LIKE 'Asia/Shanghai%' THEN 'CN'
            WHEN timezone LIKE 'Asia/Tokyo%' THEN 'JP'
            WHEN timezone LIKE 'Asia/Seoul%' THEN 'KR'
            WHEN timezone LIKE 'Asia/Singapore%' THEN 'SG'
            WHEN timezone LIKE 'Europe/London%' THEN 'GB'
            WHEN timezone LIKE 'Europe/Berlin%' THEN 'DE'
            WHEN timezone LIKE 'Europe/Paris%' THEN 'FR'
            WHEN timezone LIKE 'America/%' THEN 'US'
            WHEN language LIKE '%-%' THEN upper(split_part(language, '-', 2))
            ELSE NULL
          END as country_code
        FROM event_context
      )
      SELECT
        country_code,
        CASE country_code
          WHEN 'US' THEN 'United States'
          WHEN 'CN' THEN 'China'
          WHEN 'JP' THEN 'Japan'
          WHEN 'DE' THEN 'Germany'
          WHEN 'FR' THEN 'France'
          WHEN 'GB' THEN 'United Kingdom'
          WHEN 'IN' THEN 'India'
          WHEN 'BR' THEN 'Brazil'
          WHEN 'CA' THEN 'Canada'
          WHEN 'AU' THEN 'Australia'
          WHEN 'SG' THEN 'Singapore'
          WHEN 'KR' THEN 'South Korea'
          ELSE country_code
        END as country_name,
        count(*)::int as count
      FROM event_geo
      WHERE country_code IS NOT NULL
      GROUP BY country_code
      ORDER BY count DESC, country_code
      LIMIT 24
    `)

    return sqlRows(result).map((row) => {
      const item = row as { country_code?: string; country_name?: string; count?: number | string }
      return {
        countryCode: item.country_code,
        countryName: item.country_name ?? item.country_code,
        count: Number(item.count ?? 0),
      }
    })
  }
}

function sqlRows(result: unknown): unknown[] {
  if (Array.isArray(result)) return result
  return (result as { rows?: unknown[] } | null)?.rows ?? []
}
