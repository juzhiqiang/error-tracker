# Task P5-01: E2E 自动化回归

**计划：** Plan 5  
**批次：** 正式生产补齐  
**目标：** 用 Playwright 覆盖 migration、API、Web、登录、创建项目、SDK ingest、issue 查看、source map 上传和 stack trace 验证链路。

## 验收标准

- `bun run e2e` 可以启动或复用本地 API/Web，并运行完整浏览器流程。
- E2E 覆盖登录、创建项目、复制 DSN、POST 测试事件、打开 `/issues`、打开详情页。
- E2E 覆盖 Settings 中手动上传 source map 的基本 UI 校验。
- E2E 失败时保留 trace、screenshot、video 或 HTML report。
- CI 可以单独运行 `bun run e2e`，不依赖开发者手动点击。

## 文件

- Create: `apps/web/e2e/error-tracker.spec.ts`
- Create: `apps/web/playwright.config.ts`
- Create: `scripts/e2e/start-stack.ps1`
- Create: `scripts/e2e/seed-user.ts`
- Modify: `package.json`
- Modify: `apps/web/package.json`

## 步骤

- [ ] **Step 1: 安装 Playwright 依赖**

```bash
cd D:/myProject/error-tracker
bun add -d -F @error-tracker/web @playwright/test
bunx playwright install chromium
```

- [ ] **Step 2: 增加 e2e 脚本**

在 root `package.json` 增加：

```json
{
  "scripts": {
    "e2e": "bun run --cwd apps/web e2e"
  }
}
```

在 `apps/web/package.json` 增加：

```json
{
  "scripts": {
    "e2e": "playwright test"
  }
}
```

- [ ] **Step 3: 写 Playwright 配置**

创建 `apps/web/playwright.config.ts`：

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.E2E_WEB_URL ?? 'http://localhost:3003',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
```

- [ ] **Step 4: 写 seed 用户脚本**

创建 `scripts/e2e/seed-user.ts`，用 Better Auth 或现有 auth schema 创建固定测试用户。若 Better Auth CLI 不提供直接 seed，则写入 user/account 表并用登录 API 验证。

验收用户：

```text
email: e2e-owner@example.com
password: e2e-password-123
name: E2E Owner
```

- [ ] **Step 5: 写 E2E 测试**

创建 `apps/web/e2e/error-tracker.spec.ts`：

```typescript
import { expect, test, request } from '@playwright/test'

test('production smoke path creates project, ingests event, and shows issue detail', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill('e2e-owner@example.com')
  await page.getByLabel(/password/i).fill('e2e-password-123')
  await page.getByRole('button', { name: /sign in|登录/i }).click()
  await expect(page).toHaveURL(/\/$/)

  await page.goto('/settings')
  await page.getByLabel(/project name|项目名称/i).fill(`E2E Project ${Date.now()}`)
  await page.getByLabel(/slug/i).fill(`e2e-${Date.now()}`)
  await page.getByRole('button', { name: /create project|创建项目/i }).click()
  await expect(page.getByText(/project created|项目已创建/i)).toBeVisible()

  const dsn = await page.locator('input[readonly]').first().inputValue()
  const match = dsn.match(/\/ingest\/([^/]+)\/([^/]+)$/)
  expect(match).not.toBeNull()
  const [, projectId, token] = match!

  const api = await request.newContext()
  const response = await api.post(`http://localhost:3002/ingest/${projectId}/${token}`, {
    data: {
      events: [
        {
          eventId: `e2e-${Date.now()}`,
          timestamp: Date.now(),
          level: 'error',
          message: 'e2e production smoke error',
          fingerprint: 'e2e-production-smoke',
          stacktrace: [{ function: 'runSmoke', filename: 'app.js', lineno: 10, colno: 2 }],
          release: 'web@e2e',
          environment: 'e2e',
        },
      ],
      sentAt: new Date().toISOString(),
    },
  })
  expect(response.status()).toBe(202)

  await page.goto('/issues')
  await expect(page.getByText('e2e production smoke error')).toBeVisible()
  await page.getByText('e2e production smoke error').click()
  await expect(page.getByText(/Stack trace|调用栈/i)).toBeVisible()
  await expect(page.getByText(/runSmoke/)).toBeVisible()
})
```

- [ ] **Step 6: 验证失败和通过**

先在未启动服务时运行：

```bash
bun run e2e
```

Expected: FAIL，提示无法连接 `localhost:3003`。

启动服务、seed 用户、跑迁移后运行：

```bash
bun run services:up
bun run --cwd apps/api db:migrate
bun scripts/e2e/seed-user.ts
bun run e2e
```

Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add package.json apps/web/package.json apps/web/playwright.config.ts apps/web/e2e/ scripts/e2e/
git commit -m "feat: 增加正式生产 e2e 回归"
```
