import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { ErrorTrackerClient } from '../core/client'

describe('ErrorTrackerClient', () => {
  beforeEach(() => {
    globalThis.fetch = mock(async () => new Response(null, { status: 202 })) as unknown as typeof fetch
  })

  const fetchMock = () => globalThis.fetch as unknown as ReturnType<typeof mock>

  it('captureException sends error event', async () => {
    const client = new ErrorTrackerClient({
      dsn: 'http://localhost:3002/ingest/p1/t1',
    })
    client.captureException(new Error('test error'))
    await client.flush()
    await new Promise((r) => setTimeout(r, 10))
    expect(fetchMock().mock.calls).toHaveLength(1)
  })

  it('captureException flushes T0 error events immediately', async () => {
    const client = new ErrorTrackerClient({
      dsn: 'http://localhost:3002/ingest/p1/t1',
    })

    client.captureException(new Error('t0 crash'))
    await new Promise((r) => setTimeout(r, 10))

    expect(fetchMock().mock.calls).toHaveLength(1)
    const body = JSON.parse(fetchMock().mock.calls[0][1]?.body as string)
    expect(body.events[0].message).toBe('t0 crash')
  })

  it('captureException returns the queued event id', async () => {
    const client = new ErrorTrackerClient({
      dsn: 'http://localhost:3002/ingest/p1/t1',
    })

    const eventId = client.captureException(new Error('track replay id'))
    await client.flush()
    await new Promise((r) => setTimeout(r, 10))

    const body = JSON.parse(fetchMock().mock.calls[0][1]?.body as string)
    expect(eventId).toBe(body.events[0].eventId)
  })

  it('respects sampleRate 0 (never send)', async () => {
    const client = new ErrorTrackerClient({
      dsn: 'http://localhost:3002/ingest/p1/t1',
      sampleRate: 0,
    })
    client.captureException(new Error('test'))
    await client.flush()
    await new Promise((r) => setTimeout(r, 10))
    expect(fetchMock().mock.calls).toHaveLength(0)
  })

  it('deduplicates same error within 5s', async () => {
    const client = new ErrorTrackerClient({
      dsn: 'http://localhost:3002/ingest/p1/t1',
    })
    const err = new Error('dup')
    client.captureException(err)
    client.captureException(err)
    await client.flush()
    await new Promise((r) => setTimeout(r, 10))
    expect(fetchMock().mock.calls).toHaveLength(1)
  })

  it('beforeSend can drop event (return null)', async () => {
    const client = new ErrorTrackerClient({
      dsn: 'http://localhost:3002/ingest/p1/t1',
      beforeSend: () => null,
    })
    client.captureException(new Error('dropped'))
    await client.flush()
    await new Promise((r) => setTimeout(r, 10))
    expect(fetchMock().mock.calls).toHaveLength(0)
  })

  it('captureMessage supports an explicit fingerprint and tags', async () => {
    const client = new ErrorTrackerClient({
      dsn: 'http://localhost:3002/ingest/p1/t1',
    })

    client.captureMessage('Blank screen detected', 'warning', {
      fingerprint: 'blank-screen',
      tags: { mechanism: 'blank-screen', samplePoints: '9' },
    })
    await client.flush()
    await new Promise((r) => setTimeout(r, 10))

    const body = JSON.parse(fetchMock().mock.calls[0][1]?.body as string)
    expect(body.events[0].fingerprint).toBe('blank-screen')
    expect(body.events[0].tags).toMatchObject({
      mechanism: 'blank-screen',
      samplePoints: '9',
    })
  })
})
