import { describe, expect, it, mock } from 'bun:test'

mock.module('../../common/guards/session.guard', () => ({
  SessionGuard: class SessionGuard {},
}))

describe('ProjectsController audit logging', () => {
  it('records project creation and token rotation audit events', async () => {
    const project = { id: 'project-1', name: 'App' }
    const projectsService = {
      create: mock(async () => [project]),
      rotateToken: mock(async () => [project]),
    }
    const audit = { record: mock(async () => undefined) }
    const { ProjectsController } = await import('./projects.controller')
    const controller = new ProjectsController(projectsService as never, audit as never)
    const req = { session: { user: { id: 'user-1' } } }

    await controller.create({ name: 'App', slug: 'app' }, req)
    await controller.rotateToken('project-1', req)

    expect(audit.record.mock.calls).toEqual([
      [
        {
          actorUserId: 'user-1',
          projectId: 'project-1',
          action: 'project.created',
          targetType: 'project',
          targetId: 'project-1',
          metadata: { name: 'App', slug: 'app' },
        },
      ],
      [
        {
          actorUserId: 'user-1',
          projectId: 'project-1',
          action: 'project.token_rotated',
          targetType: 'project',
          targetId: 'project-1',
          metadata: null,
        },
      ],
    ])
  })
})
