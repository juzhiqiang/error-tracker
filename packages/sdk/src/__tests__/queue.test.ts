import { afterEach, describe, it, expect } from 'bun:test'
import { EventQueue } from '../core/queue'
import type { TrackerEvent } from '../types'

const makeEvent = (id: string): TrackerEvent => ({
  eventId: id,
  timestamp: Date.now(),
  level: 'error',
  message: 'test',
  fingerprint: id,
})

describe('EventQueue', () => {
  afterEach(() => {
    delete (globalThis as unknown as { localStorage?: unknown }).localStorage
  })

  it('enqueues and flushes events', async () => {
    const sent: TrackerEvent[] = []
    const q = new EventQueue(50, async (events) => {
      sent.push(...events)
    })
    q.enqueue(makeEvent('e1'))
    await q.flush()
    expect(sent).toHaveLength(1)
    expect(sent[0].eventId).toBe('e1')
  })

  it('drops oldest when exceeding maxSize', async () => {
    const sent: TrackerEvent[] = []
    const q = new EventQueue(2, async (events) => {
      sent.push(...events)
    })
    q.enqueue(makeEvent('e1'))
    q.enqueue(makeEvent('e2'))
    q.enqueue(makeEvent('e3'))
    await q.flush()
    expect(sent.map((e) => e.eventId)).toEqual(['e2', 'e3'])
  })

  it('clears queue after flush', async () => {
    const sent: TrackerEvent[] = []
    const q = new EventQueue(50, async (events) => {
      sent.push(...events)
    })
    q.enqueue(makeEvent('e1'))
    await q.flush()
    await q.flush()
    expect(sent).toHaveLength(1)
  })

  it('keeps events queued when flush fails', async () => {
    const sent: TrackerEvent[] = []
    const q = new EventQueue(50, async (events) => {
      if (sent.length === 0) {
        sent.push(...events)
        throw new Error('network down')
      }
      sent.push(...events)
    })
    q.enqueue(makeEvent('e1'))

    await expect(q.flush()).rejects.toThrow('network down')
    await q.flush()

    expect(sent.map((event) => event.eventId)).toEqual(['e1', 'e1'])
  })

  it('retries failed flushes before restoring the batch', async () => {
    let attempts = 0
    const sent: TrackerEvent[] = []
    const q = new EventQueue(
      50,
      async (events) => {
        attempts++
        if (attempts < 3) throw new Error('temporary')
        sent.push(...events)
      },
      { maxRetries: 2, retryDelayMs: 0 },
    )
    q.enqueue(makeEvent('e1'))

    await q.flush()

    expect(attempts).toBe(3)
    expect(sent.map((event) => event.eventId)).toEqual(['e1'])
  })

  it('persists queued events and restores them in a new queue', async () => {
    const storage = new Map<string, string>()
    globalThis.localStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
      removeItem: (key: string) => {
        storage.delete(key)
      },
    } as Storage

    const sent: TrackerEvent[] = []
    const first = new EventQueue(50, async () => {}, { persist: true, persistenceKey: 'queue:test' })
    first.enqueue(makeEvent('e1'))
    const second = new EventQueue(
      50,
      async (events) => {
        sent.push(...events)
      },
      { persist: true, persistenceKey: 'queue:test' },
    )

    await second.flush()

    expect(sent.map((event) => event.eventId)).toEqual(['e1'])
    expect(storage.get('queue:test')).toBeUndefined()
  })
})
