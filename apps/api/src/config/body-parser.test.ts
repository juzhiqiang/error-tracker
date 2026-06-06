import { describe, expect, it } from 'bun:test'
import { resolveBodyParserLimit } from './body-parser'

describe('resolveBodyParserLimit', () => {
  it('defaults to the replay max body size so rrweb uploads clear Express json parsing', () => {
    expect(resolveBodyParserLimit({})).toBe(5 * 1024 * 1024)
  })

  it('uses an explicit API parser limit before replay limits', () => {
    expect(resolveBodyParserLimit({ API_BODY_LIMIT_BYTES: '1048576', REPLAY_MAX_BODY_BYTES: '256' })).toBe(1048576)
  })

  it('ignores invalid values and falls back to the default', () => {
    expect(resolveBodyParserLimit({ API_BODY_LIMIT_BYTES: 'nope', REPLAY_MAX_BODY_BYTES: '-1' })).toBe(5 * 1024 * 1024)
  })
})
