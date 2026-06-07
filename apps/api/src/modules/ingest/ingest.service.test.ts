import { describe, expect, it, mock } from 'bun:test'
import { IngestService } from './ingest.service'

function sqlText(query: unknown): string {
  const chunks = (query as { queryChunks?: unknown[] } | undefined)?.queryChunks
  if (!Array.isArray(chunks)) return ''

  return chunks
    .map((chunk) => {
      if (typeof chunk === 'string' || typeof chunk === 'number') return String(chunk)
      const value = (chunk as { value?: unknown } | undefined)?.value
      if (Array.isArray(value)) return value.join('')
      return typeof value === 'string' ? value : ''
    })
    .join('')
}

function makeIngestDb(options: { existingEventId?: string; issueId?: string } = {}) {
  const insertedValues: unknown[] = []
  const updateValues: unknown[] = []
  const issueUpserts: unknown[] = []
  const onConflictDoNothing = mock(async () => undefined)
  const values = mock((value: unknown) => {
    insertedValues.push(value)
    return { onConflictDoNothing }
  })
  const execute = mock(async (query?: unknown) => {
    if (sqlText(query).includes('INSERT INTO issues')) issueUpserts.push(query)
    return { rows: [{ id: options.issueId ?? 'issue-1' }] }
  })
  const tx = {
    execute,
    select: mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          limit: mock(async () => (options.existingEventId ? [{ id: options.existingEventId }] : [])),
        })),
      })),
    })),
    insert: mock(() => ({ values })),
    update: mock(() => ({
      set: mock((value: unknown) => {
        updateValues.push(value)
        return { where: mock(async () => undefined) }
      }),
    })),
  }
  const transaction = mock(async (callback: (tx: typeof tx) => Promise<unknown>) => callback(tx))

  return {
    db: { transaction, ...tx },
    insertedValues,
    issueUpserts,
    onConflictDoNothing,
    transaction,
    updateValues,
    values,
  }
}

describe('IngestService', () => {
  it('links inserted events to the issue id returned by raw SQL execute', async () => {
    const db = makeIngestDb()
    const queue = { add: mock(async () => undefined) }
    const service = new IngestService(db.db as never, queue as never, {} as never)

    await service.ingestEvent('project-1', {
      eventId: 'event-1',
      timestamp: Date.now(),
      level: 'error',
      message: 'boom',
      fingerprint: 'client-fp',
    })

    expect(db.insertedValues[0]).toMatchObject({ id: 'event-1', issueId: 'issue-1' })
    expect(queue.add.mock.calls[0]).toEqual([
      'check-alert',
      { projectId: 'project-1', issueId: 'issue-1' },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true, removeOnFail: false },
    ])
  })

  it('scrubs sensitive event fields before inserting events', async () => {
    const db = makeIngestDb()
    const queue = { add: mock(async () => undefined) }
    const service = new IngestService(db.db as never, queue as never, {} as never)

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

    expect(db.insertedValues[0]).toMatchObject({
      user: { id: 'user-1', password: '[Filtered]' },
      request: { headers: { authorization: '[Filtered]', userAgent: 'browser' } },
      breadcrumbs: [{ data: { token: '[Filtered]', label: 'submit' } }],
      tags: { feature: 'checkout', secret: '[Filtered]' },
    })
  })

  it('persists scrubbed runtime context for environment and device profiles', async () => {
    const db = makeIngestDb()
    const queue = { add: mock(async () => undefined) }
    const service = new IngestService(db.db as never, queue as never, {} as never)

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

    expect(db.insertedValues[0]).toMatchObject({
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
    const db = makeIngestDb()
    const queue = { add: mock(async () => undefined) }
    const service = new IngestService(db.db as never, queue as never, {} as never)

    await service.ingestEvent('project-1', {
      eventId: 'event-1',
      timestamp: Date.now(),
      level: 'error',
      message: 'boom',
      fingerprint: 'client-fp',
    })

    expect(db.updateValues).toEqual([{ eventId: 'event-1' }])
  })

  it('does not increment issues or enqueue alerts for duplicate event ids', async () => {
    const db = makeIngestDb({ existingEventId: 'event-1' })
    const queue = { add: mock(async () => undefined) }
    const service = new IngestService(db.db as never, queue as never, {} as never)

    await service.ingestEvent('project-1', {
      eventId: 'event-1',
      timestamp: Date.now(),
      level: 'error',
      message: 'boom',
      fingerprint: 'client-fp',
    })

    expect(db.issueUpserts).toHaveLength(0)
    expect(db.values).not.toHaveBeenCalled()
    expect(db.updateValues).toEqual([])
    expect(queue.add).not.toHaveBeenCalled()
  })
})
