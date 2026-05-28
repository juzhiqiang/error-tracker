# Task P1-05: BreadcrumbManager 环形队列

**计划：** Plan 1  
**依赖：** Task P1-02（Task P1-03 需同步完成）  
**可并行：** 是（与 Task 3, 4, 6, 7 并行）  
**预计时间：** 10 min

---

## 目标

实现 BreadcrumbManager，用环形队列保留最近 100 条用户操作记录。

## 需要创建的文件

- `packages/sdk/src/core/breadcrumbs.ts`
- `packages/sdk/src/__tests__/breadcrumbs.test.ts`

## 步骤

- [ ] **Step 1: 写测试**

```typescript
// packages/sdk/src/__tests__/breadcrumbs.test.ts
import { describe, it, expect } from 'bun:test'
import { BreadcrumbManager } from '../core/breadcrumbs'

describe('BreadcrumbManager', () => {
  it('stores breadcrumbs', () => {
    const mgr = new BreadcrumbManager(5)
    mgr.add({ timestamp: 1, type: 'ui.click', message: 'click' })
    expect(mgr.getAll()).toHaveLength(1)
  })

  it('caps at maxSize (circular buffer)', () => {
    const mgr = new BreadcrumbManager(3)
    for (let i = 0; i < 5; i++) {
      mgr.add({ timestamp: i, type: 'console', message: `msg${i}` })
    }
    const items = mgr.getAll()
    expect(items).toHaveLength(3)
    expect(items[0].message).toBe('msg2')
    expect(items[2].message).toBe('msg4')
  })

  it('clear resets the buffer', () => {
    const mgr = new BreadcrumbManager(5)
    mgr.add({ timestamp: 1, type: 'navigation' })
    mgr.clear()
    expect(mgr.getAll()).toHaveLength(0)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd D:/myProject/error-tracker
bun test packages/sdk/src/__tests__/breadcrumbs.test.ts
```

Expected: FAIL - "Cannot find module '../core/breadcrumbs'"

- [ ] **Step 3: 创建 packages/sdk/src/core/breadcrumbs.ts**

```typescript
import type { Breadcrumb } from '../types'

export class BreadcrumbManager {
  private buffer: Breadcrumb[]
  private head = 0
  private size = 0

  constructor(private readonly maxSize = 100) {
    this.buffer = new Array(maxSize)
  }

  add(crumb: Breadcrumb): void {
    this.buffer[this.head] = crumb
    this.head = (this.head + 1) % this.maxSize
    if (this.size < this.maxSize) this.size++
  }

  getAll(): Breadcrumb[] {
    if (this.size < this.maxSize) {
      return this.buffer.slice(0, this.size)
    }
    // 环形排列，从最旧到最新
    return [
      ...this.buffer.slice(this.head),
      ...this.buffer.slice(0, this.head),
    ]
  }

  clear(): void {
    this.head = 0
    this.size = 0
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
bun test packages/sdk/src/__tests__/breadcrumbs.test.ts
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add packages/sdk/src/core/breadcrumbs.ts packages/sdk/src/__tests__/breadcrumbs.test.ts
git commit -m "feat: BreadcrumbManager 环形队列"
```
