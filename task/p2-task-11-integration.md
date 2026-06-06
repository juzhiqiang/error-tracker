# Task P2-11: utils-plane 接入

**计划：** Plan 2  
**依赖：** Task P2-08、P2-10（API 和 Dashboard 已完成）  
**可并行：** 否  
**预计时间：** 20 min  
**状态：** 已完成

---

## 目标

将 `@error-tracker/sdk` 接入 `D:/myProject/unitls-plane`（浏览器 + Node.js），并提供 Source Map 上传脚本。

**注意：** 本任务的代码提交在 `D:/myProject/unitls-plane` 仓库；为完成真实端到端验证，同时在 `error-tracker` 仓库补了 SDK/API 兼容修复和测试。

## 实现记录

- [x] **Step 1: 在 utils-plane 链接 SDK**
  - 根 `package.json`、`apps/web/package.json`、`apps/api/package.json` 已添加 `@error-tracker/sdk`。
  - 实际使用 `file:` 依赖；Bun 的 `link:` 在本地缓存/全局链接下不稳定。
  - 已执行 `bun install` 更新 `bun.lock`。

- [x] **Step 2: 在 error-tracker 创建 utils-plane 项目**
  - 本地项目 ID：`1f1c3df9-de83-4c7e-9c9f-711a05a930a5`
  - 本地 token：`utils-plane-local-token`
  - 本地 DSN：`http://localhost:3002/ingest/1f1c3df9-de83-4c7e-9c9f-711a05a930a5/utils-plane-local-token`

- [x] **Step 3: 在 utils-plane web 初始化浏览器 SDK**
  - 新增 `apps/web/src/components/error-tracker-init.tsx`。
  - 在 `apps/web/src/app/[locale]/layout.tsx` 的 `<body>` 内挂载初始化组件。
  - 接入 `ReplayPlugin`，默认 `bufferSeconds: 30`。
  - 新增 `NEXT_PUBLIC_ERROR_TRACKER_REPLAY_SAMPLE_RATE`，默认 `0.5`，本地验证可设为 `1`。

- [x] **Step 4: 在 utils-plane api 初始化 Node SDK**
  - `apps/api/src/main.ts` 在 bootstrap 前按 `ERROR_TRACKER_DSN` 初始化 Node SDK。
  - 支持 `NODE_ENV` 和 `RELEASE`。

- [x] **Step 5: 在 utils-plane 环境文件添加 DSN**
  - `.env.example` 已补充 Error Tracker 相关变量。
  - `.env.local` 与 `apps/web/.env.local` 已在本地配置，且保持 ignored，不提交。

- [x] **Step 6: 创建 Source Map 上传脚本**
  - 新增 `scripts/upload-sourcemaps.ts`。
  - 支持递归扫描 `apps/web/.next/static` 下 `.map` 文件。
  - 使用 `/api/sourcemaps/:projectId/:release/ci` 和 `x-error-tracker-token` 上传。
  - `apps/web/next.config.mjs` 已启用 `productionBrowserSourceMaps: true`。

- [x] **Step 7: 验证接入**
  - DB migration 已执行成功。
  - 手动 HTTP ingest 返回 `{ ok: true }`，事件和 issue 入库。
  - 浏览器 SDK 上报已验证：错误事件、stack、breadcrumbs 入库。
  - Node SDK 上报已验证：`node sdk utils-plane e2e` 入库。
  - Source Map 上传已验证：`dev` release 下 64 条记录。
  - Replay 已验证：浏览器 `/replay` 和普通 `/ingest` 均返回 202，`replays.event_id` 已关联事件。

- [x] **Step 8: 提交（在 unitls-plane 仓库）**
  - 已提交：`ce8850c feat: 支持配置 replay 采样率`

## error-tracker 侧补充修复

- [x] SDK package exports 增加 types/files，保证外部项目消费 `file:` 依赖时可解析类型。
- [x] Browser `visibilitychange` flush 监听改为挂到 `document`。
- [x] Node uncaught/unhandled integration 触发后立即 `flush()`。
- [x] Replay upload URL 修复为完整 DSN + `/replay`，保留 token。
- [x] Replay upload 移除 `keepalive`，避免浏览器大 body 限制导致 rrweb 上传失败。
- [x] API CORS：`/ingest` 和 `/api/sourcemaps` 支持 SDK/CI 跨域，Dashboard API 仍按 allowlist + credentials。
- [x] API body parser limit：默认使用 `REPLAY_MAX_BODY_BYTES`（默认 5MB），避免 Express 默认 100KB 拦截 rrweb。
- [x] body-parser payload-too-large plain error 返回 413，不再误报 500。
- [x] replay 先到、event 后到时，event 入库后自动回填 orphan replay 的 `event_id`。

## 验证完成检查清单

- [x] error-tracker `/issues` 出现 utils-plane 前端抛出的错误。
- [x] 错误详情数据包含 Stack Trace。
- [x] Breadcrumbs 入库并过滤敏感字段。
- [x] `/performance` 数据表已有 Web Vitals 指标。
- [x] utils-plane API/Node SDK 未捕获异常可被 error-tracker 接收。
- [x] Source Map 上传成功，`source_maps` 表 release=`dev` 有记录。
- [x] rrweb replay 上传成功，`replays` 表按事件关联。

## 已执行关键验证命令

```powershell
$env:DATABASE_URL='postgresql://tracker:tracker@localhost:5434/error_tracker'
bun run --cwd apps/api db:migrate
bun test packages/sdk
bun run --cwd packages/sdk build
bun test apps/api/src/config/cors.test.ts
bun test apps/api/src/config/body-parser.test.ts apps/api/src/modules/self-monitoring/self-monitoring.filter.test.ts
bun test apps/api/src/modules/ingest/ingest.service.test.ts
bun run --cwd apps/api build
```

```powershell
cd D:/myProject/unitls-plane
bun install
bun run --cwd apps/web build
bun run --cwd apps/api build
bun scripts/upload-sourcemaps.ts
```
