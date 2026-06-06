# Task P5-05: 组织与团队多租户强化

**计划：** Plan 5  
**批次：** 正式生产补齐  
**目标：** 把当前项目级访问控制强化为 Organization / Team / Project 的企业多租户边界，确保所有项目数据都按组织隔离。

## 验收标准

- 每个项目必须属于一个 organization。
- 用户可通过 organization role 或 project role 访问项目。
- 支持 team 和 team_members 表，并允许 team 绑定项目。
- 项目列表只返回当前用户可访问组织下的项目。
- issues、events、stats、sourcemaps、audit logs 都不能跨组织访问。

## 文件

- Modify: `apps/api/src/db/schema.ts`
- Add migration under: `apps/api/drizzle/`
- Modify: `apps/api/src/modules/access/access-control.service.ts`
- Test: `apps/api/src/modules/access/access-control.service.test.ts`
- Modify: `apps/api/src/modules/projects/projects.service.ts`
- Test: `apps/api/src/modules/projects/projects.service.test.ts`
- Create: `apps/api/src/modules/organizations/organizations.module.ts`
- Create: `apps/api/src/modules/organizations/organizations.service.ts`
- Create: `apps/api/src/modules/organizations/organizations.controller.ts`
- Test: `apps/api/src/modules/organizations/organizations.service.test.ts`

## 步骤

- [x] **Step 1: 写访问控制测试**

在 `access-control.service.test.ts` 增加：

```typescript
it('allows project access through organization membership', async () => {
  const db = { execute: mock(async () => ({ rows: [{ role: 'admin' }] })) }
  const service = new AccessControlService(db as never)

  await expect(service.canAccessProject('user-1', 'project-1', ['admin'])).resolves.toBe(true)
})

it('rejects project access across organizations without membership', async () => {
  const db = { execute: mock(async () => ({ rows: [] })) }
  const service = new AccessControlService(db as never)

  await expect(service.canAccessProject('user-1', 'project-1', ['viewer'])).resolves.toBe(false)
})
```

- [x] **Step 2: 扩展 schema**

在 `apps/api/src/db/schema.ts` 增加：

```typescript
export const teams = pgTable(
  'teams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull().references(() => organizations.id),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    teamOrgSlugUnique: unique('teams_org_slug_unique').on(table.organizationId, table.slug),
  }),
)

export const teamMembers = pgTable(
  'team_members',
  {
    id: serial('id').primaryKey(),
    teamId: uuid('team_id').notNull().references(() => teams.id),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    teamUserUnique: unique('team_members_team_user_unique').on(table.teamId, table.userId),
  }),
)

export const teamProjects = pgTable(
  'team_projects',
  {
    id: serial('id').primaryKey(),
    teamId: uuid('team_id').notNull().references(() => teams.id),
    projectId: uuid('project_id').notNull().references(() => projects.id),
    role: text('role', { enum: ['admin', 'member', 'viewer'] }).notNull().default('viewer'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    teamProjectUnique: unique('team_projects_team_project_unique').on(table.teamId, table.projectId),
  }),
)
```

并将 `projects.organizationId` 改为 `.notNull()`。迁移要为已有项目创建 default organization。

- [x] **Step 3: 更新 AccessControlService 查询**

`canAccessProject()` 需要合并三种来源：

- project_members 直接角色
- organization_members 组织角色
- team_members + team_projects 团队项目角色

角色优先级：

```typescript
const roleRank = { viewer: 1, member: 2, admin: 3, owner: 4 }
```

满足任一来源角色等级即可访问。

- [x] **Step 4: 增加 organizations 模块**

实现：

- `GET /api/organizations`
- `POST /api/organizations`
- `GET /api/organizations/:organizationId/projects`
- `POST /api/organizations/:organizationId/teams`
- `POST /api/organizations/:organizationId/teams/:teamId/members`
- `POST /api/organizations/:organizationId/teams/:teamId/projects`

- [x] **Step 5: 更新 ProjectsService**

创建项目时必须有 organizationId。若没有传入，则使用当前用户第一个 organization，若用户没有 organization，则创建个人默认 organization。

- [x] **Step 6: 验证迁移**

```bash
bun run --cwd apps/api db:generate
bun run services:up
bun run --cwd apps/api db:migrate
```

- [x] **Step 7: 验证测试和构建**

```bash
bun run --cwd apps/api test src/modules/access/access-control.service.test.ts src/modules/projects/projects.service.test.ts src/modules/organizations/organizations.service.test.ts
bun run --cwd apps/api lint
bun run --cwd apps/api build
```

- [x] **Step 8: 提交**

```bash
git add apps/api/src/db/schema.ts apps/api/drizzle apps/api/src/modules/access apps/api/src/modules/projects apps/api/src/modules/organizations
git commit -m "feat: 强化组织团队多租户边界"
```
