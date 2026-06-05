# Error Tracker — 任务列表与并行执行说明

## 执行顺序总览

```
Plan 1: Monorepo 脚手架 + SDK
─────────────────────────────────────────────────────────────
[顺序] Task 1: Monorepo 脚手架
[顺序] Task 2: SDK package.json + tsconfig
         ↓
[并行] Task 3  Task 4  Task 5  Task 6  Task 7
       类型    指纹    面包屑  去重+队列  传输
         ↓（全部完成后）
[顺序] Task 8: ErrorTrackerClient 主类
         ↓
[并行] Task 9              Task 10
       浏览器 Integrations  Node.js + React ErrorBoundary
         ↓（全部完成后）
[顺序] Task 11: SDK 入口文件（browser + node）
[顺序] Task 12: ReplayPlugin（rrweb 环形缓冲）
[顺序] Task 13: 同步更新设计文档

Plan 2: API + Dashboard + utils-plane 接入
─────────────────────────────────────────────────────────────
[顺序] Task 1: API 依赖 + 基础结构
[顺序] Task 2: Drizzle Schema + Migration
         ↓
[并行] Task 3   Task 4              Task 5          Task 6
       Ingest   Issues/Events/      Source Map      Webhook 告警
       模块     Projects/Stats      模块            + 数据清理
         ↓（全部完成后）
[顺序] Task 7: Better-Auth 登录（API 侧）
[顺序] Task 8: 完成 app.module.ts
         ↓
[并行开始] Task 9: Next.js Dashboard 基础结构（可与 Task 3-6 并行）
[顺序] Task 10: Dashboard 页面（依赖 Task 9）
         ↓（Task 8 + Task 10 全部完成后）
[顺序] Task 11: utils-plane 接入
```

## 并行批次详解

### Plan 1

| 批次 | 任务 | 可并行 | 前置条件 |
|------|------|--------|---------|
| 批次 1 | Task 1 | 否 | 无 |
| 批次 2 | Task 2 | 否 | Task 1 |
| **批次 3** | **Task 3, 4, 5, 6, 7** | **是** | Task 2 |
| 批次 4 | Task 8 | 否 | Task 3-7 全部完成 |
| **批次 5** | **Task 9, 10** | **是** | Task 8 |
| 批次 6 | Task 11 | 否 | Task 9, 10 全部完成 |
| 批次 7 | Task 12 | 否 | Task 11 |
| 批次 8 | Task 13 | 否 | Task 12 |

### Plan 2

| 批次 | 任务 | 可并行 | 前置条件 |
|------|------|--------|---------|
| 批次 1 | Task 1 | 否 | Plan 1 全部完成 |
| 批次 2 | Task 2 | 否 | Task 1 |
| **批次 3** | **Task 3, 4, 5, 6, 9** | **是** | Task 2（Task 9 也可在此批次开始） |
| 批次 4 | Task 7 | 否 | Task 3-6 全部完成 |
| 批次 5 | Task 8 | 否 | Task 7 |
| 批次 6 | Task 10 | 否 | Task 9 |
| 批次 7 | Task 11 | 否 | Task 8 + Task 10 全部完成 |

## 任务文件索引

### Plan 1 — Monorepo 脚手架 + SDK

| 文件 | 任务 | 预计时间 |
|------|------|---------|
| [p1-task-01-scaffold.md](./p1-task-01-scaffold.md) | Monorepo 脚手架 | 10 min |
| [p1-task-02-sdk-config.md](./p1-task-02-sdk-config.md) | SDK package.json + tsconfig | 5 min |
| [p1-task-03-types.md](./p1-task-03-types.md) | 类型定义 | 5 min |
| [p1-task-04-fingerprint.md](./p1-task-04-fingerprint.md) | Fingerprint 指纹计算 | 10 min |
| [p1-task-05-breadcrumbs.md](./p1-task-05-breadcrumbs.md) | BreadcrumbManager 环形队列 | 10 min |
| [p1-task-06-dedupe-queue.md](./p1-task-06-dedupe-queue.md) | DedupeFilter + EventQueue | 10 min |
| [p1-task-07-transport.md](./p1-task-07-transport.md) | HttpTransport | 10 min |
| [p1-task-08-client.md](./p1-task-08-client.md) | Scope + ErrorTrackerClient 主类 | 15 min |
| [p1-task-09-browser-integrations.md](./p1-task-09-browser-integrations.md) | 浏览器 Integrations + web-vitals | 15 min |
| [p1-task-10-node-react.md](./p1-task-10-node-react.md) | Node.js Integration + React ErrorBoundary | 10 min |
| [p1-task-11-entry.md](./p1-task-11-entry.md) | SDK 入口文件（browser + node） | 10 min |
| [p1-task-12-replay.md](./p1-task-12-replay.md) | ReplayPlugin（rrweb 环形缓冲） | 15 min |
| [p1-task-13-docs.md](./p1-task-13-docs.md) | 同步更新设计文档 | 5 min |

### Plan 2 — API + Dashboard + 接入

| 文件 | 任务 | 预计时间 |
|------|------|---------|
| [p2-task-01-api-scaffold.md](./p2-task-01-api-scaffold.md) | API 依赖 + 基础结构 | 10 min |
| [p2-task-02-schema.md](./p2-task-02-schema.md) | Drizzle Schema + Migration | 15 min |
| [p2-task-03-ingest.md](./p2-task-03-ingest.md) | Ingest 模块（事件接收核心） | 20 min |
| [p2-task-04-crud-modules.md](./p2-task-04-crud-modules.md) | Issues + Events + Projects + Stats 模块 | 25 min |
| [p2-task-05-sourcemaps.md](./p2-task-05-sourcemaps.md) | Source Map 模块 + MinIO Service | 15 min |
| [p2-task-06-alerts-cleanup.md](./p2-task-06-alerts-cleanup.md) | Webhook 告警 + 数据清理 | 15 min |
| [p2-task-07-auth-api.md](./p2-task-07-auth-api.md) | Better-Auth 登录（API 侧） | 15 min |
| [p2-task-08-app-module.md](./p2-task-08-app-module.md) | 完成 app.module.ts | 10 min |
| [p2-task-09-web-scaffold.md](./p2-task-09-web-scaffold.md) | Next.js Dashboard 基础结构 | 10 min |
| [p2-task-10-dashboard-pages.md](./p2-task-10-dashboard-pages.md) | Dashboard 所有页面 | 30 min |
| [p2-task-11-integration.md](./p2-task-11-integration.md) | utils-plane 接入 | 20 min |

## 注意事项

1. **不要同时派发多个 implementation subagent** — 会产生 git 冲突
2. **每个任务完成后立即 commit** — 方便 review 和回滚
3. **Plan 2 Task 2 必须在 Docker 启动后执行** — migration 需要真实数据库连接
4. **Task 11（utils-plane 接入）在 utils-plane 仓库提交** — 注意切换工作目录

## Plan 5 - 正式生产补齐

| 文件 | 任务 | 目标 |
|------|------|------|
| [p5-task-01-e2e-regression.md](./p5-task-01-e2e-regression.md) | E2E 自动化回归 | 覆盖 migration、登录、项目、ingest、issue、sourcemap 的真实流程 |
| [p5-task-02-restore-drill.md](./p5-task-02-restore-drill.md) | 备份恢复真实演练 | 记录 Postgres 和 MinIO 恢复证据、RTO/RPO |
| [p5-task-03-production-security-config.md](./p5-task-03-production-security-config.md) | 生产部署安全配置 | 强化 HTTPS、CORS、cookie、secret 和反向代理要求 |
| [p5-task-04-queue-operations.md](./p5-task-04-queue-operations.md) | 队列失败闭环 | 展示 failed jobs，并支持重试和清理 |
| [p5-task-05-organization-tenancy.md](./p5-task-05-organization-tenancy.md) | 组织与团队多租户强化 | 组织、团队、项目权限边界严格隔离 |
| [p5-task-06-audit-log-console.md](./p5-task-06-audit-log-console.md) | 审计日志控制台与导出 | 支持筛选、查询和 CSV 导出 |
| [p5-task-07-sourcemap-ci-cli.md](./p5-task-07-sourcemap-ci-cli.md) | Sourcemap CI/CLI 上传完善 | 自动上传 artifact，记录 checksum |
| [p5-task-08-capacity-baseline.md](./p5-task-08-capacity-baseline.md) | 容量与压测基线 | 建立 ingest、replay、sourcemap、查询延迟基线 |
