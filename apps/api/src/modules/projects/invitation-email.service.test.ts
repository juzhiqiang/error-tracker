import { describe, expect, it, mock } from 'bun:test'
import type { ProjectInvitationWithToken } from './project-invitations.service'
import { InvitationEmailService } from './invitation-email.service'

const invitation: ProjectInvitationWithToken = {
  id: 'invite-1',
  projectId: 'project-1',
  projectName: 'Checkout API',
  email: 'teammate@example.com',
  role: 'admin',
  status: 'pending',
  invitedByUserId: 'owner-1',
  inviterEmail: 'owner@example.com',
  expiresAt: new Date('2026-06-12T10:30:00.000Z'),
  acceptedAt: null,
  revokedAt: null,
  createdAt: new Date('2026-06-05T10:30:00.000Z'),
  inviteToken: 'raw-token',
  inviteUrl: 'https://errors.example.com/accept-invite/raw-token',
}

describe('InvitationEmailService', () => {
  it('does not block invitations when SMTP is not configured', async () => {
    const service = new InvitationEmailService({ env: {} })

    await expect(service.sendProjectInvitation(invitation, { invitedByEmail: 'owner@example.com' })).resolves.toEqual({
      status: 'not_configured',
    })
  })

  it('sends project invitation emails through configured SMTP transport', async () => {
    const sendMail = mock(async () => ({ messageId: 'smtp-message-1' }))
    const transportFactory = mock(() => ({ sendMail }))
    const service = new InvitationEmailService({
      env: {
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: '465',
        SMTP_SECURE: 'true',
        SMTP_USER: 'smtp-user',
        SMTP_PASS: 'smtp-pass',
        SMTP_FROM: 'Error Tracker <no-reply@example.com>',
      },
      transportFactory,
    })

    const delivery = await service.sendProjectInvitation(invitation, { invitedByEmail: 'owner@example.com' })

    expect(delivery).toEqual({ status: 'sent', messageId: 'smtp-message-1' })
    expect(transportFactory).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      auth: { user: 'smtp-user', pass: 'smtp-pass' },
    })
    expect(sendMail).toHaveBeenCalledTimes(1)
    const message = sendMail.mock.calls[0][0]
    expect(message.to).toBe('teammate@example.com')
    expect(message.from).toBe('Error Tracker <no-reply@example.com>')
    expect(message.subject).toContain('Checkout API')
    expect(message.text).toContain('https://errors.example.com/accept-invite/raw-token')
    expect(message.html).toContain('https://errors.example.com/accept-invite/raw-token')
    expect(message.html).toContain('admin')
    expect(message.html).toContain('owner@example.com')
  })

  it('returns failed delivery status when SMTP send fails', async () => {
    const transportFactory = mock(() => ({
      sendMail: mock(async () => {
        throw new Error('SMTP connection refused')
      }),
    }))
    const service = new InvitationEmailService({
      env: {
        SMTP_HOST: 'smtp.example.com',
        SMTP_FROM: 'Error Tracker <no-reply@example.com>',
      },
      transportFactory,
    })

    await expect(service.sendProjectInvitation(invitation)).resolves.toEqual({
      status: 'failed',
      error: 'SMTP connection refused',
    })
  })
})
