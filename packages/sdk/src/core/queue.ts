import type { TrackerEvent } from '../types'

type FlushFn = (events: TrackerEvent[]) => Promise<void>

export class EventQueue {
  private items: TrackerEvent[] = []

  constructor(
    private readonly maxSize: number,
    private readonly onFlush: FlushFn,
  ) {}

  enqueue(event: TrackerEvent): void {
    if (this.items.length >= this.maxSize) {
      this.items.shift()
    }
    this.items.push(event)
  }

  async flush(): Promise<void> {
    if (this.items.length === 0) return
    const batch = this.items.splice(0)
    await this.onFlush(batch)
  }
}
