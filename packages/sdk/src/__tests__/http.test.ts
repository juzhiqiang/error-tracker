import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { HttpTransport } from '../transports/http'

describe('HttpTransport', () => {
  let fetchCalls: { url: string; init: RequestInit }[] = []
  let navigatorDescriptor: PropertyDescriptor | undefined

  beforeEach(() => {
    fetchCalls = []
    navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
    globalThis.fetch = mock(async (url: string, init: RequestInit) => {
      fetchCalls.push({ url, init })
      return new Response(null, { status: 202 })
    }) as unknown as typeof fetch
  })

  afterEach(() => {
    if (navigatorDescriptor) {
      Object.defineProperty(globalThis, 'navigator', navigatorDescriptor)
    } else {
      delete (globalThis as unknown as { navigator?: unknown }).navigator
    }
  })

  it('sends POST to header-authenticated ingest URL', async () => {
    const t = new HttpTransport('http://localhost:3002/ingest/proj1/token1')
    t.send([{ eventId: 'e1', timestamp: 1, level: 'error', message: 'test', fingerprint: 'fp1' }])
    await new Promise((r) => setTimeout(r, 10))
    expect(fetchCalls).toHaveLength(1)
    expect(fetchCalls[0].url).toBe('http://localhost:3002/ingest/proj1')
    expect(fetchCalls[0].init.method).toBe('POST')
    expect(fetchCalls[0].init.credentials).toBe('omit')
    expect(new Headers(fetchCalls[0].init.headers).get('x-error-tracker-token')).toBe('token1')
  })

  it('supports tokens supplied separately from the ingest URL', async () => {
    const t = new HttpTransport('http://localhost:3002/ingest/proj1', 'token1')
    await t.send([{ eventId: 'e1', timestamp: 1, level: 'error', message: 'test', fingerprint: 'fp1' }])

    expect(fetchCalls).toHaveLength(1)
    expect(fetchCalls[0].url).toBe('http://localhost:3002/ingest/proj1')
    expect(new Headers(fetchCalls[0].init.headers).get('x-error-tracker-token')).toBe('token1')
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

  it('does not use sendBeacon for unloading requests because ingest requires a token header', async () => {
    const beaconCalls: Array<{ url: string; data: BodyInit | null }> = []
    setNavigator({
      sendBeacon: (url: string, data: BodyInit | null) => {
        beaconCalls.push({ url, data })
        return true
      },
    })

    const t = new HttpTransport('http://localhost:3002/ingest/proj1/token1')
    await t.send([{ eventId: 'e1', timestamp: 1, level: 'error', message: 'test', fingerprint: 'fp1' }], true)

    expect(beaconCalls).toHaveLength(0)
    expect(fetchCalls).toHaveLength(1)
    expect(fetchCalls[0].url).toBe('http://localhost:3002/ingest/proj1')
    expect(fetchCalls[0].init.keepalive).toBe(true)
    expect(new Headers(fetchCalls[0].init.headers).get('x-error-tracker-token')).toBe('token1')
    const body = JSON.parse(fetchCalls[0].init.body as string)
    expect(body.events[0].eventId).toBe('e1')
  })

  it('falls back to fetch keepalive when sendBeacon rejects the payload', async () => {
    setNavigator({
      sendBeacon: () => false,
    })

    const t = new HttpTransport('http://localhost:3002/ingest/proj1/token1')
    await t.send([{ eventId: 'e1', timestamp: 1, level: 'error', message: 'test', fingerprint: 'fp1' }], true)

    expect(fetchCalls).toHaveLength(1)
    expect(fetchCalls[0].init.keepalive).toBe(true)
    expect(fetchCalls[0].init.credentials).toBe('omit')
    expect(fetchCalls[0].url).toBe('http://localhost:3002/ingest/proj1')
    expect(new Headers(fetchCalls[0].init.headers).get('x-error-tracker-token')).toBe('token1')
  })

  it('does not send ingest requests when no DSN token is configured', async () => {
    const warn = console.warn
    console.warn = mock(() => undefined) as unknown as typeof console.warn
    try {
      const t = new HttpTransport('http://localhost:3002/ingest/proj1')

      await t.send([{ eventId: 'e1', timestamp: 1, level: 'error', message: 'test', fingerprint: 'fp1' }])

      expect(fetchCalls).toHaveLength(0)
    } finally {
      console.warn = warn
    }
  })

  it('treats non-accepted ingest responses as send failures', async () => {
    globalThis.fetch = mock(async (url: string, init: RequestInit) => {
      fetchCalls.push({ url, init })
      return new Response(null, { status: 401 })
    }) as unknown as typeof fetch
    const t = new HttpTransport('http://localhost:3002/ingest/proj1/token1')

    await expect(t.send([{ eventId: 'e1', timestamp: 1, level: 'error', message: 'test', fingerprint: 'fp1' }])).rejects.toThrow(
      'Ingest request failed with status 401',
    )
  })
})

function setNavigator(navigator: Pick<Navigator, 'sendBeacon'>): void {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: navigator,
  })
}
