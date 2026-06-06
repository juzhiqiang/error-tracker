# Task P1-12: ReplayPlugin（rrweb 环形缓冲）

**计划：** Plan 1  
**依赖：** Task P1-11  
**可并行：** 否  
**预计时间：** 15 min

---

## 目标

实现 rrweb 录屏插件。持续录制，只在出错时上传最近 N 秒的录屏片段（环形缓冲）。

## 需要创建的文件

- `packages/sdk/src/plugins/replay/circular-buffer.ts`
- `packages/sdk/src/plugins/replay/upload.ts`
- `packages/sdk/src/plugins/replay/index.ts`
- `packages/sdk/src/__tests__/replay.test.ts`

## 步骤

- [x] **Step 1: 写测试**

```typescript
// packages/sdk/src/__tests__/replay.test.ts
import { describe, it, expect } from 'bun:test'
import { CircularBuffer } from '../plugins/replay/circular-buffer'

describe('CircularBuffer', () => {
  it('retains items within age limit', async () => {
    const buf = new CircularBuffer(200)  // 200ms
    buf.push({ timestamp: Date.now(), type: 0, data: {} })
    await new Promise(r => setTimeout(r, 50))
    expect(buf.drain()).toHaveLength(1)
  })

  it('evicts items older than maxAgeMs', async () => {
    const buf = new CircularBuffer(50)  // 50ms
    buf.push({ timestamp: Date.now() - 100, type: 0, data: {} })
    expect(buf.drain()).toHaveLength(0)
  })

  it('drain returns all items and clears buffer', () => {
    const buf = new CircularBuffer(5000)
    buf.push({ timestamp: Date.now(), type: 0, data: {} })
    buf.push({ timestamp: Date.now(), type: 0, data: {} })
    const items = buf.drain()
    expect(items).toHaveLength(2)
    expect(buf.drain()).toHaveLength(0)
  })
})
```

- [x] **Step 2: 运行测试确认失败**

```bash
cd D:/myProject/error-tracker
bun test packages/sdk/src/__tests__/replay.test.ts
```

Expected: FAIL - "Cannot find module '../plugins/replay/circular-buffer'"

- [x] **Step 3: 创建 packages/sdk/src/plugins/replay/circular-buffer.ts**

```typescript
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
    // 顺带清理过期项，避免无限增长
    const cutoff = Date.now() - this.maxAgeMs
    let i = 0
    while (i < this.items.length && this.items[i].timestamp < cutoff) i++
    if (i > 0) this.items.splice(0, i)
  }

  drain(): RrwebEvent[] {
    const cutoff = Date.now() - this.maxAgeMs
    const valid = this.items.filter(e => e.timestamp >= cutoff)
    this.items = []
    return valid
  }
}
```

- [x] **Step 4: 创建 packages/sdk/src/plugins/replay/upload.ts**

```typescript
interface RrwebEvent {
  timestamp: number
  type: number
  data: unknown
}

export async function uploadReplay(
  ingestBase: string,
  eventId: string,
  events: RrwebEvent[],
): Promise<void> {
  const body = JSON.stringify({ eventId, events, recordedAt: new Date().toISOString() })
  fetch(`${ingestBase}/replay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {})
}
```

- [x] **Step 5: 创建 packages/sdk/src/plugins/replay/index.ts**

```typescript
import { record } from 'rrweb'
import type { Integration } from '../../types'
import type { ErrorTrackerClient } from '../../core/client'
import { CircularBuffer } from './circular-buffer'
import { uploadReplay } from './upload'

export interface ReplayPluginOptions {
  bufferSeconds?: number    // default 30
  sampleRate?: number       // 0.0-1.0, default 1.0
}

export class ReplayPlugin implements Integration {
  name = 'Replay'
  private buffer: CircularBuffer
  private stopFn?: () => void
  private dsnBase = ''
  private readonly sampleRate: number

  constructor(private readonly opts: ReplayPluginOptions = {}) {
    this.buffer = new CircularBuffer((opts.bufferSeconds ?? 30) * 1000)
    this.sampleRate = opts.sampleRate ?? 1.0
  }

  setup(client: ErrorTrackerClient): void {
    if (Math.random() > this.sampleRate) return

    // Extract base ingest URL from DSN: http://host/ingest/projectId/token → http://host/ingest/projectId
    const dsn = (client as unknown as { options: { dsn: string } }).options?.dsn ?? ''
    const parts = dsn.split('/')
    this.dsnBase = parts.slice(0, -1).join('/')  // 去掉最后的 token

    this.stopFn = record({
      emit: (event) => this.buffer.push(event as { timestamp: number; type: number; data: unknown }),
      maskAllInputs: true,
      maskTextSelector: '[data-sensitive]',
    })

    // hook 进 client 的 captureException
    const origCapture = client.captureException.bind(client)
    client.captureException = (error: Error, extra?: Record<string, unknown>) => {
      origCapture(error, extra)
      const events = this.buffer.drain()
      if (events.length > 0) {
        const eventId = extra?.eventId as string | undefined ?? Date.now().toString()
        uploadReplay(this.dsnBase, eventId, events)
      }
    }
  }

  teardown(): void {
    this.stopFn?.()
  }
}
```

- [x] **Step 6: 运行测试确认通过**

```bash
bun test packages/sdk/src/__tests__/replay.test.ts
```

Expected: PASS

- [x] **Step 7: 完整测试套件**

```bash
cd D:/myProject/error-tracker
bun test packages/sdk
```

Expected: 全部通过

- [x] **Step 8: 重新构建（含 replay 插件）**

```bash
cd packages/sdk && bun run build
```

Expected: `dist/browser/plugins/replay/index.js` 存在

- [x] **Step 9: 提交**

```bash
git add packages/sdk/src/plugins/ packages/sdk/src/__tests__/replay.test.ts
git commit -m "feat: ReplayPlugin（rrweb 环形缓冲，30s，错误触发上传）"
```
