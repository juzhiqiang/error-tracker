# Task P5-03: 生产部署安全配置

**计划：** Plan 5  
**批次：** 正式生产补齐  
**目标：** 确保生产环境不会以宽松 CORS、默认 secret、不安全 cookie 或缺少反向代理策略启动。

## 验收标准

- `NODE_ENV=production` 时必须配置 HTTPS 来源的 `CORS_ORIGIN`。
- `BETTER_AUTH_SECRET` 不能使用默认值，长度满足最小安全要求。
- 登录 cookie 在生产环境使用 secure、httpOnly、sameSite 策略。
- 文档说明 Nginx/Caddy/Ingress 反向代理要求。
- 测试覆盖生产配置缺失时的失败行为。

## 文件

- Modify: `apps/api/src/config/env.ts`
- Test: `apps/api/src/config/env.test.ts`
- Modify: `apps/api/src/main.ts`
- Modify: `apps/api/src/modules/auth/auth.ts`
- Create: `docs/operations/production-deployment.md`
- Modify: `.env.example`

## 步骤

- [ ] **Step 1: 写生产配置失败测试**

在 `apps/api/src/config/env.test.ts` 增加：

```typescript
import { describe, expect, it } from 'bun:test'
import { validateApiEnv } from './env'

describe('production env security', () => {
  it('rejects non-https cors origin in production', () => {
    expect(() =>
      validateApiEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://tracker:tracker@localhost:5433/error_tracker',
        BETTER_AUTH_SECRET: 'a-secure-secret-with-more-than-32-characters',
        BETTER_AUTH_URL: 'https://tracker.example.com',
        CORS_ORIGIN: 'http://tracker.example.com',
      }),
    ).toThrow('CORS_ORIGIN must use https in production')
  })

  it('rejects weak production auth secrets', () => {
    expect(() =>
      validateApiEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://tracker:tracker@localhost:5433/error_tracker',
        BETTER_AUTH_SECRET: 'change-me',
        BETTER_AUTH_URL: 'https://tracker.example.com',
        CORS_ORIGIN: 'https://tracker.example.com',
      }),
    ).toThrow('BETTER_AUTH_SECRET must be at least 32 characters in production')
  })
})
```

- [ ] **Step 2: 实现生产配置校验**

在 `apps/api/src/config/env.ts` 中确保 `validateApiEnv()` 接收可注入 env，并增加生产分支：

```typescript
export function validateApiEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const required = ['DATABASE_URL', 'BETTER_AUTH_SECRET', 'BETTER_AUTH_URL', 'CORS_ORIGIN']
  const missing = required.filter((key) => !env[key])
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`)
  }

  if (env.NODE_ENV === 'production') {
    if (!env.CORS_ORIGIN?.startsWith('https://')) {
      throw new Error('CORS_ORIGIN must use https in production')
    }
    if ((env.BETTER_AUTH_SECRET ?? '').length < 32) {
      throw new Error('BETTER_AUTH_SECRET must be at least 32 characters in production')
    }
    if (!env.BETTER_AUTH_URL?.startsWith('https://')) {
      throw new Error('BETTER_AUTH_URL must use https in production')
    }
  }

  return env
}
```

- [ ] **Step 3: 确认 CORS 使用白名单和 credentials**

`apps/api/src/main.ts` 应保持：

```typescript
app.enableCors({ origin: process.env.CORS_ORIGIN, credentials: true })
```

若需要支持多个 origin，使用逗号分隔白名单并精确匹配，不允许生产环境 `*`。

- [ ] **Step 4: 强化 auth cookie 配置**

在 `apps/api/src/modules/auth/auth.ts` 中为 production 配置 secure cookie。实际字段按 Better Auth 当前 API 调整，目标语义必须是：

```typescript
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [process.env.CORS_ORIGIN].filter(Boolean) as string[],
  advanced: {
    useSecureCookies: process.env.NODE_ENV === 'production',
  },
})
```

- [ ] **Step 5: 写生产部署文档**

创建 `docs/operations/production-deployment.md`，包含：

```markdown
# Production Deployment

## Required environment

- `NODE_ENV=production`
- `DATABASE_URL`
- `BETTER_AUTH_SECRET`, at least 32 random characters
- `BETTER_AUTH_URL`, HTTPS public Web origin
- `CORS_ORIGIN`, HTTPS public Web origin
- `REDIS_HOST`
- `REDIS_PORT`
- `MINIO_ENDPOINT`
- `MINIO_PORT`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `MINIO_BUCKET`

## Reverse proxy

Terminate TLS before API and Web. Forward `X-Forwarded-Proto`, `X-Forwarded-Host`, and `X-Forwarded-For`.

## Cookie policy

Production cookies must be secure and scoped to the HTTPS application origin.

## CORS policy

Do not use wildcard CORS in production. Only the deployed Web origin may call the API with credentials.
```

- [ ] **Step 6: 验证**

```bash
bun run --cwd apps/api test src/config/env.test.ts
bun run --cwd apps/api lint
bun run --cwd apps/api build
```

- [ ] **Step 7: 提交**

```bash
git add apps/api/src/config/env.ts apps/api/src/config/env.test.ts apps/api/src/main.ts apps/api/src/modules/auth/auth.ts docs/operations/production-deployment.md .env.example
git commit -m "feat: 强化生产部署安全配置"
```
