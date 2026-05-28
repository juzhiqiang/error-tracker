# Task P1-06: DedupeFilter + EventQueue

**计划：** Plan 1  
**依赖：** Task P1-02（Task P1-03 需同步完成）  
**可并行：** 是（与 Task 3, 4, 5, 7 并行）  
**预计时间：** 10 min

---

## 目标

实现两个核心模块：
- `DedupeFilter`：SDK 端 5s TTL 去重，相同指纹 5s 内只上报一次
- `EventQueue`：待上报队列，上限 50 条，超出丢弃最旧

## 需要创建的文件

- `packages/sdk/src/core/dedupe.ts`
- `packages/sdk/src/core/queue.ts`
- `packages/sdk/src/__tests__/dedupe.test.ts`
- `packages/sdk/src/__tests__/queue.test.ts`

## 步骤

- [ ] **Step 1: 写 DedupeFilter 测试**

```typescript
// packages/sdk/src/__tests__/dedupe.test.ts
import { describe, it, expect } from 'bun:test'
import { DedupeFilter } from '../core/dedupe'

describe('DedupeFilter', () => {
  it('allows first occurrence', () => {
    const f = new DedupeFilter(5000)
    expect(f.shouldSend('fp1')).toBe(true)
  })

  it('blocks same fingerprint within TTL', () => {
    const f = new DedupeFilter(5000)
    f.shouldSend('fp1')
    expect(f.shouldSend('fp1')).toBe(false)
  })

  it('allows after TTL expires', async () => {
    const f = new DedupeFilter(50)  // 50ms TTL for test
    f.shouldSend('fp1')
    await new Promise(r => setTimeout(r, 60))
    expect(f.shouldSend('fp1')).toBe(true)
  })

  it('allows different fingerprints independently', () => {
    const f = new DedupeFilter(5000)
    expect(f.shouldSend('fp1')).toBe(true)
    expect(f.shouldSend('fp2')).toBe(true)
  })
})
```

- [ ] **Step 2: 写 EventQueue 测试**

```typescript
// packages/sdk/src/__tests__/queue.test.ts
import { describe, it, expect, mock } from 'bun:test'
import { EventQueue } from '../core/queue'
import type { TrackerEvent } from '../types'

const makeEvent = (id: string): TrackerEvent => ({
  eventId: id,
  timestamp: Date.now(),
  level: 'error',
  message: 'test',
  fingerprint: id,
})

describe('EventQueue', () => {
  it('enqueues and flushes events', async () => {
    const sent: TrackerEvent[] = []
    const q = new EventQueue(50, async (events) => { sent.push(...events) })
    q.enqueue(makeEvent('e1'))
    await q.flush()
    expect(sent).toHaveLength(1)
    expect(sent[0].eventId).toBe('e1')
  })

  it('drops oldest when exceeding maxSize', async () => {
    const sent: TrackerEvent[] = []
    const q = new EventQueue(2, async (events) => { sent.push(...events) })
    q.enqueue(makeEvent('e1'))
    q.enqueue(makeEvent('e2'))
    q.enqueue(makeEvent('e3'))  // e1 dropped
    await q.flush()
    expect(sent.map(e => e.eventId)).toEqual(['e2', 'e3'])
  })

  it('clears queue after flush', async () => {
    const sent: TrackerEvent[] = []
    const q = new EventQueue(50, async (events) => { sent.push(...events) })
    q.enqueue(makeEvent('e1'))
    await q.flush()
    await q.flush()  // second flush should send nothing
    expect(sent).toHaveLength(1)
  })
})
```

- [ ] **Step 3: 运行测试确认失败**

```bash
cd D:/myProject/error-tracker
bun test packages/sdk/src/__tests__/dedupe.test.ts packages/sdk/src/__tests__/queue.test.ts
```

Expected: FAIL

- [ ] **Step 4: 创建 packages/sdk/src/core/dedupe.ts**

```typescript
export class DedupeFilter {
  private seen = new Map<string, number>()

  constructor(private readonly ttlMs = 5000) {}

  shouldSend(fingerprint: string): boolean {
    const lastSeen = this.seen.get(fingerprint)
    const now = Date.now()
    if (lastSeen !== undefined && now - lastSeen < this.ttlMs) return false
    this.seen.set(fingerprint, now)
    return true
  }
}
```

- [ ] **Step 5: 创建 packages/sdk/src/core/queue.ts**

```typescript
import type { TrackerEvent } from '../types'

type FlushFn = (events: TrackerEvent[]) => Promise<void>

export class EventQueue {
  private items: TrackerEvent[] = []

  constructor(
    private readonly maxSize: number,
    private readonly onFlush: FlushFn,
  ) {}

  enqueue(event: TrackerEvent): void {
    if (this.items.length >= this.maxSize) {
      this.items.shift()  // 丢弃最旧
    }
    this.items.push(event)
  }

  async flush(): Promise<void> {
    if (this.items.length === 0) return
    const batch = this.items.splice(0)
    await this.onFlush(batch)
  }
}
```

- [ ] **Step 6: 运行测试确认通过**

```bash
bun test packages/sdk/src/__tests__/dedupe.test.ts packages/sdk/src/__tests__/queue.test.ts
```

Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add packages/sdk/src/core/dedupe.ts packages/sdk/src/core/queue.ts \
  packages/sdk/src/__tests__/dedupe.test.ts packages/sdk/src/__tests__/queue.test.ts
git commit -m "feat: DedupeFilter + EventQueue"
```
