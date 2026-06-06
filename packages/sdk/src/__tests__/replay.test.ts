import { afterEach, describe, expect, it, mock } from 'bun:test'
import type { ErrorTrackerClient } from '../core/client'
import { CircularBuffer } from '../plugins/replay/circular-buffer'
import { ReplayPlugin } from '../plugins/replay'

mock.module('rrweb', () => ({
  record: ({ emit }: { emit: (event: { timestamp: number; type: number; data: unknown }) => void }) => {
    emit({ timestamp: Date.now(), type: 2, data: { href: 'http://localhost' } })
    return () => {}
  },
}))

describe('CircularBuffer', () => {
  afterEach(() => {
    delete (globalThis as unknown as { fetch?: unknown }).fetch
  })

  it('retains items within age limit', async () => {
    const buf = new CircularBuffer(200)
    buf.push({ timestamp: Date.now(), type: 0, data: {} })
    await new Promise((r) => setTimeout(r, 50))
    expect(buf.drain()).toHaveLength(1)
  })

  it('evicts items older than maxAgeMs', async () => {
    const buf = new CircularBuffer(50)
    buf.push({ timestamp: Date.now() - 100, type: 0, data: {} })
    expect(buf.drain()).toHaveLength(0)
  })

  it('drain returns all items and clears buffer', () => {
    const buf = new CircularBuffer(5000)
    buf.push({ timestamp: Date.now(), type: 0, data: {} })
    buf.push({ timestamp: Date.now(), type: 0, data: {} })
    const items = buf.drain()
    expect(items).toHaveLength(2)
    expect(buf.drain()).toHaveLength(0)
  })
})

describe('ReplayPlugin', () => {
  afterEach(() => {
    delete (globalThis as unknown as { fetch?: unknown }).fetch
  })

  it('uploads replay events with the captured exception event id', async () => {
    const fetchBodies: string[] = []
    const fetchInits: RequestInit[] = []
    const fetchUrls: string[] = []
    const fetchMock = mock(async (url: string, init?: RequestInit) => {
      fetchUrls.push(url)
      fetchInits.push(init ?? {})
      fetchBodies.push(init?.body as string)
      return new Response(null, { status: 202 })
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const client = {
      captureException: () => 'evt_123',
      options: { dsn: 'http://localhost:3002/ingest/p1/t1' },
    } as unknown as ErrorTrackerClient

    const plugin = new ReplayPlugin({ sampleRate: 1 })
    plugin.setup(client)
    client.captureException(new Error('boom'))
    await new Promise((r) => setTimeout(r, 10))

    const body = JSON.parse(fetchBodies[0])
    expect(fetchUrls[0]).toBe('http://localhost:3002/ingest/p1/t1/replay')
    expect(fetchInits[0].keepalive).toBeUndefined()
    expect(body.eventId).toBe('evt_123')
  })
})
