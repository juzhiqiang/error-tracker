import { describe, it, expect } from 'bun:test'
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
})
