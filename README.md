# Error Tracker

Error Tracker 是一个轻量级、高性能的错误监控、回归检测、性能监控与会话录屏回放平台（类似于轻量版自托管 Sentry）。它专为开发、SRE、QA 和产品支持团队设计，支持快速异常聚合、调用栈解析、用户行为面包屑重建、rrweb 录屏还原以及前端 Web Vitals 性能分析。

---

## 🚀 核心特性

- **多端 SDK 收集**：通用 SDK（`@error-tracker/sdk`）支持前端浏览器（自动捕获 `window.onerror`、`unhandledrejection`、点击/网络请求/路由面包屑）及 Node.js 后端服务。
- **智能错误指纹 (Fingerprint)**：
  - **客户端去重**：5秒内存 TTL 降噪，防止异常突发流量冲垮上报通道。
  - **服务端聚合**：基于异常类型、错误消息和过滤掉构建差异的调用栈信息（前 3 帧文件名与函数名），跨用户、跨版本聚合为相同的 `Issue`。
- **环形录屏回放 (Session Replay)**：基于 `rrweb` 实现持续录制，仅在**发生错误时**才将最近 30 秒的录屏缓冲区上传至对象存储（MinIO），降低存储消耗，精准回溯用户出错前的操作轨迹。
- **性能指标监控 (Web Vitals)**：自动采集 LCP、FID、CLS、INP、TTFB，并根据 Google 标准进行 Good / Needs Improvement / Poor 分级统计。
- **Source Map 还原**：支持上传 Source Map，通过 `packages/cli` 命令行工具在 CI/CD 流程中自动提交，服务端接收错误时自动反解混淆后的调用栈。
- **Dark Professional 控制台**：基于 Next.js 14、TailwindCSS 和 shadcn/ui 打造的高密深色专业级控制台，支持错误检索、多维度筛选、Breadcrumbs 时间线还原、录屏播放和性能分析。

---

## 🛠 技术栈

| 模块 | 技术选型 |
|----|------|
| **包管理器与运行时** | Bun 1.3.13 + Turborepo |
| **后端 API 服务** | NestJS 11 + Express + BullMQ (异步上报队列) |
| **前端 控制台** | Next.js 14 App Router + TailwindCSS + Radix UI / shadcn/ui |
| **数据库** | PostgreSQL 16 + Drizzle ORM |
| **对象存储** | MinIO (用于存储二进制 rrweb 录屏文件) |
| **缓存与消息队列** | Redis 7 + BullMQ |
| **测试框架** | `bun test` + Playwright (E2E 测试) |

---

## 📁 项目目录结构

```text
error-tracker/
├── apps/
│   ├── api/                    # NestJS API 服务 (运行端口: 3002)
│   └── web/                    # Next.js Dashboard 管理台 (运行端口: 3003)
├── packages/
│   ├── sdk/                    # 浏览器 & Node.js 通用上报 SDK
│   └── cli/                    # CLI 工具 (用于 Source Map 上传等)
├── scripts/
│   ├── e2e/                    # E2E 自动化测试脚本与数据填充
│   ├── load/                   # Ingest / Replay / Sourcemap 压测与容量分析脚本
│   └── ops/                    # 生产环境备份、恢复运维脚本
├── docker-compose.yml          # 本地开发所需的基础服务镜像 (Postgres, Redis, MinIO)
├── package.json                # Monorepo 工作区定义与全局脚本
├── turbo.json                  # Turborepo 任务管道配置
└── tsconfig.base.json          # TypeScript 基础配置
```

---

## ⚡ 快速开始

### 1. 准备工作

确保你的开发机已安装以下环境：
- [Bun](https://bun.sh/) (推荐 >= 1.3.13)
- [Docker](https://www.docker.com/) (用于运行本地 Postgres/Redis/MinIO)

### 2. 复制配置并运行本地服务

在项目根目录下复制环境变量模板，并启动外部服务容器：

```bash
# 复制环境变量模板
cp .env.example .env.local

# 启动 Postgres, Redis 和 MinIO
bun run services:up
```

### 3. 执行数据库迁移

首次运行或更新 schema 后，需要对 PostgreSQL 执行 Drizzle 迁移：

```bash
# 生成并运行数据库 Migration
bun --cwd apps/api db:migrate
```

### 4. 启动开发服务器

通过 Turborepo 一键启动 API 和 Web 端的开发服务器：

```bash
bun run dev
```
启动成功后：
- API 服务运行在 `http://localhost:3002`
- Dashboard 运行在 `http://localhost:3003`

---

## 🧪 测试与质量验证

### 1. 单元测试

运行 SDK 的核心功能单元测试（指纹、面包屑、限流队列等）：

```bash
bun test packages/sdk
```

### 2. E2E 自动化回归测试

运行完整的 E2E 流程（会启动临时 Docker 服务、跑 migration、Seed 测试用户，然后通过 Playwright 自动化测试所有核心操作流程）：

```bash
bun run e2e
```

### 3. 压测与容量基线

如果需要评估平台的负载能力，可以使用 `scripts/load` 下的压力测试脚本：

```bash
# 测试 Ingest 接口的吞吐量
bun run load:ingest

# 测试 Replay 录屏上报
bun run load:replay

# 测试 Source Map 解析与上传性能
bun run load:sourcemap
```

---

## 📦 SDK 使用指南

### 1. 初始化 SDK

在你的前端应用入口（如 `layout.tsx` 或 `main.ts`）中引入并配置：

```typescript
import { init } from '@error-tracker/sdk'
import { ReplayPlugin } from '@error-tracker/sdk/plugins/replay'

init({
  dsn: 'http://localhost:3002/ingest/<projectId>/<dsnToken>',
  environment: 'production',
  release: '1.0.0',
  sampleRate: 1.0,
  integrations: [
    // 启用 30 秒环形缓冲录屏，只在出错时上报，采样率 10%
    new ReplayPlugin({ bufferSeconds: 30, sampleRate: 0.1 })
  ]
})
```

### 2. 手动上报异常与消息

你可以在代码中捕获到特定逻辑异常时手动上报：

```typescript
import { captureException, captureMessage, setContext } from '@error-tracker/sdk'

// 附加额外上下文信息
setContext({
  user: { id: 'user_9527', email: 'dev@example.com' },
  tags: { feature: 'checkout' }
})

try {
  doSomethingDangerous()
} catch (error) {
  // 上报异常
  captureException(error)
}

// 仅记录特定状态消息
captureMessage('User completed the onboarding flow', 'info')
```

---

## 🛠 Source Map 命令行上传

前端发布生产环境时，可以通过 `@error-tracker/cli` 自动上传生成的 `.map` 文件，以便控制台能清晰地显示真实的 TypeScript 源文件栈：

```bash
# 编译 CLI 工具
bun run cli:build

# 使用命令行上传 Source Map
bun exec error-tracker sourcemaps upload \
  --api-url http://localhost:3002 \
  --project-id <your-project-id> \
  --token <your-dsn-token> \
  --release 1.0.0 \
  --dist ./dist
```

---

## 🗄 备份与灾备恢复 (Ops)

为了保证生产环境的数据安全，提供了自动化备份和灾难恢复脚本（支持 Windows PowerShell）：

```bash
# 备份 PostgreSQL 数据库结构与数据
powershell -File scripts/ops/backup-postgres.ps1

# 备份 MinIO 对象存储中的录屏数据
powershell -File scripts/ops/backup-minio.ps1

# 从指定文件还原 PostgreSQL
powershell -File scripts/ops/restore-postgres.ps1 -BackupFile ./backups/db-xxx.sql

# 从指定目录还原 MinIO
powershell -File scripts/ops/restore-minio.ps1 -BackupDir ./backups/minio-xxx
```
详细方案及 RTO/RPO 演练指标请参考：[灾备运维手册 (docs/operations/backup-restore-runbook.md)](file:///D:/myProject/error-tracker/docs/operations/backup-restore-runbook.md)。

---

## 📄 设计规范与开发指南

团队协作及 AI Agent 开发时请务必遵循：
- [AI Agent 开发规约与并行控制方案 (AGENTS.md)](file:///D:/myProject/error-tracker/AGENTS.md)
- [控制台 UI/UX 与设计规范 (PRODUCT.md)](file:///D:/myProject/error-tracker/PRODUCT.md)
- [系统架构与设计说明书 (docs/superpowers/specs/2026-05-27-error-tracker-design.md)](file:///D:/myProject/error-tracker/docs/superpowers/specs/2026-05-27-error-tracker-design.md)
