interface RrwebEvent {
  timestamp: number
  type: number
  data: unknown
}

export function uploadReplay(ingestBase: string, eventId: string, events: RrwebEvent[]): void {
  const body = JSON.stringify({ eventId, events, recordedAt: new Date().toISOString() })
  fetch(`${ingestBase}/replay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    // 静默失败
  })
}
