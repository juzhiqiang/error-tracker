# Task P4-06: 启动配置校验

**计划：** Plan 4  
**批次：** 最小正式生产  
**目标：** API 启动前校验关键环境变量，缺失配置时 fail fast。

## 验收标准

- 校验 `DATABASE_URL`、`BETTER_AUTH_SECRET`、`BETTER_AUTH_URL`、`CORS_ORIGIN`。
- 校验 Redis host/port 与 MinIO endpoint/credentials/bucket。
- 支持加载仓库根目录 `.env.local`，兼容从 `apps/api` 或仓库根目录启动。
- 缺失必需项时抛出包含变量名的错误。
- 测试不依赖真实环境。

## 文件

- Create: `apps/api/src/config/env.ts`
- Test: `apps/api/src/config/env.test.ts`
- Modify: `apps/api/src/main.ts`
- Modify: `apps/api/src/modules/auth/auth.ts`

## 步骤

- [ ] 写 env path resolve 与 required env 测试。
- [ ] 实现 `loadLocalEnv()` 与 `validateApiEnv()`。
- [ ] 在 `main.ts` 启动前调用。
- [ ] 在 `auth.ts` 复用 env helper。
- [ ] 运行 `cd apps/api && bun test src/config/env.test.ts`。
- [ ] 运行 `cd apps/api && bun run build`。
- [ ] 提交：`feat: 添加 API 启动配置校验`
