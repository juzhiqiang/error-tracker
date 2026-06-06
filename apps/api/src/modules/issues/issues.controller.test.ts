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
