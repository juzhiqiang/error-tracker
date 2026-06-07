import type { TrackerEvent } from '../types'

export class HttpTransport {
  constructor(private readonly dsn: string) {}

  async send(events: TrackerEvent[], isUnloading = false): Promise<void> {
    const body = JSON.stringify({ events, sentAt: new Date().toISOString() })
    if (isUnloading && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const accepted = navigator.sendBeacon(this.dsn, new Blob([body], { type: 'application/json' }))
      if (accepted) return
    }

    await fetch(this.dsn, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: isUnloading,
    })
  }
}
