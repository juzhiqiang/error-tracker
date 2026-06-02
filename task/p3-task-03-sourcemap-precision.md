# Task P3-03: Source Map 精准匹配

**计划：** Plan 3  
**依赖：** Plan 2 Source Map 模块  
**目标：** source-map 反解按 `projectId + release + filename` 匹配，不再只取项目第一条 source map。

## 验收标准

- `EventsService` 查询 source map 时必须匹配当前 event 的 `projectId`、`release` 和 stack frame 文件名。
- 找不到精确匹配时返回原始 stack frame。
- 反解失败不影响事件详情返回。

## 文件

- Modify: `apps/api/src/modules/events/events.service.ts`
- Test: `apps/api/src/modules/events/events.service.test.ts`

## 步骤

- [x] 写失败测试：同一项目两个 release/source map，只使用匹配 release 的 map。
- [x] 写失败测试：filename 不匹配时不反解。
- [x] 实现 frame filename 归一化，优先匹配 `source_maps.filename`。
- [x] 运行 `cd apps/api && bun test src/modules/events/events.service.test.ts`。
- [x] 运行 `cd apps/api && bun run lint`。
- [x] 提交：`feat: 精准匹配 source map`
