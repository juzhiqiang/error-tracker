import { afterEach, describe, expect, it, mock } from 'bun:test'
import { AlertsProcessor } from './alerts.processor'

describe('AlertsProcessor', () => {
  afterEach(() => {
    delete (globalThis as unknown as { fetch?: unknown }).fetch
  })

  it('uses raw SQL rows when checking alert thresholds', async () => {
    const fetchCalls: string[] = []
    globalThis.fetch = mock(async (_url: string, init?: RequestInit) => {
      fetchCalls.push(init?.body as string)
      return new Response(null, { status: 200 })
    }) as unknown as typeof fetch

    const selectRows = [
      [{ id: 'project-1', name: 'Demo', webhookUrl: 'http://hook.local', alertThreshold: 2 }],
      [{ id: 'issue-1', title: 'boom', count: 2 }],
    ]
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => selectRows.shift(),
          }),
        }),
      }),
      execute: mock(async () => ({ rows: [{ recentCount: '2' }] })),
    }
    const processor = new AlertsProcessor(db as never)

    await processor.process({ name: 'check-alert', data: { projectId: 'project-1', issueId: 'issue-1' } } as never)

    expect(fetchCalls).toHaveLength(1)
    expect(JSON.parse(fetchCalls[0]).text).toContain('boom')
  })
})
