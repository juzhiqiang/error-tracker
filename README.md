# Error Tracker

Error Tracker 是一个自托管的错误监控、性能分析、Source Map 反解和会话回放平台。它面向工程、SRE、QA 和产品支持团队，目标是在一次生产异常发生后，把错误聚合、调用栈、用户行为轨迹、Web Vitals、版本信息和修复建议放到同一个可追踪的工作台里。

当前仓库是独立 monorepo，包含 SDK、NestJS API、Next.js Dashboard、Source Map CLI、运维脚本和端到端验证脚本。`unitls-plane` 是第一个真实接入样例项目。

## 当前完成度

Plan 1 和 Plan 2 的核心链路已经完成并验证：

- 浏览器 SDK：自动捕获 `window.onerror`、`unhandledrejection`、点击、导航、fetch breadcrumbs、Web Vitals 和 rrweb replay。
- Node SDK：捕获未处理异常和 rejection，并在异常发生后主动 flush。
- API：接收 error/performance/replay，聚合 issue，保存事件详情，处理 Source Map、成员权限、邀请、审计、队列运维、AI Advisor 和自监控。
- Dashboard：登录、项目设置、成员与权限、错误列表、错误详情、replay、性能、Source Map 文档、审计和运维页面。
- Source Map：支持控制台上传、CI 上传和 CLI 上传。
- utils-plane 集成：浏览器 SDK、Node SDK、Source Map 上传脚本和 replay 均已接入验证。
- 本地验证：migration、SDK/API 测试、web/api build、Source Map 上传和浏览器 e2e 已通过。

仍建议在正式生产前继续补强：

- 把关键 e2e 固化进 CI，而不是只依赖本地脚本。
- 按生产域名、HTTPS、反向代理和密钥管理重审环境配置。
- 为 Postgres、Redis、MinIO、API 和队列增加持续监控和告警。
- 定期演练备份恢复、Source Map 回滚、replay 清理和容量压测。
- 明确多租户配额、保留期、审计策略和数据导出策略。

## Monorepo 结构

```text
error-tracker/
├── apps/
│   ├── api/                 # NestJS API, default port 3002
│   └── web/                 # Next.js Dashboard, default port 3003
├── packages/
│   ├── sdk/                 # Browser + Node SDK
│   └── cli/                 # Source Map upload CLI
├── scripts/
│   ├── e2e/                 # Local stack + Playwright style verification helpers
│   ├── load/                # Ingest, replay, sourcemap, dashboard load scripts
│   └── ops/                 # Backup and restore scripts
├── docs/
│   ├── operations/          # Runbooks, capacity baseline, restore reports
│   └── superpowers/         # Plans and design specs
├── task/                    # Task-by-task implementation records
├── docker-compose.yml       # Postgres, Redis, MinIO for local development
├── package.json             # Workspace scripts
├── PRODUCT.md               # Product and UX principles
└── AGENTS.md                # AI agent execution guide
```

## Runtime Architecture

```text
Customer app / service
  ├─ Browser SDK
  │   ├─ errors + breadcrumbs + web vitals
  │   └─ rrweb replay buffer
  └─ Node SDK
      └─ exceptions + unhandled rejections
        │
        ▼
API ingest endpoints
  ├─ POST /ingest/:projectId/:token
  └─ POST /ingest/:projectId/:token/replay
        │
        ├─ PostgreSQL: projects, issues, events, metrics, members, audit
        ├─ Redis/BullMQ: alert, cleanup and operations queues
        └─ MinIO: replay payloads and Source Map objects
        │
        ▼
Next.js Dashboard
  ├─ issues, event detail, replay, performance
  ├─ settings, members, invitations, source maps
  ├─ audit logs and queue operations
  └─ AI Advisor for error and performance suggestions
```

## Applications

### `apps/api`

NestJS 11 API 服务，默认监听 `http://localhost:3002`。

Main responsibilities:

- `ingest`: DSN token 认证、body size 限制、项目级限流、事件校验、PII scrub、error/performance/replay 入库。
- `issues`: issue 列表、详情、状态更新和事件分页。
- `events`: event 详情、Source Map 反解、replay 读取。
- `sourcemaps`: 控制台上传、CI 上传、删除和 MinIO 存储。
- `projects`: 项目创建、token 轮换、成员管理、邀请、角色切换和移除。
- `organizations`: 组织、团队、团队成员和项目绑定。
- `stats`: issue 趋势和 Web Vitals 统计。
- `ai`: 错误修复建议和性能优化建议，支持本地规则引擎和 OpenAI provider。
- `alerts` / `cleanup`: BullMQ worker，负责告警和数据生命周期处理。
- `operations`: 队列状态、失败任务重试和删除。
- `audit`: 审计日志查询和 CSV 导出。
- `auth`: Better-Auth 邮箱密码登录，挂载在 `/api/auth/*`。
- `self-monitoring`: 平台自身异常捕获，可通过 DSN 上报到自己的项目。
- `health`: API、DB、Redis、MinIO 和队列健康检查。

Important API routes:

```text
POST   /ingest/:projectId/:token
POST   /ingest/:projectId/:token/replay
GET    /health
GET    /api/issues
GET    /api/issues/:id
GET    /api/issues/:id/events
PATCH  /api/issues/:id
GET    /api/events/:id
GET    /api/events/:id/replay
GET    /api/stats/issues
GET    /api/stats/performance
POST   /api/issues/:id/ai-analysis
POST   /api/stats/performance/ai-analysis
GET    /api/projects
POST   /api/projects
POST   /api/projects/:id/rotate-token
GET    /api/projects/:projectId/members
POST   /api/projects/:projectId/members
PATCH  /api/projects/:projectId/members/:userId
DELETE /api/projects/:projectId/members/:userId
POST   /api/sourcemaps/:projectId/:release
POST   /api/sourcemaps/:projectId/:release/ci
DELETE /api/sourcemaps/:projectId/:release
GET    /api/audit-logs
GET    /api/audit-logs/export.csv
GET    /api/operations/queues
```

### `apps/web`

Next.js 14 Dashboard，默认监听 `http://localhost:3003`。

Primary routes:

```text
/welcome                         # 产品介绍页
/login                           # 登录
/accept-invite/:token            # 接受项目邀请
/                                # Dashboard overview
/issues                          # Issue 列表
/issues/:id                      # Issue 详情
/issues/:id/replay               # rrweb replay 播放
/performance                     # Web Vitals 性能页
/settings                        # 项目、成员、DSN、Source Map 设置
/docs                            # SDK 接入文档
/audit                           # 审计日志
/operations                      # 队列运维
```

Dashboard 设计原则见 [PRODUCT.md](./PRODUCT.md)。当前 UI 目标是专业密集型观测平台：信息优先、状态清晰、减少装饰性页面，支持亮色/暗色模式和国际化。

## Packages

### `packages/sdk`

`@error-tracker/sdk` 同时提供 browser 和 Node.js 入口：

```text
@error-tracker/sdk                 # browser ESM
@error-tracker/sdk/node            # Node entry
@error-tracker/sdk/plugins/replay  # rrweb replay plugin
```

Core modules:

- `core/client`: 事件构造、采样、beforeSend、集成管理。
- `core/fingerprint`: 客户端错误指纹。
- `core/breadcrumbs`: breadcrumbs ring buffer。
- `core/queue`: 队列、重试、可选持久化。
- `core/dedupe`: 客户端 TTL 去重。
- `transports/http`: JSON ingest transport，页面隐藏时使用 keepalive。
- `integrations/browser-*`: 浏览器错误、breadcrumbs、performance。
- `integrations/node-errors`: Node 异常和 rejection 捕获。
- `plugins/replay`: rrweb 环形缓冲，错误发生时上传最近 replay。

Replay 注意点：

- replay 上传不使用 `keepalive`，避免浏览器对大 body 的限制。
- API body parser 默认跟随 `REPLAY_MAX_BODY_BYTES`，避免 Express 默认 100KB 拦截。
- replay 先于 event 到达时，event 入库后会回填 `replays.event_id`。

### `packages/cli`

`@error-tracker/cli` 提供 Source Map 上传命令：

```bash
bun run cli:build
bun exec error-tracker sourcemaps upload \
  --api-url http://localhost:3002 \
  --project-id <project-id> \
  --token <dsn-token> \
  --release <release> \
  --dist ./dist
```

CI 也可以直接调用 API：

```text
POST /api/sourcemaps/:projectId/:release/ci
Header: x-error-tracker-token: <dsn-token>
```

## Data Flow

### Error event flow

1. SDK 捕获异常并生成 `eventId`、fingerprint、stacktrace、breadcrumbs、environment、release。
2. SDK queue 在正常 flush 或 `document.visibilityState === 'hidden'` 时发送到 `/ingest/:projectId/:token`。
3. API 的 `DsnAuthGuard` 校验 token，`IngestLimitsService` 执行 body size、速率和日配额限制。
4. API 服务端重新计算聚合 fingerprint，写入或更新 `issues`。
5. 原始事件写入 `events`，敏感字段经过 PII scrub。
6. Dashboard 按项目权限读取 issue、event、breadcrumbs 和反解后的 stack。

### Replay flow

1. Browser SDK 的 `ReplayPlugin` 使用 rrweb 记录最近 N 秒事件。
2. 发生错误时，SDK 使用同一个 `eventId` 上传 replay 到 `/ingest/:projectId/:token/replay`。
3. API 将 rrweb events 写入 MinIO：`replays/<projectId>/<eventId>.json`。
4. 如果 event 已存在，直接写入 `replays.event_id`；如果 replay 先到，event 入库后回填关联。
5. Dashboard 的 replay 页面从 `/api/events/:id/replay` 读取并播放。

### Performance flow

1. Browser SDK 通过 `web-vitals` 收集 LCP、FID、CLS、INP、TTFB。
2. Performance event 和错误事件共用 ingest 批量上报。
3. API 写入 `performance_metrics`。
4. `/performance` 页面和 `/api/stats/performance/ai-analysis` 提供趋势和优化建议。

### Source Map flow

1. Web build 生成 `.map` 文件。
2. CLI、CI 或 Dashboard 上传 Source Map 到 API。
3. API 将文件存储到 MinIO，并在 `source_maps` 表记录 release、filename、checksum、size。
4. Event detail 读取 stack frame 后，按 release 和文件名查找 Source Map 并反解原始位置。

## Security And Access Model

- Dashboard 使用 Better-Auth session。
- API Dashboard 路由使用 `SessionGuard` 和项目访问控制。
- SDK ingest 使用 DSN token，不依赖用户 session。
- `/ingest` 和 `/api/sourcemaps` 支持 SDK/CI 跨域；Dashboard API 使用 `CORS_ORIGIN` allowlist 和 credentials。
- 项目列表只返回当前用户可访问的项目。
- Settings 中支持成员邀请、角色切换、移除成员和邀请重发。
- 邀请邮件可配置 SMTP；未配置时保留可复制邀请链接。
- PII scrub 会过滤 password、token、secret、authorization、api key 等敏感字段。

## Local Development

### Requirements

- Bun 1.3.13+
- Docker Desktop
- Node.js for running built API with source maps when needed

### Environment

```bash
cp .env.example .env.local
```

Important local defaults:

```env
DATABASE_URL=postgresql://tracker:tracker@localhost:5434/error_tracker
REDIS_HOST=localhost
REDIS_PORT=6380
MINIO_ENDPOINT=localhost
MINIO_PORT=9011
MINIO_ACCESS_KEY=tracker
MINIO_SECRET_KEY=tracker123
MINIO_BUCKET=error-tracker
BETTER_AUTH_URL=http://localhost:3003
CORS_ORIGIN=http://localhost:3003
NEXT_PUBLIC_API_URL=http://localhost:3002
```

### Start services

```bash
bun install
bun run services:up
bun run --cwd apps/api db:migrate
bun run dev
```

Local URLs:

```text
API:       http://localhost:3002
Dashboard: http://localhost:3003
MinIO:     http://localhost:9012
```

## Verification

Frequently used checks:

```bash
bun test packages/sdk
bun run --cwd packages/sdk lint
bun run --cwd packages/sdk build

bun test apps/api/src/config/cors.test.ts
bun test apps/api/src/config/body-parser.test.ts apps/api/src/modules/self-monitoring/self-monitoring.filter.test.ts
bun test apps/api/src/modules/ingest/ingest.service.test.ts
bun run --cwd apps/api lint
bun run --cwd apps/api build

bun run --cwd apps/web build
bun run cli:test
bun run e2e
```

Load and capacity scripts:

```bash
bun run load:ingest
bun run load:replay
bun run load:sourcemap
bun run load:dashboard
```

## Operations

Runbooks live under [docs/operations](./docs/operations):

- [backup-restore-runbook.md](./docs/operations/backup-restore-runbook.md)
- [capacity-baseline.md](./docs/operations/capacity-baseline.md)
- [production-deployment.md](./docs/operations/production-deployment.md)
- [restore-drill-report.md](./docs/operations/restore-drill-report.md)

Common scripts:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/ops/backup-postgres.ps1
powershell -ExecutionPolicy Bypass -File scripts/ops/backup-minio.ps1
powershell -ExecutionPolicy Bypass -File scripts/ops/restore-postgres.ps1 -BackupFile <dump>
powershell -ExecutionPolicy Bypass -File scripts/ops/restore-minio.ps1 -BackupDir <dir>
```

## External Integration: unitls-plane

`D:/myProject/unitls-plane` 已完成本地接入：

- Browser SDK 初始化在 `apps/web/src/components/error-tracker-init.tsx`。
- Node SDK 初始化在 `apps/api/src/main.ts`。
- Source Map 上传脚本在 `scripts/upload-sourcemaps.ts`。
- Web build 启用 `productionBrowserSourceMaps: true`。
- 本地 `.env.local` 使用 error-tracker 项目的 DSN。
- replay sample rate 可通过 `NEXT_PUBLIC_ERROR_TRACKER_REPLAY_SAMPLE_RATE` 配置。

Verified local project:

```text
projectId: 1f1c3df9-de83-4c7e-9c9f-711a05a930a5
release:   dev
```

## Documentation Map

- [PRODUCT.md](./PRODUCT.md): 产品定位、用户、设计原则和产品架构边界。
- [AGENTS.md](./AGENTS.md): AI Agent 执行规则、任务顺序和代码规范。
- [task/](./task): 任务实现记录和完成状态。
- [docs/superpowers/plans](./docs/superpowers/plans): 详细实施计划。
- [docs/superpowers/specs](./docs/superpowers/specs): 设计规格文档。
- [docs/operations](./docs/operations): 生产和运维手册。

## Production Readiness Summary

这套系统已经具备自托管错误追踪平台的核心闭环：采集、聚合、查询、回放、性能分析、Source Map 反解、成员权限、审计、自监控和 AI 建议。

若要作为正式企业生产平台上线，建议至少完成并复核：

- CI 中的 API/Web/SDK/e2e 全链路自动验证。
- 生产 HTTPS、CORS allowlist、Better-Auth secret、SMTP、OpenAI key、DSN secret 的密钥管理。
- Postgres、Redis、MinIO 的托管、备份、恢复、监控和容量扩展策略。
- 队列失败任务告警、dead letter 处理和 replay/source map 生命周期策略。
- 多租户配额、保留期、审计导出和合规说明。
