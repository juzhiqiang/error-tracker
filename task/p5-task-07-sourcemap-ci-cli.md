# Task P5-07: Sourcemap CI/CLI 上传完善

**计划：** Plan 5  
**批次：** 正式生产补齐  
**目标：** 让 source map 正式流程从控制台兜底升级为 CI/CLI 自动上传，并记录 checksum 防止错误 artifact 覆盖。

## 验收标准

- 提供 CLI 命令上传目录中的 `.map` 和 `.json` source map 文件。
- CLI 支持 `--api-url`、`--project-id`、`--token`、`--release`、`--dist`。
- 上传前计算 sha256 checksum。
- API 保存 checksum，并对重复文件返回明确结果。
- 控制台手动上传仍可用，作为兜底入口。

## 文件

- Create: `packages/cli/package.json`
- Create: `packages/cli/src/index.ts`
- Create: `packages/cli/src/sourcemaps.ts`
- Test: `packages/cli/src/sourcemaps.test.ts`
- Modify: `package.json`
- Modify: `apps/api/src/db/schema.ts`
- Add migration under: `apps/api/drizzle/`
- Modify: `apps/api/src/modules/sourcemaps/sourcemaps.service.ts`
- Modify: `apps/api/src/modules/sourcemaps/sourcemaps.controller.ts`
- Test: `apps/api/src/modules/sourcemaps/sourcemaps.controller.test.ts`
- Modify: `apps/web/src/app/(dashboard)/docs/page.tsx`

## 步骤

- [ ] **Step 1: 创建 CLI package**

创建 `packages/cli/package.json`：

```json
{
  "name": "@error-tracker/cli",
  "version": "0.1.0",
  "private": false,
  "type": "module",
  "bin": {
    "error-tracker": "./dist/index.js"
  },
  "scripts": {
    "build": "bun build src/index.ts --outdir dist --target node --format esm",
    "test": "bun test",
    "lint": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: 写 CLI sourcemap 测试**

创建 `packages/cli/src/sourcemaps.test.ts`：

```typescript
import { describe, expect, it } from 'bun:test'
import { collectSourcemapFiles, parseUploadArgs } from './sourcemaps'

describe('sourcemap cli', () => {
  it('parses upload arguments', () => {
    expect(
      parseUploadArgs([
        'upload',
        '--api-url',
        'http://localhost:3002',
        '--project-id',
        'project-1',
        '--token',
        'token-1',
        '--release',
        'web@2.8.1',
        '--dist',
        'dist',
      ]),
    ).toEqual({
      apiUrl: 'http://localhost:3002',
      projectId: 'project-1',
      token: 'token-1',
      release: 'web@2.8.1',
      dist: 'dist',
    })
  })

  it('collects only sourcemap files', () => {
    const files = collectSourcemapFiles(['app.js', 'app.js.map', 'route.json'])
    expect(files).toEqual(['app.js.map', 'route.json'])
  })
})
```

- [ ] **Step 3: 实现 CLI**

创建 `packages/cli/src/sourcemaps.ts`，实现：

- `parseUploadArgs(args: string[])`
- `collectSourcemapFiles(files: string[])`
- `sha256(buffer: Buffer)`
- `uploadSourcemaps(options)`

上传使用 multipart fields：

- `files`
- `checksums`

CLI 请求头使用：

```typescript
headers: { 'x-error-tracker-token': options.token }
```

- [ ] **Step 4: API schema 增加 checksum**

`source_maps` 增加：

```typescript
checksum: text('checksum'),
sizeBytes: integer('size_bytes'),
```

生成 migration：

```bash
bun run --cwd apps/api db:generate
```

- [ ] **Step 5: API 保存 checksum**

`SourceMapsService.upload()` 参数扩展为：

```typescript
async upload(projectId: string, release: string, filename: string, content: Buffer, checksum?: string): Promise<void>
```

DB insert 保存 checksum 和 sizeBytes。重复 `projectId + release + filename` 时更新 checksum 和 storageUrl。

- [ ] **Step 6: Controller 支持 checksums**

`sourcemaps.controller.ts` 从 body 读取 `checksums`，按文件顺序传给 service。控制台上传没有 checksum 时由 service 计算。

- [ ] **Step 7: 更新 Docs**

`/docs#upload-sourcemap` 增加 CI 示例：

```bash
bunx error-tracker sourcemaps upload \
  --api-url https://tracker.example.com \
  --project-id $ERROR_TRACKER_PROJECT_ID \
  --token $ERROR_TRACKER_TOKEN \
  --release $APP_RELEASE \
  --dist apps/web/.next/static
```

- [ ] **Step 8: 验证**

```bash
bun test packages/cli
bun run --cwd packages/cli build
bun run --cwd apps/api test src/modules/sourcemaps/sourcemaps.controller.test.ts
bun run --cwd apps/api lint
bun run --cwd apps/web build
```

- [ ] **Step 9: 提交**

```bash
git add packages/cli package.json apps/api/src/db/schema.ts apps/api/drizzle apps/api/src/modules/sourcemaps apps/web/src/app/(dashboard)/docs/page.tsx
git commit -m "feat: 增加 sourcemap CI CLI 上传"
```
