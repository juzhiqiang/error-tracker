export type SignalParticleTone = 'cyan' | 'violet' | 'emerald'

export interface SignalParticle {
  id: string
  x: number
  y: number
  size: number
  delayMs: number
  durationMs: number
  tone: SignalParticleTone
}

const particleTones: SignalParticleTone[] = ['cyan', 'violet', 'emerald']

export function createSignalParticles(count = 22): SignalParticle[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `signal-particle-${index}`,
    x: (8 + index * 17) % 100,
    y: (18 + index * 31 + Math.floor(index / 4) * 10) % 100,
    size: 2 + (index % 5),
    delayMs: index * 370,
    durationMs: 6200 + ((index * 530) % 2700),
    tone: particleTones[index % particleTones.length],
  }))
}
