import { describe, expect, it, mock } from 'bun:test'
import { AiAdvisorService } from './ai-advisor.service'

describe('AiAdvisorService', () => {
  it('creates actionable issue repair guidance from issue evidence', async () => {
    const provider = { generate: mock(async (_kind: string, _context: unknown, fallback: unknown) => fallback) }
    const service = new AiAdvisorService(provider as never)

    const result = await service.analyzeIssue({
      issue: {
        id: 'issue-1',
        title: 'Cannot read properties of undefined',
        level: 'error',
        count: 12,
        userCount: 4,
        status: 'unresolved',
        projectId: 'project-1',
      },
      events: [
        {
          id: 'event-1',
          message: 'Cannot read properties of undefined',
          stacktrace: [{ function: 'CheckoutButton', filename: 'src/checkout.tsx', lineno: 42, colno: 7 }],
          breadcrumbs: [{ type: 'ui.click', message: 'Clicked pay', data: { token: 'secret' } }],
          request: { headers: { authorization: 'Bearer hidden' } },
          context: { environment: { network: { quality: 'poor' }, user: { token: 'environment-token' } } },
          tags: { route: '/checkout' },
          release: 'web@2.8.1',
          environment: 'production',
        },
      ],
    } as never)

    expect(result.summary).toContain('Cannot read properties')
    expect(result.evidence.join('\n')).toContain('12 events')
    expect(result.recommendations[0].steps.length).toBeGreaterThan(0)
    expect(provider.generate.mock.calls[0][1]).not.toContain('secret')
    expect(provider.generate.mock.calls[0][1]).not.toContain('Bearer hidden')
    expect(provider.generate.mock.calls[0][1]).not.toContain('environment-token')
    expect(provider.generate.mock.calls[0][1]).toContain('"quality": "poor"')
  })

  it('prioritizes poor performance samples with metric-specific optimization guidance', async () => {
    const provider = { generate: mock(async (_kind: string, _context: unknown, fallback: unknown) => fallback) }
    const service = new AiAdvisorService(provider as never)

    const result = await service.analyzePerformance({
      projectId: 'project-1',
      window: '24h',
      metrics: [
        { name: 'INP', rating: 'poor', count: '8', avg_value: '640' },
        { name: 'LCP', rating: 'needs-improvement', count: '3', avg_value: '3100' },
      ],
    })

    expect(result.priority).toBe('high')
    expect(result.summary).toContain('INP')
    expect(result.recommendations.map((item) => item.title).join('\n')).toContain('INP')
  })

  it('allows external AI only when the owning project has opted in', async () => {
    const issue = {
      id: 'issue-1',
      title: 'boom',
      level: 'error',
      status: 'unresolved',
      count: 1,
      userCount: 1,
      fingerprint: 'fp-1',
      projectId: 'project-1',
    }
    const event = {
      id: 'event-1',
      message: 'Failed for ada@example.com with Bearer secret-token',
      stacktrace: [],
      breadcrumbs: [],
      request: {},
      user: {},
      tags: {},
      context: {},
      environment: 'production',
      release: 'web@1',
    }
    let selectCalls = 0
    const db = {
      select: mock(() => {
        selectCalls += 1
        if (selectCalls === 1) {
          return { from: () => ({ where: () => ({ limit: async () => [issue] }) }) }
        }
        return { from: () => ({ where: () => ({ orderBy: () => ({ limit: async () => [event] }) }) }) }
      }),
      execute: mock(async () => ({ rows: [{ aiAnalysisEnabled: true }] })),
    }
    const provider = { generate: mock(async (_kind: string, _context: unknown, fallback: unknown) => fallback) }
    const service = new AiAdvisorService(provider as never, db as never)

    await service.analyzeIssueById('issue-1')

    expect(provider.generate.mock.calls[0][3]).toEqual({ allowExternal: true })
    expect(provider.generate.mock.calls[0][1]).not.toContain('ada@example.com')
    expect(provider.generate.mock.calls[0][1]).not.toContain('secret-token')
  })
})
