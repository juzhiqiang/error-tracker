import { describe, expect, it, mock } from 'bun:test'
import { IngestService } from './ingest.service'

describe('IngestService', () => {
  it('links inserted events to the issue id returned by raw SQL execute', async () => {
    const insertedValues: unknown[] = []
    const db = {
      execute: mock(async () => ({ rows: [{ id: 'issue-1' }] })),
      insert: () => ({
        values: mock(async (value: unknown) => {
          insertedValues.push(value)
        }),
      }),
      update: () => ({
        set: mock(() => ({ where: mock(async () => undefined) })),
      }),
    }
    const queue = { add: mock(async () => undefined) }
    const service = new IngestService(db as never, queue as never, {} as never)

    await service.ingestEvent('project-1', {
      eventId: 'event-1',
      timestamp: Date.now(),
      level: 'error',
      message: 'boom',
      fingerprint: 'client-fp',
    })

    expect(insertedValues[0]).toMatchObject({ id: 'event-1', issueId: 'issue-1' })
    expect(queue.add.mock.calls[0]).toEqual([
      'check-alert',
      { projectId: 'project-1', issueId: 'issue-1' },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true, removeOnFail: false },
    ])
  })

  it('scrubs sensitive event fields before inserting events', async () => {
    const insertedValues: unknown[] = []
    const db = {
      execute: mock(async () => ({ rows: [{ id: 'issue-1' }] })),
      insert: () => ({
        values: mock(async (value: unknown) => {
          insertedValues.push(value)
        }),
      }),
      update: () => ({
        set: mock(() => ({ where: mock(async () => undefined) })),
      }),
    }
    const queue = { add: mock(async () => undefined) }
    const service = new IngestService(db as never, queue as never, {} as never)

    await service.ingestEvent('project-1', {
      eventId: 'event-1',
      timestamp: Date.now(),
      level: 'error',
      message: 'boom',
      fingerprint: 'client-fp',
      user: { id: 'user-1', password: 'secret' },
      request: { headers: { authorization: 'Bearer abc', userAgent: 'browser' } },
      breadcrumbs: [{ data: { token: 'client-token', label: 'submit' } }],
      tags: { feature: 'checkout', secret: 'hidden' },
    })

    expect(insertedValues[0]).toMatchObject({
      user: { id: 'user-1', password: '[Filtered]' },
      request: { headers: { authorization: '[Filtered]', userAgent: 'browser' } },
      breadcrumbs: [{ data: { token: '[Filtered]', label: 'submit' } }],
      tags: { feature: 'checkout', secret: '[Filtered]' },
    })
  })

  it('persists scrubbed runtime context for environment and device profiles', async () => {
    const insertedValues: unknown[] = []
    const db = {
      execute: mock(async () => ({ rows: [{ id: 'issue-1' }] })),
      insert: () => ({
        values: mock(async (value: unknown) => {
          insertedValues.push(value)
        }),
      }),
      update: () => ({
        set: mock(() => ({ where: mock(async () => undefined) })),
      }),
    }
    const queue = { add: mock(async () => undefined) }
    const service = new IngestService(db as never, queue as never, {} as never)

    await service.ingestEvent('project-1', {
      eventId: 'event-1',
      timestamp: Date.now(),
      level: 'error',
      message: 'boom',
      fingerprint: 'client-fp',
      context: {
        environment: {
          network: { effectiveType: '4g', rttMs: 40, quality: 'excellent' },
          performance: { tier: 'high' },
          user: { token: 'secret' },
        },
      },
    })

    expect(insertedValues[0]).toMatchObject({
      context: {
        environment: {
          network: { effectiveType: '4g', rttMs: 40, quality: 'excellent' },
          performance: { tier: 'high' },
          user: { token: '[Filtered]' },
        },
      },
    })
  })

  it('links an orphan replay row when the matching event is ingested later', async () => {
    const updateValues: unknown[] = []
    const db = {
      execute: mock(async () => ({ rows: [{ id: 'issue-1' }] })),
      insert: () => ({
        values: mock(async () => undefined),
      }),
      update: () => ({
        set: mock((value: unknown) => {
          updateValues.push(value)
          return { where: mock(async () => undefined) }
        }),
      }),
    }
    const queue = { add: mock(async () => undefined) }
    const service = new IngestService(db as never, queue as never, {} as never)

    await service.ingestEvent('project-1', {
      eventId: 'event-1',
      timestamp: Date.now(),
      level: 'error',
      message: 'boom',
      fingerprint: 'client-fp',
    })

    expect(updateValues).toEqual([{ eventId: 'event-1' }])
  })
})
