import type { TrackerEvent } from '../types'

export class HttpTransport {
  constructor(private readonly dsn: string) {}

  send(events: TrackerEvent[], isUnloading = false): void {
    const body = JSON.stringify({ events, sentAt: new Date().toISOString() })
    fetch(this.dsn, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: isUnloading,
    }).catch(() => {
      // 静默失败：监控 SDK 不应让自身错误影响宿主页面
    })
  }
}
