# Task P4-01: Ingest 限流、配额与大小限制

**计划：** Plan 4  
**批次：** 最小正式生产  
**目标：** 防止错误循环、恶意 DSN token 或超大 replay payload 打爆 API、DB、Redis、MinIO。

## 验收标准

- Ingest 请求 body 超过配置大小时返回 413。
- Replay 请求 body 超过配置大小时返回 413。
- 同一项目 DSN token 在固定窗口内超过请求数限制时返回 429。
- 单项目日事件量超过配置 quota 时返回 429。
- 默认配置可通过环境变量覆盖，测试不依赖真实 Redis。

## 文件

- Create: `apps/api/src/modules/ingest/ingest.limits.ts`
- Test: `apps/api/src/modules/ingest/ingest.limits.test.ts`
- Modify: `apps/api/src/modules/ingest/ingest.controller.ts`
- Modify: `apps/api/src/modules/ingest/ingest.controller.test.ts`

## 步骤

- [ ] 写 body size、rate limit、daily quota 失败测试。
- [ ] 实现 `IngestLimitsService` 或等价限流 helper。
- [ ] 在 `IngestController` 调用限流与配额检查。
- [ ] 运行 `cd apps/api && bun test src/modules/ingest/ingest.limits.test.ts src/modules/ingest/ingest.controller.test.ts`。
- [ ] 运行 `cd apps/api && bun run lint`。
- [ ] 提交：`feat: 添加 ingest 限流配额`
