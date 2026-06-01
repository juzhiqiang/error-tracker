import type { TrackerEvent } from '../types'

type FlushFn = (events: TrackerEvent[]) => Promise<void>

export interface EventQueueOptions {
  maxRetries?: number
  retryDelayMs?: number
  persist?: boolean
  persistenceKey?: string
}

export class EventQueue {
  private items: TrackerEvent[] = []
  private readonly maxRetries: number
  private readonly retryDelayMs: number
  private readonly persist: boolean
  private readonly persistenceKey: string

  constructor(
    private readonly maxSize: number,
    private readonly onFlush: FlushFn,
    options: EventQueueOptions = {},
  ) {
    this.maxRetries = options.maxRetries ?? 0
    this.retryDelayMs = options.retryDelayMs ?? 250
    this.persist = options.persist ?? false
    this.persistenceKey = options.persistenceKey ?? 'error-tracker:queue'
    this.items = this.restore()
  }

  enqueue(event: TrackerEvent): void {
    if (this.items.length >= this.maxSize) {
      this.items.shift()
    }
    this.items.push(event)
    this.save()
  }

  async flush(): Promise<void> {
    if (this.items.length === 0) return
    const batch = this.items.splice(0)
    this.save()

    try {
      await this.flushWithRetry(batch)
      this.save()
    } catch (error) {
      this.items = [...batch, ...this.items].slice(-this.maxSize)
      this.save()
      throw error
    }
  }

  private async flushWithRetry(batch: TrackerEvent[]): Promise<void> {
    let attempt = 0
    while (true) {
      try {
        await this.onFlush(batch)
        return
      } catch (error) {
        if (attempt >= this.maxRetries) throw error
        attempt++
        if (this.retryDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs))
        }
      }
    }
  }

  private restore(): TrackerEvent[] {
    if (!this.persist || !hasLocalStorage()) return []
    try {
      const raw = globalThis.localStorage.getItem(this.persistenceKey)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.slice(-this.maxSize) : []
    } catch {
      return []
    }
  }

  private save(): void {
    if (!this.persist || !hasLocalStorage()) return
    try {
      if (this.items.length === 0) {
        globalThis.localStorage.removeItem(this.persistenceKey)
        return
      }
      globalThis.localStorage.setItem(this.persistenceKey, JSON.stringify(this.items))
    } catch {
      // Storage failures must not affect the host application.
    }
  }
}

function hasLocalStorage(): boolean {
  return typeof globalThis.localStorage !== 'undefined'
}
