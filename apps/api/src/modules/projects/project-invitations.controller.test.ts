import { describe, expect, it, mock } from 'bun:test'
import { GUARDS_METADATA } from '@nestjs/common/constants'
import { PROJECT_ROLES_KEY } from '../access/project-roles.decorator'

mock.module('../../common/guards/session.guard', () => ({
  SessionGuard: class SessionGuard {},
}))

mock.module('../access/project-access.guard', () => ({
  ProjectAccessGuard: class ProjectAccessGuard {},
}))

describe('ProjectInvitationsController', () => {
  it('records audit events for invitation lifecycle changes', async () => {
    const invitation = {
      id: 'invite-1',
      projectId: 'project-1',
      email: 'teammate@example.com',
      role: 'member',
      status: 'pending',
      inviteUrl: 'http://localhost:3003/accept-invite/raw-token',
    }
    const service = {
      list: mock(async () => []),
      create: mock(async () => invitation),
      resend: mock(async () => invitation),
      revoke: mock(async () => ({ ok: true })),
      detail: mock(async () => invitation),
      accept: mock(async () => ({ outcome: 'accepted', invitation: { ...invitation, status: 'accepted' } })),
    }
    const email = { sendProjectInvitation: mock(async () => ({ status: 'sent', messageId: 'smtp-message-1' })) }
    const audit = { record: mock(async () => undefined) }
    const { ProjectInvitationsController } = await import('./project-invitations.controller')
    const controller = new ProjectInvitationsController(service as never, audit as never, email as never)
    const ownerReq = { session: { user: { id: 'owner-1', email: 'owner@example.com' } } }
    const invitedReq = { session: { user: { id: 'user-2', email: 'teammate@example.com' } } }

    const created = await controller.create('project-1', { email: 'teammate@example.com', role: 'member' }, ownerReq)
    const resent = await controller.resend('project-1', 'invite-1', ownerReq)
    await controller.revoke('project-1', 'invite-1', ownerReq)
    await controller.accept('raw-token', invitedReq)

    expect(created).toEqual({ ...invitation, emailDelivery: { status: 'sent', messageId: 'smtp-message-1' } })
    expect(resent).toEqual({ ...invitation, emailDelivery: { status: 'sent', messageId: 'smtp-message-1' } })
    expect(email.sendProjectInvitation).toHaveBeenCalledTimes(2)
    expect(email.sendProjectInvitation.mock.calls[0]).toEqual([invitation, { invitedByEmail: 'owner@example.com' }])
    expect(email.sendProjectInvitation.mock.calls[1]).toEqual([invitation, { invitedByEmail: 'owner@example.com' }])
    expect(audit.record.mock.calls.map((call) => call[0].action)).toEqual([
      'project.invitation_created',
      'project.invitation_resent',
      'project.invitation_revoked',
      'project.invitation_accepted',
    ])
    expect(service.create).toHaveBeenCalledWith({
      projectId: 'project-1',
      email: 'teammate@example.com',
      role: 'member',
      invitedByUserId: 'owner-1',
    })
    const createMetadata = audit.record.mock.calls[0][0].metadata as Record<string, unknown>
    const resendMetadata = audit.record.mock.calls[1][0].metadata as Record<string, unknown>
    expect(createMetadata.emailDeliveryStatus).toBe('sent')
    expect(resendMetadata.emailDeliveryStatus).toBe('sent')
    expect('inviteUrl' in createMetadata).toBe(false)
    expect('inviteToken' in createMetadata).toBe(false)
  })

  it('uses project guards for admin invitation routes and only session guard for accepting', async () => {
    const { ProjectInvitationsController } = await import('./project-invitations.controller')

    expect(guardNames(ProjectInvitationsController.prototype.list)).toEqual(['SessionGuard', 'ProjectAccessGuard'])
    expect(guardNames(ProjectInvitationsController.prototype.create)).toEqual(['SessionGuard', 'ProjectAccessGuard'])
    expect(guardNames(ProjectInvitationsController.prototype.accept)).toEqual(['SessionGuard'])
  })

  it('allows every project member to read invitations while keeping mutations admin-only', async () => {
    const { ProjectInvitationsController } = await import('./project-invitations.controller')

    expect(Reflect.getMetadata(PROJECT_ROLES_KEY, ProjectInvitationsController.prototype.list)).toBeUndefined()
    expect(Reflect.getMetadata(PROJECT_ROLES_KEY, ProjectInvitationsController.prototype.create)).toEqual(['owner', 'admin'])
    expect(Reflect.getMetadata(PROJECT_ROLES_KEY, ProjectInvitationsController.prototype.resend)).toEqual(['owner', 'admin'])
    expect(Reflect.getMetadata(PROJECT_ROLES_KEY, ProjectInvitationsController.prototype.revoke)).toEqual(['owner', 'admin'])
  })
})

function guardNames(handler: unknown) {
  const guards = Reflect.getMetadata(GUARDS_METADATA, handler as object) as Array<{ name: string }>
  return guards.map((guard) => guard.name)
}
