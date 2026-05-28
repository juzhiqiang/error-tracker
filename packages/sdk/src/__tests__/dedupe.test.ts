import { describe, it, expect } from 'bun:test'
import { DedupeFilter } from '../core/dedupe'

describe('DedupeFilter', () => {
  it('allows first occurrence', () => {
    const f = new DedupeFilter(5000)
    expect(f.shouldSend('fp1')).toBe(true)
  })

  it('blocks same fingerprint within TTL', () => {
    const f = new DedupeFilter(5000)
    f.shouldSend('fp1')
    expect(f.shouldSend('fp1')).toBe(false)
  })

  it('allows after TTL expires', async () => {
    const f = new DedupeFilter(50)
    f.shouldSend('fp1')
    await new Promise((r) => setTimeout(r, 60))
    expect(f.shouldSend('fp1')).toBe(true)
  })

  it('allows different fingerprints independently', () => {
    const f = new DedupeFilter(5000)
    expect(f.shouldSend('fp1')).toBe(true)
    expect(f.shouldSend('fp2')).toBe(true)
  })
})
