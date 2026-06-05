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
