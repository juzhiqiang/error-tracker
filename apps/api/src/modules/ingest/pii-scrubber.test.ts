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
        email: 'alice@example.com',
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
})
