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
    const db = { execute: mock(async () => ({ rows })) }
    const service = new AuditLogService(db as never)

    await expect(service.listByProject('project-1')).resolves.toEqual(rows)
  })

  it('lists audit events with filter parameters', async () => {
    const rows = [{ action: 'project.created' }]
    const executedQueries: unknown[] = []
    const db = {
      execute: mock(async (query: unknown) => {
        executedQueries.push(query)
        return { rows }
      }),
    }
    const service = new AuditLogService(db as never)

    await expect(
      service.list({
        projectId: 'project-1',
        actorUserId: 'user-1',
        action: 'project.created',
        targetType: 'project',
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-06T00:00:00.000Z',
      }),
    ).resolves.toEqual(rows)

    expect(extractSqlParamValues(executedQueries[0])).toEqual(
      expect.arrayContaining([
        'project-1',
        'user-1',
        'project.created',
        'project',
        '2026-06-01T00:00:00.000Z',
        '2026-06-06T00:00:00.000Z',
      ]),
    )
  })

  it('exports audit rows as csv with escaped metadata', () => {
    const csv = AuditLogService.toCsv([
      {
        createdAt: '2026-06-06T00:00:00.000Z',
        actorUserId: 'user "1"',
        projectId: 'project-1',
        action: 'project.created',
        targetType: 'project',
        targetId: 'project-1',
        metadata: { name: 'App "Core"' },
      },
    ])

    expect(csv).toContain('createdAt,actorUserId,projectId,action,targetType,targetId,metadata')
    expect(csv).toContain('"project.created"')
    expect(csv).toContain('"user ""1"""')
    expect(csv).toContain('""name""')
  })
})

function extractSqlParamValues(value: unknown): unknown[] {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return [value]
  if (!value || typeof value !== 'object') return []
  const record = value as { value?: unknown; queryChunks?: unknown[] }
  const ownValue = Object.prototype.hasOwnProperty.call(record, 'value') ? record.value : undefined
  const values = ownValue === undefined || Array.isArray(ownValue) ? [] : [ownValue]
  return values.concat((record.queryChunks ?? []).flatMap((chunk) => extractSqlParamValues(chunk)))
}
