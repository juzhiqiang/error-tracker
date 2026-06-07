import { describe, expect, it, mock } from 'bun:test'
import { GUARDS_METADATA } from '@nestjs/common/constants'

mock.module('../../common/guards/session.guard', () => ({
  SessionGuard: class SessionGuard {},
}))

describe('ProjectsController audit logging', () => {
  it('passes the session user id when listing projects', async () => {
    const projectsService = {
      list: mock(async () => []),
      create: mock(async () => []),
      rotateToken: mock(async () => []),
    }
    const audit = { record: mock(async () => undefined) }
    const { ProjectsController } = await import('./projects.controller')
    const controller = new ProjectsController(projectsService as never, audit as never)

    await controller.list({ session: { user: { id: 'user-1' } } })

    expect(projectsService.list.mock.calls[0]).toEqual(['user-1'])
  })

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

  it('records alert setting updates for webhook delivery changes', async () => {
    const project = { id: 'project-1', webhookUrl: 'https://hook.local', alertThreshold: 20, alertUserThreshold: 5 }
    const projectsService = {
      updateAlertSettings: mock(async () => [project]),
    }
    const audit = { record: mock(async () => undefined) }
    const { ProjectsController } = await import('./projects.controller')
    const controller = new ProjectsController(projectsService as never, audit as never)
    const req = { session: { user: { id: 'user-1' } } }

    await controller.updateAlertSettings(
      'project-1',
      { webhookUrl: 'https://hook.local', alertThreshold: 20, alertUserThreshold: 5 },
      req,
    )

    expect(projectsService.updateAlertSettings.mock.calls[0]).toEqual([
      'project-1',
      { webhookUrl: 'https://hook.local', alertThreshold: 20, alertUserThreshold: 5 },
    ])
    expect(audit.record.mock.calls[0]).toEqual([
      {
        actorUserId: 'user-1',
        projectId: 'project-1',
        action: 'project.alert_settings_updated',
        targetType: 'project',
        targetId: 'project-1',
        metadata: { hasWebhook: true, alertThreshold: 20, alertUserThreshold: 5 },
      },
    ])
  })

  it('runs the session guard before project access on token rotation', async () => {
    const { ProjectsController } = await import('./projects.controller')
    const guards = Reflect.getMetadata(GUARDS_METADATA, ProjectsController.prototype.rotateToken) as Array<{
      name: string
    }>

    expect(guards.map((guard) => guard.name)).toEqual(['SessionGuard', 'ProjectAccessGuard'])
  })
})
