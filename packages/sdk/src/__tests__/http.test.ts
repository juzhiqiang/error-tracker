import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { HttpTransport } from '../transports/http'

describe('HttpTransport', () => {
  let fetchCalls: { url: string; init: RequestInit }[] = []

  beforeEach(() => {
    fetchCalls = []
    globalThis.fetch = mock(async (url: string, init: RequestInit) => {
      fetchCalls.push({ url, init })
      return new Response(null, { status: 202 })
    }) as unknown as typeof fetch
  })

  it('sends POST to correct URL', async () => {
    const t = new HttpTransport('http://localhost:3002/ingest/proj1/token1')
    t.send([{ eventId: 'e1', timestamp: 1, level: 'error', message: 'test', fingerprint: 'fp1' }])
    await new Promise((r) => setTimeout(r, 10))
    expect(fetchCalls).toHaveLength(1)
    expect(fetchCalls[0].url).toBe('http://localhost:3002/ingest/proj1/token1')
    expect(fetchCalls[0].init.method).toBe('POST')
  })

  it('sends JSON body with events array', async () => {
    const t = new HttpTransport('http://localhost:3002/ingest/proj1/token1')
    const event = { eventId: 'e1', timestamp: 1, level: 'error' as const, message: 'test', fingerprint: 'fp1' }
    t.send([event])
    await new Promise((r) => setTimeout(r, 10))
    const body = JSON.parse(fetchCalls[0].init.body as string)
    expect(body.events).toHaveLength(1)
    expect(body.events[0].eventId).toBe('e1')
  })

  it('uses keepalive when isUnloading is true', async () => {
    const t = new HttpTransport('http://localhost:3002/ingest/proj1/token1')
    t.send([{ eventId: 'e1', timestamp: 1, level: 'error', message: 'test', fingerprint: 'fp1' }], true)
    await new Promise((r) => setTimeout(r, 10))
    expect(fetchCalls[0].init.keepalive).toBe(true)
  })
})
