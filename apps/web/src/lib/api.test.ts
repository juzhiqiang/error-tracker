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
