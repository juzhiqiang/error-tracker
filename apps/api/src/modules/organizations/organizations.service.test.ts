import { ForbiddenException } from '@nestjs/common'
import { describe, expect, it, mock } from 'bun:test'
import { OrganizationsService } from './organizations.service'

describe('OrganizationsService', () => {
  it('lists organizations available to a user', async () => {
    const organization = { id: 'org-1', name: 'Acme', slug: 'acme', role: 'owner' }
    const db = { execute: mock(async () => ({ rows: [organization] })) }
    const service = new OrganizationsService(db as never)

    await expect(service.list('user-1')).resolves.toEqual([organization])
    expect(db.execute).toHaveBeenCalledTimes(1)
  })

  it('creates an organization and makes the creator the owner', async () => {
    const organization = { id: 'org-1', name: 'Acme', slug: 'acme' }
    const db = { execute: mock(async () => ({ rows: [organization] })) }
    const service = new OrganizationsService(db as never)

    await expect(service.create({ name: 'Acme', slug: 'acme' }, 'user-1')).resolves.toEqual(organization)
    expect(db.execute).toHaveBeenCalledTimes(1)
  })

  it('rejects team creation when the user is not an organization admin', async () => {
    const db = { execute: mock(async () => ({ rows: [{ role: 'viewer' }] })) }
    const service = new OrganizationsService(db as never)

    await expect(service.createTeam('org-1', { name: 'Frontend', slug: 'frontend' }, 'user-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    )
  })

  it('adds a team member after validating organization ownership', async () => {
    const member = { teamId: 'team-1', userId: 'user-2' }
    const execute = mock(async () => {
      const callNumber = execute.mock.calls.length
      if (callNumber === 1) return { rows: [{ role: 'admin' }] }
      if (callNumber === 2) return { rows: [member] }
      return { rows: [] }
    })
    const db = { execute }
    const service = new OrganizationsService(db as never)

    await expect(service.addTeamMember('org-1', 'team-1', { userId: 'user-2' }, 'user-1')).resolves.toEqual(member)
  })

  it('binds an organization project to a team with a project role', async () => {
    const binding = { teamId: 'team-1', projectId: 'project-1', role: 'member' }
    const execute = mock(async () => {
      const callNumber = execute.mock.calls.length
      if (callNumber === 1) return { rows: [{ role: 'owner' }] }
      if (callNumber === 2) return { rows: [binding] }
      return { rows: [] }
    })
    const db = { execute }
    const service = new OrganizationsService(db as never)

    await expect(
      service.bindTeamProject('org-1', 'team-1', { projectId: 'project-1', role: 'member' }, 'user-1'),
    ).resolves.toEqual(binding)
  })
})
