# Task P1-11: SDK 入口文件（browser + node）

**计划：** Plan 1  
**依赖：** Task P1-09, P1-10（全部完成后才能开始）  
**可并行：** 否  
**预计时间：** 10 min

---

## 目标

创建 browser 和 Node.js 双入口文件，注册默认 integrations，暴露 `init()` / `captureException()` / `captureMessage()` 顶层 API。

**注意：** 原计划代码中 `index.ts` 有一个 bug：`integrations` 字段被赋值两次，第二次覆盖第一次。下面的代码已修复。

## 需要创建的文件

- `packages/sdk/src/index.ts`
- `packages/sdk/src/node.ts`

## 步骤

- [ ] **Step 1: 创建 packages/sdk/src/index.ts（browser 入口）**

```typescript
import { ErrorTrackerClient } from './core/client'
import { BrowserErrorsIntegration } from './integrations/browser-errors'
import { BrowserBreadcrumbsIntegration } from './integrations/browser-breadcrumbs'
import { BrowserPerformanceIntegration } from './integrations/browser-performance'
import type { SdkOptions } from './types'

export { ErrorBoundary } from './integrations/react-error-boundary'
export { ErrorTrackerClient } from './core/client'
export type { SdkOptions, Integration, ErrorEvent, Breadcrumb } from './types'

let _client: ErrorTrackerClient | null = null

export function init(options: SdkOptions): ErrorTrackerClient {
  const defaultIntegrations = [
    new BrowserErrorsIntegration(),
    new BrowserBreadcrumbsIntegration(),
    new BrowserPerformanceIntegration(),
  ]
  // 注意：合并 defaultIntegrations 和用户传入的 integrations
  _client = new ErrorTrackerClient({
    ...options,
    integrations: [...defaultIntegrations, ...(options.integrations ?? [])],
  })
  _client.setupIntegrations()

  // 页面切后台时立即 flush 队列（比 beforeunload 更可靠）
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      _client?.flush(true)
    }
  })

  return _client
}

export function captureException(error: Error): void {
  _client?.captureException(error)
}

export function captureMessage(message: string): void {
  _client?.captureMessage(message)
}

export function getClient(): ErrorTrackerClient | null {
  return _client
}
```

- [ ] **Step 2: 创建 packages/sdk/src/node.ts（Node.js 入口）**

```typescript
import { ErrorTrackerClient } from './core/client'
import { NodeErrorsIntegration } from './integrations/node-errors'
import type { SdkOptions } from './types'

export { ErrorTrackerClient } from './core/client'
export type { SdkOptions, Integration, ErrorEvent } from './types'

let _client: ErrorTrackerClient | null = null

export function init(options: SdkOptions): ErrorTrackerClient {
  _client = new ErrorTrackerClient({
    integrations: [new NodeErrorsIntegration()],
    ...options,
  })
  _client.setupIntegrations()
  return _client
}

export function captureException(error: Error): void {
  _client?.captureException(error)
}

export function captureMessage(message: string): void {
  _client?.captureMessage(message)
}
```

- [ ] **Step 3: 运行完整测试套件**

```bash
cd D:/myProject/error-tracker
bun test packages/sdk
```

Expected: 所有测试通过

- [ ] **Step 4: 构建 SDK**

```bash
cd packages/sdk && bun run build
```

Expected: `dist/browser/index.js` 和 `dist/node/index.cjs` 生成成功

- [ ] **Step 5: 提交**

```bash
git add packages/sdk/src/index.ts packages/sdk/src/node.ts
git commit -m "feat: sdk 入口文件，browser + node 双产物"
```
