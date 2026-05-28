import { describe, it, expect } from 'bun:test'
import { CircularBuffer } from '../plugins/replay/circular-buffer'

describe('CircularBuffer', () => {
  it('retains items within age limit', async () => {
    const buf = new CircularBuffer(200)
    buf.push({ timestamp: Date.now(), type: 0, data: {} })
    await new Promise((r) => setTimeout(r, 50))
    expect(buf.drain()).toHaveLength(1)
  })

  it('evicts items older than maxAgeMs', async () => {
    const buf = new CircularBuffer(50)
    buf.push({ timestamp: Date.now() - 100, type: 0, data: {} })
    expect(buf.drain()).toHaveLength(0)
  })

  it('drain returns all items and clears buffer', () => {
    const buf = new CircularBuffer(5000)
    buf.push({ timestamp: Date.now(), type: 0, data: {} })
    buf.push({ timestamp: Date.now(), type: 0, data: {} })
    const items = buf.drain()
    expect(items).toHaveLength(2)
    expect(buf.drain()).toHaveLength(0)
  })
})
