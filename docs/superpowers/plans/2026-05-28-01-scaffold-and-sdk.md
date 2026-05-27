# Error Tracker Plan 1: Monorepo 脚手架 + SDK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 error-tracker monorepo 基础结构，实现可在任意 browser/Node.js 项目中使用的 SDK，包含错误捕获、Breadcrumbs、两层去重、web-vitals、HTTP 上报、rrweb 环形缓冲录屏插件。

**Architecture:** Bun workspace + Turborepo monorepo，`packages/sdk` 输出 browser ESM + node CJS 双产物。SDK 核心是插件化设计：`init()` 接收 `integrations` 数组，每个 integration 实现统一接口。两层去重：SDK 端 5s TTL 内存 Map，服务端 ON CONFLICT UPSERT（在 Plan 2 实现）。

**Tech Stack:** Bun 1.3.13, Turborepo 2, TypeScript strict, rrweb 2.x, web-vitals 4.x, bun build (browser ESM + node CJS)

---

## 文件结构

```
error-tracker/
├── package.json                          # Bun workspace root
├── turbo.json                            # Turborepo pipeline
├── tsconfig.base.json                    # 共享 TS 配置
├── .gitignore
├── docker-compose.yml                    # PostgreSQL + MinIO（供后续 Plan 使用）
├── .env.example
└── packages/
    └── sdk/
        ├── package.json                  # 双入口 exports
        ├── tsconfig.json
        ├── src/
        │   ├── index.ts                  # browser 入口，re-export core + 注册浏览器捕获
        │   ├── node.ts                   # Node.js 入口，re-export core + 注册 process 捕获
        │   ├── types.ts                  # 所有共享类型定义
        │   ├── core/
        │   │   ├── client.ts             # ErrorTrackerClient 主类，持有所有状态
        │   │   ├── fingerprint.ts        # clientFingerprint() 函数
        │   │   ├── breadcrumbs.ts        # BreadcrumbManager 环形队列
        │   │   ├── queue.ts              # EventQueue 上报队列
        │   │   ├── dedupe.ts             # DedupeFilter 5s TTL
        │   │   └── scope.ts              # Scope：当前用户/标签上下文
        │   ├── transports/
        │   │   └── http.ts               # HttpTransport: fetch + keepalive fallback
        │   ├── integrations/
        │   │   ├── browser-errors.ts     # window.onerror + unhandledrejection
        │   │   ├── browser-breadcrumbs.ts # click/nav/fetch/console patch
        │   │   ├── browser-performance.ts # web-vitals onLCP/FID/CLS/INP/TTFB
        │   │   ├── node-errors.ts        # uncaughtException + unhandledRejection
        │   │   └── react-error-boundary.tsx # React ErrorBoundary component
        │   └── plugins/
        │       └── replay/
        │           ├── index.ts          # ReplayPlugin 类
        │           ├── circular-buffer.ts # CircularBuffer<rrweb.eventWithTime>
        │           └── upload.ts         # uploadReplay() → POST /ingest/:projectId/replay
        └── dist/                         # bun build 产物（gitignore）
```

---

### Task 1: Monorepo 脚手架

**Files:**
- Create: `error-tracker/package.json`
- Create: `error-tracker/turbo.json`
- Create: `error-tracker/tsconfig.base.json`
- Create: `error-tracker/.gitignore`
- Create: `error-tracker/docker-compose.yml`
- Create: `error-tracker/.env.example`

- [ ] **Step 1: 创建 root package.json**

```json
{
  "name": "error-tracker",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "services:up": "docker compose up -d",
    "services:down": "docker compose down",
    "services:reset": "docker compose down -v && docker compose up -d"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.7.0",
    "@types/node": "^22.0.0"
  },
  "packageManager": "bun@1.3.13"
}
```

- [ ] **Step 2: 创建 turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "persistent": true,
      "cache": false
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

- [ ] **Step 3: 创建 tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  }
}
```

- [ ] **Step 4: 创建 .gitignore**

```
node_modules/
dist/
.env.local
*.env.local
.turbo/
```

- [ ] **Step 5: 创建 docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: error-tracker-pg
    environment:
      POSTGRES_USER: tracker
      POSTGRES_PASSWORD: tracker
      POSTGRES_DB: error_tracker
    ports:
      - "5433:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  minio:
    image: minio/minio:latest
    container_name: error-tracker-minio
    command: server /data --console-address ":9002"
    environment:
      MINIO_ROOT_USER: tracker
      MINIO_ROOT_PASSWORD: tracker123
    ports:
      - "9001:9000"
      - "9002:9002"
    volumes:
      - minio_data:/data

volumes:
  postgres_data:
  minio_data:
```

- [ ] **Step 6: 创建 .env.example**

```env
DATABASE_URL=postgresql://tracker:tracker@localhost:5433/error_tracker
MINIO_ENDPOINT=localhost
MINIO_PORT=9001
MINIO_ACCESS_KEY=tracker
MINIO_SECRET_KEY=tracker123
MINIO_BUCKET=error-tracker
NEXT_PUBLIC_API_URL=http://localhost:3002
BETTER_AUTH_SECRET=change-me-use-openssl-rand-base64-32
BETTER_AUTH_URL=http://localhost:3003
```

- [ ] **Step 7: 初始化 git 并提交**

```bash
cd D:/myProject/error-tracker
git add package.json turbo.json tsconfig.base.json .gitignore docker-compose.yml .env.example
git commit -m "feat: monorepo 脚手架"
```

---

### Task 2: SDK package.json + tsconfig

**Files:**
- Create: `packages/sdk/package.json`
- Create: `packages/sdk/tsconfig.json`

- [ ] **Step 1: 创建 packages/sdk/package.json**

```json
{
  "name": "@error-tracker/sdk",
  "version": "0.1.0",
  "private": false,
  "type": "module",
  "exports": {
    ".": {
      "browser": "./dist/browser/index.js",
      "import": "./dist/browser/index.js",
      "require": "./dist/node/index.cjs"
    },
    "./node": {
      "import": "./dist/node/index.js",
      "require": "./dist/node/index.cjs"
    },
    "./plugins/replay": {
      "browser": "./dist/browser/plugins/replay/index.js",
      "import": "./dist/browser/plugins/replay/index.js"
    }
  },
  "scripts": {
    "build": "bun run build:browser && bun run build:node",
    "build:browser": "bun build src/index.ts --outdir dist/browser --target browser --format esm --sourcemap",
    "build:node": "bun build src/node.ts --outdir dist/node --target node --format cjs --sourcemap",
    "dev": "bun run build --watch",
    "test": "bun test",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "web-vitals": "^4.0.0",
    "rrweb": "^2.0.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/node": "^22.0.0"
  },
  "peerDependencies": {
    "react": ">=18.0.0"
  },
  "peerDependenciesMeta": {
    "react": { "optional": true }
  }
}
```

- [ ] **Step 2: 创建 packages/sdk/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "jsx": "react-jsx"
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules"]
}
```

- [ ] **Step 3: 安装依赖**

```bash
cd D:/myProject/error-tracker
bun install
```

Expected: `node_modules` 创建，`web-vitals` 和 `rrweb` 安装成功

- [ ] **Step 4: 提交**

```bash
git add packages/sdk/package.json packages/sdk/tsconfig.json bun.lockb
git commit -m "feat: sdk package 配置"
```

---

### Task 3: 类型定义

**Files:**
- Create: `packages/sdk/src/types.ts`

- [ ] **Step 1: 写测试**

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

- [ ] **Step 2: 运行测试确认失败**

```bash
cd D:/myProject/error-tracker
bun test packages/sdk/src/__tests__/types.test.ts
```

Expected: FAIL - "Cannot find module '../types'"

- [ ] **Step 3: 创建 packages/sdk/src/types.ts**

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

- [ ] **Step 4: 运行测试确认通过**

```bash
bun test packages/sdk/src/__tests__/types.test.ts
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add packages/sdk/src/types.ts packages/sdk/src/__tests__/types.test.ts
git commit -m "feat: sdk 类型定义"
```

---

### Task 4: Fingerprint 指纹计算

**Files:**
- Create: `packages/sdk/src/core/fingerprint.ts`
- Create: `packages/sdk/src/__tests__/fingerprint.test.ts`

- [ ] **Step 1: 写测试**

```typescript
import { describe, it, expect } from 'bun:test'
import { clientFingerprint, parseStackFrames } from '../core/fingerprint'

describe('clientFingerprint', () => {
  it('same error produces same fingerprint', () => {
    const error = new Error('Cannot read properties of undefined')
    const fp1 = clientFingerprint(error)
    const fp2 = clientFingerprint(error)
    expect(fp1).toBe(fp2)
  })

  it('different messages produce different fingerprints', () => {
    const e1 = new Error('error one')
    const e2 = new Error('error two')
    expect(clientFingerprint(e1)).not.toBe(clientFingerprint(e2))
  })

  it('returns hex string of length 8', () => {
    const fp = clientFingerprint(new Error('test'))
    expect(fp).toMatch(/^[0-9a-f]{8}$/)
  })

  it('ignores line/column numbers - same function at different lines same fingerprint', () => {
    const e1 = new Error('test')
    // Manually override stack to simulate different builds
    e1.stack = `Error: test\n    at handleSubmit (main.abc.js:87:12)\n    at onClick (app.js:34:5)`
    const e2 = new Error('test')
    e2.stack = `Error: test\n    at handleSubmit (main.xyz.js:99:45)\n    at onClick (app.js:60:3)`
    expect(clientFingerprint(e1)).toBe(clientFingerprint(e2))
  })
})

describe('parseStackFrames', () => {
  it('parses V8 stack trace', () => {
    const stack = `Error: test\n    at handleSubmit (src/Form.tsx:87:12)\n    at onClick (src/App.tsx:34:5)`
    const frames = parseStackFrames(stack)
    expect(frames[0]).toEqual({ function: 'handleSubmit', filename: 'src/Form.tsx', lineno: 87, colno: 12 })
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
bun test packages/sdk/src/__tests__/fingerprint.test.ts
```

Expected: FAIL - "Cannot find module '../core/fingerprint'"

- [ ] **Step 3: 创建 packages/sdk/src/core/fingerprint.ts**

```typescript
import type { StackFrame } from '../types'

export function parseStackFrames(stack: string): StackFrame[] {
  const lines = stack.split('\n').slice(1)  // 跳过第一行 "Error: message"
  return lines.slice(0, 10).map(line => {
    // V8格式: "    at functionName (filename:line:col)"
    // 或:     "    at filename:line:col"
    const match = line.trim().match(/^at (?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?$/)
    if (!match) return { function: '<unknown>', filename: '<unknown>' }
    return {
      function: match[1] ?? '<anonymous>',
      filename: match[2],
      lineno: parseInt(match[3], 10),
      colno: parseInt(match[4], 10),
    }
  }).filter(f => f.filename !== '<unknown>')
}

// djb2 hash → 8 char hex
function djb2(str: string): string {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
    hash = hash >>> 0  // 保持 uint32
  }
  return hash.toString(16).padStart(8, '0')
}

export function clientFingerprint(error: Error): string {
  const frames = parseStackFrames(error.stack ?? '')
  // 只用文件名（不含路径 hash），去掉行列号，防止不同构建版本指纹不同
  const frameKey = frames.slice(0, 3)
    .map(f => `${f.function}@${f.filename.replace(/:[^:]*$/, '')}`)
    .join('|')
  return djb2(`${error.name}:${error.message}:${frameKey}`)
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
bun test packages/sdk/src/__tests__/fingerprint.test.ts
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add packages/sdk/src/core/fingerprint.ts packages/sdk/src/__tests__/fingerprint.test.ts
git commit -m "feat: sdk 指纹计算（djb2，忽略行列号）"
```

---

### Task 5: BreadcrumbManager 环形队列

**Files:**
- Create: `packages/sdk/src/core/breadcrumbs.ts`
- Create: `packages/sdk/src/__tests__/breadcrumbs.test.ts`

- [ ] **Step 1: 写测试**

```typescript
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
bun test packages/sdk/src/__tests__/breadcrumbs.test.ts
```

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

- [ ] **Step 5: 提交**

```bash
git add packages/sdk/src/core/breadcrumbs.ts packages/sdk/src/__tests__/breadcrumbs.test.ts
git commit -m "feat: BreadcrumbManager 环形队列"
```

---

### Task 6: DedupeFilter + EventQueue

**Files:**
- Create: `packages/sdk/src/core/dedupe.ts`
- Create: `packages/sdk/src/core/queue.ts`
- Create: `packages/sdk/src/__tests__/dedupe.test.ts`
- Create: `packages/sdk/src/__tests__/queue.test.ts`

- [ ] **Step 1: 写 DedupeFilter 测试**

```typescript
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
bun test packages/sdk/src/__tests__/dedupe.test.ts packages/sdk/src/__tests__/queue.test.ts
```

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

- [ ] **Step 7: 提交**

```bash
git add packages/sdk/src/core/dedupe.ts packages/sdk/src/core/queue.ts \
  packages/sdk/src/__tests__/dedupe.test.ts packages/sdk/src/__tests__/queue.test.ts
git commit -m "feat: DedupeFilter + EventQueue"
```

---

### Task 7: HttpTransport

**Files:**
- Create: `packages/sdk/src/transports/http.ts`
- Create: `packages/sdk/src/__tests__/http.test.ts`

- [ ] **Step 1: 写测试**

```typescript
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

- [ ] **Step 2: 运行测试确认失败**

```bash
bun test packages/sdk/src/__tests__/http.test.ts
```

- [ ] **Step 3: 创建 packages/sdk/src/transports/http.ts**

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

- [ ] **Step 4: 运行测试确认通过**

```bash
bun test packages/sdk/src/__tests__/http.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add packages/sdk/src/transports/http.ts packages/sdk/src/__tests__/http.test.ts
git commit -m "feat: HttpTransport（fetch fire-and-forget + keepalive）"
```

---

### Task 8: Scope + ErrorTrackerClient 主类

**Files:**
- Create: `packages/sdk/src/core/scope.ts`
- Create: `packages/sdk/src/core/client.ts`
- Create: `packages/sdk/src/__tests__/client.test.ts`

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

- [ ] **Step 2: 写 client 测试**

```typescript
import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { ErrorTrackerClient } from '../core/client'

describe('ErrorTrackerClient', () => {
  let sendCalls: unknown[] = []

  beforeEach(() => {
    sendCalls = []
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

- [ ] **Step 3: 运行测试确认失败**

```bash
bun test packages/sdk/src/__tests__/client.test.ts
```

- [ ] **Step 4: 创建 packages/sdk/src/core/client.ts**

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
      // 卸载时直接发，不走队列
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

- [ ] **Step 5: 创建 packages/sdk/src/core/utils.ts**

```typescript
export function randomId(): string {
  return Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
}
```

- [ ] **Step 6: 运行测试确认通过**

```bash
bun test packages/sdk/src/__tests__/client.test.ts
```

- [ ] **Step 7: 提交**

```bash
git add packages/sdk/src/core/scope.ts packages/sdk/src/core/client.ts \
  packages/sdk/src/core/utils.ts packages/sdk/src/__tests__/client.test.ts
git commit -m "feat: ErrorTrackerClient 主类（采样、去重、beforeSend）"
```

---

### Task 9: 浏览器 Integrations + web-vitals

**Files:**
- Create: `packages/sdk/src/integrations/browser-errors.ts`
- Create: `packages/sdk/src/integrations/browser-breadcrumbs.ts`
- Create: `packages/sdk/src/integrations/browser-performance.ts`

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
  private origXhrOpen?: typeof XMLHttpRequest.prototype.open

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
git add packages/sdk/src/integrations/
git commit -m "feat: 浏览器 integrations（错误捕获、Breadcrumbs、web-vitals）"
```

---

### Task 10: Node.js Integration + React ErrorBoundary

**Files:**
- Create: `packages/sdk/src/integrations/node-errors.ts`
- Create: `packages/sdk/src/integrations/react-error-boundary.tsx`

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
git add packages/sdk/src/integrations/node-errors.ts \
  packages/sdk/src/integrations/react-error-boundary.tsx
git commit -m "feat: Node.js integration + React ErrorBoundary"
```

---

### Task 11: SDK 入口文件（browser + node）

**Files:**
- Create: `packages/sdk/src/index.ts`
- Create: `packages/sdk/src/node.ts`

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
  _client = new ErrorTrackerClient({
    integrations: defaultIntegrations,
    ...options,
    integrations: [...defaultIntegrations, ...(options.integrations ?? [])],
  })
  _client.setupIntegrations()

  // 页面卸载时 flush 队列
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
git add packages/sdk/src/index.ts packages/sdk/src/node.ts packages/sdk/dist/
git commit -m "feat: sdk 入口文件，browser + node 双产物"
```

---

### Task 12: ReplayPlugin（rrweb 环形缓冲）

**Files:**
- Create: `packages/sdk/src/plugins/replay/circular-buffer.ts`
- Create: `packages/sdk/src/plugins/replay/upload.ts`
- Create: `packages/sdk/src/plugins/replay/index.ts`
- Create: `packages/sdk/src/__tests__/replay.test.ts`

- [ ] **Step 1: 写测试**

```typescript
import { describe, it, expect, mock } from 'bun:test'
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

- [ ] **Step 2: 运行测试确认失败**

```bash
bun test packages/sdk/src/__tests__/replay.test.ts
```

- [ ] **Step 3: 创建 packages/sdk/src/plugins/replay/circular-buffer.ts**

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

- [ ] **Step 4: 创建 packages/sdk/src/plugins/replay/upload.ts**

```typescript
interface RrwebEvent {
  timestamp: number
  type: number
  data: unknown
}

export async function uploadReplay(
  ingestBase: string,
  projectId: string,
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

- [ ] **Step 5: 创建 packages/sdk/src/plugins/replay/index.ts**

```typescript
import { record } from 'rrweb'
import type { Integration } from '../../types'
import type { ErrorTrackerClient } from '../../core/client'
import { CircularBuffer } from './circular-buffer'
import { uploadReplay } from './upload'

export interface ReplayPluginOptions {
  bufferSeconds?: number    // default 30
  sampleRate?: number       // 0.0-1.0, what % of sessions to record, default 1.0
}

export class ReplayPlugin implements Integration {
  name = 'Replay'
  private buffer: CircularBuffer
  private stopFn?: () => void
  private client?: ErrorTrackerClient
  private dsnBase = ''
  private readonly sampleRate: number

  constructor(private readonly opts: ReplayPluginOptions = {}) {
    this.buffer = new CircularBuffer((opts.bufferSeconds ?? 30) * 1000)
    this.sampleRate = opts.sampleRate ?? 1.0
  }

  setup(client: ErrorTrackerClient): void {
    if (Math.random() > this.sampleRate) return

    this.client = client
    // Extract base URL from DSN (remove last two path segments /projectId/token)
    const url = new URL((client as unknown as { options: { dsn: string } }).options?.dsn ?? '')
    const parts = url.pathname.split('/')
    this.dsnBase = `${url.origin}${parts.slice(0, -2).join('/')}`

    this.stopFn = record({
      emit: (event) => this.buffer.push(event as { timestamp: number; type: number; data: unknown }),
      maskAllInputs: true,        // 隐私保护：mask 所有 input
      maskTextSelector: '[data-sensitive]',
    })

    // hook 进 client 的 captureException
    const origCapture = client.captureException.bind(client)
    client.captureException = (error: Error, extra?: Record<string, unknown>) => {
      origCapture(error, extra)
      // 触发上传
      const events = this.buffer.drain()
      if (events.length > 0) {
        const eventId = extra?.eventId as string | undefined ?? Date.now().toString()
        uploadReplay(this.dsnBase, '', eventId, events)
      }
    }
  }

  teardown(): void {
    this.stopFn?.()
  }
}
```

- [ ] **Step 6: 运行测试确认通过**

```bash
bun test packages/sdk/src/__tests__/replay.test.ts
```

- [ ] **Step 7: 完整测试套件**

```bash
bun test packages/sdk
```

Expected: 全部通过

- [ ] **Step 8: 重新构建（含 replay 插件）**

```bash
cd packages/sdk && bun run build
```

- [ ] **Step 9: 提交**

```bash
git add packages/sdk/src/plugins/ packages/sdk/src/__tests__/replay.test.ts packages/sdk/dist/
git commit -m "feat: ReplayPlugin（rrweb 环形缓冲，30s，错误触发上传）"
```

---

### Task 13: 同步更新设计文档

- [ ] **Step 1: 更新 docs/superpowers/specs/2026-05-27-error-tracker-design.md**

在"去重 & 限流"章节补充两层去重的完整描述（已在计划里定义，和代码对齐即可）。

- [ ] **Step 2: 提交**

```bash
git add docs/
git commit -m "docs: 同步 SDK 实现细节到设计文档"
```

---

## 验证方式

```bash
# 1. 全部测试通过
cd D:/myProject/error-tracker && bun test packages/sdk
# Expected: all tests pass

# 2. SDK 构建成功
cd packages/sdk && bun run build
# Expected: dist/browser/index.js 和 dist/node/index.cjs 存在

# 3. 浏览器 smoke test（在 HTML 文件里引用 dist/browser/index.js）
# init({ dsn: 'http://localhost:3002/ingest/p1/t1' })
# throw new Error('test')
# → 浏览器控制台不应有报错，应看到 1 次 POST 请求

# 4. Node.js smoke test
# import { init } from './dist/node/index.cjs'
# init({ dsn: 'http://localhost:3002/ingest/p1/t1' })
# throw new Error('node test')
```
