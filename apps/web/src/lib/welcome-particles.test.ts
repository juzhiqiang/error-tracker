import { describe, expect, it } from 'bun:test'
import { createSignalParticles } from './welcome-particles'

describe('welcome particle field', () => {
  it('creates deterministic particles within the hero scene bounds', () => {
    const particles = createSignalParticles()

    expect(particles).toHaveLength(22)
    expect(new Set(particles.map((particle) => particle.id)).size).toBe(22)
    expect(particles.slice(0, 3)).toEqual([
      { id: 'signal-particle-0', x: 8, y: 18, size: 2, delayMs: 0, durationMs: 6200, tone: 'cyan' },
      { id: 'signal-particle-1', x: 25, y: 49, size: 3, delayMs: 370, durationMs: 6730, tone: 'violet' },
      { id: 'signal-particle-2', x: 42, y: 80, size: 4, delayMs: 740, durationMs: 7260, tone: 'emerald' },
    ])

    for (const particle of particles) {
      expect(particle.x).toBeGreaterThanOrEqual(0)
      expect(particle.x).toBeLessThanOrEqual(100)
      expect(particle.y).toBeGreaterThanOrEqual(0)
      expect(particle.y).toBeLessThanOrEqual(100)
      expect(particle.size).toBeGreaterThanOrEqual(2)
      expect(particle.size).toBeLessThanOrEqual(6)
      expect(particle.delayMs).toBeGreaterThanOrEqual(0)
      expect(particle.durationMs).toBeGreaterThanOrEqual(6200)
      expect(particle.durationMs).toBeLessThanOrEqual(9900)
      expect(['cyan', 'violet', 'emerald']).toContain(particle.tone)
    }
  })

  it('supports a smaller particle field for constrained surfaces', () => {
    const particles = createSignalParticles(10)

    expect(particles).toHaveLength(10)
    expect(particles.at(-1)).toEqual({
      id: 'signal-particle-9',
      x: 61,
      y: 17,
      size: 6,
      delayMs: 3330,
      durationMs: 8270,
      tone: 'cyan',
    })
  })
})
