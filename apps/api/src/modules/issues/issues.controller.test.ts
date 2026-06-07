import { describe, expect, it, mock } from 'bun:test'
import { GUARDS_METADATA } from '@nestjs/common/constants'

mock.module('../../common/guards/session.guard', () => ({
  SessionGuard: class SessionGuard {},
}))

describe('IssuesController audit logging', () => {
  it('records issue status updates', async () => {
    const issue = { id: 'issue-1', projectId: 'project-1', status: 'resolved' }
    const issuesService = {
      updateStatus: mock(async () => issue),
    }
    const eventsService = {}
    const access = { canAccessIssue: mock(async () => true) }
    const audit = { record: mock(async () => undefined) }
    const { IssuesController } = await import('./issues.controller')
    const controller = new IssuesController(issuesService as never, eventsService as never, access as never, audit as never)
    const req = { session: { user: { id: 'user-1' } } }

    await controller.update('issue-1', { status: 'resolved' }, req)

    expect(audit.record.mock.calls[0]).toEqual([
      {
        actorUserId: 'user-1',
        projectId: 'project-1',
        action: 'issue.status_updated',
        targetType: 'issue',
        targetId: 'issue-1',
        metadata: { status: 'resolved' },
      },
    ])
    expect(access.canAccessIssue.mock.calls[0]).toEqual(['user-1', 'issue-1', ['owner', 'admin', 'member']])
  })

  it('records assignment and fixed release workflow updates', async () => {
    const assigned = { id: 'issue-1', projectId: 'project-1', assigneeUserId: 'user-2' }
    const fixed = { id: 'issue-1', projectId: 'project-1', fixedInRelease: 'web@2.1.0' }
    const issuesService = {
      assign: mock(async () => assigned),
      markFixed: mock(async () => fixed),
    }
    const eventsService = {}
    const access = { canAccessIssue: mock(async () => true) }
    const audit = { record: mock(async () => undefined) }
    const { IssuesController } = await import('./issues.controller')
    const controller = new IssuesController(issuesService as never, eventsService as never, access as never, audit as never)
    const req = { session: { user: { id: 'user-1' } } }

    await controller.assign('issue-1', { assigneeUserId: 'user-2' }, req)
    await controller.markFixed('issue-1', { release: 'web@2.1.0' }, req)

    expect(issuesService.assign.mock.calls[0]).toEqual(['issue-1', 'user-2', 'user-1'])
    expect(issuesService.markFixed.mock.calls[0]).toEqual(['issue-1', 'web@2.1.0', 'user-1'])
    expect(audit.record.mock.calls.map((call) => call[0].action)).toEqual([
      'issue.assigned',
      'issue.fixed_in_release',
    ])
  })

  it('exposes comments and facets after checking issue access', async () => {
    const issuesService = {
      listComments: mock(async () => [{ id: 1, body: 'note' }]),
      addComment: mock(async () => ({ id: 2, body: 'new note', projectId: 'project-1' })),
      findById: mock(async () => ({ id: 'issue-1', projectId: 'project-1' })),
      facets: mock(async () => ({ releases: [], environments: [], tags: [] })),
    }
    const eventsService = {}
    const access = { canAccessIssue: mock(async () => true) }
    const audit = { record: mock(async () => undefined) }
    const { IssuesController } = await import('./issues.controller')
    const controller = new IssuesController(issuesService as never, eventsService as never, access as never, audit as never)
    const req = { session: { user: { id: 'user-1' } } }

    await expect(controller.comments('issue-1', req)).resolves.toEqual([{ id: 1, body: 'note' }])
    await expect(controller.addComment('issue-1', { body: 'new note' }, req)).resolves.toMatchObject({ id: 2 })
    await expect(controller.facets('issue-1', req)).resolves.toEqual({ releases: [], environments: [], tags: [] })

    expect(access.canAccessIssue.mock.calls.map((call) => call[2])).toEqual([
      ['viewer'],
      ['owner', 'admin', 'member'],
      ['viewer'],
    ])
    expect(audit.record.mock.calls[0][0].action).toBe('issue.comment_added')
  })

  it('records manual merge and split actions', async () => {
    const merged = { id: 'target-1', projectId: 'project-1' }
    const split = { id: 'new-issue', projectId: 'project-1' }
    const issuesService = {
      mergeIssues: mock(async () => merged),
      splitIssue: mock(async () => split),
    }
    const eventsService = {}
    const access = { canAccessIssue: mock(async () => true) }
    const audit = { record: mock(async () => undefined) }
    const { IssuesController } = await import('./issues.controller')
    const controller = new IssuesController(issuesService as never, eventsService as never, access as never, audit as never)
    const req = { session: { user: { id: 'user-1' } } }

    await controller.merge('source-1', { targetIssueId: 'target-1' }, req)
    await controller.split('source-1', { eventIds: ['event-1'] }, req)

    expect(issuesService.mergeIssues.mock.calls[0]).toEqual(['source-1', 'target-1'])
    expect(issuesService.splitIssue.mock.calls[0]).toEqual(['source-1', ['event-1']])
    expect(audit.record.mock.calls.map((call) => call[0].action)).toEqual(['issue.merged', 'issue.split'])
  })

  it('checks issue access before returning a detail row', async () => {
    const issue = { id: 'issue-1', projectId: 'project-1' }
    const issuesService = { findById: mock(async () => issue) }
    const eventsService = {}
    const access = { canAccessIssue: mock(async () => true) }
    const audit = { record: mock(async () => undefined) }
    const { IssuesController } = await import('./issues.controller')
    const controller = new IssuesController(issuesService as never, eventsService as never, access as never, audit as never)
    const req = { session: { user: { id: 'user-1' } } }

    await expect(controller.findOne('issue-1', req)).resolves.toEqual(issue)

    expect(access.canAccessIssue.mock.calls[0]).toEqual(['user-1', 'issue-1', ['viewer']])
    expect(issuesService.findById).toHaveBeenCalledTimes(1)
  })

  it('does not read issue events when issue access is denied', async () => {
    const issuesService = {}
    const eventsService = { listByIssue: mock(async () => []) }
    const access = { canAccessIssue: mock(async () => false) }
    const audit = { record: mock(async () => undefined) }
    const { IssuesController } = await import('./issues.controller')
    const controller = new IssuesController(issuesService as never, eventsService as never, access as never, audit as never)
    const req = { session: { user: { id: 'user-1' } } }

    await expect(controller.events('issue-1', req)).rejects.toThrow('Issue access denied')
    expect(eventsService.listByIssue).not.toHaveBeenCalled()
  })

  it('runs the session guard before project access on project-scoped list', async () => {
    const { IssuesController } = await import('./issues.controller')
    const guards = Reflect.getMetadata(GUARDS_METADATA, IssuesController.prototype.list) as Array<{ name: string }>

    expect(guards.map((guard) => guard.name)).toEqual(['SessionGuard', 'ProjectAccessGuard'])
  })
})
