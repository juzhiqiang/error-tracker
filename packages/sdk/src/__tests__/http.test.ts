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

  it('uses sendBeacon when unloading and the beacon is accepted', async () => {
    const beaconCalls: Array<{ url: string; data: BodyInit | null }> = []
    setNavigator({
      sendBeacon: (url: string, data: BodyInit | null) => {
        beaconCalls.push({ url, data })
        return true
      },
    })

    const t = new HttpTransport('http://localhost:3002/ingest/proj1/token1')
    await t.send([{ eventId: 'e1', timestamp: 1, level: 'error', message: 'test', fingerprint: 'fp1' }], true)

    expect(fetchCalls).toHaveLength(0)
    expect(beaconCalls).toHaveLength(1)
    expect(beaconCalls[0].url).toBe('http://localhost:3002/ingest/proj1/token1')
    const body = JSON.parse(await (beaconCalls[0].data as Blob).text())
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
  })
})

function setNavigator(navigator: Pick<Navigator, 'sendBeacon'>): void {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: navigator,
  })
}
