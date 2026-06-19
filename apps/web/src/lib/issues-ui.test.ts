import { describe, expect, it } from 'bun:test'
import { DEFAULT_ISSUES_TIME_RANGE } from './issues-ui'

describe('issues UI defaults', () => {
  it('opens the issue queue with the full working set by default', () => {
    expect(DEFAULT_ISSUES_TIME_RANGE).toBe('30d')
  })
})
