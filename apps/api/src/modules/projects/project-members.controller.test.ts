import { describe, expect, it, mock } from 'bun:test'
import { GUARDS_METADATA } from '@nestjs/common/constants'

mock.module('../../common/guards/session.guard', () => ({
  SessionGuard: class SessionGuard {},
}))

mock.module('../access/project-access.guard', () => ({
  ProjectAccessGuard: class ProjectAccessGuard {},
}))

describe('ProjectMembersController', () => {
  it('records audit events for invite, role update, and removal', async () => {
    const member = { userId: 'user-2', email: 'bob@example.com', role: 'member' }
    const service = {
      list: mock(async () => []),
      addByEmail: mock(async () => member),
      updateRole: mock(async () => ({ ...member, role: 'admin' })),
      remove: mock(async () => undefined),
    }
    const audit = { record: mock(async () => undefined) }
    const { ProjectMembersController } = await import('./project-members.controller')
    const controller = new ProjectMembersController(service as never, audit as never)
    const req = { session: { user: { id: 'user-1' } } }

    await controller.add('project-1', { email: 'bob@example.com', role: 'member' }, req)
    await controller.updateRole('project-1', 'user-2', { role: 'admin' }, req)
    await controller.remove('project-1', 'user-2', req)

    expect(audit.record.mock.calls.map((call) => call[0].action)).toEqual([
      'project.member_added',
      'project.member_role_updated',
      'project.member_removed',
    ])
  })

  it('uses session and project access guards for member listing', async () => {
    const { ProjectMembersController } = await import('./project-members.controller')
    const guards = Reflect.getMetadata(GUARDS_METADATA, ProjectMembersController) as Array<{ name: string }>

    expect(guards.map((guard) => guard.name)).toEqual(['SessionGuard', 'ProjectAccessGuard'])
  })
})
