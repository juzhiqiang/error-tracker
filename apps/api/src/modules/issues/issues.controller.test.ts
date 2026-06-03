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
    const audit = { record: mock(async () => undefined) }
    const { IssuesController } = await import('./issues.controller')
    const controller = new IssuesController(issuesService as never, eventsService as never, audit as never)
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
  })

  it('runs the session guard before project access on project-scoped list', async () => {
    const { IssuesController } = await import('./issues.controller')
    const guards = Reflect.getMetadata(GUARDS_METADATA, IssuesController.prototype.list) as Array<{ name: string }>

    expect(guards.map((guard) => guard.name)).toEqual(['SessionGuard', 'ProjectAccessGuard'])
  })
})
