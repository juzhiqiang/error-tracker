# Task P4-08: Audit Log

**计划：** Plan 4  
**批次：** 企业级治理后续  
**目标：** 记录安全和管理动作，满足企业审计基础要求。

## 验收标准

- Schema 增加 `audit_logs`。
- `AuditLogService.record()` 支持 actor、action、target、metadata。
- 记录项目创建和 token rotation。
- 记录 issue 状态修改。
- 记录 source map 上传/删除。
- 提供 `GET /api/audit-logs?projectId=` 查询接口，受项目权限保护。

## 文件

- Modify: `apps/api/src/db/schema.ts`
- Create: `apps/api/src/modules/audit/audit-log.service.ts`
- Create: `apps/api/src/modules/audit/audit-log.controller.ts`
- Create: `apps/api/src/modules/audit/audit-log.module.ts`
- Test: `apps/api/src/modules/audit/audit-log.service.test.ts`
- Modify: projects/issues/sourcemaps service or controller

## 步骤

- [x] 写 AuditLogService record/list 测试。
- [x] 扩展 schema。
- [x] 实现 audit module/service/controller。
- [x] 在项目创建、token rotation、issue 状态、source map 上传/删除记录审计。
- [x] 运行 `cd apps/api && bun test src/modules/audit/audit-log.service.test.ts`。
- [x] 运行 `cd apps/api && bun run lint`。
- [x] 提交：`feat: 添加审计日志`
