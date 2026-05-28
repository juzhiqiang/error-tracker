# Task P1-10: Node.js Integration + React ErrorBoundary

**计划：** Plan 1  
**依赖：** Task P1-08  
**可并行：** 是（与 Task P1-09 并行）  
**预计时间：** 10 min

---

## 目标

实现 Node.js 端自动捕获 integration 和 React ErrorBoundary 组件。

## 需要创建的文件

- `packages/sdk/src/integrations/node-errors.ts`
- `packages/sdk/src/integrations/react-error-boundary.tsx`

## 步骤

- [ ] **Step 1: 创建 packages/sdk/src/integrations/node-errors.ts**

```typescript
import type { Integration } from '../types'
import type { ErrorTrackerClient } from '../core/client'

export class NodeErrorsIntegration implements Integration {
  name = 'NodeErrors'

  setup(client: ErrorTrackerClient): void {
    process.on('uncaughtException', (error: Error) => {
      client.captureException(error)
      // 给队列 100ms 发送，然后允许进程退出
      setTimeout(() => process.exit(1), 100)
    })

    process.on('unhandledRejection', (reason: unknown) => {
      const error = reason instanceof Error
        ? reason
        : new Error(String(reason))
      client.captureException(error)
    })
  }
}
```

- [ ] **Step 2: 创建 packages/sdk/src/integrations/react-error-boundary.tsx**

```typescript
import React from 'react'
import type { ErrorTrackerClient } from '../core/client'

interface Props {
  client: ErrorTrackerClient
  fallback?: React.ReactNode
  children: React.ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    this.props.client.captureException(error, {
      componentStack: info.componentStack ?? undefined,
    })
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? React.createElement('div', null, 'Something went wrong.')
    }
    return this.props.children
  }
}
```

- [ ] **Step 3: 提交**

```bash
cd D:/myProject/error-tracker
git add packages/sdk/src/integrations/node-errors.ts \
  packages/sdk/src/integrations/react-error-boundary.tsx
git commit -m "feat: Node.js integration + React ErrorBoundary"
```
