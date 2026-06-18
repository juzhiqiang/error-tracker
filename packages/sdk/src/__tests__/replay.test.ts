import { afterEach, describe, expect, it, mock } from 'bun:test'
import type { ErrorTrackerClient } from '../core/client'
import { CircularBuffer } from '../plugins/replay/circular-buffer'
import { ReplayPlugin } from '../plugins/replay'

const recordOptions: Record<string, unknown>[] = []

mock.module('rrweb', () => ({
  record: (options: { emit: (event: { timestamp: number; type: number; data: unknown }) => void }) => {
    recordOptions.push(options as unknown as Record<string, unknown>)
    options.emit({ timestamp: Date.now(), type: 2, data: { href: 'http://localhost' } })
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
    recordOptions.length = 0
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
    expect(fetchUrls[0]).toBe('http://localhost:3002/ingest/p1/replay')
    expect(new Headers(fetchInits[0].headers).get('x-error-tracker-token')).toBe('t1')
    expect(fetchInits[0].credentials).toBe('omit')
    expect(fetchInits[0].keepalive).toBeUndefined()
    expect(body.eventId).toBe('evt_123')
  })

  it('uploads replay with a separate SDK token header', async () => {
    const fetchInits: RequestInit[] = []
    const fetchUrls: string[] = []
    globalThis.fetch = mock(async (url: string, init?: RequestInit) => {
      fetchUrls.push(url)
      fetchInits.push(init ?? {})
      return new Response(null, { status: 202 })
    }) as unknown as typeof fetch
    const client = {
      captureException: () => 'evt_123',
      options: { dsn: 'http://localhost:3002/ingest/p1', token: 't1' },
    } as unknown as ErrorTrackerClient

    const plugin = new ReplayPlugin({ sampleRate: 1 })
    plugin.setup(client)
    client.captureException(new Error('boom'))
    await new Promise((r) => setTimeout(r, 10))

    expect(fetchUrls[0]).toBe('http://localhost:3002/ingest/p1/replay')
    expect(new Headers(fetchInits[0].headers).get('x-error-tracker-token')).toBe('t1')
  })

  it('does not upload replay when no DSN token is configured', async () => {
    const warn = console.warn
    console.warn = mock(() => undefined) as unknown as typeof console.warn
    const fetchMock = mock(async () => new Response(null, { status: 202 }))
    try {
      globalThis.fetch = fetchMock as unknown as typeof fetch
      const client = {
        captureException: () => 'evt_123',
        options: { dsn: 'http://localhost:3002/ingest/p1' },
      } as unknown as ErrorTrackerClient

      const plugin = new ReplayPlugin({ sampleRate: 1 })
      plugin.setup(client)
      client.captureException(new Error('boom'))
      await new Promise((r) => setTimeout(r, 10))

      expect(fetchMock.mock.calls).toHaveLength(0)
    } finally {
      console.warn = warn
    }
  })

  it('masks visible text and blocks sensitive replay regions by default', () => {
    const client = {
      captureException: () => 'evt_123',
      options: { dsn: 'http://localhost:3002/ingest/p1/t1' },
    } as unknown as ErrorTrackerClient

    const plugin = new ReplayPlugin({ sampleRate: 1 })
    plugin.setup(client)

    expect(recordOptions[0].maskAllInputs).toBe(true)
    expect(recordOptions[0].maskAllText).toBe(true)
    expect(recordOptions[0].maskTextSelector).toBe('[data-sensitive]')
    expect(recordOptions[0].blockSelector).toBe('[data-sensitive-block],[data-private],[data-privacy="block"]')
  })

  it('allows replay privacy selectors to be overridden', () => {
    const client = {
      captureException: () => 'evt_123',
      options: { dsn: 'http://localhost:3002/ingest/p1/t1' },
    } as unknown as ErrorTrackerClient

    const plugin = new ReplayPlugin({
      sampleRate: 1,
      maskAllText: false,
      maskTextSelector: '.mask-me',
      blockSelector: '.block-me',
    })
    plugin.setup(client)

    expect(recordOptions[0].maskAllText).toBe(false)
    expect(recordOptions[0].maskTextSelector).toBe('.mask-me')
    expect(recordOptions[0].blockSelector).toBe('.block-me')
  })
})
