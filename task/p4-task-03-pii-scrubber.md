# Task P4-03: 服务端 PII Scrubber

**计划：** Plan 4  
**批次：** 最小正式生产  
**目标：** 在数据入库前清理常见敏感字段，降低误采集 password、token、cookie、authorization 等数据的风险。

## 验收标准

- 默认 scrub 字段名包含 password、token、secret、authorization、cookie。
- 递归处理 `user`、`request`、`breadcrumbs`、`tags`。
- 不改变非敏感字段结构。
- `IngestService` 入库前使用 scrub 后的 payload。

## 文件

- Create: `apps/api/src/modules/ingest/pii-scrubber.ts`
- Test: `apps/api/src/modules/ingest/pii-scrubber.test.ts`
- Modify: `apps/api/src/modules/ingest/ingest.service.ts`
- Modify: `apps/api/src/modules/ingest/ingest.service.test.ts`

## 步骤

- [ ] 写递归 scrubber 测试。
- [ ] 写 IngestService 入库前 scrub 测试。
- [ ] 实现 `scrubPii()`。
- [ ] 在 `ingestEvent()` 中 scrub user/request/breadcrumbs/tags。
- [ ] 运行 `cd apps/api && bun test src/modules/ingest/pii-scrubber.test.ts src/modules/ingest/ingest.service.test.ts`。
- [ ] 运行 `cd apps/api && bun run lint`。
- [ ] 提交：`feat: 添加服务端 PII 清理`
