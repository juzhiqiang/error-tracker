import { describe, it, expect } from 'bun:test'
import { clientFingerprint, parseStackFrames } from '../core/fingerprint'

describe('clientFingerprint', () => {
  it('same error produces same fingerprint', () => {
    const error = new Error('Cannot read properties of undefined')
    const fp1 = clientFingerprint(error)
    const fp2 = clientFingerprint(error)
    expect(fp1).toBe(fp2)
  })

  it('different messages produce different fingerprints', () => {
    const e1 = new Error('error one')
    const e2 = new Error('error two')
    expect(clientFingerprint(e1)).not.toBe(clientFingerprint(e2))
  })

  it('returns hex string of length 8', () => {
    const fp = clientFingerprint(new Error('test'))
    expect(fp).toMatch(/^[0-9a-f]{8}$/)
  })

  it('ignores line/column numbers - same function at different lines same fingerprint', () => {
    const e1 = new Error('test')
    e1.stack = `Error: test\n    at handleSubmit (main.abc.js:87:12)\n    at onClick (app.js:34:5)`
    const e2 = new Error('test')
    e2.stack = `Error: test\n    at handleSubmit (main.xyz.js:99:45)\n    at onClick (app.js:60:3)`
    expect(clientFingerprint(e1)).toBe(clientFingerprint(e2))
  })
})

describe('parseStackFrames', () => {
  it('parses V8 stack trace', () => {
    const stack = `Error: test\n    at handleSubmit (src/Form.tsx:87:12)\n    at onClick (src/App.tsx:34:5)`
    const frames = parseStackFrames(stack)
    expect(frames[0]).toEqual({ function: 'handleSubmit', filename: 'src/Form.tsx', lineno: 87, colno: 12 })
  })
})
