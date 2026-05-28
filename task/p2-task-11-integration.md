# Task P2-11: utils-plane 接入

**计划：** Plan 2  
**依赖：** Task P2-08, P2-10（API 和 Dashboard 都需就绪）  
**可并行：** 否  
**预计时间：** 20 min

---

## 目标

将 `@error-tracker/sdk` 接入 utils-plane（浏览器 + Node.js），并提供 Source Map 上传脚本。

**注意：** 本任务的代码提交在 `D:/myProject/unitls-plane` 仓库（不是 error-tracker）。

## 需要修改的文件（在 utils-plane）

- `D:/myProject/unitls-plane/package.json`（添加 SDK 依赖）
- `D:/myProject/unitls-plane/apps/web/src/app/layout.tsx`
- `D:/myProject/unitls-plane/apps/api/src/main.ts`
- `D:/myProject/unitls-plane/.env.local`（不提交，参考更新 `.env.example`）

## 需要创建的文件（在 utils-plane）

- `D:/myProject/unitls-plane/scripts/upload-sourcemaps.ts`

## 步骤

- [ ] **Step 1: 在 utils-plane 链接 SDK**

在 `D:/myProject/unitls-plane/package.json` 的 dependencies 中加入：

```json
"@error-tracker/sdk": "link:../error-tracker/packages/sdk"
```

然后：

```bash
cd D:/myProject/unitls-plane
bun install
```

- [ ] **Step 2: 在 error-tracker Dashboard 创建项目**

```bash
# 启动 error-tracker
cd D:/myProject/error-tracker
bun run services:up
bun run dev
```

在浏览器打开 http://localhost:3003，登录后到 `/settings` 创建项目 "utils-plane"，复制 DSN（格式：`http://localhost:3002/ingest/<projectId>/<token>`）。

- [ ] **Step 3: 在 utils-plane web layout 初始化 SDK**

修改 `D:/myProject/unitls-plane/apps/web/src/app/layout.tsx`，在文件顶部加入客户端 SDK 初始化：

```typescript
'use client'
// ... 现有 imports
import { useEffect } from 'react'
import { init } from '@error-tracker/sdk'
import { ReplayPlugin } from '@error-tracker/sdk/plugins/replay'

// 在 RootLayout 组件内加入
useEffect(() => {
  init({
    dsn: process.env.NEXT_PUBLIC_ERROR_TRACKER_DSN!,
    environment: process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_RELEASE ?? '0.0.0',
    integrations: [new ReplayPlugin({ bufferSeconds: 30, sampleRate: 0.5 })],
  })
}, [])
```

如果 layout.tsx 是 server component，则创建一个独立的 client component：

```typescript
// apps/web/src/components/error-tracker-init.tsx
'use client'
import { useEffect } from 'react'
import { init } from '@error-tracker/sdk'
import { ReplayPlugin } from '@error-tracker/sdk/plugins/replay'

export function ErrorTrackerInit() {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_ERROR_TRACKER_DSN) return
    init({
      dsn: process.env.NEXT_PUBLIC_ERROR_TRACKER_DSN,
      environment: process.env.NODE_ENV,
      release: process.env.NEXT_PUBLIC_RELEASE ?? '0.0.0',
      integrations: [new ReplayPlugin({ bufferSeconds: 30, sampleRate: 0.5 })],
    })
  }, [])
  return null
}
```

在 `layout.tsx` 里 `<body>` 里加上 `<ErrorTrackerInit />`。

- [ ] **Step 4: 在 utils-plane api 的 main.ts 初始化 SDK**

修改 `D:/myProject/unitls-plane/apps/api/src/main.ts`，在 `bootstrap()` 之前：

```typescript
import { init } from '@error-tracker/sdk/node'

if (process.env.ERROR_TRACKER_DSN) {
  init({
    dsn: process.env.ERROR_TRACKER_DSN,
    environment: process.env.NODE_ENV,
    release: process.env.RELEASE ?? '0.0.0',
  })
}

async function bootstrap() {
  // ... 原有 bootstrap 逻辑
}
bootstrap()
```

- [ ] **Step 5: 在 utils-plane .env.local 添加 DSN**

```env
NEXT_PUBLIC_ERROR_TRACKER_DSN=http://localhost:3002/ingest/<projectId>/<token>
ERROR_TRACKER_DSN=http://localhost:3002/ingest/<projectId>/<token>
NEXT_PUBLIC_RELEASE=dev
```

替换 `<projectId>` 和 `<token>` 为 Step 2 拿到的真实值。

- [ ] **Step 6: 创建 Source Map 上传脚本**

```typescript
// D:/myProject/unitls-plane/scripts/upload-sourcemaps.ts
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

const API = process.env.ERROR_TRACKER_API ?? 'http://localhost:3002'
const PROJECT_ID = process.env.ERROR_TRACKER_PROJECT_ID
const RELEASE = process.env.NEXT_PUBLIC_RELEASE ?? 'dev'
const BUILD_DIR = join(process.cwd(), 'apps/web/.next/static/chunks')

if (!PROJECT_ID) {
  console.error('ERROR_TRACKER_PROJECT_ID env var is required')
  process.exit(1)
}

async function uploadSourceMaps() {
  const files = readdirSync(BUILD_DIR).filter(f => f.endsWith('.map'))
  console.log(`Uploading ${files.length} source maps for release ${RELEASE}`)

  for (const file of files) {
    const content = readFileSync(join(BUILD_DIR, file))
    const form = new FormData()
    form.append('files', new Blob([content]), file)
    const res = await fetch(`${API}/api/sourcemaps/${PROJECT_ID}/${RELEASE}`, {
      method: 'POST',
      body: form,
    })
    console.log(file, res.status === 200 || res.status === 201 ? '✓' : '✗')
  }
}

uploadSourceMaps()
```

- [ ] **Step 7: 验证接入**

```bash
# 1. error-tracker 已启动（Step 2）

# 2. 启动 utils-plane
cd D:/myProject/unitls-plane
bun run dev

# 3. 打开 utils-plane 前端（http://localhost:3000），在浏览器控制台执行
throw new Error('test from utils-plane')

# 4. 切到 error-tracker Dashboard http://localhost:3003/issues
# 应看到 "test from utils-plane"

# 5. 点进详情，确认 Stack Trace 和 Breadcrumbs 正确显示
```

- [ ] **Step 8: 提交（在 utils-plane 仓库）**

```bash
cd D:/myProject/unitls-plane
git add package.json apps/web/src/components/error-tracker-init.tsx \
  apps/web/src/app/layout.tsx apps/api/src/main.ts scripts/upload-sourcemaps.ts
git commit -m "feat: 接入 error-tracker SDK（浏览器 + Node.js + rrweb 录屏）"
```

## 验证完成检查清单

- [ ] error-tracker `/issues` 出现 utils-plane 前端抛出的错误
- [ ] 错误详情页 Stack Trace 显示正确
- [ ] Breadcrumbs 显示点击、导航、fetch 记录
- [ ] `/performance` 出现 LCP/CLS/INP/TTFB 数据
- [ ] utils-plane API 抛出未捕获异常，error-tracker 能接收到
- [ ] Source Map 上传后，详情页 Stack Trace 显示原始 .tsx 文件路径
