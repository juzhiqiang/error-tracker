# Task P3-04: Replay 与清理生命周期硬化

**计划：** Plan 3  
**依赖：** P3-01  
**目标：** 使用真实 S3 DeleteObject 删除过期 replay，清理任务可测试、可重复执行。

## 验收标准

- `MinioService.deleteObject(key)` 使用 S3 `DeleteObjectCommand`。
- `CleanupProcessor` 对旧 replay 调用 `deleteObject`，不再上传空内容覆盖。
- 删除对象失败时继续清理其它对象。

## 文件

- Modify: `apps/api/src/modules/sourcemaps/minio.service.ts`
- Modify: `apps/api/src/modules/cleanup/cleanup.processor.ts`
- Test: `apps/api/src/modules/sourcemaps/minio.service.test.ts`
- Test: `apps/api/src/modules/cleanup/cleanup.processor.test.ts`

## 步骤

- [ ] 写 MinIO deleteObject 测试。
- [ ] 写 cleanup 使用 deleteObject 的失败测试。
- [ ] 实现 `deleteObject()`。
- [ ] 修改 cleanup processor。
- [ ] 运行 `cd apps/api && bun test src/modules/sourcemaps/minio.service.test.ts src/modules/cleanup/cleanup.processor.test.ts`。
- [ ] 提交：`feat: 硬化 replay 清理生命周期`
