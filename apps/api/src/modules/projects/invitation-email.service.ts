import { Inject, Injectable, Optional } from '@nestjs/common'
import nodemailer from 'nodemailer'
import type Mail from 'nodemailer/lib/mailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'
import type { ProjectInvitationWithToken } from './project-invitations.service'

export type InvitationEmailDelivery =
  | { status: 'sent'; messageId?: string }
  | { status: 'not_configured' }
  | { status: 'failed'; error: string }

export interface InvitationEmailContext {
  invitedByEmail?: string | null
}

export interface InvitationEmailTransport {
  sendMail(message: Mail.Options): Promise<{ messageId?: string }>
}

export type InvitationEmailTransportFactory = (options: SMTPTransport.Options) => InvitationEmailTransport

export interface InvitationEmailServiceOptions {
  env?: Record<string, string | undefined>
  transportFactory?: InvitationEmailTransportFactory
}

export const INVITATION_EMAIL_OPTIONS = Symbol('INVITATION_EMAIL_OPTIONS')

@Injectable()
export class InvitationEmailService {
  private readonly env: Record<string, string | undefined>
  private readonly transportFactory: InvitationEmailTransportFactory

  constructor(
    @Optional()
    @Inject(INVITATION_EMAIL_OPTIONS)
    options: InvitationEmailServiceOptions = {},
  ) {
    this.env = options.env ?? process.env
    this.transportFactory = options.transportFactory ?? ((smtpOptions) => nodemailer.createTransport(smtpOptions))
  }

  async sendProjectInvitation(
    invitation: ProjectInvitationWithToken,
    context: InvitationEmailContext = {},
  ): Promise<InvitationEmailDelivery> {
    const config = resolveSmtpConfig(this.env)
    if (config.status === 'not_configured') return { status: 'not_configured' }
    if (config.status === 'failed') return config

    try {
      const transport = this.transportFactory(config.smtp)
      const result = await transport.sendMail(buildInvitationMessage(invitation, context, config.from))
      return result.messageId ? { status: 'sent', messageId: result.messageId } : { status: 'sent' }
    } catch (error) {
      return { status: 'failed', error: error instanceof Error ? error.message : String(error) }
    }
  }
}

type SmtpConfig =
  | { status: 'configured'; from: string; smtp: SMTPTransport.Options }
  | { status: 'not_configured' }
  | { status: 'failed'; error: string }

function resolveSmtpConfig(env: Record<string, string | undefined>): SmtpConfig {
  const host = env.SMTP_HOST?.trim()
  const from = env.SMTP_FROM?.trim()
  if (!host || !from) return { status: 'not_configured' }

  const port = env.SMTP_PORT ? Number(env.SMTP_PORT) : 587
  if (!Number.isInteger(port) || port <= 0) {
    return { status: 'failed', error: 'Invalid SMTP_PORT' }
  }

  const secure = parseBoolean(env.SMTP_SECURE) ?? port === 465
  const smtp: SMTPTransport.Options = { host, port, secure }
  if (env.SMTP_USER && env.SMTP_PASS) {
    smtp.auth = { user: env.SMTP_USER, pass: env.SMTP_PASS }
  }

  return { status: 'configured', from, smtp }
}

function buildInvitationMessage(
  invitation: ProjectInvitationWithToken,
  context: InvitationEmailContext,
  from: string,
): Mail.Options {
  const projectName = invitation.projectName || 'Error Tracker project'
  const inviter = context.invitedByEmail ?? invitation.inviterEmail
  const expiresAt = new Date(invitation.expiresAt).toISOString()
  const subject = `You have been invited to ${projectName}`
  const inviterLine = inviter ? `${inviter} invited you to join ${projectName}.` : `You have been invited to join ${projectName}.`
  const text = [
    inviterLine,
    '',
    `Role: ${invitation.role}`,
    `Expires: ${expiresAt}`,
    '',
    `Accept invitation: ${invitation.inviteUrl}`,
    '',
    'If you did not expect this invitation, you can ignore this email.',
  ].join('\n')

  const html = `
    <div style="margin:0;background:#0f172a;padding:32px;font-family:Inter,Arial,sans-serif;color:#e2e8f0;">
      <div style="max-width:560px;margin:0 auto;border:1px solid rgba(148,163,184,0.28);border-radius:12px;background:rgba(15,23,42,0.92);box-shadow:0 24px 80px rgba(15,23,42,0.45);overflow:hidden;">
        <div style="padding:24px 28px;border-bottom:1px solid rgba(148,163,184,0.2);">
          <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#818cf8;">Error Tracker</div>
          <h1 style="margin:10px 0 0;font-size:22px;line-height:1.35;color:#f8fafc;">Project invitation</h1>
        </div>
        <div style="padding:28px;">
          <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#cbd5e1;">${escapeHtml(inviterLine)}</p>
          <div style="margin:0 0 22px;padding:14px 16px;border:1px solid rgba(99,102,241,0.32);border-radius:10px;background:rgba(99,102,241,0.1);">
            <div style="font-size:13px;color:#94a3b8;">Project</div>
            <div style="margin-top:4px;font-size:17px;font-weight:700;color:#f8fafc;">${escapeHtml(projectName)}</div>
            <div style="margin-top:12px;font-size:13px;color:#94a3b8;">Role</div>
            <div style="margin-top:4px;font-size:15px;color:#e2e8f0;">${escapeHtml(invitation.role)}</div>
            <div style="margin-top:12px;font-size:13px;color:#94a3b8;">Expires</div>
            <div style="margin-top:4px;font-size:13px;color:#e2e8f0;">${escapeHtml(expiresAt)}</div>
          </div>
          <a href="${escapeHtml(invitation.inviteUrl)}" style="display:inline-block;border-radius:8px;background:linear-gradient(135deg,#6366f1,#7c3aed);padding:12px 18px;color:white;text-decoration:none;font-size:14px;font-weight:700;box-shadow:0 14px 35px rgba(99,102,241,0.35);">Accept invitation</a>
          <p style="margin:22px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">If the button does not work, open this link: <br><span style="word-break:break-all;color:#c4b5fd;">${escapeHtml(invitation.inviteUrl)}</span></p>
        </div>
      </div>
    </div>
  `

  return {
    to: invitation.email,
    from,
    subject,
    text,
    html,
  }
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (!value) return undefined
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return undefined
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
