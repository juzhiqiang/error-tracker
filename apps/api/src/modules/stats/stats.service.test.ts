import { describe, expect, it, mock } from 'bun:test'
import { StatsService } from './stats.service'

describe('StatsService', () => {
  it('returns raw SQL rows for issue trends', async () => {
    const rows = [{ hour: '2026-05-31T00:00:00Z', count: '2' }]
    const service = new StatsService({ execute: mock(async () => ({ rows })) } as never)

    await expect(service.issuesTrend('project-1')).resolves.toEqual(rows)
  })

  it('returns raw SQL rows for performance summaries', async () => {
    const rows = [{ name: 'LCP', rating: 'good', count: '3', avg_value: '1200' }]
    const service = new StatsService({ execute: mock(async () => ({ rows })) } as never)

    await expect(service.performanceSummary('project-1')).resolves.toEqual(rows)
  })
})
