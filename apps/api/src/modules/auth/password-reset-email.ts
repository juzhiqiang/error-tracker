import nodemailer from 'nodemailer'
import type Mail from 'nodemailer/lib/mailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'

export type PasswordResetEmailDelivery =
  | { status: 'sent'; messageId?: string }
  | { status: 'not_configured' }
  | { status: 'failed'; error: string }

export interface PasswordResetEmailInput {
  user: { email: string; name?: string | null }
  url: string
}

export interface PasswordResetEmailTransport {
  sendMail(message: Mail.Options): Promise<{ messageId?: string }>
}

export type PasswordResetEmailTransportFactory = (options: SMTPTransport.Options) => PasswordResetEmailTransport

export interface PasswordResetEmailOptions {
  env?: Record<string, string | undefined>
  transportFactory?: PasswordResetEmailTransportFactory
}

type SmtpConfig =
  | { status: 'configured'; from: string; smtp: SMTPTransport.Options }
  | { status: 'not_configured' }
  | { status: 'failed'; error: string }

export async function sendPasswordResetEmail(
  input: PasswordResetEmailInput,
  options: PasswordResetEmailOptions = {},
): Promise<PasswordResetEmailDelivery> {
  const env = options.env ?? process.env
  const config = resolveSmtpConfig(env)
  if (config.status === 'not_configured') return { status: 'not_configured' }
  if (config.status === 'failed') return config

  const transportFactory = options.transportFactory ?? ((smtpOptions) => nodemailer.createTransport(smtpOptions))
  try {
    const result = await transportFactory(config.smtp).sendMail(buildPasswordResetMessage(input, config.from))
    return result.messageId ? { status: 'sent', messageId: result.messageId } : { status: 'sent' }
  } catch (error) {
    return { status: 'failed', error: error instanceof Error ? error.message : String(error) }
  }
}

export function buildPasswordResetMessage(input: PasswordResetEmailInput, from: string): Mail.Options {
  const displayName = input.user.name?.trim() || input.user.email
  const text = [
    `Hi ${displayName},`,
    '',
    'We received a request to reset your Error Tracker password.',
    '',
    `Reset password: ${input.url}`,
    '',
    'This link expires automatically. If you did not request a password reset, you can ignore this email.',
  ].join('\n')

  const html = `
    <div style="margin:0;background:#0f172a;padding:32px;font-family:Inter,Arial,sans-serif;color:#e2e8f0;">
      <div style="max-width:560px;margin:0 auto;border:1px solid rgba(148,163,184,0.28);border-radius:12px;background:rgba(15,23,42,0.92);box-shadow:0 24px 80px rgba(15,23,42,0.45);overflow:hidden;">
        <div style="padding:24px 28px;border-bottom:1px solid rgba(148,163,184,0.2);">
          <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#818cf8;">Error Tracker</div>
          <h1 style="margin:10px 0 0;font-size:22px;line-height:1.35;color:#f8fafc;">Reset your password</h1>
        </div>
        <div style="padding:28px;">
          <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#cbd5e1;">Hi ${escapeHtml(displayName)}, we received a request to reset your Error Tracker password.</p>
          <a href="${escapeHtml(input.url)}" style="display:inline-block;border-radius:8px;background:linear-gradient(135deg,#6366f1,#7c3aed);padding:12px 18px;color:white;text-decoration:none;font-size:14px;font-weight:700;box-shadow:0 14px 35px rgba(99,102,241,0.35);">Reset password</a>
          <p style="margin:22px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">If the button does not work, open this link: <br><span style="word-break:break-all;color:#c4b5fd;">${escapeHtml(input.url)}</span></p>
          <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">This link expires automatically. If you did not request a password reset, you can ignore this email.</p>
        </div>
      </div>
    </div>
  `

  return {
    to: input.user.email,
    from,
    subject: 'Reset your Error Tracker password',
    text,
    html,
  }
}

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
