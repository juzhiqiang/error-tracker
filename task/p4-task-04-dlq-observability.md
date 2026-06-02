# Task P4-04: DLQ、结构化日志与基础指标

**计划：** Plan 4  
**批次：** 最小正式生产  
**目标：** 失败任务和核心 ingest 指标可见，避免后台任务静默失败。

## 验收标准

- BullMQ job 默认有 attempts/backoff/removeOnFail 配置。
- `GET /health` 或新 endpoint 返回 queue failed/waiting/active counts。
- Ingest 接收、拒绝、限流、scrub 事件有结构化日志或基础计数。
- 测试覆盖 queue count 汇总逻辑。

## 文件

- Create: `apps/api/src/modules/observability/metrics.service.ts`
- Create: `apps/api/src/modules/observability/observability.module.ts`
- Test: `apps/api/src/modules/observability/metrics.service.test.ts`
- Modify: `apps/api/src/modules/health/health.service.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: relevant BullMQ `add()` calls

## 步骤

- [ ] 写 queue counts 测试。
- [ ] 实现 metrics service。
- [ ] 将 queue counts 接入 health report。
- [ ] 为 BullMQ add 配置 attempts/backoff/removeOnFail。
- [ ] 运行 `cd apps/api && bun test src/modules/observability/metrics.service.test.ts src/modules/health/health.service.test.ts`。
- [ ] 运行 `cd apps/api && bun run lint`。
- [ ] 提交：`feat: 增加队列可观测与失败保留`
