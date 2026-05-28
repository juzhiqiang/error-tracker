interface RrwebEvent {
  timestamp: number
  type: number
  data: unknown
}

export class CircularBuffer {
  private items: RrwebEvent[] = []

  constructor(private readonly maxAgeMs: number) {}

  push(event: RrwebEvent): void {
    this.items.push(event)
    const cutoff = Date.now() - this.maxAgeMs
    let i = 0
    while (i < this.items.length && this.items[i].timestamp < cutoff) i++
    if (i > 0) this.items.splice(0, i)
  }

  drain(): RrwebEvent[] {
    const cutoff = Date.now() - this.maxAgeMs
    const valid = this.items.filter((e) => e.timestamp >= cutoff)
    this.items = []
    return valid
  }
}
