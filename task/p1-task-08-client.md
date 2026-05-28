# Task P1-08: Scope + ErrorTrackerClient 主类

**计划：** Plan 1  
**依赖：** Task P1-03, P1-04, P1-05, P1-06, P1-07（全部完成后才能开始）  
**可并行：** 否  
**预计时间：** 15 min

---

## 目标

实现 SDK 核心主类 `ErrorTrackerClient`，整合所有 core 模块：采样、去重、beforeSend hook、队列管理。

## 需要创建的文件

- `packages/sdk/src/core/scope.ts`
- `packages/sdk/src/core/utils.ts`
- `packages/sdk/src/core/client.ts`
- `packages/sdk/src/__tests__/client.test.ts`

## 已完成的依赖接口

- `types.ts`：`SdkOptions`, `ErrorEvent`, `TrackerEvent`, `Integration`
- `core/fingerprint.ts`：`clientFingerprint(error)`, `parseStackFrames(stack)`
- `core/breadcrumbs.ts`：`BreadcrumbManager`
- `core/dedupe.ts`：`DedupeFilter`
- `core/queue.ts`：`EventQueue`
- `transports/http.ts`：`HttpTransport`

## 步骤

- [ ] **Step 1: 创建 packages/sdk/src/core/scope.ts**

```typescript
export class Scope {
  private _user: Record<string, string> = {}
  private _tags: Record<string, string> = {}

  setUser(user: Record<string, string>): void { this._user = user }
  setTag(key: string, value: string): void { this._tags[key] = value }
  getUser() { return { ...this._user } }
  getTags() { return { ...this._tags } }
  clear(): void { this._user = {}; this._tags = {} }
}
```

- [ ] **Step 2: 创建 packages/sdk/src/core/utils.ts**

```typescript
export function randomId(): string {
  return Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
}
```

- [ ] **Step 3: 写 client 测试**

```typescript
// packages/sdk/src/__tests__/client.test.ts
import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { ErrorTrackerClient } from '../core/client'

describe('ErrorTrackerClient', () => {
  beforeEach(() => {
    globalThis.fetch = mock(async () => new Response(null, { status: 202 }))
  })

  it('captureException sends error event', async () => {
    const client = new ErrorTrackerClient({
      dsn: 'http://localhost:3002/ingest/p1/t1',
    })
    client.captureException(new Error('test error'))
    await client.flush()
    expect((globalThis.fetch as ReturnType<typeof mock>).mock.calls).toHaveLength(1)
  })

  it('respects sampleRate 0 (never send)', async () => {
    const client = new ErrorTrackerClient({
      dsn: 'http://localhost:3002/ingest/p1/t1',
      sampleRate: 0,
    })
    client.captureException(new Error('test'))
    await client.flush()
    expect((globalThis.fetch as ReturnType<typeof mock>).mock.calls).toHaveLength(0)
  })

  it('deduplicates same error within 5s', async () => {
    const client = new ErrorTrackerClient({
      dsn: 'http://localhost:3002/ingest/p1/t1',
    })
    const err = new Error('dup')
    client.captureException(err)
    client.captureException(err)
    await client.flush()
    expect((globalThis.fetch as ReturnType<typeof mock>).mock.calls).toHaveLength(1)
  })

  it('beforeSend can drop event (return null)', async () => {
    const client = new ErrorTrackerClient({
      dsn: 'http://localhost:3002/ingest/p1/t1',
      beforeSend: () => null,
    })
    client.captureException(new Error('dropped'))
    await client.flush()
    expect((globalThis.fetch as ReturnType<typeof mock>).mock.calls).toHaveLength(0)
  })
})
```

- [ ] **Step 4: 运行测试确认失败**

```bash
cd D:/myProject/error-tracker
bun test packages/sdk/src/__tests__/client.test.ts
```

Expected: FAIL - "Cannot find module '../core/client'"

- [ ] **Step 5: 创建 packages/sdk/src/core/client.ts**

```typescript
import type { SdkOptions, ErrorEvent, TrackerEvent, Integration } from '../types'
import { BreadcrumbManager } from './breadcrumbs'
import { DedupeFilter } from './dedupe'
import { EventQueue } from './queue'
import { clientFingerprint, parseStackFrames } from './fingerprint'
import { HttpTransport } from '../transports/http'
import { Scope } from './scope'
import { randomId } from './utils'

export class ErrorTrackerClient {
  readonly breadcrumbs: BreadcrumbManager
  private readonly dedupe: DedupeFilter
  private readonly queue: EventQueue
  private readonly transport: HttpTransport
  readonly scope: Scope
  private readonly options: Required<Pick<SdkOptions, 'dsn' | 'sampleRate'>> & SdkOptions

  constructor(options: SdkOptions) {
    this.options = { sampleRate: 1.0, ...options }
    this.breadcrumbs = new BreadcrumbManager(100)
    this.dedupe = new DedupeFilter(5000)
    this.transport = new HttpTransport(options.dsn)
    this.scope = new Scope()
    this.queue = new EventQueue(50, async (events) => {
      this.transport.send(events)
    })
  }

  captureException(error: Error, extra?: Record<string, unknown>): void {
    if (Math.random() > this.options.sampleRate) return

    const fingerprint = clientFingerprint(error)
    if (!this.dedupe.shouldSend(fingerprint)) return

    let event: ErrorEvent = {
      eventId: randomId(),
      timestamp: Date.now(),
      level: 'error',
      message: error.message,
      fingerprint,
      environment: this.options.environment,
      release: this.options.release,
      stacktrace: parseStackFrames(error.stack ?? ''),
      breadcrumbs: this.breadcrumbs.getAll(),
      user: this.scope.getUser() as ErrorEvent['user'],
      tags: { ...this.scope.getTags(), ...(extra as Record<string, string> | undefined) },
    }

    if (this.options.beforeSend) {
      const result = this.options.beforeSend(event)
      if (result === null) return
      event = result
    }

    this.queue.enqueue(event)
  }

  captureMessage(message: string, level: ErrorEvent['level'] = 'info'): void {
    const event: ErrorEvent = {
      eventId: randomId(),
      timestamp: Date.now(),
      level,
      message,
      fingerprint: randomId(),
      environment: this.options.environment,
      release: this.options.release,
      breadcrumbs: this.breadcrumbs.getAll(),
    }
    this.queue.enqueue(event)
  }

  capturePerformance(event: TrackerEvent): void {
    this.queue.enqueue(event)
  }

  async flush(isUnloading = false): Promise<void> {
    if (isUnloading) {
      const events = (this.queue as unknown as { items: TrackerEvent[] }).items.splice(0)
      if (events.length > 0) this.transport.send(events, true)
      return
    }
    await this.queue.flush()
  }

  setupIntegrations(): void {
    this.options.integrations?.forEach(i => i.setup(this))
  }
}
```

- [ ] **Step 6: 运行测试确认通过**

```bash
bun test packages/sdk/src/__tests__/client.test.ts
```

Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add packages/sdk/src/core/scope.ts packages/sdk/src/core/client.ts \
  packages/sdk/src/core/utils.ts packages/sdk/src/__tests__/client.test.ts
git commit -m "feat: ErrorTrackerClient 主类（采样、去重、beforeSend）"
```
