# Task P3-05: 健康检查与基础可观测性

**计划：** Plan 3  
**依赖：** Plan 2 API  
**目标：** 提供企业部署最基本的健康检查端点，覆盖 API、DB、Redis、MinIO。

## 验收标准

- `GET /health` 无需登录，返回 `{ ok, checks }`。
- DB check 执行 `select 1`。
- Redis check 使用 BullMQ connection 或环境配置连接测试。
- MinIO check 调用 bucket head 或 lightweight check。
- 任何依赖失败时返回 503。

## 文件

- Create: `apps/api/src/modules/health/health.controller.ts`
- Create: `apps/api/src/modules/health/health.service.ts`
- Create: `apps/api/src/modules/health/health.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/src/modules/health/health.service.test.ts`

## 步骤

- [ ] 写 HealthService 全部 healthy 测试。
- [ ] 写 DB 失败返回 unhealthy 测试。
- [ ] 实现 HealthService。
- [ ] 实现 HealthController。
- [ ] 在 AppModule 注册 HealthModule。
- [ ] 运行 `cd apps/api && bun test src/modules/health/health.service.test.ts`。
- [ ] 运行 `cd apps/api && bun run build`。
- [ ] 提交：`feat: 添加 API 健康检查`
