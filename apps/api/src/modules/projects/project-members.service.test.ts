import { describe, expect, it, mock } from 'bun:test'
import { ProjectMembersService } from './project-members.service'

describe('ProjectMembersService', () => {
  it('lists project members with user profile fields', async () => {
    const member = {
      userId: 'user-1',
      email: 'alice@example.com',
      name: 'Alice',
      role: 'owner',
      createdAt: new Date('2026-06-04T00:00:00Z'),
    }
    const db = { execute: mock(async () => ({ rows: [member] })) }
    const service = new ProjectMembersService(db as never)

    await expect(service.list('project-1')).resolves.toEqual([member])
    expect(db.execute).toHaveBeenCalledTimes(1)
  })

  it('adds an existing user by email and returns the member row', async () => {
    const member = {
      userId: 'user-2',
      email: 'bob@example.com',
      name: 'Bob',
      role: 'member',
      createdAt: new Date('2026-06-04T00:00:00Z'),
    }
    const db = { execute: mock(async () => ({ rows: [member] })) }
    const service = new ProjectMembersService(db as never)

    await expect(service.addByEmail('project-1', 'bob@example.com', 'member')).resolves.toEqual(member)
  })

  it('returns null when inviting an email without a matching account', async () => {
    const db = { execute: mock(async () => ({ rows: [] })) }
    const service = new ProjectMembersService(db as never)

    await expect(service.addByEmail('project-1', 'missing@example.com', 'viewer')).resolves.toBeNull()
  })

  it('updates a member role', async () => {
    const member = {
      userId: 'user-2',
      email: 'bob@example.com',
      name: 'Bob',
      role: 'admin',
      createdAt: new Date('2026-06-04T00:00:00Z'),
    }
    const db = { execute: mock(async () => ({ rows: [member] })) }
    const service = new ProjectMembersService(db as never)

    await expect(service.updateRole('project-1', 'user-2', 'admin')).resolves.toEqual(member)
  })

  it('removes a project member', async () => {
    const db = { execute: mock(async () => ({ rows: [] })) }
    const service = new ProjectMembersService(db as never)

    await service.remove('project-1', 'user-2')

    expect(db.execute).toHaveBeenCalledTimes(1)
  })
})
