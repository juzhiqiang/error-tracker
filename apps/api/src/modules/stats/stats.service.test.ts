import { describe, expect, it, mock } from 'bun:test'
import { StatsService } from './stats.service'

describe('StatsService', () => {
  it('returns raw SQL rows for issue trends', async () => {
    const rows = [{ hour: '2026-05-31T00:00:00Z', count: '2' }]
    const service = new StatsService({ execute: mock(async () => ({ rows })) } as never)

    await expect(service.issuesTrend('project-1')).resolves.toEqual(rows)
  })

  it('returns direct array SQL results for issue trends', async () => {
    const rows = [{ hour: '2026-05-31T00:00:00Z', count: '2' }]
    const service = new StatsService({ execute: mock(async () => rows) } as never)

    await expect(service.issuesTrend('project-1')).resolves.toEqual(rows)
  })

  it('returns raw SQL rows for performance summaries', async () => {
    const rows = [{ name: 'LCP', rating: 'good', count: '3', avg_value: '1200' }]
    const service = new StatsService({ execute: mock(async () => ({ rows })) } as never)

    await expect(service.performanceSummary('project-1')).resolves.toEqual(rows)
  })

  it('returns direct array SQL results for performance summaries', async () => {
    const rows = [{ name: 'LCP', rating: 'good', count: '3', avg_value: '1200' }]
    const service = new StatsService({ execute: mock(async () => rows) } as never)

    await expect(service.performanceSummary('project-1')).resolves.toEqual(rows)
  })

  it('returns expanded performance summary groups', async () => {
    const calls: string[] = []
    const rows = [
      { kind: 'web-vital', name: 'LCP', rating: 'good', count: '2', avg_value: '1200' },
      { kind: 'resource', name: 'resource', rating: null, count: '3', avg_value: '140', slowest: 500 },
      { kind: 'longtask', name: 'longtask', rating: null, count: '1', avg_value: '90', slowest: 90 },
    ]
    const db = {
      execute: mock(async (query: unknown) => {
        calls.push(sqlText(query))
        return { rows }
      }),
    }
    const service = new StatsService(db as never)

    await expect(service.performanceSummary('project-1')).resolves.toEqual(rows)
    expect(calls[0]).toContain('kind')
    expect(calls[0]).toContain('slowest')
  })

  it('uses the requested performance summary window', async () => {
    const calls: string[] = []
    const db = {
      execute: mock(async (query: unknown) => {
        calls.push(sqlText(query))
        return { rows: [] }
      }),
    }
    const service = new StatsService(db as never)

    await service.performanceSummary('project-1', 7)

    expect(calls[0]).toContain("7 * interval '1 day'")
  })

  it('falls back to legacy performance metric columns when expanded telemetry columns are missing', async () => {
    const calls: string[] = []
    const rows = [{ kind: 'web-vital', name: 'LCP', rating: 'good', method: null, status: null, initiator_type: null, count: '3', avg_value: '1200', slowest: '1600' }]
    const db = {
      execute: mock(async (query: unknown) => {
        calls.push(sqlText(query))
        if (calls.length === 1) throw new Error('column "kind" does not exist')
        return { rows }
      }),
    }
    const service = new StatsService(db as never)

    await expect(service.performanceSummary('project-1')).resolves.toEqual(rows)
    expect(calls).toHaveLength(2)
    expect(calls[0]).toContain('kind')
    expect(calls[1]).toContain("'web-vital' as kind")
    expect(calls[1]).toContain('GROUP BY name, rating')
  })

  it('returns geo distribution inferred from event context', async () => {
    const calls: string[] = []
    const rows = [{ country_code: 'CN', country_name: 'China', count: '8' }]
    const db = {
      execute: mock(async (query: unknown) => {
        calls.push(sqlText(query))
        return { rows }
      }),
    }
    const service = new StatsService(db as never)

    await expect(service.geoDistribution('project-1')).resolves.toEqual([
      { countryCode: 'CN', countryName: 'China', count: 8 },
    ])
    expect(calls[0]).toContain('country_code')
    expect(calls[0]).toContain('environment')
    expect(calls[0]).toContain('locale')
    expect(calls[0]).toContain('timezone')
    expect(calls[0]).toContain('united states')
    expect(calls[0]).toContain('south korea')
  })
})

function sqlText(query: unknown): string {
  const chunks = (query as { queryChunks?: unknown[] } | undefined)?.queryChunks
  if (!Array.isArray(chunks)) return String(query)

  return chunks
    .map((chunk) => {
      if (typeof chunk === 'string' || typeof chunk === 'number') return String(chunk)
      const value = (chunk as { value?: unknown } | undefined)?.value
      if (Array.isArray(value)) return value.join('')
      return typeof value === 'string' ? value : ''
    })
    .join('')
}
