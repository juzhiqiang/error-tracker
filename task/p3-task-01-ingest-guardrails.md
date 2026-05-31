# Task P3-01: Ingest 安全防护

**计划：** Plan 3  
**依赖：** Plan 2 完成  
**目标：** 为 `/ingest` 增加企业级基础防护：payload 结构校验、批量大小限制、事件字段限制、DSN token header 支持。

## 验收标准

- `DsnAuthGuard` 支持 URL token 和 `x-error-tracker-token`。
- 单次 ingest 最多 50 个事件。
- 请求 body 超过合理结构或缺少 `events` 时返回 400。
- error/performance/replay payload 校验失败时返回 400，不写 DB。
- 现有 SDK 发送格式保持兼容。

## 文件

- Modify: `apps/api/src/common/guards/dsn-auth.guard.ts`
- Create: `apps/api/src/modules/ingest/ingest.validation.ts`
- Modify: `apps/api/src/modules/ingest/ingest.controller.ts`
- Test: `apps/api/src/common/guards/dsn-auth.guard.test.ts`
- Test: `apps/api/src/modules/ingest/ingest.validation.test.ts`
- Test: `apps/api/src/modules/ingest/ingest.controller.test.ts`

## 步骤

- [ ] 写 DsnAuthGuard header token 失败测试。
- [ ] 修改 guard 从 `req.params.token` 或 `req.headers['x-error-tracker-token']` 读取 token。
- [ ] 写 ingest validation 失败测试：missing events、events > 50、invalid eventId、invalid performance metric。
- [ ] 实现 `validateIngestBody()` 和 `validateReplayBody()`，失败抛 `BadRequestException`。
- [ ] 在 controller 调用 validation，再调用 service。
- [ ] 运行 `cd apps/api && bun test src/modules/ingest/ingest.validation.test.ts src/modules/ingest/ingest.controller.test.ts src/common/guards/dsn-auth.guard.test.ts`。
- [ ] 运行 `cd apps/api && bun run lint`。
- [ ] 提交：`feat: 增强 ingest payload 防护`
