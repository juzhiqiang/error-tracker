# Task P1-09: 浏览器 Integrations + web-vitals

**计划：** Plan 1  
**依赖：** Task P1-08  
**可并行：** 是（与 Task P1-10 并行）  
**预计时间：** 15 min

---

## 目标

实现三个浏览器端自动捕获 integration：
- `BrowserErrorsIntegration`：捕获 `window.onerror` + `unhandledrejection`
- `BrowserBreadcrumbsIntegration`：patch click/nav/fetch/console
- `BrowserPerformanceIntegration`：用 `web-vitals` 采集 LCP/FID/CLS/INP/TTFB

## 需要创建的文件

- `packages/sdk/src/integrations/browser-errors.ts`
- `packages/sdk/src/integrations/browser-breadcrumbs.ts`
- `packages/sdk/src/integrations/browser-performance.ts`

## 步骤

- [ ] **Step 1: 创建 packages/sdk/src/integrations/browser-errors.ts**

```typescript
import type { Integration } from '../types'
import type { ErrorTrackerClient } from '../core/client'

export class BrowserErrorsIntegration implements Integration {
  name = 'BrowserErrors'
  private handlers: Array<[string, EventListenerOrEventListenerObject]> = []

  setup(client: ErrorTrackerClient): void {
    const onError = (event: ErrorEvent) => {
      if (event.error instanceof Error) {
        client.captureException(event.error)
      } else {
        client.captureException(new Error(event.message ?? 'Unknown error'))
      }
    }

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason))
      client.captureException(error)
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onUnhandledRejection)
    this.handlers.push(['error', onError], ['unhandledrejection', onUnhandledRejection])
  }

  teardown(): void {
    for (const [type, handler] of this.handlers) {
      window.removeEventListener(type, handler as EventListener)
    }
    this.handlers = []
  }
}
```

- [ ] **Step 2: 创建 packages/sdk/src/integrations/browser-breadcrumbs.ts**

```typescript
import type { Integration } from '../types'
import type { ErrorTrackerClient } from '../core/client'

export class BrowserBreadcrumbsIntegration implements Integration {
  name = 'BrowserBreadcrumbs'
  private origFetch?: typeof fetch

  setup(client: ErrorTrackerClient): void {
    // click breadcrumbs
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      client.breadcrumbs.add({
        timestamp: Date.now(),
        type: 'ui.click',
        message: `${target.tagName.toLowerCase()}${target.id ? '#' + target.id : ''}`,
        data: { text: target.textContent?.slice(0, 64) },
      })
    }, { passive: true, capture: true })

    // navigation breadcrumbs
    const addNav = () => client.breadcrumbs.add({
      timestamp: Date.now(),
      type: 'navigation',
      data: { to: location.href },
    })
    window.addEventListener('popstate', addNav)
    window.addEventListener('hashchange', addNav)

    // fetch patch
    this.origFetch = window.fetch
    window.fetch = async (...args) => {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url
      const method = (args[1]?.method ?? 'GET').toUpperCase()
      const start = Date.now()
      try {
        const res = await this.origFetch!(...args)
        client.breadcrumbs.add({
          timestamp: start,
          type: 'http',
          data: { url, method, status: res.status, duration: Date.now() - start },
        })
        return res
      } catch (err) {
        client.breadcrumbs.add({
          timestamp: start,
          type: 'http',
          data: { url, method, error: String(err) },
        })
        throw err
      }
    }

    // console patch
    for (const level of ['error', 'warn'] as const) {
      const orig = console[level].bind(console)
      console[level] = (...args: unknown[]) => {
        client.breadcrumbs.add({
          timestamp: Date.now(),
          type: 'console',
          message: args.map(String).join(' ').slice(0, 256),
          data: { level },
        })
        orig(...args)
      }
    }
  }

  teardown(): void {
    if (this.origFetch) window.fetch = this.origFetch
  }
}
```

- [ ] **Step 3: 创建 packages/sdk/src/integrations/browser-performance.ts**

```typescript
import { onLCP, onFID, onCLS, onINP, onTTFB } from 'web-vitals'
import type { Integration, PerformanceEvent } from '../types'
import type { ErrorTrackerClient } from '../core/client'
import { randomId } from '../core/utils'

export class BrowserPerformanceIntegration implements Integration {
  name = 'BrowserPerformance'

  setup(client: ErrorTrackerClient): void {
    const report = (metric: { name: string; value: number; rating: string }) => {
      const event: PerformanceEvent = {
        eventId: randomId(),
        timestamp: Date.now(),
        type: 'performance',
        name: metric.name as PerformanceEvent['name'],
        value: metric.value,
        rating: metric.rating as PerformanceEvent['rating'],
        url: location.href,
      }
      client.capturePerformance(event)
    }

    onLCP(report)
    onFID(report)
    onCLS(report)
    onINP(report)
    onTTFB(report)
  }
}
```

- [ ] **Step 4: 提交**

```bash
cd D:/myProject/error-tracker
git add packages/sdk/src/integrations/
git commit -m "feat: 浏览器 integrations（错误捕获、Breadcrumbs、web-vitals）"
```
