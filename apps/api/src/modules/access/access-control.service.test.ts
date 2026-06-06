import { describe, expect, it, mock } from 'bun:test'
import { AccessControlService } from './access-control.service'

describe('AccessControlService', () => {
  it('allows access when the user has an accepted project role', async () => {
    const db = { execute: mock(async () => ({ rows: [{ role: 'viewer' }] })) }
    const service = new AccessControlService(db as never)

    await expect(service.canAccessProject('user-1', 'project-1', ['viewer', 'member'])).resolves.toBe(true)
  })

  it('allows project access through organization membership', async () => {
    const db = { execute: mock(async () => ({ rows: [{ role: 'admin' }] })) }
    const service = new AccessControlService(db as never)

    await expect(service.canAccessProject('user-1', 'project-1', ['member'])).resolves.toBe(true)
  })

  it('allows project access through a team project role', async () => {
    const db = { execute: mock(async () => ({ rows: [{ role: 'member' }] })) }
    const service = new AccessControlService(db as never)

    await expect(service.canAccessProject('user-1', 'project-1', ['viewer'])).resolves.toBe(true)
  })

  it('rejects access when roles do not satisfy the required roles', async () => {
    const db = { execute: mock(async () => ({ rows: [{ role: 'viewer' }] })) }
    const service = new AccessControlService(db as never)

    await expect(service.canAccessProject('user-1', 'project-1', ['owner', 'admin'])).resolves.toBe(false)
  })

  it('rejects project access across organizations without membership', async () => {
    const db = { execute: mock(async () => ({ rows: [] })) }
    const service = new AccessControlService(db as never)

    await expect(service.canAccessProject('user-1', 'project-1', ['viewer'])).resolves.toBe(false)
  })

  it('treats higher project roles as satisfying lower required roles', async () => {
    const db = { execute: mock(async () => ({ rows: [{ role: 'owner' }] })) }
    const service = new AccessControlService(db as never)

    await expect(service.canAccessProject('user-1', 'project-1', ['admin'])).resolves.toBe(true)
  })

  it('allows access when the raw SQL driver returns rows as an array', async () => {
    const db = { execute: mock(async () => [{ role: 'owner' }]) }
    const service = new AccessControlService(db as never)

    await expect(service.canAccessProject('user-1', 'project-1', ['owner', 'admin'])).resolves.toBe(true)
  })

  it('checks issue access through the issue project id', async () => {
    const execute = mock(async () => {
      const callNumber = execute.mock.calls.length
      if (callNumber === 1) return { rows: [{ projectId: 'project-1' }] }
      return { rows: [{ role: 'viewer' }] }
    })
    const db = { execute }
    const service = new AccessControlService(db as never)

    await expect(service.canAccessIssue('user-1', 'issue-1', ['viewer'])).resolves.toBe(true)
    expect(execute).toHaveBeenCalledTimes(2)
  })

  it('rejects issue access when the issue does not exist', async () => {
    const db = { execute: mock(async () => ({ rows: [] })) }
    const service = new AccessControlService(db as never)

    await expect(service.canAccessIssue('user-1', 'missing-issue', ['viewer'])).resolves.toBe(false)
    expect(db.execute).toHaveBeenCalledTimes(1)
  })

  it('checks event access through the event project id', async () => {
    const execute = mock(async () => {
      const callNumber = execute.mock.calls.length
      if (callNumber === 1) return { rows: [{ projectId: 'project-1' }] }
      return { rows: [{ role: 'admin' }] }
    })
    const db = { execute }
    const service = new AccessControlService(db as never)

    await expect(service.canAccessEvent('user-1', 'event-1', ['member'])).resolves.toBe(true)
    expect(execute).toHaveBeenCalledTimes(2)
  })
})
