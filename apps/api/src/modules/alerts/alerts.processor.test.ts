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

  it('formats Feishu and Lark webhook payloads for IM delivery', async () => {
    const fetchCalls: string[] = []
    globalThis.fetch = mock(async (_url: string, init?: RequestInit) => {
      fetchCalls.push(init?.body as string)
      return new Response(null, { status: 200 })
    }) as unknown as typeof fetch

    const selectRows = [
      [{ id: 'project-1', name: 'Demo', webhookUrl: 'https://open.feishu.cn/open-apis/bot/v2/hook/token', alertThreshold: 50 }],
      [{ id: 'issue-1', title: 'boom', count: 1, userCount: 0 }],
    ]
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => selectRows.shift(),
          }),
        }),
      }),
      execute: mock(async () => ({ rows: [{ recentCount: '1' }] })),
    }
    const processor = new AlertsProcessor(db as never)

    await processor.process({ name: 'check-alert', data: { projectId: 'project-1', issueId: 'issue-1' } } as never)

    expect(JSON.parse(fetchCalls[0])).toMatchObject({
      msg_type: 'text',
      content: { text: expect.stringContaining('Demo') },
    })
  })

  it('alerts when a resolved issue regresses or crosses affected user threshold', async () => {
    const bodies: string[] = []
    globalThis.fetch = mock(async (_url: string, init?: RequestInit) => {
      bodies.push(init?.body as string)
      return new Response(null, { status: 200 })
    }) as unknown as typeof fetch

    const selectRows = [
      [{ id: 'project-1', name: 'Demo', webhookUrl: 'http://hook.local', alertThreshold: 50, alertUserThreshold: 3 }],
      [
        {
          id: 'issue-1',
          title: 'checkout failed',
          count: 8,
          userCount: 3,
          regressedAt: new Date(),
          regressedInRelease: 'web@2.0.0',
        },
      ],
    ]
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => selectRows.shift(),
          }),
        }),
      }),
      execute: mock(async () => ({ rows: [{ recentCount: '1' }] })),
    }
    const processor = new AlertsProcessor(db as never)

    await processor.process({ name: 'check-alert', data: { projectId: 'project-1', issueId: 'issue-1' } } as never)

    expect(bodies).toHaveLength(1)
    const text = JSON.parse(bodies[0]).text as string
    expect(text).toContain('regression')
    expect(text).toContain('3 users')
  })
})
