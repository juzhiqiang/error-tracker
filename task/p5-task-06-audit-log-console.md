# Task P5-06: 审计日志控制台与导出

**计划：** Plan 5  
**批次：** 正式生产补齐  
**目标：** 把后端审计记录升级成可查询、可过滤、可导出的企业审计模块。

## 验收标准

- API 支持按 projectId、actorUserId、action、targetType、时间范围筛选 audit logs。
- API 支持 CSV 导出，字段包含 createdAt、actorUserId、projectId、action、targetType、targetId、metadata。
- Web Settings 或 Operations 中增加 Audit Logs tab/page。
- 审计查询接口受 SessionGuard + ProjectAccessGuard 保护。
- 测试覆盖过滤条件和 CSV 输出。

## 文件

- Modify: `apps/api/src/modules/audit/audit-log.service.ts`
- Modify: `apps/api/src/modules/audit/audit-log.controller.ts`
- Test: `apps/api/src/modules/audit/audit-log.service.test.ts`
- Modify: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/app/(dashboard)/audit/page.tsx`
- Modify: `apps/web/src/components/dashboard-shell.tsx`
- Modify: `apps/web/src/lib/i18n.tsx`

## 步骤

- [ ] **Step 1: 写 audit 过滤和 CSV 测试**

在 `audit-log.service.test.ts` 增加：

```typescript
it('lists audit events with filter parameters', async () => {
  const db = { execute: mock(async () => ({ rows: [{ action: 'project.created' }] })) }
  const service = new AuditLogService(db as never)

  const rows = await service.list({
    projectId: 'project-1',
    actorUserId: 'user-1',
    action: 'project.created',
    targetType: 'project',
    from: '2026-06-01T00:00:00.000Z',
    to: '2026-06-06T00:00:00.000Z',
  })

  expect(rows).toEqual([{ action: 'project.created' }])
  expect(String(db.execute.mock.calls[0][0])).toContain('project.created')
})

it('exports audit rows as csv', () => {
  const csv = AuditLogService.toCsv([
    {
      createdAt: '2026-06-06T00:00:00.000Z',
      actorUserId: 'user-1',
      projectId: 'project-1',
      action: 'project.created',
      targetType: 'project',
      targetId: 'project-1',
      metadata: { name: 'App' },
    },
  ])

  expect(csv).toContain('createdAt,actorUserId,projectId,action,targetType,targetId,metadata')
  expect(csv).toContain('project.created')
})
```

- [ ] **Step 2: 扩展 AuditLogService**

增加 `AuditLogListFilters`：

```typescript
export interface AuditLogListFilters {
  projectId: string
  actorUserId?: string
  action?: string
  targetType?: string
  from?: string
  to?: string
}
```

实现 `list(filters)` 和静态 `toCsv(rows)`。CSV 需要转义双引号：

```typescript
private static csvCell(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '')
  return `"${text.replaceAll('"', '""')}"`
}
```

- [ ] **Step 3: 扩展 controller**

`GET /api/audit-logs?projectId=&actorUserId=&action=&targetType=&from=&to=` 返回 JSON。  
`GET /api/audit-logs/export.csv?...` 返回 `text/csv`。

- [ ] **Step 4: 前端 API 封装**

在 `apps/web/src/lib/api.ts` 增加：

```typescript
export interface AuditLogRow {
  createdAt: string
  actorUserId?: string | null
  projectId?: string | null
  action: string
  targetType: string
  targetId?: string | null
  metadata?: Record<string, unknown> | null
}
```

增加 `api.auditLogs.list(params)` 和 `api.auditLogs.exportUrl(params)`。

- [ ] **Step 5: 增加 Audit 页面**

创建 `apps/web/src/app/(dashboard)/audit/page.tsx`：

- project select
- actor input
- action input
- target type select
- from/to datetime-local
- table
- export CSV button

- [ ] **Step 6: 加导航和 i18n**

Dashboard 侧边栏增加 Audit；中英文文案走 `i18n.tsx`。

- [ ] **Step 7: 验证**

```bash
bun run --cwd apps/api test src/modules/audit/audit-log.service.test.ts
bun run --cwd apps/api lint
bun run --cwd apps/api build
bun run --cwd apps/web lint
bun run --cwd apps/web build
```

- [ ] **Step 8: 提交**

```bash
git add apps/api/src/modules/audit apps/web/src/lib/api.ts apps/web/src/app/(dashboard)/audit apps/web/src/components/dashboard-shell.tsx apps/web/src/lib/i18n.tsx
git commit -m "feat: 增加审计日志控制台与导出"
```
