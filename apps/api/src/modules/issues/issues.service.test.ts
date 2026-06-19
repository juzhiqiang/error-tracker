import { describe, expect, it, mock } from 'bun:test'
import { IssuesService } from './issues.service'

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

function rows<T>(rows: T[]) {
  return { rows }
}

describe('IssuesService collaboration workflow', () => {
  it('lists only issues with real event samples and uses event-derived counters', async () => {
    const calls: string[] = []
    const responses = [
      rows([
        {
          id: 'issue-1',
          title: 'Crash',
          count: '3',
          userCount: '2',
          firstSeen: '2026-06-16T08:00:00Z',
          lastSeen: '2026-06-16T09:00:00Z',
        },
      ]),
      rows([{ total: '1' }]),
    ]
    const execute = mock(async (query: unknown) => {
      calls.push(sqlText(query))
      return responses[calls.length - 1]
    })
    const service = new IssuesService({ execute } as never)

    await expect(service.list({ projectId: 'project-1', timeRange: '30d' })).resolves.toEqual({
      rows: responses[0].rows,
      total: 1,
      page: 1,
      limit: 25,
    })

    expect(calls[0]).toContain('JOIN events')
    expect(calls[0]).toContain('count(e.id)::int as "count"')
    expect(calls[0]).toContain('max(e.timestamp) as "lastSeen"')
    expect(calls[1]).toContain('JOIN events')
    expect(calls[1]).toContain('count(DISTINCT i.id)')
  })

  it('assigns an issue and stores assignment audit fields', async () => {
    const updatedIssue = { id: 'issue-1', assigneeUserId: 'user-2', assignedByUserId: 'user-1' }
    const setValues: Record<string, unknown>[] = []
    const db = {
      update: () => ({
        set: (values: Record<string, unknown>) => {
          setValues.push(values)
          return { where: () => ({ returning: mock(async () => [updatedIssue]) }) }
        },
      }),
    }
    const service = new IssuesService(db as never)

    await expect(service.assign('issue-1', 'user-2', 'user-1')).resolves.toEqual(updatedIssue)

    expect(setValues[0]).toMatchObject({ assigneeUserId: 'user-2', assignedByUserId: 'user-1' })
    expect(setValues[0].assignedAt).toBeInstanceOf(Date)
  })

  it('marks an issue fixed in a release and resolves it', async () => {
    const updatedIssue = { id: 'issue-1', status: 'resolved', fixedInRelease: 'web@2.1.0' }
    const setValues: Record<string, unknown>[] = []
    const db = {
      update: () => ({
        set: (values: Record<string, unknown>) => {
          setValues.push(values)
          return { where: () => ({ returning: mock(async () => [updatedIssue]) }) }
        },
      }),
    }
    const service = new IssuesService(db as never)

    await expect(service.markFixed('issue-1', ' web@2.1.0 ', 'user-1')).resolves.toEqual(updatedIssue)

    expect(setValues[0]).toMatchObject({
      status: 'resolved',
      fixedInRelease: 'web@2.1.0',
      resolvedByUserId: 'user-1',
      regressedAt: null,
      regressedInRelease: null,
    })
    expect(setValues[0].resolvedAt).toBeInstanceOf(Date)
  })

  it('adds and lists issue comments with author metadata', async () => {
    const comment = {
      id: 1,
      issueId: 'issue-1',
      authorUserId: 'user-1',
      authorEmail: 'ada@example.com',
      authorName: 'Ada',
      body: 'Check release web@2.1.0',
      createdAt: new Date(),
    }
    const execute = mock(async () => rows([comment]))
    const service = new IssuesService({ execute } as never)

    await expect(service.addComment('issue-1', 'user-1', '  Check release web@2.1.0  ')).resolves.toEqual(comment)
    await expect(service.listComments('issue-1')).resolves.toEqual([comment])

    expect(sqlText(execute.mock.calls[0][0])).toContain('INSERT INTO issue_comments')
    expect(sqlText(execute.mock.calls[1][0])).toContain('FROM issue_comments')
  })

  it('merges one issue into another by moving events and returning the target issue', async () => {
    const targetIssue = { id: 'target-1', count: 4, userCount: 2, mergedIntoIssueId: null }
    const tx = { execute: mock(async () => rows([targetIssue])) }
    const db = { transaction: mock(async (callback: (tx: typeof tx) => Promise<unknown>) => callback(tx)) }
    const service = new IssuesService(db as never)

    await expect(service.mergeIssues('source-1', 'target-1')).resolves.toEqual(targetIssue)

    expect(db.transaction).toHaveBeenCalledTimes(1)
    expect(sqlText(tx.execute.mock.calls[0][0])).toContain('merged_into_issue_id')
    expect(sqlText(tx.execute.mock.calls[0][0])).toContain('UPDATE events')
  })

  it('splits selected events into a new issue', async () => {
    const newIssue = { id: 'new-issue', splitFromIssueId: 'issue-1', count: 2 }
    const tx = { execute: mock(async () => rows([newIssue])) }
    const db = { transaction: mock(async (callback: (tx: typeof tx) => Promise<unknown>) => callback(tx)) }
    const service = new IssuesService(db as never)

    await expect(service.splitIssue('issue-1', ['event-1', 'event-2'])).resolves.toEqual(newIssue)

    expect(sqlText(tx.execute.mock.calls[0][0])).toContain('split_from_issue_id')
    expect(sqlText(tx.execute.mock.calls[0][0])).toContain('UPDATE events')
  })

  it('aggregates releases, environments, and tag facets from events', async () => {
    const execute = mock(async () => {
      const call = execute.mock.calls.length
      if (call === 1) return rows([{ value: 'web@2.1.0', count: '3' }])
      if (call === 2) return rows([{ value: 'production', count: '2' }])
      return rows([{ key: 'browser.name', value: 'Chrome', count: '2' }])
    })
    const service = new IssuesService({ execute } as never)

    await expect(service.facets('issue-1')).resolves.toEqual({
      releases: [{ value: 'web@2.1.0', count: 3 }],
      environments: [{ value: 'production', count: 2 }],
      tags: [{ key: 'browser.name', value: 'Chrome', count: 2 }],
    })
  })
})
