import { describe, expect, it } from 'bun:test'
import { scrubPii } from './pii-scrubber'

describe('scrubPii', () => {
  it('recursively filters sensitive fields without mutating the input', () => {
    const input = {
      user: {
        email: 'alice@example.com',
        password: 'secret-password',
      },
      request: {
        headers: {
          Authorization: 'Bearer abc',
          cookie: 'sid=123',
          userAgent: 'browser',
        },
      },
      breadcrumbs: [
        {
          category: 'ui.click',
          data: {
            token: 'client-token',
            label: 'Submit',
          },
        },
      ],
    }

    const result = scrubPii(input)

    expect(result).toEqual({
      user: {
        email: '[Email]',
        password: '[Filtered]',
      },
      request: {
        headers: {
          Authorization: '[Filtered]',
          cookie: '[Filtered]',
          userAgent: 'browser',
        },
      },
      breadcrumbs: [
        {
          category: 'ui.click',
          data: {
            token: '[Filtered]',
            label: 'Submit',
          },
        },
      ],
    })
    expect(input.user.password).toBe('secret-password')
  })

  it('filters sensitive values inside strings', () => {
    const result = scrubPii({
      message:
        'User ada@example.com failed with Bearer abc.def.ghi and card 4111 1111 1111 1111 using key sk_live_1234567890abcdef',
      stacktrace: [{ filename: '/Users/ada@example.com/project/app.ts', function: 'pay' }],
    })

    expect(result.message).toBe(
      'User [Email] failed with [BearerToken] and card [CardNumber] using key [SecretKey]',
    )
    expect(result.stacktrace[0].filename).toBe('/Users/[Email]/project/app.ts')
  })

  it('allows additional value patterns to be configured', () => {
    const result = scrubPii('tenant internal-id:abc123 failed', {
      sensitiveValuePatterns: [[/internal-id:[a-z0-9]+/g, '[InternalId]']],
    })

    expect(result).toBe('tenant [InternalId] failed')
  })
})
