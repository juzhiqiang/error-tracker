# Task P4-07: Organization / Team / RBAC

**计划：** Plan 4  
**批次：** 企业级治理后续  
**目标：** 支持组织、团队、项目成员和角色权限，防止 dashboard API 越权访问。

## 验收标准

- Schema 增加 `organizations`、`organization_members`、`project_members`。
- 角色支持 `owner`、`admin`、`member`、`viewer`。
- `AccessControlService` 可判断用户是否拥有项目访问权限。
- `ProjectAccessGuard` 从 `req.session.user.id` 与 `projectId` 判断权限。
- 支持 `@ProjectRoles()` 对写操作限制 owner/admin。
- 明确带 `projectId` 的 dashboard API 接入 guard：stats、sourcemaps、issues list、project token rotation。

## 文件

- Modify: `apps/api/src/db/schema.ts`
- Create: `apps/api/src/modules/access/access-control.service.ts`
- Create: `apps/api/src/modules/access/project-access.guard.ts`
- Create: `apps/api/src/modules/access/project-roles.decorator.ts`
- Create: `apps/api/src/modules/access/access.module.ts`
- Test: `apps/api/src/modules/access/access-control.service.test.ts`
- Test: `apps/api/src/modules/access/project-access.guard.test.ts`
- Modify: project-scoped controllers/modules

## 步骤

- [x] 写 AccessControlService 允许/拒绝测试。
- [x] 写 ProjectAccessGuard projectId/role 测试。
- [x] 扩展 schema。
- [x] 实现 access module/service/guard/decorator。
- [x] 接入 stats、sourcemaps、issues list、project token rotation。
- [x] 运行 `cd apps/api && bun test src/modules/access/access-control.service.test.ts src/modules/access/project-access.guard.test.ts`。
- [x] 运行 `cd apps/api && bun run lint`。
- [x] 提交：`feat: 添加项目级 RBAC`
