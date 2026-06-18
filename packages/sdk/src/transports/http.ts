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
    if (!this.token) {
      this.warnMissingToken()
      return
    }

    const body = JSON.stringify({ events, sentAt: new Date().toISOString() })
    const response = await fetch(this.ingestUrl, {
      method: 'POST',
      headers: this.headers(),
      body,
      credentials: 'omit',
      keepalive: isUnloading,
    })
    if (!response.ok) {
      throw new Error(`Ingest request failed with status ${response.status}`)
    }
  }

  private headers(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      ...(this.token ? { 'x-error-tracker-token': this.token } : {}),
    }
  }

  private warnMissingToken(): void {
    if (typeof console === 'undefined' || typeof console.warn !== 'function') return
    console.warn('[ErrorTracker] Missing DSN token. Pass init({ dsn, token }) or use /ingest/<projectId>/<token>.')
  }
}
