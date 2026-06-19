import { afterEach, describe, expect, it, mock } from 'bun:test'
import { api } from './api'

const originalFetch = global.fetch

afterEach(() => {
  global.fetch = originalFetch
})

describe('api sourcemap upload', () => {
  it('uploads multipart form data without forcing a JSON content type', async () => {
    let capturedInit: RequestInit | undefined
    let capturedUrl = ''
    global.fetch = mock(async (input, init) => {
      capturedUrl = String(input)
      capturedInit = init
      return new Response(JSON.stringify({ uploaded: 2 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as typeof fetch

    const formData = new FormData()
    formData.append('files', new Blob(['{}'], { type: 'application/json' }), 'app.js.map')
    formData.append('files', new Blob(['{}'], { type: 'application/json' }), 'vendor.js.map')

    const result = await api.sourcemaps.upload('project-1', 'web@2.8.1', formData)

    expect(result).toEqual({ uploaded: 2 })
    expect(capturedUrl).toBe('http://localhost:3002/api/sourcemaps/project-1/web%402.8.1')
    expect(capturedInit?.method).toBe('POST')
    expect(capturedInit?.body).toBe(formData)
    expect(capturedInit?.credentials).toBe('include')
    expect(new Headers(capturedInit?.headers).has('Content-Type')).toBe(false)
  })
})

describe('api AI advisor', () => {
  it('requests issue and performance AI analysis with POST', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    global.fetch = mock(async (input, init) => {
      calls.push({ url: String(input), init })
      return new Response(JSON.stringify({ summary: 'analysis', recommendations: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as typeof fetch

    await api.issues.aiAnalysis('issue-1')
    await api.stats.aiPerformance('project-1')

    expect(calls.map((call) => call.url)).toEqual([
      'http://localhost:3002/api/issues/issue-1/ai-analysis',
      'http://localhost:3002/api/stats/performance/ai-analysis?projectId=project-1',
    ])
    expect(calls.every((call) => call.init?.method === 'POST')).toBe(true)
  })
})

describe('api performance stats', () => {
  it('loads expanded performance summaries', async () => {
    let capturedUrl = ''
    global.fetch = mock(async (input) => {
      capturedUrl = String(input)
      return Response.json([{ kind: 'longtask', name: 'longtask', count: '1', avg_value: '90', slowest: '90' }])
    }) as typeof fetch

    const result = await api.stats.performance('project-1', 7)

    expect(capturedUrl).toBe('http://localhost:3002/api/stats/performance?projectId=project-1&days=7')
    expect(result[0]).toMatchObject({ kind: 'longtask', name: 'longtask', slowest: '90' })
  })

  it('loads device breakdown and issue related performance samples', async () => {
    const calls: string[] = []
    global.fetch = mock(async (input) => {
      calls.push(String(input))
      return Response.json([])
    }) as typeof fetch

    await api.stats.performanceDevices('project-1', 7)
    await api.stats.performanceDevice('project-1', 'device-1', 7, 'session-1')
    await api.stats.issuePerformance('issue-1')

    expect(calls).toEqual([
      'http://localhost:3002/api/stats/performance/devices?projectId=project-1&days=7',
      'http://localhost:3002/api/stats/performance/devices/device-1?projectId=project-1&days=7&sessionId=session-1',
      'http://localhost:3002/api/stats/performance/issues/issue-1',
    ])
  })

  it('loads project geo distribution summaries', async () => {
    let capturedUrl = ''
    global.fetch = mock(async (input) => {
      capturedUrl = String(input)
      return Response.json([{ countryCode: 'CN', countryName: 'China', count: 8 }])
    }) as typeof fetch

    const result = await api.stats.geo('project-1')

    expect(capturedUrl).toBe('http://localhost:3002/api/stats/geo?projectId=project-1')
    expect(result[0]).toMatchObject({ countryCode: 'CN', countryName: 'China', count: 8 })
  })
})

describe('api project privacy settings', () => {
  it('updates the project AI analysis opt-in with PATCH', async () => {
    let capturedUrl = ''
    let capturedInit: RequestInit | undefined
    global.fetch = mock(async (input, init) => {
      capturedUrl = String(input)
      capturedInit = init
      return new Response(JSON.stringify([{ id: 'project-1', aiAnalysisEnabled: true }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as typeof fetch

    await api.projects.updateAiAnalysis('project-1', true)

    expect(capturedUrl).toBe('http://localhost:3002/api/projects/project-1/ai-analysis')
    expect(capturedInit?.method).toBe('PATCH')
    expect(capturedInit?.body).toBe(JSON.stringify({ enabled: true }))
  })
})

describe('api issue workflow endpoints', () => {
  it('calls assignment, fixed release, comment, merge, split, and facet endpoints', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    global.fetch = mock(async (input, init) => {
      calls.push({ url: String(input), init })
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as typeof fetch

    await api.issues.assign('issue-1', { assigneeUserId: 'user-2' })
    await api.issues.markFixed('issue-1', { release: 'web@2.1.0' })
    await api.issues.comments('issue-1')
    await api.issues.addComment('issue-1', { body: 'Investigating' })
    await api.issues.facets('issue-1')
    await api.issues.merge('source-1', { targetIssueId: 'target-1' })
    await api.issues.split('source-1', { eventIds: ['event-1'] })

    expect(calls.map((call) => call.url)).toEqual([
      'http://localhost:3002/api/issues/issue-1/assignment',
      'http://localhost:3002/api/issues/issue-1/fix',
      'http://localhost:3002/api/issues/issue-1/comments',
      'http://localhost:3002/api/issues/issue-1/comments',
      'http://localhost:3002/api/issues/issue-1/facets',
      'http://localhost:3002/api/issues/source-1/merge',
      'http://localhost:3002/api/issues/source-1/split',
    ])
    expect(calls.map((call) => call.init?.method ?? 'GET')).toEqual([
      'PATCH',
      'PATCH',
      'GET',
      'POST',
      'GET',
      'POST',
      'POST',
    ])
  })
})

describe('api project alert settings', () => {
  it('updates webhook and alert thresholds with PATCH', async () => {
    let capturedUrl = ''
    let capturedInit: RequestInit | undefined
    global.fetch = mock(async (input, init) => {
      capturedUrl = String(input)
      capturedInit = init
      return new Response(JSON.stringify([{ id: 'project-1' }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as typeof fetch

    await api.projects.updateAlertSettings('project-1', {
      webhookUrl: 'https://hook.local',
      alertThreshold: 20,
      alertUserThreshold: 5,
    })

    expect(capturedUrl).toBe('http://localhost:3002/api/projects/project-1/alert-settings')
    expect(capturedInit?.method).toBe('PATCH')
    expect(capturedInit?.body).toBe(
      JSON.stringify({ webhookUrl: 'https://hook.local', alertThreshold: 20, alertUserThreshold: 5 }),
    )
  })
})
