import { parseDsn } from '../../transports/dsn'

interface RrwebEvent {
  timestamp: number
  type: number
  data: unknown
}

export function uploadReplay(ingestBase: string, eventId: string, events: RrwebEvent[], token?: string): void {
  const body = JSON.stringify({ eventId, events, recordedAt: new Date().toISOString() })
  const dsn = parseDsn(ingestBase)
  const authToken = token ?? dsn.token

  if (!authToken) {
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn('[ErrorTracker] Missing DSN token. Replay upload skipped.')
    }
    return
  }

  fetch(dsn.replayUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-error-tracker-token': authToken,
    },
    body,
    credentials: 'omit',
  }).catch(() => {
    // 静默失败
  })
}
