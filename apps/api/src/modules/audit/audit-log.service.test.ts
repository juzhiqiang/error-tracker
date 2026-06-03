import { describe, expect, it, mock } from 'bun:test'
import { AuditLogService } from './audit-log.service'

describe('AuditLogService', () => {
  it('records audit events with actor, target, and metadata', async () => {
    const insertedValues: unknown[] = []
    const db = {
      insert: () => ({
        values: mock(async (value: unknown) => {
          insertedValues.push(value)
        }),
      }),
    }
    const service = new AuditLogService(db as never)

    await service.record({
      actorUserId: 'user-1',
      projectId: 'project-1',
      action: 'project.token_rotated',
      targetType: 'project',
      targetId: 'project-1',
      metadata: { reason: 'leaked' },
    })

    expect(insertedValues[0]).toEqual({
      actorUserId: 'user-1',
      projectId: 'project-1',
      action: 'project.token_rotated',
      targetType: 'project',
      targetId: 'project-1',
      metadata: { reason: 'leaked' },
    })
  })

  it('lists audit events for a project ordered by newest first', async () => {
    const rows = [{ id: 1, action: 'issue.status_updated' }]
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => rows,
            }),
          }),
        }),
      }),
    }
    const service = new AuditLogService(db as never)

    await expect(service.listByProject('project-1')).resolves.toEqual(rows)
  })
})
