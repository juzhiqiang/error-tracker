import { describe, expect, it, mock } from 'bun:test'

mock.module('../../common/guards/session.guard', () => ({
  SessionGuard: class SessionGuard {},
}))

describe('AuditLogController', () => {
  it('passes audit log filters to the service', async () => {
    const rows = [{ action: 'project.created' }]
    const service = { list: mock(async () => rows) }
    const { AuditLogController } = await import('./audit-log.controller')
    const controller = new AuditLogController(service as never)
    const query = {
      projectId: 'project-1',
      actorUserId: 'user-1',
      action: 'project.created',
      targetType: 'project',
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-06T00:00:00.000Z',
    }

    await expect(controller.list(query)).resolves.toEqual(rows)
    expect(service.list.mock.calls[0]).toEqual([query])
  })

  it('exports filtered audit logs as csv', async () => {
    const rows = [
      {
        createdAt: '2026-06-06T00:00:00.000Z',
        actorUserId: 'user-1',
        projectId: 'project-1',
        action: 'project.created',
        targetType: 'project',
        targetId: 'project-1',
        metadata: { name: 'App' },
      },
    ]
    const service = { list: mock(async () => rows) }
    const { AuditLogController } = await import('./audit-log.controller')
    const controller = new AuditLogController(service as never)
    const query = { projectId: 'project-1', action: 'project.created' }

    await expect(controller.exportCsv(query)).resolves.toContain('createdAt,actorUserId,projectId')
    expect(service.list.mock.calls[0]).toEqual([query])
  })
})
