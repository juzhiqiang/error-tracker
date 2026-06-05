import { describe, expect, it, mock } from 'bun:test'
import { ProjectInvitationsService } from './project-invitations.service'

const now = new Date('2026-06-05T00:00:00Z')
const createdAt = new Date('2026-06-05T00:00:00Z')
const expiresAt = new Date('2026-06-12T00:00:00Z')

function serviceWith(db: { execute: ReturnType<typeof mock> }) {
  return new ProjectInvitationsService(db as never, {
    appBaseUrl: 'http://localhost:3003',
    now: () => now,
    tokenFactory: () => 'raw-invite-token',
  })
}

describe('ProjectInvitationsService', () => {
  it('creates a pending invitation with a one-time token link', async () => {
    const row = {
      id: 'invite-1',
      projectId: 'project-1',
      projectName: 'Checkout Web',
      email: 'teammate@example.com',
      role: 'member',
      status: 'pending',
      invitedByUserId: 'owner-1',
      expiresAt,
      createdAt,
    }
    let calls = 0
    const db = {
      execute: mock(async () => ({ rows: ++calls === 2 ? [row] : [] })),
    }
    const service = serviceWith(db)

    const result = await service.create({
      projectId: 'project-1',
      email: ' Teammate@Example.com ',
      role: 'member',
      invitedByUserId: 'owner-1',
    })

    expect(result).toEqual({
      ...row,
      inviteToken: 'raw-invite-token',
      inviteUrl: 'http://localhost:3003/accept-invite/raw-invite-token',
    })
    expect(db.execute).toHaveBeenCalledTimes(2)
  })

  it('lists project invitations without exposing invite tokens', async () => {
    const row = {
      id: 'invite-1',
      projectId: 'project-1',
      projectName: 'Checkout Web',
      email: 'teammate@example.com',
      role: 'viewer',
      status: 'pending',
      invitedByUserId: 'owner-1',
      inviterEmail: 'owner@example.com',
      expiresAt,
      createdAt,
    }
    const db = { execute: mock(async () => ({ rows: [row] })) }
    const service = serviceWith(db)

    await expect(service.list('project-1')).resolves.toEqual([row])
  })

  it('accepts a pending invitation for the matching signed-in email', async () => {
    const pending = {
      id: 'invite-1',
      projectId: 'project-1',
      projectName: 'Checkout Web',
      email: 'teammate@example.com',
      role: 'admin',
      status: 'pending',
      expiresAt,
      createdAt,
    }
    const accepted = { ...pending, status: 'accepted', acceptedByUserId: 'user-2' }
    let calls = 0
    const db = {
      execute: mock(async () => ({ rows: ++calls === 1 ? [pending] : [accepted] })),
    }
    const service = serviceWith(db)

    await expect(service.accept('raw-invite-token', { userId: 'user-2', email: 'Teammate@Example.com' })).resolves.toEqual({
      outcome: 'accepted',
      invitation: accepted,
    })
    expect(db.execute).toHaveBeenCalledTimes(2)
  })

  it('does not accept an invitation for a different signed-in email', async () => {
    const pending = {
      id: 'invite-1',
      projectId: 'project-1',
      projectName: 'Checkout Web',
      email: 'teammate@example.com',
      role: 'member',
      status: 'pending',
      expiresAt,
      createdAt,
    }
    const db = { execute: mock(async () => ({ rows: [pending] })) }
    const service = serviceWith(db)

    await expect(service.accept('raw-invite-token', { userId: 'user-2', email: 'other@example.com' })).resolves.toEqual({
      outcome: 'email_mismatch',
      invitation: pending,
    })
    expect(db.execute).toHaveBeenCalledTimes(1)
  })

  it('marks expired pending invitations before rejecting acceptance', async () => {
    const expired = {
      id: 'invite-1',
      projectId: 'project-1',
      projectName: 'Checkout Web',
      email: 'teammate@example.com',
      role: 'member',
      status: 'pending',
      expiresAt: new Date('2026-06-01T00:00:00Z'),
      createdAt,
    }
    let calls = 0
    const db = {
      execute: mock(async () => ({ rows: ++calls === 1 ? [expired] : [] })),
    }
    const service = serviceWith(db)

    await expect(service.accept('raw-invite-token', { userId: 'user-2', email: 'teammate@example.com' })).resolves.toEqual({
      outcome: 'expired',
      invitation: { ...expired, status: 'expired' },
    })
    expect(db.execute).toHaveBeenCalledTimes(2)
  })

  it('resends a pending invitation with a fresh token link', async () => {
    const row = {
      id: 'invite-1',
      projectId: 'project-1',
      projectName: 'Checkout Web',
      email: 'teammate@example.com',
      role: 'viewer',
      status: 'pending',
      invitedByUserId: 'owner-1',
      expiresAt,
      createdAt,
    }
    const db = { execute: mock(async () => ({ rows: [row] })) }
    const service = serviceWith(db)

    await expect(service.resend('project-1', 'invite-1')).resolves.toEqual({
      ...row,
      inviteToken: 'raw-invite-token',
      inviteUrl: 'http://localhost:3003/accept-invite/raw-invite-token',
    })
  })

  it('serializes invitation expiry values before raw SQL execution', async () => {
    const row = {
      id: 'invite-1',
      projectId: 'project-1',
      projectName: 'Checkout Web',
      email: 'teammate@example.com',
      role: 'member',
      status: 'pending',
      invitedByUserId: 'owner-1',
      expiresAt,
      createdAt,
    }
    let calls = 0
    const db = {
      execute: mock(async (query) => {
        expect(containsDate(query)).toBe(false)
        return { rows: ++calls === 2 ? [row] : [] }
      }),
    }
    const service = serviceWith(db)

    await service.create({ projectId: 'project-1', email: 'teammate@example.com', role: 'member', invitedByUserId: 'owner-1' })
  })
})

function containsDate(value: unknown, seen = new Set<unknown>()): boolean {
  if (value instanceof Date) return true
  if (!value || typeof value !== 'object') return false
  if (seen.has(value)) return false
  seen.add(value)
  return Object.values(value).some((item) => containsDate(item, seen))
}
