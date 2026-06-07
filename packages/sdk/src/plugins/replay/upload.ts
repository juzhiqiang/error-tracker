import { parseDsn } from '../../transports/dsn'

interface RrwebEvent {
  timestamp: number
  type: number
  data: unknown
}

export function uploadReplay(ingestBase: string, eventId: string, events: RrwebEvent[], token?: string): void {
  const body = JSON.stringify({ eventId, events, recordedAt: new Date().toISOString() })
  const dsn = parseDsn(ingestBase)
  fetch(dsn.replayUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ?? dsn.token ? { 'x-error-tracker-token': token ?? dsn.token } : {}),
    },
    body,
  }).catch(() => {
    // 静默失败
  })
}
