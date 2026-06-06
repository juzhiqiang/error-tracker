# Task P1-07: HttpTransport

**计划：** Plan 1  
**依赖：** Task P1-02（Task P1-03 需同步完成）  
**可并行：** 是（与 Task 3, 4, 5, 6 并行）  
**预计时间：** 10 min

---

## 目标

实现 HTTP 上报传输层。fire-and-forget 模式，页面卸载时使用 `keepalive: true` 确保请求发出。

## 需要创建的文件

- `packages/sdk/src/transports/http.ts`
- `packages/sdk/src/__tests__/http.test.ts`

## 步骤

- [x] **Step 1: 写测试**

```typescript
// packages/sdk/src/__tests__/http.test.ts
import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { HttpTransport } from '../transports/http'

describe('HttpTransport', () => {
  let fetchCalls: { url: string; init: RequestInit }[] = []

  beforeEach(() => {
    fetchCalls = []
    globalThis.fetch = mock(async (url: string, init: RequestInit) => {
      fetchCalls.push({ url, init })
      return new Response(null, { status: 202 })
    })
  })

  it('sends POST to correct URL', async () => {
    const t = new HttpTransport('http://localhost:3002/ingest/proj1/token1')
    await t.send([{ eventId: 'e1', timestamp: 1, level: 'error', message: 'test', fingerprint: 'fp1' }])
    expect(fetchCalls).toHaveLength(1)
    expect(fetchCalls[0].url).toBe('http://localhost:3002/ingest/proj1/token1')
    expect(fetchCalls[0].init.method).toBe('POST')
  })

  it('sends JSON body with events array', async () => {
    const t = new HttpTransport('http://localhost:3002/ingest/proj1/token1')
    const event = { eventId: 'e1', timestamp: 1, level: 'error' as const, message: 'test', fingerprint: 'fp1' }
    await t.send([event])
    const body = JSON.parse(fetchCalls[0].init.body as string)
    expect(body.events).toHaveLength(1)
    expect(body.events[0].eventId).toBe('e1')
  })

  it('uses keepalive when isUnloading is true', async () => {
    const t = new HttpTransport('http://localhost:3002/ingest/proj1/token1')
    await t.send([{ eventId: 'e1', timestamp: 1, level: 'error', message: 'test', fingerprint: 'fp1' }], true)
    expect(fetchCalls[0].init.keepalive).toBe(true)
  })
})
```

- [x] **Step 2: 运行测试确认失败**

```bash
cd D:/myProject/error-tracker
bun test packages/sdk/src/__tests__/http.test.ts
```

Expected: FAIL - "Cannot find module '../transports/http'"

- [x] **Step 3: 创建 packages/sdk/src/transports/http.ts**

```typescript
import type { TrackerEvent } from '../types'

export class HttpTransport {
  constructor(private readonly dsn: string) {}

  send(events: TrackerEvent[], isUnloading = false): void {
    const body = JSON.stringify({ events, sentAt: new Date().toISOString() })
    // fire-and-forget：不 await，不阻塞调用方
    fetch(this.dsn, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: isUnloading,  // 页面卸载时保持请求
    }).catch(() => {
      // 静默失败：监控 SDK 不应让自身错误影响宿主页面
    })
  }
}
```

- [x] **Step 4: 运行测试确认通过**

```bash
bun test packages/sdk/src/__tests__/http.test.ts
```

Expected: PASS

- [x] **Step 5: 提交**

```bash
git add packages/sdk/src/transports/http.ts packages/sdk/src/__tests__/http.test.ts
git commit -m "feat: HttpTransport（fetch fire-and-forget + keepalive）"
```
