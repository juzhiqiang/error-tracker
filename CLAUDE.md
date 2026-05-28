# Error Tracker — AI 开发指南

> 供 Claude Code / AI 助手阅读使用

## 项目概述

低配版 Sentry，独立 Monorepo。提供通用 SDK（browser ESM + Node.js CJS）+ NestJS API + Next.js Dashboard。
utils-plane 是第一个接入案例。

## 项目位置

```
D:\myProject\
├── unitls-plane\      现有项目（SDK 消费者）
└── error-tracker\     本项目
```

## 技术栈

| 层 | 技术 |
|----|------|
| 包管理 | Bun 1.3.13 + Turborepo 2 |
| API | NestJS 11 + Express（port 3002） |
| Web | Next.js 14 App Router + TailwindCSS + Radix UI（port 3003） |
| 数据库 | PostgreSQL 16 + Drizzle ORM |
| 对象存储 | MinIO（录屏 + Source Map） |
| 队列 | BullMQ + Redis |
| 认证 | Better-Auth（email+password） |
| SDK 打包 | `bun build`（browser ESM + node CJS 双产物） |
| 代码规范 | TypeScript strict + ESLint + Prettier |

## 快速开始

```bash
# 1. 启动 Docker 服务（PostgreSQL + MinIO）
bun run services:up

# 2. 安装依赖
bun install

# 3. 运行数据库 migration
cd apps/api && bunx drizzle-kit migrate

# 4. 开发模式（并行启动 api + web）
bun run dev
```

## 环境变量

复制 `.env.example` 为 `.env.local`：

```env
DATABASE_URL=postgresql://tracker:tracker@localhost:5433/error_tracker
MINIO_ENDPOINT=localhost
MINIO_PORT=9001
MINIO_ACCESS_KEY=tracker
MINIO_SECRET_KEY=tracker123
MINIO_BUCKET=error-tracker
NEXT_PUBLIC_API_URL=http://localhost:3002
BETTER_AUTH_SECRET=<openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:3003
```

## 常用命令

```bash
# Docker
bun run services:up       # 启动 PostgreSQL + MinIO
bun run services:down     # 停止
bun run services:reset    # 重置（清空数据）

# 开发
bun run dev               # 并行启动 api + web
cd apps/api && bun run dev
cd apps/web && bun run dev

# 测试
bun test packages/sdk     # SDK 单元测试
bun test                  # 全部测试

# 构建
bun run build
cd packages/sdk && bun run build   # 输出 dist/browser/ + dist/node/

# 数据库
cd apps/api && bunx drizzle-kit generate   # 生成 migration
cd apps/api && bunx drizzle-kit migrate    # 执行 migration
```

## 项目结构

```
error-tracker/
├── apps/
│   ├── api/                    NestJS API（port 3002）
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       ├── common/guards/  DsnAuthGuard + SessionGuard
│   │       ├── db/             Drizzle schema + DbModule
│   │       └── modules/
│   │           ├── ingest/     POST /ingest/:projectId/:token
│   │           ├── issues/     GET/PATCH /api/issues
│   │           ├── events/     GET /api/events/:id（含 source-map 反解）
│   │           ├── projects/   GET/POST /api/projects
│   │           ├── sourcemaps/ POST /api/sourcemaps/:projectId/:release
│   │           ├── stats/      GET /api/stats/issues + /performance
│   │           ├── alerts/     BullMQ Webhook worker
│   │           └── cleanup/    BullMQ 每日清理 worker
│   └── web/                    Next.js Dashboard（port 3003）
│       └── src/app/
│           ├── (auth)/login/   登录页
│           ├── (dashboard)/    需要登录的页面组
│           │   ├── page.tsx    概览
│           │   ├── issues/     错误列表 + 详情 + 录屏
│           │   ├── performance/ Web Vitals 趋势
│           │   └── settings/   DSN Token + Webhook 配置
│           └── lib/api.ts      API 客户端
└── packages/
    └── sdk/
        └── src/
            ├── index.ts        browser 入口
            ├── node.ts         Node.js 入口
            ├── types.ts        共享类型
            ├── core/           client, fingerprint, breadcrumbs, queue, dedupe, scope
            ├── transports/     HttpTransport（fetch + keepalive）
            ├── integrations/   browser-errors, browser-breadcrumbs, browser-performance, node-errors, react-error-boundary
            └── plugins/replay/ ReplayPlugin（rrweb 环形缓冲）
```

## SDK 架构要点

### 两层去重

**Layer 1 — SDK 端（5s TTL 内存 Map）**
- 相同指纹 5s 内只上报一次，防客户端刷屏
- 指纹：`djb2(error.name + error.message + 前3帧 function@filename)`，不含行列号

**Layer 2 — 服务端（ON CONFLICT UPSERT）**
- 服务端重新计算指纹（防客户端篡改）
- 相同指纹 → `count++, lastSeen = now()`
- 已 resolved 的 issue 再次出现 → 自动重新打开

### SDK 初始化

```typescript
// browser
import { init } from '@error-tracker/sdk'
import { ReplayPlugin } from '@error-tracker/sdk/plugins/replay'
init({ dsn: 'http://localhost:3002/ingest/<projectId>/<token>', environment: 'production' })

// Node.js
import { init } from '@error-tracker/sdk/node'
init({ dsn: process.env.ERROR_TRACKER_DSN })
```

### DSN 格式

```
http://localhost:3002/ingest/<projectId>/<dsnToken>
```

`/ingest/*` 公开（DSN Token 鉴权），`/api/*` 需要 Better-Auth session。

## 数据库 Schema 概览

```
projects            项目（含 webhookUrl, alertThreshold, retentionDays）
issues              聚合错误（相同指纹合并，status: unresolved|resolved|ignored）
events              原始上报事件（stacktrace/breadcrumbs/request/user 均为 JSONB）
replays             录屏引用（storageUrl 指向 MinIO）
performance_metrics Web Vitals（LCP/FID/CLS/INP/TTFB，含 rating）
source_maps         Source Map 文件引用（MinIO 存储）
```

## 开发规范

### 文件命名
- NestJS 模块：`*.module.ts`, `*.service.ts`, `*.controller.ts`, `*.processor.ts`
- React 组件：`PascalCase.tsx`
- 工具函数：`camelCase.ts`

### Git 提交风格
```
feat: 新功能
fix: 修复 bug
update: 更新现有功能
refactor: 重构
docs: 文档
test: 测试
```

### 安全注意事项
- `/ingest/*` 路由只用 DSN Token 鉴权，不需要 session
- `/api/*` 路由必须加 `@UseGuards(SessionGuard)`
- 不要在日志里打印 DSN Token 或 BETTER_AUTH_SECRET

## 调试

```bash
# 查看 Docker 日志
docker compose logs -f postgres
docker compose logs -f minio

# 测试数据库连接
docker exec -it error-tracker-pg psql -U tracker -d error_tracker -c "SELECT 1"

# 手动上报测试事件
curl -X POST http://localhost:3002/ingest/<projectId>/<token> \
  -H 'Content-Type: application/json' \
  -d '{"events":[{"eventId":"test-1","timestamp":1716800000000,"level":"error","message":"test","fingerprint":"fp1","stacktrace":[]}],"sentAt":"2026-05-28T00:00:00Z"}'
```

## 参考文档

- [设计文档](./docs/superpowers/specs/2026-05-27-error-tracker-design.md)
- [Plan 1: Monorepo + SDK](./docs/superpowers/plans/2026-05-28-01-scaffold-and-sdk.md)
- [Plan 2: API + Dashboard + 接入](./docs/superpowers/plans/2026-05-28-02-api-web-integration.md)
- [任务列表](./task/README.md)
