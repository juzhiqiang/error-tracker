# Error Tracker — Agent 开发指南

> 供 AI Agent（Claude Code、Copilot CLI 等）阅读使用

## 执行计划前必读

本项目有两个实现计划，按顺序执行：

1. **Plan 1** — Monorepo 脚手架 + SDK（13 个任务）
   - 路径：`docs/superpowers/plans/2026-05-28-01-scaffold-and-sdk.md`
2. **Plan 2** — API + Dashboard + utils-plane 接入（11 个任务）
   - 路径：`docs/superpowers/plans/2026-05-28-02-api-web-integration.md`
   - 前置条件：Plan 1 全部完成

任务文件在 `task/` 目录，每个任务一个文件，含完整步骤和代码。

## 推荐执行方式

使用 `superpowers:subagent-driven-development` skill：
- 每个任务派发独立 subagent 实现
- 实现后做两阶段 review（spec compliance → code quality）
- 不要在任务之间暂停询问用户

## 并行执行规则

详见 `task/README.md`。核心规则：

**Plan 1 并行组（Task 1-2 完成后）：**
- Task 3、4、5、6、7 可以**并行**执行（互不依赖）
- Task 8 必须等 3-7 全部完成后才能开始
- Task 9、10 可以**并行**执行（都依赖 Task 8）
- Task 11 必须等 9、10 完成
- Task 12 依赖 Task 11

**Plan 2 并行组（Task 2 完成后）：**
- Task 3、4、5、6 可以**并行**执行
- Task 7 依赖 Task 3-6
- Task 8 依赖 Task 7
- Task 9 可以和 Task 3-6 并行
- Task 10 依赖 Task 9
- Task 11 依赖 Task 8 + Task 10

**重要：不要同时派发多个 implementation subagent**（会产生 git 冲突）。
并行的意思是：在规划阶段识别哪些任务可以并行，然后按批次顺序执行，每批内的任务可以快速连续派发。

## Subagent 派发规范

### 给 implementer subagent 的上下文必须包含

1. 任务完整文本（从 task/ 目录读取，不要让 subagent 自己读计划文件）
2. 项目根目录：`D:/myProject/error-tracker`
3. 当前已完成的任务列表（避免重复实现）
4. 相关依赖任务的关键接口（如 Task 8 需要知道 Task 3-7 定义的类型和类名）

### 模型选择

| 任务类型 | 推荐模型 |
|---------|---------|
| 单文件、规格明确（Task 3-7） | haiku（快速便宜） |
| 多文件集成（Task 8-12, Plan 2 Task 3-8） | sonnet |
| 架构判断、review | opus |

### Implementer 状态处理

- **DONE** → 进入 spec review
- **DONE_WITH_CONCERNS** → 读 concerns，判断是否需要修复再 review
- **NEEDS_CONTEXT** → 补充上下文后重新派发
- **BLOCKED** → 升级到更强模型或拆分任务，不要忽略

## UI/UX 规范（Dashboard 页面）

实现 `apps/web` 的 Dashboard 页面时，必须遵循以下设计原则：

### 设计风格
- **风格**：Dark Professional（深色主题，专业感）
- **主色**：`#6366f1`（Indigo）作为 primary，`#ef4444`（Red）作为 error，`#22c55e`（Green）作为 success
- **背景**：`#0f172a`（slate-950）主背景，`#1e293b`（slate-800）卡片背景
- **字体**：Inter（UI 文字）+ JetBrains Mono（代码/Stack Trace）

### 必须满足的 UX 规则
- 所有交互元素最小尺寸 44×44px（touch target）
- 错误状态颜色不能只靠颜色区分，必须加图标或文字标签
- 表格行 hover 有明显背景变化
- 加载状态用 skeleton，不用 spinner（超过 300ms 的操作）
- Stack Trace 用等宽字体，行高 1.6，背景略深于卡片
- Breadcrumbs 时间线用左侧竖线连接，时间戳用 monospace

### 组件库
- 使用 shadcn/ui 组件（Button, Badge, Table, Dialog, Select, Input）
- 图表用 Recharts
- 录屏播放器用 rrweb-player
- Toast 通知用 sonner

### 安装 shadcn/ui
```bash
cd apps/web
bunx shadcn@latest init
# 选择 Default style, Slate base color, CSS variables
```

## TDD 要求

- SDK 的每个 core 模块（fingerprint, breadcrumbs, queue, dedupe, transport, client）必须先写测试
- 测试框架：`bun test`
- 测试文件放在 `packages/sdk/src/__tests__/`
- API 模块可以写集成测试，但不强制（DB 操作难以 mock）
- Dashboard 页面不需要单元测试，但必须在浏览器里验证功能

## Git 规范

- 每个任务完成后立即 commit，不要攒多个任务一起提交
- commit message 格式：`feat: <描述>`（中文描述）
- 不要 commit `.env.local`、`dist/`、`node_modules/`
- 在 `error-tracker` 仓库提交，不要影响 `unitls-plane` 仓库（Task 11 除外）

## 常见陷阱

1. **Drizzle 的 `execute` 返回类型**：原始 SQL 查询返回 `{ rows: unknown[] }`，需要类型断言
2. **BullMQ + NestJS**：使用 `@nestjs/bull`，不是直接用 `bullmq`
3. **Better-Auth 的 `toNodeHandler`**：必须在 NestJS 的 `app.use()` 里挂载，不是 controller
4. **rrweb-player SSR**：必须动态 import（`import('rrweb-player')`），不能在 SSR 里直接 import
5. **MinIO S3 兼容**：必须设置 `forcePathStyle: true`，否则 bucket 路径不对
6. **SDK 的 `index.ts` 有重复 `integrations` key**：Plan 1 Task 11 的代码有 bug，需要修复（两个 `integrations:` 赋值，后者覆盖前者）
7. **`visibilitychange` flush**：只在 `document.visibilityState === 'hidden'` 时触发，不是 `beforeunload`

## 验证检查清单

Plan 1 完成后验证：
- [ ] `bun test packages/sdk` 全部通过
- [ ] `cd packages/sdk && bun run build` 生成 `dist/browser/index.js` 和 `dist/node/index.cjs`

Plan 2 完成后验证：
- [ ] Docker 服务启动，migration 执行成功
- [ ] `bun run dev` 启动 api（3002）和 web（3003）无报错
- [ ] 手动 POST 到 `/ingest` 后，Dashboard `/issues` 出现该错误
- [ ] 错误详情页显示 Stack Trace 和 Breadcrumbs
- [ ] `/performance` 页面显示 Web Vitals 数据
- [ ] utils-plane 前端触发 `throw new Error('test')` 后，Dashboard 出现该错误
