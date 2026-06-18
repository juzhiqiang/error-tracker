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
