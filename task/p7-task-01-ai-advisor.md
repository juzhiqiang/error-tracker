# Task P7-01: AI Advisor 错误修复与性能优化建议

**目标：** 在 Issue Detail 与 Performance 页面增加 AI 建议能力：错误给出修复建议，性能给出优化建议。

**推荐方案：** 先做“本地规则兜底 + 可选 OpenAI Responses API”的企业可用版本。无 AI key 时仍可稳定演示；配置 `OPENAI_API_KEY` 和 `OPENAI_MODEL` 后，后端把脱敏后的 issue/performance 上下文交给模型，要求返回结构化 JSON recommendations。

**范围：**
- 后端新增 AI Advisor 模块。
- Issue 分析接口：`POST /api/issues/:id/ai-analysis`。
- Performance 分析接口：`POST /api/stats/performance/ai-analysis?projectId=...`。
- Provider 支持：
  - 默认本地规则分析，保证无 AI key 时也能使用。
  - 配置 `OPENAI_API_KEY` 后使用 OpenAI Responses API 生成结构化 JSON。
- 安全：
  - 复用 session、project、issue 权限。
  - 发送 AI 前复用 PII/secret scrubber。
  - 记录审计日志。
  - AI 返回必须是结构化 recommendation 列表。
- 前端：
  - Issue Detail 增加“AI 修复建议”面板。
  - Performance 增加“AI 优化建议”面板。
- 文档：
  - `.env.example` 补 AI provider 环境变量。
  - `/docs` 补 AI Advisor 使用说明。

**不包含：**
- 自动生成 PR。
- 仓库源码接入。
- 后端 APM/Tracing 采集。
- 性能指标自动转 Issue。

## 执行清单

- [x] Step 1: 写后端 AI Advisor RED 测试
  - `ai-provider.service.test.ts`
  - `ai-advisor.service.test.ts`
  - `ai-advisor.controller.test.ts`
- [x] Step 2: 实现后端 AI provider、本地规则分析、上下文构建、权限、审计和接口
  - 已完成：service/provider/controller 测试通过；controller 单测 mock 了 Nest decorators 与 `SessionGuard`，避免测试读取真实 auth env。
- [x] Step 3: 写前端 API/渲染辅助测试
  - 已完成：`api.test.ts` 覆盖 issue/performance POST 调用，`api.ts` 暴露 `aiAnalysis` 与 `aiPerformance`。
- [x] Step 4: 实现 Issue/Performance AI 建议面板
  - Issue Detail：手动触发分析、loading/error、provider/model 标识、建议步骤列表。
  - Performance：基于当前项目触发分析、展示 priority/confidence/evidence/recommendations。
- [x] Step 5: 补环境变量和用户文档
  - `.env.example`: `OPENAI_API_KEY`、`OPENAI_MODEL`、`OPENAI_BASE_URL`。
  - `/docs`: AI Advisor、隐私脱敏、本地兜底、OpenAI 配置说明。
- [x] Step 6: 运行测试、lint、build 验证
  - `bun test apps/api/src/modules/ai`
  - `bun test apps/web/src/lib/api.test.ts`
  - `bun test apps/web/src/lib/sdk-docs.test.ts`
  - `bun run --cwd apps/api lint`
  - `bun run --cwd apps/web lint`
  - `bun run --cwd apps/api build`
  - `bun run --cwd apps/web build`
- [x] Step 7: 提交变更
  - commit message: `feat: 增加 AI Advisor 建议`
