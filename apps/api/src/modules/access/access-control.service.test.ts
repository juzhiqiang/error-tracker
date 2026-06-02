import { describe, expect, it, mock } from 'bun:test'
import { AccessControlService } from './access-control.service'

describe('AccessControlService', () => {
  it('allows access when the user has an accepted project role', async () => {
    const db = { execute: mock(async () => ({ rows: [{ role: 'viewer' }] })) }
    const service = new AccessControlService(db as never)

    await expect(service.canAccessProject('user-1', 'project-1', ['viewer', 'member'])).resolves.toBe(true)
  })

  it('rejects access when roles do not satisfy the required roles', async () => {
    const db = { execute: mock(async () => ({ rows: [{ role: 'viewer' }] })) }
    const service = new AccessControlService(db as never)

    await expect(service.canAccessProject('user-1', 'project-1', ['owner', 'admin'])).resolves.toBe(false)
  })
})
