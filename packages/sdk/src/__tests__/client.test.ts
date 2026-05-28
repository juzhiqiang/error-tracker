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
})
