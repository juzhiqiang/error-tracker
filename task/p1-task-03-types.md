# Task P1-03: 类型定义

**计划：** Plan 1  
**依赖：** Task P1-02  
**可并行：** 是（与 Task 4, 5, 6, 7 并行）  
**预计时间：** 5 min

---

## 目标

定义 SDK 所有共享类型，供其他模块引用。

## 需要创建的文件

- `packages/sdk/src/types.ts`
- `packages/sdk/src/__tests__/types.test.ts`

## 步骤

- [x] **Step 1: 写测试**

创建 `packages/sdk/src/__tests__/types.test.ts`：

```typescript
import { describe, it, expect } from 'bun:test'
import type { ErrorEvent, BreadcrumbType, SdkOptions } from '../types'

describe('types', () => {
  it('ErrorEvent has required fields', () => {
    const event: ErrorEvent = {
      eventId: 'abc',
      timestamp: Date.now(),
      level: 'error',
      message: 'test',
      fingerprint: 'fp123',
      environment: 'production',
    }
    expect(event.eventId).toBe('abc')
  })

  it('BreadcrumbType union is correct', () => {
    const types: BreadcrumbType[] = ['ui.click', 'navigation', 'http', 'console', 'error']
    expect(types).toHaveLength(5)
  })
})
```

- [x] **Step 2: 运行测试确认失败**

```bash
cd D:/myProject/error-tracker
bun test packages/sdk/src/__tests__/types.test.ts
```

Expected: FAIL - "Cannot find module '../types'"

- [x] **Step 3: 创建 packages/sdk/src/types.ts**

```typescript
export type Level = 'fatal' | 'error' | 'warning' | 'info' | 'debug'

export type BreadcrumbType = 'ui.click' | 'navigation' | 'http' | 'console' | 'error'

export interface Breadcrumb {
  timestamp: number
  type: BreadcrumbType
  message?: string
  data?: Record<string, unknown>
}

export interface StackFrame {
  filename: string
  function: string
  lineno?: number
  colno?: number
  inApp?: boolean
}

export interface ErrorEvent {
  eventId: string
  timestamp: number
  level: Level
  message: string
  fingerprint: string
  environment?: string
  release?: string
  stacktrace?: StackFrame[]
  breadcrumbs?: Breadcrumb[]
  request?: {
    url?: string
    method?: string
    headers?: Record<string, string>
  }
  user?: {
    id?: string
    ip?: string
    userAgent?: string
  }
  tags?: Record<string, string>
}

export interface PerformanceEvent {
  eventId: string
  timestamp: number
  type: 'performance'
  name: 'LCP' | 'FID' | 'CLS' | 'INP' | 'TTFB'
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  url?: string
}

export type TrackerEvent = ErrorEvent | PerformanceEvent

export interface Integration {
  name: string
  setup(client: import('./core/client').ErrorTrackerClient): void
  teardown?(): void
}

export interface SdkOptions {
  dsn: string
  environment?: string
  release?: string
  sampleRate?: number        // 0.0 - 1.0, default 1.0
  integrations?: Integration[]
  beforeSend?: (event: ErrorEvent) => ErrorEvent | null
}
```

- [x] **Step 4: 运行测试确认通过**

```bash
bun test packages/sdk/src/__tests__/types.test.ts
```

Expected: PASS

- [x] **Step 5: 提交**

```bash
git add packages/sdk/src/types.ts packages/sdk/src/__tests__/types.test.ts
git commit -m "feat: sdk 类型定义"
```
