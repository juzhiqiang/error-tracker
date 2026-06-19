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

  async performanceSummary(projectId: string, days = 7) {
    const windowDays = clampDays(days)
    try {
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
          max(COALESCE(duration::double precision, value)) as slowest
        FROM performance_metrics
        WHERE project_id = ${projectId}
          AND timestamp >= now() - (${windowDays} * interval '1 day')
        GROUP BY kind, name, rating, method, status, initiator_type
        ORDER BY kind, name, rating, method, status, initiator_type
      `)
      return sqlRows(result)
    } catch (error) {
      if (!isMissingPerformanceTelemetryColumn(error)) throw error
      const legacyResult = await this.db.execute(sql`
        SELECT
          'web-vital' as kind,
          name,
          rating,
          NULL::text as method,
          NULL::integer as status,
          NULL::text as initiator_type,
          count(*) as count,
          avg(value) as avg_value,
          max(value) as slowest
        FROM performance_metrics
        WHERE project_id = ${projectId}
          AND timestamp >= now() - (${windowDays} * interval '1 day')
        GROUP BY name, rating
        ORDER BY name, rating
      `)
      return sqlRows(legacyResult)
    }
  }

  async performanceDevices(projectId: string, days = 7) {
    const windowDays = clampDays(days)
    const result = await this.db.execute(sql`
      WITH latest_events AS (
        SELECT DISTINCT ON (device_id)
          device_id,
          context,
          timestamp
        FROM events
        WHERE project_id = ${projectId}
          AND device_id IS NOT NULL
        ORDER BY device_id, timestamp DESC
      ),
      device_metrics AS (
        SELECT
          pm.device_id,
          count(DISTINCT pm.session_id) as session_count,
          count(*) as sample_count,
          count(*) FILTER (WHERE pm.rating = 'poor' OR COALESCE(pm.duration::double precision, pm.value) >= 2500) as poor_count,
          avg(pm.value) as avg_value,
          max(COALESCE(pm.duration::double precision, pm.value)) as slowest,
          max(pm.timestamp) as last_seen
        FROM performance_metrics pm
        WHERE pm.project_id = ${projectId}
          AND pm.timestamp >= now() - (${windowDays} * interval '1 day')
          AND pm.device_id IS NOT NULL
        GROUP BY pm.device_id
      ),
      related_errors AS (
        SELECT device_id, count(*) as related_error_count
        FROM events
        WHERE project_id = ${projectId}
          AND timestamp >= now() - (${windowDays} * interval '1 day')
          AND device_id IS NOT NULL
        GROUP BY device_id
      )
      SELECT
        dm.device_id,
        dm.session_count,
        dm.sample_count,
        dm.poor_count,
        dm.avg_value,
        dm.slowest,
        dm.last_seen,
        le.context->'environment'->'userAgent'->'browser'->>'name' as browser,
        le.context->'environment'->'userAgent'->'os'->>'name' as os,
        le.context->'environment'->'userAgent'->'device'->>'type' as device_type,
        COALESCE(re.related_error_count, 0) as related_error_count
      FROM device_metrics dm
      LEFT JOIN latest_events le ON le.device_id = dm.device_id
      LEFT JOIN related_errors re ON re.device_id = dm.device_id
      ORDER BY dm.poor_count DESC, dm.sample_count DESC, dm.last_seen DESC
      LIMIT 20
    `)

    return sqlRows(result).map((row) => {
      const item = row as Record<string, unknown>
      return {
        deviceId: textValue(item.device_id),
        sessionCount: numberValue(item.session_count),
        sampleCount: numberValue(item.sample_count),
        poorCount: numberValue(item.poor_count),
        avgValue: numberValue(item.avg_value),
        slowest: numberValue(item.slowest),
        browser: textValue(item.browser),
        os: textValue(item.os),
        deviceType: textValue(item.device_type),
        lastSeen: textValue(item.last_seen),
        relatedErrorCount: numberValue(item.related_error_count),
      }
    })
  }

  async issueRelatedPerformance(issueId: string) {
    const result = await this.db.execute(sql`
      WITH issue_events AS (
        SELECT project_id, session_id, device_id, user_id, timestamp
        FROM events
        WHERE issue_id = ${issueId}
      )
      SELECT DISTINCT ON (pm.id)
        pm.id,
        pm.kind,
        pm.name,
        pm.rating,
        pm.value,
        pm.duration,
        pm.url,
        pm.method,
        pm.status,
        pm.initiator_type,
        pm.session_id,
        pm.device_id,
        pm.user_id,
        pm.page_url,
        pm.route,
        pm.timestamp
      FROM performance_metrics pm
      JOIN issue_events ie ON ie.project_id = pm.project_id
        AND (
          (ie.session_id IS NOT NULL AND ie.session_id = pm.session_id)
          OR (ie.device_id IS NOT NULL AND ie.device_id = pm.device_id)
          OR (ie.user_id IS NOT NULL AND ie.user_id = pm.user_id)
          OR pm.timestamp BETWEEN ie.timestamp - interval '5 minutes' AND ie.timestamp + interval '5 minutes'
        )
      ORDER BY pm.id, pm.timestamp DESC
      LIMIT 30
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

function isMissingPerformanceTelemetryColumn(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /column "(kind|method|status|duration|initiator_type)" does not exist/i.test(message)
}

function clampDays(days: number): number {
  if (!Number.isFinite(days)) return 7
  return Math.min(30, Math.max(1, Math.floor(days)))
}

function numberValue(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(number) ? number : 0
}

function textValue(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string' && value.length > 0) return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}
