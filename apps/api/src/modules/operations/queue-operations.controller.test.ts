import { describe, expect, it, mock } from 'bun:test'
import { GUARDS_METADATA } from '@nestjs/common/constants'
import { PROJECT_ROLES_KEY } from '../access/project-roles.decorator'

mock.module('../../common/guards/session.guard', () => ({
  SessionGuard: class SessionGuard {},
}))

mock.module('../access/project-access.guard', () => ({
  ProjectAccessGuard: class ProjectAccessGuard {},
}))

describe('QueueOperationsController', () => {
  it('uses session and project owner/admin guards', async () => {
    const { QueueOperationsController } = await import('./queue-operations.controller')
    const guards = Reflect.getMetadata(GUARDS_METADATA, QueueOperationsController) as Array<{ name: string }>
    const roles = Reflect.getMetadata(PROJECT_ROLES_KEY, QueueOperationsController)

    expect(guards.map((guard) => guard.name)).toEqual(['SessionGuard', 'ProjectAccessGuard'])
    expect(roles).toEqual(['owner', 'admin'])
  })

  it('passes queue actions to the service', async () => {
    const service = {
      list: mock(async () => ({ events: { counts: {}, failedJobs: [] }, cleanup: { counts: {}, failedJobs: [] } })),
      retry: mock(async () => ({ ok: true })),
      remove: mock(async () => ({ ok: true })),
    }
    const { QueueOperationsController } = await import('./queue-operations.controller')
    const controller = new QueueOperationsController(service as never)

    await controller.list('project-1')
    await controller.retry('project-1', 'events', 'job-1')
    await controller.remove('project-1', 'cleanup', 'job-2')

    expect(service.list).toHaveBeenCalled()
    expect(service.retry.mock.calls[0]).toEqual(['events', 'job-1'])
    expect(service.remove.mock.calls[0]).toEqual(['cleanup', 'job-2'])
  })
})
