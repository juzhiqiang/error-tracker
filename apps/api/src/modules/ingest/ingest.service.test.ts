import { describe, expect, it, mock } from 'bun:test'
import { createHash } from 'crypto'
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

function makeIngestDb(options: { existingEventId?: string; issueId?: string; issueUserInserted?: boolean } = {}) {
  const insertedValues: unknown[] = []
  const issueUserValues: unknown[] = []
  const updateValues: unknown[] = []
  const issueUpserts: unknown[] = []
  const userCountUpdates: unknown[] = []
  const issueUserReturning = mock(async () => (options.issueUserInserted === false ? [] : [{ id: 1 }]))
  const onConflictDoNothing = mock(() => ({ returning: issueUserReturning }))
  const values = mock((value: unknown) => {
    if (isIssueUserValue(value)) {
      issueUserValues.push(value)
    } else {
      insertedValues.push(value)
    }
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
        if (isUserCountUpdate(value)) {
          userCountUpdates.push(value)
        } else {
          updateValues.push(value)
        }
        return { where: mock(async () => undefined) }
      }),
    })),
  }
  const transaction = mock(async (callback: (tx: typeof tx) => Promise<unknown>) => callback(tx))

  return {
    db: { transaction, ...tx },
    insertedValues,
    issueUpserts,
    issueUserReturning,
    issueUserValues,
    onConflictDoNothing,
    transaction,
    updateValues,
    userCountUpdates,
    values,
  }
}

function isIssueUserValue(value: unknown): value is { issueId: string; userHash: string } {
  return Boolean(value && typeof value === 'object' && 'issueId' in value && 'userHash' in value)
}

function isUserCountUpdate(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && 'userCount' in value)
}

function hashIssueUserKey(issueId: string, userKey: string): string {
  return createHash('md5').update(`${issueId}:${userKey}`).digest('hex')
}

function issueFingerprint(query: unknown): string | undefined {
  return sqlText(query).match(/VALUES \(project-1, ([a-f0-9]+)/)?.[1]
}

describe('IngestService', () => {
  it('enqueues validated ingest batches for async processing', async () => {
    const ingestQueue = { add: mock(async () => undefined) }
    const service = new IngestService({} as never, { add: mock(async () => undefined) } as never, {} as never, ingestQueue as never)
    const event = {
      eventId: 'event-1',
      timestamp: Date.now(),
      level: 'error',
      message: 'boom',
      fingerprint: 'client-fp',
    }

    await service.enqueueBatch('project-1', [event])

    expect(ingestQueue.add.mock.calls[0][0]).toBe('ingest-batch')
    expect(ingestQueue.add.mock.calls[0][1]).toEqual({ projectId: 'project-1', events: [event] })
  })

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

  it('scrubs sensitive message and stacktrace values before inserting events', async () => {
    const db = makeIngestDb()
    const queue = { add: mock(async () => undefined) }
    const service = new IngestService(db.db as never, queue as never, {} as never)

    await service.ingestEvent('project-1', {
      eventId: 'event-1',
      timestamp: Date.now(),
      level: 'error',
      message: 'Payment failed for ada@example.com with Bearer abc.def.ghi',
      fingerprint: 'client-fp',
      stacktrace: [{ function: 'pay', filename: '/users/ada@example.com/app.ts', lineno: 1 }],
    })

    expect(db.insertedValues[0]).toMatchObject({
      message: 'Payment failed for [Email] with [BearerToken]',
      stacktrace: [{ function: 'pay', filename: '/users/[Email]/app.ts', lineno: 1 }],
    })
  })

  it('uses scrubbed messages as issue titles', async () => {
    const db = makeIngestDb()
    const queue = { add: mock(async () => undefined) }
    const service = new IngestService(db.db as never, queue as never, {} as never)

    await service.ingestEvent('project-1', {
      eventId: 'event-1',
      timestamp: Date.now(),
      level: 'error',
      message: 'Failure for ada@example.com',
      fingerprint: 'client-fp',
    })

    expect(sqlText(db.issueUpserts[0])).toContain('Failure for [Email]')
  })

  it('marks resolved issues as regressed when a new event is grouped into them', async () => {
    const db = makeIngestDb()
    const queue = { add: mock(async () => undefined) }
    const service = new IngestService(db.db as never, queue as never, {} as never)

    await service.ingestEvent('project-1', {
      eventId: 'event-1',
      timestamp: Date.now(),
      level: 'error',
      message: 'boom',
      fingerprint: 'client-fp',
      release: 'web@3.0.0',
    })

    const upsertSql = sqlText(db.issueUpserts[0])
    expect(upsertSql).toContain("status = CASE WHEN issues.status = 'resolved' THEN 'unresolved' ELSE issues.status END")
    expect(upsertSql).toContain('regressed_at = CASE WHEN issues.status =')
    expect(upsertSql).toContain('regressed_in_release = CASE WHEN issues.status =')
    expect(upsertSql).toContain('web@3.0.0')
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

  it('does not increment userCount in the event count upsert', async () => {
    const db = makeIngestDb()
    const queue = { add: mock(async () => undefined) }
    const service = new IngestService(db.db as never, queue as never, {} as never)

    await service.ingestEvent('project-1', {
      eventId: 'event-1',
      timestamp: Date.now(),
      level: 'error',
      message: 'boom',
      fingerprint: 'client-fp',
      user: { id: 'user-1' },
    })

    expect(sqlText(db.issueUpserts[0])).not.toContain('user_count = issues.user_count + 1')
  })

  it('tracks first seen users per issue with a hashed identity', async () => {
    const db = makeIngestDb()
    const queue = { add: mock(async () => undefined) }
    const service = new IngestService(db.db as never, queue as never, {} as never)

    await service.ingestEvent('project-1', {
      eventId: 'event-1',
      timestamp: Date.now(),
      level: 'error',
      message: 'boom',
      fingerprint: 'client-fp',
      user: { id: 'user-1', email: 'ada@example.com' },
    })

    expect(db.issueUserValues[0]).toEqual({ issueId: 'issue-1', userHash: hashIssueUserKey('issue-1', 'id:user-1') })
    expect(db.issueUserReturning).toHaveBeenCalledTimes(1)
    expect(db.userCountUpdates).toHaveLength(1)
  })

  it('does not increment userCount when the issue user already exists', async () => {
    const db = makeIngestDb({ issueUserInserted: false })
    const queue = { add: mock(async () => undefined) }
    const service = new IngestService(db.db as never, queue as never, {} as never)

    await service.ingestEvent('project-1', {
      eventId: 'event-1',
      timestamp: Date.now(),
      level: 'error',
      message: 'boom',
      fingerprint: 'client-fp',
      user: { id: 'user-1' },
    })

    expect(db.issueUserValues[0]).toEqual({ issueId: 'issue-1', userHash: hashIssueUserKey('issue-1', 'id:user-1') })
    expect(db.issueUserReturning).toHaveBeenCalledTimes(1)
    expect(db.userCountUpdates).toHaveLength(0)
  })

  it('normalizes dynamic message values in stack-based server fingerprints', async () => {
    const firstDb = makeIngestDb({ issueId: 'issue-1' })
    const secondDb = makeIngestDb({ issueId: 'issue-2' })
    const queue = { add: mock(async () => undefined) }
    const firstService = new IngestService(firstDb.db as never, queue as never, {} as never)
    const secondService = new IngestService(secondDb.db as never, queue as never, {} as never)
    const stacktrace = [{ function: 'submitOrder', filename: '/app/src/checkout.ts', lineno: 42, colno: 7 }]

    await firstService.ingestEvent('project-1', {
      eventId: 'event-1',
      timestamp: Date.now(),
      level: 'error',
      message: 'Checkout failed for order 123 user 550e8400-e29b-41d4-a716-446655440000',
      fingerprint: 'client-fp',
      stacktrace,
    })
    await secondService.ingestEvent('project-1', {
      eventId: 'event-2',
      timestamp: Date.now(),
      level: 'error',
      message: 'Checkout failed for order 456 user 550e8400-e29b-41d4-a716-446655440999',
      fingerprint: 'client-fp',
      stacktrace,
    })

    expect(issueFingerprint(firstDb.issueUpserts[0])).toBe(issueFingerprint(secondDb.issueUpserts[0]))
  })

  it('persists event correlation fields for device and session drilldown', async () => {
    const db = makeIngestDb()
    const queue = { add: mock(async () => undefined) }
    const service = new IngestService(db.db as never, queue as never, {} as never)

    await service.ingestEvent('project-1', {
      eventId: 'event-1',
      timestamp: Date.now(),
      level: 'error',
      message: 'boom',
      fingerprint: 'client-fp',
      sessionId: 'session-1',
      deviceId: 'device-1',
      pageUrl: 'https://app.example.com/orders/123?token=secret',
      route: '/orders/[id]',
      user: { id: 'user-1' },
    } as never)

    expect(db.insertedValues[0]).toMatchObject({
      sessionId: 'session-1',
      deviceId: 'device-1',
      userId: 'user-1',
      pageUrl: 'https://app.example.com/orders/123?token=[Filtered]',
      route: '/orders/[id]',
    })
  })

  it('stores expanded performance metrics with telemetry fields', async () => {
    const insertedValues: unknown[] = []
    const db = {
      insert: mock(() => ({
        values: mock(async (rows: unknown[]) => {
          insertedValues.push(...rows)
        }),
      })),
    }
    const service = new IngestService(db as never, {} as never, {} as never)

    await service.ingestPerformance('project-1', [
      {
        eventId: 'resource-1',
        type: 'performance',
        kind: 'resource',
        name: 'resource',
        value: 42.2,
        duration: 42.2,
        url: 'https://cdn.example.com/app.js',
        initiatorType: 'script',
        timestamp: 1_700_000_000_000,
      } as never,
    ])

    expect(insertedValues[0]).toMatchObject({
      projectId: 'project-1',
      kind: 'resource',
      name: 'resource',
      value: 42.2,
      duration: 42,
      url: 'https://cdn.example.com/app.js',
      initiatorType: 'script',
    })
  })

  it('stores performance correlation fields for device and session drilldown', async () => {
    const insertedValues: unknown[] = []
    const db = {
      insert: mock(() => ({
        values: mock(async (rows: unknown[]) => {
          insertedValues.push(...rows)
        }),
      })),
    }
    const service = new IngestService(db as never, {} as never, {} as never)

    await service.ingestPerformance('project-1', [
      {
        eventId: 'lcp-1',
        type: 'performance',
        kind: 'web-vital',
        name: 'LCP',
        value: 3200,
        rating: 'needs-improvement',
        timestamp: 1_700_000_000_000,
        sessionId: 'session-1',
        deviceId: 'device-1',
        userId: 'user-1',
        pageUrl: 'https://app.example.com/orders/123?token=secret',
        route: '/orders/[id]',
      } as never,
    ])

    expect(insertedValues[0]).toMatchObject({
      sessionId: 'session-1',
      deviceId: 'device-1',
      userId: 'user-1',
      pageUrl: 'https://app.example.com/orders/123?token=[Filtered]',
      route: '/orders/[id]',
    })
  })

  it('preserves fractional web vital values such as CLS', async () => {
    const insertedValues: unknown[] = []
    const db = {
      insert: mock(() => ({
        values: mock(async (rows: unknown[]) => {
          insertedValues.push(...rows)
        }),
      })),
    }
    const service = new IngestService(db as never, {} as never, {} as never)

    await service.ingestPerformance('project-1', [
      {
        eventId: 'cls-1',
        type: 'performance',
        kind: 'web-vital',
        name: 'CLS',
        value: 0.12,
        rating: 'needs-improvement',
        timestamp: 1_700_000_000_000,
      } as never,
    ])

    expect(insertedValues[0]).toMatchObject({
      projectId: 'project-1',
      kind: 'web-vital',
      name: 'CLS',
      value: 0.12,
      rating: 'needs-improvement',
    })
  })
})
