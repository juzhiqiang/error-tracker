# Error Tracker — AI 开发指南

> 供 Claude Code / AI 助手阅读使用

## 项目概述

自建错误监控平台（Sentry 替代方案），独立 Monorepo。提供通用 SDK（browser ESM + Node.js CJS）
+ NestJS API + Next.js Dashboard。已超出最初"低配版"范围，落地了组织/团队多租户、项目级 RBAC、
审计日志、成员邀请、AI Advisor、平台自监控等企业能力。

> **当前状态**：核心功能、SDK、Dashboard 与 Plan 5「正式生产补齐」均已完成。
> 单元测试（52 pass）、API/Web 类型检查、全量构建（turbo 5/5）均通过。
> 上线前仅差生产环境配置就位，详见〈生产部署与上线〉。

## 项目位置

```
d:\project\error-tracker\     本项目（主工作目录）
```

> SDK 消费方示例：`unitls-plane`（独立仓库，最初的接入案例）。

## 技术栈

| 层 | 技术 |
|----|------|
| 包管理 | Bun 1.3.13 + Turborepo 2 |
| API | NestJS 11 + Express（port 3002） |
| Web | Next.js 14 App Router + TailwindCSS + Radix UI（port 3003） |
| 数据库 | PostgreSQL 16 + Drizzle ORM（迁移在 `apps/api/drizzle/`） |
| 对象存储 | MinIO（录屏 + Source Map） |
| 队列 | BullMQ + Redis（告警、每日清理、队列运维） |
| 认证 | Better-Auth（email+password，生产 secure cookie 策略） |
| 邮件 | SMTP（项目成员邀请邮件，可选；留空则邀请链接仅复制） |
| AI 分析 | OpenAI 兼容 API + 本地规则引擎兜底（AI Advisor，可选） |
| SDK 打包 | `bun build`（browser ESM + node CJS 双产物） |
| CLI | `@error-tracker/cli`（CI/CD 上传 sourcemap） |
| 代码规范 | TypeScript strict + `tsc --noEmit` 类型检查 + Prettier |

## 快速开始

```bash
# 1. 启动 Docker 服务（PostgreSQL + MinIO + Redis）
bun run services:up

# 2. 安装依赖
bun install

# 3. 配置环境变量
cp .env.example .env.local

# 4. 运行数据库 migration
cd apps/api && bunx drizzle-kit migrate

# 5. 开发模式（并行启动 api + web）
bun run dev
```

## 环境变量

复制 `.env.example` 为 `.env.local`（端口与 `docker-compose.yml` 对齐）：

```env
# 核心服务（本地端口）
DATABASE_URL=postgresql://tracker:tracker@localhost:5434/error_tracker
MINIO_ENDPOINT=localhost
MINIO_PORT=9011
MINIO_ACCESS_KEY=tracker
MINIO_SECRET_KEY=tracker123
MINIO_BUCKET=error-tracker
REDIS_HOST=localhost
REDIS_PORT=6380

# 认证与跨域
NEXT_PUBLIC_API_URL=http://localhost:3002
BETTER_AUTH_SECRET=change-me-use-openssl-rand-base64-32   # 生产必须换 32+ 位随机值
BETTER_AUTH_URL=http://localhost:3003
CORS_ORIGIN=http://localhost:3003                          # 生产必须 HTTPS，逗号分隔白名单，禁止 *

# 可选：SMTP 邀请邮件 / AI Advisor / 平台自监控
SMTP_HOST=
OPENAI_API_KEY=          # 留空则 AI Advisor 用本地规则引擎
ERROR_TRACKER_DSN=       # 填本平台自己的 DSN 即可自监控
```

> **生产配置**：`NODE_ENV=production` 时 `apps/api/src/config/env.ts` 会强制校验 ——
> `CORS_ORIGIN` / `BETTER_AUTH_URL` 必须 HTTPS、`BETTER_AUTH_SECRET` 必须 ≥32 字符，
> 否则 API 拒绝启动。完整变量见 `.env.example` 与
> [docs/operations/production-deployment.md](./docs/operations/production-deployment.md)。

## 常用命令

```bash
# Docker
bun run services:up       # 启动 PostgreSQL + MinIO + Redis
bun run services:down     # 停止
bun run services:reset    # 重置（清空数据）

# 开发
bun run dev               # 并行启动 api + web
cd apps/api && bun run dev
cd apps/web && bun run dev

# 测试与校验
bun test packages/sdk     # SDK 单元测试
bun test                  # 全部单元测试（turbo run test）
bun run lint              # 全量类型检查（各包 tsc --noEmit）
bun run e2e               # Playwright E2E（启动完整栈，需 Docker）

# 构建
bun run build                      # 全量构建（turbo，api + web + sdk + cli）
cd packages/sdk && bun run build   # 输出 dist/browser/ + dist/node/
bun run cli:build                  # 构建 sourcemap 上传 CLI

# 压测基线（scripts/load/）
bun run load:ingest       # ingest 吞吐
bun run load:replay       # 录屏上传
bun run load:sourcemap    # sourcemap 上传
bun run load:dashboard    # 查询延迟

# 数据库
cd apps/api && bunx drizzle-kit generate   # 生成 migration
cd apps/api && bunx drizzle-kit migrate    # 执行 migration
```

## 项目结构

```
error-tracker/
├── apps/
│   ├── api/                    NestJS API（port 3002）
│   │   ├── drizzle/            SQL 迁移（0000–0011）+ meta
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       ├── config/         env 校验 + CORS + body-parser（含测试）
│   │       ├── common/guards/  DsnAuthGuard + SessionGuard
│   │       ├── db/             Drizzle schema（schema.ts + auth-schema.ts）
│   │       ├── scripts/        运维脚本
│   │       └── modules/
│   │           ├── ingest/          POST /ingest/:projectId/:token（限流 + 配额 + PII 清理 + 幂等）
│   │           ├── issues/          /api/issues（指派 / 解决 / 评论 / 合并）
│   │           ├── events/          GET /api/events/:id（含 source-map 反解）
│   │           ├── projects/        项目 + 成员 + 邀请 + token 轮换
│   │           ├── organizations/   组织 / 团队多租户
│   │           ├── access/          项目级 RBAC（AccessControlService + ProjectAccessGuard）
│   │           ├── audit/           审计日志控制台 + CSV 导出
│   │           ├── sourcemaps/      /api/sourcemaps/:projectId/:release + MinIO Service
│   │           ├── stats/           /api/stats/issues + /performance
│   │           ├── ai/              AI Advisor（OpenAI 兼容 + 本地规则引擎兜底）
│   │           ├── alerts/          BullMQ Webhook 告警 worker
│   │           ├── operations/      队列失败闭环（查看 / 重试 / 清理 failed jobs）
│   │           ├── observability/   指标采集
│   │           ├── self-monitoring/ 平台自监控（用自己的 DSN 监控自己）
│   │           ├── health/          健康检查
│   │           └── cleanup/         BullMQ 每日数据清理 worker
│   └── web/                    Next.js Dashboard（port 3003）
│       ├── e2e/                Playwright 用例
│       └── src/app/
│           ├── (auth)/login/           登录页
│           ├── (dashboard)/            需要登录的页面组
│           │   ├── page.tsx            概览
│           │   ├── issues/             错误列表 + 详情 + 录屏（/[id]/replay）
│           │   ├── performance/        Web Vitals 趋势
│           │   ├── operations/         队列运维
│           │   ├── audit/              审计日志
│           │   ├── welcome/            产品介绍页
│           │   └── settings/           DSN Token + Webhook + 成员/邀请 + AI 开关
│           ├── accept-invite/[token]/  邀请接受页
│           ├── docs/                   SDK 接入文档
│           └── lib/api.ts              API 客户端
└── packages/
    ├── sdk/
    │   └── src/
    │       ├── index.ts        browser 入口
    │       ├── node.ts         Node.js 入口
    │       ├── types.ts        共享类型
    │       ├── core/           client, fingerprint, breadcrumbs, queue, dedupe, scope
    │       ├── transports/     HttpTransport（fetch + keepalive）
    │       ├── integrations/   browser-errors, browser-breadcrumbs, browser-performance,
    │       │                   browser-blank-screen（白屏检测）, node-errors, react-error-boundary
    │       └── plugins/replay/ ReplayPlugin（rrweb 环形缓冲）
    └── cli/                    @error-tracker/cli（CI sourcemap 上传）
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
# 多租户与权限
organizations         组织
organization_members  组织成员（role: owner|admin|member|viewer）
teams / team_members  团队及其成员
projects              项目（dsnToken, webhookUrl, alertThreshold, alertUserThreshold,
                           retentionDays, aiAnalysisEnabled）
project_members       项目成员（项目级 RBAC）
team_projects         团队 ↔ 项目授权
project_invitations   成员邀请（tokenHash, status, expiresAt）
audit_logs            审计日志（actor, action, targetType, metadata）

# 错误与事件
issues                聚合错误（指纹合并；count/userCount；指派、解决/回归追踪、合并/拆分）
issue_users           受影响用户去重（userHash）
issue_comments        Issue 协作评论
events                原始上报事件（stacktrace/breadcrumbs/request/user/tags/context 均 JSONB）
replays               录屏引用（storageUrl 指向 MinIO）
performance_metrics   Web Vitals（LCP/FID/CLS/INP/TTFB，含 rating）
source_maps           Source Map 引用（release/filename/checksum/sizeBytes，MinIO 存储）

# 认证（Better-Auth CLI 生成，auth-schema.ts）
user / session / account / verification
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
- `/api/*` 路由必须加 `@UseGuards(SessionGuard)`；跨项目数据访问用 `ProjectAccessGuard` 做 RBAC 隔离
- 不要在日志里打印 DSN Token 或 BETTER_AUTH_SECRET
- ingest 做限流 + 配额 + PII 清理；指纹服务端重算，防客户端篡改

## 生产部署与上线

> Plan 5「正式生产补齐」已完成（E2E 回归、备份恢复演练、生产安全配置、队列失败闭环、
> 多租户隔离、审计日志、sourcemap CI、容量基线）。**代码已就绪，上线只差生产配置。**

上线前检查清单：

- [ ] 准备生产 `.env`：`NODE_ENV=production`、32+ 位随机 `BETTER_AUTH_SECRET`、
      HTTPS 的 `BETTER_AUTH_URL` / `CORS_ORIGIN`（精确白名单，禁止 `*`）
- [ ] 反向代理（Nginx/Caddy/Ingress）终止 TLS，转发 `X-Forwarded-Proto/Host/For`
- [ ] 在生产库执行 `bunx drizzle-kit migrate`
- [ ] `bun run e2e` 在预发环境跑绿（依赖真实 Docker 服务）
- [ ] 落实 PostgreSQL / MinIO / Redis 备份与恢复（见运维文档）

运维文档（`docs/operations/`）：
- [production-deployment.md](./docs/operations/production-deployment.md) — 生产部署要求
- [backup-restore-runbook.md](./docs/operations/backup-restore-runbook.md) — 备份恢复手册
- [restore-drill-report.md](./docs/operations/restore-drill-report.md) — 恢复演练报告（RTO/RPO）
- [capacity-baseline.md](./docs/operations/capacity-baseline.md) — 容量与压测基线
- [launch-readiness-assessment.md](./docs/operations/launch-readiness-assessment.md) — 上线就绪评估（2026-06-11，含待修测试缺陷）

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
- [任务列表（含 Plan 5「正式生产补齐」）](./task/README.md)
- 运维文档 `docs/operations/`：部署 / 备份恢复 / 恢复演练 / 容量基线
