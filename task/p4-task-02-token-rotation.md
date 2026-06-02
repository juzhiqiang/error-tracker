# Task P4-02: DSN Token Rotation

**计划：** Plan 4  
**批次：** 最小正式生产  
**目标：** 项目 DSN token 泄露时可以立即轮换，旧 token 失效。

## 验收标准

- `POST /api/projects/:id/rotate-token` 需要登录。
- 生成新的随机 DSN token 并更新项目。
- 返回更新后的项目信息。
- 旧 token 不能再通过 `DsnAuthGuard`。

## 文件

- Modify: `apps/api/src/modules/projects/projects.service.ts`
- Modify: `apps/api/src/modules/projects/projects.controller.ts`
- Test: `apps/api/src/modules/projects/projects.service.test.ts`
- Test: `apps/api/src/common/guards/dsn-auth.guard.test.ts`

## 步骤

- [x] 写 rotate token 服务测试。
- [x] 写旧 token 失效的 guard 测试。
- [x] 实现 `ProjectsService.rotateToken(projectId)`。
- [x] 添加 `POST /api/projects/:id/rotate-token`。
- [x] 运行 `cd apps/api && bun test src/modules/projects/projects.service.test.ts src/common/guards/dsn-auth.guard.test.ts`。
- [x] 运行 `cd apps/api && bun run lint`。
- [x] 提交：`feat: 支持项目 token 轮换`
