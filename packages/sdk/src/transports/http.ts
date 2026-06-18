import type { TrackerEvent } from '../types'
import { parseDsn } from './dsn'

export class HttpTransport {
  private readonly ingestUrl: string
  private readonly token?: string

  constructor(dsn: string, token?: string) {
    const parsed = parseDsn(dsn)
    this.ingestUrl = parsed.ingestUrl
    this.token = token ?? parsed.token
  }

  async send(events: TrackerEvent[], isUnloading = false): Promise<void> {
    const body = JSON.stringify({ events, sentAt: new Date().toISOString() })
    if (isUnloading && !this.token && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const accepted = navigator.sendBeacon(this.ingestUrl, new Blob([body], { type: 'application/json' }))
      if (accepted) return
    }

    await fetch(this.ingestUrl, {
      method: 'POST',
      headers: this.headers(),
      body,
      credentials: 'omit',
      keepalive: isUnloading,
    })
  }

  private headers(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      ...(this.token ? { 'x-error-tracker-token': this.token } : {}),
    }
  }
}
