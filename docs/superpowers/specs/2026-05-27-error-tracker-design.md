# Error Tracker — 设计文档

**日期：** 2026-05-27  
**状态：** 已批准，待实现

---

## 背景与目标

utils-plane 目前依赖 NestJS 内置 Logger 输出到控制台，缺乏错误聚合、回溯和可视化能力。
本项目构建一个低配版 Sentry，提供：

- 通用 SDK（任意 browser / Node.js 项目可接入）
- 监控平台（接收、聚合、展示错误）
- utils-plane 作为第一个接入案例

---

## 项目位置

```
D:\myProject\
├── unitls-plane\      现有项目
└── error-tracker\     本项目（新建独立 Monorepo）
```

---

## 技术栈

| 层 | 技术 |
|----|------|
| 包管理 | Bun 1.3.13 + Turborepo |
| API | NestJS 11 + Express（port 3002） |
| Web | Next.js 14 App Router + TailwindCSS + Radix UI（port 3003） |
| 数据库 | PostgreSQL 16 + Drizzle ORM |
| 对象存储 | MinIO（存录屏文件） |
| SDK 打包 | `bun build`，browser ESM + node CJS 双产物 |
| Web Vitals | `web-vitals`（Google 官方，与 PageSpeed Insights 数据一致） |
| 代码规范 | TypeScript strict + ESLint + Prettier |

---

## 项目结构

```
error-tracker/
├── apps/
│   ├── api/                    NestJS API
│   └── web/                    Next.js Dashboard
├── packages/
│   └── sdk/
│       ├── src/
│       │   ├── core/           错误捕获、Breadcrumbs、队列
│       │   ├── transports/     HTTP 上报
│       │   ├── integrations/   React ErrorBoundary 等
│       │   └── plugins/
│       │       └── replay/     rrweb 环形缓冲插件
│       └── package.json        双入口 browser + node
├── package.json                Bun workspace
├── turbo.json
├── docker-compose.yml
└── .env.local
```

---

## SDK 设计

### 使用方式

```typescript
import { init } from '@error-tracker/sdk'
import { ReplayPlugin } from '@error-tracker/sdk/plugins/replay'

init({
  dsn: 'http://localhost:3002/ingest/<projectId>/<token>',
  environment: 'production',
  release: '1.0.0',
  sampleRate: 1.0,
  integrations: [
    new ReplayPlugin({ bufferSeconds: 30, sampleRate: 0.1 })
  ]
})
```

### core 模块

| 模块 | 职责 |
|------|------|
| `captureException` | 手动上报异常 |
| `captureMessage` | 手动上报消息 |
| `BreadcrumbManager` | 环形队列，保留最近 100 条操作记录 |
| `EventQueue` | 待上报队列，上限 50 条，满时丢弃最旧 |
| `Fingerprint` | 基于 error.message + 调用栈生成错误指纹 |
| `HttpTransport` | fetch fire-and-forget；卸载时用 `fetch keepalive` |
| `performance` | 调用 `web-vitals` 采集 LCP/FID/CLS/INP/TTFB，上报 rating 分级 |

### 自动捕获 — 浏览器

- `window.onerror` — 未捕获 JS 错误
- `unhandledrejection` — 未处理 Promise 拒绝
- `click` 事件 — 用户操作 Breadcrumb
- `popstate / hashchange` — 路由跳转 Breadcrumb
- `fetch / XMLHttpRequest` patch — 网络请求 Breadcrumb
- `console.error/warn` patch — 控制台日志 Breadcrumb
- `web-vitals`（Google 官方库）— LCP、FID、CLS、INP、TTFB，自动处理边界情况和分级

### 自动捕获 — Node.js

- `process.on('uncaughtException')`
- `process.on('unhandledRejection')`
- 可选 NestJS 中间件注入请求上下文

### replay 插件

策略：持续录制，只在出错时上传（环形缓冲）。

```typescript
class ReplayPlugin {
  private buffer: CircularBuffer  // 保留最近 bufferSeconds 内的 rrweb 事件

  onError(eventId: string) {
    const clip = this.buffer.drain()
    uploadReplay(eventId, clip)   // POST /ingest/:projectId/replay
  }
}
```

- 录屏文件上传到 MinIO，DB 只存 URL 引用
- 默认 mask 所有 `input[type=password]`

### 去重 & 限流

- 相同指纹 5s 内只上报一次（内存 Map + TTL）
- 队列满时丢弃最旧，不阻塞主线程
- `visibilitychange` 切后台时立即 flush 队列

---

## 服务端设计

### 数据库 Schema

```
projects            项目管理
  id, name, slug, dsnToken, createdAt

issues              聚合错误（相同指纹合并）
  id, projectId, fingerprint, title, level
  status(unresolved|resolved|ignored)
  firstSeen, lastSeen, count, userCount

events              原始上报事件
  id, issueId, projectId, timestamp, level
  message, stacktrace(JSONB), breadcrumbs(JSONB)
  request(JSONB), user(JSONB), tags(JSONB)
  environment, release

replays             录屏引用
  id, eventId, storageUrl, duration, createdAt

performance_metrics  Web Vitals
  id, projectId, name, value, rating, url, timestamp
```

### 核心接口

```
POST /ingest/:projectId           事件上报（DSN Token 鉴权）
POST /ingest/:projectId/replay    录屏上报（multipart）

GET  /api/projects                项目列表
POST /api/projects                创建项目（返回 DSN Token）

GET  /api/issues                  错误列表（分页、状态过滤）
GET  /api/issues/:id              错误详情
PATCH /api/issues/:id             更新状态
GET  /api/issues/:id/events       原始事件列表

GET  /api/events/:id              单事件详情（含 breadcrumbs）
GET  /api/events/:id/replay       录屏播放 URL

GET  /api/stats/issues            错误趋势
GET  /api/stats/performance       Web Vitals 统计
```

### 事件接收流程

```
POST /ingest/:projectId
  → DSN Token 验证
  → server 端重新计算指纹
  → UPSERT issues（相同指纹 count++，更新 lastSeen）
  → INSERT events
  → 202 Accepted（BullMQ 异步处理，不阻塞响应）
```

---

## Dashboard 页面

| 路由 | 页面 | 核心内容 |
|------|------|---------|
| `/` | 概览 | 错误总数、影响用户数、趋势折线图 |
| `/issues` | 错误列表 | 标题、次数、影响用户、最近时间、状态 |
| `/issues/:id` | 错误详情 | Stack Trace、Breadcrumbs 时间线、用户/环境信息 |
| `/issues/:id/replay` | 录屏回放 | rrweb-player 内嵌 |
| `/performance` | 性能概览 | LCP/FID/CLS/INP/TTFB 趋势、接口 P50/P95，按 good/needs-improvement/poor 分级展示 |
| `/settings` | 项目设置 | DSN Token、采样率、告警规则 |

---

## utils-plane 接入

```typescript
// apps/web/src/app/layout.tsx
init({
  dsn: process.env.NEXT_PUBLIC_ERROR_TRACKER_DSN,
  environment: process.env.NODE_ENV,
  integrations: [new ReplayPlugin({ bufferSeconds: 30 })]
})

// apps/api/src/main.ts
import { init } from '@error-tracker/sdk/node'
init({ dsn: process.env.ERROR_TRACKER_DSN })
```

开发阶段通过 `workspace:*` 本地引用 SDK，无需发布 npm。

---

## 实现阶段

1. Monorepo 脚手架（package.json、turbo.json、docker-compose、tsconfig）
2. packages/sdk core（错误捕获、Breadcrumbs、HttpTransport、EventQueue）
3. packages/sdk replay 插件（rrweb 环形缓冲、MinIO 上传）
4. apps/api（NestJS 模块：ingest、issues、events、projects、stats）
5. apps/web（Dashboard：issues 列表、详情、replay、性能）
6. utils-plane 接入（SDK 引入、DSN 配置、React Error Boundary）

---

## 验证方式

1. 启动 error-tracker 和 Docker 服务
2. 在 utils-plane 前端触发 `throw new Error('test')`
3. Dashboard `/issues` 出现该错误
4. 进入详情确认 Stack Trace 和 Breadcrumbs
5. 触发带录屏的错误，确认 `/issues/:id/replay` 可播放
6. 访问 `/performance` 确认 LCP/CLS 数据
