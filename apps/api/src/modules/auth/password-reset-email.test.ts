import { describe, expect, it, mock } from 'bun:test'
import { buildPasswordResetMessage, sendPasswordResetEmail } from './password-reset-email'

describe('password reset email delivery', () => {
  it('does not send email when SMTP is not configured', async () => {
    const sendMail = mock(async () => ({ messageId: 'unused' }))
    const delivery = await sendPasswordResetEmail(
      {
        user: { email: 'ada@example.com', name: 'Ada' },
        url: 'https://api.example.com/api/auth/reset-password/token',
      },
      { env: {}, transportFactory: mock(() => ({ sendMail })) },
    )

    expect(delivery).toEqual({ status: 'not_configured' })
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('sends reset links through configured SMTP transport', async () => {
    const sendMail = mock(async () => ({ messageId: 'reset-message-1' }))
    const transportFactory = mock(() => ({ sendMail }))

    const delivery = await sendPasswordResetEmail(
      {
        user: { email: 'ada@example.com', name: 'Ada' },
        url: 'https://api.example.com/api/auth/reset-password/token?callbackURL=https%3A%2F%2Ferrors.example.com%2Freset-password',
      },
      {
        env: {
          SMTP_HOST: 'smtp.example.com',
          SMTP_PORT: '465',
          SMTP_SECURE: 'true',
          SMTP_USER: 'smtp-user',
          SMTP_PASS: 'smtp-pass',
          SMTP_FROM: 'Error Tracker <no-reply@example.com>',
        },
        transportFactory,
      },
    )

    expect(delivery).toEqual({ status: 'sent', messageId: 'reset-message-1' })
    expect(transportFactory).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      auth: { user: 'smtp-user', pass: 'smtp-pass' },
    })
    const message = sendMail.mock.calls[0][0]
    expect(message.to).toBe('ada@example.com')
    expect(message.subject).toContain('Reset your Error Tracker password')
    expect(message.text).toContain('https://api.example.com/api/auth/reset-password/token')
    expect(message.html).toContain('https://api.example.com/api/auth/reset-password/token')
  })

  it('builds a reset message without leaking unescaped user content', () => {
    const message = buildPasswordResetMessage(
      {
        user: { email: 'ada@example.com', name: '<Ada>' },
        url: 'https://errors.example.com/reset-password?token=<token>',
      },
      'Error Tracker <no-reply@example.com>',
    )

    expect(message.html).toContain('&lt;Ada&gt;')
    expect(message.html).toContain('&lt;token&gt;')
    expect(message.html).not.toContain('<Ada>')
  })
})
