import { describe, it, expect } from 'bun:test'
import type { ErrorEvent, BreadcrumbType, SdkOptions } from '../types'

describe('types', () => {
  it('ErrorEvent has required fields', () => {
    const event: ErrorEvent = {
      eventId: 'abc',
      timestamp: Date.now(),
      level: 'error',
      message: 'test',
      fingerprint: 'fp123',
      environment: 'production',
    }
    expect(event.eventId).toBe('abc')
  })

  it('BreadcrumbType union is correct', () => {
    const types: BreadcrumbType[] = ['ui.click', 'navigation', 'http', 'console', 'error']
    expect(types).toHaveLength(5)
  })
})
